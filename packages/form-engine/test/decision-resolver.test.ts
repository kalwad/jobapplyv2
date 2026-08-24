// M02-W09 decision-resolver matrix: canonical FieldDecision validation
// (B1), no page-derived applicant value (B2), no browser-action authority
// (B3), deterministic identity (D1), and the end-to-end abstention/safety
// behavior over frozen-corpus approved records.
import {
  validateFormFieldDecisionV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";
import { describe, expect, it } from "vitest";

import { resolveFieldDecision } from "../src/decision-resolver.ts";
import { buildDescriptor } from "./support/build-descriptor.ts";
import { loadApprovedRecords, testCorrelationId } from "./support/records.ts";

async function resolved(
  descriptorSpec: Parameters<typeof buildDescriptor>[0],
  overrides?: Parameters<typeof loadApprovedRecords>[0],
) {
  const descriptor = await buildDescriptor(descriptorSpec);
  const records = await loadApprovedRecords(overrides);
  const outcome = await resolveFieldDecision({
    descriptor,
    records,
    correlationId: await testCorrelationId(),
  });
  expect(outcome.status).toBe("RESOLVED");
  if (outcome.status !== "RESOLVED") {
    throw new Error("unreachable");
  }
  return outcome.resolution;
}

describe("B1 canonical FieldDecision validation", () => {
  // First test in the file: it absorbs the contract-validator import and
  // fixture digest cost across four complete resolution families, which
  // pushes slower hosted Windows runners past the generic 5 s Vitest
  // default. Nothing in the test intentionally waits.
  it("emits structurally and semantically canonical decisions across outcome families", async () => {
    const resolutions = [
      await resolved({
        label: "Email address (required)",
        sectionContext: ["CANDIDATE_DETAILS"],
        required: true,
      }),
      await resolved({
        label: "Voluntary veteran status (optional)",
        controlKind: "SELECT",
        options: [
          { label: "Prefer not to answer" },
          { label: "I am not a veteran (synthetic option)" },
        ],
      }),
      await resolved({ label: "Favorite synthetic mascot" }),
      await resolved({
        label: "Salary expectation (required)",
        required: true,
      }),
    ];
    for (const resolution of resolutions) {
      const structural = validateFormFieldDecisionV1(resolution.decision);
      expect(structural.valid).toBe(true);
      const semantic = validateSemanticContractV1(
        "urn:japp:schema:form:field-decision:v1",
        resolution.decision,
      );
      expect(semantic.valid).toBe(true);
    }
  }, 15_000);
});

describe("ordinary deterministic flow", () => {
  it("fills a classified ordinary field from the approved synthetic record", async () => {
    const resolution = await resolved({
      label: "Email address (required)",
      sectionContext: ["CANDIDATE_DETAILS"],
      required: true,
    });
    expect(resolution.decision.field_concept).toBe("EMAIL_ADDRESS");
    expect(resolution.decision.final_decision).toBe("FILL");
    expect(resolution.decision.value_source_type).toBe("USER_RECORD");
    expect(resolution.decision.sensitivity_class).toBe("PERSONAL");
    expect(resolution.decision.policy_decision).toBe("PERMIT");
  });

  it("resolves the intended select option semantically before FILL", async () => {
    const resolution = await resolved({
      label: "Preferred work mode (required)",
      controlKind: "SELECT",
      sectionContext: ["CANDIDATE_DETAILS"],
      options: [
        { label: "Select a work mode" },
        { label: "On-site", token: "onsite" },
        { label: "Hybrid", token: "hybrid" },
        { label: "Remote", token: "remote" },
      ],
      required: true,
    });
    expect(resolution.decision.final_decision).toBe("FILL");
    expect(resolution.optionResolution?.status).toBe("RESOLVED");
  });

  it("pauses instead of selecting when no rendered option matches semantically", async () => {
    const resolution = await resolved({
      label: "Preferred work mode (required)",
      controlKind: "SELECT",
      options: [{ label: "Gold tier" }],
      required: true,
    });
    expect(resolution.decision.final_decision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(resolution.decision.final_decision).not.toBe("FILL");
    expect(resolution.optionResolution).toEqual({
      status: "ABSTAINED",
      reason: "NO_SEMANTIC_MATCH",
    });
  });

  it("never fills applicant contact data into a numbered reference section", async () => {
    const resolution = await resolved({
      label: "Email",
      sectionContext: ["REFERENCE_1"],
      required: true,
    });
    expect(resolution.decision.field_concept).toBe("EMAIL_ADDRESS");
    expect(resolution.decision.classification_confidence).toBeLessThan(0.75);
    expect(resolution.decision.final_decision).toBe("PROPOSE");
    expect(resolution.decision.final_decision).not.toBe("FILL");
  });

  it("always reports an unresolved required field instead of guessing", async () => {
    const resolution = await resolved({
      label: "Notice period in weeks (required)",
      required: true,
    });
    // NOTICE_PERIOD has no approved record in the fixture set.
    expect(resolution.decision.final_decision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(resolution.decision.value_source_type).toBe("NONE");
  });
});

describe("sensitive and consequential flow", () => {
  it("keeps voluntary demographics deny-classed and never filled", async () => {
    const resolution = await resolved({
      label: "Voluntary veteran status (optional)",
      controlKind: "SELECT",
      sectionContext: ["VOLUNTARY_AND_ELIGIBILITY_QUESTIONS"],
      options: [
        { label: "Prefer not to answer" },
        { label: "I am not a veteran (synthetic option)" },
        { label: "I identify as a veteran (synthetic option)" },
      ],
    });
    expect(resolution.decision.field_concept).toBe("DEMOGRAPHIC_DISCLOSURE");
    expect(resolution.decision.sensitivity_class).toBe("SENSITIVE");
    expect(resolution.decision.policy_decision).toBe("DENY");
    expect(resolution.decision.final_decision).toBe("SKIP_OPTIONAL");
  });

  it("fills work authorization only through its explicit-record policy and option match", async () => {
    const resolution = await resolved({
      label:
        "Are you legally authorized to work in the country of this synthetic posting? (required)",
      controlKind: "RADIO_GROUP",
      sectionContext: ["VOLUNTARY_AND_ELIGIBILITY_QUESTIONS"],
      options: [
        { label: "Yes", token: "yes" },
        { label: "No", token: "no" },
      ],
      required: true,
    });
    expect(resolution.decision.field_concept).toBe("WORK_AUTHORIZATION");
    // Profile 1 commits FILL_FROM_EXPLICIT_RECORD with recorded AUTHORIZED.
    expect(resolution.decision.final_decision).toBe("FILL");
    expect(resolution.decision.value_source_ref).toBe(
      "fieldrecord_00000000000000000000000001",
    );
    expect(resolution.optionResolution?.status).toBe("RESOLVED");
  });

  it("pauses salary expectations without a valid confirmation", async () => {
    const resolution = await resolved({
      label: "Salary expectation (required)",
      required: true,
    });
    expect(resolution.decision.field_concept).toBe("SALARY_EXPECTATION");
    expect(resolution.decision.sensitivity_class).toBe("SENSITIVE");
    expect(resolution.decision.final_decision).toBe("PAUSE_FOR_CONFIRMATION");
    expect(resolution.decision.reason_codes).toContain(
      "SENSITIVE_CONFIRMATION_REQUIRED",
    );
  });

  it("fills a confirmed sponsorship record and references the confirmation", async () => {
    const resolution = await resolved(
      {
        label: "Do you require visa sponsorship? (required)",
        controlKind: "RADIO_GROUP",
        sectionContext: ["VOLUNTARY_AND_ELIGIBILITY_QUESTIONS"],
        options: [
          { label: "Yes", token: "yes" },
          { label: "No", token: "no" },
        ],
        required: true,
      },
      {
        confirmations: {
          SPONSORSHIP_REQUIREMENT: {
            state: "VALID",
            confirmationRef: "confirm_00000000000000000000000001",
          },
        },
      },
    );
    expect(resolution.decision.field_concept).toBe("SPONSORSHIP_REQUIREMENT");
    expect(resolution.decision.final_decision).toBe("FILL");
    expect(resolution.decision.confirmation_state).toBe("VALID");
    expect(resolution.decision.user_confirmation_ref).toBe(
      "confirm_00000000000000000000000001",
    );
  });
});

describe("abstention and concealment", () => {
  it("blocks an unclassifiable field with the UNKNOWN concept", async () => {
    const resolution = await resolved({ label: "Favorite synthetic mascot" });
    expect(resolution.decision.field_concept).toBe("UNKNOWN");
    expect(resolution.decision.final_decision).toBe("BLOCK_UNSUPPORTED");
    expect(resolution.decision.policy_decision).toBe("UNSUPPORTED");
  });

  it("never fills a concealed honeypot control", async () => {
    const resolution = await resolved({
      label: "Company website",
      visible: false,
    });
    expect(resolution.decision.final_decision).toBe("BLOCK_UNSUPPORTED");
    expect(resolution.decision.value_source_type).toBe("NONE");
  });

  it("never fills a visible classified field that is disabled", async () => {
    const resolution = await resolved({
      label: "Email address (required)",
      enabled: false,
      required: true,
    });
    expect(resolution.decision.field_concept).toBe("EMAIL_ADDRESS");
    expect(resolution.decision.final_decision).toBe("BLOCK_UNSUPPORTED");
  });

  it("rejects a non-canonical descriptor with a typed outcome", async () => {
    const records = await loadApprovedRecords();
    const outcome = await resolveFieldDecision({
      descriptor: { field_id: "not-a-descriptor" } as never,
      records,
      correlationId: await testCorrelationId(),
    });
    expect(outcome.status).toBe("REJECTED_DESCRIPTOR");
  });
});

describe("B2 no page-derived applicant value", () => {
  it("emits decisions carrying only identifiers, digests, and enum tokens", async () => {
    const resolution = await resolved({
      label: "Email address (required)",
      sectionContext: ["CANDIDATE_DETAILS"],
      required: true,
    });
    const serialized = JSON.stringify(resolution.decision);
    // No profile fact, no page label text, no option text may appear.
    expect(serialized).not.toContain("candidate01@example.test");
    expect(serialized).not.toContain("Email address");
    expect(serialized).not.toContain("Synthetic Candidate");
  });
});

describe("B3 no browser-action authority", () => {
  it("returns inert data and never mutates the observed descriptor", async () => {
    const descriptor = await buildDescriptor({
      label: "Email address (required)",
      required: true,
    });
    const before = JSON.stringify(descriptor);
    const records = await loadApprovedRecords();
    const outcome = await resolveFieldDecision({
      descriptor,
      records,
      correlationId: await testCorrelationId(),
    });
    expect(outcome.status).toBe("RESOLVED");
    expect(JSON.stringify(descriptor)).toBe(before);
    if (outcome.status === "RESOLVED") {
      const values = Object.values(outcome.resolution.decision);
      expect(values.every((value) => typeof value !== "function")).toBe(true);
    }
  });
});

describe("D1 deterministic identity", () => {
  it("produces byte-identical decisions for identical inputs", async () => {
    const spec = {
      label: "Preferred work mode (required)",
      controlKind: "SELECT",
      sectionContext: ["CANDIDATE_DETAILS"],
      options: [
        { label: "Select a work mode" },
        { label: "On-site", token: "onsite" },
        { label: "Hybrid", token: "hybrid" },
        { label: "Remote", token: "remote" },
      ],
      required: true,
    } as const;
    const first = await resolved(spec);
    const second = await resolved(spec);
    expect(JSON.stringify(second.decision)).toBe(
      JSON.stringify(first.decision),
    );
    expect(second.decision.decision_id).toBe(first.decision.decision_id);
  });
});
