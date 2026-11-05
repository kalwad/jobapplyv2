use arc_swap::ArcSwapOption;
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, Ordering},
};

/// One app-lifetime native publication fence. It stores no credential or identity.
/// Only the serialized supervisor owner publishes; Quit reads/revokes without its mutex.
pub(super) struct AuthorityHub {
    cancellation: Arc<AtomicBool>,
    current: ArcSwapOption<AtomicBool>,
    epoch: AtomicU64,
}
impl AuthorityHub {
    pub(super) fn new(cancellation: Arc<AtomicBool>) -> Self {
        Self {
            cancellation,
            current: ArcSwapOption::empty(),
            epoch: AtomicU64::new(0),
        }
    }
    pub(super) fn cancellation_handle(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancellation)
    }
    pub(super) fn current_epoch(&self) -> u64 {
        self.epoch.load(Ordering::Acquire)
    }
    fn advance_epoch(&self) -> Option<u64> {
        match self
            .epoch
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |epoch| {
                epoch.checked_add(1)
            }) {
            Ok(previous) => Some(previous + 1),
            Err(_) => {
                self.cancellation.store(true, Ordering::Release);
                if let Some(current) = self.current.load_full() {
                    current.store(false, Ordering::Release);
                }
                None
            }
        }
    }
    /// The serialized owner withdraws a generation without reopening Permanent Quit.
    pub(super) fn withdraw_current(&self) {
        self.withdraw_current_with_hook(|| {});
    }
    fn withdraw_current_with_hook(&self, after_remove: impl FnOnce()) {
        // The same serialized owner alone publishes/withdraws generations. Keep
        // its Quit-reachable handle in the slot until immediate flag invalidation
        // is visible; concurrent close can never observe an empty slot plus a
        // still-valid issued flag, even if this owner is then descheduled.
        if let Some(current) = self.current.load_full() {
            current.store(false, Ordering::Release);
            self.current.store(None);
            after_remove();
            let _ = self.advance_epoch();
        }
    }
    pub(super) fn close(&self) {
        self.cancellation.store(true, Ordering::Release);
        let _ = self.advance_epoch();
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
        if self.advance_epoch().is_none() {
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
    fn bridge_epoch_is_distinct_for_each_native_publication_and_quit() {
        let hub = AuthorityHub::new(Arc::new(AtomicBool::new(false)));
        assert_eq!(hub.current_epoch(), 0);
        let first = hub.publish();
        let first_epoch = hub.current_epoch();
        assert!(first_epoch > 0);
        let second = hub.publish();
        assert!(hub.current_epoch() > first_epoch);
        assert!(!first.load(Ordering::Acquire));
        let running_epoch = hub.current_epoch();
        hub.close();
        assert!(hub.current_epoch() > running_epoch);
        assert!(!second.load(Ordering::Acquire));
    }
    #[test]
    fn bridge_exhausted_epoch_cannot_wrap_or_publish_authority() {
        let hub = AuthorityHub::new(Arc::new(AtomicBool::new(false)));
        hub.epoch.store(u64::MAX, Ordering::Release);
        let valid = hub.publish();
        assert!(!valid.load(Ordering::Acquire));
        assert_eq!(hub.current_epoch(), u64::MAX);
        assert!(hub.cancellation.load(Ordering::Acquire));
    }
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
    #[test]
    fn recovery_withdrawal_epoch_exhaustion_closes_instead_of_wrapping_authority() {
        let hub = AuthorityHub::new(Arc::new(AtomicBool::new(false)));
        let issued = hub.publish();
        hub.epoch.store(u64::MAX, Ordering::Release);
        hub.withdraw_current();
        assert!(!issued.load(Ordering::Acquire));
        assert_eq!(hub.current_epoch(), u64::MAX);
        assert!(hub.cancellation_handle().load(Ordering::Acquire));
        assert!(!hub.publish().load(Ordering::Acquire));
    }
    #[test]
    fn review_quit_during_withdrawal_never_returns_with_an_issued_flag_still_valid() {
        let hub = AuthorityHub::new(Arc::new(AtomicBool::new(false)));
        let issued = hub.publish();
        let issued_epoch = hub.current_epoch();
        assert!(issued.load(Ordering::Acquire));
        let revoked_at_accepted_quit_return = AtomicBool::new(false);
        hub.withdraw_current_with_hook(|| {
            assert!(
                hub.current.load_full().is_none(),
                "hook must follow removal in the actual production helper"
            );
            hub.close();
            assert!(hub.cancellation_handle().load(Ordering::Acquire));
            revoked_at_accepted_quit_return
                .store(!issued.load(Ordering::Acquire), Ordering::Release);
        });
        assert!(
            revoked_at_accepted_quit_return.load(Ordering::Acquire),
            "accepted Quit returned while the issued native flag was true"
        );
        assert!(!issued.load(Ordering::Acquire));
        assert!(hub.current_epoch() > issued_epoch);
        assert!(!hub.publish().load(Ordering::Acquire));
    }
}
