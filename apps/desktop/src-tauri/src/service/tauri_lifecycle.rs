//! Concrete Tauri wrapper. A single worker owns startup, observation, recovery and cleanup.
use super::{
    ConfiguredRuntime, MonotonicClock, Policy, SupervisorError,
    lifecycle_state::ShutdownGate,
    restart::{RecoveryFailure, RecoveryPolicy, RecoveryState, RestartOwner, ShutdownSignal},
};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU8, Ordering},
    },
    time::Duration,
};
use tauri::{AppHandle, ExitRequestApi, Manager};
type NativeSupervisor = RestartOwner<ConfiguredRuntime, MonotonicClock>;
pub(crate) type LifecycleDiagnostic = RecoveryState;
pub(super) fn update_background_phase(
    current: &AtomicU8,
    cancelled: &AtomicBool,
    next: LifecycleDiagnostic,
) -> bool {
    if cancelled.load(Ordering::Acquire) {
        return false;
    }
    let previous = current.load(Ordering::Acquire);
    let allowed = match next {
        LifecycleDiagnostic::Starting => [
            LifecycleDiagnostic::Unavailable as u8,
            LifecycleDiagnostic::Backoff as u8,
        ]
        .contains(&previous),
        // A blocking Backoff poll performs Starting -> ACK -> Running internally;
        // the single worker observes only final Running when that poll returns.
        LifecycleDiagnostic::Running => [
            LifecycleDiagnostic::Starting as u8,
            LifecycleDiagnostic::Backoff as u8,
        ]
        .contains(&previous),
        LifecycleDiagnostic::Unavailable => previous == LifecycleDiagnostic::Starting as u8,
        LifecycleDiagnostic::Recovering => [
            LifecycleDiagnostic::Running as u8,
            LifecycleDiagnostic::Failed as u8,
        ]
        .contains(&previous),
        LifecycleDiagnostic::Backoff => [
            LifecycleDiagnostic::Recovering as u8,
            LifecycleDiagnostic::Backoff as u8,
        ]
        .contains(&previous),
        LifecycleDiagnostic::Failed => [
            LifecycleDiagnostic::Unavailable as u8,
            LifecycleDiagnostic::Starting as u8,
            LifecycleDiagnostic::Running as u8,
            LifecycleDiagnostic::Recovering as u8,
            LifecycleDiagnostic::Backoff as u8,
            LifecycleDiagnostic::Failed as u8,
        ]
        .contains(&previous),
        LifecycleDiagnostic::CleanupFailed => [
            LifecycleDiagnostic::Starting as u8,
            LifecycleDiagnostic::Running as u8,
            LifecycleDiagnostic::Recovering as u8,
            LifecycleDiagnostic::Backoff as u8,
            LifecycleDiagnostic::Failed as u8,
        ]
        .contains(&previous),
        LifecycleDiagnostic::Stopping | LifecycleDiagnostic::Stopped => false,
    };
    allowed
        && current
            .compare_exchange(previous, next as u8, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
}
#[derive(Clone)]
pub struct ManagedService {
    supervisor: Arc<Mutex<NativeSupervisor>>,
    cancellation: Arc<AtomicBool>,
    authority: Arc<super::authority_hub::AuthorityHub>,
    signal: ShutdownSignal,
    gate: Arc<ShutdownGate>,
    pending_shutdown: Arc<AtomicBool>,
    worker_running: Arc<AtomicBool>,
    diagnostic: Arc<AtomicU8>,
}
struct WorkerClaim(Arc<AtomicBool>);
impl Drop for WorkerClaim {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl ManagedService {
    pub fn new(runtime: ConfiguredRuntime) -> Result<Self, SupervisorError> {
        let owner = RestartOwner::new(
            runtime,
            MonotonicClock::default(),
            Policy::default(),
            RecoveryPolicy::default(),
        )
        .map_err(|error| match error {
            RecoveryFailure::Supervisor(error) => error,
            RecoveryFailure::InvalidPolicy => SupervisorError::InvalidPolicy,
        })?;
        let signal = owner.shutdown_signal();
        let gate = Arc::new(ShutdownGate::with_authority(owner.authority_handle()));
        Ok(Self {
            cancellation: owner.quit_handle(),
            authority: owner.authority_handle(),
            supervisor: Arc::new(Mutex::new(owner)),
            signal,
            gate,
            pending_shutdown: Arc::new(AtomicBool::new(false)),
            worker_running: Arc::new(AtomicBool::new(false)),
            diagnostic: Arc::new(AtomicU8::new(RecoveryState::Unavailable as u8)),
        })
    }
    fn title(state: RecoveryState) -> &'static str {
        match state {
            RecoveryState::Unavailable => "Desktop App — Local service unavailable",
            RecoveryState::Starting => "Desktop App — Starting local service",
            RecoveryState::Running => "Desktop App",
            RecoveryState::Recovering | RecoveryState::Backoff => {
                "Desktop App — Restarting local service"
            }
            RecoveryState::Failed => "Desktop App — Local service failed",
            RecoveryState::Stopping => "Desktop App — Stopping local service",
            RecoveryState::Stopped => "Desktop App — Local service stopped",
            RecoveryState::CleanupFailed => {
                "Desktop App — Could not stop local service; retry Quit"
            }
        }
    }
    pub fn diagnostic(&self) -> RecoveryState {
        match self.diagnostic.load(Ordering::Acquire) {
            1 => RecoveryState::Starting,
            2 => RecoveryState::Running,
            3 => RecoveryState::Recovering,
            4 => RecoveryState::Backoff,
            5 => RecoveryState::Failed,
            6 => RecoveryState::Stopping,
            7 => RecoveryState::Stopped,
            8 => RecoveryState::CleanupFailed,
            _ => RecoveryState::Unavailable,
        }
    }
    fn update_background_phase(&self, state: RecoveryState) -> bool {
        update_background_phase(&self.diagnostic, &self.cancellation, state)
    }
    #[cfg(test)]
    pub(crate) fn phase_for_test(&self, state: LifecycleDiagnostic) -> bool {
        self.update_background_phase(state)
    }
    fn refresh_title(&self, app: &AppHandle) {
        let managed = self.clone();
        let app = app.clone();
        let dispatcher = app.clone();
        let _ = dispatcher.run_on_main_thread(move || {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(Self::title(managed.diagnostic()));
            }
        });
    }
    fn publish_background(&self, app: &AppHandle, state: RecoveryState) {
        if self.update_background_phase(state) {
            self.refresh_title(app);
        }
    }
    fn publish_shutdown(&self, app: &AppHandle, state: RecoveryState) {
        self.diagnostic.store(state as u8, Ordering::Release);
        self.refresh_title(app);
    }
    fn claim_worker(&self) -> bool {
        self.worker_running
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }
    pub fn start_background(&self, app: &AppHandle) -> std::io::Result<()> {
        if !self.claim_worker() {
            return Ok(());
        }
        self.publish_background(app, RecoveryState::Starting);
        self.spawn_claimed_worker(app)
    }
    fn spawn_claimed_worker(&self, app: &AppHandle) -> std::io::Result<()> {
        let managed = self.clone();
        let app = app.clone();
        let error_app = app.clone();
        let result = std::thread::Builder::new()
            .name("japp-service-owner".into())
            .spawn(move || {
                let _claim = WorkerClaim(Arc::clone(&managed.worker_running));
                let mut start_pending = true;
                let mut monitor_failed = false;
                loop {
                    if managed.pending_shutdown.swap(false, Ordering::AcqRel) {
                        let stopped = match managed.supervisor.lock() {
                            Ok(mut owner) => owner.shutdown().is_ok(),
                            Err(poison) => {
                                let mut owner = poison.into_inner();
                                owner.invalidate_poisoned_authority();
                                owner.shutdown().is_ok()
                            }
                        };
                        if stopped {
                            managed.gate.finish(true);
                            managed.publish_shutdown(&app, RecoveryState::Stopped);
                            app.exit(0);
                            return;
                        }
                        managed.publish_shutdown(&app, RecoveryState::CleanupFailed);
                        managed.gate.finish(false);
                        start_pending = false;
                    } else if !managed.signal.is_closed() && !monitor_failed {
                        let state = match managed.supervisor.lock() {
                            Ok(mut owner) => {
                                if start_pending {
                                    let _ = owner.start_initial();
                                    start_pending = false;
                                } else {
                                    let _ = owner.poll();
                                }
                                owner.snapshot().state
                            }
                            Err(poison) => {
                                let mut owner = poison.into_inner();
                                owner.invalidate_poisoned_authority();
                                start_pending = false;
                                monitor_failed = true;
                                owner.snapshot().state
                            }
                        };
                        managed.publish_background(&app, state);
                    }
                    // The worker never waits while holding native lifecycle ownership.
                    std::thread::sleep(Duration::from_millis(100));
                }
            });
        match result {
            Ok(_) => Ok(()),
            Err(error) => {
                self.worker_running.store(false, Ordering::Release);
                if self.signal.is_closed() {
                    self.publish_shutdown(&error_app, RecoveryState::CleanupFailed);
                    self.gate.finish(false);
                } else {
                    self.publish_background(&error_app, RecoveryState::Failed);
                }
                Err(error)
            }
        }
    }
    // One production command boundary: no waiting owner lock or cleanup.
    fn try_owner<R>(
        &self,
        callback: impl FnOnce(&mut NativeSupervisor) -> R,
    ) -> Result<R, SupervisorError> {
        match self.supervisor.try_lock() {
            Ok(mut supervisor) => Ok(callback(&mut supervisor)),
            Err(std::sync::TryLockError::WouldBlock) => Err(SupervisorError::RuntimeUnavailable),
            Err(std::sync::TryLockError::Poisoned(poisoned)) => {
                poisoned.into_inner().invalidate_poisoned_authority();
                update_background_phase(
                    &self.diagnostic,
                    &self.cancellation,
                    LifecycleDiagnostic::Failed,
                );
                Err(SupervisorError::CleanupFailed)
            }
        }
    }
    #[cfg(test)]
    pub(crate) fn with_running_session<R>(
        &self,
        callback: impl FnOnce(&super::ServiceIdentity, &str, Arc<AtomicBool>) -> R,
    ) -> Result<R, SupervisorError> {
        self.try_owner(|supervisor| supervisor.with_running_session(callback))?
    }
    pub(crate) fn client_session(&self) -> Result<super::NativeSession, SupervisorError> {
        self.try_owner(|supervisor| supervisor.client_session())?
    }
    pub(crate) fn authority_epoch(&self) -> u64 {
        self.authority.current_epoch()
    }
    pub fn allow_exit(&self) -> bool {
        self.gate.completed()
    }
    pub fn on_exit_requested(&self, app: &AppHandle, api: &ExitRequestApi) {
        if !self.allow_exit() {
            api.prevent_exit();
            self.request_shutdown(app);
        }
    }
    pub fn request_shutdown(&self, app: &AppHandle) {
        if !self.gate.begin() {
            return;
        }
        // Gate closes the exact generation/epoch immediately, before owner locking.
        debug_assert!(self.signal.is_closed());
        self.pending_shutdown.store(true, Ordering::Release);
        self.publish_shutdown(app, RecoveryState::Stopping);
        if self.claim_worker() {
            let _ = self.spawn_claimed_worker(app);
        }
    }
}

