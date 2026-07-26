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

**Bootstrap tools** — installed once, globally, on the Apple-silicon Mac
(these only have to be _present_; their own versions are not what the
repository pins):

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

## Install (fresh clone)

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
uv sync --locked
cargo fetch --locked --manifest-path services/native-host/Cargo.toml
```

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
pnpm test:contract   # contract suite state (NOT_YET_APPLICABLE until M01-W05)
pnpm test:e2e        # Playwright browser tests (pinned Chromium)
pnpm test:visual     # visual suite state (NOT_YET_APPLICABLE until M10-W06)
pnpm test:python     # Ruff + mypy + pytest via uv (pinned interpreter)
pnpm test:rust       # cargo fmt/clippy/test/build (pinned toolchain)
pnpm traceability:check     # read-only 135/260 traceability + drift validation
pnpm traceability:generate  # regenerate the reviewed human traceability view
pnpm verify          # aggregate of all of the above + traceability/integrity/status
python3 scripts/validate_status.py
```

Direct §8.5 equivalents (`uv run ruff check services`, `uv run mypy
services`, `uv run pytest`, `cargo fmt/clippy/test --manifest-path
services/native-host/Cargo.toml`, `pnpm test:browser-smoke`) keep working
unchanged.

## Traceability and next-work derivation (M00-W07)

`docs/traceability.json` is the canonical reviewed machine-readable mapping.
It contains all 135 requirement records and all 260 expanded work-package
records. Exact requirement text, package IDs/titles, and explicit
milestone/gate dependencies remain owned by the immutable canonical
specification; live states/evidence remain owned by `PROJECT_STATUS.md` and
the critical-gate ledger. The JSON records the reviewed ownership,
planned components/test/evidence layers, honest implementation state,
sequential dependency derivation, direct downstream edges, and mapping
checksums.

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
suite, so `pnpm preflight` and both CI matrix jobs enforce the same data.
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

## CI (GitHub Actions, M00-W06)

One workflow, [.github/workflows/ci.yml](.github/workflows/ci.yml), runs a
single `verify` job on a `macos-15` + `ubuntu-24.04` matrix. Each job
checks out the exact revision, activates the repository pins (Node from
`.nvmrc` via setup-node, pnpm via Corepack's `packageManager` field, uv as
the exact PyPI wheel version read from `pyproject.toml`, Rust from
`rust-toolchain.toml` with rustfmt/Clippy), installs with
`pnpm install --frozen-lockfile` + `uv sync --locked` +
`cargo fetch --locked`, then runs **exactly** `pnpm run doctor` and
`pnpm verify` — the same canonical commands as local development, no
CI-only test subset. To reproduce CI locally, run `pnpm preflight`.

Security posture: `permissions: contents: read`, no secrets, official
`actions/*` actions only, every action pinned to an immutable commit SHA
with its release tag annotated, `persist-credentials: false`, no live-site
tests, and no network use after dependency/browser installation.

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
compatibility tests. Today both are honestly `NOT_YET_APPLICABLE`; each
becomes `REQUIRED_MISSING` (a hard `pnpm verify` failure, locally and in
CI) as soon as its owner package begins without real artifacts. No
placeholder generators or fake generated files are permitted (spec §1.5).
