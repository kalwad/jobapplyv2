//! Raw-payload commands retain the native ACL and actual window/origin guards.
use super::core::engine::Engine;
use serde_json::Value;
use std::sync::Arc;
use tauri::{
    Runtime, State, WebviewWindow,
    ipc::{InvokeBody, Request},
};
pub struct DiagnosticsState(pub Arc<Engine>);
fn body(request: &Request<'_>) -> Value {
    match request.body() {
        InvokeBody::Json(value) => super::core::parse_request(value)
            .map(|id| serde_json::json!({"request_id":id}))
            .unwrap_or(Value::Null),
        InvokeBody::Raw(_) => Value::Null,
    }
}
#[tauri::command]
pub async fn read_service_diagnostics<R: Runtime>(
    window: WebviewWindow<R>,
    state: State<'_, DiagnosticsState>,
    request: Request<'_>,
) -> Result<Value, Value> {
    let value = body(&request);
    let origin = window.url().map(|url| url.to_string()).unwrap_or_default();
    let label = window.label().to_owned();
    let engine = Arc::clone(&state.0);
    engine.read(&label, &origin, tauri::is_dev(), &value).await
}
#[tauri::command]
pub fn cancel_service_request<R: Runtime>(
    window: WebviewWindow<R>,
    state: State<'_, DiagnosticsState>,
    request: Request<'_>,
) -> Result<Value, Value> {
    let value = body(&request);
    let origin = window.url().map(|url| url.to_string()).unwrap_or_default();
    state
        .0
        .cancel(window.label(), &origin, tauri::is_dev(), &value)
}
