#[cfg(any(unix, test))]
use super::Bootstrap;
#[cfg(unix)]
use super::ReadyFrame;
use super::{Clock, OwnedProcess, RuntimeAdapter, ServiceIdentity, SpawnPermit, SupervisorError};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::Read,
    net::TcpListener,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

/// This descriptor is supplied by trusted native packaging/configuration, never renderer input.
/// No command arguments, interpreter fallback or shell lookup is representable.
pub struct ConfiguredRuntime {
    executable: Option<PathBuf>,
    sha256: Option<[u8; 32]>,
}
impl ConfiguredRuntime {
    pub fn unavailable() -> Self {
        Self {
            executable: None,
            sha256: None,
        }
    }
    pub fn approved(executable: PathBuf, sha256: [u8; 32]) -> Result<Self, SupervisorError> {
        if !executable.is_absolute() {
            return Err(SupervisorError::InvalidRuntime);
        }
        Ok(Self {
            executable: Some(executable),
            sha256: Some(sha256),
        })
    }
    fn path(&self) -> Result<&Path, SupervisorError> {
        self.executable
            .as_deref()
            .ok_or(SupervisorError::RuntimeUnavailable)
    }
}
impl ConfiguredRuntime {
    fn check_runtime_with_permit(
        &self,
        permit: Option<&SpawnPermit<'_>>,
    ) -> Result<(), SupervisorError> {
        if let Some(permit) = permit {
            permit.check()?;
        }
        let path = self.path()?;
        let metadata = path
            .symlink_metadata()
            .map_err(|_| SupervisorError::InvalidRuntime)?;
        if metadata.file_type().is_symlink()
            || !metadata.is_file()
            || metadata.len() > 512 * 1024 * 1024
        {
            return Err(SupervisorError::InvalidRuntime);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if metadata.permissions().mode() & 0o111 == 0 {
                return Err(SupervisorError::InvalidRuntime);
            }
        }
        let mut file = File::open(path).map_err(|_| SupervisorError::InvalidRuntime)?;
        let opened = file
            .metadata()
            .map_err(|_| SupervisorError::InvalidRuntime)?;
        validate_unchanged(&metadata, &opened, &metadata)?;
        let actual = hash_bounded_checked(&mut file, 512 * 1024 * 1024, || {
            if let Some(permit) = permit {
                permit.check()
            } else {
                Ok(())
            }
        })?;
        let final_file = file
            .metadata()
            .map_err(|_| SupervisorError::InvalidRuntime)?;
        let final_path = path
            .symlink_metadata()
            .map_err(|_| SupervisorError::InvalidRuntime)?;
        validate_unchanged(&opened, &final_file, &final_path)?;
        if Some(actual) != self.sha256 {
            return Err(SupervisorError::InvalidRuntime);
        }
        if let Some(permit) = permit {
            permit.check()?;
        }
        Ok(())
    }
}
impl RuntimeAdapter for ConfiguredRuntime {
    fn check_runtime(&self) -> Result<(), SupervisorError> {
        self.check_runtime_with_permit(None)
    }
    fn preflight(&self, permit: &SpawnPermit<'_>) -> Result<(), SupervisorError> {
        self.check_runtime_with_permit(Some(permit))
    }
    fn choose_port(&self) -> Result<u16, SupervisorError> {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .map_err(|_| SupervisorError::SpawnFailed)?;
        listener
            .local_addr()
            .map(|address| address.port())
            .map_err(|_| SupervisorError::SpawnFailed)
    }
    fn create_identity(
        &self,
        generation: u32,
        port: u16,
    ) -> Result<(ServiceIdentity, String), SupervisorError> {
        let mut secret = [0_u8; 32];
        let mut instance = [0_u8; 16];
        getrandom::fill(&mut secret).map_err(|_| SupervisorError::EntropyUnavailable)?;
        getrandom::fill(&mut instance).map_err(|_| SupervisorError::EntropyUnavailable)?;
        let token = secret
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let alphabet = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        let mut value = u128::from_be_bytes(instance);
        let mut encoded = [b'0'; 26];
        for slot in encoded.iter_mut().rev() {
            *slot = alphabet[(value & 31) as usize];
            value >>= 5;
        }
        let body =
            std::str::from_utf8(&encoded).map_err(|_| SupervisorError::EntropyUnavailable)?;
        Ok((
            ServiceIdentity {
                instance_id: format!("svc_{body}"),
                generation,
                bind_port: port,
            },
            token,
        ))
    }
    fn spawn(&self, permit: &SpawnPermit<'_>) -> Result<Box<dyn OwnedProcess>, SupervisorError> {
        self.check_runtime_with_permit(Some(permit))?;
        permit.check()?;
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            native::spawn(self.path()?, permit)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            Err(SupervisorError::ContainmentUnavailable)
        }
    }
}

