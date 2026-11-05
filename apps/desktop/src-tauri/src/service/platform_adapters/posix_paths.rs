//! POSIX directory leases; all calls run on the native background owner.
//! No recursive cleanup, path-following open or renderer-supplied native location.
//! Namespace mutations are serialized by the native app owner inside its private
//! 0700 workspace. POSIX unlink cannot atomically exclude another process under
//! the same UID replacing a name after verification. Namespace postchecks
//! refuse observed identity/path changes; Darwin settlement is not proof that
//! the held inode has been unlinked from every possible namespace.
#[cfg(target_os = "macos")]
#[path = "macos_sdk_alias.rs"]
mod macos_sdk_alias;
use super::creation::{Created, CreationBook, CreationLease, Mode, Token, create_and_acquire};
use super::paths::{BaseKind, CleanupPermit, DirectoryIdentity, DirectoryOps, NonceSource};
use super::policy::{PathFailure, WorkPermit};
use std::{
    ffi::CString,
    os::{
        fd::{AsRawFd, FromRawFd, OwnedFd},
        unix::ffi::OsStrExt,
    },
    path::{Component, Path, PathBuf},
    sync::{Arc, OnceLock},
};

#[derive(Default)]
pub(super) struct NativeDirectories {
    probe: Option<Probe>,
    creations: CreationBook<Lease>,
}
struct Probe {
    directory: Lease,
    name: CString,
    fd: OwnedFd,
}
#[derive(Clone)]
pub(super) struct Lease(Arc<Directory>);
struct Directory {
    fd: OnceLock<OwnedFd>,
    path: PathBuf,
    identity: OnceLock<DirectoryIdentity>,
    token: OnceLock<Token>,
    parent: Option<Lease>,
    name: Option<CString>,
    private: bool,
    shared_temp: bool,
}
fn failure() -> PathFailure {
    match std::io::Error::last_os_error().raw_os_error() {
        Some(libc::EACCES | libc::EPERM) => PathFailure::Permission,
        Some(libc::ENOENT) => PathFailure::Missing,
        Some(libc::EEXIST) => PathFailure::Collision,
        Some(libc::ENOTEMPTY | libc::EBUSY) => PathFailure::Busy,
        Some(libc::ELOOP | libc::ENOTDIR) => PathFailure::Identity,
        _ => PathFailure::Interrupted,
    }
}
fn stat(fd: &OwnedFd) -> Result<libc::stat, PathFailure> {
    // SAFETY: aligned output and a live owned descriptor for this synchronous call.
    let mut value = unsafe { std::mem::zeroed() };
    if unsafe { libc::fstat(fd.as_raw_fd(), &mut value) } != 0 {
        return Err(failure());
    }
    Ok(value)
}
#[allow(clippy::unnecessary_cast)] // libc stat widths differ on the supported POSIX targets.
fn identity(value: &libc::stat) -> DirectoryIdentity {
    DirectoryIdentity(value.st_dev as u64, value.st_ino as u64)
}
fn allowed(value: &libc::stat, private: bool, shared_temp: bool) -> Result<(), PathFailure> {
    let uid = unsafe { libc::geteuid() };
    if value.st_mode & libc::S_IFMT != libc::S_IFDIR {
        return Err(PathFailure::Identity);
    }
    if private {
        if value.st_uid != uid || value.st_mode & 0o077 != 0 {
            return Err(PathFailure::Permission);
        }
    } else if (value.st_uid != uid && value.st_uid != 0)
        || (value.st_mode & 0o022 != 0 && !(shared_temp && value.st_mode & libc::S_ISVTX != 0))
    {
        return Err(PathFailure::Permission);
    }
    Ok(())
}
fn cstring(bytes: &[u8]) -> Result<CString, PathFailure> {
    CString::new(bytes).map_err(|_| PathFailure::Invalid)
}
struct Access {
    private: bool,
    shared_temp: bool,
}
impl NativeDirectories {
    pub(super) fn new() -> Self {
        Self::default()
    }
    fn at(
        &mut self,
        parent: &Lease,
        name: CString,
        create: bool,
        fresh: bool,
        access: Access,
        permit: Option<&dyn WorkPermit>,
    ) -> Result<Lease, PathFailure> {
        let Access {
            private,
            shared_temp,
        } = access;
        verify_lease_permitted(parent, permit)?;
        let path = parent
            .0
            .path
            .join(std::ffi::OsStr::from_bytes(name.to_bytes()));
        let lease = Lease(Arc::new(Directory {
            fd: OnceLock::new(),
            path,
            identity: OnceLock::new(),
            token: OnceLock::new(),
            parent: Some(parent.clone()),
            name: Some(name),
            private,
            shared_temp,
        }));
        let mode = if !create {
            Mode::Existing
        } else if fresh {
            Mode::Temporary
        } else {
            Mode::Persistent
        };
        create_and_acquire(
            &mut self.creations,
            lease.clone(),
            mode,
            permit,
            || {
                if unsafe {
                    libc::mkdirat(
                        parent.fd()?.as_raw_fd(),
                        lease.0.name.as_ref().ok_or(PathFailure::Invalid)?.as_ptr(),
                        0o700,
                    )
                } == 0
                {
                    Ok(Created::New)
                } else if !fresh
                    && std::io::Error::last_os_error().raw_os_error() == Some(libc::EEXIST)
                {
                    Ok(Created::Existing)
                } else {
                    Err(failure())
                }
            },
            |lease| {
                let raw = unsafe {
                    libc::openat(
                        parent.fd()?.as_raw_fd(),
                        lease.0.name.as_ref().ok_or(PathFailure::Invalid)?.as_ptr(),
                        libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                    )
                };
                if raw < 0 {
                    return Err(failure());
                }
                // First acquisition is retained before any fallible stat/security.
                lease
                    .0
                    .fd
                    .set(unsafe { OwnedFd::from_raw_fd(raw) })
                    .map_err(|_| PathFailure::Identity)
            },
            |lease| {
                let value = stat_permitted(lease.fd()?, permit)?;
                lease
                    .0
                    .identity
                    .set(identity(&value))
                    .map_err(|_| PathFailure::Identity)?;
                verify_lease_permitted(lease, permit)
            },
        )
    }
}
impl NativeDirectories {
    fn open_base_permit(
        &mut self,
        path: &Path,
        kind: BaseKind,
        create: bool,
        permit: Option<&dyn WorkPermit>,
    ) -> Result<Lease, PathFailure> {
        if !path.is_absolute() || path.components().count() > 64 {
            return Err(PathFailure::Invalid);
        }
        #[cfg(target_os = "macos")]
        let normalized = macos_sdk_alias::normalize_sdk_root(path, permit)?;
        #[cfg(target_os = "macos")]
        let path = normalized.as_path();
        check_probe_work(permit)?;
        let raw = unsafe {
            libc::open(
                c"/".as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            )
        };
        if raw < 0 {
            return Err(failure());
        }
        let fd = unsafe { OwnedFd::from_raw_fd(raw) };
        let value = stat_permitted(&fd, permit)?;
        allowed(&value, false, false)?;
        let mut lease = Lease(Arc::new(Directory {
            fd: OnceLock::from(fd),
            path: PathBuf::from("/"),
            identity: OnceLock::from(identity(&value)),
            token: OnceLock::new(),
            parent: None,
            name: None,
            private: false,
            shared_temp: false,
        }));
        let components = path
            .components()
            .filter(|c| !matches!(c, Component::RootDir))
            .collect::<Vec<_>>();
        if components.is_empty() {
            return Err(PathFailure::Invalid);
        }
        for (index, component) in components.iter().enumerate() {
            let Component::Normal(name) = component else {
                return Err(PathFailure::Invalid);
            };
            let final_component = index + 1 == components.len();
            let shared = matches!(kind, BaseKind::SharedTemporary);
            lease = self.at(
                &lease,
                cstring(name.as_bytes())?,
                create && !shared,
                false,
                Access {
                    private: false,
                    shared_temp: shared,
                },
                permit,
            )?;
            if final_component
                && !shared
                && stat_permitted(lease.fd()?, permit)?.st_uid != unsafe { libc::geteuid() }
            {
                return Err(PathFailure::Permission);
            }
        }
        Ok(lease)
    }
    fn child_permit(
        &mut self,
        parent: &Lease,
        name: &str,
        create: bool,
        fresh: bool,
        permit: Option<&dyn WorkPermit>,
    ) -> Result<Lease, PathFailure> {
        if !super::policy::valid_segment(name) {
            return Err(PathFailure::Invalid);
        }
        self.at(
            parent,
            cstring(name.as_bytes())?,
            create,
            fresh,
            Access {
                private: true,
                shared_temp: false,
            },
            permit,
        )
    }
}
impl DirectoryOps for NativeDirectories {
    type Lease = Lease;
    fn open_base(
        &mut self,
        path: &Path,
        kind: BaseKind,
        create: bool,
    ) -> Result<Lease, PathFailure> {
        self.open_base_permit(path, kind, create, None)
    }
    fn open_base_permitted(
        &mut self,
        path: &Path,
        kind: BaseKind,
        create: bool,
        permit: &impl WorkPermit,
    ) -> Result<Lease, PathFailure> {
        self.open_base_permit(path, kind, create, Some(permit))
    }
    fn child(
        &mut self,
        parent: &Lease,
        name: &str,
        create: bool,
        fresh: bool,
    ) -> Result<Lease, PathFailure> {
        self.child_permit(parent, name, create, fresh, None)
    }
    fn child_permitted(
        &mut self,
        parent: &Lease,
        name: &str,
        create: bool,
        fresh: bool,
        permit: &impl WorkPermit,
    ) -> Result<Lease, PathFailure> {
        self.child_permit(parent, name, create, fresh, Some(permit))
    }
    fn register_owned(&mut self, lease: &Lease) -> Result<(), PathFailure> {
        self.creations.acknowledge(lease)
    }
    fn cleanup_auxiliary_permitted(
        &mut self,
        permit: &impl CleanupPermit,
    ) -> Result<(), PathFailure> {
        permit.check_cleanup()?;
        let first = self.cleanup_auxiliary().err();
        let other = self
            .creations
            .cleanup(permit, |lease, _, mode| settle_creation(lease, mode));
        first.map_or(other, Err)
    }
    fn verify(&mut self, lease: &Lease) -> Result<(), PathFailure> {
        verify_lease(lease)
    }
    fn identity(&self, lease: &Lease) -> DirectoryIdentity {
        lease.id().expect("validated native lease")
    }
    fn same_or_ancestor(&self, ancestor: &Lease, descendant: &Lease) -> bool {
        let mut current = Some(descendant);
        while let Some(lease) = current {
            if lease.0.identity.get() == ancestor.0.identity.get() {
                return true;
            }
            current = lease.0.parent.as_ref();
        }
        false
    }
    fn location<'a>(&self, lease: &'a Lease) -> &'a Path {
        &lease.0.path
    }
    fn writable_probe(
        &mut self,
        lease: &Lease,
        permit: &impl WorkPermit,
    ) -> Result<bool, PathFailure> {
        super::paths::admit_writable_probe(
            permit,
            || {
                verify_lease_permitted(lease, Some(permit))?;
                let nonce = super::native::RandomNonces.next()?;
                super::policy::check(permit)?;
                cstring(format!("probe_{nonce}").as_bytes())
            },
            |name| {
                let raw = unsafe {
                    libc::openat(
                        lease.fd()?.as_raw_fd(),
                        name.as_ptr(),
                        libc::O_WRONLY
                            | libc::O_CREAT
                            | libc::O_EXCL
                            | libc::O_NOFOLLOW
                            | libc::O_CLOEXEC,
                        0o600,
                    )
                };
                if raw < 0 {
                    return Err(failure());
                }
                let fd = unsafe { OwnedFd::from_raw_fd(raw) };
                // Retain first; an expired postcheck cannot discard cleanup custody.
                self.probe = Some(Probe {
                    directory: lease.clone(),
                    name,
                    fd,
                });
                super::policy::check(permit)?;
                // Cleanup keeps its independent permission path, never a new work lease.
                self.cleanup_auxiliary()?;
                verify_lease_permitted(lease, Some(permit))?;
                Ok(true)
            },
        )
    }

    fn auxiliary_cleanup_pending(&self) -> bool {
        self.probe.is_some() || self.creations.pending()
    }
    fn cleanup_auxiliary(&mut self) -> Result<(), PathFailure> {
        let Some(probe) = self.probe.take() else {
            return Ok(());
        };
        let result = (|| {
            self.verify(&probe.directory)?;
            let original = stat(&probe.fd)?;
            let mut named = unsafe { std::mem::zeroed::<libc::stat>() };
            if unsafe {
                libc::fstatat(
                    probe.directory.fd()?.as_raw_fd(),
                    probe.name.as_ptr(),
                    &mut named,
                    libc::AT_SYMLINK_NOFOLLOW,
                )
            } != 0
            {
                if std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT)
                    && original.st_nlink == 0
                {
                    return Ok(());
                }
                return Err(PathFailure::Identity);
            }
            if identity(&named) != identity(&original)
                || named.st_mode & libc::S_IFMT != libc::S_IFREG
            {
                return Err(PathFailure::Identity);
            }
            if unsafe { libc::unlinkat(probe.directory.fd()?.as_raw_fd(), probe.name.as_ptr(), 0) }
                != 0
            {
                return Err(failure());
            }
            if stat(&probe.fd)?.st_nlink != 0 {
                return Err(PathFailure::Identity);
            }
            Ok(())
        })();
        if result.is_err() {
            self.probe = Some(probe);
        }
        result
    }

    fn remove_retained(&mut self, lease: &mut Lease) -> Result<(), PathFailure> {
        remove_lease(lease)
    }
    fn remove_owned_empty(&mut self, lease: Lease) -> Result<(), (PathFailure, Lease)> {
        match remove_lease(&lease) {
            Ok(()) => Ok(()),
            Err(error) => Err((error, lease)),
        }
    }
}

