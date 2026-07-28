//! Isolated M01-W06 test-only Rust compatibility adapter.
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
const MAX_CASES: usize = 512;
const MAX_PROTOCOL_BYTES: usize = 4 * 1024 * 1024;
const MAX_RAW_BYTES: usize = 1024 * 1024;
const MAX_DEPTH: usize = 64;
const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
const AUTHORIZATION_REQUEST_REF: &str = "urn:japp:schema:security:authorization-request:v1";
const ENVELOPED_RECORD_REF: &str = "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord";
const SEMANTIC_RULE_CATALOG_REF: &str = "urn:japp:schema:semantic:rule-catalog:v1";

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

    fn semantic_invalid(request: &Request, error_code: &str) -> Self {
        let mut result = Self::invalid(request, "SEMANTIC_INVALID");
        result.error_code = Some(error_code.to_owned());
        result
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

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum SemanticRuleKind {
    ApplicationSessionConsistency,
    AtomicClaimIntegrity,
    AtsVariantScope,
    BenchmarkCaseIntegrity,
    BenchmarkResultIntegrity,
    DriverVerifiedEvidence,
    FieldAddressIdentity,
    FieldDecisionAuthority,
    FieldDescriptorObservation,
    GateDecisionIntegrity,
    GateEvidenceCompleteness,
    GuidedRunSafety,
    HoldoutManifestIntegrity,
    InertTextSafety,
    LayoutMeasurementIntegrity,
    NavigationSafety,
    PageReadinessIntegrity,
    PlatformBrowserDiscoverySafety,
    PlatformBrowserRecordScope,
    PlatformCapabilityReportIntegrity,
    PlatformCertificationInputScope,
    PlatformDiagnosticIntegrity,
    PlatformEvidenceIntegrity,
    PlatformModelProfileEvidence,
    PlatformNativeRegistrationBinding,
    PlatformNativeRegistrationResult,
    PlatformPackageStateEvidence,
    PlatformPathRequestSafety,
    PlatformPathResolutionSafety,
    PlatformProcessPlanSafety,
    PlatformProcessStatusIntegrity,
    PlatformRuntimeCapabilityFallback,
    PlatformSecretRequestAuthority,
    PlatformSecretResultIntegrity,
    PlatformTargetSupportClaim,
    ReconciliationReadiness,
    ResumePlanEvidence,
    WorkdayCertificationScope,
    WorkdayStepBoundary,
    WorkdayTenantIdentity,
}

impl SemanticRuleKind {
    const TOKENS: [&'static str; 40] = [
        "APPLICATION_SESSION_CONSISTENCY",
        "ATOMIC_CLAIM_INTEGRITY",
        "ATS_VARIANT_SCOPE",
        "BENCHMARK_CASE_INTEGRITY",
        "BENCHMARK_RESULT_INTEGRITY",
        "DRIVER_VERIFIED_EVIDENCE",
        "FIELD_ADDRESS_IDENTITY",
        "FIELD_DECISION_AUTHORITY",
        "FIELD_DESCRIPTOR_OBSERVATION",
        "GATE_DECISION_INTEGRITY",
        "GATE_EVIDENCE_COMPLETENESS",
        "GUIDED_RUN_SAFETY",
        "HOLDOUT_MANIFEST_INTEGRITY",
        "INERT_TEXT_SAFETY",
        "LAYOUT_MEASUREMENT_INTEGRITY",
        "NAVIGATION_SAFETY",
        "PAGE_READINESS_INTEGRITY",
        "PLATFORM_BROWSER_DISCOVERY_SAFETY",
        "PLATFORM_BROWSER_RECORD_SCOPE",
        "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
        "PLATFORM_CERTIFICATION_INPUT_SCOPE",
        "PLATFORM_DIAGNOSTIC_INTEGRITY",
        "PLATFORM_EVIDENCE_INTEGRITY",
        "PLATFORM_MODEL_PROFILE_EVIDENCE",
        "PLATFORM_NATIVE_REGISTRATION_BINDING",
        "PLATFORM_NATIVE_REGISTRATION_RESULT",
        "PLATFORM_PACKAGE_STATE_EVIDENCE",
        "PLATFORM_PATH_REQUEST_SAFETY",
        "PLATFORM_PATH_RESOLUTION_SAFETY",
        "PLATFORM_PROCESS_PLAN_SAFETY",
        "PLATFORM_PROCESS_STATUS_INTEGRITY",
        "PLATFORM_RUNTIME_CAPABILITY_FALLBACK",
        "PLATFORM_SECRET_REQUEST_AUTHORITY",
        "PLATFORM_SECRET_RESULT_INTEGRITY",
        "PLATFORM_TARGET_SUPPORT_CLAIM",
        "RECONCILIATION_READINESS",
        "RESUME_PLAN_EVIDENCE",
        "WORKDAY_CERTIFICATION_SCOPE",
        "WORKDAY_STEP_BOUNDARY",
        "WORKDAY_TENANT_IDENTITY",
    ];

    fn token(self) -> &'static str {
        match self {
            Self::ApplicationSessionConsistency => "APPLICATION_SESSION_CONSISTENCY",
            Self::AtomicClaimIntegrity => "ATOMIC_CLAIM_INTEGRITY",
            Self::AtsVariantScope => "ATS_VARIANT_SCOPE",
            Self::BenchmarkCaseIntegrity => "BENCHMARK_CASE_INTEGRITY",
            Self::BenchmarkResultIntegrity => "BENCHMARK_RESULT_INTEGRITY",
            Self::DriverVerifiedEvidence => "DRIVER_VERIFIED_EVIDENCE",
            Self::FieldAddressIdentity => "FIELD_ADDRESS_IDENTITY",
            Self::FieldDecisionAuthority => "FIELD_DECISION_AUTHORITY",
            Self::FieldDescriptorObservation => "FIELD_DESCRIPTOR_OBSERVATION",
            Self::GateDecisionIntegrity => "GATE_DECISION_INTEGRITY",
            Self::GateEvidenceCompleteness => "GATE_EVIDENCE_COMPLETENESS",
            Self::GuidedRunSafety => "GUIDED_RUN_SAFETY",
            Self::HoldoutManifestIntegrity => "HOLDOUT_MANIFEST_INTEGRITY",
            Self::InertTextSafety => "INERT_TEXT_SAFETY",
            Self::LayoutMeasurementIntegrity => "LAYOUT_MEASUREMENT_INTEGRITY",
            Self::NavigationSafety => "NAVIGATION_SAFETY",
            Self::PageReadinessIntegrity => "PAGE_READINESS_INTEGRITY",
            Self::PlatformBrowserDiscoverySafety => "PLATFORM_BROWSER_DISCOVERY_SAFETY",
            Self::PlatformBrowserRecordScope => "PLATFORM_BROWSER_RECORD_SCOPE",
            Self::PlatformCapabilityReportIntegrity => "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
            Self::PlatformCertificationInputScope => "PLATFORM_CERTIFICATION_INPUT_SCOPE",
            Self::PlatformDiagnosticIntegrity => "PLATFORM_DIAGNOSTIC_INTEGRITY",
            Self::PlatformEvidenceIntegrity => "PLATFORM_EVIDENCE_INTEGRITY",
            Self::PlatformModelProfileEvidence => "PLATFORM_MODEL_PROFILE_EVIDENCE",
            Self::PlatformNativeRegistrationBinding => "PLATFORM_NATIVE_REGISTRATION_BINDING",
            Self::PlatformNativeRegistrationResult => "PLATFORM_NATIVE_REGISTRATION_RESULT",
            Self::PlatformPackageStateEvidence => "PLATFORM_PACKAGE_STATE_EVIDENCE",
            Self::PlatformPathRequestSafety => "PLATFORM_PATH_REQUEST_SAFETY",
            Self::PlatformPathResolutionSafety => "PLATFORM_PATH_RESOLUTION_SAFETY",
            Self::PlatformProcessPlanSafety => "PLATFORM_PROCESS_PLAN_SAFETY",
            Self::PlatformProcessStatusIntegrity => "PLATFORM_PROCESS_STATUS_INTEGRITY",
            Self::PlatformRuntimeCapabilityFallback => "PLATFORM_RUNTIME_CAPABILITY_FALLBACK",
            Self::PlatformSecretRequestAuthority => "PLATFORM_SECRET_REQUEST_AUTHORITY",
            Self::PlatformSecretResultIntegrity => "PLATFORM_SECRET_RESULT_INTEGRITY",
            Self::PlatformTargetSupportClaim => "PLATFORM_TARGET_SUPPORT_CLAIM",
            Self::ReconciliationReadiness => "RECONCILIATION_READINESS",
            Self::ResumePlanEvidence => "RESUME_PLAN_EVIDENCE",
            Self::WorkdayCertificationScope => "WORKDAY_CERTIFICATION_SCOPE",
            Self::WorkdayStepBoundary => "WORKDAY_STEP_BOUNDARY",
            Self::WorkdayTenantIdentity => "WORKDAY_TENANT_IDENTITY",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SemanticRuleDocument {
    catalog_version: String,
    entries: Vec<SemanticRuleEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SemanticRuleEntry {
    rule_id: String,
    rule_version: String,
    schema_ref: String,
    rule_kind: SemanticRuleKind,
    failure_error_code: String,
}

#[derive(Debug)]
struct SemanticRules {
    entries: Vec<SemanticRuleEntry>,
}

const EXPECTED_PRIMARY_RULE_BINDINGS: [(&str, SemanticRuleKind); 40] = [
    (
        "urn:japp:schema:ats:variant-identity:v1",
        SemanticRuleKind::AtsVariantScope,
    ),
    (
        "urn:japp:schema:benchmark:case:v1",
        SemanticRuleKind::BenchmarkCaseIntegrity,
    ),
    (
        "urn:japp:schema:benchmark:holdout-manifest:v1",
        SemanticRuleKind::HoldoutManifestIntegrity,
    ),
    (
        "urn:japp:schema:benchmark:result:v1",
        SemanticRuleKind::BenchmarkResultIntegrity,
    ),
    (
        "urn:japp:schema:form:driver-result:v1",
        SemanticRuleKind::DriverVerifiedEvidence,
    ),
    (
        "urn:japp:schema:form:field-address:v1",
        SemanticRuleKind::FieldAddressIdentity,
    ),
    (
        "urn:japp:schema:form:field-decision:v1",
        SemanticRuleKind::FieldDecisionAuthority,
    ),
    (
        "urn:japp:schema:form:field-descriptor:v1",
        SemanticRuleKind::FieldDescriptorObservation,
    ),
    (
        "urn:japp:schema:form:reconciliation-inventory:v1",
        SemanticRuleKind::ReconciliationReadiness,
    ),
    (
        "urn:japp:schema:gate:decision:v1",
        SemanticRuleKind::GateDecisionIntegrity,
    ),
    (
        "urn:japp:schema:gate:evidence-bundle:v1",
        SemanticRuleKind::GateEvidenceCompleteness,
    ),
    (
        "urn:japp:schema:platform:browser-discovery-request:v1",
        SemanticRuleKind::PlatformBrowserDiscoverySafety,
    ),
    (
        "urn:japp:schema:platform:browser-record:v1",
        SemanticRuleKind::PlatformBrowserRecordScope,
    ),
    (
        "urn:japp:schema:platform:capability-report:v1",
        SemanticRuleKind::PlatformCapabilityReportIntegrity,
    ),
    (
        "urn:japp:schema:platform:certification-input:v1",
        SemanticRuleKind::PlatformCertificationInputScope,
    ),
    (
        "urn:japp:schema:platform:diagnostic-report:v1",
        SemanticRuleKind::PlatformDiagnosticIntegrity,
    ),
    (
        "urn:japp:schema:platform:evidence-record:v1",
        SemanticRuleKind::PlatformEvidenceIntegrity,
    ),
    (
        "urn:japp:schema:platform:installer-state:v1",
        SemanticRuleKind::PlatformPackageStateEvidence,
    ),
    (
        "urn:japp:schema:platform:model-runtime-profile:v1",
        SemanticRuleKind::PlatformModelProfileEvidence,
    ),
    (
        "urn:japp:schema:platform:native-messaging-registration:v1",
        SemanticRuleKind::PlatformNativeRegistrationBinding,
    ),
    (
        "urn:japp:schema:platform:native-messaging-result:v1",
        SemanticRuleKind::PlatformNativeRegistrationResult,
    ),
    (
        "urn:japp:schema:platform:path-request:v1",
        SemanticRuleKind::PlatformPathRequestSafety,
    ),
    (
        "urn:japp:schema:platform:path-resolution:v1",
        SemanticRuleKind::PlatformPathResolutionSafety,
    ),
    (
        "urn:japp:schema:platform:process-plan:v1",
        SemanticRuleKind::PlatformProcessPlanSafety,
    ),
    (
        "urn:japp:schema:platform:process-status:v1",
        SemanticRuleKind::PlatformProcessStatusIntegrity,
    ),
    (
        "urn:japp:schema:platform:runtime-capability:v1",
        SemanticRuleKind::PlatformRuntimeCapabilityFallback,
    ),
    (
        "urn:japp:schema:platform:secret-store-request:v1",
        SemanticRuleKind::PlatformSecretRequestAuthority,
    ),
    (
        "urn:japp:schema:platform:secret-store-result:v1",
        SemanticRuleKind::PlatformSecretResultIntegrity,
    ),
    (
        "urn:japp:schema:platform:target-identity:v1",
        SemanticRuleKind::PlatformTargetSupportClaim,
    ),
    (
        "urn:japp:schema:platform:update-state:v1",
        SemanticRuleKind::PlatformPackageStateEvidence,
    ),
    (
        "urn:japp:schema:rendering:layout-measurement:v1",
        SemanticRuleKind::LayoutMeasurementIntegrity,
    ),
    (
        "urn:japp:schema:resume:atomic-claim:v1",
        SemanticRuleKind::AtomicClaimIntegrity,
    ),
    (
        "urn:japp:schema:resume:plan:v1",
        SemanticRuleKind::ResumePlanEvidence,
    ),
    (
        "urn:japp:schema:session:application-session:v1",
        SemanticRuleKind::ApplicationSessionConsistency,
    ),
    (
        "urn:japp:schema:session:guided-run-mode:v1",
        SemanticRuleKind::GuidedRunSafety,
    ),
    (
        "urn:japp:schema:session:navigation-record:v1",
        SemanticRuleKind::NavigationSafety,
    ),
    (
        "urn:japp:schema:session:page-readiness-proof:v1",
        SemanticRuleKind::PageReadinessIntegrity,
    ),
    (
        "urn:japp:schema:workday:certification-record:v1",
        SemanticRuleKind::WorkdayCertificationScope,
    ),
    (
        "urn:japp:schema:workday:step-identity:v1",
        SemanticRuleKind::WorkdayStepBoundary,
    ),
    (
        "urn:japp:schema:workday:tenant-fingerprint:v1",
        SemanticRuleKind::WorkdayTenantIdentity,
    ),
];

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

fn expected_semantic_bindings() -> BTreeSet<(String, SemanticRuleKind)> {
    let mut bindings = BTreeSet::new();
    for (schema_ref, primary) in EXPECTED_PRIMARY_RULE_BINDINGS {
        bindings.insert((schema_ref.to_owned(), primary));
        bindings.insert((schema_ref.to_owned(), SemanticRuleKind::InertTextSafety));
    }
    bindings
}

fn load_semantic_rules(
    repo: &Path,
    catalog: &Catalog,
    security: &SecurityData,
) -> AdapterResult<SemanticRules> {
    let path = repo.join("packages/contracts/catalog/semantic-rules.v1.json");
    let bytes = fs::read(path).map_err(|_| AdapterError)?;
    let value = raw_category(&bytes).map_err(|_| AdapterError)?;
    if schema_valid(catalog, SEMANTIC_RULE_CATALOG_REF, &value) != Ok(true) {
        return Err(AdapterError);
    }
    let document: SemanticRuleDocument = serde_json::from_value(value).map_err(|_| AdapterError)?;
    if document.catalog_version != "1.0.0" {
        return Err(AdapterError);
    }

    let rule_schema = &catalog.entries[*catalog
        .by_id
        .get(SEMANTIC_RULE_CATALOG_REF)
        .ok_or(AdapterError)?]
    .document;
    let schema_tokens = enum_strings(&rule_schema["$defs"]["ruleKind"]["enum"])?;
    if schema_tokens != SemanticRuleKind::TOKENS {
        return Err(AdapterError);
    }

    let mut previous = "";
    let mut rule_ids = BTreeSet::new();
    let mut bindings = BTreeSet::new();
    let mut used_kinds = BTreeSet::new();
    for entry in &document.entries {
        if (!previous.is_empty() && previous >= entry.rule_id.as_str())
            || !rule_ids.insert(entry.rule_id.clone())
            || entry.schema_ref.contains('#')
            || !ref_exists(catalog, &entry.schema_ref)
            || !security.error_codes.contains(&entry.failure_error_code)
            || semver(&entry.rule_version).is_none()
            || !bindings.insert((entry.schema_ref.clone(), entry.rule_kind))
        {
            return Err(AdapterError);
        }
        previous = &entry.rule_id;
        used_kinds.insert(entry.rule_kind);
    }
    if bindings != expected_semantic_bindings()
        || used_kinds
            .iter()
            .map(|kind| kind.token())
            .collect::<BTreeSet<_>>()
            != SemanticRuleKind::TOKENS.into_iter().collect()
    {
        return Err(AdapterError);
    }
    Ok(SemanticRules {
        entries: document.entries,
    })
}

macro_rules! wire_record {
    (
        $name:ident {
            $($required:ident: $required_type:ty,)*
        }
        optional {
            $($optional:ident: $optional_type:ty,)*
        }
    ) => {
        #[derive(Debug, Serialize, Deserialize)]
        #[serde(deny_unknown_fields)]
        struct $name {
            $($required: $required_type,)*
            $(
                #[serde(default, skip_serializing_if = "Option::is_none")]
                $optional: Option<$optional_type>,
            )*
        }
    };
}

wire_record! {
    FieldAddress {
        address_schema_version: String,
        session_id: String,
        frame_id: String,
        document_id: String,
        ats_family: String,
        section_path: Vec<Value>,
        repeater_path: Vec<Value>,
        resolution_hints: Vec<Value>,
        observed_dom_generation: u64,
    }
    optional {
        tenant_pattern_id: String,
        route_signature: String,
        application_root_fingerprint: String,
        accessible_name_fingerprint: String,
        attribute_fingerprint: String,
        option_fingerprint: String,
    }
}

wire_record! {
    FieldDescriptor {
        field_id: String,
        address: FieldAddress,
        control_kind: String,
        visible: bool,
        enabled: bool,
        required: bool,
        sensitive_candidate: bool,
        label: Value,
        section_context: Vec<Value>,
        options: Vec<Value>,
        validation_state: Value,
        observed_at: String,
        observed_dom_generation: u64,
    }
    optional {
        description: Value,
        current_value: Value,
    }
}

wire_record! {
    FieldDecision {
        decision_id: String,
        field_id: String,
        field_address_digest: String,
        field_concept: String,
        classification_confidence: Number,
        value_source_type: String,
        value_confidence: Number,
        sensitivity_class: String,
        policy_decision: String,
        final_decision: String,
        confirmation_state: String,
        reason_codes: Vec<String>,
        provenance: Provenance,
        correlation_id: String,
    }
    optional {
        value_source_ref: String,
        user_confirmation_ref: String,
        causation_id: String,
    }
}

wire_record! {
    DriverResult {
        result_id: String,
        driver_id: String,
        session_id: String,
        field_address: FieldAddress,
        resolution_result: String,
        preconditions: Value,
        action_attempt: Value,
        intended_value: Value,
        observed_value_immediate: Value,
        observed_value_settled: Value,
        site_acceptance: String,
        validation_message_digests: Vec<String>,
        conditional_field_ids: Vec<String>,
        starting_dom_generation: u64,
        settled_dom_generation: u64,
        persistence_verified: bool,
        safe_retry_allowed: bool,
        outcome: String,
        reason_codes: Vec<String>,
        correlation_id: String,
    }
    optional {
        recovery: Value,
        causation_id: String,
    }
}

wire_record! {
    ReconciliationInventory {
        inventory_id: String,
        session_id: String,
        page_id: String,
        document_id: String,
        page_generation: u64,
        proof_generation: u64,
        items: Vec<Value>,
        counts: Value,
        readiness: String,
        evidence_digest: String,
        correlation_id: String,
    }
    optional {}
}

wire_record! {
    AtsVariantIdentity {
        variant_identity_id: String,
        ats_family: String,
        adapter_id: String,
        adapter_version: String,
        pattern_id: String,
        locale: String,
        session_mode: String,
        route_page_family: String,
        evidence_digest: String,
        provenance: Provenance,
    }
    optional {
        last_tested_on: String,
    }
}

wire_record! {
    WorkdayTenantFingerprint {
        tenant_fingerprint_id: String,
        hostname_family: String,
        locale: String,
        candidate_session_mode: String,
        route_family: String,
        page_sequence_family: String,
        control_family_inventory: Vec<String>,
        control_family_fingerprint: String,
        tenant_pattern_version: String,
        adapter_version: String,
        browser_compatibility: Value,
        evidence_digest: String,
    }
    optional {
        last_tested_on: String,
    }
}

wire_record! {
    WorkdayStepIdentity {
        step_identity_id: String,
        session_id: String,
        step_family: String,
        boundary_class: String,
        recognition_signals: Vec<Value>,
        recognition_confidence: Number,
        observed_dom_generation: u64,
        recognized_at: String,
        evidence_digest: String,
    }
    optional {}
}

wire_record! {
    WorkdayCertificationRecord {
        certification_record_id: String,
        tenant_fingerprint: WorkdayTenantFingerprint,
        locale: String,
        session_mode: String,
        route_page_sequence: Vec<String>,
        control_families: Vec<String>,
        adapter_version: String,
        browser_version: String,
        platform_profile: Value,
        corpus_manifest_digest: String,
        holdout_manifest_digest: String,
        metrics: Value,
        last_tested_on: String,
        known_limitations: Vec<String>,
        evidence_report_refs: Vec<String>,
        measured_scope_digest: String,
        certified_scope_digest: String,
        certification_state: String,
        provenance: Provenance,
    }
    optional {}
}

wire_record! {
    GuidedRunMode {
        run_mode_id: String,
        run_kind: String,
        start_policy: String,
        snapshot_readiness: Value,
        visible_cancel_control: bool,
        revocation_state: String,
        page_eligibility: String,
        start_permission: String,
    }
    optional {
        prior_opt_in_ref: String,
        certified_pattern_ref: String,
        cancelable_start_ref: String,
    }
}

wire_record! {
    PageReadinessProof {
        proof_id: String,
        proof_version: String,
        session_id: String,
        page_id: String,
        step_identity: WorkdayStepIdentity,
        page_generation: u64,
        reconciliation_digest: String,
        blocking_counts: Value,
        site_validation_status: String,
        created_at: String,
        proof_digest: String,
        readiness: String,
    }
    optional {
        next_control: Value,
        back_control: Value,
    }
}

wire_record! {
    NavigationRecord {
        navigation_record_id: String,
        session_id: String,
        source_step_identity: WorkdayStepIdentity,
        allowed_destination_families: Vec<String>,
        source_page_generation: u64,
        readiness_proof_ref: String,
        readiness_proof_digest: String,
        navigation_control: Value,
        action: String,
        idempotency_key: String,
        initiating_run_kind: String,
        initiating_start_policy: String,
        attempted_at: String,
        postconditions: Value,
        safe_retry_allowed: bool,
        outcome: String,
        reason_codes: Vec<String>,
        correlation_id: String,
    }
    optional {
        expected_destination_family: String,
        observed_destination_identity: WorkdayStepIdentity,
        observed_resulting_generation: u64,
    }
}

wire_record! {
    ApplicationSession {
        session_id: String,
        job_id: String,
        application_id: String,
        ats_variant: AtsVariantIdentity,
        guided_run_mode: GuidedRunMode,
        authorization_profile: String,
        adapter_version: String,
        runtime_metadata: Value,
        snapshot_digests: Value,
        current_step: WorkdayStepIdentity,
        current_page_generation: u64,
        correlation_id: String,
        lifecycle_state: String,
        created_at: String,
        updated_at: String,
        revalidation_state: String,
    }
    optional {
        workday_tenant_fingerprint: WorkdayTenantFingerprint,
        pause_or_cancel_reason: String,
    }
}

wire_record! {
    BenchmarkCase {
        case_id: String,
        case_schema_version: String,
        benchmark_family: String,
        corpus_version: String,
        corpus_digest: String,
        input_artifacts: Vec<Value>,
        expected_behavior: Value,
        threshold_set_ref: String,
        threshold_set_digest: String,
        thresholds: Vec<Value>,
        environment_requirements: Value,
        synthetic_data: bool,
        provenance: Provenance,
        holdout_visibility: String,
        applicable_platform_profiles: Vec<String>,
    }
    optional {}
}

wire_record! {
    BenchmarkResult {
        result_id: String,
        case_id: String,
        case_digest: String,
        repository_commit: String,
        repository_tree: String,
        schema_manifest_digest: String,
        generator_format_version: String,
        corpus_digest: String,
        holdout_manifest_digest: String,
        runtime_metadata: Value,
        started_at: String,
        ended_at: String,
        duration_ms: u64,
        metric_results: Vec<Value>,
        case_threshold_set_digest: String,
        evaluated_threshold_set_digest: String,
        failure_error_codes: Vec<String>,
        artifact_report_digests: Vec<String>,
        completeness_state: String,
        environment_match_state: String,
        hash_state: String,
        holdout_state: String,
        comparable: bool,
        overall_outcome: String,
    }
    optional {
        comparison_baseline_ref: String,
    }
}

wire_record! {
    HoldoutManifest {
        manifest_id: String,
        holdout_format_version: String,
        case_ids: Vec<String>,
        schema_versions: Vec<Value>,
        case_count: u64,
        category_counts: Vec<Value>,
        files: Vec<Value>,
        synthetic_only: bool,
        storage_policy: String,
        visibility_class: String,
        creation_provenance: Provenance,
        review_provenance: Provenance,
        manifest_digest: String,
    }
    optional {
        encrypted_bundle: Value,
    }
}

wire_record! {
    GateEvidenceBundle {
        evidence_bundle_id: String,
        gate_id: String,
        candidate_commit: String,
        candidate_tree: String,
        corpus_manifest_digest: String,
        holdout_manifest_digest: String,
        runtime_metadata: Value,
        benchmark_result_refs: Vec<String>,
        raw_artifact_report_digests: Vec<String>,
        manual_inspection_evidence_refs: Vec<String>,
        independent_review_ref: String,
        reviewer_identity_ref: String,
        completeness_inventory: Value,
        known_limitations: Vec<String>,
        bundle_state: String,
        evidence_bundle_digest: String,
        provenance: Provenance,
    }
    optional {
        owner_decision_ref: String,
    }
}

wire_record! {
    GateDecision {
        decision_record_id: String,
        gate_id: String,
        candidate_commit: String,
        candidate_tree: String,
        evidence_bundle_digest: String,
        decision: String,
        threshold_evidence_summary: Value,
        independent_review_state: String,
        owner_decision_state: String,
        decided_at: String,
        reason_codes: Vec<String>,
        error_codes: Vec<String>,
    }
    optional {
        redesign_adr_ref: String,
    }
}

wire_record! {
    ResumePlan {
        plan_id: String,
        plan_schema_version: String,
        job_ref: String,
        job_version_ref: String,
        resume_source_ref: String,
        resume_version_ref: String,
        ordered_requirements: Vec<Value>,
        evidence_assignments: Vec<Value>,
        unsupported_gap_refs: Vec<String>,
        locked_content_refs: Vec<String>,
        budget: Value,
        terminology_decisions: Vec<Value>,
        edit_decisions: Vec<Value>,
        expected_verification_checks: Vec<Value>,
        provenance: Provenance,
        correlation_id: String,
    }
    optional {
        prompt_version_ref: String,
        model_profile_ref: String,
    }
}

wire_record! {
    AtomicClaim {
        claim_id: String,
        claim_type: String,
        claim_text: String,
        evidence_refs: Vec<String>,
        verification_status: String,
        prompt_version_ref: String,
        model_digest: String,
        model_profile_ref: String,
        verified_at: String,
        verification_result_digest: String,
        rejection_error_codes: Vec<String>,
        release_eligible: bool,
        user_action: String,
        canonical_evidence_mutation: bool,
    }
    optional {}
}

wire_record! {
    LayoutMeasurement {
        measurement_id: String,
        render_artifact_id: String,
        render_artifact_digest: String,
        source_document_ref: String,
        renderer_version: String,
        browser_version: String,
        controlled_fonts: Vec<Value>,
        page_dimensions: Value,
        page_count: u64,
        page_content_bounds: Vec<Value>,
        overflow_detected: bool,
        clipping_detected: bool,
        extraction_order_result: String,
        missing_font_families: Vec<String>,
        renderer_succeeded: bool,
        word_count: u64,
        character_count: u64,
        duration_ms: u64,
        environment_metadata: Value,
        layout_result: String,
        error_reason_codes: Vec<String>,
        evidence_report_digest: String,
    }
    optional {
        parseability_score: Number,
        readability_score: Number,
    }
}

// --- M01-W07 platform-service representatives -------------------------------

wire_record! {
    PlatformCapabilityState {
        capability: String,
        availability: String,
        evaluation_method: String,
        reason_codes: Vec<String>,
    }
    optional {
        identity_token: String,
        detected_version: String,
        evidence_digest: String,
        observed_at: String,
    }
}

wire_record! {
    PlatformSupportClaim {
        claimed_tier: String,
        reviewed_tier: String,
        review_state: String,
    }
    optional {
        evaluated_commit: String,
        evaluated_tree: String,
        evidence_refs: Vec<String>,
        reviewer_identity_ref: String,
    }
}

wire_record! {
    PlatformRequestContext {
        requesting_principal: String,
        authorization_profile: String,
        requested_at: String,
        correlation_id: String,
    }
    optional {
        causation_id: String,
        idempotency_key: String,
    }
}

wire_record! {
    PlatformArtifactIdentity {
        artifact_token: String,
        artifact_digest: String,
    }
    optional {
        artifact_bytes: u64,
    }
}

wire_record! {
    PlatformTargetIdentity {
        target_identity_id: String,
        platform_id: String,
        architecture: String,
        os_version: String,
        detection_method: String,
        detected_at: String,
        support_claim: PlatformSupportClaim,
        reason_codes: Vec<String>,
        provenance: Provenance,
    }
    optional {
        os_build: String,
        remediation_message: String,
    }
}

wire_record! {
    PlatformCapabilityReport {
        capability_report_id: String,
        platform_id: String,
        support_claim: PlatformSupportClaim,
        capabilities: Vec<PlatformCapabilityState>,
        packaging_channel: String,
        model_profile_refs: Vec<String>,
        diagnostic_refs: Vec<String>,
        reported_at: String,
        correlation_id: String,
        provenance: Provenance,
    }
    optional {}
}

wire_record! {
    PlatformPathRequest {
        path_request_id: String,
        request_context: PlatformRequestContext,
        role: String,
        scope: String,
        relative_segments: Vec<String>,
        create_if_missing: bool,
    }
    optional {}
}

wire_record! {
    PlatformPathResolution {
        path_resolution_id: String,
        request_ref: String,
        role: String,
        scope: String,
        resolution_state: String,
        exists: bool,
        writable: bool,
        reason_codes: Vec<String>,
        resolved_at: String,
        provenance: Provenance,
    }
    optional {
        sanitized_path: String,
        path_digest: String,
        remediation_message: String,
    }
}

wire_record! {
    PlatformSecretStoreRequest {
        secret_request_id: String,
        request_context: PlatformRequestContext,
        operation: String,
        key_role: String,
        scope: String,
    }
    optional {
        material_reference: String,
        material_digest: String,
        redaction: Redaction,
    }
}

wire_record! {
    PlatformSecretStoreResult {
        secret_result_id: String,
        request_ref: String,
        operation: String,
        key_role: String,
        store_availability: String,
        result_state: String,
        reason_codes: Vec<String>,
        completed_at: String,
        provenance: Provenance,
    }
    optional {
        store_identity_token: String,
        material_reference: String,
        material_digest: String,
        remediation_message: String,
    }
}

wire_record! {
    PlatformProcessPlan {
        process_plan_id: String,
        request_context: PlatformRequestContext,
        profile: String,
        arguments: Vec<String>,
        environment_allowlist: Vec<Value>,
        working_directory_role: String,
        stdin_mode: String,
        stdout_mode: String,
        stderr_mode: String,
        lifecycle_mode: String,
        startup_timeout_ms: u64,
        shutdown_timeout_ms: u64,
        max_restart_attempts: u64,
        inherit_parent_environment: bool,
    }
    optional {
        profile_version: String,
        executable_digest: String,
        max_memory_mib: u64,
    }
}

wire_record! {
    PlatformProcessStatus {
        process_status_id: String,
        process_handle: String,
        plan_ref: String,
        profile: String,
        state: String,
        termination_requested: String,
        restart_count: u64,
        orphan_detected: bool,
        reason_codes: Vec<String>,
        observed_at: String,
        provenance: Provenance,
    }
    optional {
        started_at: String,
        ended_at: String,
        exit_code: u64,
        idempotency_key: String,
        remediation_message: String,
        diagnostic_digest: String,
        correlation_id: String,
    }
}

wire_record! {
    PlatformNativeMessagingRegistration {
        registration_intent_id: String,
        request_context: PlatformRequestContext,
        operation: String,
        platform_id: String,
        browser_family: String,
        browser_channel: String,
        host_name: String,
        host_version: String,
        allowed_extension_ids: Vec<String>,
        scope: String,
        manifest_location_role: String,
        binary_stdio_mode: String,
    }
    optional {
        expected_manifest_digest: String,
        expected_host_binary_digest: String,
        max_message_bytes: u64,
    }
}

wire_record! {
    PlatformNativeMessagingResult {
        registration_result_id: String,
        intent_ref: String,
        operation: String,
        platform_id: String,
        browser_family: String,
        host_name: String,
        observed_state: String,
        changed: bool,
        idempotent_repeat_safe: bool,
        reason_codes: Vec<String>,
        completed_at: String,
        provenance: Provenance,
    }
    optional {
        observed_manifest_digest: String,
        observed_host_version: String,
        remediation_message: String,
        evidence_ref: String,
    }
}

wire_record! {
    PlatformBrowserDiscoveryRequest {
        browser_discovery_request_id: String,
        request_context: PlatformRequestContext,
        platform_id: String,
        browser_family: String,
        browser_channel: String,
        include_capability_probe: bool,
    }
    optional {
        minimum_version: String,
    }
}

wire_record! {
    PlatformBrowserRecord {
        browser_record_id: String,
        platform_id: String,
        browser_family: String,
        browser_channel: String,
        detection_method: String,
        presence: String,
        certified_for_platform: bool,
        native_messaging_capability: PlatformCapabilityState,
        reason_codes: Vec<String>,
        observed_at: String,
        provenance: Provenance,
    }
    optional {
        request_ref: String,
        detected_version: String,
        sanitized_install_location: String,
        last_tested_on: String,
    }
}

wire_record! {
    PlatformModelRuntimeProfile {
        model_profile_id: String,
        profile_token: String,
        platform_id: String,
        runtime_family: String,
        runtime_version: String,
        accelerator: String,
        artifact: PlatformArtifactIdentity,
        context_tokens: u64,
        quantization_token: String,
        minimum_ram_mib: u64,
        license_token: String,
        core_capability_behavior: String,
        availability: String,
        acceptance_state: String,
        evidence_refs: Vec<String>,
        reason_codes: Vec<String>,
        provenance: Provenance,
    }
    optional {
        minimum_driver_version: String,
        minimum_vram_mib: u64,
        structured_output_evidence_ref: String,
        factuality_evidence_ref: String,
        latency_evidence_ref: String,
        memory_evidence_ref: String,
        last_tested_on: String,
    }
}

wire_record! {
    PlatformRuntimeCapability {
        runtime_capability_id: String,
        platform_id: String,
        runtime_availability: String,
        detection_method: String,
        available_profile_refs: Vec<String>,
        accepted_profile_refs: Vec<String>,
        core_capability_behavior: String,
        reason_codes: Vec<String>,
        observed_at: String,
        provenance: Provenance,
    }
    optional {
        runtime_family: String,
        runtime_version: String,
        accelerator: String,
        detected_ram_mib: u64,
        detected_vram_mib: u64,
        remediation_message: String,
    }
}

wire_record! {
    PlatformInstallerState {
        installer_state_id: String,
        package_token: String,
        package_version: String,
        platform_id: String,
        architecture: String,
        package_format: String,
        artifact: PlatformArtifactIdentity,
        signature_state: String,
        channel: String,
        scope: String,
        state: String,
        interrupted: bool,
        user_data_preservation: String,
        native_host_cleanup: String,
        reason_codes: Vec<String>,
        observed_at: String,
        provenance: Provenance,
    }
    optional {
        installed_version: String,
        recovery_completed: bool,
        remediation_message: String,
        evidence_refs: Vec<String>,
    }
}

wire_record! {
    PlatformUpdateState {
        update_state_id: String,
        package_token: String,
        platform_id: String,
        architecture: String,
        channel: String,
        current_version: String,
        state: String,
        signature_state: String,
        interrupted: bool,
        rollback_available: bool,
        user_data_preservation: String,
        native_host_cleanup: String,
        reason_codes: Vec<String>,
        observed_at: String,
        provenance: Provenance,
    }
    optional {
        available_version: String,
        installed_version: String,
        rolled_back_to_version: String,
        target_artifact: PlatformArtifactIdentity,
        recovery_completed: bool,
        remediation_message: String,
        evidence_refs: Vec<String>,
    }
}

wire_record! {
    PlatformDiagnosticReport {
        diagnostic_report_id: String,
        component: String,
        capability: String,
        platform_id: String,
        severity: String,
        result: String,
        reason_codes: Vec<String>,
        blocking: bool,
        redaction: Redaction,
        evaluated_at: String,
        correlation_id: String,
        provenance: Provenance,
    }
    optional {
        user_message: String,
        remediation_message: String,
        detail_digest: String,
        evidence_refs: Vec<String>,
        causation_id: String,
    }
}

wire_record! {
    PlatformEvidenceRecord {
        evidence_record_id: String,
        platform_id: String,
        architecture: String,
        machine_class: String,
        artifact_kind: String,
        evaluation_method: String,
        synthetic_only: bool,
        artifact_digest: String,
        result: String,
        reason_codes: Vec<String>,
        recorded_at: String,
        provenance: Provenance,
    }
    optional {
        os_version: String,
        os_build: String,
        runner_image_token: String,
        package_artifact: PlatformArtifactIdentity,
        signature_state: String,
        browser_version: String,
        webview_version: String,
        native_messaging_result_ref: String,
        secret_store_result_ref: String,
        model_profile_ref: String,
        installer_state_ref: String,
        update_state_ref: String,
        reviewer_identity_ref: String,
        review_state: String,
        owner_decision_state: String,
    }
}

wire_record! {
    PlatformCertificationInput {
        certification_input_id: String,
        platform_id: String,
        architecture: String,
        support_claim: PlatformSupportClaim,
        capability_report_ref: String,
        evidence_record_refs: Vec<String>,
        required_evidence_kinds: Vec<String>,
        present_evidence_kinds: Vec<String>,
        inventory_complete: bool,
        owner_decision_state: String,
        reason_codes: Vec<String>,
        prepared_at: String,
        provenance: Provenance,
    }
    optional {
        browser_record_ref: String,
        runtime_capability_ref: String,
        owner_decision_ref: String,
        known_limitations: Vec<String>,
        last_tested_on: String,
    }
}

fn serde_round_trip<T>(value: Value) -> AdapterResult<Value>
where
    T: for<'de> Deserialize<'de> + Serialize,
{
    let typed: T = serde_json::from_value(value).map_err(|_| AdapterError)?;
    serde_json::to_value(typed).map_err(|_| AdapterError)
}

fn typed_round_trip(schema_ref: &str, value: Value) -> AdapterResult<Value> {
    match schema_ref {
        "urn:japp:schema:fixture:test-record:v1" => serde_round_trip::<FixtureRecord>(value),
        "urn:japp:schema:error:record:v1" => serde_round_trip::<ErrorRecord>(value),
        AUTHORIZATION_REQUEST_REF => serde_round_trip::<AuthorizationRequest>(value),
        ENVELOPED_RECORD_REF => serde_round_trip::<EnvelopedRecord>(value),
        "urn:japp:schema:form:field-address:v1" => serde_round_trip::<FieldAddress>(value),
        "urn:japp:schema:form:field-descriptor:v1" => serde_round_trip::<FieldDescriptor>(value),
        "urn:japp:schema:form:field-decision:v1" => serde_round_trip::<FieldDecision>(value),
        "urn:japp:schema:form:driver-result:v1" => serde_round_trip::<DriverResult>(value),
        "urn:japp:schema:form:reconciliation-inventory:v1" => {
            serde_round_trip::<ReconciliationInventory>(value)
        }
        "urn:japp:schema:ats:variant-identity:v1" => serde_round_trip::<AtsVariantIdentity>(value),
        "urn:japp:schema:workday:tenant-fingerprint:v1" => {
            serde_round_trip::<WorkdayTenantFingerprint>(value)
        }
        "urn:japp:schema:workday:step-identity:v1" => {
            serde_round_trip::<WorkdayStepIdentity>(value)
        }
        "urn:japp:schema:workday:certification-record:v1" => {
            serde_round_trip::<WorkdayCertificationRecord>(value)
        }
        "urn:japp:schema:session:guided-run-mode:v1" => serde_round_trip::<GuidedRunMode>(value),
        "urn:japp:schema:session:page-readiness-proof:v1" => {
            serde_round_trip::<PageReadinessProof>(value)
        }
        "urn:japp:schema:session:navigation-record:v1" => {
            serde_round_trip::<NavigationRecord>(value)
        }
        "urn:japp:schema:session:application-session:v1" => {
            serde_round_trip::<ApplicationSession>(value)
        }
        "urn:japp:schema:benchmark:case:v1" => serde_round_trip::<BenchmarkCase>(value),
        "urn:japp:schema:benchmark:result:v1" => serde_round_trip::<BenchmarkResult>(value),
        "urn:japp:schema:benchmark:holdout-manifest:v1" => {
            serde_round_trip::<HoldoutManifest>(value)
        }
        "urn:japp:schema:gate:evidence-bundle:v1" => serde_round_trip::<GateEvidenceBundle>(value),
        "urn:japp:schema:gate:decision:v1" => serde_round_trip::<GateDecision>(value),
        "urn:japp:schema:resume:plan:v1" => serde_round_trip::<ResumePlan>(value),
        "urn:japp:schema:resume:atomic-claim:v1" => serde_round_trip::<AtomicClaim>(value),
        "urn:japp:schema:rendering:layout-measurement:v1" => {
            serde_round_trip::<LayoutMeasurement>(value)
        }
        "urn:japp:schema:platform:browser-discovery-request:v1" => {
            serde_round_trip::<PlatformBrowserDiscoveryRequest>(value)
        }
        "urn:japp:schema:platform:browser-record:v1" => {
            serde_round_trip::<PlatformBrowserRecord>(value)
        }
        "urn:japp:schema:platform:capability-report:v1" => {
            serde_round_trip::<PlatformCapabilityReport>(value)
        }
        "urn:japp:schema:platform:certification-input:v1" => {
            serde_round_trip::<PlatformCertificationInput>(value)
        }
        "urn:japp:schema:platform:diagnostic-report:v1" => {
            serde_round_trip::<PlatformDiagnosticReport>(value)
        }
        "urn:japp:schema:platform:evidence-record:v1" => {
            serde_round_trip::<PlatformEvidenceRecord>(value)
        }
        "urn:japp:schema:platform:installer-state:v1" => {
            serde_round_trip::<PlatformInstallerState>(value)
        }
        "urn:japp:schema:platform:model-runtime-profile:v1" => {
            serde_round_trip::<PlatformModelRuntimeProfile>(value)
        }
        "urn:japp:schema:platform:native-messaging-registration:v1" => {
            serde_round_trip::<PlatformNativeMessagingRegistration>(value)
        }
        "urn:japp:schema:platform:native-messaging-result:v1" => {
            serde_round_trip::<PlatformNativeMessagingResult>(value)
        }
        "urn:japp:schema:platform:path-request:v1" => {
            serde_round_trip::<PlatformPathRequest>(value)
        }
        "urn:japp:schema:platform:path-resolution:v1" => {
            serde_round_trip::<PlatformPathResolution>(value)
        }
        "urn:japp:schema:platform:process-plan:v1" => {
            serde_round_trip::<PlatformProcessPlan>(value)
        }
        "urn:japp:schema:platform:process-status:v1" => {
            serde_round_trip::<PlatformProcessStatus>(value)
        }
        "urn:japp:schema:platform:runtime-capability:v1" => {
            serde_round_trip::<PlatformRuntimeCapability>(value)
        }
        "urn:japp:schema:platform:secret-store-request:v1" => {
            serde_round_trip::<PlatformSecretStoreRequest>(value)
        }
        "urn:japp:schema:platform:secret-store-result:v1" => {
            serde_round_trip::<PlatformSecretStoreResult>(value)
        }
        "urn:japp:schema:platform:target-identity:v1" => {
            serde_round_trip::<PlatformTargetIdentity>(value)
        }
        "urn:japp:schema:platform:update-state:v1" => {
            serde_round_trip::<PlatformUpdateState>(value)
        }
        _ => Err(AdapterError),
    }
}

fn record(value: &Value) -> Option<&Map<String, Value>> {
    value.as_object()
}

fn member<'a>(value: &'a Value, name: &str) -> Option<&'a Value> {
    record(value)?.get(name)
}

fn text<'a>(value: &'a Value, name: &str) -> Option<&'a str> {
    member(value, name)?.as_str()
}

