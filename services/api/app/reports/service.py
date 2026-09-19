"""
METRA – Statutory Inspection Certificate Generator
Produces a Government-of-India style Legal Metrology Inspection Notice PDF
aligned with the Legal Metrology (Packaged Commodities) Rules, 2011.
"""
import io
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, KeepTogether
)
from reportlab.platypus.flowables import Flowable

logger = logging.getLogger(__name__)

# ── Colour Palette ────────────────────────────────────────────
GOV_BLUE   = colors.HexColor("#1a3a6b")   # Deep navy – Govt of India header
GOV_ORANGE = colors.HexColor("#FF6600")   # Saffron accent
GOLD       = colors.HexColor("#C9A84C")
GREEN_OK   = colors.HexColor("#16a34a")
RED_VIOL   = colors.HexColor("#dc2626")
AMBER_WARN = colors.HexColor("#d97706")
GRAY_LIGHT = colors.HexColor("#f0f4f8")
GRAY_MED   = colors.HexColor("#94a3b8")
DARK_BG    = colors.HexColor("#0f172a")
WHITE      = colors.white
BLACK      = colors.black


def _build_qr(url: str, size: int = 80) -> RLImage:
    """Generate a QR code image flowable for the given URL."""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=4, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return RLImage(buf, width=size, height=size)


class ColoredLine(Flowable):
    """A horizontal rule with custom color and thickness."""
    def __init__(self, width, color, thickness=1):
        super().__init__()
        self.width = width
        self.color = color
        self.thickness = thickness

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)

    def wrap(self, *args):
        return self.width, self.thickness + 2


