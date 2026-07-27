//! Isolated M01-W05 test-only Rust compatibility adapter.
//!
//! This binary loads committed schemas/catalogs locally, validates a bounded
//! batch, and exits. It is deliberately private, has no network resolver, and
//! exposes no production contract or native-host behavior.

use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    path::{Path, PathBuf},
};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use jsonschema::{Draft, Registry};
use serde::{
    Deserialize, Deserializer, Serialize,
    de::{self, MapAccess, SeqAccess, Visitor},
};
use serde_json::{Map, Number, Value, json};

const PROTOCOL_VERSION: &str = "JAPP_CONTRACT_ADAPTER_V1";
const MAX_CASES: usize = 256;
const MAX_PROTOCOL_BYTES: usize = 4 * 1024 * 1024;
const MAX_RAW_BYTES: usize = 1024 * 1024;
const MAX_DEPTH: usize = 64;
const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
const AUTHORIZATION_REQUEST_REF: &str = "urn:japp:schema:security:authorization-request:v1";
const ENVELOPED_RECORD_REF: &str = "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord";

#[derive(Debug, PartialEq, Eq)]
struct AdapterError;

type AdapterResult<T> = Result<T, AdapterError>;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct BatchRequest {
    protocol_version: String,
    requests: Vec<Request>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    case_id: String,
    schema_ref: String,
    operation: Operation,
    input_bytes_base64: String,
    #[serde(default)]
    trusted_context_bytes_base64: Option<String>,
    #[serde(default)]
    scenario: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum Operation {
    Authorize,
    RoundTrip,
    Validate,
    VersionCheck,
}

#[derive(Debug, Serialize)]
struct BatchResponse {
    protocol_version: &'static str,
    language: &'static str,
    results: Vec<CaseResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum ValidationVerdict {
    Valid,
    Invalid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum AuthorizationOutcome {
    Allow,
    Deny,
}

#[derive(Debug, Serialize)]
struct CaseResult {
    case_id: String,
    operation: Operation,
    validation_verdict: ValidationVerdict,
    #[serde(skip_serializing_if = "Option::is_none")]
    canonical_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version_outcome: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    authorization_outcome: Option<AuthorizationOutcome>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
}

impl CaseResult {
    fn invalid(request: &Request, category: &str) -> Self {
        Self {
            case_id: request.case_id.clone(),
            operation: request.operation,
            validation_verdict: ValidationVerdict::Invalid,
            canonical_json: None,
            error_category: Some(category.to_owned()),
            version_outcome: None,
            authorization_outcome: None,
            error_code: None,
        }
    }
}

#[derive(Debug, Clone)]
struct StrictValue(Value);

struct StrictValueVisitor;

impl<'de> Visitor<'de> for StrictValueVisitor {
    type Value = StrictValue;

    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("one bounded JSON value")
    }

    fn visit_bool<E>(self, value: bool) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(StrictValue(Value::Bool(value)))
    }

    fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        if value.unsigned_abs() > MAX_SAFE_INTEGER {
            return Err(E::custom("NUMBER_OUT_OF_RANGE"));
        }
        Ok(StrictValue(Value::Number(Number::from(value))))
    }

    fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        if value > MAX_SAFE_INTEGER {
            return Err(E::custom("NUMBER_OUT_OF_RANGE"));
        }
        Ok(StrictValue(Value::Number(Number::from(value))))
    }

    fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        if !value.is_finite() || (value.fract() == 0.0 && value.abs() > MAX_SAFE_INTEGER as f64) {
            return Err(E::custom("NUMBER_OUT_OF_RANGE"));
        }
        Number::from_f64(value)
            .map(|number| StrictValue(Value::Number(number)))
            .ok_or_else(|| E::custom("NUMBER_OUT_OF_RANGE"))
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(StrictValue(Value::String(value.to_owned())))
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(StrictValue(Value::String(value)))
    }

    fn visit_none<E>(self) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(StrictValue(Value::Null))
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(StrictValue(Value::Null))
    }

    fn visit_seq<A>(self, mut sequence: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element::<StrictValue>()? {
            values.push(value.0);
        }
        Ok(StrictValue(Value::Array(values)))
    }

    fn visit_map<A>(self, mut object: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut values = Map::new();
        while let Some(key) = object.next_key::<String>()? {
            if values.contains_key(&key) {
                return Err(de::Error::custom("DUPLICATE_KEY"));
            }
            if matches!(key.as_str(), "__proto__" | "constructor" | "prototype") {
                return Err(de::Error::custom("FORBIDDEN_PROPERTY_NAME"));
            }
            let value = object.next_value::<StrictValue>()?;
            values.insert(key, value.0);
        }
        Ok(StrictValue(Value::Object(values)))
    }
}

