/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/vocabulary.v1.schema.json
 * Schema id: urn:japp:schema:platform:vocabulary:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken, CommonContractTextV1GitObjectId, CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { SecurityCapabilityTaxonomyV1AuthorizationProfileId, SecurityCapabilityTaxonomyV1PrincipalId } from "../security/capability-taxonomy.v1.ts";

/**
 * Accelerator class
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1AcceleratorClass = "APPLE_SILICON_GPU" | "CPU_ONLY" | "NVIDIA_CUDA";

/**
 * Processor architecture
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1Architecture = "ARM64" | "UNKNOWN_ARCHITECTURE" | "X86_64";

/**
 * Bounded artifact identity
 *
 * Names a package or model artifact by identity and digest only. No download URL, mirror, signing key, or filesystem location is representable.
 */
export interface PlatformVocabularyV1ArtifactIdentity {
  readonly artifact_token: CommonContractTextV1BoundedToken;
  readonly artifact_digest: CommonProvenanceV1ContentDigest;
  readonly artifact_bytes?: CommonContractTextV1NonNegativeSafeInteger;
}

/**
 * Bounded user-safe message
 *
 * Short remediation text intended for a human. The character set excludes markup, path separators, shell syntax, and interpolation.
 *
 * Pattern: ^[A-Za-z0-9][A-Za-z0-9 ,;:.'()-]{0,239}$
 * Minimum length: 1.
 * Maximum length: 240.
 */
export type PlatformVocabularyV1BoundedUserMessage = string;

/**
 * Browser release channel
 *
 * Only STABLE is certified. UNKNOWN_CHANNEL is an honest unevaluated observation.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1BrowserChannel = "STABLE" | "UNKNOWN_CHANNEL";

/**
 * Browser family
 *
 * Chrome stable is the only certified browser. UNKNOWN_BROWSER records a recognized-but-uncertified observation and can never be certified.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1BrowserFamily = "CHROME" | "UNKNOWN_BROWSER";

/**
 * Bounded operating-system build token
 *
 * Opaque vendor build label. It cannot carry whitespace, path separators, shell syntax, or machine identity.
 *
 * Pattern: ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$
 * Minimum length: 1.
 * Maximum length: 64.
 */
export type PlatformVocabularyV1BuildToken = string;

/**
 * Capability availability state
 *
 * AVAILABLE and DEGRADED_LIMITED are the only non-blocking states. NOT_EVALUATED and UNKNOWN are explicitly not success. UNSUPPORTED_TARGET means the capability cannot exist on this target at all.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1CapabilityAvailability = "AVAILABLE" | "DEGRADED_LIMITED" | "INCOMPATIBLE_VERSION" | "NOT_EVALUATED" | "NOT_INSTALLED" | "PERMISSION_REQUIRED" | "UNAVAILABLE" | "UNKNOWN" | "UNSUPPORTED_TARGET";

/**
 * Certified first-release target identifier
 *
 * The exact three certified first-release targets. Windows 10, Intel macOS, Windows ARM64, and non-Ubuntu Linux distributions are deliberately absent.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1CertifiedPlatformId = "MACOS_ARM64" | "UBUNTU_X64" | "WINDOWS_X64";

/**
 * Bounded model context window in tokens
 *
 * Integer; runtime validation rejects fractions and coercion.
 * Minimum: 1.
 * Maximum: 4194304.
 */
export type PlatformVocabularyV1ContextTokens = number;

