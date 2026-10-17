# Compatibility Matrix

ATS/browser/OS support and measured pass rates
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1).

## Update rules

- Only measured, evidence-linked results may appear here. No claimed support
  without fixtures, a recorded test run, and a `docs/TEST_EVIDENCE.md` entry.
- Untested or unsupported variants must be listed and labeled as such rather
  than omitted (spec v1.4: M19-W01/M20 Workday certification, M23-W05
  initial adapter matrix, M31-W04 compatibility dashboard, M37-W06 published
  limits): compatibility is published honestly, never inflated.
- Compatibility claims are limited to measured ATS families, tenant/layout
  patterns, browser versions, adapter versions, locales, session modes, and
  last-tested dates (OD-018, REQ-FORM-021, REQ-WD-020). Universal support —
  "every ATS", "all Workday tenants" — is prohibited.
- A row's "Last verified revision" must be a commit/tree whose recorded
  evidence actually exercised that row.
- Population begins when the producing milestones run: research (non-claim)
  evidence from M02; browsers/OS from M03/M17 onward; production ATS
  adapters Workday-first — Workday (M19–M20), then Greenhouse (M21),
  Lever (M22), Ashby (M23), iCIMS/SmartRecruiters (M29),
  Taleo/SuccessFactors (M30).
- M01-W07 defined the typed contract shape a future row must carry (exact
  target, architecture, browser family/channel and version, artifact digest
  and signature state, reviewed support tier, reviewer, evaluated revision,
  evidence references, and last-tested date). Defining that shape adds no row
  and grants no support claim; the production support tables below remain empty.

## Owner evidence waiver — 2026-10-17

Direct Simplify comparison and executed public-form evidence prerequisites are WAIVED_BY_OWNER_ADR_0007 under accepted OD-036 / ADR-0007. Actual direct Simplify/public scored cases remain0. Historical rows below retain their observations and source bindings; their older pending-prerequisite language is historical. A waiver grants no public ATS support, compatibility, parity or superiority. Production support rows still require their nonwaived measured fixture/controlled evidence, versions, scoped compatibility record and applicable gate decision. Product capabilities, controlled/native verification and other baselines remain required.

## M02-W14 research observations (non-support claims, 2026-10-16)

W14 remains IN_PROGRESS and Gate A IN_PROGRESS. These source-scoped synthetic and structural observations do not populate production adapter/browser/OS support rows. Historical inventories include uncommitted candidates; later observations bind committed runtime 15c7e33, original peer `f7f9dc1` and paired source lock `47b6fe33`. No accepted W14 revision exists.

