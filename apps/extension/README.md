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
