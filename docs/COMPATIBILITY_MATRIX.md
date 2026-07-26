# Compatibility Matrix

ATS/browser/OS support and measured pass rates
(`docs/MASTER_IMPLEMENTATION_SPEC.md` §1.1).

## Update rules

- Only measured, evidence-linked results may appear here. No claimed support
  without fixtures, a recorded test run, and a `docs/TEST_EVIDENCE.md` entry.
- Untested or unsupported variants must be listed and labeled as such rather
  than omitted (spec M21-W05, M27-W06, M30-W04): compatibility is published
  honestly, never inflated.
- A row's "Last verified revision" must be a commit whose recorded evidence
  actually exercised that row.
- Population begins when the producing milestones run: browsers/OS from
  M03/M17 onward, ATS adapters from M19 onward (Greenhouse), then Lever (M20),
  Ashby (M21), Workday (M27), iCIMS/SmartRecruiters (M28),
  Taleo/SuccessFactors (M29).

## ATS adapters

Nothing measured yet — no adapter exists (first adapter: M19, Greenhouse).

| ATS | Adapter version | Tenant/layout variants tested | Field precision | Recall | Sensitive false fills | Receipt detection | Last verified revision | Evidence |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## Browsers (extension)

Nothing measured yet (extension foundation: M17).

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
