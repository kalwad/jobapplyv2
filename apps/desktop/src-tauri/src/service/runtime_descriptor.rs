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
pub(crate) fn configured_runtime(
    app: &tauri::AppHandle,
) -> Result<ConfiguredRuntime, SupervisorError> {
    let Some(descriptor) = COMPILED_RUNTIME.as_ref() else {
        return Ok(ConfiguredRuntime::unavailable());
    };
    // The digest binds build evidence; full runtime tree enforcement belongs to W06.
    let _bound_manifest = descriptor.manifest_sha256;
    let resource = app.path().resource_dir().ok();
    let path = path_for_mode(
        descriptor,
        cfg!(feature = "custom-protocol"),
        resource.as_deref(),
    )?;
    ConfiguredRuntime::approved(path, descriptor.executable_sha256)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn descriptor() -> BoundRuntime {
        BoundRuntime {
            build_executable: "/build-owned/runtime/japp-orchestrator",
            resource_relative: "runtime/japp-orchestrator/japp-orchestrator",
            executable_sha256: [1; 32],
            manifest_sha256: [2; 32],
        }
    }
    #[test]
    fn packaged_path_uses_only_app_resources() {
        assert_eq!(
            path_for_mode(
                &descriptor(),
                true,
                Some(Path::new("/App.app/Contents/Resources"))
            ),
            Ok(PathBuf::from(
                "/App.app/Contents/Resources/runtime/japp-orchestrator/japp-orchestrator"
            ))
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
            path_for_mode(&descriptor(), false, Some(Path::new("/untrusted"))),
            Ok(PathBuf::from("/build-owned/runtime/japp-orchestrator"))
        );
    }
}
