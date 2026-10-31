//! Native platform boundary. No path, OS identity, process handle or credential is serializable.
mod creation;
mod paths;
mod policy;
pub(crate) use paths::{CleanupBudget, CleanupPermit};
pub use paths::{PathOutcome, PathResolutionFields};
pub use policy::{
    LocalProcessSelection, PathFailure, PathRequest, PathRole, PathState, ProcessProfile, Reason,
    Scope, TerminationIntent, WorkPermit, diagnostic_reason, request_owned_termination,
};

mod native;
#[cfg(unix)]
mod posix_paths;
#[cfg(any(windows, feature = "windows-source-check"))]
mod windows_paths;
pub(crate) use native::NativePaths;

#[cfg(test)]
mod fixture_isolation;

pub(crate) mod app_owner;
