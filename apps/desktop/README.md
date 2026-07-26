# apps/desktop

Desktop application (Tauri 2 + React + TypeScript + Vite,
docs/MASTER_IMPLEMENTATION_SPEC.md §5.2). It owns the user-visible profile,
resume, job, tracker, settings, queue, model, and diagnostics UI, and it
starts, monitors, and stops the local orchestrator and native host (§5.3).

This is a workspace slot created by the M00-W02 scaffold. The Tauri shell is
created in M03-W01; adding UI earlier would be a fake feature (spec §1.5).
No build/test scripts exist here yet by design — tasks appear when the shell
does.
