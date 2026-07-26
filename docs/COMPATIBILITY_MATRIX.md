# Compatibility Matrix

ATS/browser/OS support and measured pass rates
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1).

## Update rules

- Only measured, evidence-linked results may appear here. No claimed support
  without fixtures, a recorded test run, and a `docs/TEST_EVIDENCE.md` entry.
- Untested or unsupported variants must be listed and labeled as such rather
  than omitted (spec v1.2: M19-W01/M20 Workday certification, M23-W05
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

Nothing measured yet (feasibility extension: M02-W07 in pinned Playwright
Chromium; production extension foundation: M17).

| Browser | Version range | Extension status | Last verified revision | Evidence |
|---|---|---|---|---|
| — | — | — | — | — |

## Operating systems (desktop app)

Nothing measured yet. Primary development/verification target per spec:
macOS on Apple silicon (M5, 24 GB unified memory).

| OS | Version | Desktop app status | Last verified revision | Evidence |
|---|---|---|---|---|
| — | — | — | — | — |

## Model runtime

Nothing measured yet (model lock and acceptance benchmark: M05).

| Runtime | Model tag | Digest | Benchmark result | Last verified revision | Evidence |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
