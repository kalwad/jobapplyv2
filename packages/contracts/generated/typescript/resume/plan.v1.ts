/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/resume/plan.v1.schema.json
 * Schema id: urn:japp:schema:resume:plan:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken } from "../common/contract-text.v1.ts";
import type { CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Resume word and page budgets
 */
export interface ResumePlanV1Budget {
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 5000.
   */
  readonly section_word_budget: number;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 20000.
   */
  readonly global_word_budget: number;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 20.
   */
  readonly page_budget: number;
}

/**
 * Removal or ordering decision
 */
export interface ResumePlanV1EditDecision {
  readonly content_ref: CommonStableIdV1StableId;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly decision: "KEEP" | "LOCK" | "REMOVE" | "REORDER";
  readonly reason_code: CommonEnumTokenV1EnumToken;
}

/**
 * Requirement-to-evidence assignment
 */
export interface ResumePlanV1EvidenceAssignment {
  readonly requirement_ref: CommonStableIdV1StableId;
  /**
   * Minimum items: 1.
   * Maximum items: 32.
   */
  readonly evidence_refs: readonly CommonStableIdV1StableId[];
}

/**
 * Ordered job requirement
 */
export interface ResumePlanV1RequirementEntry {
  readonly requirement_ref: CommonStableIdV1StableId;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 1000.
   */
  readonly priority: number;
  readonly supported: boolean;
}

/**
 * Evidence-bounded terminology decision
 */
export interface ResumePlanV1TerminologyDecision {
  readonly term: CommonContractTextV1BoundedToken;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly decision: "AVOID" | "REVIEW" | "USE";
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly evidence_refs: readonly CommonStableIdV1StableId[];
}

/**
 * Resume feasibility plan
 *
 * Evidence-linked feasibility plan for future resume work. It carries no generated final prose and does not treat unsupported claims as evidence.
 */
export interface ResumePlanV1 {
  readonly plan_id: CommonStableIdV1StableId;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly plan_schema_version: "RESUME_PLAN_V1";
  readonly job_ref: CommonStableIdV1StableId;
  readonly job_version_ref: CommonStableIdV1StableId;
  readonly resume_source_ref: CommonStableIdV1StableId;
  readonly resume_version_ref: CommonStableIdV1StableId;
  /**
   * Minimum items: 1.
   * Maximum items: 256.
   */
  readonly ordered_requirements: readonly ResumePlanV1RequirementEntry[];
  /**
   * Minimum items: 0.
   * Maximum items: 256.
   */
  readonly evidence_assignments: readonly ResumePlanV1EvidenceAssignment[];
  /**
   * Minimum items: 0.
   * Maximum items: 256.
   */
  readonly unsupported_gap_refs: readonly CommonStableIdV1StableId[];
  /**
   * Minimum items: 0.
   * Maximum items: 256.
   */
  readonly locked_content_refs: readonly CommonStableIdV1StableId[];
  readonly budget: ResumePlanV1Budget;
  /**
   * Minimum items: 0.
   * Maximum items: 128.
   */
  readonly terminology_decisions: readonly ResumePlanV1TerminologyDecision[];
  /**
   * Minimum items: 0.
   * Maximum items: 256.
   */
  readonly edit_decisions: readonly ResumePlanV1EditDecision[];
  /**
   * Minimum items: 1.
   * Maximum items: 64.
   */
  readonly expected_verification_checks: readonly CommonEnumTokenV1EnumToken[];
  readonly prompt_version_ref?: CommonStableIdV1StableId;
  readonly model_profile_ref?: CommonStableIdV1StableId;
  readonly provenance: CommonProvenanceV1Provenance;
  readonly correlation_id: CommonCorrelationV1CorrelationId;
}
