# METRA
**AI-Assisted Legal Metrology Compliance & Inspection System**  
*Smart India Hackathon (SIH) Problem Statement: SIH26034*

---

## 👥 Demo Accounts (Configured in Supabase Auth)

The following role-based accounts are pre-configured:

| Role | Email | Access Level |
|---|---|---|
| **Inspector** | `inspector@metra.demo` | Enforcement inspections, package photo uploads, case views |
| **Supervisor** | `supervisor@metra.demo` | Case sign-off, triage review queue, compliance certification |
| **Manufacturer** | `manufacturer@metra.demo` | Self-certification pre-screening, package compliance preview |
| **Admin** | `admin@metra.demo` | Statutory rule pack management, system diagnostics |

*(Credentials for development are kept locally in `credentials.json`)*

---

## ⚡ Quick Start (Team of 3)

### 1. Start the API Backend
```powershell
cd services/api
python -m uvicorn app.main:app --reload --port 8000
```
- **API Swagger Documentation**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 2. Start the Web App
```powershell
cd apps/web
npm run dev
```
- **Web App Dashboard**: [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Architecture & What Has Been Built

```
SIH_PROJECT/
├── apps/web/                         → Next.js 16 + React 19 Frontend
│   ├── src/app/page.tsx              → Login Screen (Glassmorphic dark UI)
│   ├── src/app/dashboard/page.tsx    → KPI Metric Dashboard & Recent Cases
│   ├── src/app/dashboard/inspections/page.tsx     → Full Statutory Case Registry
│   ├── src/app/dashboard/inspections/new/page.tsx → Multi-angle Photo Upload & Pre-flight Gate
│   ├── src/app/dashboard/inspections/[id]/page.tsx → Split Inspection Studio (OCR & Rule Findings)
│   ├── src/app/dashboard/reviews/page.tsx         → Officer Triage & Review Queue
│   └── src/app/dashboard/admin/page.tsx           → Rule Packs Registry & System Diagnostics
├── services/api/                     → FastAPI Backend
│   ├── app/ai/gemini_adapter.py      → Gemini Vision Extraction (Auto-failover: gemini-flash-latest / gemini-3.6-flash)
│   ├── app/images/quality.py         → OpenCV & SciPy Quality Gate (Blur, Brightness, Resolution)
│   ├── app/extraction/service.py     → Core Orchestration & Deterministic Rule Evaluator
│   ├── app/auth/                     → Supabase Auth + JWT Security
│   ├── app/inspections/router.py     → Inspections CRUD & Image Uploads
│   └── app/core/models.py            → 13 SQL Database Tables (PostgreSQL & SQLite Dual-Support)
├── packages/rules/packs/             → Statutory Rule Packs (PCR 2011 Edition)
│   ├── packaged_food_v1.json         → Rules 6(1)(a)-(g), Schedule II SI Units, Rule 18 MRP
│   ├── personal_care_v1.json         → Cosmetics & Toiletries Declarations
│   ├── household_v1.json             → Consumer Goods Net Quantity & Mfg
│   └── imported_consumer_v1.json     → Rule 6(1)(f) Country of Origin & Importer Specs
└── scripts/seed.py                   → Automated Database Seeder
```

---

## 🧪 Validated Pipeline Test
To test the entire live AI vision and rule evaluation pipeline:
```powershell
python test_e2e_pipeline.py
```
This runs the full workflow:
1. Logs in as Inspector via Supabase Auth
2. Registers a packaged food commodity inspection
3. Generates & uploads a synthetic package image to Supabase Storage
4. Runs client & server quality gates
5. Calls Gemini Vision for OCR & declaration extraction
6. Executes the deterministic Legal Metrology Rule Engine
7. Evaluates all statutory rules and computes the final compliance verdict
