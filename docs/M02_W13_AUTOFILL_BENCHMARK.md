# M02-W13 autofill benchmark harness

This is evaluation-only infrastructure with no critical-gate authority. W13
validates visible synthetic development inputs. W14 must execute the final frozen
harness on its required partitions; W15 owns fresh independent review and the
Gate A decision. Simplify, real employer sites, submission and automatic
navigation are not executed by this package.

## Contracts and ownership

The harness reuses canonical `BenchmarkCaseV1`, `BenchmarkResultV1`, holdout
manifest v1, the accepted W05 `runEvaluation` runner, its replay witness,
aggregation and JSON/Markdown/HTML report projections. All canonical schema and
generated-contract bytes remain unchanged.

`packages/evaluation-runner/src/autofill.ts` defines strict W13-local oracle,
field observation, independent physical audit and scored artifact payloads. These
are domain input/output artifacts committed through canonical case
`input_artifacts` and result `artifact_report_digests`, not replacement canonical
benchmark case/result schemas. The `urn:japp:schema:evaluation-artifact:w13-*`
references identify these local artifact validators; they are not additions to
the canonical generated contract catalog. Unknown versions, extra/missing keys,
missing provenance, conflicting field inventories or identity/digest/version
mismatches fail closed.

Oracle recipes bind fixture identity, W12 matrix, W06 development corpus,
sanitized profile input, field concept/class/support/required/visibility truth and
expected value digests. They are authored before execution and copied/frozen.
The candidate executor receives fixture HTML and approved synthetic profile
records. It never receives expected classes, expected values or the oracle. A
trusted measurement bridge attaches commitment metadata to its observations;
only the scorer consumes expected truth.

## Scoring

Every oracle field receives exactly one primary class. Independently recorded
physical writes survive claimed abstention, later correction and final-result
cardinality. Precision uses attempted fields as its denominator; recall uses
supported ordinary expected-fill fields. Required recall uses the corresponding
required subset. Expected abstentions, sensitive controls, honeypots and
unsupported cases cannot enlarge the ordinary recall numerator. Safety writes
still count as incorrect attempts and independent safety events.

Each rate includes integer numerator/denominator and a derived rate. A zero
denominator yields `null`, never fabricated perfection. Canonical ratio metrics
carry exact `proportion_counts`; an unavailable required metric yields an
incomplete/failed measurement instead of a percentage. Required unresolved
reporting is a separate count and requires an explicit unresolved record, reason
and committed reporting evidence. A missing/duplicate/conflicting result fails
closed. Success requires matching intended truth, settled persistence and site
acceptance. Reversion, unknown acceptance and site rejection cannot score
success. Wrong options, sensitive/prohibited writes, honeypot writes, duplicate
physical actions, navigation and submission remain separately visible.

The `PhysicalAudit` input is supplied by the trusted observer, not inferred from
candidate final rows. The real MV3 path installs independent DOM event meters;
unit scoring examples supply explicit synthetic physical witnesses. Fixtures
with pre-existing values require reviewed expected-state modeling before their
results can be compared; absent-value abstention is the current local v1
contract. Scorer mechanics are proven permanently by S1–S16 tests.

## Real browser validation and reproduction

`e2e/extension/support/autofill-benchmark.ts` executes the freshly built WXT MV3
extension in persistent bundled Chromium with its actual worker and content
scripts, W08 scanner/live re-resolution, W09 policy, W10 transactions and W11
reconciliation. It uses four declared W12 public recipes, one for each research
family. Authored asynchronous controlled rerenders preserve the DOM's own value
and occur inside the full 75 ms W10 settle window. Fixture IDs/selectors are
measurement joins and physical meters, never action authority. Native labels are
normalized through the actual W08 helper so Unicode fixture labels cannot
silently lose reporting evidence.

Run the development harness:

```sh
pnpm exec playwright test e2e/extension/extension-autofill-harness.spec.ts
```

Playwright attaches the synthetic run bundle. To save it, explicitly set
`JAPP_W13_ARTIFACT_DIRECTORY` to an authorized absolute output directory. There
is no ambient holdout discovery. Each bundle records development labels,
source/build inventories, Git coordinates, an explicit dirty-source state and
fingerprint where applicable, W12 matrix/W06 corpus/case/oracle commitments,
browser/OS/hardware/configuration/timestamps, raw observations, exact scores,
canonical execution/replay/reports, baseline status and worksheets. Ancestor Git
coordinates do not misrepresent an uncommitted candidate as a frozen commit.
The supplemental run manifest independently re-scores the committed raw inputs
and verifies canonical replay before publication.

Development acceptance proves harness mechanics and zero safety events; it does
not require or claim final Gate A accuracy. The measured four-family sample
truthfully reports partially completed required fields and keeps page readiness
NOT_READY. Scanned widget helper nodes outside the authored control inventory
remain visible in raw W11 evidence; they do not define oracle denominators.

