// M02-W09 optional AI-proposal boundary (REQ-FORM-017 feasibility portion;
// spec §5.11.4 monotonic fallback).
//
// NO live model, provider, endpoint, credential, or network request exists
// here — the provider boundary itself is owned by M05-W03, and experimental
// providers by M27 (docs/EXPERIMENTAL_AI_PROVIDERS.md). This module defines
// the deterministic SEAM a future optional classifier plugs into: model
// output is untrusted candidate data with ZERO authority. It cannot fill,
// click, change sensitivity policy, grant confirmation, override or erase a
// deterministic result, or turn a denied concept into FILL. When the
// deterministic resolver succeeded, the deterministic resolution object is
// returned unchanged — byte-for-byte — for every possible model outcome.
import {
  validateFormFieldDecisionV1,
  validateSemanticContractV1,
  type FormFieldDecisionV1,
} from "@japp/contracts/generated";

import type {
  DecisionResolutionRequest,
  FieldDecisionResolution,
} from "./decision-resolver.ts";
import {
  conceptRule,
  FEASIBILITY_ONTOLOGY_VERSION,
  isFeasibilityConcept,
  type FeasibilityConcept,
} from "./ontology.ts";
import { effectivePolicy, policyClassOf } from "./safety-policy.ts";
import {
  canonicalJson,
  semanticDigest,
  stableSemanticId,
} from "./semantic-digest.ts";

export const FIELD_PROPOSAL_SCHEMA_VERSION = "W09_FIELD_PROPOSAL_V1";

/** Ceiling for model-derived classification confidence: always below the
 * deterministic accept threshold, so a proposal can never masquerade as a
 * deterministic classification. */
export const PROPOSAL_CONFIDENCE_CEILING = 0.7;

/** Feasibility ceiling for an injected optional-classifier attempt. */
export const MAX_PROPOSAL_TIMEOUT_MS = 30_000;

export interface FieldProposal {
  readonly proposal_schema_version: typeof FIELD_PROPOSAL_SCHEMA_VERSION;
  readonly concept: FeasibilityConcept;
  readonly confidence: number;
}

/**
 * Outcomes an optional classifier attempt can produce. TIMEOUT, FAILURE,
 * and malformed RESULT payloads are expected states, not errors.
 */
export type OptionalProposalOutcome =
  | { readonly kind: "NOT_ATTEMPTED" }
  | { readonly kind: "TIMEOUT" }
  | { readonly kind: "FAILURE" }
  | { readonly kind: "RESULT"; readonly value: unknown };

/** Injected fake/future-provider attempt; W09 supplies no live provider. */
export type OptionalProposalAttempt = () => unknown;

/**
 * Own the failure/timeout normalization at the W09 proposal boundary. A
 * synchronous throw or rejected attempt becomes FAILURE, a non-settling
 * attempt becomes TIMEOUT, and neither can escape to erase a deterministic
 * result. The attempt itself is injected; this function performs no network
 * or model call.
 */
