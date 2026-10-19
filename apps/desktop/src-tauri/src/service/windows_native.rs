//! Windows-only owned job and deadline-bounded private transport.
//! `windows-source-check` type-checks this code on the current host, never executes it.
//! FFI safety: every handle has one RAII owner; borrowed arrays/NUL-terminated
//! UTF16 paths outlive each call, C structs are correctly aligned and initialized,
//! and OVERLAPPED/buffers stay pinned until observed completion. The final-Drop
//! retention fallback deliberately avoids freeing kernel-referenced memory.
//! Native Windows behavior remains unexecuted and requires independent review.
#![cfg_attr(
    not(windows),
    expect(
        dead_code,
        reason = "foreign-host windows-source-check compiles actual Windows ABI declarations without executing them; actual Windows spawn owns these paths"
    )
)]
use super::windows_policy::{
    ReadyDecoder, cleanup_status, create_and_release_attributes, inherited_handles, inventory_key,
    launch_plan, opened_directory, resolve_immediate_overlapped_completion,
};
use super::{Bootstrap, OwnedProcess, ReadyFrame, SpawnPermit, SupervisorError};
use std::{
    ffi::c_void,
    mem::{size_of, zeroed},
    path::Path,
    ptr::{null, null_mut},
    sync::Arc,
    time::Duration,
};
use windows_sys::Win32::{
    Foundation::*,
    Security::{Authorization::*, *},
    Storage::FileSystem::*,
    System::{IO::*, JobObjects::*, Pipes::*, Threading::*},
};

