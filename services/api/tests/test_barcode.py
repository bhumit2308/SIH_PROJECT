import pytest
from app.rules.barcode_verifier import (
    validate_ean13_checksum,
    resolve_gs1_country,
    verify_barcode_compliance,
)


def test_valid_indian_ean13_barcode():
    """Test valid GS1 India barcode with correct Modulo-10 checksum."""
    # 890103000000X calculation:
    # 8*1 + 9*3 + 0*1 + 1*3 + 0*1 + 3*3 + 0*1 + 0*3 + 0*1 + 0*3 + 0*1 + 0*3
    # = 8 + 27 + 0 + 3 + 0 + 9 = 47. (10 - (47 % 10)) % 10 = (10 - 7) = 3.
    valid_barcode = "8901030000003"
    assert validate_ean13_checksum(valid_barcode) is True

    res = verify_barcode_compliance(valid_barcode, declared_country="India")
    assert res["is_valid_format"] is True
    assert res["is_checksum_valid"] is True
    assert res["is_gs1_india"] is True
    assert "India" in res["gs1_issuing_country"]
    assert res["origin_discrepancy"] is False


def test_tampered_checksum_barcode():
    """Test barcode with corrupt/tampered final check digit."""
    corrupt_barcode = "8901030000009"  # Check digit should be 3
    assert validate_ean13_checksum(corrupt_barcode) is False
    res = verify_barcode_compliance(corrupt_barcode)
    assert res["is_checksum_valid"] is False


def test_gs1_country_prefix_resolution():
    """Test resolution of standard GS1 member organization country codes."""
    assert "India" in resolve_gs1_country("8901234567890")
    assert "China" in resolve_gs1_country("6901234567890")
    assert "Germany" in resolve_gs1_country("4001234567890")
    assert "United States" in resolve_gs1_country("0011234567890")
    assert "Japan" in resolve_gs1_country("4901234567890")


def test_country_of_origin_discrepancy_flag():
    """Test statutory violation emitted when packaging claims India but barcode is foreign."""
    # Barcode prefix 690 (China) on package declaring 'India'
    res = verify_barcode_compliance("6901234567890", declared_country="Made in India")
    assert res["origin_discrepancy"] is True
    assert "Statutory Discrepancy" in res["discrepancy_note"]
    assert "Rule 6(1)(e)" in res["discrepancy_note"]
