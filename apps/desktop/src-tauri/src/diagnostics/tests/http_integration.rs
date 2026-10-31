//! Actual Engine -> HttpReader -> Client -> owned TCP; the lifecycle source is fake.
//! No production session/registry/watch model or transport implementation is replaced.
use crate::api_client::{
    canonical::Catalog,
    client::Session,
    proof::{self, Context, Secret},
    tests::{
        canonical_documents,
        client::{INSTANCE, TOKEN, envelope},
    },
};
use crate::diagnostics::core::engine::{Engine, HttpReader, SessionSource, Snapshot};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
    },
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::oneshot,
    task::JoinHandle,
};

const ID: &str = "req_00000000000000000000000001";
const BOUND: Duration = Duration::from_secs(2);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum WaitAt {
    None,
    Proof,
    Ready,
}
#[derive(Debug, PartialEq, Eq)]
enum TerminalClose {
    Eof,
    Reset,
}
struct Report {
    events: Vec<(String, &'static str)>,
    close: TerminalClose,
    no_reconnect: bool,
}
struct Actor {
    port: u16,
    pending: oneshot::Receiver<()>,
    task: Option<JoinHandle<Report>>,
}
impl Drop for Actor {
    fn drop(&mut self) {
        if let Some(task) = &self.task {
            task.abort();
        }
    }
}
impl Actor {
    async fn finish(mut self) -> Report {
        // Keep the task in its Drop owner while waiting, including timeout/unwind.
        tokio::time::timeout(BOUND, self.task.as_mut().unwrap())
            .await
            .unwrap()
            .unwrap()
    }
}
struct Request {
    path: String,
    headers: BTreeMap<String, String>,
}
async fn request(stream: &mut TcpStream) -> Option<Request> {
    tokio::time::timeout(BOUND, async {
        let mut bytes = Vec::new();
        while !bytes.ends_with(b"\r\n\r\n") {
            let mut one = [0];
            let n = stream.read(&mut one).await.unwrap();
            if n == 0 {
                assert!(bytes.is_empty(), "truncated owned request");
                return None;
            }
            bytes.push(one[0]);
            assert!(bytes.len() <= 16384);
        }
        let text = String::from_utf8(bytes).unwrap();
        let mut lines = text.split("\r\n");
        let first = lines.next().unwrap().split_whitespace().collect::<Vec<_>>();
        assert_eq!(first.len(), 3);
        assert_eq!(first[0], "GET");
        assert_eq!(first[2], "HTTP/1.1");
        let path = first[1].to_owned();
        let mut headers = BTreeMap::new();
        for line in lines.take_while(|line| !line.is_empty()) {
            let (k, v) = line.split_once(':').unwrap();
            assert!(
                headers
                    .insert(k.to_ascii_lowercase(), v.trim().to_owned())
                    .is_none()
            );
            assert!(headers.len() <= 32);
        }
        assert_eq!(headers["content-length"], "0");
        Some(Request { path, headers })
    })
    .await
    .unwrap()
}
async fn terminal_close(stream: &mut TcpStream) -> TerminalClose {
    tokio::time::timeout(BOUND, async {
        let mut byte = [0];
        match stream.read(&mut byte).await {
            Ok(0) => TerminalClose::Eof,
            Err(error) if error.kind() == std::io::ErrorKind::ConnectionReset => {
                TerminalClose::Reset
            }
            other => panic!("late HTTP byte or non-terminal socket result: {other:?}"),
        }
    })
    .await
    .unwrap()
}
async fn actor(wait: WaitAt) -> Actor {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let (entered, pending) = oneshot::channel();
    let task = tokio::spawn(async move {
        let (mut stream, peer) = tokio::time::timeout(BOUND, listener.accept())
            .await
            .unwrap()
            .unwrap();
        assert!(peer.ip().is_loopback());
        let local = stream.local_addr().unwrap();
        let context = Context::new(INSTANCE, 7, peer, local).unwrap();
        let key = Secret::from_hex(TOKEN).unwrap();
        let mut events = Vec::new();
        let mut entered = Some(entered);
        for operation in ["health", "ready", "version"] {
            let request = request(&mut stream)
                .await
                .expect("expected next owned request");
            assert_eq!(request.path, format!("/api/v1/{operation}"));
            let correlation = &request.headers["x-correlation-id"];
            let authorization = &request.headers["authorization"];
            let preflight = operation == "health";
            let mut value: Value = serde_json::from_slice(&envelope(operation, 7, 200)).unwrap();
            value["envelope"]["correlation_id"] = correlation.clone().into();
            let bytes = serde_json::to_vec(&value).unwrap();
            let schema = format!("urn:japp:schema:service:{operation}:v1");
            let mut extra = String::new();
            if preflight {
                let signature = authorization.strip_prefix(proof::AUTH_SCHEME).unwrap();
                assert!(!authorization.contains(TOKEN));
                assert_eq!(request.headers["x-japp-auth-version"], proof::AUTH_VERSION);
                let nonce = &request.headers["x-japp-nonce"];
                let transcript = proof::request_transcript(&context, nonce, correlation).unwrap();
                proof::verify(&key, &transcript, signature).unwrap();
                let server = proof::mac(
                    &key,
                    &proof::response_transcript(
                        &context,
                        &transcript,
                        200,
                        &bytes,
                        &schema,
                        "1.0.0",
                        correlation,
                    )
                    .unwrap(),
                );
                extra = format!(
                    "x-japp-auth-version: {}\r\nx-japp-nonce: {nonce}\r\nx-japp-server-proof: {server}\r\n",
                    proof::AUTH_VERSION
                );
                events.push((request.path, "HMAC"));
            } else {
                assert_eq!(authorization, &format!("Bearer {TOKEN}"));
                events.push((request.path, "BEARER"));
            }
            let headers = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\nx-japp-schema-id: {schema}\r\nx-japp-schema-version: 1.0.0\r\nx-correlation-id: {correlation}\r\ncache-control: no-store\r\nx-content-type-options: nosniff\r\ncontent-length: {}\r\n{extra}\r\n",
                bytes.len()
            );
            stream.write_all(headers.as_bytes()).await.unwrap();
            if (wait == WaitAt::Proof && preflight)
                || (wait == WaitAt::Ready && operation == "ready")
            {
                // Real canonical signed/protected response headers and first body
                // byte are on the wire; its remaining body is deliberately held.
                stream.write_all(&bytes[..1]).await.unwrap();
                stream.flush().await.unwrap();
                entered.take().unwrap().send(()).unwrap();
                break;
            }
            stream.write_all(&bytes).await.unwrap();
            stream.flush().await.unwrap();
        }
        // An aborted connection can end in EOF or TCP reset. Any late byte fails.
        let close = terminal_close(&mut stream).await;
        eprintln!(
            "owned Engine/HttpReader terminal: wait={wait:?} close={close:?} events={events:?}"
        );
        drop(stream);
        let no_reconnect = tokio::time::timeout(Duration::from_millis(100), listener.accept())
            .await
            .is_err();
        assert!(
            no_reconnect,
            "late connection after the owned transport was dropped"
        );
        Report {
            events,
            close,
            no_reconnect,
        }
    });
    Actor {
        port,
        pending,
        task: Some(task),
    }
}
struct Source {
    session: Arc<Session>,
    valid: Arc<AtomicBool>,
    epoch: AtomicU64,
    guarded: AtomicUsize,
    ordinary: AtomicUsize,
}
impl Source {
    fn new(port: u16) -> Arc<Self> {
        let valid = Arc::new(AtomicBool::new(true));
        Arc::new(Self {
            session: Arc::new(
                Session::with_generation_validity(TOKEN, INSTANCE, 7, port, Arc::clone(&valid))
                    .unwrap(),
            ),
            valid,
            epoch: AtomicU64::new(7),
            guarded: AtomicUsize::new(0),
            ordinary: AtomicUsize::new(0),
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
        self.ordinary.fetch_add(1, Ordering::SeqCst);
        self.running()
    }
    fn guarded_snapshot(&self) -> (Snapshot, Option<u64>) {
        self.guarded.fetch_add(1, Ordering::SeqCst);
        (self.running(), Some(7))
    }
    fn current_epoch(&self) -> Option<u64> {
        Some(self.epoch.load(Ordering::Acquire))
    }
}
fn engine(source: Arc<Source>) -> Engine {
    Engine::new(
        source,
        Arc::new(HttpReader::new(Arc::new(
            Catalog::new(canonical_documents()).unwrap(),
        ))),
    )
    .unwrap()
}
fn closed_dto(record: &Value) {
    let mut documents = canonical_documents();
    for raw in [
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/contract-text.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/desktop/service-diagnostics.v1.schema.json"
        )),
    ] {
        documents.push(serde_json::from_str(raw).unwrap());
    }
    let mut resources = jsonschema::Registry::new();
    for document in documents {
        let id = document["$id"].as_str().unwrap().to_owned();
        resources = resources.add(id, document).unwrap();
    }
    let resources = resources.prepare().unwrap();
    for (schema, value) in [
        (
            "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord",
            record,
        ),
        (
            record["envelope"]["schema_id"].as_str().unwrap(),
            &record["payload"],
        ),
    ] {
        let validator = jsonschema::options()
            .with_registry(&resources)
            .should_validate_formats(true)
            .build(&json!({"$ref":schema}))
            .unwrap();
        assert!(validator.is_valid(value), "canonical closed DTO rejected");
    }
    let text = serde_json::to_string(record).unwrap();
    for private in [
        TOKEN,
        "bind_port",
        "instance_id",
        "generation",
        "authorization",
        "127.0.0.1",
    ] {
        assert!(!text.contains(private));
    }
}
fn observed(source: &Source) {
    assert_eq!(source.guarded.load(Ordering::SeqCst), 1);
    assert_eq!(source.ordinary.load(Ordering::SeqCst), 0);
}
#[tokio::test(flavor = "current_thread")]
async fn actual_engine_http_reader_authenticated_ready_version_is_closed() {
    let actor = actor(WaitAt::None).await;
    let source = Source::new(actor.port);
    let engine = engine(Arc::clone(&source));
    let record = tokio::time::timeout(
        BOUND,
        engine.read(
            "main",
            "tauri://localhost/index.html",
            false,
            &json!({"request_id":ID}),
        ),
    )
    .await
    .unwrap()
    .unwrap();
    closed_dto(&record);
    assert_eq!(
        record["payload"],
        json!({"request_id":ID,"state":"READY","service_version":"0.0.1","api_version":"1.0.0"})
    );
    observed(&source);
    let report = actor.finish().await;
    assert!(matches!(
        report.close,
        TerminalClose::Eof | TerminalClose::Reset
    ));
    assert!(report.no_reconnect);
    assert_eq!(
        report.events,
        vec![
            ("/api/v1/health".into(), "HMAC"),
            ("/api/v1/ready".into(), "BEARER"),
            ("/api/v1/version".into(), "BEARER")
        ]
    );
}
#[tokio::test(flavor = "current_thread")]
async fn actual_engine_cancel_drops_pending_protected_http_body_before_version() {
    let mut actor = actor(WaitAt::Ready).await;
    let source = Source::new(actor.port);
    let original_session = Arc::clone(&source.session);
    let original_flag = Arc::clone(&source.valid);
    let engine = engine(Arc::clone(&source));
    let body = json!({"request_id":ID});
    let mut read = Box::pin(engine.read("main", "tauri://localhost/index.html", false, &body));
    tokio::select! {result=&mut read=>panic!("early before protected-body barrier: {result:?}"),result=tokio::time::timeout(BOUND,&mut actor.pending)=>result.unwrap().unwrap()}
    let accepted = engine
        .cancel("main", "tauri://localhost/index.html", false, &body)
        .unwrap();
    assert_eq!(accepted["payload"]["outcome"], "CANCELLATION_REQUESTED");
    let record = tokio::time::timeout(BOUND, read).await.unwrap().unwrap();
    closed_dto(&record);
    assert_eq!(
        record["payload"],
        json!({"request_id":ID,"state":"CANCELLED"})
    );
    assert!(Arc::ptr_eq(&source.session, &original_session));
    assert!(Arc::ptr_eq(&source.valid, &original_flag));
    assert!(original_flag.load(Ordering::SeqCst));
    assert_eq!(source.current_epoch(), Some(7));
    assert_eq!(engine.registry.sizes().0, 0);
    observed(&source);
    let report = actor.finish().await;
    assert!(matches!(
        report.close,
        TerminalClose::Eof | TerminalClose::Reset
    ));
    assert!(report.no_reconnect);
    assert_eq!(
        report.events,
        vec![
            ("/api/v1/health".into(), "HMAC"),
            ("/api/v1/ready".into(), "BEARER")
        ]
    );
}
#[tokio::test(flavor = "current_thread")]
async fn actual_engine_flag_or_epoch_withdrawal_closes_proof_and_protected_streams() {
    for (wait, flag) in [
        (WaitAt::Proof, true),
        (WaitAt::Proof, false),
        (WaitAt::Ready, true),
        (WaitAt::Ready, false),
    ] {
        let mut actor = actor(wait).await;
        let source = Source::new(actor.port);
        let engine = engine(Arc::clone(&source));
        let body = json!({"request_id":ID});
        let mut read = Box::pin(engine.read("main", "tauri://localhost/index.html", false, &body));
        tokio::select! {result=&mut read=>panic!("early before withdrawal barrier: {result:?}"),result=tokio::time::timeout(BOUND,&mut actor.pending)=>result.unwrap().unwrap()}
        if flag {
            source.valid.store(false, Ordering::SeqCst);
        } else {
            source.epoch.fetch_add(1, Ordering::AcqRel);
        }
        let error = tokio::time::timeout(BOUND, read)
            .await
            .unwrap()
            .unwrap_err();
        closed_dto(&error);
        assert_eq!(error["payload"]["code"], "TRANSPORT_DISCONNECTED");
        assert_eq!(engine.registry.sizes().0, 0);
        observed(&source);
        let report = actor.finish().await;
        assert!(matches!(
            report.close,
            TerminalClose::Eof | TerminalClose::Reset
        ));
        assert!(report.no_reconnect);
        let mut expected = vec![("/api/v1/health".into(), "HMAC")];
        if wait == WaitAt::Ready {
            expected.push(("/api/v1/ready".into(), "BEARER"));
        }
        assert_eq!(report.events, expected);
    }
}
