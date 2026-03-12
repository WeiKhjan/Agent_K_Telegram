#!/usr/bin/env python3
"""Set up AiTraining2U invoice SQLite database"""
import sqlite3, os, random

DB_PATH = os.path.expanduser("~/invoices.db")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS invoices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no      TEXT    UNIQUE NOT NULL,
    invoice_date    TEXT    NOT NULL,
    due_date        TEXT    DEFAULT 'Upon Receipt',
    client_company  TEXT    NOT NULL,
    client_attn     TEXT,
    client_email    TEXT,
    client_tel      TEXT,
    client_address  TEXT,
    client_sst_no   TEXT,
    sst_exemption_note TEXT,
    subtotal        REAL    NOT NULL,
    sst_rate        REAL    DEFAULT 0.0,
    sst_amount      REAL    DEFAULT 0.0,
    total           REAL    NOT NULL,
    status          TEXT    DEFAULT 'issued',
    notes           TEXT,
    pdf_path        TEXT,
    created_at      TEXT    DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no  TEXT    NOT NULL,
    item_no     INTEGER NOT NULL,
    description TEXT    NOT NULL,
    qty         INTEGER NOT NULL,
    unit_price  REAL    NOT NULL,
    amount      REAL    NOT NULL,
    FOREIGN KEY (invoice_no) REFERENCES invoices(invoice_no)
);

CREATE TABLE IF NOT EXISTS invoice_sequence (
    year    INTEGER PRIMARY KEY,
    last_no INTEGER NOT NULL DEFAULT 0
);
""")

# Seed 2026 sequence — start at 30 so INV-ATU-2026-0031 is next
c.execute("INSERT OR IGNORE INTO invoice_sequence (year, last_no) VALUES (2026, 30)")
conn.commit()

# Helper: get next invoice number
def next_invoice_no(year=2026):
    c.execute("UPDATE invoice_sequence SET last_no = last_no + 1 WHERE year = ?", (year,))
    c.execute("SELECT last_no FROM invoice_sequence WHERE year = ?", (year,))
    n = c.fetchone()[0]
    conn.commit()
    return f"INV-ATU-{year}-{n:04d}"

inv_no = next_invoice_no()  # -> INV-ATU-2026-0031

# Insert current invoice
c.execute("""
INSERT OR IGNORE INTO invoices
  (invoice_no, invoice_date, due_date, client_company, client_attn,
   client_email, client_tel, client_address, subtotal, sst_rate, sst_amount, total,
   status, pdf_path)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
""", (
    inv_no,
    "2026-02-26",
    "Upon Receipt",
    "Kumpulan Modal Perdana Sdn Bhd",
    "Nur Athirah binti Mohd Youssof",
    "hr@kmp.vc",
    "+60123042407",
    "L15-01-02 PJX HM Shah Tower, No. 16A, Persiaran Barat, 46050 Petaling Jaya, Selangor",
    6000.00,
    0.0,
    0.0,
    6000.00,
    "issued",
    os.path.expanduser(f"~/{inv_no}.pdf"),
))

c.execute("""
INSERT OR IGNORE INTO invoice_items
  (invoice_no, item_no, description, qty, unit_price, amount)
VALUES (?,?,?,?,?,?)
""", (inv_no, 1,
      "AI Workflow Automation Workshop @ WORQ TTDI, 5-6 March 2026",
      2, 3000.00, 6000.00))

conn.commit()
conn.close()
print(f"DB created: {DB_PATH}")
print(f"Invoice number: {inv_no}")
