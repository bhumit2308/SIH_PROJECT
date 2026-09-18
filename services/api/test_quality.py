import sys
sys.path.insert(0, '.')

from app.images.quality import run_quality_checks
import io
from PIL import Image, ImageDraw

# Test 1: Sharp image
img = Image.new('RGB', (1000, 1000), 'white')
draw = ImageDraw.Draw(img)
for i in range(0, 1000, 20):
    draw.line([(0, i), (1000, i)], fill='black', width=2)
buf = io.BytesIO()
img.save(buf, format='JPEG')
result = run_quality_checks(buf.getvalue())
print("Sharp image status:", result["status"])
for c in result["checks"]:
    status = "PASS" if c["passed"] else "FAIL"
    print(f"  {c['name']}: {status}")

# Test 2: Dark image
dark_img = Image.new('RGB', (1000, 1000), (10, 10, 10))
buf2 = io.BytesIO()
dark_img.save(buf2, format='JPEG')
dark_result = run_quality_checks(buf2.getvalue())
print("Dark image status:", dark_result["status"])

# Test 3: Small image
small_img = Image.new('RGB', (200, 200), 'white')
buf3 = io.BytesIO()
small_img.save(buf3, format='JPEG')
small_result = run_quality_checks(buf3.getvalue())
print("Small image status:", small_result["status"])

print("Quality gate test COMPLETE")
