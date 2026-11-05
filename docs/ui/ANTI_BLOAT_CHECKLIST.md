# Anti-Bloat Checklist

Blocking, surface-specific review memory for JAPP-MASTER-001 v1.4. It prevents
familiarity work from expanding into decorative dashboard or marketing UI.
M00-W11 creates the checklist only. No surface has been reviewed or passed.

## Result vocabulary

Each rule and each surface uses `NOT_EVALUATED`, `PASS`, `FAIL`, or
`EXCEPTION_APPROVED`. `EXCEPTION_APPROVED` requires a dated owner decision and
an accessibility/safety rationale. A checklist cannot pass while any rule is
`NOT_EVALUATED`, `FAIL`, or lacks linked revision-specific evidence.

## Mandatory rules

| Rule ID | Rule | Current result |
|---|---|---|
| `AB-01` | No marketing hero treatment on authenticated product surfaces. | `NOT_EVALUATED` |
| `AB-02` | No decorative KPI cards that do not support a user decision or action. | `NOT_EVALUATED` |
| `AB-03` | No unapproved gradients, glass effects, oversized headings, or animation. | `NOT_EVALUATED` |
| `AB-04` | No repetitive title, subtitle, and explanatory-copy stacks. | `NOT_EVALUATED` |
| `AB-05` | No one-value cards when a compact label/value treatment is sufficient. | `NOT_EVALUATED` |
| `AB-06` | No duplicate primary actions for the same scope. | `NOT_EVALUATED` |
| `AB-07` | No excessive badges, chips, or pills in place of hierarchy and plain text. | `NOT_EVALUATED` |
| `AB-08` | No page-local reinvention of an approved shared component or token. | `NOT_EVALUATED` |
| `AB-09` | Empty states are concise, actionable, and free of decorative filler. | `NOT_EVALUATED` |
| `AB-10` | Every sentence and decorative element has a documented user purpose. | `NOT_EVALUATED` |
| `AB-11` | Density and hierarchy match the owner-approved surface baseline. | `NOT_EVALUATED` |
| `AB-12` | Accessibility, focus clarity, contrast, and reduced-motion behavior are preserved. | `NOT_EVALUATED` |

## Surface review ledger

| Surface ID | Owner package(s) | Review state | Evidence revision | Reviewer | Owner exception | Notes |
|---|---|---|---|---|---|---|
| `DESKTOP_SHELL` | `M03-W01`, `M03-W11` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `HOME_DASHBOARD` | `M03-W11`, `M33-W07` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `JOBS` | `M33-W07` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `TRACKER` | `M25-W08` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `DOCUMENTS_RESUMES` | `M09-W07`, `M12-W07` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `PROFILE` | `M08-W07` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `SETTINGS` | `M05-W17`, `M27-W13`, `M27-W14` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `EXTENSION_DEFAULT` | `M17-W01`, `M17-W11` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `EXTENSION_AUTOFILL` | `M17-W11` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |
| `EXTENSION_REVIEW_UNRESOLVED` | `M17-W05`, `M17-W11`, `M34-W07` | `NOT_EVALUATED` | — | — | — | Not implemented/reviewed by M00-W11 |

## Current migration state

- Checklist owner: `M00-W11`
- Evaluated rules: 0
- Passed surfaces: 0
- Approved exceptions: 0

## Scoped controlled-shell inspection — 2026-10-28

Different review individually inspected14 actual1120/320px catalog PNGs plus the separate200% text-resize image, and cleared74/74 retained-data checks. Exact rule reasoning is in docs/evidence/m03-w11-shell-catalog/proof.tar.gz (independent-review/REVIEW.md). Its scoped AB01–10 findings are PASS for those observed shell states only: original shared components/tokens, plain task hierarchy, no hero/KPI/decorative treatment, truthful availability and one content primary action. Copy/icons serve orientation, capability disclosure, recovery and the submission boundary.

Canonical mandatory-rule and surface-review rows above remain unchanged. AB11/12 and the complete checklist remain NOT_EVALUATED. No approved baseline exists for density comparison; browser keyboard/focus/reflow/reduced-motion and sampled static-token contrast do not constitute comprehensive accessibility/assistive-technology/native review. No exception, passed surface, frozen token system or delegated visual acceptance is added.
