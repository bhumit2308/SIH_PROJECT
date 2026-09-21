"""
METRA — Resilient 3-Tier Marketplace URL Scraper & Rule 6(10) Meta-Extractor
Extracts mandatory pre-sale statutory declarations from e-commerce product links
(Amazon, Blinkit, Zepto, Swiggy Instamart, Flipkart, BigBasket, JioMart).
"""
import re
import json
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse, unquote
import httpx

logger = logging.getLogger(__name__)

# Common regex patterns for legal metrology declarations
NET_QTY_PATTERN = re.compile(
    r"\b(\d+(?:\.\d+)?\s*(?:kg|k\.g\.|g|gm|gms|gram|grams|l|ml|ltr|litre|litres|meter|m|cm|pcs|pieces|pack|units|count))\b",
    re.IGNORECASE,
)

PRICE_PATTERN = re.compile(
    r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)",
    re.IGNORECASE,
)

ORIGIN_PATTERN = re.compile(
    r"(?:Country of Origin|Origin|Made in)\s*[:\-–]?\s*([A-Za-z\s]{3,25})",
    re.IGNORECASE,
)

MANUFACTURER_PATTERN = re.compile(
    r"(?:Manufacturer|Marketed By|Packer|Manufactured by|Imported By)\s*[:\-–]?\s*([^<\n\r]{4,80})",
    re.IGNORECASE,
)

CONSUMER_CARE_PATTERN = re.compile(
    r"(?:Customer Care|Consumer Care|Helpline|Toll Free|Support)\s*[:\-–]?\s*([^<\n\r]{6,80})",
    re.IGNORECASE,
)


def detect_platform(url: str) -> str:
    """Identify the e-commerce / quick-commerce network from URL domain."""
    domain = urlparse(url).netloc.lower()
    path = urlparse(url).path.lower()

    if "amazon." in domain:
        return "AMAZON"
    elif "blinkit.com" in domain:
        return "BLINKIT"
    elif "zeptonow.com" in domain or "zepto." in domain:
        return "ZEPTO"
    elif "swiggy.com" in domain and ("instamart" in path or "instamart" in domain):
        return "INSTAMART"
    elif "flipkart.com" in domain:
        return "FLIPKART"
    elif "bigbasket.com" in domain:
        return "BIGBASKET"
    elif "jiomart.com" in domain:
        return "JIOMART"
    return "OTHER"


def _clean_slug_title(slug: str) -> str:
    """Transform a kebab-case or underscored URL slug into a title-cased product name."""
    # Remove file extensions or trailing IDs
    slug = re.sub(r"\.(?:html?|php)$", "", slug)
    # Replace separators with spaces
    cleaned = re.sub(r"[-_+]+", " ", slug).strip()
    # Normalize multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.title()


def _extract_from_json_ld(html_content: str) -> Dict[str, Any]:
    """Scan and parse schema.org/Product structured data blocks."""
    extracted = {}
    script_matches = re.findall(
        r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>',
        html_content,
        re.DOTALL | re.IGNORECASE,
    )
    for raw_json in script_matches:
        try:
            data = json.loads(raw_json.strip())
            items = data if isinstance(data, list) else [data]
            for item in items:
                # Handle graph
                if "@graph" in item and isinstance(item["@graph"], list):
                    items.extend(item["@graph"])
                if item.get("@type") == "Product" or item.get("@type") == "ItemPage":
                    if "name" in item and not extracted.get("product_name"):
                        extracted["product_name"] = str(item["name"]).strip()
                    if "brand" in item:
                        b = item["brand"]
                        extracted["brand"] = b.get("name") if isinstance(b, dict) else str(b)
                    if "offers" in item:
                        o = item["offers"]
                        if isinstance(o, list) and len(o) > 0:
                            o = o[0]
                        if isinstance(o, dict) and "price" in o:
                            extracted["declared_mrp"] = str(o["price"])
                    if "description" in item and not extracted.get("description"):
                        extracted["description"] = str(item["description"]).strip()
        except Exception:
            continue
    return extracted


def _extract_tier2_slug(url: str, platform: str) -> Dict[str, Any]:
    """Tier 2: Parse product name, net quantity and ASIN/SKU directly from URL slugs."""
    parsed = urlparse(url)
    path = unquote(parsed.path)
    res: Dict[str, Any] = {
        "platform": platform,
        "product_name": None,
        "declared_net_qty": None,
        "asin_or_sku": None,
    }

    if platform == "AMAZON":
        # Example: /Tata-Salt-Vacuum-Evaporated-1kg/dp/B01H52914G
        asin_match = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", path)
        if asin_match:
            res["asin_or_sku"] = asin_match.group(1)

        slug_match = re.search(r"/([^/]+)/(?:dp|gp/product)/", path)
        if slug_match:
            raw_slug = slug_match.group(1)
            res["product_name"] = _clean_slug_title(raw_slug)

    elif platform == "BLINKIT":
        # Example: /prn/fortune-sunlite-refined-sunflower-oil-1-l/prid/12345
        prn_match = re.search(r"/prn/([^/]+)", path)
        if prn_match:
            res["product_name"] = _clean_slug_title(prn_match.group(1))
        prid_match = re.search(r"/prid/(\d+)", path)
        if prid_match:
            res["asin_or_sku"] = prid_match.group(1)

    elif platform == "ZEPTO":
        # Example: /pn/amul-taaza-toned-milk-500-ml/pvid/1234
        pn_match = re.search(r"/pn/([^/]+)", path)
        if pn_match:
            res["product_name"] = _clean_slug_title(pn_match.group(1))
        pvid_match = re.search(r"/pvid/([a-zA-Z0-9-]+)", path)
        if pvid_match:
            res["asin_or_sku"] = pvid_match.group(1)

    elif platform == "FLIPKART":
        # Example: /fortune-sunlite-sunflower-oil-pouch-1-l/p/itmfb...
        slug_match = re.search(r"/([^/]+)/p/([a-zA-Z0-9]+)", path)
        if slug_match:
            res["product_name"] = _clean_slug_title(slug_match.group(1))
            res["asin_or_sku"] = slug_match.group(2)

    # General fallback if no specific rule matched: use longest slug part
    if not res["product_name"]:
        parts = [p for p in path.split("/") if p and not p.isdigit() and len(p) > 3]
        if parts:
            longest = max(parts, key=len)
            res["product_name"] = _clean_slug_title(longest)

    # Extract net quantity from derived product name
    if res["product_name"]:
        qty_match = NET_QTY_PATTERN.search(res["product_name"])
        if qty_match:
            res["declared_net_qty"] = qty_match.group(1)

    return res


