use super::*;
use crate::service::SupervisorError;
use crate::service::platform_adapters::policy::{LocalProcessSelection, ProcessProfile};
use std::{
    cell::RefCell,
    collections::BTreeMap,
    rc::Rc,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

struct Permit(Arc<AtomicBool>);
impl WorkPermit for Permit {
    fn check(&self) -> Result<(), SupervisorError> {
        if self.0.load(Ordering::Acquire) {
            Err(SupervisorError::Cancelled)
        } else {
            Ok(())
        }
    }
}
#[derive(Clone)]
struct Lease {
    path: PathBuf,
    id: u64,
}
#[derive(Default)]
struct State {
    calls: usize,
    dirs: BTreeMap<PathBuf, u64>,
    serial: u64,
    writable: bool,
    fresh: usize,
    removed: Vec<PathBuf>,
    cancel_after: Option<usize>,
    cancel_fresh: bool,
    collision: bool,
    busy: bool,
    alias: bool,
    cancel_probe: bool,
}
struct Ops {
    state: Rc<RefCell<State>>,
    cancelled: Arc<AtomicBool>,
}
impl Ops {
    fn open(&self, path: PathBuf, fresh: bool) -> Result<Lease, PathFailure> {
        let mut s = self.state.borrow_mut();
        s.calls += 1;
        if fresh {
            s.fresh += 1;
            if s.collision {
                return Err(PathFailure::Collision);
            }
        }
        if s.cancel_after == Some(s.calls) || (fresh && s.cancel_fresh) {
            self.cancelled.store(true, Ordering::Release);
        }
        let id = if s.alias
            && matches!(
                path.file_name().and_then(|v| v.to_str()),
                Some("data" | "cache")
            ) {
            900
        } else if let Some(id) = s.dirs.get(&path) {
            *id
        } else {
            s.serial += 1;
            s.serial
        };
        s.dirs.insert(path.clone(), id);
        Ok(Lease { path, id })
    }
}
impl DirectoryOps for Ops {
    type Lease = Lease;
    fn open_base(
        &mut self,
        path: &Path,
        _kind: BaseKind,
        _create: bool,
    ) -> Result<Lease, PathFailure> {
        self.open(path.to_path_buf(), false)
    }
    fn child(
        &mut self,
        parent: &Lease,
        name: &str,
        _create: bool,
        fresh: bool,
    ) -> Result<Lease, PathFailure> {
        self.open(parent.path.join(name), fresh)
    }
    fn verify(&mut self, lease: &Lease) -> Result<(), PathFailure> {
        if self.state.borrow().dirs.get(&lease.path) == Some(&lease.id) {
            Ok(())
        } else {
            Err(PathFailure::Identity)
        }
    }
    fn identity(&self, lease: &Lease) -> DirectoryIdentity {
        DirectoryIdentity(1, lease.id)
    }
    fn location<'a>(&self, lease: &'a Lease) -> &'a Path {
        &lease.path
    }
    fn writable_probe(
        &mut self,
        _lease: &Lease,
        _permit: &impl WorkPermit,
    ) -> Result<bool, PathFailure> {
        if self.state.borrow().cancel_probe {
            self.cancelled.store(true, Ordering::Release);
        }
        Ok(self.state.borrow().writable)
    }
    fn remove_owned_empty(&mut self, lease: Lease) -> Result<(), (PathFailure, Lease)> {
        if self.state.borrow().busy {
            return Err((PathFailure::Busy, lease));
        }
        if self.verify(&lease).is_err() {
            return Err((PathFailure::Identity, lease));
        }
        let mut s = self.state.borrow_mut();
        s.dirs.remove(&lease.path);
        s.removed.push(lease.path);
        Ok(())
    }
}
struct Nonces {
    value: u8,
    // Acquired before work/budgets; retained by the fixture's actual provider.
    _isolation: crate::service::platform_adapters::fixture_isolation::FixtureLease,
}
impl NonceSource for Nonces {
    fn next(&mut self) -> Result<String, PathFailure> {
        self.value += 1;
        Ok(format!("nonce_{}", self.value))
    }
}
fn absolute(name: &str) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(format!("C:\\Synthetic Ω漢字\\{name}"))
    } else {
        PathBuf::from(format!("/Synthetic Ω漢字/{name}"))
    }
}
fn fixture(shared: bool) -> (PathProvider<Ops, Nonces>, Rc<RefCell<State>>, Permit) {
    let state = Rc::new(RefCell::new(State {
        writable: true,
        ..State::default()
    }));
    let cancellation = Arc::new(AtomicBool::new(false));
    let roots = TrustedBases::new(
        absolute("app"),
        absolute(if shared { "app" } else { "cache" }),
        absolute("tmp"),
        BUNDLE_ID,
        false,
    )
    .ok()
    .unwrap();
    (
        PathProvider::new(
            roots,
            Ops {
                state: state.clone(),
                cancelled: cancellation.clone(),
            },
            Nonces {
                value: 0,
                _isolation: crate::service::platform_adapters::fixture_isolation::acquire(),
            },
        ),
        state,
        Permit(cancellation),
    )
}
fn request(role: PathRole) -> PathRequest {
    PathRequest {
        role,
        scope: Scope::User,
        relative_segments: vec![],
        create_if_missing: true,
    }
}