| Evidence scope | Environment / variants | Observed result | Limit / evidence |
|---|---|---|---|
| Corrected synthetic contact cohort | Apple M5/24 GiB, Chromium 151.0.7922.34; W12 Workday 80, Greenhouse/Lever/Ashby 40 each; four authored locales | 200/200 scored, 4060 native / 4020 logical controls; ordinary precision 1485/1485, required ordinary recall 1275/1275, reporting 770/770, persistence 1485/1485; 90/90 initial values preserved | Specific contact profile only; corrected/batched/untraced p95 1799.8664160000044 / 2087.8410830000066 / 2009.8366249999963 ms; both target assertions FAIL. docs/TEST_EVIDENCE.md § M02-W14 |
| Public read-only structural inventory | Current primary sources: Workday 10, Greenhouse 8, Lever 8, Ashby 4; anonymous Chromium 151.0.7922.34 | 30 inspected sources; 10 Workday method-choice boundaries and 20 blank public forms | 0 extension-fill evaluations, 0 scored controls, 0 comparisons. docs/evidence/m02-w14-external/public-current-matrix.json |
| Isolated actual legacy components | JobApply c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd; shared CareerPulse component bytes; Chromium 151.0.7922.34; four grouped/en-US fixtures | Per case 8 event witnesses/8 rerenders, 7 exact ordinary matches; phone formatting differs, country/region empty; 0 observed navigation/submission | COMPONENT_DETERMINISTIC_NO_AI; one shared-component execution, not two full-product comparisons; no production code reuse. docs/evidence/m02-w14-external/capture-summary.json |
| Simplify readiness only | Official product/demo/help and normal Chrome sign-in route | Actual comparison cases/autofill runs 0 | Authenticated synthetic comparison pending; installed extension/session state unknown. docs/evidence/m02-w14-external/simplify-readiness.json |
| Committed contact/runtime checkpoint |15c7e33; same target Mac/Chromium and200 W12 contact recipes |200/200, same exact numeric/safety pairs; full-settlement p95 857.1561660000007ms; separate native128 target 20 p95 1333.9919169999994ms | Individual source/build immutable; integrated aggregate had unrelated assertion/fixture and neutrality failures, not PASS. docs/evidence/m02-w14-integrated-checkpoint |
| Actual public contact attempt |30 original declared anonymous URLs; network-closed action requirement |18 transport refusals plus12 form/oracle refusals;0 action requests,0 scored rows; accuracy null | Complete refusal matrix, not a support or zero-risk claim. docs/evidence/m02-w14-public-actual |
| Integrated exact original peer |f7f9dc1, four unchanged grouped/en-US inputs |32/40 candidate versus 28/40 legacy exact;32/40 versus 32/40 phone equivalent | Formatting difference alone gives no decisive accuracy win. docs/evidence/m02-w14-comparisons-actual |
| Actual paired approved-option comparison |source lock `47b6fe33`; candidate 4/legacy4, identical ten facts/approved token metadata, same11-surface native observer |40/40 versus 28/40 exact;40/40 versus 32/40 phone equivalent; eight state/country differences | One shared component/four related synthetic fixtures; no broad/statistical/timing or Simplify/Gate A claim. docs/evidence/m02-w14-comparisons-actual/paired-comparison.json |
| Frozen aggregate/contact checkpoint | b8b1423; target Mac, same Chromium and all 200 W12 recipes | All 19 active suites PASS; 200/200 with unchanged accuracy/safety pairs, full-settlement p95 865.8358330000192 ms; separate native128 target 20 p95 1480.3922500000008 ms | Visual NOT_YET_APPLICABLE; zero-settle target and full-settlement campaign remain distinct. docs/evidence/m02-w14-frozen-b8b1423 |
| Historical actual public observation | Clean 8ae96f0; same original 30 URLs, literal native labels and bounded read-only acquisition before unchanged strict closure | 17 transport refusals, 7 form/protected refusals, 6 interference outcomes; 0 action requests, 0 scored rows, accuracy/site acceptance null | All 62 controlled proofs pass; safe refusals provide no public fill/support credit. docs/evidence/m02-w14-public-observation-correction |

| Corrected native-validity full checkpoint | Clean0dd88ce; target Mac/Chromium, same200contact recipes |19/19active suites;3859units/234default browser/62controlled/1454Python; contact p95871.8325829999521ms; separate native128 target20 p951489.9990840000028ms | Exact contact counts unchanged;90original W13 incorrect abstentions remain; preservation is supplemental. No Gate A/production claim. docs/evidence/m02-w14-frozen-0dd88ce |
| Corrected-runtime actual paired comparison | Revision7 locke5b9a8dd, runtime355/c3757409; same4related synthetic cases and shared legacy component |40/40vs28/40exact;40/40vs32/40phone equivalent; candidate0/legacy4unexpected native country-code activations | Both final nonordinary/nav/submit0 in observer scope; prior revision6 already records the same4activations, correcting old prose. docs/evidence/m02-w14-revision7-actual |
| Latest actual public observation | Clean0dd88ce; same original30URLs |17closure refusals,7form/protected refusals,6interference;0dispatches/scored rows; natural accuracy/acceptance null | Independent24-check reporting audit passes, not public fill coverage. Event/OS-descendant limits remain. docs/evidence/m02-w14-public-0dd88ce |

The contact campaign does not exercise upload/repeater/date/checkbox/radio/custom-combobox drivers, iframe/shadow DOM, page transitions, parser effects or long-session soak. Presence of those features in W12 recipes is not measured support. ADR-0006 marks owner holdout WAIVED_BY_OWNER and changes no product compatibility promise.

