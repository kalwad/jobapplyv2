# M03-W04 authenticated client integration

W04 is IN_PROGRESS. The current canonical implementation adopts exactly 81 independently reviewed paths from source manifest `b79acf135fcd53da216363dfa50f30af376315fab3504696a697fe08490a66d0`. The canonical generator produced 205 files (204 outputs plus manifest), all matching the reviewed source; 194 prior generated files remain unchanged. Current governance, prior verified evidence, CI and scanner changes are preserved.

The native client verifies a connection-specific server proof before sending its bearer token, validates canonical responses and correlation IDs, bounds reads and deadlines, cancels in-flight requests, and retries only the closed idempotent GET operations within one budget. The Tauri diagnostics boundary retains native ownership and exposes safe DTOs rather than credentials, ports or arbitrary response text. Browser evidence uses an explicit synthetic IPC boundary; the real owner-to-client connection is proved separately.

The eight focused commands at the unchanged 1,873-path canonical source all pass: frozen pnpm install, locked offline uv sync, format, typecheck, 39 desktop unit tests, 2,560 contract tests, 129 service Python tests, and the complete canonical Rust suite with 138 desktop tests in each required feature mode. Actual command receipts, stdout/stderr, source snapshots and the 81-path adoption record are in current-root-focused.tar.gz. This is focused verification; current clean-root full verification is still pending.

The selected real-owner proof exercises the actual private Supervisor/ManagedService ACK and cached session, current Python service and native HTTP client, Quit withdrawal, child death and owned cleanup in three cases across three modes. Its two extra harness files are outside-only; canonical native coverage remains 138. The independent review binds its unchanged shipping projection to the adopted source.

The earlier outside current-tooling aggregate remains FAIL with 19 suites passing and a native build stopped by read-only copied runtime files. A separate complete Rust retry passes after changing only owner-write permissions in its owned ignored staging/cache copies. The command review preserves both actual outcomes and their complementary same-source coverage.

The fresh outside macOS app build succeeds on its first attempt, with all 42 app files and 40 runtime files bound. It is NOT_LAUNCHED. The selected app review documents a closure PATH metadata erratum for 22 earlier setup records; accurate individual upfront/result records remain authoritative. No Windows/Ubuntu package, GUI availability or new native launch is claimed.

For the canonical runtime stage, all 135 actual source inputs, both original wheel hashes, the actual build-tools lock and external runtime requirements match the previously built d274 payload before copying. All 40 staged bytes and modes match; the previous root stage is COW-backed up outside the repo. This is verified reuse, with no new Python build or execution claim. Exact omitted body bindings and declared recovery locations remain in each selected packet.

The adoption review passes. These artifacts do not accept W04, M03, a platform matrix or a release before the remaining current verification and required reviews are completed.