/**
 * Deterministic-core behavior when AI is limited
 *
 * Deterministic core workflows must remain usable in every state. FULL_AI_AVAILABLE additionally requires an accepted profile.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1CoreCapabilityBehavior = "CORE_PRESERVED_AI_DEGRADED" | "CORE_PRESERVED_AI_UNAVAILABLE" | "FULL_AI_AVAILABLE";

/**
 * Diagnostic outcome
 *
 * SUCCESS may not coexist with a blocking reason. BLOCKED means an external boundary prevented evaluation.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1DiagnosticResult = "BLOCKED" | "FAILURE" | "SUCCESS" | "WARNING";

/**
 * Packaging and update channel
 *
 * NOT_CONFIGURED is the honest state while no signed channel exists. TEST_SYNTHETIC is never a release claim.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1DistributionChannel = "NOT_CONFIGURED" | "RELEASE_STABLE" | "TEST_SYNTHETIC";

/**
 * Allowlisted environment variable
 *
 * Closed set of reviewed variable identifiers. An arbitrary environment dictionary is structurally unrepresentable, and no allowlisted variable may carry credential material.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1EnvironmentVariableId = "JAPP_DIAGNOSTIC_LEVEL" | "JAPP_LOG_LEVEL" | "JAPP_PATH_ROLE" | "JAPP_RUNTIME_PROFILE_ID" | "JAPP_SERVICE_BIND_HOST" | "JAPP_SERVICE_PORT";

/**
 * How a platform observation was produced
 *
 * NOT_EVALUATED and DECLARED_PLAN are never measured evidence. Only MEASURED_NATIVE_RUN represents execution on the actual operating-system family and architecture.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1EvaluationMethod = "DECLARED_PLAN" | "MEASURED_NATIVE_RUN" | "NOT_EVALUATED" | "STATIC_INSPECTION" | "SYNTHETIC_FIXTURE";

/**
 * Cross-platform evidence artifact kind
 *
 * Every artifact reference is a digest of a synthetic-safe artifact. Raw logs, environment dumps, registry exports, and machine PII are never embedded.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1EvidenceArtifactKind = "BACKUP_RESTORE_REPORT" | "DIAGNOSTIC_BUNDLE_REPORT" | "DOCUMENT_MATRIX_REPORT" | "INSTALL_LAUNCH_REPORT" | "LOG_EXCERPT_REPORT" | "MODEL_PROFILE_REPORT" | "NATIVE_HOST_REGISTRATION_REPORT" | "SCREENSHOT_REPORT" | "SECRET_STORE_TEST_REPORT" | "TRACE_REPORT" | "UPDATE_ROLLBACK_REPORT";

/**
 * Chrome extension identifier
 *
 * Exactly 32 characters from the Chrome extension alphabet. Only allowlisted identifiers may appear in a registration contract.
 *
 * Pattern: ^[a-p]{32}$
 * Minimum length: 32.
 * Maximum length: 32.
 */
export type PlatformVocabularyV1ExtensionId = string;

/**
 * Installation scope
 *
 * Per-user is the preferred default; SYSTEM scope is a reviewed exception, never a caller-chosen escalation.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1InstallationScope = "SYSTEM" | "USER";

/**
 * Installer lifecycle state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1InstallerState = "INSTALLED" | "INSTALL_FAILED" | "INSTALL_INTERRUPTED" | "NOT_INSTALLED" | "REPAIRED" | "REPAIR_FAILED" | "UNINSTALLED" | "UNINSTALL_FAILED";

/**
 * Process lifecycle mode
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1LifecycleMode = "ONE_SHOT" | "SUPERVISED_LONG_RUNNING";

/**
 * Evidence machine class
 *
 * Coarse machine class only. Hostnames, serial numbers, user names, MAC addresses, and other machine-specific identity are never represented.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1MachineClass = "HOSTED_CI_RUNNER" | "PHYSICAL_DEVELOPMENT_MACHINE" | "SYNTHETIC_FIXTURE";

/**
 * Bounded memory requirement in MiB
 *
 * Integer; runtime validation rejects fractions and coercion.
 * Minimum: 0.
 * Maximum: 4194304.
 */
export type PlatformVocabularyV1MemoryMebibytes = number;

/**
 * Native-host cleanup state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1NativeHostCleanupState = "CLEANUP_FAILED" | "NOT_APPLICABLE" | "NOT_EVALUATED" | "REMOVED";

/**
 * Native-messaging host name
 *
 * Chrome native-messaging host name grammar: lowercase alphanumeric and underscore segments separated by dots. It is an identity, never a filesystem path or executable name.
 *
 * Pattern: ^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$
 * Minimum length: 3.
 * Maximum length: 96.
 */
export type PlatformVocabularyV1NativeHostName = string;

/**
 * Owner decision state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1OwnerDecisionState = "NOT_REQUIRED" | "PENDING" | "RECORDED";

/**
 * Certified package format
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PackageFormat = "APPLE_DISK_IMAGE" | "APP_IMAGE" | "DEBIAN_PACKAGE" | "WINDOWS_INSTALLER";

/**
 * Path resolution state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PathResolutionState = "DENIED_PERMISSION" | "NOT_EVALUATED" | "RESOLVED" | "UNAVAILABLE";

/**
 * Typed logical path role
 *
 * The complete caller-facing path vocabulary. A caller selects a role; it can never supply an absolute path, traversal path, UNC or device path, registry path, shell or environment expansion, executable lookup input, or arbitrary working directory.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PathRole = "APPLICATION_DATA" | "ARTIFACT_STORE" | "BACKUP_STAGING" | "CACHE" | "DIAGNOSTIC_BUNDLE" | "LOG_STORE" | "MODEL_ARTIFACT_STORE" | "NATIVE_HOST_REGISTRATION" | "TEMPORARY";

/**
 * Bounded relative path segment
 *
 * One already-normalized relative segment. Separators, traversal, drive letters, device prefixes, home shorthand, and environment expansion cannot be expressed.
 *
 * Pattern: ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$
 * Minimum length: 1.
 * Maximum length: 64.
 */
