#!/usr/bin/env python3
"""Build the spreadsheet templates from the preset configs.

The .xlsx templates are what most operators actually start from: they copy the
Google Sheet, not the CSV. That makes the workbook the file most likely to rot,
because nothing in a normal build touches it. So it is generated rather than
hand-maintained, from the same two files everything else comes from:

    presets/<name>/ranking-config.js    the rank scale
    presets/<name>/TEMPLATE.csv         the header row and the example rows

Run it after changing either one:

    pip install openpyxl
    python scripts/build-templates.py

`--check` regenerates into a temporary directory and compares, so CI can fail a
change that edits a preset without rebuilding its workbook. The comparison is on
cell values rather than bytes, because a zip's timestamps differ every run.

Writing the workbook needs Python; using it does not. The generated files are
committed, so no operator and no other contributor needs this installed.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile

try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.chart import BarChart, Reference
    from openpyxl.formatting.rule import CellIsRule, ColorScaleRule
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation
except ImportError:  # pragma: no cover - a setup problem, not a logic one
    sys.exit("openpyxl is required: pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESETS = ("letter", "stars", "score")
DOCS = "https://potatosalad775.github.io/squigRanking/docs/"

# Columns whose cells hold prose and need room and wrapping.
WIDE = {"Comment", "Pros", "Cons", "Notes", "Comment_KR", "Pros_KR", "Cons_KR", "Notes_KR"}

HEADER_FILL = PatternFill("solid", fgColor="1F2933")
HEADER_FONT = Font(bold=True, color="FFFFFF")
TITLE_FONT = Font(bold=True, size=13)


def read_config(preset: str) -> dict:
    """Evaluate a preset's config in node and return the parts we need.

    Evaluating rather than parsing keeps this honest: the workbook's grades are
    the config's grades, including anything computed there.
    """
    path = os.path.join(ROOT, "presets", preset, "ranking-config.js").replace("\\", "/")
    script = (
        "const fs=require('fs');const holder={};"
        f"new Function('window',fs.readFileSync({path!r},'utf8'))(holder);"
        "const c=holder.RANKING_CONFIG;"
        "const rank=c.columns.find(x=>x.role==='rank');"
        "process.stdout.write(JSON.stringify({"
        "scale:rank.scale,render:rank.render,label:rank.label,"
        "hasScore:c.columns.some(x=>x.role==='score'&&x.source)}));"
    )
    # The encoding is explicit because the labels are Korean and `text=True`
    # would otherwise decode them with the system codepage, which is cp949 here
    # and something else again on a CI runner.
    out = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=ROOT,
        check=True,
    )
    return json.loads(out.stdout)


def read_rows(preset: str) -> tuple[list[str], list[list[str]]]:
    path = os.path.join(ROOT, "presets", preset, "TEMPLATE.csv")
    with open(path, encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))
    # `newline=""` is what preserves a quoted cell's own line breaks, and on a
    # CRLF checkout those reach us as \r\n. openpyxl round-trips \r\n into a
    # doubled newline, so one CSV yields a different workbook depending on the
    # platform that built it and --check fails on whichever platform did not.
    # The cell content is the same either way, so settle on one form here.
    rows = [[cell.replace("\r\n", "\n").replace("\r", "\n") for cell in row] for row in rows]
    return rows[0], rows[1:]


def is_numeric(scale) -> bool:
    """Whether every step is a number.

    It decides three things at once, and they have to agree: whether Rank cells
    are written as numbers, whether the Guide's Value column is numeric, and
    which kind of conditional formatting applies. Splitting the decision is how
    a COUNTIF ends up comparing the number 10 against the text "10" and
    reporting zero devices.
    """
    try:
        for entry in scale:
            float(entry["value"])
    except (TypeError, ValueError):
        return False
    return True


def as_cell(value: str, numeric: bool):
    return float(value) if numeric else value


def label_text(label) -> str:
    if isinstance(label, dict):
        return label.get("default", "Rank")
    return label or "Rank"


def build_guide(sheet, preset: str, config: dict, headers: list[str]) -> None:
    """The scale table plus the instructions the old workbook got wrong.

    The table is not decoration: the Score formula and the Stats counts both read
    it, so an operator who adds a grade here has added it everywhere in the
    workbook at once.
    """
    scale = config["scale"]
    name = label_text(config["label"])

    sheet["A1"] = f"{name} scale"
    sheet["A1"].font = TITLE_FONT
    sheet["A2"] = "Best first. Editing this table updates the Score column and the Stats sheet."
    sheet["A2"].font = Font(italic=True, color="666666")

    for index, key in enumerate(("Value", "Worth", "Color")):
        cell = sheet.cell(row=3, column=index + 1, value=key)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT

    numeric = is_numeric(scale)
    for offset, entry in enumerate(scale):
        row = 4 + offset
        sheet.cell(row=row, column=1, value=as_cell(entry["value"], numeric))
        sheet.cell(row=row, column=2, value=entry.get("score"))
        color = entry.get("color", "")
        cell = sheet.cell(row=row, column=3, value=color)
        if color:
            cell.fill = PatternFill("solid", fgColor=color.lstrip("#").upper())

    start = 5 + len(scale)
    lines = [
        ("How to write a review", TITLE_FONT),
        ("", None),
        ("Every part of a review has its own column. There is no markup to learn:", None),
        ("type into the column you want and leave the rest blank.", None),
        ("", None),
    ]
    descriptions = {
        "Brand": "Maker. Half of the card heading.",
        "Model": "Model name. The other half.",
        "Rank": "One of the values in the scale table above.",
        "Score": "Filled in by formula from the scale. Overwrite it to score by hand.",
        "Driver": "Hybrid, DD, BA, planar. Becomes a chip and a filter.",
        "Style": "Open, closed, IEM, earbud. Becomes a chip and a filter.",
        "Tags": "Comma separated. Shown as pills, and searchable.",
        "Comment": "The main paragraph.",
        "Pros": "A green block. Alt+Enter for one point per line.",
        "Cons": "A red block. Alt+Enter for one point per line.",
        "Notes": "A muted block, for caveats and measurement remarks.",
    }
    for header in headers:
        base = header[:-3] if header.endswith("_KR") else header
        text = descriptions.get(base)
        if not text:
            continue
        if header.endswith("_KR"):
            text = f"Korean text for {base}. Blank falls back to English."
        lines.append((f"{header} — {text}", None))

    lines += [
        ("", None),
        ("Line breaks inside a cell are kept. Use Alt+Enter (Option+Enter on a Mac).", None),
        ("", None),
        ("Publishing this sheet for the page", TITLE_FONT),
        ("", None),
        ("1. File - Share - Publish to web", None),
        ("2. In the Link tab, choose this sheet and 'Comma-separated values (.csv)'", None),
        ("3. Publish, then copy the URL it gives you", None),
        ("4. Paste it into ranking-config.js as source.url", None),
        ("", None),
        ("Do not rename the header row: ranking-config.js looks the columns up by name.", None),
        ("", None),
        (f"Full guide: {DOCS}setup/your-sheet/", None),
        (f"Build a config from a form: {DOCS}config-editor/", None),
    ]

    for offset, (text, font) in enumerate(lines):
        cell = sheet.cell(row=start + offset, column=1, value=text or None)
        if font:
            cell.font = font

    sheet.column_dimensions["A"].width = 92
    sheet.column_dimensions["B"].width = 10
    sheet.column_dimensions["C"].width = 12


def build_list(sheet, preset: str, config: dict, headers: list[str], rows: list[list[str]]) -> None:
    scale = config["scale"]
    scale_values = [entry["value"] for entry in scale]
    last_scale_row = 3 + len(scale)

    for index, header in enumerate(headers):
        cell = sheet.cell(row=1, column=index + 1, value=header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center")

    numeric = is_numeric(scale)
    rank_index = headers.index("Rank")
    for row_index, values in enumerate(rows):
        for column_index, value in enumerate(values):
            written = value or None
            if written is not None and column_index == rank_index and numeric:
                written = as_cell(value, True)
            cell = sheet.cell(row=row_index + 2, column=column_index + 1, value=written)
            if headers[column_index] in WIDE:
                cell.alignment = Alignment(wrap_text=True, vertical="top")

    rank_column = rank_index + 1
    rank_letter = get_column_letter(rank_column)

    # The Score column is a lookup into the scale table, not a nested IF. Adding
    # a grade to the table is then the only edit needed.
    if "Score" in headers:
        score_letter = get_column_letter(headers.index("Score") + 1)
        for row in range(2, len(rows) + 2):
            sheet[f"{score_letter}{row}"] = (
                f"=IFERROR(VLOOKUP({rank_letter}{row},Guide!$A$4:$B${last_scale_row},2,FALSE),\"\")"
            )

    # A dropdown on Rank. Google Sheets keeps this on import, and it is the
    # single most useful thing a template can do for someone typing their first row.
    joined = ",".join(scale_values)
    if len(joined) < 250:
        validation = DataValidation(
            type="list",
            formula1=f'"{joined}"',
            allow_blank=True,
            showErrorMessage=True,
            errorTitle="Not on the scale",
            error="Pick a value from the list, or add it to the Guide sheet first.",
        )
        sheet.add_data_validation(validation)
        validation.add(f"{rank_letter}2:{rank_letter}1000")

    # A numeric scale gets a ramp, because listing a rule per value would mean
    # eleven rules that a 0-to-100 scale could never extend to. A letter scale
    # gets its own color per grade, so the sheet matches the page.
    span = f"{rank_letter}2:{rank_letter}1000"
    if numeric:
        worst, best = scale_values[-1], scale_values[0]
        sheet.conditional_formatting.add(
            span,
            ColorScaleRule(
                start_type="num", start_value=float(worst), start_color="B71C1C",
                mid_type="num", mid_value=(float(worst) + float(best)) / 2, mid_color="FFC107",
                end_type="num", end_value=float(best), end_color="6C63FF",
            ),
        )
    else:
        for entry in scale:
            color = entry.get("color")
            if not color:
                continue
            sheet.conditional_formatting.add(
                span,
                CellIsRule(
                    operator="equal",
                    formula=[f'"{entry["value"]}"'],
                    fill=PatternFill("solid", fgColor=color.lstrip("#").upper()),
                    font=Font(color="FFFFFF", bold=True),
                ),
            )

    for index, header in enumerate(headers):
        letter = get_column_letter(index + 1)
        sheet.column_dimensions[letter].width = 58 if header in WIDE else max(10, len(header) + 4)

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(len(rows) + 1, 2)}"


def build_stats(sheet, config: dict, headers: list[str]) -> None:
    scale = config["scale"]
    last_scale_row = 3 + len(scale)
    rank_letter = get_column_letter(headers.index("Rank") + 1)

    sheet["A1"] = "How the list breaks down"
    sheet["A1"].font = TITLE_FONT
    sheet["A2"] = "Counts update as you fill in the List sheet."
    sheet["A2"].font = Font(italic=True, color="666666")

    for index, key in enumerate((label_text(config["label"]), "Devices")):
        cell = sheet.cell(row=4, column=index + 1, value=key)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT

    for offset in range(len(scale)):
        row = 5 + offset
        sheet.cell(row=row, column=1, value=f"=Guide!A{4 + offset}")
        sheet.cell(
            row=row,
            column=2,
            value=f"=COUNTIF(List!${rank_letter}$2:${rank_letter}$1000,A{row})",
        )

    total_row = 5 + len(scale) + 1
    sheet.cell(row=total_row, column=1, value="Total").font = Font(bold=True)
    sheet.cell(row=total_row, column=2, value=f"=SUM(B5:B{4 + len(scale)})").font = Font(bold=True)
    sheet.cell(row=total_row + 1, column=1, value="Average").font = Font(bold=True)
    sheet.cell(
        row=total_row + 1,
        column=2,
        value=(
            f"=IFERROR(SUMPRODUCT(B5:B{4 + len(scale)},Guide!B4:B{last_scale_row})"
            f"/SUM(B5:B{4 + len(scale)}),\"\")"
        ),
    ).font = Font(bold=True)

    chart = BarChart()
    chart.type = "col"
    chart.title = "Devices per grade"
    chart.legend = None
    chart.y_axis.title = "Devices"
    chart.add_data(Reference(sheet, min_col=2, min_row=4, max_row=4 + len(scale)), titles_from_data=True)
    chart.set_categories(Reference(sheet, min_col=1, min_row=5, max_row=4 + len(scale)))
    chart.height = 8
    chart.width = 16
    sheet.add_chart(chart, "D4")

    sheet.column_dimensions["A"].width = 16
    sheet.column_dimensions["B"].width = 12


def build(preset: str, destination: str) -> None:
    config = read_config(preset)
    headers, rows = read_rows(preset)

    book = Workbook()
    build_list(book.active, preset, config, headers, rows)
    book.active.title = "List"
    build_guide(book.create_sheet("Guide"), preset, config, headers)
    build_stats(book.create_sheet("Stats"), config, headers)

    os.makedirs(os.path.dirname(destination), exist_ok=True)
    book.save(destination)


def snapshot(path: str) -> list:
    """Cell values per sheet. Compared instead of bytes, which differ every run."""
    book = load_workbook(path)
    return [
        [sheet.title, [[cell.value for cell in row] for row in sheet.iter_rows()]]
        for sheet in book.worksheets
    ]


def targets(preset: str) -> list[str]:
    return [os.path.join(ROOT, "presets", preset, "TEMPLATE.xlsx")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if a committed workbook is stale")
    args = parser.parse_args()

    if not args.check:
        for preset in PRESETS:
            for path in targets(preset):
                build(preset, path)
                print(f"wrote {os.path.relpath(path, ROOT)}")
        return 0

    stale = []
    with tempfile.TemporaryDirectory() as scratch:
        for preset in PRESETS:
            fresh = os.path.join(scratch, preset, "TEMPLATE.xlsx")
            build(preset, fresh)
            for path in targets(preset):
                relative = os.path.relpath(path, ROOT)
                if not os.path.exists(path):
                    stale.append(f"{relative} is missing")
                elif snapshot(path) != snapshot(fresh):
                    stale.append(f"{relative} does not match its preset")

    if stale:
        print("Stale templates:", file=sys.stderr)
        for problem in stale:
            print(f"  {problem}", file=sys.stderr)
        print("\nRun: python scripts/build-templates.py", file=sys.stderr)
        return 1
    print(f"templates match their presets ({len(PRESETS)} checked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
