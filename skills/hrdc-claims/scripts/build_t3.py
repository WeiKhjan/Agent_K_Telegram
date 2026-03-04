#!/usr/bin/env python3
"""
HRDC PSMB/SBL-KHAS/T3/01 Attendance List — Template-based PDF Generator

Opens the master template PDF (2 pages, 6 rows each = 12 rows per set).
If participants > 12, duplicates the template set as needed.
Preserves all original formatting, borders, signature, stamp, and layout.

Usage:
  python3 build_t3.py \
    --course "AI Agentic Automation with n8n" \
    --date "5/3/2026" \
    --participants '[{"name":"John Doe","employer":"ABC Sdn Bhd","nric":"900101-01-1234","citizenship":"Malaysian","sex":"M"}]' \
    --certifier-name "Goh Hen Yee" \
    --certifier-designation "Director" \
    --cert-date "7/3/2026" \
    --output "~/Documents/AiTraining2U/HRDC/2026/T3_ai-agentic-automation_2026-03-05.pdf"
"""

import argparse
import json
import math
import os
import sys

import fitz  # PyMuPDF

# ── Template path ────────────────────────────────────────────────────────────
TEMPLATE_PATH = os.path.expanduser(
    "~/Agent_K_Telegram/templates/PSMB_SBL_KHAS_T3_01_template.pdf"
)

ROWS_PER_PAGE = 6
PAGES_PER_SET = 2   # template = 2 pages per attendance sheet
ROWS_PER_SET = ROWS_PER_PAGE * PAGES_PER_SET  # 12 rows per set

# ── Table layout coordinates (from template analysis) ────────────────────────
COL_X = {
    "no_left":        35.6,
    "no_right":       64.6,
    "name_left":      64.6,
    "name_right":    178.0,
    "employer_left": 178.0,
    "employer_right": 284.3,
    "nric_left":     284.3,
    "nric_right":    369.4,
    "citizen_left":  369.4,
    "citizen_right": 447.3,
    "sex_left":      447.3,
    "sex_right":     497.0,
    "sig_left":      497.0,
    "sig_right":     575.0,
}

# Horizontal row top/bottom y positions — header + 6 data rows
ROW_Y = [
    235.7,   # top of header row
    261.2,   # bottom of header / top of row 1
    299.8,   # bottom of row 1 / top of row 2
    338.6,   # bottom of row 2 / top of row 3
    377.2,   # bottom of row 3 / top of row 4
    416.0,   # bottom of row 4 / top of row 5
    454.6,   # bottom of row 5 / top of row 6
    493.4,   # bottom of row 6
]

# Course info positions (text placed higher to avoid covering underlines)
COURSE_TITLE_POS = (187.0, 182.0)
TRAINING_DATE_POS = (187.0, 202.5)

# Certification block positions
CERT_NAME_POS   = (185.4, 548.0)
CERT_DESIG_POS  = (185.4, 574.0)
CERT_DATE_POS   = (419.5, 574.0)

# Font settings
FONT_NAME      = "helv"
FONT_SIZE      = 10
CELL_FONT_SIZE = 9
CELL_FONT_SIZE_SMALL = 7  # for name/employer columns that need wrapping


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--course", required=True)
    p.add_argument("--date", required=True, help="Training date, e.g. 5/3/2026")
    p.add_argument("--participants", required=True, help="JSON array of participant dicts")
    p.add_argument("--certifier-name", default="Goh Hen Yee")
    p.add_argument("--certifier-designation", default="Director")
    p.add_argument("--cert-date", required=True, help="Certification date, e.g. 7/3/2026")
    p.add_argument("--output", required=True)
    return p.parse_args()


def clear_area(page, rect):
    """White-out a rectangular area to clear existing text."""
    page.draw_rect(rect, color=None, fill=(1, 1, 1))


def insert_centered_text(page, text, x_left, x_right, y_top, y_bottom, fontsize=CELL_FONT_SIZE):
    """Insert text centered horizontally and vertically in a cell."""
    x_center = (x_left + x_right) / 2
    y_center = (y_top + y_bottom) / 2
    tw = fitz.get_text_length(text, fontname=FONT_NAME, fontsize=fontsize)
    x = x_center - tw / 2
    y = y_center + fontsize / 3
    page.insert_text((x, y), text, fontname=FONT_NAME, fontsize=fontsize, color=(0, 0, 0))


