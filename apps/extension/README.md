# apps/extension

Browser extension (WXT + TypeScript, Manifest V3,
docs/MASTER_IMPLEMENTATION_SPEC.md §5.2). The production extension detects
supported ATS pages, scans and fills forms via typed operations, shows field
status and provenance, and reports submission evidence (§5.3). It can never
access the database or model runtime directly (§5.4).

M02-W07 turned the empty M00-W02 workspace slot into the real minimal MV3
feasibility substrate (spec §5.11.7, REQ-FORM-020). M02-W08 preserves that
verified substrate and adds only the bounded semantic scanner owned by this
work package:

- one background service-worker entrypoint (`entrypoints/background.ts`)
  that preserves the closed feasibility probe, registers permitted frames,
  routes typed scan/re-resolution requests, and aggregates frame-local reports
  without removing their frame identities;
- one all-frame content agent (`entrypoints/feasibility.content.ts`) bounded to
  the deterministic loopback mock origins `http://127.0.0.1:4761/*` and
  `http://127.0.0.1:4762/*`; every injection scans only its own `document`;
- the closed W07 probe protocol (`src/feasibility-protocol.ts`) plus a closed
  W08 scanner protocol (`src/scanner-protocol.ts`);
- canonical generated M01 `FormFieldAddressV1` / `FormFieldDescriptorV1`
  values produced by `src/field-scanner.ts`, with deterministic semantic IDs
  and SHA-256 evidence digests from `src/semantic-identity.ts`;
- fail-closed unit and generated-manifest tests (`test/m02-w07/`);
- canonical-contract and protocol tests (`test/m02-w08/`);
- real-browser proof through bundled Playwright Chromium with a persistent
  context and the actual MV3 service worker (`e2e/extension/` at the
  repository root; the root `playwright test` command builds this package
  first via its global setup).

The W08 scanner finds one deterministic application root from an explicit
application region, unique form ownership, or a supported `main` fallback. It
returns typed ambiguous/not-found outcomes instead of guessing. It supports a
single bounded application-root scan or an explicitly tokened subtree scan,
with finite control/option limits. Descriptors retain normalized label,
ARIA/description, section/group, control-role, option, visibility, enabled,
required, route/root, and frame/document evidence. Addresses require at least
two semantic/structural authority signals; raw selectors and DOM indexes are
not part of the canonical contract. Re-resolution scans the current frame and
returns resolved only for one semantic match, unresolved for zero, and
ambiguous for multiple matches.

The extension performs no fill or other product action. Its reviewed W07
observable surface remains
the ACK-gated namespaced readiness attribute plus one bounded framework
artifact: WXT 0.20.27 necessarily dispatches the document CustomEvent
`<extension-id>:feasibility:wxt:content-script-started` with exactly
`contentScriptName: "feasibility"` and a random injection ID. WXT provides no
supported option to suppress that event; `noScriptStartedPostMessage: true`
does suppress its separate default `window.postMessage`. The browser suite
observes the exact event/detail for each tested content-script injection,
traces every extension-originated DOM event dispatch in its bounded
pre-navigation-through-settle interval, and requires zero page-world messages.
Source and shipped-byte checks close the broader static emission surface. The
event contains no job, user, form, or private data and grants no authority.

The test suite also builds an isolated invalid-ACK variant under
`test/m02-w07/fixtures/`. That variant re-exports the production content
entrypoint and substitutes only a test worker, proving in real Chromium that
an invalid worker response cannot cause readiness. It is not part of the
canonical build and adds no product command, permission, or manifest surface.

WXT generates the manifest from `wxt.config.ts` plus the entrypoints; build
output lands in the git-ignored `dist/chrome-mv3/` tree (`pnpm build`), and
the invalid-ACK test output lands under `dist/invalid-ack/`; the generated
`.wxt/` state directory is ignored as well.

Everything outside W08 remains future work by design: no product UI, popup,
side panel, options page, native host, database, model runtime, profile access,
W09 concept ontology/answer resolver/sensitivity policy, W10 control drivers
or filling, W11 persistent mutation/reconciliation/performance engine,
ATS-specific behavior, navigation, or submission capability exists here.
M02-W09…W11 add their separately owned feasibility surfaces, and M17/M18
productionize the extension and form engine (including the React UI layer and
native transport).

