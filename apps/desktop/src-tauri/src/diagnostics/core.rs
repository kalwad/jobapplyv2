//! Finite native-only request ownership. No renderer-supplied transport inputs.
use crate::api_client::client::Cancellation;
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
const ACTIVE_LIMIT: usize = 4;
const RECENT_LIMIT: usize = 64;
const RETENTION: Duration = Duration::from_secs(30);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BoundaryError {
    Forbidden,
    Malformed,
    Busy,
    Duplicate,
}
impl BoundaryError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Forbidden => "TRANSPORT_FORBIDDEN",
            Self::Malformed => "TRANSPORT_MALFORMED_MESSAGE",
            Self::Busy => "TRANSPORT_SERVICE_UNAVAILABLE",
            Self::Duplicate => "CONFLICT_DUPLICATE_IDENTITY",
        }
    }
}
pub fn authorize(label: &str, origin: &str, development: bool) -> Result<(), BoundaryError> {
    let url = url::Url::parse(origin).map_err(|_| BoundaryError::Forbidden)?;
    if label != "main"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || !matches!(url.path(), "" | "/" | "/index.html")
    {
        return Err(BoundaryError::Forbidden);
    }
    match (url.scheme(), url.host_str(), url.port()) {
        ("tauri", Some("localhost"), None) | ("http", Some("tauri.localhost"), None) => Ok(()),
        ("http", Some("127.0.0.1"), Some(1420)) if development => Ok(()),
        _ => Err(BoundaryError::Forbidden),
    }
}
pub fn valid_request_id(value: &str) -> bool {
    value.len() == 30
        && value.starts_with("req_")
        && value.as_bytes()[4..]
            .iter()
            .all(|b| b"0123456789ABCDEFGHJKMNPQRSTVWXYZ".contains(b))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    request_id: String,
}
pub fn parse_request(value: &Value) -> Result<String, BoundaryError> {
    // Validate a finite object before deserializing/allocating arbitrary inputs.
    let object = value.as_object().ok_or(BoundaryError::Malformed)?;
    if object.len() != 1 {
        return Err(BoundaryError::Malformed);
    }
    let id = object
        .get("request_id")
        .and_then(Value::as_str)
        .ok_or(BoundaryError::Malformed)?;
    if !valid_request_id(id) {
        return Err(BoundaryError::Malformed);
    }
    let request: Request =
        serde_json::from_value(value.clone()).map_err(|_| BoundaryError::Malformed)?;
    Ok(request.request_id)
}
#[derive(Clone, Copy, PartialEq)]
enum Status {
    Running,
    CancelledBeforeStart,
    Finished,
}
struct Entry {
    cancel: Cancellation,
    status: Status,
    expires: Instant,
    done: Arc<AtomicBool>,
}
#[derive(Default)]
pub struct Registry {
    entries: Mutex<HashMap<String, Entry>>,
}
pub struct Lease {
    done: Arc<AtomicBool>,
    pub cancel: Cancellation,
}
impl Registry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }
    pub fn begin(self: &Arc<Self>, id: &str) -> Result<Lease, BoundaryError> {
        if !valid_request_id(id) {
            return Err(BoundaryError::Malformed);
        }
        self.expire_at(Instant::now());
        let mut entries = self.entries.try_lock().map_err(|_| BoundaryError::Busy)?;
        if let Some(entry) = entries.get_mut(id) {
            if entry.status == Status::CancelledBeforeStart {
                entry.status = Status::Finished;
                entry.done.store(true, Ordering::SeqCst);
                return Ok(Lease {
                    done: Arc::clone(&entry.done),
                    cancel: entry.cancel.clone(),
                });
            }
            return Err(BoundaryError::Duplicate);
        }
        if entries.len() >= RECENT_LIMIT
            || entries
                .values()
                .filter(|e| e.status == Status::Running && !e.done.load(Ordering::SeqCst))
                .count()
                >= ACTIVE_LIMIT
        {
            return Err(BoundaryError::Busy);
        }
        let cancel = Cancellation::new();
        let done = Arc::new(AtomicBool::new(false));
        entries.insert(
            id.into(),
            Entry {
                cancel: cancel.clone(),
                status: Status::Running,
                expires: Instant::now() + RETENTION,
                done: Arc::clone(&done),
            },
        );
        Ok(Lease { done, cancel })
    }
    /// Commit only the live lease that owns this bounded registry entry. No wait,
    /// replacement, per-request generation revocation, or second request registry.
    fn complete(&self, id: &str, lease: &Lease) -> Result<(), BoundaryError> {
        let mut entries = self.entries.try_lock().map_err(|_| BoundaryError::Busy)?;
        let entry = entries.get_mut(id).ok_or(BoundaryError::Busy)?;
        if !Arc::ptr_eq(&entry.done, &lease.done)
            || entry.status != Status::Running
            || lease.cancel.is_cancelled()
            || entry
                .done
                .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .is_err()
        {
            return Err(BoundaryError::Busy);
        }
        entry.status = Status::Finished;
        Ok(())
    }
    #[cfg(test)]
    pub(crate) fn hold_bookkeeping_for_test(
        &self,
        held: std::sync::mpsc::Sender<()>,
        release: std::sync::mpsc::Receiver<()>,
    ) {
        let _guard = self.entries.lock().unwrap();
        held.send(()).unwrap();
        release.recv().unwrap();
    }
    pub fn cancel(&self, id: &str) -> Result<bool, BoundaryError> {
        if !valid_request_id(id) {
            return Err(BoundaryError::Malformed);
        }
        self.expire_at(Instant::now());
        let mut entries = self.entries.try_lock().map_err(|_| BoundaryError::Busy)?;
        if let Some(entry) = entries.get_mut(id) {
            if entry.status == Status::Finished || entry.done.load(Ordering::SeqCst) {
                return Ok(false);
            }
            entry.cancel.cancel();
            return Ok(true);
        }
        if entries.len() >= RECENT_LIMIT {
            return Err(BoundaryError::Busy);
        }
        let cancel = Cancellation::new();
        cancel.cancel();
        entries.insert(
            id.into(),
            Entry {
                cancel,
                status: Status::CancelledBeforeStart,
                expires: Instant::now() + RETENTION,
                done: Arc::new(AtomicBool::new(false)),
            },
        );
        Ok(true)
    }
    pub fn expire_at(&self, now: Instant) {
        if let Ok(mut entries) = self.entries.try_lock() {
            entries.retain(|_, entry| {
                if entry.expires > now {
                    return true;
                }
                if entry.status == Status::Running && !entry.done.load(Ordering::SeqCst) {
                    entry.cancel.cancel();
                    true
                } else {
                    false
                }
            });
        }
    }
    #[allow(dead_code)] // Native test inspection only; never registered as IPC.
    pub fn sizes(&self) -> (usize, usize) {
        self.entries
            .try_lock()
            .map(|e| {
                (
                    e.values()
                        .filter(|e| e.status == Status::Running && !e.done.load(Ordering::SeqCst))
                        .count(),
                    e.len(),
                )
            })
            .unwrap_or((ACTIVE_LIMIT, RECENT_LIMIT))
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
        self.cancel.cancel();
        // Ownership completion must not wait for a contended command mutex.
        self.done.store(true, Ordering::SeqCst);
    }
}
#[path = "engine.rs"]
pub mod engine;
#[cfg(test)]
mod contention_tests {
    use super::*;
    #[test]
    fn native_cancellation_returns_busy_without_waiting_for_registry_lock() {
        let registry = Registry::new();
        let lock = registry.entries.lock().unwrap();
        let worker = Arc::clone(&registry);
        let (send, receive) = std::sync::mpsc::channel();
        let (ready_send, ready_receive) = std::sync::mpsc::channel();
        let thread = std::thread::spawn(move || {
            ready_send.send(()).unwrap();
            send.send(worker.cancel("req_00000000000000000000000001"))
                .unwrap();
        });
        ready_receive.recv_timeout(Duration::from_secs(1)).unwrap();
        let response = receive.recv_timeout(Duration::from_millis(50));
        drop(lock);
        thread.join().unwrap();
        assert_eq!(response.unwrap(), Err(BoundaryError::Busy));
    }
}

