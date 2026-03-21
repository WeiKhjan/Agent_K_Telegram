---
name: issue-quotation
description: Create, issue, or generate quotations for AiTraining2U PLT. Use when asked to prepare a quotation, quote a client, create a price quote, prepare a proposal quote, or generate a quotation document.
---

# Issue Quotation

## Workflow

### 1. Gather Details
Required fields — **ask the user for anything missing, do not assume or fill in yourself**:

| Field | Required | Notes |
|---|---|---|
| Client company name | ✅ Must ask | Never guess |
| Attn (contact person) | ✅ Must ask | Never guess |
| Client address | ✅ Must ask | Never guess |
| Client tel | ✅ Must ask | Never guess |
| Client email | ✅ Must ask | Never guess |
| Line item description | ✅ Must ask | Never guess |
| Qty | ✅ Must ask | Never guess |
| Unit price (RM) | ✅ Must ask | Never guess |
| Quotation date | Default: today | Only default if user doesn't specify |
| Valid until | Default: 30 days from quotation date | Only default if user doesn't specify |

**Rules:**
- If any required field is missing, **stop and ask the user** before proceeding
- Do not invent, estimate, or carry over details from a previous quotation
- Confirm ambiguous amounts (e.g. "is RM3,000 per pax or total?") before proceeding
- SST: apply 8% only if quotation date ≥ 1 March 2026; otherwise no SST
- If client is SST-exempt (e.g. same SST group), set `sst_exemption_note` to the legal basis
- Always collect client SST registration number (`client_sst_no`) if they are SST-registered

### 2. Get Next Quotation Number
```python
import sqlite3, os
DB = os.path.expanduser("~/quotations.db")
conn = sqlite3.connect(DB)
c = conn.cursor()
year = 2026  # use current year
c.execute("UPDATE quotation_sequence SET last_no = last_no + 1 WHERE year = ?", (year,))
c.execute("SELECT last_no FROM quotation_sequence WHERE year = ?", (year,))
n = c.fetchone()[0]
conn.commit(); conn.close()
quotation_no = f"QUO-ATU-{year}-{n:04d}"
```

### 3. Insert into DB
```python
year = quotation_date[:4]
pdf_path = os.path.expanduser(f"~/Documents/AiTraining2U/Quotations/{year}/{quotation_no}.pdf")

conn = sqlite3.connect(DB)
c = conn.cursor()
c.execute("""
INSERT INTO quotations
  (quotation_no, quotation_date, valid_until, client_company, client_attn,
   client_email, client_tel, client_address, client_sst_no, sst_exemption_note,
   subtotal, sst_rate, sst_amount, total, pdf_path)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
""", (quotation_no, quotation_date, valid_until, client_company, client_attn,
      client_email, client_tel, client_address, client_sst_no, sst_exemption_note,
      subtotal, sst_rate, sst_amount, total, pdf_path))

for i, item in enumerate(items):
    c.execute("""
    INSERT INTO quotation_items (quotation_no, item_no, description, qty, unit_price, amount)
    VALUES (?,?,?,?,?,?)
    """, (quotation_no, i+1, item["description"], item["qty"], item["unit_price"], item["amount"]))

conn.commit(); conn.close()
```

### 4. Generate PDF
```bash
~/.local/bin/uv run --with reportlab python3 \
  ~/Agent_K_Telegram/skills/issue-quotation/scripts/build_pdf.py QUO-ATU-YYYY-XXXX
```
- PDF saves to `~/Documents/AiTraining2U/Quotations/{YYYY}/{quotation_no}_{Company-Slug}.pdf`
- ⚠️ **ReportLab XML escaping**: `Paragraph()` parses content as XML — any `&`, `<`, `>` in raw strings will corrupt output. The `build_pdf.py` script handles this via the `esc()` helper; do not bypass it.
- Company slug: strip legal suffixes (Sdn Bhd, PLT, Berhad, Ltd), spaces → hyphens
- Year subfolder auto-created
- **Script overwrites any existing file with the same quotation number**

### 5. Deliver

**A. Telegram** — send PDF to the channel the user is interacting from:
- User in **Telegram group** → send to group `$TELEGRAM_GROUP_CHAT_ID`
- User in **Telegram DM or Claude Code / terminal** → send to DM `$TELEGRAM_DM_CHAT_ID`
- Caption: quotation no., client, description, total
- Then explicitly ask: **"Please review the quotation. Reply 'send', 'ok go ahead', or 'email it' to send to client."**
- **Do NOT proceed to email until user explicitly approves**

**B. Email to client** — ONLY after user confirms:
- **To:** client email (from quotation)
- **CC (always):** recipients from `$CC_EMAILS` (comma-separated)
- **Subject:** `Quotation {quotation_no} | {workshop/service name} – AiTraining2U PLT`
- **Attachment:** PDF from `~/Documents/AiTraining2U/Quotations/{YYYY}/{quotation_no}_{Company-Slug}.pdf`
- **Body:** Professional HTML email (dark blue header matching quotation style) covering:
  - Greeting with client attn name
  - Quotation summary table (quotation no, date, valid until, description, total)
  - Note that quotation is valid until the stated date
  - Sign-off: `$COMPANY_CONTACT_NAME`, `$COMPANY_NAME`, `$COMPANY_EMAIL`
- **ALWAYS send via the custom script** (NOT Gmail MCP):
  ```bash
  ~/.local/bin/uv run --with google-api-python-client --with google-auth \
    python3 ~/Agent_K_Telegram/skills/send-email/scripts/send_email.py \
    --to CLIENT_EMAIL \
    --cc $CC_EMAILS \
    --subject "SUBJECT" \
    --attach PATH_TO_PDF \
    --html 'HTML_BODY_STRING'
  ```

> ⚠️ **NEVER email the client without explicit user approval. Always wait for confirmation after sending the PDF preview to Telegram.**

### File hygiene rules (STRICT)
- **Never save to `~/` root** — always use the `Quotations/{YYYY}/` folder
- **Never keep intermediate or draft PDFs** — regeneration replaces in-place
- **Never create `.xlsx` drafts** — PDF only, generated from `build_pdf.py`

---

## Issuer Details (from environment variables — never change without user instruction)
- **Company:** `$COMPANY_NAME`
- **Reg No:** `$COMPANY_REG`
- **SST No:** `$COMPANY_SST_NO` (always show on quotation)
- **Address:** `$COMPANY_ADDRESS`
- **Contact:** `$COMPANY_CONTACT_NAME`
- **Email:** `$COMPANY_EMAIL`

## Quotation Number Format
`QUO-ATU-YYYY-XXXX` — sequential per year, managed via `~/quotations.db` table `quotation_sequence`

## SST Rules
- Quotation date < 1 Mar 2026 → **no SST**
- Quotation date ≥ 1 Mar 2026 → **8% SST** on subtotal
- If exempt: set `sst_rate=0.08`, `sst_amount=0`, `sst_exemption_note` = legal basis
- Always show client's SST registration number if available

## Database
- Path: `~/quotations.db`
- Tables: `quotations`, `quotation_items`, `quotation_sequence`
- Setup script: `~/Agent_K_Telegram/skills/issue-quotation/scripts/setup_db.py` (run once if DB missing)

## Accounting Fields (quotations table)
| Field | Notes |
|---|---|
| status | `draft` / `sent` / `accepted` / `rejected` / `void` |
| subtotal | before SST |
| sst_rate | 0.0 or 0.08 |
| sst_amount | computed |
| client_sst_no | client's SST registration number |
| sst_exemption_note | legal basis if exempted |
| total | final amount quoted |
| valid_until | quotation expiry date |
| pdf_path | local file path |
