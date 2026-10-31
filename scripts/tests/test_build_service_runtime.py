import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pytest

SPEC = importlib.util.spec_from_file_location(
    "runtime_builder", Path(__file__).parents[1] / "build-service-runtime.py"
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Native runtime builder source cannot be loaded")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class RuntimeBuilderTests(unittest.TestCase):
    def test_frozen_wheel_hash_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "runtime.whl"
            path.write_bytes(b"owned")
            with pytest.raises(ValueError, match="Frozen wheel identity mismatch"):
                BUILDER.verify_wheel(path, "0" * 64)
            BUILDER.verify_wheel(path, BUILDER.sha256(path))

    def test_existing_user_files_are_never_replaced(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            (path / "unrelated").write_text("retain")
            with pytest.raises(
                ValueError, match="Refusing to replace an existing runtime payload"
            ):
                BUILDER.prepare_destination(path)
            assert (path / "unrelated").read_text() == "retain"

    def test_manifest_contains_whole_actual_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "japp-orchestrator").mkdir()
            (root / "japp-orchestrator/japp-orchestrator").write_bytes(b"native")
            (root / "other").write_bytes(b"dependency")
            actual = BUILDER.write_manifest(root, "aarch64-apple-darwin", {})
            assert {entry["path"] for entry in actual["files"]} == {
                "japp-orchestrator/japp-orchestrator",
                "other",
            }
            assert json.loads((root / "manifest.json").read_text()) == actual

    def test_symlinked_payload_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "japp-orchestrator").mkdir()
            (root / "japp-orchestrator/japp-orchestrator").write_bytes(b"native")
            (root / "link").symlink_to(root / "japp-orchestrator/japp-orchestrator")
            with pytest.raises(ValueError, match="Runtime symlinks are not accepted"):
                BUILDER.write_manifest(root, "aarch64-apple-darwin", {})

    def test_host_target_cannot_claim_a_different_architecture(self) -> None:
        with (
            patch.object(BUILDER.platform, "system", return_value="Darwin"),
            patch.object(BUILDER.platform, "machine", return_value="arm64"),
        ):
            assert BUILDER.host_target() == "aarch64-apple-darwin"


if __name__ == "__main__":
    unittest.main()
