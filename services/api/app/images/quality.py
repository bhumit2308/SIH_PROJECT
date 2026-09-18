import io
import logging
import numpy as np
from PIL import Image, ExifTags

logger = logging.getLogger(__name__)

MIN_DIMENSION = 400
BLUR_THRESHOLD = 100.0
DARK_THRESHOLD = 40.0
BRIGHT_THRESHOLD = 220.0


def run_quality_checks(file_bytes: bytes) -> dict:
    """
    Runs all quality checks on an image byte string.
    Returns: {status: PASS|WARNING|RETAKE, checks: [...], width, height}
    """
    checks = []
    overall = "PASS"

    try:
        img = Image.open(io.BytesIO(file_bytes))
        img = _fix_orientation(img)
        width, height = img.size
    except Exception as e:
        logger.error(f"Cannot open image: {e}")
        return {
            "status": "RETAKE",
            "checks": [{"name": "file_readable", "passed": False, "reason": "Cannot read image file."}],
            "width": None, "height": None,
        }

    # ── Check 1: Resolution ──────────────────────────
    res_ok = width >= MIN_DIMENSION and height >= MIN_DIMENSION
    checks.append({
        "name": "resolution",
        "passed": res_ok,
        "value": f"{width}x{height}",
        "threshold": f"{MIN_DIMENSION}x{MIN_DIMENSION}",
        "reason": None if res_ok else f"Image too small ({width}x{height}). Minimum {MIN_DIMENSION}x{MIN_DIMENSION}.",
    })
    if not res_ok:
        overall = "RETAKE"

    # ── Check 2: Blur (Laplacian variance) ──────────
    gray = np.array(img.convert("L"), dtype=np.float32)
    laplacian = _laplacian_variance(gray)
    blur_ok = laplacian >= BLUR_THRESHOLD
    checks.append({
        "name": "blur",
        "passed": blur_ok,
        "value": round(laplacian, 2),
        "threshold": BLUR_THRESHOLD,
        "reason": None if blur_ok else "Image appears blurry. Please retake with a steady hand.",
    })
    if not blur_ok:
        overall = "RETAKE"

    # ── Check 3: Darkness ────────────────────────────
    mean_brightness = float(gray.mean())
    dark_ok = mean_brightness >= DARK_THRESHOLD
    checks.append({
        "name": "brightness_low",
        "passed": dark_ok,
        "value": round(mean_brightness, 2),
        "threshold": DARK_THRESHOLD,
        "reason": None if dark_ok else "Image is too dark. Use better lighting.",
    })
    if not dark_ok:
        overall = "RETAKE"

    # ── Check 4: Overexposure ────────────────────────
    bright_ok = mean_brightness <= BRIGHT_THRESHOLD
    checks.append({
        "name": "brightness_high",
        "passed": bright_ok,
        "value": round(mean_brightness, 2),
        "threshold": BRIGHT_THRESHOLD,
        "reason": None if bright_ok else "Image is overexposed/washed out. Avoid direct flash.",
    })
    if not bright_ok and overall == "PASS":
        overall = "WARNING"

    return {
        "status": overall,
        "checks": checks,
        "width": width,
        "height": height,
    }


def _laplacian_variance(gray: np.ndarray) -> float:
    """Compute Laplacian variance as a blur measure. Higher = sharper."""
    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    from scipy.ndimage import convolve
    try:
        laplacian = convolve(gray, kernel)
    except ImportError:
        # Fallback without scipy
        laplacian = gray[1:-1, 1:-1] * (-4)
        laplacian += gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:]
    return float(laplacian.var())


def _fix_orientation(img: Image.Image) -> Image.Image:
    """Fix EXIF orientation so image is always upright."""
    try:
        exif = img._getexif()
        if exif:
            for tag, value in exif.items():
                if ExifTags.TAGS.get(tag) == "Orientation":
                    rotations = {3: 180, 6: 270, 8: 90}
                    if value in rotations:
                        img = img.rotate(rotations[value], expand=True)
                    break
    except Exception:
        pass
    return img
