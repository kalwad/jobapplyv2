# Holdout Execution Log

Append-only log of owner-controlled holdout executions for the four
critical gates (`docs/MASTER_IMPLEMENTATION_SPEC.md` §5.1, §5.13, §8.3.1).

## Rules

- The repository stores only manifests (case IDs, schema versions, counts,
  cryptographic hashes) — never the holdout cases or expected outputs.
- Holdout expected results are unavailable to the implementation agent
  before execution (REQ-GATE-002); a failed holdout is never repaired by
  editing the holdout answer (spec §8.3 holdout handling).
- M02-W06 freezes the public corpus and establishes the sanitized external
  holdout commitment boundary. It does not execute the holdout. M02-W14 owns
  execution, and M02-W15 owns the independent gate decision.
- Results are append-only and tied to an exact Git commit and tree; entries
  are added only by the separate evaluation session that executed the bundle.
- First-parent history is machine-checked. Existing rows may never be edited,
  deleted, reordered, or replaced. Execution IDs and complete
  revision/result identities must be unique; a valid new execution appends
  one row.

## Executions

| Execution ID | Date | Gate | Bundle manifest digest | Commit | Tree | Runner revision | Result artifact digest | Executor role | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | (none yet — M02-W06 defines the boundary; M02-W14 performs the first execution) |
