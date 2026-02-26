# Implementation Plan: Agent K for Malaysia Accounting Firm

## Audit, Tax & Compilation Services — AI Staff on Dedicated Mac Mini

**Date:** 2026-02-26
**Codebase:** Agent K Telegram Bot (this repo)
**Target:** Malaysia-based accounting/audit firm performing statutory audit, tax compliance, and compilation engagements

---

## 1. Concept Overview

### What We're Building

A dedicated **AI staff member** running on a Mac Mini, accessible via Telegram. Human accountants chat with the AI to instruct it to perform audit, tax, and compilation work. The AI operates on files, templates, and audit software — then sends deliverables back for human review.

```
┌─────────────────────────────────────────────────────────────────┐
│  Mac Mini — "AI Staff Workstation"                              │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ Agent K Bot   │───▶│ Claude CLI   │───▶│ MCP Servers      │   │
│  │ (Telegram)    │    │ (Brain)      │    │ • Excel          │   │
│  └──────────────┘    └──────────────┘    │ • Word           │   │
│         ▲                    │            │ • Audit Software │   │
│         │                    ▼            │ • Gmail          │   │
│         │              ┌──────────┐      │ • Google Drive   │   │
│         │              │ Skills   │      │ • Google Sheets  │   │
│         │              │ Library  │      └──────────────────┘   │
│         │              └──────────┘                              │
│         │                    │                                   │
│         │                    ▼                                   │
│         │         ┌────────────────────┐                        │
│         │         │ /engagements/      │                        │
│         │         │   templates/       │                        │
│         │         │   2026/            │                        │
│         │         │     client-abc/    │                        │
│         │         └────────────────────┘                        │
│         │                    │                                   │
│         ◀────────────────────┘                                  │
│      Sends deliverables back via Telegram                       │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ Telegram
         ▼
┌─────────────────┐
│ Human Staff     │
│ • Review        │
│ • Override      │
│ • Sign off      │
└─────────────────┘
```

### Workflow

1. Human sends instruction via Telegram (e.g., "Prepare the tax computation for Client ABC FYE 2025")
2. Agent K receives it, spawns Claude CLI with relevant MCP servers and skills
3. Claude works on the engagement — opens templates, fills in data, runs computations
4. Agent K sends the deliverable (Excel/Word/PDF) back to Telegram
5. Human reviews, edits if needed, signs off
6. If approved, Agent K emails the deliverable to the client or files it

---

## 2. Hardware & Software Setup

### Mac Mini Specifications

| Component | Recommended |
|-----------|-------------|
| Model | Mac Mini M2/M4 or later |
| RAM | 16 GB minimum (24 GB preferred) |
| Storage | 512 GB SSD minimum |
| OS | macOS Sonoma or later |
| Purpose | Dedicated AI staff workstation — always on |

### Software to Install

| Software | Purpose | Install Method |
|----------|---------|----------------|
| Node.js 20+ | Agent K runtime | `brew install node` |
| Claude CLI | AI brain | `npm install -g @anthropic-ai/claude-code` |
| Playwright + Chromium | Web browsing, search | `npx playwright install chromium` |
| Python 3.11+ | Skills scripts (PDF generation, email) | `brew install python` |
| uv (Python runner) | Fast Python script execution | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Git | Version control | `brew install git` |
| Audit software | Firm's audit tool (CaseWare, AutoCount, etc.) | Per vendor instructions |
| Microsoft Office | Excel/Word template editing (optional) | Mac App Store or M365 |

### Accounts to Set Up (Dedicated to AI Staff)

| Account | Purpose | Notes |
|---------|---------|-------|
| Gmail / Google Workspace | Email, Google Sheets, Google Drive | e.g., `ai-staff@yourfirm.com` |
| Telegram Bot | Chat interface | Create via @BotFather |
| Claude API | AI processing | Anthropic account with API key |
| Audit software account | Access to engagement data | Firm's audit platform login |
| GitHub (optional) | Backup engagement templates | Private repo |

---

## 3. Folder Structure on Mac Mini

