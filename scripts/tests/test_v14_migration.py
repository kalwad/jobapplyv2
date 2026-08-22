"""Focused M00-W11 exact-byte adoption and v1.4 migration oracles."""

from __future__ import annotations

import hashlib
import json
import os
import re
import socket
import stat
import subprocess
import sys
import tempfile
import uuid
from collections.abc import Callable
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import traceability  # noqa: E402
import validate_status  # noqa: E402

APPROVED_SHA256 = "3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943"
APPROVED_SIZE = 367_893
V1_3_PACKAGE_ID_SHA256 = (
    "5e587eb9b497fc446ecd3c4b7430c9c1ab186fe7aceef14f3a04775381d8a70a"
)
UNCHANGED_V1_3_PACKAGE_ROWS_SHA256 = (
    "2f859577b7685d12a853c136cecfe4f33ad8d55cd7b179630e1c22f7e6384ec6"
)
CHANGED_V1_4_PACKAGE_ROWS_SHA256 = (
    "426afdc5b5aa5cfa3939d79c166f3809e8d5a357e471041b717bfdafbc82de6b"
)
NON_REGULAR_SOURCE_KINDS = [
    "missing",
    "directory",
    "symlink",
    "device",
    *(["fifo"] if hasattr(os, "mkfifo") else []),
    *(["socket"] if hasattr(socket, "AF_UNIX") else []),
]


class AdoptionError(RuntimeError):
    """Expected fail-closed adoption error in an isolated test fixture."""


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _read_regular_file(path: Path) -> bytes:
    try:
        metadata = path.lstat()
    except FileNotFoundError as exc:
        raise AdoptionError("approved source is missing") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise AdoptionError("approved source must be a regular non-symlink file")
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    if sys.platform == "win32":
        # Windows os.open defaults to text mode, which silently rewrites CRLF
        # to LF on read. That would make this exact-byte model accept a
        # CRLF-normalized source as identical to its LF original and corrupt
        # an installed specification containing CRLF — precisely the
        # corruption the adoption contract must reject (M00-W11).
        flags |= os.O_BINARY
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise AdoptionError("approved source cannot be opened safely") from exc
    try:
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode):
            raise AdoptionError("opened approved source is not a regular file")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 64 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def atomic_adopt_for_test(
    source: Path,
    destination: Path,
    expected_sha256: str,
    *,
    before_second_hash: Callable[[], None] | None = None,
    replace: Callable[[Path, Path], None] = os.replace,
) -> None:
    """Test-only exact-byte adoption model; production has no migration utility."""
    first = _read_regular_file(source)
    if _sha256(first) != expected_sha256:
        raise AdoptionError("approved source hash mismatch before mutation")

    stage = destination.parent / f".adoption-stage-{uuid.uuid4().hex}"
    try:
        with stage.open("xb") as stream:
            stream.write(first)
            stream.flush()
            os.fsync(stream.fileno())
        if stage.read_bytes() != first:
            raise AdoptionError("staged bytes changed")
        if before_second_hash is not None:
            before_second_hash()
        second = _read_regular_file(source)
        if second != first or _sha256(second) != expected_sha256:
            raise AdoptionError("approved source changed before replacement")
        replace(stage, destination)
        installed = destination.read_bytes()
        if installed != first or _sha256(installed) != expected_sha256:
            raise AdoptionError("installed canonical bytes changed")
    finally:
        if stage.exists():
            stage.unlink()


