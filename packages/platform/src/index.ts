/**
 * Typed OS capabilities, paths, process, key store, installer interfaces
 * (spec §5.1, §5.14.2).
 *
 * Ownership boundary: this M00-W09 scaffold establishes the workspace slot
 * only. The typed platform contracts (`PlatformCapabilities`,
 * `PlatformPaths`, `SecretStore`, `ProcessSupervisor`,
 * `NativeMessagingRegistrar`, `BrowserLocator`, `ModelRuntimeProvider`,
 * `InstallerState`, `UpdaterProvider`, `PlatformDiagnostics`) are owned by
 * M01-W07, and the native macOS/Windows/Ubuntu implementations by their
 * M03/M04/M05/M17/M27 packages. Nothing here is product behavior, and no
 * platform interface may be added outside its owning package (spec §1.5).
 */
export const PACKAGE_NAME = "@japp/platform";
