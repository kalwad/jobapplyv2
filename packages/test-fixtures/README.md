# M02 synthetic development fixtures (M02-W01 foundation plus M02-W02 questions and answers)

This package owns test/evaluation data only. It is not a product profile,
resume, job, evidence, question, answer, or application storage model, and
product packages must not depend on it. The future product-domain schemas
remain owned by M06, M09, M11, M15, and M16; the M02-W02 question/answer
layers anticipate the later answer requirements without claiming any M15 or
M16 product behavior exists.

The committed `data/development/` seed is visible to implementation agents and
intentionally mutable until M02-W06 freezes a corpus. It contains no holdout
body, benchmark result, ATS form, extension behavior, or critical-gate
evidence. Owner-controlled holdout content stays outside this working tree.
Corpus version 0.3.0 adds the M02-W02 question/answer development layers on
top of the verified M02-W01 foundation; every M02-W01 collection file remains
byte-identical, and each record binds the exact review event of its authoring
package (`M02W01_…` at 2026-07-29, `M02W02_…` at 2026-08-04).

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
- Cross-scenario evidence is selected by an explicit stable ID or by category
  plus stable fact keys. Selection must resolve exactly once and is invariant
  to collection ordering; education, credentials, and assertions cannot
  substitute for reviewed employment/project activity. Experience duration is
  the union of inclusive activity dates clipped to the scenario date, with
  the package convention of 365 days per requested year. Direct and
  strong-related releases must both meet the numeric threshold.
- Release-capable field policies first require an approved assertion whose
  effective start and `recorded_on` are not in the future and whose
  `valid_through` reaches the scenario date. Historical backfill with
  `valid_through < recorded_on` remains representable, but it is stale on
  entry and never releases as current truth. Credential decisions distinguish
  current, expired, not-yet-valid, revoked, and unknown state at the same
  scenario clock.
- A two-page résumé must contain unique evidence-backed facts on both pages.
  Its break identity and literal rationale are recomputed from the exact page
  split rather than treated as descriptive metadata.
- `src/privacy.ts` scans keys, path segments, filenames, and string values
  plus scalar values under secret- or identifier-semantic keys, using bounded
  NFKC/escape/percent normalization. Its tested boundary rejects the committed
  adversarial phone, address, credential-field, generic or numeric secret,
  sensitive numeric identifier, traversal, dangerous-key, local-identity/path,
  hidden-text, and prompt-directive table while permitting reviewed reserved
  values, ordinary “Basic” prose and numbers, and route-like `/jobs/apply`.
  Unsafe diagnostic members are ordinalized or digested rather than echoed.
- `src/platform-version-guard.ts` rejects new references to the fifteen
  deprecated platform-v1 roots that have corrected v2 siblings, including
  filenames, JSON alias/major objects, and bounded TypeScript constant
  expressions parsed by the pinned compiler.

Fixture schema v2 (`schema_version` `2.0.0`, corpus `0.2.0`) is a semantic
migration: it adds explicit category-specific temporal meaning, credential
validity state, structured requirement constraints, atomic field-record
identity/freshness, scenario evaluation dates, and policy evaluations. Fixture
v1 remains historical in Git only and is not a current producer input.

The hand-reviewed test-only oracle under `test/m02-w01/oracles/` records exact
collection/category counts, multi-date credential states, critical
requirement/result/evidence/rationale bindings, stale policy source dates,
profile-to-field coupling, the two-page split, and hashes of full independent
projections for all scenarios, policies, résumés, couplings, and credentials.
Mutation tests prove those expectations detect the repaired evidence,
threshold, rationale, freshness, coupling, future-approval, page-boundary, and
eligibility drifts, including one coherent change that the production
validator accepts. Generator and production validator source do not import,
read, or rewrite the oracle. Final certification still requires a fresh
read-only audit of the exact content commit; fixture metadata does not supply
that certification.

The repository test-policy check parses the pinned TypeScript/JavaScript AST
across package, app, and E2E `test`/`spec` discovery suffixes. It follows
statically resolvable Vitest aliases and computed/chained members and rejects
forbidden conditional/focus members plus statically empty `.each`/`.for`
array, constructor, concatenation, and template tables. Runtime-computed table
cardinality is outside that static proof; exact Vitest non-pass and discovered
test-count checks remain a separate backstop. `PROCEED_WITH_GAPS` is
intentionally absent from this bounded seed because no reviewed scenario has
a nonblocking residual gap; M02-W06 owns any broader corpus expansion.

## M02-W02 question and answer development layers

- `question-cases.v2.json` holds 144 question phrasings in 48 paraphrase
  clusters: two BASE canonical clusters for every v1.4 intent (the taxonomy
  is represented in the fixture layer's UPPER_SNAKE_CASE token grammar) plus
  eight sensitive overlays, so all fifteen sensitive/consequential concepts
  carry a dedicated question. Each cluster has exactly one canonical case and
  two materially reworded paraphrases; punctuation-, case-, whitespace-, or
  word-order-only variants are rejected.
- `answer-constraints.v2.json` holds ten exact limit/format fixtures. The
  closed fixture metric is deterministic: CRLF and lone CR normalize to LF,
  outer whitespace is trimmed, words are maximal non-whitespace runs,
  characters are Unicode code points of the normalized text, and single-line
  or exact HTTPS-URL/Yes-No formats are matched literally. Word and character
  maxima each carry one-below, exactly-at, and one-above boundary scenarios.
- `answer-scenarios.v2.json` holds 58 expected answer decisions binding one
  question, profile, job, jurisdiction, and evaluation date. Supported
  narrative and explicit-record answers reference only approved M02-W01
  evidence, field records, or the profile website and never invent metrics;
  sensitive outcomes derive from the existing M02-W01 field-value policies
  (all six kinds exercised) or a reviewed fixture-only concept-default
  matrix; eight stale-context kinds (including verbatim cross-company,
  cross-role, and cross-location reuse traps) and eight insufficient-evidence
  kinds release no answer text. A prohibited, missing, expired, contradicted,
  or unconfirmed sensitive answer has no releasable text.
- The hand-reviewed M02-W02 oracle under `test/m02-w02/oracles/` pins the
  exact counts, per-intent balance, outcome distribution, policy-kind and
  concept coverage, stale/insufficiency decisions, limit boundaries, explicit
  answer bindings, reuse traps, and a full projection digest. Generator and
  production validator source do not import, read, or rewrite it.

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

The loader rechecks root and file identity around bounded reads and rejects
replacement observed at those checkpoints. That narrows ordinary TOCTOU
exposure but does not claim a hostile-kernel, descriptor-relative `openat`
guarantee or immunity to a swap wholly between identity checks.
