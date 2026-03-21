#!/usr/bin/env python3
"""AiTraining2U Quotation PDF Generator — reads from DB, generates PDF"""

import sqlite3, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                 Paragraph, Spacer, HRFlowable)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

DB_PATH  = os.path.expanduser("~/quotations.db")
OUT_DIR  = os.path.expanduser("~/Documents/AiTraining2U/Quotations")

# ── Accept quotation_no as arg, else use latest ───────────────────────────────
quotation_no = sys.argv[1] if len(sys.argv) > 1 else None

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

if quotation_no:
    c.execute("SELECT * FROM quotations WHERE quotation_no=?", (quotation_no,))
else:
    c.execute("SELECT * FROM quotations ORDER BY id DESC LIMIT 1")
quo = c.fetchone()
if not quo:
    print("Quotation not found"); sys.exit(1)

c.execute("SELECT * FROM quotation_items WHERE quotation_no=? ORDER BY item_no", (quo["quotation_no"],))
items = c.fetchall()
conn.close()

# ── Config ────────────────────────────────────────────────────────────────────
def _req(var):
    v = os.environ.get(var)
    if not v:
        print(f"ERROR: {var} not set"); sys.exit(1)
    return v

ISSUER = {
    "name":    _req("COMPANY_NAME"),
    "reg":     _req("COMPANY_REG"),
    "sst_no":  _req("COMPANY_SST_NO"),
    "contact": _req("COMPANY_CONTACT_NAME"),
    "email":   _req("COMPANY_EMAIL"),
    "address": _req("COMPANY_ADDRESS"),
}

DARK_BLUE  = HexColor("#1A3C5E")
MED_BLUE   = HexColor("#2E86AB")
LIGHT_GRAY = HexColor("#F4F4F4")
TEXT       = HexColor("#2C2C2C")
SUBTEXT    = HexColor("#666666")
WHITE      = white

# ── Helpers ───────────────────────────────────────────────────────────────────
def S(name, **kw):
    return ParagraphStyle(name, parent=getSampleStyleSheet()["Normal"], **kw)

def fmt(v): return f"RM {v:,.2f}"

def esc(s): return (s or "").replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# Parse date to display format
from datetime import datetime, timedelta
raw_date = quo["quotation_date"]
try:
    display_date = datetime.strptime(raw_date, "%Y-%m-%d").strftime("%-d %B %Y")
except:
    display_date = raw_date

# Parse valid_until
raw_valid = quo["valid_until"]
if raw_valid:
    try:
        display_valid = datetime.strptime(raw_valid, "%Y-%m-%d").strftime("%-d %B %Y")
    except:
        display_valid = raw_valid
else:
    display_valid = "30 days from quotation date"

year_dir = os.path.join(OUT_DIR, str(quo["quotation_date"][:4]))
os.makedirs(year_dir, exist_ok=True)

# Build filename: QUO-ATU-2026-0001_Vynn-Capital.pdf
import re
def company_slug(name):
    name = re.sub(r'\b(Sdn\.?\s*Bhd\.?|PLT|Berhad|Bhd\.?|Pte\.?\s*Ltd\.?|Ltd\.?)\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[^\w\s-]', '', name).strip()
    name = re.sub(r'\s+', '-', name)
    return re.sub(r'-+', '-', name).strip('-')

slug = company_slug(quo["client_company"])
filename = f"{quo['quotation_no']}_{slug}.pdf"

# Remove any old file for this quotation
for old in [
    os.path.expanduser(f"~/{quo['quotation_no']}.pdf"),
    os.path.join(year_dir, f"{quo['quotation_no']}.pdf"),
]:
    if os.path.exists(old) and old != os.path.join(year_dir, filename):
        os.remove(old)

OUT = os.path.join(year_dir, filename)
doc = SimpleDocTemplate(OUT, pagesize=A4,
    leftMargin=16*mm, rightMargin=16*mm,
    topMargin=14*mm, bottomMargin=14*mm)
W = A4[0] - 32*mm

