use super::*;
use crate::service::platform_adapters::{
    creation::*,
    paths::*,
    policy::{PathRole, Scope},
};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::{OnceLock, atomic::AtomicU64},
};

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
#[derive(Clone)]
struct Lease(Arc<LeaseData>);
struct LeaseData {
    path: PathBuf,
    id: u64,
    token: OnceLock<Token>,
}
impl CreationLease for Lease {
    fn token(&self) -> Option<&Token> {
        self.0.token.get()
    }
    fn set_token(&self, t: Token) -> Result<(), PathFailure> {
        self.0.token.set(t).map_err(|_| PathFailure::Identity)
    }
}
#[derive(Default)]
struct Edges {
    dirs: BTreeMap<PathBuf, u64>,
    serial: u64,
    fault: u8,
    removed: usize,
    cleanup_fail: bool,
    blocker: Option<Arc<Blocker>>,
    attempts: usize,
}
struct Blocker {
    entered: std::sync::mpsc::SyncSender<()>,
    release: Mutex<std::sync::mpsc::Receiver<()>>,
}
struct Ops {
    edges: Arc<Mutex<Edges>>,
    book: CreationBook<Lease>,
}
impl Ops {
    fn open(
        &mut self,
        path: PathBuf,
        fresh: bool,
        permit: Option<&NativeWorkPermit>,
    ) -> Result<Lease, PathFailure> {
        let id = {
            let mut e = self.edges.lock().unwrap();
            e.serial += 1;
            e.serial
        };
        let lease = Lease(Arc::new(LeaseData {
            path: path.clone(),
            id,
            token: OnceLock::new(),
        }));
        if !fresh {
            self.edges.lock().unwrap().dirs.insert(path, id);
            return Ok(lease);
        }
        let edges = self.edges.clone();
        let e2 = edges.clone();
        let e3 = edges.clone();
        create_and_acquire(
            &mut self.book,
            lease,
            Mode::Temporary,
            permit.map(|p| p as &dyn WorkPermit),
            move || {
                let mut e = edges.lock().unwrap();
                e.dirs.insert(path, id);
                let f = e.fault;
                drop(e);
                if f == 1 {
                    panic!("create unwind")
                }
                Ok(Created::New)
            },
            move |_| {
                if e2.lock().unwrap().fault == 2 {
                    panic!("open unwind")
                }
                Ok(())
            },
            move |_| {
                if e3.lock().unwrap().fault == 3 {
                    panic!("stat unwind")
                }
                Ok(())
            },
        )
    }
}
impl DirectoryOps for Ops {
    type Lease = Lease;
    fn open_base(&mut self, p: &Path, _: BaseKind, _: bool) -> Result<Lease, PathFailure> {
        self.open(p.into(), false, None)
    }
    fn child(&mut self, p: &Lease, n: &str, _: bool, f: bool) -> Result<Lease, PathFailure> {
        self.open(p.0.path.join(n), f, None)
    }
    fn register_owned(&mut self, l: &Lease) -> Result<(), PathFailure> {
        if self.edges.lock().unwrap().fault == 4 {
            panic!("ack unwind")
        }
        self.book.acknowledge(l)
    }
    fn verify(&mut self, _: &Lease) -> Result<(), PathFailure> {
        Ok(())
    }
    fn identity(&self, l: &Lease) -> DirectoryIdentity {
        DirectoryIdentity(1, l.0.id)
    }
    fn location<'a>(&self, l: &'a Lease) -> &'a Path {
        &l.0.path
    }
    fn writable_probe(
        &mut self,
        _: &Lease,
        _permit: &impl WorkPermit,
    ) -> Result<bool, PathFailure> {
        Ok(true)
    }
    fn remove_owned_empty(&mut self, l: Lease) -> Result<(), (PathFailure, Lease)> {
        let blocker = {
            let mut e = self.edges.lock().unwrap();
            e.attempts += 1;
            e.blocker.clone()
        };
        if let Some(blocker) = blocker {
            let _ = blocker.entered.send(());
            if blocker
                .release
                .lock()
                .unwrap()
                .recv_timeout(Duration::from_secs(3))
                .is_err()
            {
                return Err((PathFailure::Interrupted, l));
            }
        }
        let mut e = self.edges.lock().unwrap();
        if e.cleanup_fail {
            return Err((PathFailure::Busy, l));
        }
        e.dirs.remove(&l.0.path);
        e.removed += 1;
        Ok(())
    }
    fn auxiliary_cleanup_pending(&self) -> bool {
        self.book.pending()
    }
    fn cleanup_auxiliary_permitted(&mut self, p: &impl CleanupPermit) -> Result<(), PathFailure> {
        let e = self.edges.clone();
        self.book.cleanup(p, move |l, _, _| {
            let mut e = e.lock().unwrap();
            if e.cleanup_fail {
                return Err(PathFailure::Busy);
            }
            e.dirs.remove(&l.0.path);
            e.removed += 1;
            Ok(())
        })
    }
}
struct Nonces(u64);
impl NonceSource for Nonces {
    fn next(&mut self) -> Result<String, PathFailure> {
        self.0 += 1;
        Ok(format!("n{}", self.0))
    }
}
pub(crate) struct Backend(PathOwner<Ops, Nonces>);
impl PathBackend for Backend {
    fn resolve(
        &mut self,
        r: &PathRequest,
        p: &NativeWorkPermit,
    ) -> Result<PathOutcome, PathFailure> {
        self.0.resolve(r, p)
    }
    fn release(&mut self, o: &mut PathOutcome, p: &impl CleanupPermit) -> Result<(), PathFailure> {
        self.0.cleanup(o, p)
    }
    fn cleanup_all(&mut self, p: &impl CleanupPermit) -> Result<(), PathFailure> {
        self.0.cleanup_all(p)
    }
    fn pending(&self) -> bool {
        self.0.pending_cleanup()
    }
}
fn fixture() -> (
    Arc<RetainedPaths<Backend>>,
    Arc<FakeClock>,
    Arc<Mutex<Edges>>,
) {
    let clock = Arc::new(FakeClock::default());
    let edges = Arc::new(Mutex::new(Edges::default()));
    (
        Arc::new(RetainedPaths::new(
            Arc::new(AtomicBool::new(false)),
            clock.clone(),
        )),
        clock,
        edges,
    )
}
fn backend(e: Arc<Mutex<Edges>>) -> Backend {
    Backend(PathOwner::new(PathProvider::new(
        TrustedBases::new(
            PathBuf::from("/data/app"),
            PathBuf::from("/cache/app"),
            PathBuf::from("/temp"),
            BUNDLE_ID,
            false,
        )
        .unwrap(),
        Ops {
            edges: e,
            book: CreationBook::default(),
        },
        Nonces(0),
    )))
}
fn request() -> PathRequest {
    PathRequest {
        role: PathRole::Temporary,
        scope: Scope::User,
        relative_segments: vec![],
        create_if_missing: true,
    }
}
fn resolve(o: &RetainedPaths<Backend>, e: Arc<Mutex<Edges>>) -> Result<PathOutcome, PathFailure> {
    let p = o.work_permit(None)?;
    o.resolve(request(), p, move || Ok(backend(e)))
}
fn cleanup(o: &RetainedPaths<Backend>) -> Result<(), PathFailure> {
    o.cleanup_until(o.clock.now() + Duration::from_secs(3))
}