```
/engagements/                          ← WORKSPACE_DIR
├── templates/
│   ├── audit/
│   │   ├── audit-program/
│   │   │   ├── general-audit-program.xlsx
│   │   │   ├── bank-confirmation.xlsx
│   │   │   ├── debtor-confirmation.xlsx
│   │   │   ├── creditor-confirmation.xlsx
│   │   │   └── stock-count-attendance.xlsx
│   │   ├── working-papers/
│   │   │   ├── leadsheet-template.xlsx
│   │   │   ├── trial-balance-mapping.xlsx
│   │   │   ├── analytical-review.xlsx
│   │   │   ├── revenue-testing.xlsx
│   │   │   ├── purchases-testing.xlsx
│   │   │   ├── payroll-testing.xlsx
│   │   │   ├── fixed-assets-register.xlsx
│   │   │   ├── bank-reconciliation.xlsx
│   │   │   ├── trade-debtors-aging.xlsx
│   │   │   ├── trade-creditors-aging.xlsx
│   │   │   ├── provision-listing.xlsx
│   │   │   ├── related-party-transactions.xlsx
│   │   │   └── subsequent-events-checklist.xlsx
│   │   ├── checklists/
│   │   │   ├── engagement-acceptance.xlsx
│   │   │   ├── planning-checklist.xlsx
│   │   │   ├── completion-checklist.xlsx
│   │   │   ├── going-concern-assessment.xlsx
│   │   │   ├── fraud-risk-assessment.xlsx
│   │   │   ├── independence-declaration.xlsx
│   │   │   ├── mpers-disclosure-checklist.xlsx
│   │   │   └── mfrs-disclosure-checklist.xlsx
│   │   ├── letters/
│   │   │   ├── engagement-letter.docx
│   │   │   ├── management-representation-letter.docx
│   │   │   ├── audit-report-unmodified.docx
│   │   │   ├── audit-report-modified.docx
│   │   │   ├── management-letter.docx
│   │   │   └── bank-confirmation-letter.docx
│   │   └── financial-statements/
│   │       ├── fs-template-mpers.xlsx
│   │       ├── fs-template-mfrs.xlsx
│   │       ├── notes-template-mpers.docx
│   │       └── notes-template-mfrs.docx
│   │
│   ├── tax/
│   │   ├── computations/
│   │   │   ├── tax-computation-sdn-bhd.xlsx
│   │   │   ├── tax-computation-llp.xlsx
│   │   │   ├── tax-computation-partnership.xlsx
│   │   │   ├── tax-computation-sole-prop.xlsx
│   │   │   └── tax-computation-individual.xlsx
│   │   ├── schedules/
│   │   │   ├── capital-allowance-schedule.xlsx
│   │   │   ├── s33-schedule.xlsx
│   │   │   ├── s34-deductions.xlsx
│   │   │   ├── s39-prohibited-deductions.xlsx
│   │   │   ├── reinvestment-allowance.xlsx
│   │   │   ├── real-property-gains.xlsx
│   │   │   └── withholding-tax-tracker.xlsx
│   │   ├── estimates/
│   │   │   ├── cp204-estimate.xlsx
│   │   │   ├── cp204a-revision.xlsx
│   │   │   └── s107c-instalment.xlsx
│   │   ├── forms/
│   │   │   ├── form-c-checklist.xlsx
│   │   │   ├── form-p-checklist.xlsx
│   │   │   ├── form-be-checklist.xlsx
│   │   │   ├── form-b-checklist.xlsx
│   │   │   └── e-filing-checklist.xlsx
│   │   └── letters/
│   │       ├── tax-engagement-letter.docx
│   │       └── tax-advisory-memo.docx
│   │
│   ├── compilation/
│   │   ├── financial-statements/
│   │   │   ├── compilation-fs-sdn-bhd.xlsx
│   │   │   ├── compilation-fs-llp.xlsx
│   │   │   └── compilation-fs-sole-prop.xlsx
│   │   ├── reports/
│   │   │   ├── compilation-report.docx
│   │   │   └── management-report.docx
│   │   └── notes/
│   │       ├── notes-sdn-bhd.docx
│   │       └── notes-llp.docx
│   │
│   └── shared/
│       ├── client-acceptance-form.xlsx
│       ├── engagement-quality-review.xlsx
│       ├── time-budget.xlsx
│       └── billing-worksheet.xlsx
│
├── 2025/                              ← Financial year ended 2025
│   ├── client-abc-sdn-bhd/
│   │   ├── audit/
│   │   │   ├── planning/
│   │   │   ├── working-papers/
│   │   │   ├── checklists/
│   │   │   ├── confirmations/
│   │   │   ├── financial-statements/
│   │   │   └── correspondence/
│   │   ├── tax/
│   │   │   ├── computation/
│   │   │   ├── schedules/
│   │   │   ├── estimates/
│   │   │   └── correspondence/
│   │   └── client-info/
│   │       ├── ssm-profile/
│   │       ├── prior-year/
│   │       └── permanent-file/
│   │
│   └── client-xyz-plt/
│       └── ...
│
└── 2026/
    └── ...
```

---

## 4. Skills to Build

Skills are instruction files (`SKILL.md`) placed in `skills/` that tell Claude how to perform specific accounting tasks. Each skill follows the existing pattern — gather inputs, process, generate deliverable, send for review.

### Phase 1 — Core Engagement Skills

#### 4.1 `/audit-planning`

**Trigger keywords:** audit planning, plan audit, risk assessment, materiality
**What it does:**
- Opens the client's prior year file and current year trial balance
- Calculates planning materiality (based on revenue, total assets, or profit — per ISA 320)
- Performs preliminary analytical review (variance analysis YoY)
- Identifies significant risk areas
- Prepares the audit planning memo (Word document)
- Fills in the planning checklist
- Sends planning pack to Telegram for partner review

**Template files used:**
- `templates/audit/checklists/planning-checklist.xlsx`
- `templates/audit/working-papers/analytical-review.xlsx`

