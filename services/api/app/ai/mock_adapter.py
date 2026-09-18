"""
Mock Adapter — Deterministic results for testing and demo.
Returns realistic structured data without calling any AI API.
Used when AI_PROVIDER=mock or as fallback when Gemini is unavailable.
"""
from app.ai.adapter import ExtractionAdapter, ExtractionResult, ExtractionField


# Demo seed results — keyed by view_type for predictability
MOCK_RESULTS = {
    "compliant": ExtractionResult(
        product_name=ExtractionField(raw_value="Amul Butter", confidence=0.97),
        net_quantity=ExtractionField(raw_value="500 g", confidence=0.95),
        mrp=ExtractionField(raw_value="MRP Rs. 280 (Inclusive of all taxes)", confidence=0.98),
        manufacturer=ExtractionField(raw_value="Gujarat Cooperative Milk Marketing Federation Ltd, Anand, Gujarat - 388001", confidence=0.92),
        date_info=ExtractionField(raw_value="Mfg. 08/2025 Best Before: 90 days from mfg.", confidence=0.90),
        consumer_care=ExtractionField(raw_value="1800 258 3333", confidence=0.88),
        country_of_origin=None,
        unit_sale_price=ExtractionField(raw_value="Rs. 56.00 per 100 g", confidence=0.85),
        raw_ocr_text="Amul Butter 500g MRP Rs. 280 Inclusive of all taxes...",
        provider="mock",
    ),
    "missing_mrp": ExtractionResult(
        product_name=ExtractionField(raw_value="Generic Biscuits", confidence=0.90),
        net_quantity=ExtractionField(raw_value="200 g", confidence=0.88),
        mrp=None,  # ← MRP missing — will trigger LM-PRE-04 VIOLATION
        manufacturer=ExtractionField(raw_value="ABC Foods Pvt Ltd, Mumbai - 400001", confidence=0.85),
        date_info=ExtractionField(raw_value="Mfg. 07/2025", confidence=0.82),
        consumer_care=ExtractionField(raw_value="care@abcfoods.in", confidence=0.80),
        raw_ocr_text="Generic Biscuits 200g ABC Foods...",
        provider="mock",
    ),
    "low_confidence": ExtractionResult(
        product_name=ExtractionField(raw_value="Some Product (partial)", confidence=0.60),
        net_quantity=ExtractionField(raw_value="5?? g", confidence=0.45),  # ← low conf → REVIEW_REQUIRED
        mrp=ExtractionField(raw_value="MRP Rs. 4?", confidence=0.50),
        manufacturer=ExtractionField(raw_value="XYZ Company", confidence=0.65),
        date_info=None,
        consumer_care=None,
        raw_ocr_text="blurry text...",
        provider="mock",
    ),
}


class MockAdapter(ExtractionAdapter):
    """Deterministic mock — use scenario= in context to select result."""

    async def extract(self, image_bytes: bytes, context: dict) -> ExtractionResult:
        scenario = context.get("mock_scenario", "compliant")
        result = MOCK_RESULTS.get(scenario, MOCK_RESULTS["compliant"])
        return result
