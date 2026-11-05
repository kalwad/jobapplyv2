"""Actual coordinator/helper sibling import; no budget/run/native function executes."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Protocol, cast


class _Coordinator(Protocol):
    def load_process_helper(self) -> ModuleType: ...


def test_current_coordinator_loads_the_exact_sibling_helper() -> None:
    path = Path(__file__).resolve().parents[1] / "native_package_ci.py"
    coordinator_name = "_japp_native_package_ci_pin_test"
    helper_name = "_japp_native_package_ci_process"
    previous_coordinator = sys.modules.pop(coordinator_name, None)
    previous_helper = sys.modules.pop(helper_name, None)
    try:
        spec = importlib.util.spec_from_file_location(coordinator_name, path)
        assert spec is not None
        assert spec.loader is not None
        coordinator = importlib.util.module_from_spec(spec)
        sys.modules[coordinator_name] = coordinator
        spec.loader.exec_module(coordinator)
        helper = cast(_Coordinator, coordinator).load_process_helper()
        assert helper is sys.modules[helper_name]
        for member in ("budget", "_validate_budget", "run"):
            assert callable(getattr(helper, member, None))
    finally:
        sys.modules.pop(coordinator_name, None)
        sys.modules.pop(helper_name, None)
        if previous_coordinator is not None:
            sys.modules[coordinator_name] = previous_coordinator
        if previous_helper is not None:
            sys.modules[helper_name] = previous_helper