export type PlatformVocabularyV1PathSegment = string;

/**
 * Platform capability family
 *
 * Closed set of specification-owned platform capability families reported by the platform service.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PlatformCapabilityId = "BROWSER_PRESENCE" | "DIAGNOSTICS" | "MODEL_RUNTIME" | "NATIVE_MESSAGING" | "PACKAGING_UPDATE_CHANNEL" | "PLATFORM_PATHS" | "PROCESS_SUPERVISION" | "SECURE_STORE";

/**
 * Platform component identifier
 *
 * The typed platform interfaces defined by specification §5.14.2. Shared domain code addresses these components instead of operating-system APIs.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PlatformComponentId = "BROWSER_LOCATOR" | "INSTALLER_STATE" | "MODEL_RUNTIME_PROVIDER" | "NATIVE_MESSAGING_REGISTRAR" | "PLATFORM_CAPABILITIES" | "PLATFORM_DIAGNOSTICS" | "PLATFORM_PATHS" | "PROCESS_SUPERVISOR" | "SECRET_STORE" | "UPDATER_PROVIDER";

/**
 * Detected platform target identifier
 *
 * Closed target vocabulary. UNSUPPORTED_TARGET is a recognized but uncertified target; UNKNOWN_TARGET is an unrecognized or unevaluated target. Neither may ever carry a certified support tier.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PlatformId = "MACOS_ARM64" | "UBUNTU_X64" | "UNKNOWN_TARGET" | "UNSUPPORTED_TARGET" | "WINDOWS_X64";

/**
 * Finite platform reason code
 *
 * Closed, user-safe, redaction-safe reason vocabulary. Reason codes never carry host paths, registry values, device identifiers, machine secrets, or free-form operating-system text.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1PlatformReasonCode = "ADAPTER_ERROR" | "ARTIFACT_DIGEST_MISMATCH" | "CONFIGURATION_INVALID" | "DEPENDENCY_MISSING" | "EVALUATION_NOT_RUN" | "IDENTITY_MISMATCH" | "INCOMPATIBLE_RUNTIME_VERSION" | "INSUFFICIENT_HARDWARE" | "INTERRUPTED" | "NOT_INSTALLED" | "PERMISSION_DENIED" | "POLICY_DISABLED" | "SERVICE_UNAVAILABLE" | "SIGNATURE_NOT_VERIFIED" | "TARGET_NOT_CERTIFIED" | "TIMEOUT" | "UNKNOWN_ERROR" | "USER_CANCELED";

/**
 * Bounded process argument
 *
 * One already-separated argument. Arguments are never concatenated into a command line and never interpreted by a shell.
 *
 * Pattern: ^[A-Za-z0-9][A-Za-z0-9._=:@+-]{0,127}$
 * Minimum length: 1.
 * Maximum length: 128.
 */
export type PlatformVocabularyV1ProcessArgument = string;

/**
 * Bounded process exit code
 *
 * Unsigned exit status covering POSIX and Windows ranges. Raw signal values are deliberately absent.
 *
 * Integer; runtime validation rejects fractions and coercion.
 * Minimum: 0.
 * Maximum: 4294967295.
 */
export type PlatformVocabularyV1ProcessExitCode = number;

/**
 * Approved process profile
 *
 * Closed set of reviewed executable profiles. A spawn plan names a profile; it can never carry an executable path, executable name, interpreter, or command text.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1ProcessProfileId = "LOCAL_ORCHESTRATOR" | "MODEL_RUNTIME_HOST" | "NATIVE_MESSAGING_HOST";

/**
 * Process lifecycle state
 *
 * UNAVAILABLE means the supervisor itself could not observe the process. ORPHANED means the child outlived its supervising parent and requires cleanup.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1ProcessState = "EXITED" | "FAILED" | "ORPHANED" | "RUNNING" | "STARTING" | "TERMINATED" | "TERMINATING" | "UNAVAILABLE";

/**
 * Bounded product version
 *
 * One to four dot-separated non-negative components without leading zeros. Covers semantic versions and four-component browser/runtime versions.
 *
 * Pattern: ^(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*)){0,3}$
 * Minimum length: 1.
 * Maximum length: 48.
 */
