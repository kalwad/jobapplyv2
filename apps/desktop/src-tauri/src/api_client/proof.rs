//! The finite, domain-separated wire profile shared with Python.
use super::Failure;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

pub const AUTH_VERSION: &str = "1.0.0";
pub const AUTH_SCHEME: &str = "JAPP-HMAC-SHA256-V1 ";
pub struct Secret([u8; 32]);
impl Secret {
    pub fn from_hex(value: &str) -> Result<Self, Failure> {
        Ok(Self(decode_hex(value)?))
    }
    pub(crate) fn raw_hex(&self) -> String {
        hex(&self.0)
    }
}
#[derive(Clone, Debug)]
pub struct Context {
    pub instance_id: String,
    pub generation: u32,
    pub local: SocketAddr,
    pub remote: SocketAddr,
}
impl Context {
    pub fn new(
        instance: &str,
        generation: u32,
        local: SocketAddr,
        remote: SocketAddr,
    ) -> Result<Self, Failure> {
        if !valid_instance(instance)
            || generation > i32::MAX as u32
            || [local, remote]
                .iter()
                .any(|a| a.ip() != IpAddr::V4(Ipv4Addr::LOCALHOST) || a.port() == 0)
        {
            return Err(Failure::Malformed);
        }
        Ok(Self {
            instance_id: instance.into(),
            generation,
            local,
            remote,
        })
    }
    fn fields(&self) -> Vec<String> {
        vec![
            self.instance_id.clone(),
            self.generation.to_string(),
            self.local.ip().to_string(),
            self.local.port().to_string(),
            self.remote.ip().to_string(),
            self.remote.port().to_string(),
        ]
    }
}
pub fn valid_stable(value: &str) -> bool {
    if value.len() > 64 {
        return false;
    }
    let Some((prefix, id)) = value.split_once('_') else {
        return false;
    };
    prefix
        .bytes()
        .next()
        .is_some_and(|b| b.is_ascii_lowercase())
        && prefix.split('-').all(|p| {
            !p.is_empty()
                && p.bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
        && id.len() == 26
        && id
            .bytes()
            .all(|b| b"0123456789ABCDEFGHJKMNPQRSTVWXYZ".contains(&b))
}
fn valid_instance(value: &str) -> bool {
    value.starts_with("svc_") && valid_stable(value)
}
pub fn decode_hex(value: &str) -> Result<[u8; 32], Failure> {
    if value.len() != 64 {
        return Err(Failure::Malformed);
    }
    let mut result = [0; 32];
    fn nibble(b: u8) -> Option<u8> {
        match b {
            b'0'..=b'9' => Some(b - b'0'),
            b'a'..=b'f' => Some(b - b'a' + 10),
            _ => None,
        }
    }
    for (i, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        result[i] = (nibble(pair[0]).ok_or(Failure::Malformed)? << 4)
            | nibble(pair[1]).ok_or(Failure::Malformed)?;
    }
    Ok(result)
}
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
pub fn sha256(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}
fn frame(fields: Vec<String>) -> Result<Vec<u8>, Failure> {
    let mut result = Vec::new();
    for field in fields {
        if !field.is_ascii() || field.len() > 256 {
            return Err(Failure::Malformed);
        }
        result.extend((field.len() as u32).to_be_bytes());
        result.extend(field.as_bytes());
    }
    Ok(result)
}
pub fn request_transcript(
    context: &Context,
    nonce: &str,
    correlation: &str,
) -> Result<Vec<u8>, Failure> {
    decode_hex(nonce)?;
    if !valid_stable(correlation) {
        return Err(Failure::Malformed);
    }
    let mut fields = vec![
        "JAPP_HTTP_AUTH_REQUEST_V1".into(),
        AUTH_VERSION.into(),
        "GET".into(),
        "/api/v1/health".into(),
        sha256(b""),
        nonce.into(),
        correlation.into(),
    ];
    fields.extend(context.fields());
    frame(fields)
}
pub fn response_transcript(
    context: &Context,
    request: &[u8],
    status: u16,
    body: &[u8],
    schema_id: &str,
    schema_version: &str,
    correlation: &str,
) -> Result<Vec<u8>, Failure> {
    let mut fields = vec![
        "JAPP_HTTP_AUTH_RESPONSE_V1".into(),
        AUTH_VERSION.into(),
        sha256(request),
        status.to_string(),
        sha256(body),
        schema_id.into(),
        schema_version.into(),
        correlation.into(),
    ];
    fields.extend(context.fields());
    frame(fields)
}
pub fn mac(secret: &Secret, bytes: &[u8]) -> String {
    let mut h = Hmac::<Sha256>::new_from_slice(&secret.0).expect("fixed-size HMAC key");
    h.update(bytes);
    hex(&h.finalize().into_bytes())
}
pub fn verify(secret: &Secret, bytes: &[u8], signature: &str) -> Result<(), Failure> {
    let signature = decode_hex(signature).map_err(|_| Failure::Unauthenticated)?;
    let mut h = Hmac::<Sha256>::new_from_slice(&secret.0).expect("fixed-size HMAC key");
    h.update(bytes);
    h.verify_slice(&signature)
        .map_err(|_| Failure::Unauthenticated)
}
