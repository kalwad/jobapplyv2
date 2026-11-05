//! One bounded Quit decision for the two app-owned native lifetimes.
use super::{Clock, lifecycle_state::ShutdownGate, owned_worker::OwnedWorker};
use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU8, Ordering},
    },
    time::Duration,
};
// New common app Quit policy. Recovery retains its separate reviewed reserve.
pub(super) const APP_QUIT_CAP: Duration = Duration::from_millis(6050);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Decision {
    Pending,
    Fail,
    Finish,
}
pub(super) struct QuitAttempt {
    pub(super) deadline: Duration,
    service: AtomicU8,
    paths: AtomicU8,
    published: AtomicBool,
    failed: AtomicBool,
}
impl QuitAttempt {
    pub(super) fn service(&self, ok: bool) {
        self.service
            .store(if ok { 1 } else { 2 }, Ordering::Release)
    }
    pub(super) fn paths(&self, ok: bool) {
        self.paths.store(if ok { 1 } else { 2 }, Ordering::Release)
    }
}
pub(super) trait QuitSink: Send + Sync {
    fn finished(&self);
    fn failed(&self);
}
pub(super) struct QuitCoordinator {
    clock: Arc<dyn Clock + Send + Sync>,
    pub(super) gate: Arc<ShutdownGate>,
    current: Mutex<Option<Arc<QuitAttempt>>>,
    pub(super) worker: OwnedWorker,
}
impl QuitCoordinator {
    pub(super) fn new(clock: Arc<dyn Clock + Send + Sync>, gate: Arc<ShutdownGate>) -> Self {
        Self {
            clock,
            gate,
            current: Mutex::new(None),
            worker: OwnedWorker::default(),
        }
    }
    #[cfg(test)]
    pub(super) fn begin(&self, owners_busy: bool) -> Option<Arc<QuitAttempt>> {
        self.begin_checked(|| owners_busy)
    }
    pub(super) fn begin_checked(
        &self,
        owners_busy: impl FnOnce() -> bool,
    ) -> Option<Arc<QuitAttempt>> {
        if !self.gate.begin() {
            return None;
        }
        if owners_busy() || self.worker.busy() {
            self.gate.finish(false);
            return None;
        }
        let Some(deadline) = self.clock.now().checked_add(APP_QUIT_CAP) else {
            self.gate.finish(false);
            return None;
        };
        let attempt = Arc::new(QuitAttempt {
            deadline,
            service: AtomicU8::new(0),
            paths: AtomicU8::new(0),
            published: AtomicBool::new(false),
            failed: AtomicBool::new(false),
        });
        *self
            .current
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(attempt.clone());
        Some(attempt)
    }
    pub(super) fn current_is(&self, a: &Arc<QuitAttempt>) -> bool {
        self.current
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(a, current))
    }
    pub(super) fn fail(&self, a: &Arc<QuitAttempt>, sink: &impl QuitSink) {
        a.failed.store(true, Ordering::Release);
        if self.current_is(a) && !a.published.swap(true, Ordering::AcqRel) {
            self.gate.finish(false);
            sink.failed();
        }
    }
    pub(super) fn observe(
        &self,
        a: &Arc<QuitAttempt>,
        service_busy: bool,
        paths_busy: bool,
        sink: &impl QuitSink,
    ) -> Decision {
        if !self.current_is(a) || a.failed.load(Ordering::Acquire) {
            return Decision::Fail;
        }
        let service = a.service.load(Ordering::Acquire);
        let paths = a.paths.load(Ordering::Acquire);
        if self.clock.now() >= a.deadline || service == 2 || paths == 2 {
            self.fail(a, sink);
            return Decision::Fail;
        }
        if service == 1 && paths == 1 && !service_busy && !paths_busy {
            if !a.published.swap(true, Ordering::AcqRel) {
                self.gate.finish(true);
                sink.finished();
            }
            Decision::Finish
        } else {
            Decision::Pending
        }
    }
}
#[cfg(test)]
#[path = "quit_tests.rs"]
mod tests;
