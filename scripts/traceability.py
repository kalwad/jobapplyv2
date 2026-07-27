#!/usr/bin/env python3
"""Generate and validate the JAPP-MASTER-001 v1.3 traceability view.

M00-W07 established the architecture and reviewed v1.2 mappings. M00-W08
mechanically extended it with visibly provisional v1.3 records; M00-W10 then
performed the complete human review and locked the expanded v1.3 mappings:

* docs/MASTER_IMPLEMENTATION_SPEC.md owns requirement text, milestone/package
  IDs and titles, and milestone/gate dependency declarations.
* docs/PROJECT_STATUS.md owns live milestone and work-package state/evidence.
* docs/CRITICAL_GATES.md and its reports own live critical-gate state/evidence.
* docs/traceability.json owns reviewed requirement mappings plus the expanded,
  machine-readable dependency/evidence records.
* docs/REQUIREMENTS_TRACEABILITY.md is generated and must never drift from
  those canonical inputs.

Exit codes: 0 = success, 1 = validation/drift failure, 2 = usage/read failure.
Usage:
  python3 scripts/traceability.py check [--repo DIR] [--quiet]
  python3 scripts/traceability.py generate [--repo DIR]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import validate_status

SCHEMA_VERSION = 2
SPECIFICATION_ID = "JAPP-MASTER-001"
SPECIFICATION_VERSION = "1.3"
EXPECTED_REQUIREMENTS = 157
EXPECTED_PACKAGES = 286
MIN_GATE_ROW_CELLS = 2

PRESERVED_REQUIREMENT_MAPPING_SHA256 = (
    "c2b4275f13d1074dea1532ae8d2a9020668eb44751c371e562cc78e46844eec9"
)
PRESERVED_PACKAGE_DEPENDENCY_SHA256 = (
    "bb42505238220f4b3230456f2a8c03ded62308e12b8773714fc9c559175fdb5f"
)
FINAL_V1_3_REQUIREMENT_MAPPING_SHA256 = (
    "4e18c9533e49cfc4eefd5774bb17cb51a19b8f51b97e430900ee06a8fce7445b"
)
FINAL_V1_3_PACKAGE_DEPENDENCY_SHA256 = (
    "549e793e447ba43d11d43992e81a0fb8137a4ebb6da1db9c04b4bce226707760"
)
REVIEWED_V1_2 = "REVIEWED_V1_2"
REVIEWED_V1_3 = "REVIEWED_V1_3"
MAPPING_REVIEW_STATES = (REVIEWED_V1_2, REVIEWED_V1_3)

NEW_REQUIREMENT_IDS = frozenset(
    [f"REQ-PLAT-{number:03d}" for number in range(11, 27)]
    + [f"REQ-GATE-{number:03d}" for number in range(17, 23)]
)
V1_3_VERIFIED_GOVERNANCE_REQUIREMENT_IDS = frozenset(
    {
        "REQ-PLAT-011",
        "REQ-PLAT-013",
        "REQ-GATE-017",
        "REQ-GATE-018",
        "REQ-GATE-022",
    }
)
V1_3_SCAFFOLD_REQUIREMENT_IDS = frozenset({"REQ-PLAT-025"})
NEW_PACKAGE_IDS = frozenset(
    {
        "M00-W08",
        "M00-W09",
        "M00-W10",
        "M01-W07",
        "M03-W07",
        "M03-W08",
        "M03-W09",
        "M03-W10",
        "M04-W07",
        "M04-W08",
        "M04-W09",
        "M04-W10",
        "M05-W13",
        "M05-W14",
        "M05-W15",
        "M05-W16",
        "M10-W07",
        "M17-W07",
        "M17-W08",
        "M17-W09",
        "M17-W10",
        "M27-W08",
        "M27-W09",
        "M27-W10",
        "M27-W11",
        "M27-W12",
    }
)

METADATA_REL = "docs/traceability.json"
VIEW_REL = "docs/REQUIREMENTS_TRACEABILITY.md"
SPEC_REL = "docs/MASTER_IMPLEMENTATION_SPEC.md"
STATUS_REL = "docs/PROJECT_STATUS.md"
GATES_REL = "docs/CRITICAL_GATES.md"

REQUIREMENT_STATES = (
    "NOT_STARTED",
    "SCAFFOLD_ONLY",
    "IMPLEMENTED",
    "VERIFIED",
    "ACCEPTED",
)
VERIFICATION_STATES = ("NOT_YET_APPLICABLE", "VERIFIED", "ACCEPTED")
GATE_EFFECTS = (
    "NONE",
    "AUTOFILL_FEASIBILITY",
    "RESUME_PAGEFIT_FEASIBILITY",
    "WORKDAY_GUIDED_PRE_SUBMIT",
    "CROSS_PLATFORM_CORE",
    "M28_CORE_ALPHA",
    "M38_RELEASE",
    "OVERALL_RELEASE",
)
DEPENDENCY_BASES = (
    "NO_DIRECT_PACKAGE_PREREQUISITE",
    "REVIEWED_DERIVED_SEQUENTIAL",
    "SPEC_MILESTONE_DEPENDENCY",
    "SPEC_CRITICAL_GATE_QUALIFIER",
    "SPEC_ACCEPTED_MILESTONE_QUALIFIER",
)

REQ_LINE_RE = re.compile(r"^- `(REQ-[A-Z]+-\d{3})`: (.+)$")
REQ_ANY_RE = re.compile(r"`(REQ-[A-Z]+-\d{3})`")
REQ_FAMILY_RE = re.compile(r"^### 4\.\d+ (.+?)(?: requirements)?$")
EVIDENCE_HEADING_RE = re.compile(r"^### M\d{2}-W\d{2}(?:\s|$)")

TOP_LEVEL_KEYS = {
    "schema_version",
    "review",
    "specification",
    "enums",
    "dependency_policy",
    "requirements",
    "work_packages",
    "critical_gates",
}
REQUIREMENT_KEYS = {
    "id",
    "text",
    "family",
    "owning_packages",
    "planned_components",
    "automated_test_layers",
    "manual_evidence",
    "gate_effects",
    "implementation_state",
    "verification_state",
    "current_evidence",
    "completed_code_paths",
    "completed_test_paths",
    "notes",
    "mapping_review_state",
}
PACKAGE_KEYS = {
    "id",
    "milestone",
    "title",
    "current_state",
    "verified_revision",
    "direct_package_prerequisites",
    "milestone_prerequisites",
    "critical_gate_prerequisites",
    "accepted_milestone_prerequisites",
    "dependency_basis",
    "primary_deliverables",
    "required_automated_verification",
    "required_manual_evidence",
    "downstream_packages",
    "downstream_milestones",
    "current_evidence",
    "dependency_review_state",
}
GATE_KEYS = {
    "id",
    "current_state",
    "report_path",
    "blocked_milestones",
    "blocked_packages",
}
EVIDENCE_KEYS = {"path", "heading"}


@dataclass(frozen=True)
class Requirement:
    requirement_id: str
    text: str
    family: str


@dataclass(frozen=True)
class PackageStatus:
    state: str
    revision: str
    evidence: str


@dataclass
class ValidationResult:
    errors: list[str]
    requirement_count: int = 0
    package_count: int = 0
    expected_view: str | None = None

    @property
    def ok(self) -> bool:
        return not self.errors


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _inventory_hash(rows: object) -> str:
    encoded = json.dumps(
        rows, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode()
    return _sha256_bytes(encoded)


def _expanded_requirement_review_rows(
    requirements: list[dict[str, object]],
) -> list[list[object]]:
    """Return the final v1.3 requirement mapping and honesty projection."""
    return [
        [
            record.get("id"),
            record.get("owning_packages"),
            record.get("planned_components"),
            record.get("automated_test_layers"),
            record.get("manual_evidence"),
            record.get("gate_effects"),
            record.get("mapping_review_state"),
            record.get("implementation_state"),
            record.get("verification_state"),
            record.get("completed_code_paths"),
            record.get("completed_test_paths"),
            record.get("current_evidence"),
            record.get("notes"),
        ]
        for record in requirements
    ]


def _expanded_package_review_rows(
    packages: list[dict[str, object]],
) -> list[list[object]]:
    """Return the final v1.3 package dependency and proof-plan projection."""
    return [
        [
            record.get("id"),
            record.get("direct_package_prerequisites"),
            record.get("milestone_prerequisites"),
            record.get("critical_gate_prerequisites"),
            record.get("accepted_milestone_prerequisites"),
            record.get("downstream_packages"),
            record.get("downstream_milestones"),
            record.get("primary_deliverables"),
            record.get("required_automated_verification"),
            record.get("required_manual_evidence"),
            record.get("dependency_review_state"),
        ]
        for record in packages
    ]


def parse_requirements(spec_path: Path) -> list[Requirement]:
    """Parse every §4 requirement without deduplicating it."""
    requirements: list[Requirement] = []
    family: str | None = None
    in_catalog = False
    for line in spec_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## 4. "):
            in_catalog = True
            continue
        if in_catalog and line.startswith("## 5. "):
            break
        if not in_catalog:
            continue
        family_match = REQ_FAMILY_RE.match(line)
        if family_match:
            family = family_match.group(1)
            continue
        requirement_match = REQ_LINE_RE.match(line)
        if requirement_match:
            if family is None:
                raise ValueError(
                    f"requirement {requirement_match.group(1)} has no §4 family"
                )
            requirements.append(
                Requirement(
                    requirement_id=requirement_match.group(1),
                    text=requirement_match.group(2),
                    family=family,
                )
            )
    return requirements


def _load_json_object(path: Path) -> dict[str, object]:
    raw: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not all(isinstance(key, str) for key in raw):
        raise ValueError(f"{path}: root must be a JSON object")
    return cast(dict[str, object], raw)


def _object(value: object, label: str, errors: list[str]) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        errors.append(f"{label} must be an object")
        return {}
    return cast(dict[str, object], value)


def _object_list(
    value: object, label: str, errors: list[str]
) -> list[dict[str, object]]:
    if not isinstance(value, list):
        errors.append(f"{label} must be an array")
        return []
    objects: list[dict[str, object]] = []
    for index, item in enumerate(value):
        objects.append(_object(item, f"{label}[{index}]", errors))
    return objects


def _strings(
    value: object,
    label: str,
    errors: list[str],
    *,
    nonempty: bool = False,
) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        errors.append(f"{label} must be an array of strings")
        return []
    result = cast(list[str], value)
    if nonempty and not result:
        errors.append(f"{label} must not be empty")
    if len(result) != len(set(result)):
        errors.append(f"{label} contains duplicates")
    return result


def _string(value: object, label: str, errors: list[str]) -> str:
    if not isinstance(value, str) or not value:
        errors.append(f"{label} must be a non-empty string")
        return ""
    return value


def _check_keys(
    value: dict[str, object], expected: set[str], label: str, errors: list[str]
) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing:
        errors.append(f"{label} missing field(s): {missing}")
    if unknown:
        errors.append(f"{label} has unknown field(s): {unknown}")


def _status_maps(
    repo: Path,
) -> tuple[
    dict[str, str],
    dict[str, PackageStatus],
    dict[str, str],
    validate_status.Status,
]:
    status = validate_status.parse_status(repo / STATUS_REL)
    milestone_states = dict(status.milestone_rows)
    package_status: dict[str, PackageStatus] = {}
    for cells in status.package_rows:
        padded = [*cells, "", "", ""][:4]
        package_status[padded[0]] = PackageStatus(
            state=padded[1], revision=padded[2], evidence=padded[3]
        )
    gate_states = {
        cells[0]: cells[1]
        for cells in status.gate_rows
        if len(cells) >= MIN_GATE_ROW_CELLS
    }
    return milestone_states, package_status, gate_states, status


def _evidence_refs(
    value: object, label: str, repo: Path, errors: list[str]
) -> list[dict[str, str]]:
    references = _object_list(value, label, errors)
    parsed: list[dict[str, str]] = []
    for index, reference in enumerate(references):
        ref_label = f"{label}[{index}]"
        _check_keys(reference, EVIDENCE_KEYS, ref_label, errors)
        path = _string(reference.get("path"), f"{ref_label}.path", errors)
        heading = _string(reference.get("heading"), f"{ref_label}.heading", errors)
        if not path or not heading:
            continue
        target = repo / path
        if not target.is_file():
            errors.append(f"{ref_label} references missing evidence path: {path}")
        else:
            headings = target.read_text(encoding="utf-8").splitlines()
            if not any(line.startswith(heading) for line in headings):
                errors.append(
                    f"{ref_label} references missing evidence heading "
                    f"{heading!r} in {path}"
                )
        parsed.append({"path": path, "heading": heading})
    return parsed


def _expected_package_records(
    spec: validate_status.Spec,
) -> tuple[
    dict[str, tuple[str, str]],
    dict[str, list[str]],
    dict[str, list[str]],
]:
    inventory: dict[str, tuple[str, str]] = {}
    expected_direct: dict[str, list[str]] = {}
    expected_downstream: dict[str, list[str]] = {}
    for milestone_id, milestone in spec.milestones.items():
        ids = [package_id for package_id, _ in milestone.packages]
        for index, (package_id, title) in enumerate(milestone.packages):
            inventory[package_id] = (milestone_id, title)
            expected_direct[package_id] = [] if index == 0 else [ids[index - 1]]
            expected_downstream[package_id] = (
                [ids[index + 1]] if index + 1 < len(ids) else []
            )
    return inventory, expected_direct, expected_downstream


def _downstream_milestones(spec: validate_status.Spec) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {
        milestone_id: [] for milestone_id in spec.milestones
    }
    for milestone_id, milestone in spec.milestones.items():
        for dependency in milestone.deps:
            result[dependency].append(milestone_id)
    return {key: sorted(value) for key, value in result.items()}


def _expected_gate_milestones(spec: validate_status.Spec) -> dict[str, list[str]]:
    blocked: dict[str, list[str]] = {gate: [] for gate in validate_status.GATES}
    for milestone_id, milestone in spec.milestones.items():
        for gate in milestone.gates:
            if gate in blocked:
                blocked[gate].append(milestone_id)
    for milestone_id, gate in validate_status.REQUIRED_GATE_RULES.items():
        if milestone_id not in blocked[gate]:
            blocked[gate].append(milestone_id)
    return {gate: sorted(milestones) for gate, milestones in blocked.items()}


def _cycle(nodes: set[str], prerequisites: dict[str, list[str]]) -> list[str] | None:
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def visit(node: str) -> list[str] | None:
        if node in visiting:
            start = stack.index(node)
            return [*stack[start:], node]
        if node in visited:
            return None
        visiting.add(node)
        stack.append(node)
        for prerequisite in prerequisites.get(node, []):
            if prerequisite in nodes:
                found = visit(prerequisite)
                if found:
                    return found
        stack.pop()
        visiting.remove(node)
        visited.add(node)
        return None

    for node in sorted(nodes):
        found = visit(node)
        if found:
            return found
    return None


def _validate_specification(
    metadata: dict[str, object],
    spec_path: Path,
    requirements: list[Requirement],
    spec: validate_status.Spec,
    errors: list[str],
) -> None:
    specification = _object(metadata.get("specification"), "specification", errors)
    expected_keys = {
        "id",
        "version",
        "path",
        "sha256",
        "requirements_inventory_sha256",
        "work_packages_inventory_sha256",
    }
    _check_keys(specification, expected_keys, "specification", errors)
    expected_scalars = {
        "id": SPECIFICATION_ID,
        "version": SPECIFICATION_VERSION,
        "path": SPEC_REL,
        "sha256": _sha256_bytes(spec_path.read_bytes()),
        "requirements_inventory_sha256": _inventory_hash(
            [[item.requirement_id, item.text, item.family] for item in requirements]
        ),
        "work_packages_inventory_sha256": _inventory_hash(
            [
                [package_id, milestone_id, title]
                for milestone_id, milestone in spec.milestones.items()
                for package_id, title in milestone.packages
            ]
        ),
    }
    for key, expected in expected_scalars.items():
        if specification.get(key) != expected:
            errors.append(
                f"specification.{key} drift: expected {expected!r}, "
                f"found {specification.get(key)!r}"
            )


def _validate_enums(metadata: dict[str, object], errors: list[str]) -> None:
    enums = _object(metadata.get("enums"), "enums", errors)
    expected: dict[str, list[str]] = {
        "requirement_implementation_states": list(REQUIREMENT_STATES),
        "requirement_verification_states": list(VERIFICATION_STATES),
        "package_states": sorted(validate_status.STATES),
        "gate_states": sorted(validate_status.GATE_STATES),
        "gate_effects": list(GATE_EFFECTS),
        "dependency_bases": list(DEPENDENCY_BASES),
        "mapping_review_states": list(MAPPING_REVIEW_STATES),
    }
    _check_keys(enums, set(expected), "enums", errors)
    for key, values in expected.items():
        actual = _strings(enums.get(key), f"enums.{key}", errors)
        if actual != values:
            errors.append(f"enums.{key} must equal {values}, found {actual}")


def _validate_policy(metadata: dict[str, object], errors: list[str]) -> None:
    policy = _object(metadata.get("dependency_policy"), "dependency_policy", errors)
    expected = {
        "package_inventory_source": f"{SPEC_REL} §9",
        "package_state_source": f"{STATUS_REL} work-package table",
        "gate_state_source": f"{STATUS_REL} critical-gates table + {GATES_REL}",
        "sequential_package_order": "REVIEWED_DERIVED",
        "sequential_derivation": (
            "Each package after W01 directly requires the immediately preceding "
            "package in the same milestone unless the specification explicitly "
            "permits otherwise; v1.3 contains no such exception."
        ),
        "milestone_readiness_state": "ACCEPTED",
        "critical_gate_readiness_state": "PASS",
        "ready_tie_breaker": (
            "When no package is IN_PROGRESS, choose the first eligible unfinished "
            "package in canonical milestone/package order; mark exactly that "
            "package READY."
        ),
        "downstream_package_derivation": (
            "Reverse of direct sequential package prerequisites; cross-milestone "
            "effects remain milestone dependencies and are not invented as "
            "direct package edges."
        ),
    }
    _check_keys(policy, set(expected), "dependency_policy", errors)
    for key, value in expected.items():
        if policy.get(key) != value:
            errors.append(
                f"dependency_policy.{key} drift: expected {value!r}, "
                f"found {policy.get(key)!r}"
            )


def _validate_review(
    metadata: dict[str, object],
    requirements: list[dict[str, object]],
    packages: list[dict[str, object]],
    errors: list[str],
) -> None:
    review = _object(metadata.get("review"), "review", errors)
    expected_keys = {
        "reviewed_in_work_package",
        "mechanically_extended_in_work_package",
        "v1_3_reviewed_in_work_package",
        "requirements_mapping_sha256",
        "work_package_dependency_sha256",
        "expanded_requirements_mapping_sha256",
        "expanded_work_package_dependency_sha256",
        "v1_3_extension_review_state",
        "derived_dependency_review",
    }
    _check_keys(review, expected_keys, "review", errors)
    if review.get("reviewed_in_work_package") != "M00-W07":
        errors.append("review.reviewed_in_work_package must be M00-W07")
    if review.get("mechanically_extended_in_work_package") != "M00-W08":
        errors.append("review.mechanically_extended_in_work_package must be M00-W08")
    if review.get("v1_3_reviewed_in_work_package") != "M00-W10":
        errors.append("review.v1_3_reviewed_in_work_package must be M00-W10")
    if review.get("v1_3_extension_review_state") != REVIEWED_V1_3:
        errors.append(f"review.v1_3_extension_review_state must be {REVIEWED_V1_3}")
    legacy_requirement_rows = [
        [
            record.get("id"),
            record.get("owning_packages"),
            record.get("planned_components"),
            record.get("automated_test_layers"),
            record.get("manual_evidence"),
            record.get("gate_effects"),
        ]
        for record in requirements
        if record.get("id") not in NEW_REQUIREMENT_IDS
    ]
    expanded_requirement_rows = _expanded_requirement_review_rows(requirements)

    def legacy_package_row(record: dict[str, object]) -> list[object]:
        package_id = record.get("id")
        direct = [
            value
            for value in cast(list[str], record.get("direct_package_prerequisites", []))
            if value not in NEW_PACKAGE_IDS
        ]
        gates = [
            value
            for value in cast(list[str], record.get("critical_gate_prerequisites", []))
            if value != "CROSS_PLATFORM_CORE"
        ]
        accepted = list(
            cast(list[str], record.get("accepted_milestone_prerequisites", []))
        )
        if isinstance(package_id, str) and package_id.startswith("M28-"):
            accepted = [value for value in accepted if value != "M27"]
        downstream = [
            value
            for value in cast(list[str], record.get("downstream_packages", []))
            if value not in NEW_PACKAGE_IDS
        ]
        return [
            package_id,
            direct,
            record.get("milestone_prerequisites"),
            gates,
            accepted,
            downstream,
            record.get("downstream_milestones"),
        ]

    legacy_package_rows = [
        legacy_package_row(record)
        for record in packages
        if record.get("id") not in NEW_PACKAGE_IDS
    ]
    expanded_package_rows = _expanded_package_review_rows(packages)
    expected_hashes = {
        "requirements_mapping_sha256": _inventory_hash(legacy_requirement_rows),
        "work_package_dependency_sha256": _inventory_hash(legacy_package_rows),
        "expanded_requirements_mapping_sha256": _inventory_hash(
            expanded_requirement_rows
        ),
        "expanded_work_package_dependency_sha256": _inventory_hash(
            expanded_package_rows
        ),
    }
    for key, expected in expected_hashes.items():
        if review.get(key) != expected:
            errors.append(
                f"review.{key} drift: expected {expected!r}, "
                f"found {review.get(key)!r}; explicit reviewed update required"
            )
    if review.get("requirements_mapping_sha256") != (
        PRESERVED_REQUIREMENT_MAPPING_SHA256
    ):
        errors.append("preserved v1.2 requirement-mapping hash changed")
    if review.get("work_package_dependency_sha256") != (
        PRESERVED_PACKAGE_DEPENDENCY_SHA256
    ):
        errors.append("preserved v1.2 dependency-map hash changed")
    if review.get("expanded_requirements_mapping_sha256") != (
        FINAL_V1_3_REQUIREMENT_MAPPING_SHA256
    ):
        errors.append("final reviewed v1.3 requirement-mapping hash changed")
    if review.get("expanded_work_package_dependency_sha256") != (
        FINAL_V1_3_PACKAGE_DEPENDENCY_SHA256
    ):
        errors.append("final reviewed v1.3 dependency-map hash changed")
    expected_review = (
        "Sequential direct-package edges are the reviewed derivation of "
        "specification §1 ordering plus each §9 listed package order; milestone "
        "and gate edges remain exact specification data. The final v1.3 hashes "
        "also lock reviewed requirement honesty fields and package deliverable, "
        "automated-verification, and manual-evidence plans."
    )
    if review.get("derived_dependency_review") != expected_review:
        errors.append("review.derived_dependency_review drift")


def _validate_requirements(
    metadata: dict[str, object],
    canonical: list[Requirement],
    package_inventory: dict[str, tuple[str, str]],
    package_status: dict[str, PackageStatus],
    repo: Path,
    errors: list[str],
) -> list[dict[str, object]]:
    records = _object_list(metadata.get("requirements"), "requirements", errors)
    canonical_ids = [item.requirement_id for item in canonical]
    ids: list[str] = []
    for record in records:
        record_id = record.get("id")
        ids.append(record_id if isinstance(record_id, str) else "")
    duplicates = sorted(
        requirement_id
        for requirement_id, count in Counter(ids).items()
        if requirement_id and count > 1
    )
    if duplicates:
        errors.append(f"duplicate requirement record(s): {duplicates}")
    missing = [
        requirement_id for requirement_id in canonical_ids if requirement_id not in ids
    ]
    unknown = sorted(set(ids) - set(canonical_ids) - {""})
    if missing:
        errors.append(f"missing canonical requirement record(s): {missing}")
    if unknown:
        errors.append(f"unknown requirement record(s): {unknown}")
    if len(records) != EXPECTED_REQUIREMENTS:
        errors.append(
            f"traceability defines {len(records)} requirement records "
            f"(expected {EXPECTED_REQUIREMENTS})"
        )

    canonical_by_id = {item.requirement_id: item for item in canonical}
    for index, record in enumerate(records):
        label = f"requirements[{index}]"
        _check_keys(record, REQUIREMENT_KEYS, label, errors)
        requirement_id = _string(record.get("id"), f"{label}.id", errors)
        expected = canonical_by_id.get(requirement_id)
        if expected is not None:
            if record.get("text") != expected.text:
                errors.append(f"{requirement_id}: requirement text drift")
            if record.get("family") != expected.family:
                errors.append(
                    f"{requirement_id}: requirement family drift; expected "
                    f"{expected.family!r}"
                )
        owners = _strings(
            record.get("owning_packages"),
            f"{label}.owning_packages",
            errors,
            nonempty=True,
        )
        for owner in owners:
            if owner not in package_inventory:
                errors.append(f"{requirement_id}: unknown owning package {owner}")
        _strings(
            record.get("planned_components"),
            f"{label}.planned_components",
            errors,
            nonempty=True,
        )
        _strings(
            record.get("automated_test_layers"),
            f"{label}.automated_test_layers",
            errors,
            nonempty=True,
        )
        _strings(
            record.get("manual_evidence"),
            f"{label}.manual_evidence",
            errors,
            nonempty=True,
        )
        effects = _strings(
            record.get("gate_effects"),
            f"{label}.gate_effects",
            errors,
            nonempty=True,
        )
        invalid_effects = sorted(set(effects) - set(GATE_EFFECTS))
        if invalid_effects:
            errors.append(f"{requirement_id}: invalid gate effects {invalid_effects}")
        if "NONE" in effects and len(effects) > 1:
            errors.append(
                f"{requirement_id}: NONE cannot accompany another gate effect"
            )
        implementation_state = _string(
            record.get("implementation_state"),
            f"{label}.implementation_state",
            errors,
        )
        verification_state = _string(
            record.get("verification_state"),
            f"{label}.verification_state",
            errors,
        )
        if implementation_state not in REQUIREMENT_STATES:
            errors.append(
                f"{requirement_id}: invalid implementation state "
                f"{implementation_state!r}"
            )
        if verification_state not in VERIFICATION_STATES:
            errors.append(
                f"{requirement_id}: invalid verification state {verification_state!r}"
            )
        evidence = _evidence_refs(
            record.get("current_evidence"),
            f"{label}.current_evidence",
            repo,
            errors,
        )
        code_paths = _strings(
            record.get("completed_code_paths"),
            f"{label}.completed_code_paths",
            errors,
        )
        test_paths = _strings(
            record.get("completed_test_paths"),
            f"{label}.completed_test_paths",
            errors,
        )
        _string(record.get("notes"), f"{label}.notes", errors)
        review_state = _string(
            record.get("mapping_review_state"),
            f"{label}.mapping_review_state",
            errors,
        )
        expected_review_state = (
            REVIEWED_V1_3 if requirement_id in NEW_REQUIREMENT_IDS else REVIEWED_V1_2
        )
        if review_state != expected_review_state:
            errors.append(
                f"{requirement_id}: mapping review state must be "
                f"{expected_review_state}, found {review_state!r}"
            )
        completed = implementation_state in {"IMPLEMENTED", "VERIFIED", "ACCEPTED"}
        if completed:
            if verification_state not in {"VERIFIED", "ACCEPTED"}:
                errors.append(
                    f"{requirement_id}: completed implementation lacks verified state"
                )
            if not code_paths or not test_paths or not evidence:
                errors.append(
                    f"{requirement_id}: completed requirement requires real "
                    "code, test, and evidence references"
                )
            if not any(
                package_status.get(owner, PackageStatus("", "", "")).state
                in validate_status.DONE
                for owner in owners
            ):
                errors.append(
                    f"{requirement_id}: completed claim has no verified/accepted "
                    "owning package"
                )
        if implementation_state == "NOT_STARTED":
            if verification_state != "NOT_YET_APPLICABLE":
                errors.append(
                    f"{requirement_id}: future NOT_STARTED requirement must be "
                    "NOT_YET_APPLICABLE"
                )
            if code_paths or test_paths or evidence:
                errors.append(
                    f"{requirement_id}: future NOT_STARTED requirement falsely "
                    "claims implementation or evidence"
                )
        if requirement_id in NEW_REQUIREMENT_IDS:
            if requirement_id in V1_3_VERIFIED_GOVERNANCE_REQUIREMENT_IDS:
                expected_states = ("VERIFIED", "VERIFIED")
            elif requirement_id in V1_3_SCAFFOLD_REQUIREMENT_IDS:
                expected_states = ("SCAFFOLD_ONLY", "NOT_YET_APPLICABLE")
            else:
                expected_states = ("NOT_STARTED", "NOT_YET_APPLICABLE")
            if (implementation_state, verification_state) != expected_states:
                errors.append(
                    f"{requirement_id}: reviewed v1.3 state must be "
                    f"{expected_states[0]}/{expected_states[1]}, found "
                    f"{implementation_state}/{verification_state}"
                )
            if requirement_id in V1_3_SCAFFOLD_REQUIREMENT_IDS and (
                not code_paths or not test_paths or not evidence
            ):
                errors.append(
                    f"{requirement_id}: SCAFFOLD_ONLY claim requires real "
                    "code, test, and evidence references"
                )
        for kind, paths in (("code", code_paths), ("test", test_paths)):
            for relative in paths:
                if not (repo / relative).is_file():
                    errors.append(
                        f"{requirement_id}: completed {kind} path does not exist: "
                        f"{relative}"
                    )
    return records


def _validate_packages(
    metadata: dict[str, object],
    spec: validate_status.Spec,
    milestone_states: dict[str, str],
    package_status: dict[str, PackageStatus],
    gate_states: dict[str, str],
    repo: Path,
    errors: list[str],
) -> list[dict[str, object]]:
    records = _object_list(metadata.get("work_packages"), "work_packages", errors)
    inventory, expected_direct, expected_downstream = _expected_package_records(spec)
    downstream_milestones = _downstream_milestones(spec)
    ids: list[str] = []
    for record in records:
        record_id = record.get("id")
        ids.append(record_id if isinstance(record_id, str) else "")
    duplicates = sorted(
        package_id
        for package_id, count in Counter(ids).items()
        if package_id and count > 1
    )
    if duplicates:
        errors.append(f"duplicate work-package record(s): {duplicates}")
    missing = [package_id for package_id in inventory if package_id not in ids]
    unknown = sorted(set(ids) - set(inventory) - {""})
    if missing:
        errors.append(f"missing canonical work-package record(s): {missing}")
    if unknown:
        errors.append(f"unknown work-package record(s): {unknown}")
    if len(records) != EXPECTED_PACKAGES:
        errors.append(
            f"traceability defines {len(records)} work-package records "
            f"(expected {EXPECTED_PACKAGES})"
        )

    direct_graph: dict[str, list[str]] = {}
    for index, record in enumerate(records):
        label = f"work_packages[{index}]"
        _check_keys(record, PACKAGE_KEYS, label, errors)
        package_id = _string(record.get("id"), f"{label}.id", errors)
        expected = inventory.get(package_id)
        if expected is None:
            continue
        milestone_id, title = expected
        if record.get("milestone") != milestone_id:
            errors.append(
                f"{package_id}: wrong milestone; expected {milestone_id}, "
                f"found {record.get('milestone')!r}"
            )
        if record.get("title") != title:
            errors.append(f"{package_id}: wrong package title; expected {title!r}")
        status = package_status.get(package_id)
        if status is None:
            errors.append(f"{package_id}: absent from {STATUS_REL}")
            status = PackageStatus("", "", "")
        if record.get("current_state") != status.state:
            errors.append(
                f"{package_id}: current state disagrees with {STATUS_REL}; "
                f"expected {status.state!r}, found {record.get('current_state')!r}"
            )
        if record.get("verified_revision") != status.revision:
            errors.append(
                f"{package_id}: verified revision disagrees with {STATUS_REL}"
            )
        direct = _strings(
            record.get("direct_package_prerequisites"),
            f"{label}.direct_package_prerequisites",
            errors,
        )
        direct_graph[package_id] = direct
        for prerequisite in direct:
            if prerequisite not in inventory:
                errors.append(
                    f"{package_id}: dependency references unknown package "
                    f"{prerequisite}"
                )
        if direct != expected_direct[package_id]:
            errors.append(
                f"{package_id}: direct package prerequisites drift; expected "
                f"{expected_direct[package_id]}, found {direct}"
            )
        milestone_dependencies = _strings(
            record.get("milestone_prerequisites"),
            f"{label}.milestone_prerequisites",
            errors,
        )
        expected_milestones = sorted(spec.milestones[milestone_id].deps)
        if milestone_dependencies != expected_milestones:
            errors.append(
                f"{package_id}: milestone prerequisites drift; expected "
                f"{expected_milestones}, found {milestone_dependencies}"
            )
        gate_dependencies = _strings(
            record.get("critical_gate_prerequisites"),
            f"{label}.critical_gate_prerequisites",
            errors,
        )
        expected_gates = sorted(spec.milestones[milestone_id].gates)
        required_gate = validate_status.REQUIRED_GATE_RULES.get(milestone_id)
        if required_gate and required_gate not in expected_gates:
            expected_gates.append(required_gate)
            expected_gates.sort()
        if gate_dependencies != expected_gates:
            errors.append(
                f"{package_id}: critical-gate prerequisites drift; expected "
                f"{expected_gates}, found {gate_dependencies}"
            )
        accepted_dependencies = _strings(
            record.get("accepted_milestone_prerequisites"),
            f"{label}.accepted_milestone_prerequisites",
            errors,
        )
        expected_accepted = sorted(
            set(spec.milestones[milestone_id].accepted_deps)
            | set(validate_status.HARD_ACCEPTED_DEPS.get(milestone_id, ()))
        )
        if accepted_dependencies != expected_accepted:
            errors.append(
                f"{package_id}: accepted-milestone qualifiers drift; expected "
                f"{expected_accepted}, found {accepted_dependencies}"
            )
        bases = _strings(
            record.get("dependency_basis"),
            f"{label}.dependency_basis",
            errors,
            nonempty=True,
        )
        invalid_bases = sorted(set(bases) - set(DEPENDENCY_BASES))
        if invalid_bases:
            errors.append(f"{package_id}: invalid dependency bases {invalid_bases}")
        expected_bases = [
            (
                "REVIEWED_DERIVED_SEQUENTIAL"
                if expected_direct[package_id]
                else "NO_DIRECT_PACKAGE_PREREQUISITE"
            )
        ]
        if expected_milestones:
            expected_bases.append("SPEC_MILESTONE_DEPENDENCY")
        if expected_gates:
            expected_bases.append("SPEC_CRITICAL_GATE_QUALIFIER")
        if expected_accepted:
            expected_bases.append("SPEC_ACCEPTED_MILESTONE_QUALIFIER")
        if bases != expected_bases:
            errors.append(
                f"{package_id}: dependency basis drift; expected "
                f"{expected_bases}, found {bases}"
            )
        deliverables = _strings(
            record.get("primary_deliverables"),
            f"{label}.primary_deliverables",
            errors,
            nonempty=True,
        )
        if deliverables != [title]:
            errors.append(
                f"{package_id}: primary deliverable must preserve exact package title"
            )
        _strings(
            record.get("required_automated_verification"),
            f"{label}.required_automated_verification",
            errors,
            nonempty=True,
        )
        _strings(
            record.get("required_manual_evidence"),
            f"{label}.required_manual_evidence",
            errors,
            nonempty=True,
        )
        downstream = _strings(
            record.get("downstream_packages"),
            f"{label}.downstream_packages",
            errors,
        )
        if downstream != expected_downstream[package_id]:
            errors.append(
                f"{package_id}: downstream package map drift; expected "
                f"{expected_downstream[package_id]}, found {downstream}"
            )
        expected_downstream_milestones = downstream_milestones[milestone_id]
        actual_downstream_milestones = _strings(
            record.get("downstream_milestones"),
            f"{label}.downstream_milestones",
            errors,
        )
        if actual_downstream_milestones != expected_downstream_milestones:
            errors.append(
                f"{package_id}: downstream milestone map drift; expected "
                f"{expected_downstream_milestones}, "
                f"found {actual_downstream_milestones}"
            )
        evidence = _evidence_refs(
            record.get("current_evidence"),
            f"{label}.current_evidence",
            repo,
            errors,
        )
        if status.state in validate_status.DONE:
            if not evidence:
                errors.append(
                    f"{package_id}: completed package lacks current evidence link"
                )
            expected_evidence = {
                "path": "docs/TEST_EVIDENCE.md",
                "heading": f"### {package_id}",
            }
            if expected_evidence not in evidence:
                errors.append(
                    f"{package_id}: completed package must reference its own "
                    f"{expected_evidence['heading']} heading in "
                    "docs/TEST_EVIDENCE.md"
                )
            if status.evidence and not any(
                reference["path"] in status.evidence for reference in evidence
            ):
                errors.append(
                    f"{package_id}: current evidence disagrees with {STATUS_REL}"
                )
        elif evidence:
            errors.append(
                f"{package_id}: incomplete package must not claim current evidence"
            )
        review_state = _string(
            record.get("dependency_review_state"),
            f"{label}.dependency_review_state",
            errors,
        )
        expected_review_state = (
            REVIEWED_V1_3 if package_id in NEW_PACKAGE_IDS else REVIEWED_V1_2
        )
        if review_state != expected_review_state:
            errors.append(
                f"{package_id}: dependency review state must be "
                f"{expected_review_state}, found {review_state!r}"
            )

        active = status.state in (validate_status.STARTED | {"READY"})
        if active:
            for prerequisite in direct:
                if (
                    package_status.get(prerequisite, PackageStatus("", "", "")).state
                    not in validate_status.DONE
                ):
                    errors.append(
                        f"{package_id} is {status.state} before direct prerequisite "
                        f"{prerequisite} is verified"
                    )
            for prerequisite in milestone_dependencies:
                if milestone_states.get(prerequisite) != "ACCEPTED":
                    errors.append(
                        f"{package_id} is {status.state} before milestone "
                        f"{prerequisite} is ACCEPTED"
                    )
            for prerequisite in accepted_dependencies:
                if milestone_states.get(prerequisite) != "ACCEPTED":
                    errors.append(
                        f"{package_id} is {status.state} before explicit accepted "
                        f"milestone {prerequisite}"
                    )
            for gate in gate_dependencies:
                if gate_states.get(gate) != "PASS":
                    errors.append(
                        f"{package_id} is {status.state} before critical gate "
                        f"{gate} is PASS"
                    )

    cycle = _cycle(set(inventory), direct_graph)
    if cycle:
        errors.append(f"work-package dependency cycle: {' -> '.join(cycle)}")
    milestone_graph = {
        milestone_id: sorted(milestone.deps)
        for milestone_id, milestone in spec.milestones.items()
    }
    milestone_cycle = _cycle(set(spec.milestones), milestone_graph)
    if milestone_cycle:
        errors.append(f"milestone dependency cycle: {' -> '.join(milestone_cycle)}")
    return records


def _validate_gates(
    metadata: dict[str, object],
    spec: validate_status.Spec,
    gate_states: dict[str, str],
    package_inventory: dict[str, tuple[str, str]],
    repo: Path,
    errors: list[str],
) -> list[dict[str, object]]:
    records = _object_list(metadata.get("critical_gates"), "critical_gates", errors)
    ids: list[str] = []
    for record in records:
        record_id = record.get("id")
        ids.append(record_id if isinstance(record_id, str) else "")
    if len(ids) != len(set(ids)):
        errors.append("duplicate critical-gate record")
    missing = sorted(set(validate_status.GATES) - set(ids))
    unknown = sorted(set(ids) - set(validate_status.GATES) - {""})
    if missing:
        errors.append(f"missing critical-gate record(s): {missing}")
    if unknown:
        errors.append(f"unknown critical-gate record(s): {unknown}")
    expected_milestones = _expected_gate_milestones(spec)
    for index, record in enumerate(records):
        label = f"critical_gates[{index}]"
        _check_keys(record, GATE_KEYS, label, errors)
        gate = _string(record.get("id"), f"{label}.id", errors)
        if gate not in validate_status.GATES:
            continue
        if record.get("current_state") != gate_states.get(gate):
            errors.append(
                f"{gate}: state disagrees with {STATUS_REL}; expected "
                f"{gate_states.get(gate)!r}"
            )
        expected_report = validate_status.GATE_REPORTS[gate]
        if record.get("report_path") != expected_report:
            errors.append(f"{gate}: report path drift; expected {expected_report!r}")
        if not (repo / expected_report).is_file():
            errors.append(f"{gate}: critical-gate report path does not exist")
        milestones = _strings(
            record.get("blocked_milestones"),
            f"{label}.blocked_milestones",
            errors,
        )
        if milestones != expected_milestones[gate]:
            errors.append(
                f"{gate}: blocked milestone map drift; expected "
                f"{expected_milestones[gate]}, found {milestones}"
            )
        packages = _strings(
            record.get("blocked_packages"),
            f"{label}.blocked_packages",
            errors,
        )
        expected_packages = [
            package_id
            for package_id, (milestone_id, _) in package_inventory.items()
            if milestone_id in expected_milestones[gate]
        ]
        if packages != expected_packages:
            errors.append(
                f"{gate}: blocked package map drift; expected "
                f"{len(expected_packages)} ordered package(s)"
            )
    return records


def _validate_safety_dependencies(
    packages: list[dict[str, object]], errors: list[str]
) -> None:
    by_id = {
        cast(str, record["id"]): record
        for record in packages
        if isinstance(record.get("id"), str)
    }
    for milestone in ("M21", "M22", "M23"):
        records = [
            record
            for package_id, record in by_id.items()
            if package_id.startswith(f"{milestone}-")
        ]
        for record in records:
            gates = record.get("critical_gate_prerequisites")
            milestones = record.get("milestone_prerequisites")
            if not isinstance(gates, list) or "WORKDAY_GUIDED_PRE_SUBMIT" not in gates:
                errors.append(
                    f"{record.get('id')}: production ATS work lacks Workday gate"
                )
            if not isinstance(milestones, list) or "M20" not in milestones:
                errors.append(
                    f"{record.get('id')}: production ATS work lacks M20 dependency"
                )
    m36 = [
        record for package_id, record in by_id.items() if package_id.startswith("M36-")
    ]
    for record in m36:
        milestones = record.get("milestone_prerequisites")
        accepted = record.get("accepted_milestone_prerequisites")
        if not isinstance(milestones, list) or "M35" not in milestones:
            errors.append(f"{record.get('id')}: auto-submit lacks M35 prerequisite")
        if not isinstance(accepted, list) or "M35" not in accepted:
            errors.append(
                f"{record.get('id')}: auto-submit lacks accepted M35 prerequisite"
            )
    required_m35 = {"M24", "M25", "M34"}
    m35_records = [
        record for package_id, record in by_id.items() if package_id.startswith("M35-")
    ]
    for record in m35_records:
        milestones = record.get("milestone_prerequisites")
        if not isinstance(milestones, list) or not required_m35 <= set(milestones):
            errors.append(
                f"{record.get('id')}: dry-run/pre-submit engine must remain "
                "downstream of manual review, snapshots, duplicate protection, "
                "and receipt behavior (M24/M25/M34)"
            )

    for package_id, record in by_id.items():
        if package_id.startswith("M28-"):
            gates = record.get("critical_gate_prerequisites")
            accepted = record.get("accepted_milestone_prerequisites")
            if not isinstance(gates, list) or "CROSS_PLATFORM_CORE" not in gates:
                errors.append(f"{package_id}: M28 work lacks CROSS_PLATFORM_CORE")
            if not isinstance(accepted, list) or "M27" not in accepted:
                errors.append(f"{package_id}: M28 work lacks accepted M27 prerequisite")

    for package_id, record in by_id.items():
        if package_id.startswith("M06-"):
            gates = record.get("critical_gate_prerequisites")
            if isinstance(gates, list) and "CROSS_PLATFORM_CORE" in gates:
                errors.append(
                    f"{package_id}: M06 must not require final Windows/Ubuntu "
                    "full-AI certification or CROSS_PLATFORM_CORE"
                )


def _validate_next_work(
    package_records: list[dict[str, object]],
    milestone_states: dict[str, str],
    gate_states: dict[str, str],
    status: validate_status.Status,
    errors: list[str],
) -> None:
    states = {
        cast(str, record["id"]): cast(str, record["current_state"])
        for record in package_records
        if isinstance(record.get("id"), str)
        and isinstance(record.get("current_state"), str)
    }
    in_progress = [
        package_id for package_id, state in states.items() if state == "IN_PROGRESS"
    ]
    ready = [package_id for package_id, state in states.items() if state == "READY"]
    if in_progress:
        if ready:
            errors.append(
                f"package(s) READY while {in_progress} is IN_PROGRESS: {ready}"
            )
        if status.next_ready != "NONE":
            errors.append("next READY package must be NONE while work is IN_PROGRESS")
        return

    eligible: list[str] = []
    for record in package_records:
        package_id = cast(str, record["id"])
        if states.get(package_id) not in {"NOT_STARTED", "READY"}:
            continue
        direct = cast(list[str], record["direct_package_prerequisites"])
        milestones = cast(list[str], record["milestone_prerequisites"])
        gates = cast(list[str], record["critical_gate_prerequisites"])
        accepted = cast(list[str], record["accepted_milestone_prerequisites"])
        if any(
            states.get(dependency) not in validate_status.DONE for dependency in direct
        ):
            continue
        if any(
            milestone_states.get(dependency) != "ACCEPTED" for dependency in milestones
        ):
            continue
        if any(
            milestone_states.get(dependency) != "ACCEPTED" for dependency in accepted
        ):
            continue
        if any(gate_states.get(gate) != "PASS" for gate in gates):
            continue
        eligible.append(package_id)
    expected = eligible[0] if eligible else "NONE"
    if ready != ([] if expected == "NONE" else [expected]):
        errors.append(
            f"READY package derivation drift: expected {expected}, "
            f"found {ready or 'NONE'}"
        )
    if status.next_ready != expected:
        errors.append(
            f"{STATUS_REL} next READY drift: expected {expected}, "
            f"found {status.next_ready}"
        )


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def _join(value: object) -> str:
    if not isinstance(value, list):
        return ""
    strings = [str(item) for item in value]
    return ", ".join(strings) if strings else "—"


def _evidence_display(value: object) -> str:
    if not isinstance(value, list) or not value:
        return "—"
    displays: list[str] = []
    for item in value:
        if isinstance(item, dict):
            path = item.get("path")
            heading = item.get("heading")
            displays.append(f"{path} ({heading})")
    return ", ".join(displays) if displays else "—"


def render_view(
    metadata: dict[str, object],
    requirements: list[Requirement],
    spec: validate_status.Spec,
    status: validate_status.Status,
) -> str:
    """Render the deterministic human-readable traceability view."""
    req_records = cast(list[dict[str, object]], metadata["requirements"])
    package_records = cast(list[dict[str, object]], metadata["work_packages"])
    gate_records = cast(list[dict[str, object]], metadata["critical_gates"])
    specification = cast(dict[str, object], metadata["specification"])
    review = cast(dict[str, object], metadata["review"])
    req_by_id = {cast(str, record["id"]): record for record in req_records}
    package_by_id = {cast(str, record["id"]): record for record in package_records}

    lines = [
        "# Requirements Traceability",
        "",
        (
            "> Generated by `python3 scripts/traceability.py generate`. Do not edit "
            "this view by hand; edit the canonical inputs and regenerate."
        ),
        "",
        "## Canonical sources and inventory",
        "",
        (
            f"- Specification: `{SPEC_REL}` (`{specification['id']}` v"
            f"{specification['version']})"
        ),
        f"- Reviewed metadata: `{METADATA_REL}` (schema {metadata['schema_version']})",
        f"- Live package state: `{STATUS_REL}`",
        f"- Live gate state: `{GATES_REL}` plus `docs/gates/`",
        f"- Requirements: **{len(requirements)}**",
        (
            f"- Work packages: **{len(spec.package_ids())}** across "
            f"**{len(spec.milestones)}** milestones"
        ),
        f"- Specification SHA-256: `{specification['sha256']}`",
        (
            f"- Requirement inventory SHA-256: "
            f"`{specification['requirements_inventory_sha256']}`"
        ),
        (
            f"- Work-package inventory SHA-256: "
            f"`{specification['work_packages_inventory_sha256']}`"
        ),
        (
            f"- Preserved v1.2 reviewed requirement-mapping SHA-256: "
            f"`{review['requirements_mapping_sha256']}`"
        ),
        (
            f"- Preserved v1.2 reviewed dependency-map SHA-256: "
            f"`{review['work_package_dependency_sha256']}`"
        ),
        (
            f"- Expanded v1.3 requirement-mapping SHA-256: "
            f"`{review['expanded_requirements_mapping_sha256']}`"
        ),
        (
            f"- Expanded v1.3 dependency-map SHA-256: "
            f"`{review['expanded_work_package_dependency_sha256']}`"
        ),
        (f"- v1.3 extension review state: `{review['v1_3_extension_review_state']}`"),
        "",
        (
            "The specification owns exact text, IDs, titles, and explicit milestone/"
            "gate dependencies. The JSON metadata owns reviewed requirement mappings "
            "and the fully expanded package records. The 135/260 v1.2 projection "
            "remains hash-locked. M00-W08 mechanically introduced the v1.3 delta in "
            "a provisional migration state; M00-W10 completed the human review, and "
            "all 22 new requirement mappings plus all 26 new package review records "
            "are now `REVIEWED_V1_3`. The final expanded requirement hash also locks "
            "the audited implementation/verification state, completed code/test "
            "paths, current evidence, and honesty notes. The final expanded package "
            "hash also locks primary deliverables and required automated/manual "
            "proof plans; live package state, revision, and evidence remain "
            "status-owned. Package state is copied from `PROJECT_STATUS.md` and "
            "validated for exact agreement."
        ),
        "",
        "## Deterministic next work",
        "",
        f"- Current package: `{status.header.get('Current work package:', 'UNKNOWN')}`",
        f"- Next READY package: `{status.next_ready or 'MISSING'}`",
        (
            "- Readiness rule: every milestone prerequisite must be `ACCEPTED`, every "
            "direct sequential package prerequisite must be `VERIFIED` or `ACCEPTED`, "
            "and every critical-gate prerequisite must be `PASS`."
        ),
        "",
        "## Critical-gate effects",
        "",
        "| Gate | State | Blocked milestones | Blocked packages | Report |",
        "|---|---|---|---:|---|",
    ]
    for record in gate_records:
        blocked = cast(list[str], record["blocked_packages"])
        lines.append(
            "| "
            + " | ".join(
                [
                    _escape(cast(str, record["id"])),
                    _escape(cast(str, record["current_state"])),
                    _escape(_join(record["blocked_milestones"])),
                    str(len(blocked)),
                    _escape(cast(str, record["report_path"])),
                ]
            )
            + " |"
        )

    lines.extend(
        [
            "",
            "## Requirement traceability",
            "",
            (
                "| Requirement | Exact text | Family | Owning package(s) | Planned "
                "component(s) | Automated test layer(s) | Manual/holdout evidence | "
                "Gate/release effect | Implementation | Verification | Current "
                "evidence | Mapping review | Notes |"
            ),
            "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
        ]
    )
    for requirement in requirements:
        record = req_by_id[requirement.requirement_id]
        lines.append(
            "| "
            + " | ".join(
                _escape(value)
                for value in [
                    requirement.requirement_id,
                    requirement.text,
                    requirement.family,
                    _join(record["owning_packages"]),
                    _join(record["planned_components"]),
                    _join(record["automated_test_layers"]),
                    _join(record["manual_evidence"]),
                    _join(record["gate_effects"]),
                    cast(str, record["implementation_state"]),
                    cast(str, record["verification_state"]),
                    _evidence_display(record["current_evidence"]),
                    cast(str, record["mapping_review_state"]),
                    cast(str, record["notes"]),
                ]
            )
            + " |"
        )

    lines.extend(["", "## Work-package dependency and readiness map", ""])
    for milestone_id, milestone in spec.milestones.items():
        lines.extend(
            [
                f"### {milestone_id} — {milestone.title}",
                "",
                (
                    "| Package | Exact title | State | Direct package prerequisite(s) "
                    "| Milestone prerequisite(s) | Critical gate(s) | Explicit "
                    "accepted qualifier(s) | Primary deliverable(s) | Automated "
                    "verification | Manual/browser/document/holdout/hosted evidence | "
                    "Direct downstream package(s) | Downstream milestone(s) | "
                    "Current evidence | Dependency review |"
                ),
                "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
            ]
        )
        for package_id, _ in milestone.packages:
            record = package_by_id[package_id]
            lines.append(
                "| "
                + " | ".join(
                    _escape(value)
                    for value in [
                        package_id,
                        cast(str, record["title"]),
                        cast(str, record["current_state"]),
                        _join(record["direct_package_prerequisites"]),
                        _join(record["milestone_prerequisites"]),
                        _join(record["critical_gate_prerequisites"]),
                        _join(record["accepted_milestone_prerequisites"]),
                        _join(record["primary_deliverables"]),
                        _join(record["required_automated_verification"]),
                        _join(record["required_manual_evidence"]),
                        _join(record["downstream_packages"]),
                        _join(record["downstream_milestones"]),
                        _evidence_display(record["current_evidence"]),
                        cast(str, record["dependency_review_state"]),
                    ]
                )
                + " |"
            )
        lines.append("")

    lines.extend(
        [
            "## Maintenance contract",
            "",
            (
                "1. Change requirement text, package inventory, or normative "
                "dependencies only through an explicitly reviewed "
                "canonical-specification update."
            ),
            (
                "2. Update `docs/traceability.json` in the same revision for every "
                "reviewed ownership, plan, state, dependency, or evidence change."
            ),
            (
                "3. Preserve legacy records as `REVIEWED_V1_2` and the audited v1.3 "
                "delta as `REVIEWED_V1_3`; any intentional requirement mapping/"
                "honesty or package dependency/proof-plan change requires an explicit "
                "validator hash update and renewed review."
            ),
            (
                "4. Run `pnpm traceability:generate`; commit the deterministic "
                "Markdown change."
            ),
            (
                "5. Run `pnpm traceability:check`, `python3 "
                "scripts/validate_status.py`, and `pnpm verify`. Check mode is "
                "read-only and fails on any drift."
            ),
            (
                "6. Future implementation remains "
                "`NOT_STARTED`/`NOT_YET_APPLICABLE` until real code, tests, and "
                "evidence exist. Planned module/test labels are not claims that "
                "files or results already exist."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def validate_repository(
    repo: Path,
    *,
    metadata_path: Path | None = None,
    view_path: Path | None = None,
    check_view: bool = True,
) -> ValidationResult:
    errors: list[str] = []
    metadata_path = metadata_path or repo / METADATA_REL
    view_path = view_path or repo / VIEW_REL
    spec_path = repo / SPEC_REL
    status_path = repo / STATUS_REL
    for path in (metadata_path, spec_path, status_path, repo / GATES_REL):
        if not path.is_file():
            errors.append(f"required traceability input missing: {path}")
    if errors:
        return ValidationResult(errors=errors)
    try:
        metadata = _load_json_object(metadata_path)
        requirements = parse_requirements(spec_path)
        spec = validate_status.parse_spec(spec_path)
        milestone_states, package_status, gate_states, status = _status_maps(repo)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return ValidationResult(errors=[f"cannot parse traceability inputs: {exc}"])

    _check_keys(metadata, TOP_LEVEL_KEYS, "traceability root", errors)
    if metadata.get("schema_version") != SCHEMA_VERSION:
        errors.append(
            f"schema_version must be {SCHEMA_VERSION}, "
            f"found {metadata.get('schema_version')!r}"
        )
    if len(requirements) != EXPECTED_REQUIREMENTS:
        errors.append(
            f"canonical specification contains {len(requirements)} requirement "
            f"records (expected {EXPECTED_REQUIREMENTS})"
        )
    canonical_new_requirements = {
        item.requirement_id
        for item in requirements
        if item.requirement_id in NEW_REQUIREMENT_IDS
    }
    if canonical_new_requirements != NEW_REQUIREMENT_IDS:
        errors.append(
            "canonical v1.3 platform requirement delta drift: expected exactly "
            f"{sorted(NEW_REQUIREMENT_IDS)}, found {sorted(canonical_new_requirements)}"
        )
    requirement_ids = [item.requirement_id for item in requirements]
    duplicate_spec_requirements = sorted(
        requirement_id
        for requirement_id, count in Counter(requirement_ids).items()
        if count > 1
    )
    if duplicate_spec_requirements:
        errors.append(
            f"canonical specification duplicates requirement(s): "
            f"{duplicate_spec_requirements}"
        )
    all_spec_ids = REQ_ANY_RE.findall(spec_path.read_text(encoding="utf-8"))
    if set(all_spec_ids) != set(requirement_ids):
        errors.append(
            "canonical requirement inventory outside §4 disagrees with the "
            "requirements catalog"
        )
    if len(spec.package_ids()) != EXPECTED_PACKAGES:
        errors.append(
            f"canonical specification contains {len(spec.package_ids())} work "
            f"packages (expected {EXPECTED_PACKAGES})"
        )
    canonical_new_packages = set(spec.package_ids()) & NEW_PACKAGE_IDS
    if canonical_new_packages != NEW_PACKAGE_IDS:
        errors.append(
            "canonical v1.3 work-package delta drift: expected exactly "
            f"{sorted(NEW_PACKAGE_IDS)}, found {sorted(canonical_new_packages)}"
        )
    if list(spec.milestones) != [f"M{number:02d}" for number in range(39)]:
        errors.append("canonical milestone inventory/order must be exactly M00…M38")
    if _sha256_bytes(spec_path.read_bytes()) != validate_status.EXPECTED_SPEC_SHA256:
        errors.append("canonical v1.3 specification hash is not owner-approved hash")

    canonical_report = validate_status.Report()
    validate_status.check_single_canonical_spec(repo, canonical_report)
    errors.extend(canonical_report.errors)

    _validate_specification(metadata, spec_path, requirements, spec, errors)
    _validate_enums(metadata, errors)
    _validate_policy(metadata, errors)
    package_inventory, _, _ = _expected_package_records(spec)
    requirement_records = _validate_requirements(
        metadata,
        requirements,
        package_inventory,
        package_status,
        repo,
        errors,
    )
    package_records = _validate_packages(
        metadata,
        spec,
        milestone_states,
        package_status,
        gate_states,
        repo,
        errors,
    )
    _validate_gates(
        metadata,
        spec,
        gate_states,
        package_inventory,
        repo,
        errors,
    )
    _validate_safety_dependencies(package_records, errors)
    _validate_review(metadata, requirement_records, package_records, errors)
    _validate_next_work(package_records, milestone_states, gate_states, status, errors)

    expected_view: str | None = None
    if not errors:
        expected_view = render_view(metadata, requirements, spec, status)
        if check_view:
            if not view_path.is_file():
                errors.append(f"generated traceability view missing: {view_path}")
            elif view_path.read_text(encoding="utf-8") != expected_view:
                errors.append(
                    f"{VIEW_REL} disagrees with canonical inputs; run "
                    "`pnpm traceability:generate`"
                )
    return ValidationResult(
        errors=errors,
        requirement_count=len(requirement_records),
        package_count=len(package_records),
        expected_view=expected_view,
    )


def _report(result: ValidationResult, *, quiet: bool) -> int:
    if result.errors:
        for error in result.errors:
            print(f"FAIL: {error}")
        print(f"FAIL: traceability validation found {len(result.errors)} error(s)")
        return 1
    message = (
        f"PASS: traceability validated {result.requirement_count} requirements "
        f"and {result.package_count} work packages"
    )
    if not quiet:
        print(message)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("check", "generate"))
    parser.add_argument("--repo", default=".")
    parser.add_argument("--metadata", default=None)
    parser.add_argument("--output", default=None)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)
    repo = Path(args.repo).resolve()
    metadata_path = Path(args.metadata).resolve() if args.metadata else None
    view_path = Path(args.output).resolve() if args.output else repo / VIEW_REL
    result = validate_repository(
        repo,
        metadata_path=metadata_path,
        view_path=view_path,
        check_view=args.command == "check",
    )
    if not result.ok:
        return _report(result, quiet=args.quiet)
    if args.command == "generate":
        if result.expected_view is None:
            print("FAIL: generator produced no view")
            return 1
        # newline="\n" keeps the generated view byte-identical on every
        # platform (Windows default text mode would write CRLF).
        view_path.write_text(result.expected_view, encoding="utf-8", newline="\n")
    return _report(result, quiet=args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
