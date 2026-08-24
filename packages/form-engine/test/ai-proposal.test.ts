// M02-W09 optional AI-proposal boundary matrix A1–A8 (REQ-FORM-017
// feasibility portion): deterministic success is preserved byte-for-byte
// against every model outcome, and only a validated ordinary proposal may
// surface as PROPOSE after a deterministic abstention.
import {
  validateFormFieldDecisionV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";
import { describe, expect, it } from "vitest";

import {
  applyOptionalProposal,
  applyOptionalProposalAttempt,
  conceptAcceptsModelProposal,
  FIELD_PROPOSAL_SCHEMA_VERSION,
  parseFieldProposal,
} from "../src/ai-proposal.ts";
import {
  resolveFieldDecision,
  type DecisionResolutionRequest,
  type FieldDecisionResolution,
} from "../src/decision-resolver.ts";
import { buildDescriptor } from "./support/build-descriptor.ts";
import { loadApprovedRecords, testCorrelationId } from "./support/records.ts";

async function deterministicSuccess(): Promise<{
  request: DecisionResolutionRequest;
  resolution: FieldDecisionResolution;
}> {
  const request: DecisionResolutionRequest = {
    descriptor: await buildDescriptor({
      label: "Email address (required)",
      sectionContext: ["CANDIDATE_DETAILS"],
      required: true,
    }),
    records: await loadApprovedRecords(),
    correlationId: await testCorrelationId(),
  };
  const outcome = await resolveFieldDecision(request);
  if (outcome.status !== "RESOLVED") {
    throw new Error("expected a resolved deterministic decision");
  }
  return { request, resolution: outcome.resolution };
}

async function deterministicAbstention(): Promise<{
  request: DecisionResolutionRequest;
  resolution: FieldDecisionResolution;
}> {
  const request: DecisionResolutionRequest = {
    descriptor: await buildDescriptor({ label: "Favorite synthetic mascot" }),
    records: await loadApprovedRecords(),
    correlationId: await testCorrelationId(),
  };
  const outcome = await resolveFieldDecision(request);
  if (outcome.status !== "RESOLVED") {
    throw new Error("expected a resolved abstention decision");
  }
  return { request, resolution: outcome.resolution };
}

const VALID_PROPOSAL = {
  proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
  concept: "EMAIL_ADDRESS",
  confidence: 0.6,
};

describe("A1–A6 deterministic preservation", () => {
  it("preserves the deterministic resolution unchanged for every model outcome", async () => {
    const { request, resolution } = await deterministicSuccess();
    const baseline = JSON.stringify(resolution.decision);
    const actualTimeout = await applyOptionalProposalAttempt(
      request,
      resolution,
      () => new Promise<never>(() => undefined),
      5,
    ); // A1: a genuinely non-settling injected attempt
    const actualThrownFailure = await applyOptionalProposalAttempt(
      request,
      resolution,
      () => {
        throw new Error("synthetic optional-classifier failure");
      },
      100,
    ); // A2: an actual synchronous throw
    const outcomes = [
      { kind: "RESULT", value: { garbage: true } } as const, // A3 malformed
      {
        kind: "RESULT",
        value: {
          proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
          concept: "PHONE_NUMBER",
          confidence: 0.99,
        },
      } as const, // A4 contradictory concept
      {
        kind: "RESULT",
        value: {
          proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
          concept: "EMAIL_ADDRESS",
          confidence: 0.1,
        },
      } as const, // A5 lower confidence
      { kind: "RESULT", value: VALID_PROPOSAL } as const, // A6 matching
    ];
    for (const merged of [actualTimeout, actualThrownFailure]) {
      expect(merged).toBe(resolution);
      expect(JSON.stringify(merged.decision)).toBe(baseline);
      expect(merged.decision.value_source_type).toBe("USER_RECORD");
    }
    for (const outcome of outcomes) {
      const merged = await applyOptionalProposal(request, resolution, outcome);
      // The SAME object comes back: byte-for-byte preservation, and the
      // deterministic USER_RECORD provenance is never replaced.
      expect(merged).toBe(resolution);
      expect(JSON.stringify(merged.decision)).toBe(baseline);
      expect(merged.decision.value_source_type).toBe("USER_RECORD");
    }
  });
});

describe("A7 proposal after deterministic abstention", () => {
  it("surfaces a validated ordinary proposal as PROPOSE only", async () => {
    const { request, resolution } = await deterministicAbstention();
    const merged = await applyOptionalProposal(request, resolution, {
      kind: "RESULT",
      value: VALID_PROPOSAL,
    });
    expect(merged).not.toBe(resolution);
    expect(merged.decision.final_decision).toBe("PROPOSE");
    expect(merged.decision.final_decision).not.toBe("FILL");
    expect(merged.decision.value_source_type).toBe("MODEL_PROPOSAL");
    expect(merged.decision.field_concept).toBe("EMAIL_ADDRESS");
    expect(merged.decision.classification_confidence).toBeLessThan(0.75);
    expect(merged.decision.reason_codes).toContain("MODEL_PROPOSAL_ONLY");
    const structural = validateFormFieldDecisionV1(merged.decision);
    expect(structural.valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:form:field-decision:v1",
        merged.decision,
      ).valid,
    ).toBe(true);
  });

  it("is deterministic for identical proposals", async () => {
    const { request, resolution } = await deterministicAbstention();
    const first = await applyOptionalProposal(request, resolution, {
      kind: "RESULT",
      value: VALID_PROPOSAL,
    });
    const second = await applyOptionalProposal(request, resolution, {
      kind: "RESULT",
      value: { ...VALID_PROPOSAL },
    });
    expect(JSON.stringify(second.decision)).toBe(
      JSON.stringify(first.decision),
    );
  });
});

