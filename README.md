# Local-first job application platform — monorepo

This repository is governed by the canonical contract in
[docs/MASTER_IMPLEMENTATION_SPEC.md](docs/MASTER_IMPLEMENTATION_SPEC.md)
(JAPP-MASTER-001) and the session rules in [CLAUDE.md](CLAUDE.md). Product
naming is intentionally neutral (owner decision OD-003). Current state:
see [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Layout (spec §5.1)

- `apps/` — `desktop` (Tauri 2, M03+), `extension` (WXT MV3 — real
  feasibility extension in M02, productionized M17+), `mock-ats-lab`
  (deterministic fixtures, M02+)
- `services/` — `orchestrator` (Python 3.12 + FastAPI, M03+),
  `native-host` (Rust native-messaging bridge, M17-W04),
  `job-index-api` / `job-ingestion-worker` (late stage, M32+)
- `packages/` — shared TypeScript workspace packages (contracts, domain,
  ui, resume-schema, form-engine, ats-adapters, security, test-fixtures)
- `e2e/` — browser-toolchain infrastructure smoke test (Playwright;
  product e2e suites arrive with their owning milestones)
- `prompts/` — versioned prompt registry (M05+)
- `model/` — model lock and evaluation corpora (M05+)
- `scripts/` — repository validation and (from M00-W04) verification commands
- `docs/` — canonical project-memory files

## Toolchain (M00-W03)

Two layers, deliberately distinct:

**Bootstrap tools** — installed once, globally (these only have to be
_present_; their own versions are not what the repository pins). The table
below covers the primary Apple-silicon Mac; Windows uses the
"Windows setup (PowerShell)" section further down, and Ubuntu needs the
same five tools from nvm/NodeSource, pipx, and rustup.rs:

| Tool        | Install (macOS, Apple silicon)              | Purpose                      |
| ----------- | ------------------------------------------- | ---------------------------- |
| Homebrew    | https://brew.sh                             | installs the rest            |
| Node 24 LTS | `brew install node@24` (keg-only)           | JS runtime matching `.nvmrc` |
| Corepack    | ships with Node 24 (`corepack enable pnpm`) | activates the pinned pnpm    |
| uv          | `brew install uv` or the official installer | Python + venv manager        |
| rustup      | `brew install rustup` (keg-only)            | Rust toolchain manager       |

**Repository-pinned versions** — enforced by files in this repo; these are
the versions that matter:

| What             | Pin                                           | Enforced by                                                                                                |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Node             | 24.18.0                                       | `.nvmrc`, `engines` + `engineStrict: true` in `pnpm-workspace.yaml` (mismatched Node fails `pnpm install`) |
| pnpm             | 11.17.0                                       | `packageManager` field (Corepack), `engines.pnpm`                                                          |
| npm dependencies | exact                                         | `pnpm-workspace.yaml` catalog + `savePrefix: ""`, `pnpm-lock.yaml`                                         |
| Python           | 3.12.13                                       | `.python-version` (uv fetches this exact managed CPython)                                                  |
| uv               | 0.11.32                                       | `[tool.uv] required-version` in `pyproject.toml`                                                           |
| Python dev tools | mypy 2.3.0, pytest 9.1.1, ruff 0.16.0         | `==` pins + `uv.lock`                                                                                      |
| Rust             | 1.97.1 + rustfmt + clippy                     | `rust-toolchain.toml` (rustup override)                                                                    |
| Browser tests    | @playwright/test 1.62.0 + its pinned Chromium | exact devDependency; `pnpm exec playwright install chromium`                                               |

## Activation on this machine

Both Homebrew kegs are keg-only (not symlinked into `/opt/homebrew/bin`),
so put them on `PATH` for a working shell:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/opt/rustup/bin:$PATH"
```

One-time setup after installing Node 24:

```bash
corepack enable pnpm
```

(from a shell where the `node@24` keg is first on `PATH`; Corepack then
serves exactly the `packageManager` pnpm version inside this repository).

## Windows setup (PowerShell)

Development-host bootstrap for Windows (M00-W09; this is a
repository/toolchain portability baseline — packaged Windows 11 desktop
product support remains `NOT_YET_IMPLEMENTED`, see
[docs/PLATFORM_SUPPORT.md](docs/PLATFORM_SUPPORT.md)). Install the
bootstrap tools once from PowerShell 7 (`pwsh`):

```powershell
winget install OpenJS.NodeJS.LTS      # Node 24.x; .nvmrc pins 24.18.0 exactly
winget install astral-sh.uv           # repository enforces ==0.11.32 itself
# rustup: download and run rustup-init.exe from rustup.rs, then:
rustup toolchain install 1.97.1
corepack enable pnpm                  # serves the pinned pnpm 11.17.0
```

No Homebrew, Bash, POSIX shell profile, `/tmp`, or executable-bit behavior
is required: the canonical commands below run identically from PowerShell.
`rust-toolchain.toml` overrides the active Rust toolchain inside the
repository, uv fetches the pinned CPython 3.12.13 automatically, and the
doctor reports Windows-specific remediation (winget/rustup-init) when a
pin is not satisfied.

## Install (fresh clone)

Same commands on macOS, Windows (PowerShell), and Ubuntu:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
uv sync --locked
cargo fetch --locked --manifest-path services/native-host/Cargo.toml
cargo fetch --locked --manifest-path packages/contracts/test/contract/rust-harness/Cargo.toml
```

(On Ubuntu CI the browser step is `pnpm exec playwright install
--with-deps chromium`; `--with-deps` is Linux-only.)

Then confirm the environment before doing anything else:

```bash
pnpm run doctor
```

## Verify the active toolchain

```bash
node -v                     # must print v24.18.0 (matches .nvmrc)
pnpm -v                     # must print 11.17.0 (matches packageManager)
uv --version                # must print 0.11.32 (required-version)
uv run python -VV           # must print Python 3.12.13 (uv-managed, not system)
rustup show active-toolchain  # must print 1.97.1 (overridden by rust-toolchain.toml)
cargo --version && cargo fmt --version && cargo clippy --version
pnpm exec playwright --version
```

## Checks (M00-W04 root verification commands)

`pnpm verify` is the canonical aggregate, non-live verification command. It
is driven by the suite-state registry `scripts/verification-suites.json`
and the fail-closed runner `scripts/verify.py`: every suite is ACTIVE
(must run and pass, with test-discovery proofs), NOT_YET_APPLICABLE (its
owning work package has not begun — reported honestly, never as a pass),
or REQUIRED_MISSING (owning package has begun but the suite is absent —
always a failure). Suite state derives from `docs/PROJECT_STATUS.md`, not
from a hand-edited flag. `pnpm verify` also validates toolchain pins,
runs repository-integrity checks (lockfiles, canonical docs, no no-op
scripts, no `passWithNoTests`-style bypasses, no focused/skipped tests),
and fails if verification changes `git status --porcelain`
(status-neutrality: it never modifies tracked files).

```bash
pnpm lint            # typed strict ESLint over all TypeScript
pnpm format:check    # Prettier + Ruff format + rustfmt (check-only)
pnpm typecheck       # tsc (all TS projects) + strict mypy
pnpm test            # TypeScript unit tests (Vitest, fresh runs, count-proofed)
pnpm test:contract   # active representative TS/Python/Rust contract suite
pnpm test:e2e        # Playwright browser tests (pinned Chromium)
pnpm test:visual     # visual suite state (NOT_YET_APPLICABLE until M10-W06)
pnpm test:python     # Ruff + mypy + pytest via uv (pinned interpreter)
pnpm test:rust       # cargo fmt/clippy/test/build (pinned toolchain)
pnpm generate:contracts         # regenerate packages/contracts/generated (M01-W02)
pnpm generate:contracts --check # read-only byte-exact drift check (contract-gen suite)
pnpm contracts:compatibility:check # read-only M01-W05 historical compatibility check
pnpm traceability:check     # read-only v1.4 193/300 traceability + drift validation
pnpm traceability:generate  # regenerate the reviewed human traceability view
pnpm verify          # aggregate of all of the above + traceability/integrity/status
python3 scripts/validate_status.py
```

Direct §8.5 equivalents (`uv run ruff check services`, `uv run mypy
services`, `uv run pytest`, `cargo fmt/clippy/test --manifest-path
services/native-host/Cargo.toml`, `pnpm test:browser-smoke`) keep working
unchanged.

M02-W01's committed development fixture seed is test/evaluation data, not a
product model or frozen corpus. Its semantic selectors, scenario-date
freshness rules, independent test-only oracle, privacy/diagnostic boundary,
and loader TOCTOU limits are documented in
[`packages/test-fixtures/README.md`](packages/test-fixtures/README.md).
M02-W01 remains IN_PROGRESS and M02-W02 remains NOT_STARTED until the
separate audit and governance closeout sequence recorded in project status is
complete.

## Traceability and next-work derivation (M00-W07; v1.3 by M00-W10, v1.4 by M00-W11)

`docs/traceability.json` is the canonical machine-readable mapping.
It contains all 193 requirement records and all 300 expanded work-package
records plus four critical gates. Exact requirement text, package IDs/titles,
and explicit
milestone/gate dependencies remain owned by the immutable canonical
specification; live states/evidence remain owned by `PROJECT_STATUS.md` and
the critical-gate ledger. The 135 requirement mappings and 260 dependency
records reviewed in M00-W07 retain their exact hashes. M00-W08 mechanically
added the v1.3 delta in a visibly provisional migration state. M00-W10
independently reviewed every one of the 22 new requirements and 26 new
packages, promoted only those records to `REVIEWED_V1_3`, and locked the
expanded v1.3 mapping/dependency hashes. M00-W11 adopted the owner-approved
v1.4 bytes and independently reviewed the exact 36 new requirements and 14 new
packages as `REVIEWED_V1_4`; the v1.2 and v1.3 reviewed hashes remain
immutable historical layers. The JSON records ownership, planned
components/test/evidence layers, honest implementation state, sequential
dependency derivation, direct downstream edges, and mapping checksums.

`docs/REQUIREMENTS_TRACEABILITY.md` is a generated view and must not be
edited by hand:

```bash
pnpm traceability:generate  # update after an intentional canonical input change
pnpm traceability:check     # read-only; fails if regeneration would change the view
```

The validator rejects inventory/count drift, duplicates/unknown IDs,
text/title/ownership drift, unknown or cyclic dependencies, incorrect
critical-gate effects, premature readiness, false future implementation or
evidence, missing completed paths/evidence headings/gate reports, and
human/machine disagreement. It is an always-active mandatory `pnpm verify`
suite, so `pnpm preflight` and all three CI matrix jobs enforce the same data.
Future packages update the JSON, regenerate the Markdown, record real
evidence, and keep future work `NOT_STARTED`/`NOT_YET_APPLICABLE` until real
code and tests exist.

## Doctor and preflight (M00-W06)

```bash
pnpm run doctor          # read-only environment diagnosis + remediation
pnpm run doctor --json   # deterministic machine-readable output
pnpm preflight           # doctor, then the canonical `pnpm verify` —
                         # exactly the two commands CI runs, in order
```

The explicit `run` matters: pnpm ships an unrelated built-in `pnpm doctor`
command which takes precedence over same-named package scripts, so the bare
form would silently run the wrong tool (`pnpm preflight` has no such
collision).

`scripts/doctor.py` (stdlib-only, runs under any `python3`) checks the
repository pins against the live environment: canonical/project-memory and
critical-gate files, lockfiles, required root scripts, git state, exact
Node/pnpm/uv/Python versions, the Rust toolchain resolving through the
pinned rustup override (rustfmt + Clippy included), writable temp
locations, the pinned `@playwright/test` package, a controlled launch of
the pinned Chromium via the existing browser smoke test, the status
validator, and the verification-suite state model. It never installs,
downloads, or repairs anything and never modifies tracked files; every
failure comes with the exact remediation command.

Interpreting statuses: `PASS` means the requirement is satisfied;
`WARNING` is informational (e.g. a dirty working tree) and does not affect
the exit code; `FAIL` is fatal (exit 1); `NOT_YET_APPLICABLE` marks a
verification suite whose owning work package has not begun — it is an
honest classification from the suite-state registry, **never** a pass, and
it flips to the hard-failing `REQUIRED_MISSING` the moment the owning
package starts without real artifacts.

Common environment failures:

- **Node 26 active (machine default):** `pnpm install` fails with
  `ERR_PNPM_UNSUPPORTED_ENGINE` and `pnpm doctor` reports the
  wrong Node — put the keg first on `PATH` (see "Activation" above).
- **`uv`/`cargo` not on PATH:** both Homebrew kegs are keg-only; the same
  `PATH` export fixes cargo, and `brew install uv` provides uv (the repo
  enforces `==0.11.32` itself).
- **Missing Chromium:** `pnpm exec playwright install chromium` (one-time
  network download; everything else in doctor/verify is offline).

## CI (GitHub Actions, M00-W06 + M00-W09)

One workflow, [.github/workflows/ci.yml](.github/workflows/ci.yml), runs a
single `verify` job on the required `macos-15` + `windows-2025` +
`ubuntu-24.04` matrix. Each job checks out the exact revision, activates
the repository pins (Node from `.nvmrc` via setup-node, pnpm via
Corepack's `packageManager` field, uv as the exact PyPI wheel version read
from `pyproject.toml`, Rust from `rust-toolchain.toml` with
rustfmt/Clippy installed into a job-isolated `RUSTUP_HOME` under
`runner.temp`), installs with `pnpm install --frozen-lockfile` +
`uv sync --locked` + `cargo fetch --locked`, then runs **exactly**
`pnpm run doctor` and `pnpm verify` — the same canonical commands as local
development on every OS, with no CI-only or weaker per-platform test
subset. To reproduce CI locally, run `pnpm preflight`.

Shell policy (M00-W09): there is no workflow-global Bash default.
Single-command steps use each OS's native default shell; multi-line steps
declare `bash` only behind a non-Windows guard, and Windows-specific
scripting uses `pwsh` with `$ErrorActionPreference = 'Stop'` and
`$PSNativeCommandUseErrorActionPreference = $true` so child-process
failures always fail the step. The `portability` verification suite
(`scripts/check_portability.py`, run by `pnpm verify` on every OS) is a
deterministic policy gate: it rejects a missing required OS, a weaker
Windows command set, global Bash assumptions, POSIX-only tokens in
Windows-reachable steps, `continue-on-error`, masked child failures,
unpinned or third-party actions, widened permissions, cached
`RUSTUP_HOME`/toolchain state, out-of-allowlist cache paths, missing
frozen installs or toolchain probes or Chromium installs, non-failure
artifact uploads — and, in shared runtime scripts, hard-coded
`/tmp`/`/bin`/`/usr` paths, `shell=True`/Bash wrappers, manual path
separator concatenation, executable-bit dependence outside
`scripts/portability.py`, case-colliding tracked paths, and a missing
LF-enforcing `.gitattributes`.

Security posture: `permissions: contents: read`, no secrets, official
`actions/*` actions only, every action pinned to an immutable commit SHA
with its release tag annotated, `persist-credentials: false`, no live-site
tests, and no network use after dependency/browser installation.

The `windows-2025` job is a repository/toolchain portability baseline
only: passing it does not prove packaged Windows 11 desktop support,
secure storage, native messaging, local-model runtime, installers, or
updates. The certified target policy is recorded in
`docs/PLATFORM_SUPPORT.md`; `CROSS_PLATFORM_CORE` (Gate D) remains
`NOT_EVALUATED` and still requires later native packaged evidence.

Cache policy: pnpm store, uv cache, cargo registry/git, and Playwright
browser caches are keyed on `runner.os` + `runner.arch` + `hashFiles()` of
the relevant pin/lockfiles (`.nvmrc`/`pnpm-lock.yaml`, `pyproject.toml`/
`uv.lock`/`.python-version`, `rust-toolchain.toml`/`Cargo.lock`). There
are deliberately no `restore-keys` fallbacks (no stale cross-lockfile
reuse) and no caching of build outputs, browser state, or generated
application artifacts.

Browser artifact policy: Playwright traces/screenshots/videos are
failure-only (playwright.config.ts) and are uploaded — from
`test-results/` only, 7-day retention — solely when a job fails. Nothing
else is ever uploaded.

Generated-contract lifecycle: the `contract-gen` registry suite (owner
`M01-W02`) is the drift check — once real generators exist it regenerates
contracts and fails on any tracked diff. It is distinct from the
`contract` suite (owner `M01-W05`), which runs cross-language
compatibility tests. Both are ACTIVE and mandatory after M01-W05 began;
`contract` executes the real generated TypeScript/Python adapters and private
locked/offline Rust harness against one canonical corpus. Visual verification
remains honestly `NOT_YET_APPLICABLE`. No placeholder generators or fake
generated files are permitted (spec §1.5).
