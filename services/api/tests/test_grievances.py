"""
Unit & integration tests for Citizen Whistleblower & Grievance Portal.
Under Legal Metrology Act, 2009 & PCR, 2011.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_submit_grievance_public(async_client: AsyncClient):
    """Citizens can lodge violation reports anonymously or with contact details."""
    response = await async_client.post(
        "/api/v1/grievances",
        data={
            "violation_type": "OVERCHARGING_MRP",
            "product_name": "Premium Cold-Pressed Mustard Oil 1L",
            "store_name": "QuickMart Superstore",
            "store_location": "Connaught Place, New Delhi",
            "description": "Retailer charged ₹250 whereas printed MRP on label is ₹210.",
            "citizen_name": "Aakash Verma",
            "citizen_contact": "+91 98765 43210",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["ticket_no"].startswith("METRA-GRV-2026-")
    assert data["status"] == "RECEIVED"
    assert "tracking_url" in data


@pytest.mark.asyncio
async def test_track_grievance_public(async_client: AsyncClient):
    """Citizens can track status using their statutory ticket number."""
    # First create a grievance
    create_res = await async_client.post(
        "/api/v1/grievances",
        data={
            "violation_type": "MISSING_MANDATORY_DECLARATIONS",
            "product_name": "Imported Almond Cookies 250g",
            "store_name": "Metro Daily Mart",
            "description": "No Country of Origin or Consumer Care details printed on outer carton.",
        },
    )
    assert create_res.status_code == 201
    ticket_no = create_res.json()["ticket_no"]

    # Now track it
    track_res = await async_client.get(f"/api/v1/grievances/{ticket_no}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["grievance"]["ticket_no"] == ticket_no
    assert track_data["grievance"]["status"] == "RECEIVED"
    assert len(track_data["timeline"]) == 3
    assert track_data["timeline"][0]["completed"] is True


@pytest.mark.asyncio
async def test_officer_list_and_convert_grievance(async_client: AsyncClient, auth_headers: dict):
    """Authorized officers can list grievances and convert a lead to a formal inspection."""
    # Create a fresh grievance
    create_res = await async_client.post(
        "/api/v1/grievances",
        data={
            "violation_type": "DUAL_MRP",
            "product_name": "Packaged Drinking Water 1L",
            "store_name": "Airport Transit Lounge Cafe",
            "description": "Sold at ₹50 citing airport surcharge, whereas standard MRP is ₹20.",
        },
    )
    assert create_res.status_code == 201
    ticket_no = create_res.json()["ticket_no"]

    # Officer lists grievances
    list_res = await async_client.get("/api/v1/grievances", headers=auth_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert "items" in list_data
    target = next((item for item in list_data["items"] if item["ticket_no"] == ticket_no), None)
    assert target is not None
    grievance_id = target["id"]

    # Officer converts grievance into a formal inspection
    convert_res = await async_client.post(
        f"/api/v1/grievances/{grievance_id}/convert",
        headers=auth_headers,
    )
    assert convert_res.status_code == 201
    convert_data = convert_res.json()
    assert convert_data["success"] is True
    assert convert_data["status"] == "UNDER_FIELD_INSPECTION"
    inspection_id = convert_data["inspection_id"]
    assert inspection_id is not None

    # Verify grievance status is updated
    track_res = await async_client.get(f"/api/v1/grievances/{ticket_no}")
    assert track_res.status_code == 200
    assert track_res.json()["grievance"]["status"] == "UNDER_FIELD_INSPECTION"
    assert track_res.json()["timeline"][1]["completed"] is True

    # Officer updates status to resolved
    patch_res = await async_client.patch(
        f"/api/v1/grievances/{grievance_id}",
        json={
            "status": "RESOLVED_WITH_PENALTY",
            "resolution_notes": "Spot inspection verified dual MRP violation. Compounded under Section 48 for ₹25,000.",
        },
        headers=auth_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["grievance"]["status"] == "RESOLVED_WITH_PENALTY"
