//! Mandatory owned loopback actors against the canonical root Python environment; no GUI.
use crate::api_client::{
    Failure,
    canonical::Catalog,
    client::{Cancellation, Client, Operation, Policy, Session},
};
use serde_json::{Value, json};
use std::{
    io::{Read, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Arc, mpsc},
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
const TOKEN: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const INSTANCE: &str = "svc_00000000000000000000000001";
const CORR: &str = "corr_00000000000000000000000002";
struct OwnedService {
    child: Child,
    lease: Option<ChildStdin>,
    port: u16,
}
impl OwnedService {
    fn start() -> Self {
        let project = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../..")
            .canonicalize()
            .expect("canonical repository root is required");
        let interpreter = if cfg!(windows) {
            project.join(".venv/Scripts/python.exe")
        } else {
            project.join(".venv/bin/python")
        };
        assert!(
            interpreter.is_file(),
            "canonical root .venv interpreter is required; run frozen uv sync"
        );
        let service_source = project.join("services/orchestrator/src");
        let contract_source = project.join("packages/contracts/generated/python/src");
        assert!(
            service_source.join("orchestrator/__main__.py").is_file(),
            "canonical service source is required"
        );
        assert!(
            contract_source.join("japp_contracts/__init__.py").is_file(),
            "canonical generated contracts are required"
        );
        let python_path = std::env::join_paths([service_source, contract_source])
            .expect("canonical Python import paths must be representable");
        let mut command = Command::new(interpreter);
        command
            .args(["-m", "orchestrator"])
            .current_dir(&project)
            .env_clear()
            .env("PYTHONPATH", python_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        // Windows Python requires its OS root for system-library resolution.
        // Inherit this one noncredential OS field only: no PATH, token, proxy,
        // SDK/exporter configuration, ambient PYTHONPATH or other environment.
        #[cfg(windows)]
        command.env(
            "SystemRoot",
            std::env::var_os("SystemRoot")
                .expect("Windows SystemRoot is required for the canonical interpreter"),
        );
        let mut child = command.spawn().unwrap();
        let lease = child.stdin.take();
        let mut owned = Self {
            child,
            lease,
            port: 0,
        };
        let bytes=serde_json::to_vec(&json!({"protocol":"JAPP_SERVICE_BOOTSTRAP_V1","schema_version":"1.0.0","bind_host":"127.0.0.1","bind_port":0,"session_token":TOKEN,"instance_id":INSTANCE,"generation":7})).unwrap();
        let stdin = owned.lease.as_mut().unwrap();
        stdin
            .write_all(&(bytes.len() as u32).to_be_bytes())
            .unwrap();
        stdin.write_all(&bytes).unwrap();
        stdin.flush().unwrap();
        let mut stdout = owned.child.stdout.take().unwrap();
        let (tx, rx) = mpsc::sync_channel(1);
        let reader = std::thread::spawn(move || {
            let mut prefix = [0; 4];
            stdout.read_exact(&mut prefix).unwrap();
            let length = u32::from_be_bytes(prefix) as usize;
            assert!(length <= 4096);
            let mut bytes = vec![0; length];
            stdout.read_exact(&mut bytes).unwrap();
            let _ = tx.send(serde_json::from_slice::<Value>(&bytes).unwrap());
        });
        let frame = rx.recv_timeout(Duration::from_secs(5)).unwrap();
        reader.join().unwrap();
        assert_eq!(frame["protocol"], "JAPP_SERVICE_STATUS_V1");
        assert_eq!(frame["instance_id"], INSTANCE);
        assert_eq!(frame["generation"], 7);
        assert_eq!(frame["status"], "READY");
        assert_eq!(frame.as_object().unwrap().len(), 7);
        owned.port = frame["bind_port"].as_u64().unwrap().try_into().unwrap();
        owned
    }
    fn kill_and_reap(&mut self) {
        self.lease.take();
        let _ = self.child.kill();
        self.child.wait().unwrap();
    }
}
impl Drop for OwnedService {
    fn drop(&mut self) {
        self.lease.take();
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn catalog() -> Arc<Catalog> {
    Arc::new(Catalog::new(super::canonical_documents()).unwrap())
}
fn session(port: u16) -> Arc<Session> {
    Arc::new(Session::new(TOKEN, INSTANCE, 7, port).unwrap())
}
#[tokio::test(flavor = "current_thread")]
async fn actual_python_service_accepts_native_proof_then_ready_version_health() {
    let owned = OwnedService::start();
    let mut client = Client::connect(
        session(owned.port),
        catalog(),
        CORR,
        Cancellation::new(),
        Policy::new(Duration::from_secs(3)).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(
        client.get(Operation::Ready).await.unwrap()["payload"]["status"],
        "READY"
    );
    assert_eq!(
        client.get(Operation::Version).await.unwrap()["payload"]["api_version"],
        "1.0.0"
    );
    assert_eq!(
        client.get(Operation::Health).await.unwrap()["payload"]["status"],
        "LIVE"
    );
    drop(client);
    drop(owned);
}
// A reaped process is no longer an owner, but its former socket tuple may
// remain unavailable briefly on Windows. Admit only an actual bind of that
// same tuple; never force reuse, change the port, or suppress a final error.
async fn bind_replacement_listener(port: u16, budget: Duration) -> std::io::Result<TcpListener> {
    let deadline = Instant::now() + budget;
    loop {
        match TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await {
            Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    return Err(error);
                }
                tokio::time::sleep(remaining.min(Duration::from_millis(5))).await;
                if Instant::now() >= deadline {
                    return Err(error);
                }
            }
            result => return result,
        }
    }
}
#[tokio::test(flavor = "current_thread")]
async fn replacement_listener_requires_the_same_port_to_be_actually_released() {
    let original = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = original.local_addr().unwrap().port();
    let waiting = bind_replacement_listener(port, Duration::from_secs(1));
    tokio::pin!(waiting);
    assert!(
        tokio::time::timeout(Duration::from_millis(20), &mut waiting)
            .await
            .is_err()
    );
    drop(original);
    let replacement = waiting.await.unwrap();
    assert_eq!(replacement.local_addr().unwrap().port(), port);
}
#[tokio::test(flavor = "current_thread")]
async fn replacement_listener_refuses_a_port_that_stays_owned() {
    let original = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = original.local_addr().unwrap().port();
    let error = bind_replacement_listener(port, Duration::from_millis(30))
        .await
        .unwrap_err();
    assert_eq!(error.kind(), std::io::ErrorKind::AddrInUse);
    assert_eq!(original.local_addr().unwrap().port(), port);
}
#[tokio::test(flavor = "current_thread")]
async fn actual_child_death_and_port_reuse_never_release_bearer() {
    let mut owned = OwnedService::start();
    let session = session(owned.port);
    owned.kill_and_reap();
    let replacement = bind_replacement_listener(owned.port, Duration::from_secs(1))
        .await
        .unwrap();
    let sink = tokio::spawn(async move {
        let (mut stream, _) = replacement.accept().await.unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut b = [0; 1];
            if stream.read_exact(&mut b).await.is_err() {
                break;
            }
            request.push(b[0]);
            assert!(request.len() < 16384);
        }
        stream
            .write_all(
                b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        request
    });
    let result = Client::connect(
        session,
        catalog(),
        CORR,
        Cancellation::new(),
        Policy::new(Duration::from_secs(1)).unwrap(),
    )
    .await;
    assert!(matches!(result, Err(Failure::Unauthenticated)));
    let request = tokio::time::timeout(Duration::from_secs(2), sink)
        .await
        .unwrap()
        .unwrap();
    let request = String::from_utf8(request).unwrap();
    assert!(request.contains("JAPP-HMAC-SHA256-V1"));
    assert!(!request.contains(TOKEN));
    assert!(!request.contains("Bearer "));
    drop(owned);
}
#[tokio::test(flavor = "current_thread")]
async fn real_relay_to_original_python_listener_is_not_a_proof_for_new_tuple() {
    let original = OwnedService::start();
    let relay = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let relay_port = relay.local_addr().unwrap().port();
    let original_port = original.port;
    let proxy = tokio::spawn(async move {
        let (mut incoming, _) = relay.accept().await.unwrap();
        let mut outgoing =
            tokio::net::TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, original_port))
                .await
                .unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut b = [0; 1];
            incoming.read_exact(&mut b).await.unwrap();
            request.push(b[0]);
            assert!(request.len() < 16384);
        }
        outgoing.write_all(&request).await.unwrap();
        let mut response = Vec::new();
        while !response.ends_with(b"\r\n\r\n") {
            let mut byte = [0; 1];
            outgoing.read_exact(&mut byte).await.unwrap();
            response.push(byte[0]);
            assert!(response.len() <= 16384);
        }
        let head = String::from_utf8(response.clone()).unwrap();
        assert!(head.starts_with("HTTP/1.1 401 "));
        assert!(!head.to_ascii_lowercase().contains("x-japp-server-proof"));
        let length: usize = head
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .map(|value| value.trim().parse().unwrap())
            })
            .unwrap();
        assert!(length <= 16384);
        let mut body = vec![0; length];
        outgoing.read_exact(&mut body).await.unwrap();
        response.extend(body);
        incoming.write_all(&response).await.unwrap();
        incoming.shutdown().await.unwrap();
        request
    });
    let result = Client::connect(
        session(relay_port),
        catalog(),
        CORR,
        Cancellation::new(),
        Policy::new(Duration::from_secs(1)).unwrap(),
    )
    .await;
    assert!(result.is_err());
    let request = tokio::time::timeout(Duration::from_secs(2), proxy)
        .await
        .unwrap()
        .unwrap();
    let text = String::from_utf8(request).unwrap();
    assert!(text.contains("JAPP-HMAC-SHA256-V1"));
    assert!(!text.contains(TOKEN));
    assert!(!text.contains("Bearer "));
    drop(original);
}

