use crate::api_client::{
    Failure,
    client::{Cancellation, Session},
};
use crate::diagnostics::core::{
    Registry,
    engine::{DiagnosticReader, Engine, ReadFuture, SessionSource, Snapshot, Versions},
};
use serde_json::Value;
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    time::Duration,
};
const ID: &str = "req_00000000000000000000000001";
struct Source {
    flag: Arc<AtomicBool>,
    calls: AtomicUsize,
}
impl SessionSource for Source {
    fn snapshot(&self) -> Snapshot {
        self.calls.fetch_add(1, Ordering::SeqCst);
        Snapshot::Running {
            session: Arc::new(
                Session::new(&"a".repeat(64), "svc_00000000000000000000000002", 7, 12345).unwrap(),
            ),
            valid: Arc::clone(&self.flag),
        }
    }
}
struct Slow {
    entered: Arc<AtomicBool>,
    finished: Arc<AtomicBool>,
}
impl DiagnosticReader for Slow {
    fn read<'a>(
        &'a self,
        _session: Arc<Session>,
        _cancel: Cancellation,
        _correlation: &'a str,
    ) -> ReadFuture<'a> {
        Box::pin(async move {
            self.entered.store(true, Ordering::SeqCst);
            tokio::time::sleep(Duration::from_secs(20)).await;
            self.finished.store(true, Ordering::SeqCst);
            Ok(Versions {
                service: "0.0.1".into(),
                api: "1.0.0".into(),
            })
        })
    }
}
fn setup() -> (Engine, Arc<Source>, Arc<Slow>) {
    let source = Arc::new(Source {
        flag: Arc::new(AtomicBool::new(true)),
        calls: AtomicUsize::new(0),
    });
    let reader = Arc::new(Slow {
        entered: Arc::new(AtomicBool::new(false)),
        finished: Arc::new(AtomicBool::new(false)),
    });
    (
        Engine::new(source.clone(), reader.clone()).unwrap(),
        source,
        reader,
    )
}
#[tokio::test(flavor = "current_thread")]
async fn native_cancel_interrupts_actual_pending_work_and_discards_completion() {
    let (engine, _, reader) = setup();
    let body = serde_json::json!({"request_id":ID});
    let read = engine.read("main", "tauri://localhost/index.html", false, &body);
    tokio::pin!(read);
    tokio::select! {result=&mut read=>panic!("early {result:?}"),_=async{while !reader.entered.load(Ordering::SeqCst){tokio::task::yield_now().await;}}=>{}}
    engine
        .cancel(
            "main",
            "tauri://localhost/index.html",
            false,
            &serde_json::json!({"request_id":ID}),
        )
        .unwrap();
    let record = tokio::time::timeout(Duration::from_millis(100), read)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(record["payload"]["state"], "CANCELLED");
    assert!(!reader.finished.load(Ordering::SeqCst));
    assert_eq!(engine.registry.sizes().0, 0);
}
#[tokio::test(flavor = "current_thread")]
async fn generation_revocation_discards_pending_native_result() {
    let (engine, source, reader) = setup();
    let body = serde_json::json!({"request_id":ID});
    let read = engine.read("main", "tauri://localhost/index.html", false, &body);
    tokio::pin!(read);
    tokio::select! {result=&mut read=>panic!("early {result:?}"),_=async{while !reader.entered.load(Ordering::SeqCst){tokio::task::yield_now().await;}}=>{}}
    source.flag.store(false, Ordering::SeqCst);
    let error = tokio::time::timeout(Duration::from_millis(100), read)
        .await
        .unwrap()
        .unwrap_err();
    assert_eq!(error["payload"]["code"], "TRANSPORT_DISCONNECTED");
    assert!(!reader.finished.load(Ordering::SeqCst));
}
#[tokio::test(flavor = "current_thread")]
async fn authorization_and_bad_payload_fail_before_session_or_reader_access() {
    let (engine, source, reader) = setup();
    assert_eq!(
        engine
            .read(
                "evil",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":ID})
            )
            .await
            .unwrap_err()["payload"]["code"],
        "TRANSPORT_FORBIDDEN"
    );
    assert!(
        engine
            .read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":ID,"url":"private"})
            )
            .await
            .is_err()
    );
    assert_eq!(source.calls.load(Ordering::SeqCst), 0);
    assert!(!reader.entered.load(Ordering::SeqCst));
}
#[tokio::test(flavor = "current_thread")]
async fn precancelled_request_does_not_observe_native_session() {
    let (engine, source, _) = setup();
    engine.registry.cancel(ID).unwrap();
    assert_eq!(
        engine
            .read(
                "main",
                "tauri://localhost",
                false,
                &serde_json::json!({"request_id":ID})
            )
            .await
            .unwrap()["payload"]["state"],
        "CANCELLED"
    );
    assert_eq!(source.calls.load(Ordering::SeqCst), 0);
}
struct RemoteFailure;
impl DiagnosticReader for RemoteFailure {
    fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
        Box::pin(async { Err(Failure::Timeout) })
    }
}
#[tokio::test(flavor = "current_thread")]
async fn safe_error_record_has_no_remote_freeform_data_or_native_credentials() {
    let (_, source, _) = setup();
    let engine = Engine::new(source, Arc::new(RemoteFailure)).unwrap();
    let error = engine
        .read(
            "main",
            "tauri://localhost",
            false,
            &serde_json::json!({"request_id":ID}),
        )
        .await
        .unwrap_err();
    assert_eq!(error["payload"]["origin"], "DESKTOP_APP");
    assert_eq!(error["payload"]["code"], "TRANSPORT_TIMEOUT");
    let text = serde_json::to_string(&error).unwrap();
    assert!(!text.contains(&"a".repeat(64)));
    for field in [
        "bind_port",
        "instance_id",
        "generation",
        "token",
        "url",
        "path",
    ] {
        assert!(!text.contains(field));
    }
    assert_eq!(error["payload"].as_object().unwrap().len(), 5);
    assert_eq!(
        error["envelope"]["correlation_id"],
        error["payload"]["correlation_id"]
    );
}
struct Unavailable;
impl SessionSource for Unavailable {
    fn snapshot(&self) -> Snapshot {
        Snapshot::Unavailable("STARTING")
    }
}
#[tokio::test(flavor = "current_thread")]
async fn actual_lifecycle_starting_is_not_reported_as_ready() {
    let (_, _, reader) = setup();
    let engine = Engine::new(Arc::new(Unavailable), reader.clone()).unwrap();
    let record = engine
        .read(
            "main",
            "tauri://localhost",
            false,
            &serde_json::json!({"request_id":ID}),
        )
        .await
        .unwrap();
    assert_eq!(record["payload"]["state"], "STARTING");
    assert!(!reader.entered.load(Ordering::SeqCst));
    assert_eq!(record["payload"].as_object().unwrap().len(), 2);
}
#[test]
fn public_registry_type_remains_native_only_and_bounded() {
    let _: Arc<Registry> = Registry::new();
    let _: Option<Value> = None;
    let (engine, source, _) = setup();
    let receipt = engine
        .cancel(
            "main",
            "tauri://localhost",
            false,
            &serde_json::json!({"request_id":ID}),
        )
        .unwrap();
    assert_eq!(
        receipt["envelope"]["schema_id"],
        "urn:japp:schema:desktop:service-cancellation:v1"
    );
    assert_eq!(
        receipt["payload"],
        serde_json::json!({"request_id":ID,"outcome":"CANCELLATION_REQUESTED"})
    );
    assert_eq!(source.calls.load(Ordering::SeqCst), 0);
}
#[tokio::test(flavor = "current_thread")]
async fn native_work_deadline_is_finite_even_if_reader_ignores_cancellation() {
    let (engine, _, reader) = setup();
    let started = std::time::Instant::now();
    let result = engine
        .read(
            "main",
            "tauri://localhost",
            false,
            &serde_json::json!({"request_id":ID}),
        )
        .await
        .unwrap_err();
    assert_eq!(result["payload"]["code"], "TRANSPORT_TIMEOUT");
    assert!(started.elapsed() < Duration::from_secs(5));
    assert!(!reader.finished.load(Ordering::SeqCst));
    assert_eq!(engine.registry.sizes().0, 0);
}
struct RevokeAtCompletion {
    flag: Arc<AtomicBool>,
}
impl DiagnosticReader for RevokeAtCompletion {
    fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
        Box::pin(async move {
            self.flag.store(false, Ordering::SeqCst);
            Ok(Versions {
                service: "0.0.1".into(),
                api: "1.0.0".into(),
            })
        })
    }
}
#[tokio::test(flavor = "current_thread")]
async fn validity_is_rechecked_at_completion_publication() {
    let (_, source, _) = setup();
    let engine = Engine::new(
        source.clone(),
        Arc::new(RevokeAtCompletion {
            flag: Arc::clone(&source.flag),
        }),
    )
    .unwrap();
    let result = engine
        .read(
            "main",
            "tauri://localhost",
            false,
            &serde_json::json!({"request_id":ID}),
        )
        .await
        .unwrap_err();
    assert_eq!(result["payload"]["code"], "TRANSPORT_DISCONNECTED");
    assert!(result["payload"].get("service_version").is_none());
}
