# Packaging and Update Matrix

Planning and future-evidence register. No release installer, signing,
notarization, updater, rollback, repair, or uninstall implementation is
claimed by M00-W08.

| Platform | Planned release artifact | Signing / verification contract | Update contract | Current state | Evidence | Owning packages |
|---|---|---|---|---|---|---|
| `macos-arm64` | App bundle and DMG | Signed and notarization-ready | Signed target-specific update, rollback, repair, uninstall | `NOT_YET_IMPLEMENTED` | — | M27-W07, M27-W11, M27-W12 |
| `windows-x64` | Signed NSIS or MSI selected by ADR | Authenticode/signing policy and verified installer | Signed target-specific update, rollback, repair, uninstall | `NOT_YET_IMPLEMENTED` | — | M27-W08, M27-W11, M27-W12 |
| `ubuntu-x64` | Certified `.deb`; AppImage only as convenience after validation | Package/artifact verification policy | Signed target-specific update, rollback, repair, uninstall | `NOT_YET_IMPLEMENTED` | — | M27-W09, M27-W11, M27-W12 |

Every future evidence row must identify the exact OS build, architecture,
artifact hash/signature, install path, browser/webview, test date, raw
artifact bundle, and known limitations.
