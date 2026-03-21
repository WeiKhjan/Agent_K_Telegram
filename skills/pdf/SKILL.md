---
name: pdf
description: Read, create, edit, merge, split, and extract data from PDF files using Python libraries. Use when user asks to read a PDF, create a PDF, merge PDFs, split a PDF, extract text or data from PDF, fill PDF forms, or convert documents to PDF.
triggers:
  - pdf
  - merge pdf
  - split pdf
  - extract pdf
  - fill form
  - watermark
  - pdf to text
  - pdf to image
  - sign pdf
  - compress pdf
  - rotate pdf
  - encrypt pdf
  - decrypt pdf
---

# PDF Skill

Create, edit, merge, split, extract, and manipulate PDF files using Python.

## Python Environment

```
/Users/aitraining2u/.local/share/office-venv/bin/python
```

## Available Libraries

| Library | Best For |
|---------|----------|
| `pypdf` | Merge, split, rotate, encrypt/decrypt, extract text, fill forms |
| `pikepdf` | Low-level PDF surgery, repair broken PDFs, modify metadata |
| `pymupdf` (fitz) | Fast text/image extraction, render PDF to images, annotations |
| `reportlab` | Generate new PDFs from scratch (invoices, reports, certificates) |
| `pdfplumber` | Extract tables and structured data from PDFs |
| `fpdf2` | Lightweight PDF creation (simple reports, labels) |
| `borb` | High-level PDF creation with layout engine |

## Task → Library Guide

### Read & Extract
- **Extract text**: `pymupdf` (fastest) or `pdfplumber` (best for tables)
- **Extract tables**: `pdfplumber` — returns tables as lists of lists
- **Extract images**: `pymupdf` — `page.get_images()`
- **Read metadata**: `pypdf` — `reader.metadata`

### Create & Generate
- **Complex layouts** (invoices, reports): `reportlab`
- **Simple documents**: `fpdf2`
- **Rich layouts with auto-flow**: `borb`

### Edit & Modify
- **Merge PDFs**: `pypdf` — `PdfMerger()`
- **Split PDF**: `pypdf` — `PdfWriter()` with selected pages
- **Rotate pages**: `pypdf` — `page.rotate(90)`
- **Add watermark/stamp**: `pypdf` — merge overlay page
- **Fill form fields**: `pypdf` — `writer.update_page_form_field_values()`
- **Add annotations**: `pymupdf` — `page.add_text_annot()`
- **Crop pages**: `pikepdf` — modify MediaBox/CropBox

### Security
- **Encrypt**: `pypdf` — `writer.encrypt("password")`
- **Decrypt**: `pypdf` — `reader.decrypt("password")`
- **Remove restrictions**: `pikepdf` — open with password, save without

### Convert
- **PDF → Images**: `pymupdf` — `page.get_pixmap()`
- **PDF → Text**: `pymupdf` or `pdfplumber`
- **Images → PDF**: `fpdf2` or `reportlab`

## Code Patterns

### Merge PDFs
```python
from pypdf import PdfMerger
merger = PdfMerger()
for pdf in ["file1.pdf", "file2.pdf"]:
    merger.append(pdf)
merger.write("merged.pdf")
merger.close()
```

### Extract Tables
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                print(row)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter
reader = PdfReader("input.pdf")
watermark = PdfReader("watermark.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.merge_page(watermark.pages[0])
    writer.add_page(page)
with open("output.pdf", "wb") as f:
    writer.write(f)
```

### PDF to Images
```python
import fitz  # pymupdf
doc = fitz.open("input.pdf")
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=200)
    pix.save(f"page_{i+1}.png")
```

### Fill Form Fields
```python
from pypdf import PdfReader, PdfWriter
reader = PdfReader("form.pdf")
writer = PdfWriter()
writer.append(reader)
writer.update_page_form_field_values(
    writer.pages[0],
    {"field_name": "value"}
)
with open("filled.pdf", "wb") as f:
    writer.write(f)
```

## Output
- Save generated files to `~/` (WORKSPACE_DIR)
- Use the `send-file` skill to deliver to user
- For Telegram delivery, match context: group→group, DM→DM
