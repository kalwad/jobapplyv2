# Native Messaging Matrix

Planning and future-evidence register. No product native-messaging installer
or packaged host is implemented by M00-W08.

| Platform | Required registration | Required protocol behavior | Current state | Evidence | Owning packages |
|---|---|---|---|---|---|
| `macos-arm64` | Absolute-path Chrome host manifest in the supported location | Typed length-framed messages, extension allowlist, repair/removal | `NOT_YET_IMPLEMENTED` | — | M17-W07, M17-W10 |
| `windows-x64` | Chrome native-messaging registry key pointing to the host manifest | Binary stdin/stdout length framing, spaces/Unicode paths, repair/removal | `NOT_YET_IMPLEMENTED` | — | M17-W08, M17-W10 |
| `ubuntu-x64` | Absolute-path user/system Chrome host manifest per package mode | Executable permissions, typed length framing, repair/removal | `NOT_YET_IMPLEMENTED` | — | M17-W09, M17-W10 |

Installer, update, repair, uninstall, extension handshake, and security claims
remain unverified until native packaged evidence exists.
