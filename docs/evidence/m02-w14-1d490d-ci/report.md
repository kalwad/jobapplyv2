# Final exact-head native CI evidence

[Run 38984225730](https://github.com/kalwad/jobapplyv2/actions/runs/38984225730), attempt 1, completed SUCCESS on Ubuntu, macOS, and Windows. Each platform passed its doctor, canonical aggregate, tracked-clean step, and all 19 active suites.

Head `1d490d1230b443c31fd4a9d8732064552affe149` and tested PR merge `d8de57146b6ef183cf6229701e5089c904175ce9` have exact tree `ac98b18d71fffc6cc0ff7fc07ccd32ccda8133d9`. Every raw checkout log confirms that merge. Retained Git Data API objects bind its parents to main `4745149f4b5da7190b5b0c68753f8ec07bed572d` and the final head. The root tree Git object was independently reconstructed and its SHA-1 verified.

| Host | Job | Complete final Python summary | Job completed UTC | Native128 one-sample ms |
| --- | --- | --- | --- | --- |
| ubuntu | 117251833953 | 1454 PASS, 456.26s (0:07:36) | 2026-10-17T00:26:48Z | 1303.386366 |
| macos | 117251833960 | 1454 PASS, 407.38s (0:06:47) | 2026-10-17T00:27:37Z | 1662.458292 |
| windows | 117251833793 | 1452 PASS, 726.21s (0:12:06) | 2026-10-17T00:35:53Z | 1057.393300 |

The complete collected node IDs exactly match the final-head capability inventory: Windows has the common 1452-node cohort with digest `d577b6ab2ad552586dd680176a7ffc4dd75a293bff5c2a5032647339ba068575`; POSIX has 1454 nodes with digest `155570431ee494bad264af6849d3474d9a95ad1091a49e06c56d2b5dfc92db94`. Only the FIFO/socket non-regular-source migration probes are POSIX-only. No missing node or arbitrary reduced Windows denominator is accepted.

Every platform's complete final all-pass pytest summary covers the exact status201 and contact11 cohorts. Native Windows therefore confirms the Unicode owner-waiver fixtures and `test_w14_contact_child_environment_is_narrow_and_parent_flags_do_not_mutate` pass on the final source. The earlier stackless contact failure's underlying cause remains unproven.

Each platform passed all 2524 contract tests and the eight compiler infrastructure tests twice. Windows infrastructure durations were 1417ms and 1487ms; its retained exact source includes the positive direct-compiler control before unchanged invalid-source rejection. All platforms also report 242 ordinary browser tests, two public proof cases, and 62 controlled-contact cases passing. The aggregate retains the separate public pure proof suite. The 62-case controlled suite keeps its browser/accounting definitions and is not labelled 62 browser interactions.

CI uses one native128 sample with zero settle budget. The exact benchmark applies the 1500ms target assertion only for `sampleCount === 20` on darwin. macOS's single observation of 1662.458292ms exceeds that numerical threshold but is not a 20-sample target run. These successful default CI results do not replace the separately retained local 20-sample campaign.

The bundle contains complete final run/jobs/job/PR APIs, all three complete raw job logs, the empty final artifact listing, Git head/merge/base/tree metadata, a verified root tree preimage, and seven exact GitHub source snapshots verified against Git blob SHA-1 and size. `*-complete-proof.json` binds all counts, final summaries, full inventory comparisons, and raw-log hashes. `derive-ci-proof.py` transforms retained evidence only; it does not run project tests.

All monitor operations were read-only CI/API requests. Evidence writes stayed under `/tmp`; no checkout writes, CI triggers/retries/cancellations, pushes, repository fetches, or local project tests/builds/browsers occurred. The root's display watcher exit is distinct from the hosted run, which reached native terminal SUCCESS without being rerun or cancelled.
