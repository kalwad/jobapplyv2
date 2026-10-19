# Windows manifest correction checkpoint

The prior c4f hosted run remains FAILURE: macOS and Ubuntu pass20/20; Windows passes18/20, fails typecheck without a captured compiler diagnostic, and fails linking with duplicate RT_MANIFEST/CVT1100/LNK1123. Its diagnostic fails on joined Git executable paths before any PE inspection. Original CI archive bytes remain unchanged under ci/.

The correction disables only Tauri's default MSVC manifest so the existing linker-owned Common Controls6 manifest is emitted once. Icon/version resources, command policy and non-MSVC defaults remain. The existing failure-only PowerShell script binds the first Application image and retains only15 fixed typecheck log paths within1MiB/log and8MiBtotal bounds. It reruns no task and changes no workflow or failure policy. Sparse source reviews and original findings are retained. PowerShell fixture cases remain unexecuted.

Actual macOS pnpm verify --suite rust exits0: all15 commands,232 tests in each3 modes, root1956/runtime40 unchanged, owned group gone/reaped without cleanup signals. The observer wrapper exits1 because a copied footer still expected six commands; exactly one was planned/executed. Original wrapper/raw/closure remain; separate derived reconciliation reports that bookkeeping error without a rerun.

W06 remains IN_PROGRESS,38/300 VERIFIED. Fresh clean full validation, native Windows and actualPS, GUI/LaunchServices/package certification and original entrypoint-cause investigation remain pending. No original failed result is relabeled and no milestone/gate/release acceptance follows.

The finite archive retains raw officialCI/API/artifact/source bindings, source proposals/reviews and local component receipts. Physical native/tool/runtime/cache images are omitted. Every outer member is a unique safe regular file with exact byte/hash readback.

The local Rust run used core PS1 resolver2f228343; the final PS-only log-retention delta d592d1b1 followed it. Its source review is separate; fresh final-tree full validation remains pending. The canonical summary explicitly adds this derived binding note; original producer summary/raw receipts inside the archive stay unchanged.
