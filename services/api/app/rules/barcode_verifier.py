"""
METRA – GS1 Barcode & Country of Origin Discrepancy Engine
Validates EAN-13 / GTIN barcodes, extracts GS1 country prefix allocations,
and detects origin falsification under Rule 6(1)(e) of PCR 2011.
"""
from typing import Optional, Dict, Any

GS1_PREFIX_MAP = {
    "890": "India (GS1 India)",
    "00":  "United States / Canada",
    "01":  "United States / Canada",
    "02":  "United States / Canada",
    "03":  "United States / Canada",
    "04":  "United States / Canada",
    "05":  "United States / Canada",
    "06":  "United States / Canada",
    "07":  "United States / Canada",
    "08":  "United States / Canada",
    "09":  "United States / Canada",
    "30":  "France",
    "31":  "France",
    "32":  "France",
    "33":  "France",
    "34":  "France",
    "35":  "France",
    "36":  "France",
    "37":  "France",
    "40":  "Germany",
    "41":  "Germany",
    "42":  "Germany",
    "43":  "Germany",
    "44":  "Germany",
    "45":  "Japan",
    "49":  "Japan",
    "50":  "United Kingdom",
    "54":  "Belgium & Luxembourg",
    "57":  "Denmark",
    "64":  "Finland",
    "690": "China",
    "691": "China",
    "692": "China",
    "693": "China",
    "694": "China",
    "695": "China",
    "696": "China",
    "697": "China",
    "698": "China",
    "699": "China",
    "73":  "Sweden",
    "76":  "Switzerland",
    "789": "Brazil",
    "790": "Brazil",
    "80":  "Italy",
    "81":  "Italy",
    "82":  "Italy",
    "83":  "Italy",
    "84":  "Spain",
    "87":  "Netherlands",
    "880": "South Korea",
    "885": "Thailand",
    "888": "Singapore",
    "893": "Vietnam",
    "90":  "Austria",
    "93":  "Australia",
    "94":  "New Zealand",
}


def validate_ean13_checksum(barcode: str) -> bool:
    """Verifies Modulo-10 checksum for standard EAN-13 barcodes."""
    digits = [int(c) for c in barcode if c.isdigit()]
    if len(digits) != 13:
        return False

    checksum = digits[-1]
    calculated_sum = sum(d * (1 if i % 2 == 0 else 3) for i, d in enumerate(digits[:-1]))
    expected_checksum = (10 - (calculated_sum % 10)) % 10
    return checksum == expected_checksum


def resolve_gs1_country(barcode: str) -> str:
    """Resolves allocating GS1 Member Organization country from prefix."""
    digits = "".join(c for c in barcode if c.isdigit())
    if len(digits) < 3:
        return "Unknown Prefix"

    # Check 3-digit prefix
    prefix3 = digits[:3]
    if prefix3 in GS1_PREFIX_MAP:
        return GS1_PREFIX_MAP[prefix3]

    # Check 2-digit prefix
    prefix2 = digits[:2]
    if prefix2 in GS1_PREFIX_MAP:
        return GS1_PREFIX_MAP[prefix2]

    return "International / Unassigned GS1 Prefix"


def verify_barcode_compliance(
    barcode: str,
    declared_country: Optional[str] = None
) -> Dict[str, Any]:
    """
    Validates barcode format, checksum, and cross-checks with declared country of origin.
    """
    clean_code = "".join(c for c in barcode if c.isdigit())
    is_valid_len = len(clean_code) in (8, 12, 13, 14)
    is_checksum_valid = validate_ean13_checksum(clean_code) if len(clean_code) == 13 else True
    origin_country = resolve_gs1_country(clean_code) if len(clean_code) >= 3 else "Unknown"

    has_discrepancy = False
    discrepancy_note = ""

    if declared_country and len(clean_code) >= 3:
        declared_norm = declared_country.strip().lower()
        if "india" in declared_norm or "bharat" in declared_norm or declared_norm == "in":
            if not clean_code.startswith("890"):
                has_discrepancy = True
                discrepancy_note = (
                    f"Statutory Discrepancy: Packaging declares 'Country of Origin: India', "
                    f"but barcode prefix '{clean_code[:3]}' is assigned to {origin_country}. "
                    f"Potential misdeclaration under Rule 6(1)(e) & Section 36 of Legal Metrology Act."
                )

    return {
        "barcode": clean_code,
        "format": f"EAN-{len(clean_code)}" if len(clean_code) in (8, 13) else "GTIN",
        "is_valid_format": is_valid_len,
        "is_checksum_valid": is_checksum_valid,
        "gs1_issuing_country": origin_country,
        "is_gs1_india": clean_code.startswith("890"),
        "origin_discrepancy": has_discrepancy,
        "discrepancy_note": discrepancy_note,
    }
