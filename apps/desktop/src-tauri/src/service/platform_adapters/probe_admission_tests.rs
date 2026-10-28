//! Deterministic regressions for the production probe admission seam.
//! No filesystem, OS token, native handle or wall-clock actor is used here.
use super::*;
use crate::service::{SpawnPermit, SupervisorError};
use std::{
    cell::Cell,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

#[derive(Default)]
struct ProbeClock(Cell<Duration>);
impl Clock for ProbeClock {
    fn now(&self) -> Duration {
        self.0.get()
    }
    fn pause(&self, elapsed: Duration) {
        self.0.set(self.now() + elapsed);
    }
}

#[test]
fn cancel_during_probe_verification_starts_no_native_create() {
    let cancellation = AtomicBool::new(false);
    let clock = ProbeClock::default();
    let permit = SpawnPermit::for_operation(&cancellation, &clock, Duration::from_secs(1)).unwrap();
    let verified = Cell::new(0);
    let creates = Cell::new(0);
    let result = admit_writable_probe(
        &permit,
        || {
            verified.set(verified.get() + 1);
            cancellation.store(true, Ordering::Release);
            Ok(())
        },
        |()| {
            creates.set(creates.get() + 1);
            Ok(true)
        },
    );
    assert_eq!(result, Err(PathFailure::Cancelled));
    assert_eq!(verified.get(), 1);
    assert_eq!(creates.get(), 0);
    assert_eq!(permit.check(), Err(SupervisorError::Cancelled));
}

#[test]
fn deadline_during_probe_verification_starts_no_native_create() {
    let cancellation = AtomicBool::new(false);
    let clock = ProbeClock::default();
    let permit = SpawnPermit::for_operation(&cancellation, &clock, Duration::from_secs(1)).unwrap();
    let verified = Cell::new(0);
    let creates = Cell::new(0);
    let result = admit_writable_probe(
        &permit,
        || {
            verified.set(verified.get() + 1);
            clock.0.set(Duration::from_secs(1));
            Ok(())
        },
        |()| {
            creates.set(creates.get() + 1);
            Ok(true)
        },
    );
    assert_eq!(result, Err(PathFailure::Timeout));
    assert_eq!(verified.get(), 1);
    assert_eq!(creates.get(), 0);
    assert_eq!(permit.check(), Err(SupervisorError::StartupTimeout));
}

#[test]
fn live_original_probe_permit_admits_one_prepared_create() {
    let cancellation = AtomicBool::new(false);
    let clock = ProbeClock::default();
    let permit = SpawnPermit::for_operation(&cancellation, &clock, Duration::from_secs(1)).unwrap();
    let verified = Cell::new(0);
    let creates = Cell::new(0);
    let result = admit_writable_probe(
        &permit,
        || {
            verified.set(verified.get() + 1);
            clock.0.set(Duration::from_millis(999));
            Ok(17)
        },
        |prepared| {
            assert_eq!(prepared, 17);
            creates.set(creates.get() + 1);
            Ok(true)
        },
    );
    assert_eq!(result, Ok(true));
    assert_eq!(verified.get(), 1);
    assert_eq!(creates.get(), 1);
    clock.0.set(Duration::from_secs(1));
    assert_eq!(permit.check(), Err(SupervisorError::StartupTimeout));
}
