//! An app-lifetime thread slot. Expiry never releases an in-flight native job.
use super::platform_adapters::PathFailure;
use std::{
    sync::{
        Mutex, TryLockError,
        atomic::{AtomicBool, Ordering},
    },
    thread::JoinHandle,
};
#[derive(Default)]
pub(super) struct OwnedWorker {
    handle: Mutex<Option<JoinHandle<()>>>,
    claimed: AtomicBool,
}
impl OwnedWorker {
    pub(super) fn busy(&self) -> bool {
        let slot = match self.handle.try_lock() {
            Ok(slot) => slot,
            Err(TryLockError::Poisoned(error)) => error.into_inner(),
            // A claim/spawn owns the slot: never wait for thread creation.
            Err(TryLockError::WouldBlock) => return true,
        };
        match slot.as_ref() {
            Some(handle) if handle.is_finished() => {
                self.claimed.store(false, Ordering::Release);
                false
            }
            Some(_) => true,
            None => self.claimed.load(Ordering::Acquire),
        }
    }
    pub(super) fn spawn(
        &self,
        name: &str,
        job: impl FnOnce() + Send + 'static,
    ) -> Result<(), PathFailure> {
        self.spawn_with(name, job)
    }
    pub(super) fn spawn_with(
        &self,
        name: &str,
        job: impl FnOnce() + Send + 'static,
    ) -> Result<(), PathFailure> {
        self.spawn_guarded(name, || Ok(()), job)
    }
    pub(super) fn spawn_guarded(
        &self,
        name: &str,
        check: impl Fn() -> Result<(), PathFailure>,
        job: impl FnOnce() + Send + 'static,
    ) -> Result<(), PathFailure> {
        self.spawn_inner(name, check, job, || {})
    }
    fn spawn_inner(
        &self,
        name: &str,
        check: impl Fn() -> Result<(), PathFailure>,
        job: impl FnOnce() + Send + 'static,
        before_create: impl FnOnce(),
    ) -> Result<(), PathFailure> {
        let mut slot = match self.handle.try_lock() {
            Ok(slot) => slot,
            Err(TryLockError::WouldBlock) => return Err(PathFailure::Busy),
            Err(TryLockError::Poisoned(error)) => error.into_inner(),
        };
        if slot.as_ref().is_some_and(|h| !h.is_finished()) {
            return Err(PathFailure::Busy);
        }
        // Only an actually finished handle permits a new claim. No UI join.
        *slot = None;
        self.claimed.store(false, Ordering::Release);
        check()?;
        self.claimed.store(true, Ordering::Release);
        before_create();
        // A public claim may have passed its first check before Quit. Recheck
        // under the same slot before starting even its initializer worker.
        if let Err(error) = check() {
            self.claimed.store(false, Ordering::Release);
            return Err(error);
        }
        let (start, ready) = std::sync::mpsc::sync_channel(1);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            std::thread::Builder::new()
                .name(name.into())
                .spawn(move || {
                    if ready.recv().is_ok() {
                        job()
                    }
                })
        }));
        let handle = match result {
            Ok(Ok(handle)) => handle,
            _ => {
                self.claimed.store(false, Ordering::Release);
                return Err(PathFailure::Interrupted);
            }
        };
        *slot = Some(handle);
        let _ = start.send(());
        Ok(())
    }
    #[cfg(test)]
    pub(super) fn while_locked_for_test<R>(&self, body: impl FnOnce() -> R) -> R {
        let _slot = self.handle.lock().unwrap();
        body()
    }
    #[cfg(test)]
    pub(super) fn spawn_barrier_for_test(
        &self,
        name: &str,
        check: impl Fn() -> Result<(), PathFailure>,
        job: impl FnOnce() + Send + 'static,
        before_create: impl FnOnce(),
    ) -> Result<(), PathFailure> {
        self.spawn_inner(name, check, job, before_create)
    }
    #[cfg(test)]
    pub(super) fn wait_for_test(&self) {
        let end = std::time::Instant::now() + std::time::Duration::from_secs(3);
        while self.busy() {
            assert!(
                std::time::Instant::now() < end,
                "mock worker did not finish"
            );
            std::thread::yield_now();
        }
    }
}
