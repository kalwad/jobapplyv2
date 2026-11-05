"""Only the exact candidate workflow pair can accompany canonical CI.

These are byte-equality policy tests. Candidate content remains pending
independent source review and root adoption; no workflow is executed here.
"""

from __future__ import annotations

from pathlib import Path

import check_portability
import pytest
import test_ci_workflow as workflow_oracles

CANDIDATE_NAMES = ("ubuntu-gnome-prepare.yml", "ubuntu-gnome-lifecycle.yml")


def _workflow_fixture(tmp_path: Path, *, auxiliary: bool = True) -> Path:
    repo = tmp_path / "repo"
    directory = repo / ".github" / "workflows"
    directory.mkdir(parents=True)
    (directory / "ci.yml").write_bytes(workflow_oracles.CI_PATH.read_bytes())
    if auxiliary:
        for name in CANDIDATE_NAMES:
            (directory / name).write_bytes(
                (workflow_oracles.CI_PATH.parent / name).read_bytes()
            )
    return repo


def _policy_rules(repo: Path) -> list[str]:
    violations: list[check_portability.Violation] = []
    check_portability._check_workflow_files(repo, violations)
    return [item.rule for item in violations]


@pytest.mark.parametrize("auxiliary", [False, True])
def test_legacy_singleton_or_exact_candidate_pair_is_permitted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, auxiliary: bool
) -> None:
    repo = _workflow_fixture(tmp_path, auxiliary=auxiliary)
    assert _policy_rules(repo) == []
    monkeypatch.setattr(
        workflow_oracles, "WORKFLOWS_DIR", repo / ".github" / "workflows"
    )
    workflow_oracles.test_workflows_dir_contains_only_ci()


@pytest.mark.parametrize("name", ["other.yml", "other.yaml", ".hidden.yml"])
def test_unknown_workflow_file_is_refused(tmp_path: Path, name: str) -> None:
    repo = _workflow_fixture(tmp_path)
    (repo / ".github" / "workflows" / name).write_text("name: other\n")
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
def test_either_missing_candidate_is_refused(tmp_path: Path, name: str) -> None:
    repo = _workflow_fixture(tmp_path)
    (repo / ".github" / "workflows" / name).unlink()
    assert _policy_rules(repo) == ["PORT-CI-001"]


def test_missing_canonical_workflow_is_refused(tmp_path: Path) -> None:
    repo = _workflow_fixture(tmp_path)
    (repo / ".github" / "workflows" / "ci.yml").unlink()
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
def test_candidate_yaml_alias_is_refused(tmp_path: Path, name: str) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    path.rename(path.with_suffix(".yaml"))
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
@pytest.mark.parametrize("position", ["first", "middle", "last"])
def test_same_length_single_byte_mutation_is_refused(
    tmp_path: Path, name: str, position: str
) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    original = path.read_bytes()
    index = {"first": 0, "middle": len(original) // 2, "last": len(original) - 1}[
        position
    ]
    changed = bytearray(original)
    changed[index] ^= 1
    path.write_bytes(changed)
    assert path.stat().st_size == len(original)
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
@pytest.mark.parametrize(
    ("old", "new"),
    [
        ("pull_request:", "pull_request_target:"),
        ("- synchronize", "- opened"),
        ("contents: read", "contents: write"),
        ("actions: read", "actions: write"),
        (
            "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
            "actions/checkout@main",
        ),
        ("persist-credentials: false", "persist-credentials: true"),
        ("ref: ${{ github.workflow_sha }}", "ref: ${{ github.ref }}"),
        ("fetch-depth: 0", "fetch-depth: 1"),
        (
            "control/scripts/linux_gnome/ubuntu_gnome_request.py",
            "control/scripts/other.py",
        ),
        ("GH_TOKEN: ${{ github.token }}", "GH_TOKEN: ${{ secrets.OTHER }}"),
        ("digest-mismatch: error", "digest-mismatch: warn"),
        ("needs.authorize.outputs.enabled == 'true'", "true"),
    ],
)
def test_changed_workflow_execution_contract_is_refused(
    tmp_path: Path, name: str, old: str, new: str
) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    original = path.read_text()
    assert old in original
    path.write_text(original.replace(old, new, 1))
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
@pytest.mark.parametrize("suffix", [b"\n", b"# harmless comment\n", b'"on": {}\n'])
def test_even_nonoperational_or_duplicate_yaml_addition_is_refused(
    tmp_path: Path, name: str, suffix: bytes
) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    path.write_bytes(path.read_bytes() + suffix)
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
def test_candidate_symlink_is_refused(tmp_path: Path, name: str) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    target = tmp_path / name
    target.write_bytes(path.read_bytes())
    path.unlink()
    path.symlink_to(target)
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
def test_candidate_directory_is_refused(tmp_path: Path, name: str) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    path.unlink()
    path.mkdir()
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
def test_unreadable_candidate_fails_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    original_read = Path.read_bytes

    def read_bytes(candidate: Path) -> bytes:
        if candidate == path:
            raise OSError("fixture read failure")
        return original_read(candidate)

    monkeypatch.setattr(Path, "read_bytes", read_bytes)
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("name", CANDIDATE_NAMES)
def test_unstatted_candidate_fails_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    repo = _workflow_fixture(tmp_path)
    path = repo / ".github" / "workflows" / name
    original_lstat = Path.lstat

    def lstat(candidate: Path) -> object:
        if candidate == path:
            raise OSError("fixture stat failure")
        return original_lstat(candidate)

    monkeypatch.setattr(Path, "lstat", lstat)
    assert _policy_rules(repo) == ["PORT-CI-001"]


@pytest.mark.parametrize("case", ["unknown", "modified"])
def test_independent_directory_oracle_rejects_changed_set_or_bytes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    repo = _workflow_fixture(tmp_path)
    directory = repo / ".github" / "workflows"
    path = directory / ("other.yml" if case == "unknown" else CANDIDATE_NAMES[0])
    path.write_bytes(b"name: other\n")
    monkeypatch.setattr(workflow_oracles, "WORKFLOWS_DIR", directory)
    with pytest.raises(AssertionError):
        workflow_oracles.test_workflows_dir_contains_only_ci()
