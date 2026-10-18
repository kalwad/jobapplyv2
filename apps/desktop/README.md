# Desktop app

Tauri2 and React shell with original shared UI primitives from `@japp/ui`. Run `pnpm --filter @japp/desktop tauri dev --no-watch` for the native development app, or `pnpm --filter @japp/desktop dev` for its browser frontend. Browser mode safely reports unavailable native version IPC. The native window grants only app/runtime version reads and rejects external navigation/new windows.

`build` creates frontend assets only. `tauri build` is reserved for the native packaging packages; the W01 bundle is not yet certified for any platform. Local service lifecycle/authenticated health are implemented by subsequent M03 packages, so the current shell shows those capabilities as unavailable.

The isolated `test/renderer` build injects synthetic metadata/error states into shipping components for browser checks. It is served by `e2e-server` on strict127.0.0.1:4762 and is absent from the packaged frontend. Development frontend uses strict127.0.0.1:1420 with HMR disabled. Production CSP is restrictive; only development CSS permits inline styling required by Vite. Public task-reference provenance is in `docs/ui/SIMPLIFY_FAMILIARITY_MATRIX.md`; no competitor code/assets are included.
