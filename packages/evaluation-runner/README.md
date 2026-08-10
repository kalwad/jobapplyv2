# @japp/evaluation-runner

M02-W05 deterministic evaluation infrastructure. This package executes caller-supplied, trusted in-process adapters against versioned benchmark cases; derives threshold and result truth; aggregates raw evidence; compares explicit regression references; and projects one canonical report model to JSON, Markdown, and standalone HTML.

> THIS REPORT HAS NO CRITICAL-GATE AUTHORITY

The runner is evaluation-only measurement infrastructure. It cannot mark a gate PASS, mutate a gate or threshold, accept M02, establish superiority/non-inferiority, or turn incomplete evidence into success. Product packages do not depend on it, and it has no provider, network, extension, form-engine, live employer, model-runtime, or production-prompt dependency.

## Versioned architecture

| Layer                                 |                        Version | Responsibility                                                                                                                               |
| ------------------------------------- | -----------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| execution request                     |                        `1.0.0` | Strict serialized commitments plus versioned benchmark cases; unknown fields reject.                                                         |
| adapter observation                   |                        `1.0.0` | Measurements returned by trusted typed in-process code, never a serialized command/callback.                                                 |
| execution replay witness              |                        `1.0.0` | Authoritative replay source: the canonical validated request plus each case's actual timing window and normalized observation.               |
| execution record                      |                        `1.0.0` | Per-case derived state; can retain a failed-setup record when canonical result v1 cannot truthfully carry zero metrics.                      |
| canonical benchmark result            | existing `benchmark/result.v1` | Issued for complete or partial observations with at least one measured metric; validated structurally and semantically by `@japp/contracts`. |
| aggregate                             |                        `1.0.0` | Raw state, metric, error, holdout, implementation, precision, recall, and zero-tolerance counts plus labeled rates/uncertainty.              |
| regression comparison + source        |                        `1.0.0` | Candidate resolved from the embedding execution through a versioned selector versus one embedded immutable content-addressed reference.      |
| report model / JSON / Markdown / HTML |                        `1.0.0` | JSON (including the replay witness) is machine truth; text formats are deterministic projections, never independent score calculations.      |
| report-bundle manifest                |                        `1.0.0` | Out-of-band SHA-256 and byte counts for JSON, Markdown, and HTML, avoiding a self-referential report digest.                                 |

`src/validate.ts` owns fail-closed request/observation validation; `time.ts` owns contract-authoritative UTC instants and their deterministic proleptic-Gregorian integer projection across the whole 0000–9999 contract year domain (no JavaScript Date API owns timestamp semantics); `thresholds.ts` and `exact-decimal.ts` own immutable threshold truth; `derive.ts` owns the single pure derivation path from replay witness to execution truth (records, identities, canonical result-v1 issuance) used by both live execution and report replay; `runner.ts` owns trusted-context checks and adapter observation capture; `aggregate.ts` and `statistics.ts` own raw summaries and uncertainty; `regression.ts` owns reviewed-reference comparisons and execution-bound candidate resolution; `report.ts` owns projections and authoritative replay verification; and `file-input.ts` provides a bounded regular-file, non-symlink, repository-relative JSON boundary.

These internal formats were revised in place during the M02-W05 correction pass under the repository's normal pre-verification policy: the package has never been VERIFIED and no external consumer exists, and a pre-correction serialized report (which lacks a replay witness) now rejects fail-closed instead of validating on internal consistency alone.

## Existing contract reuse

The package consumes generated `BenchmarkCaseV1`, `BenchmarkResultV1`, runtime metadata, units, comparators, and error-taxonomy types from `@japp/contracts`. Every case passes the generated structural validator and the existing semantic `BENCHMARK_CASE_INTEGRITY` rules. Every issued canonical result passes the generated result validator and `BENCHMARK_RESULT_INTEGRITY` rules. W05 does not fork or weaken those contracts.

Failed setup has no measured metric. Because `benchmark/result.v1` correctly requires at least one `metric_result`, W05 retains that state in the runner's versioned internal execution record and deliberately does not fabricate a canonical result. A partial observation with at least one metric can truthfully issue result v1 with `PARTIAL`, `comparable=false`, and `INVALID`.

## Threshold and numeric semantics

Threshold definitions are committed inside the case and covered by `threshold_set_digest`. The request separately commits the full case digest. Validation rejects duplicate cases, duplicate thresholds, duplicate measured metrics, missing metrics in a complete observation, unexpected metrics, unit mismatches, digest mismatches, mutation during adapter execution, NaN/Infinity, coercion, and unsupported units. The only unexpected-metric policy in runner 1.0.0 is `REJECT`.

Comparators are exact:

- `AT_LEAST`: measured value is greater than or exactly equal to expected value.
- `AT_MOST`: measured value is less than or exactly equal to expected value.
- `EXACT`: measured and expected values are exactly equal.

