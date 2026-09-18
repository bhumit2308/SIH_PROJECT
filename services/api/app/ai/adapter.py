"""
AI Extraction Adapter — Provider-Neutral Interface
===================================================
The rule engine NEVER depends on this module.
This module returns structured candidate fields only.
Replace GeminiAdapter with any other provider without touching rule logic.
"""
from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Optional


class ExtractionField(BaseModel):
    raw_value: Optional[str] = None
    normalized_value: Optional[str] = None
    confidence: float = 0.0
    bounding_box: Optional[dict] = None  # {x, y, width, height} as % of image


class ExtractionResult(BaseModel):
    product_name: Optional[ExtractionField] = None
    net_quantity: Optional[ExtractionField] = None
    mrp: Optional[ExtractionField] = None
    manufacturer: Optional[ExtractionField] = None
    date_info: Optional[ExtractionField] = None
    consumer_care: Optional[ExtractionField] = None
    country_of_origin: Optional[ExtractionField] = None
    unit_sale_price: Optional[ExtractionField] = None
    raw_ocr_text: Optional[str] = None
    provider: str = "unknown"
    extraction_error: Optional[str] = None


class ExtractionAdapter(ABC):
    @abstractmethod
    async def extract(self, image_bytes: bytes, context: dict) -> ExtractionResult:
        """Extract declaration fields from image bytes. Must return ExtractionResult."""
        ...
