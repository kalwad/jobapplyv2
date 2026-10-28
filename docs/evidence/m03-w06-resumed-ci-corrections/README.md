# Resumed M03-W06 CI and fixture corrections

Official run39213957984/attempt1 checks out merge38a4f211530e2fafffb90a6e82697c6e8a3f6b95,
exactly head434ba077/tree d09331f88af59a949d469889fa15451164e8c0e5/1988 blobs.
macOS/Ubuntu pass all20 suites; Windows passes18 and fails Python/Rust.
The new native package matrix is skipped. Original failures remain unchanged.

The proposed and adopted two test corrections isolate the synthetic Windows
platform probe and require actual same-port listener rebinding within a bounded
setup budget. All original assertions remain. Root reviews the source before
adoption. Actual local focused execution passes3 Python and6 Rust cases, with
228 Rust cases filtered. Separate data review clears24 checks and binds all1988
source-content hashes before/after. This is not a complete aggregate/native
suite or a new Windows PASS. No production networking policy is changed.

The finite archive retains complete original CI and focused-data packets,
including raw API/logs, exact-source hashes, before/after bodies, primary
references and the first review-checker assertion-count correction. The raw
Windows log records successful seven-day artifact uploads; the resumed artifact
API is empty and direct diagnostics endpoint404, so those unavailable binary
bodies are not reconstructed or inspected. The precise AddrInUse cause remains
unobserved. See artifact.json, summary.json and the member hash manifest.

W06 remains IN_PROGRESS,38/300 VERIFIED,M03 IN_PROGRESS,release NOT_READY.
GUI/package acceptance and current-head full/native Windows checks remain
separate obligations. No milestone, gate or platform certification is added.
