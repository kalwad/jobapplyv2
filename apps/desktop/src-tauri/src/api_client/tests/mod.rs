//! Root Cargo tests use canonical repository schema bytes, never a copied catalog.
mod canonical;
pub(crate) mod client;
mod protocol;
mod python_runtime;

pub(crate) fn canonical_documents() -> Vec<serde_json::Value> {
    let documents = [
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/confidence.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/correlation.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/envelope.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/provenance.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/schema-version.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/stable-id.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/common/timestamp-utc.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/error/record.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/error/taxonomy.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/service/health.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/service/ready.v1.schema.json"
        )),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../packages/contracts/schemas/service/version.v1.schema.json"
        )),
    ];
    documents
        .into_iter()
        .map(|document| serde_json::from_str(document).unwrap())
        .collect()
}
