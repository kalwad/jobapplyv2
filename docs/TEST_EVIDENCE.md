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

### M00-W04 — Create root verification commands (2026-07-26)

- Revision: tree recorded post-commit / commit recorded post-commit (stamped
  in the follow-up commit per the anchoring convention above).
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
