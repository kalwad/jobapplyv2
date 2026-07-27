/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/provenance.v1.schema.json
 * Schema id: urn:japp:schema:common:provenance:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonConfidenceV1Confidence } from "../common/confidence.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";

/**
 * Content digest
 *
 * SHA-256 digest of the exact observed artifact, rendered as sha256:<64 lowercase hex digits>.
 *
 * Pattern: ^sha256:[0-9a-f]{64}$
 */
export type CommonProvenanceV1ContentDigest = string;

/**
 * Source kind
 *
 * Closed set of source families. Additive growth follows the enum evolution rules in urn:japp:schema:common:enum-token:v1.
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type CommonProvenanceV1SourceKind = "USER_INPUT" | "DOCUMENT_IMPORT" | "PAGE_CAPTURE" | "EXTERNAL_API" | "GENERATED";

/**
 * Provenance record
 */
export interface CommonProvenanceV1Provenance {
  readonly source_kind: CommonProvenanceV1SourceKind;
  /**
   * Stable identifier of the source entity (for example a document, capture, or import record).
   */
  readonly source_id: CommonStableIdV1StableId;
  /**
   * Instant the source content was observed, always UTC.
   */
  readonly observed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly source_digest?: CommonProvenanceV1ContentDigest;
  /**
   * Producer confidence that the referenced source supports the derived value.
   */
  readonly confidence?: CommonConfidenceV1Confidence;
}
