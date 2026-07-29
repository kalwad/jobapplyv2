//! Deprecated v1 platform semantics preserved from the last published M01-W07 content anchor.

#![allow(dead_code)] // The complete snapshot intentionally retains unchanged-root helpers.

use super::*;

// Exact evaluator snapshot from 0659c13ff046c921ca648c50b40e71330abf2e75, with visibility narrowed to the
// 14 migrated entry points required by deprecated-v1 accepted-set dispatch.

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
/// Privilege escalation is documented as structurally unrepresentable, so the
/// launcher that would request it may not travel as an argument either.
const PLATFORM_PRIVILEGE_TOKENS: [&str; 5] = ["doas", "pkexec", "runas", "su", "sudo"];
/// A refused command name must stay refused in its executable-suffix spelling.
const PLATFORM_EXECUTABLE_SUFFIXES: [&str; 6] = [".bat", ".cmd", ".com", ".exe", ".ps1", ".sh"];
const PLATFORM_PATH_ROLES: [&str; 9] = [
    "APPLICATION_DATA",
    "ARTIFACT_STORE",
    "BACKUP_STAGING",
    "CACHE",
    "DIAGNOSTIC_BUNDLE",
    "LOG_STORE",
    "MODEL_ARTIFACT_STORE",
    "NATIVE_HOST_REGISTRATION",
    "TEMPORARY",
];
/// REQ-PLAT-003 binds local services to loopback. The bounded token grammar
/// cannot start with a colon, so the compressed "::1" spelling is structurally
/// unrepresentable and only the expanded form appears here.
const PLATFORM_LOOPBACK_HOSTS: [&str; 3] = ["0:0:0:0:0:0:0:1", "127.0.0.1", "localhost"];
const OPERABLE_RUNTIME_AVAILABILITY: [&str; 2] = ["AVAILABLE", "DEGRADED_LIMITED"];
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
/// The two terminal states whose meaning is "the interruption is unresolved".
const PACKAGE_INTERRUPTED_STATES: [&str; 2] = ["INSTALL_INTERRUPTED", "UPDATE_INTERRUPTED"];

/// Specification §5.14.8 binds each certified target to its package formats.
fn platform_package_formats(platform_id: &str) -> Option<&'static [&'static str]> {
    match platform_id {
        "MACOS_ARM64" => Some(&["APPLE_DISK_IMAGE"]),
        "UBUNTU_X64" => Some(&["APP_IMAGE", "DEBIAN_PACKAGE"]),
        "WINDOWS_X64" => Some(&["WINDOWS_INSTALLER"]),
        _ => None,
    }
}

