mod platform;
mod protocol;
mod supervisor;

pub use platform::{ConfiguredRuntime, MonotonicClock};
pub use protocol::{Bootstrap, ReadyFrame, ServiceIdentity};
pub use supervisor::*;

mod tauri_lifecycle;
#[allow(unused_imports)] // W04 maps only this safe enum; no credential serialization.
pub(crate) use tauri_lifecycle::LifecycleDiagnostic;
pub use tauri_lifecycle::ManagedService;

mod lifecycle_state;
mod runtime_descriptor;
pub(crate) use runtime_descriptor::configured_runtime;

mod authority_hub;

mod restart;

#[cfg(any(target_os = "linux", test))]
mod linux_resources;
mod runtime_integrity;
#[cfg(any(windows, feature = "windows-source-check"))]
mod windows_native;
#[cfg(any(windows, test, feature = "windows-source-check"))]
mod windows_policy;