export type PlatformVocabularyV1ProductVersion = string;

/**
 * Model-runtime profile acceptance state
 *
 * ACCEPTED requires artifact and runtime evidence and a certified target. No Windows or Ubuntu profile is accepted today.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1ProfileAcceptanceState = "ACCEPTED" | "NOT_EVALUATED" | "REJECTED" | "UNDER_EVALUATION";

/**
 * Sanitized logical path reference
 *
 * A trusted adapter result may report a resolved location only in sanitized form: an angle-bracketed role placeholder followed by bounded normalized relative segments. Absolute paths, drive letters, UNC and device prefixes, backslashes, traversal, home-directory shorthand, environment expansion, and registry syntax are structurally unrepresentable.
 *
 * Pattern: ^<[A-Z][A-Z0-9_]{1,31}>(?:/[A-Za-z0-9][A-Za-z0-9._-]{0,63}){0,8}$
 * Minimum length: 3.
 * Maximum length: 256.
 * Sensitivity (x-japp-sensitivity): INTERNAL
 * Redaction (x-japp-redaction): HASH_ONLY
 */
export type PlatformVocabularyV1RedactedPathReference = string;

/**
 * Native-messaging registration operation
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1RegistrationOperation = "INSTALL" | "REMOVE" | "REPAIR" | "UPDATE" | "VERIFY";

/**
 * Native-messaging registration state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1RegistrationState = "ABSENT" | "CORRUPT" | "MISMATCHED_IDENTITY" | "NOT_EVALUATED" | "PRESENT_STALE" | "PRESENT_VALID";

/**
 * Platform request context
 *
 * Trusted routing metadata attached to every caller-facing platform request. The requesting principal is authenticated elsewhere; content scripts, model runtimes, and the public index can never be valid platform requesters.
 */
export interface PlatformVocabularyV1RequestContext {
  readonly requesting_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  readonly authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly requested_at: CommonTimestampUtcV1UtcTimestamp;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly causation_id?: CommonCorrelationV1CausationId;
  readonly idempotency_key?: CommonContractTextV1BoundedToken;
}

/**
 * Independent review state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1ReviewState = "NOT_REVIEWED" | "REVIEW_COMPLETE" | "REVIEW_IN_PROGRESS";

/**
 * Local model runtime family
 *
 * Closed runtime vocabulary for the accepted local Ollama paths. External providers are deliberately absent and remain non-core future work.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1RuntimeFamily = "OLLAMA_GGUF" | "OLLAMA_MLX";

/**
 * Bounded secret key role
 *
 * Closed set of reviewed secret roles owned by the local product. An untrusted caller cannot name a keychain service/account, a Windows registry location, or a D-Bus request. External-provider tokens are deliberately absent and remain future work.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1SecretKeyRole = "BACKUP_WRAPPING_KEY" | "DATABASE_ENCRYPTION_KEY" | "LOCAL_SERVICE_AUTH_TOKEN" | "NATIVE_HOST_SESSION_TOKEN";

/**
 * Secret-store operation
 *
 * STATUS is an availability probe that never touches secret material.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1SecretOperation = "DELETE" | "GET" | "PUT" | "STATUS";

/**
 * Opaque secret reference
 *
 * Bounded opaque handle for secret material held by the platform store. It is never the secret itself and never appears in diagnostics or evidence with a value attached.
 *
 * Pattern: ^secref_[0-9A-HJKMNP-TV-Z]{26}$
 * Minimum length: 33.
 * Maximum length: 33.
 * Sensitivity (x-japp-sensitivity): SECRET
 * Redaction (x-japp-redaction): FORBID_CAPTURE
 */
export type PlatformVocabularyV1SecretReference = string;

