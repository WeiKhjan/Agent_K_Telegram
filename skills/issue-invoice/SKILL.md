---
name: issue-invoice
description: Create, issue, or generate invoices for AiTraining2U PLT. Use when asked to invoice a client, bill someone, create a quotation, or generate payment documents.
---

# Issue Invoice

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
| Invoice date | Default: today | Only default if user doesn't specify |

**Rules:**
- If any required field is missing, **stop and ask the user** before proceeding
- Do not invent, estimate, or carry over details from a previous invoice
- Confirm ambiguous amounts (e.g. "is RM3,000 per pax or total?") before proceeding
- SST: apply 8% only if invoice date ≥ 1 March 2026; otherwise no SST
- If client is SST-exempt (e.g. same SST group), set `sst_exemption_note` to the legal basis (e.g. "Exempted under Service Tax (Persons Exempted from Payment of Tax) Order 2018")
- Always collect client SST registration number (`client_sst_no`) if they are SST-registered

### 2. Get Next Invoice Number
```python
import sqlite3, os
DB = os.path.expanduser("~/invoices.db")
conn = sqlite3.connect(DB)
c = conn.cursor()
year = 2026  # use current year
c.execute("UPDATE invoice_sequence SET last_no = last_no + 1 WHERE year = ?", (year,))
c.execute("SELECT last_no FROM invoice_sequence WHERE year = ?", (year,))
n = c.fetchone()[0]
conn.commit(); conn.close()
invoice_no = f"INV-ATU-{year}-{n:04d}"
```

### 3. Insert into DB
```python
year = invoice_date[:4]
pdf_path = os.path.expanduser(f"~/Documents/AiTraining2U/Invoices/{year}/{invoice_no}.pdf")

conn = sqlite3.connect(DB)
c = conn.cursor()
c.execute("""
INSERT INTO invoices
  (invoice_no, invoice_date, due_date, client_company, client_attn,
   client_email, client_tel, client_address, client_sst_no, sst_exemption_note,
   subtotal, sst_rate, sst_amount, total, pdf_path)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
""", (invoice_no, invoice_date, "Upon Receipt", client_company, client_attn,
      client_email, client_tel, client_address, client_sst_no, sst_exemption_note,
      subtotal, sst_rate, sst_amount, total, pdf_path))

for i, item in enumerate(items):
    c.execute("""
    INSERT INTO invoice_items (invoice_no, item_no, description, qty, unit_price, amount)
    VALUES (?,?,?,?,?,?)
    """, (invoice_no, i+1, item["description"], item["qty"], item["unit_price"], item["amount"]))

conn.commit(); conn.close()
```

### 4. Generate PDF
```bash
~/.local/bin/uv run --with reportlab python3 \
  ~/Agent_K_Telegram/skills/issue-invoice/scripts/build_pdf.py INV-ATU-YYYY-XXXX
```
- PDF saves to `~/Documents/AiTraining2U/Invoices/{YYYY}/{invoice_no}_{Company-Slug}.pdf`
- Company slug: strip legal suffixes (Sdn Bhd, PLT, Berhad, Ltd), spaces → hyphens (e.g. `Vynn-Capital`, `Kumpulan-Modal-Perdana`)
- Year subfolder auto-created
- **Script overwrites any existing file with the same invoice number** — only the final copy is kept

### 5. Deliver

**A. Telegram** — send PDF to the channel the user is interacting from:
- User in **Telegram group** → send to group `$TELEGRAM_GROUP_CHAT_ID`
- User in **Telegram DM or Claude Code / terminal** → send to DM `$TELEGRAM_DM_CHAT_ID`
- Caption: invoice no., client, description, total
- Then explicitly ask: **"Please review the invoice. Reply 'send', 'ok go ahead', or 'email it' to send to client."**
- **Do NOT proceed to email until user explicitly approves**

