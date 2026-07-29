/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/ (complete catalog)
 * Schema id: typed validation wrappers
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import {
  createContractValidator,
  loadSchemaCatalog,
  type ContractValidator,
  type SchemaCatalog,
} from "../../src/index.ts";
import type {
  AtsVariantIdentityV1,
  AtsVariantIdentityV1SessionMode,
} from "./ats/variant-identity.v1.ts";
import type {
  BenchmarkCaseV1,
  BenchmarkCaseV1BenchmarkFamily,
  BenchmarkCaseV1EnvironmentRequirements,
  BenchmarkCaseV1ExpectedBehavior,
  BenchmarkCaseV1InputArtifact,
  BenchmarkCaseV1MetricUnit,
  BenchmarkCaseV1Threshold,
  BenchmarkCaseV1ThresholdComparator,
} from "./benchmark/case.v1.ts";
import type {
  BenchmarkHoldoutManifestV1,
  BenchmarkHoldoutManifestV1CategoryCount,
  BenchmarkHoldoutManifestV1EncryptedBundleMetadata,
  BenchmarkHoldoutManifestV1FileCommitment,
  BenchmarkHoldoutManifestV1SchemaVersionEntry,
} from "./benchmark/holdout-manifest.v1.ts";
import type {
  BenchmarkResultV1,
  BenchmarkResultV1CompletenessState,
  BenchmarkResultV1EnvironmentMatchState,
  BenchmarkResultV1HashState,
  BenchmarkResultV1HoldoutState,
  BenchmarkResultV1MetricResult,
  BenchmarkResultV1RuntimeMetadata,
} from "./benchmark/result.v1.ts";
import type {
  CommonCalendarDateV1CalendarDate,
} from "./common/calendar-date.v1.ts";
import type {
  CommonConfidenceV1Confidence,
} from "./common/confidence.v1.ts";
import type {
  CommonContractTextV1BoundedToken,
  CommonContractTextV1GitObjectId,
  CommonContractTextV1Locale,
  CommonContractTextV1MetricValue,
  CommonContractTextV1NonNegativeSafeInteger,
  CommonContractTextV1NormalizedText,
  CommonContractTextV1PositiveSafeInteger,
  CommonContractTextV1SchemaReference,
  CommonContractTextV1VersionText,
} from "./common/contract-text.v1.ts";
import type {
  CommonCorrelationV1CausationId,
  CommonCorrelationV1CorrelationId,
} from "./common/correlation.v1.ts";
import type {
  CommonEnumTokenV1EnumToken,
} from "./common/enum-token.v1.ts";
import type {
  CommonEnvelopeV1EnvelopeMetadata,
  CommonEnvelopeV1EnvelopedRecord,
  CommonEnvelopeV1ExtensionKey,
  CommonEnvelopeV1Extensions,
} from "./common/envelope.v1.ts";
import type {
  CommonLocationV1CountryCode,
  CommonLocationV1StructuredLocation,
} from "./common/location.v1.ts";
import type {
  CommonMoneyV1CurrencyCode,
  CommonMoneyV1DecimalAmount,
  CommonMoneyV1Money,
} from "./common/money.v1.ts";
import type {
  CommonProvenanceV1ContentDigest,
  CommonProvenanceV1Provenance,
  CommonProvenanceV1SourceKind,
} from "./common/provenance.v1.ts";
import type {
  CommonRedactionV1RedactionAnnotation,
  CommonRedactionV1RedactionPolicy,
  CommonRedactionV1SensitivityClass,
} from "./common/redaction.v1.ts";
import type {
  CommonSchemaVersionV1SchemaId,
  CommonSchemaVersionV1SchemaVersion,
} from "./common/schema-version.v1.ts";
import type {
  CommonStableIdV1IdPrefix,
  CommonStableIdV1StableId,
} from "./common/stable-id.v1.ts";
import type {
  CommonTimestampUtcV1UtcTimestamp,
} from "./common/timestamp-utc.v1.ts";
import type {
  ErrorCatalogV1,
  ErrorCatalogV1CatalogEntry,
} from "./error/catalog.v1.ts";
import type {
  ErrorRecordV1,
} from "./error/record.v1.ts";
import type {
  ErrorTaxonomyV1ErrorCode,
  ErrorTaxonomyV1ErrorFamily,
  ErrorTaxonomyV1ErrorOrigin,
  ErrorTaxonomyV1ErrorSeverity,
  ErrorTaxonomyV1MessageKey,
  ErrorTaxonomyV1RetryDisposition,
  ErrorTaxonomyV1UserSafeMessage,
} from "./error/taxonomy.v1.ts";
import type {
  FixtureTestRecordV1,
} from "./fixture/test-record.v1.ts";
import type {
  FormDriverResultV1,
  FormDriverResultV1ActionAttempt,
  FormDriverResultV1DriverOutcome,
  FormDriverResultV1PreconditionsResult,
  FormDriverResultV1ReasonCode,
  FormDriverResultV1RecoveryResult,
  FormDriverResultV1ResolutionResult,
  FormDriverResultV1SiteAcceptance,
  FormDriverResultV1ValueEvidence,
} from "./form/driver-result.v1.ts";
import type {
  FormFieldAddressV1,
  FormFieldAddressV1AtsFamily,
  FormFieldAddressV1RepeaterPathEntry,
  FormFieldAddressV1ResolutionHint,
  FormFieldAddressV1ResolutionHintKind,
  FormFieldAddressV1StabilityClass,
} from "./form/field-address.v1.ts";
import type {
  FormFieldDecisionV1,
  FormFieldDecisionV1ConfirmationState,
  FormFieldDecisionV1FinalDecision,
  FormFieldDecisionV1PolicyDecision,
  FormFieldDecisionV1ReasonCode,
  FormFieldDecisionV1ValueSourceType,
} from "./form/field-decision.v1.ts";
import type {
  FormFieldDescriptorV1,
  FormFieldDescriptorV1ControlKind,
  FormFieldDescriptorV1ObservedValue,
  FormFieldDescriptorV1OptionSemantic,
  FormFieldDescriptorV1UntrustedTextRepresentation,
  FormFieldDescriptorV1ValidationState,
} from "./form/field-descriptor.v1.ts";
import type {
  FormReconciliationInventoryV1,
  FormReconciliationInventoryV1ConfirmationState,
  FormReconciliationInventoryV1InventoryCounts,
  FormReconciliationInventoryV1InventoryItem,
  FormReconciliationInventoryV1ReconciliationCategory,
} from "./form/reconciliation-inventory.v1.ts";
import type {
  GateDecisionV1,
  GateDecisionV1GateDecision,
  GateDecisionV1IndependentReviewState,
  GateDecisionV1OwnerDecisionState,
  GateDecisionV1ReasonCode,
  GateDecisionV1ThresholdEvidenceSummary,
} from "./gate/decision.v1.ts";
import type {
  GateEvidenceBundleV1,
  GateEvidenceBundleV1CompletenessInventory,
  GateEvidenceBundleV1GateId,
} from "./gate/evidence-bundle.v1.ts";
import type {
  PlatformBrowserDiscoveryRequestV1,
} from "./platform/browser-discovery-request.v1.ts";
import type {
  PlatformBrowserRecordV1,
} from "./platform/browser-record.v1.ts";
import type {
  PlatformBrowserRecordV2,
} from "./platform/browser-record.v2.ts";
import type {
  PlatformCapabilityReportV1,
} from "./platform/capability-report.v1.ts";
import type {
  PlatformCapabilityReportV2,
} from "./platform/capability-report.v2.ts";
import type {
  PlatformCertificationInputV1,
} from "./platform/certification-input.v1.ts";
import type {
  PlatformCertificationInputV2,
  PlatformCertificationInputV2EvidenceInventoryItem,
} from "./platform/certification-input.v2.ts";
import type {
  PlatformDiagnosticReportV1,
} from "./platform/diagnostic-report.v1.ts";
import type {
  PlatformDiagnosticReportV2,
} from "./platform/diagnostic-report.v2.ts";
import type {
  PlatformEvidenceRecordV1,
} from "./platform/evidence-record.v1.ts";
import type {
  PlatformEvidenceRecordV2,
} from "./platform/evidence-record.v2.ts";
import type {
  PlatformInstallerStateV1,
} from "./platform/installer-state.v1.ts";
import type {
  PlatformInstallerStateV2,
} from "./platform/installer-state.v2.ts";
import type {
  PlatformModelRuntimeProfileV1,
} from "./platform/model-runtime-profile.v1.ts";
import type {
  PlatformModelRuntimeProfileV2,
} from "./platform/model-runtime-profile.v2.ts";
import type {
  PlatformNativeMessagingRegistrationV1,
} from "./platform/native-messaging-registration.v1.ts";
import type {
  PlatformNativeMessagingRegistrationV2,
} from "./platform/native-messaging-registration.v2.ts";
import type {
  PlatformNativeMessagingResultV1,
} from "./platform/native-messaging-result.v1.ts";
import type {
  PlatformNativeMessagingResultV2,
} from "./platform/native-messaging-result.v2.ts";
import type {
  PlatformPathRequestV1,
} from "./platform/path-request.v1.ts";
import type {
  PlatformPathResolutionV1,
} from "./platform/path-resolution.v1.ts";
import type {
  PlatformPathResolutionV2,
} from "./platform/path-resolution.v2.ts";
import type {
  PlatformProcessPlanV1,
} from "./platform/process-plan.v1.ts";
import type {
  PlatformProcessPlanV2,
} from "./platform/process-plan.v2.ts";
import type {
  PlatformProcessStatusV1,
} from "./platform/process-status.v1.ts";
import type {
  PlatformProcessStatusV2,
} from "./platform/process-status.v2.ts";
import type {
  PlatformRuntimeCapabilityV1,
} from "./platform/runtime-capability.v1.ts";
import type {
  PlatformRuntimeCapabilityV2,
} from "./platform/runtime-capability.v2.ts";
import type {
  PlatformSecretStoreRequestV1,
} from "./platform/secret-store-request.v1.ts";
import type {
  PlatformSecretStoreResultV1,
} from "./platform/secret-store-result.v1.ts";
import type {
  PlatformSecretStoreResultV2,
} from "./platform/secret-store-result.v2.ts";
import type {
  PlatformTargetIdentityV1,
} from "./platform/target-identity.v1.ts";
import type {
  PlatformUpdateStateV1,
} from "./platform/update-state.v1.ts";
import type {
  PlatformUpdateStateV2,
} from "./platform/update-state.v2.ts";
import type {
  PlatformVocabularyV1AcceleratorClass,
  PlatformVocabularyV1Architecture,
  PlatformVocabularyV1ArtifactIdentity,
  PlatformVocabularyV1BoundedUserMessage,
  PlatformVocabularyV1BrowserChannel,
  PlatformVocabularyV1BrowserFamily,
  PlatformVocabularyV1BuildToken,
  PlatformVocabularyV1CapabilityAvailability,
  PlatformVocabularyV1CapabilityState,
  PlatformVocabularyV1CertifiedPlatformId,
  PlatformVocabularyV1ContextTokens,
  PlatformVocabularyV1CoreCapabilityBehavior,
  PlatformVocabularyV1DiagnosticResult,
  PlatformVocabularyV1DistributionChannel,
  PlatformVocabularyV1EnvironmentEntry,
  PlatformVocabularyV1EnvironmentVariableId,
  PlatformVocabularyV1EvaluationMethod,
  PlatformVocabularyV1EvidenceArtifactKind,
  PlatformVocabularyV1ExtensionId,
  PlatformVocabularyV1InstallationScope,
  PlatformVocabularyV1InstallerState,
  PlatformVocabularyV1LifecycleMode,
  PlatformVocabularyV1MachineClass,
  PlatformVocabularyV1MemoryMebibytes,
  PlatformVocabularyV1NativeHostCleanupState,
  PlatformVocabularyV1NativeHostName,
  PlatformVocabularyV1OwnerDecisionState,
  PlatformVocabularyV1PackageFormat,
  PlatformVocabularyV1PathResolutionState,
  PlatformVocabularyV1PathRole,
  PlatformVocabularyV1PathSegment,
  PlatformVocabularyV1PlatformCapabilityId,
  PlatformVocabularyV1PlatformComponentId,
  PlatformVocabularyV1PlatformId,
  PlatformVocabularyV1PlatformReasonCode,
  PlatformVocabularyV1ProcessArgument,
  PlatformVocabularyV1ProcessExitCode,
  PlatformVocabularyV1ProcessProfileId,
  PlatformVocabularyV1ProcessState,
  PlatformVocabularyV1ProductVersion,
  PlatformVocabularyV1ProfileAcceptanceState,
  PlatformVocabularyV1RedactedPathReference,
  PlatformVocabularyV1RegistrationOperation,
  PlatformVocabularyV1RegistrationState,
  PlatformVocabularyV1RequestContext,
  PlatformVocabularyV1ReviewState,
  PlatformVocabularyV1RuntimeFamily,
  PlatformVocabularyV1SecretKeyRole,
  PlatformVocabularyV1SecretOperation,
  PlatformVocabularyV1SecretReference,
  PlatformVocabularyV1SecretResultState,
  PlatformVocabularyV1Severity,
  PlatformVocabularyV1SignatureState,
  PlatformVocabularyV1StdioMode,
  PlatformVocabularyV1SupportClaim,
  PlatformVocabularyV1SupportTier,
  PlatformVocabularyV1TerminationRequest,
  PlatformVocabularyV1TimeoutMilliseconds,
  PlatformVocabularyV1UpdateState,
  PlatformVocabularyV1UserDataPreservation,
} from "./platform/vocabulary.v1.ts";
import type {
  RenderingLayoutMeasurementV1,
  RenderingLayoutMeasurementV1ContentBounds,
  RenderingLayoutMeasurementV1EnvironmentMetadata,
  RenderingLayoutMeasurementV1FontCommitment,
  RenderingLayoutMeasurementV1LayoutResult,
  RenderingLayoutMeasurementV1PageDimensions,
} from "./rendering/layout-measurement.v1.ts";
import type {
  ResumeAtomicClaimV1,
  ResumeAtomicClaimV1ClaimType,
  ResumeAtomicClaimV1UserAction,
  ResumeAtomicClaimV1VerificationStatus,
} from "./resume/atomic-claim.v1.ts";
import type {
  ResumePlanV1,
  ResumePlanV1Budget,
  ResumePlanV1EditDecision,
  ResumePlanV1EvidenceAssignment,
  ResumePlanV1RequirementEntry,
  ResumePlanV1TerminologyDecision,
} from "./resume/plan.v1.ts";
import type {
  SecurityAuthorizationPolicyV1,
  SecurityAuthorizationPolicyV1AuthorizationAllowRow,
} from "./security/authorization-policy.v1.ts";
import type {
  SecurityAuthorizationRequestV1,
} from "./security/authorization-request.v1.ts";
import type {
  SecurityCapabilityTaxonomyV1,
  SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  SecurityCapabilityTaxonomyV1CapabilityEntry,
  SecurityCapabilityTaxonomyV1CapabilityId,
  SecurityCapabilityTaxonomyV1PrincipalEntry,
  SecurityCapabilityTaxonomyV1PrincipalId,
  SecurityCapabilityTaxonomyV1ProfileEntry,
} from "./security/capability-taxonomy.v1.ts";
import type {
  SecurityCommandTaxonomyV1,
  SecurityCommandTaxonomyV1CommandEntry,
  SecurityCommandTaxonomyV1CommandId,
  SecurityCommandTaxonomyV1ConsequenceClass,
  SecurityCommandTaxonomyV1IdempotencyExpectation,
} from "./security/command-taxonomy.v1.ts";
import type {
  SemanticRuleCatalogV1,
  SemanticRuleCatalogV1RuleEntry,
  SemanticRuleCatalogV1RuleKind,
} from "./semantic/rule-catalog.v1.ts";
import type {
  SessionApplicationSessionV1,
  SessionApplicationSessionV1RevalidationState,
  SessionApplicationSessionV1RuntimeMetadata,
  SessionApplicationSessionV1SessionLifecycleState,
  SessionApplicationSessionV1SnapshotDigests,
} from "./session/application-session.v1.ts";
import type {
  SessionGuidedRunModeV1,
  SessionGuidedRunModeV1PageEligibility,
  SessionGuidedRunModeV1RevocationState,
  SessionGuidedRunModeV1RunKind,
  SessionGuidedRunModeV1SnapshotReadiness,
  SessionGuidedRunModeV1SnapshotState,
  SessionGuidedRunModeV1StartPolicy,
} from "./session/guided-run-mode.v1.ts";
import type {
  SessionNavigationRecordV1,
  SessionNavigationRecordV1NavigationAction,
  SessionNavigationRecordV1NavigationOutcome,
  SessionNavigationRecordV1ReasonCode,
  SessionNavigationRecordV1TransitionPostconditions,
} from "./session/navigation-record.v1.ts";
import type {
  SessionPageReadinessProofV1,
  SessionPageReadinessProofV1BlockingCounts,
  SessionPageReadinessProofV1NavigationControlIdentity,
  SessionPageReadinessProofV1SiteValidationStatus,
} from "./session/page-readiness-proof.v1.ts";
import type {
  WorkdayCertificationRecordV1,
  WorkdayCertificationRecordV1CertificationMetrics,
  WorkdayCertificationRecordV1CertificationState,
  WorkdayCertificationRecordV1PlatformProfile,
} from "./workday/certification-record.v1.ts";
import type {
  WorkdayStepIdentityV1,
  WorkdayStepIdentityV1BoundaryClass,
  WorkdayStepIdentityV1RecognitionSignal,
  WorkdayStepIdentityV1RecognitionSignalKind,
  WorkdayStepIdentityV1StepFamily,
} from "./workday/step-identity.v1.ts";
import type {
  WorkdayTenantFingerprintV1,
  WorkdayTenantFingerprintV1BrowserCompatibility,
  WorkdayTenantFingerprintV1BrowserFamily,
  WorkdayTenantFingerprintV1CandidateSessionMode,
  WorkdayTenantFingerprintV1HostnameFamily,
} from "./workday/tenant-fingerprint.v1.ts";

