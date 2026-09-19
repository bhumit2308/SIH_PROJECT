"""
Extraction + Rule Engine Orchestration Service
==============================================
Runs: Image fetch → AI extraction → Confidence thresholds → Rule evaluation → Findings
This is the core METRA pipeline. The rule engine never calls AI directly.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.core.models import (
    Inspection, InspectionImage, ExtractedField, Finding, ReviewTask,
    AnalysisJob, RulePack, Rule, InspectionStatus, FinalStatus,
    FindingStatus, Severity, JobStatus, QualityStatus, EvidenceRegion,
)
from app.core.config import settings
from app.ai.adapter import ExtractionResult, ExtractionField
from app.audit.logger import audit

logger = logging.getLogger(__name__)

# Confidence thresholds — below these, field goes to REVIEW_REQUIRED
CONFIDENCE_THRESHOLDS = {
    "product_name":    0.85,
    "net_quantity":    0.80,
    "mrp":            0.85,
    "manufacturer":   0.75,
    "date_info":      0.70,
    "consumer_care":  0.65,
    "country_of_origin": 0.80,
    "unit_sale_price": 0.75,
}


def _get_adapter():
    if settings.AI_PROVIDER == "gemini":
        from app.ai.gemini_adapter import GeminiAdapter
        return GeminiAdapter()
    from app.ai.mock_adapter import MockAdapter
    return MockAdapter()


def _load_rule_pack(pack_json: dict) -> list[dict]:
    return pack_json.get("rules", [])


async def run_extraction_and_rules(inspection_id: str, job_id: str):
    """Main async pipeline — runs outside request context."""
    async with AsyncSessionLocal() as db:
        try:
            await _run(db, inspection_id, job_id)
        except Exception as e:
            logger.exception(f"Pipeline failed for inspection {inspection_id}: {e}")
            await _mark_job_failed(db, job_id, str(e))
            await _mark_inspection_failed(db, inspection_id)


async def _run(db: AsyncSession, inspection_id: str, job_id: str):
    # Mark job as running
    job = await db.get(AnalysisJob, job_id)
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    job.attempt += 1
    await db.commit()

    # Load inspection with images and rule pack
    result = await db.execute(
        select(Inspection)
        .options(
            selectinload(Inspection.images),
            selectinload(Inspection.rule_pack).selectinload(RulePack.rules),
        )
        .where(Inspection.id == inspection_id)
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise ValueError(f"Inspection {inspection_id} not found")

    # Get good quality images
    good_images = [i for i in inspection.images if i.quality_status != QualityStatus.RETAKE]
    if not good_images:
        raise ValueError("No valid images to analyze")

    adapter = _get_adapter()
    all_extractions: dict[str, list[ExtractionField]] = {}

    # ── Step 1: Extract from each good image ─────────────
    from supabase import create_client
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    for image in good_images:
        try:
            file_resp = supabase.storage.from_(settings.STORAGE_BUCKET).download(image.storage_key)
            image_bytes = file_resp
            context = {
                "category": inspection.category_id,
                "is_imported": inspection.is_imported,
                "view_type": image.view_type.value,
            }
            extraction: ExtractionResult = await adapter.extract(image_bytes, context)

            if extraction.extraction_error:
                logger.warning(f"Extraction error on image {image.id}: {extraction.extraction_error}")
                continue

            # Store extracted fields
            for field_code in ["product_name", "net_quantity", "mrp", "manufacturer",
                               "date_info", "consumer_care", "country_of_origin", "unit_sale_price"]:
                field_val: ExtractionField | None = getattr(extraction, field_code, None)
                if field_val and field_val.raw_value:
                    ef = ExtractedField(
                        id=str(uuid.uuid4()),
                        inspection_id=inspection_id,
                        source_image_id=image.id,
                        field_code=field_code,
                        raw_value=field_val.raw_value,
                        confidence=field_val.confidence,
                        parsed_data={"bbox": field_val.bounding_box} if field_val.bounding_box else None,
                    )
                    db.add(ef)
                    all_extractions.setdefault(field_code, []).append((field_val, image.id))

        except Exception as e:
            logger.error(f"Failed to process image {image.id}: {e}")

    await db.flush()

    # ── Step 2: Build aggregated field view (best confidence wins) ─
    best_fields: dict[str, ExtractionField] = {}
    best_field_images: dict[str, str] = {}
    for field_code, field_tuples in all_extractions.items():
        best_tuple = max(field_tuples, key=lambda t: t[0].confidence)
        best_fields[field_code] = best_tuple[0]
        best_field_images[field_code] = best_tuple[1]

    # ── Step 3: Run deterministic rule engine ─────────────
    findings = []
    rule_pack_json = inspection.rule_pack.pack_json if inspection.rule_pack else None

    if not rule_pack_json:
        logger.warning(f"No rule pack JSON for inspection {inspection_id}. Cannot run rules.")
    else:
        rules = _load_rule_pack(rule_pack_json)
        for rule_config in rules:
            finding = _evaluate_rule(rule_config, best_fields, inspection)
            if finding:
                findings.append(finding)

    # ── Step 4: Check confidence thresholds ───────────────
    for field_code, field_val in best_fields.items():
        threshold = CONFIDENCE_THRESHOLDS.get(field_code, 0.75)
        if field_val.confidence < threshold and field_val.raw_value:
            # Low confidence finding
            f = Finding(
                id=str(uuid.uuid4()),
                inspection_id=inspection_id,
                status=FindingStatus.REVIEW_REQUIRED,
                severity=Severity.MEDIUM,
                message=f"Field '{field_code}' extracted with low confidence ({field_val.confidence:.0%}). Human verification required.",
                field_code=field_code,
                ai_raw_value=field_val.raw_value,
            )
            db.add(f)
            if field_val.bounding_box:
                ev = EvidenceRegion(
                    id=str(uuid.uuid4()),
                    finding_id=f.id,
                    image_id=best_field_images.get(field_code),
                    x=field_val.bounding_box.get("x"),
                    y=field_val.bounding_box.get("y"),
                    width=field_val.bounding_box.get("width"),
                    height=field_val.bounding_box.get("height"),
                    source_text=field_val.raw_value,
                )
                db.add(ev)
            # Create review task
            rt = ReviewTask(id=str(uuid.uuid4()), finding_id=f.id)
            db.add(rt)

    # ── Step 5: Persist rule findings ─────────────────────
    has_violation = False
    has_review = False
    for finding_data in findings:
        f = Finding(
            id=str(uuid.uuid4()),
            inspection_id=inspection_id,
            status=FindingStatus(finding_data["status"]),
            severity=Severity(finding_data.get("severity", "MEDIUM")),
            message=finding_data["message"],
            field_code=finding_data.get("field_code"),
            ai_raw_value=finding_data.get("ai_value"),
        )
        db.add(f)
        fc = finding_data.get("field_code")
        if fc and fc in best_fields:
            best_f = best_fields[fc]
            if best_f.bounding_box:
                ev = EvidenceRegion(
                    id=str(uuid.uuid4()),
                    finding_id=f.id,
                    image_id=best_field_images.get(fc),
                    x=best_f.bounding_box.get("x"),
                    y=best_f.bounding_box.get("y"),
                    width=best_f.bounding_box.get("width"),
                    height=best_f.bounding_box.get("height"),
                    source_text=best_f.raw_value,
                )
                db.add(ev)
        if f.status == FindingStatus.VIOLATION:
            has_violation = True
        if f.status == FindingStatus.REVIEW_REQUIRED:
            has_review = True
            rt = ReviewTask(id=str(uuid.uuid4()), finding_id=f.id)
            db.add(rt)

    # ── Step 6: Compute overall inspection status ─────────
    if has_violation:
        final_status = FinalStatus.NON_COMPLIANT
        inspection_status = InspectionStatus.REVIEW_REQUIRED
    elif has_review:
        final_status = FinalStatus.REVIEW_REQUIRED
        inspection_status = InspectionStatus.REVIEW_REQUIRED
    else:
        final_status = FinalStatus.COMPLIANT
        inspection_status = InspectionStatus.REVIEW_REQUIRED  # Always goes to human before finalizing

    inspection.status = inspection_status
    inspection.final_status = final_status

    # Mark job complete
    job.status = JobStatus.COMPLETED
    job.completed_at = datetime.now(timezone.utc)

    await db.commit()
    logger.info(f"Analysis complete for inspection {inspection_id}: {final_status.value}")


def _evaluate_rule(rule: dict, fields: dict, inspection: Inspection) -> dict | None:
    """Deterministic rule evaluation. Returns finding dict or None."""
    applies_when = rule.get("applies_when", "always")

    # Evaluate applicability
    if applies_when != "always":
        if applies_when == "is_imported == true" and not inspection.is_imported:
            return None  # Rule not applicable
        if applies_when == "net_quantity_present" and "net_quantity" not in fields:
            return None

    field_code = rule.get("field_code")
    check_type = rule.get("check_type")

    # ── Presence check ────────────────────────────────────
    if check_type in ("presence", "presence_and_format"):
        field = fields.get(field_code)
        if not field or not field.raw_value:
            return {
                "status": "VIOLATION",
                "severity": rule.get("severity", "HIGH"),
                "message": rule.get("message_on_fail", f"Required field '{field_code}' is missing."),
                "field_code": field_code,
                "rule_id": rule.get("id"),
                "ai_value": None,
            }
        # Format check
        if check_type == "presence_and_format" and field_code == "mrp":
            raw = field.raw_value.upper()
            if not any(kw in raw for kw in ["MRP", "RS.", "RS ", "₹", "RUPEE"]):
                return {
                    "status": "WARNING",
                    "severity": "MEDIUM",
                    "message": f"MRP field found but may not include required prefix (MRP/Rs.). Found: '{field.raw_value}'",
                    "field_code": field_code,
                    "rule_id": rule.get("id"),
                    "ai_value": field.raw_value,
                }

    # ── Structure check (SI units) ────────────────────────
    elif check_type == "structure" and field_code == "net_quantity":
        field = fields.get(field_code)
        if field and field.raw_value:
            allowed_units = rule.get("allowed_units", ["g", "kg", "ml", "l", "L"])
            raw_lower = field.raw_value.lower().replace(" ", "")
            has_si_unit = any(unit.lower() in raw_lower for unit in allowed_units)
            if not has_si_unit:
                return {
                    "status": "WARNING",
                    "severity": "MEDIUM",
                    "message": f"Net quantity '{field.raw_value}' may not use standard SI units. Expected: g, kg, ml, L etc.",
                    "field_code": field_code,
                    "rule_id": rule.get("id"),
                    "ai_value": field.raw_value,
                }

    # ── Applicability check ───────────────────────────────
    elif check_type == "applicability":
        if inspection.is_imported:
            field = fields.get(field_code)
            if not field or not field.raw_value:
                return {
                    "status": "VIOLATION",
                    "severity": rule.get("severity", "HIGH"),
                    "message": rule.get("message_on_fail", f"'{field_code}' is mandatory for imported products."),
                    "field_code": field_code,
                    "rule_id": rule.get("id"),
                    "ai_value": None,
                }

    return None  # All checks passed


async def _mark_job_failed(db: AsyncSession, job_id: str, error: str):
    job = await db.get(AnalysisJob, job_id)
    if job:
        job.status = JobStatus.FAILED
        job.error_message = error[:1000]
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()


async def _mark_inspection_failed(db: AsyncSession, inspection_id: str):
    inspection = await db.get(Inspection, inspection_id)
    if inspection:
        inspection.status = InspectionStatus.FAILED
        await db.commit()
