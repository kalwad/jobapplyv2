# @japp/platform

Workspace scaffold for the typed platform service layer (spec §5.1,
§5.14.2). Created by M00-W09 to establish ownership only — it contains no
platform interfaces and no product behavior.

Ownership boundaries (do not implement these here ahead of their owners):

- Typed platform contracts (`PlatformCapabilities`, `PlatformPaths`,
  `SecretStore`, `ProcessSupervisor`, `NativeMessagingRegistrar`,
  `BrowserLocator`, `ModelRuntimeProvider`, `InstallerState`,
  `UpdaterProvider`, `PlatformDiagnostics`): **delivered by M01-W07** as
  canonical JSON Schema under `packages/contracts/schemas/platform/`, with
  generated strict TypeScript and Pydantic v2 surfaces. See
  `packages/contracts/M01-W07.md`. This package still contains no interface
  code, no adapter, and no product behavior; it gains implementation only with
  the owners below.
- Lifecycle/path/process adapters: **M03-W07 … M03-W10**.
- macOS Keychain / Windows Credential Manager+DPAPI / Ubuntu Secret
  Service secret stores and portable backup: **M04-W07 … M04-W10**.
- Model-runtime capability profiles and fallback: **M05-W13 … M05-W16**.
- Native-messaging registration and cross-platform E2E: **M17-W07 …
  M17-W10**.
- Packaging, signing, update/rollback, and Gate D evidence: **M27-W07 …
  M27-W12**.

The `windows-2025` CI job added by M00-W09 is a repository/toolchain
portability baseline, not Windows product certification; see
`docs/PLATFORM_SUPPORT.md`.