## Workday tenant patterns (first production ATS — spec §5.11.9.13)

Nothing measured yet (Workday production adapter: M19; guided pre-submit
certification: M20). Certification records are scoped to tenant/layout/
locale/session patterns, never the Workday brand.

| Tenant pattern | Locales | Session modes | Adapter version | Browser version | Precision | Recall | Final-review reach rate | Manual corrections | State | Last tested | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | — | — |

## ATS adapters

Nothing measured yet — no adapter exists (first production adapter: M19,
Workday; M02 produces research evidence only, which never becomes a support
claim).

| ATS | Adapter version | Tenant/layout variants tested | Field precision | Recall | Sensitive false fills | Receipt detection | Last verified revision | Evidence |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## Browsers (extension)

Nothing measured yet as a support claim (production extension foundation:
M17). M02-W07 produced feasibility research evidence only: the minimal
built Manifest V3 extension loads in bundled Playwright Chromium (pinned
Playwright 1.62.0) through a persistent context with the actual service
worker and a loopback-only content-script probe against the synthetic mock
ATS fixture. The W07 code performs no product action; the measured page-
observable boundary is its ACK-gated readiness marker plus WXT 0.20.27's
bounded non-sensitive content-script-started CustomEvent, with WXT's default
postMessage suppressed and zero additional extension-originated event/message
observed (docs/TEST_EVIDENCE.md § M02-W07). That is research (non-claim)
evidence — not Chrome Web Store distribution, not general ATS support, and
not production autofill support — and it adds no browser row; rows begin
with M03/M17 measured evidence per the population rule above.

| Browser | Version range | Extension status | Last verified revision | Evidence |
|---|---|---|---|---|
| — | — | — | — | — |

## Operating systems (desktop app)

The first-release policy targets macOS 14+ arm64, Windows 11 x64, and Ubuntu
24.04 LTS x64. No desktop product or packaged platform evidence exists, so
all three are `NOT_YET_IMPLEMENTED`; this is a target matrix, not a support
claim. M00 hosted checks (macOS 15 arm64, Windows Server 2025 x64 since
M00-W09, Ubuntu 24.04 x64) prove repository/toolchain bootstrap only; a
passing `windows-2025` job is not packaged Windows 11 desktop support.
Product certification and Gate D remain later work; see
`docs/PLATFORM_SUPPORT.md`.

| OS | Architecture | Desktop app status | Last verified revision | Evidence |
|---|---|---|---|---|
| macOS 14+ | arm64 | NOT_YET_IMPLEMENTED | — | — |
| Windows 11 | x64 | NOT_YET_IMPLEMENTED | — | — |
| Ubuntu 24.04 LTS | x64 | NOT_YET_IMPLEMENTED | — | — |

## Model runtime

Nothing measured yet (primary Mac profile acceptance: M05; Windows/Ubuntu
capability and safe fallback: M05; final full-AI Windows/Ubuntu acceptance:
M27-W10). No Windows or Ubuntu full-AI profile is accepted.

| Runtime | Model tag | Digest | Benchmark result | Last verified revision | Evidence |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Familiarity and experimental-provider compatibility

M00-W11 adds governance records only. No UI surface has an owner-approved
baseline or measured familiarity result, and no experimental external provider
is implemented, evaluated, enabled, or release-supported. These states cannot
be promoted by prose in this matrix; they require the revision-scoped evidence
and decisions in `docs/UI_FAMILIARITY.md`,
`docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md`, and
`docs/EXPERIMENTAL_AI_PROVIDERS.md`.

| Capability | Current state | Last verified revision | Evidence |
|---|---|---|---|
| Familiarity-first product surfaces | NOT_YET_IMPLEMENTED | — | — |
| Owner-approved visual baselines | NOT_APPROVED | — | — |
| Experimental ChatGPT-account provider | NOT_SUPPORTED / DISABLED_BY_DEFAULT / NOT_IMPLEMENTED / NOT_EVALUATED | — | — |
