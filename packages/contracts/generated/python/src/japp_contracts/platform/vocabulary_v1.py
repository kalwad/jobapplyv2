"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/platform/vocabulary.v1.schema.json
Schema id: urn:japp:schema:platform:vocabulary:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import Field, StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null
from japp_contracts.common.contract_text_v1 import CommonContractTextV1BoundedToken, CommonContractTextV1GitObjectId, CommonContractTextV1NonNegativeSafeInteger
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.provenance_v1 import CommonProvenanceV1ContentDigest
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp
from japp_contracts.security.capability_taxonomy_v1 import SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1PrincipalId

PlatformVocabularyV1AcceleratorClass = Literal["APPLE_SILICON_GPU", "CPU_ONLY", "NVIDIA_CUDA"]

PlatformVocabularyV1Architecture = Literal["ARM64", "UNKNOWN_ARCHITECTURE", "X86_64"]

class PlatformVocabularyV1ArtifactIdentity(ContractModel):
    "Names a package or model artifact by identity and digest only. No download URL, mirror, signing key, or filesystem location is representable."

    artifact_token: CommonContractTextV1BoundedToken
    artifact_digest: CommonProvenanceV1ContentDigest
    artifact_bytes: CommonContractTextV1NonNegativeSafeInteger | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("artifact_bytes",),
        )

PlatformVocabularyV1BoundedUserMessage = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9 ,;:.'()-]{0,239}$", min_length=1, max_length=240)]
"Short remediation text intended for a human. The character set excludes markup, path separators, shell syntax, and interpolation."

PlatformVocabularyV1BrowserChannel = Literal["STABLE", "UNKNOWN_CHANNEL"]
"Only STABLE is certified. UNKNOWN_CHANNEL is an honest unevaluated observation."

PlatformVocabularyV1BrowserFamily = Literal["CHROME", "UNKNOWN_BROWSER"]
"Chrome stable is the only certified browser. UNKNOWN_BROWSER records a recognized-but-uncertified observation and can never be certified."

PlatformVocabularyV1BuildToken = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$", min_length=1, max_length=64)]
"Opaque vendor build label. It cannot carry whitespace, path separators, shell syntax, or machine identity."

PlatformVocabularyV1CapabilityAvailability = Literal["AVAILABLE", "DEGRADED_LIMITED", "INCOMPATIBLE_VERSION", "NOT_EVALUATED", "NOT_INSTALLED", "PERMISSION_REQUIRED", "UNAVAILABLE", "UNKNOWN", "UNSUPPORTED_TARGET"]
"AVAILABLE and DEGRADED_LIMITED are the only non-blocking states. NOT_EVALUATED and UNKNOWN are explicitly not success. UNSUPPORTED_TARGET means the capability cannot exist on this target at all."

PlatformVocabularyV1CertifiedPlatformId = Literal["MACOS_ARM64", "UBUNTU_X64", "WINDOWS_X64"]
"The exact three certified first-release targets. Windows 10, Intel macOS, Windows ARM64, and non-Ubuntu Linux distributions are deliberately absent."

PlatformVocabularyV1ContextTokens = Annotated[int, Ge(1), Le(4194304)]

PlatformVocabularyV1CoreCapabilityBehavior = Literal["CORE_PRESERVED_AI_DEGRADED", "CORE_PRESERVED_AI_UNAVAILABLE", "FULL_AI_AVAILABLE"]
"Deterministic core workflows must remain usable in every state. FULL_AI_AVAILABLE additionally requires an accepted profile."

PlatformVocabularyV1DiagnosticResult = Literal["BLOCKED", "FAILURE", "SUCCESS", "WARNING"]
"SUCCESS may not coexist with a blocking reason. BLOCKED means an external boundary prevented evaluation."

PlatformVocabularyV1DistributionChannel = Literal["NOT_CONFIGURED", "RELEASE_STABLE", "TEST_SYNTHETIC"]
"NOT_CONFIGURED is the honest state while no signed channel exists. TEST_SYNTHETIC is never a release claim."

PlatformVocabularyV1EnvironmentVariableId = Literal["JAPP_DIAGNOSTIC_LEVEL", "JAPP_LOG_LEVEL", "JAPP_PATH_ROLE", "JAPP_RUNTIME_PROFILE_ID", "JAPP_SERVICE_BIND_HOST", "JAPP_SERVICE_PORT"]
"Closed set of reviewed variable identifiers. An arbitrary environment dictionary is structurally unrepresentable, and no allowlisted variable may carry credential material."

