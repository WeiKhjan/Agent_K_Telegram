---
name: hrdc-claims
description: Generate HRDC/PSMB documents — T3 Attendance List for training claims, or Focus Area Program course application templates. Use when asked to fill attendance list, generate HRDC attendance, prepare T3 form, create HRDC claim documents, focus area application, focus program, course template, or HRDC course application.
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

## HRDC Special Focus Program — Course Template

### Overview
Generates the **HRDC Special Focus Program Application** Excel form (Course Template).
The template asset contains 4 sheets: `Form` (to fill), `Sample` (reference), `Evaluation` (office use), `Sheet1` (dropdown data).

**Template asset:** `~/Agent_K_Telegram/skills/hrdc-claims/assets/hrdc_focus_area_template.xlsx`

### Form Sheet Structure (fields to update)

#### Application Details (rows 6–8)
| Cell | Field | Options/Notes |
|------|-------|---------------|
| C6 | Category | `FOCUS_AREA` or `INDUSTRY_SPECIFIC` |
| C7 | Focus Area/Industry | e.g. Future Technology, Smart Farming, FinTech, Green Technology, Industry 4.0, etc. |
| C8 | Sector | Depends on category — dropdown values in Sheet1 |

#### Course Details (rows 13–17)
| Cell | Field |
|------|-------|
| C13 | Course Name |
| C14 | Course Overview (paragraph) |
| J14 | Course Objective (numbered list) |
| C15 | Target Group (by designation) |
| J15 | Training Category (e.g. Workshops) |
| C17 | Types of Training (e.g. Non E-learning) |
| J17 | Training Venue (e.g. Malaysia) |

#### Course Learning Outcomes — CLOs (rows 22–32)
| Cell | Field |
|------|-------|
| C22–C32 | CLO 1 through CLO 10 (label) |
| D22–D32 | CLO Statement (description) |
| L22–L32 | Learning Domain (dropdown: Knowledge/Skill/Attitude Level 1–7) |

#### Module-CLO Mapping (rows 37–61)
| Cell | Field |
|------|-------|
| B37–B61 | Module description (title, main topics, subtopics, elaboration) |
| I37–I61 | CLO mapping (e.g. "1,2" or "3,4") |
| J37–J61 | Theory Duration (Hours) |
| K37–K61 | Practical Duration (Hours) |
| L37–L61 | Total Hours (formula: =J+K) |
| M37–M61 | Practical Elements (if any) |

#### CLO Assessment Mapping (rows 71–80)
| Cell | Field |
|------|-------|
| B71–B80 | CLO (e.g. CLO 1) |
| C71–C80 | Training Strategy (Lecture, Hands-on, Group Activity, etc.) |
| F71–F80 | Assessment Method (Quiz, Demonstration, etc.) |
| I71–I80 | Specify if "Others" selected |
| J71–J80 | Assessment Weightage (%) — must total 100% |

### Workflow
1. **Gather course details** — ask for course name, overview, objectives, target group, CLOs, modules, assessment mapping
2. **Load template** — open `hrdc_focus_area_template.xlsx` with openpyxl
3. **Fill Form sheet** — update only the `Form` sheet cells listed above; preserve all formulas, dropdowns, and other sheets
4. **Save** — save as new file: `~/Documents/AiTraining2U/HRDC/{YYYY}/FocusArea_{CourseSlug}_{YYYY-MM-DD}.xlsx`
5. **Deliver** — send via appropriate channel

### Important Notes
- Only modify the `Form` sheet — do NOT touch `Sample`, `Evaluation`, or `Sheet1`
- Preserve all Excel formulas (cells with `=` prefix)
- Training Strategy options: Lecture, Case study, Group Discussion, Group Activity, Live Audit, Role Play, Simulation, Hands-on, Laboratory, Others
- Learning Domain options are in Sheet1 column B (Knowledge/Skill/Attitude Levels 1–7)
- Sector dropdown values are in Sheet1 column A
- Focus Area options: Aerospace Industry, FinTech, Block Chain, Future Technology, Green Technology/Renewable Energy, Industry 4.0, Micro-credential, Smart Construction, Smart Farming

---

## Key Rules
- One T3 form per training day — do NOT combine multiple dates on one form
- Signature column always left blank (participants sign physically)
- NRIC format: `XXXXXX-XX-XXXX` (with dashes)
- Citizenship default: `Malaysian`
- Form must match PSMB official layout exactly
- Training Provider's Stamp: use company stamp from env / assets