fn number_value(value: &Value, name: &str) -> Option<f64> {
    member(value, name)?.as_f64()
}

fn flag(value: &Value, name: &str) -> Option<bool> {
    member(value, name)?.as_bool()
}

fn items<'a>(value: &'a Value, name: &str) -> &'a [Value] {
    member(value, name)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn object_member<'a>(value: &'a Value, name: &str) -> Option<&'a Value> {
    let candidate = member(value, name)?;
    candidate.is_object().then_some(candidate)
}

fn unique_strings(values: &[Value]) -> bool {
    let mut selected = BTreeSet::new();
    values.iter().all(|value| {
        value
            .as_str()
            .is_some_and(|token| selected.insert(token.to_owned()))
    })
}

fn unique_field(values: &[Value], name: &str) -> bool {
    let mut selected = BTreeSet::new();
    values
        .iter()
        .all(|value| text(value, name).is_some_and(|token| selected.insert(token.to_owned())))
}

fn strictly_sorted_strings(values: &[Value]) -> bool {
    values.iter().all(Value::is_string)
        && values.windows(2).all(|pair| {
            pair[0]
                .as_str()
                .zip(pair[1].as_str())
                .is_some_and(|(left, right)| left < right)
        })
}

fn strictly_sorted_field(values: &[Value], name: &str) -> bool {
    values.windows(2).all(|pair| {
        text(&pair[0], name)
            .zip(text(&pair[1], name))
            .is_some_and(|(left, right)| left < right)
    }) && values.iter().all(|value| text(value, name).is_some())
}