PlatformVocabularyV1EvaluationMethod = Literal["DECLARED_PLAN", "MEASURED_NATIVE_RUN", "NOT_EVALUATED", "STATIC_INSPECTION", "SYNTHETIC_FIXTURE"]
"NOT_EVALUATED and DECLARED_PLAN are never measured evidence. Only MEASURED_NATIVE_RUN represents execution on the actual operating-system family and architecture."

PlatformVocabularyV1EvidenceArtifactKind = Literal["BACKUP_RESTORE_REPORT", "DIAGNOSTIC_BUNDLE_REPORT", "DOCUMENT_MATRIX_REPORT", "INSTALL_LAUNCH_REPORT", "LOG_EXCERPT_REPORT", "MODEL_PROFILE_REPORT", "NATIVE_HOST_REGISTRATION_REPORT", "SCREENSHOT_REPORT", "SECRET_STORE_TEST_REPORT", "TRACE_REPORT", "UPDATE_ROLLBACK_REPORT"]
"Every artifact reference is a digest of a synthetic-safe artifact. Raw logs, environment dumps, registry exports, and machine PII are never embedded."

PlatformVocabularyV1ExtensionId = Annotated[str, StringConstraints(pattern="^[a-p]{32}$", min_length=32, max_length=32)]
"Exactly 32 characters from the Chrome extension alphabet. Only allowlisted identifiers may appear in a registration contract."

PlatformVocabularyV1InstallationScope = Literal["SYSTEM", "USER"]
"Per-user is the preferred default; SYSTEM scope is a reviewed exception, never a caller-chosen escalation."

PlatformVocabularyV1InstallerState = Literal["INSTALLED", "INSTALL_FAILED", "INSTALL_INTERRUPTED", "NOT_INSTALLED", "REPAIRED", "REPAIR_FAILED", "UNINSTALLED", "UNINSTALL_FAILED"]

PlatformVocabularyV1LifecycleMode = Literal["ONE_SHOT", "SUPERVISED_LONG_RUNNING"]

PlatformVocabularyV1MachineClass = Literal["HOSTED_CI_RUNNER", "PHYSICAL_DEVELOPMENT_MACHINE", "SYNTHETIC_FIXTURE"]
"Coarse machine class only. Hostnames, serial numbers, user names, MAC addresses, and other machine-specific identity are never represented."

PlatformVocabularyV1MemoryMebibytes = Annotated[int, Ge(0), Le(4194304)]

PlatformVocabularyV1NativeHostCleanupState = Literal["CLEANUP_FAILED", "NOT_APPLICABLE", "NOT_EVALUATED", "REMOVED"]

PlatformVocabularyV1NativeHostName = Annotated[str, StringConstraints(pattern="^[a-z][a-z0-9_]*(?:\\.[a-z0-9_]+)*$", min_length=3, max_length=96)]
"Chrome native-messaging host name grammar: lowercase alphanumeric and underscore segments separated by dots. It is an identity, never a filesystem path or executable name."

PlatformVocabularyV1OwnerDecisionState = Literal["NOT_REQUIRED", "PENDING", "RECORDED"]

PlatformVocabularyV1PackageFormat = Literal["APPLE_DISK_IMAGE", "APP_IMAGE", "DEBIAN_PACKAGE", "WINDOWS_INSTALLER"]

PlatformVocabularyV1PathResolutionState = Literal["DENIED_PERMISSION", "NOT_EVALUATED", "RESOLVED", "UNAVAILABLE"]

PlatformVocabularyV1PathRole = Literal["APPLICATION_DATA", "ARTIFACT_STORE", "BACKUP_STAGING", "CACHE", "DIAGNOSTIC_BUNDLE", "LOG_STORE", "MODEL_ARTIFACT_STORE", "NATIVE_HOST_REGISTRATION", "TEMPORARY"]
"The complete caller-facing path vocabulary. A caller selects a role; it can never supply an absolute path, traversal path, UNC or device path, registry path, shell or environment expansion, executable lookup input, or arbitrary working directory."

