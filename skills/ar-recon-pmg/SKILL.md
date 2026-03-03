---
name: ar-recon-pmg
description: Reconcile GL entries (40xxx accounts) against Daily Sales Item reports from PMG POS system. Use when asked to do AR reconciliation, GL vs Daily Sales trace, sales reconciliation, or PMG recon.
---

Reconcile General Ledger 40xxx (revenue) entries against PMG Daily Sales Item data. Matches GL document numbers to daily sales transactions and produces a color-coded Excel report.

## Prerequisites

User must provide **two files**:
1. **General Ledger Entries** — Excel (.xlsx) exported from Business Central / NAV
2. **Daily Sales Item** — CSV or Excel exported from PMG POS system

These are typically uploaded via Telegram. Use the downloaded file paths.

## How It Works

### Matching Logic

GL Document No. patterns determine match strategy:

| Pattern | Example | Strategy |
|---|---|---|
| `{StoreCode}{YYYYMMDD}` | `PS003KNG20251001` | **Daily Aggregate** — sum all daily sales for that date, compare to GL amount |
| `{StoreCode}{YYYYMMDD}-N` | `PS003KNG20251019-1` | **Adjustment Entry** — flagged, not matched |
| `{StoreCode}INV{N}` | `PS003KNGINV12345` | **Individual Credit Sale** — match by Sales No |
| `{StoreCode}CSR{N}` | `PS003KNGCSR67890` | **Individual Sales Return** — match by Sales No |
| `{StoreCode}X{N}` | `PS003KNGX99999` | **Individual Other** — match by Sales No |
| `{OtherStore}...` | `PS030KN3...` | **Different Store** — flagged as unmatch |
| Pure numeric | `12345` | **Individual** — match by Sales No directly |

### Store Code Detection

The primary store code is auto-detected from the most frequent prefix in GL Document No. column. All other store prefixes are flagged as "Different Store".

## Steps

1. **Identify the uploaded files** — GL entries (.xlsx) and Daily Sales (.csv or .xlsx)
2. **Detect store code and file format** — inspect the GL file to find the dominant store prefix
3. **Run the reconciliation script** using the office venv Python:

```bash
/Users/aitraining2u/.local/share/office-venv/bin/python /tmp/ar_recon_pmg.py \
  --gl "GL_FILE_PATH" \
  --ds "DS_FILE_PATH" \
  --out "OUTPUT_FILE_PATH"
```

4. **Write the Python script to /tmp/ar_recon_pmg.py** before running (see Script section below)
5. **Send the output file** to the user via the `send-file` skill
6. **Summarize results** — match counts, discrepancies, financial totals

## Output

Excel workbook with 5 color-coded sheets:

1. **Comparison** — each GL entry matched against Daily Sales (green=Match, yellow=Discrepancy, red=Unmatch)
2. **GL Entries (40xxx)** — raw GL data filtered to revenue accounts
3. **Daily Sales Items** — all transaction-level rows from POS
4. **Summary** — reconciliation counts, financial totals, notes
5. **Unmatched Daily Sales** — sales transactions with no corresponding GL entry

## Script

Write this script to `/tmp/ar_recon_pmg.py` before execution:

