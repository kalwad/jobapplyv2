//! Native executable-relative Linux resource discovery; no environment fallback.
use super::SupervisorError;
use std::path::{Path, PathBuf};
pub(super) fn resource_root(
    executable: &Path,
    product_name: &str,
) -> Result<PathBuf, SupervisorError> {
    if !executable.is_absolute()
        || product_name.is_empty()
        || matches!(product_name, "." | "..")
        || product_name.contains(['/', '\\', ':'])
        || !matches!(
            Path::new(product_name).components().next(),
            Some(std::path::Component::Normal(_))
        )
    {
        return Err(SupervisorError::InvalidRuntime);
    }
    let executable = executable
        .canonicalize()
        .map_err(|_| SupervisorError::InvalidRuntime)?;
    if !executable.is_file() {
        return Err(SupervisorError::InvalidRuntime);
    }
    let bin = executable.parent().ok_or(SupervisorError::InvalidRuntime)?;
    if bin.file_name() != Some(std::ffi::OsStr::new("bin")) {
        return Err(SupervisorError::InvalidRuntime);
    }
    let prefix = bin.parent().ok_or(SupervisorError::InvalidRuntime)?;
    let library = prefix.join("lib");
    let resources = library.join(product_name);
    for directory in [&library, &resources] {
        let metadata =
            std::fs::symlink_metadata(directory).map_err(|_| SupervisorError::InvalidRuntime)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(SupervisorError::InvalidRuntime);
        }
    }
    let canonical = resources
        .canonicalize()
        .map_err(|_| SupervisorError::InvalidRuntime)?;
    if canonical != resources {
        return Err(SupervisorError::InvalidRuntime);
    }
    Ok(canonical)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static SERIAL: AtomicUsize = AtomicUsize::new(0);
    struct Fixture {
        root: PathBuf,
        executable: PathBuf,
        resources: PathBuf,
    }
    impl Fixture {
        fn ready() -> Self {
            let root = std::env::temp_dir().join(format!(
                "w08-owned-{}-{} 空间",
                std::process::id(),
                SERIAL.fetch_add(1, Ordering::Relaxed)
            ));
            let executable = root.join("usr/bin/japp-desktop");
            let resources = root.join("usr/lib/Desktop App");
            std::fs::create_dir_all(executable.parent().unwrap()).unwrap();
            std::fs::create_dir_all(&resources).unwrap();
            std::fs::write(&executable, b"synthetic path fixture; never executed").unwrap();
            Self {
                root,
                executable,
                resources,
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
    #[test]
    fn executable_relative_resources_preserve_spaces_and_unicode() {
        let f = Fixture::ready();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Ok(f.resources.canonicalize().unwrap())
        );
    }
    #[test]
    fn missing_resources_are_unavailable_without_sdk_or_system_fallback() {
        let f = Fixture::ready();
        std::fs::remove_dir_all(&f.resources).unwrap();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn product_name_is_one_compile_bound_native_component() {
        let f = Fixture::ready();
        for bad in [
            "",
            ".",
            "..",
            "/",
            "../bin",
            "Desktop App/..",
            "Desktop App\\other",
            "x:y",
        ] {
            assert_eq!(
                resource_root(&f.executable, bad),
                Err(SupervisorError::InvalidRuntime),
                "{bad}"
            );
        }
    }
    #[test]
    fn relative_executable_is_never_a_path_search() {
        assert_eq!(
            resource_root(Path::new("japp-desktop"), "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn absent_executable_cannot_mint_resource_authority() {
        let f = Fixture::ready();
        std::fs::remove_file(&f.executable).unwrap();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn executable_must_be_a_regular_file_in_the_native_bin_layout() {
        let f = Fixture::ready();
        std::fs::remove_file(&f.executable).unwrap();
        std::fs::create_dir(&f.executable).unwrap();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn nonbin_layout_never_falls_back_to_ambient_resources() {
        let f = Fixture::ready();
        let exe = f.root.join("usr/other/japp-desktop");
        std::fs::create_dir_all(exe.parent().unwrap()).unwrap();
        std::fs::write(&exe, b"synthetic").unwrap();
        assert_eq!(
            resource_root(&exe, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    fn resources_must_be_a_directory() {
        let f = Fixture::ready();
        std::fs::remove_dir_all(&f.resources).unwrap();
        std::fs::write(&f.resources, b"file").unwrap();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    #[cfg(unix)]
    fn resource_directory_symlink_cannot_redirect_ownership() {
        let f = Fixture::ready();
        let moved = f.root.join("other-resources");
        std::fs::rename(&f.resources, &moved).unwrap();
        std::os::unix::fs::symlink(&moved, &f.resources).unwrap();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
    #[test]
    #[cfg(unix)]
    fn library_directory_symlink_cannot_redirect_ownership() {
        let f = Fixture::ready();
        let lib = f.root.join("usr/lib");
        let moved = f.root.join("other-lib");
        std::fs::rename(&lib, &moved).unwrap();
        std::os::unix::fs::symlink(&moved, &lib).unwrap();
        assert_eq!(
            resource_root(&f.executable, "Desktop App"),
            Err(SupervisorError::InvalidRuntime)
        );
    }
}
