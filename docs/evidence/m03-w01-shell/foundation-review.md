# M03-W01 initial shell review

This initial foundation is implemented and captured. M03-W11 must consolidate
and freeze it after the broader surface review. No later surface, frozen token
system, packaged lifecycle or platform certification is asserted here.

## Originality and task references

`docs/ui/SIMPLIFY_FAMILIARITY_MATRIX.md` records the public task-level reference
inputs accepted under OD-037 / ADR-0008. All component markup, CSS tokens,
navigation contracts and the generic briefcase SVG were authored in this
repository. Tauri's pinned CLI derived desktop raster/container icons from
`apps/desktop/src-tauri/icons/source.svg`; no third-party artwork, fonts,
screenshots or product names are incorporated. System fonts are used.

## Initial anti-bloat application

The implementation agent inspected the actual native shell and browser captures;
the independent shell reviewer inspected all five retained PNGs and source.
These observations are scoped to the source digest in `captures.json`.
The global checklist remains unfinalized until M03-W11.

| Rule | Initial observation |
|---|---|
| AB-01 | Navigation and compact content panels; no marketing hero. |
| AB-02 | No KPI cards or fabricated metrics. |
| AB-03 | No gradients, glass or motion; normal 1.5rem heading. |
| AB-04 | One page heading; concise capability and build-state explanations. |
| AB-05 | Versions/capabilities use grouped label/value rows. |
| AB-06 | One contextual Diagnostics action on Home; the global destination remains available. |
| AB-07 | Plain text capability states; no badge/chip system. |
| AB-08 | Shared navigation, skip link, status primitives, error boundary and tokens are imported from packages/ui. |
| AB-09 | Unavailable destinations explain the current build and provide the working global Home link. |
| AB-10 | Brand-neutral workspace label orients the user; the generic briefcase identifies the workspace. Build and submission notices prevent false capability assumptions; each control has an actual shell action. |
| AB-11 | Initial compact baseline CAPTURED; revision-specific acceptance/freeze is deferred to M03-W11. No owner-approved final baseline is claimed. |
| AB-12 | Token contrast tests, browser/native keyboard and skip-link checks, reduced-motion and 200% text reflow pass. Browser captures include 320px and 1120px widths. Actual screen-reader software and cross-platform visual certification have not run. |

## Boundaries

Only app and Tauri version IPC reads are granted. The final rebuilt native app
actually rejected an ungranted app-name read, development-origin navigation and
new windows. Product service, AI, documents, applications and submission are
explicitly unavailable at this stage. Renderer failure/pending fixtures are
isolated under `apps/desktop/test/renderer` and excluded from the shipping build.

Independent review initially found SHELL-001: debug assertions wrongly implied
development mode for a debug-packaged custom-protocol app. The regression
failed before the fix. The shipping callback now uses `tauri::is_dev()`, both
six-test protocol modes pass, and the independent reviewer closed the finding.
The final rebuilt GUI was then inspected, as recorded in native-observations.json.
