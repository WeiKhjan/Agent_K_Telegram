---
name: ap-recon-pmg
description: Reconcile GL entries (Vendor source type) against AP-GRN reports from PMG POS system. Use when asked to do AP reconciliation, GL vs GRN trace, vendor reconciliation, AP-GRN recon, or purchase reconciliation.
---

Reconcile General Ledger Vendor entries against PMG AP-GRN (Accounts Payable - Goods Received Note) data. Matches GL entries to GRN transactions using External Document No. = Invoice No and Source No. = Vendor Code, producing a color-coded Excel report.

## Prerequisites

User must provide **two files**:
1. **General Ledger Entries** — Excel (.xlsx) exported from Business Central / NAV
2. **AP-GRN Report** — CSV or Excel exported from PMG POS system

These are typically uploaded via Telegram. Use the downloaded file paths.

## How It Works

### GL Filtering

GL entries are filtered by **Source Type = "Vendor"** (column index 6 in standard BC export).

### Matching Logic

Matching uses two fields:
1. **External Document No.** (GL) ↔ **Invoice No** (GRN) — primary match key
2. **Source No.** (GL) ↔ **Vendor Identifier Code** (GRN) — vendor confirmation

| Match Type | Condition | Status |
|---|---|---|
| Vendor + Invoice | Both External Doc No. = Invoice No AND Source No. = Vendor Code | Match |
| Invoice Only | External Doc No. = Invoice No but different Vendor Code | Match with Discrepancy |
| Amount Mismatch | Keys match but amounts differ (> RM0.01) | Match with Discrepancy |
| GL Only | GL entry with no matching GRN record | Unmatch (GL only) |
| GRN Only | GRN record with no matching GL entry | Unmatch (GRN only) |

### Store Detection

The store code is auto-detected from the GL Branch Code column (most frequent value).

## Steps

1. **Identify the uploaded files** — GL entries (.xlsx) and AP-GRN report (.csv or .xlsx)
2. **Write the Python script to /tmp/ap_recon_pmg.py** (see Script section below)
3. **Run the reconciliation script** using the office venv Python:

```bash
/Users/aitraining2u/.local/share/office-venv/bin/python /tmp/ap_recon_pmg.py \
  --gl "GL_FILE_PATH" \
  --grn "GRN_FILE_PATH" \
  --out "OUTPUT_FILE_PATH"
```

4. **Send the output file** to the user via the `send-file` skill
5. **Summarize results** — match counts, discrepancies, financial totals

## Output

Excel workbook with 4 color-coded sheets:

1. **Comparison** — each GL Vendor entry matched against GRN (green=Match, yellow=Discrepancy, red=GL only, blue=GRN only)
2. **GL Entries (Vendor)** — raw GL data filtered by Source Type = "Vendor"
3. **AP-GRN Report** — all GRN entries with parsed amounts
4. **Summary** — reconciliation counts, financial totals by status

## Script

Write this script to `/tmp/ap_recon_pmg.py` before execution:

```python
import openpyxl, re, csv, sys, argparse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from collections import defaultdict, Counter

parser = argparse.ArgumentParser()
parser.add_argument('--gl', required=True, help='GL entries Excel file')
parser.add_argument('--grn', required=True, help='AP-GRN report file (CSV or XLSX)')
parser.add_argument('--out', required=True, help='Output Excel file path')
args = parser.parse_args()

GL_FILE = args.gl
GRN_FILE = args.grn
OUT_FILE = args.out

# ── Styles ──
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill("solid", fgColor="2F5496")
match_fill = PatternFill("solid", fgColor="C6EFCE")       # green
unmatch_fill = PatternFill("solid", fgColor="FFC7CE")      # red (GL only)
discrep_fill = PatternFill("solid", fgColor="FFEB9C")      # yellow
grn_only_fill = PatternFill("solid", fgColor="BDD7EE")     # blue (GRN only)
thin_border = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)
num_fmt = '#,##0.00'

def style_header(ws, cols):
    for c in range(1, cols + 1):
        cell = ws.cell(row=1, column=c)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', wrap_text=True)
        cell.border = thin_border
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions

def auto_width(ws):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 3, 35)

def parse_rm(s):
    """Parse RM currency strings like 'RM3,963.77' or '-RM500.00'"""
    if s is None:
        return 0.0
    s = str(s).strip().strip('"').strip()
    neg = s.startswith('-')
    if neg:
        s = s[1:]
    s = s.replace('RM', '').replace(',', '').strip()
    try:
        v = float(s)
        return -v if neg else v
    except:
        return 0.0

# ── Load GL entries, filter by Source Type = Vendor ──
wb_gl = openpyxl.load_workbook(GL_FILE)
ws_gl = wb_gl.active
gl_headers = [cell.value for cell in ws_gl[1]]

# Find column indices dynamically
def find_col(headers, *names):
    for name in names:
        for i, h in enumerate(headers):
            if h and name.lower() in str(h).lower():
                return i
    return None

col_posting_date = find_col(gl_headers, 'Posting Date')
col_doc_type = find_col(gl_headers, 'Document Type')
col_doc_no = find_col(gl_headers, 'Document No')
col_ext_doc_no = find_col(gl_headers, 'External Document No')
col_gl_acct = find_col(gl_headers, 'G/L Account No')
col_source_code = find_col(gl_headers, 'Source Code')
col_source_type = find_col(gl_headers, 'Source Type')
col_source_no = find_col(gl_headers, 'Source No')
col_acct_name = find_col(gl_headers, 'G/L Account Name', 'Account Name')
col_description = find_col(gl_headers, 'Description')
col_amount = find_col(gl_headers, 'Amount (LCY)', 'Amount')
col_branch = find_col(gl_headers, 'Branch Code', 'Global Dimension 1')
col_debit = find_col(gl_headers, 'Debit Amount')
col_credit = find_col(gl_headers, 'Credit Amount')

print(f"GL columns detected: PostingDate={col_posting_date}, DocNo={col_doc_no}, ExtDocNo={col_ext_doc_no}, SourceType={col_source_type}, SourceNo={col_source_no}, Amount={col_amount}")

gl_vendor_rows = []
for row in ws_gl.iter_rows(min_row=2, values_only=True):
    vals = list(row)
    source_type = str(vals[col_source_type] or '') if col_source_type is not None and col_source_type < len(vals) else ''
    if source_type.strip().lower() == 'vendor':
        gl_vendor_rows.append(vals)

print(f"GL Vendor entries: {len(gl_vendor_rows)}")

# ── Detect primary store (branch) code ──
branch_counts = Counter()
for r in gl_vendor_rows:
    branch = str(r[col_branch] or '') if col_branch is not None and col_branch < len(r) else ''
    if branch:
        branch_counts[branch] += 1
primary_branch = branch_counts.most_common(1)[0][0] if branch_counts else 'UNKNOWN'
print(f"Primary branch: {primary_branch}")

# ── Load AP-GRN Report ──
def load_grn_csv(filepath):
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        raw_lines = f.readlines()
    rows = []
    # Find header row
    start = 0
    for i, line in enumerate(raw_lines):
        if 'Vendor Identifier Code' in line or 'Invoice No' in line:
            start = i + 1
            break
    if start == 0:
        start = 15  # fallback for PMG format
    current_date = None
    current_store = None
    current_vendor_code = None
    current_vendor_name = None
    current_inv_date = None
    for line in raw_lines[start:]:
        parts = []
        in_quote = False
        current = ''
        for ch in line.strip():
            if ch == '"':
                in_quote = not in_quote
            elif ch == ',' and not in_quote:
                parts.append(current)
                current = ''
            else:
                current += ch
        parts.append(current)
        if len(parts) < 10:
            continue
        # Parse fields with carry-forward for grouped rows
        date_val = parts[0].strip()
        store = parts[1].strip()
        vendor_code = parts[2].strip()
        vendor_name = parts[3].strip()
        inv_date = parts[4].strip()
        inv_no = parts[5].strip()
        po_no = parts[6].strip()
        status = parts[7].strip()
        recv_type = parts[8].strip()
        amount_str = parts[9].strip()
        # Skip total/summary rows
        if 'Total' in date_val or 'Total' in store or 'Grand Total' in amount_str:
            continue
        if not inv_no:
            continue
        # Carry forward grouped fields
        if date_val:
            current_date = date_val
        if store and 'Total' not in store:
            current_store = store
        if vendor_code:
            current_vendor_code = vendor_code
            current_vendor_name = vendor_name
        if inv_date and 'Total' not in inv_date:
            current_inv_date = inv_date
        amount = parse_rm(amount_str)
        rows.append([
            current_date or '', current_store or '',
            current_vendor_code or '', current_vendor_name or '',
            current_inv_date or '', inv_no, po_no, status, recv_type, amount
        ])
    return rows

def load_grn_xlsx(filepath):
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    rows = []
    # Find header row
    header_row = 1
    for r in range(1, min(20, ws.max_row + 1)):
        cell_val = str(ws.cell(row=r, column=1).value or '')
        if 'Date' in cell_val or 'Vendor' in cell_val:
            header_row = r
            break
    for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
        vals = list(row)
        if len(vals) < 10:
            continue
        inv_no = str(vals[5] or '').strip()
        if not inv_no or 'Total' in str(vals[0] or '') or 'Total' in str(vals[1] or ''):
            continue
        amount = vals[9]
        if isinstance(amount, str):
            amount = parse_rm(amount)
        elif amount is None:
            amount = 0.0
        rows.append([
            str(vals[0] or ''), str(vals[1] or ''), str(vals[2] or ''),
            str(vals[3] or ''), str(vals[4] or ''), inv_no,
            str(vals[6] or ''), str(vals[7] or ''), str(vals[8] or ''), amount
        ])
    return rows

if GRN_FILE.lower().endswith('.csv'):
    grn_rows = load_grn_csv(GRN_FILE)
else:
    grn_rows = load_grn_xlsx(GRN_FILE)

print(f"AP-GRN entries: {len(grn_rows)}")

# ── Build GRN lookup by Invoice No ──
# Multiple GRN entries can share an invoice no (different vendors), so group by (vendor_code, invoice_no)
grn_by_inv = defaultdict(list)
for r in grn_rows:
    inv_no = r[5].strip()
    vendor_code = r[2].strip()
    grn_by_inv[inv_no].append(r)

# Also build by vendor+invoice for precise matching
grn_by_vendor_inv = {}
for r in grn_rows:
    key = (r[2].strip(), r[5].strip())
    grn_by_vendor_inv[key] = r

# ── Reconcile ──
comparison_rows = []
matched_grn_keys = set()  # Track matched GRN entries by (vendor_code, invoice_no)

for gl_row in gl_vendor_rows:
    posting_date = gl_row[col_posting_date]
    doc_type = str(gl_row[col_doc_type] or '') if col_doc_type is not None else ''
    doc_no = str(gl_row[col_doc_no] or '')
    ext_doc_no = str(gl_row[col_ext_doc_no] or '').strip()
    source_no = str(gl_row[col_source_no] or '').strip()
    gl_acct = str(gl_row[col_gl_acct] or '')
    acct_name = str(gl_row[col_acct_name] or '') if col_acct_name is not None else ''
    description = str(gl_row[col_description] or '') if col_description is not None else ''
    gl_amount = gl_row[col_amount] if col_amount is not None else 0
    if gl_amount is None:
        gl_amount = 0
    pd_str = posting_date.strftime('%Y-%m-%d') if isinstance(posting_date, datetime) else str(posting_date or '')

    # Try match by vendor + invoice first (most precise)
    key_precise = (source_no, ext_doc_no)
    grn_match = grn_by_vendor_inv.get(key_precise)

    if grn_match:
        matched_grn_keys.add((grn_match[2].strip(), grn_match[5].strip()))
        grn_amount = grn_match[9]
        gl_abs = abs(gl_amount)
        diff = round(grn_amount - gl_abs, 2)
        if abs(diff) < 0.01:
            status = 'Match'
        else:
            status = 'Match with Discrepancy'
        match_type = 'Vendor + Invoice'
        comparison_rows.append([
            pd_str, doc_no, ext_doc_no, source_no, gl_acct, acct_name, description, gl_amount,
            grn_match[0], grn_match[2], grn_match[3], grn_match[5], grn_match[6],
            grn_amount, diff, status, match_type
        ])
    elif ext_doc_no and ext_doc_no in grn_by_inv:
        # Match by invoice no only (vendor may differ)
        candidates = grn_by_inv[ext_doc_no]
        grn_match = candidates[0]  # Take first match
        matched_grn_keys.add((grn_match[2].strip(), grn_match[5].strip()))
        grn_amount = grn_match[9]
        gl_abs = abs(gl_amount)
        diff = round(grn_amount - gl_abs, 2)
        if abs(diff) < 0.01 and source_no == grn_match[2].strip():
            status = 'Match'
            match_type = 'Vendor + Invoice'
        elif abs(diff) < 0.01:
            status = 'Match with Discrepancy'
            match_type = 'Invoice Only (Vendor Mismatch)'
        else:
            status = 'Match with Discrepancy'
            match_type = 'Invoice Only'
        comparison_rows.append([
            pd_str, doc_no, ext_doc_no, source_no, gl_acct, acct_name, description, gl_amount,
            grn_match[0], grn_match[2], grn_match[3], grn_match[5], grn_match[6],
            grn_amount, diff, status, match_type
        ])
    else:
        # No match — GL only
        comparison_rows.append([
            pd_str, doc_no, ext_doc_no, source_no, gl_acct, acct_name, description, gl_amount,
            '', '', '', '', '',
            0, abs(gl_amount), 'Unmatch (GL only)', 'No GRN Match'
        ])

# ── Unmatched GRN entries ──
unmatched_grn = []
for r in grn_rows:
    key = (r[2].strip(), r[5].strip())
    if key not in matched_grn_keys:
        unmatched_grn.append(r)

# Add unmatched GRN to comparison
for r in unmatched_grn:
    comparison_rows.append([
        '', '', '', '', '', '', '', 0,
        r[0], r[2], r[3], r[5], r[6],
        r[9], 0, 'Unmatch (GRN only)', 'No GL Match'
    ])

# ── Write output workbook ──
wb_out = openpyxl.Workbook()

# Sheet 1: Comparison
ws1 = wb_out.active
ws1.title = 'Comparison'
comp_headers = [
    'GL Posting Date', 'GL Document No.', 'GL External Doc No.', 'GL Source No. (Vendor)',
    'GL Account No.', 'GL Account Name', 'GL Description', 'GL Amount (LCY)',
    'GRN Date', 'GRN Vendor Code', 'GRN Vendor Name', 'GRN Invoice No', 'GRN PO No',
    'GRN Amount', 'Difference', 'Match Status', 'Match Type'
]
ws1.append(comp_headers)
for r in comparison_rows:
    ws1.append(r)
style_header(ws1, len(comp_headers))
for row in ws1.iter_rows(min_row=2, max_row=ws1.max_row):
    for cell in row:
        cell.border = thin_border
    row[7].number_format = num_fmt   # GL Amount
    row[13].number_format = num_fmt  # GRN Amount
    row[14].number_format = num_fmt  # Difference
    status = str(row[15].value or '')
    fill = None
    if status == 'Match':
        fill = match_fill
    elif 'Discrepancy' in status:
        fill = discrep_fill
    elif 'GL only' in status:
        fill = unmatch_fill
    elif 'GRN only' in status:
        fill = grn_only_fill
    if fill:
        for cell in row:
            cell.fill = fill
auto_width(ws1)

# Sheet 2: GL Entries (Vendor)
ws2 = wb_out.create_sheet('GL Entries (Vendor)')
gl_out_headers = ['Posting Date', 'Document Type', 'Document No.', 'External Document No.',
                  'Source No.', 'G/L Account No.', 'G/L Account Name', 'Description',
                  'Amount (LCY)', 'Debit Amount (LCY)', 'Credit Amount (LCY)', 'Branch Code']
gl_col_indices = [col_posting_date, col_doc_type, col_doc_no, col_ext_doc_no,
                  col_source_no, col_gl_acct, col_acct_name, col_description,
                  col_amount, col_debit, col_credit, col_branch]
ws2.append(gl_out_headers)
for r in gl_vendor_rows:
    out = []
    for i in gl_col_indices:
        if i is not None and i < len(r):
            v = r[i]
            if isinstance(v, datetime):
                v = v.strftime('%Y-%m-%d')
            out.append(v)
        else:
            out.append('')
    ws2.append(out)
style_header(ws2, len(gl_out_headers))
for row in ws2.iter_rows(min_row=2, max_row=ws2.max_row):
    for cell in row:
        cell.border = thin_border
    row[8].number_format = num_fmt
    row[9].number_format = num_fmt
    row[10].number_format = num_fmt
auto_width(ws2)

# Sheet 3: AP-GRN Report
ws3 = wb_out.create_sheet('AP-GRN Report')
grn_headers = ['Date', 'Store', 'Vendor Identifier Code(Goods Receive Note)',
               'Vendor(Goods Receive Note)', 'Invoice Date', 'Invoice No',
               'PO No', 'Status', 'Receive Type', 'Total Received Cost Amount Total']
ws3.append(grn_headers)
for r in grn_rows:
    ws3.append(r)
style_header(ws3, len(grn_headers))
for row in ws3.iter_rows(min_row=2, max_row=ws3.max_row):
    for cell in row:
        cell.border = thin_border
    row[9].number_format = num_fmt
auto_width(ws3)

# Sheet 4: Summary
ws4 = wb_out.create_sheet('Summary')
ws4.append(['Status', 'Count', 'Total GL Amount (abs)', 'Total GRN Amount'])
style_header(ws4, 4)

status_groups = defaultdict(lambda: {'count': 0, 'gl_abs': 0.0, 'grn': 0.0})
for r in comparison_rows:
    status = r[15]
    gl_amt = abs(r[7]) if isinstance(r[7], (int, float)) else 0
    grn_amt = r[13] if isinstance(r[13], (int, float)) else 0
    status_groups[status]['count'] += 1
    status_groups[status]['gl_abs'] += gl_amt
    status_groups[status]['grn'] += grn_amt

total_count = 0
total_gl = 0.0
total_grn = 0.0
for status in ['Match', 'Match with Discrepancy', 'Unmatch (GL only)', 'Unmatch (GRN only)']:
    g = status_groups.get(status, {'count': 0, 'gl_abs': 0.0, 'grn': 0.0})
    ws4.append([status, g['count'], round(g['gl_abs'], 2), round(g['grn'], 2)])
    total_count += g['count']
    total_gl += g['gl_abs']
    total_grn += g['grn']

ws4.append(['TOTAL', total_count, round(total_gl, 2), round(total_grn, 2)])

for row in ws4.iter_rows(min_row=2, max_row=ws4.max_row):
    for cell in row:
        cell.border = thin_border
    row[1].number_format = '#,##0'
    row[2].number_format = num_fmt
    row[3].number_format = num_fmt
    # Color code
    status = str(row[0].value or '')
    fill = None
    if status == 'Match':
        fill = match_fill
    elif 'Discrepancy' in status:
        fill = discrep_fill
    elif 'GL only' in status:
        fill = unmatch_fill
    elif 'GRN only' in status:
        fill = grn_only_fill
    if fill:
        for cell in row:
            cell.fill = fill

ws4.column_dimensions['A'].width = 30
ws4.column_dimensions['B'].width = 12
ws4.column_dimensions['C'].width = 22
ws4.column_dimensions['D'].width = 22

wb_out.save(OUT_FILE)

# Print results
print(f"\nSaved: {OUT_FILE}")
print(f"Primary branch: {primary_branch}")
print(f"\nReconciliation Summary:")
for status in ['Match', 'Match with Discrepancy', 'Unmatch (GL only)', 'Unmatch (GRN only)']:
    g = status_groups.get(status, {'count': 0, 'gl_abs': 0.0, 'grn': 0.0})
    print(f"  {status}: {g['count']} (GL: {g['gl_abs']:.2f}, GRN: {g['grn']:.2f})")
print(f"  TOTAL: {total_count}")
print(f"\nUnmatched GRN entries: {len(unmatched_grn)}")
```

## Usage Flow

1. User uploads GL file and AP-GRN report (via Telegram or specifies paths)
2. Write the script above to `/tmp/ap_recon_pmg.py`
3. Determine output filename: `GL_vs_APGRN_Vendor_Trace_{StoreName}_{Period}.xlsx`
4. Run the script with the office venv Python
5. Send the output file to the user
6. Present the summary (match counts, discrepancies, financial totals)

## Arguments
- `$ARGUMENTS` — optional: store name and period for the output filename (e.g., "Keningau Oct 2025")
- If not provided, derive from file names or ask

## Important Notes
- GL file column layout follows Business Central / NAV standard export — columns are detected dynamically by header name
- AP-GRN CSV from PMG has 14 header rows before data — the script auto-detects by looking for "Vendor Identifier Code"
- GRN CSV uses carry-forward for Date, Store, Vendor fields (grouped rows share these values)
- Amounts in GRN CSV are formatted as "RM3,963.77" — parsed automatically
- The script handles both CSV and XLSX GRN files
- GL Amount is typically negative for purchases (credit), GRN Amount is positive — comparison uses absolute GL values