# ── Style Registry ────────────────────────────────────────────
def _styles():
    base = getSampleStyleSheet()
    return {
        "title_main": ParagraphStyle("title_main", fontName="Helvetica-Bold",
            fontSize=16, leading=20, textColor=WHITE, alignment=TA_CENTER),
        "title_sub": ParagraphStyle("title_sub", fontName="Helvetica",
            fontSize=9, leading=12, textColor=GRAY_MED, alignment=TA_CENTER),
        "section_h": ParagraphStyle("section_h", fontName="Helvetica-Bold",
            fontSize=11, leading=14, textColor=GOV_BLUE, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("body", fontName="Helvetica",
            fontSize=9, leading=13, textColor=BLACK),
        "body_small": ParagraphStyle("body_small", fontName="Helvetica",
            fontSize=8, leading=11, textColor=colors.HexColor("#475569")),
        "mono": ParagraphStyle("mono", fontName="Courier",
            fontSize=8, leading=11, textColor=GOV_BLUE),
        "footer": ParagraphStyle("footer", fontName="Helvetica",
            fontSize=7.5, leading=10, textColor=GRAY_MED, alignment=TA_CENTER),
        "disclaimer": ParagraphStyle("disclaimer", fontName="Helvetica-Oblique",
            fontSize=7.5, leading=10, textColor=colors.HexColor("#64748b"), alignment=TA_JUSTIFY),
        "compliant_banner": ParagraphStyle("compliant_banner", fontName="Helvetica-Bold",
            fontSize=15, leading=20, textColor=WHITE, alignment=TA_CENTER),
        "violation_banner": ParagraphStyle("violation_banner", fontName="Helvetica-Bold",
            fontSize=15, leading=20, textColor=WHITE, alignment=TA_CENTER),
        "cell_label": ParagraphStyle("cell_label", fontName="Helvetica-Bold",
            fontSize=8, leading=11, textColor=colors.HexColor("#1e293b")),
        "cell_value": ParagraphStyle("cell_value", fontName="Helvetica",
            fontSize=8.5, leading=12, textColor=BLACK),
        "cell_pass": ParagraphStyle("cell_pass", fontName="Helvetica-Bold",
            fontSize=8.5, leading=11, textColor=GREEN_OK, alignment=TA_CENTER),
        "cell_fail": ParagraphStyle("cell_fail", fontName="Helvetica-Bold",
            fontSize=8.5, leading=11, textColor=RED_VIOL, alignment=TA_CENTER),
        "cell_warn": ParagraphStyle("cell_warn", fontName="Helvetica-Bold",
            fontSize=8.5, leading=11, textColor=AMBER_WARN, alignment=TA_CENTER),
    }


# ── Field labels (LMPC Rule 6(1)) ────────────────────────────
FIELD_LABEL_MAP = {
    "product_name":      ("Name & Commodity Description",              "Rule 6(1)(a)"),
    "net_quantity":      ("Net Quantity / Weight / Volume",            "Rule 6(1)(b) + Sch. II"),
    "mrp":               ("Maximum Retail Price (MRP)",                "Rule 6(1)(e) + Rule 18"),
    "manufacturer":      ("Manufacturer / Packer Name & Address",      "Rule 6(1)(c)"),
    "date_info":         ("Month & Year of Manufacture",               "Rule 6(1)(d)"),
    "consumer_care":     ("Consumer Care Contact Details",             "Rule 6(1)(g)"),
    "country_of_origin": ("Country of Origin",                        "Rule 6(1)(f)"),
    "unit_sale_price":   ("Unit Sale Price (USP)",                     "Rule 22(1)"),
    "batch_lot":         ("Batch / Lot Number",                        "Rule 6(1)(d)"),
    "fssai_license":     ("FSSAI License Number",                      "FSS Act 2006"),
    "bar_code":          ("Bar Code / QR Code",                        "Advisory"),
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
STATUS_EMOJI   = {"PASS": "✓", "VIOLATION": "✗", "WARNING": "⚠", "REVIEW_REQUIRED": "?"}


def generate_inspection_certificate(
    inspection_id: str,
    inspection_data: dict,
) -> bytes:
    """
    Build a multi-section statutory inspection certificate PDF.
    Returns raw PDF bytes.

    inspection_data keys:
        product_name, category_name, mode, status, final_status, created_at,
        inspector_name, inspector_email, organisation,
        extracted_fields: list[{field_code, raw_value, normalized_value, confidence}]
        findings: list[{status, severity, message, field_code, ai_raw_value}]
    """
    buf = io.BytesIO()
    page_w, page_h = A4
    margin = 1.8 * cm

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
        title=f"METRA Inspection Notice – {inspection_id[:8].upper()}",
        author="METRA – Legal Metrology AI System",
        subject="Legal Metrology (Packaged Commodities) Rules, 2011",
    )

    S = _styles()
    usable_w = page_w - 2 * margin
    story = []

    # ─────────────────────────────────────────────────────────
    # SECTION 1 — Government Header
    # ─────────────────────────────────────────────────────────
    # Dark header block simulated with a table
    header_data = [[
        Paragraph(
            "<b>GOVERNMENT OF INDIA</b><br/>"
            "Ministry of Consumer Affairs, Food &amp; Public Distribution<br/>"
            "Department of Consumer Affairs – Legal Metrology Division<br/>"
            "<font size='7' color='#94a3b8'>METRA – AI-Assisted Inspection &amp; Compliance Verification System</font>",
            ParagraphStyle("hdr", fontName="Helvetica-Bold", fontSize=11, leading=16,
                           textColor=WHITE, alignment=TA_CENTER)
        )
    ]]
    header_tbl = Table(header_data, colWidths=[usable_w])
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), GOV_BLUE),
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 0.4 * cm))
    story.append(ColoredLine(usable_w, GOLD, thickness=2))
    story.append(Spacer(1, 0.3 * cm))

    # ─────────────────────────────────────────────────────────
    # SECTION 2 — Notice Title + Reference
    # ─────────────────────────────────────────────────────────
    notice_num = f"METRA/{datetime.now(timezone.utc).strftime('%Y')}/{inspection_id[:8].upper()}"
    meta_rows = [
        ["Notice No.:",          notice_num,              "Date of Inspection:",   datetime.now(timezone.utc).strftime("%d %b %Y")],
        ["Inspection ID:",       Paragraph(f'<font name="Courier" size="8">{inspection_id}</font>', S["body"]),
         "Mode:",                inspection_data.get("mode", "INSPECTION").replace("_", " ")],
        ["Category:",            inspection_data.get("category_name", "Packaged Food"),
         "Product:",             inspection_data.get("product_name") or "—"],
        ["Inspector:",           inspection_data.get("inspector_name", "—"),
         "Organisation:",        inspection_data.get("organisation", "—")],
    ]
    meta_col_w = [2.5 * cm, 5.5 * cm, 3.5 * cm, 5 * cm]
    meta_tbl = Table(meta_rows, colWidths=meta_col_w)
    meta_tbl.setStyle(TableStyle([
        ("FONTNAME",   (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME",   (0, 0), (0, -1), "Helvetica-Bold"),   # label cols
        ("FONTNAME",   (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 8.5),
        ("LEADING",    (0, 0), (-1, -1), 13),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_LIGHT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("GRID",       (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 0.5 * cm))

    # ─────────────────────────────────────────────────────────
    # SECTION 3 — Compliance Result Banner
    # ─────────────────────────────────────────────────────────
    final_status = inspection_data.get("final_status", "PENDING")
    if final_status == "COMPLIANT":
        banner_text = "✓  COMPLIANT — No Violations Detected"
        banner_color = GREEN_OK
    elif final_status == "NON_COMPLIANT":
        banner_text = "✗  NON-COMPLIANT — Violations Detected"
        banner_color = RED_VIOL
    elif final_status == "REVIEW_REQUIRED":
        banner_text = "⚠  REVIEW REQUIRED — Supervisor Verification Needed"
        banner_color = AMBER_WARN
    else:
        banner_text = "⧗  PENDING — Analysis In Progress"
        banner_color = GOV_BLUE

    banner_data = [[Paragraph(banner_text,
        ParagraphStyle("bn", fontName="Helvetica-Bold", fontSize=13, leading=18,
                       textColor=WHITE, alignment=TA_CENTER))]]
    banner_tbl = Table(banner_data, colWidths=[usable_w])
    banner_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), banner_color),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [5]),
    ]))
    story.append(banner_tbl)
    story.append(Spacer(1, 0.5 * cm))

    # ─────────────────────────────────────────────────────────
    # SECTION 4 — Mandatory Declarations Table (Rule 6(1)(a)–(g))
    # ─────────────────────────────────────────────────────────
    story.append(Paragraph("MANDATORY DECLARATIONS VERIFICATION", S["section_h"]))
    story.append(Paragraph(
        "Verification of mandatory declarations required under the Legal Metrology "
        "(Packaged Commodities) Rules, 2011 as extracted by AI-assisted OCR and Gemini Vision.",
        S["body_small"]))
    story.append(Spacer(1, 0.25 * cm))

    extracted = inspection_data.get("extracted_fields", [])
    ext_by_code = {f["field_code"]: f for f in extracted}

    decl_header = [
        Paragraph("Declaration Field", S["cell_label"]),
        Paragraph("Legal Reference", S["cell_label"]),
        Paragraph("AI Extracted Value", S["cell_label"]),
        Paragraph("Confidence", S["cell_label"]),
        Paragraph("Status", S["cell_label"]),
    ]
    decl_rows = [decl_header]

    findings_by_field = {}
    for f in inspection_data.get("findings", []):
        fc = f.get("field_code")
        if fc:
            findings_by_field.setdefault(fc, []).append(f)

    for field_code, (label, legal_ref) in FIELD_LABEL_MAP.items():
        ef = ext_by_code.get(field_code)
        raw_val = (ef.get("normalized_value") or ef.get("raw_value") or "—") if ef else "—"
        confidence = ef.get("confidence") if ef else None
        conf_str = f"{int(confidence * 100)}%" if confidence is not None else "—"

        # Determine status for this field
        field_findings = findings_by_field.get(field_code, [])
        if any(f["status"] == "VIOLATION" for f in field_findings):
            status_cell = Paragraph("VIOLATION", S["cell_fail"])
            row_bg = colors.HexColor("#fff5f5")
        elif any(f["status"] == "WARNING" for f in field_findings):
            status_cell = Paragraph("WARNING", S["cell_warn"])
            row_bg = colors.HexColor("#fffbeb")
        elif ef:
            status_cell = Paragraph("PASS", S["cell_pass"])
            row_bg = colors.HexColor("#f0fdf4")
        else:
            status_cell = Paragraph("NOT FOUND", S["cell_fail"])
            row_bg = colors.HexColor("#fff5f5")

        decl_rows.append([
            Paragraph(label, S["cell_value"]),
            Paragraph(legal_ref, S["body_small"]),
            Paragraph(str(raw_val)[:120], S["cell_value"]),
            Paragraph(conf_str, S["cell_value"]),
            status_cell,
        ])

    decl_col_w = [5.5 * cm, 2.8 * cm, 5 * cm, 1.8 * cm, 2.2 * cm]
    decl_tbl = Table(decl_rows, colWidths=decl_col_w, repeatRows=1)
    decl_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), GOV_BLUE),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8.5),
        ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
    ]))
    story.append(decl_tbl)
    story.append(Spacer(1, 0.6 * cm))

    # ─────────────────────────────────────────────────────────
    # SECTION 5 — Violations & Findings Detail
    # ─────────────────────────────────────────────────────────
    findings = inspection_data.get("findings", [])
    violations = [f for f in findings if f.get("status") in ("VIOLATION", "WARNING")]
    violations.sort(key=lambda x: SEVERITY_ORDER.get(x.get("severity", "LOW"), 99))

    story.append(Paragraph("FINDINGS & VIOLATIONS REGISTER", S["section_h"]))
    story.append(ColoredLine(usable_w, GOLD, thickness=1))
    story.append(Spacer(1, 0.2 * cm))

    if not violations:
        ok_data = [[
            Paragraph(
                "✓  No violations or warnings detected. The packaged commodity appears to comply "
                "with mandatory declaration requirements under LMPC Rules, 2011.",
                ParagraphStyle("ok", fontName="Helvetica-Bold", fontSize=10, leading=14,
                               textColor=GREEN_OK, alignment=TA_CENTER)
            )
        ]]
        ok_tbl = Table(ok_data, colWidths=[usable_w])
        ok_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ("GRID",          (0, 0), (-1, -1), 0.5, GREEN_OK),
            ("TOPPADDING",    (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]))
        story.append(ok_tbl)
    else:
        viol_header = [
            Paragraph("#", S["cell_label"]),
            Paragraph("Severity", S["cell_label"]),
            Paragraph("Field / Rule", S["cell_label"]),
            Paragraph("AI Detected Value", S["cell_label"]),
            Paragraph("Finding Details", S["cell_label"]),
            Paragraph("Status", S["cell_label"]),
        ]
        viol_rows = [viol_header]
        for i, v in enumerate(violations, 1):
            sev = v.get("severity", "MEDIUM")
            sev_color = {"CRITICAL": RED_VIOL, "HIGH": RED_VIOL,
                         "MEDIUM": AMBER_WARN, "LOW": GRAY_MED}.get(sev, GRAY_MED)
            st = v.get("status", "VIOLATION")
            st_sty = S["cell_fail"] if st == "VIOLATION" else S["cell_warn"]
            field_code = v.get("field_code") or "—"
            _, legal_ref = FIELD_LABEL_MAP.get(field_code, (field_code, "—"))
            viol_rows.append([
                Paragraph(str(i), S["cell_value"]),
                Paragraph(
                    f'<font color="{sev_color.hexval()}">{sev}</font>',
                    ParagraphStyle("sv", fontName="Helvetica-Bold", fontSize=8.5, leading=11)
                ),
                Paragraph(f"{field_code}<br/><font size='7' color='gray'>{legal_ref}</font>",
                          S["body_small"]),
                Paragraph(str(v.get("ai_raw_value") or "—")[:80], S["cell_value"]),
                Paragraph(str(v.get("message") or "—")[:200], S["cell_value"]),
                Paragraph(st, st_sty),
            ])

        viol_col_w = [0.7 * cm, 2 * cm, 3.3 * cm, 3.5 * cm, 5.5 * cm, 2 * cm]
        viol_tbl = Table(viol_rows, colWidths=viol_col_w, repeatRows=1)
        viol_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), RED_VIOL),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, 0), 8.5),
            ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#fecaca")),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, colors.HexColor("#fff5f5")]),
        ]))
        story.append(viol_tbl)

    story.append(Spacer(1, 0.6 * cm))

    # ─────────────────────────────────────────────────────────
    # SECTION 6 — QR Code + Officer Signature Block
    # ─────────────────────────────────────────────────────────
    verify_url = f"https://sih-project-web.vercel.app/dashboard/inspections/{inspection_id}"
    qr_img = _build_qr(verify_url, size=80)

    sig_content = Paragraph(
        "<b>Authorised Inspecting Officer</b><br/><br/><br/><br/>"
        f"Name: {inspection_data.get('inspector_name', '________________')}<br/>"
        f"Designation: Legal Metrology Inspector<br/>"
        f"Organisation: {inspection_data.get('organisation', '________________')}<br/>"
        "Date: ________________<br/>"
        "Seal / Stamp: ________________",
        ParagraphStyle("sig", fontName="Helvetica", fontSize=8.5, leading=14)
    )

    qr_caption = Paragraph(
        "<b>Scan to Verify</b><br/>"
        f"<font name='Courier' size='6'>{verify_url[:50]}…</font>",
        ParagraphStyle("qrc", fontName="Helvetica", fontSize=7.5, leading=11, alignment=TA_CENTER)
    )

    bottom_data = [[sig_content, "", [qr_img, qr_caption]]]
    bottom_tbl = Table(bottom_data, colWidths=[10 * cm, 2 * cm, 5.3 * cm])
    bottom_tbl.setStyle(TableStyle([
        ("VALIGN",  (0, 0), (-1, -1), "TOP"),
        ("ALIGN",   (2, 0), (2, -1), "CENTER"),
        ("BOX",     (0, 0), (0, 0), 0.5, GRAY_MED),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
    ]))
    story.append(KeepTogether([
        Paragraph("CERTIFICATION & QR VERIFICATION", S["section_h"]),
        ColoredLine(usable_w, GOLD, thickness=1),
        Spacer(1, 0.2 * cm),
        bottom_tbl,
    ]))
    story.append(Spacer(1, 0.5 * cm))

    # ─────────────────────────────────────────────────────────
    # SECTION 7 — Disclaimer Footer
    # ─────────────────────────────────────────────────────────
    story.append(ColoredLine(usable_w, colors.HexColor("#cbd5e1"), thickness=0.5))
    story.append(Spacer(1, 0.15 * cm))
    story.append(Paragraph(
        "DISCLAIMER: This notice has been generated by the METRA AI-Assisted Legal Metrology "
        "Inspection System using Gemini Vision OCR and a deterministic rule engine aligned with "
        "the Legal Metrology (Packaged Commodities) Rules, 2011. The findings are subject to "
        "supervisory review by a qualified Legal Metrology Officer under Section 15 of the Legal "
        "Metrology Act, 2009. This document does not constitute a final enforcement order.",
        S["disclaimer"],
    ))
    story.append(Spacer(1, 0.1 * cm))
    story.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}  |  "
        f"Notice Ref: {notice_num}  |  System: METRA v0.1.0  |  "
        "Legal Metrology Act, 2009 & PCR 2011",
        S["footer"],
    ))

    doc.build(story)
    return buf.getvalue()