**B. Email to client** — ONLY after user confirms (e.g. "ok send", "go ahead", "email it", "send to client"):
- **To:** client email (from invoice)
- **CC (always):** recipients from `$CC_EMAILS` (comma-separated)
- **Subject:** `Invoice {invoice_no} | {workshop/service name} – AiTraining2U PLT`
- **Attachment:** PDF from `~/Documents/AiTraining2U/Invoices/{YYYY}/{invoice_no}_{Company-Slug}.pdf`
- **Body:** Professional HTML email (dark blue header matching invoice style) covering:
  - Greeting with client attn name
  - Invoice summary table (invoice no, date, description, total, payment terms)
  - Payment instructions block (from env vars `$BANK_NAME` / `$BANK_ACCT_NAME` / `$BANK_ACCT_NO`)
  - Request to use invoice number as payment reference
  - Sign-off: `$COMPANY_CONTACT_NAME`, `$COMPANY_NAME`, `$COMPANY_EMAIL`
- **ALWAYS send via the custom script** (NOT Gmail MCP — MCP strips the display name from From header):
  ```bash
  ~/.local/bin/uv run --with google-api-python-client --with google-auth \
    python3 ~/Agent_K_Telegram/skills/send-email/scripts/send_email.py \
    --to CLIENT_EMAIL \
    --cc $CC_EMAILS \
    --subject "SUBJECT" \
    --attach PATH_TO_PDF \
    --html 'HTML_BODY_STRING'
  ```
  This ensures the From header shows: **Atlas (AiTraining2U) &lt;atlas.aitraining2u@gmail.com&gt;**

> ⚠️ **NEVER email the client without explicit user approval. Always wait for confirmation after sending the PDF preview to Telegram.**

### File hygiene rules (STRICT)
- **Never save to `~/` root** — always use the `Invoices/{YYYY}/` folder
- **Never keep intermediate or draft PDFs** — if regenerating, the new file replaces the old one in-place
- **Never create `.xlsx` drafts** — PDF only, generated from `build_pdf.py`
- After sending via Telegram, **no cleanup needed** — the file in `Invoices/{YYYY}/` is the master copy

---

## Issuer Details (from environment variables — never change without user instruction)
- **Company:** `$COMPANY_NAME`
- **Reg No:** `$COMPANY_REG`
- **SST No:** `$COMPANY_SST_NO` (always show on invoice)
- **Address:** `$COMPANY_ADDRESS`
- **Contact:** `$COMPANY_CONTACT_NAME`
- **Email:** `$COMPANY_EMAIL`
- **Bank:** `$BANK_NAME` | `$BANK_ACCT_NAME` | `$BANK_ACCT_NO`
- **Payment Terms:** 7 Days Upon Receipt

## Invoice Number Format
`INV-ATU-YYYY-XXXX` — sequential per year, managed via `~/invoices.db` table `invoice_sequence`

## SST Rules
- Invoice date < 1 Mar 2026 → **no SST**
- Invoice date ≥ 1 Mar 2026 → **8% SST** on subtotal
- If exempt (e.g. same SST group): set `sst_rate=0.08`, `sst_amount=0`, `sst_exemption_note` = legal basis
- Always show client's SST registration number in `client_sst_no` if available

## Database
- Path: `~/invoices.db`
- Tables: `invoices`, `invoice_items`, `invoice_sequence`
- Setup script: `~/Agent_K_Telegram/skills/issue-invoice/scripts/setup_db.py` (run once if DB missing)

## Accounting Fields (invoices table)
| Field | Notes |
|---|---|
| status | `issued` / `paid` / `void` |
| subtotal | before SST |
| sst_rate | 0.0 or 0.08 |
| sst_amount | computed |
| client_sst_no | client's SST registration number |
| sst_exemption_note | legal basis if exempted (e.g. "Exempted under Service Tax (Persons Exempted from Payment of Tax) Order 2018") |
| total | final payable |
| pdf_path | local file path |