fn unique_u64_field(values: &[Value], name: &str) -> bool {
    let mut selected = BTreeSet::new();
    values.iter().all(|value| {
        member(value, name)
            .and_then(Value::as_u64)
            .is_some_and(|number| selected.insert(number))
    })
}

fn all_flags(value: &Value, names: &[&str]) -> bool {
    names.iter().all(|name| flag(value, name) == Some(true))
}

fn contains_text(values: &[Value], expected: &str) -> bool {
    values.iter().any(|value| value.as_str() == Some(expected))
}

fn token_in(token: Option<&str>, expected: &[&str]) -> bool {
    token.is_some_and(|token| expected.contains(&token))
}

fn canonical_utc_sort_key(timestamp: &str) -> Option<String> {
    let without_zone = timestamp.strip_suffix('Z')?;
    let (base, fraction) = match without_zone.split_once('.') {
        Some((base, fraction)) if !fraction.is_empty() => (base, fraction),
        Some(_) => return None,
        None => (without_zone, ""),
    };
    let base_bytes = base.as_bytes();
    if base_bytes.len() != 19
        || base_bytes[4] != b'-'
        || base_bytes[7] != b'-'
        || base_bytes[10] != b'T'
        || base_bytes[13] != b':'
        || base_bytes[16] != b':'
        || base_bytes
            .iter()
            .enumerate()
            .any(|(index, byte)| !matches!(index, 4 | 7 | 10 | 13 | 16) && !byte.is_ascii_digit())
        || fraction.len() > 9
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    let mut key = String::with_capacity(29);
    key.push_str(base);
    key.push('.');
    key.push_str(fraction);
    key.extend(std::iter::repeat_n('0', 9 - fraction.len()));
    Some(key)
}

fn canonical_utc_not_before(later: Option<&str>, earlier: Option<&str>) -> bool {
    match (
        later.and_then(canonical_utc_sort_key),
        earlier.and_then(canonical_utc_sort_key),
    ) {
        (Some(later), Some(earlier)) => later >= earlier,
        _ => false,
    }
}

fn inert_text_safe(value: &Value, depth: usize) -> bool {
    if depth > MAX_DEPTH {
        return false;
    }
    match value {
        Value::String(text) => {
            let lower = text.to_lowercase();
            let bytes = text.as_bytes();
            let drive_path = bytes.len() >= 3
                && bytes[0].is_ascii_alphabetic()
                && bytes[1] == b':'
                && matches!(bytes[2], b'/' | b'\\');
            !(text.starts_with('/')
                || drive_path
                || lower.contains("<script")
                || lower.contains("javascript:")
                || lower.contains("xpath:")
                || lower.contains("document.")
                || lower.contains("window.")
                || lower.contains("onload=")
                || lower.contains("onclick=")
                || lower.contains("password=")
                || lower.contains("credential=")
                || lower.contains("token=")
                || lower.contains("begin private key")
                || text.contains("$(")
                || text.contains("=>")
                || text.contains("../")
                || text.contains("..\\"))
        }
        Value::Array(values) => values.iter().all(|item| inert_text_safe(item, depth + 1)),
        Value::Object(values) => values.values().all(|item| inert_text_safe(item, depth + 1)),
        _ => true,
    }
}