export async function attemptOptionalProposal(
  attempt: OptionalProposalAttempt,
  timeoutMs: number,
): Promise<OptionalProposalOutcome> {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_PROPOSAL_TIMEOUT_MS
  ) {
    throw new RangeError(
      `optional proposal timeout must be an integer from 1 through ${String(MAX_PROPOSAL_TIMEOUT_MS)} ms`,
    );
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<OptionalProposalOutcome>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ kind: "TIMEOUT" });
    }, timeoutMs);
  });
  const attempted: Promise<OptionalProposalOutcome> = Promise.resolve()
    .then(attempt)
    .then(
      (value): OptionalProposalOutcome => ({ kind: "RESULT", value }),
      (): OptionalProposalOutcome => ({ kind: "FAILURE" }),
    );
  try {
    return await Promise.race([attempted, timeout]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Strict closed-shape validation of untrusted proposal data. Anything but
 * the exact member set, a cataloged concept, and an in-range confidence is
 * rejected as null.
 */
export function parseFieldProposal(value: unknown): FieldProposal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "concept" ||
    keys[1] !== "confidence" ||
    keys[2] !== "proposal_schema_version" ||
    record.proposal_schema_version !== FIELD_PROPOSAL_SCHEMA_VERSION ||
    typeof record.concept !== "string" ||
    !isFeasibilityConcept(record.concept) ||
    typeof record.confidence !== "number" ||
    !Number.isFinite(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 1
  ) {
    return null;
  }
  return {
    proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
    concept: record.concept,
    confidence: record.confidence,
  };
}

/**
 * A concept may surface as a model proposal only when it is ordinary:
 * non-consequential, at most PERSONAL sensitivity, and in the unconfirmed
 * RECORD policy class. Sensitive, consequential, or denied concepts are
 * never introduced by model output.
 */
export function conceptAcceptsModelProposal(
  concept: FeasibilityConcept,
): boolean {
  const rule = conceptRule(concept);
  return (
    !rule.consequential &&
    (rule.sensitivity === "PUBLIC" ||
      rule.sensitivity === "INTERNAL" ||
      rule.sensitivity === "PERSONAL") &&
    policyClassOf(rule.minimumPolicy) === "RECORD"
  );
}

function deterministicClassificationSucceeded(
  resolution: FieldDecisionResolution,
): boolean {
  return resolution.classification.status === "CLASSIFIED";
}

async function proposalDecision(
  request: DecisionResolutionRequest,
  deterministic: FieldDecisionResolution,
  proposal: FieldProposal,
): Promise<FieldDecisionResolution | null> {
  const rule = conceptRule(proposal.concept);
  // A model proposal cannot weaken a reviewed per-record policy. Catalog
  // eligibility is necessary but not sufficient: the effective policy may
  // have been strengthened to confirmation or deny by the approved record.
  if (
    policyClassOf(
      effectivePolicy(rule, request.records.get(proposal.concept)),
    ) !== "RECORD"
  ) {
    return null;
  }
  const base = deterministic.decision;
  const proposalRef = await stableSemanticId(
    "proposal",
    `w09-proposal-v1\0${FEASIBILITY_ONTOLOGY_VERSION}\0${base.field_address_digest}\0${canonicalJson(proposal)}`,
  );
  const decisionId = await stableSemanticId(
    "decision",
    `w09-proposal-decision-v1\0${FEASIBILITY_ONTOLOGY_VERSION}\0${base.field_address_digest}\0${await semanticDigest(canonicalJson(proposal))}\0${base.correlation_id}`,
  );
  const confidence = Math.min(proposal.confidence, PROPOSAL_CONFIDENCE_CEILING);
  const decision: FormFieldDecisionV1 = {
    decision_id: decisionId,
    field_id: base.field_id,
    field_address_digest: base.field_address_digest,
    field_concept: proposal.concept,
    classification_confidence: confidence,
    value_source_type: "MODEL_PROPOSAL",
    value_source_ref: proposalRef,
    value_confidence: 0,
    sensitivity_class: rule.sensitivity,
    policy_decision: "PERMIT",
    final_decision: "PROPOSE",
    confirmation_state: "NOT_REQUIRED",
    reason_codes:
      confidence < 0.5
        ? [
            "MODEL_PROPOSAL_ONLY",
            "LOW_CLASSIFICATION_CONFIDENCE",
            "LOW_VALUE_CONFIDENCE",
          ]
        : ["MODEL_PROPOSAL_ONLY", "LOW_VALUE_CONFIDENCE"],
    provenance: base.provenance,
    correlation_id: base.correlation_id,
    ...(base.causation_id === undefined
      ? {}
      : { causation_id: base.causation_id }),
  };
  const structural = validateFormFieldDecisionV1(decision);
  if (!structural.valid) {
    return null;
  }
  const semantic = validateSemanticContractV1(
    "urn:japp:schema:form:field-decision:v1",
    decision,
  );
  if (!semantic.valid) {
    return null;
  }
  return {
    decision: structural.value,
    classification: deterministic.classification,
    ontologyVersion: deterministic.ontologyVersion,
  };
}

/**
 * Monotonic merge of an optional model outcome into a deterministic
 * resolution.
 *
 * Invariants (REQ-FORM-017 feasibility portion):
 * - A successful deterministic classification is returned UNCHANGED (the
 *   same object reference, hence byte-identical) for every outcome kind —
 *   timeout, failure, malformed output, contradictory concept, matching
 *   concept, higher or lower confidence. Deterministic provenance is never
 *   replaced by MODEL_PROPOSAL.
 * - When the deterministic resolver abstained, a RESULT may surface as a
 *   PROPOSE-only decision iff it validates against the closed proposal
 *   shape, names a cataloged ordinary concept, and its decision passes the
 *   canonical structural and authority validators. It never becomes FILL.
 * - Every other outcome leaves the deterministic abstention unchanged.
 */
export async function applyOptionalProposal(
  request: DecisionResolutionRequest,
  deterministic: FieldDecisionResolution,
  outcome: OptionalProposalOutcome,
): Promise<FieldDecisionResolution> {
  if (deterministicClassificationSucceeded(deterministic)) {
    return deterministic;
  }
  if (outcome.kind !== "RESULT") {
    return deterministic;
  }
  const proposal = parseFieldProposal(outcome.value);
  if (proposal === null || !conceptAcceptsModelProposal(proposal.concept)) {
    return deterministic;
  }
  // Concealed or inert controls stay blocked regardless of model opinion.
  if (!request.descriptor.visible || !request.descriptor.enabled) {
    return deterministic;
  }
  const proposed = await proposalDecision(request, deterministic, proposal);
  return proposed ?? deterministic;
}

/**
 * Integrated injected-attempt seam: normalize actual timeout/throw behavior,
 * then apply the monotonic merge. This is the boundary future provider code
 * must use; successful deterministic decisions remain unchanged for every
 * normalized attempt outcome.
 */
export async function applyOptionalProposalAttempt(
  request: DecisionResolutionRequest,
  deterministic: FieldDecisionResolution,
  attempt: OptionalProposalAttempt,
  timeoutMs: number,
): Promise<FieldDecisionResolution> {
  return applyOptionalProposal(
    request,
    deterministic,
    await attemptOptionalProposal(attempt, timeoutMs),
  );
}
