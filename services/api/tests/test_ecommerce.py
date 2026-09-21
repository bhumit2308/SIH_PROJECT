import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ecommerce_audit_with_violations(async_client: AsyncClient, auth_headers: dict):
    """Test e-commerce listing audit flagging missing USP and Expiry Date."""
    payload = {
        "platform": "ZEPTO",
        "product_url": "https://zeptonow.com/pn/salted-cashews/pvid/99001",
        "product_name": "Zepto Daily Salted Cashews (200g)",
        "declared_mrp": "₹220 (Inclusive of all taxes)",
        "declared_usp": None,  # Omission: Rule 6(11) violation
        "declared_net_qty": "200 g",
        "declared_origin": "India",
        "declared_expiry": None,  # Omission: Rule 6(10) violation
        "declared_manufacturer": "NutriFoods India Ltd, Pune MH",
        "declared_consumer_care": "care@nutrifoods.in",
        "notes": "Audited from Zepto dark store Baner Hub, Pune",
    }
    res = await async_client.post("/api/v1/inspections/ecommerce-audit", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["final_status"] == "NON_COMPLIANT"
    assert data["violations_count"] == 2
    assert data["compounding_eligible"] is True
    assert data["statutory_compounding_fee"] == 25000
    assert data["notice_ref"].startswith("LMPC/ECOM/")
    assert data["verification_url"].startswith("/verify/LMPC/ECOM/")

    # Verify that the generated notice can be immediately verified publicly
    ver_res = await async_client.get(f"/api/v1{data['verification_url']}")
    assert ver_res.status_code == 200
    ver_data = ver_res.json()
    assert ver_data["is_valid"] is True
    assert ver_data["final_status"] == "NON_COMPLIANT"
    assert len(ver_data["statutory_provisions"]) >= 2


@pytest.mark.asyncio
async def test_ecommerce_audit_fully_compliant(async_client: AsyncClient, auth_headers: dict):
    """Test e-commerce listing audit where all mandatory Rule 6(10) declarations are provided."""
    payload = {
        "platform": "INSTAMART",
        "product_url": "https://swiggy.com/instamart/item/tata-salt/123",
        "product_name": "Tata Salt Vacuum Evaporated (1kg)",
        "declared_mrp": "₹28 (Inclusive of all taxes)",
        "declared_usp": "₹0.028 per g",
        "declared_net_qty": "1 kg",
        "declared_origin": "India",
        "declared_expiry": "12/2027",
        "declared_manufacturer": "Tata Consumer Products Ltd, Mumbai",
        "declared_consumer_care": "care@tataconsumer.com / 1800-208-208",
        "notes": "Compliant test SKU",
    }
    res = await async_client.post("/api/v1/inspections/ecommerce-audit", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["final_status"] == "COMPLIANT"
    assert data["violations_count"] == 0
    assert data["compounding_eligible"] is False
    assert data["statutory_compounding_fee"] == 0


@pytest.mark.asyncio
async def test_ecommerce_audit_unauthenticated(async_client: AsyncClient):
    """Test that e-commerce audit requires officer authentication."""
    payload = {
        "platform": "BLINKIT",
        "product_url": "https://blinkit.com/prn/test",
        "product_name": "Test Product",
    }
    res = await async_client.post("/api/v1/inspections/ecommerce-audit", json=payload)
    assert res.status_code in (401, 403)
