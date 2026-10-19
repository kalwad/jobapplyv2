//! Strict duplicate-key parsing and offline canonical JSON Schema validation.
use super::{Failure, RemoteCode};
use jsonschema::{Draft, Retrieve, Uri, Validator};
use serde::{
    Deserialize, Deserializer,
    de::{self, MapAccess, SeqAccess, Visitor},
};
use serde_json::{Map, Number, Value, json};
use std::{collections::HashMap, fmt, sync::Arc};

#[derive(Clone)]
struct Offline(Arc<HashMap<String, Value>>);
impl Retrieve for Offline {
    fn retrieve(
        &self,
        uri: &Uri<String>,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        self.0
            .get(uri.as_str())
            .cloned()
            .ok_or_else(|| std::io::Error::other("unavailable canonical schema").into())
    }
}
pub struct Catalog {
    envelope: Validator,
    payload: HashMap<String, Validator>,
}
impl Catalog {
    pub fn new(documents: Vec<Value>) -> Result<Self, Failure> {
        if documents.is_empty() || documents.len() > 64 {
            return Err(Failure::Malformed);
        }
        let mut map = HashMap::new();
        for document in documents {
            let id = document
                .get("$id")
                .and_then(Value::as_str)
                .ok_or(Failure::Malformed)?
                .to_owned();
            if !id.starts_with("urn:japp:schema:") || map.insert(id, document).is_some() {
                return Err(Failure::Malformed);
            }
        }
        let map = Arc::new(map);
        let compile = |schema: &Value| {
            jsonschema::options()
                .with_draft(Draft::Draft202012)
                .should_validate_formats(true)
                .with_retriever(Offline(Arc::clone(&map)))
                .build(schema)
                .map_err(|_| Failure::Malformed)
        };
        let envelope =
            compile(&json!({"$ref":"urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord"}))?;
        let mut payload = HashMap::new();
        for id in [
            "urn:japp:schema:service:health:v1",
            "urn:japp:schema:service:ready:v1",
            "urn:japp:schema:service:version:v1",
            "urn:japp:schema:error:record:v1",
        ] {
            payload.insert(id.into(), compile(map.get(id).ok_or(Failure::Malformed)?)?);
        }
        Ok(Self { envelope, payload })
    }
    fn record(&self, bytes: &[u8], schema: &str, correlation: &str) -> Result<Value, Failure> {
        let value = parse(bytes)?;
        if !self.envelope.is_valid(&value) {
            return Err(Failure::Malformed);
        }
        let meta = value.get("envelope").ok_or(Failure::Malformed)?;
        if meta.get("schema_id").and_then(Value::as_str) != Some(schema) {
            return Err(Failure::Schema);
        }
        let version = meta
            .get("schema_version")
            .and_then(Value::as_str)
            .ok_or(Failure::Schema)?;
        let parts = version
            .split('.')
            .map(str::parse::<u32>)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| Failure::Schema)?;
        if parts.len() != 3 || parts[0] != 1 || parts[1] != 0 {
            return Err(Failure::Schema);
        }
        if meta.get("correlation_id").and_then(Value::as_str) != Some(correlation) {
            return Err(Failure::Identity);
        }
        if !self
            .payload
            .get(schema)
            .ok_or(Failure::Schema)?
            .is_valid(&value["payload"])
        {
            return Err(Failure::Malformed);
        }
        Ok(value)
    }
    pub fn validate(
        &self,
        bytes: &[u8],
        operation: &str,
        correlation: &str,
        instance: &str,
        generation: u32,
    ) -> Result<Value, Failure> {
        if !["health", "ready", "version"].contains(&operation) {
            return Err(Failure::Schema);
        }
        let value = self.record(
            bytes,
            &format!("urn:japp:schema:service:{operation}:v1"),
            correlation,
        )?;
        if value["payload"]["instance_id"].as_str() != Some(instance)
            || value["payload"]["generation"].as_u64() != Some(u64::from(generation))
        {
            return Err(Failure::Identity);
        }
        Ok(value)
    }
    pub fn safe_retry(&self, code: &str) -> bool {
        code == "TRANSPORT_SERVICE_UNAVAILABLE"
    }
    pub fn error(&self, bytes: &[u8], correlation: &str) -> Result<(RemoteCode, Value), Failure> {
        let value = self.record(bytes, "urn:japp:schema:error:record:v1", correlation)?;
        if value["payload"]["origin"].as_str() != Some("ORCHESTRATOR")
            || value["payload"]["correlation_id"].as_str() != Some(correlation)
        {
            return Err(Failure::Identity);
        }
        let code = RemoteCode::validated(
            value["payload"]["code"]
                .as_str()
                .ok_or(Failure::Malformed)?
                .to_owned(),
        );
        Ok((code, value))
    }
}
struct Strict(Value);
impl<'de> Deserialize<'de> for Strict {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(StrictVisitor)
    }
}
struct StrictVisitor;
impl<'de> Visitor<'de> for StrictVisitor {
    type Value = Strict;
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("strict JSON value")
    }
    fn visit_bool<E: de::Error>(self, v: bool) -> Result<Strict, E> {
        Ok(Strict(Value::Bool(v)))
    }
    fn visit_i64<E: de::Error>(self, v: i64) -> Result<Strict, E> {
        Ok(Strict(Value::Number(v.into())))
    }
    fn visit_u64<E: de::Error>(self, v: u64) -> Result<Strict, E> {
        Ok(Strict(Value::Number(v.into())))
    }
    fn visit_f64<E: de::Error>(self, v: f64) -> Result<Strict, E> {
        Number::from_f64(v)
            .map(|n| Strict(Value::Number(n)))
            .ok_or_else(|| E::custom("invalid JSON number"))
    }
    fn visit_str<E: de::Error>(self, v: &str) -> Result<Strict, E> {
        Ok(Strict(Value::String(v.into())))
    }
    fn visit_string<E: de::Error>(self, v: String) -> Result<Strict, E> {
        Ok(Strict(Value::String(v)))
    }
    fn visit_unit<E: de::Error>(self) -> Result<Strict, E> {
        Ok(Strict(Value::Null))
    }
    fn visit_none<E: de::Error>(self) -> Result<Strict, E> {
        Ok(Strict(Value::Null))
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Strict, A::Error> {
        let mut values = Vec::new();
        while let Some(Strict(v)) = a.next_element()? {
            values.push(v);
        }
        Ok(Strict(Value::Array(values)))
    }
    fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<Strict, A::Error> {
        let mut object = Map::new();
        while let Some((k, Strict(v))) = a.next_entry::<String, Strict>()? {
            if object.insert(k, v).is_some() {
                return Err(de::Error::custom("duplicate JSON field"));
            }
        }
        Ok(Strict(Value::Object(object)))
    }
}
fn parse(bytes: &[u8]) -> Result<Value, Failure> {
    let mut decoder = serde_json::Deserializer::from_slice(bytes);
    let Strict(value) = Strict::deserialize(&mut decoder).map_err(|_| Failure::Malformed)?;
    decoder.end().map_err(|_| Failure::Malformed)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::{Offline, Retrieve, Uri};
    use serde_json::Value;
    use std::{collections::HashMap, sync::Arc};

    #[test]
    fn private_offline_retriever_rejects_unregistered_http_and_file_without_io() {
        let documents: Vec<Value> = crate::api_client::tests::canonical_documents();
        let map: HashMap<String, Value> = documents
            .into_iter()
            .map(|document| (document["$id"].as_str().unwrap().to_owned(), document))
            .collect();
        let resolver = Offline(Arc::new(map));
        let known = Uri::parse("urn:japp:schema:service:health:v1".to_owned()).unwrap();
        assert_eq!(resolver.retrieve(&known).unwrap()["$id"], known.as_str());
        for text in [
            "https://example.invalid/private.json",
            "file:///private/data.json",
        ] {
            let uri = Uri::parse(text.to_owned()).unwrap();
            let error = resolver.retrieve(&uri).unwrap_err();
            // This exact error originates inside the shipping private resolver;
            // it proves that policy rejection was reached, with no URL/file I/O.
            assert_eq!(error.to_string(), "unavailable canonical schema");
        }
    }
}
