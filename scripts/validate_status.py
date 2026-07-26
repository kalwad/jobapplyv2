#!/usr/bin/env python3
"""Validate the structure of the canonical project-memory files.

Required by docs/MASTER_IMPLEMENTATION_SPEC.md (JAPP-MASTER-001 v1.2) §1.1 and
§12. Created in M00-W01; rewritten in M00-W05 for the v1.2 Workday-first
rebaseline and brought under the strict Ruff/mypy/pytest gates.

Checks performed
  1.  Every canonical project-memory file exists, is non-empty, and contains
      its required top-level structure (CLAUDE.md, the docs/ files including
      docs/CRITICAL_GATES.md, and the four docs/gates/ reports).
  2.  The canonical specification parses and defines exactly 39 milestones
      (M00-M38), 260 unique work packages, and 135 unique requirement IDs;
      the three §12 gate rules (M03/M06/M21) are derivable from it.
  3.  docs/PROJECT_STATUS.md structure: header fields, required sections,
      milestone/work-package table completeness against the spec, valid
      state enums, no duplicates, no more than one IN_PROGRESS package,
      current-package and next-READY consistency.
  4.  Critical-gates table: exactly the three v1.2 gates, valid gate-state
      enums, report paths present on disk, state agreement with the
      docs/CRITICAL_GATES.md ledger, and full evidence fields (revision,
      corpus/holdout hash, reviewer, owner decision, holdout result) before
      a gate may claim PASS.
  5.  Dependencies are not skipped: milestone dependencies parsed from the
      spec's "**Dependencies:**" lines, the intra-milestone sequential
      convention, ACCEPTED-milestone prerequisites (M03<-M02, M06<-M05,
      M20<-M19, M21<-M19+M20, M36<-M35), and gate-based readiness blocking
      (a package of M03/M06/M17/M18/M19/M21/M22/M23 may be READY or started
      only while its required critical gate is PASS).
  6.  Milestone-state consistency with package states.
  7.  Verified evidence preservation: every VERIFIED/ACCEPTED package row
      carries a `tree <hash>` revision (or the explicit `stamp pending`
      marker used between the content and stamp commits), links evidence in
      docs/TEST_EVIDENCE.md, and has a matching evidence heading there.
  8.  Exactly one canonical specification exists under docs/ (no second
      MASTER_IMPLEMENTATION_SPEC* file and no other file carrying the
      canonical specification header).

Exit codes: 0 = PASS, 1 = FAIL (violations listed), 2 = cannot parse/usage.
Usage: python3 scripts/validate_status.py [--repo DIR] [--status FILE]
       [--spec FILE] [--quiet]
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
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
GATE_STATES = {"NOT_EVALUATED", "IN_PROGRESS", "PASS", "REDESIGN_REQUIRED", "BLOCKED"}

EXPECTED_MILESTONES = 39
EXPECTED_PACKAGES = 260
EXPECTED_REQUIREMENTS = 135

GATES = (
    "AUTOFILL_FEASIBILITY",
    "RESUME_PAGEFIT_FEASIBILITY",
    "WORKDAY_GUIDED_PRE_SUBMIT",
)
GATE_REPORTS = {gate: f"docs/gates/{gate}_GATE.md" for gate in GATES}

# Spec §12 / §9.1 normative readiness rules. Gate qualifiers and
# "<Mxx> accepted" qualifiers are additionally parsed from the spec's
# dependency lines; these constants are the non-negotiable floor.
REQUIRED_GATE_RULES = {
    "M03": "AUTOFILL_FEASIBILITY",
    "M06": "RESUME_PAGEFIT_FEASIBILITY",
    "M21": "WORKDAY_GUIDED_PRE_SUBMIT",
}
HARD_ACCEPTED_DEPS = {"M03": ("M02",), "M06": ("M05",), "M21": ("M19", "M20")}

STAMP_PENDING = "stamp pending"
SPEC_HEADER_MARKER = "**Specification ID:** JAPP-MASTER-001"
CANONICAL_SPEC_REL = "docs/MASTER_IMPLEMENTATION_SPEC.md"
MIN_ROW_CELLS = 2
MISSING_PREVIEW_LIMIT = 8
SPEC_HEADER_SCAN_LINES = 60

MEMORY_FILES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("CLAUDE.md", ("Mandatory session bootstrap", CANONICAL_SPEC_REL)),
    (
        CANONICAL_SPEC_REL,
        (
            "JAPP-MASTER-001",
            "**Version:** 1.2",
            "## 12. Required project-status format",
        ),
    ),
    ("docs/PROJECT_STATUS.md", ("# Project Status",)),
    ("docs/DECISIONS.md", ("# Decisions", "## Owner decisions", "## ADR template")),
    ("docs/TEST_EVIDENCE.md", ("# Test Evidence", "## Entry template")),
    ("docs/KNOWN_ISSUES.md", ("# Known Issues", "## Entry template")),
    ("docs/COMPATIBILITY_MATRIX.md", ("# Compatibility Matrix",)),
    ("docs/REQUIREMENTS_TRACEABILITY.md", ("# Requirements Traceability",)),
    ("docs/CRITICAL_GATES.md", ("# Critical Gates", *GATES)),
    ("docs/gates/AUTOFILL_FEASIBILITY_GATE.md", ("AUTOFILL_FEASIBILITY",)),
    (
        "docs/gates/RESUME_PAGEFIT_FEASIBILITY_GATE.md",
        ("RESUME_PAGEFIT_FEASIBILITY",),
    ),
    (
        "docs/gates/WORKDAY_GUIDED_PRE_SUBMIT_GATE.md",
        ("WORKDAY_GUIDED_PRE_SUBMIT",),
    ),
    ("docs/gates/HOLDOUT_EXECUTION_LOG.md", ("# Holdout Execution Log",)),
)

HEADER_FIELDS = (
    "Spec version:",
    "Repository revision:",
    "Last updated:",
    "Current phase:",
    "Current milestone:",
    "Current work package:",
    "Overall release gate:",
)

STATUS_SECTIONS = (
    "## Critical gates",
    "## Active work",
    "## Milestone table",
    "## Work-package table",
    "## Next READY package",
    "## Known release blockers",
)

MS_RE = re.compile(r"^##\s+(M\d{2})\s+[—–-]\s+(.*?)\s*$")
DEP_RE = re.compile(r"^\*\*Dependencies:\*\*\s*(.*?)\s*$")
PKG_ROW_RE = re.compile(r"^`?(M\d{2}-W\d{2})`?$")
PKG_ID_RE = re.compile(r"M\d{2}-W\d{2}")
ID_TOKEN_RE = re.compile(r"M(\d{2})")
RANGE_RE = re.compile(r"M(\d{2})\s*[–-]\s*M(\d{2})")
REQ_ID_RE = re.compile(r"`(REQ-[A-Z]+-\d{3})`")
GATE_QUALIFIER_RE = re.compile(r"with\s+`([A-Z_]+)\s*=\s*PASS`")
ACCEPTED_QUALIFIER_RE = re.compile(r"\b(M\d{2}) accepted\b")
TREE_REVISION_RE = re.compile(r"^tree [0-9a-f]{40}(\s.*)?$")


@dataclass
class Milestone:
    title: str
    deps: set[str] = field(default_factory=set)
    gates: set[str] = field(default_factory=set)
    accepted_deps: set[str] = field(default_factory=set)
    packages: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class Spec:
    milestones: dict[str, Milestone]
    requirement_ids: list[str]

    def package_ids(self) -> list[str]:
        return [pid for ms in self.milestones.values() for pid, _ in ms.packages]


@dataclass
class Status:
    sections: dict[str, list[str]]
    header: dict[str, str]
    milestone_rows: list[tuple[str, str]]
    package_rows: list[list[str]]
    gate_rows: list[list[str]]
    next_ready: str | None


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    passed: list[str] = field(default_factory=list)

    def ok(self, message: str) -> None:
        self.passed.append(message)

    def fail(self, message: str) -> None:
        self.errors.append(message)


def _dep_tokens(segment: str) -> set[str]:
    tokens: set[str] = set()
    for start, end in RANGE_RE.findall(segment):
        for number in range(int(start), int(end) + 1):
            tokens.add(f"M{number:02d}")
    remainder = RANGE_RE.sub(" ", segment)
    for number in ID_TOKEN_RE.findall(remainder):
        tokens.add(f"M{number}")
    return tokens


def _parse_dependency_line(
    text: str, current: str
) -> tuple[set[str], set[str], set[str]]:
    """Return (milestone deps, required gates, ACCEPTED-milestone deps).

    The first ';'-segment always contributes dependency tokens. Later
    segments contribute only when they are pure dependency lists (e.g. the
    "M16, M18" tail of M20); prose tails such as M11's "until M17 connects
    the browser extension" and advisory "preferably ..." phrases do not.
    """
    gates = set(GATE_QUALIFIER_RE.findall(text))
    accepted = set(ACCEPTED_QUALIFIER_RE.findall(text))
    deps: set[str] = set()
    for index, raw_segment in enumerate(text.split(";")):
        segment = re.split(r"\bpreferably\b", raw_segment, flags=re.IGNORECASE)[0]
        if index == 0:
            deps |= _dep_tokens(segment)
            continue
        residue = GATE_QUALIFIER_RE.sub(" ", segment)
        residue = RANGE_RE.sub(" ", residue)
        residue = ID_TOKEN_RE.sub(" ", residue)
        residue = re.sub(r"\b(and|accepted|patterns|with)\b", " ", residue)
        if not re.search(r"[A-Za-z]", residue):
            deps |= _dep_tokens(segment)
    deps.discard(current)
    return deps, gates, accepted


def parse_spec(spec_path: Path) -> Spec:
    text = spec_path.read_text(encoding="utf-8")
    milestones: dict[str, Milestone] = {}
    current: str | None = None
    for raw in text.splitlines():
        heading = MS_RE.match(raw)
        if heading:
            current = heading.group(1)
            if current in milestones:
                raise ValueError(f"duplicate milestone heading: {current}")
            milestones[current] = Milestone(title=heading.group(2))
            continue
        if current is None:
            continue
        dep_line = DEP_RE.match(raw.strip())
        if dep_line:
            deps, gates, accepted = _parse_dependency_line(dep_line.group(1), current)
            milestones[current].deps = deps
            milestones[current].gates = gates
            milestones[current].accepted_deps = accepted
            continue
        if raw.lstrip().startswith("|"):
            cells = [cell.strip() for cell in raw.strip().strip("|").split("|")]
            if len(cells) >= MIN_ROW_CELLS:
                row = PKG_ROW_RE.match(cells[0])
                if row:
                    pid = row.group(1)
                    if pid[:3] != current:
                        raise ValueError(
                            f"spec parse: package {pid} under milestone {current}"
                        )
                    milestones[current].packages.append((pid, cells[1]))
    if not milestones:
        raise ValueError("spec parse: no milestone sections found")
    requirement_ids: list[str] = []
    seen: set[str] = set()
    for req_id in REQ_ID_RE.findall(text):
        if req_id not in seen:
            seen.add(req_id)
            requirement_ids.append(req_id)
    return Spec(milestones=milestones, requirement_ids=requirement_ids)


def _table_rows(lines: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for raw in lines:
        stripped = raw.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if not cells or set("".join(cells)) <= set("-: "):
            continue
        rows.append(cells)
    return rows


def _parse_header(lines: list[str]) -> dict[str, str]:
    header: dict[str, str] = {}
    for raw in lines:
        for field_name in HEADER_FIELDS:
            if raw.strip().startswith(field_name):
                header[field_name] = raw.strip()[len(field_name) :].strip()
    return header


def _parse_next_ready(lines: list[str]) -> str | None:
    for raw in lines:
        stripped = raw.strip()
        if stripped.startswith("- ID:"):
            value = stripped[len("- ID:") :].strip()
            if value.upper().startswith("NONE"):
                return "NONE"
            match = PKG_ID_RE.search(value)
            return match.group(0) if match else value
    return None


def parse_status(status_path: Path) -> Status:
    sections: dict[str, list[str]] = {"__header__": []}
    current = "__header__"
    for raw in status_path.read_text(encoding="utf-8").splitlines():
        if raw.startswith("## "):
            current = raw.strip()
            sections.setdefault(current, [])
            continue
        sections[current].append(raw)

    milestone_rows: list[tuple[str, str]] = []
    for cells in _table_rows(sections.get("## Milestone table", [])):
        mid = cells[0].strip("`")
        if re.fullmatch(r"M\d{2}", mid) and len(cells) >= MIN_ROW_CELLS:
            milestone_rows.append((mid, cells[1]))

    package_rows: list[list[str]] = []
    for cells in _table_rows(sections.get("## Work-package table", [])):
        pid = cells[0].strip("`")
        if re.fullmatch(r"M\d{2}-W\d{2}", pid) and len(cells) >= MIN_ROW_CELLS:
            package_rows.append([pid, *cells[1:]])

    gate_rows: list[list[str]] = []
    for cells in _table_rows(sections.get("## Critical gates", [])):
        if cells[0] != "Gate" and re.fullmatch(r"[A-Z][A-Z_]+", cells[0]):
            gate_rows.append(cells)

    return Status(
        sections=sections,
        header=_parse_header(sections["__header__"]),
        milestone_rows=milestone_rows,
        package_rows=package_rows,
        gate_rows=gate_rows,
        next_ready=_parse_next_ready(sections.get("## Next READY package", [])),
    )


def check_memory_files(
    repo: Path, status_path: Path, spec_path: Path, report: Report
) -> None:
    for rel, needles in MEMORY_FILES:
        if rel == "docs/PROJECT_STATUS.md":
            actual = status_path
        elif rel == CANONICAL_SPEC_REL:
            actual = spec_path
        else:
            actual = repo / rel
        if not actual.is_file() or actual.stat().st_size == 0:
            report.fail(f"missing or empty project-memory file: {rel}")
            continue
        content = actual.read_text(encoding="utf-8", errors="replace")
        missing = [needle for needle in needles if needle not in content]
        if missing:
            report.fail(f"{rel}: required structure not found: {missing}")
        else:
            report.ok(f"{rel}: present with required structure")


def check_spec_inventory(spec: Spec, report: Report) -> None:
    milestone_count = len(spec.milestones)
    package_ids = spec.package_ids()
    if milestone_count != EXPECTED_MILESTONES:
        report.fail(
            f"spec defines {milestone_count} milestones "
            f"(expected {EXPECTED_MILESTONES})"
        )
    if len(package_ids) != EXPECTED_PACKAGES or len(set(package_ids)) != len(
        package_ids
    ):
        report.fail(
            f"spec defines {len(package_ids)} work packages, "
            f"{len(set(package_ids))} unique (expected {EXPECTED_PACKAGES} unique)"
        )
    if len(spec.requirement_ids) != EXPECTED_REQUIREMENTS:
        report.fail(
            f"spec defines {len(spec.requirement_ids)} unique requirement IDs "
            f"(expected {EXPECTED_REQUIREMENTS})"
        )
    rule_errors = [
        f"spec integrity: §12 gate rule for {mid} ({gate}) is not derivable "
        "from its dependency line"
        for mid, gate in REQUIRED_GATE_RULES.items()
        if gate not in spec.milestones.get(mid, Milestone(title="")).gates
    ]
    for error in rule_errors:
        report.fail(error)
    if not rule_errors and milestone_count == EXPECTED_MILESTONES:
        report.ok(
            f"spec parsed: {milestone_count} milestones, {len(package_ids)} work "
            f"packages, {len(spec.requirement_ids)} requirements; §12 gate rules "
            "derivable"
        )


def check_status_shell(status: Status, report: Report) -> None:
    shell_errors = 0
    for field_name in HEADER_FIELDS:
        if not status.header.get(field_name):
            report.fail(f"PROJECT_STATUS header field missing/empty: '{field_name}'")
            shell_errors += 1
    for section in STATUS_SECTIONS:
        if section not in status.sections:
            report.fail(f"PROJECT_STATUS required section missing: '{section}'")
            shell_errors += 1
    if shell_errors == 0:
        report.ok("PROJECT_STATUS header fields and sections present")


GATE_SECTION_HEADING_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")
LEDGER_STATE_LINE_RE = re.compile(r"^- State: ([A-Z_]+)\s*$", flags=re.MULTILINE)


def _parse_ledger_sections(repo: Path) -> tuple[dict[str, list[str]], list[str]]:
    """Parse docs/CRITICAL_GATES.md gate sections.

    Returns (per-gate list of '- State:' values for every required gate whose
    '## <GATE>' section exists, unknown gate-like section headings). Missing
    sections are absent from the map; empty/duplicate state-line lists are the
    caller's job to reject (M00-W05 audit finding: a section stripped of its
    state line must fail, not silently skip the agreement check).
    """
    ledger = repo / "docs" / "CRITICAL_GATES.md"
    sections: dict[str, list[str]] = {}
    unknown: list[str] = []
    if not ledger.is_file():
        return sections, unknown
    for part in ledger.read_text(encoding="utf-8").split("\n## ")[1:]:
        heading = part.splitlines()[0].strip() if part.splitlines() else ""
        if not GATE_SECTION_HEADING_RE.fullmatch(heading):
            continue
        if heading in GATES:
            sections[heading] = LEDGER_STATE_LINE_RE.findall(part)
        else:
            unknown.append(heading)
    return sections, unknown


def _check_ledger_agreement(
    repo: Path, gate_states: dict[str, str], report: Report
) -> int:
    errors = 0
    ledger_sections, unknown_sections = _parse_ledger_sections(repo)
    if not (repo / "docs" / "CRITICAL_GATES.md").is_file():
        # Absence of the ledger itself is reported by check_memory_files.
        return errors
    for heading in unknown_sections:
        report.fail(
            f"docs/CRITICAL_GATES.md has unknown gate-like section "
            f"'## {heading}' (cannot substitute for a required gate)"
        )
        errors += 1
    for gate in GATES:
        values = ledger_sections.get(gate)
        if values is None:
            report.fail(f"docs/CRITICAL_GATES.md is missing the '## {gate}' section")
            errors += 1
            continue
        if len(values) == 0:
            report.fail(
                f"docs/CRITICAL_GATES.md section '## {gate}' has no '- State:' line"
            )
            errors += 1
            continue
        if len(values) > 1:
            report.fail(
                f"docs/CRITICAL_GATES.md section '## {gate}' has "
                f"{len(values)} '- State:' lines (exactly one required)"
            )
            errors += 1
            continue
        value = values[0]
        if value not in GATE_STATES:
            report.fail(
                f"docs/CRITICAL_GATES.md records invalid state '{value}' for {gate}"
            )
            errors += 1
            continue
        status_state = gate_states.get(gate)
        if status_state is not None and status_state != value:
            report.fail(
                f"gate {gate} state mismatch: PROJECT_STATUS says "
                f"{status_state}, docs/CRITICAL_GATES.md says {value}"
            )
            errors += 1
    return errors


def _check_gate_pass_evidence(
    repo: Path, gate: str, cells: list[str], report: Report
) -> None:
    padded = [*cells, "", "", "", "", ""][:6]
    _, _, revision, corpus_hash, reviewer, _ = padded
    problems: list[str] = []
    if revision in {"", "—"}:
        problems.append("evaluated revision is empty")
    if corpus_hash in {"", "—"}:
        problems.append("corpus/holdout hash is empty")
    if reviewer in {"", "—"}:
        problems.append("independent reviewer is empty")
    report_path = repo / GATE_REPORTS[gate]
    report_text = (
        report_path.read_text(encoding="utf-8") if report_path.is_file() else ""
    )
    # Gate reports are append-only run history: the LAST recorded value is the
    # current one (the template ships with a leading "pending" entry).
    decisions = re.findall(r"Owner decision:\s*(\S+)", report_text)
    holdouts = re.findall(r"Holdout result:\s*(\S+)", report_text)
    if not decisions or decisions[-1].lower() in {"pending", "—"}:
        problems.append("gate report records no owner decision")
    if not holdouts or holdouts[-1].lower() in {"pending", "—"}:
        problems.append("gate report records no holdout result")
    for problem in problems:
        report.fail(f"{gate} is PASS but {problem} (PASS prerequisites, spec §12)")


def check_gates(repo: Path, status: Status, report: Report) -> dict[str, str]:
    gate_states: dict[str, str] = {}
    gate_errors = 0
    for cells in status.gate_rows:
        gate, state = cells[0], cells[1] if len(cells) > 1 else ""
        if gate not in GATES:
            report.fail(f"critical-gates table has unknown gate: {gate}")
            gate_errors += 1
            continue
        if gate in gate_states:
            report.fail(f"duplicate critical-gates row: {gate}")
            gate_errors += 1
        gate_states[gate] = state
        if state not in GATE_STATES:
            report.fail(f"invalid gate state for {gate}: '{state}'")
            gate_errors += 1
            continue
        if state == "PASS":
            before = len(report.errors)
            _check_gate_pass_evidence(repo, gate, cells, report)
            gate_errors += len(report.errors) - before
    for gate in GATES:
        if gate not in gate_states:
            report.fail(f"critical-gates table missing gate: {gate}")
            gate_errors += 1
        if not (repo / GATE_REPORTS[gate]).is_file():
            report.fail(f"gate report missing: {GATE_REPORTS[gate]}")
            gate_errors += 1
    gate_errors += _check_ledger_agreement(repo, gate_states, report)
    if gate_errors == 0:
        report.ok(
            "critical-gates table valid (3 gates, valid states, reports "
            "present, ledger complete and agreeing)"
        )
    return gate_states


def check_tables(
    spec: Spec, status: Status, report: Report
) -> tuple[dict[str, str], dict[str, str]]:
    ms_states: dict[str, str] = {}
    for mid, state in status.milestone_rows:
        if mid in ms_states:
            report.fail(f"duplicate milestone row: {mid}")
        ms_states[mid] = state
        if state not in STATES:
            report.fail(f"invalid milestone state for {mid}: '{state}'")
    missing_ms = [mid for mid in spec.milestones if mid not in ms_states]
    extra_ms = [mid for mid in ms_states if mid not in spec.milestones]
    if missing_ms:
        report.fail(f"milestone table missing: {missing_ms}")
    if extra_ms:
        report.fail(f"milestone table has unknown milestones: {extra_ms}")
    if not missing_ms and not extra_ms:
        report.ok(f"milestone table complete ({len(ms_states)} rows, valid enums)")

    pkg_states: dict[str, str] = {}
    for cells in status.package_rows:
        pid, state = cells[0], cells[1]
        if pid in pkg_states:
            report.fail(f"duplicate work-package row: {pid}")
        pkg_states[pid] = state
        if state not in STATES:
            report.fail(f"invalid work-package state for {pid}: '{state}'")
    spec_pkg_ids = spec.package_ids()
    missing_pkg = [pid for pid in spec_pkg_ids if pid not in pkg_states]
    extra_pkg = [pid for pid in pkg_states if pid not in spec_pkg_ids]
    if missing_pkg:
        preview = missing_pkg[:MISSING_PREVIEW_LIMIT]
        suffix = "..." if len(missing_pkg) > MISSING_PREVIEW_LIMIT else ""
        report.fail(
            f"work-package table missing {len(missing_pkg)} package(s): "
            f"{preview}{suffix}"
        )
    if extra_pkg:
        report.fail(f"work-package table has unknown package(s): {extra_pkg}")
    if not missing_pkg and not extra_pkg:
        report.ok(
            f"work-package table complete ({len(pkg_states)} rows, exactly one "
            "state each)"
        )
    return ms_states, pkg_states


def _check_next_ready(
    next_ready: str | None, pkg_states: dict[str, str], report: Report
) -> None:
    if next_ready is None:
        report.fail("'## Next READY package' section has no '- ID:' line")
    elif next_ready != "NONE":
        if pkg_states.get(next_ready) != "READY":
            report.fail(
                f"Next READY package is {next_ready} but its table state is "
                f"'{pkg_states.get(next_ready)}'"
            )
        else:
            report.ok(f"next READY package {next_ready} is READY in the table")
    else:
        report.ok("next READY package: NONE (explicit)")


def check_progress_consistency(
    status: Status, pkg_states: dict[str, str], report: Report
) -> None:
    in_progress = [pid for pid, state in pkg_states.items() if state == "IN_PROGRESS"]
    if len(in_progress) > 1:
        report.fail(f"more than one work package IN_PROGRESS: {sorted(in_progress)}")
    else:
        report.ok(f"IN_PROGRESS count ok ({len(in_progress)})")

    current = status.header.get("Current work package:", "")
    current_match = PKG_ID_RE.search(current)
    current_id = current_match.group(0) if current_match else None
    if len(in_progress) == 1:
        if current_id != in_progress[0]:
            report.fail(
                f"'Current work package' is '{current}' but IN_PROGRESS package "
                f"is {in_progress[0]}"
            )
        else:
            report.ok("'Current work package' matches the IN_PROGRESS package")
    elif len(in_progress) == 0:
        if current_id is not None and pkg_states.get(current_id) != "BLOCKED":
            report.fail(
                f"'Current work package' is '{current}' but no package is "
                "IN_PROGRESS (must be NONE or a BLOCKED package)"
            )
        else:
            report.ok("'Current work package' consistent (NONE or BLOCKED)")

    _check_next_ready(status.next_ready, pkg_states, report)


def _started_or_ready(
    spec: Spec, pkg_states: dict[str, str]
) -> list[tuple[str, str, Milestone]]:
    rows: list[tuple[str, str, Milestone]] = []
    for pid, state in pkg_states.items():
        if state not in (STARTED | {"READY"}):
            continue
        milestone = spec.milestones.get(pid[:3])
        if milestone is not None:
            rows.append((pid, state, milestone))
    return rows


def _check_dependency_order(
    spec: Spec, pkg_states: dict[str, str], report: Report
) -> int:
    errors = 0
    for pid, state, milestone in _started_or_ready(spec, pkg_states):
        for dep in sorted(milestone.deps):
            unfinished = [
                dep_pid
                for dep_pid, _ in spec.milestones[dep].packages
                if pkg_states.get(dep_pid) not in DONE
            ]
            if unfinished:
                report.fail(
                    f"{pid} is {state} but dependency milestone {dep} has "
                    f"unfinished packages (e.g. {unfinished[:3]})"
                )
                errors += 1
        sequence = [seq_pid for seq_pid, _ in milestone.packages]
        if pid in sequence:
            for lower in sequence[: sequence.index(pid)]:
                if pkg_states.get(lower) not in DONE:
                    report.fail(
                        f"{pid} is {state} but earlier package {lower} is "
                        f"'{pkg_states.get(lower)}' (sequential convention)"
                    )
                    errors += 1
    return errors


def _check_readiness_prerequisites(
    spec: Spec,
    ms_states: dict[str, str],
    pkg_states: dict[str, str],
    gate_states: dict[str, str],
    report: Report,
) -> int:
    errors = 0
    for pid, state, milestone in _started_or_ready(spec, pkg_states):
        mid = pid[:3]
        accepted_required = set(milestone.accepted_deps) | set(
            HARD_ACCEPTED_DEPS.get(mid, ())
        )
        for dep in sorted(accepted_required):
            if ms_states.get(dep) != "ACCEPTED":
                report.fail(
                    f"{pid} is {state} but milestone {dep} is "
                    f"'{ms_states.get(dep)}' (ACCEPTED required)"
                )
                errors += 1
        required_gates = set(milestone.gates)
        if mid in REQUIRED_GATE_RULES:
            required_gates.add(REQUIRED_GATE_RULES[mid])
        for gate in sorted(required_gates):
            if gate_states.get(gate) != "PASS":
                report.fail(
                    f"{pid} is {state} but critical gate {gate} is "
                    f"{gate_states.get(gate)} (PASS required)"
                )
                errors += 1
    return errors


def check_dependencies(
    spec: Spec,
    ms_states: dict[str, str],
    pkg_states: dict[str, str],
    gate_states: dict[str, str],
    report: Report,
) -> None:
    errors = _check_dependency_order(spec, pkg_states, report)
    errors += _check_readiness_prerequisites(
        spec, ms_states, pkg_states, gate_states, report
    )
    if errors == 0:
        report.ok(
            "dependency order respected (milestone deps, ACCEPTED prerequisites, "
            "critical gates, sequential convention)"
        )


def check_milestone_consistency(
    spec: Spec,
    ms_states: dict[str, str],
    pkg_states: dict[str, str],
    report: Report,
) -> None:
    consistency_errors = 0
    for mid, ms_state in ms_states.items():
        milestone = spec.milestones.get(mid)
        if milestone is None:
            continue
        states = [pkg_states.get(pid) for pid, _ in milestone.packages]
        if not states or any(state is None for state in states):
            continue
        if ms_state == "NOT_STARTED" and any(
            state != "NOT_STARTED" for state in states
        ):
            report.fail(
                f"milestone {mid} is NOT_STARTED but has packages beyond NOT_STARTED"
            )
            consistency_errors += 1
        if ms_state == "ACCEPTED" and any(state != "ACCEPTED" for state in states):
            report.fail(
                f"milestone {mid} is ACCEPTED but not all packages are ACCEPTED"
            )
            consistency_errors += 1
    if consistency_errors == 0:
        report.ok("milestone states consistent with package states")


def check_evidence_preservation(repo: Path, status: Status, report: Report) -> None:
    evidence_path = repo / "docs" / "TEST_EVIDENCE.md"
    evidence_text = (
        evidence_path.read_text(encoding="utf-8") if evidence_path.is_file() else ""
    )
    preservation_errors = 0
    for cells in status.package_rows:
        padded = [*cells, "", "", ""][:4]
        pid, state, revision, evidence_link = padded
        if state not in DONE:
            continue
        if revision != STAMP_PENDING and not TREE_REVISION_RE.match(revision):
            report.fail(
                f"{pid} is {state} but its verified-revision cell is "
                f"'{revision}' (expected 'tree <40-hex>' or '{STAMP_PENDING}')"
            )
            preservation_errors += 1
        if "TEST_EVIDENCE.md" not in evidence_link:
            report.fail(
                f"{pid} is {state} but its evidence-link cell does not "
                "reference docs/TEST_EVIDENCE.md"
            )
            preservation_errors += 1
        if f"### {pid}" not in evidence_text:
            report.fail(
                f"{pid} is {state} but docs/TEST_EVIDENCE.md has no '### {pid}' entry"
            )
            preservation_errors += 1
    if preservation_errors == 0:
        report.ok(
            "verified/accepted packages carry tree revisions and linked "
            "TEST_EVIDENCE entries"
        )


def check_single_canonical_spec(repo: Path, report: Report) -> None:
    docs_dir = repo / "docs"
    canonical = repo / CANONICAL_SPEC_REL
    offenders: list[str] = []
    if docs_dir.is_dir():
        for path in sorted(docs_dir.rglob("*.md")):
            if path == canonical:
                continue
            rel = path.relative_to(repo).as_posix()
            if path.name.startswith("MASTER_IMPLEMENTATION_SPEC"):
                offenders.append(rel)
                continue
            try:
                head = "\n".join(
                    path.read_text(encoding="utf-8", errors="replace").splitlines()[
                        :SPEC_HEADER_SCAN_LINES
                    ]
                )
            except OSError:
                continue
            if SPEC_HEADER_MARKER in head:
                offenders.append(rel)
    for rel in offenders:
        report.fail(f"second canonical-looking specification present: {rel}")
    if not offenders:
        report.ok("exactly one canonical specification exists under docs/")


def validate(repo: Path, status_path: Path, spec_path: Path) -> Report:
    report = Report()
    check_memory_files(repo, status_path, spec_path, report)
    try:
        spec = parse_spec(spec_path)
    except (OSError, ValueError) as exc:
        report.fail(f"cannot parse spec: {exc}")
        return report
    try:
        status = parse_status(status_path)
    except OSError as exc:
        report.fail(f"cannot parse status: {exc}")
        return report
    check_spec_inventory(spec, report)
    check_status_shell(status, report)
    gate_states = check_gates(repo, status, report)
    ms_states, pkg_states = check_tables(spec, status, report)
    check_progress_consistency(status, pkg_states, report)
    check_dependencies(spec, ms_states, pkg_states, gate_states, report)
    check_milestone_consistency(spec, ms_states, pkg_states, report)
    check_evidence_preservation(repo, status, report)
    check_single_canonical_spec(repo, report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the canonical project-memory files (spec §12)."
    )
    parser.add_argument(
        "--repo",
        default=None,
        help="repository root (default: parent of this script's directory)",
    )
    parser.add_argument(
        "--status",
        default=None,
        help="override path to PROJECT_STATUS.md (for negative tests)",
    )
    parser.add_argument(
        "--spec", default=None, help="override path to MASTER_IMPLEMENTATION_SPEC.md"
    )
    parser.add_argument(
        "--quiet", action="store_true", help="print only the final verdict"
    )
    args = parser.parse_args()

    repo = Path(args.repo) if args.repo else Path(__file__).resolve().parent.parent
    status_path = (
        Path(args.status) if args.status else repo / "docs" / "PROJECT_STATUS.md"
    )
    spec_path = Path(args.spec) if args.spec else repo / CANONICAL_SPEC_REL

    if not spec_path.is_file():
        print(f"FAIL: spec not found at {spec_path}", file=sys.stderr)
        return 2
    if not status_path.is_file():
        print(f"FAIL: status file not found at {status_path}", file=sys.stderr)
        return 2

    report = validate(repo, status_path, spec_path)
    if not args.quiet:
        for message in report.passed:
            print(f"  ok: {message}")
    if report.errors:
        print(f"FAIL: {len(report.errors)} violation(s):")
        for message in report.errors:
            print(f"  ERROR: {message}")
        return 1
    print(f"PASS: all checks passed ({len(report.passed)} check groups)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
