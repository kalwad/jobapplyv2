# Focused independent runtime review and isolated undo reproduction at 918dedb

## Exact reviewed correction: unchanged eight-case GREEN

Root authorized only the peer-reviewed two-file patch SHA-256 `3adbcf83e27327c1fe2293cc197c80ce22286cca50a1c7c665a1e1b1f6950177` in the isolated managed review worktree. Both preimages matched; exact corrected afterimages are text-like driver `91756f25933420b515a974021cd7c4cf6c06795656b7eec10763cadbe1a1d923` and engine `9fc5287957ad148aad2cc449244427c9a2d731470dd267088396b534ed340ed4`. The active root remains untouched by this review. HEAD is still 918dedb plus the exact uncommitted two-file delta, not a claimed clean corrected commit.

The patch snapshots the current value inside the synchronous mutation callback, refuses a change caused by focus before the setter, and uses an engine-local typed marker. Only the exact trusted text/date driver references plus that exact marker can prove the first setter was never reached and suppress recovery/undo; generic and partial mutation errors retain the original recovery path. No new await, result schema, protocol, reason code, declaration, or acceptance threshold is introduced. The separate source reviewer recorded 16 CLEAR checks before application.

Affected typed ESLint, Prettier, strict e2e TypeScript and extension typecheck pass. The **same byte-identical eight-case independent probe**, SHA-256 `16209b8cd45a86d4d313b228d6c5af0c10cd5b7830017b6e8b59ce34b61de9c6`, now passes **8/8 in 11.2 seconds**, with no skipped or flaky case. The independent GREEN physical join verifies every negative preserves the exact newer text/date value with zero extension setters and zero input/change events; all return `FAILED` rather than claiming verification. Execute negatives grant no undo and attempt no recovery. All unchanged execute/undo positives retain their expected value, one setter, event pair and `VERIFIED`/`ACCEPTED` result.

All 13 source/runtime/probe/build/head/status/tool/environment bindings match before and after GREEN. Compared with RED, the 355-path runtime inventory changes only the two authorized files; the probe and all other runtime sources are unchanged. Corrected runtime inventory digest is `sha256:8c61ebee8af7823f2812c514fb2bbb5eb0ca44c95b919a5ac3919eb9b5fec9cc`; complete built extension inventory is `87038fa5474c56034fe7a0d8f563b6d410f4ac0e3e868551615baf8fbac7e819`. Source-bound raw GREEN and physical join: `/tmp/japp-w14-value-focus-green8-20261016`.

These results validate the exact local focus-value correction. Full corrected root regression, renewed comparison binding, native platform validation and formal gate evidence remain separate required scopes. The original asynchronous second-resolution hypothesis is not claimed as reproduced or fixed.

The subsequent unchanged existing adjacent run passes **23/23 in 54.7 seconds**, with zero skips/flakes: 13 original driver cases, four independent-extra cases and six native-validity cases. Actual `TX7` partial widget mutation and rollback passes, alongside native text/choice/date/checkbox undo, React/Vue persistence, stale/policy refusals, ARIA widgets, the bounded virtual list, repeaters/uploads, navigation identification, eventless final-hash value drift, opaque radio relabelling and native custom-validity publication. All 13 before/after bindings match again; no source/probe edit occurred between GREEN8 and this adjacent run. Raw proof and machine case join are under `/tmp/japp-w14-value-focus-adjacent-20261016`. These **31 focused actual-MV3 passes** are not the repository's full aggregate regression or a gate decision.

## Definitive observed baseline: eight clean execute/undo focus cases

The final baseline probe version adds affected shared-function coverage for execute and removes the two unreachable repeated-digest-pause cases. Exact probe SHA-256: `16209b8cd45a86d4d313b228d6c5af0c10cd5b7830017b6e8b59ce34b61de9c6`. The prior executed versions are preserved unchanged. Strict TypeScript checking and ESLint pass. Official discovery finds eight cases. The sealed actual-MV3 run at exact 918dedb exits 1 in **13.9 seconds: four unchanged controls PASS; all four focus-value preservation negatives FAIL; zero skips or instrumentation failures**.

