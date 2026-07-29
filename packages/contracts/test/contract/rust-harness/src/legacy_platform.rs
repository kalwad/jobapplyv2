//! Deprecated v1 platform semantics preserved from the first published M01-W07 revision.

#![allow(dead_code)] // The complete snapshot intentionally retains unchanged-root helpers.

use super::*;

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
    let Some(platform_id) = text(value, "platform_id") else {
        return false;
    };
    let reasons = items(value, "reason_codes");
    if !unique_strings(reasons) || !platform_support_claim_sound(value) {
        return false;
    }
    if let Some(expected) = platform_expected_architecture(platform_id)
        && text(value, "architecture") != Some(expected)
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

pub(super) fn platform_capability_report_integrity(value: &Value) -> bool {
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

pub(super) fn platform_path_resolution_safety(value: &Value) -> bool {
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

pub(super) fn platform_secret_result_integrity(value: &Value) -> bool {
    let operation = text(value, "operation");
    let availability = text(value, "store_availability");
    let state = text(value, "result_state");
    let reasons = items(value, "reason_codes");
    let has_material = present(value, "material_reference");
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
    if operation == Some("STATUS") {
        return !has_material
            && !present(value, "material_digest")
            && token_in(
                state,
                &["DENIED_PERMISSION", "STORE_AVAILABLE", "STORE_UNAVAILABLE"],
            )
            && (state != Some("STORE_AVAILABLE")
                || (availability == Some("AVAILABLE") && reasons.is_empty()));
    }
    match state {
        Some("STORE_AVAILABLE") => false,
        Some("RETRIEVED") => {
            operation == Some("GET")
                && availability == Some("AVAILABLE")
                && has_material
                && present(value, "material_digest")
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
                && !present(value, "material_digest")
                && reasons.is_empty()
        }
        Some("DENIED_PERMISSION") => {
            !has_material
                && contains_value(reasons, "PERMISSION_DENIED")
                && token_in(availability, &["PERMISSION_REQUIRED", "UNAVAILABLE"])
        }
        _ => !has_material && !reasons.is_empty(),
    }
}

pub(super) fn platform_process_plan_safety(value: &Value) -> bool {
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
    let modes = [text(value, "stdin_mode"), text(value, "stdout_mode")];
    if text(value, "profile") == Some("NATIVE_MESSAGING_HOST") {
        return modes
            .iter()
            .all(|mode| *mode == Some("BINARY_LENGTH_PREFIXED"));
    }
    modes
        .iter()
        .all(|mode| *mode != Some("BINARY_LENGTH_PREFIXED"))
}

pub(super) fn platform_process_status_integrity(value: &Value) -> bool {
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

pub(super) fn platform_native_registration_binding(value: &Value) -> bool {
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

pub(super) fn platform_native_registration_result(value: &Value) -> bool {
    let operation = text(value, "operation");
    let observed = text(value, "observed_state");
    let reasons = items(value, "reason_codes");
    let changed = flag(value, "changed");
    if !unique_strings(reasons)
        || text(value, "browser_family") != Some("CHROME")
        || (operation == Some("VERIFY") && changed != Some(false))
    {
        return false;
    }
    if observed == Some("PRESENT_VALID") {
        if !present(value, "observed_manifest_digest")
            || !present(value, "observed_host_version")
            || !reasons.is_empty()
        {
            return false;
        }
    } else if reasons.is_empty() {
        return false;
    }
    if observed == Some("MISMATCHED_IDENTITY") && !contains_value(reasons, "IDENTITY_MISMATCH") {
        return false;
    }
    if observed == Some("NOT_EVALUATED") {
        return changed == Some(false) && contains_value(reasons, "EVALUATION_NOT_RUN");
    }
    if reasons.is_empty() {
        let expected = if operation == Some("REMOVE") {
            "ABSENT"
        } else {
            "PRESENT_VALID"
        };
        return observed == Some(expected) && flag(value, "idempotent_repeat_safe") == Some(true);
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

pub(super) fn platform_browser_record_scope(value: &Value) -> bool {
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

pub(super) fn platform_model_profile_evidence(value: &Value) -> bool {
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

pub(super) fn platform_runtime_capability_fallback(value: &Value) -> bool {
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

pub(super) fn platform_package_state_evidence(value: &Value) -> bool {
    let state = text(value, "state").unwrap_or_default();
    let reasons = items(value, "reason_codes");
    let signature = text(value, "signature_state");
    let interrupted = flag(value, "interrupted");
    let preservation = text(value, "user_data_preservation");
    if !unique_strings(reasons)
        || !unique_strings(items(value, "evidence_refs"))
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

pub(super) fn platform_diagnostic_integrity(value: &Value) -> bool {
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

pub(super) fn platform_evidence_integrity(value: &Value) -> bool {
    let reasons = items(value, "reason_codes");
    let method = text(value, "evaluation_method");
    let required_reference =
        evidence_required_reference(text(value, "artifact_kind").unwrap_or_default());
    if !unique_strings(reasons)
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

pub(super) fn platform_certification_input_scope(value: &Value) -> bool {
    let required = items(value, "required_evidence_kinds");
    let present_kinds = items(value, "present_evidence_kinds");
    let records = items(value, "evidence_record_refs");
    let reasons = items(value, "reason_codes");
    if !strictly_sorted_strings(required)
        || !strictly_sorted_strings(present_kinds)
        || !unique_strings(records)
        || !unique_strings(reasons)
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
