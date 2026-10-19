mod platform;
mod protocol;
mod supervisor;

pub use platform::{ConfiguredRuntime, MonotonicClock};
#[cfg(any(unix, test))]
pub use protocol::Bootstrap;
#[cfg(unix)]
pub use protocol::ReadyFrame;
pub use protocol::ServiceIdentity;
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