async def generate_and_upload_report(
    inspection_id: str,
    inspection_data: dict,
    user_id: str,
    supabase_url: str,
    supabase_key: str,
    report_bucket: str,
) -> dict:
    """
    Generates the PDF, uploads to Supabase, saves Report row, returns {report_id, download_url}.
    """
    from supabase import create_client
    from app.core.database import AsyncSessionLocal
    from app.core.models import Report

    logger.info(f"Generating PDF report for inspection {inspection_id}")
    pdf_bytes = generate_inspection_certificate(inspection_id, inspection_data)

    report_id = str(uuid.uuid4())
    storage_key = f"reports/{inspection_id}/{report_id}.pdf"

    supabase = create_client(supabase_url, supabase_key)
    supabase.storage.from_(report_bucket).upload(
        path=storage_key,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf"},
    )
    logger.info(f"PDF uploaded to {report_bucket}/{storage_key}")

    signed = supabase.storage.from_(report_bucket).create_signed_url(storage_key, 3600)
    download_url = signed.get("signedURL") or signed.get("signedUrl") or ""

    async with AsyncSessionLocal() as db:
        report = Report(
            id=report_id,
            inspection_id=inspection_id,
            storage_key=storage_key,
            generated_by=user_id,
            file_size_bytes=len(pdf_bytes),
        )
        db.add(report)
        await db.commit()

    logger.info(f"Report {report_id} saved to DB for inspection {inspection_id}")
    return {"report_id": report_id, "download_url": download_url, "storage_key": storage_key}
