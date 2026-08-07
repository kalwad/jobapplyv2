# M02-W04 evaluation baselines (`@japp/evaluation-baselines`)

Test-only baseline algorithms owned by **M02-W04** (spec §8.4 quality
baseline, M02 package row). Everything here is `EVALUATION_ONLY` and
`NON_PRODUCTION`: a transparent, reproducible comparison floor that later
M02/M05 evaluation packages must outperform — never a product résumé,
answer, matching, or autofill feature, and never critical-gate authority.
The evaluation runner belongs to **M02-W05**, corpus freeze and the holdout
manifest to **M02-W06**, the autofill benchmark/clean-room harness to
**M02-W13**, and gate execution/decision to **M02-W14/W15**. Production
packages must not depend on this package (enforced by test).

## Layering

- Depends only on `@japp/test-fixtures` (the public synthetic W01/W02
  development corpus) plus catalog-pinned dev tooling. No model runtime, no
  provider, no network, no new external dependency.
- `model/model-lock.json` remains the untouched M05-W02 placeholder and
  `prompts/registry.yaml` remains the untouched empty production registry;
  both boundaries are asserted by tests. Baseline prompts live here, in
  `src/prompts.ts`, and are never production prompts.

## Baseline catalog (`src/catalog.ts`, catalog 1.0.2 / schema 1)

| Baseline ID                               | Kind                                                                                      | Version |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| `baseline_original_untailored_v1`         | exact passthrough (text byte-identical; structured digest-identical, input never mutated) | 1.0.0   |
| `baseline_keyword_overlap_v1`             | transparent lexical unigram matcher                                                       | 1.0.0   |
| `baseline_naive_keyword_stuffing_v1`      | intentionally weak deterministic transform                                                | 1.0.1   |
| `baseline_one_shot_resume_generation_v1`  | one injected `generateOnce` call                                                          | 1.0.0   |
| `baseline_one_shot_answer_generation_v1`  | one injected `generateOnce` call                                                          | 1.0.0   |
| `baseline_legacy_behavior_observation_v1` | isolated observation contract                                                             | 1.0.2   |

The 1.0.1 patch versions corrected the pre-verification stuffing
representation and the original legacy-validation fail-open paths. Legacy
validation 1.0.2 replaces the residual keyword-substring classifier with a
bounded line-oriented source-shape rule: declaration keywords require
declaration syntax, while simple assignment, operator, call, import/export,
control, and delimiter statements still fail closed. Keyword stuffing remains
1.0.1. Record/file schema 1.0.0, the 34-case matrix, and every unrelated
baseline algorithm remain unchanged.

A closed **Simplify comparison slot** (`baseline_simplify_comparison_slot_v1`)
is truthfully `NOT_CAPTURED`; the manual, terms-compliant capture is owned by
M02-W13/M02-W14 (autofill worksheets and side-by-side runs) and M05-W11
(resume outputs). No observation is fabricated here.

## Keyword overlap — frozen normalization and score

NFKC → Unicode default lowercase → keep `[a-z0-9+#&.]` (every other
character separates; ASCII hyphen-minus and slash always separate) → strip
trailing `.` runs per token → drop empties → unique term set → ascending
code-unit sort. No stop words, no stemming, no phrases, no embeddings, no
hidden weights, no model calls. Score = `unique matched terms / unique
target terms` in `[0, 1]`; an empty target set scores 0 with an explicit
`zero_target_terms` flag. The result exposes the normalized candidate and
target term sets, matched/missing terms, and exact numerator/denominator so
every score is reproducible by hand. **Lexical overlap is not semantic
matching** — a matched term proves no supporting evidence (a dedicated
misleading-overlap case demonstrates this).

## Naive keyword stuffing — frozen transformation

Compute the overlap baseline's missing terms, then append exactly one
annotation at the document end:
`\n\n[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: <missing terms joined by ', '>]`.
No missing terms → output byte-identical to the input. Only missing terms are
ever inserted in deterministic normalized order (repeated application is
idempotent), and the original text is preserved separately. Target-only terms
never appear under a claim-bearing Skills, Experience, Qualifications, or
Technologies heading: the annotation visibly marks them as evaluation-only
and ungrounded and expressly denies candidate-skill or experience authority.
The output remains `UNVERIFIED`/ungrounded — the baseline exists to
demonstrate why raw keyword insertion is inadequate.

## One-shot generation — injected boundary, exactly one call

