"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/ (complete catalog)
Schema id: generated Python export surface

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from japp_contracts._runtime import (
    ContractModel,
    JsonValue,
    reject_explicit_null,
    validate_calendar_date,
    validate_utc_timestamp,
)
from japp_contracts.ats.variant_identity_v1 import (
    AtsVariantIdentityV1,
    AtsVariantIdentityV1SessionMode,
)
from japp_contracts.benchmark.case_v1 import (
    BenchmarkCaseV1,
    BenchmarkCaseV1BenchmarkFamily,
    BenchmarkCaseV1EnvironmentRequirements,
    BenchmarkCaseV1ExpectedBehavior,
    BenchmarkCaseV1InputArtifact,
    BenchmarkCaseV1MetricUnit,
    BenchmarkCaseV1Threshold,
    BenchmarkCaseV1ThresholdComparator,
)
from japp_contracts.benchmark.holdout_manifest_v1 import (
    BenchmarkHoldoutManifestV1,
    BenchmarkHoldoutManifestV1CategoryCount,
    BenchmarkHoldoutManifestV1EncryptedBundleMetadata,
    BenchmarkHoldoutManifestV1FileCommitment,
    BenchmarkHoldoutManifestV1SchemaVersionEntry,
)
from japp_contracts.benchmark.result_v1 import (
    BenchmarkResultV1,
    BenchmarkResultV1CompletenessState,
    BenchmarkResultV1EnvironmentMatchState,
    BenchmarkResultV1HashState,
    BenchmarkResultV1HoldoutState,
    BenchmarkResultV1MetricResult,
    BenchmarkResultV1RuntimeMetadata,
)
from japp_contracts.common.calendar_date_v1 import (
    CommonCalendarDateV1CalendarDate,
)
from japp_contracts.common.confidence_v1 import (
    CommonConfidenceV1Confidence,
)
from japp_contracts.common.contract_text_v1 import (
    CommonContractTextV1BoundedToken,
    CommonContractTextV1GitObjectId,
    CommonContractTextV1Locale,
    CommonContractTextV1MetricValue,
    CommonContractTextV1NonNegativeSafeInteger,
    CommonContractTextV1NormalizedText,
    CommonContractTextV1PositiveSafeInteger,
    CommonContractTextV1SchemaReference,
    CommonContractTextV1VersionText,
)
from japp_contracts.common.correlation_v1 import (
    CommonCorrelationV1CausationId,
    CommonCorrelationV1CorrelationId,
)
from japp_contracts.common.enum_token_v1 import (
    CommonEnumTokenV1EnumToken,
)
from japp_contracts.common.envelope_v1 import (
    CommonEnvelopeV1EnvelopeMetadata,
    CommonEnvelopeV1EnvelopedRecord,
    CommonEnvelopeV1ExtensionKey,
    CommonEnvelopeV1Extensions,
)
from japp_contracts.common.location_v1 import (
    CommonLocationV1CountryCode,
    CommonLocationV1StructuredLocation,
)
from japp_contracts.common.money_v1 import (
    CommonMoneyV1CurrencyCode,
    CommonMoneyV1DecimalAmount,
    CommonMoneyV1Money,
)
from japp_contracts.common.provenance_v1 import (
    CommonProvenanceV1ContentDigest,
    CommonProvenanceV1Provenance,
    CommonProvenanceV1SourceKind,
)
from japp_contracts.common.redaction_v1 import (
    CommonRedactionV1RedactionAnnotation,
    CommonRedactionV1RedactionPolicy,
    CommonRedactionV1SensitivityClass,
)
from japp_contracts.common.schema_version_v1 import (
    CommonSchemaVersionV1SchemaId,
    CommonSchemaVersionV1SchemaVersion,
)
from japp_contracts.common.stable_id_v1 import (
    CommonStableIdV1IdPrefix,
    CommonStableIdV1StableId,
)
from japp_contracts.common.timestamp_utc_v1 import (
    CommonTimestampUtcV1UtcTimestamp,
)
from japp_contracts.error.catalog_data_v1 import (
    ERROR_CATALOG_V1,
    ERROR_CODES_V1,
    error_default_message_v1,
    is_error_code_v1,
    require_error_catalog_entry_v1,
)
from japp_contracts.error.catalog_v1 import (
    ErrorCatalogV1,
    ErrorCatalogV1CatalogEntry,
)
from japp_contracts.error.record_v1 import (
    ErrorRecordV1,
)
from japp_contracts.error.taxonomy_v1 import (
    ErrorTaxonomyV1ErrorCode,
    ErrorTaxonomyV1ErrorFamily,
    ErrorTaxonomyV1ErrorOrigin,
    ErrorTaxonomyV1ErrorSeverity,
    ErrorTaxonomyV1MessageKey,
    ErrorTaxonomyV1RetryDisposition,
    ErrorTaxonomyV1UserSafeMessage,
)
from japp_contracts.fixture.test_record_v1 import (
    FixtureTestRecordV1,
)
from japp_contracts.form.driver_result_v1 import (
    FormDriverResultV1,
    FormDriverResultV1ActionAttempt,
    FormDriverResultV1DriverOutcome,
    FormDriverResultV1PreconditionsResult,
    FormDriverResultV1ReasonCode,
    FormDriverResultV1RecoveryResult,
    FormDriverResultV1ResolutionResult,
    FormDriverResultV1SiteAcceptance,
    FormDriverResultV1ValueEvidence,
)
from japp_contracts.form.field_address_v1 import (
    FormFieldAddressV1,
    FormFieldAddressV1AtsFamily,
    FormFieldAddressV1RepeaterPathEntry,
    FormFieldAddressV1ResolutionHint,
    FormFieldAddressV1ResolutionHintKind,
    FormFieldAddressV1StabilityClass,
)
from japp_contracts.form.field_decision_v1 import (
    FormFieldDecisionV1,
    FormFieldDecisionV1ConfirmationState,
    FormFieldDecisionV1FinalDecision,
    FormFieldDecisionV1PolicyDecision,
    FormFieldDecisionV1ReasonCode,
    FormFieldDecisionV1ValueSourceType,
)
from japp_contracts.form.field_descriptor_v1 import (
    FormFieldDescriptorV1,
    FormFieldDescriptorV1ControlKind,
    FormFieldDescriptorV1ObservedValue,
    FormFieldDescriptorV1OptionSemantic,
    FormFieldDescriptorV1UntrustedTextRepresentation,
    FormFieldDescriptorV1ValidationState,
)
from japp_contracts.form.reconciliation_inventory_v1 import (
    FormReconciliationInventoryV1,
    FormReconciliationInventoryV1ConfirmationState,
    FormReconciliationInventoryV1InventoryCounts,
    FormReconciliationInventoryV1InventoryItem,
    FormReconciliationInventoryV1ReconciliationCategory,
)
from japp_contracts.gate.decision_v1 import (
    GateDecisionV1,
    GateDecisionV1GateDecision,
    GateDecisionV1IndependentReviewState,
    GateDecisionV1OwnerDecisionState,
    GateDecisionV1ReasonCode,
    GateDecisionV1ThresholdEvidenceSummary,
)
from japp_contracts.gate.evidence_bundle_v1 import (
    GateEvidenceBundleV1,
    GateEvidenceBundleV1CompletenessInventory,
    GateEvidenceBundleV1GateId,
)
from japp_contracts.platform.browser_discovery_request_v1 import (
    PlatformBrowserDiscoveryRequestV1,
)
from japp_contracts.platform.browser_record_v1 import (
    PlatformBrowserRecordV1,
)
from japp_contracts.platform.browser_record_v2 import (
    PlatformBrowserRecordV2,
)
from japp_contracts.platform.capability_report_v1 import (
    PlatformCapabilityReportV1,
)
from japp_contracts.platform.capability_report_v2 import (
    PlatformCapabilityReportV2,
)
from japp_contracts.platform.certification_input_v1 import (
    PlatformCertificationInputV1,
)
from japp_contracts.platform.certification_input_v2 import (
    PlatformCertificationInputV2,
    PlatformCertificationInputV2EvidenceInventoryItem,
)
from japp_contracts.platform.diagnostic_report_v1 import (
    PlatformDiagnosticReportV1,
)
from japp_contracts.platform.diagnostic_report_v2 import (
    PlatformDiagnosticReportV2,
)
from japp_contracts.platform.evidence_record_v1 import (
    PlatformEvidenceRecordV1,
)
from japp_contracts.platform.evidence_record_v2 import (
    PlatformEvidenceRecordV2,
)
from japp_contracts.platform.installer_state_v1 import (
    PlatformInstallerStateV1,
)
from japp_contracts.platform.installer_state_v2 import (
    PlatformInstallerStateV2,
)
from japp_contracts.platform.model_runtime_profile_v1 import (
    PlatformModelRuntimeProfileV1,
)
from japp_contracts.platform.model_runtime_profile_v2 import (
    PlatformModelRuntimeProfileV2,
)
from japp_contracts.platform.native_messaging_registration_v1 import (
    PlatformNativeMessagingRegistrationV1,
)
from japp_contracts.platform.native_messaging_registration_v2 import (
    PlatformNativeMessagingRegistrationV2,
)
from japp_contracts.platform.native_messaging_result_v1 import (
    PlatformNativeMessagingResultV1,
)
from japp_contracts.platform.native_messaging_result_v2 import (
    PlatformNativeMessagingResultV2,
)
from japp_contracts.platform.path_request_v1 import (
    PlatformPathRequestV1,
)
from japp_contracts.platform.path_resolution_v1 import (
    PlatformPathResolutionV1,
)
from japp_contracts.platform.path_resolution_v2 import (
    PlatformPathResolutionV2,
)
from japp_contracts.platform.process_plan_v1 import (
    PlatformProcessPlanV1,
)
from japp_contracts.platform.process_plan_v2 import (
    PlatformProcessPlanV2,
)
from japp_contracts.platform.process_status_v1 import (
    PlatformProcessStatusV1,
)
from japp_contracts.platform.process_status_v2 import (
    PlatformProcessStatusV2,
)
from japp_contracts.platform.runtime_capability_v1 import (
    PlatformRuntimeCapabilityV1,
)
from japp_contracts.platform.runtime_capability_v2 import (
    PlatformRuntimeCapabilityV2,
)
from japp_contracts.platform.secret_store_request_v1 import (
    PlatformSecretStoreRequestV1,
)
from japp_contracts.platform.secret_store_result_v1 import (
    PlatformSecretStoreResultV1,
)
from japp_contracts.platform.secret_store_result_v2 import (
    PlatformSecretStoreResultV2,
)
from japp_contracts.platform.target_identity_v1 import (
    PlatformTargetIdentityV1,
)
from japp_contracts.platform.update_state_v1 import (
    PlatformUpdateStateV1,
)
from japp_contracts.platform.update_state_v2 import (
    PlatformUpdateStateV2,
)
from japp_contracts.platform.vocabulary_v1 import (
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
)
from japp_contracts.rendering.layout_measurement_v1 import (
    RenderingLayoutMeasurementV1,
    RenderingLayoutMeasurementV1ContentBounds,
    RenderingLayoutMeasurementV1EnvironmentMetadata,
    RenderingLayoutMeasurementV1FontCommitment,
    RenderingLayoutMeasurementV1LayoutResult,
    RenderingLayoutMeasurementV1PageDimensions,
)
from japp_contracts.resume.atomic_claim_v1 import (
    ResumeAtomicClaimV1,
    ResumeAtomicClaimV1ClaimType,
    ResumeAtomicClaimV1UserAction,
    ResumeAtomicClaimV1VerificationStatus,
)
from japp_contracts.resume.plan_v1 import (
    ResumePlanV1,
    ResumePlanV1Budget,
    ResumePlanV1EditDecision,
    ResumePlanV1EvidenceAssignment,
    ResumePlanV1RequirementEntry,
    ResumePlanV1TerminologyDecision,
)
from japp_contracts.security.authorization_policy_v1 import (
    SecurityAuthorizationPolicyV1,
    SecurityAuthorizationPolicyV1AuthorizationAllowRow,
)
from japp_contracts.security.authorization_request_v1 import (
    SecurityAuthorizationRequestV1,
)
from japp_contracts.security.capability_taxonomy_v1 import (
    SecurityCapabilityTaxonomyV1,
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    SecurityCapabilityTaxonomyV1CapabilityEntry,
    SecurityCapabilityTaxonomyV1CapabilityId,
    SecurityCapabilityTaxonomyV1PrincipalEntry,
    SecurityCapabilityTaxonomyV1PrincipalId,
    SecurityCapabilityTaxonomyV1ProfileEntry,
)
from japp_contracts.security.command_taxonomy_v1 import (
    SecurityCommandTaxonomyV1,
    SecurityCommandTaxonomyV1CommandEntry,
    SecurityCommandTaxonomyV1CommandId,
    SecurityCommandTaxonomyV1ConsequenceClass,
    SecurityCommandTaxonomyV1IdempotencyExpectation,
)
from japp_contracts.security.policy_data_v1 import (
    AUTHORIZATION_POLICY_V1,
    AUTHORIZATION_PROFILES_V1,
    AUTHORIZATION_PROFILE_CATALOG_V1,
    AuthorizationAllowedV1,
    AuthorizationDeniedV1,
    AuthorizationOutcomeV1,
    AuthorizationPolicyRowV1,
    AuthorizationProfileCatalogEntryV1,
    AuthorizationRuntimeContextV1,
    CAPABILITY_CATALOG_V1,
    CAPABILITY_IDS_V1,
    COMMAND_CATALOG_V1,
    COMMAND_IDS_V1,
    CapabilityCatalogEntryV1,
    CommandCatalogEntryV1,
    PRINCIPAL_CATALOG_V1,
    PRINCIPAL_IDS_V1,
    PrincipalCatalogEntryV1,
    allowed_commands_for_v1,
    authorize_command_request_v1,
    is_authorization_profile_id_v1,
    is_capability_id_v1,
    is_command_id_v1,
    is_principal_id_v1,
    require_capability_entry_v1,
    require_command_entry_v1,
)
from japp_contracts.semantic.rule_catalog_v1 import (
    SemanticRuleCatalogV1,
    SemanticRuleCatalogV1RuleEntry,
    SemanticRuleCatalogV1RuleKind,
)
from japp_contracts.semantic.rules_v1 import (
    SEMANTIC_RULES_V1,
    SemanticRuleEntryV1,
    SemanticValidationIssueV1,
    SemanticValidationOutcomeV1,
    validate_semantic_contract_v1,
)
from japp_contracts.session.application_session_v1 import (
    SessionApplicationSessionV1,
    SessionApplicationSessionV1RevalidationState,
    SessionApplicationSessionV1RuntimeMetadata,
    SessionApplicationSessionV1SessionLifecycleState,
    SessionApplicationSessionV1SnapshotDigests,
)
from japp_contracts.session.guided_run_mode_v1 import (
    SessionGuidedRunModeV1,
    SessionGuidedRunModeV1PageEligibility,
    SessionGuidedRunModeV1RevocationState,
    SessionGuidedRunModeV1RunKind,
    SessionGuidedRunModeV1SnapshotReadiness,
    SessionGuidedRunModeV1SnapshotState,
    SessionGuidedRunModeV1StartPolicy,
)
from japp_contracts.session.navigation_record_v1 import (
    SessionNavigationRecordV1,
    SessionNavigationRecordV1NavigationAction,
    SessionNavigationRecordV1NavigationOutcome,
    SessionNavigationRecordV1ReasonCode,
    SessionNavigationRecordV1TransitionPostconditions,
)
from japp_contracts.session.page_readiness_proof_v1 import (
    SessionPageReadinessProofV1,
    SessionPageReadinessProofV1BlockingCounts,
    SessionPageReadinessProofV1NavigationControlIdentity,
    SessionPageReadinessProofV1SiteValidationStatus,
)
from japp_contracts.workday.certification_record_v1 import (
    WorkdayCertificationRecordV1,
    WorkdayCertificationRecordV1CertificationMetrics,
    WorkdayCertificationRecordV1CertificationState,
    WorkdayCertificationRecordV1PlatformProfile,
)
from japp_contracts.workday.step_identity_v1 import (
    WorkdayStepIdentityV1,
    WorkdayStepIdentityV1BoundaryClass,
    WorkdayStepIdentityV1RecognitionSignal,
    WorkdayStepIdentityV1RecognitionSignalKind,
    WorkdayStepIdentityV1StepFamily,
)
from japp_contracts.workday.tenant_fingerprint_v1 import (
    WorkdayTenantFingerprintV1,
    WorkdayTenantFingerprintV1BrowserCompatibility,
    WorkdayTenantFingerprintV1BrowserFamily,
    WorkdayTenantFingerprintV1CandidateSessionMode,
    WorkdayTenantFingerprintV1HostnameFamily,
)

