/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/rendering/layout-measurement.v1.schema.json
 * Schema id: urn:japp:schema:rendering:layout-measurement:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonConfidenceV1Confidence } from "../common/confidence.v1.ts";
import type { CommonContractTextV1BoundedToken, CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";

/**
 * Measured per-page content bounds in points
 */
export interface RenderingLayoutMeasurementV1ContentBounds {
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 1.
   * Maximum: 1000.
   */
  readonly page_number: number;
  /**
   * Minimum: 0.
   * Maximum: 10000.
   */
  readonly x: number;
  /**
   * Minimum: 0.
   * Maximum: 10000.
   */
  readonly y: number;
  /**
   * Minimum: 0.
   * Maximum: 10000.
   */
  readonly width: number;
  /**
   * Minimum: 0.
   * Maximum: 10000.
   */
  readonly height: number;
}

/**
 * Measured rendering environment
 */
export interface RenderingLayoutMeasurementV1EnvironmentMetadata {
  readonly platform_profile: CommonEnumTokenV1EnumToken;
  readonly toolchain_digest: CommonProvenanceV1ContentDigest;
}

/**
 * Controlled font commitment
 */
export interface RenderingLayoutMeasurementV1FontCommitment {
  readonly font_family: CommonEnumTokenV1EnumToken;
  readonly font_digest: CommonProvenanceV1ContentDigest;
}

/**
 * Layout result
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type RenderingLayoutMeasurementV1LayoutResult = "ACCEPTED" | "CLIPPED" | "EXTRACTION_ORDER_MISMATCH" | "FONT_MISSING" | "OVERFLOW" | "RENDER_FAILED";

/**
 * Page dimensions in points
 */
export interface RenderingLayoutMeasurementV1PageDimensions {
  /**
   * Minimum: 1.
   * Maximum: 10000.
   */
  readonly width_points: number;
  /**
   * Minimum: 1.
   * Maximum: 10000.
   */
  readonly height_points: number;
}

/**
 * Layout measurement
 *
 * Deterministic future rendering and layout evidence. This contract performs no rendering and creates no visual snapshots.
 */
export interface RenderingLayoutMeasurementV1 {
  readonly measurement_id: CommonStableIdV1StableId;
  readonly render_artifact_id: CommonStableIdV1StableId;
  readonly render_artifact_digest: CommonProvenanceV1ContentDigest;
  readonly source_document_ref: CommonStableIdV1StableId;
  readonly renderer_version: CommonContractTextV1BoundedToken;
  readonly browser_version: CommonContractTextV1BoundedToken;
  /**
   * Minimum items: 1.
   * Maximum items: 32.
   */
  readonly controlled_fonts: readonly RenderingLayoutMeasurementV1FontCommitment[];
  readonly page_dimensions: RenderingLayoutMeasurementV1PageDimensions;
  /**
   * Rendered page count. Zero permits a structurally honest RENDER_FAILED record; its relationship to layout_result is a cross-field semantic invariant.
   *
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 1000.
   */
  readonly page_count: number;
  /**
   * One bounded measurement per rendered page. An empty inventory permits RENDER_FAILED evidence; its relationship to page_count and layout_result is a cross-field semantic invariant.
   *
   * Minimum items: 0.
   * Maximum items: 1000.
   */
  readonly page_content_bounds: readonly RenderingLayoutMeasurementV1ContentBounds[];
  readonly overflow_detected: boolean;
  readonly clipping_detected: boolean;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly extraction_order_result: "MATCH" | "MISMATCH" | "UNKNOWN";
  /**
   * Minimum items: 0.
   * Maximum items: 32.
   */
  readonly missing_font_families: readonly CommonEnumTokenV1EnumToken[];
  readonly renderer_succeeded: boolean;
  readonly parseability_score?: CommonConfidenceV1Confidence;
  readonly readability_score?: CommonConfidenceV1Confidence;
  readonly word_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly character_count: CommonContractTextV1NonNegativeSafeInteger;
  /**
   * Integer; runtime validation rejects fractions and coercion.
   * Minimum: 0.
   * Maximum: 86400000.
   */
  readonly duration_ms: number;
  readonly environment_metadata: RenderingLayoutMeasurementV1EnvironmentMetadata;
  readonly layout_result: RenderingLayoutMeasurementV1LayoutResult;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly error_reason_codes: readonly ErrorTaxonomyV1ErrorCode[];
  readonly evidence_report_digest: CommonProvenanceV1ContentDigest;
}