fn field_address_identity(value: &Value) -> bool {
    let signal_count = [
        text(value, "route_signature").is_some(),
        text(value, "application_root_fingerprint").is_some(),
        text(value, "accessible_name_fingerprint").is_some(),
        text(value, "attribute_fingerprint").is_some(),
        text(value, "option_fingerprint").is_some(),
        !items(value, "section_path").is_empty(),
        !items(value, "repeater_path").is_empty(),
    ]
    .into_iter()
    .filter(|present| *present)
    .count();
    signal_count >= 2 && unique_field(items(value, "repeater_path"), "stable_item_key")
}

fn field_descriptor_observation(value: &Value) -> bool {
    let Some(address) = object_member(value, "address") else {
        return false;
    };
    let Some(label) = object_member(value, "label") else {
        return false;
    };
    let description = object_member(value, "description");
    let options = items(value, "options");
    field_address_identity(address)
        && number_value(value, "observed_dom_generation")
            == number_value(address, "observed_dom_generation")
        && flag(label, "untrusted") == Some(true)
        && description.is_none_or(|description| flag(description, "untrusted") == Some(true))
        && unique_field(options, "value_digest")
        && options.iter().all(|option| {
            object_member(option, "label")
                .is_some_and(|label| flag(label, "untrusted") == Some(true))
        })
}

fn field_decision_authority(value: &Value) -> bool {
    let final_decision = text(value, "final_decision");
    let source = text(value, "value_source_type");
    let policy = text(value, "policy_decision");
    let sensitivity = text(value, "sensitivity_class");
    let confirmation = text(value, "confirmation_state");
    let classification = number_value(value, "classification_confidence").unwrap_or(0.0);
    let confidence = number_value(value, "value_confidence").unwrap_or(0.0);
    let reasons = items(value, "reason_codes");
    let confirmation_required =
        policy == Some("REQUIRE_CONFIRMATION") || token_in(sensitivity, &["SENSITIVE", "SECRET"]);
    let confirmation_valid =
        confirmation == Some("VALID") && text(value, "user_confirmation_ref").is_some();
    let source_ref_present = text(value, "value_source_ref").is_some();
    let reviewed_source = token_in(
        source,
        &[
            "ANSWER_POLICY",
            "APPROVED_DOCUMENT",
            "DETERMINISTIC_DERIVATION",
            "USER_CONFIRMATION",
            "USER_RECORD",
        ],
    );
    let proposal_source = reviewed_source || source == Some("MODEL_PROPOSAL");
    if !unique_strings(reasons)
        || (confirmation == Some("VALID") && !confirmation_valid)
        || (token_in(policy, &["DENY", "UNSUPPORTED"])
            && token_in(final_decision, &["FILL", "PROPOSE"]))
        || (token_in(source, &["MODEL_PROPOSAL", "NONE"]) && final_decision == Some("FILL"))
    {
        return false;
    }
    if token_in(confirmation, &["EXPIRED", "MISSING", "REVOKED"]) {
        return final_decision == Some("PAUSE_FOR_CONFIRMATION");
    }
    if (classification < 0.5 && !contains_text(reasons, "LOW_CLASSIFICATION_CONFIDENCE"))
        || (confidence < 0.5 && !contains_text(reasons, "LOW_VALUE_CONFIDENCE"))
    {
        return false;
    }
    if final_decision == Some("PROPOSE") {
        return proposal_source && source_ref_present;
    }
    if final_decision != Some("FILL") {
        return true;
    }
    reviewed_source
        && source_ref_present
        && classification >= 0.75
        && confidence >= 0.75
        && (policy == Some("PERMIT")
            || (policy == Some("REQUIRE_CONFIRMATION") && confirmation_valid))
        && (!confirmation_required || confirmation_valid)
}

fn driver_verified_evidence(value: &Value) -> bool {
    let Some(address) = object_member(value, "field_address") else {
        return false;
    };
    let Some(preconditions) = object_member(value, "preconditions") else {
        return false;
    };
    let Some(intended) = object_member(value, "intended_value") else {
        return false;
    };
    let Some(immediate) = object_member(value, "observed_value_immediate") else {
        return false;
    };
    let Some(settled) = object_member(value, "observed_value_settled") else {
        return false;
    };
    if !field_address_identity(address)
        || text(value, "session_id") != text(address, "session_id")
        || number_value(value, "starting_dom_generation")
            != number_value(address, "observed_dom_generation")
        || !unique_strings(items(value, "conditional_field_ids"))
    {
        return false;
    }
    let uncertain = text(value, "resolution_result") != Some("UNIQUE")
        || text(value, "site_acceptance") == Some("UNKNOWN");
    if uncertain && flag(value, "safe_retry_allowed") == Some(true) {
        return false;
    }
    if text(value, "outcome") != Some("VERIFIED") {
        return true;
    }
    text(value, "resolution_result") == Some("UNIQUE")
        && all_flags(
            preconditions,
            &[
                "visible",
                "enabled",
                "generation_matched",
                "policy_permitted",
            ],
        )
        && text(intended, "semantic_digest") == text(immediate, "semantic_digest")
        && text(intended, "semantic_digest") == text(settled, "semantic_digest")
        && text(intended, "presence") == text(immediate, "presence")
        && text(intended, "presence") == text(settled, "presence")
        && flag(value, "persistence_verified") == Some(true)
        && text(value, "site_acceptance") == Some("ACCEPTED")
        && number_value(value, "starting_dom_generation")
            == number_value(value, "settled_dom_generation")
        && items(value, "validation_message_digests").is_empty()
}

fn reconciliation_readiness(value: &Value) -> bool {
    let inventory = items(value, "items");
    let Some(counts) = object_member(value, "counts") else {
        return false;
    };
    if !unique_field(inventory, "item_id")
        || number_value(counts, "total") != Some(inventory.len() as f64)
    {
        return false;
    }
    for (count_name, category) in [
        ("verified_filled", "VERIFIED_FILLED"),
        ("needs_review", "NEEDS_REVIEW"),
        ("blocked_sensitive", "BLOCKED_SENSITIVE"),
        ("unsupported_or_skipped", "UNSUPPORTED_OR_SKIPPED"),
        ("required_unresolved", "REQUIRED_UNRESOLVED"),
        ("page_changed_value", "PAGE_CHANGED_VALUE"),
    ] {
        let total = inventory
            .iter()
            .filter(|item| text(item, "category") == Some(category))
            .count() as f64;
        if number_value(counts, count_name) != Some(total) {
            return false;
        }
    }
    let stale = inventory
        .iter()
        .filter(|item| text(item, "document_state") == Some("STALE"))
        .count() as f64;
    let unconfirmed = inventory
        .iter()
        .filter(|item| {
            token_in(
                text(item, "confirmation_state"),
                &["EXPIRED", "MISSING", "REVOKED"],
            )
        })
        .count() as f64;
    let uncertain = inventory
        .iter()
        .filter(|item| flag(item, "mandatory_uncertain") == Some(true))
        .count() as f64;
    let changed = inventory
        .iter()
        .filter(|item| flag(item, "changed_value") == Some(true))
        .count() as f64;
    if number_value(counts, "page_changed_value") != Some(changed)
        || number_value(counts, "stale_document") != Some(stale)
        || number_value(counts, "unconfirmed_consequential") != Some(unconfirmed)
        || number_value(counts, "mandatory_uncertain") != Some(uncertain)
        || inventory.iter().any(|item| {
            (flag(item, "changed_value") == Some(true))
                != (text(item, "category") == Some("PAGE_CHANGED_VALUE"))
                || (flag(item, "required") == Some(true)
                    && flag(item, "visible") == Some(true)
                    && flag(item, "enabled") == Some(true)
                    && !token_in(
                        text(item, "category"),
                        &[
                            "VERIFIED_FILLED",
                            "REQUIRED_UNRESOLVED",
                            "BLOCKED_SENSITIVE",
                        ],
                    ))
        })
    {
        return false;
    }
    text(value, "readiness") != Some("READY")
        || (number_value(value, "page_generation") == number_value(value, "proof_generation")
            && [
                "required_unresolved",
                "blocked_sensitive",
                "page_changed_value",
                "stale_document",
                "unconfirmed_consequential",
                "mandatory_uncertain",
            ]
            .iter()
            .all(|name| number_value(counts, name) == Some(0.0)))
}

fn ats_variant_scope(value: &Value) -> bool {
    text(value, "ats_family") != Some("UNKNOWN")
        && text(value, "session_mode") != Some("UNKNOWN")
        && !token_in(
            text(value, "route_page_family"),
            &["ALL", "UNIVERSAL", "UNKNOWN"],
        )
}

fn workday_tenant_identity(value: &Value) -> bool {
    let controls = items(value, "control_family_inventory");
    !controls.is_empty()
        && unique_strings(controls)
        && text(value, "hostname_family") != Some("UNKNOWN")
        && text(value, "candidate_session_mode") != Some("UNKNOWN")
        && !token_in(
            text(value, "route_family"),
            &["ALL", "UNIVERSAL", "UNKNOWN"],
        )
        && !token_in(
            text(value, "page_sequence_family"),
            &["ALL", "UNIVERSAL", "UNKNOWN"],
        )
}

fn workday_step_boundary(value: &Value) -> bool {
    let signals = items(value, "recognition_signals");
    if signals.len() < 2 || !unique_field(signals, "kind") {
        return false;
    }
    let distinct_kinds = signals
        .iter()
        .filter_map(|signal| text(signal, "kind"))
        .collect::<BTreeSet<_>>();
    if distinct_kinds.len() < 2 {
        return false;
    }
    let expected = match text(value, "step_family") {
        Some("GUEST_APPLICATION" | "AUTHENTICATED_APPLICATION") => "ORDINARY_APPLICATION",
        Some("LOGIN" | "ACCOUNT_CREATION" | "EMAIL_VERIFICATION" | "MFA" | "EXPIRED_SESSION") => {
            "PROTECTED_AUTHENTICATION"
        }
        Some("CAPTCHA") => "PROTECTED_HUMAN_VERIFICATION",
        Some("LEGAL_CONSENT_BOUNDARY") => "PROTECTED_LEGAL_OR_CONSENT",
        Some("FINAL_REVIEW") => "FINAL_REVIEW_BOUNDARY",
        Some("DUPLICATE_APPLICATION" | "UNKNOWN_UNSUPPORTED") => "UNKNOWN_OR_UNSUPPORTED",
        _ => return false,
    };
    text(value, "boundary_class") == Some(expected)
}

fn page_readiness_integrity(value: &Value) -> bool {
    let Some(step) = object_member(value, "step_identity") else {
        return false;
    };
    let Some(counts) = object_member(value, "blocking_counts") else {
        return false;
    };
    if !workday_step_boundary(step)
        || text(value, "session_id") != text(step, "session_id")
        || number_value(value, "page_generation") != number_value(step, "observed_dom_generation")
    {
        return false;
    }
    if text(value, "readiness") != Some("READY") {
        return true;
    }
    let Some(next) = object_member(value, "next_control") else {
        return false;
    };
    text(step, "step_family") != Some("UNKNOWN_UNSUPPORTED")
        && text(step, "boundary_class") == Some("ORDINARY_APPLICATION")
        && text(value, "site_validation_status") == Some("ACCEPTED")
        && [
            "unresolved_count",
            "changed_value_count",
            "stale_document_count",
            "sensitive_confirmation_count",
            "mandatory_uncertain_count",
        ]
        .iter()
        .all(|name| number_value(counts, name) == Some(0.0))
        && text(next, "resolution") == Some("UNIQUE")
}

fn navigation_safety(value: &Value) -> bool {
    let Some(source) = object_member(value, "source_step_identity") else {
        return false;
    };
    let Some(control) = object_member(value, "navigation_control") else {
        return false;
    };
    let Some(postconditions) = object_member(value, "postconditions") else {
        return false;
    };
    let destination = object_member(value, "observed_destination_identity");
    let allowed = items(value, "allowed_destination_families");
    if !workday_step_boundary(source)
        || text(value, "session_id") != text(source, "session_id")
        || number_value(value, "source_page_generation")
            != number_value(source, "observed_dom_generation")
        || text(control, "resolution") != Some("UNIQUE")
        || !unique_strings(allowed)
    {
        return false;
    }
    if let Some(expected) = text(value, "expected_destination_family")
        && !contains_text(allowed, expected)
    {
        return false;
    }
    let outcome = text(value, "outcome");
    if token_in(outcome, &["UNCERTAIN_TRANSITION", "PAUSED_BOUNDARY"])
        && flag(value, "safe_retry_allowed") == Some(true)
    {
        return false;
    }
    if destination.is_some_and(|destination| {
        !workday_step_boundary(destination)
            || text(value, "session_id") != text(destination, "session_id")
    }) {
        return false;
    }
    if outcome == Some("PAUSED_BOUNDARY") {
        return destination.is_some_and(|destination| {
            text(destination, "boundary_class") != Some("ORDINARY_APPLICATION")
        });
    }
    if destination.is_some_and(|destination| {
        text(destination, "boundary_class") != Some("ORDINARY_APPLICATION")
    }) {
        return false;
    }
    if outcome != Some("VERIFIED_TRANSITION") {
        return true;
    }
    text(source, "boundary_class") == Some("ORDINARY_APPLICATION")
        && destination.is_some_and(|destination| {
            let destination_family = text(destination, "step_family");
            destination_family.is_some_and(|family| contains_text(allowed, family))
                && text(value, "expected_destination_family")
                    .is_none_or(|expected| destination_family == Some(expected))
                && text(destination, "session_id") == text(value, "session_id")
                && text(destination, "session_id") == text(source, "session_id")
                && number_value(value, "observed_resulting_generation")
                    == number_value(destination, "observed_dom_generation")
        })
        && number_value(value, "observed_resulting_generation")
            != number_value(value, "source_page_generation")
        && all_flags(
            postconditions,
            &[
                "source_generation_changed",
                "destination_recognized",
                "source_control_absent_or_inactive",
            ],
        )
}

fn guided_run_safety(value: &Value) -> bool {
    let Some(snapshots) = object_member(value, "snapshot_readiness") else {
        return false;
    };
    let allowed = text(value, "page_eligibility") == Some("CERTIFIED_APPLICATION_PAGE")
        && ["profile", "document", "answer_policy"]
            .iter()
            .all(|name| text(snapshots, name) == Some("READY"))
        && flag(value, "visible_cancel_control") == Some(true)
        && text(value, "revocation_state") == Some("ACTIVE");
    if (text(value, "start_permission") == Some("START_ALLOWED") && !allowed)
        || (text(value, "revocation_state") != Some("ACTIVE")
            && text(value, "start_permission") != Some("START_BLOCKED"))
    {
        return false;
    }
    text(value, "start_policy") != Some("AUTO_START_ON_OPEN")
        || (text(value, "run_kind") == Some("GUIDED_PRE_SUBMIT")
            && text(value, "prior_opt_in_ref").is_some()
            && text(value, "certified_pattern_ref").is_some()
            && text(value, "cancelable_start_ref").is_some()
            && allowed)
}

fn application_session_consistency(value: &Value) -> bool {
    let Some(step) = object_member(value, "current_step") else {
        return false;
    };
    let Some(ats) = object_member(value, "ats_variant") else {
        return false;
    };
    let Some(mode) = object_member(value, "guided_run_mode") else {
        return false;
    };
    let tenant = object_member(value, "workday_tenant_fingerprint");
    if !ats_variant_scope(ats)
        || !guided_run_safety(mode)
        || !workday_step_boundary(step)
        || tenant.is_some_and(|tenant| !workday_tenant_identity(tenant))
        || text(value, "session_id") != text(step, "session_id")
        || number_value(value, "current_page_generation")
            != number_value(step, "observed_dom_generation")
        || (text(ats, "ats_family") != Some("WORKDAY") && tenant.is_some())
        || !canonical_utc_not_before(text(value, "updated_at"), text(value, "created_at"))
    {
        return false;
    }
    let lifecycle = text(value, "lifecycle_state");
    if token_in(lifecycle, &["PAUSED", "CANCELED"])
        && text(value, "pause_or_cancel_reason").is_none()
    {
        return false;
    }
    !(text(mode, "start_permission") == Some("START_ALLOWED")
        && (lifecycle != Some("ACTIVE") || text(value, "revalidation_state") != Some("CURRENT")))
}

fn workday_certification_scope(value: &Value) -> bool {
    let Some(tenant) = object_member(value, "tenant_fingerprint") else {
        return false;
    };
    let Some(metrics) = object_member(value, "metrics") else {
        return false;
    };
    let routes = items(value, "route_page_sequence");
    let controls = items(value, "control_families");
    if !workday_tenant_identity(tenant)
        || !unique_strings(routes)
        || !unique_strings(controls)
        || text(value, "locale") != text(tenant, "locale")
        || text(value, "session_mode") != text(tenant, "candidate_session_mode")
        || text(value, "adapter_version") != text(tenant, "adapter_version")
        || controls.iter().any(|control| {
            control.as_str().is_none_or(|control| {
                !contains_text(items(tenant, "control_family_inventory"), control)
            })
        })
        || routes.iter().any(|route| {
            route
                .as_str()
                .is_some_and(|route| matches!(route, "ALL" | "UNIVERSAL"))
        })
    {
        return false;
    }
    if text(value, "certification_state") != Some("CERTIFIED") {
        return true;
    }
    text(value, "measured_scope_digest") == text(value, "certified_scope_digest")
        && text(tenant, "hostname_family") != Some("UNKNOWN")
        && text(tenant, "candidate_session_mode") != Some("UNKNOWN")
        && number_value(metrics, "case_count").unwrap_or(0.0) > 0.0
        && !items(value, "evidence_report_refs").is_empty()
}

