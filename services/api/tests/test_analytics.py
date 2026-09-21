import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_analytics_overview_authenticated(async_client: AsyncClient, auth_headers: dict):
    """Test analytics overview endpoint with officer authentication."""
    res = await async_client.get("/api/v1/analytics/overview", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    # Check KPI metrics
    assert "kpis" in data
    kpis = data["kpis"]
    assert kpis["total_inspections"] >= 1
    assert 0.0 <= kpis["compliance_rate"] <= 100.0
    assert kpis["compounding_pipeline_inr"] >= 0
    assert kpis["compliant_count"] >= 0
    assert kpis["violations_count"] >= 0

    # Check rule violations breakdown
    assert "rule_violations" in data
    assert isinstance(data["rule_violations"], list)
    if data["rule_violations"]:
        rule = data["rule_violations"][0]
        assert "field_code" in rule
        assert "rule_name" in rule
        assert "count" in rule

    # Check mode distribution
    assert "mode_distribution" in data
    assert "physical_retail" in data["mode_distribution"]
    assert "ecommerce_audit" in data["mode_distribution"]

    # Check recent inspections
    assert "recent_inspections" in data
    assert isinstance(data["recent_inspections"], list)


@pytest.mark.asyncio
async def test_analytics_overview_unauthenticated(async_client: AsyncClient):
    """Test analytics overview rejects unauthenticated requests."""
    res = await async_client.get("/api/v1/analytics/overview")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_analytics_export_ministerial_csv(async_client: AsyncClient, auth_headers: dict):
    """Test export of ministerial briefing CSV audit log."""
    res = await async_client.get("/api/v1/analytics/export-csv", headers=auth_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "attachment" in res.headers.get("content-disposition", "")
    
    content = res.text
    lines = content.strip().split("\n")
    assert len(lines) >= 1  # Header line at minimum
    header = lines[0]
    assert "Inspection ID" in header
    assert "Determination Status" in header
    assert "Section 48 Compounding Eligible" in header
    assert "Statutory Fee (INR)" in header
