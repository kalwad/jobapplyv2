/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/workday/step-identity.v1.schema.json
 * Schema id: urn:japp:schema:workday:step-identity:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonConfidenceV1Confidence } from "../common/confidence.v1.ts";
import type { CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";

/**
 * Machine-distinguishable boundary class
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayStepIdentityV1BoundaryClass = "FINAL_REVIEW_BOUNDARY" | "ORDINARY_APPLICATION" | "PROTECTED_AUTHENTICATION" | "PROTECTED_HUMAN_VERIFICATION" | "PROTECTED_LEGAL_OR_CONSENT" | "UNKNOWN_OR_UNSUPPORTED";

/**
 * Independent recognition signal kind
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayStepIdentityV1RecognitionSignalKind = "BOUNDARY_INDICATOR" | "CONTROL_FAMILY" | "HEADING_DIGEST" | "PAGE_SEQUENCE" | "ROUTE_FAMILY" | "VALIDATION_STATE";

/**
 * Workday step family
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayStepIdentityV1StepFamily = "ACCOUNT_CREATION" | "AUTHENTICATED_APPLICATION" | "CAPTCHA" | "DUPLICATE_APPLICATION" | "EMAIL_VERIFICATION" | "EXPIRED_SESSION" | "FINAL_REVIEW" | "GUEST_APPLICATION" | "LEGAL_CONSENT_BOUNDARY" | "LOGIN" | "MFA" | "UNKNOWN_UNSUPPORTED";

/**
 * One bounded recognition signal
 */
export interface WorkdayStepIdentityV1RecognitionSignal {
  readonly kind: WorkdayStepIdentityV1RecognitionSignalKind;
  readonly signal_digest: CommonProvenanceV1ContentDigest;
  readonly confidence: CommonConfidenceV1Confidence;
}

/**
 * WorkdayStepIdentity
 *
 * Multi-signal identity for an application step or protected boundary, first owned by the Workday-guided contract family. The boundary vocabulary is intentionally ATS-neutral when embedded in ApplicationSession; the Workday name does not claim a tenant certification. A single URL, heading, selector, or attribute is insufficient.
 */
export interface WorkdayStepIdentityV1 {
  readonly step_identity_id: CommonStableIdV1StableId;
  readonly session_id: CommonStableIdV1StableId;
  readonly step_family: WorkdayStepIdentityV1StepFamily;
  readonly boundary_class: WorkdayStepIdentityV1BoundaryClass;
  /**
   * Minimum items: 2.
   * Maximum items: 12.
   */
  readonly recognition_signals: readonly WorkdayStepIdentityV1RecognitionSignal[];
  readonly recognition_confidence: CommonConfidenceV1Confidence;
  readonly observed_dom_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly recognized_at: CommonTimestampUtcV1UtcTimestamp;
  readonly evidence_digest: CommonProvenanceV1ContentDigest;
}
