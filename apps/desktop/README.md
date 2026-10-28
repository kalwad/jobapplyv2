# Desktop app

Tauri2 and React shell with original shared UI primitives from `@japp/ui`. Run `pnpm --filter @japp/desktop tauri dev --no-watch` for the native development app, or `pnpm --filter @japp/desktop dev` for its browser frontend. Browser mode safely reports unavailable native version IPC. The native window exposes app/runtime version reads and finite local-service diagnostic/cancellation commands, and rejects external navigation/new windows.

`build` creates frontend assets only. Native development packaging and local-service lifecycle validation are tracked in `docs/TEST_EVIDENCE.md` and `docs/COMPATIBILITY_MATRIX.md`. Browser previews cannot exercise the native owned service; they show unavailable diagnostics unless a test-only synthetic request is explicitly injected.

The isolated `test/renderer` build injects synthetic metadata/error states into shipping components for browser checks. It is served by `e2e-server` on strict127.0.0.1:4762 and is absent from the packaged frontend. Development frontend uses strict127.0.0.1:1420 with HMR disabled. Production CSP is restrictive; only development CSS permits inline styling required by Vite. Public task-reference provenance is in `docs/ui/SIMPLIFY_FAMILIARITY_MATRIX.md`; no competitor code/assets are included.

## Test-only state catalog

The renderer harness exposes `http://127.0.0.1:4762/catalog.html` after the
existing `pnpm --filter @japp/desktop e2e-server` command. It links to all seven
shipping shell destinations and the actual shared loading, error/retry,
unavailable, and render-boundary components. Synthetic version reads are clearly
identified. Job, tracker, document, profile, settings and AI capabilities remain
unavailable in this build; native service diagnostics remain unavailable in these
browser fixtures.

The catalog is a separate input in `vite.renderer.config.ts`; the shipping
`vite.desktop.config.ts` and all production components/tokens stay unchanged.
The catalog-only render fault clears its injected failure when the actual
`Reload view` button is activated, then the shared boundary remounts healthy
content and restores focus. The original `render-error` scenario still requires
its existing explicit test control and retains its prior test behavior.

`e2e/visual/desktop-catalog.spec.ts` defines fourteen future captures: seven shell
surfaces at 1120×760 and 320×760, light theme, fresh 100% context. Each actual
capture writes its PNG hash, observed browser/viewport parameters, source-file
inventory, and Git revision/working-tree state after screenshot execution. This
is evidence collection, not visual approval or native application certification.
No capture, frozen token baseline, anti-bloat result, or approval is implied by
the catalog definition alone.