`runOneShotResumeGeneration` / `runOneShotAnswerGeneration` build one
versioned baseline-owned prompt (`baseline_prompt_one_shot_resume` 1.0.0,
`baseline_prompt_one_shot_answer` 1.0.0; digests committed in the manifest),
invoke an injected `generateOnce(request)` exactly once, and preserve the raw
response as `UNVERIFIED` with `factual_authority: NONE`. No retry, no
repair, no second model, no retrieval, no tools, no verification/rewrite,
and no fallback to another baseline — a failed call is recorded
`GENERATION_FAILED`. The prompts instruct the model not to invent
unsupported facts, but nothing verifies the raw output and no truth is
claimed for it. CI uses deterministic in-process fakes only; no real model
is executed because no approved model lock or runtime exists — the catalog
records `NOT_EXECUTED_NO_APPROVED_MODEL_LOCK` for real-model execution.

## Legacy behavior observation — clean-room isolation

`data/legacy-observations.v1.json` holds closed, validated records for the
isolated CareerPulse / legacy `kalwad/JobApply` baselines (spec §0(16),
§5.13; REQ-GATE-007/008). Current truthful states:

- `CAREERPULSE` — `UNAVAILABLE`: no pinned repository/commit or runnable
  artifact is recorded in project memory; capture requires an owner-supplied
  isolated checkout outside this repository.
- `LEGACY_JOBAPPLY` — `NOT_ATTEMPTED`: one bounded metadata-only GitHub API
  probe (2026-08-07) pinned identity — public repository, default branch
  `main`, head commit `c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd`, license
  `NOASSERTION` — with no clone, no code fetch, no execution, and no source
  viewed. Behavioral capture is deferred to the M02-W13 clean-room harness.

Validation rejects copied source snippets, credentials, missing provenance,
and capture claims without a repository URL, a full lowercase 40-hex Git
commit SHA, fixture digests, an output digest, and bounded plain-language
observations. Mutable refs such as `main`, `master`, `develop`, and `HEAD`,
short SHAs, and uppercase/non-hex revision forms are not immutable source
coordinates. Every non-`CAPTURED` record requires an explicit reason,
`comparable=false`, and empty `fixture_inputs`, `observed_output_digest`,
`structured_observations`, `safety_observations`, and
`regression_fixture_refs`. Structured and safety observation text has a
stricter clean-room plain-language boundary than procedure/provenance prose:
bounded source-shaped declarations, imports/modules, assignments/operators,
delimiters, backticks, arrows, calls, control statements, and snippets fail
closed on each logical line. Reserved words such as `interface`, `type`,
`class`, `enum`, `switch`, and `return` remain valid in ordinary behavioral
prose unless the line has explicit source syntax. Traversal-shaped fixture ids
and time/random-derived identities also fail closed. `code_copied` can never
be true. Clean-room regression fixtures (REQ-GATE-008) may derive only from
future `CAPTURED` observations.

## Development case matrix and literal oracle

`src/dev-cases.ts` commits 34 finite development-only cases (10 overlap,
3 original, 5 stuffing, 4 one-shot résumé, 6 one-shot answer, 6 legacy
validation scenarios) bound to the public synthetic corpus or inline lexical
edges. Expected values live in the test-owned literal oracle
`test/m02-w04/oracles/baseline-truth.v1.json` — derived once from a reviewed
run and spot-verified independently; the implementation never generates or
imports it. This matrix is not a frozen benchmark corpus, threshold set, or
holdout body, and no `benchmark/result.v1` record is emitted.

## Commands

```text
pnpm --filter @japp/evaluation-baselines baselines:check   # read-only drift check
pnpm --filter @japp/evaluation-baselines baselines:write   # explicit manifest authoring
pnpm --filter @japp/evaluation-baselines typecheck
pnpm --filter @japp/evaluation-baselines test              # 171 tests in 9 files
```

`baseline.manifest.json` commits canonical digests over the catalog, both
prompts, the case matrix, the committed observation records, and every file
in `src/`. Check mode recomputes everything read-only and fails on any
drift, so no unversioned default can silently change behavior; committed
JSON must be byte-exactly canonical (sorted keys, duplicate keys rejected).

## Known limitations

- Baselines are deliberately weak: unigram-lexical matching only, ungrounded
  stuffing, unverified one-shot output. They set the floor, not the target.
- No legacy behavior has been captured yet; both committed records are
  truthful non-captured states with exact provenance.
- The one-shot baselines have never run against a real model (no approved
  model lock exists); deterministic fakes exercise the full path in CI.
