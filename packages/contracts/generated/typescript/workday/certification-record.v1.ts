/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/workday/certification-record.v1.schema.json
 * Schema id: urn:japp:schema:workday:certification-record:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonConfidenceV1Confidence } from "../common/confidence.v1.ts";
import type { CommonContractTextV1BoundedToken, CommonContractTextV1Locale, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1NormalizedText, CommonContractTextV1PositiveSafeInteger, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { WorkdayTenantFingerprintV1, WorkdayTenantFingerprintV1CandidateSessionMode } from "../workday/tenant-fingerprint.v1.ts";

/**
 * Measured certification metrics
 */
export interface WorkdayCertificationRecordV1CertificationMetrics {
  readonly case_count: CommonContractTextV1PositiveSafeInteger;
  readonly fill_accuracy: CommonConfidenceV1Confidence;
  readonly verified_fill_rate: CommonConfidenceV1Confidence;
  readonly navigation_success_rate: CommonConfidenceV1Confidence;
  readonly progression_success_rate: CommonConfidenceV1Confidence;
  readonly manual_correction_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly failure_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly intervention_count: CommonContractTextV1NonNegativeSafeInteger;
}

/**
 * Certification evidence state
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayCertificationRecordV1CertificationState = "CERTIFIED" | "DRAFT_EVIDENCE" | "EXPIRED" | "MEASURED_CANDIDATE" | "REJECTED" | "REVOKED";

/**
 * Measured operating-system and architecture profile
 */
export interface WorkdayCertificationRecordV1PlatformProfile {
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly operating_system: "MACOS" | "UBUNTU" | "WINDOWS";
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly architecture: "ARM64" | "X86_64";
}

/**
 * Workday certification record
 *
 * Future evidence record for one exact measured Workday pattern tuple. This schema creates no current certification.
 */
export interface WorkdayCertificationRecordV1 {
  readonly certification_record_id: CommonStableIdV1StableId;
  readonly tenant_fingerprint: WorkdayTenantFingerprintV1;
  readonly locale: CommonContractTextV1Locale;
  readonly session_mode: WorkdayTenantFingerprintV1CandidateSessionMode;
  /**
   * Minimum items: 1.
   * Maximum items: 32.
   */
  readonly route_page_sequence: readonly CommonEnumTokenV1EnumToken[];
  /**
   * Minimum items: 1.
   * Maximum items: 64.
   */
  readonly control_families: readonly CommonEnumTokenV1EnumToken[];
  readonly adapter_version: CommonContractTextV1VersionText;
  readonly browser_version: CommonContractTextV1BoundedToken;
  readonly platform_profile: WorkdayCertificationRecordV1PlatformProfile;
  readonly corpus_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly holdout_manifest_digest: CommonProvenanceV1ContentDigest;
  readonly metrics: WorkdayCertificationRecordV1CertificationMetrics;
  readonly last_tested_on: CommonCalendarDateV1CalendarDate;
  /**
   * Minimum items: 0.
   * Maximum items: 32.
   */
  readonly known_limitations: readonly CommonContractTextV1NormalizedText[];
  /**
   * Minimum items: 1.
   * Maximum items: 32.
   */
  readonly evidence_report_refs: readonly CommonStableIdV1StableId[];
  readonly measured_scope_digest: CommonProvenanceV1ContentDigest;
  readonly certified_scope_digest: CommonProvenanceV1ContentDigest;
  readonly certification_state: WorkdayCertificationRecordV1CertificationState;
  readonly provenance: CommonProvenanceV1Provenance;
}
