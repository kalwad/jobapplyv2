use super::*;
use crate::service::SupervisorError;
use crate::service::platform_adapters::paths::*;
use crate::service::platform_adapters::policy::{PathRequest, PathRole, PathState, Scope};
use std::{
    cell::{Cell, OnceCell, RefCell},
    collections::BTreeMap,
    path::{Path, PathBuf},
    rc::Rc,
};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Fault {
    None,
    Open,
    Stat,
    Security,
    Verify,
    Create,
    Collision,
    PanicCreate,
    PanicOpen,
    PanicStat,
    PanicSecurity,
    CancelCreate,
}
#[derive(Default)]
struct State {
    dirs: BTreeMap<PathBuf, u64>,
    serial: u64,
    creates: usize,
    acquires: usize,
    removed: Vec<PathBuf>,
}
#[derive(Clone)]
struct Lease(Rc<Entry>);
struct Entry {
    path: PathBuf,
    handle: Cell<Option<u64>>,
    identity: Cell<Option<u64>>,
    token: OnceCell<Token>,
}
impl CreationLease for Lease {
    fn token(&self) -> Option<&Token> {
        self.0.token.get()
    }
    fn set_token(&self, token: Token) -> Result<(), PathFailure> {
        self.0.token.set(token).map_err(|_| PathFailure::Identity)
    }
}
fn lease(path: PathBuf) -> Lease {
    Lease(Rc::new(Entry {
        path,
        handle: Cell::new(None),
        identity: Cell::new(None),
        token: OnceCell::new(),
    }))
}
#[derive(Clone)]
struct Permit(Rc<Cell<bool>>);
impl WorkPermit for Permit {
    fn check(&self) -> Result<(), SupervisorError> {
        if self.0.get() {
            Err(SupervisorError::Cancelled)
        } else {
            Ok(())
        }
    }
}
fn permit() -> Permit {
    Permit(Rc::new(Cell::new(false)))
}
fn root() -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(r"C:\fake")
    } else {
        PathBuf::from("/fake")
    }
}
fn prepare() -> (CreationBook<Lease>, Rc<RefCell<State>>, Lease, Permit) {
    (
        CreationBook::default(),
        Rc::new(RefCell::new(State::default())),
        lease(root().join("fresh")),
        permit(),
    )
}
fn run(
    book: &mut CreationBook<Lease>,
    state: &Rc<RefCell<State>>,
    entry: Lease,
    mode: Mode,
    p: &Permit,
    fault: Fault,
) -> Result<Lease, PathFailure> {
    create_and_acquire(
        book,
        entry.clone(),
        mode,
        Some(p),
        || {
            let mut s = state.borrow_mut();
            s.creates += 1;
            if fault == Fault::Create {
                return Err(PathFailure::Permission);
            }
            if fault == Fault::Collision {
                s.dirs.insert(entry.0.path.clone(), 999);
                return Err(PathFailure::Collision);
            }
            if s.dirs.contains_key(&entry.0.path) {
                return Ok(Created::Existing);
            }
            s.serial += 1;
            let id = s.serial;
            s.dirs.insert(entry.0.path.clone(), id);
            if fault == Fault::PanicCreate {
                panic!("modeled unwind after native create before return")
            }
            if fault == Fault::CancelCreate {
                p.0.set(true)
            }
            Ok(Created::New)
        },
        |entry| {
            state.borrow_mut().acquires += 1;
            if fault == Fault::Open {
                return Err(PathFailure::Interrupted);
            }
            if fault == Fault::PanicOpen {
                panic!("modeled initial acquisition failure unwind")
            }
            entry
                .0
                .handle
                .set(state.borrow().dirs.get(&entry.0.path).copied());
            Ok(())
        },
        |entry| {
            if fault == Fault::Stat {
                return Err(PathFailure::Interrupted);
            }
            if fault == Fault::PanicStat {
                panic!("modeled stat unwind with retained handle")
            }
            entry.0.identity.set(entry.0.handle.get());
            if fault == Fault::Security {
                return Err(PathFailure::Permission);
            }
            if fault == Fault::PanicSecurity {
                panic!("modeled security unwind")
            }
            if fault == Fault::Verify {
                return Err(PathFailure::Identity);
            }
            verify(state, entry)
        },
    )
}
fn verify(state: &Rc<RefCell<State>>, entry: &Lease) -> Result<(), PathFailure> {
    if entry.0.identity.get().is_some()
        && entry.0.identity.get() == state.borrow().dirs.get(&entry.0.path).copied()
    {
        Ok(())
    } else {
        Err(PathFailure::Identity)
    }
}
fn settle(state: &Rc<RefCell<State>>, entry: &mut Lease, mode: Mode) -> Result<(), PathFailure> {
    if !state.borrow().dirs.contains_key(&entry.0.path) {
        return settle_absence(
            entry
                .0
                .handle
                .get()
                .map(|id| !state.borrow().dirs.values().any(|v| *v == id)),
        );
    }
    let anchored = entry.0.handle.get().ok_or(PathFailure::Identity)?;
    if entry.0.identity.get().is_none() {
        entry.0.identity.set(Some(anchored))
    }
    verify(state, entry)?;
    if mode == Mode::Temporary {
        let mut s = state.borrow_mut();
        s.dirs.remove(&entry.0.path);
        s.removed.push(entry.0.path.clone());
    }
    Ok(())
}
fn clean(book: &mut CreationBook<Lease>, state: &Rc<RefCell<State>>) -> Result<(), PathFailure> {
    book.cleanup(&permit(), |entry, _, mode| settle(state, entry, mode))
}
#[test]
fn creation_then_open_failure_retains_owner_without_name_adoption() {
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l.clone(), Mode::Temporary, &p, Fault::Open).is_err());
    assert!(b.pending());
    assert!(matches!(clean(&mut b, &s), Err(PathFailure::Identity)));
    assert!(s.borrow().removed.is_empty());
    s.borrow_mut().dirs.insert(l.0.path.clone(), 900);
    assert!(clean(&mut b, &s).is_err());
    assert!(b.pending());
    assert_eq!(s.borrow().acquires, 1);
    s.borrow_mut().dirs.remove(&l.0.path);
    assert!(clean(&mut b, &s).is_ok());
    assert!(!b.pending());
}
#[test]
fn creation_then_stat_failure_retains_initial_handle_for_safe_retry() {
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l, Mode::Temporary, &p, Fault::Stat).is_err());
    assert!(b.pending());
    assert!(clean(&mut b, &s).is_ok());
    assert_eq!(s.borrow().removed.len(), 1);
    assert!(!b.pending());
    assert_eq!(s.borrow().acquires, 1);
}
#[test]
fn creation_then_security_failure_retains_initial_identity() {
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l, Mode::Temporary, &p, Fault::Security).is_err());
    assert!(b.pending());
    assert!(clean(&mut b, &s).is_ok());
    assert_eq!(s.borrow().removed.len(), 1);
}
#[test]
fn creation_then_verify_failure_cannot_delete_replacement() {
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l.clone(), Mode::Temporary, &p, Fault::Verify).is_err());
    assert!(b.pending());
    s.borrow_mut().dirs.insert(l.0.path.clone(), 999);
    assert!(matches!(clean(&mut b, &s), Err(PathFailure::Identity)));
    assert!(s.borrow().removed.is_empty());
    assert!(b.pending());
}
#[test]
fn successful_fresh_lease_is_retained_until_provider_acknowledges() {
    let (mut b, s, l, p) = prepare();
    let l = run(&mut b, &s, l, Mode::Temporary, &p, Fault::None).unwrap();
    assert!(b.pending());
    assert!(b.acknowledge(&l).is_ok());
    assert!(!b.pending());
    assert!(s.borrow().removed.is_empty());
}
#[test]
fn known_collision_and_create_failure_never_claim_foreign_directory() {
    for fault in [Fault::Collision, Fault::Create] {
        let (mut b, s, l, p) = prepare();
        assert!(run(&mut b, &s, l, Mode::Temporary, &p, fault).is_err());
        assert!(!b.pending());
        assert!(clean(&mut b, &s).is_ok());
        assert!(s.borrow().removed.is_empty());
    }
}
#[test]
fn persistent_verified_creation_is_kept_but_failed_acquisition_stays_pending() {
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l, Mode::Persistent, &p, Fault::None).is_ok());
    assert!(!b.pending());
    assert_eq!(s.borrow().dirs.len(), 1);
    assert!(
        run(
            &mut b,
            &s,
            lease(root().join("other")),
            Mode::Persistent,
            &p,
            Fault::Open
        )
        .is_err()
    );
    assert!(b.pending());
    assert!(clean(&mut b, &s).is_err());
    assert!(s.borrow().removed.is_empty());
}
#[test]
fn accepted_existing_directory_never_gains_cleanup_ownership() {
    let (mut b, s, l, p) = prepare();
    s.borrow_mut().dirs.insert(l.0.path.clone(), 88);
    assert!(run(&mut b, &s, l, Mode::Persistent, &p, Fault::Security).is_err());
    assert!(!b.pending());
    assert!(s.borrow().removed.is_empty());
}
#[test]
fn cancellation_after_successful_create_prevents_new_acquisition() {
    let (mut b, s, l, p) = prepare();
    assert!(matches!(
        run(&mut b, &s, l, Mode::Temporary, &p, Fault::CancelCreate),
        Err(PathFailure::Cancelled)
    ));
    assert!(b.pending());
    assert_eq!(s.borrow().acquires, 0);
    assert!(clean(&mut b, &s).is_err());
}
#[test]
fn cancellation_before_create_releases_reservation_without_work() {
    let (mut b, s, l, p) = prepare();
    p.0.set(true);
    assert!(matches!(
        run(&mut b, &s, l, Mode::Temporary, &p, Fault::None),
        Err(PathFailure::Cancelled)
    ));
    assert!(!b.pending());
    assert_eq!(s.borrow().creates, 0);
}
#[test]
fn uncertainty_and_anchored_unwinds_retain_owner() {
    for fault in [
        Fault::PanicCreate,
        Fault::PanicOpen,
        Fault::PanicStat,
        Fault::PanicSecurity,
    ] {
        let (mut b, s, l, p) = prepare();
        let caught = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            run(&mut b, &s, l.clone(), Mode::Temporary, &p, fault)
        }));
        assert!(caught.is_err());
        assert!(b.pending());
        if matches!(fault, Fault::PanicCreate | Fault::PanicOpen) {
            assert!(clean(&mut b, &s).is_err());
            assert!(s.borrow().removed.is_empty());
            s.borrow_mut().dirs.remove(&l.0.path);
        }
        assert!(clean(&mut b, &s).is_ok());
        assert!(!b.pending());
    }
}
#[test]
fn pending_creation_blocks_more_work_without_losing_existing_reservation() {
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l, Mode::Temporary, &p, Fault::Open).is_err());
    assert!(matches!(
        run(
            &mut b,
            &s,
            lease(root().join("second")),
            Mode::Temporary,
            &p,
            Fault::None
        ),
        Err(PathFailure::Busy)
    ));
    assert_eq!(s.borrow().creates, 1);
    assert!(b.pending());
}
#[test]
fn full_reservation_capacity_fails_before_native_creation() {
    let (mut b, s, l, p) = prepare();
    for i in 0..CAPACITY {
        assert!(
            b.reserve(lease(root().join(i.to_string())), Mode::Temporary)
                .is_ok()
        );
    }
    assert!(matches!(
        run(&mut b, &s, l, Mode::Temporary, &p, Fault::None),
        Err(PathFailure::Busy)
    ));
    assert_eq!(s.borrow().creates, 0);
    assert!(b.pending());
}
#[test]
fn cross_owner_and_stale_tokens_cannot_release_new_reservations() {
    let (mut b, s, l, p) = prepare();
    let old = run(&mut b, &s, l, Mode::Temporary, &p, Fault::None).unwrap();
    let mut other = CreationBook::default();
    assert!(matches!(
        other.acknowledge(&old),
        Err(PathFailure::Identity)
    ));
    assert!(b.pending());
    b.acknowledge(&old).unwrap();
    let newer = run(
        &mut b,
        &s,
        lease(root().join("new")),
        Mode::Temporary,
        &p,
        Fault::None,
    )
    .unwrap();
    assert!(b.acknowledge(&old).is_ok());
    assert!(b.pending());
    b.acknowledge(&newer).unwrap();
    assert!(!b.pending());
}
#[test]
fn cleanup_visits_other_entries_while_unproven_creation_remains() {
    let (mut b, s, l, _) = prepare();
    let t = b.reserve(l.clone(), Mode::Temporary).unwrap();
    b.advance(&t, Stage::Created).unwrap();
    s.borrow_mut().dirs.insert(l.0.path.clone(), 1);
    let proven = lease(root().join("proven"));
    proven.0.handle.set(Some(2));
    proven.0.identity.set(Some(2));
    s.borrow_mut().dirs.insert(proven.0.path.clone(), 2);
    let t = b.reserve(proven, Mode::Temporary).unwrap();
    b.advance(&t, Stage::Validated).unwrap();
    assert!(clean(&mut b, &s).is_err());
    assert!(b.pending());
    assert_eq!(s.borrow().removed.len(), 1);
    assert_eq!(s.borrow().dirs.len(), 1);
}
#[test]
fn cleanup_does_not_reset_finite_budget_or_drop_entry_on_unwind() {
    struct Budget(Cell<usize>);
    impl CleanupPermit for Budget {
        fn check_cleanup(&self) -> Result<(), PathFailure> {
            let n = self.0.get();
            self.0.set(n + 1);
            if n >= 1 {
                Err(PathFailure::Timeout)
            } else {
                Ok(())
            }
        }
    }
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l, Mode::Temporary, &p, Fault::Open).is_err());
    assert!(matches!(
        b.cleanup(&Budget(Cell::new(0)), |_, _, _| Err(PathFailure::Identity)),
        Err(PathFailure::Timeout)
    ));
    assert!(b.pending());
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || b.cleanup(&permit(), |_, _, _| panic!("settlement unwind"))
        ))
        .is_err()
    );
    assert!(b.pending());
}

