//! One proven HTTP/1 connection; no pool, proxy, redirect or reconnect capability.
use super::{
    Failure,
    canonical::Catalog,
    proof::{self, Context, Secret},
};
use bytes::Bytes;
use http_body_util::{BodyExt, Empty};
use hyper::{HeaderMap, Request, body::Incoming, client::conn::http1::SendRequest};
use hyper_util::rt::TokioIo;
use serde_json::Value;
use std::{
    future::Future,
    net::{Ipv4Addr, SocketAddr},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::{
    net::TcpStream,
    sync::watch,
    task::JoinHandle,
    time::{Instant, sleep_until},
};
const BODY_LIMIT: usize = 16384;
const HEADER_COUNT: usize = 64;
const HEADER_BYTES: usize = 16384;
#[derive(Clone)]
pub struct Cancellation {
    signal: watch::Sender<bool>,
}
impl Cancellation {
    pub fn new() -> Self {
        Self {
            signal: watch::channel(false).0,
        }
    }
    pub fn cancel(&self) {
        self.signal.send_replace(true);
    }
    pub fn is_cancelled(&self) -> bool {
        *self.signal.borrow()
    }
}
impl Default for Cancellation {
    fn default() -> Self {
        Self::new()
    }
}
pub struct Session {
    key: Secret,
    instance: String,
    generation: u32,
    port: u16,
    revoked: watch::Sender<bool>,
    generation_valid: Arc<AtomicBool>,
}
impl Session {
    pub fn new(token: &str, instance: &str, generation: u32, port: u16) -> Result<Self, Failure> {
        Context::new(
            instance,
            generation,
            SocketAddr::from((Ipv4Addr::LOCALHOST, 1)),
            SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
        )?;
        Ok(Self {
            key: Secret::from_hex(token)?,
            instance: instance.into(),
            generation,
            port,
            revoked: watch::channel(false).0,
            generation_valid: Arc::new(AtomicBool::new(true)),
        })
    }
    pub fn with_generation_validity(
        token: &str,
        instance: &str,
        generation: u32,
        port: u16,
        valid: Arc<AtomicBool>,
    ) -> Result<Self, Failure> {
        let mut session = Self::new(token, instance, generation, port)?;
        session.generation_valid = valid;
        Ok(session)
    }
    #[allow(dead_code)] // Native lifecycle-owner watch seam; W05 owns generation withdrawal.
    pub fn revoke(&self) {
        self.revoked.send_replace(true);
    }
    fn active(&self) -> bool {
        !*self.revoked.borrow() && self.generation_valid.load(Ordering::SeqCst)
    }
}
#[derive(Clone, Copy)]
pub struct Policy {
    total: Duration,
}
impl Policy {
    pub fn new(total: Duration) -> Result<Self, Failure> {
        if total.is_zero() || total > Duration::from_secs(10) {
            return Err(Failure::Malformed);
        }
        Ok(Self { total })
    }
}
#[derive(Clone, Copy)]
pub enum Operation {
    Health,
    Ready,
    Version,
}
impl Operation {
    fn name(self) -> &'static str {
        match self {
            Self::Health => "health",
            Self::Ready => "ready",
            Self::Version => "version",
        }
    }
}
struct Reply {
    status: u16,
    headers: HeaderMap,
    body: Vec<u8>,
}
pub struct Client {
    sender: SendRequest<Empty<Bytes>>,
    driver: Option<JoinHandle<()>>,
    session: Arc<Session>,
    cancel: Cancellation,
    deadline: Instant,
    context: Context,
    correlation: String,
    catalog: Arc<Catalog>,
}
impl Drop for Client {
    fn drop(&mut self) {
        if let Some(driver) = &self.driver {
            driver.abort();
        }
    }
}
async fn changed(mut receiver: watch::Receiver<bool>) {
    loop {
        if *receiver.borrow_and_update() {
            return;
        }
        if receiver.changed().await.is_err() {
            return;
        }
    }
}
async fn controlled<T>(
    session: Arc<Session>,
    cancel: Cancellation,
    deadline: Instant,
    work: impl Future<Output = Result<T, Failure>>,
) -> Result<T, Failure> {
    if !session.active() {
        return Err(Failure::Disconnected);
    }
    if cancel.is_cancelled() {
        return Err(Failure::Cancelled);
    }
    if Instant::now() >= deadline {
        return Err(Failure::Timeout);
    }
    tokio::select! {biased;_=changed(session.revoked.subscribe())=>Err(Failure::Disconnected),_=changed(cancel.signal.subscribe())=>Err(Failure::Cancelled),_=sleep_until(deadline)=>Err(Failure::Timeout),result=work=>result}
}
fn single<'a>(headers: &'a HeaderMap, name: &str) -> Result<&'a str, Failure> {
    let mut values = headers.get_all(name).iter();
    let value = values.next().ok_or(Failure::Malformed)?;
    if values.next().is_some() {
        return Err(Failure::Malformed);
    }
    value.to_str().map_err(|_| Failure::Malformed)
}
async fn read_reply(response: hyper::Response<Incoming>) -> Result<Reply, Failure> {
    let (status, headers) = (response.status().as_u16(), response.headers().clone());
    if headers.len() > HEADER_COUNT
        || headers
            .iter()
            .map(|(n, v)| n.as_str().len() + v.as_bytes().len())
            .sum::<usize>()
            > HEADER_BYTES
    {
        return Err(Failure::PayloadTooLarge);
    }
    if let Some(encoding) = headers.get("content-encoding")
        && encoding.as_bytes() != b"identity"
    {
        return Err(Failure::Malformed);
    }
    let mut incoming = response.into_body();
    let mut body = Vec::new();
    while let Some(frame) = incoming.frame().await {
        let frame = frame.map_err(|_| Failure::Disconnected)?;
        let data = frame.into_data().map_err(|_| Failure::Malformed)?;
        if body.len() + data.len() > BODY_LIMIT {
            return Err(Failure::PayloadTooLarge);
        }
        body.extend_from_slice(&data);
    }
    Ok(Reply {
        status,
        headers,
        body,
    })
}
impl Client {
    pub async fn connect(
        session: Arc<Session>,
        catalog: Arc<Catalog>,
        correlation: &str,
        cancel: Cancellation,
        policy: Policy,
    ) -> Result<Self, Failure> {
        if !proof::valid_stable(correlation) {
            return Err(Failure::Malformed);
        }
        let deadline = Instant::now() + policy.total;
        let s = Arc::clone(&session);
        let c = cancel.clone();
        controlled(Arc::clone(&session), cancel.clone(), deadline, async move {
            let remote = SocketAddr::from((Ipv4Addr::LOCALHOST, s.port));
            let connect_deadline = deadline.min(Instant::now() + Duration::from_millis(500));
            let stream = tokio::time::timeout_at(connect_deadline, TcpStream::connect(remote))
                .await
                .map_err(|_| Failure::Timeout)?
                .map_err(|_| Failure::Disconnected)?;
            let context = Context::new(
                &s.instance,
                s.generation,
                stream.local_addr().map_err(|_| Failure::Disconnected)?,
                stream.peer_addr().map_err(|_| Failure::Disconnected)?,
            )?;
            if context.remote != remote {
                return Err(Failure::Identity);
            }
            let mut builder = hyper::client::conn::http1::Builder::new();
            builder.max_headers(HEADER_COUNT).max_buf_size(HEADER_BYTES);
            let (sender, connection) = builder
                .handshake(TokioIo::new(stream))
                .await
                .map_err(|_| Failure::Disconnected)?;
            let driver = tokio::spawn(async move {
                let _ = connection.await;
            });
            let mut client = Self {
                sender,
                driver: Some(driver),
                session: s,
                cancel: c,
                deadline,
                context,
                correlation: correlation.into(),
                catalog,
            };
            client.prove().await?;
            Ok(client)
        })
        .await
    }
    fn active(&self) -> Result<(), Failure> {
        if !self.session.active() {
            Err(Failure::Disconnected)
        } else if self.cancel.is_cancelled() {
            Err(Failure::Cancelled)
        } else if Instant::now() >= self.deadline {
            Err(Failure::Timeout)
        } else {
            Ok(())
        }
    }
    fn request(
        &self,
        operation: Operation,
        authorization: String,
    ) -> Result<Request<Empty<Bytes>>, Failure> {
        Request::builder()
            .method("GET")
            .uri(format!("/api/v1/{}", operation.name()))
            .header("host", self.context.remote.to_string())
            .header("authorization", authorization)
            .header("x-correlation-id", &self.correlation)
            .header("accept", "application/json")
            .header("accept-encoding", "identity")
            .header("content-length", "0")
            .body(Empty::new())
            .map_err(|_| Failure::Malformed)
    }
    async fn send(&mut self, request: Request<Empty<Bytes>>) -> Result<Reply, Failure> {
        if let Err(error) = self.active() {
            self.close_transport().await;
            return Err(error);
        }
        let session = Arc::clone(&self.session);
        let cancel = self.cancel.clone();
        let deadline = self.deadline;
        let sender = &mut self.sender;
        let send_session = Arc::clone(&session);
        let send_cancel = cancel.clone();
        let result = controlled(session, cancel, deadline, async move {
            sender.ready().await.map_err(|_| Failure::Disconnected)?;
            if !send_session.active() {
                return Err(Failure::Disconnected);
            }
            if send_cancel.is_cancelled() {
                return Err(Failure::Cancelled);
            }
            let response = sender
                .send_request(request)
                .await
                .map_err(|_| Failure::Disconnected)?;
            read_reply(response).await
        })
        .await;
        if result.is_err() {
            self.close_transport().await;
        }
        result
    }
    async fn close_transport(&mut self) {
        if let Some(mut driver) = self.driver.take() {
            driver.abort();
            // Only async socket I/O runs in this task; still bound the cleanup
            // join after the work deadline or cancellation has already fired.
            let _ = tokio::time::timeout(Duration::from_millis(50), &mut driver).await;
        }
    }