#[test]
fn lazy_app_owner_empty_until_real_request() {
    let (o, _, _) = fixture();
    assert!(o.empty());
    assert!(!o.worker.busy());
    assert!(cleanup(&o).is_ok());
    assert!(o.empty());
}
#[test]
fn directory_budget_uses_exact_app_cancel_clock_and_four_second_cap() {
    let (o, c, _) = fixture();
    assert!(Arc::ptr_eq(
        &o.cancellation,
        &o.work_permit(None).unwrap().cancellation
    ));
    assert!(o.work_permit(Some(Duration::ZERO)).is_err());
    assert!(o.work_permit(Some(Duration::from_millis(4001))).is_err());
    let p = o.work_permit(None).unwrap();
    assert!(Arc::ptr_eq(&o.clock, &p.clock));
    let shorter = o.work_permit(Some(Duration::from_secs(1))).unwrap();
    c.pause(Duration::from_secs(1));
    assert_eq!(shorter.check(), Err(SupervisorError::StartupTimeout));
    assert_eq!(p.check(), Ok(()));
    c.pause(Duration::from_secs(3));
    assert_eq!(p.check(), Err(SupervisorError::StartupTimeout));
    o.cancellation.store(true, Ordering::Release);
    assert_eq!(p.check(), Err(SupervisorError::Cancelled));
}
#[test]
fn quit_before_first_resolution_prevents_sdk_and_native_work() {
    let (o, _, edges) = fixture();
    let permit = o.work_permit(None).unwrap();
    let gate = crate::service::lifecycle_state::ShutdownGate::new(o.cancellation.clone());
    assert!(gate.begin());
    let initialized = Arc::new(AtomicBool::new(false));
    let observed = initialized.clone();
    let result = o.start_resolve(request(), permit, move || {
        initialized.store(true, Ordering::Release);
        Ok(backend(edges))
    });
    assert_eq!(result.err(), Some(PathFailure::Cancelled));
    assert!(!observed.load(Ordering::Acquire));
    assert!(o.empty());
    assert!(!o.worker.busy());
}
#[test]
fn initialized_backend_is_retained_before_first_native_phase() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    e.lock().unwrap().fault = 1;
    assert!(resolve(&o, e.clone()).is_err());
    assert!(!o.empty());
    assert!(o.pending());
    e.lock().unwrap().fault = 0;
    cleanup(&o).unwrap();
    assert!(!o.pending());
}
#[test]
fn reservation_create_open_stat_ack_unwind_retains_same_owner() {
    let _gate = super::super::fixture_isolation::acquire();
    for fault in 1..=4 {
        let (o, _, e) = fixture();
        e.lock().unwrap().fault = fault;
        assert!(resolve(&o, e.clone()).is_err());
        assert!(o.pending(), "fault {fault}");
        e.lock().unwrap().fault = 0;
        cleanup(&o).unwrap();
        assert!(!o.pending());
        assert!(e.lock().unwrap().removed > 0);
        assert_eq!(resolve(&o, e.clone()).err(), Some(PathFailure::Interrupted));
    }
}
#[test]
fn cancelled_or_dropped_receiver_cannot_release_provider_lease() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    let receive = o
        .start_resolve(request(), o.work_permit(None).unwrap(), move || {
            Ok(backend(e))
        })
        .unwrap();
    drop(receive);
    o.worker.wait_for_test();
    assert!(o.pending());
    cleanup(&o).unwrap();
    assert!(!o.pending());
}
#[test]
fn poisoned_owner_allows_only_cleanup_on_retained_inner_value() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    drop(resolve(&o, e.clone()).unwrap());
    let copy = o.clone();
    std::thread::spawn(move || {
        let _g = copy.state.lock().unwrap();
        panic!("retained poison")
    })
    .join()
    .unwrap_err();
    assert_eq!(resolve(&o, e).err(), Some(PathFailure::Interrupted));
    cleanup(&o).unwrap();
    assert!(!o.pending());
}
#[test]
fn worker_creation_error_retains_owner_and_resets_only_unstarted_claim() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    drop(resolve(&o, e).unwrap());
    assert!(o.worker.spawn_with("invalid\0name", || {}).is_err());
    assert!(!o.worker.busy());
    assert!(o.pending());
    cleanup(&o).unwrap();
}
#[test]
fn active_worker_and_finished_handle_before_reap_deny_duplicate_job() {
    let slot = OwnedWorker::default();
    let (tx, rx) = std::sync::mpsc::channel();
    slot.spawn("held", move || {
        rx.recv().unwrap();
    })
    .unwrap();
    assert!(slot.busy());
    assert_eq!(
        slot.spawn("duplicate", || {}).err(),
        Some(PathFailure::Busy)
    );
    tx.send(()).unwrap();
    slot.wait_for_test();
    assert!(!slot.busy());
    slot.spawn("later", || {}).unwrap();
    slot.wait_for_test();
}
#[test]
fn partial_cleanup_keeps_same_handle_and_pending_book_for_retry() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    let mut out = resolve(&o, e.clone()).unwrap();
    e.lock().unwrap().cleanup_fail = true;
    assert!(o.release(&mut out).is_err());
    assert!(o.pending());
    e.lock().unwrap().cleanup_fail = false;
    o.release(&mut out).unwrap();
    assert!(!o.pending());
}
#[test]
fn cleanup_permission_never_reopens_permanent_work_authority() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    let outcome = resolve(&o, e.clone()).unwrap();
    o.cancellation.store(true, Ordering::Release);
    assert_eq!(
        o.start_release(outcome, o.clock.now() + PATH_CLEANUP_CAP)
            .err(),
        Some(PathFailure::Cancelled)
    );
    assert!(!o.worker.busy());
    assert!(o.pending());
    cleanup(&o).unwrap();
    assert!(!o.pending());
    assert!(o.work_permit(None).is_err());
    assert!(o.cancellation.load(Ordering::Acquire));
}
#[test]
fn public_release_failure_and_dropped_outcome_remain_quit_reachable() {
    let _gate = super::super::fixture_isolation::acquire();
    let (o, _, e) = fixture();
    let outcome = resolve(&o, e.clone()).unwrap();
    e.lock().unwrap().cleanup_fail = true;
    let receive = o
        .start_release(outcome, o.clock.now() + PATH_CLEANUP_CAP)
        .unwrap();
    drop(receive);
    o.worker.wait_for_test();
    assert!(o.pending());
    assert!(e.lock().unwrap().attempts > 0);
    e.lock().unwrap().cleanup_fail = false;
    o.cancellation.store(true, Ordering::Release);
    let (send, receive) = std::sync::mpsc::channel();
    o.start_quit(o.clock.now() + PATH_CLEANUP_CAP, move |ok| {
        send.send(ok).unwrap();
    })
    .unwrap();
    assert!(receive.recv_timeout(Duration::from_secs(1)).unwrap());
    o.worker.wait_for_test();
    assert!(!o.pending());
    assert!(e.lock().unwrap().removed > 0);
}