**Malaysia-specific considerations:**
- Materiality benchmarks per MIA guidance (typically 1-2% of revenue or 5-10% of PBT)
- MPERS vs MFRS framework identification
- SSM compliance requirements

---

#### 4.2 `/audit-workpaper`

**Trigger keywords:** workpaper, working paper, leadsheet, audit test, vouching, sampling
**What it does:**
- Creates or updates working papers from templates
- Maps trial balance figures to leadsheets
- Performs substantive testing procedures (sampling, recalculation, vouching)
- Cross-references to supporting documents
- Documents audit conclusions per section

**Supported workpaper types:**
| Workpaper | Key Procedures |
|-----------|----------------|
| Revenue testing | Sample selection, trace to invoices/DOs, cutoff testing |
| Purchases testing | Sample selection, trace to invoices/GRNs, cutoff |
| Bank & cash | Reconciliation, outstanding items, confirmation |
| Trade debtors | Aging analysis, confirmation, subsequent receipts |
| Trade creditors | Aging analysis, confirmation, subsequent payments |
| Fixed assets | Additions/disposals, depreciation recalculation |
| Payroll | Sample check vs EA forms, EPF/SOCSO/EIS reconciliation |
| Provisions | Review basis, recalculate, assess adequacy |
| Related party | Identify parties per S.228 CA 2016, verify disclosures |

**Malaysia-specific considerations:**
- EPF contribution rates (employer 12%/13%, employee 9%/11%)
- SOCSO and EIS rates
- SST treatment (6% service tax / 10% sales tax where applicable)
- Statutory audit thresholds (qualifying criteria under CA 2016)
- Ringgit (RM) formatting throughout

---

#### 4.3 `/audit-completion`

**Trigger keywords:** audit completion, completion checklist, subsequent events, going concern
**What it does:**
- Runs through the completion checklist
- Performs going concern assessment
- Reviews subsequent events (SSM search, bank statements post year-end)
- Summarises unadjusted differences (and assess against materiality)
- Prepares summary of audit differences
- Generates the management representation letter (for client signature)

**Template files used:**
- `templates/audit/checklists/completion-checklist.xlsx`
- `templates/audit/checklists/going-concern-assessment.xlsx`
- `templates/audit/letters/management-representation-letter.docx`

---

#### 4.4 `/prepare-fs`

**Trigger keywords:** financial statements, prepare FS, draft FS, compile FS, annual report
**What it does:**
- Takes the finalised trial balance (from audit or compilation)
- Maps TB accounts to financial statement line items
- Generates:
  - Statement of Financial Position (Balance Sheet)
  - Statement of Comprehensive Income (P&L)
  - Statement of Changes in Equity
  - Statement of Cash Flows (indirect method)
  - Notes to the Financial Statements
- Applies MPERS or MFRS format based on entity type
- Cross-checks totals, ensures balance sheet balances

**Malaysia-specific considerations:**
- MPERS for private entities (most Sdn Bhd clients)
- MFRS for public interest entities and those opting in
- CA 2016 s.248-249 disclosure requirements
- Directors' Report per Ninth Schedule CA 2016
- Statement by Directors (s.251 CA 2016)
- Statutory Declaration (s.251 CA 2016)
- SSM filing deadlines (within 30 days of AGM for Sdn Bhd)

---

#### 4.5 `/audit-report`

**Trigger keywords:** audit report, auditor's report, audit opinion
**What it does:**
- Determines the appropriate audit opinion (unmodified, qualified, adverse, disclaimer)
- Generates the Independent Auditors' Report using the correct template
- Includes required sections: Opinion, Basis for Opinion, Key Audit Matters (if PIE), Directors' Responsibilities, Auditors' Responsibilities
- For modified opinions: drafts the modification paragraph

**Template files used:**
- `templates/audit/letters/audit-report-unmodified.docx`
- `templates/audit/letters/audit-report-modified.docx`

**Malaysia-specific considerations:**
- ISA 700/705/706 as adopted by MIA
- Reporting under CA 2016 s.266
- Key Audit Matters (ISA 701) — required for PIEs, optional for others
- Firm's audit licence number (AF number)
- Individual auditor's approval number

---

#### 4.6 `/management-letter`

**Trigger keywords:** management letter, internal control, findings, recommendations
**What it does:**
- Compiles audit findings and internal control weaknesses discovered during the audit
- Categorises by severity (high, medium, low)
- Drafts management recommendations for each finding
- Generates the management letter in Word format
- Includes prior year findings status (resolved / recurring)

**Template files used:**
- `templates/audit/letters/management-letter.docx`

---

### Phase 2 — Tax Skills

#### 4.7 `/tax-computation`

