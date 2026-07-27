/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/session/application-session.v1.schema.json
 * Schema id: urn:japp:schema:session:application-session:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { AtsVariantIdentityV1 } from "../ats/variant-identity.v1.ts";
import type { CommonContractTextV1BoundedToken, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { SecurityCapabilityTaxonomyV1AuthorizationProfileId } from "../security/capability-taxonomy.v1.ts";
import type { SessionGuidedRunModeV1 } from "../session/guided-run-mode.v1.ts";
import type { WorkdayStepIdentityV1 } from "../workday/step-identity.v1.ts";
import type { WorkdayTenantFingerprintV1 } from "../workday/tenant-fingerprint.v1.ts";

/**
 * Expiration and revalidation state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionApplicationSessionV1RevalidationState = "CURRENT" | "EXPIRED" | "REVALIDATED" | "REVALIDATION_REQUIRED";

/**
 * Bounded browser and runtime version metadata
 */
export interface SessionApplicationSessionV1RuntimeMetadata {
  readonly browser_family: CommonEnumTokenV1EnumToken;
  readonly browser_version: CommonContractTextV1BoundedToken;
  readonly runtime_family: CommonEnumTokenV1EnumToken;
  readonly runtime_version: CommonContractTextV1BoundedToken;
}

/**
 * Application-session lifecycle state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type SessionApplicationSessionV1SessionLifecycleState = "ACTIVE" | "CANCELED" | "COMPLETED_PRE_SUBMIT" | "EXPIRED" | "PAUSED" | "REVALIDATION_REQUIRED";

/**
 * Reviewed input snapshot digests
 */
export interface SessionApplicationSessionV1SnapshotDigests {
  readonly profile_digest: CommonProvenanceV1ContentDigest;
  readonly document_digest: CommonProvenanceV1ContentDigest;
  readonly answer_policy_digest: CommonProvenanceV1ContentDigest;
}

/**
 * ApplicationSession
 *
 * Bounded application-session identity and lifecycle snapshot. It defines no run execution behavior.
 */
export interface SessionApplicationSessionV1 {
  readonly session_id: CommonStableIdV1StableId;
  readonly job_id: CommonStableIdV1StableId;
  readonly application_id: CommonStableIdV1StableId;
  readonly ats_variant: AtsVariantIdentityV1;
  readonly workday_tenant_fingerprint?: WorkdayTenantFingerprintV1;
  readonly guided_run_mode: SessionGuidedRunModeV1;
  readonly authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly adapter_version: CommonContractTextV1VersionText;
  readonly runtime_metadata: SessionApplicationSessionV1RuntimeMetadata;
  readonly snapshot_digests: SessionApplicationSessionV1SnapshotDigests;
  /**
   * Current multi-signal application/boundary identity. M01-W06 first owns this ATS-neutral boundary vocabulary under the Workday contract family.
   */
  readonly current_step: WorkdayStepIdentityV1;
  readonly current_page_generation: CommonContractTextV1NonNegativeSafeInteger;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  readonly lifecycle_state: SessionApplicationSessionV1SessionLifecycleState;
  readonly created_at: CommonTimestampUtcV1UtcTimestamp;
  readonly updated_at: CommonTimestampUtcV1UtcTimestamp;
  readonly pause_or_cancel_reason?: CommonEnumTokenV1EnumToken;
  readonly revalidation_state: SessionApplicationSessionV1RevalidationState;
}
