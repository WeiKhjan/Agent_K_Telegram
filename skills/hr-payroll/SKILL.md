---
name: hr-payroll
description: Create employment contracts, onboard new employees, issue internship agreements, or generate payslips for AiTraining2U PLT. Use when asked about contracts, hiring, onboarding, employee records, HR documents, or payslips.
---

# HR & Payroll

---

## Payslip Generation

### Script
```bash
/Users/aitraining2u/.local/share/office-venv/bin/python \
  ~/Agent_K_Telegram/skills/hr-payroll/generate_payslip.py \
  --month YYYY-MM \
  --out ~/
```

### Employee Data (edit `PAYSLIP_DATA` in the script each month)
| Field | Notes |
|---|---|
| `name` | Full legal name |
| `emp_id` | ATU-EMP-YYYY-XXXX |
| `position` | Job title |
| `basic` | Basic salary (RM) |
| `ot` | Overtime (RM, 0 if none) |
| `allowances` | List of `("Label", amount)` tuples |
| `pcb` | PCB/MTD (0 = pending) |

### Statutory Rates (auto-calculated)
| Contribution | Employee | Employer |
|---|---|---|
| EPF/KWSP | 11% of basic | 13% of basic (salary ≤ RM5,000) |
| SOCSO/PERKESO | 0.5% of gross (capped RM5k) | 1.75% |
| EIS/SIP | 0.4% of gross (capped RM5k) | 0.4% |
| PCB/MTD | As provided | — |

### Output
- One `.xlsx` file per employee: `Payslip_YYYY-MM_{FirstName}_{EmpID}.xlsx`
- Computer-generated — no signature required
- After generating, convert to PDF and deliver:
  - User in **Telegram group** → group `$TELEGRAM_GROUP_CHAT_ID`
  - User in **DM or terminal** → DM `$TELEGRAM_DM_CHAT_ID`

### Convert to PDF
```bash
/Users/aitraining2u/.local/share/office-venv/bin/python - <<'EOF'
import subprocess, glob, os
xlsx_files = glob.glob(os.path.expanduser("~/Payslip_*.xlsx"))
for f in xlsx_files:
    out = f.replace(".xlsx", ".pdf")
    subprocess.run([
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "--headless", "--convert-to", "pdf", "--outdir",
        os.path.dirname(f), f
    ], check=True)
    print(f"PDF: {out}")
EOF
```
If LibreOffice not available, use `openpyxl` output directly as `.xlsx` and send that.

---

# Employment Contract

## Contract Types Supported
- **Full-time** (permanent employment)
- **Contract** (fixed-term employment)
- **Internship** (student attachment / industrial training)

---

## Workflow

### 1. Gather Details — Ask for anything missing, NEVER guess

| Field | Full-time | Contract | Internship | Notes |
|---|---|---|---|---|
| Full legal name (as per NRIC) | ✅ | ✅ | ✅ | Must ask |
| NRIC / Passport No. | ✅ | ✅ | ✅ | Must ask |
| Nationality | ✅ | ✅ | ✅ | Default: Malaysian |
| Residential address | ✅ | ✅ | ✅ | Must ask |
| Personal email | ✅ | ✅ | ✅ | Must ask |
| Tel | ✅ | ✅ | ✅ | Must ask |
| Position / Job title | ✅ | ✅ | ✅ | Must ask |
| Department | ✅ | ✅ | ✅ | Must ask |
| Start date | ✅ | ✅ | ✅ | Must ask |
| End date | ❌ | ✅ | ✅ | Must ask for contract/intern |
| Basic salary (RM/month) | ✅ | ✅ | — | Must ask |
| Monthly allowance (intern) | — | — | ✅ | Must ask |
| Allowances breakdown | optional | optional | — | e.g. transport: 200 |
| Probation (months) | Default: 0 (none) | optional | ❌ | Ask if different |

### 2. Get Next Employee ID
```python
import sqlite3, os
DB = os.path.expanduser("~/hr.db")
conn = sqlite3.connect(DB)
c = conn.cursor()
year = 2026  # use current year
c.execute("UPDATE emp_sequence SET last_no = last_no + 1 WHERE year = ?", (year,))
c.execute("SELECT last_no FROM emp_sequence WHERE year = ?", (year,))
n = c.fetchone()[0]
conn.commit(); conn.close()
emp_id = f"ATU-EMP-{year}-{n:04d}"
```

### 3. Insert into DB
```python
import json
conn = sqlite3.connect(DB)
c = conn.cursor()
c.execute("""
INSERT INTO employees
  (emp_id, full_name, nric, nationality, address, email, tel,
   position, department, employment_type, start_date, end_date,
   probation_months, basic_salary, allowances)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
""", (emp_id, full_name, nric, nationality, address, email, tel,
      position, department, employment_type, start_date, end_date,
      probation_months, basic_salary, json.dumps(allowances) if allowances else None))
conn.commit(); conn.close()
```

### 4. Generate Contract PDF
```bash
~/.local/bin/uv run --with reportlab python3 \
  ~/Agent_K_Telegram/skills/hr-payroll/scripts/build_contract.py ATU-EMP-YYYY-XXXX
```
- Saved to: `~/Documents/AiTraining2U/HR/Contracts/{YYYY}/Unsigned/{emp_id}_{Name}_{Type}-Contract_{date}.pdf`
- DB `contract_pdf` field auto-updated by the script

