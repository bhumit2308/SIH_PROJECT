"""
METRA – Report Generation Router
POST /api/v1/inspections/{inspection_id}/report  → generate statutory PDF
GET  /api/v1/inspections/{inspection_id}/report  → get latest report download URL
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.models import (
    Inspection, InspectionStatus, Report,
    RoleName, User
)
from app.core.config import settings
from app.auth.dependencies import get_current_user, require_role

logger = logging.getLogger(__name__)
router = APIRouter()


async def _build_inspection_data(inspection: Inspection, current_user: User) -> dict:
    """Flatten an Inspection ORM object into the dict the PDF generator expects."""
    fields = []
    for ef in (inspection.extracted_fields or []):
        fields.append({
            "field_code":       ef.field_code,
            "raw_value":        ef.raw_value,
            "normalized_value": ef.normalized_value,
            "confidence":       ef.confidence,
        })

    findings = []
    for f in (inspection.findings or []):
        findings.append({
            "status":       f.status.value,
            "severity":     f.severity.value if f.severity else "MEDIUM",
            "message":      f.message,
            "field_code":   f.field_code,
            "ai_raw_value": f.ai_raw_value,
        })

    return {
        "product_name":    inspection.product_name or "Packaged Commodity",
        "category_name":   inspection.category.name_en if inspection.category else "General",
        "mode":            inspection.mode.value,
        "status":          inspection.status.value,
        "final_status":    inspection.final_status.value,
        "created_at":      inspection.created_at.isoformat(),
        "inspector_name":  current_user.full_name or current_user.email,
        "inspector_email": current_user.email,
        "organisation":    current_user.organisation or "Department of Legal Metrology",
        "extracted_fields": fields,
        "findings":        findings,
    }


# ── POST – Generate Report ────────────────────────────────────
@router.post("/{inspection_id}/report", status_code=201)
async def generate_report(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(
        RoleName.INSPECTOR, RoleName.SUPERVISOR, RoleName.ADMIN
    )),
):
    """
    Generates a statutory Legal Metrology Inspection Certificate PDF,
    uploads it to Supabase metra-reports bucket, and returns a signed 1-hour download URL.
    """
    result = await db.execute(
        select(Inspection)
        .options(
            selectinload(Inspection.category),
            selectinload(Inspection.extracted_fields),
            selectinload(Inspection.findings),
        )
        .where(Inspection.id == inspection_id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Inspection not found."})

    # Allow report generation for any non-DRAFT status
    if inspection.status == InspectionStatus.DRAFT:
        raise HTTPException(400, {
            "code": "INSPECTION_NOT_READY",
            "message": "Upload images and run analysis before generating a report.",
        })

    inspection_data = await _build_inspection_data(inspection, current_user)

    try:
        from app.reports.service import generate_and_upload_report
        result_data = await generate_and_upload_report(
            inspection_id=inspection_id,
            inspection_data=inspection_data,
            user_id=current_user.id,
            supabase_url=settings.SUPABASE_URL,
            supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY,
            report_bucket=settings.REPORT_BUCKET,
        )
    except Exception as e:
        logger.exception(f"Report generation failed for {inspection_id}: {e}")
        raise HTTPException(500, {
            "code": "REPORT_GENERATION_FAILED",
            "message": f"PDF generation error: {str(e)}",
        })

    return {
        "report_id":    result_data["report_id"],
        "download_url": result_data["download_url"],
        "inspection_id": inspection_id,
        "message": "Statutory inspection certificate generated successfully.",
    }


# ── GET – Latest Report ───────────────────────────────────────
@router.get("/{inspection_id}/report")
async def get_latest_report(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the most recently generated report for an inspection with a fresh signed URL."""
    report_result = await db.execute(
        select(Report)
        .where(Report.inspection_id == inspection_id)
        .order_by(Report.created_at.desc())
        .limit(1)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        return {"report": None, "message": "No report generated yet."}

    # Refresh signed URL
    try:
        from supabase import create_client
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        signed = supabase.storage.from_(settings.REPORT_BUCKET).create_signed_url(
            report.storage_key, 3600
        )
        download_url = signed.get("signedURL") or signed.get("signedUrl") or ""
    except Exception as e:
        logger.warning(f"Could not refresh signed URL for report {report.id}: {e}")
        download_url = ""

    return {
        "report": {
            "report_id":    report.id,
            "download_url": download_url,
            "file_size_bytes": report.file_size_bytes,
            "created_at":   report.created_at.isoformat(),
        }
    }
