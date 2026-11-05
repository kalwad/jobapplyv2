# d99 CI result and Windows fixture finding

Run 38962597205, attempt 1, PR #1, head d99c5921338984d6727a0a81bc38d7c628b41199: **FAILURE**.

All three runners checked out GitHub's PR merge commit cb58e4a85d51fe47cf4c77dd232cb867af9f652c. GitHub Git metadata proves its tree 616f54ca25ac97db7de6ac6eea204a140610364c equals the d99 head tree exactly. This is exact source-tree evidence, not a claim that the literal d99 commit was checked out. No result is attributed to later local 0dd88ce or a later candidate.

| Platform / job | Result | Aggregate | Tracked-clean step | Python |
|---|---|---|---|---|
| Ubuntu 24.04 / 117181431849 | SUCCESS | 19 ACTIVE suites PASS, exit 0 | SUCCESS | 1454 passed, 455.35 s |
| macOS 15 / 117181432554 | SUCCESS | 19 ACTIVE suites PASS, exit 0 | SUCCESS | 1454 passed, 558.62 s |
| Windows 2025 / 117181432489 | FAILURE | 18 ACTIVE suites PASS; Python FAIL, exit 1 | SKIPPED | 5 failed, 1447 passed, 1118.28 s |

Visual remains NOT_YET_APPLICABLE on all platforms and is not counted as PASS. All platforms passed 228 default browser cases and 62 controlled contact cases. The Windows artifact-upload step succeeded, but GitHub's run-artifact listing is empty; no browser artifact is claimed. No CI rerun or cancellation was requested.

## Native Windows compiler correction

The exact Windows log records infrastructure.test.ts **8/8 PASS** in 2419 ms at line 1223, followed by complete contracts **2524/2524 PASS** at line 1241. The contract suite separately repeats infrastructure **8/8 PASS** in 2609 ms at line 1433. The source snapshot d99-infrastructure.test.ts is bound to Git blob f1955c6fabbfaac7828e05bbc3b752c0efc463f1 and SHA-256 27f8d2e1578bdcb2b236f0684cd083518252163480b366508ca8cd16053ecc00.

That exact test resolves rustup which rustc from the repository, requires an absolute executable, proves valid compilation with the same executable/output directory, and then requires unchanged invalid-source ADAPTER_EXIT_NONZERO rejection. The negative 30-second and case 45-second bounds and mandatory cleanup remain. This supplies native Windows confirmation of the compiler-test correction at the stated tree; it does not turn the failed aggregate into PASS or prove the former proxy lifetime diagnosis causally.

## Five Windows Python failures

The failures are confined to scripts/tests/test_validate_status.py:

- test_gate_v2_waiver_refuses_unaccepted_adr[PROPOSED], [REJECTED], [SUPERSEDED]: line 2736 text.split(heading, 1) raises ValueError because only one part exists.
- test_gate_v2_waiver_refuses_changed_own_record_preimage: line 2770 expects refusal but receives an empty problem list after the intended replacement did not occur.
- test_gate_v2_waiver_ignores_unrelated_later_adr: line 2786 expects the unchanged accepted-record digest but receives None.

Full stack traces and summary are at Windows log lines 7411–7515. The production validator reads DECISIONS.md explicitly as UTF-8 (line 1907). The new fixtures use ambient Path.read_text/write_text around an em-dash heading. A deterministic cp1252 contrast with the exact d99 helper and document reproduces missing heading, no-op replacement and non-UTF8 inserted em-dash behavior; explicit UTF-8 preserves all intended checks. This is a pure encoding model, not a new native Windows test run.

The outside fixture proposal changes eight text I/O calls in the new waiver cohort to explicit UTF-8 and adds KI-0093 to the three existing corrective-issue fixture lists. It preserves every original assertion, decorator, test identity, production parser and policy. Its source preimage includes the current KI-0092 entries. No proposed result claims these five cases pass on native Windows; native confirmation requires the next source-bound CI run.

Raw logs, exact API snapshots, source snapshots and the fixture proposal/contrast are retained in the accompanying archive and member inventory. All writes occurred under /tmp; no root source, build, test or ignored-output activity was performed by this monitoring task.
