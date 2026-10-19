"""Full-byte canonical-spec scanning has a finite buffer and unchanged failures."""

from __future__ import annotations

import io
from collections.abc import Callable
from pathlib import Path
from types import TracebackType

import pytest
import validate_status

READ_BOUND = 64 * 1024


class Probe:
    """Controlled file stream used by the actual shipping scanner."""

    def __init__(
        self, data: bytes, *, bounded: bool = False, fault: str | None = None
    ) -> None:
        self.stream = io.BytesIO(data)
        self.bounded = bounded
        self.fault = fault
        self.sizes: list[int] = []
        self.closed = False
        self.eof = False

    def __enter__(self) -> Probe:
        return self

    def __exit__(
        self,
        _kind: type[BaseException] | None,
        _error: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self.closed = True
        self.stream.close()
        if self.fault == "close":
            raise OSError("owned injected close failure")

    def read(self, size: int = -1) -> bytes:
        self.sizes.append(size)
        if self.bounded:
            assert 0 < size <= READ_BOUND, "unbounded canonical evidence read"
        if self.fault == "read" and (size < 0 or len(self.sizes) > 1):
            raise OSError("owned injected read failure after marker")
        result = self.stream.read(size)
        self.eof = result == b""
        return result


def owned_open(target: Path, probe: Probe) -> Callable[..., Probe]:
    def opened(path: Path, mode: str = "r", *args: object, **kwargs: object) -> Probe:
        assert path == target
        assert mode == "rb"
        assert not args
        assert not kwargs
        if probe.fault == "open":
            raise OSError("owned injected open failure")
        return probe

    return opened


def test_canonical_scan_bounds_reads_and_catches_every_marker_split(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    target = docs / "unrelated.binary"
    target.touch()
    marker = validate_status.SPEC_HEADER_MARKER.encode()
    # Include every split across a real read boundary, with non-UTF8 bytes.
    for start in range(READ_BOUND - len(marker), READ_BOUND + 1):
        probe = Probe(
            b"\xff" * start + marker + b"\x00" * (READ_BOUND + 7), bounded=True
        )

        with monkeypatch.context() as patch:
            patch.setattr(Path, "open", owned_open(target, probe))
            assert validate_status.canonical_spec_offenders(tmp_path) == [
                "docs/unrelated.binary"
            ]
        assert probe.closed
        assert probe.eof
        assert len(probe.sizes) >= 3, "scan stopped before EOF after finding marker"
        assert set(probe.sizes) == {READ_BOUND}


def test_canonical_scan_keeps_open_read_close_errors_and_name_matches(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    marker = validate_status.SPEC_HEADER_MARKER.encode()
    for index, (fault, name) in enumerate(
        (fault, name)
        for fault in ("open", "read", "close")
        for name in ("ordinary.bin", "master_implementation_spec.copy")
    ):
        repo = tmp_path / str(index)
        docs = repo / "docs"
        docs.mkdir(parents=True)
        target = docs / name
        target.touch()
        probe = Probe(marker + b"\x00" * (2 * READ_BOUND), fault=fault)

        with monkeypatch.context() as patch:
            patch.setattr(Path, "open", owned_open(target, probe))
            # A read/close failure must discard even an already-seen marker;
            # the independent filename predicate must still reject lookalikes.
            expected = [] if name == "ordinary.bin" else [f"docs/{name}"]
            assert validate_status.canonical_spec_offenders(repo) == expected
        assert probe.closed == (fault != "open")


def test_canonical_scan_preserves_late_binary_marker_and_empty_file(
    tmp_path: Path,
) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    marker = validate_status.SPEC_HEADER_MARKER.encode()
    (docs / "MASTER_IMPLEMENTATION_SPEC.md").write_bytes(marker)
    (docs / "empty.bin").write_bytes(b"")
    (docs / "late.binary").write_bytes(b"\xff" * (3 * READ_BOUND - 1) + marker)
    (docs / "negative.binary").write_bytes(b"\xff" * (3 * READ_BOUND) + marker[:-1])
    assert validate_status.canonical_spec_offenders(tmp_path) == ["docs/late.binary"]