/**
 * Typed validation outcome. Failures preserve the structured error list
 * produced by the canonical validator (instance path plus message); nothing
 * is coerced, defaulted, or removed on either path.
 */
export type ContractValidationOutcome<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly errors: readonly string[] };

/**
 * Generated mapping from catalog schema reference to generated type
 * identity. Only meaningful references appear: every $defs entry plus the
 * root payload schema of documents that declare one. A definitions-only
 * document id is deliberately absent — its bare id compiles to an
 * unconstrained schema and validating against it would be meaningless.
 */
export interface GeneratedTypeByRef {
  readonly "urn:japp:schema:ats:variant-identity:v1": AtsVariantIdentityV1;
  readonly "urn:japp:schema:ats:variant-identity:v1#/$defs/sessionMode": AtsVariantIdentityV1SessionMode;
  readonly "urn:japp:schema:benchmark:case:v1": BenchmarkCaseV1;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/benchmarkFamily": BenchmarkCaseV1BenchmarkFamily;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/environmentRequirements": BenchmarkCaseV1EnvironmentRequirements;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/expectedBehavior": BenchmarkCaseV1ExpectedBehavior;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/inputArtifact": BenchmarkCaseV1InputArtifact;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/metricUnit": BenchmarkCaseV1MetricUnit;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/threshold": BenchmarkCaseV1Threshold;
  readonly "urn:japp:schema:benchmark:case:v1#/$defs/thresholdComparator": BenchmarkCaseV1ThresholdComparator;
  readonly "urn:japp:schema:benchmark:holdout-manifest:v1": BenchmarkHoldoutManifestV1;
  readonly "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/categoryCount": BenchmarkHoldoutManifestV1CategoryCount;
  readonly "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/encryptedBundleMetadata": BenchmarkHoldoutManifestV1EncryptedBundleMetadata;
  readonly "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/fileCommitment": BenchmarkHoldoutManifestV1FileCommitment;
  readonly "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/schemaVersionEntry": BenchmarkHoldoutManifestV1SchemaVersionEntry;
  readonly "urn:japp:schema:benchmark:result:v1": BenchmarkResultV1;
  readonly "urn:japp:schema:benchmark:result:v1#/$defs/completenessState": BenchmarkResultV1CompletenessState;
  readonly "urn:japp:schema:benchmark:result:v1#/$defs/environmentMatchState": BenchmarkResultV1EnvironmentMatchState;
  readonly "urn:japp:schema:benchmark:result:v1#/$defs/hashState": BenchmarkResultV1HashState;
  readonly "urn:japp:schema:benchmark:result:v1#/$defs/holdoutState": BenchmarkResultV1HoldoutState;
  readonly "urn:japp:schema:benchmark:result:v1#/$defs/metricResult": BenchmarkResultV1MetricResult;
  readonly "urn:japp:schema:benchmark:result:v1#/$defs/runtimeMetadata": BenchmarkResultV1RuntimeMetadata;
  readonly "urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate": CommonCalendarDateV1CalendarDate;
  readonly "urn:japp:schema:common:confidence:v1#/$defs/confidence": CommonConfidenceV1Confidence;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/boundedToken": CommonContractTextV1BoundedToken;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/gitObjectId": CommonContractTextV1GitObjectId;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/locale": CommonContractTextV1Locale;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/metricValue": CommonContractTextV1MetricValue;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/nonNegativeSafeInteger": CommonContractTextV1NonNegativeSafeInteger;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/normalizedText": CommonContractTextV1NormalizedText;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/positiveSafeInteger": CommonContractTextV1PositiveSafeInteger;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/schemaReference": CommonContractTextV1SchemaReference;
  readonly "urn:japp:schema:common:contract-text:v1#/$defs/versionText": CommonContractTextV1VersionText;
  readonly "urn:japp:schema:common:correlation:v1#/$defs/causationId": CommonCorrelationV1CausationId;
  readonly "urn:japp:schema:common:correlation:v1#/$defs/correlationId": CommonCorrelationV1CorrelationId;
  readonly "urn:japp:schema:common:enum-token:v1#/$defs/enumToken": CommonEnumTokenV1EnumToken;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata": CommonEnvelopeV1EnvelopeMetadata;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord": CommonEnvelopeV1EnvelopedRecord;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/extensionKey": CommonEnvelopeV1ExtensionKey;
  readonly "urn:japp:schema:common:envelope:v1#/$defs/extensions": CommonEnvelopeV1Extensions;
  readonly "urn:japp:schema:common:location:v1#/$defs/countryCode": CommonLocationV1CountryCode;
  readonly "urn:japp:schema:common:location:v1#/$defs/structuredLocation": CommonLocationV1StructuredLocation;
  readonly "urn:japp:schema:common:money:v1#/$defs/currencyCode": CommonMoneyV1CurrencyCode;
  readonly "urn:japp:schema:common:money:v1#/$defs/decimalAmount": CommonMoneyV1DecimalAmount;
  readonly "urn:japp:schema:common:money:v1#/$defs/money": CommonMoneyV1Money;
  readonly "urn:japp:schema:common:provenance:v1#/$defs/contentDigest": CommonProvenanceV1ContentDigest;
  readonly "urn:japp:schema:common:provenance:v1#/$defs/provenance": CommonProvenanceV1Provenance;
  readonly "urn:japp:schema:common:provenance:v1#/$defs/sourceKind": CommonProvenanceV1SourceKind;
  readonly "urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation": CommonRedactionV1RedactionAnnotation;
  readonly "urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy": CommonRedactionV1RedactionPolicy;
  readonly "urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass": CommonRedactionV1SensitivityClass;
  readonly "urn:japp:schema:common:schema-version:v1#/$defs/schemaId": CommonSchemaVersionV1SchemaId;
  readonly "urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion": CommonSchemaVersionV1SchemaVersion;
  readonly "urn:japp:schema:common:stable-id:v1#/$defs/idPrefix": CommonStableIdV1IdPrefix;
  readonly "urn:japp:schema:common:stable-id:v1#/$defs/stableId": CommonStableIdV1StableId;
  readonly "urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp": CommonTimestampUtcV1UtcTimestamp;
  readonly "urn:japp:schema:error:catalog:v1": ErrorCatalogV1;
  readonly "urn:japp:schema:error:catalog:v1#/$defs/catalogEntry": ErrorCatalogV1CatalogEntry;
  readonly "urn:japp:schema:error:record:v1": ErrorRecordV1;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorCode": ErrorTaxonomyV1ErrorCode;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily": ErrorTaxonomyV1ErrorFamily;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin": ErrorTaxonomyV1ErrorOrigin;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity": ErrorTaxonomyV1ErrorSeverity;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/messageKey": ErrorTaxonomyV1MessageKey;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition": ErrorTaxonomyV1RetryDisposition;
  readonly "urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage": ErrorTaxonomyV1UserSafeMessage;
  readonly "urn:japp:schema:fixture:test-record:v1": FixtureTestRecordV1;
  readonly "urn:japp:schema:form:driver-result:v1": FormDriverResultV1;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/actionAttempt": FormDriverResultV1ActionAttempt;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/driverOutcome": FormDriverResultV1DriverOutcome;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/preconditionsResult": FormDriverResultV1PreconditionsResult;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/reasonCode": FormDriverResultV1ReasonCode;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/recoveryResult": FormDriverResultV1RecoveryResult;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/resolutionResult": FormDriverResultV1ResolutionResult;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/siteAcceptance": FormDriverResultV1SiteAcceptance;
  readonly "urn:japp:schema:form:driver-result:v1#/$defs/valueEvidence": FormDriverResultV1ValueEvidence;
  readonly "urn:japp:schema:form:field-address:v1": FormFieldAddressV1;
  readonly "urn:japp:schema:form:field-address:v1#/$defs/atsFamily": FormFieldAddressV1AtsFamily;
  readonly "urn:japp:schema:form:field-address:v1#/$defs/repeaterPathEntry": FormFieldAddressV1RepeaterPathEntry;
  readonly "urn:japp:schema:form:field-address:v1#/$defs/resolutionHint": FormFieldAddressV1ResolutionHint;
  readonly "urn:japp:schema:form:field-address:v1#/$defs/resolutionHintKind": FormFieldAddressV1ResolutionHintKind;
  readonly "urn:japp:schema:form:field-address:v1#/$defs/stabilityClass": FormFieldAddressV1StabilityClass;
  readonly "urn:japp:schema:form:field-decision:v1": FormFieldDecisionV1;
  readonly "urn:japp:schema:form:field-decision:v1#/$defs/confirmationState": FormFieldDecisionV1ConfirmationState;
  readonly "urn:japp:schema:form:field-decision:v1#/$defs/finalDecision": FormFieldDecisionV1FinalDecision;
  readonly "urn:japp:schema:form:field-decision:v1#/$defs/policyDecision": FormFieldDecisionV1PolicyDecision;
  readonly "urn:japp:schema:form:field-decision:v1#/$defs/reasonCode": FormFieldDecisionV1ReasonCode;
  readonly "urn:japp:schema:form:field-decision:v1#/$defs/valueSourceType": FormFieldDecisionV1ValueSourceType;
  readonly "urn:japp:schema:form:field-descriptor:v1": FormFieldDescriptorV1;
  readonly "urn:japp:schema:form:field-descriptor:v1#/$defs/controlKind": FormFieldDescriptorV1ControlKind;
  readonly "urn:japp:schema:form:field-descriptor:v1#/$defs/observedValue": FormFieldDescriptorV1ObservedValue;
  readonly "urn:japp:schema:form:field-descriptor:v1#/$defs/optionSemantic": FormFieldDescriptorV1OptionSemantic;
  readonly "urn:japp:schema:form:field-descriptor:v1#/$defs/untrustedTextRepresentation": FormFieldDescriptorV1UntrustedTextRepresentation;
  readonly "urn:japp:schema:form:field-descriptor:v1#/$defs/validationState": FormFieldDescriptorV1ValidationState;
  readonly "urn:japp:schema:form:reconciliation-inventory:v1": FormReconciliationInventoryV1;
  readonly "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/confirmationState": FormReconciliationInventoryV1ConfirmationState;
  readonly "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryCounts": FormReconciliationInventoryV1InventoryCounts;
  readonly "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryItem": FormReconciliationInventoryV1InventoryItem;
  readonly "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/reconciliationCategory": FormReconciliationInventoryV1ReconciliationCategory;
  readonly "urn:japp:schema:gate:decision:v1": GateDecisionV1;
  readonly "urn:japp:schema:gate:decision:v1#/$defs/gateDecision": GateDecisionV1GateDecision;
  readonly "urn:japp:schema:gate:decision:v1#/$defs/independentReviewState": GateDecisionV1IndependentReviewState;
  readonly "urn:japp:schema:gate:decision:v1#/$defs/ownerDecisionState": GateDecisionV1OwnerDecisionState;
  readonly "urn:japp:schema:gate:decision:v1#/$defs/reasonCode": GateDecisionV1ReasonCode;
  readonly "urn:japp:schema:gate:decision:v1#/$defs/thresholdEvidenceSummary": GateDecisionV1ThresholdEvidenceSummary;
  readonly "urn:japp:schema:gate:evidence-bundle:v1": GateEvidenceBundleV1;
  readonly "urn:japp:schema:gate:evidence-bundle:v1#/$defs/completenessInventory": GateEvidenceBundleV1CompletenessInventory;
  readonly "urn:japp:schema:gate:evidence-bundle:v1#/$defs/gateId": GateEvidenceBundleV1GateId;
  readonly "urn:japp:schema:platform:browser-discovery-request:v1": PlatformBrowserDiscoveryRequestV1;
  readonly "urn:japp:schema:platform:browser-record:v1": PlatformBrowserRecordV1;
  readonly "urn:japp:schema:platform:browser-record:v2": PlatformBrowserRecordV2;
  readonly "urn:japp:schema:platform:capability-report:v1": PlatformCapabilityReportV1;
  readonly "urn:japp:schema:platform:capability-report:v2": PlatformCapabilityReportV2;
  readonly "urn:japp:schema:platform:certification-input:v1": PlatformCertificationInputV1;
  readonly "urn:japp:schema:platform:certification-input:v2": PlatformCertificationInputV2;
  readonly "urn:japp:schema:platform:certification-input:v2#/$defs/evidenceInventoryItem": PlatformCertificationInputV2EvidenceInventoryItem;
  readonly "urn:japp:schema:platform:diagnostic-report:v1": PlatformDiagnosticReportV1;
  readonly "urn:japp:schema:platform:diagnostic-report:v2": PlatformDiagnosticReportV2;
  readonly "urn:japp:schema:platform:evidence-record:v1": PlatformEvidenceRecordV1;
  readonly "urn:japp:schema:platform:evidence-record:v2": PlatformEvidenceRecordV2;
  readonly "urn:japp:schema:platform:installer-state:v1": PlatformInstallerStateV1;
  readonly "urn:japp:schema:platform:installer-state:v2": PlatformInstallerStateV2;
  readonly "urn:japp:schema:platform:model-runtime-profile:v1": PlatformModelRuntimeProfileV1;
  readonly "urn:japp:schema:platform:model-runtime-profile:v2": PlatformModelRuntimeProfileV2;
  readonly "urn:japp:schema:platform:native-messaging-registration:v1": PlatformNativeMessagingRegistrationV1;
  readonly "urn:japp:schema:platform:native-messaging-registration:v2": PlatformNativeMessagingRegistrationV2;
  readonly "urn:japp:schema:platform:native-messaging-result:v1": PlatformNativeMessagingResultV1;
  readonly "urn:japp:schema:platform:native-messaging-result:v2": PlatformNativeMessagingResultV2;
  readonly "urn:japp:schema:platform:path-request:v1": PlatformPathRequestV1;
  readonly "urn:japp:schema:platform:path-resolution:v1": PlatformPathResolutionV1;
  readonly "urn:japp:schema:platform:path-resolution:v2": PlatformPathResolutionV2;
  readonly "urn:japp:schema:platform:process-plan:v1": PlatformProcessPlanV1;
  readonly "urn:japp:schema:platform:process-plan:v2": PlatformProcessPlanV2;
  readonly "urn:japp:schema:platform:process-status:v1": PlatformProcessStatusV1;
  readonly "urn:japp:schema:platform:process-status:v2": PlatformProcessStatusV2;
  readonly "urn:japp:schema:platform:runtime-capability:v1": PlatformRuntimeCapabilityV1;
  readonly "urn:japp:schema:platform:runtime-capability:v2": PlatformRuntimeCapabilityV2;
  readonly "urn:japp:schema:platform:secret-store-request:v1": PlatformSecretStoreRequestV1;
  readonly "urn:japp:schema:platform:secret-store-result:v1": PlatformSecretStoreResultV1;
  readonly "urn:japp:schema:platform:secret-store-result:v2": PlatformSecretStoreResultV2;
  readonly "urn:japp:schema:platform:target-identity:v1": PlatformTargetIdentityV1;
  readonly "urn:japp:schema:platform:update-state:v1": PlatformUpdateStateV1;
  readonly "urn:japp:schema:platform:update-state:v2": PlatformUpdateStateV2;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/acceleratorClass": PlatformVocabularyV1AcceleratorClass;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/architecture": PlatformVocabularyV1Architecture;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/artifactIdentity": PlatformVocabularyV1ArtifactIdentity;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/boundedUserMessage": PlatformVocabularyV1BoundedUserMessage;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/browserChannel": PlatformVocabularyV1BrowserChannel;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/browserFamily": PlatformVocabularyV1BrowserFamily;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/buildToken": PlatformVocabularyV1BuildToken;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityAvailability": PlatformVocabularyV1CapabilityAvailability;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityState": PlatformVocabularyV1CapabilityState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/certifiedPlatformId": PlatformVocabularyV1CertifiedPlatformId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/contextTokens": PlatformVocabularyV1ContextTokens;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/coreCapabilityBehavior": PlatformVocabularyV1CoreCapabilityBehavior;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/diagnosticResult": PlatformVocabularyV1DiagnosticResult;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/distributionChannel": PlatformVocabularyV1DistributionChannel;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/environmentEntry": PlatformVocabularyV1EnvironmentEntry;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/environmentVariableId": PlatformVocabularyV1EnvironmentVariableId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/evaluationMethod": PlatformVocabularyV1EvaluationMethod;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/evidenceArtifactKind": PlatformVocabularyV1EvidenceArtifactKind;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/extensionId": PlatformVocabularyV1ExtensionId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/installationScope": PlatformVocabularyV1InstallationScope;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/installerState": PlatformVocabularyV1InstallerState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/lifecycleMode": PlatformVocabularyV1LifecycleMode;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/machineClass": PlatformVocabularyV1MachineClass;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/memoryMebibytes": PlatformVocabularyV1MemoryMebibytes;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostCleanupState": PlatformVocabularyV1NativeHostCleanupState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostName": PlatformVocabularyV1NativeHostName;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/ownerDecisionState": PlatformVocabularyV1OwnerDecisionState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/packageFormat": PlatformVocabularyV1PackageFormat;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/pathResolutionState": PlatformVocabularyV1PathResolutionState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/pathRole": PlatformVocabularyV1PathRole;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/pathSegment": PlatformVocabularyV1PathSegment;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/platformCapabilityId": PlatformVocabularyV1PlatformCapabilityId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/platformComponentId": PlatformVocabularyV1PlatformComponentId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/platformId": PlatformVocabularyV1PlatformId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/platformReasonCode": PlatformVocabularyV1PlatformReasonCode;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/processArgument": PlatformVocabularyV1ProcessArgument;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/processExitCode": PlatformVocabularyV1ProcessExitCode;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/processProfileId": PlatformVocabularyV1ProcessProfileId;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/processState": PlatformVocabularyV1ProcessState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/productVersion": PlatformVocabularyV1ProductVersion;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/profileAcceptanceState": PlatformVocabularyV1ProfileAcceptanceState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/redactedPathReference": PlatformVocabularyV1RedactedPathReference;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/registrationOperation": PlatformVocabularyV1RegistrationOperation;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/registrationState": PlatformVocabularyV1RegistrationState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/requestContext": PlatformVocabularyV1RequestContext;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/reviewState": PlatformVocabularyV1ReviewState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/runtimeFamily": PlatformVocabularyV1RuntimeFamily;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/secretKeyRole": PlatformVocabularyV1SecretKeyRole;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/secretOperation": PlatformVocabularyV1SecretOperation;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/secretReference": PlatformVocabularyV1SecretReference;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/secretResultState": PlatformVocabularyV1SecretResultState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/severity": PlatformVocabularyV1Severity;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/signatureState": PlatformVocabularyV1SignatureState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/stdioMode": PlatformVocabularyV1StdioMode;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/supportClaim": PlatformVocabularyV1SupportClaim;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/supportTier": PlatformVocabularyV1SupportTier;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/terminationRequest": PlatformVocabularyV1TerminationRequest;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/timeoutMilliseconds": PlatformVocabularyV1TimeoutMilliseconds;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/updateState": PlatformVocabularyV1UpdateState;
  readonly "urn:japp:schema:platform:vocabulary:v1#/$defs/userDataPreservation": PlatformVocabularyV1UserDataPreservation;
  readonly "urn:japp:schema:rendering:layout-measurement:v1": RenderingLayoutMeasurementV1;
  readonly "urn:japp:schema:rendering:layout-measurement:v1#/$defs/contentBounds": RenderingLayoutMeasurementV1ContentBounds;
  readonly "urn:japp:schema:rendering:layout-measurement:v1#/$defs/environmentMetadata": RenderingLayoutMeasurementV1EnvironmentMetadata;
  readonly "urn:japp:schema:rendering:layout-measurement:v1#/$defs/fontCommitment": RenderingLayoutMeasurementV1FontCommitment;
  readonly "urn:japp:schema:rendering:layout-measurement:v1#/$defs/layoutResult": RenderingLayoutMeasurementV1LayoutResult;
  readonly "urn:japp:schema:rendering:layout-measurement:v1#/$defs/pageDimensions": RenderingLayoutMeasurementV1PageDimensions;
  readonly "urn:japp:schema:resume:atomic-claim:v1": ResumeAtomicClaimV1;
  readonly "urn:japp:schema:resume:atomic-claim:v1#/$defs/claimType": ResumeAtomicClaimV1ClaimType;
  readonly "urn:japp:schema:resume:atomic-claim:v1#/$defs/userAction": ResumeAtomicClaimV1UserAction;
  readonly "urn:japp:schema:resume:atomic-claim:v1#/$defs/verificationStatus": ResumeAtomicClaimV1VerificationStatus;
  readonly "urn:japp:schema:resume:plan:v1": ResumePlanV1;
  readonly "urn:japp:schema:resume:plan:v1#/$defs/budget": ResumePlanV1Budget;
  readonly "urn:japp:schema:resume:plan:v1#/$defs/editDecision": ResumePlanV1EditDecision;
  readonly "urn:japp:schema:resume:plan:v1#/$defs/evidenceAssignment": ResumePlanV1EvidenceAssignment;
  readonly "urn:japp:schema:resume:plan:v1#/$defs/requirementEntry": ResumePlanV1RequirementEntry;
  readonly "urn:japp:schema:resume:plan:v1#/$defs/terminologyDecision": ResumePlanV1TerminologyDecision;
  readonly "urn:japp:schema:security:authorization-policy:v1": SecurityAuthorizationPolicyV1;
  readonly "urn:japp:schema:security:authorization-policy:v1#/$defs/authorizationAllowRow": SecurityAuthorizationPolicyV1AuthorizationAllowRow;
  readonly "urn:japp:schema:security:authorization-request:v1": SecurityAuthorizationRequestV1;
  readonly "urn:japp:schema:security:capability-taxonomy:v1": SecurityCapabilityTaxonomyV1;
  readonly "urn:japp:schema:security:capability-taxonomy:v1#/$defs/authorizationProfileId": SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly "urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityEntry": SecurityCapabilityTaxonomyV1CapabilityEntry;
  readonly "urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityId": SecurityCapabilityTaxonomyV1CapabilityId;
  readonly "urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalEntry": SecurityCapabilityTaxonomyV1PrincipalEntry;
  readonly "urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalId": SecurityCapabilityTaxonomyV1PrincipalId;
  readonly "urn:japp:schema:security:capability-taxonomy:v1#/$defs/profileEntry": SecurityCapabilityTaxonomyV1ProfileEntry;
  readonly "urn:japp:schema:security:command-taxonomy:v1": SecurityCommandTaxonomyV1;
  readonly "urn:japp:schema:security:command-taxonomy:v1#/$defs/commandEntry": SecurityCommandTaxonomyV1CommandEntry;
  readonly "urn:japp:schema:security:command-taxonomy:v1#/$defs/commandId": SecurityCommandTaxonomyV1CommandId;
  readonly "urn:japp:schema:security:command-taxonomy:v1#/$defs/consequenceClass": SecurityCommandTaxonomyV1ConsequenceClass;
  readonly "urn:japp:schema:security:command-taxonomy:v1#/$defs/idempotencyExpectation": SecurityCommandTaxonomyV1IdempotencyExpectation;
  readonly "urn:japp:schema:semantic:rule-catalog:v1": SemanticRuleCatalogV1;
  readonly "urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleEntry": SemanticRuleCatalogV1RuleEntry;
  readonly "urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleKind": SemanticRuleCatalogV1RuleKind;
  readonly "urn:japp:schema:session:application-session:v1": SessionApplicationSessionV1;
  readonly "urn:japp:schema:session:application-session:v1#/$defs/revalidationState": SessionApplicationSessionV1RevalidationState;
  readonly "urn:japp:schema:session:application-session:v1#/$defs/runtimeMetadata": SessionApplicationSessionV1RuntimeMetadata;
  readonly "urn:japp:schema:session:application-session:v1#/$defs/sessionLifecycleState": SessionApplicationSessionV1SessionLifecycleState;
  readonly "urn:japp:schema:session:application-session:v1#/$defs/snapshotDigests": SessionApplicationSessionV1SnapshotDigests;
  readonly "urn:japp:schema:session:guided-run-mode:v1": SessionGuidedRunModeV1;
  readonly "urn:japp:schema:session:guided-run-mode:v1#/$defs/pageEligibility": SessionGuidedRunModeV1PageEligibility;
  readonly "urn:japp:schema:session:guided-run-mode:v1#/$defs/revocationState": SessionGuidedRunModeV1RevocationState;
  readonly "urn:japp:schema:session:guided-run-mode:v1#/$defs/runKind": SessionGuidedRunModeV1RunKind;
  readonly "urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotReadiness": SessionGuidedRunModeV1SnapshotReadiness;
  readonly "urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotState": SessionGuidedRunModeV1SnapshotState;
  readonly "urn:japp:schema:session:guided-run-mode:v1#/$defs/startPolicy": SessionGuidedRunModeV1StartPolicy;
  readonly "urn:japp:schema:session:navigation-record:v1": SessionNavigationRecordV1;
  readonly "urn:japp:schema:session:navigation-record:v1#/$defs/navigationAction": SessionNavigationRecordV1NavigationAction;
  readonly "urn:japp:schema:session:navigation-record:v1#/$defs/navigationOutcome": SessionNavigationRecordV1NavigationOutcome;
  readonly "urn:japp:schema:session:navigation-record:v1#/$defs/reasonCode": SessionNavigationRecordV1ReasonCode;
  readonly "urn:japp:schema:session:navigation-record:v1#/$defs/transitionPostconditions": SessionNavigationRecordV1TransitionPostconditions;
  readonly "urn:japp:schema:session:page-readiness-proof:v1": SessionPageReadinessProofV1;
  readonly "urn:japp:schema:session:page-readiness-proof:v1#/$defs/blockingCounts": SessionPageReadinessProofV1BlockingCounts;
  readonly "urn:japp:schema:session:page-readiness-proof:v1#/$defs/navigationControlIdentity": SessionPageReadinessProofV1NavigationControlIdentity;
  readonly "urn:japp:schema:session:page-readiness-proof:v1#/$defs/siteValidationStatus": SessionPageReadinessProofV1SiteValidationStatus;
  readonly "urn:japp:schema:workday:certification-record:v1": WorkdayCertificationRecordV1;
  readonly "urn:japp:schema:workday:certification-record:v1#/$defs/certificationMetrics": WorkdayCertificationRecordV1CertificationMetrics;
  readonly "urn:japp:schema:workday:certification-record:v1#/$defs/certificationState": WorkdayCertificationRecordV1CertificationState;
  readonly "urn:japp:schema:workday:certification-record:v1#/$defs/platformProfile": WorkdayCertificationRecordV1PlatformProfile;
  readonly "urn:japp:schema:workday:step-identity:v1": WorkdayStepIdentityV1;
  readonly "urn:japp:schema:workday:step-identity:v1#/$defs/boundaryClass": WorkdayStepIdentityV1BoundaryClass;
  readonly "urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignal": WorkdayStepIdentityV1RecognitionSignal;
  readonly "urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignalKind": WorkdayStepIdentityV1RecognitionSignalKind;
  readonly "urn:japp:schema:workday:step-identity:v1#/$defs/stepFamily": WorkdayStepIdentityV1StepFamily;
  readonly "urn:japp:schema:workday:tenant-fingerprint:v1": WorkdayTenantFingerprintV1;
  readonly "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserCompatibility": WorkdayTenantFingerprintV1BrowserCompatibility;
  readonly "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserFamily": WorkdayTenantFingerprintV1BrowserFamily;
  readonly "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/candidateSessionMode": WorkdayTenantFingerprintV1CandidateSessionMode;
  readonly "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/hostnameFamily": WorkdayTenantFingerprintV1HostnameFamily;
}

