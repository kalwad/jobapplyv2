# UI Familiarity Governance

Canonical governance memory for the familiarity-first UI obligations introduced
by JAPP-MASTER-001 v1.4. This file is a planning and evidence contract. It does
not certify a UI, record an owner approval, or claim that any reference,
screenshot, fixture, study, or product surface exists.

## Purpose and scope

Familiarity means that common job-search tasks use recognizable information
architecture, control placement, terminology, density, and interaction patterns
so a user can transfer existing task knowledge. Familiarity does not mean
cloning another product's expression. Repository-owned implementation must
remain original in code, assets, copy, tokens, composition, and branding.

Publicly observable references and owner-supplied screenshots may inform a
review only when their provenance and permitted use are recorded. Source-code,
private-API, network-payload, proprietary-asset, font, icon, and design-token
extraction is prohibited. Automated scraping or reverse engineering to recreate
a third-party interface is prohibited.

Accessibility, safety, privacy, clear consent, reduced-motion behavior, and
platform correctness take precedence over visual familiarity. A familiar
pattern must be changed when it would weaken one of those obligations.

## Familiarity matrix

Allowed matrix states are `NOT_YET_APPLICABLE`, `NOT_STARTED`, `IN_PROGRESS`,
`EVIDENCE_READY`, `OWNER_APPROVED`, and `REJECTED`. M00-W11 establishes only
the governance rows. Every row therefore remains `NOT_YET_APPLICABLE` with no
reference observations, screenshots, hashes, results, or approvals.

| Surface ID | Surface | Owning work package(s) | Matrix state | Reference provenance | Observation record | Comparison evidence | Owner decision |
|---|---|---|---|---|---|---|---|
| `DESKTOP_SHELL` | Desktop shell and global navigation | `M03-W01`, `M03-W11` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `HOME_DASHBOARD` | Home/dashboard | `M03-W11`, `M33-W07` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `JOBS` | Job search, matches, and saved jobs | `M33-W07` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `TRACKER` | Application tracker | `M25-W08` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `DOCUMENTS_RESUMES` | Documents and resumes | `M09-W07`, `M12-W07` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `PROFILE` | Profile and onboarding | `M08-W07` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `SETTINGS` | Settings and provider selection | `M05-W17`, `M27-W13`, `M27-W14` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `EXTENSION_DEFAULT` | Extension default panel | `M17-W01`, `M17-W11` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `EXTENSION_AUTOFILL` | Extension autofill flow | `M17-W11` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |
| `EXTENSION_REVIEW_UNRESOLVED` | Extension review and unresolved-field flow | `M17-W05`, `M17-W11`, `M34-W07` | `NOT_YET_APPLICABLE` | — | — | — | `NOT_APPROVED` |

## Evidence and approval contract

Each future observation must identify its public URL or owner-supplied artifact,
capture date, observer, covered surface, permitted-use basis, and concise
task-level finding. Each comparison must link repository-controlled fixtures and
the corresponding row in
`docs/ui/OWNER_APPROVED_VISUAL_BASELINE.md`. Owner approval is surface-specific,
revision-specific, and never inferred from a general design preference.

The familiarity study must measure mapped-task success, comparative task time,
accessibility, non-confusion, and originality. Aesthetic similarity alone is
not acceptance evidence. Third-party names and marks may appear only in factual
provenance; the product must not imply affiliation, endorsement, or source
compatibility that does not exist.

## Originality and non-affiliation rules

- Use repository-owned implementation, components, tokens, copy, icons, and
  assets, with a documented license for any external dependency.
- Preserve task-level familiarity without reproducing distinctive expression,
  trade dress, branded illustrations, wording, or pixel-identical composition.
- Present the product as independent. Do not suggest affiliation with,
  endorsement by, or migration certification from Simplify or any other
  referenced service.
- Record exceptions and owner decisions in the baseline ledger; absence of an
  objection is not approval.

## Current migration state

- Governance owner: `M00-W11`
- Matrix state: `NOT_YET_APPLICABLE`
- Reference observations: none
- Screenshots or fixtures: none
- Familiarity study results: none
- Owner-approved surfaces: none
