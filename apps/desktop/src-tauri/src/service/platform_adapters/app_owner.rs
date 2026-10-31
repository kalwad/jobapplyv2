//! Lazy app-owned native API. The service owns workers and cleanup, not callers.
use super::{
    CleanupBudget, CleanupPermit, NativePaths, PathFailure, PathOutcome, PathRequest, WorkPermit,
};
use crate::service::{Clock, SupervisorError, owned_worker::OwnedWorker};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tauri::Manager;
pub(crate) const PATH_WORK_CAP: Duration = Duration::from_secs(4);
pub(crate) const PATH_CLEANUP_CAP: Duration = Duration::from_secs(3);
#[derive(Clone)]
pub(crate) struct NativeWorkPermit {
    cancellation: Arc<AtomicBool>,
    clock: Arc<dyn Clock + Send + Sync>,
    deadline: Duration,
}
impl WorkPermit for NativeWorkPermit {
    fn check(&self) -> Result<(), SupervisorError> {
        if self.cancellation.load(Ordering::Acquire) {
            Err(SupervisorError::Cancelled)
        } else if self.clock.now() >= self.deadline {
            Err(SupervisorError::StartupTimeout)
        } else {
            Ok(())
        }
    }
}
pub(crate) trait PathBackend: Send + 'static {
    fn resolve(
        &mut self,
        r: &PathRequest,
        p: &NativeWorkPermit,
    ) -> Result<PathOutcome, PathFailure>;
    fn release(&mut self, o: &mut PathOutcome, p: &impl CleanupPermit) -> Result<(), PathFailure>;
    fn cleanup_all(&mut self, p: &impl CleanupPermit) -> Result<(), PathFailure>;
    fn pending(&self) -> bool;
}
impl PathBackend for NativePaths {
    fn resolve(
        &mut self,
        r: &PathRequest,
        p: &NativeWorkPermit,
    ) -> Result<PathOutcome, PathFailure> {
        self.resolve(r, p)
    }
    fn release(&mut self, o: &mut PathOutcome, p: &impl CleanupPermit) -> Result<(), PathFailure> {
        self.cleanup(o, p)
    }
    fn cleanup_all(&mut self, p: &impl CleanupPermit) -> Result<(), PathFailure> {
        self.cleanup_all(p)
    }
    fn pending(&self) -> bool {
        self.pending_cleanup()
    }
}
enum State<B> {
    Uninitialized,
    InitializationFailed,
    Retained { backend: B, deny_work: bool },
}
pub(crate) struct RetainedPaths<B> {
    state: Mutex<State<B>>,
    cancellation: Arc<AtomicBool>,
    clock: Arc<dyn Clock + Send + Sync>,
    pub(crate) worker: OwnedWorker,
}
impl<B: PathBackend> RetainedPaths<B> {
    pub(crate) fn new(cancellation: Arc<AtomicBool>, clock: Arc<dyn Clock + Send + Sync>) -> Self {
        Self {
            state: Mutex::new(State::Uninitialized),
            cancellation,
            clock,
            worker: OwnedWorker::default(),
        }
    }
    fn work_permit(&self, total: Option<Duration>) -> Result<NativeWorkPermit, PathFailure> {
        let total = total.unwrap_or(PATH_WORK_CAP);
        if total.is_zero() || total > PATH_WORK_CAP {
            return Err(PathFailure::Invalid);
        }
        let permit = NativeWorkPermit {
            cancellation: self.cancellation.clone(),
            clock: self.clock.clone(),
            deadline: self
                .clock
                .now()
                .checked_add(total)
                .ok_or(PathFailure::Invalid)?,
        };
        super::policy::check(&permit)?;
        Ok(permit)
    }
    fn retained(&self) -> std::sync::MutexGuard<'_, State<B>> {
        match self.state.lock() {
            Ok(g) => g,
            Err(e) => {
                let mut g = e.into_inner();
                if let State::Retained { deny_work, .. } = &mut *g {
                    *deny_work = true
                }
                g
            }
        }
    }
    fn resolve(
        &self,
        r: PathRequest,
        p: NativeWorkPermit,
        initialize: impl FnOnce() -> Result<B, PathFailure>,
    ) -> Result<PathOutcome, PathFailure> {
        super::policy::check(&p)?;
        let mut state = self.retained();
        super::policy::check(&p)?;
        if matches!(*state, State::Uninitialized) {
            // SDK discovery creates no native directories. Retain the resulting
            // backend before the first fallible native operation.
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(initialize)) {
                Ok(Ok(backend)) => {
                    *state = State::Retained {
                        backend,
                        deny_work: false,
                    };
                }
                Ok(Err(e)) => {
                    *state = State::InitializationFailed;
                    return Err(e);
                }
                Err(_) => {
                    *state = State::InitializationFailed;
                    return Err(PathFailure::Interrupted);
                }
            }
        }
        match &mut *state {
            State::Retained { backend, deny_work } => {
                if *deny_work {
                    return Err(PathFailure::Interrupted);
                }
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    backend.resolve(&r, &p)
                })) {
                    Ok(result) => {
                        super::policy::check(&p)?;
                        result
                    }
                    Err(_) => {
                        *deny_work = true;
                        Err(PathFailure::Interrupted)
                    }
                }
            }
            _ => Err(PathFailure::Interrupted),
        }
    }
    #[cfg(test)]
    fn release(&self, o: &mut PathOutcome) -> Result<(), PathFailure> {
        self.release_until(o, self.clock.now() + PATH_CLEANUP_CAP)
    }
    fn release_until(&self, o: &mut PathOutcome, deadline: Duration) -> Result<(), PathFailure> {
        let budget = CleanupBudget::clipped(self.clock.as_ref(), PATH_CLEANUP_CAP, deadline)?;
        let mut state = self.retained();
        match &mut *state {
            State::Retained { backend, deny_work } => {
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    backend.release(o, &budget)
                })) {
                    Ok(r) => {
                        budget.check_cleanup()?;
                        r
                    }
                    Err(_) => {
                        *deny_work = true;
                        Err(PathFailure::Interrupted)
                    }
                }
            }
            _ => Err(PathFailure::Invalid),
        }
    }
    pub(crate) fn cleanup_until(&self, deadline: Duration) -> Result<(), PathFailure> {
        let total = deadline
            .saturating_sub(self.clock.now())
            .min(PATH_CLEANUP_CAP);
        if total.is_zero() {
            return Err(PathFailure::Timeout);
        }
        let budget = CleanupBudget::clipped(self.clock.as_ref(), total, deadline)?;
        let mut state = self.retained();
        match &mut *state {
            State::Retained { backend, deny_work } => {
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    backend.cleanup_all(&budget)
                })) {
                    Ok(result) => {
                        budget.check_cleanup()?;
                        result?;
                        if backend.pending() {
                            Err(PathFailure::Busy)
                        } else {
                            Ok(())
                        }
                    }
                    Err(_) => {
                        *deny_work = true;
                        Err(PathFailure::Interrupted)
                    }
                }
            }
            _ => Ok(()),
        }
    }
    fn start_resolve(
        self: &Arc<Self>,
        request: PathRequest,
        permit: NativeWorkPermit,
        initialize: impl FnOnce() -> Result<B, PathFailure> + Send + 'static,
    ) -> Result<tokio::sync::oneshot::Receiver<Result<PathOutcome, PathFailure>>, PathFailure> {
        super::policy::check(&permit)?;
        let owner = self.clone();
        let (send, receive) = tokio::sync::oneshot::channel();
        let claim_permit = permit.clone();
        self.worker.spawn_guarded(
            "japp-native-paths",
            || super::policy::check(&claim_permit),
            move || {
                let result = owner.resolve(request, permit, initialize);
                let _ = send.send(result);
            },
        )?;
        Ok(receive)
    }
    fn start_release(
        self: &Arc<Self>,
        mut outcome: PathOutcome,
        deadline: Duration,
    ) -> Result<tokio::sync::oneshot::Receiver<Result<(), PathFailure>>, PathFailure> {
        let owner = self.clone();
        let (send, receive) = tokio::sync::oneshot::channel();
        self.worker.spawn_guarded(
            "japp-native-release",
            || {
                if self.cancellation.load(Ordering::Acquire) {
                    Err(PathFailure::Cancelled)
                } else if self.clock.now() >= deadline {
                    Err(PathFailure::Timeout)
                } else {
                    Ok(())
                }
            },
            move || {
                let result = owner.release_until(&mut outcome, deadline);
                let _ = send.send(result);
            },
        )?;
        Ok(receive)
    }
    pub(crate) fn start_quit(
        self: &Arc<Self>,
        deadline: Duration,
        done: impl FnOnce(bool) + Send + 'static,
    ) -> Result<(), PathFailure> {
        if self.empty() {
            done(true);
            return Ok(());
        }
        let owner = self.clone();
        self.worker.spawn("japp-native-cleanup", move || {
            done(owner.cleanup_until(deadline).is_ok())
        })
    }
    pub(crate) fn empty(&self) -> bool {
        if self.worker.busy() {
            return false;
        }
        // An empty settlement is a read of the actual retained state, never an
        // early atomic snapshot that could miss a just-completed initialization.
        match self.state.try_lock() {
            Ok(state) => matches!(*state, State::Uninitialized | State::InitializationFailed),
            Err(_) => false,
        }
    }
    #[cfg(test)]
    pub(crate) fn while_locked_for_test<R>(&self, body: impl FnOnce() -> R) -> R {
        let _guard = self.state.lock().unwrap();
        body()
    }
    #[cfg(test)]
    fn pending(&self) -> bool {
        match &*self.retained() {
            State::Retained { backend, .. } => backend.pending(),
            _ => false,
        }
    }
}
/// Native library API for future storage consumers. Clones share one retained
/// app-lifetime owner. No native path or OS handle crosses the renderer bridge.
#[derive(Clone)]
pub struct NativePathService {
    owner: Arc<RetainedPaths<NativePaths>>,
}
impl NativePathService {
    pub(crate) fn new(cancellation: Arc<AtomicBool>, clock: Arc<dyn Clock + Send + Sync>) -> Self {
        Self {
            owner: Arc::new(RetainedPaths::new(cancellation, clock)),
        }
    }
    /// Resolve lazily, with a positive requested budget no greater than four seconds.
    pub async fn resolve(
        &self,
        app: &tauri::AppHandle,
        request: PathRequest,
        shorter_budget: Option<Duration>,
    ) -> Result<PathOutcome, PathFailure> {
        // A handle from another app cannot initialize this app's native owner.
        let registered = app
            .try_state::<crate::service::ManagedService>()
            .ok_or(PathFailure::Policy)?;
        if !self.same_owner(&registered.native_paths()) {
            return Err(PathFailure::Policy);
        }
        let permit = self.owner.work_permit(shorter_budget)?;
        let total = permit.deadline.saturating_sub(self.owner.clock.now());
        let deadline = permit.deadline;
        let app = app.clone();
        let receive = self
            .owner
            .start_resolve(request, permit, move || NativePaths::from_app(&app))?;
        let result = tokio::time::timeout(total, receive)
            .await
            .map_err(|_| PathFailure::Timeout)?
            .map_err(|_| PathFailure::Interrupted)?;
        if self.owner.cancellation.load(Ordering::Acquire) {
            return Err(PathFailure::Cancelled);
        }
        if self.owner.clock.now() >= deadline {
            return Err(PathFailure::Timeout);
        }
        result
    }
    /// Release a disposable result. The provider retains its lease if this future,
    /// its outcome or its reply is dropped, or a native operation fails.
    /// After Quit closes work, new public releases return Cancelled; the same
    /// retained entry is settled by the independent app Quit cleanup permit.
    pub async fn release(&self, outcome: PathOutcome) -> Result<(), PathFailure> {
        let deadline = self
            .owner
            .clock
            .now()
            .checked_add(PATH_CLEANUP_CAP)
            .ok_or(PathFailure::Invalid)?;
        let receive = self.owner.start_release(outcome, deadline)?;
        let result = tokio::time::timeout(PATH_CLEANUP_CAP, receive)
            .await
            .map_err(|_| PathFailure::Timeout)?
            .map_err(|_| PathFailure::Interrupted)?;
        if self.owner.clock.now() >= deadline {
            return Err(PathFailure::Timeout);
        }
        result
    }
    #[cfg(test)]
    pub(crate) fn shares_cancellation_for_test(&self, cancel: &Arc<AtomicBool>) -> bool {
        Arc::ptr_eq(cancel, &self.owner.cancellation)
    }
    fn same_owner(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.owner, &other.owner)
    }
    #[cfg(test)]
    pub(crate) fn same_owner_for_test(&self, other: &Self) -> bool {
        self.same_owner(other)
    }
    pub(crate) fn busy(&self) -> bool {
        self.owner.worker.busy()
    }
    pub(crate) fn start_quit(
        &self,
        deadline: Duration,
        done: impl FnOnce(bool) + Send + 'static,
    ) -> Result<(), PathFailure> {
        self.owner.start_quit(deadline, done)
    }
}
#[cfg(test)]
#[path = "app_owner_tests.rs"]
pub(crate) mod tests;