/** Every generated catalog reference, sorted. */
export const CONTRACT_SCHEMA_REFS: readonly (keyof GeneratedTypeByRef)[] = [
  "urn:japp:schema:ats:variant-identity:v1",
  "urn:japp:schema:ats:variant-identity:v1#/$defs/sessionMode",
  "urn:japp:schema:benchmark:case:v1",
  "urn:japp:schema:benchmark:case:v1#/$defs/benchmarkFamily",
  "urn:japp:schema:benchmark:case:v1#/$defs/environmentRequirements",
  "urn:japp:schema:benchmark:case:v1#/$defs/expectedBehavior",
  "urn:japp:schema:benchmark:case:v1#/$defs/inputArtifact",
  "urn:japp:schema:benchmark:case:v1#/$defs/metricUnit",
  "urn:japp:schema:benchmark:case:v1#/$defs/threshold",
  "urn:japp:schema:benchmark:case:v1#/$defs/thresholdComparator",
  "urn:japp:schema:benchmark:holdout-manifest:v1",
  "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/categoryCount",
  "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/encryptedBundleMetadata",
  "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/fileCommitment",
  "urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/schemaVersionEntry",
  "urn:japp:schema:benchmark:result:v1",
  "urn:japp:schema:benchmark:result:v1#/$defs/completenessState",
  "urn:japp:schema:benchmark:result:v1#/$defs/environmentMatchState",
  "urn:japp:schema:benchmark:result:v1#/$defs/hashState",
  "urn:japp:schema:benchmark:result:v1#/$defs/holdoutState",
  "urn:japp:schema:benchmark:result:v1#/$defs/metricResult",
  "urn:japp:schema:benchmark:result:v1#/$defs/runtimeMetadata",
  "urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate",
  "urn:japp:schema:common:confidence:v1#/$defs/confidence",
  "urn:japp:schema:common:contract-text:v1#/$defs/boundedToken",
  "urn:japp:schema:common:contract-text:v1#/$defs/gitObjectId",
  "urn:japp:schema:common:contract-text:v1#/$defs/locale",
  "urn:japp:schema:common:contract-text:v1#/$defs/metricValue",
  "urn:japp:schema:common:contract-text:v1#/$defs/nonNegativeSafeInteger",
  "urn:japp:schema:common:contract-text:v1#/$defs/normalizedText",
  "urn:japp:schema:common:contract-text:v1#/$defs/positiveSafeInteger",
  "urn:japp:schema:common:contract-text:v1#/$defs/schemaReference",
  "urn:japp:schema:common:contract-text:v1#/$defs/versionText",
  "urn:japp:schema:common:correlation:v1#/$defs/causationId",
  "urn:japp:schema:common:correlation:v1#/$defs/correlationId",
  "urn:japp:schema:common:enum-token:v1#/$defs/enumToken",
  "urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata",
  "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord",
  "urn:japp:schema:common:envelope:v1#/$defs/extensionKey",
  "urn:japp:schema:common:envelope:v1#/$defs/extensions",
  "urn:japp:schema:common:location:v1#/$defs/countryCode",
  "urn:japp:schema:common:location:v1#/$defs/structuredLocation",
  "urn:japp:schema:common:money:v1#/$defs/currencyCode",
  "urn:japp:schema:common:money:v1#/$defs/decimalAmount",
  "urn:japp:schema:common:money:v1#/$defs/money",
  "urn:japp:schema:common:provenance:v1#/$defs/contentDigest",
  "urn:japp:schema:common:provenance:v1#/$defs/provenance",
  "urn:japp:schema:common:provenance:v1#/$defs/sourceKind",
  "urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation",
  "urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy",
  "urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass",
  "urn:japp:schema:common:schema-version:v1#/$defs/schemaId",
  "urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion",
  "urn:japp:schema:common:stable-id:v1#/$defs/idPrefix",
  "urn:japp:schema:common:stable-id:v1#/$defs/stableId",
  "urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp",
  "urn:japp:schema:error:catalog:v1",
  "urn:japp:schema:error:catalog:v1#/$defs/catalogEntry",
  "urn:japp:schema:error:record:v1",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorCode",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin",
  "urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity",
  "urn:japp:schema:error:taxonomy:v1#/$defs/messageKey",
  "urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition",
  "urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage",
  "urn:japp:schema:fixture:test-record:v1",
  "urn:japp:schema:form:driver-result:v1",
  "urn:japp:schema:form:driver-result:v1#/$defs/actionAttempt",
  "urn:japp:schema:form:driver-result:v1#/$defs/driverOutcome",
  "urn:japp:schema:form:driver-result:v1#/$defs/preconditionsResult",
  "urn:japp:schema:form:driver-result:v1#/$defs/reasonCode",
  "urn:japp:schema:form:driver-result:v1#/$defs/recoveryResult",
  "urn:japp:schema:form:driver-result:v1#/$defs/resolutionResult",
  "urn:japp:schema:form:driver-result:v1#/$defs/siteAcceptance",
  "urn:japp:schema:form:driver-result:v1#/$defs/valueEvidence",
  "urn:japp:schema:form:field-address:v1",
  "urn:japp:schema:form:field-address:v1#/$defs/atsFamily",
  "urn:japp:schema:form:field-address:v1#/$defs/repeaterPathEntry",
  "urn:japp:schema:form:field-address:v1#/$defs/resolutionHint",
  "urn:japp:schema:form:field-address:v1#/$defs/resolutionHintKind",
  "urn:japp:schema:form:field-address:v1#/$defs/stabilityClass",
  "urn:japp:schema:form:field-decision:v1",
  "urn:japp:schema:form:field-decision:v1#/$defs/confirmationState",
  "urn:japp:schema:form:field-decision:v1#/$defs/finalDecision",
  "urn:japp:schema:form:field-decision:v1#/$defs/policyDecision",
  "urn:japp:schema:form:field-decision:v1#/$defs/reasonCode",
  "urn:japp:schema:form:field-decision:v1#/$defs/valueSourceType",
  "urn:japp:schema:form:field-descriptor:v1",
  "urn:japp:schema:form:field-descriptor:v1#/$defs/controlKind",
  "urn:japp:schema:form:field-descriptor:v1#/$defs/observedValue",
  "urn:japp:schema:form:field-descriptor:v1#/$defs/optionSemantic",
  "urn:japp:schema:form:field-descriptor:v1#/$defs/untrustedTextRepresentation",
  "urn:japp:schema:form:field-descriptor:v1#/$defs/validationState",
  "urn:japp:schema:form:reconciliation-inventory:v1",
  "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/confirmationState",
  "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryCounts",
  "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryItem",
  "urn:japp:schema:form:reconciliation-inventory:v1#/$defs/reconciliationCategory",
  "urn:japp:schema:gate:decision:v1",
  "urn:japp:schema:gate:decision:v1#/$defs/gateDecision",
  "urn:japp:schema:gate:decision:v1#/$defs/independentReviewState",
  "urn:japp:schema:gate:decision:v1#/$defs/ownerDecisionState",
  "urn:japp:schema:gate:decision:v1#/$defs/reasonCode",
  "urn:japp:schema:gate:decision:v1#/$defs/thresholdEvidenceSummary",
  "urn:japp:schema:gate:evidence-bundle:v1",
  "urn:japp:schema:gate:evidence-bundle:v1#/$defs/completenessInventory",
  "urn:japp:schema:gate:evidence-bundle:v1#/$defs/gateId",
  "urn:japp:schema:platform:browser-discovery-request:v1",
  "urn:japp:schema:platform:browser-record:v1",
  "urn:japp:schema:platform:browser-record:v2",
  "urn:japp:schema:platform:capability-report:v1",
  "urn:japp:schema:platform:capability-report:v2",
  "urn:japp:schema:platform:certification-input:v1",
  "urn:japp:schema:platform:certification-input:v2",
  "urn:japp:schema:platform:certification-input:v2#/$defs/evidenceInventoryItem",
  "urn:japp:schema:platform:diagnostic-report:v1",
  "urn:japp:schema:platform:diagnostic-report:v2",
  "urn:japp:schema:platform:evidence-record:v1",
  "urn:japp:schema:platform:evidence-record:v2",
  "urn:japp:schema:platform:installer-state:v1",
  "urn:japp:schema:platform:installer-state:v2",
  "urn:japp:schema:platform:model-runtime-profile:v1",
  "urn:japp:schema:platform:model-runtime-profile:v2",
  "urn:japp:schema:platform:native-messaging-registration:v1",
  "urn:japp:schema:platform:native-messaging-registration:v2",
  "urn:japp:schema:platform:native-messaging-result:v1",
  "urn:japp:schema:platform:native-messaging-result:v2",
  "urn:japp:schema:platform:path-request:v1",
  "urn:japp:schema:platform:path-resolution:v1",
  "urn:japp:schema:platform:path-resolution:v2",
  "urn:japp:schema:platform:process-plan:v1",
  "urn:japp:schema:platform:process-plan:v2",
  "urn:japp:schema:platform:process-status:v1",
  "urn:japp:schema:platform:process-status:v2",
  "urn:japp:schema:platform:runtime-capability:v1",
  "urn:japp:schema:platform:runtime-capability:v2",
  "urn:japp:schema:platform:secret-store-request:v1",
  "urn:japp:schema:platform:secret-store-result:v1",
  "urn:japp:schema:platform:secret-store-result:v2",
  "urn:japp:schema:platform:target-identity:v1",
  "urn:japp:schema:platform:update-state:v1",
  "urn:japp:schema:platform:update-state:v2",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/acceleratorClass",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/architecture",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/artifactIdentity",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/boundedUserMessage",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/browserChannel",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/browserFamily",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/buildToken",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityAvailability",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/certifiedPlatformId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/contextTokens",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/coreCapabilityBehavior",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/diagnosticResult",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/distributionChannel",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/environmentEntry",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/environmentVariableId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/evaluationMethod",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/evidenceArtifactKind",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/extensionId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/installationScope",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/installerState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/lifecycleMode",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/machineClass",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/memoryMebibytes",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostCleanupState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostName",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/ownerDecisionState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/packageFormat",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/pathResolutionState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/pathRole",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/pathSegment",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/platformCapabilityId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/platformComponentId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/platformId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/platformReasonCode",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/processArgument",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/processExitCode",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/processProfileId",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/processState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/productVersion",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/profileAcceptanceState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/redactedPathReference",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/registrationOperation",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/registrationState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/requestContext",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/reviewState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/runtimeFamily",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/secretKeyRole",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/secretOperation",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/secretReference",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/secretResultState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/severity",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/signatureState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/stdioMode",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/supportClaim",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/supportTier",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/terminationRequest",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/timeoutMilliseconds",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/updateState",
  "urn:japp:schema:platform:vocabulary:v1#/$defs/userDataPreservation",
  "urn:japp:schema:rendering:layout-measurement:v1",
  "urn:japp:schema:rendering:layout-measurement:v1#/$defs/contentBounds",
  "urn:japp:schema:rendering:layout-measurement:v1#/$defs/environmentMetadata",
  "urn:japp:schema:rendering:layout-measurement:v1#/$defs/fontCommitment",
  "urn:japp:schema:rendering:layout-measurement:v1#/$defs/layoutResult",
  "urn:japp:schema:rendering:layout-measurement:v1#/$defs/pageDimensions",
  "urn:japp:schema:resume:atomic-claim:v1",
  "urn:japp:schema:resume:atomic-claim:v1#/$defs/claimType",
  "urn:japp:schema:resume:atomic-claim:v1#/$defs/userAction",
  "urn:japp:schema:resume:atomic-claim:v1#/$defs/verificationStatus",
  "urn:japp:schema:resume:plan:v1",
  "urn:japp:schema:resume:plan:v1#/$defs/budget",
  "urn:japp:schema:resume:plan:v1#/$defs/editDecision",
  "urn:japp:schema:resume:plan:v1#/$defs/evidenceAssignment",
  "urn:japp:schema:resume:plan:v1#/$defs/requirementEntry",
  "urn:japp:schema:resume:plan:v1#/$defs/terminologyDecision",
  "urn:japp:schema:security:authorization-policy:v1",
  "urn:japp:schema:security:authorization-policy:v1#/$defs/authorizationAllowRow",
  "urn:japp:schema:security:authorization-request:v1",
  "urn:japp:schema:security:capability-taxonomy:v1",
  "urn:japp:schema:security:capability-taxonomy:v1#/$defs/authorizationProfileId",
  "urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityEntry",
  "urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityId",
  "urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalEntry",
  "urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalId",
  "urn:japp:schema:security:capability-taxonomy:v1#/$defs/profileEntry",
  "urn:japp:schema:security:command-taxonomy:v1",
  "urn:japp:schema:security:command-taxonomy:v1#/$defs/commandEntry",
  "urn:japp:schema:security:command-taxonomy:v1#/$defs/commandId",
  "urn:japp:schema:security:command-taxonomy:v1#/$defs/consequenceClass",
  "urn:japp:schema:security:command-taxonomy:v1#/$defs/idempotencyExpectation",
  "urn:japp:schema:semantic:rule-catalog:v1",
  "urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleEntry",
  "urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleKind",
  "urn:japp:schema:session:application-session:v1",
  "urn:japp:schema:session:application-session:v1#/$defs/revalidationState",
  "urn:japp:schema:session:application-session:v1#/$defs/runtimeMetadata",
  "urn:japp:schema:session:application-session:v1#/$defs/sessionLifecycleState",
  "urn:japp:schema:session:application-session:v1#/$defs/snapshotDigests",
  "urn:japp:schema:session:guided-run-mode:v1",
  "urn:japp:schema:session:guided-run-mode:v1#/$defs/pageEligibility",
  "urn:japp:schema:session:guided-run-mode:v1#/$defs/revocationState",
  "urn:japp:schema:session:guided-run-mode:v1#/$defs/runKind",
  "urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotReadiness",
  "urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotState",
  "urn:japp:schema:session:guided-run-mode:v1#/$defs/startPolicy",
  "urn:japp:schema:session:navigation-record:v1",
  "urn:japp:schema:session:navigation-record:v1#/$defs/navigationAction",
  "urn:japp:schema:session:navigation-record:v1#/$defs/navigationOutcome",
  "urn:japp:schema:session:navigation-record:v1#/$defs/reasonCode",
  "urn:japp:schema:session:navigation-record:v1#/$defs/transitionPostconditions",
  "urn:japp:schema:session:page-readiness-proof:v1",
  "urn:japp:schema:session:page-readiness-proof:v1#/$defs/blockingCounts",
  "urn:japp:schema:session:page-readiness-proof:v1#/$defs/navigationControlIdentity",
  "urn:japp:schema:session:page-readiness-proof:v1#/$defs/siteValidationStatus",
  "urn:japp:schema:workday:certification-record:v1",
  "urn:japp:schema:workday:certification-record:v1#/$defs/certificationMetrics",
  "urn:japp:schema:workday:certification-record:v1#/$defs/certificationState",
  "urn:japp:schema:workday:certification-record:v1#/$defs/platformProfile",
  "urn:japp:schema:workday:step-identity:v1",
  "urn:japp:schema:workday:step-identity:v1#/$defs/boundaryClass",
  "urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignal",
  "urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignalKind",
  "urn:japp:schema:workday:step-identity:v1#/$defs/stepFamily",
  "urn:japp:schema:workday:tenant-fingerprint:v1",
  "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserCompatibility",
  "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserFamily",
  "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/candidateSessionMode",
  "urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/hostnameFamily",
];

