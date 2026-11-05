# Additive gate-v2 owner-holdout waiver proof

Patch: `gate-v2-waiver.patch`, SHA-256 `bbd2c9e0a1e2218caecbd7b7b80b52d58fcf3c046bb628ea4103da9a294a95e7`.

All edits and logs are outside the active repository. The patch changes35 files
and passed read-only `git apply --check` against the active root. It excludes
root verify.py/public proof changes and all extension/runtime files.

The two gate-v2 roots explicitly distinguish actual execution, nonexecution,
and the exact ADR-0006/OD-035 owner waiver across all four gates. A waiver has
execution_performed=false and holdout_valid=false, with no execution result
reference. Other completeness, numerical, reviewer and owner gate-decision
conditions are preserved. Pure typed declarations do not prove owner authority.
Existing validate_status.py adds the source-aware check; its accepted-record
preimage hash is `sha256:a76132ab96294a6e1b69c985ffd7f420ff6df96e3a121a579a734814c276647a`.
Unrelated later ADRs do not change that digest. Both ledger and report must use
exact WAIVED_BY_OWNER_ADR_0006, including when both incorrectly claim PASS.

Verification:

- `pnpm --filter @japp/contracts test`:2521/2521 PASS across21 files,
  `contracts-full-final.log`. This includes original corpus language counts
  TypeScript510/Python506/Rust505 and229 historical executable witnesses per
  language; the original corpus remains511 cases. The full pass preceded only
  new-corpus JSON formatting/manifest refresh; the final exact corpus rerun below
  validates those final bytes.
- `pnpm --filter @japp/contracts exec vitest run test/contract/gate-waiver-v2.test.ts`:
  final81/81 PASS, `gate-v2-adapters-final.log`; all79 cases executed by every
  actual TypeScript/Python/Rust adapter, plus inventory and unchanged-baseline
  assertions. Each request remains below the unchanged512-case bound.
- `cargo test --locked --offline --manifest-path packages/contracts/test/contract/rust-harness/Cargo.toml`:
  10/10 PASS, `rust-tests.log`.
- `python -m pytest scripts/tests/test_validate_status.py -q`:201/201 PASS,
  `full-status-tests-final.log`; final source-aware29/29 PASS after an equivalent
  return-branch simplification, `authority-tests-final.log`.
- Package TypeScript typecheck, typed ESLint on changed TypeScript, strict mypy
  on changed Python, Ruff, Prettier and cargo fmt checks PASS; final logs named
  `types-final.log`, `lint-final.log`, `mypy-final.log`, `ruff-final.log`,
  `format-check-final.log`, `rust-format-final.log`.
- Generator write/read-only drift check PASS; generated189 files byte-identical,
  `generation-check-final.log`.
- `check-compatibility.ts --check`: compatible=true/findings=[], additive new
  schemas/rules/witnesses only, `compatibility.log`. No update-baseline command.
- `historical-preimages.json`:244 immutable preimages byte-identical, covering
  all existing78 schemas, original corpus4 files, both baseline files and all
  existing per-schema generated models. Two shared generated semantic dispatch
  modules gain v2 evaluators/bindings additively; indexes/manifest also grow.

The five initially failing contract tests assumed exact equality of current
truth to the frozen old baseline, total historical witness count, or current
catalogminor1.1/1.2. Updated tests retain exact historical schema/rule/wire/witness
projection and compare additive evolution without rewriting the baseline.
No gate or work-package completion state was written. This proof does not supply
benchmark measurements, independent review or owner gate approval.

Python inventory:29 additive node IDs in `new-python-nodeids.txt`; common count
1422→1451, SHA-256 `e7949fd236aec961b5fb6d738e4ae32c6922a949ec15a9e731efc1abcf5c773b`.
The existing validate_status.py/test file are already covered by canonical
Ruff/mypy/format command argv; no new Python source path requires registration.
