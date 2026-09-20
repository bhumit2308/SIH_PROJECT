"""
METRA – National Regulatory Analytics & Command Center Router
Provides aggregate statutory statistics, Section 48 compounding pipeline metrics,
rule violation frequency distributions, and ministerial audit CSV exports.

GET /api/v1/analytics/overview
GET /api/v1/analytics/export-csv
"""
import io
import csv
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.models import (
    Inspection, Finding, Report, Category,
    InspectionStatus, FinalStatus, FindingStatus, User
)
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

STATUTORY_RULE_NAMES = {
    "UNIT_SALE_PRICE":   "Rule 6(11) – Unit Sale Price (USP)",
    "MRP":               "Rule 6(1)(d) – MRP & Tax Inclusivity",
    "NET_QUANTITY":      "Rule 6(1)(e) – Net Quantity & Units",
    "EXPIRY_DATE":       "Rule 6(10) – Best Before / Expiry",
    "MFG_DATE":          "Rule 6(1)(c) – Month / Year of Packing",
    "MANUFACTURER_NAME": "Rule 6(1)(a) – Manufacturer / Packer",
    "CONSUMER_CARE":     "Rule 6(1)(f) – Consumer Care Contact",
    "COUNTRY_OF_ORIGIN": "Rule 6(1)(e) – Country of Origin",
}


@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns real-time aggregated metrics across the inspection database.
    """
    # 1. Total Inspections & status counts
    status_q = await db.execute(
        select(Inspection.final_status, func.count(Inspection.id))
        .group_by(Inspection.final_status)
    )
    status_counts = {str(row[0].value if hasattr(row[0], 'value') else row[0]): row[1] for row in status_q.all()}

    total_inspections = sum(status_counts.values())
    compliant_count = status_counts.get("COMPLIANT", 0)
    non_compliant_count = status_counts.get("NON_COMPLIANT", 0)
    review_required_count = status_counts.get("REVIEW_REQUIRED", 0)
    pending_count = status_counts.get("PENDING", 0)

    # Decided inspections (excluding pending / un-analyzed drafts)
    decided_total = compliant_count + non_compliant_count
    compliance_rate = round((compliant_count / decided_total * 100), 1) if decided_total > 0 else 100.0

    # Section 48 Compounding Penalty Potential (₹25,000 statutory compound per non-compliant inspection)
    compounding_pipeline_inr = non_compliant_count * 25000

    # 2. Rule Violations Breakdown
    finding_q = await db.execute(
        select(Finding.field_code, func.count(Finding.id))
        .where(Finding.status == FindingStatus.VIOLATION)
        .group_by(Finding.field_code)
        .order_by(desc(func.count(Finding.id)))
    )
    rule_breakdown = []
    for row in finding_q.all():
        field = row[0] or "OTHER"
        rule_breakdown.append({
            "field_code": field,
            "rule_name": STATUTORY_RULE_NAMES.get(field, f"General Declaration ({field})"),
            "count": row[1],
        })

    # If no recorded violations, provide common statutory baseline categories
    if not rule_breakdown:
        rule_breakdown = [
            {"field_code": "UNIT_SALE_PRICE", "rule_name": "Rule 6(11) – Unit Sale Price (USP)", "count": 0},
            {"field_code": "MRP", "rule_name": "Rule 6(1)(d) – MRP & Tax Inclusivity", "count": 0},
            {"field_code": "EXPIRY_DATE", "rule_name": "Rule 6(10) – Best Before / Expiry", "count": 0},
            {"field_code": "NET_QUANTITY", "rule_name": "Rule 6(1)(e) – Net Quantity & Units", "count": 0},
        ]

    # 3. Mode distribution
    mode_q = await db.execute(
        select(Inspection.mode, func.count(Inspection.id))
        .group_by(Inspection.mode)
    )
    mode_breakdown = {str(row[0].value if hasattr(row[0], 'value') else row[0]): row[1] for row in mode_q.all()}

    # 4. Reports & Notices metrics
    rep_q = await db.execute(
        select(
            func.count(Report.id),
            func.coalesce(func.sum(Report.download_count), 0)
        )
    )
    rep_row = rep_q.one()
    reports_issued = rep_row[0] or 0
    total_downloads = rep_row[1] or 0

    # 5. Recent statutory activity
    recent_q = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.category))
        .order_by(Inspection.created_at.desc())
        .limit(6)
    )
    recent_inspections = [
        {
            "id": i.id,
            "product_name": i.product_name or "Packaged Commodity",
            "category": i.category.name_en if i.category else "Standard Packaging",
            "mode": i.mode.value if hasattr(i.mode, 'value') else str(i.mode),
            "final_status": i.final_status.value if hasattr(i.final_status, 'value') else str(i.final_status),
            "created_at": i.created_at.isoformat(),
        }
        for i in recent_q.scalars().all()
    ]

    return {
        "kpis": {
            "total_inspections": total_inspections,
            "compliance_rate": compliance_rate,
            "compliant_count": compliant_count,
            "violations_count": non_compliant_count,
            "review_required_count": review_required_count,
            "pending_count": pending_count,
            "compounding_pipeline_inr": compounding_pipeline_inr,
            "reports_issued": reports_issued,
            "total_downloads": total_downloads,
        },
        "rule_violations": rule_breakdown,
        "mode_distribution": {
            "physical_retail": mode_breakdown.get("INSPECTION", 0),
            "ecommerce_audit": mode_breakdown.get("ECOMMERCE_AUDIT", 0),
            "pre_screening": mode_breakdown.get("PRE_SCREENING", 0),
        },
        "recent_inspections": recent_inspections,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/export-csv")
async def export_ministerial_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Streams a full statutory compliance audit log formatted as a ministerial briefing CSV.
    """
    query = (
        select(Inspection)
        .options(
            selectinload(Inspection.category),
            selectinload(Inspection.findings),
            selectinload(Inspection.reports),
        )
        .order_by(Inspection.created_at.desc())
    )
    res = await db.execute(query)
    inspections = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Inspection ID",
        "Date (UTC)",
        "Product Name",
        "Category",
        "Inspection Mode",
        "Determination Status",
        "Violations Count",
        "Warning Count",
        "Infringed Statutory Rules",
        "Notice Reference",
        "Section 48 Compounding Eligible",
        "Statutory Fee (INR)",
    ])

    for i in inspections:
        violations = [f.field_code for f in (i.findings or []) if f.status.value == "VIOLATION"]
        warnings = [f.field_code for f in (i.findings or []) if f.status.value == "WARNING"]
        latest_report = i.reports[0] if i.reports else None
        notice_ref = latest_report.notice_ref if latest_report else "—"
        is_viol = i.final_status.value == "NON_COMPLIANT"

        writer.writerow([
            i.id,
            i.created_at.strftime("%Y-%m-%d %H:%M:%S") if i.created_at else "",
            i.product_name or "Packaged Commodity",
            i.category.name_en if i.category else "Standard Packaging",
            i.mode.value if hasattr(i.mode, 'value') else str(i.mode),
            i.final_status.value if hasattr(i.final_status, 'value') else str(i.final_status),
            len(violations),
            len(warnings),
            "; ".join(violations) if violations else "NONE",
            notice_ref,
            "YES" if is_viol else "NO",
            "25000" if is_viol else "0",
        ])

    csv_data = output.getvalue()
    filename = f"METRA_Regulatory_Audit_Report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
