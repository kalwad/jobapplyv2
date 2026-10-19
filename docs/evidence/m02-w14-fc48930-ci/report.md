# Exact fc48930 native CI evidence

[Run 38979349323](https://github.com/kalwad/jobapplyv2/actions/runs/38979349323), attempt 1, completed SUCCESS on all three native development hosts. Every platform's doctor, canonical aggregate, and tracked-clean step passed; every aggregate reports all 19 active suites PASS.

The head is `fc48930fd880795f72972fd97e2e69d68e636855`. All three checkout logs identify tested PR merge `34477f17c8b97e2caf04fb4d716d352d7e7a8a32`; Git Data API objects bind its parents to main `4745149f4b5da7190b5b0c68753f8ec07bed572d` and that head. Head and merge share tree `cb787f46afec1281c87074a82fd31e23b37c865a`. The retained root tree's Git object SHA-1 was independently reconstructed and verified. This evidence covers that tree only.

| Native host | Job | Final Python result | Job completed UTC |
| --- | --- | --- | --- |
| Ubuntu 24.04 | 117236280907 | 1454 PASS, 316.09s | 23:24:33 |
| macOS 15 | 117236280670 | 1454 PASS, 539.73s | 23:39:16 |
| Windows 2025 | 117236281022 | 1452 PASS, 673.22s | 23:38:12 |

Each complete final pytest summary covers the exact collected status cohort of 201 unique nodes and contact guard cohort of 11 unique nodes. Native Windows therefore confirms the five previously failing Unicode waiver fixtures and the previously stackless `test_w14_contact_child_environment_is_narrow_and_parent_flags_do_not_mutate` case pass on this source. No causal explanation is asserted for that earlier stackless failure.

The direct-compiler infrastructure group passed all eight tests twice on Windows (1335ms and 1357ms), and the full contract suite passed all 2524 tests. These use the retained exact compiler fixture source blob `f1955c6fabbfaac7828e05bbc3b752c0efc463f1`; its positive direct-compiler control precedes unchanged negative rejection. The same groups passed on Ubuntu and macOS.

Each platform reports 242 ordinary browser tests, two public proof cases, and 62 controlled-contact cases passing. The separate public pure proof suite also remains included in the successful aggregate. These counts retain the suite's own browser/accounting definitions; 62 is not asserted to mean 62 browser interactions.

The native128 CI timing uses one sample and zero settle budget per platform. Ubuntu measured 1047.209044ms, Windows 1040.765200ms, and macOS 1814.681917ms. The exact benchmark source applies its 1500ms target assertion only when `sampleCount === 20` on darwin. The default CI results, including macOS's observation above 1500ms, do not establish a passing 20-sample target campaign and do not cover the later local optimization.

`final-run.raw.json`, `final-jobs.raw.json`, each platform's complete raw job log and final job API, PR snapshot, Git Data API objects, exact GitHub source responses and verified decoded snapshots are retained. The final artifact listing contains zero artifacts. `*-complete-proof.json` binds counts and native outcomes to log hashes and line references; `derive-ci-proof.py` performs only evidence transformations and assertions, without executing project tests.

The monitor performed read-only remote CI/API operations and wrote only under `/tmp`. It did not rerun or cancel CI, push, fetch into the root repository, execute local project tests/builds/browsers, or alter root files. Large evidence I/O paused during both parent timing windows. A supplemental source-path lookup returned HTTP 404 before the existing contract fixture path was used; both responses and stderr are retained and identified in `retrieval-notes.md`.
