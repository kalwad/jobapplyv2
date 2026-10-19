use super::authority_hub::AuthorityHub;
use super::protocol::{Bootstrap, ReadyFrame, ServiceIdentity};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SupervisorError {
    RuntimeUnavailable,
    Cancelled,
    InvalidRuntime,
    EntropyUnavailable,
    SpawnFailed,
    BootstrapFailed,
    ProtocolRejected,
    StartupTimeout,
    ChildExited,
    CleanupFailed,
    #[cfg_attr(
        all(not(unix), not(test)),
        expect(
            dead_code,
            reason = "non-Unix cleanup producer is unavailable until M03-W07"
        )
    )]
    CleanupPending,
    AlreadyRunning,
    InvalidPolicy,
    GenerationExhausted,
    ContainmentUnavailable,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ServiceState {
    Unavailable,
    Starting,
    Running,
    Stopping,
    Stopped,
    Failed,
}
#[derive(Clone, Copy)]
pub struct Policy {
    pub startup_timeout: Duration,
    pub shutdown_timeout: Duration,
    pub poll_interval: Duration,
    pub bind_attempts: u8,
}
impl Default for Policy {
    fn default() -> Self {
        Self {
            startup_timeout: Duration::from_secs(10),
            shutdown_timeout: Duration::from_secs(3),
            poll_interval: Duration::from_millis(10),
            bind_attempts: 3,
        }
    }
}

pub trait Clock {
    fn now(&self) -> Duration;
    fn pause(&self, duration: Duration);
}
pub trait OwnedProcess: Send {
    // Read-only nonblocking liveness. Unsupported adapters fail closed for snapshots.
    fn observe_alive(&self) -> Result<bool, SupervisorError> {
        Err(SupervisorError::ContainmentUnavailable)
    }
    fn write_bootstrap(&mut self, bootstrap: &Bootstrap<'_>) -> Result<(), SupervisorError>;
    fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError>;
    fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError>;
    fn close_lease(&mut self);
    fn terminate_owned(&mut self) -> Result<(), SupervisorError>;
}
pub struct SpawnPermit<'a> {
    cancellation: &'a AtomicBool,
    clock: &'a dyn Clock,
    deadline: Duration,
}
impl SpawnPermit<'_> {
    pub fn check(&self) -> Result<(), SupervisorError> {
        if self.cancellation.load(Ordering::Acquire) {
            Err(SupervisorError::Cancelled)
        } else if self.clock.now() >= self.deadline {
            Err(SupervisorError::StartupTimeout)
        } else {
            Ok(())
        }
    }
}