s_co_name = S("co_name", fontSize=22, textColor=DARK_BLUE, fontName="Helvetica-Bold", leading=26)
s_co_sub  = S("co_sub",  fontSize=8.5, textColor=SUBTEXT,  fontName="Helvetica", leading=12)
s_inv_ttl = S("inv_ttl", fontSize=26, textColor=DARK_BLUE, fontName="Helvetica-Bold", alignment=TA_RIGHT, leading=30)
s_inv_sub = S("inv_sub", fontSize=8.5, textColor=SUBTEXT,  fontName="Helvetica", alignment=TA_RIGHT, leading=12)
s_section = S("section", fontSize=8,  textColor=DARK_BLUE, fontName="Helvetica-Bold", leading=10)
s_client  = S("client",  fontSize=10, textColor=TEXT,      fontName="Helvetica-Bold", leading=14)
s_addr    = S("addr",    fontSize=8.5, textColor=TEXT,     fontName="Helvetica", leading=12)
s_addr_sm = S("addr_sm", fontSize=8.5, textColor=SUBTEXT,  fontName="Helvetica", leading=11)
s_item    = S("item",    fontSize=9,  textColor=TEXT,       fontName="Helvetica-Bold", leading=12)
s_item_sub= S("item_sub",fontSize=8.5,textColor=SUBTEXT,   fontName="Helvetica-Oblique", leading=11)
s_cell_r  = S("cell_r",  fontSize=9, textColor=TEXT,        fontName="Helvetica", alignment=TA_RIGHT, leading=12)
s_cell_c  = S("cell_c",  fontSize=9, textColor=TEXT,        fontName="Helvetica", alignment=TA_CENTER, leading=12)
s_total_l = S("tot_l",  fontSize=10.5, textColor=WHITE,    fontName="Helvetica-Bold", alignment=TA_RIGHT, leading=13)
s_total_r = S("tot_r",  fontSize=10.5, textColor=WHITE,    fontName="Helvetica-Bold", alignment=TA_RIGHT, leading=13)
s_stot    = S("stot",   fontSize=9,  textColor=TEXT,        fontName="Helvetica", alignment=TA_RIGHT, leading=12)
s_footer  = S("footer", fontSize=8,  textColor=SUBTEXT,    fontName="Helvetica-Oblique", alignment=TA_CENTER, leading=11)
s_footer2 = S("ftr2",   fontSize=7.5,textColor=HexColor("#AAAAAA"), fontName="Helvetica", alignment=TA_CENTER, leading=10)

story = []

# ── Header ────────────────────────────────────────────────────────────────────
left_top = [
    Paragraph(esc(ISSUER["name"]), s_co_name),
    Paragraph(esc(ISSUER["address"]), s_co_sub),
    Paragraph(f"Reg. No: {esc(ISSUER['reg'])}  \u2022  SST No: {esc(ISSUER['sst_no'])}", s_co_sub),
    Paragraph(f"Contact: {esc(ISSUER['contact'])}  \u2022  {esc(ISSUER['email'])}", s_co_sub),
]
right_top = [
    Paragraph("QUOTATION", s_inv_ttl),
    Paragraph(f"Quotation No:  {quo['quotation_no']}", s_inv_sub),
    Paragraph(f"Date:  {display_date}", s_inv_sub),
    Paragraph(f"Valid Until:  {display_valid}", s_inv_sub),
]
hdr = Table([[left_top, right_top]], colWidths=[W*0.55, W*0.45])
hdr.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
]))
story += [hdr, Spacer(1,5*mm),
          HRFlowable(width="100%",thickness=4,color=DARK_BLUE,spaceAfter=1),
          HRFlowable(width="100%",thickness=2,color=MED_BLUE,spaceAfter=4*mm)]

# ── Quote To ──────────────────────────────────────────────────────────────────
lbl = Table([[Paragraph("QUOTE TO", s_section)]], colWidths=[W])
lbl.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.75,MED_BLUE),
    ("BOTTOMPADDING",(0,0),(-1,-1),2),("TOPPADDING",(0,0),(-1,-1),0),
    ("LEFTPADDING",(0,0),(-1,-1),0)]))
story += [lbl, Spacer(1,2*mm),
          Paragraph(esc(quo["client_company"]), s_client)]
if quo["client_attn"]:
    story.append(Paragraph(f"Attn: {esc(quo['client_attn'])}", s_addr))

addr = quo["client_address"] or ""
parts = [p.strip() for p in addr.split(",")]
if len(parts) >= 4:
    lines = [parts[0], ", ".join(parts[1:3]), ", ".join(parts[3:])]
elif len(parts) == 3:
    lines = parts
else:
    lines = [addr]
for ln in lines:
    if ln: story.append(Paragraph(esc(ln), s_addr))

if quo["client_sst_no"]:
    story.append(Paragraph(f"SST No: {esc(quo['client_sst_no'])}", s_addr))
