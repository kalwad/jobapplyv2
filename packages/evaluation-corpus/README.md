# `@japp/evaluation-corpus`

Private M02-W06 owner for the frozen public development corpus and the
sanitized commitment to an owner-controlled external holdout. This package is
`EVALUATION_ONLY`, `NON_PRODUCTION`, and has gate authority `NONE`.

The public v1 corpus and a future owner manifest are independent commitments.
No hidden body, expected output, secret, key, absolute path, user name, or
private employer data belongs in this repository. The ordinary package export
does not expose owner access. Owner tooling is isolated behind
`@japp/evaluation-corpus/owner-holdout` and the explicit CLI.

`pnpm --filter @japp/evaluation-corpus corpus:check` is read-only. The writer
creates a missing full-version artifact only; it refuses to rewrite an existing
semantic version. A correction must use a new major version and preserve the
old version and a reviewed correction/invalidation record.

The real owner handoff is documented in
`benchmarks/holdout-manifests/README.md`. Until that handoff exists, W06 stays
`IN_PROGRESS` and the repository contains no placeholder manifest.

The versioned contracts at that boundary are deliberately separate:

- the repository-visible sanitized commitment remains
  `benchmark/holdout-manifest:v1` / `holdout_format_version: 1.0.0`;
- the private executable root uses `mapping.v2.json` /
  `owner-mapping:v2`, which maps both case-container files and every unique
  `input_artifacts[].artifact_ref` to an exact preimage file;
- the private verification snapshot and receipt use version `2.0.0` and
  report case-file and artifact counts/bytes separately.

`owner-mapping:v1` is preserved as historical documentation, but it is not
executable final W06 evidence because it cannot name input-artifact preimages.
Artifact files are opaque exact bytes: the verifier safely reads them,
recomputes SHA-256, and compares that digest to the authoritative declaration
inside the hidden `BenchmarkCaseV1`. A reused artifact ref is allowed only
when every declaration has the same digest and `schema_ref`.

The public trust chain is therefore: sanitized case-file commitment → exact
hidden case bytes → artifact ref/digest/schema commitment → verified external
artifact preimage bytes. Paths and artifact bodies never enter the public
manifest or CLI receipt.
