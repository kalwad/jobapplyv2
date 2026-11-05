use crate::api_client::proof::{Context, Secret, mac, request_transcript, response_transcript};
use serde_json::Value;

fn vector() -> Value {
    serde_json::from_str(include_str!("fixtures/health-proof.v1.json")).unwrap()
}
fn context(v: &Value) -> Context {
    Context::new(
        v["context"]["instance_id"].as_str().unwrap(),
        7,
        "127.0.0.1:40001".parse().unwrap(),
        "127.0.0.1:80".parse().unwrap(),
    )
    .unwrap()
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[test]
fn python_rust_request_and_response_golden_vectors_match_exactly() {
    let v = vector();
    let key = Secret::from_hex(v["token_hex"].as_str().unwrap()).unwrap();
    let ctx = context(&v);
    let request = request_transcript(
        &ctx,
        v["nonce"].as_str().unwrap(),
        v["correlation_id"].as_str().unwrap(),
    )
    .unwrap();
    assert_eq!(hex(&request), v["request_transcript_hex"]);
    assert_eq!(mac(&key, &request), v["request_mac"]);
    let response = response_transcript(
        &ctx,
        &request,
        200,
        v["response_body_utf8"].as_str().unwrap().as_bytes(),
        "urn:japp:schema:service:health:v1",
        "1.0.0",
        v["correlation_id"].as_str().unwrap(),
    )
    .unwrap();
    assert_eq!(hex(&response), v["response_transcript_hex"]);
    assert_eq!(mac(&key, &response), v["response_mac"]);
}
#[test]
fn changing_either_tcp_endpoint_prevents_relay_authentication() {
    let v = vector();
    let key = Secret::from_hex(v["token_hex"].as_str().unwrap()).unwrap();
    for (local, remote) in [
        ("127.0.0.1:40002", "127.0.0.1:80"),
        ("127.0.0.1:40001", "127.0.0.1:81"),
    ] {
        let ctx = Context::new(
            v["context"]["instance_id"].as_str().unwrap(),
            7,
            local.parse().unwrap(),
            remote.parse().unwrap(),
        )
        .unwrap();
        let request = request_transcript(
            &ctx,
            v["nonce"].as_str().unwrap(),
            v["correlation_id"].as_str().unwrap(),
        )
        .unwrap();
        assert_ne!(mac(&key, &request), v["request_mac"]);
    }
}
#[test]
fn invalid_secret_nonce_identity_and_nonloopback_context_fail_closed() {
    for secret in ["a".repeat(63), "A".repeat(64), "g".repeat(64)] {
        assert!(Secret::from_hex(&secret).is_err());
    }
    let v = vector();
    let ctx = context(&v);
    for nonce in ["b".repeat(63), "B".repeat(64), "g".repeat(64)] {
        assert!(request_transcript(&ctx, &nonce, v["correlation_id"].as_str().unwrap()).is_err());
    }
    for host in ["0.0.0.0:40001", "127.0.0.2:40001", "[::1]:40001"] {
        assert!(
            Context::new(
                v["context"]["instance_id"].as_str().unwrap(),
                7,
                host.parse().unwrap(),
                "127.0.0.1:80".parse().unwrap()
            )
            .is_err()
        );
    }
    assert!(
        Context::new(
            "svc_bad",
            7,
            "127.0.0.1:40001".parse().unwrap(),
            "127.0.0.1:80".parse().unwrap()
        )
        .is_err()
    );
}