__all__ = [
    "AUTHORIZATION_POLICY_V1",
    "AUTHORIZATION_PROFILES_V1",
    "AUTHORIZATION_PROFILE_CATALOG_V1",
    "AtsVariantIdentityV1",
    "AtsVariantIdentityV1SessionMode",
    "AuthorizationAllowedV1",
    "AuthorizationDeniedV1",
    "AuthorizationOutcomeV1",
    "AuthorizationPolicyRowV1",
    "AuthorizationProfileCatalogEntryV1",
    "AuthorizationRuntimeContextV1",
    "BenchmarkCaseV1",
    "BenchmarkCaseV1BenchmarkFamily",
    "BenchmarkCaseV1EnvironmentRequirements",
    "BenchmarkCaseV1ExpectedBehavior",
    "BenchmarkCaseV1InputArtifact",
    "BenchmarkCaseV1MetricUnit",
    "BenchmarkCaseV1Threshold",
    "BenchmarkCaseV1ThresholdComparator",
    "BenchmarkHoldoutManifestV1",
    "BenchmarkHoldoutManifestV1CategoryCount",
    "BenchmarkHoldoutManifestV1EncryptedBundleMetadata",
    "BenchmarkHoldoutManifestV1FileCommitment",
    "BenchmarkHoldoutManifestV1SchemaVersionEntry",
    "BenchmarkResultV1",
    "BenchmarkResultV1CompletenessState",
    "BenchmarkResultV1EnvironmentMatchState",
    "BenchmarkResultV1HashState",
    "BenchmarkResultV1HoldoutState",
    "BenchmarkResultV1MetricResult",
    "BenchmarkResultV1RuntimeMetadata",
    "CAPABILITY_CATALOG_V1",
    "CAPABILITY_IDS_V1",
    "COMMAND_CATALOG_V1",
    "COMMAND_IDS_V1",
    "CapabilityCatalogEntryV1",
    "CommandCatalogEntryV1",
    "CommonCalendarDateV1CalendarDate",
    "CommonConfidenceV1Confidence",
    "CommonContractTextV1BoundedToken",
    "CommonContractTextV1GitObjectId",
    "CommonContractTextV1Locale",
    "CommonContractTextV1MetricValue",
    "CommonContractTextV1NonNegativeSafeInteger",
    "CommonContractTextV1NormalizedText",
    "CommonContractTextV1PositiveSafeInteger",
    "CommonContractTextV1SchemaReference",
    "CommonContractTextV1VersionText",
    "CommonCorrelationV1CausationId",
    "CommonCorrelationV1CorrelationId",
    "CommonEnumTokenV1EnumToken",
    "CommonEnvelopeV1EnvelopeMetadata",
    "CommonEnvelopeV1EnvelopedRecord",
    "CommonEnvelopeV1ExtensionKey",
    "CommonEnvelopeV1Extensions",
    "CommonLocationV1CountryCode",
    "CommonLocationV1StructuredLocation",
    "CommonMoneyV1CurrencyCode",
    "CommonMoneyV1DecimalAmount",
    "CommonMoneyV1Money",
    "CommonProvenanceV1ContentDigest",
    "CommonProvenanceV1Provenance",
    "CommonProvenanceV1SourceKind",
    "CommonRedactionV1RedactionAnnotation",
    "CommonRedactionV1RedactionPolicy",
    "CommonRedactionV1SensitivityClass",
    "CommonSchemaVersionV1SchemaId",
    "CommonSchemaVersionV1SchemaVersion",
    "CommonStableIdV1IdPrefix",
    "CommonStableIdV1StableId",
    "CommonTimestampUtcV1UtcTimestamp",
    "ContractModel",
    "ERROR_CATALOG_V1",
    "ERROR_CODES_V1",
    "ErrorCatalogV1",
    "ErrorCatalogV1CatalogEntry",
    "ErrorRecordV1",
    "ErrorTaxonomyV1ErrorCode",
    "ErrorTaxonomyV1ErrorFamily",
    "ErrorTaxonomyV1ErrorOrigin",
    "ErrorTaxonomyV1ErrorSeverity",
    "ErrorTaxonomyV1MessageKey",
    "ErrorTaxonomyV1RetryDisposition",
    "ErrorTaxonomyV1UserSafeMessage",
    "FixtureTestRecordV1",
    "FormDriverResultV1",
    "FormDriverResultV1ActionAttempt",
    "FormDriverResultV1DriverOutcome",
    "FormDriverResultV1PreconditionsResult",
    "FormDriverResultV1ReasonCode",
    "FormDriverResultV1RecoveryResult",
    "FormDriverResultV1ResolutionResult",
    "FormDriverResultV1SiteAcceptance",
    "FormDriverResultV1ValueEvidence",
    "FormFieldAddressV1",
    "FormFieldAddressV1AtsFamily",
    "FormFieldAddressV1RepeaterPathEntry",
    "FormFieldAddressV1ResolutionHint",
    "FormFieldAddressV1ResolutionHintKind",
    "FormFieldAddressV1StabilityClass",
    "FormFieldDecisionV1",
    "FormFieldDecisionV1ConfirmationState",
    "FormFieldDecisionV1FinalDecision",
    "FormFieldDecisionV1PolicyDecision",
    "FormFieldDecisionV1ReasonCode",
    "FormFieldDecisionV1ValueSourceType",
    "FormFieldDescriptorV1",
    "FormFieldDescriptorV1ControlKind",
    "FormFieldDescriptorV1ObservedValue",
    "FormFieldDescriptorV1OptionSemantic",
    "FormFieldDescriptorV1UntrustedTextRepresentation",
    "FormFieldDescriptorV1ValidationState",
    "FormReconciliationInventoryV1",
    "FormReconciliationInventoryV1ConfirmationState",
    "FormReconciliationInventoryV1InventoryCounts",
    "FormReconciliationInventoryV1InventoryItem",
    "FormReconciliationInventoryV1ReconciliationCategory",
    "GateDecisionV1",
    "GateDecisionV1GateDecision",
    "GateDecisionV1IndependentReviewState",
    "GateDecisionV1OwnerDecisionState",
    "GateDecisionV1ReasonCode",
    "GateDecisionV1ThresholdEvidenceSummary",
    "GateEvidenceBundleV1",
    "GateEvidenceBundleV1CompletenessInventory",
    "GateEvidenceBundleV1GateId",
    "JsonValue",
    "PRINCIPAL_CATALOG_V1",
    "PRINCIPAL_IDS_V1",
    "PlatformBrowserDiscoveryRequestV1",
    "PlatformBrowserRecordV1",
    "PlatformBrowserRecordV2",
    "PlatformCapabilityReportV1",
    "PlatformCapabilityReportV2",
    "PlatformCertificationInputV1",
    "PlatformCertificationInputV2",
    "PlatformCertificationInputV2EvidenceInventoryItem",
    "PlatformDiagnosticReportV1",
    "PlatformDiagnosticReportV2",
    "PlatformEvidenceRecordV1",
    "PlatformEvidenceRecordV2",
    "PlatformInstallerStateV1",
    "PlatformInstallerStateV2",
    "PlatformModelRuntimeProfileV1",
    "PlatformModelRuntimeProfileV2",
    "PlatformNativeMessagingRegistrationV1",
    "PlatformNativeMessagingRegistrationV2",
    "PlatformNativeMessagingResultV1",
    "PlatformNativeMessagingResultV2",
    "PlatformPathRequestV1",
    "PlatformPathResolutionV1",
    "PlatformPathResolutionV2",
    "PlatformProcessPlanV1",
    "PlatformProcessPlanV2",
    "PlatformProcessStatusV1",
    "PlatformProcessStatusV2",
    "PlatformRuntimeCapabilityV1",
    "PlatformRuntimeCapabilityV2",
    "PlatformSecretStoreRequestV1",
    "PlatformSecretStoreResultV1",
    "PlatformSecretStoreResultV2",
    "PlatformTargetIdentityV1",
    "PlatformUpdateStateV1",
    "PlatformUpdateStateV2",
    "PlatformVocabularyV1AcceleratorClass",
    "PlatformVocabularyV1Architecture",
    "PlatformVocabularyV1ArtifactIdentity",
    "PlatformVocabularyV1BoundedUserMessage",
    "PlatformVocabularyV1BrowserChannel",
    "PlatformVocabularyV1BrowserFamily",
    "PlatformVocabularyV1BuildToken",
    "PlatformVocabularyV1CapabilityAvailability",
    "PlatformVocabularyV1CapabilityState",
    "PlatformVocabularyV1CertifiedPlatformId",
    "PlatformVocabularyV1ContextTokens",
    "PlatformVocabularyV1CoreCapabilityBehavior",
    "PlatformVocabularyV1DiagnosticResult",
    "PlatformVocabularyV1DistributionChannel",
    "PlatformVocabularyV1EnvironmentEntry",
    "PlatformVocabularyV1EnvironmentVariableId",
    "PlatformVocabularyV1EvaluationMethod",
    "PlatformVocabularyV1EvidenceArtifactKind",
    "PlatformVocabularyV1ExtensionId",
    "PlatformVocabularyV1InstallationScope",
    "PlatformVocabularyV1InstallerState",
    "PlatformVocabularyV1LifecycleMode",
    "PlatformVocabularyV1MachineClass",
    "PlatformVocabularyV1MemoryMebibytes",
    "PlatformVocabularyV1NativeHostCleanupState",
    "PlatformVocabularyV1NativeHostName",
    "PlatformVocabularyV1OwnerDecisionState",
    "PlatformVocabularyV1PackageFormat",
    "PlatformVocabularyV1PathResolutionState",
    "PlatformVocabularyV1PathRole",
    "PlatformVocabularyV1PathSegment",
    "PlatformVocabularyV1PlatformCapabilityId",
    "PlatformVocabularyV1PlatformComponentId",
    "PlatformVocabularyV1PlatformId",
    "PlatformVocabularyV1PlatformReasonCode",
    "PlatformVocabularyV1ProcessArgument",
    "PlatformVocabularyV1ProcessExitCode",
    "PlatformVocabularyV1ProcessProfileId",
    "PlatformVocabularyV1ProcessState",
    "PlatformVocabularyV1ProductVersion",
    "PlatformVocabularyV1ProfileAcceptanceState",
    "PlatformVocabularyV1RedactedPathReference",
    "PlatformVocabularyV1RegistrationOperation",
    "PlatformVocabularyV1RegistrationState",
    "PlatformVocabularyV1RequestContext",
    "PlatformVocabularyV1ReviewState",
    "PlatformVocabularyV1RuntimeFamily",
    "PlatformVocabularyV1SecretKeyRole",
    "PlatformVocabularyV1SecretOperation",
    "PlatformVocabularyV1SecretReference",
    "PlatformVocabularyV1SecretResultState",
    "PlatformVocabularyV1Severity",
    "PlatformVocabularyV1SignatureState",
    "PlatformVocabularyV1StdioMode",
    "PlatformVocabularyV1SupportClaim",
    "PlatformVocabularyV1SupportTier",
    "PlatformVocabularyV1TerminationRequest",
    "PlatformVocabularyV1TimeoutMilliseconds",
    "PlatformVocabularyV1UpdateState",
    "PlatformVocabularyV1UserDataPreservation",
    "PrincipalCatalogEntryV1",
    "RenderingLayoutMeasurementV1",
    "RenderingLayoutMeasurementV1ContentBounds",
    "RenderingLayoutMeasurementV1EnvironmentMetadata",
    "RenderingLayoutMeasurementV1FontCommitment",
    "RenderingLayoutMeasurementV1LayoutResult",
    "RenderingLayoutMeasurementV1PageDimensions",
    "ResumeAtomicClaimV1",
    "ResumeAtomicClaimV1ClaimType",
    "ResumeAtomicClaimV1UserAction",
    "ResumeAtomicClaimV1VerificationStatus",
    "ResumePlanV1",
    "ResumePlanV1Budget",
    "ResumePlanV1EditDecision",
    "ResumePlanV1EvidenceAssignment",
    "ResumePlanV1RequirementEntry",
    "ResumePlanV1TerminologyDecision",
    "SEMANTIC_RULES_V1",
    "SecurityAuthorizationPolicyV1",
    "SecurityAuthorizationPolicyV1AuthorizationAllowRow",
    "SecurityAuthorizationRequestV1",
    "SecurityCapabilityTaxonomyV1",
    "SecurityCapabilityTaxonomyV1AuthorizationProfileId",
    "SecurityCapabilityTaxonomyV1CapabilityEntry",
    "SecurityCapabilityTaxonomyV1CapabilityId",
    "SecurityCapabilityTaxonomyV1PrincipalEntry",
    "SecurityCapabilityTaxonomyV1PrincipalId",
    "SecurityCapabilityTaxonomyV1ProfileEntry",
    "SecurityCommandTaxonomyV1",
    "SecurityCommandTaxonomyV1CommandEntry",
    "SecurityCommandTaxonomyV1CommandId",
    "SecurityCommandTaxonomyV1ConsequenceClass",
    "SecurityCommandTaxonomyV1IdempotencyExpectation",
    "SemanticRuleCatalogV1",
    "SemanticRuleCatalogV1RuleEntry",
    "SemanticRuleCatalogV1RuleKind",
    "SemanticRuleEntryV1",
    "SemanticValidationIssueV1",
    "SemanticValidationOutcomeV1",
    "SessionApplicationSessionV1",
    "SessionApplicationSessionV1RevalidationState",
    "SessionApplicationSessionV1RuntimeMetadata",
    "SessionApplicationSessionV1SessionLifecycleState",
    "SessionApplicationSessionV1SnapshotDigests",
    "SessionGuidedRunModeV1",
    "SessionGuidedRunModeV1PageEligibility",
    "SessionGuidedRunModeV1RevocationState",
    "SessionGuidedRunModeV1RunKind",
    "SessionGuidedRunModeV1SnapshotReadiness",
    "SessionGuidedRunModeV1SnapshotState",
    "SessionGuidedRunModeV1StartPolicy",
    "SessionNavigationRecordV1",
    "SessionNavigationRecordV1NavigationAction",
    "SessionNavigationRecordV1NavigationOutcome",
    "SessionNavigationRecordV1ReasonCode",
    "SessionNavigationRecordV1TransitionPostconditions",
    "SessionPageReadinessProofV1",
    "SessionPageReadinessProofV1BlockingCounts",
    "SessionPageReadinessProofV1NavigationControlIdentity",
    "SessionPageReadinessProofV1SiteValidationStatus",
    "WorkdayCertificationRecordV1",
    "WorkdayCertificationRecordV1CertificationMetrics",
    "WorkdayCertificationRecordV1CertificationState",
    "WorkdayCertificationRecordV1PlatformProfile",
    "WorkdayStepIdentityV1",
    "WorkdayStepIdentityV1BoundaryClass",
    "WorkdayStepIdentityV1RecognitionSignal",
    "WorkdayStepIdentityV1RecognitionSignalKind",
    "WorkdayStepIdentityV1StepFamily",
    "WorkdayTenantFingerprintV1",
    "WorkdayTenantFingerprintV1BrowserCompatibility",
    "WorkdayTenantFingerprintV1BrowserFamily",
    "WorkdayTenantFingerprintV1CandidateSessionMode",
    "WorkdayTenantFingerprintV1HostnameFamily",
    "allowed_commands_for_v1",
    "authorize_command_request_v1",
    "error_default_message_v1",
    "is_authorization_profile_id_v1",
    "is_capability_id_v1",
    "is_command_id_v1",
    "is_error_code_v1",
    "is_principal_id_v1",
    "reject_explicit_null",
    "require_capability_entry_v1",
    "require_command_entry_v1",
    "require_error_catalog_entry_v1",
    "validate_calendar_date",
    "validate_semantic_contract_v1",
    "validate_utc_timestamp",
]
