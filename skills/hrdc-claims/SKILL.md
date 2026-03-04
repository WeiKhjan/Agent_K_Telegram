---
name: hrdc-claims
description: Generate HRDC/PSMB SBL-KHAS T3 Attendance List for training claims. Use when asked to fill attendance list, generate HRDC attendance, prepare T3 form, or create HRDC claim documents.
---

# HRDC Claims — T3 Attendance List

## Overview
Generates the **PSMB/SBL-KHAS/T3/01 Attendance List** PDF for each training day.
This form must be enclosed when submitting claim form **PSMB/SBL-KHAS/JD/14**.

**Template asset:** `~/Agent_K_Telegram/templates/PSMB_SBL_KHAS_T3_01_template.pdf`

---

## Workflow

### 1. Gather Training Details — Ask for anything missing, NEVER guess

| Field | Required | Notes |
|---|---|---|
| Course title | ✅ Must ask | e.g. "AI Agentic Automation with n8n" |
| Training date(s) | ✅ Must ask | One T3 form per day; list all dates |
| Participant list | ✅ Must ask | See participant fields below |
| Certifier name | Default: `$COMPANY_DIRECTOR_NAME` or ask | Person signing the certification |
| Certifier designation | Default: Director | Ask if different |
| Certification date | Default: training end date + 2 days | Ask if different |

**Participant fields (per person):**

| Field | Notes |
|---|---|
| No. (row number) | Auto-numbered 1, 2, 3... |
| Name of Trainee(s) | Full name as per NRIC |
| Name of Employer(s) | Company they work for |
| NRIC | 12-digit Malaysian IC (format: XXXXXX-XX-XXXX) |
| Citizenship | Default: Malaysian |
| Sex | M / F — derive from NRIC last digit: **odd = M, even = F** |
| Signature | Leave blank — physical signature by trainee |

---

### 2. Generate PDF (one per training day)

```bash
/Users/aitraining2u/.local/share/office-venv/bin/python \
  ~/Agent_K_Telegram/skills/hrdc-claims/scripts/build_t3.py \
  --course "COURSE TITLE" \
  --date "D/M/YYYY" \
  --participants '[{"name":"...","employer":"...","nric":"...","citizenship":"Malaysian","sex":"M"}]' \
  --certifier-name "Goh Hen Yee" \
  --certifier-designation "Director" \
  --cert-date "D/M/YYYY" \
  --output "~/Documents/AiTraining2U/HRDC/T3_COURSE-SLUG_YYYY-MM-DD.pdf"
```

- One PDF per training day
- Each PDF = **2 pages × 6 rows = 12 rows per PDF**
- If participants > 12, the script auto-duplicates the template set (adds more 2-page sets) to fit all rows
- Row numbers are continuous across pages (page 1: 1–6, page 2: 7–12, page 3: 13–18, …)
- If training spans multiple days, generate multiple PDFs (batch)
- Save to: `~/Documents/AiTraining2U/HRDC/{YYYY}/T3_{CourseSlug}_{YYYY-MM-DD}.pdf`
- Course slug: lowercase, spaces → hyphens (e.g. `ai-agentic-automation-n8n`)

---

### 3. Deliver

- Send PDF(s) to the channel the user is interacting from:
  - **Telegram group** → group `$TELEGRAM_GROUP_CHAT_ID`
  - **Telegram DM / terminal** → DM `$TELEGRAM_DM_CHAT_ID`
- Caption: Course title, date(s), number of participants
- Ask: **"Please print, have trainees sign, then scan and send back."**

---

## File Storage
```
~/Documents/AiTraining2U/HRDC/
└── {YYYY}/
    └── T3_{course-slug}_{YYYY-MM-DD}.pdf   ← one per training day
```

## Form Layout Reference (PSMB/SBL-KHAS/T3/01)

### Header
- Title: **FOR SBL-KHAS SCHEME ONLY**
- Form code: `PSMB/SBL-KHAS/T3/01`
- Note box (top right): "This attendance list must be enclosed when submitting the claim form PSMB/SBL-KHAS/JD/14"

### Course Info
- **Course Title:** [course name]
- **Dates of Training:** [single date for this page, e.g. 5/3/2026]

### Participant Table (columns)
| No. | Name of Trainee(s) | Name of Employer(s) | NRIC | Citizenship | Sex | Signature* |

- 6 rows per page, 2 pages per PDF set (12 rows total)
- Auto-duplicates pages if > 12 participants
- Signature column: blank (physical sign)

### Certification Block
```
I certify that all trainees listed above had fully attended the training.

NAME        : [Certifier Name]        SIGNATURE : ___________
DESIGNATION : [Designation]          DATE      : [Date]
              Managing Director/General Manager/Principal

TRAINING
PROVIDER'S STAMP : [YYC Management Services Sdn Bhd stamp]
```

### Footer Notes
1. Please make a separate attachment if more space is required
2. This attendance list must be prepared on daily basis and signed by the trainee in each **column** of the relevant date of training if he/she had attended the programme on that day

---

## Model
- Always uses **Opus** — HRDC tasks are complex multi-step workflows requiring precise PDF overlay
- Auto-detected via keyword matching (`hrdc`, `psmb`, `sbl-khas`, `attendance list`, `generate t3`)

## Key Rules
- One T3 form per training day — do NOT combine multiple dates on one form
- Signature column always left blank (participants sign physically)
- NRIC format: `XXXXXX-XX-XXXX` (with dashes)
- Citizenship default: `Malaysian`
- Form must match PSMB official layout exactly
- Training Provider's Stamp: use company stamp from env / assets
