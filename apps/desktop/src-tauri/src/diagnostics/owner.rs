//! Short native owner snapshot; transport runs after the supervisor lock releases.
use super::core::engine::{Engine, HttpReader, SessionSource, Snapshot};
use crate::{
    api_client::canonical::Catalog,
    service::{LifecycleDiagnostic, ManagedService, NativeSession},
};
use std::sync::Arc;
struct OwnerSource(ManagedService);
impl SessionSource for OwnerSource {
    fn snapshot(&self) -> Snapshot {
        self.guarded_snapshot().0
    }
    fn guarded_snapshot(&self) -> (Snapshot, Option<u64>) {
        match self.0.client_session() {
            Ok(native) => snapshot_from_native(native),
            Err(_) => (
                Snapshot::Unavailable(match self.0.diagnostic() {
                    LifecycleDiagnostic::Starting => "STARTING",
                    LifecycleDiagnostic::Stopping => "STOPPING",
                    LifecycleDiagnostic::Stopped => "STOPPED",
                    LifecycleDiagnostic::Failed => "FAILED",
                    LifecycleDiagnostic::CleanupFailed => "CLEANUP_FAILED",
                    LifecycleDiagnostic::Unavailable | LifecycleDiagnostic::Running => {
                        "UNAVAILABLE"
                    }
                }),
                None,
            ),
        }
    }
    fn current_epoch(&self) -> Option<u64> {
        Some(self.0.authority_epoch())
    }
}
fn snapshot_from_native(native: NativeSession) -> (Snapshot, Option<u64>) {
    (
        Snapshot::Running {
            session: native.session,
            valid: native.valid,
        },
        Some(native.authority_epoch),
    )
}
pub fn create_engine(owner: ManagedService) -> Result<Arc<Engine>, crate::api_client::Failure> {
    // Compile the canonical offline catalog before any owner callback/IPC work.
    let texts = [
        include_str!("../../../../../packages/contracts/schemas/common/confidence.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/common/correlation.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/common/envelope.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/common/provenance.v1.schema.json"),
        include_str!(
            "../../../../../packages/contracts/schemas/common/schema-version.v1.schema.json"
        ),
        include_str!("../../../../../packages/contracts/schemas/common/stable-id.v1.schema.json"),
        include_str!(
            "../../../../../packages/contracts/schemas/common/timestamp-utc.v1.schema.json"
        ),
        include_str!("../../../../../packages/contracts/schemas/error/record.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/error/taxonomy.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/service/health.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/service/ready.v1.schema.json"),
        include_str!("../../../../../packages/contracts/schemas/service/version.v1.schema.json"),
    ];
    let docs = texts
        .into_iter()
        .map(serde_json::from_str)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| crate::api_client::Failure::Schema)?;
    let catalog = Arc::new(Catalog::new(docs)?);
    Ok(Arc::new(Engine::new(
        Arc::new(OwnerSource(owner)),
        Arc::new(HttpReader::new(catalog)),
    )?))
}

#[cfg(test)]
mod bridge_tests {
    use super::*;
    use crate::api_client::client::Session;
    use std::sync::atomic::{AtomicBool, Ordering};
    #[test]
    fn bridge_owner_adapter_preserves_exact_native_arc_flag_and_epoch() {
        let valid = Arc::new(AtomicBool::new(true));
        let session = Arc::new(
            Session::with_generation_validity(
                &"a".repeat(64),
                "svc_00000000000000000000000002",
                7,
                12345,
                Arc::clone(&valid),
            )
            .unwrap(),
        );
        let (snapshot, epoch) = snapshot_from_native(NativeSession {
            session: Arc::clone(&session),
            valid: Arc::clone(&valid),
            authority_epoch: 19,
        });
        let Snapshot::Running {
            session: observed,
            valid: flag,
        } = snapshot
        else {
            panic!("owner snapshot lost")
        };
        assert!(Arc::ptr_eq(&observed, &session));
        assert!(Arc::ptr_eq(&flag, &valid));
        assert_eq!(epoch, Some(19));
        valid.store(false, Ordering::Release);
        assert!(!flag.load(Ordering::Acquire));
    }
}