struct Ops {
    state: Rc<RefCell<State>>,
    book: CreationBook<Lease>,
    fault: Fault,
    at: String,
    panic_register: Rc<Cell<bool>>,
}
impl Ops {
    fn plain(&self, path: PathBuf) -> Lease {
        let l = lease(path);
        let mut s = self.state.borrow_mut();
        let id = if let Some(id) = s.dirs.get(&l.0.path) {
            *id
        } else {
            s.serial += 1;
            let id = s.serial;
            s.dirs.insert(l.0.path.clone(), id);
            id
        };
        l.0.handle.set(Some(id));
        l.0.identity.set(Some(id));
        l
    }
}
impl DirectoryOps for Ops {
    type Lease = Lease;
    fn open_base(&mut self, path: &Path, _: BaseKind, _: bool) -> Result<Lease, PathFailure> {
        Ok(self.plain(path.into()))
    }
    fn child(
        &mut self,
        parent: &Lease,
        name: &str,
        _: bool,
        fresh: bool,
    ) -> Result<Lease, PathFailure> {
        if !fresh {
            return Ok(self.plain(parent.0.path.join(name)));
        }
        let fault = if name == self.at {
            self.fault
        } else {
            Fault::None
        };
        run(
            &mut self.book,
            &self.state,
            lease(parent.0.path.join(name)),
            Mode::Temporary,
            &permit(),
            fault,
        )
    }
    fn child_permitted(
        &mut self,
        parent: &Lease,
        name: &str,
        _: bool,
        fresh: bool,
        p: &impl WorkPermit,
    ) -> Result<Lease, PathFailure> {
        check(p)?;
        self.child(parent, name, true, fresh)
    }
    fn register_owned(&mut self, l: &Lease) -> Result<(), PathFailure> {
        if self.panic_register.replace(false) {
            panic!("modeled registration unwind after provider retention")
        }
        self.book.acknowledge(l)
    }
    fn verify(&mut self, l: &Lease) -> Result<(), PathFailure> {
        verify(&self.state, l)
    }
    fn identity(&self, l: &Lease) -> DirectoryIdentity {
        DirectoryIdentity(1, l.0.identity.get().unwrap())
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
        if let Err(e) = verify(&self.state, &l) {
            return Err((e, l));
        }
        if self
            .state
            .borrow()
            .dirs
            .keys()
            .any(|p| p != &l.0.path && p.starts_with(&l.0.path))
        {
            return Err((PathFailure::Busy, l));
        }
        match settle(&self.state, &mut l.clone(), Mode::Temporary) {
            Ok(()) => Ok(()),
            Err(e) => Err((e, l)),
        }
    }
    fn auxiliary_cleanup_pending(&self) -> bool {
        self.book.pending()
    }
    fn cleanup_auxiliary(&mut self) -> Result<(), PathFailure> {
        clean(&mut self.book, &self.state)
    }
    fn cleanup_auxiliary_permitted(&mut self, p: &impl CleanupPermit) -> Result<(), PathFailure> {
        self.book.cleanup(p, |l, _, m| settle(&self.state, l, m))
    }
}
struct Nonces {
    value: usize,
    // Acquired before work/budgets; retained by the fixture's actual provider.
    _isolation: crate::service::platform_adapters::fixture_isolation::FixtureLease,
}
impl NonceSource for Nonces {
    fn next(&mut self) -> Result<String, PathFailure> {
        self.value += 1;
        Ok(format!("nonce_{}", self.value))
    }
}
type Fixture = (
    PathOwner<Ops, Nonces>,
    Rc<RefCell<State>>,
    Permit,
    Rc<Cell<bool>>,
);
fn owner(fault: Fault, at: &str) -> Fixture {
    let s = Rc::new(RefCell::new(State::default()));
    let panic = Rc::new(Cell::new(false));
    let roots = TrustedBases::new(
        root().join("app"),
        root().join("cache"),
        root().join("temp"),
        BUNDLE_ID,
        false,
    )
    .ok()
    .unwrap();
    let ops = Ops {
        state: s.clone(),
        book: CreationBook::default(),
        fault,
        at: at.into(),
        panic_register: panic.clone(),
    };
    (
        PathOwner::new(PathProvider::new(
            roots,
            ops,
            Nonces {
                value: 0,
                _isolation: crate::service::platform_adapters::fixture_isolation::acquire(),
            },
        )),
        s,
        permit(),
        panic,
    )
}
fn request(nested: bool) -> PathRequest {
    PathRequest {
        role: PathRole::Temporary,
        scope: Scope::User,
        relative_segments: if nested { vec!["leaf".into()] } else { vec![] },
        create_if_missing: true,
    }
}
#[test]
fn nonce_open_failure_is_pending_bounded_and_never_resolved() {
    let (mut o, s, p, _) = owner(Fault::Open, "nonce_1");
    let outcome = o.resolve(&request(false), &p).unwrap();
    assert!(outcome.view.resolution_state != PathState::Resolved);
    assert!(o.pending_cleanup());
    let count = s.borrow().creates;
    assert!(
        o.resolve(&request(false), &p)
            .unwrap()
            .view
            .resolution_state
            != PathState::Resolved
    );
    assert_eq!(s.borrow().creates, count);
    assert!(o.cleanup_all(&permit()).is_err());
    assert!(o.pending_cleanup());
    assert!(s.borrow().removed.is_empty());
}
#[test]
fn nested_stat_failure_retains_child_and_parent_then_cleans_owned_only() {
    let (mut o, s, p, _) = owner(Fault::Stat, "leaf");
    let spectator = root().join("spectator");
    s.borrow_mut().dirs.insert(spectator.clone(), 999);
    let outcome = o.resolve(&request(true), &p).unwrap();
    assert!(outcome.view.resolution_state != PathState::Resolved);
    assert!(o.pending_cleanup());
    assert!(o.cleanup_all(&permit()).is_ok());
    assert!(!o.pending_cleanup());
    assert_eq!(s.borrow().removed.len(), 2);
    assert!(s.borrow().dirs.contains_key(&spectator));
}
#[test]
fn nested_security_failure_keeps_proven_parent_across_child_replacement() {
    let (mut o, s, p, _) = owner(Fault::Security, "leaf");
    let _ = o.resolve(&request(true), &p).unwrap();
    assert!(o.pending_cleanup());
    let child = s
        .borrow()
        .dirs
        .keys()
        .find(|v| v.file_name().is_some_and(|n| n == "leaf"))
        .unwrap()
        .clone();
    s.borrow_mut().dirs.insert(child.clone(), 999);
    assert!(o.cleanup_all(&permit()).is_err());
    assert!(o.pending_cleanup());
    assert!(s.borrow().removed.is_empty());
    s.borrow_mut().dirs.remove(&child);
    assert!(o.cleanup_all(&permit()).is_ok());
    assert!(!o.pending_cleanup());
    assert_eq!(s.borrow().removed.len(), 1);
}
#[test]
fn nested_creation_unwind_retains_provider_parent_and_uncertain_child() {
    let (mut o, s, p, _) = owner(Fault::PanicCreate, "leaf");
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || o.resolve(&request(true), &p)
        ))
        .is_err()
    );
    assert!(o.pending_cleanup());
    assert!(o.cleanup_all(&permit()).is_err());
    assert!(o.pending_cleanup());
    let child = s
        .borrow()
        .dirs
        .keys()
        .find(|v| v.file_name().is_some_and(|n| n == "leaf"))
        .unwrap()
        .clone();
    s.borrow_mut().dirs.remove(&child);
    assert!(o.cleanup_all(&permit()).is_ok());
    assert!(!o.pending_cleanup());
    assert_eq!(s.borrow().removed.len(), 1);
}
#[test]
fn registration_unwind_happens_after_provider_owns_preallocated_stack() {
    let (mut o, s, p, panic) = owner(Fault::None, "");
    panic.set(true);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || o.resolve(&request(false), &p)
        ))
        .is_err()
    );
    assert!(o.pending_cleanup());
    assert!(o.cleanup_all(&permit()).is_ok());
    assert!(!o.pending_cleanup());
    assert_eq!(s.borrow().removed.len(), 1);
}
#[test]
fn uncertain_new_creation_does_not_prevent_other_issued_lease_cleanup() {
    let (mut o, s, p, _) = owner(Fault::Open, "nonce_2");
    let _first = o.resolve(&request(false), &p).unwrap();
    assert!(
        o.resolve(&request(false), &p)
            .unwrap()
            .view
            .resolution_state
            != PathState::Resolved
    );
    assert!(o.cleanup_all(&permit()).is_err());
    assert!(o.pending_cleanup());
    assert_eq!(s.borrow().removed.len(), 1);
    let unknown = s
        .borrow()
        .dirs
        .keys()
        .find(|v| v.file_name().is_some_and(|n| n == "nonce_2"))
        .unwrap()
        .clone();
    s.borrow_mut().dirs.remove(&unknown);
    assert!(o.cleanup_all(&permit()).is_ok());
    assert!(!o.pending_cleanup());
}
#[test]
fn issued_capacity_is_reserved_before_creation_and_retains_all_prior_leases() {
    let (mut o, s, p, _) = owner(Fault::None, "");
    for _ in 0..64 {
        assert!(
            o.resolve(&request(false), &p)
                .unwrap()
                .view
                .resolution_state
                == PathState::Resolved
        )
    }
    let count = s.borrow().creates;
    assert!(matches!(
        o.resolve(&request(false), &p),
        Err(PathFailure::Busy)
    ));
    assert_eq!(s.borrow().creates, count);
    assert!(o.cleanup_all(&permit()).is_ok());
    assert!(!o.pending_cleanup());
    assert_eq!(s.borrow().removed.len(), 64);
}
#[test]
fn old_outcome_cannot_cleanup_a_recreated_owner_lease() {
    let (mut a, _, p, _) = owner(Fault::None, "");
    let mut old = a.resolve(&request(false), &p).unwrap();
    let (mut b, s, p, _) = owner(Fault::None, "");
    let mut current = b.resolve(&request(false), &p).unwrap();
    assert!(b.cleanup(&mut old, &permit()).is_err());
    assert!(s.borrow().removed.is_empty());
    assert!(b.cleanup(&mut current, &permit()).is_ok());
    assert!(a.cleanup(&mut old, &permit()).is_ok());
}