Units are `BYTES`, `COUNT`, `MILLISECONDS`, `RATIO`, and `SCORE`, and measured/threshold units must match. Numeric comparison does not subtract IEEE-754 values or use an epsilon. Each finite bounded JavaScript number is parsed from its canonical shortest decimal representation into a normalized BigInt coefficient/scale rational, then compared by exact cross-scaling. Thus `0.1 + 0.2` is not silently treated as exact `0.3`, while exact `1`, `0`, ratio boundaries, `0.999999`, and large bounded integers retain deterministic truth. Serialized canonical-decimal input rejects alternate or noncanonical spellings.

## Derived states

Callers cannot supply result outcome, metric pass/fail, completeness, environment/hash state, comparability, or gate state.

- `PASS`: observation is `COMPLETE`; environment and artifact hashes match; holdout state is `VALID` or the reviewed W05 development `NOT_APPLICABLE`; every threshold passes; and no failure error code exists.
- `FAIL`: observation is complete and comparable, but at least one threshold fails or a failure error code exists.
- `INVALID`: observation is `PARTIAL` or `FAILED_SETUP`, or environment/hash/holdout state makes it incomparable.
- `COMPLETE`: adapter supplied exactly one valid measured value for every required metric.
- `PARTIAL`: adapter explicitly identified partial execution and supplied one or more visible metrics; missing metrics, when present, and `BENCHMARK_INCOMPLETE_RUN` remain visible.
- `FAILED_SETUP`: the adapter reported setup failure or threw before measurement. Because setup failure precedes measurement, the raw observation boundary requires empty metrics, empty artifact observations, and empty paired TP/FP/FN counts (`RUNNER_SETUP_PAIRED_COUNT_PAYLOAD`), keeps a visible setup error code, and issues no canonical result v1; aggregation and report replay independently reject any failed-setup record carrying paired statistics.

Environment state derives by comparing case requirements with committed runtime, platform, toolchain, adapter, browser, and model metadata. Hash state derives from observed artifact commitments. A result is comparable only when complete, environment `MATCH`, hash `MATCH`, and holdout state is `VALID` or the reviewed development `NOT_APPLICABLE`. Unknown or mismatched state is never promoted to comparable.

## Aggregation, precision/recall, and uncertainty

Aggregation is over a finite explicit record list and never drops invalid, partial, or failed-setup cases. It reports raw counts for total/completeness/comparability/outcome, environment/hash/holdout states, every failure code, every metric's required/observed/missing/pass/fail counts, zero-tolerance failures, and baseline/implementation groups. Rates always carry numerator and denominator. A `RATIO` observation may additionally declare exact integer `proportion_counts`; the runner verifies that those counts reproduce the measured value and pools their numerators/denominators across cases. Ratio-shaped observations without raw counts remain scalar/non-Bernoulli and are never blindly averaged. Metrics are separated by ID and unit; units never mix.

Paired quality concepts use pooled integer `true_positive`, `false_positive`, and `false_negative` observations. Precision is `TP/(TP+FP)` and recall is `TP/(TP+FN)` and the report always shows both plus all three raw counts. A zero denominator produces an explicit `NOT_APPLICABLE` rate and a no-observations interval; fill-nothing behavior therefore cannot advertise precision while hiding recall.

Comparable Bernoulli proportions use a deterministic two-sided Wilson score interval at fixed 95% confidence (`z = 1.959963984540054`), presented to twelve decimal places with trailing zeroes removed while preserving raw integer numerator/denominator. `n=0` emits `NO_OBSERVATIONS`; `n=1` is labeled `SMALL_SAMPLE_N_1`. Non-Bernoulli metrics, zero-tolerance counts, environment mismatch, and incomparable evidence carry explicit notes instead of fake intervals. Intervals alone never imply better, superior, or non-inferior.

## Regression references

Regression thresholds are separate from critical-gate thresholds. A reference must be explicitly supplied, versioned, immutable, and content-addressed; its digest covers the complete reference payload and is recomputed from the embedded source reference during validation. The runner never selects a “latest” file. Comparison requires identical metric ID/unit, corpus digest, runtime commitment, metric semantics, threshold semantics, implementation identity, prompt digest set, and browser identity/version. An incompatibility produces `comparable=false`, ordered reasons, and `passed=null`.

For a comparable comparison the output includes candidate/reference values and raw counts, exact absolute delta, relative delta only when the reference is nonzero, allowed-regression threshold, comparator result, and both run/reference provenance digests. `HIGHER_IS_BETTER`, `LOWER_IS_BETTER`, and exact-with-absolute-tolerance policies are supported. None is a Gate A threshold.

A report-embedded comparison must carry its complete immutable source: the full reviewed reference and a versioned candidate selector (`CASE_THRESHOLD_METRIC`, `AGGREGATE_PASS_RATE`, `AGGREGATE_POOLED_PROPORTION`, `AGGREGATE_PRECISION`, or `AGGREGATE_RECALL`). The candidate side is resolved from the embedding execution's canonical truth only — value, unit, raw counts, implementation version, derived compatibility (including this runner's versioned metric/threshold semantics commitments), and a `candidate_run_digest` equal to the current execution content digest — so a foreign execution digest, a relabeled `comparable`/`incomparable_reasons`/`passed` state, forged candidate values or raw counts, and unsupported or unresolvable selectors all reject during report replay instead of being trusted from serialized text.