fn benchmark_case_integrity(value: &Value) -> bool {
    let thresholds = items(value, "thresholds");
    let artifacts = items(value, "input_artifacts");
    let platforms = items(value, "applicable_platform_profiles");
    unique_field(thresholds, "metric_id")
        && unique_field(artifacts, "artifact_ref")
        && unique_field(artifacts, "artifact_digest")
        && unique_strings(platforms)
}

fn benchmark_result_integrity(value: &Value) -> bool {
    let metrics = items(value, "metric_results");
    let failure_errors = items(value, "failure_error_codes");
    if !unique_field(metrics, "metric_id")
        || text(value, "case_threshold_set_digest") != text(value, "evaluated_threshold_set_digest")
        || metrics.iter().any(|metric| {
            text(metric, "threshold_digest") != text(value, "case_threshold_set_digest")
        })
        || !canonical_utc_not_before(text(value, "ended_at"), text(value, "started_at"))
    {
        return false;
    }
    let comparable = text(value, "completeness_state") == Some("COMPLETE")
        && text(value, "environment_match_state") == Some("MATCH")
        && text(value, "hash_state") == Some("MATCH")
        && token_in(text(value, "holdout_state"), &["VALID", "NOT_APPLICABLE"]);
    if flag(value, "comparable") != Some(comparable) {
        return false;
    }
    match text(value, "overall_outcome") {
        Some("PASS") => {
            comparable
                && failure_errors.is_empty()
                && metrics
                    .iter()
                    .all(|metric| flag(metric, "passed") == Some(true))
        }
        Some("FAIL") => {
            !comparable
                || !failure_errors.is_empty()
                || metrics
                    .iter()
                    .any(|metric| flag(metric, "passed") == Some(false))
        }
        _ => true,
    }
}

fn sum_count(items: &[Value], name: &str) -> Option<f64> {
    items.iter().try_fold(0.0, |total, item| {
        number_value(item, name).map(|count| total + count)
    })
}

fn holdout_manifest_integrity(value: &Value) -> bool {
    let case_ids = items(value, "case_ids");
    let schema_versions = items(value, "schema_versions");
    let categories = items(value, "category_counts");
    let files = items(value, "files");
    strictly_sorted_strings(case_ids)
        && strictly_sorted_field(schema_versions, "schema_ref")
        && strictly_sorted_field(categories, "category")
        && strictly_sorted_field(files, "file_id")
        && unique_field(files, "content_digest")
        && number_value(value, "case_count") == Some(case_ids.len() as f64)
        && sum_count(categories, "count") == Some(case_ids.len() as f64)
        && sum_count(files, "case_count") == Some(case_ids.len() as f64)
        && flag(value, "synthetic_only") == Some(true)
        && ((text(value, "storage_policy") == Some("ENCRYPTED_BUNDLE_REFERENCE"))
            == object_member(value, "encrypted_bundle").is_some())
}

fn gate_evidence_completeness(value: &Value) -> bool {
    let Some(inventory) = object_member(value, "completeness_inventory") else {
        return false;
    };
    let results = items(value, "benchmark_result_refs");
    if !unique_strings(results)
        || !unique_strings(items(value, "raw_artifact_report_digests"))
        || !unique_strings(items(value, "manual_inspection_evidence_refs"))
        || number_value(inventory, "present_benchmark_count") != Some(results.len() as f64)
    {
        return false;
    }
    text(value, "bundle_state") != Some("COMPLETE")
        || (number_value(inventory, "required_benchmark_count") == Some(results.len() as f64)
            && all_flags(
                inventory,
                &[
                    "corpus_valid",
                    "holdout_valid",
                    "raw_artifacts_complete",
                    "manual_inspection_complete",
                    "independent_review_complete",
                    "owner_decision_complete",
                ],
            )
            && ((text(inventory, "owner_decision_requirement") == Some("REQUIRED"))
                == text(value, "owner_decision_ref").is_some()))
}

fn gate_decision_integrity(value: &Value) -> bool {
    let Some(summary) = object_member(value, "threshold_evidence_summary") else {
        return false;
    };
    if !unique_strings(items(value, "reason_codes"))
        || !unique_strings(items(value, "error_codes"))
        || (text(value, "decision") == Some("REDESIGN_REQUIRED")
            && text(value, "redesign_adr_ref").is_none())
    {
        return false;
    }
    text(value, "decision") != Some("PASS")
        || (all_flags(
            summary,
            &[
                "evidence_complete",
                "required_benchmark_results_complete",
                "thresholds_passed",
                "corpus_valid",
                "holdout_valid",
            ],
        ) && text(value, "independent_review_state") == Some("COMPLETE")
            && token_in(
                text(value, "owner_decision_state"),
                &["COMPLETE", "NOT_REQUIRED"],
            )
            && items(value, "error_codes").is_empty())
}

fn resume_plan_evidence(value: &Value) -> bool {
    let requirements = items(value, "ordered_requirements");
    let assignments = items(value, "evidence_assignments");
    let gaps = items(value, "unsupported_gap_refs");
    let Some(budget) = object_member(value, "budget") else {
        return false;
    };
    let Some(section_budget) = number_value(budget, "section_word_budget") else {
        return false;
    };
    let Some(global_budget) = number_value(budget, "global_word_budget") else {
        return false;
    };
    if !unique_field(requirements, "requirement_ref")
        || !unique_u64_field(requirements, "priority")
        || !unique_field(assignments, "requirement_ref")
        || !unique_strings(gaps)
        || !unique_strings(items(value, "locked_content_refs"))
        || section_budget > global_budget
    {
        return false;
    }
    let by_id = requirements
        .iter()
        .filter_map(|requirement| text(requirement, "requirement_ref").map(|id| (id, requirement)))
        .collect::<BTreeMap<_, _>>();
    if assignments.iter().any(|assignment| {
        text(assignment, "requirement_ref").is_none_or(|id| {
            by_id.get(id).is_none_or(|requirement| {
                flag(requirement, "supported") != Some(true)
                    || !unique_strings(items(assignment, "evidence_refs"))
            })
        })
    }) {
        return false;
    }
    if !gaps.iter().all(|gap| {
        gap.as_str().is_some_and(|id| {
            by_id
                .get(id)
                .is_some_and(|requirement| flag(requirement, "supported") == Some(false))
        })
    }) {
        return false;
    }
    let assignment_ids = assignments
        .iter()
        .filter_map(|assignment| text(assignment, "requirement_ref"))
        .collect::<BTreeSet<_>>();
    let gap_ids = gaps
        .iter()
        .filter_map(Value::as_str)
        .collect::<BTreeSet<_>>();
    requirements.iter().all(|requirement| {
        text(requirement, "requirement_ref").is_some_and(|id| {
            if flag(requirement, "supported") == Some(true) {
                assignment_ids.contains(id) && !gap_ids.contains(id)
            } else {
                flag(requirement, "supported") == Some(false)
                    && gap_ids.contains(id)
                    && !assignment_ids.contains(id)
            }
        })
    })
}

fn atomic_claim_integrity(value: &Value) -> bool {
    let status = text(value, "verification_status");
    let eligible = flag(value, "release_eligible");
    if !unique_strings(items(value, "evidence_refs"))
        || !unique_strings(items(value, "rejection_error_codes"))
        || flag(value, "canonical_evidence_mutation") != Some(false)
        || (eligible == Some(true) && status != Some("SUPPORTED"))
    {
        return false;
    }
    match status {
        Some("SUPPORTED") => {
            !items(value, "evidence_refs").is_empty() && text(value, "user_action") == Some("NONE")
        }
        Some("PARTIALLY_SUPPORTED") => {
            eligible == Some(false) && text(value, "user_action") == Some("EDIT_AND_APPROVE")
        }
        _ => eligible == Some(false) && text(value, "user_action") != Some("NONE"),
    }
}

fn layout_measurement_integrity(value: &Value) -> bool {
    let bounds = items(value, "page_content_bounds");
    let fonts = items(value, "controlled_fonts");
    let missing = items(value, "missing_font_families");
    let Some(page_count) = member(value, "page_count").and_then(Value::as_u64) else {
        return false;
    };
    let Some(dimensions) = object_member(value, "page_dimensions") else {
        return false;
    };
    let Some(page_width) = number_value(dimensions, "width_points") else {
        return false;
    };
    let Some(page_height) = number_value(dimensions, "height_points") else {
        return false;
    };
    if page_count != bounds.len() as u64
        || !bounds.iter().enumerate().all(|(index, bound)| {
            member(bound, "page_number").and_then(Value::as_u64) == Some(index as u64 + 1)
        })
        || !unique_field(fonts, "font_family")
        || !unique_strings(missing)
    {
        return false;
    }
    let bounds_fit = bounds.iter().all(|bound| {
        let Some(x) = number_value(bound, "x") else {
            return false;
        };
        let Some(y) = number_value(bound, "y") else {
            return false;
        };
        let Some(width) = number_value(bound, "width") else {
            return false;
        };
        let Some(height) = number_value(bound, "height") else {
            return false;
        };
        x + width <= page_width && y + height <= page_height
    });
    let accepted = flag(value, "renderer_succeeded") == Some(true)
        && page_count >= 1
        && flag(value, "overflow_detected") == Some(false)
        && flag(value, "clipping_detected") == Some(false)
        && text(value, "extraction_order_result") == Some("MATCH")
        && missing.is_empty()
        && items(value, "error_reason_codes").is_empty()
        && bounds_fit;
    match text(value, "layout_result") {
        Some("ACCEPTED") => accepted,
        Some("RENDER_FAILED") => {
            flag(value, "renderer_succeeded") == Some(false)
                && !items(value, "error_reason_codes").is_empty()
        }
        _ => page_count >= 1 && flag(value, "renderer_succeeded") == Some(true),
    }
}

// --- M01-W07 platform semantic rules ----------------------------------------

const CERTIFIED_PLATFORM_IDS: [&str; 3] = ["MACOS_ARM64", "UBUNTU_X64", "WINDOWS_X64"];
const UNCERTIFIABLE_PLATFORM_IDS: [&str; 2] = ["UNKNOWN_TARGET", "UNSUPPORTED_TARGET"];
const CERTIFIED_SUPPORT_TIERS: [&str; 2] = ["CERTIFIED_CORE", "CERTIFIED_FULL"];
const PLATFORM_CAPABILITY_FAMILIES: [&str; 8] = [
    "BROWSER_PRESENCE",
    "DIAGNOSTICS",
    "MODEL_RUNTIME",
    "NATIVE_MESSAGING",
    "PACKAGING_UPDATE_CHANNEL",
    "PLATFORM_PATHS",
    "PROCESS_SUPERVISION",
    "SECURE_STORE",
];
const MANDATORY_CORE_CAPABILITIES: [&str; 5] = [
    "BROWSER_PRESENCE",
    "NATIVE_MESSAGING",
    "PLATFORM_PATHS",
    "PROCESS_SUPERVISION",
    "SECURE_STORE",
];
const PLATFORM_REQUEST_PRINCIPALS: [&str; 2] = ["ORCHESTRATOR", "VERIFICATION_HARNESS"];
const PLATFORM_REQUEST_PROFILES: [&str; 2] = ["PRODUCTION_NO_SUBMIT", "VERIFICATION"];
const PLATFORM_INTERPRETER_TOKENS: [&str; 10] = [
    "bash",
    "cmd",
    "cscript",
    "eval",
    "exec",
    "powershell",
    "pwsh",
    "sh",
    "wscript",
    "zsh",
];
const PACKAGE_SUCCESS_STATES: [&str; 5] = [
    "INSTALLED",
    "REPAIRED",
    "ROLLED_BACK",
    "UNINSTALLED",
    "UPDATE_INSTALLED",
];
const PACKAGE_FAILURE_STATES: [&str; 7] = [
    "INSTALL_FAILED",
    "INSTALL_INTERRUPTED",
    "REPAIR_FAILED",
    "ROLLBACK_FAILED",
    "UNINSTALL_FAILED",
    "UPDATE_FAILED",
    "UPDATE_INTERRUPTED",
];

fn platform_expected_architecture(platform_id: &str) -> Option<&'static str> {
    match platform_id {
        "MACOS_ARM64" => Some("ARM64"),
        "UBUNTU_X64" | "WINDOWS_X64" => Some("X86_64"),
        _ => None,
    }
}

fn registration_terminal_state(operation: &str) -> Option<&'static str> {
    match operation {
        "REMOVE" => Some("ABSENT"),
        "INSTALL" | "REPAIR" | "UPDATE" | "VERIFY" => Some("PRESENT_VALID"),
        _ => None,
    }
}

/// A certified target must report its specification §5.14.1 architecture. An
/// uncertifiable target stays unconstrained so an honest UNKNOWN_ARCHITECTURE
/// observation remains representable.
fn platform_architecture_coherent(value: &Value) -> bool {
    match platform_expected_architecture(text(value, "platform_id").unwrap_or_default()) {
        Some(expected) => text(value, "architecture") == Some(expected),
        None => true,
    }
}

fn diagnostic_expected_capability(component: &str) -> Option<&'static str> {
    match component {
        "BROWSER_LOCATOR" => Some("BROWSER_PRESENCE"),
        "INSTALLER_STATE" | "UPDATER_PROVIDER" => Some("PACKAGING_UPDATE_CHANNEL"),
        "MODEL_RUNTIME_PROVIDER" => Some("MODEL_RUNTIME"),
        "NATIVE_MESSAGING_REGISTRAR" => Some("NATIVE_MESSAGING"),
        "PLATFORM_DIAGNOSTICS" => Some("DIAGNOSTICS"),
        "PLATFORM_PATHS" => Some("PLATFORM_PATHS"),
        "PROCESS_SUPERVISOR" => Some("PROCESS_SUPERVISION"),
        "SECRET_STORE" => Some("SECURE_STORE"),
        _ => None,
    }
}

fn evidence_required_reference(artifact_kind: &str) -> Option<&'static str> {
    match artifact_kind {
        "INSTALL_LAUNCH_REPORT" => Some("installer_state_ref"),
        "MODEL_PROFILE_REPORT" => Some("model_profile_ref"),
        "NATIVE_HOST_REGISTRATION_REPORT" => Some("native_messaging_result_ref"),
        "SECRET_STORE_TEST_REPORT" => Some("secret_store_result_ref"),
        "UPDATE_ROLLBACK_REPORT" => Some("update_state_ref"),
        _ => None,
    }
}

fn platform_request_authority(value: &Value) -> bool {
    let Some(context) = object_member(value, "request_context") else {
        return false;
    };
    token_in(
        text(context, "requesting_principal"),
        &PLATFORM_REQUEST_PRINCIPALS,
    ) && token_in(
        text(context, "authorization_profile"),
        &PLATFORM_REQUEST_PROFILES,
    )
}

fn platform_capability_state_sound(state: &Value) -> bool {
    let availability = text(state, "availability");
    let reasons = items(state, "reason_codes");
    if !unique_strings(reasons) {
        return false;
    }
    if availability == Some("AVAILABLE") {
        return reasons.is_empty()
            && present(state, "identity_token")
            && present(state, "detected_version")
            && present(state, "evidence_digest")
            && text(state, "evaluation_method") != Some("NOT_EVALUATED");
    }
    if reasons.is_empty() {
        return false;
    }
    if availability == Some("NOT_EVALUATED") {
        return text(state, "evaluation_method") == Some("NOT_EVALUATED")
            && contains_value(reasons, "EVALUATION_NOT_RUN");
    }
    if availability == Some("DEGRADED_LIMITED") {
        return present(state, "identity_token") && present(state, "detected_version");
    }
    true
}

fn platform_support_claim_sound(value: &Value) -> bool {
    let (Some(claim), Some(platform_id)) = (
        object_member(value, "support_claim"),
        text(value, "platform_id"),
    ) else {
        return false;
    };
    let reviewed = text(claim, "reviewed_tier").unwrap_or_default();
    let evidence = items(claim, "evidence_refs");
    if !unique_strings(evidence) {
        return false;
    }
    if UNCERTIFIABLE_PLATFORM_IDS.contains(&platform_id) && reviewed != "UNSUPPORTED" {
        return false;
    }
    if !CERTIFIED_SUPPORT_TIERS.contains(&reviewed) {
        return true;
    }
    CERTIFIED_PLATFORM_IDS.contains(&platform_id)
        && text(claim, "review_state") == Some("REVIEW_COMPLETE")
        && present(claim, "evaluated_commit")
        && present(claim, "evaluated_tree")
        && present(claim, "reviewer_identity_ref")
        && !evidence.is_empty()
}

