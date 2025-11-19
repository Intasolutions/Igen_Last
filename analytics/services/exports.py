# analytics/services/exports.py
from io import BytesIO
from typing import Iterable, List, Optional
from datetime import datetime
from decimal import Decimal

# ---------- Excel ----------
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except Exception:
    Workbook = None
    Font = PatternFill = Alignment = Border = Side = None
    get_column_letter = None

# ---------- PDF ----------
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm
    from reportlab.lib import colors
except Exception:
    A4 = None
    canvas = None
    cm = None
    colors = None

# ---------- DOCX (Word) ----------
try:
    from docx import Document  # pip install python-docx
    from docx.shared import Pt
except Exception:
    Document = None
    Pt = None


# ------------------------ Helpers ------------------------

_MONEY_HEADERS = {
    "credit", "debit", "balance", "inflows", "outflows", "net", "margin",
    "igen_sc_this_month", "expected_rent_this_month",
}

def _looks_number(x) -> bool:
    return isinstance(x, (int, float, Decimal))

def _money_col(header: str) -> bool:
    if not header:
        return False
    h = str(header).strip().lower()
    return h in _MONEY_HEADERS


# ------------------------ Excel Export ------------------------

def export_excel(headers: List[str], rows: Iterable[Iterable]):
    """
    Create a styled XLSX workbook and return it as BytesIO.
    Signature kept simple to match existing calls.
    """
    if Workbook is None:
        raise RuntimeError("openpyxl is required (pip install openpyxl)")

    wb = Workbook()
    ws = wb.active
    ws.title = "Report"

    # Header row
    ws.append(list(headers or []))

    # Data rows
    for r in rows:
        ws.append(list(r))

    # Styles if available
    if Font and PatternFill and Alignment and Border and Side and get_column_letter:
        # Header style
        header_font = Font(bold=True)
        header_fill = PatternFill("solid", fgColor="E5E7EB")  # light gray
        thin = Side(style="thin", color="CCCCCC")
        header_border = Border(bottom=thin)

        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(vertical="center")
            cell.border = header_border

        # Freeze header, enable filters
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

        # Autosize columns & number formats
        max_len = {i: len(str(h)) if h is not None else 0 for i, h in enumerate(headers, start=1)}
        money_cols = set()

        for row in ws.iter_rows(min_row=2, values_only=True):
            for i, val in enumerate(row, start=1):
                l = len(str(val)) if val is not None else 0
                if l > max_len.get(i, 0):
                    max_len[i] = l
                # Track potential money columns by header
                if _looks_number(val) and _money_col(headers[i - 1] if i - 1 < len(headers) else ""):
                    money_cols.add(i)

        for i, length in max_len.items():
            col_letter = get_column_letter(i)
            # width heuristic: char count + padding, bounded
            ws.column_dimensions[col_letter].width = min(max(length + 2, 10), 50)

        # Apply number format to "money" columns
        for row_idx in range(2, ws.max_row + 1):
            for col_idx in money_cols:
                ws.cell(row=row_idx, column=col_idx).number_format = '#,##0.00'

        # Row heights (optional subtle)
        ws.row_dimensions[1].height = 18

    # Serialize
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio


# ------------------------ PDF Export ------------------------