**Trigger keywords:** tax computation, tax comp, corporate tax, income tax
**What it does:**
- Takes the finalised P&L (from audit or compilation)
- Identifies and adjusts non-deductible expenses (s.39 ITA 1967)
- Identifies and adjusts non-taxable income
- Computes capital allowances (s.42 ITA 1967)
- Applies relevant incentives (reinvestment allowance, pioneer status, etc.)
- Calculates tax payable at applicable rate
- Generates the tax computation Excel workbook with supporting schedules

**Tax schedules generated:**
| Schedule | Description |
|----------|-------------|
| Main computation | Adjusted income → chargeable income → tax payable |
| Capital allowance | By asset class, rates per Schedule 3 ITA 1967 |
| S.33(1) deductions | Double deductions, approved donations |
| S.34 specific deductions | Approved training, R&D, etc. |
| S.39 add-backs | Entertainment, depreciation, private expenses, penalties |
| Brought forward losses | Utilisation tracking (7-year limit per Finance Act 2021) |
| Real property gains (if applicable) | RPGT computation |
| Withholding tax | S.109/109B payments tracking |

**Malaysia-specific tax rates (YA 2025):**
| Entity Type | Rate |
|-------------|------|
| Resident company (first RM150k) | 15% |
| Resident company (RM150k–RM600k) | 17% |
| Resident company (above RM600k) | 24% |
| SME qualifying conditions | Paid-up capital ≤ RM2.5m, gross income ≤ RM50m |
| LLP / Partnership | Taxed at individual partner level |
| Non-resident company | 24% flat |

**Capital allowance rates (common):**
| Asset Class | Initial (%) | Annual (%) |
|-------------|-------------|------------|
| Industrial building | 10 | 3 |
| Plant & machinery (general) | 20 | 14 |
| Motor vehicles | 20 | 20 |
| Office equipment | 20 | 10 |
| Computer / IT equipment | 20 | 40 |
| Small value assets (≤RM2,000) | 100 | — |

---

#### 4.8 `/tax-estimate`

**Trigger keywords:** CP204, tax estimate, instalment, revision, CP204A
**What it does:**
- Calculates estimated tax payable for the current/next year of assessment
- Prepares CP204 estimate (due 30 days before start of basis period)
- Handles CP204A revision (6th/9th month revision)
- Tracks instalment payments against estimates
- Flags s.107C penalty risk (>30% underestimation)

**Malaysia-specific rules:**
- CP204 due date: 30 days before basis period begins
- Estimate must be ≥ revised estimate for preceding YA (or 85% of revised estimate)
- 10% penalty on underestimation >30% (s.107C)
- 12 monthly instalments (or 6 bi-monthly for certain cases)
- New companies: exempt from CP204 for first 2 YAs (if paid-up capital ≤ RM2.5m)

---

#### 4.9 `/tax-filing`

**Trigger keywords:** Form C, Form B, e-filing, tax return, LHDN, submit tax
**What it does:**
- Generates the filing checklist for the appropriate form
- Compiles required supporting documents
- Verifies computation against filing form requirements
- Tracks filing deadlines and status

**Key deadlines:**
| Form | Entity | Deadline |
|------|--------|----------|
| Form C | Companies (Sdn Bhd) | 7 months after FYE |
| Form PT | LLP (PLT) | 7 months after FYE |
| Form P | Partnerships | 30 June |
| Form B | Sole proprietors | 30 June (e-filing: 15 July) |
| Form BE | Employment income only | 30 April (e-filing: 15 May) |
| Form E | Employer annual return | 31 March |
| CP204 | Tax estimate | 30 days before basis period |

---

### Phase 3 — Compilation Skills

#### 4.10 `/compile-accounts`

**Trigger keywords:** compile, compilation, unaudited accounts, management accounts
**What it does:**
- Takes client's trial balance or accounting records
- Maps to financial statement format
- Generates compilation financial statements (simpler than audited FS)
- Includes compilation report (no assurance provided)
- For Sdn Bhd exempt from audit: ensures CA 2016 s.267 compliance

**Malaysia-specific considerations:**
- Audit exemption criteria: Dormant, zero-revenue, or qualifying criteria under CA 2016
- Compilation report wording per ISRS 4410 (Revised) as adopted by MIA
- SSM annual return filing (still required even if audit-exempt)

---

#### 4.11 `/secretarial-checklist`

**Trigger keywords:** secretarial, SSM, annual return, s.68, s.58, resolution
**What it does:**
- Generates a secretarial compliance checklist
- Tracks key deadlines (annual return, AGM, director changes)
- Identifies outstanding SSM filings

**Key SSM deadlines:**
| Filing | Deadline | Penalty |
|--------|----------|---------|
| Annual return (Sdn Bhd) | Within 30 days of anniversary | RM50/day |
| Annual return (LLP) | Within 90 days of FYE | RM50/day |
| Change of directors | Within 14 days | Late filing penalty |
| Change of registered address | Within 14 days | Late filing penalty |
| Allotment of shares | Within 14 days | Late filing penalty |
| Financial statements lodging | Within 30 days of AGM | Late filing penalty |

---

### Phase 4 — Client Management Skills

#### 4.12 `/client-setup`

