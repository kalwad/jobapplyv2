use crate::diagnostics::core::{Registry, authorize, parse_request};
use serde_json::json;
use std::time::{Duration, Instant};
const REQUEST: &str = "req_00000000000000000000000001";
#[test]
fn only_local_main_entry_can_invoke_finite_commands() {
    for url in [
        "tauri://localhost/index.html#diagnostics",
        "http://tauri.localhost/index.html",
    ] {
        assert!(authorize("main", url, false).is_ok());
        assert!(authorize("secondary", url, false).is_err());
    }
    for url in [
        "https://tauri.localhost/index.html",
        "tauri://localhost/index.html?private=1",
        "http://127.0.0.1:1420/",
        "file:///private/index.html",
        "tauri://localhost/other.html",
    ] {
        assert!(authorize("main", url, false).is_err(), "{url}");
    }
    assert!(authorize("main", "http://127.0.0.1:1420/", true).is_ok());
}
#[test]
fn raw_ipc_payload_is_closed_and_bounded() {
    assert_eq!(
        parse_request(&json!({"request_id":REQUEST})).unwrap(),
        REQUEST
    );
    for value in [
        json!(null),
        json!({}),
        json!({"request_id":"x"}),
        json!({"request_id":REQUEST,"url":"http://127.0.0.1:1"}),
        json!({"request_id":REQUEST,"token":"private"}),
        json!({"request_id":"x".repeat(10000)}),
    ] {
        assert!(parse_request(&value).is_err());
    }
}
#[test]
fn cancellation_before_registration_is_not_lost_or_reused() {
    let registry = Registry::new();
    assert!(registry.cancel(REQUEST).unwrap());
    assert!(registry.begin(REQUEST).unwrap().cancel.is_cancelled());
    assert!(registry.begin(REQUEST).is_err());
}
#[test]
fn registry_bounds_active_work_and_recent_ids_without_eviction() {
    let registry = Registry::new();
    let leases: Vec<_> = (0..4)
        .map(|i| registry.begin(&format!("req_{i:026}")).unwrap())
        .collect();
    assert!(registry.begin("req_00000000000000000000000009").is_err());
    drop(leases);
    for i in 4..64 {
        assert!(registry.cancel(&format!("req_{i:026}")).is_ok());
    }
    assert!(registry.cancel("req_00000000000000000000000099").is_err());
    assert!(registry.begin("req_00000000000000000000000000").is_err());
    assert_eq!(registry.sizes(), (0, 64));
}
#[test]
fn dropped_owner_cancels_work_and_releases_active_capacity() {
    let registry = Registry::new();
    let lease = registry.begin(REQUEST).unwrap();
    let signal = lease.cancel.clone();
    assert_eq!(registry.sizes(), (1, 1));
    drop(lease);
    assert!(signal.is_cancelled());
    assert_eq!(registry.sizes(), (0, 1));
}
#[test]
fn completed_and_expired_ids_have_bounded_retention() {
    let registry = Registry::new();
    drop(registry.begin(REQUEST).unwrap());
    assert!(!registry.cancel(REQUEST).unwrap());
    registry.expire_at(Instant::now() + Duration::from_secs(31));
    assert_eq!(registry.sizes(), (0, 0));
}
#[test]
fn pre_cancelled_request_never_consumes_a_fifth_active_slot() {
    let registry = Registry::new();
    let _leases: Vec<_> = (0..4)
        .map(|i| registry.begin(&format!("req_{i:026}")).unwrap())
        .collect();
    let other = "req_00000000000000000000000009";
    registry.cancel(other).unwrap();
    let lease = registry.begin(other).unwrap();
    assert!(lease.cancel.is_cancelled());
    assert_eq!(registry.sizes(), (4, 5));
}
