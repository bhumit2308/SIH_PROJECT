from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.models import (
    Inspection, InspectionImage, Category, RulePack, Finding,
    InspectionMode, InspectionStatus, FinalStatus,
    ImageViewType, QualityStatus, RoleName, User
)
from app.auth.dependencies import get_current_user, require_role
from app.images.quality import run_quality_checks
from app.audit.logger import audit
from app.core.config import settings
import uuid, logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Schemas ───────────────────────────────────────────────
class CreateInspectionRequest(BaseModel):
    category_id: str
    mode: InspectionMode = InspectionMode.INSPECTION
    product_name: Optional[str] = None
    product_notes: Optional[str] = None
    source_info: Optional[str] = None
    is_imported: bool = False


class FinalizeInspectionRequest(BaseModel):
    final_status: FinalStatus
    note: Optional[str] = None


class InspectionOut(BaseModel):
    id: str
    status: str
    final_status: str
    mode: str
    category_id: str
    product_name: Optional[str]
    is_imported: bool
    created_at: datetime
    rule_pack_id: Optional[str]

    class Config:
        from_attributes = True


# ── Create Inspection ─────────────────────────────────────
@router.post("", response_model=InspectionOut, status_code=201)
async def create_inspection(
    payload: CreateInspectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.INSPECTOR, RoleName.SUPERVISOR, RoleName.MANUFACTURER, RoleName.ADMIN)),
):
    # Validate category exists
    cat = await db.get(Category, payload.category_id)
    if not cat or not cat.is_active:
        raise HTTPException(404, {"code": "CATEGORY_NOT_FOUND", "message": "Category not found."})

    # Pin the latest published rule pack for this category
    rp_result = await db.execute(
        select(RulePack)
        .where(RulePack.category_id == payload.category_id, RulePack.status == "PUBLISHED")
        .order_by(RulePack.effective_from.desc())
        .limit(1)
    )
    rule_pack = rp_result.scalar_one_or_none()

    inspection = Inspection(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        category_id=payload.category_id,
        rule_pack_id=rule_pack.id if rule_pack else None,
        mode=payload.mode,
        product_name=payload.product_name,
        product_notes=payload.product_notes,
        source_info=payload.source_info,
        is_imported=payload.is_imported,
        status=InspectionStatus.DRAFT,
        final_status=FinalStatus.PENDING,
    )
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)
    await audit(db, current_user.id, "INSPECTION_CREATED", "inspection", inspection.id)
    logger.info(f"Inspection {inspection.id} created by {current_user.email}")
    return inspection


