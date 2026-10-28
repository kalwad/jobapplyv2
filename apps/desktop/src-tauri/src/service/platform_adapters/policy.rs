use crate::service::{OwnedProcess, SpawnPermit, SupervisorError};
use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PathRole {
    ApplicationData,
    ArtifactStore,
    BackupStaging,
    Cache,
    DiagnosticBundle,
    LogStore,
    ModelArtifactStore,
    NativeHostRegistration,
    Temporary,
}
impl PathRole {
    pub(super) fn token(self) -> &'static str {
        match self {
            Self::ApplicationData => "APPLICATION_DATA",
            Self::ArtifactStore => "ARTIFACT_STORE",
            Self::BackupStaging => "BACKUP_STAGING",
            Self::Cache => "CACHE",
            Self::DiagnosticBundle => "DIAGNOSTIC_BUNDLE",
            Self::LogStore => "LOG_STORE",
            Self::ModelArtifactStore => "MODEL_ARTIFACT_STORE",
            Self::NativeHostRegistration => "NATIVE_HOST_REGISTRATION",
            Self::Temporary => "TEMPORARY",
        }
    }
    pub(super) fn implemented(self) -> bool {
        matches!(
            self,
            Self::ApplicationData | Self::ArtifactStore | Self::Cache | Self::Temporary
        )
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Scope {
    User,
    System,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PathState {
    DeniedPermission,
    NotEvaluated,
    Resolved,
    Unavailable,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Reason {
    AdapterError,
    ArtifactDigestMismatch,
    ConfigurationInvalid,
    DependencyMissing,
    EvaluationNotRun,
    IdentityMismatch,
    Interrupted,
    NotInstalled,
    PermissionDenied,
    PolicyDisabled,
    ServiceUnavailable,
    Timeout,
    UserCanceled,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PathFailure {
    Invalid,
    Missing,
    Permission,
    Identity,
    Busy,
    Collision,
    Policy,
    Cancelled,
    Timeout,
    Interrupted,
    NotEvaluated,
}
impl PathFailure {
    pub(super) fn reason(self) -> Reason {
        match self {
            Self::Invalid => Reason::ConfigurationInvalid,
            Self::Missing => Reason::NotInstalled,
            Self::Permission => Reason::PermissionDenied,
            Self::Identity | Self::Collision => Reason::IdentityMismatch,
            Self::Policy => Reason::PolicyDisabled,
            Self::Busy => Reason::ServiceUnavailable,
            Self::Cancelled => Reason::UserCanceled,
            Self::Timeout => Reason::Timeout,
            Self::Interrupted => Reason::Interrupted,
            Self::NotEvaluated => Reason::EvaluationNotRun,
        }
    }
}
/// Same cancellation/deadline meaning as native service preflight; no independent authority.
pub trait WorkPermit {
    fn check(&self) -> Result<(), SupervisorError>;
}
impl WorkPermit for SpawnPermit<'_> {
    fn check(&self) -> Result<(), SupervisorError> {
        SpawnPermit::check(self)
    }
}
pub(super) fn check(permit: &(impl WorkPermit + ?Sized)) -> Result<(), PathFailure> {
    permit.check().map_err(|cause| match cause {
        SupervisorError::Cancelled => PathFailure::Cancelled,
        SupervisorError::StartupTimeout => PathFailure::Timeout,
        _ => PathFailure::Interrupted,
    })
}

pub struct PathRequest {
    pub role: PathRole,
    pub scope: Scope,
    pub relative_segments: Vec<String>,
    pub create_if_missing: bool,
}
impl PathRequest {
    pub(super) fn validate(&self) -> Result<String, PathFailure> {
        if self.scope != Scope::User {
            return Err(PathFailure::Policy);
        }
        if self.role == PathRole::Temporary && !self.create_if_missing {
            return Err(PathFailure::Policy);
        }
        if !self.role.implemented() {
            return Err(PathFailure::NotEvaluated);
        }
        if self.relative_segments.len() > 8
            || self.relative_segments.iter().any(|s| !valid_segment(s))
        {
            return Err(PathFailure::Invalid);
        }
        let reference = format!(
            "<{}>{}",
            self.role.token(),
            self.relative_segments
                .iter()
                .map(|s| format!("/{s}"))
                .collect::<String>()
        );
        if reference.len() > 256 {
            return Err(PathFailure::Invalid);
        }
        Ok(reference)
    }
}

pub(super) fn valid_segment(segment: &str) -> bool {
    let bytes = segment.as_bytes();
    if bytes.is_empty()
        || bytes.len() > 64
        || !bytes[0].is_ascii_alphanumeric()
        || !bytes
            .iter()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(b))
        || bytes.last() == Some(&b'.')
    {
        return false;
    }
    let stem = segment.split('.').next().unwrap_or("").to_ascii_uppercase();
    !matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        && !(stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProcessProfile {
    LocalOrchestrator,
    ModelRuntimeHost,
    NativeMessagingHost,
}
pub struct LocalProcessSelection;
impl LocalProcessSelection {
    pub fn select(
        profile: ProcessProfile,
        scope: Scope,
        arguments: &[String],
        environment: &[String],
        inherit: bool,
        permit: &(impl WorkPermit + ?Sized),
    ) -> Result<Self, PathFailure> {
        check(permit)?;
        if scope != Scope::User || !arguments.is_empty() || !environment.is_empty() || inherit {
            return Err(PathFailure::Policy);
        }
        if profile != ProcessProfile::LocalOrchestrator {
            return Err(PathFailure::NotEvaluated);
        }
        Ok(Self)
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TerminationIntent {
    None,
    GracefulStop,
    ImmediateStop,
}
pub fn request_owned_termination(
    process: &mut dyn OwnedProcess,
    intent: TerminationIntent,
) -> Result<(), SupervisorError> {
    match intent {
        TerminationIntent::None => Ok(()),
        TerminationIntent::GracefulStop => {
            process.close_lease();
            Ok(())
        }
        TerminationIntent::ImmediateStop => process.terminate_owned(),
    }
}
pub fn diagnostic_reason(cause: SupervisorError) -> Reason {
    match cause {
        SupervisorError::RuntimeUnavailable => Reason::NotInstalled,
        SupervisorError::Cancelled => Reason::UserCanceled,
        SupervisorError::InvalidRuntime | SupervisorError::InvalidPolicy => {
            Reason::ConfigurationInvalid
        }
        SupervisorError::EntropyUnavailable => Reason::AdapterError,
        SupervisorError::StartupTimeout => Reason::Timeout,
        SupervisorError::ContainmentUnavailable => Reason::EvaluationNotRun,
        SupervisorError::GenerationExhausted => Reason::Interrupted,
        _ => Reason::ServiceUnavailable,
    }
}

/// Use the already-reviewed Windows component policy while preserving Unicode
/// and spaces in trusted SDK roots. No native executable is selected or opened.
#[cfg(any(windows, test, feature = "windows-source-check"))]
pub(super) fn validate_windows_directory(path: &str) -> Result<(), PathFailure> {
    let path = path.trim_end_matches(['\\', '/']);
    crate::service::windows_policy::launch_plan(&format!("{path}\\pathcheck.exe"))
        .map(|_| ())
        .map_err(|_| PathFailure::Invalid)
}