#[test]
fn absent_name_cannot_settle_a_retained_handle_renamed_elsewhere() {
    assert!(settle_absence(None).is_ok());
    assert!(settle_absence(Some(true)).is_ok());
    assert!(matches!(
        settle_absence(Some(false)),
        Err(PathFailure::Identity)
    ));
    let (mut b, s, l, p) = prepare();
    assert!(run(&mut b, &s, l.clone(), Mode::Temporary, &p, Fault::Stat).is_err());
    let id = s.borrow_mut().dirs.remove(&l.0.path).unwrap();
    s.borrow_mut().dirs.insert(root().join("moved"), id);
    assert!(clean(&mut b, &s).is_err());
    assert!(b.pending());
    assert!(s.borrow().removed.is_empty());
}

#[test]
fn path_owner_fixtures_hold_shared_isolation_for_their_full_reentrant_lifetime() {
    use crate::service::platform_adapters::fixture_isolation;
    let (first, _, _, _) = owner(Fault::None, "");
    let (second, _, _, _) = owner(Fault::None, "");
    let excludes_other_thread = fixture_isolation::busy_on_other_thread();
    let held_both = fixture_isolation::held_by_this_thread();
    drop(first);
    let held_second = fixture_isolation::held_by_this_thread();
    drop(second);
    let released = !fixture_isolation::held_by_this_thread();
    assert!(excludes_other_thread);
    assert!(held_both);
    assert!(held_second);
    assert!(released);
}
