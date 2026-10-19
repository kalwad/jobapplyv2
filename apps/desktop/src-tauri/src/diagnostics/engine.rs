//! Native-only diagnostics composition and cancellation publication boundary.
use super::{Registry, authorize, parse_request};
use crate::api_client::{
    Failure,
    canonical::Catalog,
    client::{Cancellation, Client, Operation, Policy, Session},
};
use serde_json::{Value, json};
use std::{
    future::Future,
    pin::Pin,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::Duration,
};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use tokio::time::Instant;
const WORK_BUDGET: Duration = Duration::from_secs(4);
pub enum Snapshot {
    Unavailable(&'static str),
    Running {
        session: Arc<Session>,
        valid: Arc<AtomicBool>,
    },
}
pub trait SessionSource: Send + Sync {
    fn snapshot(&self) -> Snapshot;
    fn guarded_snapshot(&self) -> (Snapshot, Option<u64>) {
        (self.snapshot(), None)
    }
    fn current_epoch(&self) -> Option<u64> {
        None
    }
}
pub struct Versions {
    pub service: String,
    pub api: String,
}
pub type ReadFuture<'a> = Pin<Box<dyn Future<Output = Result<Versions, Failure>> + Send + 'a>>;
pub trait DiagnosticReader: Send + Sync {
    fn read<'a>(
        &'a self,
        session: Arc<Session>,
        cancel: Cancellation,
        correlation: &'a str,
    ) -> ReadFuture<'a>;
}
pub struct HttpReader {
    catalog: Arc<Catalog>,
}
impl HttpReader {
    pub fn new(catalog: Arc<Catalog>) -> Self {
        Self { catalog }
    }
}
impl DiagnosticReader for HttpReader {
    fn read<'a>(
        &'a self,
        session: Arc<Session>,
        cancel: Cancellation,
        correlation: &'a str,
    ) -> ReadFuture<'a> {
        Box::pin(async move {
            let mut client = Client::connect(
                session,
                Arc::clone(&self.catalog),
                correlation,
                cancel,
                Policy::new(WORK_BUDGET)?,
            )
            .await?;
            client.get(Operation::Ready).await?;
            let version = client.get(Operation::Version).await?;
            Ok(Versions {
                service: version["payload"]["service_version"]
                    .as_str()
                    .ok_or(Failure::Malformed)?
                    .into(),
                api: version["payload"]["api_version"]
                    .as_str()
                    .ok_or(Failure::Malformed)?
                    .into(),
            })
        })
    }
}
struct IdentityFactory {
    prefix: [u8; 8],
    next: AtomicU64,
}
impl IdentityFactory {
    fn new() -> Result<Self, Failure> {
        let mut prefix = [0; 8];
        getrandom::fill(&mut prefix).map_err(|_| Failure::Unauthenticated)?;
        Ok(Self {
            prefix,
            next: AtomicU64::new(0),
        })
    }
    fn id(&self, kind: &str) -> String {
        let sequence = self.next.fetch_add(1, Ordering::SeqCst);
        let mut bytes = [0; 16];
        bytes[..8].copy_from_slice(&self.prefix);
        bytes[8..].copy_from_slice(&sequence.to_be_bytes());
        let mut number = u128::from_be_bytes(bytes);
        let mut encoded = [b'0'; 26];
        let alphabet = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        for index in (0..26).rev() {
            encoded[index] = alphabet[(number & 31) as usize];
            number >>= 5;
        }
        format!("{kind}_{}", String::from_utf8_lossy(&encoded))
    }
    fn envelope(&self, schema: &str, correlation: &str, payload: Value) -> Value {
        // UTC formatting with a known fixed format produces no request data.
        let created = OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .unwrap_or_default();
        json!({"envelope":{"schema_id":schema,"schema_version":"1.0.0","message_id":self.id("msg"),"created_at":created,"correlation_id":correlation},"payload":payload})
    }
}
pub struct Engine {
    pub registry: Arc<Registry>,
    source: Arc<dyn SessionSource>,
    reader: Arc<dyn DiagnosticReader>,
    ids: IdentityFactory,
}
impl Engine {
    pub fn new(
        source: Arc<dyn SessionSource>,
        reader: Arc<dyn DiagnosticReader>,
    ) -> Result<Self, Failure> {
        Ok(Self {
            registry: Registry::new(),
            source,
            reader,
            ids: IdentityFactory::new()?,
        })
    }
    pub fn error(&self, code: &str, correlation: &str) -> Value {
        let occurred = OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .unwrap_or_default();
        self.ids.envelope("urn:japp:schema:error:record:v1",correlation,json!({"error_id":self.ids.id("err"),"code":code,"occurred_at":occurred,"origin":"DESKTOP_APP","correlation_id":correlation}))
    }
    fn state(&self, id: &str, state: &str, correlation: &str) -> Value {
        self.ids.envelope(
            "urn:japp:schema:desktop:service-diagnostics:v1",
            correlation,
            json!({"request_id":id,"state":state}),
        )
    }
    pub fn cancel(
        &self,
        label: &str,
        origin: &str,
        development: bool,
        value: &Value,
    ) -> Result<Value, Value> {
        let correlation = self.ids.id("corr");
        authorize(label, origin, development).map_err(|e| self.error(e.code(), &correlation))?;
        let id = parse_request(value).map_err(|e| self.error(e.code(), &correlation))?;
        let requested = self
            .registry
            .cancel(&id)
            .map_err(|e| self.error(e.code(), &correlation))?;
        Ok(self.ids.envelope("urn:japp:schema:desktop:service-cancellation:v1",&correlation,json!({"request_id":id,"outcome":if requested{"CANCELLATION_REQUESTED"}else{"ALREADY_FINISHED"}})))
    }
    pub async fn read(
        &self,
        label: &str,
        origin: &str,
        development: bool,
        value: &Value,
    ) -> Result<Value, Value> {
        let correlation = self.ids.id("corr");
        authorize(label, origin, development).map_err(|e| self.error(e.code(), &correlation))?;
        let id = parse_request(value).map_err(|e| self.error(e.code(), &correlation))?;
        let lease = self
            .registry
            .begin(&id)
            .map_err(|e| self.error(e.code(), &correlation))?;
        if lease.cancel.is_cancelled() {
            return Ok(self.state(&id, "CANCELLED", &correlation));
        }
        let (snapshot, epoch) = self.source.guarded_snapshot();
        let (session, valid) = match snapshot {
            Snapshot::Unavailable(state) => {
                if ![
                    "UNAVAILABLE",
                    "STARTING",
                    "STOPPING",
                    "STOPPED",
                    "FAILED",
                    "CLEANUP_FAILED",
                ]
                .contains(&state)
                {
                    return Err(self.error("TRANSPORT_MALFORMED_MESSAGE", &correlation));
                }
                if lease.cancel.is_cancelled() {
                    return Ok(self.state(&id, "CANCELLED", &correlation));
                }
                return Ok(self.state(&id, state, &correlation));
            }
            Snapshot::Running { session, valid } => (session, valid),
        };
        let still_current = || {
            valid.load(Ordering::SeqCst)
                && epoch.is_none_or(|captured| self.source.current_epoch() == Some(captured))
        };
        if !still_current() {
            return Err(self.error("TRANSPORT_DISCONNECTED", &correlation));
        }
        let deadline = Instant::now() + WORK_BUDGET;
        let work = self
            .reader
            .read(Arc::clone(&session), lease.cancel.clone(), &correlation);
        let revoked = async {
            loop {
                if !still_current() {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        };
        let cancelled = async {
            loop {
                if lease.cancel.is_cancelled() {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        };
        let result = tokio::select! {biased;_=cancelled=>Err(Failure::Cancelled),_=revoked=>{Err(Failure::Disconnected)},_=tokio::time::sleep_until(deadline)=>Err(Failure::Timeout),result=work=>result};
        // Publication is a point-in-time observation. Never release a completion
        // already cancelled/revoked/late at this native boundary.
        if lease.cancel.is_cancelled() {
            return Ok(self.state(&id, "CANCELLED", &correlation));
        }
        if !still_current() {
            return Err(self.error("TRANSPORT_DISCONNECTED", &correlation));
        }
        if Instant::now() >= deadline {
            return Err(self.error("TRANSPORT_TIMEOUT", &correlation));
        }
        if result.is_ok() {
            self.registry
                .complete(&id, &lease)
                .map_err(|error| self.error(error.code(), &correlation))?;
            // Recheck native authority/cancellation/deadline after the one-shot
            // bounded commit. A replacement cannot revive an old completion.
            if lease.cancel.is_cancelled() {
                return Ok(self.state(&id, "CANCELLED", &correlation));
            }
            if !still_current() {
                return Err(self.error("TRANSPORT_DISCONNECTED", &correlation));
            }
            if Instant::now() >= deadline {
                return Err(self.error("TRANSPORT_TIMEOUT", &correlation));
            }
        }
        match result {
            Ok(version)=>Ok(self.ids.envelope("urn:japp:schema:desktop:service-diagnostics:v1",&correlation,json!({"request_id":id,"state":"READY","service_version":version.service,"api_version":version.api}))),
            Err(Failure::Cancelled)=>Ok(self.state(&id,"CANCELLED",&correlation)),
            Err(error)=>Err(self.error(error.code().unwrap_or("TRANSPORT_MALFORMED_MESSAGE"),&correlation)),
        }
    }
}
