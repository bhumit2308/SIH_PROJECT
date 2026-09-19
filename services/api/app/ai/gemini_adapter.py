"""
Gemini Vision Adapter
Sends package images to Gemini Vision and parses structured extraction results.
Prompt is schema-constrained — Gemini ONLY returns structured JSON.
"""
import json
import logging
import io
import PIL.Image
from google import genai
from google.genai import types
from app.ai.adapter import ExtractionAdapter, ExtractionResult, ExtractionField
from app.core.config import settings

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """
You are a Legal Metrology compliance assistant for the Government of India.
Analyze this packaged product image and extract ONLY the mandatory declaration fields
required under the Legal Metrology (Packaged Commodities) Rules, 2011.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no explanation, no extra text.
2. If a field is NOT clearly visible, return null — DO NOT guess or invent values.
3. Return the exact text as printed on the package — do not paraphrase or translate.
4. If text is partially obscured, return what is readable and note "(partial)" at the end.
5. Confidence is 0.0 to 1.0. Use < 0.7 for anything uncertain or partially visible.
6. If the image does not appear to be a product package, return all null fields.

Return EXACTLY this JSON schema, no other keys:
{
  "product_name": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "net_quantity": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "mrp": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "manufacturer": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "date_info": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "consumer_care": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "country_of_origin": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "unit_sale_price": {"raw_value": "string or null", "confidence": 0.0, "box_2d": [0, 0, 0, 0]},
  "raw_ocr_text": "all readable text from the image as a single string"
}
Note for box_2d: If the field is clearly visible, return normalized coordinates [ymin, xmin, ymax, xmax] scaled 0 to 1000 around the detected text on the package panel. If not visible or uncertain, return null.
"""


class GeminiAdapter(ExtractionAdapter):
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = "gemini-3.6-flash"

    async def extract(self, image_bytes: bytes, context: dict) -> ExtractionResult:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._extract_sync, image_bytes, context)

    def _extract_sync(self, image_bytes: bytes, context: dict) -> ExtractionResult:
        import time
        try:
            pil_image = PIL.Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return ExtractionResult(provider="gemini", extraction_error=f"Image decode error: {e}")

        last_err = None
        for model in ["gemini-flash-latest", "gemini-3.6-flash"]:
            for attempt in range(2):
                try:
                    response = self.client.models.generate_content(
                        model=model,
                        contents=[EXTRACTION_PROMPT, pil_image],
                        config=types.GenerateContentConfig(
                            temperature=0.1,
                            max_output_tokens=2048,
                            response_mime_type="application/json",
                        ),
                    )

                    raw = response.text.strip() if response.text else ""
                    if raw.startswith("```"):
                        raw = raw.split("```")[1]
                        if raw.startswith("json"):
                            raw = raw[4:]
                    raw = raw.strip()

                    data = json.loads(raw)
                    return self._parse_response(data)
                except json.JSONDecodeError as e:
                    logger.error(f"Gemini model {model} returned invalid JSON: {e}")
                    last_err = f"JSON parse error: {e}"
                    break
                except Exception as e:
                    logger.warning(f"Gemini model {model} attempt {attempt+1} failed: {e}")
                    last_err = str(e)
                    time.sleep(1)

        return ExtractionResult(provider="gemini", extraction_error=last_err)

    def _parse_response(self, data: dict) -> ExtractionResult:
        def _field(key: str) -> ExtractionField | None:
            v = data.get(key)
            if not v or not isinstance(v, dict):
                return None
            raw_val = v.get("raw_value")
            if not raw_val:
                return None

            bbox = None
            box = v.get("box_2d")
            if box and isinstance(box, (list, tuple)) and len(box) == 4:
                try:
                    ymin, xmin, ymax, xmax = [float(c) for c in box]
                    # Scale to 0..100 percentage
                    if ymax > 1.0 or xmax > 1.0:
                        ymin /= 10.0
                        xmin /= 10.0
                        ymax /= 10.0
                        xmax /= 10.0
                    else:
                        ymin *= 100.0
                        xmin *= 100.0
                        ymax *= 100.0
                        xmax *= 100.0
                    bbox = {
                        "x": round(max(0.0, min(100.0, xmin)), 2),
                        "y": round(max(0.0, min(100.0, ymin)), 2),
                        "width": round(max(1.0, min(100.0 - xmin, xmax - xmin)), 2),
                        "height": round(max(1.0, min(100.0 - ymin, ymax - ymin)), 2),
                    }
                except Exception:
                    bbox = None

            return ExtractionField(
                raw_value=raw_val,
                confidence=float(v.get("confidence", 0.0)),
                bounding_box=bbox,
            )

        return ExtractionResult(
            product_name=_field("product_name"),
            net_quantity=_field("net_quantity"),
            mrp=_field("mrp"),
            manufacturer=_field("manufacturer"),
            date_info=_field("date_info"),
            consumer_care=_field("consumer_care"),
            country_of_origin=_field("country_of_origin"),
            unit_sale_price=_field("unit_sale_price"),
            raw_ocr_text=data.get("raw_ocr_text"),
            provider="gemini",
        )