## Holdout boundary and baseline isolation

`@japp/evaluation-corpus/autofill-holdout` accepts an explicit authorized root,
canonical sanitized manifest, exact caller-supplied case/artifact byte preimages,
canonical execution request/trusted context and an owner-only trusted adapter
factory. It rejects missing explicit input before invoking W06 verification,
verifies every file/artifact commitment and manifest/candidate/run binding, and
rechecks storage after execution. The trusted factory owns private oracle versus
sanitized candidate separation. It returns only a redacted aggregate with
commitments and counts; it has no logger, raw private report writer or network
upload. Errors return a fixed refusal code. W13 tests use only fresh synthetic
temporary stand-ins. No actual owner input is accessed by W13.

The W04 bridge in `packages/evaluation-runner/test/support/autofill-baseline.ts`
retains the accepted runner boundary: baseline integration remains test-only and
is never imported by its pure runtime. It validates existing legacy observation records, preserves
UNAVAILABLE/NOT_ATTEMPTED/UNRUNNABLE states, and accepts captured field artifacts
only when their input/output digests and provenance match. Captured stand-ins use
the same scorer and sanitized input with the registered baseline identity/version
and `authority: NONE`. A baseline cannot enter the current-product scoring path
or redefine oracle truth. No legacy code, selectors, checkout or executable is
imported or run.

Worksheets contain case/variant/profile/concept/class/value-digest commitments,
our attempted/abstained/persisted/site-accepted result, uncertainty, provenance,
browser/product/version/date and manual slots. All Simplify fields remain
UNOBSERVED/NOT_EXECUTED and comparison UNASSESSED. No competitor outcome is
inferred.

## Finite verification and performance

The original A–N matrix remains closed to speculative expansion: canonical
reuse, oracle separation, scoring, real MV3, reproducibility, development labels,
explicit stand-in holdout, baseline isolation, worksheet, concurrent actions,
capacity/incomplete recovery, total performance, privacy and scope. J/K/L reuse
the original permanent probes. One read-only reviewer operates at a time; no
recursive agents. Original four correction rounds remain historical. Owner
renewal authorizes at most four additional performance architecture rounds;
one has been used. Six mutations M1–M6 remain the required maximum, in disposable
no-hardlink clones after preliminary content review.

The measured hot path was repeated whole-root semantic matching: 65,536 identity
pairs for 128 controls. Rescue round 1 adds a bounded current semantic identity
index guarded by an independent whole-document mutation observer, synchronous
record drains and document/root/route/session/frame/generation bindings. Global
ambiguity and complete `allFieldIds` are preserved. Four live resolutions per
control remain; each re-reads the selected descriptor, options and current state.
Topology, text and identity-affecting attributes invalidate the index, including
external labels and competing roots. Property/CSS-only state is read freshly.
A controlled real-MV3 WebCrypto delay proves mutation during awaited descriptor
construction invalidates obsolete uniqueness without a production test hook.

Permanent 8/32/128 scaling asserts structural work rather than fragile hosted
latency. On the target Mac, the exact original zero-settle 128-control case is
repeated 20 times with:

```sh
JAPP_W13_PERFORMANCE_SAMPLES=20 pnpm exec playwright test e2e/extension/extension-benchmark.spec.ts --grep 'W13 L'
```

This target-only run requires nearest-rank p95 at or below the canonical 1,500 ms
limit, while retaining every required fill, all 512 live re-resolutions and
independent action counts. It is explicitly a lower-bound harness validation,
not the full-settlement W14 performance run or Gate A evidence. Total scanner
microseconds are accumulated and rounded once; W11 local scan time is reported
separately. Raw rescue evidence preserves the original 3.91 s/2.51 s checkpoint
and each measured correction.

Finite evidence correction: the run manifest re-scores each raw observation and
compares the complete score-derived adapter observation after accepted W05
normalization against its canonical replay witness. Worksheet timestamps join
that witness by case ID. W13 accepts only its local v1 oracle/input schema refs
and the AUTOFILL_FEASIBILITY family, with both artifact digests bound to the
immutable oracle and sanitized input. Permanent regressions reproduce the three
previous inconsistencies before their fixes (KI-0073 through KI-0075).

Performance evidence attribution: rescue-state.json retains the exact source
hashes recorded when round1 ran. Three files subsequently changed through
formatting, typed test instrumentation, and exported shared W08 text
normalization used by the measurement-only label join. The20-sample raw run is
a historical architecture checkpoint; its hashes are not relabeled as frozen
content. The corrected development bundle records its own later source
inventory. Frozen canonical passes and exact-SHA hosted/final verification
provide the final content anchor.
