# M02-W01 synthetic development fixtures

This package owns test/evaluation data only. It is not a product profile,
resume, job, evidence, or application storage model, and product packages must
not depend on it. The future product-domain schemas remain owned by M06, M09,
and M11.

The committed `data/development/` seed is visible to implementation agents and
intentionally mutable until M02-W06 freezes a corpus. It contains no holdout
body, benchmark result, ATS form, extension behavior, or critical-gate
evidence. Owner-controlled holdout content stays outside this working tree.

## Deterministic layers

- `schemas/test-fixture/` contains closed Draft 2020-12 test-only schemas.
- `scripts/generate-seed.ts` is the explicit authoring command. Normal
  validation never generates or rewrites truth.
- `data/development/manifest.v2.json` commits exact file-byte digests, record
  counts, and a canonical manifest hash.
- Every record has a stable opaque ID, schema reference/version, synthetic
  provenance, recorded author/reviewer role labels, and a reproducible
  historical content hash. Role-label inequality is provenance hygiene only;
  it is not independent certification.
- `src/loader.ts` rejects missing/extra files, unsafe paths, symlinks,
  duplicate IDs, schema/version drift, noncanonical ordering, and digest
  mismatch. It checks root identity throughout and reads each validated file
  once through a bounded descriptor; this detects root/file replacement during
  the read but is not a hostile-kernel `openat` guarantee.
- `src/consistency.ts` proves cross-reference, evidence, requirement,
  chronology, support-classification, gap, page-boundary, atomic disclosure,
  and claim-to-field-policy release invariants. Credential validity and field
  freshness are evaluated at each scenario's explicit date, not at metadata
  review time. Confirmation-gated claims are represented as supported but not
  release eligible.
- `src/privacy.ts` scans keys, path segments, filenames, and string values
  using bounded NFKC/escape/percent normalization. Its tested boundary rejects
  the committed adversarial phone, address, credential-field, traversal,
  dangerous-key, secret, local-identity/path, hidden-text, and prompt-directive
  table while permitting reviewed reserved values, ordinary “Basic” prose,
  and route-like `/jobs/apply`. Unsafe diagnostic members are ordinalized or
  digested rather than echoed.
- `src/platform-version-guard.ts` rejects new references to the fifteen
  deprecated platform-v1 roots that have corrected v2 siblings, including
  filenames, JSON alias/major objects, and bounded TypeScript constant
  expressions parsed by the pinned compiler.

Fixture schema v2 (`schema_version` `2.0.0`, corpus `0.2.0`) is a semantic
migration: it adds explicit category-specific temporal meaning, credential
validity state, structured requirement constraints, atomic field-record
identity/freshness, scenario evaluation dates, and policy evaluations. Fixture
v1 remains historical in Git only and is not a current producer input.

The test-only oracle under `test/m02-w01/oracles/` independently enumerates
collection counts, credential states, and every scenario/evaluation/policy
expectation. Generator and validator source do not import it. Final
certification still requires a fresh read-only audit of the exact content
commit; fixture metadata does not supply that certification.

Confirmed defects must become append-only regression cases. An expectation
correction must be reviewed and supersede history rather than silently
rewriting it. M02-W06 owns the actual freeze and historical change policy.

## Commands

```text
pnpm --filter @japp/test-fixtures fixtures:seed:check
pnpm --filter @japp/test-fixtures fixtures:validate
pnpm --filter @japp/test-fixtures fixtures:privacy
pnpm --filter @japp/test-fixtures fixtures:platform-v1
pnpm --filter @japp/test-fixtures fixtures:discover
pnpm --filter @japp/test-fixtures test
```

No command has a skip, allow, no-hash, alternate-root, or scanner-bypass flag.
Tests import the loader API with isolated temporary roots for adversarial
mutations; the CLI always evaluates the committed seed.
