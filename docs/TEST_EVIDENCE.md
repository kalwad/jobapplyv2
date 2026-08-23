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

### M02-W08 — Final independent verification and governance (2026-08-23)

- Verdict: `FABLE_CLEAR_FINAL_M02_W08_CONTENT` on exact visibility-correction
  commit `4afd0e97401794a113ff2bdfcff255e119296127` / tree
  `3aab675ae852fe0f14ce4be52e1630a88ce2b202` (parent
  `bc32eb21ea881dbdd46b8e40d9b07b0e653020aa`), issued by the final fresh
  independent Fable verifier. This bounded continuation reused the prior
  verifier's independently cleared application-root and carried-forward W08
  results without reopening them and used no reviewer subagent.
- Environment: macOS 27.0 arm64; Node 24.18.0; pnpm 11.17.0; Playwright
  bundled Chromium; uv-managed Python for canonical suites; specification
  JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Boundary: `git fetch origin`, both porcelain status forms,
  branch/HEAD/origin/tree/parent equality, `git diff --check`, and the
  specification digest confirmed a clean synchronized `main` at the exact
  target before verification. Exactly one forward commit from the cleared
  root correction; changed files confined to
  `apps/extension/src/field-scanner.ts`,
  `e2e/extension/extension-scanner.spec.ts`, `docs/PROJECT_STATUS.md`, and
  `docs/TEST_EVIDENCE.md`; the production change is confined to
  `isElementVisible` and the bounded `hasFixedAncestor` helper (final
  `field-scanner.ts` SHA-256
  `68c23ea1b94baeda528787df2b95ac2470a8b93e6e1ac78e927b021d13b94aaa`).
- Focused commands and observed results on the exact final bytes:
  - `pnpm --dir apps/extension exec vitest run
    test/m02-w08/scanner-protocol.test.ts --no-file-parallelism
    --maxWorkers=1` -> exit 0, **16 passed**.
  - `pnpm --dir apps/extension test` -> exit 0, **79 passed** in 3 files.
  - `pnpm exec playwright test e2e/extension/extension-scanner.spec.ts
    --reporter=line` -> exit 0, **19 passed** (C1–C6, V1, V2, V3, V4–V6, V7,
    and every retained case).
  - `pnpm exec playwright test e2e/extension --reporter=line` -> exit 0,
    **32 passed**, including every retained W07 extension regression.
  - `pnpm exec playwright test --list` -> **91 tests in 24 files**.
- One fresh visibility variant (one temporary spec file, deleted after the
  run; the worktree returned byte-clean): a unique bare `<form>` with a
  `for`-linked required `<textarea>` displaced below the initial fold by
  `margin-top:2600px` on its paragraph wrapper — markup and layout distinct
  from the permanent V1 fixture — self-checked its geometry (`scrollY` 0,
  `rect.top > innerHeight`, nonzero box), reported `visible=true` before any
  scroll, and kept the complete descriptor set apart from `observed_at`
  byte-identical after `scrollIntoView` (`scrollY > 0`) -> exit 0,
  **1 passed**. No second fresh visibility family was created.
- Pending final verifier mutations (exactly two, stopped at N2; each
  restoration verified byte-exact by SHA-256 against the pre-mutation value):
  - N1 — frame/report coherence: `descriptorBelongsToFrame` in
    `apps/extension/src/scanner-protocol.ts` was weakened to session-only so
    a structurally valid frame scan report whose descriptor addresses
    mismatch the report's own `frame_id`/`document_id` would parse and be
    accepted into worker aggregation -> existing unit test "a frame report
    rejects descriptors from another typed frame or an unresolved root"
    failed (**1 failed, 15 passed**); restored
    (`dd2025647bcb8813640bab8012bee0dc1dcb06a1d21c3b20fae32b25e2786f02`).
  - N2 — no-guess boundary: the ambiguous branch of
    `reresolveFrameAddress` in `apps/extension/src/field-scanner.ts` was
    mutated to resolve the first candidate -> existing browser test "M4:
    multiple current semantic matches return ambiguous and never pick the
    first" failed (**1 failed**); restored
    (`68c23ea1b94baeda528787df2b95ac2470a8b93e6e1ac78e927b021d13b94aaa`).
- Canonical local verification at the exact target:
  `python3 scripts/check_portability.py` PASS;
  `python3 scripts/validate_status.py` PASS (45 check groups);
  `pnpm traceability:check` PASS (193 requirements / 300 work packages);
  `pnpm generate:contracts --check` -> 183 files byte-identical;
  `pnpm run doctor` -> 25 pass, 0 warning, 0 fail, 1 not-yet-applicable;
  `pnpm verify` -> verification exit code 0 with every ACTIVE suite PASS and
  visual NOT_YET_APPLICABLE; `git diff --check` clean and the authoritative
  checkout remained clean throughout.
- Hosted correction proof: push run `32588226547` at exact head
  `4afd0e97401794a113ff2bdfcff255e119296127` (tree
  `3aab675ae852fe0f14ce4be52e1630a88ce2b202`), overall SUCCESS; jobs
  Ubuntu 24.04 `97067740170`, macOS 15 `97067740274`, and Windows 2025
  `97067740307` all SUCCESS. The complete Windows raw log reconciles
  extension 79, browser 91 passed (91 tests in 24 files), contracts 2440 +
  662, generated 183 byte-identical, Python Windows/common 1387, Rust 1 +
  10, status 45 check groups, traceability ACTIVE PASS, visual
  NOT_YET_APPLICABLE, verification exit code 0, and the tracked-clean
  assertion.
- Documented limitations preserved as limitations, not blockers or support
  claims: fixed descendants whose containing block is re-established by
  transform/filter/contain/will-change behavior; clip-path; ancestor
  overflow clipping; nested scroll containers and wrapper-scroller SPAs;
  RTL negative scrollX; positive overflow concealed by overflow roots. No
  canonical or permanent supported W08 case exercises them incorrectly and
  the canonical W08 specification does not require them, so no new
  KNOWN_ISSUES entry was created.
- Lifecycle simulation: a fresh `git clone --no-local --no-hardlinks` at the
  exact content commit received exactly these governance edits (M02-W08
  IN_PROGRESS -> VERIFIED at tree
  `3aab675ae852fe0f14ce4be52e1630a88ce2b202`; M02-W09 NOT_STARTED ->
  READY; exactly one READY and zero IN_PROGRESS packages; M02 IN_PROGRESS;
  REQ-FORM-013/014/019 SCAFFOLD_ONLY / NOT_YET_APPLICABLE; all four critical
  gates NOT_EVALUATED; release NOT_READY), regenerated the traceability view,
  and passed `python3 scripts/validate_status.py`, `pnpm traceability:check`,
  and `pnpm verify` (exit 0) with no implementation, test, or validator
  change before this authoritative governance commit.
- Owner-evidence exclusion: no private owner evidence was accessed,
  enumerated, or required. No W09/W10/W11 implementation and no Gate A
  execution occurred.

### M02-W08 — Scroll-independent visibility correction writer evidence (2026-08-22)

- Revision: second correction writer pass starting from required synchronized
  `main` commit `bc32eb21ea881dbdd46b8e40d9b07b0e653020aa`, tree
  `4ef959a569c546b566c09557f26d27123197f88d`, parent
  `b7b7a157aa10e8f2dd0b9f15a06c46e7327b33c3`; the correction content tree is
  recorded post-commit by the containing commit. M02-W07 remains CLOSED and
  VERIFIED at its preserved evidence boundary.
- Environment: macOS 27.0 arm64; Node 24.18.0; pnpm 11.17.0; WXT 0.20.27;
  Playwright 1.62.0 with bundled Chromium (measured persistent-context
  viewport 1280x720); uv 0.11.32 with Python 3.12.13; specification
  JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Exact starting boundary: `git fetch origin`, both required porcelain status
  forms, branch/HEAD/origin/tree/parent checks, `git diff --check`, and the
  specification digest confirmed a clean synchronized `main` at the required
  commit/tree/parent before any correction edit.
- Carried-forward verifier result: the second fresh verifier
  (`SOL_BLOCKED_FINAL_M02_W08_CORRECTION_VERIFICATION`) independently found
  the unique-form application-root correction CLEAR (exact blocker markup,
  C1–C6, stronger explicit-root precedence, no-form semantic-main fallback,
  multi-form ambiguity, narrow `role=form`, and subtree token outside the
  unique root) and stopped on the next mandatory check. `detectApplicationRoot`
  and root precedence were not changed by this pass.
- Exact blocker reproduction on unchanged production bytes
  (`apps/extension/src/field-scanner.ts` SHA-256
  `91b38b819156e8f0e003308c5d40647982cf734dc9dd8117bcc7d98e5d0422df`): the
  new bundled-MV3 Chromium regressions V1, V2, V3, and V4–V6 were written
  first and run against the unchanged scanner with `pnpm exec playwright test
  e2e/extension/extension-scanner.spec.ts --reporter=line` -> exit 1,
  **3 failed, 15 passed**. V1: for `<main><form><label>Above fold field
  <input name="aboveFold" required></label><div style="height:3000px"></div>
  <label>Below fold field <input name="belowFold" required></label></form>
  </main>` at `scrollY` 0 with the below-fold box entirely under
  `innerHeight`, `Below fold field` reported `visible=false`. V2 on the same
  unchanged document: initial `{Above fold field: true, Below fold field:
  false}`; after `scrollIntoView` on the below-fold control `{Above fold
  field: false, Below fold field: true}`; after scrolling back to the top
  `{Above fold field: true, Below fold field: false}`. V4–V6: every
  concealment family was already `false`, but the ordinary below-fold
  positive control was `false`. V3 and C1–C6 passed on the unchanged bytes.
- Root cause and correction: `isElementVisible` treated current viewport
  intersection (`rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight
  && rect.left < innerWidth`) as visibility. The corrected definition keeps
  every concealment rejection (hidden / `aria-hidden` / `inert` on the
  element or an ancestor, `display:none`, `visibility:hidden` or `collapse`,
  the element's own computed opacity zero, zero-width or zero-height box),
  then shifts the bounding box by the owning window's `scrollX`/`scrollY`
  and requires it to intersect `[0, documentElement.scrollWidth) x [0,
  documentElement.scrollHeight)` in document coordinates. A control that is
  itself `position:fixed` or has a `position:fixed` DOM ancestor does not
  move with window scroll, so its box is compared unshifted against
  `innerWidth`/`innerHeight`. Negative-coordinate displacement does not
  extend the scrollable area, so `left:-10000px` / `top:-10000px` controls
  remain invisible. No clip-path, ancestor overflow clipping, nested
  scroll-container, or containing-block property modelling was added.
- Permanent visibility matrix (real bundled Chromium; every fixture
  self-checks its geometry before scanning): V1 keeps the below-fold required
  field `visible=true` before any scroll (`scrollY` 0 and `rect.top >
  innerHeight` asserted). V2 requires the complete descriptor set, apart from
  `observed_at`, to be identical across the initial, scrolled-to-bottom
  (`scrollY > 0` and above-fold `rect.bottom < 0` asserted), and
  scrolled-back states with `{Above fold field: true, Below fold field:
  true}` at every step. V3 keeps `position:absolute` controls at
  `left:-10000px` and `top:-10000px` with 240x32 boxes (`rect.right < 0` /
  `rect.bottom < 0` asserted) invisible while the in-flow control is visible;
  the retained 1x1 `Offscreen field` case in the descriptor test is
  unchanged. V4–V6 is one below-fold matrix in which hidden attribute, hidden
  ancestor, `aria-hidden` self and ancestor, `inert` self and ancestor,
  `display:none`, `visibility:hidden`, `visibility:collapse`, `opacity:0`,
  zero-width, and zero-height inputs (0 asserted) are `false` while the
  above- and below-fold positive controls are `true`, and the whole set is
  unchanged after the matrix is scrolled into view. V7 keeps a control inside
  a pinned `position:fixed` footer `true` and a control inside a closed
  off-viewport `position:fixed` drawer (`top:-200px`, `rect.bottom < 0`
  asserted) `false`, with the complete descriptor set identical at `scrollY`
  0 and after `window.scrollTo(0, 1000)` (unchanged client rects asserted).
- One bounded read-only reviewer, with no subdelegation or tracked edit,
  inspected only scroll invariance, below-fold semantics, deliberate
  off-canvas preservation, and the concealment families; it ran the W08 unit
  suite (16 passed) and the scanner spec once (18 passed at that interim
  point). It returned one in-scope defect, which the writer reproduced
  before changing code: the interim correction classified viewport anchoring
  from the control's own computed `position` only, so a static control
  inside an off-viewport `position:fixed` container still received the
  document scroll offsets and flipped from `visible=false` at `scrollY` 0 to
  `true` after `window.scrollTo(0, 1000)`. The new V7 run against the
  interim `field-scanner.ts` (SHA-256
  `7cf0f74c53616fe162060fd1f443b6d3baefd6675926bc805144c4761fcb17ec`) exited
  1 with **1 failed, 18 passed** and exactly that flip. The final correction
  treats a control as viewport-anchored when it or any DOM ancestor has
  computed `position:fixed`. The reviewer's second, lower-likelihood
  observation — a control that is itself `position:fixed` beneath an
  ancestor that re-anchors fixed descendants through `contain`, `filter`,
  `will-change`, or `transform` — is recorded as a known limitation with the
  clip-path, overflow-clipping, and nested-scroller (including
  `html{overflow:hidden}` wrapper-scroller) families; no containing-block
  property list was added. No second reviewer pass was run.
- Focused commands and observed results on the final bytes before
  documentation freeze (`field-scanner.ts` SHA-256
  `68c23ea1b94baeda528787df2b95ac2470a8b93e6e1ac78e927b021d13b94aaa`):
  - `pnpm exec playwright test e2e/extension/extension-scanner.spec.ts
    --reporter=line` -> exit 0, **19 passed** (14 retained cases including
    C1–C6 plus V1, V2, V3, V4–V6, and V7).
  - `pnpm exec playwright test e2e/extension --reporter=line` -> exit 0,
    **32 passed**, including every retained W07 extension regression.
  - `pnpm --dir apps/extension exec vitest run
    test/m02-w08/scanner-protocol.test.ts --no-file-parallelism --maxWorkers=1`
    -> exit 0, **16 passed**.
  - `pnpm --dir apps/extension test` -> exit 0, **79 passed** in 3 files.
  - `pnpm exec playwright test --list` -> exit 0, **91 tests in 24 files**;
    the five net-new browser cases are V1, V2, V3, V4–V6, and V7.
  - `pnpm --dir apps/extension run typecheck`, affected-file Prettier and
    ESLint checks, and `git diff --check` -> exit 0.
- Exactly two mutation families were run against the final scanner bytes
  through the scanner spec and stopped at M2; the final `field-scanner.ts`
  SHA-256 matched its pre-mutation value after each restoration (the same
  two families had earlier been run against the interim bytes with
  3 failed / 15 passed and 2 failed / 16 passed):
  - M1 restored vertical viewport dependence (zero scroll offset and
    `innerHeight` as the reachable height) -> V1, V2, V4–V6, and V7 failed
    with the below-fold and scrolled-past controls invisible again
    (**4 failed, 15 passed**).
  - M2 removed the negative-coordinate off-canvas rejection -> the retained
    `Offscreen field` assertion, V3, and V7 failed with the displaced controls
    reported visible (**3 failed, 16 passed**).
- Scope and governance: only the `isElementVisible` function and its new
  `hasFixedAncestor` helper in `apps/extension/src/field-scanner.ts`,
  `e2e/extension/extension-scanner.spec.ts`, `docs/PROJECT_STATUS.md`, and
  `docs/TEST_EVIDENCE.md` changed. `detectApplicationRoot`, the scanner
  protocol, semantic identity, frame isolation, re-resolution, and every
  other scanner surface were not changed. Excluded private owner evidence
  was neither required nor accessed. M02-W08 remains IN_PROGRESS; M02-W09
  remains NOT_STARTED; no package is READY; M02 remains IN_PROGRESS; all four
  gates remain NOT_EVALUATED; release remains NOT_READY. No W09/W10/W11
  implementation or Gate A execution occurred.
- Frozen verification deferral: after final documentation bytes, the complete
  canonical sequence is run twice without intervening edits and reported in
  the writer handoff. No canonical, hosted, independent-verification, package
  verification, gate, acceptance, or release result is preclaimed here.

### M02-W08 — Unique-form application-root correction writer evidence (2026-08-22)

- Revision: correction writer pass starting from required synchronized `main`
  commit `b7b7a157aa10e8f2dd0b9f15a06c46e7327b33c3`, tree
  `732a4d2241d267dc4c579f4622d3cd1991e98c84`, parent
  `2131c3395f042aef9ebb7df4456f9b9fd3230ba4`; the correction content tree is
  recorded post-commit by the containing commit. M02-W07 remains CLOSED and
  VERIFIED at its preserved evidence boundary.
- Environment: macOS 27.0 arm64; Node 24.18.0; pnpm 11.17.0; WXT 0.20.27;
  Playwright 1.62.0 with bundled Chromium; uv 0.11.32 with Python 3.12.13;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Exact starting boundary: `git fetch origin`, both required porcelain status
  forms, branch/HEAD/origin/tree/parent checks, and `git diff --check`
  confirmed a clean synchronized `main` at the required commit/tree/parent
  before any correction edit.
- Exact blocker reproduction: on unchanged production bytes, the new C1
  bundled-MV3 Chromium regression exited 1. For a semantic `main` containing
  an unrelated `Newsletter email` sibling and one `job-application` form, the
  expected descriptor labels were `["Applicant name"]`; the actual labels
  were `["Newsletter email", "Applicant name"]`.
- Root cause and correction: after finding exactly one qualifying native or
  `role=form` candidate, `detectApplicationRoot` replaced that form with its
  closest `main` / `role=main` ancestor. The correction returns the unique
  form itself. Literal precedence is now: one supported explicit application
  root; otherwise one supported form; otherwise one supported semantic main
  only when no form qualifies. Multiple qualifying candidates at a winning
  tier remain typed ambiguity.
- Permanent correction matrix: C1 and C2 retain only intended controls inside
  the unique form; C3 retains both the external application-level control and
  native-form control because the explicit root wins; C4 retains the no-form
  semantic-main fallback; C5 returns `AMBIGUOUS` with two candidates and zero
  descriptors; C6 keeps a unique `role=form` boundary narrow. The direct
  matrix command passed 6/6 in real bundled Chromium.
- Re-resolution retention: the complete scanner slice passed its legitimate
  same-field rerender, semantic-replacement no-match, and multiple-match
  ambiguity cases. A focused reload check additionally passed with the prior
  document's address returning typed `STALE_DOCUMENT`; that temporary check
  was removed after execution because it is not a permanent root-segmentation
  case. Final scanner/test SHA-256 values were restored afterward.
- Focused commands and observed results before documentation freeze:
  - `pnpm --dir apps/extension exec vitest run
    test/m02-w08/scanner-protocol.test.ts --no-file-parallelism --maxWorkers=1`
    -> exit 0, **16 passed**.
  - `pnpm exec playwright test e2e/extension/extension-scanner.spec.ts
    --reporter=line` -> exit 0, **14 passed**.
  - `pnpm exec playwright test e2e/extension --reporter=line` -> exit 0,
    **27 passed**, including every retained W07 extension regression.
  - `pnpm exec playwright test --list` -> exit 0, **86 tests in 24 files**;
    the five net-new browser cases are C1, C2, C3, C4, and C6, while the
    existing multi-form ambiguity regression became C5.
  - affected-file Prettier and ESLint checks plus `git diff --check` -> exit 0.
- One bounded read-only reviewer, with no subdelegation or tracked edit,
  inspected only unique-form/`role=form` boundaries, stronger explicit-root
  precedence, semantic-main fallback, multi-form ambiguity, and direct
  re-resolution impact. It returned **no blocker**.
- Exactly two mutation families were run and stopped at M2. Both final file
  SHA-256 values matched their pre-mutation values afterward:
  - M1 restored unique-form-to-main widening -> C1 and C2 both failed with
    the unrelated siblings entering the descriptor inventory (**2 failed**).
  - M2 made the nested form override its stronger explicit root -> C3 failed
    because the application-level external control disappeared (**1 failed**).
- Scope and governance: only `apps/extension/src/field-scanner.ts`,
  `e2e/extension/extension-scanner.spec.ts`, `docs/PROJECT_STATUS.md`, and
  `docs/TEST_EVIDENCE.md` changed. `isElementVisible` and all other
  scanner/protocol surfaces were not changed. Excluded private owner evidence
  was neither required nor accessed.
  M02-W08 remains IN_PROGRESS; M02-W09 remains NOT_STARTED; no package is
  READY; M02 remains IN_PROGRESS; all four gates remain NOT_EVALUATED; release
  remains NOT_READY. No W09/W10/W11 implementation or Gate A execution
  occurred.
- Frozen verification deferral: after final documentation bytes, the complete
  canonical sequence is run twice without intervening edits and reported in
  the writer handoff. No canonical, hosted, independent-verification, package
  verification, gate, acceptance, or release result is preclaimed here.

### M02-W08 — Semantic field scanner implementation writer evidence (2026-08-21)

- Revision: implementation writer pass starting from required synchronized
  `main` commit `2131c3395f042aef9ebb7df4456f9b9fd3230ba4`, tree
  `f31a17a7e593498e653e93f0fdb6500f537c0107`, parent
  `5d2cc2322e215b2de9e363da996cf625afdb7424`; the W08 content tree is
  recorded post-commit by the containing commit. M02-W07 remains CLOSED and
  VERIFIED at its preserved evidence boundary.
- Environment: macOS 27.0 arm64; Node 24.18.0; pnpm 11.17.0; WXT 0.20.27;
  Playwright 1.62.0 with bundled Chromium; uv 0.11.32 with Python 3.12.13;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Exact starting boundary: `git fetch origin`, both required porcelain status
  forms, branch/HEAD/origin/tree/parent checks, `git diff --check`, and the
  specification digest confirmed a clean synchronized `main` at the required
  commit/tree/parent before any edit.
- Lifecycle: M02-W08 moved READY -> IN_PROGRESS; M02-W09 remains NOT_STARTED;
  no package is READY; M02 remains IN_PROGRESS; every critical gate remains
  NOT_EVALUATED; release remains NOT_READY.
- Canonical identity and descriptor implementation:
  - Production code imports the generated M01 `FormFieldAddressV1` and
    `FormFieldDescriptorV1` types; no parallel field-contract type exists.
    SHA-256 fingerprints and opaque deterministic stable IDs bind session,
    frame, current document, route, application root, accessible name,
    attributes, section path, and option-set evidence. Every address has at
    least two authoritative semantic/structural signals. Resolution hints are
    typed non-authoritative evidence; raw selectors and DOM indexes are absent
    from the canonical wire shape and raw-selector-only input is rejected.
  - Descriptors retain bounded normalized untrusted label/description text,
    control kind, section/group context, option label/value-digest/disabled
    evidence, visibility, enabled, required, frame/document context, and a
    canonical observation timestamp. Unsafe page option strings remain only
    one-way digests and cannot become stable tokens. W09 sensitivity/ontology
    classification is not performed; the schema-required feasibility flag is
    false and no current field value is captured.
- Root and scan bounds: deterministic precedence is explicit application
  region, unique form ownership, then unique semantic main. Missing or
  multiple candidates return typed unresolved/ambiguous results. Root scans
  and token-addressed subtree scans are distinct; a subtree request cannot
  escape its selected element. Each frame report is capped at 512 descriptors,
  each field at 256 options, and each tab at 64 registered frame agents.
- Frame architecture: the same all-frame content entrypoint runs only on the
  two permitted loopback fixture origins. Every agent scans its own `document`
  only, registers typed session/frame/document identity, and reports through
  the actual MV3 service worker. The worker targets registered Chrome frame
  IDs, validates descriptor-to-frame coherence, preserves frame identity in
  aggregation, and returns unavailable rather than traversing or flattening a
  disappeared frame. Bundled-Chromium same-origin and cross-origin fixtures
  prove isolated reports; the parent cannot read the cross-origin child DOM.
- Re-resolution: the current registered frame/document is scanned again and
  all populated authoritative address signals must match. Exactly one match
  returns the current canonical descriptor; zero returns typed stale/no-match;
  multiple return typed ambiguous. Hints, selectors, DOM order, and the first
  candidate never override these outcomes. No fill is implemented.
- Protocol authority: W07's synchronous probe/ACK and silent rejection
  behavior are preserved. W08 adds only closed frame registration, root/subtree
  descriptor scan, typed per-frame aggregation, and re-resolution/status
  messages. There is no fill, click, upload, navigation, submission, arbitrary
  command bus, database, native host, local model, or product UI authority.
- One bounded writer reviewer: one read-only reviewer, with no subdelegation,
  inspected only canonical contracts, frame isolation, scan bounds,
  re-resolution, and protocol authority. The reviewer found and the lead
  reproduced one blocker: `javascript:evil` could previously satisfy the
  structural bounded-token grammar while failing canonical inert-text
  semantics. Emission and wire validation were corrected and permanent unit
  plus real-browser hostile-option tests added. The reviewer returned no
  remaining blocker. Its non-blocking impossible-timestamp parity observation
  was also reproduced and hardened with calendar-valid UTC/leap-second tests.
- Exactly four mutation families were run against the final focused code and
  stopped at M4. Every touched-file SHA-256 matched its pre-mutation value
  afterward:
  - M1 made a raw selector authoritative -> the direct W08 unit suite failed
    the selector-only assertion (**1 failed, 15 controls passed**).
  - M2 erased per-frame identity -> the same-origin built-extension isolation
    test rejected the duplicate-frame aggregate (**1 failed**).
  - M3 replaced the requested subtree with the application root -> the direct
    boundary test observed the outside field and failed (**1 failed**).
  - M4 resolved the first of multiple semantic matches -> the ambiguous
    re-resolution test failed while the stale replacement control passed
    (**1 failed, 1 control passed**).
- Focused commands and observed results before documentation freeze:
  - `pnpm --dir apps/extension exec vitest run
    test/m02-w08/scanner-protocol.test.ts --no-file-parallelism --maxWorkers=1`
    -> exit 0, **16 passed**.
  - `pnpm exec playwright test e2e/extension --reporter=line` -> exit 0,
    **22 passed** against freshly built canonical and invalid-ACK WXT variants,
    including every retained W07 browser regression and all W08 real-browser
    cases.
  - extension typecheck and affected-file ESLint -> exit 0; `git diff --check`
    -> exit 0.
- Frozen verification deferral: after final documentation/traceability bytes,
  the complete canonical sequence (`python3 scripts/check_portability.py`,
  `python3 scripts/validate_status.py`, `pnpm traceability:check`,
  `pnpm generate:contracts --check`, `pnpm run doctor`, `pnpm verify`, and
  `git diff --check`) is run twice against identical tracked bytes and reported
  in the writer handoff. No canonical or hosted result is preclaimed here.
- Artifacts: no UI snapshot is applicable; the visual suite remains
  NOT_YET_APPLICABLE. Browser failure screenshots/traces existed only for the
  intentionally killed mutants under ignored Playwright output.
- Notes: REQ-FORM-013, REQ-FORM-014, and REQ-FORM-019 truthfully move only to
  SCAFFOLD_ONLY / NOT_YET_APPLICABLE because later M17/M18 owners and fresh
  independent W08 verification remain required. M02-W08 stays IN_PROGRESS;
  M02-W09 stays NOT_STARTED; no W09 ontology/resolver, W10 fill/driver, W11
  persistent mutation/reconciliation/performance engine, Gate A execution,
  package verification, compatibility claim, gate decision, acceptance, or
  release claim occurred.

### M02-W07 — Governance closeout after final independent Sol verification (2026-08-21)

- Verified content boundary: exact commit
  `ce74ef49e142bb7c2cab608cd0c800d312bd2217`, tree
  `9412c5b71437ee562534a1fb92e80ab50ffc333d`, verdict
  `SOL_CLEAR_FINAL_M02_W07_NINTH_CORRECTION_CONTENT`, and successful content
  push run `32522233170`. This independently cleared content remains the W07
  verification anchor. The later governance-fixture correction does not alter
  product, analyzer, validator, extension, E2E, inventory, or W07 test
  semantics, so PORT-SRC-008 content analysis was not reopened.
- Preserved governance block: after content clear, the first exact lifecycle
  simulation stopped with `SOL_BLOCKED_FINAL_M02_W07_GOVERNANCE`. Historical
  M02-W06 lifecycle fixture helpers copied the newly advanced live status and
  inherited M02-W08 READY while constructing their own pre-/future-governance
  states. The future fixture therefore contained two READY packages. No
  malformed fixture was accepted and no production validator rule was
  weakened.
- Governance-fixture correction: exact commit
  `5d2cc2322e215b2de9e363da996cf625afdb7424`, tree
  `77c1bec24ce694b879ec5f580146f7a1ad40f9b4`, parent
  `ce74ef49e142bb7c2cab608cd0c800d312bd2217`, title
  `M02-W07: isolate W06 lifecycle fixture from downstream state`. Its sole
  changed file is `scripts/tests/test_validate_status.py`; the
  `prepare_m02_w06_pre_governance` and
  `prepare_m02_w06_future_governance` helpers each call the existing
  `reset_downstream` helper after M02-W07/M02. The correction makes each
  historical fixture establish its complete downstream premise rather than
  inheriting later live advancement. Production code, the portability
  analyzer, validator implementation, W07 tests, Python inventory,
  extension/E2E bytes, and project memory are unchanged by that commit.
- Fixture-correction hosted proof: push run `32534586594` at exact correction
  SHA succeeded on macOS 15 job `96932982689`, Ubuntu 24.04 job
  `96932982826`, and Windows 2025 job `96932982836`. The complete Windows log
  reproduced the unchanged substantive totals: 1,387 common/Windows and 1,389
  POSIX Python tests, 493 portability tests, 3,376 TypeScript tests, 63
  extension tests, Playwright 72 / 23 files, W06 207, contracts 2,440 / 662,
  generated 183 byte-identical, Rust 1 + 10, build 2, status 45,
  traceability 193 / 300, every ACTIVE suite PASS, visual
  NOT_YET_APPLICABLE, verification exit 0, and tracked-clean PASS.
- Final lifecycle simulation: a disposable `git clone --no-local
  --no-hardlinks` was checked out detached at exact correction commit
  `5d2cc2322e215b2de9e363da996cf625afdb7424`. Project-memory-only edits moved
  M02-W07 IN_PROGRESS -> VERIFIED at preserved content tree
  `9412c5b71437ee562534a1fb92e80ab50ffc333d`, moved M02-W08 NOT_STARTED ->
  READY, and moved KI-0058 through KI-0062 IN_PROGRESS -> FIXED. Canonical
  current-work/next-ready representation is `NONE` / `M02-W08`; M02-W08 is
  the sole READY package and no package is IN_PROGRESS.
- Commands and observed results in the completed disposable governance state
  on macOS arm64 with pinned Node 24.18.0, pnpm 11.17.0, Python 3.12.13, and
  Rust 1.97.1:
  - `python3 scripts/validate_status.py` -> exit 0, PASS, 45 check groups;
  - `pnpm traceability:check` -> exit 0, PASS, 193 requirements / 300 work
    packages;
  - `pnpm verify` -> exit 0; all ACTIVE suites PASS, including 1,389 Python,
    493 portability, 3,376 TypeScript, 63 extension, Playwright 72 / 23,
    W06 207, contracts 2,440 / 662, generated 183 byte-identical, Rust 1 + 10,
    build 2, status 45, and traceability 193 / 300. Visual remains truthfully
    NOT_YET_APPLICABLE. No flaky behavior was observed.
- Preserved governance: M00 and M01 remain ACCEPTED; M02 and only M02 remain
  IN_PROGRESS; M02-W01 through M02-W06 remain VERIFIED at their recorded
  trees. KI-0006 remains LOW / DEFERRED. REQ-FORM-020 remains SCAFFOLD_ONLY /
  NOT_YET_APPLICABLE. AUTOFILL_FEASIBILITY, RESUME_PAGEFIT_FEASIBILITY,
  WORKDAY_GUIDED_PRE_SUBMIT, and CROSS_PLATFORM_CORE remain NOT_EVALUATED;
  release remains NOT_READY. No M02 acceptance, Gate A execution, W08
  implementation, or product/test/validator change occurred during governance.
- Artifacts: canonical project memory only. The lifecycle simulation did not
  access, enumerate, inspect, hash, search, or test any excluded private
  owner-evidence, historical W06 private-evidence, or Trash-evidence path.

### M02-W07 — KI-0058 immediate callable ninth correction writer evidence (2026-08-21)

- Revision: ninth narrow correction writer pass starting from independently
  blocked eighth-correction commit
  `1a63145846e44f60903e48402c0c812d02581dd5` / tree
  `ce945ff89af363e8da2bd28ba60113b5e6d2a75d` / parent
  `3133a9348193a03759140dc2a32c35223be9717d` after verdict
  `SOL_BLOCKED_FINAL_M02_W07_EIGHTH_CORRECTION_VERIFICATION`; the ninth
  correction content tree is recorded post-commit by the containing commit.
- Environment: macOS arm64; Node 24.18.0; pnpm 11.17.0; uv-managed Python
  3.12.13 / pytest 9.1.1; TypeScript 6.0.3; @types/node 24.13.3;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Exact-boundary verification before any edit: `git fetch origin`, both
  porcelain status forms, branch/upstream, HEAD/origin/tree/parent,
  `git diff --check`, and specification digest → clean synchronized `main`;
  HEAD == origin/main == `1a63145846e44f60903e48402c0c812d02581dd5`;
  tree `ce945ff89af363e8da2bd28ba60113b5e6d2a75d`; parent
  `3133a9348193a03759140dc2a32c35223be9717d`; required spec digest.
- Fresh pre-fix reproduction on those exact analyzer bytes: the verifier's
  conditional IIFE began with `{ shell: true }`, both possible arrow bodies
  assigned `options.shell = false`, and the later `spawnSync` sink emitted
  `[{"path":".codex-n9-reproducer.ts","line":4,"kind":"shell-true",`
  `"detail":"shell=true"}]`. The temporary reproducer was deleted after the
  result was inspected.
- Confirmed root cause: `processTrackedExpression` first evaluated the
  conditional callee and correctly treated each closure value as inert; the
  later call helper supported direct arrows/functions and direct identifier
  targets only, so the conditional expression resolved to no target and
  returned the incoming state. `referencesTrackedSymbol` made the same direct
  target query, then recursively pruned each deferred body, so the entire
  reached IIFE statement could be misclassified as unrelated and skipped.
- Ninth-correction architecture (`scripts/check_typescript_portability.mjs`):
  - One `immediateCalleeResultReferencesTrackedState` helper is entered only
    for a `CallExpression` without an exact supported direct-local target. It
    is bounded by `MAX_STRUCTURAL_DEPTH` and reuses the existing bounded local
    callable/capture discovery at function-like or local identifier leaves.
  - Parentheses, `as`, `satisfies`, type assertions, and non-null wrappers are
    transparent. Known conditional truth selects only the reachable result;
    unknown truth checks either result. Binary/CommaList comma forms inspect
    only the final callable result. `&&`, `||`, and `??` use known primitive
    reachability when available and otherwise conservatively inspect either
    possible result without exact logical-call interpretation.
  - Callee and argument evaluation remains ordered by the existing expression
    walker. If a possible immediately executed result may capture tracked
    state, the reached call returns UNKNOWN; no branch body is interpreted as
    an exact conditional-IIFE summary. The same predicate feeds statement
    relevance, closing both halves of the stale-state hole.
  - Exact direct identifier calls bypass the new fallback and retain the
    eighth correction's exact summaries. Direct arrow/function IIFEs retain
    their existing conservative path. Function-like values that are merely
    created, including conditional values assigned to a variable, remain
    inert until called. Unrelated immediate callables do not invalidate.
- Permanent behavioral proof: the 16-node ninth slice covers H1–H14 plus one
  bounded logical-result fixture and pinned TypeScript compilation. It locks
  the exact reproducer; an UNKNOWN-vs-stale-false inverse guard; absent/default
  shell; one-sided capture; known true/false selection; unrelated branches;
  uncalled and post-sink timing; direct arrow/function IIFEs; comma-prefix
  ordering; every ordinary wrapper kind in one nested fixture; logical result
  forms; and an unrelated non-direct call. The pre-existing 46-node eighth
  slice separately retains declaration parity, exact direct identifiers,
  concise/function-expression/computed/delete/ordered effects, timing, symbol
  identity, shadowing, and conservative unsupported fallbacks.
- Bounded writer review: the one permitted read-only reviewer used no
  subdelegation, independently confirmed the exact starting root cause, and
  returned CLEAR on both the initial and compacted final helper. Its focused
  eighth+ninth run passed 62/62, and it confirmed the direct-identifier path,
  executed-vs-uncalled boundary, result-only comma behavior, wrapper/logical
  coverage, and shared statement/call relevance wiring.
- Targeted mutation campaign: exactly five families, each in a disposable
  `git clone --no-local --no-hardlinks` candidate against the final analyzer
  and test bytes, stopped at M5 and removed after inspection:
  - M1 restored conditional-IIFE call blindness → 7 intended failures / 9
    controls passed.
  - M2 treated uncalled conditional closure creation as execution → H8 failed /
    15 controls passed.
  - M3 dropped direct arrow/function-expression IIFE relevance → H10/H11
    failed / 14 controls passed.
  - M4 dropped typed-wrapper and comma-result relevance → H12/H13 failed / 14
    controls passed.
  - M5 returned incoming stale state instead of UNKNOWN for unsupported
    immediate callees → 9 intended failures / 7 controls passed.
- Commands and observed results before documentation freeze:
  - `uv run --frozen pytest scripts/tests/test_portability.py -q -k
    ninth_correction` → exit 0, **16 passed**, 477 deselected.
  - `uv run --frozen pytest scripts/tests/test_portability.py -q -k
    eighth_correction` → exit 0, **46 passed**, 447 deselected.
  - `uv run --frozen pytest scripts/tests/test_portability.py -q -k
    'fifth_correction or sixth_correction or seventh_correction or
    eighth_correction or ninth_correction'` → exit 0, **146 passed**, 347
    deselected.
  - `uv run --frozen pytest scripts/tests/test_portability.py -q` → exit 0,
    **493 passed**.
  - Canonical exact collection added exactly 16 ninth-correction node IDs and
    removed none: **1,387 common/Windows** nodes at SHA-256
    `72f8d4f65f625e569d7959c026c2280ea2ee275ed5e873304f9d8e6591d4cc8c`
    and **1,389 POSIX** nodes at SHA-256
    `1b3cfe8786cc8f5dc3e255d2ac7999ea1fac9fea5a819281dc2f6d7e66552908`.
  - `node --check`, Ruff check/format, Prettier formatting, combined
    eighth+ninth 62-node lock, and `git diff --check` → exit 0.
- Frozen verification deferral: after these final documentation bytes, the
  complete substantive sequence (`python3 scripts/check_portability.py`,
  `python3 scripts/validate_status.py`, `pnpm traceability:check`,
  `pnpm generate:contracts --check`, `pnpm run doctor`, `pnpm verify`, and
  `git diff --check`) is run twice with an identical tracked fingerprint and
  reported in the final writer handoff; no result is preclaimed here. Hosted
  exact-SHA ubuntu-24.04, macos-15, and windows-2025 evidence is likewise
  pending the single forward commit and push.
- Artifacts: n/a. The authoritative checkout and reviewer never accessed,
  enumerated, tested, or inspected the excluded private owner-evidence path or
  historical W06/Trash evidence. No W08 implementation, gate report, or Gate A
  execution occurred.
- Notes: KI-0058 remains HIGH / IN_PROGRESS pending a completely fresh
  verifier on the exact ninth-correction content and W07 governance.
  KI-0059..KI-0062 remain HIGH / IN_PROGRESS with their cleared surfaces
  untouched; KI-0006 remains LOW / DEFERRED for the M17 Rust/native surface;
  REQ-FORM-020 remains SCAFFOLD_ONLY / NOT_YET_APPLICABLE; M02-W07 remains
  IN_PROGRESS, M02-W08 remains NOT_STARTED, no package is READY, all critical
  gates remain NOT_EVALUATED, and release remains NOT_READY.

### M02-W07 — KI-0058 direct local closure eighth correction writer evidence (2026-08-21)

- Revision: eighth narrow correction writer pass starting from independently
  blocked seventh-correction commit
  `3133a9348193a03759140dc2a32c35223be9717d` / tree
  `f4da4024b5b30c89bf06d1df66499f4d3082a660` / parent
  `05bbcb340bd98e856367b5349d51be028669d3f7` after verdict
  `SOL_BLOCKED_FINAL_M02_W07_SEVENTH_CORRECTION_VERIFICATION`; the eighth
  correction content tree is recorded post-commit by the containing commit.
- Environment: macOS arm64; Node 24.18.0; pnpm 11.17.0; uv-managed Python
  3.12.13 / pytest 9.1.1; TypeScript 6.0.3; @types/node 24.13.3;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Exact-boundary verification before any edit: `git fetch origin`, both
  porcelain status forms, branch/upstream, HEAD/origin/tree/parent,
  `git diff --check`, and specification digest → clean `main`; HEAD ==
  origin/main == `3133a9348193a03759140dc2a32c35223be9717d`;
  tree `f4da4024b5b30c89bf06d1df66499f4d3082a660`; parent
  `05bbcb340bd98e856367b5349d51be028669d3f7`; required spec digest.
- Fresh pre-fix reproductions on those exact analyzer bytes:
  - H1, a stable arrow declared before the tracked object writes
    `options["shell"] = true`, is called before a spawn sink, and returned
    `[]` although runtime state is `shell === true`.
  - H2, a stable arrow/function-expression equivalent declared before an
    absent-shell tracked object writes `""`, is called before an exec sink,
    and retained the stale default-shell violation although runtime state is
    `shell === ""`.
  - Both were pinned as failing tests before the analyzer changed: H1 actual
    rules `set()` versus expected `PORT-SRC-008`; H2 actual
    `PORT-SRC-008` versus expected clean.
- Confirmed root cause: the seventh correction had an exact direct-call path
  only for `FunctionDeclaration`. Direct arrows/function expressions lived
  behind deferred-function capture discovery, while ordinary statement
  relevance did not inspect that path. A call identifier declared before the
  tracked object was therefore skipped; its mutation was neither summarized
  nor conservatively invalidated. Conversely, a closure declaration after the
  object exposed its body as an unsupported declaration-time reference,
  creating the observed source-order artifact.
- Eighth-correction architecture (`scripts/check_typescript_portability.mjs`):
  - `directLocalCallableTarget` resolves direct identifier calls only through
    TypeScript symbol identity and classifies function declarations, direct
    closure bindings, indirect/local conservative values, named expression
    recursion, and conservative IIFEs. Text names never select a binding.
  - A unique local `const` initialized directly (through supported unwraps)
    to an arrow or function expression and initialized before the call shares
    the seventh correction's exact call-time summary when it has zero
    parameters, no async/generator marker, and a supported body. Anonymous and
    named function expressions both qualify through the external variable
    symbol; the internal expression name remains separately scoped.
  - Block bodies reuse `processTrackedFlow`; concise assignment/delete bodies
    reuse `processTrackedExpression`. Thus known direct/computed writes of
    `true`, `false`, and `""`, known-key delete, and multiple straight-line
    writes use the existing tracked-property semantics rather than a second
    shell evaluator.
  - `referencesTrackedSymbol` prunes unexecuted function-like declarations,
    while call-target relevance enters runtime parameter/default/body nodes.
    Closure declarations are no-ops; effects occur only when the call is
    reached. Immediately invoked nested closures are executed call targets,
    not inert declarations, and conservatively invalidate if captured state
    is involved.
  - Parameters/defaults, async/generator forms, mutable/reassigned or late
    bindings, alias/conditional callable values, unsupported control flow or
    nested calls, unsupported captures, recursion/cycles, and over-depth or
    mixed chains become UNKNOWN at the call site when they may touch tracked
    state. Unrelated stable closures do not invalidate. The active-symbol set
    and `MAX_LOCAL_FUNCTION_SUMMARY_DEPTH = 16` are preserved.
- Behavioral proofs in the permanent 46-node eighth slice:
  - Declaration parity: before/after-object arrows and function expressions
    produce identical H1/H2 enable/disable outcomes.
  - Call timing: never-called bodies and post-sink calls are inert; enable then
    disable is clean, disable then enable is a finding, and the two-sink test
    sees only prior calls.
  - Symbol identity: nested same-name bindings, distinct blocks, a named
    expression whose internal name matches an outer binding, a same textual
    name in another function, and a shadowing parameter remain isolated.
  - Exact forms: block/concise arrows, anonymous/named function expressions,
    direct/computed writes, delete, and ordered multiple writes pass.
  - Conservative forms: parameters/defaults, async/generator, mutable and
    late-assigned bindings, direct/conditional aliases, control flow, unknown
    nested calls, captured arrows inside declarations, direct/named recursion,
    short/near/over-depth and mixed chains, and reviewer IIFEs are finite and
    do not preserve stale certainty. Pinned TypeScript compilation passes.
- Bounded writer review (two reviewers, separate disposable
  `git clone --no-local --no-hardlinks` clones, no subdelegation):
  - Reviewer A, limited to direct target resolution, declaration parity,
    timing, symbol identity, concise bodies, and function-expression forms,
    returned CLEAR after 46/46 permanent nodes and an independent 11-case
    semantic matrix plus pinned compilation.
  - Reviewer B, limited to conservative fallback/defaults/nesting/depth and
    fifth-through-seventh regressions, found one candidate: an unconditional
    deferred-function prune also hid executed nested IIFEs in defaults/bodies.
    The lead personally reran the reviewer's exact five-case file under Node
    24: named-helper control 1 passed and four IIFE forms failed. IIFEs now
    enter conservative call-target relevance; the unchanged reviewer file
    then passed 5/5. Four permanent regressions cover direct-arrow and
    function-declaration default/body IIFEs.
- Targeted mutation campaign: exactly six families, each in its own
  `git clone --no-local --no-hardlinks` candidate with exact formatted
  analyzer/test bytes and a frozen offline install; stopped at M6.
  - M1 rejected closure declarations before the tracked object → H1/H2 killed
    (2 failed, 2 after-object controls passed).
  - M2 treated direct closures as no-op calls → H1/H2 and function-expression
    enable/disable killed (4 failed, unrelated closure control passed).
  - M3 marked deferred declarations relevant and executed bodies at
    declaration time → never-called/post-sink timing killed (2 failed, H1
    call-time control passed).
  - M4 merged same textual callable names across symbols → two shadowing/
    cross-function identity rows killed (2 failed, unrelated control passed).
  - M5 returned stale state for parameterized/default closures → both fallback
    rows killed (2 failed, exact zero-parameter H2 control passed).
  - M6 dropped function-expression binding targets → dedicated enable/disable
    rows killed (2 failed, both arrow controls passed). No M7 existed.
- Commands and observed results before documentation freeze:
  - `uv run --frozen pytest scripts/tests/test_portability.py -q -k
    eighth_correction` → exit 0, **46 passed**, 431 deselected.
  - `uv run --frozen pytest scripts/tests/test_portability.py -q -k
    'fifth_correction or sixth_correction or seventh_correction or
    eighth_correction'` → exit 0, **130 passed**, 347 deselected; the preserved
    fifth-through-seventh subset is 84 nodes.
  - `uv run --frozen pytest scripts/tests/test_portability.py -q` → exit 0,
    **477 passed**.
  - Canonical exact collection → **1,371 common/Windows** nodes at SHA-256
    `54c2af8705db487eb4d77622e4ae30e632aac9074233d58f9bb032240648e875`
    and **1,373 POSIX** nodes at SHA-256
    `e87520b6f1fa8ce777a09999fa326ba41c5690d5258fd40a5dff6e31e894e099`.
  - `node --check`, Ruff check/format, Prettier check, and
    `git diff --check` → exit 0.
- Frozen verification deferral: the complete substantive sequence
  (`python3 scripts/check_portability.py` under the project venv,
  `python3 scripts/validate_status.py`, `pnpm traceability:check`,
  `pnpm generate:contracts --check`, `pnpm run doctor`, `pnpm verify`, and
  `git diff --check`) is run twice on identical tracked bytes after this
  documentation freeze and reported in the final writer handoff; no result is
  preclaimed here. Hosted exact-SHA three-OS evidence is also pending.
- Artifacts: n/a. The authoritative checkout never accessed owner-held or
  historical private evidence. Reviewer and mutation clones were disposable;
  no W08 implementation, gate report, or Gate A execution occurred.
- Notes: KI-0058 remains HIGH / IN_PROGRESS pending a completely fresh
  verifier on the exact eighth-correction content and W07 governance.
  KI-0059..KI-0062 remain HIGH / IN_PROGRESS with their cleared surfaces
  untouched; KI-0006 remains LOW / DEFERRED for the M17 Rust/native surface;
  REQ-FORM-020 remains SCAFFOLD_ONLY / NOT_YET_APPLICABLE; M02-W07 remains
  IN_PROGRESS, M02-W08 remains NOT_STARTED, no package is READY, all critical
  gates remain NOT_EVALUATED, and release remains NOT_READY.

### M02-W07 — KI-0058 hoisted tracked-state function seventh correction writer evidence (2026-08-21)

- Revision: seventh narrow correction writer pass starting from independently
  blocked sixth-correction commit
  `05bbcb340bd98e856367b5349d51be028669d3f7` / tree
  `156417979f7e103ad7a7b5050dc7cd4eacd596d5` / parent
  `142f6fb5c759464dc8116d0b41a2ed13304543e2` after verdict
  `SOL_BLOCKED_FINAL_M02_W07_SIXTH_CORRECTION_VERIFICATION`; the seventh
  correction content tree is recorded post-commit by the containing commit.
- Environment: macOS arm64; Node 24.18.0 (keg-only pinned); pnpm 11.17.0;
  uv-managed project venv; TypeScript 6.0.3; @types/node 24.13.3;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`
  verified by direct recomputation.
- Exact-boundary verification before any edit: fetch plus porcelain-v1/v2
  status, branch, HEAD/tree/parent/upstream, and `git diff --check` → branch
  `main`; clean tree; HEAD == origin/main ==
  `05bbcb340bd98e856367b5349d51be028669d3f7`; tree
  `156417979f7e103ad7a7b5050dc7cd4eacd596d5`; parent
  `142f6fb5c759464dc8116d0b41a2ed13304543e2`.
- Fresh-verifier boundary: the sixth correction's alias/shorthand families
  and the fifth correction's budget/constructor locks were cleared. The sole
  remaining blocker was the pre-existing direct hoisted-function state
  defect; no alias, shorthand, catalog, wrapper, extension, browser, W06,
  contract, generated, gate, model, prompt, dependency, lockfile, CI, or
  owner-evidence surface was reopened.
- Independent pre-edit reproduction on the exact base (temporary untracked
  TypeScript fixtures, deleted immediately after inspection; direct helper
  JSON protocol):
  - H1, declaration text after the sink → `[]` (false clean); runtime state at
    the sink is `shell === true`.
  - H2, declaration text after the sink → `execSync default shell` (false
    violation); runtime state at the sink is `shell === ""`.
  - The direct-write H1 equivalent emitted `shell=true`; the direct-write H2
    equivalent was clean.
  - On the exact base, moving H2's declaration before its call made it clean
    because declaration processing invalidated certainty; moving H1's
    declaration before its call remained false-clean. Thus the verifier's
    general source-order diagnosis was confirmed, while its statement that
    the checker result changes was literally observable only for H2 at this
    exact SHA.
- Confirmed root cause: `trackedIdentifierStatesAtSink` locates the object and
  sink, then filters only statements between them through
  `referencesTrackedSymbol`; a call identifier has no syntactic tracked-object
  reference, so the call is skipped, while declaration text after the sink is
  outside the scan. A declaration before the sink was not a call effect: it
  entered unsupported/deferred invalidation. Runtime hoisting and call-time
  closure effects were therefore modeled as source-order declaration effects.
- Seventh-correction implementation
  (`scripts/check_typescript_portability.mjs` only):
  - Direct identifier calls resolve local `FunctionDeclaration` targets by
    TypeScript symbol identity inside the tracked statement container;
    declaration position is irrelevant, and declaration statements are
    explicit no-ops in tracked flow.
  - Capture relevance includes runtime parameter binding/default initializer
    nodes and bounded transitive direct declarations; separately declared
    local arrow/function expressions are inspected only to discover a
    captured-object unsupported call, never to grant them exact summary
    semantics.
  - The exact summary subset is intentionally straight-line and
    zero-parameter: constant-value assignment to a known property or known-key
    delete on the tracked object/definite alias. Existing tracked events apply
    `true`, `false`, `""`, delete-to-absent, and computed `"shell"` writes at
    the call site in evaluation order.
  - Parameters/defaults, reassignment, generator/async declarations,
    recursion, unsupported calls/control flow, and other unsupported captured
    bodies invalidate to UNKNOWN at the call site. An active-symbol recursion
    set and depth-16 capture/summary guard make cycles and deep acyclic chains
    finite and deterministic.
- Post-fix H1/H2 behavior: H1 emits `shell=true` and H2 is clean with the
  declaration both before and after the call; declarations never called or
  called only after the sink have no effect; opposite declaration ordering
  does not alter call-order results.
- Permanent tests added (22 focused nodes; suite 409 → 431): eight violation
  rows and eleven control rows cover H1–H17 plus default-parameter and
  captured-arrow reviewer regressions; H18 repeats the analysis four times;
  a 1,024-function chain pins bounded discovery; and one pinned-tsc batch
  compiles all table fixtures. The H1–H18 matrix covers declaration parity,
  never-called/post-sink timing, enable/disable ordering with declaration
  order intentionally reversed, delete and computed writes, local-variable
  and same-name lexical shadowing, known-false/true/unknown branches,
  recursion, unsupported fallback, and determinism.
- Writer-side bounded review: exactly one read-only reviewer, limited to the
  local-function scope and prohibited from subdelegation, ran the 22-test
  predecessor slice (19/19 at review time) and reported three substantive
  cases. The lead personally reproduced each before changing code: a runtime
  default-parameter capture retained stale absent-shell state; an otherwise
  supported body followed by a captured arrow call retained stale
  `shell=true`; and a valid 1,024-function acyclic chain crashed capture
  discovery with `RangeError: Maximum call stack size exceeded`. The runtime
  parameter scan, narrow exact-expression gate, deferred-function capture
  probe, and pre-recursion depth bound corrected them; all three permanent
  regressions pass.
- Targeted mutation campaign: exactly six families, one per disposable
  `git clone --no-local --no-hardlinks` candidate (Node 24 selected explicitly;
  `pnpm install --frozen-lockfile --offline --ignore-scripts`), stopped at M6.
  M1 excluded later declarations (H1/H2, 2 failures); M2 made captured calls
  no-ops (H1/H2, 2); M3 executed declaration bodies (H5/H6, 2); M4 replayed
  effects in declaration order (H7/H8, 2); M5 contaminated symbol identity
  with same-name matching (H12, 1); M6 preserved stale state on recursive/
  unsupported fallback (H16/H17/default-parameter, 3). All six clones were
  moved to recoverable Trash; no M7+ existed.
- Commands and observed results before documentation freeze:
  - `uv run pytest scripts/tests/test_portability.py -k
    seventh_correction -q` → exit 0, **22 passed**, 409 deselected.
  - `uv run pytest scripts/tests/test_portability.py -k
    'fifth_correction or sixth_correction or seventh_correction' -q` → exit
    0, **84 passed**, 347 deselected.
  - `uv run pytest scripts/tests/test_portability.py -q` → exit 0,
    **431 passed**.
  - Canonical inventory validators → exit 0; inventory now holds **1,325
    common/Windows nodes** at SHA-256
    `286a079115b8330e153d297e0afc295c80029f0d8b1f8d86d560235f9b4fc7d6`
    and **1,327 POSIX nodes** at SHA-256
    `6d155b719af06d642549622489d5ac34f3893a2a9eb37c6d1818f6d61909c8c1`.
  - `node --check`, focused Ruff check/format, analyzer Prettier check, and
    `git diff --check` → exit 0.
  - `PATH=.venv/bin:$PATH python3 scripts/check_portability.py` → exit 0,
    PASS on the real repository under the seventh-correction analysis.
- Frozen verification deferral: the complete substantive sequence
  (`python3 scripts/check_portability.py` in the project venv,
  `python3 scripts/validate_status.py`, `pnpm traceability:check`,
  `pnpm generate:contracts --check`, `pnpm run doctor`, `pnpm verify`, and
  `git diff --check`) is run twice on identical tracked bytes only after this
  documentation freeze and reported in the final writer handoff; it is not
  preclaimed here. Exact-SHA three-OS hosted evidence is likewise pending.
- Artifacts: n/a. Temporary reproducers were untracked and deleted; mutation
  clones were trashed; the authoritative checkout never accessed owner-held
  or historical private evaluation roots.
- Notes: KI-0058 remains HIGH / IN_PROGRESS pending a completely fresh
  verifier on the exact seventh-correction content and W07 governance.
  KI-0059..KI-0062 remain HIGH / IN_PROGRESS with their cleared surfaces
  untouched; KI-0006 remains LOW / DEFERRED for the M17 Rust/native surface;
  REQ-FORM-020 remains SCAFFOLD_ONLY / NOT_YET_APPLICABLE; M02-W07 remains
  IN_PROGRESS, M02-W08 remains NOT_STARTED, no package is READY, all critical
  gates remain NOT_EVALUATED, and release remains NOT_READY.

### M02-W07 — KI-0058 tracked option alias/shorthand-escape sixth correction writer evidence (2026-08-18)

- Revision: sixth narrow correction writer pass starting from hosted-green
  fifth-correction commit `142f6fb5c759464dc8116d0b41a2ed13304543e2` / tree
  `75449acb80cc50ec5a4829660a182935f4903807` / parent
  `094d4ea5ff6adbfc829898e899e36d0a93401d5b` after writer terminal
  `FABLE_M02_W07_KI0058_FIFTH_CORRECTION_READY_FOR_INDEPENDENT_VERIFICATION`
  (hosted content run 32154509246 SUCCESS on ubuntu-24.04, macos-15,
  windows-2025); the sixth-correction content tree is recorded post-commit
  by the containing commit.
- Environment: macOS 27.0 arm64; Node 24.18.0 (keg-only pinned); pnpm
  11.17.0; uv-managed project venv; TypeScript 6.0.3; @types/node 24.13.3;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`
  verified by direct recomputation.
- Exact-boundary verification before any edit: `git status --porcelain`,
  `git branch --show-current`, `git rev-parse HEAD` / `'HEAD^{tree}'` /
  `HEAD^` / `origin/main` (after fetch) → branch `main`; clean tree;
  HEAD == origin/main == `142f6fb5c759464dc8116d0b41a2ed13304543e2`; tree
  `75449acb80cc50ec5a4829660a182935f4903807`; parent
  `094d4ea5ff6adbfc829898e899e36d0a93401d5b` — the exact required start.
- Authorized scope: exactly the two pre-existing fail-open tracked-object
  defect families recorded by the fifth pass's Reviewer A in
  docs/KNOWN_ISSUES.md § KI-0058 — (a) supported same-object alias reads
  without alias registration and (b) shorthand-property escape invisible to
  the tracked event/state analysis. No other analyzer surface was reopened.
- Defect reproduction on the exact base (scratchpad fixtures outside the
  repository, direct `node scripts/check_typescript_portability.mjs`
  invocations with JSON path arrays on stdin):
  - `const alias = options as {…}` / `(options satisfies {…})` /
    `options || fallback` / `condition ? options : options` /
    `options ?? fallback` each followed by `alias.shell = true` before
    `spawnSync("node", …, options)` → `[]` (five silent false negatives).
  - `const box = { options }; box.options.shell = true;` before spawnSync →
    `[]` (false negative), while the longhand `{ opts: options }` escape
    behaved conservatively.
  - `const box = { options }; box.options.shell = "";` before
    `execSync(…, options)` → `execSync default shell` finding (false
    positive from the stale proved-absent state).
  - `const maybe = condition ? options : other; maybe.shell = "/bin/sh";`
    before execSync → stale `execSync default shell` finding retained.
  - `const alias = options as {…}; alias.shell = false;` with initial
    `shell: true` → `shell=true` finding (stale-proof false positive), and
    the no-mutation shorthand store with `shell: true` → `shell=true`
    finding while the longhand equivalent was already conservative.
- Sixth-correction surface (scripts/check_typescript_portability.mjs only;
  no catalog, wrapper, dependency, CI, extension, or gate change):
  - `provedSameTrackedObject`: strict same-object proof through
    `unwrapExpression` wrappers, known-truth and both-branch conditionals,
    comma forms, and `||`/`&&`/`??` operands where the taken side is proved;
    an unresolvable branch fails the proof instead of being dropped (the
    may-semantics of `resolveOptionTargets` are never used as identity
    proof).
  - `referencesTrackedTarget` + `collectTrackedAliasSets`: fixed-point
    registration of definite aliases (proof succeeds; they feed
    `sameResolvedSymbol`, so `directAssignmentEvent` sees writes through
    them as definite events) and may-aliases (resolved option targets
    include the tracked object without proof).
  - `supportedAliasDeclarationFor`: a resolution-transparent-position walk
    (wrappers; conditional condition/whenTrue/whenFalse — the condition
    slot only consumes a truthiness test and can neither escape nor mutate
    the object; logical operands; comma results) from a tracked read to its
    const alias declaration. The event scan treats such a read as harmless
    ONLY when the declaration is registered; a supported-looking read whose
    binding is unregistered escapes conservatively (the invariant that
    closes family (a)).
  - May-alias event branch in `collectTrackedObjectEvents`: writes,
    deletes, and increment/decrement through a may-alias degrade the
    property to unknown; call/new and other escape positions escape; reads
    are free; the declaration-name position is exempt.
  - Shorthand branch: an object-literal shorthand whose
    `checker.getShorthandAssignmentValueSymbol` resolves to the tracked
    symbol or a registered alias/may-alias adds an escape event at the
    store's evaluation point — longhand parity, closing family (b).
  - `referencesTrackedSymbol` extended to may-aliases and shorthand value
    symbols so the statement-skip optimization cannot hide the new events.
- Post-fix behavior (same fixtures): the five alias mutations →
  `shell-true shell=true` at the write; the shorthand mutation degrades to
  UNKNOWN with no false proof; the execSync stale-absent false positive,
  the ambiguous-alias stale proof, the alias-write-false false positive,
  and the shorthand-store false proof are all gone; longhand behavior
  unchanged.
- Permanent tests added (25 focused tests; suite 384 → 409):
  `test_sixth_correction_alias_mutation_violations_fail` (10 violation
  rows: cast/satisfies/assertion-paren-nonnull/logical-or/
  same-object-conditional/nullish/chained-cast alias writes, two-alias
  ordering final-true, shadowed-shorthand outer-proof preservation, and
  the condition-slot read keeping the true exec-default proof),
  `test_sixth_correction_alias_escape_controls_pass` (14 control rows:
  ambiguous-alias and may-alias-escape stale-proof removal, unrelated
  clone, definite-alias final-false, two-alias ordering final-false, the
  B1–B7 shorthand/longhand table with both exec-default probes, and the
  two reviewer-confirmed conservative boundary pins for inert may-alias
  reads and destructuring reads), and
  `test_sixth_correction_typescript_fixtures_compile` (all 24 fixture
  sources compile through the pinned `typescript/bin/tsc` with the
  fifth-correction flag set).
- Commands and observed results (canonical hermetic forms, pinned
  environment, all run and inspected in the current repository state):
  - `node --check scripts/check_typescript_portability.mjs` → exit 0.
  - `uv run pytest -c pyproject.toml --rootdir=. --confcutdir=. -o addopts=
    -ra --strict-markers --strict-config --disable-plugin-autoload -q
    scripts/tests/test_portability.py` → exit 0, **409 passed** (baseline
    384 re-proved at the exact start; 406 at the pre-boundary-pin
    candidate; 409 at the final content).
  - Canonical collection over all Python test files → **1305 tests
    collected** on POSIX (SHA-256
    `a6f86f0a8e6feea20e12679e773296728c24e33ad013e9b47035f5ed4d67d118`);
    regenerated `scripts/python-test-inventory.v1.json` holds **1303
    common/Windows node IDs** at SHA-256
    `ddd42895d994dab3b7ef59b5e4f0b9869e83d3927e6f9c8d522eb7f33640d4bb`
    plus the approved FIFO/socket POSIX-only pair; exactly the 25 new
    sixth-correction node IDs were added and none removed.
  - `uv run python scripts/check_portability.py` → exit 0, PASS on the
    real repository under the stricter sixth-correction analysis.
  - `uv run ruff check` / `uv run ruff format --check` on
    scripts/check_portability.py and scripts/tests/test_portability.py →
    clean; `uv run mypy --config-file pyproject.toml` on both → clean;
    `pnpm exec prettier --check` on the analyzer → clean.
  - `python3 scripts/validate_status.py` → PASS: all checks passed (45
    check groups) after every status edit; `pnpm traceability:check` →
    PASS (193 requirements, 300 work packages); `pnpm generate:contracts
    --check` → 183 files byte-identical; `git diff --check` → clean.
- Mutation campaign (writer-side): exactly eight semantic mutation
  families, each applied one at a time in a disposable `git clone
  --no-local --no-hardlinks` candidate of the exact base plus the exact
  uncommitted candidate diff, provisioned hermetically with `pnpm install
  --frozen-lockfile --offline`, never touching the authoritative checkout,
  every mutant loadable (`node --check`), each clone running a full-suite
  clean control before its mutation. The campaign ran twice — at the
  pre-boundary-pin candidate (clean controls 406/406) and again at the
  exact final content bytes (clean controls 409/409) — with identical
  kill outcomes and zero unexpected partition drift: M1 cast-alias
  registration removed → killed by a1-cast/a1-chained-cast/a10-final-true;
  M2 satisfies/wrapper registration removed → a2/a3/a10-final-true; M3
  same-object conditional registration removed → a5 alone; M4 ambiguous
  alias retains stale known state (unconditional supported-read plus
  may-registration removal) → both a7 stale-proof controls plus the
  inert-may-alias pin; M5 shorthand escape detection removed →
  b2/b3/b6-data/b6-exec/b7 while b1/b4/b5 stay green (longhand and
  symbol-precision intact); M6 statement-skip blind to shorthand → the
  same five with b4 longhand green (the exact asymmetry of the original
  defect); M7 escape/write effects applied only after sink observation →
  19 ordering-dependent tests fail while the no-intermediate-effect
  controls stay green; M8 over-broad symbol-agnostic shorthand escape →
  killed by the shadowed-shorthand violation alone with every correct
  escape still green. STOP at M8; no M9+.
- Writer-side bounded review (one reviewer, two passes, scope limited to
  alias registration/invalidation, shorthand escape, and their evaluation
  ordering; no recursive delegation; disposable clone only):
  - First pass at the pre-boundary-pin candidate: 65 adversarial fixtures
    with pre/post-diff differentials confirmed both invariants sound and
    symbol-precise and reported two strictly conservative detection
    regressions (condition-slot alias-initializer reads; destructuring and
    inert may-alias reads) plus one pre-existing out-of-scope hoisted-
    function blindspot (byte-identical pre/post; reproducible without
    aliases).
  - Writer response: the condition-slot read was fixed in-pass (the
    truthiness slot is mutation- and escape-free) and pinned by the
    `a7-condition-slot-read-keeps-exec-default-proof` violation row; the
    destructuring and inert-read boundaries were deliberately pinned as
    conservative (they lose only exec-default absent proofs and never
    manufacture certainty; the pre-correction "detection" rested on the
    same unsound blanket supported-read this pass closes and was itself
    fail-open for nested-object destructures), and the hoisted-function
    blindspot was parked in docs/KNOWN_ISSUES.md § KI-0058.
  - Second pass on the exact final content bytes: 73 adversarial fixtures →
    verdict NO_DEFECT_FOUND on all three surfaces; all 37 fifth-correction
    pins green; full focused suite 409 passed in the review clone.
- Frozen verification deferral: exactly as in the prior correction entries,
  the complete substantive verification sequence (`python3
  scripts/check_portability.py`, `python3 scripts/validate_status.py`,
  `pnpm traceability:check`, `pnpm generate:contracts --check`, `pnpm run
  doctor`, `pnpm verify`, `git diff --check`) is intentionally run twice on
  identical tracked bytes only after this documentation freeze and reported
  in the final writer handoff, not preclaimed here. Exact-SHA three-OS
  hosted evidence is pending this writer pass.
- Test counts: focused portability 409/409; Python canonical collection
  1305 POSIX / 1303 common-and-Windows; all other package suites unchanged
  and re-proved in the post-freeze verification passes.
- Artifacts: n/a (no screenshots; reproducers and probes lived only in the
  session scratchpad outside the repository; mutation and review work ran
  only in disposable clones that never touched the authoritative checkout).
- Notes: KI-0058 remains HIGH / IN_PROGRESS pending a completely fresh
  independent verifier on the exact sixth-correction content and W07
  governance. KI-0059..KI-0062 implementation/test surfaces were not
  reopened; no extension, Playwright, W06, contracts, Rust, catalog, gate,
  or governance surface changed. M02-W07 remains IN_PROGRESS; M02-W08
  remains NOT_STARTED; no package is READY.

### M02-W07 — KI-0058 TypeScript portability semantic fifth correction writer evidence (2026-08-18)

- Revision: fifth narrow correction writer pass starting from independently
  blocked fourth-correction commit
  `094d4ea5ff6adbfc829898e899e36d0a93401d5b` / tree
  `a650f4054aff5f47a9274dc588cfc13b8f75fe4e` / parent
  `8cf5b74561ddd4d4fafff7f3bd1f3b22277f107e` after verdict
  `FABLE_BLOCKED_FINAL_M02_W07_FOURTH_CORRECTION_VERIFICATION`; the
  fifth-correction content tree is recorded post-commit by the containing
  commit.
- Environment: macOS 27.0 arm64; Node 24.18.0 (keg-only pinned); pnpm
  11.17.0; uv-managed project venv; TypeScript 6.0.3; @types/node 24.13.3;
  specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`
  verified by direct recomputation.
- Writer provenance: the immediately preceding fifth-correction Claude Fable
  5 Ultracode session ended at its session limit during
  reconnaissance/bootstrap without reporting any edit, commit, or push; this
  session (also Claude Fable 5 Ultracode) verified the worktree and resumed
  the same fifth correction from the clean exact base. Implementation
  provenance only, NOT independent verification.
- Exact-boundary recovery: `git status --porcelain=v1 -uall` /
  `--porcelain=v2 --branch`, `git branch --show-current`, `git rev-parse
  HEAD`, `git rev-parse origin/main`, `git rev-parse 'HEAD^{tree}'`,
  `git diff --name-status` / `--stat` / `--check` → branch `main`; clean
  worktree; HEAD == origin/main ==
  `094d4ea5ff6adbfc829898e899e36d0a93401d5b`; tree
  `a650f4054aff5f47a9274dc588cfc13b8f75fe4e` — exactly the expected
  interrupted-session boundary (clean is the expected state because the
  prior session stopped during reconnaissance).
- Blockers reproduced on the exact base before any edit (direct checker
  invocations, scratch fixtures outside the repository):
  - Exact verifier 4×4×4 reproducer (`spawnSync` sink inside a nested exact
    loop; `options.shell = true` after the sink) → `[]`, exit 0 (Blocker A
    erasure); the 3×3×3 form and the 4×4×4 sink-after-loop form both →
    `shell-true shell=true`.
  - An instrumented scratch copy of the analyzer proved the mechanism: the
    shared object-analysis step budget exhausts at exactly steps=2048 during
    nested exact-loop replay; immediately before the sink-argument
    refinement pass the state set still contains a live
    `escaped=false, shell=possible` state carrying the proved `true`
    reference; after the pass every state is `escaped=true, shell=unknown`
    and the checker returns `[]`.
  - `new fs.Utf8Stream({ dest: "/tmp/parkf-utf8" })` → `[]` (Blocker B);
    pinned @types/node 24.13.3 declares `class Utf8Stream` with
    `constructor(options: Utf8StreamOptions)` and `dest?: string`, and no
    `createUtf8*` factory exists in the pinned declarations.
- Fifth-correction surface (scripts/check_typescript_portability.mjs,
  scripts/typescript-portability-node24-catalog.v1.json,
  scripts/check_portability.py, scripts/tests/test_portability.py,
  scripts/python-test-inventory.v1.json):
  - Budget monotonicity invariant (Blocker A): `MAX_OBJECT_ANALYSIS_STEPS`
    is unchanged (2,048) and the analysis stays bounded. Intermediate
    statements that never reference the tracked symbol or its aliases are
    skipped (they cannot change tracked state; an escaped state is already
    bottom), step-budget exhaustion is recorded on the shared budget,
    sink-argument refinement runs on clones, an exhausted analysis returns
    the union of refined and pre-refinement at-sink states so a proved
    reachable violation is never erased, and every exhausted sink analysis
    emits an explicit `analysis-budget` finding
    ("bounded option-object analysis budget exhausted"), which
    `check_portability.py` maps to an explicit PORT-SRC-008 message — a
    documented fail-closed bounded outcome instead of a silently completed
    clean analysis. Under-budget analyses are byte-for-byte unaffected, and
    the clean 128⁴ unrelated-loop control stays green through the statement
    skip.
  - Operational-constructor catalog model (Blocker B): new constructible
    classification `filesystem-path-options` (reviewed `option_paths` plus
    `roles.options`, operational constructors may not also be callable,
    non-operational constructibles require rationales, unknown constructible
    tokens are rejected at load), `fs.Utf8Stream` reclassified with `dest`
    as its reviewed path-bearing option, `new`-expression sinks resolved
    only through trusted catalog provenance (local/shadowed classes,
    augmented/cast members, and non-`dest` data fields stay clean), and a
    validation-only `--validate-catalog <path>` mode that runs the exact
    fail-closed loader against an alternate catalog file without ever
    substituting the reviewed adjacent catalog.
  - Reviewer-driven correction during the pass: the first construct gate
    made `new` of a reviewed operational callable resolve no sink
    (reviewer-reproduced regression against the fourth-correction base,
    e.g. `new spawnSync(..., { shell: true })` → `[]` while HEAD flagged
    it); the gate now falls through to the callable classification and the
    permanent pin `new-of-operational-callable-stays-a-sink` locks the
    behavior.
  - S1–S8 pinned as permanent regressions after direct probes confirmed
    current behavior correct in every case (no discrepancy; no
    implementation change needed): do/while unknown-condition second
    iteration and at-least-once exit, conditional-delete mayBeAbsent
    exec-default propagation, unknown-guarded `&&`/`||` RHS sinks,
    break-only exit states with clean-reset control, exec-family
    string-selector semantics (nonempty enables, empty/alias disables),
    uppercase/`.EXE` basename folding with `BASHX.EXE` control,
    `process.chdir` absolute/relative behavior, and fail-closed
    constructible catalog classification (five malformed-catalog shapes
    plus the real-catalog control through `--validate-catalog`).
- Permanent tests added (37 focused tests; suite 347 → 384): the A-series
  budget-monotonicity table (exact 4×4×4 reproducer preserving both the
  concrete `shell=true` finding and the explicit budget finding; 6×6×6
  beyond-threshold equivalent proving no fixture-specific budget raise;
  3×3×3 and sink-after-loop under-budget concrete-only; over-budget clean
  explicit bounded result with no invented shell finding), the
  budget-determinism test (identical repeated full-checker results on the
  over-budget reproducer), the B1–B5 Utf8Stream violation table
  (default/namespace/named/renamed imports and tracked const options), the
  C1–C4 controls (portable dest, local shadowed class, augmented member,
  non-dest data field), the S1–S8 pin and control tables, the
  five-shape malformed-catalog fail-closed table plus real-catalog
  validation-mode control, and the fifth-correction fixture compile batch
  through the pinned `typescript/bin/tsc` entry script.
- Writer-side adversarial review (two bounded lenses; writer-side only, not
  independent verification):
  - Reviewer A (budget monotonicity + S1–S4) found no defect in the
    fifth-correction mechanism: all behavioral anchors reproduced, the
    statement skip was proved behavior-neutral against the pre-correction
    checker on every candidate differential, erasure could not be
    reconstructed through argument refinement, observation cloning, or
    state-group merging, and all S1–S4 pins assert their intended
    semantics. It reproduced four pre-existing tracked-object defects that
    behave identically at the blocked fourth-correction base (cast-minted
    alias reads accepted without alias registration; shorthand-property
    escape invisible to the event scan, including one demonstrated false
    positive; `try`/`switch`/labeled sinks observing empty state; labeled
    break/continue degradation) — recorded honestly in
    docs/KNOWN_ISSUES.md § KI-0058 and intentionally not fixed in this
    narrow pass because the independent verifier cleared those families
    apart from budget exhaustion.
  - Reviewer B (constructor catalog + Utf8Stream + S5–S8) validated the
    constructor model across every provenance and option shape it could
    construct (aliases, element access, `.cts` require forms, dynamic
    import, `getBuiltinModule`, namespace `default`, computed keys,
    post-declaration writes — all correctly flagged; controls all clean;
    ten additional malformed-catalog shapes all fail closed; S5–S7
    semantics verified against the pinned runtime including the
    `execSync {shell:""}` ENOENT truth). Its substantive finding — the
    construct-gate regression described above — was writer-reproduced
    against both the working tree and the exact base, fixed, and pinned.
    Its secondary observations (the completeness oracle anchors
    callable/constructible membership, not per-member semantic fields;
    spread forms of reviewed option objects remain the pre-existing
    suppressive tracked-object boundary, now equally applicable to the
    constructor sink) are recorded in docs/KNOWN_ISSUES.md § KI-0058 as
    reviewed boundaries.
- Commands and observed results (canonical hermetic forms, pinned
  environment, all run and inspected in the current repository state):
  - `node --check scripts/check_typescript_portability.mjs` → exit 0.
  - `node scripts/check_typescript_portability.mjs --verify-node-catalog` →
    exit 0; `{"node":"24.18.0","types_node":"24.13.3","typescript":"6.0.3",
    "modules":["child-process","filesystem","filesystem-promises","path",
    "path-posix","path-win32","process"]}`.
  - `node scripts/check_typescript_portability.mjs --validate-catalog
    scripts/typescript-portability-node24-catalog.v1.json` → exit 0,
    `catalog ok`; the five mutated-catalog shapes → exit 1 with the exact
    pinned loader errors (unknown constructible classification, malformed
    constructor semantics ×2, unknown constructor role, missing
    non-operational rationale).
  - `uv run pytest -c pyproject.toml --rootdir=. --confcutdir=. -o addopts=
    -ra --strict-markers --strict-config --disable-plugin-autoload -q
    scripts/tests/test_portability.py` → exit 0, **384 passed** (fourth
    correction was 347; this correction adds 37 permanent regressions).
  - Canonical collection over all sixteen Python test files → **1280 tests
    collected** on POSIX; regenerated
    `scripts/python-test-inventory.v1.json` holds **1278 common/Windows
    node IDs** at SHA-256
    `2589daa94422e3cc26f4800d0512328e92b68a79ce3f63c1bf4770fadb438d9e`
    plus the approved FIFO/socket POSIX-only pair (= 1280 on POSIX at
    SHA-256
    `641f53918790b607b648e83eedf0c7c2da182d0ebc6135ea3771df123fd10a86`).
  - `uv run python scripts/check_portability.py` → exit 0, PASS (no
    findings on the real repository under the stricter fifth-correction
    analysis).
  - `python3 scripts/validate_status.py` → PASS: all checks passed (45
    check groups) after every status edit.
  - `pnpm traceability:check` → PASS (193 requirements, 300 work
    packages); `pnpm generate:contracts --check` → 183 files
    byte-identical.
  - `pnpm run doctor` → summary: 24 pass, 1 warning, 0 fail, 1
    not-yet-applicable; the single warning is `Working tree state:
    uncommitted changes present`, expected for the pre-commit candidate.
  - `uv run ruff check` / `uv run ruff format --check` on
    scripts/check_portability.py and scripts/tests/test_portability.py →
    clean; `uv run mypy --config-file pyproject.toml` on both → clean;
    `pnpm exec prettier --check` on the analyzer and catalog → clean.
  - Focused fifth-correction subset re-run after the reviewer fix →
    exit 0; full focused suite re-run → 384/384.
- Mutation campaign (writer-side): exactly twelve semantic mutation families
  were applied one at a time in disposable `git clone --no-local
  --no-hardlinks` candidates of the exact base plus the exact uncommitted
  candidate diff, each clone provisioned hermetically with `pnpm install
  --frozen-lockfile --offline` and each running a paired clean control of
  the complete focused suite (384/384 in every clone) before its mutation;
  the authoritative checkout was never mutated, every mutant stayed
  loadable/parseable, and every family was killed by its intended permanent
  tests with zero survivors: M1 monotonic union dropped (exhausted analyses
  return only refined states) → a1/a2 proved-violation preservation; M2
  budget raised to 4,096 with the invariant machinery reverted → a1
  (missing explicit bounded finding), a2 (erasure reproduced beyond the
  raised threshold), a6; M3 budget shrunk to 512 → a3/a4 under-budget
  precision plus the a5 clean near-boundary control; M4 Utf8Stream reverted
  to non-operational → b1–b5 plus three s8 catalog-shape tests; M5 dest
  mapping repointed to a non-path option → b1–b5; M6 unknown-constructible
  validation removed → s8-unknown-constructible-token; M7 property-access
  name trust replacing module provenance → c3 augmented-member control; M8
  bare-identifier name trust of shadowed classes → c2 local-shadowed
  control; M9 `process.chdir` reclassified non-operational → s7 pin plus
  the fourth-correction global-process-chdir violation; M10 do/while
  unknown-condition back edge dropped → s1 pin; M11 executable-basename
  case folding removed → s6 pin; M12 `readFileSync` reclassified
  non-operational → twenty-two third/fourth-correction operational
  filesystem regressions. The campaign stopped at the twelve reviewed
  families; campaign verdicts were recorded at the pre-freeze candidate,
  which differs from the frozen content only by this documentation
  paragraph and the final evidence text, neither of which participates in
  any kill assertion.
- Frozen verification deferral: exactly as in the third- and
  fourth-correction entries, the complete substantive verification sequence
  (`python3 scripts/check_portability.py`, `python3
  scripts/validate_status.py`, `pnpm traceability:check`, `pnpm
  generate:contracts --check`, `pnpm run doctor`, `pnpm verify`, `git diff
  --check`) is intentionally run twice on identical tracked bytes only
  after this documentation freeze and reported in the final writer handoff,
  not preclaimed here. Exact-SHA three-OS hosted evidence is pending this
  writer pass.
- Test counts: focused portability 384/384; Python canonical collection
  1280 POSIX / 1278 common-and-Windows; all other package suites unchanged
  and re-proved in the post-freeze verification passes.
- Artifacts: n/a (no screenshots; all evidence is command output recorded
  above; reproducers, probes, and the instrumented analyzer copy lived only
  in the session scratchpad outside the repository; the mutation campaign
  runs only in disposable `git clone --no-local --no-hardlinks` candidates
  provisioned by `pnpm install --frozen-lockfile --offline` that never
  touch the authoritative checkout).
- Notes: KI-0058 remains HIGH / IN_PROGRESS pending a completely fresh
  independent verifier on the exact fifth-correction content and W07
  governance. KI-0059..KI-0062 implementation/test surfaces were not
  reopened; no extension, Playwright, W06, contracts, Rust, gate, or
  governance surface changed. M02-W07 remains IN_PROGRESS; M02-W08 remains
  NOT_STARTED; no package is READY.

### M02-W07 — KI-0058 TypeScript portability semantic fourth correction writer evidence (2026-08-17)

- Revision: fourth narrow correction writer pass starting from independently
  blocked third-correction commit
  `8c8ef32952516123343fdec3bc035ab569ab2d3d` / tree
  `adb3257b3990cc7ab5e2d47a861f038513055f22`; the fourth-correction content
  tree is recorded post-commit by the containing commit.
- Environment: macOS 27.0 arm64; Node 24.18.0 (keg-only pinned); pnpm 11.17.0;
  uv 0.11.32 with uv-managed Python 3.12.13; TypeScript 6.0.3; @types/node
  24.13.3; specification JAPP-MASTER-001 v1.4 SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943` verified.
- Writer provenance (owner-directed handoff): GPT-5.6 Sol Ultra began this
  fourth correction and produced substantial uncommitted implementation,
  catalog, and test work (the dirty worktree recovered below). After the Codex
  usage limit, the owner explicitly reassigned the same dirty writer worktree
  to Claude Fable 5 Ultracode. Fable recovered the inherited bytes, verified
  them, completed the remaining semantic, review, and campaign work, and froze
  this pass. This is implementation provenance only, NOT independent
  verification; neither writer's work has been independently verified.
- Inherited-state recovery and reconciliation:
  - `git status --porcelain=v1 -uall` / `--porcelain=v2 --branch`,
    `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse
    origin/main`, `git rev-parse 'HEAD^{tree}'`, `git diff --name-status`,
    `--stat`, `--check` → branch `main`; HEAD == origin/main ==
    `8c8ef32952516123343fdec3bc035ab569ab2d3d`; tree
    `adb3257b3990cc7ab5e2d47a861f038513055f22`; dirty set exactly
    `scripts/check_portability.py`, `scripts/check_typescript_portability.mjs`,
    `scripts/python-test-inventory.v1.json`,
    `scripts/tests/test_portability.py`, plus untracked
    `scripts/typescript-portability-node24-catalog.v1.json`; no whitespace
    errors.
  - Every inherited byte was read and classified before the first edit. One
    incomplete inherited edge was found and closed: the inventory recorded
    `count` 1202 / stale sha256 while `node_ids` already held 1204 entries;
    the inventory was regenerated from the actual canonical collection.
- Fourth-correction semantic surface (inherited Codex design completed by
  Fable):
  - Reviewed pinned Node operational catalog
    `scripts/typescript-portability-node24-catalog.v1.json` (schema 1) bound
    to Node 24.18.0 / TypeScript 6.0.3 / @types/node 24.13.3 with exact
    runtime/policy/tool pin equality enforced at load; modules
    `child-process`, `filesystem`, `filesystem-promises`, `path`,
    `path-posix`, `path-win32`, `process`; operational vs explicitly reviewed
    non-operational classification with rationales; nested
    `realpath(.Sync).native`, `mkdtempDisposable(.Sync)`, `fs.promises` hop,
    `path.posix`/`path.win32` flavor nodes, `process.report.writeReport`,
    `process.execve`; catalog semantic fields (`shell_mode`, `option_paths`,
    invocation `roles`, path indices, path-compose operation) are validated
    fail-closed at load.
  - Exact child-process signature semantics per empirically verified pinned
    Node 24.18.0 behavior: `exec`/`execSync` are `exec-default` (a shell
    always runs except for the empty-string selector, which disables it —
    verified ENOENT at runtime); `execFile`/`execFileSync`/`spawn`/`spawnSync`
    are `truthy-selector` (true or a nonempty string enables; false, null,
    empty string, and undefined disable); `fork` is `forced-disabled` with a
    module-path role. Overload dispatch mirrors Node's `Array.isArray`
    dispatch: a provable non-array options bag (object target or provably
    nullish value) in the argv slot takes the options role
    (`execFile(file, options, callback)`); syntactic array literals through
    const aliases prove the argv role; typed callback parameters are proved by
    declared function type. Provably nullish exec-family options and
    `shell: undefined` yield the default-shell finding. Inert argv data never
    receives wrapper classification; executable+argv wrapper tuples
    (`bash`/`sh` basename after Windows-path/`.exe`/case normalization with
    exact `-c`/`-lc` flags, `sh -lc` parity included) apply to the
    spawn/execFile families and to `process.execve` with the POSIX argv0
    convention (flag slot 1); constant argv prefixes survive an unresolvable
    spread tail; `bash -client`/`sh -client` remain clean.
  - Options-expression state: object literals, tracked identifiers, const
    aliases, transparent wrappers, comma/sequence, conditional, `&&`, `||`,
    `??` with known-reachability selection and unknown-reachability state
    union; a reachable proved `shell=true` reference never disappears,
    including through the seventy-merge reference-preservation regression.
  - Loop dataflow: bounded back-edge fixed point with convergence keys over
    `while`/`do`/`for` and (added by Fable) `for-in`/`for-of`/`for await`;
    normal/continue/break flows; zero/one/second/later-iteration behavior;
    write-before-sink and sink-before-write; reset-before-every-sink;
    continue skipping reset or violation; break preventing the back edge;
    incrementor mutation; per-iteration binding invalidation; iterated
    expression evaluated exactly once; provably empty iterables are dead;
    exact iteration counts are trusted only when the loop variable has no
    body writes or deferred captures; nested exact replays are bounded by a
    shared budget (`MAX_TOTAL_EXACT_LOOP_REPLAYS` 1024) with sound fixed-point
    fallback; `delete` of a reviewed property is a modeled transition to
    absent.
  - Module provenance: closed catalog graph over static ESM imports (default,
    `default as`, namespace, named, renamed, type-only excluded), bounded
    `.cts` CommonJS require forms, the ambient Node global `process`
    (shadow-aware), direct `await import("specifier")` expressions and const
    destructures, and `process.getBuiltinModule("specifier")` string-literal
    re-entry; the official `node:path/posix` / `node:path/win32` submodule
    specifiers are cataloged with runtime-true flavors; the ESM namespace
    `default` member resolves to the module root through one unified catalog
    rule (`default as` uses the same rule; the member is additionally proved
    type-unreachable for CJS builtins under the pinned compiler and pinned as
    defense-in-depth); arbitrary or augmented members terminate provenance.
  - Catalog completeness oracle: `--verify-node-catalog` builds the pinned
    @types/node declaration program (skipLibCheck false), enforces exact
    callable/constructible set equality per reviewed node, bare-vs-`node:`
    alias equality, `export =` handling for the path/process family, symbol
    exclusion prefixes, a completeness-guard self-test, a `default as` import
    probe, and (added by Fable) a nested-surface rule: every catalog-callable
    member without an explicit node reference must expose zero
    non-default-library callable/constructible members, with its own guard
    self-test, so a pin bump exposing a new nested operation fails review.
  - Fail-closed integration preserved and extended:
    `check_portability.py::_check_ts_runtime_sources` validates helper
    infrastructure even with zero TypeScript sources; helper missing/nonzero/
    timeout, invalid JSON, non-list, malformed finding schema, foreign paths,
    invalid lines, catalog pin/field/completeness failures all raise
    PolicyError.
- Fresh fourth-round blockers (B1–B8) independently re-verified closed on the
  final content with paired clean controls (twelve direct checker
  reproductions): conditional option expressions, loop-carried second/later
  iteration state, known string shell selectors, inert execFile argv, bare
  and absolute Bash executable + `-c`, `default as` provenance,
  arbitrary-member provenance termination, and
  `realpathSync.native`/`mkdtempDisposable(.Sync)` classification.
- Writer-side adversarial review (three bounded lenses; writer-side only, not
  independent verification). Reviewer B (child-process semantics) reported
  six reproduced findings: B1 `execFile(file, options, callback)` role
  misassignment, B2 `sh -lc` parity, B3 spread-tail argv prefix loss, B5
  provably-nullish exec options, B6 typed-callback proof — all five fixed
  with permanent violation/control pairs — and B4 (short-option clusters such
  as `-ec`) which stays a reviewed exact-token boundary, parked below.
  Reviewer A (control flow/loops) reported four reproduced findings, all
  fixed: RA-1 exact-loop body mutation of the loop variable, RA-2 `delete`
  routing to the absent transition, RA-3 nested exact-loop replay cost
  exceeding the 120 s gate timeout on clean code, RA-4 provably-empty
  iterable inconsistency. Reviewer C (provenance/catalog) reported eight
  findings: C-01 un-imported global `process`, C-02 dynamic
  `import()`/`getBuiltinModule` re-entry, C-03 missing `path/posix`+
  `path/win32` specifiers, C-04 namespace `default` member, C-05 unvalidated
  catalog semantic fields — all five fixed — plus C-06/C-07/C-08 oracle-scope
  observations on provenance-terminating surfaces, parked below. Every
  substantive finding was re-reproduced by the writer against the real
  checker before any edit.
- Reviewed boundaries preserved unchanged (all pinned by permanent controls;
  all err only in the suppressive, non-flagging direction): switch/try/
  labeled statement sinks, spread of a tracked object, win32 path flavor,
  closure-captured sinks, `bash -client`/`sh -client`, dynamic shell values,
  and exact-token wrapper flags.
- Parked future-hardening record (accepted misses/observations, all
  provenance-terminating or suppressive-direction; no fail-open): shell
  short-option clusters (`-ec`, `-cl`, leading options) pending an
  owner-reviewed empirical truth matrix; `env(1)` trampolines
  (`env bash -c …` shapes); `createRequire` module re-entry;
  `globalThis.process` chains; compound logical-assignment enables
  (`options.shell ||= true`); oracle scan of constructible static surfaces
  and of uncatalogued data members; alias-surface classification depth.
- Commands and observed results (canonical hermetic forms, pinned
  environment, all run and inspected in the current repository state):
  - `node --check scripts/check_typescript_portability.mjs` → exit 0.
  - `node scripts/check_typescript_portability.mjs --verify-node-catalog` →
    exit 0; `{"node":"24.18.0","types_node":"24.13.3","typescript":"6.0.3",
    "modules":["child-process","filesystem","filesystem-promises","path",
    "path-posix","path-win32","process"]}`.
  - `uv run pytest -c pyproject.toml --rootdir=. --confcutdir=. -o addopts=
    -ra --strict-markers --strict-config --disable-plugin-autoload -q
    scripts/tests/test_portability.py` → exit 0, **347 passed** (347
    collected; third correction was 266; the fourth correction adds 81
    permanent semantic/catalog regressions).
  - Canonical collection over all sixteen Python test files → **1243 tests
    collected** on POSIX; regenerated
    `scripts/python-test-inventory.v1.json` holds **1241 common/Windows node
    IDs** at SHA-256
    `40129c42d9e8a325d9c9dc732f47094f04617c24bedce8b1b31fce93fc978bad` plus
    the approved FIFO/socket POSIX-only pair (= 1243 on POSIX).
  - `uv run python scripts/check_portability.py` and
    `PATH="$PWD/.venv/bin:$PATH" python3 scripts/check_portability.py` →
    exit 0, PASS (no findings on the real repository under the stricter
    fourth-correction analysis).
  - `uv run ruff check --config pyproject.toml scripts/check_portability.py
    scripts/tests/test_portability.py` and `uv run ruff format --check …` →
    clean after ISC004/ISC003 parenthesization of the fixture tables.
  - `git diff --check` → exit 0.
- Mutation campaign (writer-side): 32 semantic mutation families were applied one
  at a time in disposable `git clone --no-local --no-hardlinks` candidates of
  the frozen fourth-correction content (committed base plus the exact
  uncommitted candidate diff), each with a paired clean control run of the
  complete focused suite (347/347 in every clone) before the mutation; every
  mutant stayed parseable and every family was killed by its intended
  permanent tests: M1/M2 conditional-option branch or unknown-branch state
  dropped → p2; M3 loop back edge removed → five loop-family regressions;
  M4 continue edge dropped → the continue-skips-reset pair; M5 reference-cap
  widening collapse → extra-state-cap-preserves-violation (an earlier
  front-slice variant survived because merge order preserves the newest
  reference, so the fixture was corrected to bury an early proved enable
  under seventy merges and the complete campaign was rerun); M6 string shell
  treated as disabled → p5; M7 argv wrapper classification → the n3/n4
  inert-argv controls; M8 basename normalization removed → p7 +
  windows-bash; M9 unified `default` rule dropped → six default-as/namespace
  regressions (the original collectSinkBindings special case became
  equivalent code after the namespace-default unification and was simplified
  away; the separate namespace-default family merged into M9); M10 arbitrary
  member preserving provenance → the augmented-module control; M11 nested
  `.native` omitted → p11 plus the strengthened oracle; M12/M14 pinned
  fs/promises callable omitted → the oracle (plus behavioral kills);
  M13 assertSameSet weakened → the oracle guard self-test; M15 exec
  role/overload swap → twelve wrapper/exec regressions; M16
  iteration-statement back edge capped → the for-of/for-in/for-await trio;
  M17 execve flag position → the execve violation plus argv0 control; M18
  options-in-argv-slot dispatch dropped → execfile-options-callback; M19
  `sh -lc` parity dropped → the sh-lc tuple and string pair; M20 spread
  prefix dropped → the spread-tail pair; M21 nested-surface oracle rule
  weakened → the oracle guard self-test; M22 nullish-options handling
  dropped → the exec undefined/null/shell-undefined trio; M23
  typed-callback proof dropped → exec-callback-parameter; M24 catalog
  shell_mode typo → fail-closed refusal (323 tests fail with PolicyError
  instead of the pre-validation silent finding loss); M25 global-process
  provenance dropped → global-process-chdir; M26 await-import provenance
  dropped → the dynamic-import pair; M27 path submodule catalog modules
  removed → the submodule test plus the oracle; M28 delete routing
  reverted → delete-shell-exec-default; M29 exact-count body-mutation guard
  removed → exact-loop-body-mutation; M30 exact-replay budget removed → the
  nested-exact-loop-budget control; M31 getBuiltinModule re-entry dropped →
  get-builtin-module; M32 empty-iterable dead-body rule removed → the
  forof-empty-literal-dead control. No whitespace-only variants were
  counted; the authoritative checkout was never mutated. After the campaign,
  the first frozen verification pass surfaced two gate-compliance issues in
  the candidate: Prettier formatting of the analyzer and catalog files, and
  a strict-mypy rejection of the fixture-compile test's `pytestmark`
  introspection. Both were fixed with `pnpm exec prettier --write` (token
  re-wrapping only) and a `cast("Any", …)` on the two introspection sites;
  the focused suite (347/347), catalog oracle, canonical collection (1243),
  and real-repository policy were re-proved on the exact frozen bytes, and
  the two-pass requirement was restarted. The campaign verdicts were
  recorded at the pre-format candidate, whose analyzer and tests differ from
  the frozen content only by that Prettier re-wrapping of identical tokens
  and the typing cast in test introspection, neither of which participates
  in any kill assertion.
- Frozen verification deferral: exactly as in the third-correction entry, the
  complete substantive verification sequence (`python3
  scripts/check_portability.py`, `python3 scripts/validate_status.py`, `pnpm
  traceability:check`, `pnpm generate:contracts --check`, `pnpm run doctor`,
  `pnpm verify`, `git diff --check`) is intentionally run twice on identical
  tracked bytes only after this documentation freeze and reported in the
  final writer handoff, not preclaimed here. Exact-SHA three-OS hosted
  evidence is pending this writer pass.
- Hosted verification history (recorded truthfully): the first
  fourth-correction commit `b9b509345f4f2cb33ad959da6d2fd9521b94730c` / tree
  `da28987ab9713874510b406ba2aff9a7884bad83` triggered push run
  `32060897638`, which succeeded on macos-15 (job `95481711982`) and
  ubuntu-24.04 (job `95481712203`) but failed on windows-2025 (job
  `95481712268`): exactly the two fourth-correction tests that spawn `pnpm
  exec tsc` failed with `FileNotFoundError [WinError 2]` because bare `pnpm`
  cannot launch the Windows `.cmd` shim through `CreateProcess` (2 failed,
  1239 passed; every other suite green). The complete Windows raw log was
  read. The fix resolves `pnpm` through the repository's own
  `portability.host_resolve_executable` PATH/PATHEXT mechanism in both
  tests — the same boundary `scripts/verify.py` already uses and
  `test_windows_resolves_cmd_shim_for_pnpm` already pins — with no test
  added, removed, or renamed (collection stays 1243/1241 at the recorded
  digest). The two-pass frozen requirement was restarted on the fixed bytes,
  and the fix landed as follow-up forward-only commit
  `8cf5b74561ddd4d4fafff7f3bd1f3b22277f107e` (never amended or rewritten).
  Its push run `32064775075` succeeded on macos-15 (job `95494108593`) and
  ubuntu-24.04 (job `95494108688`); windows-2025 (job `95494108668`) proved
  the shim spawn fixed (the namespace-default test passes there) but exposed
  a second Windows boundary in the same fixtures-compile test: 59 absolute
  temp-directory fixture paths exceeded the `cmd.exe` 8191-character command
  line behind the `.cmd` shim (`AssertionError: The command line is too
  long.`; 1 failed, 1240 passed; every other suite green; complete Windows
  raw log read). The second fix runs the pinned `typescript/bin/tsc` entry
  script directly through `node` from the fixture directory with short
  relative names — no shim and no `cmd.exe` line limit — again with no test
  added, removed, or renamed. The two-pass frozen requirement was restarted
  once more, and the final three-OS hosted evidence binds to the next
  forward-only commit's SHA.
- Test counts: focused portability 347/347; Python canonical collection 1243
  POSIX / 1241 common-and-Windows; all other package suites unchanged and
  re-proved in the post-freeze verification passes.
- Artifacts: n/a (no screenshots; all evidence is command output recorded
  above; mutation campaign ran only in disposable `git clone --no-local
  --no-hardlinks` candidates that never touched the authoritative checkout).
- Notes: KI-0058 remains HIGH / IN_PROGRESS pending a completely fresh
  independent verifier on the exact fourth-correction content and W07
  governance. KI-0059..KI-0062 implementation/test surfaces were not
  reopened; no extension, Playwright, W06, contracts, Rust, gate, or
  governance surface changed. M02-W07 remains IN_PROGRESS; M02-W08 remains
  NOT_STARTED; no package is READY.

### M02-W07 — KI-0058 TypeScript portability semantic third correction writer evidence (2026-08-14)

- Revision: third narrow correction writer pass starting from independently
  blocked second-correction commit
  `2b85c9b1e1f80cd41334752e14b259dc61151058` / tree
  `7c97431ef520b3ebefe0c0a0a81c147c830d7351` / parent
  `f4ee49e6f056f2cc15257a6d8a0cbc43de7b1941`, after verdict
  `SOL_BLOCKED_FINAL_M02_W07_KI0058_VERIFICATION`. The forward correction
  commit is self-recording because this evidence edit cannot contain its own
  hash. JAPP-MASTER-001 v1.4 remained byte-identical at SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.12.13, rustc/cargo 1.97.1, and Playwright 1.62.0.
- Correction boundary: only PORT-SRC-008 helper/orchestration semantics,
  permanent portability tests and exact Python inventory, and truthful project
  memory are changed. The extension runtime, E2E, WXT configuration,
  dependencies/lockfile, contracts, mock ATS, W06, gate reports, model lock,
  prompt registry, and all KI-0059…KI-0062 implementation/test surfaces remain
  byte-identical. KI-0058 stays HIGH / IN_PROGRESS; KI-0059…KI-0062 stay HIGH /
  IN_PROGRESS pending final W07 governance; W07 stays IN_PROGRESS, W08 stays
  NOT_STARTED, and no package becomes READY.
- Exact second-correction reproduction: before modifying the helper, a
  disposable `git clone --no-hardlinks` of the starting content reproduced all
  seven fresh findings. Post-construction `options.shell = true`, computed
  `options[key] = !0`, `join("/", "tmp", "reviewer")` in `readFileSync`,
  const-aliased `path.resolve("/", "tmp", "reviewer")` in `readFileSync`, and
  object-literal `shell: !+"0"` each returned PORT-SRC-008 PASS when failure
  was required. Exported descriptive values beginning `/tmp/example is ...`
  and `bash -c is ...` each returned FAIL when PASS was required. The blocked
  145/145 suite and prior numeric evidence remain historical, but the second
  correction's broad complete-value semantic claims are superseded.
- Authoritative policy interpretation: JAPP-MASTER-001 M00-W09 requires
  platform-neutral executable/canonical flows and does not mandate rejecting
  every unused TypeScript string. A TypeScript path/wrapper fact now requires a
  reviewed operational use. Therefore unused `const p = "/tmp/x"`, descriptive
  exports/runtime data, arbitrary-call data, console/stdout data, and an unused
  trusted `node:path` result pass; the same proved value fails when it reaches a
  reviewed filesystem, process, child-process command/argv, or selected option
  position. Variable names never supply operational provenance. This removes a
  W07 implementation assumption, not an authoritative requirement, and leaves
  the older Python literal rule unchanged.
- Layer 1 — primitive constant semantics: the non-executing allowlist supports
  only null, booleans, numbers, and bounded strings. ToBoolean makes null,
  false, ±0, NaN, and the empty string false. ToNumber maps null→0,
  false→0, true→1, preserves numbers (including NaN, ±0, and infinities), and
  applies JavaScript numeric string conversion to already-proved bounded
  strings. Primitive `+` concatenates after primitive string conversion when
  either operand is a string and otherwise numerically coerces both operands;
  the supported unary `!`, `+`, `-`, and `~`, strict equality, relational,
  arithmetic, logical, conditional, and template operations use the matching
  primitive behavior. Thus `+false`, `+null`, `+""`, and `+"0"` are 0;
  `+true` and `+"1"` are 1; `+" 2 "` is 2; `+"not-number"` is NaN;
  `!+"0"` and `!!+"1"` are true; and `-"2"` is -2. Objects, arrays,
  Symbols, BigInts, mutable values, calls, and unsupported syntax remain
  UNKNOWN. Depth 64, 512 steps, 16,384-character strings, structural bounds,
  and declaration-cycle guards remain enforced; no `eval`, `Function`, `vm`,
  transpile/run, dynamic repository import, or repository-source execution is
  used.
- Layer 2 — pure operational expressions: proved ESM and bounded `.cts`
  CommonJS provenance identifies named/aliased `join`, namespace
  `path.join`/`path.resolve`, const callee/namespace aliases, and explicit
  `posix`/`win32` flavor while respecting local shadowing. Known string
  arguments produce a lexical abstract path fact; no Node host path function is
  called on source expressions. Join normalizes dot segments and preserves a
  known leading POSIX root; resolve walks right-to-left to the last known
  absolute operand and is UNKNOWN if no absolute root is established. Nested
  const composition and result aliases propagate to a later sink. Explicit
  win32 operations remain UNKNOWN rather than being flattened into POSIX facts;
  relative `join("fixtures", "x")` remains clean.
- Layer 3 — bounded local object state: a tracked symbol must originate in a
  local object literal and remain identifiable. The five reviewed
  child-process fields are represented as ABSENT, KNOWN, UNKNOWN, or a bounded
  possible set of proved references. Ordered duplicate literal properties,
  post-construction direct/computed writes, same-statement writes, sink argument
  evaluation order, and final overwrites replace earlier facts. Consequently
  true→false is clean and false→true fails. Supported if/logical/conditional/
  bounded-loop flow honors statically unreachable paths; when a condition is
  unknown, any reachable possible proved `shell=true` fails. State merging
  never discards an already-proved possible violation because of the path
  budget. Each optional-chain link is classified as never, maybe, or always
  reached: a proved-null base short-circuits later keys/arguments, a proved
  non-null base continues, and an unknown intermediate base merges skipped and
  reached states. Unknown calls, alias assignment/capture, reassignment,
  spread or `Object.assign`, unresolved computed keys, destructuring/binding
  defaults, deferred function-like captures, nested abrupt flow,
  switch/try-to-sink, unsupported expression containers, and other unsupported
  mutation invalidate relevant state to UNKNOWN rather than retaining stale
  certainty. Direct `break`/`continue`, false loop conditions, and definite for
  initializers are ordered explicitly.
- Layer 4 — operational sink classification: only the closed reviewed
  signatures consume facts. Filesystem path operands and the documented
  process path positions are path-only. Child-process executable/static argv
  positions are command contexts; only `cwd`, `argv0`, `execArgv`, `execPath`,
  and `shell` are inspected in options, with `shell` accepting a proved boolean
  true or command string. Path-only contexts never run wrapper classification.
  Filesystem data/encoding/callback operands, `process.stdout.write`, exports,
  JSX/data values, arbitrary calls, and `node:path` calls by themselves are not
  sinks. The exact Bash argv tuple remains closed to `bash -c`, `bash -lc`, and
  `sh -c`, including safe constant composition; `bash -client` remains clean.
- Fail-closed infrastructure: malformed TypeScript, unloadable sources, helper
  nonzero, invalid JSON, non-list JSON, malformed objects, invalid finding
  kinds/paths/details, and non-integer or boolean line values raise policy
  errors. Unsupported source semantics remain UNKNOWN/non-findings and are not
  mislabeled as infrastructure success.
- Permanent matrix: the focused portability file now passes 266/266, a net 121
  increase over 145. T1…T10 lock every required failure and C1…C10 lock every
  required control. Additional permanent families cover the full primitive
  coercion table and infinity/NaN/±0 controls; ordered duplicate/late writes;
  same-declaration state; possible/unreachable branches; logical/conditional
  nesting; loop initializer, zero-iteration, and abrupt-flow boundaries; sink
  argument and nested-container order; assignment-LHS evaluation order;
  per-link optional-chain short-circuiting; alias/capture/unknown-key/
  destructuring/binding-default invalidation; deferred-sink boundaries and
  unsupported-container invalidation; path callee aliases, nested composition,
  POSIX/win32 flavor, local shadowing, and over-budget UNKNOWN; path-only versus
  command classification; data-versus-path argument positions; CommonJS result
  propagation; and boolean-line response-schema rejection. The former
  `generic-call-exact-path` negative was deliberately reclassified as a data
  control under the authoritative operational-use interpretation. Canonical
  collection is 1,160 common-and-Windows IDs at SHA-256
  `7437536ab1b27670bc40175ae9ad0d888103cd0760f75eb089a07c9a78774c4d`
  plus the unchanged FIFO/socket pair, or 1,162 on POSIX.
- Fresh mutation campaign: a disposable no-hardlink clone contained 13
  substantive mutants and 13 paired clean controls. All 13 mutants were
  rejected and all 13 controls remained clean (14 findings because the M6
  operational counterpart intentionally carried both a path and wrapper).
  M1 post-construction true, M2 computed post-construction `!0`, M3 joined
  absolute path, M4 resolved/result-aliased absolute path, M5 `!+"0"`, and M6
  operational versus descriptive path/wrapper values reproduced and killed the
  six exact independent families. Seven fresh pairs covered overwrite order,
  alias escape, computed-key aliases, const path-callee aliases, local
  shadowing, nested const path composition, and filesystem data-versus-path
  argument position. Whitespace-only variants were not counted.
- Bounded adversarial review: Reviewer A found and the writer fixed numeric
  Infinity, transparent-wrapper budget, and multi-link optional-chain
  reachability defects, then cleared the primitive/control boundary. Reviewer
  B found and the writer fixed state-cap loss, same-statement
  ordering, nested expression flow, loop/abrupt ordering, sink argument order,
  assignment-LHS evaluation, event collision, and unsupported-flow
  invalidation, then cleared the changed boundaries. Reviewer C found and the
  writer fixed path/command conflation, explicit win32 provenance flattening,
  and boolean-line schema acceptance, then cleared provenance/sinks. These are
  writer-side adversarial reviews, not independent package verification or
  governance evidence.
- Confirmed pre-freeze commands: `node --check
  scripts/check_typescript_portability.mjs`, Ruff lint, and
  `git diff --check` passed. The canonical focused command
  `uv run pytest -c pyproject.toml --rootdir=. --confcutdir=. -o addopts= -ra
  --strict-markers --strict-config --disable-plugin-autoload -q
  scripts/tests/test_portability.py` exited 0 with 266/266. The exact Python
  inventory collection emitted 1,162 tests. Required full substantive
  verification is intentionally run twice only after this documentation freeze
  and is reported in the final writer handoff rather than preclaimed here.
- Governance: this correction does not verify W07, ready W08, fix KI-0058,
  evaluate Gate A, or change any critical gate. KI-0006 remains DEFERRED for
  future Rust/native enforcement; REQ-FORM-020 remains SCAFFOLD_ONLY /
  NOT_YET_APPLICABLE; all gates remain NOT_EVALUATED and release remains
  NOT_READY.

### M02-W07 — KI-0058 TypeScript portability semantic second correction writer evidence (2026-08-14)

- Revision: second narrow correction writer pass starting from independently
  blocked first-correction commit
  `f4ee49e6f056f2cc15257a6d8a0cbc43de7b1941` / tree
  `04721b7ea4fd0c2eec2506e507ea3e37c743e2ba` / parent
  `6cf4d4b2860c054868dbe22600a0f6455cc7b60a`, after verdict
  `SOL_BLOCKED_FINAL_M02_W07_CORRECTED_VERIFICATION`. The forward correction
  commit is self-recording because this evidence edit cannot contain its own
  commit hash. JAPP-MASTER-001 v1.4 remained SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.12.13, rustc/cargo 1.97.1, and Playwright 1.62.0
  with bundled Chromium.
- Correction boundary: the fresh verifier identified KI-0058 as the only
  remaining substantive blocker and independently cleared the KI-0059,
  KI-0060, KI-0061, and KI-0062 implementation/test surfaces. This pass changes
  only PORT-SRC-008 checker/helper semantics, its permanent pytest inventory,
  and truthful project memory; no extension runtime, E2E, WXT, dependency,
  lockfile, mock-ATS, W06, gate, contract, model, or prompt surface is reopened.
  All five issues remain HIGH / IN_PROGRESS pending governance; W07 remains
  IN_PROGRESS, W08 remains NOT_STARTED, and no package is READY.
- Reproduced defect: the first correction's 105/105 focused suite did not
  reject `shell: !0`, a const-computed `"shell"` key, or constant-composed
  prohibited operational paths, and it rejected the verifier's exact
  descriptive export. Its earlier semantic-sufficiency prose is therefore
  superseded, while its original commands and 105 / 1001 / 999 totals remain
  unchanged historical results.
- Constant evaluation: the repository-pinned TypeScript compiler parses
  executable `.ts`, `.tsx`, `.mts`, and `.cts` without executing repository
  source. A depth-, step-, string-length-, and structure-bounded evaluator
  resolves only allowlisted primitive literals, constant templates, safe
  TypeScript wrappers, const aliases, relevant unary/binary/logical/conditional
  forms, concatenation, and computed property names. Unsupported, mutable,
  cyclic, and over-budget expressions remain UNKNOWN; UNKNOWN does not prove a
  violation.
- Complete-value and shell policy: an object-literal property assignment or
  shorthand whose resolved non-type name is `shell` is rejected when its value
  resolves to `true`, including computed and aliased forms. Whole strings are
  checked at variable/parameter/property/class/enum initializers, array
  elements, return/yield/concise-arrow/export/JSX values, plain `=` right-hand
  sides, and every call/new argument. After leading whitespace, a whole string
  violates only when it begins with `/tmp`, `/bin`, `/usr`, `/etc`, or `/var`
  as a complete path segment, or the exact space/tab-delimited tokens
  `bash -c`, `bash -lc`, or `sh -c`; compound assignments and component
  literals inside an evaluated composition are not treated as complete values.
  The flag must end or be followed by a space/tab, so `bash -client` is
  accepted.
- Provenance and embedded sinks: embedded fragments require both a proved
  callee and a closed operation/argument-position signature. ESM named,
  default, and namespace imports are recognized for `child_process`, `fs`,
  `fs/promises`, `path`, and `process`, including `node:` spellings, in every
  scanned TypeScript-family suffix. Only `.cts` additionally recognizes
  TypeScript import-equals, const namespace or object-destructured literal
  `require`, and inline literal `require(...).member`; dynamic module names,
  mutable bindings, and locally declared/shadowed `require` are excluded.
  Bounded const aliases of imported callees and namespaces are followed.
  Child-process signatures inspect `exec`/`execSync` command 0;
  `execFile`/`execFileSync` file 0 and static argv 1;
  `spawn`/`spawnSync` command 0 and static argv 1; and `fork` module path 0 and
  static argv 1. Resolved option objects at overload positions 1/2 expose only
  `cwd`, `argv0`, `shell`, `execPath`, and `execArgv`; exact Bash/sh argv tuples
  apply only to execFile/execFileSync/spawn/spawnSync.
- Filesystem/path/process sink boundary: filesystem index 0 is inspected only
  for the closed one-path operation table, and indices 0/1 only for
  `copyFile`, `cp`, `link`, `rename`, and `symlink` plus listed sync variants;
  content/data/encoding/callback arguments are not sinks. Path signatures
  inspect every `join`/`resolve` argument, arguments 0/1 of
  `relative`/`matchesGlob`, argument 0 of the closed one-path operation table,
  and only `root`, `dir`, `base`, `name`, and `ext` in `format` objects.
  Process signatures are `chdir` 0, `loadEnvFile` 0, and `dlopen` 1. Embedded
  wrappers must begin the string or follow ASCII whitespace, `;`, `&`, `|`, or
  `(`. Operations without a signature, including `process.stdout.write`, are
  not embedded sinks.
- Permanent regression matrix: 40 new node IDs cover 21 required violations
  (seven shell-equivalence, seven composed operational, five direct/token/
  signature, and two `.cts` provenance cases), 13 required passes (ten prose/
  UNKNOWN and three payload/lookalike controls), and six fail-closed parser/
  helper/JSON cases. `uv run pytest scripts/tests/test_portability.py -q`
  exited 0 with 145/145 before documentation freeze. The twenty-first violation
  resolves a signed `execArgv` shorthand to its const array initializer and
  rejects an embedded prohibited path. The inventory records 1,039
  common-and-Windows IDs plus the unchanged two POSIX-only IDs, for 1,041 on
  POSIX; full-registry reproduction belongs to the post-freeze handoff.
- Failure behavior: syntactically malformed or unloadable TypeScript and helper
  nonzero, invalid-JSON, non-list-JSON, or malformed-finding output raise
  PORT-SRC-008 internal-error policy failures rather than silently passing.
  UNKNOWN expressions remain non-findings by design and are not described as
  fail-closed.
- Fresh mutation campaign: every case ran in its own disposable
  `git clone --no-local --no-hardlinks` candidate. F1 `shell: !0`, F2 a
  const-computed `shell` key, F3 a concatenated `/tmp` path, F4 const fragments
  flowing to `fs.readFileSync`, and F5 a constant-built Bash argv tuple each
  made the direct checker exit 1 with the exact PORT-SRC-008 fact and the
  permanent suite fail only `test_real_repository_passes_the_policy` at
  1 failed / 143 passed. Novel N1 combined a logical computed key with an
  arithmetic/equality true value and was rejected as `shell = true`; novel N2
  followed an aliased computed namespace callee plus a nested template into a
  signed child-process argv position and rejected embedded `/var`. Each novel
  case produced the same direct exit 1 and sole focused-suite failure.
  Controls P1 the exact exported verifier string, P2 comments/JSDoc, P3 an
  innocent constant concatenation, P4 the exact help prose as a `writeFileSync`
  payload, P5 the prose through `process.stdout.write`, and P6
  `spawnSync("bash -client")` each made the direct checker exit 0/PASS and the
  focused suite pass 144/144. All logs were inspected; the campaign directory
  was then moved to Trash rather than recursively deleted. This campaign
  preceded the later signed-option shorthand regression, so its exact 144/144
  control and 1 failed / 143 passed mutation summaries remain historical.
- Confirmed pre-freeze setup and focused commands: `pnpm install
  --frozen-lockfile`, `uv sync --locked`, `cargo fetch --locked
  --manifest-path services/native-host/Cargo.toml`, `cargo fetch --locked
  --manifest-path packages/contracts/test/contract/rust-harness/Cargo.toml`, and
  `pnpm exec playwright install chromium` exited 0 without tracked lockfile
  drift. `PATH="/Users/tanishkalwad/jobapplyv2/.venv/bin:$PATH" python3
  scripts/check_portability.py` and `uv run python scripts/check_portability.py`
  both exited 0/PASS. Prettier, ESLint, Node syntax, Ruff format/lint, mypy, and
  `git diff --check` all passed on the corrected helper/checker/test/inventory
  surfaces.
- First full verification commands and observed results:
  - `PATH="/Users/tanishkalwad/jobapplyv2/.venv/bin:$PATH" python3
    scripts/check_portability.py` -> exit 0, PORT-SRC policy PASS;
    `python3 scripts/validate_status.py` -> exit 0,
    PASS across 45 check groups.
  - `pnpm traceability:check` -> exit 0, 193 requirements / 300 work packages;
    `pnpm generate:contracts --check` -> exit 0, 183 generated files
    byte-identical.
  - `pnpm run doctor` -> exit 0, 24 pass / one expected dirty-writer-tree
    warning / zero fail / visual NOT_YET_APPLICABLE.
  - `pnpm verify` -> exit 0. All 17 ACTIVE suites passed: toolchain, format,
    lint, typecheck, unit-ts, contract-gen, fixture-corpus, evaluation-corpus,
    contract, build, e2e-browser, python, rust, portability, traceability,
    status, and integrity. Visual remained truthfully NOT_YET_APPLICABLE.
    Exact preserved totals were 3,376 TypeScript tests; extension 63/63;
    Playwright 72/72 in 23 files; W06 207/207; contracts 2,440 / focused 662 /
    generated 183 byte-identical; build 2/2; and Rust 1+10. The new canonical
    Python inventory collected and passed 1,040/1,040 on POSIX, comprising
    1,038 common-and-Windows IDs plus the unchanged FIFO/socket pair. That first
    full run preceded the later signed-option shorthand regression and its one
    additional permanent node; the frozen-state handoff must reproduce the
    current 1,041 total.
  - `git diff --check` -> exit 0. Before and after that complete sequence,
    `git diff --binary HEAD | shasum -a 256` remained
    `b8d19259b99248c60fcfc3b1e598ae07cd71fd712c8de75a8e52337a0a225567`,
    and the complete untracked-aware status fingerprint remained
    `1acb5f334f354c2be2842d9e8e6adae1fe3528512eea4ac61a3dac4a09ddf42c`;
    the commands caused no tracked-byte or path-set drift.
- Documentation freeze: this entry records only inspected results. The required
  second complete substantive pass occurs after this line is frozen and is
  reported in the final writer handoff rather than preclaimed here. Exact-SHA
  three-OS hosted evidence likewise belongs to the later pushed correction
  commit and final handoff, not this pre-commit evidence entry.
- Governance: this is writer evidence, not independent verification. KI-0058
  remains HIGH / IN_PROGRESS; KI-0059 through KI-0062 remain HIGH / IN_PROGRESS
  without reopened implementation; M02/W07 remain IN_PROGRESS; W08 remains
  NOT_STARTED; REQ-FORM-020 remains SCAFFOLD_ONLY / NOT_YET_APPLICABLE; all
  critical gates remain NOT_EVALUATED; release remains NOT_READY.

### M02-W07 — Final-verification correction writer evidence (2026-08-13)

- Revision: narrow correction writer pass starting from the independently
  blocked content commit `6cf4d4b2860c054868dbe22600a0f6455cc7b60a` /
  tree `ddb6df168684ab5f534ac1125f14bb85067e613c` / parent
  `e884917a2f82c392e99d340018c6da6919641bf0`. The independent verdict was
  `SOL_BLOCKED_FINAL_M02_W07_VERIFICATION`. The forward-only correction
  commit is self-recording because an evidence edit cannot contain its own
  hash. Canonical JAPP-MASTER-001 v1.4 remained SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.14.4 host interpreter for `python3` entrypoints and
  Python 3.12.13 in the pinned uv-managed project environment,
  Cargo/rustc 1.97.1,
  Playwright 1.62.0 with pinned bundled Chromium, WXT 0.20.27 (exact).
- Implementation boundary: the empty `apps/extension` M00-W02 slot became
  the real minimal WXT Manifest V3 feasibility substrate — one background
  service-worker entrypoint publishing a fixed runtime identity marker, one
  loopback-only content script bounded to `http://127.0.0.1:4761/*`, and
  one closed typed probe protocol
  (`M02_W07_PROBE` -> `M02_W07_ACK`, strict finite validation, extra
  members rejected, marker
  `data-japp-m02-w07-extension-ready="true"` set only after a valid ACK
  from the real service worker). No product UI, popup, side panel, options
  page, devtools page, native host, database, model runtime, profile
  access, scanner, ontology/resolver, control driver, MutationObserver
  engine, ATS-specific behavior, fill, navigation, or submission capability
  exists; W08–W11 own those surfaces and M17 owns productionization.
- Independent-blocker reproductions: five separate no-hardlink disposable
  clones of the exact blocked content demonstrated that (A) quoted and
  multiline `shell: true` plus a `.tsx` `/tmp/...` path escaped
  PORT-SRC-008, while comment-only text also produced false positives;
  (B) `UNCONDITIONAL_MARKER + INVALID_ACK` still passed all 40 extension
  tests and all ten W07 browser tests; (C) changing the live
  `nat-disclosure` select after ACK still passed the three inertness tests;
  (D) WXT 0.20.27 emitted a document CustomEvent despite the prior
  marker-only claim; and (E) adding a second parser branch accepting
  `{ command: "fill" }` still passed all 40 extension tests and all ten W07
  browser tests. These are recorded separately as KI-0058 through KI-0062,
  all HIGH / IN_PROGRESS pending fresh independent verification.
- Generated-manifest checks: WXT generates the manifest from
  `wxt.config.ts` plus the two entrypoints (never hand-authored);
  `apps/extension/test/m02-w07/built-manifest.test.ts` runs the real WXT
  build and fails closed unless the output is exactly
  `manifest_version: 3`, the six-member top-level allowlist
  (`background`/`content_scripts`/`description`/`manifest_version`/`name`/`version`),
  a real `background.service_worker` file, exactly one content script with
  matches exactly `["http://127.0.0.1:4761/*"]`, no
  permissions/host_permissions/optional permissions, no
  action/options/side-panel/devtools/page surfaces, no
  externally_connectable, no web_accessible_resources, no broad host
  pattern, and no submission-authority code token (`.submit(`,
  `requestSubmit`, `.click(`, `AUTO_SUBMIT`, `credential`, `captcha`) in
  runtime sources or shipped bytes.
- Real-browser proofs (`e2e/extension/`, six spec files, thirteen tests, run
  by the canonical root `playwright test` command which builds the production
  extension and an isolated invalid-ACK test variant through
  `e2e/extension/support/global-setup.ts` first;
  `--list` performs no build): each test launches a fresh
  `chromium.launchPersistentContext` (channel `chromium`, fresh
  `mkdtemp` system-temp profile, `--disable-extensions-except` /
  `--load-extension` of the built `apps/extension/dist/chrome-mv3`), and
  the shared fixture removes the profile with bounded Windows-safe retries
  (including on launch failure) and fails any test whose context issues an
  observed non-loopback request (loopback lab origin plus
  about:/blob:/chrome:/chrome-extension:/data: only). Runtime request
  observation cannot see the browser-launch window or non-HTTP channels,
  so the deterministic isolation guarantee is the static egress-token scan
  (`fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`,
  `RTCPeerConnection`, …) over runtime sources and shipped bytes in the
  built-manifest suite; the shipped W07 bytes contain no egress primitive
  at all. WXT's default page-world `content-script-started` postMessage
  broadcast is suppressed (`noScriptStartedPostMessage: true`) and the
  page-world message collector requires the complete observed message list
  to remain empty. Inspection of exact installed WXT 0.20.27 source found
  its `ContentScriptContext.stopOldScripts` document CustomEvent is
  unconditional and no supported option suppresses it; changing worlds
  would weaken the architecture. The correction therefore models that one
  event as a bounded framework bootstrap artifact. An init-script observer
  requires exactly one event for each tested content-script injection, exact
  type derived from the real extension ID, exact detail keys, content-script
  name, and a base-36 injection-ID string matching the exact WXT generator.
  A Chrome trace begun before navigation identifies every DOM `EventDispatch`
  whose stack originates in the extension during the bounded navigation,
  readiness, and fixed settle interval and requires the lifecycle event to be
  the sole dispatch in that observation window. Static source and shipped-byte
  checks close the broader emission surface. Proven: (A) a real
  `chrome-extension://<id>/background.js` service worker exists for the loaded
  build (extension ID derived from the worker URL, never hard-coded); (B) the
  worker is the W07 runtime —
  its global `__JAPP_M02_W07_BACKGROUND__` identity equals the protocol
  constants, and `chrome.runtime.getManifest()` inside the running browser
  is genuine MV3 with the reviewed minimal boundary; (C) the real content
  script establishes the probe round-trip and sets the namespaced marker,
  while the same lab page in a no-extension context never carries the
  marker (the marker is extension evidence, not page JavaScript); (D) the
  invalid-ACK variant re-exports the actual production content entrypoint,
  observes at least one real probe in its fixture-only worker, returns a
  structurally invalid ACK, and proves the marker remains absent; (E) the
  extension is inert — a pristine no-extension snapshot equals real-extension
  state after activation and after reload. The deterministic snapshot
  discovers every live `form.elements` member and records identity, tag/type,
  attributes, value/defaultValue, checked/defaultChecked/indeterminate,
  select index/selected options, disabled/effective-disabled, required/
  readOnly, `willValidate`, every `ValidityState` flag, `validationMessage`,
  `aria-invalid`, form structure, status/error regions, honeypot, all
  session/local storage, URL, history length/state, flow state, and receipt
  state. The readiness marker is deliberately outside that form equality;
  (F) an extension-origin manifest page sends the literal canonical probe and
  a hostile product-shaped matrix through the actual worker, requiring the
  one literal ACK for the canonical request and no response for every command,
  operation, payload, data, nested-command, action, request, or extra-member
  form; (G) the content script does not execute on a non-matching document
  (`about:blank`); and (H) reload re-establishes the probe through the real
  extension runtime.
- Package unit tests: `apps/extension/test/m02-w07/` — 63 Vitest tests
  (52 closed-protocol tests and 11 generated-build/observable-boundary tests).
  The protocol corpus includes explicit extra-member closures and hostile
  product-shaped messages with multiple unrelated command values; it compares
  the parsers against finite literal builders for the sole accepted probe and
  ACK rather than banning one command string.
- Verification-surface updates in this package: the `build` suite joined
  `scripts/verification-suites.json` (ACTIVE once M02-W07 began;
  `pnpm exec turbo run build --force` with a `turbo_task_count` proof over
  the two real build implementers), closing KI-0001 non-vacuously;
  `turbo.json` gained the `build` task; PORT-SRC-008 (KI-0006 TypeScript
  half) now discovers runtime `.ts`, `.tsx`, `.mts`, and `.cts` files while
  excluding declarations and delegates to a fail-closed TypeScript compiler
  AST check. It rejects hard-coded POSIX paths in runtime literals and any
  identifier, quoted, or statically computed `shell` property whose value is
  statically true (including const aliases and shorthand), across
  whitespace/newlines, while ignoring
  comments, documentation expressions, type-only nodes, and semantically
  innocent strings. Ten correction tests cover those boundaries, including
  computed and const-true shorthand shell properties. The
  blocked evidence claimed four original portability tests, but the blocked
  diff actually added five; this correction records both counts honestly. The
  reviewed-lockfile oracle in
  `scripts/tests/test_v14_migration.py` was re-reviewed for the exact WXT
  0.20.27 addition (new `apps/extension` importer, jiti peer-resolution
  keys, re-locked digest); `scripts/python-test-inventory.v1.json` now records
  999 common + 2 POSIX-only node IDs; and repository-inventory pins
  (14 workspace packages with test/typecheck scripts, ACTIVE suite set
  including `build`, doctor healthy-fixture artifact) were updated in
  `scripts/tests/`.
- Correction mutation campaign: every experiment ran in a separate
  disposable `git clone --no-hardlinks` copy of the corrected candidate;
  the authoritative checkout and all owner evidence remained untouched.
  Clean controls passed PORT-SRC-008, 63/63 package tests, and the focused
  ACK/inertness/observable-surface/protocol browser set 6/6. Original escapes
  were rejected as follows:
  - A1 `{ "shell": true }`, A2 `{ 'shell': true }`, A3 `.tsx` with
    `/tmp/japp-profile`, and A4 a multiline `shell`/colon/`true` property each
    made portability exit 1 with PORT-SRC-008; clean comments, documentation,
    and innocent strings remained accepted.
  - B1 changed the actual production content entrypoint to set readiness
    unconditionally and the production worker to return an invalid ACK; the
    permanent causal browser test failed because it observed marker `"true"`.
  - C1 changed `nat-disclosure` to a non-default select value and C2 changed
    the representative `nat-updates` checkbox; the generic pristine-baseline
    inertness test failed with the exact changed select/checked state.
  - D1 introduced an additional extension-originated `japp-extra` CustomEvent;
    the trace proof failed with two event types. D2 re-enabled WXT's started
    postMessage; the complete page-world message assertion failed with one
    observed message.
  - E1 added a second accepted `{ command: "fill" }` shape and E2 added an
    alternate `{ command: "scan" }` shape with no literal `fill`. Each made
    unit closure tests and the actual-worker browser proof fail; operation and
    nested variants are independently hostile as well.
- Commands and observed results (each run and inspected in the current
  repository state):
  - `pnpm install --frozen-lockfile` -> exit 0 (spawn-sync lifecycle
    script deliberately not executed; decision recorded in
    pnpm-workspace.yaml `allowBuilds`).
  - `uv sync --locked` -> exit 0; `cargo fetch --locked` (native-host and
    rust-harness manifests) -> exit 0.
  - `pnpm --filter @japp/extension typecheck` -> exit 0 (wxt prepare +
    tsc against tsconfig.typecheck.json; repository strictness inherited
    unchanged, skipLibCheck stays false).
  - `pnpm --filter @japp/extension test` -> exit 0, 63/63 (2 files).
  - `pnpm --filter @japp/extension build` -> exit 0, WXT chrome-mv3
    output 5.99 kB (manifest.json, background.js,
    content-scripts/feasibility.js).
  - `pnpm exec playwright test --list` -> exit 0, `Total: 72 tests in 23
    files`, with no build side effect (dist absent before and after).
  - `pnpm exec playwright test` -> exit 0, 72/72 passed (59 preserved
    browser tests plus 13 W07 real-extension tests) against the real built
    extension and test-isolated invalid-ACK variant in bundled Chromium
    persistent contexts.
  - `pnpm --filter @japp/evaluation-corpus test` -> exit 0, 207/207
    (M02-W06 regression preserved).
  - `pnpm exec turbo run build --force` -> exit 0, `Tasks: 2 successful,
    2 total` (@japp/extension WXT build + @japp/mock-ats-lab build).
  - `uv run python scripts/check_portability.py --quiet` -> exit 0 (PASS
    including the new PORT-SRC-008 TypeScript runtime scan).
  - `python3 scripts/validate_status.py` -> exit 0, PASS (45 check
    groups).
  - `pnpm traceability:check` -> exit 0, PASS (193 requirements / 300
    packages) after the REQ-FORM-020 SCAFFOLD_ONLY re-lock.
  - `pnpm generate:contracts --check` -> exit 0, generated contracts up
    to date (183 files, byte-identical).
  - `pnpm run doctor` -> exit 0, 24 pass / 1 expected dirty-writer-tree
    warning / 0 fail / 1 visual NOT_YET_APPLICABLE.
  - `pnpm verify` -> exit 0, all 17 ACTIVE suites PASS (toolchain,
    format, lint, typecheck, unit-ts, contract-gen, fixture-corpus,
    evaluation-corpus, contract, build, e2e-browser, python, rust,
    portability, traceability, status, integrity), 3,376 TypeScript
    tests, Playwright 72/72, canonical Python inventory 1001 POSIX / 999
    common-and-Windows, Rust 1+10, contracts 2440 / focused 662 /
    generated 183 byte-identical, visual truthfully NOT_YET_APPLICABLE.
  - Second full verification pass (`python3 scripts/validate_status.py`,
    `pnpm traceability:check`, `pnpm generate:contracts --check`,
    `pnpm run doctor`, `pnpm verify`, `git diff --check`) -> all exit 0
    with identical totals and byte-identical tracked content
    (`git status --porcelain` unchanged; generated `.wxt/` and `dist/`
    state remained ignored and caused no drift).
- Test counts: extension unit 63/63; Playwright 72/72 (23 files); W06
  regression 207/207; portability pytest 105/105 within canonical Python
  1001 POSIX / 999 common-and-Windows; no skipped, focused, todo, xfail,
  xpass,
  deselected, or rerun outcomes anywhere.
- Artifacts: git-ignored `apps/extension/dist/chrome-mv3/` (rebuilt by
  every unit/e2e/build-suite run) and `apps/extension/.wxt/` (generated
  types); no tracked build output, no screenshots/traces retained (all
  tests passed).
- Manual/UI validation performed: inspected the generated
  `dist/chrome-mv3/manifest.json` byte content directly (six top-level
  members, single loopback content-script match, no permissions) and
  observed the real service worker, probe round-trip, readiness marker,
  and untouched `/native/` form through the Playwright-driven bundled
  Chromium runs recorded above.
- Security/privacy impact: the extension has zero permissions and a single
  loopback-only content-script match. Static source and shipped-byte scans
  establish absence of egress primitives, including the browser-launch window;
  runtime observation independently establishes that traffic seen after
  listener attachment is local, but does not claim to observe launch-time or
  non-HTTP channels. The strictly closed message protocol rejects untrusted
  content-script input without response (spec §5.4). There is no credential,
  CAPTCHA, MFA, submission, data-collection, or storage surface.
- Known limitations: this is feasibility research evidence, not product
  support — no Chrome Web Store distribution, no general ATS support, no
  production autofill capability, and no Gate A evaluation. REQ-FORM-020
  is SCAFFOLD_ONLY: the production-scale test surface (field engine,
  drivers, ATS matrix, rerender/recovery/performance negatives, gate
  benchmark) belongs to M02-W08+ and M17-W06. The probe retry bound
  (3 × 200 ms) covers service-worker startup races only. Hosted three-OS
  proof of the exact content SHA did not exist when this entry was
  written: it is produced by the push-triggered CI run after the content
  commit and is recorded in the writer's completion handoff, not here.
  M02-W07 remains IN_PROGRESS pending a completely fresh independent
  verifier.

### M02-W06 — Governance closeout after final independent Sol verification (2026-08-12)

- Accepted content boundary: exact commit
  `f4ffcf7064fe0f077b948690cebbee385fe190fb`, tree
  `6fd4219460a7659b21576f2ca20b19b744f3bbf9`, parent
  `b4d8137b51df15bb1492b998d01aa031ade933ca`, title
  `M02-W06: make owner verification status lifecycle-aware`. Canonical
  JAPP-MASTER-001 v1.4 remained SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  The owner-selected lead verifier was GPT-5.6 Sol Ultra and had not authored,
  edited, supervised, committed, pushed, or repaired any accepted content.
- Mandatory isolation: before substantive work, the lead attested the exact
  authoritative repository, verification SHA, and three authorized owner
  roots; prohibited any query of the rejected historical root or enumeration
  of an owner-evidence parent/ancestor; and kept the authoritative checkout and
  genuine owner roots read-only until the content-clear gate. All mutations
  ran only in fresh `git clone --no-local --no-hardlinks` checkouts or
  synthetic test copies. Two bounded independent reviewers received their
  role-specific allowlists and the mandatory prohibition text. Neither
  reviewer recursively delegated.
- Baseline and pre-verdict checkpoint: before review and immediately before
  the content verdict, authoritative `HEAD` and `origin/main` were both
  `f4ffcf7064fe0f077b948690cebbee385fe190fb`, tree was
  `6fd4219460a7659b21576f2ca20b19b744f3bbf9`, status was clean, and all 693
  tracked worktree entries reproduced SHA-256
  `427f1d5ca4b081fa34013d732302506ed57316e36025394969f5dc548ea18c75`.
  Lead content/mode fingerprints for AUTHOR, REVIEW, and FINAL reproduced
  exactly before and after; counts remained 21 files/two directories, one
  file, and 19 files/two directories respectively, with no symlink, special
  file, or lexical escape. The independent owner reviewer additionally
  reproduced byte- and metadata-identical before/after fingerprints and
  owner-only directory/file modes. No command, tool call, or reviewer targeted
  the prohibited historical root, and no owner parent/ancestor enumeration
  occurred.
- Lifecycle/history reviewer: PASS with no finding. In fresh no-hardlink
  clones it proved the linear, merge-free W06 first-parent chain; reproduced
  the exact `b4d8137` lifecycle dead end (pending passed, marker-only final
  clear produced the sole expected 1/81 failure, and no final token existed in
  reachable prior history); and verified current W06 207/207, status 157/157,
  central validation 45 groups, lifecycle current/future/eight-invalid matrix
  10/10, history/mutation subset 33/33, and the disposable
  W06-VERIFIED/W07-READY/final-clear state at 207/207. The original corpus
  version index, manifest, coverage artifact, and holdout log remained
  append-only and byte-preserved.
- Owner-source reviewer: PASS with no finding. Direct final-root verification
  and independent recomputation authenticated exact author record digest
  `sha256:4d04e05f3af45f32d17e3ba85e6b276298f61adf5fbc0d4b6182b9cd0d7f2b3a`,
  author rationale digest
  `sha256:90ea4e1c6748fd2bb4c4321f5e68dbc72dac3955e4bf04fbefad09e9a238f44d`,
  review record digest
  `sha256:9588f417e90d8d95f5486d25e850cb03a1d0beb936b46d75feac95b69f73414d`,
  case-container commitment
  `sha256:cae3cb54c0a9d0d2abaa2e5610fdbf6055d54bc953ba48647414134a8d0eebc7`,
  and artifact-preimage commitment
  `sha256:a5d6ac3952a71ffe28c370031c0b2a40fa5c4cc70c1df2e0bb5ee9bc47ae4f84`.
  Author-to-final case/artifact bytes, author-draft/final core mapping,
  source/timestamp/digest provenance, closed inventories, contract/schema
  bindings, and the public sanitized manifest all agreed exactly. The author
  revision `b317705f1ca9f0db699162e97b37c5ca55527e62` exists in the accepted
  ancestry, and every bound spec/schema/corpus input remained unchanged.
- Lead owner verification: the exact final root produced 14 cases, four case
  containers, 14 authenticated artifact preimages, 26,730 case bytes, 20,494
  artifact bytes, and 47,224 total bytes. Manifest digest was
  `sha256:a10ecd8f5eb4f930b056e6ed375627ef42055fece1c5ffb86ef198b1cebe5a79`
  and receipt digest was
  `sha256:ae7aea1d4f8c7da588f6ca648de02680af507eba42858b75b3c71f4020192948`.
  Direct export in the disposable clone reproduced the committed sanitized
  manifest byte-for-byte and left the clone clean. No hidden case, artifact,
  expected truth, mapping, path, or narrative entered repository output.
- Lead commands and observed results in a fresh no-hardlink clone on macOS 27
  arm64 with pinned Node 24.18.0, pnpm 11.17.0, uv 0.11.32, Python 3.12.13,
  and Cargo/rustc 1.97.1:
  - frozen pnpm install and locked uv sync -> exit 0;
  - W06 typecheck, corpus, coverage, privacy, log, test, and mutation commands
    -> exit 0; W06 207/207 and the historical mutation campaign 15/15;
  - direct owner verify/export -> exit 0 with the exact counts and digests
    above; export was byte-neutral;
  - central status validation -> PASS, 45 groups; traceability -> PASS,
    193 requirements / 300 packages; focused lifecycle matrix -> 10/10;
  - `pnpm verify` -> exit 0: all 16 ACTIVE suites PASS, 3,313 TypeScript
    tests, generated contracts 183 byte-identical, focused contracts 662,
    Playwright 59, canonical Python 986, Rust 1+10, portability/integrity
    PASS, and visual truthfully NOT_YET_APPLICABLE.
- Final content verdict: `SOL_CLEAR_FINAL_M02_W06_CONTENT`. Only after that
  exact verdict and the immediate integrity checkpoint did governance begin.
- Governance transition: M02-W06 moves IN_PROGRESS -> VERIFIED at accepted
  content tree `6fd4219460a7659b21576f2ca20b19b744f3bbf9`; M02-W07 moves NOT_STARTED ->
  READY and becomes the sole next package; current work becomes NONE;
  `m02_w06_package_verification_state` moves to the one canonical
  `FINAL_INDEPENDENT_VERIFICATION_CLEAR` token; and KI-0055, KI-0056, and
  KI-0057 move to FIXED. Human and generated traceability are refreshed only
  for that state/evidence transition. M02 remains IN_PROGRESS, release remains
  NOT_READY, all four critical gates remain NOT_EVALUATED, and W07/W13/W14/W15
  have not begun. This is package governance only: no holdout benchmark was
  executed and no Autofill Feasibility, gate, compatibility, or milestone
  acceptance claim is made.
- Post-transition verification in the authoritative governance-only working
  tree: `uv run python scripts/validate_status.py` -> exit 0, 45 check groups;
  `pnpm traceability:check` -> exit 0, 193 requirements / 300 packages;
  `pnpm --filter @japp/evaluation-corpus test` -> exit 0, 207/207;
  `uv run pytest -q scripts/tests/test_validate_status.py` -> exit 0, 157/157;
  Prettier checks across all six transitioned files -> exit 0; and
  `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm verify` -> exit 0, all 16
  ACTIVE suites PASS, Playwright 59/59, canonical Python 986/986, Rust 1+10,
  and visual truthfully NOT_YET_APPLICABLE. No flaky behavior was observed.

### M02-W06 — Governance-lifecycle corrective writer pass (2026-08-12)

- Revision: corrective working tree over exact synchronized blocked integration
  commit `b4d8137b51df15bb1492b998d01aa031ade933ca` / tree
  `76d98c7e1f3459ae0739419cef6f7908026eab96` (parent
  `b317705f1ca9f0db699162e97b37c5ca55527e62`, branch `main`, initially equal
  to `origin/main`). Canonical JAPP-MASTER-001 v1.4 remains SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.12.13, Cargo/rustc 1.97.1, Playwright 1.62.0,
  and pinned Chromium.
- Independent terminal finding: a fresh final verifier returned
  `SOL_BLOCKED_FINAL_M02_W06_VERIFICATION` before substantive final
  verification or governance. On the affected exact content, test 30k passed
  with checked-in `PENDING_FINAL_INDEPENDENT_VERIFICATION`. In a disposable
  exact-content clone, changing only
  `m02_w06_package_verification_state` to
  `FINAL_INDEPENDENT_VERIFICATION_CLEAR` produced exactly one failure within
  the otherwise passing 81-test artifact-preimage file: test 30k still
  required pending. A full-history search found neither the final token nor an
  alternate lifecycle branch. Governance was prohibited from changing tests,
  so W06 could not move from IN_PROGRESS to VERIFIED while keeping the active
  suite green. No hidden owner case, expected truth, mapping, artifact
  preimage, or reviewed-manifest defect was implicated.
- Correction architecture: `docs/PROJECT_STATUS.md` remains the authoritative
  live package-state surface already parsed by status and traceability
  validation. Test 30k now reads exactly one canonical M02-W06 row and one
  M02-W07 row from that independent source. W06 IN_PROGRESS plus W07
  NOT_STARTED requires pending. W06 VERIFIED plus W07 READY requires the one
  model-neutral token `FINAL_INDEPENDENT_VERIFICATION_CLEAR`; later legitimate
  W07 IN_PROGRESS, BLOCKED, IMPLEMENTED, VERIFIED, or ACCEPTED states preserve
  final clear rather than recreating a lifecycle dead end. Every other
  relevant pair fails closed. All pre-existing owner availability, owner
  review, tooling correction, manifest digest, mapping-v2, public-corpus
  independence, placeholder prohibition, leak-absence, and future W14/W15
  ownership assertions remain active.
- Token meaning: `FINAL_INDEPENDENT_VERIFICATION_CLEAR` means, exactly, “The
  exact integrated M02-W06 content and preserved owner-controlled source
  bundle have received the required fresh independent final package
  verification.” It is package governance only. It does not mean M02 is
  accepted, Gate A was evaluated or passed, the holdout benchmark was
  executed, product Autofill Feasibility passed, or M02-W14/M02-W15 completed;
  it does not substitute for owner review, tooling verification, or the fresh
  verifier. The checked-in writer marker remains pending.
- Central enforcement: `scripts/validate_status.py` independently reads the
  machine status and cross-checks it against the canonical W06/W07 rows. It
  accepts the current IN_PROGRESS/NOT_STARTED/pending state and the immediate
  VERIFIED/READY/final-clear governance state, preserves final clear through
  legitimate later W07 states, and rejects invalid row pairs, missing or
  unknown tokens, and pending/final cross-wires. Final clear additionally
  requires exactly `OWNER_HOLDOUT_MANIFEST_AVAILABLE`,
  `OWNER_HOLDOUT_V2_REVIEW_CLEAR`, and
  `SOL_CLEAR_M02_W06_TOOLING_CORRECTIONS`. The check is error-only, so the
  canonical validator remains exactly 45 reported groups.
- Permanent controls: the current repository positive is asserted directly;
  one future governance fixture proves W06 VERIFIED / W07 READY / final clear
  while M02 remains IN_PROGRESS, release remains NOT_READY, and all four gates
  remain NOT_EVALUATED. Eight individually collected negative cases reject
  VERIFIED/READY plus pending, IN_PROGRESS/NOT_STARTED plus final clear,
  IN_PROGRESS/READY plus pending, final clear plus owner manifest unavailable,
  final clear plus owner review not clear, final clear plus tooling correction
  not clear, an unknown token, and a removed marker. The exact Python
  inventory was regenerated without weakening count or identity enforcement.
- Commands and observed results:
  - `pnpm install --frozen-lockfile`; `uv sync --locked`; both locked Cargo
    fetch commands → exit 0 with the pinned dependency graph unchanged.
  - Focused test 30k and the complete W06 suite → exit 0, 207/207 across six
    files: corpus-freeze 20, coverage-policy 28, holdout-boundary 45,
    artifact-preimage/runtime-preservation/reviewed-manifest 81, historical
    mutation campaign 15, and version/log/runner 18. The TypeScript total did
    not change.
  - Focused status tests → 157/157; strict Ruff and mypy checks → exit 0;
    `uv run pytest -q scripts/tests` → 985/985; canonical POSIX collection →
    986 exact IDs, with 984 common-and-Windows IDs and the two preserved
    POSIX-only IDs.
  - Preserved substantive suites → exit 0: W05 290, W04 171, W01 108, W02
    57, fixtures 166, mock ATS 32, Playwright 59, contracts 2440 / focused
    662 / generated 183 byte-identical, and Rust 1+10.
  - `python3 scripts/validate_status.py` → PASS, 45 groups;
    `pnpm traceability:check` → PASS, 193 requirements / 300 packages; doctor
    → 23 pass / 1 expected dirty-writer warning / 0 fail / 1 visual
    NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0: 3,313 TypeScript tests, canonical Python 986,
    all 16 ACTIVE suites PASS, status 45 groups, traceability PASS, and visual
    truthfully NOT_YET_APPLICABLE.
- Disposable future-governance simulation: an exact writer-tree clone was
  changed only on existing canonical governance surfaces to W06 VERIFIED at a
  synthetic tree anchor, W07 READY, current package NONE, final-clear, and
  KI-0055/KI-0056/KI-0057 FIXED. Traceability JSON was mirrored and its
  generated Markdown refreshed only inside the clone. M02 remained
  IN_PROGRESS, release remained NOT_READY, and all four gates remained
  NOT_EVALUATED. W06 207/207, status 45 groups, and traceability 193/300 passed
  immediately. The first deliberately broad aggregate found three Python
  regression-fixture assertions that still assumed the repository itself
  would forever be pending; production W06 and both governance validators had
  already passed. The fixtures were made bidirectional without changing test
  identities or counts. Focused status 157/157 and scripts Python 985/985 then
  passed in the simulated state, followed by a complete `pnpm verify` exit 0:
  all 16 ACTIVE suites PASS, canonical Python 986, W06 207, the preserved
  predecessor counts, Rust 1+10, status 45 groups, traceability PASS, and
  visual NOT_YET_APPLICABLE. This proves the future governance transition no
  longer requires implementation or test edits. The clone was moved to Trash;
  none of its governance bytes entered the writer checkout.
- Owner-bound non-regression: the one permitted read-only final-owner-root
  verification returned 14 cases, four case containers, 14 artifact
  preimages, 26,730 case bytes, 20,494 artifact bytes, and 47,224 total bytes.
  Manifest digest remained
  `sha256:a10ecd8f5eb4f930b056e6ed375627ef42055fece1c5ffb86ef198b1cebe5a79`
  and receipt digest remained
  `sha256:ae7aea1d4f8c7da588f6ca648de02680af507eba42858b75b3c71f4020192948`.
  Aggregate content fingerprint
  `f1561813d2924a78f1b8aed63e31be6f8fd5cc90e510659e13344117670b9159`
  and metadata fingerprint
  `600da2d6241bd527424fd4e9405943717f938959b46677e89cf97c53e63338df`
  were identical before and after. No hidden body was logged or copied.
- Scope and memory: KI-0057 is MEDIUM / IN_PROGRESS. KI-0055 remains HIGH /
  IN_PROGRESS and KI-0056 remains MEDIUM / IN_PROGRESS. M02-W06 remains
  IN_PROGRESS, M02-W07 remains NOT_STARTED, no package is READY, M02 remains
  IN_PROGRESS, all four critical gates remain NOT_EVALUATED, and release
  remains NOT_READY. No W07, W13, W14, W15, Gate A, holdout-execution, or
  governance work occurred. The sanitized manifest, status marker, owner
  semantics, traceability mappings/derivative, generated contracts, public
  corpus, critical-gate files, lockfiles, model lock, prompts registry, and
  CI workflow remain byte-identical. No hidden content entered Git.

### M02-W06 — Reviewed owner-manifest integration writer pass (2026-08-11)

- Revision: integration working tree over exact synchronized starting commit
  `b317705f1ca9f0db699162e97b37c5ca55527e62` / tree
  `8da3a523b0876d55370e3450f874a7b840e23aff` (parent
  `4bf08f8ddf8bd4452d6a7575fc3fd04f22540084`, branch `main`, initially
  equal to `origin/main`). Final integration commit/tree and exact-SHA hosted
  results are recorded in the writer handoff after the single forward-only
  push. Canonical JAPP-MASTER-001 v1.4 remains SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.12.13, Cargo/rustc 1.97.1, Playwright 1.62.0,
  and pinned Chromium.
- Prior independent inputs: corrected tooling at the exact starting content
  received `SOL_CLEAR_M02_W06_TOOLING_CORRECTIONS`. A fresh author then built
  a new external mapping-v2 owner bundle, and a separate independent owner
  reviewer returned `OWNER_HOLDOUT_V2_REVIEW_CLEAR`. This session was only the
  integration writer; it did not author or semantically review hidden truth.
- Owner authentication: before any repository write, the designated final
  root passed absolute/external/nonsymlink, owner-only-permission, exact closed
  inventory, mapping-v2-only, no-narrative-record, regular-file, and canonical
  direct-verifier checks. A separate byte-level recomputation validated every
  hidden case against the generated contract, rebuilt all four case-container
  commitments, authenticated all 14 artifact preimages, and independently
  rebuilt the sanitized manifest and private receipt. Results were 14 cases,
  category counts accessibility 2 / adversarial 3 / dynamic 3 / honeypot 2 /
  sensitive 2 / standard 2, four case containers, 14 artifact preimages,
  26,730 case bytes, 20,494 artifact bytes, and 47,224 combined bytes.
  Recomputed manifest digest was
  `sha256:a10ecd8f5eb4f930b056e6ed375627ef42055fece1c5ffb86ef198b1cebe5a79`;
  private receipt digest was
  `sha256:ae7aea1d4f8c7da588f6ca648de02680af507eba42858b75b3c71f4020192948`.
  The sanitized review record independently hashed to
  `sha256:9588f417e90d8d95f5486d25e850cb03a1d0beb936b46d75feac95b69f73414d`
  and exactly bound the mapping's review provenance and reviewed authoring
  commitment. No hidden identifier, body, answer, or private path was logged.
- Export and direct integration finding: the first exact documented
  repository-relative filtered-pnpm export failed safely before writing with
  `HOLDOUT_PATH_INVALID`, because the package script's current directory is
  the package rather than the repository. The smallest correction resolves a
  relative visible-manifest argument against the existing authoritative
  `REPOSITORY_ROOT`, while retaining the same exact allowed-directory,
  filename, file-type, symlink, and link-count confinement. A permanent
  regression covers the documented relative path. The exact export command
  and direct owner-bound verify then passed with all reviewed totals and exact
  manifest/receipt digests. Independent source-vs-export recomputation,
  public-v1 schema validation, self-digest validation, complete key allowlist,
  external/private path comparison, artifact-identifier comparison, and
  PII/secret-pattern review all passed.
- Status and memory transition: current machine truth is now
  `OWNER_HOLDOUT_MANIFEST_AVAILABLE`, `OWNER_HOLDOUT_V2_REVIEW_CLEAR`,
  `SOL_CLEAR_M02_W06_TOOLING_CORRECTIONS`, and
  `PENDING_FINAL_INDEPENDENT_VERIFICATION`, with manifest-digest binding and
  unchanged M02-W14/M02-W15 future ownership. Historical rejected-draft facts
  remain in memory rather than current blocker fields. KI-0055 remains HIGH /
  IN_PROGRESS; KI-0056 remains MEDIUM / IN_PROGRESS. Four stale requirement
  notes were narrowly refreshed without changing ownership, state, evidence
  paths, gate effects, or dependencies; the explicit reviewed v1.4
  requirement-mapping hash is now
  `0937bcc3e2626527094f6a9983e68380c64ac46b65d161162bfae7411a02ab5d`,
  and the generated 193-requirement / 300-package view is byte-consistent.
- Commands and observed results:
  - `pnpm install --frozen-lockfile`; `uv sync --locked`; both locked
    `cargo fetch --locked --manifest-path ...` commands → exit 0.
  - W06 typecheck, corpus, coverage, privacy, log, test, mutation, ESLint, and
    Prettier checks → final exit 0. The first lint pass found one unsafe
    untyped JSON assignment in the new schema test; it was narrowed to
    `unknown`, after which typed lint and formatting passed. Corpus and
    coverage digests remain
    `sha256:93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8`
    and
    `sha256:c6795388ba2e11fc70dc51e471ffb59e510d6ffaa59c2f1dff196f555522344a`.
  - Preserved predecessors → exit 0: W05 typecheck/check/test 290/290; W04
    typecheck/check/test 171/171; W01 108/108; W02 57/57; full fixtures
    166/166; mock ATS typecheck/test/build 32/32; Playwright list and run
    59/59 across 17 files.
  - Focused Python suites → exit 0: integrity 43, suite states 294,
    proofs/real-repo 7, traceability 62, v1.4 migration 31, status 148; full
    `uv run pytest -q scripts/tests` → 976/976.
  - `python3 scripts/validate_status.py` → PASS, 45 groups;
    `pnpm traceability:check` → PASS, 193 requirements / 300 packages;
    `pnpm generate:contracts --check` → 183 files byte-identical; doctor →
    23 pass / 1 expected dirty-writer warning / 0 fail / 1 visual
    NOT_YET_APPLICABLE.
  - `pnpm verify` → exit 0: 3,313/3,313 TypeScript unit tests, contracts
    2440 / focused 662, W06 207, W05 290, W04 171, W01 108, W02 57,
    fixtures 166, mock ATS 32, Playwright 59, generated contracts 183
    byte-identical, canonical Python inventory 977/977, Rust 1+10,
    portability/integrity/status/traceability PASS, all 16 ACTIVE suites
    PASS, and visual truthfully NOT_YET_APPLICABLE.
  - Final read-only sequence → exit 0 twice owner-bound with identical
    reviewed totals/digests, then W06 207, mutations 15, ESLint, Prettier,
    status 45 groups, traceability 193/300, contracts 183 byte-identical,
    sanitized schema/self-digest/status binding, and `git diff --check`.
    Before/after repository-byte SHA-256 was identically
    `dc547cf953dcba10727be1d9ea0a34c3eb7747e86f0c8a5723bbcc066927d408`;
    before/after porcelain SHA-256 was identically
    `9c8d4dbd74b9d1a56272c163c018a4997e412ff493dd581c2840da3b526aed61`;
    before/after tracked-diff SHA-256 was identically
    `ed8d5dfe93f955fad9b0628de757b9795787985f72feeabc7bb526daf186ec63`.
    The final owner-root metadata/content fingerprint also remained identical
    before/after, and the sanitized review-record digest remained exact.
- Test counts: W06 207/207 (corpus-freeze 20, coverage-policy 28,
  holdout-boundary 45, artifact-preimage/runtime-preservation/reviewed-
  manifest 81, mutation-campaign 15, version/log/runner 18). The predecessor
  194-test layer and every historical mutation meaning remain intact. The
  obsolete one-test absence assertion was replaced by 13 fail-closed
  current-state tests for exact manifest inventory, public contract,
  self-digest, counts, top-level allowlist, leak absence, exact status/digest
  binding, and future owners; one direct repository-relative path regression
  raises the total to 207. The historical campaign remains exactly 15/15.
- Bounded repository-only review: one read-only reviewer independently passed
  manifest schema/self-digest/leak controls, lifecycle/status consistency,
  test discovery/split, and export confinement. It identified an omitted
  preserved privacy test in the registry prose and stale hash-locked
  traceability notes; both were corrected through the canonical explicit
  re-lock/regeneration path. Its final bounded recheck returned PASS with no
  remaining actionable issue. The reviewer did not edit, access owner
  evidence, commit, push, or issue package acceptance.
- Artifacts: sanitized public manifest
  `benchmarks/holdout-manifests/m02-autofill-v1.manifest.json` and its
  machine-readable status only. Private executable bytes and sanitized review
  support remain external and preserved. No holdout execution-log row was
  added because M02-W14 did not run.
- Notes: exact-SHA three-OS hosted CI remains to be completed after the single
  forward-only push. M02-W06 remains IN_PROGRESS and unaccepted; M02-W07
  remains NOT_STARTED; no package is READY; W13/W14/W15 did not begin; no gate
  was evaluated; release remains NOT_READY.

### M02-W06 — Historical v1 runtime-preservation corrective writer pass (2026-08-11)

- Revision: corrective working tree over exact independently blocked content
  commit `4bf08f8ddf8bd4452d6a7575fc3fd04f22540084` / tree
  `ff63971ac29e0b187c582d1d4df822a70aa4f7e7` (parent
  `b6ca109519940058ac222ce7d95a3d92a5b2b607`, branch `main`, initially
  equal to `origin/main`). Canonical JAPP-MASTER-001 v1.4 SHA-256 remains
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.12.13, Cargo/rustc 1.97.1, and Chromium 1.62.0.
- Independent finding: fresh Sol tooling verification returned
  `SOL_BLOCKED_M02_W06_ARTIFACT_PREIMAGE_CORRECTION` at the exact starting
  content. A16 found that mapping v2's exact-prefix stable-ID helper had been
  reused by `validateOwnerMappingV1`, narrowing historical v1 runtime
  compatibility. Before stopping on A16, the verifier independently
  reproduced KI-0055 and passed a clean synthetic 3-case / 2-container /
  3-preimage v2 control, cross-binding, closed-inventory, filesystem, BigInt
  identity, Windows-root-relation, sanitized-export, exported-manifest
  source-authority, and safe-diagnostic checks. Those partial checks are not
  final KI-0055 acceptance.
- Exact reproduction: the writer and one bounded read-only reviewer each used
  separate fresh no-hardlink disposable clones at historical commit
  `3d8b18ccc86109a2b6a3bb3cc3ae6d16f5ced9f9` and affected commit `4bf08f8`,
  with synthetic mappings only. Historical `validateOwnerMapping` accepted
  `manifest_acme_00000000000000000000000001`; affected
  `validateOwnerMappingV1` rejected it. The same split occurred independently
  for manifest, case, file, creation-source, and review-source IDs, including
  empty and repeated-underscore extensions and the maximum 24-character stem.
  Canonical IDs passed both; 25-character stems, wrong prefixes, uppercase
  extensions, missing final separators, 25/27-character bodies, and bodies
  containing excluded Crockford letters failed both. A complete mapping with
  all five IDs extended also passed historical v1 and failed affected v1.
- Correction architecture: v1 now selects a literal copy of the historical
  whole-ID regex
  `^[a-z][a-z0-9_]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$` plus the separate required
  prefix check. V2 retains exact `prefix_` plus one 26-character Crockford
  suffix. The selected policy is injected through mapping-core and provenance
  validation, so all five v1 roles are historical while all five v2 roles and
  v2-only artifact refs remain strict. Sanitized public-manifest validation
  also remains strict. This deliberately preserves the pre-existing v1
  runtime/schema distinction; it does not broaden mapping v2.
- Commands and observed results:
  - `pnpm install --frozen-lockfile`; `uv sync --locked`; both locked
    `cargo fetch --locked --manifest-path ...` commands → exit 0.
  - The complete W06 command set (typecheck, corpus, coverage, privacy, log,
    test, mutations, ESLint, and Prettier) ran twice → exit 0 both times.
    Each run was 194/194 across six files plus the historical campaign exactly
    15/15. Before/after tracked-diff SHA-256 was identically
    `6098be4609969c3f50ccc44d7c40aead1e280ae65ad455880b332582b06d189e`;
    before/after porcelain-status SHA-256 was identically
    `41dce79179887f1ca5bdfbe51fc00ad3799d6a6ba6f7179c3f7828079b75c563`,
    proving the checks read-only at that correction state.
  - Preserved predecessors → exit 0: W05 typecheck/check/test 290/290; W04
    171/171; W01 108/108; W02 57/57; full fixtures 166/166; mock ATS
    typecheck/test/build 32/32; Playwright 59/59 across 17 files.
  - Focused Python suites → exit 0: integrity 43, suite states 294,
    proofs/real-repo 7, traceability 62, v1.4 migration 31, status 148; full
    `uv run pytest -q scripts/tests` → 976/976.
  - `python3 scripts/validate_status.py` → PASS, 45 groups;
    `pnpm traceability:check` → PASS, 193 requirements / 300 packages;
    `pnpm generate:contracts --check` → 183 files byte-identical; doctor →
    23 pass / 1 expected dirty-writer warning / 0 fail / 1 visual
    NOT_YET_APPLICABLE.
  - The first `pnpm verify` execution passed every substantive suite, including
    contracts 2440 / focused 662, Python 977, and Rust 1+10, then correctly
    failed the evaluation-corpus discovery proof because its registry still
    required the pre-correction exact total 163. The registry expectation was
    narrowly updated to 194. The complete rerun then exited 0: 3,300/3,300
    TypeScript tests, contracts 2440 / focused 662, generated contracts 183
    byte-identical, W01 108, W02 57, W06 194, Playwright 59, Python 977, Rust
    1+10, status 45 groups, traceability 193/300, portability and integrity
    PASS, all 16 ACTIVE suites PASS, and visual truthfully
    NOT_YET_APPLICABLE.
- Test counts: W06 194/194 (corpus-freeze 20, coverage-policy 28,
  holdout-boundary 44, artifact-preimage/runtime-preservation correction 69,
  mutation-campaign 15, version-log-runner 18); 31 substantive differential
  tests were added to the correction file. They cover canonical and extended
  IDs across all five historical v1 roles, whole-mapping compatibility,
  accepted and rejected stem/body/prefix boundaries, the explicit v1
  schema/runtime distinction, v1-only final-execution refusal, strict v2
  rejection across manifest/case/file/artifact/source/review, representative
  v2 runtime/schema agreement, and the clean artifact-backed v2 positive.
  No existing test or historical mutation was removed or weakened.
- Byte preservation: `owner-mapping.v1.schema.json` remains SHA-256
  `04361a9abecded3b6a1545df144149f796ea52790b3f65fb872ad09a3b5b8d4b`;
  `owner-mapping.v2.schema.json`, both holdout policies, the public
  holdout-manifest schema, generated contracts, public corpus commitments,
  lockfiles, BigInt Windows identity logic, and Windows cross-volume logic
  were not changed. No traceability regeneration was required because the
  permanent compatibility controls extend an already registered test path.
- Notes: KI-0055 remains HIGH / IN_PROGRESS and KI-0056 remains MEDIUM /
  IN_PROGRESS pending completely fresh independent verification. M02-W06
  remains IN_PROGRESS and unaccepted; M02-W07 is NOT_STARTED; no package is
  READY; W13/W14/W15 did not begin; no gate was evaluated; release remains
  NOT_READY. No genuine owner root/draft was read or modified, no owner bundle
  was rebuilt, no real manifest was exported, and no hidden owner content
  entered Git.

### M02-W06 — Artifact-preimage corrective writer pass (2026-08-10)

- Revision: corrective working tree over exact blocked content commit
  `3d8b18ccc86109a2b6a3bb3cc3ae6d16f5ced9f9` / tree
  `383fdd61fbebc61ec346734b02a7dba62af1e8b2` (parent
  `d3626e813424414621ad59c5053b50f53ed9d454`). Canonical JAPP-MASTER-001
  v1.4 SHA-256 remains
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  Final correction commit/tree and exact-SHA hosted results are recorded in
  the writer handoff after the forward-only push.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv 0.11.32, Python 3.12.13, Cargo/rustc 1.97.1, and Chromium 1.62.0.
- Independent-review finding and reproduction: fresh owner-controlled review
  returned `OWNER_HOLDOUT_REVIEW_BLOCKED` /
  `INPUT_ARTIFACT_PREIMAGE_UNAVAILABLE` for 11/11 hidden cases. A disposable
  synthetic root independently reproduced the defect without owner data: the
  prior verifier accepted a valid hidden `BenchmarkCaseV1` container whose
  declared artifact digest had no preimage bytes anywhere in the closed v1
  inventory. The failed owner draft remained external and untouched; no
  hidden value or case was disclosed and the reviewer made no repository
  mutation.
- Correction architecture: historical `owner-mapping:v1` and
  `holdout-boundary.v1` are byte-preserved. Private `owner-mapping:v2` adds a
  sorted exact `artifacts[{artifact_ref,relative_path}]` inventory. The
  verifier validates hidden-case identity/classification, builds the unique
  authoritative ref→digest/schema set, rejects missing/extra/conflicting
  mappings, safely reads every opaque preimage, recomputes SHA-256 over exact
  bytes, rejects path/inode/inventory/race violations, and returns private
  snapshot/receipt v2 with separate case-file/artifact counts and bytes. The
  public sanitized manifest remains `benchmark/holdout-manifest:v1` and
  contains case-container commitments only.
- Commands and observed results:
  - `pnpm install --frozen-lockfile`; `uv sync --locked`; both locked
    `cargo fetch --locked --manifest-path ...` commands → exit 0.
  - W06 typecheck, `corpus:check`, `coverage:check`, `privacy:check`, and
    `log:check` → exit 0; corpus digest remains
    `sha256:93c8aae9c74ca7802c7a2469bb561c314e2d585a4f81001ed7db2739da4bedf8`
    and coverage digest remains
    `sha256:c6795388ba2e11fc70dc51e471ffb59e510d6ffaa59c2f1dff196f555522344a`.
  - `pnpm --filter @japp/evaluation-corpus test` → exit 0, 163/163 across
    six files; correction-specific suite 38/38. `mutations:check` → exit 0,
    historical campaign exactly 15/15 with original meanings.
  - W05 typecheck/check/test → exit 0, 290/290; W04 typecheck/check/test →
    exit 0, 171/171; W01 108/108; W02 57/57; full fixtures 166/166; mock ATS
    32/32; Playwright 59/59 across 17 files.
  - `pnpm generate:contracts --check` → exit 0, 183 generated files
    byte-identical; focused contracts 662/662 and full contracts 2440/2440.
  - Required focused Python commands → exit 0: integrity 43, suite states
    294, proofs/real-repo 7, traceability 62, v1.4 migration 31, status 148;
    `uv run pytest -q scripts/tests` → 976/976. The canonical root inventory
    additionally includes `services/orchestrator/tests/test_package.py` and
    passes 977/977.
  - Native Rust 1/1 and contract-harness Rust 10/10 → exit 0.
  - `python3 scripts/validate_status.py` and `pnpm traceability:check` → exit
    0, 45 status check groups and 193 requirements / 300 work packages.
  - `pnpm run doctor` → 23 pass, 0 fail, one expected dirty-writer warning,
    visual NOT_YET_APPLICABLE; `pnpm verify` → exit 0 with all 16 ACTIVE
    suites PASS and visual NOT_YET_APPLICABLE.
- Test counts: W06 163/163 (corpus-freeze 20, coverage-policy 28,
  holdout-boundary 44, artifact-preimage correction 38, mutation-campaign 15,
  version-log-runner 18); no skipped/todo/pending tests. The correction suite
  covers every mandated v1 rejection, v2 clean path, missing/extra/conflicting
  binding, digest/ref mutation, reuse policy, storage/path/closed-inventory
  defense, receipt truth, non-leak, exported-manifest re-verification, v1/public
  schema preservation, Windows cross-volume semantics, and truthful manifest
  absence. The historical mutant names remain DEVELOPMENT_FILE_TAMPER,
  EXPECTED_RESULT_TAMPER, CASE_ID_REPLACEMENT, CORPUS_DIGEST_BYPASS,
  COVERAGE_COUNT_DRIFT, SAME_VERSION_SEMANTIC_REWRITE,
  HIDDEN_EXPECTED_OUTPUT_LEAK, HOLDOUT_CASE_COUNT_DRIFT,
  HOLDOUT_MANIFEST_DIGEST_BYPASS, OWNER_PATH_TRAVERSAL,
  OWNER_SYMLINK_ESCAPE, APPEND_ONLY_ROW_MUTATION,
  HISTORICAL_EXPECTATION_OVERWRITE, VERSION_BUMP_BYPASS, and
  GATE_AUTHORITY_INJECTION.
- Byte preservation: before/after hashes remain corpus manifest
  `b162839ac5cc2654cc6c83c05c25ba91233722861dcf6c06749e6a0e036c6644`,
  coverage `7096f3e9990c8df59d09a5126552791c281f2523ae8658c6695291311e0abc99`,
  version index `d5bc4d2d2bce5e5fbbe61b0db480cf6d5978a109799e14c76e9e7568321ec0f9`,
  owner-mapping v1
  `04361a9abecded3b6a1545df144149f796ea52790b3f65fb872ad09a3b5b8d4b`,
  boundary policy v1
  `c1937caaa91f6cc04cc4ddf79356f5b3679f27eb09f77f4d648d350bbb357e96`,
  and public holdout-manifest schema v1
  `139441d5b1bbcd44b35dafe8103d671825b6e9cfb79008a3dfd94d9b4927c738`;
  benchmark case schema v1 remains
  `83122bef37c57220caf3467e2ba915a436111ac478817ecc9ddf414503ee9d53`
  and generated-contract manifest remains
  `57d08eab5f18b6afe8a70a52ff0ad4a2c3e496d3620508392701076c3b04e31d`.
- Notes: KI-0055 remains HIGH / IN_PROGRESS pending fresh independent tooling
  verification. No genuine owner manifest is available, no placeholder or
  hidden body/artifact/expected truth entered Git, W06 remains IN_PROGRESS and
  unaccepted, W07 is NOT_STARTED, no package is READY, W13/W14/W15 did not
  begin, no gate was evaluated, and release remains NOT_READY.

### M02-W05 — Governance closeout after final independent Fable verification (2026-08-10)

- Revision: exact verified content commit
  `b27b192aa18c86da180badc43b5f32efe96d88ab` / tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc` (parent
  `fdf7bdaa0488179bff1d0aa9d78e7c1787d25090`, branch `main`, HEAD equal to
  `origin/main`, clean writer checkout, canonical JAPP-MASTER-001 v1.4 spec
  SHA-256 `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`).
  Verifier: owner-selected Fable 5 Ultra Code in a genuinely fresh
  independent session that authored no M02-W05 content revision; every prior
  Codex/Sol/Fable report was treated strictly as a claim and independently
  reproduced; one authoritative lead verifier personally reproduced every
  acceptance-critical result, with bounded read-only Fable 5 reviewers used
  only for document reading (no edits, no verdicts). Verdict:
  `FABLE_CLEAR_FOR_FINAL_M02_W05_GOVERNANCE`, followed by this
  governance-only closeout in the same session.
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv-managed Python 3.12.13, Rust via pinned rustup toolchain; all
  independent execution in a fresh disposable no-hardlinks system-temp clone
  detached at the exact SHA with `pnpm install --frozen-lockfile`,
  `uv sync --locked`, `pnpm exec playwright install chromium`, and both
  `cargo fetch --locked` manifests → exit 0; all mutation probes in separate
  fresh disposable clones; the writer checkout was never modified during
  Stage A.
- Final correction diff review: exactly one forward-only commit
  `fdf7bda -> b27b192` touching the expected 14-file surface; no dependency,
  lockfile, schema, generated-contract, fixture-body, W04-semantic,
  model-lock, prompt-registry, CI-workflow, toolchain-pin, or gate-report
  byte changed (per-path `git diff` sweeps all empty); the runner
  `package.json` change is description-only.
- KI-0053 independent closure: a standalone Python integer reference
  (iterative per-year leap accumulation, explicit month lengths, no
  `datetime`, no Date API, written outside repository bytes) independently
  established year 0000/0004/0400/2000 leap and 0001/0100/1900 common;
  canonical accepted timestamp text was determined exclusively through the
  generated `validateCommonTimestampUtcV1UtcTimestamp` (26-case matrix:
  proleptic low-year instants, century rejections `0100-02-29`/`1900-02-29`,
  strict-form rejections including lowercase `z`, `+02:00`, hour 24,
  month 13, ten-digit fraction; plus all 10,000 February-29 decisions across
  0000–9999 agreeing with the reference leap rule). The W05 projection
  matched the reference on all 33 mandatory/representative instants
  (including `0000-01-01T00:00:00Z` = −62167219200000 and fractional
  `.1`/`.12`/`.123456789` truncation) and on a complete-domain sweep of
  every calendar day 0000-01-01 through 9999-12-31: 3,652,425 comparisons,
  byte-identical SHA-256 digests
  (`ce63efc23507fcc0698d8134962ffd51a7de62ccaeaf7c1bf088905fc7fdde09`),
  zero mismatches, domain minimum −62167219200000 ms and maximum
  253402300800999 ms both inside ±(2^53−1). Mandatory duration cases:
  `0000-01-01` +1 s = 1000 ms; `0000-02-28 -> 02-29` and
  `0000-02-29 -> 03-01` = 86400000 ms; the contract-valid 36-hour window
  `0000-02-29T00:00:00Z -> 0000-03-01T12:00:00Z` (reference 129600000 ms)
  rejects `RUNNER_CLOCK_DURATION` in `deriveDurationMilliseconds` and end to
  end through `runEvaluation`, and a falsified 43200000 ms result cannot
  survive replay (projection edit rejects
  `RUNNER_REPORT_CASE_DERIVATION`; witness edit rejects
  `RUNNER_CLOCK_DURATION`); `0099-12-31T23:59:59Z -> 0100-01-01T00:00:00Z`
  derives exactly 1000 ms through execution, canonical `BenchmarkResultV1`,
  report build, replay, and render; representative boundaries at
  0100/0400/1900/2000/9999 all exact.
- Leap-second and fractional preservation: `2026-06-30T23:59:59Z -> :60Z`
  = 1000 ms and `:60Z -> 2026-07-01T00:00:00Z` = 0 ms end to end with replay
  agreement under the documented leap-table-free Unix-style projection; the
  contract accepts second 60 only at 23:59 (independently probed at other
  minutes); fractional low-year runs are deterministic across repeated
  executions; no leap-second table, external time database, network path, or
  environmental timezone dependency exists in runner source.
- No JavaScript Date semantic authority: zero `Date.UTC`, `Date.parse`,
  `new Date`, `setUTCFullYear`, or Date-constructor projection paths in
  `packages/evaluation-runner/src/` (lead grep plus complete-source reviewer
  read); the static governance ban in `governance-layering.test.ts` covers
  `Date.UTC|Date.parse` and `Date.now|new Date(`. Recorded observation: the
  static scan is a flat `readdirSync` of `src/`, which truthfully covers the
  current flat source tree and fails loud (read error) if a subdirectory
  ever appears — not acceptance-blocking.
- KI-0054 independent closure: at governance parent `5f8af91` the invariant
  required the exact `NON_PRODUCTION` token for the single reviewed
  consumer; the final content restores that exact token assertion for BOTH
  reviewed consumers (`packages/evaluation-baselines`,
  `packages/evaluation-runner`: exact name, `private === true`, description
  containing exact `NON_PRODUCTION`, retained lowercase `evaluation` check)
  without removing W05's legitimate second consumer; the runner manifest
  truthfully declares `EVALUATION_ONLY`/`NON_PRODUCTION`/never critical-gate
  authority with no version, dependency, or lockfile change; focused
  `test/m02-w01/governance-discovery.test.ts` → 7/7.
- KI-0048…KI-0052 re-reproduction on the final content (independent probe
  through the real API, not the test suite): FAIL→PASS coordinated
  projection mutation rejects `RUNNER_REPORT_DERIVATION_MISMATCH`; holdout
  relabels reject at projection and witness levels; provenance/runtime
  replacement rejects; raw-observation mutation under old identities rejects
  `RUNNER_REPORT_REPLAY_MISMATCH`; a legitimate semantic change yields new
  observation/record/execution identities and validates. Foreign-execution
  candidate rejects `RUNNER_REGRESSION_CANDIDATE_SOURCE`; candidate
  value/selector/raw-count tampers reject
  (`RUNNER_REGRESSION_DERIVATION`/`RUNNER_REGRESSION_CANDIDATE_SOURCE`/
  `RUNNER_REGRESSION_RAW_RATE_MISMATCH`); corpus-mismatch relabel rejects;
  reference and compatibility payload tampers reject
  `RUNNER_REGRESSION_REFERENCE_TAMPER`; clean compatible and clean
  incompatible comparisons behave correctly. FAILED_SETUP yields
  `metrics=[]`, `artifact_observations=[]`, `paired_counts=[]`, visible
  `BENCHMARK_INCOMPLETE_RUN`, no precision/recall, no canonical result, and
  overall INVALID. Strict calendar validation rejects `2026-02-30`,
  `2025-02-29`, `2026-04-31`, month 13, hour 24, lowercase `z`, and non-Z
  offsets end to end (`RUNNER_CLOCK_TIMESTAMP`) while accepting ordinary
  UTC, leap day 2024, 1–9 fractional digits, and end-of-day second 60.
  32 caller limitations → exactly 35 report limitations
  (validates/renders/replays); 33 → `RUNNER_LIMITATION_COUNT`;
  deletion/replacement/reordering of derived fixed limitations rejects
  `RUNNER_REPORT_REPLAY_MISMATCH`.
- Replay/regression architecture and statistics: the single canonical replay
  witness, request/observation-digest rederivation, record/result/execution
  identity rederivation, report-equals-reconstruction, execution-bound
  candidate resolution, immutable reference digest, compatibility
  rederivation, and zero gate authority were confirmed by complete source
  reads plus the probes above. Independent reference calculations matched
  exactly: Wilson-95 bounds for 2/3, 4/5, 4/6, 1/1 byte-identical to a
  standalone z=1.959963984540054 computation (0/0 → NO_OBSERVATIONS);
  exact-decimal thresholds discriminate `0.1+0.2` from `0.3` under EXACT and
  hold AT_LEAST/AT_MOST boundaries for BYTES/COUNT/MILLISECONDS/RATIO/SCORE;
  pooled proportions micro-pool (3/4 + 1/2 → 4/6) and value/count mismatches
  reject; zero-tolerance failures are integer counts; paired
  precision/recall reports raw numerators/denominators with matching Wilson
  bounds; regression deltas are exact decimal text (`-0.01`, presentation
  `-0.0125`) with correct boundary pass/fail; hostile titles/limitations are
  escaped in HTML with deterministic JSON/Markdown/HTML; conditional
  model/browser/prompt provenance is enforced fail-closed
  (`RUNNER_MODEL_PROVENANCE`/`RUNNER_MODEL_METADATA_PAIR` observed).
- Traceability honesty: REQ-GATE-006 remains SCAFFOLD_ONLY /
  NOT_YET_APPLICABLE with the refreshed correction anchors
  (`src/derive.ts`, `src/time.ts`, `replay-source`, `regression-source`,
  `measurement-boundaries` test paths); reviewed v1.4 mapping hash
  `89db8aaa…` and unchanged dependency hash `ea991a04…` verified in JSON and
  generated view; package census at verification time was exactly one
  IN_PROGRESS (M02-W05), zero READY; ownership and gate effects unchanged;
  no requirement promoted because W05 infrastructure exists.
- Historical mutation campaign: `test/m02-w05/mutations.test.ts` is
  byte-identical since `383ae57` (empty `git diff` across all three W05
  revisions) and passed exactly 18/18.
- Twelve final independent mutation families, each in a fresh disposable
  clone with its detector run green before the exact semantic edit and
  rerun after (command → focused `vitest run` of the named detector; exit 0
  control, exit 1 mutated; relevant failing tests inspected):
  1. YEAR_0_TO_1900_REMAP (numeric year 0–99 → +1900 remap in `time.ts`) →
     measurement-boundaries, 6 relevant failures including the literal
     anchors and complete-domain reference;
  2. YEAR_ZERO_LEAP_REMOVAL (year 0 common) → 4 failures including
     `0000-02-29 -> 03-01` and the 36-hour control;
  3. CENTURY_RULE_DRIFT (every %4 year leap) → 4 failures including the
     0100/1900 boundary rows;
  4. LOW_YEAR_CROSSING_DRIFT (+1 day for years ≥ 100) → 4 failures
     including the `0099 -> 0100` 1000-ms row;
  5. DURATION_TRUE_VALUE_BYPASS (clamp duration to ≤ 86400000) → exactly
     the end-to-end 36-hour rejection control;
  6. LEAP_SECOND_MAPPING_DRIFT (second 60 capped to 59) → 3 leap-second
     failures including the year-end next-minute control;
  7. NON_PRODUCTION_ASSERTION_WEAKENING (baselines description token →
     generic words) → governance-discovery rejects on the exact
     `to contain 'NON_PRODUCTION'` assertion;
  8. RUNNER_CLASSIFICATION_DRIFT (runner description token removed) →
     BOTH governance-discovery and W05 governance-layering reject;
  9. REPLAY_SOURCE_DRIFT (final derived-vs-serialized comparison
     tautologized in `report.ts`) → replay-source rejects (4 failures:
     FAIL→PASS, holdout relabel, provenance replacement,
     observation-source change);
  10. FOREIGN_REGRESSION_CANDIDATE (per-comparison reconstruction
      tautologized) → regression-source rejects (4 failures including
      candidate bound to an unrelated execution);
  11. FAILED_SETUP_MEASUREMENT_REINTRODUCTION (direct validation boundary
      disabled) → measurement-boundaries rejects (raw-boundary and
      witness-forgery controls; the aggregate-layer invariant still
      fires independently);
  12. LIMITATION_SOURCE_DRIFT (`MAX_USER_LIMITATIONS` 32 → 33) →
      measurement-boundaries shared-constants binding rejects.
  No thirteenth family was added after all twelve rejected.
- Complete clean execution (disposable clone at the exact SHA):
  - `pnpm --filter @japp/evaluation-runner typecheck` → exit 0; two
    `runner:check` runs → deterministic JSON/Markdown/HTML PASS twice with
    byte-identical empty `git status --porcelain=v1 -uall` hashes before,
    between, and after (read-only proof); `pnpm exec eslint
    packages/evaluation-runner` and `pnpm exec prettier --check
    packages/evaluation-runner` → exit 0.
  - W05 Vitest 290/290 across 12 files: aggregation-statistics 24,
    governance-layering 6, measurement-boundaries 63, mutations 18,
    regression-source 16, regression 22, replay-source 11, reports 22,
    runner 27, thresholds 32, validation-boundaries 48, w04-integration 1.
  - W04 typecheck/`baselines:check`/test → 171/171 across 9 files with
    combined digest
    `sha256:71c41a754e997998328535670095debb4c068576f788863cd3a458fe31996cc5`
    unchanged; focused W01 → 108/108; focused W02 → 57/57; full fixtures →
    166/166; mock lab typecheck/test/build → 32/32 and build success;
    `pnpm exec playwright test --list` → 59 tests in 17 files;
    `pnpm exec playwright test` → 59/59.
  - Focused Python: test_integrity 43, test_suite_states 294,
    test_proofs_and_real_repo 7, test_traceability 62, test_v14_migration
    31, test_validate_status 148; full `uv run pytest -q scripts/tests` →
    976/976. `python3 scripts/validate_status.py` → PASS (45 check groups);
    `pnpm traceability:check` → PASS (193 requirements / 300 packages);
    `pnpm generate:contracts --check` → 183 byte-identical; `pnpm run
    doctor` → 23 pass / 0 warning / 0 fail / 1 not-yet-applicable; full
    `pnpm verify` → exit 0 with 15 workspace projects, 12/12 typecheck and
    12/12 test Turbo tasks, 3,106 TypeScript tests (contracts 2440, runner
    290, baselines 171, fixtures 166, mock lab 32, seven scaffold packages
    1 each), focused contracts 662, every ACTIVE suite PASS, visual
    truthfully NOT_YET_APPLICABLE, and no nonordinary outcome;
    `git diff --check` and `git status --short` → clean.
- Hosted final content evidence: push run `31355141330` at exact head SHA
  `b27b192aa18c86da180badc43b5f32efe96d88ab`, successful on ubuntu-24.04
  job `93353321052`, macos-15 job `93353321082`, and windows-2025 job
  `93353321075`. Raw logs confirm the dedicated exact-revision checkout
  step, frozen pnpm, locked uv, both locked cargo fetches, doctor
  23/0/0/1-NYA, W05 290, W04 171, W01 108, W02 57, fixtures 166, mock 32,
  Playwright 59 in 17 files, contracts 2440, focused 662, generated 183
  byte-identical, Python 977 POSIX / 975 Windows, Rust 1+10, status 45
  groups, traceability ACTIVE PASS, every ACTIVE suite PASS, visual
  NOT_YET_APPLICABLE, `verification exit code: 0`, and the fail-closed
  tracked-cleanliness assertion. The ENTIRE windows-2025 raw log
  (3,087 lines) was inspected and fully classified into its 27 expected
  steps; the only warnings are a benign uv hardlink-performance fallback
  and a NO_COLOR/FORCE_COLOR notice; no relevant EPERM or command failure.
- Governance transitions applied after the clear verdict (this closeout):
  M02-W05 IN_PROGRESS → VERIFIED at tree
  `40bbe111a4f80702c1fdd98b576534f1284873fc`; M02-W06 NOT_STARTED → READY
  (sole READY package, not begun); current work package NONE; KI-0048
  through KI-0054 → FIXED with complete histories preserved. M02-W05 is
  VERIFIED, not ACCEPTED; M02 remains IN_PROGRESS; M00/M01 remain ACCEPTED;
  M02-W01…W04 remain VERIFIED; REQ-GATE-006 remains SCAFFOLD_ONLY /
  NOT_YET_APPLICABLE; all four critical gates remain NOT_EVALUATED; release
  remains NOT_READY. No W06 corpus/holdout was created, no W13 harness
  implemented, no W14 evaluation run, no W15 decision made, and no critical
  gate evaluated. Only the five governance files changed in this closeout
  commit.

### M02-W05 — Proleptic-UTC corrective writer pass (2026-08-09)

- Revision: second corrective working tree over exact corrected M02-W05
  content commit `fdf7bdaa0488179bff1d0aa9d78e7c1787d25090` / tree
  `554bdc075967a2667cc37379465f06e931af1b21` (parent
  `383ae578512910b17d98aee30e1f24531fa746c8`); the containing correction
  commit and tree are reported post-commit. The fresh independent Fable 5
  acceptance verification of `fdf7bda` returned
  `FABLE_BLOCKED_M02_W05_GOVERNANCE` (2026-08-09): it independently closed
  the five KI-0048…KI-0052 defect classes and accepted the documented
  leap-table-free leap-second projection, but found the low-year UTC
  projection acceptance-blocking (KI-0053) and a W05-caused dilution of the
  M02-W01 NON_PRODUCTION fixture-consumer assertion (KI-0054).
  Owner-selected corrective implementation agent: Fable 5 Ultra Code
  (single authoritative writer; no automatic model switching; bounded
  read-only Fable 5 reviewers only; the writer personally reproduced every
  acceptance-critical result).
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv-managed Python 3.12.13, uv 0.11.32, Rust 1.97.1; frozen/locked
  installs (`pnpm install --frozen-lockfile`, `uv sync --locked`, both
  `cargo fetch --locked` manifests) → exit 0.
- Pre-fix reproductions on the exact corrected `fdf7bda` content
  (temporary scripts outside the repository; no repository bytes changed):
  (1) canonical contract truth determined exclusively through
  `validateCommonTimestampUtcV1UtcTimestamp`: years 0000–0099 accepted;
  `0000-02-29`, `0004-02-29`, `0400-02-29`, `2000-02-29` valid;
  `0001-02-29`, `0100-02-29`, `1900-02-29` invalid; `0099-12-31T23:59:59Z`,
  `0100-01-01T00:00:00Z`, `9999-12-31T23:59:59Z`, and the `23:59:60Z`
  leap-second forms valid. (2) through the real `runEvaluation` →
  canonical `BenchmarkResultV1` → `buildRunReport` →
  `validateRunReport`/render path, the contract-valid 36-hour window
  `0000-02-29T00:00:00Z -> 0000-03-01T12:00:00Z` was ACCEPTED as
  `duration_ms` 43200000 (canonical result issued, report validated and
  rendered), because `Date.UTC` projected `0000-02-29` to −2203891200000
  (1900-03-01 after the nonexistent 1900-02-29 rolled forward); the
  contract-valid 1000 ms window
  `0099-12-31T23:59:59Z -> 0100-01-01T00:00:00Z` was REJECTED
  (`RUNNER_CLOCK_DURATION`) because 0099 projected into 1999
  (946684799000) against a correctly projected 0100 (−59011459200000);
  and the year-zero control `0000-01-01T00:00:00Z -> +1 s` returned
  1000 ms only by offset cancellation while projecting to −2208988800000
  (1900-01-01) instead of −62167219200000. (3) a standalone
  pure-integer reference (Python, no datetime/Date API, per-year
  iterative leap counting) confirmed the true values: 36-hour window
  129600000 ms; `0099 -> 0100` 1000 ms; anchors
  `0000-01-01T00:00:00Z` = −62167219200000,
  `0001-01-01T00:00:00Z` = −62135596800000, `1970-01-01` = 0,
  `2000-02-29` = 951782400000, `9999-12-31T23:59:59Z` = 253402300799000;
  leap-second `23:59:59 -> :60` = 1000 ms and `:60 -> next day` = 0 ms;
  and the whole 0000–9999 domain (minimum −62167219200000, maximum
  253402300800999 with second 60 and .999) inside ±(2^53−1).
- Correction architecture: `src/time.ts` now projects contract-valid
  instants through deterministic proleptic-Gregorian integer arithmetic —
  canonical generated contract validation first, a positive day-ordinal
  count from year zero (closed-form leap counting over non-negative
  operands only; no negative integer division anywhere), subtraction of
  the fixed 1970 ordinal, BigInt combination of
  day/hour/minute/second/fraction, a fail-closed decomposed-field domain
  guard, and conversion to Number only after a proven safe-integer bound.
  Year 0000 and 0400 are leap; 0100 and 1900 are common. The accepted
  leap-table-free Unix-style leap-second projection (second 60 at 23:59Z
  onto the next minute boundary) and deterministic fractional truncation
  are preserved; `deriveDurationMilliseconds` still enforces integer ≥ 0
  and ≤ 86400000; execution and replay continue to share the single
  `time.ts`/`derive.ts` derivation authority (`runner.ts`, `derive.ts`,
  and `report.ts` remain the only call sites). A static governance rule in
  `governance-layering.test.ts` now forbids `Date.UTC`/`Date.parse` in
  runner source. The M02-W01 fixture-consumer invariant in
  `packages/test-fixtures/test/m02-w01/governance-discovery.test.ts` again
  requires, for BOTH reviewed consumers, the exact package name,
  `private === true`, and a description containing the exact token
  `NON_PRODUCTION` (the retained lowercase `evaluation` check makes the
  restored assertion strictly stronger than the `5f8af91` parent);
  `packages/evaluation-runner/package.json` truthfully declares
  `EVALUATION_ONLY` / `NON_PRODUCTION` / never critical-gate authority
  with no version, dependency, or lockfile change, and W05's own
  `governance-layering.test.ts` independently asserts that
  classification. REQ-GATE-006 completed anchors were refreshed
  (`src/derive.ts`, `src/time.ts`,
  `test/m02-w05/replay-source.test.ts`,
  `test/m02-w05/regression-source.test.ts`,
  `test/m02-w05/measurement-boundaries.test.ts`) through the canonical
  reviewed procedure: `review.v1_4_requirements_mapping_sha256` and
  `FINAL_V1_4_REQUIREMENT_MAPPING_SHA256` transitioned
  `e2075f706e223b14ba8af8ebce4a53fa062b4e069531e02a7a59ebe697675e39` →
  `89db8aaa77d196dd7ab2db389756fe48c2bafe809271984d695373116e4984c3`
  (states, ownership, mapping, gate effects, dependencies unchanged; the
  package dependency hash `ea991a04…` is unchanged), and
  `docs/REQUIREMENTS_TRACEABILITY.md` was regenerated only via
  `pnpm traceability:generate`.
- Corrected reproduction behavior re-executed on the new content through
  the same real path: the 36-hour year-zero window now rejects
  `RUNNER_CLOCK_DURATION` from its true 129600000 ms duration; the
  `0099 -> 0100` window derives exactly 1000 ms, issues its canonical
  result, builds, replays, and renders; every probe projection equals the
  standalone reference exactly; and a 62,428-comparison sweep across the
  complete 0000–9999 domain (Jan 1, Feb 28, Mar 1, Jun 30, Dec 31, every
  leap-day, every year-end leap second, and low-year fraction truncation)
  matched an independent iterative reference with zero mismatches.
- Focused verification completed in this corrective writer pass:
  - W05 typecheck, strict ESLint, and Prettier → exit 0; `runner:check`
    executed twice → deterministic JSON/Markdown/HTML PASS both times,
    with byte-identical `git status --porcelain=v1 -uall` SHA-256 before,
    between, and after the two runs (read-only proof).
  - W05 Vitest 290/290 across 12 files: aggregation-statistics 24,
    governance-layering 6, measurement-boundaries 63 (31 new permanent
    low-year/leap-second regressions: contract acceptance matrix 9,
    common-year rejection matrix 3, literal reviewed epoch anchors, the
    complete 0000–9999 independent-reference matrix, 11 calendar-boundary
    duration rows, the end-to-end 36-hour rejection, low-year
    execution/replay equality, fractional truncation, witness-edit
    rejection, low-year report-truth change, and the leap-second
    next-minute-boundary end-to-end control), mutations 18 (historical
    finite campaign untouched), regression-source 16, regression 22,
    replay-source 11, reports 22, runner 27, thresholds 32,
    validation-boundaries 48, w04-integration 1. Focused
    measurement-boundaries + governance-layering run → 69/69.
  - M02-W01 focused discovery/governance suite → 108/108 with the
    restored NON_PRODUCTION assertion passing for both reviewed
    consumers (`governance-discovery.test.ts` 7/7 within it).
  - preserved W04 typecheck/`baselines:check`/test → 171/171 across 9
    files (catalog v1.0.2 digest unchanged); W02 → 57/57; full fixtures →
    166/166; mock lab typecheck/test/build → 32/32 and build success;
    Playwright discovery/execution → 59 tests in 17 files / 59/59.
  - focused Python suites: test_integrity 43, test_suite_states 294,
    test_proofs_and_real_repo 7, test_traceability 62 (fixture path
    anchors extended for the five refreshed REQ-GATE-006 paths),
    test_v14_migration 31, test_validate_status 148 (corrective-issue
    tuple extended to KI-0054; no Python test added or removed); full
    `scripts/tests` 976/976.
  - `python3 scripts/validate_status.py` → PASS (45 check groups) with
    KI-0048…KI-0051 and KI-0053 as HIGH/IN_PROGRESS live blockers and
    KI-0052/KI-0054 MEDIUM/IN_PROGRESS (not live blockers);
    `pnpm traceability:check` → PASS 193/300 after the reviewed hash
    transition; `pnpm generate:contracts --check` → 183 byte-identical;
    `pnpm run doctor` → 22 pass / 0 fail / 1 not-yet-applicable (single
    warning: expected pre-commit uncommitted changes); `git diff --check`
    → clean.
  - full `pnpm verify` with pinned Node 24.18.0 → exit 0: 12/12
    typecheck tasks; 12/12 test tasks and 3,106/3,106 TypeScript tests
    (contracts 2440, evaluation-runner 290, evaluation-baselines 171,
    test-fixtures 166, mock-ats-lab 32, seven scaffold packages 1 each);
    generated contracts 183/183 byte-identical; focused contracts
    662/662; fixture-corpus focused W01 108 + W02 57 (exact 165);
    Playwright 59/59 across 17 files; exact POSIX Python inventory
    977/977; Rust 1/1 plus 10/10; status 45 groups; traceability
    193/300; portability and integrity PASS; every ACTIVE suite PASS;
    visual remained truthfully NOT_YET_APPLICABLE; worktree
    status-neutrality held; no skipped, xfailed, xpassed, or other
    nonordinary test outcome.
- Scope/governance: M02-W05 remains IN_PROGRESS and unaccepted; M02-W06
  remains NOT_STARTED; no package is READY; M02 remains IN_PROGRESS; M00
  and M01 remain ACCEPTED; M02-W01/W02/W03/W04 remain VERIFIED at their
  preserved trees; KI-0046/KI-0047 remain FIXED; KI-0048…KI-0054 remain
  IN_PROGRESS pending separate fresh independent verification; all four
  critical gates remain NOT_EVALUATED and release remains NOT_READY. No
  timestamp/benchmark/generated schema, W04 baseline semantic, W01/W02
  fixture body, mock ATS semantic, Playwright scenario, model-lock,
  prompt-registry, CI-workflow, toolchain-pin, lockfile, or gate-report
  byte changed; M02-W01 was reopened only to restore the one governance
  assertion W05 itself weakened; no W06/W13/W14/W15 behavior was
  implemented; no critical gate was evaluated; no governance closeout
  occurred. Exact-SHA three-OS hosted execution follows the correction
  push; only a separate fresh independent session may move M02-W05 to
  VERIFIED.

### M02-W05 — Corrective writer pass: bind replay and regression evidence (2026-08-09)

- Revision: corrective working tree over exact blocked M02-W05 content commit
  `383ae578512910b17d98aee30e1f24531fa746c8` / tree
  `a5544b13da96d1d6bc9ce0db50ab5b2d23c454ce` (governance parent
  `5f8af91a92f1fe533962d9ac99833b68ed9bf0a8`); the containing correction
  commit and tree are reported post-commit. The independent GPT-5.6 Sol
  Ultra acceptance review of `383ae578` returned
  `SOL_BLOCKED_M02_W05_GOVERNANCE` (2026-08-08) with five defects, recorded
  as KI-0048 through KI-0052. Owner-selected corrective implementation
  agent: Fable 5 Ultra Code (single authoritative writer; no automatic
  model switching; read-only Fable 5 reviewers only).
- Environment: macOS 27.0 arm64; pinned Node 24.18.0, pnpm 11.17.0,
  uv-managed Python 3.12.13, uv 0.11.32, Rust 1.97.1; frozen/locked
  installs (`pnpm install --frozen-lockfile`, `uv sync --locked`, both
  `cargo fetch --locked` manifests) → exit 0.
- Pre-fix reproductions on the exact blocked `383ae578` content (temporary
  scripts outside the repository; no fixture bytes changed): (A) a genuine
  FAIL report accepted a coordinated measured/passed/outcome/aggregate
  PASS rewrite with every old identity retained; an UNAVAILABLE holdout
  report accepted a VALID/comparable/PASS relabel; a coordinated
  repository/runtime provenance replacement kept the old execution
  identity; and a raw paired-count truth change (TP 2→200) was accepted
  under the old observation digest. (B) a passing comparison with foreign
  `candidate_run_digest` `sha256:ff…ff` and a CORPUS_MISMATCH comparison
  relabeled comparable/passed were accepted standalone and in reports.
  (C) FAILED_SETUP with paired counts TP=7/FP=1/FN=2 was accepted and
  derived precision 7/8 and recall 7/9. (D) `2026-02-30T00:00:00Z` /
  `…:01Z` were accepted (`Date.parse` rollover to 2026-03-02) deriving
  1000 ms. (E) a request with exactly 32 user limitations validated but
  `buildRunReport` rejected the legitimate 35-entry report
  (`RUNNER_REPORT_STRUCTURE`, bound 34).
- Correction architecture: new `ExecutionReplayWitnessV1` (canonical
  validated `ExecutionRequestV1` plus per-case `case_id`, actual
  `started_at`/`ended_at`, and canonical normalized `AdapterObservationV1`)
  embedded in `RunnerExecutionV1` and in report JSON; new `src/derive.ts`
  is the single pure derivation path used by both `runEvaluation` and
  report replay, independently recomputing request digest,
  request-derived provenance, runtime commitment, output policy, title,
  fixed/user limitations, case digests, threshold truth, observation
  digests, timestamps/durations, completeness, environment/hash/holdout
  state, comparability, outcomes, participation, paired-count state,
  canonical `BenchmarkResultV1`, record/result identities, aggregate,
  execution digest/identity, and the comparability banner, then requiring
  the serialized report to equal the derived report byte-for-byte in
  canonical JSON (`RUNNER_REPORT_REPLAY_MISMATCH`,
  `RUNNER_REPORT_SOURCE_BINDING`, `RUNNER_WITNESS_*`). Report-embedded
  regression comparisons now carry their complete immutable source
  (full reviewed reference with recomputed digest plus versioned
  candidate selector: `CASE_THRESHOLD_METRIC`, `AGGREGATE_PASS_RATE`,
  `AGGREGATE_POOLED_PROPORTION`, `AGGREGATE_PRECISION`,
  `AGGREGATE_RECALL`); the candidate side resolves exclusively from the
  embedding execution's canonical truth with `candidate_run_digest` bound
  to the current execution content digest, and compatibility, reasons,
  comparability, deltas, and pass/null re-derive during replay
  (`RUNNER_REGRESSION_SOURCE_REQUIRED`,
  `RUNNER_REGRESSION_SOURCE_MISMATCH`,
  `RUNNER_REGRESSION_REFERENCE_TAMPER`,
  `RUNNER_REGRESSION_CANDIDATE_SOURCE`). FAILED_SETUP now rejects paired
  counts at the raw observation boundary
  (`RUNNER_SETUP_PAIRED_COUNT_PAYLOAD`) with independent aggregation
  (`RUNNER_AGGREGATE_SETUP_PAIRED_COUNTS`) and replay defenses. One
  shared timestamp authority (`src/time.ts`) delegates calendar validity
  to the generated contract validator
  `validateCommonTimestampUtcV1UtcTimestamp` for execution and replay
  alike (leap-second control `2026-06-30T23:59:60Z` and fractional forms
  remain accepted; `2026-02-30`, `2025-02-29`, month/day/hour/offset and
  lowercase-`z` forms reject). Shared limitation constants bind request
  and report bounds (`MAX_USER_LIMITATIONS = 32`,
  `MAX_FIXED_REPORT_LIMITATIONS = 3`, `MAX_REPORT_LIMITATIONS = 35`).
  Internal runner formats were revised in place under the normal
  pre-verification policy (package never VERIFIED, no external consumer);
  a pre-correction serialized report now rejects fail-closed.
- Corrected reproduction behavior re-executed on the final corrected
  bytes: A1–A4 → `RUNNER_REPORT_REPLAY_MISMATCH`; B foreign/sourceless →
  `RUNNER_REGRESSION_SOURCE_REQUIRED` (and relabeled sourced comparisons →
  `RUNNER_REGRESSION_SOURCE_MISMATCH` in permanent tests); C →
  `RUNNER_SETUP_PAIRED_COUNT_PAYLOAD`; D → `RUNNER_CLOCK_TIMESTAMP`;
  E → 32-user request builds, renders, and replays a 35-limitation
  report.
- Focused verification completed in this corrective writer pass:
  - W05 typecheck, strict ESLint, and Prettier → exit 0; `runner:check`
    executed twice → deterministic JSON/Markdown/HTML PASS both times,
    with byte-identical `git status --porcelain=v1 -uall` SHA-256 before,
    between, and after the two runs (read-only proof).
  - W05 Vitest 259/259 across 12 files: aggregation-statistics 24,
    governance-layering 6, measurement-boundaries 32 (new), mutations 18,
    regression-source 16 (new), regression 22, replay-source 11 (new),
    reports 22, runner 27, thresholds 32, validation-boundaries 48,
    w04-integration 1. The historical finite mutation campaign remains
    exactly 18/18 with its original classes untouched; the 59 new tests
    are the permanent replay-source, regression-source, failed-setup,
    UTC, and limitation regression matrix for KI-0048…KI-0052.
  - preserved W04 typecheck/`baselines:check`/test → 171/171 across 9
    files; W01 → 108/108; W02 → 57/57; full fixtures → 166/166; mock lab
    typecheck/test/build → 32/32 and build success; Playwright discovery/
    execution → 59 tests in 17 files / 59/59.
  - focused Python suites: test_integrity 43, test_suite_states 294,
    test_proofs_and_real_repo 7, test_traceability 62, test_v14_migration
    31, test_validate_status 148 (fixture corrective-issue tuple extended
    to KI-0052; no Python test added or removed); full `scripts/tests`
    976/976.
  - `python3 scripts/validate_status.py` → PASS (45 check groups) with
    KI-0048…KI-0051 as HIGH/IN_PROGRESS live blockers and KI-0052
    MEDIUM/IN_PROGRESS; `pnpm traceability:check` → PASS 193/300 with no
    traceability.json change; `pnpm generate:contracts --check` → 183
    byte-identical; `pnpm run doctor` → 22 pass / 0 fail / 1
    not-yet-applicable (single warning: expected pre-commit uncommitted
    changes).
  - final local `pnpm verify` with pinned Node 24.18.0 → exit 0: 12/12
    typecheck tasks; 12/12 test tasks and 3,075/3,075 TypeScript tests
    (contracts 2440, evaluation-runner 259, evaluation-baselines 171,
    test-fixtures 166, mock-ats-lab 32, seven scaffold packages 1 each);
    generated contracts 183/183 byte-identical; focused contracts
    662/662; fixture-corpus focused W01 108 + W02 57 (exact 165);
    Playwright 59/59 across 17 files; exact POSIX Python inventory
    977/977; Rust 1/1 plus 10/10; status 45 groups; traceability
    193/300; portability and integrity PASS; every ACTIVE suite PASS;
    visual remained truthfully NOT_YET_APPLICABLE; worktree
    status-neutrality held; no skipped, xfailed, xpassed, or other
    nonordinary test outcome.
- Scope/governance: M02-W05 remains IN_PROGRESS and unaccepted; M02-W06
  remains NOT_STARTED; no package is READY; M02 remains IN_PROGRESS; M00
  and M01 remain ACCEPTED; M02-W01/W02/W03/W04 remain VERIFIED at their
  preserved trees; KI-0046/KI-0047 remain FIXED; KI-0048…KI-0052 remain
  IN_PROGRESS pending separate fresh independent verification; all four
  critical gates remain NOT_EVALUATED and release remains NOT_READY. No
  benchmark schema, generated contract, W04 baseline semantic, W01/W02
  fixture body, mock ATS semantic, Playwright scenario, model-lock,
  prompt-registry, CI-workflow, toolchain-pin, lockfile, or gate-report
  byte changed; no W06/W13/W14/W15 behavior was implemented; no critical
  gate was evaluated; no governance closeout occurred. Exact-SHA
  three-OS hosted execution follows the correction push; only a separate
  fresh independent session may move M02-W05 to VERIFIED.

### M02-W05 — Build deterministic evaluation runner (2026-08-07)

- Revision: implementation working tree over exact governance parent
  `5f8af91a92f1fe533962d9ac99833b68ed9bf0a8` / tree
  `a13a9c2ef10cf81b809b5ef9e47e5e3a3dbccdbe`; the containing content
  commit and tree are reported post-commit because neither can
  self-authenticate inside its own bytes. Owner-selected implementation
  agent: GPT-5.6 Sol Ultra, one authoritative writer with no delegation or
  automatic model switching.
- Architecture: additive private workspace owner
  `packages/evaluation-runner` (`@japp/evaluation-runner`) with format version
  1.0.0 for execution requests, adapter observations, internal per-case
  records, aggregates, immutable regression comparisons, report models,
  JSON/Markdown/standalone-HTML projections, and the out-of-band report
  artifact manifest. Runtime dependency is only `@japp/contracts`; W04
  baselines and W01/W02 fixtures are explicit development-only dependencies.
  No production workspace package depends on the runner, and package source
  has no product, provider, network, process-execution, randomness, ambient
  environment, extension, or form-engine dependency.
- Existing contracts: every input case is structurally validated by generated
  `BenchmarkCaseV1` and semantically validated by the existing
  `BENCHMARK_CASE_INTEGRITY` rules. Complete and partial observations with at
  least one metric issue the authoritative generated `BenchmarkResultV1` and
  pass its structural plus `BENCHMARK_RESULT_INTEGRITY` validators. A setup
  failure has no fabricated metric, so the versioned internal record retains
  it visibly as `FAILED_SETUP`/`INVALID` without falsely issuing result v1.
- Threshold and result truth: committed threshold payloads support exact
  `AT_LEAST`, `AT_MOST`, and `EXACT` comparison across `BYTES`, `COUNT`,
  `MILLISECONDS`, `RATIO`, and `SCORE`. Finite bounded values are converted
  from canonical shortest decimal text into normalized BigInt
  coefficient/scale values and compared exactly—no epsilon or subtraction
  drift. Duplicate, missing-complete, unexpected, mismatched-unit, mutable,
  or digest-tampered metrics reject. The runner, never the caller, derives
  threshold pass/fail, completeness, environment/hash/holdout state,
  comparability, and `PASS`/`FAIL`/`INVALID` outcome.
- Aggregation/statistics: every finite record remains visible in raw
  completeness, comparability, outcome, environment, hash, holdout, failure
  code, metric, zero-tolerance, and implementation/baseline counts. Rates
  always carry raw numerator and denominator. Declared proportion metrics
  pool raw counts rather than averaging ratios. TP/FP/FN groups always emit
  precision and recall together with all raw counts and explicit zero-
  denominator handling. Comparable Bernoulli evidence uses a fixed two-sided
  95% Wilson score interval (`z=1.959963984540054`); no observations,
  `n=1`, non-Bernoulli metrics, zero-tolerance counts, environment mismatch,
  and incomparable evidence remain explicit rather than acquiring a fake
  interval or a superiority claim.
- Regression/reporting: comparisons accept only an explicitly supplied,
  versioned, content-addressed reference and require compatible metric/unit,
  corpus, runtime, metric/threshold semantics, implementation identity,
  prompt set, and browser commitment. They report both values/raw counts,
  exact signed and meaningful relative deltas, threshold/comparator truth,
  reasons, and both provenance digests; no “latest” selection exists. JSON is
  canonical machine truth. Markdown and script-free standalone HTML validate
  the same report model, recompute aggregate truth from visible cases, verify
  content-derived record/run IDs, escape untrusted text/provenance, sort
  stably, normalize set-like adapter observations before identity hashing,
  re-derive record/result truth during replay, and carry exact artifact
  SHA-256/byte counts in a non-self-referential manifest. Every human report states
  `THIS REPORT HAS NO CRITICAL-GATE AUTHORITY`.
- Pre-W06 boundary and integration: only public synthetic cases may use the
  reviewed fixed `DEVELOPMENT_NOT_APPLICABLE_V1` commitment. It yields the
  existing result contract's truthful `NOT_APPLICABLE` holdout state and is
  explicitly not a W06 manifest, hidden corpus, or gate-evidence artifact.
  The finite W04 integration proof invokes original passthrough, lexical
  overlap with raw counts, explicitly UNVERIFIED/NON_PRODUCTION keyword
  stuffing, one-shot generation through one deterministic fake call, and the
  existing unavailable/not-attempted legacy observations, which remain
  partial/incomparable/invalid rather than becoming benchmark PASS evidence.
- Focused verification completed in this writer pass:
  - frozen/locked `pnpm`, `uv`, and both Rust-manifest fetches → exit 0;
    workspace discovery reports 15 projects (root plus 14 workspace
    packages), with one reviewed lockfile importer and no external package.
  - W05 typecheck, strict ESLint, Prettier, and `runner:check` → exit 0;
    deterministic report replay PASS; W05 Vitest 200/200 across 9 files.
  - finite required mutation campaign → exactly 18/18 ordinary passes, each
    retaining a clean positive control.
  - preserved W04 typecheck/check/test → 171/171 across 9 files; W01 →
    108/108; W02 → 57/57; full fixtures → 166/166; mock lab → 32/32 and build
    success; Playwright discovery/execution → 59 tests in 17 files / 59/59.
  - final local `pnpm verify` with pinned Node 24.18.0 → exit 0: 12/12
    typecheck tasks; 12/12 test tasks and 3,016/3,016 TypeScript tests;
    generated contracts 183/183 byte-identical; focused contracts 662/662;
    exact POSIX Python inventory 977/977; Rust 1/1 plus 10/10; status 45
    groups; traceability 193/300; every ACTIVE suite PASS; visual remained
    truthfully NOT_YET_APPLICABLE; no skipped, xfailed, xpassed, or other
    nonordinary test outcome.
- Scope/governance: implementation evidence only. M02-W05 remains
  IN_PROGRESS and unaccepted; M02-W06 remains NOT_STARTED; no package is
  READY; M02-W01 through M02-W04 remain VERIFIED; KI-0046/KI-0047 remain
  FIXED; M02 remains IN_PROGRESS; all critical gates remain NOT_EVALUATED;
  release remains NOT_READY. No real holdout, W13 autofill benchmark harness,
  W14 evaluation, W15 decision, gate report change, production model/prompt,
  live employer interaction, or governance closeout occurred. Exact-SHA
  three-OS hosted execution and a separate fresh independent verification
  remain subsequent evidence steps; only that separate session may move W05
  to VERIFIED and make W06 READY.

### M02-W04 — Governance closeout after final independent Sol verification (2026-08-07)

- Accepted content boundary: exact commit
  `5ed2768c895bc2ce3c236d089745556c7e563d5f`, tree
  `656c61d87d0615b6a9b96319888856057686223b`, parent
  `a5aa43602e67a66c5319fa7b24aa8b6b32bfd71f`, title
  `M02-W04: refine clean-room observation boundary`. Before Stage A and again
  before governance, clean `main`, HEAD, and `origin/main` were exact. The
  JAPP-MASTER-001 v1.4 SHA-256 remained
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  The fresh authoritative verifier started and finished on the owner-selected
  GPT-5.6 Sol Ultra model and had not authored, edited, supervised, committed,
  pushed, or repaired any M02-W04 revision.
- Preserved defect lifecycle: original implementation
  `7fcdfa34797c29289737f558a7826cd12fb42fc0` received
  `SOL_BLOCKED_M02_W04_GOVERNANCE`; first correction
  `a5aa43602e67a66c5319fa7b24aa8b6b32bfd71f` received
  `SOL_BLOCKED_CORRECTED_M02_W04_GOVERNANCE`; second correction
  `5ed2768c895bc2ce3c236d089745556c7e563d5f` received
  `SOL_CLEAR_FOR_FINAL_M02_W04_GOVERNANCE`. Every prior Fable/Sol report was
  treated only as a reproduction target.
- Historical-blocker probe: an independently authored temporary probe outside
  tracked bytes passed 99/99 controls. Current content rejected UNAVAILABLE
  with nonempty safety observations and CAPTURED records using `main`, `HEAD`,
  a short SHA, or `const copied = 1;`; it accepted a valid synthetic CAPTURED
  record with an HTTPS repository coordinate, full lowercase 40-hex Git SHA,
  synthetic fixture input/digest, output digest, plain-language observations,
  and `code_copied=false`.
- Complete ordinary-prose matrix: each value independently accepted in both
  `structured_observations` and `safety_observations` (24/24):
  `The interface displayed three ordinary fields.`,
  `The type field remained empty.`, `Filled three ordinary fields…`,
  `The class field was hidden.`, `The switch control remained off.`,
  `The return value was empty.`, `The interface loaded after navigation.`,
  `The type selector showed no value.`, `The enum field label was visible.`,
  `The application displayed one required field.`,
  `The operator selected the first option.`, and `Submit (disabled)`.
- Complete source-shape matrix: each value independently rejected in both
  observation arrays (56/56): `const copied = 1;`, `let value = 2;`,
  `var total = 3;`, `type Result = string;`,
  `interface Result { value: string }`, `class Result { }`,
  `enum Result { One }`, `import value from "module";`,
  `export const value = 1;`, `module.exports = value;`,
  `require("module");`, `value + 1;`, `value - 1;`, `value * 2;`,
  `value / 2;`, `value % 2;`, `value + 1 + 2;`, `total = value;`,
  `total += 1;`, `object.field = value;`, `run(value);`,
  `object.run(value);`, `console.log(value);`, `return value;`,
  `throw error;`, `if (ready) {`, `while (ready) {`, and
  `for (item of items) {`.
- Multiline matrix: LF and CRLF variants in both arrays accepted
  `The interface displayed three fields.` followed by
  `The type field remained empty.` and rejected that first prose line followed
  by `value + 1;`, plus `The type field remained empty.` followed by
  `const copied = 1;` (12/12). The exact KI-0047 call produced
  `Analyst with Excel experience.\n\n[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: sql]`,
  never `Skills: sql`, with `inserted_terms=["sql"]`,
  `grounded_in_evidence=false`, `verification_status=UNVERIFIED`, and both
  EVALUATION_ONLY/NON_PRODUCTION classifications.
- Complete finite semantic result: `@japp/evaluation-baselines` is a private
  test/evaluation-only package; no production package depends on, exports,
  imports, or reads it or its literal oracle. No provider, model, runtime,
  network, legacy-code, vendor, submodule, or copied-source dependency exists;
  the correction changed no dependency or lock file; and no M02-W05 runner
  exists. Catalog 1.0.2 / schema 1 has exactly six definitions and 34
  development cases: ORIGINAL_UNTAILORED, KEYWORD_OVERLAP,
  NAIVE_KEYWORD_STUFFING, ONE_SHOT_RESUME_GENERATION,
  ONE_SHOT_ANSWER_GENERATION, and LEGACY_BEHAVIOR_OBSERVATION. Every baseline
  is EVALUATION_ONLY/NON_PRODUCTION with gate authority NONE.
- Algorithm result: original text is byte-identical, structured output is a
  canonical-content-equal distinct clone, inputs are not mutated, metadata is
  separate, and no fact changes. Keyword overlap independently reproduced
  NFKC/lowercase/token/punctuation/hyphen/slash/trailing-dot/duplicate/stable-
  order behavior, no stemming/stopwords/embeddings/weights/model calls, exact
  `unique matched target terms / unique target terms`, and explicit zero-
  target score 0. Stuffing 1.0.1 preserves deterministic missing-term order,
  contains no claim-bearing heading, is byte-identical on no-op, prevents
  duplicates, is idempotent, preserves original text, stays UNVERIFIED and
  ungrounded, and has no authority. Resume and answer control flow each makes
  exactly one injected `generateOnce` call with no retry, repair, second model,
  retrieval, tool, verifier loop, fallback, or additional call after failure;
  raw output is preserved with factual authority NONE. Only deterministic
  in-process fakes are used; `model/model-lock.json` and
  `prompts/registry.yaml` are untouched.
- Legacy/Simplify result: legacy validation 1.0.2 keeps CareerPulse
  UNAVAILABLE and JobApply NOT_ATTEMPTED, commits no CAPTURED record, requires
  empty noncapture payload channels and immutable captured repository/full-SHA
  coordinates, forbids `code_copied=true`, accepts ordinary behavioral prose,
  and rejects the bounded source shapes. No legacy repository was cloned or
  executed. The Simplify slot remains truthfully NOT_CAPTURED with no
  fabricated observation or live-employer automation and with future owners
  M02-W13, M02-W14, and M05-W11. REQ-GATE-007 and REQ-GATE-008 remain
  SCAFFOLD_ONLY.
- Manifest/oracle proof: two consecutive read-only `baselines:check` commands
  passed with no tracked mutation. Catalog digest is
  `sha256:c8b9858242481ca2532e2a55589c478d14e3bdaf7761e1f74ff9effd3a4593cc`,
  combined digest
  `sha256:71c41a754e997998328535670095debb4c068576f788863cd3a458fe31996cc5`,
  legacy-data digest
  `sha256:2a979f5592cbbc5c84fefcc241c3d0c95fb346c77e7b0ac2d2dcd66d9de5bcfb`,
  case digest
  `sha256:384c8118f93f9a2793ee672183301f3e960c3867bf5c927a09f091f999ae4b92`,
  and literal oracle version 1.0.2. Production does not read the oracle.
- Independent reference proof: a temporary 29-check program outside tracked
  bytes imported no W04 helper and independently reproduced all six IDs,
  catalog/schema versions, 34-case count, raw catalog/manifest commitments,
  combined digest, both prompt digests, normalization and exact overlap
  scores, corrected single/multi-term stuffing order, original byte/canonical
  identity, committed legacy statuses, mutable-versus-full-SHA classification,
  prose-versus-source examples, and absence of production-package dependency.
  It passed 29/29. A separate implementation semantic probe passed 22/22.
- Exactly fifteen independent mutations: each disposable copy first passed
  its clean positive-control command with exit 0, then its mutant exited 1.
  Rejected classes were `OVERLAP_FORMULA_DRIFT`, `NORMALIZATION_DRIFT`,
  `CLAIM_BEARING_STUFFING`, `RESUME_PROMPT_TAMPER`, `ANSWER_PROMPT_TAMPER`,
  `AUTHORITY_ESCALATION`, `SECOND_GENERATOR_CALL`, `RETRY_AFTER_FAILURE`,
  `SILENT_FALLBACK`, `NONCAPTURED_PAYLOAD`, `MUTABLE_CAPTURE_REVISION`,
  `SOURCE_SNIPPET_ACCEPTANCE`, `KEYWORD_ONLY_FALSE_POSITIVE_REGRESSION`,
  `ARITHMETIC_FALSE_NEGATIVE_REGRESSION`, and `MANIFEST_OR_DATA_TAMPER`.
  Targeted failures included exact-score mismatches, the NFKC control,
  claim-bearing literal/oracle mismatch, prompt/manifest drift, classification
  drift, call-count/retry/fallback failures, noncapture payload acceptance,
  mutable revision acceptance, const/import/function acceptance, ordinary-
  prose rejection, arithmetic acceptance, and legacy-data/combined-digest
  drift. No additional mutation family was added.
- Fresh-clone local execution: Node 24.18.0, pnpm 11.17.0, uv 0.11.32,
  Python 3.12.13, Rust/Cargo 1.97.1, and Playwright 1.62.0. W04 typecheck,
  ESLint, Prettier, and manifest checks passed; W04 tests were 171/171 across
  9 files (legacy 84/84, stuffing 11/11, committed mutation file 15/15).
  W01 was 108/108, W02 57/57, fixtures 166/166, mock lab 32/32 plus successful
  typecheck/build, and Playwright 59/59 across 17 files. Focused Python suites
  were integrity 43, suite states 294, real-repo proofs 7, traceability 62,
  v1.4 migration 31, and status validation 148; full `scripts/tests` was
  976/976. Status passed 45 groups, traceability 193 requirements / 300 work
  packages, generated contracts 183 byte-identical, and doctor 23 pass / 0
  warning / 0 fail / 1 not-yet-applicable.
- Canonical verification: `pnpm verify` exited 0 with TypeScript 2,816,
  contracts 2,440, focused contracts 662, W04/W01/W02/fixtures/mock/Playwright
  counts above, POSIX Python 977/977, committed Windows Python inventory
  975/975, Rust 1 plus 10, every ACTIVE suite PASS, visual
  NOT_YET_APPLICABLE, and no nonordinary outcome. Protected model, prompt,
  pnpm/uv/Cargo lock, workflow, Python-inventory, and master-spec bytes were
  identical to the content commit after execution.
- Hosted content proof: push-triggered workflow `31225740045` completed
  successfully at exact head SHA
  `5ed2768c895bc2ce3c236d089745556c7e563d5f`: ubuntu-24.04 job
  `93019549384`, macos-15 job `93019549289`, and windows-2025 job
  `93019549294`. Every complete log reproduced W04 171, W01 108, W02 57,
  fixtures 166, mock 32, Playwright 59, contracts 2,440, focused contracts
  662, Python 977 POSIX / 975 Windows, Rust 1+10, doctor success, verification
  exit 0, every ACTIVE suite PASS, visual NYA, and clean tracked state. The
  complete Windows stream was 618,256 bytes / 2,993 lines, ended at normal job
  cleanup, and contained no EPERM or action error.
- Governance result: M02-W04 transitions IN_PROGRESS → VERIFIED at tree
  `656c61d87d0615b6a9b96319888856057686223b`; M02-W05 transitions
  NOT_STARTED → READY as the sole READY package and remains unbegun; current
  work becomes NONE; KI-0046 and KI-0047 transition IN_PROGRESS → FIXED.
  M00/M01 remain ACCEPTED, M02 remains IN_PROGRESS, M02-W01/W02/W03 remain
  VERIFIED, REQ-GATE-007/008 remain SCAFFOLD_ONLY, all four critical gates
  remain NOT_EVALUATED, and release remains NOT_READY. No implementation,
  test, package, manifest, oracle, dependency, lock, workflow, model, prompt,
  schema, contract, or gate-report byte changed; no M02-W05 or later behavior
  was implemented and no critical gate was evaluated.

### M02-W04 — Residual KI-0046 clean-room observation correction (2026-08-07)

- Revision boundary: forward-only corrective writer working tree over exact
  first-correction commit `a5aa43602e67a66c5319fa7b24aa8b6b32bfd71f` /
  tree `9f49c0c388f4905b8b9eb4e9d8e0e0cee4470c97`, parent
  `7fcdfa34797c29289737f558a7826cd12fb42fc0`; starting HEAD and
  `origin/main` were equal and the writer tree was clean. JAPP-MASTER-001
  v1.4 remained byte-exact at SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  Owner-selected narrow corrective writer model: GPT-5.6 Sol Ultra. The
  containing correction commit/tree is reported post-commit under the
  repository anchoring convention. This is implementation evidence only,
  not acceptance verification or governance closeout.
- Defect history and exact primary pre-edit reproduction: the original
  `7fcdfa3` KI-0046 fail-open defect was first corrected by `a5aa436`, but a
  fresh independent GPT-5.6 Sol Ultra verifier found a residual mismatch
  between the documented clean-room contract and the new observation-text
  classifier. Against exact `a5aa436`, the independent writer probe recorded
  `"The interface displayed three ordinary fields."` →
  `LEGACY_OBSERVATION_SOURCE_SNIPPET`,
  `"The type field remained empty."` →
  `LEGACY_OBSERVATION_SOURCE_SNIPPET`, `"value + 1;"` → `ACCEPTED`, and
  the positive control `"Filled three ordinary fields..."` → `ACCEPTED`.
- Expanded pre-edit matrix: of the eleven required ordinary-prose controls,
  `Filled…`, `switch control…`, `return value…`, `application displayed…`,
  and `operator selected…` were accepted, while both exact primary prose
  cases plus `class field…`, `interface loaded…`, `type selector…`, and
  `enum field…` were incorrectly rejected as source snippets. Declaration,
  import/export, assignment, call, and return examples were rejected, but
  each simple arithmetic statement `value + 1;`, `value - 1;`,
  `value * 2;`, `value / 2;`, and `value % 2;` was incorrectly accepted.
  Ordinary multiline prose was therefore also incorrectly rejected; mixed
  multiline payloads returned a rejection, but the first prose line's false
  positive made that result insufficient evidence that a hidden line-2
  source statement was detected.
- Test-first proof: before production bytes changed, table-driven positive,
  negative, and multiline regressions were added for both
  `structured_observations` and `safety_observations`. The direct legacy file
  then failed 12 of 79 tests: six reserved-word prose cases, five arithmetic
  expressions, and the clean multiline prose case. The bounded mutation file
  failed its two new witnesses (13 passed / 2 failed), proving the added
  truth caught both reintroduction of a keyword-only false-positive rule and
  silent acceptance of operator/call/return source shapes.
- Narrow post-change review proof: before the final predicate refinement, five
  additional direct assertions failed in the 84-test legacy file exactly as
  intended: `Submit (disabled)` exposed an over-broad whitespace-before-call
  rule, while Python `import module as alias`, `export default value;`,
  repeated arithmetic `value + 1 + 2;`, and inline control block
  `if (ready) { run(); }` exposed bounded undercoverage. The final production
  refinement was made only after those five failures were recorded.
- Root cause and corrected design: the first correction used an unanchored
  keyword pattern equivalent to
  `/\b(?:class|interface|enum|type)\s+[A-Za-z_$][\w$]*/`, so ordinary English
  noun/verb sequences looked like declarations, while no predicate recognized
  a standalone arithmetic expression. Version 1.0.2 replaces that heuristic
  with a bounded line-oriented boundary: high-confidence whole-text markers
  retain code-fence/backtick/arrow rejection; each trimmed logical line is
  then checked against explicit anchored declaration, import/export/module,
  assignment, arithmetic-expression, call, return/throw/control, and source-
  delimiter shapes. Declaration keywords require declaration punctuation or
  grammar (`type Name =`, `interface|class|enum Name {`, optional
  `extends`/`implements`) rather than a following English word. Arithmetic
  detection requires an identifier/member/literal operand, a programming
  operator, one or more bounded operands, and statement shape, so
  `value + 1;` fails without globally banning ordinary punctuation. Adjacent
  call syntax may omit a semicolon, while whitespace-separated call syntax
  requires one, preserving prose such as `Submit (disabled)`. Bounded Python
  imports, default exports, and inline control blocks also fail closed.
  Splitting CRLF/LF input means a source-shaped line 2 fails even when line 1
  is valid prose.
- Preservation: all prior KI-0046 regressions remain unchanged and green:
  the five non-CAPTURED payload families fail closed; fabricated safety
  observations fail for UNAVAILABLE, UNRUNNABLE, and NOT_ATTEMPTED; CAPTURED
  requires a repository URL and full lowercase 40-hex revision (`main`,
  `HEAD`, and a short SHA reject); `code_copied` can only be false; malformed
  provenance rejects; source snippet/import/function text rejects in both
  observation arrays; and a clean immutable CAPTURED record validates.
  Committed bytes remain CareerPulse UNAVAILABLE and legacy JobApply
  NOT_ATTEMPTED with `source_code_viewed=false`, `code_copied=false`, and
  empty non-capture payloads. The exact KI-0047 reproduction remains byte-
  exact at stuffing algorithm 1.0.1:
  `Analyst with Excel experience.\n\n[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: sql]`;
  it does not contain `Skills: sql`, remains deterministic/idempotent,
  EVALUATION_ONLY/NON_PRODUCTION/UNVERIFIED, and reports
  `grounded_in_evidence=false`. No stuffing implementation byte changed.
- Versioning and reviewed truth: executable legacy validation changes from
  1.0.1 to 1.0.2, and the catalog that commits that algorithm identity changes
  from 1.0.1 to 1.0.2. Stuffing remains 1.0.1. Catalog schema 1, record/file
  schema 1.0.0, `_v1` IDs, package 0.0.1, case matrix 1.0.0 with 34 cases,
  prompts, baseline IDs, and all unrelated algorithms remain unchanged. The
  literal test oracle was reviewed and changed only for oracle/catalog/legacy
  version identity plus the genuinely changed catalog digest; stuffing truth
  is untouched (oracle file SHA-256
  `2135f8521fd4f0389bbeb8442e11435bf3430afe255cd820e0c6d42408e2aaa6`).
- Manifest reconciliation: `baselines:write` was used only through the
  package's explicit authoring path: once for the initial source result and
  once as required after the narrow review refined source bytes. Catalog
  digest moves
  from
  `sha256:e2b45d1ffd71f5328c56f65cca23dd4cf425fd2f06d543b069abfb1456fc4f20`
  to
  `sha256:c8b9858242481ca2532e2a55589c478d14e3bdaf7761e1f74ff9effd3a4593cc`;
  combined digest moves from
  `sha256:5b5e0307743ac0c339cac638c1cff2bf85d0d497d8c5dae463d931f3356d5994`
  to
  `sha256:71c41a754e997998328535670095debb4c068576f788863cd3a458fe31996cc5`.
  Review confirmed only `catalog.ts`, `legacy-observation.ts`, and `model.ts`
  source hashes changed. Both post-write `baselines:check` runs passed and
  left manifest SHA-256
  `ce7dee195f5e78a93e2fe2fd816e18bb3cb09968e1cd577b0b43b55e7181cf1d`
  identical before/between/after. Observation bytes/count/digest
  (`sha256:2a979f5592cbbc5c84fefcc241c3d0c95fb346c77e7b0ac2d2dcd66d9de5bcfb`),
  case matrix, prompts, and unrelated source hashes remain unchanged.
- Direct and mutation results: direct legacy 84/84, stuffing freeze 11/11,
  finite mutations 15/15, and complete evaluation-baselines 171/171 across
  9 files. The keyword-only mutation flags four valid reserved-word prose
  controls while the production validator accepts them; the preserved
  source-shape mutation misses arithmetic/call/return controls while the
  production validator rejects them.
- Independent post-correction probe: all 12 ordinary-prose controls accepted,
  including the 11 owner-required controls; all 36 bounded source-shaped
  declaration/import/module/
  assignment/operator/call/control controls rejected with
  `LEGACY_OBSERVATION_SOURCE_SNIPPET`; clean multiline prose accepted and both
  line-2 source cases rejected. The same independent probe confirmed the
  original KI-0046 revision/repository/code-copy/provenance/snippet,
  non-CAPTURED safety, and five-payload cases; a valid clean CAPTURED record;
  both committed records; and the exact frozen KI-0047 output.
- Local verification: typecheck, ESLint, Prettier, two read-only manifest
  checks, and complete package tests exit 0. Preserved W01 is 108/108, W02
  57/57, full fixtures 166/166, mock ATS 32/32 plus typecheck/build, and
  Playwright 59/59 across 17 files. Frozen/locked pnpm, uv, and both Cargo
  fetches exit 0. Focused Python suites pass: integrity 43, suite states 294,
  real-repo proofs 7, traceability 62, v1.4 migration 31, and status-validator
  148; full `scripts/tests` is 976/976. Status passes 45 groups, traceability
  passes 193 requirements / 300 packages, and generated contracts remain 183
  files byte-identical. Doctor reports 22 pass / 1 expected uncommitted-writer
  warning / 0 fail / 1 not-yet-applicable. `pnpm verify` exits 0: typecheck
  11/11 tasks; unit TypeScript 2,816 (contracts 2,440, fixtures 166,
  evaluation baselines 171, mock ATS 32, seven one-test packages); focused
  contracts 662; Playwright 59; exact POSIX Python inventory 977; Rust 1 plus
  10; every ACTIVE suite PASS; visual truthfully NOT_YET_APPLICABLE.
- Scope/governance: traceability ownership/dependency/gate-effect truth,
  W01/W02 fixtures, legacy record data, one-shot/original/overlap baselines,
  mock lab, evaluation runner, holdout, extension, scanner, resolver, drivers,
  runtime/model lock, production prompt registry, critical gates, and
  M02-W05/later behavior are untouched. KI-0046 and KI-0047 remain
  HIGH/IN_PROGRESS pending this correction's exact-SHA three-OS hosted result
  and a separate fresh GPT-5.6 Sol Ultra acceptance verifier. M02-W04 remains
  IN_PROGRESS and unaccepted; M02-W05 remains NOT_STARTED; no package is
  READY; M02-W01/W02/W03 remain VERIFIED; M02 remains IN_PROGRESS; all gates
  remain NOT_EVALUATED; release remains NOT_READY. No governance closeout
  occurred.

### M02-W04 — Narrow correction of independently reproduced acceptance blockers (2026-08-07)

- Revision boundary: forward-only corrective writer working tree over exact
  blocked content commit `7fcdfa34797c29289737f558a7826cd12fb42fc0` /
  tree `616a1a8048f5d91ed67cae899b60ea0f3a882481`, parent
  `d8148d68790a49bea13437d13ea049aa574e75ce`; starting HEAD and
  `origin/main` were equal and the writer tree was clean. JAPP-MASTER-001
  v1.4 remained byte-exact at SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  The containing correction commit/tree is reported post-commit under the
  repository anchoring convention. Owner-selected corrective writer model:
  GPT-5.6 Sol Ultra. The original `7fcdfa3` content is blocked historical
  implementation evidence, not a VERIFIED revision.
- Independent findings and pre-edit reproduction: the independent GPT-5.6
  Sol Ultra acceptance verifier reported exactly two bounded blockers. An
  inline temporary reproduction outside committed bytes called
  `validateLegacyObservationFile` against three variants and recorded
  positive acceptance for every invalid state:
  `ACCEPTED: UNAVAILABLE + fabricated safety`,
  `ACCEPTED: CAPTURED + source_revision main`, and
  `ACCEPTED: CAPTURED + const copied = 1;`. The separate exact stuffing
  reproduction for original `Analyst with Excel experience.` and target
  `SQL` returned
  `"Analyst with Excel experience.\n\nSkills: sql"`,
  `inserted_terms=["sql"]`,
  `insertion_format=SKILLS_LINE_COMMA_SEPARATED`, and
  `grounded_in_evidence=false`.
- KI-0046 correction: `safety_observations` is retained after parsing and is
  subject to the same clean-room observation boundary as
  `structured_observations`. Every status other than CAPTURED now requires
  all five payload channels to be empty/absent: `fixture_inputs`,
  `observed_output_digest`, `structured_observations`,
  `safety_observations`, and `regression_fixture_refs`; the explicit reason
  and `comparable=false` rules remain. Any non-null Git revision must be one
  full lowercase 40-hex commit SHA, and CAPTURED additionally requires its
  repository URL. The observation-only plain-language boundary retains the
  existing credential/email/traversal/snippet checks and rejects bounded
  source shapes including declarations, static imports/modules, assignments,
  operators, braces, backticks, arrows, calls, and function/control
  statements without applying that stricter grammar to general procedure or
  provenance prose. This is not a generic language detector. Both committed
  records remain byte-identical and truthful: CareerPulse UNAVAILABLE,
  legacy JobApply NOT_ATTEMPTED, empty observation payloads,
  `source_code_viewed=false`, `code_copied=false`, and no fabricated CAPTURED
  record.
- KI-0047 correction: the intentionally naive lexical baseline still inserts
  target-only terms once in deterministic normalized order, but only inside
  the exact artifact annotation
  `[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: …]`.
  No target-only term is placed under a Skills, Experience, Qualifications,
  Technologies, or similar claim-bearing heading. The original input remains
  separately preserved, no-op output remains byte-identical, duplicate
  prevention and a second pass remain deterministic/idempotent,
  `grounded_in_evidence=false`, and the artifact remains
  UNVERIFIED/EVALUATION_ONLY/NON_PRODUCTION with no factual or gate authority.
- Versioning and reviewed truth: because the committed README/manifest promise
  frozen behavior with no silent default drift, the smallest truthful patch
  bumps the catalog, naive-stuffing algorithm, and legacy-validation algorithm
  from 1.0.0 to 1.0.1. Catalog schema 1, legacy record/file version 1.0.0,
  `_v1` IDs, package 0.0.1, the 34-case development matrix/version, and every
  unrelated algorithm/prompt version remain unchanged. The test-owned oracle
  was deliberately edited from reviewed expected truth to oracle 1.0.1; its
  fixture stuffing output hash is now
  `sha256:822d5699c1f6d22f292c7b36be0691cfd955f376ac3310948a19b7c9c14780a5`.
  It is never imported by production implementation code.
- Manifest reconciliation: the explicit `baselines:write` authoring command
  was used exactly once after source review. Catalog digest changed from
  `sha256:cbcad2219667d7efe78a170fa83039658ac4e727c1a0617519611f1187bd7384`
  to
  `sha256:e2b45d1ffd71f5328c56f65cca23dd4cf425fd2f06d543b069abfb1456fc4f20`;
  combined digest changed from
  `sha256:db8eac35318da668fb837bee44fccd66c85c1f97be88ed15e1245dc672477519`
  to
  `sha256:5b5e0307743ac0c339cac638c1cff2bf85d0d497d8c5dae463d931f3356d5994`.
  Only the five expected source hashes changed (`catalog.ts`, `index.ts`,
  `keyword-stuffing.ts`, `legacy-observation.ts`, `model.ts`). Two subsequent
  `baselines:check` runs reported that same combined digest; the complete
  working diff SHA-256 was identical before/after each check, proving both
  were read-only. Case count/digest, both prompt digests, all unrelated source
  hashes, and the legacy observation file digest
  `sha256:2a979f5592cbbc5c84fefcc241c3d0c95fb346c77e7b0ac2d2dcd66d9de5bcfb`
  remained unchanged.
- Direct regressions: legacy tests cover UNAVAILABLE, UNRUNNABLE, and
  NOT_ATTEMPTED with non-empty safety payload; independent rejection of each
  of the five non-capture payload fields; CAPTURED revisions `main`, `HEAD`,
  and a short SHA; missing CAPTURED repository coordinate;
  `const copied = 1;`, a static import, and a representative function in both
  structured and safety observations; the full immutable-SHA clean-room
  CAPTURED positive; and both committed non-captured records with every
  payload field empty. Stuffing tests cover the exact audit input, explicit
  non-claim wording, deterministic normalized order, already-present-term
  suppression, byte-identical no-op, second-pass idempotence, and exact
  implementation/catalog/README/oracle format agreement. The finite mutation
  matrix rejects restoration of a claim-bearing `Skills:` heading with an
  explicit corrected positive control.
- Post-correction auditor reproduction: the same three invalid legacy cases
  now return, respectively,
  `LEGACY_OBSERVATION_UNCAPTURED_SAFETY /records/0/safety_observations`,
  `LEGACY_OBSERVATION_SOURCE_REVISION /records/1/source_revision`, and
  `LEGACY_OBSERVATION_SOURCE_SNIPPET /records/1/structured_observations/0`.
  The exact stuffing input now returns
  `"Analyst with Excel experience.\n\n[EVALUATION-ONLY UNGROUNDED TARGET TERMS — NOT CANDIDATE SKILLS OR EXPERIENCE: sql]"`,
  the new insertion-format ID, and `grounded_in_evidence=false`.
- Focused/local verification: affected legacy plus stuffing tests 44/44;
  fixed finite mutations 13/13; complete `@japp/evaluation-baselines` suite
  118/118 across 9 files; typecheck, ESLint, Prettier, and both manifest checks
  exit 0. Preserved W01 is 108/108, W02 57/57, full fixtures 166/166, mock ATS
  unit 32/32 plus typecheck/build, and Playwright 59/59 across 17 files.
  Frozen/locked pnpm, uv, and both Cargo fetches exit 0. Focused Python suites
  pass: integrity 43, suite states 294, real-repo proofs 7, traceability 62,
  v1.4 migration 31; full `scripts/tests` is 976/976 and the canonical POSIX
  inventory is 977/977. Status validation passes all 45 groups, traceability
  passes 193 requirements/300 packages, and generated contracts remain 183
  files byte-identical.
- Complete repository verification: local doctor reports 22 pass / 1 expected
  uncommitted-writer warning / 0 fail / 1 not-yet-applicable. `pnpm verify`
  exits 0: typecheck 11/11 tasks; unit TypeScript 2,763 (contracts 2,440,
  fixtures 166, evaluation baselines 118, mock ATS 32, seven one-test
  packages); focused contracts 662; Playwright 59; Python 977; Rust 1 plus
  10; every ACTIVE suite PASS; visual truthfully NOT_YET_APPLICABLE.
  Verification produced no tracked drift.
- Protected truth/scope: `model/model-lock.json` remains byte-identical at
  SHA-256
  `b0ca4bb23d85499e95359993f802057a68d510031d0b2ee81230d3747e65ad82`;
  `prompts/registry.yaml` remains byte-identical at
  `34db63d8702f5d457bb45a5f0f70a83513372842e00408bd2fa8cb8d17be5ea5`;
  Python inventory remains byte-identical at
  `37f6199a380853d42386ff9f54dcc5c77223f8bddbc40f6970189cf6f26433a5`.
  No W01/W02 fixture truth, workflow, toolchain, production prompt, model
  lock, critical-gate state, traceability ownership/dependency/gate effect,
  or M02-W05/later behavior changed. Existing REQ-GATE-007/008 paths and the
  M02-W04 evidence anchor remain accurate, so no traceability hash/view churn
  was required.
- Governance: correction implementation evidence only. KI-0046 and KI-0047
  remain HIGH/IN_PROGRESS pending exact correction-SHA Ubuntu/macOS/Windows
  hosted success and a separate independent GPT-5.6 Sol Ultra acceptance
  session. M02-W04 remains IN_PROGRESS and unaccepted; M02-W05 remains
  NOT_STARTED; no package is READY; M02-W01/W02/W03 remain VERIFIED; M02
  remains IN_PROGRESS; all four critical gates remain NOT_EVALUATED; release
  remains NOT_READY. No governance closeout occurred.

### M02-W04 — Capture evaluation baseline algorithms (2026-08-07)

- Revision: implementation working tree over parent commit
  `d8148d68790a49bea13437d13ea049aa574e75ce` (pre-evidence staged tree
  `d8a82a682e243286c5d3e5de6874a17dfee852bc`); the containing commit is
  recorded post-commit per the anchoring convention. Owner-selected
  implementation agent: Claude Fable 5 Max, single writer.
- Environment: macOS (Apple Silicon, Darwin 27), Node 24.18.0 with pnpm
  11.17.0, uv-managed Python 3.12.13, Rust 1.97.1, pinned Playwright
  Chromium; installs remained frozen/locked (`pnpm install
  --frozen-lockfile`, `uv sync --locked`, and both `cargo fetch --locked`
  manifests → exit 0 after the reviewed one-importer lockfile update) and
  `scripts/python-test-inventory.v1.json` is byte-identical (no Python node
  ID changed).
- Scope: new test-only workspace package `packages/evaluation-baselines`
  (`@japp/evaluation-baselines`) owned by M02-W04 (spec §8.4, §5.13,
  §0(16); REQ-GATE-007/008) — a versioned EVALUATION_ONLY/NON_PRODUCTION
  baseline catalog (1.0.0 / schema 1, canonical digest
  `sha256:cbcad2219667d7efe78a170fa83039658ac4e727c1a0617519611f1187bd7384`)
  holding six distinct baselines: exact original-untailored passthrough
  (text byte-identical; structured records digest-identical with proven
  input non-mutation), a transparent keyword-overlap lexical unigram
  matcher (frozen NFKC/lowercase/`[a-z0-9+#&.]`/hyphen-slash-split/
  trailing-dot/unique-sorted normalization 1.0.0; score = unique matched /
  unique target terms with explicit zero-denominator flag; full term-set
  transparency; explicitly LEXICAL_ONLY_NOT_SEMANTIC_MATCHING), an
  intentionally weak naive keyword-stuffing transform (missing terms
  appended once as `\n\nSkills: …` in sorted order; byte-identical when
  nothing is missing; idempotent; UNVERIFIED/ungrounded; no invented
  achievement, employer, date, metric, certification, tool, or experience
  claim), one-shot résumé and short-answer generation through an injected
  `generateOnce` boundary (versioned baseline-owned prompts
  `baseline_prompt_one_shot_resume` 1.0.0 digest
  `sha256:87bc34d473eb1538c82b1d81fe39f366ddd912e46c21de84952ef6685d7dd22d`
  and `baseline_prompt_one_shot_answer` 1.0.0 digest
  `sha256:e229eb1610841add3bf1abce99d3a97968b7b3368c111587f7acfed9c81be8f2`;
  exactly one call, no retry/repair/second-model/retrieval/tools/
  verification/fallback; raw output preserved verbatim as UNVERIFIED with
  factual_authority NONE; real-model execution truthfully
  NOT_EXECUTED_NO_APPROVED_MODEL_LOCK), and an isolated
  legacy-behavior-observation contract with committed truthful records —
  CareerPulse UNAVAILABLE (no pinned coordinates exist in project memory)
  and legacy kalwad/JobApply NOT_ATTEMPTED with one bounded metadata-only
  GitHub API probe (no clone, no code fetch, no execution, no source
  viewed) pinning default branch `main`, head commit
  `c937e366b9f7566a5c3b6a9d3fafc8f7d25272bd`, and license NOASSERTION.
  A closed Simplify comparison slot is truthfully NOT_CAPTURED with future
  owners M02-W13/M02-W14/M05-W11. A 34-case development matrix (10 overlap,
  3 original, 5 stuffing, 4 one-shot résumé, 6 one-shot answer, 6 legacy
  validation scenarios) binds the public W01/W02 corpus; the test-owned
  literal oracle `test/m02-w04/oracles/baseline-truth.v1.json` was derived
  once from a reviewed run and spot-verified independently (Python sha256
  recomputation of the resume prompt template, the resume-1 fact
  projection, and the job-1 block projection all matched exactly), and the
  implementation never reads it. `baseline.manifest.json` commits canonical
  digests over catalog, prompts, case matrix, observation records, and
  every `src/` file; `baselines:check` recomputes read-only and
  `baselines:write` is the explicit authoring command. No evaluation
  runner, threshold, aggregate scoring, result issuance, corpus freeze,
  holdout content/manifest, extension, scanner, resolver, driver,
  benchmark harness, gate artifact, model runtime/lock, production prompt
  registry entry, retrieval/repair loop, ATS compatibility claim, live
  employer interaction, or product UI was created. `model/model-lock.json`
  and `prompts/registry.yaml` remain byte-identical placeholders (asserted
  by test), and the benchmark contracts are untouched.
- Layering: the baseline package depends only on `@japp/test-fixtures`
  (workspace link) plus catalog-pinned `@types/node`/`typescript`/`vitest`;
  no new external dependency, no network/provider/time/randomness/
  environment dependence (static source-policy test). No workspace package
  depends on the baseline owner (asserted by test). The M02-W01 fixture
  governance test `governance-discovery.test.ts` («keeps the fixture
  package outside every product dependency graph») previously asserted an
  empty consumer set because no consumer existed; it now asserts the exact
  reviewed allowlist `["packages/evaluation-baselines"]` and additionally
  proves that consumer is private, named `@japp/evaluation-baselines`, and
  explicitly NON_PRODUCTION — product packages still cannot consume the
  fixture package, and no fixture datum or W01 truth changed (W01 count
  remains 108/108).
- Commands and observed results:
  - `pnpm install` (reviewed one-importer lockfile update) then
    `pnpm install --frozen-lockfile` → exit 0.
  - `pnpm --filter @japp/evaluation-baselines typecheck` → exit 0;
    `pnpm exec eslint packages/evaluation-baselines` → exit 0 (typed
    strict); `pnpm exec prettier --check packages/evaluation-baselines` →
    clean (the two byte-exact canonical JSON artifacts are prettier-ignored
    with a recorded rationale, mirroring the canonical-docs and
    deterministic-baseline precedents).
  - `pnpm --filter @japp/evaluation-baselines baselines:write` (explicit
    authoring) then `baselines:check` twice → OK both times with identical
    combined digest
    `sha256:db8eac35318da668fb837bee44fccd66c85c1f97be88ed15e1245dc672477519`
    (catalog v1.0.0 schema 1, 34 cases, 2 legacy observation records);
    check mode changed no tracked bytes.
  - `pnpm --filter @japp/evaluation-baselines test` → 95/95 across 9 files
    (catalog/case-matrix identity and classification truth, frozen
    normalization semantics incl. NFKC fullwidth folding and kept
    `c++/c#/.net/r&d` specials, oracle-exact overlap term sets and
    numerator/denominator scores for all ten scenarios incl. zero
    denominator and misleading-overlap, passthrough byte/digest identity
    with input non-mutation, exact stuffing outputs with idempotence and
    UNVERIFIED labeling, one-shot exactly-once/failure/no-fallback/digest
    stability with fabricated-metric raw preservation, committed legacy
    records and fourteen closed-contract rejection classes, manifest
    integrity and read-only check neutrality, package layering,
    model-lock/prompt-registry boundaries, static source policy, and the
    finite mutation matrix — overlap-formula drift, normalization drift,
    prompt tampering at both digest and committed-manifest layers,
    NON_PRODUCTION removal, second generator call, retry after failure,
    silent fallback substitution, provenance stripping, source-code field,
    nondeterministic identity, manifest and data tampering — each with an
    explicit positive control).
  - Regressions: `pnpm --filter @japp/test-fixtures exec vitest run
    test/m02-w01 --no-file-parallelism --maxWorkers=1` → 108/108;
    `… test/m02-w02 …` → 57/57; `pnpm --filter @japp/test-fixtures test` →
    166/166; `pnpm --filter @japp/mock-ats-lab test` → 32/32;
    `pnpm --filter @japp/mock-ats-lab build` → exit 0;
    `pnpm exec playwright test --list` → 59 tests in 17 files;
    `pnpm exec playwright test` → 59/59 in real pinned Chromium.
  - `uv run pytest -q scripts/tests/test_integrity.py` → 43 passed;
    `scripts/tests/test_suite_states.py` → 294 passed;
    `scripts/tests/test_proofs_and_real_repo.py` → 7 passed (workspace
    script counts 10 → 11 from actual discovery);
    `scripts/tests/test_v14_migration.py` focused with
    `test_proofs_and_real_repo.py` → 38 passed (the reviewed
    evaluation-baselines importer must appear exactly once with its exact
    pins and the complete current lockfile is pinned by reviewed SHA-256
    `c69c28bb8f2083d105f8190a7027131a808ba10d229b5525a8f1c1dd936170a1`;
    uv.lock and Cargo.lock digests unchanged); full `uv run pytest -q
    scripts/tests` → 976 passed (the 977th inventory item runs from
    `services/orchestrator/tests` in the canonical verifier command;
    platform inventories remain 977 POSIX / 975 Windows, byte-identical
    file).
  - `python3 scripts/validate_status.py` → PASS (45 groups);
    `uv run python scripts/traceability.py generate` then
    `pnpm traceability:check` → PASS (193/300) after the reviewed
    REQ-GATE-007/REQ-GATE-008 SCAFFOLD_ONLY update re-locked the v1.4
    requirement-mapping hash to
    `21fec7167e31ac8fd7ab31ba2eb4861f046b51546f271baa2ad3618ded0bdb6c`
    (package dependency hash unchanged);
    `pnpm generate:contracts --check` → 183 files byte-identical;
    `pnpm run doctor` → 22 pass / 1 warning (uncommitted work in
    progress) / 0 fail / 1 not-yet-applicable.
  - `pnpm verify` → exit 0 with every ACTIVE suite PASS and visual
    truthfully NOT_YET_APPLICABLE; unit-ts now runs 2,740 tests
    (2,440 contracts + 166 fixtures + 95 evaluation-baselines +
    32 mock-ats-lab + seven one-test packages, 11/11 turbo tasks);
    e2e-browser runs all 59 Playwright tests through the lab webServer;
    the canonical python suite passes after the reviewed fixture-repo
    anchor extension in `scripts/tests/test_traceability.py` (the isolated
    trace-repo fixture now copies the four M02-W04 completed-path anchors,
    following the same pattern as the M01-W06/M01-W07 anchors; no Python
    node ID changed); verification changed no tracked bytes and
    `git diff --check` stayed clean.
- Manual validation (spec §1.3(6)): no UI, browser surface, or document
  renderer is owned by this package (deterministic algorithms, records,
  and validation only), so browser/UI inspection is not applicable; the
  real-browser obligation for this milestone remains with the M02-W03 lab
  and later extension packages. Deterministic replay was inspected
  directly: two consecutive `baselines:check` runs and repeated in-test
  executions produced byte-identical results, and the one-shot digest
  stability test pins identical prompt/input digests across runs.
- Security/privacy: all committed data is synthetic reserved fixture
  content; the legacy observation records contain no source code, no
  snippet, no credential, no PII, and no real applicant datum (validator
  refuses source-snippet, credential, non-example.test email, traversal,
  and time/random identity shapes; `code_copied` can never be true). The
  bounded legacy probe was metadata-only against the public GitHub API;
  no legacy code was cloned, fetched, viewed, executed, or copied, and no
  live employer workflow was touched. No network access exists in package
  code or tests (static source policy); prompts are evaluation-only and
  never entered the production registry.
- Scope and governance: implementation evidence only. M02-W04 remains
  IN_PROGRESS and unaccepted; no package is READY; M02-W01, M02-W02, and
  M02-W03 remain VERIFIED at their preserved trees (the W01 consumer-
  allowlist evolution is a reviewed W04 integration, not a reopening —
  no W01 fixture byte or truth changed); M02 remains IN_PROGRESS; M00 and
  M01 remain ACCEPTED; all four critical gates remain NOT_EVALUATED (this
  package neither evaluates a gate nor claims production ATS support —
  baselines are an evaluation comparison floor with gate_authority NONE);
  visual regression remains truthfully NOT_YET_APPLICABLE (M10-W06 owns
  the first mandated surface); the release gate remains NOT_READY. The
  exact hosted three-OS run for the ending content SHA and the separate
  fresh verification plus governance closeout remain pending and are bound
  in the implementation handoff.

### M02-W03 — Governance closeout after independent Fable verification (2026-08-07)

- Revision: verified content commit `e3a5859d0e30823ca81384cb7cfd53d1951afc64`
  / tree `63c2dd89c4f02b6ba929b52f8fb862e9e3880758`; parent commit
  `b4e48101df78b89107aec2de6f1d1c877c3f5513`. The governance commit containing
  this entry is recorded post-commit per the anchoring convention; it changes
  governance documents only.
- Environment: independent Fable 5 Max verification session on macOS (Apple
  Silicon, Darwin 27), Node 24.18.0 with pnpm 11.17.0, uv 0.11.32 with
  uv-managed Python 3.12.13, Rust 1.97.1, pinned Playwright Chromium; all
  execution occurred in a disposable no-hardlinks exact-SHA clone prepared
  with `pnpm install --frozen-lockfile`, `uv sync --locked`,
  `pnpm exec playwright install chromium`, and both `cargo fetch --locked`
  manifests, with zero lockfile/workflow/toolchain/generated-contract/
  specification drift. Hosted evidence ran on ubuntu-24.04, macos-15, and
  windows-2025 GitHub-hosted runners.
- Verdict: the owner-directed fixed-scope Fable verification returned
  `FABLE_CLEAR_FOR_M02_W03_GOVERNANCE`. The finite contract matrix —
  catalog identity and deterministic build, native and framework-controlled
  behavior, dynamic and rerender behavior, the multipage flow, browser
  boundaries (iframe, open shadow, combobox/listbox, virtualization), the
  remaining required fixtures (date/phone, upload, validation, honeypot,
  prompt injection), and network/safety isolation — was confirmed against
  the complete diff from parent `b4e4810` (84 files / 7,556 insertions / 54
  deletions; the handoff's 83/7,388/54 figure corresponds exactly to that
  diff excluding the +168-line append-only docs/TEST_EVIDENCE.md
  implementation entry). No additional requirement was invented and no
  campaign beyond the fixed scope was run.
- Finite independent checks (every implementation, unit-test, and
  e2e/mock-ats-lab file read in full): the catalog carries version 1.0.0 /
  schema version 1 with exactly 32 cases across exactly 16 routes, unique
  sorted `MAL-###-###` IDs, provenance, and explicit synthetic-data status;
  `catalog.manifest.json` pins canonical SHA-256
  `a1fb06f97b156785937b1b6251cf9cd96d330c39e6cab274aafd63f10ccf4c28`, which
  `catalog:check` reproduced (32 cases, 16 routes); the test-side
  `e2e/mock-ats-lab/support/expected-transitions.ts` covers the 32 catalog
  IDs exactly 1:1; no `data-expected*`/`data-sensitive*`/`data-honeypot*`
  attribute or other expected-value, sensitivity-decision, or
  scanner-ground-truth datum exists in served DOM or page code (static
  source scan plus a browser all-attribute sweep); two consecutive clean
  builds produced byte-identical 41-file inventories and SHA-256 hashes;
  page code contains no randomness, wall-clock, locale, or
  environment-derived identity (all delays are the fixed 400/500/500/600 ms
  constants; receipts are ordinal `RCPT-MOCK-####`).
- Direct real-browser confirmation (bundled pinned Chromium through the
  root webServer on 127.0.0.1:4761): native controls expose realistic
  labels, options, required/optional states, sensitive/consequential
  questions, and native plus custom validation; React 19.2.8
  (`react-dom/client` + hooks) and Vue 3.5.41 (`reactive` + render
  functions) run as real controlled runtimes — browser events update
  accepted framework state, direct stale DOM writes never become accepted
  state and are discarded on rerender, forced and fixed-delay rerenders
  preserve state, and the site-side rewrites (React email lowercased on
  blur; Vue employee ID uppercased on input) are observable; conditional
  insertion/removal drives dependent required state, the 400 ms delayed
  insertion is deterministic, and node replacement creates a distinct node
  while the stable control keeps identity and value; the three-step flow
  blocks Next on validation, preserves values through Back and forward
  navigation, renders every persisted answer on review, pauses on the
  CAPTCHA placeholder (explicit reason, Next disabled, pause survives
  reload) until the labeled test-only manual action, issues the
  deterministic 600 ms receipt `RCPT-MOCK-0001`, warns on duplicate
  submission without issuing a second receipt, and resets both storage
  keys to null; the same-origin iframe carries frame-local identity,
  validation, and isolation; the open shadow-root control is accessible
  and validates on a stable host (no closed-shadow support is claimed);
  the ARIA combobox and listbox support full keyboard interaction with
  exact option identity and an empty/no-match state; the virtualized
  listbox holds 480 semantic options while mounting only a bounded window
  (~13–17 nodes), re-windows on scroll, selects offscreen options through
  ordinary scrolling/keyboard interaction, and preserves the committed
  selection across rerender; the composite date and phone widgets
  normalize and validate deterministically (leading zeros, impossible-day
  and leap-year rules, ISO commit; separator stripping, exact per-country
  national lengths, E.164 commit); upload accepts/rejects/oversizes/clears
  with exact filename/type/size metadata from in-memory synthetic buffers
  only; custom, cross-field, and 500 ms delayed validation clear on
  correction and block the continue action; the honeypot is present,
  visually hidden off-viewport, optional, blank under ordinary completion,
  and rejects a populated local submission; both prompt-injection fixtures
  render as inert visible text (zero child elements, zero scripts or
  images materialized, `__labInjectionExecuted` undefined, form behavior
  unchanged).
- Seven fixed mutations (each in a fresh disposable exact-SHA copy,
  removed afterward; no broader campaign was run):
  (1) a catalog case changed without updating the manifest →
  `catalog:check` exit 1 on the digest mismatch and the unit manifest test
  failed; (2) a duplicated stable case ID → the unique-ID and manifest
  digest unit tests failed; (3) `data-expected-value` and
  `data-sensitive-policy` attributes added to a served control → the
  source-policy leakage scan failed and the browser metadata-leak proof
  failed on the served DOM; (4) a non-loopback `fetch` added to a page →
  the source-policy external-URL and network-API scans failed and the
  browser network-isolation proof failed (both the spec assertion and the
  shared auto-fixture flagged the non-loopback request); (5) the
  prompt-injection fixture rendered through `innerHTML` → the
  source-policy sink scan failed and the browser injection proof failed
  (the fixture text was parsed as markup instead of remaining visible
  text); (6) receipt identity replaced with `Date.now()` → the
  source-policy wall-clock scan and both receipt determinism tests failed;
  (7) the bounded window replaced with all 480 options mounted at once →
  the virtualized browser proofs failed (480 mounted nodes rejected;
  scroll re-windowing disproven). All seven rejected as required.
- Commands and observed results (disposable exact-SHA clone; every
  required command exited 0):
  `pnpm --filter @japp/mock-ats-lab catalog:check` → OK (32 cases, 16
  routes, digest above); `... typecheck` → exit 0; `... test` → 32/32
  across 4 files; `... build` twice → byte-identical 41-file output;
  `pnpm exec playwright test --list` → 59 tests in 17 files;
  `pnpm exec playwright test` → 59/59 (58 mock-ATS-lab tests + the
  preserved browser-infrastructure smoke test); focused
  `vitest run test/m02-w01` → 108/108; `vitest run test/m02-w02` → 57/57;
  `pnpm --filter @japp/test-fixtures test` → 166/166;
  `uv run pytest -q scripts/tests/test_integrity.py` → 43 passed;
  `test_suite_states.py` → 294 passed; `test_proofs_and_real_repo.py` → 7
  passed; full `scripts/tests` → 976 passed (the 977th inventory item runs
  from `services/orchestrator/tests` in the canonical verifier command);
  `python3 scripts/validate_status.py` → PASS (45 groups);
  `pnpm traceability:check` → PASS (193/300);
  `pnpm generate:contracts --check` → 183 files byte-identical;
  `pnpm run doctor` → 23 pass / 0 warning / 0 fail / 1 not-yet-applicable;
  `pnpm verify` → exit 0 with every ACTIVE suite PASS and visual
  truthfully NOT_YET_APPLICABLE (unit TypeScript 2,645 = 2,440 contracts +
  166 fixtures + 32 mock-ats-lab + seven one-test packages, 10/10 turbo
  tasks; focused contracts 662; e2e-browser 59; Rust 1 plus 10; Python
  977/977 POSIX items); `git diff --check` and `git status --short` clean
  after the complete chain.
- Manual/UI validation (spec §1.3(6); functional fixture inspection, not
  product visual approval): all 17 top-level routes plus `/frames/inner/`
  were loaded in bundled Playwright Chromium (18/18 at HTTP 200 with the
  synthetic-lab notice present on every top-level page), and the
  CAPTCHA-pause, review, receipt, duplicate-warning, reset, and both
  prompt-injection display states were exercised interactively; keyboard
  behavior confirmed on the combobox (Tab order input → check button →
  listbox; filter + Enter commit), the listbox (ArrowDown + Enter), and
  the virtualized listbox (PageDown + Enter committing the exact
  deterministic offscreen option); zero browser-console errors, zero page
  errors, zero failed requests, and zero non-loopback requests across the
  entire inspection (166 requests total, every one to
  `http://127.0.0.1:4761/`); no horizontal overflow and no clipped or
  unusable visible control on any inspected route (the honeypot's
  off-viewport concealment is the deliberate exception). No screenshot or
  visual baseline was committed.
- Hosted evidence: the committed workflow supports `workflow_dispatch`,
  and content run `31129161772` (event `workflow_dispatch`, run attempt 1,
  branch `main`) was manually dispatched at head SHA exactly
  `e3a5859d0e30823ca81384cb7cfd53d1951afc64` after no push-triggered run
  had appeared for the pushed content commit; it succeeded with doctor +
  verify (ubuntu-24.04) job `92713466366`, doctor + verify (macos-15) job
  `92713466380`, and doctor + verify (windows-2025) job `92713466359` all
  successful. Every raw job log was inspected: each job checked out the
  exact content SHA, reported doctor 23 pass / 0 warning / 0 fail / 1
  not-yet-applicable, ran 59/59 Playwright tests (17 files), 32/32
  mock-lab unit tests, W01 108/108 and W02 57/57 with the fixture package
  at 166/166, contracts 662 and 2,440 with 10/10 turbo tasks and Rust 1
  plus 10, collected and passed the platform-exact Python inventory
  (977/977 on ubuntu-24.04 and macos-15; 975/975 on windows-2025),
  reported privacy 32 files / 36,773 scalar fields and discovery 12
  collections / 617 records, printed `verification exit code: 0` with
  every ACTIVE suite PASS and visual truthfully NOT_YET_APPLICABLE, and
  passed the tracked-cleanliness assertion; the raw windows-2025 log
  contains zero EPERM occurrences. The initially absent push-triggered
  delivery is classified `EXTERNAL_DELIVERY_GAP_NONBLOCKING`: the manually
  dispatched exact-SHA run is fully proven, and a late push-triggered run
  `31129599140` for the same exact SHA in fact materialized about 21
  minutes after the dispatch and also succeeded on all three jobs
  (`92715277107` windows-2025, `92715277119` ubuntu-24.04, `92715277151`
  macos-15), confirming the gap was delayed rather than lost delivery.
- Lifecycle result: M02-W03 becomes VERIFIED at content tree
  `63c2dd89c4f02b6ba929b52f8fb862e9e3880758`, not ACCEPTED; M02-W04
  becomes the sole READY package and was not begun; no package remains
  IN_PROGRESS; M02 remains IN_PROGRESS; M00 and M01 remain ACCEPTED;
  M02-W01 and M02-W02 remain VERIFIED at their preserved trees; all four
  critical gates remain NOT_EVALUATED — package verification did not
  evaluate any critical gate, and the Autofill Feasibility
  evaluation/decision remains owned by M02-W14/M02-W15 — and the overall
  release gate remains NOT_READY. The lab is synthetic research fixture
  behavior only: no product UI exists and no production ATS compatibility
  is claimed (docs/COMPATIBILITY_MATRIX.md is unchanged).
- Artifacts: governance updates to docs/PROJECT_STATUS.md,
  docs/TEST_EVIDENCE.md, docs/traceability.json, and the regenerated
  docs/REQUIREMENTS_TRACEABILITY.md in this closeout commit; hosted job
  logs inspected through authenticated GitHub tooling, including the raw
  windows-2025 log. Every disposable Stage A copy was removed after
  verification.
- Notes: governance-only change. No mock-lab source, unit test, Playwright
  test, fixture datum, schema, package dependency, lockfile, Playwright
  configuration, verifier logic, workflow, product code, or
  canonical-specification byte changed, and no M02-W04 implementation
  bytes exist.

### M02-W03 — Build deterministic mock ATS lab v1 (2026-08-06)

- Revision: implementation working tree over parent commit
  `b4e48101df78b89107aec2de6f1d1c877c3f5513` (pre-evidence staged tree
  `8da98b8fbbb14b678ac3f3759463d82c6e518925`); the containing commit is
  recorded post-commit per the anchoring convention. Owner-selected
  implementation agent: Claude Fable 5 Max, single writer.
- Environment: macOS (Apple Silicon, Darwin 27), Node 24.18.0 with pnpm
  11.17.0, uv-managed Python 3.12.13, Rust 1.97.1, pinned Playwright
  Chromium; installs remained frozen/locked
  (`pnpm install --frozen-lockfile` exit 0 after the reviewed lockfile
  update) and `scripts/python-test-inventory.v1.json` is byte-identical
  (no Python node ID changed).
- Scope: deterministic mock ATS lab v1 under `apps/mock-ats-lab` (spec
  §5.1, §8.2) — one Vite 7.3.6 multi-page app (18 HTML entries rooted at
  `site/`, hash-free unminified byte-deterministic build; two consecutive
  builds hash identically), real React 19.2.8 (`createElement` + hooks via
  `react-dom/client`) and real Vue 3.5.41 (`h()` render functions +
  `reactive`) controlled forms, vanilla-DOM fixtures built through
  text-only helpers, one custom element with an open shadow root, a
  same-origin iframe document, versioned sessionStorage flow/receipt state
  with an explicit reset action, fixed delay constants
  (400/500/500/600 ms), and ordinal receipts (`RCPT-MOCK-####`). Serving
  binds 127.0.0.1 only (dev 4760 / E2E 4761, `--strictPort`); the root
  Playwright config builds and serves the lab per run
  (`reuseExistingServer: false`) with an explicit baseURL. New exact
  dependency pins (react/react-dom 19.2.8, vue 3.5.41, vite 7.3.6,
  @types/react 19.2.18, @types/react-dom 19.2.4 plus catalog
  typescript/vitest/@types/node) are test-only; esbuild's unnecessary
  postinstall is recorded as not executed (`allowBuilds: esbuild: false`
  in pnpm-workspace.yaml; its platform binary comes from
  optionalDependencies). The Vite build configuration is deliberately
  named `vite.lab.config.ts` (explicit `--config` only) so the verifier's
  minimal-auto-loadable-Vitest-config boundary holds; `vitest.config.ts`
  is the minimal static test shape. No extension, scanner, resolver,
  driver, evaluation runner, corpus freeze, holdout body, product UI,
  live-site interaction, production ATS adapter or support claim, or
  critical-gate artifact was created.
- Fixture catalog: version 1.0.0, schema version 1 — 32 cases across 16
  routes with stable `MAL-###-###` IDs, surface tags, provenance, and
  explicit synthetic-data status; committed `catalog.manifest.json` pins
  canonical SHA-256
  `a1fb06f97b156785937b1b6251cf9cd96d330c39e6cab274aafd63f10ccf4c28`
  (recomputed by `catalog:check` and the unit suite). Expected state
  transitions live test-side
  (`e2e/mock-ats-lab/support/expected-transitions.ts`, asserted 1:1
  against the catalog); pages expose realistic labels/ARIA/values only —
  a browser test proves no `data-expected*`/`data-sensitive*`/
  `data-honeypot*` attribute exists in the served DOM.
- Commands and observed results:
  - `pnpm install` (reviewed lockfile update) then
    `pnpm install --frozen-lockfile` → exit 0.
  - `pnpm --filter @japp/mock-ats-lab typecheck` → exit 0;
    `... test` → 32/32 across 4 files (catalog identity/inventory/digest,
    flow/receipt state machines, fixed-delay and loopback-config
    determinism, static source policy: no external URLs or live form
    actions, no HTML-string sinks or dynamic code, no network APIs, no
    randomness/wall-clock identity, no expected-value leakage);
    `... build` → exit 0; `... catalog:check` → OK (32 cases, 16 routes,
    digest above); two clean builds produced identical file-hash sets.
  - `pnpm exec playwright test --list` → 59 tests in 17 files;
    `pnpm exec playwright test` → 59/59 passed in real pinned Chromium
    (58 mock-ATS-lab tests in 16 spec files + the original
    browser-infrastructure smoke test, unchanged). Coverage proven against
    site-visible accepted state: catalog index exposes all 32 cases;
    native required/optional/validation incl. cleared errors; realistic
    sensitive fields with zero fixture-metadata attributes; React and Vue
    values commit through real framework events, persist across forced and
    fixed-delay rerenders, direct stale DOM writes never become accepted
    state, and site-side rewrites (email lowercase, employee-ID uppercase)
    are observable; conditional insertion/removal with dependent required
    state, 400 ms delayed insertion, and node replacement beside a
    stable-identity control; three-step flow with validation-blocked Next,
    Back preservation, full review table, 600 ms delayed deterministic
    receipt `RCPT-MOCK-0001`, duplicate warning without a second receipt,
    and reset returning the exact initial state (both storage keys null);
    CAPTCHA placeholder pauses with explicit reason, survives reload, and
    unlocks only via the labeled test-only manual action; same-origin
    iframe with frame-local identity/validation/isolation; open shadow
    root control with accessible label and validation on a stable host;
    ARIA combobox filtering/keyboard/exact-option-identity/empty-state and
    required-commit check; ARIA listbox keyboard selection; genuinely
    virtualized listbox (480 options, ≤ ~17 mounted, scroll re-windows,
    offscreen selection by scroll+click and keyboard, selection survives
    rerender; `overflow-anchor: none` prevents scroll-anchoring feedback);
    composite date (leading-zero normalization, impossible-day and
    leap-year rules, ISO commit) and phone (separator stripping, exact
    per-country national length, E.164 commit) widgets; upload
    accept/reject/oversize/clear with exact name/type/size metadata from
    in-memory synthetic buffers; custom/cross-field/500 ms
    delayed validation with errors clearing on correction and a blocked
    continue action; prompt-injection text in the help block and job
    description rendered inert (visible as text, zero child elements, zero
    scripts/images materialized, `__labInjectionExecuted` sentinel
    undefined, form behavior unchanged); and a shared auto-fixture that
    fails ANY lab test issuing a non-loopback request (dedicated spec
    additionally inventories full-visit requests → all
    `http://127.0.0.1:4761/`).
  - Regressions: `vitest run test/m02-w01` → 108/108;
    `vitest run test/m02-w02` → 57/57;
    `pnpm --filter @japp/test-fixtures test` → 166/166.
  - `uv sync --locked`, both `cargo fetch --locked` manifests → exit 0.
  - `uv run pytest -q scripts/tests/test_integrity.py` → 43 passed;
    `test_suite_states.py` → 294 passed; `test_proofs_and_real_repo.py` →
    7 passed; full `scripts/tests` → 976 passed (the 977th inventory item
    runs from `services/orchestrator/tests` in the canonical verifier
    command; platform inventories remain 977 POSIX / 975 Windows,
    byte-identical file).
  - `python3 scripts/validate_status.py` → PASS (45 groups);
    `pnpm traceability:check` → PASS (193/300);
    `pnpm generate:contracts --check` → 183 files byte-identical;
    `pnpm run doctor` → 22 pass / 1 warning (uncommitted work in
    progress) / 0 fail / 1 not-yet-applicable.
  - `pnpm verify` → exit 0 with every ACTIVE suite PASS and visual
    truthfully NOT_YET_APPLICABLE; unit-ts now runs 2,645 tests
    (2,440 contracts + 166 fixtures + 32 mock-ats-lab + seven one-test
    packages, 10/10 turbo tasks); e2e-browser runs all 59 Playwright
    tests through the lab webServer; verification changed no tracked
    bytes and `git diff --check` stayed clean.
- Manual/UI validation (spec §1.3(6)): bounded inspection in bundled
  Playwright Chromium after automated tests — all 17 top-level routes plus
  the CAPTCHA-pause, review, receipt, and duplicate-warning interactive
  states were loaded and screenshotted (temporary artifacts under the
  session scratchpad only; none committed), with the fixture index,
  native, virtualized, CAPTCHA, and review captures visually reviewed: the
  synthetic-lab notice is prominent on every page, no text clipping or
  unusable control was observed, the CAPTCHA pause shows its reason with
  Next disabled, and the review table lists every persisted answer.
  Keyboard behavior spot-checked (Tab order on the combobox page:
  input → check button → listbox; arrow/Enter selection in both custom
  widgets). Zero browser-console errors and zero failed requests across
  every inspected route and state.
- Reviewed control updates (no fixture truth or W01/W02 datum changed):
  `scripts/tests/test_proofs_and_real_repo.py` workspace script counts
  9 → 10 (assertion content only);
  `scripts/tests/test_v14_migration.py::test_dependency_lockfiles_preserve_history_except_m02_importer`
  extended — the M02-W01/W02 lockfile stage is now proven byte-identical
  to the immutable verified M02-W02 commit's lockfile, the reviewed
  historical importer bytes must survive in the current lockfile, the
  reviewed M02-W03 mock-ats-lab importer must appear exactly once with its
  exact pins, and the complete current lockfile is pinned by reviewed
  SHA-256 (fail-closed on unreviewed drift; uv.lock and Cargo.lock digests
  unchanged); `scripts/verification-suites.json` e2e-browser explanation
  updated truthfully (no command, proof, or threshold changed); root
  `playwright.config.ts` gained the lab webServer/baseURL with retries 0,
  workers 1, and failure-only artifacts preserved; no Python node ID
  changed anywhere.
- Security/privacy: all values are synthetic reserved data
  (`example.test`, 555-01xx, invented employers); no real resume,
  credential, or applicant datum exists in fixtures or tests; upload tests
  use in-memory synthetic buffers; prompt-injection strings are inert data
  rendered through Text nodes only (unit scan forbids HTML-string sinks
  and dynamic code); the lab performs no external network activity and no
  live submission — a browser-level assertion enforces loopback-only
  requests on every lab test.
- Scope and governance: implementation evidence only. M02-W03 remains
  IN_PROGRESS and unaccepted; no package is READY; M02-W01 and M02-W02
  remain VERIFIED at their preserved trees and were not reopened; M02
  remains IN_PROGRESS; M00 and M01 remain ACCEPTED; all four critical
  gates remain NOT_EVALUATED (this package neither evaluates a gate nor
  claims production ATS support — mock-lab coverage is synthetic research
  fixture behavior, per docs/COMPATIBILITY_MATRIX.md); visual regression
  remains truthfully NOT_YET_APPLICABLE (M10-W06 owns the first mandated
  surface); the release gate remains NOT_READY. The exact hosted three-OS
  run for the ending content SHA and the separate fresh verification plus
  governance closeout remain pending and are bound in the implementation
  handoff.

### M02-W02 — Governance closeout after independent Fable verification (2026-08-05)

- Revision: verified content commit `0c52cab5987a6497e28db5a30186c82a053c88aa`
  / tree `ebe546966ed403f3155dcd04779984671e565d06`; parent commit
  `9da85bcc98c39b071e5047304b0101a2f8397f9d`. The governance commit containing
  this entry is recorded post-commit per the anchoring convention; it changes
  governance documents only.
- Environment: independent Fable 5 Max verification session on macOS (Apple
  Silicon, Darwin 27), Node 24.18.0 with pnpm 11.17.0, uv-managed Python
  3.12, Rust 1.97.1, pinned Playwright Chromium; all execution occurred in a
  disposable no-hardlinks exact-SHA clone prepared with
  `pnpm install --frozen-lockfile`, `uv sync --locked`,
  `pnpm exec playwright install chromium`, and both `cargo fetch --locked`
  manifests, with zero lockfile/workflow/toolchain/generated-contract/
  specification drift. Hosted evidence ran on ubuntu-24.04, macos-15, and
  windows-2025 GitHub-hosted runners.
- Verdict: the owner-directed fixed-scope Fable verification returned
  `FABLE_CLEAR_FOR_M02_W02_GOVERNANCE`. The finite contract matrix —
  taxonomy balance and meaningful paraphrases, context/stale-reuse traps,
  sensitive policy under all six kinds, deterministic exact limits with
  one-below/at/one-above boundaries, insufficient-evidence outcomes,
  evidence-bound supported answers, closed schemas/loader/manifest/privacy,
  and the test-owned literal oracle — was confirmed against the complete
  36-file / 10,245-insertion / 73-deletion diff. No additional requirement
  was invented and no adversarial campaign beyond the fixed scope was run.
- Finite independent checks: the complete diff, all three new closed Draft
  2020-12 schemas, the generator/consistency/metric/loader/CLI extensions,
  all four focused test files, the M02-W02 oracle, and all three committed
  collections were read and independently re-projected: 144 question cases
  in exactly 48 clusters (every cluster exactly one canonical case plus two
  materially reworded paraphrases; 20/20 intents at exactly two BASE
  canonical clusters; zero trivial-variant signatures; zero duplicate
  prompts), all 15 sensitive concepts covered, outcome distribution
  21/5/5/3/7/8/(7+2), all six field-policy kinds exercised through real
  M02-W01 policy records, all eight stale reasons (three verbatim
  cross-company/role/location reuse traps citing released scenarios), all
  eight insufficiency reasons, boundary trios 11/12/13 words and 39/40/41
  code points, zero answer text on any non-released outcome, and zero
  duplicate question/profile/job/date combinations. The oracle is imported
  by test files only; the M02-W01 oracle and every M02-W01 data collection
  remain byte-identical except the reviewed manifest integration.
- Six independent mutations (fresh disposable corpus copies; mutations 1–5
  fully re-signed so byte digests could not mask semantics): (1) a question
  moved to a wrong intent inside its cluster → `QUESTION_CLUSTER_MIXED`;
  (2) the stale-company reuse trap marked releasable with the reused text →
  `STALE_RELEASE_FORBIDDEN` plus `ANSWER_TEXT_FORBIDDEN`; (3) a
  policy-blocked sensitive scenario given releasable answer text →
  `ANSWER_TEXT_FORBIDDEN`; (4) an exact at-limit boundary measurement moved
  by one → `CONSTRAINT_EVALUATION_INCOHERENT`; (5) an insufficient-evidence
  scenario given a released factual answer → `ANSWER_TEXT_FORBIDDEN` plus
  `INSUFFICIENCY_INCOHERENT`; (6) a collection byte tampered without
  updating the manifest → loader `FIXTURE_FILE_DIGEST` rejection. All six
  rejected as required; no further mutation was added.
- Commands and observed results (disposable exact-SHA clone; every command
  exited 0): `pnpm --filter @japp/test-fixtures typecheck`;
  `fixtures:seed:check` (deterministic, status-neutral); `fixtures:validate`
  (full consistency including the answer layer); `fixtures:privacy` — 32
  files and 36,773 scalar fields clean; `fixtures:platform-v1` — 15
  deprecated pairs over 32 producer files; `fixtures:discover` — 12
  non-empty collections, 617 records, 12 focused test files; focused
  `vitest run test/m02-w02` — 57/57 across 4 files; M02-W01 regression
  `vitest run test/m02-w01` — 108/108 across 8 files (combined focused
  registry proof 165); `pnpm --filter @japp/test-fixtures test` — 166/166
  across 13 files; `uv run pytest -q scripts/tests/test_suite_states.py` —
  294 passed; `python3 scripts/validate_status.py` — 45 groups;
  `pnpm traceability:check` — 193 requirements / 300 packages;
  `pnpm generate:contracts --check` — 183 files byte-identical;
  `pnpm run doctor` — 23 pass / 0 warning / 0 fail / 1 not-yet-applicable;
  `pnpm verify` — exit 0 with every ACTIVE suite PASS and visual truthfully
  NOT_YET_APPLICABLE (unit TypeScript 2,613 = 2,440 contracts + 166
  fixtures + seven one-test packages; focused contracts 662; browser 1;
  Rust 1 plus 10; Python 977/977 POSIX); `git diff --check` and
  `git status --short` clean after the complete chain.
- Privacy-count correction (labeled, history preserved): the 2026-08-04
  implementation entry recorded the committed-producer privacy scan as
  "32 files, 36,736 scalar fields". The deterministic scanner output at this
  exact content revision is 32 files and 36,773 scalar fields on every local
  and hosted execution; 36,736 was a prose transposition of 36,773, not a
  scanner or data defect. A correction label is added in place below; every
  other implementation figure reproduced exactly.
- Hosted evidence: final run `30932832896` at head SHA exactly
  `0c52cab5987a6497e28db5a30186c82a053c88aa` succeeded with doctor + verify
  (ubuntu-24.04) job `92071496949` success, doctor + verify (macos-15) job
  `92071496974` success, and doctor + verify (windows-2025) job
  `92071497000` success. Every raw log was inspected: each job checked out
  the exact content SHA, reported doctor 23 pass / 0 warning / 0 fail / 1
  not-yet-applicable, ran the focused suites at 57/57 and 108/108 with the
  complete package at 166/166, reported privacy 32 files / 36,773 scalar
  fields and discovery 12 collections / 617 records, collected and passed
  the platform-exact Python inventory (977/977 on ubuntu-24.04 and
  macos-15; 975/975 on windows-2025), printed `verification exit code: 0`
  with every ACTIVE suite PASS and visual truthfully NOT_YET_APPLICABLE,
  and passed the tracked-cleanliness assertion. The previously observed
  Windows EPERM cleanup race did not recur (zero EPERM occurrences in the
  raw windows-2025 log).
- Manual/UI validation: none — M02-W02 is a fixture-only test-data package
  with no UI, browser, extension, or document surface; spec §1.3(6) manual
  inspection is not applicable and no browser/manual evidence is claimed.
- Lifecycle result: M02-W02 becomes VERIFIED at content tree
  `ebe546966ed403f3155dcd04779984671e565d06`, not ACCEPTED; M02-W03 becomes
  the sole READY package and was not begun; no package remains IN_PROGRESS;
  M02 remains IN_PROGRESS; M00 and M01 remain ACCEPTED; M02-W01 remains
  VERIFIED at its preserved tree; KI-0039 through KI-0045 remain FIXED; all
  four critical gates remain NOT_EVALUATED — package verification did not
  evaluate any critical gate, and the Autofill Feasibility evaluation/
  decision remains owned by M02-W14/M02-W15 — and the overall release gate
  remains NOT_READY.
- Artifacts: governance updates to docs/PROJECT_STATUS.md,
  docs/TEST_EVIDENCE.md, docs/traceability.json, and the regenerated
  docs/REQUIREMENTS_TRACEABILITY.md in this closeout commit; hosted job
  logs inspected through authenticated GitHub tooling, including the raw
  windows-2025 log. The disposable Stage A clone was removed after
  verification.
- Notes: governance-only change. No fixture datum, schema, generator,
  loader, validator, test, product code, workflow, dependency, lockfile,
  toolchain, or canonical-specification byte changed, and no M02-W03
  implementation bytes exist.

### M02-W02 — Create question and answer fixtures (2026-08-04)

- Revision: implementation working tree over parent commit
  `9da85bcc98c39b071e5047304b0101a2f8397f9d` (tree
  `8d281bad76a8a50aac9985d146ad12cf40db74d8`); the containing commit is
  recorded post-commit per the anchoring convention. Owner-selected
  implementation agent: Claude Fable 5 Max, single writer.
- Environment: macOS (Apple Silicon, Darwin 27), Node 24 with pnpm 10, uv
  Python 3.12, Rust 1.97.1, pinned Playwright Chromium; installs remained
  frozen/locked and `scripts/python-test-inventory.v1.json` is byte-identical
  (no Python node ID changed).
- Scope: test-only M02-W02 question/answer development fixtures extending
  `@japp/test-fixtures` in place. Three new closed Draft 2020-12 schemas
  (`question-case:v2`, `answer-constraint:v2`, `answer-scenario:v2`), three
  new development collections, corpus version 0.2.0 → 0.3.0, a
  per-authoring-package review-event model
  (`M02W02_SYNTHETIC_AUTHORING_REVIEW` at 2026-08-04T09:00:00Z; every
  M02-W01 collection file remains byte-identical), a deterministic
  fixture-only word/code-point/line/format metric
  (`src/answer-metrics.ts`), the answer-layer consistency stage
  (`src/answer-consistency.ts`), loader/manifest/CLI/schema-catalog/platform-
  guard extensions, and the deterministic authoring module
  (`scripts/generate-answer-seed.ts`). No product application, service,
  LLM client, prompt registry, embedding, mock ATS, evaluation runner,
  corpus freeze, holdout body, or gate artifact was created.
- Authored matrix: 144 question cases in 48 paraphrase clusters — two BASE
  canonical clusters per v1.4 intent (20 intents, balance exactly 2, fixture
  UPPER_SNAKE_CASE token grammar) plus eight sensitive overlays; every
  cluster has exactly one canonical case and two materially reworded
  paraphrases (word-order/punctuation/case-only variants rejected). All 15
  sensitive/consequential concepts carry a dedicated question. 10 answer
  constraints (word, character, minimum, single-line, multiline, HTTPS-URL,
  Yes/No). 58 answer scenarios: 21 supported narratives, 5 explicit-record
  answers (3 approved field-record disclosures reproduced exactly plus 2
  profile-website links), 5 confirmations, 3 voluntary declines, 7 policy
  blocks, 8 stale-context traps (all 8 reasons incl. verbatim wrong-company,
  wrong-role, and wrong-location reuse traps), and 9 insufficient-evidence
  cases (all 8 reasons; contradicted and presupposed requests classified
  UNSUPPORTED_OR_CONTRADICTED). All six W01 field-policy kinds are exercised
  through real policy references; concepts without W01 records use a
  reviewed fixture-only concept-default matrix. Word and character maxima
  carry exact one-below/at/one-above boundary scenarios (11/12/13 words;
  39/40/41 code points), recomputed deterministically by the validator.
- Commands and observed results:
  - `pnpm --filter @japp/test-fixtures typecheck` → exit 0.
  - `fixtures:seed:check` → exit 0, deterministic and status-neutral;
    `fixtures:validate` → exit 0 (full consistency including the new answer
    layer); `fixtures:privacy` → exit 0 (32 files, 36,736 scalar fields
    clean [correction, 2026-08-05 governance closeout: the deterministic
    scanner output at this content revision is 36,773 scalar fields on every
    local and hosted execution; "36,736" was a prose transposition, not a
    scanner or data defect]); `fixtures:platform-v1` → exit 0 (15 deprecated pairs, 32
    producer files, extended schema-ref/collection expectations);
    `fixtures:discover` → exit 0 (12 non-empty collections, 617 records,
    12 focused test files).
  - Focused `vitest run test/m02-w02` → 57/57 across 4 files
    (answer-consistency-mutations, answer-governance, answer-metrics,
    question-answer-matrix) with a literal test-owned oracle
    (`test/m02-w02/oracles/answer-truth.v2.json`) pinning counts, per-intent
    balance, outcome distribution, policy/concept coverage,
    stale/insufficiency decisions, limit boundaries, explicit bindings,
    reuse traps, and a full projection digest; implementation source does
    not reference it.
  - M02-W01 regression `vitest run test/m02-w01` → 108/108; complete
    fixture package `pnpm --filter @japp/test-fixtures test` → 166/166
    across 13 files.
  - `uv run pytest -q scripts/tests/test_integrity.py` → 43 passed;
    `test_suite_states.py` → 294 passed; `test_proofs_and_real_repo.py` →
    7 passed; full `scripts/tests` → 976 passed (the 977th inventory item
    runs from `services/orchestrator/tests` in the canonical verifier
    command; platform inventories remain 977 POSIX / 975 Windows,
    byte-identical file).
  - `python3 scripts/validate_status.py` → PASS (45 groups);
    `pnpm traceability:check` → PASS (193/300);
    `pnpm generate:contracts --check` → 183 files byte-identical;
    `pnpm run doctor` → 22 pass / 1 warning (uncommitted work in progress) /
    0 fail / 1 not-yet-applicable.
  - `pnpm verify` → exit 0 with every ACTIVE suite PASS and visual
    truthfully NOT_YET_APPLICABLE; the registry `fixture-corpus` suite now
    runs both focused directories with the exact combined proof of 165
    tests; unit-ts runs 2,613 tests (2,440 contracts + 166 fixtures + seven
    one-test packages, 9/9 tasks); verification changed no tracked bytes
    and `git diff --check` stayed clean.
- Reviewed global-shape control updates (no W01 semantic truth changed; the
  W01 oracle file is untouched): `governance-discovery.test.ts` (fourteen-
  schema catalog, thirteen schema refs, corpus 0.3.0, combined registry
  count 165), `corpus-positive.test.ts` (per-entity W01 review-event
  assertion strengthened after the manifest moved to the latest corpus
  review event), `resigned-contradictions.test.ts` (the coherent policy
  drift now also carries through the answer scenario bound to the same
  policy, preserving the oracle-only detection premise),
  `scripts/verification-suites.json` (second focused command, second
  discovery glob, exact 165), and
  `scripts/tests/test_suite_states.py::test_fixture_corpus_transitions_from_nya_to_active`
  (real-repo discovery 8 → 12 files; assertion content only, no node-ID or
  inventory change).
- Security/privacy: all values remain synthetic reserved data; prompts and
  answers pass the committed privacy scanner (no PII shapes, secrets, local
  identities, hidden text, or prompt-injection phrasing); sensitive
  scenarios with prohibited, missing, expired, contradicted, or unconfirmed
  records carry no releasable answer text; no generic Base64 scanning was
  added (KI-0041's excluded hypothesis remains outside this package).
- Scope and governance: implementation evidence only. M02-W02 remains
  IN_PROGRESS and unaccepted; M02-W03 remains NOT_STARTED; no package is
  READY; M02-W01 remains VERIFIED; KI-0039 through KI-0045 remain FIXED;
  all four critical gates remain NOT_EVALUATED; release remains NOT_READY.
  The exact hosted three-OS run for the ending content SHA and the separate
  fresh verification plus governance closeout remain pending and are bound
  in the implementation handoff.

### M02-W01 — Governance closeout after independent Fable acceptance verification (2026-08-03)

- Revision: audited content commit `7523e096b51c1c3a0490924235879d4d6d386b81`
  / tree `666987a702d274aabcee8bbfdfae5afd5d9c18e7`; parent correction commit
  `f1b727450c2a25bfb6f806a51bcde30b9fed156c`. The governance commit containing
  this entry is recorded post-commit per the anchoring convention; it changes
  governance documents only.
- Environment: independent Fable 5 Max acceptance session on macOS (Apple
  Silicon, Darwin 27), Node 24 with pnpm, uv-managed Python 3.12, Rust
  1.97.1, pinned Playwright Chromium; all execution occurred in a disposable
  no-hardlinks exact-SHA clone prepared with `pnpm install --frozen-lockfile`,
  `uv sync --locked`, `pnpm exec playwright install chromium`, and both
  `cargo fetch --locked` manifests, with zero lockfile/workflow/toolchain/
  specification drift. Hosted evidence ran on ubuntu-24.04, macos-15, and
  windows-2025 GitHub-hosted runners.
- Verdict: the required Fable-only acceptance verification returned
  `FABLE_CLEAR_FOR_GOVERNANCE_CLOSEOUT`, confirming `AUD-PLAT-001`,
  `AUD-PLAT-002`, `AUD-PLAT-003`, `AUD-VER-001`, `AUD-VER-002`, and
  `AUD-VER-003` all CLEAR against their committed regression tests and
  implementations. No new technical audit, syntax family, or security probe
  was opened during this closeout.
- Commands and observed results (disposable exact-SHA clone; every command
  exited 0):
  - `uv run pytest -q scripts/tests/test_integrity.py` → exit 0, 43 passed.
  - `uv run pytest -q scripts/tests/test_suite_states.py` → exit 0,
    294 passed.
  - `uv run pytest -q scripts/tests/test_proofs_and_real_repo.py` → exit 0,
    7 passed.
  - `uv run pytest -q scripts/tests` → exit 0, 976 passed; the 977th
    inventory item, `services/orchestrator/tests/test_package.py::`
    `test_package_version_matches_distribution_metadata`, lies outside the
    `scripts/tests` path scope and runs in the canonical verifier command.
  - `pnpm --filter @japp/test-fixtures exec vitest run test/m02-w01
    --no-file-parallelism --maxWorkers=1 --reporter=default` → exit 0,
    108/108 across 8 files.
  - `pnpm --filter @japp/test-fixtures test` → exit 0, 109/109 across 9
    files.
  - `fixtures:seed:check` (zero-mutation check mode), `fixtures:validate`,
    `fixtures:privacy` (25 files, 26,179 scalar fields clean),
    `fixtures:platform-v1` (15 deprecated v1/v2 sibling pairs over 25
    producer files), and `fixtures:discover` → all exit 0.
  - `python3 scripts/validate_status.py`, `pnpm traceability:check`,
    `pnpm generate:contracts --check`, and `pnpm run doctor` (summary: 23
    pass, 0 warning, 0 fail, 1 not-yet-applicable) → all exit 0.
  - `pnpm verify` → exit 0: unit-ts 2,556 tests (2,440 contracts + 109
    fixtures + seven one-test packages, 9/9 tasks), focused fixture suite
    108, focused contract suite 662, browser 1, Python 977/977 POSIX items,
    Rust 1 and 10; visual remained truthfully NOT_YET_APPLICABLE; zero
    tracked-byte drift after the complete chain.
- Exact Python inventory identities: 975 common/Windows node IDs at SHA-256
  `091078f72fe887c21980f601f95e2996190b2fccf7b5bf32e9567897f0a62f36` and 977
  macOS/Linux node IDs at SHA-256
  `196a4cfd4c08bc56a7b96eb5be7454ec50d479a39a313c127729b34fd078f55f`; both
  digests were independently recomputed from
  `scripts/python-test-inventory.v1.json` using the verifier's exact
  canonicalization, and the only two POSIX-only nodes are
  `test_atomic_adoption_rejects_non_regular_source[fifo]` and
  `test_atomic_adoption_rejects_non_regular_source[socket]`.
- Hosted evidence: final run `30741379567` at head SHA exactly
  `7523e096b51c1c3a0490924235879d4d6d386b81` succeeded with doctor + verify
  (ubuntu-24.04) job `91479336277` success, doctor + verify (macos-15) job
  `91479336288` success, and doctor + verify (windows-2025) job
  `91479336324` success. Every job checked out the exact final SHA, reported
  doctor 23 pass / 0 warning / 0 fail, collected and passed the
  platform-exact Python inventory (977 POSIX; 975 Windows), printed
  `verification exit code: 0` with every ACTIVE suite PASS, and passed the
  tracked-cleanliness assertion.
- Failed parent-content run recorded: run `30740481965` at
  `f1b727450c2a25bfb6f806a51bcde30b9fed156c` failed only on windows-2025
  because the temporary Python-inventory test fixture helper used text-mode
  writing, Windows translated the fixture bytes to CRLF, and the production
  canonicality rule correctly rejected the noncanonical serialization
  (`test_python_inventory_loads_exact_windows_and_posix_identities` plus its
  dependent identity tests). Final commit `7523e09` changed the fixture
  writer to explicit UTF-8/LF byte writing and added direct no-CRLF
  assertions. Earlier run `30723624756` at `83d83ff` was genuinely three-OS
  green but was later invalidated semantically by the six independently
  reproduced blockers; hosted-green execution is evidence, not the sole
  reason for verification.
- Wording correction: the 2026-08-02 entry's sentence "the focused platform
  file remains 25 top-level tests" was inaccurate. The focused platform file
  increased from 22 top-level tests at the audited predecessor
  (`f5cb2fc`/`83d83ff`) to 25 tests at the final corrected content. A
  correction label is added in place below; the historical counts are
  otherwise unaltered.
- Known-issue closeout: KI-0039 (temporal boundary/credential validity),
  KI-0040 (fully re-signed contradictions), KI-0041 (privacy scanning and
  diagnostic non-disclosure; the generic Base64 hypothesis remains explicitly
  outside the accepted M02-W01 detector contract and nonblocking), KI-0042
  (ADR-0004 producer guard), KI-0043 (non-mutating check mode), KI-0044
  (test integrity and exact inventory), and KI-0045 (topology and policy
  diversity) all transition IN_PROGRESS → FIXED with their defect histories
  preserved in docs/KNOWN_ISSUES.md.
- Lifecycle result: M02-W01 becomes VERIFIED, not ACCEPTED; M02-W02 becomes
  the sole READY package and was not begun; M02 remains IN_PROGRESS; M00 and
  M01 remain ACCEPTED; all four critical gates remain NOT_EVALUATED — this
  package verification did not evaluate any critical gate, and the Autofill
  Feasibility evaluation/decision remains owned by M02-W14/M02-W15 — and the
  overall release gate remains NOT_READY.
- Artifacts: governance updates to docs/PROJECT_STATUS.md,
  docs/KNOWN_ISSUES.md, docs/TEST_EVIDENCE.md, docs/traceability.json, and
  the regenerated docs/REQUIREMENTS_TRACEABILITY.md in this closeout commit;
  hosted job logs inspected through authenticated GitHub tooling, including
  the raw windows-2025 log.
- Notes: governance-only change. No production code, test logic, fixture
  data, schema, generated contract, workflow, dependency, lockfile, or
  toolchain byte changed, and no M02-W02 implementation bytes exist.

### M02-W01 — Six-blocker post-audit corrective content pass (2026-08-02)

- Revision and boundary: implementation working tree based on exact clean
  `main` commit and `origin/main`
  `83d83ff1b805b57ca7fecf2797cf35e2036e0740`, tree
  `f9fddf739fa21d06517574f839625bfb931521ee`, parent `07f36c2`, with the
  preserved linear history `f5cb2fc` → `07f36c2` → `83d83ff`. The canonical
  JAPP-MASTER-001 v1.4 specification remained byte-identical at SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  M00 and M01 remained ACCEPTED; M02 and M02-W01 remained IN_PROGRESS;
  M02-W02 remained NOT_STARTED; no package was READY; KI-0039 through KI-0045
  were not marked FIXED; all four critical gates remained NOT_EVALUATED; and
  release remained NOT_READY.
- Audit truth and invalidated claims: the fresh independent audit of exact
  `83d83ff` returned verdict B with `AUD-PLAT-001` through `AUD-PLAT-003` and
  `AUD-VER-001` through `AUD-VER-003`. Therefore the older claims that unknown
  pytest categories were already rejected, that a repository Vitest reporter
  could not coexist with the verifier's default reporter, and that all bounded
  invoked join-mutator aliases, case variants, unresolved spreads, and
  computed selectors already failed closed are explicitly invalidated. The
  recorded doctor result of 22 pass / 1 warning was historical pre-final
  candidate evidence; the exact final `83d83ff` hosted truth was 23 pass / 0
  warning on macos-15, ubuntu-24.04, and windows-2025. The audit handoff used a
  63-probe headline but enumerated 68 probes; no tracked 63-probe overlap claim
  was found, so 68 is the reconciled arithmetic without inventing an overlap.
  The audit-side installation incident created ignored dependencies but
  changed no tracked bytes; that checkout was quarantined and was not treated
  as untouched afterward.
- Exact-start reproduction: all six findings were reconstructed independently
  in disposable no-hardlinks clone
  `/tmp/m02w01-six-blockers.K9PEUv/exact-83d83ff` before writer-tree edits.
  The platform guard accepted invoked mutators through an alias, alias chain,
  `.call`, and `.apply` while the direct-call control rejected; accepted
  mixed/upper-case v1 filenames, URNs, and JSON aliases while lowercase v1
  rejected and v2/prose controls passed; and accepted spread-only, reviewed-v2
  followed by unresolved spread, unresolved computed selector, and runtime
  alias/major-pair schema surfaces while static-safe controls passed. Producer
  source was never executed and the observable side-effect marker count was
  zero. The verifier allowed package-script and config reporters to coexist
  with its appended default reporter; the reporter marker ran once before a
  later proof mismatch. Its pytest parser accepted `855 passed, 1 mystery`,
  trailing nonsense, ambiguous summaries, malformed durations, and unknown
  categories. Two real count-preserving Python mutations—one platform-
  conditioned mandatory test plus filler and one conditionally empty
  parameter definition plus fillers—both remained ordinary green because the
  registry required only `pytest_min_passed: 1` and had no independent item
  identity.
- Root causes and bounded correction:
  - `AUD-PLAT-001`: join-override analysis tracked direct bodies but did not
    propagate point-in-time local callable identity and execution through
    aliases, intrinsic `.call`/`.apply`, methods, bound/default arguments,
    generator resumption, nested invocations, member reassignment, or
    unresolved same-class targets. The correction resolves bounded lexical
    callables without executing source, distinguishes user-owned members,
    models statement order and generator yield boundaries, propagates nested
    invocation state per join, and fails closed when a schema result depends
    on an unresolved local invocation.
  - `AUD-PLAT-002`: deprecated representations were normalized
    inconsistently. One bounded deterministic ASCII fold now precedes exact
    vocabulary matching for URNs, aliases, majors, filenames, and paths while
    v2 and benign prose controls remain valid and diagnostics remain redacted.
  - `AUD-PLAT-003`: object analysis ignored unresolved selector capability and
    lost object identity across spreads, mutation, escape, and rebinding. The
    correction resolves exact ordered spreads/computed keys, tracks
    point-in-time binding identity and definitely invoked closure mutation,
    preserves overwrite semantics, covers schema destinations and sinks, and
    rejects only schema surfaces whose selector capability cannot be proved
    safe.
  - `AUD-VER-001`: reporter ownership covered registry argv but not all
    effective package scripts, Turbo forwarding, or recognized config syntax.
    A zero-child preflight now accepts only bounded direct/script/Turbo command
    grammars; rejects repository reporters, unmodeled roots/configs, lifecycle
    hooks, dynamic config fields, alternate task graphs, and malformed
    ECMAScript line-terminator forms; then places exactly
    `--reporter=default` in the effective Vitest argument channel.
  - `AUD-VER-002`: substring matching selected a convenient `N passed` token.
    One complete final ordinary-only grammar now requires an exact count,
    `D.DDs`, the pinned and arithmetically matching long-duration clock only at
    60 seconds or more, LF/CRLF discipline, and exactly one terminal outcome;
    all known and unknown categories, competing summaries, trailing text, and
    malformed durations reject.
  - `AUD-VER-003`: a minimum count was not an identity proof. The verifier now
    performs canonical explicit-file collection before execution, normalizes
    only repository-relative path components to POSIX spelling, and compares
    exact sorted unique node IDs, count, and SHA-256 against committed
    `scripts/python-test-inventory.v1.json`. Verification never rewrites that
    file and unsupported platforms fail closed.
- Regression and independent replay evidence: the focused platform file
  remains 25 top-level tests [correction, 2026-08-03 governance closeout:
  the file increased from 22 top-level tests at the audited predecessor
  (`f5cb2fc`/`83d83ff`) to 25 tests at this final corrected content;
  "remains 25" was inaccurate] but its tables now cover the six named
  platform findings plus directly adjacent alias, method, bind, default,
  generator, mutation/escape, rebinding, sink, mixed-case, spread, and
  computed-key controls. A read-only reviewer replayed the final ten concrete edge cases
  and the complete focused file: 25/25 passed, with every intended reject
  producing a fail-closed unresolved result and both intended-valid controls
  clean. Reporter tests cover direct, Turbo, root/workspace/named scripts,
  configs, CR/LF/LS/PS tokenization, `vitest.cmd`, qualified tasks, filter
  provenance, delimiter placement, marker non-creation, and exact zero-child
  behavior; final read-only reporter replay passed 66 focused tests and
  executed no child module. Parser/inventory replay passed 67 focused tests;
  three real subprocess mutations for platform-conditioned disappearance,
  empty parameter definition, and unknown replacement all failed the identity
  proof despite count preservation.
- Exact cross-platform Python identity: normalization/schema version 1 has
  975 common/Windows node IDs, SHA-256
  `091078f72fe887c21980f601f95e2996190b2fccf7b5bf32e9567897f0a62f36`.
  macOS/Linux add exactly
  `test_atomic_adoption_rejects_non_regular_source[fifo]` and
  `test_atomic_adoption_rejects_non_regular_source[socket]`, for 977 items and
  SHA-256
  `196a4cfd4c08bc56a7b96eb5be7454ec50d479a39a313c127729b34fd078f55f`.
  The committed JSON is regular, non-symlink, canonical UTF-8, sorted, unique,
  and byte-for-identity equal to fresh POSIX collection; `win32`, `darwin`, and
  `linux` select only the declared inventories and an unsupported platform
  rejects.
- Focused execution on the stable implementation bytes:
  - Prettier, ESLint, and TypeScript checking of the changed guard/tests → exit
    0. `privacy-security.test.ts` → 25/25 passed in 2.07 s; complete M02-W01 →
    108/108 passed; complete fixture package → 109/109 passed.
  - Ruff format/check and mypy over affected Python → exit 0.
    `scripts/tests/test_suite_states.py` → 294/294 passed in 8.74 s. The
    combined integrity, suite-state, and real-repository proof set passed
    before the final six strict-clock cases; the final exact inventory run
    collected and passed 977/977 with no nonordinary category.
  - `python3 -B scripts/verify.py --suite integrity` and `--suite unit-ts` →
    exit 0. Unit TypeScript ran 9/9 tasks and 2,556 tests: 2,440 contracts, 109
    fixture tests, and seven one-test packages. `--suite fixture-corpus` → exit
    0 after the truthful independent exact-count controls were raised from 105
    to 108. `--suite python` uses the exact collection/run command and passes
    the platform inventory.
  - The fixed committed producer surface was measured three times with
    `/usr/bin/time -p pnpm --filter @japp/test-fixtures
    fixtures:platform-v1`: each run derived 15 pairs and scanned 25 files;
    wall times were 0.78 s, 0.78 s, and 0.77 s with unchanged verifier budgets.
- Aggregate status: the first canonical aggregate on the expanded truthful
  tests ran every implementation suite successfully and exposed only the stale
  independently duplicated 105 focused-test expectation. That exact
  accounting control was updated to 108 and focused fixture verification then
  passed. The final writer-tree `pnpm verify` exited 0 with every ACTIVE suite
  passing and visual remaining truthfully NOT_YET_APPLICABLE: unit-ts ran
  2,556 tests, the independently counted focused fixture suite ran 108, the
  focused contract suite ran 662, browser ran 1, Python collected and passed
  exactly 977 POSIX items in 116.15 s, and the native/harness Rust suites ran 1
  and 10 tests. The clean-room result, content commit, and hosted three-OS
  identifiers are bound in the implementation handoff because this evidence
  entry cannot self-reference results that occur after its containing commit.
- Scope and governance: this is implementation evidence, not independent
  acceptance. No fixture data, oracle, schema, generated contract, workflow,
  dependency, lockfile, toolchain pin, global timeout, package command,
  canonical specification, product surface, M02-W02 work, gate state, issue
  closure, acceptance, or governance stamp was changed. A fresh independent
  read-only audit of the ending content SHA/tree remains mandatory.

### M02-W01 — Revised audit validation and bounded bypass correction (2026-07-30)

- Revision: implementation working tree based on exact clean `main` commit
  `f5cb2fc26b628c1b74594aafbbc6aadd4840028f`, tree
  `8c5b5698f4c60b908284659de905beb265da8a42`; `origin/main` matched. The
  ending commit and content tree are reported in the implementation handoff.
- Environment: macOS 27.0; Node 24.18.0; pnpm 11.17.0; Vitest 4.1.10; uv
  0.11.32; uv-managed Python 3.12.13.
- Interruption and recovery (2026-08-01): the corrective session was
  interrupted after its regression tests were authored but before the
  analyzer implementations converged. The recovery session verified the
  committed boundary unchanged, preserved the dirty writer tree (9 modified
  tracked files, +13,322/−669 against `f5cb2fc`, no staged or untracked
  entries) in a durable external snapshot before any edit, and reproduced
  the interrupted checkpoint exactly: nine focused failures — two scanner
  dynamic-import regressions, three verifier reporter-channel regressions,
  and four Python execution-stage-hook regressions — plus mechanical
  ESLint/Prettier/Ruff/tsc defects in the scanner, the platform guard, and
  two Python test files. The recovery completed only those residuals; no
  new bypass family was searched for and no architecture changed.
- Boundary: JAPP-MASTER-001 version 1.4 remained canonical. M00 and M01 were
  ACCEPTED; M02-W01 was the sole IN_PROGRESS package; M02-W02 was NOT_STARTED;
  no package was READY; M02 remained IN_PROGRESS; the release was NOT_READY;
  and all four critical gates were NOT_EVALUATED. Every pre-correction
  reproduction ran in a disposable exact-start copy. Neither protected Opus
  audit worktree was modified or reused.
- Independent Phase A classifications and exact-start evidence:
  - **B-01 CONFIRMED blocker.** In
    `/private/tmp/jobapplyv2-root-triage.AKoDr5/b01-integration`, the tracked
    `governance-discovery.test.ts` replacement used
    `const C = ["a", "b", "c"]; (() => { C.length = 0; })(); test.each(C)`
    plus one filler. `node scripts/check-ts-test-policy.mjs
    packages/test-fixtures/test/m02-w01/governance-discovery.test.ts` exited 0
    with zero diagnostic bytes. The machine-readable M02-W01 Vitest run
    exited 0 with 105/105 passed and no non-pass category; the attacked
    registration contributed zero cases and the filler preserved the exact
    count. `uv run python scripts/verify.py --suite integrity` and
    `--suite fixture-corpus` both exited 0. The 26-source direct-call matrix
    registered and passed 48/48 runtime cases. It covered direct, nested,
    async, `.call`, `.apply`, named-function, function-expression, arrow,
    argument, returned-alias, before/after-registration, conditional, uncalled
    declaration, and callback controls. Root cause: function bodies were
    pruned without resolving definitely invoked local callables, while
    uncalled arrow/function-expression bodies could be treated as executed.
  - **B-02 CONFIRMED blocker.** In the sibling `b02-integration` copy, the
    replacement used `const T = [].concat("abc"); T.splice(0, 1);
    test.each(T)` plus one filler. The same direct scanner command exited 0
    with zero diagnostic bytes; machine-readable Vitest exited 0 with 105/105
    passed, and both verifier suites exited 0. The concat matrix registered
    and passed 55/55 runtime cases across primitives, nullish values, objects,
    dense/sparse/nested arrays, spread arguments, static and unknown
    `Symbol.isConcatSpreadable`, aliases, shadowed/subclassed arrays, and
    `pop`/`shift`/`splice`/`delete`/length mutation. Root cause: concat
    arguments were evaluated with iterable/string cardinality rather than
    `Array.prototype.concat` slot semantics, so the string primitive was
    modeled as three slots instead of one.
  - **B-03 CONFIRMED blocker.** In the sibling `b03-integration` copy, one
    substantive assertion became a knowingly false `test.fails` assertion
    and one filler was added. The direct scanner exited 0. Pinned Vitest
    exited 0 and printed `105 passed | 1 expected fail (106)`; its JSON
    reporter labeled all 106 assertions passed, with no failed, pending, or
    todo count. Both verifier suites exited 0. The spelling matrix covered
    `test.fails`, `it.fails`, aliases, computed literal members, supported
    `.fails.each`/`.fails.for` and concurrent modifier orderings, expected
    failures that failed or unexpectedly passed, ordinary failures, and
    skip/todo/pending/excluded controls. Root cause: `fails` was absent from
    the TypeScript policy and the summary proof trusted the ordinary passed
    count without rejecting Vitest's expected-fail category.
  - **B-04 CONFIRMED blocker.** Exact-start disposable matrices exercised 24
    JSON cases, 26 TypeScript cases, and 12 Markdown/text cases; respectively
    13, 9, and 6 required rejects passed the old guard. A combined
    `evidence-record:v1` producer attack left the direct guard, integrity
    verifier, and fixture-corpus verifier green with the focused suite at
    105/105. JSON alias/major pairs, numeric/string/case majors, nested/array
    shapes, bounded percent/escape forms, static TypeScript concatenation,
    templates, aliases and joins, unresolved per-expression values, malformed
    syntax, runtime-derived values, and textual forms were covered. After the
    initial correction, an additional exact-start regression for direct
    assignment to `Array.prototype.join` and
    `Object.defineProperty(Array.prototype, "join", ...)` failed 2/2 because
    both reports remained valid. Root causes were incomplete bounded
    normalization/static evaluation, a file-global resolved-value flag that
    suppressed an unrelated unresolved expression, and trusting intrinsic
    array-join semantics after a statically visible prototype override.
  - **N-23 CONFIRMED blocker.** A Ruff- and mypy-clean exact-start mutation
    imported pytest normally, aliased a skip callable, skipped one substantive
    Python test, and added one filler. Machine-readable pytest collected 696
    tests and reported 695 passed / 1 skipped, while
    `uv run python scripts/verify.py --suite python` exited 0. Separate
    controls covered `from pytest import skip`, module aliases,
    `importorskip`, `mark.skip`, `mark.skipif`, module-level, parametrized,
    collection-time, and collection-filter skips. A stronger exact-start
    `pytest_plugins = ["inventory_plugin"]` reproduction removed one
    substantive test during collection and added one filler: focused pytest
    and JUnit each reported one ordinary pass with no non-pass category,
    integrity remained PASS, and the complete Python verifier remained PASS at
    696 collected / 695 passed. Root causes were regex-based skip discovery
    that did not model Python bindings/scopes, plugin loading, namespace
    provenance, or collection hooks, plus a minimum-pass summary proof that
    did not reject nonordinary result categories.
- Bounded correction:
  - The TypeScript test-policy scanner now interprets definitely invoked local
    callables and direct/nested IIFEs without treating every definition as
    executed; uncertain calls fail closed when table safety depends on them.
    It models concat slot/length/spreadability semantics without executing
    JavaScript and rejects expected-fail modifiers.
  - The verifier accepts only ordinary Vitest pass summaries, rejects every
    known or unknown extra category, and uses a lexical,
    statement-order-aware Python AST policy for skip/xfail/importorskip and
    collection bypasses. Pytest LF and CRLF summaries reject failed, error,
    skipped, xfailed, xpassed, deselected, and rerun categories.
  - The platform-v1 guard performs bounded deterministic decoding and
    TypeScript constant evaluation, evaluates unresolved schema-like
    expressions independently, invalidates mutable static arrays, and fails
    closed after statically visible `Array.prototype.join` overrides. It
    preserves the exact 15-pair inventory, historical v1 reads, redacted
    diagnostics, and the no-arbitrary-execution boundary.
  - The scanner statically resolves dynamic `import()` specifiers through
    literal, concatenated, unique-`const`, and resolvable-template forms
    into the relative-helper closure scan, and fails closed with a finding
    when a dynamic-import specifier cannot be statically resolved. Bare and
    resolvable non-relative specifiers remain ordinary.
  - The verifier owns the canonical Vitest reporter channel: a registry
    Vitest command that declares its own reporter is rejected before any
    child process runs, and `--reporter=default` is appended to direct
    Vitest commands and forwarded through `--` pass-through to turbo-run
    Vitest tasks, so neither a registry argument nor a repository
    vitest-config reporter can replace the summary grammar the proofs parse.
  - The Python policy names and forbids the execution-stage session hooks
    `pytest_collection_finish` and `pytest_runtestloop` at module scope
    across assignment, definition, import-alias, and namespace-write
    spellings, closing the post-collection `session.items` removal vector.
  - The platform-version guard and scanner additionally received
    type/lint/format-only repairs during recovery; guard semantics, the
    15-pair inventory, and every producer verdict are unchanged, and the
    committed-surface scan still reports 15 pairs over 25 producer files.
- Focused corrected evidence (final recovered candidate, 2026-08-01):
  - `uv run pytest -q scripts/tests/test_integrity.py` → exit 0, 42 passed
    in 81.09s: the complete scanner policy matrix, including definitely
    invoked IIFE/local-callable table pruning, concat slot semantics,
    expected-fail rejection, cross-file `test.fails` laundering through
    static helper imports, statically resolvable dynamic-import helpers
    (concatenated, unique-`const`, and template specifiers all reach the
    laundered helper), fail-closed unresolved dynamic imports, bounded
    ordinary dynamic-import controls, and the aliased-skip end-to-end
    Python rejections.
  - `uv run pytest -q scripts/tests/test_suite_states.py` → exit 0, 175
    passed in 6.77s: ordinary-pass Vitest summary grammar, exact-count and
    per-package proofs, repository custom-reporter rejection before
    execution, forced `--reporter=default` on direct and turbo-run Vitest
    commands, LF/CRLF pytest nonordinary-category rejection, the lexical
    Python AST skip/collection policy including `pytest_collection_finish`
    and `pytest_runtestloop`, and the Ruff- and mypy-clean count-preserving
    conftest/plugin/execution-stage bypass end-to-end rejections. Remaining
    dynamically evaluable collection forms stay independently blocked by
    Ruff S307/S102; skip/xfail capability forms that survive static policy
    still produce nonordinary runtime categories and are rejected by the
    summary parser.
  - `uv run pytest -q scripts/tests/test_integrity.py
    scripts/tests/test_suite_states.py` → exit 0, 217 passed in 95.34s.
  - `pnpm --filter @japp/test-fixtures exec vitest run
    test/m02-w01/privacy-security.test.ts --no-file-parallelism
    --maxWorkers=1` → exit 0, 22/22 passed, including the platform-producer
    reject/control tables with the direct, defineProperty, alias,
    `Reflect.set`, and `Object.assign` array-join override rejections and
    the unrelated-object and corrected-v2 controls.
  - The temporal/oracle, re-signed-contradiction, generator check-mode, and
    platform-producer regressions all pass inside the 105-test focused
    fixture aggregate below.
  - Full-repository scanner scan: 37 discovered TypeScript test files in
    0.93 s wall; the verifier's 120 s scanner budget and every other
    timeout are unchanged.
- Aggregate corrected evidence (final recovered candidate, 2026-08-01):
  - `pnpm --filter @japp/test-fixtures exec vitest run test/m02-w01
    --no-file-parallelism --maxWorkers=1` → exit 0, 8 files and 105/105
    tests passed with zero failed, pending, or todo cases.
  - `pnpm --filter @japp/test-fixtures fixtures:seed:check`,
    `fixtures:validate`, `fixtures:privacy`, `fixtures:platform-v1`, and
    `fixtures:discover` → exit 0. Counts were 12 profiles, 72 evidence
    artifacts, 12 resumes, 24 jobs, 72 requirements, 36 scenarios / 108
    evaluations, 77 claims, 31 gaps, and 69 policies; privacy scanned 25 files
    / 26,179 scalar fields; the platform guard derived 15 pairs and scanned 25
    producer files; discovery found 9 collections, 405 records, 108
    evaluations, and 8 focused test files.
  - `pnpm --filter @japp/test-fixtures test` → exit 0, 9 files and 106/106
    tests passed.
  - `uv run pytest -q scripts/tests` → exit 0, 856 passed in 122.12s.
  - `pnpm install --frozen-lockfile`, `uv sync --locked`, and both
    `cargo fetch --locked` commands → exit 0 with byte-identical lockfile
    SHA-256 digests before and after the complete verification pass.
  - `python3 scripts/validate_status.py` → exit 0, all 45 check groups passed.
    `pnpm traceability:check` → exit 0, 193 requirements and 300 work packages
    validated. `pnpm generate:contracts --check` → exit 0, 183 files
    byte-identical. `pnpm run doctor` → exit 0, 22 pass / 1 warning / 0 fail
    / 1 not-yet-applicable.
  - An initial `pnpm verify` candidate run exited 1 after all runtime suites
    passed because ESLint found one redundant TypeScript condition and mypy
    found one reused loop variable in the new static-string evaluator. The
    conditions/names were corrected without changing policy behavior. A later
    expanded-matrix candidate again completed every runtime suite but exited 1
    only because Prettier and Ruff requested mechanical formatting of the
    scanner and one regression string; both formatters were applied. The
    interruption then left five tsc errors, ten ESLint findings, two
    Prettier-unformatted files, and one Ruff finding plus two
    Ruff-unformatted Python test files in place; the recovery repaired all
    of them without changing any analyzer verdict.
  - Final `pnpm verify` on the recovered candidate → exit 0. All 15 ACTIVE
    suites passed and visual remained honestly NOT_YET_APPLICABLE. Executed
    counts included 9/9 TypeScript package tasks with 2,553 tests (including
    106 fixture and 2,440 contract tests), 8/8 focused M02-W01 files with
    105/105 tests, 6/6 focused contract files with 662/662 tests, 857/857
    Python tests, 11/11 Rust tests, and 1/1 Playwright test. No skipped,
    pending, todo, excluded, expected-fail, deselected, xfail/xpass, or
    rerun category was reported.
- Hosted portability repair (2026-08-01): the first exact-SHA push run
  `30722872985` completed doctor + verify successfully on macos-15 and
  ubuntu-24.04; the windows-2025 job failed with exactly one defect — the
  pre-existing fixture test that runs both complete committed-surface scans
  in one body exceeded Vitest's default 5 s per-test ceiling under parallel
  workers on the slowest certified runner (104/105 fixture tests passed;
  the standalone Windows CLI scans in the same job passed in ≈1.4 s and
  ≈2.1 s). The narrow repair gives exactly that integration-scale test an
  explicit bounded `{ timeout: 60_000 }`; no scan, assertion, coverage,
  registry command, or verifier/CI budget changed. After the repair the
  scanner policy check, Prettier, ESLint, the focused file (22/22), the
  registry-shaped parallel fixture run (8 files, 105/105), and full
  `pnpm verify` (exit 0, same suite counts) all passed locally; the
  follow-up exact-SHA three-OS run is recorded in the implementation
  handoff.
- Scope and governance: no runtime guard mandate or other architecture change
  was required. The changes remain limited to the static policy/summary
  verifiers, platform-version producer guard, focused regressions, and this
  truthful corrective evidence. No governance stamp was created; no issue was
  closed or marked FIXED; M02-W01 remains IN_PROGRESS and unaccepted; M02-W02
  remains NOT_STARTED and was not begun; no package is READY; M02 remains
  IN_PROGRESS; the release remains NOT_READY; and no critical gate was
  evaluated. Final aggregate and three-platform hosted evidence are reported
  in the implementation handoff.
- Artifacts: no retained reporter or reproduction artifact. All disposable
  copies and temporary environments are removed before handoff. No flaky
  behavior observed.

### M02-W01 — Independent Opus-audit triage and bounded correction (2026-07-30)

- Revision: implementation working tree based on exact clean `main` commit
  `1277715af6f2244ace00be2778b17440f8fa9530`, tree
  `11f221556a4b3186a5b28564cabb2f9ab8950a11`; `origin/main` matched. The
  ending commit and content tree are reported in the implementation handoff.
- Environment: macOS 27.0; Node 24.18.0; pnpm 11.17.0; uv 0.11.32;
  uv-managed Python 3.12.13.
- Boundary: JAPP-MASTER-001 version 1.4 remained canonical. M00 and M01 were
  ACCEPTED; M02-W01 was the sole IN_PROGRESS package; M02-W02 was NOT_STARTED;
  no package was READY; the release was NOT_READY; and all four critical gates
  were NOT_EVALUATED. All Phase A reproductions and comparator mutations used
  disposable copies. The detached Opus audit worktree was not modified,
  installed into, cleaned, removed, or reused.
- Independent Phase A classifications:
  - **F-01 CONFIRMED.** In the exact starting revision,
    `node scripts/check-ts-test-policy.mjs
    .phase-a/f01-mutations.test.ts` exited 0 with no output for `pop`, `shift`,
    both reported `splice` forms, `length = 0`, const-alias mutation,
    `Object.assign(..., { length: 0 })`, and deletion of the only occupied
    slot. The same direct command on `.phase-a/f01-surfaces.test.ts` exited 0
    across `test`, `it`, `describe`, `suite`, and `bench` `.each`/`.for`
    scanner surfaces. Machine-readable Vitest generated only the filler:
    1/1 passed for the mutation group and 1/1 for eight executable
    `.each`/`.for` surfaces; `bench.for` itself exited 1 with zero tests because
    that runtime exposes no `bench.for` function. Replacing a substantive
    M02-W01 test with an emptied alias table plus a trivial filler still
    reported 16 suites and 102/102 passed, and
    `uv run python scripts/verify.py --suite integrity` plus
    `uv run python scripts/verify.py --suite fixture-corpus` both exited 0.
    Runtime controls established that deleting a one-row slot generated zero
    cases, assigning `undefined` preserved one, deleting one of two slots
    preserved one, and post-registration mutation preserved the generated
    case. `.phase-a/f01-positive.test.ts` passed 11/11; an environment-derived
    table passed 1/1 when empty and 2/2 when nonempty.
  - **F-02 CONFIRMED.** In the exact starting revision,
    `.phase-a/f02-empty.test.ts` contained all six reported `Array.from`
    inputs. Its direct scanner command exited 1 only for `Array.from([])` and
    `Array.from("")`, silently accepting `{ length: 0 }`, the mapped form,
    `new Set()`, and `new Map()`; its Vitest run generated only the filler and
    passed 1/1. The known-nonempty controls passed 10/10. Shadowed `Array`
    failed closed, while shadowed `Set` and `Map` were accepted; a malformed
    parse failed and a genuinely runtime-derived table was accepted. Replacing
    a substantive test with `Array.from({ length: 0 })` plus a filler again
    reported 102/102 and both verifier suites exited 0.
  - **F-03 CONFIRMED.** In separate disposable copies, changing
    `evaluationDate > end` to `>=`, `evaluationDate < start` to `<=`, or
    `revoked_on <= evaluationDate` to `<` left the focused command
    `packages/test-fixtures/node_modules/.bin/vitest run
    packages/test-fixtures/test/m02-w01/semantic-matrices.test.ts
    packages/test-fixtures/test/m02-w01/corpus-positive.test.ts
    --no-file-parallelism --maxWorkers=1 --testNamePattern 'derives all
    credential temporal states|explicit critical result
    bindings|independently enumerated credential states' --reporter=json`
    green at 3 passed / 22 pending. For each mutant, fixture validation and
    seed checking exited 0 and the complete M02-W01 suite passed 102/102.
  - **F-04 CONFIRMED.** An included disposable fixture containing bare,
    embedded-text, unrelated-field, and semantic-field `123-45-6789` values
    plus token-shaped `sk_live_` and `sk_test_` values passed
    `pnpm --filter @japp/test-fixtures fixtures:privacy` at 26 files / 26,191
    scalar fields. Numeric SSN-semantic identifiers were already rejected.
    Benign numeric, date/version, SSN-prose, ordinary `sk_`, reserved fixture
    identity, and route/path controls passed at 26 files / 26,205 fields.
    Existing secret families produced nine redacted `PRIVACY_SECRET` issues;
    existing PII, path, injection, and diagnostic non-disclosure controls
    behaved as expected. The pre-correction focused privacy suite passed
    19/19; after adding the three regressions but before the implementation
    change it exited 1 with 19/22 passed and exactly those regressions failed.
- Separate Base64 result: generic Base64 text encoding synthetic email, SSN,
  phone, and address values passed the included committed scan at 26 files /
  26,187 fields. That behavior is reproducible, but generic Base64 decoding is
  not clearly required by the bounded KI-0041 normalization/encoded-token
  contract. It remains an **INCONCLUSIVE, nonblocking follow-up hypothesis**
  and was excluded from this correction.
- Corrected focused commands and observed results:
  - `uv run pytest -q scripts/tests/test_integrity.py
    scripts/tests/test_suite_states.py` → exit 0, 55 passed in 58.58s.
  - Direct `printf ... | node scripts/check-ts-test-policy.mjs /dev/stdin`
    probes → exit 1 with an empty-table diagnostic for every reported F-01
    mutation, `describe.each`, and all supported `.for` roots; exit 1 for all
    six empty F-02 inputs; exit 1 as unprovable for runtime-derived and
    shadowed Array/Set/Map inputs; exit 0 for unchanged and push-before
    registration, mutation after registration, occupied `undefined`,
    one-of-two deletion, ordinary nonparameterized use, stable literals and
    wrappers, and known-nonempty array-like/Set/Map controls.
  - `rg --files packages apps e2e | rg
    '\.(test|spec)\.(js|jsx|ts|tsx|cjs|cjsx|mjs|mjsx|cts|ctsx|mts|mtsx)$' |
    xargs node scripts/check-ts-test-policy.mjs` → exit 0, no output.
  - `pnpm --filter @japp/contracts typecheck` and
    `pnpm --filter @japp/contracts exec vitest run
    test/schema/w07-secret-store-truth-table.test.ts
    test/schema/w07-platform-rule-matrix.test.ts --no-file-parallelism
    --maxWorkers=1 --reporter=json` → exit 0; 2 files and 1,391/1,391 tests
    passed with no pending or todo cases.
  - `pnpm --filter @japp/test-fixtures exec vitest run
    test/m02-w01/privacy-security.test.ts --no-file-parallelism --maxWorkers=1
    --reporter=json` → exit 0; 22/22 passed. High-confidence SSN and
    token-shaped `sk_live_`/`sk_test_` values were detected without disclosure;
    invalid SSN shapes, embedded SKU text, short prefixes, and ordinary numeric
    and prose controls remained clean.
  - `pnpm --filter @japp/test-fixtures exec vitest run
    test/m02-w01/semantic-matrices.test.ts
    test/m02-w01/corpus-positive.test.ts --no-file-parallelism --maxWorkers=1
    --reporter=json` → exit 0; 2 files and 25/25 tests passed.
  - Repeating the three comparator mutations in disposable corrected copies
    made the focused pattern exit 1 each time with 2 passed, 1 failed, and 22
    pending: the exact bounded-validity end expected `CURRENT` but observed
    `EXPIRED`; the exact effective start expected `CURRENT` but observed
    `NOT_YET_VALID`; and the exact revocation date expected `REVOKED` but
    observed `CURRENT`.
- Aggregate commands and observed results:
  - `pnpm --filter @japp/test-fixtures exec vitest run test/m02-w01
    --no-file-parallelism --maxWorkers=1 --reporter=json` → exit 0; 8 files
    and 105/105 tests passed with no pending or todo cases.
  - `pnpm --filter @japp/test-fixtures fixtures:seed:check`,
    `fixtures:validate`, `fixtures:privacy`, `fixtures:platform-v1`,
    `fixtures:discover`, and `typecheck` → exit 0. Counts were 12 profiles, 72
    evidence artifacts, 12 resumes, 24 jobs, 72 requirements, 36 scenarios /
    108 evaluations, 77 claims, 31 gaps, and 69 policies; privacy scanned 25
    files / 26,179 scalar fields; platform-v1 derived 15 roots and scanned 25
    files; discovery found 9 collections, 405 records, 108 evaluations, and 8
    focused test files.
  - `pnpm --filter @japp/test-fixtures test` → exit 0; 9 files and 106/106
    tests passed.
  - `uv run pytest -q scripts/tests` → exit 0; 694 passed in 84.74s.
  - `python3 scripts/validate_status.py` → exit 0; all 45 check groups passed.
    `pnpm traceability:check` → exit 0; 193 requirements and 300 work packages
    validated.
  - `uv run ruff check scripts/tests/test_integrity.py
    scripts/tests/test_suite_states.py`, `uv run ruff format --check` on those
    files, and `pnpm exec prettier --check` on every changed
    non-Python file → exit 0.
  - `pnpm verify` → exit 0; all 15 ACTIVE suites passed and visual remained
    honestly NOT_YET_APPLICABLE. Counts included 9/9 TypeScript package tasks,
    9/9 fixture files with 106/106 tests, 8/8 focused M02-W01 files with
    105/105 tests, 20/20 contract files with 2,440/2,440 tests, 6/6 focused
    contract files with 662/662 tests, 695/695 Python tests, 11/11 Rust tests,
    and 1/1 Playwright test. No skipped, pending, todo, or excluded test was
    reported.
  - Hosted push run `30569284323` checked out the ending content commit on
    macOS 15, Ubuntu 24.04, and Windows 2025. macOS and Ubuntu completed
    canonical verification and the tracked-cleanliness assertion
    successfully. Windows exposed one portability defect in the new
    guard-trust test: Python text-mode copying converted LF bytes to CRLF, so
    the deliberately byte-exact SHA-256 trust check rejected the temporary
    copy. Its Python result was 692 passed / 1 failed; all other canonical
    suites passed. The bounded correction copies and tampers the helper as
    bytes. `uv run pytest -q
    scripts/tests/test_integrity.py::test_typescript_ast_scan_trusts_only_direct_canonical_nonempty_guard`
    then exited 0 with 1/1 passed in 1.60s.
- Scope: the correction is limited to fail-closed static parameter-table
  analysis, a bounded hash-pinned runtime guard for established derived
  contract tables, literal temporal boundary coverage, high-confidence SSN and
  `sk_live_`/`sk_test_` privacy detection/redaction, focused regressions,
  exact-count metadata, and truthful evidence text. Production temporal
  semantics and fixture corpus truth were not changed.
- Governance boundary: no governance stamp was created; no known issue was
  closed or marked FIXED; M02-W01 remains IN_PROGRESS and unaccepted; M02-W02
  remains NOT_STARTED and was not begun; and no critical gate was evaluated.
- Artifacts: none retained; disposable copies and temporary reporters are
  removed before commit. No flaky behavior observed.

### M02-W01 — Bounded TypeScript test-policy correction (2026-07-30)

- Revision: implementation working tree based on exact clean `main` commit
  `4d200735b6cade77e5b889bbb80dbeb5a377c79b`; the ending commit is reported in
  the implementation handoff.
- Environment: macOS 27.0; Node 24.18.0; pnpm 11.17.0; uv 0.11.32; uv-managed
  Python 3.12.13.
- Scope: scanner policy, scanner discovery, focused verifier regressions, and
  this evidence correction only. The fixture corpus and product behavior were
  not changed.
- Implementation evidence at that revision: `Array.from` propagated the
  state of its first input for the array, string, and stable-wrapper cases
  then tested; it did not establish every statically provable
  `Array.from` cardinality. The later independent validation recorded above
  found the remaining array-like and intrinsic-collection gaps. A unique,
  unchanged `let` table resolves through its initializer; reassignment,
  mutation, aliasing, escape, or shadowing produces a separate fail-closed
  unstable state. Scanner discovery covers both `.test.*` and `.spec.*`
  across `packages/*`, `apps/*`, and `e2e/` for all 12 verifier suffixes
  (`js`, `jsx`, `ts`, `tsx`, `cjs`, `cjsx`, `mjs`, `mjsx`, `cts`, `ctsx`,
  `mts`, and `mtsx`), for 72 patterns.
- Before editing, temporary reproductions showed:
  - `node scripts/check-ts-test-policy.mjs
    .audit-repros/array-from.spec.ts` → exit 0 for
    `test.each(Array.from([]))` plus a trivial filler.
  - `node scripts/check-ts-test-policy.mjs
    .audit-repros/empty-let.spec.ts` → exit 0 for unchanged
    `let TABLE = []`.
  - `uv run python -c 'from pathlib import Path; import sys;
    sys.path.insert(0, "scripts"); import verify; repo=Path.cwd();
    ctx=verify.Context(repo, repo/"scripts/verification-suites.json",
    repo/"docs/PROJECT_STATUS.md");
    failures=verify.check_focused_tests(ctx, ()); print(failures); raise
    SystemExit(1 if failures else 0)'` → exit 0 with `[]` for
    `e2e/scanner-discovery-bypass.test.ts`, while
    `pnpm exec playwright test e2e/scanner-discovery-bypass.test.ts --list` →
    exit 0 and `Total: 1 test in 1 file`.
- Commands and observed results after the correction:
  - `uv run pytest -q scripts/tests/test_integrity.py
    scripts/tests/test_suite_states.py` → exit 0, 46 passed in 11.71s.
  - `node scripts/check-ts-test-policy.mjs
    .audit-repros/array-from-empty.spec.ts` → exit 1,
    `empty test.each parameter table is forbidden`.
  - `node scripts/check-ts-test-policy.mjs
    .audit-repros/empty-let.spec.ts` → exit 1,
    `empty test.each parameter table is forbidden`.
  - `uv run python -c 'import sys; from pathlib import Path;
    sys.path.insert(0, "scripts"); import verify; r=Path.cwd();
    c=verify.Context(r, r/"scripts/verification-suites.json",
    r/"docs/PROJECT_STATUS.md"); f=verify.check_focused_tests(c, ());
    print(*f, sep="\n"); raise SystemExit(bool(f))'` → exit 1,
    `e2e/scanner-discovery-bypass.test.ts:3:1: forbidden test.skip test
    modifier`; `pnpm exec playwright test
    e2e/scanner-discovery-bypass.test.ts --list` independently listed the same
    temporary file as one test in one file with exit 0.
  - `node scripts/check-ts-test-policy.mjs
    .audit-repros/array-from-positive.spec.ts` and
    `node scripts/check-ts-test-policy.mjs
    .audit-repros/nonempty-let.spec.ts` → exit 0 for nonempty and
    runtime-unknown controls.
  - `uv run python -c 'import sys; from pathlib import Path;
    sys.path.insert(0, "scripts"); import verify; r=Path.cwd();
    c=verify.Context(r, r/"scripts/verification-suites.json",
    r/"docs/PROJECT_STATUS.md"); f=verify.check_focused_tests(c, ()); print(f);
    raise SystemExit(bool(f))'` → exit 0 with `[]` for an ordinary E2E
    `.test.ts`; `pnpm exec playwright test
    e2e/scanner-discovery-positive.test.ts` → exit 0, 1 passed.
  - `pnpm verify` → exit 0; all 15 ACTIVE suites passed and visual remained
    honestly NOT_YET_APPLICABLE. Counts included 9/9 TypeScript package tasks,
    9/9 fixture files with 103/103 tests, 8/8 focused fixture files with
    102/102 tests, 20/20 contract files with 2,440/2,440 tests, 6/6 focused
    contract files with 662/662 tests, 686/686 Python tests, 11/11 Rust tests,
    and 1/1 Playwright test. No skipped, pending, todo, or excluded test was
    reported.
- Artifacts: none; all temporary reproduction and positive-control files were
  removed after inspection.
- Boundary: these are local implementation and execution results only.
  M02-W01 remains IN_PROGRESS and unaccepted; no independent acceptance,
  governance stamp, known-issue closeout, or M02-W02 readiness is claimed.
  M02-W02 remains NOT_STARTED.

### M02-W01 — Reopened corrective lifecycle after independent audit verdict B (2026-07-29)

- Current revision: bounded corrective content candidate based on
  `4fb164ff3351fdedcee3542350a9fa565264d1fa` / tree
  `c21d246256d844bd839de08609a0694e52df2303`; containing commit recorded
  post-commit.
- Current state: M02-W01 is IN_PROGRESS, M02-W02 is NOT_STARTED, and no
  package is READY. KI-0039 through KI-0045 remain IN_PROGRESS. This entry
  claims a locally verified corrective candidate only; no hosted result,
  independent acceptance verdict, governance stamp, or M02-W02 readiness is
  claimed.
- Invalidated anchors: content commit
  `a88fa6787db88c322938e6c0c5a89e67584a34a5` / tree
  `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5` and stamp `5309909`. The command,
  clone, and hosted-run facts below remain historical execution records only;
  every former claim that they established semantic completeness,
  comprehensive privacy, independent certification, M02-W01 verification, or
  M02-W02 readiness is explicitly withdrawn.
- Audit result: **B — BLOCKING DEFECT FOUND.** Reproduced defects are stale
  credential truth and a second wrong-clock freshness case; five fully
  re-signed semantic contradictions; privacy misses, false alarms, and raw
  diagnostic disclosure; constructed deprecated-platform-v1 references;
  check-mode filesystem mutation; a shared implementation oracle;
  conditional-skip evasion; shallow topology and unused consequential
  policies; and an accepted concurrent root-identity replacement.
- Evidence boundary: automated author/reviewer strings and unequal role
  labels establish only recorded fixture-authoring provenance. They never
  established an independent model audit. Certification now requires a
  genuinely fresh read-only session against the exact corrected content
  commit after two clean clones and fresh three-OS CI.

#### Second bounded corrective content candidate

- Start proof: clean `main`, with `HEAD == origin/main ==
  4fb164ff3351fdedcee3542350a9fa565264d1fa`, tree
  `c21d246256d844bd839de08609a0694e52df2303`, and canonical specification
  SHA-256
  `3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943`.
  No specification, dependency, lockfile, pinned toolchain, timeout, workflow
  topology, product package, M02-W02 artifact, or governance stamp changed.
- Workflow: one lead plus three bounded read-only reviewers covering fixture
  semantics, validator/oracle, and privacy/test-policy. They used no recursive
  delegation and made no edits; only the lead reviewed and integrated the
  candidate.
- Truth corrections: all twelve cross-scenario designs now use exactly-one
  semantic selectors by stable artifact identity/category/fact key, never
  array position. Former claim 71 is regenerated as claim 70 and cites
  employment evidence 61: task-tracking is strong-related to scheduling and
  covers 1,277 non-overlapping days against the 365-day threshold. Scenario 6
  now truthfully marks requirement 25 unsupported/ABSTAIN because profile 2
  has no reviewed process-mapping or adjacent activity. The six reviewed
  partial cross-scenario cases cite evidence 22, 28, 34, 37, 44, and 50 with
  deterministic fact/date/threshold rationales.
- Temporal and outcome corrections: the expired-license adversary remains
  expired and nonreleasing; every field policy uses the scenario evaluation
  date. The four historical relocation records (policies 15, 33, 51, and 67)
  now require confirmation and cannot release. Historical backfill remains
  structurally representable but stale on entry. Scenario 29 explicitly
  blocks the REMOTE_ONLY/HYBRID contradiction. Résumé 11 has five unique
  evidence-backed facts, a substantive page two, and a literally true break
  rationale.
- Assurance changes: consistency checks now derive experience relation and
  non-overlapping duration independently, enforce field/profile/source
  coupling and chronology, and validate global/nested ID shape and uniqueness.
  The hand-reviewed test-only oracle covers complete projection hashes plus
  explicit critical bindings and catches all named repaired mutations,
  including coherent generator/validator policy drift. Privacy scans generic
  and numeric secrets under semantic keys, distinguishes sensitive long
  identifiers from ordinary numbers, and redacts untrusted paths/IDs/values.
  Loader and platform scans convert replacement/read failures into fixed
  diagnostics. A later audit disproved the prior test-policy assurance claim:
  the scanner did not recognize `Array.from([])` or an unchanged empty `let`
  binding, and E2E discovery omitted `.test.*`. The execution counts below
  remain historical implementation records and did not establish that those
  bypasses were closed.
- Exact regenerated seed: 12 profiles; 72 evidence artifacts; 12 résumés; 24
  jobs; 72 requirements; 36 scenarios / 108 evaluations; 77 supported claims;
  31 gaps; and 69 policies, for 405 collection records. Evidence categories
  are 15 credential, 12 education, 19 employment, 14 project, and 12 approved
  assertion records. Corpus digest is
  `sha256:4825a6c713833104ab7bcb8eb1b9649688f513fb823cb9f6a9125be5919f69d2`;
  manifest historical hash is
  `sha256:55adb4f3262032107c2cfd9f40698180b628a2f4b1f39356e7d6bd32264edc5d`.
- Direct commands: write-mode seed followed by read-only seed check,
  validation, privacy, platform-v1, discovery, and focused Vitest all exit 0.
  Privacy covers 25 committed producer files / 26,179 scalar fields;
  deprecated-platform discovery is exactly 15 pairs; focused fixtures are
  8/8 files and 102/102 tests, and the package is 9/9 files / 103/103 tests.
  The focused integrity/suite-state Python regressions pass 44/44.
- Canonical aggregate: `pnpm verify` exits 0 with all fifteen ACTIVE suites
  PASS and visual honestly NOT_YET_APPLICABLE. Results include 183 generated
  contracts byte-identical, 20/20 contract files / 2,440 tests, 662 focused
  contract tests, 684 Python tests, 11 Rust tests, one pinned-Chromium smoke
  test, empty compatibility drift, 45 status groups, and status-neutral
  verification. Zero tests are skipped, pending, todo, or excluded.
- Boundary: this content candidate remains deliberately unaccepted.
  Exact-commit hosted CI can only run after publication and will be recorded
  in the implementation handoff; fresh independent audits and a separate
  governance-only closeout are still mandatory.

#### Historical invalidated execution record

- Revision: final executable content commit
  `a88fa6787db88c322938e6c0c5a89e67584a34a5` / tree
  `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5`. Clean starting commit
  `0c8efc9212162bcb4fa846e453007d9404d97429` / tree
  `bc097542a25eddd9cfd39803fed884f71e20d86d` remains recorded. M01 remains
  ACCEPTED at preserved executable tree
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

#### Invalidated reviewer self-reports and bounded M01 audit follow-ups

- The former fixture/schema reviewer initially rejected overstated relations,
  source-link gaps, multiplexed assertion release, and backdated review
  metadata. After correction, the reviewer reported reproducing digest
  `d91448c4…b0b2f`, ran seed/validation and 50/50 focused plus 51/51 package
  tests, and at `2026-07-29T09:05:28Z` attested the
  `m02w01-fixture-reviewer` metadata and
  `M02W01_INDEPENDENT_SYNTHETIC_REVIEW` provenance for these exact bytes.
  That metadata is authoring provenance, not independent certification.
- The former privacy/security reviewer initially rejected path/key/extension
  bypasses and unsafe diagnostic pointers. After correction, the reviewer
  reported reproducing both manifest hashes, exact counts, 50/50 tests,
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
- Known flaky behavior: none waived; failed hosted runs below remain
  historical evidence and every correction requires a complete fresh
  lifecycle.
- Historical closeout state: the invalidated executable content commit, both
  repeated exact clean clones, fresh three-OS content CI, and complete
  Windows-log inspection all passed as execution checks. The later audit
  proved they did not establish fixture truth or security completeness.
  M02-W01 is now IN_PROGRESS, M02-W02 is NOT_STARTED, no package is READY,
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
  rule changed. Corrected content commit
  `0679df6b12a2f6af543096746ff5b39368b34d89` / tree
  `ecbcf12b5282ff3cca084828986c5871c08954af` contains exactly those changes
  plus their in-progress evidence.
- That corrected commit passed two complete exact-commit clean clones:
  `/tmp/japp-m02w01-corrected-clones.QKfXm6/normal` and
  `/tmp/japp-m02w01-corrected-clones.QKfXm6/clone with spaces – ü`. Each
  performed frozen/locked installs, both Cargo fetches, clean doctor,
  generation/compatibility checks, all direct fixture checks, exact 50/50
  focused tests, status/traceability, full verification, canonical hash, and
  clean-tree assertion at exact tree `ecbcf12b…54af`.
- Fresh hosted corrective run `30440572546` is also failed historical
  evidence, not closeout proof. macOS job `90538645566` and Ubuntu job
  `90538645596` passed. Windows job `90538645686` proved the correction's
  intended fixture behavior: the serialized package passed 6/6 files and
  51/51 tests, its complete privacy scan passed in 531 ms, fixture-corpus
  passed with exact seed/validation counts, and every later root suite passed.
  The sole failure was `unit-ts`: two pre-existing M01 semantic-matrix files
  concurrently invoked the same test-only Rust harness build and both
  returned `ADAPTER_EXIT_NONZERO`; 2,438 contract assertions passed and two
  parity assertions could not execute. The complete 604,581-byte /
  3,160-line Windows log was consumed and hashes to
  `sha256:5f6d38fd97a3738392fb1fa22922ea5772ba7b323bfb985ccfb402be893e8650`.
- KI-0036 serializes contract test files in the existing Vitest configuration
  so process-local Rust-build memoization cannot race against one shared
  Windows target directory. It changes no schema, generated contract,
  semantic assertion, expected result, dependency, workflow, toolchain, or
  timeout; the accepted 183-file generated tree remains byte-identical.
  Locally, all 20 contract files / 2,440 tests pass in serialized mode and
  full `pnpm verify` exits 0 with every ACTIVE suite PASS.
- Corrective content commit
  `5661ffa02c4301640b2c536b374aa8a73e1c8384` / tree
  `d39a94483dd93146727bec15dc7a31d7484190ef`, message
  `fix: serialize shared Rust contract harness`, contains exactly four files:
  `packages/contracts/vitest.config.ts`, `docs/PROJECT_STATUS.md`,
  `docs/TEST_EVIDENCE.md`, and `docs/KNOWN_ISSUES.md`. It serializes contract
  files without changing the existing 30-second test timeout, schemas,
  generated contracts, semantic assertions, dependencies, workflow, or
  toolchain.
- That commit passed two complete exact-commit clean clones:
  `/tmp/japp-m02w01-serialized-clones.6KCM1P/normal` and
  `/tmp/japp-m02w01-serialized-clones.6KCM1P/clone with spaces – ü`. Both
  used explicit pinned Node 24.18.0, frozen/locked installs, both Cargo
  fetches, pinned Chromium, clean doctor (23 PASS / zero warning / zero FAIL /
  one honest NOT_YET_APPLICABLE), byte-identical generation, empty
  compatibility, exact fixture commands, 50/50 focused tests, status,
  traceability, full verification, canonical hash, and clean-tree assertions.
  Both ended at exact commit/tree `5661ffa…` / `d39a9448…` with verification
  exit 0 and every ACTIVE suite PASS.
- Fresh three-OS content run `30442428877` passed exact SHA
  `5661ffa02c4301640b2c536b374aa8a73e1c8384`: macOS job `90544642811`,
  Ubuntu job `90544642825`, and Windows job `90544642861`. The complete
  Windows log was consumed: 306,581 bytes / 1,709 lines /
  `sha256:c8e7b41b43defcd5cd39174274fe1f29e081a66808abb130865d6cf77ed29111`.
  It proves 20/20 contract files and 2,440/2,440 tests, the exact seed and
  validation counts, 25 producer files / 20,813 text fields with no
  real-looking PII, secrets, local identities, hidden text, or prompt
  injection, 15 deprecated-v1/v2 pairs, exact 50-test discovery, all fifteen
  ACTIVE suite rows PASS, verification exit 0, and a successful
  post-verification clean-tree step.
- The first uncommitted five-file governance-stamp attempt correctly failed
  full `pnpm verify`: Python verification passed 675 tests and failed exactly
  `test_m00_may_remain_accepted_while_m01_blockers_are_live` and
  `test_fixed_ledger_and_none_sentinel_allow_later_readiness`. Both historical
  fixtures inherited the authorized M02-W02 READY row and then constructed a
  second READY package. No stamp commit was made; the five governance files
  were restored to M02-W01 IN_PROGRESS.
- KI-0037 applies the existing `reset_downstream` boundary helper to both
  affected setups and explicitly seeds M02-W02 READY in their regression
  premises. `uv run pytest -q scripts/tests/test_validate_status.py -k
  'm00_may_remain_accepted_while_m01_blockers_are_live or
  fixed_ledger_and_none_sentinel_allow_later_readiness'` passes 2/2; all 148
  status-validator tests pass; full `pnpm verify` passes 677/677 Python tests
  and every ACTIVE suite. A new corrective content commit and complete fresh
  two-clone/three-OS lifecycle are required before another stamp attempt.
- KI-0037 corrective content commit
  `b0669a4c702d34ba2f6db254d190438bdb258a84` / tree
  `2a958423d6b2f98b942ee73c640a6a7e4e17eb60`, message
  `fix: isolate historical status fixtures`, contains exactly
  `scripts/tests/test_validate_status.py`, `docs/PROJECT_STATUS.md`,
  `docs/TEST_EVIDENCE.md`, and `docs/KNOWN_ISSUES.md`.
- Two fresh exact-commit clones passed at
  `/tmp/japp-m02w01-readiness-pinned.rYQkbY/normal` and
  `/tmp/japp-m02w01-readiness-pinned.rYQkbY/clone with spaces – ü`.
  Both explicitly asserted Node 24.18.0 and pnpm 11.17.0 before frozen/locked
  setup, ran both Cargo fetches and pinned Chromium, clean doctor, 183-file
  generation, empty compatibility, exact fixture seed/validation/privacy/
  deprecated-v1/discovery/focused checks, status, traceability, full
  verification, canonical hash, exact commit/tree, and clean-tree checks.
- Fresh run `30444571597` passed macOS job `90551671445` and Ubuntu job
  `90551671488` at exact SHA
  `b0669a4c702d34ba2f6db254d190438bdb258a84`; Windows job `90551671515`
  failed only the first workspace-wide execution of
  `a Rust adapter that does not compile fails the subprocess boundary`.
  The 30,018-ms Cargo negative child left a descendant holding
  `japp-rust-negative-*`, and mandatory `rmSync` failed with `EPERM`.
  Unit TypeScript therefore reported 19/20 files and 2,439/2,440 tests.
  The same infrastructure file later passed 8/8 and the focused contract
  suite passed 662/662 in the same job.
- The complete Windows log was consumed: 298,116 bytes / 1,688 lines /
  `sha256:c8b45a1c8e6dc63cd6b55d224b4789e8203ea362021b8fc78b56dafd29ed8c4b`.
  It proves the exact SHA, ACTIVE fixture suite, 6/6 package files and 51/51
  tests, exact seed/validation counts, 25-file/20,813-field privacy result,
  fifteen deprecated-v1/v2 pairs, exact 50/50 focused tests, byte-identical
  183-file generation, and every later ACTIVE suite PASS. Verification exit
  was 1 solely because `unit-ts` preserved the earlier cleanup failure, so
  the clean-tree step correctly did not run.
- KI-0038 replaces only that negative fixture's Cargo coordinator with direct
  pinned `rustc --emit=metadata` over the same invalid source. The exact
  `ADAPTER_EXIT_NONZERO` assertion, 30-second child boundary, 128-KiB output
  cap, compiler toolchain, and mandatory cleanup remain unchanged. Ten
  consecutive focused executions pass 8/8, and all 20 contract files /
  2,440 tests pass locally. Full `pnpm verify` also passes 677/677 Python
  tests and every ACTIVE suite.
- Final corrective content commit
  `a88fa6787db88c322938e6c0c5a89e67584a34a5` / tree
  `c0b7e8312e8ffce6771cbce55b1e62cf8a1302d5`, message
  `fix: isolate Rust negative compile process`, contains exactly
  `packages/contracts/test/contract/infrastructure.test.ts`,
  `docs/PROJECT_STATUS.md`, `docs/TEST_EVIDENCE.md`, and
  `docs/KNOWN_ISSUES.md`. It changes no schema, generated contract, fixture
  datum, semantic verdict, dependency, workflow, toolchain, or timeout.
- Two fresh exact-commit clones passed at
  `/tmp/japp-m02w01-rustc-clones.q6dpVf/normal` and
  `/tmp/japp-m02w01-rustc-clones.q6dpVf/clone with spaces – ü`. Both asserted
  Node 24.18.0, pnpm 11.17.0, exact commit/tree, and a clean starting tree;
  ran frozen pnpm and locked uv setup, pinned Chromium, both locked Cargo
  fetches, clean doctor, byte-identical 183-file generation, empty
  compatibility, exact seed/validation/privacy/deprecated-v1/discovery
  checks, 50/50 focused fixture tests, status, traceability, and full
  verification; then reproduced the canonical specification hash and ended
  clean at the same commit/tree.
- Fresh three-OS content run `30446331580` passed the exact final content SHA:
  macOS job `90557503972`, Ubuntu job `90557503916`, and Windows job
  `90557503861`. The complete Windows log was consumed: 293,991 bytes /
  1,666 lines /
  `sha256:4b554c9f28f56a32532cdf0e26f5d53f9e70253dd815fdceca29f0d4440462ae`.
  It proves the full exact SHA, clean doctor, fixture-corpus ACTIVE, 6/6
  package files and 51/51 tests, exact seed/validation counts, 25 producer
  files / 20,813 text fields with no real-looking PII, secrets, local
  identities, hidden text, or prompt injection, fifteen deprecated-v1/v2
  pairs, five focused files / exact 50/50 tests, 20/20 contract files /
  2,440/2,440 tests, 662/662 focused contract tests, byte-identical 183-file
  generation, every ACTIVE suite PASS, verification exit 0, and the
  post-verification clean-tree step.
- KI-0033 through KI-0038 are therefore FIXED at the final executable content
  tree. The closeout-only stamp changes only `docs/PROJECT_STATUS.md`,
  `docs/TEST_EVIDENCE.md`, `docs/KNOWN_ISSUES.md`,
  `docs/traceability.json`, and `docs/REQUIREMENTS_TRACEABILITY.md`. Its own
  fresh final-head three-OS run and complete Windows-log inspection follow
  the conventional self-unreferenced stamp and are bound in the final
  implementation handoff.

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