PlatformVocabularyV1PathSegment = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$", min_length=1, max_length=64)]
"One already-normalized relative segment. Separators, traversal, drive letters, device prefixes, home shorthand, and environment expansion cannot be expressed."

PlatformVocabularyV1PlatformCapabilityId = Literal["BROWSER_PRESENCE", "DIAGNOSTICS", "MODEL_RUNTIME", "NATIVE_MESSAGING", "PACKAGING_UPDATE_CHANNEL", "PLATFORM_PATHS", "PROCESS_SUPERVISION", "SECURE_STORE"]
"Closed set of specification-owned platform capability families reported by the platform service."

PlatformVocabularyV1PlatformComponentId = Literal["BROWSER_LOCATOR", "INSTALLER_STATE", "MODEL_RUNTIME_PROVIDER", "NATIVE_MESSAGING_REGISTRAR", "PLATFORM_CAPABILITIES", "PLATFORM_DIAGNOSTICS", "PLATFORM_PATHS", "PROCESS_SUPERVISOR", "SECRET_STORE", "UPDATER_PROVIDER"]
"The typed platform interfaces defined by specification §5.14.2. Shared domain code addresses these components instead of operating-system APIs."

PlatformVocabularyV1PlatformId = Literal["MACOS_ARM64", "UBUNTU_X64", "UNKNOWN_TARGET", "UNSUPPORTED_TARGET", "WINDOWS_X64"]
"Closed target vocabulary. UNSUPPORTED_TARGET is a recognized but uncertified target; UNKNOWN_TARGET is an unrecognized or unevaluated target. Neither may ever carry a certified support tier."

PlatformVocabularyV1PlatformReasonCode = Literal["ADAPTER_ERROR", "ARTIFACT_DIGEST_MISMATCH", "CONFIGURATION_INVALID", "DEPENDENCY_MISSING", "EVALUATION_NOT_RUN", "IDENTITY_MISMATCH", "INCOMPATIBLE_RUNTIME_VERSION", "INSUFFICIENT_HARDWARE", "INTERRUPTED", "NOT_INSTALLED", "PERMISSION_DENIED", "POLICY_DISABLED", "SERVICE_UNAVAILABLE", "SIGNATURE_NOT_VERIFIED", "TARGET_NOT_CERTIFIED", "TIMEOUT", "UNKNOWN_ERROR", "USER_CANCELED"]
"Closed, user-safe, redaction-safe reason vocabulary. Reason codes never carry host paths, registry values, device identifiers, machine secrets, or free-form operating-system text."

PlatformVocabularyV1ProcessArgument = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9._=:@+-]{0,127}$", min_length=1, max_length=128)]
"One already-separated argument. Arguments are never concatenated into a command line and never interpreted by a shell."

PlatformVocabularyV1ProcessExitCode = Annotated[int, Ge(0), Le(4294967295)]
"Unsigned exit status covering POSIX and Windows ranges. Raw signal values are deliberately absent."

PlatformVocabularyV1ProcessProfileId = Literal["LOCAL_ORCHESTRATOR", "MODEL_RUNTIME_HOST", "NATIVE_MESSAGING_HOST"]
"Closed set of reviewed executable profiles. A spawn plan names a profile; it can never carry an executable path, executable name, interpreter, or command text."

PlatformVocabularyV1ProcessState = Literal["EXITED", "FAILED", "ORPHANED", "RUNNING", "STARTING", "TERMINATED", "TERMINATING", "UNAVAILABLE"]
"UNAVAILABLE means the supervisor itself could not observe the process. ORPHANED means the child outlived its supervising parent and requires cleanup."

PlatformVocabularyV1ProductVersion = Annotated[str, StringConstraints(pattern="^(0|[1-9][0-9]*)(?:\\.(0|[1-9][0-9]*)){0,3}$", min_length=1, max_length=48)]
"One to four dot-separated non-negative components without leading zeros. Covers semantic versions and four-component browser/runtime versions."

PlatformVocabularyV1ProfileAcceptanceState = Literal["ACCEPTED", "NOT_EVALUATED", "REJECTED", "UNDER_EVALUATION"]
"ACCEPTED requires artifact and runtime evidence and a certified target. No Windows or Ubuntu profile is accepted today."

