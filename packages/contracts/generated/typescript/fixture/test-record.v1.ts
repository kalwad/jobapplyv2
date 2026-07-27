/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/fixture/test-record.v1.schema.json
 * Schema id: urn:japp:schema:fixture:test-record:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonConfidenceV1Confidence } from "../common/confidence.v1.ts";
import type { CommonLocationV1StructuredLocation } from "../common/location.v1.ts";
import type { CommonMoneyV1Money } from "../common/money.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonRedactionV1RedactionAnnotation } from "../common/redaction.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";

/**
 * Composition test record (test-only fixture)
 *
 * TEST-ONLY fixture proving that the foundational common definitions compose into a concrete payload schema and flow through the envelope. The fixture namespace never carries product data and no product component may depend on it. Version history (illustrative): 1.0.0 defined every required field; 1.1.0 added the optional note field (additive MINOR change) and deprecated legacy_tag. Real payload contracts (profile, resume, application, field, Workday, benchmark, platform) are future packages.
 */
export interface FixtureTestRecordV1 {
  /**
   * Stable identity of this fixture record.
   */
  readonly record_id: CommonStableIdV1StableId;
  readonly captured_at: CommonTimestampUtcV1UtcTimestamp;
  readonly effective_date: CommonCalendarDateV1CalendarDate;
  readonly budget: CommonMoneyV1Money;
  readonly location: CommonLocationV1StructuredLocation;
  readonly provenance: CommonProvenanceV1Provenance;
  readonly match_confidence: CommonConfidenceV1Confidence;
  readonly redaction: CommonRedactionV1RedactionAnnotation;
  /**
   * Closed fixture status set; undeclared tokens are rejected.
   *
   * Closed token set; undeclared tokens are rejected.
   */
  readonly status: "ACTIVE" | "ARCHIVED";
  /**
   * Identifier of the replacing record, or null when this record is explicitly known to have no successor. Null (known-none) and missing (not provided) are distinct by convention; this field is required precisely so producers must state the known-none case.
   */
  readonly superseded_by: CommonStableIdV1StableId | null;
  /**
   * Optional free-text note added in 1.1.0. Optional and non-nullable: omit it when absent; null is rejected.
   *
   * Minimum length: 1.
   * Maximum length: 500.
   * Sensitivity (x-japp-sensitivity): PERSONAL
   * Redaction (x-japp-redaction): REDACT_VALUE
   */
  readonly note?: string;
  /**
   * Deprecated fixture field retained for minor-compatibility; removal requires the next major.
   *
   * Minimum length: 1.
   * Maximum length: 64.
   * @deprecated since schema version 1.1.0
   */
  readonly legacy_tag?: string;
}
