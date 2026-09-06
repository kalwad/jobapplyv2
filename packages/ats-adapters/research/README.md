# M02-W12 public synthetic research expansion

This is a local, test-only manifest format owned by `@japp/ats-adapters`.
`matrix.ts` exports `RESEARCH_MATRIX`; `fixture-html.ts` exports
`fixtureHtml(variant)`, a deterministic body fragment with no scripts or
external resources. `manifest.ts` provides `readResearchManifest()` for the
committed artifact and `computeResearchManifest()` for a read-only integrity
comparison. Ordinary tests never write or refresh expected truth.

The 200 expansion cases are 80 Workday, 40 Greenhouse, 40 Lever and 40 Ashby.
Their differences are structural: family shells, grouped/reordered/nested/
separated sections, step-specific controls, locale-specific address shapes
and constraints, repeaters with one or two initial rows, upload/parser
states, validation messages, navigation ambiguity and session boundaries.
All eleven research step classes and all twelve session classes occur.
Workday includes four country/locale configurations; the other slices have
two. Variant IDs and routes are stable and descriptive. A signature that
removes prose, research metadata, locale labels, class names and accessible
section-label text still distinguishes all 200 structures. Names or IDs
alone therefore do not inflate the count.

The manifest commits each exact HTML fragment, recipe, expected boundary,
structural signature, control count and source file bytes. Expected-result
provenance is specification-derived synthetic implementation work, explicitly
`NOT_REVIEWED`; reviewer-role metadata is a pending role and never an
independent-certification claim. Prepared inventory counts are 4,060 controls,
720 sensitive/prohibited controls and 200 honeypots. Scored controls, public
no-submit executions and owner-holdout executions remain zero. W13 owns
scoring and W14 owns those executions. No result grants Gate A authority or
production ATS support.

The parent commitment is the exact W06 v1 development manifest. Its 32 cases
plus this 200-case expansion yield 232 cumulative development cases, without
changing the parent's corpus version, coverage or bytes. The W06 version
index, source inventory, source files, expected truth and owner holdout are
untouched. This separate expansion is not a replacement or a correction of
W06 v1, and it does not reuse W06's frozen runner policy for a new corpus.
Only this package-local manifest schema is introduced; benchmark, owner
holdout and global corpus schema versions do not evolve.

After this version is committed, its artifact bytes are immutable. Future
work appends a new full-major expansion version and preserves this version,
its exact sources and expected outputs. Changing an old expectation requires
an explicit correction record with old/new versions and digests, rationale,
independent owner/reviewer roles, affected comparisons/evidence, invalidation
and fresh execution. Do not regenerate this version to fix a failing test.
The current writer artifact is development evidence pending same-package internal
verification; these rules confer no certification.

## Browser behavior contract

Browser tests install the fragment under the existing loopback lab route,
then move same-origin history to `variant.route`. This leaves every frozen
W03 site file unchanged. Tests obtain the real extension's scanner descriptors
and canonical W09 decisions, then use the W10/W11 transaction and dynamic
protocols. Metadata must not supply successful scanner/driver results.

- `DELAYED_RERENDER`: the synthetic site asynchronously replaces an edited
  control with a new node; the test observes durable value and fresh identity.
- `CONDITIONAL_INSERTION`: a user/site event appends a newly required control
  to `#dynamic-slot`; reconciliation must discover it before readiness.
- `PAGE_GENERATION_CHANGE`: same-origin history and application content change;
  old addresses/actions must reject after the new generation is observed.
- `LONG_SESSION_MUTATION_BURST`: the site emits repeated bounded subtree
  mutations and temporary field insertions/removals; the test measures the
  real dynamic engine, scan counters and Chromium CPU/heap without claiming
  production's separate 45-minute soak.
- `PARSER_ADDS_ROW`: a synthetic local upload response adds exactly one
  repeater item; the scanner discovers the new fields. Browser tests model
  the site effect, not an adapter action.
- `PARSER_DUPLICATE_EXISTING_ROW`: the synthetic parser proposes an already
  present work-experience item; duplicate prevention must leave its count
  unchanged.
- `UPLOAD_REJECTION`: the site rejects the local synthetic file and exposes a
  validation message. The extension must not treat a file selection alone as
  verified success.

`#experience-repeater` covers work experience, education and skills/languages. Its accepted W10 controller, stable item labels, item value hosts and ADD affordance are exercised through W10/W11; the harness installs synthetic site listeners for successful creation, parser insertion, reorder, rerender and ambiguous-item rejection. `#parser-status` is a live status region. Workday prompt-like controls
are ARIA comboboxes with explicitly bound listbox options. The browser harness
may install local open/select/rerender behavior; fixture generation itself
never executes it.

Navigation is identification-only. The currently supported unique candidate is `Next`.
`Save and continue` and `Review application` are physically present but have
expected state `MISSING` because W10 deliberately recognizes only its closed
name set; ambiguous cases contain two
`Next` buttons, unsafe review cases contain `Submit application`, and session
boundaries contain no forward control. Every button is `type="button"`.
The extension never invokes navigation, submission, credentials, MFA, email
verification, CAPTCHA, account creation, consent or signature actions.
