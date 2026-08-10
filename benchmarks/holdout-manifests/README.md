# Owner holdout manifest handoff

This directory may contain only sanitized `holdout-manifest.v1` commitments.
Hidden cases, expected outputs, paths, mapping files, keys, credentials, and
private data remain outside the repository under owner control.

No genuine owner manifest exists. The rejected 11-case owner draft remains
external and untouched after independent review found
`INPUT_ARTIFACT_PREIMAGE_UNAVAILABLE` in 11/11 cases. Do not inspect it through
ordinary tooling, retrofit it in place, or create a placeholder from contract
fixtures. A fresh author may build a new executable bundle only after this
corrected tooling receives independent acceptance.

The owner/evaluator supplies one dedicated external root containing
`mapping.v2.json`, mapped case-container files, and mapped artifact-preimage
files, then runs from the repository root:

```sh
JAPP_HOLDOUT_V1_ROOT=/absolute/owner/designated/root \
  pnpm --filter @japp/evaluation-corpus holdout:export-manifest -- \
  --output benchmarks/holdout-manifests/m02-autofill-v1.manifest.json

JAPP_HOLDOUT_V1_ROOT=/absolute/owner/designated/root \
  pnpm --filter @japp/evaluation-corpus holdout:verify -- \
  --manifest benchmarks/holdout-manifests/m02-autofill-v1.manifest.json
```

The executable root must be absolute, neither inside nor an ancestor of this
repository, nonsymlinked, and a closed exact inventory. Keep rejected drafts,
review notes, and narrative evidence in a separate owner archive—not inside
the executable root. Mapping paths are strict lowercase ASCII relative paths.

`files` maps hidden `BenchmarkCaseV1` containers. `artifacts` maps every unique
generic artifact ref to its opaque exact-byte preimage:

```json
{
  "mapping_format_version": "2.0.0",
  "files": [
    {
      "file_id": "file_00000000000000000000000001",
      "relative_path": "cases/holdout-a.v1.json"
    }
  ],
  "artifacts": [
    {
      "artifact_ref": "artifact_00000000000000000000000001",
      "relative_path": "artifacts/artifact-a.bin"
    }
  ]
}
```

The complete mapping also carries the existing manifest, provenance, case,
storage, and visibility fields defined by
`packages/evaluation-corpus/schemas/owner-mapping.v2.schema.json`. Arrays are
sorted and unique; paths
cannot overlap across roles or as file/ancestor pairs. Every case must be
contract-valid Autofill Feasibility, owner-controlled hidden, and synthetic.
The verifier treats artifacts as arbitrary bytes, recomputes their SHA-256
digests, and binds them to the case-declared artifact ref/digest/schema.

The public manifest intentionally remains `benchmark/holdout-manifest:v1` and
contains case-container commitments only. The private mapping and private
snapshot/receipt are v2. Historical owner mapping v1 remains preserved but is
insufficient and is refused as final evidence. The CLI emits sanitized
commitments and counts only; errors emit finite codes and no path or body.
