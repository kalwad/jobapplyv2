// M02-W09 deterministic safety policy (spec §7.6; canonical
// FIELD_DECISION_AUTHORITY vocabulary).
//
// Sensitivity classification CONTROLS policy; it never supplies a value.
// Every branch here is a closed deterministic mapping onto the canonical
// policy_decision / final_decision / confirmation_state / reason_code
// vocabulary, and no branch converts uncertainty into FILL.
import type {
  CommonStableIdV1StableId,
  FormFieldDecisionV1ConfirmationState,
  FormFieldDecisionV1FinalDecision,
  FormFieldDecisionV1PolicyDecision,
  FormFieldDecisionV1ReasonCode,
  FormFieldDecisionV1ValueSourceType,
} from "@japp/contracts/generated";

import type { ApprovedSyntheticRecord } from "./approved-records.ts";
import type { OptionResolution } from "./option-resolver.ts";
import type { ConceptRule, FeasibilityValuePolicy } from "./ontology.ts";
import { strictestPolicy } from "./ontology.ts";

/**
 * Minimum confidences the canonical FIELD_DECISION_AUTHORITY rule requires
 * for FILL; reused here so policy synthesis can never emit a FILL the
 * canonical semantic validator would reject.
 */
export const FILL_CLASSIFICATION_MINIMUM = 0.75;
export const FILL_VALUE_MINIMUM = 0.75;

export type PolicyClass = "RECORD" | "CONFIRM" | "DENY";

export function policyClassOf(policy: FeasibilityValuePolicy): PolicyClass {
  switch (policy) {
    case "FILL_FROM_EXPLICIT_RECORD":
      return "RECORD";
    case "CONFIRM_IF_RECORD_EXPIRED":
    case "CONFIRM_ONCE_PER_JOB":
      return "CONFIRM";
    case "VOLUNTARY_PREFER_NOT_TO_ANSWER":
    case "BLOCK_AND_EXPLAIN":
    case "NEVER_AUTOFILL":
      return "DENY";
  }
}

/**
 * Effective policy: the stricter of the catalog floor and the approved
 * record's reviewed policy, then escalated so SENSITIVE/SECRET concepts can
 * never sit in the unconfirmed RECORD class.
 */
export function effectivePolicy(
  rule: ConceptRule,
  record: ApprovedSyntheticRecord | undefined,
): FeasibilityValuePolicy {
  let policy = rule.minimumPolicy;
  if (record !== undefined) {
    policy = strictestPolicy(policy, record.policy);
  }
  if (
    (rule.sensitivity === "SENSITIVE" || rule.sensitivity === "SECRET") &&
    policyClassOf(policy) === "RECORD"
  ) {
    policy = strictestPolicy(policy, "CONFIRM_ONCE_PER_JOB");
  }
  return policy;
}

export interface PolicySynthesisInput {
  readonly rule: ConceptRule;
  readonly record: ApprovedSyntheticRecord | undefined;
  readonly classificationBand: "DETERMINISTIC" | "REVIEW";
  readonly required: boolean;
  /** Undefined when the control kind carries no enumerable options. */
  readonly optionResolution: OptionResolution | undefined;
}

export interface PolicySynthesis {
  readonly policyDecision: FormFieldDecisionV1PolicyDecision;
  readonly finalDecision: FormFieldDecisionV1FinalDecision;
  readonly confirmationState: FormFieldDecisionV1ConfirmationState;
  readonly userConfirmationRef?: CommonStableIdV1StableId;
  readonly valueSourceType: FormFieldDecisionV1ValueSourceType;
  readonly valueSourceRef?: CommonStableIdV1StableId;
  readonly valueConfidence: number;
  readonly reasonCodes: readonly FormFieldDecisionV1ReasonCode[];
}

function reasons(
  ...codes: readonly (FormFieldDecisionV1ReasonCode | undefined)[]
): readonly FormFieldDecisionV1ReasonCode[] {
  const unique: FormFieldDecisionV1ReasonCode[] = [];
  for (const code of codes) {
    if (code !== undefined && !unique.includes(code)) {
      unique.push(code);
    }
  }
  return unique;
}

function confirmationReason(
  state: "MISSING" | "EXPIRED" | "REVOKED",
): FormFieldDecisionV1ReasonCode {
  switch (state) {
    case "MISSING":
      return "CONFIRMATION_MISSING";
    case "EXPIRED":
      return "CONFIRMATION_EXPIRED";
    case "REVOKED":
      return "CONFIRMATION_REVOKED";
  }
}

/**
 * Synthesize the canonical policy fields for a CLASSIFIED field. The
 * BLOCK_UNSUPPORTED family (abstained classification, invisible or disabled
 * controls, unsupported kinds) is owned by the decision resolver and never
 * reaches this function.
 */
