use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

pub const MAX_FRAME_BYTES: usize = 4096;

#[derive(Debug)]
pub struct ProtocolError;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ServiceIdentity {
    pub instance_id: String,
    pub generation: u32,
    pub bind_port: u16,
}

// Deliberately no Debug/Display implementation: this private transport holds a secret.
#[derive(Serialize)]
pub struct Bootstrap<'a> {
    protocol: &'static str,
    schema_version: &'static str,
    bind_host: &'static str,
    bind_port: u16,
    session_token: &'a str,
    instance_id: &'a str,
    generation: u32,
}

impl<'a> Bootstrap<'a> {
    pub fn new(identity: &'a ServiceIdentity, secret: &'a str) -> Result<Self, ProtocolError> {
        if identity.bind_port == 0
            || identity.generation > i32::MAX as u32
            || !valid_instance(&identity.instance_id)
            || secret.len() != 64
            || !secret
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(ProtocolError);
        }
        Ok(Self {
            protocol: "JAPP_SERVICE_BOOTSTRAP_V1",
            schema_version: "1.0.0",
            bind_host: "127.0.0.1",
            bind_port: identity.bind_port,
            session_token: secret,
            instance_id: &identity.instance_id,
            generation: identity.generation,
        })
    }

    pub fn write_to(&self, target: &mut dyn Write) -> Result<(), ProtocolError> {
        let bytes = serde_json::to_vec(self).map_err(|_| ProtocolError)?;
        if bytes.len() > MAX_FRAME_BYTES {
            return Err(ProtocolError);
        }
        target
            .write_all(&(bytes.len() as u32).to_be_bytes())
            .map_err(|_| ProtocolError)?;
        target.write_all(&bytes).map_err(|_| ProtocolError)?;
        target.flush().map_err(|_| ProtocolError)
    }
}

#[derive(Deserialize, Debug, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReadyFrame {
    protocol: String,
    schema_version: String,
    status: String,
    bind_host: String,
    bind_port: u16,
    instance_id: String,
    generation: u32,
}

impl ReadyFrame {
    pub fn read_from(source: &mut dyn Read) -> Result<Self, ProtocolError> {
        let mut header = [0_u8; 4];
        source.read_exact(&mut header).map_err(|_| ProtocolError)?;
        let length = u32::from_be_bytes(header) as usize;
        if length == 0 || length > MAX_FRAME_BYTES {
            return Err(ProtocolError);
        }
        let mut body = vec![0; length];
        source.read_exact(&mut body).map_err(|_| ProtocolError)?;
        serde_json::from_slice(&body).map_err(|_| ProtocolError)
    }
    pub fn matches(&self, identity: &ServiceIdentity) -> bool {
        self.protocol == "JAPP_SERVICE_STATUS_V1"
            && self.schema_version == "1.0.0"
            && self.status == "READY"
            && self.bind_host == "127.0.0.1"
            && self.bind_port == identity.bind_port
            && self.bind_port != 0
            && self.instance_id == identity.instance_id
            && valid_instance(&self.instance_id)
            && self.generation == identity.generation
            && self.generation <= i32::MAX as u32
    }
}

fn valid_instance(value: &str) -> bool {
    value.strip_prefix("svc_").is_some_and(|body| {
        body.len() == 26
            && body
                .bytes()
                .all(|byte| b"0123456789ABCDEFGHJKMNPQRSTVWXYZ".contains(&byte))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    fn identity() -> ServiceIdentity {
        ServiceIdentity {
            instance_id: "svc_00000000000000000000000001".into(),
            generation: 1,
            bind_port: 4763,
        }
    }
    fn encoded(body: &str) -> Vec<u8> {
        let mut bytes = (body.len() as u32).to_be_bytes().to_vec();
        bytes.extend(body.as_bytes());
        bytes
    }
    #[test]
    fn bootstrap_is_exact_bounded_private_schema() {
        let i = identity();
        let secret = "a".repeat(64);
        let mut bytes = Vec::new();
        Bootstrap::new(&i, &secret)
            .unwrap()
            .write_to(&mut bytes)
            .unwrap();
        assert_eq!(
            u32::from_be_bytes(bytes[..4].try_into().unwrap()) as usize,
            bytes.len() - 4
        );
        let value: serde_json::Value = serde_json::from_slice(&bytes[4..]).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 7);
        assert_eq!(value["protocol"], "JAPP_SERVICE_BOOTSTRAP_V1");
        assert_eq!(value["bind_host"], "127.0.0.1");
        assert_eq!(value["session_token"], secret);
    }
    #[test]
    fn malformed_private_bootstrap_is_rejected() {
        let i = identity();
        for secret in [
            "a".repeat(63),
            "a".repeat(65),
            "A".repeat(64),
            "z".repeat(64),
        ] {
            assert!(Bootstrap::new(&i, &secret).is_err());
        }
        for i in [
            ServiceIdentity {
                bind_port: 0,
                ..identity()
            },
            ServiceIdentity {
                generation: u32::MAX,
                ..identity()
            },
            ServiceIdentity {
                instance_id: "svc_INVALID".into(),
                ..identity()
            },
        ] {
            assert!(Bootstrap::new(&i, &"a".repeat(64)).is_err());
        }
    }
    #[test]
    fn zero_oversized_and_truncated_frames_are_rejected_without_payload_allocation() {
        for bytes in [
            0u32.to_be_bytes().to_vec(),
            4097u32.to_be_bytes().to_vec(),
            vec![0, 0, 1],
            vec![0, 0, 0, 2, b'{'],
        ] {
            assert!(ReadyFrame::read_from(&mut Cursor::new(bytes)).is_err());
        }
    }
    #[test]
    fn unknown_and_duplicate_ready_fields_are_rejected() {
        let valid = r#"{"protocol":"JAPP_SERVICE_STATUS_V1","schema_version":"1.0.0","status":"READY","bind_host":"127.0.0.1","bind_port":4763,"instance_id":"svc_00000000000000000000000001","generation":1}"#;
        assert!(
            ReadyFrame::read_from(&mut Cursor::new(encoded(valid)))
                .unwrap()
                .matches(&identity())
        );
        for body in [
            valid.replace("\"generation\":1", "\"generation\":1,\"generation\":2"),
            valid.replace(
                "\"generation\":1",
                "\"generation\":1,\"session_token\":\"forbidden\"",
            ),
        ] {
            assert!(ReadyFrame::read_from(&mut Cursor::new(encoded(&body))).is_err());
        }
    }
    #[test]
    fn owned_ready_ack_rejects_wrong_address_port_instance_protocol_or_status() {
        let body = r#"{"protocol":"JAPP_SERVICE_STATUS_V1","schema_version":"1.0.0","status":"READY","bind_host":"127.0.0.1","bind_port":4763,"instance_id":"svc_00000000000000000000000001","generation":1}"#;
        for altered in [
            body.replace("127.0.0.1", "0.0.0.0"),
            body.replace("4763", "4764"),
            body.replace("00000001", "00000002"),
            body.replace("READY", "STARTING"),
            body.replace("1.0.0", "2.0.0"),
            body.replace("JAPP_SERVICE_STATUS_V1", "UNTRUSTED"),
        ] {
            assert!(
                !ReadyFrame::read_from(&mut Cursor::new(encoded(&altered)))
                    .unwrap()
                    .matches(&identity())
            );
        }
    }
}
