# Local-first job application platform — monorepo

This repository is governed by the canonical contract in
[docs/MASTER_IMPLEMENTATION_SPEC.md](docs/MASTER_IMPLEMENTATION_SPEC.md)
(JAPP-MASTER-001) and the session rules in [CLAUDE.md](CLAUDE.md). Product
naming is intentionally neutral (owner decision OD-003). Current state:
see [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Layout (spec §5.1)

- `apps/` — `desktop` (Tauri 2, M03+), `extension` (WXT MV3, M17+),
  `mock-ats-lab` (deterministic fixtures, M02+)
- `services/` — `orchestrator` (Python 3.12 + FastAPI, M03+),
  `native-host` (Rust native-messaging bridge, M17-W04),
  `job-index-api` / `job-ingestion-worker` (late stage, M31+)
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

## Install

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
uv sync --locked
cargo fetch --manifest-path services/native-host/Cargo.toml
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

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm test:browser-smoke   # Playwright infrastructure smoke test (Chromium)

uv run pytest
uv run ruff check services
uv run ruff format --check services
uv run mypy services

cargo fmt --manifest-path services/native-host/Cargo.toml --check
cargo clippy --manifest-path services/native-host/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path services/native-host/Cargo.toml

python3 scripts/validate_status.py
```

The aggregate `pnpm verify` command (which must fail on any skipped
mandatory suite) is created in work package M00-W04.