fn platform_reviewed_tier_is_certified(value: &Value) -> bool {
    object_member(value, "support_claim").is_some_and(|claim| {
        CERTIFIED_SUPPORT_TIERS.contains(&text(claim, "reviewed_tier").unwrap_or_default())
    })
}

fn platform_target_support_claim(value: &Value) -> bool {
    if text(value, "platform_id").is_none() {
        return false;
    }
    let reasons = items(value, "reason_codes");
    if !unique_strings(reasons)
        || !platform_architecture_coherent(value)
        || !platform_support_claim_sound(value)
    {
        return false;
    }
    if !platform_reviewed_tier_is_certified(value) {
        return !reasons.is_empty();
    }
    reasons.is_empty() && text(value, "detection_method") == Some("MEASURED_NATIVE_RUN")
}

fn platform_capability_availability<'a>(
    capabilities: &'a [Value],
    family: &str,
) -> Option<&'a str> {
    capabilities
        .iter()
        .find(|state| text(state, "capability") == Some(family))
        .and_then(|state| text(state, "availability"))
}

fn platform_capability_report_integrity(value: &Value) -> bool {
    let capabilities = items(value, "capabilities");
    if !unique_field(capabilities, "capability")
        || capabilities.len() != PLATFORM_CAPABILITY_FAMILIES.len()
        || !PLATFORM_CAPABILITY_FAMILIES.iter().all(|family| {
            capabilities
                .iter()
                .any(|state| text(state, "capability") == Some(*family))
        })
        || !capabilities.iter().all(platform_capability_state_sound)
        || !unique_strings(items(value, "model_profile_refs"))
        || !unique_strings(items(value, "diagnostic_refs"))
        || !platform_support_claim_sound(value)
    {
        return false;
    }
    if text(value, "packaging_channel") == Some("RELEASE_STABLE")
        && platform_capability_availability(capabilities, "PACKAGING_UPDATE_CHANNEL")
            != Some("AVAILABLE")
    {
        return false;
    }
    if !platform_reviewed_tier_is_certified(value) {
        return true;
    }
    if !MANDATORY_CORE_CAPABILITIES
        .iter()
        .all(|family| platform_capability_availability(capabilities, family) == Some("AVAILABLE"))
    {
        return false;
    }
    let reviewed =
        object_member(value, "support_claim").and_then(|claim| text(claim, "reviewed_tier"));
    if reviewed != Some("CERTIFIED_FULL") {
        // A missing or unavailable local-AI profile never downgrades the
        // deterministic core tier; CERTIFIED_CORE imposes no MODEL_RUNTIME
        // requirement.
        return true;
    }
    platform_capability_availability(capabilities, "MODEL_RUNTIME") == Some("AVAILABLE")
        && !items(value, "model_profile_refs").is_empty()
}

fn platform_path_request_safety(value: &Value) -> bool {
    platform_request_authority(value)
        && (text(value, "scope") != Some("SYSTEM")
            || text(value, "role") == Some("NATIVE_HOST_REGISTRATION"))
}

fn platform_path_resolution_safety(value: &Value) -> bool {
    let Some(role) = text(value, "role") else {
        return false;
    };
    let reasons = items(value, "reason_codes");
    let sanitized = text(value, "sanitized_path");
    if !unique_strings(reasons)
        || (text(value, "scope") == Some("SYSTEM") && role != "NATIVE_HOST_REGISTRATION")
    {
        return false;
    }
    if text(value, "resolution_state") != Some("RESOLVED") {
        return sanitized.is_none()
            && !present(value, "path_digest")
            && flag(value, "exists") == Some(false)
            && flag(value, "writable") == Some(false)
            && !reasons.is_empty();
    }
    let mut prefix = String::with_capacity(role.len() + 2);
    prefix.push('<');
    prefix.push_str(role);
    prefix.push('>');
    sanitized.is_some_and(|path| path.starts_with(&prefix))
        && present(value, "path_digest")
        && reasons.is_empty()
        && (flag(value, "writable") != Some(true) || flag(value, "exists") == Some(true))
}

fn platform_secret_request_authority(value: &Value) -> bool {
    let operation = text(value, "operation");
    if !platform_request_authority(value) {
        return false;
    }
    let profile = object_member(value, "request_context")
        .and_then(|context| text(context, "authorization_profile"));
    if profile == Some("VERIFICATION") && operation != Some("STATUS") {
        return false;
    }
    if let Some(redaction) = object_member(value, "redaction")
        && (text(redaction, "sensitivity") != Some("SECRET")
            || text(redaction, "policy") != Some("FORBID_CAPTURE"))
    {
        return false;
    }
    if operation == Some("PUT") {
        return present(value, "material_reference") && present(value, "material_digest");
    }
    !present(value, "material_reference") && !present(value, "material_digest")
}

fn platform_secret_result_integrity(value: &Value) -> bool {
    let operation = text(value, "operation");
    let availability = text(value, "store_availability");
    let state = text(value, "result_state");
    let reasons = items(value, "reason_codes");
    let has_material = present(value, "material_reference");
    let has_digest = present(value, "material_digest");
    if !unique_strings(reasons) {
        return false;
    }
    if availability == Some("AVAILABLE") {
        if !present(value, "store_identity_token") {
            return false;
        }
    } else if has_material {
        return false;
    }
    let store_unavailable_availability = matches!(
        availability,
        Some(token)
            if !matches!(
                token,
                "AVAILABLE" | "DEGRADED_LIMITED" | "PERMISSION_REQUIRED"
            )
    );
    let denied_availability = token_in(availability, &["PERMISSION_REQUIRED", "UNAVAILABLE"]);
    if operation == Some("STATUS") {
        if has_material || has_digest {
            return false;
        }
        return match state {
            Some("STORE_AVAILABLE") => availability == Some("AVAILABLE") && reasons.is_empty(),
            Some("DENIED_PERMISSION") => {
                contains_value(reasons, "PERMISSION_DENIED") && denied_availability
            }
            Some("STORE_UNAVAILABLE") => !reasons.is_empty() && store_unavailable_availability,
            _ => false,
        };
    }
    match state {
        Some("STORE_AVAILABLE") => false,
        Some("RETRIEVED") => {
            operation == Some("GET")
                && availability == Some("AVAILABLE")
                && has_material
                && has_digest
                && reasons.is_empty()
        }
        Some("STORED") => {
            operation == Some("PUT")
                && availability == Some("AVAILABLE")
                && has_material
                && reasons.is_empty()
        }
        Some("DELETED") => {
            operation == Some("DELETE")
                && availability == Some("AVAILABLE")
                && !has_material
                && !has_digest
                && reasons.is_empty()
        }
        Some("DENIED_PERMISSION") => {
            !has_material
                && !has_digest
                && contains_value(reasons, "PERMISSION_DENIED")
                && denied_availability
        }
        Some("STORE_UNAVAILABLE") => {
            !has_material && !has_digest && !reasons.is_empty() && store_unavailable_availability
        }
        _ => !has_material && !has_digest && !reasons.is_empty(),
    }
}

fn platform_process_plan_safety(value: &Value) -> bool {
    let environment = items(value, "environment_allowlist");
    let command_arguments = items(value, "arguments");
    if !platform_request_authority(value)
        || flag(value, "inherit_parent_environment") != Some(false)
        || !present(value, "executable_digest")
        || !unique_field(environment, "variable")
        || text(value, "working_directory_role") == Some("NATIVE_HOST_REGISTRATION")
    {
        return false;
    }
    if command_arguments.iter().any(|argument| {
        argument.as_str().is_some_and(|token| {
            PLATFORM_INTERPRETER_TOKENS.contains(&token.to_lowercase().as_str())
        })
    }) {
        return false;
    }
    for entry in environment {
        let Some(entry_value) = text(entry, "value") else {
            return false;
        };
        match text(entry, "variable") {
            Some("JAPP_SERVICE_PORT") => {
                if entry_value.is_empty()
                    || entry_value.len() > 5
                    || !entry_value.bytes().all(|byte| byte.is_ascii_digit())
                {
                    return false;
                }
            }
            Some("JAPP_PATH_ROLE") => {
                let bytes = entry_value.as_bytes();
                if bytes.len() < 2
                    || bytes.len() > 64
                    || !bytes[0].is_ascii_uppercase()
                    || !bytes.iter().all(|byte| {
                        byte.is_ascii_uppercase() || byte.is_ascii_digit() || *byte == b'_'
                    })
                {
                    return false;
                }
            }
            _ => {}
        }
    }
    if text(value, "lifecycle_mode") == Some("ONE_SHOT")
        && member(value, "max_restart_attempts").and_then(Value::as_u64) != Some(0)
    {
        return false;
    }
    let modes = [
        text(value, "stdin_mode"),
        text(value, "stdout_mode"),
        text(value, "stderr_mode"),
    ];
    if text(value, "profile") == Some("NATIVE_MESSAGING_HOST") {
        // Specification §5.14.5 places the length-prefixed native-messaging
        // protocol on binary stdin/stdout. stderr stays a diagnostic channel
        // and must never silently become a second protocol stream.
        return text(value, "stdin_mode") == Some("BINARY_LENGTH_PREFIXED")
            && text(value, "stdout_mode") == Some("BINARY_LENGTH_PREFIXED")
            && text(value, "stderr_mode") != Some("BINARY_LENGTH_PREFIXED");
    }
    modes
        .iter()
        .all(|mode| *mode != Some("BINARY_LENGTH_PREFIXED"))
}

fn platform_process_status_integrity(value: &Value) -> bool {
    let state = text(value, "state");
    let reasons = items(value, "reason_codes");
    let ended = present(value, "ended_at");
    let started = present(value, "started_at");
    let exited = present(value, "exit_code");
    let orphan = flag(value, "orphan_detected");
    if !unique_strings(reasons) {
        return false;
    }
    if ended
        && started
        && !canonical_utc_not_before(text(value, "ended_at"), text(value, "started_at"))
    {
        return false;
    }
    if orphan == Some(true) && state != Some("ORPHANED") {
        return false;
    }
    match state {
        Some("STARTING" | "RUNNING") => !ended && !exited && orphan == Some(false),
        Some("TERMINATING") => {
            !ended && !exited && text(value, "termination_requested") != Some("NONE")
        }
        Some("EXITED") => started && ended && exited && reasons.is_empty(),
        Some("TERMINATED") => {
            started && ended && text(value, "termination_requested") != Some("NONE")
        }
        Some("ORPHANED") => orphan == Some(true) && !reasons.is_empty(),
        Some("UNAVAILABLE") => !started && !ended && !exited && !reasons.is_empty(),
        _ => !reasons.is_empty(),
    }
}

fn platform_native_registration_binding(value: &Value) -> bool {
    let operation = text(value, "operation");
    if !platform_request_authority(value)
        || text(value, "browser_family") != Some("CHROME")
        || text(value, "browser_channel") != Some("STABLE")
        || text(value, "binary_stdio_mode") != Some("BINARY_LENGTH_PREFIXED")
        || text(value, "manifest_location_role") != Some("NATIVE_HOST_REGISTRATION")
        || !strictly_sorted_strings(items(value, "allowed_extension_ids"))
    {
        return false;
    }
    match operation {
        Some("REMOVE") => {
            !present(value, "expected_manifest_digest")
                && !present(value, "expected_host_binary_digest")
        }
        Some("VERIFY") => present(value, "expected_manifest_digest"),
        _ => {
            present(value, "expected_manifest_digest")
                && present(value, "expected_host_binary_digest")
        }
    }
}

fn platform_native_registration_result(value: &Value) -> bool {
    let operation = text(value, "operation").unwrap_or_default();
    let observed = text(value, "observed_state");
    let reasons = items(value, "reason_codes");
    let changed = flag(value, "changed");
    let succeeded = reasons.is_empty();
    let manifest_digest = present(value, "observed_manifest_digest");
    let host_version = present(value, "observed_host_version");
    if !unique_strings(reasons)
        || text(value, "browser_family") != Some("CHROME")
        || (operation == "VERIFY" && changed != Some(false))
    {
        return false;
    }
    // Each diagnostic reason names the exact state it explains, so neither the
    // state nor its reason may be reported without the other.
    if (observed == Some("MISMATCHED_IDENTITY")) != contains_value(reasons, "IDENTITY_MISMATCH") {
        return false;
    }
    if (observed == Some("NOT_EVALUATED")) != contains_value(reasons, "EVALUATION_NOT_RUN") {
        return false;
    }
    // Observed identity is evidence of a manifest that is really present: it is
    // mandatory for PRESENT_VALID and impossible once nothing is registered or
    // nothing was evaluated.
    if observed == Some("PRESENT_VALID") && !(manifest_digest && host_version && succeeded) {
        return false;
    }
    if (observed == Some("ABSENT") || observed == Some("NOT_EVALUATED"))
        && (manifest_digest || host_version)
    {
        return false;
    }
    if observed == Some("NOT_EVALUATED") {
        return changed == Some(false);
    }
    // Zero reasons is a success claim. It is admissible only in the terminal
    // state the operation is defined to reach, and only when repeating the same
    // intent is guaranteed to be a no-op (specification §5.14.5 idempotency).
    if succeeded {
        return observed == registration_terminal_state(operation)
            && flag(value, "idempotent_repeat_safe") == Some(true);
    }
    true
}

fn platform_browser_discovery_safety(value: &Value) -> bool {
    if !platform_request_authority(value)
        || text(value, "browser_family") != Some("CHROME")
        || text(value, "browser_channel") != Some("STABLE")
    {
        return false;
    }
    flag(value, "include_capability_probe") != Some(true)
        || token_in(text(value, "platform_id"), &CERTIFIED_PLATFORM_IDS)
}

fn platform_browser_record_scope(value: &Value) -> bool {
    let presence = text(value, "presence");
    let reasons = items(value, "reason_codes");
    let Some(capability) = object_member(value, "native_messaging_capability") else {
        return false;
    };
    if !unique_strings(reasons)
        || !platform_capability_state_sound(capability)
        || text(capability, "capability") != Some("NATIVE_MESSAGING")
    {
        return false;
    }
    if presence == Some("AVAILABLE") {
        if !present(value, "detected_version") {
            return false;
        }
    } else if present(value, "sanitized_install_location") {
        return false;
    }
    if flag(value, "certified_for_platform") != Some(true) {
        return !reasons.is_empty();
    }
    reasons.is_empty()
        && presence == Some("AVAILABLE")
        && text(value, "browser_family") == Some("CHROME")
        && text(value, "browser_channel") == Some("STABLE")
        && token_in(text(value, "platform_id"), &CERTIFIED_PLATFORM_IDS)
        && text(value, "detection_method") == Some("MEASURED_NATIVE_RUN")
        && text(capability, "availability") == Some("AVAILABLE")
        && present(value, "last_tested_on")
}

fn platform_model_profile_evidence(value: &Value) -> bool {
    let platform_id = text(value, "platform_id").unwrap_or_default();
    let accelerator = text(value, "accelerator");
    let family = text(value, "runtime_family");
    let reasons = items(value, "reason_codes");
    let evidence = items(value, "evidence_refs");
    if !unique_strings(reasons) || !unique_strings(evidence) {
        return false;
    }
    if accelerator == Some("APPLE_SILICON_GPU") && platform_id != "MACOS_ARM64" {
        return false;
    }
    if accelerator == Some("NVIDIA_CUDA")
        && (!present(value, "minimum_vram_mib") || !present(value, "minimum_driver_version"))
    {
        return false;
    }
    if accelerator == Some("CPU_ONLY") && present(value, "minimum_vram_mib") {
        return false;
    }
    if family == Some("OLLAMA_MLX")
        && (platform_id != "MACOS_ARM64" || accelerator != Some("APPLE_SILICON_GPU"))
    {
        return false;
    }
    if family == Some("OLLAMA_GGUF") && accelerator == Some("APPLE_SILICON_GPU") {
        return false;
    }
    if text(value, "acceptance_state") != Some("ACCEPTED") {
        return !reasons.is_empty()
            && text(value, "core_capability_behavior") != Some("FULL_AI_AVAILABLE");
    }
    CERTIFIED_PLATFORM_IDS.contains(&platform_id)
        && reasons.is_empty()
        && !evidence.is_empty()
        && text(value, "availability") == Some("AVAILABLE")
        && text(value, "core_capability_behavior") == Some("FULL_AI_AVAILABLE")
        && present(value, "structured_output_evidence_ref")
        && present(value, "factuality_evidence_ref")
        && present(value, "latency_evidence_ref")
        && present(value, "memory_evidence_ref")
        && present(value, "last_tested_on")
}

