// M02-W09 safety-policy matrix S1–S5: sensitivity classification controls
// policy, uncertainty never converts into FILL, and record policies can
// only strengthen the catalog floor.
import { describe, expect, it } from "vitest";

import type { ApprovedSyntheticRecord } from "../src/approved-records.ts";
import {
  FEASIBILITY_VALUE_POLICIES,
  conceptRule,
  type FeasibilityConcept,
  type FeasibilityValuePolicy,
} from "../src/ontology.ts";
import {
  effectivePolicy,
  policyClassOf,
  synthesizePolicy,
} from "../src/safety-policy.ts";

function record(
  concept: FeasibilityConcept,
  policy: FeasibilityValuePolicy,
  confirmation: ApprovedSyntheticRecord["confirmation"] = { state: "MISSING" },
  valueToken?: string,
): ApprovedSyntheticRecord {
  return {
    recordId: "fieldrecord_00000000000000000000000001",
    concept,
    ...(valueToken === undefined ? {} : { valueToken }),
    policy,
    confirmation,
    valueConfidence: 1,
  };
}

const VALID_CONFIRMATION: ApprovedSyntheticRecord["confirmation"] = {
  state: "VALID",
  confirmationRef: "confirm_00000000000000000000000001",
};

describe("S1 ordinary concept", () => {
  it("permits FILL only from an approved record with deterministic classification", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("EMAIL_ADDRESS"),
      record: record("EMAIL_ADDRESS", "FILL_FROM_EXPLICIT_RECORD"),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.policyDecision).toBe("PERMIT");
    expect(synthesis.finalDecision).toBe("FILL");
    expect(synthesis.confirmationState).toBe("NOT_REQUIRED");
    expect(synthesis.valueSourceType).toBe("USER_RECORD");
    expect(synthesis.reasonCodes).toContain("DETERMINISTIC_EVIDENCE");
  });

  it("pauses a required ordinary field when no approved record exists", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("EMAIL_ADDRESS"),
      record: undefined,
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(synthesis.confirmationState).toBe("MISSING");
    expect(synthesis.valueSourceType).toBe("NONE");
  });

  it("skips an optional ordinary field when no approved record exists", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("PHONE_NUMBER"),
      record: undefined,
      classificationBand: "DETERMINISTIC",
      required: false,
      optionResolution: undefined,
    });
    expect(synthesis.finalDecision).toBe("SKIP_OPTIONAL");
    expect(synthesis.reasonCodes).toContain("OPTIONAL_UNANSWERED");
  });

  it("proposes instead of filling in the review classification band", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("EMAIL_ADDRESS"),
      record: record("EMAIL_ADDRESS", "FILL_FROM_EXPLICIT_RECORD"),
      classificationBand: "REVIEW",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.finalDecision).toBe("PROPOSE");
    expect(synthesis.valueSourceRef).toBeDefined();
  });
});

describe("S2 work-authorization-like consequential field", () => {
  it("fills from an explicit record under the committed RECORD-class policy", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("WORK_AUTHORIZATION"),
      record: record(
        "WORK_AUTHORIZATION",
        "FILL_FROM_EXPLICIT_RECORD",
        { state: "MISSING" },
        "AUTHORIZED",
      ),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: {
        status: "RESOLVED",
        valueDigest:
          "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        matchedBy: "APPROVED_ALIAS_LABEL",
      },
    });
    expect(synthesis.policyDecision).toBe("PERMIT");
    expect(synthesis.finalDecision).toBe("FILL");
  });

  it("pauses when the confirmation policy has no valid confirmation", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("WORK_AUTHORIZATION"),
      record: record("WORK_AUTHORIZATION", "CONFIRM_ONCE_PER_JOB"),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.policyDecision).toBe("REQUIRE_CONFIRMATION");
    expect(synthesis.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(synthesis.confirmationState).toBe("MISSING");
    expect(synthesis.reasonCodes).toContain("SENSITIVE_CONFIRMATION_REQUIRED");
  });

  it("fills a confirmed record and references the confirmation", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("WORK_AUTHORIZATION"),
      record: record(
        "WORK_AUTHORIZATION",
        "CONFIRM_ONCE_PER_JOB",
        VALID_CONFIRMATION,
      ),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.finalDecision).toBe("FILL");
    expect(synthesis.confirmationState).toBe("VALID");
    expect(synthesis.userConfirmationRef).toBe(
      VALID_CONFIRMATION.confirmationRef,
    );
  });
});

