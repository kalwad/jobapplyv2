# Test Evidence

Exact verification commands and summarized results
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1 and §8.6). Newest entries first.

## Update rules

- Every entry records: work-package ID; git commit or working-tree hash;
  operating system and relevant runtime versions; exact commands; exit
  status; test counts; benchmark summaries where applicable; screenshot or
  trace paths where applicable; and known flaky behavior.
- Mandatory tests may not be labeled flaky to avoid fixing them.
- Never record a command as passed unless it was run in the current
  repository state and its result was inspected (spec §1.5).
- Anchoring convention: because a status/evidence update that is itself
  committed cannot contain its own commit hash, entries record the **tree
  hash** (`git rev-parse HEAD^{tree}` equivalent, content-only) as the
  primary anchor plus the containing commit where known. Identical file
  content on any machine reproduces the same tree hash.

## Entry template

```markdown
### <Mxx-Wyy> — <package name> (<ISO date>)
- Revision: tree <hash> / commit <hash or "recorded post-commit">
- Environment: <OS, runtime versions>
- Commands and observed results:
  - `<command>` → exit <code>, <summarized result>
- Test counts: <passed/failed/skipped or n/a>
- Artifacts: <paths or n/a>
- Notes:
```

## Entries

### M02-W01 — Synthetic profile/job/resume fixture foundation, in-progress content proof (2026-07-29)

- Revision: in-progress working tree based on clean starting commit
  `0c8efc9212162bcb4fa846e453007d9404d97429` / tree
  `bc097542a25eddd9cfd39803fed884f71e20d86d`; executable content commit and
  tree pending. M01 remains ACCEPTED at preserved executable tree
  `51c81bedb909ae7b6d54569abc8b8fb13af1c590`.
- Environment: macOS; Node 24.18.0; pnpm 11.17.0; uv 0.11.32; uv-managed
  Python 3.12.13; cargo/rustc 1.97.1 with rustfmt and Clippy; Playwright
  1.62.0 with pinned Chromium.
- Scope: M02-W01 test/evaluation data only. No M02-W02 question/answer data,
  mock ATS form, baseline, runner, frozen corpus, holdout body, extension,
  scanner/resolver/driver, product schema, provider/model, ATS support,
  critical-gate evidence, live employer page, or submission behavior exists.

#### Design and exact development seed

- Dedicated package: `packages/test-fixtures/`. Its eleven closed Draft
  2020-12 schemas are test-only and have no product storage authority:
  `common`, `synthetic-profile`, `evidence-artifact`, `source-resume`,
  `synthetic-job`, `expected-requirement`, `expected-supported-claim`,
  `unsupported-gap`, `field-value-policy`, `scenario-bundle`, and `manifest`,
  each at fixture schema version `1.0.0` with explicit `:v1` test-fixture
  roots. Corpus version `0.1.0` is `DEVELOPMENT_MUTABLE`; it contains no
  holdout content.
- Exact seed: 12 profiles; 72 evidence artifacts (24 employment and 12 each
  credential, education, project, and approved user assertion); 12 bound
  resumes; 24 jobs; 72 anchored requirements; 36 scenarios / 108 complete
  evaluations; 59 supported claims; 49 explicit gaps; and 48 field-value
  policies. The manifest covers nine non-empty collections / 384 records.
- Coverage: all nine role families; EARLY/MID/SENIOR stages; career switch;
  employment gap; nontraditional education; relocation and sponsorship
  constraints; healthcare license; sensitive no-autofill; explicit
  contradictions; one two-page resume with page-bound facts; strongest
  abstention; balanced 8/8/8 remote/hybrid/on-site jobs; direct,
  strong-related, partial, approved-user-asserted, unsupported, and
  contradicted classifications.
- Truth boundary: requirements are source-anchor/hash bound; direct
  experience proves both normalized tag and dated threshold; related and
  partial cases have reviewed semantic rationales; user assertions expose
  one atomic field disclosure only and link the applicable policy.
  Confirmation-gated claims are supported but not release eligible and carry
  a confirmation action; gaps carry no supporting evidence.
- Exact corpus digest:
  `sha256:d91448c44761edeaaceeef032b3fabba6729cd33dd1bb8af879fb4ffbeeb0b2f`.
  Every entity historical hash, every file byte digest/count, the aggregate
  manifest digest, and the manifest historical hash reproduce.

#### Local reconstruction and commands

- `pnpm install --frozen-lockfile`, `uv sync --locked`,
  `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`,
  and `cargo fetch --locked --manifest-path
  packages/contracts/test/contract/rust-harness/Cargo.toml` → exit 0. The
  pnpm lock delta is exactly the reviewed `packages/test-fixtures` importer
  (`@japp/contracts` workspace link plus already-pinned Prettier 3.9.6);
  every other pnpm byte and the uv/Cargo locks remain preserved.
- Direct fixture commands:
  - `pnpm --filter @japp/test-fixtures fixtures:seed:check` → exit 0,
    byte-identical deterministic output with the exact counts above.
  - `pnpm --filter @japp/test-fixtures fixtures:validate` → exit 0, all
    schema, stable-ID, type-safe reference, chronology, evidence,
    classification, page, constraint, release, and hash invariants passed.
  - `pnpm --filter @japp/test-fixtures fixtures:privacy` → exit 0, 25
    producer files / 20,813 text fields; no real-looking PII, secret, local
    identity/path, hidden text, or prompt injection.
  - `pnpm --filter @japp/test-fixtures fixtures:platform-v1` → exit 0, all
    fifteen deprecated-v1/corrected-v2 sibling pairs derived and 25 producer
    files clean.
  - `pnpm --filter @japp/test-fixtures fixtures:discover` → exit 0, nine
    collections / 384 records / 108 evaluations / five focused files /
    exactly 50 tests.
  - `pnpm --filter @japp/test-fixtures exec vitest run test/m02-w01` → exit
    0, 5/5 files and exactly 50/50 tests.
- Canonical local validation:
  - `pnpm generate:contracts --check` → exit 0, all 183 generated files
    byte-identical.
  - `pnpm contracts:compatibility:check` → exit 0,
    `{"additive_changes":[],"compatible":true,"findings":[]}`.
  - `pnpm traceability:generate`, `pnpm traceability:check`, and
    `python3 scripts/validate_status.py` → exit 0; 193 requirements / 300
    work packages and 45 status groups passed.
  - `pnpm run doctor` → exit 0, 22 PASS / one expected dirty-tree warning /
    zero FAIL / one honest NOT_YET_APPLICABLE visual suite; fixture-corpus
    ACTIVE.
  - `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:contract`, `pnpm test:e2e`, `pnpm test:python`, and
    `pnpm test:rust` → exit 0. Focused totals include 662 contract tests, one
    browser smoke test, 677 Python tests, and 11 Rust tests.
  - Final evidence-bearing `pnpm verify` → exit 0; every ACTIVE suite PASS,
    including fixture-corpus with the exact-50 proof; visual remains honestly
    NOT_YET_APPLICABLE. `git diff --check` passed and verification was
    status-neutral.

#### Independent review and bounded M01 audit follow-ups

- The fixture/schema reviewer initially rejected overstated relations,
  source-link gaps, multiplexed assertion release, and backdated review
  metadata. After correction, the reviewer independently reproduced digest
  `d91448c4…b0b2f`, ran seed/validation and 50/50 focused plus 51/51 package
  tests, and at `2026-07-29T09:05:28Z` attested the
  `m02w01-fixture-reviewer` metadata and
  `M02W01_INDEPENDENT_SYNTHETIC_REVIEW` provenance for these exact bytes.
- The privacy/security reviewer initially rejected path/key/extension
  bypasses and unsafe diagnostic pointers. After correction, the reviewer
  independently reproduced both manifest hashes, exact counts, 50/50 tests,
  25-file/20,813-field privacy proof, all fifteen platform pairs, and direct
  POSIX/macOS/Windows/UNC/file/tilde, sensitive-key, unknown-extension,
  symlink, traversal, fragment, masking, and URI false-positive probes with no
  remaining blocker.
- ADR-0004 records deprecated corrected-platform v1 as read-only historical
  compatibility and requires v2 for every new producer. The executable M02
  guard rejects exact, fragmented, value, and JSON-key references without
  rejecting unaffected v1-only roots.
- KI-0033: Gate D guidance now names `evidence-record:v2` and
  `certification-input:v2`; status validation resolves their exact existing
  nondeprecated IDs. Four temporary-copy v1/v999 mutations fail.
- KI-0034/KI-0035: the two Python wrappers retain their existing 300-second
  and 30-second deadlines, use argv-only shell-free concurrent pipe draining,
  cap combined retained output at 1 MiB, and return explicit timeout,
  overflow, undecodable-output, execution, and ordinary nonzero diagnostics.
  No package/test/CI/global timeout increased.

- Artifacts: committed fixture schemas, generator, development data,
  manifest, validators, scanners, and tests under
  `packages/test-fixtures/`; verification registration in
  `scripts/verification-suites.json`; no screenshot/trace because no failure
  occurred.
- Known flaky behavior: none waived; the failed hosted run below remains
  historical evidence and its corrections require a complete fresh lifecycle.
- Pending before verification/closeout: corrective executable content commit;
  two repeated exact clean clones; fresh three-OS content CI with complete
  Windows-log inspection. M02-W01 remains IN_PROGRESS, no package is READY,
  every gate remains NOT_EVALUATED, and release remains NOT_READY.

#### Hosted corrective lifecycle

- First content commit
  `0fd070cbe803600d80702f5be959945a234b1451` / tree
  `e2d0105b1efcb507b51b23e11841194aa9c9887f` passed both exact clean
  clones (`/tmp/japp-m02w01-clones.7fQs34/normal` and
  `/tmp/japp-m02w01-clones.7fQs34/clone with spaces – ü`), including
  frozen/locked setup, both Cargo fetches, clean doctor, direct fixture proof,
  full verification, canonical hash, and clean-tree assertions.
- Fresh hosted run `30439385146` is failed historical evidence, not closeout
  proof. macOS job `90534741118` passed. Ubuntu job `90534741162` exposed a
  nonzero concurrent Rust semantic-matrix build while 2,439 sibling contract
  tests passed. Windows job `90534741237` exposed native CRLF output in the
  new bounded-process helper and a fixed-five-second fixture privacy test
  exceeded only during workspace-wide contention; direct fixture-corpus,
  contract, Rust, portability, traceability, status, and integrity suites
  still passed there.
- The corrective working tree restores universal-newline semantics without
  weakening the byte ceiling, hoists invariant host-identity discovery out of
  the privacy scanner's per-field hot path, and serializes only the fixture
  package's Vitest files to remove newly introduced workspace pressure. No
  timeout, workflow, toolchain, contract, corpus, expected result, or scanner
  rule changes. A new content commit and the complete two-clone/three-OS
  lifecycle are required before closeout.

### M01-W07 post-acceptance corrective lifecycle — KI-0029 through KI-0032 (2026-07-28)

- Starting revision: clean `main` at
  `93541b755dfcd2708c955ada4fdef943b0afaa09`, equal to `origin/main`; tree
  `75512f6d16e50a4560eab7386e6896c81d3ddd0d`. The preserved linear chain was
  `44827ae` → `860b6e1` → `0659c13` → `93541b7`. Canonical specification
  SHA-256 was and remains
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Scope: owner-authorized final M01-W07 correction only. No canonical
  specification, lockfile, toolchain, workflow, M02, product, UI, native
  platform, provider, model, installer, updater, secret-store, or
  native-messaging implementation is authorized or added.

#### Reproductions before correction

- GOV-STATUS-001: the accepted header/table at `93541b7` said M01-W07
  `VERIFIED`, M01 `ACCEPTED`, and M02-W01 sole `READY`, while the same file's
  live blocker section still said KI-0024/KI-0025 were HIGH/IN_PROGRESS and
  M01–M38 were unaccepted. `python3 scripts/validate_status.py` nevertheless
  passed 43 groups because it did not parse that ledger.
- SEM-01: `INSTALL_INTERRUPTED` and `UPDATE_INTERRUPTED` accepted
  `interrupted=true` with `recovery_completed=true`.
- SEM-02: `RUNNING` accepted `GRACEFUL_STOP`; `TERMINATED` accepted a completed
  termination request together with an independent `exit_code`.
- SEM-03: `CERTIFIED_FULL` accepted a self-declared one-kind complete evidence
  policy with no complete browser/runtime/platform bundle.
- SEM-04: an unevaluated browser accepted `MEASURED_NATIVE_RUN`; a degraded
  capability accepted `NOT_EVALUATED`; a certified outer browser accepted a
  merely declared nested capability.
- SEM-05: GET/`NOT_FOUND` accepted `store_availability=UNAVAILABLE`.
- SEM-06: `runtime_availability=NOT_INSTALLED` accepted detected runtime family,
  version, and accelerator identity.
- SEM-07: `UNINSTALLED` accepted `installed_version`, while `REPAIRED` accepted
  its absence.
- Each SEM witness was structurally valid and semantically accepted in the
  generated TypeScript/Python evaluators and the representative Rust harness;
  its required corrected-major verdict is semantic rejection.
- V01: `x-w07.model-runtime-profile-macos-cuda` was structurally and
  semantically valid under the published `44827ae` v1 schema/rule and rejected
  under the invalidated accepted content, even though both remained major 1
  and the compatibility check called the change additive.

The audit claims above were confirmed. The audit's repository mechanics were
also confirmed: exact clean start, canonical hash, linear history,
governance-only stamp diff, and green historical content/final-head CI. Those
historical green runs did not exercise the contradictions and remain evidence
only for their exact revisions.

#### Governance repair

M01-W07 and M01 were reopened; M02/M02-W01 returned to `NOT_STARTED`; no
package is `READY`; M00 remains `ACCEPTED`; all four gates remain
`NOT_EVALUATED`; release remains `NOT_READY`. KI-0029/KI-0030/KI-0031 are
HIGH/IN_PROGRESS and KI-0032 is MEDIUM/IN_PROGRESS until content proof and
hosted CI complete.

`scripts/validate_status.py` now parses every live blocker, resolves it against
`KNOWN_ISSUES.md`, and reconciles severity/state, milestone acceptance,
package state, and next readiness. It requires every CRITICAL/HIGH
OPEN/IN_PROGRESS issue to appear as a live blocker and rejects fixed/deferred/
wont-fix blocker rows. The prior accepted-header/live-blocker contradiction,
including an omitted authoritative blocker combined with accepted M01, is a
permanent negative fixture. Observed focused result:
`python3 scripts/validate_status.py` passed 44 groups and
`uv run pytest -q scripts/tests/test_validate_status.py` passed 144 tests.

#### Historical executable classification

The durable source is
`packages/contracts/test/contract/semantic-witnesses/historical-platform-v1.json`.
It collects expected-valid source corpus cases and explicit positive matrix
rows from immutable Git objects `6708f1a`, `12e4062`, `44827ae`, and `860b6e1`;
historical evaluators annotate acceptance but do not select positives. Ordered
value patches are resolved before recursive canonicalization. The report proves
the relevant evaluator, corpus, values, and matrix bytes at invalidated anchor
`0659c13` are identical to `860b6e1`.

- 556 raw positive references canonicalize to 229 distinct schema/payload
  witnesses across all nineteen v1 roots. Plain insertion-order serialization
  would incorrectly yield 231; the locked collision IDs are
  `x-w07.historical-positive.12940c26b0564f602e366f8d` and
  `x-w07.historical-positive.a9122c6aa5a4dfde7bd17f77`.
- Acceptance-vector counts in revision order
  `6708f1a/12e4062/44827ae/860b6e1` are `1111=208`, `1110=2`, `0011=2`,
  and `0001=17`. The first/last published evaluator union covers all 229.
- Exact 448→0659 old-valid/later-invalid witnesses (`1110`, 2):
  `x-w07.historical-positive.55751f30edf7fe7b29e332f2` and
  `x-w07.historical-positive.d1e3daf65125f4020f73904d` (both
  `installer-state:v1`).
- Exact 448→0659 old-invalid/later-valid witnesses (`0001`, 17):
  `0dad4c67cbbc6a09fc12e861`, `12940c26b0564f602e366f8d`,
  `22a02a644baa57059553a73d`, `3f7811ca9a99cdbb0b1b2db3`,
  `43da14fcc9cded70dece7b2d`, `57f56e25860e1c0983355d41`,
  `6400c3d85af5b3901996041f`, `6656bb50346f784768db42c2`,
  `9819e94bfaceeecbd876b50b`, `a9122c6aa5a4dfde7bd17f77`,
  `ae8bb664c11a026430936e09`, `afd3164d6851ec574d22726e`,
  `b0b13b75f57e001313241b06`, `b531fa6f450e3c388f2e0290`,
  `c69f815d3f57ccd3a56b386c`, `e14aeae231ac60af769cea84`, and
  `fbf656ecdccb9ff324643796`, each with prefix
  `x-w07.historical-positive.` in the inventory.
- Current deprecated v1 accepts all 229, so it removes none from either
  published endpoint. Relative to 448 it retains the 17 later additions;
  relative to 0659 it restores the two earlier acceptances.
- Separately, exact replay of all 242 current v1 platform corpus rows at
  448→0659 is 24 valid→invalid, 9 invalid→valid, 84 valid→valid, and 125
  invalid→invalid. The 9 additions alias 9 of the inventory's 17 additions;
  its other 8 additions and both of its removals are matrix-only. The
  canonical input union of the historical-positive inventory and current-v1
  corpus is therefore exactly 26 removals / 17 additions.
- Canonical inventory digest:
  `6ce50f164c3b58a1062f43bcca7164cd5a4fcee0d93a6f1525a3c54379688fbc`.
  TypeScript, Python, and Rust each executed a separate 229-request bounded
  batch: all 229 verdicts were `VALID` in each language.

The often-confused counts are deliberately separated. The source-positive
inventory is 2 removals / 17 additions at 448→0659; current-v1 corpus is 24/9;
their unique input union is 26/17. The current corpus also has 39
explicit deprecated-v1-valid/corrected-v2-invalid pairs: all 39 were accepted
by first-published `6708f1a`, 24 remained accepted at `44827ae`, and all 39
were rejected by `0659c13`. The original 12 direct corrective cases are
explicit v2-only negative reproductions whose v1-shaped payloads were accepted
at both 448 and 0659; the thirteenth final-sweep case exercises a v2-only typed
inventory cross-binding. None is an old-invalid/current-valid addition.

#### Major-version migration and exact retained/tightened inventory

Fifteen affected v1 roots are deprecated with
`x-japp-deprecated-since: 2.0.0`; fifteen v2 roots and thirty v2 semantic
bindings are version `2.0.0`. Unaffected browser/path/secret request and target
identity roots remain v1. Deprecated v1 dispatch is the first/last published
accepted-set union; corrected v2 dispatch alone carries the normative repair
and is the major future fixtures must select. Generator format is `1.5.0`;
the semantic catalog is `1.1.0` with 110 bindings / 54 kinds, and its schema is
`1.2.0`.

The 39 exact v1-valid/v2-invalid pairs are:

- browser record (2): `browser-record-absent-with-version`,
  `browser-record-available-without-detection`;
- certification (1): `certification-input-architecture-mismatch`;
- diagnostics (1): `diagnostic-report-blocked-with-info-severity`;
- evidence (4): `evidence-record-architecture-mismatch`,
  `evidence-record-declared-plan-success`,
  `evidence-record-hosted-measured-without-runner-image`,
  `evidence-record-success-with-invalid-signature`;
- installer (3): `installer-state-architecture-mismatch`,
  `installer-state-foreign-package-format`,
  `installer-state-terminal-interruption-without-flag`;
- model profile (2): `model-runtime-profile-cpu-with-driver-bound`,
  `model-runtime-profile-macos-cuda`;
- native registration intent (1):
  `native-messaging-registration-without-message-limit`;
- native registration result (4):
  `native-messaging-result-identity-reason-without-state`,
  `native-messaging-result-stale-without-host-version`,
  `native-messaging-result-unevaluated-reason-without-state`,
  `native-messaging-result-unevaluated-with-identity`;
- process plan (8): `process-plan-model-runtime-framed-stderr`,
  `process-plan-native-host-framed-stderr`,
  `process-plan-non-loopback-bind-host`,
  `process-plan-orchestrator-framed-stderr`,
  `process-plan-out-of-range-service-port`,
  `process-plan-privilege-escalation-argument`,
  `process-plan-registration-path-role-environment`,
  `process-plan-suffixed-interpreter-argument`;
- process status (3): `process-status-exited-after-termination-request`,
  `process-status-failed-with-exit-code`,
  `process-status-unexplained-nonzero-exit`;
- runtime capability (3): `runtime-capability-full-ai-with-blocking-reason`,
  `runtime-capability-measured-detection-unevaluated`,
  `runtime-capability-mlx-on-windows-target`;
- secret result (5): `secret-store-result-status-denied-with-available`,
  `secret-store-result-status-denied-without-permission-reason`,
  `secret-store-result-status-unavailable-with-available`,
  `secret-store-result-status-unavailable-without-reason`,
  `secret-store-result-unavailable-with-available-on-get`;
- update (2): `update-state-architecture-mismatch`,
  `update-state-installed-version-mismatch`.

Every ID above has the `x-w07.` prefix for v1 and `.v2` suffix for its
corrected pair. Certification v2 adds the required typed evidence inventory,
so that one pair intentionally has a different input digest.

The 13 direct corrected-major negatives are
`corrective.sem01-install-interrupted-recovery-completed`,
`corrective.sem01-update-interrupted-recovery-completed`,
`corrective.sem02-running-with-termination-request`,
`corrective.sem02-terminated-with-exit-code`,
`corrective.sem03-certified-full-self-declared-inventory`,
`corrective.sem03-certified-support-claim-evidence-mismatch`,
`corrective.sem04-browser-not-evaluated-with-measured-method`,
`corrective.sem04-certified-browser-with-declared-capability`,
`corrective.sem04-degraded-capability-with-not-evaluated-method`,
`corrective.sem05-unavailable-store-reports-not-found`,
`corrective.sem06-not-installed-runtime-with-identity`,
`corrective.sem07-repaired-without-installed-version`, and
`corrective.sem07-uninstalled-with-installed-version`, each with prefix
`x-w07.`. Fifteen `x-w07.round-trip-*.v2` positives cover every migrated root.

#### Corrected v2 truth tables

- Package lifecycle: unresolved interrupted terminal states require
  `interrupted=true` and recovery not completed; a later coherent success may
  retain the recovered historical interruption. All fifteen installer/updater
  states have explicit required/forbidden/equality rules for installed,
  available, target, rollback, artifact, signature, evidence, preservation,
  cleanup, reason, interruption, and recovery fields. The state × interrupted
  × recovery grid is 90 cells / 27 valid.
- Process lifecycle: `STARTING`/`RUNNING` require
  `termination_requested=NONE` and no terminal fields; `TERMINATING` requires a non-NONE request and no terminal
  fields; `EXITED` requires an exit code and no request; `TERMINATED` completes
  a request and has no independent exit code. The state × termination ×
  terminal-field grid is 96/12.
- Certification: exact canonical policies bind `CERTIFIED_CORE` and
  `CERTIFIED_FULL`; v2 carries a typed `artifact_kind`/`evidence_record_ref`
  inventory, and a completed claim's evidence references must exactly match
  the reviewed record inventory. Tier × policy × presence is 24/14.
- Capability/browser: availability/presence and evaluation method are
  bidirectional; certified browser claims require measured nested capability
  evidence. Each availability × method grid is 45/26.
- Secret store: operation, result, and availability jointly bind identity,
  material, digest, and reasons. An unavailable store reports
  `STORE_UNAVAILABLE`, never `NOT_FOUND`. The grid is 288/48.
- Runtime: only reviewed availability states may carry detected identity or
  profiles; `INCOMPATIBLE_VERSION` requires detected
  family/version/accelerator and forbids profiles, while nonexistent/
  unevaluated/unsupported/unavailable states may not carry identity.
  Availability × method × identity × profiles is 180/32.

#### Compatibility, corpus, and subprocess evidence

- Corpus: 511 cases; 505 shared by all three languages, five TypeScript-only,
  and one Python-only, yielding TypeScript 510, Python 506, Rust 505 with one
  inventory slot below the 512 bound; 60 `AUTHORIZE`, 156 `ROUND_TRIP`, 287
  `VALIDATE`, 8 `VERSION_CHECK`; manifest digest
  `230a0a4b7c1874fccad363a72eb342210197b723c1f49d6ff32b7b06f96b9c7b`.
  File hashes are cases
  `0f516f06e2ca3dafd691da1ac77d19df9921e44517e8dcaea589942595929745`,
  raw wire
  `418a4d9d6211edffe76c61d5c9c68ef684a609022fd93e6a1f97a2700248486e`,
  and values
  `d42842b8a8270bdfbffa123476ec32b757bbbcf55a5fc921272e24e7f0180bea`.
- Compatibility format `2.1.0` binds 572 executable semantic witnesses plus
  historical inventory path/count/digest. Before baseline update,
  `pnpm contracts:compatibility:check` returned JSON with exactly
  `compatible=true`, `findings=[]`, and `additive_changes.length=230`: 229
  `SEMANTIC_WITNESS_ADDED` entries plus one
  `HISTORICAL_WITNESS_INVENTORY_ADDED`. Only then the named update command ran;
  two read-only rechecks returned exactly
  `{"additive_changes":[],"compatible":true,"findings":[]}`.
- The mandatory final same-class sweep then reproduced a certified input whose
  canonical required/present kinds and inventory were complete while
  `support_claim.evidence_refs` named an unrelated record. All three
  evaluators accepted it, and the TypeScript-only grids did not expose the
  cross-language gap. The corrected rule now binds the claim references to the
  exact record inventory. All 538 advertised platform/policy cells and all 288
  secret-store cells execute through the bounded real TypeScript, Python, and
  Rust adapters, including canonical semantic error-category/code assertions.
  Before the second named baseline update, the compatibility check reported
  exactly one compatible `SEMANTIC_WITNESS_ADDED` and no finding; two
  post-update read-only checks were empty and identical.
- The loader/update path rejects missing baselines, malformed candidates,
  unsupported languages, fabricated schema/rule majors, metadata or witness
  hashes inconsistent with the immutable historical artifact, and same-major
  acceptance/rejection removal without overwriting the accepted baseline.
- Three generated-test CLI sites now share a shell-free 15-second/1-MiB
  subprocess boundary with stable timeout/output/execution errors. Expected
  nonzero exits remain inspectable; deterministic timeout and nonzero tests
  pass; Windows cleanup retains bounded retries. No package/test/CI timeout was
  increased.

Focused observed results on this corrective working tree:

- `pnpm --dir packages/contracts exec vitest run test/contract/compatibility.test.ts`
  → exit 0, 514/514 tests; TypeScript 510, Python 506, Rust 505, plus
  229/229/229 historical verdicts.
- `pnpm --dir packages/contracts exec vitest run test/schema/w07-platform-rule-matrix.test.ts test/schema/w07-secret-store-truth-table.test.ts test/generated/semantic-rules.test.ts`
  → exit 0, 1396/1396 tests, including 538 + 288 real-adapter parity cells.
- `pnpm --dir packages/contracts exec vitest run test/contract/breaking.test.ts test/contract/historical-witnesses.test.ts`
  → exit 0, 132/132 tests, including the final format-2.1 forgery cases.
- `pnpm --dir packages/contracts exec vitest run test/generated/generator.test.ts test/generated/error-taxonomy.test.ts test/generated/security-policy.test.ts`
  → exit 0, 126/126 tests.
- `pnpm typecheck` → exit 0.

#### Full locked local validation before content commit

- Environment: macOS arm64; Node 24.18.0; pnpm 11.17.0; uv 0.11.32; Python
  3.12.13; cargo/rustc 1.97.1.
- `pnpm install --frozen-lockfile`, `uv sync --locked`,
  `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`, and
  `cargo fetch --locked --manifest-path packages/contracts/test/contract/rust-harness/Cargo.toml`
  → exit 0.
- `pnpm generate:contracts` → exit 0, generated 183 files;
  `pnpm generate:contracts --check` twice → exit 0, 183 files byte-identical.
- `pnpm traceability:generate` and `pnpm traceability:check` → exit 0, 193
  requirements / 300 work packages; `python3 scripts/validate_status.py` →
  exit 0, 44/44 groups.
- `pnpm run doctor` → exit 0, 21 PASS, the expected pre-commit dirty-tree
  warning, and the honest M10-W06 visual `NOT_YET_APPLICABLE` state.
- `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` → exit 0.
- `pnpm test` → exit 0; all nine participating workspace tasks passed,
  including 2440/2440 contract-package tests.
- `pnpm test:contract` → exit 0, 662/662 tests; `pnpm test:e2e` → exit 0,
  1/1 Chromium test and 1/1 discovery listing.
- `pnpm test:python` → exit 0, 667/667 tests; `pnpm test:rust` → exit 0,
  native-host 1/1 and locked/offline compatibility harness 10/10, with fmt,
  Clippy, tests, and builds passing.
- `pnpm verify` twice → exit 0 both times; every active suite passed and the
  visual suite remained honestly `NOT_YET_APPLICABLE`.
- `pnpm contracts:compatibility:check` twice → exit 0 each with exactly
  `{"additive_changes":[],"compatible":true,"findings":[]}`;
  `git diff --check` → exit 0.
- Canonical specification SHA-256 remained
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  The immutable historical file SHA-256 was
  `41d6d41b18495f381f6abb614e3da47f8dc37cb08afbf26e8b7da86bf6eaff6a`;
  the format-2.1 baseline file SHA-256 was
  `70cb11c67e3bf0546df69c991c0e8e82b80db00fa58a767217e7561cf68226b9`.

The final integration sweep also caught and corrected old catalog assertions
that still expected 63 documents, 20 platform documents, semantic catalog
version 1.0.0, and 80 bindings. No test was focused, skipped, or labelled
flaky; verification introduced no untracked generation drift. The exact
content proof is recorded below.

#### Executable content commits and closeout-regression repair

- Semantic content commit
  `12c74a67839061bbb8fa0d5fee9ada591ca1c48c` / tree
  `03baa6dc0ee413d23a34d0c0ef7a0cc54fd3c11b` used the exact message
  `fix: repair final platform state and semantic compatibility gaps` and
  changed 125 files. Exact-commit clones
  `/tmp/japp-m01-w07-clones.r2qKBX/clean clone one` and
  `/tmp/japp-m01-w07-clones.r2qKBX/clöné 二` both passed frozen/locked
  installation, both Cargo fetches, doctor, deterministic generation,
  compatibility, focused matrices, contract, full verification,
  status/traceability, canonical-spec hash, and clean-tree assertions.
- Fresh run **30421961290** at that exact semantic commit passed ubuntu-24.04
  job 90480450265 (4m53s), macos-15 job 90480450326 (5m56s), and
  windows-2025 job 90480450314 (9m04s). The raw Windows log was inspected and
  confirmed exact checkout, pinned toolchains, every active suite,
  verification exit 0, and the clean-tree assertion.
- A first uncommitted attempt to apply the five-file closeout stamp then
  exposed a real lifecycle defect: seven Python validator tests hard-coded
  KI-0029/KI-0030/KI-0031 as live IN_PROGRESS blockers, so the live FIXED
  issue state made those fixtures incoherent. No stamp was committed. All
  five governance files were restored exactly to the semantic content commit
  before executable repair.
- Follow-up content commit
  `c24ccf989726a4870c152a22eec7b6f48e125be8` / tree
  `51c81bedb909ae7b6d54569abc8b8fb13af1c590`, message
  `test: make blocker fixtures independent of closeout state`, changes only
  `scripts/tests/test_validate_status.py` (42 insertions). Blocker tests now
  synthesize their own coherent reopened package revision and issue states
  instead of inheriting the live ledger. Focused validator verification
  passed 144/144 tests; full `pnpm verify` in the reopened state passed
  TypeScript 2440/2440, contract 662/662, Chromium 1/1 plus discovery,
  Python 667/667, native-host Rust 1/1, compatibility Rust 10/10,
  traceability 193 requirements / 300 packages, status 44/44 groups, and all
  other active suites.

#### Final exact-commit clean clones and hosted content proof

Final corrective content is commit
`c24ccf989726a4870c152a22eec7b6f48e125be8` / tree
`51c81bedb909ae7b6d54569abc8b8fb13af1c590`.

- Replacement clone `/tmp/japp-content-proof.1QuY7d/Exact Commit Proof` and
  spaces/non-ASCII clone
  `/tmp/japp-c24ccf-proof.7M8QiU/JAPP clean café` were cloned with
  `--no-local`, checked out at the exact final content commit, and proved the
  same tree. Each used Node 24.18.0 and pnpm 11.17.0; ran
  `pnpm install --frozen-lockfile`, `uv sync --locked`, and both
  `cargo fetch --locked` manifests; reported doctor
  22 PASS / 0 WARNING / 0 FAIL / 1 NOT_YET_APPLICABLE; checked 183 generated
  files byte-identically; returned empty compatibility findings; passed the
  1396-case focused matrices, 662-case contract suite, all active
  verification suites, status 44/44, and traceability 193/300; reproduced the
  canonical specification hash; and ended clean.
- Fresh final-content run **30423199771** passed at exact head
  `c24ccf989726a4870c152a22eec7b6f48e125be8`: ubuntu-24.04 job 90484011903
  in 4m52s, macos-15 job 90484011902 in 5m19s, and windows-2025 job
  90484011874 in 9m25s.
- The complete raw Windows log was inspected. It confirms exact checkout,
  Node 24.18.0 / pnpm 11.17.0, doctor 22/0/0/1 with a clean tree, 183
  generated files byte-identical, TypeScript 2440/2440, contract 662/662,
  Chromium smoke 1/1 plus discovery, Windows-applicable Python 665/665,
  native-host Rust 1/1, compatibility Rust 10/10, adapter applicability
  TypeScript 510 / Python 506 / Rust 505 plus 229 historical verdicts in each
  language, status 44/44, verification exit 0, and the post-verification
  clean-tree assertion. There were no GitHub error markers, focused/flaky
  tests, timeout failures, or nonzero workflow exits.

#### Final corrective closeout

KI-0029, KI-0030, KI-0031, and KI-0032 are FIXED. M01-W07 is VERIFIED and
M01 is ACCEPTED at final content tree
`51c81bedb909ae7b6d54569abc8b8fb13af1c590`; M02-W01 is the sole READY
package, no package is IN_PROGRESS, and no M02 implementation has begun. M00
remains ACCEPTED, all four critical gates remain NOT_EVALUATED, and release
remains NOT_READY. This conventional closeout stamp is limited to the five
authorized governance/evidence files and requires its own exact-HEAD
three-OS CI before the lifecycle is final.

The old KI-0025 statement that its semantic narrowing was “additive” is
historical and invalidated. The old content/stamp trees and CI runs below are
preserved, but they no longer establish current M01-W07 verification or M01
acceptance.

### M01-W07 corrective repair — KI-0025 platform semantic state matrices (2026-07-28)

> Historical record: the post-acceptance KI-0029…KI-0032 audit above
> invalidates this section's additive/versioning conclusion and closeout. The
> commands and old-tree results remain factual for their revisions, but the
> old checker did not protect executable same-major semantics.