let runtimeSingleton: {
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
} | null = null;

/**
 * Lazily construct the canonical strict validator (M01-W01 catalog loader
 * plus Ajv 2020 in strict offline mode). The generated layer never
 * re-implements or weakens validation rules — runtime truth stays in the
 * hand-authored canonical layer.
 */
export function contractRuntime(): {
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
} {
  if (runtimeSingleton === null) {
    const catalog = loadSchemaCatalog();
    runtimeSingleton = {
      catalog,
      validator: createContractValidator(catalog),
    };
  }
  return runtimeSingleton;
}

/**
 * Validate unknown input against a known catalog reference. Unknown
 * references are unrepresentable in the type system and throw at runtime
 * inside the canonical validator (fail closed, never guess).
 */
export function validateContractInstance<R extends keyof GeneratedTypeByRef>(
  ref: R,
  data: unknown,
): ContractValidationOutcome<GeneratedTypeByRef[R]> {
  const result = contractRuntime().validator.validateInstance(ref, data);
  if (result.valid) {
    return { valid: true, value: data as GeneratedTypeByRef[R] };
  }
  return { valid: false, errors: result.errors };
}

/**
 * Validate unknown input against urn:japp:schema:ats:variant-identity:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated AtsVariantIdentityV1 type only after validation succeeds.
 */
