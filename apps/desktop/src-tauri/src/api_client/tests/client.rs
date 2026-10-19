use crate::api_client::{
    Failure,
    canonical::Catalog,
    client::{Cancellation, Client, Operation, Policy, Session},
    proof::{self, Context, Secret},
};
use bytes::Bytes;
use http_body_util::{BodyExt, Full, combinators::BoxBody};
use hyper::{
    Request, Response,
    body::{Body, Frame, Incoming, SizeHint},
    service::service_fn,
};
use hyper_util::rt::TokioIo;
use serde_json::json;
use std::{
    convert::Infallible,
    pin::Pin,
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
    task::{Context as TaskContext, Poll},
    time::Duration,
};
use tokio::{net::TcpListener, task::JoinHandle};
pub(crate) const TOKEN: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
pub(crate) const INSTANCE: &str = "svc_00000000000000000000000001";
const CORR: &str = "corr_00000000000000000000000002";
#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Good,
    Unsigned,
    WrongTuple,
    WrongIdentity,
    Oversize,
    Drip,
    CloseAfterProof,
    Retry,
    AlwaysUnavailable,
    Unauthorized,
    Redirect,
    ErrorHeaderMismatch,
    StallAfterProof,
    DuplicateMetadata,
    OversizeHeaders,
}
struct Actor {
    port: u16,
    events: Arc<Mutex<Vec<String>>>,
    connections: Arc<AtomicUsize>,
    task: JoinHandle<()>,
    closed_bodies: Arc<AtomicUsize>,
    closed_connections: Arc<AtomicUsize>,
}
impl Drop for Actor {
    fn drop(&mut self) {
        self.task.abort();
    }
}
struct PendingBody {
    first: Option<Bytes>,
    closed: Arc<AtomicUsize>,
}
impl Drop for PendingBody {
    fn drop(&mut self) {
        self.closed.fetch_add(1, Ordering::SeqCst);
    }
}
impl Body for PendingBody {
    type Data = Bytes;
    type Error = Infallible;
    fn poll_frame(
        mut self: Pin<&mut Self>,
        _cx: &mut TaskContext<'_>,
    ) -> Poll<Option<Result<Frame<Bytes>, Infallible>>> {
        if let Some(first) = self.first.take() {
            Poll::Ready(Some(Ok(Frame::data(first))))
        } else {
            Poll::Pending
        }
    }
    fn size_hint(&self) -> SizeHint {
        SizeHint::with_exact(9999)
    }
}
fn body(bytes: Vec<u8>) -> BoxBody<Bytes, Infallible> {
    Full::new(Bytes::from(bytes)).boxed()
}
pub(crate) fn envelope(operation: &str, generation: u32, status: u16) -> Vec<u8> {
    let schema = if status == 200 {
        format!("urn:japp:schema:service:{operation}:v1")
    } else {
        "urn:japp:schema:error:record:v1".into()
    };
    let payload = if status != 200 {
        json!({"error_id":"err_00000000000000000000000003","code":if status==401{"TRANSPORT_UNAUTHENTICATED"}else{"TRANSPORT_SERVICE_UNAVAILABLE"},"occurred_at":"2026-10-18T12:00:00.000Z","origin":"ORCHESTRATOR","correlation_id":CORR})
    } else {
        match operation {
            "health" => {
                json!({"status":"LIVE","scope":"SERVICE_SKELETON","instance_id":INSTANCE,"generation":generation})
            }
            "ready" => {
                json!({"status":"READY","scope":"SERVICE_SKELETON","instance_id":INSTANCE,"generation":generation})
            }
            _ => {
                json!({"service_version":"0.0.1","api_version":"1.0.0","instance_id":INSTANCE,"generation":generation})
            }
        }
    };
    serde_json::to_vec(&json!({"envelope":{"schema_id":schema,"schema_version":"1.0.0","message_id":"msg_00000000000000000000000003","created_at":"2026-10-18T12:00:00.000Z","correlation_id":CORR},"payload":payload})).unwrap()
}
async fn actor(mode: Mode) -> Actor {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let events = Arc::new(Mutex::new(Vec::new()));
    let connections = Arc::new(AtomicUsize::new(0));
    let closed_bodies = Arc::new(AtomicUsize::new(0));
    let closed = Arc::clone(&closed_bodies);
    let closed_connections = Arc::new(AtomicUsize::new(0));
    let connection_closed = Arc::clone(&closed_connections);
    let e = Arc::clone(&events);
    let count = Arc::clone(&connections);
    let task = tokio::spawn(async move {
        let mut children = tokio::task::JoinSet::new();
        loop {
            let Ok((stream, peer)) = listener.accept().await else {
                break;
            };
            count.fetch_add(1, Ordering::SeqCst);
            let local = stream.local_addr().unwrap();
            let e = Arc::clone(&e);
            let closed = Arc::clone(&closed);
            let attempt = Arc::new(AtomicUsize::new(0));
            let connection_closed = Arc::clone(&connection_closed);
            children.spawn(async move {
                let service = service_fn(move |request: Request<Incoming>| {
                    let e = Arc::clone(&e);
                    let attempt = Arc::clone(&attempt);
                    let closed = Arc::clone(&closed);
                    async move {
                        let authorization = request
                            .headers()
                            .get("authorization")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or("")
                            .to_owned();
                        e.lock().unwrap().push(authorization.clone());
                        let preflight = authorization.starts_with(proof::AUTH_SCHEME);
                        let operation = request.uri().path().rsplit('/').next().unwrap().to_owned();
                        let mut status = 200;
                        if !preflight {
                            let n = attempt.fetch_add(1, Ordering::SeqCst);
                            if mode == Mode::AlwaysUnavailable
                                || mode == Mode::ErrorHeaderMismatch
                                || (mode == Mode::Retry && n == 0)
                            {
                                status = 503;
                            }
                            if mode == Mode::Unauthorized {
                                status = 401;
                            }
                            if mode == Mode::Redirect {
                                status = 302;
                            }
                        }
                        let bytes = if mode == Mode::Oversize && preflight {
                            vec![b'x'; 16385]
                        } else {
                            envelope(
                                &operation,
                                if mode == Mode::WrongIdentity { 8 } else { 7 },
                                status,
                            )
                        };
                        let schema = if status == 200 {
                            format!("urn:japp:schema:service:{operation}:v1")
                        } else {
                            "urn:japp:schema:error:record:v1".into()
                        };
                        let schema = if mode == Mode::ErrorHeaderMismatch && !preflight {
                            "urn:japp:schema:service:health:v1".to_owned()
                        } else {
                            schema
                        };
                        let mut response = Response::builder()
                            .status(status)
                            .header("content-type", "application/json")
                            .header("x-japp-schema-id", &schema)
                            .header("x-japp-schema-version", "1.0.0")
                            .header("x-correlation-id", CORR)
                            .header("cache-control", "no-store")
                            .header("x-content-type-options", "nosniff");
                        if preflight && mode != Mode::Unsigned {
                            let nonce = request.headers()["x-japp-nonce"].to_str().unwrap();
                            let ctx = Context::new(
                                INSTANCE,
                                7,
                                if mode == Mode::WrongTuple {
                                    format!("127.0.0.1:{}", peer.port().wrapping_add(1))
                                        .parse()
                                        .unwrap()
                                } else {
                                    peer
                                },
                                local,
                            )
                            .unwrap();
                            let transcript = proof::request_transcript(&ctx, nonce, CORR).unwrap();
                            let signature = proof::mac(
                                &Secret::from_hex(TOKEN).unwrap(),
                                &proof::response_transcript(
                                    &ctx,
                                    &transcript,
                                    status,
                                    &bytes,
                                    &schema,
                                    "1.0.0",
                                    CORR,
                                )
                                .unwrap(),
                            );
                            response = response
                                .header("x-japp-auth-version", "1.0.0")
                                .header("x-japp-nonce", nonce)
                                .header("x-japp-server-proof", signature);
                        }
                        if mode == Mode::CloseAfterProof && preflight {
                            response = response.header("connection", "close");
                        }
                        if mode == Mode::Redirect && !preflight {
                            response = response.header(
                                "location",
                                format!("http://127.0.0.1:{}/unexpected", local.port()),
                            );
                        }
                        if mode == Mode::DuplicateMetadata && preflight {
                            response = response.header("x-japp-schema-id", &schema);
                        }
                        if mode == Mode::OversizeHeaders && preflight {
                            response = response.header("x-overflow", "x".repeat(16385));
                        }
                        let body = if mode == Mode::Drip
                            || (mode == Mode::StallAfterProof && !preflight)
                        {
                            PendingBody {
                                first: Some(Bytes::from_static(b"{")),
                                closed: Arc::clone(&closed),
                            }
                            .boxed()
                        } else {
                            body(bytes)
                        };
                        Ok::<_, Infallible>(response.body(body).unwrap())
                    }
                });
                let _ = hyper::server::conn::http1::Builder::new()
                    .serve_connection(TokioIo::new(stream), service)
                    .await;
                connection_closed.fetch_add(1, Ordering::SeqCst);
            });
        }
        drop(children);
    });
    Actor {
        port,
        events,
        connections,
        task,
        closed_bodies,
        closed_connections,
    }
}
fn catalog() -> Arc<Catalog> {
    Arc::new(Catalog::new(super::canonical_documents()).unwrap())
}
fn session(port: u16) -> Arc<Session> {
    Arc::new(Session::new(TOKEN, INSTANCE, 7, port).unwrap())
}
fn policy() -> Policy {
    Policy::new(Duration::from_millis(500)).unwrap()
}
#[tokio::test(flavor = "current_thread")]
async fn real_same_connection_proof_precedes_bearer_and_canonical_ready() {
    let a = actor(Mode::Good).await;
    let mut c = Client::connect(
        session(a.port),
        catalog(),
        CORR,
        Cancellation::new(),
        policy(),
    )
    .await
    .unwrap();
    let result = c.get(Operation::Ready).await.unwrap();
    assert_eq!(result["payload"]["status"], "READY");
    let events = a.events.lock().unwrap();
    assert_eq!(events.len(), 2);
    assert!(events[0].starts_with(proof::AUTH_SCHEME));
    assert!(!events[0].contains(TOKEN));
    assert_eq!(events[1], format!("Bearer {TOKEN}"));
    assert_eq!(a.connections.load(Ordering::SeqCst), 1);
}
#[tokio::test(flavor = "current_thread")]
async fn rejected_proofs_and_schema_mismatch_never_release_bearer() {
    for mode in [
        Mode::Unsigned,
        Mode::WrongTuple,
        Mode::WrongIdentity,
        Mode::Oversize,
        Mode::DuplicateMetadata,
        Mode::OversizeHeaders,
    ] {
        let a = actor(mode).await;
        assert!(
            Client::connect(
                session(a.port),
                catalog(),
                CORR,
                Cancellation::new(),
                policy()
            )
            .await
            .is_err()
        );
        let events = a.events.lock().unwrap();
        assert_eq!(events.len(), 1);
        assert!(!events[0].contains(TOKEN));
    }
}
#[tokio::test(flavor = "current_thread")]
async fn response_body_deadline_and_cancellation_close_unproven_stream() {
    let a = actor(Mode::Drip).await;
    let result = Client::connect(
        session(a.port),
        catalog(),
        CORR,
        Cancellation::new(),
        Policy::new(Duration::from_millis(50)).unwrap(),
    )
    .await;
    assert!(matches!(result, Err(Failure::Timeout)));
    assert!(
        a.events
            .lock()
            .unwrap()
            .iter()
            .all(|event| !event.contains(TOKEN))
    );
    let cancel = Cancellation::new();
    cancel.cancel();
    let result = Client::connect(session(a.port), catalog(), CORR, cancel, policy()).await;
    assert!(matches!(result, Err(Failure::Cancelled)));
}
#[tokio::test(flavor = "current_thread")]
async fn closed_verified_stream_does_not_reconnect_or_downgrade() {
    let a = actor(Mode::CloseAfterProof).await;
    let connected = Client::connect(
        session(a.port),
        catalog(),
        CORR,
        Cancellation::new(),
        policy(),
    )
    .await;
    if let Ok(mut c) = connected {
        assert!(c.get(Operation::Version).await.is_err());
    }
    assert_eq!(a.connections.load(Ordering::SeqCst), 1);
    assert!(
        a.events
            .lock()
            .unwrap()
            .iter()
            .all(|event| !event.contains(TOKEN))
    );
}
#[tokio::test(flavor = "current_thread")]
async fn idempotent_retry_has_one_budget_and_keeps_the_verified_stream() {
    for (mode, expected) in [
        (Mode::Retry, 3),
        (Mode::AlwaysUnavailable, 3),
        (Mode::Unauthorized, 2),
        (Mode::Redirect, 2),
    ] {
        let a = actor(mode).await;
        let mut c = Client::connect(
            session(a.port),
            catalog(),
            CORR,
            Cancellation::new(),
            policy(),
        )
        .await
        .unwrap();
        let result = c.get(Operation::Ready).await;
        if mode == Mode::Retry {
            assert_eq!(result.unwrap()["payload"]["status"], "READY");
        } else {
            assert!(result.is_err());
        }
        assert_eq!(a.events.lock().unwrap().len(), expected);
        assert_eq!(a.connections.load(Ordering::SeqCst), 1);
    }
}
#[tokio::test(flavor = "current_thread")]
async fn native_revocation_prevents_any_late_bearer_request() {
    let a = actor(Mode::Good).await;
    let s = session(a.port);
    let mut c = Client::connect(
        Arc::clone(&s),
        catalog(),
        CORR,
        Cancellation::new(),
        policy(),
    )
    .await
    .unwrap();
    s.revoke();
    assert!(matches!(
        c.get(Operation::Version).await,
        Err(Failure::Disconnected)
    ));
    assert_eq!(a.events.lock().unwrap().len(), 1);
}

