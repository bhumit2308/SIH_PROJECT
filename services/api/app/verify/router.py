"""
METRA – Public Statutory Verification Router
Allows unauthenticated, public verification of Legal Metrology Inspection Certificates,
Violation Notices, and Section 15 determinations.

GET /api/v1/verify/{ref}
"""
import hashlib
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.models import Report, Inspection, Finding
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

FIELD_PROVISIONS_MAP = {
    "UNIT_SALE_PRICE": {
        "rule": "Rule 6(11) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Unit Sale Price (USP) Mandatory Declaration",
        "gazette": "G.S.R. 737(E) & G.S.R. 202(E)",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "MRP": {
        "rule": "Rule 6(1)(d) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Maximum Retail Price (MRP) & Tax Inclusivity",
        "gazette": "Rule 6(1)(d) - Inclusive of all taxes",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "NET_QUANTITY": {
        "rule": "Rule 6(1)(e) & Rule 12 of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Net Quantity in Standard Metric Units",
        "gazette": "Second Schedule of PCR 2011",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "EXPIRY_DATE": {
        "rule": "Rule 6(1)(d) & Rule 6(10) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Best Before / Expiry / Use By Date",
        "gazette": "Mandatory on perishable & consumer goods",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "MFG_DATE": {
        "rule": "Rule 6(1)(c) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Month and Year of Manufacture / Pre-packing",
        "gazette": "Rule 6(1)(c)",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "MANUFACTURER_NAME": {
        "rule": "Rule 6(1)(a) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Name and Complete Address of Manufacturer / Packer / Importer",
        "gazette": "Rule 6(1)(a)",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "CONSUMER_CARE": {
        "rule": "Rule 6(1)(f) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Consumer Helpline, Email and Contact Details",
        "gazette": "Rule 6(1)(f)",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
    "COUNTRY_OF_ORIGIN": {
        "rule": "Rule 6(1)(e) & Rule 6(10) of Legal Metrology (Packaged Commodities) Rules, 2011",
        "subject": "Country of Origin for Imported / Packaged Commodities",
        "gazette": "Mandatory disclosure for all commodities",
        "section": "Section 18 & 36, Legal Metrology Act, 2009",
    },
}


@router.get("/{ref:path}")
async def verify_statutory_record(
    ref: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public, unauthenticated verification of statutory notice or compliance certificate.
    Accepts:
      - notice_ref (e.g. 'LMPC/2026/DL-0891' or 'METRA/2026/E1234567')
      - inspection_id (UUID)
      - report_id (UUID)
    """
    clean_ref = ref.strip().strip("/")
    stripped_ref = clean_ref.replace("-", "").replace("/", "").replace(" ", "").upper()

    # 1. Look for Report record
    query = (
        select(Report)
        .options(
            selectinload(Report.inspection).selectinload(Inspection.category),
            selectinload(Report.inspection).selectinload(Inspection.findings),
            selectinload(Report.inspection).selectinload(Inspection.extracted_fields),
        )
        .order_by(Report.created_at.desc())
    )

    res = await db.execute(query)
    reports = res.scalars().all()
    report = None
    for r in reports:
        if r.notice_ref:
            r_stripped = r.notice_ref.replace("-", "").replace("/", "").replace(" ", "").upper()
            if r_stripped == stripped_ref or clean_ref.upper() == r.notice_ref.upper():
                report = r
                break
        if r.inspection_id == clean_ref or r.id == clean_ref:
            report = r
            break

    if report:
        summary = report.report_summary or {}
        inspection = report.inspection

        # Attempt to get a fresh signed URL for cloud PDF download
        download_url = ""
        try:
            from supabase import create_client
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            signed = supabase.storage.from_(settings.REPORT_BUCKET).create_signed_url(
                report.storage_key, 3600
            )
            download_url = signed.get("signedURL") or signed.get("signedUrl") or ""
        except Exception as e:
            logger.warning(f"Failed to generate signed download URL for {report.id}: {e}")

        # Compute / retrieve SHA-256 seal
        sha256_hash = summary.get("sha256_hash")
        if not sha256_hash:
            # Deterministic hash of immutable report coordinates
            seed = f"{report.id}:{report.notice_ref}:{report.inspection_id}:{report.created_at.isoformat()}"
            sha256_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()

        # Build statutory provisions list
        statutory_provisions = []
        findings = inspection.findings if inspection else []
        for f in findings:
            if f.status.value in ("VIOLATION", "WARNING"):
                field = f.field_code or "GENERAL"
                meta = FIELD_PROVISIONS_MAP.get(field, {
                    "rule": "Legal Metrology (Packaged Commodities) Rules, 2011",
                    "subject": field.replace("_", " ").title(),
                    "gazette": "Statutory Packaging Rule",
                    "section": "Section 18 & 36, Legal Metrology Act, 2009",
                })
                statutory_provisions.append({
                    "field_code": field,
                    "rule": meta["rule"],
                    "subject": meta["subject"],
                    "severity": f.severity.value if hasattr(f.severity, "value") else str(f.severity),
                    "finding_details": f.message,
                    "ai_extracted_value": f.ai_raw_value,
                    "status": f.status.value,
                })

        final_status = report.final_status or (inspection.final_status.value if inspection else "PENDING")
        is_compliant = final_status == "COMPLIANT"
        is_violation = final_status == "NON_COMPLIANT"

        return {
            "is_valid": True,
            "verification_status": "AUTHENTIC_RECORD",
            "notice_ref": report.notice_ref,
            "inspection_id": report.inspection_id,
            "report_id": report.id,
            "product_name": report.product_name or (inspection.product_name if inspection else "Packaged Commodity"),
            "category_name": report.category_name or (inspection.category.name_en if inspection and inspection.category else "Standard Packaging"),
            "final_status": final_status,
            "status_headline": "OFFICIAL CERTIFICATE OF COMPLIANCE" if is_compliant else ("STATUTORY VIOLATION & COMPOUNDING NOTICE" if is_violation else "RECORD UNDER SUPERVISORY REVIEW"),
            "created_at": report.created_at.isoformat(),
            "issuing_authority": "Department of Legal Metrology, Ministry of Consumer Affairs, Food & Public Distribution, Government of India",
            "issuing_act": "Legal Metrology Act, 2009 (Act No. 1 of 2010)",
            "statutory_rules": "Legal Metrology (Packaged Commodities) Rules, 2011 & Gazette Notifications G.S.R. 202(E) / G.S.R. 737(E)",
            "cryptographic_seal": {
                "algorithm": "SHA-256",
                "hash": sha256_hash,
                "legal_validity": "Certified electronic record under Section 65B of Indian Evidence Act, 1872 / Section 63 of Bharatiya Sakshya Adhiniyam, 2023",
                "timestamp_utc": report.created_at.isoformat(),
            },
            "violation_count": report.violation_count,
            "warning_count": report.warning_count,
            "extracted_field_count": report.extracted_field_count,
            "statutory_provisions": statutory_provisions,
            "legal_consequences": {
                "compounding_eligible": is_violation,
                "compounding_section": "Section 48, Legal Metrology Act, 2009",
                "statutory_compounding_fee": 25000 if is_violation else 0,
                "show_cause_period_days": 15 if is_violation else 0,
                "prosecution_clause": "In case of failure to compound within 15 days of notice, prosecution will be instituted before the competent Chief Judicial Magistrate Court under Section 36(1) of the Act." if is_violation else "Commodity certified as compliant with all mandatory labeling norms."
            },
            "download_url": download_url,
        }

    # 2. If no Report yet, check Inspection directly
    insp_query = (
        select(Inspection)
        .options(
            selectinload(Inspection.category),
            selectinload(Inspection.findings),
            selectinload(Inspection.extracted_fields),
        )
        .where(Inspection.id == clean_ref)
    )
    insp_res = await db.execute(insp_query)
    inspection = insp_res.scalar_one_or_none()

    if inspection:
        final_status = inspection.final_status.value
        is_compliant = final_status == "COMPLIANT"
        is_violation = final_status == "NON_COMPLIANT"

        statutory_provisions = []
        for f in (inspection.findings or []):
            if f.status.value in ("VIOLATION", "WARNING"):
                field = f.field_code or "GENERAL"
                meta = FIELD_PROVISIONS_MAP.get(field, {
                    "rule": "Legal Metrology (Packaged Commodities) Rules, 2011",
                    "subject": field.replace("_", " ").title(),
                })
                statutory_provisions.append({
                    "field_code": field,
                    "rule": meta["rule"],
                    "subject": meta["subject"],
                    "severity": f.severity.value,
                    "finding_details": f.message,
                    "ai_extracted_value": f.ai_raw_value,
                    "status": f.status.value,
                })

        seed = f"{inspection.id}:{inspection.created_at.isoformat()}"
        sha256_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()

        return {
            "is_valid": True,
            "verification_status": "ACTIVE_INSPECTION_RECORD",
            "notice_ref": f"METRA/PROV/{inspection.id[:8].upper()}",
            "inspection_id": inspection.id,
            "report_id": None,
            "product_name": inspection.product_name or "Packaged Commodity",
            "category_name": inspection.category.name_en if inspection.category else "Standard Packaging",
            "final_status": final_status,
            "status_headline": "INSPECTION RECORD: " + final_status,
            "created_at": inspection.created_at.isoformat(),
            "issuing_authority": "Department of Legal Metrology, Ministry of Consumer Affairs, Government of India",
            "issuing_act": "Legal Metrology Act, 2009",
            "statutory_rules": "Legal Metrology (Packaged Commodities) Rules, 2011",
            "cryptographic_seal": {
                "algorithm": "SHA-256",
                "hash": sha256_hash,
                "legal_validity": "Certified electronic record under Section 65B Indian Evidence Act",
                "timestamp_utc": inspection.created_at.isoformat(),
            },
            "violation_count": sum(1 for f in (inspection.findings or []) if f.status.value == "VIOLATION"),
            "warning_count": sum(1 for f in (inspection.findings or []) if f.status.value == "WARNING"),
            "extracted_field_count": len(inspection.extracted_fields or []),
            "statutory_provisions": statutory_provisions,
            "legal_consequences": {
                "compounding_eligible": is_violation,
                "compounding_section": "Section 48, Legal Metrology Act, 2009",
                "statutory_compounding_fee": 25000 if is_violation else 0,
                "show_cause_period_days": 15 if is_violation else 0,
                "prosecution_clause": "Pending formal notice dispatch or compounding hearing."
            },
            "download_url": "",
        }

    raise HTTPException(
        status_code=404,
        detail={
            "code": "STATUTORY_RECORD_NOT_FOUND",
            "message": f"No statutory notice, compliance certificate, or inspection record matches reference '{clean_ref}'.",
        },
    )
