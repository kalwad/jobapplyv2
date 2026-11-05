# Independent read-only audit of actual revision 7 observations

Audited repository reference: clean `0dd88ce23771f7da88d7ef103fea35e459b70392` / tree `5502c462d6e61a90fe5b9deb72a31ebe0e9f16b9`. Sources: `/tmp/japp-w14-r7-0dd88ce-20261016` and `/tmp/japp-w14-public-0dd88ce-20261016`. This audit started no browser, build, server, test or actor, changed no root/worktree/raw artifact, and writes only its own files outside root. It is supplemental evidence review, not formal W15, a safety approval or Gate A PASS.

## Findings and exact metrics

The four candidate tests pass normally with no retries, skips, flaky or unexpected results, and exactly match the four discovered identities. Legacy has four OBSERVED rows, complete=true, exit code 0 and no errors. The retained offline worksheet exactly equals a fresh pure offline replay with the original created_at; a separate audit independently joins every raw final native field to the frozen expectation and confirms all 40 field comparisons.

| Metric | Candidate | Legacy |
|---|---:|---:|
| Exact final expected values | 40/40 | 28/40 |
| Values allowing separately declared phone-digit equivalence | 40/40 | 32/40 |
| Input/change event witnesses | 40 | 32 |
| Controlled rerenders | 40 | 32 |
| Native mutation witnesses on installed surfaces | 40 | 36 |
| Other installed native interactions | 144 | 216 |
| Unexpected native mutation witnesses | 0 | **4** |
| Nonordinary final-value/checked changes | 0 | 0 |
| Navigation event witnesses | 0 | 0 |
| Submission event witnesses | 0 | 0 |

Every legacy case has seven exact ordinary matches, one phone-format difference and empty state/country fields. Each also contains a succeeded native `ACTIVATION` witness on the nonordinary text input `country-code`, sequence 53; these four unexpected witnesses MUST remain visible. Initial and final country-code values are blank. A native activation is an attempted call counted by the declared instrumentation even when no final value changes. It is incorrect to summarize all unexpected native mutations as zero. Candidate unexpected native mutations are zero at the same installed-surface scope.

## Historical reporting correction

Revision 6 already contains these same four activations. The committed old worksheet is SHA-256 `a1162c802c512ec741e7c500f68ed6bcfc8e971eef870afdaec6271cc1e424c8`; archived `legacy-r6/paired-options-legacy.json` is SHA-256 `1ac239a7b8c9c94344066b944d4e08b32d0120048eed9db440f29f19259d0e74`, under old lock `47b6fe33c9e68d8aed9815f2cd35887e289a0e93fbf27045a059e467d35fe6fb`. All four full legacy native witness arrays and unexpected-native arrays are identical between revisions 6 and 7: 36 native mutations, 216 interactions, four nonordinary country-code activations. Old candidate unexpected native mutations remain zero. This establishes a historical prose reporting error, not newly revealed behavioral nondeterminism within these observations.

`docs/TEST_EVIDENCE.md:292` and `docs/gates/AUTOFILL_FEASIBILITY_GATE.md:87` currently say both actors have zero unexpected native/nonordinary witnesses. That statement requires an explicit correction: candidate unexpected native 0; legacy unexpected native 4; final nonordinary changes and navigation/submission event witnesses 0. Preserve the old raw archive and worksheet unchanged. The earlier supplemental broad statement that no source/evidence mismatch was found did not inspect this array and is superseded by this finding.

## Source, lock, input and artifact integrity

Both actor artifacts, owned control record and worksheet bind revision 7 lock `sha256:e5b9a8dd4163a6f3c9e61782ef808692ebf65da0997fdfdb486d77e671b50042`. The current production loader verifies all frozen campaign payloads, immutable inputs/oracles/projections, all 31 legacy/vendor source files and the complete 355-file current runtime inventory `sha256:c3757409d0e43b12e517eae863e4985d8a509273dd45b86f59a5bfb8478cc89c`. Source-binding file digest is `sha256:256f21c84fd51b7d0d1287aad57133386935dbdb6d8eb5a0f5e1eacee7f85279`. All four case start/end bindings are exactly equal, including the complete runtime, 55 comparison files, three default-build files and three harness hashes; the same default build appears in all four cases and still matches disk at audit time.