#[cfg(test)]
fn hash_bounded(source: &mut dyn Read, maximum: u64) -> Result<[u8; 32], SupervisorError> {
    hash_bounded_checked(source, maximum, || Ok(()))
}
fn hash_bounded_checked(
    source: &mut dyn Read,
    maximum: u64,
    mut check: impl FnMut() -> Result<(), SupervisorError>,
) -> Result<[u8; 32], SupervisorError> {
    let maximum_read = maximum
        .checked_add(1)
        .ok_or(SupervisorError::InvalidRuntime)?;
    let mut bounded = source.take(maximum_read);
    let mut hash = Sha256::new();
    let mut buffer = [0_u8; 16384];
    let mut read = 0_u64;
    loop {
        check()?;
        let count = bounded
            .read(&mut buffer)
            .map_err(|_| SupervisorError::InvalidRuntime)?;
        if count == 0 {
            break;
        }
        read += count as u64;
        if read > maximum {
            return Err(SupervisorError::InvalidRuntime);
        }
        hash.update(&buffer[..count]);
    }
    Ok(hash.finalize().into())
}

fn validate_unchanged(
    initial: &std::fs::Metadata,
    final_file: &std::fs::Metadata,
    final_path: &std::fs::Metadata,
) -> Result<(), SupervisorError> {
    for observed in [final_file, final_path] {
        if !observed.is_file()
            || observed.file_type().is_symlink()
            || initial.len() != observed.len()
            || initial
                .modified()
                .map_err(|_| SupervisorError::InvalidRuntime)?
                != observed
                    .modified()
                    .map_err(|_| SupervisorError::InvalidRuntime)?
        {
            return Err(SupervisorError::InvalidRuntime);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if initial.dev() != observed.dev()
                || initial.ino() != observed.ino()
                || initial.mode() != observed.mode()
            {
                return Err(SupervisorError::InvalidRuntime);
            }
        }
    }
    Ok(())
}

