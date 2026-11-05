//! Native library boundary, intentionally outside Tauri IPC.
pub use super::platform_adapters::app_owner::NativePathService;
pub use super::platform_adapters::{
    LocalProcessSelection, ProcessProfile, TerminationIntent, WorkPermit, diagnostic_reason,
    request_owned_termination,
};
pub use super::platform_adapters::{
    PathFailure, PathOutcome, PathRequest, PathResolutionFields, PathRole, PathState, Reason, Scope,
};