    fn metadata(&self, reply: &Reply) -> Result<(), Failure> {
        if single(&reply.headers, "content-type")? != "application/json"
            || single(&reply.headers, "cache-control")? != "no-store"
            || single(&reply.headers, "x-content-type-options")? != "nosniff"
            || single(&reply.headers, "x-correlation-id")? != self.correlation
        {
            return Err(Failure::Malformed);
        }
        Ok(())
    }
    fn validated(&self, reply: &Reply, operation: Operation) -> Result<Value, Failure> {
        self.metadata(reply)?;
        let value = if reply.status == 200 {
            self.catalog.validate(
                &reply.body,
                operation.name(),
                &self.correlation,
                &self.session.instance,
                self.session.generation,
            )?
        } else {
            let (code, value) = self.catalog.error(&reply.body, &self.correlation)?;
            self.schema_headers(reply, &value)?;
            return Err(Failure::Remote(code));
        };
        self.schema_headers(reply, &value)?;
        Ok(value)
    }
    fn schema_headers(&self, reply: &Reply, value: &Value) -> Result<(), Failure> {
        if single(&reply.headers, "x-japp-schema-id")?
            != value["envelope"]["schema_id"]
                .as_str()
                .ok_or(Failure::Malformed)?
            || single(&reply.headers, "x-japp-schema-version")?
                != value["envelope"]["schema_version"]
                    .as_str()
                    .ok_or(Failure::Malformed)?
        {
            return Err(Failure::Schema);
        }
        Ok(())
    }
    async fn prove(&mut self) -> Result<(), Failure> {
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes).map_err(|_| Failure::Unauthenticated)?;
        let nonce = proof::hex(&bytes);
        let transcript = proof::request_transcript(&self.context, &nonce, &self.correlation)?;
        let signature = proof::mac(&self.session.key, &transcript);
        let mut request = self.request(
            Operation::Health,
            format!("{}{signature}", proof::AUTH_SCHEME),
        )?;
        request.headers_mut().insert(
            "x-japp-auth-version",
            proof::AUTH_VERSION
                .parse()
                .map_err(|_| Failure::Malformed)?,
        );
        request.headers_mut().insert(
            "x-japp-nonce",
            nonce.parse().map_err(|_| Failure::Malformed)?,
        );
        let reply = self.send(request).await?;
        if single(&reply.headers, "x-japp-auth-version").map_err(|_| Failure::Unauthenticated)?
            != proof::AUTH_VERSION
            || single(&reply.headers, "x-japp-nonce").map_err(|_| Failure::Unauthenticated)?
                != nonce
        {
            return Err(Failure::Unauthenticated);
        }
        let response = proof::response_transcript(
            &self.context,
            &transcript,
            reply.status,
            &reply.body,
            single(&reply.headers, "x-japp-schema-id")?,
            single(&reply.headers, "x-japp-schema-version")?,
            &self.correlation,
        )?;
        proof::verify(
            &self.session.key,
            &response,
            single(&reply.headers, "x-japp-server-proof").map_err(|_| Failure::Unauthenticated)?,
        )?;
        self.validated(&reply, Operation::Health)?;
        self.active()
    }
    pub async fn get(&mut self, operation: Operation) -> Result<Value, Failure> {
        for attempt in 0..2 {
            if let Err(error) = self.active() {
                self.close_transport().await;
                return Err(error);
            }
            if self.sender.is_closed() {
                return Err(Failure::Disconnected);
            }
            let authorization = format!("Bearer {}", self.session.key.raw_hex());
            let request = self.request(operation, authorization)?;
            let reply = self.send(request).await?;
            let result = self.validated(&reply, operation);
            if let Err(error) = self.active() {
                self.close_transport().await;
                return Err(error);
            }
            if attempt == 0
                && reply.status == 503
                && matches!(&result,Err(Failure::Remote(code))if self.catalog.safe_retry(code.as_str()))
            {
                let backoff = controlled(
                    Arc::clone(&self.session),
                    self.cancel.clone(),
                    self.deadline,
                    async {
                        tokio::time::sleep(Duration::from_millis(50)).await;
                        Ok(())
                    },
                )
                .await;
                if let Err(error) = backoff {
                    self.close_transport().await;
                    return Err(error);
                }
                continue;
            }
            if result.is_err() {
                self.close_transport().await;
            }
            return result;
        }
        Err(Failure::Disconnected)
    }
}
