#!/usr/bin/env python3
"""Validate the structure of the canonical project-memory files.

Required by docs/MASTER_IMPLEMENTATION_SPEC.md (JAPP-MASTER-001 v1.4) §1.1 and
§12. Created in M00-W01, rewritten for the v1.2 Workday-first rebaseline in
M00-W05, extended for v1.3 in M00-W08…W10, and extended for the v1.4
familiarity/provider governance rebaseline in M00-W11.

Checks performed
  1.  Every canonical project-memory file exists, is non-empty, and contains
      its required top-level structure (CLAUDE.md, the docs/ files including
      docs/CRITICAL_GATES.md, platform-governance memory, and gate reports).
  2.  The canonical specification parses and defines exactly 39 milestones
      (M00-M38), 300 unique work packages, and 193 unique requirement IDs;
      the four §12 gate rules (M03/M06/M21/M28) are derivable from it.
  3.  docs/PROJECT_STATUS.md structure: header fields, required sections,
      milestone/work-package table completeness against the spec, valid
      state enums, no duplicates, no more than one IN_PROGRESS package,
      current-package and next-READY consistency, and the canonical current
      release-gate value.
  4.  Critical-gates table: exactly the four v1.4 gates, valid gate-state
      enums, report paths present on disk, state agreement with the
      docs/CRITICAL_GATES.md ledger, and full evidence fields (revision,
      corpus/holdout hash, reviewer, owner decision, holdout result) before
      a gate may claim PASS; Gate D additionally requires accepted full-AI
      profiles plus resolvable repository evidence for its bundle, profile
      rows, and certified-platform rows.
  5.  Dependencies are not skipped: milestone dependencies parsed from the
      spec's "**Dependencies:**" lines, the intra-milestone sequential
      convention, ACCEPTED state for every dependency milestone, explicit
      ACCEPTED-milestone prerequisites (M03<-M02, M06<-M05, M20<-M19,
      M21<-M19+M20, M36<-M35), and gate-based readiness blocking
      (a package with a declared M03/M06/M21/M28 gate prerequisite may be
      READY or started only while its required critical gate is PASS).
      the M00-W11/M01-W07 migration boundary is enforced; M00 acceptance
      requires all eleven M00 packages to be exactly VERIFIED; and M27 uses
      its explicit W01…W11 -> W13 -> W14 -> W12 terminal order.
  6.  Milestone-state consistency with package states.
  7.  Verified evidence preservation: every VERIFIED/ACCEPTED package row
      carries a `tree <hash>` revision (or the explicit `stamp pending`
      marker used between the content and stamp commits), links evidence in
      docs/TEST_EVIDENCE.md, and has a matching evidence heading there.
  8.  Exactly one regular, non-symlink canonical specification exists under
      docs/ (including case/Unicode/editor-backup filename variants and files
      of any extension carrying the canonical specification header).
  9.  Every live CRITICAL/HIGH KNOWN_ISSUES entry is reconciled with the
      PROJECT_STATUS blocker ledger, affected milestone acceptance, and
      zero-READY-package state.

Exit codes: 0 = PASS, 1 = FAIL (violations listed), 2 = cannot parse/usage.
Usage: python3 scripts/validate_status.py [--repo DIR] [--status FILE]
       [--spec FILE] [--quiet]
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

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
EXPECTED_PACKAGES = 300
EXPECTED_REQUIREMENTS = 193
EXPECTED_SPEC_SHA256 = (
    "3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943"
)

GATES = (
    "AUTOFILL_FEASIBILITY",
    "RESUME_PAGEFIT_FEASIBILITY",
    "WORKDAY_GUIDED_PRE_SUBMIT",
    "CROSS_PLATFORM_CORE",
)
GATE_REPORTS = {gate: f"docs/gates/{gate}_GATE.md" for gate in GATES}

# Spec §12 / §9.1 normative readiness rules. Gate qualifiers and
# "<Mxx> accepted" qualifiers are additionally parsed from the spec's
# dependency lines; these constants are the non-negotiable floor.
REQUIRED_GATE_RULES = {
    "M03": "AUTOFILL_FEASIBILITY",
    "M06": "RESUME_PAGEFIT_FEASIBILITY",
    "M21": "WORKDAY_GUIDED_PRE_SUBMIT",
    "M28": "CROSS_PLATFORM_CORE",
}
HARD_ACCEPTED_DEPS = {
    "M03": ("M02",),
    "M06": ("M05",),
    "M21": ("M19", "M20"),
    "M28": ("M27",),
}
GATE_DECISION_PACKAGES = {
    "AUTOFILL_FEASIBILITY": "M02-W15",
    "RESUME_PAGEFIT_FEASIBILITY": "M05-W12",
    "WORKDAY_GUIDED_PRE_SUBMIT": "M20-W11",
    "CROSS_PLATFORM_CORE": "M27-W12",
}
GATE_EVALUATION_PACKAGES = {
    "AUTOFILL_FEASIBILITY": "M02-W14",
    "RESUME_PAGEFIT_FEASIBILITY": "M05-W11",
    "WORKDAY_GUIDED_PRE_SUBMIT": "M20-W10",
    "CROSS_PLATFORM_CORE": "M27-W12",
}

PRESERVED_PACKAGE_ANCHORS = {
    "M00-W01": (
        "tree e1dd209417af97b3cab320b4ab01fbd702547136",
        "63d9442258c68a9dd8ecb9a20810e5740679557c",
    ),
    "M00-W02": (
        "tree 15cc0edec64e4b4f986e7c1ee210d88a1e448140",
        "b64f54da8ec3c302bd28efac68afd80ea5efc142",
    ),
    "M00-W03": (
        "tree 323df745c419d8cc7809e88f10bbeca018fdfbb2",
        "aa6b3503405651f915d21027524b112bce11f2a2",
    ),
    "M00-W04": (
        "tree 6c798abfd76824fd43c09c72615a3a976406f081",
        "5181538ba8d76fc8b75155dd2e8514797a13647b",
    ),
    "M00-W05": (
        "tree 0c6fe779cc56755983d39951cabcdf201867bae2",
        "c2c834ef44892b70706e0ee1985d1fda1fb8f4da",
    ),
    "M00-W06": (
        "tree 9f9adc79cea15cb2f3a855b2b66463467822b5bf",
        "124418f3a34389c4c56dced60a9fff9a5947adc4",
    ),
    "M00-W07": (
        "tree fee2902010eb90704c05e584fb6ff7964327cb0b",
        "22e6f0ae826ef551edfaf025fbc523411ef62637",
    ),
    "M00-W08": (
        "tree e05dbf9bdf9c190e8cd6b022d9611d65805740b7",
        "9bb12322b993d233017d53bfa14f853c5fc86e34",
    ),
    "M00-W09": (
        "tree ae69a908cc31e0f1282c136c25fb7f92752680dd",
        "0e27802802b2397169c74d0f0c563506980041b0",
    ),
    "M00-W10": (
        "tree 30c575dcc142a8276f0aed754cac50ed1fc3ab75",
        "ef830d91e7a6bffe3c74825b98405ce379cc7187",
    ),
    "M01-W01": (
        "tree 20c25e66d5792506870531aa4a8cd01971b362c9",
        "a77a01d52fb6be9cd535c6878b902146bf637632",
    ),
    "M01-W02": (
        "tree 8a081776719d02ee7aeceb99bfe731f5663883c4",
        "349fc7c16fee98d85ed547ade045baeb4f68afec",
    ),
    "M01-W03": (
        "tree 2a56ed518797e811f8a0506e7834401c50eda166",
        "c4ed1407083cf1e1d296a5763b1842322e9b90f7",
    ),
    "M01-W04": (
        "tree 9ec01d8f8a734c703a943ea08012a10df023bf67",
        "d0d0abd70fd5d82a294a9c9e8167d9702b8d0217",
    ),
    "M01-W05": (
        "tree 77fb23c61482ff87643db30f10ed27263254a7b2",
        "791a4735a2b43e7f98f5be7d6e0f64a7412fc8f5",
    ),
    "M01-W06": (
        "tree 6ed03405b8e252a583f6f89709722e1bd680d8de",
        "13231f34ac276695852eb54e375aacfd6d2d4029",
    ),
}
REQUIRED_M00_SEQUENCE = tuple(f"M00-W{number:02d}" for number in range(1, 12))
PRESERVED_M01_SEQUENCE = tuple(f"M01-W{number:02d}" for number in range(1, 7))

EXPLICIT_PACKAGE_PREREQUISITES = {
    "M00-W11": ["M00-W10", "M01-W06"],
    "M01-W07": ["M01-W06", "M00-W11"],
    "M27-W13": [f"M27-W{number:02d}" for number in range(1, 12)],
    "M27-W14": ["M27-W13"],
    "M27-W12": [
        *[f"M27-W{number:02d}" for number in range(1, 12)],
        "M27-W13",
        "M27-W14",
    ],
}

STAMP_PENDING = "stamp pending"
SPEC_HEADER_MARKER = "**Specification ID:** JAPP-MASTER-001"
CANONICAL_SPEC_REL = "docs/MASTER_IMPLEMENTATION_SPEC.md"
CANONICAL_RELEASE_GATE = "NOT_READY"
MIN_ROW_CELLS = 2
REVISION_ROW_CELLS = 3
FULL_EVIDENCE_ROW_CELLS = 4
PLATFORM_MATRIX_EVIDENCE_ROW_CELLS = 6
GATE_REPORT_CELL_INDEX = 5
MARKDOWN_METRIC_ROW_CELLS = 3
MISSING_PREVIEW_LIMIT = 8
CERTIFIED_PLATFORM_IDS = ("macos-arm64", "windows-x64", "ubuntu-x64")
APPROVED_EVIDENCE_FILES = {
    "docs/TEST_EVIDENCE.md",
    "docs/gates/HOLDOUT_EXECUTION_LOG.md",
}
APPROVED_EVIDENCE_PREFIXES = ("docs/gates/evidence/",)
PASS_HOLDOUT_TOKENS = {"pass", "passed", "valid", "met", "meets"}
UI_SURFACE_IDS = (
    "DESKTOP_SHELL",
    "HOME_DASHBOARD",
    "JOBS",
    "TRACKER",
    "DOCUMENTS_RESUMES",
    "PROFILE",
    "SETTINGS",
    "EXTENSION_DEFAULT",
    "EXTENSION_AUTOFILL",
    "EXTENSION_REVIEW_UNRESOLVED",
)
ANTI_BLOAT_RULE_IDS = tuple(f"AB-{number:02d}" for number in range(1, 13))
FAMILIARITY_ROW_CELLS = 8
VISUAL_BASELINE_ROW_CELLS = 13
ANTI_BLOAT_RULE_ROW_CELLS = 3
ANTI_BLOAT_SURFACE_ROW_CELLS = 7
PROVIDER_REGISTRY_ROW_CELLS = 9

MEMORY_FILES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("CLAUDE.md", ("Mandatory session bootstrap", CANONICAL_SPEC_REL)),
    (
        CANONICAL_SPEC_REL,
        (
            "JAPP-MASTER-001",
            "**Version:** 1.4",
            "## 12. Required project-status format",
        ),
    ),
    ("docs/PROJECT_STATUS.md", ("# Project Status",)),
    ("docs/DECISIONS.md", ("# Decisions", "## Owner decisions", "## ADR template")),
    ("docs/TEST_EVIDENCE.md", ("# Test Evidence", "## Entry template")),
    ("docs/KNOWN_ISSUES.md", ("# Known Issues", "## Entry template")),
    ("docs/COMPATIBILITY_MATRIX.md", ("# Compatibility Matrix",)),
    (
        "docs/UI_FAMILIARITY.md",
        (
            "# UI Familiarity Governance",
            "## Familiarity matrix",
            "NOT_YET_APPLICABLE",
            "Originality and non-affiliation",
        ),
    ),
    (
        "docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md",
        (
            "# Owner-Approved Visual Baseline",
            "## Surface ledger",
            "NOT_APPROVED",
        ),
    ),
    (
        "docs/ui/ANTI_BLOAT_CHECKLIST.md",
        ("# Anti-Bloat Checklist", "## Mandatory rules", "NOT_EVALUATED"),
    ),
    (
        "docs/EXPERIMENTAL_AI_PROVIDERS.md",
        (
            "# Experimental AI Providers",
            "OLLAMA_LOCAL",
            "CHATGPT_ACCOUNT_OAUTH",
            "DISABLED_BY_DEFAULT",
        ),
    ),
    (
        "docs/PLATFORM_SUPPORT.md",
        ("# Platform Support", "CERTIFIED_FULL", "First-release target contract"),
    ),
    ("docs/REQUIREMENTS_TRACEABILITY.md", ("# Requirements Traceability",)),
    (
        "docs/traceability.json",
        ('"schema_version": 3', '"requirements": [', '"work_packages": ['),
    ),
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
    (
        "docs/gates/CROSS_PLATFORM_CORE_GATE.md",
        ("CROSS_PLATFORM_CORE", "Evidence bundle"),
    ),
    ("docs/gates/HOLDOUT_EXECUTION_LOG.md", ("# Holdout Execution Log",)),
    (
        "docs/platform/CERTIFIED_MATRIX.md",
        ("# Certified Platform Matrix", "windows-x64", "ubuntu-x64"),
    ),
    (
        "docs/platform/MODEL_RUNTIME_PROFILES.md",
        ("# Model Runtime Profiles", "Full-AI profile acceptance", "M27-W10"),
    ),
    (
        "docs/platform/NATIVE_MESSAGING_MATRIX.md",
        ("# Native Messaging Matrix", "windows-x64", "Binary"),
    ),
    (
        "docs/platform/PACKAGING_UPDATE_MATRIX.md",
        ("# Packaging and Update Matrix", "Update contract", "Owning packages"),
    ),
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
REQ_DEFINITION_RE = re.compile(r"^- `(REQ-[A-Z]+-\d{3})`: .+$")
GATE_QUALIFIER_RE = re.compile(r"with\s+`([A-Z_]+)\s*=\s*PASS`")
ACCEPTED_QUALIFIER_RE = re.compile(r"\b(M\d{2}) accepted\b")
TREE_REVISION_RE = re.compile(r"^tree [0-9a-f]{40}(\s.*)?$")
EVIDENCE_HASH_RE = re.compile(r"^(?:sha256:)?[0-9a-f]{64}$")
URL_SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")
WINDOWS_ABSOLUTE_RE = re.compile(r"^[A-Za-z]:[\\/]")
MARKDOWN_LINK_RE = re.compile(r"^\[[^\]]+\]\(([^)]+)\)$")
MARKDOWN_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$", flags=re.MULTILINE)
KNOWN_ISSUE_HEADING_RE = re.compile(r"^### (KI-\d{4}) — (.+?)\s*$")
KNOWN_ISSUE_FIELD_RE = re.compile(r"^- (Severity|State|Affects):\s*(.*?)\s*$")
LIVE_BLOCKER_RE = re.compile(
    r"^- (KI-\d{4}) "
    r"\((CRITICAL|HIGH|MEDIUM|LOW), "
    r"(OPEN|IN_PROGRESS|FIXED|DEFERRED|WONT_FIX)\) — (\S.*)$"
)
ISSUE_SCOPE_RE = re.compile(r"\b(M\d{2}(?:-W\d{2})?)\b")
EVIDENCE_BUNDLE_LINE_RE = re.compile(
    r"^\s*(?:[-*]\s*)?Evidence bundle:\s*(.*?)\s*$",
    flags=re.MULTILINE | re.IGNORECASE,
)
EVIDENCE_PLACEHOLDERS = {
    "",
    "-",
    "—",
    "n/a",
    "na",
    "none",
    "not applicable",
    "not available",
    "not yet available",
    "pending",
    "pending evidence",
    "placeholder",
    "placeholder evidence",
    "placeholder text",
    "tbd",
    "todo",
}


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
    milestone_revisions: dict[str, str]
    package_rows: list[list[str]]
    gate_rows: list[list[str]]
    next_ready: str | None


@dataclass(frozen=True)
class KnownIssue:
    issue_id: str
    severity: str
    state: str
    affects: str
    scopes: frozenset[str]


@dataclass(frozen=True)
class LiveBlocker:
    issue_id: str
    severity: str
    state: str


@dataclass(frozen=True)
class GateDSupportTable:
    relative_path: str
    label: str
    state_index: int
    evidence_index: int
    required_state: str
    owners: dict[str, set[str]]


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


def parse_spec(  # noqa: PLR0912, PLR0915 - two scoped canonical ledgers
    spec_path: Path,
) -> Spec:
    text = spec_path.read_text(encoding="utf-8")
    milestones: dict[str, Milestone] = {}
    current: str | None = None
    in_milestone_map = False
    in_fence = False
    for raw in text.splitlines():
        if raw.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if raw.startswith("## 9. "):
            in_milestone_map = True
            current = None
            continue
        if in_milestone_map and raw.startswith("## 10. "):
            break
        if not in_milestone_map:
            continue
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
    in_catalog = False
    in_fence = False
    for raw in text.splitlines():
        if raw.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if raw.startswith("## 4. "):
            in_catalog = True
            continue
        if in_catalog and raw.startswith("## 5. "):
            break
        if not in_catalog:
            continue
        match = REQ_DEFINITION_RE.match(raw)
        if match:
            requirement_ids.append(match.group(1))
    return Spec(milestones=milestones, requirement_ids=requirement_ids)


def expected_package_prerequisites(spec: Spec) -> dict[str, list[str]]:
    """Return the reviewed v1.4 direct package prerequisite graph."""
    result: dict[str, list[str]] = {}
    inventory = set(spec.package_ids())
    for milestone in spec.milestones.values():
        ids = [package_id for package_id, _ in milestone.packages]
        for index, package_id in enumerate(ids):
            result[package_id] = [] if index == 0 else [ids[index - 1]]
    for package_id, prerequisites in EXPLICIT_PACKAGE_PREREQUISITES.items():
        if package_id in inventory:
            result[package_id] = list(prerequisites)
    return result


def expected_downstream_packages(spec: Spec) -> dict[str, list[str]]:
    """Reverse the reviewed prerequisite graph without inventing extra edges."""
    downstream: dict[str, list[str]] = {
        package_id: [] for package_id in spec.package_ids()
    }
    for package_id, prerequisites in expected_package_prerequisites(spec).items():
        for prerequisite in prerequisites:
            if prerequisite in downstream:
                downstream[prerequisite].append(package_id)
    order = {package_id: index for index, package_id in enumerate(spec.package_ids())}
    return {
        package_id: sorted(values, key=lambda value: order[value])
        for package_id, values in downstream.items()
    }


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
            if value == "NONE":
                return "NONE"
            match = re.fullmatch(r"`?(M\d{2}-W\d{2})`?", value)
            return match.group(1) if match else value
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
    milestone_revisions: dict[str, str] = {}
    for cells in _table_rows(sections.get("## Milestone table", [])):
        mid = cells[0].strip("`")
        if re.fullmatch(r"M\d{2}", mid) and len(cells) >= MIN_ROW_CELLS:
            milestone_rows.append((mid, cells[1]))
            milestone_revisions[mid] = (
                cells[2] if len(cells) >= REVISION_ROW_CELLS else ""
            )

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
        milestone_revisions=milestone_revisions,
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


def _id_table_rows(path: Path, valid_ids: tuple[str, ...]) -> dict[str, list[str]]:
    """Return unique Markdown table rows whose first cell is a requested ID."""
    rows: dict[str, list[str]] = {}
    for cells in _table_rows(path.read_text(encoding="utf-8").splitlines()):
        row_id = cells[0].strip("`")
        if row_id in valid_ids:
            if row_id in rows:
                rows[row_id] = []
            else:
                rows[row_id] = cells
    return rows


def check_v14_governance_memory(  # noqa: PLR0912, PLR0915 - four ledgers
    repo: Path, spec: Spec, report: Report
) -> None:
    """Fail closed on fabricated UI/provider state during M00-W11."""
    errors = 0
    package_ids = set(spec.package_ids())

    familiarity = repo / "docs/UI_FAMILIARITY.md"
    familiarity_rows = _id_table_rows(familiarity, UI_SURFACE_IDS)
    for surface_id in UI_SURFACE_IDS:
        cells = familiarity_rows.get(surface_id, [])
        if len(cells) != FAMILIARITY_ROW_CELLS:
            report.fail(
                f"UI familiarity surface {surface_id} must have one complete row"
            )
            errors += 1
            continue
        owners = PKG_ID_RE.findall(cells[2])
        if not owners or any(owner not in package_ids for owner in owners):
            report.fail(f"UI familiarity surface {surface_id} has invalid owners")
            errors += 1
        if cells[3] != "`NOT_YET_APPLICABLE`":
            report.fail(
                f"UI familiarity surface {surface_id} must remain "
                "NOT_YET_APPLICABLE during M00-W11"
            )
            errors += 1
        if cells[4:7] != ["—", "—", "—"] or cells[7] != "`NOT_APPROVED`":
            report.fail(
                f"UI familiarity surface {surface_id} invents reference, "
                "comparison, or owner-approval evidence"
            )
            errors += 1

    baseline = repo / "docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md"
    baseline_rows = _id_table_rows(baseline, UI_SURFACE_IDS)
    for surface_id in UI_SURFACE_IDS:
        cells = baseline_rows.get(surface_id, [])
        if len(cells) != VISUAL_BASELINE_ROW_CELLS:
            report.fail(
                f"visual baseline surface {surface_id} must have one complete row"
            )
            errors += 1
            continue
        owners = PKG_ID_RE.findall(cells[1])
        if not owners or any(owner not in package_ids for owner in owners):
            report.fail(f"visual baseline surface {surface_id} has invalid owners")
            errors += 1
        if cells[2] != "`NOT_YET_APPLICABLE`":
            report.fail(
                f"visual baseline surface {surface_id} must remain "
                "NOT_YET_APPLICABLE during M00-W11"
            )
            errors += 1
        if any(cells[index] != "—" for index in range(3, 10)):
            report.fail(
                f"visual baseline surface {surface_id} invents capture metadata"
            )
            errors += 1
        if cells[10] != "`NOT_APPROVED`":
            report.fail(f"visual baseline surface {surface_id} falsely claims approval")
            errors += 1

    anti_bloat = repo / "docs/ui/ANTI_BLOAT_CHECKLIST.md"
    rule_rows = _id_table_rows(anti_bloat, ANTI_BLOAT_RULE_IDS)
    for rule_id in ANTI_BLOAT_RULE_IDS:
        cells = rule_rows.get(rule_id, [])
        if len(cells) != ANTI_BLOAT_RULE_ROW_CELLS or cells[2] != "`NOT_EVALUATED`":
            report.fail(f"anti-bloat rule {rule_id} must have one NOT_EVALUATED row")
            errors += 1
    anti_surface_rows = _id_table_rows(anti_bloat, UI_SURFACE_IDS)
    for surface_id in UI_SURFACE_IDS:
        cells = anti_surface_rows.get(surface_id, [])
        if len(cells) != ANTI_BLOAT_SURFACE_ROW_CELLS or cells[2] != "`NOT_EVALUATED`":
            report.fail(f"anti-bloat surface {surface_id} must remain NOT_EVALUATED")
            errors += 1

    providers = repo / "docs/EXPERIMENTAL_AI_PROVIDERS.md"
    provider_ids = ("OLLAMA_LOCAL", "CHATGPT_ACCOUNT_OAUTH")
    provider_rows = _id_table_rows(providers, provider_ids)
    expected_provider_states = {
        "OLLAMA_LOCAL": (
            "`ENABLED_LOCAL_DEFAULT`",
            "`NOT_IMPLEMENTED`",
            "`NOT_EVALUATED`",
            "`REQUIRED_FUTURE_CORE`",
            "`REQUIRED_FUTURE_CORE`",
            "`LOCAL_CORE`",
        ),
        "CHATGPT_ACCOUNT_OAUTH": (
            "`DISABLED_BY_DEFAULT`",
            "`NOT_IMPLEMENTED`",
            "`NOT_EVALUATED`",
            "`NOT_EVALUATED`",
            "`NOT_SUPPORTED`",
            "`PROHIBITED`",
        ),
    }
    for provider_id, expected_states in expected_provider_states.items():
        cells = provider_rows.get(provider_id, [])
        if len(cells) != PROVIDER_REGISTRY_ROW_CELLS:
            report.fail(f"provider {provider_id} must have one complete registry row")
            errors += 1
            continue
        if tuple(cells[2:8]) != expected_states:
            report.fail(
                f"provider {provider_id} state drift: expected "
                f"{expected_states}, found {tuple(cells[2:8])}"
            )
            errors += 1
        owners = PKG_ID_RE.findall(cells[8])
        if not owners or any(owner not in package_ids for owner in owners):
            report.fail(f"provider {provider_id} has invalid owners")
            errors += 1
    provider_text = " ".join(providers.read_text(encoding="utf-8").split())
    required_provider_policy = (
        "There is no silent provider fallback.",
        "`DISABLED_BY_POLICY` is a valid final outcome",
        "must never be used as a production application credential source",
        "M27-W12` executes last",
    )
    for needle in required_provider_policy:
        if needle not in provider_text:
            report.fail(f"provider governance policy missing: {needle!r}")
            errors += 1

    if errors == 0:
        report.ok(
            "v1.4 UI/provider governance ledgers have exact owners and honest "
            "NOT_YET_APPLICABLE/NOT_EVALUATED states"
        )


def check_spec_inventory(spec: Spec, report: Report) -> None:
    milestone_count = len(spec.milestones)
    milestone_ids = list(spec.milestones)
    expected_milestone_ids = [f"M{number:02d}" for number in range(39)]
    package_ids = spec.package_ids()
    if milestone_count != EXPECTED_MILESTONES:
        report.fail(
            f"spec defines {milestone_count} milestones "
            f"(expected {EXPECTED_MILESTONES})"
        )
    if milestone_ids != expected_milestone_ids:
        report.fail(
            f"spec milestone order is {milestone_ids} "
            f"(expected {expected_milestone_ids})"
        )
    if len(package_ids) != EXPECTED_PACKAGES or len(set(package_ids)) != len(
        package_ids
    ):
        report.fail(
            f"spec defines {len(package_ids)} work packages, "
            f"{len(set(package_ids))} unique (expected {EXPECTED_PACKAGES} unique)"
        )
    unique_requirements = set(spec.requirement_ids)
    if (
        len(spec.requirement_ids) != EXPECTED_REQUIREMENTS
        or len(unique_requirements) != EXPECTED_REQUIREMENTS
    ):
        report.fail(
            f"spec defines {len(spec.requirement_ids)} requirement rows, "
            f"{len(unique_requirements)} unique IDs "
            f"(expected {EXPECTED_REQUIREMENTS} unique)"
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


def check_spec_contract(spec_path: Path, spec: Spec, report: Report) -> None:
    """Validate the exact owner-approved v1.4 adoption and governance floor."""
    content = spec_path.read_text(encoding="utf-8")
    digest = hashlib.sha256(spec_path.read_bytes()).hexdigest()
    if digest != EXPECTED_SPEC_SHA256:
        report.fail(
            f"canonical specification SHA-256 is {digest} "
            f"(expected {EXPECTED_SPEC_SHA256})"
        )
    m00 = spec.milestones.get("M00")
    sequence = tuple(pid for pid, _ in m00.packages) if m00 is not None else ()
    if sequence != REQUIRED_M00_SEQUENCE:
        report.fail(
            f"M00 package sequence is {sequence} "
            f"(expected uninterrupted {REQUIRED_M00_SEQUENCE})"
        )
    required_policy = (
        "**Implementation-agent policy:** Owner-selected per package.",
        (
            "must not automatically route work between agents, model families, "
            "or reasoning modes"
        ),
        "The local Ollama model remains the default AI path and release baseline.",
        "No silent fallback occurs.",
        (
            "mandatory execution order is `M27-W01` through `M27-W11`, then "
            "`M27-W13`, then `M27-W14`, and finally `M27-W12`"
        ),
        "After v1.4 adoption starts, M00 cannot return to `ACCEPTED`",
        "docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md",
        "docs/EXPERIMENTAL_AI_PROVIDERS.md",
    )
    for needle in required_policy:
        if needle not in content:
            report.fail(f"canonical v1.4 governance text missing: {needle!r}")
    if "Implementation sessions use Claude Fable 5 Max" in content:
        report.fail("obsolete hard-coded implementation-agent routing policy present")
    if (
        digest == EXPECTED_SPEC_SHA256
        and sequence == REQUIRED_M00_SEQUENCE
        and all(needle in content for needle in required_policy)
    ):
        report.ok(
            "canonical v1.4 hash, M00-W01…W11 table, owner-controlled agent "
            "policy, provider boundary, and explicit M27 terminal order verified"
        )


def check_status_shell(status: Status, report: Report) -> None:
    shell_errors = 0
    for field_name in HEADER_FIELDS:
        if not status.header.get(field_name):
            report.fail(f"PROJECT_STATUS header field missing/empty: '{field_name}'")
            shell_errors += 1
    release_gate = status.header.get("Overall release gate:", "")
    if release_gate and release_gate != CANONICAL_RELEASE_GATE:
        report.fail(
            "PROJECT_STATUS Overall release gate is "
            f"'{release_gate}' (canonical current value must be "
            f"{CANONICAL_RELEASE_GATE})"
        )
        shell_errors += 1
    for section in STATUS_SECTIONS:
        if section not in status.sections:
            report.fail(f"PROJECT_STATUS required section missing: '{section}'")
            shell_errors += 1
    if shell_errors == 0:
        report.ok(
            "PROJECT_STATUS header fields and sections present; release gate "
            f"is {CANONICAL_RELEASE_GATE}"
        )


def _known_issue_sections(path: Path, report: Report) -> list[tuple[str, list[str]]]:
    """Return numeric known-issue sections, ignoring fenced template text."""
    sections: list[tuple[str, list[str]]] = []
    current_id: str | None = None
    current_lines: list[str] = []
    fenced = False
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        report.fail(f"cannot read docs/KNOWN_ISSUES.md: {exc}")
        return sections
    for raw in lines:
        if raw.strip().startswith("```"):
            fenced = not fenced
            continue
        if fenced:
            continue
        heading = KNOWN_ISSUE_HEADING_RE.fullmatch(raw)
        if heading is not None:
            if current_id is not None:
                sections.append((current_id, current_lines))
            current_id = heading.group(1)
            current_lines = []
        elif current_id is not None:
            current_lines.append(raw)
    if fenced:
        report.fail("docs/KNOWN_ISSUES.md has an unclosed fenced block")
    if current_id is not None:
        sections.append((current_id, current_lines))
    return sections


def _issue_field_values(
    issue_id: str, lines: list[str], report: Report
) -> dict[str, str]:
    """Parse required issue fields, including wrapped Affects text."""
    values: dict[str, str] = {}
    index = 0
    while index < len(lines):
        match = KNOWN_ISSUE_FIELD_RE.fullmatch(lines[index])
        if match is None:
            index += 1
            continue
        name, value = match.groups()
        if name in values:
            report.fail(f"{issue_id} has duplicate {name} field")
        continuation: list[str] = []
        if name == "Affects":
            cursor = index + 1
            while cursor < len(lines):
                candidate = lines[cursor]
                if candidate.startswith(("- ", "### ")):
                    break
                if candidate.strip():
                    continuation.append(candidate.strip())
                cursor += 1
            index = cursor - 1
        values[name] = " ".join([value, *continuation]).strip()
        index += 1
    for required in ("Severity", "State", "Affects"):
        if not values.get(required):
            report.fail(f"{issue_id} must have exactly one nonempty {required} field")
    return values


def parse_known_issues(path: Path, report: Report) -> dict[str, KnownIssue]:
    """Parse the authoritative issue ledger and reject duplicate/invalid rows."""
    issues: dict[str, KnownIssue] = {}
    valid_severities = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
    valid_states = {"OPEN", "IN_PROGRESS", "FIXED", "DEFERRED", "WONT_FIX"}
    for issue_id, lines in _known_issue_sections(path, report):
        if issue_id in issues:
            report.fail(f"docs/KNOWN_ISSUES.md has duplicate issue ID {issue_id}")
            continue
        fields = _issue_field_values(issue_id, lines, report)
        severity = fields.get("Severity", "")
        state = fields.get("State", "")
        affects = fields.get("Affects", "")
        if severity not in valid_severities:
            report.fail(f"{issue_id} has invalid severity {severity!r}")
        if state not in valid_states:
            report.fail(f"{issue_id} has invalid state {state!r}")
        issues[issue_id] = KnownIssue(
            issue_id=issue_id,
            severity=severity,
            state=state,
            affects=affects,
            scopes=frozenset(ISSUE_SCOPE_RE.findall(affects)),
        )
    if not issues:
        report.fail("docs/KNOWN_ISSUES.md contains no numeric issue entries")
    return issues


def parse_live_blockers(lines: list[str], report: Report) -> dict[str, LiveBlocker]:
    """Parse the machine-only live blocker section."""
    blockers: dict[str, LiveBlocker] = {}
    saw_none = False
    saw_content = False
    for raw in lines:
        stripped = raw.strip()
        if not stripped:
            continue
        saw_content = True
        if stripped == "- NONE":
            if saw_none:
                report.fail("PROJECT_STATUS live blocker section repeats '- NONE'")
            saw_none = True
            continue
        match = LIVE_BLOCKER_RE.fullmatch(stripped)
        if match is None:
            report.fail(
                "PROJECT_STATUS live blocker line must use "
                "'- KI-#### (SEVERITY, STATE) — summary' or '- NONE': "
                f"{stripped!r}"
            )
            continue
        issue_id, severity, state, _summary = match.groups()
        if issue_id in blockers:
            report.fail(f"PROJECT_STATUS live blocker section repeats {issue_id}")
            continue
        blockers[issue_id] = LiveBlocker(issue_id, severity, state)
    if not saw_content:
        report.fail("PROJECT_STATUS live blocker section must not be empty")
    if saw_none and blockers:
        report.fail("PROJECT_STATUS live blocker section mixes '- NONE' with issues")
    return blockers


def _check_blocking_issue_scope(
    issue: KnownIssue, milestone_states: dict[str, str], report: Report
) -> None:
    if not issue.scopes:
        report.fail(
            f"{issue.issue_id} is blocking but its Affects field has no milestone "
            "or work-package scope"
        )
    affected_milestones = {
        scope[:3] if "-W" in scope else scope for scope in issue.scopes
    }
    for milestone_id in sorted(affected_milestones):
        if milestone_states.get(milestone_id) == "ACCEPTED":
            report.fail(
                f"{issue.issue_id} blocks affected milestone {milestone_id}, "
                "which cannot remain ACCEPTED"
            )


def _check_blocked_readiness(
    status: Status, package_states: dict[str, str], report: Report
) -> None:
    ready = sorted(
        package_id for package_id, state in package_states.items() if state == "READY"
    )
    if ready:
        report.fail(
            f"live CRITICAL/HIGH blockers require zero READY packages (found {ready})"
        )
    if status.next_ready != "NONE":
        report.fail("live CRITICAL/HIGH blockers require Next READY package ID NONE")


def check_live_blockers(
    repo: Path,
    status: Status,
    milestone_states: dict[str, str],
    package_states: dict[str, str],
    report: Report,
) -> None:
    """Reconcile the live blocker view with the authoritative issue ledger."""
    issues = parse_known_issues(repo / "docs/KNOWN_ISSUES.md", report)
    blockers = parse_live_blockers(
        status.sections.get("## Known release blockers", []), report
    )
    expected = {
        issue_id: issue
        for issue_id, issue in issues.items()
        if issue.severity in {"CRITICAL", "HIGH"}
        and issue.state in {"OPEN", "IN_PROGRESS"}
    }
    expected_ids = set(expected)
    actual_ids = set(blockers)
    for issue_id in sorted(expected_ids - actual_ids):
        report.fail(
            f"{issue_id} is {expected[issue_id].severity}/{expected[issue_id].state} "
            "but is missing from PROJECT_STATUS live blockers"
        )
    for issue_id in sorted(actual_ids - expected_ids):
        issue = issues.get(issue_id)
        if issue is None:
            report.fail(f"PROJECT_STATUS live blocker {issue_id} is unknown")
        else:
            report.fail(
                f"PROJECT_STATUS live blocker {issue_id} resolves to "
                f"{issue.severity}/{issue.state}, which is not blocking"
            )
    for issue_id in sorted(expected_ids):
        _check_blocking_issue_scope(expected[issue_id], milestone_states, report)
    for issue_id in sorted(expected_ids & actual_ids):
        issue = expected[issue_id]
        blocker = blockers[issue_id]
        if blocker.severity != issue.severity or blocker.state != issue.state:
            report.fail(
                f"PROJECT_STATUS live blocker {issue_id} says "
                f"{blocker.severity}/{blocker.state}; KNOWN_ISSUES says "
                f"{issue.severity}/{issue.state}"
            )
    if expected:
        _check_blocked_readiness(status, package_states, report)
    if not report.errors:
        report.ok(
            "KNOWN_ISSUES and PROJECT_STATUS live blockers agree with "
            "milestone acceptance and readiness"
        )


GATE_SECTION_HEADING_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")
LEDGER_STATE_LINE_RE = re.compile(r"^- State: ([A-Z_]+)\s*$", flags=re.MULTILINE)


def _is_evidence_placeholder(value: str) -> bool:
    normalized = re.sub(r"[\s_]+", " ", value.strip().casefold())
    return normalized in EVIDENCE_PLACEHOLDERS


def _heading_text(value: str) -> str:
    """Normalize lightweight Markdown used inside a heading/reference."""
    value = re.sub(r"[`*_]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def _heading_slug(value: str) -> str:
    """Return a conservative GitHub-style fragment for Markdown headings."""
    value = _heading_text(value).casefold()
    value = re.sub(r"[^\w\s-]", "", value)
    return re.sub(r"-+", "-", re.sub(r"\s+", "-", value)).strip("-")


def _split_evidence_heading(
    raw: str,
) -> tuple[str, str | None, bool, str | None]:
    heading: str | None = None
    fragment_syntax = False
    error: str | None = None
    if "§" in raw:
        if raw.count("§") != 1:
            error = "has ambiguous section syntax"
        else:
            raw, heading = (part.strip() for part in raw.split("§", 1))
    elif "#" in raw:
        if raw.count("#") != 1:
            error = "has ambiguous heading syntax"
        else:
            raw, heading = (part.strip() for part in raw.split("#", 1))
            fragment_syntax = True
    return raw, heading, fragment_syntax, error


def _resolve_evidence_file(
    repo: Path, path_text: str
) -> tuple[Path | None, str | None]:
    path_text = path_text.strip().strip("`")
    portable_path = path_text.replace("\\", "/")
    parts = PurePosixPath(portable_path).parts
    candidate: Path | None = None
    error: str | None = None
    if _is_evidence_placeholder(path_text):
        error = "has no repository-relative file"
    elif URL_SCHEME_RE.match(path_text) or path_text.startswith("//"):
        error = "must not be a URL"
    elif (
        Path(path_text).is_absolute()
        or PurePosixPath(portable_path).is_absolute()
        or WINDOWS_ABSOLUTE_RE.match(path_text)
        or path_text.startswith("\\")
    ):
        error = "must be repository-relative, not absolute"
    elif ".." in parts:
        error = "must not contain path traversal"
    elif not parts or parts == (".",):
        error = "has no repository-relative file"
    else:
        repo_root = repo.resolve()
        candidate = (repo_root / portable_path).resolve()
        try:
            candidate.relative_to(repo_root)
        except ValueError:
            error = "resolves outside the repository"
        else:
            if not candidate.is_file():
                error = f"does not resolve to an existing file: {portable_path}"
            else:
                resolved_relative = candidate.relative_to(repo_root).as_posix()
                if (
                    resolved_relative not in APPROVED_EVIDENCE_FILES
                    and not resolved_relative.startswith(APPROVED_EVIDENCE_PREFIXES)
                ):
                    error = (
                        "is not an approved repository evidence record/file "
                        f"(resolved to {resolved_relative})"
                    )
    return candidate, error


def _evidence_heading_error(
    candidate: Path, heading: str, fragment_syntax: bool
) -> str | None:
    requested = _heading_text(heading.strip().strip("`"))
    error: str | None = None
    if _is_evidence_placeholder(requested):
        error = "has a missing or placeholder heading"
    else:
        headings = [
            _heading_text(match)
            for match in MARKDOWN_HEADING_RE.findall(
                candidate.read_text(encoding="utf-8", errors="replace")
            )
        ]
        if fragment_syntax:
            requested_slug = requested.casefold().lstrip("#")
            found = any(_heading_slug(actual) == requested_slug for actual in headings)
        else:
            requested_folded = requested.casefold()
            found = any(
                actual.casefold() == requested_folded
                or (
                    actual.casefold().startswith(requested_folded)
                    and actual[len(requested) : len(requested) + 1]
                    in {" ", ":", "-", "–", "—", "("}
                )
                for actual in headings
            )
        if not found:
            error = f"references a Markdown heading that does not exist: {requested!r}"
    return error


def _evidence_reference_error(repo: Path, reference: str) -> str | None:
    """Return why an evidence reference is unsafe/unresolved, or ``None``.

    Evidence fields are repository records, not arbitrary prose or remote
    links. A reference is either a repository-relative file or a file plus a
    Markdown heading expressed as ``path § Heading`` or ``path#heading-slug``.
    Resolution rejects path traversal and symlink escapes before checking that
    the target is a real file. When heading syntax is used, the heading must
    exist in that file.
    """
    raw = reference.strip()
    link = MARKDOWN_LINK_RE.fullmatch(raw)
    if link:
        raw = link.group(1).strip()
    if _is_evidence_placeholder(raw):
        return "is a placeholder"
    path_text, heading, fragment_syntax, syntax_error = _split_evidence_heading(raw)
    if syntax_error:
        return syntax_error
    candidate, path_error = _resolve_evidence_file(repo, path_text)
    if path_error:
        return path_error
    if heading is None:
        return None
    if candidate is None:
        return "does not resolve to an existing file"
    return _evidence_heading_error(candidate, heading, fragment_syntax)


def _gate_d_reference_scope_error(
    reference: str, allowed_test_evidence_packages: set[str]
) -> str | None:
    """Reject real-but-irrelevant files as Gate D evidence.

    Dedicated Gate D artifacts may live under ``docs/gates/evidence/``.
    Shared ledgers must use a Gate-D-specific heading, and TEST_EVIDENCE
    references must name one of the packages that owns the corresponding
    native/profile/decision evidence.
    """
    raw = reference.strip()
    link = MARKDOWN_LINK_RE.fullmatch(raw)
    if link:
        raw = link.group(1).strip()
    path_text, heading, _, syntax_error = _split_evidence_heading(raw)
    if syntax_error:
        return syntax_error
    portable_path = path_text.strip().strip("`").replace("\\", "/")
    if portable_path.startswith("docs/gates/evidence/"):
        return None
    normalized_heading = _heading_text((heading or "").strip().strip("`"))

    def is_package_heading(package_id: str) -> bool:
        if not normalized_heading.startswith(package_id):
            return False
        suffix = normalized_heading[len(package_id) : len(package_id) + 1]
        return not suffix or suffix in {" ", ":", "-", "–", "—", "("}

    if portable_path == "docs/TEST_EVIDENCE.md" and any(
        is_package_heading(package_id) for package_id in allowed_test_evidence_packages
    ):
        return None
    if portable_path == "docs/gates/HOLDOUT_EXECUTION_LOG.md" and (
        "CROSS_PLATFORM_CORE" in normalized_heading or "Gate D" in normalized_heading
    ):
        return None
    return (
        "is not scoped to the required Gate D evidence owner; use a dedicated "
        "docs/gates/evidence/ artifact or an approved Gate D package heading"
    )


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


def _platform_rows(text: str, platform: str) -> list[list[str]]:
    return [
        [cell.strip().strip("`") for cell in line.strip("|").split("|")]
        for line in text.splitlines()
        if line.startswith(f"| `{platform}` |")
    ]


def _gate_d_profile_evidence_problems(repo: Path) -> list[str]:
    problems: list[str] = []
    profiles_path = repo / "docs/platform/MODEL_RUNTIME_PROFILES.md"
    profiles_text = (
        profiles_path.read_text(encoding="utf-8") if profiles_path.is_file() else ""
    )
    for platform in CERTIFIED_PLATFORM_IDS:
        profile_rows = _platform_rows(profiles_text, platform)
        if len(profile_rows) != 1:
            problems.append(
                f"{platform} must have exactly one model-profile row "
                f"(found {len(profile_rows)})"
            )
            continue
        profile_cells = profile_rows[0]
        if len(profile_cells) < FULL_EVIDENCE_ROW_CELLS or (
            profile_cells[1] != "CERTIFIED_FULL" or profile_cells[2] != "ACCEPTED"
        ):
            problems.append(
                f"{platform} lacks CERTIFIED_FULL/ACCEPTED full-AI evidence"
            )
        else:
            evidence_error = _evidence_reference_error(repo, profile_cells[3])
            scope_error = (
                None
                if evidence_error
                else _gate_d_reference_scope_error(profile_cells[3], {"M27-W10"})
            )
            if evidence_error or scope_error:
                problems.append(
                    f"{platform} profile evidence reference "
                    f"{evidence_error or scope_error}"
                )
    return problems


def _gate_d_matrix_evidence_problems(repo: Path) -> list[str]:
    problems: list[str] = []
    matrix_path = repo / "docs/platform/CERTIFIED_MATRIX.md"
    matrix_text = (
        matrix_path.read_text(encoding="utf-8") if matrix_path.is_file() else ""
    )
    for platform in CERTIFIED_PLATFORM_IDS:
        matrix_rows = _platform_rows(matrix_text, platform)
        if len(matrix_rows) != 1:
            problems.append(
                f"{platform} must have exactly one certified-platform matrix row "
                f"(found {len(matrix_rows)})"
            )
            continue
        matrix_cells = matrix_rows[0]
        if len(matrix_cells) < PLATFORM_MATRIX_EVIDENCE_ROW_CELLS:
            problems.append(
                f"{platform} certified-platform matrix row/evidence is missing"
            )
        elif matrix_cells[4] != "CERTIFIED_FULL":
            problems.append(
                f"{platform} certified-platform current product state is "
                f"{matrix_cells[4]!r}, not CERTIFIED_FULL"
            )
        else:
            native_owners = {
                "macos-arm64": {"M27-W07", "M27-W10", "M27-W12"},
                "windows-x64": {"M27-W08", "M27-W10", "M27-W12"},
                "ubuntu-x64": {"M27-W09", "M27-W10", "M27-W12"},
            }[platform]
            evidence_error = _evidence_reference_error(repo, matrix_cells[5])
            scope_error = (
                None
                if evidence_error
                else _gate_d_reference_scope_error(matrix_cells[5], native_owners)
            )
            if evidence_error or scope_error:
                problems.append(
                    f"{platform} platform-matrix evidence reference "
                    f"{evidence_error or scope_error}"
                )
    return problems


def _gate_d_support_table_problems(
    repo: Path,
    contract: GateDSupportTable,
) -> list[str]:
    problems: list[str] = []
    path = repo / contract.relative_path
    text = path.read_text(encoding="utf-8") if path.is_file() else ""
    for platform in CERTIFIED_PLATFORM_IDS:
        rows = _platform_rows(text, platform)
        if len(rows) != 1:
            problems.append(
                f"{platform} must have exactly one {contract.label} row "
                f"(found {len(rows)})"
            )
            continue
        cells = rows[0]
        if len(cells) <= max(contract.state_index, contract.evidence_index):
            problems.append(f"{platform} {contract.label} state/evidence is missing")
            continue
        if cells[contract.state_index] != contract.required_state:
            problems.append(
                f"{platform} {contract.label} state is "
                f"{cells[contract.state_index]!r}, not "
                f"{contract.required_state}"
            )
            continue
        evidence = cells[contract.evidence_index]
        evidence_error = _evidence_reference_error(repo, evidence)
        scope_error = (
            None
            if evidence_error
            else _gate_d_reference_scope_error(evidence, contract.owners[platform])
        )
        if evidence_error or scope_error:
            problems.append(
                f"{platform} {contract.label} evidence reference "
                f"{evidence_error or scope_error}"
            )
    return problems


def _gate_d_evidence_problems(repo: Path, report_text: str) -> list[str]:
    problems: list[str] = []
    evidence_bundles = EVIDENCE_BUNDLE_LINE_RE.findall(report_text)
    if not evidence_bundles:
        problems.append("gate report records no Evidence bundle")
    else:
        bundle_error = _evidence_reference_error(repo, evidence_bundles[-1])
        scope_error = (
            None
            if bundle_error
            else _gate_d_reference_scope_error(evidence_bundles[-1], {"M27-W12"})
        )
        if bundle_error or scope_error:
            problems.append(
                f"gate report Evidence bundle reference {bundle_error or scope_error}"
            )
    problems.extend(_gate_d_profile_evidence_problems(repo))
    problems.extend(_gate_d_matrix_evidence_problems(repo))
    native_release_owners = {
        "macos-arm64": {"M27-W07", "M27-W10", "M27-W12"},
        "windows-x64": {"M27-W08", "M27-W10", "M27-W12"},
        "ubuntu-x64": {"M27-W09", "M27-W10", "M27-W12"},
    }
    problems.extend(
        _gate_d_support_table_problems(
            repo,
            GateDSupportTable(
                relative_path="docs/PLATFORM_SUPPORT.md",
                label="platform-support",
                state_index=5,
                evidence_index=6,
                required_state="CERTIFIED_FULL",
                owners=native_release_owners,
            ),
        )
    )
    native_messaging_owners = {
        "macos-arm64": {"M17-W07", "M17-W10", "M27-W12"},
        "windows-x64": {"M17-W08", "M17-W10", "M27-W12"},
        "ubuntu-x64": {"M17-W09", "M17-W10", "M27-W12"},
    }
    problems.extend(
        _gate_d_support_table_problems(
            repo,
            GateDSupportTable(
                relative_path="docs/platform/NATIVE_MESSAGING_MATRIX.md",
                label="native-messaging",
                state_index=3,
                evidence_index=4,
                required_state="VERIFIED",
                owners=native_messaging_owners,
            ),
        )
    )
    packaging_owners = {
        "macos-arm64": {"M27-W07", "M27-W11", "M27-W12"},
        "windows-x64": {"M27-W08", "M27-W11", "M27-W12"},
        "ubuntu-x64": {"M27-W09", "M27-W11", "M27-W12"},
    }
    problems.extend(
        _gate_d_support_table_problems(
            repo,
            GateDSupportTable(
                relative_path="docs/platform/PACKAGING_UPDATE_MATRIX.md",
                label="packaging/update",
                state_index=4,
                evidence_index=5,
                required_state="VERIFIED",
                owners=packaging_owners,
            ),
        )
    )
    return problems


def _gate_d_metric_problems(ledger_text: str) -> list[str]:
    problems: list[str] = []
    marker = "### Metric table"
    if marker not in ledger_text:
        return ["critical-gate ledger has no Gate D metric table"]
    table_text = ledger_text.split(marker, 1)[1].split(
        "- Zero-tolerance failures observed:", 1
    )[0]
    measured: list[str] = []
    for line in table_text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if (
            len(cells) < MARKDOWN_METRIC_ROW_CELLS
            or cells[0] == "Dimension"
            or set(cells[0])
            <= {
                "-",
                ":",
            }
        ):
            continue
        measured.append(cells[-1])
    placeholders = [
        value
        for value in measured
        if _is_evidence_placeholder(value)
        or value.casefold().startswith(("pending", "not evaluated"))
    ]
    if not measured:
        problems.append("critical-gate ledger has no Gate D measured rows")
    elif placeholders:
        problems.append(
            "critical-gate ledger has placeholder Gate D measured results "
            f"({len(placeholders)} row(s))"
        )
    zero_tolerance = _last_gate_field(
        ledger_text, ("Zero-tolerance failures observed",)
    )
    normalized = (zero_tolerance or "").strip().casefold()
    if not normalized.startswith(("0", "none")):
        problems.append(
            "critical-gate ledger does not record zero Gate D zero-tolerance failures"
        )
    return problems


def _gate_section_text(path: Path, gate: str) -> str:
    if not path.is_file():
        return ""
    for part in path.read_text(encoding="utf-8").split("\n## ")[1:]:
        lines = part.splitlines()
        if lines and lines[0].strip() == gate:
            return part
    return ""


def _last_gate_field(text: str, labels: tuple[str, ...]) -> str | None:
    alternatives = "|".join(re.escape(label) for label in labels)
    values = re.findall(
        rf"^\s*(?:[-*]\s*)?(?:{alternatives}):\s*(.*?)\s*$",
        text,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    return values[-1].strip().strip("`") if values else None


def _last_gate_state(text: str) -> str | None:
    values = re.findall(
        r"^\s*(?:[-*]\s*)?State:\s*([A-Z_]+)\b",
        text,
        flags=re.MULTILINE,
    )
    return values[-1] if values else None


def _gate_record_agreement_problems(
    label: str,
    text: str,
    revision: str,
    corpus_hash: str,
    reviewer: str,
) -> list[str]:
    problems: list[str] = []
    state = _last_gate_state(text)
    recorded_revision = _last_gate_field(text, ("Evaluated revision", "Git revision"))
    recorded_hash = _last_gate_field(
        text, ("Corpus/holdout hash", "Corpus/evidence hash")
    )
    recorded_reviewer = _last_gate_field(text, ("Independent reviewer",))
    owner_decision = _last_gate_field(text, ("Owner decision",))
    holdout = _last_gate_field(text, ("Holdout result",))
    if state != "PASS":
        problems.append(f"{label} state is {state!r}, not PASS")
    if recorded_revision != revision:
        problems.append(
            f"{label} evaluated revision {recorded_revision!r} disagrees with "
            f"PROJECT_STATUS {revision!r}"
        )
    if recorded_hash != corpus_hash:
        problems.append(
            f"{label} corpus/evidence hash {recorded_hash!r} disagrees with "
            f"PROJECT_STATUS {corpus_hash!r}"
        )
    if recorded_reviewer != reviewer:
        problems.append(
            f"{label} independent reviewer {recorded_reviewer!r} disagrees with "
            f"PROJECT_STATUS {reviewer!r}"
        )
    if owner_decision is None or owner_decision.split()[0].upper() != "PASS":
        problems.append(f"{label} owner decision is not PASS")
    holdout_token = holdout.split()[0].casefold() if holdout else ""
    if holdout_token not in PASS_HOLDOUT_TOKENS:
        problems.append(f"{label} holdout result is not a passing result")
    return problems


def _check_gate_pass_evidence(
    repo: Path,
    gate: str,
    cells: list[str],
    status: Status,
    report: Report,
) -> None:
    padded = [*cells, "", "", "", "", ""][:6]
    _, _, revision, corpus_hash, reviewer, _ = padded
    problems: list[str] = []
    if not TREE_REVISION_RE.fullmatch(revision):
        problems.append("evaluated revision is not a canonical tree revision")
    if not EVIDENCE_HASH_RE.fullmatch(corpus_hash):
        problems.append("corpus/holdout hash is not a complete SHA-256")
    if _is_evidence_placeholder(reviewer):
        problems.append("independent reviewer is empty")
    report_path = repo / GATE_REPORTS[gate]
    report_text = (
        report_path.read_text(encoding="utf-8") if report_path.is_file() else ""
    )
    ledger_text = _gate_section_text(repo / "docs/CRITICAL_GATES.md", gate)
    if TREE_REVISION_RE.fullmatch(revision) and EVIDENCE_HASH_RE.fullmatch(corpus_hash):
        problems.extend(
            _gate_record_agreement_problems(
                "gate report", report_text, revision, corpus_hash, reviewer
            )
        )
        problems.extend(
            _gate_record_agreement_problems(
                "critical-gate ledger", ledger_text, revision, corpus_hash, reviewer
            )
        )
    if gate == "CROSS_PLATFORM_CORE":
        package_states = {
            row[0]: row[1] for row in status.package_rows if len(row) >= MIN_ROW_CELLS
        }
        if package_states.get("M27-W12") not in STARTED:
            problems.append(
                "M27-W12 is not started or verified as the independent Gate D "
                "decision owner"
            )
        problems.extend(_gate_d_evidence_problems(repo, report_text))
        problems.extend(_gate_d_metric_problems(ledger_text))
    for problem in problems:
        report.fail(f"{gate} is PASS but {problem} (PASS prerequisites, spec §12)")


def check_gates(  # noqa: PLR0912 - gate states are intentionally fail-closed
    repo: Path, status: Status, report: Report
) -> dict[str, str]:
    gate_states: dict[str, str] = {}
    gate_errors = 0
    package_states = {
        row[0]: row[1] for row in status.package_rows if len(row) >= MIN_ROW_CELLS
    }
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
        expected_report = GATE_REPORTS[gate]
        recorded_report = (
            cells[GATE_REPORT_CELL_INDEX] if len(cells) > GATE_REPORT_CELL_INDEX else ""
        )
        if recorded_report != expected_report:
            report.fail(
                f"{gate} report cell is {recorded_report!r}; expected "
                f"{expected_report!r}"
            )
            gate_errors += 1
        report_path = repo / expected_report
        report_text = (
            report_path.read_text(encoding="utf-8") if report_path.is_file() else ""
        )
        report_state = _last_gate_state(report_text)
        if report_state != state:
            report.fail(
                f"gate {gate} state mismatch: PROJECT_STATUS says {state}, "
                f"{expected_report} says {report_state!r}"
            )
            gate_errors += 1
        if state == "IN_PROGRESS":
            evaluation_package = GATE_EVALUATION_PACKAGES[gate]
            if package_states.get(evaluation_package) not in STARTED:
                report.fail(
                    f"{gate} is IN_PROGRESS before evaluation package "
                    f"{evaluation_package} is started"
                )
                gate_errors += 1
        elif state in {"PASS", "REDESIGN_REQUIRED", "BLOCKED"}:
            decision_package = GATE_DECISION_PACKAGES[gate]
            if package_states.get(decision_package) not in STARTED:
                report.fail(
                    f"{gate} is {state} before decision package "
                    f"{decision_package} is started"
                )
                gate_errors += 1
        if state == "PASS":
            before = len(report.errors)
            _check_gate_pass_evidence(repo, gate, cells, status, report)
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
            "critical-gates table valid (4 gates, valid states, reports "
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
    ready = sorted(pid for pid, state in pkg_states.items() if state == "READY")
    if next_ready is None:
        report.fail("'## Next READY package' section has no '- ID:' line")
    elif next_ready != "NONE":
        if not ready:
            report.fail(
                f"Next READY package is {next_ready} but no work-package row is READY"
            )
        elif pkg_states.get(next_ready) != "READY":
            report.fail(
                f"Next READY package is {next_ready} but its table state is "
                f"'{pkg_states.get(next_ready)}'"
            )
        else:
            report.ok(f"next READY package {next_ready} is READY in the table")
    elif ready:
        report.fail(f"Next READY package is NONE but READY row(s) exist: {ready}")
    else:
        report.ok("next READY package: NONE (no READY rows)")


def check_progress_consistency(  # noqa: PLR0912 - explicit state agreement
    status: Status, pkg_states: dict[str, str], report: Report
) -> None:
    in_progress = [pid for pid, state in pkg_states.items() if state == "IN_PROGRESS"]
    ready = [pid for pid, state in pkg_states.items() if state == "READY"]
    if len(in_progress) > 1:
        report.fail(f"more than one work package IN_PROGRESS: {sorted(in_progress)}")
    else:
        report.ok(f"IN_PROGRESS count ok ({len(in_progress)})")
    if len(ready) > 1:
        report.fail(f"more than one work package READY: {sorted(ready)}")
    elif in_progress and ready:
        report.fail(
            f"READY package(s) {sorted(ready)} present while "
            f"{sorted(in_progress)} is IN_PROGRESS"
        )
    else:
        report.ok(f"READY count/coexistence ok ({len(ready)})")

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
        normalized_current = current.strip()
        if normalized_current == "NONE":
            report.ok("'Current work package' is NONE with no IN_PROGRESS package")
        elif (
            current_id is not None
            and normalized_current == current_id
            and pkg_states.get(current_id) == "BLOCKED"
        ):
            report.ok("'Current work package' names the exact BLOCKED package")
        else:
            report.fail(
                f"'Current work package' is '{current}' but no package is "
                "IN_PROGRESS (must be NONE or a BLOCKED package)"
            )

    _check_next_ready(status.next_ready, pkg_states, report)
    expected_milestone: str | None = None
    if len(in_progress) == 1:
        expected_milestone = in_progress[0][:3]
    elif (
        current_id is not None
        and current.strip() == current_id
        and pkg_states.get(current_id) == "BLOCKED"
    ):
        expected_milestone = current_id[:3]
    elif status.next_ready not in {None, "NONE"} and re.fullmatch(
        r"M\d{2}-W\d{2}", status.next_ready
    ):
        expected_milestone = status.next_ready[:3]
    if (
        expected_milestone is not None
        and status.header.get("Current milestone:") != expected_milestone
    ):
        report.fail(
            "PROJECT_STATUS Current milestone is "
            f"{status.header.get('Current milestone:')!r}; expected "
            f"{expected_milestone!r} from current/next work"
        )
    elif expected_milestone is not None:
        report.ok(f"Current milestone matches {expected_milestone}")


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
    spec: Spec,
    ms_states: dict[str, str],
    pkg_states: dict[str, str],
    report: Report,
) -> int:
    errors = 0
    direct_graph = expected_package_prerequisites(spec)
    migration_active = (
        ms_states.get("M00") == "IN_PROGRESS"
        and pkg_states.get("M00-W11") == "IN_PROGRESS"
    )
    for pid, state, milestone in _started_or_ready(spec, pkg_states):
        for dep in sorted(milestone.deps):
            if (
                migration_active
                and pid in PRESERVED_M01_SEQUENCE
                and state == "VERIFIED"
                and dep == "M00"
            ):
                continue
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
        for prerequisite in direct_graph.get(pid, []):
            if pkg_states.get(prerequisite) not in DONE:
                report.fail(
                    f"{pid} is {state} but direct package prerequisite "
                    f"{prerequisite} is '{pkg_states.get(prerequisite)}'"
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
    migration_active = (
        ms_states.get("M00") == "IN_PROGRESS"
        and pkg_states.get("M00-W11") == "IN_PROGRESS"
    )
    for pid, state, milestone in _started_or_ready(spec, pkg_states):
        mid = pid[:3]
        # Spec §1 completion rules make milestone acceptance, not merely a set
        # of individually verified packages, the cross-milestone readiness
        # boundary. Explicit/hard ACCEPTED qualifiers remain a checked subset.
        accepted_required = (
            set(milestone.deps)
            | set(milestone.accepted_deps)
            | set(HARD_ACCEPTED_DEPS.get(mid, ()))
        )
        for dep in sorted(accepted_required):
            if (
                migration_active
                and pid in PRESERVED_M01_SEQUENCE
                and state == "VERIFIED"
                and dep == "M00"
            ):
                continue
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
    errors = _check_dependency_order(spec, ms_states, pkg_states, report)
    errors += _check_readiness_prerequisites(
        spec, ms_states, pkg_states, gate_states, report
    )
    if errors == 0:
        report.ok(
            "dependency order respected (milestone deps, ACCEPTED prerequisites, "
            "critical gates, and reviewed explicit package graph)"
        )


def check_v14_readiness_contract(  # noqa: PLR0912, PLR0915 - explicit gates
    spec: Spec,
    ms_states: dict[str, str],
    pkg_states: dict[str, str],
    gate_states: dict[str, str],
    report: Report,
) -> None:
    """Enforce the v1.4 M00-W11/M01-W07 readiness boundaries."""
    errors = 0
    m00_exactly_verified = all(
        pkg_states.get(pid) == "VERIFIED" for pid in REQUIRED_M00_SEQUENCE
    )
    m00_accepted = ms_states.get("M00") == "ACCEPTED"
    if m00_accepted and not m00_exactly_verified:
        wrong = {
            pid: pkg_states.get(pid)
            for pid in REQUIRED_M00_SEQUENCE
            if pkg_states.get(pid) != "VERIFIED"
        }
        report.fail(
            "M00 cannot be ACCEPTED unless M00-W01 through M00-W11 are "
            f"exactly VERIFIED; nonconforming rows: {wrong}"
        )
        errors += 1
    if not (m00_accepted and m00_exactly_verified):
        evaluated = {
            gate: state
            for gate, state in gate_states.items()
            if state != "NOT_EVALUATED"
        }
        if evaluated:
            report.fail(
                "all four critical gates must remain NOT_EVALUATED while M00 "
                f"is unfinished; nonconforming gates: {evaluated}"
            )
            errors += 1

    migration_active = pkg_states.get("M00-W11") == "IN_PROGRESS"
    if migration_active:
        if ms_states.get("M00") != "IN_PROGRESS":
            report.fail("M00-W11 IN_PROGRESS requires milestone M00 IN_PROGRESS")
            errors += 1
        if ms_states.get("M01") != "IN_PROGRESS":
            report.fail("M00-W11 migration must preserve milestone M01 as IN_PROGRESS")
            errors += 1
        preserved_wrong = {
            package_id: pkg_states.get(package_id)
            for package_id in (
                *REQUIRED_M00_SEQUENCE[:-1],
                *PRESERVED_M01_SEQUENCE,
            )
            if pkg_states.get(package_id) != "VERIFIED"
        }
        if preserved_wrong:
            report.fail(
                "M00-W11 migration changed a completed M00/M01 package state: "
                f"{preserved_wrong}"
            )
            errors += 1
        if pkg_states.get("M01-W07") != "NOT_STARTED":
            report.fail("M01-W07 must be NOT_STARTED while M00-W11 is IN_PROGRESS")
            errors += 1

    m01_w07_state = pkg_states.get("M01-W07")
    if m00_accepted and m00_exactly_verified and m01_w07_state == "NOT_STARTED":
        report.fail(
            "completed M00-W11 closeout cannot leave M01-W07 NOT_STARTED; "
            "M01-W07 must become the sole READY package"
        )
        errors += 1
    if m01_w07_state in (STARTED | {"READY"}):
        if pkg_states.get("M00-W11") != "VERIFIED":
            report.fail(
                "M01-W07 cannot be READY or started before M00-W11 is exactly VERIFIED"
            )
            errors += 1
        if ms_states.get("M00") != "ACCEPTED":
            report.fail("M01-W07 cannot be READY or started before M00 is ACCEPTED")
            errors += 1
        if any(
            pkg_states.get(package_id) != "VERIFIED"
            for package_id in PRESERVED_M01_SEQUENCE
        ):
            report.fail(
                "M01-W07 cannot be READY or started unless M01-W01 through "
                "M01-W06 remain exactly VERIFIED"
            )
            errors += 1
    if m01_w07_state == "READY":
        ready = sorted(
            package_id for package_id, state in pkg_states.items() if state == "READY"
        )
        if ready != ["M01-W07"]:
            report.fail(
                "at the post-M00-W11 closeout boundary M01-W07 must be the only "
                f"READY package; found {ready}"
            )
            errors += 1
        if ms_states.get("M01") != "IN_PROGRESS":
            report.fail(
                "at the post-M00-W11 closeout boundary milestone M01 must "
                "remain IN_PROGRESS"
            )
            errors += 1
        evaluated = {
            gate: state
            for gate, state in gate_states.items()
            if state != "NOT_EVALUATED"
        }
        if evaluated:
            report.fail(
                "all four critical gates must remain NOT_EVALUATED at the "
                f"post-M00-W11 closeout boundary; nonconforming gates: {evaluated}"
            )
            errors += 1

    m06 = spec.milestones.get("M06")
    if m06 is None:
        report.fail("canonical specification is missing M06")
        errors += 1
    elif "CROSS_PLATFORM_CORE" in m06.gates:
        report.fail(
            "M06 must not depend on CROSS_PLATFORM_CORE or final Windows/Ubuntu "
            "full-AI certification"
        )
        errors += 1

    if errors == 0:
        report.ok(
            "v1.4 readiness contract valid (M00-W11 is the only migration "
            "work, M01-W07 waits for exact verification plus M00 acceptance, "
            "pre-closeout gates remain unevaluated, and M06 remains "
            "independent of Gate D)"
        )


def check_m28_gate_revision_binding(  # noqa: PLR0913, PLR0917 - state inputs
    status: Status,
    ms_states: dict[str, str],
    pkg_states: dict[str, str],
    gate_states: dict[str, str],
    repo: Path,
    report: Report,
) -> None:
    """Bind any M28 readiness claim to the final accepted M27 content tree."""
    m28_active = any(
        package_id.startswith("M28-") and state in (STARTED | {"READY"})
        for package_id, state in pkg_states.items()
    )
    if not m28_active:
        report.ok("M28/Gate-D final-revision binding is not yet applicable")
        return

    errors = 0
    if ms_states.get("M27") != "ACCEPTED":
        report.fail("M28 cannot be READY or started before M27 is ACCEPTED")
        errors += 1
    if gate_states.get("CROSS_PLATFORM_CORE") != "PASS":
        report.fail("M28 cannot be READY or started before Gate D is PASS")
        errors += 1

    package_rows = {cells[0]: cells for cells in status.package_rows}
    m27_w12 = package_rows.get("M27-W12", [])
    w12_revision = m27_w12[2] if len(m27_w12) >= REVISION_ROW_CELLS else ""
    milestone_revision = status.milestone_revisions.get("M27", "")
    gate_row = next(
        (cells for cells in status.gate_rows if cells[0] == "CROSS_PLATFORM_CORE"),
        [],
    )
    gate_revision = gate_row[2] if len(gate_row) >= REVISION_ROW_CELLS else ""
    direct_match = (
        TREE_REVISION_RE.match(w12_revision) is not None
        and milestone_revision == w12_revision
        and gate_revision == w12_revision
    )
    if not direct_match:
        report_path = repo / GATE_REPORTS["CROSS_PLATFORM_CORE"]
        report_text = report_path.read_text(encoding="utf-8", errors="replace")
        reanchor_fields = (
            "- Independent gate-neutral re-anchoring: ACCEPTED",
            f"- Final accepted M27 content revision: {milestone_revision}",
            f"- Re-anchored evaluated revision: {gate_revision}",
            "- Re-anchoring owner decision: ACCEPTED",
        )
        if not (
            TREE_REVISION_RE.match(w12_revision)
            and milestone_revision == w12_revision
            and all(field in report_text for field in reanchor_fields)
        ):
            report.fail(
                "M28 requires Gate D evaluated revision to equal the final "
                "accepted M27/M27-W12 content tree, or an explicit accepted "
                "gate-neutral re-anchoring record; found "
                f"M27={milestone_revision!r}, M27-W12={w12_revision!r}, "
                f"Gate-D={gate_revision!r}"
            )
            errors += 1
    if errors == 0:
        report.ok("M28 readiness is bound to the final accepted M27 content tree")


def _evidence_section(text: str, package_id: str) -> str:
    pattern = re.compile(
        rf"^### {re.escape(package_id)}(?:\s|$).*?"
        r"(?=^### M\d{2}-W\d{2}(?:\s|$)|\Z)",
        flags=re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    return match.group(0) if match else ""


def check_preserved_completed_history(
    status: Status, repo: Path, report: Report
) -> None:
    """Prevent any completed pre-v1.4 package anchor from being rewritten."""
    evidence_text = (repo / "docs/TEST_EVIDENCE.md").read_text(
        encoding="utf-8", errors="replace"
    )
    by_id = {cells[0]: cells for cells in status.package_rows}
    errors = 0
    for package_id, (revision, commit) in PRESERVED_PACKAGE_ANCHORS.items():
        cells = by_id.get(package_id, [])
        if len(cells) < FULL_EVIDENCE_ROW_CELLS:
            report.fail(f"{package_id}: preserved completed status row is missing")
            errors += 1
            continue
        if cells[1] != "VERIFIED":
            report.fail(
                f"{package_id}: preserved state changed from VERIFIED to {cells[1]!r}"
            )
            errors += 1
        if cells[2] != revision:
            report.fail(f"{package_id}: preserved revision changed from {revision!r}")
            errors += 1
        expected_link = f"docs/TEST_EVIDENCE.md § {package_id}"
        if cells[3] != expected_link:
            report.fail(
                f"{package_id}: preserved evidence link changed from {expected_link!r}"
            )
            errors += 1
        section = _evidence_section(evidence_text, package_id)
        if not section:
            report.fail(f"{package_id}: preserved evidence heading is missing")
            errors += 1
        elif commit not in section:
            report.fail(
                f"{package_id}: preserved evidence no longer records content "
                f"commit {commit}"
            )
            errors += 1
    if errors == 0:
        report.ok(
            "M00-W01…W10 and M01-W01…W06 states, trees, content commits, "
            "and evidence anchors are preserved"
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
        if ms_state == "ACCEPTED" and any(state not in DONE for state in states):
            report.fail(
                f"milestone {mid} is ACCEPTED but not all packages are "
                "VERIFIED or ACCEPTED"
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


def _canonicalish_spec_name(name: str) -> bool:
    normalized = unicodedata.normalize("NFKC", name).casefold()
    collapsed = re.sub(r"[^a-z0-9]+", "", normalized)
    return collapsed.startswith("masterimplementationspec")


def canonical_spec_offenders(repo: Path) -> list[str]:
    """Return every non-canonical file that looks or reads like the spec."""
    docs_dir = repo / "docs"
    canonical = repo / CANONICAL_SPEC_REL
    offenders: list[str] = []
    if not docs_dir.is_dir():
        return offenders
    marker = SPEC_HEADER_MARKER.encode()
    for path in sorted(docs_dir.rglob("*")):
        if path == canonical:
            continue
        rel = path.relative_to(repo).as_posix()
        name_match = _canonicalish_spec_name(path.name)
        if path.is_symlink():
            if name_match:
                offenders.append(rel)
            continue
        if path.is_dir():
            continue
        if not path.is_file():
            if name_match:
                offenders.append(rel)
            continue
        try:
            content_match = marker in path.read_bytes()
        except OSError:
            content_match = False
        if name_match or content_match:
            offenders.append(rel)
    return offenders


def check_single_canonical_spec(repo: Path, report: Report) -> None:
    canonical = repo / CANONICAL_SPEC_REL
    if canonical.is_symlink() or not canonical.is_file():
        report.fail(
            "canonical specification must be a regular, non-symlink file at "
            f"{CANONICAL_SPEC_REL}"
        )
    offenders = canonical_spec_offenders(repo)
    for rel in offenders:
        report.fail(f"second canonical-looking specification present: {rel}")
    if canonical.is_file() and not canonical.is_symlink() and not offenders:
        report.ok(
            "exactly one regular canonical specification exists under docs/ "
            "(case/Unicode/content variants checked)"
        )


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
    check_spec_contract(spec_path, spec, report)
    check_v14_governance_memory(repo, spec, report)
    check_status_shell(status, report)
    gate_states = check_gates(repo, status, report)
    ms_states, pkg_states = check_tables(spec, status, report)
    check_progress_consistency(status, pkg_states, report)
    check_live_blockers(repo, status, ms_states, pkg_states, report)
    check_dependencies(spec, ms_states, pkg_states, gate_states, report)
    check_v14_readiness_contract(spec, ms_states, pkg_states, gate_states, report)
    check_m28_gate_revision_binding(
        status, ms_states, pkg_states, gate_states, repo, report
    )
    check_milestone_consistency(spec, ms_states, pkg_states, report)
    check_evidence_preservation(repo, status, report)
    check_preserved_completed_history(status, repo, report)
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