fn platform_runtime_capability_fallback(value: &Value) -> bool {
    let available = items(value, "available_profile_refs");
    let accepted = items(value, "accepted_profile_refs");
    let reasons = items(value, "reason_codes");
    let behavior = text(value, "core_capability_behavior");
    if !unique_strings(available)
        || !unique_strings(accepted)
        || !unique_strings(reasons)
        || !subset_of(accepted, available)
    {
        return false;
    }
    if text(value, "detection_method") == Some("NOT_EVALUATED")
        && text(value, "runtime_availability") != Some("NOT_EVALUATED")
    {
        return false;
    }
    if text(value, "runtime_availability") != Some("AVAILABLE") {
        return available.is_empty()
            && accepted.is_empty()
            && !reasons.is_empty()
            && behavior != Some("FULL_AI_AVAILABLE");
    }
    if !present(value, "runtime_family")
        || !present(value, "runtime_version")
        || !present(value, "accelerator")
    {
        return false;
    }
    if behavior == Some("FULL_AI_AVAILABLE") {
        !accepted.is_empty()
    } else {
        accepted.is_empty()
    }
}

fn platform_package_state_evidence(value: &Value) -> bool {
    let state = text(value, "state").unwrap_or_default();
    let reasons = items(value, "reason_codes");
    let signature = text(value, "signature_state");
    let interrupted = flag(value, "interrupted");
    let preservation = text(value, "user_data_preservation");
    if !unique_strings(reasons)
        || !unique_strings(items(value, "evidence_refs"))
        || !platform_architecture_coherent(value)
        || (interrupted == Some(true) && !contains_value(reasons, "INTERRUPTED"))
        || (flag(value, "recovery_completed") == Some(true) && interrupted != Some(true))
        || (preservation == Some("PRESERVATION_FAILED") && reasons.is_empty())
    {
        return false;
    }
    if token_in(signature, &["SIGNATURE_INVALID", "SIGNATURE_MISSING"])
        && !contains_value(reasons, "SIGNATURE_NOT_VERIFIED")
    {
        return false;
    }
    if PACKAGE_FAILURE_STATES.contains(&state) && reasons.is_empty() {
        return false;
    }
    if PACKAGE_SUCCESS_STATES.contains(&state)
        && (signature != Some("SIGNATURE_VALID")
            || !reasons.is_empty()
            || interrupted != Some(false)
            || !token_in(preservation, &["EXPLICIT_DELETION_REQUESTED", "PRESERVED"])
            || items(value, "evidence_refs").is_empty())
    {
        return false;
    }
    match state {
        "UNINSTALLED" => token_in(
            text(value, "native_host_cleanup"),
            &["NOT_APPLICABLE", "REMOVED"],
        ),
        "INSTALLED" => {
            present(value, "installed_version")
                && text(value, "installed_version") == text(value, "package_version")
        }
        "NOT_INSTALLED" => !present(value, "installed_version"),
        "NO_UPDATE_AVAILABLE" => !present(value, "available_version"),
        "UPDATE_AVAILABLE" => present(value, "available_version"),
        "UPDATE_INSTALLED" => {
            present(value, "installed_version")
                && present(value, "available_version")
                && present(value, "target_artifact")
        }
        "ROLLED_BACK" => {
            present(value, "rolled_back_to_version")
                && flag(value, "rollback_available") == Some(true)
        }
        _ => true,
    }
}

fn platform_diagnostic_integrity(value: &Value) -> bool {
    let result = text(value, "result");
    let severity = text(value, "severity");
    let reasons = items(value, "reason_codes");
    let blocking = flag(value, "blocking");
    let expected_capability =
        diagnostic_expected_capability(text(value, "component").unwrap_or_default());
    if !unique_strings(reasons)
        || !unique_strings(items(value, "evidence_refs"))
        || expected_capability
            .is_some_and(|capability| text(value, "capability") != Some(capability))
    {
        return false;
    }
    if present(value, "user_message")
        && object_member(value, "redaction").and_then(|redaction| text(redaction, "policy"))
            != Some("NONE")
    {
        return false;
    }
    if blocking == Some(true) && !token_in(result, &["BLOCKED", "FAILURE"]) {
        return false;
    }
    if result == Some("SUCCESS") {
        return blocking == Some(false) && reasons.is_empty() && severity == Some("INFO");
    }
    if reasons.is_empty() {
        return false;
    }
    match result {
        Some("WARNING") => blocking == Some(false) && token_in(severity, &["INFO", "WARNING"]),
        Some("FAILURE") => token_in(severity, &["CRITICAL", "ERROR"]),
        _ => blocking == Some(true),
    }
}

fn platform_evidence_integrity(value: &Value) -> bool {
    let reasons = items(value, "reason_codes");
    let method = text(value, "evaluation_method");
    let required_reference =
        evidence_required_reference(text(value, "artifact_kind").unwrap_or_default());
    if !unique_strings(reasons)
        || !platform_architecture_coherent(value)
        || flag(value, "synthetic_only") != Some(true)
        || required_reference.is_some_and(|name| !present(value, name))
        || (present(value, "package_artifact") && !present(value, "signature_state"))
    {
        return false;
    }
    if text(value, "review_state") == Some("REVIEW_COMPLETE")
        && !present(value, "reviewer_identity_ref")
    {
        return false;
    }
    if text(value, "owner_decision_state") == Some("RECORDED")
        && text(value, "review_state") != Some("REVIEW_COMPLETE")
    {
        return false;
    }
    if method == Some("MEASURED_NATIVE_RUN") {
        if !present(value, "os_version")
            || !present(value, "os_build")
            || text(value, "machine_class") == Some("SYNTHETIC_FIXTURE")
            || !token_in(text(value, "platform_id"), &CERTIFIED_PLATFORM_IDS)
        {
            return false;
        }
    } else if token_in(
        text(value, "machine_class"),
        &["HOSTED_CI_RUNNER", "PHYSICAL_DEVELOPMENT_MACHINE"],
    ) && method != Some("STATIC_INSPECTION")
    {
        return false;
    }
    if text(value, "result") == Some("SUCCESS") {
        reasons.is_empty()
    } else {
        !reasons.is_empty()
    }
}

fn platform_certification_input_scope(value: &Value) -> bool {
    let required = items(value, "required_evidence_kinds");
    let present_kinds = items(value, "present_evidence_kinds");
    let records = items(value, "evidence_record_refs");
    let reasons = items(value, "reason_codes");
    if !strictly_sorted_strings(required)
        || !strictly_sorted_strings(present_kinds)
        || !unique_strings(records)
        || !unique_strings(reasons)
        || !platform_architecture_coherent(value)
        || !platform_support_claim_sound(value)
    {
        return false;
    }
    let complete = subset_of(required, present_kinds) && !records.is_empty();
    if flag(value, "inventory_complete") != Some(complete) {
        return false;
    }
    if (text(value, "owner_decision_state") == Some("RECORDED"))
        != present(value, "owner_decision_ref")
    {
        return false;
    }
    if !platform_reviewed_tier_is_certified(value) {
        return !reasons.is_empty();
    }
    reasons.is_empty() && complete && text(value, "owner_decision_state") == Some("RECORDED")
}

fn present(value: &Value, name: &str) -> bool {
    member(value, name).is_some_and(|candidate| !candidate.is_null())
}

fn subset_of(inner: &[Value], outer: &[Value]) -> bool {
    inner.iter().all(|item| outer.contains(item))
}

fn contains_value(values: &[Value], expected: &str) -> bool {
    values.iter().any(|value| value.as_str() == Some(expected))
}

fn evaluate_semantic_rule(kind: SemanticRuleKind, value: &Value) -> bool {
    match kind {
        SemanticRuleKind::ApplicationSessionConsistency => application_session_consistency(value),
        SemanticRuleKind::AtomicClaimIntegrity => atomic_claim_integrity(value),
        SemanticRuleKind::AtsVariantScope => ats_variant_scope(value),
        SemanticRuleKind::BenchmarkCaseIntegrity => benchmark_case_integrity(value),
        SemanticRuleKind::BenchmarkResultIntegrity => benchmark_result_integrity(value),
        SemanticRuleKind::DriverVerifiedEvidence => driver_verified_evidence(value),
        SemanticRuleKind::FieldAddressIdentity => field_address_identity(value),
        SemanticRuleKind::FieldDecisionAuthority => field_decision_authority(value),
        SemanticRuleKind::FieldDescriptorObservation => field_descriptor_observation(value),
        SemanticRuleKind::GateDecisionIntegrity => gate_decision_integrity(value),
        SemanticRuleKind::GateEvidenceCompleteness => gate_evidence_completeness(value),
        SemanticRuleKind::GuidedRunSafety => guided_run_safety(value),
        SemanticRuleKind::HoldoutManifestIntegrity => holdout_manifest_integrity(value),
        SemanticRuleKind::InertTextSafety => inert_text_safe(value, 0),
        SemanticRuleKind::LayoutMeasurementIntegrity => layout_measurement_integrity(value),
        SemanticRuleKind::NavigationSafety => navigation_safety(value),
        SemanticRuleKind::PageReadinessIntegrity => page_readiness_integrity(value),
        SemanticRuleKind::PlatformBrowserDiscoverySafety => {
            platform_browser_discovery_safety(value)
        }
        SemanticRuleKind::PlatformBrowserRecordScope => platform_browser_record_scope(value),
        SemanticRuleKind::PlatformCapabilityReportIntegrity => {
            platform_capability_report_integrity(value)
        }
        SemanticRuleKind::PlatformCertificationInputScope => {
            platform_certification_input_scope(value)
        }
        SemanticRuleKind::PlatformDiagnosticIntegrity => platform_diagnostic_integrity(value),
        SemanticRuleKind::PlatformEvidenceIntegrity => platform_evidence_integrity(value),
        SemanticRuleKind::PlatformModelProfileEvidence => platform_model_profile_evidence(value),
        SemanticRuleKind::PlatformNativeRegistrationBinding => {
            platform_native_registration_binding(value)
        }
        SemanticRuleKind::PlatformNativeRegistrationResult => {
            platform_native_registration_result(value)
        }
        SemanticRuleKind::PlatformPackageStateEvidence => platform_package_state_evidence(value),
        SemanticRuleKind::PlatformPathRequestSafety => platform_path_request_safety(value),
        SemanticRuleKind::PlatformPathResolutionSafety => platform_path_resolution_safety(value),
        SemanticRuleKind::PlatformProcessPlanSafety => platform_process_plan_safety(value),
        SemanticRuleKind::PlatformProcessStatusIntegrity => {
            platform_process_status_integrity(value)
        }
        SemanticRuleKind::PlatformRuntimeCapabilityFallback => {
            platform_runtime_capability_fallback(value)
        }
        SemanticRuleKind::PlatformSecretRequestAuthority => {
            platform_secret_request_authority(value)
        }
        SemanticRuleKind::PlatformSecretResultIntegrity => platform_secret_result_integrity(value),
        SemanticRuleKind::PlatformTargetSupportClaim => platform_target_support_claim(value),
        SemanticRuleKind::ReconciliationReadiness => reconciliation_readiness(value),
        SemanticRuleKind::ResumePlanEvidence => resume_plan_evidence(value),
        SemanticRuleKind::WorkdayCertificationScope => workday_certification_scope(value),
        SemanticRuleKind::WorkdayStepBoundary => workday_step_boundary(value),
        SemanticRuleKind::WorkdayTenantIdentity => workday_tenant_identity(value),
    }
}

fn semantic_failure<'a>(
    semantic_rules: &'a SemanticRules,
    schema_ref: &str,
    value: &Value,
) -> Option<&'a str> {
    semantic_rules
        .entries
        .iter()
        .filter(|entry| entry.schema_ref == schema_ref)
        .find(|entry| !evaluate_semantic_rule(entry.rule_kind, value))
        .map(|entry| entry.failure_error_code.as_str())
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