## Provenance and pre-W06 policy

The request/report commits repository commit and tree, runner source digest/version, schema manifest and generator version, every case and threshold set, corpus version/digest, implementation/baseline identity/version/source digest, adapter and clock identity/version, runtime/toolchain digest, OS, architecture, actual prompt digests, and browser/model metadata only when those components actually participated. Serialized repository/schema/corpus/holdout/runtime/implementation claims must exactly match a separately supplied trusted in-process context before any adapter executes; that context is measured by the caller and cannot be serialized as a command or callback. Report artifact SHA-256 commitments live in the bundle manifest. Missing/malformed/mismatched commitments reject; absent browser/model/prompt participation is represented by omission or `NOT_APPLICABLE`, never fabricated metadata.

W06 exclusively owns the real corpus freeze and owner-controlled holdout manifest/body. Before W06, only `PUBLIC_SYNTHETIC` cases with `synthetic_data=true` may use `DEVELOPMENT_NOT_APPLICABLE_V1`. Its fixed reviewed commitment states that the run is public, mutable, development-only, has no hidden case body, and is not Gate A evidence. It cannot masquerade as a W06 manifest or set hidden holdout state `VALID`.

## Reports and safety boundaries

`buildRunReport` computes one canonical model. Canonically sorted UTF-8/LF JSON is the machine truth. Markdown and standalone HTML consume that model and validate/recompute its aggregate against per-case truth before rendering, preventing projection drift. Ordering is stable; hostile title, case, limitation, and provenance text is escaped. HTML has inline static CSS only: no script, analytics, external font/resource, remote URL, hidden content, or unescaped `innerHTML` path.

Set-like adapter observations (metrics, artifact commitments, raw report digests, failure codes, prompt uses, and paired-count groups) are normalized by canonical identity before observation hashing, so irrelevant caller ordering cannot change record/run identities or report bytes. Report replay first re-derives exact threshold truth, completeness, comparability, outcome, mandatory failure codes, participation provenance, and canonical result-v1 correspondence from the serialized projections, and then re-derives the entire report from its embedded replay witness through the same pure derivation path the live execution used: the request digest is recomputed from the witnessed request, every observation digest from the witnessed observations, provenance from the request, and every record/result/execution identity from that recomputed truth. A coordinated projection edit that keeps old digests, a holdout or provenance relabel, an observation change under an old observation identity, or a witness edit under an old request digest therefore rejects; a legitimate semantic source change yields new identities instead. Case timestamps are validated by the canonical common UTC timestamp contract (calendar-correct, including its leap-second control) in both execution and replay, and durations derive deterministically from those contract-valid instants through pure proleptic-Gregorian integer arithmetic that is correct for every contract year 0000–9999 (year 0000 and 0400 are leap; 0100 and 1900 are common). The contract's 23:59:60Z leap-second form projects onto the next minute boundary under the documented leap-table-free Unix-style epoch mapping, and fractional seconds truncate deterministically to milliseconds.

Report limitations are bound by shared constants: at most 32 caller limitations per request plus at most 3 fixed runner limitations, so a maximal development report carries exactly 35 entries and replay recomputes the exact limitation array (fixed entries first) from the witnessed request.

Serialized requests cannot contain gate state/authority, threshold mutation, executable commands, shell text, callbacks, traversal/absolute paths, remote endpoints, credentials, or live employer URLs. File loading accepts only bounded regular nonsymlink files beneath an explicit root, verifies canonical JSON bytes, and rechecks identity around the read.

## Commands

```sh
pnpm --filter @japp/evaluation-runner typecheck
pnpm --filter @japp/evaluation-runner runner:check
pnpm --filter @japp/evaluation-runner test
pnpm exec eslint packages/evaluation-runner
pnpm exec prettier --check packages/evaluation-runner
```

Tests use only finite public synthetic development cases. One integration test invokes a finite W04 subset: original passthrough, keyword-overlap raw counts, explicitly unverified/non-production keyword stuffing, one-shot deterministic fake generation, and unavailable/not-attempted legacy observations that remain partial/incomparable/invalid. It emits no committed execution evidence.

## Scope and limitations

- M02-W06 owns corpus freeze and real holdout artifacts.
- M02-W13 owns the actual autofill harness, field truth, expected values, abstentions, and Simplify worksheet execution.
- M02-W14 owns benchmark execution and evidence production.
- M02-W15 owns the independent Gate A decision.
- W05 implements no extension/product runtime, production model lock/prompt, live site/submission automation, or product UI.
- Development report output is measurement proof only; no generated W05 result is committed as Gate A evidence.