#[cfg(test)]
mod contention_tests {
    use super::*;
    use std::sync::mpsc;
    fn prove_prompt_busy_return(phase: LifecycleDiagnostic) {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        managed.diagnostic.store(phase as u8, Ordering::Release);
        let (held, ready) = mpsc::channel();
        let (release, wait) = mpsc::channel();
        let owner = managed.clone();
        let worker = std::thread::spawn(move || {
            let _guard = owner.supervisor.lock().unwrap();
            held.send(()).unwrap();
            wait.recv().unwrap();
        });
        ready.recv().unwrap();
        let (observed, receive) = mpsc::channel();
        let command = managed.clone();
        let reader = std::thread::spawn(move || {
            let result = command.with_running_session(|_, _, _| ());
            observed.send(result).unwrap();
        });
        let early = receive.recv_timeout(std::time::Duration::from_millis(100));
        let returned_before_release = early.is_ok();
        let observed_phase = managed.diagnostic();
        release.send(()).unwrap();
        worker.join().unwrap();
        let result = early.unwrap_or_else(|_| {
            receive
                .recv_timeout(std::time::Duration::from_secs(1))
                .unwrap()
        });
        reader.join().unwrap();
        assert_eq!(
            observed_phase, phase,
            "phase snapshot must also be lock free"
        );
        assert!(
            returned_before_release,
            "command waited for the entire startup/cleanup owner lock"
        );
        assert_eq!(result, Err(SupervisorError::RuntimeUnavailable));
    }
    #[test]
    fn cancelled_startup_cannot_overwrite_finite_shutdown_failure() {
        let phase = AtomicU8::new(LifecycleDiagnostic::CleanupFailed as u8);
        let cancelled = AtomicBool::new(true);
        for late in [
            LifecycleDiagnostic::Running,
            LifecycleDiagnostic::Failed,
            LifecycleDiagnostic::Unavailable,
        ] {
            assert!(!update_background_phase(&phase, &cancelled, late));
            assert_eq!(
                phase.load(Ordering::Acquire),
                LifecycleDiagnostic::CleanupFailed as u8
            );
        }
    }
    #[test]
    fn phase_compare_exchange_rejects_stop_even_with_stale_cancel_observation() {
        let phase = AtomicU8::new(LifecycleDiagnostic::Unavailable as u8);
        let cancelled = AtomicBool::new(false);
        assert!(update_background_phase(
            &phase,
            &cancelled,
            LifecycleDiagnostic::Starting
        ));
        assert!(update_background_phase(
            &phase,
            &cancelled,
            LifecycleDiagnostic::Running
        ));
        phase.store(LifecycleDiagnostic::Stopping as u8, Ordering::Release);
        for late in [
            LifecycleDiagnostic::Running,
            LifecycleDiagnostic::Failed,
            LifecycleDiagnostic::Unavailable,
        ] {
            assert!(!update_background_phase(&phase, &cancelled, late));
            assert_eq!(
                phase.load(Ordering::Acquire),
                LifecycleDiagnostic::Stopping as u8
            );
        }
    }
    #[test]
    fn poisoned_owner_returns_prompt_failure_and_safe_phase() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        let owner = managed.clone();
        std::thread::spawn(move || {
            let _ = std::panic::catch_unwind(|| {
                let _guard = owner.supervisor.lock().unwrap();
                panic!("owned poison test");
            });
        })
        .join()
        .unwrap();
        let start = std::time::Instant::now();
        assert_eq!(
            managed.with_running_session(|_, _, _| ()),
            Err(SupervisorError::CleanupFailed)
        );
        assert!(start.elapsed() < std::time::Duration::from_millis(100));
        assert_eq!(managed.diagnostic(), LifecycleDiagnostic::Failed);
    }
    #[test]
    fn poisoned_command_cannot_overwrite_accepted_shutdown_failure() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        let owner = managed.clone();
        std::thread::spawn(move || {
            let _ = std::panic::catch_unwind(|| {
                let _guard = owner.supervisor.lock().unwrap();
                panic!("owned stop-priority poison test");
            });
        })
        .join()
        .unwrap();
        assert!(managed.gate.begin(), "use the exact accepted-Quit gate");
        managed
            .diagnostic
            .store(LifecycleDiagnostic::CleanupFailed as u8, Ordering::Release);
        let start = std::time::Instant::now();
        assert_eq!(
            managed.with_running_session(|_, _, _| ()),
            Err(SupervisorError::CleanupFailed)
        );
        assert!(start.elapsed() < std::time::Duration::from_millis(100));
        assert_eq!(managed.diagnostic(), LifecycleDiagnostic::CleanupFailed);
    }
    #[test]
    fn busy_starting_owner_never_blocks_command_snapshot() {
        prove_prompt_busy_return(LifecycleDiagnostic::Starting);
    }
    #[test]
    fn busy_stopping_owner_never_blocks_command_snapshot() {
        prove_prompt_busy_return(LifecycleDiagnostic::Stopping);
    }
}