Default-build inventory digest is `sha256:79bbf698e2af0b3f270bbdec2814df450bcc2a8ff04809bf259b23242a9fc991`. It binds background.js `c2743f77c37bbf90c5751a5893077492ca8b08663a5393284ebaef0ed3e801a9`, feasibility.js `1337982656b7bda693e48ac57859bbc14465cfb2a743d5c66d42fe97967bca2d`, manifest `674ac328b7f4554db378f62e5477ab33d778ad5ade142133ee747e36f79862b4`.

All four case/input/oracle identities join uniquely and preserve the same ten frozen facts and approved token metadata. Legacy projections match exactly, with no added defaults; unsupported tokens stay explicitly disclosed. Every worksheet artifact reference/digest/legacy row index matches the actual retained raw artifact. All native witness SHA commitments, sequential numbering, counts, surface sets and actual extension realm agree on both actors. The independent native observer is unchanged (`9000acd4227e906f9f7b0063dab5a39e7aa2187a226bdb82df530e6e2a329a49`), covering its eleven declared surfaces only. Retained references, other realms, uninstalled APIs, closed roots and live employer behavior remain unobserved.

## Lifecycle and cleanup scope

The legacy server handshake and control record share fresh nonce `7e29c868-ad5b-46ed-b243-688ac29bf548` and the exact revision 7 lock. Python is the frozen 3.12.13 runtime with thirteen dependencies, Chromium 151.0.7922.34 and Node 24.18.0. Legacy artifact SHA `715ee5169f0651c28b2fb1782576cfe35950d2273f243e46bd84bb0a8b4ba550` matches its digest sidecar and control record.

Legacy normal context close/profile removal are explicitly verified with empty errors. The browser direct child already exited with code 0; the owned server direct child stopped after SIGTERM; both handles are verified terminated. Chromium descendants remain `UNOBSERVED`. Candidate tests pass without teardown errors and the fixture source awaits page/controller/context close and bounded profile removal, but candidate raw artifacts have no independent OS descendant audit or explicit per-artifact cleanup certificate. Do not broaden either cleanup claim to every descendant process.

## Public campaign

The public run records all thirty rows: 17 REFUSED_NETWORK_CLOSURE, seven REFUSED, six NETWORK_OR_NAVIGATION_INTERFERENCE. Action journal is zero bytes; every row has zero executions; eligible scored source pages are zero; public accuracy and site acceptance are null. Refusal-matrix completion is not public accuracy completion. One preparation can be PREPARED before later interference and still grants no scored action credit.

Public binding/end/finalization agree on clean 0dd88ce/tree 5502c462, the unchanged 940-file source inventory (`7e68c4c57815291d67b37414496a50d433b7fd5dcad900ef60ccf892eada5cc2`), public build (`b094bf77a9634c1ba2f02a1ebcfdf44fb7423e29689ca7a61e81b0fa80670648`) and oracle (`2ba290bf505b8dc009ed2cb7e5d1724f33745ab374b10fe27d3c03a3d68ee91d`). Raw gzip SHA is `6d65587faffed60208cedb1e73c683528e4c44a8a98463755ada830b56aed6ea`, 129217 bytes. All three inventory SHA commitments recompute exactly, rows journal equals raw bundle rows, integrity/campaign errors are null and write failures empty. Observed document event counters remain incomplete: seventeen rows have unknown click/submit/navigation observations, so zero observed known events is not universal public safety proof.

No integrity discrepancy was found in the new raw comparison/public artifacts. The material discrepancy is the earlier governance prose omitting four already-retained legacy native activations. These narrow four related synthetic examples and one shared component establish no broad ATS, two-independent-product, timing, statistical or site-acceptance superiority. Public scored coverage, Simplify and final independent gate decision remain incomplete; no acceptance is granted.
