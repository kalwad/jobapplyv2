"UNEXECUTED source counterexamples. No real tool, package, process or network actor."

from __future__ import annotations

import hashlib
import stat
import tempfile
import unittest
import zipfile
from collections.abc import Callable
from pathlib import Path
from typing import TypedDict
from unittest.mock import patch

import pytest
from native_package_pipeline import (
    bind_tool,
    pinned_lock_helper,
    wheel_code,
    windows_build_tools,
)
from wheel_only_runtime_lock import make

W = "1" * 64
S = "2" * 64
REFUSED_LLD = r"^Pinned\ toolchain\ rust-lld\ required$"
REFUSED_LLVM = r"^Pinned\ LLVM\ clang-cl\ and\ llvm-lib\ required$"


class _ToolPin(TypedDict):
    path: str
    resolved_path: str
    sha256: str


class Inputs(unittest.TestCase):
    root: Path

    def setUp(self) -> None:
        owned = tempfile.TemporaryDirectory(prefix="japp-package-fake-")
        self.addCleanup(owned.cleanup)
        self.root = Path(owned.name)
        deny = patch(
            "native_package_pipeline.pinned_process_helper",
            side_effect=AssertionError("NO_PROCESS_IN_FAKE_CASE"),
        )
        deny.start()
        self.addCleanup(deny.stop)

    def locked(
        self, export: str | None = None, extra: str = ""
    ) -> tuple[Path, Path, Path]:
        if export is None:
            export = "foo-bar==1.0.0 " + chr(92) + "\n    --hash=sha256:" + S + "\n"
        source = (
            """version = 1
[[package]]
name = "orchestrator"
version = "0.0.1"
source = { editable = "services/orchestrator" }
dependencies = [{ name = "japp-contracts" }, { name = "foo-bar" }]
[[package]]
name = "japp-contracts"
version = "0.0.1"
source = { editable = "packages/contracts" }
[[package]]
name = "foo-bar"
version = "1.0.0"
source = { registry = "https://pypi.org/simple" }
wheels = [{ url = "https://example.invalid/foo.whl", hash = "sha256:WHEEL" }]
sdist = { url = "https://example.invalid/foo.tar.gz", hash = "sha256:SDIST" }
""".replace("WHEEL", W).replace("SDIST", S)
            + extra
        )
        lock = self.root / "uv.lock"
        lock.write_text(source)
        exported = self.root / "export.txt"
        exported.write_text(export)
        return lock, exported, self.root / "wheels.lock"

    def package(
        self, entries: Callable[[dict[str, bytes]], object] | None = None
    ) -> tuple[Path, Path]:
        source = self.root / "src"
        package = source / "orchestrator"
        package.mkdir(parents=True, exist_ok=True)
        (package / "__init__.py").write_bytes(b"VALUE=1\n")
        (package / "fixture.json").write_bytes(b'{"version":1}\n')
        files = {
            "orchestrator/__init__.py": b"VALUE=1\n",
            "orchestrator/fixture.json": b'{"version":1}\n',
            ("orchestrator-0.0.1.dist-info/METADATA"): (
                b"Name: orchestrator\nVersion: 0.0.1\n"
            ),
            ("orchestrator-0.0.1.dist-info/WHEEL"): (
                b"Wheel-Version: 1.0\nTag: py3-none-any\n"
            ),
            "orchestrator-0.0.1.dist-info/RECORD": b"",
        }
        if entries is not None:
            entries(files)
        wheel = self.root / "project.whl"
        with zipfile.ZipFile(wheel, "w") as out:
            for name, data in files.items():
                out.writestr(name, data)
        return wheel, source

    def test_locked_export_drops_sdist_authorization_and_keeps_exact_wheel(
        self,
    ) -> None:
        args = self.locked()
        result = make(*args)
        text = args[2].read_text()
        packages = result["packages"]
        assert isinstance(packages, list)
        assert W in text
        assert S not in text
        assert len(packages) == 1
        assert result["sdist_hashes_authorized"] == 0
        assert not result["resolution_performed"]

    def test_missing_runtime_dependency_is_refused(self) -> None:
        with pytest.raises(ValueError, match=r"^Empty\ or\ duplicated\ export$"):
            make(*self.locked(export=""))

    def test_extra_development_dependency_is_refused(self) -> None:
        extra = (
            (
                '\n[[package]]\nname="dev-only"\nversion="1.'
                '0.0"\nsource={registry="https://pypi.org/'
                'simple"}\nwheels=[{hash="sha256:'
            )
            + W
            + '"}]\n'
        )
        with pytest.raises(
            ValueError,
            match=r"^Export\ differs\ from\ the\ exact\ locked\ runtime\ closure$",
        ):
            make(*self.locked(export="foo-bar==1.0.0\ndev-only==1.0.0\n", extra=extra))

    def test_unlocked_version_is_refused(self) -> None:
        with pytest.raises(ValueError, match=r"^Export\ version\ is\ not\ locked$"):
            make(*self.locked(export="foo-bar==2.0.0\n"))

    def test_direct_url_is_refused(self) -> None:
        with pytest.raises(
            ValueError,
            match=r"^Non\-exact\ requirement\ in\ locked\ runtime\ export$",
        ):
            make(*self.locked(export="foo-bar @ https://example.invalid/foo.whl\n"))

    def test_sdist_only_lock_is_refused(self) -> None:
        args = self.locked()
        args[0].write_text(
            args[0]
            .read_text()
            .replace(
                'wheels = [{ url = "https://example.invalid/foo.whl", hash = "sha256:'
                + W
                + '" }]',
                "wheels = []",
            )
        )
        with pytest.raises(
            ValueError, match=r"^Exact\ runtime\ wheel\ hash\ unavailable$"
        ):
            make(*args)

    def test_normalized_duplicate_names_are_refused(self) -> None:
        with pytest.raises(ValueError, match=r"^Empty\ or\ duplicated\ export$"):
            make(*self.locked(export="foo-bar==1.0.0\nfoo_bar==1.0.0\n"))

    def test_export_cannot_disable_current_unconditional_dependency(self) -> None:
        with pytest.raises(
            ValueError,
            match=(r"^Unconditional\ runtime\ export\ cannot\ disable\ a\ dependency$"),
        ):
            make(*self.locked(export='foo-bar==1.0.0 ; python_version < "3.0"\n'))

    def test_conditional_graph_is_not_silently_selected(self) -> None:
        args = self.locked()
        args[0].write_text(
            args[0]
            .read_text()
            .replace(
                '{ name = "foo-bar" }',
                '{ name = "foo-bar", marker = "sys_platform == \'win32\'" }',
            )
        )
        with pytest.raises(
            ValueError,
            match=(
                r"^Conditional\ or\ extra\ runtime\ graph\ needs\ explicit\ selection$"
            ),
        ):
            make(*args)

    def test_existing_lock_output_is_preserved(self) -> None:
        args = self.locked()
        args[2].write_bytes(b"OWNED_EXISTING")
        with pytest.raises(ValueError, match=r"^Fresh\ output\ required$"):
            make(*args)
        assert args[2].read_bytes() == b"OWNED_EXISTING"

    def test_complete_package_source_and_resource_are_positive(self) -> None:
        wheel, source = self.package()
        result = wheel_code(wheel, source, "orchestrator")
        assert result["source_package_files"] == 2
        assert result["source_python_files"] == 1
        assert result["all_package_file_bytes_equal"]

    def test_missing_module_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.pop("orchestrator/__init__.py")
        )
        with pytest.raises(
            ValueError,
            match=r"^Wheel\ package\ files\ differ\ from\ exact\ current\ source$",
        ):
            wheel_code(wheel, source, "orchestrator")

    def test_changed_nonpython_package_resource_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update(
                {"orchestrator/fixture.json": b'{"version":2}\n'}
            )
        )
        with pytest.raises(
            ValueError,
            match=r"^Wheel\ package\ files\ differ\ from\ exact\ current\ source$",
        ):
            wheel_code(wheel, source, "orchestrator")

    def test_top_level_pth_install_surface_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update({"unexpected.pth": b"import os\n"})
        )
        with pytest.raises(ValueError, match=r"^Undeclared\ wheel\ install\ surface$"):
            wheel_code(wheel, source, "orchestrator")

    def test_data_script_install_surface_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update(
                {"orchestrator-0.0.1.data/scripts/extra": b"UNDECLARED"}
            )
        )
        with pytest.raises(ValueError, match=r"^Undeclared\ wheel\ install\ surface$"):
            wheel_code(wheel, source, "orchestrator")

    def test_unexpected_entrypoint_metadata_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update(
                {
                    ("orchestrator-0.0.1.dist-info/entry_points.txt"): (
                        b"[console_scripts]\nx=x:y\n"
                    )
                }
            )
        )
        with pytest.raises(ValueError, match=r"^Undeclared\ wheel\ install\ surface$"):
            wheel_code(wheel, source, "orchestrator")

    def test_duplicate_wheel_member_is_refused(self) -> None:
        wheel, source = self.package()
        with (
            zipfile.ZipFile(wheel, "a") as out,
            pytest.warns(
                UserWarning,
                match=(
                    r"^Duplicate name: 'orchestrator"
                    r"/__init__\.py'$"
                ),
            ),
        ):
            out.writestr("orchestrator/__init__.py", b"VALUE=1\n")
        with pytest.raises(ValueError, match=r"^Unsafe\ wheel\ member$"):
            wheel_code(wheel, source, "orchestrator")

    def test_symlink_wheel_member_is_refused(self) -> None:
        wheel, source = self.package()
        with zipfile.ZipFile(wheel, "a") as out:
            info = zipfile.ZipInfo("orchestrator/link")
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            out.writestr(info, b"__init__.py")
        with pytest.raises(
            ValueError, match=r"^Wheel\ member\ must\ be\ a\ regular\ file$"
        ):
            wheel_code(wheel, source, "orchestrator")

    def test_foreign_python_namespace_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update({"foreign/__init__.py": b""})
        )
        with pytest.raises(ValueError, match=r"^Undeclared\ wheel\ install\ surface$"):
            wheel_code(wheel, source, "orchestrator")

    def test_traversal_member_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update({"../outside": b"UNOWNED"})
        )
        with pytest.raises(ValueError, match=r"^Unsafe\ wheel\ member$"):
            wheel_code(wheel, source, "orchestrator")

    def test_native_binary_member_is_refused(self) -> None:
        wheel, source = self.package(
            lambda files: files.update({"orchestrator/native.pyd": b"NOT_PURE"})
        )
        with pytest.raises(ValueError, match=r"^Pure\ code\ input\ required$"):
            wheel_code(wheel, source, "orchestrator")

    def test_changed_helper_is_refused_before_any_loader(self) -> None:
        with (
            patch(
                ("native_package_pipeline.importlib.util.spec_from_file_location"),
                side_effect=AssertionError("LOADER_MUST_NOT_RUN"),
            ),
            pytest.raises(
                ValueError,
                match=(
                    r"^Reviewed\ lock\ helper\ chang"
                    r"ed\ before\ import$"
                ),
            ),
        ):
            pinned_lock_helper("0" * 64)

    def test_tool_alias_must_resolve_to_the_pinned_physical_image(self) -> None:
        tool = self.root / "tool"
        tool.write_bytes(b"FIXED_FAKE_TOOL_NO_EXECUTION")
        row: _ToolPin = {
            "path": str(tool),
            "resolved_path": str(tool.resolve()),
            "sha256": hashlib.sha256(tool.read_bytes()).hexdigest(),
        }
        assert bind_tool(row) == tool
        row["resolved_path"] = str(self.root / "other")
        with pytest.raises(
            ValueError, match=r"^Native\ tool\ alias\ or\ image\ changed$"
        ):
            bind_tool(row)

    def toolchain(self) -> dict[str, Path]:
        root = self.root / "toolchains/1.97.1-x86_64-pc-windows-msvc"
        tools = {
            "rustc_real": root / "bin/rustc.exe",
            "rust_lld": root / "lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe",
            "clang_cl": self.root / "LLVM/bin/clang-cl.exe",
            "llvm_lib": self.root / "LLVM/bin/llvm-lib.exe",
        }
        for path in tools.values():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"FIXED_FAKE_TOOL_NO_EXECUTION")
        return tools

    def test_windows_package_uses_pinned_lld_and_llvm_tools(self) -> None:
        tools = self.toolchain()
        assert windows_build_tools(tools) == {
            "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER": str(tools["rust_lld"]),
            "CC_x86_64_pc_windows_msvc": str(tools["clang_cl"]),
            "CXX_x86_64_pc_windows_msvc": str(tools["clang_cl"]),
            "AR_x86_64_pc_windows_msvc": str(tools["llvm_lib"]),
        }

    def test_windows_package_without_pinned_lld_is_refused(self) -> None:
        tools = self.toolchain()
        del tools["rust_lld"]
        with pytest.raises(ValueError, match=REFUSED_LLD):
            windows_build_tools(tools)

    def test_windows_package_lld_outside_the_toolchain_is_refused(self) -> None:
        tools = self.toolchain()
        foreign = self.root / "elsewhere/rust-lld.exe"
        foreign.parent.mkdir()
        foreign.write_bytes(b"FIXED_FAKE_TOOL_NO_EXECUTION")
        tools["rust_lld"] = foreign
        with pytest.raises(ValueError, match=REFUSED_LLD):
            windows_build_tools(tools)

    def test_windows_package_linker_must_be_rust_lld(self) -> None:
        tools = self.toolchain()
        link = tools["rust_lld"].with_name("link.exe")
        link.write_bytes(b"FIXED_FAKE_TOOL_NO_EXECUTION")
        tools["rust_lld"] = link
        with pytest.raises(ValueError, match=REFUSED_LLD):
            windows_build_tools(tools)

    def test_windows_package_without_pinned_llvm_tools_is_refused(self) -> None:
        tools = self.toolchain()
        for missing in ("clang_cl", "llvm_lib"):
            partial = {name: path for name, path in tools.items() if name != missing}
            with pytest.raises(ValueError, match=REFUSED_LLVM):
                windows_build_tools(partial)

    def test_windows_package_msvc_compiler_or_archiver_is_refused(self) -> None:
        tools = self.toolchain()
        msvc = self.root / "MSVC/bin/Hostx64/x64"
        msvc.mkdir(parents=True)
        for name, image in (("clang_cl", "cl.exe"), ("llvm_lib", "lib.exe")):
            substitute = msvc / image
            substitute.write_bytes(b"FIXED_FAKE_TOOL_NO_EXECUTION")
            with pytest.raises(ValueError, match=REFUSED_LLVM):
                windows_build_tools({**tools, name: substitute})

    def test_windows_package_llvm_tools_from_two_installations_are_refused(
        self,
    ) -> None:
        tools = self.toolchain()
        other = self.root / "Other LLVM/bin/llvm-lib.exe"
        other.parent.mkdir(parents=True)
        other.write_bytes(b"FIXED_FAKE_TOOL_NO_EXECUTION")
        with pytest.raises(ValueError, match=REFUSED_LLVM):
            windows_build_tools({**tools, "llvm_lib": other})


if __name__ == "__main__":
    unittest.main(verbosity=2)
