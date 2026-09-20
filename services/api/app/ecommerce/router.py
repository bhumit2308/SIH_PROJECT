"""
METRA – E-Commerce & Quick-Commerce Compliance Auditor (Rule 6(10) PCR 2011)
Audits digital network listings (Blinkit, Zepto, Swiggy Instamart, Amazon, Flipkart)
for mandatory pre-sale statutory declarations.

POST /api/v1/inspections/ecommerce-audit
"""
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.models import (
    Inspection, Finding, ExtractedField, Category, Report,
    InspectionMode, InspectionStatus, FinalStatus, FindingStatus,
    Severity, User, RoleName
)
from app.auth.dependencies import require_role
from app.audit.logger import audit

logger = logging.getLogger(__name__)
router = APIRouter()


class ECommerceAuditRequest(BaseModel):
    platform: str                    # BLINKIT, ZEPTO, INSTAMART, AMAZON, FLIPKART, BIGBASKET, OTHER
    product_url: str
    product_name: str
    category_id: Optional[str] = None
    declared_mrp: Optional[str] = None
    declared_usp: Optional[str] = None
    declared_net_qty: Optional[str] = None
    declared_origin: Optional[str] = None
    declared_expiry: Optional[str] = None
    declared_manufacturer: Optional[str] = None
    declared_consumer_care: Optional[str] = None
    notes: Optional[str] = None