struct Handle(HANDLE);
// SAFETY: owned kernel handles are thread-independent. Mutation/I/O ownership is
// held by NativeChild; Arc only keeps a handle alive for a pending operation.
unsafe impl Send for Handle {}
unsafe impl Sync for Handle {}
impl Handle {
    fn new(value: HANDLE) -> Result<Self, SupervisorError> {
        if value.is_null() || value == INVALID_HANDLE_VALUE {
            Err(SupervisorError::SpawnFailed)
        } else {
            Ok(Self(value))
        }
    }
}
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
fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain([0]).collect()
}
fn private_security() -> Result<Local, SupervisorError> {
    // A pipe is created already connected by its native owner, with a DACL for
    // this exact token user. No name, access token or listener reaches the child.
    unsafe {
        let mut token = null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let token = Handle::new(token)?;
        let mut bytes = 0;
        GetTokenInformation(token.0, TokenUser, null_mut(), 0, &mut bytes);
        if bytes == 0 || bytes > 65536 {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let mut storage = vec![0usize; (bytes as usize).div_ceil(size_of::<usize>())];
        if GetTokenInformation(
            token.0,
            TokenUser,
            storage.as_mut_ptr().cast(),
            bytes,
            &mut bytes,
        ) == 0
        {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let user = &*storage.as_ptr().cast::<TOKEN_USER>();
        let mut sid = null_mut();
        if ConvertSidToStringSidW(user.User.Sid, &mut sid) == 0 {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let sid_owner = Local(sid.cast());
        let mut length = 0;
        while length < 256 && *sid.add(length) != 0 {
            length += 1
        }
        if length == 256 {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let sid = String::from_utf16(std::slice::from_raw_parts(sid, length))
            .map_err(|_| SupervisorError::ContainmentUnavailable)?;
        let descriptor = wide(&format!("D:P(A;;GA;;;{sid})"));
        let mut security = null_mut();
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(
            descriptor.as_ptr(),
            SDDL_REVISION_1,
            &mut security,
            null_mut(),
        ) == 0
        {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        drop(sid_owner);
        Ok(Local(security))
    }
}
struct IoStorage {
    pipe: Arc<Handle>,
    _event: Handle,
    overlapped: Box<OVERLAPPED>,
    bytes: Vec<u8>,
    done: bool,
    transferred: u32,
}
fn observe_io(s: &mut IoStorage) -> Result<Option<u32>, SupervisorError> {
    if s.done {
        return Ok(Some(s.transferred));
    }
    if unsafe { GetOverlappedResult(s.pipe.0, &*s.overlapped, &mut s.transferred, 0) } != 0 {
        s.done = true;
        return Ok(Some(s.transferred));
    }
    let error = unsafe { GetLastError() };
    if error == ERROR_IO_INCOMPLETE || error == ERROR_IO_PENDING {
        return Ok(None);
    }
    s.done = true;
    Err(SupervisorError::ProtocolRejected)
}
struct Pending(Option<Box<IoStorage>>);
impl Pending {
    fn new(pipe: Arc<Handle>, bytes: Vec<u8>) -> Result<Self, SupervisorError> {
        let event = Handle::new(unsafe { CreateEventW(null(), 1, 0, null()) })?;
        let mut overlapped: Box<OVERLAPPED> = Box::new(unsafe { zeroed() });
        overlapped.hEvent = event.0;
        Ok(Self(Some(Box::new(IoStorage {
            pipe,
            _event: event,
            overlapped,
            bytes,
            done: false,
            transferred: 0,
        }))))
    }
    fn start(mut self, kind: u8) -> Result<Self, SupervisorError> {
        let s = self.0.as_mut().expect("operation storage");
        let result = unsafe {
            match kind {
                0 => ReadFile(
                    s.pipe.0,
                    s.bytes.as_mut_ptr(),
                    s.bytes.len() as u32,
                    null_mut(),
                    &mut *s.overlapped,
                ),
                1 => WriteFile(
                    s.pipe.0,
                    s.bytes.as_ptr(),
                    s.bytes.len() as u32,
                    null_mut(),
                    &mut *s.overlapped,
                ),
                _ => ConnectNamedPipe(s.pipe.0, &mut *s.overlapped),
            }
        };
        if result != 0 {
            let reported = s.transferred;
            if let Some(count) =
                resolve_immediate_overlapped_completion(reported, || observe_io(s))?
            {
                s.transferred = count;
                s.done = true;
            }
            return Ok(self);
        }
        let error = unsafe { GetLastError() };
        if kind == 2 && error == ERROR_PIPE_CONNECTED {
            s.done = true;
            return Ok(self);
        }
        if error == ERROR_IO_PENDING {
            return Ok(self);
        }
        s.done = true;
        Err(SupervisorError::BootstrapFailed)
    }
    fn poll(&mut self) -> Result<Option<u32>, SupervisorError> {
        observe_io(self.0.as_mut().expect("operation storage"))
    }
    fn cancel(&mut self) {
        if let Some(s) = &self.0
            && !s.done
        {
            unsafe {
                CancelIoEx(s.pipe.0, &*s.overlapped);
            }
        }
    }
    fn settled(&mut self) -> bool {
        let _ = self.poll();
        self.0.as_ref().is_none_or(|s| s.done)
    }
}
impl Drop for Pending {
    fn drop(&mut self) {
        self.cancel();
        let _ = self.poll();
        if let Some(s) = self.0.take()
            && !s.done
        {
            // CancelIoEx does not establish completion. Never free memory the
            // kernel may still reference. This conservative final-Drop fallback
            // retains one <=4100-byte operation allocation/handle, not a worker.
            // Explicit cleanup reports Pending and retains NativeChild instead.
            // Job Drop still terminates members; this is never cleanup success.
            std::mem::forget(s);
        }
    }
}
struct Pipe {
    owner: Arc<Handle>,
    child: Option<Handle>,
    pending: Option<Pending>,
}
fn pipe(parent_writes: bool, permit: &SpawnPermit<'_>) -> Result<Pipe, SupervisorError> {
    let mut nonce = [0u8; 16];
    getrandom::fill(&mut nonce).map_err(|_| SupervisorError::EntropyUnavailable)?;
    let name = wide(&format!(
        "\\\\.\\pipe\\japp-{}",
        nonce.iter().map(|b| format!("{b:02x}")).collect::<String>()
    ));
    let security = private_security()?;
    let mut sa = SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: security.0,
        bInheritHandle: 0,
    };
    let mode = if parent_writes {
        PIPE_ACCESS_OUTBOUND
    } else {
        PIPE_ACCESS_INBOUND
    };
    let owner = Arc::new(Handle::new(unsafe {
        CreateNamedPipeW(
            name.as_ptr(),
            mode | FILE_FLAG_OVERLAPPED | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
            1,
            8192,
            8192,
            0,
            &sa,
        )
    })?);
    let mut connect = Pending::new(Arc::clone(&owner), Vec::new())?.start(2)?;
    sa.bInheritHandle = 1;
    let child = Handle::new(unsafe {
        CreateFileW(
            name.as_ptr(),
            if parent_writes {
                GENERIC_READ
            } else {
                GENERIC_WRITE
            },
            0,
            &sa,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            null_mut(),
        )
    })?;
    while connect.poll()?.is_none() {
        permit.pause(Duration::from_millis(1))?;
    }
    permit.check()?;
    Ok(Pipe {
        owner,
        child: Some(child),
        pending: None,
    })
}
impl Pipe {
    fn cancel(&mut self) {
        if let Some(p) = &mut self.pending {
            p.cancel()
        }
    }
    fn settled(&mut self) -> bool {
        self.pending.as_mut().is_none_or(Pending::settled)
    }
    fn read(&mut self) -> Result<Option<Vec<u8>>, SupervisorError> {
        if self.pending.is_none() {
            self.pending = Some(Pending::new(Arc::clone(&self.owner), vec![0; 4096])?.start(0)?)
        }
        let p = self.pending.as_mut().expect("read pending");
        let Some(count) = p.poll()? else {
            return Ok(None);
        };
        if count == 0 {
            return Err(SupervisorError::ProtocolRejected);
        }
        let mut p = self.pending.take().expect("completed read");
        let s = p.0.as_mut().expect("read storage");
        Ok(Some(s.bytes[..count as usize].to_vec()))
    }
}
struct Attributes {
    _storage: Vec<u128>,
    pointer: LPPROC_THREAD_ATTRIBUTE_LIST,
}
impl Drop for Attributes {
    fn drop(&mut self) {
        unsafe {
            DeleteProcThreadAttributeList(self.pointer);
        }
    }
}
impl Attributes {
    fn new(handles: &[HANDLE; 3], job: &HANDLE) -> Result<Self, SupervisorError> {
        let mut bytes = 0;
        unsafe {
            InitializeProcThreadAttributeList(null_mut(), 2, 0, &mut bytes);
        }
        if bytes == 0 || bytes > 65536 {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let mut storage = vec![0u128; bytes.div_ceil(size_of::<u128>())];
        let pointer = storage.as_mut_ptr().cast();
        if unsafe { InitializeProcThreadAttributeList(pointer, 2, 0, &mut bytes) } == 0 {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let value = Self {
            _storage: storage,
            pointer,
        };
        for (kind, data, len) in [
            (
                PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                handles.as_ptr().cast(),
                size_of::<[HANDLE; 3]>(),
            ),
            (
                PROC_THREAD_ATTRIBUTE_JOB_LIST,
                (job as *const HANDLE).cast(),
                size_of::<HANDLE>(),
            ),
        ] {
            if unsafe {
                UpdateProcThreadAttribute(pointer, 0, kind as usize, data, len, null_mut(), null())
            } == 0
            {
                return Err(SupervisorError::ContainmentUnavailable);
            }
        }
        Ok(value)
    }
}
struct Job(Handle);
impl Job {
    fn new() -> Result<Self, SupervisorError> {
        let job = Self(Handle::new(unsafe { CreateJobObjectW(null(), null()) })?);
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe {
            SetInformationJobObject(
                job.0.0,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        } == 0
        {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        Ok(job)
    }
    fn active(&self) -> Result<u32, SupervisorError> {
        let mut info: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { zeroed() };
        if unsafe {
            QueryInformationJobObject(
                self.0.0,
                JobObjectBasicAccountingInformation,
                (&mut info as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                null_mut(),
            )
        } == 0
        {
            return Err(SupervisorError::CleanupFailed);
        }
        Ok(info.ActiveProcesses)
    }
    fn terminate(&self) -> Result<(), SupervisorError> {
        if unsafe { TerminateJobObject(self.0.0, 70) } == 0 {
            Err(SupervisorError::CleanupFailed)
        } else {
            Ok(())
        }
    }
}

/// Lock the executable against writes/replacement through CreateProcess. The
/// final hash is checked through this same handle, not a fresh path open.
fn validate_path(path: &Path) -> Result<Handle, SupervisorError> {
    let text = path.to_str().ok_or(SupervisorError::InvalidRuntime)?;
    let plan = launch_plan(text)?;
    for end in text
        .match_indices('\\')
        .map(|(i, _)| i)
        .skip(1)
        .chain([text.len()])
    {
        let part = wide(&text[..end]);
        let attributes = unsafe { GetFileAttributesW(part.as_ptr()) };
        if attributes == INVALID_FILE_ATTRIBUTES || attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(SupervisorError::InvalidRuntime);
        }
    }
    Handle::new(unsafe {
        CreateFileW(
            plan.application.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ,
            null(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    })
    .map_err(|_| SupervisorError::InvalidRuntime)
}
fn file_info(handle: &Handle) -> Result<BY_HANDLE_FILE_INFORMATION, SupervisorError> {
    let mut info = unsafe { zeroed() };
    if unsafe { GetFileInformationByHandle(handle.0, &mut info) } == 0 {
        return Err(SupervisorError::InvalidRuntime);
    }
    Ok(info)
}
fn identity(handle: &Handle) -> Result<BY_HANDLE_FILE_INFORMATION, SupervisorError> {
    let info = file_info(handle)?;
    if opened_directory(info.dwFileAttributes)?
        || info.nFileSizeHigh != 0
        || info.nFileSizeLow > 512 * 1024 * 1024
    {
        return Err(SupervisorError::InvalidRuntime);
    }
    Ok(info)
}
fn lock_and_hash(
    path: &Path,
    expected: [u8; 32],
    permit: &SpawnPermit<'_>,
) -> Result<Handle, SupervisorError> {
    use sha2::{Digest, Sha256};
    let handle = validate_path(path)?;
    let before = identity(&handle)?;
    let mut hash = Sha256::new();
    let mut bytes = 0u64;
    let mut buffer = [0u8; 16384];
    loop {
        permit.check()?;
        let mut count = 0;
        if unsafe {
            ReadFile(
                handle.0,
                buffer.as_mut_ptr(),
                buffer.len() as u32,
                &mut count,
                null_mut(),
            )
        } == 0
        {
            return Err(SupervisorError::InvalidRuntime);
        }
        if count == 0 {
            break;
        }
        bytes += count as u64;
        if bytes > 512 * 1024 * 1024 {
            return Err(SupervisorError::InvalidRuntime);
        }
        hash.update(&buffer[..count as usize]);
    }
    let after = identity(&handle)?;
    if before.dwVolumeSerialNumber != after.dwVolumeSerialNumber
        || before.nFileIndexHigh != after.nFileIndexHigh
        || before.nFileIndexLow != after.nFileIndexLow
        || before.nFileSizeLow != after.nFileSizeLow
        || before.ftLastWriteTime.dwHighDateTime != after.ftLastWriteTime.dwHighDateTime
        || before.ftLastWriteTime.dwLowDateTime != after.ftLastWriteTime.dwLowDateTime
        || bytes != before.nFileSizeLow as u64
        || <[u8; 32]>::from(hash.finalize()) != expected
    {
        return Err(SupervisorError::InvalidRuntime);
    }
    permit.check()?;
    Ok(handle)
}
#[allow(dead_code)] // The field owns file/directory leases through the child lifetime.
pub(super) struct PayloadLocks(Vec<Handle>);
pub(super) fn lock_tree(
    root: &Path,
    permit: &SpawnPermit<'_>,
) -> Result<PayloadLocks, SupervisorError> {
    let mut handles = Vec::new();
    let mut ancestors: Vec<_> = root.ancestors().skip(1).collect();
    ancestors.reverse();
    for ancestor in ancestors {
        permit.check()?;
        let text = ancestor.to_str().ok_or(SupervisorError::InvalidRuntime)?;
        let name = wide(text);
        let attrs = unsafe { GetFileAttributesW(name.as_ptr()) };
        if attrs == INVALID_FILE_ATTRIBUTES || attrs & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(SupervisorError::InvalidRuntime);
        }
        let handle = Handle::new(unsafe {
            CreateFileW(
                name.as_ptr(),
                FILE_READ_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                null(),
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
                null_mut(),
            )
        })
        .map_err(|_| SupervisorError::InvalidRuntime)?;
        if !opened_directory(file_info(&handle)?.dwFileAttributes)? {
            return Err(SupervisorError::InvalidRuntime);
        }
        handles.push(handle);
    }
    let mut pending = vec![(root.to_path_buf(), 0usize)];
    let mut seen = std::collections::BTreeSet::new();
    while let Some((path, depth)) = pending.pop() {
        permit.check()?;
        if depth > 32 || handles.len() >= 2048 {
            return Err(SupervisorError::InvalidRuntime);
        }
        let text = path.to_str().ok_or(SupervisorError::InvalidRuntime)?;
        launch_plan(&format!("{text}\\placeholder.exe"))?;
        let name = wide(text);
        let attributes = unsafe { GetFileAttributesW(name.as_ptr()) };
        if attributes == INVALID_FILE_ATTRIBUTES || attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(SupervisorError::InvalidRuntime);
        }
        let handle = Handle::new(unsafe {
            CreateFileW(
                name.as_ptr(),
                GENERIC_READ,
                FILE_SHARE_READ,
                null(),
                OPEN_EXISTING,
                FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS,
                null_mut(),
            )
        })
        .map_err(|_| SupervisorError::InvalidRuntime)?;
        if opened_directory(file_info(&handle)?.dwFileAttributes)? {
            for child in std::fs::read_dir(&path).map_err(|_| SupervisorError::InvalidRuntime)? {
                permit.check()?;
                let child = child.map_err(|_| SupervisorError::InvalidRuntime)?.path();
                let relative = child
                    .strip_prefix(root)
                    .map_err(|_| SupervisorError::InvalidRuntime)?;
                let mut names = Vec::new();
                for component in relative.components() {
                    let std::path::Component::Normal(name) = component else {
                        return Err(SupervisorError::InvalidRuntime);
                    };
                    names.push(name.to_str().ok_or(SupervisorError::InvalidRuntime)?);
                }
                let rel = names.join("/");
                if !seen.insert(inventory_key(&rel)?) || pending.len() + handles.len() >= 2048 {
                    return Err(SupervisorError::InvalidRuntime);
                }
                pending.push((child, depth + 1));
            }
        } else {
            let _ = identity(&handle)?;
        }
        handles.push(handle);
    }
    permit.check()?;
    Ok(PayloadLocks(handles))
}
struct NativeChild {
    job: Job,
    _payload_locks: PayloadLocks,
    process: Option<Handle>,
    thread: Option<Handle>,
    input: Option<Pipe>,
    output: Pipe,
    decoder: ReadyDecoder,
    terminal: Option<i32>,
    resumed: bool,
    terminated: bool,
    closing: bool,
}
// SAFETY: native handle ownership and all operation buffers move together.
unsafe impl Send for NativeChild {}
pub(super) fn spawn(
    path: &Path,
    expected: [u8; 32],
    permit: &SpawnPermit<'_>,
    payload_locks: PayloadLocks,
) -> Result<Box<dyn OwnedProcess>, SupervisorError> {
    let _executable = lock_and_hash(path, expected, permit)?;
    let mut plan = launch_plan(path.to_str().ok_or(SupervisorError::InvalidRuntime)?)?;
    let job = Job::new()?;
    let input = pipe(true, permit)?;
    let output = pipe(false, permit)?;
    let sa = SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: null_mut(),
        bInheritHandle: 1,
    };
    let error = Handle::new(unsafe {
        CreateFileW(
            wide("NUL").as_ptr(),
            GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            &sa,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            null_mut(),
        )
    })?;
    let h = inherited_handles(
        input.child.as_ref().expect("child pipe").0 as isize,
        output.child.as_ref().expect("child pipe").0 as isize,
        error.0 as isize,
        job.0.0 as isize,
        input.owner.0 as isize,
    )?
    .map(|h| h as HANDLE);
    let mut attributes = Some(Attributes::new(&h, &job.0.0)?);
    let mut startup: STARTUPINFOEXW = unsafe { zeroed() };
    startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = h[0];
    startup.StartupInfo.hStdOutput = h[1];
    startup.StartupInfo.hStdError = h[2];
    startup.lpAttributeList = attributes.as_ref().expect("owned attribute list").pointer;
    let mut result: PROCESS_INFORMATION = unsafe { zeroed() };
    permit.check()?;
    // JOB_LIST lpValue points into `job`; delete the list while that value
    // and the explicit handle array are still in place, before moving job.
    let process_created = create_and_release_attributes(&mut attributes, || unsafe {
        CreateProcessW(
            plan.application.as_ptr(),
            plan.command_line.as_mut_ptr(),
            null(),
            null(),
            1,
            plan.flags,
            plan.environment.as_ptr().cast(),
            plan.directory.as_ptr(),
            &startup.StartupInfo,
            &mut result,
        )
    });
    if process_created == 0 {
        return Err(SupervisorError::SpawnFailed);
    }
    // From this point the suspended child is retained by Supervisor before any
    // fallible membership/permit/resume/bootstrap work. Job assignment was atomic.
    let mut child = NativeChild {
        job,
        _payload_locks: payload_locks,
        process: Some(Handle(result.hProcess)),
        thread: Some(Handle(result.hThread)),
        input: Some(input),
        output,
        decoder: ReadyDecoder::default(),
        terminal: None,
        resumed: false,
        terminated: false,
        closing: false,
    };
    child.input.as_mut().expect("input").child = None;
    child.output.child = None;
    Ok(Box::new(child))
}
impl OwnedProcess for NativeChild {
    fn observe_alive(&self) -> Result<bool, SupervisorError> {
        if self.terminal.is_some() {
            return Ok(false);
        }
        match unsafe {
            WaitForSingleObject(
                self.process
                    .as_ref()
                    .ok_or(SupervisorError::CleanupFailed)?
                    .0,
                0,
            )
        } {
            WAIT_TIMEOUT => Ok(true),
            WAIT_OBJECT_0 => Ok(false),
            _ => Err(SupervisorError::CleanupFailed),
        }
    }
    fn write_bootstrap(&mut self, _: &Bootstrap<'_>) -> Result<(), SupervisorError> {
        Err(SupervisorError::BootstrapFailed)
    }
    fn write_bootstrap_with_permit(
        &mut self,
        bootstrap: &Bootstrap<'_>,
        permit: &SpawnPermit<'_>,
    ) -> Result<(), SupervisorError> {
        if self.resumed {
            return Err(SupervisorError::BootstrapFailed);
        }
        let mut member = 0;
        if unsafe {
            IsProcessInJob(
                self.process
                    .as_ref()
                    .ok_or(SupervisorError::CleanupFailed)?
                    .0,
                self.job.0.0,
                &mut member,
            )
        } == 0
            || member == 0
        {
            return Err(SupervisorError::ContainmentUnavailable);
        }
        let mut frame = Vec::new();
        bootstrap
            .write_to(&mut frame)
            .map_err(|_| SupervisorError::BootstrapFailed)?;
        let input = self
            .input
            .as_mut()
            .ok_or(SupervisorError::BootstrapFailed)?;
        permit.check()?;
        if unsafe { ResumeThread(self.thread.as_ref().ok_or(SupervisorError::SpawnFailed)?.0) } != 1
        {
            return Err(SupervisorError::SpawnFailed);
        }
        self.resumed = true;
        self.thread = None;
        permit.check()?;
        let length = frame.len() as u32;
        let operation = Pending::new(Arc::clone(&input.owner), frame)?;
        permit.check()?;
        input.pending = Some(operation.start(1)?);
        loop {
            if let Err(error) = permit.check() {
                input.cancel();
                return Err(error);
            }
            match input
                .pending
                .as_mut()
                .expect("bootstrap pending")
                .poll()
                .map_err(|_| SupervisorError::BootstrapFailed)?
            {
                Some(n) if n == length => {
                    input.pending = None;
                    permit.check()?;
                    return Ok(());
                }
                Some(_) => return Err(SupervisorError::BootstrapFailed),
                None => permit.pause(Duration::from_millis(1))?,
            }
        }
    }
    fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
        match self.output.read()? {
            Some(bytes) => self.decoder.push(&bytes),
            None => Ok(None),
        }
    }
    fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
        if self.closing && self.input.as_mut().is_some_and(Pipe::settled) {
            self.input = None;
        }
        if self.terminal.is_none() {
            if self.observe_alive()? {
                return Ok(None);
            }
            let mut code = 0;
            if unsafe {
                GetExitCodeProcess(
                    self.process
                        .as_ref()
                        .ok_or(SupervisorError::CleanupFailed)?
                        .0,
                    &mut code,
                )
            } == 0
            {
                return Err(SupervisorError::CleanupFailed);
            }
            self.terminal = Some(i32::try_from(code).unwrap_or(70));
            self.process = None;
            self.thread = None;
            self.terminate_owned()?;
        }
        let input_settled = self.input.as_mut().is_none_or(Pipe::settled);
        let output_settled = self.output.settled();
        cleanup_status(
            self.terminal,
            self.job.active()?,
            input_settled && output_settled,
        )
    }
    fn close_lease(&mut self) {
        self.closing = true;
        if let Some(input) = &mut self.input {
            input.cancel();
            if input.settled() {
                self.input = None
            }
        }
        self.output.cancel();
    }
    fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
        if !self.terminated {
            self.job.terminate()?;
            self.terminated = true;
        }
        if let Some(input) = &mut self.input {
            input.cancel()
        }
        self.output.cancel();
        Ok(())
    }
}
impl Drop for NativeChild {
    fn drop(&mut self) {
        if let Some(input) = &mut self.input {
            input.cancel()
        }
        self.output.cancel();
        let _ = self.job.terminate();
    }
}