#[tokio::test(flavor = "current_thread")]
async fn real_listener_reuse_after_proof_never_causes_automatic_bearer_reconnect() {
    use crate::api_client::proof::{self, Context, Secret};
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let (close_tx, close_rx) = tokio::sync::oneshot::channel();
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let actor = tokio::spawn(async move {
        let (mut stream, peer) = listener.accept().await.unwrap();
        let local = stream.local_addr().unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            let mut byte = [0; 1];
            stream.read_exact(&mut byte).await.unwrap();
            request.push(byte[0]);
            assert!(request.len() <= 16384);
        }
        let text = String::from_utf8(request).unwrap();
        let header = |name: &str| {
            text.lines()
                .find_map(|line| {
                    line.split_once(':')
                        .filter(|(key, _)| key.eq_ignore_ascii_case(name))
                        .map(|(_, value)| value.trim().to_owned())
                })
                .unwrap()
        };
        let nonce = header("x-japp-nonce");
        let context = Context::new(INSTANCE, 7, peer, local).unwrap();
        let transcript = proof::request_transcript(&context, &nonce, CORR).unwrap();
        let secret = Secret::from_hex(TOKEN).unwrap();
        let authorization = header("authorization");
        proof::verify(
            &secret,
            &transcript,
            authorization.strip_prefix(proof::AUTH_SCHEME).unwrap(),
        )
        .unwrap();
        let vector: Value =
            serde_json::from_str(include_str!("fixtures/health-proof.v1.json")).unwrap();
        let body = vector["response_body_utf8"].as_str().unwrap().as_bytes();
        let response = proof::response_transcript(
            &context,
            &transcript,
            200,
            body,
            "urn:japp:schema:service:health:v1",
            "1.0.0",
            CORR,
        )
        .unwrap();
        let signature = proof::mac(&secret, &response);
        let headers = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nX-Japp-Schema-Id: urn:japp:schema:service:health:v1\r\nX-Japp-Schema-Version: 1.0.0\r\nX-Correlation-Id: {CORR}\r\nX-Japp-Auth-Version: 1.0.0\r\nX-Japp-Nonce: {nonce}\r\nX-Japp-Server-Proof: {signature}\r\n\r\n",
            body.len()
        );
        stream.write_all(headers.as_bytes()).await.unwrap();
        stream.write_all(body).await.unwrap();
        stream.flush().await.unwrap();
        close_rx.await.unwrap();
        stream.set_zero_linger().unwrap();
        drop(stream);
        drop(listener);
        let replacement = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port))
            .await
            .unwrap();
        ready_tx.send(()).unwrap();
        tokio::time::timeout(Duration::from_millis(150), replacement.accept())
            .await
            .is_ok()
    });
    let mut client = Client::connect(
        session(port),
        catalog(),
        CORR,
        Cancellation::new(),
        Policy::new(Duration::from_secs(2)).unwrap(),
    )
    .await
    .unwrap();
    close_tx.send(()).unwrap();
    ready_rx.await.unwrap();
    assert!(client.get(Operation::Ready).await.is_err());
    assert!(
        !tokio::time::timeout(Duration::from_secs(2), actor)
            .await
            .unwrap()
            .unwrap()
    );
}
