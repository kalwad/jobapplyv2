/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/common/envelope.v1.schema.json
 * Schema id: urn:japp:schema:common:envelope:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId } from "../common/correlation.v1.ts";
import type { CommonSchemaVersionV1SchemaId, CommonSchemaVersionV1SchemaVersion } from "../common/schema-version.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";

/**
 * Extension key
 *
 * Namespaced extension property name: x- followed by lowercase kebab-case.
 *
 * Pattern: ^x-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
 * Maximum length: 64.
 */
export type CommonEnvelopeV1ExtensionKey = string;

/**
 * Explicit extension surface
 *
 * Deliberately open object for forward-compatible unknown data. Values are opaque and untrusted.
 *
 * Explicit extension surface: keys are namespaced x-… tokens and values are opaque untrusted data (at most 32 members).
 */
export type CommonEnvelopeV1Extensions = {
  readonly [key: `x-${string}`]: unknown;
};

/**
 * Envelope metadata
 */
export interface CommonEnvelopeV1EnvelopeMetadata {
  /**
   * Catalog identifier of the payload schema.
   */
  readonly schema_id: CommonSchemaVersionV1SchemaId;
  /**
   * Exact payload schema version the producer wrote against.
   */
  readonly schema_version: CommonSchemaVersionV1SchemaVersion;
  /**
   * Stable identity of this message or record.
   */
  readonly message_id: CommonStableIdV1StableId;
  /**
   * Creation instant, always UTC.
   */
  readonly created_at: CommonTimestampUtcV1UtcTimestamp;
  readonly correlation_id?: CommonCorrelationV1CorrelationId;
  readonly causation_id?: CommonCorrelationV1CausationId;
  readonly extensions?: CommonEnvelopeV1Extensions;
}

/**
 * Enveloped record
 *
 * Two-part shape: envelope metadata plus a payload validated in a second phase against the schema named by envelope.schema_id.
 */
export interface CommonEnvelopeV1EnvelopedRecord {
  readonly envelope: CommonEnvelopeV1EnvelopeMetadata;
  /**
   * Deliberately opaque value; validated in a second phase by the envelope acceptance policy.
   */
  readonly payload: unknown;
}
