// M02-W11 pure reconciliation-classifier proofs (REQ-FORM-024 feasibility
// portion): total deterministic classification, canonical-rule invariants
// over the exhaustive evidence space, hidden/sensitive safety, page-changed
// detection, count recompute, and readiness floor.
import { describe, expect, test } from "vitest";

import {
  canonicalEvidenceOrder,
  classifyField,
  computeInventoryCounts,
  computeReadiness,
  type CurrentValueComparison,
  type ReconcileFieldEvidence,
} from "../../src/dynamic-reconcile.ts";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;

function evidence(
  overrides: Partial<ReconcileFieldEvidence> = {},
): ReconcileFieldEvidence {
  return {
    fieldId: "field_0123456789ABCDEFGHJKMNPQRS",
    fieldAddressDigest: DIGEST_A,
    required: true,
    visible: true,
    enabled: true,
    validationRejected: false,
    ...overrides,
  };
}

const OUTCOMES = [
  "BLOCKED_SENSITIVE",
  "FAILED",
  "NEEDS_REVIEW",
  "UNSUPPORTED",
  "VERIFIED",
] as const;
const CONFIRMATIONS = [
  "EXPIRED",
  "MISSING",
  "NOT_REQUIRED",
  "REVOKED",
  "VALID",
] as const;
const COMPARISONS: readonly CurrentValueComparison[] = [
  "MATCHES_SETTLED",
  "DIFFERS",
  "UNRESOLVED",
  "AMBIGUOUS",
  "NOT_CHECKED",
];

/** Every representable evidence summary, exhaustively enumerated. */
function evidenceSpace(): ReconcileFieldEvidence[] {
  const space: ReconcileFieldEvidence[] = [];
  for (const required of [true, false]) {
    for (const visible of [true, false]) {
      for (const enabled of [true, false]) {
        for (const validationRejected of [true, false]) {
          space.push(
            evidence({ required, visible, enabled, validationRejected }),
          );
          for (const outcome of OUTCOMES) {
            for (const decisionConfirmation of CONFIRMATIONS) {
              for (const generationCurrent of [true, false]) {
                for (const currentValue of COMPARISONS) {
                  space.push(
                    evidence({
                      required,
                      visible,
                      enabled,
                      validationRejected,
                      transaction: {
                        outcome,
                        decisionConfirmation,
                        generationCurrent,
                        currentValue,
                      },
                    }),
                  );
                }
              }
            }
          }
        }
      }
    }
  }
  return space;
}

describe("canonical invariants over the exhaustive evidence space", () => {
  const space = evidenceSpace();

  test("the space is the expected exhaustive size", () => {
    expect(space).toHaveLength(16 + 16 * 5 * 5 * 2 * 5);
  });

  test("required visible enabled fields only classify into the three canonical categories", () => {
    for (const entry of space.filter(
      (candidate) =>
        candidate.required && candidate.visible && candidate.enabled,
    )) {
      const classified = classifyField(entry);
      expect(
        ["VERIFIED_FILLED", "REQUIRED_UNRESOLVED", "BLOCKED_SENSITIVE"],
        JSON.stringify(entry),
      ).toContain(classified.category);
    }
  });

  test("changed_value is true exactly for PAGE_CHANGED_VALUE", () => {
    for (const entry of space) {
      const classified = classifyField(entry);
      expect(classified.changed_value).toBe(
        classified.category === "PAGE_CHANGED_VALUE",
      );
    }
  });

  test("a concealed or disabled control is never an unresolved requirement", () => {
    for (const entry of space.filter(
      (candidate) => !candidate.visible || !candidate.enabled,
    )) {
      const classified = classifyField(entry);
      expect(classified.category).toBe("UNSUPPORTED_OR_SKIPPED");
      expect(classified.document_state).toBe("NOT_APPLICABLE");
      expect(classified.mandatory_uncertain).toBe(false);
    }
  });

  test("classification is deterministic", () => {
    for (const entry of space) {
      expect(classifyField(entry)).toEqual(classifyField(entry));
    }
  });

  test("no field ever silently disappears: every summary receives a category", () => {
    const categories = new Set(
      space.map((entry) => classifyField(entry).category),
    );
    for (const category of [
      "VERIFIED_FILLED",
      "NEEDS_REVIEW",
      "BLOCKED_SENSITIVE",
      "UNSUPPORTED_OR_SKIPPED",
      "REQUIRED_UNRESOLVED",
      "PAGE_CHANGED_VALUE",
    ]) {
      expect([...categories]).toContain(category);
    }
  });
});

