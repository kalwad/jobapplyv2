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
- `prompts/` — versioned prompt registry (M05+)
- `model/` — model lock and evaluation corpora (M05+)
- `scripts/` — repository validation and (from M00-W04) verification commands
- `docs/` — canonical project-memory files

## Prerequisites

- Node.js ≥ 26 and pnpm ≥ 11 (`packageManager` is pinned in `package.json`)
- [uv](https://docs.astral.sh/uv/) ≥ 0.11 (fetches the pinned Python 3.12
  automatically from `.python-version`)
- Rust stable via rustup (provides `cargo`, `rustfmt`, `clippy`)

## Install

```bash
pnpm install
uv sync
cargo fetch --manifest-path services/native-host/Cargo.toml
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check

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