**Trigger keywords:** new client, onboard client, client acceptance, engagement letter
**What it does:**
- Creates the client folder structure under `/engagements/{year}/{client-name}/`
- Generates the engagement letter from template
- Runs client acceptance checklist (independence, AML/KYC, risk assessment)
- Stores client permanent information
- Sets up the engagement in audit software (via MCP)

**AML/KYC requirements (AMLATFPUAA 2001):**
- Customer due diligence (CDD) for all new clients
- Verify identity of directors and beneficial owners
- Check against sanctions lists
- Risk classification (high/medium/low)
- Ongoing monitoring for existing clients

---

#### 4.13 `/billing`

**Trigger keywords:** bill, billing, fee note, invoice client, WIP
**What it does:**
- Uses the existing `/issue-invoice` skill as foundation
- Calculates fees based on time budget and billing rates
- Generates the fee note/invoice
- Tracks WIP (work in progress) and billing status per engagement

---

#### 4.14 `/correspondence`

**Trigger keywords:** send to client, client email, follow up, request documents
**What it does:**
- Drafts professional emails to clients (document requests, follow-ups, delivery of reports)
- Uses the existing `/send-email` skill for delivery
- Tracks outstanding document requests
- Follows up on overdue items

---

## 5. MCP Servers to Add

### 5.1 Existing MCP Servers (Already Configured)

| MCP Server | Purpose | Status |
|------------|---------|--------|
| Excel | Read/write/format .xlsx files | Ready |
| Word | Create/edit/format .docx documents | Ready |
| Gmail | Send/receive emails | Ready |
| Google Sheets | Read/write spreadsheets | Ready |
| Playwright | Web browsing, research | Ready |

### 5.2 New MCP Servers to Add

#### Audit Software MCP

```js
// claude-runner.js — add to MCP_SERVERS object
'audit-software': {
  keywords: [
    'audit', 'workpaper', 'trial balance', 'leadsheet', 'working paper',
    'engagement', 'caseware', 'autocount', 'audit file'
  ],
  config: {
    command: 'path-to-audit-mcp-adapter',
    args: ['--config', '/path/to/audit-config.json']
  }
}
```

**Implementation approach:**
- If the audit software has an API → build a custom MCP server that wraps the API
- If no API → use Playwright MCP to automate the software's web interface
- If desktop-only → use file-based integration (export/import CSVs or Excel files)

**Common audit software in Malaysia:**
| Software | Integration Method |
|----------|-------------------|
| CaseWare | API available — build MCP adapter |
| AutoCount | Database access + API |
| MYOB | File import/export |
| Xero | REST API — MCP adapter available |
| SQL Accounting | ODBC / file export |
| UBS | File import/export (legacy) |

#### Google Drive MCP

```js
'google-drive': {
  keywords: [
    'drive', 'upload to drive', 'download from drive', 'share',
    'google drive', 'folder'
  ],
  config: {
    command: 'npx',
    args: ['@anthropic/google-drive-mcp-server']
  }
}
```

**Purpose:** Store and retrieve engagement files from Google Drive for backup/sharing with team.

#### PDF MCP (Optional)

```js
'pdf': {
  keywords: ['pdf', 'read pdf', 'extract pdf', 'scan', 'OCR'],
  config: {
    command: 'npx',
    args: ['pdf-mcp-server']
  }
}
```

**Purpose:** Read client-provided PDF documents (bank statements, invoices, contracts) for data extraction during audit/tax work.

---

## 6. Code Changes to Agent K

### 6.1 Add `/client` Command (index.js)

Quick shortcut to switch between client workspaces:

```js
bot.command('client', (ctx) => {
  const args = ctx.message.text.slice(8).trim();
  if (!args) {
    // List available clients in current year
    const year = new Date().getFullYear();
    const clientDir = path.join(process.env.WORKSPACE_DIR, String(year));
    if (fs.existsSync(clientDir)) {
      const clients = fs.readdirSync(clientDir).filter(f =>
        fs.statSync(path.join(clientDir, f)).isDirectory()
      );
      return ctx.reply(`Clients (${year}):\n${clients.map(c => `• ${c}`).join('\n')}\n\nUsage: /client <name>`);
    }
    return ctx.reply('No client folders found.');
  }
  // Find matching client folder
  const year = new Date().getFullYear();
  const clientPath = path.join(process.env.WORKSPACE_DIR, String(year), args);
  if (fs.existsSync(clientPath)) {
    process.env.CURRENT_CLIENT_DIR = clientPath;
    ctx.reply(`Switched to: ${args}\nPath: ${clientPath}`);
  } else {
    ctx.reply(`Client folder not found. Create with /setup-client ${args}`);
  }
});
```

### 6.2 Add New MCP Server Entries (claude-runner.js)

Add the audit software and Google Drive MCP configurations to the `MCP_SERVERS` object as shown in Section 5.2.

### 6.3 Add New Environment Variables (.env)

