import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_verify_violation_notice(async_client: AsyncClient):
    """Test public verification of a statutory violation notice."""
    res = await async_client.get("/api/v1/verify/LMPC/2026/DL-0891")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["notice_ref"] == "LMPC/2026/DL-0891"
    assert data["final_status"] == "NON_COMPLIANT"
    assert "STATUTORY VIOLATION" in data["status_headline"]
    assert data["cryptographic_seal"]["algorithm"] == "SHA-256"
    assert len(data["cryptographic_seal"]["hash"]) == 64
    assert data["legal_consequences"]["compounding_eligible"] is True
    assert data["legal_consequences"]["statutory_compounding_fee"] == 25000
    assert "Section 48" in data["legal_consequences"]["compounding_section"]
    assert len(data["statutory_provisions"]) >= 1


@pytest.mark.asyncio
async def test_verify_compliance_certificate(async_client: AsyncClient):
    """Test public verification of a valid Section 15 compliance certificate."""
    res = await async_client.get("/api/v1/verify/LMPC/CERT/2026/0412")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["final_status"] == "COMPLIANT"
    assert data["status_headline"] == "OFFICIAL CERTIFICATE OF COMPLIANCE"
    assert data["legal_consequences"]["compounding_eligible"] is False
    assert data["legal_consequences"]["statutory_compounding_fee"] == 0


@pytest.mark.asyncio
async def test_verify_dash_normalized_reference(async_client: AsyncClient):
    """Test verification reference with hyphens instead of slashes."""
    res = await async_client.get("/api/v1/verify/LMPC-2026-DL-0891")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["notice_ref"] == "LMPC/2026/DL-0891"


@pytest.mark.asyncio
async def test_verify_nonexistent_reference(async_client: AsyncClient):
    """Test verification of a fraudulent / nonexistent reference returns 404."""
    res = await async_client.get("/api/v1/verify/LMPC/FAKE/999999")
    assert res.status_code == 404
    err = res.json()
    assert err["detail"]["code"] == "STATUTORY_RECORD_NOT_FOUND"