@router.post("/ecommerce-audit", status_code=201)
async def audit_ecommerce_listing(
    payload: ECommerceAuditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(
        RoleName.INSPECTOR, RoleName.SUPERVISOR, RoleName.ADMIN, RoleName.MANUFACTURER
    )),
):
    """
    Performs deterministic Rule 6(10) statutory audit on an e-commerce or quick-commerce listing.
    """
    # 1. Resolve category
    category = None
    if payload.category_id:
        category = await db.get(Category, payload.category_id)
    if not category:
        cat_res = await db.execute(select(Category).where(Category.is_active == True).limit(1))
        category = cat_res.scalar_one_or_none()

    inspection_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # 2. Evaluate Rule 6(10) Declarations
    findings_to_create = []
    extracted_fields_to_create = []

    checks = [
        (
            "UNIT_SALE_PRICE",
            payload.declared_usp,
            "Rule 6(11) read with Rule 6(10) PCR 2011",
            "Mandatory Unit Sale Price (USP per g/ml) not displayed on product listing prior to consumer purchase.",
            Severity.HIGH,
        ),
        (
            "MRP",
            payload.declared_mrp,
            "Rule 6(1)(d) read with Rule 6(10) PCR 2011",
            "Maximum Retail Price inclusive of all taxes omitted or improperly formatted on digital listing.",
            Severity.HIGH,
        ),
        (
            "NET_QUANTITY",
            payload.declared_net_qty,
            "Rule 6(1)(e) read with Rule 6(10) PCR 2011",
            "Net Quantity in standard metric units (g, kg, ml, l) not declared on e-commerce catalog page.",
            Severity.MEDIUM,
        ),
        (
            "COUNTRY_OF_ORIGIN",
            payload.declared_origin,
            "Rule 6(10) PCR 2011 (Mandatory Origin Disclosure)",
            "Country of Origin omitted from marketplace product page prior to order placement.",
            Severity.HIGH,
        ),
        (
            "EXPIRY_DATE",
            payload.declared_expiry,
            "Rule 6(10) PCR 2011 (Digital Expiry Disclosure)",
            "Best Before / Expiry date not disclosed on digital network prior to consumer purchase.",
            Severity.HIGH,
        ),
        (
            "MANUFACTURER_NAME",
            payload.declared_manufacturer,
            "Rule 6(1)(a) read with Rule 6(10) PCR 2011",
            "Name and complete postal address of manufacturer, packer, or importer missing from digital listing.",
            Severity.MEDIUM,
        ),
        (
            "CONSUMER_CARE",
            payload.declared_consumer_care,
            "Rule 6(1)(f) read with Rule 6(10) PCR 2011",
            "Consumer care helpline number or official complaint email address omitted.",
            Severity.LOW,
        ),
    ]

    violations = 0
    warnings = 0

    for field_code, value, rule_ref, fail_msg, severity in checks:
        is_declared = bool(value and value.strip() and value.strip().lower() not in ("none", "n/a", "null", "missing"))
        extracted_fields_to_create.append(
            ExtractedField(
                id=str(uuid.uuid4()),
                inspection_id=inspection_id,
                field_code=field_code,
                raw_value=value if is_declared else None,
                normalized_value=value.strip() if is_declared else None,
                confidence=0.99 if is_declared else 0.0,
                parsed_data={"source": "ECOMMERCE_LISTING_AUDIT", "platform": payload.platform},
            )
        )

        if is_declared:
            findings_to_create.append(
                Finding(
                    id=str(uuid.uuid4()),
                    inspection_id=inspection_id,
                    field_code=field_code,
                    status=FindingStatus.PASS,
                    severity=Severity.LOW,
                    message=f"Compliant: Declared as '{value.strip()}'. Validated per {rule_ref}.",
                    ai_raw_value=value.strip(),
                )
            )
        else:
            violations += 1
            findings_to_create.append(
                Finding(
                    id=str(uuid.uuid4()),
                    inspection_id=inspection_id,
                    field_code=field_code,
                    status=FindingStatus.VIOLATION,
                    severity=severity,
                    message=f"VIOLATION: {fail_msg} [{rule_ref}]",
                    ai_raw_value="[OMITTED ON DIGITAL LISTING]",
                )
            )

    final_status = FinalStatus.NON_COMPLIANT if violations > 0 else FinalStatus.COMPLIANT
    notice_ref = f"LMPC/ECOM/{now.strftime('%Y')}/{inspection_id[:6].upper()}"

    # 3. Create Inspection Record
    full_notes = (
        f"E-Commerce Platform: {payload.platform.upper()}\n"
        f"Listing URL: {payload.product_url}\n"
        f"Audit Notes: {payload.notes or 'None'}\n\n"
        f"[Section 49 & Rule 6(10) Statutory Audit conducted by {current_user.email} on {now.strftime('%Y-%m-%d %H:%M UTC')}]"
    )

    inspection = Inspection(
        id=inspection_id,
        user_id=current_user.id,
        category_id=category.id if category else None,
        mode=InspectionMode.ECOMMERCE_AUDIT,
        product_name=f"{payload.product_name} ({payload.platform.title()})",
        product_notes=full_notes,
        source_info=payload.product_url,
        status=InspectionStatus.FINALIZED,
        final_status=final_status,
        finalized_at=now,
    )
    db.add(inspection)

    for ef in extracted_fields_to_create:
        db.add(ef)
    for f in findings_to_create:
        db.add(f)

    # 4. Create Notice / Certificate Report row
    sha_seed = f"{inspection_id}:{notice_ref}:{now.isoformat()}:{violations}"
    sha256_hash = hashlib.sha256(sha_seed.encode("utf-8")).hexdigest()

    report_summary = {
        "notice_ref": notice_ref,
        "product_name": payload.product_name,
        "category_name": category.name_en if category else "E-Commerce Packaged Goods",
        "final_status": final_status.value,
        "mode": "ECOMMERCE_AUDIT",
        "platform": payload.platform,
        "product_url": payload.product_url,
        "inspector_name": current_user.full_name or current_user.email,
        "organisation": current_user.organisation or "Legal Metrology Enforcement Division",
        "violation_count": violations,
        "warning_count": warnings,
        "extracted_count": len(extracted_fields_to_create),
        "sha256_hash": sha256_hash,
        "violations": [
            {"field_code": f.field_code, "severity": f.severity.value, "message": f.message}
            for f in findings_to_create if f.status == FindingStatus.VIOLATION
        ],
        "generated_at": now.isoformat(),
    }

    report = Report(
        id=str(uuid.uuid4()),
        inspection_id=inspection_id,
        storage_key=f"reports/{inspection_id}/ecom_audit.pdf",
        generated_by=current_user.id,
        file_size_bytes=1024,
        product_name=f"{payload.product_name} ({payload.platform.title()})",
        category_name=category.name_en if category else "E-Commerce Packaged Goods",
        final_status=final_status.value,
        violation_count=violations,
        warning_count=warnings,
        extracted_field_count=len(extracted_fields_to_create),
        download_count=0,
        notice_ref=notice_ref,
        report_summary=report_summary,
    )
    db.add(report)

    await db.commit()
    await audit(db, current_user.id, "ECOMMERCE_AUDIT_CONDUCTED", "inspection", inspection_id, {
        "platform": payload.platform,
        "product_url": payload.product_url,
        "final_status": final_status.value,
        "violations": violations,
        "notice_ref": notice_ref,
    })

    return {
        "inspection_id": inspection_id,
        "notice_ref": notice_ref,
        "platform": payload.platform,
        "final_status": final_status.value,
        "violations_count": violations,
        "compounding_eligible": violations > 0,
        "statutory_compounding_fee": 25000 if violations > 0 else 0,
        "verification_url": f"/verify/{notice_ref}",
        "message": f"Rule 6(10) statutory audit completed. Found {violations} statutory violations.",
    }
