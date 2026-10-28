//! Win32 directory handles only. `windows-source-check` never executes this module.
#![cfg_attr(
    not(windows),
    expect(
        dead_code,
        reason = "foreign-host source-preparation compiles Windows directory ABI declarations without invoking native paths"
    )
)]
use super::creation::{Created, CreationBook, CreationLease, Mode, Token, create_and_acquire};
use super::paths::{BaseKind, CleanupPermit, DirectoryIdentity, DirectoryOps, NonceSource};
use super::policy::{PathFailure, WorkPermit};
use std::{
    ffi::c_void,
    mem::{size_of, zeroed},
    path::{Component, Path, PathBuf},
    ptr::{null, null_mut},
    sync::{Arc, OnceLock},
};
use windows_sys::Win32::{
    Foundation::*,
    Security::{Authorization::*, *},
    Storage::FileSystem::*,
    System::{SystemServices::*, Threading::*, WindowsProgramming::*},
};
struct Handle(HANDLE);
// SAFETY: a unique owning wrapper closes a thread-independent directory handle.
unsafe impl Send for Handle {}
unsafe impl Sync for Handle {}
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}
struct Local(*mut c_void);
impl Drop for Local {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0);
        }
    }
}
#[derive(Clone)]
pub(super) struct Lease(Arc<Directory>);
struct Directory {
    handle: OnceLock<Option<Handle>>,
    path: PathBuf,
    identity: OnceLock<DirectoryIdentity>,
    token: OnceLock<Token>,
    parent: Option<Lease>,
    private: bool,
}
#[derive(Default)]
pub(super) struct NativeDirectories {
    probe: Option<Probe>,
    creations: CreationBook<Lease>,
}
struct Probe {
    directory: Lease,
    path: Vec<u16>,
    handle: Option<Handle>,
}
fn failure() -> PathFailure {
    match unsafe { GetLastError() } {
        ERROR_ACCESS_DENIED | ERROR_PRIVILEGE_NOT_HELD => PathFailure::Permission,
        ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND => PathFailure::Missing,
        ERROR_ALREADY_EXISTS | ERROR_FILE_EXISTS => PathFailure::Collision,
        ERROR_SHARING_VIOLATION | ERROR_LOCK_VIOLATION | ERROR_DIR_NOT_EMPTY => PathFailure::Busy,
        _ => PathFailure::Interrupted,
    }
}
fn wide(path: &Path) -> Result<Vec<u16>, PathFailure> {
    let text = path.to_str().ok_or(PathFailure::Invalid)?;
    if text.contains('\0') {
        return Err(PathFailure::Invalid);
    }
    Ok(text.encode_utf16().chain([0]).collect())
}
fn info(handle: &Handle) -> Result<BY_HANDLE_FILE_INFORMATION, PathFailure> {
    let mut value = unsafe { zeroed() };
    if unsafe { GetFileInformationByHandle(handle.0, &mut value) } == 0 {
        return Err(failure());
    }
    Ok(value)
}
fn identity(value: &BY_HANDLE_FILE_INFORMATION) -> DirectoryIdentity {
    DirectoryIdentity(
        u64::from(value.dwVolumeSerialNumber),
        (u64::from(value.nFileIndexHigh) << 32) | u64::from(value.nFileIndexLow),
    )
}
fn directory(value: &BY_HANDLE_FILE_INFORMATION) -> Result<(), PathFailure> {
    if value.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0
        || value.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
    {
        Err(PathFailure::Identity)
    } else {
        Ok(())
    }
}
fn check_probe_work(permit: Option<&dyn WorkPermit>) -> Result<(), PathFailure> {
    permit.map_or(Ok(()), super::policy::check)
}
fn info_permitted(
    handle: &Handle,
    permit: Option<&dyn WorkPermit>,
) -> Result<BY_HANDLE_FILE_INFORMATION, PathFailure> {
    check_probe_work(permit)?;
    let value = info(handle)?;
    check_probe_work(permit)?;
    Ok(value)
}
fn security(
    handle: &Handle,
    private: bool,
    permit: Option<&dyn WorkPermit>,
) -> Result<(), PathFailure> {
    // Buffers/pointers are live through each synchronous FFI call. GetSecurityInfo
    // owns an independent LocalFree buffer; TOKEN_USER storage stays aligned/live.
    unsafe {
        check_probe_work(permit)?;
        let mut raw = null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut raw) == 0 {
            return Err(failure());
        }
        let token = Handle(raw);
        check_probe_work(permit)?;
        let mut length = 0;
        GetTokenInformation(token.0, TokenUser, null_mut(), 0, &mut length);
        check_probe_work(permit)?;
        if length == 0 || length > 65536 {
            return Err(PathFailure::Permission);
        }
        let mut storage = vec![0usize; (length as usize).div_ceil(size_of::<usize>())];
        check_probe_work(permit)?;
        if GetTokenInformation(
            token.0,
            TokenUser,
            storage.as_mut_ptr().cast(),
            length,
            &mut length,
        ) == 0
        {
            return Err(failure());
        }
        check_probe_work(permit)?;
        let user = (*storage.as_ptr().cast::<TOKEN_USER>()).User.Sid;
        let (mut owner, mut acl, mut descriptor) = (null_mut(), null_mut(), null_mut());
        if GetSecurityInfo(
            handle.0,
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            null_mut(),
            &mut acl,
            null_mut(),
            &mut descriptor,
        ) != ERROR_SUCCESS
        {
            return Err(PathFailure::Permission);
        }
        let _descriptor = Local(descriptor);
        check_probe_work(permit)?;
        if owner.is_null()
            || acl.is_null()
            || IsValidAcl(acl) == 0
            || IsValidSid(owner) == 0
            || IsValidSid(user) == 0
        {
            return Err(PathFailure::Permission);
        }
        let current = |sid| EqualSid(sid, user) != 0;
        let privileged = |sid| {
            IsWellKnownSid(sid, WinLocalSystemSid) != 0
                || IsWellKnownSid(sid, WinBuiltinAdministratorsSid) != 0
        };
        if !current(owner) && (private || !privileged(owner)) {
            return Err(PathFailure::Permission);
        }
        check_probe_work(permit)?;
        let mut control = 0;
        let mut revision = 0;
        if GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) == 0
            || (private && control & SE_DACL_PROTECTED == 0)
        {
            return Err(PathFailure::Permission);
        }
        check_probe_work(permit)?;
        if (*acl).AceCount > 128 {
            return Err(PathFailure::Permission);
        }
        let mut granted = false;
        for index in 0..u32::from((*acl).AceCount) {
            check_probe_work(permit)?;
            let mut ace = null_mut();
            if GetAce(acl, index, &mut ace) == 0 || ace.is_null() {
                return Err(PathFailure::Permission);
            }
            let header = &*ace.cast::<ACE_HEADER>();
            if header.AceFlags & INHERIT_ONLY_ACE as u8 != 0 {
                continue;
            }
            if header.AceType == ACCESS_DENIED_ACE_TYPE as u8 {
                continue;
            }
            if header.AceType != ACCESS_ALLOWED_ACE_TYPE as u8
                || usize::from(header.AceSize)
                    < std::mem::offset_of!(ACCESS_ALLOWED_ACE, SidStart) + 8
            {
                return Err(PathFailure::Permission);
            }
            let allow = &*ace.cast::<ACCESS_ALLOWED_ACE>();
            let sid = std::ptr::addr_of!(allow.SidStart).cast_mut().cast();
            if IsValidSid(sid) == 0
                || std::mem::offset_of!(ACCESS_ALLOWED_ACE, SidStart) + GetLengthSid(sid) as usize
                    > usize::from(header.AceSize)
            {
                return Err(PathFailure::Permission);
            }
            // Creating an unrelated child in a shared ancestor grants no
            // authority over an existing child. Its owner/DACL/identity is
            // checked independently and every held ancestor excludes deletion.
            let writes = allow.Mask
                & (GENERIC_ALL
                    | GENERIC_WRITE
                    | DELETE
                    | WRITE_DAC
                    | WRITE_OWNER
                    | FILE_WRITE_ATTRIBUTES
                    | FILE_WRITE_EA
                    | FILE_DELETE_CHILD)
                != 0;
            if current(sid) {
                granted = true;
            } else if private || (writes && !privileged(sid)) {
                return Err(PathFailure::Permission);
            }
        }
        if private && !granted {
            return Err(PathFailure::Permission);
        }
    }
    Ok(())
}
impl NativeDirectories {
    fn open(
        &mut self,
        path: PathBuf,
        parent: Option<Lease>,
        create: bool,
        fresh: bool,
        private: bool,
        permit: Option<&dyn WorkPermit>,
    ) -> Result<Lease, PathFailure> {
        if let Some(parent) = &parent {
            self.verify(parent)?;
        }
        let name = wide(&path)?;
        // Allocation/security descriptor preparation precede reservation/native create.
        let descriptor = if create {
            Some(
                crate::service::windows_native::private_security()
                    .map_err(|_| PathFailure::Permission)?,
            )
        } else {
            None
        };
        let lease = Lease(Arc::new(Directory {
            handle: OnceLock::new(),
            path,
            identity: OnceLock::new(),
            token: OnceLock::new(),
            parent,
            private,
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
                let descriptor = descriptor.as_ref().ok_or(PathFailure::Policy)?;
                let attrs = SECURITY_ATTRIBUTES {
                    nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                    lpSecurityDescriptor: descriptor.0,
                    bInheritHandle: 0,
                };
                if unsafe { CreateDirectoryW(name.as_ptr(), &attrs) } != 0 {
                    Ok(Created::New)
                } else if !fresh && unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
                    Ok(Created::Existing)
                } else {
                    Err(failure())
                }
            },
            |lease| {
                let raw = unsafe {
                    CreateFileW(
                        name.as_ptr(),
                        FILE_READ_ATTRIBUTES | READ_CONTROL | if private { DELETE } else { 0 },
                        FILE_SHARE_READ | FILE_SHARE_WRITE,
                        null(),
                        OPEN_EXISTING,
                        FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                        null_mut(),
                    )
                };
                if raw == INVALID_HANDLE_VALUE {
                    return Err(failure());
                }
                // Retain the initial handle before stat/security can fail.
                lease
                    .0
                    .handle
                    .set(Some(Handle(raw)))
                    .map_err(|_| PathFailure::Identity)
            },
            |lease| {
                let value = info(lease.handle()?)?;
                lease
                    .0
                    .identity
                    .set(identity(&value))
                    .map_err(|_| PathFailure::Identity)?;
                verify_lease(lease)
            },
        )
    }
}
impl NativeDirectories {
    pub(super) fn new() -> Self {
        Self::default()
    }
    fn observe_deleted(lease: &Lease) -> Result<(), PathFailure> {
        if let Some(parent) = &lease.0.parent {
            verify_lease(parent)?;
        }
        let name = wide(&lease.0.path)?;
        let raw = unsafe {
            CreateFileW(
                name.as_ptr(),
                FILE_READ_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                null(),
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                null_mut(),
            )
        };
        let named = if raw == INVALID_HANDLE_VALUE {
            match unsafe { GetLastError() } {
                ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND => None,
                ERROR_ACCESS_DENIED => return Err(PathFailure::Busy),
                _ => return Err(failure()),
            }
        } else {
            Some(identity(&info(&Handle(raw))?))
        };
        super::paths::settled_deleted_directory(lease.id()?, named)
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
        super::policy::validate_windows_directory(path.to_str().ok_or(PathFailure::Invalid)?)?;
        let mut components = path.components();
        let Some(Component::Prefix(prefix)) = components.next() else {
            return Err(PathFailure::Invalid);
        };
        let std::path::Prefix::Disk(_) = prefix.kind() else {
            return Err(PathFailure::Policy);
        };
        if components.next() != Some(Component::RootDir) {
            return Err(PathFailure::Invalid);
        }
        let root = PathBuf::from(format!(
            "{}\\",
            prefix.as_os_str().to_str().ok_or(PathFailure::Invalid)?
        ));
        if unsafe { GetDriveTypeW(wide(&root)?.as_ptr()) } != DRIVE_FIXED {
            return Err(PathFailure::Policy);
        }
        let mut lease = self.open(root, None, false, false, false, permit)?;
        for component in components {
            let Component::Normal(name) = component else {
                return Err(PathFailure::Invalid);
            };
            lease = self.open(
                lease.0.path.join(name),
                Some(lease),
                create && matches!(kind, BaseKind::Application),
                false,
                false,
                permit,
            )?;
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
        self.open(
            parent.0.path.join(name),
            Some(parent.clone()),
            create,
            fresh,
            true,
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
                let path = lease.0.path.join(format!("probe_{nonce}"));
                let name = wide(&path)?;
                let descriptor = crate::service::windows_native::private_security_permitted(permit)
                    .map_err(|error| match error {
                        crate::service::SupervisorError::Cancelled => PathFailure::Cancelled,
                        crate::service::SupervisorError::StartupTimeout => PathFailure::Timeout,
                        _ => PathFailure::Permission,
                    })?;
                Ok((name, descriptor))
            },
            |(name, descriptor)| {
                let attrs = SECURITY_ATTRIBUTES {
                    nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                    lpSecurityDescriptor: descriptor.0,
                    bInheritHandle: 0,
                };
                let raw = unsafe {
                    CreateFileW(
                        name.as_ptr(),
                        GENERIC_WRITE | DELETE,
                        0,
                        &attrs,
                        CREATE_NEW,
                        FILE_ATTRIBUTE_TEMPORARY
                            | FILE_FLAG_OPEN_REPARSE_POINT
                            | FILE_FLAG_DELETE_ON_CLOSE,
                        null_mut(),
                    )
                };
                if raw == INVALID_HANDLE_VALUE {
                    return Err(failure());
                }
                // Retain first; an expired postcheck cannot discard cleanup custody.
                self.probe = Some(Probe {
                    directory: lease.clone(),
                    path: name,
                    handle: Some(Handle(raw)),
                });
                super::policy::check(permit)?;
                // This remains the independent cleanup path; a WorkPermit never
                // grants deletion authority or revives a canceled operation.
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
        let Some(mut probe) = self.probe.take() else {
            return Ok(());
        };
        let result = (|| {
            self.verify(&probe.directory)?;
            // FILE_FLAG_DELETE_ON_CLOSE was set on this exclusive CREATE_NEW.
            // A subsequent observation, never another delete, settles its release.
            drop(probe.handle.take());
            let attributes = unsafe { GetFileAttributesW(probe.path.as_ptr()) };
            if attributes != INVALID_FILE_ATTRIBUTES {
                return Err(PathFailure::Busy);
            }
            match unsafe { GetLastError() } {
                ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND => Ok(()),
                ERROR_ACCESS_DENIED => Err(PathFailure::Busy),
                _ => Err(failure()),
            }
        })();
        if result.is_err() {
            self.probe = Some(probe);
        }
        result
    }
    fn remove_retained(&mut self, lease: &mut Lease) -> Result<(), PathFailure> {
        remove_lease(lease)
    }
    fn remove_owned_empty(&mut self, mut lease: Lease) -> Result<(), (PathFailure, Lease)> {
        match remove_lease(&mut lease) {
            Ok(()) => Ok(()),
            Err(error) => Err((error, lease)),
        }
    }
}

impl Lease {
    fn handle(&self) -> Result<&Handle, PathFailure> {
        self.0
            .handle
            .get()
            .and_then(Option::as_ref)
            .ok_or(PathFailure::Identity)
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
fn verify_lease(lease: &Lease) -> Result<(), PathFailure> {
    verify_lease_permitted(lease, None)
}
fn verify_lease_permitted(
    lease: &Lease,
    permit: Option<&dyn WorkPermit>,
) -> Result<(), PathFailure> {
    check_probe_work(permit)?;
    if let Some(parent) = &lease.0.parent {
        verify_lease_permitted(parent, permit)?;
    }
    let handle = lease.handle()?;
    let current = info_permitted(handle, permit)?;
    directory(&current)?;
    security(handle, lease.0.private, permit)?;
    if identity(&current) != lease.id()? {
        return Err(PathFailure::Identity);
    }
    // All ancestor/leaf handles exclude FILE_SHARE_DELETE. Verify the current
    // name as well; this metadata handle shares the owner's existing DELETE.
    let name = wide(&lease.0.path)?;
    check_probe_work(permit)?;
    let raw = unsafe {
        CreateFileW(
            name.as_ptr(),
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    if raw == INVALID_HANDLE_VALUE {
        return Err(failure());
    }
    let named_handle = Handle(raw);
    let named = info_permitted(&named_handle, permit)?;
    directory(&named)?;
    if identity(&named) != lease.id()? {
        return Err(PathFailure::Identity);
    }
    Ok(())
}

fn name_absent(lease: &Lease) -> Result<bool, PathFailure> {
    if let Some(parent) = &lease.0.parent {
        verify_lease(parent)?;
    }
    let name = wide(&lease.0.path)?;
    // Read-only attributes can prove absence only, never acquire deletion authority.
    if unsafe { GetFileAttributesW(name.as_ptr()) } != INVALID_FILE_ATTRIBUTES {
        return Ok(false);
    }
    match unsafe { GetLastError() } {
        ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND => Ok(true),
        ERROR_ACCESS_DENIED => Err(PathFailure::Busy),
        _ => Err(failure()),
    }
}
fn remove_lease(lease: &mut Lease) -> Result<(), PathFailure> {
    if lease.0.handle.get().is_some_and(Option::is_none) {
        return NativeDirectories::observe_deleted(lease);
    }
    verify_lease(lease)?;
    if Arc::strong_count(&lease.0) != 1 {
        return Err(PathFailure::Busy);
    }
    let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
    if unsafe {
        SetFileInformationByHandle(
            lease.handle()?.0,
            FileDispositionInfo,
            std::ptr::addr_of!(disposition).cast(),
            size_of::<FILE_DISPOSITION_INFO>() as u32,
        )
    } == 0
    {
        return Err(failure());
    }
    let directory = Arc::get_mut(&mut lease.0).ok_or(PathFailure::Busy)?;
    drop(directory.handle.take());
    directory
        .handle
        .set(None)
        .map_err(|_| PathFailure::Identity)?;
    // Only read-only settlement follows release of the original identity handle.
    NativeDirectories::observe_deleted(lease)
}
fn settle_creation(lease: &mut Lease, mode: Mode) -> Result<(), PathFailure> {
    if name_absent(lease)? {
        // A live handle excludes FILE_SHARE_DELETE. Absence cannot settle a
        // contradictory live handle; a released handle is observation-only.
        return super::creation::settle_absence(
            lease.0.handle.get().and_then(Option::as_ref).map(|_| false),
        );
    }
    // Initial open failure remains pending; no name-based reacquisition/adoption.
    let value = info(lease.handle()?)?;
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
