/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/path-request.v1.schema.json
 * Schema id: urn:japp:schema:platform:path-request:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { PlatformVocabularyV1InstallationScope, PlatformVocabularyV1PathRole, PlatformVocabularyV1PathSegment, PlatformVocabularyV1RequestContext } from "../platform/vocabulary.v1.ts";

/**
 * Typed logical platform path request
 *
 * A caller selects a logical role and bounded relative segments. An absolute path, traversal path, UNC or device path, registry path, shell expansion, environment expansion, executable lookup input, or arbitrary working directory is structurally unrepresentable.
 */
export interface PlatformPathRequestV1 {
  readonly path_request_id: CommonStableIdV1StableId;
  readonly request_context: PlatformVocabularyV1RequestContext;
  readonly role: PlatformVocabularyV1PathRole;
  readonly scope: PlatformVocabularyV1InstallationScope;
  /**
   * Bounded normalized segments appended below the role root.
   *
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly relative_segments: readonly PlatformVocabularyV1PathSegment[];
  readonly create_if_missing: boolean;
}