# ── List Inspections ──────────────────────────────────────
@router.get("")
async def list_inspections(
    status_filter: Optional[str] = None,
    category_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_roles = {ur.role.name.value for ur in current_user.user_roles}
    query = select(Inspection).options(selectinload(Inspection.category))

    # Manufacturers only see their own
    if "MANUFACTURER" in user_roles and "ADMIN" not in user_roles and "SUPERVISOR" not in user_roles:
        query = query.where(Inspection.user_id == current_user.id)
    elif "INSPECTOR" in user_roles and "SUPERVISOR" not in user_roles and "ADMIN" not in user_roles:
        query = query.where(Inspection.user_id == current_user.id)

    if status_filter:
        query = query.where(Inspection.status == status_filter)
    if category_id:
        query = query.where(Inspection.category_id == category_id)

    query = query.order_by(Inspection.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    inspections = result.scalars().all()
    return [
        {
            "id": i.id, "status": i.status.value, "final_status": i.final_status.value,
            "mode": i.mode.value, "category": i.category.name_en if i.category else None,
            "product_name": i.product_name, "created_at": i.created_at.isoformat(),
        }
        for i in inspections
    ]


def _serialize_inspection(inspection: Inspection) -> dict:
    return {
        "id": str(inspection.id),
        "category_id": str(inspection.category_id),
        "category": {
            "code": inspection.category.code,
            "name_en": inspection.category.name_en,
        } if inspection.category else None,
        "product_name": inspection.product_name,
        "product_notes": inspection.product_notes,
        "source_info": inspection.source_info,
        "mode": inspection.mode.value if hasattr(inspection.mode, "value") else str(inspection.mode),
        "status": inspection.status.value if hasattr(inspection.status, "value") else str(inspection.status),
        "final_status": inspection.final_status.value if hasattr(inspection.final_status, "value") else str(inspection.final_status),
        "created_at": inspection.created_at.isoformat() if inspection.created_at else None,
        "finalized_at": inspection.finalized_at.isoformat() if inspection.finalized_at else None,
        "images": [
            {
                "id": str(img.id),
                "view_type": img.view_type.value if hasattr(img.view_type, "value") else str(img.view_type),
                "storage_key": img.storage_key,
                "file_name": img.file_name,
                "quality_status": img.quality_status.value if hasattr(img.quality_status, "value") else str(img.quality_status),
                "quality_checks": img.quality_checks,
                "width_px": img.width_px,
                "height_px": img.height_px,
            }
            for img in (inspection.images or [])
        ],
        "extracted_fields": [
            {
                "id": str(ef.id),
                "field_code": ef.field_code,
                "raw_value": ef.raw_value,
                "normalized_value": ef.normalized_value,
                "confidence": ef.confidence,
                "source_image_id": str(ef.source_image_id) if ef.source_image_id else None,
                "parsed_data": ef.parsed_data,
            }
            for ef in (inspection.extracted_fields or [])
        ],
        "findings": [
            {
                "id": str(f.id),
                "rule_id": str(f.rule_id) if f.rule_id else None,
                "status": f.status.value if hasattr(f.status, "value") else str(f.status),
                "severity": f.severity.value if hasattr(f.severity, "value") else str(f.severity),
                "message": f.message,
                "field_code": f.field_code,
                "ai_raw_value": f.ai_raw_value,
                "evidence_regions": [
                    {
                        "id": str(ev.id),
                        "image_id": str(ev.image_id) if ev.image_id else None,
                        "x": ev.x,
                        "y": ev.y,
                        "width": ev.width,
                        "height": ev.height,
                        "source_text": ev.source_text,
                    }
                    for ev in (f.evidence_regions or [])
                ],
            }
            for f in (inspection.findings or [])
        ],
    }


# ── Get Single Inspection ─────────────────────────────────
@router.get("/{inspection_id}")
async def get_inspection(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Inspection)
        .options(
            selectinload(Inspection.category),
            selectinload(Inspection.images),
            selectinload(Inspection.extracted_fields),
            selectinload(Inspection.findings).selectinload(Finding.evidence_regions),
            selectinload(Inspection.analysis_jobs),
        )
        .where(Inspection.id == inspection_id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Inspection not found."})
    return _serialize_inspection(inspection)


# ── Upload Image ──────────────────────────────────────────
@router.post("/{inspection_id}/images", status_code=201)
async def upload_image(
    inspection_id: str,
    view_type: ImageViewType = Form(ImageViewType.FRONT),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.INSPECTOR, RoleName.MANUFACTURER, RoleName.ADMIN)),
):
    # Get inspection
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Inspection not found."})
    if inspection.status == InspectionStatus.FINALIZED:
        raise HTTPException(409, {"code": "ALREADY_FINALIZED", "message": "Cannot upload to a finalized inspection."})

    # Validate file
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, {"code": "INVALID_FILE_TYPE", "message": f"Allowed types: JPEG, PNG, WebP. Got: {file.content_type}"})

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(400, {"code": "FILE_TOO_LARGE", "message": "File must be under 10MB."})
    if len(contents) < 1024:
        raise HTTPException(400, {"code": "FILE_TOO_SMALL", "message": "File is too small to be a valid photo."})

    # Upload to Supabase Storage
    from supabase import create_client
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    storage_key = f"inspections/{inspection_id}/{str(uuid.uuid4())}_{file.filename}"
    supabase.storage.from_(settings.STORAGE_BUCKET).upload(
        path=storage_key,
        file=contents,
        file_options={"content-type": file.content_type},
    )

    # Run quality checks
    quality_result = run_quality_checks(contents)

    # Save image record
    image = InspectionImage(
        id=str(uuid.uuid4()),
        inspection_id=inspection_id,
        storage_key=storage_key,
        file_name=file.filename,
        mime_type=file.content_type,
        file_size_bytes=len(contents),
        view_type=view_type,
        quality_status=QualityStatus(quality_result["status"]),
        quality_checks=quality_result["checks"],
        width_px=quality_result.get("width"),
        height_px=quality_result.get("height"),
    )
    db.add(image)

    # Update inspection status
    if inspection.status == InspectionStatus.DRAFT:
        inspection.status = InspectionStatus.IMAGES_UPLOADED

    await db.commit()
    await db.refresh(image)

    # Get signed URL (1 hour)
    signed = supabase.storage.from_(settings.STORAGE_BUCKET).create_signed_url(storage_key, 3600)

    return {
        "id": image.id,
        "view_type": image.view_type.value,
        "quality_status": image.quality_status.value,
        "quality_checks": image.quality_checks,
        "file_name": image.file_name,
        "signed_url": signed.get("signedURL"),
        "width_px": image.width_px,
        "height_px": image.height_px,
    }


