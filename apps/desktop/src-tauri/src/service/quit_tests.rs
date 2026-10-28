use super::*;
use crate::service::{
    Bootstrap, OwnedProcess, Policy, ReadyFrame, RuntimeAdapter, ServiceIdentity, SpawnPermit,
    SupervisorError,
    platform_adapters::app_owner::tests::PathsProof,
    restart::{RecoveryPolicy, RestartOwner},
};
use std::sync::atomic::{AtomicU64, AtomicUsize};
#[derive(Default)]
struct FakeClock(AtomicU64);
impl Clock for FakeClock {
    fn now(&self) -> Duration {
        Duration::from_millis(self.0.load(Ordering::Acquire))
    }
    fn pause(&self, d: Duration) {
        self.0.fetch_add(d.as_millis() as u64, Ordering::AcqRel);
    }
}
#[derive(Default)]
struct Sink {
    exits: AtomicUsize,
    failures: AtomicUsize,
}
impl QuitSink for Sink {
    fn finished(&self) {
        self.exits.fetch_add(1, Ordering::AcqRel);
    }
    fn failed(&self) {
        self.failures.fetch_add(1, Ordering::AcqRel);
    }
}
#[derive(Default)]
struct Control {
    dead: AtomicBool,
    ignore_close: AtomicBool,
    ignore_force: AtomicBool,
    calls: Mutex<Vec<&'static str>>,
}
struct Child {
    control: Arc<Control>,
    identity: Option<ServiceIdentity>,
    ready: bool,
}
impl OwnedProcess for Child {
    fn observe_alive(&self) -> Result<bool, SupervisorError> {
        Ok(!self.control.dead.load(Ordering::Acquire))
    }
    fn write_bootstrap(&mut self, b: &Bootstrap<'_>) -> Result<(), SupervisorError> {
        let mut bytes = Vec::new();
        b.write_to(&mut bytes).unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes[4..]).unwrap();
        self.identity = Some(ServiceIdentity {
            instance_id: v["instance_id"].as_str().unwrap().into(),
            generation: v["generation"].as_u64().unwrap() as u32,
            bind_port: v["bind_port"].as_u64().unwrap() as u16,
        });
        Ok(())
    }
    fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
        if self.ready {
            return Ok(None);
        }
        self.ready = true;
        let i = self.identity.as_ref().unwrap();
        let bytes=serde_json::to_vec(&serde_json::json!({"protocol":"JAPP_SERVICE_STATUS_V1","schema_version":"1.0.0","status":"READY","bind_host":"127.0.0.1","bind_port":i.bind_port,"instance_id":i.instance_id,"generation":i.generation})).unwrap();
        let mut framed = (bytes.len() as u32).to_be_bytes().to_vec();
        framed.extend(bytes);
        Ok(Some(
            ReadyFrame::read_from(&mut std::io::Cursor::new(framed)).unwrap(),
        ))
    }
    fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
        Ok(self.control.dead.load(Ordering::Acquire).then_some(0))
    }
    fn close_lease(&mut self) {
        self.control.calls.lock().unwrap().push("graceful");
        if !self.control.ignore_close.load(Ordering::Acquire) {
            self.control.dead.store(true, Ordering::Release)
        }
    }
    fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
        self.control.calls.lock().unwrap().push("force");
        if !self.control.ignore_force.load(Ordering::Acquire) {
            self.control.dead.store(true, Ordering::Release)
        }
        Ok(())
    }
}
#[derive(Clone)]
struct Adapter(Arc<Control>);
impl RuntimeAdapter for Adapter {
    fn check_runtime(&self) -> Result<(), SupervisorError> {
        Ok(())
    }
    fn choose_port(&self) -> Result<u16, SupervisorError> {
        Ok(42001)
    }
    fn create_identity(
        &self,
        g: u32,
        p: u16,
    ) -> Result<(ServiceIdentity, String), SupervisorError> {
        Ok((
            ServiceIdentity {
                instance_id: format!("svc_{g:026}"),
                generation: g,
                bind_port: p,
            },
            format!("{g:064x}"),
        ))
    }
    fn spawn(&self, p: &SpawnPermit<'_>) -> Result<Box<dyn OwnedProcess>, SupervisorError> {
        p.check()?;
        Ok(Box::new(Child {
            control: self.0.clone(),
            identity: None,
            ready: false,
        }))
    }
}
fn fixture() -> (
    QuitCoordinator,
    Arc<FakeClock>,
    Sink,
    RestartOwner<Adapter, FakeClock>,
) {
    let mut owner = RestartOwner::new(
        Adapter(Arc::new(Control::default())),
        FakeClock::default(),
        Policy {
            startup_timeout: Duration::from_millis(50),
            shutdown_timeout: Duration::from_millis(30),
            poll_interval: Duration::from_millis(10),
            bind_attempts: 1,
        },
        RecoveryPolicy::default(),
    )
    .unwrap();
    owner.start_initial().unwrap();
    let clock = owner.clock_handle();
    let gate = Arc::new(ShutdownGate::with_authority(owner.authority_handle()));
    (
        QuitCoordinator::new(clock.clone(), gate),
        clock,
        Sink::default(),
        owner,
    )
}