Both text and date execute overwrite the newer page-owned focus value with the intended value, publish `VERIFIED`/`ACCEPTED`, and grant undo. Both text and date undo overwrite the newer focus value with the retained prior value and publish `VERIFIED`/`ACCEPTED`. In every negative, the page-world assignment has zero MutationObserver records, and exactly one additional setter is independently observed in the extension isolated realm. Unchanged controls perform the expected one setter and verify successfully. Bundled Chromium version is `151.0.7922.34`.

The source defect is the missing native current-value preservation check **after focus and immediately before the setter** in shared `writeText` (`text-like-drivers.ts:85–95`). The existing guard checks identity, visibility and enabled state after focus, but a page focus handler can change only `.value` and survive it. The final execute/undo publication fences capture the already-overwritten value, so they cannot detect the lost update.

All 13 frozen before/after bindings again match, including every tracked source hash, runtime355 inventory digest `sha256:c3757409d0e43b12e517eae863e4985d8a509273dd45b86f59a5bfb8478cc89c`, complete extension build inventory `be3d8669a529e697c566dcdd9d38774012d1cf27fd7b540e78f1dd760066737b`, exact probe, HEAD/status, tools and selected environment. The complete eight physical records, result JSON, traces, screenshots, raw output and binding recomputation are under `/tmp/japp-w14-value-focus-red8-20261016`. The prepared source is still test-only; no production patch or GREEN claim exists at this checkpoint.

Affected recovery warning for any correction: execute sets `actionPerformed = true` before entering the driver and, on a thrown driver guard, attempts automatic restoration from the old payload. A guard that refuses before the setter must not cause that recovery to overwrite the newer focus value. The eight-case expectations deliberately require zero extension setter/input/change events and no undo capability for refused execute focus drift. This warning is source-supported; the baseline itself takes the original successful setter path rather than the future guard/recovery path.

This local finding is HIGH and actionable. It grants no W14/W15/Gate A approval. The original source-only asynchronous re-resolution hypothesis below remains unconfirmed; no unavailable digest hook is presented as observed product evidence.

## Updated observed result, 2026-10-16 22:15 UTC

**HIGH, confirmed on actual MV3: synchronous focus-time value changes are overwritten by undo, which then reports VERIFIED.** Primary correction boundary: `apps/extension/src/drivers/text-like-drivers.ts:85–95`, used by both text and date undo; the engine's earlier equality check is `apps/extension/src/driver-engine.ts:1359–1388`.

Following the original read-only report below, root authorized a bounded reproduction in a separate managed worktree at exact `918dedb3fc379e1fc19cf6ef54bbefa1110b35d3`: `/Users/tanishkalwad/.codex/worktrees/w14-undo-value-review/jobapplyv2`. Only an untracked independent test was added there; no production file, active-root file, declaration, baseline, or guard changed.

The corrected six-case probe is SHA-256 `6466e42f8ac8e2f365c8162a6755ae0e4e38259071e304292c8aa0ff620d92cb`. TypeScript checking passes before execution. Its frozen run exits 1. Exact results: **two unchanged successful undo controls PASS; two focus-handler safety negatives FAIL with direct physical evidence; two repeated-digest pause probes fail instrumentation before mutation and are not counted as product failures.**

| Actual control | Before undo | Page-owned focus handler | DOM mutation records | Extension native mutations | Final value | Undo result |
| --- | --- | --- | --- | --- | --- | --- |
| Text unchanged control | Synthetic | None | Not applicable | 1 → 2 | Prior | VERIFIED (expected) |
| Text focus drift | Synthetic | Newer user edit | 0 | 1 → 2 | Prior | VERIFIED (**incorrect**) |
| Date unchanged control | 2021-02-03 | None | Not applicable | 1 → 2 | 2020-01-01 | VERIFIED (expected) |
| Date focus drift | 2021-02-03 | 2022-03-04 | 0 | 1 → 2 | 2020-01-01 | VERIFIED (**incorrect**) |

The initial native mutation in each row belongs to the earlier successful execute transaction. The second is the undo setter in the actual extension isolated realm. The newer value assignment runs in a page-world synchronous focus listener; its before/after values and a surrounding MutationObserver's zero records are captured independently. Every completed case has two input and two change events total (one pair for execute and one for undo). The eventless newer edit contributes no input/change event and is not misattributed to extension native mutation counts.

