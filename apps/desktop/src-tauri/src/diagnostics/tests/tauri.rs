use crate::api_client::client::{Cancellation, Session};
use crate::diagnostics::{
    commands::{self, DiagnosticsState},
    core::engine::{DiagnosticReader, Engine, ReadFuture, SessionSource, Snapshot},
};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::Arc};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    test::{INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets},
    webview::InvokeRequest,
};
use tauri_utils::{
    acl::{capability::Capability, manifest::Manifest, resolved::Resolved},
    platform::Target,
};
static UNLISTED_CALLS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
#[tauri::command]
fn unlisted_probe() -> &'static str {
    UNLISTED_CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    "UNSAFE_REGISTERED_COMMAND_REACHED"
}
struct Source;
impl SessionSource for Source {
    fn snapshot(&self) -> Snapshot {
        Snapshot::Unavailable("STARTING")
    }
}
struct NoWork;
impl DiagnosticReader for NoWork {
    fn read<'a>(&'a self, _: Arc<Session>, _: Cancellation, _: &'a str) -> ReadFuture<'a> {
        Box::pin(async { panic!("Unavailable native service must never perform HTTP") })
    }
}
fn app() -> tauri::App<tauri::test::MockRuntime> {
    let acl: BTreeMap<String, Manifest> =
        serde_json::from_str(include_str!("../../../gen/schemas/acl-manifests.json")).unwrap();
    let capabilities: BTreeMap<String, Capability> =
        serde_json::from_str(include_str!("../../../gen/schemas/capabilities.json")).unwrap();
    let resolved = Resolved::resolve(&acl, capabilities, Target::current()).unwrap();
    assert!(resolved.has_app_acl);
    let mut context = mock_context(noop_assets());
    *context.runtime_authority_mut() = tauri::runtime_authority!(acl, resolved);
    mock_builder()
        .manage(DiagnosticsState(Arc::new(
            Engine::new(Arc::new(Source), Arc::new(NoWork)).unwrap(),
        )))
        .invoke_handler(tauri::generate_handler![
            commands::read_service_diagnostics,
            commands::cancel_service_request,
            unlisted_probe
        ])
        .build(context)
        .unwrap()
}
fn request(cmd: &str, url: &str, body: InvokeBody) -> InvokeRequest {
    InvokeRequest {
        cmd: cmd.into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: url.parse().unwrap(),
        body,
        headers: Default::default(),
        invoke_key: INVOKE_KEY.into(),
    }
}
const ID: &str = "req_00000000000000000000000001";
#[test]
fn actual_app_manifest_acl_allows_only_two_commands_on_local_main() {
    let _declared_command: fn() -> &'static str = unlisted_probe;
    let app = app();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let read = get_ipc_response(
        &window,
        request(
            "read_service_diagnostics",
            "tauri://localhost",
            InvokeBody::Json(json!({"request_id":ID})),
        ),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(read["payload"]["state"], "STARTING");
    assert_eq!(read["payload"]["request_id"], ID);
    let cancel = get_ipc_response(
        &window,
        request(
            "cancel_service_request",
            "tauri://localhost",
            InvokeBody::Json(json!({"request_id":ID})),
        ),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(cancel["payload"]["outcome"], "ALREADY_FINISHED");
    assert!(
        get_ipc_response(
            &window,
            request(
                "unlisted_probe",
                "tauri://localhost",
                InvokeBody::Json(json!({}))
            )
        )
        .is_err()
    );
    assert_eq!(UNLISTED_CALLS.load(std::sync::atomic::Ordering::SeqCst), 0);
    assert!(
        get_ipc_response(
            &window,
            request(
                "arbitrary_http",
                "tauri://localhost",
                InvokeBody::Json(json!({"url":"private"}))
            )
        )
        .is_err()
    );
}
#[test]
fn actual_acl_rejects_other_windows_and_remote_invocation_origins() {
    let app = app();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let other = tauri::WebviewWindowBuilder::new(&app, "secondary", Default::default())
        .build()
        .unwrap();
    for cmd in ["read_service_diagnostics", "cancel_service_request"] {
        assert!(
            get_ipc_response(
                &other,
                request(
                    cmd,
                    "tauri://localhost",
                    InvokeBody::Json(json!({"request_id":ID}))
                )
            )
            .is_err()
        );
        assert!(
            get_ipc_response(
                &window,
                request(
                    cmd,
                    "https://private.example/secret",
                    InvokeBody::Json(json!({"request_id":ID}))
                )
            )
            .is_err()
        );
    }
}
#[test]
fn actual_command_rejects_extra_top_level_fields_and_raw_payload() {
    let app = app();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    for body in [
        InvokeBody::Json(json!({"request_id":ID,"url":"http://127.0.0.1:1"})),
        InvokeBody::Json(json!({"request_id":ID,"token":"private"})),
        InvokeBody::Raw(vec![1, 2, 3]),
    ] {
        let error = get_ipc_response(
            &window,
            request("read_service_diagnostics", "tauri://localhost", body),
        )
        .unwrap_err();
        assert_eq!(error["payload"]["code"], "TRANSPORT_MALFORMED_MESSAGE");
        assert!(!error.to_string().contains("private"));
    }
}
#[test]
fn policy_bytes_keep_main_local_only_and_ipc_only_csp() {
    let mut actual: Value =
        serde_json::from_str(include_str!("../../../capabilities/main-shell.json")).unwrap();
    let generated: Value =
        serde_json::from_str(include_str!("../../../gen/schemas/capabilities.json")).unwrap();
    actual.as_object_mut().unwrap().remove("$schema");
    assert_eq!(actual, generated["main-shell"]);
    assert_eq!(actual["local"], true);
    assert_eq!(actual["windows"], json!(["main"]));
    assert!(actual.get("remote").is_none());
    assert_eq!(
        actual["permissions"],
        json!([
            "core:app:allow-version",
            "core:app:allow-tauri-version",
            "allow-read-service-diagnostics",
            "allow-cancel-service-request"
        ])
    );
    let config: Value = serde_json::from_str(include_str!("../../../tauri.conf.json")).unwrap();
    let csp = config["app"]["security"]["csp"].as_str().unwrap();
    assert!(
        csp.split(';')
            .map(str::trim)
            .any(|d| d == "connect-src ipc: http://ipc.localhost")
    );
    for bad in ["*", "127.0.0.1", "https:", "unsafe-eval", "unsafe-inline"] {
        assert!(!csp.contains(bad));
    }
}