impl<'de> Deserialize<'de> for StrictValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(StrictValueVisitor)
    }
}

fn value_depth(value: &Value, depth: usize) -> AdapterResult<()> {
    if depth > MAX_DEPTH {
        return Err(AdapterError);
    }
    match value {
        Value::Array(items) => {
            for item in items {
                value_depth(item, depth + 1)?;
            }
        }
        Value::Object(items) => {
            for item in items.values() {
                value_depth(item, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn escaped_lone_surrogate(text: &str) -> bool {
    let bytes = text.as_bytes();
    let mut index = 0;
    while index + 6 <= bytes.len() {
        if bytes[index] != b'\\' || bytes[index + 1] != b'u' {
            index += 1;
            continue;
        }
        let Ok(hex) = std::str::from_utf8(&bytes[index + 2..index + 6]) else {
            return true;
        };
        let Ok(code) = u16::from_str_radix(hex, 16) else {
            index += 1;
            continue;
        };
        if (0xD800..=0xDBFF).contains(&code) {
            if index + 12 > bytes.len() || bytes[index + 6] != b'\\' || bytes[index + 7] != b'u' {
                return true;
            }
            let Ok(low_hex) = std::str::from_utf8(&bytes[index + 8..index + 12]) else {
                return true;
            };
            let Ok(low) = u16::from_str_radix(low_hex, 16) else {
                return true;
            };
            if !(0xDC00..=0xDFFF).contains(&low) {
                return true;
            }
            index += 12;
        } else if (0xDC00..=0xDFFF).contains(&code) {
            return true;
        } else {
            index += 6;
        }
    }
    false
}

fn raw_category(raw: &[u8]) -> Result<Value, &'static str> {
    if raw.len() > MAX_RAW_BYTES {
        return Err("INPUT_TOO_LARGE");
    }
    let text = std::str::from_utf8(raw).map_err(|_| "INVALID_UTF8")?;
    if escaped_lone_surrogate(text) {
        return Err("INVALID_UNICODE");
    }
    match serde_json::from_slice::<StrictValue>(raw) {
        Ok(value) => {
            if value_depth(&value.0, 0).is_err() {
                Err("MAX_DEPTH_EXCEEDED")
            } else {
                Ok(value.0)
            }
        }
        Err(error) => {
            let stable = error.to_string();
            if stable.contains("DUPLICATE_KEY") {
                Err("DUPLICATE_KEY")
            } else if stable.contains("FORBIDDEN_PROPERTY_NAME") {
                Err("FORBIDDEN_PROPERTY_NAME")
            } else if stable.contains("NUMBER_OUT_OF_RANGE")
                || stable.contains("number out of range")
            {
                Err("NUMBER_OUT_OF_RANGE")
            } else if stable.contains("surrogate") || stable.contains("unicode code point") {
                Err("INVALID_UNICODE")
            } else {
                Err("MALFORMED_JSON")
            }
        }
    }
}

#[derive(Debug)]
struct SchemaEntry {
    id: String,
    version: String,
    document: Value,
}

#[derive(Debug)]
struct Catalog {
    entries: Vec<SchemaEntry>,
    by_id: BTreeMap<String, usize>,
}

fn collect_schema_paths(root: &Path, paths: &mut Vec<PathBuf>) -> AdapterResult<()> {
    let entries = fs::read_dir(root).map_err(|_| AdapterError)?;
    for entry in entries {
        let entry = entry.map_err(|_| AdapterError)?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|_| AdapterError)?;
        if file_type.is_symlink() {
            return Err(AdapterError);
        }
        if file_type.is_dir() {
            collect_schema_paths(&path, paths)?;
        } else if file_type.is_file()
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".schema.json"))
        {
            paths.push(path);
        } else {
            return Err(AdapterError);
        }
    }
    Ok(())
}

fn load_catalog(repo: &Path) -> AdapterResult<Catalog> {
    let root = repo.join("packages/contracts/schemas");
    let mut paths = Vec::new();
    collect_schema_paths(&root, &mut paths)?;
    paths.sort();
    let mut entries = Vec::new();
    let mut by_id = BTreeMap::new();
    for path in paths {
        let document: Value = serde_json::from_slice(&fs::read(path).map_err(|_| AdapterError)?)
            .map_err(|_| AdapterError)?;
        let id = document
            .get("$id")
            .and_then(Value::as_str)
            .ok_or(AdapterError)?
            .to_owned();
        let version = document
            .get("x-japp-schema-version")
            .and_then(Value::as_str)
            .ok_or(AdapterError)?
            .to_owned();
        if by_id.insert(id.clone(), entries.len()).is_some() {
            return Err(AdapterError);
        }
        entries.push(SchemaEntry {
            id,
            version,
            document,
        });
    }
    if entries.is_empty() {
        return Err(AdapterError);
    }
    Ok(Catalog { entries, by_id })
}

fn ref_exists(catalog: &Catalog, schema_ref: &str) -> bool {
    let (id, fragment) = schema_ref
        .split_once('#')
        .map_or((schema_ref, None), |(id, pointer)| (id, Some(pointer)));
    let Some(index) = catalog.by_id.get(id) else {
        return false;
    };
    let document = &catalog.entries[*index].document;
    match fragment {
        None => document.get("type").is_some(),
        Some(pointer) => {
            let Some(name) = pointer.strip_prefix("/$defs/") else {
                return false;
            };
            document
                .get("$defs")
                .and_then(Value::as_object)
                .is_some_and(|definitions| definitions.contains_key(name))
        }
    }
}

fn local_registry<'a>(catalog: &'a Catalog) -> AdapterResult<Registry<'a>> {
    let mut registry = Registry::new();
    for entry in &catalog.entries {
        registry = registry
            .add(entry.id.as_str(), &entry.document)
            .map_err(|_| AdapterError)?;
    }
    registry.prepare().map_err(|_| AdapterError)
}