describe("S3 sponsorship-like consequential field", () => {
  it("denies a BLOCK_AND_EXPLAIN record and never fills or proposes", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("SPONSORSHIP_REQUIREMENT"),
      record: record("SPONSORSHIP_REQUIREMENT", "BLOCK_AND_EXPLAIN"),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.policyDecision).toBe("DENY");
    expect(synthesis.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(synthesis.valueSourceType).toBe("NONE");
    expect(synthesis.reasonCodes).toContain("POLICY_DENIED");
  });
});

describe("S4 salary/relocation-like confirmation fields", () => {
  it("escalates SENSITIVE salary out of the unconfirmed RECORD class", () => {
    const rule = conceptRule("SALARY_EXPECTATION");
    expect(
      policyClassOf(
        effectivePolicy(
          rule,
          record("SALARY_EXPECTATION", "FILL_FROM_EXPLICIT_RECORD"),
        ),
      ),
    ).toBe("CONFIRM");
    const synthesis = synthesizePolicy({
      rule,
      record: record("SALARY_EXPECTATION", "FILL_FROM_EXPLICIT_RECORD"),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(synthesis.finalDecision).not.toBe("FILL");
  });

  it("pauses an expired relocation confirmation with the exact reason", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("RELOCATION_PREFERENCE"),
      record: record("RELOCATION_PREFERENCE", "CONFIRM_IF_RECORD_EXPIRED", {
        state: "EXPIRED",
      }),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(synthesis.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(synthesis.confirmationState).toBe("EXPIRED");
    expect(synthesis.reasonCodes).toContain("CONFIRMATION_EXPIRED");
  });
});

describe("S5 voluntary demographics", () => {
  it("cannot be weakened below NEVER_AUTOFILL by any record policy", () => {
    const rule = conceptRule("DEMOGRAPHIC_DISCLOSURE");
    for (const policy of FEASIBILITY_VALUE_POLICIES) {
      expect(
        effectivePolicy(rule, record("DEMOGRAPHIC_DISCLOSURE", policy)),
      ).toBe("NEVER_AUTOFILL");
    }
  });

  it("skips an optional demographic field and pauses a required one", () => {
    const rule = conceptRule("DEMOGRAPHIC_DISCLOSURE");
    const optional = synthesizePolicy({
      rule,
      record: record("DEMOGRAPHIC_DISCLOSURE", "NEVER_AUTOFILL"),
      classificationBand: "DETERMINISTIC",
      required: false,
      optionResolution: undefined,
    });
    expect(optional.policyDecision).toBe("DENY");
    expect(optional.finalDecision).toBe("SKIP_OPTIONAL");
    const required = synthesizePolicy({
      rule,
      record: record("DEMOGRAPHIC_DISCLOSURE", "NEVER_AUTOFILL"),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: undefined,
    });
    expect(required.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
  });
});

describe("policy floor invariants", () => {
  it("never lets a record policy weaken any catalog floor", () => {
    const strictness = (policy: FeasibilityValuePolicy): number =>
      FEASIBILITY_VALUE_POLICIES.indexOf(policy);
    for (const concept of [
      "EMAIL_ADDRESS",
      "WORK_AUTHORIZATION",
      "SALARY_EXPECTATION",
      "DEMOGRAPHIC_DISCLOSURE",
      "SECURITY_CLEARANCE",
      "LICENSE_VALIDITY",
    ] as const) {
      const rule = conceptRule(concept);
      for (const policy of FEASIBILITY_VALUE_POLICIES) {
        const effective = effectivePolicy(rule, record(concept, policy));
        expect(strictness(effective)).toBeGreaterThanOrEqual(
          strictness(rule.minimumPolicy),
        );
        expect(strictness(effective)).toBeGreaterThanOrEqual(
          strictness(policy),
        );
      }
    }
  });

  it("blocks a semantically unmatched option instead of selecting it", () => {
    const synthesis = synthesizePolicy({
      rule: conceptRule("WORK_MODE_PREFERENCE"),
      record: record(
        "WORK_MODE_PREFERENCE",
        "FILL_FROM_EXPLICIT_RECORD",
        { state: "MISSING" },
        "REMOTE",
      ),
      classificationBand: "DETERMINISTIC",
      required: true,
      optionResolution: { status: "ABSTAINED", reason: "NO_SEMANTIC_MATCH" },
    });
    expect(synthesis.finalDecision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(synthesis.valueConfidence).toBe(0);
    expect(synthesis.reasonCodes).toContain("LOW_VALUE_CONFIDENCE");
  });
});