def _package_rows(spec_text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    in_milestones = False
    for line in spec_text.splitlines():
        if line.startswith("## 9. "):
            in_milestones = True
            continue
        if in_milestones and line.startswith("## 10. "):
            break
        if in_milestones and line.startswith("| `M") and "-W" in line:
            rows.append([cell.strip() for cell in line.strip("|").split("|")])
    return rows


def _rows_hash(rows: list[list[str]]) -> str:
    encoded = json.dumps(
        rows, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode()
    return _sha256(encoded)


def test_canonical_v14_bytes_and_inventory_are_exact() -> None:
    spec_path = REPO_ROOT / "docs/MASTER_IMPLEMENTATION_SPEC.md"
    content = spec_path.read_bytes()
    assert len(content) == APPROVED_SIZE
    assert _sha256(content) == APPROVED_SHA256

    spec = validate_status.parse_spec(spec_path)
    requirements = traceability.parse_requirements(spec_path)
    assert list(spec.milestones) == [f"M{number:02d}" for number in range(39)]
    assert len(spec.package_ids()) == len(set(spec.package_ids())) == 300
    assert (
        len(requirements) == len({item.requirement_id for item in requirements}) == 193
    )
    assert set(spec.package_ids()) & traceability.V1_4_NEW_PACKAGE_IDS == (
        traceability.V1_4_NEW_PACKAGE_IDS
    )
    assert {item.requirement_id for item in requirements} & (
        traceability.V1_4_NEW_REQUIREMENT_IDS
    ) == traceability.V1_4_NEW_REQUIREMENT_IDS


def test_v13_requirement_and_package_projections_are_preserved() -> None:
    spec_path = REPO_ROOT / "docs/MASTER_IMPLEMENTATION_SPEC.md"
    requirements = traceability.parse_requirements(spec_path)
    prior_requirements = [
        [item.requirement_id, item.text, item.family]
        for item in requirements
        if item.requirement_id not in traceability.V1_4_NEW_REQUIREMENT_IDS
    ]
    assert len(prior_requirements) == 157
    assert traceability._inventory_hash(prior_requirements) == (
        traceability.PRESERVED_V1_3_REQUIREMENT_INVENTORY_SHA256
    )

    spec = validate_status.parse_spec(spec_path)
    prior_package_ids = sorted(
        set(spec.package_ids()) - traceability.V1_4_NEW_PACKAGE_IDS
    )
    assert len(prior_package_ids) == 286
    assert _sha256("\n".join(prior_package_ids).encode()) == V1_3_PACKAGE_ID_SHA256

    rows = _package_rows(spec_path.read_text(encoding="utf-8"))
    unchanged = [
        row
        for row in rows
        if row[0].strip("`")
        not in (
            traceability.V1_4_NEW_PACKAGE_IDS
            | traceability.V1_4_INTENTIONALLY_CHANGED_PACKAGE_IDS
        )
    ]
    changed = [
        row
        for row in rows
        if row[0].strip("`") in traceability.V1_4_INTENTIONALLY_CHANGED_PACKAGE_IDS
    ]
    assert len(unchanged) == 278
    assert _rows_hash(unchanged) == UNCHANGED_V1_3_PACKAGE_ROWS_SHA256
    assert len(changed) == 8
    assert _rows_hash(changed) == CHANGED_V1_4_PACKAGE_ROWS_SHA256


def test_v14_explicit_package_graph_is_exact_and_acyclic() -> None:
    spec = validate_status.parse_spec(REPO_ROOT / "docs/MASTER_IMPLEMENTATION_SPEC.md")
    graph = validate_status.expected_package_prerequisites(spec)
    assert graph["M00-W11"] == ["M00-W10", "M01-W06"]
    assert graph["M01-W07"] == ["M01-W06", "M00-W11"]
    assert graph["M27-W13"] == [f"M27-W{number:02d}" for number in range(1, 12)]
    assert graph["M27-W14"] == ["M27-W13"]
    assert graph["M27-W12"] == [
        *[f"M27-W{number:02d}" for number in range(1, 12)],
        "M27-W13",
        "M27-W14",
    ]
    assert traceability._cycle(set(graph), graph) is None


def test_v14_governance_ledgers_are_honest() -> None:
    report = validate_status.Report()
    spec = validate_status.parse_spec(REPO_ROOT / "docs/MASTER_IMPLEMENTATION_SPEC.md")
    validate_status.check_v14_governance_memory(REPO_ROOT, spec, report)
    assert report.errors == []


def test_provider_governance_contains_no_concrete_remote_configuration() -> None:
    text = (REPO_ROOT / "docs/EXPERIMENTAL_AI_PROVIDERS.md").read_text(encoding="utf-8")
    prohibited = (
        r"https?://",
        r"\bBearer\s+\S+",
        r"\bsk-[A-Za-z0-9_-]+",
        (
            r"\b(?:endpoint|client[_-]?id|client[_-]?secret|access[_-]?token|"
            r"refresh[_-]?token)\s*[:=]\s*[\"']?\S+"
        ),
    )
    for pattern in prohibited:
        assert re.search(pattern, text, flags=re.IGNORECASE) is None


@pytest.mark.parametrize(
    "corrupt",
    [
        lambda value: value.replace(b"\n", b"\r\n"),
        lambda value: value.replace("é".encode(), "e\u0301".encode()),
        lambda value: value.removesuffix(b"\n"),
        lambda value: value + b"\n",
        lambda value: value[: max(1, len(value) // 2)],
        lambda value: value.replace(b"  ", b" ", 1),
    ],
    ids=[
        "crlf-normalization",
        "unicode-normalization",
        "trailing-newline-removed",
        "extra-newline",
        "truncation",
        "formatter-whitespace",
    ],
)
def test_atomic_adoption_rejects_any_byte_corruption(
    tmp_path: Path, corrupt: Callable[[bytes], bytes]
) -> None:
    approved = "café\nexact  punctuation\n".encode()
    source = tmp_path / "approved.md"
    destination = tmp_path / "canonical.md"
    source.write_bytes(corrupt(approved))
    destination.write_bytes(b"old canonical bytes")
    with pytest.raises(AdoptionError, match="hash mismatch"):
        atomic_adopt_for_test(source, destination, _sha256(approved))
    assert destination.read_bytes() == b"old canonical bytes"


def test_atomic_adoption_installs_exact_bytes(tmp_path: Path) -> None:
    approved = b"exact\r\nbytes \xf0\x9f\x98\x80\n"
    source = tmp_path / "approved.md"
    destination = tmp_path / "canonical.md"
    source.write_bytes(approved)
    destination.write_bytes(b"old")
    atomic_adopt_for_test(source, destination, _sha256(approved))
    assert destination.read_bytes() == approved
    assert not list(tmp_path.glob(".adoption-stage-*"))


def test_atomic_adoption_rejects_second_hash_drift(tmp_path: Path) -> None:
    source = tmp_path / "approved.md"
    destination = tmp_path / "canonical.md"
    source.write_bytes(b"approved")
    destination.write_bytes(b"old")

    def mutate() -> None:
        source.write_bytes(b"changed")

    with pytest.raises(AdoptionError, match="changed before replacement"):
        atomic_adopt_for_test(
            source,
            destination,
            _sha256(b"approved"),
            before_second_hash=mutate,
        )
    assert destination.read_bytes() == b"old"
    assert not list(tmp_path.glob(".adoption-stage-*"))


def test_atomic_adoption_replace_failure_keeps_old_destination(tmp_path: Path) -> None:
    source = tmp_path / "approved.md"
    destination = tmp_path / "canonical.md"
    source.write_bytes(b"approved")
    destination.write_bytes(b"old")

    def fail_replace(_source: Path, _destination: Path) -> None:
        raise OSError("injected replacement failure")

    with pytest.raises(OSError, match="injected"):
        atomic_adopt_for_test(
            source,
            destination,
            _sha256(b"approved"),
            replace=fail_replace,
        )
    assert destination.read_bytes() == b"old"
    assert not list(tmp_path.glob(".adoption-stage-*"))


@pytest.mark.parametrize("kind", NON_REGULAR_SOURCE_KINDS)
def test_atomic_adoption_rejects_non_regular_source(tmp_path: Path, kind: str) -> None:
    source = tmp_path / "approved"
    destination = tmp_path / "canonical.md"
    destination.write_bytes(b"old")
    unix_socket: socket.socket | None = None
    socket_source_dir: Path | None = None
    if kind == "directory":
        source.mkdir()
    elif kind == "symlink":
        target = tmp_path / "target"
        target.write_bytes(b"approved")
        source.symlink_to(target)
    elif kind == "fifo":
        # NON_REGULAR_SOURCE_KINDS already drops this case where os.mkfifo is
        # absent; the sys.platform guard additionally narrows the POSIX-only
        # attribute for Windows static analysis without changing behavior.
        if sys.platform != "win32":
            os.mkfifo(source)
    elif kind == "socket":
        socket_source_dir = Path(tempfile.mkdtemp(prefix="japp-v14-"))
        source = socket_source_dir / "approved"
        if sys.platform != "win32":
            unix_socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            unix_socket.bind(str(source))
    elif kind == "device":
        source = Path(os.devnull)
    try:
        with pytest.raises(AdoptionError):
            atomic_adopt_for_test(source, destination, _sha256(b"approved"))
    finally:
        if unix_socket is not None:
            unix_socket.close()
        if socket_source_dir is not None:
            source.unlink(missing_ok=True)
            socket_source_dir.rmdir()
    assert destination.read_bytes() == b"old"


@pytest.mark.parametrize(
    "name",
    [
        "master_implementation_spec.txt",
        "MASTER IMPLEMENTATION SPEC.v1.4.bak",
        ".#Master-Implementation-Spec.md",
        "ＭＡＳＴＥＲ＿ＩＭＰＬＥＭＥＮＴＡＴＩＯＮ＿ＳＰＥＣ.old",  # noqa: RUF001
        "master_implementation_spec.md~",
    ],
)
def test_canonical_name_variants_are_rejected(tmp_path: Path, name: str) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "MASTER_IMPLEMENTATION_SPEC.md").write_text("# canonical", encoding="utf-8")
    nested = docs / "nested"
    nested.mkdir()
    (nested / name).write_text("not even Markdown", encoding="utf-8")
    assert f"docs/nested/{name}" in validate_status.canonical_spec_offenders(tmp_path)


def test_full_content_marker_variant_is_rejected(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "MASTER_IMPLEMENTATION_SPEC.md").write_text("# canonical", encoding="utf-8")
    duplicate = docs / "innocent.copy"
    duplicate.write_text(
        "prefix\n" + validate_status.SPEC_HEADER_MARKER + "\nsuffix\n",
        encoding="utf-8",
    )
    assert "docs/innocent.copy" in validate_status.canonical_spec_offenders(tmp_path)


def test_canonical_name_symlink_to_directory_is_rejected(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "MASTER_IMPLEMENTATION_SPEC.md").write_text("# canonical", encoding="utf-8")
    target = tmp_path / "archive"
    target.mkdir()
    lookalike = docs / "master_implementation_spec.old"
    lookalike.symlink_to(target, target_is_directory=True)
    assert "docs/master_implementation_spec.old" in (
        validate_status.canonical_spec_offenders(tmp_path)
    )


M02_W01_START_COMMIT = "0c8efc9212162bcb4fa846e453007d9404d97429"
M02_W02_VERIFIED_COMMIT = "0c52cab5987a6497e28db5a30186c82a053c88aa"

# Reviewed M02-W03 delta: the mock ATS lab importer with its exact pinned
# test-only dependencies (spec §8.2; the lab is built by M02-W03). The
# current-lockfile digest below fails closed on any unreviewed drift.
# Reviewed M02-W07 refresh: adding wxt to apps/extension brought jiti (an
# eslint peer of wxt) into the graph, so pnpm's peer-resolution keys for
# vite/vitest now carry a (jiti@2.7.0) component; every dependency version
# is unchanged.
REVIEWED_MOCK_ATS_LAB_IMPORTER = (
    b"""  apps/mock-ats-lab:
    dependencies:
      react:
        specifier: 19.2.8
        version: 19.2.8
      react-dom:
        specifier: 19.2.8
        version: 19.2.8(react@19.2.8)
      vue:
        specifier: 3.5.41
        version: 3.5.41(typescript@6.0.3)
    devDependencies:
      '@types/node':
        specifier: 'catalog:'
        version: 24.13.3
      '@types/react':
        specifier: 19.2.18
        version: 19.2.18
      '@types/react-dom':
        specifier: 19.2.4
        version: 19.2.4(@types/react@19.2.18)
      typescript:
        specifier: 'catalog:'
        version: 6.0.3
      vite:
        specifier: 7.3.6
        version: 7.3.6(@types/node@24.13.3)(jiti@2.7.0)(lightningcss@1.33.0)
      vitest:
        specifier: 'catalog:'
        version: 4.1.10(@types/node@24.13.3)"""
    b"(vite@7.3.6(@types/node@24.13.3)(jiti@2.7.0)(lightningcss@1.33.0))\n"
)
# Reviewed M02-W07/W08 delta: the real feasibility-extension importer — the
# canonical contracts workspace link used by the semantic scanner, the
# catalog-pinned dev tooling, and the single exact-pinned wxt build framework
# (spec §5.2 stack lock; no React until a UI surface exists in M17).
REVIEWED_EXTENSION_IMPORTER = (
    b"""  apps/extension:
    dependencies:
      '@japp/contracts':
        specifier: workspace:*
        version: link:../../packages/contracts
    devDependencies:
      '@types/node':
        specifier: 'catalog:'
        version: 24.13.3
      typescript:
        specifier: 'catalog:'
        version: 6.0.3
      vitest:
        specifier: 'catalog:'
        version: 4.1.10(@types/node@24.13.3)"""
    b"(vite@8.1.5(@types/node@24.13.3)(esbuild@0.27.7)(jiti@2.7.0))\n"
    b"""      wxt:
        specifier: 0.20.27
        version: 0.20.27(@types/node@24.13.3)(eslint@10.8.0(jiti@2.7.0))"""
    b"(jiti@2.7.0)(lightningcss@1.33.0)(rolldown@1.1.5)(rollup@4.62.4)\n"
)
# Reviewed M02-W04 delta: the evaluation-baselines importer with only the
# workspace fixture link and catalog-pinned dev tooling (spec §8.4; the
# baseline owner is built by M02-W04 and adds no external dependency).
REVIEWED_EVALUATION_BASELINES_IMPORTER = (
    b"""  packages/evaluation-baselines:
    dependencies:
      '@japp/test-fixtures':
        specifier: workspace:*
        version: link:../test-fixtures
    devDependencies:
      '@types/node':
        specifier: 'catalog:'
        version: 24.13.3
      typescript:
        specifier: 'catalog:'
        version: 6.0.3
      vitest:
        specifier: 'catalog:'
        version: 4.1.10(@types/node@24.13.3)"""
    b"(vite@8.1.5(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0))\n"
)
# Reviewed M02-W06 delta: runtime ownership is limited to stable contracts;
# W04/W05 evaluation packages are explicit development-only links. No new
# external dependency or product dependency is introduced.
REVIEWED_EVALUATION_CORPUS_IMPORTER = (
    b"""  packages/evaluation-corpus:
    dependencies:
      '@japp/contracts':
        specifier: workspace:*
        version: link:../contracts
    devDependencies:
      '@japp/evaluation-baselines':
        specifier: workspace:*
        version: link:../evaluation-baselines
      '@japp/evaluation-runner':
        specifier: workspace:*
        version: link:../evaluation-runner
      '@types/node':
        specifier: 'catalog:'
        version: 24.13.3
      typescript:
        specifier: 'catalog:'
        version: 6.0.3
      vitest:
        specifier: 'catalog:'
        version: 4.1.10(@types/node@24.13.3)"""
    b"(vite@8.1.5(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0))\n"
)
# Reviewed M02-W05 delta: runtime ownership is limited to stable contracts;
# W04 baselines and W01/W02 fixtures are explicit development-only links.
REVIEWED_EVALUATION_RUNNER_IMPORTER = (
    b"""  packages/evaluation-runner:
    dependencies:
      '@japp/contracts':
        specifier: workspace:*
        version: link:../contracts
    devDependencies:
      '@japp/evaluation-baselines':
        specifier: workspace:*
        version: link:../evaluation-baselines
      '@japp/test-fixtures':
        specifier: workspace:*
        version: link:../test-fixtures
      '@types/node':
        specifier: 'catalog:'
        version: 24.13.3
      typescript:
        specifier: 'catalog:'
        version: 6.0.3
      vitest:
        specifier: 'catalog:'
        version: 4.1.10(@types/node@24.13.3)"""
    b"(vite@8.1.5(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0))\n"
)
REVIEWED_PNPM_LOCK_SHA256 = (
    "06819996bc2e8b4b2478c4c4054a255c40b69ab49390cb28e9247a50826c4c87"
)


def test_dependency_lockfiles_preserve_history_except_m02_importer() -> None:
    baseline_pnpm = subprocess.run(
        ["git", "show", f"{M02_W01_START_COMMIT}:pnpm-lock.yaml"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    ).stdout
    prior_importer = b"""  packages/test-fixtures:
    devDependencies:
"""
    reviewed_importer = b"""  packages/test-fixtures:
    dependencies:
      '@japp/contracts':
        specifier: workspace:*
        version: link:../contracts
    devDependencies:
"""
    reviewed_prettier = b"""      prettier:
        specifier: 3.9.6
        version: 3.9.6
"""
    typescript_anchor = b"""      typescript:
        specifier: 'catalog:'
        version: 6.0.3
"""
    assert baseline_pnpm.count(prior_importer) == 1
    expected_pnpm = baseline_pnpm.replace(prior_importer, reviewed_importer)
    package_importer_start = expected_pnpm.index(reviewed_importer)
    typescript_start = expected_pnpm.index(typescript_anchor, package_importer_start)
    expected_pnpm = (
        expected_pnpm[:typescript_start]
        + reviewed_prettier
        + expected_pnpm[typescript_start:]
    )
    # Historical proof: the M02-W01/W02 lockfile stage is exactly the
    # baseline plus those two reviewed splices, byte for byte, anchored to
    # the immutable verified M02-W02 content commit.
    historical_pnpm = subprocess.run(
        ["git", "show", f"{M02_W02_VERIFIED_COMMIT}:pnpm-lock.yaml"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    ).stdout
    assert historical_pnpm == expected_pnpm

    # Current lockfile: every reviewed historical importer survives unchanged,
    # the additive M02-W04/W05/W06 importers exist exactly once with their
    # exact evaluation-only links, and the complete file matches the reviewed
    # digest.
    current_pnpm = (REPO_ROOT / "pnpm-lock.yaml").read_bytes()
    assert current_pnpm.count(reviewed_importer) == 1
    assert current_pnpm.count(reviewed_prettier) == historical_pnpm.count(
        reviewed_prettier
    )
    assert current_pnpm.count(REVIEWED_MOCK_ATS_LAB_IMPORTER) == 1
    assert current_pnpm.count(b"  apps/mock-ats-lab:") == 1
    assert current_pnpm.count(REVIEWED_EXTENSION_IMPORTER) == 1
    assert current_pnpm.count(b"  apps/extension:") == 1
    assert current_pnpm.count(REVIEWED_EVALUATION_BASELINES_IMPORTER) == 1
    assert current_pnpm.count(b"  packages/evaluation-baselines:") == 1
    assert current_pnpm.count(REVIEWED_EVALUATION_CORPUS_IMPORTER) == 1
    assert current_pnpm.count(b"  packages/evaluation-corpus:") == 1
    assert current_pnpm.count(REVIEWED_EVALUATION_RUNNER_IMPORTER) == 1
    assert current_pnpm.count(b"  packages/evaluation-runner:") == 1
    assert _sha256(current_pnpm) == REVIEWED_PNPM_LOCK_SHA256

    unchanged = {
        "uv.lock": ("4acf551f60c94aa647903125823cd6b04be6fcb6e0ff03978ec7a2793ffcba9c"),
        "services/native-host/Cargo.lock": (
            "7e8a6629c3f66af2b10347e3025c217538ab0bbb0736c76a1f203b11bba0a722"
        ),
    }
    for relative, digest in unchanged.items():
        assert _sha256((REPO_ROOT / relative).read_bytes()) == digest


def test_exact_spec_whitespace_exception_is_path_scoped() -> None:
    attributes = (REPO_ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert attributes.count("-whitespace") == 1
    assert "docs/MASTER_IMPLEMENTATION_SPEC.md -whitespace" in attributes.splitlines()


def test_fixed_issue_sections_remain_byte_exact() -> None:
    text = (REPO_ROOT / "docs/KNOWN_ISSUES.md").read_text(encoding="utf-8")
    expected = {
        "KI-0018": ("7b6a49536494cd7f2ec801284d65b32262ddb5c53066f92570b95dc4be3b6d49"),
        "KI-0020": ("a66601f67a2ba2c3f84cc72d0a6ad18ba23cd3b9576393dfbcf98fb52b943e20"),
        "KI-0021": ("1eb381beb1a4b732a03e30874eb3f4a0b89af2ba7c62f58f9698e4ce6a2f5443"),
    }
    for issue_id, digest in expected.items():
        match = re.search(
            rf"^### {issue_id}.*?(?=^### |\Z)",
            text,
            flags=re.MULTILINE | re.DOTALL,
        )
        assert match is not None
        assert _sha256(match.group(0).encode()) == digest


M00_W11_CONTENT_COMMIT = "bde8ad49c31e63a7e09b50ad7cdf9af51416c182"


def test_contract_artifact_trees_and_files_remain_exact() -> None:
    """M00-W11 changed no contract artifact.

    The oracle is anchored to the exact M00-W11 content commit rather than to
    a moving HEAD: later packages (M01-W07 onward) legitimately extend these
    artifacts, and re-pointing the assertion at HEAD would either delete this
    historical proof or force a restamp on every contract change. Reading the
    committed objects keeps the migration evidence permanent and exact.
    """
    expected_trees = {
        "packages/contracts": "c2bcc5af07d638ae6d1f26ff25021a8453d6ced3",
        "packages/contracts/generated": "44faa277a119765b416a3b12d7b1a5b9257968e9",
        "packages/contracts/test/contract/corpus": (
            "deb392dcf0bd1163d2ebb46722ba99ad8fdd6e6f"
        ),
        "packages/contracts/test/contract/baseline": (
            "6ed399ca9b9fddd16f8c93e0c1980a168feeec72"
        ),
    }
    for relative, digest in expected_trees.items():
        actual = subprocess.run(
            ["git", "rev-parse", f"{M00_W11_CONTENT_COMMIT}:{relative}"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        assert actual == digest

    expected_files = {
        "packages/contracts/test/contract/corpus/manifest.v1.json": (
            "f584e46927a11336bb2a30cbc8e4a48fa439a951b1f3e10d13843d0429b14c74"
        ),
        "packages/contracts/test/contract/corpus/cases.v1.json": (
            "dd1ee13b369618ab0d4847be794e2263f18ec85d83bc2c83ab4ae6ea059d7501"
        ),
        "packages/contracts/test/contract/corpus/raw-wire.v1.json": (
            "418a4d9d6211edffe76c61d5c9c68ef684a609022fd93e6a1f97a2700248486e"
        ),
        "packages/contracts/test/contract/corpus/values.v1.json": (
            "66f4fe308f4e1b9ad60ea66b437d2a7514b4b58a8cf4893c0f77e2af9f55aec8"
        ),
        "packages/contracts/test/contract/baseline/structural-signature.v1.json": (
            "a38416153da431890cefbbcd8bf6e7e2d662df98037dbfaddb0099659654af02"
        ),
        "packages/contracts/generated/MANIFEST.json": (
            "5210176505c519cf212c81df5054239087f39b5ed8fe3a125ab99b615db7ede0"
        ),
    }
    for relative, digest in expected_files.items():
        committed = subprocess.run(
            ["git", "show", f"{M00_W11_CONTENT_COMMIT}:{relative}"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
        ).stdout
        assert _sha256(committed) == digest
