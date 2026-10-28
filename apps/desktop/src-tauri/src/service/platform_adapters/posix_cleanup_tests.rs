//! Real POSIX fixture regressions; platform settlement follows observed OS semantics.
//! The after-verify case is an explicit counterproof to atomic same-UID deletion.
use super::*;
use std::{
    cell::RefCell,
    os::unix::fs::{DirBuilderExt, symlink},
};

type VerifyHook = Box<dyn FnOnce(&Lease)>;
thread_local! {
    static AFTER_VERIFY: RefCell<Option<VerifyHook>> = const { RefCell::new(None) };
}
pub(super) fn after_verify(lease: &Lease) {
    let hook = AFTER_VERIFY.with(|slot| slot.borrow_mut().take());
    if let Some(hook) = hook {
        hook(lease);
    }
}
struct HookGuard;
impl Drop for HookGuard {
    fn drop(&mut self) {
        AFTER_VERIFY.with(|slot| {
            slot.borrow_mut().take();
        });
    }
}
fn install(hook: impl FnOnce(&Lease) + 'static) -> HookGuard {
    AFTER_VERIFY.with(|slot| assert!(slot.borrow_mut().replace(Box::new(hook)).is_none()));
    HookGuard
}
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let nonce = super::super::native::RandomNonces.next().unwrap();
        let path = std::env::temp_dir().join(format!("jobapply-posix-custody-{nonce}"));
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(&path)
            .unwrap();
        // Fixture-only normalization avoids making a synthetic fixture's spelling
        // part of the product's SDK-root authority.
        Self(path.canonicalize().unwrap())
    }
    fn own(&self) -> (NativeDirectories, Lease, Lease) {
        let mut directories = NativeDirectories::new();
        let base = directories
            .open_base(&self.0, BaseKind::Application, false)
            .unwrap();
        let child = directories.child(&base, "owned", true, true).unwrap();
        directories.register_owned(&child).unwrap();
        (directories, base, child)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // Only this unpredictable fixture's known names; never recursive cleanup.
        for name in ["alias", "owned/file"] {
            let _ = std::fs::remove_file(self.0.join(name));
        }
        for name in ["owned", "moved"] {
            let _ = std::fs::remove_dir(self.0.join(name));
        }
        let _ = std::fs::remove_dir(&self.0);
    }
}

#[test]
fn ordinary_private_directory_cleanup_unlinks_the_held_original() {
    let fixture = Fixture::new();
    let (mut directories, _, child) = fixture.own();
    assert_eq!(stat(child.fd().unwrap()).unwrap().st_mode & 0o777, 0o700);
    assert!(directories.remove_owned_empty(child.clone()).is_ok());
    assert!(!fixture.0.join("owned").exists());
    #[cfg(not(target_os = "macos"))]
    assert_eq!(stat(child.fd().unwrap()).unwrap().st_nlink, 0);
    // Darwin/APFS retains the pre-rmdir link count on this held descriptor.
    // Assert its namespace settlement without fabricating an inode-unlinked fact.
    #[cfg(target_os = "macos")]
    assert!(directory_removal_settled(&child).unwrap());
}

#[test]
fn replacement_before_verification_is_preserved_and_original_is_retryable() {
    let fixture = Fixture::new();
    let (mut directories, _, child) = fixture.own();
    std::fs::rename(fixture.0.join("owned"), fixture.0.join("moved")).unwrap();
    std::fs::DirBuilder::new()
        .mode(0o700)
        .create(fixture.0.join("owned"))
        .unwrap();
    let replacement = std::fs::metadata(fixture.0.join("owned")).unwrap();
    let (failure, child) = directories.remove_owned_empty(child).err().unwrap();
    assert_eq!(failure, PathFailure::Identity);
    use std::os::unix::fs::MetadataExt;
    assert_eq!(
        std::fs::metadata(fixture.0.join("owned")).unwrap().ino(),
        replacement.ino()
    );
    assert!(fixture.0.join("moved").is_dir());
    std::fs::remove_dir(fixture.0.join("owned")).unwrap();
    std::fs::rename(fixture.0.join("moved"), fixture.0.join("owned")).unwrap();
    assert!(directories.remove_owned_empty(child).is_ok());
}

