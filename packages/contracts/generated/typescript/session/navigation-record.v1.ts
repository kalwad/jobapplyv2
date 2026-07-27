/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/session/navigation-record.v1.schema.json
 * Schema id: urn:japp:schema:session:navigation-record:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { SessionGuidedRunModeV1RunKind, SessionGuidedRunModeV1StartPolicy } from "../session/guided-run-mode.v1.ts";
import type { SessionPageReadinessProofV1NavigationControlIdentity } from "../session/page-readiness-proof.v1.ts";
import type { WorkdayStepIdentityV1, WorkdayStepIdentityV1StepFamily } from "../workday/step-identity.v1.ts";

/**
 * Bounded navigation action
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionNavigationRecordV1NavigationAction = "BACK" | "NEXT";

/**
 * Observed navigation outcome
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionNavigationRecordV1NavigationOutcome = "FAILED" | "NO_TRANSITION" | "PAUSED_BOUNDARY" | "UNCERTAIN_TRANSITION" | "VERIFIED_TRANSITION";

/**
 * Reviewed navigation reason
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionNavigationRecordV1ReasonCode = "CONTROL_RESOLUTION_FAILED" | "DESTINATION_NOT_ALLOWED" | "DESTINATION_NOT_RECOGNIZED" | "NAVIGATION_ATTEMPT_FAILED" | "NO_TRANSITION_OBSERVED" | "POSTCONDITIONS_INCOMPLETE" | "POSTCONDITIONS_VERIFIED" | "PROTECTED_BOUNDARY_PAUSE" | "READINESS_PROOF_INVALID" | "SOURCE_GENERATION_MISMATCH" | "TRANSITION_UNCERTAIN";

/**
 * Observed transition postconditions
 */
export interface SessionNavigationRecordV1TransitionPostconditions {
  readonly source_generation_changed: boolean;
  readonly destination_recognized: boolean;
  readonly source_control_absent_or_inactive: boolean;
}

/**
 * NavigationRecord
 *
 * Auditable evidence for one bounded next/back navigation attempt. Clicks alone are not transition evidence and final submission is not representable.
 */
export interface SessionNavigationRecordV1 {
  readonly navigation_record_id: CommonStableIdV1StableId;
  readonly session_id: CommonStableIdV1StableId;
  readonly source_step_identity: WorkdayStepIdentityV1;
  readonly expected_destination_family?: WorkdayStepIdentityV1StepFamily;
  /**
   * Minimum items: 1.
   * Maximum items: 12.
   */
  readonly allowed_destination_families: readonly WorkdayStepIdentityV1StepFamily[];
  readonly source_page_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly readiness_proof_ref: CommonStableIdV1StableId;
  readonly readiness_proof_digest: CommonProvenanceV1ContentDigest;
  readonly navigation_control: SessionPageReadinessProofV1NavigationControlIdentity;
  readonly action: SessionNavigationRecordV1NavigationAction;
  readonly idempotency_key: CommonStableIdV1StableId;
  readonly initiating_run_kind: SessionGuidedRunModeV1RunKind;
  readonly initiating_start_policy: SessionGuidedRunModeV1StartPolicy;
  readonly attempted_at: CommonTimestampUtcV1UtcTimestamp;
  readonly postconditions: SessionNavigationRecordV1TransitionPostconditions;
  readonly observed_destination_identity?: WorkdayStepIdentityV1;
  readonly observed_resulting_generation?: CommonContractTextV1NonNegativeSafeInteger;
  readonly safe_retry_allowed: boolean;
  readonly outcome: SessionNavigationRecordV1NavigationOutcome;
  /**
   * Minimum items: 1.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly SessionNavigationRecordV1ReasonCode[];
  readonly correlation_id: CommonCorrelationV1CorrelationId;
}
