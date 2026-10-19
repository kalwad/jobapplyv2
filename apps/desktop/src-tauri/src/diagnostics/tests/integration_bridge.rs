//! Pure owner/epoch composition counterproofs: no transport or process actors.
use crate::api_client::client::{Cancellation, Session};
use crate::diagnostics::core::engine::{
    DiagnosticReader, Engine, ReadFuture, SessionSource, Snapshot, Versions,
};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
};

struct Source {
    session: Arc<Session>,
    valid: Arc<AtomicBool>,
    current: Arc<AtomicU64>,
    captured: u64,
    ordinary_calls: AtomicUsize,
    guarded_calls: AtomicUsize,
}
impl Source {
    fn new(captured: u64, current: u64) -> Arc<Self> {
        Arc::new(Self {
            session: Arc::new(
                Session::new(&"a".repeat(64), "svc_00000000000000000000000002", 7, 12345).unwrap(),
            ),
            valid: Arc::new(AtomicBool::new(true)),
            current: Arc::new(AtomicU64::new(current)),
            captured,
            ordinary_calls: AtomicUsize::new(0),
            guarded_calls: AtomicUsize::new(0),
        })
    }
    fn running(&self) -> Snapshot {
        Snapshot::Running {
            session: Arc::clone(&self.session),
            valid: Arc::clone(&self.valid),
        }
    }
}
impl SessionSource for Source {
    fn snapshot(&self) -> Snapshot {
        self.ordinary_calls.fetch_add(1, Ordering::SeqCst);
        self.running()
    }
    fn guarded_snapshot(&self) -> (Snapshot, Option<u64>) {
        self.guarded_calls.fetch_add(1, Ordering::SeqCst);
        (self.running(), Some(self.captured))
    }
    fn current_epoch(&self) -> Option<u64> {
        Some(self.current.load(Ordering::Acquire))
    }
}
struct Immediate {
    source: Arc<Source>,
    calls: AtomicUsize,
    replace_during_read: bool,
}
impl DiagnosticReader for Immediate {
    fn read<'a>(&'a self, session: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
        Box::pin(async move {
            self.calls.fetch_add(1, Ordering::SeqCst);
            assert!(Arc::ptr_eq(&session, &self.source.session));
            if self.replace_during_read {
                self.source.current.fetch_add(1, Ordering::AcqRel);
            }
            Ok(Versions {
                service: "0.0.1".into(),
                api: "1.0.0".into(),
            })
        })
    }
}
async fn read(engine: &Engine) -> Result<serde_json::Value, serde_json::Value> {
    engine
        .read(
            "main",
            "tauri://localhost/index.html",
            false,
            &serde_json::json!({"request_id":"req_00000000000000000000000001"}),
        )
        .await
}
fn engine(source: Arc<Source>, replace_during_read: bool) -> (Engine, Arc<Immediate>) {
    let reader = Arc::new(Immediate {
        source: Arc::clone(&source),
        calls: AtomicUsize::new(0),
        replace_during_read,
    });
    (Engine::new(source, reader.clone()).unwrap(), reader)
}
#[tokio::test(flavor = "current_thread")]
async fn integration_bridge_reads_exact_owner_snapshot_once() {
    let source = Source::new(7, 7);
    let (engine, reader) = engine(Arc::clone(&source), false);
    assert_eq!(read(&engine).await.unwrap()["payload"]["state"], "READY");
    assert_eq!(source.guarded_calls.load(Ordering::SeqCst), 1);
    assert_eq!(source.ordinary_calls.load(Ordering::SeqCst), 0);
    assert_eq!(reader.calls.load(Ordering::SeqCst), 1);
}
#[tokio::test(flavor = "current_thread")]
async fn integration_bridge_rejects_changed_epoch_before_dispatch() {
    let source = Source::new(7, 8);
    let (engine, reader) = engine(source, false);
    assert_eq!(
        read(&engine).await.unwrap_err()["payload"]["code"],
        "TRANSPORT_DISCONNECTED"
    );
    assert_eq!(reader.calls.load(Ordering::SeqCst), 0);
}
#[tokio::test(flavor = "current_thread")]
async fn integration_bridge_rejects_changed_epoch_at_publication() {
    let source = Source::new(7, 7);
    let (engine, reader) = engine(Arc::clone(&source), true);
    assert_eq!(
        read(&engine).await.unwrap_err()["payload"]["code"],
        "TRANSPORT_DISCONNECTED"
    );
    assert_eq!(reader.calls.load(Ordering::SeqCst), 1);
    assert!(source.valid.load(Ordering::SeqCst));
}
struct Pending {
    entered: Arc<AtomicBool>,
    finished: Arc<AtomicBool>,
}
impl DiagnosticReader for Pending {
    fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
        Box::pin(async move {
            self.entered.store(true, Ordering::Release);
            tokio::time::sleep(std::time::Duration::from_secs(20)).await;
            self.finished.store(true, Ordering::Release);
            Ok(Versions {
                service: "0.0.1".into(),
                api: "1.0.0".into(),
            })
        })
    }
}
#[tokio::test(flavor = "current_thread")]
async fn integration_bridge_epoch_change_interrupts_pending_work_without_flag_poll_or_completion() {
    let source = Source::new(7, 7);
    let pending = Arc::new(Pending {
        entered: Arc::new(AtomicBool::new(false)),
        finished: Arc::new(AtomicBool::new(false)),
    });
    let engine = Engine::new(source.clone(), pending.clone()).unwrap();
    let work = read(&engine);
    tokio::pin!(work);
    tokio::select! { result=&mut work=>panic!("unexpected early result {result:?}"), _=async { while !pending.entered.load(Ordering::Acquire) { tokio::task::yield_now().await; } }=>{} }
    source.current.store(8, Ordering::Release);
    let result = tokio::time::timeout(std::time::Duration::from_millis(100), work)
        .await
        .unwrap();
    assert_eq!(
        result.unwrap_err()["payload"]["code"],
        "TRANSPORT_DISCONNECTED"
    );
    assert!(source.valid.load(Ordering::Acquire));
    assert!(!pending.finished.load(Ordering::Acquire));
    assert_eq!(engine.registry.sizes().0, 0);
}
