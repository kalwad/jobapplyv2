/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/service/version.v1.schema.json
 * Schema id: urn:japp:schema:service:version:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonSchemaVersionV1SchemaVersion } from "../common/schema-version.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Service version payload
 *
 * Actual installed orchestrator distribution version and the exact local API version. No platform or AI capability is inferred.
 */
export interface ServiceVersionV1 {
  readonly service_version: CommonSchemaVersionV1SchemaVersion;
  /**
   * Pattern: ^1\.0\.0$
   * Minimum length: 5.
   * Maximum length: 5.
   */
  readonly api_version: string;
  readonly instance_id: CommonStableIdV1StableId;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 2147483647.
   */
  readonly generation: number;
}
