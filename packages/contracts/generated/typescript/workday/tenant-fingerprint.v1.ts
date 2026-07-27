/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/workday/tenant-fingerprint.v1.schema.json
 * Schema id: urn:japp:schema:workday:tenant-fingerprint:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonContractTextV1BoundedToken, CommonContractTextV1Locale, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Measured browser family
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayTenantFingerprintV1BrowserFamily = "CHROMIUM" | "EDGE_CHROMIUM" | "UNKNOWN";

/**
 * Candidate session mode
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayTenantFingerprintV1CandidateSessionMode = "AUTHENTICATED" | "GUEST" | "UNKNOWN";

/**
 * Reviewed hostname-family classification
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type WorkdayTenantFingerprintV1HostnameFamily = "REVIEWED_ALIAS_FAMILY" | "UNKNOWN" | "WORKDAY_CANONICAL_FAMILY" | "WORKDAY_TENANT_FAMILY";

/**
 * Evidence-bounded browser compatibility
 */
export interface WorkdayTenantFingerprintV1BrowserCompatibility {
  readonly browser_family: WorkdayTenantFingerprintV1BrowserFamily;
  readonly minimum_version: CommonContractTextV1BoundedToken;
  readonly maximum_tested_version: CommonContractTextV1BoundedToken;
  readonly evidence_digest: CommonProvenanceV1ContentDigest;
}

/**
 * WorkdayTenantFingerprint
 *
 * Independent bounded signals identifying one exact Workday tenant-pattern family. Authentication material and universal-support claims are not representable.
 */
export interface WorkdayTenantFingerprintV1 {
  readonly tenant_fingerprint_id: CommonStableIdV1StableId;
  readonly hostname_family: WorkdayTenantFingerprintV1HostnameFamily;
  readonly locale: CommonContractTextV1Locale;
  readonly candidate_session_mode: WorkdayTenantFingerprintV1CandidateSessionMode;
  readonly route_family: CommonEnumTokenV1EnumToken;
  readonly page_sequence_family: CommonEnumTokenV1EnumToken;
  /**
   * Minimum items: 1.
   * Maximum items: 64.
   */
  readonly control_family_inventory: readonly CommonEnumTokenV1EnumToken[];
  readonly control_family_fingerprint: CommonProvenanceV1ContentDigest;
  readonly tenant_pattern_version: CommonContractTextV1VersionText;
  readonly adapter_version: CommonContractTextV1VersionText;
  readonly browser_compatibility: WorkdayTenantFingerprintV1BrowserCompatibility;
  readonly evidence_digest: CommonProvenanceV1ContentDigest;
  readonly last_tested_on?: CommonCalendarDateV1CalendarDate;
}
