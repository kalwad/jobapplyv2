/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/ats/variant-identity.v1.schema.json
 * Schema id: urn:japp:schema:ats:variant-identity:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonCalendarDateV1CalendarDate } from "../common/calendar-date.v1.ts";
import type { CommonContractTextV1Locale, CommonContractTextV1VersionText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest, CommonProvenanceV1Provenance } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { FormFieldAddressV1AtsFamily } from "../form/field-address.v1.ts";

/**
 * ATS candidate session mode
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type AtsVariantIdentityV1SessionMode = "AUTHENTICATED" | "GUEST" | "UNKNOWN";

/**
 * ATS variant identity
 *
 * Evidence-bounded identity for an exact reviewed ATS pattern. It does not claim universal support.
 */
export interface AtsVariantIdentityV1 {
  readonly variant_identity_id: CommonStableIdV1StableId;
  readonly ats_family: FormFieldAddressV1AtsFamily;
  readonly adapter_id: CommonStableIdV1StableId;
  readonly adapter_version: CommonContractTextV1VersionText;
  readonly pattern_id: CommonStableIdV1StableId;
  readonly locale: CommonContractTextV1Locale;
  readonly session_mode: AtsVariantIdentityV1SessionMode;
  readonly route_page_family: CommonEnumTokenV1EnumToken;
  readonly evidence_digest: CommonProvenanceV1ContentDigest;
  readonly last_tested_on?: CommonCalendarDateV1CalendarDate;
  readonly provenance: CommonProvenanceV1Provenance;
}