```env
# Engagement workspace root
WORKSPACE_DIR=/engagements

# Firm details
FIRM_NAME=Your Firm Name
FIRM_AF_NUMBER=AF-XXXX          # MIA audit firm licence
FIRM_ADDRESS=Firm address
FIRM_REG_NO=LLP registration number

# Partner details
PARTNER_NAME=Partner Name
PARTNER_APPROVAL_NO=XXXX/XX/XX(J)  # Individual auditor number

# Audit software
AUDIT_SOFTWARE_URL=https://your-audit-software.com
AUDIT_SOFTWARE_API_KEY=your-api-key

# Tax
LHDN_EFILING_URL=https://ez.hasil.gov.my
```

### 6.4 Engagement Database Schema (SQLite)

In addition to the existing `sessions` and `audit_log` tables, add an engagement tracking database:

```sql
-- ~/engagements.db

CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,          -- e.g. "ABC-SDN-BHD"
  company_name TEXT NOT NULL,
  ssm_reg_no TEXT,
  tax_ref_no TEXT,                     -- LHDN tax reference
  entity_type TEXT,                    -- sdn-bhd, plt, partnership, sole-prop
  reporting_framework TEXT,            -- mpers, mfrs
  financial_year_end TEXT,             -- e.g. "12-31" (month-day)
  audit_required INTEGER DEFAULT 1,
  engagement_partner TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  registered_address TEXT,
  business_address TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS engagements (
  engagement_id TEXT PRIMARY KEY,      -- e.g. "ABC-AUDIT-2025"
  client_id TEXT REFERENCES clients(client_id),
  engagement_type TEXT,                -- audit, tax, compilation
  financial_year_end DATE,
  status TEXT DEFAULT 'planning',      -- planning, fieldwork, completion, review, finalised
  materiality_amount REAL,
  partner_name TEXT,
  manager_name TEXT,
  folder_path TEXT,
  started_at TEXT,
  completed_at TEXT,
  filed_at TEXT
);

CREATE TABLE IF NOT EXISTS engagement_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engagement_id TEXT REFERENCES engagements(engagement_id),
  task_name TEXT,
  task_type TEXT,                      -- planning, fieldwork, completion
  status TEXT DEFAULT 'pending',       -- pending, in-progress, review, done
  assigned_to TEXT,                    -- 'ai' or human name
  workpaper_ref TEXT,
  file_path TEXT,
  notes TEXT,
  created_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS tax_filings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT REFERENCES clients(client_id),
  year_of_assessment INTEGER,
  form_type TEXT,                      -- form-c, form-pt, form-b, form-be, cp204
  filing_deadline DATE,
  filed_date DATE,
  tax_payable REAL,
  tax_paid REAL,
  status TEXT DEFAULT 'pending',       -- pending, prepared, reviewed, filed
  computation_path TEXT,
  acknowledgement_no TEXT
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT REFERENCES clients(client_id),
  deadline_type TEXT,                  -- audit-report, tax-filing, ssm-return, agm
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'upcoming',      -- upcoming, due-soon, overdue, completed
  completed_date DATE,
  reminder_sent INTEGER DEFAULT 0
);
```

---

## 7. Implementation Phases & Timeline

### Phase 1 — Foundation (Week 1-2)

| Task | Description | Effort |
|------|-------------|--------|
| Mac Mini setup | Install all software, configure accounts | 1 day |
| Deploy Agent K | Clone repo, configure `.env`, run setup scripts | 1 day |
| Folder structure | Create `/engagements/templates/` hierarchy | 1 day |
| Populate templates | Firm's existing Excel/Word templates into structure | 2-3 days |
| Engagement database | Create `engagements.db` with schema above | 0.5 day |
| Test end-to-end | Send message via Telegram → get response with file | 0.5 day |

**Deliverable:** Working Agent K that can receive instructions, work with files, and send deliverables back via Telegram.

### Phase 2 — Core Skills (Week 3-5)

| Task | Description | Effort |
|------|-------------|--------|
| `/client-setup` skill | Onboard new clients, create folders | 2 days |
| `/prepare-fs` skill | Financial statement generation from TB | 3-4 days |
| `/tax-computation` skill | Full corporate tax computation | 3-4 days |
| `/compile-accounts` skill | Compilation engagement workflow | 2 days |
| `/billing` skill | Invoice generation for engagements | 1 day |
| `/correspondence` skill | Client communication templates | 1 day |

**Deliverable:** AI staff can handle compilation and tax computation engagements end-to-end.

### Phase 3 — Audit Skills (Week 6-9)

| Task | Description | Effort |
|------|-------------|--------|
| `/audit-planning` skill | Planning memo, materiality, analytics | 3 days |
| `/audit-workpaper` skill | Individual workpaper preparation | 5-7 days |
| `/audit-completion` skill | Completion procedures | 2-3 days |
| `/audit-report` skill | Auditor's report generation | 2 days |
| `/management-letter` skill | Findings and recommendations | 1-2 days |
| Audit software MCP | Integration with firm's audit tool | 3-5 days |

