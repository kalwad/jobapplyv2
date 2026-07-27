/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth: packages/contracts/schemas/form/field-descriptor.v1.schema.json
 * Schema id: urn:japp:schema:form:field-descriptor:v1
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 * Manual edits are prohibited and fail the contract-gen drift suite.
 */

import type { CommonContractTextV1BoundedToken, CommonContractTextV1NonNegativeSafeInteger, CommonContractTextV1NormalizedText } from "../common/contract-text.v1.ts";
import type { CommonEnumTokenV1EnumToken } from "../common/enum-token.v1.ts";
import type { CommonProvenanceV1ContentDigest } from "../common/provenance.v1.ts";
import type { CommonStableIdV1StableId } from "../common/stable-id.v1.ts";
import type { CommonTimestampUtcV1UtcTimestamp } from "../common/timestamp-utc.v1.ts";
import type { FormFieldAddressV1 } from "../form/field-address.v1.ts";

/**
 * Observed control kind
 *
 * Closed token set; undeclared tokens are rejected.
 */
export type FormFieldDescriptorV1ControlKind = "CHECKBOX" | "COMBOBOX" | "DATE" | "FILE" | "MULTI_SELECT" | "RADIO_GROUP" | "SELECT" | "TEXT" | "TEXTAREA" | "UNKNOWN";

/**
 * Synthetic-safe observed value
 *
 * Only a bounded semantic token and/or digest is exchanged; credentials and raw sensitive values are not representable.
 */
export interface FormFieldDescriptorV1ObservedValue {
  readonly semantic_token?: CommonContractTextV1BoundedToken;
  readonly value_digest: CommonProvenanceV1ContentDigest;
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly presence: "ABSENT" | "EMPTY" | "PRESENT_REDACTED";
}

/**
 * Bounded normalized untrusted text representation
 */
export interface FormFieldDescriptorV1UntrustedTextRepresentation {
  readonly normalized_text?: CommonContractTextV1NormalizedText;
  readonly text_digest: CommonProvenanceV1ContentDigest;
  readonly untrusted: boolean;
}

/**
 * Observed validation state
 */
export interface FormFieldDescriptorV1ValidationState {
  /**
   * Closed token set; undeclared tokens are rejected.
   */
  readonly state: "ACCEPTED" | "REJECTED" | "UNKNOWN" | "NOT_APPLICABLE";
  /**
   * Minimum items: 0.
   * Maximum items: 8.
   */
  readonly message_digests: readonly CommonProvenanceV1ContentDigest[];
}

/**
 * Bounded option semantic
 */
export interface FormFieldDescriptorV1OptionSemantic {
  readonly stable_value_token?: CommonContractTextV1BoundedToken;
  readonly value_digest: CommonProvenanceV1ContentDigest;
  readonly label: FormFieldDescriptorV1UntrustedTextRepresentation;
  readonly disabled: boolean;
}

/**
 * FieldDescriptor
 *
 * Bounded observed-field description. Page-derived text is explicitly untrusted data and never executable authority or a system message.
 */
export interface FormFieldDescriptorV1 {
  readonly field_id: CommonStableIdV1StableId;
  readonly address: FormFieldAddressV1;
  readonly control_kind: FormFieldDescriptorV1ControlKind;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly required: boolean;
  readonly sensitive_candidate: boolean;
  readonly label: FormFieldDescriptorV1UntrustedTextRepresentation;
  readonly description?: FormFieldDescriptorV1UntrustedTextRepresentation;
  /**
   * Minimum items: 0.
   * Maximum items: 16.
   */
  readonly section_context: readonly CommonEnumTokenV1EnumToken[];
  /**
   * Minimum items: 0.
   * Maximum items: 256.
   */
  readonly options: readonly FormFieldDescriptorV1OptionSemantic[];
  readonly current_value?: FormFieldDescriptorV1ObservedValue;
  readonly validation_state: FormFieldDescriptorV1ValidationState;
  readonly observed_at: CommonTimestampUtcV1UtcTimestamp;
  readonly observed_dom_generation: CommonContractTextV1NonNegativeSafeInteger;
}
