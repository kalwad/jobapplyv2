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

    helper = spec.parent / "helper.ts"
    cross_file_variants = (
        (
            'export { test as check } from "vitest";\n',
            'import { check } from "./helper";\ncheck.fails("expected", () => {});\n',
        ),
        (
            'import { test } from "vitest";\nexport default test;\n',
            'import check from "./helper";\ncheck.fails("expected", () => {});\n',
        ),
        (
            (
                'import { test } from "vitest";\n'
                "export function getCheck() { return test; }\n"
            ),
            (
                'import { getCheck } from "./helper";\n'
                'getCheck().fails("expected", () => {});\n'
            ),
        ),
        (
            (
                'import { test } from "vitest";\n'
                "export function expectedFailure(): void {\n"
                '  test.fails("laundered expected failure", () => {\n'
                '    throw new Error("expected");\n'
                "  });\n"
                "}\n"
            ),
            ('import { expectedFailure } from "./helper";\nexpectedFailure();\n'),
        ),
    )
    for helper_source, source in cross_file_variants:
        helper.write_text(helper_source, encoding="utf-8")
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "probe.spec.ts" in failure or "helper.ts" in failure for failure in failures
        ), source


def test_typescript_ast_scan_follows_static_dynamic_import_helpers(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    helper = fixture_repo.repo / "e2e" / "xhelper.ts"
    spec.parent.mkdir(parents=True)
    helper.write_text(
        (
            'import { test } from "vitest";\n'
            'test.fails("laundered expected failure", () => {\n'
            '  throw new Error("expected");\n'
            "});\n"
        ),
        encoding="utf-8",
    )
    variants = (
        'await import("./x" + "helper.ts");\n',
        'const helperPath = "./xhelper.ts";\nawait import(helperPath);\n',
        ('const helperStem = "helper";\nawait import(`./x${helperStem}.ts`);\n'),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("xhelper.ts" in failure for failure in failures), source


def test_typescript_ast_scan_fails_closed_on_unresolved_dynamic_import(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        "declare const helperPath: string;\nawait import(helperPath);\n",
        (
            "declare function helperStem(): string;\n"
            "await import(`./x${helperStem()}.ts`);\n"
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "dynamic import" in failure and "probe.spec.ts" in failure
            for failure in failures
        ), source


def test_typescript_ast_scan_allows_bounded_ordinary_dynamic_imports(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    helper = fixture_repo.repo / "e2e" / "ordinary-helper.ts"
    spec.parent.mkdir(parents=True)
    helper.write_text(
        "export const ordinary = { fails(): void {} };\n",
        encoding="utf-8",
    )
    variants = (
        'await import("node:fs");\n',
        'const moduleName = "node:fs";\nawait import(moduleName);\n',
        'await import("./ordinary-" + "helper.ts");\n',
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        assert verify.check_focused_tests(fixture_repo, ()) == [], source


def test_typescript_ast_scan_rejects_expected_fail_modifiers(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "e2e" / "probe.spec.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        'test.fails("expected failure", () => { throw new Error(); });\n',
        'it.fails("expected failure", () => { throw new Error(); });\n',
        (
            'import { test as check } from "vitest";\n'
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const check = test;\n"
            'check["fa" + "ils"]("expected failure", () => { throw new Error(); });\n'
        ),
        ('(0, test).fails("expected failure", () => { throw new Error(); });\n'),
        (
            "const holder = { check: test };\n"
            'holder.check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const other = { fails(): void {} };\n"
            "let check = other;\n"
            "check = test;\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const [check] = [test];\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const { check } = { check: test };\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        ('[test][0].fails("expected failure", () => { throw new Error(); });\n'),
        (
            "const holder = [test];\n"
            'holder[0].fails("expected failure", () => { throw new Error(); });\n'
        ),
        ('(() => test)().fails("expected failure", () => { throw new Error(); });\n'),
        (
            "const check = (() => test)();\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "declare const choose: boolean;\n"
            "const ordinary = { fails(): void {} };\n"
            "(choose ? test : ordinary).fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "declare const maybe: typeof test | undefined;\n"
            "(maybe ?? test).fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const invoke = (check = test): void => {\n"
            '  check.fails("expected failure", () => { throw new Error(); });\n'
            "};\n"
            "invoke();\n"
        ),
        (
            "const ordinary = { fails(): void {} };\n"
            "let check = ordinary;\n"
            "[check] = [test];\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const ordinary = { fails(): void {} };\n"
            "let check = ordinary;\n"
            "({ check } = { check: test });\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const ordinary = { fails(): void {} };\n"
            "const holder = { check: ordinary };\n"
            "holder.check = test;\n"
            'holder.check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            'import * as vitest from "vitest";\n'
            "const holder = { check: vitest.test };\n"
            'holder.check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            'import * as vitest from "vitest";\n'
            "const { test: check } = vitest;\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            'const vitest = await import("vitest");\n'
            'vitest.test.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const holder = { get check() { return test; } };\n"
            'holder.check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const check = [test].at(0)!;\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "Object.values({ check: test })[0].fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "Object.assign({}, { check: test }).check.fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            'Reflect.get({ check: test }, "check").fails'
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            'const fail = Reflect.get(test, "fails");\n'
            'fail("expected failure", () => { throw new Error(); });\n'
        ),
        (
            'new Map([["check", test]]).get("check")!.fails'
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "new Set([test]).values().next().value.fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const check = await Promise.resolve(test);\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "const check = await (async () => test)();\n"
            'check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "class Holder { static check = test; }\n"
            'Holder.check.fails("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "class Holder { check = test; }\n"
            "new Holder().check.fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        (
            "Object.create(null, { check: { value: test } }).check.fails"
            '("expected failure", () => { throw new Error(); });\n'
        ),
        ('test.fails.each([1])("expected failure", () => { throw new Error(); });\n'),
        ('test.fails.for([1])("expected failure", () => { throw new Error(); });\n'),
        ('test.concurrent.fails("expected failure", () => { throw new Error(); });\n'),
        ('test.fails.concurrent("expected failure", () => { throw new Error(); });\n'),
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
            'import "not-vitest";\n'
            'import { test as probe } from "vitest";\n'
            'probe.each([1])("ordinary", () => {});\n'
            "const skippedResults = object.onlyForDisplay;\n"
            "const ordinary = { fails(): void {} };\n"
            "(0, ordinary).fails();\n"
            "const holder = { check: ordinary };\n"
            "holder.check.fails();\n"
            "let check = probe;\n"
            "check = ordinary;\n"
            "check.fails();\n"
            "function use(test: { fails(): void }): void { test.fails(); }\n"
            "void use;\n"
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []

    controls = (
        (
            "const rows = [[1]];\n"
            "(function* (): Generator<void> { rows.pop(); })();\n"
            'test.each(rows)("uniterated generator", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "(async function* (): AsyncGenerator<void> { rows.pop(); })();\n"
            'test.each(rows)("uniterated async generator", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = { cb: (): number[] | undefined => rows.pop() };\n"
            "void holder;\n"
            'test.each(rows)("unused object callback", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const alias = ((): number[][] => rows)();\n"
            "void alias;\n"
            'test.each(rows)("returned alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "let alias = rows;\n"
            "alias = [];\n"
            "alias.pop();\n"
            'test.each(rows)("overwritten alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const ordinaryRows = [[2]];\n"
            "function drain(table = rows): void { table.pop(); }\n"
            "drain(ordinaryRows);\n"
            'test.each(rows)("explicit default override", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  *drain(): Generator<number> { rows.pop(); yield 1; },\n"
            "};\n"
            "void holder.drain();\n"
            'test.each(rows)("unadvanced object generator", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function* drain(): Generator<number> { rows.pop(); yield 1; }\n"
            "void drain();\n"
            'test.each(rows)("unadvanced named generator", () => {});\n'
        ),
    )
    for source in controls:
        spec.write_text(source, encoding="utf-8")
        assert verify.check_focused_tests(fixture_repo, ()) == [], source

    spec.write_text(
        ("const test = { fails(): void {} };\ntest.fails();\n"),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []

    spec.write_text(
        ('import { test } from "not-vitest";\ntest.fails();\n'),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []

    helper = spec.parent / "helper.ts"
    helper.write_text(
        (
            "export function ordinaryHelper(\n"
            "  value: { fails(): void },\n"
            "): void {\n"
            "  value.fails();\n"
            "}\n"
        ),
        encoding="utf-8",
    )
    spec.write_text(
        (
            'import { ordinaryHelper } from "./helper";\n'
            "ordinaryHelper({ fails(): void {} });\n"
            "const ordinary = { fails(): void {} };\n"
            'const fail = Reflect.get(ordinary, "fails");\n'
            "fail();\n"
            "const LocalReflect = {\n"
            '  get(value: { fails(): void }, _member: "fails"): () => void {\n'
            "    return value.fails;\n"
            "  },\n"
            "};\n"
            'LocalReflect.get(ordinary, "fails");\n'
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


def test_typescript_ast_scan_rejects_executed_local_callable_mutations(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        (
            "const rows = [[1]];\n"
            "((): void => { rows.length = 0; })();\n"
            'test.each(rows)("direct IIFE", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "((): void => { ((): void => { rows.length = 0; })(); })();\n"
            'test.each(rows)("nested IIFE", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): void { rows.length = 0; }\n"
            "drain.call(undefined);\n"
            'test.each(rows)("named call", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(): void { rows.length = 0; }\n"
            "drain.apply(undefined, []);\n"
            'test.each(rows)("named apply", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = function (): void { rows.length = 0; };\n"
            "drain();\n"
            'test.each(rows)("function expression", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "drain();\n"
            'test.each(rows)("arrow", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "drain.bind(undefined)();\n"
            'test.each(rows)("immediately bound callable", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "new (class {\n"
            "  constructor() { rows.length = 0; }\n"
            "})();\n"
            'test.each(rows)("anonymous constructor", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const Drain = class {\n"
            "  constructor() { rows.length = 0; }\n"
            "};\n"
            "new Drain();\n"
            'test.each(rows)("local constructor", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const Drain = class { run(): void { rows.pop(); } };\n"
            "const instance = new Drain();\n"
            "instance.run();\n"
            'test.each(rows)("class alias method", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = { drain(): void { rows.pop(); } };\n"
            "rows.forEach(holder.drain);\n"
            'test.each(rows)("object method callback", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(table = rows): void { table.pop(); }\n"
            "drain();\n"
            'test.each(rows)("default parameter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = { get table(): number[][] { return rows; } };\n"
            "holder.table.pop();\n"
            'test.each(rows)("getter alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = { drain(): void { rows.pop(); } };\n"
            "await Promise.resolve().then(holder.drain);\n"
            'test.each(rows)("promise callback", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "class Holder { table = rows; }\n"
            "new Holder().table.pop();\n"
            'test.each(rows)("instance field alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "class Holder { static table = rows; }\n"
            "Holder.table.pop();\n"
            'test.each(rows)("static field alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(\n"
            "  { table = rows }: { table?: number[][] } = {},\n"
            "): void { table.pop(); }\n"
            "drain();\n"
            'test.each(rows)("nested default parameter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  *drain(): Generator<number> { rows.pop(); yield 1; },\n"
            "};\n"
            "holder.drain().next();\n"
            'test.each(rows)("advanced generator", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const original = (): void => { rows.length = 0; };\n"
            "const drain = original;\n"
            "drain();\n"
            'test.each(rows)("callable alias", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "((): void => { rows.length = 0; }).call(undefined);\n"
            'test.each(rows)("IIFE call", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "((): void => { rows.length = 0; }).apply(undefined, []);\n"
            'test.each(rows)("IIFE apply", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "void (async (): Promise<void> => { rows.length = 0; })();\n"
            'test.each(rows)("async IIFE", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "await (async (): Promise<void> => {\n"
            "  await Promise.resolve();\n"
            "  rows.length = 0;\n"
            "})();\n"
            'test.each(rows)("awaited async IIFE", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "((table: number[][]): void => { table.length = 0; })(rows);\n"
            'test.each(rows)("IIFE argument", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "if (true) { ((): void => { rows.length = 0; })(); }\n"
            'test.each(rows)("literal true call", () => {});\n'
        ),
        (
            "declare const shouldDrain: boolean;\n"
            "const rows = [[1]];\n"
            "if (shouldDrain) { ((): void => { rows.length = 0; })(); }\n"
            'test.each(rows)("conditional call", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "(0, drain)();\n"
            'test.each(rows)("comma-selected call", () => {});\n'
        ),
        (
            "declare const shouldDrain: boolean;\n"
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const keep = (): void => {};\n"
            "(shouldDrain ? drain : keep)();\n"
            'test.each(rows)("conditional callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const selected = (0, drain);\n"
            "selected();\n"
            'test.each(rows)("stored comma callee", () => {});\n'
        ),
        (
            "declare const shouldDrain: boolean;\n"
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const keep = (): void => {};\n"
            "const selected = shouldDrain ? drain : keep;\n"
            "selected();\n"
            'test.each(rows)("stored conditional callee", () => {});\n'
        ),
        (
            "declare const shouldDrain: boolean;\n"
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const selected = shouldDrain && drain;\n"
            "if (selected) { selected(); }\n"
            'test.each(rows)("stored logical callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const [selected] = [drain];\n"
            "selected();\n"
            'test.each(rows)("destructured array callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const { run: selected } = { run: drain };\n"
            "selected();\n"
            'test.each(rows)("destructured object callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const holder = { run: drain };\n"
            "holder.run();\n"
            'test.each(rows)("stored object member callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "let selected: () => void;\n"
            "selected = drain;\n"
            "selected();\n"
            'test.each(rows)("assigned callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "let first: () => void;\n"
            "let selected: () => void;\n"
            "selected = first = drain;\n"
            "selected();\n"
            'test.each(rows)("chained assigned callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "let selected: () => void;\n"
            "[selected] = [drain];\n"
            "selected();\n"
            'test.each(rows)("destructuring assigned callee", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const keep = (): void => {};\n"
            "const holder = { run: keep };\n"
            "holder.run = drain;\n"
            "holder.run();\n"
            'test.each(rows)("assigned object member", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const drain = (): void => { rows.length = 0; };\n"
            "const keep = (): void => {};\n"
            "const holder = [keep];\n"
            "[holder[0]] = [drain];\n"
            "holder[0]();\n"
            'test.each(rows)("assigned array member", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "function drain(_strings: TemplateStringsArray): void {\n"
            "  rows.length = 0;\n"
            "}\n"
            "drain``;\n"
            'test.each(rows)("tagged invocation", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            "void holder.run;\n"
            'test.each(rows)("executed getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            "const { run } = holder;\n"
            "void run;\n"
            'test.each(rows)("destructuring getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            "const copy = { ...holder };\n"
            "void copy;\n"
            'test.each(rows)("spread getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  set run(_value: number) { rows.length = 0; },\n"
            "};\n"
            "holder.run = 1;\n"
            'test.each(rows)("executed setter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            'Reflect.get(holder, "run");\n'
            'test.each(rows)("Reflect getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  set run(_value: number) { rows.length = 0; },\n"
            "};\n"
            'Reflect.set(holder, "run", 1);\n'
            'test.each(rows)("Reflect setter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  set run(_value: number) { rows.length = 0; },\n"
            "};\n"
            "Object.assign(holder, { run: 1 });\n"
            'test.each(rows)("Object.assign setter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            'Object.getOwnPropertyDescriptor(holder, "run")!.get!.call(holder);\n'
            'test.each(rows)("descriptor getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            'const { get } = Object.getOwnPropertyDescriptor(holder, "run")!;\n'
            "get!.call(holder);\n"
            'test.each(rows)("destructured descriptor getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            "Object.values(holder);\n"
            'test.each(rows)("Object.values getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            "Object.entries(holder);\n"
            'test.each(rows)("Object.entries getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "};\n"
            "JSON.stringify(holder);\n"
            'test.each(rows)("JSON.stringify getter", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const holder = {\n"
            "  toJSON(): object { rows.length = 0; return {}; },\n"
            "};\n"
            "JSON.stringify(holder);\n"
            'test.each(rows)("JSON.stringify toJSON", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const iterable = {\n"
            "  *[Symbol.iterator](): Generator<never> {\n"
            "    rows.length = 0;\n"
            "    return undefined as never;\n"
            "  },\n"
            "};\n"
            "[...iterable];\n"
            'test.each(rows)("iterator protocol", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const value = {\n"
            "  [Symbol.toPrimitive](): number {\n"
            "    rows.length = 0;\n"
            "    return 0;\n"
            "  },\n"
            "};\n"
            "void +value;\n"
            'test.each(rows)("coercion protocol", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const value = {\n"
            '  toString(): string { rows.length = 0; return ""; },\n'
            "};\n"
            "void `${value}`;\n"
            'test.each(rows)("string coercion protocol", () => {});\n'
        ),
        (
            "const rows = [[1]];\n"
            "const value = {\n"
            "  [Symbol.toPrimitive](): number {\n"
            "    rows.length = 0;\n"
            "    return 0;\n"
            "  },\n"
            "};\n"
            "function coerce(input: object): void { void +input; }\n"
            "coerce(value);\n"
            'test.each(rows)("local coercion", () => {});\n'
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any(
            "parameter table" in failure and "probe.test.ts" in failure
            for failure in failures
        ), source


def test_typescript_ast_scan_does_not_execute_uncalled_local_callable_bodies(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "const rows = [[1]];\n"
            "function named(): void { rows.length = 0; }\n"
            "const arrow = (): void => { rows.length = 0; };\n"
            "const expression = function (): void { rows.length = 0; };\n"
            "void named;\n"
            "void arrow;\n"
            "void expression;\n"
            'test("ordinary callback", () => { rows.length = 0; });\n'
            "if (false) { ((): void => { rows.length = 0; })(); }\n"
            "const keep = (): void => {};\n"
            "keep.bind(undefined)();\n"
            "new (class { constructor() { const marker = 1; void marker; } })();\n"
            "(true ? keep : arrow)();\n"
            "(arrow, keep)();\n"
            "const storedKeep = (0, keep);\n"
            "storedKeep();\n"
            "const [destructuredKeep] = [keep];\n"
            "destructuredKeep();\n"
            "const { run: objectKeep } = { run: keep };\n"
            "objectKeep();\n"
            "const holder = { run: keep };\n"
            "holder.run();\n"
            "let overwritten = arrow;\n"
            "overwritten = keep;\n"
            "overwritten();\n"
            "const overwrittenHolder = { run: arrow };\n"
            "overwrittenHolder.run = keep;\n"
            "overwrittenHolder.run();\n"
            "function tagged(_strings: TemplateStringsArray): void {\n"
            "  rows.length = 0;\n"
            "}\n"
            "const implicit = {\n"
            "  get run(): number { rows.length = 0; return 1; },\n"
            "  *[Symbol.iterator](): Generator<never> {\n"
            "    rows.length = 0;\n"
            "    return undefined as never;\n"
            "  },\n"
            "  [Symbol.toPrimitive](): number {\n"
            "    rows.length = 0;\n"
            "    return 0;\n"
            "  },\n"
            "};\n"
            "void tagged;\n"
            "void implicit;\n"
            "function keep(value: object): void { void value; }\n"
            "keep(implicit);\n"
            "void Boolean(implicit);\n"
            "delete implicit.run;\n"
            "Object.keys(implicit);\n"
            "Object.getOwnPropertyDescriptors(implicit);\n"
            "JSON.stringify({ value: 1 });\n"
            "const localObject = { value: 1 };\n"
            "localObject.value = 2;\n"
            "if (false) {\n"
            "  tagged``; void implicit.run; [...implicit]; void +implicit;\n"
            "}\n"
            'test.each(rows)("still registered", () => {});\n'
            "tagged``;\n"
            "void implicit.run;\n"
            "[...implicit];\n"
            "void +implicit;\n"
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


def test_typescript_ast_scan_models_array_concat_cardinality(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    emptied = (
        "rows.pop();",
        "rows.shift();",
        "rows.splice(0, 1);",
        "delete rows[0];",
        "rows.length = 0;",
    )
    for mutation in emptied:
        source = (
            'const rows = ([] as unknown[]).concat("abc");\n'
            f"{mutation}\n"
            'test.each(rows)("empty concat", () => {});\n'
        )
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("empty test.each parameter table" in failure for failure in failures)

    spec.write_text(
        (
            'test.each(([] as unknown[]).concat("abc"))("string", () => {});\n'
            'const stringAlias = "abc";\n'
            "test.each(([] as unknown[]).concat(stringAlias))"
            '("string alias", () => {});\n'
            "test.each(([] as unknown[]).concat(1))"
            '("number", () => {});\n'
            "test.each(([] as unknown[]).concat(false))"
            '("boolean", () => {});\n'
            "test.each(([] as unknown[]).concat(null))"
            '("null", () => {});\n'
            "test.each(([] as unknown[]).concat(undefined))"
            '("undefined", () => {});\n'
            "test.each(([] as unknown[]).concat({ value: 1 }))"
            '("object", () => {});\n'
            "test.each(([] as unknown[]).concat([[1], [2]]))"
            '("dense array", () => {});\n'
            "test.each(([] as unknown[]).concat([[[1], [2]]]))"
            '("nested array", () => {});\n'
            "test.each(([] as unknown[]).concat(...[[[1], [2]]]))"
            '("spread array argument", () => {});\n'
            'const spreadAlias = ["abc"];\n'
            "test.each(([] as unknown[]).concat(...spreadAlias))"
            '("spread alias", () => {});\n'
            'test.each(([] as unknown[]).concat(...["abc"]))'
            '("spread scalar argument", () => {});\n'
            "test.each(([] as unknown[]).concat({\n"
            "  0: [1], 1: [2], length: 2,\n"
            "  [Symbol.isConcatSpreadable]: true,\n"
            '}))("spreadable", () => {});\n'
            "test.each(([] as unknown[]).concat({\n"
            "  0: [1], length: 1,\n"
            "  [Symbol.isConcatSpreadable]: false,\n"
            '}))("not spreadable", () => {});\n'
            "const source = [[1], [2]];\n"
            "const alias = source;\n"
            'test.each(([] as unknown[]).concat(alias))("alias", () => {});\n'
            'const concatRows = ([] as unknown[]).concat("abc");\n'
            "let concatAlias = concatRows;\n"
            "concatAlias = [];\n"
            "concatAlias.pop();\n"
            'test.each(concatRows)("overwritten result alias", () => {});\n'
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


def test_typescript_ast_scan_fails_closed_for_unknown_concat_semantics(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    variants = (
        (
            "declare const spreadable: boolean;\n"
            "const rows = ([] as unknown[]).concat({\n"
            "  0: [1], length: 1,\n"
            "  [Symbol.isConcatSpreadable]: spreadable,\n"
            "});\n"
            'test.each(rows)("runtime spreadability", () => {});\n'
        ),
        (
            "class Rows extends Array<number[]> {}\n"
            "const rows = ([] as unknown[]).concat(new Rows([1]));\n"
            'test.each(rows)("subclass", () => {});\n'
        ),
        (
            "declare function runtimeRows(): number[][];\n"
            "const rows = ([] as unknown[]).concat(runtimeRows());\n"
            'test.each(rows)("runtime derived", () => {});\n'
        ),
        (
            "const Array = (...values: number[][]): number[][] => values;\n"
            "const rows = Array([1]).concat([[2]]);\n"
            'test.each(rows)("shadowed Array", () => {});\n'
        ),
        (
            "declare const values: number[][][];\n"
            "const rows = ([] as unknown[]).concat(...values);\n"
            'test.each(rows)("runtime spread", () => {});\n'
        ),
        (
            "const source = [[1], [2]];\n"
            "source.pop();\n"
            "const rows = ([] as unknown[]).concat(source);\n"
            "rows.pop();\n"
            'test.each(rows)("mutated array argument", () => {});\n'
        ),
        (
            "const values = [[1], [2]];\n"
            "values.pop();\n"
            "const rows = ([] as unknown[]).concat(...values);\n"
            "rows.pop();\n"
            'test.each(rows)("mutated spread argument", () => {});\n'
        ),
        (
            "const source = {\n"
            "  0: [1], 1: [2], length: 2,\n"
            "  [Symbol.isConcatSpreadable]: true,\n"
            "};\n"
            "source[Symbol.isConcatSpreadable] = false;\n"
            "const rows = ([] as unknown[]).concat(source);\n"
            "rows.pop();\n"
            'test.each(rows)("mutated spreadability", () => {});\n'
        ),
        (
            "Object.prototype[Symbol.isConcatSpreadable] = true;\n"
            "const rows = ([] as unknown[]).concat({ length: 0 });\n"
            'test.each(rows)("inherited spreadability", () => {});\n'
        ),
        (
            "Object.defineProperty(Object.prototype, Symbol.isConcatSpreadable, {\n"
            "  value: true,\n"
            "});\n"
            "const rows = ([] as unknown[]).concat({ length: 0 });\n"
            'test.each(rows)("defined inherited spreadability", () => {});\n'
        ),
        (
            "Array.prototype.concat = function (): unknown[] { return []; };\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("overridden concat", () => {});\n'
        ),
        (
            "Array.prototype.splice = function (): unknown[] {\n"
            "  this.length = 0;\n"
            "  return [];\n"
            "};\n"
            'const rows = ([] as unknown[]).concat("abc", "def");\n'
            "rows.splice(0, 0);\n"
            'test.each(rows)("overridden splice", () => {});\n'
        ),
        (
            "Array.prototype.pop = function (): unknown {\n"
            "  this.length = 0;\n"
            "  return undefined;\n"
            "};\n"
            'const rows = ([] as unknown[]).concat("abc", "def");\n'
            "rows.pop();\n"
            'test.each(rows)("overridden pop", () => {});\n'
        ),
        (
            "Array.prototype.shift = function (): unknown {\n"
            "  this.length = 0;\n"
            "  return undefined;\n"
            "};\n"
            'const rows = ([] as unknown[]).concat("abc", "def");\n'
            "rows.shift();\n"
            'test.each(rows)("overridden shift", () => {});\n'
        ),
        (
            'const rows = ([] as unknown[]).concat("abc", "def");\n'
            "Array.prototype.splice = function (): unknown[] {\n"
            "  this.length = 0;\n"
            "  return [];\n"
            "};\n"
            "rows.splice(0, 0);\n"
            'test.each(rows)("late overridden splice", () => {});\n'
        ),
        (
            "class Species extends Array<unknown> {\n"
            "  override splice(): unknown[] {\n"
            "    this.length = 0;\n"
            "    return [];\n"
            "  }\n"
            "}\n"
            "Object.defineProperty(Array, Symbol.species, {\n"
            "  configurable: true,\n"
            "  value: Species,\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            "rows.splice(0, 0);\n"
            'test.each(rows)("overridden species", () => {});\n'
        ),
        (
            'Object.defineProperty((0, Array.prototype), "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("comma-wrapped prototype", () => {});\n'
        ),
        (
            'Object.defineProperty((true ? Array.prototype : {}), "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("conditional prototype", () => {});\n'
        ),
        (
            "const prototype = (0, Array.prototype);\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("stored wrapped prototype", () => {});\n'
        ),
        (
            "Object.defineProperty(...[\n"
            "  Array.prototype,\n"
            '  "concat",\n'
            "  { value: function (): unknown[] { return []; } },\n"
            "]);\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("spread mutation arguments", () => {});\n'
        ),
        (
            "Reflect.apply(Object.defineProperty, Object, [\n"
            "  Array.prototype,\n"
            '  "concat",\n'
            "  { value: function (): unknown[] { return []; } },\n"
            "]);\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("nested mutation arguments", () => {});\n'
        ),
        (
            "const [prototype] = [Array.prototype];\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("destructured prototype", () => {});\n'
        ),
        (
            "const [ArrayAlias] = [Array];\n"
            "ArrayAlias.prototype.concat = function (): unknown[] { return []; };\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("destructured constructor", () => {});\n'
        ),
        (
            "const { Array: ArrayAlias } = globalThis;\n"
            "ArrayAlias.prototype.concat = function (): unknown[] { return []; };\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("destructured global constructor", () => {});\n'
        ),
        (
            "let prototype = Array.prototype;\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("mutable prototype alias", () => {});\n'
        ),
        (
            "var prototype = Array.prototype;\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("var prototype alias", () => {});\n'
        ),
        (
            "let prototype: object;\n"
            "prototype = Array.prototype;\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("assigned prototype alias", () => {});\n'
        ),
        (
            "let prototype: object = {};\n"
            "if (Math.random() > 0.5) { prototype = Array.prototype; }\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("conditional prototype alias", () => {});\n'
        ),
        (
            "declare function runtimeObject(): object;\n"
            "let prototype = runtimeObject();\n"
            'Object.defineProperty(prototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("unknown mutable alias", () => {});\n'
        ),
    )
    for source in variants:
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("parameter table" in failure for failure in failures), source

    intrinsic_mutation_targets = (
        "const A = (() => Array)(); A.prototype.splice = replacement;",
        (
            "function getArray(value = Array): ArrayConstructor { return value; } "
            "const A = getArray(); A.prototype.splice = replacement;"
        ),
        ("const { prototype } = (() => Array)(); prototype.splice = replacement;"),
        (
            'const A = Object.getOwnPropertyDescriptor(globalThis, "Array")!'
            ".value as ArrayConstructor; A.prototype.splice = replacement;"
        ),
        "global.Array.prototype.splice = replacement;",
        (
            'const key = "prototype"; '
            "const prototype = new Map([[key, Array.prototype]]).get(key)!; "
            "prototype.splice = replacement;"
        ),
        (
            'const A = Reflect.get(globalThis, "Array"); '
            "A.prototype.splice = replacement;"
        ),
        (
            "declare const member: string; "
            "const A = Reflect.get(globalThis, member); "
            "A.prototype.splice = replacement;"
        ),
        "([] as any).constructor.prototype.splice = replacement;",
        "(rows as any).constructor.prototype.splice = replacement;",
        "Object.getPrototypeOf([]).splice = replacement;",
        "Reflect.getPrototypeOf([])!.splice = replacement;",
        "const P = ([] as any).__proto__; P.splice = replacement;",
        "(new Array() as any).constructor.prototype.splice = replacement;",
        "(Array.of() as any).constructor.prototype.splice = replacement;",
    )
    for mutation in intrinsic_mutation_targets:
        source = (
            'const rows = ([] as unknown[]).concat("abc", "def");\n'
            "const replacement = function (this: unknown[]): unknown[] {\n"
            "  this.length = 0;\n"
            "  return [];\n"
            "};\n"
            f"{mutation}\n"
            "rows.splice(0, 0);\n"
            'test.each(rows)("intrinsic provenance", () => {});\n'
        )
        spec.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("parameter table" in failure for failure in failures), source


def test_typescript_ast_scan_preserves_concat_intrinsic_safe_controls(
    fixture_repo: verify.Context,
) -> None:
    spec = fixture_repo.repo / "packages" / "probe" / "test" / "probe.test.ts"
    spec.parent.mkdir(parents=True)
    spec.write_text(
        (
            "console.log(Array.prototype.concat);\n"
            "let overwrittenPrototype: object = Array.prototype;\n"
            "overwrittenPrototype = {};\n"
            'Object.defineProperty(overwrittenPrototype, "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            "function mutateLocal(Array: { prototype: object }): void {\n"
            '  Object.defineProperty(Array.prototype, "concat", {\n'
            "    value: function (): unknown[] { return []; },\n"
            "  });\n"
            "}\n"
            "mutateLocal({ prototype: {} });\n"
            "if (false) {\n"
            "  Array.prototype.splice = function (): unknown[] {\n"
            "    return [];\n"
            "  };\n"
            "}\n"
            "function uncalledMutation(): void {\n"
            "  Array.prototype.splice = function (): unknown[] {\n"
            "    return [];\n"
            "  };\n"
            "}\n"
            "void uncalledMutation;\n"
            "const localPrototype: { concat?: () => unknown[] } = {};\n"
            'const key = "prototype";\n'
            "const safeMap = new Map([[key, localPrototype]]);\n"
            "safeMap.get(key)!.concat = function (): unknown[] { return []; };\n"
            "const global = { Array: { prototype: localPrototype } };\n"
            "global.Array.prototype.concat = function (): unknown[] { return []; };\n"
            'const rows = ([] as unknown[]).concat("abc");\n'
            'test.each(rows)("registered before mutation", () => {});\n'
            'Object.defineProperty((0, Array.prototype), "concat", {\n'
            "  value: function (): unknown[] { return []; },\n"
            "});\n"
            "Array.prototype.splice = function (): unknown[] {\n"
            "  this.length = 0;\n"
            "  return [];\n"
            "};\n"
            "Object.defineProperty(Array, Symbol.species, {\n"
            "  value: class extends Array<unknown> {},\n"
            "});\n"
        ),
        encoding="utf-8",
    )
    assert verify.check_focused_tests(fixture_repo, ()) == []


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


def test_python_ast_scan_rejects_pytest_skip_surfaces_and_aliases(
    fixture_repo: verify.Context,
) -> None:
    probe = fixture_repo.repo / "services" / "orchestrator" / "tests" / "test_probe.py"
    probe.parent.mkdir(parents=True, exist_ok=True)
    variants = (
        (
            "import pytest\n\n"
            "skip_test = pytest.skip\n\n"
            "def test_probe() -> None:\n"
            '    skip_test("aliased skip")\n'
        ),
        (
            "import pytest as pt\n\n"
            "def test_probe() -> None:\n"
            '    pt.skip("module alias")\n'
        ),
        (
            "from pytest import skip as skip_test\n\n"
            "def test_probe() -> None:\n"
            '    skip_test("imported skip")\n'
        ),
        (
            "import pytest\n\n"
            'pytest.importorskip("japp_missing_optional_module")\n\n'
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
        (
            "import pytest\n\n"
            '@pytest.mark.skip(reason="literal decorator")\n'
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
        (
            "import pytest\n\n"
            '@pytest.mark.skipif(True, reason="conditional")\n'
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
        (
            "import pytest\n\n"
            'pytest.skip("module skip", allow_module_level=True)\n\n'
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
        (
            "import pytest\n\n"
            "@pytest.mark.parametrize(\n"
            '    "value", [pytest.param(1, marks=pytest.mark.skip(reason="case"))]\n'
            ")\n"
            "def test_probe(value: int) -> None:\n"
            "    assert value == 1\n"
        ),
        (
            "import pytest\n\n"
            "def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:\n"
            '    items[0].add_marker(pytest.mark.skip(reason="collection"))\n\n'
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
        (
            "def pytest_collection_modifyitems(items: list[object]) -> None:\n"
            "    items[:] = [item for item in items if False]\n\n"
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
        (
            "def remove_substantive(items: list[object]) -> None:\n"
            "    items[:] = [\n"
            "        item for item in items\n"
            '        if getattr(item, "name", "") != "test_substantive"\n'
            "    ]\n\n"
            "pytest_collection_modifyitems = remove_substantive\n\n"
            "def test_substantive() -> None:\n"
            "    raise AssertionError\n\n"
            "def test_count_preserving_filler() -> None:\n"
            "    assert True\n"
        ),
        (
            "pytest_collection_modifyitems = lambda items: items.__setitem__(\n"
            "    slice(None),\n"
            "    [item for item in items if item.name != 'test_substantive'],\n"
            ")\n\n"
            "def test_substantive() -> None:\n"
            "    raise AssertionError\n\n"
            "def test_count_preserving_filler() -> None:\n"
            "    assert True\n"
        ),
        (
            "import pytest\n\n"
            'member = "sk" + "ip"\n\n'
            "def test_probe() -> None:\n"
            '    getattr(pytest, member)("computed member")\n'
        ),
        (
            "import pytest\n\n"
            "def test_probe() -> None:\n"
            '    pytest.__dict__["skip"]("mapping member")\n'
        ),
        (
            "from pytest import importorskip as require_module\n\n"
            'require_module("japp_missing_optional_module")\n\n'
            "def test_probe() -> None:\n"
            "    assert True\n"
        ),
    )
    for source in variants:
        probe.write_text(source, encoding="utf-8")
        failures = verify.check_focused_tests(fixture_repo, ())
        assert any("test_probe.py" in failure for failure in failures), source


def test_python_ast_scan_allows_ordinary_pytest_usage_and_lookalikes(
    fixture_repo: verify.Context,
) -> None:
    probe = fixture_repo.repo / "services" / "orchestrator" / "tests" / "test_probe.py"
    probe.parent.mkdir(parents=True, exist_ok=True)
    variants = (
        (
            "import pytest\n\n"
            '@pytest.mark.parametrize("value", [1, 2])\n'
            "def test_probe(value: int) -> None:\n"
            "    skipped_results = value\n"
            "    assert skipped_results > 0\n"
        ),
        (
            "import pytest\n\n"
            "class Reporter:\n"
            "    def skip(self) -> None:\n"
            "        return None\n\n"
            "def helper(pytest: Reporter) -> None:\n"
            "    pytest.skip()\n\n"
            "def test_probe() -> None:\n"
            "    helper(Reporter())\n"
        ),
        (
            "import pytest\n\n"
            "class Reporter:\n"
            "    def skip(self) -> None:\n"
            "        return None\n\n"
            "pytest = Reporter()\n\n"
            "def test_probe() -> None:\n"
            "    pytest.skip()\n"
        ),
        (
            "class Reporter:\n"
            "    def skip(self) -> None:\n"
            "        return None\n\n"
            "def ordinary() -> object:\n"
            "    import pytest as policy\n"
            "    return policy.param(1)\n\n"
            "def lookalike() -> None:\n"
            "    policy = Reporter()\n"
            "    policy.skip()\n\n"
            "def test_probe() -> None:\n"
            "    assert ordinary() is not None\n"
        ),
    )
    for source in variants:
        probe.write_text(source, encoding="utf-8")
        assert verify.check_focused_tests(fixture_repo, ()) == [], source


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
