// Deterministic canonical-descriptor factory for M02-W09 unit tests.
//
// Every produced descriptor is validated against the canonical
// FormFieldDescriptorV1 schema before it is returned, so unit fixtures can
// never drift from the real W08 wire shape. All content is synthetic.
import {
  validateFormFieldDescriptorV1,
  type FormFieldDescriptorV1,
  type FormFieldDescriptorV1ControlKind,
  type FormFieldDescriptorV1OptionSemantic,
  type FormFieldDescriptorV1UntrustedTextRepresentation,
} from "@japp/contracts/generated";

import { semanticDigest, stableSemanticId } from "../../src/semantic-digest.ts";

export interface DescriptorOptionSpec {
  readonly label: string;
  readonly token?: string;
  readonly disabled?: boolean;
}

export interface DescriptorSpec {
  readonly label: string;
  readonly description?: string;
  readonly controlKind?: FormFieldDescriptorV1ControlKind;
  readonly sectionContext?: readonly string[];
  readonly options?: readonly DescriptorOptionSpec[];
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly required?: boolean;
}

const OBSERVED_AT = "2026-08-23T00:00:00Z";

async function untrustedText(
  value: string,
): Promise<FormFieldDescriptorV1UntrustedTextRepresentation> {
  const digest = await semanticDigest(`w09-test-text-v1\0${value}`);
  return value === ""
    ? { text_digest: digest, untrusted: true }
    : { normalized_text: value, text_digest: digest, untrusted: true };
}

async function buildOption(
  spec: DescriptorOptionSpec,
  index: number,
): Promise<FormFieldDescriptorV1OptionSemantic> {
  return {
    ...(spec.token === undefined ? {} : { stable_value_token: spec.token }),
    value_digest: await semanticDigest(
      `w09-test-option-v1\0${String(index)}\0${spec.token ?? spec.label}`,
    ),
    label: await untrustedText(spec.label),
    disabled: spec.disabled ?? false,
  };
}

export async function buildDescriptor(
  spec: DescriptorSpec,
): Promise<FormFieldDescriptorV1> {
  const controlKind = spec.controlKind ?? "TEXT";
  const sections = [...(spec.sectionContext ?? [])];
  const seed = JSON.stringify({
    label: spec.label,
    controlKind,
    sections,
    options: spec.options ?? [],
  });
  const attributeFingerprint = await semanticDigest(
    `w09-test-attributes-v1\0${seed}`,
  );
  const accessibleNameFingerprint = await semanticDigest(
    `w09-test-name-v1\0${spec.label}`,
  );
  const options = await Promise.all(
    (spec.options ?? []).map(async (option, index) =>
      buildOption(option, index),
    ),
  );
  const descriptor: FormFieldDescriptorV1 = {
    field_id: await stableSemanticId("field", `w09-test-field\0${seed}`),
    address: {
      address_schema_version: "FIELD_ADDRESS_V1",
      session_id: await stableSemanticId("session", "w09-test-session"),
      frame_id: await stableSemanticId("frame", "w09-test-frame"),
      document_id: await stableSemanticId("document", "w09-test-document"),
      ats_family: "UNKNOWN",
      route_signature: await semanticDigest("w09-test-route-v1"),
      application_root_fingerprint: await semanticDigest("w09-test-root-v1"),
      section_path: sections,
      repeater_path: [],
      accessible_name_fingerprint: accessibleNameFingerprint,
      attribute_fingerprint: attributeFingerprint,
      resolution_hints: [
        {
          kind: "CONTROL_KIND",
          value_fingerprint: await semanticDigest(
            `w09-test-kind-v1\0${controlKind}`,
          ),
          stability_class: "PAGE_STABLE",
        },
        {
          kind: "ATTRIBUTE_DIGEST",
          value_fingerprint: attributeFingerprint,
          stability_class: "PAGE_STABLE",
        },
      ],
      observed_dom_generation: 0,
    },
    control_kind: controlKind,
    visible: spec.visible ?? true,
    enabled: spec.enabled ?? true,
    required: spec.required ?? false,
    sensitive_candidate: false,
    label: await untrustedText(spec.label),
    ...(spec.description === undefined
      ? {}
      : { description: await untrustedText(spec.description) }),
    section_context: sections,
    options,
    validation_state: { state: "NOT_APPLICABLE", message_digests: [] },
    observed_at: OBSERVED_AT,
    observed_dom_generation: 0,
  };
  const outcome = validateFormFieldDescriptorV1(descriptor);
  if (!outcome.valid) {
    throw new Error(
      `test descriptor is not canonical: ${outcome.errors.join("; ")}`,
    );
  }
  return outcome.value;
}