#[tokio::test(flavor = "current_thread")]
async fn error_schema_header_body_mismatch_is_terminal_without_retry() {
    let a = actor(Mode::ErrorHeaderMismatch).await;
    let mut client = Client::connect(
        session(a.port),
        catalog(),
        CORR,
        Cancellation::new(),
        policy(),
    )
    .await
    .unwrap();
    assert!(matches!(
        client.get(Operation::Ready).await,
        Err(Failure::Schema)
    ));
    assert_eq!(a.events.lock().unwrap().len(), 2);
}
#[tokio::test(flavor = "current_thread")]
async fn cancellation_during_actual_body_read_aborts_work_without_bearer() {
    let a = actor(Mode::Drip).await;
    let cancel = Cancellation::new();
    let c = cancel.clone();
    let port = a.port;
    let work =
        tokio::spawn(
            async move { Client::connect(session(port), catalog(), CORR, c, policy()).await },
        );
    tokio::time::timeout(Duration::from_millis(300), async {
        while a.events.lock().unwrap().is_empty() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    cancel.cancel();
    assert!(matches!(
        tokio::time::timeout(Duration::from_millis(200), work)
            .await
            .unwrap()
            .unwrap(),
        Err(Failure::Cancelled)
    ));
    assert!(
        a.events
            .lock()
            .unwrap()
            .iter()
            .all(|event| !event.contains(TOKEN))
    );
}

#[tokio::test(flavor = "current_thread")]
async fn cancellation_closes_verified_body_stream_while_client_is_retained() {
    let a = actor(Mode::StallAfterProof).await;
    let cancel = Cancellation::new();
    let c = cancel.clone();
    let mut client = Client::connect(session(a.port), catalog(), CORR, c, policy())
        .await
        .unwrap();
    let request = client.get(Operation::Ready);
    tokio::pin!(request);
    tokio::select! {result=&mut request=>panic!("unexpected early result: {result:?}"),_=async{while a.events.lock().unwrap().len()<2{tokio::task::yield_now().await;}}=>{}}
    cancel.cancel();
    assert!(matches!(request.await, Err(Failure::Cancelled)));
    tokio::time::timeout(Duration::from_millis(200), async {
        while a.closed_bodies.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(a.events.lock().unwrap().len(), 2);
}

#[tokio::test(flavor = "current_thread")]
async fn repeated_cancellation_cleanup_is_finite_and_never_polls_a_join_twice() {
    let actor = actor(Mode::Good).await;
    let cancel = Cancellation::new();
    let c = cancel.clone();
    let mut client = Client::connect(session(actor.port), catalog(), CORR, c, policy())
        .await
        .unwrap();
    cancel.cancel();
    for _ in 0..2 {
        assert!(matches!(
            client.get(Operation::Ready).await,
            Err(Failure::Cancelled)
        ));
    }
    assert_eq!(actor.events.lock().unwrap().len(), 1);
}

#[tokio::test(flavor = "current_thread")]
async fn cancellation_during_retry_backoff_closes_retained_client_transport() {
    let actor = actor(Mode::AlwaysUnavailable).await;
    let cancel = Cancellation::new();
    let mut client = Client::connect(
        session(actor.port),
        catalog(),
        CORR,
        cancel.clone(),
        policy(),
    )
    .await
    .unwrap();
    let request = client.get(Operation::Ready);
    tokio::pin!(request);
    tokio::select! {
        result = &mut request => panic!("unexpected early result: {result:?}"),
        _ = async {
            while actor.events.lock().unwrap().len() < 2 {
                tokio::task::yield_now().await;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        } => {}
    }
    cancel.cancel();
    assert!(matches!(request.await, Err(Failure::Cancelled)));
    // Client remains in scope: dropping it cannot make this close assertion pass.
    tokio::time::timeout(Duration::from_millis(200), async {
        while actor.closed_connections.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(actor.events.lock().unwrap().len(), 2);
    assert_eq!(actor.connections.load(Ordering::SeqCst), 1);
}
#[tokio::test(flavor = "current_thread")]
async fn native_generation_flag_denies_bearer_immediately_without_polling_bridge() {
    use std::sync::atomic::AtomicBool;
    let actor = actor(Mode::Good).await;
    let valid = Arc::new(AtomicBool::new(true));
    let session = Arc::new(
        Session::with_generation_validity(TOKEN, INSTANCE, 7, actor.port, Arc::clone(&valid))
            .unwrap(),
    );
    let mut client = Client::connect(session, catalog(), CORR, Cancellation::new(), policy())
        .await
        .unwrap();
    valid.store(false, Ordering::SeqCst);
    assert!(matches!(
        client.get(Operation::Ready).await,
        Err(Failure::Disconnected)
    ));
    assert_eq!(actor.events.lock().unwrap().len(), 1);
}
