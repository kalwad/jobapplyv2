# Owner holdout manifest handoff

This directory may contain only sanitized `holdout-manifest.v1` commitments.
Hidden cases, expected outputs, paths, mapping files, keys, credentials, and
private data remain outside the repository under owner control.

No genuine owner manifest existed at the M02-W06 implementation handoff. Do
not create a placeholder from contract fixtures. The owner/evaluator supplies
one dedicated external root containing `mapping.v1.json` plus its exact mapped
file inventory, then runs from the repository root:

```sh
JAPP_HOLDOUT_V1_ROOT=/absolute/owner/designated/root \
  pnpm --filter @japp/evaluation-corpus holdout:export-manifest -- \
  --output benchmarks/holdout-manifests/m02-autofill-v1.manifest.json

JAPP_HOLDOUT_V1_ROOT=/absolute/owner/designated/root \
  pnpm --filter @japp/evaluation-corpus holdout:verify -- \
  --manifest benchmarks/holdout-manifests/m02-autofill-v1.manifest.json
```

The root must be absolute, outside this repository, nonsymlinked, and exact
inventory. Mapping paths are strict lowercase ASCII relative paths. The
mapping uses generic stable IDs/categories only, contract-valid benchmark v1
cases, `OWNER_CONTROLLED_EXTERNAL`, `OWNER_REVIEWER`, synthetic-only data, and
independent generic creation/review provenance. The CLI emits commitments and
counts only; errors emit a finite code and no path or body.