#[cfg(test)]
mod bridge_tests {
    use super::*;
    #[test]
    fn bridge_actual_client_snapshot_and_epoch_do_not_wait_for_busy_native_owner() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        let expected = managed.authority_epoch();
        let lock = managed.supervisor.lock().unwrap();
        let (send, receive) = std::sync::mpsc::channel();
        let command = managed.clone();
        let reader = std::thread::spawn(move || {
            let result = matches!(
                command.client_session(),
                Err(SupervisorError::RuntimeUnavailable)
            );
            send.send((result, command.authority_epoch())).unwrap();
        });
        let early = receive.recv_timeout(std::time::Duration::from_millis(100));
        drop(lock);
        reader.join().unwrap();
        assert_eq!(early.unwrap(), (true, expected));
    }
}

#[cfg(test)]
mod recovery_wrapper_tests {
    use super::*;
    use std::sync::mpsc;
    #[test]
    fn duplicate_background_claims_cannot_create_two_lifecycle_owners() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        assert!(managed.claim_worker());
        assert!(!managed.claim_worker());
        drop(WorkerClaim(Arc::clone(&managed.worker_running)));
        assert!(managed.claim_worker());
    }
    #[test]
    fn held_owner_returns_busy_before_native_start_or_cleanup_releases() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        let (held, ready) = mpsc::channel();
        let (release, wait) = mpsc::channel();
        let owner = managed.clone();
        let worker = std::thread::spawn(move || {
            let _guard = owner.supervisor.lock().unwrap();
            held.send(()).unwrap();
            wait.recv().unwrap();
        });
        ready.recv().unwrap();
        let (send, receive) = mpsc::channel();
        let command = managed.clone();
        let reader = std::thread::spawn(move || {
            send.send(matches!(
                command.client_session(),
                Err(SupervisorError::RuntimeUnavailable)
            ))
            .unwrap();
        });
        let early = receive.recv_timeout(Duration::from_millis(100));
        release.send(()).unwrap();
        worker.join().unwrap();
        reader.join().unwrap();
        assert!(early.unwrap());
    }
    #[test]
    fn quit_signal_closes_before_waiting_for_a_busy_native_owner() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        let _guard = managed.supervisor.lock().unwrap();
        assert!(managed.gate.begin());
        managed.signal.close();
        assert!(managed.signal.is_closed());
        assert!(!managed.gate.begin());
    }
    #[test]
    fn stop_priority_rejects_late_background_failure_and_unavailable() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        managed.signal.close();
        for stopping in [RecoveryState::Stopping, RecoveryState::CleanupFailed] {
            managed.diagnostic.store(stopping as u8, Ordering::Release);
            for late in [
                RecoveryState::Running,
                RecoveryState::Failed,
                RecoveryState::Unavailable,
            ] {
                assert!(!managed.update_background_phase(late));
                assert_eq!(managed.diagnostic.load(Ordering::Acquire), stopping as u8);
            }
        }
    }
    #[test]
    fn stop_priority_poisoned_command_cannot_replace_shutdown_failure() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        let poison = managed.clone();
        std::thread::spawn(move || {
            let _ = std::panic::catch_unwind(|| {
                let _guard = poison.supervisor.lock().unwrap();
                panic!("owned poison fixture");
            });
        })
        .join()
        .unwrap();
        managed.signal.close();
        managed
            .diagnostic
            .store(RecoveryState::CleanupFailed as u8, Ordering::Release);
        assert_eq!(
            managed.with_running_session(|_, _, _| ()),
            Err(SupervisorError::CleanupFailed)
        );
        assert_eq!(
            managed.diagnostic.load(Ordering::Acquire),
            RecoveryState::CleanupFailed as u8
        );
    }
    #[test]
    fn review_successful_coalesced_recovery_publishes_running_from_backoff() {
        let managed = ManagedService::new(ConfiguredRuntime::unavailable()).unwrap();
        for phase in [
            RecoveryState::Starting,
            RecoveryState::Running,
            RecoveryState::Recovering,
            RecoveryState::Backoff,
        ] {
            assert!(managed.update_background_phase(phase));
        }
        assert!(
            managed.update_background_phase(RecoveryState::Running),
            "worker sees only final Running when blocking Backoff poll returns"
        );
        assert_eq!(managed.diagnostic(), RecoveryState::Running);
        assert!(
            managed.update_background_phase(RecoveryState::Recovering),
            "next owned loss must remain publishable"
        );
    }
    #[test]
    fn review_running_publication_keeps_failed_cleanup_and_permanent_quit_fences() {
        for previous in [
            RecoveryState::Unavailable,
            RecoveryState::Recovering,
            RecoveryState::Failed,
            RecoveryState::Stopping,
            RecoveryState::Stopped,
            RecoveryState::CleanupFailed,
        ] {
            let phase = AtomicU8::new(previous as u8);
            assert!(!update_background_phase(
                &phase,
                &AtomicBool::new(false),
                RecoveryState::Running
            ));
            assert_eq!(phase.load(Ordering::Acquire), previous as u8);
        }
        for previous in [RecoveryState::Starting, RecoveryState::Backoff] {
            let phase = AtomicU8::new(previous as u8);
            assert!(!update_background_phase(
                &phase,
                &AtomicBool::new(true),
                RecoveryState::Running
            ));
            assert_eq!(phase.load(Ordering::Acquire), previous as u8);
        }
    }
}
