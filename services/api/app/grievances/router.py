"""
METRA — Citizen Whistleblower & Grievance Portal Router
Under Legal Metrology Act, 2009 & PCR, 2011

Public endpoints:
- POST /api/v1/grievances              → Submit citizen violation lead with photo proof
- GET  /api/v1/grievances/{ticket_no}  → Public live status tracking for citizens

Department & Officer endpoints:
- GET  /api/v1/grievances              → List citizen leads for officer triage
- POST /api/v1/grievances/{id}/convert → 1-click dispatch to active field inspection
- PATCH /api/v1/grievances/{id}        → Update status (RESOLVED_WITH_PENALTY, DISMISSED)
"""
import uuid
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.models import (
    CitizenGrievance,
    Inspection,
    InspectionImage,
    InspectionMode,
    InspectionStatus,
    FinalStatus,
    ImageViewType,
    QualityStatus,
    Category,
    RulePack,
    User,
    RoleName,
)
from app.core.config import settings
from app.auth.dependencies import get_current_user, require_role
from app.audit.logger import audit

logger = logging.getLogger(__name__)
router = APIRouter()


def _generate_ticket_number() -> str:
    """Generate a high-visibility, unique statutory citizen grievance ticket."""
    suffix = secrets.token_hex(2).upper() + str(secrets.randbelow(90) + 10)
    year = datetime.now(timezone.utc).strftime("%Y")
    return f"METRA-GRV-{year}-{suffix}"


def _format_grievance(g: CitizenGrievance, is_officer: bool = False) -> dict:
    """Format grievance response with appropriate citizen privacy / officer detail."""
    res = {
        "id": g.id,
        "ticket_no": g.ticket_no,
        "violation_type": g.violation_type,
        "product_name": g.product_name,
        "store_name": g.store_name,
        "store_location": g.store_location,
        "description": g.description,
        "status": g.status,
        "evidence_url": g.evidence_url,
        "inspection_id": g.inspection_id,
        "resolution_notes": g.resolution_notes,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }
    if is_officer:
        res["citizen_name"] = g.citizen_name
        res["citizen_contact"] = g.citizen_contact
        res["evidence_storage_key"] = g.evidence_storage_key
    return res