#[test]
fn external_same_uid_swap_after_verification_cannot_report_original_as_cleaned() {
    let fixture = Fixture::new();
    let (mut directories, _, child) = fixture.own();
    let original_id = child.id().unwrap();
    let root = fixture.0.clone();
    let _guard = install(move |lease| {
        assert_eq!(lease.id().unwrap().0, original_id.0);
        assert_eq!(lease.id().unwrap().1, original_id.1);
        std::fs::rename(root.join("owned"), root.join("moved")).unwrap();
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(root.join("owned"))
            .unwrap();
    });
    let (failure, child) = directories.remove_owned_empty(child).err().unwrap();
    assert_eq!(failure, PathFailure::Identity);
    // POSIX does not provide unlink-if-inode. The external replacement was
    // removed: unsupported same-UID interference is detected, not prevented.
    assert!(!fixture.0.join("owned").exists());
    assert!(fixture.0.join("moved").is_dir());
    assert!(stat(child.fd().unwrap()).unwrap().st_nlink > 0);
    std::fs::rename(fixture.0.join("moved"), fixture.0.join("owned")).unwrap();
    assert!(directories.remove_owned_empty(child).is_ok());
}

#[test]
fn nonempty_owned_directory_refuses_cleanup_and_retains_original() {
    let fixture = Fixture::new();
    let (mut directories, _, child) = fixture.own();
    std::fs::write(fixture.0.join("owned/file"), b"retained").unwrap();
    let (failure, child) = directories.remove_owned_empty(child).err().unwrap();
    assert_eq!(failure, PathFailure::Busy);
    assert!(fixture.0.join("owned/file").is_file());
    assert!(stat(child.fd().unwrap()).unwrap().st_nlink > 0);
    std::fs::remove_file(fixture.0.join("owned/file")).unwrap();
    assert!(directories.remove_owned_empty(child).is_ok());
}

#[test]
fn private_descendant_symlink_never_becomes_a_native_directory_lease() {
    let fixture = Fixture::new();
    let (mut directories, base, child) = fixture.own();
    symlink("owned", fixture.0.join("alias")).unwrap();
    assert_eq!(
        directories.child(&base, "alias", false, false).err(),
        Some(PathFailure::Identity)
    );
    assert!(
        fixture
            .0
            .join("alias")
            .symlink_metadata()
            .unwrap()
            .file_type()
            .is_symlink()
    );
    assert!(directories.remove_owned_empty(child).is_ok());
}

#[test]
fn absent_owned_name_after_external_removal_settles_retained_creation() {
    let fixture = Fixture::new();
    let mut directories = NativeDirectories::new();
    let base = directories
        .open_base(&fixture.0, BaseKind::Application, false)
        .unwrap();
    let child = directories.child(&base, "owned", true, true).unwrap();
    assert!(directories.auxiliary_cleanup_pending());
    assert!(!directory_removal_settled(&child).unwrap());
    std::fs::remove_dir(fixture.0.join("owned")).unwrap();
    assert!(directory_removal_settled(&child).unwrap());
    let clock = crate::service::MonotonicClock::default();
    let budget =
        super::super::paths::CleanupBudget::new(&clock, std::time::Duration::from_secs(3)).unwrap();
    assert!(directories.cleanup_auxiliary_permitted(&budget).is_ok());
    assert!(!directories.auxiliary_cleanup_pending());
    assert!(!fixture.0.join("owned").exists());
}

#[test]
fn absent_owned_name_with_renamed_live_original_stays_pending_until_restored() {
    let fixture = Fixture::new();
    let mut directories = NativeDirectories::new();
    let base = directories
        .open_base(&fixture.0, BaseKind::Application, false)
        .unwrap();
    let child = directories.child(&base, "owned", true, true).unwrap();
    std::fs::rename(fixture.0.join("owned"), fixture.0.join("moved")).unwrap();
    assert!(!directory_removal_settled(&child).unwrap());
    let clock = crate::service::MonotonicClock::default();
    let budget =
        super::super::paths::CleanupBudget::new(&clock, std::time::Duration::from_secs(3)).unwrap();
    assert_eq!(
        directories.cleanup_auxiliary_permitted(&budget),
        Err(PathFailure::Identity)
    );
    assert!(directories.auxiliary_cleanup_pending());
    assert!(fixture.0.join("moved").is_dir());
    assert!(!fixture.0.join("owned").exists());
    std::fs::rename(fixture.0.join("moved"), fixture.0.join("owned")).unwrap();
    assert!(directories.cleanup_auxiliary_permitted(&budget).is_ok());
    assert!(!directories.auxiliary_cleanup_pending());
    assert!(!fixture.0.join("owned").exists());
}
