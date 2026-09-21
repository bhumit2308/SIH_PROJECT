"""
Integration tests for Section 48 Compounding Settlement Ledger & CJM Court Escalation.
Under Legal Metrology Act, 2009 & PCR 2011.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_compounding_settlement_flow(async_client: AsyncClient, auth_headers: dict):
    """
    Test recording a Treasury Challan settlement for a statutory violation notice under Section 48.
    """
    # 1. Create a non-compliant inspection & generate notice
    audit_res = await async_client.post(
        "/api/v1/inspections/ecommerce-audit",
        json={
            "platform": "BLINKIT",
            "product_url": "https://blinkit.com/prn/fortune-sunflower-oil/prid/7711",
            "product_name": "Fortune Refined Sunflower Oil 1L",
            "declared_mrp": "₹160",
            "declared_usp": None,  # Rule 6(11) violation
        },
        headers=auth_headers,
    )
    assert audit_res.status_code == 201
    audit_data = audit_res.json()
    notice_ref = audit_data["notice_ref"]

    # Retrieve report from reports library
    reports_res = await async_client.get("/api/v1/reports", headers=auth_headers)
    assert reports_res.status_code == 200
    reports = reports_res.json()["reports"]
    target_report = next((r for r in reports if r["notice_ref"] == notice_ref), None)
    assert target_report is not None
    report_id = target_report["id"]
    assert target_report["compounding_status"] == "SHOW_CAUSE_AWAITED"
    assert target_report["show_cause_days_remaining"] <= 15

    # 2. Record statutory compounding payment
    challan_no = "CHALLAN/BHARATKOSH/2026/DL/99412"
    compound_res = await async_client.post(
        f"/api/v1/reports/{report_id}/compound",
        json={
            "treasury_challan_no": challan_no,
            "compounded_amount": 25000.0,
            "notes": "First offence compounded under Section 48 upon receipt of e-challan.",
        },
        headers=auth_headers,
    )
    assert compound_res.status_code == 200
    comp_data = compound_res.json()
    assert comp_data["success"] is True
    assert comp_data["compounding_status"] == "COMPOUNDED"
    assert comp_data["treasury_challan_no"] == challan_no
    assert comp_data["compounding_cert_ref"].startswith("LMPC/COMP/2026/")

    # 3. Attempting duplicate compounding must return 409 Conflict
    dup_res = await async_client.post(
        f"/api/v1/reports/{report_id}/compound",
        json={"treasury_challan_no": "DUPLICATE_CHALLAN"},
        headers=auth_headers,
    )
    assert dup_res.status_code == 409

    # 4. Verify public portal reflects compounded discharge
    verify_res = await async_client.get(f"/api/v1/verify/{notice_ref}")
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["legal_consequences"]["compounding_status"] == "COMPOUNDED"
    assert v_data["legal_consequences"]["treasury_challan_no"] == challan_no
    assert "discharged under Section 48" in v_data["legal_consequences"]["prosecution_clause"]


@pytest.mark.asyncio
async def test_escalate_to_cjm_court(async_client: AsyncClient, auth_headers: dict):
    """
    Test escalating an uncompounded notice to Chief Judicial Magistrate for criminal prosecution.
    """
    # 1. Create a non-compliant audit
    audit_res = await async_client.post(
        "/api/v1/inspections/ecommerce-audit",
        json={
            "platform": "ZEPTO",
            "product_url": "https://zeptonow.com/pn/unlabeled-item/pvid/1020",
            "product_name": "Unlabeled Dry Fruits Pack 500g",
            "declared_mrp": "₹600",
            "declared_origin": None,  # Violation
        },
        headers=auth_headers,
    )
    assert audit_res.status_code == 201
    notice_ref = audit_res.json()["notice_ref"]

    # 2. Get report ID
    reports_res = await async_client.get("/api/v1/reports", headers=auth_headers)
    reports = reports_res.json()["reports"]
    report = next(r for r in reports if r["notice_ref"] == notice_ref)

    # 3. Escalate to CJM
    esc_res = await async_client.post(
        f"/api/v1/reports/{report['id']}/escalate-cjm",
        json={"court_name": "Court of Chief Judicial Magistrate, Patiala House Courts"},
        headers=auth_headers,
    )
    assert esc_res.status_code == 200
    esc_data = esc_res.json()
    assert esc_data["success"] is True
    assert esc_data["compounding_status"] == "ESCALATED_TO_CJM"

    # 4. Verify in public verification endpoint
    ver_res = await async_client.get(f"/api/v1/verify/{notice_ref}")
    assert ver_res.status_code == 200
    ver_data = ver_res.json()
    assert ver_data["legal_consequences"]["compounding_status"] == "ESCALATED_TO_CJM"
    assert "Chief Judicial Magistrate" in ver_data["legal_consequences"]["prosecution_clause"]
