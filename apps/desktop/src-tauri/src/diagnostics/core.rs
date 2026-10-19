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
