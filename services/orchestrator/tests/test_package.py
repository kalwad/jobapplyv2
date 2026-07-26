"""Scaffold smoke test: the Python workspace wiring resolves the package."""

from importlib.metadata import version

import orchestrator


def test_package_version_matches_distribution_metadata() -> None:
    assert orchestrator.__version__ == version("orchestrator")