### 5. Deliver for Review
- Send PDF to the channel the user is interacting from:
  - User in **Telegram group** → group `$TELEGRAM_GROUP_CHAT_ID`
  - User in **Telegram DM or Claude Code / terminal** → DM `$TELEGRAM_DM_CHAT_ID`
- Caption:
  - Employee name, position, contract type, start date, salary/allowance
- Then ask: **"Please review the contract. Reply 'send to employee', 'ok go ahead', or 'email it' to send."**
- **NEVER email without explicit user approval**

### 6. Email Contract to Employee
ONLY after explicit approval:
- **To:** employee email
- **CC (always):** recipients from `$CC_EMAILS` (comma-separated)
- **Subject:** `Employment Contract – {Position} | AiTraining2U PLT`
- **Attachment:** unsigned PDF
- **Body:** Professional HTML email (dark blue header, same style as invoice) covering:
  - Congratulations / welcome tone
  - Key terms summary (position, start date, salary)
  - Instruction to sign and return
  - Sign-off: `$COMPANY_CONTACT_NAME`, `$COMPANY_NAME`, `$COMPANY_EMAIL`
- **ALWAYS send via the custom script** (NOT Gmail MCP — MCP strips the display name from From header):
  ```bash
  ~/.local/bin/uv run --with google-api-python-client --with google-auth \
    python3 ~/Agent_K_Telegram/skills/send-email/scripts/send_email.py \
    --to EMPLOYEE_EMAIL \
    --cc $CC_EMAILS \
    --subject "SUBJECT" \
    --attach PATH_TO_PDF \
    --html 'HTML_BODY_STRING'
  ```
  This ensures the From header shows: **Atlas (AiTraining2U) &lt;atlas.aitraining2u@gmail.com&gt;**

### 7. Store Signed Contract
When user sends back the signed PDF:
1. Save to `~/Documents/AiTraining2U/HR/Contracts/{YYYY}/Signed/{emp_id}_{Name}_{Type}-Contract_{date}_SIGNED.pdf`
2. Update DB: `UPDATE employees SET signed_pdf=? WHERE emp_id=?`
3. Confirm to user: "Signed contract stored at [path]"

---

## File Storage
```
~/Documents/AiTraining2U/HR/Contracts/
└── {YYYY}/
    ├── Unsigned/   ← generated contracts
    └── Signed/     ← signed copies returned by employee
```

**File naming:**
- Unsigned: `ATU-EMP-2026-0001_John-Smith_Full-Time-Contract_2026-03-01.pdf`
- Signed:   `ATU-EMP-2026-0001_John-Smith_Full-Time-Contract_2026-03-01_SIGNED.pdf`

**File hygiene:**
- Never save to `~/` root
- Regeneration overwrites the unsigned copy in place
- Only one unsigned + one signed copy per employee

---

## Database — `~/hr.db`
- Tables: `employees`, `emp_sequence`
- Setup script: `~/Agent_K_Telegram/skills/hr-payroll/scripts/setup_db.py` (run once if DB missing)
- Employee ID format: `ATU-EMP-YYYY-XXXX`

### Key DB Fields
| Field | Notes |
|---|---|
| emp_id | ATU-EMP-YYYY-XXXX |
| employment_type | `full-time` / `contract` / `internship` |
| status | `active` / `inactive` / `terminated` |
| contract_pdf | path to unsigned PDF (auto-set by script) |
| signed_pdf | path to signed PDF (set when received) |

---

## Malaysia Employment Act 1955 (Amended 2022) — Key Rules Baked In

| Rule | Value |
|---|---|
| Max weekly hours | 45 hours |
| Annual leave | 16 days per year (flat) |
| Maternity leave | 98 consecutive days (paid) |
| Paternity leave | 7 days (paid, married, ≤5 children) |
| Public holidays | 11 federal days |
| Overtime rate | Minimum 1.5× hourly rate |
| EPF (employee) | 9% basic salary |
| EPF (employer) | 15% basic salary |
| SOCSO | 0.5% employee / 1.75% employer |
| EIS | 0.2% each |
| Termination notice | 2 months (60 days) — flat |
| Pregnant employee | Cannot be terminated except gross misconduct / business closure (s.37) |
| Non-compete | NOT included — void under Contracts Act 1950 s.28 |
| Confidentiality | Included — enforceable during and after employment |
| Non-solicitation | Included (12 months post-employment) — enforceable if reasonable |
| Intellectual property | All work product belongs to employer — assignment clause included |
| Intern EPF/SOCSO | NOT applicable (student exemption) |
| Minimum wage | Salary must not be less than prevailing national minimum wage (Minimum Wages Order) |
| Flexible working | Employee may apply in writing; employer must respond within 60 days (s.60P) |
| Anti-sexual harassment | Employer must take reasonable steps; display workplace notice (ss.81A–81F) |
| Domestic inquiry | Required before summary dismissal for misconduct |
| Paternity eligibility | Married male, ≥12 months service, ≤5 children |
| Max overtime | 104 hours/month; max 12 hours/day inclusive of normal hours |
| PCB/MTD | Employer deducts and remits monthly tax to LHDN |
