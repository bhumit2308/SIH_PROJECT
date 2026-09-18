import asyncio
import sys
import io
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent / "services" / "api"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from httpx import AsyncClient, ASGITransport
from app.main import app


async def test_full_pipeline():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Login
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "inspector@metra.demo",
            "password": "DemoPassword123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("1. Authenticated as Inspector, JWT acquired.")

        # 2. Category
        cat_res = await ac.get("/api/v1/rule-packs/categories", headers=headers)
        cats = cat_res.json()
        cat_id = next(c["id"] for c in cats if c["code"] == "packaged_food")
        print(f"2. Selected Category: Packaged Food (ID: {cat_id})")

        # 3. Create inspection
        insp_res = await ac.post("/api/v1/inspections", headers=headers, json={
            "category_id": cat_id,
            "mode": "INSPECTION",
            "product_name": "Aashirvaad Superior MP Atta 5kg"
        })
        insp_data = insp_res.json()
        insp_id = insp_data["id"]
        print(f"3. Created Inspection #{insp_id[:8]} [Status: {insp_data['status']}]")

        # 4. Generate & Upload image
        img = Image.new("RGB", (800, 800), color=(255, 255, 255))
        d = ImageDraw.Draw(img)
        d.text((40, 40), "Aashirvaad Superior MP Whole Wheat Atta", fill=(0, 0, 0))
        d.text((40, 80), "Net Quantity: 5 kg", fill=(0, 0, 0))
        d.text((40, 120), "MRP Rs. 265.00 (Inclusive of all taxes)", fill=(0, 0, 0))
        d.text((40, 160), "Date of Packaging: 08/2026", fill=(0, 0, 0))
        d.text((40, 200), "Manufactured By: ITC Limited, 37 J.L. Nehru Road, Kolkata 700071", fill=(0, 0, 0))
        d.text((40, 240), "Consumer Care: contactus@itc.in, 1800-425-4444", fill=(0, 0, 0))
        d.text((40, 280), "Unit Sale Price: Rs. 53.00 per kg", fill=(0, 0, 0))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=95)

        files = {"file": ("atta_front.jpg", buf.getvalue(), "image/jpeg")}
        data = {"view_type": "FRONT"}

        upload_res = await ac.post(f"/api/v1/inspections/{insp_id}/images", headers=headers, files=files, data=data)
        print(f"4. Uploaded package image [HTTP {upload_res.status_code}, Quality: {upload_res.json().get('quality_status')}]")

        # 5. Trigger AI Analysis
        analyze_res = await ac.post(f"/api/v1/inspections/{insp_id}/analyze", headers=headers)
        print(f"5. AI Analysis triggered: {analyze_res.json().get('message')}")

        # 6. Poll for completion
        for poll in range(12):
            await asyncio.sleep(2)
            detail_res = await ac.get(f"/api/v1/inspections/{insp_id}", headers=headers)
            detail = detail_res.json()
            st = detail["status"]
            fst = detail["final_status"]
            findings_count = len(detail.get("findings", []))
            fields_count = len(detail.get("extracted_fields", []))
            print(f"   Poll {poll+1}: Status={st} | Verdict={fst} | Declarations={fields_count} | Findings={findings_count}")
            if st in ("FINALIZED", "REVIEW_REQUIRED", "FAILED"):
                print("\n=== PIPELINE RESULTS ===")
                print(f"Final Inspection Status: {fst}")
                for f in detail.get("findings", []):
                    print(f"  [{f['status']}] ({f['severity']}) {f['message']}")
                break


if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