- Starting revision: commit `44827ae73a04d4ef63ccb40cd93fd14b7e304010` /
  tree `7fcd961fbde2770378248ca68e65526b4480a970`; clean `main`, equal to
  `origin/main`. Canonical spec SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`, exactly
  one `docs/MASTER_IMPLEMENTATION_SPEC.md`
  (`find . -name '*MASTER_IMPLEMENTATION_SPEC*'` returned that single path).
  Starting-state validation: `python3 scripts/validate_status.py` → exit 0,
  `PASS: all checks passed (43 check groups)`; `pnpm traceability:check` →
  `PASS: traceability validated 193 requirements and 300 work packages`.
- Scope: the owner-authorized final corrective content lifecycle for KI-0025.
  No operating-system implementation, adapter, secret store, process spawn,
  registration, browser detection, model runtime, installer, updater, UI, or
  provider behaviour is added; no schema shape, `required` array, or enum token
  changes; no authority is granted; no lockfile, workflow, toolchain, timeout,
  or M02 file is touched.

#### Independent reproduction before any edit

Each defect was reproduced at the starting revision by loading the canonical
schema catalog and the generated evaluators directly and running structurally
valid payloads through both. `S+`/`S-` is the structural verdict and `M+`/`M-`
the semantic one.

- F1 `platformPackageStateEvidence` — `w07.installer-state` with
  `state = INSTALLED`, `interrupted = true`, `recovery_completed = true`,
  `reason_codes = ["INTERRUPTED"]`, `SIGNATURE_VALID`, `PRESERVED`, one
  evidence reference: `S+ M-`; the same record without the interruption:
  `S+ M+`. The equivalent `w07.update-state` `UPDATE_INSTALLED` record behaved
  identically. Sweeping the full state × interruption grid showed every one of
  the five package success states rejecting `interrupted = true` regardless of
  `recovery_completed`.
- F2 `platformEvidenceIntegrity` — the full `machine_class` ×
  `evaluation_method` grid. `HOSTED_CI_RUNNER` and
  `PHYSICAL_DEVELOPMENT_MACHINE` accepted only `STATIC_INSPECTION` and
  `MEASURED_NATIVE_RUN`; `SYNTHETIC_FIXTURE`, `DECLARED_PLAN`, and
  `NOT_EVALUATED` were `S+ M-` on both.
- F3 `platformRuntimeCapabilityFallback` — every one of the nine
  `capabilityAvailability` states other than `AVAILABLE`, including
  `DEGRADED_LIMITED`, was `S+ M-` with one available profile reference and
  `S+ M+` with none.
- F4 `platformPathResolutionSafety` — `DENIED_PERMISSION` with `exists = true`,
  `writable = false`, `["PERMISSION_DENIED"]`, and no location: `S+ M-`; the
  same record with `exists = false`: `S+ M+`.
- F5 `platformProcessStatusIntegrity` — `EXITED` with `exit_code = 1` and
  `["ADAPTER_ERROR"]`: `S+ M-`; with `exit_code = 1` and no reasons: `S+ M+`.
  An unexplained failure passed while an explained one failed.
- Mandatory `REMOVE`/`PRESENT_VALID` recheck — `operation = REMOVE`,
  `observed_state = PRESENT_VALID`, `changed = false`,
  `idempotent_repeat_safe = false`, `["PERMISSION_DENIED"]`, observed manifest
  digest and host version present: `S+ M-`.
- The exhaustive final audit then reproduced eight further defects of the same
  class, six of them fail-open (`S+ M+` on a payload that asserts something
  untrue): F6 the refused removal above; F7 `platformProcessPlanSafety`
  accepting `cmd.exe`, `powershell.exe`, `pwsh.exe`, `bash.exe`, `sudo`,
  `pkexec`, `doas`, and `runas` as arguments while refusing the bare `cmd` and
  `sh` forms, plus `JAPP_PATH_ROLE = NATIVE_HOST_REGISTRATION`,
  `JAPP_SERVICE_PORT` of `0`, `007`, and `99999`, and
  `JAPP_SERVICE_BIND_HOST = 0.0.0.0`; F8 a registration intent with
  `max_message_bytes` removed; F9 a `CERTIFIED_FULL` capability report whose
  every capability is `AVAILABLE` via `SYNTHETIC_FIXTURE`; F10 an `ACCEPTED`,
  evidence-complete `MACOS_ARM64` profile declaring `NVIDIA_CUDA`, and a
  `CPU_ONLY` profile carrying `minimum_driver_version`; F11 an `AVAILABLE`
  browser presence with `detection_method = NOT_EVALUATED` and a
  `NOT_INSTALLED` presence retaining `detected_version`; F12 a `BLOCKED`
  diagnostic at `INFO` severity; F13 a `CERTIFIED_FULL` certification input
  with `required_evidence_kinds = []` reporting `inventory_complete = true`.
- Cross-language: every reproduction above was re-run against the generated
  Python evaluator and produced the identical verdict on every case. The Rust
  harness was read line by line for all six originally reported rules and
  mirrors the TypeScript control flow exactly.

#### Claims examined and deliberately not acted on

Workflow findings were treated as evidence, not authority; each was
independently re-run before acceptance. Four were rejected and are recorded
here so the decision is auditable rather than silent:

- `platformDiagnosticIntegrity` "PLATFORM_CAPABILITIES is unmapped" — correct
  as committed. The aggregate capability reporter legitimately reports on any
  of the eight families, so the omission is deliberate.
- `platformEvidenceIntegrity` "MEASURED_NATIVE_RUN is impossible for an
  uncertified target" — the owner-stated F2 semantics explicitly require a
  measured run to carry a certified OS/architecture observation, so the
  binding stands.
- `platformProcessStatusIntegrity` "TERMINATED requires an intent, so an
  externally killed child is unreportable" — the F5 repair already gives that
  child a representation as `EXITED` with a non-zero code and a finite reason.
- The accepted-profile/full-AI coupling in `platformModelProfileEvidence` and
  `platformRuntimeCapabilityFallback` — a genuine open question, but a
  model-runtime acceptance-policy decision rather than a contract-shape
  correction. Recorded as **KI-0026** (MEDIUM, DEFERRED) for M05-W13 with its
  exact reproduction; existing reviewed behaviour preserved unchanged.
- The narrow `UNAVAILABLE` process reading is likewise preserved and recorded
  as **KI-0027** (LOW, DEFERRED) for M03-W09 rather than widened here.

#### Repair

Canonical generator source `packages/contracts/generator/semantic-rules.ts`
was repaired first; the TypeScript and Python evaluators follow only from
`pnpm generate:contracts`, and the Rust harness mirrors them intentionally.
Thirteen of the eighteen platform rule kinds changed. Seven schemas took a
description-only **PATCH** bump to `1.0.1` recording the field semantics this
repair decided (`interrupted`/`recovery_completed`, `exists`/`writable`,
`exit_code`/`orphan_detected`, `runner_image_token`/`evaluation_method`,
`available_profile_refs`, `observed_state`). No shape, `required` array, enum
token, rule binding, `rule_version`, or generator format changed.

#### Commands run and observed results

- `pnpm generate:contracts` → `generated 153 files`.
- `pnpm generate:contracts --check` twice → both
  `generated contracts are up to date (153 files, byte-identical)`.
- `pnpm --filter @japp/contracts exec vitest run test/schema` →
  `7 passed (7)`, `Tests 625 passed (625)` including the five new exhaustive
  matrices; `w07-platform-rule-matrix.test.ts` alone runs 462 of them.
- `pnpm contracts:corpus:update-manifest` → `updated M01-W05 corpus manifest`.
- **Historical compatibility classification, run before any baseline write:**
  `pnpm contracts:compatibility:check` reported `"compatible": true`,
  `"findings": []` — zero breaking findings — and exactly ten
  `SUPPORTED_WIRE_CASE_ADDED` entries and nothing else
  (`x-w07.evidence-record-hosted-synthetic-fixture`,
  `x-w07.evidence-record-physical-machine-synthetic-fixture`,
  `x-w07.installer-state-recovered-interruption`,
  `x-w07.native-messaging-result-remove-denied`,
  `x-w07.path-resolution-denied-existing-location`,
  `x-w07.process-plan-loopback-bind-host`,
  `x-w07.process-status-explained-nonzero-exit`,
  `x-w07.process-status-orphan-cleanup-terminal`,
  `x-w07.runtime-capability-degraded-with-profiles`,
  `x-w07.update-state-recovered-interruption`). The seven PATCH schema bumps
  produced no finding, as descriptions are outside the structural signature.
- Only then `pnpm contracts:compatibility:update-baseline` →
  `updated M01-W05 compatibility baseline`; re-check twice →
  `{"additive_changes":[],"compatible":true,"findings":[]}` both times.
- `pnpm --filter @japp/contracts exec vitest run` → `19 passed (19)`,
  `Tests 1470 passed (1470)`.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` → PASS.
- `pnpm run doctor` → `summary: 21 pass, 1 warning, 0 fail,
  1 not-yet-applicable`; `Project-status validation PASS`.
- `pnpm verify` → **exit code 0**; toolchain, format, lint, typecheck, unit-ts,
  contract-gen, contract, e2e-browser, python, rust, portability,
  traceability, status, and integrity all `PASS`; `visual` remains
  `NOT_YET_APPLICABLE` (owned by M10-W06).
- `git diff --check` → clean. `git status --porcelain` over `pnpm-lock.yaml`,
  `uv.lock`, every `Cargo.lock`, `.github/`, `rust-toolchain.toml`, `.nvmrc`,
  `package.json`, and `pyproject.toml` → empty: no lockfile, workflow,
  toolchain, or timeout drift.
- `shasum -a 256 docs/MASTER_IMPLEMENTATION_SPEC.md` → unchanged
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.

#### Post-repair verification of every reproduction

Re-running the identical reproduction payloads against the repaired evaluators:
every F1–F5 unreachable positive is now `S+ M+`, every one of the thirteen
fail-open payloads is now `S+ M-`, and the refused-removal case is `S+ M+`
while the zero-reason `REMOVE`/`PRESENT_VALID` false-success claim stays
`S+ M-`. TypeScript and Python agreed on every case, and the cross-language
  corpus proves agreement on each case's applicable languages (TypeScript 443,
  Python 439, Rust 438), not that every language executes all 444 cases.

#### Corpus

