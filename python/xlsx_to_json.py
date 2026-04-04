"""
Convert pgraph-questions.xlsx to nested fragebogen JSON format.
See mapping.md for specification.
"""

import json
import random
import string
import sys
from datetime import datetime, timezone

import openpyxl

XLSX_FILE = "pgraph-questions.xlsx"
ICF_FILE = "icf_codes_mit_fragen.json"
OUTPUT_FILE = "output.json"

ICF_ANSWERS_BDS = [
    "Keine Probleme",
    "Wenige Probleme",
    "Einige Probleme",
    "Starke Probleme",
    "Sehr starke Probleme oder gar nicht möglich",
]
ICF_ANSWERS_E = [
    "Dadurch vollständig beeinträchtigt",
    "Dadurch stark beeinträchtigt",
    "Dadurch mäßig beeinträchtigt",
    "Dadurch leicht beeinträchtigt",
    "Dadurch gar nicht beeinträchtigt",
    "Unterstützt ein wenig",
    "Unterstützt mäßig",
    "Unterstützt substantiell",
    "Beeinflussen mein Leben sehr stark postitiv",
]


def new_id() -> str:
    num = random.randint(1, 9)
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"n{num}_{suffix}"


def parse_answers(raw) -> list:
    if not raw:
        return []
    s = str(raw).strip()
    # Try JSON (double-quoted)
    try:
        result = json.loads(s)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass
    # Fall back to Python literal (single-quoted)
    try:
        import ast
        result = ast.literal_eval(s)
        if isinstance(result, list):
            return result
    except Exception:
        pass
    return []


def parse_loc(raw) -> tuple[int, ...]:
    return tuple(int(p) for p in str(raw).split("."))


def should_ignore(loc_raw) -> bool:
    if loc_raw is None:
        return True
    try:
        parts = parse_loc(loc_raw)
        return parts[0] == 0
    except (ValueError, TypeError):
        return True


def icf_options(code: str) -> list:
    return ICF_ANSWERS_E if code.lower().startswith("e") else ICF_ANSWERS_BDS


def build_icf_node(code: str, icf_data: dict) -> dict | None:
    code = code.strip()
    entry = icf_data.get(code)
    if entry is None:
        print(f"  WARNING: ICF code '{code}' not found in {ICF_FILE}", file=sys.stderr)
        return None
    fragen = entry.get("fragen") or []
    return {
        "id": new_id(),
        "type": "icf",
        "label": entry.get("name", ""),
        "icfCode": code,
        "questionType": "single",
        "options": icf_options(code),
        "helpText": "",
        "required": False,
        "subheading": entry.get("description", ""),
        "icon": f"icf:{code}",
        "question": fragen[0] if fragen else "",
        "defaultIdx": 0,
    }


def node_type_for_depth(depth: int) -> str:
    """Depth 1 = section, depth >= 2 = question."""
    return "section" if depth == 1 else "question"


def build_xlsx_node(row: tuple, icf_data: dict) -> dict:
    loc_raw, category, _q_order, heading, _icon, question, example, answers_raw, default_idx, children_raw = row

    depth = len(parse_loc(loc_raw))
    node_type = node_type_for_depth(depth)
    options = parse_answers(answers_raw)

    # Build ICF children from comma-separated codes in the children column
    icf_children = []
    if children_raw:
        for code in str(children_raw).split(","):
            code = code.strip()
            if code:
                icf_node = build_icf_node(code, icf_data)
                if icf_node:
                    icf_children.append(icf_node)

    node = {
        "id": new_id(),
        "type": node_type,
        "label": heading or "",
        "required": False,
        "helpText": example or "",
        "options": options,
        "children": icf_children,  # structural children appended later
    }

    if node_type == "question":
        node["question"] = question or ""
        node["reference"] = category or ""
        node["questionType"] = "yesno" if icf_children else "single"
        if default_idx is not None:
            node["defaultIdx"] = int(default_idx)

    return node


def placeholder_node(depth: int) -> dict:
    """Auto-created ancestor node (no explicit xlsx row)."""
    node_type = node_type_for_depth(depth)
    node = {
        "id": new_id(),
        "type": node_type,
        "label": "",
        "required": False,
        "helpText": "",
        "options": [],
        "children": [],
    }
    if node_type == "question":
        node["question"] = ""
        node["reference"] = ""
        node["questionType"] = "single"
    return node


def main():
    # Load data
    with open(ICF_FILE, encoding="utf-8") as f:
        icf_data = json.load(f)

    wb = openpyxl.load_workbook(XLSX_FILE)
    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))
    data_rows = all_rows[1:]  # skip header

    # Filter ignored rows
    valid_rows = [r for r in data_rows if not should_ignore(r[0])]

    # Build loc → node mapping (ordered by loc for deterministic insertion)
    loc_to_node: dict[tuple, dict] = {}
    row_order: list[tuple] = []  # to maintain xlsx order

    for row in valid_rows:
        loc = parse_loc(row[0])
        node = build_xlsx_node(row, icf_data)
        loc_to_node[loc] = node
        row_order.append(loc)

    # Ensure every ancestor exists, creating placeholder sections as needed
    roots: list[dict] = []

    def ensure_path(loc: tuple):
        """Recursively ensure all ancestors exist and are linked."""
        if loc in loc_to_node:
            return
        loc_to_node[loc] = placeholder_node(len(loc))
        if len(loc) == 1:
            roots.append(loc_to_node[loc])
        else:
            parent = loc[:-1]
            ensure_path(parent)
            # Append to parent children only once (check not already there)
            parent_node = loc_to_node[parent]
            child_ids = {c["id"] for c in parent_node["children"]}
            node = loc_to_node[loc]
            if node["id"] not in child_ids:
                parent_node["children"].append(node)

    # Process rows in xlsx order, linking each node to its parent
    for loc in row_order:
        if len(loc) == 1:
            ensure_path(loc)
            root_ids = {n["id"] for n in roots}
            node = loc_to_node[loc]
            if node["id"] not in root_ids:
                roots.append(node)
        else:
            parent_loc = loc[:-1]
            ensure_path(parent_loc)
            parent_node = loc_to_node[parent_loc]
            child_ids = {c["id"] for c in parent_node["children"]}
            node = loc_to_node[loc]
            if node["id"] not in child_ids:
                parent_node["children"].append(node)

    # Assemble output
    output = {
        "exportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "variants": {
            "main": {
                "id": "main",
                "label": "Original",
                "nodes": roots,
            }
        },
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Done. Written to {OUTPUT_FILE}")
    print(f"  {len(valid_rows)} xlsx rows processed")
    print(f"  {len(roots)} top-level section(s)")


if __name__ == "__main__":
    main()
