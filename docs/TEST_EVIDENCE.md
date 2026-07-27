# Test Evidence

Exact verification commands and summarized results
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1 and §8.6). Newest entries first.

## Update rules

- Every entry records: work-package ID; git commit or working-tree hash;
  operating system and relevant runtime versions; exact commands; exit
  status; test counts; benchmark summaries where applicable; screenshot or
  trace paths where applicable; and known flaky behavior.
- Mandatory tests may not be labeled flaky to avoid fixing them.
- Never record a command as passed unless it was run in the current
  repository state and its result was inspected (spec §1.5).
- Anchoring convention: because a status/evidence update that is itself
  committed cannot contain its own commit hash, entries record the **tree
  hash** (`git rev-parse HEAD^{tree}` equivalent, content-only) as the
  primary anchor plus the containing commit where known. Identical file
  content on any machine reproduces the same tree hash.

## Entry template

```markdown
### <Mxx-Wyy> — <package name> (<ISO date>)
- Revision: tree <hash> / commit <hash or "recorded post-commit">
- Environment: <OS, runtime versions>
- Commands and observed results:
  - `<command>` → exit <code>, <summarized result>
- Test counts: <passed/failed/skipped or n/a>
- Artifacts: <paths or n/a>
- Notes:
```

## Entries

### M01-W03 — Define error taxonomy (2026-07-27)

- Revision: content working tree (commit recorded post-commit). Bootstrap
  ran at starting HEAD `c5ce7e9fdf35f3bd972b1d4782bd7785cc105958` (clean
  `main`, equal to `origin/main`).
