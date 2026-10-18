use super::{ConfiguredRuntime, SupervisorError};
use std::path::{Path, PathBuf};
use tauri::Manager;
struct BoundRuntime {
    build_executable: &'static str,
    resource_relative: &'static str,
    executable_sha256: [u8; 32],
    manifest_sha256: [u8; 32],
}
include!(concat!(env!("OUT_DIR"), "/runtime_descriptor.rs"));
fn path_for_mode(
    descriptor: &BoundRuntime,
    packaged: bool,
    resource_root: Option<&Path>,
) -> Result<PathBuf, SupervisorError> {
    let path = if packaged {
        resource_root
            .ok_or(SupervisorError::InvalidRuntime)?
            .join(descriptor.resource_relative)
    } else {
        PathBuf::from(descriptor.build_executable)
    };
    if !path.is_absolute() {
        return Err(SupervisorError::InvalidRuntime);
    }
    Ok(path)
}
fn path_for_current_mode(
    descriptor: &BoundRuntime,
    resource_root: Option<&Path>,
) -> Result<PathBuf, SupervisorError> {
    path_for_mode(descriptor, !tauri::is_dev(), resource_root)
}
pub(crate) fn configured_runtime(
    app: &tauri::AppHandle,
) -> Result<ConfiguredRuntime, SupervisorError> {
    let Some(descriptor) = COMPILED_RUNTIME.as_ref() else {
        return Ok(ConfiguredRuntime::unavailable());
    };
    // The digest binds build evidence; full runtime tree enforcement belongs to W06.
    let _bound_manifest = descriptor.manifest_sha256;
    let resource = app.path().resource_dir().ok();
    let path = path_for_current_mode(descriptor, resource.as_deref())?;
    ConfiguredRuntime::approved(path, descriptor.executable_sha256)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    const BUILD_EXECUTABLE: &str = r"C:\build-owned\runtime\japp-orchestrator.exe";
    #[cfg(not(windows))]
    const BUILD_EXECUTABLE: &str = "/build-owned/runtime/japp-orchestrator";
    #[cfg(windows)]
    const RESOURCE_ROOT: &str = r"C:\App\resources";
    #[cfg(not(windows))]
    const RESOURCE_ROOT: &str = "/App.app/Contents/Resources";
    #[cfg(windows)]
    const RESOURCE_RELATIVE: &str = "runtime/japp-orchestrator/japp-orchestrator.exe";
    #[cfg(not(windows))]
    const RESOURCE_RELATIVE: &str = "runtime/japp-orchestrator/japp-orchestrator";
    #[cfg(windows)]
    const PACKAGED_EXECUTABLE: &str =
        r"C:\App\resources\runtime\japp-orchestrator\japp-orchestrator.exe";
    #[cfg(not(windows))]
    const PACKAGED_EXECUTABLE: &str =
        "/App.app/Contents/Resources/runtime/japp-orchestrator/japp-orchestrator";
    #[cfg(windows)]
    const UNTRUSTED_RESOURCE_ROOT: &str = r"C:\untrusted";
    #[cfg(not(windows))]
    const UNTRUSTED_RESOURCE_ROOT: &str = "/untrusted";
    fn descriptor() -> BoundRuntime {
        BoundRuntime {
            build_executable: BUILD_EXECUTABLE,
            resource_relative: RESOURCE_RELATIVE,
            executable_sha256: [1; 32],
            manifest_sha256: [2; 32],
        }
    }
    #[test]
    fn packaged_path_uses_only_app_resources() {
        assert_eq!(
            path_for_mode(&descriptor(), true, Some(Path::new(RESOURCE_ROOT))),
            Ok(PathBuf::from(PACKAGED_EXECUTABLE))
        );
    }
    #[test]
    fn packaged_missing_resources_cannot_fallback_to_build_path() {
        assert_eq!(
            path_for_mode(&descriptor(), true, None),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn development_path_is_compile_bound_and_ignores_resource_argument() {
        assert_eq!(
            path_for_mode(
                &descriptor(),
                false,
                Some(Path::new(UNTRUSTED_RESOURCE_ROOT))
            ),
            Ok(PathBuf::from(BUILD_EXECUTABLE))
        );
    }
    #[test]
    fn actual_sdk_protocol_mode_selects_the_runtime_path() {
        let resources = Path::new(RESOURCE_ROOT);
        let expected = if tauri::is_dev() {
            PathBuf::from(BUILD_EXECUTABLE)
        } else {
            resources.join(RESOURCE_RELATIVE)
        };
        eprintln!(
            "own_alias={} sdk_is_dev={} expected_path={}",
            cfg!(feature = "custom-protocol"),
            tauri::is_dev(),
            expected.display()
        );
        assert_eq!(
            path_for_current_mode(&descriptor(), Some(resources)),
            Ok(expected)
        );
    }
    #[test]
    fn actual_sdk_packaged_mode_cannot_fallback_without_resources() {
        let actual = path_for_current_mode(&descriptor(), None);
        if tauri::is_dev() {
            assert_eq!(actual, Ok(PathBuf::from(BUILD_EXECUTABLE)));
        } else {
            assert_eq!(actual, Err(SupervisorError::InvalidRuntime));
        }
    }
}