/// Normalize one argument to the command name it would actually invoke.
fn platform_command_token(argument: &str) -> String {
    let lowered = argument.to_lowercase();
    for suffix in PLATFORM_EXECUTABLE_SUFFIXES {
        if let Some(stripped) = lowered.strip_suffix(suffix) {
            return stripped.to_string();
        }
    }
    lowered
}

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
    // A certified tier is a reviewed claim about a real machine. Only a
    // measured native run can support it, exactly as
    // platform_target_support_claim already requires of the identical
    // support_claim record, so a declared plan or a synthetic fixture can never
    // carry a certification.
    let measured = |family: &str| -> bool {
        capabilities.iter().any(|state| {
            text(state, "capability") == Some(family)
                && text(state, "availability") == Some("AVAILABLE")
                && text(state, "evaluation_method") == Some("MEASURED_NATIVE_RUN")
        })
    };
    if !MANDATORY_CORE_CAPABILITIES
        .iter()
        .all(|family| measured(family))
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
    measured("MODEL_RUNTIME") && !items(value, "model_profile_refs").is_empty()
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
    let state = text(value, "resolution_state");
    if state != Some("RESOLVED") {
        // A location is disclosed only by a resolution that succeeded, and a
        // resolution that did not succeed can never report a writable location.
        if sanitized.is_some()
            || present(value, "path_digest")
            || flag(value, "writable") != Some(false)
            || reasons.is_empty()
        {
            return false;
        }
        if state == Some("DENIED_PERMISSION") {
            // A refusal may report that the location exists — a permission
            // error is itself that observation — but never where it is.
            return contains_value(reasons, "PERMISSION_DENIED");
        }
        // Nothing was evaluated, or nothing was reachable, so nothing was
        // observed.
        return flag(value, "exists") == Some(false)
            && (state != Some("NOT_EVALUATED") || contains_value(reasons, "EVALUATION_NOT_RUN"));
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
    // A refused command name stays refused in its executable-suffix spelling:
    // "cmd" and "cmd.exe" name the same interpreter. Privilege escalation is
    // documented as unrepresentable, so its launcher cannot travel either.
    if command_arguments.iter().any(|argument| {
        argument.as_str().is_some_and(|raw| {
            let token = platform_command_token(raw);
            PLATFORM_INTERPRETER_TOKENS.contains(&token.as_str())
                || PLATFORM_PRIVILEGE_TOKENS.contains(&token.as_str())
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
                    || entry_value.starts_with('0')
                    || !entry_value.bytes().all(|byte| byte.is_ascii_digit())
                    || entry_value.parse::<u32>().unwrap_or(u32::MAX) > 65535
                {
                    return false;
                }
            }
            // The path role carried into a child is the same closed vocabulary
            // the working directory uses, and it cannot re-admit the
            // registration role the rule refuses above.
            Some("JAPP_PATH_ROLE") => {
                if !PLATFORM_PATH_ROLES.contains(&entry_value)
                    || entry_value == "NATIVE_HOST_REGISTRATION"
                {
                    return false;
                }
            }
            // REQ-PLAT-003 binds local services to loopback.
            Some("JAPP_SERVICE_BIND_HOST") if !PLATFORM_LOOPBACK_HOSTS.contains(&entry_value) => {
                return false;
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

pub(super) fn platform_process_status_integrity(value: &Value) -> bool {
    let state = text(value, "state");
    let reasons = items(value, "reason_codes");
    let ended = present(value, "ended_at");
    let started = present(value, "started_at");
    let exited = present(value, "exit_code");
    let orphan = flag(value, "orphan_detected");
    let exit_code = member(value, "exit_code").and_then(Value::as_u64);
    let terminating = text(value, "termination_requested") != Some("NONE");
    if !unique_strings(reasons) {
        return false;
    }
    // A process cannot end without starting, end before it started, be
    // restarted without starting, or attach a redacted diagnostic to nothing.
    if (ended && !started)
        || (ended && !canonical_utc_not_before(text(value, "ended_at"), text(value, "started_at")))
        || (member(value, "restart_count")
            .and_then(Value::as_u64)
            .unwrap_or(0)
            > 0
            && !started)
        || (present(value, "diagnostic_digest") && reasons.is_empty())
    {
        return false;
    }
    // orphan_detected is a historical observation, not the current state: it
    // stays true on the terminal record of an orphan that was cleaned up or was
    // finally seen to exit.
    if orphan == Some(true) && !token_in(state, &["ORPHANED", "TERMINATED", "EXITED"]) {
        return false;
    }
    match state {
        Some("STARTING") => !ended && !exited,
        Some("RUNNING") => started && !ended && !exited,
        Some("TERMINATING") => started && !ended && !exited && terminating,
        // The child ended on its own; a supervisor-requested stop is
        // TERMINATED. A clean exit explains itself, and any other exit status
        // must be explainable through the finite reason vocabulary.
        Some("EXITED") => {
            started
                && ended
                && exited
                && !terminating
                && (if exit_code == Some(0) {
                    reasons.is_empty()
                } else {
                    !reasons.is_empty()
                })
        }
        Some("TERMINATED") => started && ended && terminating,
        // An orphan outlived its supervising parent and still requires cleanup,
        // so it has started and has not yet been observed to end.
        Some("ORPHANED") => {
            started && !ended && !exited && orphan == Some(true) && !reasons.is_empty()
        }
        Some("UNAVAILABLE") => !started && !ended && !exited && !reasons.is_empty(),
        // FAILED: supervision itself failed. An observed exit status would make
        // this an EXITED child instead, so the two stay distinguishable.
        _ => !exited && !reasons.is_empty(),
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
        // Specification §5.14.5 keeps the extension allowlist and the
        // message-size limit mandatory on every platform.
        || !present(value, "max_message_bytes")
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
    // nothing was evaluated. The observed_state member is the post-operation
    // registration state, never a claim that the operation succeeded, so a
    // removal that failed and left the registration intact still observes
    // PRESENT_VALID.
    if observed == Some("PRESENT_VALID") && !(manifest_digest && host_version) {
        return false;
    }
    // An identity verdict must carry the identity evidence it is about.
    if observed == Some("MISMATCHED_IDENTITY") && !manifest_digest {
        return false;
    }
    if observed == Some("PRESENT_STALE") && !host_version {
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
        // A presence claim is an observation, so it cannot come from an
        // explicitly unevaluated detection.
        if !present(value, "detected_version")
            || text(value, "detection_method") == Some("NOT_EVALUATED")
        {
            return false;
        }
    } else if present(value, "sanitized_install_location") {
        return false;
    } else if presence != Some("DEGRADED_LIMITED")
        && presence != Some("INCOMPATIBLE_VERSION")
        && present(value, "detected_version")
    {
        // Only a browser that was actually found reports a version. A degraded
        // or version-incompatible observation found one; an absent,
        // unevaluated, or unsupported one did not.
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
    // The accelerator, the runtime family, and the target must agree in both
    // directions. The certified macOS target is Apple Silicon arm64
    // (specification §5.14.1) and every CUDA profile the §5.14.6 list names is
    // a Windows or Ubuntu profile, so a macOS CUDA profile describes hardware
    // that cannot exist.
    if accelerator == Some("APPLE_SILICON_GPU") && platform_id != "MACOS_ARM64" {
        return false;
    }
    if accelerator == Some("NVIDIA_CUDA") && platform_id == "MACOS_ARM64" {
        return false;
    }
    if accelerator == Some("NVIDIA_CUDA")
        && (!present(value, "minimum_vram_mib") || !present(value, "minimum_driver_version"))
    {
        return false;
    }
    if accelerator == Some("CPU_ONLY")
        && (present(value, "minimum_vram_mib") || present(value, "minimum_driver_version"))
    {
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
    let availability = text(value, "runtime_availability").unwrap_or_default();
    let platform_id = text(value, "platform_id").unwrap_or_default();
    let family = text(value, "runtime_family");
    let accelerator = text(value, "accelerator");
    if !unique_strings(available)
        || !unique_strings(accepted)
        || !unique_strings(reasons)
        || !subset_of(accepted, available)
    {
        return false;
    }
    // A detected runtime identity must agree with the target, exactly as the
    // reviewed model-profile rule already requires of a declared profile.
    if (accelerator == Some("APPLE_SILICON_GPU") && platform_id != "MACOS_ARM64")
        || (accelerator == Some("NVIDIA_CUDA") && platform_id == "MACOS_ARM64")
        || (family == Some("OLLAMA_MLX")
            && (platform_id != "MACOS_ARM64" || accelerator != Some("APPLE_SILICON_GPU")))
        || (family == Some("OLLAMA_GGUF") && accelerator == Some("APPLE_SILICON_GPU"))
    {
        return false;
    }
    // An unevaluated runtime is exactly an unevaluated detection.
    if (text(value, "detection_method") == Some("NOT_EVALUATED"))
        != (availability == "NOT_EVALUATED")
    {
        return false;
    }
    // A capability that was never evaluated, or that cannot exist on this
    // target at all, observed no runtime identity.
    if availability == "NOT_EVALUATED" || availability == "UNSUPPORTED_TARGET" {
        if family.is_some() || present(value, "runtime_version") || accelerator.is_some() {
            return false;
        }
        if availability == "NOT_EVALUATED" && !contains_value(reasons, "EVALUATION_NOT_RUN") {
            return false;
        }
    }
    // Full AI is the only state with nothing outstanding, and it is exactly the
    // state that requires an accepted profile on an available certified
    // runtime.
    if behavior == Some("FULL_AI_AVAILABLE") {
        if availability != "AVAILABLE"
            || accepted.is_empty()
            || !reasons.is_empty()
            || !CERTIFIED_PLATFORM_IDS.contains(&platform_id)
        {
            return false;
        }
    } else if !accepted.is_empty() || reasons.is_empty() {
        return false;
    }
    // AVAILABLE and DEGRADED_LIMITED are the only non-blocking availability
    // states, so they are the only ones that may enumerate usable profiles and
    // the only ones that observed a runtime identity. A runtime below the
    // performance tier still reports what it is and what it offers.
    if !OPERABLE_RUNTIME_AVAILABILITY.contains(&availability) {
        return available.is_empty();
    }
    if family.is_none() || !present(value, "runtime_version") {
        return false;
    }
    availability != "AVAILABLE" || accelerator.is_some()
}

pub(super) fn platform_package_state_evidence(value: &Value) -> bool {
    let state = text(value, "state").unwrap_or_default();
    let reasons = items(value, "reason_codes");
    let signature = text(value, "signature_state");
    let interrupted = flag(value, "interrupted");
    let preservation = text(value, "user_data_preservation");
    let package_format = text(value, "package_format");
    let allowed_formats = platform_package_formats(text(value, "platform_id").unwrap_or_default());
    if !unique_strings(reasons)
        || !unique_strings(items(value, "evidence_refs"))
        || !platform_architecture_coherent(value)
        || (preservation == Some("PRESERVATION_FAILED") && reasons.is_empty())
        || allowed_formats
            .is_some_and(|formats| package_format.is_some_and(|format| !formats.contains(&format)))
    {
        return false;
    }
    // The interrupted flag is historical: it records that this operation was
    // interrupted at some point. The recovery_completed flag records that the
    // interruption was resolved, so it is meaningless without one. The
    // INTERRUPTED reason names exactly an operation that was interrupted, and
    // the unresolved terminal outcome is carried by INSTALL_INTERRUPTED /
    // UPDATE_INTERRUPTED, never by the flag alone.
    if (present(value, "recovery_completed") && interrupted != Some(true))
        || contains_value(reasons, "INTERRUPTED") != (interrupted == Some(true))
        || (PACKAGE_INTERRUPTED_STATES.contains(&state) && interrupted != Some(true))
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
    // A success carries no outstanding reason. A recovered interruption is no
    // longer outstanding, so exactly the historical INTERRUPTED reason may
    // remain — and only when the recovery actually completed. Specification
    // §5.14.8 requires every certified target to pass interrupted update,
    // repair, rollback, and preservation behaviour, so that outcome must be
    // reportable as the success it is.
    if PACKAGE_SUCCESS_STATES.contains(&state)
        && (signature != Some("SIGNATURE_VALID")
            || reasons
                .iter()
                .any(|reason| reason.as_str() != Some("INTERRUPTED"))
            || (interrupted == Some(true) && flag(value, "recovery_completed") != Some(true))
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
        // The installed update is the update that was offered, exactly as
        // INSTALLED binds the installed version to the package version.
        "UPDATE_INSTALLED" => {
            present(value, "installed_version")
                && present(value, "available_version")
                && present(value, "target_artifact")
                && text(value, "installed_version") == text(value, "available_version")
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
        // BLOCKED: an external boundary prevented evaluation. It blocks a
        // capability, so it is never filed as informational.
        _ => blocking == Some(true) && token_in(severity, &["CRITICAL", "ERROR", "WARNING"]),
    }
}

pub(super) fn platform_evidence_integrity(value: &Value) -> bool {
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
    // machine_class records *where* an artifact was produced and
    // evaluation_method records *how*. The axes are independent: a hosted
    // runner and a physical development machine may each execute synthetic
    // fixtures, static inspection, or a measured native run. Only a synthetic
    // machine cannot execute a native run, and only a hosted runner has a
    // runner image.
    let machine_class = text(value, "machine_class");
    let succeeded = text(value, "result") == Some("SUCCESS");
    if method == Some("MEASURED_NATIVE_RUN")
        && (!present(value, "os_version")
            || !present(value, "os_build")
            || machine_class == Some("SYNTHETIC_FIXTURE")
            || !token_in(text(value, "platform_id"), &CERTIFIED_PLATFORM_IDS)
            || (machine_class == Some("HOSTED_CI_RUNNER") && !present(value, "runner_image_token")))
    {
        return false;
    }
    if present(value, "runner_image_token") && machine_class != Some("HOSTED_CI_RUNNER") {
        return false;
    }
    // NOT_EVALUATED and DECLARED_PLAN are never measured evidence, so neither
    // can report a passing evidence element, and an unevaluated record observed
    // no operating-system build at all.
    if token_in(method, &["NOT_EVALUATED", "DECLARED_PLAN"]) {
        if succeeded {
            return false;
        }
        if method == Some("NOT_EVALUATED")
            && (present(value, "os_build") || !contains_value(reasons, "EVALUATION_NOT_RUN"))
        {
            return false;
        }
    }
    // An artifact whose signature did not verify is not a passing evidence
    // element, whatever produced it.
    if succeeded
        && token_in(
            text(value, "signature_state"),
            &["SIGNATURE_INVALID", "SIGNATURE_MISSING"],
        )
    {
        return false;
    }
    if succeeded {
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
    // Completeness is measured against the record's own declared policy, so an
    // empty required set would make "complete" vacuous. A certified proposal
    // must name the evidence it required.
    reasons.is_empty()
        && complete
        && !required.is_empty()
        && text(value, "owner_decision_state") == Some("RECORDED")
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