```python
import openpyxl, re, csv, sys, argparse
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from collections import defaultdict, Counter

parser = argparse.ArgumentParser()
parser.add_argument('--gl', required=True, help='GL entries Excel file')
parser.add_argument('--ds', required=True, help='Daily Sales file (CSV or XLSX)')
parser.add_argument('--out', required=True, help='Output Excel file path')
args = parser.parse_args()

GL_FILE = args.gl
DS_FILE = args.ds
OUT_FILE = args.out

# ── Styles ──
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill("solid", fgColor="2F5496")
match_fill = PatternFill("solid", fgColor="C6EFCE")
unmatch_fill = PatternFill("solid", fgColor="FFC7CE")
discrep_fill = PatternFill("solid", fgColor="FFEB9C")
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
    s = s.strip().strip('"').strip()
    neg = s.startswith('-')
    if neg:
        s = s[1:]
    s = s.replace('RM', '').replace(',', '').strip()
    try:
        v = float(s)
        return -v if neg else v
    except:
        return 0.0

# ── Load GL 40xx entries ──
wb_gl = openpyxl.load_workbook(GL_FILE)
ws_gl = wb_gl.active
gl_headers = [cell.value for cell in ws_gl[1]]

gl_40_rows = []
for row in ws_gl.iter_rows(min_row=2, values_only=True):
    acct = str(row[5]) if row[5] else ''
    if acct.startswith('40'):
        gl_40_rows.append(list(row))

# ── Detect primary store code ──
prefix_counts = Counter()
for r in gl_40_rows:
    doc_no = str(r[4])
    m = re.match(r'^([A-Z]+\d*[A-Z]*)', doc_no)
    if m:
        prefix_counts[m.group(1)] += 1

primary_store = prefix_counts.most_common(1)[0][0] if prefix_counts else 'UNKNOWN'
print(f"Primary store code detected: {primary_store}")
other_stores = {k for k in prefix_counts if k != primary_store}

# ── Load Daily Sales ──
def load_ds_csv(filepath):
    with open(filepath, 'r') as f:
        raw_lines = f.readlines()
    rows = []
    current_date = None
    current_store = None
    # Skip header rows — find where data starts
    start = 0
    for i, line in enumerate(raw_lines):
        if 'Sales No' in line or 'Sales_No' in line:
            start = i + 1
            break
    if start == 0:
        start = 19  # fallback
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
        if len(parts) < 6:
            continue
        date_val = parts[0].strip()
        store = parts[1].strip()
        sales_no = parts[2].strip()
        if 'Total' in store or 'Grand Total' in parts[0] or not sales_no:
            continue
        if date_val:
            current_date = date_val
        if store and 'Total' not in store:
            current_store = store
        price = parse_rm(parts[4])
        profit = parse_rm(parts[5])
        qty_str = parts[3].strip().replace(',', '')
        try:
            qty = int(qty_str)
        except:
            qty = 0
        rows.append([current_date, current_store or '', sales_no, qty, price, profit])
    return rows

def load_ds_xlsx(filepath):
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    rows = []
    headers = [str(cell.value or '').strip() for cell in ws[1]]
    for row in ws.iter_rows(min_row=2, values_only=True):
        vals = list(row)
        if len(vals) < 6:
            continue
        date_val = str(vals[0] or '').strip()
        store = str(vals[1] or '').strip()
        sales_no = str(vals[2] or '').strip()
        if not sales_no or 'Total' in store:
            continue
        try:
            price = float(vals[4]) if vals[4] else 0.0
        except:
            price = parse_rm(str(vals[4]))
        try:
            profit = float(vals[5]) if vals[5] else 0.0
        except:
            profit = parse_rm(str(vals[5]))
        try:
            qty = int(vals[3]) if vals[3] else 0
        except:
            qty = 0
        rows.append([date_val, store, sales_no, qty, price, profit])
    return rows

if DS_FILE.lower().endswith('.csv'):
    ds_rows = load_ds_csv(DS_FILE)
else:
    ds_rows = load_ds_xlsx(DS_FILE)

print(f"GL 40xx entries: {len(gl_40_rows)}")
print(f"Daily Sales rows: {len(ds_rows)}")

# ── Build lookup structures ──
ds_by_date = defaultdict(list)
for r in ds_rows:
    try:
        d = datetime.strptime(r[0], '%d/%m/%Y')
    except:
        try:
            p = r[0].split('/')
            d = datetime(int(p[2]), int(p[1]), int(p[0]))
        except:
            try:
                d = datetime.strptime(r[0], '%Y-%m-%d')
            except:
                d = None
    if d:
        ds_by_date[d.strftime('%Y%m%d')].append(r)

ds_by_salesno = {}
for r in ds_rows:
    ds_by_salesno[r[2]] = r

# ── Classify and Reconcile ──
comparison_rows = []
matched_sales_nos = set()

def extract_ref_number(doc_no, prefix):
    remainder = doc_no[len(prefix):]
    for p in ['INV', 'CSR', 'X']:
        if remainder.startswith(p):
            return remainder[len(p):]
    return remainder

for gl_row in gl_40_rows:
    doc_no = str(gl_row[4])
    gl_amount = gl_row[10]
    posting_date = gl_row[0]
    acct = str(gl_row[5])
    acct_name = gl_row[8]
    desc = gl_row[9]
    pd_str = posting_date.strftime('%Y-%m-%d') if isinstance(posting_date, datetime) else str(posting_date or '')

    # Pattern 1: Primary store daily aggregate (e.g., PS003KNG20251001)
    pat_daily = f'^{re.escape(primary_store)}\\d{{8}}$'
    pat_adj = f'^{re.escape(primary_store)}\\d{{8}}-'

    if re.match(pat_daily, doc_no):
        date_key = doc_no[len(primary_store):]
        ds_for_date = ds_by_date.get(date_key, [])
        ds_sum = sum(r[4] for r in ds_for_date)
        ds_count = len(ds_for_date)
        for r in ds_for_date:
            matched_sales_nos.add(r[2])
        gl_abs = abs(gl_amount)
        diff = round(ds_sum - gl_abs, 2)
        if ds_count == 0:
            status = 'Unmatch - No Daily Sales'
        elif abs(diff) < 0.01:
            status = 'Match'
        else:
            status = 'Match with Discrepancy'
        comparison_rows.append([
            pd_str, doc_no, acct, acct_name, gl_amount,
            f'{ds_count} transactions', ds_sum, diff, status, 'Daily Aggregate'
        ])

    elif re.match(pat_adj, doc_no):
        date_key = doc_no[len(primary_store):len(primary_store)+8]
        ds_for_date = ds_by_date.get(date_key, [])
        ds_sum = sum(r[4] for r in ds_for_date)
        comparison_rows.append([
            pd_str, doc_no, acct, acct_name, gl_amount,
            f'Adj entry (date: {date_key})', ds_sum, 0, 'Note - Adjustment Entry', 'Adjustment'
        ])

    elif doc_no.startswith(primary_store):
        ref_no = extract_ref_number(doc_no, primary_store)
        tx_type = 'Credit Sale' if 'INV' in doc_no else 'Sales Return' if 'CSR' in doc_no else 'Other'
        ds_match = ds_by_salesno.get(ref_no)
        if ds_match:
            matched_sales_nos.add(ref_no)
            ds_price = ds_match[4]
            gl_abs = abs(gl_amount)
            if gl_amount > 0:
                diff = round(abs(ds_price) - gl_amount, 2)
            else:
                diff = round(ds_price - gl_abs, 2)
            status = 'Match' if abs(diff) < 0.01 else 'Match with Discrepancy'
            comparison_rows.append([
                pd_str, doc_no, acct, acct_name, gl_amount,
                f'Sales No: {ref_no} (Date: {ds_match[0]})', ds_price, diff, status, tx_type
            ])
        else:
            comparison_rows.append([
                pd_str, doc_no, acct, acct_name, gl_amount,
                f'Ref {ref_no} NOT FOUND', 0, abs(gl_amount),
                'Unmatch - Not in Daily Sales', tx_type
            ])

    elif any(doc_no.startswith(s) for s in other_stores):
        other = next(s for s in other_stores if doc_no.startswith(s))
        comparison_rows.append([
            pd_str, doc_no, acct, acct_name, gl_amount,
            f'N/A (Store {other})', 0, 0,
            f'Unmatch - Different Store ({other})', 'Different Store'
        ])

    elif doc_no.isdigit():
        ds_match = ds_by_salesno.get(doc_no)
        if ds_match:
            matched_sales_nos.add(doc_no)
            ds_price = ds_match[4]
            gl_abs = abs(gl_amount)
            if gl_amount > 0:
                diff = round(abs(ds_price) - gl_amount, 2)
            else:
                diff = round(ds_price - gl_abs, 2)
            status = 'Match' if abs(diff) < 0.01 else 'Match with Discrepancy'
            comparison_rows.append([
                pd_str, doc_no, acct, acct_name, gl_amount,
                f'Sales No: {doc_no} (Date: {ds_match[0]})', ds_price, diff, status, 'Individual'
            ])
        else:
            comparison_rows.append([
                pd_str, doc_no, acct, acct_name, gl_amount,
                'NOT FOUND', 0, abs(gl_amount),
                'Unmatch - Not in Daily Sales', 'Individual'
            ])
    else:
        comparison_rows.append([
            pd_str, doc_no, acct, acct_name, gl_amount,
            'Unknown pattern', 0, abs(gl_amount),
            'Unmatch - Unknown', 'Unknown'
        ])

# ── Unmatched Daily Sales ──
unmatched_ds = [r for r in ds_rows if r[2] not in matched_sales_nos]

# ── Write output ──
wb_out = openpyxl.Workbook()

# Sheet 1: Comparison
ws1 = wb_out.active
ws1.title = 'Comparison'
comp_headers = ['Posting Date', 'GL Document No.', 'GL Account No.', 'GL Account Name',
                'GL Amount (LCY)', 'Daily Sales Reference', 'Daily Sales Amount',
                'Difference', 'Status', 'Transaction Type']
ws1.append(comp_headers)
for r in comparison_rows:
    ws1.append(r)
style_header(ws1, len(comp_headers))
for row in ws1.iter_rows(min_row=2, max_row=ws1.max_row):
    for cell in row:
        cell.border = thin_border
    row[4].number_format = num_fmt
    row[6].number_format = num_fmt
    row[7].number_format = num_fmt
    status = str(row[8].value or '')
    fill = None
    if status == 'Match':
        fill = match_fill
    elif 'Discrepancy' in status:
        fill = discrep_fill
    elif 'Unmatch' in status:
        fill = unmatch_fill
    if fill:
        for cell in row:
            cell.fill = fill
auto_width(ws1)

# Sheet 2: GL Raw Data (40xx only)
ws2 = wb_out.create_sheet('GL Entries (40xxx)')
gl_out_headers = ['Posting Date', 'Document Type', 'Source Code', 'Document No.',
                  'G/L Account No.', 'G/L Account Name', 'Description',
                  'Amount (LCY)', 'Debit Amount (LCY)', 'Credit Amount (LCY)',
                  'Branch Code', 'Category Code']
gl_col_idx = [0, 1, 2, 4, 5, 8, 9, 10, 16, 17, 11, 12]
ws2.append(gl_out_headers)
for r in gl_40_rows:
    out = []
    for i in gl_col_idx:
        v = r[i] if i < len(r) else ''
        if isinstance(v, datetime):
            v = v.strftime('%Y-%m-%d')
        out.append(v)
    ws2.append(out)
style_header(ws2, len(gl_out_headers))
for row in ws2.iter_rows(min_row=2, max_row=ws2.max_row):
    for cell in row:
        cell.border = thin_border
    row[7].number_format = num_fmt
    row[8].number_format = num_fmt
    row[9].number_format = num_fmt
auto_width(ws2)

# Sheet 3: Daily Sales Raw Data
ws3 = wb_out.create_sheet('Daily Sales Items')
ds_headers = ['Date', 'Store', 'Sales No', 'Qty', 'Net Sold Price', 'Net Sold Profit']
ws3.append(ds_headers)
for r in ds_rows:
    ws3.append(r)
style_header(ws3, len(ds_headers))
for row in ws3.iter_rows(min_row=2, max_row=ws3.max_row):
    for cell in row:
        cell.border = thin_border
    row[4].number_format = num_fmt
    row[5].number_format = num_fmt
auto_width(ws3)

# Sheet 4: Summary
ws4 = wb_out.create_sheet('Summary')
ws4.append(['Metric', 'Value'])

statuses = Counter(r[8] for r in comparison_rows)
tx_types = Counter(r[9] for r in comparison_rows)

match_count = statuses.get('Match', 0)
discrep_count = sum(v for k, v in statuses.items() if 'Discrepancy' in k)
unmatch_total = sum(v for k, v in statuses.items() if 'Unmatch' in k)

total_gl_daily = sum(r[4] for r in comparison_rows if r[9] == 'Daily Aggregate' and isinstance(r[4], (int, float)))
total_ds_daily = sum(r[6] for r in comparison_rows if r[9] == 'Daily Aggregate' and isinstance(r[6], (int, float)))

summary_data = [
    ['Primary Store Code', primary_store],
    ['Total GL 40xxx Entries', len(gl_40_rows)],
    ['Total Daily Sales Transactions', len(ds_rows)],
    ['Unmatched Daily Sales Transactions', len(unmatched_ds)],
    ['', ''],
    ['── Reconciliation Results ──', ''],
    ['Match', match_count],
    ['Match with Discrepancy', discrep_count],
]
for k, v in sorted(statuses.items()):
    if 'Unmatch' in k:
        summary_data.append([k, v])
summary_data += [
    ['Adjustment Entries', statuses.get('Note - Adjustment Entry', 0)],
    ['Total GL Entries Reconciled', len(comparison_rows)],
    ['', ''],
    ['── By Transaction Type ──', ''],
]
for k, v in sorted(tx_types.items()):
    summary_data.append([k, v])
summary_data += [
    ['', ''],
    [f'── Financial Summary ({primary_store} Daily Only) ──', ''],
    ['Total GL Amount (LCY)', total_gl_daily],
    ['Total Daily Sales Sum', total_ds_daily],
    ['Net Difference', round(total_ds_daily + total_gl_daily, 2)],
    ['', ''],
    ['── Notes ──', ''],
    ['GL Amount (LCY) is negative for sales, positive for returns', ''],
    ['Daily Sales: positive = sale, negative = return', ''],
    ['Daily aggregate entries matched to sum of daily sales by date', ''],
    ['INV/CSR/numeric entries matched individually by Sales No', ''],
    ['Other store entries flagged as Different Store', ''],
    ['Many-to-one: multiple daily sales map to one GL daily entry', ''],
]

for r in summary_data:
    ws4.append(r)
style_header(ws4, 2)
ws4.column_dimensions['A'].width = 55
ws4.column_dimensions['B'].width = 20
for row in ws4.iter_rows(min_row=2, max_row=ws4.max_row):
    for cell in row:
        cell.border = thin_border
    if isinstance(row[1].value, (int, float)):
        row[1].number_format = num_fmt

# Sheet 5: Unmatched Daily Sales
ws5 = wb_out.create_sheet('Unmatched Daily Sales')
ws5.append(ds_headers)
for r in unmatched_ds:
    ws5.append(r)
style_header(ws5, len(ds_headers))
for row in ws5.iter_rows(min_row=2, max_row=ws5.max_row):
    for cell in row:
        cell.border = thin_border
    row[4].number_format = num_fmt
    row[5].number_format = num_fmt
auto_width(ws5)

wb_out.save(OUT_FILE)

# Print results
print(f"\nSaved: {OUT_FILE}")
print(f"Primary store: {primary_store}")
print(f"\nReconciliation Summary:")
for k, v in sorted(statuses.items()):
    print(f"  {k}: {v}")
print(f"\n{primary_store} Daily: GL={total_gl_daily:.2f}, DS={total_ds_daily:.2f}, Diff={total_ds_daily + total_gl_daily:.2f}")
print(f"Unmatched Daily Sales: {len(unmatched_ds)}")
```

## Usage Flow

1. User uploads GL file and Daily Sales file (via Telegram or specifies paths)
2. Write the script above to `/tmp/ar_recon_pmg.py`
3. Determine output filename: `GL_vs_DailySales_Trace_{StoreName}_{Period}.xlsx`
4. Run the script with the office venv Python
5. Send the output file to the user
6. Present the summary (match counts, discrepancies, financial totals)

## Arguments
- `$ARGUMENTS` — optional: store name and period for the output filename (e.g., "Keningau Oct 2025")
- If not provided, derive from file names or ask

## Important Notes
- GL file column layout follows Business Central / NAV standard export (Document No. at index 4, G/L Account No. at index 5, Account Name at index 8, Amount at index 10)
- Daily Sales CSV may have header rows before data — the script auto-detects the start row by looking for "Sales No"
- Store code is auto-detected from GL Document No. patterns — no hardcoding needed
- The script handles both CSV and XLSX daily sales files