pub trait RuntimeAdapter {
    fn check_runtime(&self) -> Result<(), SupervisorError>;
    fn preflight(&self, permit: &SpawnPermit<'_>) -> Result<(), SupervisorError> {
        permit.check()?;
        self.check_runtime()?;
        permit.check()
    }
    fn choose_port(&self) -> Result<u16, SupervisorError>;
    fn create_identity(
        &self,
        generation: u32,
        port: u16,
    ) -> Result<(ServiceIdentity, String), SupervisorError>;
    fn spawn(&self, permit: &SpawnPermit<'_>) -> Result<Box<dyn OwnedProcess>, SupervisorError>;
}

struct SessionAuthority(Arc<AtomicBool>);
impl Drop for SessionAuthority {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

pub struct Supervisor<A: RuntimeAdapter, C: Clock> {
    adapter: A,
    clock: C,
    policy: Policy,
    state: ServiceState,
    generation: u32,
    failure_cause: Option<SupervisorError>,
    // Drop order revokes outstanding native leases before releasing the child owner.
    session_authority: Option<SessionAuthority>,
    child: Option<Box<dyn OwnedProcess>>,
    identity: Option<ServiceIdentity>,
    secret: Option<String>,
    cancellation: Arc<AtomicBool>,
    authority_hub: Arc<AuthorityHub>,
}
impl<A: RuntimeAdapter, C: Clock> Supervisor<A, C> {
    pub fn new(adapter: A, clock: C, policy: Policy) -> Result<Self, SupervisorError> {
        if policy.startup_timeout.is_zero()
            || policy.startup_timeout > Duration::from_secs(30)
            || policy.shutdown_timeout.is_zero()
            || policy.shutdown_timeout > Duration::from_secs(10)
            || policy.poll_interval.is_zero()
            || policy.poll_interval > Duration::from_millis(250)
            || !(1..=3).contains(&policy.bind_attempts)
        {
            return Err(SupervisorError::InvalidPolicy);
        }
        let cancellation = Arc::new(AtomicBool::new(false));
        let authority_hub = Arc::new(AuthorityHub::new(Arc::clone(&cancellation)));
        Ok(Self {
            adapter,
            clock,
            policy,
            state: ServiceState::Unavailable,
            generation: 0,
            failure_cause: None,
            child: None,
            identity: None,
            secret: None,
            cancellation,
            authority_hub,
            session_authority: None,
        })
    }
    pub fn state(&self) -> ServiceState {
        self.state
    }
    pub fn identity(&self) -> Option<&ServiceIdentity> {
        self.identity.as_ref()
    }
    pub(super) fn authority_handle(&self) -> Arc<AuthorityHub> {
        Arc::clone(&self.authority_hub)
    }
    pub fn cancellation_handle(&self) -> Arc<AtomicBool> {
        self.authority_hub.cancellation_handle()
    }
    pub(crate) fn failure_cause(&self) -> Option<SupervisorError> {
        self.failure_cause
    }
    // Native-only synchronous construction seam for W04; no I/O while holding this owner.
    #[allow(dead_code)]
    pub(crate) fn with_running_session<R>(
        &mut self,
        callback: impl FnOnce(&ServiceIdentity, &str, Arc<AtomicBool>) -> R,
    ) -> Result<R, SupervisorError> {
        if self.cancellation.load(Ordering::Acquire) {
            self.record_failure(SupervisorError::Cancelled);
            return Err(SupervisorError::Cancelled);
        }
        self.inspect_session_authority()?;
        if self.state() != ServiceState::Running {
            return Err(self
                .failure_cause
                .unwrap_or(SupervisorError::RuntimeUnavailable));
        }
        let identity = self.identity().ok_or(SupervisorError::RuntimeUnavailable)?;
        let secret = self
            .secret
            .as_deref()
            .ok_or(SupervisorError::RuntimeUnavailable)?;
        let valid = self
            .session_authority
            .as_ref()
            .map(|authority| &authority.0)
            .filter(|valid| valid.load(Ordering::Acquire))
            .ok_or(SupervisorError::RuntimeUnavailable)?;
        Ok(callback(identity, secret, Arc::clone(valid)))
    }
    pub(super) fn invalidate_poisoned_authority(&mut self) {
        self.record_failure(SupervisorError::CleanupFailed);
    }
    fn record_failure(&mut self, error: SupervisorError) {
        self.failure_cause.get_or_insert(error);
        self.revoke_session();
        self.state = ServiceState::Failed;
    }
    fn revoke_session(&mut self) {
        self.session_authority = None;
        self.secret = None;
        self.identity = None;
    }
    pub fn start(&mut self) -> Result<ServiceIdentity, SupervisorError> {
        if self.cancellation.load(Ordering::Acquire) {
            return self.fail(SupervisorError::Cancelled);
        }
        if self.child.is_some() {
            return Err(SupervisorError::AlreadyRunning);
        }
        self.failure_cause = None;
        let deadline = self.clock.now() + self.policy.startup_timeout;
        let permit = SpawnPermit {
            cancellation: &self.cancellation,
            clock: &self.clock,
            deadline,
        };
        if let Err(error) = self.adapter.preflight(&permit) {
            self.failure_cause = Some(error);
            self.revoke_session();
            self.state = if error == SupervisorError::RuntimeUnavailable {
                ServiceState::Unavailable
            } else {
                ServiceState::Failed
            };
            return Err(error);
        }
        self.state = ServiceState::Starting;
        for attempt in 0..self.policy.bind_attempts {
            let permit = SpawnPermit {
                cancellation: &self.cancellation,
                clock: &self.clock,
                deadline,
            };
            if let Err(error) = permit.check() {
                return self.fail(error);
            }
            self.generation = match self
                .generation
                .checked_add(1)
                .filter(|value| *value <= i32::MAX as u32)
            {
                Some(value) => value,
                None => return self.fail(SupervisorError::GenerationExhausted),
            };
            let port = match self.adapter.choose_port() {
                Ok(port) => port,
                Err(error) => return self.fail(error),
            };
            let (identity, secret) = match self.adapter.create_identity(self.generation, port) {
                Ok(value) => value,
                Err(error) => return self.fail(error),
            };
            let bootstrap = match Bootstrap::new(&identity, &secret) {
                Ok(value) => value,
                Err(_) => return self.fail(SupervisorError::BootstrapFailed),
            };
            self.child = match self.adapter.spawn(&permit) {
                Ok(child) => Some(child),
                Err(error) => return self.fail(error),
            };
            if let Err(error) = self
                .child
                .as_mut()
                .expect("owned child assigned above")
                .write_bootstrap(&bootstrap)
            {
                return self.fail(error);
            }
            self.secret = Some(secret);
            loop {
                let permit = SpawnPermit {
                    cancellation: &self.cancellation,
                    clock: &self.clock,
                    deadline,
                };
                if let Err(error) = permit.check() {
                    return self.fail(error);
                }
                let child = self.child.as_mut().expect("startup owns one child");
                match child.poll_exit() {
                    Ok(Some(code)) => {
                        self.secret = None;
                        self.child = None;
                        if code == 72
                            && attempt + 1 < self.policy.bind_attempts
                            && self.clock.now() < deadline
                        {
                            break;
                        }
                        return self.fail(SupervisorError::ChildExited);
                    }
                    Ok(None) => {}
                    Err(SupervisorError::CleanupPending) => {
                        if self.clock.now() >= deadline {
                            return self.fail(SupervisorError::CleanupFailed);
                        }
                        self.clock.pause(self.policy.poll_interval);
                        continue;
                    }
                    Err(error) => return self.fail(error),
                }
                match child.read_ready() {
                    Ok(Some(ready)) => {
                        if !ready.matches(&identity) {
                            return self.fail(SupervisorError::ProtocolRejected);
                        }
                        // A pipe frame alone is not a proof that the child remains alive.
                        match child.poll_exit() {
                            Ok(None) => {}
                            Ok(Some(_)) => return self.fail(SupervisorError::ChildExited),
                            Err(error) => return self.fail(error),
                        }
                        if let Err(error) = permit.check() {
                            return self.fail(error);
                        }
                        let valid = self.authority_hub.publish();
                        if !valid.load(Ordering::Acquire) {
                            return self.fail(SupervisorError::Cancelled);
                        }
                        self.state = ServiceState::Running;
                        self.identity = Some(identity.clone());
                        self.session_authority = Some(SessionAuthority(valid));
                        return Ok(identity);
                    }
                    Ok(None) => {}
                    Err(error) => return self.fail(error),
                }
                if self.clock.now() >= deadline {
                    return self.fail(SupervisorError::StartupTimeout);
                }
                self.clock.pause(self.policy.poll_interval);
            }
        }
        self.fail(SupervisorError::ChildExited)
    }

