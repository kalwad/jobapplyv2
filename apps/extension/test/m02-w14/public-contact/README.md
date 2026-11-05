# W14 public ordinary-contact evaluation draft

This patch adds a separate, explicitly activated **network-closed ordinary-contact development evaluation**, not production browser authority or a final gate pass. It is additive and does not change the default loopback build, existing inspect-only dispatch, or production entrypoints. No actual public fill was executed while preparing this draft.

## Dependencies and review boundary

Apply the already integrated `public-inspection` scope/harness first. Apply `shadow_support`'s reviewed field-scanner/driver guard patch before this patch: the contact decorator imports its exported `targetIsCurrent(document,target)` and composes that fresh synchronous unique-target guard immediately after focus. The outside draft was compiled and its controlled browser proofs run against a **copy** of that outside shadow source; no active source was edited.

The initial patch added files in:

- `apps/extension/test/m02-w14/public-contact/`
- `e2e/extension/public-contact/`

Development-only symlinks, copied kernel sources, build artifacts, local lint/TypeScript configs and test output are excluded from the patch.

## Frozen independent expectation source

The oracle was authored by a separate read-only agent from the saved public inventory and contract/spec text, without reading the resolver, ontology, candidate outcomes or current implementation. Permanent original preimage archive included in the patch:

`docs/evidence/m02-w14-public-contact-oracle/independent-oracle.json.gz`

Its manifest binds compressed and decompressed bytes. The original authoring file was `/tmp/japp-w14-public-draft/oracle-review/public-ordinary-contact-exact-label-oracle.json`; no temporary file is needed after integration.

Original SHA256: `e2383c2aa795f2f876063dc7c7b72d7fd2ea969004db05deca6ba08a86b8ce82`.

The derived `oracle-map.json` preserves literal match records, source pointers and source digests, positive concepts/values, and negative reasons. It removes absolute source paths, not semantic content. Its exact bytes are pinned in the harness: SHA256 `2ba290bf505b8dc009ed2cb7e5d1724f33745ab374b10fe27d3c03a3d68ee91d`.

It declares 73 contact positives (61 required), 699 abstentions and 772 captured controls across all 30 sources. These are offline expectations, not a claim that all live controls remain eligible or all application roots resolve. The live before-fill freeze refuses changed or nonunique positive literal matches and unresolved roots. Unknown newly observed controls default to abstention for scoring. The candidate inventory includes **all** visible, enabled scanner TEXT descriptors, not merely oracle positives. Expected labels/concepts/values are never supplied to W09 as classification evidence.

## Action boundary

Only six fixed synthetic facts can be written, into empty native text/email/tel/url inputs: first name, last name, full name, email, phone and generic website. No arbitrary value exists in the contact wire protocol. All control transactions remain bound to an immutable before-scan digest, source URL, actual top-frame session/frame/document identity, field address and opaque independent oracle digest. The freeze is written with exclusive creation before any W09 policy or W10 request.

The real W09 resolver runs in Node over real scanner descriptors, as in the existing feasibility architecture. Its generated validators load the Node filesystem schema catalog and cannot be bundled unchanged. The extension separately runs the actual pure W09 classifier (including negative evidence), catalog floor and safety policy against the freshly resolved live descriptor. A forged structurally valid FIRST_NAME decision targeting SSN or an employer field is refused. The independent oracle is never dispatch authority.

Actual DriverTransactionEngine and DynamicFrameEngine execute and reconcile the real live nodes. The explicitly identified `W14_PUBLIC_GUARDED_NATIVE_CONTACT_V1` variant uses the reviewed native setter/event envelope with added currentness and protected-boundary checks after focus. It conservatively refuses any synchronous document or reachable open-shadow markup change during focus (with a one-million-character transient limit); the markup snapshot stays transient inside the isolated frame and is never stored. Undo/recovery writes are disabled. A refused post-focus fence does not trigger an automatic blur handler. Native site input/blur/validation effects are observed rather than replaced or cleared. There is no public HTML substitution, clone, artificial rerender, readiness attribute, widget click, upload, login, challenge, consent, navigation or final action dispatcher.

The controller uses a fresh anonymous browser and refuses closure while any initial HTTP request is pending. Before site scripts, it blocks site service workers and all WebSockets, installs immutable main-world RTC/WebTransport constructor denials in new documents/frames, disables QUIC and the WebTransport browser feature, and verifies that WebTransport is unavailable in a controlled worker probe. It sets the context offline **before freezing and preparing** and confirms the capability fence in every current frame. These browser API changes are explicit evaluation-environment interference. All action-phase HTTP is additionally aborted by routing. The content agent also refuses if native navigator.onLine is not false. Only method/resource/origin/path digests are stored for blocked/failed requests; request/response bodies are never read. Site-owned autosave/validation attempts become explicit NETWORK_OR_NAVIGATION_INTERFERENCE and stop further actions. This intentionally limits results to a network-closed DOM subset: natural server acceptance and unaffected public end-to-end accuracy remain unmeasured.