**Deliverable:** AI staff can perform audit fieldwork, prepare working papers, and draft reports.

### Phase 4 — Advanced Features (Week 10-12)

| Task | Description | Effort |
|------|-------------|--------|
| `/tax-estimate` skill | CP204 and revision calculations | 2 days |
| `/tax-filing` skill | Filing checklist and tracking | 2 days |
| `/secretarial-checklist` | SSM compliance tracking | 1 day |
| Deadline monitoring | Automated deadline reminders via Telegram | 2 days |
| Google Drive integration | Backup engagement files to Drive | 2 days |
| PDF extraction MCP | Read client-provided PDFs | 1-2 days |

**Deliverable:** Full-featured AI staff covering audit, tax, compilation, and compliance monitoring.

---

## 8. Workflow Examples

### Example 1: Tax Computation

```
Human:  "Prepare the tax computation for ABC Sdn Bhd FYE 31 Dec 2025.
         Here's the finalised P&L."
         [uploads Excel file]

Agent K: "Processing... Reading P&L file"
         [Opens the P&L, reads figures]
         [Opens tax computation template]
         [Maps P&L items to tax adjustments]
         [Calculates capital allowances from FA register]
         [Computes chargeable income and tax payable]

Agent K: [Sends tax-computation.xlsx via Telegram]
         "Tax computation for ABC Sdn Bhd (YA 2025):
          • Revenue: RM 2,450,000
          • Adjusted income: RM 385,000
          • Capital allowances: RM 45,200
          • Chargeable income: RM 339,800
          • Tax payable: RM 52,170
            (15% on first RM150k + 17% on balance)

          Please review. Reply 'ok' to file or let me know
          if any adjustments needed."
```

### Example 2: Statutory Audit

```
Human:  "Start the audit for XYZ Sdn Bhd FYE 31 Dec 2025.
         Here's the TB from their accounting software."
         [uploads trial-balance.xlsx]

Agent K: "Got it. Let me set up the engagement and begin planning."
         [Creates folder /engagements/2025/xyz-sdn-bhd/audit/]
         [Reads TB, identifies account groupings]
         [Calculates materiality: 1% of revenue = RM 89,500]
         [Performs preliminary analytical review]
         [Generates planning memo]

Agent K: [Sends audit-planning-memo.docx via Telegram]
         "Audit planning for XYZ Sdn Bhd (FYE 31/12/2025):
          • Revenue: RM 8,950,000 (up 12% from PY)
          • Materiality: RM 89,500 (1% of revenue)
          • Performance materiality: RM 67,125 (75%)
          • Key risk areas identified:
            - Revenue recognition (significant increase)
            - Trade debtors (aging shows overdue >90 days)
            - Related party transactions

          Planning memo attached. Shall I proceed with
          preparing the working papers?"

Human:  "Yes, start with debtors and revenue"

Agent K: [Opens leadsheet template, maps TB figures]
         [Prepares debtors aging analysis]
         [Selects sample for debtors confirmation]
         [Prepares revenue testing workpaper]
         [Sends files back for review]
```

### Example 3: Compilation

```
Human:  "Compile the accounts for DEF PLT FYE 30 June 2025.
         They are audit-exempt. Here's their QB export."
         [uploads quickbooks-export.xlsx]

Agent K: [Reads QB export, maps to TB]
         [Opens compilation FS template for PLT]
         [Generates financial statements]
         [Prepares compilation report]
         [Generates notes to accounts]

Agent K: [Sends compiled-fs-def-plt.xlsx + compilation-report.docx]
         "Compilation completed for DEF PLT (FYE 30/06/2025):
          • Total assets: RM 456,000
          • Revenue: RM 1,230,000
          • Net profit: RM 78,500

          Compilation report and FS attached.
          Please review before we send to client."

Human:  "Looks good. Email to the client."

Agent K: [Sends email with FS and compilation report attached]
         "Email sent to def.plt@email.com with CC to the firm."
```

---

## 9. Malaysia Regulatory Reference

### Key Legislation

| Law | Relevance |
|-----|-----------|
| Companies Act 2016 (CA 2016) | Company formation, directors duties, financial statements, audit requirements |
| Income Tax Act 1967 (ITA 1967) | Corporate and individual taxation |
| Limited Liability Partnerships Act 2012 | LLP/PLT formation and compliance |
| Sales Tax Act 2018 / Service Tax Act 2018 | SST registration and compliance |
| AMLATFPUAA 2001 | Anti-money laundering, client due diligence |
| Employment Act 1955 (Amended 2022) | Payroll, statutory deductions |
| Stamp Act 1949 | Stamp duty on instruments |

### Professional Standards

| Standard | Application |
|----------|-------------|
| ISA (International Standards on Auditing) | As adopted by MIA — all statutory audits |
| MPERS (Malaysian Private Entities Reporting Standard) | Private companies (most Sdn Bhd) |
| MFRS (Malaysian Financial Reporting Standards) | Public interest entities, listed companies |
| ISRS 4410 (Revised) | Compilation engagements |
| By-Laws of the Malaysian Institute of Accountants | Professional conduct, independence |
| Tax Practice Notes (LHDN) | Tax filing and compliance guidance |

