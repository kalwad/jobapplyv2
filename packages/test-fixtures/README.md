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
- `data/development/manifest.v1.json` commits exact file-byte digests, record
  counts, and a canonical manifest hash.
- Every record has a stable opaque ID, schema reference/version, synthetic
  provenance, distinct author/reviewer roles, and a reproducible historical
  content hash.
- `src/loader.ts` rejects missing/extra files, unsafe paths, symlinks,
  duplicate IDs, schema/version drift, noncanonical ordering, and digest
  mismatch.
- `src/consistency.ts` proves cross-reference, evidence, requirement,
  chronology, support-classification, gap, page-boundary, atomic disclosure,
  and claim-to-field-policy release invariants. Confirmation-gated claims are
  represented as supported but not release eligible.
- `src/privacy.ts` rejects nonreserved identity/contact values, likely
  secrets, local paths/identity, hidden instructions, and ordinary
  prompt-injection text without printing the offending value.
- `src/platform-version-guard.ts` rejects new references to the fifteen
  deprecated platform-v1 roots that have corrected v2 siblings.

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
