use super::{ConfiguredRuntime, SupervisorError};
use std::path::{Path, PathBuf};
#[cfg(not(target_os = "linux"))]
use tauri::Manager;
struct BoundRuntime {
    build_executable: &'static str,
    resource_relative: &'static str,
    executable_sha256: [u8; 32],
    manifest_sha256: [u8; 32],
    target: &'static str,
}
include!(concat!(env!("OUT_DIR"), "/runtime_descriptor.rs"));
fn path_for_mode(
    descriptor: &BoundRuntime,
    packaged: bool,
    resource_root: Option<&Path>,
) -> Result<PathBuf, SupervisorError> {
    let path = if packaged {
        resource_root
            .ok_or_else(|| {
                eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
                SupervisorError::InvalidRuntime
            })?
            .join(descriptor.resource_relative)
    } else {
        PathBuf::from(descriptor.build_executable)
    };
    if !path.is_absolute() {
        return Err({
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        });
    }
    Ok(path)
}
/// Tauri reports the Windows resource directory in verbatim form
/// (`\\?\C:\...`; measured on hosted Windows, KI-0157), while the launch
/// policy accepts only drive-absolute paths. A verbatim local-drive path names
/// the same directory in drive form; every other form is returned unchanged and
/// is still judged by the launch policy and the runtime integrity check.
fn drive_form(path: PathBuf) -> PathBuf {
    let Some(rest) = path.to_str().and_then(|text| text.strip_prefix(r"\\?\")) else {
        return path;
    };
    let bytes = rest.as_bytes();
    if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && &bytes[1..3] == b":\\" {
        return PathBuf::from(rest);
    }
    path
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
    #[cfg(target_os = "linux")]
    let resource = if !tauri::is_dev() {
        std::env::current_exe().ok().and_then(|executable| {
            super::linux_resources::resource_root(&executable, &app.package_info().name).ok()
        })
    } else {
        None
    };
    #[cfg(not(target_os = "linux"))]
    let resource = app.path().resource_dir().ok().map(drive_form);
    eprintln!(
        "JAPP_DIAG resource_dir={:?} is_dev={}",
        resource,
        tauri::is_dev()
    );
    let path = path_for_current_mode(descriptor, resource.as_deref())?;
    eprintln!("JAPP_DIAG runtime_path={:?}", path);
    let root = path
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| {
            eprintln!("JAPP_DIAG InvalidRuntime {}:{}", file!(), line!());
            SupervisorError::InvalidRuntime
        })?
        .to_path_buf();
    ConfiguredRuntime::approved_tree(
        path,
        descriptor.executable_sha256,
        super::runtime_integrity::RuntimeTree::new(
            root,
            descriptor.target,
            descriptor.manifest_sha256,
        ),
    )
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
            target: "aarch64-apple-darwin",
        }
    }
    #[test]
    fn verbatim_local_drive_resource_directory_uses_drive_form() {
        // The exact verbatim forms Tauri returned on hosted Windows (KI-0157).
        for (verbatim, drive) in [
            (r"\\?\C:\japp-gui-diag", r"C:\japp-gui-diag"),
            (
                "\\\\?\\C:\\Users\\runneradmin\\AppData\\Local\\JobApply \u{3a9} space diag",
                "C:\\Users\\runneradmin\\AppData\\Local\\JobApply \u{3a9} space diag",
            ),
            (r"\\?\d:\", r"d:\"),
        ] {
            assert_eq!(drive_form(PathBuf::from(verbatim)), PathBuf::from(drive));
        }
    }
    #[test]
    fn other_resource_directory_forms_are_left_to_the_launch_policy() {
        for path in [
            r"C:\App\resources",
            r"\\?\UNC\server\share\App",
            r"\\.\C:\App",
            r"\\?\C:",
            r"\\?\1:\App",
            r"\\?\GLOBALROOT\Device\HarddiskVolume1\App",
            "/App.app/Contents/Resources",
        ] {
            assert_eq!(drive_form(PathBuf::from(path)), PathBuf::from(path));
        }
    }
    #[test]
    fn drive_form_runtime_path_passes_the_launch_policy_that_refuses_verbatim() {
        let relative = r"runtime\japp-orchestrator\japp-orchestrator.exe";
        let verbatim = r"\\?\C:\JobApply space";
        let refused = format!("{verbatim}\\{relative}");
        assert!(super::super::windows_policy::launch_plan(&refused).is_err());
        let drive = drive_form(PathBuf::from(verbatim));
        let accepted = format!("{}\\{relative}", drive.to_str().unwrap());
        assert!(super::super::windows_policy::launch_plan(&accepted).is_ok());
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
