"""Repository-integrity checks: no-ops, bypasses, focus/skip markers."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import validate_status
import verify
from conftest import GOOD_SCRIPTS, REPO_ROOT, make_suite, run_git, write_registry


def _registry() -> verify.Registry:
    return verify.Registry(suites=(), allowed_skips=())


def test_noop_script_detector() -> None:
    noops = (
        "",
        "true",
        ":",
        "exit 0",
        "echo",
        "echo done",
        "echo ok && true",
        "true && true",
        "exit 0 # done",
        "true; :",
    )
    for value in noops:
        assert verify._script_is_noop(value), value
    for value in GOOD_SCRIPTS.values():
        assert not verify._script_is_noop(value), value


def test_missing_required_root_script_fails(fixture_repo: verify.Context) -> None:
    scripts = dict(GOOD_SCRIPTS)
    del scripts["verify"]
    (fixture_repo.repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": scripts}), encoding="utf-8"
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any("required root script missing: 'verify'" in f for f in failures)


def test_traceability_commands_and_source_are_repository_integrity_requirements(
    fixture_repo: verify.Context,
) -> None:
    scripts = dict(GOOD_SCRIPTS)
    del scripts["traceability:check"]
    (fixture_repo.repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": scripts}), encoding="utf-8"
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any(
        "required root script missing: 'traceability:check'" in f for f in failures
    )
    assert "docs/traceability.json" in verify.MEMORY_FILES
    assert "docs/PLATFORM_SUPPORT.md" in verify.MEMORY_FILES
    assert "docs/gates/CROSS_PLATFORM_CORE_GATE.md" in verify.MEMORY_FILES
    assert "docs/platform/MODEL_RUNTIME_PROFILES.md" in verify.MEMORY_FILES
    assert "docs/UI_FAMILIARITY.md" in verify.MEMORY_FILES
    assert "docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md" in verify.MEMORY_FILES
    assert "docs/ui/ANTI_BLOAT_CHECKLIST.md" in verify.MEMORY_FILES
    assert "docs/EXPERIMENTAL_AI_PROVIDERS.md" in verify.MEMORY_FILES
    assert "scripts/traceability.py" in verify.REQUIRED_SCRIPT_FILES


def test_echo_only_script_rejected(fixture_repo: verify.Context) -> None:
    scripts = dict(GOOD_SCRIPTS)
    scripts["lint"] = "echo lint passed"
    (fixture_repo.repo / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": scripts}), encoding="utf-8"
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any("no-op" in f and "'lint'" in f for f in failures)


def test_pass_with_no_tests_bypass_rejected(fixture_repo: verify.Context) -> None:
    config = fixture_repo.repo / "vitest.config.ts"
    config.write_text(
        "export default { test: { " + "passWithNoTests" + ": true } };\n",
        encoding="utf-8",
    )
    run_git(fixture_repo.repo, "add", "-A")
    run_git(fixture_repo.repo, "commit", "-q", "-m", "add bypass")
    tracked = verify.git_tracked_files(fixture_repo)
    failures = verify.check_bypass_tokens(fixture_repo, tracked)
    assert any("vitest.config.ts" in f for f in failures)


def test_focused_and_skipped_ts_tests_rejected(fixture_repo: verify.Context) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    focused = "test" + '.only("focused", () => {});\n'
    spec.write_text(focused, encoding="utf-8")
    run_git(fixture_repo.repo, "add", "-A")
    run_git(fixture_repo.repo, "commit", "-q", "-m", "add focused test")
    failures = verify.check_focused_tests(fixture_repo, ())
    assert any("probe.spec.ts" in f for f in failures)


def test_focus_regex_matches_markers_but_not_lookalikes() -> None:
    assert verify.TS_FOCUS_RE.search("test.only(")
    assert verify.TS_FOCUS_RE.search("describe.skip (")
    assert verify.TS_FOCUS_RE.search("it.fixme(")
    assert verify.TS_FOCUS_RE.search("it.only.each([1, 2])(")
    assert verify.TS_FOCUS_RE.search("test.todo(")
    assert verify.TS_FOCUS_RE.search("bench.only(")
    assert not verify.TS_FOCUS_RE.search("monopoly(")
    assert not verify.TS_FOCUS_RE.search("const only = f(x)")
    assert not verify.TS_FOCUS_RE.search("skipped = testResults.only")
    skip_marker = "@pytest" + ".mark.skip"
    assert verify.PY_SKIP_RE.search(skip_marker)
    assert not verify.PY_SKIP_RE.search("skipped = compute()")


def test_typescript_ast_scan_rejects_conditional_chains_and_static_aliases(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        'test.skipIf(true)("conditional", () => {});\n',
        'it.runIf(false)("conditional", () => {});\n',
        'describe["skipIf"](true)("conditional", () => {});\n',
        (
            'import { bench as measured } from "vitest";\n'
            'measured.runIf(true)("conditional", () => {});\n'
        ),
        (
            "const selected = test;\n"
            'selected.each([1]).runIf(true)("conditional", () => {});\n'
        ),
        (
            'import * as vitest from "vitest";\n'
            "const { skipIf: conditional } = vitest.test;\n"
            'conditional(true)("conditional", () => {});\n'
        ),
        ('const modifier = "skipIf";\ntest[modifier](true)("dynamic", () => {});\n'),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("probe.spec.ts" in failure for failure in failures), source


def test_typescript_ast_scan_allows_unmodified_test_apis_and_lookalikes(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            'import { test as probe } from "vitest";\n'
            'probe.each([1])("ordinary", () => {});\n'
            "const skippedResults = object.onlyForDisplay;\n"
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


def test_typescript_ast_scan_rejects_statically_empty_parameter_tables(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "src" / "probe.test.tsx"
    spec.parent.mkdir(parents=True)
    variants = (
        'test.each([])("empty", () => {});\n',
        'test.each([,])("sparse empty", () => {});\n',
        'test.each(Array.from([]))("empty", () => {});\n',
        'describe.each(Array.from([]))("empty", () => {});\n',
        'test.for(Array.from([]))("empty", () => {});\n',
        'it.for(Array.from([]))("empty", () => {});\n',
        'describe.for(Array.from([]))("empty", () => {});\n',
        'suite.for(Array.from([]))("empty", () => {});\n',
        'test.each(Array.from(...[[]]))("empty", () => {});\n',
        'test.each(Array.of(...[]))("empty", () => {});\n',
        'test.each()("missing", () => {});\n',
        'describe.each()("missing", () => {});\n',
        'test.for()("missing", () => {});\n',
        'it["each"]([])("empty", () => {});\n',
        'describe.concurrent.each([])("empty", () => {});\n',
        'suite.for([])("empty", () => {});\n',
        'let rows = [];\ntest.each(rows)("empty", () => {});\n',
        (
            'import { test as check } from "vitest";\n'
            "const rows = [] as const;\n"
            'check.each(rows)("empty", () => {});\n'
        ),
        (
            'import * as vitest from "vitest";\n'
            "const { each: parameterize } = vitest.test;\n"
            'parameterize(Array.of())("empty", () => {});\n'
        ),
        (
            'const member = "ea" + "ch";\n'
            'test[member](new Array(0))("empty", () => {});\n'
        ),
        'test.extend({}).each([])("empty", () => {});\n',
        'test.each``("empty", () => {});\n',
        'test.each`name | value`("empty", () => {});\n',
        (
            "declare const runtimeValue: string;\n"
            'test.each`name | value\\n${runtimeValue}`("dynamic", () => {});\n'
        ),
        (
            "const rows: number[][] = [];\n"
            "{ const rows = [[1]]; void rows; }\n"
            'test.each(rows)("block shadow", () => {});\n'
        ),
        (
            "const rows: number[][] = [];\n"
            "if (true) { const rows = [[1]]; void rows; }\n"
            'test.each(rows)("conditional shadow", () => {});\n'
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("probe.test.tsx" in failure for failure in failures), source


def test_typescript_ast_scan_rejects_runtime_emptied_const_tables_on_every_surface(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    mutations = (
        "rows.pop();",
        "rows.shift();",
        "rows.splice(0);",
        "rows.splice(0, rows.length);",
        "rows.length = 0;",
        "rows.length--;",
        "--rows.length;",
        "const alias = rows;\nalias.pop();",
        "let alias = rows;\nalias.pop();",
        "var alias = rows;\nalias.pop();",
        "rows['pop']();",
        "Object.assign(rows, { length: 0 });",
        "delete rows[0];",
        "function drain(value: number[][]): void { value.pop(); }\ndrain(rows);",
    )
    surfaces = (
        "test.each",
        "it.each",
        "describe.each",
        "suite.each",
        "test.for",
        "it.for",
        "describe.for",
        "suite.for",
        "bench.each",
        "bench.for",
    )
    for surface in surfaces:
        for mutation in mutations:
            source = (
                "const rows = [[1]];\n"
                f"{mutation}\n"
                f'{surface}(rows)("runtime empty", () => {{}});\n'
            )
            spec.write_text(source, encoding="utf-8")
            failures = verify.check_focused_tests(fixture_repo, ())
            assert any(
                "parameter table" in failure and "probe.test.ts" in failure
                for failure in failures
            ), source


def test_typescript_ast_scan_preserves_point_in_time_nonempty_const_controls(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "const unchanged = [[1]];\n"
            'test.each(unchanged)("unchanged", () => {});\n'
            "const madeNonempty: number[][] = [];\n"
            "madeNonempty.push([1]);\n"
            'test.each(madeNonempty)("made nonempty", () => {});\n'
            "const registeredBeforeMutation = [[1]];\n"
            'test.each(registeredBeforeMutation)("registered", () => {});\n'
            "registeredBeforeMutation.pop();\n"
            "const assignedUndefined: Array<number[] | undefined> = [[1]];\n"
            "assignedUndefined[0] = undefined;\n"
            'test.each(assignedUndefined)("undefined slot", () => {});\n'
            "const deletedSlot: Array<number[] | undefined> = [[1], [2]];\n"
            "delete deletedSlot[0];\n"
            'test.each(deletedSlot)("deleted slot", () => {});\n'
            'test.each([undefined])("occupied undefined", () => {});\n'
            "const wrappedBinding = Array.from(unchanged);\n"
            'test.each(wrappedBinding)("wrapped binding", () => {});\n'
            "const ordinary = [[1]];\n"
            "ordinary.pop();\n"
            'test("ordinary use", () => void ordinary);\n'
            "const scalarArguments = [[1]];\n"
            "const count = 1;\n"
            "console.log(count);\n"
            "const label = 'case';\n"
            "declare function consume(value: string): void;\n"
            "consume(label);\n"
            'test.each(scalarArguments)("scalar arguments", () => {});\n'
            'test.each([[1]])("literal", () => {});\n'
            'test.each(([[1]] as const))("wrapped literal", () => {});\n'
            'test.each(Array.of(...[[1]]))("Array.of", () => {});\n'
            'test.each([].concat([[1]]))("concat", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


def test_typescript_ast_scan_rejects_unprovable_const_tables(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        (
            "declare function runtimeRows(): number[][];\n"
            "const rows = runtimeRows();\n"
            'test.each(rows)("runtime unknown", () => {});\n'
        ),
        (
            "declare function inspect(value: number[][]): void;\n"
            "const rows = [[1]];\n"
            "inspect(rows);\n"
            'test.each(rows)("escaped", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = { rows };\n"
            'test.each(holder.rows)("container escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder: Record<string, unknown> = {};\n"
            "holder.value = rows;\n"
            "holder.value.pop();\n"
            'test.each(rows)("assignment escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            'eval("rows.pop()");\n'
            'test.each(rows)("eval escape", () => {});\n'
        ),
        (
            "declare function inspect(value: unknown): void;\n"
            "const rows = [[1]];\n"
            "inspect({ rows });\n"
            'test.each(rows)("nested object escape", () => {});\n'
        ),
        (
            "declare function inspect(value: unknown): void;\n"
            "const rows = [[1]];\n"
            "inspect([rows]);\n"
            'test.each(rows)("nested array escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const alias = (0, rows);\n"
            "alias.pop();\n"
            'test.each(rows)("comma alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const alias = true ? rows : [];\n"
            "alias.pop();\n"
            'test.each(rows)("conditional alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(value: number[][][]): void { value[0].pop(); }\n"
            "drain([rows]);\n"
            'test.each(rows)("nested call escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(value: number[][]): void { value.pop(); }\n"
            "drain(...[rows]);\n"
            'test.each(rows)("spread call escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(value: number[][]): void { value.pop(); }\n"
            "drain.apply(null, [rows]);\n"
            'test.each(rows)("apply escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(value: number[][]): void { value.pop(); }\n"
            "Reflect.apply(drain, null, [rows]);\n"
            'test.each(rows)("reflect apply escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "try { throw rows; } catch (alias) { alias.pop(); }\n"
            'test.each(rows)("throw escape", () => {});\n'
        ),
        (
            "class Box { constructor(readonly value: number[][]) {} }\n"
            "const rows = [[1]];\n"
            "const box = new Box(rows);\n"
            "box.value.pop();\n"
            'test.each(rows)("constructor escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const box = new Map([['rows', rows]]);\n"
            "box.get('rows')?.pop();\n"
            'test.each(rows)("map escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            '(0, eval)("rows.pop()");\n'
            'test.each(rows)("indirect eval escape", () => {});\n'
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "parameter table cannot be proven safe" in failure for failure in failures
        ), source


def test_typescript_ast_scan_fails_closed_for_repeated_or_conditional_mutation(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        (
            "const rows = [[1], [2]];\n"
            "for (let index = 0; index < 2; index += 1) { rows.pop(); }\n"
            'test.each(rows)("loop emptied", () => {});\n'
        ),
        (
            "const rows = [[1], [2]];\n"
            "function drain(): void { rows.pop(); }\n"
            "drain();\ndrain();\n"
            'test.each(rows)("closure emptied", () => {});\n'
        ),
        (
            "declare const shouldDrain: boolean;\n"
            "const rows = [[1]];\n"
            "if (shouldDrain) { rows.pop(); }\n"
            'test.each(rows)("conditional mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "declare const method: string;\n"
            "rows[method]();\n"
            'test.each(rows)("dynamic mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "(0, rows).pop();\n"
            'test.each(rows)("indirect receiver", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "rows.length = 4294967295;\n"
            'test.each(rows)("oversized length", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "rows[4294967294] = [2];\n"
            'test.each(rows)("oversized index", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "for (const alias of [rows]) { alias.pop(); }\n"
            'test.each(rows)("iterable alias escape", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "class Drain { run(): void { rows.pop(); } }\n"
            "new Drain().run();\n"
            'test.each(rows)("class method mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): boolean { rows.pop(); return true; }\n"
            "rows.filter(drain);\n"
            'test.each(rows)("filter callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): void { rows.pop(); }\n"
            "rows.forEach(drain);\n"
            'test.each(rows)("forEach callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): void { rows.pop(); }\n"
            "const callback = drain;\n"
            "rows.forEach(callback);\n"
            'test.each(rows)("aliased callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): void { rows.pop(); }\n"
            "const callback = drain.bind(null);\n"
            "rows.forEach(callback);\n"
            'test.each(rows)("bound callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): void { rows.pop(); }\n"
            "const callback = (): void => drain();\n"
            "rows.forEach(callback);\n"
            'test.each(rows)("wrapped callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "class Drain { static run(): void { rows.pop(); } }\n"
            "rows.forEach(Drain.run);\n"
            'test.each(rows)("static callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): boolean { rows.pop(); return true; }\n"
            "rows.some(drain);\n"
            'test.each(rows)("some callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): number[] { rows.pop(); return [1]; }\n"
            "Array.from(rows, drain);\n"
            'test.each(rows)("Array.from callback mutation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "drain();\n"
            'test.each(rows)("hoisted late mutation", () => {});\n'
            "function drain(): void { rows.pop(); }\n"
        ),
        (
            "const rows = [[1]];\n"
            "function register(): void {\n"
            '  test.each(rows)("deferred registration", () => {});\n'
            "}\n"
            "rows.pop();\n"
            "register();\n"
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "parameter table cannot be proven safe" in failure for failure in failures
        ), source


def test_typescript_ast_scan_classifies_additional_array_from_cardinalities(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    empty_inputs = (
        "Array.from({ length: 0 })",
        "Array.from({ length: 0 }, (value) => value)",
        "Array.from(new Set())",
        "Array.from(new Map())",
        "Array.from([])",
        'Array.from("")',
    )
    surfaces = (
        "test.each",
        "it.each",
        "describe.each",
        "suite.each",
        "test.for",
        "it.for",
        "describe.for",
        "suite.for",
        "bench.each",
        "bench.for",
    )
    for surface in surfaces:
        for table in empty_inputs:
            source = f'{surface}({table})("empty", () => {{}});\n'
            spec.write_text(source, encoding="utf-8")
            failures = verify.check_focused_tests(fixture_repo, ())
            assert any(
                "empty" in failure and "parameter table" in failure
                for failure in failures
            ), source

    spec.write_text(
        (
            "const key = Symbol('key');\n"
            "test.each(Array.from({ length: 1 }, "
            '(_, index) => index))("one", () => {});\n'
            "test.each(Array.from({ length: 2 }, "
            '(_, index) => index))("two", () => {});\n'
            'test.each(Array.from(new Set([1])))("set", () => {});\n'
            'test.each(Array.from(new Map([[key, 1]])))("map", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


def test_typescript_ast_scan_fails_closed_for_unprovable_array_from_inputs(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        (
            "declare const runtimeLength: number;\n"
            'test.each(Array.from({ length: runtimeLength }))("length", () => {});\n'
        ),
        (
            "declare const runtimeValues: number[];\n"
            'test.each(Array.from(new Set(runtimeValues)))("set", () => {});\n'
        ),
        (
            "declare const runtimeEntries: [string, number][];\n"
            'test.each(Array.from(new Map(runtimeEntries)))("map", () => {});\n'
        ),
        (
            "const Array = { from: () => [] };\n"
            'test.each(Array.from({ length: 1 }))("shadowed Array", () => {});\n'
        ),
        (
            "class Set { constructor(_values?: unknown) {} }\n"
            'test.each(Array.from(new Set()))("shadowed Set", () => {});\n'
        ),
        (
            "class Map { constructor(_values?: unknown) {} }\n"
            'test.each(Array.from(new Map()))("shadowed Map", () => {});\n'
        ),
        'test.each(Array.from())("malformed", () => {});\n',
        (
            "declare function runtimeRows(): number[][];\n"
            'test.each(Array.from(runtimeRows()))("unsupported", () => {});\n'
        ),
        (
            "test.each(Array.from({ length: 4294967295 }))"
            '("bounded scanner", () => {});\n'
        ),
        (
            "test.each(Array.from({ length: 1, "
            "*[Symbol.iterator]() {} }))"
            '("custom iterator", () => {});\n'
        ),
        (
            "test.each(Array.from({ length: 1, length: 0 }))"
            '("duplicate length", () => {});\n'
        ),
        ('test.each(Array.from(new Map([[]])))("malformed map entry", () => {});\n'),
        ('test.each(Array.from(new Map([,])))("sparse map entries", () => {});\n'),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "parameter table cannot be proven safe" in failure for failure in failures
        ), source


def test_nonempty_parameter_table_guard_snapshots_occupied_cases() -> None:
    guard = (REPO_ROOT / "packages/contracts/test/support/parameter-table.ts").as_uri()
    script = f"""
      import {{ assertNonEmptyParameterTable as guard }} from {guard!r};
      const throws = (value) => {{
        try {{ guard(value); return false; }} catch {{ return true; }}
      }};
      const source = [1, 2];
      delete source[0];
      const snapshot = guard(source);
      source.pop();
      class HostileArray extends Array {{
        static get [Symbol.species]() {{ throw new Error("species used"); }}
      }}
      const hostile = new HostileArray();
      hostile.push("case");
      const hostileSnapshot = guard(hostile);
      console.log(JSON.stringify({{
        empty: throws([]),
        sparse: throws(new Array(1)),
        oversized: throws(new Array(10_001)),
        nonArray: throws({{ 0: "case", length: 1 }}),
        undefinedCase: guard([undefined]).length,
        snapshot: [...snapshot],
        snapshotFrozen: Object.isFrozen(snapshot),
        hostile: [...hostileSnapshot],
        hostileIsPlain: hostileSnapshot.constructor === Array,
      }}));
    """
    completed = subprocess.run(
        [
            "node",
            "--no-warnings",
            "--experimental-strip-types",
            "--input-type=module",
            "-e",
            script,
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    assert json.loads(completed.stdout) == {
        "empty": True,
        "sparse": True,
        "oversized": True,
        "nonArray": True,
        "undefinedCase": 1,
        "snapshot": [2],
        "snapshotFrozen": True,
        "hostile": ["case"],
        "hostileIsPlain": True,
    }


def test_typescript_ast_scan_trusts_only_direct_canonical_nonempty_guard(
    fixture_repo: verify.Context,
) -> None:
    support = (
        fixture_repo.repo
        / "packages"
        / "contracts"
        / "test"
        / "support"
        / "parameter-table.ts"
    )
    support.parent.mkdir(parents=True)
    canonical_path = REPO_ROOT / "packages/contracts/test/support/parameter-table.ts"
    canonical_bytes = canonical_path.read_bytes()
    support.write_bytes(canonical_bytes)
    spec = (
        fixture_repo.repo
        / "packages"
        / "contracts"
        / "test"
        / "schema"
        / "probe.test.ts"
    )
    spec.parent.mkdir(parents=True)
    guard_import = (
        "import { assertNonEmptyParameterTable } "
        'from "../support/parameter-table.ts";\n'
    )
    spec.write_text(
        guard_import
        + (
            "declare function runtimeRows(): number[][];\n"
            "const rows = runtimeRows();\n"
            "test.each(assertNonEmptyParameterTable(rows))"
            '("guarded", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []

    variants = (
        guard_import
        + (
            "const alias = assertNonEmptyParameterTable;\n"
            "test.each(alias([[1]].filter(() => false)))"
            '("aliased guard", () => {});\n'
        ),
        guard_import
        + (
            "const guarded = assertNonEmptyParameterTable([[1]]);\n"
            "guarded.pop();\n"
            'test.each(guarded)("stored guard", () => {});\n'
        ),
        guard_import
        + (
            "const assertNonEmptyParameterTable = (rows: unknown[]) => rows;\n"
            "test.each(assertNonEmptyParameterTable([]))"
            '("shadowed guard", () => {});\n'
        ),
    )
    for source in variants:
        support.write_bytes(canonical_bytes)
        spec.write_text(source, encoding="utf-8")
        assert verify.check_focused_tests(fixture_repo, ())

    support.write_bytes(
        canonical_bytes.replace(
            b'throw new Error("parameter table has no occupied cases");',
            b"return snapshot;",
        )
    )
    spec.write_text(
        guard_import
        + (
            'test.each(assertNonEmptyParameterTable([]))("tampered guard", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ())


def test_typescript_ast_scan_fails_closed_for_changed_mutable_tables(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        (
            "let rows = [[1]];\n"
            "rows = [];\n"
            'test.each(rows)("reassigned empty", () => {});\n'
        ),
        (
            "let rows = [];\n"
            "rows = [[1]];\n"
            'test.each(rows)("reassigned nonempty", () => {});\n'
        ),
        (
            "let rows;\n"
            "rows = [];\n"
            'test.each(rows)("assigned after declaration", () => {});\n'
        ),
        ('let rows = [[1]];\nrows.pop();\ntest.each(rows)("mutated", () => {});\n'),
        (
            "let rows = [[1]];\n"
            "rows.length = 0;\n"
            'test.each(rows)("property mutation", () => {});\n'
        ),
        (
            "let rows = [[1]];\n"
            "const alias = rows;\n"
            "alias.pop();\n"
            'test.each(rows)("aliased mutation", () => {});\n'
        ),
        (
            "const alias = [[1]];\n"
            "let rows = alias;\n"
            "alias.pop();\n"
            'test.each(rows)("initializer alias mutation", () => {});\n'
        ),
        (
            "declare function runtimeRows(): number[][];\n"
            "let rows = runtimeRows();\n"
            'test.each(rows)("unknown initializer", () => {});\n'
        ),
        (
            "let rows = [[1]];\n"
            'test.each((rows = []))("assignment expression", () => {});\n'
        ),
        (
            "let rows = [];\n"
            'test.each(rows.slice())("derived after mutation risk", () => {});\n'
        ),
        (
            "let rows = [];\n"
            "const getRows = () => rows;\n"
            'test.each(getRows())("escaped through function", () => {});\n'
        ),
        (
            "let rows = [];\n"
            "const holder = [rows];\n"
            'test.each(holder[0])("escaped through container", () => {});\n'
        ),
        (
            "let rows = [];\n"
            "const [alias] = [rows];\n"
            'test.each(alias)("destructured alias", () => {});\n'
        ),
        (
            "const Array = { from: () => [] };\n"
            'test.each(Array.from([[1]]))("shadowed intrinsic", () => {});\n'
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "test.each parameter table cannot be proven safe" in failure
            for failure in failures
        ), source


def test_typescript_ast_scan_allows_nonempty_array_from_tables(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "declare function runtimeRows(): number[][];\n"
            "let stableRows = [[1]];\n"
            "let stableFrom = Array.from([[1]]);\n"
            'test.each(stableRows)("stable let", () => {});\n'
            'test.each(stableFrom)("stable Array.from let", () => {});\n'
            'test.each(Array.from([[1]]))("nonempty", () => {});\n'
            'describe.each(Array.from(" "))("nonempty string", () => {});\n'
            'test.each(Array.of(...[[1]]))("nonempty spread", () => {});\n'
            'suite.for(Array.from([1], (value) => value))("mapped", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


def test_typescript_ast_scan_covers_all_executed_test_surfaces_and_suffixes(
    fixture_repo: verify.Context,
) -> None:
    expected_suffixes = (
        "js",
        "jsx",
        "ts",
        "tsx",
        "cjs",
        "cjsx",
        "mjs",
        "mjsx",
        "cts",
        "ctsx",
        "mts",
        "mtsx",
    )
    assert expected_suffixes == verify._VITEST_TEST_SUFFIXES
    roots = (
        fixture_repo.repo / "packages" / "probe" / "matrix",
        fixture_repo.repo / "apps" / "probe" / "matrix",
        fixture_repo.repo / "e2e" / "matrix",
    )
    expected: list[str] = []
    for root in roots:
        root.mkdir(parents=True, exist_ok=True)
        for kind in ("test", "spec"):
            for suffix in expected_suffixes:
                path = root / f"probe-{kind}-{suffix}.{kind}.{suffix}"
                path.write_text('test.each([])("empty", () => {});\n', encoding="utf-8")
                expected.append(path.relative_to(fixture_repo.repo).as_posix())

    failures = verify.check_focused_tests(fixture_repo, ())
    assert len(failures) == 1
    for relative_path in expected:
        assert relative_path in failures[0], relative_path
    assert "e2e/matrix/probe-test-ts.test.ts" in failures[0]


def test_missing_lockfile_and_memory_file_fail(fixture_repo: verify.Context) -> None:
    failures = verify.check_integrity(fixture_repo, _registry())
    assert any("pnpm-lock.yaml" in f for f in failures)
    assert any("MASTER_IMPLEMENTATION_SPEC" in f for f in failures)


def test_modified_tracked_file_during_verification_detected(
    fixture_repo: verify.Context,
) -> None:
    tracked_file = fixture_repo.repo / "package.json"
    mutate = [
        sys.executable,
        "-c",
        (
            "from pathlib import Path; "
            f"p = Path({str(tracked_file)!r}); "
            "p.write_text(p.read_text() + '\\n')"
        ),
    ]
    write_registry(fixture_repo.registry_path, [make_suite(commands=[mutate])])
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    neutral = [o for o in outcomes if o.suite.suite_id == "status-neutral"]
    assert neutral
    assert neutral[0].verdict is verify.Verdict.FAIL
    assert "changed during verification" in neutral[0].messages[0]


def test_status_validator_failure_propagates_through_runner(
    fixture_repo: verify.Context, tmp_path: Path
) -> None:
    corrupt = tmp_path / "corrupt_status.md"
    real_status = (REPO_ROOT / "docs/PROJECT_STATUS.md").read_text(encoding="utf-8")
    corrupt.write_text(
        real_status.replace("| `M03-W02` | NOT_STARTED |", "| `M03-W02` | DONE |"),
        encoding="utf-8",
    )
    status_cmd = [
        sys.executable,
        str(REPO_ROOT / "scripts/validate_status.py"),
        "--repo",
        str(REPO_ROOT),
        "--status",
        str(corrupt),
        "--quiet",
    ]
    write_registry(
        fixture_repo.registry_path,
        [make_suite(id="status", commands=[status_cmd])],
    )
    outcomes, exit_code = verify.run_verification(fixture_repo, None)
    assert exit_code == 1
    assert outcomes[0].verdict is verify.Verdict.FAIL


def test_python_skip_marker_rejected_end_to_end(
    fixture_repo: verify.Context,
) -> None:
    probe = fixture_repo.repo / "services" / "orchestrator" / "tests" / "test_probe.py"
    probe.parent.mkdir(parents=True, exist_ok=True)
    marker = "@pytest" + ".mark.skip"
    probe.write_text(f"{marker}\ndef test_probe() -> None: ...\n", encoding="utf-8")
    failures = verify.check_focused_tests(fixture_repo, ())
    assert any("test_probe.py" in f for f in failures)


def test_workspace_package_noop_script_rejected(
    fixture_repo: verify.Context,
) -> None:
    (fixture_repo.repo / "pnpm-workspace.yaml").write_text(
        'packages:\n  - "pkgs/*"\n', encoding="utf-8"
    )
    member = fixture_repo.repo / "pkgs" / "a"
    member.mkdir(parents=True)
    (member / "package.json").write_text(
        json.dumps({"name": "@fixture/a", "scripts": {"typecheck": "true"}}),
        encoding="utf-8",
    )
    failures = verify.check_root_scripts(fixture_repo)
    assert any("@fixture/a" in f and "no-op" in f for f in failures)


# --------------------------------------------------------- tracked text bytes
#
# KI-0018 regression: tracked source/config text files must stay ordinary
# reviewable UTF-8. Raw C0 control bytes (other than tab, LF, and CR, which
# repository text policy delegates to .gitattributes/format tooling) weaken
# reviewability and can hide adversarial content; escaped source
# representations such as "\\0" or "\\u0007" remain the required form.


def _raw_control_bytes(data: bytes) -> set[int]:
    return verify.raw_control_bytes(data)


def _tracked_text_files() -> list[Path]:
    ctx = verify.Context(
        repo=REPO_ROOT,
        registry_path=REPO_ROOT / "scripts" / "verification-suites.json",
        status_path=REPO_ROOT / "docs" / "PROJECT_STATUS.md",
    )
    return [
        REPO_ROOT / rel
        for rel in verify.git_tracked_files(ctx)
        if Path(rel).suffix in verify.TEXT_SOURCE_SUFFIXES
    ]


def test_generator_test_module_contains_no_literal_nul() -> None:
    data = (
        REPO_ROOT
        / "packages"
        / "contracts"
        / "test"
        / "generated"
        / "generator.test.ts"
    ).read_bytes()
    assert b"\x00" not in data
    # The adversarial runtime values survive as escaped source
    # representations, which remain allowed.
    assert b'.join("\\u0000")' in data
    assert b"\\u0007" in data
    assert b"\\u2028" in data


def test_tracked_text_sources_contain_no_raw_control_bytes() -> None:
    offenders: list[str] = []
    scanned = 0
    for path in _tracked_text_files():
        scanned += 1
        data = path.read_bytes()
        if b"\x00" in data:
            offenders.append(f"{path}: literal NUL byte")
            continue
        raw = _raw_control_bytes(data)
        if raw:
            rendered = ", ".join(hex(byte) for byte in sorted(raw))
            offenders.append(f"{path}: raw control byte(s) {rendered}")
    assert scanned > 100, "tracked text-file sweep collapsed unexpectedly"
    assert offenders == []


def test_raw_control_byte_detector_bans_c0_but_respects_text_policy() -> None:
    assert _raw_control_bytes(b"plain text\twith tab\nand lf\r\n") == set()
    assert _raw_control_bytes(b"nul\x00byte") == {0x00}
    assert _raw_control_bytes(b"bel\x07 esc\x1b vt\x0b ff\x0c") == {
        0x07,
        0x1B,
        0x0B,
        0x0C,
    }
    # Escaped source representations are ordinary printable characters.
    escaped_only = b'separator = "\\0"; bell = "\\u0007"'
    assert _raw_control_bytes(escaped_only) == set()


def test_integrity_builtin_rejects_raw_control_byte(
    fixture_repo: verify.Context,
) -> None:
    probe = fixture_repo.repo / "scripts" / "control_probe.PY"
    probe.parent.mkdir(parents=True, exist_ok=True)
    probe.write_bytes(b'probe = "visible"\n# hidden bell: \x07\n')
    run_git(fixture_repo.repo, "add", "-A")
    run_git(fixture_repo.repo, "commit", "-q", "-m", "add raw control")
    failures = verify.check_integrity(fixture_repo, _registry())
    assert any("raw C0 control byte" in failure for failure in failures)


def test_integrity_builtin_rejects_canonical_filename_variant(
    fixture_repo: verify.Context,
) -> None:
    docs = fixture_repo.repo / "docs"
    (docs / "MASTER_IMPLEMENTATION_SPEC.md").write_text(
        validate_status.SPEC_HEADER_MARKER, encoding="utf-8"
    )
    duplicate = docs / "Master Implementation Spec.draft.txt"
    duplicate.write_text("draft", encoding="utf-8")
    run_git(fixture_repo.repo, "add", "-A")
    run_git(fixture_repo.repo, "commit", "-q", "-m", "add duplicate spec")
    failures = verify.check_integrity(fixture_repo, _registry())
    assert any(
        "second canonical-looking specification" in failure
        and "Master Implementation Spec.draft.txt" in failure
        for failure in failures
    )
