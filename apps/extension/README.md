# apps/extension

Browser extension (WXT + TypeScript, Manifest V3,
docs/MASTER_IMPLEMENTATION_SPEC.md §5.2). The production extension detects
supported ATS pages, scans and fills forms via typed operations, shows field
status and provenance, and reports submission evidence (§5.3). It can never
access the database or model runtime directly (§5.4).

M02-W07 turned the empty M00-W02 workspace slot into the real minimal MV3
feasibility substrate (spec §5.11.7, REQ-FORM-020):

- one background service-worker entrypoint (`entrypoints/background.ts`)
  that publishes a fixed runtime identity marker and answers the closed
  feasibility probe;
- one loopback-only content script (`entrypoints/feasibility.content.ts`)
  bounded to the deterministic mock ATS origin `http://127.0.0.1:4761/*`;
- one tiny closed typed probe protocol (`src/feasibility-protocol.ts`);
- fail-closed unit and generated-manifest tests (`test/m02-w07/`);
- real-browser proof through bundled Playwright Chromium with a persistent
  context and the actual MV3 service worker (`e2e/extension/` at the
  repository root; the root `playwright test` command builds this package
  first via its global setup).

The W07 code performs no product action. Its reviewed observable surface is
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

Everything else remains future work by design: no product UI, popup, side
panel, options page, native host, database, model runtime, profile access,
semantic scanner, ontology/resolver, control drivers, MutationObserver
engine, ATS-specific behavior, filling, navigation, or submission capability
exists here. M02-W08…W11 add the feasibility engine surfaces, and M17
productionizes the extension (including the React UI layer and native
transport). Adding those earlier would be a fake feature (spec §1.5).
