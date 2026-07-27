/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/session/guided-run-mode.v1.schema.json
 * Schema id: urn:japp:schema:session:guided-run-mode:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Observed page eligibility for a start
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionGuidedRunModeV1PageEligibility = "CERTIFIED_APPLICATION_PAGE" | "EXPIRED_SESSION" | "HUMAN_VERIFICATION" | "LOGIN_OR_ACCOUNT" | "PROTECTED_BOUNDARY" | "STALE_PAGE" | "UNCERTIFIED_PATTERN" | "UNKNOWN_PAGE";

/**
 * Immediate disable or revocation state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionGuidedRunModeV1RevocationState = "ACTIVE" | "DISABLED" | "REVOKED";

/**
 * Guided run kind
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionGuidedRunModeV1RunKind = "DRY_RUN" | "FEASIBILITY" | "GUIDED_PRE_SUBMIT";

/**
 * Reviewed snapshot readiness
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionGuidedRunModeV1SnapshotState = "MISSING" | "READY" | "STALE";

/**
 * Run start policy
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionGuidedRunModeV1StartPolicy = "AUTO_START_ON_OPEN" | "MANUAL_START";

/**
 * Profile, document, and answer snapshot readiness
 */
export interface SessionGuidedRunModeV1SnapshotReadiness {
  readonly profile: SessionGuidedRunModeV1SnapshotState;
  readonly document: SessionGuidedRunModeV1SnapshotState;
  readonly answer_policy: SessionGuidedRunModeV1SnapshotState;
}

/**
 * GuidedRunMode
 *
 * Bounded future run-mode and start-policy vocabulary. AUTO_SUBMIT and final-submit authority are deliberately absent.
 */
export interface SessionGuidedRunModeV1 {
  readonly run_mode_id: CommonStableIdV1StableId;
  readonly run_kind: SessionGuidedRunModeV1RunKind;
  readonly start_policy: SessionGuidedRunModeV1StartPolicy;
  readonly prior_opt_in_ref?: CommonStableIdV1StableId;
  readonly certified_pattern_ref?: CommonStableIdV1StableId;
  readonly snapshot_readiness: SessionGuidedRunModeV1SnapshotReadiness;
  readonly cancelable_start_ref?: CommonStableIdV1StableId;
  readonly visible_cancel_control: boolean;
  readonly revocation_state: SessionGuidedRunModeV1RevocationState;
  readonly page_eligibility: SessionGuidedRunModeV1PageEligibility;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly start_permission: "START_ALLOWED" | "START_BLOCKED";
}
