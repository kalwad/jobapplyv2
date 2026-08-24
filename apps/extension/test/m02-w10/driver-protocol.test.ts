import type {
  FormDriverResultV1,
  FormFieldAddressV1,
  FormFieldDecisionV1,
} from "@japp/contracts/generated";
import { describe, expect, test } from "vitest";

import { fieldAddressDigest } from "../../src/driver-evidence.ts";
import {
  buildExecuteTabRequest,
  decisionAuthorizesExecution,
  DRIVER_PROTOCOL_VERSION,
  EXECUTE_FRAME_KIND,
  isCanonicalDriverResult,
  parseExecuteFrameRequest,
  parseExecuteTabRequest,
  parseIdentifyNavTabResult,
  parseUndoTabRequest,
} from "../../src/driver-protocol.ts";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const SESSION_ID = "session_0123456789ABCDEFGHJKMNPQRS";
const FRAME_ID = "frame_0123456789ABCDEFGHJKMNPQRS";
const DOCUMENT_ID = "document_0123456789ABCDEFGHJKMNPQRS";
const FIELD_ID = "field_0123456789ABCDEFGHJKMNPQRS";
const CORRELATION_ID = "cor_0123456789ABCDEFGHJKMNPQRS";

const address: FormFieldAddressV1 = {
  address_schema_version: "FIELD_ADDRESS_V1",
  session_id: SESSION_ID,
  frame_id: FRAME_ID,
  document_id: DOCUMENT_ID,
  ats_family: "UNKNOWN",
  route_signature: DIGEST_A,
  application_root_fingerprint: DIGEST_B,
  section_path: [],
  repeater_path: [],
  accessible_name_fingerprint: DIGEST_A,
  attribute_fingerprint: DIGEST_B,
  resolution_hints: [
    {
      kind: "CONTROL_KIND",
      value_fingerprint: DIGEST_B,
      stability_class: "PAGE_STABLE",
    },
  ],
  observed_dom_generation: 0,
};

async function canonicalDecision(): Promise<FormFieldDecisionV1> {
  return {
    decision_id: "decision_0123456789ABCDEFGHJKMNPQRS",
    field_id: FIELD_ID,
    field_address_digest: await fieldAddressDigest(address),
    field_concept: "FIRST_NAME",
    classification_confidence: 1,
    value_source_type: "USER_RECORD",
    value_source_ref: "record_0123456789ABCDEFGHJKMNPQRS",
    value_confidence: 1,
    sensitivity_class: "PERSONAL",
    policy_decision: "PERMIT",
    final_decision: "FILL",
    confirmation_state: "NOT_REQUIRED",
    reason_codes: ["REVIEWED_SOURCE"],
    provenance: {
      source_kind: "USER_INPUT",
      source_id: "source_0123456789ABCDEFGHJKMNPQRS",
      observed_at: "2026-08-24T00:00:00Z",
      confidence: 1,
    },
    correlation_id: CORRELATION_ID,
  };
}

async function transaction() {
  return {
    transaction_id: "transaction_0123456789ABCDEFGHJKMNPQRS",
    correlation_id: CORRELATION_ID,
    address,
    decision: await canonicalDecision(),
    intended: { kind: "TEXT" as const, text: "Synthetic value" },
    settle: { budget_ms: 25 },
  };
}

function verifiedResult(): FormDriverResultV1 {
  const evidence = {
    semantic_digest: DIGEST_A,
    presence: "PRESENT_REDACTED" as const,
  };
  return {
    result_id: "result_0123456789ABCDEFGHJKMNPQRS",
    driver_id: "driver_0123456789ABCDEFGHJKMNPQRS",
    session_id: SESSION_ID,
    field_address: address,
    resolution_result: "UNIQUE",
    preconditions: {
      visible: true,
      enabled: true,
      generation_matched: true,
      policy_permitted: true,
    },
    action_attempt: {
      attempt_id: "attempt_0123456789ABCDEFGHJKMNPQRS",
      attempted_at: "2026-08-24T00:00:00Z",
      action_count: 1,
      duration_ms: 25,
      idempotency_key: "idem_0123456789ABCDEFGHJKMNPQRS",
    },
    intended_value: evidence,
    observed_value_immediate: evidence,
    observed_value_settled: evidence,
    site_acceptance: "ACCEPTED",
    validation_message_digests: [],
    conditional_field_ids: [],
    starting_dom_generation: 0,
    settled_dom_generation: 0,
    persistence_verified: true,
    safe_retry_allowed: false,
    outcome: "VERIFIED",
    reason_codes: ["VERIFIED_PERSISTENCE"],
    correlation_id: CORRELATION_ID,
  };
}

