/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/error/record.v1.schema.json
 * Schema id: urn:japp:schema:error:record:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { ErrorTaxonomyV1ErrorCode, ErrorTaxonomyV1ErrorOrigin } from "../error/taxonomy.v1.ts";

/**
 * Wire error record
 *
 * Strict versioned error record exchanged across trust boundaries (M01-W03). The record serializes ONLY the stable error code plus occurrence identity/trace data; family, severity, retry disposition, user-action state, transience, diagnostic policy, and the user-safe message are derived by the consumer from the canonical error catalog, so a caller can never pair a code with contradictory metadata and free-form user-facing message text is unrepresentable on the wire. The record is a closed object with no extension surface; when transported inside the standard envelope, envelope-level versioning applies (schema_id urn:japp:schema:error:record:v1). Internal diagnostic detail travels out of band, redacted and bounded, referenced here only by an optional content digest — it never becomes UI text automatically.
 */
export interface ErrorRecordV1 {
  /**
   * Stable identity of this error occurrence.
   */
  readonly error_id: CommonStableIdV1StableId;
  /**
   * Stable taxonomy code; the only classification data on the wire.
   */
  readonly code: ErrorTaxonomyV1ErrorCode;
  /**
   * Instant the condition was observed, always UTC.
   */
  readonly occurred_at: CommonTimestampUtcV1UtcTimestamp;
  /**
   * Component or trust boundary reporting the error.
   */
  readonly origin: ErrorTaxonomyV1ErrorOrigin;
  /**
   * Workflow the occurrence belongs to.
   */
  readonly correlation_id: CommonCorrelationV1CorrelationId;
  /**
   * Message or event that directly produced this error, when known.
   */
  readonly causation_id?: CommonCorrelationV1CausationId;
  /**
   * SHA-256 digest of the separately stored, redacted, bounded diagnostic artifact for this occurrence, where one exists.
   */
  readonly diagnostic_digest?: CommonProvenanceV1ContentDigest;
}