#[test]
fn system_scope_cannot_fall_back_to_user_or_touch_native_paths() {
    let (mut provider, state, permit) = fixture(false);
    let mut req = request(PathRole::ApplicationData);
    req.scope = Scope::System;
    let result = provider.resolve(&req, &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::PolicyDisabled]);
    assert_eq!(state.borrow().calls, 0);
}
#[test]
fn unsupported_roles_remain_not_evaluated_without_native_work() {
    for role in [
        PathRole::BackupStaging,
        PathRole::DiagnosticBundle,
        PathRole::LogStore,
        PathRole::ModelArtifactStore,
        PathRole::NativeHostRegistration,
    ] {
        let (mut provider, state, permit) = fixture(false);
        let result = provider.resolve(&request(role), &permit);
        assert_eq!(result.view.resolution_state, PathState::NotEvaluated);
        assert_eq!(state.borrow().calls, 0);
    }
}
#[test]
fn traversal_alias_reserved_and_oversized_segments_are_rejected_before_native_work() {
    for segments in [
        vec!["..".into()],
        vec!["a/b".into()],
        vec!["a\\b".into()],
        vec!["CON".into()],
        vec!["a.".into()],
        vec!["a\r\n".into()],
        vec!["x".repeat(65)],
        vec!["valid".into(); 9],
        vec!["x".repeat(64); 4],
    ] {
        let (mut provider, state, permit) = fixture(false);
        let mut req = request(PathRole::Cache);
        req.relative_segments = segments;
        let result = provider.resolve(&req, &permit);
        assert_eq!(result.view.resolution_state, PathState::Unavailable);
        assert_eq!(state.borrow().calls, 0);
    }
}
#[test]
fn sdk_relative_roots_overrides_and_identifier_changes_never_become_authority() {
    assert!(
        TrustedBases::new(
            PathBuf::from("relative"),
            absolute("cache"),
            absolute("tmp"),
            BUNDLE_ID,
            false
        )
        .is_err()
    );
    assert!(
        TrustedBases::new(
            absolute("data"),
            absolute("cache"),
            absolute("tmp"),
            BUNDLE_ID,
            true
        )
        .is_err()
    );
    assert!(
        TrustedBases::new(
            absolute("data"),
            absolute("cache"),
            absolute("tmp"),
            "other.application",
            false
        )
        .is_err()
    );
}
#[test]
fn local_data_and_cache_are_distinct_when_sdk_bases_alias() {
    let (mut provider, _state, permit) = fixture(true);
    let data = provider.resolve(&request(PathRole::ApplicationData), &permit);
    let cache = provider.resolve(&request(PathRole::Cache), &permit);
    assert_eq!(
        data.owned.as_ref().unwrap().lease.as_ref().unwrap().path,
        absolute("app").join("data")
    );
    assert_eq!(
        cache.owned.as_ref().unwrap().lease.as_ref().unwrap().path,
        absolute("app").join("cache")
    );
    assert_ne!(data.view.path_digest, cache.view.path_digest);
}
#[test]
fn native_identity_alias_cannot_publish_writable_cache_or_data() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().alias = true;
    let result = provider.resolve(&request(PathRole::Cache), &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::IdentityMismatch]);
    assert!(!result.view.writable);
    assert!(result.view.sanitized_path.is_none());
}
#[test]
fn metadata_alone_cannot_claim_a_writable_directory() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().writable = false;
    let result = provider.resolve(&request(PathRole::ApplicationData), &permit);
    assert_eq!(result.view.resolution_state, PathState::DeniedPermission);
    assert!(!result.view.writable);
    assert!(result.view.sanitized_path.is_none());
}
#[test]
fn cancellation_during_native_work_cannot_publish_a_late_resolution() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().cancel_after = Some(1);
    let result = provider.resolve(&request(PathRole::Cache), &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::UserCanceled]);
    assert!(result.owned.is_none());
    assert!(result.view.path_digest.is_none());
}
#[test]
fn temporary_authority_is_fresh_and_never_the_global_temp_base() {
    let (mut provider, state, permit) = fixture(false);
    let first = provider.resolve(&request(PathRole::Temporary), &permit);
    let second = provider.resolve(&request(PathRole::Temporary), &permit);
    assert_ne!(first.view.path_digest, second.view.path_digest);
    assert_eq!(state.borrow().fresh, 2);
    assert_ne!(
        first.owned.as_ref().unwrap().lease.as_ref().unwrap().path,
        absolute("tmp")
    );
}
#[test]
fn cancelled_fresh_temp_retains_cleanup_ownership_and_blocks_new_temp() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().cancel_fresh = true;
    let result = provider.resolve(&request(PathRole::Temporary), &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::UserCanceled]);
    assert!(provider.pending_cleanup());
    assert!(result.owned.is_none());
    let fresh = state.borrow().fresh;
    let _ = provider.resolve(&request(PathRole::Temporary), &permit);
    assert_eq!(state.borrow().fresh, fresh);
}
#[test]
fn persistent_paths_are_never_temp_cleanup_targets() {
    let (mut provider, state, permit) = fixture(false);
    let mut result = provider.resolve(&request(PathRole::ArtifactStore), &permit);
    let mut owned = result.owned.take().unwrap();
    assert_eq!(
        provider.cleanup(&mut owned, &permit),
        Err(PathFailure::Policy)
    );
    assert!(state.borrow().removed.is_empty());
    assert!(owned.lease.is_some());
}
#[test]
fn unimplemented_process_profiles_scope_argv_and_environment_cannot_be_selected() {
    let (_, _, permit) = fixture(false);
    for profile in [
        ProcessProfile::ModelRuntimeHost,
        ProcessProfile::NativeMessagingHost,
    ] {
        assert!(
            LocalProcessSelection::select(profile, Scope::User, &[], &[], false, &permit).is_err()
        );
    }
    assert!(
        LocalProcessSelection::select(
            ProcessProfile::LocalOrchestrator,
            Scope::System,
            &[],
            &[],
            false,
            &permit
        )
        .is_err()
    );
    assert!(
        LocalProcessSelection::select(
            ProcessProfile::LocalOrchestrator,
            Scope::User,
            &["python".into()],
            &[],
            false,
            &permit
        )
        .is_err()
    );
    assert!(
        LocalProcessSelection::select(
            ProcessProfile::LocalOrchestrator,
            Scope::User,
            &[],
            &["TOKEN=secret".into()],
            false,
            &permit
        )
        .is_err()
    );
    assert!(
        LocalProcessSelection::select(
            ProcessProfile::LocalOrchestrator,
            Scope::User,
            &[],
            &[],
            true,
            &permit
        )
        .is_err()
    );
}