This is a complete lost-update trigger without needing a genuine asynchronous scheduling interval: `writeText` calls `host.focus()`, the page changes only the native value, the identity/actionability-only post-focus guard passes, and the setter overwrites it with the old undo payload. The publication witness is captured after that overwrite, so it verifies the wrong restoration honestly and misses the lost update. Require a synchronous expected-current-value preservation check after focus and immediately before undo's native setter, while retaining every existing authority/publication fence.

The repeated-descriptor digest pause is **not validated**: `semantic-identity.ts` memoizes exact-input digest promises, so the chosen second native WebCrypto-call hook never fires in this warm simple fixture. Both tests reach the five-second instrumentation timeout without introducing the newer edit. This refines the earlier source-only asynchronous hypothesis below; do not cite these two failures as product RED or claim an observed second-resolution interleaving.

All 13 captured before/after bindings are identical: all tracked source files and their inventory digest, the 355-file runtime inventory, probe, all extension build bytes and inventory digest, HEAD, Git status, Node version/binary, pnpm version, invocation and selected environment. Runtime digest is `sha256:c3757409d0e43b12e517eae863e4985d8a509273dd45b86f59a5bfb8478cc89c`; built extension inventory SHA-256 is `be3d8669a529e697c566dcdd9d38774012d1cf27fd7b540e78f1dd760066737b`. Raw evidence is under `/tmp/japp-w14-undo-value-red2-20261016`.

A preceding run omitted `await` on the asynchronous test helper `buildTransaction`; all six cases consequently failed during setup before any undo transaction. That is a reviewer test mistake, now corrected by only the missing `await`. Original probe SHA-256 `057f37dbc9d2e77aff7b18c4febe8d6c75e705ba69047248369921119f7b9c20`, before/after bindings (all equal), logs, JSON and traces remain in `/tmp/japp-w14-undo-value-red-20261016`. It supplies no product failure claim. The original source-only review is separately preserved beside the corrected run.

Separate **unconfirmed source concern** requested by root: execute captures undo at `driver-engine.ts:756`, then awaits action re-resolution at 768 and fresh preconditions around 817. There is no comparison of the captured prior value against the value immediately before the eventual write. If that value changes during an actual interleaving or a synchronous focus handler, execute can retain an earlier undo payload. An eventual undo can restore an older value than the one this action actually overwrote. No additional execute case was added or executed; keep this separate from the confirmed undo focus trigger.

The bounded local contexts and profiles are closed through the normal fixture/finally path; OS descendant-process coverage is not claimed. No external site, account, login, submission, consent, security setting, or extension-management page was accessed.

No fix or green validation has yet been authored for the confirmed defect. This result supplies no W14/W15/Gate A approval. The earlier independent KI-0091 correction remains a separate proven scope, and the external public/Simplify/owner evidence gaps remain unchanged.

## Original source-only review (retained historical hypothesis)

Reviewed 2026-10-16 22:08 UTC at exact HEAD `918dedb3fc379e1fc19cf6ef54bbefa1110b35d3`. The active checkout was clean before and after inspection. This is a source-only, read-only review. No tests, builds, browser sessions, declarations, or root files were changed or executed. It supplements the running platform CI; it is not a Gate A/W15 approval or an externally executed comparison.

## Finding: HIGH — undo can overwrite a newer value introduced during its final awaited re-resolution

Primary location: `apps/extension/src/driver-engine.ts:1421` (the check at `1359–1388` expires before the awaited re-resolution; the mutation follows at `1509`).

The engine observes the current value and compares it to `record.intendedObservation` once at lines 1359–1388. It then awaits `resolveFieldTarget` again at line 1421. That resolution builds a descriptor through multiple awaited WebCrypto digests (`field-scanner.ts:934–1028`), so a page task or user input can change the native value while it is pending. Descriptor identity does not include the current value: `attributeEvidence` at `field-scanner.ts:901–916` uses control kind, tag, role, type, name, autocomplete, placeholder, multiline and multiple only.

