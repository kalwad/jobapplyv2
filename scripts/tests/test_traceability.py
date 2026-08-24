"""M00-W11 reviewed v1.4 traceability, honesty, dependency, and drift tests.

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
    for relative_path in (
        ".gitattributes",
        ".github/workflows/ci.yml",
        "scripts/check_portability.py",
        "scripts/doctor.py",
        "scripts/portability.py",
        "scripts/verify.py",
        "scripts/tests/test_ci_workflow.py",
        "scripts/tests/test_doctor.py",
        "scripts/tests/test_portability.py",
        "scripts/tests/test_v14_migration.py",
        # M01-W01/M01-W02 REQ-PLAT-005 completed-path anchors (schema
        # versioning + generated-model version propagation); the fixture
        # repo must contain every referenced file.
        "packages/contracts/README.md",
        "packages/contracts/generated/MANIFEST.json",
        "packages/contracts/generator/generate.ts",
        "packages/contracts/schemas/common/envelope.v1.schema.json",
        "packages/contracts/schemas/common/schema-version.v1.schema.json",
        "packages/contracts/src/conventions.ts",
        "packages/contracts/src/envelope.ts",
        "packages/contracts/src/versioning.ts",
        "packages/contracts/test/schema/conventions.test.ts",
        "packages/contracts/test/schema/envelope.test.ts",
        "packages/contracts/test/generated/generator.test.ts",
        "scripts/generate-contracts.ts",
        "scripts/tests/test_generated_contracts.py",
        # M01-W06 REQ-GATE-006 completed-path anchors (benchmark/holdout/gate
        # record contracts and finite semantic validation); isolated
        # traceability fixtures must contain every canonical referenced path.
        "packages/contracts/catalog/semantic-rules.v1.json",
        "packages/contracts/schemas/benchmark/case.v1.schema.json",
        "packages/contracts/schemas/benchmark/holdout-manifest.v1.schema.json",
        "packages/contracts/schemas/benchmark/result.v1.schema.json",
        "packages/contracts/schemas/gate/decision.v1.schema.json",
        "packages/contracts/schemas/gate/evidence-bundle.v1.schema.json",
        "packages/contracts/test/contract/corpus/cases.v1.json",
        "packages/contracts/test/contract/semantic-adapters.test.ts",
        "packages/contracts/test/generated/semantic-rules.test.ts",
        "scripts/tests/test_generated_semantic_rules.py",
        # M02-W05 REQ-GATE-006 completed-path anchors (deterministic runner,
        # provenance, aggregation, reports, and synthetic-only proof), plus
        # the proleptic-UTC correction's shared derivation/timestamp authority
        # and its permanent replay/regression/measurement regression tests.
        "packages/evaluation-runner/src/model.ts",
        "packages/evaluation-runner/src/runner.ts",
        "packages/evaluation-runner/src/derive.ts",
        "packages/evaluation-runner/src/time.ts",
        "packages/evaluation-runner/src/aggregate.ts",
        "packages/evaluation-runner/src/report.ts",
        "packages/evaluation-runner/test/m02-w05/runner.test.ts",
        "packages/evaluation-runner/test/m02-w05/aggregation-statistics.test.ts",
        "packages/evaluation-runner/test/m02-w05/reports.test.ts",
        "packages/evaluation-runner/test/m02-w05/validation-boundaries.test.ts",
        "packages/evaluation-runner/test/m02-w05/w04-integration.test.ts",
        "packages/evaluation-runner/test/m02-w05/mutations.test.ts",
        "packages/evaluation-runner/test/m02-w05/replay-source.test.ts",
        "packages/evaluation-runner/test/m02-w05/regression-source.test.ts",
        "packages/evaluation-runner/test/m02-w05/measurement-boundaries.test.ts",
        # M02-W06 REQ-GATE-002/006/010 completed-path anchors (frozen public
        # corpus, owner-external holdout boundary, exact identity propagation,
        # immutable correction/version history, and append-only log proof).
        "packages/evaluation-corpus/src/corpus.ts",
        "packages/evaluation-corpus/src/owner-holdout.ts",
        "packages/evaluation-corpus/src/log.ts",
        "packages/evaluation-corpus/schemas/owner-mapping.v1.schema.json",
        "packages/evaluation-corpus/schemas/owner-mapping.v2.schema.json",
        "packages/evaluation-corpus/policies/holdout-boundary.v1.json",
        "packages/evaluation-corpus/policies/holdout-boundary.v2.json",
        "packages/evaluation-corpus/policies/change-policy.v1.json",
        "packages/evaluation-corpus/artifacts/development/corpus-versions.v1.json",
        "packages/evaluation-corpus/test/m02-w06/corpus-freeze.test.ts",
        "packages/evaluation-corpus/test/m02-w06/holdout-boundary.test.ts",
        "packages/evaluation-corpus/test/m02-w06/artifact-preimage-correction.test.ts",
        "packages/evaluation-corpus/test/m02-w06/version-log-runner.test.ts",
        "packages/evaluation-corpus/test/m02-w06/mutation-campaign.test.ts",
        "benchmarks/holdout-manifests/status.v1.json",
        # M01-W07 REQ-PLAT-012 completed-path anchors (typed cross-platform
        # capability and platform-service contracts).
        "packages/contracts/generator/semantic-rules.ts",
        "packages/contracts/schemas/platform/capability-report.v1.schema.json",
        "packages/contracts/schemas/platform/path-request.v1.schema.json",
        "packages/contracts/schemas/platform/process-plan.v1.schema.json",
        "packages/contracts/schemas/platform/secret-store-request.v1.schema.json",
        "packages/contracts/schemas/platform/vocabulary.v1.schema.json",
        "packages/contracts/test/contract/breaking.test.ts",
        "packages/contracts/test/schema/w07-platform.test.ts",
        "scripts/tests/test_generated_platform_contracts.py",
        # M02-W04 REQ-GATE-007/REQ-GATE-008 completed-path anchors (isolated
        # legacy-baseline observation contract and truthful records).
        "packages/evaluation-baselines/src/legacy-observation.ts",
        "packages/evaluation-baselines/data/legacy-observations.v1.json",
        "packages/evaluation-baselines/test/m02-w04/legacy-observation.test.ts",
        "packages/evaluation-baselines/test/m02-w04/mutations.test.ts",
        # M02-W07 REQ-FORM-020 completed-path anchors (real MV3 feasibility
        # substrate: WXT config, entrypoints, closed probe protocol, and the
        # real-extension Playwright harness with its fail-closed tests).
        "apps/extension/wxt.config.ts",
        "apps/extension/entrypoints/background.ts",
        "apps/extension/entrypoints/feasibility.content.ts",
        "apps/extension/src/feasibility-protocol.ts",
        "apps/extension/test/m02-w07/feasibility-protocol.test.ts",
        "apps/extension/test/m02-w07/built-manifest.test.ts",
        "apps/extension/test/m02-w07/fixtures/invalid-ack/wxt.config.ts",
        "apps/extension/test/m02-w07/fixtures/invalid-ack/entrypoints/background.ts",
        "apps/extension/test/m02-w07/fixtures/invalid-ack/entrypoints/feasibility.content.ts",
        "e2e/extension/support/global-setup.ts",
        "e2e/extension/support/extension-test.ts",
        "e2e/extension/extension-ack-causality.spec.ts",
        "e2e/extension/extension-observable-surface.spec.ts",
        "e2e/extension/extension-protocol-closure.spec.ts",
        "e2e/extension/extension-substrate.spec.ts",
        "e2e/extension/extension-probe.spec.ts",
        "e2e/extension/extension-inert.spec.ts",
        # M02-W08 REQ-FORM-013/014/019 feasibility anchors (canonical field
        # identity/descriptor, closed scanner protocol, bounded frame-local
        # scanner, and real built-extension browser proof).
        "apps/extension/src/semantic-identity.ts",
        "apps/extension/src/scanner-protocol.ts",
        "apps/extension/src/field-scanner.ts",
        "apps/extension/test/m02-w08/scanner-protocol.test.ts",
        "e2e/extension/extension-scanner.spec.ts",
        # M02-W09 REQ-FORM-017/023 feasibility anchors (deterministic
        # decision/proposal policy, semantic option matching, and real built
        # descriptor-to-decision browser proof).
        "packages/form-engine/src/ai-proposal.ts",
        "packages/form-engine/src/decision-resolver.ts",
        "packages/form-engine/src/safety-policy.ts",
        "packages/form-engine/src/ontology.ts",
        "packages/form-engine/src/option-resolver.ts",
        "packages/form-engine/test/ai-proposal.test.ts",
        "packages/form-engine/test/decision-resolver.test.ts",
        "packages/form-engine/test/option-resolver.test.ts",
        "e2e/extension/extension-resolver.spec.ts",
    ):
        source = REPO_ROOT / relative_path
        destination = repo / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
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


def refresh_v1_4_requirement_hash(metadata: dict[str, object]) -> None:
    rows = traceability._expanded_requirement_review_rows(
        records(metadata, "requirements")
    )
    review = cast(dict[str, object], metadata["review"])
    review["v1_4_requirements_mapping_sha256"] = traceability._inventory_hash(rows)


def refresh_v1_4_dependency_hash(metadata: dict[str, object]) -> None:
    rows = traceability._expanded_package_review_rows(
        records(metadata, "work_packages")
    )
    review = cast(dict[str, object], metadata["review"])
    review["v1_4_work_package_dependency_sha256"] = traceability._inventory_hash(rows)


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
    """Create a valid future post-M00-W11 state in an isolated fixture.

    M00-W01…W10 and M01-W01…W06 remain immutable verified anchors.
    M00-W11 becomes verified, M00 is accepted, and M01-W07 is sole READY.
    """
    metadata = load_metadata(repo)
    evidence = repo / "docs" / "TEST_EVIDENCE.md"
    with evidence.open("a", encoding="utf-8") as handle:
        handle.write("\n### M00-W11 — traceability closeout fixture\n")
    set_package_status(
        repo,
        "M00-W11",
        "VERIFIED",
        revision=FAKE_TREE,
        evidence="docs/TEST_EVIDENCE.md § M00-W11",
    )
    set_metadata_package(
        metadata,
        "M00-W11",
        "VERIFIED",
        revision=FAKE_TREE,
        evidence=True,
    )
    set_package_status(repo, "M01-W07", "READY")
    set_metadata_package(metadata, "M01-W07", "READY")
    # Complete the premise rather than inherit it: packages and milestones
    # after this boundary legitimately advance as the project progresses, and
    # an inherited READY/VERIFIED row would silently change what the boundary
    # test asserts (the KI-0014/KI-0015/KI-0017/KI-0019 class).
    for record in records(metadata, "work_packages"):
        package_id = cast(str, record["id"])
        if package_id > "M01-W07" and record["current_state"] != "NOT_STARTED":
            set_package_status(repo, package_id, "NOT_STARTED")
            set_metadata_package(metadata, package_id, "NOT_STARTED")
    for milestone in ("M02",):
        replace_status(
            repo,
            rf"^\| {milestone} \|[^\n]*$",
            f"| {milestone} | NOT_STARTED | — | fixture |",
        )
    replace_status(repo, r"^Current milestone: .*$", "Current milestone: M01")
    replace_status(repo, r"^Current work package: .*$", "Current work package: NONE")
    replace_status(
        repo,
        r"^\| M00 \|[^\n]*$",
        f"| M00 | ACCEPTED | {FAKE_TREE} | fixture |",
    )
    replace_status(repo, r"^\| M01 \|[^\n]*$", "| M01 | IN_PROGRESS | — | fixture |")
    replace_status(repo, r"^- ID: .*$", "- ID: `M01-W07`")
    save_metadata(repo, metadata)
    return metadata


def test_real_repository_has_exact_inventories_and_clean_generated_view() -> None:
    result = traceability.validate_repository(REPO_ROOT)
    assert result.ok, "\n".join(result.errors)
    assert result.requirement_count == 193
    assert result.package_count == 300


def test_every_id_is_unique_and_every_future_claim_is_honest() -> None:
    metadata = load_metadata(REPO_ROOT)
    requirement_ids = [record["id"] for record in records(metadata, "requirements")]
    package_ids = [record["id"] for record in records(metadata, "work_packages")]
    assert len(requirement_ids) == len(set(requirement_ids)) == 193
    assert len(package_ids) == len(set(package_ids)) == 300
    for requirement in records(metadata, "requirements"):
        if requirement["implementation_state"] == "NOT_STARTED":
            assert requirement["verification_state"] == "NOT_YET_APPLICABLE"
            assert requirement["completed_code_paths"] == []
            assert requirement["completed_test_paths"] == []
            assert requirement["current_evidence"] == []


def test_v14_delta_and_preserved_v12_v13_hashes_are_exact() -> None:
    metadata = load_metadata(REPO_ROOT)
    requirement_ids = {
        cast(str, record["id"]) for record in records(metadata, "requirements")
    }
    package_ids = {
        cast(str, record["id"]) for record in records(metadata, "work_packages")
    }
    assert requirement_ids & traceability.V1_4_NEW_REQUIREMENT_IDS == (
        traceability.V1_4_NEW_REQUIREMENT_IDS
    )
    assert package_ids & traceability.V1_4_NEW_PACKAGE_IDS == (
        traceability.V1_4_NEW_PACKAGE_IDS
    )
    assert len(requirement_ids - traceability.V1_4_NEW_REQUIREMENT_IDS) == 157
    assert len(package_ids - traceability.V1_4_NEW_PACKAGE_IDS) == 286
    review = cast(dict[str, object], metadata["review"])
    assert review["requirements_mapping_sha256"] == (
        traceability.PRESERVED_REQUIREMENT_MAPPING_SHA256
    )
    assert review["work_package_dependency_sha256"] == (
        traceability.PRESERVED_PACKAGE_DEPENDENCY_SHA256
    )
    assert review["expanded_requirements_mapping_sha256"] == (
        traceability.FINAL_V1_3_REQUIREMENT_MAPPING_SHA256
    )
    assert review["expanded_work_package_dependency_sha256"] == (
        traceability.FINAL_V1_3_PACKAGE_DEPENDENCY_SHA256
    )
    assert review["v1_3_reviewed_in_work_package"] == "M00-W10"
    assert review["v1_3_extension_review_state"] == traceability.REVIEWED_V1_3
    assert review["v1_4_reviewed_in_work_package"] == "M00-W11"
    assert review["v1_4_extension_review_state"] == traceability.REVIEWED_V1_4
    assert review["v1_4_requirements_mapping_sha256"] == (
        traceability.FINAL_V1_4_REQUIREMENT_MAPPING_SHA256
    )
    assert review["v1_4_work_package_dependency_sha256"] == (
        traceability.FINAL_V1_4_PACKAGE_DEPENDENCY_SHA256
    )
    assert review["v1_4_prior_requirement_inventory_sha256"] == (
        traceability.PRESERVED_V1_3_REQUIREMENT_INVENTORY_SHA256
    )


def test_adopted_spec_hash_schema_and_gate_inventory_are_exact() -> None:
    metadata = load_metadata(REPO_ROOT)
    spec_path = REPO_ROOT / traceability.SPEC_REL
    assert hashlib.sha256(spec_path.read_bytes()).hexdigest() == (
        "3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943"
    )
    assert metadata["schema_version"] == 3
    gate_ids = [record["id"] for record in records(metadata, "critical_gates")]
    assert gate_ids == [
        "AUTOFILL_FEASIBILITY",
        "RESUME_PAGEFIT_FEASIBILITY",
        "WORKDAY_GUIDED_PRE_SUBMIT",
        "CROSS_PLATFORM_CORE",
    ]


def test_agent_neutral_bootstrap_and_historical_v12_routing_facts_are_preserved() -> (
    None
):
    claude = (REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    assert (
        "At the beginning of every new prompt or resumed session, "
        "the implementation agent must:"
    ) in claude
    assert "The implementation agent updates it at every package start and finish" in (
        claude
    )
    assert "The implementation agent must not silently alter the specification" in (
        claude
    )
    assert "spec §0(26–27)" in claude
    assert (
        "At the beginning of every new prompt or resumed session, Claude must"
        not in (claude)
    )

    decisions = (REPO_ROOT / "docs" / "DECISIONS.md").read_text(encoding="utf-8")
    normalized_decisions = " ".join(decisions.split())
    historical_decision = (
        "Claude implementation sessions use Fable 5 Max; broad Ultra Code "
        "workflow orchestration is not the operating plan. Independent review "
        "happens after a coherent implementation pass in a separate clean Claude "
        "Max session or GPT-5.6 Ultra Codex worktree."
    )
    assert historical_decision in normalized_decisions
    assert (
        "Implementation standardizes on Claude Fable 5 Max with independent "
        "review in a separate clean session or Codex worktree instead of Ultra "
        "Code workflow fan-out (§0(20), §1.5)."
    ) in normalized_decisions
    assert "only M00-W05 using Claude Fable 5 Max." in normalized_decisions
    assert "ADR-0002/OD-026 prospectively supersedes" in normalized_decisions


def test_every_v14_record_is_reviewed_and_no_live_provisional_record_remains() -> None:
    metadata = load_metadata(REPO_ROOT)
    for record in records(metadata, "requirements"):
        if record["id"] in traceability.V1_4_NEW_REQUIREMENT_IDS:
            assert record["mapping_review_state"] == traceability.REVIEWED_V1_4
            if record["id"] in traceability.V1_4_SCAFFOLD_REQUIREMENT_IDS:
                assert record["implementation_state"] == "SCAFFOLD_ONLY"
                assert record["verification_state"] == "NOT_YET_APPLICABLE"
            else:
                assert record["implementation_state"] == "NOT_STARTED"
                assert record["verification_state"] == "NOT_YET_APPLICABLE"
                assert record["current_evidence"] == []
    for record in records(metadata, "work_packages"):
        if record["id"] in traceability.V1_4_NEW_PACKAGE_IDS:
            assert record["dependency_review_state"] == traceability.REVIEWED_V1_4
    historical_requirements = [
        record
        for record in records(metadata, "requirements")
        if record["id"] not in traceability.V1_4_NEW_REQUIREMENT_IDS
    ]
    historical_packages = [
        record
        for record in records(metadata, "work_packages")
        if record["id"] not in traceability.V1_4_NEW_PACKAGE_IDS
    ]
    assert len(historical_requirements) == 157
    assert len(historical_packages) == 286
    for record in historical_requirements:
        expected = (
            traceability.REVIEWED_V1_3
            if record["id"] in traceability.V1_3_NEW_REQUIREMENT_IDS
            else traceability.REVIEWED_V1_2
        )
        assert record["mapping_review_state"] == expected
    for record in historical_packages:
        expected = (
            traceability.REVIEWED_V1_3
            if record["id"] in traceability.V1_3_NEW_PACKAGE_IDS
            else traceability.REVIEWED_V1_2
        )
        assert record["dependency_review_state"] == expected


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
        "REQ-PLAT-013",
        "REQ-GATE-017",
        "REQ-GATE-018",
        "REQ-GATE-022",
    }
    legacy_verified = verified - traceability.V1_3_VERIFIED_GOVERNANCE_REQUIREMENT_IDS
    for requirement_id in legacy_verified:
        record = record_by_id(metadata, "requirements", requirement_id)
        assert record["completed_code_paths"] == ["scripts/validate_status.py"]
        assert record["completed_test_paths"] == [
            "scripts/tests/test_validate_status.py"
        ]
        assert record["current_evidence"] == [
            {"path": "docs/TEST_EVIDENCE.md", "heading": "### M00-W05"}
        ]
    for requirement_id in traceability.V1_3_VERIFIED_GOVERNANCE_REQUIREMENT_IDS:
        record = record_by_id(metadata, "requirements", requirement_id)
        assert record["completed_code_paths"]
        assert record["completed_test_paths"]
        assert record["current_evidence"]


def test_platform_scaffold_claim_is_partial_and_product_honest() -> None:
    metadata = load_metadata(REPO_ROOT)
    record = record_by_id(metadata, "requirements", "REQ-PLAT-025")
    assert record["implementation_state"] == "SCAFFOLD_ONLY"
    assert record["verification_state"] == "NOT_YET_APPLICABLE"
    assert record["current_evidence"] == [
        {"path": "docs/TEST_EVIDENCE.md", "heading": "### M00-W09"}
    ]
    assert "M03-W09" in cast(str, record["notes"])
    assert "ownership scaffold only" in cast(str, record["notes"])


def test_w09_form_requirements_are_partial_and_product_honest() -> None:
    metadata = load_metadata(REPO_ROOT)
    requirements = {
        requirement_id: record_by_id(metadata, "requirements", requirement_id)
        for requirement_id in ("REQ-FORM-017", "REQ-FORM-023")
    }
    for record in requirements.values():
        assert record["implementation_state"] == "SCAFFOLD_ONLY"
        assert record["verification_state"] == "NOT_YET_APPLICABLE"
        assert record["current_evidence"] == [
            {"path": "docs/TEST_EVIDENCE.md", "heading": "### M02-W09"}
        ]
        assert record["completed_code_paths"]
        assert record["completed_test_paths"]
        assert "writer does not independently verify W09" in cast(str, record["notes"])
    assert "M18-W05" in cast(str, requirements["REQ-FORM-017"]["notes"])
    assert "M18-W03" in cast(str, requirements["REQ-FORM-023"]["notes"])
    for requirement_id in ("REQ-FORM-001", "REQ-FORM-002"):
        record = record_by_id(metadata, "requirements", requirement_id)
        assert record["implementation_state"] == "NOT_STARTED"
        assert record["current_evidence"] == []
        assert record["completed_code_paths"] == []
        assert record["completed_test_paths"] == []


def test_versioning_requirement_claim_stays_partial_after_m01_w01() -> None:
    """REQ-PLAT-005: only the implemented versioning portions are recorded.

    M01-W01 recorded the schema-versioning portion and M01-W02 added the
    generated-model version-propagation portion (each through the reviewed
    FINAL_V1_3_REQUIREMENT_MAPPING_SHA256 update procedure), while prompt,
    model-configuration, platform-profile, and migration versioning remain
    future work — the requirement must stay SCAFFOLD_ONLY with honest notes.
    """
    metadata = load_metadata(REPO_ROOT)
    record = record_by_id(metadata, "requirements", "REQ-PLAT-005")
    assert record["implementation_state"] == "SCAFFOLD_ONLY"
    assert record["verification_state"] == "NOT_YET_APPLICABLE"
    assert record["current_evidence"] == [
        {"path": "docs/TEST_EVIDENCE.md", "heading": "### M01-W01"},
        {"path": "docs/TEST_EVIDENCE.md", "heading": "### M01-W02"},
    ]
    code_paths = cast(list[str], record["completed_code_paths"])
    test_paths = cast(list[str], record["completed_test_paths"])
    assert "packages/contracts/src/versioning.ts" in code_paths
    assert (
        "packages/contracts/schemas/common/schema-version.v1.schema.json" in code_paths
    )
    assert "packages/contracts/generator/generate.ts" in code_paths
    assert "packages/contracts/generated/MANIFEST.json" in code_paths
    assert "scripts/generate-contracts.ts" in code_paths
    assert "packages/contracts/test/schema/envelope.test.ts" in test_paths
    assert "packages/contracts/test/generated/generator.test.ts" in test_paths
    assert "scripts/tests/test_generated_contracts.py" in test_paths
    for relative in (*code_paths, *test_paths):
        assert (REPO_ROOT / relative).is_file(), relative
    notes = cast(str, record["notes"])
    for owner in ("M01-W02", "M04-W02", "M05"):
        assert owner in notes
    assert "MANIFEST.json" in notes


def test_reviewed_plat_005_evidence_tamper_fails_after_self_rehash(
    trace_repo: Path,
) -> None:
    """The M01-W01 hash update must not weaken the anti-self-rehash lock."""
    metadata = load_metadata(trace_repo)
    record = record_by_id(metadata, "requirements", "REQ-PLAT-005")
    record["implementation_state"] = "VERIFIED"
    record["verification_state"] = "VERIFIED"
    refresh_v1_4_requirement_hash(metadata)
    save_metadata(trace_repo, metadata)
    assert "final reviewed v1.4 requirement-mapping hash changed" in errors(trace_repo)


def test_new_package_proof_plans_are_specific_not_provisional_placeholders() -> None:
    metadata = load_metadata(REPO_ROOT)
    for record in records(metadata, "work_packages"):
        if record["id"] not in traceability.V1_4_NEW_PACKAGE_IDS:
            continue
        automated = " ".join(cast(list[str], record["required_automated_verification"]))
        manual = " ".join(cast(list[str], record["required_manual_evidence"]))
        assert "owning-package automated verification defined" not in automated
        assert "manual/browser/document/holdout/hosted evidence required" not in manual


def test_missing_requirement_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    records(metadata, "requirements").pop()
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "missing canonical requirement" in output
    assert "expected 193" in output


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


def test_reviewed_new_requirement_tamper_fails_even_if_claimed_hash_is_updated(
    trace_repo: Path,
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-AI-001")["planned_components"] = [
        "tampered platform boundary"
    ]
    refresh_v1_4_requirement_hash(metadata)
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "final reviewed v1.4 requirement-mapping hash changed" in output


@pytest.mark.parametrize(
    ("field", "replacement"),
    [
        ("implementation_state", "ACCEPTED"),
        ("verification_state", "ACCEPTED"),
        ("completed_code_paths", ["docs/MASTER_IMPLEMENTATION_SPEC.md"]),
        ("completed_test_paths", ["docs/MASTER_IMPLEMENTATION_SPEC.md"]),
        (
            "current_evidence",
            [{"path": "docs/TEST_EVIDENCE.md", "heading": "### M00-W01"}],
        ),
        ("notes", "Windows 11 native product certification is complete."),
    ],
)
def test_reviewed_governance_honesty_tamper_fails_after_self_rehash(
    trace_repo: Path,
    field: str,
    replacement: object,
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "requirements", "REQ-AI-006")[field] = replacement
    refresh_v1_4_requirement_hash(metadata)
    save_metadata(trace_repo, metadata)
    assert "final reviewed v1.4 requirement-mapping hash changed" in errors(trace_repo)


def test_missing_work_package_fails(trace_repo: Path) -> None:
    metadata = load_metadata(trace_repo)
    records(metadata, "work_packages").pop()
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "missing canonical work-package record" in output
    assert "expected 300" in output


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


def test_reviewed_new_package_dependency_tamper_fails_even_if_hash_is_updated(
    trace_repo: Path,
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M27-W14")[
        "direct_package_prerequisites"
    ] = ["M27-W11"]
    refresh_v1_4_dependency_hash(metadata)
    save_metadata(trace_repo, metadata)
    output = errors(trace_repo)
    assert "M27-W14: direct package prerequisites drift" in output
    assert "final reviewed v1.4 dependency-map hash changed" in output


@pytest.mark.parametrize(
    ("field", "replacement"),
    [
        ("primary_deliverables", ["tampered deliverable"]),
        ("required_automated_verification", ["placeholder"]),
        ("required_manual_evidence", ["placeholder"]),
    ],
)
def test_reviewed_new_package_proof_plan_tamper_fails_after_self_rehash(
    trace_repo: Path,
    field: str,
    replacement: list[str],
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M27-W13")[field] = replacement
    refresh_v1_4_dependency_hash(metadata)
    save_metadata(trace_repo, metadata)
    assert "final reviewed v1.4 dependency-map hash changed" in errors(trace_repo)


def test_completed_package_must_reference_its_own_evidence_heading(
    trace_repo: Path,
) -> None:
    metadata = load_metadata(trace_repo)
    record_by_id(metadata, "work_packages", "M00-W09")["current_evidence"] = [
        {"path": "docs/TEST_EVIDENCE.md", "heading": "### M00-W08"}
    ]
    save_metadata(trace_repo, metadata)
    assert (
        "M00-W09: completed package must reference its own ### M00-W09 heading"
        in errors(trace_repo)
    )


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


def test_workday_gate_covers_declared_m21_through_m23_expansion_boundary() -> None:
    metadata = load_metadata(REPO_ROOT)
    covered = {
        cast(str, record["id"])
        for record in records(metadata, "work_packages")
        if cast(str, record["id"]).startswith(("M21-", "M22-", "M23-"))
        and "WORKDAY_GUIDED_PRE_SUBMIT"
        in cast(list[str], record["critical_gate_prerequisites"])
    }
    expected = {
        cast(str, record["id"])
        for record in records(metadata, "work_packages")
        if cast(str, record["id"]).startswith(("M21-", "M22-", "M23-"))
    }
    assert covered == expected


def test_final_platform_profile_and_gate_d_decision_owners_are_exact() -> None:
    metadata = load_metadata(REPO_ROOT)
    profile = record_by_id(metadata, "work_packages", "M27-W10")
    gate_decision = record_by_id(metadata, "work_packages", "M27-W12")
    assert "full-AI platform profiles" in " ".join(
        cast(list[str], profile["primary_deliverables"])
    )
    assert "accepted Windows/Ubuntu full-AI profiles" in " ".join(
        cast(list[str], profile["required_automated_verification"])
    )
    assert "Independent Cross-Platform Core Gate audit and decision" in " ".join(
        cast(list[str], gate_decision["primary_deliverables"])
    )
    assert "Independent terminal Gate D decision" in " ".join(
        cast(list[str], gate_decision["required_manual_evidence"])
    )
    gate_requirement = record_by_id(metadata, "requirements", "REQ-GATE-020")
    assert gate_requirement["owning_packages"] == ["M27-W12"]

    m27_w11 = record_by_id(metadata, "work_packages", "M27-W11")
    m27_w13 = record_by_id(metadata, "work_packages", "M27-W13")
    m27_w14 = record_by_id(metadata, "work_packages", "M27-W14")
    assert m27_w13["direct_package_prerequisites"] == [
        f"M27-W{number:02d}" for number in range(1, 12)
    ]
    assert m27_w14["direct_package_prerequisites"] == ["M27-W13"]
    assert gate_decision["direct_package_prerequisites"] == [
        *[f"M27-W{number:02d}" for number in range(1, 12)],
        "M27-W13",
        "M27-W14",
    ]
    assert m27_w11["downstream_packages"] == ["M27-W12", "M27-W13"]
    assert m27_w13["downstream_packages"] == ["M27-W12", "M27-W14"]
    assert m27_w14["downstream_packages"] == ["M27-W12"]


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
        "REVIEWED_V1_3"
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
        trace_repo / "docs" / "MASTER_IMPLEMENTATION_SPEC.v1.4.proposed.md",
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


def test_m01_w07_cannot_be_ready_before_m00_is_accepted(
    trace_repo: Path,
) -> None:
    prepare_valid_m00_closeout(trace_repo)
    replace_status(trace_repo, r"^\| M00 \|[^\n]*$", "| M00 | VERIFIED | — | fixture |")
    assert "M01-W07 is READY before milestone M00 is ACCEPTED" in errors(trace_repo)


def test_m01_w07_is_the_only_valid_ready_package_after_m00_acceptance(
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
    assert ready == ["M01-W07"]


def test_m02_cannot_become_ready_at_the_m01_w07_boundary(
    trace_repo: Path,
) -> None:
    metadata = prepare_valid_m00_closeout(trace_repo)
    set_package_status(trace_repo, "M02-W01", "READY")
    set_metadata_package(metadata, "M02-W01", "READY")
    save_metadata(trace_repo, metadata)
    assert "READY package derivation drift: expected M01-W07" in errors(trace_repo)
