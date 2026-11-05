"""Pure generated-model probe; no product service, network, GUI or actor."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pydantic
from pydantic import TypeAdapter, ValidationError

CASE_COUNT = 25


def require(condition: bool, detail: object = "model parity failure") -> None:
    if not condition:
        raise AssertionError(detail)


def main() -> None:
    generated, case_path = map(Path, sys.argv[1:])
    sys.path.insert(0, str(generated / "python/src"))
    modules = {
        "urn:japp:schema:desktop:service-diagnostics:v1": (
            "service_diagnostics_v1",
            "DesktopServiceDiagnosticsV1",
        ),
        "urn:japp:schema:desktop:service-request:v1": (
            "service_request_v1",
            "DesktopServiceRequestV1",
        ),
        "urn:japp:schema:desktop:service-cancellation:v1": (
            "service_cancellation_v1",
            "DesktopServiceCancellationV1",
        ),
    }
    adapters = {}
    for reference, (module, symbol) in modules.items():
        imported = importlib.import_module("japp_contracts.desktop." + module)
        adapters[reference] = TypeAdapter(getattr(imported, symbol))
    cases = json.loads(case_path.read_text())
    matched = 0
    for entry in cases:
        adapter = adapters[entry["ref"]]
        before = json.dumps(entry["instance"], sort_keys=True)
        for mode in ["python", "json"]:
            try:
                model = (
                    adapter.validate_python(entry["instance"])
                    if mode == "python"
                    else adapter.validate_json(json.dumps(entry["instance"]))
                )
            except ValidationError:
                accepted = False
            else:
                accepted = True
                require(model.wire_dict() == entry["instance"], entry["label"])
            require(accepted is entry["valid"], (entry["label"], mode, accepted))
        require(json.dumps(entry["instance"], sort_keys=True) == before)
        matched += 1
    require(pydantic.__version__ == "2.12.5")
    require(matched == len(cases) == CASE_COUNT)
    sys.stdout.write(
        json.dumps(
            {
                "cases": len(cases),
                "matched": matched,
                "pydantic_version": pydantic.__version__,
                "coercion_or_extra_fields": False,
            }
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