PlatformVocabularyV1RedactedPathReference = Annotated[str, StringConstraints(pattern="^<[A-Z][A-Z0-9_]{1,31}>(?:/[A-Za-z0-9][A-Za-z0-9._-]{0,63}){0,8}$", min_length=3, max_length=256)]
"A trusted adapter result may report a resolved location only in sanitized form: an angle-bracketed role placeholder followed by bounded normalized relative segments. Absolute paths, drive letters, UNC and device prefixes, backslashes, traversal, home-directory shorthand, environment expansion, and registry syntax are structurally unrepresentable. Sensitivity (x-japp-sensitivity): INTERNAL. Redaction (x-japp-redaction): HASH_ONLY."

PlatformVocabularyV1RegistrationOperation = Literal["INSTALL", "REMOVE", "REPAIR", "UPDATE", "VERIFY"]

PlatformVocabularyV1RegistrationState = Literal["ABSENT", "CORRUPT", "MISMATCHED_IDENTITY", "NOT_EVALUATED", "PRESENT_STALE", "PRESENT_VALID"]

class PlatformVocabularyV1RequestContext(ContractModel):
    "Trusted routing metadata attached to every caller-facing platform request. The requesting principal is authenticated elsewhere; content scripts, model runtimes, and the public index can never be valid platform requesters."

    requesting_principal: SecurityCapabilityTaxonomyV1PrincipalId
    authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    requested_at: CommonTimestampUtcV1UtcTimestamp
    correlation_id: CommonCorrelationV1CorrelationId
    causation_id: CommonCorrelationV1CausationId | None = None
    idempotency_key: CommonContractTextV1BoundedToken | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("causation_id", "idempotency_key",),
        )

PlatformVocabularyV1ReviewState = Literal["NOT_REVIEWED", "REVIEW_COMPLETE", "REVIEW_IN_PROGRESS"]

PlatformVocabularyV1RuntimeFamily = Literal["OLLAMA_GGUF", "OLLAMA_MLX"]
"Closed runtime vocabulary for the accepted local Ollama paths. External providers are deliberately absent and remain non-core future work."

PlatformVocabularyV1SecretKeyRole = Literal["BACKUP_WRAPPING_KEY", "DATABASE_ENCRYPTION_KEY", "LOCAL_SERVICE_AUTH_TOKEN", "NATIVE_HOST_SESSION_TOKEN"]
"Closed set of reviewed secret roles owned by the local product. An untrusted caller cannot name a keychain service/account, a Windows registry location, or a D-Bus request. External-provider tokens are deliberately absent and remain future work."

PlatformVocabularyV1SecretOperation = Literal["DELETE", "GET", "PUT", "STATUS"]
"STATUS is an availability probe that never touches secret material."

PlatformVocabularyV1SecretReference = Annotated[str, StringConstraints(pattern="^secref_[0-9A-HJKMNP-TV-Z]{26}$", min_length=33, max_length=33)]
"Bounded opaque handle for secret material held by the platform store. It is never the secret itself and never appears in diagnostics or evidence with a value attached. Sensitivity (x-japp-sensitivity): SECRET. Redaction (x-japp-redaction): FORBID_CAPTURE."

PlatformVocabularyV1SecretResultState = Literal["DELETED", "DENIED_PERMISSION", "NOT_FOUND", "OPERATION_FAILED", "RETRIEVED", "STORED", "STORE_UNAVAILABLE"]
"Result states never carry secret bytes. RETRIEVED reports only that material exists behind an opaque reference."

PlatformVocabularyV1Severity = Literal["CRITICAL", "ERROR", "INFO", "WARNING"]

PlatformVocabularyV1SignatureState = Literal["NOT_EVALUATED", "SIGNATURE_INVALID", "SIGNATURE_MISSING", "SIGNATURE_VALID"]

PlatformVocabularyV1StdioMode = Literal["BINARY_LENGTH_PREFIXED", "INHERIT_NONE", "NULL_DEVICE", "PIPE_BOUNDED"]
"BINARY_LENGTH_PREFIXED is the Windows-safe native-messaging mode. Raw file-descriptor numbers are structurally unrepresentable."