/// Real PathOwner/CreationBook with synthetic I/O, shared by coordinator tests.
pub(crate) struct PathsProof {
    pub(crate) owner: Arc<RetainedPaths<Backend>>,
    edges: Arc<Mutex<Edges>>,
    _gate: super::super::fixture_isolation::FixtureLease,
}
impl PathsProof {
    pub(crate) fn new(cancel: Arc<AtomicBool>, clock: Arc<dyn Clock + Send + Sync>) -> Self {
        let gate = super::super::fixture_isolation::acquire();
        let edges = Arc::new(Mutex::new(Edges::default()));
        let owner = Arc::new(RetainedPaths::new(cancel, clock));
        drop(resolve(&owner, edges.clone()).unwrap());
        Self {
            owner,
            edges,
            _gate: gate,
        }
    }
    pub(crate) fn block_cleanup(
        &self,
    ) -> (
        std::sync::mpsc::Receiver<()>,
        std::sync::mpsc::SyncSender<()>,
    ) {
        let (entered, arrived) = std::sync::mpsc::sync_channel(1);
        let (release, wait) = std::sync::mpsc::sync_channel(1);
        self.edges.lock().unwrap().blocker = Some(Arc::new(Blocker {
            entered,
            release: Mutex::new(wait),
        }));
        (arrived, release)
    }
    pub(crate) fn unblock_future(&self) {
        self.edges.lock().unwrap().blocker = None;
    }
    pub(crate) fn start_cleanup(
        &self,
        deadline: Duration,
        done: impl FnOnce(bool) + Send + 'static,
    ) -> Result<(), PathFailure> {
        self.owner.start_quit(deadline, done)
    }
    pub(crate) fn cleanup(&self, deadline: Duration) -> bool {
        self.owner.cleanup_until(deadline).is_ok()
    }
    pub(crate) fn pending(&self) -> bool {
        self.owner.pending()
    }
    pub(crate) fn removed(&self) -> usize {
        self.edges.lock().unwrap().removed
    }
}
