//! Test fixtures share the real process-lifetime allocator but model one app owner.
//! The lease is acquired before returning a fixture or starting its work budget.
//! No allocator state is reset and no production permit, retry or mutex is added.
use std::{
    cell::RefCell,
    rc::{Rc, Weak},
    sync::{Mutex, MutexGuard, TryLockError},
};

static GATE: Mutex<()> = Mutex::new(());
struct HeldGate {
    _guard: MutexGuard<'static, ()>,
}
thread_local! {
    static CURRENT: RefCell<Weak<HeldGate>> = const { RefCell::new(Weak::new()) };
    static AFTER_LOAD: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
}
/// Rc makes the lease thread-bound; nested owners share it until the last drop.
pub(super) struct FixtureLease {
    _held: Rc<HeldGate>,
}
pub(super) fn acquire() -> FixtureLease {
    acquire_observed(|| {})
}
fn acquire_observed(before_wait: impl FnOnce()) -> FixtureLease {
    CURRENT.with(|current| {
        if let Some(held) = current.borrow().upgrade() {
            return FixtureLease { _held: held };
        }
        let guard = match GATE.try_lock() {
            Ok(guard) => guard,
            // Poison belongs only to fixture coordination; production ownership
            // and the global ID never roll back or become reusable after unwind.
            Err(TryLockError::Poisoned(error)) => error.into_inner(),
            Err(TryLockError::WouldBlock) => {
                before_wait();
                GATE.lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
            }
        };
        let held = Rc::new(HeldGate { _guard: guard });
        *current.borrow_mut() = Rc::downgrade(&held);
        FixtureLease { _held: held }
    })
}
pub(super) fn held_by_this_thread() -> bool {
    CURRENT.with(|current| current.borrow().strong_count() != 0)
}
pub(super) fn busy_on_other_thread() -> bool {
    std::thread::spawn(|| matches!(GATE.try_lock(), Err(TryLockError::WouldBlock)))
        .join()
        .unwrap()
}

struct ScopedHook;
impl Drop for ScopedHook {
    fn drop(&mut self) {
        AFTER_LOAD.with(|slot| {
            slot.borrow_mut().take();
        });
    }
}
pub(super) fn with_after_load<R>(
    hook: impl FnOnce() + 'static,
    operation: impl FnOnce() -> R,
) -> R {
    AFTER_LOAD.with(|slot| {
        let mut slot = slot.borrow_mut();
        assert!(
            slot.is_none(),
            "a reservation hook is already scoped on this thread"
        );
        *slot = Some(Box::new(hook));
    });
    let _scoped = ScopedHook;
    operation()
}
/// Consumed before callback entry, so a nested real resolution cannot recurse.
pub(super) fn after_handle_load() {
    let hook = AFTER_LOAD.with(|slot| slot.borrow_mut().take());
    if let Some(hook) = hook {
        hook();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::mpsc, time::Duration};

    #[test]
    fn shared_gate_reenters_and_holds_until_the_last_fixture_lease_drops() {
        let outer = acquire();
        let inner = acquire();
        let same_lease = Rc::ptr_eq(&outer._held, &inner._held);
        let (waiting, waited) = mpsc::channel();
        let (entered, acquired) = mpsc::channel();
        let worker = std::thread::spawn(move || {
            let _lease = acquire_observed(|| waiting.send(()).unwrap());
            entered.send(()).unwrap();
        });
        let observed_wait = waited.recv_timeout(Duration::from_secs(3));
        drop(outer);
        let still_held = matches!(GATE.try_lock(), Err(TryLockError::WouldBlock));
        let early_entry = acquired.try_recv();
        drop(inner);
        let final_entry = acquired.recv_timeout(Duration::from_secs(3));
        let joined = worker.join();
        assert!(same_lease);
        assert!(observed_wait.is_ok());
        assert!(still_held);
        assert!(matches!(early_entry, Err(mpsc::TryRecvError::Empty)));
        assert!(final_entry.is_ok());
        assert!(joined.is_ok());
        assert!(!held_by_this_thread());
    }

    #[test]
    fn unwind_releases_and_only_the_fixture_gate_poison_is_recovered() {
        let result = std::panic::catch_unwind(|| {
            let _lease = acquire();
            panic!("modeled fixture unwind");
        });
        let was_released = !held_by_this_thread();
        let lease = acquire();
        let recovered = held_by_this_thread();
        let poisoned = GATE.is_poisoned();
        drop(lease);
        assert!(result.is_err());
        assert!(was_released);
        assert!(recovered);
        assert!(poisoned);
        assert!(!held_by_this_thread());
    }
}