/**
 * Secret-store result state
 *
 * Result states never carry secret bytes. RETRIEVED reports only that material exists behind an opaque reference. STORE_AVAILABLE is the successful STATUS availability probe; it never accompanies material.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1SecretResultState = "DELETED" | "DENIED_PERMISSION" | "NOT_FOUND" | "OPERATION_FAILED" | "RETRIEVED" | "STORED" | "STORE_AVAILABLE" | "STORE_UNAVAILABLE";

/**
 * Diagnostic severity
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1Severity = "CRITICAL" | "ERROR" | "INFO" | "WARNING";

/**
 * Artifact signature state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1SignatureState = "NOT_EVALUATED" | "SIGNATURE_INVALID" | "SIGNATURE_MISSING" | "SIGNATURE_VALID";

/**
 * Process stdio mode
 *
 * BINARY_LENGTH_PREFIXED is the Windows-safe native-messaging mode. Raw file-descriptor numbers are structurally unrepresentable.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1StdioMode = "BINARY_LENGTH_PREFIXED" | "INHERIT_NONE" | "NULL_DEVICE" | "PIPE_BOUNDED";

/**
 * Platform support tier
 *
 * CERTIFIED_FULL is complete core plus an accepted local-AI profile; CERTIFIED_CORE is deterministic core workflows with AI unavailable or below the performance tier; EXPERIMENTAL carries no support promise; UNSUPPORTED is blocked with an explanation. A support tier is a reviewed claim, never a self-asserted request field.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1SupportTier = "CERTIFIED_CORE" | "CERTIFIED_FULL" | "EXPERIMENTAL" | "UNSUPPORTED";

/**
 * Typed termination request
 *
 * Typed intent only. Raw signal numbers, signal names, and platform-specific kill semantics are deliberately not representable.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1TerminationRequest = "GRACEFUL_STOP" | "IMMEDIATE_STOP" | "NONE";

/**
 * Bounded operation timeout
 *
 * Integer; runtime validation rejects fractions and coercion.
 * Minimum: 1.
 * Maximum: 3600000.
 */
export type PlatformVocabularyV1TimeoutMilliseconds = number;

/**
 * Updater lifecycle state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1UpdateState = "NO_UPDATE_AVAILABLE" | "ROLLBACK_FAILED" | "ROLLED_BACK" | "UPDATE_AVAILABLE" | "UPDATE_FAILED" | "UPDATE_INSTALLED" | "UPDATE_INTERRUPTED";

/**
 * User-data preservation indicator
 *
 * EXPLICIT_DELETION_REQUESTED is the only state in which user data may be removed, and it requires an explicit user request recorded elsewhere.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type PlatformVocabularyV1UserDataPreservation = "EXPLICIT_DELETION_REQUESTED" | "NOT_EVALUATED" | "PRESERVED" | "PRESERVATION_FAILED";

/**
 * Capability state record
 *
 * One capability observation. Availability, the evidence method, and the finite reason list are always explicit; an unevaluated capability is never reported as success.
 */
export interface PlatformVocabularyV1CapabilityState {
  readonly capability: PlatformVocabularyV1PlatformCapabilityId;
  readonly availability: PlatformVocabularyV1CapabilityAvailability;
  readonly evaluation_method: PlatformVocabularyV1EvaluationMethod;
  /**
   * Finite reasons explaining a non-available state. An AVAILABLE capability carries none.
   *
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  /**
   * Bounded identity of the concrete provider observed (for example a secret-store backend family). Required evidence for an AVAILABLE capability.
   */
  readonly identity_token?: CommonContractTextV1BoundedToken;
  /**
   * Observed provider version. Required evidence for an AVAILABLE capability.
   */
  readonly detected_version?: PlatformVocabularyV1ProductVersion;
  readonly evidence_digest?: CommonProvenanceV1ContentDigest;
  readonly observed_at?: CommonTimestampUtcV1UtcTimestamp;
}

/**
 * Allowlisted environment entry
 */
export interface PlatformVocabularyV1EnvironmentEntry {
  readonly variable: PlatformVocabularyV1EnvironmentVariableId;
  /**
   * Bounded inert token. Whitespace, shell metacharacters, markup, and path separators are excluded by the token grammar.
   */
  readonly value: CommonContractTextV1BoundedToken;
}

/**
 * Reviewed support claim
 *
 * Separates a claimed tier from the reviewed tier and its evidence. A claim is inert data; only the reviewed tier plus evaluated-revision and evidence references may be treated as certification.
 */
export interface PlatformVocabularyV1SupportClaim {
  /**
   * Tier proposed by the producing adapter or record. Untrusted.
   */
  readonly claimed_tier: PlatformVocabularyV1SupportTier;
  /**
   * Tier accepted after independent review. UNSUPPORTED until proven.
   */
  readonly reviewed_tier: PlatformVocabularyV1SupportTier;
  readonly review_state: PlatformVocabularyV1ReviewState;
  readonly evaluated_commit?: CommonContractTextV1GitObjectId;
  readonly evaluated_tree?: CommonContractTextV1GitObjectId;
  /**
   * Minimum items: 0.
   * Maximum items: 32.
   */
  readonly evidence_refs?: readonly CommonStableIdV1StableId[];
  readonly reviewer_identity_ref?: CommonStableIdV1StableId;
}