impl Lease {
    fn fd(&self) -> Result<&OwnedFd, PathFailure> {
        self.0.fd.get().ok_or(PathFailure::Identity)
    }
    fn id(&self) -> Result<DirectoryIdentity, PathFailure> {
        self.0.identity.get().copied().ok_or(PathFailure::Identity)
    }
}
impl CreationLease for Lease {
    fn token(&self) -> Option<&Token> {
        self.0.token.get()
    }
    fn set_token(&self, token: Token) -> Result<(), PathFailure> {
        self.0.token.set(token).map_err(|_| PathFailure::Identity)
    }
}
fn check_probe_work(permit: Option<&dyn WorkPermit>) -> Result<(), PathFailure> {
    permit.map_or(Ok(()), super::policy::check)
}
fn stat_permitted(
    fd: &OwnedFd,
    permit: Option<&dyn WorkPermit>,
) -> Result<libc::stat, PathFailure> {
    check_probe_work(permit)?;
    let value = stat(fd)?;
    check_probe_work(permit)?;
    Ok(value)
}
fn verify_lease(lease: &Lease) -> Result<(), PathFailure> {
    verify_lease_permitted(lease, None)
}
fn verify_lease_permitted(
    lease: &Lease,
    permit: Option<&dyn WorkPermit>,
) -> Result<(), PathFailure> {
    check_probe_work(permit)?;
    let value = stat_permitted(lease.fd()?, permit)?;
    allowed(&value, lease.0.private, lease.0.shared_temp)?;
    if identity(&value) != lease.id()? {
        return Err(PathFailure::Identity);
    }
    if let (Some(parent), Some(name)) = (&lease.0.parent, &lease.0.name) {
        verify_lease_permitted(parent, permit)?;
        let mut named = unsafe { std::mem::zeroed::<libc::stat>() };
        check_probe_work(permit)?;
        if unsafe {
            libc::fstatat(
                parent.fd()?.as_raw_fd(),
                name.as_ptr(),
                &mut named,
                libc::AT_SYMLINK_NOFOLLOW,
            )
        } != 0
        {
            return Err(failure());
        }
        check_probe_work(permit)?;
        if identity(&named) != lease.id()? || named.st_mode & libc::S_IFMT != libc::S_IFDIR {
            return Err(PathFailure::Identity);
        }
    }
    Ok(())
}

