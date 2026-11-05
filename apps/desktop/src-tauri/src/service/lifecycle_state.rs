use super::authority_hub::AuthorityHub;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
pub(super) struct ShutdownGate {
    authority: Arc<AuthorityHub>,
    started: AtomicBool,
    completed: AtomicBool,
}
impl ShutdownGate {
    #[cfg(test)]
    pub(super) fn new(cancellation: Arc<AtomicBool>) -> Self {
        Self::with_authority(Arc::new(AuthorityHub::new(cancellation)))
    }
    pub(super) fn with_authority(authority: Arc<AuthorityHub>) -> Self {
        Self {
            authority,
            started: AtomicBool::new(false),
            completed: AtomicBool::new(false),
        }
    }
    pub(super) fn begin(&self) -> bool {
        if self.completed() {
            return false;
        }
        self.authority.close();
        !self.started.swap(true, Ordering::AcqRel)
    }
    pub(super) fn finish(&self, stopped: bool) -> bool {
        if stopped {
            self.completed.store(true, Ordering::Release);
        } else {
            self.started.store(false, Ordering::Release);
        }
        stopped
    }
    pub(super) fn completed(&self) -> bool {
        self.completed.load(Ordering::Acquire)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quit_cancels_startup_and_deduplicates_workers() {
        let cancel = Arc::new(AtomicBool::new(false));
        let gate = ShutdownGate::new(Arc::clone(&cancel));
        assert!(gate.begin());
        assert!(cancel.load(Ordering::Acquire));
        assert!(!gate.begin());
    }
    #[test]
    fn failed_cleanup_keeps_exit_prevented_and_permits_retry() {
        let gate = ShutdownGate::new(Arc::new(AtomicBool::new(false)));
        assert!(gate.begin());
        assert!(!gate.finish(false));
        assert!(!gate.completed());
        assert!(gate.begin());
    }
    #[test]
    fn observed_cleanup_success_allows_final_exit_only_once() {
        let gate = ShutdownGate::new(Arc::new(AtomicBool::new(false)));
        assert!(gate.begin());
        assert!(gate.finish(true));
        assert!(gate.completed());
        assert!(!gate.begin());
    }
}
