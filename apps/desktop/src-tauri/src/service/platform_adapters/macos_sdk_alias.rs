//! One observed OS-owned macOS alias, applied only to private SDK roots.
//! This never canonicalizes renderer input or follows any private descendant.
use super::{PathFailure, WorkPermit};
use std::{
    fs::Metadata,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};

fn renew(permit: Option<&dyn WorkPermit>) -> Result<(), PathFailure> {
    permit.map_or(Ok(()), super::super::policy::check)
}
fn root_directory(is_directory: bool, uid: u32, mode: u32) -> bool {
    is_directory && uid == 0 && mode & 0o022 == 0
}
fn root_var_link(is_symlink: bool, uid: u32, target: &Path) -> bool {
    is_symlink && uid == 0 && matches!(target.to_str(), Some("private/var" | "/private/var"))
}
fn trusted_target(link: &Metadata, target: &Path, directories: &[Metadata; 3]) -> bool {
    root_var_link(link.file_type().is_symlink(), link.uid(), target)
        && directories
            .iter()
            .all(|metadata| root_directory(metadata.is_dir(), metadata.uid(), metadata.mode()))
}

pub(super) fn normalize_sdk_root(
    path: &Path,
    permit: Option<&dyn WorkPermit>,
) -> Result<PathBuf, PathFailure> {
    let Ok(suffix) = path.strip_prefix("/var") else {
        return Ok(path.to_path_buf());
    };
    // These fixed prefixes are OS-owned, checked without following a link.
    // The adapter still opens every normalized component with O_NOFOLLOW.
    renew(permit)?;
    let link = std::fs::symlink_metadata("/var").map_err(|_| PathFailure::Identity)?;
    renew(permit)?;
    let target = std::fs::read_link("/var").map_err(|_| PathFailure::Identity)?;
    renew(permit)?;
    let root = std::fs::symlink_metadata("/").map_err(|_| PathFailure::Identity)?;
    renew(permit)?;
    let private = std::fs::symlink_metadata("/private").map_err(|_| PathFailure::Identity)?;
    renew(permit)?;
    let var = std::fs::symlink_metadata("/private/var").map_err(|_| PathFailure::Identity)?;
    renew(permit)?;
    if !trusted_target(&link, &target, &[root, private, var]) {
        return Err(PathFailure::Identity);
    }
    Ok(Path::new("/private/var").join(suffix))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::{MonotonicClock, SpawnPermit};
    use std::{
        sync::atomic::{AtomicBool, Ordering},
        time::Duration,
    };

    #[test]
    fn observed_root_owned_var_alias_normalizes_only_the_system_prefix() {
        let normalized = normalize_sdk_root(Path::new("/var/folders/example/T"), None).unwrap();
        assert_eq!(normalized, Path::new("/private/var/folders/example/T"));
        assert_eq!(
            normalize_sdk_root(Path::new("/variable/private"), None).unwrap(),
            Path::new("/variable/private")
        );
        assert_eq!(
            normalize_sdk_root(Path::new("/Users/example/alias"), None).unwrap(),
            Path::new("/Users/example/alias")
        );
    }

    #[test]
    fn cancellation_before_alias_observation_is_refused() {
        let cancelled = AtomicBool::new(false);
        let clock = MonotonicClock::default();
        let permit =
            SpawnPermit::for_operation(&cancelled, &clock, Duration::from_secs(1)).unwrap();
        cancelled.store(true, Ordering::Release);
        assert_eq!(
            normalize_sdk_root(Path::new("/var/folders/example/T"), Some(&permit)),
            Err(PathFailure::Cancelled)
        );
    }

    #[test]
    fn private_alias_and_non_os_owned_prefix_evidence_cannot_be_trusted() {
        assert!(root_var_link(true, 0, Path::new("private/var")));
        assert!(root_var_link(true, 0, Path::new("/private/var")));
        assert!(!root_var_link(true, 501, Path::new("private/var")));
        assert!(!root_var_link(false, 0, Path::new("private/var")));
        assert!(!root_var_link(true, 0, Path::new("/Users/example/var")));
        assert!(!root_var_link(true, 0, Path::new("private/var/../other")));
        assert!(root_directory(true, 0, 0o755));
        assert!(!root_directory(false, 0, 0o755));
        assert!(!root_directory(true, 501, 0o755));
        assert!(!root_directory(true, 0, 0o775));
        assert!(!root_directory(true, 0, 0o757));
    }
}
