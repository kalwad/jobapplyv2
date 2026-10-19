use crate::api_client::canonical::Catalog;
use serde_json::Value;
fn catalog() -> Catalog {
    Catalog::new(super::canonical_documents()).unwrap()
}
fn fixture() -> Value {
    let v: Value = serde_json::from_str(include_str!("fixtures/health-proof.v1.json")).unwrap();
    serde_json::from_str(v["response_body_utf8"].as_str().unwrap()).unwrap()
}
#[test]
fn canonical_health_envelope_is_validated_with_offline_urn_catalog() {
    let c = catalog();
    let value = fixture();
    assert!(
        c.validate(
            &serde_json::to_vec(&value).unwrap(),
            "health",
            "corr_00000000000000000000000002",
            "svc_00000000000000000000000001",
            7
        )
        .is_ok()
    );
}
#[test]
fn every_critical_schema_identity_and_version_mutation_fails_closed() {
    let c = catalog();
    let good = fixture();
    let mutations = [
        ("/payload/generation", serde_json::json!(8)),
        (
            "/payload/instance_id",
            serde_json::json!("svc_00000000000000000000000002"),
        ),
        ("/payload/status", serde_json::json!("READY")),
        ("/envelope/schema_version", serde_json::json!("2.0.0")),
        ("/envelope/schema_version", serde_json::json!("1.1.0")),
        (
            "/envelope/correlation_id",
            serde_json::json!("corr_00000000000000000000000009"),
        ),
        (
            "/envelope/created_at",
            serde_json::json!("2026-02-30T12:00:00.000Z"),
        ),
    ];
    for (pointer, bad) in mutations {
        let mut value = good.clone();
        *value.pointer_mut(pointer).unwrap() = bad;
        assert!(
            c.validate(
                &serde_json::to_vec(&value).unwrap(),
                "health",
                "corr_00000000000000000000000002",
                "svc_00000000000000000000000001",
                7
            )
            .is_err(),
            "{pointer}"
        );
    }
    let raw = serde_json::to_string(&good).unwrap();
    let duplicate = raw.replace("\"generation\":7", "\"generation\":7,\"generation\":7");
    assert!(
        c.validate(
            duplicate.as_bytes(),
            "health",
            "corr_00000000000000000000000002",
            "svc_00000000000000000000000001",
            7
        )
        .is_err()
    );
    let mut extra = good.clone();
    extra["payload"]["private"] = serde_json::json!("forbidden");
    assert!(
        c.validate(
            &serde_json::to_vec(&extra).unwrap(),
            "health",
            "corr_00000000000000000000000002",
            "svc_00000000000000000000000001",
            7
        )
        .is_err()
    );
}
#[test]
fn missing_remote_or_file_schema_is_never_resolved() {
    let complete: Vec<Value> = super::canonical_documents();
    assert!(Catalog::new(complete.clone()).is_ok());
    for id in [
        "https://example.invalid/private.json",
        "file:///private/data.json",
    ] {
        let mut changed = complete.clone();
        let health = changed
            .iter_mut()
            .find(|document| document["$id"] == "urn:japp:schema:service:health:v1")
            .unwrap();
        // Keep every required catalog document and alter a compiled required
        // property only. No missing-envelope shortcut can cause this failure.
        health["properties"]["instance_id"] = serde_json::json!({"$ref": id});
        assert!(
            Catalog::new(changed).is_err(),
            "unregistered reference: {id}"
        );
        assert!(
            Catalog::new(vec![
                serde_json::json!({"$id":"urn:japp:schema:service:health:v1","$ref":id})
            ])
            .is_err()
        );
    }
}

#[test]
fn every_native_automatic_retry_code_remains_safe_in_canonical_catalog() {
    let c = catalog();
    let data: Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../packages/contracts/catalog/error-catalog.v1.json"
    )))
    .unwrap();
    let mut enabled = 0;
    for entry in data["entries"].as_array().unwrap() {
        let code = entry["code"].as_str().unwrap();
        if c.safe_retry(code) {
            assert_eq!(entry["retry_disposition"], "SAFE_RETRY");
            enabled += 1;
        }
    }
    assert_eq!(enabled, 1);
}

#[test]
fn canonical_error_records_reject_unknown_code_origin_echo_and_correlation() {
    let c = catalog();
    let base = serde_json::json!({"envelope":{"schema_id":"urn:japp:schema:error:record:v1","schema_version":"1.0.0","message_id":"msg_00000000000000000000000003","created_at":"2026-10-18T12:00:00.000Z","correlation_id":"corr_00000000000000000000000002"},"payload":{"error_id":"err_00000000000000000000000003","code":"TRANSPORT_SERVICE_UNAVAILABLE","origin":"ORCHESTRATOR","occurred_at":"2026-10-18T12:00:00.000Z","correlation_id":"corr_00000000000000000000000002"}});
    assert_eq!(
        c.error(
            &serde_json::to_vec(&base).unwrap(),
            "corr_00000000000000000000000002"
        )
        .unwrap()
        .0
        .as_str(),
        "TRANSPORT_SERVICE_UNAVAILABLE"
    );
    for (field, bad) in [
        ("code", "PRIVATE_FREEFORM_ERROR"),
        ("origin", "DESKTOP_APP"),
        ("correlation_id", "corr_00000000000000000000000009"),
        ("message", "private@example.invalid"),
    ] {
        let mut value = base.clone();
        value["payload"][field] = serde_json::json!(bad);
        assert!(
            c.error(
                &serde_json::to_vec(&value).unwrap(),
                "corr_00000000000000000000000002"
            )
            .is_err(),
            "{field}"
        );
    }
}
#[test]
fn canonical_patch_compatibility_does_not_allow_float_generation_coercion() {
    let c = catalog();
    let mut value = fixture();
    value["envelope"]["schema_version"] = serde_json::json!("1.0.9");
    assert!(
        c.validate(
            &serde_json::to_vec(&value).unwrap(),
            "health",
            "corr_00000000000000000000000002",
            "svc_00000000000000000000000001",
            7
        )
        .is_ok()
    );
    value["payload"]["generation"] = serde_json::json!(7.0);
    assert!(
        c.validate(
            &serde_json::to_vec(&value).unwrap(),
            "health",
            "corr_00000000000000000000000002",
            "svc_00000000000000000000000001",
            7
        )
        .is_err()
    );
}
