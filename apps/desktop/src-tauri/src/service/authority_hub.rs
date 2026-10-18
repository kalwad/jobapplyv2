use arc_swap::ArcSwapOption;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

/// One app-lifetime native publication fence. It stores no credential or identity.
/// Only the serialized supervisor owner publishes; Quit reads/revokes without its mutex.
pub(super) struct AuthorityHub {
    cancellation: Arc<AtomicBool>,
    current: ArcSwapOption<AtomicBool>,
}
impl AuthorityHub {
    pub(super) fn new(cancellation: Arc<AtomicBool>) -> Self {
        Self {
            cancellation,
            current: ArcSwapOption::empty(),
        }
    }
    pub(super) fn cancellation_handle(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancellation)
    }
    pub(super) fn close(&self) {
        self.cancellation.store(true, Ordering::Release);
        if let Some(current) = self.current.load_full() {
            current.store(false, Ordering::Release);
        }
    }
    pub(super) fn publish(&self) -> Arc<AtomicBool> {
        self.publish_with_hook(|| {})
    }
    fn publish_with_hook(&self, before_swap: impl FnOnce()) -> Arc<AtomicBool> {
        let valid = Arc::new(AtomicBool::new(false));
        if self.cancellation.load(Ordering::Acquire) {
            return valid;
        }
        valid.store(true, Ordering::Release);
        before_swap();
        if let Some(previous) = self.current.swap(Some(Arc::clone(&valid))) {
            previous.store(false, Ordering::Release);
        }
        // Quit may have closed the old slot just before this new slot was published.
        // The serialized owner cannot issue a lease until this fence has completed.
        if self.cancellation.load(Ordering::Acquire) {
            valid.store(false, Ordering::Release);
        }
        valid
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn close_during_publication_cannot_leave_late_authority_valid() {
        let hub = AuthorityHub::new(Arc::new(AtomicBool::new(false)));
        let valid = hub.publish_with_hook(|| hub.close());
        assert!(!valid.load(Ordering::Acquire));
    }
    #[test]
    fn closed_hub_never_reopens_on_a_later_generation() {
        let hub = AuthorityHub::new(Arc::new(AtomicBool::new(false)));
        let first = hub.publish();
        hub.close();
        let later = hub.publish();
        assert!(!first.load(Ordering::Acquire));
        assert!(!later.load(Ordering::Acquire));
        assert!(!Arc::ptr_eq(&first, &later));
    }
}
