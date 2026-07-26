#!/usr/bin/env python3
"""Validate the structure of the canonical project-memory files.

Required by docs/MASTER_IMPLEMENTATION_SPEC.md (JAPP-MASTER-001) §1.1 and §12:
"A small validation script must ensure status enums are valid, dependencies
are not skipped, and no more than one package is IN_PROGRESS."

Checks performed
  1. Every canonical project-memory file exists and is non-empty
     (CLAUDE.md plus the seven docs/ files, spec §1.1).
  2. Each project-memory file contains its required top-level structure.
  3. docs/PROJECT_STATUS.md:
     - required header fields and required sections are present
     - the milestone table lists every spec milestone exactly once with a
       valid state enum
     - the work-package table lists every work package defined in the spec
       exactly once (no missing, no unknown, no duplicate IDs) with a valid
       state enum
     - no more than one work package is IN_PROGRESS
     - the "Current work package" header agrees with the table
     - the "Next READY package" ID is READY in the table (or NONE)
     - dependencies are not skipped:
         a) milestone-level dependencies parsed from the spec's
            "**Dependencies:**" lines must be fully VERIFIED/ACCEPTED before
            any package of the dependent milestone is READY or started
         b) within a milestone, packages are sequential: a package may be
            READY or started only when all lower-numbered packages of the
            same milestone are VERIFIED/ACCEPTED (recorded convention in
            docs/PROJECT_STATUS.md; relaxing it requires an ADR)
     - milestone-state consistency: a milestone is NOT_STARTED only if all
       of its packages are NOT_STARTED, and ACCEPTED only if all of its
       packages are ACCEPTED

Exit codes: 0 = PASS, 1 = FAIL (violations listed), 2 = cannot parse/usage.
Usage: python3 scripts/validate_status.py [--repo DIR] [--status FILE] [--spec FILE] [--quiet]
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

STATES = {
    "NOT_STARTED",
    "READY",
    "IN_PROGRESS",
    "BLOCKED",
    "IMPLEMENTED",
    "VERIFIED",
    "ACCEPTED",
}
STARTED = {"IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "ACCEPTED"}
DONE = {"VERIFIED", "ACCEPTED"}

# Phase map from spec §9 (used for reporting only).
PHASES = {
    "A": range(0, 6), "B": range(6, 9), "C": range(9, 17), "D": range(17, 23),
    "E": range(23, 27), "F": range(27, 31), "G": range(31, 34), "H": range(34, 37),
    "I": range(37, 38),
}

MEMORY_FILES = [
    ("CLAUDE.md", ["Mandatory session bootstrap", "docs/MASTER_IMPLEMENTATION_SPEC.md"]),
    ("docs/MASTER_IMPLEMENTATION_SPEC.md", ["JAPP-MASTER-001", "## 12. Required project-status format"]),
    ("docs/PROJECT_STATUS.md", ["# Project Status"]),
    ("docs/DECISIONS.md", ["# Decisions", "## Owner decisions", "## ADR template"]),
    ("docs/TEST_EVIDENCE.md", ["# Test Evidence", "## Entry template"]),
    ("docs/KNOWN_ISSUES.md", ["# Known Issues", "## Entry template"]),
    ("docs/COMPATIBILITY_MATRIX.md", ["# Compatibility Matrix"]),
    ("docs/REQUIREMENTS_TRACEABILITY.md", ["# Requirements Traceability"]),
]

HEADER_FIELDS = [
    "Spec version:",
    "Repository revision:",
    "Last updated:",
    "Current phase:",
    "Current milestone:",
    "Current work package:",
    "Overall release gate:",
]

STATUS_SECTIONS = [
    "## Active work",
    "## Milestone table",
    "## Work-package table",
    "## Next READY package",
    "## Known release blockers",
]

MS_RE = re.compile(r"^##\s+(M\d{2})\s+[—–-]\s+(.*?)\s*$")
DEP_RE = re.compile(r"^\*\*Dependencies:\*\*\s*(.*?)\s*$")
PKG_ROW_RE = re.compile(r"^`?(M\d{2}-W\d{2})`?$")
ID_TOKEN_RE = re.compile(r"M(\d{2})")
RANGE_RE = re.compile(r"M(\d{2})\s*[–-]\s*M(\d{2})")


def parse_spec(spec_path: Path):
    """Return {milestone_id: {"title": str, "deps": set, "packages": [(id, title)]}} in spec order."""
    milestones: dict[str, dict] = {}
    current = None
    for raw in spec_path.read_text(encoding="utf-8").splitlines():
        m = MS_RE.match(raw)
        if m:
            current = m.group(1)
            milestones[current] = {"title": m.group(2), "deps": set(), "packages": []}
            continue
        if current is None:
            continue
        d = DEP_RE.match(raw.strip())
        if d:
            text = d.group(1).split(";")[0]
            text = re.split(r"preferably", text, flags=re.IGNORECASE)[0]
            expanded = set()
            for a, b in RANGE_RE.findall(text):
                for n in range(int(a), int(b) + 1):
                    expanded.add(f"M{n:02d}")
            text_no_ranges = RANGE_RE.sub(" ", text)
            for n in ID_TOKEN_RE.findall(text_no_ranges):
                expanded.add(f"M{n}")
            expanded.discard(current)
            milestones[current]["deps"] = expanded
            continue
        if raw.lstrip().startswith("|"):
            cells = [c.strip() for c in raw.strip().strip("|").split("|")]
            if len(cells) >= 2:
                pm = PKG_ROW_RE.match(cells[0])
                if pm:
                    pid = pm.group(1)
                    if pid[:3] != current:
                        raise ValueError(f"spec parse: package {pid} under milestone {current}")
                    milestones[current]["packages"].append((pid, cells[1]))
    if not milestones:
        raise ValueError("spec parse: no milestone sections found")
    return milestones


def _table_rows(lines: list[str]):
    for raw in lines:
        s = raw.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if not cells or set("".join(cells)) <= set("-: "):
            continue
        yield cells


def parse_status(status_path: Path):
    text = status_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    sections: dict[str, list[str]] = {}
    current = "__header__"
    sections[current] = []
    for raw in lines:
        if raw.startswith("## "):
            current = raw.strip()
            sections.setdefault(current, [])
            continue
        sections[current].append(raw)

    header: dict[str, str] = {}
    for raw in sections["__header__"]:
        for field in HEADER_FIELDS:
            if raw.strip().startswith(field):
                header[field] = raw.strip()[len(field):].strip()

    ms_rows: list[tuple[str, str]] = []
    for cells in _table_rows(sections.get("## Milestone table", [])):
        mid = cells[0].strip("`")
        if re.fullmatch(r"M\d{2}", mid) and len(cells) >= 2:
            ms_rows.append((mid, cells[1]))

    pkg_rows: list[tuple[str, str]] = []
    for cells in _table_rows(sections.get("## Work-package table", [])):
        pid = cells[0].strip("`")
        if re.fullmatch(r"M\d{2}-W\d{2}", pid) and len(cells) >= 2:
            pkg_rows.append((pid, cells[1]))

    next_ready = None
    for raw in sections.get("## Next READY package", []):
        s = raw.strip()
        if s.startswith("- ID:"):
            val = s[len("- ID:"):].strip()
            if val.upper().startswith("NONE"):
                next_ready = "NONE"
            else:
                m = re.search(r"M\d{2}-W\d{2}", val)
                next_ready = m.group(0) if m else val
            break

    return {
        "text": text,
        "sections": set(sections.keys()),
        "header": header,
        "milestone_rows": ms_rows,
        "package_rows": pkg_rows,
        "next_ready": next_ready,
    }


def validate(repo: Path, status_path: Path, spec_path: Path):
    errors: list[str] = []
    passed: list[str] = []

    # 1-2. Memory files exist, are non-empty, and contain required structure.
    for rel, needles in MEMORY_FILES:
        p = repo / rel
        actual = status_path if rel == "docs/PROJECT_STATUS.md" else (
            spec_path if rel == "docs/MASTER_IMPLEMENTATION_SPEC.md" else p)
        if not actual.is_file() or actual.stat().st_size == 0:
            errors.append(f"missing or empty project-memory file: {rel}")
            continue
        content = actual.read_text(encoding="utf-8", errors="replace")
        missing = [n for n in needles if n not in content]
        if missing:
            errors.append(f"{rel}: required structure not found: {missing}")
        else:
            passed.append(f"{rel}: present with required structure")

    try:
        spec = parse_spec(spec_path)
    except (OSError, ValueError) as e:
        errors.append(f"cannot parse spec: {e}")
        return errors, passed
    try:
        status = parse_status(status_path)
    except OSError as e:
        errors.append(f"cannot parse status: {e}")
        return errors, passed

    spec_pkg_ids = [pid for ms in spec.values() for pid, _ in ms["packages"]]
    passed.append(f"spec parsed: {len(spec)} milestones, {len(spec_pkg_ids)} work packages")

    # 3a. Header fields and sections.
    for field in HEADER_FIELDS:
        if field not in status["header"] or not status["header"][field]:
            errors.append(f"PROJECT_STATUS header field missing/empty: '{field}'")
    for sec in STATUS_SECTIONS:
        if sec not in status["sections"]:
            errors.append(f"PROJECT_STATUS required section missing: '{sec}'")
    if not errors:
        passed.append("PROJECT_STATUS header fields and sections present")

    # 3b. Milestone table completeness and enums.
    ms_states = {}
    for mid, state in status["milestone_rows"]:
        if mid in ms_states:
            errors.append(f"duplicate milestone row: {mid}")
        ms_states[mid] = state
        if state not in STATES:
            errors.append(f"invalid milestone state for {mid}: '{state}'")
    missing_ms = [m for m in spec if m not in ms_states]
    extra_ms = [m for m in ms_states if m not in spec]
    if missing_ms:
        errors.append(f"milestone table missing: {missing_ms}")
    if extra_ms:
        errors.append(f"milestone table has unknown milestones: {extra_ms}")
    if not missing_ms and not extra_ms:
        passed.append(f"milestone table complete ({len(ms_states)} rows, valid enums)")

    # 3c. Work-package table completeness and enums.
    pkg_states = {}
    for pid, state in status["package_rows"]:
        if pid in pkg_states:
            errors.append(f"duplicate work-package row: {pid}")
        pkg_states[pid] = state
        if state not in STATES:
            errors.append(f"invalid work-package state for {pid}: '{state}'")
    missing_pkg = [p for p in spec_pkg_ids if p not in pkg_states]
    extra_pkg = [p for p in pkg_states if p not in spec_pkg_ids]
    if missing_pkg:
        errors.append(f"work-package table missing {len(missing_pkg)} package(s): {missing_pkg[:8]}{'...' if len(missing_pkg) > 8 else ''}")
    if extra_pkg:
        errors.append(f"work-package table has unknown package(s): {extra_pkg}")
    if not missing_pkg and not extra_pkg:
        passed.append(f"work-package table complete ({len(pkg_states)} rows, exactly one state each)")

    # 3d. No more than one IN_PROGRESS package.
    in_progress = [p for p, s in pkg_states.items() if s == "IN_PROGRESS"]
    if len(in_progress) > 1:
        errors.append(f"more than one work package IN_PROGRESS: {sorted(in_progress)}")
    else:
        passed.append(f"IN_PROGRESS count ok ({len(in_progress)})")

    # 3e. Current-work-package header consistency.
    cur = status["header"].get("Current work package:", "")
    cur_id = (re.search(r"M\d{2}-W\d{2}", cur) or [None])
    cur_id = cur_id.group(0) if hasattr(cur_id, "group") else None
    if len(in_progress) == 1:
        if cur_id != in_progress[0]:
            errors.append(f"'Current work package' is '{cur}' but IN_PROGRESS package is {in_progress[0]}")
        else:
            passed.append("'Current work package' matches the IN_PROGRESS package")
    elif len(in_progress) == 0:
        if cur_id is not None and pkg_states.get(cur_id) != "BLOCKED":
            errors.append(f"'Current work package' is '{cur}' but no package is IN_PROGRESS (must be NONE or a BLOCKED package)")
        else:
            passed.append("'Current work package' consistent (NONE or BLOCKED)")
    # len(in_progress) > 1 is already reported by the IN_PROGRESS-count check.

    # 3f. Next READY package agrees with the table.
    nr = status["next_ready"]
    if nr is None:
        errors.append("'## Next READY package' section has no '- ID:' line")
    elif nr != "NONE":
        if pkg_states.get(nr) != "READY":
            errors.append(f"Next READY package is {nr} but its table state is '{pkg_states.get(nr)}'")
        else:
            passed.append(f"next READY package {nr} is READY in the table")
    else:
        passed.append("next READY package: NONE (explicit)")

    # 3g. Dependencies are not skipped.
    dep_errors = 0
    for pid, state in pkg_states.items():
        if state not in (STARTED | {"READY"}):
            continue
        mid = pid[:3]
        for dep in sorted(spec.get(mid, {}).get("deps", set())):
            not_done = [q for q, _ in spec[dep]["packages"] if pkg_states.get(q) not in DONE]
            if not_done:
                errors.append(f"{pid} is {state} but dependency milestone {dep} has unfinished packages (e.g. {not_done[:3]})")
                dep_errors += 1
        seq = [q for q, _ in spec[mid]["packages"]]
        for lower in seq[: seq.index(pid)]:
            if pkg_states.get(lower) not in DONE:
                errors.append(f"{pid} is {state} but earlier package {lower} is '{pkg_states.get(lower)}' (sequential convention)")
                dep_errors += 1
    if dep_errors == 0:
        passed.append("dependency order respected (milestone deps + sequential convention)")

    # 3h. Milestone-state consistency with package states.
    cons_errors = 0
    for mid, mstate in ms_states.items():
        pstates = [pkg_states.get(p) for p, _ in spec.get(mid, {}).get("packages", [])]
        if not pstates or any(s is None for s in pstates):
            continue
        if mstate == "NOT_STARTED" and any(s != "NOT_STARTED" for s in pstates):
            errors.append(f"milestone {mid} is NOT_STARTED but has packages beyond NOT_STARTED")
            cons_errors += 1
        if mstate == "ACCEPTED" and any(s != "ACCEPTED" for s in pstates):
            errors.append(f"milestone {mid} is ACCEPTED but not all packages are ACCEPTED")
            cons_errors += 1
    if cons_errors == 0:
        passed.append("milestone states consistent with package states")

    return errors, passed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--repo", default=None, help="repository root (default: parent of this script's directory)")
    ap.add_argument("--status", default=None, help="override path to PROJECT_STATUS.md (for negative tests)")
    ap.add_argument("--spec", default=None, help="override path to MASTER_IMPLEMENTATION_SPEC.md")
    ap.add_argument("--quiet", action="store_true", help="print only the final verdict")
    args = ap.parse_args()

    repo = Path(args.repo) if args.repo else Path(__file__).resolve().parent.parent
    status_path = Path(args.status) if args.status else repo / "docs" / "PROJECT_STATUS.md"
    spec_path = Path(args.spec) if args.spec else repo / "docs" / "MASTER_IMPLEMENTATION_SPEC.md"

    if not spec_path.is_file():
        print(f"FAIL: spec not found at {spec_path}", file=sys.stderr)
        return 2
    if not status_path.is_file():
        print(f"FAIL: status file not found at {status_path}", file=sys.stderr)
        return 2

    errors, passed = validate(repo, status_path, spec_path)
    if not args.quiet:
        for p in passed:
            print(f"  ok: {p}")
    if errors:
        print(f"FAIL: {len(errors)} violation(s):")
        for e in errors:
            print(f"  ERROR: {e}")
        return 1
    print(f"PASS: all checks passed ({len(passed)} check groups)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
