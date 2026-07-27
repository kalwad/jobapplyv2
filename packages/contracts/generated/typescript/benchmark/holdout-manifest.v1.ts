/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/benchmark/holdout-manifest.v1.schema.json
 * Schema id: urn:japp:schema:benchmark:holdout-manifest:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1PositiveSafeInteger, CommonContractTextV1SchemaReference, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * Holdout category count
 */
export interface BenchmarkHoldoutManifestV1CategoryCount {
  readonly category: CommonEnumTokenV1EnumToken;
  readonly count: CommonContractTextV1NonNegativeSafeInteger;
}

/**
 * Optional encrypted-bundle commitment without keys
 */
export interface BenchmarkHoldoutManifestV1EncryptedBundleMetadata {
  readonly bundle_ref: CommonStableIdV1StableId;
  readonly cipher_suite: CommonEnumTokenV1EnumToken;
  readonly bundle_digest: CommonProvenanceV1ContentDigest;
}

/**
 * Holdout file commitment
 */
export interface BenchmarkHoldoutManifestV1FileCommitment {
  readonly file_id: CommonStableIdV1StableId;
  readonly content_digest: CommonProvenanceV1ContentDigest;
  readonly byte_count: CommonContractTextV1NonNegativeSafeInteger;
  readonly case_count: CommonContractTextV1NonNegativeSafeInteger;
}

/**
 * Referenced schema version
 */
export interface BenchmarkHoldoutManifestV1SchemaVersionEntry {
  readonly schema_ref: CommonContractTextV1SchemaReference;
  readonly schema_version: CommonContractTextV1VersionText;
}

/**
 * Holdout manifest
 *
 * Deterministic commitment to owner-controlled holdout identities and hashes. Hidden case bodies, keys, paths, usernames, tokens, and PII are not representable.
 */
export interface BenchmarkHoldoutManifestV1 {
  readonly manifest_id: CommonStableIdV1StableId;
  readonly holdout_format_version: CommonContractTextV1VersionText;
  /**
   * Minimum items: 1.
   * Maximum items: 4096.
   */
  readonly case_ids: readonly CommonStableIdV1StableId[];
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly schema_versions: readonly BenchmarkHoldoutManifestV1SchemaVersionEntry[];
  readonly case_count: CommonContractTextV1PositiveSafeInteger;
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly category_counts: readonly BenchmarkHoldoutManifestV1CategoryCount[];
  /**
   * Minimum items: 1.
   * Maximum items: 128.
   */
  readonly files: readonly BenchmarkHoldoutManifestV1FileCommitment[];
  readonly synthetic_only: boolean;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly storage_policy: "ENCRYPTED_BUNDLE_REFERENCE" | "OWNER_CONTROLLED_EXTERNAL";
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly visibility_class: "OWNER_ONLY" | "OWNER_REVIEWER" | "REVIEWER_ONLY";
  readonly creation_provenance: CommonProvenanceV1Provenance;
  readonly review_provenance: CommonProvenanceV1Provenance;
  readonly encrypted_bundle?: BenchmarkHoldoutManifestV1EncryptedBundleMetadata;
  readonly manifest_digest: CommonProvenanceV1ContentDigest;
}
