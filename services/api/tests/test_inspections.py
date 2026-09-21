import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.core.models import Inspection


@pytest.mark.asyncio
async def test_list_inspections(async_client: AsyncClient, auth_headers: dict):
    """Test listing inspections returns safely serialized records."""
    res = await async_client.get("/api/v1/inspections?limit=10", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        assert "id" in first
        assert "status" in first
        assert "final_status" in first
        assert "mode" in first


@pytest.mark.asyncio
async def test_get_inspection_detail_serialization(async_client: AsyncClient, auth_headers: dict, db_session):
    """Test that inspection detail endpoint avoids cyclic RecursionError and returns full graph."""
    res = await db_session.execute(select(Inspection).limit(1))
    inspection = res.scalar_one_or_none()
    if not inspection:
        pytest.skip("No inspection available in DB")

    detail_res = await async_client.get(f"/api/v1/inspections/{inspection.id}", headers=auth_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == inspection.id
    assert "images" in detail
    assert "extracted_fields" in detail
    assert "findings" in detail
    assert "category" in detail


@pytest.mark.asyncio
async def test_finalize_inspection_determination(async_client: AsyncClient, auth_headers: dict, db_session):
    """Test finalizing an inspection with officer determination notes."""
    res = await db_session.execute(select(Inspection).limit(1))
    inspection = res.scalar_one_or_none()
    if not inspection:
        pytest.skip("No inspection available in DB")

    payload = {
        "final_status": "COMPLIANT",
        "note": "Automated verification test determination by Officer.",
    }
    fin_res = await async_client.post(
        f"/api/v1/inspections/{inspection.id}/finalize",
        json=payload,
        headers=auth_headers
    )
    assert fin_res.status_code == 200
    data = fin_res.json()
    assert data["status"] == "FINALIZED"
    assert data["final_status"] == "COMPLIANT"
    assert data["finalized_at"] is not None


@pytest.mark.asyncio
async def test_get_nonexistent_inspection(async_client: AsyncClient, auth_headers: dict):
    """Test requesting nonexistent inspection returns 404."""
    res = await async_client.get("/api/v1/inspections/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert res.status_code == 404
