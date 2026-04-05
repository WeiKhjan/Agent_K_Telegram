---
name: hrdc-confirmation-letter
description: Generate HRDC training confirmation letters by updating the Word template with client details (date, company, address, subject, participants, fees, agenda dates). Use when asked to create a confirmation letter, update confirmation letter, prepare training confirmation, or HRDC confirmation.
---

# HRDC Confirmation Letter

## Overview
Updates the YYC Management Services **training confirmation letter** Word template with client-specific details. The template contains workshop info tables, agenda tables (Day 1 & Day 2), and an acceptance section.

**Template asset:** `~/Agent_K_Telegram/skills/hrdc-confirmation-letter/assets/confirmation_letter_template.docx`

---

## Workflow

### 1. Gather Details — Ask for anything missing, NEVER guess

| Field | Required | Notes |
|---|---|---|
| Date of letter | Yes | e.g. "26th March 2026" |
| Company name | Yes | Client company |
| Company address | Yes | Multi-line address |
| Subject line | Yes | e.g. "CONFIRMATION ON AI AGENTIC AUTOMATION WITH N8N ON 2nd AND 3rd APRIL 2026" |
| Workshop name | No | Default: "AI Agentic Automation with n8n" |
| Number of participants | Yes | e.g. 1, 5, 10 |
| Day 1 date | Yes | Must align with subject, e.g. "2nd April 2026" |
| Day 2 date | Yes | Must align with subject, e.g. "3rd April 2026" |
| Confirmed fees | Yes | e.g. "3,780.00" (without RM) |
| Location override | No | Default: keeps WORQ TTDI from template |

### 2. Generate the Letter

```bash
/Users/aitraining2u/.local/share/office-venv/bin/python \
  ~/Agent_K_Telegram/skills/hrdc-confirmation-letter/scripts/update_confirmation.py \
  --date "26th March 2026" \
  --company "Daxin KF&C PLT" \
  --address "54, Jln Kempas Utama 2/2, Taman Kempas Utama,\n81200 Johor Bahru, Johor Darul Ta'zim" \
  --subject "CONFIRMATION ON AI AGENTIC AUTOMATION WITH N8N ON 2nd AND 3rd APRIL 2026" \
  --workshop "AI Agentic Automation with n8n" \
  --participants 1 \
  --day1-date "2nd April 2026" \
  --day2-date "3rd April 2026" \
  --fees "3,780.00" \
  --output "~/Daxin_AI-Agentic-n8n_2-3-Apr-2026.docx"
```

Optional flags:
- `--location "Custom Venue\nAddress Line"` — override default WORQ TTDI location
- `--template /path/to/other.docx` — use a different template

### 3. Deliver

- Send the generated `.docx` to the channel the user is interacting from
- Caption: Company name, workshop, dates, participants, fees

---

## File Naming Convention
Format: `{CompanyShort}_{TrainingShort}_{DateRange}.docx`

Rules:
- **CompanyShort**: Short recognizable name (drop "Sdn Bhd", "PLT", etc.) e.g. "Daxin", "KMP"
- **TrainingShort**: Abbreviated training name with hyphens, e.g. "AI-Agentic-n8n"
- **DateRange**: Day(s) + short month + year, e.g. "2-3-Apr-2026", "5-Mar-2026"

Examples:
- `Daxin_AI-Agentic-n8n_2-3-Apr-2026.docx`
- `KMP_AI-Agentic-n8n_5-6-Mar-2026.docx`

Save to: `~/` (home directory)

## Template Structure Reference

The template has this structure (paragraph indices are fixed):

| Element | Location | Content |
|---|---|---|
| "Date:" paragraph | Near top | "Date: 23rd February 2026" |
| After "Board of Directors" | Company block | Company name + address |
| "CONFIRMATION" paragraph | Subject | "CONFIRMATION ON ... ON Xth & Yth MONTH YEAR" |
| "confirmed fees" paragraph | Fees | "Our confirmed fees are RM X,XXX.00." |
| Table 0 | Workshop info | Workshop name, participants, location |
| Table 1 | Day 1 agenda | Date + course content (Modules 1-3) |
| Table 2 | Day 2 agenda | Date + course content (Modules 4-5) |

**Important:** The script finds fields by keyword search (not hardcoded paragraph indices), so it works even if the template structure shifts slightly. The template has split runs (formatting-aware fragments) which the script handles automatically.

---

## Key Rules
- Subject line must be ALL CAPS
- Day dates in agenda tables must match the dates in the subject line
- Fees format: RM X,XXX.00 (with comma thousands separator)
- Address uses `\n` for line breaks in the CLI argument
- Workshop name in Table 0 should match the subject description
