//! Application commands must have generated ACL entries; no default bypass.
pub const SERVICE_COMMANDS: &[&str] = &["read_service_diagnostics", "cancel_service_request"];