struct FakeClock(std::cell::Cell<std::time::Duration>);
impl crate::service::Clock for FakeClock {
    fn now(&self) -> std::time::Duration {
        self.0.get()
    }
    fn pause(&self, duration: std::time::Duration) {
        self.0.set(self.0.get() + duration);
    }
}
struct DeadlinePermit(Arc<AtomicBool>);
impl WorkPermit for DeadlinePermit {
    fn check(&self) -> Result<(), SupervisorError> {
        if self.0.load(Ordering::Acquire) {
            Err(SupervisorError::StartupTimeout)
        } else {
            Ok(())
        }
    }
}
#[test]
fn temporary_without_creation_is_rejected_before_any_native_work() {
    let (mut provider, state, permit) = fixture(false);
    let mut req = request(PathRole::Temporary);
    req.create_if_missing = false;
    let result = provider.resolve(&req, &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::PolicyDisabled]);
    assert_eq!(state.borrow().calls, 0);
    assert!(!provider.pending_cleanup());
}
#[test]
fn deadline_after_writability_observation_does_not_publish_or_claim_unavailable_exists() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().cancel_probe = true;
    let result = provider.resolve(
        &request(PathRole::Temporary),
        &DeadlinePermit(permit.0.clone()),
    );
    assert_eq!(result.view.reason_codes, vec![Reason::Timeout]);
    assert_eq!(result.view.resolution_state, PathState::Unavailable);
    assert!(
        !result.view.exists,
        "canonical UNAVAILABLE is not an observed path publication"
    );
    assert!(!result.view.writable);
    assert!(result.view.path_digest.is_none());
    assert!(result.owned.is_none());
    assert!(provider.pending_cleanup());
}
#[test]
fn fresh_nonce_collisions_have_three_attempts_and_no_claimed_ownership() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().collision = true;
    let result = provider.resolve(&request(PathRole::Temporary), &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::IdentityMismatch]);
    assert_eq!(state.borrow().fresh, 3);
    assert!(result.owned.is_none());
    assert!(!provider.pending_cleanup());
    assert!(state.borrow().removed.is_empty());
}
#[test]
fn cleanup_keeps_busy_and_replaced_identity_and_never_removes_a_spectator() {
    let (mut provider, state, permit) = fixture(false);
    let mut result = provider.resolve(&request(PathRole::Temporary), &permit);
    let mut owned = result.owned.take().unwrap();
    let original = owned.lease.as_ref().unwrap().clone();
    let spectator = absolute("tmp").join("spectator");
    state.borrow_mut().dirs.insert(spectator.clone(), 9999);
    state.borrow_mut().busy = true;
    assert_eq!(
        provider.cleanup(&mut owned, &permit),
        Err(PathFailure::Busy)
    );
    assert_eq!(owned.cleanup_stack.len(), 1);
    state.borrow_mut().busy = false;
    state.borrow_mut().dirs.insert(original.path.clone(), 9998);
    assert_eq!(
        provider.cleanup(&mut owned, &permit),
        Err(PathFailure::Identity)
    );
    assert_eq!(owned.cleanup_stack.len(), 1);
    assert!(state.borrow().removed.is_empty());
    state
        .borrow_mut()
        .dirs
        .insert(original.path.clone(), original.id);
    assert_eq!(provider.cleanup(&mut owned, &permit), Ok(()));
    assert_eq!(state.borrow().dirs.get(&spectator), Some(&9999));
    assert_eq!(state.borrow().removed, vec![original.path]);
}
#[test]
fn temporary_children_cleanup_in_reverse_order_without_namespace_or_persistent_removal() {
    let (mut provider, state, permit) = fixture(false);
    let mut req = request(PathRole::Temporary);
    req.relative_segments = vec!["a".into(), "b".into()];
    let mut owned = provider.resolve(&req, &permit).owned.unwrap();
    let root = absolute("tmp").join(BUNDLE_ID).join("nonce_1");
    assert_eq!(provider.cleanup(&mut owned, &permit), Ok(()));
    assert_eq!(
        state.borrow().removed,
        vec![root.join("a/b"), root.join("a"), root]
    );
    assert!(
        state
            .borrow()
            .dirs
            .contains_key(&absolute("tmp").join(BUNDLE_ID))
    );
    assert!(
        state
            .borrow()
            .dirs
            .contains_key(&absolute("app").join("data"))
    );
}
#[test]
fn expired_cleanup_retains_entries_then_finite_cleanup_continues_after_work_cancellation() {
    let (mut provider, state, permit) = fixture(false);
    let mut owned = provider
        .resolve(&request(PathRole::Temporary), &permit)
        .owned
        .unwrap();
    let clock = FakeClock(std::cell::Cell::new(std::time::Duration::ZERO));
    let budget = CleanupBudget::new(&clock, std::time::Duration::from_millis(1)).unwrap();
    clock.0.set(std::time::Duration::from_millis(1));
    assert_eq!(
        provider.cleanup(&mut owned, &budget),
        Err(PathFailure::Timeout)
    );
    assert_eq!(owned.cleanup_stack.len(), 1);
    assert!(state.borrow().removed.is_empty());
    permit.0.store(true, Ordering::Release);
    let budget = CleanupBudget::new(&clock, std::time::Duration::from_secs(1)).unwrap();
    assert_eq!(provider.cleanup(&mut owned, &budget), Ok(()));
    assert!(
        permit.check().is_err(),
        "cleanup cannot restore work authority"
    );
    assert_eq!(state.borrow().removed.len(), 1);
    assert!(CleanupBudget::new(&clock, std::time::Duration::ZERO).is_err());
    assert!(CleanupBudget::new(&clock, std::time::Duration::from_secs(4)).is_err());
}
#[test]
fn cancelled_partial_temporary_creation_is_recovered_from_retained_owner() {
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().cancel_fresh = true;
    let result = provider.resolve(&request(PathRole::Temporary), &permit);
    assert!(result.owned.is_none());
    assert!(provider.pending_cleanup());
    let clock = FakeClock(std::cell::Cell::new(std::time::Duration::ZERO));
    let budget = CleanupBudget::new(&clock, std::time::Duration::from_secs(1)).unwrap();
    assert_eq!(provider.cleanup_pending(&budget), Ok(()));
    assert!(!provider.pending_cleanup());
    assert_eq!(state.borrow().removed.len(), 1);
    assert!(permit.check().is_err());
}
#[test]
fn dropped_consumer_keeps_owner_cleanup_and_registry_is_finite() {
    let (provider, state, permit) = fixture(false);
    let mut owner = PathOwner::new(provider);
    for _ in 0..64 {
        let result = owner
            .resolve(&request(PathRole::Temporary), &permit)
            .unwrap();
        assert_eq!(result.view.resolution_state, PathState::Resolved);
        drop(result);
    }
    assert!(owner.pending_cleanup());
    assert_eq!(state.borrow().fresh, 64);
    assert!(matches!(
        owner.resolve(&request(PathRole::Temporary), &permit),
        Err(PathFailure::Busy)
    ));
    assert_eq!(state.borrow().fresh, 64);
    let clock = FakeClock(std::cell::Cell::new(std::time::Duration::ZERO));
    let budget = CleanupBudget::new(&clock, std::time::Duration::from_secs(1)).unwrap();
    owner.cleanup_all(&budget).unwrap();
    assert!(!owner.pending_cleanup());
    assert_eq!(state.borrow().removed.len(), 64);
}
#[test]
fn stale_cleanup_handle_cannot_remove_a_newly_issued_directory() {
    let (provider, state, permit) = fixture(false);
    let mut owner = PathOwner::new(provider);
    let mut first = owner
        .resolve(&request(PathRole::Temporary), &permit)
        .unwrap();
    let old = first.handle;
    owner.cleanup(&mut first, &permit).unwrap();
    let mut second = owner
        .resolve(&request(PathRole::Temporary), &permit)
        .unwrap();
    let mut stale = PathOutcome {
        view: first.view.clone(),
        handle: old,
    };
    assert_eq!(
        owner.cleanup(&mut stale, &permit),
        Err(PathFailure::Invalid)
    );
    assert_eq!(state.borrow().removed.len(), 1);
    owner.cleanup(&mut second, &permit).unwrap();
    assert_eq!(state.borrow().removed.len(), 2);
}
#[test]
fn cached_root_replacement_is_checked_before_reusing_a_path() {
    let (mut provider, state, permit) = fixture(false);
    assert_eq!(
        provider
            .resolve(&request(PathRole::Cache), &permit)
            .view
            .resolution_state,
        PathState::Resolved
    );
    state
        .borrow_mut()
        .dirs
        .insert(absolute("app").join("data"), 99999);
    let result = provider.resolve(&request(PathRole::Cache), &permit);
    assert_eq!(result.view.reason_codes, vec![Reason::IdentityMismatch]);
    assert!(!result.view.writable);
    assert!(result.view.path_digest.is_none());
}
#[test]
fn native_operation_permit_has_same_monotonic_deadline_and_never_resets_cancellation() {
    let flag = AtomicBool::new(false);
    let clock = FakeClock(std::cell::Cell::new(std::time::Duration::ZERO));
    let permit = crate::service::SpawnPermit::for_operation(
        &flag,
        &clock,
        std::time::Duration::from_millis(1),
    )
    .unwrap();
    assert!(permit.check().is_ok());
    clock.0.set(std::time::Duration::from_millis(1));
    assert_eq!(permit.check(), Err(SupervisorError::StartupTimeout));
    flag.store(true, Ordering::Release);
    assert_eq!(permit.check(), Err(SupervisorError::Cancelled));
    assert!(matches!(
        crate::service::SpawnPermit::for_operation(
            &flag,
            &clock,
            std::time::Duration::from_secs(1)
        ),
        Err(SupervisorError::Cancelled)
    ));
    assert!(
        crate::service::SpawnPermit::for_operation(
            &AtomicBool::new(false),
            &clock,
            std::time::Duration::from_secs(31)
        )
        .is_err()
    );
    assert!(
        crate::service::SpawnPermit::for_operation(
            &AtomicBool::new(false),
            &clock,
            std::time::Duration::ZERO
        )
        .is_err()
    );
}
#[test]
fn relative_ambient_xdg_or_home_cannot_silently_use_sdk_fallback() {
    use crate::service::platform_adapters::native::validate_ambient_base;
    assert_eq!(
        validate_ambient_base(Some(Path::new("relative"))),
        Err(PathFailure::Invalid)
    );
    assert_eq!(
        validate_ambient_base(Some(Path::new(""))),
        Err(PathFailure::Invalid)
    );
    assert_eq!(validate_ambient_base(Some(&absolute("user"))), Ok(()));
    assert_eq!(validate_ambient_base(None), Ok(()));
}
#[test]
fn finite_diagnostics_preserve_native_failure_without_paths_or_os_text() {
    use crate::service::platform_adapters::policy::diagnostic_reason;
    for (cause, reason) in [
        (SupervisorError::Cancelled, Reason::UserCanceled),
        (SupervisorError::StartupTimeout, Reason::Timeout),
        (
            SupervisorError::ProtocolRejected,
            Reason::ServiceUnavailable,
        ),
        (SupervisorError::ChildExited, Reason::ServiceUnavailable),
        (SupervisorError::CleanupPending, Reason::ServiceUnavailable),
        (
            SupervisorError::InvalidRuntime,
            Reason::ConfigurationInvalid,
        ),
        (
            SupervisorError::ContainmentUnavailable,
            Reason::EvaluationNotRun,
        ),
    ] {
        assert_eq!(diagnostic_reason(cause), reason);
    }
}
#[test]
fn canonical_path_fields_serialize_without_private_roots_handles_or_commands() {
    let mut records = Vec::new();
    for role in [
        PathRole::ApplicationData,
        PathRole::ArtifactStore,
        PathRole::Cache,
        PathRole::Temporary,
    ] {
        let (mut provider, _, permit) = fixture(false);
        let mut req = request(role);
        req.relative_segments = vec!["profile_1".into()];
        let result = provider.resolve(&req, &permit);
        assert_eq!(result.view.resolution_state, PathState::Resolved);
        let value = serde_json::to_value(&result.view).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 8);
        let text = value.to_string();
        for private in [
            "Synthetic",
            "Ω漢字",
            "nonce_",
            "TOKEN",
            "pid",
            "handle",
            "command",
        ] {
            assert!(!text.contains(private));
        }
        records.push(value);
    }
    for role in [PathRole::NativeHostRegistration, PathRole::BackupStaging] {
        let (mut provider, _, permit) = fixture(false);
        records.push(serde_json::to_value(provider.resolve(&request(role), &permit).view).unwrap());
    }
    let (mut provider, state, permit) = fixture(false);
    state.borrow_mut().writable = false;
    records.push(
        serde_json::to_value(provider.resolve(&request(PathRole::Cache), &permit).view).unwrap(),
    );
    let (mut provider, _, permit) = fixture(false);
    let mut req = request(PathRole::ApplicationData);
    req.scope = Scope::System;
    records.push(serde_json::to_value(provider.resolve(&req, &permit).view).unwrap());
    println!("W09_CASES={}", serde_json::to_string(&records).unwrap());
}
#[test]
fn typed_termination_uses_owned_methods_only_and_never_polls_or_waits() {
    use crate::service::platform_adapters::policy::{TerminationIntent, request_owned_termination};
    use crate::service::{Bootstrap, OwnedProcess, ReadyFrame};
    #[derive(Default)]
    struct Child {
        closes: usize,
        kills: usize,
        polls: usize,
    }
    impl OwnedProcess for Child {
        fn write_bootstrap(&mut self, _: &Bootstrap<'_>) -> Result<(), SupervisorError> {
            panic!("no bootstrap")
        }
        fn read_ready(&mut self) -> Result<Option<ReadyFrame>, SupervisorError> {
            panic!("no read")
        }
        fn poll_exit(&mut self) -> Result<Option<i32>, SupervisorError> {
            self.polls += 1;
            Ok(None)
        }
        fn close_lease(&mut self) {
            self.closes += 1;
        }
        fn terminate_owned(&mut self) -> Result<(), SupervisorError> {
            self.kills += 1;
            Err(SupervisorError::ContainmentUnavailable)
        }
    }
    let mut child = Child::default();
    request_owned_termination(&mut child, TerminationIntent::None).unwrap();
    assert_eq!((child.closes, child.kills, child.polls), (0, 0, 0));
    request_owned_termination(&mut child, TerminationIntent::GracefulStop).unwrap();
    assert_eq!((child.closes, child.kills, child.polls), (1, 0, 0));
    assert_eq!(
        request_owned_termination(&mut child, TerminationIntent::ImmediateStop),
        Err(SupervisorError::ContainmentUnavailable)
    );
    assert_eq!((child.closes, child.kills, child.polls), (1, 1, 0));
}
#[test]
fn invalid_system_application_request_cannot_publish_a_canonical_result() {
    let (provider, state, permit) = fixture(false);
    let mut owner = PathOwner::new(provider);
    let mut req = request(PathRole::ApplicationData);
    req.scope = Scope::System;
    assert!(matches!(
        owner.resolve(&req, &permit),
        Err(PathFailure::Policy)
    ));
    assert_eq!(state.borrow().calls, 0);
    assert!(!owner.pending_cleanup());
}
#[test]
fn trusted_windows_roots_preserve_unicode_spaces_and_reject_namespace_aliases() {
    use crate::service::platform_adapters::policy::validate_windows_directory;
    for path in [
        r"C:\Users\Ω漢字 Space\App Data",
        "C:\\Users\\Space User\\Temp\\",
    ] {
        assert_eq!(validate_windows_directory(path), Ok(()));
    }
    for path in [
        r"relative\root",
        r"\\server\share",
        r"\\?\C:\root",
        r"C:\root\..\escape",
        r"C:\root\CON.txt",
        r"C:\root\foo:stream",
        r"C:\root\foo.",
        "C:\\root\\foo ",
        "C:\\root\\bad\nname",
    ] {
        assert_eq!(validate_windows_directory(path), Err(PathFailure::Invalid));
    }
}
#[test]
fn native_delete_release_requires_observed_absence_and_never_adopts_a_replacement() {
    let owned = DirectoryIdentity(10, 20);
    assert_eq!(
        settled_deleted_directory(owned, Some(owned)),
        Err(PathFailure::Busy)
    );
    assert_eq!(
        settled_deleted_directory(owned, Some(DirectoryIdentity(10, 21))),
        Err(PathFailure::Identity)
    );
    assert_eq!(settled_deleted_directory(owned, None), Ok(()));
}
#[test]
fn oversized_trusted_root_is_rejected_before_native_work_or_path_hashing() {
    assert!(
        TrustedBases::new(
            absolute(&"x".repeat(32 * 1024)),
            absolute("cache"),
            absolute("tmp"),
            BUNDLE_ID,
            false,
        )
        .is_err()
    );
}
#[test]
fn a_handle_from_a_prior_owner_cannot_clean_a_new_owners_directory() {
    let (a, _, permit_a) = fixture(false);
    let (b, state_b, permit_b) = fixture(false);
    let mut owner_a = PathOwner::new(a);
    let mut owner_b = PathOwner::new(b);
    let mut old = owner_a
        .resolve(&request(PathRole::Temporary), &permit_a)
        .unwrap();
    let mut new = owner_b
        .resolve(&request(PathRole::Temporary), &permit_b)
        .unwrap();
    assert_eq!(
        owner_b.cleanup(&mut old, &permit_b),
        Err(PathFailure::Invalid)
    );
    assert!(state_b.borrow().removed.is_empty());
    assert!(owner_b.pending_cleanup());
    owner_b.cleanup(&mut new, &permit_b).unwrap();
    owner_a.cleanup(&mut old, &permit_a).unwrap();
}