    fn fail<T>(&mut self, error: SupervisorError) -> Result<T, SupervisorError> {
        self.record_failure(error);
        let cleanup = self.shutdown();
        self.state = ServiceState::Failed;
        Err(if cleanup.is_err() {
            SupervisorError::CleanupFailed
        } else {
            error
        })
    }

    pub fn shutdown(&mut self) -> Result<(), SupervisorError> {
        self.revoke_session();
        if self.child.is_none() {
            self.state = ServiceState::Stopped;
            return Ok(());
        }
        self.state = ServiceState::Stopping;
        self.child
            .as_mut()
            .expect("owned child checked above")
            .close_lease();
        if self.wait_for_exit(self.policy.shutdown_timeout)? {
            self.state = ServiceState::Stopped;
            return Ok(());
        }
        if self
            .child
            .as_mut()
            .expect("unreaped child is retained")
            .terminate_owned()
            .is_err()
        {
            self.state = ServiceState::Failed;
            return Err(SupervisorError::CleanupFailed);
        }
        if self.wait_for_exit(self.policy.shutdown_timeout)? {
            self.state = ServiceState::Stopped;
            Ok(())
        } else {
            self.state = ServiceState::Failed;
            Err(SupervisorError::CleanupFailed)
        }
    }

    fn wait_for_exit(&mut self, duration: Duration) -> Result<bool, SupervisorError> {
        let deadline = self.clock.now() + duration;
        loop {
            match self
                .child
                .as_mut()
                .expect("wait requires owned child")
                .poll_exit()
            {
                Ok(Some(_)) => {
                    self.child = None;
                    return Ok(true);
                }
                Ok(None) | Err(SupervisorError::CleanupPending) => {}
                Err(_) => {
                    self.state = ServiceState::Failed;
                    return Err(SupervisorError::CleanupFailed);
                }
            }
            if self.clock.now() >= deadline {
                return Ok(false);
            }
            self.clock.pause(self.policy.poll_interval);
        }
    }

