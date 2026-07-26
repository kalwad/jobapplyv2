# Certified Platform Matrix

Planning matrix created by M00-W08. Rows describe the v1.3 certification
contract, not completed compatibility claims.

| Target ID | OS / architecture | Browser | Intended support | Current product state | Native evidence | Owning packages |
|---|---|---|---|---|---|---|
| `macos-arm64` | macOS 14+ / arm64 | Chrome stable | `CERTIFIED_FULL` or `CERTIFIED_CORE` | `NOT_YET_IMPLEMENTED` | — | M03-W06, M04-W07, M05-W01…W13, M10-W07, M17-W07/W10, M27-W07/W10…W12 |
| `windows-x64` | Windows 11 / x64 | Chrome stable | `CERTIFIED_FULL` or `CERTIFIED_CORE` | `NOT_YET_IMPLEMENTED` | — | M00-W09, M03-W07/W09/W10, M04-W08/W10, M05-W13/W14/W16, M10-W07, M17-W08/W10, M27-W08/W10…W12 |
| `ubuntu-x64` | Ubuntu 24.04 LTS / x64 | Chrome stable | `CERTIFIED_FULL` or `CERTIFIED_CORE` | `NOT_YET_IMPLEMENTED` | — | M03-W08…W10, M04-W09/W10, M05-W13/W15/W16, M10-W07, M17-W09/W10, M27-W09…W12 |

## Explicitly outside first-release certification

| Target | State | Evidence / reason |
|---|---|---|
| Windows 10 | `UNSUPPORTED` | Outside v1.3 first-release scope. |
| Intel macOS | `UNSUPPORTED` | Outside v1.3 first-release scope. |
| Windows ARM64 | `UNSUPPORTED` | Outside v1.3 first-release scope. |
| Non-Ubuntu Linux distributions | `EXPERIMENTAL` at most | No certification package or evidence. |
| Firefox, Safari, ChromeOS, mobile | `UNSUPPORTED` | Outside v1.3 first-release scope. |

M00 CI evidence is repository-infrastructure evidence only and must never be
promoted into these native-product rows. That includes the required
`windows-2025` hosted job added by M00-W09: it proves repository/toolchain
portability (pins, doctor, canonical verification, portability policy) on a
hosted Windows Server runner, not certified Windows 11 desktop product
behavior, which remains `NOT_YET_IMPLEMENTED` until its owning packages
produce native packaged evidence.