fn validate_or_round_trip(
    request: &Request,
    value: Value,
    catalog: &Catalog,
    semantic_rules: &SemanticRules,
) -> CaseResult {
    if request.schema_ref.starts_with("http:") || request.schema_ref.starts_with("https:") {
        return CaseResult::invalid(request, "REMOTE_SCHEMA_REFERENCE");
    }
    if !ref_exists(catalog, &request.schema_ref) {
        return CaseResult::invalid(request, "UNKNOWN_SCHEMA_REFERENCE");
    }
    if schema_valid(catalog, &request.schema_ref, &value) != Ok(true) {
        return CaseResult::invalid(request, "SCHEMA_INVALID");
    }
    if let Some(error_code) = semantic_failure(semantic_rules, &request.schema_ref, &value) {
        return CaseResult::semantic_invalid(request, error_code);
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

fn version_result(
    request: &Request,
    value: &Value,
    catalog: &Catalog,
    semantic_rules: &SemanticRules,
) -> CaseResult {
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
    if let Some(error_code) = semantic_failure(semantic_rules, schema_id, payload) {
        let mut result = CaseResult::semantic_invalid(request, error_code);
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

fn process_request(
    request: &Request,
    catalog: &Catalog,
    security: &SecurityData,
    semantic_rules: &SemanticRules,
) -> CaseResult {
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
        Operation::VersionCheck => version_result(request, &value, catalog, semantic_rules),
        Operation::RoundTrip | Operation::Validate => {
            validate_or_round_trip(request, value, catalog, semantic_rules)
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
    let semantic_rules = load_semantic_rules(&repo, &catalog, &security)?;
    let response = BatchResponse {
        protocol_version: PROTOCOL_VERSION,
        language: "rust",
        results: batch
            .requests
            .iter()
            .map(|request| process_request(request, &catalog, &security, &semantic_rules))
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
    const W07_REPRESENTATIVES: [(&str, &str); 19] = [
        (
            "w07.browser-discovery-request",
            "urn:japp:schema:platform:browser-discovery-request:v1",
        ),
        (
            "w07.browser-record",
            "urn:japp:schema:platform:browser-record:v1",
        ),
        (
            "w07.capability-report",
            "urn:japp:schema:platform:capability-report:v1",
        ),
        (
            "w07.certification-input",
            "urn:japp:schema:platform:certification-input:v1",
        ),
        (
            "w07.diagnostic-report",
            "urn:japp:schema:platform:diagnostic-report:v1",
        ),
        (
            "w07.evidence-record",
            "urn:japp:schema:platform:evidence-record:v1",
        ),
        (
            "w07.installer-state",
            "urn:japp:schema:platform:installer-state:v1",
        ),
        (
            "w07.model-runtime-profile",
            "urn:japp:schema:platform:model-runtime-profile:v1",
        ),
        (
            "w07.native-messaging-registration",
            "urn:japp:schema:platform:native-messaging-registration:v1",
        ),
        (
            "w07.native-messaging-result",
            "urn:japp:schema:platform:native-messaging-result:v1",
        ),
        (
            "w07.path-request",
            "urn:japp:schema:platform:path-request:v1",
        ),
        (
            "w07.path-resolution",
            "urn:japp:schema:platform:path-resolution:v1",
        ),
        (
            "w07.process-plan",
            "urn:japp:schema:platform:process-plan:v1",
        ),
        (
            "w07.process-status",
            "urn:japp:schema:platform:process-status:v1",
        ),
        (
            "w07.runtime-capability",
            "urn:japp:schema:platform:runtime-capability:v1",
        ),
        (
            "w07.secret-store-request",
            "urn:japp:schema:platform:secret-store-request:v1",
        ),
        (
            "w07.secret-store-result",
            "urn:japp:schema:platform:secret-store-result:v1",
        ),
        (
            "w07.target-identity",
            "urn:japp:schema:platform:target-identity:v1",
        ),
        (
            "w07.update-state",
            "urn:japp:schema:platform:update-state:v1",
        ),
    ];

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

    #[test]
    fn canonical_semantic_rules_are_structural_finite_and_complete() {
        let repo = repository_root();
        let catalog = load_catalog(&repo).expect("schema catalog loads");
        let security = load_security_data(&repo).expect("security data loads");
        let rules = load_semantic_rules(&repo, &catalog, &security).expect("semantic rules load");
        assert_eq!(rules.entries.len(), 80);
        assert_eq!(
            rules
                .entries
                .iter()
                .map(|entry| entry.rule_kind)
                .collect::<BTreeSet<_>>()
                .len(),
            SemanticRuleKind::TOKENS.len()
        );
        assert_eq!(
            semantic_failure(
                &rules,
                "urn:japp:schema:form:field-address:v1",
                &json!({"route_signature": "digest_only"})
            ),
            Some("SITE_AMBIGUOUS_CONTROL")
        );
    }

    #[test]
    fn w06_representative_values_use_structural_semantic_and_serde_round_trips() {
        let repo = repository_root();
        let catalog = load_catalog(&repo).expect("schema catalog loads");
        let security = load_security_data(&repo).expect("security data loads");
        let rules = load_semantic_rules(&repo, &catalog, &security).expect("semantic rules load");
        let document: Value =
            read_json(repo.join("packages/contracts/test/contract/corpus/values.v1.json"))
                .expect("corpus values read");
        let values = document["values"].as_object().expect("values object");
        let representatives = [
            (
                "w06.application-session",
                "urn:japp:schema:session:application-session:v1",
            ),
            ("w06.atomic-claim", "urn:japp:schema:resume:atomic-claim:v1"),
            ("w06.ats-variant", "urn:japp:schema:ats:variant-identity:v1"),
            ("w06.benchmark-case", "urn:japp:schema:benchmark:case:v1"),
            (
                "w06.benchmark-result",
                "urn:japp:schema:benchmark:result:v1",
            ),
            ("w06.driver-result", "urn:japp:schema:form:driver-result:v1"),
            (
                "w06.field-address-full",
                "urn:japp:schema:form:field-address:v1",
            ),
            (
                "w06.field-address-minimal",
                "urn:japp:schema:form:field-address:v1",
            ),
            (
                "w06.field-decision",
                "urn:japp:schema:form:field-decision:v1",
            ),
            (
                "w06.field-descriptor",
                "urn:japp:schema:form:field-descriptor:v1",
            ),
            ("w06.gate-decision", "urn:japp:schema:gate:decision:v1"),
            (
                "w06.gate-evidence",
                "urn:japp:schema:gate:evidence-bundle:v1",
            ),
            (
                "w06.guided-run-mode",
                "urn:japp:schema:session:guided-run-mode:v1",
            ),
            (
                "w06.holdout-manifest",
                "urn:japp:schema:benchmark:holdout-manifest:v1",
            ),
            (
                "w06.layout-measurement",
                "urn:japp:schema:rendering:layout-measurement:v1",
            ),
            (
                "w06.navigation-record",
                "urn:japp:schema:session:navigation-record:v1",
            ),
            (
                "w06.page-readiness",
                "urn:japp:schema:session:page-readiness-proof:v1",
            ),
            (
                "w06.reconciliation",
                "urn:japp:schema:form:reconciliation-inventory:v1",
            ),
            ("w06.resume-plan", "urn:japp:schema:resume:plan:v1"),
            (
                "w06.step-identity",
                "urn:japp:schema:workday:step-identity:v1",
            ),
            (
                "w06.tenant-fingerprint",
                "urn:japp:schema:workday:tenant-fingerprint:v1",
            ),
            (
                "w06.workday-certification",
                "urn:japp:schema:workday:certification-record:v1",
            ),
        ];
        for (value_ref, schema_ref) in representatives {
            let value = values
                .get(value_ref)
                .unwrap_or_else(|| panic!("{value_ref} exists"))
                .clone();
            assert_eq!(
                schema_valid(&catalog, schema_ref, &value),
                Ok(true),
                "{value_ref} structurally validates"
            );
            assert_eq!(
                semantic_failure(&rules, schema_ref, &value),
                None,
                "{value_ref} semantically validates"
            );
            assert_eq!(
                typed_round_trip(schema_ref, value.clone()),
                Ok(value),
                "{value_ref} serde round-trips"
            );
        }

        let gate_ref = "urn:japp:schema:gate:evidence-bundle:v1";
        let required_gate = values
            .get("w06.gate-evidence")
            .expect("gate evidence exists")
            .clone();
        assert!(gate_evidence_completeness(&required_gate));
        let mut not_required_gate = required_gate.clone();
        let not_required_object = not_required_gate
            .as_object_mut()
            .expect("gate evidence object");
        let owner_decision = not_required_object
            .remove("owner_decision_ref")
            .expect("required variant carries owner decision");
        not_required_object["completeness_inventory"]
            .as_object_mut()
            .expect("completeness inventory object")
            .insert(
                "owner_decision_requirement".to_owned(),
                Value::String("NOT_REQUIRED".to_owned()),
            );
        assert_eq!(
            schema_valid(&catalog, gate_ref, &not_required_gate),
            Ok(true)
        );
        assert_eq!(semantic_failure(&rules, gate_ref, &not_required_gate), None);
        assert_eq!(
            typed_round_trip(gate_ref, not_required_gate.clone()),
            Ok(not_required_gate.clone())
        );

        let mut mismatched_gate = not_required_gate;
        mismatched_gate
            .as_object_mut()
            .expect("gate evidence object")
            .insert("owner_decision_ref".to_owned(), owner_decision);
        assert_eq!(
            semantic_failure(&rules, gate_ref, &mismatched_gate),
            Some("GATE_EVIDENCE_MISSING")
        );
    }

    #[test]
    fn w06_cross_field_safety_edges_fail_closed() {
        let repo = repository_root();
        let document: Value =
            read_json(repo.join("packages/contracts/test/contract/corpus/values.v1.json"))
                .expect("corpus values read");
        let values = document["values"].as_object().expect("values object");

        let mut proposal = values["w06.field-decision"].clone();
        let proposal_object = proposal.as_object_mut().expect("field decision object");
        proposal_object.insert(
            "final_decision".to_owned(),
            Value::String("PROPOSE".to_owned()),
        );
        proposal_object.insert(
            "value_source_type".to_owned(),
            Value::String("MODEL_PROPOSAL".to_owned()),
        );
        proposal_object.remove("value_source_ref");
        let _ = proposal_object;
        assert!(!field_decision_authority(&proposal));
        proposal
            .as_object_mut()
            .expect("field decision object")
            .insert(
                "value_source_ref".to_owned(),
                Value::String("proposal_0123456789ABCDEFGHJKMNPQRS".to_owned()),
            );
        assert!(field_decision_authority(&proposal));

        let mut confirmation = values["w06.field-decision"].clone();
        confirmation
            .as_object_mut()
            .expect("field decision object")
            .remove("user_confirmation_ref");
        assert!(!field_decision_authority(&confirmation));

        let navigation = &values["w06.navigation-record"];
        let mut protected_source = navigation.clone();
        let protected_source_object = protected_source.as_object_mut().expect("navigation object");
        let protected_step = protected_source_object["source_step_identity"]
            .as_object_mut()
            .expect("source step object");
        protected_step.insert("step_family".to_owned(), Value::String("LOGIN".to_owned()));
        protected_step.insert(
            "boundary_class".to_owned(),
            Value::String("PROTECTED_AUTHENTICATION".to_owned()),
        );
        assert!(!navigation_safety(&protected_source));

        let mut expected_mismatch = navigation.clone();
        let expected_object = expected_mismatch
            .as_object_mut()
            .expect("navigation object");
        expected_object.insert(
            "expected_destination_family".to_owned(),
            Value::String("GUEST_APPLICATION".to_owned()),
        );
        expected_object.insert(
            "allowed_destination_families".to_owned(),
            json!(["AUTHENTICATED_APPLICATION", "GUEST_APPLICATION"]),
        );
        assert!(!navigation_safety(&expected_mismatch));

        let mut destination_session_mismatch = navigation.clone();
        destination_session_mismatch["observed_destination_identity"]["session_id"] =
            Value::String("session_1123456789ABCDEFGHJKMNPQRS".to_owned());
        assert!(!navigation_safety(&destination_session_mismatch));

        let mut destination_generation_mismatch = navigation.clone();
        destination_generation_mismatch["observed_resulting_generation"] = json!(9);
        assert!(!navigation_safety(&destination_generation_mismatch));

        let mut paused_without_boundary = navigation.clone();
        let paused_object = paused_without_boundary
            .as_object_mut()
            .expect("navigation object");
        paused_object.insert(
            "outcome".to_owned(),
            Value::String("PAUSED_BOUNDARY".to_owned()),
        );
        paused_object.remove("observed_destination_identity");
        paused_object.remove("observed_resulting_generation");
        assert!(!navigation_safety(&paused_without_boundary));

        let mut workday_without_tenant = values["w06.application-session"].clone();
        workday_without_tenant
            .as_object_mut()
            .expect("application session object")
            .remove("workday_tenant_fingerprint");
        assert!(application_session_consistency(&workday_without_tenant));

        let mut non_workday_with_tenant = values["w06.application-session"].clone();
        non_workday_with_tenant["ats_variant"]["ats_family"] =
            Value::String("GREENHOUSE".to_owned());
        non_workday_with_tenant["ats_variant"]["route_page_family"] =
            Value::String("APPLICATION_FORM".to_owned());
        assert!(!application_session_consistency(&non_workday_with_tenant));

        let mut missing_assignment = values["w06.resume-plan"].clone();
        missing_assignment["evidence_assignments"] = json!([]);
        assert!(!resume_plan_evidence(&missing_assignment));
        let mut missing_gap = values["w06.resume-plan"].clone();
        missing_gap["unsupported_gap_refs"] = json!([]);
        assert!(!resume_plan_evidence(&missing_gap));

        let mut blocked_sensitive = values["w06.reconciliation"].clone();
        blocked_sensitive["items"][0]["category"] = Value::String("BLOCKED_SENSITIVE".to_owned());
        blocked_sensitive["items"][0]["confirmation_state"] = Value::String("MISSING".to_owned());
        blocked_sensitive["counts"]["verified_filled"] = json!(0);
        blocked_sensitive["counts"]["blocked_sensitive"] = json!(1);
        blocked_sensitive["counts"]["unconfirmed_consequential"] = json!(1);
        blocked_sensitive["readiness"] = Value::String("NOT_READY".to_owned());
        assert!(reconciliation_readiness(&blocked_sensitive));
        blocked_sensitive["readiness"] = Value::String("READY".to_owned());
        assert!(!reconciliation_readiness(&blocked_sensitive));

        let mut wrong_page_number = values["w06.layout-measurement"].clone();
        wrong_page_number["page_content_bounds"][0]["page_number"] = json!(2);
        assert!(!layout_measurement_integrity(&wrong_page_number));
        let mut outside_page = values["w06.layout-measurement"].clone();
        outside_page["page_content_bounds"][0]["x"] = json!(600);
        outside_page["page_content_bounds"][0]["width"] = json!(100);
        assert!(!layout_measurement_integrity(&outside_page));

        let mut renderer_failure = values["w06.layout-measurement"].clone();
        renderer_failure["page_count"] = json!(0);
        renderer_failure["page_content_bounds"] = json!([]);
        renderer_failure["renderer_succeeded"] = json!(false);
        renderer_failure["layout_result"] = Value::String("RENDER_FAILED".to_owned());
        renderer_failure["error_reason_codes"] = json!(["RENDERING_FAILURE"]);
        assert!(layout_measurement_integrity(&renderer_failure));
        renderer_failure["renderer_succeeded"] = json!(true);
        renderer_failure["layout_result"] = Value::String("ACCEPTED".to_owned());
        renderer_failure["error_reason_codes"] = json!([]);
        assert!(!layout_measurement_integrity(&renderer_failure));

        let mut unsupported_fail = values["w06.benchmark-result"].clone();
        unsupported_fail["overall_outcome"] = Value::String("FAIL".to_owned());
        assert!(!benchmark_result_integrity(&unsupported_fail));
        unsupported_fail["metric_results"][0]["passed"] = json!(false);
        assert!(benchmark_result_integrity(&unsupported_fail));

        let mut unsorted_holdout = values["w06.holdout-manifest"].clone();
        unsorted_holdout["schema_versions"] = json!([
            {
                "schema_ref": "urn:japp:schema:benchmark:result:v1",
                "schema_version": "1.0.0"
            },
            {
                "schema_ref": "urn:japp:schema:benchmark:case:v1",
                "schema_version": "1.0.0"
            }
        ]);
        assert!(!holdout_manifest_integrity(&unsorted_holdout));
        unsorted_holdout["schema_versions"]
            .as_array_mut()
            .expect("schema version inventory")
            .reverse();
        assert!(holdout_manifest_integrity(&unsorted_holdout));

        assert!(canonical_utc_not_before(
            Some("2026-07-27T04:00:00.1Z"),
            Some("2026-07-27T04:00:00Z")
        ));
        assert!(!canonical_utc_not_before(
            Some("2026-07-27T04:00:00Z"),
            Some("2026-07-27T04:00:00.1Z")
        ));
    }

    #[test]
    fn w07_platform_representatives_round_trip_and_validate() {
        let repo = repository_root();
        let catalog = load_catalog(&repo).expect("schema catalog loads");
        let security = load_security_data(&repo).expect("security data loads");
        let rules = load_semantic_rules(&repo, &catalog, &security).expect("rules load");
        let document: Value =
            read_json(repo.join("packages/contracts/test/contract/corpus/values.v1.json"))
                .expect("corpus values read");
        let values = document["values"].as_object().expect("values object");
        for (value_ref, schema_ref) in W07_REPRESENTATIVES {
            let value = values
                .get(value_ref)
                .unwrap_or_else(|| panic!("{value_ref} exists"))
                .clone();
            assert_eq!(
                schema_valid(&catalog, schema_ref, &value),
                Ok(true),
                "{value_ref} structurally validates"
            );
            assert_eq!(
                semantic_failure(&rules, schema_ref, &value),
                None,
                "{value_ref} semantically validates"
            );
            assert_eq!(
                typed_round_trip(schema_ref, value.clone()),
                Ok(value),
                "{value_ref} serde round-trips"
            );
        }
    }

    #[test]
    fn w07_platform_trust_boundaries_fail_closed() {
        let repo = repository_root();
        let document: Value =
            read_json(repo.join("packages/contracts/test/contract/corpus/values.v1.json"))
                .expect("corpus values read");
        let values = document["values"].as_object().expect("values object");

        // A support tier is never self-asserted by an untrusted record.
        let mut certified_without_review = values["w07.target-identity"].clone();
        certified_without_review["support_claim"]["reviewed_tier"] =
            Value::String("CERTIFIED_CORE".to_owned());
        assert!(!platform_target_support_claim(&certified_without_review));

        let mut unsupported_certified = values["w07.target-identity"].clone();
        unsupported_certified["platform_id"] = Value::String("UNSUPPORTED_TARGET".to_owned());
        unsupported_certified["architecture"] = Value::String("UNKNOWN_ARCHITECTURE".to_owned());
        unsupported_certified["support_claim"]["reviewed_tier"] =
            Value::String("CERTIFIED_FULL".to_owned());
        assert!(!platform_target_support_claim(&unsupported_certified));

        // A missing local-AI profile degrades AI only; the core tier survives.
        let core_report = values["w07.capability-report"].clone();
        assert!(platform_capability_report_integrity(&core_report));
        let mut full_without_runtime = core_report.clone();
        full_without_runtime["support_claim"]["reviewed_tier"] =
            Value::String("CERTIFIED_FULL".to_owned());
        assert!(!platform_capability_report_integrity(&full_without_runtime));

        // Platform authority is never reachable from the page world.
        let mut content_script_path = values["w07.path-request"].clone();
        content_script_path["request_context"]["requesting_principal"] =
            Value::String("EXTENSION_CONTENT_SCRIPT".to_owned());
        assert!(!platform_path_request_safety(&content_script_path));

        let mut content_script_secret = values["w07.secret-store-request"].clone();
        content_script_secret["request_context"]["requesting_principal"] =
            Value::String("EXTENSION_CONTENT_SCRIPT".to_owned());
        assert!(!platform_secret_request_authority(&content_script_secret));

        // A resolved location must stay anchored to the requested role.
        let mut mismatched_role = values["w07.path-resolution"].clone();
        mismatched_role["sanitized_path"] = Value::String("<CACHE>/artifacts".to_owned());
        assert!(!platform_path_resolution_safety(&mismatched_role));

        // An interpreter plus free-form arguments is refused even when every
        // token satisfies the bounded argument grammar.
        let mut interpreter_plan = values["w07.process-plan"].clone();
        interpreter_plan["arguments"] = json!(["sh", "serve"]);
        assert!(!platform_process_plan_safety(&interpreter_plan));
        let mut inherited_environment = values["w07.process-plan"].clone();
        inherited_environment["inherit_parent_environment"] = json!(true);
        assert!(!platform_process_plan_safety(&inherited_environment));

        // The native host must use Windows-safe length-prefixed binary stdio.
        let mut text_mode_host = values["w07.native-messaging-registration"].clone();
        text_mode_host["binary_stdio_mode"] = Value::String("PIPE_BOUNDED".to_owned());
        assert!(!platform_native_registration_binding(&text_mode_host));

        // No profile is acceptable without measured evidence.
        let mut accepted_without_evidence = values["w07.model-runtime-profile"].clone();
        accepted_without_evidence["acceptance_state"] = Value::String("ACCEPTED".to_owned());
        accepted_without_evidence["availability"] = Value::String("AVAILABLE".to_owned());
        accepted_without_evidence["core_capability_behavior"] =
            Value::String("FULL_AI_AVAILABLE".to_owned());
        accepted_without_evidence["reason_codes"] = json!([]);
        assert!(!platform_model_profile_evidence(&accepted_without_evidence));

        // A diagnostic cannot report success while carrying a blocking reason.
        let mut contradictory_diagnostic = values["w07.diagnostic-report"].clone();
        contradictory_diagnostic["blocking"] = json!(true);
        contradictory_diagnostic["reason_codes"] = json!(["PERMISSION_DENIED"]);
        assert!(!platform_diagnostic_integrity(&contradictory_diagnostic));

        // Committed platform evidence stays synthetic.
        let mut real_evidence = values["w07.evidence-record"].clone();
        real_evidence["synthetic_only"] = json!(false);
        assert!(!platform_evidence_integrity(&real_evidence));

        // Certification needs a complete inventory and a recorded decision.
        let mut premature_certification = values["w07.certification-input"].clone();
        premature_certification["inventory_complete"] = json!(true);
        assert!(!platform_certification_input_scope(
            &premature_certification
        ));
    }
}
