//! Native lifecycle wiring. No renderer command, credential or runtime path is exposed.
use super::{
    ConfiguredRuntime, MonotonicClock, Policy, ServiceState, Supervisor, SupervisorError,
    lifecycle_state::ShutdownGate,
};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU8, Ordering},
};
use tauri::{AppHandle, ExitRequestApi, Manager};
type NativeSupervisor = Supervisor<ConfiguredRuntime, MonotonicClock>;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub(crate) enum LifecycleDiagnostic {
    Unavailable = 0,
    Starting = 1,
    Running = 2,
    Stopping = 3,
    Stopped = 4,
    Failed = 5,
    CleanupFailed = 6,
}
impl LifecycleDiagnostic {
    fn title(self) -> &'static str {
        match self {
            Self::Unavailable => "Desktop App — Local service unavailable",
            Self::Starting => "Desktop App — Starting local service",
            Self::Running => "Desktop App",
            Self::Stopping => "Desktop App — Stopping local service",
            Self::Stopped => "Desktop App — Local service stopped",
            Self::Failed => "Desktop App — Local service failed",
            Self::CleanupFailed => "Desktop App — Could not stop local service; retry Quit",
        }
    }
}
fn update_background_phase(
    current: &AtomicU8,
    cancelled: &AtomicBool,
    next: LifecycleDiagnostic,
) -> bool {
    if cancelled.load(Ordering::Acquire) {
        return false;
    }
    let previous = current.load(Ordering::Acquire);
    let allowed = match next {
        LifecycleDiagnostic::Starting => previous == LifecycleDiagnostic::Unavailable as u8,
        LifecycleDiagnostic::Running | LifecycleDiagnostic::Unavailable => {
            previous == LifecycleDiagnostic::Starting as u8
        }
        LifecycleDiagnostic::Failed => [
            LifecycleDiagnostic::Unavailable as u8,
            LifecycleDiagnostic::Starting as u8,
            LifecycleDiagnostic::Running as u8,
            LifecycleDiagnostic::Failed as u8,
        ]
        .contains(&previous),
        LifecycleDiagnostic::CleanupFailed => [
            LifecycleDiagnostic::Starting as u8,
            LifecycleDiagnostic::Running as u8,
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
    gate: Arc<ShutdownGate>,
    authority: Arc<super::authority_hub::AuthorityHub>,
    diagnostic: Arc<AtomicU8>,
}
impl ManagedService {
    pub fn new(runtime: ConfiguredRuntime) -> Result<Self, SupervisorError> {
        let supervisor = Supervisor::new(runtime, MonotonicClock::default(), Policy::default())?;
        let cancellation = supervisor.cancellation_handle();
        let authority = supervisor.authority_handle();
        let gate = Arc::new(ShutdownGate::with_authority(Arc::clone(&authority)));
        Ok(Self {
            supervisor: Arc::new(Mutex::new(supervisor)),
            cancellation,
            gate,
            authority,
            diagnostic: Arc::new(AtomicU8::new(LifecycleDiagnostic::Unavailable as u8)),
        })
    }
    pub(crate) fn diagnostic(&self) -> LifecycleDiagnostic {
        match self.diagnostic.load(Ordering::Acquire) {
            1 => LifecycleDiagnostic::Starting,
            2 => LifecycleDiagnostic::Running,
            3 => LifecycleDiagnostic::Stopping,
            4 => LifecycleDiagnostic::Stopped,
            5 => LifecycleDiagnostic::Failed,
            6 => LifecycleDiagnostic::CleanupFailed,
            _ => LifecycleDiagnostic::Unavailable,
        }
    }
    fn refresh_title(&self, app: &AppHandle) {
        let managed = self.clone();
        let app = app.clone();
        let dispatcher = app.clone();
        // Read the latest phase on the UI thread; a delayed startup title cannot
        // overwrite a later shutdown failure after the worker was descheduled.
        let _ = dispatcher.run_on_main_thread(move || {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(managed.diagnostic().title());
            }
        });
    }
    fn publish(&self, app: &AppHandle, state: LifecycleDiagnostic) {
        self.diagnostic.store(state as u8, Ordering::Release);
        self.refresh_title(app);
    }
    fn publish_background(&self, app: &AppHandle, state: LifecycleDiagnostic) {
        if update_background_phase(&self.diagnostic, &self.cancellation, state) {
            self.refresh_title(app);
        }
    }
    pub fn start_background(&self, app: &AppHandle) -> std::io::Result<()> {
        let managed = self.clone();
        let app = app.clone();
        self.publish_background(&app, LifecycleDiagnostic::Starting);
        let error_app = app.clone();
        let result = std::thread::Builder::new()
            .name("japp-service-start".into())
            .spawn(move || {
                let mut supervisor = match managed.supervisor.lock() {
                    Ok(supervisor) => supervisor,
                    Err(poisoned) => {
                        let mut supervisor = poisoned.into_inner();
                        supervisor.invalidate_poisoned_authority();
                        let cleaned = supervisor.shutdown().is_ok();
                        drop(supervisor);
                        managed.publish_background(
                            &app,
                            if cleaned {
                                LifecycleDiagnostic::Failed
                            } else {
                                LifecycleDiagnostic::CleanupFailed
                            },
                        );
                        return;
                    }
                };
                if let Err(error) = supervisor.start() {
                    drop(supervisor);
                    managed.publish_background(
                        &app,
                        if error == SupervisorError::RuntimeUnavailable {
                            LifecycleDiagnostic::Unavailable
                        } else {
                            LifecycleDiagnostic::Failed
                        },
                    );
                    return;
                }
                drop(supervisor);
                managed.publish_background(&app, LifecycleDiagnostic::Running);
                while !managed.cancellation.load(Ordering::Acquire) {
                    let mut supervisor = match managed.supervisor.lock() {
                        Ok(supervisor) => supervisor,
                        Err(poisoned) => {
                            let mut supervisor = poisoned.into_inner();
                            supervisor.invalidate_poisoned_authority();
                            let cleaned = supervisor.shutdown().is_ok();
                            drop(supervisor);
                            managed.publish_background(
                                &app,
                                if cleaned {
                                    LifecycleDiagnostic::Failed
                                } else {
                                    LifecycleDiagnostic::CleanupFailed
                                },
                            );
                            return;
                        }
                    };
                    if !matches!(supervisor.observe(), Ok(ServiceState::Running)) {
                        let _originating_failure = supervisor.failure_cause();
                        let cleaned = supervisor.shutdown().is_ok();
                        drop(supervisor);
                        managed.publish_background(
                            &app,
                            if cleaned {
                                LifecycleDiagnostic::Failed
                            } else {
                                LifecycleDiagnostic::CleanupFailed
                            },
                        );
                        return;
                    }
                    drop(supervisor);
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            });
        match result {
            Ok(_) => Ok(()),
            Err(error) => {
                self.publish_background(&error_app, LifecycleDiagnostic::Failed);
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
        if self.allow_exit() {
            return;
        }
        api.prevent_exit();
        self.request_shutdown(app);
    }
    pub fn request_shutdown(&self, app: &AppHandle) {
        if !self.gate.begin() {
            return;
        }
        self.publish(app, LifecycleDiagnostic::Stopping);
        let managed = self.clone();
        let app = app.clone();
        let error_app = app.clone();
        let shutdown = std::thread::Builder::new()
            .name("japp-service-stop".into())
            .spawn(move || {
                let stopped = match managed.supervisor.lock() {
                    Ok(mut supervisor) => supervisor.shutdown().is_ok(),
                    Err(poisoned) => {
                        let mut supervisor = poisoned.into_inner();
                        supervisor.invalidate_poisoned_authority();
                        supervisor.shutdown().is_ok()
                    }
                };
                if stopped {
                    managed.gate.finish(true);
                    managed.publish(&app, LifecycleDiagnostic::Stopped);
                    app.exit(0);
                } else {
                    managed.publish(&app, LifecycleDiagnostic::CleanupFailed);
                    managed.gate.finish(false);
                }
            });
        if shutdown.is_err() {
            self.publish(&error_app, LifecycleDiagnostic::CleanupFailed);
            self.gate.finish(false);
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