def export_simple_pdf(title: str, headers: List[str], rows: List[List[str]]):
    """
    Minimal, reliable PDF table.
    - Repeats header on each page
    - Simple column width distribution (remarks wider if present)
    - Page footer with page number and printed timestamp
    """
    bio = BytesIO()

    # Text fallback when reportlab is unavailable
    if not (canvas and A4 and cm):
        bio.write((title + "\n").encode())
        bio.write((" | ".join(map(str, headers)) + "\n").encode())
        for r in rows:
            bio.write((" | ".join(map(str, r)) + "\n").encode())
        bio.seek(0)
        return bio

    c = canvas.Canvas(bio, pagesize=A4)
    width, height = A4

    # Margins
    left = 1.5 * cm
    right = 1.2 * cm
    top = 1.8 * cm
    bottom = 1.5 * cm

    # Title
    def draw_title():
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, height - top, title)

    # Footer
    def draw_footer(page_num: int):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.grey)
        c.drawRightString(width - right, bottom - 0.3 * cm, f"Page {page_num}")
        c.drawString(left, bottom - 0.3 * cm, f"Generated {ts}")
        c.setFillColor(colors.black)

    # Compute columns
    n = max(len(headers), max((len(r) for r in rows), default=0))
    # Default equal widths
    col_width = (width - left - right) / max(n, 1)

    # If we find a 'Remarks' or long text column, make it wider (x1.8) and shrink others proportionally
    wider_idx = None
    for i, h in enumerate(headers):
        if str(h).strip().lower() in {"remarks", "description", "narration"}:
            wider_idx = i
            break

    col_widths = [col_width] * n
    if wider_idx is not None:
        total = width - left - right
        base = total / (n - 1 + 1.8) if n > 1 else total
        for i in range(n):
            col_widths[i] = base * (1.8 if i == wider_idx else 1.0)

    # Header renderer
    def draw_header(y0: float) -> float:
        c.setFont("Helvetica-Bold", 9)
        x = left
        for i in range(n):
            txt = str(headers[i]) if i < len(headers) else f"Col {i+1}"
            c.drawString(x + 2, y0, txt)
            # underline
            c.setLineWidth(0.3)
            c.setStrokeColor(colors.HexColor("#CCCCCC"))
            c.line(x, y0 - 2, x + col_widths[i], y0 - 2)
            x += col_widths[i]
        c.setStrokeColor(colors.black)
        return y0 - 14  # move to next line

    # Row renderer (truncates to fit line height)
    def draw_row(y0: float, row: List[str]) -> float:
        c.setFont("Helvetica", 9)
        x = left
        for i in range(n):
            col = row[i] if i < len(row) else ""
            # Trim string visually to fit cell
            max_chars = int(col_widths[i] / 4.2)  # rough char-per-width heuristic
            s = str(col)
            if len(s) > max_chars:
                s = s[: max(0, max_chars - 1)] + "…"
            c.drawString(x + 2, y0, s)
            x += col_widths[i]
        return y0 - 12

    # Pagination
    y = height - top - 14
    page = 1
    draw_title()
    y = draw_header(y)

    for r in rows:
        if y < bottom + 1.2 * cm:
            draw_footer(page)
            c.showPage()
            page += 1
            draw_title()
            y = height - top - 14
            y = draw_header(y)
        y = draw_row(y, r)

    draw_footer(page)
    c.save()
    bio.seek(0)
    return bio


# ------------------------ DOCX Export ------------------------

def export_simple_docx(title: str, headers: List[str], rows: List[List[str]]) -> BytesIO:
    """
    Minimal Word table export.
    Returns a BytesIO stream of a .docx file.
    Falls back to a plain-text .docx if python-docx is unavailable.
    """
    bio = BytesIO()

    if Document is None:
        # Fallback: write a very simple text-based .docx-like message
        # (Not a real .docx—caller should still send as octet-stream if needed)
        bio.write((title + "\n").encode())
        bio.write((" | ".join(map(str, headers)) + "\n").encode())
        for r in rows:
            bio.write((" | ".join(map(str, r)) + "\n").encode())
        bio.seek(0)
        return bio

    doc = Document()
    doc.add_heading(title, level=1)

    # Table with header row
    table = doc.add_table(rows=1, cols=len(headers))
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        run = hdr_cells[i].paragraphs[0].add_run(str(h))
        if Pt:
            run.font.bold = True
            run.font.size = Pt(10)

    # Data rows
    for r in rows:
        cells = table.add_row().cells
        for i in range(len(headers)):
            cells[i].text = str(r[i] if i < len(r) else "")

    doc.save(bio)
    bio.seek(0)
    return bio
