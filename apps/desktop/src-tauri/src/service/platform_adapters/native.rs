//! Native initialization/background API. Never called while holding the command owner.
#[cfg(unix)]
use super::posix_paths::NativeDirectories;
#[cfg(windows)]
use super::windows_paths::NativeDirectories;
use super::{paths::*, policy::*};
#[cfg(any(target_os = "linux", test))]
use std::path::Path;
use tauri::Manager;

pub(super) struct RandomNonces;
impl NonceSource for RandomNonces {
    fn next(&mut self) -> Result<String, PathFailure> {
        let mut bytes = [0u8; 16];
        getrandom::fill(&mut bytes).map_err(|_| PathFailure::Interrupted)?;
        Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
    }
}
#[cfg(any(target_os = "linux", test))]
pub(super) fn validate_ambient_base(value: Option<&Path>) -> Result<(), PathFailure> {
    if value.is_some_and(|path| !path.is_absolute() || path.as_os_str().is_empty()) {
        Err(PathFailure::Invalid)
    } else {
        Ok(())
    }
}
fn sdk_bases<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<TrustedBases, PathFailure> {
    if app.config().app.app_directories_override.is_some() || app.config().identifier != BUNDLE_ID {
        return Err(PathFailure::Invalid);
    }
    #[cfg(target_os = "linux")]
    for variable in ["XDG_DATA_HOME", "XDG_CACHE_HOME", "HOME"] {
        let value = std::env::var_os(variable).map(std::path::PathBuf::from);
        validate_ambient_base(value.as_deref())?;
    }
    let dirs = app.path();
    TrustedBases::new(
        dirs.app_local_data_dir()
            .map_err(|_| PathFailure::Missing)?,
        dirs.app_cache_dir().map_err(|_| PathFailure::Missing)?,
        dirs.temp_dir().map_err(|_| PathFailure::Missing)?,
        &app.config().identifier,
        false,
    )
}
/// Native initialization/background facade, with one finite cleanup owner.
#[cfg(any(unix, windows))]
pub(crate) struct NativePaths {
    owner: PathOwner<NativeDirectories, RandomNonces>,
}
#[cfg(any(unix, windows))]
impl NativePaths {
    pub(crate) fn from_app<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
    ) -> Result<Self, PathFailure> {
        Ok(Self {
            owner: PathOwner::new(PathProvider::new(
                sdk_bases(app)?,
                NativeDirectories::new(),
                RandomNonces,
            )),
        })
    }
    pub(crate) fn resolve(
        &mut self,
        request: &PathRequest,
        permit: &impl WorkPermit,
    ) -> Result<PathOutcome, PathFailure> {
        self.owner.resolve(request, permit)
    }
    pub(crate) fn cleanup(
        &mut self,
        outcome: &mut PathOutcome,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        self.owner.cleanup(outcome, permit)
    }
    pub(crate) fn cleanup_all(&mut self, permit: &impl CleanupPermit) -> Result<(), PathFailure> {
        self.owner.cleanup_all(permit)
    }
    pub(crate) fn pending_cleanup(&self) -> bool {
        self.owner.pending_cleanup()
    }
}