describe("named classification behaviors", () => {
  test("a required field without any evidence is REQUIRED_UNRESOLVED", () => {
    const classified = classifyField(evidence());
    expect(classified.category).toBe("REQUIRED_UNRESOLVED");
    expect(classified.confirmation_state).toBe("NOT_APPLICABLE");
  });

  test("an optional unsupported field is explicitly UNSUPPORTED_OR_SKIPPED", () => {
    expect(classifyField(evidence({ required: false })).category).toBe(
      "UNSUPPORTED_OR_SKIPPED",
    );
  });

  test("a dynamically inserted hidden honeypot stays skipped even when marked required", () => {
    const classified = classifyField(evidence({ visible: false }));
    expect(classified.category).toBe("UNSUPPORTED_OR_SKIPPED");
  });

  test("a blocked sensitive refusal is preserved and never upgraded", () => {
    for (const required of [true, false]) {
      const classified = classifyField(
        evidence({
          required,
          transaction: {
            outcome: "BLOCKED_SENSITIVE",
            decisionConfirmation: "MISSING",
            generationCurrent: true,
            currentValue: "NOT_CHECKED",
          },
        }),
      );
      expect(classified.category).toBe("BLOCKED_SENSITIVE");
      expect(classified.confirmation_state).toBe("MISSING");
    }
  });

  test("a verified unchanged field is VERIFIED_FILLED", () => {
    const classified = classifyField(
      evidence({
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: true,
          currentValue: "MATCHES_SETTLED",
        },
      }),
    );
    expect(classified.category).toBe("VERIFIED_FILLED");
    expect(classified.document_state).toBe("CURRENT");
    expect(classified.pageChangedDetected).toBe(false);
  });

  test("a page-changed verified optional field is PAGE_CHANGED_VALUE", () => {
    const classified = classifyField(
      evidence({
        required: false,
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: true,
          currentValue: "DIFFERS",
        },
      }),
    );
    expect(classified.category).toBe("PAGE_CHANGED_VALUE");
    expect(classified.changed_value).toBe(true);
    expect(classified.pageChangedDetected).toBe(true);
  });

  test("a page-changed verified required field collapses to REQUIRED_UNRESOLVED and is still detected", () => {
    const classified = classifyField(
      evidence({
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: true,
          currentValue: "DIFFERS",
        },
      }),
    );
    expect(classified.category).toBe("REQUIRED_UNRESOLVED");
    expect(classified.changed_value).toBe(false);
    expect(classified.pageChangedDetected).toBe(true);
  });

  test("site rejection after a verified fill removes the clean state", () => {
    const rejected = classifyField(
      evidence({
        validationRejected: true,
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: true,
          currentValue: "MATCHES_SETTLED",
        },
      }),
    );
    expect(rejected.category).toBe("REQUIRED_UNRESOLVED");
    const optionalRejected = classifyField(
      evidence({
        required: false,
        validationRejected: true,
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: true,
          currentValue: "MATCHES_SETTLED",
        },
      }),
    );
    expect(optionalRejected.category).toBe("NEEDS_REVIEW");
  });

  test("older-generation evidence is STALE and never carries verified state", () => {
    const classified = classifyField(
      evidence({
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: false,
          currentValue: "NOT_CHECKED",
        },
      }),
    );
    expect(classified.category).toBe("REQUIRED_UNRESOLVED");
    expect(classified.document_state).toBe("STALE");
  });

  test("an ambiguous current re-resolution marks a required field uncertain", () => {
    const classified = classifyField(
      evidence({
        transaction: {
          outcome: "VERIFIED",
          decisionConfirmation: "NOT_REQUIRED",
          generationCurrent: true,
          currentValue: "AMBIGUOUS",
        },
      }),
    );
    expect(classified.category).toBe("REQUIRED_UNRESOLVED");
    expect(classified.mandatory_uncertain).toBe(true);
  });

  test("decision confirmation states map onto canonical item confirmations", () => {
    const expectations = [
      ["VALID", "CONFIRMED"],
      ["NOT_REQUIRED", "NOT_APPLICABLE"],
      ["EXPIRED", "EXPIRED"],
      ["MISSING", "MISSING"],
      ["REVOKED", "REVOKED"],
    ] as const;
    for (const [decisionConfirmation, expected] of expectations) {
      const classified = classifyField(
        evidence({
          transaction: {
            outcome: "NEEDS_REVIEW",
            decisionConfirmation,
            generationCurrent: true,
            currentValue: "NOT_CHECKED",
          },
        }),
      );
      expect(classified.confirmation_state).toBe(expected);
    }
  });
});