export function synthesizePolicy(input: PolicySynthesisInput): PolicySynthesis {
  const { rule, record, classificationBand, required, optionResolution } =
    input;
  const policy = effectivePolicy(rule, record);
  const policyClass = policyClassOf(policy);
  const sensitiveConfirmation =
    policyClass === "CONFIRM" ||
    rule.sensitivity === "SENSITIVE" ||
    rule.sensitivity === "SECRET";

  if (policyClass === "DENY") {
    // Denied concepts never expose a value source, and uncertainty about
    // them is resolved by the user, never by automation.
    if (required) {
      return {
        policyDecision: "DENY",
        finalDecision: "PAUSE_FOR_CONFIRMATION",
        confirmationState: "MISSING",
        valueSourceType: "NONE",
        valueConfidence: 0,
        reasonCodes: reasons(
          "POLICY_DENIED",
          "CONFIRMATION_MISSING",
          sensitiveConfirmation ? "SENSITIVE_CONFIRMATION_REQUIRED" : undefined,
          "LOW_VALUE_CONFIDENCE",
        ),
      };
    }
    return {
      policyDecision: "DENY",
      finalDecision: "SKIP_OPTIONAL",
      confirmationState: "NOT_REQUIRED",
      valueSourceType: "NONE",
      valueConfidence: 0,
      reasonCodes: reasons(
        "POLICY_DENIED",
        "OPTIONAL_UNANSWERED",
        "LOW_VALUE_CONFIDENCE",
      ),
    };
  }

  const policyDecision: FormFieldDecisionV1PolicyDecision =
    policyClass === "CONFIRM" ? "REQUIRE_CONFIRMATION" : "PERMIT";
  const sensitiveReason: FormFieldDecisionV1ReasonCode | undefined =
    sensitiveConfirmation ? "SENSITIVE_CONFIRMATION_REQUIRED" : undefined;

  if (record === undefined) {
    // Approved value missing: nothing may be invented from page text.
    if (required) {
      return {
        policyDecision,
        finalDecision: "PAUSE_FOR_CONFIRMATION",
        confirmationState: "MISSING",
        valueSourceType: "NONE",
        valueConfidence: 0,
        reasonCodes: reasons(
          sensitiveReason,
          "CONFIRMATION_MISSING",
          "LOW_VALUE_CONFIDENCE",
        ),
      };
    }
    return {
      policyDecision,
      finalDecision: "SKIP_OPTIONAL",
      confirmationState: "NOT_REQUIRED",
      valueSourceType: "NONE",
      valueConfidence: 0,
      reasonCodes: reasons(
        sensitiveReason,
        "OPTIONAL_UNANSWERED",
        "LOW_VALUE_CONFIDENCE",
      ),
    };
  }

  const optionBlocked =
    optionResolution !== undefined && optionResolution.status !== "RESOLVED";
  const valueConfidence = optionBlocked ? 0 : record.valueConfidence;
  const confirmed =
    record.confirmation.state === "VALID" &&
    record.confirmation.confirmationRef !== undefined;

  if (policyClass === "CONFIRM" && !confirmed) {
    const state = record.confirmation.state;
    const pauseState: "MISSING" | "EXPIRED" | "REVOKED" =
      state === "VALID" ? "MISSING" : state;
    return {
      policyDecision,
      finalDecision: "PAUSE_FOR_CONFIRMATION",
      confirmationState: pauseState,
      valueSourceType: "USER_RECORD",
      valueSourceRef: record.recordId,
      valueConfidence,
      reasonCodes: reasons(
        sensitiveReason,
        confirmationReason(pauseState),
        valueConfidence < 0.5 ? "LOW_VALUE_CONFIDENCE" : undefined,
      ),
    };
  }

  const confirmationState: FormFieldDecisionV1ConfirmationState = confirmed
    ? "VALID"
    : "NOT_REQUIRED";
  const confirmationRef = confirmed
    ? record.confirmation.confirmationRef
    : undefined;

  if (
    classificationBand === "DETERMINISTIC" &&
    !optionBlocked &&
    valueConfidence >= FILL_VALUE_MINIMUM
  ) {
    return {
      policyDecision,
      finalDecision: "FILL",
      confirmationState,
      ...(confirmationRef === undefined
        ? {}
        : { userConfirmationRef: confirmationRef }),
      valueSourceType: "USER_RECORD",
      valueSourceRef: record.recordId,
      valueConfidence,
      reasonCodes: reasons(
        "DETERMINISTIC_EVIDENCE",
        "REVIEWED_SOURCE",
        sensitiveReason,
      ),
    };
  }

  if (optionBlocked) {
    // The concept and value are approved but no rendered option matches
    // semantically: pause for the user instead of selecting anything.
    return {
      policyDecision,
      finalDecision: "PAUSE_FOR_CONFIRMATION",
      confirmationState: confirmed ? "VALID" : "MISSING",
      ...(confirmationRef === undefined
        ? {}
        : { userConfirmationRef: confirmationRef }),
      valueSourceType: "USER_RECORD",
      valueSourceRef: record.recordId,
      valueConfidence: 0,
      reasonCodes: reasons(
        sensitiveReason,
        confirmed ? undefined : "CONFIRMATION_MISSING",
        "LOW_VALUE_CONFIDENCE",
      ),
    };
  }

  // Review band, or a value below the canonical FILL floor: surface a
  // reviewable proposal that references the approved record; never FILL.
  return {
    policyDecision,
    finalDecision: "PROPOSE",
    confirmationState,
    ...(confirmationRef === undefined
      ? {}
      : { userConfirmationRef: confirmationRef }),
    valueSourceType: "USER_RECORD",
    valueSourceRef: record.recordId,
    valueConfidence,
    reasonCodes: reasons(
      "REVIEWED_SOURCE",
      sensitiveReason,
      classificationBand === "REVIEW"
        ? "LOW_CLASSIFICATION_CONFIDENCE"
        : undefined,
      valueConfidence < 0.5 ? "LOW_VALUE_CONFIDENCE" : undefined,
    ),
  };
}
