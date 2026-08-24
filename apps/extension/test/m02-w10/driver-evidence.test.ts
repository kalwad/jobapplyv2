import { describe, expect, test, vi } from "vitest";

import {
  canonicalJson,
  evidenceFromObservation,
  observationsEquivalent,
  optionObservation,
  synthesizeOutcome,
  textObservation,
} from "../../src/driver-evidence.ts";
import {
  SETTLE_SIGNAL_ATTRIBUTE,
  type SettlePolicy,
} from "../../src/driver-protocol.ts";
import { settleWindow } from "../../src/drivers/driver-dom.ts";

describe("redacted semantic driver evidence", () => {
  test("canonical JSON sorts keys recursively and preserves array order", () => {
    expect(canonicalJson({ z: 2, a: { y: 1, x: [3, 2] } })).toBe(
      '{"a":{"x":[3,2],"y":1},"z":2}',
    );
  });

  test("raw text is converted to a digest plus presence at the boundary", async () => {
    const raw = "Synthetic applicant text that must not escape";
    const evidence = await evidenceFromObservation(textObservation(raw));
    expect(evidence.presence).toBe("PRESENT_REDACTED");
    expect(evidence.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(evidence)).not.toContain(raw);
  });

  test("option evidence distinguishes empty from one exact digest", () => {
    const digest = `sha256:${"c".repeat(64)}`;
    expect(optionObservation(null).presence).toBe("EMPTY");
    expect(optionObservation(digest).parts).toEqual([digest]);
    expect(
      observationsEquivalent(
        optionObservation(digest),
        optionObservation(digest),
      ),
    ).toBe(true);
    expect(
      observationsEquivalent(
        optionObservation(digest),
        optionObservation(null),
      ),
    ).toBe(false);
  });
});

describe("closed outcome synthesis", () => {
  test.each([
    [
      "sensitive refusal",
      { phase: "DECISION_REFUSED", sensitive: true } as const,
      "BLOCKED_SENSITIVE",
      "SENSITIVE_ACTION_BLOCKED",
    ],
    [
      "ambiguous resolution",
      {
        phase: "RESOLUTION_FAILED",
        resolution: "AMBIGUOUS",
        documentChanged: false,
      } as const,
      "NEEDS_REVIEW",
      "AMBIGUOUS_RESOLUTION",
    ],
    [
      "unsupported control",
      { phase: "DRIVER_UNSUPPORTED" } as const,
      "UNSUPPORTED",
      "UNSUPPORTED_CONTROL",
    ],
    [
      "action failure",
      { phase: "ACTION_FAILED" } as const,
      "FAILED",
      "ACTION_FAILED",
    ],
    [
      "settle timeout",
      { phase: "SETTLE_TIMEOUT" } as const,
      "NEEDS_REVIEW",
      "PERSISTENCE_NOT_VERIFIED",
    ],
  ])("maps %s without safe retry", (_label, phase, outcome, reason) => {
    const synthesis = synthesizeOutcome(phase);
    expect(synthesis.outcome).toBe(outcome);
    expect(synthesis.reason_codes).toContain(reason);
    expect(synthesis.safe_retry_allowed).toBe(false);
  });

  test("VERIFIED exists only for immediate, settled, and accepted evidence", () => {
    const complete = {
      phase: "COMPLETE" as const,
      immediateMatches: true,
      settledMatches: true,
      siteAcceptance: "ACCEPTED" as const,
      validationMessageCount: 0,
      conditionalFieldsDiscovered: false,
    };
    expect(synthesizeOutcome(complete)).toMatchObject({
      outcome: "VERIFIED",
      persistence_verified: true,
      reason_codes: ["VERIFIED_PERSISTENCE"],
    });
    expect(
      synthesizeOutcome({ ...complete, settledMatches: false }).outcome,
    ).toBe("FAILED");
    expect(
      synthesizeOutcome({ ...complete, siteAcceptance: "REJECTED" }).outcome,
    ).toBe("NEEDS_REVIEW");
    expect(
      synthesizeOutcome({ ...complete, siteAcceptance: "UNKNOWN" }).outcome,
    ).toBe("NEEDS_REVIEW");
  });
});

describe("bounded settle policy", () => {
  test("a deterministic page signal ends bounded polling", async () => {
    vi.useFakeTimers();
    const attributes = new Map<string, string>();
    const document = {
      documentElement: {
        getAttribute(name: string): string | null {
          return attributes.get(name) ?? null;
        },
      },
    } as unknown as Document;
    const policy: SettlePolicy = {
      budget_ms: 100,
      require_page_signal: "READY",
    };
    const pending = settleWindow(document, policy);
    attributes.set(SETTLE_SIGNAL_ATTRIBUTE, "READY");
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({
      signalObserved: true,
      timedOut: false,
    });
    vi.useRealTimers();
  });

  test("a missing signal terminates at the declared bound", async () => {
    vi.useFakeTimers();
    const document = {
      documentElement: { getAttribute: () => null },
    } as unknown as Document;
    const pending = settleWindow(document, {
      budget_ms: 50,
      require_page_signal: "NEVER",
    });
    await vi.advanceTimersByTimeAsync(75);
    await expect(pending).resolves.toMatchObject({
      signalObserved: false,
      timedOut: true,
    });
    vi.useRealTimers();
  });
});
