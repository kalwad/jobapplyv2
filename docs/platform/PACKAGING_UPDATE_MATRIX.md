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

For a future Gate D `PASS`, every certified-platform row must be `VERIFIED`
and cite its owning M27 package in `docs/TEST_EVIDENCE.md` or a dedicated
artifact below `docs/gates/evidence/`. The reference must resolve, including
any named heading; arbitrary or irrelevant repository files, placeholders,
URLs, absolute/traversal/symlink-escaped paths, missing evidence, and duplicate
rows are rejected. `VERIFIED` requires the native installer, signed/verified
update, rollback, repair, uninstall, and private-data-preservation matrix; it
is not implied by compilation or hosted repository CI.