PlatformVocabularyV1SupportTier = Literal["CERTIFIED_CORE", "CERTIFIED_FULL", "EXPERIMENTAL", "UNSUPPORTED"]
"CERTIFIED_FULL is complete core plus an accepted local-AI profile; CERTIFIED_CORE is deterministic core workflows with AI unavailable or below the performance tier; EXPERIMENTAL carries no support promise; UNSUPPORTED is blocked with an explanation. A support tier is a reviewed claim, never a self-asserted request field."

PlatformVocabularyV1TerminationRequest = Literal["GRACEFUL_STOP", "IMMEDIATE_STOP", "NONE"]
"Typed intent only. Raw signal numbers, signal names, and platform-specific kill semantics are deliberately not representable."

PlatformVocabularyV1TimeoutMilliseconds = Annotated[int, Ge(1), Le(3600000)]

PlatformVocabularyV1UpdateState = Literal["NO_UPDATE_AVAILABLE", "ROLLBACK_FAILED", "ROLLED_BACK", "UPDATE_AVAILABLE", "UPDATE_FAILED", "UPDATE_INSTALLED", "UPDATE_INTERRUPTED"]

PlatformVocabularyV1UserDataPreservation = Literal["EXPLICIT_DELETION_REQUESTED", "NOT_EVALUATED", "PRESERVED", "PRESERVATION_FAILED"]
"EXPLICIT_DELETION_REQUESTED is the only state in which user data may be removed, and it requires an explicit user request recorded elsewhere."

class PlatformVocabularyV1CapabilityState(ContractModel):
    "One capability observation. Availability, the evidence method, and the finite reason list are always explicit; an unevaluated capability is never reported as success."

    capability: PlatformVocabularyV1PlatformCapabilityId
    availability: PlatformVocabularyV1CapabilityAvailability
    evaluation_method: PlatformVocabularyV1EvaluationMethod
    reason_codes: Annotated[Annotated[list[PlatformVocabularyV1PlatformReasonCode], MinLen(0), MaxLen(8)], Field(description="Finite reasons explaining a non-available state. An AVAILABLE capability carries none.")]
    identity_token: Annotated[CommonContractTextV1BoundedToken, Field(description="Bounded identity of the concrete provider observed (for example a secret-store backend family). Required evidence for an AVAILABLE capability.")] | None = None
    detected_version: Annotated[PlatformVocabularyV1ProductVersion, Field(description="Observed provider version. Required evidence for an AVAILABLE capability.")] | None = None
    evidence_digest: CommonProvenanceV1ContentDigest | None = None
    observed_at: CommonTimestampUtcV1UtcTimestamp | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("identity_token", "detected_version", "evidence_digest", "observed_at",),
        )

class PlatformVocabularyV1EnvironmentEntry(ContractModel):
    "Shared finite vocabularies and bounded supporting records for the M01-W07 platform-service boundary. Enum tokens use the repository UPPER_SNAKE_CASE grammar; MACOS_ARM64, WINDOWS_X64, and UBUNTU_X64 are the exact specification targets macos-arm64, windows-x64, and ubuntu-x64. Nothing here certifies a platform, resolves a path, opens a secret store, spawns a process, registers a native host, locates a browser, runs a model, installs, or updates."

    variable: PlatformVocabularyV1EnvironmentVariableId
    value: Annotated[CommonContractTextV1BoundedToken, Field(description="Bounded inert token. Whitespace, shell metacharacters, markup, and path separators are excluded by the token grammar.")]

class PlatformVocabularyV1SupportClaim(ContractModel):
    "Separates a claimed tier from the reviewed tier and its evidence. A claim is inert data; only the reviewed tier plus evaluated-revision and evidence references may be treated as certification."

    claimed_tier: Annotated[PlatformVocabularyV1SupportTier, Field(description="Tier proposed by the producing adapter or record. Untrusted.")]
    reviewed_tier: Annotated[PlatformVocabularyV1SupportTier, Field(description="Tier accepted after independent review. UNSUPPORTED until proven.")]
    review_state: PlatformVocabularyV1ReviewState
    evaluated_commit: CommonContractTextV1GitObjectId | None = None
    evaluated_tree: CommonContractTextV1GitObjectId | None = None
    evidence_refs: Annotated[list[CommonStableIdV1StableId], MinLen(0), MaxLen(32)] | None = None
    reviewer_identity_ref: CommonStableIdV1StableId | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("evaluated_commit", "evaluated_tree", "evidence_refs", "reviewer_identity_ref",),
        )
