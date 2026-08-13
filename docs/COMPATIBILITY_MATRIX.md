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
  and grants no support claim; every table below remains empty.

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
