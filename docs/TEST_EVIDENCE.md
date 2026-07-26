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

### M00-W09 — Add Windows CI and platform-portability baseline (2026-07-26)

- Revision: stamp pending (content tree recorded in the conventional
  follow-up commit after the hosted three-OS content run passes).
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
- Hosted proof: pending at entry creation — the content commit must pass
  all three hosted jobs (macos-15, windows-2025, ubuntu-24.04) running
  the same canonical doctor/verify commands, and the final revision-stamp
  HEAD requires its own successful three-OS run before closeout. Run and
  job IDs are recorded below when observed.

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