402 → 444 cases; applicability TypeScript 443, Python 439, Rust 438;
operations 60 `AUTHORIZE`, 102 `ROUND_TRIP`, 274 `VALIDATE`, 8
`VERSION_CHECK`. Forty-three cases were added (ten positives, thirty-three
semantic negatives), all applicable to all three languages. One committed
negative, `x-w07.evidence-record-physical-machine-without-measurement`, was
**corrected rather than deleted**: its rationale ("a real machine class cannot
be attached to synthetic-fixture evidence") is precisely the invalid assumption
F2 disproved, so it is replaced by
`x-w07.evidence-record-physical-machine-synthetic-fixture` asserting the
corrected positive plus `x-w07.evidence-record-synthetic-machine-measured-run`
asserting the invariant that genuinely survives. It was an `expected.valid:
false` case and therefore never part of the compatibility `supported_valid_cases`
set, which is why the classification above shows no removal. No assertion was
weakened, no test was skipped or labelled flaky, no timeout was raised, and no
test-only bypass was added. Locked manifest digest
`d00f8eae8ab1bd687f71e54c52278288aec7bfd04499394ee20b86ce34aff12f`.

Two matrix expectations were corrected because the repair disproved their
premise, not to make a build pass: the native-registration matrix's
`REJECTED_REGISTRATION_CELLS` is now empty (all thirty operation/state cells are
reachable) because its representative model keyed reasons by observed state
alone and so never offered an operation-level failure reason, and the
contradiction "a valid registration carries a failure reason" was replaced by
the two identity-evidence contradictions that do still hold. The
platform/architecture coherence matrix now retargets `package_format` alongside
`platform_id`, because a positive representative must be coherent across every
reviewed binding.

#### Final content revision, clean clones, and hosted three-OS proof

Windows repair commit `0659c13ff046c921ca648c50b40e71330abf2e75` /
tree `211c4b72cae4404dc277d8b31df240e4abfc717c` is the final KI-0025 content
revision.

Local: `pnpm verify` exit 0 with every ACTIVE suite PASS;
`pnpm generate:contracts --check` byte-identical; `pnpm
contracts:compatibility:check` `{"additive_changes":[],"compatible":true,
"findings":[]}`; `git diff --check` clean.

Both clean clones were recreated at that exact commit and re-run in full, one
of them under the path
`.../clone β 空 dir/repo` (spaces plus non-ASCII characters). Each ran
`pnpm install --frozen-lockfile`, `uv sync --locked`, both
`cargo fetch --locked` manifests, `pnpm run doctor`
(`22 pass, 0 warning, 0 fail, 1 not-yet-applicable`),
`pnpm generate:contracts --check`
(`generated contracts are up to date (153 files, byte-identical)`),
`pnpm contracts:compatibility:check`
(`{"additive_changes":[],"compatible":true,"findings":[]}`), the focused
matrices (`Tests 625 passed (625)`), the contract suite
(`Tests 570 passed (570)`), `python3 scripts/validate_status.py`
(`PASS: all checks passed (43 check groups)`), `pnpm traceability:check`
(`PASS: traceability validated 193 requirements and 300 work packages`),
`pnpm verify` (`verification exit code: 0`), the canonical spec SHA-256
`3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`, and a
clean-tree assertion. Both passed identically.

Hosted run **30383429134** at `0659c13ff046c921ca648c50b40e71330abf2e75`
succeeded on all three certified targets: macos-15 job 90356653908,
ubuntu-24.04 job 90356653981, and windows-2025 job 90356653998. The Windows
log was inspected: it confirms `Check out exact revision`
`0659c13ff046c921ca648c50b40e71330abf2e75`, the previously failing
`a Rust adapter that does not compile fails the subprocess boundary` now
passing in 7635 ms, `Test Files 19 passed (19)` and `Tests 1470 passed (1470)`,
`contract`/`rust`/`status` suites PASS, `verification exit code: 0`, and the
`Assert verification left no tracked changes` step succeeding.

#### Historical closeout (invalidated by the post-acceptance audit)

M01-W07 is VERIFIED and M01 is ACCEPTED at tree
`211c4b72cae4404dc277d8b31df240e4abfc717c`. KI-0024, KI-0025, and KI-0028 are
FIXED; no CRITICAL or HIGH issue is OPEN (spec §10.1). KI-0022, KI-0026, and
KI-0027 remain DEFERRED with named owning packages. M02-W01 becomes the sole
READY package, no package is IN_PROGRESS, M00 remains ACCEPTED, all four
critical gates remain NOT_EVALUATED, and the release gate remains NOT_READY.
Every historical M01-W07 anchor is preserved, including
`44827ae73a04d4ef63ccb40cd93fd14b7e304010` with run 30341428902 and
`860b6e1e27a790668b7dec4fe8014c9f764106be` with run 30381703907.

#### Hosted three-OS content CI and the Windows defect it exposed

Content commit `860b6e1e27a790668b7dec4fe8014c9f764106be` /
tree `3d608cd0d9d933869f9dc9ecaa7854a77ca727d1` was pushed after both clean
clones passed. Run **30381703907** at that commit passed `macos-15` job
90350860390 and `ubuntu-24.04` job 90350860310 and **failed** `windows-2025`
job 90350860361.

The Windows log was inspected directly rather than retried. The failure is
recorded as **KI-0028**: `test/contract/infrastructure.test.ts > a Rust adapter
that does not compile fails the subprocess boundary` reported
`Error: EPERM, Permission denied: ...\Temp\japp-rust-negative-qqSFs0` at
`infrastructure.test.ts:157`, which is the `rmSync` inside the `finally` block
— the `toThrow(ADAPTER_EXIT_NONZERO)` assertion two lines above had already
passed, and the run reported `Tests 1 failed | 1469 passed (1470)`. Windows
releases a just-exited child's file handles asynchronously, so an immediate
recursive remove of a directory an external toolchain wrote can still hit
`EPERM` even with `force: true`. This is a latent portability defect that
predates the KI-0025 repair; the `cargo build` site is the heaviest external
writer and is the one that fired.

The repair adds Node's documented `maxRetries: 10, retryDelay: 100` to all four
cleanup sites that remove a directory an external child wrote — the one that
fired plus the three carrying the identical latent defect, because repairing
only the reported instance is the mistake KI-0024 and KI-0025 were about. No
assertion was weakened, no test was skipped or labelled flaky, and no timeout
was raised: the 30016 ms the step reported is the real `cargo build` duration
inside an unchanged 45 s budget.

### M01-W07 corrective repair — KI-0024 native-registration reachability and platform invariants (2026-07-28)

- Starting revision: commit `12f3c35be9cff1ca40541212ae83a3e79888a234` /
  tree `e5ab29225eae69aefe007481147815bdd31956e0`; clean `main`, equal to
  `origin/main`. Canonical spec SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`, exactly
  one `docs/MASTER_IMPLEMENTATION_SPEC.md`. Starting-state validation:
  `python3 scripts/validate_status.py` → exit 0, 43 check groups;
  `pnpm traceability:check` → exit 0, 193 requirements / 300 work packages;
  `pnpm generate:contracts --check` → exit 0, 153 files byte-identical;
  `pnpm run doctor` → 22 pass, 0 fail, visual `NOT_YET_APPLICABLE`;
  `pnpm verify` → exit 0, all suites PASS. All historical M01-W07 anchors
  (`db72b0bf…`/`23c26af8…`, `83f3f0d8…`, `12e40628…`/`3fec30f6…`,
  `e56bafc7…`/`33f752cb…`, `aaff21ef…`, `ad2354c3…`, `dd0cd4b6…`/`f7b5bdf4…`,
  `12f3c35b…`) are preserved; no history was amended, reset, or force-pushed.
- Independent reproduction before any edit (own harness, outside the
  repository; TypeScript and Python through the generated evaluators and the
  canonical Ajv catalog; Rust confirmed by source transcription):
  - (A) `native-messaging-result` with `operation=REMOVE`,
    `observed_state=ABSENT`, `browser_family=CHROME`,
    `idempotent_repeat_safe=true`, `reason_codes=[]`, no observed identity →
    structural accept, semantic **reject**, for both `changed=true` and
    `changed=false`. A full 5x6 operation/state sweep showed zero-reason
    success admitted only at `PRESENT_VALID`. Static proof: reaching the
    `REMOVE ? "ABSENT" : "PRESENT_VALID"` ternary with zero reasons implies
    `observed_state === "PRESENT_VALID"`, so the `ABSENT` arm is dead.
  - (B) `process-plan` with `stderr_mode=BINARY_LENGTH_PREFIXED` → structural
    and semantic **accept** on `LOCAL_ORCHESTRATOR`, `MODEL_RUNTIME_HOST`, and
    `NATIVE_MESSAGING_HOST`. The rule's framing array read only `stdin_mode`
    and `stdout_mode` although the schema requires all three channels.
  - (C) `platform_id=MACOS_ARM64` with `architecture=X86_64` (and the
    `WINDOWS_X64`/`UBUNTU_X64` inversions) → structural and semantic
    **accept** on `certification-input`, `evidence-record`, `installer-state`,
    and `update-state`; correctly rejected on `target-identity`, which was the
    only one of the five architecture-bearing roots already bound.
  - (D) Projecting the committed `TRUTH_TABLE` onto the 4x8
    `secretOperation` x `secretResultState` grid covers 11 of 32 cells, and
    `PLATFORM_RULE_TOKEN_CLOSURE` covered 2 of the 18 platform rule kinds —
    both narrower than `packages/contracts/M01-W07.md` claimed.
- Temporary governance: KI-0024 HIGH/IN_PROGRESS; M01-W07 sole IN_PROGRESS;
  M01 reopened IN_PROGRESS; M02 and M02-W01 returned to NOT_STARTED; M00
  remains ACCEPTED; all four gates NOT_EVALUATED; release NOT_READY; next
  READY NONE. `python3 scripts/validate_status.py` and `pnpm traceability:check`
  both re-run to exit 0 immediately after the transition.
- Corrective implementation (canonical generator first; generated TypeScript
  and Python re-emitted from it; Rust mirror updated intentionally):
  - `platformNativeRegistrationResult` rewritten around an explicit
    `REGISTRATION_TERMINAL_STATE` map (`REMOVE`→`ABSENT`, all others
    →`PRESENT_VALID`). Zero reason codes is treated as exactly a success
    claim, admissible only in that terminal state and only with
    `idempotent_repeat_safe === true`. Added biconditional reason/state
    bindings for `IDENTITY_MISMATCH`/`MISMATCHED_IDENTITY` and
    `EVALUATION_NOT_RUN`/`NOT_EVALUATED`, and forbade observed manifest
    identity on `ABSENT` and `NOT_EVALUATED`. No later branch is dead.
  - `platformProcessPlanSafety` now reads all three schema-required stdio
    channels. `NATIVE_MESSAGING_HOST` must frame stdin and stdout and must not
    frame stderr; every other profile may not frame any channel.
  - New shared helper `platformArchitectureCoherent` applied to
    `platformTargetSupportClaim` (replacing its inline copy),
    `platformCertificationInputScope`, `platformEvidenceIntegrity`, and
    `platformPackageStateEvidence`, binding all five architecture-bearing
    roots to the §5.14.1 matrix while leaving uncertifiable targets free.
  - No schema, vocabulary, or generator version changed: the repair is
    evaluator logic plus tests and corpus data only.
- Tests added or changed:
  - New `packages/contracts/test/schema/w07-platform-rule-matrix.test.ts`
    (174 tests): the complete 5x6 registration operation/state matrix from
    reviewed representatives; 14 registration contradiction negatives; the
    process stdio framing matrix across all profiles and all four stdio modes,
    including all 27 unframed combinations per non-native profile; the
    architecture matrix over all five bearing roots (15 coherent accepts, 30
    contradictory rejects); and a durable registry of all 18 platform rule
    kinds asserting catalog completeness, exact root binding, one-to-one root
    coverage, token closure against the structural enums, a passing committed
    representative per rule, and a structurally valid contradiction per rule.
  - `w07-secret-store-truth-table.test.ts` extended with the exhaustive 32-cell
    `secretOperation` x `secretResultState` grid (18 admitted, 14 refused) from
    per-state representatives; all KI-0023 branches and corpus bindings kept;
    the file comment now states the targeted matrix is deliberately not a
    complete grid.
  - Corpus extended additively 382 → 402 cases (20 new: 5 positives, 15
    semantic negatives). Pinned counts updated in `corpus.test.ts` and
    `compatibility.test.ts`. No assertion was weakened, no test skipped, and no
    timeout broadened.
- Commands run and observed results (macOS 15, Apple silicon; Node 24.18.0,
  pnpm 11.17.0, uv 0.11.32, Python 3.12.13, cargo/rustc 1.97.1):
  - `pnpm exec vitest run test/schema/` → 7 files, 337 tests passed.
  - `pnpm contracts:compatibility:check` **before** the baseline write →
    `{"additive_changes":[5 x SUPPORTED_WIRE_CASE_ADDED],"compatible":true,"findings":[]}`.
    Zero breaking findings; the semantic narrowings removed no previously
    supported wire case. Baseline updated only after that classification via
    `pnpm contracts:compatibility:update-baseline`; re-check →
    `{"additive_changes":[],"compatible":true,"findings":[]}`.
  - `pnpm test:contract` → 5 files, 528 tests passed;
    `contract-adapters protocol=1 typescript=401 python=397 rust=396
    rust-build=locked-offline` — all three languages agree on the new cases.
  - `pnpm install --frozen-lockfile`, `uv sync --locked`, and both
    `cargo fetch --locked` → exit 0, no lockfile change.
  - `pnpm generate:contracts` then `pnpm generate:contracts --check` twice →
    `generated contracts are up to date (153 files, byte-identical)`;
    generation is deterministic and verification is read-only.
  - `pnpm traceability:generate`, `pnpm traceability:check`,
    `python3 scripts/validate_status.py` → exit 0.
  - `git diff --check` → clean.
  - `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts,
    contract-gen, contract, e2e-browser, python, rust, portability,
    traceability, status, integrity all PASS; visual `NOT_YET_APPLICABLE`.
- Post-repair reproduction of the same six cases: (A) `REMOVE`/`ABSENT`
  accepts for both `changed` values; (B) `BINARY_LENGTH_PREFIXED` stderr
  rejects on all three profiles while every legitimate stderr mode still
  accepts; (C) zero architecture contradictions accepted across all five
  roots; (D) documentation corrected in `packages/contracts/M01-W07.md`.
- Newly discovered defect, not repaired here: a completeness sweep of all 18
  platform rule kinds found five further unreachable-positive branches of the
  same class, each independently reproduced in this repository state and
  recorded as **KI-0025 (HIGH, OPEN)**. They are outside the owner-scoped
  KI-0024 repair and were deliberately not fixed; per spec §10.1 that keeps
  M01-W07 IN_PROGRESS and M01 unaccepted at this revision, pending an owner
  decision. This entry therefore records a verified content revision, not a
  package closeout.
- Artifacts: none beyond the committed files. No UI, native-platform,
  secret-store implementation, packaging, model-runtime, holdout, or
  certification evidence applies; no operating-system behavior was added.

### M01-W07 corrective repair — KI-0023 secret-store STATUS truth table (2026-07-28)

- Starting revision: tree of commit
  `83f3f0d8add1579b041fe96d9259afc673b7da1a` (first M01-W07/M01 stamp);
  clean `main`, equal to `origin/main`. Historical first content
  `db72b0bff55167c670df4dc78104c08cd6288a07` / tree
  `23c26af81d988bccb11962e6488b3848391f45e9` and stamp `83f3f0d8…` are
  preserved and not rewritten.
- Independent reproduction (before edits), TypeScript + Python:
  - (A) STATUS + `STORE_AVAILABLE` + AVAILABLE + identity + no material/
    reasons → structural reject (enum membership); direct semantic
    evaluator accept.
  - (B) STATUS + `STORE_UNAVAILABLE` + AVAILABLE + empty reasons →
    structural and semantic incorrectly accept.
  - (C) STATUS + `DENIED_PERMISSION` + AVAILABLE + empty reasons →
    structural and semantic incorrectly accept.
  - Rust harness mirrored the same incomplete STATUS early-return.
- Temporary governance: KI-0023 HIGH/IN_PROGRESS; M01-W07 sole
  IN_PROGRESS; M01 reopened IN_PROGRESS; M02-W01 READY removed to
  NOT_STARTED; M00 remains ACCEPTED; all gates NOT_EVALUATED; release
  NOT_READY; next READY NONE.
- Corrective implementation:
  - Added `STORE_AVAILABLE` to vocabulary `$defs.secretResultState`;
    bumped vocabulary and secret-store-result schema versions to
    `1.1.0` (MINOR). Generator format remains `1.4.0`.
  - Rewrote `platformSecretResultIntegrity` STATUS/GET/PUT/DELETE truth
    table in generator TypeScript/Python templates and the Rust harness:
    STATUS success requires `STORE_AVAILABLE`+AVAILABLE+identity+no
    material/reasons; STATUS denial requires PERMISSION_DENIED with
    PERMISSION_REQUIRED|UNAVAILABLE; STATUS/`STORE_UNAVAILABLE` requires
    a non-AVAILABLE/non-DEGRADED/non-PERMISSION_REQUIRED availability and
    at least one reason; `STORE_AVAILABLE` is illegal outside STATUS;
    `STORE_UNAVAILABLE` cannot coexist with AVAILABLE on any operation.
  - Compatibility checker before baseline update:
    `compatible=true`, zero findings, additive
    `ENUM_TOKEN_ADDED`/`SUPPORTED_WIRE_CASE_ADDED` only; baseline updated
    only afterward via `pnpm contracts:compatibility:update-baseline`.
  - Corpus 363 → 382 (TS 381 / Python 377 / Rust 376); locked manifest
    digest `f1aa7a7c373f0e6462ecbd1d29917e03f057ef98b245b0368d5852ba564bb40d`.
  - Added explicit truth-table + token-closure suite
    `packages/contracts/test/schema/w07-secret-store-truth-table.test.ts`.
- Post-repair reproduction: (A) structural+semantic accept; (B) and (C)
  structural may accept shape but semantic rejects.
- Local validation on the corrective working tree (Phase 9):
  - `pnpm install --frozen-lockfile`, `uv sync --locked`, both
    `cargo fetch --locked` → exit 0.
  - `pnpm generate:contracts` and two `--check` runs → 153 files,
    byte-identical.
  - `pnpm traceability:generate` / `check`,
    `python3 scripts/validate_status.py` → exit 0 (43 groups).
  - `pnpm format:check`, `lint`, `typecheck`, `test`, `test:contract`,
    `test:e2e`, `test:python`, `test:rust`, `pnpm verify` → exit 0;
    contract-gen and contract ACTIVE/PASS; visual NOT_YET_APPLICABLE;
    `git diff --check` → exit 0.
  - Focused contract adapters: typescript=381 python=377 rust=376
    (locked-offline).
- Content commit / hosted proof / stamp: recorded after clean clones and
  three-OS green (see follow-up bullets under this heading).
- Repair content revision: tree
  `3fec30f644090aa81b1ce81bd800e92c1628b3c5` / commit
  `12e4062896c8c5b92d5affaf8b0583be0090fb39`.
- Clean-clone reconstructions at that exact commit (two temporary paths,
  one with spaces and Unicode):
  - Each ran frozen/locked installs, both Cargo fetches, doctor,
    generation checks (byte-identical), contract suite, traceability
    generate/check, status validation, full `pnpm verify`, exact
    canonical hash
    `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`,
    and clean-tree assertion → all exit 0.
- Hosted corrective content verification:
  - Run 30326330566 succeeded at the exact repair commit on macos-15 job
    90172431543, ubuntu-24.04 job 90172431557, and windows-2025 job
    90172431467.
  - The actual Windows log was downloaded and inspected. It confirms
    exact checkout `12e4062896c8c5b92d5affaf8b0583be0090fb39`; doctor
    22 PASS / 0 WARNING / 0 FAIL / 1 NOT_YET_APPLICABLE; contract-adapters
    typescript=381 / python=377 / rust=376 (locked-offline); the new
    `w07-secret-store-truth-table` suite (20 tests); generated contracts
    up to date (153 files, byte-identical); verification exit 0; and the
    post-verify tracked-change assertion passed.
- After that hosted success, KI-0023 is FIXED, M01-W07 is VERIFIED at the
  corrective content tree, M01 is ACCEPTED at the same tree, M02-W01 is
  restored as the sole READY package, M00 remains ACCEPTED, all four
  critical gates remain NOT_EVALUATED, and release remains NOT_READY. The
  conventional revision-restamp commit records this closeout; its own
  exact-HEAD three-OS run is required to pass. The first M01-W07 content/
  stamp and failed/green historical runs remain preserved evidence.

- Stamp final-HEAD follow-up (Windows timeout): stamp commit
  `aaff21efafcc36a4cbae5da60522c9a7b10f0a9c` / run 30326806753 failed
  windows-2025 twice (jobs 90173798543 and 90175057168) with Vitest
  `Test timed out in 5000ms` on
  `deleting a schema leaves no stale generated output` (and once on
  `source schema mutations flow through loader, IR, and checker`).
  macos-15 and ubuntu-24.04 passed. KI-0023 content revision
  `12e4062896c8c5b92d5affaf8b0583be0090fb39` itself remained green on
  Windows. Follow-up raises those two tests to a 30s hosted budget without
  changing assertions; M01-W07/M01 reopened until the timeout-budget
  content revision is hosted-green and re-stamped.



- Timeout-budget content revision: tree
  `33f752cba6105fd6fc77b9b16b0737e8ecc0a9d2` / commit
  `e56bafc7a11fb2b4241062ee88ba0d1febcfbbe9`. Raised only the two hosted
  Vitest budgets to 30s; assertions unchanged.
- Clean-clone reconstructions at that exact commit (two temporary paths,
  one with spaces/Unicode) → doctor, generation checks, contract suite,
  traceability, status, full verify, canonical hash, clean tree: all exit 0.
- Hosted timeout-budget content verification: run 30328018710 succeeded on
  macos-15 job 90177340359, ubuntu-24.04 job 90177340373, and windows-2025
  job 90177340392. Windows log inspected: checkout `e56bafc…`;
  `deleting a schema leaves no stale generated output` 4882ms; verification
  exit 0.

- Stamp final-HEAD follow-up #2: stamp `ad2354c335bbfc13568fdd55a8abbcc1ee6ae52c` /
  run 30328497245 failed windows-2025 job 90178685852 with Vitest
  `Test timed out in 5000ms` on
  `cannot weaken FieldAddress multiple-signal identity by removing its
  canonical semantic rule` despite content `e56bafc…` being green on
  Windows. Follow-up sets `@japp/contracts` package-wide `testTimeout`
  30s via `vitest.config.ts` without changing assertions; M01-W07/M01
  reopened until that content revision is hosted-green and re-stamped.

- Package-wide Vitest timeout content revision: tree
  `f7b5bdf4596459f7c9797d124401375bb0df7341` / commit
  `dd0cd4b65976bf2795ccd806d021db8f9c265823` (includes `4ba5fe1`
  `vitest.config.ts`, `b215786` TypeScript project include, and
  `dd0cd4b` Prettier format). Sets package-wide `testTimeout` 30s;
  assertions unchanged.
- Clean-clone reconstructions at that exact commit (two temporary paths,
  `/tmp/m01w07-timeout-clone-a` and `/tmp/m01w07 timeout clone ß-ユニコード`)
  → frozen/locked installs, both Cargo fetches, doctor, generation checks,
  contract suite, traceability generate/check, status validation, full
  `pnpm verify`, exact canonical hash
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`, and
  clean-tree assertion: all exit 0.
- Hosted package-wide timeout content verification: run 30329608764
  succeeded on macos-15 job 90181829582, ubuntu-24.04 job 90181829519, and
  windows-2025 job 90181829581. Windows log inspected: checkout
  `dd0cd4b65976bf2795ccd806d021db8f9c265823`; `w07-secret-store-truth-table`
  (20 tests); `deleting a schema leaves no stale generated output` 4266ms;
  `cannot weaken FieldAddress multiple-signal identity by removing its
  canonical semantic rule` 501ms; contract-adapters typescript=381 /
  python=377 / rust=376; `packages/contracts/vitest.config.ts` present;
  verification exit 0; no `Test timed out` lines; post-verify tracked-change
  assertion passed.
- After that hosted success, KI-0023 remains FIXED, M01-W07 is VERIFIED at
  the package-wide timeout content tree `f7b5bdf4596459f7c9797d124401375bb0df7341`,
  M01 is ACCEPTED at the same tree, M02-W01 is restored as sole READY, M00
  remains ACCEPTED, all gates remain NOT_EVALUATED, release remains
  NOT_READY. Conventional restamp records this closeout.

### M01-W07 — Define cross-platform capability and platform-service contracts (2026-07-28)

- State: VERIFIED. The package is complete and hosted-verified. It claims no
  platform implementation, certified platform support, secret-store or process
  behavior, native-messaging registration, model-runtime capability, packaging
  result, or critical-gate result — none of those exist.
- Revision: tree `23c26af81d988bccb11962e6488b3848391f45e9` / commit
  `db72b0bff55167c670df4dc78104c08cd6288a07` (stamped in the follow-up commit
  per the anchoring convention above). The initial content commit
  `6708f1a463cf1a452fc149b8ac0c93e506828046` at tree
  `b5f342b162d85bf0b9a9f14d8faecacfbb5214cb` failed hosted verification and
  was repaired forward, without force, by `db72b0bf`.
- Environment: macOS 15 (Darwin 27.0.0, Apple silicon), Node 24.18.0,
  pnpm 11.17.0, uv 0.11.32, Python 3.12.13 (uv-managed), cargo/rustc 1.97.1.
- Starting-state proof (run before any edit):
  - `git status --porcelain=v1 -uall` → exit 0, empty (clean tree).
  - `git rev-parse HEAD` and `git rev-parse origin/main` → both
    `08749ca4d0334fcb38ba0828ec1ea193c06ce825`; branch `main`.
  - `find . -type f -name '*MASTER_IMPLEMENTATION_SPEC*'` → exactly one
    tracked canonical file, `docs/MASTER_IMPLEMENTATION_SPEC.md`.
  - `shasum -a 256 docs/MASTER_IMPLEMENTATION_SPEC.md` →
    `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`
    (exact owner-approved v1.4 bytes).
  - `python3 scripts/validate_status.py` → exit 0,
    `PASS: all checks passed (43 check groups)`; M00 ACCEPTED, M00-W11
    VERIFIED at tree `7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91`, M01
    IN_PROGRESS, M01-W01…W06 VERIFIED at their preserved trees, M01-W07 the
    sole READY package, zero IN_PROGRESS, all four gates NOT_EVALUATED,
    release NOT_READY.
  - `pnpm traceability:check` → exit 0,
    `PASS: traceability validated 193 requirements and 300 work packages`.
  - `pnpm generate:contracts --check` → exit 0,
    `generated contracts are up to date (112 files, byte-identical)`.
  - `pnpm run doctor` → exit 0, `22 pass, 0 warning, 0 fail,
    1 not-yet-applicable` (visual NOT_YET_APPLICABLE).
  - `pnpm verify` → exit 0; contract-gen ACTIVE/PASS, contract ACTIVE/PASS,
    visual NOT_YET_APPLICABLE, every other active suite PASS.
  - `gh run view 30316803920` → the final M00-W11 stamp run at
    `08749ca4d0334fcb38ba0828ec1ea193c06ce825` succeeded on macos-15 job
    90143959215, windows-2025 job 90143959244, and ubuntu-24.04 job
    90143959299.
- Contract inventory: 19 strict roots under
  `packages/contracts/schemas/platform/` plus the definitions-only
  `urn:japp:schema:platform:vocabulary:v1`. The canonical catalog grows from
  43 to 63 documents. See `packages/contracts/M01-W07.md` for the exact
  inventory, per-boundary invariants, and explicit non-claims.
- Locked dependency and toolchain commands:
  - `pnpm install --frozen-lockfile` → exit 0, `Already up to date`
    (13 workspace projects; no lockfile change).
  - `uv sync --locked` → exit 0, 21 packages resolved, 19 checked.
  - `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`
    → exit 0, no output (already vendored).
  - `cargo fetch --locked --manifest-path
    packages/contracts/test/contract/rust-harness/Cargo.toml` → exit 0.
- Generation and determinism:
  - `pnpm generate:contracts` → exit 0, `generated 153 files`.
  - `pnpm generate:contracts --check` (run twice) → exit 0 both times,
    `generated contracts are up to date (153 files, byte-identical)`. Two
    independent generations are byte-identical; check mode never touched the
    working tree.
  - `packages/contracts/generated/MANIFEST.json`: generator format `1.4.0`,
    63 schema inputs, 5 validated data inputs, 152 outputs, 256 generated
    type entries.
- Compatibility classification (run **before** any baseline write):
  - `pnpm contracts:compatibility:check` → `"compatible":true`,
    `"findings":[]`, and exactly 18 `ENUM_TOKEN_ADDED`, 20 `SCHEMA_ADDED`,
    38 `SEMANTIC_RULE_ADDED`, 44 `SUPPORTED_WIRE_CASE_ADDED` additive
    changes. An earlier run correctly reported one breaking
    `MINOR_BUMP_REQUIRED` finding for
    `urn:japp:schema:semantic:rule-catalog:v1`; that was resolved by the
    required MINOR bump to `1.1.0`, not by overwriting the baseline.
  - `pnpm contracts:compatibility:update-baseline` → run only after the
    change was proven additive; the follow-up
    `pnpm contracts:compatibility:check` → `{"additive_changes":[],
    "compatible":true,"findings":[]}`. Neither update command runs inside
    `pnpm verify`.
  - `pnpm contracts:corpus:update-manifest` → explicit corpus-manifest write;
    also outside `pnpm verify`.
- Corpus: 199 → 363 sorted synthetic cases; all 199 prior cases and their
  expected verdicts are preserved unchanged. Applicability TypeScript 362 /
  Python 358 / Rust 357; operations 60 AUTHORIZE, 81 ROUND_TRIP,
  214 VALIDATE, 8 VERSION_CHECK. Manifest digest
  `9b2413cff49b853c97a8c385ebbd4fb9645d560396bdbe7969a97dc2f3f5c808`
  (`cases.v1.json` 367007 bytes /
  `f1ace60f714ccb897de9432bf53bc81694c6a310ba1339da627e31a3b4990950`,
  `raw-wire.v1.json` 2235 bytes /
  `418a4d9d6211edffe76c61d5c9c68ef684a609022fd93e6a1f97a2700248486e`,
  `values.v1.json` 59157 bytes /
  `d42842b8a8270bdfbffa123476ec32b757bbbcf55a5fc921272e24e7f0180bea`).
  The 164 new cases are 41 platform positives, 40 structural negatives,
  78 semantic negatives, and 3 additional content-script platform-authority
  denials.
- Focused suites:
  - `pnpm --filter @japp/contracts test` → 17 files, 874 tests passed
    (was 16 files / 637). Includes the new
    `test/schema/w07-platform.test.ts` (35 tests) and the extended
    `test/contract/breaking.test.ts` (70 → 108 tests).
  - `pnpm test:contract` → 5 files, 489 tests passed;
    `contract-adapters protocol=1 typescript=362 python=358 rust=357
    rust-build=locked-offline`. All three real adapters agree on every case.
  - `cargo test --locked --offline --manifest-path
    packages/contracts/test/contract/rust-harness/Cargo.toml` → 10 tests
    passed (was 8), including
    `w07_platform_representatives_round_trip_and_validate` and
    `w07_platform_trust_boundaries_fail_closed`.
  - `cargo clippy --locked --offline --all-targets --all-features -- -D
    warnings` and `cargo fmt --check` on the harness → exit 0.
  - `uv run pytest scripts/tests/test_generated_platform_contracts.py` →
    26 tests passed.
- Aggregate verification:
  - `pnpm format:check`, `pnpm lint`, `pnpm typecheck` → exit 0.
  - `pnpm test` → 9 workspace projects successful.
  - `pnpm test:e2e` → 1 passed. `pnpm test:python` → 649 passed
    (was 621). `pnpm test:rust` → 1 native-host + 10 harness tests passed.
  - `pnpm traceability:generate` and `pnpm traceability:check` → exit 0,
    `PASS: traceability validated 193 requirements and 300 work packages`.
  - `python3 scripts/validate_status.py` → exit 0,
    `PASS: all checks passed (43 check groups)`.
  - `pnpm run doctor` → exit 0, `21 pass, 1 warning, 0 fail,
    1 not-yet-applicable`; the single warning is the expected
    "uncommitted changes present" working-tree state during the package and
    clears at the content commit.
  - `pnpm verify` → exit 0. contract-gen ACTIVE/PASS, contract ACTIVE/PASS,
    visual NOT_YET_APPLICABLE, every other active suite PASS.
  - `git diff --check` → exit 0, no whitespace defects.
- Test counts: TypeScript 874 package + 489 contract; Python 649;
  Rust 1 native-host + 10 harness; cross-language corpus 363 cases
  (TypeScript 362 / Python 358 / Rust 357).
- Hosted content run 30321991197 at
  `6708f1a463cf1a452fc149b8ac0c93e506828046`: macos-15 job 90159601529,
  windows-2025 job 90159601462, and ubuntu-24.04 job 90159601510 all
  **failed**. Both failures were inspected in their raw logs rather than
  assumed, reproduced locally, and repaired at the root cause. Neither was
  transient: each appeared identically on all three operating systems.
  - **Defect 1 — shallow CI checkout cannot reach the historical commit.**
    `scripts/tests/test_v14_migration.py::test_contract_artifact_trees_and_files_remain_exact`
    failed with `git rev-parse
    bde8ad49c31e63a7e09b50ad7cdf9af51416c182:packages/contracts returned
    non-zero exit status 128`. Root cause: `actions/checkout` defaults to
    `fetch-depth: 1`, so the M00-W11 content commit is absent from the CI
    clone. Reproduced locally with `git clone --depth 1`
    (`commits: 1`; the same `fatal:` message) and confirmed resolved by a
    full-depth clone (`commits: 52`; the object resolves to
    `c2bcc5af07d638ae6d1f26ff25021a8453d6ced3`). Repair: `fetch-depth: 0` on
    the CI checkout step. This oracle needs history by construction — it
    asserts a property of a specific past commit — and it would have broken on
    the first contract change after M00-W11 regardless of M01-W07, because it
    previously read `HEAD` and only passed while `HEAD` happened to be the
    migration commit. The alternatives were deleting the oracle, conditionally
    skipping it in CI, or restamping its pinned digests on every contract
    change; all three weaken or void a passing safety test, so the workflow
    change was the minimum honest repair. No verification logic, assertion, or
    CI-only behavior changed, and
    `scripts/tests/test_ci_workflow.py` (41 tests) still passes.
  - **Defect 2 — compatibility-signature test timeout.**
    `packages/contracts/test/contract/breaking.test.ts > M01-W06 semantic
    compatibility signature > builds and parses the current baseline format
    without touching the committed baseline` exceeded Vitest's 5000 ms default
    (5096 ms on ubuntu-24.04, 5341 ms on windows-2025). Root cause: the test
    builds the complete compatibility signature, which M01-W07 grew from 43 to
    63 catalog documents; it measures 1308 ms on the development Mac and
    exceeds five seconds on slower hosted runners. Repair: an explicit 30 s
    budget on that test and on its sibling deterministic-truth test (which was
    already at 15 s and does the same work). No assertion changed and no test
    was skipped, relaxed, or labelled flaky — only the wall-clock allowance now
    matches the work.
  - **Closeout boundary fixtures (same KI-0014/KI-0015/KI-0017/KI-0019
    class).** Accepting M01 makes `M02-W01` READY, which five boundary tests
    inherited instead of stating: they assert "after M00 acceptance, M01-W07
    is the sole READY package". `prepare_m00_closeout` in
    `scripts/tests/test_validate_status.py` now completes its premise through
    a new `reset_downstream` helper that forces every package after
    `M01-W07` and every milestone after `M01` to `NOT_STARTED`, and
    `prepare_valid_m00_closeout` in `scripts/tests/test_traceability.py` does
    the same for its isolated fixture. Zero-padded identifiers make ordinary
    string ordering the exact package order, so both helpers stay correct for
    every later boundary. No assertion was relaxed.
- Repaired content run 30322692883 at
  `db72b0bff55167c670df4dc78104c08cd6288a07`: **macos-15 job 90161665524,
  ubuntu-24.04 job 90161665567, and windows-2025 job 90161665579 all
  succeeded.** The inspected Windows raw log proves: `fetch-depth: 0` checkout
  of exactly `db72b0bff55167c670df4dc78104c08cd6288a07`; locked pnpm/uv/cargo
  fetches; doctor `22 pass, 0 warning, 0 fail, 1 not-yet-applicable`;
  `PASS: all checks passed (43 check groups)`; `two independent generations are
  byte-identical` and `generated contracts are up to date (153 files,
  byte-identical)`; 17 files / 874 package tests; `contract-adapters protocol=1
  typescript=362 python=358 rust=357 rust-build=locked-offline` with 5 files /
  489 contract tests; `647 passed` Python tests (the two POSIX-only cases are
  correctly skipped on Windows); Rust `1 passed` native-host and `10 passed`
  harness; `verification exit code: 0`; and the PowerShell clean-tree
  assertion step completing without emitting porcelain.
- Both exact-commit clean clones were rerun after the repair at
  `db72b0bff55167c670df4dc78104c08cd6288a07` / tree
  `23c26af81d988bccb11962e6488b3848391f45e9`. Each performed a `--no-local`
  clone, detached checkout of the exact commit, `pnpm install
  --frozen-lockfile`, `uv sync --locked`, both `cargo fetch --locked` runs,
  doctor (22 pass, 0 warning, 0 fail), `pnpm generate:contracts --check`
  (153 files byte-identical), traceability generate/check (193/300),
  `python3 scripts/validate_status.py` (43 check groups), `pnpm test:contract`
  (489 tests; TypeScript 362 / Python 358 / Rust 357 locked-offline), full
  `pnpm verify` (exit 0), the exact canonical specification hash
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`, and an
  empty tracked porcelain. The second clone used the path
  `clone b2 — ünïcode ✓/nested dir`, which contains spaces and non-ASCII
  characters. Both clones were removed afterwards.
- Artifacts: none. This package creates no benchmark artifact, evidence
  bundle, screenshot, or certification record.

#### M01 milestone exit gate (independently re-checked at the M01-W07 revision)

Each specification §9 M01 "Required verification" item was traced to an
executed test at this revision rather than asserted:

| Exit-gate item | Proof at `23c26af8` |
| --- | --- |
| Schema generation is reproducible | two `pnpm generate:contracts --check` runs byte-identical (153 files) plus the generator determinism suite |
| Cross-language round-trip corpus passes | 363 corpus cases; TypeScript 362 / Python 358 / Rust 357 agree on every applicable case |
| Invalid privileged messages are rejected | 45 authorization-escalation cases, all DENY |
| Breaking schema changes are detected | 108 breaking-change tests, including 28 new platform mutations |
| Feasibility mode cannot express or request a submit action | `auth.deny.final-submit-feasibility` plus the immutable generator profile ceilings |
| `GUIDED_PRE_SUBMIT` cannot express final submit or protected authentication | `auth.deny.final-submit-guided` returning `SUBMISSION_PROHIBITED_FINAL_ACTION`; no `AUTO_SUBMIT`/`FINAL_SUBMIT` token exists in any bound schema |
| Navigation contracts require generation, proof hash, unique control, postconditions, idempotency | all five members schema-required on `session:navigation-record:v1`; 10 negatives |
| Field addresses reject raw-selector-only identity | `x-w06.field-address-raw-selector-only` plus the `FIELD_ADDRESS_IDENTITY` rule |
| Benchmark and gate result schemas require revision/corpus/runtime metadata | 7 negatives across `benchmark:result:v1`, `gate:evidence-bundle:v1`, and `gate:decision:v1` |
| Platform capability and support-tier contracts round-trip across languages | 19 platform round trips × 3 languages |
| Platform operations use typed allowlists; no arbitrary command, registry, path, or shell payload crosses a trust boundary | 42 structural and 78 semantic platform rejections |

Every root schema is exercised by the wire corpus except the five canonical
*catalog data* documents (`error:catalog`, `security:capability-taxonomy`,
`security:command-taxonomy`, `security:authorization-policy`, and
`semantic:rule-catalog`). Those are not inter-component messages: they are
validated by the strict Ajv catalog at generation time and independently
re-loaded and checked by the Rust harness on every run, so the exit gate's
"all inter-component and critical-feasibility messages" scope is fully covered.

No open defect blocks M01: every `docs/KNOWN_ISSUES.md` entry is FIXED except
KI-0001 (M00 build-task deferral) and KI-0022 (post-M28 familiarity study),
neither of which is an M01 obligation. No ADR was required — nothing in
M01-W07 changed the specification, the selected stack, a trust boundary, the
model lock, an acceptance threshold, a critical-gate status, or a
compatibility claim.

M01 is therefore ACCEPTED at tree
`23c26af81d988bccb11962e6488b3848391f45e9`, and M02-W01 becomes the sole
READY package. All four critical gates remain NOT_EVALUATED and the release
gate remains NOT_READY.
- Notes:
  - Scope decision (Rust): specification §9 `M01-W07` requires
    "TypeScript/Python/**Rust-compatible** contracts", and the reviewed
    traceability entry requires "Generated TypeScript/Python/Rust
    platform-contract round trips". The established, documented mechanism
    for that proof is the private `publish = false`, locked/offline
    test-only harness under
    `packages/contracts/test/contract/rust-harness/`
    (`packages/contracts/README.md` §10d and
    `packages/contracts/M01-W06.md`). `services/native-host` consumes no
    generated contract surface. M01-W07 therefore extends the representative
    test-only Rust proof and deliberately adds no production Rust generator.
  - Scope decision (authority): M01-W04 already declares the four platform
    capability/command categories with empty supported-profile sets and zero
    allow rows. The reviewed M01-W07 mapping requires typed platform
    contracts, not new operation vocabulary, so the capability, command, and
    authorization-policy catalogs are unchanged and all 127 positive allow
    rows plus every existing negative case are preserved. The Rust harness
    re-asserts 24 commands / 127 allow rows / 9 principals / 4 profiles /
    18 capabilities on every run.
  - Generator version: bumped `1.3.0` → `1.4.0` because the built-in finite
    semantic-rule vocabulary grew by eighteen platform rule kinds, so the
    emitted TypeScript and Python evaluator modules contain new
    generator-owned logic rather than only new data rows. No IR construct,
    emitter shape, manifest field, or naming rule changed. Locked by
    `packages/contracts/test/generated/generator.test.ts`.
  - Adapter batch bound: raised 256 → 512 in `adapters/protocol.ts`,
    `adapters/python_adapter.py`, and the Rust harness so the 363-case corpus
    still runs as one deterministic batch per language. The bound's purpose is
    unchanged — an over-cap batch is still rejected, all three adapters
    enforce the same value, and `MAX_PROTOCOL_BYTES` (4 MiB),
    `MAX_RAW_INPUT_BYTES` (1 MiB), and `MAX_JSON_DEPTH` (64) are untouched.
  - Test-oracle re-anchoring (no weakening):
    `scripts/tests/test_v14_migration.py::test_contract_artifact_trees_and_files_remain_exact`
    proves M00-W11 changed no contract artifact. It previously read `HEAD`,
    which M01-W07 legitimately advances. It now reads the same objects at the
    exact M00-W11 content commit `bde8ad49c31e63a7e09b50ad7cdf9af51416c182`,
    where every pinned tree and file digest is byte-identical to the value it
    already asserted, so the historical proof becomes permanent instead of
    being deleted or restamped.
    `scripts/tests/test_validate_status.py::test_current_work_package_must_be_exact_none_or_blocked_id`
    needs a "no IN_PROGRESS row" premise; it now clears every IN_PROGRESS row
    through the new `clear_in_progress` helper instead of naming whichever
    package happened to be active.
  - Requirement honesty: `REQ-PLAT-012` moves `NOT_STARTED` →
    `SCAFFOLD_ONLY` (verification stays `NOT_YET_APPLICABLE`) with real code,
    test, and evidence references. That state is strictly stronger than
    `NOT_STARTED`, which forbids any evidence claim: the validator now
    *requires* those references. The adapter half of the requirement and all
    native per-platform evidence remain future work under `M03-W09`.
    `scripts/traceability.py` records the reviewed v1.4 requirement-hash
    update and its rationale.

### M00-W11 — Adopt and migrate the v1.4 familiarity-first UI and experimental-provider rebaseline (2026-07-27)

- State: IN_PROGRESS. This entry records migration facts as they are proven.
  It does not claim a verified package, owner-approved UI, provider
  implementation, critical-gate result, or hosted M00-W11 success.
- Starting repository proof:
  - branch `main`, clean tree, local HEAD and `origin/main` both
    `211c02e1b9a1f7032a8c0ad387516fc46d9cead4`;
  - prior canonical JAPP-MASTER-001 v1.3 SHA-256
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`
    and size 296,021 bytes;
  - M00 ACCEPTED; M01 IN_PROGRESS; M00-W01…W10 and M01-W01…W06
    VERIFIED at their preserved anchors; M01-W07 sole READY; no package
    IN_PROGRESS; all four gates NOT_EVALUATED; release NOT_READY;
  - inventory exactly 39 milestones / 286 packages / 157 requirements /
    four gates; contract-gen and contract ACTIVE/PASS; visual
    NOT_YET_APPLICABLE;
  - prior final run 30304145833 passed macos-15 job 90104117225,
    ubuntu-24.04 job 90104117255, and windows-2025 job 90104117393.
- Approved external source:
  `/Users/tanishkalwad/Downloads/MASTER_IMPLEMENTATION_SPEC_v1.4_owner_approved.md`.
  It was a regular, non-symlink file, 367,893 bytes, with owner-required
  SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Atomic exact-byte adoption:
  - the external source was rehashed immediately before mutation;
  - bytes were copied to a hidden same-filesystem `docs/` temporary file,
    which independently matched the approved hash and `cmp`;
  - atomic replacement installed the canonical path;
  - the installed file has the same 367,893-byte size and approved hash and
    is byte-identical to the external source;
  - no alternate canonical-looking specification exists under `docs/`.
- Independently reviewed semantic diff:
  - M00–M38 and all four critical gates are unchanged;
  - exactly fourteen packages were added: `M00-W11`, `M03-W11`,
    `M05-W17`, `M08-W07`, `M09-W07`, `M12-W07`, `M17-W11`, `M25-W08`,
    `M27-W13`, `M27-W14`, `M28-W06`, `M33-W07`, `M34-W07`, `M38-W08`;
  - exactly 36 requirements were added: `REQ-UX-001…018` and
    `REQ-AI-001…018`;
  - all 157 prior requirement ID/text/family rows remain exact and ordered;
    their independently locked projection digest is
    `383e244a3cd0b03aa493fe14f9f24768128ca24da3f3346e14eecec2ae13e37e`;
  - exactly eight prior future package descriptions intentionally changed:
    `M03-W01`, `M05-W03`, `M05-W12`, `M17-W01`, `M17-W05`, `M19-W11`,
    `M20-W11`, and `M27-W12`;
  - M27 now executes W01…W11 → W13 → W14 → W12; M28 Gate-D readiness
    binds to the final accepted M27 content revision or an explicit accepted
    independent gate-neutral re-anchoring.
- Governance-only scope:
  - added `docs/UI_FAMILIARITY.md`,
    `docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md`,
    `docs/ui/ANTI_BLOAT_CHECKLIST.md`, and
    `docs/EXPERIMENTAL_AI_PROVIDERS.md`;
  - every visual surface remains NOT_YET_APPLICABLE / NOT_APPROVED and every
    anti-bloat rule remains NOT_EVALUATED;
  - the experimental external provider remains DISABLED_BY_DEFAULT /
    NOT_IMPLEMENTED / NOT_EVALUATED / NOT_SUPPORTED; no endpoint,
    credential, token, model, OAuth flow, egress, or request was added;
  - Ollama remains the mandatory/default future local path and no-silent-
    fallback policy;
  - no UI component, product runtime, browser behavior, platform service,
    provider networking, dependency, or lockfile change is in scope.
  - `.gitattributes` adds one path-scoped `-whitespace` rule because the
    immutable approved specification contains intentional Markdown
    hard-break spaces (52 affected lines); LF checkout remains mandatory
    (`git check-attr` reports `text: auto`, `eol: lf`, `whitespace: unset`
    for that path only) and `git diff --check` continues to enforce every
    other path. Removing the rule reproducibly fails `git diff --check`;
    editing the approved bytes is prohibited.
  - `README.md` is corrected because its reconstruction section still
    asserted the superseded v1.3 `157/286` inventory as current repository
    fact; the counts and the review-layer description now match v1.4.
- Interrupted-session recovery repairs (defects found and fixed in the
  current tree before any commit, each reproduced rather than assumed):
  - `scripts/tests/test_validate_status.py` failed `ruff format --check` on
    the final unvalidated edit; reformatted with no assertion change;
  - `docs/UI_FAMILIARITY.md` coined a product name, which specification
    §0(3) and `CLAUDE.md` prohibit; replaced with a neutral label;
  - `docs/UI_FAMILIARITY.md`, `docs/ui/ANTI_BLOAT_CHECKLIST.md`, and
    `docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md` ended with a blank line,
    which made the mandatory `git diff --check` step fail once the new files
    were visible to the index; normalized to a single trailing newline;
  - the previously drafted focused-test and Python-test counts in this
    entry were stale; they are replaced above with counts observed in this
    repository state.
- Historical preservation: exact status trees, content commits, evidence
  headings/links, reviewed v1.2/v1.3 hashes, existing requirement claims,
  KI-0018/KI-0020/KI-0021 evidence, compatibility records, generated
  contract corpus, and all four gate states remain preserved.
- Specification risk recorded, not silently weakened: M28-W06 calls for
  job-board and queue familiarity tasks whose dedicated UI packages are
  M33-W07/M34-W07. This reproducible future sequencing conflict does not
  authorize early product work or a false M28 result.
- Local validation on macOS 27.0 / Apple silicon, Node 24.18.0, pnpm
  11.17.0, uv 0.11.32, Python 3.12.13, and Rust 1.97.1:
  - frozen/locked reconstruction commands passed: `pnpm install
    --frozen-lockfile`, `uv sync --locked`, and both native-host and
    contract-harness `cargo fetch --locked` commands;
  - `shasum -a 256` returned the approved
    `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`
    for both external and canonical files; portable `cmp -s` passed;
  - focused pytest passed, 432 tests total: v1.4 migration 31, traceability
    62, status validator 126, doctor 50, integrity 17, CI-workflow 41,
    portability 88, and suite-state 17. Negative coverage includes source
    drift/special files/replacement
    failure, byte corruption, inventory duplicates/drift, historical-anchor
    mutation, false UI/provider completion, M27 ordering, M28/Gate-D
    revision mismatch, canonical Unicode/case/content/symlink variants,
    raw C0 bytes, and review-hash self-rehash attempts;
  - two consecutive `pnpm generate:contracts --check` runs passed with 112
    files byte-identical; `pnpm traceability:generate` and
    `pnpm traceability:check` passed with 193 requirements / 300 packages;
    `python3 scripts/validate_status.py` passed 43 check groups;
  - `pnpm run doctor` reported 21 PASS, zero FAIL, one expected
    working-tree WARNING, and visual honestly NOT_YET_APPLICABLE;
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:contract`, `pnpm test:e2e`, `pnpm test:python`, and
    `pnpm test:rust` all passed. Observed counts were 637 TypeScript contract
    package tests, 287 focused contract tests (TypeScript 198 / Python 194 /
    Rust 193 adapters, Rust build locked-offline), one Chromium smoke test,
    621 Python tests, one native-host Rust test, and eight locked/offline Rust
    contract-harness tests;
  - aggregate `pnpm verify` passed every ACTIVE suite; visual remained
    NOT_YET_APPLICABLE rather than a mocked pass. `git diff --check` passed;
    no flaky or skipped mandatory case was recorded.
  - dependency lockfiles and contract artifacts remained byte-identical.
    The `packages/contracts` tree remained
    `c2bcc5af07d638ae6d1f26ff25021a8453d6ced3`; generated/corpus/baseline
    subtrees remained `44faa277a119765b416a3b12d7b1a5b9257968e9`,
    `deb392dcf0bd1163d2ebb46722ba99ad8fdd6e6f`, and
    `6ed399ca9b9fddd16f8c93e0c1980a168feeec72`.
- Exact content commit/tree and two clean-clone reconstructions: content
  commit `a71f3a4c29d10cedc3a8230a6f5b61565ed80319` at tree
  `6a9d50bbfebe6a9f7f042f5e96feca56b0a1d073`. Two independent clean clones of
  that exact commit passed frozen/locked reconstruction, doctor (22 pass, 0
  warning, 0 fail, visual NOT_YET_APPLICABLE), `pnpm generate:contracts
  --check` (112 files byte-identical), traceability generate/check (193/300),
  `python3 scripts/validate_status.py` (43 check groups), the contract suite
  (287 tests; TypeScript 198 / Python 194 / Rust 193, Rust locked-offline),
  full `pnpm verify` (exit 0), the exact canonical hash, and an empty tracked
  porcelain. The second clone used a path containing spaces and non-ASCII
  characters. Neither clone read the external approved-source file; the clone
  contains no reference to it outside the committed ADR and this entry.
- Hosted exact-content run 30313670536 at
  `a71f3a4c29d10cedc3a8230a6f5b61565ed80319`: ubuntu-24.04 job 90134540824
  succeeded; windows-2025 job 90134540814 and macos-15 job 90134540848
  failed. Both failures were inspected in their raw logs rather than assumed:
  - Windows — genuine M00-W11 defect. `uv run mypy` failed with two
    `[attr-defined]` errors at `scripts/tests/test_v14_migration.py:337` and
    `:341`: `os.mkfifo` and `socket.AF_UNIX` do not exist in the Windows
    typeshed stubs. `NON_REGULAR_SOURCE_KINDS` already excluded both cases at
    runtime through `hasattr`, so the suite behaved correctly on Windows, but
    strict static analysis still resolved the POSIX-only attributes. The
    failure was reproduced locally with `uv run mypy --platform win32` before
    any edit. Repaired by narrowing both references behind a `sys.platform !=
    "win32"` guard, which mypy resolves natively; `warn_unreachable` does not
    fire for platform-excluded blocks. No case, assertion, or parameter was
    removed, skipped, or weakened: all six `missing/directory/symlink/device/
    fifo/socket` cases still execute on POSIX, and `mypy --platform`
    win32/linux/darwin now all report success.
  - macOS — transient hosted failure, not an M00-W11 content defect. The
    `unit-ts` suite's first `cargo build --quiet --locked --offline` of the
    contract Rust harness exited nonzero (`ADAPTER_EXIT_NONZERO` raised from
    `buildRustHarness`). The identical build of the identical manifest then
    succeeded twice later in the same job at the same commit: the `contract`
    suite executed the real Rust adapter (`rust=193
    rust-build=locked-offline`) and the `rust` suite passed. Windows
    `unit-ts` passed, Ubuntu passed entirely, the same suite passes locally,
    and M00-W11 changed no file under `packages/`, no lockfile, no
    `rust-toolchain.toml`, and no workflow. The harness runner sets
    `allowStderr` and discards child stderr, so cargo's own diagnostic is not
    recoverable from the log; the exact cause is therefore not claimed.
    Nothing was weakened or retried in code to accommodate it.
- Hosted run 30314449915 at `4314f3100d552e67ebb276c9887183921b263470`:
  macos-15 job 90136934826 and ubuntu-24.04 job 90136934907 succeeded, which
  also confirms the earlier macOS `unit-ts` Rust-harness failure was
  transient. windows-2025 job 90136934806 failed differently and was
  inspected in its raw log:
  - `mypy` passed on Windows (23 source files), confirming the first repair.
    That unblocked `uv run pytest`, which had never reached execution on
    Windows in the previous run because the python suite stopped at mypy.
  - `pnpm verify` then crashed with `TypeError: unsupported operand type(s)
    for +: 'NoneType' and 'str'` at `scripts/verify.py`, preceded by
    `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9 in position
    2661` raised inside a `subprocess` reader thread.
  - Root cause: `run_command` captures child output with `encoding="utf-8",
    errors="strict"` — a deliberate, test-pinned contract — but nothing told
    Python children to *emit* UTF-8. A Windows child falls back to the console
    code page and writes `é` as a single `0xe9`. Windows decodes captured
    output on reader threads, so the strict decode killed the thread,
    `proc.stdout` became `None`, and the concatenation raised, destroying the
    real suite report. The undecodable byte originates in a pytest traceback
    echoing a test source line; the harness crash is what made that
    underlying report unreadable.
  - Repaired in two parts, both reproduced locally before and after the edit:
    `PYTHONIOENCODING=utf-8` is now set for child processes, completing the
    existing strict-decode contract; and an undecodable result now fails
    closed with an explicit diagnostic instead of an opaque `TypeError`.
    Windows drops the stream to `None` while POSIX raises in-thread, so both
    paths are handled and both are covered by new portability tests. The
    strict decode was deliberately kept: nothing was relaxed to
    `errors="replace"`, no test was weakened, and an undecodable command is
    still a failure.
- Hosted run 30315501097 at `ac574f586966ea45c0e68be58c26aee46e8593ef`:
  macos-15 and ubuntu-24.04 succeeded; windows-2025 job 90140052886 failed,
  and for the first time reported its cause legibly rather than crashing.
  The UTF-8 repair worked exactly as intended — every other Windows suite
  passed and the python suite produced a real pytest `FAILURES` section:
  - `test_atomic_adoption_rejects_any_byte_corruption[crlf-normalization]`
    failed with `DID NOT RAISE AdoptionError`; the CRLF-corrupted source read
    back byte-identical to its LF original.
  - `test_atomic_adoption_installs_exact_bytes` failed with `approved source
    hash mismatch before mutation` on `b"exact\r\nbytes \xf0\x9f\x98\x80\n"`.
  - Root cause, and the most material defect found in this package:
    `_read_regular_file` opened the approved source with
    `os.open(path, os.O_RDONLY)`. On Windows `os.open` defaults to text mode
    and silently translates CRLF to LF on read. The exact-byte adoption model
    therefore corrupted the exact bytes it exists to protect: on Windows it
    would have accepted a CRLF-normalized source as identical to its LF
    original, and would have mis-hashed any specification containing CRLF.
    This is exactly the corruption class the adoption contract must reject,
    so the two tests were correct and the helper was wrong.
  - Repaired by adding `os.O_BINARY` on Windows, narrowed by `sys.platform`
    so POSIX behavior and static analysis are unchanged. No test, assertion,
    or parameter was weakened; the fix makes the previously failing cases
    genuinely pass. A repository-wide scan confirmed this was the only
    text-mode file hazard in the changed code.
  - Sequencing note recorded honestly: this defect was reachable only after
    the mypy repair let Windows run pytest at all, and diagnosable only after
    the UTF-8 repair stopped the harness from destroying its own report. Each
    hosted failure exposed the next; none was assumed or retried blindly.
- Final content revision and hosted three-OS proof: content commit
  `bde8ad49c31e63a7e09b50ad7cdf9af51416c182` at tree
  `7a2a02cad4bbd8c4dc2a8106b1595860f9b78d91`. Both exact-commit clean clones
  were re-run at this commit — one at a path containing spaces and non-ASCII
  characters — and both completed frozen/locked reconstruction, doctor
  (22 pass, 0 warning, 0 fail), `pnpm generate:contracts --check`
  (112 files byte-identical), traceability generate/check (193/300),
  `validate_status.py` (43 check groups), the 287-test contract suite, full
  `pnpm verify` (exit 0), the exact canonical hash, and an empty tracked
  porcelain. Run 30316263598 then passed every required platform:
  - macos-15 job 90142343725 — success;
  - ubuntu-24.04 job 90142343632 — success;
  - windows-2025 job 90142343630 — success.
  The Windows log was inspected directly and proves the exact checkout of
  `bde8ad49c31e63a7e09b50ad7cdf9af51416c182`, locked pnpm/uv/Cargo
  installation, doctor 22 pass / 0 warning / 0 fail with visual honestly
  NOT_YET_APPLICABLE, 43 status check groups, 112 byte-identical generated
  contracts, 637 package tests, 287 focused contract tests
  (TypeScript 198 / Python 194 / Rust 193, Rust locked/offline), 621 Python
  tests, 1 native-host and 8 contract-harness Rust tests, `verification exit
  code: 0`, and a successful "Assert verification left no tracked changes"
  step. The Windows Python count is 621 rather than the local 623 because
  `NON_REGULAR_SOURCE_KINDS` correctly excludes the POSIX-only FIFO and
  Unix-socket cases on Windows.
- Hosted-repair history for this package, in order, each root-caused from its
  raw log rather than retried: run 30313670536 (`a71f3a4c`) — Ubuntu passed,
  Windows failed on Windows-only mypy `[attr-defined]` errors, macOS failed
  transiently in the `unit-ts` Rust-harness build; run 30314449915
  (`4314f310`) — macOS and Ubuntu passed, confirming the macOS failure was
  transient, and Windows reached pytest for the first time and crashed the
  harness on undecodable child output; run 30315501097 (`ac574f58`) — macOS
  and Ubuntu passed and Windows reported the real CRLF text-mode defect
  legibly; run 30316263598 (`bde8ad49`) — all three platforms passed. Each
  defect was only reachable after the previous repair. No test was weakened,
  skipped, or removed at any step, and the strict UTF-8 decode contract was
  preserved rather than relaxed.
- Closeout state: M00-W11 is VERIFIED at the content tree/commit above, M00 is
  re-ACCEPTED under v1.4, M01 remains IN_PROGRESS with M01-W01 through
  M01-W06 preserved at their exact anchors, M01-W07 is the sole READY
  package, no package is IN_PROGRESS, all four critical gates remain
  NOT_EVALUATED, and the release gate remains NOT_READY. M01-W07 was not
  begun.
- Final stamp revision and exact-final-HEAD hosted proof: recorded in the
  closeout stamp commit; see the M00-W11 closeout entry below once the final
  HEAD run completes.
- Closeout stamp and exact-final-HEAD hosted proof: pending; no result claimed
  yet.

### M01-W06 — Define feasibility and benchmark contracts (2026-07-27)

- Revision: content tree `6ed03405b8e252a583f6f89709722e1bd680d8de`
  / commit `13231f34ac276695852eb54e375aacfd6d2d4029`. Bootstrap ran at starting
  commit `4bfe9f60e37957a7292f4d545bfa0734f9757d00` (clean `main`, equal to
  `origin/main`).
- Environment: macOS 27.0 (Apple silicon); Node 24.18.0; pnpm 11.17.0; uv
  0.11.32; uv-managed Python 3.12.13; cargo/rustc 1.97.1; Pydantic 2.12.5;
  Playwright 1.62.0 with pinned Chromium.
- Bootstrap: clean `main`, `HEAD == origin/main ==
  4bfe9f60e37957a7292f4d545bfa0734f9757d00`; M00 ACCEPTED, M01
  IN_PROGRESS, M01-W01…W05 VERIFIED, M01-W06 sole READY, later packages
  NOT_STARTED, all gates NOT_EVALUATED, release NOT_READY, and traceability
  exactly 157 requirements / 286 packages. Final M01-W05 run 30262892902
  passed Ubuntu job 89966710857, macOS job 89966710899, and Windows job
  89966710918. Status, traceability, generated drift, doctor, full verify,
  the requested M01-W05 diff, mandatory sources, and the unchanged
  fail-closed native-host scaffold were inspected before M01-W06 alone became
  IN_PROGRESS.
- Canonical contracts: 21 strict Draft 2020-12 root schemas across form (5),
  ATS (1), Workday (3), session (4), benchmark (3), gate (2), resume (2), and
  rendering (1), plus bounded shared contract-text primitives and the
  semantic-rule-catalog schema. All roots are closed, versioned, path-ID
  exact, bounded, local-reference-only, default-free, and prohibit executable,
  secret, raw-selector, HTML, and arbitrary-path vocabulary.
- Semantic architecture: JSON Schema remains structural truth. The validated
  `semantic-rules.v1.json` contains 42 sorted exact-schema bindings over a
  closed 22-kind finite vocabulary: one family invariant and one inert-text
  rule per root. The generator rejects expression languages, unknown/rebound
  schema vocabulary, raw selector/script/HTML/credential/key tokens,
  AUTO_SUBMIT, and FINAL_SUBMIT before emitting identical finite TypeScript
  and Python evaluators. Structural validation runs before semantic
  validation in both real adapters; the Rust harness checks the same bindings
  and representative outcomes without becoming production code.
- Safety coverage: multiple independent FieldAddress/Workday-step signals;
  resolution hints without authority; bounded untrusted FieldDescriptor text;
  evidence/policy/confirmation-gated field decisions; verified-fill
  persistence/site/generation proof; exact reconciliation counts and blocker
  readiness; proof/idempotency/postcondition-bound navigation; protected-step
  pauses and unsafe-uncertain retry rejection; guided pre-submit start
  prerequisites with no submit authority; exact measured certification scope;
  immutable benchmark thresholds and complete/matching/comparable PASS;
  body-free deterministic holdout manifests; complete independent gate
  evidence and reviewed decisions; evidence-bounded resume claims; and layout
  acceptance blocked independently by overflow, clipping, extraction, fonts,
  or renderer failure.
- Generation: format `1.2.0` → `1.3.0` because validated semantic-catalog
  provenance and generated semantic modules change the generated format.
  Manifest inventory is 43 schema inputs, five data inputs, 111 generated
  outputs, and 177 type entries. TypeScript and Python are generator-owned;
  no handwritten per-language model and no production Rust surface exists.
- Corpus: explicit reviewed expansion from 113 to 199 sorted synthetic cases;
  language applicability TypeScript 198, Python 194, Rust 193; operations 57
  AUTHORIZE / 40 ROUND_TRIP / 94 VALIDATE / 8 VERSION_CHECK. Manifest digest
  `216cbfd2ad23e8bfe932e952487d37a8cdd50212fcb7fcfb0d135231f1e42016`;
  files `cases.v1.json` 187954 bytes /
  `dd1ee13b369618ab0d4847be794e2263f18ec85d83bc2c83ab4ae6ea059d7501`,
  `raw-wire.v1.json` 2235 bytes /
  `418a4d9d6211edffe76c61d5c9c68ef684a609022fd93e6a1f97a2700248486e`,
  and `values.v1.json` 40005 bytes /
  `66f4fe308f4e1b9ad60ea66b437d2a7514b4b58a8cf4893c0f77e2af9f55aec8`.
  Representative positive and negative cases cover every W06 family and all
  critical cross-field invariants while preserving all M01-W05 hostile-wire,
  authorization, infrastructure, and KI regressions.
- Compatibility baseline: explicitly updated only after additive schema,
  generated, and cross-language review. The signature includes the new roots,
  semantic catalog digest, and exact rule bindings. Read-only mutation tests
  reject W06 root/required/type/enum/evidence removal, identity/readiness/PASS
  weakening, raw-selector/script/submission vocabulary, semantic removal or
  rebind, and valid-case removal; compatible additive schema/optional-field
  behavior remains accepted. Normal verification cannot update the corpus
  manifest or baseline.
- Scope/traceability: only `REQ-GATE-006` lists M01-W06 as an owner. It remains
  honestly SCAFFOLD_ONLY / NOT_YET_APPLICABLE: this package defines bounded
  benchmark/holdout/gate evidence records but executes no gate, produces no
  measured artifact or manual scorer decision, and leaves future execution
  to M02-W05, M05-W05, and M20-W09. The preserved v1.2 requirement and
  package-dependency hashes are unchanged; the expanded v1.3 mapping pin was
  intentionally updated for the W06 evidence anchors and notes. All four
  actual gates remain NOT_EVALUATED; visual evidence remains
  NOT_YET_APPLICABLE.
- Known issues: five pre-closeout regressions discovered by the complete
  verification/audit pass
  were fixed in this revision: the generated Python semantic module now
  carries the mandatory reconstruction command, and isolated governance test
  fixtures now carry/reset the M01-W06 evidence paths/state, while the Python
  generator rejects every reviewed Pydantic/ContractModel member collision
  and protected namespace prefix without banning safe W06 `model_*` fields.
  The explicit structural-baseline update now owns and tests its exact
  deterministic serialization, so generic formatting cannot make its update
  command dirty a clean checkout. The intentionally heavy double-build
  compatibility proof has a 15-second case bound after hosted Ubuntu took
  5.903 seconds and hosted Windows took 6.215 seconds under the full parallel
  package load, exceeding Vitest's generic 5-second default; its assertions
  and fail-closed behavior are unchanged. No reproducible open defect was
  added to `docs/KNOWN_ISSUES.md`.

#### M01-W06 local verification

- Frozen reconstruction: `pnpm install --frozen-lockfile`; `uv sync --locked`;
  `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`; and
  `cargo fetch --locked --manifest-path
  packages/contracts/test/contract/rust-harness/Cargo.toml` → exit 0.
- Deterministic generation/provenance: `pnpm generate:contracts`; two
  consecutive `pnpm generate:contracts --check` runs → 112 files
  byte-identical. Explicit corpus-manifest update stabilized byte-for-byte;
  explicit compatibility-baseline update produced format `1.1.0`, integrity
  digest `417cf44b110dd74fe17b2e41bd9c1322f089cd16e07b44740097dcf36d4f72e2`;
  `pnpm contracts:compatibility:check` → compatible, zero findings/additions.
  Normal verification did not update either reviewed artifact.
- Focused TypeScript/contract: `pnpm --filter @japp/contracts test` → 16
  files / 637 passed, including 70 breaking/additive mutation cases, five
  W06 schema tests, five semantic generator/runtime tests, all M01-W01…W05
  regressions, rollback/control-byte cases, infrastructure negatives, and
  the complete corpus. `pnpm test:contract` → ACTIVE/PASS, 5 files / 287
  passed, protocol 1 proof `typescript=198 python=194 rust=193
  rust-build=locked-offline`.
- Focused Python: generated/semantic/adapter/security tests → 181 passed;
  strict generated-package/adapter mypy → 62 source files with no issues.
  Full `pnpm test:python` → ACTIVE/PASS, 547 passed; Ruff check/format and
  repository mypy passed.
- Focused Rust harness: fmt; locked/offline clippy with `-D warnings`; build;
  and test → exit 0, 8 passed. `pnpm test:rust` → ACTIVE/PASS: unchanged
  native-host scaffold 1 passed plus harness 8 passed; no Rust path skipped.
- Repository gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`, `pnpm test:contract`, `pnpm test:e2e`, `pnpm test:python`,
  and `pnpm test:rust` → exit 0. Browser smoke ran 1 controlled Chromium
  test. TypeScript unit execution ran nine package tasks; contracts alone
  ran 637 tests.
- Governance: `pnpm traceability:generate`; `pnpm traceability:check` → 157
  requirements / 286 packages; `python3 scripts/validate_status.py` → 36
  groups passed. `pnpm run doctor` → 21 PASS / expected dirty-tree WARNING /
  0 FAIL / visual alone honestly NOT_YET_APPLICABLE.
- Aggregate: `pnpm verify` → exit 0; contract-gen and contract ACTIVE/PASS;
  all other active suites PASS; visual alone NOT_YET_APPLICABLE; 637
  contract-package tests, 287 focused contract tests, 547 Python tests, 1
  browser test, 1 native-host test, and 8 locked/offline Rust-harness tests;
  real adapters ran in all three languages.
- Scope: `git diff -- services/native-host` remains empty. No benchmark,
  hidden holdout body, gate evaluation, Workday certification, browser/form
  action, render, model run, platform service, or M01-W07 implementation was
  introduced. Clean-clone and hosted evidence are recorded below.

#### M01-W06 exact clean-clone verification

- A fresh `git clone --no-local` checked out exact content commit
  `13231f34ac276695852eb54e375aacfd6d2d4029` / tree
  `6ed03405b8e252a583f6f89709722e1bd680d8de`. Frozen pnpm installation,
  locked uv synchronization, and both locked Cargo fetches passed.
- Contract generation ran twice and remained byte-identical at 112 files.
  The explicit corpus-manifest and structural-baseline update commands each
  ran twice; their reviewed bytes stabilized, compatibility remained clean,
  and normal verification performed no update.
- The clone passed the real 287-test contract suite with
  `typescript=198 python=194 rust=193 rust-build=locked-offline`,
  traceability at 157 requirements / 286 packages, all 36 status groups,
  doctor at 22 PASS / 0 WARNING / 0 FAIL / 1 honest visual
  NOT_YET_APPLICABLE, and the complete aggregate verifier. The aggregate run
  included 637 contract-package tests, 547 Python tests, the controlled
  browser smoke, the unchanged native-host test, and all 8 test-only Rust
  harness tests. `git diff --check` passed and final porcelain was empty.

#### M01-W06 fail-closed hosted precursor

- Required content commit
  `d8109d048fb8fd03c5fb56b9703011d26521b576` / tree
  `53d354352ede61eee43e0b0b11865b5b273ec099`, with message
  `contracts: define feasibility and benchmark contracts for M01-W06`, was
  pushed without force. Run
  [30302580411](https://github.com/kalwad/jobapplyv2/actions/runs/30302580411)
  passed macos-15 job 90098837928 but failed ubuntu-24.04 job 90098837824
  and windows-2025 job 90098837923.
- Both failed logs showed only the existing deterministic double-build
  compatibility proof exceeding Vitest's generic 5-second case limit under
  full parallel package load (5.903 seconds on Ubuntu and 6.215 seconds on
  Windows); no assertion, contract verdict, adapter, generator, or Rust proof
  failed. No closeout state changed. A non-force follow-up commit
  `13231f34ac276695852eb54e375aacfd6d2d4029` set a bounded 15-second deadline
  for that case without changing its assertions or product/contract behavior.

#### M01-W06 hosted content verification

- GitHub Actions run
  [30303334967](https://github.com/kalwad/jobapplyv2/actions/runs/30303334967)
  checked out exact content commit
  `13231f34ac276695852eb54e375aacfd6d2d4029` and passed:
  macos-15 job 90101389069, ubuntu-24.04 job 90101389082, and windows-2025
  job 90101389128.
- The actual Windows log was inspected. It records the exact checkout; Node
  24.18.0, pnpm 11.17.0, uv 0.11.32, and Rust 1.97.1; frozen/locked
  dependency reconstruction; 112 generated files byte-identical; two real
  adapter summaries with
  `typescript=198 python=194 rust=193 rust-build=locked-offline`; 637/637
  package tests; 287/287 focused contract tests; 547/547 Python tests; 8/8
  Rust-harness tests; contract-gen and contract ACTIVE/PASS; visual
  NOT_YET_APPLICABLE; verification exit 0; and a successful no-tracked-change
  assertion. The test-only Rust adapter did not skip.
- Closeout state changes only M01-W06 to VERIFIED at content tree
  `6ed03405b8e252a583f6f89709722e1bd680d8de` and M01-W07 to the sole READY
  package. M01 remains IN_PROGRESS, current work is NONE, M00 remains
  ACCEPTED, all four gates remain NOT_EVALUATED, and release remains
  NOT_READY. `REQ-GATE-006` remains honestly SCAFFOLD_ONLY /
  NOT_YET_APPLICABLE; no benchmark or gate was executed.

### M01-W05 — Build contract compatibility tests (2026-07-27)

- Revision: content tree `77fb23c61482ff87643db30f10ed27263254a7b2`
  / commit `791a4735a2b43e7f98f5be7d6e0f64a7412fc8f5`. Bootstrap ran at
  starting commit `0d8805c52c6801b2d65489c2007b715bcdfb86c2`
  (clean `main`, equal to `origin/main`).
- Environment: macOS 27.0 (Apple silicon); Node 24.18.0; pnpm 11.17.0; uv
  0.11.32; uv-managed Python 3.12.13; cargo/rustc 1.97.1; Pydantic 2.12.5;
  Playwright 1.62.0 with pinned Chromium.
- Bootstrap: clean `main`, `HEAD == origin/main ==
  0d8805c52c6801b2d65489c2007b715bcdfb86c2`; M00 ACCEPTED, M01
  IN_PROGRESS, M01-W01…W04 VERIFIED, M01-W05 sole READY, later packages
  NOT_STARTED, all gates NOT_EVALUATED, release NOT_READY, traceability
  exactly 157 requirements/286 packages, and no requirement owned by
  M01-W05. Final M01-W04 run 30254220815 passed macos-15 job 89938935415,
  windows-2025 job 89938935446, and ubuntu-24.04 job 89938935477. The
  requested M01-W04 range and complete mandatory source/doc inventory were
  inspected before M01-W05 alone became IN_PROGRESS.
- Canonical corpus/protocol: format `1.0.0`, 113 sorted unique synthetic
  cases, 14 categories, 57 AUTHORIZE / 6 ROUND_TRIP / 42 VALIDATE / 8
  VERSION_CHECK operations, and applicability counts TypeScript 112, Python
  108, Rust 107. Manifest SHA-256 is
  `8f70bc7b9f24ddedd2462da4e1cd91c544a4ab7fca7eaedabc2b6a0031e5b41d`;
  file hashes are `f0a093f6…` (cases), `418a4d9d…` (raw wire), and
  `9032ae3b…` (values). Protocol `JAPP_CONTRACT_ADAPTER_V1` carries bounded
  base64 raw bytes and separate trusted context; all children use explicit
  argv, no shell, timeouts, bounded output, and stable non-echoing results.
- Compatibility results: all applicable languages agreed on strict schema
  verdicts, normalized valid values, version outcomes, authorization
  allow/deny outcomes, and M01-W03 denial codes. Coverage includes composed
  fixture/error/envelope records; exact string/date/time/money/ID/digest/enum
  preservation; missing versus nullable; integer versus fractional numbers;
  the content-report route; FEASIBILITY and GUIDED_PRE_SUBMIT bounded
  fill/verify/upload/navigation; desktop/model/public-index/verification
  requests; exact/over payload limits; supported old and rejected new/major/
  malformed/mismatched versions; strict structural failures; duplicate keys,
  prototype names, invalid UTF-8/Unicode/control data, excessive depth/size,
  hostile inert strings, huge numbers, and trailing data; and default-deny
  escalation across principals, routes, profiles, final-submit, and platform
  authority. All four platform commands are denied under all four current
  profiles. Every structurally valid authorization/version request is
  typed-reserialized and its canonical form agrees across applicable
  languages, including the supported older-minor case.
- Real adapters: TypeScript uses generated wrappers backed by canonical
  strict Ajv plus generated error/security APIs and descriptor snapshots.
  Python uses generated strict Pydantic v2, `wire_dict()`, and fresh model
  revalidation. Rust is a private `publish = false` test harness using local
  Draft 2020-12 registration, typed representative records, canonical
  catalogs/policy, and mechanical enum checks. Exact direct pins:
  `base64=0.22.1`, `jsonschema=0.49.1` with default features disabled,
  `serde=1.0.229`, `serde_json=1.0.151`; its Cargo.lock contains 106 locked
  packages. `services/native-host` remains the unchanged fail-closed M17-W04
  scaffold.
- Breaking evidence: historical baseline digest
  `fb659b1e1921a3209836364131130bb437dd99898724f9763ed348dedcf05243`.
  Read-only check mode matched canonical truth. Mutation tests rejected
  schema/definition/property removal or rename, required/type/null/ref/enum/
  pattern/bound/openness changes, semantic reassignment, command capability/
  target/denial/payload changes, profile/final/platform broadening, and valid
  wire-case removal; separately versioned schema/optional-property/minor/
  enum/deprecation/valid-case additions passed. Baseline update is explicit
  and absent from CI/verify.
- Infrastructure negatives: passed missing executable, nonzero exit, timeout,
  nonempty stderr, malformed JSON, Rust compile failure,
  omitted/duplicate/wrong case, verdict/normalization/error-code disagreement,
  bad corpus hash, extra corpus file, baseline drift, breaking mutation, and
  activated-empty discovery tests.
- Commands/results inspected:
  - Frozen installs/fetch: `pnpm install --frozen-lockfile`; `uv sync
    --locked`; both native-host and test-harness `cargo fetch --locked` →
    exit 0.
  - `pnpm generate:contracts --check` twice → exit 0, 55 files
    byte-identical. `pnpm contracts:compatibility:check` → compatible, zero
    findings/additions.
  - Focused contract tests → 4 files / 160 passed with deterministic proof
    `typescript=112 python=108 rust=107 rust-build=locked-offline`. Focused
    Python adapter → 2 passed. Rust harness → 5 passed; clippy/build/fmt
    locked/offline passed.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:contract`, `pnpm test:e2e`, `pnpm test:python`, and
    `pnpm test:rust` → exit 0. `@japp/contracts` ran 498 tests; pytest ran
    543; Playwright ran 1; native-host ran 1; harness ran 5.
  - `pnpm traceability:generate`; `pnpm traceability:check`; `python3
    scripts/validate_status.py` → exit 0 (157/286; 36 status groups).
    `pnpm run doctor` → 21 PASS / expected dirty-tree WARNING / 0 FAIL / 1
    honest visual NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0: contract and contract-gen ACTIVE/PASS, all other
    active suites PASS, visual alone NOT_YET_APPLICABLE; 498 contract-package
    Vitest tests and 543 Python tests; no tracked mutation by verification.
  - Fresh temporary clone at exact content commit `791a4735…` / tree
    `77fb23c6…`: frozen pnpm install, locked uv sync, both locked Cargo
    fetches, 55-file generated check, compatibility baseline check, 160-test
    real contract suite, status, and 157/286 traceability checks → exit 0;
    real adapter proof
    `typescript=112 python=108 rust=107 rust-build=locked-offline`; no tracked
    mutation; temporary clone removed.
- Hosted portability correction evidence: precursor runs 30260255917,
  30260943487, and 30261419998 exposed and then proved fixes for fresh Cargo
  build diagnostics on stderr, strict UTF-8 verification capture/output under
  a Windows CP1252 default, and a cold/concurrent Rust-negative compilation
  exceeding Vitest's generic five-second outer deadline. Adapter stderr
  remains fail-closed, verification output is explicitly UTF-8, the Rust
  child remains bounded at 30 seconds, and only that child test has a
  45-second outer deadline. None of the precursor runs triggered closeout.

#### M01-W05 hosted content verification

- GitHub Actions run
  [30262000801](https://github.com/kalwad/jobapplyv2/actions/runs/30262000801)
  checked out exact content commit
  `791a4735a2b43e7f98f5be7d6e0f64a7412fc8f5` and passed:
  windows-2025 job 89963838456, macos-15 job 89963838490, and
  ubuntu-24.04 job 89963838519.
- The actual Windows log was inspected. It records the exact checkout; locked
  native-host and test-harness dependency fetches; clean doctor with 22 PASS
  / 0 WARNING / 0 FAIL / 1 honest NOT_YET_APPLICABLE; the cold/concurrent
  Rust compile-failure negative passing; two real adapter summaries with
  `typescript=112 python=108 rust=107 rust-build=locked-offline`; 498/498
  package tests; 160/160 focused contract tests; 543/543 Python tests;
  contract and contract-gen ACTIVE/PASS; Rust ACTIVE/PASS; visual
  NOT_YET_APPLICABLE; verification exit 0; and a successful no-tracked-change
  assertion. The Rust adapter did not skip.
- Traceability/scope: only M01-W05 package state/evidence changes because it
  owns no requirement. Reviewed requirement hashes/states remain unchanged.
  M01 remains IN_PROGRESS; M01-W06 becomes the sole READY package; W07 and
  later work are not begun; all four gates remain NOT_EVALUATED; release
  remains NOT_READY. No M01-W06 schema,
  M01-W07 service API, product/native-host/browser/storage/model/platform/
  submission/UI implementation, or canonical-spec edit exists.

### M01-W04 — Define capability and command allowlists (2026-07-27)

- Revision: content tree `9ec01d8f8a734c703a943ea08012a10df023bf67`
  / commit `d0d0abd70fd5d82a294a9c9e8167d9702b8d0217`. Bootstrap ran at
  starting tree `1171f6af2fcb1a8057023fcdaf914ae232575223`
  (commit `11b3202d247859ab1345b170d20087ecc1f23e08`, clean `main`,
  equal to `origin/main`).
- Environment: macOS 27.0 (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustc/cargo
  1.97.1; @playwright/test 1.62.0 with pinned Chromium; pydantic 2.12.5.
  No new dependencies.
- Clean-session bootstrap (all inspected at starting HEAD): `git fetch
  origin`; `git status --short`; `git branch --show-current`; `git
  rev-parse HEAD`; `git rev-parse origin/main`; `git log --oneline -8` →
  clean `main` at `11b3202d…`, equal to origin; `gh run view
  30246992024` → final M01-W03 repair restamp green on macos-15 job
  89916167019, ubuntu-24.04 job 89916167071, and windows-2025 job
  89916167072; both requested M01-W03/KI-0020 ranges
  (`c5ce7e9..b21c098`, `b21c098..11b3202`) inspected; `python3
  scripts/validate_status.py` → exit 0 (36 groups); `pnpm
  traceability:check` → exit 0 (157 requirements / 286 packages);
  `pnpm run doctor` → exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE; `pnpm generate:contracts --check` → exit 0, 44
  files byte-identical; `pnpm verify` → exit 0 with contract-gen ACTIVE
  and PASS, contract and visual honestly NOT_YET_APPLICABLE, and no
  tracked/untracked change. Only after every prerequisite passed was
  M01-W04 made the sole IN_PROGRESS package; M01-W05 remained
  NOT_STARTED and no package remained READY.
- Governance and scope: M00 remains ACCEPTED, M01 remains IN_PROGRESS,
  all four critical gates remain NOT_EVALUATED, and release remains
  NOT_READY. No requirement in `docs/traceability.json` names M01-W04 as
  an owner, so only the package state changes; all 157 requirement
  implementation/verification states, evidence, dependency projections,
  and reviewed hashes remain byte-identical to the starting revision.
  No M01-W05 contract-suite, M01-W06/M01-W07 contract, Rust contract,
  product, browser, storage, model, native-transport, platform, UI, or
  submission implementation was begun.
- Canonical architecture delivered:
  - Four strict security schemas define the closed principal/profile and
    capability vocabularies, command vocabulary, authorization-request
    metadata, and positive authorization rows. Three validated canonical
    JSON data documents define capability metadata, command metadata, and
    the policy. TypeScript and Python maps and authorization logic are
    generated from those sources; there is no independently handwritten
    language policy.
  - The exact principal set is `DESKTOP_APP`,
    `EXTENSION_CONTENT_SCRIPT`, `EXTENSION_SERVICE_WORKER`,
    `MODEL_RUNTIME`, `NATIVE_HOST`, `ORCHESTRATOR`,
    `PLATFORM_ADAPTER`, `PUBLIC_JOB_INDEX`, and
    `VERIFICATION_HARNESS`. The exact profile set is `FEASIBILITY`,
    `GUIDED_PRE_SUBMIT`, `PRODUCTION_NO_SUBMIT`, and `VERIFICATION`;
    there is no AUTO_SUBMIT profile.
  - The 18 bounded capabilities are artifact read/write, model
    inference, page document upload/inspection/bounded mutation/bounded
    navigation/validation-reconciliation-review, four reviewed platform
    categories (browser-runtime discovery, native-messaging
    registration, process supervision, secret-store access), private
    data read/write, public job-index read, final submission, synthetic
    verification, and workflow control. No broad command, arbitrary
    filesystem, shell, SQL, JavaScript, selector, registry, executable,
    URL, or code authority exists.
  - The 24 commands cover bounded artifact/model/private-data/public-index
    requests, page reporting/scanning/proposal/application/verification/
    reconciliation/review/upload/safe navigation, pause/cancel, four
    abstract platform-service requests, synthetic-suite execution, and a
    known final-submit command. Each has one capability, reviewed target,
    supported-profile set, safe-integer byte limit, consequence class,
    idempotency expectation, safe M01-W03 denial code, description, and
    explicit non-goals.
  - The 127 sorted positive rows authorize exact
    `(profile, command, preserved origin, immediate sender, trusted
    receiver, target)` hops. Absence denies; wildcards, regexes,
    inheritance, transitive authority, duplicate rows, target rewrites,
    and origin rewriting are invalid. Complete multi-hop routes are
    required where applicable, including content script → service worker
    → native host → authenticated loopback orchestrator.
  - Generator integrity checks independently pin immutable profile
    capability ceilings, command capability/target mapping,
    consequence/idempotency semantics, complete routes, content-script,
    desktop, orchestrator, model, public-index, native-host,
    platform-adapter, verification, and final-submit prohibitions. Thus
    coordinated catalog edits cannot grant prohibited authority merely
    by making the schema-valid JSON documents agree.
  - FEASIBILITY permits only the exact synthetic/local inspection,
    bounded fill, verification, reconciliation, workflow-control, and
    evidence route; it excludes safe navigation and all final,
    production-private, model, artifact, and platform authority.
    GUIDED_PRE_SUBMIT permits only reviewed bounded fill, verification,
    upload, safe next/back, pause, cancel, reconciliation, and final
    review; its vocabulary cannot express credentials, account creation,
    email verification, MFA, CAPTCHA solving, unexpected legal consent,
    unapproved consequential answers, arbitrary selectors/scripts, or
    final submission. No current profile supports or contains a row for
    any platform command or `SUBMISSION_FINAL_SUBMIT`.
  - The closed request contains only version, IDs, preserved origin,
    immediate sender, target, profile, UTC/correlation metadata, exact
    safe-integer payload byte count, and optional causation, SHA-256
    digest, and idempotency metadata. Capability/decision/error text and
    payload are unrepresentable. Authorization additionally requires
    trusted runtime context for the authenticated original principal,
    receiving principal, active profile, and independently observed byte
    count; every trusted value must agree with wire metadata and the
    exact row before dispatch.
- Generator and generated outputs:
  - Generator format `1.1.0` → `1.2.0` because M01-W04 adds bounded
    JSON-Schema integers and canonical security-policy data provenance/
    language surfaces. The narrow integer IR/emitter support requires
    exact safe integers in TypeScript and strict Pydantic integers in
    Python and rejects booleans, floats, strings, negative values,
    unsafe integers, contradictory bounds, and unsupported integer
    keywords fail closed.
  - Generation now validates 20 schemas and four data inputs (the
    preserved error catalog plus three security documents) before
    emitting 55 deterministic files. `MANIFEST.json` records exact source
    paths, validating schemas, versions, SHA-256 input hashes, 51
    resolved type references, and output hashes. The new generated
    inventory is four security schema modules per language, Python's
    security package initializer, and policy-data modules; prior
    generated outputs change only where indexes, runtime integer
    validation, README, or MANIFEST inventory require it.
  - Generated `CAPABILITY_CATALOG_V1`, `COMMAND_CATALOG_V1`,
    `AUTHORIZATION_POLICY_V1`, sorted identifier lists, membership and
    required-entry lookups, allowed-command queries, and typed
    authorization outcomes are immutable/frozen where supported.
    Unknown/hostile values are denied without echo. TypeScript uses the
    strict canonical Ajv catalog with own-property validation and a
    frozen null-prototype descriptor snapshot, rejecting inherited,
    accessor, symbol, non-enumerable, and trapping-Proxy input before
    policy use. Python copies model input to a fresh canonical record and
    strictly revalidates it, so post-validation mutation cannot bypass
    checks.
- Focused and regression coverage:
  - TypeScript security-policy tests exercise exact inventories and
    canonical/generated agreement; every positive row; FEASIBILITY,
    GUIDED_PRE_SUBMIT, production, verification, platform, and final
    boundaries; content-script/service-worker/native-host multi-hop
    routing; confused-deputy cases; trusted origin/sender/receiver/
    profile/size binding; exact/over-limit and invalid integer sizes;
    wrong/unknown/missing/duplicate/wildcard/tampered rows; hostile
    prototype/accessor/Proxy/property inputs; immutable generated maps;
    protected authentication/legal/CAPTCHA concepts; and every current
    profile denying final submit.
  - Python mirrors valid routes, every positive row, confused-deputy and
    platform/final denials, strict/coercion/additional/null/hostile input,
    valid model input, post-validation mutation, immutable maps, trusted
    context, and byte-limit behavior. Shared instance-corpus cases prove
    the strict authorization-request schema in both languages.
  - Generator negatives cover unsupported/bounded integers; missing,
    reordered, duplicate, wildcard, unknown, retargeted, capability-
    expanded, final-disguised, idempotency-weakened, and coordinated
    tampering; real check-mode drift; atomic rollback; generated
    control-byte rejection; repeated byte identity; and check-mode
    read-only behavior. Existing M01-W01 schema, M01-W02/KI-0018
    generation/rollback/control-byte, and M01-W03/KI-0020
    transient/retry taxonomy tests remain green.
- Commands and observed results (local content working tree):
  - `pnpm install --frozen-lockfile`; `uv sync --locked`; `cargo fetch
    --locked --manifest-path services/native-host/Cargo.toml` → exit 0.
  - `pnpm generate:contracts` → exit 0 (55 files). `pnpm
    generate:contracts --check` run repeatedly, including two consecutive
    runs after final implementation changes → exit 0 each time, 55 files
    byte-identical.
  - `pnpm traceability:generate`; `pnpm traceability:check` → exit 0
    (157 requirements / 286 packages). `python3
    scripts/validate_status.py` → exit 0 (36 groups).
  - `pnpm --filter @japp/contracts exec vitest run
    test/generated/security-policy.test.ts
    test/generated/typescript-models.test.ts
    test/generated/generator.test.ts test/generated/fsops-install.test.ts
    test/generated/error-taxonomy.test.ts` → exit 0, 5 files / 267
    tests. `uv run pytest scripts/tests/test_generated_security_policy.py
    scripts/tests/test_generated_contracts.py
    scripts/tests/test_integrity.py -q` → exit 0, 190 tests.
  - `pnpm lint`; `pnpm format:check`; `pnpm typecheck`; `pnpm test`;
    `pnpm test:e2e`; `pnpm test:python`; `pnpm test:rust` → exit 0.
    The final full run contains 338 TypeScript contract tests, 539 Python
    tests, one browser smoke test, and one Rust test.
  - `pnpm run doctor` → exit 0, 20 PASS / 1 expected dirty-tree WARNING /
    0 FAIL / 2 NOT_YET_APPLICABLE. `git diff --check` → exit 0.
  - Final `pnpm verify` → exit 0: every ACTIVE suite PASS; contract-gen
    ACTIVE/PASS; contract (M01-W05) and visual (M10-W06)
    NOT_YET_APPLICABLE. Binary tracked-diff and sorted-untracked
    fingerprints were identical before/after, proving the verifier is
    read-only.
  - Independent read-only audits found no remaining semantic/security or
    test blocker. The original TypeScript accessor/Proxy
    privilege-escalation reproduction and mutated Python-model
    reproduction both fail closed; the focused policy suites pass 63/63
    TypeScript and 32/32 Python.
- Clean-clone simulations: staged candidate tree
  `2967f3c2f1d3dd18c0e6881eaed189b9dec1ec14` was transported through a
  temporary local-only commit into a fresh detached clone without moving
  `main`. `pnpm install --frozen-lockfile`; `uv sync --locked`; and
  `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`
  → exit 0. `pnpm generate:contracts` → exit 0 (55 files); two consecutive
  `pnpm generate:contracts --check` runs → exit 0, byte-identical.
  Traceability (157/286) and status (36 groups) passed; doctor reported 21
  PASS / 0 WARNING / 0 FAIL / 2 NOT_YET_APPLICABLE. `pnpm verify` passed
  every active suite with 338 TypeScript contract tests, 539 Python
  tests, browser and Rust tests, contract-gen ACTIVE/PASS, and contract/
  visual NOT_YET_APPLICABLE. Final `git diff --check` and `git status
  --short` were empty. After evidence and KI-0021 governance edits, the
  exact governed content tree `9ec01d8f8a734c703a943ea08012a10df023bf67`
  passed a second fresh detached-clone simulation: all three locked
  dependency commands, generation, two byte-identical checks,
  traceability, status, clean doctor (21/0/0/2), `git diff --check`, and
  final empty status passed.

#### M01-W04 hosted content verification

- GitHub Actions run
  [30253769824](https://github.com/kalwad/jobapplyv2/actions/runs/30253769824)
  checked out exact content commit
  `d0d0abd70fd5d82a294a9c9e8167d9702b8d0217` and passed:
  windows-2025 job 89937537082, ubuntu-24.04 job 89937537118, and
  macos-15 job 89937537130.
- The actual Windows log was inspected. It records the exact SHA fetch and
  checkout; clean doctor with 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE; Node 24.18.0, pnpm 11.17.0, Python 3.12.13, and
  cargo 1.97.1; 338/338 TypeScript contract tests; 55 generated files
  byte-identical; 539/539 Python tests; status validation at 36 groups;
  contract-gen ACTIVE/PASS; contract and visual NOT_YET_APPLICABLE;
  verification exit 0; and a successful no-tracked-changes assertion.
- Artifacts: the canonical security schemas and catalogs, generated
  TypeScript/Python security trees, MANIFEST, test corpus, focused tests,
  and this evidence entry. No screenshots or benchmark artifacts apply.
- Known flaky behavior: none observed.

### M01-W03 — Define error taxonomy (2026-07-27)

- Revision: content working tree (commit recorded post-commit). Bootstrap
  ran at starting HEAD `c5ce7e9fdf35f3bd972b1d4782bd7785cc105958` (clean
  `main`, equal to `origin/main`).
- Environment: macOS (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustup
  toolchain 1.97.1; @playwright/test 1.62.0 with pinned Chromium;
  pydantic 2.12.5. No new dependencies.
- Clean-session bootstrap (all inspected at starting HEAD): `git fetch
  origin` / `git status --short` / branch / `git rev-parse HEAD` /
  `origin/main` / `git log --oneline -8` → clean `main` at
  `c5ce7e9…`, equal to origin; `gh run view 30240403625` → final M01-W02
  restamp run green on windows-2025 job 89896226525, ubuntu-24.04 job
  89896226555, macos-15 job 89896226592; the completed M01-W02 and
  KI-0018 ranges (`be476d6..efd41b2`, `efd41b2..c5ce7e9`) inspected;
  `python3 scripts/validate_status.py` → exit 0 (36 groups);
  `pnpm traceability:check` → exit 0 (157/286); `pnpm run doctor` →
  exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2 NOT_YET_APPLICABLE;
  `pnpm generate:contracts --check` → "35 files, byte-identical";
  `pnpm verify` → exit 0 with contract-gen ACTIVE and PASS. Only after
  every prerequisite passed was M01-W03 marked IN_PROGRESS (status +
  traceability mirror + regenerated view; validators re-run → exit 0).
  Requirement-ownership inspection: no requirement in
  docs/traceability.json lists M01-W03 as an owning package, so no
  requirement state/evidence rows change in this package (package rows
  only; the reviewed hashes cover requirement/dependency projections and
  are untouched).
- Implementation delivered:
  - `schemas/error/taxonomy.v1.schema.json`
    (`urn:japp:schema:error:taxonomy:v1`) — the twelve required families,
    80 stable family-prefixed UPPER_SNAKE_CASE codes (VALIDATION 6,
    CONFLICT 5, UNSUPPORTED 6, SENSITIVE 6, MODEL 6, STORAGE 6,
    TRANSPORT 8, RENDERING 6, SITE 9, BENCHMARK 7, GATE 7, SUBMISSION 8 —
    every distinction required by the package contract, no speculative
    codes, no generic UNKNOWN), severities, retry/recovery dispositions,
    reporting origins, message-key grammar, bounded user-safe message
    shape.
  - `schemas/error/catalog.v1.schema.json` + the canonical instance
    `catalog/error-catalog.v1.json` — one metadata entry per code (derived
    message key, safe default English message, optional remediation,
    severity, disposition, user-action/transient flags, diagnostic policy
    on the canonical redaction vocabulary, optional owning boundary,
    added_in/deprecated_since); single source of truth for both language
    surfaces.
  - `schemas/error/record.v1.schema.json` — strict closed wire record
    serializing ONLY the stable code plus occurrence identity/trace data;
    metadata is always catalog-derived, so contradictory caller-supplied
    family/severity/retry/message data is unrepresentable; diagnostics are
    referenced only by SHA-256 digest.
  - Generator (format 1.0.0 → 1.1.0): narrow strict `boolean` and uniform
    `array` (`items` + `minItems`/`maxItems`) support across IR and both
    emitters (tuples, `uniqueItems`, `integer` stay fail-closed with path
    + pointer); the catalog pipeline (`generator/error-catalog.ts`) —
    strict schema validation of the instance, fail-closed integrity gate
    (sorted unique codes, exact two-direction agreement with the taxonomy
    enum, family/prefix and derived-key checks, user-safe message lint,
    family invariant matrix), `--catalog-root` CLI override, MANIFEST
    `dataInputs` provenance (path, validating schema, version, SHA-256 of
    exact committed bytes), and generated catalog-data emission.
  - Regenerated `generated/` (35 → 44 files): taxonomy/catalog/record
    types and validators in both languages plus
    `typescript/error/catalog-data.v1.ts` and
    `python/src/japp_contracts/error/catalog_data_v1.py` — frozen
    `ERROR_CATALOG_V1` map, sorted `ERROR_CODES_V1`, membership guard,
    fail-closed `requireErrorCatalogEntryV1`/`require_error_catalog_entry_v1`
    (unknown input never echoed), default-message lookup; Python entries
    are constructed through strict model validation at import time.
    Prior generated modules are byte-identical except the legitimately
    affected index/`__init__`/README/MANIFEST surfaces.
- Tests added:
  - `packages/contracts/test/generated/error-taxonomy.test.ts` (28 tests):
    catalog integrity (families, unique complete codes, derived keys,
    schema-enum agreement in both representations), user-safe message
    policy (lint clean, no interpolation/HTML/URL/path/trace syntax, no
    control characters), family invariants (SENSITIVE pause/prohibit +
    user action; SITE pause; MODEL messages preserve accepted results;
    GATE never reads as PASS after negation stripping; SUBMISSION never
    claims success; UNSUPPORTED/BENCHMARK never SAFE_RETRY;
    threshold-failure messages state thresholds are never lowered;
    transient ⟺ SAFE_RETRY), generated-TS lookup determinism, frozen
    metadata, unknown/prototype-key rejection without echo, record
    narrowing with catalog-derived metadata, and fail-closed generator
    behavior on tampered catalogs (removed entry, undeclared code stopped
    by the schema enum, family mismatch, non-derived key, unsorted
    entries, sensitive fallback, smuggled URL, real-CLI tamper and
    missing-file paths) plus array/boolean construct positives and
    negatives (tuple/prefixItems, uniqueItems, stray boolean keywords).
  - Shared corpus +30 cases (84 → 114) driving BOTH languages: taxonomy
    token positives/negatives, message-key and user-safe-message shapes,
    error-record positives (minimal, full trace + digest) and negatives
    (unknown code, caller-supplied user message/severity/retry metadata,
    missing correlation, free-text diagnostic, invalid id, offset
    timestamp, null causation), and catalog-shape cases exercising strict
    arrays/booleans (entries-as-object rejected, "true"/1 not coerced to
    booleans, unknown member rejected, empty entries rejected).
  - `scripts/tests/test_generated_contracts.py` (+6 tests, 129 total in
    module): Python catalog integrity mirror (80 codes, 12 families,
    sorted, prefix/derived-key agreement with the schema enum),
    user-safe-message sweep, family invariant matrix, deterministic
    fail-closed lookups (hostile input not echoed), record
    code-only serialization with catalog-derived metadata and
    caller-metadata rejection, and MANIFEST dataInputs provenance
    verification against the committed catalog bytes.
  - Premise repair (KI-0019): the status exactness negative resets every
    M01 row through M01-W04, and both M00-closeout helpers were
    generalized through M01-W05 to preempt the class at the upcoming
    stamp boundaries.
- Commands and observed results (local, uncommitted working tree):
  - `pnpm install --frozen-lockfile` → exit 0 ("Already up to date").
  - `uv sync --locked` → exit 0. `cargo fetch --locked
    --manifest-path services/native-host/Cargo.toml` → exit 0.
  - `pnpm generate:contracts` → exit 0 (44 files; 35 prior + 9: three
    error documents × two languages, two catalog-data modules — index and
    __init__ surfaces regenerate in place).
  - `pnpm generate:contracts --check` run twice → exit 0 both times,
    "44 files, byte-identical"; also re-run after all doc edits → exit 0.
  - `pnpm lint` → exit 0. `pnpm format:check` → exit 0.
  - `pnpm typecheck` → exit 0 (generated error modules included).
  - Focused: `pnpm --filter @japp/contracts exec vitest run` → exit 0,
    8 files, 258 tests (199 prior + 28 error-taxonomy + 30 new shared
    corpus cases + KI-0018 fsops/control-byte regressions all green);
    `uv run pytest scripts/tests -q` → exit 0, 492 passed (455 prior +
    30 corpus + 6 error-layer + 1 KI-0019-adjusted premise).
  - `pnpm test` → exit 0 (unit-ts, 266 tests across 9 packages).
    `pnpm test:e2e` → exit 0 (1). `pnpm test:python` → exit 0 (full
    pytest 493 = 492 scripts/tests + 1 orchestrator). `pnpm test:rust` →
    exit 0.
  - `python3 scripts/validate_status.py` → exit 0 (36 groups).
    `pnpm traceability:generate` + `pnpm traceability:check` → exit 0
    (157/286; package rows only — no requirement rows changed and every
    reviewed hash is untouched).
  - `pnpm run doctor` → exit 0, 20 PASS / 1 WARNING (expected
    uncommitted implementation state) / 0 FAIL / 2 NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0; contract-gen ACTIVE and PASS; contract
    (M01-W05) and visual (M10-W06) honestly NOT_YET_APPLICABLE;
    status-neutral. `git diff --check` → exit 0.

#### M01-W03 clean-clone simulation (local, committed content revision)

- `git clone <repository> <fresh directory>` at
  `916c14ad1832adbb021e5eef4c6f2f046d89056e` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0; `uv sync --locked` → exit 0;
  `pnpm exec playwright install chromium` → exit 0.
- `pnpm generate:contracts --check` → exit 0, "generated contracts are up
  to date (44 files, byte-identical)" — schemas plus the canonical error
  catalog reproduce the committed trees exactly from a clean locked
  install.
- Write-mode `pnpm generate:contracts` followed by
  `git status --porcelain` → zero changes (byte-exact no-op).
- `pnpm run doctor` → exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE. `pnpm verify` → exit 0; clean tree throughout.

#### M01-W03 hosted three-OS content verification

- Content run 30242783456 at commit
  `916c14ad1832adbb021e5eef4c6f2f046d89056e` succeeded on all three
  required jobs: windows-2025 job 89903310571 (4m8s), macos-15 job
  89903310628 (2m41s), and ubuntu-24.04 job 89903310666 (2m14s).
- The complete Windows job log was downloaded and inspected: the job
  checked out exactly `916c14ad1832adbb021e5eef4c6f2f046d89056e`; the
  canonical doctor reported 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE with a clean working tree; aggregate verification
  reported "generated contracts are up to date (44 files, byte-identical)"
  — the error-taxonomy generation therefore reproduces byte-exactly on
  windows-2025 — plus contract-gen ACTIVE and PASS, 258 @japp/contracts
  Vitest tests, 493 Python tests (`493 passed in 84.60s`), and
  `verification exit code: 0` (REQ-PLAT-013 infrastructure evidence only —
  not Windows 11 product certification).
- After this hosted success, M01-W03 was marked VERIFIED at content tree
  `1acf66eb15095e4777d89d66833720cfb6fd0360`, M01-W04 became the sole
  READY package, and M01 remains IN_PROGRESS. The conventional
  revision-stamp commit records this closeout; its own three-OS run is
  required to pass at the final head.

#### M01-W03 corrective closeout — KI-0020 (2026-07-27)

- Starting revision: tree `07f9e088bef77af4a32c2204c88c493be8fed7a5` /
  commit `b21c098e306b89da4ac4d503882a42b8be83c6e0`; clean `main`, equal
  to `origin/main`.
- Independent reproduction: direct enumeration of all 80 canonical catalog
  entries found five `transient=true` entries but seven `SAFE_RETRY`
  entries. Exactly `MODEL_MALFORMED_OUTPUT` and
  `MODEL_VALIDATION_FAILED` were `SAFE_RETRY` with `transient=false`.
  The canonical validator, the TypeScript test titled as an exact
  equivalence, and the generated-Python invariant test all checked only
  `transient=true` implies `SAFE_RETRY`.
- Bootstrap commands and observed results before any edit:
  - `git fetch origin`; `git status --short`; branch/HEAD/origin/log
    inspection → exit 0; clean `main`; HEAD and `origin/main` both the
    expected starting commit.
  - `gh run view 30243192705` → exit 0; the final prior M01-W03 run passed
    macos-15 job 89904527736, windows-2025 job 89904527768, and
    ubuntu-24.04 job 89904527835.
  - `python3 scripts/validate_status.py` → exit 0 (36 groups);
    `pnpm traceability:check` → exit 0 (157 requirements / 286 packages);
    `pnpm run doctor` → exit 0 (21 PASS / 0 WARNING / 0 FAIL /
    2 NOT_YET_APPLICABLE); `pnpm generate:contracts --check` → exit 0
    (44 files, byte-identical); `pnpm verify` → exit 0 with contract-gen
    ACTIVE and PASS, contract and visual honestly NOT_YET_APPLICABLE, and
    all active suites PASS.
- Temporary governance transition: only M01-W03 was reopened as
  IN_PROGRESS; M01-W04 returned to NOT_STARTED, no package is READY, M01
  remains IN_PROGRESS, M00 remains ACCEPTED, all four critical gates remain
  NOT_EVALUATED, and the release remains NOT_READY.
- Reviewed semantics: `MODEL_MALFORMED_OUTPUT` is a rejected, side-effect-free
  draft for which M05-W03 already specifies one bounded retry, so it remains
  `SAFE_RETRY` and becomes `transient=true`.
  `MODEL_VALIDATION_FAILED` can represent policy, factuality, evidence, or
  deterministic-postcondition rejection; an unchanged blind retry is not
  safe, so it becomes non-transient `RETRY_AFTER_REMEDIATION`. All accepted
  deterministic results remain usable and unchanged after every MODEL
  failure.
- Corrective implementation:
  - The canonical catalog validator now evaluates the exact equality
    `entry.transient === (entry.retry_disposition === "SAFE_RETRY")` and emits distinct
    fail-closed violations for each invalid direction.
  - The canonical catalog marks `MODEL_MALFORMED_OUTPUT` as transient and
    keeps its bounded `SAFE_RETRY`; it marks `MODEL_VALIDATION_FAILED`
    non-transient with `RETRY_AFTER_REMEDIATION` and directs correction of
    source evidence or the generation request before another attempt.
  - Every MODEL default message carries the exact positive guarantee that
    all accepted deterministic results remain usable and unchanged.
  - Existing generation updated only the canonical-derived TypeScript and
    Python catalog-data modules plus MANIFEST input/output hashes. The
    taxonomy and catalog schemas, strict wire record, user-message safety
    rules, and generator safety/rollback implementation were not weakened.
- Tests added or strengthened:
  - The committed-catalog test now asserts the bidirectional equality
    directly for every entry, and the Python surface independently mirrors
    it.
  - Separate generation tests tamper a non-`SAFE_RETRY` entry to
    `transient=true` and a `SAFE_RETRY` entry to `transient=false`; both
    fail with direction-specific violations.
  - Both generated-language suites compare every generated catalog value
    with the corrected canonical JSON, assert the intentionally reviewed
    semantics of both MODEL entries, and positively require the
    deterministic-result preservation guarantee for all six MODEL codes.
  - Existing byte-identical repeated-generation, read-only check mode,
    KI-0018 rollback, and tracked control-byte regressions remain active.
- Commands and observed results on the corrective working tree:
  - `pnpm install --frozen-lockfile` → exit 0, already up to date;
    `uv sync --locked` → exit 0.
  - `pnpm generate:contracts` → exit 0 (44 files);
    `pnpm generate:contracts --check` twice → exit 0 both times,
    "44 files, byte-identical".
  - Focused TypeScript: error taxonomy/catalog → 32 passed; generated
    models → 123 passed; generator determinism/read-only suite → 25 passed;
    KI-0018 rollback suite → 11 passed. Focused control-byte regressions →
    3 passed.
  - Focused generated Python suite → 132 passed.
  - `pnpm traceability:generate` and `pnpm traceability:check` → exit 0
    (157 requirements / 286 packages; package-state mirror only);
    `python3 scripts/validate_status.py` → exit 0 (36 groups).
  - `pnpm run doctor` → exit 0, 20 PASS / 1 expected uncommitted-tree
    WARNING / 0 FAIL / 2 NOT_YET_APPLICABLE.
  - `pnpm lint`, `pnpm format:check`, and `pnpm typecheck` → exit 0.
  - `pnpm test` → exit 0 (262 @japp/contracts tests; 270 unit-ts tests
    across the workspace); `pnpm test:e2e` → exit 0 (1);
    `pnpm test:python` → exit 0 (496); `pnpm test:rust` → exit 0 (1).
  - `pnpm verify` → exit 0; contract-gen ACTIVE and PASS; contract remains
    NOT_YET_APPLICABLE under M01-W05; visual remains NOT_YET_APPLICABLE
    under M10-W06; every active suite PASS. Pre/post hashes of the complete
    binary diff and `git status --porcelain=v1 -uall` were identical,
    explicitly proving the aggregate verification remained read-only.
- Repair content revision: tree
  `2a56ed518797e811f8a0506e7834401c50eda166` / commit
  `c4ed1407083cf1e1d296a5763b1842322e9b90f7`.
- Clean-clone simulation at that exact commit:
  - Fresh local clone plus `pnpm install --frozen-lockfile` and
    `uv sync --locked` → exit 0.
  - `pnpm generate:contracts --check` → exit 0 (44 files,
    byte-identical); write-mode `pnpm generate:contracts` followed by a
    second check → exit 0; `git status --short` remained empty.
- Hosted repair content verification:
  - Run 30246548320 succeeded at the exact repair commit on ubuntu-24.04
    job 89914804733 (2m24s), windows-2025 job 89914804805 (3m50s), and
    macos-15 job 89914804843 (2m59s).
  - The actual Windows log was downloaded and inspected. It confirms exact
    checkout `c4ed1407083cf1e1d296a5763b1842322e9b90f7`; doctor 21 PASS /
    0 WARNING / 0 FAIL / 2 NOT_YET_APPLICABLE; 262 contracts Vitest
    tests; 496 Python tests; "generated contracts are up to date (44 files,
    byte-identical)"; contract-gen ACTIVE and PASS; contract and visual
    honestly NOT_YET_APPLICABLE; verification exit 0; and the post-verify
    tracked-change assertion passed.
- After that hosted success, KI-0020 is FIXED, M01-W03 is VERIFIED at the
  repair content tree, M01-W04 is restored as the sole READY package, M01
  remains IN_PROGRESS, M00 remains ACCEPTED, all four critical gates remain
  NOT_EVALUATED, and release remains NOT_READY. The conventional
  revision-restamp commit records this closeout; its own exact-HEAD
  three-OS run is required to pass.

### M01-W02 — Generate TypeScript and Python contracts (2026-07-27)

- Revision: content working tree (commit recorded post-commit). Bootstrap ran
  at starting HEAD `be476d636b554b698a996b6851d4a7fa7293dd2d` (clean `main`,
  equal to `origin/main`).
- Environment: macOS (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustup toolchain
  1.97.1; @playwright/test 1.62.0 with pinned Chromium; new exact Python
  pins pydantic 2.12.5 (+ pydantic-core 2.41.5, annotated-types 0.8.0,
  typing-inspection 0.4.2) in the root uv dev group and uv.lock.
- Clean-session bootstrap (all inspected at starting HEAD):
  - `git fetch origin`, `git status --short`, `git branch --show-current`,
    `git rev-parse HEAD`, `git rev-parse origin/main`, `git log --oneline -8`
    → exit 0; clean tree; branch `main`; local HEAD and `origin/main` both
    `be476d636b554b698a996b6851d4a7fa7293dd2d`.
  - `gh run view 30235026395` → final M01-W01 stamp run succeeded on all
    three required jobs: macos-15 job 89881105283, ubuntu-24.04 job
    89881105287, windows-2025 job 89881105290.
  - `python3 scripts/validate_status.py` → exit 0 (36 groups; M00 ACCEPTED,
    M01-W01 VERIFIED, M01-W02 sole READY, no IN_PROGRESS package, four
    gates NOT_EVALUATED).
  - `pnpm traceability:check` → exit 0 (157 requirements, 286 packages).
  - `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL and honest
    NOT_YET_APPLICABLE for contract-gen, contract, and visual.
  - `pnpm verify` → exit 0 with every ACTIVE suite PASS.
  - Only after every prerequisite passed was M01-W02 marked IN_PROGRESS
    (docs/PROJECT_STATUS.md + docs/traceability.json + regenerated view;
    `python3 scripts/validate_status.py` and `pnpm traceability:check`
    re-run → exit 0).
- Implementation delivered:
  - `scripts/generate-contracts.ts` — canonical platform-neutral entry
    point, executed directly by the pinned Node's native type stripping
    (no Bash wrapper, no compile step, no shell profile); root command
    `pnpm generate:contracts` (write) and `pnpm generate:contracts --check`
    (read-only byte-exact drift check; exit 0/1/2 =
    clean/drift/usage-or-generation-failure).
  - `packages/contracts/generator/` — deterministic engine: `ir.ts`
    (fail-closed keyword-allowlist IR with document path + JSON pointer in
    every unsupported-construct error; deterministic dependency ordering of
    $defs, cycles rejected), `naming.ts` (schema-identity → fully-qualified
    type/module mapping), `emit-typescript.ts`, `emit-python.ts`,
    `generate.ts` (orchestration, provenance manifest, LF/path-containment
    guards), `fsops.ts` (staging + single-rename install; complete-inventory
    byte compare; `__pycache__` interpreter caches excluded), `cli.ts`.
    The unweakened M01-W01 gate (`loadSchemaCatalog` +
    `createContractValidator`) runs before any output is planned.
  - `packages/contracts/generated/` — 35 committed generated files:
    `MANIFEST.json` (generator format/config, 13 input schema
    ids/versions/SHA-256 over exact committed bytes, 34 output
    paths/SHA-256, cross-language type-identity map), generated `README.md`,
    `typescript/` (13 document modules + `validators.ts` + `index.ts`; 26
    typed Ajv-delegating wrappers; extension surfaces typed
    `readonly [key: \`x-${string}\`]: unknown`, opaque payloads `unknown`,
    no `any` anywhere), `python/src/japp_contracts/` (13 document modules +
    `_runtime.py` + package/subpackage `__init__.py` + `py.typed`; strict
    Pydantic v2: extra="forbid", strict=True, no defaults, no coercion,
    missing ≠ null via explicit-null rejection on optional non-nullable
    members, string wire forms preserved, Ajv-parity date/date-time
    validators including the 23:59:60Z leap-second slot and proleptic year
    0000 — semantics probed against ajv-formats full mode before
    implementation).
  - Source integration: package-internal import specifiers moved to
    explicit `.ts` form (same modules now execute under Vitest and plain
    pinned Node), `allowImportingTsExtensions` in tsconfig.base.json,
    generated tree included in package typecheck, `@japp/contracts/generated`
    export surface, ESLint/Prettier exemptions for the byte-exact generated
    tree, pytest `pythonpath` + mypy `mypy_path` wiring for
    `japp_contracts`, contract-gen registry explanation updated to accurate
    ACTIVE-state wording (activation rule, command, owner, and mandatory
    state unchanged).
- Tests added:
  - `packages/contracts/test/generated/generator.test.ts` (25 tests):
    double-generation byte identity; reversed-enumeration-order identity;
    committed-tree equality; no environment identity (repo/home/temp paths,
    hostname, current date) or platform separators in any output; real-CLI
    check passes read-only on the committed tree; hand-edit → MODIFIED;
    deleted file → MISSING; extra file → EXTRA; schema-change-without-regen
    fails; empty root reports the complete missing inventory; unknown flag
    usage error; deleted schema leaves no stale output and the follow-up
    check passes; stray pre-existing content replaced wholesale; symlinked
    generated root removed, never written through (capability-probed);
    convention violation (`default`) fails closed with zero writes;
    duplicate `$id` fails; unresolved and remote references fail;
    unsupported construct (array) fails with path + pointer; general anyOf
    fails; adversarial descriptions cannot inject TS (diagnostics-free
    transpile, `*\/`-escaped) or Python (escaped literals only); path
    traversal (`..`, absolute, backslash) rejected; stray non-schema files
    rejected; install/compare invariants.
  - `packages/contracts/test/generated/typescript-models.test.ts` (92
    tests): all 84 shared-corpus verdicts through the typed wrappers with
    input-mutation guards; narrowing after success; structured
    instance-path failures; frozen-input validation; unknown reference
    throws; opaque payload stays `unknown`; optional-vs-null semantics;
    generated reference map exactly covers every catalog definition and
    root payload; wrapper runtime is the canonical catalog validator.
  - `packages/contracts/test/fixtures/instance-corpus.json` — 84
    hand-authored synthetic cases (valid + invalid per definition family)
    consumed by BOTH the TypeScript and Python suites so both languages
    are proven against identical inputs and identical expected verdicts
    (M01-W02 generator/model evidence, not the M01-W05 corpus).
  - `scripts/tests/test_generated_contracts.py` (92 tests): the same 84
    corpus verdicts through the generated Pydantic models (strict
    TypeAdapter for aliases, model_validate for models, resolved through
    the MANIFEST type map); wire round-trip preservation (int confidence
    stays int, float stays float, decimal strings exact); absent optionals
    stay absent while explicit null successor survives; missing ≠ null
    (validate and constructor paths); extra members and coercion rejected;
    field order matches schema property order; sorted importable `__all__`
    + `py.typed`; every committed generated module compiles; generated-file
    headers present; real CLI `--check` passes and `git status --porcelain`
    is unchanged by it.
  - Premise repairs (KI-0017, same class as KI-0014/15/16):
    `test_suite_states.py` ACTIVE set now includes contract-gen;
    `test_ci_workflow.py` REQUIRED_MISSING negative isolates an empty repo
    (plus a new positive proving ACTIVE with the real generator);
    `test_doctor.py` healthy fixture carries the generator file;
    `test_validate_status.py` exactness negative resets M01-W02.
- Commands and observed results (local, uncommitted working tree):
  - `pnpm install --frozen-lockfile` → exit 0 ("Already up to date").
  - `uv sync --locked` → exit 0 (21 packages resolved; pydantic 2.12.5,
    pydantic-core 2.41.5, annotated-types 0.8.0, typing-inspection 0.4.2
    added from uv.lock).
  - `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`
    → exit 0.
  - `pnpm generate:contracts` → exit 0 (35 files).
  - `pnpm generate:contracts --check` run twice → exit 0 both times,
    "35 files, byte-identical"; `git status --porcelain` unchanged.
  - `pnpm lint` → exit 0. `pnpm format:check` → exit 0.
  - `pnpm typecheck` → exit 0 (turbo tsc over all packages including the
    generated TypeScript tree, root project including the generator entry,
    strict mypy over services/scripts — mypy follows the test imports into
    `japp_contracts`, so the generated Python is strict-checked; verified
    with `uv run mypy` over the full registry file set → "no issues found
    in 18 source files").
  - `pnpm test` → exit 0 (unit-ts; per-package Vitest proofs; 196 tests
    across 9 packages — @japp/contracts now reports 188).
  - Focused: `pnpm --filter @japp/contracts exec vitest run` → exit 0,
    6 files, 188 tests (71 M01-W01 schema/convention + 117 new generator/
    generated-TypeScript). `uv run pytest scripts/tests -q` → exit 0,
    452 passed (359 prior + 92 new generated-contract tests + 1 new
    contract-gen ACTIVE-derivation test).
  - `pnpm test:e2e` → exit 0 (1 Playwright pinned-Chromium smoke test).
  - `pnpm test:python` → exit 0 (Ruff + Ruff format + strict mypy; full
    pytest 453 passed = 452 scripts/tests + 1 orchestrator scaffold test);
    before the KI-0017 premise repairs this suite honestly FAILED with
    4 failed / 448 passed (initial run exposing the inherited fixtures).
  - `pnpm test:rust` → exit 0 (fmt, clippy -D warnings, 1 test, build).
  - `pnpm test:contract` → NOT_YET_APPLICABLE (honest; owner M01-W05).
    `pnpm test:visual` → NOT_YET_APPLICABLE (honest; owner M10-W06).
  - `pnpm run doctor` → exit 0, 20 PASS / 1 WARNING / 0 FAIL / 2
    NOT_YET_APPLICABLE; the only warning is the expected "uncommitted
    changes present" implementation-state warning; contract-gen now
    reports "PASS — ACTIVE (runs inside pnpm verify)".
  - `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts,
    **contract-gen (ACTIVE, PASS)**, e2e-browser, python, rust,
    portability, traceability, status, and integrity all PASS; contract
    (M01-W05) and visual (M10-W06) honestly NOT_YET_APPLICABLE; verify
    remained status-neutral (worktree snapshot identical before/after).
- Traceability and governance updates in this package:
  - M01-W02 marked IN_PROGRESS in docs/PROJECT_STATUS.md and mirrored in
    docs/traceability.json; docs/REQUIREMENTS_TRACEABILITY.md regenerated;
    validators re-run after every edit.
  - REQ-PLAT-005 stays honestly `SCAFFOLD_ONLY`/`NOT_YET_APPLICABLE` and now
    additionally records the generated-model version-propagation portion
    implemented here (schema ids/versions propagate into generated modules
    and MANIFEST.json provenance; prompt versioning (M05),
    model-configuration/platform-profile versioning (M05-W02/M05-W06), and
    migration versioning (M04-W02) remain future work). This is a reviewed
    intentional update of the expanded requirement hash performed through
    the independently pinned procedure: docs/traceability.json and
    `FINAL_V1_3_REQUIREMENT_MAPPING_SHA256` in scripts/traceability.py
    moved together from
    `2f6fcd94dcf6b7aa9e2a686683cc8243d25138addc0fac049f2bfc0a7416bcaf` to
    `158fb68a58eab46f3339248e5e34897a9f5881c48b5a1e1275b9dfbd2cf45d34`;
    the preserved v1.2 hashes and the v1.3 package-dependency hash are
    unchanged; the regression tests were updated in the same change and the
    trace-repo fixture now carries the newly referenced generator/generated
    files.
  - KI-0017 (MEDIUM, FIXED) recorded in docs/KNOWN_ISSUES.md: four
    boundary fixtures inherited the pre-M01-W02 premise and were repaired
    to establish their own complete premises.

#### M01-W02 clean-clone simulation (local, committed content revision)

- `git clone <repository> <fresh directory>` at
  `981826764dc0793f7ddc984f49888afb7657d3b5` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0 in the fresh clone.
- `uv sync --locked` → exit 0 (uv-managed 3.12.13 environment recreated
  including pydantic 2.12.5 / pydantic-core 2.41.5 / annotated-types 0.8.0 /
  typing-inspection 0.4.2 from uv.lock).
- `pnpm exec playwright install chromium` → exit 0 (pinned browser cache).
- `pnpm generate:contracts --check` → exit 0, "generated contracts are up
  to date (35 files, byte-identical)" — the committed generated tree
  reproduces exactly from a clean locked install.
- `pnpm run doctor` → exit 0, 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE (contract-gen ACTIVE and PASS); working tree clean.
- `pnpm verify` → exit 0; every ACTIVE suite PASS including contract-gen;
  contract and visual honestly NOT_YET_APPLICABLE.
- `pnpm generate:contracts` (write mode) in the clone followed by
  `git status --porcelain` → zero changes: regeneration is a byte-exact
  no-op on a clean clone.

#### M01-W02 hosted three-OS content verification

- Content run 30238366390 at commit
  `981826764dc0793f7ddc984f49888afb7657d3b5` succeeded on all three
  required jobs: ubuntu-24.04 job 89890399400 (2m20s), windows-2025 job
  89890399405 (3m44s), and macos-15 job 89890399463 (1m37s).
- The complete Windows job log was downloaded and inspected: the job
  checked out exactly `981826764dc0793f7ddc984f49888afb7657d3b5`; the
  canonical doctor reported 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE with contract-gen "PASS — ACTIVE (runs inside pnpm
  verify)" and a clean working tree; aggregate verification reported
  "generated contracts are up to date (35 files, byte-identical)" — the
  deterministic generator therefore reproduces the committed trees
  byte-exactly on windows-2025 — plus contract-gen ACTIVE PASS, 188
  @japp/contracts Vitest tests, 453 Python tests
  (`453 passed in 76.45s`), `verification exit code: 0`, and the
  no-tracked-changes assertion passing (REQ-PLAT-013 infrastructure
  evidence only — not Windows 11 product certification).
- After this hosted success, M01-W02 was marked VERIFIED at content tree
  `3d4b0f16990decf6bb8dfa7e59e3b89a1628903d`, M01-W03 became the sole
  READY package, and M01 remains IN_PROGRESS. The conventional
  revision-stamp commit records this closeout; its own three-OS run is
  required to pass at the final head.
- Stamp-state validation exposed the second half of KI-0017 (the two
  M00-closeout boundary helpers inherited the live M01-W03 READY row;
  seven closeout-boundary assertions failed, 445 passed). After extending
  both helpers to reset every advanceable M01 row:
  `uv run pytest scripts/tests` → exit 0, 452 passed;
  `python3 scripts/validate_status.py` → exit 0 (36 groups);
  `pnpm traceability:check` → exit 0 (157/286); complete `pnpm verify` →
  exit 0 in the stamped state with contract-gen ACTIVE and PASS.

#### M01-W02 corrective closeout (KI-0018, 2026-07-27)

- Scope: focused repair of two defects found in post-verification review;
  all prior M01-W02 work and evidence preserved; M01-W02 temporarily
  reopened IN_PROGRESS (M01-W03 returned to NOT_STARTED) at starting HEAD
  `efd41b22b311d12055e072814bf647057fbca440` after re-confirming the clean
  tree, branch, HEAD = origin/main, the final stamp run 30238766443
  (ubuntu job 89891533670, macos job 89891533708, windows job 89891533724,
  all SUCCESS), check-mode byte-identity, validator PASS, and
  `pnpm verify` exit 0.
- Defect 1 (rollback safety): `installGeneratedTree` in
  `packages/contracts/generator/fsops.ts` rewritten as a transactional,
  rollback-safe whole-tree replacement (deliberately not described as
  atomic): unique sibling staging is materialized and byte-verified via
  `verifyMaterializedTree` before the existing tree is touched; the
  existing tree is renamed to a unique sibling backup, never deleted
  first; the verified staging tree is renamed into place; the backup is
  removed only after success; installation failure automatically restores
  the backup (`InstallRolledBackError`); rollback failure deletes nothing
  and reports every surviving directory plus the manual recovery action
  (`InstallRecoveryError`); leftovers from earlier failed runs are never
  reused or destroyed. The primitive steps sit behind the injectable
  `InstallFsOps` seam; `cli.ts` reuses the shared verification for its
  check-mode temporary materialization; `packages/contracts/README.md`
  §10a now states the guarantee honestly.
- Defect 2 (control bytes): the raw NUL join separator (line 132) and the
  raw BEL + invisible U+2028 inside the adversarial injection fixture
  (line 453) in `packages/contracts/test/generated/generator.test.ts` are
  now escaped source representations with identical runtime values; the
  emitter (`pythonStringLiteral`) additionally escapes U+2028/U+2029 in
  generated Python (no committed output contains them, so generated bytes
  are unchanged); the injection test now also asserts the sanitized BEL/
  U+2028 forms and that no generated file contains raw C0 characters.
- Tests added: `packages/contracts/test/generated/fsops-install.test.ts`
  (11 deterministic failure-injection tests: success replaces stale
  output with no staging/backup leftovers; first-time install;
  materialization failure leaves the old tree unchanged; staging
  verification failure leaves the old tree unchanged; old-tree-move
  failure leaves it installed; install failure restores the old tree
  exactly; rollback failure preserves and reports both recoverable
  trees with nothing deleted; backup-cleanup failure reports the
  surviving backup after a successful install; unique sibling paths never
  reuse earlier leftovers; the installed path is never PARTIAL at any
  observed protocol step; verifyMaterializedTree rejects inventory and
  content divergence). `scripts/tests/test_integrity.py` (3 new tests:
  generator.test.ts contains no literal NUL and keeps the escaped forms;
  every tracked .ts/.tsx/.py/.json/.md/.toml/.yaml/.yml/.mjs/.cjs/.js
  file contains no NUL and no raw C0 control bytes except tab/LF/CR;
  the detector bans C0 while allowing the text-policy trio and escaped
  representations).
- Commands and observed results (local, uncommitted working tree):
  - `pnpm install --frozen-lockfile` → exit 0 ("Already up to date").
  - `uv sync --locked` → exit 0.
  - `pnpm generate:contracts` → exit 0 (35 files); `git status` shows no
    generated-tree diff — output bytes identical under the new installer.
  - `pnpm generate:contracts --check` run twice → exit 0 both times,
    "35 files, byte-identical".
  - Focused: `pnpm --filter @japp/contracts exec vitest run
    test/generated/fsops-install.test.ts` → exit 0, 11 tests;
    `pnpm --filter @japp/contracts exec vitest run` → exit 0, 7 files,
    199 tests; `uv run pytest scripts/tests/test_integrity.py` → exit 0,
    15 passed; `uv run pytest scripts/tests -q` → exit 0, 455 passed.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`
    (unit-ts, 207 tests across 9 packages — @japp/contracts 199),
    `pnpm test:e2e` (1), `pnpm test:python` (full pytest 456 = 455
    scripts/tests + 1 orchestrator), `pnpm test:rust` → all exit 0.
  - `pnpm run doctor` → exit 0, 20 PASS / 1 WARNING (expected uncommitted
    implementation state) / 0 FAIL / 2 NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0; contract-gen ACTIVE and PASS; contract and
    visual honestly NOT_YET_APPLICABLE; status-neutral.
  - `git diff --check` → exit 0 (no whitespace/conflict markers).
- Reviewability proof: before the repair, git rendered
  `packages/contracts/test/generated/generator.test.ts` as a BINARY blob
  in diffs (the literal NUL suppressed text review); the repair diff shows
  `Bin 19947 -> 20657 bytes`, and from the repair commit onward the module
  diffs as ordinary text.
- Clean-clone simulation at repair commit
  `349fc7c16fee98d85ed547ade045baeb4f68afec`: fresh
  `git clone` → `pnpm install --frozen-lockfile` → `uv sync --locked` →
  `pnpm exec playwright install chromium` → `pnpm generate:contracts
  --check` ("35 files, byte-identical") → write-mode
  `pnpm generate:contracts` followed by `git status --porcelain` → zero
  changes → `pnpm run doctor` (21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE) → `pnpm verify` → exit 0; clean tree throughout.
- Hosted three-OS repair verification: run 30240026519 at repair commit
  `349fc7c16fee98d85ed547ade045baeb4f68afec` succeeded on all three
  required jobs: ubuntu-24.04 job 89895114904 (2m21s), windows-2025 job
  89895114913 (4m50s), and macos-15 job 89895114914 (2m34s). The complete
  Windows job log was downloaded and inspected: exact checkout of the
  repair commit; doctor 21 PASS / 0 WARNING / 0 FAIL / 2
  NOT_YET_APPLICABLE; "generated contracts are up to date (35 files,
  byte-identical)"; 456 Python tests (`456 passed in 96.08s`);
  contract-gen ACTIVE and PASS; `verification exit code: 0`.
- After this hosted success, M01-W02 was re-marked VERIFIED at the repair
  content tree `8a081776719d02ee7aeceb99bfe731f5663883c4`, M01-W03
  returned to the sole READY package, M01 remains IN_PROGRESS, M00
  remains ACCEPTED, and all four critical gates remain NOT_EVALUATED. The
  conventional restamp commit records this closeout; its own three-OS run
  is required to pass at the final head.

### M01-W01 — Define JSON Schema conventions (2026-07-26)

- Revision: tree `20c25e66d5792506870531aa4a8cd01971b362c9` / commit
  `a77a01d52fb6be9cd535c6878b902146bf637632` (verified content head; stamped
  in the conventional follow-up commit after its hosted three-OS run
  passed). Bootstrap ran at starting HEAD
  `ae01f1136a9990cd06f4271b5216148542e04097` (clean `main`, equal to
  `origin/main`).
- Environment: macOS (Apple silicon, Darwin 27.0.0); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32 with uv-managed Python 3.12.13; rustup toolchain
  1.97.1 (cargo/rustc/rustfmt/clippy); @playwright/test 1.62.0 with pinned
  Chromium; new workspace-catalog dependencies ajv 8.20.0 and
  ajv-formats 3.0.1 (exact pins, single ajv instance in pnpm-lock.yaml).
- Clean-session bootstrap (all inspected at starting HEAD):
  - `git fetch origin`, `git status --short`, `git branch --show-current`,
    `git rev-parse HEAD`, `git rev-parse origin/main`, `git log --oneline -8`
    → exit 0; clean tree; branch `main`; local HEAD and `origin/main` both
    `ae01f1136a9990cd06f4271b5216148542e04097`.
  - `gh run view 30231563100` → final M00-W10 stamp run succeeded on all
    three required jobs: ubuntu-24.04 job 89871309320, macos-15 job
    89871309329, windows-2025 job 89871309349.
  - `python3 scripts/validate_status.py` → exit 0, all 36 check groups
    passed (M00 ACCEPTED; M00-W01…W10 VERIFIED; M01-W01 sole READY; no
    IN_PROGRESS package; all four gates NOT_EVALUATED).
  - `pnpm traceability:check` → exit 0, exactly 157 requirements and 286
    work packages validated.
  - `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL and honest
    NOT_YET_APPLICABLE states for contract-gen (M01-W02), contract
    (M01-W05), and visual (M10-W06).
  - `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts,
    e2e-browser, python, rust, portability, traceability, status, and
    integrity suites all passed; the three inactive suites reported
    NOT_YET_APPLICABLE.
- Implementation delivered after the passing bootstrap (packages/contracts):
  - `schemas/common/` — twelve hand-authored Draft 2020-12 foundational
    documents (stable-id, schema-version, timestamp-utc, calendar-date,
    enum-token, money, location, provenance, confidence, redaction,
    correlation, envelope) plus the test-only composition fixture
    `schemas/fixture/test-record.v1.schema.json`; every document declares
    `$schema` Draft 2020-12, a unique `urn:japp:schema:…:v<major>` `$id`
    matching its path, and `x-japp-schema-version`.
  - `src/` — deterministic offline catalog loader with fail-closed
    convention checks (`conventions.ts`, `catalog.ts`), strict Ajv 2020
    validator with full-mode date/date-time formats, the five registered
    `x-japp-*` annotation keywords, meta-schema validation and no remote
    resolution (`validator.ts`), the major/minor acceptance policy
    (`versioning.ts`), and two-phase enveloped-record validation
    (`envelope.ts`).
  - `test/schema/` — positive/negative convention, definition, and
    envelope/versioning suites (deliberately not `test/contract/`, which
    stays reserved for M01-W05).
  - `README.md` — the normative convention document (ownership, layout,
    reconstruction, versioning/compatibility policy, redaction vocabulary,
    null-versus-missing, no-defaults/no-coercion, extension mechanism,
    validation configuration, M01-W02 generation boundaries).
- Traceability and governance updates in this package:
  - M01-W01 marked IN_PROGRESS in docs/PROJECT_STATUS.md and mirrored in
    docs/traceability.json (single-line JSON state change; canonical
    serialization preserved); docs/REQUIREMENTS_TRACEABILITY.md regenerated.
  - REQ-PLAT-005 stays honestly `SCAFFOLD_ONLY`/`NOT_YET_APPLICABLE` and now
    records only the implemented schema-versioning portion (evidence anchor
    `### M01-W01`, six code paths, two test paths, and notes naming the
    future owners M01-W02, M04-W02, and M05). This is a reviewed intentional
    update of the expanded requirement hash: docs/traceability.json and the
    independently pinned `FINAL_V1_3_REQUIREMENT_MAPPING_SHA256` in
    scripts/traceability.py moved together from
    `4e18c9533e49cfc4eefd5774bb17cb51a19b8f51b97e430900ee06a8fce7445b` to
    `2f6fcd94dcf6b7aa9e2a686683cc8243d25138addc0fac049f2bfc0a7416bcaf`;
    the preserved v1.2 hashes and the v1.3 package-dependency hash are
    unchanged. Regression coverage added:
    `test_versioning_requirement_claim_stays_partial_after_m01_w01` and
    `test_reviewed_plat_005_evidence_tamper_fails_after_self_rehash`
    (plus the trace-repo fixture now carries the referenced contract files).
  - KI-0015 (MEDIUM, FIXED) recorded in docs/KNOWN_ISSUES.md: one status
    negative inherited the pre-M01 idle premise and was repaired to
    establish its own complete premise (same class as KI-0014).

#### M01-W01 implementation validation (local, uncommitted working tree)

- `pnpm install --frozen-lockfile` → exit 0 ("Already up to date"; lockfile
  carries the new exact catalog pins ajv 8.20.0 and ajv-formats 3.0.1).
- `uv sync --locked` → exit 0 (resolved 17, checked 15 packages; no Python
  dependency changes).
- `pnpm traceability:generate` then `pnpm traceability:check` → exit 0,
  157 requirements and 286 work packages validated after the M01-W01 state,
  REQ-PLAT-005, and reviewed-hash updates.
- `python3 scripts/validate_status.py` → exit 0, all 36 check groups passed
  with M01-W01 IN_PROGRESS as the single active package.
- `pnpm run doctor` → exit 0, 19 PASS / 1 WARNING / 0 FAIL / 3
  NOT_YET_APPLICABLE; the only warning is the expected "uncommitted changes
  present" working-tree state during implementation (the clean-clone run
  below shows 20 PASS / 0 WARNING).
- `pnpm lint` → exit 0 (typed strict + stylistic ESLint over the workspace,
  including the new src/ and test/schema/ code).
- `pnpm format:check` → exit 0 (Prettier + Ruff format + rustfmt).
- `pnpm typecheck` → exit 0 (turbo tsc over all packages, root Playwright
  project, strict mypy over services and scripts).
- `pnpm test` → exit 0 (unit-ts suite; per-package Vitest proofs).
- Focused contracts suites: `pnpm --filter @japp/contracts exec tsc -p
  tsconfig.json` → exit 0; `pnpm --filter @japp/contracts exec vitest run`
  → exit 0, 4 test files, 71 tests passed (workspace wiring plus
  test/schema/conventions.test.ts, definitions.test.ts, envelope.test.ts:
  catalog conventions and determinism, per-definition positive/negative
  instances, annotation-vocabulary compile rejections, envelope/version
  policy, null-versus-missing, extension mechanism, offline-only
  resolution, duplicate-$id rejection, catalog loading failures).
- `pnpm test:e2e` → exit 0 (1 Playwright pinned-Chromium smoke test).
- `pnpm test:python` → initially FAILED exposing KI-0015 (1 failed / 359
  passed); after the premise repair `uv run pytest` → exit 0, 360 passed
  (90 status-validator tests and 62 traceability tests, including the two
  new REQ-PLAT-005 regressions).
- `pnpm test:rust` → exit 0 (fmt, clippy -D warnings, 1 cargo test, build).
- `pnpm verify` → exit 0; toolchain, format, lint, typecheck, unit-ts (79
  Vitest tests across 9 packages), e2e-browser, python (360), rust,
  portability, traceability, status, and integrity suites all PASS;
  contract-gen (M01-W02), contract (M01-W05), and visual (M10-W06) remain
  honestly NOT_YET_APPLICABLE and inactive.

#### M01-W01 clean-clone simulation (local, committed content revision)

- `git clone <repository> <fresh directory>` at
  `a77a01d52fb6be9cd535c6878b902146bf637632` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0 in the fresh clone.
- `uv sync --locked` → exit 0 (uv-managed 3.12.13 environment recreated).
- `pnpm exec playwright install chromium` → exit 0 (pinned browser cache).
- `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL / 3
  NOT_YET_APPLICABLE; working tree clean.
- `pnpm verify` → exit 0; every ACTIVE suite PASS; contract-gen, contract,
  and visual honestly NOT_YET_APPLICABLE.

#### M01-W01 hosted three-OS content verification

- Content run 30234552561 at commit
  `a77a01d52fb6be9cd535c6878b902146bf637632` succeeded on all three
  required jobs: windows-2025 job 89879728959 (4m53s), macos-15 job
  89879728973 (2m58s), and ubuntu-24.04 job 89879729025 (2m21s).
- The complete Windows job log was downloaded and inspected: the job checked
  out exactly `a77a01d52fb6be9cd535c6878b902146bf637632`; the canonical
  doctor reported 20 PASS / 0 WARNING / 0 FAIL / 3 NOT_YET_APPLICABLE with a
  clean working tree; aggregate verification reported every ACTIVE suite
  PASS with 71 @japp/contracts Vitest tests, 360 Python tests
  (`360 passed in 75.95s`), and `verification exit code: 0`; the schema
  suites therefore execute identically on Windows (deterministic
  catalog/loading behavior, REQ-PLAT-013 infrastructure evidence only — not
  Windows 11 product certification).
- After this hosted success, M01-W01 was marked VERIFIED at content tree
  `20c25e66d5792506870531aa4a8cd01971b362c9`, M01-W02 became the sole READY
  package, and M01 remains IN_PROGRESS. The conventional revision-stamp
  commit records this closeout; its own three-OS run is required to pass at
  the final head.
- Stamp-state validation exposed and fixed KI-0016 (M00-closeout fixture
  helpers inherited pre-M01 boundary rows; eight fixture assertions).
  After the premise repairs: `uv run pytest scripts/tests` → exit 0,
  359 passed; `python3 scripts/validate_status.py` → exit 0 (36 groups);
  `pnpm traceability:check` → exit 0 (157/286); complete `pnpm verify` →
  exit 0 in the stamped state with contract-gen still honestly
  NOT_YET_APPLICABLE while M01-W02 is READY-but-unbegun.

### M00-W10 — Extend traceability and re-accept M00 under v1.3 (2026-07-26)

- Revision: tree `30c575dcc142a8276f0aed754cac50ed1fc3ab75` / commit
  `ef830d91e7a6bffe3c74825b98405ce379cc7187` (final verified content head
  after fail-closed Windows and closeout-fixture repairs; stamped in the
  conventional follow-up commit after its hosted three-OS run passed).
- Independent clean-session bootstrap:
  - `git fetch origin`, `git status --short`, `git branch --show-current`,
    `git rev-parse HEAD`, and `git rev-parse origin/main` → exit 0; clean
    `main`; local HEAD and `origin/main` both
    `c09faaf02e546a1d57f402f18341087b21da492d`.
  - `python3 scripts/validate_status.py` → exit 0, all 35 bootstrap check
    groups passed.
  - `pnpm traceability:check` → exit 0, exactly 157 requirements and 286
    work packages validated.
  - `pnpm run doctor` → exit 0, 20 PASS / 0 WARNING / 0 FAIL / 3 honest
    NOT_YET_APPLICABLE suite states.
  - `pnpm verify` → exit 0; 248 Python tests, nine fresh workspace Vitest
    tests, one Playwright browser smoke test, and one Rust test passed;
    status, traceability, portability, and integrity suites passed.
- Independent history and hosted-evidence audit:
  - Inspected the complete diffs
    `0f8059c97d1167d6bb34413bae5c1c3c44b1ae37..33b012e1d30fa82b62ee0ce02746b56839c4816b`
    and
    `33b012e1d30fa82b62ee0ce02746b56839c4816b..c09faaf02e546a1d57f402f18341087b21da492d`
    rather than relying on the prior implementation report.
  - Inspected actual GitHub Actions metadata and all six job logs for
    M00-W09 content run 30226212092 (macOS 89856707366, Windows
    89856707365, Ubuntu 89856707333) and final-head run 30226415354
    (Windows 89857236382, macOS 89857236428, Ubuntu 89857236430). Both
    revisions and all jobs succeeded; every job checked out its exact head
    and ran the same locked installs plus `pnpm run doctor` and
    `pnpm verify`. The Windows Server 2025 jobs remain infrastructure
    evidence only, not Windows 11 product certification.
- Human-reviewed traceability audit:
  - Compared all 22 new requirement records (`REQ-PLAT-011…026`,
    `REQ-GATE-017…022`) against exact §4 text/family, §9 owners, planned
    components, automated/manual/native/benchmark evidence, gate/release
    effects, and actual repository state.
  - Compared all 26 new package records against exact IDs/titles,
    sequential direct prerequisites, milestone/accepted/gate prerequisites,
    primary deliverables, package-specific automated/manual/native proof,
    direct downstream packages/milestones, and current evidence.
  - Confirmed all dependency edges and readiness qualifiers were correct.
    Corrected `REQ-PLAT-013` to verified repository-infrastructure evidence;
    recorded `REQ-PLAT-025` as `SCAFFOLD_ONLY` because shell-neutral
    repository commands exist while M03-W09 packaged runtime discovery does
    not; kept every future product requirement/package honest and without
    current implementation evidence.
  - Preserved the v1.2 requirement hash
    `c2b4275f13d1074dea1532ae8d2a9020668eb44751c371e562cc78e46844eec9`
    and dependency hash
    `bb42505238220f4b3230456f2a8c03ded62308e12b8773714fc9c559175fdb5f`.
    The final reviewed v1.3 requirement-mapping hash is
    `4e18c9533e49cfc4eefd5774bb17cb51a19b8f51b97e430900ee06a8fce7445b`;
    the final reviewed package dependency/proof-plan hash is
    `549e793e447ba43d11d43992e81a0fb8137a4ebb6da1db9c04b4bce226707760`.
    Both are independently pinned in `scripts/traceability.py`, not merely
    recomputed against mutable companion values in the JSON.
  - Kept all 135 legacy requirement records and 260 legacy package records
    at `REVIEWED_V1_2`; promoted exactly the 22/26 v1.3 delta to
    `REVIEWED_V1_3`; and removed every live
    `PROVISIONAL_PENDING_M00_W10` state. The expanded requirement hash locks
    reviewed mappings plus honest implementation/verification state,
    completed paths, evidence, and notes. The expanded package hash locks
    prerequisites/downstream effects plus package-specific deliverable and
    automated/manual proof plans while live state/revision/evidence remain
    status-owned.
- Independent audit findings and resolutions:
  - KI-0007: the provisional expanded hashes could be refreshed from the
    same edited JSON. Pinned final reviewed hashes and isolated self-rehash,
    mapping, dependency, proof-plan, honesty, and evidence-substitution
    negatives now fail closed.
  - KI-0008: generic workflow text named Claude, v1.3 had generalized
    historical ADR-0001/OD-020 facts, and the PyYAML comment omitted its
    production consumer. Generic wording is now agent-neutral; exact v1.2
    routing facts are restored with explicit prospective ADR-0002/OD-026
    supersession; the dependency comment names
    `scripts/check_portability.py`.
  - KI-0009: Windows home redaction was casing/separator-sensitive and early
    fatal diagnostics bypassed it. Native, forward-slash, mixed-case, UNC,
    boundary, and fatal paths now share fail-closed redaction without
    over-redacting unrelated text; POSIX matching stays case-sensitive.
  - KI-0010: portability predicates admitted disconnected matrices and
    scanned inert docstrings/comments. The checker now proves one exact
    three-OS `matrix.os` job owns both unguarded canonical commands; rejects
    weaker guards, masking, extra/excluded axes, runtime path aliases, and
    executable banned constructs; and ignores module/class/function
    docstrings, type metadata, YAML comments, and PowerShell block comments.
    The valid workflow required no change.
  - KI-0011: arbitrary nonempty Gate D evidence could satisfy future PASS
    checks. PASS now requires resolvable, repository-relative, owner-scoped
    evidence; unique accepted profile/platform/native-messaging/package
    rows; non-placeholder metrics; zero zero-tolerance failures; M27-W12
    decision ownership; and report/ledger/status revision, hash, reviewer,
    owner-decision, and holdout agreement. Gate D remains NOT_EVALUATED and
    no evidence was fabricated.
  - KI-0012: M00 closeout, current/next-work, release, gate-report, and
    preserved-revision checks admitted inconsistent states. The validator
    now requires all ten M00 packages exactly VERIFIED before acceptance,
    makes M01/M01-W01 READY with M01-W01 the sole READY package after valid
    closeout, preserves W01…W09 anchors, and rejects premature gates or
    mismatched status/report/ledger/header state.
- Environment: macOS 27.0 arm64; Node v24.18.0; pnpm 11.17.0; uv
  0.11.32; uv-managed CPython 3.12.13; rustc/cargo 1.97.1; Playwright
  1.62.0 with pinned Chromium.
- Focused post-change verification:
  - `uv run ruff format --check ...`, `uv run ruff check ...`, and
    `uv run mypy scripts/traceability.py scripts/validate_status.py
    scripts/check_portability.py scripts/doctor.py` → exit 0.
  - `uv run pytest scripts/tests -q` → exit 0, 357 passed. The isolated
    fixture coverage includes reviewed-state/hash tampering, deterministic
    JSON/Markdown generation, exact M00/M01 readiness, false Gate D
    evidence, Windows redaction variants, inert-prose false positives,
    executable banned constructs, disconnected/dummy matrices, guarded
    commands, and verification read-only/fail-closed behavior.
  - `python3 scripts/validate_status.py` → exit 0, all 36 current-state
    check groups passed; `pnpm traceability:check` → exit 0 at exactly
    157 requirements / 286 packages; and
    `uv run python scripts/check_portability.py` → exit 0.
  - `pnpm run doctor` → exit 0, 19 PASS / one expected dirty-tree WARNING /
    zero FAIL / three honest NOT_YET_APPLICABLE future suites.
  - Complete focused suites: traceability 60/60; status validator 90/90;
    portability plus CI policy 126/126; doctor 45/45; verification,
    integrity, proof, and suite-state tests 36/36.
- Complete local validation:
  - `pnpm install --frozen-lockfile`, `uv sync --locked`, and
    `cargo fetch --locked --manifest-path services/native-host/Cargo.toml`
    → exit 0; all 13 workspace projects were current, 17 Python packages
    resolved / 15 checked, and the locked Rust dependency graph fetched.
  - `pnpm traceability:generate` twice → exit 0 and the generated view
    remained byte-identical at SHA-256
    `f5abc375054f86eb04facb1fba1f4bb28a4a861693aee1daab500a096f10c5e4`;
    `pnpm traceability:check` remained read-only and validated 157/286.
  - `pnpm run doctor --json` twice → exit 0 and byte-identical output
    (SHA-256
    `8a7fa714ed890856cdee7ec8821e387af3aaf7d367b5e6d070145b9172390fe6`);
    human output remained 19 PASS / one expected dirty-tree WARNING / zero
    FAIL / three honest NOT_YET_APPLICABLE.
  - `pnpm preflight`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
    `pnpm test`, `pnpm test:e2e`, `pnpm test:python`, and
    `pnpm test:rust` each exited 0. Results were nine workspace Vitest
    tests/typechecks, one controlled Chromium test, 358 total Python tests
    including the orchestrator smoke test, and one Rust test plus rustfmt,
    Clippy `-D warnings`, and build.
  - Final working-tree `pnpm verify` → exit 0: toolchain, format, lint,
    typecheck, unit-ts, e2e-browser, Python, Rust, portability,
    traceability, status, and integrity were ACTIVE/PASS; contract-gen,
    contract, and visual remained honestly NOT_YET_APPLICABLE. A before/
    after porcelain comparison proved the aggregate verifier made no
    tracked-state change.
  - `git diff --check` → exit 0; the canonical specification remained the
    sole canonical file, its SHA-256 remained
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`,
    and its 39/286/157/four inventory remained exact.
- Local clean-clone simulation:
  - Cloned the repository with `git clone --no-local` into a new
    `mktemp -d` location, applied the complete binary working diff, committed
    the fixture at tree
    `b2faf78920dae74e995c0a1e7969485628113ee4`, and ran the same locked pnpm,
    uv, and Cargo setup without reusing the source checkout's dependency
    directories.
  - In that clean clone, `pnpm traceability:check` validated 157/286,
    `python3 scripts/validate_status.py --quiet` passed 36 groups,
    `pnpm run doctor` reported 20 PASS / zero WARNING / zero FAIL / three
    honest NOT_YET_APPLICABLE, and `pnpm verify` passed all active suites
    with 358 Python, nine workspace Vitest, one Chromium, and one Rust test.
    Final `git status --short` was empty, proving installs and verification
    were read-only.
- Hosted verification was fail-closed: no local result, partial OS result,
  rerun, or superseded head was treated as M00 acceptance.
- First hosted content attempt and fail-closed response:
  - Content commit `a8630ccffdfdc4faf037dd3a3d127a7fc50bea11`
    (tree `467c5398c8d82b0c2885a9e3acffb0cdfdc3876d`) triggered run
    30229993787. macOS job 89866914146 and Ubuntu job 89866914187 passed
    the canonical doctor, aggregate verification, and no-tracked-changes
    assertion. Windows job 89866914158 failed, so M00 was not accepted.
  - Inspection of the actual Windows log found 356/358 Python tests passed;
    the only failures were two new doctor-test assertions that converted a
    simulated POSIX `Path` to Windows syntax and hard-coded `/` in an
    otherwise correctly redacted native Windows diagnostic. The runtime
    Windows native/forward-slash, case, UNC, boundary, and fatal redaction
    cases themselves passed.
  - KI-0013 records the defect. The repair preserves explicit POSIX test
    syntax as a string and derives the expected fatal diagnostic path with
    the host-native `Path` separator.
- First repair attempt and fail-closed response:
  - Repair commit `27b6bec62d5fc41e7d35c9cd11c4e77e99c1bb65`
    (tree `a44d40315100f9621e36d4277ab6785e4ff18ab5`) triggered run
    30230286865. macOS job 89867742632 and Ubuntu job 89867742629 passed
    the canonical doctor, aggregate verification, and no-tracked-changes
    assertion. Windows job 89867742638 failed, so M00 remained unaccepted.
  - Inspection of the actual Windows log found 357/358 Python tests passed.
    The sole failure was the repaired fatal-path test: the expected native
    path used single `\` separators, while `FileNotFoundError` correctly
    escaped them when rendering its filename. All runtime redaction cases
    and every other active verification suite passed.
  - The second repair normalizes only duplicated backslashes in the
    exception-rendered diagnostic before asserting both the redacted path
    and the independent guarantee that the sensitive home is absent.
- Superseded repair proof:
  - Commit `f8d054ca946b784a771c3a9bed7bbec6b92f465f` (tree
    `21f0801fc08d1f0f4224ce9a1bf5a2c4f713fbc6`) passed run 30230595021:
    macOS job 89868613527, Windows job 89868613536, and Ubuntu job
    89868613559 all succeeded. Before acceptance, an independent review
    found that normalizing only the expected-path assertion could let an
    escaped sensitive home evade the separate absence check. That head was
    therefore superseded despite green CI.
  - The final assertion normalizes the exception-rendered diagnostic once
    and applies both the sensitive-home absence check and the expected
    redacted-path check to the normalized text. Focused doctor tests
    (45/45) and a fresh complete local `pnpm verify` (358/358 Python plus
    every other active suite) passed before the stronger head was pushed.
- Hosted reviewed-content proof:
  - Reviewed-content commit `a26f9a8f58ab2d63a377cd8f1839a83495f00272`
    (tree `34a8c104a42b56f31834b9302d7084a6084b7633`) passed workflow run
    30230657314: `doctor + verify (macos-15)` job 89869050876,
    `doctor + verify (windows-2025)` job 89869050915, and
    `doctor + verify (ubuntu-24.04)` job 89869050931 all concluded SUCCESS.
  - The inspected Windows log proves the exact commit checkout, pinned
    installs, doctor result 20 PASS / zero WARNING / zero FAIL / three
    honest NOT_YET_APPLICABLE suites, 358/358 Python tests, portability and
    36-group status validation, aggregate verification exit 0, and a
    successful no-tracked-changes assertion. This remains
    repository/toolchain infrastructure evidence, not Windows 11 product,
    secure-store, native-messaging, model-runtime, installer, updater, or
    Gate D evidence.
- Closeout-fixture finding and final content repair:
  - When the acceptance-only state was applied locally, the first complete
    `pnpm verify` failed closed with 357/358 Python tests. The sole failure,
    `test_next_ready_none_must_be_exact`, inherited the repository's new
    accepted-M00 baseline, changed M00-W10 to NOT_STARTED, but left
    M01-W01 READY; its asserted “no READY row” condition was therefore not
    isolated. The validator itself continued to reject the invalid state,
    and standalone 36-group status validation passed.
  - KI-0014 records the fixture defect. The test now uses the existing
    `prepare_m00_closeout(..., m01_ready=False)` fixture to establish its
    exact no-READY premise before injecting malformed `NONE nonsense`.
    The complete status suite passed 90/90 and `pnpm verify` passed all 358
    Python tests plus every other active suite in the actual accepted-M00
    closeout state.
  - Final content repair commit
    `ef830d91e7a6bffe3c74825b98405ce379cc7187` (tree
    `30c575dcc142a8276f0aed754cac50ed1fc3ab75`) passed workflow run
    30231197511: Ubuntu job 89870307756, Windows job 89870307759, and
    macOS job 89870307817 all concluded SUCCESS. The inspected Windows log
    proves exact checkout, doctor 20/0/0 with three honest
    NOT_YET_APPLICABLE suites, 358/358 Python tests, portability and status
    success, aggregate verification exit 0, and the no-tracked-changes
    assertion.
- Acceptance decision:
  - All 39 milestones, 286 packages, 157 requirements, four gate records,
    required project-memory/platform files, preserved W01…W09
    revisions/evidence, reviewed v1.3 mappings, stable hashes,
    deterministic generation, local/clean-clone verification, negative
    paths, and hosted three-OS content proof satisfy the complete v1.3 M00
    exit gate at content tree
    `30c575dcc142a8276f0aed754cac50ed1fc3ab75`.
  - A final `git clone --no-local` accepted-state simulation applied the
    complete pre-stamp closeout diff over that content revision and committed
    fixture tree `ba9d605fe3d34844aba6e16222e7abeb59456be2`. Fresh frozen/locked
    pnpm, uv, and Cargo setup passed; traceability validated 157/286; status
    passed 36 groups; doctor reported 20 PASS / zero WARNING / zero FAIL /
    three honest NOT_YET_APPLICABLE suites; `pnpm verify` passed 358 Python,
    nine workspace Vitest, one Chromium, and one Rust test; final porcelain
    was empty.
  - M00-W10 is VERIFIED; M00 is ACCEPTED; M01 and only M01-W01 are READY;
    no package is IN_PROGRESS; all four gates remain NOT_EVALUATED; overall
    release remains NOT_READY. No M01 implementation began. The
    conventional revision-stamp HEAD must independently pass all three
    hosted jobs before handoff; its terminal run is reported at handoff
    rather than creating another evidence-only successor commit.

### M00-W09 — Add Windows CI and platform-portability baseline (2026-07-26)

- Revision: tree `ae69a908cc31e0f1282c136c25fb7f92752680dd` / commit
  `0e27802802b2397169c74d0f0c563506980041b0` (stamped in the conventional
  follow-up commit after its hosted three-OS content run passed).
- Starting prerequisite: `main` was clean at
  `33b012e1d30fa82b62ee0ce02746b56839c4816b`, equal to `origin/main`.
  Final M00-W08 stamp run 30223489467 passed macOS job 89849840494 and
  Ubuntu job 89849840515. `python3 scripts/validate_status.py` (35 groups),
  `pnpm traceability:check` (157/286), `pnpm run doctor` (19 pass / 0 fail /
  3 honest NOT_YET_APPLICABLE), and `pnpm verify` (exit 0) all passed before
  any edit. M00-W01…W08 were VERIFIED, M00-W09 was READY, M00-W10 and
  M01-W01 were NOT_STARTED, no package was IN_PROGRESS, and all four
  critical gates were NOT_EVALUATED.
- Environment: macOS 27.0 arm64 (primary dev machine); Node v24.18.0;
  pnpm 11.17.0; uv 0.11.32; uv-managed CPython 3.12.13; rustc 1.97.1 with
  rustfmt/clippy via the rust-toolchain.toml override; Playwright 1.62.0
  with pinned Chromium. Windows facts were verified against the
  actions/runner-images windows-2025 manifest before implementation
  (Rust 1.97.1 + rustup 1.29 preinstalled, Pipx 1.16 with a machine-PATH
  bin dir, PowerShell 7.6, Node 24.18.0 in the tool cache, and the
  actions/python-versions Windows layout that ships a `python3.exe`
  symlink), and actual Windows execution is claimed only from the hosted
  windows-2025 job — never a mocked local result.
- Windows CI architecture (.github/workflows/ci.yml):
  - The single `verify` job matrix is exactly
    `[macos-15, windows-2025, ubuntu-24.04]`; every OS runs the identical
    canonical `pnpm run doctor` and `pnpm verify` steps unguarded (no
    weaker Windows subset), then a shared pwsh no-tracked-changes gate.
  - Shell policy: no workflow-global bash default. Single-command steps
    declare no shell (native per-OS defaults propagate exit codes);
    multi-line bash steps are guarded `runner.os != 'Windows'`; Windows
    scripting uses pwsh with `$ErrorActionPreference = 'Stop'` +
    `$PSNativeCommandUseErrorActionPreference = $true`.
  - Windows toolchain isolation: the Windows Rust step installs exact
    1.97.1 with `--profile minimal --component rustfmt --component clippy`
    into a fresh `RUSTUP_HOME` under `runner.temp` (asserted absent first,
    persisted via GITHUB_ENV, never cached) and probes
    `rustup show active-toolchain`, `rustup which cargo/rustc` vs the
    PATH proxies, `cargo/rustc/rustfmt/cargo clippy --version`, plus the
    `+1.97.1` proxy checks — mirroring the POSIX step.
  - Frozen/locked installs on every OS: `pnpm install --frozen-lockfile`,
    `uv sync --locked`, `cargo fetch --locked`, and
    `pipx install "uv==<pyproject pin>"`; Chromium installed per OS
    (`--with-deps` only on Linux). Caches (pnpm store, uv, cargo
    registry/git, Playwright) carry runner.os + runner.arch +
    hashFiles keys, gained the Windows locations
    (`~/AppData/Local/uv/cache`, `~/AppData/Local/ms-playwright`), and
    still have no restore-keys; failure-only Playwright artifact upload
    is unchanged with a per-OS artifact name.
- Doctor/runner portability (scripts/portability.py, scripts/doctor.py,
  scripts/verify.py):
  - New shared `scripts/portability.py` resolves executables with
    injectable platform flavor, PATH entries, PATHEXT, and probes:
    PATHEXT/.exe/.cmd and case-insensitive semantics on Windows (no
    executable-bit requirement), executable bit on POSIX; runtime callers
    execute the resolved absolute path (cwd never searched).
  - `doctor.py` gained injectable `platform_id`/`home`, a `platform`
    check, per-platform remediation (winget/rustup-init/PowerShell wording
    on Windows — never Homebrew), home redaction in both `\\` and `/`
    spellings, and PATH/PATHEXT-aware child spawning; `verify.py` maps the
    registry's literal `python3` onto its own pinned interpreter and
    resolves all other commands the same way;
    `traceability.py generate` now writes the view with `newline="\n"`.
  - `.gitattributes` (`* text=auto eol=lf`) makes checkouts byte-identical
    on every platform; all 102 tracked text files were already LF.
- Platform scaffold: `packages/platform` (`@japp/platform`) with
  package.json, tsconfig, ownership README, ownership-notice entry point,
  and the standard workspace-wiring smoke test. No M01-W07 interface, no
  secure-store/native-messaging/model/installer/product behavior. Turbo
  and Vitest discovery proofs now count 9 workspace packages.
- Static portability policy (scripts/check_portability.py; new mandatory
  always-active `portability` suite in scripts/verification-suites.json,
  owner M00-W09): PORT-CI-001…018 enforce the exact three-OS matrix,
  unguarded canonical commands, per-step shell discipline, no POSIX-only
  tokens in Windows-reachable steps, no continue-on-error or masked child
  failures, SHA-pinned official actions, read-only permissions,
  persist-credentials: false, frozen/locked installs, exact Rust probes,
  runner.temp-isolated uncached RUSTUP_HOME, an allowlisted dependency
  cache set (rejecting toolchain state, build output, profiles, or
  private data), per-OS Chromium installs, failure-only test-results
  uploads, and no live-site URLs. PORT-SRC-001…008 reject hard-coded
  /tmp//bin//usr//etc//var literals, shell=True and bash-wrapper strings,
  manual separator concatenation, X_OK/chmod outside the designated
  scripts/portability.py module, case-colliding tracked paths, a missing
  LF .gitattributes rule, POSIX-only package.json scripts, and non-allowlisted
  registry command heads. Scans are AST/structure-based over executable
  surfaces only; documentation, scripts/tests fixtures, comments, and URL
  literals cannot false-positive (proven by dedicated tests).
- Commands and observed results (current repository state, in order):
  - `pnpm install --frozen-lockfile` → exit 0 (13 workspace projects
    after adding @japp/platform; pnpm-lock.yaml updated intentionally).
  - `uv sync --locked` → exit 0 (17 resolved / 15 checked).
  - `pnpm run doctor` → exit 0: 19 PASS (including the new Host platform
    check), expected dirty-tree WARNING during development, 0 FAIL,
    3 honest NOT_YET_APPLICABLE suites.
  - `pnpm run doctor --json` twice → exit 0, byte-identical payloads
    (stable machine-readable output).
  - `uv run python scripts/check_portability.py` → exit 0 on the real
    repository (both verbose and --quiet forms).
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, `pnpm test:rust` → each exit 0.
    Results: 9/9 turbo typecheck tasks + root tsc + strict mypy over 17
    source files; 9/9 package Vitest runs; 1/1 pinned-Chromium smoke;
    248/248 Python tests; 1/1 Rust test plus rustfmt, Clippy
    `-D warnings`, and build.
  - Focused suites: `uv run pytest scripts/tests/test_doctor.py -q` →
    33 passed (13 new Windows simulations: healthy Windows run with
    0 FAIL on Windows-native toolchain paths; wrong Node/missing
    pnpm/missing uv/wrong Python patch/missing rustup proxy/wrong
    toolchain/missing rustfmt+clippy/missing Chromium all FAIL with
    Windows-specific, Homebrew-free remediation; drive-letter +
    space/Unicode home redaction; CRLF pin files; unresolvable-command
    diagnosis). `uv run pytest scripts/tests/test_ci_workflow.py -q` →
    40 passed. `uv run pytest scripts/tests/test_portability.py -q` →
    50 passed (Windows .exe/.CMD/PATHEXT/case/space/Unicode/drive-letter
    resolution and no-execute-bit semantics via injected environments;
    baseline policy fixture clean; every PORT-CI/PORT-SRC negative fires;
    guarded platform-specific equivalents permitted; docs/test-fixture/
    comment/URL literals produce no false positives; real repository
    passes; registry `python3` maps to the pinned interpreter).
  - Full regression: `uv run pytest -q` → 248 passed, 0 failed
    (M00-W04 runner/proof, M00-W05/W06 status+CI+doctor, M00-W07
    traceability, and M00-W08 inventory suites all green; the only
    expectation updates are the intended inventory growth to 9 workspace
    packages and the new always-active portability suite).
  - `pnpm traceability:generate` then `pnpm traceability:check` → exit 0,
    157 requirements / 286 work packages; regeneration is deterministic.
  - `python3 scripts/validate_status.py` → exit 0, 35/35 check groups at
    the final status state (M00-W09 VERIFIED `stamp pending`, M00-W10
    READY, no IN_PROGRESS).
  - Final `pnpm preflight` → exit 0 (doctor, then the canonical
    aggregate); final `pnpm verify` → exit 0 with toolchain, format,
    lint, typecheck, unit-ts, e2e-browser, python, rust, portability,
    traceability, status, and integrity ACTIVE/PASS and contract-gen,
    contract, visual honestly NOT_YET_APPLICABLE.
  - Clean-clone simulation: `git clone . <temp>` +
    `pnpm install --frozen-lockfile` + `uv sync --locked` +
    `python3 scripts/validate_status.py` + `pnpm traceability:check` +
    `uv run python scripts/check_portability.py` + `pnpm run doctor`
    inside the clone → all exit 0 (Chromium-dependent probes reuse the
    machine's installed pinned browser; full aggregate verification in a
    clean clone is otherwise identical to the in-repo run).
- Test counts: 248 Python (incl. 33 doctor, 40 workflow, 50 portability),
  9 Vitest packages, 1 Playwright smoke, 1 Rust; 0 failed, 0 skipped.
- Artifacts: none retained (all suites passed; Playwright artifacts are
  failure-only).
- Security/supply-chain: read-only workflow token unchanged; only
  SHA-pinned official `actions/*` actions; no third-party Windows setup
  action introduced (official actions plus repository commands and the
  preinstalled runner pipx/rustup are sufficient); no secrets, live-site
  tests, environment dumps, browser profiles, or user data in CI, caches,
  or artifacts; the portability suite now enforces these properties
  deterministically on every platform.
- Honest scope: the windows-2025 job is a repository/toolchain
  portability baseline. Windows product certification remains
  NOT_YET_IMPLEMENTED; passing windows-2025 CI does not prove packaged
  Windows 11 desktop support; CROSS_PLATFORM_CORE remains NOT_EVALUATED;
  no Windows secure-store, native-messaging, local-model, installer,
  update, or product claim exists (docs/PLATFORM_SUPPORT.md,
  docs/platform/CERTIFIED_MATRIX.md).
- Hosted content proof: workflow run 30226212092 at content commit
  `0e27802802b2397169c74d0f0c563506980041b0` passed all three required
  jobs on the first attempt — `doctor + verify (macos-15)` job
  89856707366 (1m39s), `doctor + verify (windows-2025)` job 89856707365
  (3m42s), and `doctor + verify (ubuntu-24.04)` job 89856707333 (2m3s).
  The inspected Windows log confirms Microsoft Windows Server 2025
  (10.0.26100, image windows-2025-vs2026), a read-only GITHUB_TOKEN,
  pipx-installed `uv 0.11.32 (x86_64-pc-windows-msvc)`, Rust
  `1.97.1-x86_64-pc-windows-msvc` installed into the isolated
  `D:\a\_temp/rustup-home` selected by the rust-toolchain.toml override
  with `rustup which cargo/rustc` resolving inside that home and distinct
  PATH proxies, uv-managed CPython 3.12.13, the canonical
  `pnpm run doctor` reporting `Host platform PASS (windows)` with
  `summary: 20 pass, 0 warning, 0 fail, 3 not-yet-applicable`, and the
  canonical `pnpm verify` finishing `verification exit code: 0` with
  unit-ts, e2e-browser, python, rust, and portability (among all
  mandatory suites) ACTIVE/PASS and no tracked changes afterward. The
  final revision-stamp HEAD requires its own successful three-OS run
  before closeout.

### M00-W08 — Adopt and migrate the v1.3 cross-platform rebaseline (2026-07-26)

- Revision: tree `e05dbf9bdf9c190e8cd6b022d9611d65805740b7` / commit
  `9bb12322b993d233017d53bfa14f853c5fc86e34` (stamped in the conventional
  follow-up commit after its hosted content run passed).
- Starting prerequisite: `main` was clean at
  `0f8059c97d1167d6bb34413bae5c1c3c44b1ae37`, equal to `origin/main`.
  Final v1.2 workflow run 30220655705 passed macOS job 89842408688 and
  Ubuntu job 89842408669. `python3 scripts/validate_status.py`,
  `pnpm traceability:check`, `pnpm run doctor`, and `pnpm verify` all exited
  0 before adoption; v1.2 was exactly 39 milestones / 260 packages /
  135 requirements / 3 gates, M00-W01…W07 were VERIFIED, M00 was ACCEPTED,
  and M01-W01 was READY but untouched.
- External adoption proof:
  - Source:
    `/Users/tanishkalwad/Downloads/MASTER_IMPLEMENTATION_SPEC_v1.3_final.md`.
  - `shasum -a 256` on both the external file and the adopted canonical file
    returned
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`.
    The superseded v1.2 canonical SHA-256 was
    `9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901`.
  - Independent parsing found version 1.3, the exact cross-platform
    rebaseline revision, 124 balanced Markdown fences, milestones M00…M38 in
    order, 286 unique packages, 157 unique requirements, and four gates.
    The M00 table contains uninterrupted W01…W10 rows. All 260 v1.2 package
    IDs/titles and 135 requirement IDs remain; the exact delta is 26
    packages and 22 requirements.
  - Policy inspection confirmed owner-controlled persistent agent selection,
    no automatic Claude/Codex/reasoning-mode routing, separate clean-session
    audits, Workday-first production ordering, unchanged exclusions, M05
    primary-Mac acceptance plus Windows/Ubuntu capability/safe fallback,
    no M06 dependency on Windows/Ubuntu full-AI acceptance, and final
    Windows/Ubuntu full-AI ownership at M27-W10 before Gate D.
  - The external bytes were copied directly over
    `docs/MASTER_IMPLEMENTATION_SPEC.md`. `find docs -name
    'MASTER_IMPLEMENTATION_SPEC*'` returns exactly that one canonical file.
    No proposed or archived duplicate exists and no validator exception was
    added.
- Traceability preservation and extension:
  - The M00-W07 JSON/generator/generated-view architecture remains in place.
    The v1.2 reviewed mapping hash is unchanged at
    `c2b4275f13d1074dea1532ae8d2a9020668eb44751c371e562cc78e46844eec9`;
    the v1.2 reviewed dependency hash is unchanged at
    `bb42505238220f4b3230456f2a8c03ded62308e12b8773714fc9c559175fdb5f`.
  - The 22/26 delta is mechanically added and visibly labeled
    `PROVISIONAL_PENDING_M00_W10`. Future product requirements remain
    `NOT_STARTED`/`NOT_YET_APPLICABLE` with no completed paths or evidence.
    M00-W10 still owns the complete reviewed mapping audit.
  - `pnpm traceability:generate` and `pnpm traceability:check` exit 0 at
    exactly 157 requirements / 286 packages; a second generation is
    byte-stable and check mode leaves tracked state unchanged.
- Governance and readiness:
  - ADR-0002 records the external transport, exact hash, target matrix,
    platform abstractions, secure-store/native-messaging/package/update
    policies, staged AI sequencing, traceability preservation, owner-selected
    agent policy, and v1.2 rollback through Git history.
  - `docs/PLATFORM_SUPPORT.md`, Gate D, and the four `docs/platform/`
    planning/future-evidence matrices contain no product, installer,
    benchmark, full-AI, compatibility, or native-packaging claim.
  - All four gates remain NOT_EVALUATED. M00 is reopened; the historical
    v1.2 M01-W01 readiness is revoked. After this package verifies, only
    M00-W09 becomes READY; M00-W10 and M01-W01 remain NOT_STARTED.
- Focused positive/negative results:
  - `uv run pytest scripts/tests/test_traceability.py
    scripts/tests/test_validate_status.py -q` → exit 0, 88 passed.
  - `uv run pytest scripts/tests -q` → exit 0, 172 passed. The canonical
    `uv run pytest` including the orchestrator smoke test collected and
    passed 173 tests.
  - Coverage includes exact hash/order/counts and v1.2 preservation; missing,
    duplicate, unknown, and stale platform records; missing governance files
    and Gate D records/reports; incomplete Gate D PASS; M28/M01 blocking;
    M06 independence from later full-AI acceptance; false future claims;
    legacy remap/reclassification; provisional labeling; owner-controlled
    agent policy; deterministic regeneration; and duplicate canonical specs.
  - `uv run ruff check ...` and `uv run mypy ...` over all changed Python and
    test files exited 0. The first focused `ruff format --check` correctly
    found three edited files; `uv run ruff format` corrected them rather than
    masking the failure.
- Complete local validation:
  - `pnpm install --frozen-lockfile` → exit 0 (12 workspace projects, already
    up to date); `uv sync --locked` → exit 0 (17 resolved / 15 checked).
  - `pnpm run doctor` → exit 0: 18 PASS, expected dirty-tree WARNING,
    0 FAIL, and 3 honest NOT_YET_APPLICABLE future suites; it found 20
    required memory files and four gate reports.
  - The first final-state `pnpm preflight` exited 1 because Ruff correctly
    detected one newly edited test file that still needed formatting. After
    `uv run ruff format scripts/tests/test_traceability.py`, the second
    `pnpm preflight` exited 0 and its aggregate verification passed every
    active suite.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, and `pnpm test:rust` each exited 0.
    Results: 8/8 TypeScript package tests; 8/8 TypeScript package typechecks;
    1/1 pinned-Chromium test; 173/173 Python tests; 1/1 Rust test plus
    rustfmt, Clippy `-D warnings`, and build.
  - Focused final subsets: traceability 43/43; status validator 45/45;
    verification runner/integrity 36/36; doctor/CI policy 48/48.
  - Final `pnpm verify` → exit 0. Toolchain, format, lint, typecheck, unit-ts,
    e2e-browser, Python, Rust, traceability, status, and integrity were
    ACTIVE/PASS. Contract generation, contract compatibility, and visual
    remain correctly NOT_YET_APPLICABLE.
  - Final `python3 scripts/validate_status.py` → exit 0, 35/35 check groups.
    Final `pnpm traceability:check` → exit 0 at 157/286.
  - Structural audit printed canonical SHA-256
    `fa2a147722a0839673efcec300a9a3640ee1d269d0918f407f38352b32bda867`,
    124 balanced fences, 39/286/157/4 counts, uninterrupted M00-W01…W10,
    and exactly one canonical-looking file. `git diff --check` reports only
    eight intentional two-space Markdown hard-break lines already present
    in the owner-approved exact-byte specification; altering them would
    violate byte identity. No other whitespace error exists.
- Security/privacy impact: governance metadata only. No executable product
  feature, schema, secret, PII, applicant data, telemetry, live-site result,
  installer, model artifact, or speculative compatibility evidence was
  introduced.
- Hosted content proof: workflow run 30223370286 at content commit
  `9bb12322b993d233017d53bfa14f853c5fc86e34` passed
  `doctor + verify (macos-15)` job 89849529794 and
  `doctor + verify (ubuntu-24.04)` job 89849529811. Both jobs ran the
  canonical aggregate verification and confirmed it left no tracked
  changes. The final revision-stamp HEAD requires its own successful hosted
  run before closeout.

### M00-W07 — Seed traceability and status (2026-07-26)

- Revision: tree fee2902010eb90704c05e584fb6ff7964327cb0b / commit
  22e6f0ae826ef551edfaf025fbc523411ef62637 (stamped in the conventional
  follow-up commit after its hosted content run passed).
- Starting prerequisite: HEAD and `origin/main` were both
  `6946c5929037b475f61ee25bf3e8adb9c7c0e9a9` on `main`, with a clean tree.
  Final M00-W06 stamp run 30218521997 was successful on macOS and Linux;
  M00-W01 through M00-W06 were VERIFIED, M00-W07 was READY, no package was
  IN_PROGRESS, all three critical gates were NOT_EVALUATED, the status
  validator passed 25 check groups, doctor reported 19 PASS / 0 FAIL /
  3 honest NOT_YET_APPLICABLE suites, and baseline `pnpm verify` exited 0
  with 109 Python tests.
- Traceability architecture:
  - `docs/MASTER_IMPLEMENTATION_SPEC.md` remains authoritative for exact
    requirement text, requirement IDs, milestone/package IDs and titles,
    and explicit milestone/gate dependencies. Its unchanged SHA-256 is
    `9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901`.
  - `docs/PROJECT_STATUS.md` remains authoritative for live package and
    milestone state/evidence; `docs/CRITICAL_GATES.md` plus `docs/gates/`
    remain authoritative for live gate state/evidence.
  - `docs/traceability.json` is the reviewed machine source for all 135
    requirement mappings and all 260 expanded work-package dependency,
    verification, and evidence records. Reviewed mapping/dependency hashes
    make an ownership or derived-edge edit explicit.
  - `scripts/traceability.py` parses the canonical inputs, validates exact
    agreement and fraud/drift negatives, derives the one legitimate next
    package, and deterministically renders
    `docs/REQUIREMENTS_TRACEABILITY.md`.
  - Sequential edges are labeled `REVIEWED_DERIVED_SEQUENTIAL`, based on
    spec §1 ordering and each §9 package list. Cross-milestone and
    critical-gate edges are not invented; they must match the specification
    exactly.
- Honest requirement state: six M00 readiness/ledger requirements
  (`REQ-RES-017`, `REQ-FORM-022`, `REQ-WD-001`, `REQ-GATE-001`,
  `REQ-GATE-005`, `REQ-GATE-014`) link real M00-W05 code, tests, and
  evidence and are VERIFIED. Ten partial infrastructure records are
  `SCAFFOLD_ONLY`. Every other future requirement is
  `NOT_STARTED`/`NOT_YET_APPLICABLE` with no completed path, result,
  compatibility claim, or evidence.
- Focused commands run and inspected so far:
  - `python3 scripts/traceability.py generate` and
    `pnpm traceability:check` → exit 0; exactly 135 requirements and 260
    packages validated; generated view agrees byte-for-byte.
  - `uv run pytest scripts/tests/test_traceability.py -q` → exit 0,
    31 passed. Coverage includes exact counts/uniqueness; missing,
    duplicate, and unknown requirements/packages; text/title/milestone/
    ownership drift; unknown dependencies and cycles; Workday gate
    dependencies; M03/M06/M21 gate blocking; future-claim fraud; missing
    completed code/test paths, evidence headings, and gate reports;
    human/machine drift; deterministic read-only regeneration; canonical
    inventory drift; and M00→M01 next-work derivation.
  - `uv run pytest scripts/tests/test_validate_status.py -q` → exit 0,
    31 passed. New tests prove M01-W01 requires M00 ACCEPTED, becomes READY
    after valid M00 acceptance, later M01 packages stay blocked by sequence,
    and a milestone may be ACCEPTED while its completed package rows remain
    VERIFIED.
  - `uv run ruff check scripts/traceability.py
    scripts/tests/test_traceability.py` → exit 0.
  - `uv run mypy scripts/traceability.py
    scripts/tests/test_traceability.py` → exit 0, no issues.
- Full local command matrix (working tree; all results inspected):
  - `pnpm install --frozen-lockfile` → exit 0; all 12 workspace projects
    already up to date. `uv sync --locked` → exit 0; 17 packages resolved,
    15 checked.
  - `pnpm run doctor` → exit 0; 18 PASS, the expected dirty-tree WARNING,
    0 FAIL, and 3 honest NOT_YET_APPLICABLE future suites. It confirms 14
    project-memory files and 14 required root scripts.
  - The first `pnpm preflight` exposed formatting drift in three newly
    edited Python files and exited 1; no failure was masked. After
    `uv run ruff format scripts/traceability.py
    scripts/tests/test_traceability.py scripts/tests/test_integrity.py`,
    `pnpm preflight` → exit 0: doctor passed and every active aggregate
    suite passed.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, and `pnpm test:rust` → exit 0
    each. TypeScript: 8/8 package tests and 8/8 typecheck tasks; Playwright:
    1/1 pinned-Chromium smoke test; Python: 146/146; Rust: 1/1 plus
    rustfmt, Clippy `-D warnings`, and build.
  - `pnpm verify` → exit 0. Toolchain, format, lint, typecheck, unit-ts,
    e2e-browser, python, rust, traceability, status, and integrity were
    ACTIVE/PASS. Contract generation, contract compatibility, and visual
    remained honestly NOT_YET_APPLICABLE and were not counted as passing.
  - `uv run pytest scripts/tests/test_integrity.py
    scripts/tests/test_proofs_and_real_repo.py
    scripts/tests/test_suite_states.py -q` → exit 0, 36 passed
    (verification-runner/integrity suite).
  - `uv run pytest scripts/tests/test_ci_workflow.py
    scripts/tests/test_doctor.py -q` → exit 0, 47 passed (28 CI-policy +
    19 doctor/preflight).
  - `uv run pytest scripts/tests/test_traceability.py
    scripts/tests/test_validate_status.py -q` → exit 0, 62 passed.
  - `uv run pytest scripts/tests -q` → exit 0, 145 passed.
  - `pnpm traceability:check` → exit 0, exact 135/260 PASS.
    `python3 scripts/validate_status.py` → exit 0,
    `PASS: all checks passed (26 check groups)`.
- M00 package-by-package exit audit:
  - M00-W01 PASS: all 14 canonical memory/gate/traceability files exist,
    carry required structure, and reconstruct current/next work without chat
    history; status validation is fail-closed.
  - M00-W02 PASS: the honest monorepo scaffold remains intact; no desktop,
    extension, ATS, model, or other product implementation was introduced.
    The 8 TypeScript, 1 Python, and 1 Rust scaffold smoke tests pass.
  - M00-W03 PASS: Node 24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
    Rust 1.97.1 plus rustfmt/Clippy, and Playwright 1.62.0 Chromium remain
    pinned/enforced. Doctor wrong-version/component/browser negatives and
    the real Chromium launch pass.
  - M00-W04 PASS: root verification remains status-derived and fail-closed;
    ACTIVE/NOT_YET_APPLICABLE/REQUIRED_MISSING, mandatory-empty,
    mutation/status-neutrality, no-op, bypass, focus/skip, and discovery
    proofs pass in the 36-test runner/integrity subset and aggregate verify.
  - M00-W05 PASS: the canonical specification is still the sole v1.2 copy
    with SHA-256
    `9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901`;
    inventory is exactly 39/260/135; all three gate records exist and remain
    NOT_EVALUATED; preserved historical evidence and readiness negatives
    pass.
  - M00-W06 PASS locally and historically hosted: doctor/preflight pass;
    the 28-test CI suite preserves read-only permissions, macOS/Linux,
    frozen/locked installs, narrow caches/artifacts, generated-contract
    honesty, and the isolated job-scoped runner-temp RUSTUP_HOME regression.
    Final starting-HEAD run 30218521997 passed both matrix jobs.
  - M00-W07 PASS locally: canonical metadata/view are complete, generation
    and check are deterministic, all required fraud/drift negatives pass,
    and valid M00 acceptance derives only M01-W01 as READY.
- Clean-clone content proof: a temporary non-local clone checked out exact
  commit `22e6f0ae826ef551edfaf025fbc523411ef62637`, activated the repository
  pins, installed with `pnpm install --frozen-lockfile` and
  `uv sync --locked`, fetched locked Cargo dependencies, and installed or
  located the pinned Playwright Chromium. `pnpm run doctor`,
  `pnpm preflight`, `pnpm verify`, `pnpm traceability:check`, and
  `python3 scripts/validate_status.py` all exited 0. The clone contained
  exactly one canonical specification, validated exactly 135 requirements
  and 260 work packages, preserved all three gates as NOT_EVALUATED, and
  had empty git porcelain afterward. As required at the pre-hosted content
  boundary, that commit still reconstructed M00-W07 as IN_PROGRESS; the
  temporary clone was then removed.
- Hosted content proof: workflow run 30220428453 at commit
  `22e6f0ae826ef551edfaf025fbc523411ef62637` concluded SUCCESS.
  `doctor + verify (macos-15)` job 89841823180 and
  `doctor + verify (ubuntu-24.04)` job 89841823169 both passed, including
  the canonical doctor, aggregate verification, and no-tracked-change
  assertion.
- Closeout-state regression: the first focused
  `uv run pytest scripts/tests/test_traceability.py
  scripts/tests/test_validate_status.py -q` run after stamping the accepted
  state exited 1 with 61 passed / 1 failed. The negative fixture tried to
  make M01-W01 READY even though that is now the valid canonical baseline;
  no validator failure was masked. The fixture now explicitly revokes
  M00-W07 completion and M00 acceptance before asserting the skipped-
  dependency rejection. Ruff check/format then passed, the focused suite
  passed 62/62, `pnpm verify` exited 0 with all mandatory suites PASS and
  146/146 Python tests, and `python3 scripts/validate_status.py` exited 0
  with 26/26 check groups.
- Acceptance decision: every M00-W01 through M00-W07 package audit and the
  complete M00 exit gate pass at content tree
  `fee2902010eb90704c05e584fb6ff7964327cb0b`. M00-W07 is therefore
  VERIFIED, M00 is ACCEPTED, and only M01-W01 becomes READY. No M01
  implementation began. The final closeout stamp HEAD must pass both hosted
  jobs before handoff; its terminal run is reported at handoff rather than
  creating another evidence-only commit and an unverified successor HEAD.
- Security/privacy impact: metadata contains only specification text,
  repository paths, package IDs, and planned test/evidence categories. It
  contains no executable code, secrets, PII, real applicant data, live-site
  result, or speculative compatibility/benchmark claim. Validation is
  stdlib-only and read-only in check mode.
- Compatibility impact: none. M00 hosted OS results prove repository
  bootstrap/verification only; no desktop or ATS compatibility row is
  populated.

### M00-W06 — Create CI and local preflight (2026-07-26)

#### Current-HEAD macOS hosted-CI repair (2026-07-26)

- Repair revision: tree 9f9adc79cea15cb2f3a855b2b66463467822b5bf /
  commit 124418f3a34389c4c56dced60a9fff9a5947adc4 (stamped in the
  conventional follow-up commit after its hosted content run passed).
- Failed hosted evidence: workflow run 30217235083 at current HEAD
  f9ec7926d3ff04e0cc427481a5c0a965f0578f4e concluded failure. Required
  macOS job `doctor + verify (macos-15)` 89833453976 failed in
  `Install pinned Rust toolchain (rust-toolchain.toml)`; Linux job
  `doctor + verify (ubuntu-24.04)` 89833453996 completed successfully.
  `gh run view 30217235083 --job 89833453976 --log-failed` showed:
  `recovering from a partially installed toolchain`, component removal,
  rollback, and the exact terminal error `failed to install component:
  'clippy-preview-aarch64-apple-darwin', detected conflict:
  'bin/cargo-clippy'`.
- Confirmed root cause: the workflow invoked the trusted hosted-runner
  rustup proxy but inherited the runner image's default `RUSTUP_HOME`.
  That shared state contained a partial/contaminated 1.97.1 toolchain, so
  adding Clippy collided with an existing `bin/cargo-clippy`. The log
  contains no download timeout or transport failure; the successful Linux
  job and passing local suite further isolate the defect to non-hermetic
  macOS runner toolchain state.
- Why retries were rejected: retrying the same deterministic contaminated
  rustup home does not remove the component conflict and would mask the
  missing CI isolation. No unconditional or bounded retry was added. A
  bounded retry remains appropriate only if a later independent log proves
  a transient network failure.
- Correction:
  - The Rust install step receives
    `RUSTUP_HOME: ${{ runner.temp }}/rustup-home` at step scope. GitHub does
    not expose the `runner` context in `jobs.<job_id>.env`, so the step
    verifies the path does not exist, creates it, and writes the exact value
    to the job-local `GITHUB_ENV` before the first rustup command. Every
    later Rust/Cargo step in that matrix job therefore uses the same fresh
    home.
  - rustup installs the repository-derived exact 1.97.1 pin with the
    `minimal` profile plus rustfmt and Clippy. Post-install checks verify the
    active `rust-toolchain.toml` override, rustup's selected cargo/rustc
    binaries, `cargo --version`, `rustc --version`, `rustfmt --version`, and
    `cargo clippy --version`. `cargo +1.97.1` and `rustc +1.97.1` probes
    prove the PATH commands are rustup proxies.
  - `RUSTUP_HOME`, `.rustup`, `runner.temp`, and Cargo proxy/bin state are
    excluded from every cache. The existing Cargo dependency cache remains
    limited to `~/.cargo/registry` and `~/.cargo/git`.
- Static regressions: `scripts/tests/test_ci_workflow.py` now has 27 tests.
  New coverage proves per-matrix fresh runner-temp rustup initialization
  and ordering; no earlier Rust operation; exact Rust 1.97.1/minimal/
  rustfmt/Clippy installation; active-toolchain, proxy, and four version
  probes; toolchain-cache exclusion with a complete cache-path allowlist;
  narrow retained Cargo dependency caches; and no shell failure masking.
  Existing tests continue proving macos-15 + ubuntu-24.04, read-only
  permissions, SHA-pinned official actions, frozen/locked installs,
  canonical doctor + verify execution, and failure-scoped artifacts.
- Test-first evidence: before the workflow correction,
  `uv run pytest scripts/tests/test_ci_workflow.py -q` exited 1 with
  2 failed / 24 passed (missing isolated `RUSTUP_HOME` and missing proxy/
  version checks). After the correction, the focused suite exited 0 with
  27 passed.
- Local environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); Node
  v24.18.0; pnpm 11.17.0; uv 0.11.32; Python 3.12.13; rustc/cargo 1.97.1;
  rustfmt 1.9.0-stable; Clippy 0.1.97; @playwright/test 1.62.0 with pinned
  Chromium.
- Required local validation (repair tree; every command inspected):
  - `pnpm install --frozen-lockfile` → exit 0; all 12 workspace projects
    already up to date.
  - `uv sync --locked` → exit 0; 17 packages resolved / 15 checked.
  - `pnpm run doctor` → exit 0; 18 PASS, 1 expected dirty-tree WARNING,
    0 FAIL, 3 honest NOT_YET_APPLICABLE suites.
  - `pnpm preflight` → exit 0; doctor result above followed by canonical
    `pnpm verify`, exit 0.
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:python`, and `pnpm test:rust` → exit 0 each.
  - `pnpm verify` → exit 0; all mandatory active suites PASS;
    contract-gen/contract/visual remain honestly NOT_YET_APPLICABLE and
    are not counted as passing suites.
  - `uv run pytest scripts/tests -q` → exit 0, 108 passed.
  - `python3 scripts/validate_status.py` → exit 0,
    `PASS: all checks passed (25 check groups)`.
- Test counts: CI static validation 27/27; scripts pytest 108/108; full
  pytest (inside `pnpm test:python` / `pnpm verify`) 109/109; TypeScript
  unit packages 8/8; Playwright 1/1; Rust 1/1; validator 25 check groups.
- Hosted repair evidence: GitHub Actions run 30218333122 at repair commit
  124418f3a34389c4c56dced60a9fff9a5947adc4 completed successfully.
  `doctor + verify (macos-15)` job 89836260053 and
  `doctor + verify (ubuntu-24.04)` job 89836260044 both succeeded. The
  macOS Rust-install log confirms `RUSTUP_HOME:
  /Users/runner/work/_temp/rustup-home`; an exact fresh
  `1.97.1-aarch64-apple-darwin` installation; repository override via
  `rust-toolchain.toml`; PATH proxies at `/Users/runner/.cargo/bin/cargo`
  and `/Users/runner/.cargo/bin/rustc`; toolchain binaries under the
  isolated home; cargo 1.97.1, rustc 1.97.1, rustfmt 1.9.0-stable, and
  Clippy 0.1.97; doctor PASS; validator PASS (25 check groups); canonical
  verification exit 0; and no tracked changes.
- Stamp-HEAD revalidation: the conventional follow-up stamp commit must
  pass both hosted jobs before M00-W07 starts. Its terminal run is reported
  at handoff rather than creating another evidence-only commit and another
  unverified HEAD.
- Artifacts: none locally; no product UI/browser behavior changed.
- Security/privacy impact: no secrets, permissions, live-site behavior, or
  data paths changed. The token remains read-only and all actions remain
  official and SHA-pinned.

- Revision: tree 135a4c1ffa7cdd43dd2be11baea4ee01721055b9 / commit
  16072e528e45379fe7d7c4f7df75a3fcba7ed67d (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); pinned toolchain
  active (Node v24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
  rustc/cargo 1.97.1, @playwright/test 1.62.0 pinned Chromium). New dev
  dependencies: pyyaml==6.0.3 + types-pyyaml==6.0.12.20260724 (exact pins,
  used only by the CI static-validation tests; uv.lock updated).
- What this package added:
  - `scripts/doctor.py` — stdlib-only, strict-gated environment doctor
    (read-only; PASS/WARNING/FAIL/NOT_YET_APPLICABLE; per-failure
    remediation; deterministic `--json`; `--preflight` runs the doctor then
    the canonical `pnpm verify`). Root scripts `doctor` and `preflight`
    added to package.json and to verify.py's CANONICAL_ROOT_SCRIPTS (their
    absence now fails pnpm verify).
  - `.github/workflows/ci.yml` — single `verify` job on a macos-15 +
    ubuntu-24.04 matrix; `permissions: contents: read`;
    `persist-credentials: false`; concurrency cancel for superseded
    non-main runs; official actions only, all pinned to immutable commit
    SHAs resolved live from tags (checkout v7.0.1 3d3c42e5…, setup-node
    v7.0.0 82076278…, cache v6.1.0 55cc8345…, upload-artifact v7.0.1
    043fb46d…); toolchain activated from the repository pin files; installs
    frozen/locked (pnpm --frozen-lockfile, uv sync --locked, cargo fetch
    --locked); caches keyed on runner.os + runner.arch + hashFiles of the
    pin/lockfiles with no restore-keys; CI then runs exactly `pnpm run doctor`
    and `pnpm verify` (`run` is required — pnpm's unrelated built-in
    `doctor` command shadows the bare script form; caught by the
    clean-clone simulation and fixed before push) (no CI-only subset), asserts a clean porcelain, and
    uploads only failure-scoped Playwright artifacts from test-results/
    (7-day retention).
  - `contract-gen` registry suite (owner M01-W02) — generated-contract
    drift lifecycle: NOT_YET_APPLICABLE today, REQUIRED_MISSING the moment
    M01-W02 begins without a real generator at scripts/generate-contracts.*;
    documented as distinct from the M01-W05 `contract` compatibility suite.
    Registry now has 13 suites.
  - M00-W05 audit-finding fix (KI-0004): validate_status.py ledger
    validation now requires, for every required gate, exactly one
    `## <GATE>` section in docs/CRITICAL_GATES.md containing exactly one
    valid `- State:` line agreeing with the PROJECT_STATUS gates table;
    missing sections, missing/duplicate state lines, invalid values, and
    unknown gate-like sections are rejected.
  - Tests: scripts/tests/test_doctor.py (20 tests — injected-runner
    negatives for wrong Node/pnpm/uv/Python/cargo/rustup-proxy/rustfmt/
    clippy/browser, fixture-repo negatives for missing memory file/gate
    report/invalid status, JSON validity + run-to-run stability, remediation
    rendering, tracked-file neutrality, preflight failure propagation in
    both directions), scripts/tests/test_ci_workflow.py (19 static workflow
    tests — duplicate-key-rejecting parse, read-only permissions, SHA-pinned
    official actions with version annotations, macOS+Linux matrix, frozen
    installs, doctor+verify-only invocation allowlist, failure-scoped
    artifact policy vs playwright.config.ts, cache-key identity,
    no continue-on-error, no http(s) in run steps, contract-gen
    ownership/lifecycle), and 5 new ledger regression tests in
    test_validate_status.py. conftest GOOD_SCRIPTS extended with
    doctor/preflight.
- Commands and observed results (pinned PATH; all run in the current tree):
  - `pnpm install --frozen-lockfile` → exit 0. `uv sync --locked` → exit 0.
  - `pnpm run doctor` → exit 0 — 18 PASS, 1 WARNING (dirty tree,
    mid-package), 0 FAIL, 3 NOT_YET_APPLICABLE (contract-gen M01-W02,
    contract M01-W05, visual M10-W06). `pnpm run doctor --json` → exit 0,
    parsed, byte-stable across consecutive runs (asserted in tests as
    well).
  - `pnpm preflight` → exit 0 — doctor summary above, then the canonical
    aggregate: `verification exit code: 0` with 13 registry suites
    (toolchain, format, lint, typecheck, unit-ts PASS; contract-gen +
    contract + visual NOT_YET_APPLICABLE with owner labels; e2e-browser,
    python, rust, status, integrity PASS).
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
    `pnpm test:e2e`, `pnpm test:python`, `pnpm test:rust` → exit 0 each.
  - `uv run pytest scripts/tests -q` → 101 passed (35 M00-W04 runner + 27
    validator incl. 5 new ledger cases + 20 doctor + 19 CI-workflow);
    full `pnpm test:python` pytest count 102 (includes the orchestrator
    smoke test).
  - `python3 scripts/validate_status.py` → exit 0, PASS (25 check groups),
    re-run after every status edit.
  - `pnpm verify` from the final content tree → recorded below in this
    entry's closeout note (run after the last documentation edits).
  - Clean-clone simulation → recorded below (temporary file:// clone of the
    content commit; install → doctor → verify; clone removed afterwards).
- Negative-path results (all fail-closed, automated): wrong Node
  (v26.0.0), wrong pnpm, missing uv, wrong Python patch (3.12.14), missing
  cargo, cargo resolving outside the pinned rustup toolchain, missing
  rustfmt, missing Clippy, missing Chromium executable → doctor FAIL with
  actionable remediation; missing canonical memory file, missing Workday
  gate report, corrupt PROJECT_STATUS → doctor FAIL; preflight with a
  failing doctor never starts verification (marker-file proof) and
  propagates a failing verify child's exit code (3); ledger negatives:
  missing `- State:` line, duplicate state lines, missing `## GATE`
  section (with names still present elsewhere), unknown gate-like section,
  invalid state value → validator exit 1 each; contract-gen with M01-W02
  IN_PROGRESS and no generator → REQUIRED_MISSING (derive_state).
- Hosted CI evidence (observed live via gh before VERIFIED was recorded):
  workflow `ci` run 30217098337 on the verified content commit
  16072e528e45379fe7d7c4f7df75a3fcba7ed67d → conclusion success —
  https://github.com/kalwad/jobapplyv2/actions/runs/30217098337 — with both
  matrix jobs completed successfully: "doctor + verify (macos-15)" (job
  89833100002) and "doctor + verify (ubuntu-24.04)" (job 89833100004).
  Every step green on both OSes (checkout, pinned Node/pnpm/uv/Rust
  activation, four caches, frozen installs, Chromium install, doctor,
  canonical verification, no-tracked-changes assertion); the failure-only
  artifact-upload step was skipped, as designed, because nothing failed.
  The clean-clone simulation additionally caught pre-push that bare
  `pnpm doctor` invokes pnpm's unrelated built-in doctor command — the
  canonical invocation is `pnpm run doctor` everywhere (workflow, README,
  static tests assert the bare form is absent).
- Test counts: pytest 101/101 (scripts) and 102/102 (full); TS unit 8/8
  package tasks; Playwright 1/1; Rust 1/1; validator PASS 25 groups.
- Artifacts: none persisted locally (Playwright artifacts remain
  failure-only and git-ignored).
- Notes: the doctor duplicates no verification logic — file/scripts
  checks reuse verify.py and validate_status.py constants, suite states
  come from verify.load_registry/derive_state, and preflight invokes the
  canonical `pnpm verify` command itself. KI-0002 remains FIXED; KI-0004
  records the audit finding fixed here.

### M00-W05 — Adopt and migrate the v1.2 Workday-first critical-risk rebaseline (2026-07-26)

- Revision: tree 0c6fe779cc56755983d39951cabcdf201867bae2 / commit
  c2c834ef44892b70706e0ee1985d1fda1fb8f4da (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); pinned toolchain
  active (Node v24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
  rustc/cargo 1.97.1, @playwright/test 1.62.0 with pinned Chromium) —
  unchanged from M00-W04.
- What this package did: owner-approved adoption of JAPP-MASTER-001 v1.2 as
  the canonical specification (ADR-0001, ACCEPTED; owner-decision registry
  extended to OD-020). The canonical file was replaced atomically via a
  single rename of the owner-supplied proposed copy
  (`mv docs/MASTER_IMPLEMENTATION_SPEC.v1.2.proposed.md
  docs/MASTER_IMPLEMENTATION_SPEC.md`), which also removed the proposed
  copy; exactly one canonical specification remains. New project memory:
  docs/CRITICAL_GATES.md (three-gate ledger with §2.3 metric tables) and
  docs/gates/ (three gate report templates + HOLDOUT_EXECUTION_LOG.md).
  docs/PROJECT_STATUS.md regenerated in the §12 v1.2 shape (critical-gates
  table; 39 milestones M00–M38; 260 work packages) via a one-off generator
  that used the permanent validator's own spec parser. CLAUDE.md,
  KNOWN_ISSUES (KI-0001 refs updated, KI-0002 FIXED), COMPATIBILITY_MATRIX
  (Workday-first + tenant-pattern table), REQUIREMENTS_TRACEABILITY (135
  requirements, seeding moved to M00-W07, final audit M38-W01), README, and
  stale v1.0 milestone references in workspace-slot files migrated.
  scripts/validate_status.py rewritten for v1.2 (exact 39/260/135 inventory
  enforcement, critical-gates table + ledger agreement, gate-based readiness
  blocking, ACCEPTED-milestone prerequisites, verified-evidence
  preservation, single-canonical-spec rule) and brought under the strict
  Ruff/mypy/pytest gates; new automated suite
  scripts/tests/test_validate_status.py (22 tests). verify.py MEMORY_FILES
  gained docs/CRITICAL_GATES.md; registry/format/typecheck/python command
  paths gained scripts/validate_status.py.
- Hashes: replaced canonical v1.0 sha256
  2ddbda1db42cb4a4efdb61415ee1f348811f088f3d70b0a5570f6b4e0570dac8
  (byte-identical to the owner's original upload recorded in § M00-W01);
  adopted canonical v1.2 sha256
  9faa4da58b566c56e70a773b31ac7bea3b4ca7b565fa333abf16cf6ee73bd901
  (byte-identical to the owner-supplied proposed file, verified before and
  after the rename).
- Commands and observed results (pinned PATH):
  - Pre-migration baseline: `pnpm verify` → exit 0 (all mandatory suites
    PASS; contract/visual NOT_YET_APPLICABLE) — live confirmation that
    M00-W01…W04 verification held before any edit.
  - Mechanical inventory extraction (one-off script, same regex conventions
    as the validator) on the proposed file → 39 milestones, 260 unique work
    packages, 135 unique requirements; v1.0 canonical → 38/227/74 (matches
    § M00-W01). Re-run against the adopted canonical after the rename →
    identical 39/260/135 (families: PROF 7, RES 18, JOB 7, ANS 10, FORM 26,
    WD 23, TRACK 6, DISC 4, AUTO 8, PLAT 10, GATE 16).
  - `python3 scripts/validate_status.py` (migrated tree) → exit 0,
    `PASS: all checks passed (25 check groups)` — includes spec-inventory
    counts, §12 gate-rule derivability, critical-gates table/ledger
    agreement, gate report presence, dependency + ACCEPTED + gate readiness
    rules, evidence preservation, and single-canonical-spec scan.
  - `uv run pytest scripts/tests -q` → 57 passed (35 M00-W04 runner tests +
    22 new validator tests). Validator negative matrix automated: invalid
    package enum (M03-W02 → DONE), skipped dependency (M01-W01 READY),
    two IN_PROGRESS, missing package row (M38-W07), stale/missing Workday
    packages (M19/M20 rows removed → 22 missing reported), missing Workday
    requirement (REQ-WD-023 deleted → "expected 135"), missing milestone
    section (M38 truncated → "expected 39"), second canonical spec
    (proposed-path copy), renamed canonical lookalike (header marker),
    invalid gate state ("GREEN"), missing WORKDAY_GUIDED_PRE_SUBMIT row,
    missing Workday gate report file, missing CRITICAL_GATES.md ledger,
    gate PASS without evidence fields, status/ledger gate-state mismatch,
    M03 blocked without AUTOFILL_FEASIBILITY (with dependency noise proven
    absent), M06 blocked without RESUME_PAGEFIT_FEASIBILITY, M21 blocked
    without WORKDAY_GUIDED_PRE_SUBMIT + M19/M20 ACCEPTED, dropped preserved
    revision (M00-W03), missing evidence heading (M00-W02); positive: full
    migrated repo passes, and AUTOFILL_FEASIBILITY = PASS with complete
    evidence fields unblocks M03-W01 (exit 0).
  - Live negative demonstration (in addition to the automated suite): the
    committed v1.0-shaped status (`git show HEAD:docs/PROJECT_STATUS.md`)
    against the new validator via `--status` → exit 1: missing critical
    gates (incl. WORKDAY_GUIDED_PRE_SUBMIT), `milestone table missing:
    ['M38']`, `work-package table missing 41 package(s)`, and 8 v1.0-only
    IDs (M22-W06, M23-W06/07, M30-W05, M31-W06/07, M34-W07, M37-W07)
    rejected as unknown — the stale-inventory rejection required by §13.8.
  - Post-migration aggregate: `pnpm verify` → exit 0 — toolchain, format,
    lint, typecheck, unit-ts, e2e-browser, python (ruff + strict mypy over
    services + verify.py + validate_status.py + tests; pytest 57), rust,
    status (new validator), integrity (incl. docs/CRITICAL_GATES.md) all
    PASS; contract/visual NOT_YET_APPLICABLE (owners M01-W05/M10-W06 keep
    identical IDs and meaning under v1.2); status-neutral. Re-run from the
    final closeout tree after the status edits below → exit 0.
  - `uv run ruff check` / `uv run ruff format --check` / `uv run mypy` over
    services + scripts/verify.py + scripts/validate_status.py +
    scripts/tests → exit 0 each (validator now inside the strict gates —
    KI-0002 FIXED).
- Test counts: pytest 57/57 (runner 35, validator 22); TS unit 8/8 package
  tasks (forced, inside verify); Playwright 1/1; Rust 1/1; validator PASS
  25 check groups; all lint/format/type commands exit 0.
- Artifacts: none persisted (documents/validator migration; no UI/browser
  surface — Playwright artifacts remain failure-only and git-ignored).
- Manual validation: complete `git status`/`git diff --stat` review of the
  change set (16 modified + 3 added paths, no unintended files); canonical
  byte-identity verified by sha256 before/after the rename; preserved
  M00-W01…W04 revisions re-grepped verbatim from the migrated table;
  tracked-file sweep for stale v1.0 milestone references (workspace-slot
  READMEs/package descriptions, pyproject comment) updated to v1.2
  numbering; owner's gitignored root upload left untouched and ignored.
- Notes:
  - The `stamp pending` marker in the W05 status row and this revision line
    is the validator-accepted placeholder between the content commit and the
    stamp commit; the stamp commit replaces both with the content commit's
    tree/commit hashes.
  - Historical entries below this one describe v1.0-era package IDs and
    section numbers as they were at the time; they are records, not current
    references, and are intentionally not rewritten.

### M00-W04 — Create root verification commands (2026-07-26)

- Revision: tree 6c798abfd76824fd43c09c72615a3a976406f081 / commit
  5181538ba8d76fc8b75155dd2e8514797a13647b (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon); pinned toolchain
  active and re-verified live — Node v24.18.0 (keg + .nvmrc), pnpm 11.17.0
  (Corepack shim, packageManager), uv 0.11.32 (required-version), Python
  3.12.13 (uv-managed, .python-version), rustc/cargo 1.97.1 with rustfmt
  1.9.0 + clippy 0.1.97 (rust-toolchain.toml override), @playwright/test
  1.62.0 with pinned Chromium (headless shell 151.0.7922.34).
- What this package added: `scripts/verify.py` (stdlib-only, strict-mypy
  fail-closed runner), `scripts/verification-suites.json` (canonical
  machine-readable suite-state registry, 12 suites), `scripts/tests/`
  (conftest + 3 files, 35 runner tests), the ten canonical root commands in
  package.json, turbo.json `globalDependencies: ["tsconfig.base.json"]`
  (cache-soundness fix), pytest/mypy/ruff coverage extensions in
  pyproject.toml, README verification docs, KI-0002/KI-0003 parked notes.
- Suite states in the aggregate (`pnpm verify`, final run from the closeout
  tree): toolchain PASS, format PASS, lint PASS, typecheck PASS, unit-ts
  PASS, contract NOT_YET_APPLICABLE (owner M01-W05 — printed as "not a
  passing suite", exit contribution none), e2e-browser PASS, visual
  NOT_YET_APPLICABLE (owner M10-W06), python PASS, rust PASS, status PASS,
  integrity PASS → `verification exit code: 0`.
- Commands and observed results (positive matrix, pinned PATH):
  - `pnpm install --frozen-lockfile` → exit 0.
  - `pnpm lint` → exit 0. `pnpm format:check` → exit 0 (prettier + ruff
    format + cargo fmt, check-only). `pnpm typecheck` → exit 0 (turbo 8/8
    typecheck tasks + root tsc + strict mypy; turbo_task_count proof).
  - `pnpm test` → exit 0 — `turbo run test --force` (cache-bypassed, fresh):
    Tasks 8 successful/8 total, per-package Vitest proof = 8× "Tests 1
    passed" (vitest_per_package).
  - `pnpm test:contract` → exit 0, NOT_YET_APPLICABLE banner (not a pass).
  - `pnpm test:e2e` → exit 0; Playwright run "1 passed" + discovery proof
    `--list` = "Total: 1 test in 1 file".
  - `pnpm test:visual` → exit 0, NOT_YET_APPLICABLE banner (not a pass).
  - `pnpm test:python` → exit 0 (ruff check; ruff format --check; strict
    mypy "no issues found in 7 source files"; pytest 36 passed = 1
    orchestrator + 35 runner tests; pytest_min_passed proof).
  - `pnpm test:rust` → exit 0 (cargo fmt --check; clippy --all-targets
    --all-features -D warnings; cargo test "1 passed"; cargo build —
    explicit --manifest-path throughout; cargo_min_passed proof).
  - `pnpm verify` → exit 0 with the per-suite summary above; run twice
    (post-implementation and again from the final closeout tree after the
    status edits below); status-neutral (porcelain + tracked-content
    sha256 identical before/after).
  - `python3 scripts/validate_status.py` → exit 0, PASS (17 check groups),
    re-run after the final status edits.
  - Runner test suite: `uv run pytest scripts/tests -q` → 35 passed
    (fresh; also re-run inside pnpm test:python and pnpm verify).
- Freshness/cache notes: unit tests always run `--force` (canonical
  registry command) — forced executions produced the counted "Tests N
  passed" lines; typecheck relies on sound turbo caching, made sound by
  hashing tsconfig.base.json via globalDependencies — proof: warm run
  "Cached: 8 cached, 8 total" → byte change to tsconfig.base.json →
  "Cached: 0 cached, 8 total" → file restored byte-identical (empty diff).
  Playwright, pytest, and cargo executions have no cache layer in verify.
- Negative-path results (all fail-closed, automated in scripts/tests unless
  marked live):
  - Failing child command → aggregate exit 1 (test_failing_child_command…).
  - Activated-but-empty contract and visual suites → REQUIRED_MISSING, exit
    1 (fixture-status tests against the real registry; also live 4c in the
    final review: `--suite visual --status <M10-W06=IN_PROGRESS copy>` →
    exit 1 "REQUIRED and missing").
  - REQUIRED_MISSING is unconditional — fails even for mandatory:false
    suites (test_required_missing_fails_even_for_non_mandatory_suite);
    non-mandatory ACTIVE failure alone does not fail the aggregate
    (documented mandatory semantics).
  - Empty selections: pytest exit 5 → hard failure with explicit "zero
    tests" message ("pytest" anywhere in argv); vitest empty selection →
    exit 1 (live: `vitest run nonexistent_pattern`); Playwright empty
    selection → exit 1 "No tests found" (live: `--grep no_such_test…`);
    vitest_min_tests / playwright_list_min proofs reject zero-test output.
  - NOT_YET_APPLICABLE honesty: summary prints NOT_YET_APPLICABLE (never
    PASS) + "not a passing suite — owned by <package>" (asserted in tests).
  - BLOCKED activation package counts as begun → REQUIRED_MISSING (test).
  - Unrecognized state token (e.g. "IN_PROGESS") → RegistryError, exit 2,
    fail closed (test); unknown activation package → fail closed (test).
  - No-op scripts rejected: "", "true", ":", "exit 0", "echo …",
    "true && true", "exit 0 # done", "true; :" — root and workspace
    package scripts both vetted (tests); missing canonical root script
    rejected (test).
  - passWithNoTests-style bypass tokens in tracked configs rejected (test).
  - Focused/skipped tests rejected: scan covers on-disk .test.ts/.spec.ts
    and python test files + conftests regardless of git-tracking, matching
    .only/.skip/.fixme/.todo incl. `it.only.each(` (tests); live: a
    test.only spec under e2e/ → playwright forbidOnly error, exit 1.
  - Verification-caused mutation detected: porcelain + `git diff` sha256
    snapshot mismatch → status-neutral FAIL, exit 1 (test with a command
    that appends to a tracked fixture file).
  - Status-validator failure propagates: corrupt status copy (M03-W02 →
    "DONE") through the real validate_status.py → suite FAIL → exit 1
    (test).
  - Anchored summary parsing: echoed titles like "shows 5 passed items"
    or "test_5_passed_items PASSED" no longer satisfy playwright/pytest
    passed-proofs; skipped-only Playwright output fails (tests).
  - Toolchain mismatch (live): `pnpm install --frozen-lockfile` under
    default Node 26 → ERR_PNPM_UNSUPPORTED_ENGINE, exit 1. Mismatched uv
    (`required-version ==999.0.0` scratch project) → error, exit 2
    (M00-W03 evidence; mechanism unchanged).
- Test counts: runner suite 35/35 passed; full pytest 36/36; TS unit 8/8
  package tasks each 1/1 test (forced); Playwright 1/1 (discovery Total: 1
  test); Rust 1/1; all lint/format/type commands exit 0.
- Dynamic review (Ultra Code, workflow `review-m00-w04-verification-system`,
  8 owner-mandated domains + adversarial per-finding verification; the
  verification phase was cut short by a session usage limit after 22 of 33
  agents):
  - 8 findings adversarially CONFIRMED and all fixed in this tree:
    (1) REQUIRED_MISSING was mandatory-gated vs its documented
    unconditional contract → exit gate fixed + tests; (2–4, one underlying
    defect reported by three domains) registry e2e explanation misstated
    --list ordering → wording corrected; (5) unanchored Playwright
    "(\d+) passed" regex → anchored + tests; (6) BLOCKED excluded from
    STARTED_STATES → included + test; (7) invalid state tokens failed open
    → RegistryError + test; (8) Rust pin checked only via rustup →
    added cargo --version interrogation.
  - 6 findings adversarially REJECTED with recorded reasons (kept as-is):
    unhandled-OSError tracebacks (still exit nonzero = fail-closed),
    vitest_per_package vacuous-pass when zero packages declare the script
    (nevertheless hardened defensively), cargo --locked absence (spec §8.5
    verbatim commands; no deps exist), forbidOnly substring check
    (comment-spoof is self-sabotage, runtime forbidOnly still enforces),
    registry-file bypass-token exemption (forced by legitimate prose; now
    KI-0003a), e2e⊃visual glob overlap (not reachable until M10-W06; the
    overlap is deliberate until then).
  - 11 findings were NEVER adversarially verified (agents hit the session
    limit); treated as open questions and triaged individually, not
    dismissed: FIXED — turbo typecheck cache blindness to
    tsconfig.base.json (globalDependencies + live invalidation proof),
    _script_is_noop compound/comment misses (hardened + tests), workspace
    scripts escaping no-op vetting (extended + test), pytest exit-5 argv
    shape (argv membership + test), python skip-marker end-to-end coverage
    (test added), untracked-test-file scan gap + conftest coverage (scan
    now disk-based incl. conftests, test added), porcelain content blind
    spot for already-dirty files (git-diff sha256 added to snapshot),
    focused-alias gap `.only.each`/`.todo` (regex widened + tests),
    contract command not runnable from root (switched to
    `pnpm --filter @japp/contracts exec vitest run test/contract`).
    DISPOSITIONED WITHOUT CODE CHANGE — "fresh execution" proof cannot
    detect a hypothetical cache replay if --force were removed (the forced
    command is itself tracked registry content; documented), Playwright
    empty-selection/toolchain negatives "lack evidence" (this entry records
    the live runs), status-neutrality untracked-content blind spot
    (documented docstring tradeoff).
  - Final independent single-agent compliance review (read-only) verdict:
    SHIP, zero blocking defects; observations recorded (35-not-36 runner
    test count corrected here; turbo.json added to changed-file list;
    residual hardening backlog parked as KI-0003).
- Artifacts: intentionally none persisted — Playwright artifacts are
  failure-only and git-ignored (test-results/ etc.); all negative
  demonstrations used temp files/copies that were removed or /tmp paths.
- Notes:
  - `pnpm verify` semantics: exits 0 only when every mandatory ACTIVE suite
    passes, every proof holds, integrity is clean, the run is
    status-neutral, and every NOT_YET_APPLICABLE classification is valid
    against docs/PROJECT_STATUS.md; REQUIRED_MISSING is unconditionally
    fatal. Clean-tree semantics: verify must not change porcelain or
    tracked content (pre-commit dirty trees are allowed and compared as
    snapshots; the final committed repository is clean).
  - Command ownership: pnpm lint = ESLint only; Ruff lint lives in
    test:python, Clippy in test:rust; all three run inside pnpm verify.
  - scripts/verify-work-package.* / verify-milestone.* from spec §5.1 were
    deliberately NOT stubbed (they would be no-ops today); `pnpm verify`
    is the aggregate command M00 requires, and later packages add the
    package/milestone wrappers when they have real content.

### M00-W03 — Establish strict toolchain configuration (2026-07-26)

- Revision: tree 323df745c419d8cc7809e88f10bbeca018fdfbb2 / commit
  aa6b3503405651f915d21027524b112bce11f2a2 (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon). Toolchain pinned
  by this package and verified live:
  - Node v24.18.0 (`brew install node@24`, keg-only; pinned via .nvmrc +
    `engines.node` + `engineStrict: true`), replacing use of the machine's
    Node 26 Current per owner instruction. Compatibility under Node 24 was
    verified (all TS commands below); no incompatibility found, so the
    Node-24-unusable escape clause was not needed.
  - pnpm 11.17.0 served by Corepack 0.35.0 (`corepack enable pnpm`; shim at
    /opt/homebrew/opt/node@24/bin/pnpm reads the `packageManager` field).
  - Python 3.12.13 exact (uv-managed; `.python-version`), uv 0.11.32
    enforced by `[tool.uv] required-version = "==0.11.32"`.
  - Rust 1.97.1 + rustfmt 1.9.0-stable + clippy 0.1.97 via
    rust-toolchain.toml (rustup 1.29.0_2).
  - @playwright/test 1.62.0 with pinned Chrome Headless Shell
    151.0.7922.34 (playwright chromium-headless-shell v1234).
  - @types/node 24.13.3 (aligned to Node 24, replacing 26.1.1);
    TypeScript 6.0.3, Vitest 4.1.10, ESLint 10.8.0, typescript-eslint
    8.65.0, Prettier 3.9.6, turbo 2.10.7; mypy 2.3.0, pytest 9.1.1,
    ruff 0.16.0.
- Commands and observed results (positive path, run under
  PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/opt/rustup/bin:$PATH):
  - `node -v` → v24.18.0; `pnpm -v` → 11.17.0 (Corepack shim);
    `uv --version` → 0.11.32; `uv run python -VV` → Python 3.12.13;
    `cargo --version` → 1.97.1; `rustc --version` → 1.97.1;
    `cargo fmt --version` → rustfmt 1.9.0-stable; `cargo clippy --version`
    → clippy 0.1.97; `pnpm exec playwright --version` → Version 1.62.0.
  - `pnpm install --frozen-lockfile` → exit 0 under Node 24.
  - `pnpm lint` → exit 0 (typed strictTypeChecked + stylisticTypeChecked
    over every TS file via projectService; unused disable directives are
    errors).
  - `pnpm format:check` → exit 0 (canonical docs still excluded from
    formatting by .prettierignore).
  - `pnpm typecheck` → exit 0; turbo 8/8 package projects plus the root
    e2e/config project (`tsc -p tsconfig.json`), all with
    `skipLibCheck: false`, `noImplicitReturns`, `useUnknownInCatchVariables`
    added to the W02 strict baseline.
  - `pnpm exec turbo run test --force` → exit 0; Tasks: 8 successful, 8
    total (fresh, cache bypassed; one Vitest smoke test per package).
  - `pnpm exec playwright test --list` → exactly 1 test discovered:
    e2e/browser-smoke.spec.ts "pinned Chromium launches, renders controlled
    content, and executes JavaScript".
  - `pnpm test:browser-smoke` → exit 0; 1 passed (~0.6–3.4 s); the test
    renders inline `page.setContent` markup only (no network, no product
    claims) and records the Chromium version as a test annotation.
  - `uv sync --locked` → exit 0; `uv run python -c "import sys;
    print(sys.base_prefix)"` →
    ~/.local/share/uv/python/cpython-3.12.13-macos-aarch64-none (uv-managed
    interpreter, not system Python; project venv .venv/bin/python3).
  - `uv run pytest` → exit 0; 1 passed under the new strict options
    (`--strict-markers --strict-config -ra`, `xfail_strict`,
    `filterwarnings = ["error"]`).
  - `uv run ruff check services` → exit 0 under the curated strict baseline
    (24 rule families; ISC001 disabled for formatter compatibility; S101
    allowed only under tests/ — both documented in pyproject.toml).
  - `uv run ruff format --check services` → exit 0 (6 files).
  - `uv run mypy services` → exit 0 (strict = true plus warn_unreachable
    and ignore-without-code / redundant-expr / possibly-undefined codes).
  - `cargo fmt --manifest-path services/native-host/Cargo.toml --check` →
    exit 0; `cargo clippy --manifest-path ... --all-targets --all-features
    -- -D warnings` → exit 0; `cargo test --manifest-path ...` → exit 0;
    1 passed. Native-host refusal behavior unchanged from W02.
  - `python3 scripts/validate_status.py` → exit 0, PASS (17 check groups).
- Negative and enforcement checks:
  - Node pin enforced: with the machine default Node v26.0.0 active,
    `pnpm install --frozen-lockfile` → exit 1,
    `ERR_PNPM_UNSUPPORTED_ENGINE … Expected version: 24.18.0, Got: v26.0.0`
    (`engineStrict: true` in pnpm-workspace.yaml; the legacy `.npmrc
    engine-strict` flag is NOT read by pnpm 11 — verified `pnpm config get
    engine-strict` → undefined — which is why .npmrc was removed and both
    settings live in pnpm-workspace.yaml).
  - uv pin enforced: a scratch project with `required-version = "==999.0.0"`
    → `uv lock` exit 2, "Required uv version `==999.0.0` does not match the
    running version `0.11.32`".
  - Rust pin resolved: inside the repo `rustup show active-toolchain` →
    `1.97.1-aarch64-apple-darwin (overridden by '…/rust-toolchain.toml')`;
    outside the repo → `stable-aarch64-apple-darwin (default)`.
  - Playwright discovery: `--list` shows exactly the one intended test;
    `playwright test --grep does_not_exist` → exit 1, "Error: No tests
    found" (an empty browser suite cannot pass).
  - Vitest empty suite fails: `vitest run nonexistent_pattern` in a package
    → exit 1 ("No test files found").
  - pytest empty selection fails: `uv run pytest -k nomatch_xyz` → exit 5
    (1 deselected, no tests ran).
- Test counts: TypeScript 8/8 package smoke tests; Playwright 1/1 browser
  infrastructure test; Python 1/1; Rust 1/1; all lint/format/type/version
  checks exit 0; 6/6 negative-enforcement checks behaved as required.
- Artifacts: none retained (Playwright trace/screenshot/video are
  failure-only by config and the run passed; artifact dirs are
  git-ignored).
- Notes:
  - Environment changes performed on this Mac during the package:
    `brew install node@24` (24.18.0, keg-only), `corepack enable pnpm`
    (shims inside the node@24 keg), `rustup toolchain install 1.97.1`
    (with rustfmt/clippy, in ~/.rustup), Playwright Chromium headless-shell
    151.0.7922.34 download (~/Library/Caches/ms-playwright). No shell rc
    files were modified; activation is documented in README.md.
  - KI-0001 (no JS/TS build task) intentionally remains DEFERRED: this
    package adds no real build target, so adding a `build` task would still
    be a mocked success (owner instruction honored).
  - The Playwright smoke test is infrastructure-only by design; product
    e2e/visual suites and their aggregation (`test:e2e`, `test:visual`,
    `pnpm verify`) remain M00-W04+ scope.

### M00-W02 — Scaffold the monorepo (2026-07-26)

- Revision: tree 15cc0edec64e4b4f986e7c1ee210d88a1e448140 / commit
  b64f54da8ec3c302bd28efac68afd80ea5efc142 (stamped in the follow-up commit
  per the anchoring convention above).
- Environment: macOS 27.0 (Darwin 27.0.0, Apple silicon — the spec's target
  machine class); Node v26.0.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13
  (uv-managed via `.python-version`), rustc/cargo 1.97.1 with rustfmt 1.9.0
  and clippy 0.1.97 (rustup stable — the Rust toolchain was absent on this
  machine and was installed during this package via Homebrew `rustup`
  1.29.0_2; recorded as an environment change). Pinned tool versions:
  TypeScript 6.0.3, Vitest 4.1.10, @types/node 26.1.1 (pnpm catalog, exact),
  ESLint 10.8.0, typescript-eslint 8.65.0, Prettier 3.9.6, turbo 2.10.7
  (exact, `save-exact`); pytest 9.1.1, ruff 0.16.0, mypy 2.3.0 (`==` pins);
  lockfiles committed: pnpm-lock.yaml, uv.lock, services/native-host/Cargo.lock.
- Commands and observed results:
  - `pnpm install` → exit 0; `pnpm install --frozen-lockfile` → exit 0
    ("Already up to date").
  - `uv sync` → exit 0 (installs orchestrator editable); `uv sync --locked`
    → exit 0.
  - `pnpm lint` (`eslint .`) → exit 0.
  - `pnpm exec turbo run typecheck --force` → exit 0; Tasks: 8 successful,
    8 total (strict `tsc --noEmit` in every packages/* package).
  - `pnpm exec turbo run test --force` → exit 0; Tasks: 8 successful, 8
    total (one Vitest workspace-wiring smoke test per packages/* package).
  - `pnpm format:check` → exit 0 (canonical docs/CLAUDE.md are excluded via
    .prettierignore so tooling can never rewrite the contract).
  - `uv run pytest` → exit 0; 1 passed (orchestrator package/distribution
    wiring smoke test).
  - `uv run ruff check services` → exit 0 ("All checks passed!").
  - `uv run ruff format --check services` → exit 0 (6 files already
    formatted).
  - `uv run mypy services` (strict = true) → exit 0; no issues in 2 source
    files.
  - `cargo fmt --check` (services/native-host) → exit 0.
  - `cargo clippy --all-targets --all-features -- -D warnings` → exit 0.
  - `cargo test` → exit 0; 1 passed, 0 failed.
  - `./target/debug/native-host` → exit 1 with the explicit notice
    "not implemented until work package M17-W04; refusing to run" (honest
    refusal — no fake transport).
  - `pnpm exec turbo run build` → exit 1, "Could not find task `build` in
    project" — deliberate deferral, recorded as KI-0001 in
    docs/KNOWN_ISSUES.md (a build task over zero implementers would be a
    mocked success state).
  - `python3 scripts/validate_status.py` → exit 0, PASS (17 check groups),
    run after the final status update for this package.
- Test counts: TypeScript 8/8 package smoke tests passed; Python 1/1
  passed; Rust 1/1 passed; every lint/format/typecheck command exit 0.
- Artifacts: none (scaffold only; no UI exists yet, so §1.3.6 manual UI
  inspection is not applicable).
- Notes:
  - TypeScript is pinned to 6.0.3, not the newest 7.0.2, because
    typescript-eslint 8.65.0 declares support for typescript
    ">=4.8.4 <6.1.0"; recorded so M00-W03 revisits the pin deliberately.
  - `tsconfig.base.json` sets `"types": ["node"]` explicitly — TypeScript
    6.x no longer auto-includes `@types/node` under this configuration.
  - The root `package.json` `packageManager: pnpm@11.17.0` field is
    structurally required by turbo (it refuses to resolve the workspace
    without it); `.python-version` (3.12) enforces the spec §5.2 interpreter
    on a machine whose default python3 is 3.14.
  - apps/desktop, apps/extension, apps/mock-ats-lab and
    services/job-index-api, services/job-ingestion-worker are intentionally
    empty workspace slots with READMEs naming their owning milestones —
    no fake features (spec §1.5, M00 prohibited shortcut).
  - Pre-closeout adversarial review (multi-agent, 4 lenses + per-finding
    adversarial verification): 2 raw findings, 1 confirmed (missing recorded
    rationale for the absent build task — resolved by KI-0001 before this
    entry), 1 rejected (pnpm/Python pinning is mandated by W02's
    reproducibility requirement, not M00-W03 scope pulled forward).

### M00-W01 — Create canonical project-memory files (2026-07-26)

- Revision: tree e1dd209417af97b3cab320b4ab01fbd702547136 / commit 63d9442258c68a9dd8ecb9a20810e5740679557c (stamped in the follow-up commit per the
  anchoring convention above).
- Environment: Linux 6.18.5 (cloud work environment), Python 3.11.15,
  git 2.43.0. Note: the spec's target machine (macOS, Apple silicon M5,
  24 GB) is not exercised by this package; M00-W01 produces only
  project-memory documents and a stdlib-only validation script.
- Commands and observed results:
  - `sha256sum "<owner upload>/MASTER_IMPLEMENTATION_SPEC(1).md" docs/MASTER_IMPLEMENTATION_SPEC.md`
    → exit 0; both `2ddbda1db42cb4a4efdb61415ee1f348811f088f3d70b0a5570f6b4e0570dac8`
    (canonical spec copy is byte-identical to the owner's source file).
  - `python3 scripts/validate_status.py` (real files, final state)
    → exit 0; `PASS: all checks passed (17 check groups)` — all eight
    project-memory files present with required structure; spec parsed
    (38 milestones, 227 work packages); status header/sections present;
    milestone table complete (38 rows, valid enums); work-package table
    complete (227 rows, exactly one state each); IN_PROGRESS count ok;
    current-package field consistent; next READY package is READY;
    dependency order respected; milestone/package states consistent.
  - Negative case A — invalid enum (`M03-W02` set to `DONE` in a mutated
    copy, run with `--status /tmp/status_bad_enum.md`) → exit 1;
    `invalid work-package state for M03-W02: 'DONE'` (plus consequent
    milestone-consistency error). Rejected as required.
  - Negative case B — two IN_PROGRESS packages (`M01-W01` also set
    IN_PROGRESS, `--status /tmp/status_two_ip.md`) → exit 1;
    `more than one work package IN_PROGRESS: ['M00-W01', 'M01-W01']`
    (plus skipped-dependency and milestone-consistency errors). Rejected
    as required by spec §12.
  - Negative case C — skipped dependency (`M01-W01` set READY while M00
    unfinished, `--status /tmp/status_dep_skip.md`) → exit 1;
    `M01-W01 is READY but dependency milestone M00 has unfinished packages`.
  - Negative case D — missing package row (`M37-W07` row removed,
    `--status /tmp/status_missing_row.md`) → exit 1;
    `work-package table missing 1 package(s): ['M37-W07']`.
  - During execution, the validator was also run once with M00-W01
    IN_PROGRESS (the mandated mid-package state) → exit 0, PASS.
- Test counts: validator checks — 17 check groups PASS on real files;
  4/4 negative structure cases correctly rejected (exit 1 each).
- Artifacts: none beyond the committed files (no screenshots; no UI exists
  yet).
- Notes:
  - The one-off table generator that seeded PROJECT_STATUS.md derives both
    tables by parsing docs/MASTER_IMPLEMENTATION_SPEC.md with the same
    parser the permanent validator uses (`scripts/validate_status.py`), so
    the seeded tables cannot silently diverge from the spec.
  - `scripts/validate_status.py` is the "small validation script" required
    by spec §12; it is stdlib-only. M00-W04 will wire it into the root
    verification commands.
  - Work-environment limitation (process, not product): github.com egress
    is blocked in the cloud work environment used for this package, so the
    `origin` remote (https://github.com/kalwad/jobapplyv2.git) is configured
    but unpushed; the owner pushes from the development machine. Recorded
    also under Known release blockers in PROJECT_STATUS.md.