tel_email = []
if quo["client_tel"]:  tel_email.append(f"Tel: {esc(quo['client_tel'])}")
if quo["client_email"]:tel_email.append(f"Email: {esc(quo['client_email'])}")
if tel_email:
    story.append(Paragraph("   \u2022   ".join(tel_email), s_addr_sm))
story.append(Spacer(1,6*mm))

# ── Items Table ───────────────────────────────────────────────────────────────
COL_W = [8*mm, W-8*mm-18*mm-28*mm-28*mm, 18*mm, 28*mm, 28*mm]

hdr_s = lambda txt, align=TA_RIGHT: Paragraph(txt, S("_", fontSize=9,
    textColor=WHITE, fontName="Helvetica-Bold", alignment=align))

tbl_data = [[
    "No.", "Description",
    hdr_s("Qty", TA_CENTER),
    hdr_s("Unit Price (RM)"),
    hdr_s("Amount (RM)"),
]]

for i, it in enumerate(items):
    desc = it["description"]
    if ", " in desc and len(desc) > 45:
        comma_idx = desc.find(", ", 30)
        main = desc[:comma_idx] if comma_idx > 0 else desc
        sub  = desc[comma_idx+2:] if comma_idx > 0 else ""
    else:
        main, sub = desc, ""

    cell = [Paragraph(esc(main), s_item)]
    if sub: cell.append(Paragraph(esc(sub), s_item_sub))

    tbl_data.append([
        Paragraph(str(i+1), s_cell_c),
        cell,
        Paragraph(str(it["qty"]), s_cell_c),
        Paragraph(f"{it['unit_price']:,.2f}", s_cell_r),
        Paragraph(f"{it['amount']:,.2f}", s_cell_r),
    ])

itbl = Table(tbl_data, colWidths=COL_W, repeatRows=1)
itbl.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),DARK_BLUE),
    ("TEXTCOLOR",(0,0),(-1,0),WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
    ("FONTSIZE",(0,0),(-1,0),9),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[HexColor("#FFFFFF"),LIGHT_GRAY]),
    ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
    ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
    ("LINEABOVE",(0,0),(-1,0),1.5,DARK_BLUE),
    ("LINEBELOW",(0,0),(-1,0),1.5,DARK_BLUE),
    ("LINEBELOW",(0,-1),(-1,-1),0.5,HexColor("#CCCCCC")),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("VALIGN",(1,1),(1,-1),"TOP"),
]))
story += [itbl, Spacer(1,3*mm)]

# ── Totals ────────────────────────────────────────────────────────────────────
TW = [W-60*mm, 60*mm]
totals = []
totals.append([Paragraph("Subtotal", s_stot), Paragraph(fmt(quo["subtotal"]), s_stot)])
if quo["sst_amount"] and quo["sst_amount"] > 0:
    totals.append([Paragraph(f"SST ({int(quo['sst_rate']*100)}%)", s_stot),
                   Paragraph(fmt(quo["sst_amount"]), s_stot)])
else:
    sst_note = quo["sst_exemption_note"] if quo["sst_exemption_note"] else "Exempted"
    totals.append([Paragraph(f"Service Tax @ 8%: {sst_note}", s_stot), Paragraph(fmt(0), s_stot)])
totals.append([Paragraph("TOTAL (RM)", s_total_l), Paragraph(fmt(quo["total"]), s_total_r)])

ttbl = Table(totals, colWidths=TW)
ts = [("ALIGN",(0,0),(-1,-1),"RIGHT"),
      ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
      ("BACKGROUND",(0,-1),(-1,-1),DARK_BLUE),
      ("TOPPADDING",(0,-1),(-1,-1),7),("BOTTOMPADDING",(0,-1),(-1,-1),7),]
if len(totals) > 1:
    ts += [("TOPPADDING",(0,0),(-1,-2),4),("BOTTOMPADDING",(0,0),(-1,-2),4),
           ("LINEABOVE",(0,-1),(-1,-1),1,HexColor("#AAAAAA"))]
ttbl.setStyle(TableStyle(ts))
story += [ttbl, Spacer(1,10*mm)]

# ── Footer ────────────────────────────────────────────────────────────────────
story += [HRFlowable(width="100%",thickness=0.5,color=HexColor("#CCCCCC"),spaceBefore=2),
          Spacer(1,3*mm),
          Paragraph("Thank you for considering our services!", s_footer),
          Paragraph("This is a computer-generated quotation. Prices are valid until the date stated above.", s_footer2)]

doc.build(story)
print(f"PDF: {OUT}")