export function validateAtsVariantIdentityV1(
  data: unknown,
): ContractValidationOutcome<AtsVariantIdentityV1> {
  return validateContractInstance("urn:japp:schema:ats:variant-identity:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:ats:variant-identity:v1#/$defs/sessionMode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated AtsVariantIdentityV1SessionMode type only after validation succeeds.
 */
export function validateAtsVariantIdentityV1SessionMode(
  data: unknown,
): ContractValidationOutcome<AtsVariantIdentityV1SessionMode> {
  return validateContractInstance("urn:japp:schema:ats:variant-identity:v1#/$defs/sessionMode", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1 type only after validation succeeds.
 */
export function validateBenchmarkCaseV1(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/benchmarkFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1BenchmarkFamily type only after validation succeeds.
 */
export function validateBenchmarkCaseV1BenchmarkFamily(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1BenchmarkFamily> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/benchmarkFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/environmentRequirements
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1EnvironmentRequirements type only after validation succeeds.
 */
export function validateBenchmarkCaseV1EnvironmentRequirements(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1EnvironmentRequirements> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/environmentRequirements", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/expectedBehavior
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1ExpectedBehavior type only after validation succeeds.
 */
export function validateBenchmarkCaseV1ExpectedBehavior(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1ExpectedBehavior> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/expectedBehavior", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/inputArtifact
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1InputArtifact type only after validation succeeds.
 */
export function validateBenchmarkCaseV1InputArtifact(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1InputArtifact> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/inputArtifact", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/metricUnit
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1MetricUnit type only after validation succeeds.
 */
export function validateBenchmarkCaseV1MetricUnit(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1MetricUnit> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/metricUnit", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/threshold
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1Threshold type only after validation succeeds.
 */
export function validateBenchmarkCaseV1Threshold(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1Threshold> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/threshold", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:case:v1#/$defs/thresholdComparator
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkCaseV1ThresholdComparator type only after validation succeeds.
 */
export function validateBenchmarkCaseV1ThresholdComparator(
  data: unknown,
): ContractValidationOutcome<BenchmarkCaseV1ThresholdComparator> {
  return validateContractInstance("urn:japp:schema:benchmark:case:v1#/$defs/thresholdComparator", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:holdout-manifest:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkHoldoutManifestV1 type only after validation succeeds.
 */
export function validateBenchmarkHoldoutManifestV1(
  data: unknown,
): ContractValidationOutcome<BenchmarkHoldoutManifestV1> {
  return validateContractInstance("urn:japp:schema:benchmark:holdout-manifest:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/categoryCount
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkHoldoutManifestV1CategoryCount type only after validation succeeds.
 */
export function validateBenchmarkHoldoutManifestV1CategoryCount(
  data: unknown,
): ContractValidationOutcome<BenchmarkHoldoutManifestV1CategoryCount> {
  return validateContractInstance("urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/categoryCount", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/encryptedBundleMetadata
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkHoldoutManifestV1EncryptedBundleMetadata type only after validation succeeds.
 */
export function validateBenchmarkHoldoutManifestV1EncryptedBundleMetadata(
  data: unknown,
): ContractValidationOutcome<BenchmarkHoldoutManifestV1EncryptedBundleMetadata> {
  return validateContractInstance("urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/encryptedBundleMetadata", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/fileCommitment
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkHoldoutManifestV1FileCommitment type only after validation succeeds.
 */
export function validateBenchmarkHoldoutManifestV1FileCommitment(
  data: unknown,
): ContractValidationOutcome<BenchmarkHoldoutManifestV1FileCommitment> {
  return validateContractInstance("urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/fileCommitment", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/schemaVersionEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkHoldoutManifestV1SchemaVersionEntry type only after validation succeeds.
 */
export function validateBenchmarkHoldoutManifestV1SchemaVersionEntry(
  data: unknown,
): ContractValidationOutcome<BenchmarkHoldoutManifestV1SchemaVersionEntry> {
  return validateContractInstance("urn:japp:schema:benchmark:holdout-manifest:v1#/$defs/schemaVersionEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1 type only after validation succeeds.
 */
export function validateBenchmarkResultV1(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1#/$defs/completenessState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1CompletenessState type only after validation succeeds.
 */
export function validateBenchmarkResultV1CompletenessState(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1CompletenessState> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1#/$defs/completenessState", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1#/$defs/environmentMatchState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1EnvironmentMatchState type only after validation succeeds.
 */
export function validateBenchmarkResultV1EnvironmentMatchState(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1EnvironmentMatchState> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1#/$defs/environmentMatchState", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1#/$defs/hashState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1HashState type only after validation succeeds.
 */
export function validateBenchmarkResultV1HashState(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1HashState> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1#/$defs/hashState", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1#/$defs/holdoutState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1HoldoutState type only after validation succeeds.
 */
export function validateBenchmarkResultV1HoldoutState(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1HoldoutState> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1#/$defs/holdoutState", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1#/$defs/metricResult
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1MetricResult type only after validation succeeds.
 */
export function validateBenchmarkResultV1MetricResult(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1MetricResult> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1#/$defs/metricResult", data);
}

/**
 * Validate unknown input against urn:japp:schema:benchmark:result:v1#/$defs/runtimeMetadata
 * through the strict canonical Ajv catalog, narrowing to the
 * generated BenchmarkResultV1RuntimeMetadata type only after validation succeeds.
 */
export function validateBenchmarkResultV1RuntimeMetadata(
  data: unknown,
): ContractValidationOutcome<BenchmarkResultV1RuntimeMetadata> {
  return validateContractInstance("urn:japp:schema:benchmark:result:v1#/$defs/runtimeMetadata", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonCalendarDateV1CalendarDate type only after validation succeeds.
 */
export function validateCommonCalendarDateV1CalendarDate(
  data: unknown,
): ContractValidationOutcome<CommonCalendarDateV1CalendarDate> {
  return validateContractInstance("urn:japp:schema:common:calendar-date:v1#/$defs/calendarDate", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:confidence:v1#/$defs/confidence
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonConfidenceV1Confidence type only after validation succeeds.
 */
export function validateCommonConfidenceV1Confidence(
  data: unknown,
): ContractValidationOutcome<CommonConfidenceV1Confidence> {
  return validateContractInstance("urn:japp:schema:common:confidence:v1#/$defs/confidence", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/boundedToken
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1BoundedToken type only after validation succeeds.
 */
export function validateCommonContractTextV1BoundedToken(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1BoundedToken> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/boundedToken", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/gitObjectId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1GitObjectId type only after validation succeeds.
 */
export function validateCommonContractTextV1GitObjectId(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1GitObjectId> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/gitObjectId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/locale
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1Locale type only after validation succeeds.
 */
export function validateCommonContractTextV1Locale(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1Locale> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/locale", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/metricValue
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1MetricValue type only after validation succeeds.
 */
export function validateCommonContractTextV1MetricValue(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1MetricValue> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/metricValue", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/nonNegativeSafeInteger
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1NonNegativeSafeInteger type only after validation succeeds.
 */
export function validateCommonContractTextV1NonNegativeSafeInteger(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1NonNegativeSafeInteger> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/nonNegativeSafeInteger", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/normalizedText
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1NormalizedText type only after validation succeeds.
 */
export function validateCommonContractTextV1NormalizedText(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1NormalizedText> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/normalizedText", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/positiveSafeInteger
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1PositiveSafeInteger type only after validation succeeds.
 */
export function validateCommonContractTextV1PositiveSafeInteger(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1PositiveSafeInteger> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/positiveSafeInteger", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/schemaReference
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1SchemaReference type only after validation succeeds.
 */
export function validateCommonContractTextV1SchemaReference(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1SchemaReference> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/schemaReference", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:contract-text:v1#/$defs/versionText
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonContractTextV1VersionText type only after validation succeeds.
 */
export function validateCommonContractTextV1VersionText(
  data: unknown,
): ContractValidationOutcome<CommonContractTextV1VersionText> {
  return validateContractInstance("urn:japp:schema:common:contract-text:v1#/$defs/versionText", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:correlation:v1#/$defs/causationId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonCorrelationV1CausationId type only after validation succeeds.
 */
export function validateCommonCorrelationV1CausationId(
  data: unknown,
): ContractValidationOutcome<CommonCorrelationV1CausationId> {
  return validateContractInstance("urn:japp:schema:common:correlation:v1#/$defs/causationId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:correlation:v1#/$defs/correlationId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonCorrelationV1CorrelationId type only after validation succeeds.
 */
export function validateCommonCorrelationV1CorrelationId(
  data: unknown,
): ContractValidationOutcome<CommonCorrelationV1CorrelationId> {
  return validateContractInstance("urn:japp:schema:common:correlation:v1#/$defs/correlationId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:enum-token:v1#/$defs/enumToken
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnumTokenV1EnumToken type only after validation succeeds.
 */
export function validateCommonEnumTokenV1EnumToken(
  data: unknown,
): ContractValidationOutcome<CommonEnumTokenV1EnumToken> {
  return validateContractInstance("urn:japp:schema:common:enum-token:v1#/$defs/enumToken", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1EnvelopeMetadata type only after validation succeeds.
 */
export function validateCommonEnvelopeV1EnvelopeMetadata(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1EnvelopeMetadata> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/envelopeMetadata", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1EnvelopedRecord type only after validation succeeds.
 */
export function validateCommonEnvelopeV1EnvelopedRecord(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1EnvelopedRecord> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/extensionKey
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1ExtensionKey type only after validation succeeds.
 */
export function validateCommonEnvelopeV1ExtensionKey(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1ExtensionKey> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/extensionKey", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:envelope:v1#/$defs/extensions
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonEnvelopeV1Extensions type only after validation succeeds.
 */
export function validateCommonEnvelopeV1Extensions(
  data: unknown,
): ContractValidationOutcome<CommonEnvelopeV1Extensions> {
  return validateContractInstance("urn:japp:schema:common:envelope:v1#/$defs/extensions", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:location:v1#/$defs/countryCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonLocationV1CountryCode type only after validation succeeds.
 */
export function validateCommonLocationV1CountryCode(
  data: unknown,
): ContractValidationOutcome<CommonLocationV1CountryCode> {
  return validateContractInstance("urn:japp:schema:common:location:v1#/$defs/countryCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:location:v1#/$defs/structuredLocation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonLocationV1StructuredLocation type only after validation succeeds.
 */
export function validateCommonLocationV1StructuredLocation(
  data: unknown,
): ContractValidationOutcome<CommonLocationV1StructuredLocation> {
  return validateContractInstance("urn:japp:schema:common:location:v1#/$defs/structuredLocation", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:money:v1#/$defs/currencyCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonMoneyV1CurrencyCode type only after validation succeeds.
 */
export function validateCommonMoneyV1CurrencyCode(
  data: unknown,
): ContractValidationOutcome<CommonMoneyV1CurrencyCode> {
  return validateContractInstance("urn:japp:schema:common:money:v1#/$defs/currencyCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:money:v1#/$defs/decimalAmount
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonMoneyV1DecimalAmount type only after validation succeeds.
 */
export function validateCommonMoneyV1DecimalAmount(
  data: unknown,
): ContractValidationOutcome<CommonMoneyV1DecimalAmount> {
  return validateContractInstance("urn:japp:schema:common:money:v1#/$defs/decimalAmount", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:money:v1#/$defs/money
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonMoneyV1Money type only after validation succeeds.
 */
export function validateCommonMoneyV1Money(
  data: unknown,
): ContractValidationOutcome<CommonMoneyV1Money> {
  return validateContractInstance("urn:japp:schema:common:money:v1#/$defs/money", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:provenance:v1#/$defs/contentDigest
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonProvenanceV1ContentDigest type only after validation succeeds.
 */
export function validateCommonProvenanceV1ContentDigest(
  data: unknown,
): ContractValidationOutcome<CommonProvenanceV1ContentDigest> {
  return validateContractInstance("urn:japp:schema:common:provenance:v1#/$defs/contentDigest", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:provenance:v1#/$defs/provenance
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonProvenanceV1Provenance type only after validation succeeds.
 */
export function validateCommonProvenanceV1Provenance(
  data: unknown,
): ContractValidationOutcome<CommonProvenanceV1Provenance> {
  return validateContractInstance("urn:japp:schema:common:provenance:v1#/$defs/provenance", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:provenance:v1#/$defs/sourceKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonProvenanceV1SourceKind type only after validation succeeds.
 */
export function validateCommonProvenanceV1SourceKind(
  data: unknown,
): ContractValidationOutcome<CommonProvenanceV1SourceKind> {
  return validateContractInstance("urn:japp:schema:common:provenance:v1#/$defs/sourceKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonRedactionV1RedactionAnnotation type only after validation succeeds.
 */
export function validateCommonRedactionV1RedactionAnnotation(
  data: unknown,
): ContractValidationOutcome<CommonRedactionV1RedactionAnnotation> {
  return validateContractInstance("urn:japp:schema:common:redaction:v1#/$defs/redactionAnnotation", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonRedactionV1RedactionPolicy type only after validation succeeds.
 */
export function validateCommonRedactionV1RedactionPolicy(
  data: unknown,
): ContractValidationOutcome<CommonRedactionV1RedactionPolicy> {
  return validateContractInstance("urn:japp:schema:common:redaction:v1#/$defs/redactionPolicy", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonRedactionV1SensitivityClass type only after validation succeeds.
 */
export function validateCommonRedactionV1SensitivityClass(
  data: unknown,
): ContractValidationOutcome<CommonRedactionV1SensitivityClass> {
  return validateContractInstance("urn:japp:schema:common:redaction:v1#/$defs/sensitivityClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:schema-version:v1#/$defs/schemaId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonSchemaVersionV1SchemaId type only after validation succeeds.
 */
export function validateCommonSchemaVersionV1SchemaId(
  data: unknown,
): ContractValidationOutcome<CommonSchemaVersionV1SchemaId> {
  return validateContractInstance("urn:japp:schema:common:schema-version:v1#/$defs/schemaId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonSchemaVersionV1SchemaVersion type only after validation succeeds.
 */
export function validateCommonSchemaVersionV1SchemaVersion(
  data: unknown,
): ContractValidationOutcome<CommonSchemaVersionV1SchemaVersion> {
  return validateContractInstance("urn:japp:schema:common:schema-version:v1#/$defs/schemaVersion", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:stable-id:v1#/$defs/idPrefix
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonStableIdV1IdPrefix type only after validation succeeds.
 */
export function validateCommonStableIdV1IdPrefix(
  data: unknown,
): ContractValidationOutcome<CommonStableIdV1IdPrefix> {
  return validateContractInstance("urn:japp:schema:common:stable-id:v1#/$defs/idPrefix", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:stable-id:v1#/$defs/stableId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonStableIdV1StableId type only after validation succeeds.
 */
export function validateCommonStableIdV1StableId(
  data: unknown,
): ContractValidationOutcome<CommonStableIdV1StableId> {
  return validateContractInstance("urn:japp:schema:common:stable-id:v1#/$defs/stableId", data);
}

/**
 * Validate unknown input against urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp
 * through the strict canonical Ajv catalog, narrowing to the
 * generated CommonTimestampUtcV1UtcTimestamp type only after validation succeeds.
 */
export function validateCommonTimestampUtcV1UtcTimestamp(
  data: unknown,
): ContractValidationOutcome<CommonTimestampUtcV1UtcTimestamp> {
  return validateContractInstance("urn:japp:schema:common:timestamp-utc:v1#/$defs/utcTimestamp", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:catalog:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorCatalogV1 type only after validation succeeds.
 */
export function validateErrorCatalogV1(
  data: unknown,
): ContractValidationOutcome<ErrorCatalogV1> {
  return validateContractInstance("urn:japp:schema:error:catalog:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:catalog:v1#/$defs/catalogEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorCatalogV1CatalogEntry type only after validation succeeds.
 */
export function validateErrorCatalogV1CatalogEntry(
  data: unknown,
): ContractValidationOutcome<ErrorCatalogV1CatalogEntry> {
  return validateContractInstance("urn:japp:schema:error:catalog:v1#/$defs/catalogEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorRecordV1 type only after validation succeeds.
 */
export function validateErrorRecordV1(
  data: unknown,
): ContractValidationOutcome<ErrorRecordV1> {
  return validateContractInstance("urn:japp:schema:error:record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorCode type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorCode(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorCode> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorFamily type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorFamily(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorFamily> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorOrigin type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorOrigin(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorOrigin> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorOrigin", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1ErrorSeverity type only after validation succeeds.
 */
export function validateErrorTaxonomyV1ErrorSeverity(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1ErrorSeverity> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/errorSeverity", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/messageKey
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1MessageKey type only after validation succeeds.
 */
export function validateErrorTaxonomyV1MessageKey(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1MessageKey> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/messageKey", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1RetryDisposition type only after validation succeeds.
 */
export function validateErrorTaxonomyV1RetryDisposition(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1RetryDisposition> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/retryDisposition", data);
}

/**
 * Validate unknown input against urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ErrorTaxonomyV1UserSafeMessage type only after validation succeeds.
 */
export function validateErrorTaxonomyV1UserSafeMessage(
  data: unknown,
): ContractValidationOutcome<ErrorTaxonomyV1UserSafeMessage> {
  return validateContractInstance("urn:japp:schema:error:taxonomy:v1#/$defs/userSafeMessage", data);
}

/**
 * Validate unknown input against urn:japp:schema:fixture:test-record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FixtureTestRecordV1 type only after validation succeeds.
 */
export function validateFixtureTestRecordV1(
  data: unknown,
): ContractValidationOutcome<FixtureTestRecordV1> {
  return validateContractInstance("urn:japp:schema:fixture:test-record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1 type only after validation succeeds.
 */
export function validateFormDriverResultV1(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/actionAttempt
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1ActionAttempt type only after validation succeeds.
 */
export function validateFormDriverResultV1ActionAttempt(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1ActionAttempt> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/actionAttempt", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/driverOutcome
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1DriverOutcome type only after validation succeeds.
 */
export function validateFormDriverResultV1DriverOutcome(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1DriverOutcome> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/driverOutcome", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/preconditionsResult
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1PreconditionsResult type only after validation succeeds.
 */
export function validateFormDriverResultV1PreconditionsResult(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1PreconditionsResult> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/preconditionsResult", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/reasonCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1ReasonCode type only after validation succeeds.
 */
export function validateFormDriverResultV1ReasonCode(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1ReasonCode> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/reasonCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/recoveryResult
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1RecoveryResult type only after validation succeeds.
 */
export function validateFormDriverResultV1RecoveryResult(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1RecoveryResult> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/recoveryResult", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/resolutionResult
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1ResolutionResult type only after validation succeeds.
 */
export function validateFormDriverResultV1ResolutionResult(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1ResolutionResult> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/resolutionResult", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/siteAcceptance
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1SiteAcceptance type only after validation succeeds.
 */
export function validateFormDriverResultV1SiteAcceptance(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1SiteAcceptance> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/siteAcceptance", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:driver-result:v1#/$defs/valueEvidence
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormDriverResultV1ValueEvidence type only after validation succeeds.
 */
export function validateFormDriverResultV1ValueEvidence(
  data: unknown,
): ContractValidationOutcome<FormDriverResultV1ValueEvidence> {
  return validateContractInstance("urn:japp:schema:form:driver-result:v1#/$defs/valueEvidence", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-address:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldAddressV1 type only after validation succeeds.
 */
export function validateFormFieldAddressV1(
  data: unknown,
): ContractValidationOutcome<FormFieldAddressV1> {
  return validateContractInstance("urn:japp:schema:form:field-address:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-address:v1#/$defs/atsFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldAddressV1AtsFamily type only after validation succeeds.
 */
export function validateFormFieldAddressV1AtsFamily(
  data: unknown,
): ContractValidationOutcome<FormFieldAddressV1AtsFamily> {
  return validateContractInstance("urn:japp:schema:form:field-address:v1#/$defs/atsFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-address:v1#/$defs/repeaterPathEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldAddressV1RepeaterPathEntry type only after validation succeeds.
 */
export function validateFormFieldAddressV1RepeaterPathEntry(
  data: unknown,
): ContractValidationOutcome<FormFieldAddressV1RepeaterPathEntry> {
  return validateContractInstance("urn:japp:schema:form:field-address:v1#/$defs/repeaterPathEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-address:v1#/$defs/resolutionHint
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldAddressV1ResolutionHint type only after validation succeeds.
 */
export function validateFormFieldAddressV1ResolutionHint(
  data: unknown,
): ContractValidationOutcome<FormFieldAddressV1ResolutionHint> {
  return validateContractInstance("urn:japp:schema:form:field-address:v1#/$defs/resolutionHint", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-address:v1#/$defs/resolutionHintKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldAddressV1ResolutionHintKind type only after validation succeeds.
 */
export function validateFormFieldAddressV1ResolutionHintKind(
  data: unknown,
): ContractValidationOutcome<FormFieldAddressV1ResolutionHintKind> {
  return validateContractInstance("urn:japp:schema:form:field-address:v1#/$defs/resolutionHintKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-address:v1#/$defs/stabilityClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldAddressV1StabilityClass type only after validation succeeds.
 */
export function validateFormFieldAddressV1StabilityClass(
  data: unknown,
): ContractValidationOutcome<FormFieldAddressV1StabilityClass> {
  return validateContractInstance("urn:japp:schema:form:field-address:v1#/$defs/stabilityClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-decision:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDecisionV1 type only after validation succeeds.
 */
export function validateFormFieldDecisionV1(
  data: unknown,
): ContractValidationOutcome<FormFieldDecisionV1> {
  return validateContractInstance("urn:japp:schema:form:field-decision:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-decision:v1#/$defs/confirmationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDecisionV1ConfirmationState type only after validation succeeds.
 */
export function validateFormFieldDecisionV1ConfirmationState(
  data: unknown,
): ContractValidationOutcome<FormFieldDecisionV1ConfirmationState> {
  return validateContractInstance("urn:japp:schema:form:field-decision:v1#/$defs/confirmationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-decision:v1#/$defs/finalDecision
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDecisionV1FinalDecision type only after validation succeeds.
 */
export function validateFormFieldDecisionV1FinalDecision(
  data: unknown,
): ContractValidationOutcome<FormFieldDecisionV1FinalDecision> {
  return validateContractInstance("urn:japp:schema:form:field-decision:v1#/$defs/finalDecision", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-decision:v1#/$defs/policyDecision
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDecisionV1PolicyDecision type only after validation succeeds.
 */
export function validateFormFieldDecisionV1PolicyDecision(
  data: unknown,
): ContractValidationOutcome<FormFieldDecisionV1PolicyDecision> {
  return validateContractInstance("urn:japp:schema:form:field-decision:v1#/$defs/policyDecision", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-decision:v1#/$defs/reasonCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDecisionV1ReasonCode type only after validation succeeds.
 */
export function validateFormFieldDecisionV1ReasonCode(
  data: unknown,
): ContractValidationOutcome<FormFieldDecisionV1ReasonCode> {
  return validateContractInstance("urn:japp:schema:form:field-decision:v1#/$defs/reasonCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-decision:v1#/$defs/valueSourceType
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDecisionV1ValueSourceType type only after validation succeeds.
 */
export function validateFormFieldDecisionV1ValueSourceType(
  data: unknown,
): ContractValidationOutcome<FormFieldDecisionV1ValueSourceType> {
  return validateContractInstance("urn:japp:schema:form:field-decision:v1#/$defs/valueSourceType", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-descriptor:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDescriptorV1 type only after validation succeeds.
 */
export function validateFormFieldDescriptorV1(
  data: unknown,
): ContractValidationOutcome<FormFieldDescriptorV1> {
  return validateContractInstance("urn:japp:schema:form:field-descriptor:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-descriptor:v1#/$defs/controlKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDescriptorV1ControlKind type only after validation succeeds.
 */
export function validateFormFieldDescriptorV1ControlKind(
  data: unknown,
): ContractValidationOutcome<FormFieldDescriptorV1ControlKind> {
  return validateContractInstance("urn:japp:schema:form:field-descriptor:v1#/$defs/controlKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-descriptor:v1#/$defs/observedValue
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDescriptorV1ObservedValue type only after validation succeeds.
 */
export function validateFormFieldDescriptorV1ObservedValue(
  data: unknown,
): ContractValidationOutcome<FormFieldDescriptorV1ObservedValue> {
  return validateContractInstance("urn:japp:schema:form:field-descriptor:v1#/$defs/observedValue", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-descriptor:v1#/$defs/optionSemantic
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDescriptorV1OptionSemantic type only after validation succeeds.
 */
export function validateFormFieldDescriptorV1OptionSemantic(
  data: unknown,
): ContractValidationOutcome<FormFieldDescriptorV1OptionSemantic> {
  return validateContractInstance("urn:japp:schema:form:field-descriptor:v1#/$defs/optionSemantic", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-descriptor:v1#/$defs/untrustedTextRepresentation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDescriptorV1UntrustedTextRepresentation type only after validation succeeds.
 */
export function validateFormFieldDescriptorV1UntrustedTextRepresentation(
  data: unknown,
): ContractValidationOutcome<FormFieldDescriptorV1UntrustedTextRepresentation> {
  return validateContractInstance("urn:japp:schema:form:field-descriptor:v1#/$defs/untrustedTextRepresentation", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:field-descriptor:v1#/$defs/validationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormFieldDescriptorV1ValidationState type only after validation succeeds.
 */
export function validateFormFieldDescriptorV1ValidationState(
  data: unknown,
): ContractValidationOutcome<FormFieldDescriptorV1ValidationState> {
  return validateContractInstance("urn:japp:schema:form:field-descriptor:v1#/$defs/validationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:reconciliation-inventory:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormReconciliationInventoryV1 type only after validation succeeds.
 */
export function validateFormReconciliationInventoryV1(
  data: unknown,
): ContractValidationOutcome<FormReconciliationInventoryV1> {
  return validateContractInstance("urn:japp:schema:form:reconciliation-inventory:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:reconciliation-inventory:v1#/$defs/confirmationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormReconciliationInventoryV1ConfirmationState type only after validation succeeds.
 */
export function validateFormReconciliationInventoryV1ConfirmationState(
  data: unknown,
): ContractValidationOutcome<FormReconciliationInventoryV1ConfirmationState> {
  return validateContractInstance("urn:japp:schema:form:reconciliation-inventory:v1#/$defs/confirmationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryCounts
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormReconciliationInventoryV1InventoryCounts type only after validation succeeds.
 */
export function validateFormReconciliationInventoryV1InventoryCounts(
  data: unknown,
): ContractValidationOutcome<FormReconciliationInventoryV1InventoryCounts> {
  return validateContractInstance("urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryCounts", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryItem
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormReconciliationInventoryV1InventoryItem type only after validation succeeds.
 */
export function validateFormReconciliationInventoryV1InventoryItem(
  data: unknown,
): ContractValidationOutcome<FormReconciliationInventoryV1InventoryItem> {
  return validateContractInstance("urn:japp:schema:form:reconciliation-inventory:v1#/$defs/inventoryItem", data);
}

/**
 * Validate unknown input against urn:japp:schema:form:reconciliation-inventory:v1#/$defs/reconciliationCategory
 * through the strict canonical Ajv catalog, narrowing to the
 * generated FormReconciliationInventoryV1ReconciliationCategory type only after validation succeeds.
 */
export function validateFormReconciliationInventoryV1ReconciliationCategory(
  data: unknown,
): ContractValidationOutcome<FormReconciliationInventoryV1ReconciliationCategory> {
  return validateContractInstance("urn:japp:schema:form:reconciliation-inventory:v1#/$defs/reconciliationCategory", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:decision:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateDecisionV1 type only after validation succeeds.
 */
export function validateGateDecisionV1(
  data: unknown,
): ContractValidationOutcome<GateDecisionV1> {
  return validateContractInstance("urn:japp:schema:gate:decision:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:decision:v1#/$defs/gateDecision
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateDecisionV1GateDecision type only after validation succeeds.
 */
export function validateGateDecisionV1GateDecision(
  data: unknown,
): ContractValidationOutcome<GateDecisionV1GateDecision> {
  return validateContractInstance("urn:japp:schema:gate:decision:v1#/$defs/gateDecision", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:decision:v1#/$defs/independentReviewState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateDecisionV1IndependentReviewState type only after validation succeeds.
 */
export function validateGateDecisionV1IndependentReviewState(
  data: unknown,
): ContractValidationOutcome<GateDecisionV1IndependentReviewState> {
  return validateContractInstance("urn:japp:schema:gate:decision:v1#/$defs/independentReviewState", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:decision:v1#/$defs/ownerDecisionState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateDecisionV1OwnerDecisionState type only after validation succeeds.
 */
export function validateGateDecisionV1OwnerDecisionState(
  data: unknown,
): ContractValidationOutcome<GateDecisionV1OwnerDecisionState> {
  return validateContractInstance("urn:japp:schema:gate:decision:v1#/$defs/ownerDecisionState", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:decision:v1#/$defs/reasonCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateDecisionV1ReasonCode type only after validation succeeds.
 */
export function validateGateDecisionV1ReasonCode(
  data: unknown,
): ContractValidationOutcome<GateDecisionV1ReasonCode> {
  return validateContractInstance("urn:japp:schema:gate:decision:v1#/$defs/reasonCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:decision:v1#/$defs/thresholdEvidenceSummary
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateDecisionV1ThresholdEvidenceSummary type only after validation succeeds.
 */
export function validateGateDecisionV1ThresholdEvidenceSummary(
  data: unknown,
): ContractValidationOutcome<GateDecisionV1ThresholdEvidenceSummary> {
  return validateContractInstance("urn:japp:schema:gate:decision:v1#/$defs/thresholdEvidenceSummary", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:evidence-bundle:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateEvidenceBundleV1 type only after validation succeeds.
 */
export function validateGateEvidenceBundleV1(
  data: unknown,
): ContractValidationOutcome<GateEvidenceBundleV1> {
  return validateContractInstance("urn:japp:schema:gate:evidence-bundle:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:evidence-bundle:v1#/$defs/completenessInventory
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateEvidenceBundleV1CompletenessInventory type only after validation succeeds.
 */
export function validateGateEvidenceBundleV1CompletenessInventory(
  data: unknown,
): ContractValidationOutcome<GateEvidenceBundleV1CompletenessInventory> {
  return validateContractInstance("urn:japp:schema:gate:evidence-bundle:v1#/$defs/completenessInventory", data);
}

/**
 * Validate unknown input against urn:japp:schema:gate:evidence-bundle:v1#/$defs/gateId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated GateEvidenceBundleV1GateId type only after validation succeeds.
 */
export function validateGateEvidenceBundleV1GateId(
  data: unknown,
): ContractValidationOutcome<GateEvidenceBundleV1GateId> {
  return validateContractInstance("urn:japp:schema:gate:evidence-bundle:v1#/$defs/gateId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:browser-discovery-request:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformBrowserDiscoveryRequestV1 type only after validation succeeds.
 */
export function validatePlatformBrowserDiscoveryRequestV1(
  data: unknown,
): ContractValidationOutcome<PlatformBrowserDiscoveryRequestV1> {
  return validateContractInstance("urn:japp:schema:platform:browser-discovery-request:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:browser-record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformBrowserRecordV1 type only after validation succeeds.
 */
export function validatePlatformBrowserRecordV1(
  data: unknown,
): ContractValidationOutcome<PlatformBrowserRecordV1> {
  return validateContractInstance("urn:japp:schema:platform:browser-record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:browser-record:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformBrowserRecordV2 type only after validation succeeds.
 */
export function validatePlatformBrowserRecordV2(
  data: unknown,
): ContractValidationOutcome<PlatformBrowserRecordV2> {
  return validateContractInstance("urn:japp:schema:platform:browser-record:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:capability-report:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformCapabilityReportV1 type only after validation succeeds.
 */
export function validatePlatformCapabilityReportV1(
  data: unknown,
): ContractValidationOutcome<PlatformCapabilityReportV1> {
  return validateContractInstance("urn:japp:schema:platform:capability-report:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:capability-report:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformCapabilityReportV2 type only after validation succeeds.
 */
export function validatePlatformCapabilityReportV2(
  data: unknown,
): ContractValidationOutcome<PlatformCapabilityReportV2> {
  return validateContractInstance("urn:japp:schema:platform:capability-report:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:certification-input:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformCertificationInputV1 type only after validation succeeds.
 */
export function validatePlatformCertificationInputV1(
  data: unknown,
): ContractValidationOutcome<PlatformCertificationInputV1> {
  return validateContractInstance("urn:japp:schema:platform:certification-input:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:certification-input:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformCertificationInputV2 type only after validation succeeds.
 */
export function validatePlatformCertificationInputV2(
  data: unknown,
): ContractValidationOutcome<PlatformCertificationInputV2> {
  return validateContractInstance("urn:japp:schema:platform:certification-input:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:certification-input:v2#/$defs/evidenceInventoryItem
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformCertificationInputV2EvidenceInventoryItem type only after validation succeeds.
 */
export function validatePlatformCertificationInputV2EvidenceInventoryItem(
  data: unknown,
): ContractValidationOutcome<PlatformCertificationInputV2EvidenceInventoryItem> {
  return validateContractInstance("urn:japp:schema:platform:certification-input:v2#/$defs/evidenceInventoryItem", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:diagnostic-report:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformDiagnosticReportV1 type only after validation succeeds.
 */
export function validatePlatformDiagnosticReportV1(
  data: unknown,
): ContractValidationOutcome<PlatformDiagnosticReportV1> {
  return validateContractInstance("urn:japp:schema:platform:diagnostic-report:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:diagnostic-report:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformDiagnosticReportV2 type only after validation succeeds.
 */
export function validatePlatformDiagnosticReportV2(
  data: unknown,
): ContractValidationOutcome<PlatformDiagnosticReportV2> {
  return validateContractInstance("urn:japp:schema:platform:diagnostic-report:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:evidence-record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformEvidenceRecordV1 type only after validation succeeds.
 */
export function validatePlatformEvidenceRecordV1(
  data: unknown,
): ContractValidationOutcome<PlatformEvidenceRecordV1> {
  return validateContractInstance("urn:japp:schema:platform:evidence-record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:evidence-record:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformEvidenceRecordV2 type only after validation succeeds.
 */
export function validatePlatformEvidenceRecordV2(
  data: unknown,
): ContractValidationOutcome<PlatformEvidenceRecordV2> {
  return validateContractInstance("urn:japp:schema:platform:evidence-record:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:installer-state:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformInstallerStateV1 type only after validation succeeds.
 */
export function validatePlatformInstallerStateV1(
  data: unknown,
): ContractValidationOutcome<PlatformInstallerStateV1> {
  return validateContractInstance("urn:japp:schema:platform:installer-state:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:installer-state:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformInstallerStateV2 type only after validation succeeds.
 */
export function validatePlatformInstallerStateV2(
  data: unknown,
): ContractValidationOutcome<PlatformInstallerStateV2> {
  return validateContractInstance("urn:japp:schema:platform:installer-state:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:model-runtime-profile:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformModelRuntimeProfileV1 type only after validation succeeds.
 */
export function validatePlatformModelRuntimeProfileV1(
  data: unknown,
): ContractValidationOutcome<PlatformModelRuntimeProfileV1> {
  return validateContractInstance("urn:japp:schema:platform:model-runtime-profile:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:model-runtime-profile:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformModelRuntimeProfileV2 type only after validation succeeds.
 */
export function validatePlatformModelRuntimeProfileV2(
  data: unknown,
): ContractValidationOutcome<PlatformModelRuntimeProfileV2> {
  return validateContractInstance("urn:japp:schema:platform:model-runtime-profile:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:native-messaging-registration:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformNativeMessagingRegistrationV1 type only after validation succeeds.
 */
export function validatePlatformNativeMessagingRegistrationV1(
  data: unknown,
): ContractValidationOutcome<PlatformNativeMessagingRegistrationV1> {
  return validateContractInstance("urn:japp:schema:platform:native-messaging-registration:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:native-messaging-registration:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformNativeMessagingRegistrationV2 type only after validation succeeds.
 */
export function validatePlatformNativeMessagingRegistrationV2(
  data: unknown,
): ContractValidationOutcome<PlatformNativeMessagingRegistrationV2> {
  return validateContractInstance("urn:japp:schema:platform:native-messaging-registration:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:native-messaging-result:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformNativeMessagingResultV1 type only after validation succeeds.
 */
export function validatePlatformNativeMessagingResultV1(
  data: unknown,
): ContractValidationOutcome<PlatformNativeMessagingResultV1> {
  return validateContractInstance("urn:japp:schema:platform:native-messaging-result:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:native-messaging-result:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformNativeMessagingResultV2 type only after validation succeeds.
 */
export function validatePlatformNativeMessagingResultV2(
  data: unknown,
): ContractValidationOutcome<PlatformNativeMessagingResultV2> {
  return validateContractInstance("urn:japp:schema:platform:native-messaging-result:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:path-request:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformPathRequestV1 type only after validation succeeds.
 */
export function validatePlatformPathRequestV1(
  data: unknown,
): ContractValidationOutcome<PlatformPathRequestV1> {
  return validateContractInstance("urn:japp:schema:platform:path-request:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:path-resolution:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformPathResolutionV1 type only after validation succeeds.
 */
export function validatePlatformPathResolutionV1(
  data: unknown,
): ContractValidationOutcome<PlatformPathResolutionV1> {
  return validateContractInstance("urn:japp:schema:platform:path-resolution:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:path-resolution:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformPathResolutionV2 type only after validation succeeds.
 */
export function validatePlatformPathResolutionV2(
  data: unknown,
): ContractValidationOutcome<PlatformPathResolutionV2> {
  return validateContractInstance("urn:japp:schema:platform:path-resolution:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:process-plan:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformProcessPlanV1 type only after validation succeeds.
 */
export function validatePlatformProcessPlanV1(
  data: unknown,
): ContractValidationOutcome<PlatformProcessPlanV1> {
  return validateContractInstance("urn:japp:schema:platform:process-plan:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:process-plan:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformProcessPlanV2 type only after validation succeeds.
 */
export function validatePlatformProcessPlanV2(
  data: unknown,
): ContractValidationOutcome<PlatformProcessPlanV2> {
  return validateContractInstance("urn:japp:schema:platform:process-plan:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:process-status:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformProcessStatusV1 type only after validation succeeds.
 */
export function validatePlatformProcessStatusV1(
  data: unknown,
): ContractValidationOutcome<PlatformProcessStatusV1> {
  return validateContractInstance("urn:japp:schema:platform:process-status:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:process-status:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformProcessStatusV2 type only after validation succeeds.
 */
export function validatePlatformProcessStatusV2(
  data: unknown,
): ContractValidationOutcome<PlatformProcessStatusV2> {
  return validateContractInstance("urn:japp:schema:platform:process-status:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:runtime-capability:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformRuntimeCapabilityV1 type only after validation succeeds.
 */
export function validatePlatformRuntimeCapabilityV1(
  data: unknown,
): ContractValidationOutcome<PlatformRuntimeCapabilityV1> {
  return validateContractInstance("urn:japp:schema:platform:runtime-capability:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:runtime-capability:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformRuntimeCapabilityV2 type only after validation succeeds.
 */
export function validatePlatformRuntimeCapabilityV2(
  data: unknown,
): ContractValidationOutcome<PlatformRuntimeCapabilityV2> {
  return validateContractInstance("urn:japp:schema:platform:runtime-capability:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:secret-store-request:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformSecretStoreRequestV1 type only after validation succeeds.
 */
export function validatePlatformSecretStoreRequestV1(
  data: unknown,
): ContractValidationOutcome<PlatformSecretStoreRequestV1> {
  return validateContractInstance("urn:japp:schema:platform:secret-store-request:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:secret-store-result:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformSecretStoreResultV1 type only after validation succeeds.
 */
export function validatePlatformSecretStoreResultV1(
  data: unknown,
): ContractValidationOutcome<PlatformSecretStoreResultV1> {
  return validateContractInstance("urn:japp:schema:platform:secret-store-result:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:secret-store-result:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformSecretStoreResultV2 type only after validation succeeds.
 */
export function validatePlatformSecretStoreResultV2(
  data: unknown,
): ContractValidationOutcome<PlatformSecretStoreResultV2> {
  return validateContractInstance("urn:japp:schema:platform:secret-store-result:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:target-identity:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformTargetIdentityV1 type only after validation succeeds.
 */
export function validatePlatformTargetIdentityV1(
  data: unknown,
): ContractValidationOutcome<PlatformTargetIdentityV1> {
  return validateContractInstance("urn:japp:schema:platform:target-identity:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:update-state:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformUpdateStateV1 type only after validation succeeds.
 */
export function validatePlatformUpdateStateV1(
  data: unknown,
): ContractValidationOutcome<PlatformUpdateStateV1> {
  return validateContractInstance("urn:japp:schema:platform:update-state:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:update-state:v2
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformUpdateStateV2 type only after validation succeeds.
 */
export function validatePlatformUpdateStateV2(
  data: unknown,
): ContractValidationOutcome<PlatformUpdateStateV2> {
  return validateContractInstance("urn:japp:schema:platform:update-state:v2", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/acceleratorClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1AcceleratorClass type only after validation succeeds.
 */
export function validatePlatformVocabularyV1AcceleratorClass(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1AcceleratorClass> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/acceleratorClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/architecture
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1Architecture type only after validation succeeds.
 */
export function validatePlatformVocabularyV1Architecture(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1Architecture> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/architecture", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/artifactIdentity
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ArtifactIdentity type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ArtifactIdentity(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ArtifactIdentity> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/artifactIdentity", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/boundedUserMessage
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1BoundedUserMessage type only after validation succeeds.
 */
export function validatePlatformVocabularyV1BoundedUserMessage(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1BoundedUserMessage> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/boundedUserMessage", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/browserChannel
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1BrowserChannel type only after validation succeeds.
 */
export function validatePlatformVocabularyV1BrowserChannel(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1BrowserChannel> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/browserChannel", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/browserFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1BrowserFamily type only after validation succeeds.
 */
export function validatePlatformVocabularyV1BrowserFamily(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1BrowserFamily> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/browserFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/buildToken
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1BuildToken type only after validation succeeds.
 */
export function validatePlatformVocabularyV1BuildToken(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1BuildToken> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/buildToken", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityAvailability
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1CapabilityAvailability type only after validation succeeds.
 */
export function validatePlatformVocabularyV1CapabilityAvailability(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1CapabilityAvailability> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityAvailability", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1CapabilityState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1CapabilityState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1CapabilityState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/capabilityState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/certifiedPlatformId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1CertifiedPlatformId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1CertifiedPlatformId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1CertifiedPlatformId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/certifiedPlatformId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/contextTokens
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ContextTokens type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ContextTokens(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ContextTokens> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/contextTokens", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/coreCapabilityBehavior
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1CoreCapabilityBehavior type only after validation succeeds.
 */
export function validatePlatformVocabularyV1CoreCapabilityBehavior(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1CoreCapabilityBehavior> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/coreCapabilityBehavior", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/diagnosticResult
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1DiagnosticResult type only after validation succeeds.
 */
export function validatePlatformVocabularyV1DiagnosticResult(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1DiagnosticResult> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/diagnosticResult", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/distributionChannel
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1DistributionChannel type only after validation succeeds.
 */
export function validatePlatformVocabularyV1DistributionChannel(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1DistributionChannel> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/distributionChannel", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/environmentEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1EnvironmentEntry type only after validation succeeds.
 */
export function validatePlatformVocabularyV1EnvironmentEntry(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1EnvironmentEntry> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/environmentEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/environmentVariableId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1EnvironmentVariableId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1EnvironmentVariableId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1EnvironmentVariableId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/environmentVariableId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/evaluationMethod
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1EvaluationMethod type only after validation succeeds.
 */
export function validatePlatformVocabularyV1EvaluationMethod(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1EvaluationMethod> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/evaluationMethod", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/evidenceArtifactKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1EvidenceArtifactKind type only after validation succeeds.
 */
export function validatePlatformVocabularyV1EvidenceArtifactKind(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1EvidenceArtifactKind> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/evidenceArtifactKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/extensionId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ExtensionId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ExtensionId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ExtensionId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/extensionId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/installationScope
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1InstallationScope type only after validation succeeds.
 */
export function validatePlatformVocabularyV1InstallationScope(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1InstallationScope> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/installationScope", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/installerState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1InstallerState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1InstallerState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1InstallerState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/installerState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/lifecycleMode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1LifecycleMode type only after validation succeeds.
 */
export function validatePlatformVocabularyV1LifecycleMode(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1LifecycleMode> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/lifecycleMode", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/machineClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1MachineClass type only after validation succeeds.
 */
export function validatePlatformVocabularyV1MachineClass(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1MachineClass> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/machineClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/memoryMebibytes
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1MemoryMebibytes type only after validation succeeds.
 */
export function validatePlatformVocabularyV1MemoryMebibytes(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1MemoryMebibytes> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/memoryMebibytes", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostCleanupState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1NativeHostCleanupState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1NativeHostCleanupState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1NativeHostCleanupState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostCleanupState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostName
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1NativeHostName type only after validation succeeds.
 */
export function validatePlatformVocabularyV1NativeHostName(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1NativeHostName> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/nativeHostName", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/ownerDecisionState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1OwnerDecisionState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1OwnerDecisionState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1OwnerDecisionState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/ownerDecisionState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/packageFormat
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PackageFormat type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PackageFormat(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PackageFormat> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/packageFormat", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/pathResolutionState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PathResolutionState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PathResolutionState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PathResolutionState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/pathResolutionState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/pathRole
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PathRole type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PathRole(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PathRole> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/pathRole", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/pathSegment
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PathSegment type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PathSegment(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PathSegment> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/pathSegment", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/platformCapabilityId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PlatformCapabilityId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PlatformCapabilityId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PlatformCapabilityId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/platformCapabilityId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/platformComponentId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PlatformComponentId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PlatformComponentId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PlatformComponentId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/platformComponentId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/platformId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PlatformId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PlatformId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PlatformId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/platformId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/platformReasonCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1PlatformReasonCode type only after validation succeeds.
 */
export function validatePlatformVocabularyV1PlatformReasonCode(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1PlatformReasonCode> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/platformReasonCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/processArgument
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ProcessArgument type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ProcessArgument(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ProcessArgument> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/processArgument", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/processExitCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ProcessExitCode type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ProcessExitCode(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ProcessExitCode> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/processExitCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/processProfileId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ProcessProfileId type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ProcessProfileId(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ProcessProfileId> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/processProfileId", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/processState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ProcessState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ProcessState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ProcessState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/processState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/productVersion
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ProductVersion type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ProductVersion(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ProductVersion> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/productVersion", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/profileAcceptanceState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ProfileAcceptanceState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ProfileAcceptanceState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ProfileAcceptanceState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/profileAcceptanceState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/redactedPathReference
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1RedactedPathReference type only after validation succeeds.
 */
export function validatePlatformVocabularyV1RedactedPathReference(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1RedactedPathReference> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/redactedPathReference", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/registrationOperation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1RegistrationOperation type only after validation succeeds.
 */
export function validatePlatformVocabularyV1RegistrationOperation(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1RegistrationOperation> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/registrationOperation", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/registrationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1RegistrationState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1RegistrationState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1RegistrationState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/registrationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/requestContext
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1RequestContext type only after validation succeeds.
 */
export function validatePlatformVocabularyV1RequestContext(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1RequestContext> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/requestContext", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/reviewState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1ReviewState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1ReviewState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1ReviewState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/reviewState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/runtimeFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1RuntimeFamily type only after validation succeeds.
 */
export function validatePlatformVocabularyV1RuntimeFamily(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1RuntimeFamily> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/runtimeFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/secretKeyRole
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SecretKeyRole type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SecretKeyRole(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SecretKeyRole> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/secretKeyRole", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/secretOperation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SecretOperation type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SecretOperation(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SecretOperation> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/secretOperation", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/secretReference
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SecretReference type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SecretReference(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SecretReference> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/secretReference", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/secretResultState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SecretResultState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SecretResultState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SecretResultState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/secretResultState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/severity
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1Severity type only after validation succeeds.
 */
export function validatePlatformVocabularyV1Severity(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1Severity> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/severity", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/signatureState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SignatureState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SignatureState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SignatureState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/signatureState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/stdioMode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1StdioMode type only after validation succeeds.
 */
export function validatePlatformVocabularyV1StdioMode(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1StdioMode> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/stdioMode", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/supportClaim
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SupportClaim type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SupportClaim(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SupportClaim> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/supportClaim", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/supportTier
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1SupportTier type only after validation succeeds.
 */
export function validatePlatformVocabularyV1SupportTier(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1SupportTier> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/supportTier", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/terminationRequest
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1TerminationRequest type only after validation succeeds.
 */
export function validatePlatformVocabularyV1TerminationRequest(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1TerminationRequest> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/terminationRequest", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/timeoutMilliseconds
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1TimeoutMilliseconds type only after validation succeeds.
 */
export function validatePlatformVocabularyV1TimeoutMilliseconds(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1TimeoutMilliseconds> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/timeoutMilliseconds", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/updateState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1UpdateState type only after validation succeeds.
 */
export function validatePlatformVocabularyV1UpdateState(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1UpdateState> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/updateState", data);
}

/**
 * Validate unknown input against urn:japp:schema:platform:vocabulary:v1#/$defs/userDataPreservation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated PlatformVocabularyV1UserDataPreservation type only after validation succeeds.
 */
export function validatePlatformVocabularyV1UserDataPreservation(
  data: unknown,
): ContractValidationOutcome<PlatformVocabularyV1UserDataPreservation> {
  return validateContractInstance("urn:japp:schema:platform:vocabulary:v1#/$defs/userDataPreservation", data);
}

/**
 * Validate unknown input against urn:japp:schema:rendering:layout-measurement:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated RenderingLayoutMeasurementV1 type only after validation succeeds.
 */
export function validateRenderingLayoutMeasurementV1(
  data: unknown,
): ContractValidationOutcome<RenderingLayoutMeasurementV1> {
  return validateContractInstance("urn:japp:schema:rendering:layout-measurement:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:rendering:layout-measurement:v1#/$defs/contentBounds
 * through the strict canonical Ajv catalog, narrowing to the
 * generated RenderingLayoutMeasurementV1ContentBounds type only after validation succeeds.
 */
export function validateRenderingLayoutMeasurementV1ContentBounds(
  data: unknown,
): ContractValidationOutcome<RenderingLayoutMeasurementV1ContentBounds> {
  return validateContractInstance("urn:japp:schema:rendering:layout-measurement:v1#/$defs/contentBounds", data);
}

/**
 * Validate unknown input against urn:japp:schema:rendering:layout-measurement:v1#/$defs/environmentMetadata
 * through the strict canonical Ajv catalog, narrowing to the
 * generated RenderingLayoutMeasurementV1EnvironmentMetadata type only after validation succeeds.
 */
export function validateRenderingLayoutMeasurementV1EnvironmentMetadata(
  data: unknown,
): ContractValidationOutcome<RenderingLayoutMeasurementV1EnvironmentMetadata> {
  return validateContractInstance("urn:japp:schema:rendering:layout-measurement:v1#/$defs/environmentMetadata", data);
}

/**
 * Validate unknown input against urn:japp:schema:rendering:layout-measurement:v1#/$defs/fontCommitment
 * through the strict canonical Ajv catalog, narrowing to the
 * generated RenderingLayoutMeasurementV1FontCommitment type only after validation succeeds.
 */
export function validateRenderingLayoutMeasurementV1FontCommitment(
  data: unknown,
): ContractValidationOutcome<RenderingLayoutMeasurementV1FontCommitment> {
  return validateContractInstance("urn:japp:schema:rendering:layout-measurement:v1#/$defs/fontCommitment", data);
}

/**
 * Validate unknown input against urn:japp:schema:rendering:layout-measurement:v1#/$defs/layoutResult
 * through the strict canonical Ajv catalog, narrowing to the
 * generated RenderingLayoutMeasurementV1LayoutResult type only after validation succeeds.
 */
export function validateRenderingLayoutMeasurementV1LayoutResult(
  data: unknown,
): ContractValidationOutcome<RenderingLayoutMeasurementV1LayoutResult> {
  return validateContractInstance("urn:japp:schema:rendering:layout-measurement:v1#/$defs/layoutResult", data);
}

/**
 * Validate unknown input against urn:japp:schema:rendering:layout-measurement:v1#/$defs/pageDimensions
 * through the strict canonical Ajv catalog, narrowing to the
 * generated RenderingLayoutMeasurementV1PageDimensions type only after validation succeeds.
 */
export function validateRenderingLayoutMeasurementV1PageDimensions(
  data: unknown,
): ContractValidationOutcome<RenderingLayoutMeasurementV1PageDimensions> {
  return validateContractInstance("urn:japp:schema:rendering:layout-measurement:v1#/$defs/pageDimensions", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:atomic-claim:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumeAtomicClaimV1 type only after validation succeeds.
 */
export function validateResumeAtomicClaimV1(
  data: unknown,
): ContractValidationOutcome<ResumeAtomicClaimV1> {
  return validateContractInstance("urn:japp:schema:resume:atomic-claim:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:atomic-claim:v1#/$defs/claimType
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumeAtomicClaimV1ClaimType type only after validation succeeds.
 */
export function validateResumeAtomicClaimV1ClaimType(
  data: unknown,
): ContractValidationOutcome<ResumeAtomicClaimV1ClaimType> {
  return validateContractInstance("urn:japp:schema:resume:atomic-claim:v1#/$defs/claimType", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:atomic-claim:v1#/$defs/userAction
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumeAtomicClaimV1UserAction type only after validation succeeds.
 */
export function validateResumeAtomicClaimV1UserAction(
  data: unknown,
): ContractValidationOutcome<ResumeAtomicClaimV1UserAction> {
  return validateContractInstance("urn:japp:schema:resume:atomic-claim:v1#/$defs/userAction", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:atomic-claim:v1#/$defs/verificationStatus
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumeAtomicClaimV1VerificationStatus type only after validation succeeds.
 */
export function validateResumeAtomicClaimV1VerificationStatus(
  data: unknown,
): ContractValidationOutcome<ResumeAtomicClaimV1VerificationStatus> {
  return validateContractInstance("urn:japp:schema:resume:atomic-claim:v1#/$defs/verificationStatus", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:plan:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumePlanV1 type only after validation succeeds.
 */
export function validateResumePlanV1(
  data: unknown,
): ContractValidationOutcome<ResumePlanV1> {
  return validateContractInstance("urn:japp:schema:resume:plan:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:plan:v1#/$defs/budget
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumePlanV1Budget type only after validation succeeds.
 */
export function validateResumePlanV1Budget(
  data: unknown,
): ContractValidationOutcome<ResumePlanV1Budget> {
  return validateContractInstance("urn:japp:schema:resume:plan:v1#/$defs/budget", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:plan:v1#/$defs/editDecision
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumePlanV1EditDecision type only after validation succeeds.
 */
export function validateResumePlanV1EditDecision(
  data: unknown,
): ContractValidationOutcome<ResumePlanV1EditDecision> {
  return validateContractInstance("urn:japp:schema:resume:plan:v1#/$defs/editDecision", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:plan:v1#/$defs/evidenceAssignment
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumePlanV1EvidenceAssignment type only after validation succeeds.
 */
export function validateResumePlanV1EvidenceAssignment(
  data: unknown,
): ContractValidationOutcome<ResumePlanV1EvidenceAssignment> {
  return validateContractInstance("urn:japp:schema:resume:plan:v1#/$defs/evidenceAssignment", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:plan:v1#/$defs/requirementEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumePlanV1RequirementEntry type only after validation succeeds.
 */
export function validateResumePlanV1RequirementEntry(
  data: unknown,
): ContractValidationOutcome<ResumePlanV1RequirementEntry> {
  return validateContractInstance("urn:japp:schema:resume:plan:v1#/$defs/requirementEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:resume:plan:v1#/$defs/terminologyDecision
 * through the strict canonical Ajv catalog, narrowing to the
 * generated ResumePlanV1TerminologyDecision type only after validation succeeds.
 */
export function validateResumePlanV1TerminologyDecision(
  data: unknown,
): ContractValidationOutcome<ResumePlanV1TerminologyDecision> {
  return validateContractInstance("urn:japp:schema:resume:plan:v1#/$defs/terminologyDecision", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:authorization-policy:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityAuthorizationPolicyV1 type only after validation succeeds.
 */
export function validateSecurityAuthorizationPolicyV1(
  data: unknown,
): ContractValidationOutcome<SecurityAuthorizationPolicyV1> {
  return validateContractInstance("urn:japp:schema:security:authorization-policy:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:authorization-policy:v1#/$defs/authorizationAllowRow
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityAuthorizationPolicyV1AuthorizationAllowRow type only after validation succeeds.
 */
export function validateSecurityAuthorizationPolicyV1AuthorizationAllowRow(
  data: unknown,
): ContractValidationOutcome<SecurityAuthorizationPolicyV1AuthorizationAllowRow> {
  return validateContractInstance("urn:japp:schema:security:authorization-policy:v1#/$defs/authorizationAllowRow", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:authorization-request:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityAuthorizationRequestV1 type only after validation succeeds.
 */
export function validateSecurityAuthorizationRequestV1(
  data: unknown,
): ContractValidationOutcome<SecurityAuthorizationRequestV1> {
  return validateContractInstance("urn:japp:schema:security:authorization-request:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1 type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1#/$defs/authorizationProfileId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1AuthorizationProfileId type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1AuthorizationProfileId(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1AuthorizationProfileId> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1#/$defs/authorizationProfileId", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1CapabilityEntry type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1CapabilityEntry(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1CapabilityEntry> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1CapabilityId type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1CapabilityId(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1CapabilityId> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1#/$defs/capabilityId", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1PrincipalEntry type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1PrincipalEntry(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1PrincipalEntry> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1PrincipalId type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1PrincipalId(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1PrincipalId> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1#/$defs/principalId", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:capability-taxonomy:v1#/$defs/profileEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCapabilityTaxonomyV1ProfileEntry type only after validation succeeds.
 */
export function validateSecurityCapabilityTaxonomyV1ProfileEntry(
  data: unknown,
): ContractValidationOutcome<SecurityCapabilityTaxonomyV1ProfileEntry> {
  return validateContractInstance("urn:japp:schema:security:capability-taxonomy:v1#/$defs/profileEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:command-taxonomy:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCommandTaxonomyV1 type only after validation succeeds.
 */
export function validateSecurityCommandTaxonomyV1(
  data: unknown,
): ContractValidationOutcome<SecurityCommandTaxonomyV1> {
  return validateContractInstance("urn:japp:schema:security:command-taxonomy:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:command-taxonomy:v1#/$defs/commandEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCommandTaxonomyV1CommandEntry type only after validation succeeds.
 */
export function validateSecurityCommandTaxonomyV1CommandEntry(
  data: unknown,
): ContractValidationOutcome<SecurityCommandTaxonomyV1CommandEntry> {
  return validateContractInstance("urn:japp:schema:security:command-taxonomy:v1#/$defs/commandEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:command-taxonomy:v1#/$defs/commandId
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCommandTaxonomyV1CommandId type only after validation succeeds.
 */
export function validateSecurityCommandTaxonomyV1CommandId(
  data: unknown,
): ContractValidationOutcome<SecurityCommandTaxonomyV1CommandId> {
  return validateContractInstance("urn:japp:schema:security:command-taxonomy:v1#/$defs/commandId", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:command-taxonomy:v1#/$defs/consequenceClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCommandTaxonomyV1ConsequenceClass type only after validation succeeds.
 */
export function validateSecurityCommandTaxonomyV1ConsequenceClass(
  data: unknown,
): ContractValidationOutcome<SecurityCommandTaxonomyV1ConsequenceClass> {
  return validateContractInstance("urn:japp:schema:security:command-taxonomy:v1#/$defs/consequenceClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:security:command-taxonomy:v1#/$defs/idempotencyExpectation
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SecurityCommandTaxonomyV1IdempotencyExpectation type only after validation succeeds.
 */
export function validateSecurityCommandTaxonomyV1IdempotencyExpectation(
  data: unknown,
): ContractValidationOutcome<SecurityCommandTaxonomyV1IdempotencyExpectation> {
  return validateContractInstance("urn:japp:schema:security:command-taxonomy:v1#/$defs/idempotencyExpectation", data);
}

/**
 * Validate unknown input against urn:japp:schema:semantic:rule-catalog:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SemanticRuleCatalogV1 type only after validation succeeds.
 */
export function validateSemanticRuleCatalogV1(
  data: unknown,
): ContractValidationOutcome<SemanticRuleCatalogV1> {
  return validateContractInstance("urn:japp:schema:semantic:rule-catalog:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleEntry
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SemanticRuleCatalogV1RuleEntry type only after validation succeeds.
 */
export function validateSemanticRuleCatalogV1RuleEntry(
  data: unknown,
): ContractValidationOutcome<SemanticRuleCatalogV1RuleEntry> {
  return validateContractInstance("urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleEntry", data);
}

/**
 * Validate unknown input against urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SemanticRuleCatalogV1RuleKind type only after validation succeeds.
 */
export function validateSemanticRuleCatalogV1RuleKind(
  data: unknown,
): ContractValidationOutcome<SemanticRuleCatalogV1RuleKind> {
  return validateContractInstance("urn:japp:schema:semantic:rule-catalog:v1#/$defs/ruleKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:application-session:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionApplicationSessionV1 type only after validation succeeds.
 */
export function validateSessionApplicationSessionV1(
  data: unknown,
): ContractValidationOutcome<SessionApplicationSessionV1> {
  return validateContractInstance("urn:japp:schema:session:application-session:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:application-session:v1#/$defs/revalidationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionApplicationSessionV1RevalidationState type only after validation succeeds.
 */
export function validateSessionApplicationSessionV1RevalidationState(
  data: unknown,
): ContractValidationOutcome<SessionApplicationSessionV1RevalidationState> {
  return validateContractInstance("urn:japp:schema:session:application-session:v1#/$defs/revalidationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:application-session:v1#/$defs/runtimeMetadata
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionApplicationSessionV1RuntimeMetadata type only after validation succeeds.
 */
export function validateSessionApplicationSessionV1RuntimeMetadata(
  data: unknown,
): ContractValidationOutcome<SessionApplicationSessionV1RuntimeMetadata> {
  return validateContractInstance("urn:japp:schema:session:application-session:v1#/$defs/runtimeMetadata", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:application-session:v1#/$defs/sessionLifecycleState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionApplicationSessionV1SessionLifecycleState type only after validation succeeds.
 */
export function validateSessionApplicationSessionV1SessionLifecycleState(
  data: unknown,
): ContractValidationOutcome<SessionApplicationSessionV1SessionLifecycleState> {
  return validateContractInstance("urn:japp:schema:session:application-session:v1#/$defs/sessionLifecycleState", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:application-session:v1#/$defs/snapshotDigests
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionApplicationSessionV1SnapshotDigests type only after validation succeeds.
 */
export function validateSessionApplicationSessionV1SnapshotDigests(
  data: unknown,
): ContractValidationOutcome<SessionApplicationSessionV1SnapshotDigests> {
  return validateContractInstance("urn:japp:schema:session:application-session:v1#/$defs/snapshotDigests", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1 type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1#/$defs/pageEligibility
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1PageEligibility type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1PageEligibility(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1PageEligibility> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1#/$defs/pageEligibility", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1#/$defs/revocationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1RevocationState type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1RevocationState(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1RevocationState> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1#/$defs/revocationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1#/$defs/runKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1RunKind type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1RunKind(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1RunKind> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1#/$defs/runKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotReadiness
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1SnapshotReadiness type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1SnapshotReadiness(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1SnapshotReadiness> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotReadiness", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1SnapshotState type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1SnapshotState(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1SnapshotState> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1#/$defs/snapshotState", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:guided-run-mode:v1#/$defs/startPolicy
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionGuidedRunModeV1StartPolicy type only after validation succeeds.
 */
export function validateSessionGuidedRunModeV1StartPolicy(
  data: unknown,
): ContractValidationOutcome<SessionGuidedRunModeV1StartPolicy> {
  return validateContractInstance("urn:japp:schema:session:guided-run-mode:v1#/$defs/startPolicy", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:navigation-record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionNavigationRecordV1 type only after validation succeeds.
 */
export function validateSessionNavigationRecordV1(
  data: unknown,
): ContractValidationOutcome<SessionNavigationRecordV1> {
  return validateContractInstance("urn:japp:schema:session:navigation-record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:navigation-record:v1#/$defs/navigationAction
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionNavigationRecordV1NavigationAction type only after validation succeeds.
 */
export function validateSessionNavigationRecordV1NavigationAction(
  data: unknown,
): ContractValidationOutcome<SessionNavigationRecordV1NavigationAction> {
  return validateContractInstance("urn:japp:schema:session:navigation-record:v1#/$defs/navigationAction", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:navigation-record:v1#/$defs/navigationOutcome
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionNavigationRecordV1NavigationOutcome type only after validation succeeds.
 */
export function validateSessionNavigationRecordV1NavigationOutcome(
  data: unknown,
): ContractValidationOutcome<SessionNavigationRecordV1NavigationOutcome> {
  return validateContractInstance("urn:japp:schema:session:navigation-record:v1#/$defs/navigationOutcome", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:navigation-record:v1#/$defs/reasonCode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionNavigationRecordV1ReasonCode type only after validation succeeds.
 */
export function validateSessionNavigationRecordV1ReasonCode(
  data: unknown,
): ContractValidationOutcome<SessionNavigationRecordV1ReasonCode> {
  return validateContractInstance("urn:japp:schema:session:navigation-record:v1#/$defs/reasonCode", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:navigation-record:v1#/$defs/transitionPostconditions
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionNavigationRecordV1TransitionPostconditions type only after validation succeeds.
 */
export function validateSessionNavigationRecordV1TransitionPostconditions(
  data: unknown,
): ContractValidationOutcome<SessionNavigationRecordV1TransitionPostconditions> {
  return validateContractInstance("urn:japp:schema:session:navigation-record:v1#/$defs/transitionPostconditions", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:page-readiness-proof:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionPageReadinessProofV1 type only after validation succeeds.
 */
export function validateSessionPageReadinessProofV1(
  data: unknown,
): ContractValidationOutcome<SessionPageReadinessProofV1> {
  return validateContractInstance("urn:japp:schema:session:page-readiness-proof:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:page-readiness-proof:v1#/$defs/blockingCounts
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionPageReadinessProofV1BlockingCounts type only after validation succeeds.
 */
export function validateSessionPageReadinessProofV1BlockingCounts(
  data: unknown,
): ContractValidationOutcome<SessionPageReadinessProofV1BlockingCounts> {
  return validateContractInstance("urn:japp:schema:session:page-readiness-proof:v1#/$defs/blockingCounts", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:page-readiness-proof:v1#/$defs/navigationControlIdentity
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionPageReadinessProofV1NavigationControlIdentity type only after validation succeeds.
 */
export function validateSessionPageReadinessProofV1NavigationControlIdentity(
  data: unknown,
): ContractValidationOutcome<SessionPageReadinessProofV1NavigationControlIdentity> {
  return validateContractInstance("urn:japp:schema:session:page-readiness-proof:v1#/$defs/navigationControlIdentity", data);
}

/**
 * Validate unknown input against urn:japp:schema:session:page-readiness-proof:v1#/$defs/siteValidationStatus
 * through the strict canonical Ajv catalog, narrowing to the
 * generated SessionPageReadinessProofV1SiteValidationStatus type only after validation succeeds.
 */
export function validateSessionPageReadinessProofV1SiteValidationStatus(
  data: unknown,
): ContractValidationOutcome<SessionPageReadinessProofV1SiteValidationStatus> {
  return validateContractInstance("urn:japp:schema:session:page-readiness-proof:v1#/$defs/siteValidationStatus", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:certification-record:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayCertificationRecordV1 type only after validation succeeds.
 */
export function validateWorkdayCertificationRecordV1(
  data: unknown,
): ContractValidationOutcome<WorkdayCertificationRecordV1> {
  return validateContractInstance("urn:japp:schema:workday:certification-record:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:certification-record:v1#/$defs/certificationMetrics
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayCertificationRecordV1CertificationMetrics type only after validation succeeds.
 */
export function validateWorkdayCertificationRecordV1CertificationMetrics(
  data: unknown,
): ContractValidationOutcome<WorkdayCertificationRecordV1CertificationMetrics> {
  return validateContractInstance("urn:japp:schema:workday:certification-record:v1#/$defs/certificationMetrics", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:certification-record:v1#/$defs/certificationState
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayCertificationRecordV1CertificationState type only after validation succeeds.
 */
export function validateWorkdayCertificationRecordV1CertificationState(
  data: unknown,
): ContractValidationOutcome<WorkdayCertificationRecordV1CertificationState> {
  return validateContractInstance("urn:japp:schema:workday:certification-record:v1#/$defs/certificationState", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:certification-record:v1#/$defs/platformProfile
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayCertificationRecordV1PlatformProfile type only after validation succeeds.
 */
export function validateWorkdayCertificationRecordV1PlatformProfile(
  data: unknown,
): ContractValidationOutcome<WorkdayCertificationRecordV1PlatformProfile> {
  return validateContractInstance("urn:japp:schema:workday:certification-record:v1#/$defs/platformProfile", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:step-identity:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayStepIdentityV1 type only after validation succeeds.
 */
export function validateWorkdayStepIdentityV1(
  data: unknown,
): ContractValidationOutcome<WorkdayStepIdentityV1> {
  return validateContractInstance("urn:japp:schema:workday:step-identity:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:step-identity:v1#/$defs/boundaryClass
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayStepIdentityV1BoundaryClass type only after validation succeeds.
 */
export function validateWorkdayStepIdentityV1BoundaryClass(
  data: unknown,
): ContractValidationOutcome<WorkdayStepIdentityV1BoundaryClass> {
  return validateContractInstance("urn:japp:schema:workday:step-identity:v1#/$defs/boundaryClass", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignal
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayStepIdentityV1RecognitionSignal type only after validation succeeds.
 */
export function validateWorkdayStepIdentityV1RecognitionSignal(
  data: unknown,
): ContractValidationOutcome<WorkdayStepIdentityV1RecognitionSignal> {
  return validateContractInstance("urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignal", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignalKind
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayStepIdentityV1RecognitionSignalKind type only after validation succeeds.
 */
export function validateWorkdayStepIdentityV1RecognitionSignalKind(
  data: unknown,
): ContractValidationOutcome<WorkdayStepIdentityV1RecognitionSignalKind> {
  return validateContractInstance("urn:japp:schema:workday:step-identity:v1#/$defs/recognitionSignalKind", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:step-identity:v1#/$defs/stepFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayStepIdentityV1StepFamily type only after validation succeeds.
 */
export function validateWorkdayStepIdentityV1StepFamily(
  data: unknown,
): ContractValidationOutcome<WorkdayStepIdentityV1StepFamily> {
  return validateContractInstance("urn:japp:schema:workday:step-identity:v1#/$defs/stepFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:tenant-fingerprint:v1
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayTenantFingerprintV1 type only after validation succeeds.
 */
export function validateWorkdayTenantFingerprintV1(
  data: unknown,
): ContractValidationOutcome<WorkdayTenantFingerprintV1> {
  return validateContractInstance("urn:japp:schema:workday:tenant-fingerprint:v1", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserCompatibility
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayTenantFingerprintV1BrowserCompatibility type only after validation succeeds.
 */
export function validateWorkdayTenantFingerprintV1BrowserCompatibility(
  data: unknown,
): ContractValidationOutcome<WorkdayTenantFingerprintV1BrowserCompatibility> {
  return validateContractInstance("urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserCompatibility", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayTenantFingerprintV1BrowserFamily type only after validation succeeds.
 */
export function validateWorkdayTenantFingerprintV1BrowserFamily(
  data: unknown,
): ContractValidationOutcome<WorkdayTenantFingerprintV1BrowserFamily> {
  return validateContractInstance("urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/browserFamily", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/candidateSessionMode
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayTenantFingerprintV1CandidateSessionMode type only after validation succeeds.
 */
export function validateWorkdayTenantFingerprintV1CandidateSessionMode(
  data: unknown,
): ContractValidationOutcome<WorkdayTenantFingerprintV1CandidateSessionMode> {
  return validateContractInstance("urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/candidateSessionMode", data);
}

/**
 * Validate unknown input against urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/hostnameFamily
 * through the strict canonical Ajv catalog, narrowing to the
 * generated WorkdayTenantFingerprintV1HostnameFamily type only after validation succeeds.
 */
export function validateWorkdayTenantFingerprintV1HostnameFamily(
  data: unknown,
): ContractValidationOutcome<WorkdayTenantFingerprintV1HostnameFamily> {
  return validateContractInstance("urn:japp:schema:workday:tenant-fingerprint:v1#/$defs/hostnameFamily", data);
}
