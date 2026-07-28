/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/browser-discovery-request.v1.schema.json
 * Schema id: urn:japp:schema:platform:browser-discovery-request:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { PlatformVocabularyV1BrowserChannel, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1PlatformId, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RequestContext } from "../platform/vocabulary.v1.ts";

/**
 * Browser discovery request
 *
 * A request to report whether a reviewed browser family and channel are present on a certified platform. It cannot name an executable, search a path, launch a URL, invoke a shell, or pass browser arguments.
 */
export interface PlatformBrowserDiscoveryRequestV1 {
  readonly browser_discovery_request_id: CommonStableIdV1StableId;
  readonly request_context: PlatformVocabularyV1RequestContext;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly browser_family: PlatformVocabularyV1BrowserFamily;
  readonly browser_channel: PlatformVocabularyV1BrowserChannel;
  /**
   * Whether the adapter should additionally report native-messaging capability. A probe never launches the browser.
   */
  readonly include_capability_probe: boolean;
  readonly minimum_version?: PlatformVocabularyV1ProductVersion;
}