async def scrape_ecommerce_product(url: str) -> Dict[str, Any]:
    """
    3-Tier resilient extractor:
    - Tier 1: Live HTTP fetch + JSON-LD / OpenGraph parsing
    - Tier 2: URL slug & identifier pattern parsing (resists bot-blockers / 403)
    - Tier 3: Graceful pre-fill template
    """
    url = url.strip()
    platform = detect_platform(url)

    result = {
        "platform": platform,
        "product_url": url,
        "product_name": "",
        "declared_mrp": None,
        "declared_usp": None,
        "declared_net_qty": None,
        "declared_origin": None,
        "declared_expiry": None,
        "declared_manufacturer": None,
        "declared_consumer_care": None,
        "asin_or_sku": None,
        "tier_used": "3_TEMPLATE",
        "notice": None,
    }

    # Step 1: Run Tier 2 baseline (URL slug extraction) so we always have a strong fallback
    slug_data = _extract_tier2_slug(url, platform)
    if slug_data.get("product_name"):
        result["product_name"] = slug_data["product_name"]
    if slug_data.get("declared_net_qty"):
        result["declared_net_qty"] = slug_data["declared_net_qty"]
    if slug_data.get("asin_or_sku"):
        result["asin_or_sku"] = slug_data["asin_or_sku"]
    result["tier_used"] = "2_URL_SLUG_PARSER"

    # Step 2: Attempt Tier 1 Live Fetch
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
        "Cache-Control": "no-cache",
    }

    try:
        async with httpx.AsyncClient(headers=headers, timeout=5.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html = resp.text

                # 1. JSON-LD parsing
                json_ld = _extract_from_json_ld(html)
                if json_ld.get("product_name"):
                    result["product_name"] = json_ld["product_name"]
                if json_ld.get("declared_mrp"):
                    result["declared_mrp"] = json_ld["declared_mrp"]

                # 2. OpenGraph Meta parsing
                og_title = re.search(r'<meta[^>]*property=[\'"]og:title[\'"][^>]*content=[\'"]([^\'"]+)[\'"]', html, re.I)
                if og_title and not result["product_name"]:
                    result["product_name"] = og_title.group(1).split("|")[0].split("-")[0].strip()

                og_price = re.search(r'<meta[^>]*property=[\'"]product:price:amount[\'"][^>]*content=[\'"]([^\'"]+)[\'"]', html, re.I)
                if og_price and not result["declared_mrp"]:
                    result["declared_mrp"] = og_price.group(1).strip()

                # 3. HTML Title fallback
                if not result["product_name"]:
                    title_match = re.search(r"<title>(.*?)</title>", html, re.I)
                    if title_match:
                        raw_title = title_match.group(1)
                        clean = raw_title.split(":")[0].split("|")[0].split("-")[0].strip()
                        if len(clean) > 3:
                            result["product_name"] = clean

                # 4. In-page declarations extraction
                origin_match = ORIGIN_PATTERN.search(html)
                if origin_match:
                    result["declared_origin"] = origin_match.group(1).strip()

                mfg_match = MANUFACTURER_PATTERN.search(html)
                if mfg_match:
                    clean_mfg = re.sub(r"<[^>]+>", "", mfg_match.group(1)).strip()
                    result["declared_manufacturer"] = clean_mfg[:100]

                care_match = CONSUMER_CARE_PATTERN.search(html)
                if care_match:
                    clean_care = re.sub(r"<[^>]+>", "", care_match.group(1)).strip()
                    result["declared_consumer_care"] = clean_care[:100]

                # Net quantity from full product title
                if result["product_name"]:
                    qty_m = NET_QTY_PATTERN.search(result["product_name"])
                    if qty_m and not result["declared_net_qty"]:
                        result["declared_net_qty"] = qty_m.group(1)

                result["tier_used"] = "1_LIVE_HTML"
                result["notice"] = "Successfully extracted live pre-sale declarations directly from marketplace HTML & JSON-LD."
                return result
            else:
                result["notice"] = f"Marketplace returned status {resp.status_code}. Auto-populated attributes via Tier 2 URL slug parser."
    except Exception as e:
        logger.info(f"Tier 1 live fetch encountered {e}; falling back cleanly to Tier 2 slug parser.")
        result["notice"] = f"Bot protection or network timeout encountered. Auto-populated attributes via Tier 2 URL slug parser."

    return result
