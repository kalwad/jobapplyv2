// M02-W09 deterministic decision resolver.
//
// Converts one canonical W08 FormFieldDescriptorV1 plus approved synthetic
// records into one canonical FormFieldDecisionV1. The resolver DECIDES; it
// performs no fill, click, navigation, upload, or submission, and grants no
// browser action authority to any caller. Every emitted decision is
// self-checked against the canonical structural validator and the
// FIELD_DECISION_AUTHORITY semantic rule before it is returned; an
// unexpressible decision is a typed error, never a silently adjusted one.
import {
  validateFormFieldDecisionV1,
  validateFormFieldDescriptorV1,
  validateSemanticContractV1,
  type CommonStableIdV1StableId,
  type FormFieldDecisionV1,
  type FormFieldDecisionV1ReasonCode,
  type FormFieldDescriptorV1,
} from "@japp/contracts/generated";

import type { ApprovedRecordSet } from "./approved-records.ts";
import { classifyField, type FieldClassification } from "./field-classifier.ts";
import {
  resolveIntendedOption,
  type OptionResolution,
} from "./option-resolver.ts";
import {
  conceptRule,
  FEASIBILITY_ONTOLOGY_VERSION,
  UNKNOWN_CONCEPT,
} from "./ontology.ts";
import { synthesizePolicy } from "./safety-policy.ts";
import {
  canonicalJson,
  semanticDigest,
  stableSemanticId,
} from "./semantic-digest.ts";

const FIELD_DECISION_SCHEMA_REF = "urn:japp:schema:form:field-decision:v1";
const ENUMERABLE_CONTROL_KINDS = new Set([
  "SELECT",
  "MULTI_SELECT",
  "RADIO_GROUP",
  "COMBOBOX",
]);

export interface DecisionResolutionRequest {
  readonly descriptor: FormFieldDescriptorV1;
  readonly records: ApprovedRecordSet;
  /** Workflow correlation identifier supplied by the caller. */
  readonly correlationId: CommonStableIdV1StableId;
}

export interface FieldDecisionResolution {
  readonly decision: FormFieldDecisionV1;
  readonly classification: FieldClassification;
  /** Present when an enumerable control was matched against its options. */
  readonly optionResolution?: OptionResolution;
  readonly ontologyVersion: string;
}

export type DecisionResolutionOutcome =
  | {
      readonly status: "RESOLVED";
      readonly resolution: FieldDecisionResolution;
    }
  | {
      readonly status: "REJECTED_DESCRIPTOR";
      readonly errors: readonly string[];
    };

interface DecisionSkeleton {
  readonly fieldConcept: string;
  readonly classificationConfidence: number;
  readonly valueSourceType: FormFieldDecisionV1["value_source_type"];
  readonly valueSourceRef?: CommonStableIdV1StableId;
  readonly valueConfidence: number;
  readonly sensitivityClass: FormFieldDecisionV1["sensitivity_class"];
  readonly policyDecision: FormFieldDecisionV1["policy_decision"];
  readonly finalDecision: FormFieldDecisionV1["final_decision"];
  readonly confirmationState: FormFieldDecisionV1["confirmation_state"];
  readonly userConfirmationRef?: CommonStableIdV1StableId;
  readonly reasonCodes: readonly FormFieldDecisionV1ReasonCode[];
}

function withMandatedReasons(
  skeleton: DecisionSkeleton,
): readonly FormFieldDecisionV1ReasonCode[] {
  const codes = [...skeleton.reasonCodes];
  // Canonical FIELD_DECISION_AUTHORITY floor: sub-0.5 confidences must be
  // named explicitly. This is a belt-and-braces guard; branches above
  // already include the codes.
  if (
    skeleton.classificationConfidence < 0.5 &&
    !codes.includes("LOW_CLASSIFICATION_CONFIDENCE")
  ) {
    codes.push("LOW_CLASSIFICATION_CONFIDENCE");
  }
  if (
    skeleton.valueConfidence < 0.5 &&
    !codes.includes("LOW_VALUE_CONFIDENCE")
  ) {
    codes.push("LOW_VALUE_CONFIDENCE");
  }
  return codes.slice(0, 8);
}

async function assembleDecision(
  request: DecisionResolutionRequest,
  skeleton: DecisionSkeleton,
): Promise<FormFieldDecisionV1> {
  const { descriptor, correlationId } = request;
  const addressDigest = await semanticDigest(
    `field-address-v1\0${canonicalJson(descriptor.address)}`,
  );
  const descriptorDigest = await semanticDigest(
    `field-descriptor-v1\0${canonicalJson(descriptor)}`,
  );
  // Semantic decision identity is derived from inputs only. Observation
  // time is truthful metadata carried in provenance and never part of the
  // identity seed, so identical inputs yield identical decision IDs.
  const decisionId = await stableSemanticId(
    "decision",
    [
      "w09-decision-v1",
      FEASIBILITY_ONTOLOGY_VERSION,
      addressDigest,
      descriptorDigest,
      correlationId,
    ].join("\0"),
  );
  const decision: FormFieldDecisionV1 = {
    decision_id: decisionId,
    field_id: descriptor.field_id,
    field_address_digest: addressDigest,
    field_concept: skeleton.fieldConcept,
    classification_confidence: skeleton.classificationConfidence,
    value_source_type: skeleton.valueSourceType,
    ...(skeleton.valueSourceRef === undefined
      ? {}
      : { value_source_ref: skeleton.valueSourceRef }),
    value_confidence: skeleton.valueConfidence,
    sensitivity_class: skeleton.sensitivityClass,
    policy_decision: skeleton.policyDecision,
    final_decision: skeleton.finalDecision,
    confirmation_state: skeleton.confirmationState,
    ...(skeleton.userConfirmationRef === undefined
      ? {}
      : { user_confirmation_ref: skeleton.userConfirmationRef }),
    reason_codes: withMandatedReasons(skeleton),
    provenance: {
      source_kind: "PAGE_CAPTURE",
      source_id: descriptor.field_id,
      observed_at: descriptor.observed_at,
      source_digest: descriptorDigest,
    },
    correlation_id: correlationId,
    causation_id: descriptor.field_id,
  };
  const structural = validateFormFieldDecisionV1(decision);
  if (!structural.valid) {
    throw new Error(
      `W09 resolver produced a non-canonical FieldDecision: ${structural.errors.join("; ")}`,
    );
  }
  const semantic = validateSemanticContractV1(
    FIELD_DECISION_SCHEMA_REF,
    decision,
  );
  if (!semantic.valid) {
    throw new Error(
      `W09 resolver violated canonical decision authority rules: ${semantic.issues
        .map((issue) => issue.rule_id)
        .join("; ")}`,
    );
  }
  return structural.value;
}