#[test]
fn path_provider_fixtures_hold_shared_isolation_for_their_full_reentrant_lifetime() {
    use crate::service::platform_adapters::fixture_isolation;
    let (first, _, _) = fixture(false);
    let (second, _, _) = fixture(false);
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

#[test]
fn actual_global_cas_loser_is_busy_before_provider_work_and_preserves_prior_lease() {
    use crate::service::platform_adapters::fixture_isolation;
    let (provider, losing_state, permit) = fixture(false);
    let mut losing = PathOwner::new(provider);
    let mut prior = losing
        .resolve(&request(PathRole::Temporary), &permit)
        .unwrap();
    let old_handle = prior.handle.unwrap();
    let calls_before = losing_state.borrow().calls;
    let keys_before = losing.issued.keys().copied().collect::<Vec<_>>();
    let (provider, winning_state, winning_permit) = fixture(false);
    let winning = Rc::new(RefCell::new(PathOwner::new(provider)));
    let callback_owner = winning.clone();
    let outcome = Rc::new(RefCell::new(None));
    let callback_outcome = outcome.clone();
    let counter_before = NEXT_PATH_HANDLE.load(Ordering::Acquire);
    let result = fixture_isolation::with_after_load(
        move || {
            let won = callback_owner
                .borrow_mut()
                .resolve(&request(PathRole::Temporary), &winning_permit)
                .unwrap();
            *callback_outcome.borrow_mut() = Some(won);
        },
        || losing.resolve(&request(PathRole::Temporary), &permit),
    );
    assert!(matches!(result, Err(PathFailure::Busy)));
    assert_eq!(losing_state.borrow().calls, calls_before);
    assert_eq!(
        losing.issued.keys().copied().collect::<Vec<_>>(),
        keys_before
    );
    assert_eq!(prior.handle, Some(old_handle));
    assert!(losing_state.borrow().removed.is_empty());
    assert_eq!(winning.borrow().issued.len(), 1);
    assert_eq!(NEXT_PATH_HANDLE.load(Ordering::Acquire), counter_before + 1);
    let mut won = outcome.borrow_mut().take().unwrap();
    assert_ne!(won.handle.unwrap(), old_handle);
    losing.cleanup(&mut prior, &permit).unwrap();
    winning.borrow_mut().cleanup(&mut won, &permit).unwrap();
    assert!(losing.issued.is_empty());
    assert!(winning.borrow().issued.is_empty());
    assert_eq!(losing_state.borrow().removed.len(), 1);
    assert_eq!(winning_state.borrow().removed.len(), 1);
}