pub struct MonotonicClock(Instant);
impl Default for MonotonicClock {
    fn default() -> Self {
        Self(Instant::now())
    }
}
impl Clock for MonotonicClock {
    fn now(&self) -> Duration {
        self.0.elapsed()
    }
    fn pause(&self, duration: Duration) {
        std::thread::sleep(duration);
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
mod native {
    use super::*;
    use std::{
        os::unix::process::CommandExt,
        process::{Child, ChildStdin, Command, Stdio},
        sync::mpsc::{self, Receiver, TryRecvError},
        thread::JoinHandle,
    };

    struct NativeChild {
        child: Child,
        lease: Option<ChildStdin>,
        frames: Receiver<Result<ReadyFrame, SupervisorError>>,
        reader: Option<JoinHandle<()>>,
        pid: libc::pid_t,
        terminal: Option<i32>,
        containment_terminated: bool,
        group_signal_denied: bool,
    }
    pub(super) fn spawn(
        executable: &Path,
        permit: &SpawnPermit<'_>,
    ) -> Result<Box<dyn OwnedProcess>, SupervisorError> {
        let mut command = Command::new(executable);
        command
            .current_dir(executable.parent().ok_or(SupervisorError::InvalidRuntime)?)
            .env_clear()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .process_group(0);
        permit.check()?;
        let mut child = command.spawn().map_err(|_| SupervisorError::SpawnFailed)?;
        let pid = libc::pid_t::try_from(child.id())
            .map_err(|_| SupervisorError::ContainmentUnavailable)?;
        let lease = child.stdin.take();
        let stdout = child.stdout.take();
        if lease.is_none() || stdout.is_none() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(SupervisorError::SpawnFailed);
        }
        let (sender, frames) = mpsc::sync_channel(2);
        let mut stdout = stdout.expect("owned stdout checked above");
        let reader = std::thread::spawn(move || {
            let frame =
                ReadyFrame::read_from(&mut stdout).map_err(|_| SupervisorError::ProtocolRejected);
            if sender.send(frame).is_err() {
                return;
            }
            // The channel permits exactly one READY frame; no log line or second frame is valid.
            let mut byte = [0_u8; 1];
            if !matches!(stdout.read(&mut byte), Ok(0)) {
                let _ = sender.send(Err(SupervisorError::ProtocolRejected));
            }
        });
        Ok(Box::new(NativeChild {
            child,
            lease,
            frames,
            reader: Some(reader),
            pid,
            terminal: None,
            containment_terminated: false,
            group_signal_denied: false,
        }))
    }

    fn request_group_signal(pid: libc::pid_t) -> Result<(), i32> {
        // SAFETY: pid is the positive child ID of the atomic process_group(0) spawn.
        // The unreaped child reserves this identity until group termination is requested.
        let result = unsafe { libc::kill(-pid, libc::SIGKILL) };
        if result == 0 {
            Ok(())
        } else {
            Err(std::io::Error::last_os_error()
                .raw_os_error()
                .unwrap_or(libc::EIO))
        }
    }
    fn strict_group_signal_status(result: Result<(), i32>) -> Result<(), SupervisorError> {
        match result {
            Ok(()) | Err(libc::ESRCH) => Ok(()),
            Err(_) => Err(SupervisorError::CleanupFailed),
        }
    }
    fn signal_group(pid: libc::pid_t) -> Result<(), SupervisorError> {
        strict_group_signal_status(request_group_signal(pid))
    }
    fn reap_exited_group(
        signal: Result<(), i32>,
        reap: impl FnOnce() -> Result<i32, SupervisorError>,
    ) -> Result<(i32, bool), SupervisorError> {
        let denied = match signal {
            Ok(()) | Err(libc::ESRCH) => false,
            // Darwin excludes zombies when signalling a group, so an exited-only
            // group may yield EPERM. Only this WNOWAIT-confirmed exit path may
            // defer that result through reaping. A remaining group still fails.
            #[cfg(target_os = "macos")]
            Err(libc::EPERM) => true,
            Err(_) => return Err(SupervisorError::CleanupFailed),
        };
        Ok((reap()?, denied))
    }
    fn group_cleanup_status(present: bool, denied: bool) -> Result<(), SupervisorError> {
        if present && denied {
            Err(SupervisorError::CleanupFailed)
        } else {
            group_teardown_status(present)
        }
    }
    fn group_exists(pid: libc::pid_t) -> bool {
        // SAFETY: signal0 only observes the private owned process group; it sends no signal.
        let result = unsafe { libc::kill(-pid, 0) };
        result == 0 || std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
    }
    fn exited_without_reaping(pid: libc::pid_t) -> Result<bool, SupervisorError> {
        // SAFETY: siginfo_t may be initialized to zero. waitid receives its valid writable
        // address and WNOWAIT preserves child identity until contained descendants are stopped.
        let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
        let result = unsafe {
            libc::waitid(
                libc::P_PID,
                pid as libc::id_t,
                &mut info,
                libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
            )
        };
        if result != 0 {
            return Err(SupervisorError::CleanupFailed);
        }
        #[cfg(target_os = "macos")]
        {
            Ok(info.si_pid != 0)
        }
        #[cfg(target_os = "linux")]
        {
            Ok(unsafe { info.si_pid() } != 0)
        }
    }
    fn group_teardown_status(present: bool) -> Result<(), SupervisorError> {
        if present {
            Err(SupervisorError::CleanupPending)
        } else {
            Ok(())
        }
    }

    fn finish_reader(reader: &mut Option<JoinHandle<()>>) -> bool {
        if reader.as_ref().is_some_and(|reader| !reader.is_finished()) {
            return false;
        }
        if let Some(reader) = reader.take() {
            let _ = reader.join();
        }
        true
    }
    impl NativeChild {
        fn finish_reader(&mut self) -> bool {
            finish_reader(&mut self.reader)
        }
    }
    impl OwnedProcess for NativeChild {
        fn observe_alive(&self) -> Result<bool, SupervisorError> {
            if self.terminal.is_some() {
                return Ok(false);
            }
            exited_without_reaping(self.pid).map(|exited| !exited)
        }

        fn write_bootstrap(&mut self, bootstrap: &Bootstrap<'_>) -> Result<(), SupervisorError> {
            let lease = self
                .lease
                .as_mut()
                .ok_or(SupervisorError::BootstrapFailed)?;
            bootstrap
                .write_to(lease)
                .map_err(|_| SupervisorError::BootstrapFailed)
        }
        fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
            match self.frames.try_recv() {
                Ok(frame) => frame.map(Some),
                Err(TryRecvError::Empty) => Ok(None),
                Err(TryRecvError::Disconnected) => Err(SupervisorError::ProtocolRejected),
            }
        }
        fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
            if self.terminal.is_none() {
                if !exited_without_reaping(self.pid)? {
                    return Ok(None);
                }
                let signal = request_group_signal(self.pid);
                let (terminal, denied) = reap_exited_group(signal, || {
                    self.child
                        .wait()
                        .map(|status| status.code().unwrap_or(70))
                        .map_err(|_| SupervisorError::CleanupFailed)
                })?;
                self.containment_terminated = true;
                self.group_signal_denied = denied;
                self.terminal = Some(terminal);
            }
            group_cleanup_status(group_exists(self.pid), self.group_signal_denied)?;
            if !self.finish_reader() {
                return Err(SupervisorError::CleanupPending);
            }
            Ok(self.terminal)
        }
        fn close_lease(&mut self) {
            self.lease = None;
        }
        fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
            if !self.containment_terminated {
                signal_group(self.pid)?;
                self.containment_terminated = true;
            }
            Ok(())
        }
    }

    impl Drop for NativeChild {
        fn drop(&mut self) {
            self.lease = None;
            if !self.containment_terminated {
                let _ = signal_group(self.pid);
            }
            let _ = self.child.try_wait();
            // Fallback only; explicit shutdown+reaping is the observable contract.
            if self.reader.as_ref().is_some_and(JoinHandle::is_finished)
                && let Some(reader) = self.reader.take()
            {
                let _ = reader.join();
            }
        }
    }
    #[cfg(test)]
    mod bounded_reader_tests {
        use super::*;
        #[test]
        fn asynchronous_group_teardown_remains_pending_then_completes() {
            let observations = [true, true, false].map(group_teardown_status);
            assert_eq!(
                observations,
                [
                    Err(SupervisorError::CleanupPending),
                    Err(SupervisorError::CleanupPending),
                    Ok(())
                ]
            );
        }
        #[cfg(target_os = "macos")]
        #[test]
        fn exited_zombie_only_group_permission_denial_is_reaped_and_requires_absence() {
            let reaped = std::cell::Cell::new(false);
            let result = reap_exited_group(Err(libc::EPERM), || {
                reaped.set(true);
                Ok(0)
            });
            assert!(reaped.get(), "an exited owned leader must be safely reaped");
            assert_eq!(result, Ok((0, true)));
            let (_, denied) = result.unwrap();
            assert_eq!(group_cleanup_status(false, denied), Ok(()));
            assert_eq!(
                group_cleanup_status(true, denied),
                Err(SupervisorError::CleanupFailed),
                "denied signalling with remaining members must never be successful"
            );
        }
        #[test]
        fn live_group_permission_denial_and_unexpected_errors_stay_fatal() {
            assert_eq!(
                strict_group_signal_status(Err(libc::EPERM)),
                Err(SupervisorError::CleanupFailed)
            );
            let reaped = std::cell::Cell::new(false);
            assert_eq!(
                reap_exited_group(Err(libc::EINVAL), || {
                    reaped.set(true);
                    Ok(0)
                }),
                Err(SupervisorError::CleanupFailed)
            );
            assert!(
                !reaped.get(),
                "unclassified errors must preserve leader ownership"
            );
        }
        #[test]
        fn denied_descendant_group_remains_failed_until_observed_absent() {
            assert_eq!(
                [true, true, false].map(|present| group_cleanup_status(present, true)),
                [
                    Err(SupervisorError::CleanupFailed),
                    Err(SupervisorError::CleanupFailed),
                    Ok(())
                ]
            );
        }
        #[test]
        fn pending_reader_does_not_block_a_poll_and_ownership_is_preserved() {
            let (release, wait) = mpsc::channel();
            let reader = std::thread::spawn(move || {
                let _ = wait.recv();
            });
            let (observed, receive) = mpsc::channel();
            let poller = std::thread::spawn(move || {
                let mut reader = Some(reader);
                let completed = finish_reader(&mut reader);
                observed.send((completed, reader)).unwrap();
            });
            let early = receive.recv_timeout(Duration::from_millis(100));
            let returned_before_release = early.is_ok();
            // Always release and join owned test threads before any failing assertion.
            release.send(()).unwrap();
            let (completed, reader) = match early {
                Ok(value) => value,
                Err(_) => receive.recv_timeout(Duration::from_secs(1)).unwrap(),
            };
            poller.join().unwrap();
            let retained = reader.is_some();
            if let Some(reader) = reader {
                reader.join().unwrap();
            }
            assert!(
                returned_before_release,
                "reader join blocked the native poll until the writer was released"
            );
            assert!(!completed, "unfinished reader must be pending");
            assert!(retained, "pending reader handle must remain owned");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_configured_runtime_is_honestly_unavailable() {
        assert_eq!(
            ConfiguredRuntime::unavailable().check_runtime(),
            Err(SupervisorError::RuntimeUnavailable)
        );
    }
    #[test]
    fn relative_executable_is_not_a_path_search_request() {
        assert!(matches!(
            ConfiguredRuntime::approved(PathBuf::from("python"), [0; 32]),
            Err(SupervisorError::InvalidRuntime)
        ));
    }
    #[test]
    fn random_session_material_and_namespaced_instance_are_fresh_and_bounded() {
        let adapter = ConfiguredRuntime::unavailable();
        let (first, first_secret) = adapter.create_identity(1, 4763).unwrap();
        let (second, second_secret) = adapter.create_identity(2, 4764).unwrap();
        assert_ne!(first.instance_id, second.instance_id);
        assert_ne!(first_secret, second_secret);
        assert!(Bootstrap::new(&first, &first_secret).is_ok());
        assert!(Bootstrap::new(&second, &second_secret).is_ok());
    }
    struct FiniteReader {
        left: usize,
        read: usize,
    }
    impl Read for FiniteReader {
        fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
            let count = self.left.min(buffer.len());
            buffer[..count].fill(b'a');
            self.left -= count;
            self.read += count;
            Ok(count)
        }
    }
    #[test]
    fn actual_stream_growth_is_capped_at_maximum_plus_one() {
        let mut reader = FiniteReader { left: 100, read: 0 };
        assert_eq!(
            hash_bounded(&mut reader, 16),
            Err(SupervisorError::InvalidRuntime)
        );
        assert!(
            reader.read <= 17,
            "must never read an unbounded growing stream to EOF"
        );
    }
    #[test]
    fn post_read_metadata_rejects_actual_growth() {
        let directory =
            std::env::temp_dir().join(format!("japp-supervisor-growth-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("file");
        std::fs::write(&path, b"original").unwrap();
        let initial = path.metadata().unwrap();
        std::fs::write(&path, b"original-grown").unwrap();
        let changed = path.metadata().unwrap();
        let result = validate_unchanged(&initial, &changed, &changed);
        std::fs::remove_dir_all(&directory).unwrap();
        assert_eq!(result, Err(SupervisorError::InvalidRuntime));
    }
    #[cfg(unix)]
    #[test]
    fn post_read_metadata_rejects_same_length_path_replacement() {
        let directory = std::env::temp_dir().join(format!(
            "japp-supervisor-replacement-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("file");
        std::fs::write(&path, b"original").unwrap();
        let initial = path.metadata().unwrap();
        std::fs::rename(&path, directory.join("prior")).unwrap();
        std::fs::write(&path, b"original").unwrap();
        let replacement = path.metadata().unwrap();
        let result = validate_unchanged(&initial, &initial, &replacement);
        std::fs::remove_dir_all(&directory).unwrap();
        assert_eq!(result, Err(SupervisorError::InvalidRuntime));
    }
}