- Environment: macOS (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustup
  toolchain 1.97.1; @playwright/test 1.62.0 with pinned Chromium;
  pydantic 2.12.5. No new dependencies.
- Clean-session bootstrap (all inspected at starting HEAD): `git fetch
  origin` / `git status --short` / branch / `git rev-parse HEAD` /
  `origin/main` / `git log --oneline -8` → clean `main` at
  `c5ce7e9…`, equal to origin; `gh run view 30240403625` → final M01-W02
  restamp run green on windows-2025 job 89896226525, ubuntu-24.04 job
  89896226555, macos-15 job 89896226592; the completed M01-W02 and
  KI-0018 ranges (`be476d6..efd41b2`, `efd41b2..c5ce7e9`) inspected;
  `python3 scripts/validate_status.py` → exit 0 (36 groups);
  `pnpm traceability:check` → exit 0 (157/286); `pnpm run doctor` →
  exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2 NOT_YET_APPLICABLE;
  `pnpm generate:contracts --check` → "35 files, byte-identical";
  `pnpm verify` → exit 0 with contract-gen ACTIVE and PASS. Only after
  every prerequisite passed was M01-W03 marked IN_PROGRESS (status +
  traceability mirror + regenerated view; validators re-run → exit 0).
  Requirement-ownership inspection: no requirement in
  docs/traceability.json lists M01-W03 as an owning package, so no
  requirement state/evidence rows change in this package (package rows
  only; the reviewed hashes cover requirement/dependency projections and
  are untouched).
- Implementation delivered:
  - `schemas/error/taxonomy.v1.schema.json`
    (`urn:japp:schema:error:taxonomy:v1`) — the twelve required families,
    80 stable family-prefixed UPPER_SNAKE_CASE codes (VALIDATION 6,
    CONFLICT 5, UNSUPPORTED 6, SENSITIVE 6, MODEL 6, STORAGE 6,
    TRANSPORT 8, RENDERING 6, SITE 9, BENCHMARK 7, GATE 7, SUBMISSION 8 —
    every distinction required by the package contract, no speculative
    codes, no generic UNKNOWN), severities, retry/recovery dispositions,
    reporting origins, message-key grammar, bounded user-safe message
    shape.
  - `schemas/error/catalog.v1.schema.json` + the canonical instance
    `catalog/error-catalog.v1.json` — one metadata entry per code (derived
    message key, safe default English message, optional remediation,
    severity, disposition, user-action/transient flags, diagnostic policy
    on the canonical redaction vocabulary, optional owning boundary,
    added_in/deprecated_since); single source of truth for both language
    surfaces.
  - `schemas/error/record.v1.schema.json` — strict closed wire record
    serializing ONLY the stable code plus occurrence identity/trace data;
    metadata is always catalog-derived, so contradictory caller-supplied
    family/severity/retry/message data is unrepresentable; diagnostics are
    referenced only by SHA-256 digest.
  - Generator (format 1.0.0 → 1.1.0): narrow strict `boolean` and uniform
    `array` (`items` + `minItems`/`maxItems`) support across IR and both
    emitters (tuples, `uniqueItems`, `integer` stay fail-closed with path
    + pointer); the catalog pipeline (`generator/error-catalog.ts`) —
    strict schema validation of the instance, fail-closed integrity gate
    (sorted unique codes, exact two-direction agreement with the taxonomy
    enum, family/prefix and derived-key checks, user-safe message lint,
    family invariant matrix), `--catalog-root` CLI override, MANIFEST
    `dataInputs` provenance (path, validating schema, version, SHA-256 of
    exact committed bytes), and generated catalog-data emission.
  - Regenerated `generated/` (35 → 44 files): taxonomy/catalog/record
    types and validators in both languages plus
    `typescript/error/catalog-data.v1.ts` and
    `python/src/japp_contracts/error/catalog_data_v1.py` — frozen
    `ERROR_CATALOG_V1` map, sorted `ERROR_CODES_V1`, membership guard,
    fail-closed `requireErrorCatalogEntryV1`/`require_error_catalog_entry_v1`
    (unknown input never echoed), default-message lookup; Python entries
    are constructed through strict model validation at import time.
    Prior generated modules are byte-identical except the legitimately
    affected index/`__init__`/README/MANIFEST surfaces.
- Tests added:
  - `packages/contracts/test/generated/error-taxonomy.test.ts` (28 tests):
    catalog integrity (families, unique complete codes, derived keys,
    schema-enum agreement in both representations), user-safe message
    policy (lint clean, no interpolation/HTML/URL/path/trace syntax, no
    control characters), family invariants (SENSITIVE pause/prohibit +
    user action; SITE pause; MODEL messages preserve accepted results;
    GATE never reads as PASS after negation stripping; SUBMISSION never
    claims success; UNSUPPORTED/BENCHMARK never SAFE_RETRY;
    threshold-failure messages state thresholds are never lowered;
    transient ⟺ SAFE_RETRY), generated-TS lookup determinism, frozen
    metadata, unknown/prototype-key rejection without echo, record
    narrowing with catalog-derived metadata, and fail-closed generator
    behavior on tampered catalogs (removed entry, undeclared code stopped
    by the schema enum, family mismatch, non-derived key, unsorted
    entries, sensitive fallback, smuggled URL, real-CLI tamper and
    missing-file paths) plus array/boolean construct positives and
    negatives (tuple/prefixItems, uniqueItems, stray boolean keywords).
  - Shared corpus +30 cases (84 → 114) driving BOTH languages: taxonomy
    token positives/negatives, message-key and user-safe-message shapes,
    error-record positives (minimal, full trace + digest) and negatives
    (unknown code, caller-supplied user message/severity/retry metadata,
    missing correlation, free-text diagnostic, invalid id, offset
    timestamp, null causation), and catalog-shape cases exercising strict
    arrays/booleans (entries-as-object rejected, "true"/1 not coerced to
    booleans, unknown member rejected, empty entries rejected).
  - `scripts/tests/test_generated_contracts.py` (+6 tests, 129 total in
    module): Python catalog integrity mirror (80 codes, 12 families,
    sorted, prefix/derived-key agreement with the schema enum),
    user-safe-message sweep, family invariant matrix, deterministic
    fail-closed lookups (hostile input not echoed), record
    code-only serialization with catalog-derived metadata and
    caller-metadata rejection, and MANIFEST dataInputs provenance
    verification against the committed catalog bytes.
  - Premise repair (KI-0019): the status exactness negative resets every
    M01 row through M01-W04, and both M00-closeout helpers were
    generalized through M01-W05 to preempt the class at the upcoming
    stamp boundaries.
- Commands and observed results (local, uncommitted working tree):
  - `pnpm install --frozen-lockfile` → exit 0 ("Already up to date").
  - `uv sync --locked` → exit 0. `cargo fetch --locked
    --manifest-path services/native-host/Cargo.toml` → exit 0.
  - `pnpm generate:contracts` → exit 0 (44 files; 35 prior + 9: three
    error documents × two languages, two catalog-data modules — index and
    __init__ surfaces regenerate in place).
  - `pnpm generate:contracts --check` run twice → exit 0 both times,
    "44 files, byte-identical"; also re-run after all doc edits → exit 0.
  - `pnpm lint` → exit 0. `pnpm format:check` → exit 0.
  - `pnpm typecheck` → exit 0 (generated error modules included).
  - Focused: `pnpm --filter @japp/contracts exec vitest run` → exit 0,
    8 files, 258 tests (199 prior + 28 error-taxonomy + 30 new shared
    corpus cases + KI-0018 fsops/control-byte regressions all green);
    `uv run pytest scripts/tests -q` → exit 0, 492 passed (455 prior +
    30 corpus + 6 error-layer + 1 KI-0019-adjusted premise).
  - `pnpm test` → exit 0 (unit-ts, 266 tests across 9 packages).
    `pnpm test:e2e` → exit 0 (1). `pnpm test:python` → exit 0 (full
    pytest 493 = 492 scripts/tests + 1 orchestrator). `pnpm test:rust` →
    exit 0.
  - `python3 scripts/validate_status.py` → exit 0 (36 groups).
    `pnpm traceability:generate` + `pnpm traceability:check` → exit 0
    (157/286; package rows only — no requirement rows changed and every
    reviewed hash is untouched).
  - `pnpm run doctor` → exit 0, 20 PASS / 1 WARNING (expected
    uncommitted implementation state) / 0 FAIL / 2 NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0; contract-gen ACTIVE and PASS; contract
    (M01-W05) and visual (M10-W06) honestly NOT_YET_APPLICABLE;
    status-neutral. `git diff --check` → exit 0.

#### M01-W03 clean-clone simulation (local, committed content revision)

- `git clone <repository> <fresh directory>` at
  `916c14ad1832adbb021e5eef4c6f2f046d89056e` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0; `uv sync --locked` → exit 0;
  `pnpm exec playwright install chromium` → exit 0.
- `pnpm generate:contracts --check` → exit 0, "generated contracts are up
  to date (44 files, byte-identical)" — schemas plus the canonical error
  catalog reproduce the committed trees exactly from a clean locked
  install.
- Write-mode `pnpm generate:contracts` followed by
  `git status --porcelain` → zero changes (byte-exact no-op).
- `pnpm run doctor` → exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE. `pnpm verify` → exit 0; clean tree throughout.

#### M01-W03 hosted three-OS content verification

- Content run 30242783456 at commit
  `916c14ad1832adbb021e5eef4c6f2f046d89056e` succeeded on all three
  required jobs: windows-2025 job 89903310571 (4m8s), macos-15 job
  89903310628 (2m41s), and ubuntu-24.04 job 89903310666 (2m14s).
- The complete Windows job log was downloaded and inspected: the job
  checked out exactly `916c14ad1832adbb021e5eef4c6f2f046d89056e`; the
  canonical doctor reported 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE with a clean working tree; aggregate verification
  reported "generated contracts are up to date (44 files, byte-identical)"
  — the error-taxonomy generation therefore reproduces byte-exactly on
  windows-2025 — plus contract-gen ACTIVE and PASS, 258 @japp/contracts
  Vitest tests, 493 Python tests (`493 passed in 84.60s`), and
  `verification exit code: 0` (REQ-PLAT-013 infrastructure evidence only —
  not Windows 11 product certification).
- After this hosted success, M01-W03 was marked VERIFIED at content tree
  `1acf66eb15095e4777d89d66833720cfb6fd0360`, M01-W04 became the sole
  READY package, and M01 remains IN_PROGRESS. The conventional
  revision-stamp commit records this closeout; its own three-OS run is
  required to pass at the final head.

### M01-W02 — Generate TypeScript and Python contracts (2026-07-27)

- Revision: content working tree (commit recorded post-commit). Bootstrap ran
  at starting HEAD `be476d636b554b698a996b6851d4a7fa7293dd2d` (clean `main`,
  equal to `origin/main`).
- Environment: macOS (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustup toolchain
  1.97.1; @playwright/test 1.62.0 with pinned Chromium; new exact Python
  pins pydantic 2.12.5 (+ pydantic-core 2.41.5, annotated-types 0.8.0,
  typing-inspection 0.4.2) in the root uv dev group and uv.lock.
- Clean-session bootstrap (all inspected at starting HEAD):
  - `git fetch origin`, `git status --short`, `git branch --show-current`,
    `git rev-parse HEAD`, `git rev-parse origin/main`, `git log --oneline -8`
    → exit 0; clean tree; branch `main`; local HEAD and `origin/main` both
    `be476d636b554b698a996b6851d4a7fa7293dd2d`.
  - `gh run view 30235026395` → final M01-W01 stamp run succeeded on all
    three required jobs: macos-15 job 89881105283, ubuntu-24.04 job
    89881105287, windows-2025 job 89881105290.
  - `python3 scripts/validate_status.py` → exit 0 (36 groups; M00 ACCEPTED,
    M01-W01 VERIFIED, M01-W02 sole READY, no IN_PROGRESS package, four
    gates NOT_EVALUATED).
  - `pnpm traceability:check` → exit 0 (157 requirements, 286 packages).
  - `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL and honest
    NOT_YET_APPLICABLE for contract-gen, contract, and visual.
  - `pnpm verify` → exit 0 with every ACTIVE suite PASS.
  - Only after every prerequisite passed was M01-W02 marked IN_PROGRESS
    (docs/PROJECT_STATUS.md + docs/traceability.json + regenerated view;
    `python3 scripts/validate_status.py` and `pnpm traceability:check`
    re-run → exit 0).
- Implementation delivered:
  - `scripts/generate-contracts.ts` — canonical platform-neutral entry
    point, executed directly by the pinned Node's native type stripping
    (no Bash wrapper, no compile step, no shell profile); root command
    `pnpm generate:contracts` (write) and `pnpm generate:contracts --check`
    (read-only byte-exact drift check; exit 0/1/2 =
    clean/drift/usage-or-generation-failure).
  - `packages/contracts/generator/` — deterministic engine: `ir.ts`
    (fail-closed keyword-allowlist IR with document path + JSON pointer in
    every unsupported-construct error; deterministic dependency ordering of
    $defs, cycles rejected), `naming.ts` (schema-identity → fully-qualified
    type/module mapping), `emit-typescript.ts`, `emit-python.ts`,
    `generate.ts` (orchestration, provenance manifest, LF/path-containment
    guards), `fsops.ts` (staging + single-rename install; complete-inventory
    byte compare; `__pycache__` interpreter caches excluded), `cli.ts`.
    The unweakened M01-W01 gate (`loadSchemaCatalog` +
    `createContractValidator`) runs before any output is planned.
  - `packages/contracts/generated/` — 35 committed generated files:
    `MANIFEST.json` (generator format/config, 13 input schema
    ids/versions/SHA-256 over exact committed bytes, 34 output
    paths/SHA-256, cross-language type-identity map), generated `README.md`,
    `typescript/` (13 document modules + `validators.ts` + `index.ts`; 26
    typed Ajv-delegating wrappers; extension surfaces typed
    `readonly [key: \`x-${string}\`]: unknown`, opaque payloads `unknown`,
    no `any` anywhere), `python/src/japp_contracts/` (13 document modules +
    `_runtime.py` + package/subpackage `__init__.py` + `py.typed`; strict
    Pydantic v2: extra="forbid", strict=True, no defaults, no coercion,
    missing ≠ null via explicit-null rejection on optional non-nullable
    members, string wire forms preserved, Ajv-parity date/date-time
    validators including the 23:59:60Z leap-second slot and proleptic year
    0000 — semantics probed against ajv-formats full mode before
    implementation).
  - Source integration: package-internal import specifiers moved to
    explicit `.ts` form (same modules now execute under Vitest and plain
    pinned Node), `allowImportingTsExtensions` in tsconfig.base.json,
    generated tree included in package typecheck, `@japp/contracts/generated`
    export surface, ESLint/Prettier exemptions for the byte-exact generated
    tree, pytest `pythonpath` + mypy `mypy_path` wiring for
    `japp_contracts`, contract-gen registry explanation updated to accurate
    ACTIVE-state wording (activation rule, command, owner, and mandatory
    state unchanged).
- Tests added:
  - `packages/contracts/test/generated/generator.test.ts` (25 tests):
    double-generation byte identity; reversed-enumeration-order identity;
    committed-tree equality; no environment identity (repo/home/temp paths,
    hostname, current date) or platform separators in any output; real-CLI
    check passes read-only on the committed tree; hand-edit → MODIFIED;
    deleted file → MISSING; extra file → EXTRA; schema-change-without-regen
    fails; empty root reports the complete missing inventory; unknown flag
    usage error; deleted schema leaves no stale output and the follow-up
    check passes; stray pre-existing content replaced wholesale; symlinked
    generated root removed, never written through (capability-probed);
    convention violation (`default`) fails closed with zero writes;
    duplicate `$id` fails; unresolved and remote references fail;
    unsupported construct (array) fails with path + pointer; general anyOf
    fails; adversarial descriptions cannot inject TS (diagnostics-free
    transpile, `*\/`-escaped) or Python (escaped literals only); path
    traversal (`..`, absolute, backslash) rejected; stray non-schema files
    rejected; install/compare invariants.
  - `packages/contracts/test/generated/typescript-models.test.ts` (92
    tests): all 84 shared-corpus verdicts through the typed wrappers with
    input-mutation guards; narrowing after success; structured
    instance-path failures; frozen-input validation; unknown reference
    throws; opaque payload stays `unknown`; optional-vs-null semantics;
    generated reference map exactly covers every catalog definition and
    root payload; wrapper runtime is the canonical catalog validator.
  - `packages/contracts/test/fixtures/instance-corpus.json` — 84
    hand-authored synthetic cases (valid + invalid per definition family)
    consumed by BOTH the TypeScript and Python suites so both languages
    are proven against identical inputs and identical expected verdicts
    (M01-W02 generator/model evidence, not the M01-W05 corpus).
  - `scripts/tests/test_generated_contracts.py` (92 tests): the same 84
    corpus verdicts through the generated Pydantic models (strict
    TypeAdapter for aliases, model_validate for models, resolved through
    the MANIFEST type map); wire round-trip preservation (int confidence
    stays int, float stays float, decimal strings exact); absent optionals
    stay absent while explicit null successor survives; missing ≠ null
    (validate and constructor paths); extra members and coercion rejected;
    field order matches schema property order; sorted importable `__all__`
    + `py.typed`; every committed generated module compiles; generated-file
    headers present; real CLI `--check` passes and `git status --porcelain`
    is unchanged by it.
  - Premise repairs (KI-0017, same class as KI-0014/15/16):
    `test_suite_states.py` ACTIVE set now includes contract-gen;
    `test_ci_workflow.py` REQUIRED_MISSING negative isolates an empty repo
    (plus a new positive proving ACTIVE with the real generator);
    `test_doctor.py` healthy fixture carries the generator file;
    `test_validate_status.py` exactness negative resets M01-W02.
- Commands and observed results (local, uncommitted working tree):
  - `pnpm install --frozen-lockfile` → exit 0 ("Already up to date").
  - `uv sync --locked` → exit 0 (21 packages resolved; pydantic 2.12.5,
    pydantic-core 2.41.5, annotated-types 0.8.0, typing-inspection 0.4.2
    added from uv.lock).
  - `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`
    → exit 0.
  - `pnpm generate:contracts` → exit 0 (35 files).
  - `pnpm generate:contracts --check` run twice → exit 0 both times,
    "35 files, byte-identical"; `git status --porcelain` unchanged.
  - `pnpm lint` → exit 0. `pnpm format:check` → exit 0.
  - `pnpm typecheck` → exit 0 (turbo tsc over all packages including the
    generated TypeScript tree, root project including the generator entry,
    strict mypy over services/scripts — mypy follows the test imports into
    `japp_contracts`, so the generated Python is strict-checked; verified
    with `uv run mypy` over the full registry file set → "no issues found
    in 18 source files").
  - `pnpm test` → exit 0 (unit-ts; per-package Vitest proofs; 196 tests
    across 9 packages — @japp/contracts now reports 188).
  - Focused: `pnpm --filter @japp/contracts exec vitest run` → exit 0,
    6 files, 188 tests (71 M01-W01 schema/convention + 117 new generator/
    generated-TypeScript). `uv run pytest scripts/tests -q` → exit 0,
    452 passed (359 prior + 92 new generated-contract tests + 1 new
    contract-gen ACTIVE-derivation test).
  - `pnpm test:e2e` → exit 0 (1 Playwright pinned-Chromium smoke test).
  - `pnpm test:python` → exit 0 (Ruff + Ruff format + strict mypy; full
    pytest 453 passed = 452 scripts/tests + 1 orchestrator scaffold test);
    before the KI-0017 premise repairs this suite honestly FAILED with
    4 failed / 448 passed (initial run exposing the inherited fixtures).
  - `pnpm test:rust` → exit 0 (fmt, clippy -D warnings, 1 test, build).
  - `pnpm test:contract` → NOT_YET_APPLICABLE (honest; owner M01-W05).
    `pnpm test:visual` → NOT_YET_APPLICABLE (honest; owner M10-W06).
  - `pnpm run doctor` → exit 0, 20 PASS / 1 WARNING / 0 FAIL / 2
    NOT_YET_APPLICABLE; the only warning is the expected "uncommitted
    changes present" implementation-state warning; contract-gen now
    reports "PASS — ACTIVE (runs inside pnpm verify)".
  - `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts,
    **contract-gen (ACTIVE, PASS)**, e2e-browser, python, rust,
    portability, traceability, status, and integrity all PASS; contract
    (M01-W05) and visual (M10-W06) honestly NOT_YET_APPLICABLE; verify
    remained status-neutral (worktree snapshot identical before/after).
- Traceability and governance updates in this package:
  - M01-W02 marked IN_PROGRESS in docs/PROJECT_STATUS.md and mirrored in
    docs/traceability.json; docs/REQUIREMENTS_TRACEABILITY.md regenerated;
    validators re-run after every edit.
  - REQ-PLAT-005 stays honestly `SCAFFOLD_ONLY`/`NOT_YET_APPLICABLE` and now
    additionally records the generated-model version-propagation portion
    implemented here (schema ids/versions propagate into generated modules
    and MANIFEST.json provenance; prompt versioning (M05),
    model-configuration/platform-profile versioning (M05-W02/M05-W06), and
    migration versioning (M04-W02) remain future work). This is a reviewed
    intentional update of the expanded requirement hash performed through
    the independently pinned procedure: docs/traceability.json and
    `FINAL_V1_3_REQUIREMENT_MAPPING_SHA256` in scripts/traceability.py
    moved together from
    `2f6fcd94dcf6b7aa9e2a686683cc8243d25138addc0fac049f2bfc0a7416bcaf` to
    `158fb68a58eab46f3339248e5e34897a9f5881c48b5a1e1275b9dfbd2cf45d34`;
    the preserved v1.2 hashes and the v1.3 package-dependency hash are
    unchanged; the regression tests were updated in the same change and the
    trace-repo fixture now carries the newly referenced generator/generated
    files.
  - KI-0017 (MEDIUM, FIXED) recorded in docs/KNOWN_ISSUES.md: four
    boundary fixtures inherited the pre-M01-W02 premise and were repaired
    to establish their own complete premises.

#### M01-W02 clean-clone simulation (local, committed content revision)

- `git clone <repository> <fresh directory>` at
  `981826764dc0793f7ddc984f49888afb7657d3b5` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0 in the fresh clone.
- `uv sync --locked` → exit 0 (uv-managed 3.12.13 environment recreated
  including pydantic 2.12.5 / pydantic-core 2.41.5 / annotated-types 0.8.0 /
  typing-inspection 0.4.2 from uv.lock).
- `pnpm exec playwright install chromium` → exit 0 (pinned browser cache).
- `pnpm generate:contracts --check` → exit 0, "generated contracts are up
  to date (35 files, byte-identical)" — the committed generated tree
  reproduces exactly from a clean locked install.
- `pnpm run doctor` → exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE (contract-gen ACTIVE and PASS); working tree clean.
- `pnpm verify` → exit 0; every ACTIVE suite PASS including contract-gen;
  contract and visual honestly NOT_YET_APPLICABLE.
- `pnpm generate:contracts` (write mode) in the clone followed by
  `git status --porcelain` → zero changes: regeneration is a byte-exact
  no-op on a clean clone.

#### M01-W02 hosted three-OS content verification

- Content run 30238366390 at commit
  `981826764dc0793f7ddc984f49888afb7657d3b5` succeeded on all three
  required jobs: ubuntu-24.04 job 89890399400 (2m20s), windows-2025 job
  89890399405 (3m44s), and macos-15 job 89890399463 (1m37s).
- The complete Windows job log was downloaded and inspected: the job
  checked out exactly `981826764dc0793f7ddc984f49888afb7657d3b5`; the
  canonical doctor reported 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE with contract-gen "PASS — ACTIVE (runs inside pnpm
  verify)" and a clean working tree; aggregate verification reported
  "generated contracts are up to date (35 files, byte-identical)" — the
  deterministic generator therefore reproduces the committed trees
  byte-exactly on windows-2025 — plus contract-gen ACTIVE PASS, 188
  @japp/contracts Vitest tests, 453 Python tests
  (`453 passed in 76.45s`), `verification exit code: 0`, and the
  no-tracked-changes assertion passing (REQ-PLAT-013 infrastructure
  evidence only — not Windows 11 product certification).
- After this hosted success, M01-W02 was marked VERIFIED at content tree
  `3d4b0f16990decf6bb8dfa7e59e3b89a1628903d`, M01-W03 became the sole
  READY package, and M01 remains IN_PROGRESS. The conventional
  revision-stamp commit records this closeout; its own three-OS run is
  required to pass at the final head.
- Stamp-state validation exposed the second half of KI-0017 (the two
  M00-closeout boundary helpers inherited the live M01-W03 READY row;
  seven closeout-boundary assertions failed, 445 passed). After extending
  both helpers to reset every advanceable M01 row:
  `uv run pytest scripts/tests` → exit 0, 452 passed;
  `python3 scripts/validate_status.py` → exit 0 (36 groups);
  `pnpm traceability:check` → exit 0 (157/286); complete `pnpm verify` →
  exit 0 in the stamped state with contract-gen ACTIVE and PASS.

#### M01-W02 corrective closeout (KI-0018, 2026-07-27)

- Scope: focused repair of two defects found in post-verification review;
  all prior M01-W02 work and evidence preserved; M01-W02 temporarily
  reopened IN_PROGRESS (M01-W03 returned to NOT_STARTED) at starting HEAD
  `efd41b22b311d12055e072814bf647057fbca440` after re-confirming the clean
  tree, branch, HEAD = origin/main, the final stamp run 30238766443
  (ubuntu job 89891533670, macos job 89891533708, windows job 89891533724,
  all SUCCESS), check-mode byte-identity, validator PASS, and
  `pnpm verify` exit 0.
- Defect 1 (rollback safety): `installGeneratedTree` in
  `packages/contracts/generator/fsops.ts` rewritten as a transactional,
  rollback-safe whole-tree replacement (deliberately not described as
  atomic): unique sibling staging is materialized and byte-verified via
  `verifyMaterializedTree` before the existing tree is touched; the
  existing tree is renamed to a unique sibling backup, never deleted
  first; the verified staging tree is renamed into place; the backup is
  removed only after success; installation failure automatically restores
  the backup (`InstallRolledBackError`); rollback failure deletes nothing
  and reports every surviving directory plus the manual recovery action
  (`InstallRecoveryError`); leftovers from earlier failed runs are never
  reused or destroyed. The primitive steps sit behind the injectable
  `InstallFsOps` seam; `cli.ts` reuses the shared verification for its
  check-mode temporary materialization; `packages/contracts/README.md`
  §10a now states the guarantee honestly.
- Defect 2 (control bytes): the raw NUL join separator (line 132) and the
  raw BEL + invisible U+2028 inside the adversarial injection fixture
  (line 453) in `packages/contracts/test/generated/generator.test.ts` are
  now escaped source representations with identical runtime values; the
  emitter (`pythonStringLiteral`) additionally escapes U+2028/U+2029 in
  generated Python (no committed output contains them, so generated bytes
  are unchanged); the injection test now also asserts the sanitized BEL/
  U+2028 forms and that no generated file contains raw C0 characters.
- Tests added: `packages/contracts/test/generated/fsops-install.test.ts`
  (11 deterministic failure-injection tests: success replaces stale
  output with no staging/backup leftovers; first-time install;
  materialization failure leaves the old tree unchanged; staging
  verification failure leaves the old tree unchanged; old-tree-move
  failure leaves it installed; install failure restores the old tree
  exactly; rollback failure preserves and reports both recoverable
  trees with nothing deleted; backup-cleanup failure reports the
  surviving backup after a successful install; unique sibling paths never
  reuse earlier leftovers; the installed path is never PARTIAL at any
  observed protocol step; verifyMaterializedTree rejects inventory and
  content divergence). `scripts/tests/test_integrity.py` (3 new tests:
  generator.test.ts contains no literal NUL and keeps the escaped forms;
  every tracked .ts/.tsx/.py/.json/.md/.toml/.yaml/.yml/.mjs/.cjs/.js
  file contains no NUL and no raw C0 control bytes except tab/LF/CR;
  the detector bans C0 while allowing the text-policy trio and escaped
  representations).
- Commands and observed results (local, uncommitted working tree):
  - `pnpm install --frozen-lockfile` → exit 0 ("Already up to date").
  - `uv sync --locked` → exit 0.
  - `pnpm generate:contracts` → exit 0 (35 files); `git status` shows no
    generated-tree diff — output bytes identical under the new installer.
  - `pnpm generate:contracts --check` run twice → exit 0 both times,
    "35 files, byte-identical".
  - Focused: `pnpm --filter @japp/contracts exec vitest run
    test/generated/fsops-install.test.ts` → exit 0, 11 tests;
    `pnpm --filter @japp/contracts exec vitest run` → exit 0, 7 files,
    199 tests; `uv run pytest scripts/tests/test_integrity.py` → exit 0,
    15 passed; `uv run pytest scripts/tests -q` → exit 0, 455 passed.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`
    (unit-ts, 207 tests across 9 packages — @japp/contracts 199),
    `pnpm test:e2e` (1), `pnpm test:python` (full pytest 456 = 455
    scripts/tests + 1 orchestrator), `pnpm test:rust` → all exit 0.
  - `pnpm run doctor` → exit 0, 20 PASS / 1 WARNING (expected uncommitted
    implementation state) / 0 FAIL / 2 NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0; contract-gen ACTIVE and PASS; contract and
    visual honestly NOT_YET_APPLICABLE; status-neutral.
  - `git diff --check` → exit 0 (no whitespace/conflict markers).
- Reviewability proof: before the repair, git rendered
  `packages/contracts/test/generated/generator.test.ts` as a BINARY blob
  in diffs (the literal NUL suppressed text review); the repair diff shows
  `Bin 19947 -> 20657 bytes`, and from the repair commit onward the module
  diffs as ordinary text.
- Clean-clone simulation at repair commit
  `349fc7c16fee98d85ed547ade045baeb4f68afec`: fresh
  `git clone` → `pnpm install --frozen-lockfile` → `uv sync --locked` →
  `pnpm exec playwright install chromium` → `pnpm generate:contracts
  --check` ("35 files, byte-identical") → write-mode
  `pnpm generate:contracts` followed by `git status --porcelain` → zero
  changes → `pnpm run doctor` (21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE) → `pnpm verify` → exit 0; clean tree throughout.
- Hosted three-OS repair verification: run 30240026519 at repair commit
  `349fc7c16fee98d85ed547ade045baeb4f68afec` succeeded on all three
  required jobs: ubuntu-24.04 job 89895114904 (2m21s), windows-2025 job
  89895114913 (4m50s), and macos-15 job 89895114914 (2m34s). The complete
  Windows job log was downloaded and inspected: exact checkout of the
  repair commit; doctor 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE; "generated contracts are up to date (35 files,
  byte-identical)"; 456 Python tests (`456 passed in 96.08s`);
  contract-gen ACTIVE and PASS; `verification exit code: 0`.
- After this hosted success, M01-W02 was re-marked VERIFIED at the repair
  content tree `8a081776719d02ee7aeceb99bfe731f5663883c4`, M01-W03
  returned to the sole READY package, M01 remains IN_PROGRESS, M00
  remains ACCEPTED, and all four critical gates remain NOT_EVALUATED. The
  conventional restamp commit records this closeout; its own three-OS run
  is required to pass at the final head.

### M01-W01 — Define JSON Schema conventions (2026-07-26)

- Revision: tree `20c25e66d5792506870531aa4a8cd01971b362c9` / commit
  `a77a01d52fb6be9cd535c6878b902146bf637632` (verified content head; stamped
  in the conventional follow-up commit after its hosted three-OS run
  passed). Bootstrap ran at starting HEAD
  `ae01f1136a9990cd06f4271b5216148542e04097` (clean `main`, equal to
  `origin/main`).
- Environment: macOS (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustup toolchain
  1.97.1 (cargo/rustc/rustfmt/clippy); @playwright/test 1.62.0 with pinned
  Chromium; new workspace-catalog dependencies ajv 8.20.0 and
  ajv-formats 3.0.1 (exact pins, single ajv instance in pnpm-lock.yaml).
- Clean-session bootstrap (all inspected at starting HEAD):
  - `git fetch origin`, `git status --short`, `git branch --show-current`,
    `git rev-parse HEAD`, `git rev-parse origin/main`, `git log --oneline -8`
    → exit 0; clean tree; branch `main`; local HEAD and `origin/main` both
    `ae01f1136a9990cd06f4271b5216148542e04097`.
  - `gh run view 30231563100` → final M00-W10 stamp run succeeded on all
    three required jobs: ubuntu-24.04 job 89871309320, macos-15 job
    89871309329, windows-2025 job 89871309349.
  - `python3 scripts/validate_status.py` → exit 0, all 36 check groups
    passed (M00 ACCEPTED; M00-W01…W10 VERIFIED; M01-W01 sole READY; no
    IN_PROGRESS package; all four gates NOT_EVALUATED).
  - `pnpm traceability:check` → exit 0, exactly 157 requirements and 286
    work packages validated.
  - `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL and honest
    NOT_YET_APPLICABLE states for contract-gen (M01-W02), contract
    (M01-W05), and visual (M10-W06).
  - `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts,
    e2e-browser, python, rust, portability, traceability, status, and
    integrity suites all passed; the three inactive suites reported
    NOT_YET_APPLICABLE.
- Implementation delivered after the passing bootstrap (packages/contracts):
  - `schemas/common/` — twelve hand-authored Draft 2020-12 foundational
    documents (stable-id, schema-version, timestamp-utc, calendar-date,
    enum-token, money, location, provenance, confidence, redaction,
    correlation, envelope) plus the test-only composition fixture
    `schemas/fixture/test-record.v1.schema.json`; every document declares
    `$schema` Draft 2020-12, a unique `urn:japp:schema:…:v<major>` `$id`
    matching its path, and `x-japp-schema-version`.
  - `src/` — deterministic offline catalog loader with fail-closed
    convention checks (`conventions.ts`, `catalog.ts`), strict Ajv 2020
    validator with full-mode date/date-time formats, the five registered
    `x-japp-*` annotation keywords, meta-schema validation and no remote
    resolution (`validator.ts`), the major/minor acceptance policy
    (`versioning.ts`), and two-phase enveloped-record validation
    (`envelope.ts`).
  - `test/schema/` — positive/negative convention, definition, and
    envelope/versioning suites (deliberately not `test/contract/`, which
    stays reserved for M01-W05).
  - `README.md` — the normative convention document (ownership, layout,
    reconstruction, versioning/compatibility policy, redaction vocabulary,
    null-versus-missing, no-defaults/no-coercion, extension mechanism,
    validation configuration, M01-W02 generation boundaries).
- Traceability and governance updates in this package:
  - M01-W01 marked IN_PROGRESS in docs/PROJECT_STATUS.md and mirrored in
    docs/traceability.json (single-line JSON state change; canonical
    serialization preserved); docs/REQUIREMENTS_TRACEABILITY.md regenerated.
  - REQ-PLAT-005 stays honestly `SCAFFOLD_ONLY`/`NOT_YET_APPLICABLE` and now
    records only the implemented schema-versioning portion (evidence anchor
    `### M01-W01`, six code paths, two test paths, and notes naming the
    future owners M01-W02, M04-W02, and M05). This is a reviewed intentional
    update of the expanded requirement hash: docs/traceability.json and the
    independently pinned `FINAL_V1_3_REQUIREMENT_MAPPING_SHA256` in
    scripts/traceability.py moved together from
    `4e18c9533e49cfc4eefd5774bb17cb51a19b8f51b97e430900ee06a8fce7445b` to
    `2f6fcd94dcf6b7aa9e2a686683cc8243d25138addc0fac049f2bfc0a7416bcaf`;
    the preserved v1.2 hashes and the v1.3 package-dependency hash are
    unchanged. Regression coverage added:
    `test_versioning_requirement_claim_stays_partial_after_m01_w01` and
    `test_reviewed_plat_005_evidence_tamper_fails_after_self_rehash`
    (plus the trace-repo fixture now carries the referenced contract files).
  - KI-0015 (MEDIUM, FIXED) recorded in docs/KNOWN_ISSUES.md: one status
    negative inherited the pre-M01 idle premise and was repaired to
    establish its own complete premise (same class as KI-0014).

#### M01-W01 implementation validation (local, uncommitted working tree)

- `pnpm install --frozen-lockfile` → exit 0 ("Already up to date"; lockfile
  carries the new exact catalog pins ajv 8.20.0 and ajv-formats 3.0.1).
- `uv sync --locked` → exit 0 (resolved 17, checked 15 packages; no Python
  dependency changes).
- `pnpm traceability:generate` then `pnpm traceability:check` → exit 0,
  157 requirements and 286 work packages validated after the M01-W01 state,
  REQ-PLAT-005, and reviewed-hash updates.
- `python3 scripts/validate_status.py` → exit 0, all 36 check groups passed
  with M01-W01 IN_PROGRESS as the single active package.
- `pnpm run doctor` → exit 0, 19 PASS / 1 WARNING / 0 FAIL / 3
  NOT_YET_APPLICABLE; the only warning is the expected "uncommitted changes
  present" working-tree state during implementation (the clean-clone run
  below shows 20 PASS / 0 WARNING).
- `pnpm lint` → exit 0 (typed strict + stylistic ESLint over the workspace,
  including the new src/ and test/schema/ code).
- `pnpm format:check` → exit 0 (Prettier + Ruff format + rustfmt).
- `pnpm typecheck` → exit 0 (turbo tsc over all packages, root Playwright
  project, strict mypy over services and scripts).
- `pnpm test` → exit 0 (unit-ts suite; per-package Vitest proofs).
- Focused contracts suites: `pnpm --filter @japp/contracts exec tsc -p
  tsconfig.json` → exit 0; `pnpm --filter @japp/contracts exec vitest run`
  → exit 0, 4 test files, 71 tests passed (workspace wiring plus
  test/schema/conventions.test.ts, definitions.test.ts, envelope.test.ts:
  catalog conventions and determinism, per-definition positive/negative
  instances, annotation-vocabulary compile rejections, envelope/version
  policy, null-versus-missing, extension mechanism, offline-only
  resolution, duplicate-$id rejection, catalog loading failures).
- `pnpm test:e2e` → exit 0 (1 Playwright pinned-Chromium smoke test).
- `pnpm test:python` → initially FAILED exposing KI-0015 (1 failed / 359
  passed); after the premise repair `uv run pytest` → exit 0, 360 passed
  (90 status-validator tests and 62 traceability tests, including the two
  new REQ-PLAT-005 regressions).
- `pnpm test:rust` → exit 0 (fmt, clippy -D warnings, 1 cargo test, build).
- `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts (79
  Vitest tests across 9 packages), e2e-browser, python (360), rust,
  portability, traceability, status, and integrity suites all PASS;
  contract-gen (M01-W02), contract (M01-W05), and visual (M10-W06) remain
  honestly NOT_YET_APPLICABLE and inactive.

#### M01-W01 clean-clone simulation (local, committed content revision)

- `git clone <repository> <fresh directory>` at
  `a77a01d52fb6be9cd535c6878b902146bf637632` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0 in the fresh clone.
- `uv sync --locked` → exit 0 (uv-managed 3.12.13 environment recreated).
- `pnpm exec playwright install chromium` → exit 0 (pinned browser cache).
- `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL / 3
  NOT_YET_APPLICABLE; working tree clean.
- `pnpm verify` → exit 0; every ACTIVE suite PASS; contract-gen, contract,
  and visual honestly NOT_YET_APPLICABLE.

#### M01-W01 hosted three-OS content verification

- Content run 30234552561 at commit
  `a77a01d52fb6be9cd535c6878b902146bf637632` succeeded on all three
  required jobs: windows-2025 job 89879728959 (4m53s), macos-15 job
  89879728973 (2m58s), and ubuntu-24.04 job 89879729025 (2m21s).
- The complete Windows job log was downloaded and inspected: the job checked
  out exactly `a77a01d52fb6be9cd535c6878b902146bf637632`; the canonical
  doctor reported 20 PASS / 0 WARNING / 0 FAIL / 3 NOT_YET_APPLICABLE with a
  clean working tree; aggregate verification reported every ACTIVE suite
  PASS with 71 @japp/contracts Vitest tests, 360 Python tests
  (`360 passed in 75.95s`), and `verification exit code: 0`; the schema
  suites therefore execute identically on Windows (deterministic
  catalog/loading behavior, REQ-PLAT-013 infrastructure evidence only — not
  Windows 11 product certification).
- After this hosted success, M01-W01 was marked VERIFIED at content tree
  `20c25e66d5792506870531aa4a8cd01971b362c9`, M01-W02 became the sole READY
  package, and M01 remains IN_PROGRESS. The conventional revision-stamp
  commit records this closeout; its own three-OS run is required to pass at
  the final head.
- Stamp-state validation exposed and fixed KI-0016 (M00-closeout fixture
  helpers inherited pre-M01 boundary rows; eight fixture assertions).
  After the premise repairs: `uv run pytest scripts/tests` → exit 0,
  359 passed; `python3 scripts/validate_status.py` → exit 0 (36 groups);
  `pnpm traceability:check` → exit 0 (157/286); complete `pnpm verify` →
  exit 0 in the stamped state with contract-gen still honestly
  NOT_YET_APPLICABLE while M01-W02 is READY-but-unbegun.

### M00-W10 — Extend traceability and re-accept M00 under v1.3 (2026-07-26)

- Revision: tree `30c575dcc142a8276f0aed754cac50ed1fc3ab75` / commit
  `ef830d91e7a6bffe3c74825b98405ce379cc7187` (final verified content head
  after fail-closed Windows and closeout-fixture repairs; stamped in the
  conventional follow-up commit after its hosted three-OS run passed).
- Independent clean-session bootstrap:
  - `git fetch origin`, `git status --short`, `git branch --show-current`,
    `git rev-parse HEAD`, and `git rev-parse origin/main` → exit 0; clean
    `main`; local HEAD and `origin/main` both
    `c09faaf02e546a1d57f402f18341087b21da492d`.
  - `python3 scripts/validate_status.py` → exit 0, all 35 bootstrap check
    groups passed.
  - `pnpm traceability:check` → exit 0, exactly 157 requirements and 286
    work packages validated.
  - `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL / 3 honest
    NOT_YET_APPLICABLE suite states.
  - `pnpm verify` → exit 0; 248 Python tests, nine fresh workspace Vitest
    tests, one Playwright browser smoke test, and one Rust test passed;
    status, traceability, portability, and integrity suites passed.
- Independent history and hosted-evidence audit:
  - Inspected the complete diffs
    `0f8059c97d1167d6bb34413bae5c1c3c44b1ae37..33b012e1d30fa82b62ee0ce02746b56839c4816b`
    and
    `33b012e1d30fa82b62ee0ce02746b56839c4816b..c09faaf02e546a1d57f402f18341087b21da492d`
    rather than relying on the prior implementation report.
  - Inspected actual GitHub Actions metadata and all six job logs for
    M00-W09 content run 30226212092 (macOS 89856707366, Windows
    89856707365, Ubuntu 89856707333) and final-head run 30226415354
    (Windows 89857236382, macOS 89857236428, Ubuntu 89857236430). Both
    revisions and all jobs succeeded; every job checked out its exact head
    and ran the same locked installs plus `pnpm run doctor` and
    `pnpm verify`. The Windows Server 2025 jobs remain infrastructure
    evidence only, not Windows 11 product certification.
- Human-reviewed traceability audit:
  - Compared all 22 new requirement records (`REQ-PLAT-011…026`,
    `REQ-GATE-017…022`) against exact §4 text/family, §9 owners, planned
    components, automated/manual/native/benchmark evidence, gate/release
    effects, and actual repository state.
  - Compared all 26 new package records against exact IDs/titles,
    sequential direct prerequisites, milestone/accepted/gate prerequisites,
    primary deliverables, package-specific automated/manual/native proof,
    direct downstream packages/milestones, and current evidence.
  - Confirmed all dependency edges and readiness qualifiers were correct.
    Corrected `REQ-PLAT-013` to verified repository-infrastructure evidence;
    recorded `REQ-PLAT-025` as `SCAFFOLD_ONLY` because shell-neutral
    repository commands exist while M03-W09 packaged runtime discovery does
    not; kept every future product requirement/package honest and without
    current implementation evidence.
  - Preserved the v1.2 requirement hash
    `c2b4275f13d1074dea1532ae8d2a9020668eb44751c371e562cc78e46844eec9`
    and dependency hash
    `bb42505238220f4b3230456f2a8c03ded62308e12b8773714fc9c559175fdb5f`.
    The final reviewed v1.3 requirement-mapping hash is
    `4e18c9533e49cfc4eefd5774bb17cb51a19b8f51b97e430900ee06a8fce7445b`;
    the final reviewed package dependency/proof-plan hash is
    `549e793e447ba43d11d43992e81a0fb8137a4ebb6da1db9c04b4bce226707760`.
    Both are independently pinned in `scripts/traceability.py`, not merely
    recomputed against mutable companion values in the JSON.
  - Kept all 135 legacy requirement records and 260 legacy package records
    at `REVIEWED_V1_2`; promoted exactly the 22/26 v1.3 delta to
    `REVIEWED_V1_3`; and removed every live
    `PROVISIONAL_PENDING_M00_W10` state. The expanded requirement hash locks
    reviewed mappings plus honest implementation/verification state,
    completed paths, evidence, and notes. The expanded package hash locks
    prerequisites/downstream effects plus package-specific deliverable and
    automated/manual proof plans while live state/revision/evidence remain
    status-owned.
- Independent audit findings and resolutions:
  - KI-0007: the provisional expanded hashes could be refreshed from the
    same edited JSON. Pinned final reviewed hashes and isolated self-rehash,
    mapping, dependency, proof-plan, honesty, and evidence-substitution
    negatives now fail closed.
  - KI-0008: generic workflow text named Claude, v1.3 had generalized
    historical ADR-0001/OD-020 facts, and the PyYAML comment omitted its
    production consumer. Generic wording is now agent-neutral; exact v1.2
    routing facts are restored with explicit prospective ADR-0002/OD-026
    supersession; the dependency comment names
    `scripts/check_portability.py`.
  - KI-0009: Windows home redaction was casing/separator-sensitive and early
    fatal diagnostics bypassed it. Native, forward-slash, mixed-case, UNC,
    boundary, and fatal paths now share fail-closed redaction without
    over-redacting unrelated text; POSIX matching stays case-sensitive.
  - KI-0010: portability predicates admitted disconnected matrices and
    scanned inert docstrings/comments. The checker now proves one exact
    three-OS `matrix.os` job owns both unguarded canonical commands; rejects
    weaker guards, masking, extra/excluded axes, runtime path aliases, and
    executable banned constructs; and ignores module/class/function
    docstrings, type metadata, YAML comments, and PowerShell block comments.
    The valid workflow required no change.
  - KI-0011: arbitrary nonempty Gate D evidence could satisfy future PASS
    checks. PASS now requires resolvable, repository-relative, owner-scoped
    evidence; unique accepted profile/platform/native-messaging/package
    rows; non-placeholder metrics; zero zero-tolerance failures; M27-W12
    decision ownership; and report/ledger/status revision, hash, reviewer,
    owner-decision, and holdout agreement. Gate D remains NOT_EVALUATED and
    no evidence was fabricated.
  - KI-0012: M00 closeout, current/next-work, release, gate-report, and
    preserved-revision checks admitted inconsistent states. The validator
    now requires all ten M00 packages exactly VERIFIED before acceptance,
    makes M01/M01-W01 READY with M01-W01 the sole READY package after valid
    closeout, preserves W01…W09 anchors, and rejects premature gates or
    mismatched status/report/ledger/header state.
- Environment: macOS 27.0 arm64; Node v24.18.0; pnpm 11.17.0; uv
  0.11.32; uv-managed CPython 3.12.13; rustc/cargo 1.97.1; Playwright
  1.62.0 with pinned Chromium.
- Focused post-change verification:
  - `uv run ruff format --check ...`, `uv run ruff check ...`, and
    `uv run mypy scripts/traceability.py scripts/validate_status.py
    scripts/check_portability.py scripts/doctor.py` → exit 0.
  - `uv run pytest scripts/tests -q` → exit 0, 357 passed. The isolated
    fixture coverage includes reviewed-state/hash tampering, deterministic
    JSON/Markdown generation, exact M00/M01 readiness, false Gate D
    evidence, Windows redaction variants, inert-prose false positives,
    executable banned constructs, disconnected/dummy matrices, guarded
    commands, and verification read-only/fail-closed behavior.
  - `python3 scripts/validate_status.py` → exit 0, all 36 current-state
    check groups passed; `pnpm traceability:check` → exit 0 at exactly
    157 requirements / 286 packages; and
    `uv run python scripts/check_portability.py` → exit 0.
  - `pnpm run doctor` → exit 0, 19 PASS / one expected dirty-tree WARNING /
    zero FAIL / three honest NOT_YET_APPLICABLE future suites.
  - Complete focused suites: traceability 60/60; status validator 90/90;
    portability plus CI policy 126/126; doctor 45/45; verification,
    integrity, proof, and suite-state tests 36/36.
- Complete local validation:
  - `pnpm install --frozen-lockfile`, `uv sync --locked`, and
    `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`
    → exit 0; all 13 workspace projects were current, 17 Python packages
    resolved / 15 checked, and the locked Rust dependency graph fetched.
  - `pnpm traceability:generate` twice → exit 0 and the generated view
    remained byte-identical at SHA-256
    `f5abc375054f86eb04facb1fba1f4bb28a4a861693aee1daab500a096f10c5e4`;
    `pnpm traceability:check` remained read-only and validated 157/286.
  - `pnpm run doctor --json` twice → exit 0 and byte-identical output
    (SHA-256
    `8a7fa714ed890856cdee7ec8821e387af3aaf7d367b5e6d070145b9172390fe6`);
    human output remained 19 PASS / one expected dirty-tree WARNING / zero
    FAIL / three honest NOT_YET_APPLICABLE.
  - `pnpm preflight`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
    `pnpm test`, `pnpm test:e2e`, `pnpm test:python`, and
    `pnpm test:rust` each exited 0. Results were nine workspace Vitest
    tests/typechecks, one controlled Chromium test, 358 total Python tests
    including the orchestrator smoke test, and one Rust test plus rustfmt,
    Clippy `-D warnings`, and build.
  - Final working-tree `pnpm verify` → exit 0: toolchain, format, lint,
    typecheck, unit-ts, e2e-browser, Python, Rust, portability,
    traceability, status, and integrity were ACTIVE/PASS; contract-gen,
    contract, and visual remained honestly NOT_YET_APPLICABLE. A before/
    after porcelain comparison proved the aggregate verifier made no
    tracked-state change.
  - `git diff --check` → exit 0; the canonical specification remained the
    sole canonical file, its SHA-256 remained
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`,
    and its 39/286/157/four inventory remained exact.
- Local clean-clone simulation:
  - Cloned the repository with `git clone --no-local` into a new
    `mktemp -d` location, applied the complete binary working diff, committed
    the fixture at tree
    `b2faf78920dae74e995c0a1e7969485628113ee4`, and ran the same locked pnpm,
    uv, and Cargo setup without reusing the source checkout's dependency
    directories.
  - In that clean clone, `pnpm traceability:check` validated 157/286,
    `python3 scripts/validate_status.py --quiet` passed 36 groups,
    `pnpm run doctor` reported 20 PASS / zero WARNING / zero FAIL / three
    honest NOT_YET_APPLICABLE, and `pnpm verify` passed all active suites
    with 358 Python, nine workspace Vitest, one Chromium, and one Rust test.
    Final `git status --short` was empty, proving installs and verification
    were read-only.
- Hosted verification was fail-closed: no local result, partial OS result,
  rerun, or superseded head was treated as M00 acceptance.
- First hosted content attempt and fail-closed response:
  - Content commit `a8630ccffdfdc4faf037dd3a3d127a7fc50bea11`
    (tree `467c5398c8d82b0c2885a9e3acffb0cdfdc3876d`) triggered run
    30229993787. macOS job 89866914146 and Ubuntu job 89866914187 passed
    the canonical doctor, aggregate verification, and no-tracked-changes
    assertion. Windows job 89866914158 failed, so M00 was not accepted.
  - Inspection of the actual Windows log found 356/358 Python tests passed;
    the only failures were two new doctor-test assertions that converted a
    simulated POSIX `Path` to Windows syntax and hard-coded `/` in an
    otherwise correctly redacted native Windows diagnostic. The runtime
    Windows native/forward-slash, case, UNC, boundary, and fatal redaction
    cases themselves passed.
  - KI-0013 records the defect. The repair preserves explicit POSIX test
    syntax as a string and derives the expected fatal diagnostic path with
    the host-native `Path` separator.
- First repair attempt and fail-closed response:
  - Repair commit `27b6bec62d5fc41e7d35c9cd11c4e77e99c1bb65`
    (tree `a44d40315100f9621e36d4277ab6785e4ff18ab5`) triggered run
    30230286865. macOS job 89867742632 and Ubuntu job 89867742629 passed
    the canonical doctor, aggregate verification, and no-tracked-changes
    assertion. Windows job 89867742638 failed, so M00 remained unaccepted.
  - Inspection of the actual Windows log found 357/358 Python tests passed.
    The sole failure was the repaired fatal-path test: the expected native
    path used single `\` separators, while `FileNotFoundError` correctly
    escaped them when rendering its filename. All runtime redaction cases
    and every other active verification suite passed.
  - The second repair normalizes only duplicated backslashes in the
    exception-rendered diagnostic before asserting both the redacted path
    and the independent guarantee that the sensitive home is absent.
- Superseded repair proof:
  - Commit `f8d054ca946b784a771c3a9bed7bbec6b92f465f` (tree
    `21f0801fc08d1f0f4224ce9a1bf5a2c4f713fbc6`) passed run 30230595021:
    macOS job 89868613527, Windows job 89868613536, and Ubuntu job
    89868613559 all succeeded. Before acceptance, an independent review
    found that normalizing only the expected-path assertion could let an
    escaped sensitive home evade the separate absence check. That head was
    therefore superseded despite green CI.
  - The final assertion normalizes the exception-rendered diagnostic once
    and applies both the sensitive-home absence check and the expected
    redacted-path check to the normalized text. Focused doctor tests
    (45/45) and a fresh complete local `pnpm verify` (358/358 Python plus
    every other active suite) passed before the stronger head was pushed.
- Hosted reviewed-content proof:
  - Reviewed-content commit `a26f9a8f58ab2d63a377cd8f1839a83495f00272`
    (tree `34a8c104a42b56f31834b9302d7084a6084b7633`) passed workflow run
    30230657314: `doctor + verify (macos-15)` job 89869050876,
    `doctor + verify (windows-2025)` job 89869050915, and
    `doctor + verify (ubuntu-24.04)` job 89869050931 all concluded SUCCESS.
  - The inspected Windows log proves the exact commit checkout, pinned
    installs, doctor result 20 PASS / zero WARNING / zero FAIL / three
    honest NOT_YET_APPLICABLE suites, 358/358 Python tests, portability and
    36-group status validation, aggregate verification exit 0, and a
    successful no-tracked-changes assertion. This remains
    repository/toolchain infrastructure evidence, not Windows 11 product,
    secure-store, native-messaging, model-runtime, installer, updater, or
    Gate D evidence.
- Closeout-fixture finding and final content repair:
  - When the acceptance-only state was applied locally, the first complete
    `pnpm verify` failed closed with 357/358 Python tests. The sole failure,
    `test_next_ready_none_must_be_exact`, inherited the repository's new
    accepted-M00 baseline, changed M00-W10 to NOT_STARTED, but left
    M01-W01 READY; its asserted “no READY row” condition was therefore not
    isolated. The validator itself continued to reject the invalid state,
    and standalone 36-group status validation passed.
  - KI-0014 records the fixture defect. The test now uses the existing
    `prepare_m00_closeout(..., m01_ready=False)` fixture to establish its
    exact no-READY premise before injecting malformed `NONE nonsense`.
    The complete status suite passed 90/90 and `pnpm verify` passed all 358
    Python tests plus every other active suite in the actual accepted-M00
    closeout state.
  - Final content repair commit
    `ef830d91e7a6bffe3c74825b98405ce379cc7187` (tree
    `30c575dcc142a8276f0aed754cac50ed1fc3ab75`) passed workflow run
    30231197511: Ubuntu job 89870307756, Windows job 89870307759, and
    macOS job 89870307817 all concluded SUCCESS. The inspected Windows log
    proves exact checkout, doctor 20/0/0 with three honest
    NOT_YET_APPLICABLE suites, 358/358 Python tests, portability and status
    success, aggregate verification exit 0, and the no-tracked-changes
    assertion.
- Acceptance decision:
  - All 39 milestones, 286 packages, 157 requirements, four gate records,
    required project-memory/platform files, preserved W01…W09
    revisions/evidence, reviewed v1.3 mappings, stable hashes,
    deterministic generation, local/clean-clone verification, negative
    paths, and hosted three-OS content proof satisfy the complete v1.3 M00
    exit gate at content tree
    `30c575dcc142a8276f0aed754cac50ed1fc3ab75`.
  - A final `git clone --no-local` accepted-state simulation applied the
    complete pre-stamp closeout diff over that content revision and committed
    fixture tree `ba9d605fe3d34844aba6e16222e7abeb59456be2`. Fresh frozen/locked
    pnpm, uv, and Cargo setup passed; traceability validated 157/286; status
    passed 36 groups; doctor reported 20 PASS / zero WARNING / zero FAIL /
    three honest NOT_YET_APPLICABLE suites; `pnpm verify` passed 358 Python,
    nine workspace Vitest, one Chromium, and one Rust test; final porcelain
    was empty.
  - M00-W10 is VERIFIED; M00 is ACCEPTED; M01 and only M01-W01 are READY;
    no package is IN_PROGRESS; all four gates remain NOT_EVALUATED; overall
    release remains NOT_READY. No M01 implementation began. The
    conventional revision-stamp HEAD must independently pass all three
    hosted jobs before handoff; its terminal run is reported at handoff
    rather than creating another evidence-only successor commit.

### M00-W09 — Add Windows CI and platform-portability baseline (2026-07-26)

- Revision: tree `ae69a908cc31e0f1282c136c25fb7f92752680dd` / commit
  `0e27802802b2397169c74d0f0c563506980041b0` (stamped in the conventional
  follow-up commit after its hosted three-OS content run passed).
- Starting prerequisite: `main` was clean at
  `33b012e1d30fa82b62ee0ce02746b56839c4816b`, equal to `origin/main`.
  Final M00-W08 stamp run 30223489467 passed macOS job 89849840494 and
  Ubuntu job 89849840515. `python3 scripts/validate_status.py` (35 groups),
  `pnpm traceability:check` (157/286), `pnpm run doctor` (19 pass / 0 fail /
  3 honest NOT_YET_APPLICABLE), and `pnpm verify` (exit 0) all passed before
  any edit. M00-W01…W08 were VERIFIED, M00-W09 was READY, M00-W10 and
  M01-W01 were NOT_STARTED, no package was IN_PROGRESS, and all four
  critical gates were NOT_EVALUATED.
- Environment: macOS 27.0 arm64 (primary dev machine); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32; uv-managed CPython 3.12.13; rustc 1.97.1 with
  rustfmt/clippy via the rust-toolchain.toml override; Playwright 1.62.0
  with pinned Chromium. Windows facts were verified against the
  actions/runner-images windows-2025 manifest before implementation
  (Rust 1.97.1 + rustup 1.29 preinstalled, Pipx 1.16 with a machine-PATH
  bin dir, PowerShell 7.6, Node 24.18.0 in the tool cache, and the
  actions/python-versions Windows layout that ships a `python3.exe`
  symlink), and actual Windows execution is claimed only from the hosted
  windows-2025 job — never a mocked local result.
- Windows CI architecture (.github/workflows/ci.yml):
  - The single `verify` job matrix is exactly
    `[macos-15, windows-2025, ubuntu-24.04]`; every OS runs the identical
    canonical `pnpm run doctor` and `pnpm verify` steps unguarded (no
    weaker Windows subset), then a shared pwsh no-tracked-changes gate.
  - Shell policy: no workflow-global bash default. Single-command steps
    declare no shell (native per-OS defaults propagate exit codes);
    multi-line bash steps are guarded `runner.os != 'Windows'`; Windows
    scripting uses pwsh with `$ErrorActionPreference = 'Stop'` +
    `$PSNativeCommandUseErrorActionPreference = $true`.
  - Windows toolchain isolation: the Windows Rust step installs exact
    1.97.1 with `--profile minimal --component rustfmt --component clippy`
    into a fresh `RUSTUP_HOME` under `runner.temp` (asserted absent first,
    persisted via GITHUB_ENV, never cached) and probes
    `rustup show active-toolchain`, `rustup which cargo/rustc` vs the
    PATH proxies, `cargo/rustc/rustfmt/cargo clippy --version`, plus the
    `+1.97.1` proxy checks — mirroring the POSIX step.
  - Frozen/locked installs on every OS: `pnpm install --frozen-lockfile`,
    `uv sync --locked`, `cargo fetch --locked`, and
    `pipx install "uv==<pyproject pin>"`; Chromium installed per OS
    (`--with-deps` only on Linux). Caches (pnpm store, uv, cargo
    registry/git, Playwright) carry runner.os + runner.arch +
    hashFiles keys, gained the Windows locations
    (`~/AppData/Local/uv/cache`, `~/AppData/Local/ms-playwright`), and
    still have no restore-keys; failure-only Playwright artifact upload
    is unchanged with a per-OS artifact name.
- Doctor/runner portability (scripts/portability.py, scripts/doctor.py,
  scripts/verify.py):
  - New shared `scripts/portability.py` resolves executables with
    injectable platform flavor, PATH entries, PATHEXT, and probes:
    PATHEXT/.exe/.cmd and case-insensitive semantics on Windows (no
    executable-bit requirement), executable bit on POSIX; runtime callers
    execute the resolved absolute path (cwd never searched).
  - `doctor.py` gained injectable `platform_id`/`home`, a `platform`
    check, per-platform remediation (winget/rustup-init/PowerShell wording
    on Windows — never Homebrew), home redaction in both `\\` and `/`
    spellings, and PATH/PATHEXT-aware child spawning; `verify.py` maps the
    registry's literal `python3` onto its own pinned interpreter and
    resolves all other commands the same way;
    `traceability.py generate` now writes the view with `newline="\n"`.
  - `.gitattributes` (`* text=auto eol=lf`) makes checkouts byte-identical
    on every platform; all 102 tracked text files were already LF.
- Platform scaffold: `packages/platform` (`@japp/platform`) with
  package.json, tsconfig, ownership README, ownership-notice entry point,
  and the standard workspace-wiring smoke test. No M01-W07 interface, no
  secure-store/native-messaging/model/installer/product behavior. Turbo
  and Vitest discovery proofs now count 9 workspace packages.
- Static portability policy (scripts/check_portability.py; new mandatory
  always-active `portability` suite in scripts/verification-suites.json,
  owner M00-W09): PORT-CI-001…018 enforce the exact three-OS matrix,
  unguarded canonical commands, per-step shell discipline, no POSIX-only
  tokens in Windows-reachable steps, no continue-on-error or masked child
  failures, SHA-pinned official actions, read-only permissions,
  persist-credentials: false, frozen/locked installs, exact Rust probes,
  runner.temp-isolated uncached RUSTUP_HOME, an allowlisted dependency
  cache set (rejecting toolchain state, build output, profiles, or
  private data), per-OS Chromium installs, failure-only test-results
  uploads, and no live-site URLs. PORT-SRC-001…008 reject hard-coded
  /tmp//bin//usr//etc//var literals, shell=True and bash-wrapper strings,
  manual separator concatenation, X_OK/chmod outside the designated
  scripts/portability.py module, case-colliding tracked paths, a missing
  LF .gitattributes rule, POSIX-only package.json scripts, and non-allowlisted
  registry command heads. Scans are AST/structure-based over executable
  surfaces only; documentation, scripts/tests fixtures, comments, and URL
  literals cannot false-positive (proven by dedicated tests).
- Commands and observed results (current repository state, in order):
  - `pnpm install --frozen-lockfile` → exit 0 (13 workspace projects
    after adding @japp/platform; pnpm-lock.yaml updated intentionally).
  - `uv sync --locked` → exit 0 (17 resolved / 15 checked).
  - `pnpm run doctor` → exit 0: 19 PASS (including the new Host platform
    check), expected dirty-tree WARNING during development, 0 FAIL,
    3 honest NOT_YET_APPLICABLE suites.
  - `pnpm run doctor --json` twice → exit 0, byte-identical payloads
    (stable machine-readable output).
  - `uv run python scripts/check_portability.py` → exit 0 on the real
    repository (both verbose and --quiet forms).
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, `pnpm test:rust` → each exit 0.
    Results: 9/9 turbo typecheck tasks + root tsc + strict mypy over 17
    source files; 9/9 package Vitest runs; 1/1 pinned-Chromium smoke;
    248/248 Python tests; 1/1 Rust test plus rustfmt, Clippy
    `-D warnings`, and build.
  - Focused suites: `uv run pytest scripts/tests/test_doctor.py -q` →
    33 passed (13 new Windows simulations: healthy Windows run with
    0 FAIL on Windows-native toolchain paths; wrong Node/missing
    pnpm/missing uv/wrong Python patch/missing rustup proxy/wrong
    toolchain/missing rustfmt+clippy/missing Chromium all FAIL with
    Windows-specific, Homebrew-free remediation; drive-letter +
    space/Unicode home redaction; CRLF pin files; unresolvable-command
    diagnosis). `uv run pytest scripts/tests/test_ci_workflow.py -q` →
    40 passed. `uv run pytest scripts/tests/test_portability.py -q` →
    50 passed (Windows .exe/.CMD/PATHEXT/case/space/Unicode/drive-letter
    resolution and no-execute-bit semantics via injected environments;
    baseline policy fixture clean; every PORT-CI/PORT-SRC negative fires;
    guarded platform-specific equivalents permitted; docs/test-fixture/
    comment/URL literals produce no false positives; real repository
    passes; registry `python3` maps to the pinned interpreter).
  - Full regression: `uv run pytest -q` → 248 passed, 0 failed
    (M00-W04 runner/proof, M00-W05/W06 status+CI+doctor, M00-W07
    traceability, and M00-W08 inventory suites all green; the only
    expectation updates are the intended inventory growth to 9 workspace
    packages and the new always-active portability suite).
  - `pnpm traceability:generate` then `pnpm traceability:check` → exit 0,
    157 requirements / 286 work packages; regeneration is deterministic.
  - `python3 scripts/validate_status.py` → exit 0, 35/35 check groups at
    the final status state (M00-W09 VERIFIED `stamp pending`, M00-W10
    READY, no IN_PROGRESS).
  - Final `pnpm preflight` → exit 0 (doctor, then the canonical
    aggregate); final `pnpm verify` → exit 0 with toolchain, format,
    lint, typecheck, unit-ts, e2e-browser, python, rust, portability,
    traceability, status, and integrity ACTIVE/PASS and contract-gen,
    contract, visual honestly NOT_YET_APPLICABLE.
  - Clean-clone simulation: `git clone . <temp>` +
    `pnpm install --frozen-lockfile` + `uv sync --locked` +
    `python3 scripts/validate_status.py` + `pnpm traceability:check` +
    `uv run python scripts/check_portability.py` + `pnpm run doctor`
    inside the clone → all exit 0 (Chromium-dependent probes reuse the
    machine's installed pinned browser; full aggregate verification in a
    clean clone is otherwise identical to the in-repo run).
- Test counts: 248 Python (incl. 33 doctor, 40 workflow, 50 portability),
  9 Vitest packages, 1 Playwright smoke, 1 Rust; 0 failed, 0 skipped.
- Artifacts: none retained (all suites passed; Playwright artifacts are
  failure-only).
- Security/supply-chain: read-only workflow token unchanged; only
  SHA-pinned official `actions/*` actions; no third-party Windows setup
  action introduced (official actions plus repository commands and the
  preinstalled runner pipx/rustup are sufficient); no secrets, live-site
  tests, environment dumps, browser profiles, or user data in CI, caches,
  or artifacts; the portability suite now enforces these properties
  deterministically on every platform.
- Honest scope: the windows-2025 job is a repository/toolchain
  portability baseline. Windows product certification remains
  NOT_YET_IMPLEMENTED; passing windows-2025 CI does not prove packaged
  Windows 11 desktop support; CROSS_PLATFORM_CORE remains NOT_EVALUATED;
  no Windows secure-store, native-messaging, local-model, installer,
  update, or product claim exists (docs/PLATFORM_SUPPORT.md,
  docs/platform/CERTIFIED_MATRIX.md).
- Hosted content proof: workflow run 30226212092 at content commit
  `0e27802802b2397169c74d0f0c563506980041b0` passed all three required
  jobs on the first attempt — `doctor + verify (macos-15)` job
  89856707366 (1m39s), `doctor + verify (windows-2025)` job 89856707365
  (3m42s), and `doctor + verify (ubuntu-24.04)` job 89856707333 (2m3s).
  The inspected Windows log confirms Microsoft Windows Server 2025
  (10.0.26100, image windows-2025-vs2026), a read-only GITHUB_TOKEN,
  pipx-installed `uv 0.11.32 (x86_64-pc-windows-msvc)`, Rust
  `1.97.1-x86_64-pc-windows-msvc` installed into the isolated
  `D:\a\_temp/rustup-home` selected by the rust-toolchain.toml override
  with `rustup which cargo/rustc` resolving inside that home and distinct
  PATH proxies, uv-managed CPython 3.12.13, the canonical
  `pnpm run doctor` reporting `Host platform PASS (windows)` with
  `summary: 20 pass, 0 warning, 0 fail, 3 not-yet-applicable`, and the
  canonical `pnpm verify` finishing `verification exit code: 0` with
  unit-ts, e2e-browser, python, rust, and portability (among all
  mandatory suites) ACTIVE/PASS and no tracked changes afterward. The
  final revision-stamp HEAD requires its own successful three-OS run
  before closeout.

### M00-W08 — Adopt and migrate the v1.3 cross-platform rebaseline (2026-07-26)

- Revision: tree `e05dbf9bdf9c190e8cd6b022d9611d65805740b7` / commit
  `9bb12322b993d233017d53bfa14f853c5fc86e34` (stamped in the conventional
  follow-up commit after its hosted content run passed).
- Starting prerequisite: `main` was clean at
  `0f8059c97d1167d6bb34413bae5c1c3c44b1ae37`, equal to `origin/main`.
  Final v1.2 workflow run 30220655705 passed macOS job 89842408688 and
  Ubuntu job 89842408669. `python3 scripts/validate_status.py`,
  `pnpm traceability:check`, `pnpm run doctor`, and `pnpm verify` all exited
  0 before adoption; v1.2 was exactly 39 milestones / 260 packages /
  135 requirements / 3 gates, M00-W01…W07 were VERIFIED, M00 was ACCEPTED,
  and M01-W01 was READY but untouched.
- External adoption proof:
  - Source:
    `/Users/tanishkalwad/Downloads/MASTER_IMPLEMENTATION_SPEC_v1.3_final.md`.
  - `shasum -a 256` on both the external file and the adopted canonical file
    returned
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`.
    The superseded v1.2 canonical SHA-256 was
    `9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901`.
  - Independent parsing found version 1.3, the exact cross-platform
    rebaseline revision, 124 balanced Markdown fences, milestones M00…M38 in
    order, 286 unique packages, 157 unique requirements, and four gates.
    The M00 table contains uninterrupted W01…W10 rows. All 260 v1.2 package
    IDs/titles and 135 requirement IDs remain; the exact delta is 26
    packages and 22 requirements.
  - Policy inspection confirmed owner-controlled persistent agent selection,
    no automatic Claude/Codex/reasoning-mode routing, separate clean-session
    audits, Workday-first production ordering, unchanged exclusions, M05
    primary-Mac acceptance plus Windows/Ubuntu capability/safe fallback,
    no M06 dependency on Windows/Ubuntu full-AI acceptance, and final
    Windows/Ubuntu full-AI ownership at M27-W10 before Gate D.
  - The external bytes were copied directly over
    `docs/MASTER_IMPLEMENTATION_SPEC.md`. `find docs -name
    'MASTER_IMPLEMENTATION_SPEC*'` returns exactly that one canonical file.
    No proposed or archived duplicate exists and no validator exception was
    added.
- Traceability preservation and extension:
  - The M00-W07 JSON/generator/generated-view architecture remains in place.
    The v1.2 reviewed mapping hash is unchanged at
    `c2b4275f13d1074dea1532ae8d2a9020668eb44751c371e562cc78e46844eec9`;
    the v1.2 reviewed dependency hash is unchanged at
    `bb42505238220f4b3230456f2a8c03ded62308e12b8773714fc9c559175fdb5f`.
  - The 22/26 delta is mechanically added and visibly labeled
    `PROVISIONAL_PENDING_M00_W10`. Future product requirements remain
    `NOT_STARTED`/`NOT_YET_APPLICABLE` with no completed paths or evidence.
    M00-W10 still owns the complete reviewed mapping audit.
  - `pnpm traceability:generate` and `pnpm traceability:check` exit 0 at
    exactly 157 requirements / 286 packages; a second generation is
    byte-stable and check mode leaves tracked state unchanged.
- Governance and readiness:
  - ADR-0002 records the external transport, exact hash, target matrix,
    platform abstractions, secure-store/native-messaging/package/update
    policies, staged AI sequencing, traceability preservation, owner-selected
    agent policy, and v1.2 rollback through Git history.
  - `docs/PLATFORM_SUPPORT.md`, Gate D, and the four `docs/platform/`
    planning/future-evidence matrices contain no product, installer,
    benchmark, full-AI, compatibility, or native-packaging claim.
  - All four gates remain NOT_EVALUATED. M00 is reopened; the historical
    v1.2 M01-W01 readiness is revoked. After this package verifies, only
    M00-W09 becomes READY; M00-W10 and M01-W01 remain NOT_STARTED.
- Focused positive/negative results:
  - `uv run pytest scripts/tests/test_traceability.py
    scripts/tests/test_validate_status.py -q` → exit 0, 88 passed.
  - `uv run pytest scripts/tests -q` → exit 0, 172 passed. The canonical
    `uv run pytest` including the orchestrator smoke test collected and
    passed 173 tests.
  - Coverage includes exact hash/order/counts and v1.2 preservation; missing,
    duplicate, unknown, and stale platform records; missing governance files
    and Gate D records/reports; incomplete Gate D PASS; M28/M01 blocking;
    M06 independence from later full-AI acceptance; false future claims;
    legacy remap/reclassification; provisional labeling; owner-controlled
    agent policy; deterministic regeneration; and duplicate canonical specs.
  - `uv run ruff check ...` and `uv run mypy ...` over all changed Python and
    test files exited 0. The first focused `ruff format --check` correctly
    found three edited files; `uv run ruff format` corrected them rather than
    masking the failure.
- Complete local validation:
  - `pnpm install --frozen-lockfile` → exit 0 (12 workspace projects, already
    up to date); `uv sync --locked` → exit 0 (17 resolved / 15 checked).
  - `pnpm run doctor` → exit 0: 18 PASS, expected dirty-tree WARNING,
    0 FAIL, and 3 honest NOT_YET_APPLICABLE future suites; it found 20
    required memory files and four gate reports.
  - The first final-state `pnpm preflight` exited 1 because Ruff correctly
    detected one newly edited test file that still needed formatting. After
    `uv run ruff format scripts/tests/test_traceability.py`, the second
    `pnpm preflight` exited 0 and its aggregate verification passed every
    active suite.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, and `pnpm test:rust` each exited 0.
    Results: 8/8 TypeScript package tests; 8/8 TypeScript package typechecks;
    1/1 pinned-Chromium test; 173/173 Python tests; 1/1 Rust test plus
    rustfmt, Clippy `-D warnings`, and build.
  - Focused final subsets: traceability 43/43; status validator 45/45;
    verification runner/integrity 36/36; doctor/CI policy 48/48.
  - Final `pnpm verify` → exit 0. Toolchain, format, lint, typecheck, unit-ts,
    e2e-browser, Python, Rust, traceability, status, and integrity were
    ACTIVE/PASS. Contract generation, contract compatibility, and visual
    remain correctly NOT_YET_APPLICABLE.
  - Final `python3 scripts/validate_status.py` → exit 0, 35/35 check groups.
    Final `pnpm traceability:check` → exit 0 at 157/286.
  - Structural audit printed canonical SHA-256
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`,
    124 balanced fences, 39/286/157/4 counts, uninterrupted M00-W01…W10,
    and exactly one canonical-looking file. `git diff --check` reports only
    eight intentional two-space Markdown hard-break lines already present
    in the owner-approved exact-byte specification; altering them would
    violate byte identity. No other whitespace error exists.
- Security/privacy impact: governance metadata only. No executable product
  feature, schema, secret, PII, applicant data, telemetry, live-site result,
  installer, model artifact, or speculative compatibility evidence was
  introduced.
- Hosted content proof: workflow run 30223370286 at content commit
  `9bb12322b993d233017d53bfa14f853c5fc86e34` passed
  `doctor + verify (macos-15)` job 89849529794 and
  `doctor + verify (ubuntu-24.04)` job 89849529811. Both jobs ran the
  canonical aggregate verification and confirmed it left no tracked
  changes. The final revision-stamp HEAD requires its own successful hosted
  run before closeout.

### M00-W07 — Seed traceability and status (2026-07-26)

- Revision: tree fee2902010eb90704c05e584fb6ff7964327cb0b / commit
  22e6f0ae826ef551edfaf025fbc523411ef62637 (stamped in the conventional
  follow-up commit after its hosted content run passed).
- Starting prerequisite: HEAD and `origin/main` were both
  `6946c5929037b475f61ee25bf3e8adb9c7c0e9a9` on `main`, with a clean tree.
  Final M00-W06 stamp run 30218521997 was successful on macOS and Linux;
  M00-W01 through M00-W06 were VERIFIED, M00-W07 was READY, no package was
  IN_PROGRESS, all three critical gates were NOT_EVALUATED, the status
  validator passed 25 check groups, doctor reported 19 PASS / 0 FAIL /
  3 honest NOT_YET_APPLICABLE suites, and baseline `pnpm verify` exited 0
  with 109 Python tests.
- Traceability architecture:
  - `docs/MASTER_IMPLEMENTATION_SPEC.md` remains authoritative for exact
    requirement text, requirement IDs, milestone/package IDs and titles,
    and explicit milestone/gate dependencies. Its unchanged SHA-256 is
    `9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901`.
  - `docs/PROJECT_STATUS.md` remains authoritative for live package and
    milestone state/evidence; `docs/CRITICAL_GATES.md` plus `docs/gates/`
    remain authoritative for live gate state/evidence.
  - `docs/traceability.json` is the reviewed machine source for all 135
    requirement mappings and all 260 expanded work-package dependency,
    verification, and evidence records. Reviewed mapping/dependency hashes
    make an ownership or derived-edge edit explicit.
  - `scripts/traceability.py` parses the canonical inputs, validates exact
    agreement and fraud/drift negatives, derives the one legitimate next
    package, and deterministically renders
    `docs/REQUIREMENTS_TRACEABILITY.md`.
  - Sequential edges are labeled `REVIEWED_DERIVED_SEQUENTIAL`, based on
    spec §1 ordering and each §9 package list. Cross-milestone and
    critical-gate edges are not invented; they must match the specification
    exactly.
- Honest requirement state: six M00 readiness/ledger requirements
  (`REQ-RES-017`, `REQ-FORM-022`, `REQ-WD-001`, `REQ-GATE-001`,
  `REQ-GATE-005`, `REQ-GATE-014`) link real M00-W05 code, tests, and
  evidence and are VERIFIED. Ten partial infrastructure records are
  `SCAFFOLD_ONLY`. Every other future requirement is
  `NOT_STARTED`/`NOT_YET_APPLICABLE` with no completed path, result,
  compatibility claim, or evidence.
- Focused commands run and inspected so far:
  - `python3 scripts/traceability.py generate` and
    `pnpm traceability:check` → exit 0; exactly 135 requirements and 260
    packages validated; generated view agrees byte-for-byte.
  - `uv run pytest scripts/tests/test_traceability.py -q` → exit 0,
    31 passed. Coverage includes exact counts/uniqueness; missing,
    duplicate, and unknown requirements/packages; text/title/milestone/
    ownership drift; unknown dependencies and cycles; Workday gate
    dependencies; M03/M06/M21 gate blocking; future-claim fraud; missing
    completed code/test paths, evidence headings, and gate reports;
    human/machine drift; deterministic read-only regeneration; canonical
    inventory drift; and M00→M01 next-work derivation.
  - `uv run pytest scripts/tests/test_validate_status.py -q` → exit 0,
    31 passed. New tests prove M01-W01 requires M00 ACCEPTED, becomes READY
    after valid M00 acceptance, later M01 packages stay blocked by sequence,
    and a milestone may be ACCEPTED while its completed package rows remain
    VERIFIED.
  - `uv run ruff check scripts/traceability.py
    scripts/tests/test_traceability.py` → exit 0.
  - `uv run mypy scripts/traceability.py
    scripts/tests/test_traceability.py` → exit 0, no issues.
- Full local command matrix (working tree; all results inspected):
  - `pnpm install --frozen-lockfile` → exit 0; all 12 workspace projects
    already up to date. `uv sync --locked` → exit 0; 17 packages resolved,
    15 checked.
  - `pnpm run doctor` → exit 0; 18 PASS, the expected dirty-tree WARNING,
    0 FAIL, and 3 honest NOT_YET_APPLICABLE future suites. It confirms 14
    project-memory files and 14 required root scripts.
  - The first `pnpm preflight` exposed formatting drift in three newly
    edited Python files and exited 1; no failure was masked. After
    `uv run ruff format scripts/traceability.py
    scripts/tests/test_traceability.py scripts/tests/test_integrity.py`,
    `pnpm preflight` → exit 0: doctor passed and every active aggregate
    suite passed.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, and `pnpm test:rust` → exit 0
    each. TypeScript: 8/8 package tests and 8/8 typecheck tasks; Playwright:
    1/1 pinned-Chromium smoke test; Python: 146/146; Rust: 1/1 plus
    rustfmt, Clippy `-D warnings`, and build.
  - `pnpm verify` → exit 0. Toolchain, format, lint, typecheck, unit-ts,
    e2e-browser, python, rust, traceability, status, and integrity were
    ACTIVE/PASS. Contract generation, contract compatibility, and visual
    remained honestly NOT_YET_APPLICABLE and were not counted as passing.
  - `uv run pytest scripts/tests/test_integrity.py
    scripts/tests/test_proofs_and_real_repo.py
    scripts/tests/test_suite_states.py -q` → exit 0, 36 passed
    (verification-runner/integrity suite).
  - `uv run pytest scripts/tests/test_ci_workflow.py
    scripts/tests/test_doctor.py -q` → exit 0, 47 passed (28 CI-policy +
    19 doctor/preflight).
  - `uv run pytest scripts/tests/test_traceability.py
    scripts/tests/test_validate_status.py -q` → exit 0, 62 passed.
  - `uv run pytest scripts/tests -q` → exit 0, 145 passed.
  - `pnpm traceability:check` → exit 0, exact 135/260 PASS.
    `python3 scripts/validate_status.py` → exit 0,
    `PASS: all checks passed (26 check groups)`.
- M00 package-by-package exit audit:
  - M00-W01 PASS: all 14 canonical memory/gate/traceability files exist,
    carry required structure, and reconstruct current/next work without chat
    history; status validation is fail-closed.
  - M00-W02 PASS: the honest monorepo scaffold remains intact; no desktop,
    extension, ATS, model, or other product implementation was introduced.
    The 8 TypeScript, 1 Python, and 1 Rust scaffold smoke tests pass.
  - M00-W03 PASS: Node 24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
    Rust 1.97.1 plus rustfmt/Clippy, and Playwright 1.62.0 Chromium remain
    pinned/enforced. Doctor wrong-version/component/browser negatives and
    the real Chromium launch pass.
  - M00-W04 PASS: root verification remains status-derived and fail-closed;
    ACTIVE/NOT_YET_APPLICABLE/REQUIRED_MISSING, mandatory-empty,
    mutation/status-neutrality, no-op, bypass, focus/skip, and discovery
    proofs pass in the 36-test runner/integrity subset and aggregate verify.
  - M00-W05 PASS: the canonical specification is still the sole v1.2 copy
    with SHA-256
    `9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901`;
    inventory is exactly 39/260/135; all three gate records exist and remain
    NOT_EVALUATED; preserved historical evidence and readiness negatives
    pass.
  - M00-W06 PASS locally and historically hosted: doctor/preflight pass;
    the 28-test CI suite preserves read-only permissions, macOS/Linux,
    frozen/locked installs, narrow caches/artifacts, generated-contract
    honesty, and the isolated job-scoped runner-temp RUSTUP_HOME regression.
    Final starting-HEAD run 30218521997 passed both matrix jobs.
  - M00-W07 PASS locally: canonical metadata/view are complete, generation
    and check are deterministic, all required fraud/drift negatives pass,
    and valid M00 acceptance derives only M01-W01 as READY.
- Clean-clone content proof: a temporary non-local clone checked out exact
  commit `22e6f0ae826ef551edfaf025fbc523411ef62637`, activated the repository
  pins, installed with `pnpm install --frozen-lockfile` and
  `uv sync --locked`, fetched locked Cargo dependencies, and installed or
  located the pinned Playwright Chromium. `pnpm run doctor`,
  `pnpm preflight`, `pnpm verify`, `pnpm traceability:check`, and
  `python3 scripts/validate_status.py` all exited 0. The clone contained
  exactly one canonical specification, validated exactly 135 requirements
  and 260 work packages, preserved all three gates as NOT_EVALUATED, and
  had empty git porcelain afterward. As required at the pre-hosted content
  boundary, that commit still reconstructed M00-W07 as IN_PROGRESS; the
  temporary clone was then removed.
- Hosted content proof: workflow run 30220428453 at commit
  `22e6f0ae826ef551edfaf025fbc523411ef62637` concluded SUCCESS.
  `doctor + verify (macos-15)` job 89841823180 and
  `doctor + verify (ubuntu-24.04)` job 89841823169 both passed, including
  the canonical doctor, aggregate verification, and no-tracked-change
  assertion.
- Closeout-state regression: the first focused
  `uv run pytest scripts/tests/test_traceability.py
  scripts/tests/test_validate_status.py -q` run after stamping the accepted
  state exited 1 with 61 passed / 1 failed. The negative fixture tried to
  make M01-W01 READY even though that is now the valid canonical baseline;
  no validator failure was masked. The fixture now explicitly revokes
  M00-W07 completion and M00 acceptance before asserting the skipped-
  dependency rejection. Ruff check/format then passed, the focused suite
  passed 62/62, `pnpm verify` exited 0 with all mandatory suites PASS and
  146/146 Python tests, and `python3 scripts/validate_status.py` exited 0
  with 26/26 check groups.
- Acceptance decision: every M00-W01 through M00-W07 package audit and the
  complete M00 exit gate pass at content tree
  `fee2902010eb90704c05e584fb6ff7964327cb0b`. M00-W07 is therefore
  VERIFIED, M00 is ACCEPTED, and only M01-W01 becomes READY. No M01
  implementation began. The final closeout stamp HEAD must pass both hosted
  jobs before handoff; its terminal run is reported at handoff rather than
  creating another evidence-only commit and an unverified successor HEAD.
- Security/privacy impact: metadata contains only specification text,
  repository paths, package IDs, and planned test/evidence categories. It
  contains no executable code, secrets, PII, real applicant data, live-site
  result, or speculative compatibility/benchmark claim. Validation is
  stdlib-only and read-only in check mode.
- Compatibility impact: none. M00 hosted OS results prove repository
  bootstrap/verification only; no desktop or ATS compatibility row is
  populated.

### M00-W06 — Create CI and local preflight (2026-07-26)

#### Current-HEAD macOS hosted-CI repair (2026-07-26)

- Repair revision: tree 9f9adc79cea15cb2f3a855b2b66463467822b5bf /
  commit 124418f3a34389c4c56dced60a9fff9a5947adc4 (stamped in the
  conventional follow-up commit after its hosted content run passed).
- Failed hosted evidence: workflow run 30217235083 at current HEAD
  f9ec7926d3ff04e0cc427481a5c0a965f0578f4e concluded failure. Required
  macOS job `doctor + verify (macos-15)` 89833453976 failed in
  `Install pinned Rust toolchain (rust-toolchain.toml)`; Linux job
  `doctor + verify (ubuntu-24.04)` 89833453996 completed successfully.
  `gh run view 30217235083 --job 89833453976 --log-failed` showed:
  `recovering from a partially installed toolchain`, component removal,
  rollback, and the exact terminal error `failed to install component:
  'clippy-preview-aarch64-apple-darwin', detected conflict:
  'bin/cargo-clippy'`.
- Confirmed root cause: the workflow invoked the trusted hosted-runner
  rustup proxy but inherited the runner image's default `RUSTUP_HOME`.
  That shared state contained a partial/contaminated 1.97.1 toolchain, so
  adding Clippy collided with an existing `bin/cargo-clippy`. The log
  contains no download timeout or transport failure; the successful Linux
  job and passing local suite further isolate the defect to non-hermetic
  macOS runner toolchain state.
- Why retries were rejected: retrying the same deterministic contaminated
  rustup home does not remove the component conflict and would mask the
  missing CI isolation. No unconditional or bounded retry was added. A
  bounded retry remains appropriate only if a later independent log proves
  a transient network failure.
- Correction:
  - The Rust install step receives
    `RUSTUP_HOME: ${{ runner.temp }}/rustup-home` at step scope. GitHub does
    not expose the `runner` context in `jobs.<job_id>.env`, so the step
    verifies the path does not exist, creates it, and writes the exact value
    to the job-local `GITHUB_ENV` before the first rustup command. Every
    later Rust/Cargo step in that matrix job therefore uses the same fresh
    home.
  - rustup installs the repository-derived exact 1.97.1 pin with the
    `minimal` profile plus rustfmt and Clippy. Post-install checks verify the
    active `rust-toolchain.toml` override, rustup's selected cargo/rustc
    binaries, `cargo --version`, `rustc --version`, `rustfmt --version`, and
    `cargo clippy --version`. `cargo +1.97.1` and `rustc +1.97.1` probes
    prove the PATH commands are rustup proxies.
  - `RUSTUP_HOME`, `.rustup`, `runner.temp`, and Cargo proxy/bin state are
    excluded from every cache. The existing Cargo dependency cache remains
    limited to `~/.cargo/registry` and `~/.cargo/git`.
- Static regressions: `scripts/tests/test_ci_workflow.py` now has 27 tests.
  New coverage proves per-matrix fresh runner-temp rustup initialization
  and ordering; no earlier Rust operation; exact Rust 1.97.1/minimal/
  rustfmt/Clippy installation; active-toolchain, proxy, and four version
  probes; toolchain-cache exclusion with a complete cache-path allowlist;
  narrow retained Cargo dependency caches; and no shell failure masking.
  Existing tests continue proving macos-15 + ubuntu-24.04, read-only
  permissions, SHA-pinned official actions, frozen/locked installs,
  canonical doctor + verify execution, and failure-scoped artifacts.
- Test-first evidence: before the workflow correction,
  `uv run pytest scripts/tests/test_ci_workflow.py -q` exited 1 with
  2 failed / 24 passed (missing isolated `RUSTUP_HOME` and missing proxy/
  version checks). After the correction, the focused suite exited 0 with
  27 passed.
- Local environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); Node
  v24.18.0; pnpm 11.17.0; uv 0.11.32; Python 3.12.13; rustc/cargo 1.97.1;
  rustfmt 1.9.0-stable; Clippy 0.1.97; @playwright/test 1.62.0 with pinned
  Chromium.
- Required local validation (repair tree; every command inspected):
  - `pnpm install --frozen-lockfile` → exit 0; all 12 workspace projects
    already up to date.
  - `uv sync --locked` → exit 0; 17 packages resolved / 15 checked.
  - `pnpm run doctor` → exit 0; 18 PASS, 1 expected dirty-tree WARNING,
    0 FAIL, 3 honest NOT_YET_APPLICABLE suites.
  - `pnpm preflight` → exit 0; doctor result above followed by canonical
    `pnpm verify`, exit 0.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:python`, and `pnpm test:rust` → exit 0 each.
  - `pnpm verify` → exit 0; all mandatory active suites PASS;
    contract-gen/contract/visual remain honestly NOT_YET_APPLICABLE and
    are not counted as passing suites.
  - `uv run pytest scripts/tests -q` → exit 0, 108 passed.
  - `python3 scripts/validate_status.py` → exit 0,
    `PASS: all checks passed (25 check groups)`.
- Test counts: CI static validation 27/27; scripts pytest 108/108; full
  pytest (inside `pnpm test:python` / `pnpm verify`) 109/109; TypeScript
  unit packages 8/8; Playwright 1/1; Rust 1/1; validator 25 check groups.
- Hosted repair evidence: GitHub Actions run 30218333122 at repair commit
  124418f3a34389c4c56dced60a9fff9a5947adc4 completed successfully.
  `doctor + verify (macos-15)` job 89836260053 and
  `doctor + verify (ubuntu-24.04)` job 89836260044 both succeeded. The
  macOS Rust-install log confirms `RUSTUP_HOME:
  /Users/runner/work/_temp/rustup-home`; an exact fresh
  `1.97.1-aarch64-apple-darwin` installation; repository override via
  `rust-toolchain.toml`; PATH proxies at `/Users/runner/.cargo/bin/cargo`
  and `/Users/runner/.cargo/bin/rustc`; toolchain binaries under the
  isolated home; cargo 1.97.1, rustc 1.97.1, rustfmt 1.9.0-stable, and
  Clippy 0.1.97; doctor PASS; validator PASS (25 check groups); canonical
  verification exit 0; and no tracked changes.
- Stamp-HEAD revalidation: the conventional follow-up stamp commit must
  pass both hosted jobs before M00-W07 starts. Its terminal run is reported
  at handoff rather than creating another evidence-only commit and another
  unverified HEAD.
- Artifacts: none locally; no product UI/browser behavior changed.
- Security/privacy impact: no secrets, permissions, live-site behavior, or
  data paths changed. The token remains read-only and all actions remain
  official and SHA-pinned.

- Revision: tree 135a4c1ffa7cdd43dd2be11baea4ee01721055b9 / commit
  16072e528e45379fe7d7c4f7df75a3fcba7ed67d (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); pinned toolchain
  active (Node v24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
  rustc/cargo 1.97.1, @playwright/test 1.62.0 pinned Chromium). New dev
  dependencies: pyyaml==6.0.3 + types-pyyaml==6.0.12.20260724 (exact pins,
  used only by the CI static-validation tests; uv.lock updated).
- What this package added:
  - `scripts/doctor.py` — stdlib-only, strict-gated environment doctor
    (read-only; PASS/WARNING/FAIL/NOT_YET_APPLICABLE; per-failure
    remediation; deterministic `--json`; `--preflight` runs the doctor then
    the canonical `pnpm verify`). Root scripts `doctor` and `preflight`
    added to package.json and to verify.py's CANONICAL_ROOT_SCRIPTS (their
    absence now fails pnpm verify).
  - `.github/workflows/ci.yml` — single `verify` job on a macos-15 +
    ubuntu-24.04 matrix; `permissions: contents: read`;
    `persist-credentials: false`; concurrency cancel for superseded
    non-main runs; official actions only, all pinned to immutable commit
    SHAs resolved live from tags (checkout v7.0.1 3d3c42e5…, setup-node
    v7.0.0 82076278…, cache v6.1.0 55cc8345…, upload-artifact v7.0.1
    043fb46d…); toolchain activated from the repository pin files; installs
    frozen/locked (pnpm --frozen-lockfile, uv sync --locked, cargo fetch
    --locked); caches keyed on runner.os + runner.arch + hashFiles of the
    pin/lockfiles with no restore-keys; CI then runs exactly `pnpm run doctor`
    and `pnpm verify` (`run` is required — pnpm's unrelated built-in
    `doctor` command shadows the bare script form; caught by the
    clean-clone simulation and fixed before push) (no CI-only subset), asserts a clean porcelain, and
    uploads only failure-scoped Playwright artifacts from test-results/
    (7-day retention).
  - `contract-gen` registry suite (owner M01-W02) — generated-contract
    drift lifecycle: NOT_YET_APPLICABLE today, REQUIRED_MISSING the moment
    M01-W02 begins without a real generator at scripts/generate-contracts.*;
    documented as distinct from the M01-W05 `contract` compatibility suite.
    Registry now has 13 suites.
  - M00-W05 audit-finding fix (KI-0004): validate_status.py ledger
    validation now requires, for every required gate, exactly one
    `## <GATE>` section in docs/CRITICAL_GATES.md containing exactly one
    valid `- State:` line agreeing with the PROJECT_STATUS gates table;
    missing sections, missing/duplicate state lines, invalid values, and
    unknown gate-like sections are rejected.
  - Tests: scripts/tests/test_doctor.py (20 tests — injected-runner
    negatives for wrong Node/pnpm/uv/Python/cargo/rustup-proxy/rustfmt/
    clippy/browser, fixture-repo negatives for missing memory file/gate
    report/invalid status, JSON validity + run-to-run stability, remediation
    rendering, tracked-file neutrality, preflight failure propagation in
    both directions), scripts/tests/test_ci_workflow.py (19 static workflow
    tests — duplicate-key-rejecting parse, read-only permissions, SHA-pinned
    official actions with version annotations, macOS+Linux matrix, frozen
    installs, doctor+verify-only invocation allowlist, failure-scoped
    artifact policy vs playwright.config.ts, cache-key identity,
    no continue-on-error, no http(s) in run steps, contract-gen
    ownership/lifecycle), and 5 new ledger regression tests in
    test_validate_status.py. conftest GOOD_SCRIPTS extended with
    doctor/preflight.
- Commands and observed results (pinned PATH; all run in the current tree):
  - `pnpm install --frozen-lockfile` → exit 0. `uv sync --locked` → exit 0.
  - `pnpm run doctor` → exit 0 — 18 PASS, 1 WARNING (dirty tree,
    mid-package), 0 FAIL, 3 NOT_YET_APPLICABLE (contract-gen M01-W02,
    contract M01-W05, visual M10-W06). `pnpm run doctor --json` → exit 0,
    parsed, byte-stable across consecutive runs (asserted in tests as
    well).
  - `pnpm preflight` → exit 0 — doctor summary above, then the canonical
    aggregate: `verification exit code: 0` with 13 registry suites
    (toolchain, format, lint, typecheck, unit-ts PASS; contract-gen +
    contract + visual NOT_YET_APPLICABLE with owner labels; e2e-browser,
    python, rust, status, integrity PASS).
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, `pnpm test:rust` → exit 0 each.
  - `uv run pytest scripts/tests -q` → 101 passed (35 M00-W04 runner + 27
    validator incl. 5 new ledger cases + 20 doctor + 19 CI-workflow);
    full `pnpm test:python` pytest count 102 (includes the orchestrator
    smoke test).
  - `python3 scripts/validate_status.py` → exit 0, PASS (25 check groups),
    re-run after every status edit.
  - `pnpm verify` from the final content tree → recorded below in this
    entry's closeout note (run after the last documentation edits).
  - Clean-clone simulation → recorded below (temporary file:// clone of the
    content commit; install → doctor → verify; clone removed afterwards).
- Negative-path results (all fail-closed, automated): wrong Node
  (v26.0.0), wrong pnpm, missing uv, wrong Python patch (3.12.14), missing
  cargo, cargo resolving outside the pinned rustup toolchain, missing
  rustfmt, missing Clippy, missing Chromium executable → doctor FAIL with
  actionable remediation; missing canonical memory file, missing Workday
  gate report, corrupt PROJECT_STATUS → doctor FAIL; preflight with a
  failing doctor never starts verification (marker-file proof) and
  propagates a failing verify child's exit code (3); ledger negatives:
  missing `- State:` line, duplicate state lines, missing `## GATE`
  section (with names still present elsewhere), unknown gate-like section,
  invalid state value → validator exit 1 each; contract-gen with M01-W02
  IN_PROGRESS and no generator → REQUIRED_MISSING (derive_state).
- Hosted CI evidence (observed live via gh before VERIFIED was recorded):
  workflow `ci` run 30217098337 on the verified content commit
  16072e528e45379fe7d7c4f7df75a3fcba7ed67d → conclusion success —
  https://github.com/kalwad/jobapplyv2/actions/runs/30217098337 — with both
  matrix jobs completed successfully: "doctor + verify (macos-15)" (job
  89833100002) and "doctor + verify (ubuntu-24.04)" (job 89833100004).
  Every step green on both OSes (checkout, pinned Node/pnpm/uv/Rust
  activation, four caches, frozen installs, Chromium install, doctor,
  canonical verification, no-tracked-changes assertion); the failure-only
  artifact-upload step was skipped, as designed, because nothing failed.
  The clean-clone simulation additionally caught pre-push that bare
  `pnpm doctor` invokes pnpm's unrelated built-in doctor command — the
  canonical invocation is `pnpm run doctor` everywhere (workflow, README,
  static tests assert the bare form is absent).
- Test counts: pytest 101/101 (scripts) and 102/102 (full); TS unit 8/8
  package tasks; Playwright 1/1; Rust 1/1; validator PASS 25 groups.
- Artifacts: none persisted locally (Playwright artifacts remain
  failure-only and git-ignored).
- Notes: the doctor duplicates no verification logic — file/scripts
  checks reuse verify.py and validate_status.py constants, suite states
  come from verify.load_registry/derive_state, and preflight invokes the
  canonical `pnpm verify` command itself. KI-0002 remains FIXED; KI-0004
  records the audit finding fixed here.

### M00-W05 — Adopt and migrate the v1.2 Workday-first critical-risk rebaseline (2026-07-26)

- Revision: tree 0c6fe779cc56755983d39951cabcdf201867bae2 / commit
  c2c834ef44892b70706e0ee1985d1fda1fb8f4da (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); pinned toolchain
  active (Node v24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
  rustc/cargo 1.97.1, @playwright/test 1.62.0 with pinned Chromium) —
  unchanged from M00-W04.
- What this package did: owner-approved adoption of JAPP-MASTER-001 v1.2 as
  the canonical specification (ADR-0001, ACCEPTED; owner-decision registry
  extended to OD-020). The canonical file was replaced atomically via a
  single rename of the owner-supplied proposed copy
  (`mv docs/MASTER_IMPLEMENTATION_SPEC.v1.2.proposed.md
  docs/MASTER_IMPLEMENTATION_SPEC.md`), which also removed the proposed
  copy; exactly one canonical specification remains. New project memory:
  docs/CRITICAL_GATES.md (three-gate ledger with §2.3 metric tables) and
  docs/gates/ (three gate report templates + HOLDOUT_EXECUTION_LOG.md).
  docs/PROJECT_STATUS.md regenerated in the §12 v1.2 shape (critical-gates
  table; 39 milestones M00–M38; 260 work packages) via a one-off generator
  that used the permanent validator's own spec parser. CLAUDE.md,
  KNOWN_ISSUES (KI-0001 refs updated, KI-0002 FIXED), COMPATIBILITY_MATRIX
  (Workday-first + tenant-pattern table), REQUIREMENTS_TRACEABILITY (135
  requirements, seeding moved to M00-W07, final audit M38-W01), README, and
  stale v1.0 milestone references in workspace-slot files migrated.
  scripts/validate_status.py rewritten for v1.2 (exact 39/260/135 inventory
  enforcement, critical-gates table + ledger agreement, gate-based readiness
  blocking, ACCEPTED-milestone prerequisites, verified-evidence
  preservation, single-canonical-spec rule) and brought under the strict
  Ruff/mypy/pytest gates; new automated suite
  scripts/tests/test_validate_status.py (22 tests). verify.py MEMORY_FILES
  gained docs/CRITICAL_GATES.md; registry/format/typecheck/python command
  paths gained scripts/validate_status.py.
- Hashes: replaced canonical v1.0 sha256
  2ddbda1db42cb4a4efdb61415ee1f348811f088f3d70b0a5570f6b4e0570dac8
  (byte-identical to the owner's original upload recorded in § M00-W01);
  adopted canonical v1.2 sha256
  9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901
  (byte-identical to the owner-supplied proposed file, verified before and
  after the rename).
- Commands and observed results (pinned PATH):
  - Pre-migration baseline: `pnpm verify` → exit 0 (all mandatory suites
    PASS; contract/visual NOT_YET_APPLICABLE) — live confirmation that
    M00-W01…W04 verification held before any edit.
  - Mechanical inventory extraction (one-off script, same regex conventions
    as the validator) on the proposed file → 39 milestones, 260 unique work
    packages, 135 unique requirements; v1.0 canonical → 38/227/74 (matches
    § M00-W01). Re-run against the adopted canonical after the rename →
    identical 39/260/135 (families: PROF 7, RES 18, JOB 7, ANS 10, FORM 26,
    WD 23, TRACK 6, DISC 4, AUTO 8, PLAT 10, GATE 16).
  - `python3 scripts/validate_status.py` (migrated tree) → exit 0,
    `PASS: all checks passed (25 check groups)` — includes spec-inventory
    counts, §12 gate-rule derivability, critical-gates table/ledger
    agreement, gate report presence, dependency + ACCEPTED + gate readiness
    rules, evidence preservation, and single-canonical-spec scan.
  - `uv run pytest scripts/tests -q` → 57 passed (35 M00-W04 runner tests +
    22 new validator tests). Validator negative matrix automated: invalid
    package enum (M03-W02 → DONE), skipped dependency (M01-W01 READY),
    two IN_PROGRESS, missing package row (M38-W07), stale/missing Workday
    packages (M19/M20 rows removed → 22 missing reported), missing Workday
    requirement (REQ-WD-023 deleted → "expected 135"), missing milestone
    section (M38 truncated → "expected 39"), second canonical spec
    (proposed-path copy), renamed canonical lookalike (header marker),
    invalid gate state ("GREEN"), missing WORKDAY_GUIDED_PRE_SUBMIT row,
    missing Workday gate report file, missing CRITICAL_GATES.md ledger,
    gate PASS without evidence fields, status/ledger gate-state mismatch,
    M03 blocked without AUTOFILL_FEASIBILITY (with dependency noise proven
    absent), M06 blocked without RESUME_PAGEFIT_FEASIBILITY, M21 blocked
    without WORKDAY_GUIDED_PRE_SUBMIT + M19/M20 ACCEPTED, dropped preserved
    revision (M00-W03), missing evidence heading (M00-W02); positive: full
    migrated repo passes, and AUTOFILL_FEASIBILITY = PASS with complete
    evidence fields unblocks M03-W01 (exit 0).
  - Live negative demonstration (in addition to the automated suite): the
    committed v1.0-shaped status (`git show HEAD:docs/PROJECT_STATUS.md`)
    against the new validator via `--status` → exit 1: missing critical
    gates (incl. WORKDAY_GUIDED_PRE_SUBMIT), `milestone table missing:
    ['M38']`, `work-package table missing 41 package(s)`, and 8 v1.0-only
    IDs (M22-W06, M23-W06/07, M30-W05, M31-W06/07, M34-W07, M37-W07)
    rejected as unknown — the stale-inventory rejection required by §13.8.
  - Post-migration aggregate: `pnpm verify` → exit 0 — toolchain, format,
    lint, typecheck, unit-ts, e2e-browser, python (ruff + strict mypy over
    services + verify.py + validate_status.py + tests; pytest 57), rust,
    status (new validator), integrity (incl. docs/CRITICAL_GATES.md) all
    PASS; contract/visual NOT_YET_APPLICABLE (owners M01-W05/M10-W06 keep
    identical IDs and meaning under v1.2); status-neutral. Re-run from the
    final closeout tree after the status edits below → exit 0.
  - `uv run ruff check` / `uv run ruff format --check` / `uv run mypy` over
    services + scripts/verify.py + scripts/validate_status.py +
    scripts/tests → exit 0 each (validator now inside the strict gates —
    KI-0002 FIXED).
- Test counts: pytest 57/57 (runner 35, validator 22); TS unit 8/8 package
  tasks (forced, inside verify); Playwright 1/1; Rust 1/1; validator PASS
  25 check groups; all lint/format/type commands exit 0.
- Artifacts: none persisted (documents/validator migration; no UI/browser
  surface — Playwright artifacts remain failure-only and git-ignored).
- Manual validation: complete `git status`/`git diff --stat` review of the
  change set (16 modified + 3 added paths, no unintended files); canonical
  byte-identity verified by sha256 before/after the rename; preserved
  M00-W01…W04 revisions re-grepped verbatim from the migrated table;
  tracked-file sweep for stale v1.0 milestone references (workspace-slot
  READMEs/package descriptions, pyproject comment) updated to v1.2
  numbering; owner's gitignored root upload left untouched and ignored.
- Notes:
  - The `stamp pending` marker in the W05 status row and this revision line
    is the validator-accepted placeholder between the content commit and the
    stamp commit; the stamp commit replaces both with the content commit's
    tree/commit hashes.
  - Historical entries below this one describe v1.0-era package IDs and
    section numbers as they were at the time; they are records, not current
    references, and are intentionally not rewritten.

### M00-W04 — Create root verification commands (2026-07-26)

- Revision: tree 6c798abfd76824fd43c09c72615a3a976406f081 / commit
  5181538ba8d76fc8b75155dd2e8514797a13647b (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); pinned toolchain
  active and re-verified live — Node v24.18.0 (keg + .nvmrc), pnpm 11.17.0
  (Corepack shim, packageManager), uv 0.11.32 (required-version), Python
  3.12.13 (uv-managed, .python-version), rustc/cargo 1.97.1 with rustfmt
  1.9.0 + clippy 0.1.97 (rust-toolchain.toml override), @playwright/test
  1.62.0 with pinned Chromium (headless shell 151.0.7922.34).
- What this package added: `scripts/verify.py` (stdlib-only, strict-mypy
  fail-closed runner), `scripts/verification-suites.json` (canonical
  machine-readable suite-state registry, 12 suites), `scripts/tests/`
  (conftest + 3 files, 35 runner tests), the ten canonical root commands in
  package.json, turbo.json `globalDependencies: ["tsconfig.base.json"]`
  (cache-soundness fix), pytest/mypy/ruff coverage extensions in
  pyproject.toml, README verification docs, KI-0002/KI-0003 parked notes.
- Suite states in the aggregate (`pnpm verify`, final run from the closeout
  tree): toolchain PASS, format PASS, lint PASS, typecheck PASS, unit-ts
  PASS, contract NOT_YET_APPLICABLE (owner M01-W05 — printed as "not a
  passing suite", exit contribution none), e2e-browser PASS, visual
  NOT_YET_APPLICABLE (owner M10-W06), python PASS, rust PASS, status PASS,
  integrity PASS → `verification exit code: 0`.
- Commands and observed results (positive matrix, pinned PATH):
  - `pnpm install --frozen-lockfile` → exit 0.
  - `pnpm lint` → exit 0. `pnpm format:check` → exit 0 (prettier + ruff
    format + cargo fmt, check-only). `pnpm typecheck` → exit 0 (turbo 8/8
    typecheck tasks + root tsc + strict mypy; turbo_task_count proof).
  - `pnpm test` → exit 0 — `turbo run test --force` (cache-bypassed, fresh):
    Tasks 8 successful/8 total, per-package Vitest proof = 8× "Tests 1
    passed" (vitest_per_package).
  - `pnpm test:contract` → exit 0, NOT_YET_APPLICABLE banner (not a pass).
  - `pnpm test:e2e` → exit 0; Playwright run "1 passed" + discovery proof
    `--list` = "Total: 1 test in 1 file".
  - `pnpm test:visual` → exit 0, NOT_YET_APPLICABLE banner (not a pass).
  - `pnpm test:python` → exit 0 (ruff check; ruff format --check; strict
    mypy "no issues found in 7 source files"; pytest 36 passed = 1
    orchestrator + 35 runner tests; pytest_min_passed proof).
  - `pnpm test:rust` → exit 0 (cargo fmt --check; clippy --all-targets
    --all-features -D warnings; cargo test "1 passed"; cargo build —
    explicit --manifest-path throughout; cargo_min_passed proof).
  - `pnpm verify` → exit 0 with the per-suite summary above; run twice
    (post-implementation and again from the final closeout tree after the
    status edits below); status-neutral (porcelain + tracked-content
    sha256 identical before/after).
  - `python3 scripts/validate_status.py` → exit 0, PASS (17 check groups),
    re-run after the final status edits.
  - Runner test suite: `uv run pytest scripts/tests -q` → 35 passed
    (fresh; also re-run inside pnpm test:python and pnpm verify).
- Freshness/cache notes: unit tests always run `--force` (canonical
  registry command) — forced executions produced the counted "Tests N
  passed" lines; typecheck relies on sound turbo caching, made sound by
  hashing tsconfig.base.json via globalDependencies — proof: warm run
  "Cached: 8 cached, 8 total" → byte change to tsconfig.base.json →
  "Cached: 0 cached, 8 total" → file restored byte-identical (empty diff).
  Playwright, pytest, and cargo executions have no cache layer in verify.
- Negative-path results (all fail-closed, automated in scripts/tests unless
  marked live):
  - Failing child command → aggregate exit 1 (test_failing_child_command…).
  - Activated-but-empty contract and visual suites → REQUIRED_MISSING, exit
    1 (fixture-status tests against the real registry; also live 4c in the
    final review: `--suite visual --status <M10-W06=IN_PROGRESS copy>` →
    exit 1 "REQUIRED and missing").
  - REQUIRED_MISSING is unconditional — fails even for mandatory:false
    suites (test_required_missing_fails_even_for_non_mandatory_suite);
    non-mandatory ACTIVE failure alone does not fail the aggregate
    (documented mandatory semantics).
  - Empty selections: pytest exit 5 → hard failure with explicit "zero
    tests" message ("pytest" anywhere in argv); vitest empty selection →
    exit 1 (live: `vitest run nonexistent_pattern`); Playwright empty
    selection → exit 1 "No tests found" (live: `--grep no_such_test…`);
    vitest_min_tests / playwright_list_min proofs reject zero-test output.
  - NOT_YET_APPLICABLE honesty: summary prints NOT_YET_APPLICABLE (never
    PASS) + "not a passing suite — owned by <package>" (asserted in tests).
  - BLOCKED activation package counts as begun → REQUIRED_MISSING (test).
  - Unrecognized state token (e.g. "IN_PROGESS") → RegistryError, exit 2,
    fail closed (test); unknown activation package → fail closed (test).
  - No-op scripts rejected: "", "true", ":", "exit 0", "echo …",
    "true && true", "exit 0 # done", "true; :" — root and workspace
    package scripts both vetted (tests); missing canonical root script
    rejected (test).
  - passWithNoTests-style bypass tokens in tracked configs rejected (test).
  - Focused/skipped tests rejected: scan covers on-disk .test.ts/.spec.ts
    and python test files + conftests regardless of git-tracking, matching
    .only/.skip/.fixme/.todo incl. `it.only.each(` (tests); live: a
    test.only spec under e2e/ → playwright forbidOnly error, exit 1.
  - Verification-caused mutation detected: porcelain + `git diff` sha256
    snapshot mismatch → status-neutral FAIL, exit 1 (test with a command
    that appends to a tracked fixture file).
  - Status-validator failure propagates: corrupt status copy (M03-W02 →
    "DONE") through the real validate_status.py → suite FAIL → exit 1
    (test).
  - Anchored summary parsing: echoed titles like "shows 5 passed items"
    or "test_5_passed_items PASSED" no longer satisfy playwright/pytest
    passed-proofs; skipped-only Playwright output fails (tests).
  - Toolchain mismatch (live): `pnpm install --frozen-lockfile` under
    default Node 26 → ERR_PNPM_UNSUPPORTED_ENGINE, exit 1. Mismatched uv
    (`required-version ==999.0.0` scratch project) → error, exit 2
    (M00-W03 evidence; mechanism unchanged).
- Test counts: runner suite 35/35 passed; full pytest 36/36; TS unit 8/8
  package tasks each 1/1 test (forced); Playwright 1/1 (discovery Total: 1
  test); Rust 1/1; all lint/format/type commands exit 0.
- Dynamic review (Ultra Code, workflow `review-m00-w04-verification-system`,
  8 owner-mandated domains + adversarial per-finding verification; the
  verification phase was cut short by a session usage limit after 22 of 33
  agents):
  - 8 findings adversarially CONFIRMED and all fixed in this tree:
    (1) REQUIRED_MISSING was mandatory-gated vs its documented
    unconditional contract → exit gate fixed + tests; (2–4, one underlying
    defect reported by three domains) registry e2e explanation misstated
    --list ordering → wording corrected; (5) unanchored Playwright
    "(\d+) passed" regex → anchored + tests; (6) BLOCKED excluded from
    STARTED_STATES → included + test; (7) invalid state tokens failed open
    → RegistryError + test; (8) Rust pin checked only via rustup →
    added cargo --version interrogation.
  - 6 findings adversarially REJECTED with recorded reasons (kept as-is):
    unhandled-OSError tracebacks (still exit nonzero = fail-closed),
    vitest_per_package vacuous-pass when zero packages declare the script
    (nevertheless hardened defensively), cargo --locked absence (spec §8.5
    verbatim commands; no deps exist), forbidOnly substring check
    (comment-spoof is self-sabotage, runtime forbidOnly still enforces),
    registry-file bypass-token exemption (forced by legitimate prose; now
    KI-0003a), e2e⊃visual glob overlap (not reachable until M10-W06; the
    overlap is deliberate until then).
  - 11 findings were NEVER adversarially verified (agents hit the session
    limit); treated as open questions and triaged individually, not
    dismissed: FIXED — turbo typecheck cache blindness to
    tsconfig.base.json (globalDependencies + live invalidation proof),
    _script_is_noop compound/comment misses (hardened + tests), workspace
    scripts escaping no-op vetting (extended + test), pytest exit-5 argv
    shape (argv membership + test), python skip-marker end-to-end coverage
    (test added), untracked-test-file scan gap + conftest coverage (scan
    now disk-based incl. conftests, test added), porcelain content blind
    spot for already-dirty files (git-diff sha256 added to snapshot),
    focused-alias gap `.only.each`/`.todo` (regex widened + tests),
    contract command not runnable from root (switched to
    `pnpm --filter @japp/contracts exec vitest run test/contract`).
    DISPOSITIONED WITHOUT CODE CHANGE — "fresh execution" proof cannot
    detect a hypothetical cache replay if --force were removed (the forced
    command is itself tracked registry content; documented), Playwright
    empty-selection/toolchain negatives "lack evidence" (this entry records
    the live runs), status-neutrality untracked-content blind spot
    (documented docstring tradeoff).
  - Final independent single-agent compliance review (read-only) verdict:
    SHIP, zero blocking defects; observations recorded (35-not-36 runner
    test count corrected here; turbo.json added to changed-file list;
    residual hardening backlog parked as KI-0003).
- Artifacts: intentionally none persisted — Playwright artifacts are
  failure-only and git-ignored (test-results/ etc.); all negative
  demonstrations used temp files/copies that were removed or /tmp paths.
- Notes:
  - `pnpm verify` semantics: exits 0 only when every mandatory ACTIVE suite
    passes, every proof holds, integrity is clean, the run is
    status-neutral, and every NOT_YET_APPLICABLE classification is valid
    against docs/PROJECT_STATUS.md; REQUIRED_MISSING is unconditionally
    fatal. Clean-tree semantics: verify must not change porcelain or
    tracked content (pre-commit dirty trees are allowed and compared as
    snapshots; the final committed repository is clean).
  - Command ownership: pnpm lint = ESLint only; Ruff lint lives in
    test:python, Clippy in test:rust; all three run inside pnpm verify.
  - scripts/verify-work-package.* / verify-milestone.* from spec §5.1 were
    deliberately NOT stubbed (they would be no-ops today); `pnpm verify`
    is the aggregate command M00 requires, and later packages add the
    package/milestone wrappers when they have real content.

### M00-W03 — Establish strict toolchain configuration (2026-07-26)

- Revision: tree 323df745c419d8cc7809e88f10bbeca018fdfbb2 / commit
  aa6b3503405651f915d21027524b112bce11f2a2 (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon). Toolchain pinned
  by this package and verified live:
  - Node v24.18.0 (`brew install node@24`, keg-only; pinned via .nvmrc +
    `engines.node` + `engineStrict: true`), replacing use of the machine's
    Node 26 Current per owner instruction. Compatibility under Node 24 was
    verified (all TS commands below); no incompatibility found, so the
    Node-24-unusable escape clause was not needed.
  - pnpm 11.17.0 served by Corepack 0.35.0 (`corepack enable pnpm`; shim at
    /opt/homebrew/opt/node@24/bin/pnpm reads the `packageManager` field).
  - Python 3.12.13 exact (uv-managed; `.python-version`), uv 0.11.32
    enforced by `[tool.uv] required-version = "==0.11.32"`.
  - Rust 1.97.1 + rustfmt 1.9.0-stable + clippy 0.1.97 via
    rust-toolchain.toml (rustup 1.29.0_2).
  - @playwright/test 1.62.0 with pinned Chrome Headless Shell
    151.0.7922.34 (playwright chromium-headless-shell v1234).
  - @types/node 24.13.3 (aligned to Node 24, replacing 26.1.1);
    TypeScript 6.0.3, Vitest 4.1.10, ESLint 10.8.0, typescript-eslint
    8.65.0, Prettier 3.9.6, turbo 2.10.7; mypy 2.3.0, pytest 9.1.1,
    ruff 0.16.0.
- Commands and observed results (positive path, run under
  PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/opt/rustup/bin:$PATH):
  - `node -v` → v24.18.0; `pnpm -v` → 11.17.0 (Corepack shim);
    `uv --version` → 0.11.32; `uv run python -VV` → Python 3.12.13;
    `cargo --version` → 1.97.1; `rustc --version` → 1.97.1;
    `cargo fmt --version` → rustfmt 1.9.0-stable; `cargo clippy --version`
    → clippy 0.1.97; `pnpm exec playwright --version` → Version 1.62.0.
  - `pnpm install --frozen-lockfile` → exit 0 under Node 24.
  - `pnpm lint` → exit 0 (typed strictTypeChecked + stylisticTypeChecked
    over every TS file via projectService; unused disable directives are
    errors).
  - `pnpm format:check` → exit 0 (canonical docs still excluded from
    formatting by .prettierignore).
  - `pnpm typecheck` → exit 0; turbo 8/8 package projects plus the root
    e2e/config project (`tsc -p tsconfig.json`), all with
    `skipLibCheck: false`, `noImplicitReturns`, `useUnknownInCatchVariables`
    added to the W02 strict baseline.
  - `pnpm exec turbo run test --force` → exit 0; Tasks: 8 successful, 8
    total (fresh, cache bypassed; one Vitest smoke test per package).
  - `pnpm exec playwright test --list` → exactly 1 test discovered:
    e2e/browser-smoke.spec.ts "pinned Chromium launches, renders controlled
    content, and executes JavaScript".
  - `pnpm test:browser-smoke` → exit 0; 1 passed (~0.6–3.4 s); the test
    renders inline `page.setContent` markup only (no network, no product
    claims) and records the Chromium version as a test annotation.
  - `uv sync --locked` → exit 0; `uv run python -c "import sys;
    print(sys.base_prefix)"` →
    ~/.local/share/uv/python/cpython-3.12.13-macos-aarch64-none (uv-managed
    interpreter, not system Python; project venv .venv/bin/python3).
  - `uv run pytest` → exit 0; 1 passed under the new strict options
    (`--strict-markers --strict-config -ra`, `xfail_strict`,
    `filterwarnings = ["error"]`).
  - `uv run ruff check services` → exit 0 under the curated strict baseline
    (24 rule families; ISC001 disabled for formatter compatibility; S101
    allowed only under tests/ — both documented in pyproject.toml).
  - `uv run ruff format --check services` → exit 0 (6 files).
  - `uv run mypy services` → exit 0 (strict = true plus warn_unreachable
    and ignore-without-code / redundant-expr / possibly-undefined codes).
  - `cargo fmt --manifest-path services/native-host/Cargo.toml --check` →
    exit 0; `cargo clippy --manifest-path ... --all-targets --all-features
    -- -D warnings` → exit 0; `cargo test --manifest-path ...` → exit 0;
    1 passed. Native-host refusal behavior unchanged from W02.
  - `python3 scripts/validate_status.py` → exit 0, PASS (17 check groups).
- Negative and enforcement checks:
  - Node pin enforced: with the machine default Node v26.0.0 active,
    `pnpm install --frozen-lockfile` → exit 1,
    `ERR_PNPM_UNSUPPORTED_ENGINE … Expected version: 24.18.0, Got: v26.0.0`
    (`engineStrict: true` in pnpm-workspace.yaml; the legacy `.npmrc
    engine-strict` flag is NOT read by pnpm 11 — verified `pnpm config get
    engine-strict` → undefined — which is why .npmrc was removed and both
    settings live in pnpm-workspace.yaml).
  - uv pin enforced: a scratch project with `required-version = "==999.0.0"`
    → `uv lock` exit 2, "Required uv version `==999.0.0` does not match the
    running version `0.11.32`".
  - Rust pin resolved: inside the repo `rustup show active-toolchain` →
    `1.97.1-aarch64-apple-darwin (overridden by '…/rust-toolchain.toml')`;
    outside the repo → `stable-aarch64-apple-darwin (default)`.
  - Playwright discovery: `--list` shows exactly the one intended test;
    `playwright test --grep does_not_exist` → exit 1, "Error: No tests
    found" (an empty browser suite cannot pass).
  - Vitest empty suite fails: `vitest run nonexistent_pattern` in a package
    → exit 1 ("No test files found").
  - pytest empty selection fails: `uv run pytest -k nomatch_xyz` → exit 5
    (1 deselected, no tests ran).
- Test counts: TypeScript 8/8 package smoke tests; Playwright 1/1 browser
  infrastructure test; Python 1/1; Rust 1/1; all lint/format/type/version
  checks exit 0; 6/6 negative-enforcement checks behaved as required.
- Artifacts: none retained (Playwright trace/screenshot/video are
  failure-only by config and the run passed; artifact dirs are
  git-ignored).
- Notes:
  - Environment changes performed on this Mac during the package:
    `brew install node@24` (24.18.0, keg-only), `corepack enable pnpm`
    (shims inside the node@24 keg), `rustup toolchain install 1.97.1`
    (with rustfmt/clippy, in ~/.rustup), Playwright Chromium headless-shell
    151.0.7922.34 download (~/Library/Caches/ms-playwright). No shell rc
    files were modified; activation is documented in README.md.
  - KI-0001 (no JS/TS build task) intentionally remains DEFERRED: this
    package adds no real build target, so adding a `build` task would still
    be a mocked success (owner instruction honored).
  - The Playwright smoke test is infrastructure-only by design; product
    e2e/visual suites and their aggregation (`test:e2e`, `test:visual`,
    `pnpm verify`) remain M00-W04+ scope.

### M00-W02 — Scaffold the monorepo (2026-07-26)

- Revision: tree 15cc0edec64e4b4f986e7c1ee210d88a1e448140 / commit
  b64f54da8ec3c302bd28efac68afd80ea5efc142 (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon — the spec's target
  machine class); Node v26.0.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13
  (uv-managed via `.python-version`), rustc/cargo 1.97.1 with rustfmt 1.9.0
  and clippy 0.1.97 (rustup stable — the Rust toolchain was absent on this
  machine and was installed during this package via Homebrew `rustup`
  1.29.0_2; recorded as an environment change). Pinned tool versions:
  TypeScript 6.0.3, Vitest 4.1.10, @types/node 26.1.1 (pnpm catalog, exact),
  ESLint 10.8.0, typescript-eslint 8.65.0, Prettier 3.9.6, turbo 2.10.7
  (exact, `save-exact`); pytest 9.1.1, ruff 0.16.0, mypy 2.3.0 (`==` pins);
  lockfiles committed: pnpm-lock.yaml, uv.lock, services/native-host/Cargo.lock.
- Commands and observed results:
  - `pnpm install` → exit 0; `pnpm install --frozen-lockfile` → exit 0
    ("Already up to date").
  - `uv sync` → exit 0 (installs orchestrator editable); `uv sync --locked`
    → exit 0.
  - `pnpm lint` (`eslint .`) → exit 0.
  - `pnpm exec turbo run typecheck --force` → exit 0; Tasks: 8 successful,
    8 total (strict `tsc --noEmit` in every packages/* package).
  - `pnpm exec turbo run test --force` → exit 0; Tasks: 8 successful, 8
    total (one Vitest workspace-wiring smoke test per packages/* package).
  - `pnpm format:check` → exit 0 (canonical docs/CLAUDE.md are excluded via
    .prettierignore so tooling can never rewrite the contract).
  - `uv run pytest` → exit 0; 1 passed (orchestrator package/distribution
    wiring smoke test).
  - `uv run ruff check services` → exit 0 ("All checks passed!").
  - `uv run ruff format --check services` → exit 0 (6 files already
    formatted).
  - `uv run mypy services` (strict = true) → exit 0; no issues in 2 source
    files.
  - `cargo fmt --check` (services/native-host) → exit 0.
  - `cargo clippy --all-targets --all-features -- -D warnings` → exit 0.
  - `cargo test` → exit 0; 1 passed, 0 failed.
  - `./target/debug/native-host` → exit 1 with the explicit notice
    "not implemented until work package M17-W04; refusing to run" (honest
    refusal — no fake transport).
  - `pnpm exec turbo run build` → exit 1, "Could not find task `build` in
    project" — deliberate deferral, recorded as KI-0001 in
    docs/KNOWN_ISSUES.md (a build task over zero implementers would be a
    mocked success state).
  - `python3 scripts/validate_status.py` → exit 0, PASS (17 check groups),
    run after the final status update for this package.
- Test counts: TypeScript 8/8 package smoke tests passed; Python 1/1
  passed; Rust 1/1 passed; every lint/format/typecheck command exit 0.
- Artifacts: none (scaffold only; no UI exists yet, so §1.3.6 manual UI
  inspection is not applicable).
- Notes:
  - TypeScript is pinned to 6.0.3, not the newest 7.0.2, because
    typescript-eslint 8.65.0 declares support for typescript
    ">=4.8.4 <6.1.0"; recorded so M00-W03 revisits the pin deliberately.
  - `tsconfig.base.json` sets `"types": ["node"]` explicitly — TypeScript
    6.x no longer auto-includes `@types/node` under this configuration.
  - The root `package.json` `packageManager: pnpm@11.17.0` field is
    structurally required by turbo (it refuses to resolve the workspace
    without it); `.python-version` (3.12) enforces the spec §5.2 interpreter
    on a machine whose default python3 is 3.14.
  - apps/desktop, apps/extension, apps/mock-ats-lab and
    services/job-index-api, services/job-ingestion-worker are intentionally
    empty workspace slots with READMEs naming their owning milestones —
    no fake features (spec §1.5, M00 prohibited shortcut).
  - Pre-closeout adversarial review (multi-agent, 4 lenses + per-finding
    adversarial verification): 2 raw findings, 1 confirmed (missing recorded
    rationale for the absent build task — resolved by KI-0001 before this
    entry), 1 rejected (pnpm/Python pinning is mandated by W02's
    reproducibility requirement, not M00-W03 scope pulled forward).

### M00-W01 — Create canonical project-memory files (2026-07-26)

- Revision: tree e1dd209417af97b3cab320b4ab01fbd702547136 / commit 63d9442258c68a9dd8ecb9a20810e5740679557c (stamped in the follow-up commit per the
  anchoring convention above).
- Environment: Linux 6.18.5 (cloud work environment), Python 3.11.15,
  git 2.43.0. Note: the spec's target machine (macOS, Apple silicon M5,
  24 GB) is not exercised by this package; M00-W01 produces only
  project-memory documents and a stdlib-only validation script.
- Commands and observed results:
  - `sha256sum "<owner upload>/MASTER_IMPLEMENTATION_SPEC(1).md" docs/MASTER_IMPLEMENTATION_SPEC.md`
    → exit 0; both `2ddbda1db42cb4a4efdb61415ee1f348811f088f3d70b0a5570f6b4e0570dac8`
    (canonical spec copy is byte-identical to the owner's source file).
  - `python3 scripts/validate_status.py` (real files, final state)
    → exit 0; `PASS: all checks passed (17 check groups)` — all eight
    project-memory files present with required structure; spec parsed
    (38 milestones, 227 work packages); status header/sections present;
    milestone table complete (38 rows, valid enums); work-package table
    complete (227 rows, exactly one state each); IN_PROGRESS count ok;
    current-package field consistent; next READY package is READY;
    dependency order respected; milestone/package states consistent.
  - Negative case A — invalid enum (`M03-W02` set to `DONE` in a mutated
    copy, run with `--status /tmp/status_bad_enum.md`) → exit 1;
    `invalid work-package state for M03-W02: 'DONE'` (plus consequent
    milestone-consistency error). Rejected as required.
  - Negative case B — two IN_PROGRESS packages (`M01-W01` also set
    IN_PROGRESS, `--status /tmp/status_two_ip.md`) → exit 1;
    `more than one work package IN_PROGRESS: ['M00-W01', 'M01-W01']`
    (plus skipped-dependency and milestone-consistency errors). Rejected
    as required by spec §12.
  - Negative case C — skipped dependency (`M01-W01` set READY while M00
    unfinished, `--status /tmp/status_dep_skip.md`) → exit 1;
    `M01-W01 is READY but dependency milestone M00 has unfinished packages`.
  - Negative case D — missing package row (`M37-W07` row removed,
    `--status /tmp/status_missing_row.md`) → exit 1;
    `work-package table missing 1 package(s): ['M37-W07']`.
  - During execution, the validator was also run once with M00-W01
    IN_PROGRESS (the mandated mid-package state) → exit 0, PASS.
- Test counts: validator checks — 17 check groups PASS on real files;
  4/4 negative structure cases correctly rejected (exit 1 each).
- Artifacts: none beyond the committed files (no screenshots; no UI exists
  yet).
- Notes:
  - The one-off table generator that seeded PROJECT_STATUS.md derives both
    tables by parsing docs/MASTER_IMPLEMENTATION_SPEC.md with the same
    parser the permanent validator uses (`scripts/validate_status.py`), so
    the seeded tables cannot silently diverge from the spec.
  - `scripts/validate_status.py` is the "small validation script" required
    by spec §12; it is stdlib-only. M00-W04 will wire it into the root
    verification commands.
  - Work-environment limitation (process, not product): github.com egress
    is blocked in the cloud work environment used for this package, so the
    `origin` remote (https://github.com/kalwad/jobapplyv2.git) is configured
    but unpushed; the owner pushes from the development machine. Recorded
    also under Known release blockers in PROJECT_STATUS.md.