describe("counts and readiness recompute", () => {
  const baseItem = {
    item_id: "item_0123456789ABCDEFGHJKMNPQRS",
    field_id: "field_0123456789ABCDEFGHJKMNPQRS",
    field_address_digest: DIGEST_A,
    required: true,
    visible: true,
    enabled: true,
    category: "VERIFIED_FILLED" as const,
    document_state: "CURRENT" as const,
    changed_value: false,
    confirmation_state: "NOT_APPLICABLE" as const,
    mandatory_uncertain: false,
  };

  test("counts are recomputed exactly from items", () => {
    const items = [
      baseItem,
      {
        ...baseItem,
        item_id: "item_1123456789ABCDEFGHJKMNPQRS",
        category: "REQUIRED_UNRESOLVED" as const,
      },
      {
        ...baseItem,
        item_id: "item_2123456789ABCDEFGHJKMNPQRS",
        required: false,
        category: "PAGE_CHANGED_VALUE" as const,
        changed_value: true,
      },
      {
        ...baseItem,
        item_id: "item_3123456789ABCDEFGHJKMNPQRS",
        category: "BLOCKED_SENSITIVE" as const,
        confirmation_state: "MISSING" as const,
        document_state: "STALE" as const,
        mandatory_uncertain: true,
      },
    ];
    expect(computeInventoryCounts(items)).toEqual({
      total: 4,
      verified_filled: 1,
      needs_review: 0,
      blocked_sensitive: 1,
      unsupported_or_skipped: 0,
      required_unresolved: 1,
      page_changed_value: 1,
      stale_document: 1,
      unconfirmed_consequential: 1,
      mandatory_uncertain: 1,
    });
  });

  test("readiness floor: unresolved required or page-changed values always block READY", () => {
    const clean = computeInventoryCounts([baseItem]);
    expect(computeReadiness(clean, 3, 3)).toBe("READY");
    expect(computeReadiness(clean, 3, 2)).toBe("NOT_READY");
    expect(computeReadiness({ ...clean, required_unresolved: 1 }, 3, 3)).toBe(
      "NOT_READY",
    );
    expect(computeReadiness({ ...clean, page_changed_value: 1 }, 3, 3)).toBe(
      "NOT_READY",
    );
    expect(computeReadiness({ ...clean, blocked_sensitive: 1 }, 3, 3)).toBe(
      "NOT_READY",
    );
    expect(computeReadiness({ ...clean, stale_document: 1 }, 3, 3)).toBe(
      "NOT_READY",
    );
    expect(
      computeReadiness({ ...clean, unconfirmed_consequential: 1 }, 3, 3),
    ).toBe("NOT_READY");
    expect(computeReadiness({ ...clean, mandatory_uncertain: 1 }, 3, 3)).toBe(
      "NOT_READY",
    );
    // NEEDS_REVIEW on an optional field does not block canonical readiness.
    expect(computeReadiness({ ...clean, needs_review: 2 }, 3, 3)).toBe("READY");
  });
});

describe("canonical ordering", () => {
  test("ordering is canonical over address digest then field id and input-order independent", () => {
    const first = evidence({ fieldAddressDigest: DIGEST_A });
    const second = evidence({
      fieldAddressDigest: DIGEST_B,
      fieldId: "field_1123456789ABCDEFGHJKMNPQRS",
    });
    const third = evidence({
      fieldAddressDigest: DIGEST_B,
      fieldId: "field_2123456789ABCDEFGHJKMNPQRS",
    });
    const sortedOne = [third, first, second].sort(canonicalEvidenceOrder);
    const sortedTwo = [second, third, first].sort(canonicalEvidenceOrder);
    expect(sortedOne).toEqual([first, second, third]);
    expect(sortedTwo).toEqual(sortedOne);
  });
});