fn schema_valid(catalog: &Catalog, schema_ref: &str, value: &Value) -> AdapterResult<bool> {
    if !ref_exists(catalog, schema_ref) {
        return Err(AdapterError);
    }
    let registry = local_registry(catalog)?;
    let wrapper = json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$ref": schema_ref
    });
    let validator = jsonschema::options()
        .with_draft(Draft::Draft202012)
        .should_validate_formats(true)
        .with_registry(&registry)
        .build(&wrapper)
        .map_err(|_| AdapterError)?;
    Ok(validator.is_valid(value))
}

fn enum_strings(value: &Value) -> AdapterResult<Vec<String>> {
    value
        .as_array()
        .ok_or(AdapterError)?
        .iter()
        .map(|token| token.as_str().map(str::to_owned).ok_or(AdapterError))
        .collect()
}

fn verify_typed_vocabularies(catalog: &Catalog) -> AdapterResult<()> {
    let fixture = &catalog.entries[*catalog
        .by_id
        .get("urn:japp:schema:fixture:test-record:v1")
        .ok_or(AdapterError)?]
    .document;
    let fixture_status = enum_strings(&fixture["properties"]["status"]["enum"])?;
    if fixture_status != FixtureStatus::TOKENS {
        return Err(AdapterError);
    }
    let error = &catalog.entries[*catalog
        .by_id
        .get("urn:japp:schema:error:taxonomy:v1")
        .ok_or(AdapterError)?]
    .document;
    let mut error_origins = enum_strings(&error["$defs"]["errorOrigin"]["enum"])?;
    error_origins.sort();
    if error_origins != ErrorOrigin::TOKENS {
        return Err(AdapterError);
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Money {
    amount: String,
    currency: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Location {
    country: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    region: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    locality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    postal_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Provenance {
    source_kind: String,
    source_id: String,
    observed_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source_digest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    confidence: Option<Number>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Redaction {
    sensitivity: String,
    policy: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FixtureStatus {
    Active,
    Archived,
}

impl FixtureStatus {
    const TOKENS: [&'static str; 2] = ["ACTIVE", "ARCHIVED"];
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct FixtureRecord {
    record_id: String,
    captured_at: String,
    effective_date: String,
    budget: Money,
    location: Location,
    provenance: Provenance,
    match_confidence: Number,
    redaction: Redaction,
    status: FixtureStatus,
    superseded_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    legacy_tag: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum ErrorOrigin {
    DesktopApp,
    ExtensionContentScript,
    ExtensionServiceWorker,
    NativeHost,
    Orchestrator,
    ModelRuntime,
    PlatformAdapter,
    PublicJobIndex,
    VerificationHarness,
}

impl ErrorOrigin {
    const TOKENS: [&'static str; 9] = [
        "DESKTOP_APP",
        "EXTENSION_CONTENT_SCRIPT",
        "EXTENSION_SERVICE_WORKER",
        "MODEL_RUNTIME",
        "NATIVE_HOST",
        "ORCHESTRATOR",
        "PLATFORM_ADAPTER",
        "PUBLIC_JOB_INDEX",
        "VERIFICATION_HARNESS",
    ];
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ErrorRecord {
    error_id: String,
    code: String,
    occurred_at: String,
    origin: ErrorOrigin,
    correlation_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    causation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    diagnostic_digest: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct EnvelopeMetadata {
    schema_id: String,
    schema_version: String,
    message_id: String,
    created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    correlation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    causation_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    extensions: Option<BTreeMap<String, Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct EnvelopedRecord {
    envelope: EnvelopeMetadata,
    payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct AuthorizationRequest {
    request_version: String,
    request_id: String,
    command_id: String,
    originating_principal: String,
    immediate_sender: String,
    target_principal: String,
    authorization_profile: String,
    occurred_at: String,
    correlation_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    causation_id: Option<String>,
    payload_size_bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    payload_digest: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    idempotency_key: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RuntimeContext {
    receiving_principal: String,
    authenticated_sender_principal: String,
    authenticated_originating_principal: String,
    active_profile: String,
    observed_payload_size_bytes: u64,
}

#[derive(Debug, Deserialize)]
struct CapabilityDocument {
    principals: Vec<IdEntry>,
    profiles: Vec<IdEntry>,
    capabilities: Vec<IdEntry>,
}

#[derive(Debug, Deserialize)]
struct IdEntry {
    id: String,
}

#[derive(Debug, Deserialize)]
struct CommandDocument {
    commands: Vec<Command>,
}

#[derive(Debug, Deserialize)]
struct Command {
    id: String,
    required_capability: String,
    intended_target: String,
    supported_profiles: Vec<String>,
    max_encoded_payload_size_bytes: u64,
    idempotency_expectation: String,
    denial_error_code: String,
}

#[derive(Debug, Deserialize)]
struct PolicyDocument {
    allow: Vec<PolicyRow>,
}

#[derive(Debug, Deserialize)]
struct PolicyRow {
    authorization_profile: String,
    command_id: String,
    originating_principal: String,
    immediate_sender: String,
    receiving_principal: String,
    target_principal: String,
}

#[derive(Debug)]
struct SecurityData {
    commands: BTreeMap<String, Command>,
    allow: Vec<PolicyRow>,
    error_codes: BTreeSet<String>,
    principal_ids: BTreeSet<String>,
    profile_ids: BTreeSet<String>,
    capability_ids: BTreeSet<String>,
}

fn read_json<T: for<'de> Deserialize<'de>>(path: PathBuf) -> AdapterResult<T> {
    serde_json::from_slice(&fs::read(path).map_err(|_| AdapterError)?).map_err(|_| AdapterError)
}

fn load_security_data(repo: &Path) -> AdapterResult<SecurityData> {
    let catalog_root = repo.join("packages/contracts/catalog");
    let capability_document: CapabilityDocument =
        read_json(catalog_root.join("capability-catalog.v1.json"))?;
    let command_document: CommandDocument =
        read_json(catalog_root.join("command-catalog.v1.json"))?;
    let policy_document: PolicyDocument =
        read_json(catalog_root.join("authorization-policy.v1.json"))?;
    let error_document: Value = read_json(catalog_root.join("error-catalog.v1.json"))?;
    let error_codes = error_document
        .get("entries")
        .and_then(Value::as_array)
        .ok_or(AdapterError)?
        .iter()
        .map(|entry| {
            entry
                .get("code")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .ok_or(AdapterError)
        })
        .collect::<AdapterResult<BTreeSet<_>>>()?;
    let collect_ids = |entries: Vec<IdEntry>| -> AdapterResult<BTreeSet<String>> {
        let mut result = BTreeSet::new();
        for entry in entries {
            if entry.id.is_empty() || !result.insert(entry.id) {
                return Err(AdapterError);
            }
        }
        Ok(result)
    };
    let principal_ids = collect_ids(capability_document.principals)?;
    let profile_ids = collect_ids(capability_document.profiles)?;
    let capability_ids = collect_ids(capability_document.capabilities)?;
    let mut commands = BTreeMap::new();
    for command in command_document.commands {
        if !capability_ids.contains(&command.required_capability)
            || !principal_ids.contains(&command.intended_target)
            || command
                .supported_profiles
                .iter()
                .any(|profile| !profile_ids.contains(profile))
            || !error_codes.contains(&command.denial_error_code)
            || commands.insert(command.id.clone(), command).is_some()
        {
            return Err(AdapterError);
        }
    }
    for row in &policy_document.allow {
        if !profile_ids.contains(&row.authorization_profile)
            || !commands.contains_key(&row.command_id)
            || !principal_ids.contains(&row.originating_principal)
            || !principal_ids.contains(&row.immediate_sender)
            || !principal_ids.contains(&row.receiving_principal)
            || !principal_ids.contains(&row.target_principal)
        {
            return Err(AdapterError);
        }
    }
    Ok(SecurityData {
        commands,
        allow: policy_document.allow,
        error_codes,
        principal_ids,
        profile_ids,
        capability_ids,
    })
}

fn typed_round_trip(schema_ref: &str, value: Value) -> AdapterResult<Value> {
    match schema_ref {
        "urn:japp:schema:fixture:test-record:v1" => {
            let typed: FixtureRecord = serde_json::from_value(value).map_err(|_| AdapterError)?;
            serde_json::to_value(typed).map_err(|_| AdapterError)
        }
        "urn:japp:schema:error:record:v1" => {
            let typed: ErrorRecord = serde_json::from_value(value).map_err(|_| AdapterError)?;
            serde_json::to_value(typed).map_err(|_| AdapterError)
        }
        AUTHORIZATION_REQUEST_REF => {
            let typed: AuthorizationRequest =
                serde_json::from_value(value).map_err(|_| AdapterError)?;
            serde_json::to_value(typed).map_err(|_| AdapterError)
        }
        ENVELOPED_RECORD_REF => {
            let typed: EnvelopedRecord = serde_json::from_value(value).map_err(|_| AdapterError)?;
            serde_json::to_value(typed).map_err(|_| AdapterError)
        }
        _ => Err(AdapterError),
    }
}

fn sorted_value(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(sorted_value).collect()),
        Value::Object(items) => {
            let mut result = Map::new();
            let mut keys: Vec<&String> = items.keys().collect();
            keys.sort_by(|left, right| left.as_bytes().cmp(right.as_bytes()));
            for key in keys {
                result.insert(key.clone(), sorted_value(&items[key]));
            }
            Value::Object(result)
        }
        _ => value.clone(),
    }
}

fn canonical(value: &Value) -> AdapterResult<String> {
    value_depth(value, 0)?;
    serde_json::to_string(&sorted_value(value)).map_err(|_| AdapterError)
}

fn validate_or_round_trip(request: &Request, value: Value, catalog: &Catalog) -> CaseResult {
    if request.schema_ref.starts_with("http:") || request.schema_ref.starts_with("https:") {
        return CaseResult::invalid(request, "REMOTE_SCHEMA_REFERENCE");
    }
    if !ref_exists(catalog, &request.schema_ref) {
        return CaseResult::invalid(request, "UNKNOWN_SCHEMA_REFERENCE");
    }
    if schema_valid(catalog, &request.schema_ref, &value) != Ok(true) {
        return CaseResult::invalid(request, "SCHEMA_INVALID");
    }
    let canonical_json = if matches!(request.operation, Operation::RoundTrip) {
        match typed_round_trip(&request.schema_ref, value).and_then(|wire| canonical(&wire)) {
            Ok(output) => Some(output),
            Err(_) => return CaseResult::invalid(request, "TYPED_ROUND_TRIP_REJECTED"),
        }
    } else {
        None
    };
    CaseResult {
        case_id: request.case_id.clone(),
        operation: request.operation,
        validation_verdict: ValidationVerdict::Valid,
        canonical_json,
        error_category: None,
        version_outcome: None,
        authorization_outcome: None,
        error_code: None,
    }
}

fn semver(value: &str) -> Option<(u64, u64, u64)> {
    let mut parts = value.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() || format!("{major}.{minor}.{patch}") != value {
        return None;
    }
    Some((major, minor, patch))
}

fn version_result(request: &Request, value: &Value, catalog: &Catalog) -> CaseResult {
    let Some(envelope) = value.get("envelope").and_then(Value::as_object) else {
        let mut result = CaseResult::invalid(request, "SCHEMA_INVALID");
        result.version_outcome = Some("MALFORMED_VERSION".to_owned());
        return result;
    };
    let Some(schema_id) = envelope.get("schema_id").and_then(Value::as_str) else {
        let mut result = CaseResult::invalid(request, "UNKNOWN_SCHEMA_REFERENCE");
        result.version_outcome = Some("UNKNOWN_SCHEMA_ID".to_owned());
        return result;
    };
    let Some(declared_text) = envelope.get("schema_version").and_then(Value::as_str) else {
        let mut result = CaseResult::invalid(request, "SCHEMA_INVALID");
        result.version_outcome = Some("MALFORMED_VERSION".to_owned());
        return result;
    };
    let Some(declared) = semver(declared_text) else {
        let mut result = CaseResult::invalid(request, "SCHEMA_INVALID");
        result.version_outcome = Some("MALFORMED_VERSION".to_owned());
        return result;
    };
    let Some(index) = catalog.by_id.get(schema_id) else {
        let mut result = CaseResult::invalid(request, "UNKNOWN_SCHEMA_REFERENCE");
        result.version_outcome = Some("UNKNOWN_SCHEMA_ID".to_owned());
        return result;
    };
    let Some(supported) = semver(&catalog.entries[*index].version) else {
        return CaseResult::invalid(request, "ADAPTER_CONFIGURATION_INVALID");
    };
    if declared.0 != supported.0 {
        let mut result = CaseResult::invalid(request, "VERSION_REJECTED");
        result.version_outcome = Some("UNKNOWN_MAJOR_VERSION".to_owned());
        return result;
    }
    if declared.1 > supported.1 {
        let mut result = CaseResult::invalid(request, "VERSION_REJECTED");
        result.version_outcome = Some("UPGRADE_REQUIRED_NEWER_MINOR".to_owned());
        return result;
    }
    if schema_valid(catalog, ENVELOPED_RECORD_REF, value) != Ok(true) {
        let mut result = CaseResult::invalid(request, "SCHEMA_INVALID");
        result.version_outcome = Some("MALFORMED_VERSION".to_owned());
        return result;
    }
    let Some(payload) = value.get("payload") else {
        let mut result = CaseResult::invalid(request, "SCHEMA_INVALID");
        result.version_outcome = Some("PAYLOAD_INVALID".to_owned());
        return result;
    };
    if schema_valid(catalog, schema_id, payload) != Ok(true) {
        let mut result = CaseResult::invalid(request, "SCHEMA_INVALID");
        result.version_outcome = Some("PAYLOAD_INVALID".to_owned());
        return result;
    }
    let canonical_json = match typed_round_trip(ENVELOPED_RECORD_REF, value.clone())
        .and_then(|wire| canonical(&wire))
    {
        Ok(output) => output,
        Err(_) => return CaseResult::invalid(request, "TYPED_ROUND_TRIP_REJECTED"),
    };
    CaseResult {
        case_id: request.case_id.clone(),
        operation: request.operation,
        validation_verdict: ValidationVerdict::Valid,
        canonical_json: Some(canonical_json),
        error_category: None,
        version_outcome: Some("COMPATIBLE".to_owned()),
        authorization_outcome: None,
        error_code: None,
    }
}

fn denied(
    request: &Request,
    valid: bool,
    error_code: &str,
    canonical_json: Option<String>,
    security: &SecurityData,
) -> CaseResult {
    if !security.error_codes.contains(error_code) {
        return CaseResult::invalid(request, "ADAPTER_CONFIGURATION_INVALID");
    }
    CaseResult {
        case_id: request.case_id.clone(),
        operation: request.operation,
        validation_verdict: if valid {
            ValidationVerdict::Valid
        } else {
            ValidationVerdict::Invalid
        },
        canonical_json,
        error_category: Some("AUTHORIZATION_DENIED".to_owned()),
        version_outcome: None,
        authorization_outcome: Some(AuthorizationOutcome::Deny),
        error_code: Some(error_code.to_owned()),
    }
}

fn authorization_result(
    request: &Request,
    value: Value,
    catalog: &Catalog,
    security: &SecurityData,
) -> CaseResult {
    let valid = schema_valid(catalog, AUTHORIZATION_REQUEST_REF, &value) == Ok(true);
    if !valid {
        return denied(
            request,
            false,
            "TRANSPORT_MALFORMED_MESSAGE",
            None,
            security,
        );
    }
    let Ok(auth_request) = serde_json::from_value::<AuthorizationRequest>(value) else {
        return denied(
            request,
            false,
            "TRANSPORT_MALFORMED_MESSAGE",
            None,
            security,
        );
    };
    let canonical_json = match serde_json::to_value(&auth_request)
        .map_err(|_| AdapterError)
        .and_then(|wire| canonical(&wire))
    {
        Ok(output) => output,
        Err(_) => return CaseResult::invalid(request, "TYPED_ROUND_TRIP_REJECTED"),
    };
    let Some(context_encoded) = &request.trusted_context_bytes_base64 else {
        return denied(
            request,
            true,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    };
    let Ok(context_bytes) = BASE64.decode(context_encoded) else {
        return denied(
            request,
            true,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    };
    let Ok(context_value) = raw_category(&context_bytes) else {
        return denied(
            request,
            true,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    };
    let Ok(context) = serde_json::from_value::<RuntimeContext>(context_value) else {
        return denied(
            request,
            true,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    };
    if context.observed_payload_size_bytes > MAX_SAFE_INTEGER
        || !security
            .principal_ids
            .contains(&context.receiving_principal)
        || !security
            .principal_ids
            .contains(&context.authenticated_sender_principal)
        || !security
            .principal_ids
            .contains(&context.authenticated_originating_principal)
        || !security.profile_ids.contains(&context.active_profile)
    {
        return denied(
            request,
            true,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    }
    if auth_request.immediate_sender != context.authenticated_sender_principal
        || auth_request.originating_principal != context.authenticated_originating_principal
        || auth_request.authorization_profile != context.active_profile
    {
        return denied(
            request,
            true,
            "TRANSPORT_FORBIDDEN",
            Some(canonical_json),
            security,
        );
    }
    if auth_request.payload_size_bytes != context.observed_payload_size_bytes {
        return denied(
            request,
            true,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    }
    let Some(command) = security.commands.get(&auth_request.command_id) else {
        return denied(
            request,
            false,
            "TRANSPORT_MALFORMED_MESSAGE",
            Some(canonical_json),
            security,
        );
    };
    if !security
        .capability_ids
        .contains(&command.required_capability)
    {
        return CaseResult::invalid(request, "ADAPTER_CONFIGURATION_INVALID");
    }
    if command.id == "SUBMISSION_FINAL_SUBMIT" {
        return denied(
            request,
            true,
            "SUBMISSION_PROHIBITED_FINAL_ACTION",
            Some(canonical_json),
            security,
        );
    }
    if auth_request.target_principal != command.intended_target {
        return denied(
            request,
            true,
            "TRANSPORT_FORBIDDEN",
            Some(canonical_json),
            security,
        );
    }
    if !command
        .supported_profiles
        .contains(&auth_request.authorization_profile)
    {
        return denied(
            request,
            true,
            &command.denial_error_code,
            Some(canonical_json),
            security,
        );
    }
    if context.observed_payload_size_bytes > command.max_encoded_payload_size_bytes {
        return denied(
            request,
            true,
            "TRANSPORT_PAYLOAD_TOO_LARGE",
            Some(canonical_json),
            security,
        );
    }
    if command.idempotency_expectation == "IDEMPOTENCY_KEY_REQUIRED"
        && auth_request.idempotency_key.is_none()
    {
        return denied(
            request,
            true,
            "VALIDATION_MISSING_REQUIRED_DATA",
            Some(canonical_json),
            security,
        );
    }
    let allowed = security.allow.iter().any(|row| {
        row.authorization_profile == auth_request.authorization_profile
            && row.command_id == auth_request.command_id
            && row.originating_principal == auth_request.originating_principal
            && row.immediate_sender == auth_request.immediate_sender
            && row.receiving_principal == context.receiving_principal
            && row.target_principal == auth_request.target_principal
    });
    if !allowed {
        return denied(
            request,
            true,
            &command.denial_error_code,
            Some(canonical_json),
            security,
        );
    }
    CaseResult {
        case_id: request.case_id.clone(),
        operation: request.operation,
        validation_verdict: ValidationVerdict::Valid,
        canonical_json: Some(canonical_json),
        error_category: None,
        version_outcome: None,
        authorization_outcome: Some(AuthorizationOutcome::Allow),
        error_code: None,
    }
}

fn process_request(request: &Request, catalog: &Catalog, security: &SecurityData) -> CaseResult {
    if request.scenario.is_some() {
        return CaseResult::invalid(request, "PROTOCOL_REJECTED");
    }
    let Ok(raw) = BASE64.decode(&request.input_bytes_base64) else {
        return CaseResult::invalid(request, "PROTOCOL_REJECTED");
    };
    let value = match raw_category(&raw) {
        Ok(value) => value,
        Err(category) => {
            let mut result = CaseResult::invalid(request, category);
            if matches!(request.operation, Operation::Authorize) {
                result.authorization_outcome = Some(AuthorizationOutcome::Deny);
                result.error_code = Some("TRANSPORT_MALFORMED_MESSAGE".to_owned());
            }
            return result;
        }
    };
    match request.operation {
        Operation::Authorize => authorization_result(request, value, catalog, security),
        Operation::VersionCheck => version_result(request, &value, catalog),
        Operation::RoundTrip | Operation::Validate => {
            validate_or_round_trip(request, value, catalog)
        }
    }
}

fn parse_args() -> AdapterResult<(PathBuf, PathBuf)> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 5 || args[1] != "--request" || args[3] != "--repo-root" {
        return Err(AdapterError);
    }
    Ok((PathBuf::from(&args[2]), PathBuf::from(&args[4])))
}

fn parse_batch(path: &Path) -> AdapterResult<BatchRequest> {
    let bytes = fs::read(path).map_err(|_| AdapterError)?;
    if bytes.len() > MAX_PROTOCOL_BYTES {
        return Err(AdapterError);
    }
    let batch: BatchRequest = serde_json::from_slice(&bytes).map_err(|_| AdapterError)?;
    if batch.protocol_version != PROTOCOL_VERSION
        || batch.requests.is_empty()
        || batch.requests.len() > MAX_CASES
    {
        return Err(AdapterError);
    }
    let mut previous = "";
    for request in &batch.requests {
        if request.case_id.is_empty()
            || (!previous.is_empty() && previous >= request.case_id.as_str())
            || request.schema_ref.is_empty()
            || request.input_bytes_base64.is_empty()
            || BASE64.decode(&request.input_bytes_base64).is_err()
            || request
                .trusted_context_bytes_base64
                .as_ref()
                .is_some_and(|value| BASE64.decode(value).is_err())
        {
            return Err(AdapterError);
        }
        previous = &request.case_id;
    }
    Ok(batch)
}

fn run() -> AdapterResult<()> {
    let (request_path, repo) = parse_args()?;
    let batch = parse_batch(&request_path)?;
    let catalog = load_catalog(&repo)?;
    verify_typed_vocabularies(&catalog)?;
    let security = load_security_data(&repo)?;
    let response = BatchResponse {
        protocol_version: PROTOCOL_VERSION,
        language: "rust",
        results: batch
            .requests
            .iter()
            .map(|request| process_request(request, &catalog, &security))
            .collect(),
    };
    let output_value = serde_json::to_value(response).map_err(|_| AdapterError)?;
    let output = canonical(&output_value)?;
    if output.len() > MAX_PROTOCOL_BYTES {
        return Err(AdapterError);
    }
    println!("{output}");
    Ok(())
}

fn main() {
    if run().is_err() {
        std::process::exit(2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repository_root() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(5)
            .expect("test harness location is fixed beneath repository root")
            .to_path_buf()
    }

    fn definition_enum(repo: &Path, relative: &str, definition: &str) -> Vec<String> {
        let document: Value = read_json(repo.join(relative)).expect("schema reads");
        document["$defs"][definition]["enum"]
            .as_array()
            .expect("enum exists")
            .iter()
            .map(|token| token.as_str().expect("string token").to_owned())
            .collect()
    }

    fn fixture_status_enum(repo: &Path) -> Vec<String> {
        let document: Value =
            read_json(repo.join("packages/contracts/schemas/fixture/test-record.v1.schema.json"))
                .expect("schema reads");
        document["properties"]["status"]["enum"]
            .as_array()
            .expect("enum exists")
            .iter()
            .map(|token| token.as_str().expect("string token").to_owned())
            .collect()
    }

    #[test]
    fn test_only_enum_vocabulary_matches_canonical_schemas() {
        let repo = repository_root();
        assert_eq!(FixtureStatus::TOKENS.to_vec(), fixture_status_enum(&repo));
        let mut expected = definition_enum(
            &repo,
            "packages/contracts/schemas/error/taxonomy.v1.schema.json",
            "errorOrigin",
        );
        expected.sort();
        assert_eq!(ErrorOrigin::TOKENS.to_vec(), expected);
    }

    #[test]
    fn typed_representative_records_reject_unknown_fields() {
        let value = json!({
            "record_id": "rec_0123456789ABCDEFGHJKMNPQRS",
            "captured_at": "2026-07-27T04:00:00Z",
            "effective_date": "2026-07-27",
            "budget": {"amount": "1.00", "currency": "USD"},
            "location": {"country": "US"},
            "provenance": {
                "source_kind": "GENERATED",
                "source_id": "src_0123456789ABCDEFGHJKMNPQRS",
                "observed_at": "2026-07-27T04:00:00Z"
            },
            "match_confidence": 1,
            "redaction": {"sensitivity": "PERSONAL", "policy": "REDACT_VALUE"},
            "status": "ACTIVE",
            "superseded_by": null,
            "unexpected": true
        });
        assert!(serde_json::from_value::<FixtureRecord>(value).is_err());
    }

    #[test]
    fn raw_policy_rejects_duplicate_keys_and_unsafe_numbers() {
        assert_eq!(
            raw_category(br#"{"x":1,"x":2}"#).expect_err("duplicate rejects"),
            "DUPLICATE_KEY"
        );
        assert_eq!(
            raw_category(br#"9007199254740992"#).expect_err("unsafe rejects"),
            "NUMBER_OUT_OF_RANGE"
        );
    }

    #[test]
    fn local_draft_2020_12_catalog_validates_without_remote_resolution() {
        let repo = repository_root();
        let catalog = load_catalog(&repo).expect("catalog loads");
        assert_eq!(
            schema_valid(
                &catalog,
                "urn:japp:schema:common:confidence:v1#/$defs/confidence",
                &json!(0.5)
            ),
            Ok(true)
        );
        assert!(!ref_exists(
            &catalog,
            "https://synthetic.invalid/remote.schema.json"
        ));
    }

    #[test]
    fn canonical_security_data_loads_and_is_nonempty() {
        let security = load_security_data(&repository_root()).expect("security data loads");
        assert_eq!(security.commands.len(), 24);
        assert_eq!(security.allow.len(), 127);
        assert_eq!(security.error_codes.len(), 80);
        assert_eq!(security.principal_ids.len(), 9);
        assert_eq!(security.profile_ids.len(), 4);
        assert_eq!(security.capability_ids.len(), 18);
    }
}