fn name_absent(lease: &Lease) -> Result<bool, PathFailure> {
    let parent = lease.0.parent.as_ref().ok_or(PathFailure::Policy)?;
    verify_lease(parent)?;
    let name = lease.0.name.as_ref().ok_or(PathFailure::Policy)?;
    let mut named = unsafe { std::mem::zeroed::<libc::stat>() };
    if unsafe {
        libc::fstatat(
            parent.fd()?.as_raw_fd(),
            name.as_ptr(),
            &mut named,
            libc::AT_SYMLINK_NOFOLLOW,
        )
    } == 0
    {
        return Ok(false);
    }
    if std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT) {
        Ok(true)
    } else {
        Err(failure())
    }
}
/// Directory settlement is OS-specific. Darwin/APFS can retain both st_nlink
/// and F_GETPATH after rmdir. Its private-owner contract therefore settles an
/// observed missing owned name whose held child path still matches the held
/// parent's current path plus that exact basename. This is namespace settlement,
/// never an inode-unlinked proof or prevention of hostile same-UID interference.
fn directory_removal_settled(lease: &Lease) -> Result<bool, PathFailure> {
    #[cfg(target_os = "macos")]
    {
        let value = stat(lease.fd()?)?;
        allowed(&value, lease.0.private, lease.0.shared_temp)?;
        if lease
            .0
            .identity
            .get()
            .is_some_and(|id| *id != identity(&value))
        {
            return Err(PathFailure::Identity);
        }
        if !name_absent(lease)? {
            return Ok(false);
        }
        let parent = lease.0.parent.as_ref().ok_or(PathFailure::Policy)?;
        let name = lease.0.name.as_ref().ok_or(PathFailure::Policy)?;
        let expected =
            darwin_held_path(parent.fd()?)?.join(std::ffi::OsStr::from_bytes(name.to_bytes()));
        if darwin_held_path(lease.fd()?)? != expected {
            return Ok(false);
        }
        // Revalidate parent/name after the two read-only kernel path observations.
        // Neither observed path is opened or converted into deletion authority.
        name_absent(lease)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(stat(lease.fd()?)?.st_nlink == 0)
    }
}
#[cfg(target_os = "macos")]
fn darwin_held_path(fd: &OwnedFd) -> Result<PathBuf, PathFailure> {
    let mut bytes = [0u8; libc::PATH_MAX as usize];
    // SAFETY: live owned descriptor and writable PATH_MAX-byte output. The
    // constant and buffer contract are from the pinned Darwin SDK/libc headers.
    if unsafe {
        libc::fcntl(
            fd.as_raw_fd(),
            libc::F_GETPATH_NOFIRMLINK,
            bytes.as_mut_ptr().cast::<libc::c_char>(),
        )
    } < 0
    {
        return Err(failure());
    }
    let name = std::ffi::CStr::from_bytes_until_nul(&bytes).map_err(|_| PathFailure::Identity)?;
    let path = PathBuf::from(std::ffi::OsStr::from_bytes(name.to_bytes()));
    if !path.is_absolute() {
        return Err(PathFailure::Identity);
    }
    Ok(path)
}
fn remove_lease(lease: &Lease) -> Result<(), PathFailure> {
    verify_lease(lease)?;
    let parent = lease.0.parent.as_ref().ok_or(PathFailure::Policy)?;
    let name = lease.0.name.as_ref().ok_or(PathFailure::Policy)?;
    #[cfg(test)]
    cleanup_tests::after_verify(lease);
    if unsafe { libc::unlinkat(parent.fd()?.as_raw_fd(), name.as_ptr(), libc::AT_REMOVEDIR) } != 0 {
        return Err(failure());
    }
    // The name-based delete is not an atomic inode predicate on POSIX. Require
    // the platform's bounded settlement observation before releasing custody.
    if !directory_removal_settled(lease)? {
        return Err(PathFailure::Identity);
    }
    Ok(())
}
fn settle_creation(lease: &mut Lease, mode: Mode) -> Result<(), PathFailure> {
    if name_absent(lease)? {
        if lease.0.fd.get().is_none() {
            return super::creation::settle_absence(None);
        }
        // Darwin's explicit namespace settlement is weaker than the shared
        // held-inode-unlinked predicate. Do not pass it off as that proof.
        return if directory_removal_settled(lease)? {
            Ok(())
        } else {
            Err(PathFailure::Identity)
        };
    }
    // Never acquire a new deletion identity by name after initial open failed.
    let value = stat(lease.fd()?)?;
    if lease.0.identity.get().is_none() {
        lease
            .0
            .identity
            .set(identity(&value))
            .map_err(|_| PathFailure::Identity)?;
    }
    verify_lease(lease)?;
    if mode == Mode::Temporary {
        remove_lease(lease)
    } else {
        Ok(())
    }
}

#[cfg(test)]
#[path = "posix_cleanup_tests.rs"]
mod cleanup_tests;