# ── Trigger Analysis ──────────────────────────────────────
@router.post("/{inspection_id}/analyze", status_code=202)
async def start_analysis(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.INSPECTOR, RoleName.ADMIN)),
):
    from app.core.models import AnalysisJob, JobStatus
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Inspection not found."})

    # Check all images pass quality
    img_result = await db.execute(
        select(InspectionImage).where(InspectionImage.inspection_id == inspection_id)
    )
    images = img_result.scalars().all()
    if not images:
        raise HTTPException(400, {"code": "NO_IMAGES", "message": "Upload at least one image before analyzing."})

    retake_images = [i for i in images if i.quality_status == QualityStatus.RETAKE]
    if retake_images:
        raise HTTPException(400, {
            "code": "IMAGES_NEED_RETAKE",
            "message": f"{len(retake_images)} image(s) need to be retaken before analysis.",
        })

    # Create analysis job
    job = AnalysisJob(
        id=str(uuid.uuid4()),
        inspection_id=inspection_id,
        status=JobStatus.PENDING,
    )
    db.add(job)
    inspection.status = InspectionStatus.PROCESSING
    await db.commit()
    await audit(db, current_user.id, "ANALYSIS_STARTED", "inspection", inspection_id)

    # TODO: Enqueue to ARQ worker (Loop 4)
    # For now, run inline for MVP
    from app.extraction.service import run_extraction_and_rules
    import asyncio
    asyncio.create_task(run_extraction_and_rules(inspection_id, job.id))

    return {"job_id": job.id, "status": "PENDING", "message": "Analysis job queued."}


# ── Get Analysis Status ───────────────────────────────────
@router.get("/{inspection_id}/analysis")
async def get_analysis(
    inspection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.models import AnalysisJob
    result = await db.execute(
        select(AnalysisJob)
        .where(AnalysisJob.inspection_id == inspection_id)
        .order_by(AnalysisJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        return {"status": "NO_JOB", "message": "No analysis job found for this inspection."}
    return {
        "job_id": job.id,
        "status": job.status.value,
        "error": job.error_message,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


# ── Finalize Inspection ───────────────────────────────────
@router.post("/{inspection_id}/finalize")
async def finalize_inspection(
    inspection_id: str,
    payload: FinalizeInspectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleName.INSPECTOR, RoleName.ADMIN)),
):
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Inspection not found."})

    inspection.final_status = payload.final_status
    inspection.status = InspectionStatus.FINALIZED
    inspection.finalized_at = datetime.now(timezone.utc)
    if payload.note:
        existing = inspection.product_notes or ""
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        inspection.product_notes = f"{existing}\n\n[Determination by Officer {current_user.email} on {stamp}]: {payload.note}".strip()

    await db.commit()
    await db.refresh(inspection)

    await audit(
        db,
        current_user.id,
        "INSPECTION_FINALIZED",
        "inspection",
        inspection_id,
        {
            "final_status": inspection.final_status.value,
            "note": payload.note,
        },
    )

    return {
        "id": inspection.id,
        "status": inspection.status.value,
        "final_status": inspection.final_status.value,
        "finalized_at": inspection.finalized_at.isoformat() if inspection.finalized_at else None,
        "product_notes": inspection.product_notes,
        "message": f"Inspection determination recorded as {inspection.final_status.value}."
    }
