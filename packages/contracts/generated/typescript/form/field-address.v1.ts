/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/form/field-address.v1.schema.json
 * Schema id: urn:japp:schema:form:field-address:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1NonNegativeSafeInteger } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";

/**
 * ATS family
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldAddressV1AtsFamily = "ASHBY" | "GREENHOUSE" | "ICIMS" | "LEVER" | "OTHER_REVIEWED" | "SMARTRECRUITERS" | "SUCCESSFACTORS" | "TALEO" | "UNKNOWN" | "WORKDAY";

/**
 * Repeater path entry
 */
export interface FormFieldAddressV1RepeaterPathEntry {
  readonly semantic_concept: CommonEnumTokenV1EnumToken;
  readonly stable_item_key: CommonStableIdV1StableId;
}

/**
 * Bounded non-selector resolution hint kind
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldAddressV1ResolutionHintKind = "ACCESSIBLE_NAME_DIGEST" | "ATTRIBUTE_DIGEST" | "CONTROL_KIND" | "OPTION_DIGEST" | "ROLE_TOKEN" | "SECTION_TOKEN";

/**
 * Resolution-hint stability
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldAddressV1StabilityClass = "SESSION_STABLE" | "PAGE_STABLE" | "OBSERVATION_ONLY";

/**
 * Bounded resolution hint
 *
 * A non-executable hint. CSS selectors, XPath, JavaScript, HTML, and caller-supplied expressions are not representable.
 */
export interface FormFieldAddressV1ResolutionHint {
  readonly kind: FormFieldAddressV1ResolutionHintKind;
  readonly value_fingerprint: CommonProvenanceV1ContentDigest;
  readonly stability_class: FormFieldAddressV1StabilityClass;
}

/**
 * FieldAddress
 *
 * Durable semantic and structural identity for one observed field. Resolution hints are inert hints and never authority.
 */
export interface FormFieldAddressV1 {
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly address_schema_version: "FIELD_ADDRESS_V1";
  readonly session_id: CommonStableIdV1StableId;
  readonly frame_id: CommonStableIdV1StableId;
  readonly document_id: CommonStableIdV1StableId;
  readonly ats_family: FormFieldAddressV1AtsFamily;
  readonly tenant_pattern_id?: CommonStableIdV1StableId;
  readonly route_signature?: CommonProvenanceV1ContentDigest;
  readonly application_root_fingerprint?: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly section_path: readonly CommonEnumTokenV1EnumToken[];
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly repeater_path: readonly FormFieldAddressV1RepeaterPathEntry[];
  readonly accessible_name_fingerprint?: CommonProvenanceV1ContentDigest;
  readonly attribute_fingerprint?: CommonProvenanceV1ContentDigest;
  readonly option_fingerprint?: CommonProvenanceV1ContentDigest;
  /**
   * Minimum items: 0.
   * Maximum items: 12.
   */
  readonly resolution_hints: readonly FormFieldAddressV1ResolutionHint[];
  readonly observed_dom_generation: CommonContractTextV1NonNegativeSafeInteger;
}