After the await, the action checks at lines 1453–1467 require unique driver, unchanged approved description, current semantic target, visibility and enabled state. They do not compare the current value to the value whose equality authorized undo. `driverContext.mutate` at lines 236–299 also checks ownership/option/generation/index/actionability, with no current-value predicate. For a text input, `textDriver.applyUndo` calls `writeText(host, payload, context)` (`text-like-drivers.ts:135–139`), and its final synchronous check after focus (`78–96`) likewise checks index/actionability only before setting the old payload.

Concrete trigger inferred from that complete source path:

1. Execute a text transaction with initial value `Prior`, intended value `Synthetic`, and retain undo.
2. Start undo. Allow its first current observation to see `Synthetic` and pass the equality condition.
3. During the second descriptor resolution's awaited digest, change the same live input's value to `Newer user/site edit` without changing ownership, attributes, option meaning, or topology. A native `.value` assignment can do this without a MutationObserver record; a normal user edit likewise need not change the value attribute.
4. Complete the descriptor resolution. Its address/current-target checks pass because current value is not address identity.
5. `applyUndo` writes `Prior`, losing the newer value. If the resulting field is accepted, the later post-write observations can publish `VERIFIED`.

The final native-property/publication witness at lines 1586–1590 is captured only after `applyUndo` has overwritten the newer value. It correctly protects the restored observation against *later* drift, but cannot reject the preceding lost-update race. The current `extension-w14-independent-extra.spec.ts` eventless undo probe pauses the final result hash after restoration, and the six native-validity probes likewise target final publication. They do not cover the pre-restoration race.

Requested correction: carry a synchronous primitive current-value/driver observation witness from the observation whose match authorizes undo into the first restoration mutation, and refuse that mutation if the value has drifted. Any awaited observation/re-resolution and synchronous focus handler must not expire the last value-preservation check. Keep existing identity/description/options/actionability/final-publication fences. Do not merely re-observe asynchronously and leave another gap before the native write. Repeater/native-editor witnesses need the same semantics where undo can overwrite a newer edit.

Suggested deterministic actual-MV3 regression, not executed in this review: instrument the second undo descriptor's digest after the first value observation has completed; edit the native value without events, release the digest, and assert the newer value is preserved with zero additional extension-native mutation and no `VERIFIED` undo. Pair this negative with an unchanged successful undo. A second variant can introduce drift in a synchronous focus handler to cover the final setter boundary.

Status: source-substantiated actionable finding, **not yet an executed reproduction or a native-platform result**. Root should reproduce and independently review a correction before closing it.

## Other inspected boundaries

No further substantiated finding is asserted here. The KI-0091 correction snapshots scalar `willValidate`, `validity.valid`, and `validationMessage`, includes the driver's native acceptance elements, and compares them synchronously after the result hashing. Existing value/checked/file/select properties and extra driver observation witnesses remain present. Execute and undo enforce the final DOM evidence revision. W11 freshly observes retained verified transactions, retains the native property witnesses through inventory hashing, and rejects changed evidence/topology before readiness publication. These observations establish only this limited source-review scope; they do not prove all runtime races absent or approve any package/gate.

## Inspected source bindings

| File | SHA-256 |
| --- | --- |
| apps/extension/src/driver-engine.ts | 749b00ac70478f94d8e78779e39f973475ba8d6ee003cb9a68ad1e3b623f2382 |
| apps/extension/src/drivers/driver-dom.ts | 8256c4ec3893d3f3e9671715c3f5f5b736f59f6600cdbaeb9d520d2068d695bc |
| apps/extension/src/drivers/text-like-drivers.ts | d39682b692f372d91279a130b73b614afdde6bb1ef0da62f06fb6a7e63e5c316 |
| apps/extension/src/dynamic-engine.ts | 92bd0ea7ece96eee82c879e274cf2c7a2e8b5f048d0a0f603c169c1ed283d125 |
| apps/extension/src/field-scanner.ts | 15d1dd3bc927de976539440511341fd6877e7c113fbbc093e54de21b9b6b6a5a |
| e2e/extension/extension-w14-native-validity.spec.ts | b0c3bcb6b93eee78ad1a45f001f1b33cead19e2c703093b515f9f34f037fed33 |
