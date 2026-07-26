"""M00-W08 traceability inventory, dependency, honesty, and drift tests.

Every negative case mutates an isolated docs/scripts fixture. The tracked
project-memory files are read-only except for the explicit deterministic
generation test against the real repository.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import cast

import pytest
import traceability
from conftest import REPO_ROOT

FAKE_TREE = "tree " + "0" * 40


@pytest.fixture
def trace_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    shutil.copytree(REPO_ROOT / "docs", repo / "docs")
    (repo / "scripts" / "tests").mkdir(parents=True)
    shutil.copy2(
        REPO_ROOT / "scripts" / "validate_status.py",
        repo / "scripts" / "validate_status.py",
    )
    shutil.copy2(
        REPO_ROOT / "scripts" / "traceability.py",
        repo / "scripts" / "traceability.py",
    )
    shutil.copy2(
        REPO_ROOT / "scripts" / "tests" / "test_validate_status.py",
        repo / "scripts" / "tests" / "test_validate_status.py",
    )
    shutil.copy2(
        REPO_ROOT / "scripts" / "tests" / "test_traceability.py",
        repo / "scripts" / "tests" / "test_traceability.py",
    )
    return repo


def load_metadata(repo: Path) -> dict[str, object]:
    raw: object = json.loads(
        (repo / traceability.METADATA_REL).read_text(encoding="utf-8")
    )
    assert isinstance(raw, dict)
    return cast(dict[str, object], raw)


def save_metadata(repo: Path, metadata: dict[str, object]) -> None:
    (repo / traceability.METADATA_REL).write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def records(metadata: dict[str, object], key: str) -> list[dict[str, object]]:
    value = metadata[key]
    assert isinstance(value, list)
    assert all(isinstance(item, dict) for item in value)
    return cast(list[dict[str, object]], value)


def record_by_id(
    metadata: dict[str, object], key: str, record_id: str
) -> dict[str, object]:
    matches = [record for record in records(metadata, key) if record["id"] == record_id]
    assert len(matches) == 1
    return matches[0]


def errors(repo: Path, *, check_view: bool = False) -> str:
    result = traceability.validate_repository(repo, check_view=check_view)
    return "\n".join(result.errors)


def replace_status(repo: Path, pattern: str, replacement: str) -> None:
    path = repo / traceability.STATUS_REL
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    assert count == 1, pattern
    path.write_text(updated, encoding="utf-8")


def set_package_status(
    repo: Path,
    package_id: str,
    state: str,
    *,
    revision: str = "—",
    evidence: str = "—",
) -> None:
    row = (
        f"| `{package_id}` | {state} | {revision} | {evidence} | traceability fixture |"
    )
    replace_status(repo, rf"^\| `{package_id}` \|[^\n]*$", row)


def set_metadata_package(
    metadata: dict[str, object],
    package_id: str,
    state: str,
    *,
    revision: str = "—",
    evidence: bool = False,
) -> None:
    package = record_by_id(metadata, "work_packages", package_id)
    package["current_state"] = state
    package["verified_revision"] = revision
    package["current_evidence"] = (
        [{"path": "docs/TEST_EVIDENCE.md", "heading": f"### {package_id}"}]
        if evidence
        else []
    )


def prepare_valid_m00_closeout(repo: Path) -> dict[str, object]:
    """Create a valid future post-M00-W10 state in an isolated fixture."""
    metadata = load_metadata(repo)
    evidence = repo / "docs" / "TEST_EVIDENCE.md"
    with evidence.open("a", encoding="utf-8") as handle:
        for package_id in ("M00-W08", "M00-W09", "M00-W10"):
            handle.write(f"\n### {package_id} — traceability closeout fixture\n")
    for package_id in ("M00-W08", "M00-W09", "M00-W10"):
        set_package_status(
            repo,
            package_id,
            "VERIFIED",
            revision=FAKE_TREE,
            evidence=f"docs/TEST_EVIDENCE.md § {package_id}",
        )
        set_metadata_package(
            metadata,
            package_id,
            "VERIFIED",
            revision=FAKE_TREE,
            evidence=True,
        )
    set_package_status(repo, "M01-W01", "READY")
    set_metadata_package(metadata, "M01-W01", "READY")
    replace_status(repo, r"^Current work package: .*$", "Current work package: NONE")
    replace_status(repo, r"^\| M00 \|[^\n]*$", "| M00 | ACCEPTED | — | fixture |")
    replace_status(repo, r"^\| M01 \|[^\n]*$", "| M01 | READY | — | fixture |")
    replace_status(repo, r"^- ID: .*$", "- ID: `M01-W01`")
    save_metadata(repo, metadata)
    return metadata


def test_real_repository_has_exact_inventories_and_clean_generated_view() -> None:
    result = traceability.validate_repository(REPO_ROOT)
    assert result.ok, "\n".join(result.errors)
    assert result.requirement_count == 157
    assert result.package_count == 286


def test_every_id_is_unique_and_every_future_claim_is_honest() -> None:
    metadata = load_metadata(REPO_ROOT)
    requirement_ids = [record["id"] for record in records(metadata, "requirements")]
    package_ids = [record["id"] for record in records(metadata, "work_packages")]
    assert len(requirement_ids) == len(set(requirement_ids)) == 157
    assert len(package_ids) == len(set(package_ids)) == 286
    for requirement in records(metadata, "requirements"):
        if requirement["implementation_state"] == "NOT_STARTED":
            assert requirement["verification_state"] == "NOT_YET_APPLICABLE"
            assert requirement["completed_code_paths"] == []
            assert requirement["completed_test_paths"] == []
            assert requirement["current_evidence"] == []


def test_v13_delta_and_preserved_v12_hashes_are_exact() -> None:
    metadata = load_metadata(REPO_ROOT)
    requirement_ids = {
        cast(str, record["id"]) for record in records(metadata, "requirements")
    }
    package_ids = {
        cast(str, record["id"]) for record in records(metadata, "work_packages")
    }
    assert requirement_ids & traceability.NEW_REQUIREMENT_IDS == (
        traceability.NEW_REQUIREMENT_IDS
    )
    assert package_ids & traceability.NEW_PACKAGE_IDS == traceability.NEW_PACKAGE_IDS
    assert len(requirement_ids - traceability.NEW_REQUIREMENT_IDS) == 135
    assert len(package_ids - traceability.NEW_PACKAGE_IDS) == 260
    review = cast(dict[str, object], metadata["review"])
    assert review["requirements_mapping_sha256"] == (
        traceability.PRESERVED_REQUIREMENT_MAPPING_SHA256
    )
    assert review["work_package_dependency_sha256"] == (
        traceability.PRESERVED_PACKAGE_DEPENDENCY_SHA256
    )


def test_adopted_spec_hash_schema_and_gate_inventory_are_exact() -> None:
    metadata = load_metadata(REPO_ROOT)
    spec_path = REPO_ROOT / traceability.SPEC_REL
    assert hashlib.sha256(spec_path.read_bytes()).hexdigest() == (
        "fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867"
    )
    assert metadata["schema_version"] == 2
    gate_ids = [record["id"] for record in records(metadata, "critical_gates")]
    assert gate_ids == [
        "AUTOFILL_FEASIBILITY",
        "RESUME_PAGEFIT_FEASIBILITY",
        "WORKDAY_GUIDED_PRE_SUBMIT",
        "CROSS_PLATFORM_CORE",
    ]


def test_new_records_are_visibly_provisional_and_future_honest() -> None:
    metadata = load_metadata(REPO_ROOT)
    for record in records(metadata, "requirements"):
        if record["id"] in traceability.NEW_REQUIREMENT_IDS:
            assert record["mapping_review_state"] == ("PROVISIONAL_PENDING_M00_W10")
            if record["id"] not in (traceability.M00_W08_GOVERNANCE_REQUIREMENT_IDS):
                assert record["implementation_state"] == "NOT_STARTED"
                assert record["verification_state"] == "NOT_YET_APPLICABLE"
                assert record["current_evidence"] == []
    for record in records(metadata, "work_packages"):
        if record["id"] in traceability.NEW_PACKAGE_IDS:
            assert record["dependency_review_state"] == ("PROVISIONAL_PENDING_M00_W10")


def test_verified_m00_requirements_have_real_code_test_and_evidence_links() -> None:
    metadata = load_metadata(REPO_ROOT)
    verified = {
        cast(str, record["id"])
        for record in records(metadata, "requirements")
        if record["implementation_state"] == "VERIFIED"
    }
    assert verified == {
        "REQ-RES-017",
        "REQ-FORM-022",
        "REQ-WD-001",
        "REQ-GATE-001",
        "REQ-GATE-005",
        "REQ-GATE-014",
        "REQ-PLAT-011",
        "REQ-GATE-017",
        "REQ-GATE-018",
    }
    legacy_verified = verified - traceability.M00_W08_GOVERNANCE_REQUIREMENT_IDS
    for requirement_id in legacy_verified:
        record = record_by_id(metadata, "requirements", requirement_id)
        assert record["completed_code_paths"] == ["scripts/validate_status.py"]
        assert record["completed_test_paths"] == [
            "scripts/tests/test_validate_status.py"
        ]
        assert record["current_evidence"] == [
            {"path": "docs/TEST_EVIDENCE.md", "heading": "### M00-W05"}
        ]
    for requirement_id in traceability.M00_W08_GOVERNANCE_REQUIREMENT_IDS:
        record = record_by_id(metadata, "requirements", requirement_id)
        assert record["completed_code_paths"]
        assert record["completed_test_paths"]
        assert record["current_evidence"] == [
            {"path": "docs/TEST_EVIDENCE.md", "heading": "### M00-W08"}
        ]


def test_missing_requirement_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    records(metadata, "requirements").pop()
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "missing canonical requirement" in output
    assert "expected 157" in output


def test_missing_platform_requirement_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    requirements = records(metadata, "requirements")
    requirements[:] = [
        record for record in requirements if record["id"] != "REQ-PLAT-026"
    ]
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "REQ-PLAT-026" in output
    assert "missing canonical requirement" in output


def test_duplicate_requirement_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    requirement_records = records(metadata, "requirements")
    requirement_records.append(copy.deepcopy(requirement_records[0]))
    save_metadata(trace_repo, metadata)
    assert "duplicate requirement record" in errors(trace_repo)


def test_unknown_requirement_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-PROF-001")["id"] = "REQ-FAKE-999"
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "unknown requirement record" in output
    assert "missing canonical requirement" in output


def test_requirement_text_drift_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-PROF-001")["text"] = "Drifted."
    save_metadata(trace_repo, metadata)
    assert "REQ-PROF-001: requirement text drift" in errors(trace_repo)


def test_unknown_requirement_owner_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-PROF-001")["owning_packages"] = [
        "M99-W99"
    ]
    save_metadata(trace_repo, metadata)
    assert "unknown owning package M99-W99" in errors(trace_repo)


def test_valid_owner_change_requires_explicit_review_hash_update(
    trace_repo: Path,
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-PROF-001")["owning_packages"] = [
        "M06-W02"
    ]
    save_metadata(trace_repo, metadata)
    assert "requirements_mapping_sha256 drift" in errors(trace_repo)


def test_missing_work_package_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    records(metadata, "work_packages").pop()
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "missing canonical work-package record" in output
    assert "expected 286" in output


def test_missing_platform_work_package_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    packages = records(metadata, "work_packages")
    packages[:] = [record for record in packages if record["id"] != "M27-W12"]
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "M27-W12" in output
    assert "missing canonical work-package record" in output


def test_duplicate_work_package_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    package_records = records(metadata, "work_packages")
    package_records.append(copy.deepcopy(package_records[0]))
    save_metadata(trace_repo, metadata)
    assert "duplicate work-package record" in errors(trace_repo)


def test_unknown_work_package_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M38-W07")["id"] = "M99-W99"
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "unknown work-package record" in output
    assert "missing canonical work-package record" in output


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("title", "Wrong title", "wrong package title"),
        ("milestone", "M01", "wrong milestone"),
    ],
)
def test_package_title_or_milestone_drift_fails(
    trace_repo: Path, field: str, value: str, message: str
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M00-W01")[field] = value
    save_metadata(trace_repo, metadata)
    assert message in errors(trace_repo)


def test_unknown_package_dependency_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M00-W02")[
        "direct_package_prerequisites"
    ] = ["M99-W99"]
    save_metadata(trace_repo, metadata)
    assert "dependency references unknown package M99-W99" in errors(trace_repo)


def test_package_dependency_cycle_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M00-W01")[
        "direct_package_prerequisites"
    ] = ["M00-W07"]
    save_metadata(trace_repo, metadata)
    assert "work-package dependency cycle" in errors(trace_repo)


def test_wrong_workday_gate_dependencies_fail(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M21-W01")[
        "critical_gate_prerequisites"
    ] = []
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "M21-W01: critical-gate prerequisites drift" in output
    assert "production ATS work lacks Workday gate" in output


def test_wrong_cross_platform_gate_dependencies_fail(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M28-W01")[
        "critical_gate_prerequisites"
    ] = []
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "M28-W01: critical-gate prerequisites drift" in output
    assert "M28-W01: M28 work lacks CROSS_PLATFORM_CORE" in output


def test_m06_has_no_cross_platform_gate_prerequisite() -> None:
    metadata = load_metadata(REPO_ROOT)
    for record in records(metadata, "work_packages"):
        if cast(str, record["id"]).startswith("M06-"):
            assert "CROSS_PLATFORM_CORE" not in cast(
                list[str], record["critical_gate_prerequisites"]
            )


@pytest.mark.parametrize(
    ("package_id", "gate"),
    [
        ("M03-W01", "AUTOFILL_FEASIBILITY"),
        ("M06-W01", "RESUME_PAGEFIT_FEASIBILITY"),
        ("M21-W01", "WORKDAY_GUIDED_PRE_SUBMIT"),
    ],
)
def test_critical_gate_readiness_rules_remain_enforced(
    trace_repo: Path, package_id: str, gate: str
) -> None:
    metadata = load_metadata(trace_repo)
    set_package_status(trace_repo, package_id, "READY")
    set_metadata_package(metadata, package_id, "READY")
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert f"{package_id} is READY before critical gate {gate} is PASS" in output


def test_false_future_implementation_claim_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    requirement = record_by_id(metadata, "requirements", "REQ-PROF-001")
    requirement["implementation_state"] = "VERIFIED"
    requirement["verification_state"] = "VERIFIED"
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "completed requirement requires real code, test, and evidence" in output
    assert "no verified/accepted owning package" in output


def test_false_new_platform_implementation_claim_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    requirement = record_by_id(metadata, "requirements", "REQ-PLAT-026")
    requirement["implementation_state"] = "VERIFIED"
    requirement["verification_state"] = "VERIFIED"
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "completed requirement requires real code, test, and evidence" in output


def test_legacy_mapping_cannot_be_silently_reclassified(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-PROF-001")["mapping_review_state"] = (
        "PROVISIONAL_PENDING_M00_W10"
    )
    save_metadata(trace_repo, metadata)
    assert "mapping review state must be REVIEWED_V1_2" in errors(trace_repo)


@pytest.mark.parametrize(
    ("field", "message"),
    [
        ("completed_code_paths", "completed code path does not exist"),
        ("completed_test_paths", "completed test path does not exist"),
    ],
)
def test_missing_completed_path_fails(
    trace_repo: Path, field: str, message: str
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-GATE-005")[field] = ["missing/path.py"]
    save_metadata(trace_repo, metadata)
    assert message in errors(trace_repo)


def test_missing_evidence_heading_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-GATE-005")["current_evidence"] = [
        {"path": "docs/TEST_EVIDENCE.md", "heading": "### DOES-NOT-EXIST"}
    ]
    save_metadata(trace_repo, metadata)
    assert "references missing evidence heading" in errors(trace_repo)


def test_missing_critical_gate_report_fails(trace_repo: Path) -> None:
    (trace_repo / "docs" / "gates" / "WORKDAY_GUIDED_PRE_SUBMIT_GATE.md").unlink()
    assert "critical-gate report path does not exist" in errors(trace_repo)


def test_missing_cross_platform_gate_record_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    gates = records(metadata, "critical_gates")
    gates[:] = [record for record in gates if record["id"] != "CROSS_PLATFORM_CORE"]
    save_metadata(trace_repo, metadata)
    assert "missing critical-gate record" in errors(trace_repo)


def test_duplicate_cross_platform_gate_record_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    gate = record_by_id(metadata, "critical_gates", "CROSS_PLATFORM_CORE")
    records(metadata, "critical_gates").append(copy.deepcopy(gate))
    save_metadata(trace_repo, metadata)
    assert "duplicate critical-gate record" in errors(trace_repo)


def test_human_machine_traceability_drift_fails(trace_repo: Path) -> None:
    view = trace_repo / traceability.VIEW_REL
    view.write_text(
        view.read_text(encoding="utf-8") + "\nmanual drift\n", encoding="utf-8"
    )
    assert "disagrees with canonical inputs" in errors(trace_repo, check_view=True)


def test_regeneration_is_deterministic_and_check_is_read_only() -> None:
    view = REPO_ROOT / traceability.VIEW_REL
    before = view.read_bytes()
    first = traceability.validate_repository(REPO_ROOT)
    second = traceability.validate_repository(REPO_ROOT)
    assert first.ok
    assert second.ok
    assert first.expected_view == second.expected_view
    assert view.read_bytes() == before


def test_multiple_canonical_specifications_fail_traceability(
    trace_repo: Path,
) -> None:
    shutil.copy2(
        trace_repo / traceability.SPEC_REL,
        trace_repo / "docs" / "MASTER_IMPLEMENTATION_SPEC.v1.3.proposed.md",
    )
    assert "second canonical-looking specification" in errors(trace_repo)


def test_spec_inventory_change_without_metadata_update_fails(trace_repo: Path) -> None:
    spec = trace_repo / traceability.SPEC_REL
    text = spec.read_text(encoding="utf-8")
    spec.write_text(
        text.replace(
            "Store canonical profile facts separately from generated text.",
            "Drifted canonical text.",
            1,
        ),
        encoding="utf-8",
    )
    output = errors(trace_repo)
    assert "specification.sha256 drift" in output
    assert "requirements_inventory_sha256 drift" in output


def test_m01_w01_cannot_be_ready_before_m00_is_accepted(
    trace_repo: Path,
) -> None:
    prepare_valid_m00_closeout(trace_repo)
    replace_status(trace_repo, r"^\| M00 \|[^\n]*$", "| M00 | VERIFIED | — | fixture |")
    assert "M01-W01 is READY before milestone M00 is ACCEPTED" in errors(trace_repo)


def test_m01_w01_is_the_only_valid_ready_package_after_m00_acceptance(
    trace_repo: Path,
) -> None:
    prepare_valid_m00_closeout(trace_repo)
    result = traceability.validate_repository(trace_repo, check_view=False)
    assert result.ok, "\n".join(result.errors)
    metadata = load_metadata(trace_repo)
    ready = [
        record["id"]
        for record in records(metadata, "work_packages")
        if record["current_state"] == "READY"
    ]
    assert ready == ["M01-W01"]


def test_no_other_m01_package_can_become_prematurely_ready(
    trace_repo: Path,
) -> None:
    metadata = prepare_valid_m00_closeout(trace_repo)
    set_package_status(trace_repo, "M01-W02", "READY")
    set_metadata_package(metadata, "M01-W02", "READY")
    save_metadata(trace_repo, metadata)
    assert "M01-W02 is READY before direct prerequisite M01-W01 is verified" in errors(
        trace_repo
    )
