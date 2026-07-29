/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/platform/browser-record.v1.schema.json
 * Schema id: urn:japp:schema:platform:browser-record:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { PlatformVocabularyV1BrowserChannel, PlatformVocabularyV1BrowserFamily, PlatformVocabularyV1CapabilityAvailability, PlatformVocabularyV1CapabilityState, PlatformVocabularyV1EvaluationMethod, PlatformVocabularyV1PlatformId, PlatformVocabularyV1PlatformReasonCode, PlatformVocabularyV1ProductVersion, PlatformVocabularyV1RedactedPathReference } from "../platform/vocabulary.v1.ts";

/**
 * Browser identity, location, and capability record
 *
 * A sanitized record of one observed browser: family, channel, version, sanitized install location, and native-messaging capability. Only Chrome stable on a certified platform may ever be marked certified; the contract deliberately cannot express Firefox, Safari, ChromeOS, ARM Windows, Intel macOS, or another Linux distribution as certified. It contains no executable path, launch argument, profile directory, or browsing data.
 * @deprecated since schema version 2.0.0
 */
export interface PlatformBrowserRecordV1 {
  readonly browser_record_id: CommonStableIdV1StableId;
  readonly request_ref?: CommonStableIdV1StableId;
  readonly platform_id: PlatformVocabularyV1PlatformId;
  readonly browser_family: PlatformVocabularyV1BrowserFamily;
  readonly browser_channel: PlatformVocabularyV1BrowserChannel;
  readonly detected_version?: PlatformVocabularyV1ProductVersion;
  readonly detection_method: PlatformVocabularyV1EvaluationMethod;
  readonly presence: PlatformVocabularyV1CapabilityAvailability;
  /**
   * Role-anchored sanitized reference only. A real installation path is never represented.
   */
  readonly sanitized_install_location?: PlatformVocabularyV1RedactedPathReference;
  /**
   * Whether this observation is inside the certified browser matrix. Only Chrome stable on a certified platform, with a measured detection method and an observed version, may be true.
   */
  readonly certified_for_platform: boolean;
  readonly native_messaging_capability: PlatformVocabularyV1CapabilityState;
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly reason_codes: readonly PlatformVocabularyV1PlatformReasonCode[];
  readonly last_tested_on?: CommonCalendarDateV1CalendarDate;
  readonly observed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly provenance: CommonProvenanceV1Provenance;
}
