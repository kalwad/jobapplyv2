# Independent retained fc48930 CI evidence audit

No concrete defect or evidence mismatch found in this bounded audit. The retained run establishes successful native three-platform canonical verification at **fc48930**, including the corrected Windows/status fixture and compiler paths. It supports closing KI-0093/KI-0095 for their corrected code/platform verification scope. It does not establish the cause of the earlier stackless contact failure, formal Gate A approval, public scored completion, or Simplify comparison completion.

The audit used read-only archive/API/log/source-snapshot inspection. No archived scripts were executed; no tests, builds, browser work, root writes, staging, or commits were performed. A child reviewer separately checked the Windows collection and correction assertions; the main reviewer independently recomputed archive, member, source, API, and all-platform aggregate checks.

## Archive integrity

`/tmp/japp-w14-fc48930-ci-retained/fc48930-ci-evidence.tar.gz` is **814,341 bytes**, SHA-256 **5f416858c4585067fbf656e350152475fc1bf342ec799aa1fbb03dfcf18f9434**. Its **85 regular members** contain **4,642,709 payload bytes**. Every path is canonical relative POSIX, with no parent traversal, absolute paths, links, special members, or duplicate names.

The external `retention-manifest.json` exhaustively indexes all 85 members, including `members.json`. Every declared size and SHA-256 matches an independent re-read. The embedded index exhaustively covers the other 84 members and excludes only itself. Its 13,823 bytes hash to **1da33ace137c45d3521d57492f2cf217f0e65d2ed50deb9468ea97e498f19858**, matching the external declaration. Index/final-API/source JSON was parsed with duplicate-key rejection. The archive contains evidence files, not a complete checkout or dependency/build/cache trees.

The independent machine checks are [saved here](/tmp/japp-w14-fc48930-ci-independent-archive-checks.json), SHA-256 **8737930bab8c3bef7f64a52659f675c6efa10a9d9d6cb99971a2ab26beb508c2**; `errors` is empty.

## Source and run binding

Final run API: **38979349323**, attempt **1**, completed/success. Final job APIs show completed/success for macOS 15, Ubuntu 24.04, and Windows 2025, all at head **fc48930fd880795f72972fd97e2e69d68e636855**. All three raw checkout logs identify tested PR merge **34477f17c8b97e2caf04fb4d716d352d7e7a8a32**. Retained head/merge Git APIs both identify tree **cb787f46afec1281c87074a82fd31e23b37c865a**; merge parents match PR base and head. Independently reconstructing the Git SHA-1 of the retained raw root-tree object yields that tree identifier.

All six head-pinned API source contents decode byte-for-byte to their retained snapshots, with matching sizes, SHA-256s, and Git blob IDs: status tests, contact proof tests, verify.py, infrastructure contract test, CI workflow, and benchmark. This is retained API/log binding plus selected source blobs, not an independently reconstructed complete Git source tree. An initial unsuccessful infrastructure API retrieval and its stderr remain retained alongside the correct pinned retrieval.

## Raw native results

| Platform | Python collected and passed | Python elapsed | Status IDs | Contact proof IDs | Contracts | Browser | Active suites |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ubuntu | 1,454 | 316.09 s | 201 | 11 | 2,524 | 242 | 19 PASS |
| macOS | 1,454 | 539.73 s | 201 | 11 | 2,524 | 242 | 19 PASS |
| Windows | 1,452 | 673.22 s | 201 | 11 | 2,524 | 242 | 19 PASS |

Each raw log contains the eight-test infrastructure file passing twice, the exhaustive final 19 active-suite PASS rows, and verification exit code 0. The final API step `Assert verification left no tracked changes` succeeds for each job; raw commands show the `git status --porcelain` refusal. Ignored outputs are outside that check. Visual remains explicitly `NOT_YET_APPLICABLE`, not an additional passing suite.

Windows raw lines 7295/7341 identify native win32 and its 1,452-pass summary. Its unique collected IDs are exactly the POSIX cohort minus the FIFO and Unix-socket parametrizations of `test_atomic_adoption_rejects_non_regular_source`; there are no unexplained missing or extra Windows IDs. Retained verify.py explicitly declares this platform distinction. Supplemental read-only inspection of that test at exact fc48930 confirms capability-gated parametrization; that test file is outside the six retained source snapshots.

The status snapshot retains explicit UTF-8 waiver-fixture writes and validation assertions. Contact snapshot lines 159–217 retain exact environment opt-in shapes, `shell=False`, reporter sanitation, and unchanged ambient parent flags. Infrastructure snapshot lines 122–170 retain absolute pinned compiler resolution, a valid-source positive control, the original 30-second invalid-source bound with `ADAPTER_EXIT_NONZERO`, and mandatory cleanup. Fresh native success does not prove the earlier stackless contact F was caused by disk pressure or any specific defect; that cause remains **UNPROVEN**.

## Performance and completion boundary

All three retained CI benchmark rows use **samples=1**, **settle_budget_ms=0**. The macOS value **1814.681916999998 ms** is not a passing target-20 result. Retained benchmark source lines 199–202 enforce the 1,500 ms assertion only for `sampleCount === 20`; default CI uses one sample and emits its observed value. The CI job success is consistent with this scope.

The later 730c641 local full/20-sample p95 **1447.419834 ms**, R9 actor closure, and clean-root claims are separate evidence supplied by the parent; this fc48930 archive does not establish those later revision claims. Public controlled harness suites passing here do not complete public scored cases or Simplify observations. This review does not begin W15 or approve Gate A.