describe("A8 malformed or unauthorized proposals after abstention", () => {
  it("keeps the deterministic abstention for every invalid payload", async () => {
    const { request, resolution } = await deterministicAbstention();
    const payloads: readonly unknown[] = [
      null,
      "EMAIL_ADDRESS",
      42,
      [],
      {},
      { concept: "EMAIL_ADDRESS", confidence: 0.6 },
      {
        proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
        concept: "NOT_A_CONCEPT",
        confidence: 0.6,
      },
      {
        proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
        concept: "UNKNOWN",
        confidence: 0.6,
      },
      {
        proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
        concept: "EMAIL_ADDRESS",
        confidence: 1.5,
      },
      {
        proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
        concept: "EMAIL_ADDRESS",
        confidence: Number.NaN,
      },
      {
        proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
        concept: "EMAIL_ADDRESS",
        confidence: 0.6,
        extra: "member",
      },
      {
        proposal_schema_version: "W08_FIELD_PROPOSAL_V0",
        concept: "EMAIL_ADDRESS",
        confidence: 0.6,
      },
    ];
    for (const payload of payloads) {
      const merged = await applyOptionalProposal(request, resolution, {
        kind: "RESULT",
        value: payload,
      });
      expect(merged).toBe(resolution);
      expect(merged.decision.final_decision).toBe("BLOCK_UNSUPPORTED");
    }
  });

  it("never lets a model introduce a sensitive or consequential concept", async () => {
    const { request, resolution } = await deterministicAbstention();
    for (const concept of [
      "DEMOGRAPHIC_DISCLOSURE",
      "SALARY_EXPECTATION",
      "WORK_AUTHORIZATION",
      "SPONSORSHIP_REQUIREMENT",
      "SECURITY_CLEARANCE",
    ]) {
      const merged = await applyOptionalProposal(request, resolution, {
        kind: "RESULT",
        value: {
          proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
          concept,
          confidence: 0.99,
        },
      });
      expect(merged).toBe(resolution);
    }
  });

  it("never lets a proposal weaken a stricter approved-record policy", async () => {
    const { request } = await deterministicAbstention();
    const emailRecord = request.records.get("EMAIL_ADDRESS");
    if (emailRecord === undefined) {
      throw new Error("approved email record is missing");
    }
    const records = new Map(request.records);
    records.set("EMAIL_ADDRESS", {
      ...emailRecord,
      policy: "NEVER_AUTOFILL",
    });
    const hardenedRequest = { ...request, records };
    const outcome = await resolveFieldDecision(hardenedRequest);
    expect(outcome.status).toBe("RESOLVED");
    if (outcome.status !== "RESOLVED") {
      throw new Error("unreachable");
    }
    const merged = await applyOptionalProposal(
      hardenedRequest,
      outcome.resolution,
      { kind: "RESULT", value: VALID_PROPOSAL },
    );
    expect(merged).toBe(outcome.resolution);
    expect(merged.decision.final_decision).toBe("BLOCK_UNSUPPORTED");
    expect(merged.decision.policy_decision).toBe("UNSUPPORTED");
  });

  it("keeps concealed controls blocked regardless of model opinion", async () => {
    const request: DecisionResolutionRequest = {
      descriptor: await buildDescriptor({
        label: "Company website",
        visible: false,
      }),
      records: await loadApprovedRecords(),
      correlationId: await testCorrelationId(),
    };
    const outcome = await resolveFieldDecision(request);
    expect(outcome.status).toBe("RESOLVED");
    if (outcome.status !== "RESOLVED") {
      throw new Error("unreachable");
    }
    const merged = await applyOptionalProposal(request, outcome.resolution, {
      kind: "RESULT",
      value: {
        proposal_schema_version: FIELD_PROPOSAL_SCHEMA_VERSION,
        concept: "WEBSITE_URL",
        confidence: 0.99,
      },
    });
    expect(merged).toBe(outcome.resolution);
    expect(merged.decision.final_decision).toBe("BLOCK_UNSUPPORTED");
  });
});

describe("proposal boundary primitives", () => {
  it("parses only the exact closed proposal shape", () => {
    expect(parseFieldProposal(VALID_PROPOSAL)).toEqual(VALID_PROPOSAL);
    expect(parseFieldProposal({ ...VALID_PROPOSAL, confidence: -0.1 })).toBe(
      null,
    );
    expect(parseFieldProposal(undefined)).toBe(null);
  });

  it("only ordinary unconfirmed concepts accept model proposals", () => {
    expect(conceptAcceptsModelProposal("EMAIL_ADDRESS")).toBe(true);
    expect(conceptAcceptsModelProposal("FIRST_NAME")).toBe(true);
    expect(conceptAcceptsModelProposal("WORK_AUTHORIZATION")).toBe(false);
    expect(conceptAcceptsModelProposal("SALARY_EXPECTATION")).toBe(false);
    expect(conceptAcceptsModelProposal("DEMOGRAPHIC_DISCLOSURE")).toBe(false);
    expect(conceptAcceptsModelProposal("SECURITY_CLEARANCE")).toBe(false);
    expect(conceptAcceptsModelProposal("LICENSE_VALIDITY")).toBe(false);
  });
});
