# Known Issues

Reproducible defects and deferred risks (`docs/MASTER_IMPLEMENTATION_SPEC.md`
§1.1). This file is also where out-of-scope ideas are parked instead of
broadening a work package (spec §1.5).

## Update rules

- IDs: `KI-####`, never reused.
- Severity: `CRITICAL | HIGH | MEDIUM | LOW`.
- State: `OPEN | IN_PROGRESS | FIXED | DEFERRED | WONT_FIX` (`WONT_FIX`
  requires an owner decision recorded in `docs/DECISIONS.md`).
- Every defect entry must include reproduction steps and the affected work
  package and/or requirement ID.
- A defect is closed only with verification evidence recorded in
  `docs/TEST_EVIDENCE.md`; one passing manual example is not sufficient.
- No `CRITICAL` or `HIGH` issue may remain `OPEN` in a milestone marked
  complete (spec §10.1).
- Mandatory tests may not be labeled flaky to avoid fixing them (spec §8.6).

## Entry template

```markdown
### KI-#### — <title>
- Severity: CRITICAL | HIGH | MEDIUM | LOW
- State: OPEN | IN_PROGRESS | FIXED | DEFERRED | WONT_FIX
- Discovered: <date> during <Mxx-Wyy>
- Affects: <work package(s) / requirement ID(s) / component(s)>
- Description:
- Reproduction:
- Workaround:
- Resolution + evidence link:
```

## Open defects

None recorded.

## Deferred risks and parked ideas

None recorded.
