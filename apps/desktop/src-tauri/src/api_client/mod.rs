//! Native-owned W04 core. Tauri/IPC integration is deliberately separate.
pub mod canonical;
pub mod client;
pub mod proof;
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Failure {
    Cancelled,
    Timeout,
    Disconnected,
    Unauthenticated,
    Malformed,
    Schema,
    Identity,
    PayloadTooLarge,
    Remote(RemoteCode),
}
impl Failure {
    pub fn code(&self) -> Option<&str> {
        Some(match self {
            Self::Cancelled => return None,
            Self::Timeout => "TRANSPORT_TIMEOUT",
            Self::Disconnected => "TRANSPORT_DISCONNECTED",
            Self::Unauthenticated => "TRANSPORT_UNAUTHENTICATED",
            Self::Malformed => "TRANSPORT_MALFORMED_MESSAGE",
            Self::Schema => "VALIDATION_UNSUPPORTED_SCHEMA_VERSION",
            Self::Identity => "TRANSPORT_PROTOCOL_MISMATCH",
            Self::PayloadTooLarge => "TRANSPORT_PAYLOAD_TOO_LARGE",
            Self::Remote(code) => code.as_str(),
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteCode(String);
impl RemoteCode {
    pub fn as_str(&self) -> &str {
        &self.0
    }
    pub(crate) fn validated(value: String) -> Self {
        Self(value)
    }
}

#[cfg(test)]
pub(crate) mod tests;