#[test]
fn quit_total_is_new6050ms_policy_without_recovery_changes() {
    assert_eq!(APP_QUIT_CAP, Duration::from_millis(6050));
    let p = RecoveryPolicy::default();
    assert_eq!(p.cleanup_reserve, APP_QUIT_CAP);
    assert_eq!(p.cycle_budget, Duration::from_secs(24));
    assert_eq!(Policy::default().shutdown_timeout, Duration::from_secs(3));
}
#[test]
fn actual_service_settlement_alone_cannot_complete_app_quit() {
    let (q, _, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let a = q.begin(false).unwrap();
    owner.shutdown_until(a.deadline).unwrap();
    a.service(true);
    q.observe(&a, false, false, &s);
    assert!(paths.pending());
    assert_eq!(s.exits.load(Ordering::Acquire), 0);
    assert!(!q.gate.completed());
}
#[test]
fn path_settlement_alone_cannot_complete_app_quit() {
    let (q, _, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let a = q.begin(false).unwrap();
    a.paths(paths.cleanup(a.deadline));
    q.observe(&a, false, false, &s);
    assert!(!paths.pending());
    assert!(owner.client_session().is_err());
    assert_eq!(s.exits.load(Ordering::Acquire), 0);
}
#[test]
fn both_real_owners_settled_within_common_deadline_exit_once() {
    let (q, _, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let a = q.begin(false).unwrap();
    owner.shutdown_until(a.deadline).unwrap();
    a.service(true);
    a.paths(paths.cleanup(a.deadline));
    assert!(paths.removed() > 0);
    assert!(!paths.pending());
    assert_eq!(q.observe(&a, false, false, &s), Decision::Finish);
    assert_eq!(q.observe(&a, false, false, &s), Decision::Finish);
    assert_eq!(s.exits.load(Ordering::Acquire), 1);
    assert!(q.gate.completed());
    assert!(owner.quit_handle().load(Ordering::Acquire));
}
#[test]
fn nonpreemptible_cleanup_deadline_retains_worker_and_safe_failure() {
    let (q, c, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let (arrived, release) = paths.block_cleanup();
    let a = q.begin(false).unwrap();
    owner.shutdown_until(a.deadline).unwrap();
    a.service(true);
    let done = a.clone();
    paths
        .start_cleanup(a.deadline, move |ok| done.paths(ok))
        .unwrap();
    arrived.recv_timeout(Duration::from_secs(1)).unwrap();
    c.pause(APP_QUIT_CAP);
    assert_eq!(
        q.observe(&a, false, paths.owner.worker.busy(), &s),
        Decision::Fail
    );
    assert!(paths.owner.worker.busy());
    assert_eq!(s.failures.load(Ordering::Acquire), 1);
    assert_eq!(s.exits.load(Ordering::Acquire), 0);
    release.send(()).unwrap();
    paths.owner.worker.wait_for_test();
    assert_eq!(q.observe(&a, false, false, &s), Decision::Fail);
}
#[test]
fn explicit_retry_while_old_cleanup_active_cannot_spawn_duplicate() {
    let (q, c, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let (arrived, release) = paths.block_cleanup();
    let a = q.begin(false).unwrap();
    owner.shutdown_until(a.deadline).unwrap();
    a.service(true);
    let done = a.clone();
    paths
        .start_cleanup(a.deadline, move |ok| done.paths(ok))
        .unwrap();
    arrived.recv_timeout(Duration::from_secs(1)).unwrap();
    c.pause(APP_QUIT_CAP);
    q.observe(&a, false, paths.owner.worker.busy(), &s);
    assert!(q.begin(paths.owner.worker.busy()).is_none());
    assert!(paths.start_cleanup(c.now() + APP_QUIT_CAP, |_| {}).is_err());
    assert!(q.current_is(&a));
    assert!(!q.gate.completed());
    release.send(()).unwrap();
    paths.owner.worker.wait_for_test();
}
#[test]
fn late_physical_cleanup_cannot_exit_expired_attempt() {
    let (q, c, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let (arrived, release) = paths.block_cleanup();
    let a = q.begin(false).unwrap();
    owner.shutdown_until(a.deadline).unwrap();
    a.service(true);
    let done = a.clone();
    paths
        .start_cleanup(a.deadline, move |ok| done.paths(ok))
        .unwrap();
    arrived.recv_timeout(Duration::from_secs(1)).unwrap();
    c.pause(APP_QUIT_CAP);
    q.observe(&a, false, true, &s);
    release.send(()).unwrap();
    paths.owner.worker.wait_for_test();
    assert!(paths.removed() > 0);
    assert_eq!(q.observe(&a, false, false, &s), Decision::Fail);
    assert_eq!(s.exits.load(Ordering::Acquire), 0);
}
#[test]
fn later_explicit_attempt_reuses_settled_retained_owners() {
    let (q, c, s, mut owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let (arrived, release) = paths.block_cleanup();
    let old = q.begin(false).unwrap();
    owner.shutdown_until(old.deadline).unwrap();
    old.service(true);
    let done = old.clone();
    paths
        .start_cleanup(old.deadline, move |ok| done.paths(ok))
        .unwrap();
    arrived.recv_timeout(Duration::from_secs(1)).unwrap();
    c.pause(APP_QUIT_CAP);
    q.observe(&old, false, true, &s);
    release.send(()).unwrap();
    paths.owner.worker.wait_for_test();
    paths.unblock_future();
    let next = q.begin(paths.owner.worker.busy()).unwrap();
    assert!(!Arc::ptr_eq(&old, &next));
    owner.shutdown_until(next.deadline).unwrap();
    next.service(true);
    next.paths(paths.cleanup(next.deadline));
    assert_eq!(q.observe(&next, false, false, &s), Decision::Finish);
    assert!(!paths.pending());
    assert_eq!(s.exits.load(Ordering::Acquire), 1);
    assert_eq!(owner.snapshot().automatic_relaunches, 0);
}
#[test]
fn old_attempt_completion_cannot_finish_new_attempt() {
    let (q, c, s, _) = fixture();
    let old = q.begin(false).unwrap();
    c.pause(APP_QUIT_CAP);
    q.observe(&old, true, true, &s);
    let next = q.begin(false).unwrap();
    old.service(true);
    old.paths(true);
    assert_eq!(q.observe(&old, false, false, &s), Decision::Fail);
    assert!(q.current_is(&next));
    assert_eq!(s.exits.load(Ordering::Acquire), 0);
}
#[test]
fn coordinator_spawn_failure_keeps_both_owners_and_prevents_exit() {
    let (q, _, s, mut owner) = fixture();
    let a = q.begin(false).unwrap();
    owner.shutdown_until(a.deadline).unwrap();
    a.service(true);
    let worker = OwnedWorker::default();
    assert!(worker.spawn_with("bad\0name", || {}).is_err());
    q.fail(&a, &s);
    a.paths(true);
    assert_eq!(q.observe(&a, false, false, &s), Decision::Fail);
    assert!(!q.gate.completed());
    assert_eq!(s.exits.load(Ordering::Acquire), 0);
}

#[test]
fn service_phase_waits_clip_to_same_absolute_quit_deadline() {
    let control = Arc::new(Control::default());
    control.ignore_close.store(true, Ordering::Release);
    control.ignore_force.store(true, Ordering::Release);
    let mut owner = RestartOwner::new(
        Adapter(control.clone()),
        FakeClock::default(),
        Policy {
            startup_timeout: Duration::from_millis(50),
            shutdown_timeout: Duration::from_millis(30),
            poll_interval: Duration::from_millis(10),
            bind_attempts: 1,
        },
        RecoveryPolicy::default(),
    )
    .unwrap();
    owner.start_initial().unwrap();
    let c = owner.clock_handle();
    let d = c.now() + Duration::from_millis(15);
    assert!(owner.shutdown_until(d).is_err());
    assert_eq!(c.now(), d);
    assert_eq!(*control.calls.lock().unwrap(), vec!["graceful"]);
    control.ignore_force.store(false, Ordering::Release);
    owner
        .shutdown_until(c.now() + Duration::from_secs(1))
        .unwrap();
    assert_eq!(
        *control.calls.lock().unwrap(),
        vec!["graceful", "graceful", "force"]
    );
}
#[test]
fn actual_supervisor_termination_uses_typed_owned_intents_in_order() {
    let control = Arc::new(Control::default());
    control.ignore_close.store(true, Ordering::Release);
    let mut owner = RestartOwner::new(
        Adapter(control.clone()),
        FakeClock::default(),
        Policy {
            startup_timeout: Duration::from_millis(50),
            shutdown_timeout: Duration::from_millis(30),
            poll_interval: Duration::from_millis(10),
            bind_attempts: 1,
        },
        RecoveryPolicy::default(),
    )
    .unwrap();
    owner.start_initial().unwrap();
    owner.shutdown().unwrap();
    assert_eq!(*control.calls.lock().unwrap(), vec!["graceful", "force"]);
    assert!(control.dead.load(Ordering::Acquire));
}
#[test]
fn service_mutex_is_never_held_during_path_native_work() {
    let (q, _, s, owner) = fixture();
    let paths = PathsProof::new(owner.quit_handle(), owner.clock_handle());
    let owner = Arc::new(Mutex::new(owner));
    let a = q.begin(false).unwrap();
    let retained = paths.owner.clone();
    let (send, receive) = std::sync::mpsc::channel();
    let worker = paths.owner.clone();
    let d = a.deadline;
    retained.while_locked_for_test(|| {
        paths
            .owner
            .worker
            .spawn("path-cleanup-lock-mock", move || {
                send.send(worker.cleanup_until(d)).unwrap();
            })
            .unwrap();
        assert!(owner.try_lock().is_ok());
        assert_eq!(q.observe(&a, false, true, &s), Decision::Pending);
    });
    assert!(
        receive
            .recv_timeout(Duration::from_secs(1))
            .unwrap()
            .is_ok()
    );
    paths.owner.worker.wait_for_test();
    assert!(!paths.pending());
}

#[test]
fn held_actual_worker_slot_cannot_delay_quit_revocation_or_deadline_observer() {
    let (q, c, s, owner) = fixture();
    let q = Arc::new(q);
    let sink = Arc::new(s);
    let slot = Arc::new(OwnedWorker::default());
    let authority = owner.authority_handle();
    let old_epoch = authority.current_epoch();
    let flag = owner.quit_handle();
    let (send, receive) = std::sync::mpsc::channel();
    let mut thread = None;
    let early = slot.while_locked_for_test(|| {
        let q = q.clone();
        let slot = slot.clone();
        thread = Some(std::thread::spawn(move || {
            let accepted = q.begin_checked(|| {
                assert!(flag.load(Ordering::Acquire));
                assert!(authority.current_epoch() > old_epoch);
                slot.busy()
            });
            send.send(accepted.is_none()).unwrap();
        }));
        receive.recv_timeout(Duration::from_millis(100))
    });
    thread.unwrap().join().unwrap();
    assert!(
        early.unwrap(),
        "Quit waited on a held worker slot before revocation"
    );
    let a = q.begin(false).unwrap();
    c.pause(APP_QUIT_CAP);
    let (send, receive) = std::sync::mpsc::channel();
    let mut thread = None;
    let early = slot.while_locked_for_test(|| {
        let q = q.clone();
        let slot = slot.clone();
        let sink = sink.clone();
        thread = Some(std::thread::spawn(move || {
            send.send(q.observe(&a, false, slot.busy(), sink.as_ref()))
                .unwrap();
        }));
        receive.recv_timeout(Duration::from_millis(100))
    });
    thread.unwrap().join().unwrap();
    assert_eq!(early.unwrap(), Decision::Fail);
    assert!(!q.gate.completed());
    assert_eq!(sink.exits.load(Ordering::Acquire), 0);
}
#[test]
fn public_claim_passed_before_quit_is_fenced_at_actual_spawn_barrier() {
    let (q, _, _, owner) = fixture();
    let slot = Arc::new(OwnedWorker::default());
    let flag = owner.quit_handle();
    let flag_for_check = flag.clone();
    let ran = Arc::new(AtomicBool::new(false));
    let ran_in_job = ran.clone();
    let (arrived, ready) = std::sync::mpsc::channel();
    let (release, wait) = std::sync::mpsc::channel();
    let worker = slot.clone();
    let thread = std::thread::spawn(move || {
        worker.spawn_barrier_for_test(
            "public-pre-quit",
            move || {
                if flag_for_check.load(Ordering::Acquire) {
                    Err(crate::service::platform_adapters::PathFailure::Cancelled)
                } else {
                    Ok(())
                }
            },
            move || ran_in_job.store(true, Ordering::Release),
            move || {
                arrived.send(()).unwrap();
                wait.recv_timeout(Duration::from_secs(3)).unwrap();
            },
        )
    });
    ready.recv_timeout(Duration::from_secs(1)).unwrap();
    let start = std::time::Instant::now();
    assert!(q.begin_checked(|| slot.busy()).is_none());
    assert!(start.elapsed() < Duration::from_millis(100));
    assert!(flag.load(Ordering::Acquire));
    assert!(!q.gate.completed());
    release.send(()).unwrap();
    assert_eq!(
        thread.join().unwrap(),
        Err(crate::service::platform_adapters::PathFailure::Cancelled)
    );
    assert!(!ran.load(Ordering::Acquire));
    assert!(!slot.busy());
}