Visible password, credential/one-time-code/username/webauthn autocomplete tokens regardless of their labels, labelled code inputs, any visible native/ARIA dialog or modal, visible challenge surfaces (including compact frames), account/session/access boundaries cause explicit refusal. Discovery and measurement traverse all reachable open roots with element/root/depth limits and fail closed on capacity; IDREF labels resolve in their local tree. Shadow fields themselves are not a public fill support claim. A bounded read-only hydration wait (up to eight seconds) can observe actual expected controls and an actual resolved root before network closure; it does not manufacture either. Existing values are preserved. Sources with unresolved roots remain refused without a broad root guess or DOM replacement.

## Controlled verification

These commands execute only intercepted synthetic pages at allowlisted addresses. They make no employer requests and do not invoke the public runner. Run from the repository after integration.

```sh
pnpm --dir apps/extension build
JAPP_W14_PUBLIC_INSPECTION=1 pnpm --dir apps/extension exec wxt build -b chrome -c test/m02-w14/public-inspection/wxt.config.ts
JAPP_W14_PUBLIC_CONTACT_EVALUATION=1 pnpm --dir apps/extension exec wxt build -b chrome -c test/m02-w14/public-contact/wxt.config.ts
pnpm --dir apps/extension exec vitest run test/m02-w14/public-contact/protocol.test.ts --no-file-parallelism --maxWorkers=1
JAPP_W14_PUBLIC_CONTACT_EVALUATION=1 JAPP_W14_PUBLIC_INSPECTION=1 pnpm exec playwright test -c e2e/extension/public-contact/playwright.config.ts
```

The explicit controlled config uses `.proof.ts`, so normal browser discovery cannot launch public evaluation. Register the **closed build and controlled config** in mandatory verification, not `run-contact.ts`. Historical initial checkpoint: strict TS PASS; strict ESLint PASS; protocol units 2/2; contact WXT build PASS; controlled suite 21/21 PASS (20 actual-MV3 proofs and one immutable oracle/archive proof). The prior safety revision completed 49/49 ordinary controlled proofs in the isolated draft. The current credential revision registers exactly 55 controlled proofs, retaining that checkpoint and adding six explicit initial/focus/open-shadow username/webauthn cases alongside tokenized credential, generic modal, focus-time open-shadow markup, hidden-boundary preservation, beacon/navigation/popup blocking, pending-HTTP refusal, RTC/WebTransport aliases and worker probe, and lifecycle/evidence-port failures. A fresh integrated 55-proof run is required after composing the latest shared driver guards; the earlier 21- and 49-proof results do not bind the revised source. The proofs cover successful real policy/transaction/reconciliation, negative other-party semantics, one-freeze concurrency, duplicate requests, arbitrary/direct action messages, online/profile/scan refusal, four active light-DOM boundary variants, four focus-time mutations without setter or recovery events, initial-value preservation, static site rejection, blocked autosave, forged SSN/employer contact authority, default/inspect-only isolation, four open-shadow protected boundaries, and open-tree capacity refusal.

## Public runner: separate review and explicit activation

Do not add this command to CI or verification. No actual public write was run for this draft. After source review, integration and controlled verification, it requires **both** opt-ins and a fresh explicit absolute output directory:

```sh
JAPP_W14_PUBLIC_CONTACT_EVALUATION=1 JAPP_W14_PUBLIC_CONTACT_RUN=1 JAPP_W14_PUBLIC_CONTACT_ARTIFACT_DIRECTORY=/absolute/fresh/output pnpm exec node e2e/extension/public-contact/run-contact.ts
```

Artifacts: campaign source/build/oracle binding, immutable per-page before-fill JSON, a bounded action-results JSONL journal, one compressed raw result bundle, concise assessment. Source/build/oracle/Git start/end drift records FAILED immutability, saves all raw rows and assessment first, and then exits with an error. Rows retain refusals, measurement ambiguities, initial/final value digests, actual decisions/results/reconciliation, request metadata and observational event counters. Action intent is journaled before dispatch; a missing result remains explicitly unobserved. Launch, observation, cleanup and row-journal failures stop further actions, preserve known measurements/counters in an incomplete error row, and attempt every final artifact even if end-binding or an earlier writer fails. A failed storage device cannot guarantee persistence; the finalization record reports failed artifact attempts. Document-capture counters are explicitly incomplete for non-composed open-root events; unknown values remain null and known partial totals remain named as document observations. Coverage is explicit; incomplete observations do not appear as safety zeros. Metrics distinguish the no-interference network-closed subset from all observed rows. All value metrics are explicitly named `dom_value_*`: they measure retained physical values, not verified driver or site-accepted attempts. Full value precision is null when any identity is unmeasurable, with a separately named uniquely measured subset. Natural remote acceptance and legacy comparison stay unavailable. A timed 75ms transaction settle, real reconciliation and later 250ms observation do not assert general framework rerender coverage.

Remaining local steps: parent review; compose latest shadow guard patch; register only controlled proof/build; integrated checks; then any separately reviewed public network-closed pass. Root resolution, protected-boundary, oracle drift and network interference outcomes must remain real refusals. Broader real-site interaction or natural server-validation evidence requires a different, explicitly reviewed authority/measurement contract; this patch does not manufacture that evidence.