### Key Tax Deadlines

| Item | Deadline | Penalty |
|------|----------|---------|
| Form C (Sdn Bhd) | 7 months after FYE | Late filing penalty + s.112(3) fine |
| Form PT (LLP) | 7 months after FYE | Late filing penalty |
| CP204 (Tax estimate) | 30 days before basis period | 10% s.107C on underestimation >30% |
| CP204A (Revision) | 6th or 9th month of basis period | — |
| Monthly tax instalment (CP500) | 15th of each month | 10% uplift on shortfall |
| Form E (Employer return) | 31 March | Fine up to RM20,000 / 6 months imprisonment |
| SST-02 return | Bimonthly (2-month taxable period) | Penalty 10-40% of tax due |
| EPF contribution | 15th of following month | Late payment charges |
| SOCSO/EIS contribution | 15th of following month | Late payment charges |

### Statutory Deduction Rates (2025)

| Contribution | Employee | Employer |
|-------------|----------|----------|
| EPF | 9% (mandatory, up to 11% voluntary) | 12% (salary >RM5k) / 13% (salary <=RM5k) |
| SOCSO — Employment Injury | — | Category 1: varies by salary |
| SOCSO — Invalidity | 0.5% | 1.75% |
| EIS | 0.2% | 0.2% |
| PCB/MTD | Per LHDN schedule | Employer remits monthly |

---

## 10. Security Considerations

### Data Protection

| Concern | Mitigation |
|---------|------------|
| Client financial data on Mac Mini | FileVault disk encryption enabled |
| Telegram messages contain client info | Use private bot, restrict via ALLOWED_CHAT_IDS |
| SQLite databases unencrypted | Mac Mini is single-purpose, physically secured |
| Claude CLI processes client data | Data stays on local machine, not sent to third parties beyond Claude API |
| Engagement files | Regular backup to encrypted external drive or Google Drive |

### Access Control

| Layer | Control |
|-------|---------|
| Telegram bot | ALLOWED_TELEGRAM_IDS restricts to authorised staff only |
| Chat restriction | ALLOWED_CHAT_IDS limits which chats the bot responds in |
| Mac Mini | macOS login password, auto-lock after inactivity |
| Audit software | Separate login credentials |
| Gmail/Google | 2FA enabled on dedicated AI staff account |

### Audit Trail

- All messages logged in `audit_log` table (existing)
- Engagement activities tracked in `engagement_tasks` table (new)
- File modifications tracked via Git (optional — version control engagement files)
- Tax filing status tracked in `tax_filings` table (new)

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI makes incorrect tax computation | Wrong tax payable, penalties | Human always reviews before filing; AI flags assumptions |
| AI misclassifies audit adjustments | Misstatement in FS | Partner review of all workpapers before sign-off |
| Template version mismatch | Wrong format used | Version-tag templates (e.g. v2025.1); skill references specific versions |
| Claude CLI downtime | Cannot process requests | Monitor via /test command; fallback to manual work |
| Audit software API changes | MCP integration breaks | Pin API versions; test after software updates |
| Client data breach | Regulatory and reputational risk | Encryption, access control, regular security review |
| Over-reliance on AI | Staff lose technical skills | Use AI as assistant, not replacement; mandatory human review |
| LHDN/SSM regulatory changes | Outdated templates and rates | Annual review of all templates and tax rate tables |

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Tax computation preparation time | 70% reduction (from ~4 hours to ~1 hour including review) |
| Working paper preparation time | 60% reduction per workpaper section |
| FS compilation time | 75% reduction (from ~2 days to ~4 hours including review) |
| Filing deadline compliance | 100% on-time (with deadline monitoring) |
| Error rate in AI-prepared deliverables | <5% requiring material correction after human review |
| Client correspondence response time | Same-day turnaround on standard requests |
| Staff capacity increase | Each human staff can manage 40-50% more engagements |

---

## 13. Summary

The Agent K codebase provides a solid foundation for building an AI staff member for a Malaysia accounting firm. The core architecture (Telegram interface, Claude CLI brain, MCP server plugins, skill-based task execution) maps directly to the accounting workflow:

- **Templates** are the firm's know-how, stored in structured folders
- **Skills** encode the firm's procedures into repeatable instructions
- **MCP servers** connect the AI to audit software and productivity tools
- **Telegram** is the natural interface for human staff to instruct and review
- **Human review** remains the final gate before any deliverable goes to the client

The implementation is incremental — start with compilation and tax (simpler, high volume), then build up to full statutory audit support. Each phase delivers immediate value while building toward a comprehensive AI-assisted practice.

---

*This plan is specific to Malaysia-registered accounting firms operating under MIA standards, CA 2016, and ITA 1967. Tax rates, deadlines, and regulatory references are based on YA 2025 rules and should be updated annually.*
