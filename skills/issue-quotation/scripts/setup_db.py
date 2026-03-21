#!/usr/bin/env python3
"""Set up AiTraining2U quotation SQLite database"""
import sqlite3, os

DB_PATH = os.path.expanduser("~/quotations.db")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS quotations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_no    TEXT    UNIQUE NOT NULL,
    quotation_date  TEXT    NOT NULL,
    valid_until     TEXT,
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
    status          TEXT    DEFAULT 'draft',
    notes           TEXT,
    pdf_path        TEXT,
    created_at      TEXT    DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_no    TEXT    NOT NULL,
    item_no         INTEGER NOT NULL,
    description     TEXT    NOT NULL,
    qty             INTEGER NOT NULL,
    unit_price      REAL    NOT NULL,
    amount          REAL    NOT NULL,
    FOREIGN KEY (quotation_no) REFERENCES quotations(quotation_no)
);

CREATE TABLE IF NOT EXISTS quotation_sequence (
    year    INTEGER PRIMARY KEY,
    last_no INTEGER NOT NULL DEFAULT 0
);
""")

# Seed 2026 sequence — start at 0 so QUO-ATU-2026-0001 is first
c.execute("INSERT OR IGNORE INTO quotation_sequence (year, last_no) VALUES (2026, 0)")
conn.commit()
conn.close()
print(f"DB created: {DB_PATH}")
print("Next quotation number will be: QUO-ATU-2026-0001")