function blockedSkeleton(
  fieldConcept: string,
  classificationConfidence: number,
  sensitivityClass: FormFieldDecisionV1["sensitivity_class"],
  extraReasons: readonly FormFieldDecisionV1ReasonCode[],
): DecisionSkeleton {
  return {
    fieldConcept,
    classificationConfidence,
    valueSourceType: "NONE",
    valueConfidence: 0,
    sensitivityClass,
    policyDecision: "UNSUPPORTED",
    finalDecision: "BLOCK_UNSUPPORTED",
    confirmationState: "NOT_REQUIRED",
    reasonCodes: ["UNSUPPORTED_FIELD", ...extraReasons],
  };
}

/**
 * Resolve one canonical descriptor into one canonical decision.
 *
 * Deterministic: identical descriptor + records + correlation ID + ontology
 * version always produce the identical decision. Abstention
 * (BLOCK_UNSUPPORTED / PAUSE_FOR_CONFIRMATION / SKIP_OPTIONAL / PROPOSE) is
 * a successful outcome; there is no best-guess fallback anywhere below.
 */
export async function resolveFieldDecision(
  request: DecisionResolutionRequest,
): Promise<DecisionResolutionOutcome> {
  const structural = validateFormFieldDescriptorV1(request.descriptor);
  if (!structural.valid) {
    return { status: "REJECTED_DESCRIPTOR", errors: structural.errors };
  }
  const descriptor = structural.value;
  const classification = classifyField(descriptor);

  // Concealed or inert controls are never decided into actions: this also
  // covers hidden honeypots, which must never be filled.
  if (!descriptor.visible || !descriptor.enabled) {
    const classified = classification.status === "CLASSIFIED";
    const concept = classified ? classification.concept : UNKNOWN_CONCEPT;
    const confidence = classified ? classification.confidence : 0;
    const sensitivity = classified
      ? conceptRule(classification.concept).sensitivity
      : "PERSONAL";
    const decision = await assembleDecision(
      request,
      blockedSkeleton(concept, confidence, sensitivity, []),
    );
    return {
      status: "RESOLVED",
      resolution: {
        decision,
        classification,
        ontologyVersion: FEASIBILITY_ONTOLOGY_VERSION,
      },
    };
  }

  if (classification.status === "ABSTAINED") {
    // Every abstention family (no concept, conflict, tie, thin evidence,
    // unsupported control) blocks honestly with the UNKNOWN concept; the
    // candidate diagnostics preserve what was considered.
    const decision = await assembleDecision(
      request,
      blockedSkeleton(UNKNOWN_CONCEPT, 0, "PERSONAL", []),
    );
    return {
      status: "RESOLVED",
      resolution: {
        decision,
        classification,
        ontologyVersion: FEASIBILITY_ONTOLOGY_VERSION,
      },
    };
  }

  const rule = conceptRule(classification.concept);
  const record = request.records.get(classification.concept);
  let optionResolution: OptionResolution | undefined;
  if (
    ENUMERABLE_CONTROL_KINDS.has(descriptor.control_kind) &&
    record !== undefined
  ) {
    optionResolution =
      record.valueToken === undefined
        ? { status: "ABSTAINED", reason: "NO_OPTION_SEMANTICS_FOR_VALUE" }
        : resolveIntendedOption(descriptor, rule, record.valueToken);
  }

  const policy = synthesizePolicy({
    rule,
    record,
    classificationBand: classification.band,
    required: descriptor.required,
    optionResolution,
  });

  const decision = await assembleDecision(request, {
    fieldConcept: classification.concept,
    classificationConfidence: classification.confidence,
    valueSourceType: policy.valueSourceType,
    ...(policy.valueSourceRef === undefined
      ? {}
      : { valueSourceRef: policy.valueSourceRef }),
    valueConfidence: policy.valueConfidence,
    sensitivityClass: rule.sensitivity,
    policyDecision: policy.policyDecision,
    finalDecision: policy.finalDecision,
    confirmationState: policy.confirmationState,
    ...(policy.userConfirmationRef === undefined
      ? {}
      : { userConfirmationRef: policy.userConfirmationRef }),
    reasonCodes: policy.reasonCodes,
  });
  return {
    status: "RESOLVED",
    resolution: {
      decision,
      classification,
      ...(optionResolution === undefined ? {} : { optionResolution }),
      ontologyVersion: FEASIBILITY_ONTOLOGY_VERSION,
    },
  };
}
