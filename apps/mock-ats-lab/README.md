# apps/mock-ats-lab

Deterministic local ATS fixture web app built by **M02-W03**
(docs/MASTER_IMPLEMENTATION_SPEC.md §5.1, §8.2). It provides the browser
surfaces that later M02 packages (scanner, resolver, drivers,
reconciliation, benchmark) exercise in real bundled Playwright Chromium.
This package contains the forms and their deterministic behavior only — no
extension, no field scanner, no autofill, no evaluation runner, and no
product UI. Nothing here is a production ATS compatibility claim: research
fixtures never become support evidence (see docs/COMPATIBILITY_MATRIX.md).

## Safety boundary

- Binds **127.0.0.1 only** (dev port 4760, E2E port 4761, both
  `--strictPort`). No external network: no CDNs, fonts, analytics,
  fetches, or live form actions. The root Playwright suite fails any test
  that issues a non-loopback request.
- **No live submission.** Every page carries a prominent synthetic-lab
  notice; the multipage flow's "submission" is a local mock that never
  leaves the loopback fixture.
- All values are synthetic reserved data (`example.test` addresses,
  555-01xx numbers, invented employers). No real resume, credential, or
  applicant datum may ever be added here.
- Untrusted-looking fixture strings (prompt-injection cases) are rendered
  exclusively through Text nodes; the unit suite statically forbids
  HTML-string sinks, dynamic code evaluation, network APIs, randomness,
  and wall-clock identity in page code.

## Architecture

One Vite 7.3.6 multi-page app rooted at `site/` (18 HTML entries; build
output is hash-free, unminified, and byte-deterministic — two builds of
the same tree are identical). Framework routes use the **real** runtimes:
React 19.2.8 (`createElement` + hooks, `react-dom/client`) and Vue 3.5.41
(`h()` render functions + `reactive`). Remaining routes are vanilla DOM
built through the text-only helpers in `site/src/lab/dom.ts`, plus one
custom element with an **open** shadow root. Multipage/receipt state lives
in versioned `sessionStorage` keys, so every fresh Playwright context
starts from the exact initial state; an explicit "Reset lab state" action
provides the deterministic in-app reset. All delays are fixed constants in
`site/src/lab/constants.ts` (400/500/500/600 ms); receipt identity is the
ordinal-derived `RCPT-MOCK-####`.

Dependencies are test-only and exactly pinned: `react`/`react-dom`
19.2.8, `vue` 3.5.41 (bundled into the fixture pages) and `vite` 7.3.6
plus catalog-pinned `typescript`/`vitest`/`@types/*` (build/test tooling).
esbuild's unnecessary postinstall script is deliberately not executed
(`allowBuilds` decision in pnpm-workspace.yaml); its platform binary comes
from optionalDependencies.

## Fixture catalog

`site/src/catalog/cases.ts` is the versioned case catalog: catalog version
**1.0.0**, schema version **1**, **32 cases** across **16 routes**, each
with a stable `MAL-###-###` ID, title, route, surface tags, provenance,
and explicit synthetic-data status. `catalog.manifest.json` commits the
canonical SHA-256 digest, case count, and route count;
`pnpm --filter @japp/mock-ats-lab catalog:check` and the unit suite
recompute it. Expected state transitions deliberately live on the test
side (`e2e/mock-ats-lab/support/expected-transitions.ts`, asserted 1:1
against the catalog) so no expected result, sensitivity decision, or
scanner ground truth is served to the browser — pages expose only the
realistic labels, ARIA relationships, values, options, visibility, and
validation an actual applicant page would expose. Stable DOM IDs exist
for fixture identity only.

Surfaces covered (spec §8.2): native controls with required/optional and
sensitive/consequential fields; real React- and Vue-controlled groups with
rerender persistence, stale-direct-DOM-write rejection, and observable
site-side rewrites; conditional insertion/removal with dependent required
state; fixed-delay insertion; node replacement beside a stable control;
three-step multipage flow with validation-gated Next, Back persistence,
review, fixed-delay receipt, duplicate warning, and reset; same-origin
iframe with frame-local identity/validation; open shadow DOM; ARIA
combobox (filtering, keyboard, empty state) and listbox; genuinely
windowed virtualized listbox (480 options, bounded mounted subset,
`overflow-anchor: none`); composite date and phone widgets with
deterministic normalization; local file upload accept/reject/metadata
(no parsing, no upload); custom/cross-field/delayed validation; hidden
off-screen honeypot that rejects a populated submission; CAPTCHA
placeholder that pauses until an explicitly labeled test-only manual
action; and inert prompt-injection text in a help block and the synthetic
job description.

## Commands

```bash
pnpm --filter @japp/mock-ats-lab dev            # manual inspection on 127.0.0.1:4760
pnpm --filter @japp/mock-ats-lab build          # deterministic dist/ build
pnpm --filter @japp/mock-ats-lab e2e-server     # build + preview on 127.0.0.1:4761
pnpm --filter @japp/mock-ats-lab catalog:check  # catalog/manifest digest check
pnpm --filter @japp/mock-ats-lab typecheck
pnpm --filter @japp/mock-ats-lab test           # 32 unit tests (catalog, state
                                                # machines, static source policy)
pnpm exec playwright test                       # root suite: 59 tests (58 lab
                                                # + 1 browser smoke); the root
                                                # webServer builds and serves
                                                # this app per run
```

## Known limitations (v1)

- Closed shadow roots, cross-origin iframes, repeater groups, and
  Workday-like tenant variants are not part of v1; M02-W12 owns the ATS
  research variant matrix and later packages own everything that scans or
  fills these forms (M02-W07+), corpus freezing (M02-W06), gate execution
  and decision (M02-W14/W15), and visual regression (M10-W06 — the
  `visual` suite stays truthfully NOT_YET_APPLICABLE; these behavior tests
  are not product visual baselines).
- The CAPTCHA placeholder is a pause fixture, not a CAPTCHA integration;
  its resolve button is a test-only manual action by design.