def _wrap_text(text, max_width, fontname, fontsize):
    """Break text into lines that each fit within max_width."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = (current + " " + word).strip()
        if fitz.get_text_length(candidate, fontname=fontname, fontsize=fontsize) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def insert_wrapped_text(page, text, x_left, x_right, y_top, y_bottom,
                        fontsize=CELL_FONT_SIZE_SMALL):
    """Insert text with word-wrap, centered in cell. Uses up to 3 lines."""
    col_width = x_right - x_left - 4   # 2 pt padding each side
    x_center = (x_left + x_right) / 2

    lines = _wrap_text(text, col_width, FONT_NAME, fontsize)
    lines = lines[:3]  # cap at 3 rows

    cell_height = y_bottom - y_top
    line_height = fontsize * 1.3
    total_h = len(lines) * line_height
    start_y = y_top + (cell_height - total_h) / 2 + fontsize

    for i, line in enumerate(lines):
        tw = fitz.get_text_length(line, fontname=FONT_NAME, fontsize=fontsize)
        x = x_center - tw / 2
        y = start_y + i * line_height
        page.insert_text((x, y), line, fontname=FONT_NAME, fontsize=fontsize, color=(0, 0, 0))


def fill_page(page, participants_slice, start_row_num, args):
    """Fill one template page with up to 6 participants."""
    # ── Course info ──────────────────────────────────────────────────────────
    # Clear area stops 2 pts before underline so it stays visible
    clear_area(page, fitz.Rect(185, 170, 520, 185))
    page.insert_text(COURSE_TITLE_POS, args.course,
                     fontname=FONT_NAME, fontsize=FONT_SIZE, color=(0, 0, 0))

    clear_area(page, fitz.Rect(185, 190, 520, 205))
    page.insert_text(TRAINING_DATE_POS, args.date,
                     fontname=FONT_NAME, fontsize=FONT_SIZE, color=(0, 0, 0))

    # ── Certification block ──────────────────────────────────────────────────
    # Clear area stops before underline so line stays visible
    clear_area(page, fitz.Rect(183, 532, 325, 550))
    page.insert_text(CERT_NAME_POS, args.certifier_name,
                     fontname=FONT_NAME, fontsize=FONT_SIZE, color=(0, 0, 0))

    clear_area(page, fitz.Rect(183, 558, 325, 576))
    page.insert_text(CERT_DESIG_POS, args.certifier_designation,
                     fontname=FONT_NAME, fontsize=FONT_SIZE, color=(0, 0, 0))

    clear_area(page, fitz.Rect(417, 558, 520, 576))
    page.insert_text(CERT_DATE_POS, args.cert_date,
                     fontname=FONT_NAME, fontsize=FONT_SIZE, color=(0, 0, 0))

    # ── Participant rows (max 6) ──────────────────────────────────────────────
    for slot_idx, p in enumerate(participants_slice[:ROWS_PER_PAGE]):
        row_idx = slot_idx + 1  # skip header row (index 0)
        y_top    = ROW_Y[row_idx]
        y_bottom = ROW_Y[row_idx + 1] if row_idx + 1 < len(ROW_Y) else y_top + 38

        global_num = start_row_num + slot_idx  # e.g. 7, 8, … on page 2

        insert_centered_text(page, str(global_num),
                             COL_X["no_left"], COL_X["no_right"], y_top, y_bottom)
        insert_wrapped_text(page, p.get("name", ""),
                            COL_X["name_left"], COL_X["name_right"], y_top, y_bottom)
        insert_wrapped_text(page, p.get("employer", ""),
                            COL_X["employer_left"], COL_X["employer_right"], y_top, y_bottom)
        insert_centered_text(page, p.get("nric", ""),
                             COL_X["nric_left"], COL_X["nric_right"], y_top, y_bottom)
        insert_centered_text(page, p.get("citizenship", "Malaysian"),
                             COL_X["citizen_left"], COL_X["citizen_right"], y_top, y_bottom)
        insert_centered_text(page, p.get("sex", ""),
                             COL_X["sex_left"], COL_X["sex_right"], y_top, y_bottom)


def build_pdf(args):
    output_path = os.path.expanduser(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    participants = json.loads(args.participants)

    if not os.path.exists(TEMPLATE_PATH):
        print(f"❌ Template not found: {TEMPLATE_PATH}")
        sys.exit(1)

    # How many 2-page sets do we need?
    total = len(participants)
    num_sets = max(1, math.ceil(total / ROWS_PER_SET))

    # Build output doc by duplicating the 2-page template set as needed
    output_doc = fitz.open()

    for set_idx in range(num_sets):
        # Open a fresh copy of the template for this set
        template = fitz.open(TEMPLATE_PATH)

        # Ensure template has exactly 2 pages
        while template.page_count < PAGES_PER_SET:
            template.copy_page(0)          # duplicate page if template only has 1
        while template.page_count > PAGES_PER_SET:
            template.delete_page(template.page_count - 1)

        base = set_idx * ROWS_PER_SET

        # Page 1 of this set: participants base+0 … base+5
        slice_p1 = participants[base: base + ROWS_PER_PAGE]
        fill_page(template[0], slice_p1, start_row_num=base + 1, args=args)

        # Page 2 of this set: participants base+6 … base+11
        slice_p2 = participants[base + ROWS_PER_PAGE: base + ROWS_PER_SET]
        fill_page(template[1], slice_p2, start_row_num=base + ROWS_PER_PAGE + 1, args=args)

        output_doc.insert_pdf(template)
        template.close()

    output_doc.save(output_path, garbage=4, deflate=True)
    output_doc.close()

    total_pages = num_sets * PAGES_PER_SET
    print(f"✅ T3 saved: {output_path}  ({total_pages} pages, {num_sets} set(s), {total} participants)")


if __name__ == "__main__":
    args = parse_args()
    build_pdf(args)
