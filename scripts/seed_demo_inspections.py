"""
METRA Realistic Demo Inspections Seed Script
===========================================
Populates the database with 3 full statutory inspection records:
1. Case 1: Haldiram's Bhujia (500g) — NON_COMPLIANT (Statutory USP violation + official notice)
2. Case 2: Amul Taaza Toned Milk (1L) — COMPLIANT (Certified compliant + official certificate)
3. Case 3: Mamaearth Onion Shampoo (250ml) — REVIEW_REQUIRED (Smudged batch/date -> Active Officer Review Task)

Run: python scripts/seed_demo_inspections.py
"""
import asyncio
import json
import uuid
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add services/api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "api"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.models import (
    Inspection, InspectionImage, ExtractedField, Finding, EvidenceRegion,
    ReviewTask, Report, Category, RulePack, User,
    InspectionMode, InspectionStatus, FinalStatus, FindingStatus, Severity,
    ImageViewType, QualityStatus, ReportDownload
)
from sqlalchemy import select


async def seed_inspections():
    print("🚀 Seeding realistic statutory inspections into METRA...")

    async with AsyncSessionLocal() as db:
        # 1. Fetch reference users & categories
        user_res = await db.execute(select(User))
        users = user_res.scalars().all()
        if not users:
            print("❌ No users found! Run `python scripts/seed.py` first.")
            return
        user_map = {u.email: u for u in users}
        inspector = user_map.get("inspector@metra.demo") or users[0]

        cat_res = await db.execute(select(Category))
        categories = {c.code: c for c in cat_res.scalars().all()}
        food_cat = categories.get("packaged_food")
        cosmetics_cat = categories.get("personal_care") or food_cat

        rp_res = await db.execute(select(RulePack))
        rule_packs = rp_res.scalars().all()
        food_rp = rule_packs[0] if rule_packs else None

        # Check if already seeded
        existing_check = await db.execute(select(Inspection).where(Inspection.product_name.like("%Haldiram%")))
        if existing_check.scalar_one_or_none():
            print("ℹ️ Demo inspections already exist. Skipping seed.")
            return

        now = datetime.now(timezone.utc)

        # ──────────────────────────────────────────────────────────
        # CASE 1: Non-Compliant Snack Package (Missing USP)
        # ──────────────────────────────────────────────────────────
        print("📦 Creating Case 1: Haldiram's Bhujia (Non-Compliant — Missing USP)...")
        insp1_id = str(uuid.uuid4())
        insp1 = Inspection(
            id=insp1_id,
            user_id=inspector.id,
            category_id=food_cat.id,
            rule_pack_id=food_rp.id if food_rp else None,
            mode=InspectionMode.INSPECTION,
            status=InspectionStatus.FINALIZED,
            final_status=FinalStatus.NON_COMPLIANT,
            product_name="Haldiram's Nagpur Bhujia (500g)",
            product_notes="[Determination by Officer inspector@metra.demo on 2026-09-18 14:30 UTC]: Violation notice issued under Rule 6(11) of PCR 2011 (Amendment Rules 2022). Unit Sale Price (USP) absent on secondary display panel. Notice issued under Section 36.",
            source_info="Market Surveillance - Modern Trade Retail Store, New Delhi",
            is_imported=False,
            finalized_at=now - timedelta(days=2),
            created_at=now - timedelta(days=2, hours=3),
        )
        db.add(insp1)

        img1_id = str(uuid.uuid4())
        img1 = InspectionImage(
            id=img1_id,
            inspection_id=insp1_id,
            storage_key="inspections/demo_haldirams_front.jpg",
            file_name="haldirams_bhujia_500g_front.jpg",
            mime_type="image/jpeg",
            file_size_bytes=425000,
            view_type=ImageViewType.FRONT,
            quality_status=QualityStatus.PASS,
            quality_checks={"resolution": "PASS", "lighting": "PASS", "sharpness": "PASS"},
            width_px=1600,
            height_px=1200,
            created_at=now - timedelta(days=2, hours=3),
        )
        db.add(img1)

        # Fields for Case 1
        fields_case1 = [
            ("product_name", "Haldiram's Nagpur Bhujia Sev", "Haldiram's Nagpur Bhujia", 0.97, {"bbox": {"x": 20.0, "y": 12.0, "width": 60.0, "height": 18.0}}),
            ("net_quantity", "500 g", "500g", 0.95, {"bbox": {"x": 15.0, "y": 72.0, "width": 25.0, "height": 10.0}}),
            ("mrp", "MRP Rs. 145.00 (Incl. of all taxes)", "145.00", 0.93, {"bbox": {"x": 55.0, "y": 70.0, "width": 35.0, "height": 12.0}}),
            ("manufacturer", "Haldiram Foods International Pvt. Ltd., 145/146 Old Pardi Naka, Nagpur - 440035, Maharashtra", "Haldiram Foods Intl", 0.89, {"bbox": {"x": 10.0, "y": 38.0, "width": 80.0, "height": 24.0}}),
            ("date_info", "PKD 02/2026 BEST BEFORE 6 MONTHS", "2026-02", 0.91, {"bbox": {"x": 55.0, "y": 85.0, "width": 35.0, "height": 8.0}}),
            ("consumer_care", "customercare@haldirams.com | 1800-209-4444", "customercare@haldirams.com", 0.86, None),
        ]
        for fcode, raw, norm, conf, pdata in fields_case1:
            ef = ExtractedField(
                id=str(uuid.uuid4()),
                inspection_id=insp1_id,
                source_image_id=img1_id,
                field_code=fcode,
                raw_value=raw,
                normalized_value=norm,
                confidence=conf,
                parsed_data=pdata,
                created_at=now - timedelta(days=2, hours=2),
            )
            db.add(ef)

        # Findings for Case 1
        f1_viol = Finding(
            id=str(uuid.uuid4()),
            inspection_id=insp1_id,
            status=FindingStatus.VIOLATION,
            severity=Severity.HIGH,
            message="Unit Sale Price (USP) declaration is missing. Mandatory under LMPC Amendment Rules 2022 (G.S.R. 737(E)) for packaged commodities exceeding 100g.",
            field_code="unit_sale_price",
            ai_raw_value=None,
            created_at=now - timedelta(days=2, hours=2),
        )
        db.add(f1_viol)

        f1_pass1 = Finding(
            id=str(uuid.uuid4()),
            inspection_id=insp1_id,
            status=FindingStatus.PASS,
            severity=Severity.LOW,
            message="Common or generic commodity name clearly declared under Rule 6(1)(a).",
            field_code="product_name",
            ai_raw_value="Haldiram's Nagpur Bhujia Sev",
            created_at=now - timedelta(days=2, hours=2),
        )
        db.add(f1_pass1)

        f1_pass2 = Finding(
            id=str(uuid.uuid4()),
            inspection_id=insp1_id,
            status=FindingStatus.PASS,
            severity=Severity.LOW,
            message="Net quantity follows standard SI metric unit (g) under Rule 6(1)(b).",
            field_code="net_quantity",
            ai_raw_value="500 g",
            created_at=now - timedelta(days=2, hours=2),
        )
        db.add(f1_pass2)

        # Evidence region for net quantity
        ev1 = EvidenceRegion(
            id=str(uuid.uuid4()),
            finding_id=f1_pass2.id,
            image_id=img1_id,
            x=15.0,
            y=72.0,
            width=25.0,
            height=10.0,
            source_text="500 g",
        )
        db.add(ev1)

        # Report for Case 1
        rep1 = Report(
            id=str(uuid.uuid4()),
            inspection_id=insp1_id,
            storage_key=f"reports/LMPC-2026-DL-0891.pdf",
            generated_by=inspector.id,
            file_size_bytes=142600,
            product_name="Haldiram's Nagpur Bhujia (500g)",
            category_name="Packaged Food",
            final_status="NON_COMPLIANT",
            violation_count=1,
            warning_count=0,
            extracted_field_count=6,
            download_count=3,
            notice_ref="LMPC/2026/DL-0891",
            report_summary={
                "notice_ref": "LMPC/2026/DL-0891",
                "final_status": "NON_COMPLIANT",
                "violation_count": 1,
                "warning_count": 0,
                "declarations_detected": 6,
                "primary_violation": "Missing Unit Sale Price (USP) under Rule 6(11)",
            },
            created_at=now - timedelta(days=2),
        )
        db.add(rep1)

        # ──────────────────────────────────────────────────────────
        # CASE 2: Compliant Dairy Product (Certified Compliant)
        # ──────────────────────────────────────────────────────────
        print("🥛 Creating Case 2: Amul Taaza Toned Milk (100% Compliant)...")
        insp2_id = str(uuid.uuid4())
        insp2 = Inspection(
            id=insp2_id,
            user_id=inspector.id,
            category_id=food_cat.id,
            rule_pack_id=food_rp.id if food_rp else None,
            mode=InspectionMode.INSPECTION,
            status=InspectionStatus.FINALIZED,
            final_status=FinalStatus.COMPLIANT,
            product_name="Amul Taaza Homogenised Toned Milk (1 Litre)",
            product_notes="[Determination by Officer inspector@metra.demo on 2026-09-19 10:15 UTC]: Officially certified compliant with all mandatory declarations under Legal Metrology (Packaged Commodities) Rules, 2011 Schedule II. Statutory certificate issued under Section 15.",
            source_info="Routine Port/Warehouse Compliance Check, Ahmedabad Distribution Hub",
            is_imported=False,
            finalized_at=now - timedelta(days=1),
            created_at=now - timedelta(days=1, hours=2),
        )
        db.add(insp2)

        img2_id = str(uuid.uuid4())
        img2 = InspectionImage(
            id=img2_id,
            inspection_id=insp2_id,
            storage_key="inspections/demo_amul_taaza_front.jpg",
            file_name="amul_taaza_1L_carton.jpg",
            mime_type="image/jpeg",
            file_size_bytes=385000,
            view_type=ImageViewType.FRONT,
            quality_status=QualityStatus.PASS,
            quality_checks={"resolution": "PASS", "lighting": "PASS", "sharpness": "PASS"},
            width_px=1400,
            height_px=1100,
            created_at=now - timedelta(days=1, hours=2),
        )
        db.add(img2)

        # Fields for Case 2
        fields_case2 = [
            ("product_name", "Amul Taaza Homogenised Toned Milk", "Amul Taaza Milk", 0.98, {"bbox": {"x": 22.0, "y": 14.0, "width": 56.0, "height": 16.0}}),
            ("net_quantity", "1000 ml (1 L)", "1L", 0.96, {"bbox": {"x": 20.0, "y": 62.0, "width": 28.0, "height": 9.0}}),
            ("mrp", "MRP Rs. 54.00 (incl. of all taxes)", "54.00", 0.96, {"bbox": {"x": 55.0, "y": 62.0, "width": 35.0, "height": 11.0}}),
            ("unit_sale_price", "Rs. 0.054 / ml (Rs. 54.00 / L)", "54.00/L", 0.93, {"bbox": {"x": 55.0, "y": 74.0, "width": 35.0, "height": 9.0}}),
            ("manufacturer", "Gujarat Co-operative Milk Marketing Federation Ltd., Anand - 388001, Gujarat, India", "GCMMF Anand", 0.94, {"bbox": {"x": 12.0, "y": 36.0, "width": 76.0, "height": 22.0}}),
            ("date_info", "PKD: 15/09/2026 USE BY: 14/03/2027", "2026-09-15", 0.92, {"bbox": {"x": 20.0, "y": 86.0, "width": 60.0, "height": 8.0}}),
            ("consumer_care", "feedback@amul.coop | Toll Free 1800-258-3333", "feedback@amul.coop", 0.90, None),
        ]
        for fcode, raw, norm, conf, pdata in fields_case2:
            ef = ExtractedField(
                id=str(uuid.uuid4()),
                inspection_id=insp2_id,
                source_image_id=img2_id,
                field_code=fcode,
                raw_value=raw,
                normalized_value=norm,
                confidence=conf,
                parsed_data=pdata,
                created_at=now - timedelta(days=1, hours=1),
            )
            db.add(ef)

        # Findings for Case 2
        f2_pass1 = Finding(
            id=str(uuid.uuid4()),
            inspection_id=insp2_id,
            status=FindingStatus.PASS,
            severity=Severity.LOW,
            message="All mandatory declarations under Rule 6(1)(a)-(f) and Rule 6(11) verified compliant.",
            field_code="mrp",
            ai_raw_value="MRP Rs. 54.00 (incl. of all taxes)",
            created_at=now - timedelta(days=1, hours=1),
        )
        db.add(f2_pass1)

        ev2 = EvidenceRegion(
            id=str(uuid.uuid4()),
            finding_id=f2_pass1.id,
            image_id=img2_id,
            x=55.0,
            y=62.0,
            width=35.0,
            height=11.0,
            source_text="MRP Rs. 54.00 (incl. of all taxes)",
        )
        db.add(ev2)

        # Report for Case 2
        rep2 = Report(
            id=str(uuid.uuid4()),
            inspection_id=insp2_id,
            storage_key="reports/LMPC-CERT-2026-0412.pdf",
            generated_by=inspector.id,
            file_size_bytes=138400,
            product_name="Amul Taaza Homogenised Toned Milk (1 Litre)",
            category_name="Packaged Food",
            final_status="COMPLIANT",
            violation_count=0,
            warning_count=0,
            extracted_field_count=7,
            download_count=1,
            notice_ref="LMPC/CERT/2026/0412",
            report_summary={
                "notice_ref": "LMPC/CERT/2026/0412",
                "final_status": "COMPLIANT",
                "violation_count": 0,
                "warning_count": 0,
                "declarations_detected": 7,
                "summary": "100% compliant with statutory declarations under Legal Metrology Act, 2009",
            },
            created_at=now - timedelta(days=1),
        )
        db.add(rep2)

        # ──────────────────────────────────────────────────────────
        # CASE 3: Review Required Cosmetics Package (Active Review Task)
        # ──────────────────────────────────────────────────────────
        print("🧴 Creating Case 3: Mamaearth Onion Shampoo (Review Required — Smudged Date)...")
        insp3_id = str(uuid.uuid4())
        insp3 = Inspection(
            id=insp3_id,
            user_id=inspector.id,
            category_id=cosmetics_cat.id,
            rule_pack_id=food_rp.id if food_rp else None,
            mode=InspectionMode.INSPECTION,
            status=InspectionStatus.REVIEW_REQUIRED,
            final_status=FinalStatus.REVIEW_REQUIRED,
            product_name="Mamaearth Onion Hair Fall Control Shampoo (250ml)",
            product_notes="Pending officer verification: manufacturing date code smudged on curved bottle heel.",
            source_info="E-Commerce Warehouse Audit, Bhiwandi Fulfillment Hub",
            is_imported=False,
            created_at=now - timedelta(hours=4),
        )
        db.add(insp3)

        img3_id = str(uuid.uuid4())
        img3 = InspectionImage(
            id=img3_id,
            inspection_id=insp3_id,
            storage_key="inspections/demo_mamaearth_shampoo.jpg",
            file_name="mamaearth_onion_shampoo_250ml.jpg",
            mime_type="image/jpeg",
            file_size_bytes=512000,
            view_type=ImageViewType.BACK,
            quality_status=QualityStatus.PASS,
            quality_checks={"resolution": "PASS", "lighting": "PASS", "sharpness": "WARN"},
            width_px=1500,
            height_px=1250,
            created_at=now - timedelta(hours=4),
        )
        db.add(img3)

        # Fields for Case 3
        fields_case3 = [
            ("product_name", "Mamaearth Onion Hair Fall Control Shampoo", "Mamaearth Shampoo", 0.94, {"bbox": {"x": 20.0, "y": 14.0, "width": 60.0, "height": 16.0}}),
            ("net_quantity", "250 ml", "250ml", 0.91, {"bbox": {"x": 35.0, "y": 68.0, "width": 30.0, "height": 10.0}}),
            ("mrp", "MRP Rs. 349.00 (Incl. of all taxes)", "349.00", 0.92, {"bbox": {"x": 30.0, "y": 80.0, "width": 40.0, "height": 10.0}}),
            ("manufacturer", "Honasa Consumer Limited, Plot No. 63, Sector 44, Gurugram, Haryana - 122003", "Honasa Consumer", 0.85, {"bbox": {"x": 15.0, "y": 38.0, "width": 70.0, "height": 24.0}}),
            ("date_info", "B.No. ME-9? / Mfd. 0?/202? (partial)", None, 0.52, {"bbox": {"x": 20.0, "y": 92.0, "width": 60.0, "height": 6.0}}),
        ]
        for fcode, raw, norm, conf, pdata in fields_case3:
            ef = ExtractedField(
                id=str(uuid.uuid4()),
                inspection_id=insp3_id,
                source_image_id=img3_id,
                field_code=fcode,
                raw_value=raw,
                normalized_value=norm,
                confidence=conf,
                parsed_data=pdata,
                created_at=now - timedelta(hours=3),
            )
            db.add(ef)

        # Finding with low confidence
        f3_review = Finding(
            id=str(uuid.uuid4()),
            inspection_id=insp3_id,
            status=FindingStatus.REVIEW_REQUIRED,
            severity=Severity.MEDIUM,
            message="Field 'date_info' extracted with low confidence (52%). Text partially obscured or smudged. Human officer verification required under Section 15.",
            field_code="date_info",
            ai_raw_value="B.No. ME-9? / Mfd. 0?/202? (partial)",
            created_at=now - timedelta(hours=3),
        )
        db.add(f3_review)

        # Active ReviewTask in review_tasks table!
        rt3 = ReviewTask(
            id=str(uuid.uuid4()),
            finding_id=f3_review.id,
            reviewer_id=None,  # Unassigned, waiting in queue
            decision=None,
            created_at=now - timedelta(hours=3),
        )
        db.add(rt3)

        await db.commit()

    print("✅ All 3 statutory demo inspections seeded successfully!")
    print("\nSummary of Seeded Records:")
    print("  1. Haldiram's Bhujia (500g)   → Status: FINALIZED [NON_COMPLIANT] (Missing USP)")
    print("  2. Amul Toned Milk (1L)       → Status: FINALIZED [COMPLIANT] (Certified)")
    print("  3. Mamaearth Shampoo (250ml)  → Status: REVIEW_REQUIRED (Active Review Task in Queue)")


if __name__ == "__main__":
    asyncio.run(seed_inspections())
