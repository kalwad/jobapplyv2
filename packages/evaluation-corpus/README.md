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