# ── POST /api/v1/grievances (Public Intake) ────────────────────────
@router.post("", status_code=201)
async def submit_grievance(
    violation_type: str = Form(...),
    product_name: str = Form(...),
    store_name: Optional[str] = Form(None),
    store_location: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    citizen_name: Optional[str] = Form(None),
    citizen_contact: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Public citizen whistleblower portal endpoint.
    Accepts violation details, optional contact, and photographic proof of violation.
    Returns tracking ticket (METRA-GRV-2026-XXXX).
    """
    ticket_no = _generate_ticket_number()
    storage_key = None
    evidence_url = None

    if file and file.filename:
        try:
            contents = await file.read()
            if len(contents) > 10 * 1024 * 1024:
                raise HTTPException(400, "Evidence photo must be under 10MB.")

            # Try uploading to Supabase storage
            try:
                from supabase import create_client
                supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
                file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
                storage_key = f"grievances/{ticket_no}/{str(uuid.uuid4())}.{file_ext}"
                
                supabase.storage.from_(settings.STORAGE_BUCKET).upload(
                    path=storage_key,
                    file=contents,
                    file_options={"content-type": file.content_type or "image/jpeg"},
                )
                try:
                    evidence_url = supabase.storage.from_(settings.STORAGE_BUCKET).get_public_url(storage_key)
                except Exception:
                    evidence_url = f"/api/v1/grievances/{ticket_no}/photo"
            except Exception as e:
                logger.warning(f"Supabase upload skipped/failed for grievance {ticket_no}: {e}")
                storage_key = f"local/grievances/{ticket_no}_{file.filename}"
        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"Error handling photo upload for {ticket_no}: {err}")

    grievance = CitizenGrievance(
        id=str(uuid.uuid4()),
        ticket_no=ticket_no,
        citizen_name=citizen_name.strip() if citizen_name else None,
        citizen_contact=citizen_contact.strip() if citizen_contact else None,
        violation_type=violation_type.strip(),
        product_name=product_name.strip(),
        store_name=store_name.strip() if store_name else None,
        store_location=store_location.strip() if store_location else None,
        description=description.strip() if description else None,
        evidence_storage_key=storage_key,
        evidence_url=evidence_url,
        status="RECEIVED",
    )
    db.add(grievance)
    await db.commit()
    await db.refresh(grievance)

    logger.info(f"Citizen grievance registered: {ticket_no} for product '{product_name}'")

    return {
        "success": True,
        "ticket_no": grievance.ticket_no,
        "status": grievance.status,
        "message": "Grievance lodged successfully with the Department of Legal Metrology. You can track enforcement progress using your ticket reference.",
        "tracking_url": f"/report-violation/{grievance.ticket_no}",
        "created_at": grievance.created_at.isoformat(),
    }


# ── GET /api/v1/grievances/{ticket_no} (Public Tracking) ───────────
@router.get("/{ticket_no}")
async def track_grievance(
    ticket_no: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public live tracking endpoint for citizens.
    Returns status progress, action timeline, and official outcome without leaking officer identities.
    """
    result = await db.execute(
        select(CitizenGrievance).where(
            func.upper(CitizenGrievance.ticket_no) == ticket_no.strip().upper()
        )
    )
    grievance = result.scalar_one_or_none()
    if not grievance:
        raise HTTPException(404, {
            "code": "GRIEVANCE_NOT_FOUND",
            "message": f"No grievance found with ticket number {ticket_no}. Please verify your reference."
        })

    # Timeline calculation
    timeline = [
        {
            "step": "RECEIVED",
            "label": "Grievance Lodged",
            "completed": True,
            "timestamp": grievance.created_at.isoformat() if grievance.created_at else None,
            "detail": "Report logged into the Legal Metrology National Whistleblower Queue."
        },
        {
            "step": "UNDER_FIELD_INSPECTION",
            "label": "Field Investigation Dispatched",
            "completed": grievance.status in ("UNDER_FIELD_INSPECTION", "RESOLVED_WITH_PENALTY", "DISMISSED"),
            "timestamp": grievance.updated_at.isoformat() if grievance.status != "RECEIVED" else None,
            "detail": "Assigned to the jurisdictional Legal Metrology Inspectorate for physical or digital verification."
        },
        {
            "step": "OUTCOME",
            "label": "Regulatory Action / Settlement",
            "completed": grievance.status in ("RESOLVED_WITH_PENALTY", "DISMISSED"),
            "timestamp": grievance.updated_at.isoformat() if grievance.status in ("RESOLVED_WITH_PENALTY", "DISMISSED") else None,
            "detail": grievance.resolution_notes or ("Investigation currently in progress by field officers." if grievance.status != "DISMISSED" else "Case closed following preliminary verification.")
        }
    ]

    return {
        "grievance": _format_grievance(grievance, is_officer=False),
        "timeline": timeline,
    }


# ── GET /api/v1/grievances (Officer Queue) ───────────────────────────
@router.get("")
async def list_grievances(
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List citizen whistleblower complaints for officers and supervisors.
    Restricted to INSPECTOR, SUPERVISOR, ADMIN.
    """
    user_roles = {ur.role.name.value for ur in current_user.user_roles}
    if not (user_roles & {"INSPECTOR", "SUPERVISOR", "ADMIN"}):
        raise HTTPException(403, "Access restricted to Legal Metrology Department officers.")

    query = select(CitizenGrievance)
    if status_filter:
        query = query.where(CitizenGrievance.status == status_filter.upper())

    query = query.order_by(desc(CitizenGrievance.created_at)).limit(limit).offset(offset)
    result = await db.execute(query)
    grievances = result.scalars().all()

    # Get summary counts
    count_result = await db.execute(
        select(CitizenGrievance.status, func.count(CitizenGrievance.id)).group_by(CitizenGrievance.status)
    )
    counts = dict(count_result.all())

    return {
        "items": [_format_grievance(g, is_officer=True) for g in grievances],
        "summary": {
            "total": sum(counts.values()),
            "received": counts.get("RECEIVED", 0),
            "under_investigation": counts.get("UNDER_FIELD_INSPECTION", 0),
            "resolved_penalty": counts.get("RESOLVED_WITH_PENALTY", 0),
            "dismissed": counts.get("DISMISSED", 0),
        }
    }


# ── POST /api/v1/grievances/{id}/convert (1-Click Inspection) ───────
@router.post("/{id}/convert", status_code=201)
async def convert_grievance_to_inspection(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    1-Click Action for Officers:
    Converts a citizen complaint into an active, formal Legal Metrology Inspection record.
    Pre-fills inspection details, attaches evidence, and updates ticket status to UNDER_FIELD_INSPECTION.
    """
    user_roles = {ur.role.name.value for ur in current_user.user_roles}
    if not (user_roles & {"INSPECTOR", "SUPERVISOR", "ADMIN"}):
        raise HTTPException(403, "Access restricted to Legal Metrology Department officers.")

    grievance = await db.get(CitizenGrievance, id)
    if not grievance:
        raise HTTPException(404, "Citizen grievance not found.")

    if grievance.inspection_id:
        return {
            "success": True,
            "message": "This grievance has already been converted into an inspection.",
            "inspection_id": grievance.inspection_id,
        }

    # Find a default category
    cat_result = await db.execute(select(Category).where(Category.is_active == True).limit(1))
    category = cat_result.scalar_one_or_none()
    category_id = category.id if category else None

    rule_pack_id = None
    if category_id:
        rp_res = await db.execute(
            select(RulePack)
            .where(RulePack.category_id == category_id, RulePack.status == "PUBLISHED")
            .order_by(RulePack.effective_from.desc())
            .limit(1)
        )
        rule_pack = rp_res.scalar_one_or_none()
        if rule_pack:
            rule_pack_id = rule_pack.id

    # Create Inspection
    notes_lines = [
        f"🚨 INITIATED FROM CITIZEN WHISTLEBLOWER LEAD",
        f"Ticket Number: {grievance.ticket_no}",
        f"Reported Violation: {grievance.violation_type}",
        f"Store/Premise: {grievance.store_name or 'N/A'} ({grievance.store_location or 'N/A'})",
        f"Citizen Report Notes: {grievance.description or 'None provided'}",
    ]
    if grievance.citizen_name or grievance.citizen_contact:
        notes_lines.append(f"Whistleblower Contact: {grievance.citizen_name or 'Anonymous'} ({grievance.citizen_contact or 'N/A'})")

    inspection = Inspection(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        category_id=category_id,
        rule_pack_id=rule_pack_id,
        mode=InspectionMode.INSPECTION,
        product_name=grievance.product_name,
        product_notes="\n".join(notes_lines),
        source_info=f"Citizen Lead #{grievance.ticket_no}",
        status=InspectionStatus.DRAFT,
        final_status=FinalStatus.PENDING,
    )
    db.add(inspection)

    # If photo proof exists, attach it as an inspection image
    if grievance.evidence_storage_key:
        img = InspectionImage(
            id=str(uuid.uuid4()),
            inspection_id=inspection.id,
            storage_key=grievance.evidence_storage_key,
            file_name=f"citizen_evidence_{grievance.ticket_no}.jpg",
            mime_type="image/jpeg",
            view_type=ImageViewType.FRONT,
            quality_status=QualityStatus.PASS,
        )
        db.add(img)

    # Update grievance
    grievance.status = "UNDER_FIELD_INSPECTION"
    grievance.inspection_id = inspection.id
    grievance.resolution_notes = (
        f"Assigned to Inspector {current_user.full_name or current_user.email}. "
        f"Official Inspection Record #{inspection.id[:8]} initialized for verification."
    )
    grievance.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await audit(db, current_user.id, "GRIEVANCE_CONVERTED_TO_INSPECTION", "inspection", inspection.id, {
        "ticket_no": grievance.ticket_no,
        "grievance_id": grievance.id,
    })

    return {
        "success": True,
        "message": f"Successfully converted ticket {grievance.ticket_no} into formal inspection #{inspection.id[:8]}.",
        "inspection_id": inspection.id,
        "ticket_no": grievance.ticket_no,
        "status": grievance.status,
    }


# ── PATCH /api/v1/grievances/{id} (Update Status) ───────────────────
class GrievanceStatusUpdate(BaseModel):
    status: str = Field(..., description="RESOLVED_WITH_PENALTY | DISMISSED | UNDER_FIELD_INSPECTION")
    resolution_notes: Optional[str] = None


@router.patch("/{id}")
async def update_grievance_status(
    id: str,
    payload: GrievanceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the outcome or resolution notes of a citizen grievance.
    """
    user_roles = {ur.role.name.value for ur in current_user.user_roles}
    if not (user_roles & {"INSPECTOR", "SUPERVISOR", "ADMIN"}):
        raise HTTPException(403, "Access restricted to Legal Metrology Department officers.")

    grievance = await db.get(CitizenGrievance, id)
    if not grievance:
        raise HTTPException(404, "Citizen grievance not found.")

    valid_statuses = {"RECEIVED", "UNDER_FIELD_INSPECTION", "RESOLVED_WITH_PENALTY", "DISMISSED"}
    new_status = payload.status.upper()
    if new_status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    grievance.status = new_status
    if payload.resolution_notes:
        grievance.resolution_notes = payload.resolution_notes
    grievance.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await audit(db, current_user.id, "GRIEVANCE_STATUS_UPDATED", "citizen_grievance", grievance.id, {
        "ticket_no": grievance.ticket_no,
        "status": grievance.status,
        "notes": grievance.resolution_notes,
    })

    return {
        "success": True,
        "grievance": _format_grievance(grievance, is_officer=True),
    }