W14 adds bounded support for reachable **open** shadow roots. Native text
and textarea writes use the same W09 approved fact and W10 transaction;
labels, ARIA references and validation messages stay local to the control's
own tree, while section/visibility/enabled evidence follows the composed
host ancestry. Other shadow controls are inventoried but grant no driver
action authority. Duplicate semantic identities refuse a complete readiness
proof rather than collapsing multiple required controls into one item.

Open-root topology uses a bounded document registry. An initial capture and
explicit overflow recovery enumerate the whole document; mutation records
update added/removed subtrees and local ID indexes incrementally. Fresh
checks of cached possible-host hints discover otherwise silent new roots at
authoritative reads and before native writes, including after focus handlers.
The discovery bounds
are 16,384 elements, 64 open roots and eight nested open-root levels; exceeding
a bound refuses the complete capture. In the existing wire protocol,
`CAPACITY_EXCEEDED` carries `root_candidate_count: 1` as the closed refusal
shape; that value does not claim a measured unique application root when
whole-document discovery exceeds a bound. Newly attached roots on existing hosts
cannot reuse an older identity index. Each discovered root is observed, and
changed root sets refresh the bounded application inventory on demand. Idle
pages do not poll. No closed-shadow or custom shadow-widget support is claimed;
all source and full-settlement performance changes still require regression.

Each observed own-description has an `ATTRIBUTE_DIGEST` / `OBSERVATION_ONLY`
address hint. The W09 approval binds it, and W10 checks it before a new write,
undo or recovery; a later Employer description cannot reuse an older approval.
It does not become durable field identity, so a site clearing a validation
message after input can still settle. W11 refreshes current address digests.
A transaction-bound internal clearing
record is created only when the original description was independently observed
as a rejected message by the accepted `readSiteAcceptance` surface, then the
kernel verifies its clearing, persisted intended value and site acceptance.
That exact settled address can retain the existing verification read-only or
safely restore captured undo state; it cannot authorize replay of the original
fill approval. Other description drift remains unresolved until reviewed.

All driver mutations, including temporary query probes, option traversal,
recovery and undo, cross an engine-bound synchronous approval fence. A stale
identity or ownership change prevents the next physical mutation. If a page
changes identity in response to an authorized query clear, the driver refuses
restoration under the changed identity and reports the fresh resolution
failure; it does not write a captured display into a different semantic field.

Read-only verification can survive changed mounted options only when the full
current address still matches after excluding `option_fingerprint` and
`OPTION_DIGEST`. The own-description hint and every other address signal stay
bound, and the actual current value and site rejection are observed again.
Every initial option approval requires the original W09 option snapshot. A
pure cache retains at most 64 digest-only snapshots within a 256 KiB payload
budget, with at most 128 options each and no DOM references. It is keyed by the
W09-bound full option fingerprint, so ordinary filtering can recover the original
choice meaning. Missing cached evidence can be reconstructed only from an exact
current fingerprint; otherwise a fresh decision is required. A mounted intended
choice retains its exact value digest, label digest and disabled state across
native selects, radios and ARIA widgets. Later unrelated option
additions can preserve verification; changed meaning of the chosen option cannot.
Popup, query and scrolling probes may move an approved ARIA item off the mounted
window. When the intended item was initially absent, its eventual commit requires
an exact self-describing visible label: the raw semantic value, or the approved
field label followed by one space and that value. No extra label text is allowed.
The actual chosen semantic tuple is then retained for read-only reconciliation.

The current semantic index groups complete address signals by an exact key and
retains every duplicate. Addresses omitting optional evidence retain the
original wildcard matching path. Each resolution still rebuilds the matched
current descriptor and proves current global uniqueness.

A private engine marker can reuse the just-checked mutation authority for one
synchronous action. A microtask expires it before any awaited continuation;
text focus always performs a new currentness/state check before the setter.
Direct result publication holds provisional verification until a final live
target/index/ownership and observed-record revision check after all result
hashes, for execution and undo. A synchronous native-property witness also covers
value, checked state, selected index/option and immutable File identities that
MutationObserver cannot observe. The repeater editor supplies its own exact-value
witness. Reconciliation retains these witnesses through its last inventory hash.
A changed observation refuses verification and removes undo authority.

Composed ownership context continues past an inner form application root through
its shadow host and outer semantic groups. One capture is shared by section
context and scoped IDREF ambiguity checks. A cycle, more than 256 ancestors, or
more than 16 unique section tokens refuses positive label authority while still
reporting every required control. A truncated prefix cannot hide a later
Employer or Recruiter context and retain automatic applicant-fill authority.
