//! One synchronous native lifecycle owner; native wrapper drives it off the UI thread.
use super::{Clock, Policy, RuntimeAdapter, ServiceIdentity, Supervisor, SupervisorError};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

impl<T: Clock> Clock for Arc<T> {
    fn now(&self) -> Duration {
        self.as_ref().now()
    }
    fn pause(&self, duration: Duration) {
        self.as_ref().pause(duration);
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LossReason {
    OwnedExit,
    ProtocolRejected,
    InspectionFailed,
    StartupFailed,
    RuntimeUnavailable,
    BudgetExhausted,
    DeadlineExpired,
    Cancelled,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum RecoveryState {
    Unavailable,
    Starting,
    Running,
    Recovering,
    Backoff,
    Failed,
    Stopping,
    Stopped,
    CleanupFailed,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Snapshot {
    pub state: RecoveryState,
    pub reason: Option<LossReason>,
    pub automatic_relaunches: u8,
    pub generation: Option<u32>,
    pub authority_epoch: u64,
    pub revision: u64,
}
#[derive(Clone, Copy)]
pub struct RecoveryPolicy {
    pub automatic_relaunch_limit: u8,
    pub backoffs: [Duration; 2],
    pub cycle_budget: Duration,
    pub cleanup_reserve: Duration,
}
impl Default for RecoveryPolicy {
    fn default() -> Self {
        Self {
            automatic_relaunch_limit: 2,
            backoffs: [Duration::from_millis(250), Duration::from_secs(1)],
            cycle_budget: Duration::from_secs(24),
            cleanup_reserve: Duration::from_millis(6050),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RecoveryFailure {
    Supervisor(SupervisorError),
    InvalidPolicy,
}

#[derive(Clone)]
pub struct ShutdownSignal {
    authority: Arc<super::authority_hub::AuthorityHub>,
}
impl ShutdownSignal {
    pub fn close(&self) {
        self.authority.close();
    }
    pub fn is_closed(&self) -> bool {
        self.authority.cancellation_handle().load(Ordering::Acquire)
    }
}
#[derive(Clone, Copy)]
enum Phase {
    Idle,
    Running,
    PendingLoss {
        reason: LossReason,
        deadline: Duration,
    },
    Cleanup {
        reason: LossReason,
        deadline: Duration,
    },
    Backoff {
        until: Duration,
        deadline: Duration,
    },
    Terminal,
}
pub struct RestartOwner<A: RuntimeAdapter, C: Clock> {
    supervisor: Supervisor<A, Arc<C>>,
    clock: Arc<C>,
    policy: RecoveryPolicy,
    snapshot: Snapshot,
    phase: Phase,
    initial_started: bool,
    quit_cleanup_attempted: bool,
}
impl<A: RuntimeAdapter, C: Clock> RestartOwner<A, C> {
    pub fn new(
        adapter: A,
        clock: C,
        process_policy: Policy,
        policy: RecoveryPolicy,
    ) -> Result<Self, RecoveryFailure> {
        let minimum_cleanup = process_policy
            .shutdown_timeout
            .checked_mul(2)
            .and_then(|v| v.checked_add(Duration::from_millis(50)))
            .ok_or(RecoveryFailure::InvalidPolicy)?;
        if policy.automatic_relaunch_limit > 2
            || policy.backoffs[0].is_zero()
            || policy.backoffs[0] > policy.backoffs[1]
            || policy.backoffs[1] > Duration::from_secs(1)
            || policy.cycle_budget > Duration::from_secs(24)
            || policy.cycle_budget <= policy.cleanup_reserve
            || policy.cleanup_reserve < minimum_cleanup
            || process_policy.startup_timeout > Duration::from_secs(10)
            || process_policy.shutdown_timeout > Duration::from_secs(3)
            || process_policy.poll_interval > Duration::from_millis(10)
        {
            return Err(RecoveryFailure::InvalidPolicy);
        }
        let clock = Arc::new(clock);
        let supervisor = Supervisor::new(adapter, Arc::clone(&clock), process_policy)
            .map_err(RecoveryFailure::Supervisor)?;
        Ok(Self {
            supervisor,
            clock,
            policy,
            phase: Phase::Idle,
            initial_started: false,
            quit_cleanup_attempted: false,
            snapshot: Snapshot {
                state: RecoveryState::Unavailable,
                reason: None,
                automatic_relaunches: 0,
                generation: None,
                authority_epoch: 0,
                revision: 0,
            },
        })
    }
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            authority_epoch: self.supervisor.authority_handle().current_epoch(),
            ..self.snapshot
        }
    }
    pub fn quit_handle(&self) -> Arc<AtomicBool> {
        self.supervisor.cancellation_handle()
    }
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        ShutdownSignal {
            authority: self.supervisor.authority_handle(),
        }
    }
    pub(super) fn authority_handle(&self) -> Arc<super::authority_hub::AuthorityHub> {
        self.supervisor.authority_handle()
    }
    pub(super) fn invalidate_poisoned_authority(&mut self) {
        self.supervisor.invalidate_poisoned_authority();
        self.supervisor.withdraw_generation();
        self.phase = Phase::Terminal;
        self.publish(RecoveryState::Failed, Some(LossReason::InspectionFailed));
    }
    fn publish(&mut self, state: RecoveryState, reason: Option<LossReason>) {
        self.snapshot.state = state;
        self.snapshot.reason = reason;
        self.snapshot.generation = self
            .supervisor
            .identity()
            .map(|identity| identity.generation);
        if let Some(revision) = self.snapshot.revision.checked_add(1) {
            self.snapshot.revision = revision;
        } else {
            self.supervisor.authority_handle().close();
            self.supervisor.withdraw_generation();
            self.phase = Phase::Terminal;
            self.snapshot.state = RecoveryState::Failed;
            self.snapshot.reason = Some(LossReason::InspectionFailed);
            self.snapshot.generation = None;
        }
    }
    pub fn start_initial(&mut self) -> Result<ServiceIdentity, RecoveryFailure> {
        if self.initial_started {
            return Err(RecoveryFailure::Supervisor(SupervisorError::AlreadyRunning));
        }
        self.initial_started = true;
        self.publish(RecoveryState::Starting, None);
        match self.supervisor.start() {
            Ok(identity) => {
                self.phase = Phase::Running;
                self.publish(RecoveryState::Running, None);
                Ok(identity)
            }
            Err(error) => {
                let reason = if error == SupervisorError::RuntimeUnavailable {
                    LossReason::RuntimeUnavailable
                } else if error == SupervisorError::Cancelled {
                    LossReason::Cancelled
                } else {
                    LossReason::StartupFailed
                };
                self.phase = Phase::Terminal;
                self.publish(
                    if self.supervisor.has_owned_process() {
                        RecoveryState::CleanupFailed
                    } else if reason == LossReason::RuntimeUnavailable {
                        RecoveryState::Unavailable
                    } else {
                        RecoveryState::Failed
                    },
                    Some(reason),
                );
                Err(RecoveryFailure::Supervisor(error))
            }
        }
    }
    fn originating_reason(&self, error: SupervisorError) -> LossReason {
        match self.supervisor.failure_cause().unwrap_or(error) {
            SupervisorError::ChildExited => LossReason::OwnedExit,
            SupervisorError::ProtocolRejected => LossReason::ProtocolRejected,
            SupervisorError::Cancelled => LossReason::Cancelled,
            _ => LossReason::InspectionFailed,
        }
    }
    fn observe_loss(&mut self, error: SupervisorError) {
        if !matches!(self.phase, Phase::Running) {
            return;
        }
        // Withdrawal precedes any cleanup, backoff, or replacement publication.
        self.supervisor.withdraw_generation();
        let reason = self.originating_reason(error);
        let deadline = self.clock.now().saturating_add(self.policy.cycle_budget);
        self.phase = Phase::PendingLoss { reason, deadline };
        self.publish(RecoveryState::Failed, Some(reason));
    }
    #[cfg(test)]
    pub fn with_running_session<R>(
        &mut self,
        callback: impl FnOnce(&ServiceIdentity, &str, Arc<AtomicBool>) -> R,
    ) -> Result<R, SupervisorError> {
        self.client_session()?;
        self.supervisor.with_running_session(callback)
    }
    pub fn client_session(&mut self) -> Result<super::NativeSession, SupervisorError> {
        if !matches!(self.phase, Phase::Running) {
            return Err(SupervisorError::RuntimeUnavailable);
        }
        let result = self.supervisor.client_session();
        if let Err(error) = result.as_ref() {
            self.observe_loss(*error);
        }
        result
    }
    pub fn poll(&mut self) -> Result<Snapshot, RecoveryFailure> {
        if self.quit_handle().load(Ordering::Acquire) {
            self.supervisor.withdraw_generation();
            if !self.quit_cleanup_attempted {
                self.shutdown()?;
            }
            return Ok(self.snapshot());
        }
        match self.phase {
            Phase::Running => {
                match self.supervisor.observe() {
                    Ok(super::ServiceState::Running) => {}
                    Ok(_) => self.observe_loss(
                        self.supervisor
                            .failure_cause()
                            .unwrap_or(SupervisorError::ChildExited),
                    ),
                    Err(error) => self.observe_loss(error),
                }
                if let Phase::PendingLoss { reason, deadline } = self.phase {
                    self.phase = Phase::Cleanup { reason, deadline };
                    self.publish(RecoveryState::Recovering, Some(reason));
                }
            }
            Phase::PendingLoss { reason, deadline } => {
                self.phase = Phase::Cleanup { reason, deadline };
                self.publish(RecoveryState::Recovering, Some(reason));
            }
            Phase::Cleanup { reason, deadline } => {
                self.supervisor.withdraw_generation();
                if let Err(error) = self.supervisor.shutdown() {
                    self.phase = Phase::Terminal;
                    self.publish(RecoveryState::CleanupFailed, Some(reason));
                    return Err(RecoveryFailure::Supervisor(error));
                }
                if reason != LossReason::OwnedExit {
                    self.phase = Phase::Terminal;
                    self.publish(RecoveryState::Failed, Some(reason));
                } else if self.clock.now() >= deadline {
                    self.phase = Phase::Terminal;
                    self.publish(RecoveryState::Failed, Some(LossReason::DeadlineExpired));
                } else if self.snapshot.automatic_relaunches >= self.policy.automatic_relaunch_limit
                {
                    self.phase = Phase::Terminal;
                    self.publish(RecoveryState::Failed, Some(LossReason::BudgetExhausted));
                } else {
                    let index = usize::from(self.snapshot.automatic_relaunches);
                    self.snapshot.automatic_relaunches += 1;
                    self.phase = Phase::Backoff {
                        until: self.clock.now().saturating_add(self.policy.backoffs[index]),
                        deadline,
                    };
                    self.publish(RecoveryState::Backoff, Some(reason));
                }
            }
            Phase::Backoff { until, deadline } => {
                let startup_deadline = deadline.saturating_sub(self.policy.cleanup_reserve);
                if self.clock.now() >= startup_deadline {
                    self.phase = Phase::Terminal;
                    self.publish(RecoveryState::Failed, Some(LossReason::DeadlineExpired));
                } else if self.clock.now() >= until {
                    self.publish(RecoveryState::Starting, Some(LossReason::OwnedExit));
                    match self.supervisor.start_until(startup_deadline) {
                        Ok(_) => {
                            if self.clock.now() >= startup_deadline {
                                self.fail_start(
                                    if self.clock.now() >= startup_deadline {
                                        LossReason::DeadlineExpired
                                    } else {
                                        LossReason::StartupFailed
                                    },
                                    true,
                                );
                            } else {
                                self.phase = Phase::Running;
                                self.publish(RecoveryState::Running, None);
                            }
                        }
                        Err(_) => self.fail_start(
                            if self.clock.now() >= startup_deadline {
                                LossReason::DeadlineExpired
                            } else {
                                LossReason::StartupFailed
                            },
                            false,
                        ),
                    }
                }
            }
            Phase::Idle | Phase::Terminal => {}
        }
        Ok(self.snapshot())
    }
    fn fail_start(&mut self, reason: LossReason, cleanup_allowed: bool) {
        self.supervisor.withdraw_generation();
        self.phase = Phase::Terminal;
        // A failed startup may already have attempted bounded cleanup; retain a failed handle.
        let cleanup_failed = self.supervisor.has_owned_process()
            && (!cleanup_allowed || self.supervisor.shutdown().is_err());
        self.publish(
            if cleanup_failed {
                RecoveryState::CleanupFailed
            } else {
                RecoveryState::Failed
            },
            Some(reason),
        );
    }
    pub fn shutdown(&mut self) -> Result<(), RecoveryFailure> {
        self.shutdown_signal().close();
        self.quit_cleanup_attempted = true;
        self.supervisor.withdraw_generation();
        self.phase = Phase::Terminal;
        self.publish(RecoveryState::Stopping, Some(LossReason::Cancelled));
        if let Err(error) = self.supervisor.shutdown() {
            self.publish(RecoveryState::CleanupFailed, Some(LossReason::Cancelled));
            return Err(RecoveryFailure::Supervisor(error));
        }
        self.publish(RecoveryState::Stopped, None);
        Ok(())
    }
}
impl<A: RuntimeAdapter, C: Clock> Drop for RestartOwner<A, C> {
    fn drop(&mut self) {
        self.supervisor.withdraw_generation();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::{Bootstrap, OwnedProcess, SpawnPermit, protocol::ReadyFrame};
    use std::{
        collections::VecDeque,
        io::Cursor,
        sync::{Mutex, atomic::AtomicU64},
    };

    #[derive(Clone, Default)]
    struct FakeClock(Arc<AtomicU64>);
    impl Clock for FakeClock {
        fn now(&self) -> Duration {
            Duration::from_nanos(self.0.load(Ordering::Acquire))
        }
        fn pause(&self, duration: Duration) {
            self.0
                .fetch_add(duration.as_nanos() as u64, Ordering::AcqRel);
        }
    }
    #[derive(Default)]
    struct Control {
        dead: AtomicBool,
        protocol_bad: AtomicBool,
        cleanup_pending: AtomicBool,
        never_ready: AtomicBool,
        wrong_generation: AtomicBool,
        close_calls: AtomicU64,
    }
    #[derive(Default)]
    struct Record {
        spawns: usize,
        max_live: usize,
        controls: Vec<Arc<Control>>,
        queued: VecDeque<Arc<Control>>,
        bootstrap: Vec<ValuePair>,
    }
    struct ValuePair {
        identity: ServiceIdentity,
        token: String,
    }
    struct Adapter(Arc<Mutex<Record>>);
    struct Child {
        control: Arc<Control>,
        identity: Option<ServiceIdentity>,
        acked: bool,
    }
    impl OwnedProcess for Child {
        fn observe_alive(&self) -> Result<bool, SupervisorError> {
            Ok(!self.control.dead.load(Ordering::Acquire))
        }
        fn write_bootstrap(&mut self, bootstrap: &Bootstrap<'_>) -> Result<(), SupervisorError> {
            let mut bytes = Vec::new();
            bootstrap.write_to(&mut bytes).unwrap();
            let value: serde_json::Value = serde_json::from_slice(&bytes[4..]).unwrap();
            self.identity = Some(ServiceIdentity {
                instance_id: value["instance_id"].as_str().unwrap().into(),
                generation: value["generation"].as_u64().unwrap() as u32,
                bind_port: value["bind_port"].as_u64().unwrap() as u16,
            });
            Ok(())
        }
        fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
            if self.control.protocol_bad.load(Ordering::Acquire) {
                return Err(SupervisorError::ProtocolRejected);
            }
            if self.acked || self.control.never_ready.load(Ordering::Acquire) {
                return Ok(None);
            }
            self.acked = true;
            let identity = self.identity.as_ref().unwrap();
            let generation = identity.generation
                + u32::from(self.control.wrong_generation.load(Ordering::Acquire));
            let bytes=serde_json::to_vec(&serde_json::json!({"protocol":"JAPP_SERVICE_STATUS_V1","schema_version":"1.0.0","status":"READY","bind_host":"127.0.0.1","bind_port":identity.bind_port,"instance_id":identity.instance_id,"generation":generation})).unwrap();
            let mut frame = (bytes.len() as u32).to_be_bytes().to_vec();
            frame.extend(bytes);
            Ok(Some(
                ReadyFrame::read_from(&mut Cursor::new(frame)).unwrap(),
            ))
        }
        fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
            if self.control.dead.load(Ordering::Acquire) {
                if self.control.cleanup_pending.load(Ordering::Acquire) {
                    Err(SupervisorError::CleanupPending)
                } else {
                    Ok(Some(70))
                }
            } else {
                Ok(None)
            }
        }
        fn close_lease(&mut self) {
            self.control.close_calls.fetch_add(1, Ordering::AcqRel);
            self.control.dead.store(true, Ordering::Release);
        }
        fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
            self.control.dead.store(true, Ordering::Release);
            Ok(())
        }
    }
    impl RuntimeAdapter for Adapter {
        fn check_runtime(&self) -> Result<(), SupervisorError> {
            Ok(())
        }
        fn choose_port(&self) -> Result<u16, SupervisorError> {
            Ok(42000 + self.0.lock().unwrap().spawns as u16)
        }
        fn create_identity(
            &self,
            generation: u32,
            port: u16,
        ) -> Result<(ServiceIdentity, String), SupervisorError> {
            let identity = ServiceIdentity {
                instance_id: format!("svc_{generation:026}"),
                generation,
                bind_port: port,
            };
            let token = format!("{generation:064x}");
            self.0.lock().unwrap().bootstrap.push(ValuePair {
                identity: identity.clone(),
                token: token.clone(),
            });
            Ok((identity, token))
        }
        fn spawn(
            &self,
            permit: &SpawnPermit<'_>,
        ) -> Result<Box<dyn OwnedProcess>, SupervisorError> {
            permit.check()?;
            let mut record = self.0.lock().unwrap();
            let control = record.queued.pop_front().unwrap_or_default();
            record.spawns += 1;
            record.controls.push(Arc::clone(&control));
            let live = record
                .controls
                .iter()
                .filter(|control| !control.dead.load(Ordering::Acquire))
                .count();
            record.max_live = record.max_live.max(live);
            Ok(Box::new(Child {
                control,
                identity: None,
                acked: false,
            }))
        }
    }
    struct NativeSource(super::super::NativeSession);
    impl crate::diagnostics::core::engine::SessionSource for NativeSource {
        fn snapshot(&self) -> crate::diagnostics::core::engine::Snapshot {
            crate::diagnostics::owner::snapshot_from_native(self.0.clone()).0
        }
        fn guarded_snapshot(&self) -> (crate::diagnostics::core::engine::Snapshot, Option<u64>) {
            crate::diagnostics::owner::snapshot_from_native(self.0.clone())
        }
        fn current_epoch(&self) -> Option<u64> {
            Some(self.0.authority_epoch)
        }
    }
    struct RemoteFailure;
    impl crate::diagnostics::core::engine::DiagnosticReader for RemoteFailure {
        fn read<'a>(
            &'a self,
            _: Arc<crate::api_client::client::Session>,
            _: crate::api_client::client::Cancellation,
            _: &'a str,
        ) -> crate::diagnostics::core::engine::ReadFuture<'a> {
            Box::pin(async { Err(crate::api_client::Failure::Timeout) })
        }
    }
    type Owner = RestartOwner<Adapter, FakeClock>;
    fn harness() -> (Owner, Arc<Mutex<Record>>, FakeClock) {
        let record = Arc::new(Mutex::new(Record::default()));
        let clock = FakeClock::default();
        let policy = Policy {
            startup_timeout: Duration::from_millis(50),
            shutdown_timeout: Duration::from_millis(30),
            poll_interval: Duration::from_millis(10),
            bind_attempts: 3,
        };
        (
            RestartOwner::new(
                Adapter(Arc::clone(&record)),
                clock.clone(),
                policy,
                RecoveryPolicy::default(),
            )
            .unwrap(),
            record,
            clock,
        )
    }
    fn current(record: &Arc<Mutex<Record>>) -> Arc<Control> {
        Arc::clone(record.lock().unwrap().controls.last().unwrap())
    }
    fn crash(record: &Arc<Mutex<Record>>) {
        current(record).dead.store(true, Ordering::Release);
    }
    fn drive(owner: &mut Owner, clock: &FakeClock) {
        for _ in 0..6 {
            let _ = owner.poll();
            clock.pause(Duration::from_secs(1));
        }
    }
    #[test]
    fn owned_death_revokes_before_backoff_and_does_not_spawn_immediately() {
        let (mut owner, record, _) = harness();
        owner.start_initial().unwrap();
        let ticket = owner.client_session().unwrap();
        crash(&record);
        let snapshot = owner.poll().unwrap();
        assert_eq!(snapshot.state, RecoveryState::Recovering);
        assert_eq!(record.lock().unwrap().spawns, 1);
        assert!(!ticket.valid.load(Ordering::Acquire));
        assert!(snapshot.generation.is_none());
    }
    #[test]
    fn backoff_is_monotonic_and_duplicate_observations_do_not_spawn() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        crash(&record);
        owner.poll().unwrap();
        owner.poll().unwrap();
        assert_eq!(owner.snapshot().state, RecoveryState::Backoff);
        for _ in 0..5 {
            owner.poll().unwrap();
        }
        assert_eq!(record.lock().unwrap().spawns, 1);
        clock.pause(Duration::from_millis(249));
        owner.poll().unwrap();
        assert_eq!(record.lock().unwrap().spawns, 1);
        clock.pause(Duration::from_millis(1));
        owner.poll().unwrap();
        assert_eq!(record.lock().unwrap().spawns, 2);
        assert_eq!(record.lock().unwrap().max_live, 1);
    }
    #[test]
    fn two_relaunches_are_lifetime_budget_and_uptime_never_refills_it() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        for _ in 0..3 {
            crash(&record);
            drive(&mut owner, &clock);
            clock.pause(Duration::from_secs(3600));
        }
        assert_eq!(record.lock().unwrap().spawns, 3);
        assert_eq!(owner.snapshot().state, RecoveryState::Failed);
        assert_eq!(owner.snapshot().reason, Some(LossReason::BudgetExhausted));
    }
    #[test]
    fn failed_replacement_is_terminal_instead_of_a_hidden_startup_loop() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let next = Arc::new(Control::default());
        next.never_ready.store(true, Ordering::Release);
        record.lock().unwrap().queued.push_back(next);
        crash(&record);
        drive(&mut owner, &clock);
        assert_eq!(record.lock().unwrap().spawns, 2);
        assert_eq!(owner.snapshot().state, RecoveryState::Failed);
        assert_eq!(owner.snapshot().reason, Some(LossReason::StartupFailed));
    }
    #[test]
    fn callback_protocol_failure_is_not_relabelled_as_owned_exit() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        current(&record).protocol_bad.store(true, Ordering::Release);
        assert!(owner.with_running_session(|_, _, _| ()).is_err());
        drive(&mut owner, &clock);
        assert_eq!(record.lock().unwrap().spawns, 1);
        assert_eq!(owner.snapshot().reason, Some(LossReason::ProtocolRejected));
    }
    #[test]
    fn callback_observed_death_retains_origin_until_owner_schedules_it_once() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        crash(&record);
        assert!(owner.with_running_session(|_, _, _| ()).is_err());
        assert!(owner.with_running_session(|_, _, _| ()).is_err());
        owner.poll().unwrap();
        assert_eq!(owner.snapshot().state, RecoveryState::Recovering);
        assert_eq!(record.lock().unwrap().spawns, 1);
        drive(&mut owner, &clock);
        assert_eq!(record.lock().unwrap().spawns, 2);
    }
    #[test]
    fn cleanup_pending_retains_ownership_and_forbids_replacement() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let control = current(&record);
        control.cleanup_pending.store(true, Ordering::Release);
        crash(&record);
        drive(&mut owner, &clock);
        assert_eq!(record.lock().unwrap().spawns, 1);
        assert_eq!(owner.snapshot().state, RecoveryState::CleanupFailed);
        control.cleanup_pending.store(false, Ordering::Release);
        owner.shutdown().unwrap();
        assert_eq!(owner.snapshot().state, RecoveryState::Stopped);
    }
    #[test]
    fn quit_during_backoff_is_permanent_and_forbids_every_future_spawn() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        crash(&record);
        owner.poll().unwrap();
        owner.poll().unwrap();
        let quit = owner.quit_handle();
        quit.store(true, Ordering::Release);
        drive(&mut owner, &clock);
        assert!(quit.load(Ordering::Acquire));
        assert_eq!(record.lock().unwrap().spawns, 1);
        assert_eq!(owner.snapshot().state, RecoveryState::Stopped);
    }
    #[test]
    fn cycle_deadline_expires_in_backoff_without_late_restart() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        crash(&record);
        owner.poll().unwrap();
        owner.poll().unwrap();
        clock.pause(Duration::from_secs(24));
        owner.poll().unwrap();
        assert_eq!(record.lock().unwrap().spawns, 1);
        assert_eq!(owner.snapshot().state, RecoveryState::Failed);
        assert_eq!(owner.snapshot().reason, Some(LossReason::DeadlineExpired));
    }
    #[test]
    fn wrong_generation_replacement_ack_cannot_authorize_running() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let next = Arc::new(Control::default());
        next.wrong_generation.store(true, Ordering::Release);
        record.lock().unwrap().queued.push_back(next);
        crash(&record);
        drive(&mut owner, &clock);
        assert_eq!(record.lock().unwrap().spawns, 2);
        assert_eq!(owner.snapshot().state, RecoveryState::Failed);
        assert!(owner.client_session().is_err());
    }
    #[tokio::test(flavor = "current_thread")]
    async fn http_failure_alone_does_not_restart_a_live_owned_child() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        for _ in 0..10 {
            let native = owner.client_session().unwrap();
            let engine = crate::diagnostics::core::engine::Engine::new(
                Arc::new(NativeSource(native)),
                Arc::new(RemoteFailure),
            )
            .unwrap();
            let error = engine
                .read(
                    "main",
                    "tauri://localhost",
                    false,
                    &serde_json::json!({"request_id":"req_00000000000000000000000001"}),
                )
                .await
                .unwrap_err();
            assert_eq!(error["payload"]["code"], "TRANSPORT_TIMEOUT");
            owner.poll().unwrap();
            clock.pause(Duration::from_secs(1));
        }
        assert_eq!(record.lock().unwrap().spawns, 1);
        assert_eq!(owner.snapshot().state, RecoveryState::Running);
    }
    #[test]
    fn successful_relaunch_uses_fresh_identity_token_port_and_validity() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let first = owner.with_running_session(|_, _, valid| valid).unwrap();
        crash(&record);
        drive(&mut owner, &clock);
        let second = owner.with_running_session(|_, _, valid| valid).unwrap();
        assert!(!first.load(Ordering::Acquire));
        assert!(second.load(Ordering::Acquire));
        assert!(!Arc::ptr_eq(&first, &second));
        let record = record.lock().unwrap();
        assert_ne!(
            record.bootstrap[0].identity.instance_id,
            record.bootstrap[1].identity.instance_id
        );
        assert_ne!(
            record.bootstrap[0].identity.bind_port,
            record.bootstrap[1].identity.bind_port
        );
        assert_ne!(record.bootstrap[0].token, record.bootstrap[1].token);
        assert!(record.bootstrap[1].identity.generation > record.bootstrap[0].identity.generation);
    }
    #[test]
    fn failed_replacement_cleanup_is_not_silently_retried_inside_the_cycle() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let next = Arc::new(Control::default());
        next.never_ready.store(true, Ordering::Release);
        next.cleanup_pending.store(true, Ordering::Release);
        record.lock().unwrap().queued.push_back(Arc::clone(&next));
        crash(&record);
        owner.poll().unwrap();
        owner.poll().unwrap();
        clock.pause(Duration::from_secs(1));
        let before = clock.now();
        owner.poll().unwrap();
        assert_eq!(next.close_calls.load(Ordering::Acquire), 1);
        assert!(clock.now() - before <= Duration::from_millis(110));
        assert_eq!(owner.snapshot().state, RecoveryState::CleanupFailed);
        for _ in 0..5 {
            let _ = owner.poll();
        }
        assert_eq!(next.close_calls.load(Ordering::Acquire), 1);
        next.cleanup_pending.store(false, Ordering::Release);
        owner.shutdown().unwrap();
    }
    #[test]
    fn remaining_cycle_budget_clips_startup_and_rejects_late_authority() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let next = Arc::new(Control::default());
        next.never_ready.store(true, Ordering::Release);
        record.lock().unwrap().queued.push_back(next);
        crash(&record);
        owner.poll().unwrap();
        owner.poll().unwrap();
        clock.pause(Duration::from_millis(17940));
        owner.poll().unwrap();
        assert!(clock.now() <= Duration::from_millis(17950));
        assert_eq!(owner.snapshot().reason, Some(LossReason::DeadlineExpired));
        assert!(owner.snapshot().generation.is_none());
        assert_eq!(record.lock().unwrap().spawns, 2);
    }
    #[test]
    fn recovery_policy_cannot_expand_the_reviewed_bounds() {
        for policy in [
            RecoveryPolicy {
                automatic_relaunch_limit: 3,
                ..RecoveryPolicy::default()
            },
            RecoveryPolicy {
                cycle_budget: Duration::from_secs(25),
                ..RecoveryPolicy::default()
            },
            RecoveryPolicy {
                cleanup_reserve: Duration::from_millis(1),
                ..RecoveryPolicy::default()
            },
            RecoveryPolicy {
                backoffs: [Duration::from_secs(1), Duration::from_millis(250)],
                ..RecoveryPolicy::default()
            },
        ] {
            let record = Arc::new(Mutex::new(Record::default()));
            assert!(matches!(
                RestartOwner::new(
                    Adapter(Arc::clone(&record)),
                    FakeClock::default(),
                    Policy::default(),
                    policy
                ),
                Err(RecoveryFailure::InvalidPolicy)
            ));
            assert_eq!(record.lock().unwrap().spawns, 0);
        }
    }
    #[test]
    fn owner_drop_withdraws_requests_that_outlive_the_owner() {
        let (mut owner, _, _) = harness();
        owner.start_initial().unwrap();
        let flag = owner.with_running_session(|_, _, flag| flag).unwrap();
        let ticket = owner.client_session().unwrap();
        drop(owner);
        assert!(!flag.load(Ordering::Acquire));
        assert!(!ticket.valid.load(Ordering::Acquire));
    }
    #[test]
    fn accepted_shutdown_signal_returns_before_held_hub_bookkeeping_releases() {
        let (mut owner, _, _) = harness();
        owner.start_initial().unwrap();
        let valid = owner.with_running_session(|_, _, valid| valid).unwrap();
        let ticket = owner.client_session().unwrap();
        let signal = owner.shutdown_signal();
        let hub = crate::diagnostics::core::Registry::new();
        let (held, ready) = std::sync::mpsc::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let locker = std::thread::spawn(move || hub.hold_bookkeeping_for_test(held, wait));
        ready.recv().unwrap();
        let (sent, result) = std::sync::mpsc::channel();
        let command = std::thread::spawn(move || {
            signal.close();
            sent.send(()).unwrap();
        });
        let early = result.recv_timeout(Duration::from_millis(100));
        let native_revoked_before_release = !valid.load(Ordering::Acquire);
        release.send(()).unwrap();
        locker.join().unwrap();
        command.join().unwrap();
        assert!(native_revoked_before_release);
        assert!(early.is_ok(), "accepted Quit waited for hub mutex");
        assert!(!ticket.valid.load(Ordering::Acquire));
        owner.shutdown().unwrap();
    }
    #[test]
    fn native_running_session_and_begin_remain_prompt_under_held_hub_bookkeeping() {
        let (mut owner, _, _) = harness();
        owner.start_initial().unwrap();
        let hub = crate::diagnostics::core::Registry::new();
        let (held, ready) = std::sync::mpsc::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let registry = Arc::clone(&hub);
        let locker = std::thread::spawn(move || hub.hold_bookkeeping_for_test(held, wait));
        ready.recv().unwrap();
        let (sent, result) = std::sync::mpsc::channel();
        let command = std::thread::spawn(move || {
            let snapshot = owner.client_session().is_ok();
            let busy = matches!(
                registry.begin("req_00000000000000000000000001"),
                Err(crate::diagnostics::core::BoundaryError::Busy)
            );
            sent.send((snapshot, busy)).unwrap();
            owner
        });
        let early = result.recv_timeout(Duration::from_millis(100));
        release.send(()).unwrap();
        locker.join().unwrap();
        let mut owner = command.join().unwrap();
        assert!(early.is_ok(), "native callback blocked on hub mutex");
        assert_eq!(early.unwrap(), (true, true));
        owner.shutdown().unwrap();
    }
    // These exercise the shipping owner and Engine. Transport is a synthetic
    // reader; no socket or child process is created by this fake RuntimeAdapter.
    struct OwnerSource {
        owner: Arc<Mutex<Owner>>,
        authority: Arc<super::super::authority_hub::AuthorityHub>,
    }
    impl crate::diagnostics::core::engine::SessionSource for OwnerSource {
        fn snapshot(&self) -> crate::diagnostics::core::engine::Snapshot {
            self.guarded_snapshot().0
        }
        fn guarded_snapshot(&self) -> (crate::diagnostics::core::engine::Snapshot, Option<u64>) {
            use crate::diagnostics::core::engine::Snapshot;
            match self.owner.try_lock() {
                Ok(mut owner) => match owner.client_session() {
                    Ok(native) => crate::diagnostics::owner::snapshot_from_native(native),
                    Err(_) => (
                        Snapshot::Unavailable(crate::diagnostics::owner::diagnostic_state(
                            owner.snapshot().state,
                        )),
                        None,
                    ),
                },
                Err(_) => (Snapshot::Unavailable("UNAVAILABLE"), None),
            }
        }
        fn current_epoch(&self) -> Option<u64> {
            Some(self.authority.current_epoch())
        }
    }
    struct ReplaceAtCompletion {
        owner: Arc<Mutex<Owner>>,
        record: Arc<Mutex<Record>>,
        clock: FakeClock,
        original: Arc<crate::api_client::client::Session>,
    }
    impl crate::diagnostics::core::engine::DiagnosticReader for ReplaceAtCompletion {
        fn read<'a>(
            &'a self,
            session: Arc<crate::api_client::client::Session>,
            _: crate::api_client::client::Cancellation,
            _: &'a str,
        ) -> crate::diagnostics::core::engine::ReadFuture<'a> {
            Box::pin(async move {
                assert!(Arc::ptr_eq(&session, &self.original));
                crash(&self.record);
                let mut owner = self.owner.lock().unwrap();
                drive(&mut owner, &self.clock);
                assert_eq!(owner.snapshot().state, RecoveryState::Running);
                let replacement = owner.client_session().unwrap();
                assert!(!Arc::ptr_eq(&replacement.session, &session));
                Ok(crate::diagnostics::core::engine::Versions {
                    service: "0.0.1".into(),
                    api: "1.0.0".into(),
                })
            })
        }
    }
    struct FirstPending {
        calls: AtomicU64,
        entered: AtomicBool,
    }
    impl crate::diagnostics::core::engine::DiagnosticReader for FirstPending {
        fn read<'a>(
            &'a self,
            _: Arc<crate::api_client::client::Session>,
            _: crate::api_client::client::Cancellation,
            _: &'a str,
        ) -> crate::diagnostics::core::engine::ReadFuture<'a> {
            Box::pin(async move {
                if self.calls.fetch_add(1, Ordering::AcqRel) == 0 {
                    self.entered.store(true, Ordering::Release);
                    tokio::time::sleep(Duration::from_secs(20)).await;
                }
                Ok(crate::diagnostics::core::engine::Versions {
                    service: "0.0.1".into(),
                    api: "1.0.0".into(),
                })
            })
        }
    }
    #[test]
    fn recovery_reuses_ack_minted_arc_until_withdrawal_then_mints_only_new_generation() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let first = owner.client_session().unwrap();
        let repeat = owner.client_session().unwrap();
        assert!(Arc::ptr_eq(&first.session, &repeat.session));
        assert!(Arc::ptr_eq(&first.valid, &repeat.valid));
        assert_eq!(first.authority_epoch, repeat.authority_epoch);
        let control = current(&record);
        crash(&record);
        owner.poll().unwrap();
        assert_eq!(owner.snapshot().state, RecoveryState::Recovering);
        assert_eq!(control.close_calls.load(Ordering::Acquire), 0);
        assert!(!first.valid.load(Ordering::Acquire));
        assert!(owner.authority_handle().current_epoch() > first.authority_epoch);
        assert!(owner.client_session().is_err());
        drive(&mut owner, &clock);
        let next = owner.client_session().unwrap();
        assert!(next.authority_epoch > first.authority_epoch);
        assert!(next.valid.load(Ordering::Acquire));
        assert!(!first.valid.load(Ordering::Acquire));
        assert!(!Arc::ptr_eq(&next.session, &first.session));
        assert!(!Arc::ptr_eq(&next.valid, &first.valid));
        assert_eq!(control.close_calls.load(Ordering::Acquire), 1);
        assert_eq!(record.lock().unwrap().spawns, 2);
        owner.shutdown().unwrap();
    }
    #[tokio::test(flavor = "current_thread")]
    async fn old_engine_completion_fails_even_after_replacement_is_ready() {
        let (mut owner, record, clock) = harness();
        owner.start_initial().unwrap();
        let first = owner.client_session().unwrap();
        let authority = owner.authority_handle();
        let owner = Arc::new(Mutex::new(owner));
        let engine = crate::diagnostics::core::engine::Engine::new(
            Arc::new(OwnerSource {
                owner: Arc::clone(&owner),
                authority,
            }),
            Arc::new(ReplaceAtCompletion {
                owner: Arc::clone(&owner),
                record: Arc::clone(&record),
                clock,
                original: Arc::clone(&first.session),
            }),
        )
        .unwrap();
        let result = engine
            .read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":"req_00000000000000000000000001"}),
            )
            .await
            .unwrap_err();
        assert_eq!(result["payload"]["code"], "TRANSPORT_DISCONNECTED");
        assert!(result["payload"].get("service_version").is_none());
        assert_eq!(
            owner.lock().unwrap().snapshot().state,
            RecoveryState::Running
        );
        assert!(!first.valid.load(Ordering::Acquire));
        assert_eq!(record.lock().unwrap().spawns, 2);
        owner.lock().unwrap().shutdown().unwrap();
    }
    #[tokio::test(flavor = "current_thread")]
    async fn engine_action_cancel_does_not_revoke_or_replace_healthy_owner_generation() {
        let (mut owner, record, _) = harness();
        owner.start_initial().unwrap();
        let first = owner.client_session().unwrap();
        let authority = owner.authority_handle();
        let owner = Arc::new(Mutex::new(owner));
        let reader = Arc::new(FirstPending {
            calls: AtomicU64::new(0),
            entered: AtomicBool::new(false),
        });
        let engine = crate::diagnostics::core::engine::Engine::new(
            Arc::new(OwnerSource {
                owner: Arc::clone(&owner),
                authority,
            }),
            reader.clone(),
        )
        .unwrap();
        let body = serde_json::json!({"request_id":"req_00000000000000000000000001"});
        let work = engine.read("main", "tauri://localhost", false, &body);
        tokio::pin!(work);
        tokio::select! {response=&mut work=>panic!("unexpected {response:?}"),_=async {while !reader.entered.load(Ordering::Acquire) {tokio::task::yield_now().await;}}=>{}}
        engine
            .cancel("main", "tauri://localhost", false, &body)
            .unwrap();
        let cancelled = tokio::time::timeout(Duration::from_millis(100), work)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(cancelled["payload"]["state"], "CANCELLED");
        let second = engine
            .read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":"req_00000000000000000000000002"}),
            )
            .await
            .unwrap();
        assert_eq!(second["payload"]["state"], "READY");
        let current = owner.lock().unwrap().client_session().unwrap();
        assert!(Arc::ptr_eq(&first.session, &current.session));
        assert!(first.valid.load(Ordering::Acquire));
        assert_eq!(first.authority_epoch, current.authority_epoch);
        assert_eq!(record.lock().unwrap().spawns, 1);
        owner.lock().unwrap().shutdown().unwrap();
    }
    #[tokio::test(flavor = "current_thread")]
    async fn quit_interrupts_actual_engine_with_held_registry_before_any_cleanup_poll() {
        let (mut owner, record, _) = harness();
        owner.start_initial().unwrap();
        let native = owner.client_session().unwrap();
        let signal = owner.shutdown_signal();
        let authority = owner.authority_handle();
        let owner = Arc::new(Mutex::new(owner));
        let reader = Arc::new(FirstPending {
            calls: AtomicU64::new(0),
            entered: AtomicBool::new(false),
        });
        let engine = crate::diagnostics::core::engine::Engine::new(
            Arc::new(OwnerSource {
                owner: Arc::clone(&owner),
                authority: Arc::clone(&authority),
            }),
            reader.clone(),
        )
        .unwrap();
        let body = serde_json::json!({"request_id":"req_00000000000000000000000001"});
        let work = engine.read("main", "tauri://localhost", false, &body);
        tokio::pin!(work);
        tokio::select! {response=&mut work=>panic!("unexpected {response:?}"),_=async {while !reader.entered.load(Ordering::Acquire) {tokio::task::yield_now().await;}}=>{}}
        let (held, ready) = std::sync::mpsc::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let registry = Arc::clone(&engine.registry);
        let locker = std::thread::spawn(move || registry.hold_bookkeeping_for_test(held, wait));
        ready.recv_timeout(Duration::from_secs(1)).unwrap();
        signal.close();
        assert!(!native.valid.load(Ordering::Acquire));
        assert!(authority.current_epoch() > native.authority_epoch);
        let response = tokio::time::timeout(Duration::from_millis(100), work).await;
        release.send(()).unwrap();
        locker.join().unwrap();
        assert_eq!(
            response.unwrap().unwrap_err()["payload"]["code"],
            "TRANSPORT_DISCONNECTED"
        );
        assert_eq!(current(&record).close_calls.load(Ordering::Acquire), 0);
        owner.lock().unwrap().shutdown().unwrap();
        assert_eq!(record.lock().unwrap().spawns, 1);
    }
    #[test]
    fn permanent_quit_wins_running_observed_loss_cleanup_backoff_and_ready_replacement() {
        for phase in 0..5 {
            let (mut owner, record, clock) = harness();
            owner.start_initial().unwrap();
            let native = owner.client_session().unwrap();
            if phase > 0 {
                crash(&record);
            }
            if phase > 1 {
                owner.poll().unwrap();
            }
            if phase > 2 {
                owner.poll().unwrap();
            }
            if phase > 3 {
                clock.pause(Duration::from_secs(1));
                owner.poll().unwrap();
            }
            let spawns = record.lock().unwrap().spawns;
            let epoch = owner.authority_handle().current_epoch();
            owner.shutdown_signal().close();
            assert!(!native.valid.load(Ordering::Acquire));
            assert!(owner.authority_handle().current_epoch() > epoch);
            assert!(owner.client_session().is_err());
            drive(&mut owner, &clock);
            assert_eq!(owner.snapshot().state, RecoveryState::Stopped);
            assert_eq!(record.lock().unwrap().spawns, spawns);
            assert!(owner.start_initial().is_err());
        }
    }
    #[test]
    fn startup_after_permanent_quit_cannot_mint_session_or_spawn() {
        let (mut owner, record, _) = harness();
        owner.shutdown_signal().close();
        assert_eq!(
            owner.start_initial(),
            Err(RecoveryFailure::Supervisor(SupervisorError::Cancelled))
        );
        assert!(owner.client_session().is_err());
        assert_eq!(record.lock().unwrap().spawns, 0);
    }
    #[tokio::test(flavor = "current_thread")]
    async fn poisoned_action_bookkeeping_cannot_restart_or_revoke_healthy_native_authority() {
        let (mut owner, record, _) = harness();
        owner.start_initial().unwrap();
        let native = owner.client_session().unwrap();
        let authority = owner.authority_handle();
        let owner = Arc::new(Mutex::new(owner));
        let engine = crate::diagnostics::core::engine::Engine::new(
            Arc::new(OwnerSource {
                owner: Arc::clone(&owner),
                authority,
            }),
            Arc::new(RemoteFailure),
        )
        .unwrap();
        let (held, ready) = std::sync::mpsc::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let registry = Arc::clone(&engine.registry);
        let thread = std::thread::spawn(move || registry.hold_bookkeeping_for_test(held, wait));
        ready.recv_timeout(Duration::from_secs(1)).unwrap();
        drop(release);
        assert!(
            thread.join().is_err(),
            "actual action mutex must be poisoned"
        );
        let response = engine
            .read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":"req_00000000000000000000000001"}),
            )
            .await
            .unwrap_err();
        assert_eq!(response["payload"]["code"], "TRANSPORT_SERVICE_UNAVAILABLE");
        let current = owner.lock().unwrap().client_session().unwrap();
        assert!(Arc::ptr_eq(&native.session, &current.session));
        assert!(native.valid.load(Ordering::Acquire));
        assert_eq!(native.authority_epoch, current.authority_epoch);
        assert_eq!(record.lock().unwrap().spawns, 1);
        owner.lock().unwrap().shutdown().unwrap();
    }
    #[test]
    fn review_worker_observed_poll_states_publish_successful_recovery_and_next_loss() {
        use std::sync::atomic::AtomicU8;
        let (mut owner, record, clock) = harness();
        let phase = AtomicU8::new(RecoveryState::Unavailable as u8);
        let cancelled = owner.quit_handle();
        let publish = |state| {
            super::super::tauri_lifecycle::update_background_phase(&phase, &cancelled, state)
        };
        assert!(publish(RecoveryState::Starting));
        owner.start_initial().unwrap();
        assert!(publish(owner.snapshot().state));
        let first = owner.client_session().unwrap();
        crash(&record);
        let mut observed = Vec::new();
        for _ in 0..2 {
            let state = owner.poll().unwrap().state;
            observed.push(state);
            assert!(publish(state));
        }
        clock.pause(Duration::from_millis(250));
        let state = owner.poll().unwrap().state;
        observed.push(state);
        assert_eq!(
            observed,
            [
                RecoveryState::Recovering,
                RecoveryState::Backoff,
                RecoveryState::Running
            ]
        );
        assert!(
            publish(state),
            "actual worker must publish only the final observed owner state"
        );
        assert_eq!(phase.load(Ordering::Acquire), RecoveryState::Running as u8);
        let replacement = owner.client_session().unwrap();
        assert!(replacement.valid.load(Ordering::Acquire));
        assert!(!first.valid.load(Ordering::Acquire));
        assert!(replacement.authority_epoch > first.authority_epoch);
        assert_eq!(record.lock().unwrap().spawns, 2);
        crash(&record);
        let state = owner.poll().unwrap().state;
        assert_eq!(state, RecoveryState::Recovering);
        assert!(publish(state));
        owner.shutdown().unwrap();
    }
}
