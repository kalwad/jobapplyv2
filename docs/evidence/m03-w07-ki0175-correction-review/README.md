# KI-0175 correction: separate review and mutation evidence

This packet covers the source correction for KI-0175: the Windows 11 guest stopped waiting for the SYSTEM machine attestation before the attestor wrote it. The changed files are scripts/windows11/windows11_guest.ps1, scripts/windows11/windows11_bootstrap.ps1 (the attestor here-string and its task settings), scripts/tests/test_windows11_guest_driver.py, the WINDOWS11_NATIVE_PINS in scripts/check_portability.py, and the exact Python test inventory.

## Review

Workflow `wf_81255c08-791` reviewed the uncommitted delta with nine agents. Three reviewers each took one lens: Windows PowerShell 5.1 semantics, security and fail-closed behaviour, and test adequacy. Each finding then went to its own adversarial verifier. The agents ran in separate contexts, but the implementing session launched them, so this is not an owner-independent review.

No finding was verified as blocking. The test reviewer rated F1 blocking; its verifier downgraded it because the shipped attestor leaked nothing and the SHA-256 pin gates any edit. All six findings were verified as real and are corrected:

| Finding | Correction |
|---|---|
| BUDGET-01, F3: the wait ran 150 s after the guest's own setup, so "half the deadline" was not true, and one test assertion could never fail | The wait now ends at the 150 s mark of the guest's clock, which starts at the same logon as the attestor task. The test derives the margin from the parsed bound and the parsed 300 s deadline |
| SEC-1, F1: the trace-privacy test matched PowerShell names case-sensitively and missed aliases | The checks are case-insensitive over the code. Every use of the name `step` is counted, and aliases, variable cmdlets, scoped and braced forms, redirection and other file writers are refused |
| F2: the 10-minute task limit could be rewritten after it was set | The test counts `ExecutionTimeLimit` and `$settings` in any case, and refuses Set-ScheduledTask, Enable-ScheduledTask and schtasks |
| SEC-2: each poll read machine-error.json without delete sharing, which can block the attestor removing an earlier run's error | ProtectedReceipt reads through one bounded handle that shares write and delete access. The attestor removes the earlier trace before the earlier error |

`review-workflow-result.json` holds every reviewer summary, finding and verdict. Paths in it point to the reviewers' local scratch folders, which are not retained.

## Mutants

`mutants.py` applies 86 one-change mutants to the final guest and bootstrap and runs the final test file against each, through `variant.py` (a mirror root with the variant sources). The set includes the implementer's own mutants (G, B, F), the earlier reviewers' (R, R2), and this review's case, alias and settings mutants (V, T). `mutants-result.txt` is the run output: 85 of 86 are killed.

The survivor, F12, inserts `Start-Sleep -Seconds 200` before the wait. A sleep before the wait changes no statement the tests pin, so only the file's SHA-256 pin in WINDOWS11_NATIVE_PINS refuses it.

## Hosted checks

Diagnostic rounds 36 and 37 ran the attestor body, the guest's receipt reader and its trace retention under Windows PowerShell 5.1 on hosted Windows Server 2025. Round 37 used the final bytes, which match the repository's. See docs/evidence/m03-native-runtime-diagnostics (windows-attestor-rounds). Neither round is Windows 11 evidence.