#[cfg(test)]
mod recovery_publication_tests {
    use super::engine::{DiagnosticReader, Engine, ReadFuture, SessionSource, Snapshot, Versions};
    use super::*;
    use crate::api_client::client::Session;
    use std::sync::OnceLock;
    struct Source;
    impl SessionSource for Source {
        fn snapshot(&self) -> Snapshot {
            Snapshot::Running {
                session: Arc::new(
                    Session::new(&"a".repeat(64), "svc_00000000000000000000000002", 1, 12345)
                        .unwrap(),
                ),
                valid: Arc::new(AtomicBool::new(true)),
            }
        }
    }
    struct HoldAtCompletion {
        registry: OnceLock<Arc<Registry>>,
        poison: bool,
        release: Mutex<Option<std::sync::mpsc::Receiver<()>>>,
        thread: Mutex<Option<std::thread::JoinHandle<()>>>,
    }
    impl DiagnosticReader for HoldAtCompletion {
        fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
            Box::pin(async move {
                let registry = Arc::clone(self.registry.get().unwrap());
                if self.poison {
                    let _ = std::panic::catch_unwind(move || {
                        let _guard = registry.entries.lock().unwrap();
                        panic!("synthetic publication bookkeeping poison");
                    });
                } else {
                    let release = self.release.lock().unwrap().take().unwrap();
                    let (send, ready) = std::sync::mpsc::channel();
                    *self.thread.lock().unwrap() = Some(std::thread::spawn(move || {
                        let _guard = registry.entries.lock().unwrap();
                        send.send(()).unwrap();
                        release.recv().unwrap();
                    }));
                    ready.recv_timeout(Duration::from_secs(1)).unwrap();
                }
                Ok(Versions {
                    service: "0.0.1".into(),
                    api: "1.0.0".into(),
                })
            })
        }
    }
    async fn final_publication(poison: bool) {
        let (send, release) = std::sync::mpsc::channel();
        let reader = Arc::new(HoldAtCompletion {
            registry: OnceLock::new(),
            poison,
            release: Mutex::new(Some(release)),
            thread: Mutex::new(None),
        });
        let engine = Engine::new(Arc::new(Source), reader.clone()).unwrap();
        assert!(reader.registry.set(Arc::clone(&engine.registry)).is_ok());
        let response = tokio::time::timeout(
            Duration::from_millis(100),
            engine.read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":"req_00000000000000000000000001"}),
            ),
        )
        .await;
        if !poison {
            send.send(()).unwrap();
            reader
                .thread
                .lock()
                .unwrap()
                .take()
                .unwrap()
                .join()
                .unwrap();
        }
        let record = response.expect("publication waited for bookkeeping mutex");
        assert!(
            record.is_err(),
            "native READY escaped uncommitted bookkeeping: {record:?}"
        );
        assert_eq!(
            record.unwrap_err()["payload"]["code"],
            "TRANSPORT_SERVICE_UNAVAILABLE"
        );
    }
    #[tokio::test(flavor = "current_thread")]
    async fn held_registry_rejects_post_http_publication_without_waiting() {
        final_publication(false).await;
    }
    #[tokio::test(flavor = "current_thread")]
    async fn poisoned_registry_rejects_post_http_publication_without_ready() {
        final_publication(true).await;
    }
    const ID: &str = "req_00000000000000000000000001";
    #[test]
    fn shipping_registry_completion_is_one_shot_and_owned_by_exact_lease() {
        let registry = Registry::new();
        let lease = registry.begin(ID).unwrap();
        assert!(registry.complete(ID, &lease).is_ok());
        assert_eq!(registry.complete(ID, &lease), Err(BoundaryError::Busy));
        assert_eq!(registry.sizes(), (0, 1));
        assert!(!lease.cancel.is_cancelled());
        assert_eq!(registry.cancel(ID), Ok(false));
    }
    #[test]
    fn retired_lease_drop_and_cancel_cannot_touch_a_legally_reused_action_id() {
        let registry = Registry::new();
        let old = registry.begin(ID).unwrap();
        registry.complete(ID, &old).unwrap();
        let old_cancel = old.cancel.clone();
        registry.expire_at(Instant::now() + RETENTION + Duration::from_secs(1));
        let current = registry.begin(ID).unwrap();
        old_cancel.cancel();
        assert!(old.cancel.is_cancelled());
        assert!(!current.cancel.is_cancelled());
        assert_eq!(registry.complete(ID, &old), Err(BoundaryError::Busy));
        drop(old);
        assert_eq!(registry.sizes(), (1, 1));
        assert!(!current.cancel.is_cancelled());
        registry.complete(ID, &current).unwrap();
        assert_eq!(registry.sizes(), (0, 1));
    }
    #[test]
    fn contended_registry_does_not_delay_existing_action_cancel_handle_or_lease_drop() {
        let registry = Registry::new();
        let lease = registry.begin(ID).unwrap();
        let cancel = lease.cancel.clone();
        let done = Arc::clone(&lease.done);
        let guard = registry.entries.lock().unwrap();
        let (send, receive) = std::sync::mpsc::channel();
        let thread = std::thread::spawn(move || {
            cancel.cancel();
            drop(lease);
            send.send(()).unwrap();
        });
        let early = receive.recv_timeout(Duration::from_millis(100));
        assert!(done.load(Ordering::SeqCst));
        drop(guard);
        thread.join().unwrap();
        assert!(
            early.is_ok(),
            "action cancel/drop waited for registry mutex"
        );
        assert_eq!(registry.sizes(), (0, 1));
        assert!(registry.begin("req_00000000000000000000000002").is_ok());
    }
    struct NeverSource;
    impl SessionSource for NeverSource {
        fn snapshot(&self) -> Snapshot {
            panic!("registry rejection must precede native owner snapshot")
        }
    }
    struct NeverReader;
    impl DiagnosticReader for NeverReader {
        fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
            panic!("registry rejection must precede transport")
        }
    }
    #[tokio::test(flavor = "current_thread")]
    async fn held_shipping_registry_fails_new_engine_dispatch_before_owner_or_reader_access() {
        let engine = Engine::new(Arc::new(NeverSource), Arc::new(NeverReader)).unwrap();
        let (held, ready) = std::sync::mpsc::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let registry = Arc::clone(&engine.registry);
        let thread = std::thread::spawn(move || registry.hold_bookkeeping_for_test(held, wait));
        ready.recv_timeout(Duration::from_secs(1)).unwrap();
        let body = serde_json::json!({"request_id":ID});
        let response = tokio::time::timeout(
            Duration::from_millis(100),
            engine.read("main", "tauri://localhost", false, &body),
        )
        .await;
        release.send(()).unwrap();
        thread.join().unwrap();
        assert_eq!(
            response.unwrap().unwrap_err()["payload"]["code"],
            "TRANSPORT_SERVICE_UNAVAILABLE"
        );
    }
    #[tokio::test(flavor = "current_thread")]
    async fn renderer_cannot_supply_zero_or_oversized_request_budget_or_retain_action() {
        let engine = Engine::new(Arc::new(NeverSource), Arc::new(NeverReader)).unwrap();
        for total in [0, 10001] {
            let result = engine
                .read(
                    "main",
                    "tauri://localhost",
                    false,
                    &serde_json::json!({"request_id":ID,"total_budget_ms":total}),
                )
                .await
                .unwrap_err();
            assert_eq!(result["payload"]["code"], "TRANSPORT_MALFORMED_MESSAGE");
            assert_eq!(engine.registry.sizes(), (0, 0));
        }
    }
    struct HoldBeyondDeadline {
        registry: OnceLock<Arc<Registry>>,
        release: Mutex<Option<std::sync::mpsc::Receiver<()>>>,
        thread: Mutex<Option<std::thread::JoinHandle<()>>>,
    }
    impl DiagnosticReader for HoldBeyondDeadline {
        fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
            Box::pin(async move {
                let registry = Arc::clone(self.registry.get().unwrap());
                let release = self.release.lock().unwrap().take().unwrap();
                let (send, ready) = std::sync::mpsc::channel();
                *self.thread.lock().unwrap() = Some(std::thread::spawn(move || {
                    registry.hold_bookkeeping_for_test(send, release)
                }));
                ready.recv_timeout(Duration::from_secs(1)).unwrap();
                tokio::time::sleep(Duration::from_secs(20)).await;
                panic!("deadline must discard work before late completion")
            })
        }
    }
    #[tokio::test(flavor = "current_thread")]
    async fn expired_engine_deadline_never_waits_for_publication_bookkeeping() {
        let (send, release) = std::sync::mpsc::channel();
        let reader = Arc::new(HoldBeyondDeadline {
            registry: OnceLock::new(),
            release: Mutex::new(Some(release)),
            thread: Mutex::new(None),
        });
        let engine = Engine::new(Arc::new(Source), reader.clone()).unwrap();
        assert!(reader.registry.set(Arc::clone(&engine.registry)).is_ok());
        let started = Instant::now();
        let result = engine
            .read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":ID}),
            )
            .await;
        let elapsed = started.elapsed();
        send.send(()).unwrap();
        reader
            .thread
            .lock()
            .unwrap()
            .take()
            .unwrap()
            .join()
            .unwrap();
        assert_eq!(result.unwrap_err()["payload"]["code"], "TRANSPORT_TIMEOUT");
        assert!(elapsed < Duration::from_secs(5));
        assert_eq!(engine.registry.sizes().0, 0);
    }
}
