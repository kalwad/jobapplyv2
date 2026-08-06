// Pure state-machine truth for the multipage flow and receipts
// (M02-W03): deterministic validation, navigation, CAPTCHA pause,
// duplicate detection, and reset.
import { describe, expect, it } from "vitest";

import {
  applyBack,
  applyNext,
  initialFlowState,
  resetFlow,
  resolveCaptcha,
  validateStage,
  type FlowFields,
} from "../site/src/lab/flow-state.ts";
import {
  applicationKeyFor,
  initialReceiptState,
  receiptIdFor,
  recordSubmission,
} from "../site/src/lab/receipts.ts";

const VALID_FIELDS: FlowFields = {
  fullName: "Avery Applicant",
  email: "avery.applicant@example.test",
  phone: "555-0100",
  position: "fixture-engineer",
  yearsExperience: "4",
  coverNote: "Synthetic note.",
  workAuthorization: "yes",
  relocation: "",
  termsAccepted: true,
};

describe("stage validation", () => {
  it("requires step-1 identity fields with an email shape", () => {
    const empty = validateStage("step-1", initialFlowState().fields);
    expect(empty.map((problem) => problem.field)).toEqual([
      "fullName",
      "email",
    ]);
    const badEmail = validateStage("step-1", {
      ...VALID_FIELDS,
      email: "not-an-email",
    });
    expect(badEmail).toHaveLength(1);
    expect(badEmail[0]?.field).toBe("email");
  });

  it("bounds the optional phone shape without requiring it", () => {
    expect(validateStage("step-1", { ...VALID_FIELDS, phone: "" })).toEqual([]);
    const bad = validateStage("step-1", { ...VALID_FIELDS, phone: "abc" });
    expect(bad[0]?.field).toBe("phone");
  });

  it("requires position and a bounded whole number of years", () => {
    const missing = validateStage("step-2", {
      ...VALID_FIELDS,
      position: "",
      yearsExperience: "",
    });
    expect(missing.map((problem) => problem.field)).toEqual([
      "position",
      "yearsExperience",
    ]);
    expect(
      validateStage("step-2", { ...VALID_FIELDS, yearsExperience: "61" }),
    ).toHaveLength(1);
    expect(
      validateStage("step-2", { ...VALID_FIELDS, yearsExperience: "4.5" }),
    ).toHaveLength(1);
  });

  it("requires the authorization answer and accepted terms on step 3", () => {
    const missing = validateStage("step-3", {
      ...VALID_FIELDS,
      workAuthorization: "",
      termsAccepted: false,
    });
    expect(missing.map((problem) => problem.field)).toEqual([
      "workAuthorization",
      "termsAccepted",
    ]);
  });
});

describe("navigation transitions", () => {
  it("advances step by step and pauses on the CAPTCHA gate", () => {
    let state = initialFlowState();
    const first = applyNext(state, "step-1", VALID_FIELDS);
    expect(first.errors).toEqual([]);
    expect(first.state.stage).toBe("step-2");
    const second = applyNext(first.state, "step-2", {});
    expect(second.state.stage).toBe("step-3");
    const third = applyNext(second.state, "step-3", {});
    expect(third.state.stage).toBe("captcha");
    state = resolveCaptcha(third.state);
    expect(state.stage).toBe("review");
    expect(state.captchaResolved).toBe(true);
  });

  it("keeps edits and blocks the stage when validation fails", () => {
    const outcome = applyNext(initialFlowState(), "step-1", {
      fullName: "Avery Applicant",
    });
    expect(outcome.state.stage).toBe("step-1");
    expect(outcome.state.fields.fullName).toBe("Avery Applicant");
    expect(outcome.errors.some((problem) => problem.field === "email")).toBe(
      true,
    );
  });

  it("skips the CAPTCHA gate once it has been resolved", () => {
    const resolved = {
      ...initialFlowState(),
      fields: VALID_FIELDS,
      captchaResolved: true,
    };
    const outcome = applyNext(resolved, "step-3", {});
    expect(outcome.state.stage).toBe("review");
  });

  it("goes back without validating and preserves edits", () => {
    const state = applyBack(initialFlowState(), "step-3", {
      coverNote: "kept",
    });
    expect(state.stage).toBe("step-2");
    expect(state.fields.coverNote).toBe("kept");
  });

  it("ignores CAPTCHA resolution outside the CAPTCHA stage", () => {
    const state = initialFlowState();
    expect(resolveCaptcha(state)).toBe(state);
  });

  it("resets to the exact initial state", () => {
    expect(resetFlow()).toEqual(initialFlowState());
  });
});

describe("receipts and duplicates", () => {
  it("derives deterministic zero-padded receipt IDs", () => {
    expect(receiptIdFor(1)).toBe("RCPT-MOCK-0001");
    expect(receiptIdFor(42)).toBe("RCPT-MOCK-0042");
    expect(() => receiptIdFor(0)).toThrow();
    expect(() => receiptIdFor(1.5)).toThrow();
  });

  it("keys the synthetic application on email plus position", () => {
    expect(applicationKeyFor(VALID_FIELDS)).toBe(
      "avery.applicant@example.test|fixture-engineer",
    );
    expect(
      applicationKeyFor({
        ...VALID_FIELDS,
        email: " AVERY.APPLICANT@Example.TEST ",
      }),
    ).toBe("avery.applicant@example.test|fixture-engineer");
  });

  it("issues sequential receipts and warns on the duplicate key", () => {
    const first = recordSubmission(initialReceiptState(), "a@example.test|x");
    expect(first.kind).toBe("ISSUED");
    expect(first.receipt.id).toBe("RCPT-MOCK-0001");
    const second = recordSubmission(first.state, "b@example.test|x");
    expect(second.receipt.id).toBe("RCPT-MOCK-0002");
    const duplicate = recordSubmission(second.state, "a@example.test|x");
    expect(duplicate.kind).toBe("DUPLICATE");
    expect(duplicate.receipt.id).toBe("RCPT-MOCK-0001");
    expect(duplicate.state).toBe(second.state);
  });
});
