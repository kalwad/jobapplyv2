# Holdout Execution Log

Append-only log of owner-controlled holdout executions for the three
critical gates (`docs/MASTER_IMPLEMENTATION_SPEC.md` §5.1, §5.13, §8.3.1).

## Rules

- The repository stores only manifests (case IDs, schema versions, counts,
  cryptographic hashes) — never the holdout cases or expected outputs.
- Holdout expected results are unavailable to the implementation agent
  before execution (REQ-GATE-002); a failed holdout is never repaired by
  editing the holdout answer (spec §8.3 holdout handling).
- Results are append-only and tied to a Git revision; entries are added by
  the separate evaluation session that executed the bundle.

## Executions

| Date | Gate | Bundle manifest hash | Runner revision | Result artifact hash | Executed by | Outcome |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | (none yet — first holdout arrives with M02-W06/M02-W14) |
