#!/usr/bin/env python3
"""AiTraining2U Invoice PDF Generator — reads from DB, generates PDF"""

import sqlite3, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                 Paragraph, Spacer, HRFlowable)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

DB_PATH  = os.path.expanduser("~/invoices.db")
OUT_DIR  = os.path.expanduser("~/Documents/AiTraining2U/Invoices")

# ── Accept invoice_no as arg, else use latest ─────────────────────────────────
invoice_no = sys.argv[1] if len(sys.argv) > 1 else None

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

if invoice_no:
    c.execute("SELECT * FROM invoices WHERE invoice_no=?", (invoice_no,))
else:
    c.execute("SELECT * FROM invoices ORDER BY id DESC LIMIT 1")
inv = c.fetchone()
if not inv:
    print("Invoice not found"); sys.exit(1)

c.execute("SELECT * FROM invoice_items WHERE invoice_no=? ORDER BY item_no", (inv["invoice_no"],))
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
BANK = {
    "name":      _req("BANK_NAME"),
    "acct_name": _req("BANK_ACCT_NAME"),
    "acct_no":   _req("BANK_ACCT_NO"),
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

# Parse date to display format
from datetime import datetime
raw_date = inv["invoice_date"]
try:
    display_date = datetime.strptime(raw_date, "%Y-%m-%d").strftime("%-d %B %Y")
except:
    display_date = raw_date

# Parse address
addr_lines = inv["client_address"].split(", ") if inv["client_address"] else []

year_dir = os.path.join(OUT_DIR, str(inv["invoice_date"][:4]))
os.makedirs(year_dir, exist_ok=True)

# Build filename: INV-ATU-2026-0032_Vynn-Capital.pdf
import re
def company_slug(name):
    # Strip legal suffixes, slugify
    name = re.sub(r'\b(Sdn\.?\s*Bhd\.?|PLT|Berhad|Bhd\.?|Pte\.?\s*Ltd\.?|Ltd\.?)\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[^\w\s-]', '', name).strip()
    name = re.sub(r'\s+', '-', name)
    return re.sub(r'-+', '-', name).strip('-')

slug = company_slug(inv["client_company"])
filename = f"{inv['invoice_no']}_{slug}.pdf"

# Remove any old file for this invoice (different slug / stray in root)
for old in [
    os.path.expanduser(f"~/{inv['invoice_no']}.pdf"),
    os.path.join(year_dir, f"{inv['invoice_no']}.pdf"),
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
s_pay_hdr = S("pay_hdr",fontSize=8,  textColor=DARK_BLUE,  fontName="Helvetica-Bold", leading=10)
s_pay     = S("pay",    fontSize=8.5, textColor=TEXT,       fontName="Helvetica", leading=12)
s_pay_b   = S("pay_b",  fontSize=8.5, textColor=TEXT,      fontName="Helvetica-Bold", leading=12)
s_footer  = S("footer", fontSize=8,  textColor=SUBTEXT,    fontName="Helvetica-Oblique", alignment=TA_CENTER, leading=11)
s_footer2 = S("ftr2",   fontSize=7.5,textColor=HexColor("#AAAAAA"), fontName="Helvetica", alignment=TA_CENTER, leading=10)

story = []

# ── Header ────────────────────────────────────────────────────────────────────
left_top = [
    Paragraph(ISSUER["name"], s_co_name),
    Paragraph(ISSUER["address"], s_co_sub),
    Paragraph(f"Reg. No: {ISSUER['reg']}  \u2022  SST No: {ISSUER['sst_no']}", s_co_sub),
    Paragraph(f"Contact: {ISSUER['contact']}  \u2022  {ISSUER['email']}", s_co_sub),
]
right_top = [
    Paragraph("INVOICE", s_inv_ttl),
    Paragraph(f"Invoice No:  {inv['invoice_no']}", s_inv_sub),
    Paragraph(f"Date:  {display_date}", s_inv_sub),
    Paragraph(f"Payment Terms:  {inv['due_date']}", s_inv_sub),
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

# ── Bill To ───────────────────────────────────────────────────────────────────
lbl = Table([[Paragraph("BILL TO", s_section)]], colWidths=[W])
lbl.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.75,MED_BLUE),
    ("BOTTOMPADDING",(0,0),(-1,-1),2),("TOPPADDING",(0,0),(-1,-1),0),
    ("LEFTPADDING",(0,0),(-1,-1),0)]))
story += [lbl, Spacer(1,2*mm),
          Paragraph(inv["client_company"], s_client)]