describe("closed M02-W10 transaction protocol", () => {
  test("accepts one canonical decision-bound execute request", async () => {
    const request = buildExecuteTabRequest("execute-1", 7, await transaction());
    expect(parseExecuteTabRequest(request)).toEqual(request);
    expect(decisionAuthorizesExecution(request.transaction.decision)).toBe(
      true,
    );
  });

  test.each([
    ["untyped command", { command: "fill" }],
    ["arbitrary selector", { selector: "input:first-child" }],
    ["arbitrary script", { script: "doSomething()" }],
  ])("rejects %s", async (_label, extra) => {
    const request = buildExecuteTabRequest(
      "execute-extra",
      7,
      await transaction(),
    );
    expect(parseExecuteTabRequest({ ...request, ...extra })).toBeNull();
  });

  test("rejects control characters and oversized intended text", async () => {
    const base = await transaction();
    for (const text of ["line\nfeed", "x".repeat(513)]) {
      expect(
        parseExecuteTabRequest(
          buildExecuteTabRequest("execute-text", 7, {
            ...base,
            intended: { kind: "TEXT", text },
          }),
        ),
      ).toBeNull();
    }
  });

  test("rejects invalid calendar dates and unbounded settle windows", async () => {
    const base = await transaction();
    expect(
      parseExecuteTabRequest(
        buildExecuteTabRequest("execute-date", 7, {
          ...base,
          intended: { kind: "DATE", iso_date: "2026-02-29" },
        }),
      ),
    ).toBeNull();
    expect(
      parseExecuteTabRequest(
        buildExecuteTabRequest("execute-settle", 7, {
          ...base,
          settle: { budget_ms: 8001 },
        }),
      ),
    ).toBeNull();
  });

  test("rejects malformed file artifacts before frame routing", async () => {
    const base = await transaction();
    expect(
      parseExecuteFrameRequest({
        kind: EXECUTE_FRAME_KIND,
        protocolVersion: DRIVER_PROTOCOL_VERSION,
        requestId: "bad-file",
        transaction: {
          ...base,
          intended: {
            kind: "FILE",
            file_name: "../escape.pdf",
            media_type: "application/pdf",
            size_bytes: 3,
            artifact_digest: DIGEST_A,
            content_base64: "YWJj",
          },
        },
      }),
    ).toBeNull();
  });

  test("non-FILL and model-only decisions grant no execution authority", async () => {
    const decision = await canonicalDecision();
    expect(
      decisionAuthorizesExecution({
        ...decision,
        value_source_type: "NONE",
        value_confidence: 0,
        policy_decision: "UNSUPPORTED",
        final_decision: "BLOCK_UNSUPPORTED",
        reason_codes: ["UNSUPPORTED_FIELD"],
      }),
    ).toBe(false);
    expect(
      decisionAuthorizesExecution({
        ...decision,
        value_source_type: "MODEL_PROPOSAL",
        final_decision: "PROPOSE",
        reason_codes: ["MODEL_PROPOSAL_ONLY"],
      }),
    ).toBe(false);
  });

  test("undo requests are closed and bind one canonical address", () => {
    const request = {
      kind: "M02_W10_UNDO_TAB",
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: "undo-1",
      tabId: 7,
      undo: {
        transaction_id: "transaction_0123456789ABCDEFGHJKMNPQRS",
        address,
        settle: { budget_ms: 25 },
      },
    };
    expect(parseUndoTabRequest(request)).toEqual(request);
    expect(parseUndoTabRequest({ ...request, selector: "#field" })).toBeNull();
  });

  test("navigation results represent identification only", () => {
    const result = {
      kind: "M02_W10_IDENTIFY_NAV_RESULT",
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: "nav-1",
      outcome: {
        status: "COMPLETED",
        identification: {
          status: "UNIQUE_SAFE_CANDIDATE",
          candidate_count: 1,
          candidate_name_digest: DIGEST_A,
        },
      },
    };
    expect(parseIdentifyNavTabResult(result)).toEqual(result);
    expect(
      parseIdentifyNavTabResult({
        ...result,
        outcome: { ...result.outcome, execute: true },
      }),
    ).toBeNull();
  });
});

describe("canonical FormDriverResultV1 semantics", () => {
  test("accepts the complete verified evidence branch", () => {
    expect(isCanonicalDriverResult(verifiedResult())).toBe(true);
  });

  test.each([
    ["unknown site acceptance", { site_acceptance: "UNKNOWN" }],
    [
      "immediate mismatch",
      {
        observed_value_immediate: {
          semantic_digest: DIGEST_B,
          presence: "PRESENT_REDACTED",
        },
      },
    ],
    [
      "settled mismatch",
      {
        observed_value_settled: {
          semantic_digest: DIGEST_B,
          presence: "PRESENT_REDACTED",
        },
      },
    ],
    ["changed generation", { settled_dom_generation: 1 }],
    ["unsafe retry", { safe_retry_allowed: true }],
  ])("rejects a VERIFIED result with %s", (_label, replacement) => {
    expect(
      isCanonicalDriverResult({ ...verifiedResult(), ...replacement }),
    ).toBe(false);
  });

  test("permits truthful non-verified mismatch while keeping retry disabled", () => {
    const result = {
      ...verifiedResult(),
      observed_value_settled: {
        semantic_digest: DIGEST_B,
        presence: "PRESENT_REDACTED" as const,
      },
      persistence_verified: false,
      outcome: "FAILED" as const,
      reason_codes: [
        "VALUE_MISMATCH" as const,
        "PERSISTENCE_NOT_VERIFIED" as const,
      ],
    };
    expect(isCanonicalDriverResult(result)).toBe(true);
    expect(result.safe_retry_allowed).toBe(false);
  });
});