    // Command path: read-only liveness and bounded already-parsed private status only.
    // Retain the native child for background signal/reap/drain/cleanup ownership.
    fn inspect_session_authority(&mut self) -> Result<ServiceState, SupervisorError> {
        if self.state == ServiceState::Failed {
            return self.failure_cause.map_or(Ok(self.state), Err);
        }
        if let Some(child) = self.child.as_mut() {
            match child.observe_alive() {
                Ok(false) => {
                    self.record_failure(SupervisorError::ChildExited);
                    return Err(SupervisorError::ChildExited);
                }
                Err(error) => {
                    self.record_failure(error);
                    return Err(error);
                }
                Ok(true) => {
                    if self.state == ServiceState::Running {
                        match child.read_ready() {
                            Ok(None) => {}
                            Ok(Some(_)) | Err(_) => {
                                self.record_failure(SupervisorError::ProtocolRejected);
                                return Err(SupervisorError::ProtocolRejected);
                            }
                        }
                    }
                }
            }
        }
        Ok(self.state)
    }
    // Background lifecycle owner may finish native group/reap/reader cleanup.
    fn inspect_authority(&mut self) -> Result<ServiceState, SupervisorError> {
        if self.state == ServiceState::Failed {
            return self.failure_cause.map_or(Ok(self.state), Err);
        }
        if let Some(child) = self.child.as_mut() {
            match child.poll_exit() {
                Ok(Some(_)) => {
                    self.child = None;
                    self.record_failure(SupervisorError::ChildExited);
                }
                Err(error) => {
                    self.record_failure(error);
                    return Err(error);
                }
                Ok(None) => {
                    if self.state == ServiceState::Running {
                        match child.read_ready() {
                            Ok(None) => {}
                            Ok(Some(_)) | Err(_) => {
                                self.record_failure(SupervisorError::ProtocolRejected);
                                return Err(SupervisorError::ProtocolRejected);
                            }
                        }
                    }
                }
            }
        }
        Ok(self.state)
    }
    pub fn observe(&mut self) -> Result<ServiceState, SupervisorError> {
        match self.inspect_authority() {
            Err(SupervisorError::ProtocolRejected) => self.fail(SupervisorError::ProtocolRejected),
            result => result,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        collections::VecDeque,
        io::Cursor,
        sync::{Arc, Mutex},
    };

    #[derive(Default)]
    struct Record {
        spawn: usize,
        bootstraps: Vec<Vec<u8>>,
        closes: usize,
        terminations: usize,
    }
    enum Outcome {
        Ready,
        WrongGeneration,
        Never,
        Exit(i32),
        BootstrapFailure,
        ProtocolFailure,
        Stubborn,
        DieAfterReady,
        CleanupFails,
        PendingCleanup,
        LateReady,
    }
    struct FakeChild {
        outcome: Outcome,
        record: Arc<Mutex<Record>>,
        identity: Option<ServiceIdentity>,
        closed: bool,
        terminated: bool,
        polls: u8,
    }
    impl OwnedProcess for FakeChild {
        fn observe_alive(&self) -> Result<bool, SupervisorError> {
            Ok(!self.closed
                && !self.terminated
                && !matches!(self.outcome, Outcome::Exit(_))
                && !(matches!(self.outcome, Outcome::DieAfterReady) && self.polls > 0))
        }
        fn write_bootstrap(&mut self, bootstrap: &Bootstrap<'_>) -> Result<(), SupervisorError> {
            if matches!(self.outcome, Outcome::BootstrapFailure) {
                return Err(SupervisorError::BootstrapFailed);
            }
            let mut bytes = Vec::new();
            bootstrap.write_to(&mut bytes).unwrap();
            let v: serde_json::Value = serde_json::from_slice(&bytes[4..]).unwrap();
            self.identity = Some(ServiceIdentity {
                instance_id: v["instance_id"].as_str().unwrap().to_string(),
                generation: v["generation"].as_u64().unwrap() as u32,
                bind_port: v["bind_port"].as_u64().unwrap() as u16,
            });
            self.record.lock().unwrap().bootstraps.push(bytes);
            Ok(())
        }
        fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
            if matches!(self.outcome, Outcome::LateReady) && self.polls == 0 {
                self.polls += 1;
                return Ok(None);
            }
            if matches!(self.outcome, Outcome::ProtocolFailure) {
                return Err(SupervisorError::ProtocolRejected);
            }
            if matches!(
                self.outcome,
                Outcome::Ready
                    | Outcome::WrongGeneration
                    | Outcome::DieAfterReady
                    | Outcome::LateReady
            ) && (self.polls == 0
                || matches!(self.outcome, Outcome::LateReady) && self.polls == 1)
            {
                self.polls += 1;
                let i = self.identity.as_ref().unwrap();
                let generation = if matches!(self.outcome, Outcome::WrongGeneration) {
                    i.generation + 1
                } else {
                    i.generation
                };
                let body=serde_json::to_vec(&serde_json::json!({"protocol":"JAPP_SERVICE_STATUS_V1","schema_version":"1.0.0","status":"READY","bind_host":"127.0.0.1","bind_port":i.bind_port,"instance_id":i.instance_id,"generation":generation})).unwrap();
                let mut bytes = (body.len() as u32).to_be_bytes().to_vec();
                bytes.extend(body);
                return Ok(Some(
                    ReadyFrame::read_from(&mut Cursor::new(bytes)).unwrap(),
                ));
            }
            Ok(None)
        }
        fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
            if self.closed && matches!(self.outcome, Outcome::PendingCleanup) {
                return Err(SupervisorError::CleanupPending);
            }
            if matches!(self.outcome, Outcome::DieAfterReady) && self.polls > 0 {
                return Ok(Some(70));
            }
            if self.terminated
                || self.closed && !matches!(self.outcome, Outcome::Stubborn | Outcome::CleanupFails)
            {
                return Ok(Some(0));
            }
            if let Outcome::Exit(code) = self.outcome {
                Ok(Some(code))
            } else {
                Ok(None)
            }
        }
        fn close_lease(&mut self) {
            self.closed = true;
            self.record.lock().unwrap().closes += 1;
        }
        fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
            if matches!(self.outcome, Outcome::CleanupFails) {
                return Err(SupervisorError::CleanupFailed);
            }
            self.terminated = true;
            self.record.lock().unwrap().terminations += 1;
            Ok(())
        }
    }
    struct FakeAdapter {
        outcomes: Mutex<VecDeque<Outcome>>,
        record: Arc<Mutex<Record>>,
        available: bool,
        preflight_cancel: Option<Arc<AtomicBool>>,
        preflight_elapsed: Option<(Arc<std::sync::atomic::AtomicU64>, Duration)>,
    }
    impl RuntimeAdapter for FakeAdapter {
        fn check_runtime(&self) -> Result<(), SupervisorError> {
            if let Some(flag) = &self.preflight_cancel {
                flag.store(true, Ordering::Release);
            }
            if let Some((clock, elapsed)) = &self.preflight_elapsed {
                clock.fetch_add(elapsed.as_nanos() as u64, Ordering::AcqRel);
            }
            if self.available {
                Ok(())
            } else {
                Err(SupervisorError::RuntimeUnavailable)
            }
        }
        fn choose_port(&self) -> Result<u16, SupervisorError> {
            Ok(40000 + self.record.lock().unwrap().spawn as u16)
        }
        fn create_identity(
            &self,
            generation: u32,
            port: u16,
        ) -> Result<(ServiceIdentity, String), SupervisorError> {
            Ok((
                ServiceIdentity {
                    instance_id: format!("svc_{generation:026}"),
                    generation,
                    bind_port: port,
                },
                format!("{generation:064x}"),
            ))
        }
        fn spawn(
            &self,
            permit: &SpawnPermit<'_>,
        ) -> Result<Box<dyn OwnedProcess>, SupervisorError> {
            permit.check()?;
            self.record.lock().unwrap().spawn += 1;
            Ok(Box::new(FakeChild {
                outcome: self.outcomes.lock().unwrap().pop_front().unwrap(),
                record: self.record.clone(),
                identity: None,
                closed: false,
                terminated: false,
                polls: 0,
            }))
        }
    }
    #[derive(Default)]
    struct FakeClock(Arc<std::sync::atomic::AtomicU64>);
    impl Clock for FakeClock {
        fn now(&self) -> Duration {
            Duration::from_nanos(self.0.load(Ordering::Acquire))
        }
        fn pause(&self, duration: Duration) {
            self.0
                .fetch_add(duration.as_nanos() as u64, Ordering::AcqRel);
        }
    }
    fn harness(outcomes: Vec<Outcome>) -> (Supervisor<FakeAdapter, FakeClock>, Arc<Mutex<Record>>) {
        let record = Arc::new(Mutex::new(Record::default()));
        let adapter = FakeAdapter {
            outcomes: Mutex::new(outcomes.into()),
            record: record.clone(),
            available: true,
            preflight_cancel: None,
            preflight_elapsed: None,
        };
        let policy = Policy {
            startup_timeout: Duration::from_millis(50),
            shutdown_timeout: Duration::from_millis(30),
            poll_interval: Duration::from_millis(10),
            bind_attempts: 3,
        };
        (
            Supervisor::new(adapter, FakeClock::default(), policy).unwrap(),
            record,
        )
    }
    #[test]
    fn accepted_quit_revokes_issued_lease_before_busy_owner_is_released() {
        let (mut supervisor, _) = harness(vec![Outcome::Ready]);
        supervisor.start().unwrap();
        let valid = supervisor
            .with_running_session(|_, _, valid| valid)
            .unwrap();
        assert!(valid.load(Ordering::Acquire));
        let authority = supervisor.authority_handle();
        let owner = Arc::new(Mutex::new(supervisor));
        let (held, ready) = std::sync::mpsc::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let worker_owner = Arc::clone(&owner);
        let worker = std::thread::spawn(move || {
            let _guard = worker_owner.lock().unwrap();
            held.send(()).unwrap();
            wait.recv().unwrap();
        });
        ready.recv().unwrap();
        let gate = super::super::lifecycle_state::ShutdownGate::with_authority(authority);
        let accepted = gate.begin();
        let invalid_before_release = !valid.load(Ordering::Acquire);
        release.send(()).unwrap();
        worker.join().unwrap();
        assert!(accepted);
        assert!(
            invalid_before_release,
            "issued lease remained valid until cleanup owner lock was released"
        );
        assert!(!valid.load(Ordering::Acquire));
    }
    #[test]
    fn command_snapshot_never_polls_reaps_signals_or_drains_cleanup() {
        struct LivenessOnly;
        impl OwnedProcess for LivenessOnly {
            fn observe_alive(&self) -> Result<bool, SupervisorError> {
                Ok(true)
            }
            fn write_bootstrap(&mut self, _: &Bootstrap<'_>) -> Result<(), SupervisorError> {
                panic!("command bootstrap")
            }
            fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
                Ok(None)
            }
            fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
                panic!("command called signal/reap/drain cleanup poll")
            }
            fn close_lease(&mut self) {
                panic!("command closed lease")
            }
            fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
                panic!("command terminated child")
            }
        }
        let (mut s, _) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        s.child = Some(Box::new(LivenessOnly));
        assert_eq!(s.with_running_session(|_, secret, _| secret.len()), Ok(64));
    }
    #[test]
    fn poison_invalidation_revokes_authority_without_command_cleanup() {
        let (mut s, record) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        let valid = s.with_running_session(|_, _, valid| valid).unwrap();
        s.invalidate_poisoned_authority();
        assert!(!valid.load(Ordering::Acquire));
        assert_eq!(s.failure_cause(), Some(SupervisorError::CleanupFailed));
        assert_eq!(record.lock().unwrap().closes, 0);
        assert_eq!(record.lock().unwrap().terminations, 0);
        assert!(s.child.is_some());
    }
    #[test]
    fn session_snapshot_revokes_protocol_failure_without_cleanup_in_command() {
        let (mut s, record) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        let valid = s.with_running_session(|_, _, valid| valid).unwrap();
        s.child = Some(Box::new(FakeChild {
            outcome: Outcome::ProtocolFailure,
            record: Arc::clone(&record),
            identity: None,
            closed: false,
            terminated: false,
            polls: 0,
        }));
        assert_eq!(
            s.with_running_session(|_, _, _| ()),
            Err(SupervisorError::ProtocolRejected)
        );
        assert!(!valid.load(Ordering::Acquire));
        assert!(s.child.is_some());
        assert_eq!(
            record.lock().unwrap().closes,
            0,
            "command snapshot must not run shutdown"
        );
        assert_eq!(record.lock().unwrap().terminations, 0);
        assert_eq!(s.failure_cause(), Some(SupervisorError::ProtocolRejected));
        assert_eq!(s.observe(), Err(SupervisorError::ProtocolRejected));
        assert_eq!(record.lock().unwrap().closes, 1);
        assert!(s.child.is_none());
        assert_eq!(s.failure_cause(), Some(SupervisorError::ProtocolRejected));
    }
    #[test]
    fn guarded_session_callback_requires_actual_running_authority() {
        let (mut s, _) = harness(vec![Outcome::Ready]);
        assert!(s.with_running_session(|_, _, _| ()).is_err());
        let identity = s.start().unwrap();
        let (actual, length, valid) = s
            .with_running_session(|identity, secret, valid| (identity.clone(), secret.len(), valid))
            .unwrap();
        assert_eq!(actual, identity);
        assert_eq!(length, 64);
        assert!(valid.load(Ordering::Acquire));
    }
    #[test]
    fn session_is_revoked_before_owned_lease_is_closed() {
        struct RevocationProbe {
            valid: Arc<AtomicBool>,
            closed: bool,
        }
        impl OwnedProcess for RevocationProbe {
            fn write_bootstrap(&mut self, _: &Bootstrap<'_>) -> Result<(), SupervisorError> {
                unreachable!()
            }
            fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
                Ok(None)
            }
            fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
                Ok(self.closed.then_some(0))
            }
            fn close_lease(&mut self) {
                assert!(!self.valid.load(Ordering::Acquire));
                self.closed = true;
            }
            fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
                unreachable!()
            }
        }
        let (mut s, _) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        let valid = s.with_running_session(|_, _, valid| valid).unwrap();
        s.child = Some(Box::new(RevocationProbe {
            valid: valid.clone(),
            closed: false,
        }));
        s.shutdown().unwrap();
        assert!(!valid.load(Ordering::Acquire));
    }
    #[test]
    fn later_generation_never_reactivates_a_revoked_session() {
        let (mut s, _) = harness(vec![Outcome::Ready, Outcome::Ready]);
        s.start().unwrap();
        let first = s.with_running_session(|_, _, valid| valid).unwrap();
        s.shutdown().unwrap();
        s.start().unwrap();
        let second = s.with_running_session(|_, _, valid| valid).unwrap();
        assert!(!first.load(Ordering::Acquire));
        assert!(second.load(Ordering::Acquire));
        assert!(!Arc::ptr_eq(&first, &second));
    }
    #[test]
    fn guarded_callback_observes_death_before_client_snapshot() {
        let (mut s, _) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        let valid = s.with_running_session(|_, _, valid| valid).unwrap();
        s.child.as_mut().unwrap().close_lease();
        let called = std::cell::Cell::new(false);
        assert!(s.with_running_session(|_, _, _| called.set(true)).is_err());
        assert!(!called.get());
        assert!(!valid.load(Ordering::Acquire));
    }
    #[test]
    fn dropping_native_owner_revokes_every_outstanding_session() {
        let (mut s, _) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        let valid = s.with_running_session(|_, _, valid| valid).unwrap();
        drop(s);
        assert!(!valid.load(Ordering::Acquire));
    }
    #[test]
    fn private_ready_ack_is_required_before_running() {
        let (mut s, r) = harness(vec![Outcome::Ready]);
        let i = s.start().unwrap();
        assert_eq!(s.state(), ServiceState::Running);
        assert_eq!(s.identity(), Some(&i));
        assert_eq!(r.lock().unwrap().spawn, 1);
        assert!(!r.lock().unwrap().bootstraps.is_empty());
    }
    #[test]
    fn unavailable_runtime_cannot_spawn_or_claim_running() {
        let (mut s, r) = harness(vec![]);
        s.adapter.available = false;
        assert_eq!(s.start(), Err(SupervisorError::RuntimeUnavailable));
        assert_eq!(s.state(), ServiceState::Unavailable);
        assert_eq!(r.lock().unwrap().spawn, 0);
    }
    #[test]
    fn repeated_start_does_not_duplicate_child() {
        let (mut s, r) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        assert_eq!(s.start(), Err(SupervisorError::AlreadyRunning));
        assert_eq!(r.lock().unwrap().spawn, 1);
    }
    #[test]
    fn wrong_generation_ack_is_rejected_and_child_reaped() {
        let (mut s, r) = harness(vec![Outcome::WrongGeneration]);
        assert_eq!(s.start(), Err(SupervisorError::ProtocolRejected));
        assert_eq!(s.state(), ServiceState::Failed);
        assert_eq!(r.lock().unwrap().closes, 1);
        assert!(s.identity().is_none());
    }
    #[test]
    fn no_ready_frame_times_out_and_closes_owned_lease() {
        let (mut s, r) = harness(vec![Outcome::Never]);
        assert_eq!(s.start(), Err(SupervisorError::StartupTimeout));
        assert_eq!(r.lock().unwrap().closes, 1);
        assert!(s.child.is_none());
    }
    #[test]
    fn only_exit72_permits_fresh_bounded_collision_attempt() {
        let (mut s, r) = harness(vec![Outcome::Exit(72), Outcome::Ready]);
        let i = s.start().unwrap();
        assert_eq!(i.generation, 2);
        let record = r.lock().unwrap();
        assert_eq!(record.spawn, 2);
        let first: serde_json::Value = serde_json::from_slice(&record.bootstraps[0][4..]).unwrap();
        let second: serde_json::Value = serde_json::from_slice(&record.bootstraps[1][4..]).unwrap();
        assert_ne!(first["session_token"], second["session_token"]);
        assert_ne!(first["instance_id"], second["instance_id"]);
        assert_ne!(first["bind_port"], second["bind_port"]);
    }
    #[test]
    fn collision_budget_is_not_an_infinite_restart() {
        let (mut s, r) = harness(vec![
            Outcome::Exit(72),
            Outcome::Exit(72),
            Outcome::Exit(72),
        ]);
        assert_eq!(s.start(), Err(SupervisorError::ChildExited));
        assert_eq!(r.lock().unwrap().spawn, 3);
        assert!(s.child.is_none());
    }
    #[test]
    fn config_or_runtime_exit_does_not_retry() {
        for code in [0, 64, 70] {
            let (mut s, r) = harness(vec![Outcome::Exit(code)]);
            assert_eq!(s.start(), Err(SupervisorError::ChildExited));
            assert_eq!(r.lock().unwrap().spawn, 1);
        }
    }
    #[test]
    fn bootstrap_write_failure_is_cleaned_up() {
        let (mut s, r) = harness(vec![Outcome::BootstrapFailure]);
        assert_eq!(s.start(), Err(SupervisorError::BootstrapFailed));
        assert_eq!(r.lock().unwrap().closes, 1);
        assert!(s.child.is_none());
    }
    #[test]
    fn invalid_private_frame_is_cleaned_up() {
        let (mut s, r) = harness(vec![Outcome::ProtocolFailure]);
        assert_eq!(s.start(), Err(SupervisorError::ProtocolRejected));
        assert_eq!(r.lock().unwrap().closes, 1);
    }
    #[test]
    fn normal_shutdown_is_idempotent_and_revokes_identity() {
        let (mut s, r) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        s.shutdown().unwrap();
        s.shutdown().unwrap();
        assert_eq!(s.state(), ServiceState::Stopped);
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
        assert_eq!(r.lock().unwrap().closes, 1);
    }
    #[test]
    fn stubborn_child_is_terminated_after_graceful_deadline() {
        let (mut s, r) = harness(vec![Outcome::Stubborn]);
        assert_eq!(s.start(), Err(SupervisorError::StartupTimeout));
        assert_eq!(r.lock().unwrap().terminations, 1);
        assert!(s.child.is_none());
    }
    #[test]
    fn observed_death_revokes_private_secret_and_identity() {
        let (mut s, _) = harness(vec![Outcome::Ready]);
        s.start().unwrap();
        s.child.as_mut().unwrap().close_lease();
        assert_eq!(s.observe().unwrap(), ServiceState::Failed);
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
    }
    #[test]
    fn invalid_bounds_fail_before_any_spawn() {
        let (r, _) = harness(vec![]);
        let result = Supervisor::new(
            r.adapter,
            FakeClock::default(),
            Policy {
                bind_attempts: 0,
                ..Policy::default()
            },
        );
        assert!(matches!(result, Err(SupervisorError::InvalidPolicy)));
    }
    #[test]
    fn death_between_ready_ack_and_live_check_cannot_authorize_running() {
        let (mut s, _) = harness(vec![Outcome::DieAfterReady]);
        assert_eq!(s.start(), Err(SupervisorError::ChildExited));
        assert_eq!(s.state(), ServiceState::Failed);
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
    }
    #[test]
    fn failed_termination_retains_owned_handle_without_secret_or_success_claim() {
        let (mut s, _) = harness(vec![Outcome::CleanupFails]);
        assert_eq!(s.start(), Err(SupervisorError::CleanupFailed));
        assert_eq!(s.state(), ServiceState::Failed);
        assert!(s.child.is_some());
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
    }
    #[test]
    fn exhausted_generation_cannot_spawn_an_ambiguous_instance() {
        let (mut s, r) = harness(vec![]);
        s.generation = i32::MAX as u32;
        assert_eq!(s.start(), Err(SupervisorError::GenerationExhausted));
        assert_eq!(r.lock().unwrap().spawn, 0);
    }
    #[test]
    fn exit_requested_before_start_cannot_launch_a_late_child() {
        let (mut s, r) = harness(vec![]);
        s.cancellation_handle().store(true, Ordering::Release);
        assert_eq!(s.start(), Err(SupervisorError::Cancelled));
        assert_eq!(r.lock().unwrap().spawn, 0);
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
    }
    #[test]
    fn pending_reader_cleanup_uses_finite_deadlines_and_retains_ownership() {
        let (mut s, r) = harness(vec![Outcome::PendingCleanup]);
        assert_eq!(s.start(), Err(SupervisorError::CleanupFailed));
        assert_eq!(s.state(), ServiceState::Failed);
        assert!(s.child.is_some());
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
        assert_eq!(s.clock.now(), Duration::from_millis(110));
        assert_eq!(r.lock().unwrap().terminations, 1);
    }
    #[test]
    fn cancellation_accepted_during_preflight_prevents_all_spawns() {
        let (mut s, r) = harness(vec![Outcome::Ready]);
        s.adapter.preflight_cancel = Some(s.cancellation_handle());
        assert_eq!(s.start(), Err(SupervisorError::Cancelled));
        assert_eq!(r.lock().unwrap().spawn, 0);
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
    }
    #[test]
    fn startup_deadline_includes_preflight_and_prevents_late_spawn() {
        let (mut s, r) = harness(vec![Outcome::Ready]);
        s.adapter.preflight_elapsed = Some((Arc::clone(&s.clock.0), Duration::from_millis(100)));
        assert_eq!(s.start(), Err(SupervisorError::StartupTimeout));
        assert_eq!(r.lock().unwrap().spawn, 0);
    }
    #[test]
    fn queued_ready_after_poll_overshoot_cannot_authorize_running() {
        let (mut s, r) = harness(vec![Outcome::LateReady]);
        s.policy.poll_interval = Duration::from_millis(100);
        assert_eq!(s.start(), Err(SupervisorError::StartupTimeout));
        assert_eq!(s.state(), ServiceState::Failed);
        assert!(s.identity().is_none());
        assert!(s.secret.is_none());
        assert_eq!(r.lock().unwrap().closes, 1);
    }
}