if inv["client_attn"]:
    story.append(Paragraph(f"Attn: {inv['client_attn']}", s_addr))

# Smart address split: try ", " splits into 3 lines for readability
addr = inv["client_address"] or ""
# Split on commas to get nice lines
parts = [p.strip() for p in addr.split(",")]
# Group into max 3 display lines
if len(parts) >= 4:
    lines = [parts[0], ", ".join(parts[1:3]), ", ".join(parts[3:])]
elif len(parts) == 3:
    lines = parts
else:
    lines = [addr]
for ln in lines:
    if ln: story.append(Paragraph(ln, s_addr))

if inv["client_sst_no"]:
    story.append(Paragraph(f"SST No: {inv['client_sst_no']}", s_addr))
tel_email = []
if inv["client_tel"]:  tel_email.append(f"Tel: {inv['client_tel']}")
if inv["client_email"]:tel_email.append(f"Email: {inv['client_email']}")
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
    # Try to split description for sub-line
    desc = it["description"]
    # If description has comma, split first part as title, rest as sub
    if ", " in desc and len(desc) > 45:
        comma_idx = desc.find(", ", 30)
        main = desc[:comma_idx] if comma_idx > 0 else desc
        sub  = desc[comma_idx+2:] if comma_idx > 0 else ""
    else:
        main, sub = desc, ""

    cell = [Paragraph(main, s_item)]
    if sub: cell.append(Paragraph(sub, s_item_sub))

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
totals.append([Paragraph("Subtotal", s_stot), Paragraph(fmt(inv["subtotal"]), s_stot)])
if inv["sst_amount"] and inv["sst_amount"] > 0:
    totals.append([Paragraph(f"SST ({int(inv['sst_rate']*100)}%)", s_stot),
                   Paragraph(fmt(inv["sst_amount"]), s_stot)])
else:
    sst_note = inv["sst_exemption_note"] if inv["sst_exemption_note"] else "Exempted"
    totals.append([Paragraph(f"Service Tax @ 8%: {sst_note}", s_stot), Paragraph(fmt(0), s_stot)])
totals.append([Paragraph("TOTAL (RM)", s_total_l), Paragraph(fmt(inv["total"]), s_total_r)])

ttbl = Table(totals, colWidths=TW)
ts = [("ALIGN",(0,0),(-1,-1),"RIGHT"),
      ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
      ("BACKGROUND",(0,-1),(-1,-1),DARK_BLUE),
      ("TOPPADDING",(0,-1),(-1,-1),7),("BOTTOMPADDING",(0,-1),(-1,-1),7),]
if len(totals) > 1:
    ts += [("TOPPADDING",(0,0),(-1,-2),4),("BOTTOMPADDING",(0,0),(-1,-2),4),
           ("LINEABOVE",(0,-1),(-1,-1),1,HexColor("#AAAAAA"))]
ttbl.setStyle(TableStyle(ts))
story += [ttbl, Spacer(1,8*mm)]

# ── Payment Details ───────────────────────────────────────────────────────────
plbl = Table([[Paragraph("PAYMENT DETAILS", s_pay_hdr)]], colWidths=[W])
plbl.setStyle(TableStyle([("LINEBELOW",(0,0),(-1,-1),0.75,MED_BLUE),
    ("BOTTOMPADDING",(0,0),(-1,-1),2),("TOPPADDING",(0,0),(-1,-1),0),
    ("LEFTPADDING",(0,0),(-1,-1),0)]))
story += [plbl, Spacer(1,2*mm)]

pay_rows = [["Bank",":",BANK["name"]],
            ["Account Name",":",BANK["acct_name"]],
            ["Account No.",":",BANK["acct_no"]]]
ptbl = Table([[Paragraph(r[0],s_pay),Paragraph(r[1],s_pay),
               Paragraph(r[2],s_pay_b if r[0]=="Account No." else s_pay)]
              for r in pay_rows],
             colWidths=[32*mm,5*mm,W-37*mm])
ptbl.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,-1),2),
    ("BOTTOMPADDING",(0,0),(-1,-1),2),
    ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
story += [ptbl, Spacer(1,10*mm)]

# ── Footer ────────────────────────────────────────────────────────────────────
story += [HRFlowable(width="100%",thickness=0.5,color=HexColor("#CCCCCC"),spaceBefore=2),
          Spacer(1,3*mm),
          Paragraph("Thank you for your business!", s_footer),
          Paragraph("This is a computer-generated invoice. No signature required.", s_footer2)]

doc.build(story)
print(f"PDF: {OUT}")
