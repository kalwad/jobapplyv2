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
  reconciliationItemIdentity,
  type CurrentValueComparison,
  type ReconcileFieldEvidence,
} from "../../src/dynamic-reconcile.ts";

import { isCanonicalReconciliationInventory } from "../../src/dynamic-protocol.ts";
import { stableSemanticId } from "../../src/semantic-identity.ts";

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

describe("physical observations with colliding semantic identities", () => {
  const verified = {
    outcome: "VERIFIED",
    decisionConfirmation: "NOT_REQUIRED",
    generationCurrent: true,
    currentValue: "MATCHES_SETTLED",
  } as const;

  test("a required collision stays unresolved and uncertain even with matching verified evidence", () => {
    for (const transaction of [undefined, verified]) {
      const input = evidence({
        identityAmbiguous: true,
        ...(transaction === undefined ? {} : { transaction }),
      });
      expect(classifyField(input)).toEqual({
        category: "REQUIRED_UNRESOLVED",
        document_state: "CURRENT",
        changed_value: false,
        confirmation_state: "NOT_APPLICABLE",
        mandatory_uncertain: true,
        pageChangedDetected: false,
      });
    }
  });

  test("an optional collision is explicitly reviewable and receives no fill credit", () => {
    expect(
      classifyField(
        evidence({
          required: false,
          identityAmbiguous: true,
          transaction: verified,
        }),
      ),
    ).toEqual({
      category: "NEEDS_REVIEW",
      document_state: "CURRENT",
      changed_value: false,
      confirmation_state: "NOT_APPLICABLE",
      mandatory_uncertain: false,
      pageChangedDetected: false,
    });
  });

  test("hidden or disabled collision members stay outside unresolved requirements", () => {
    for (const inactive of [{ visible: false }, { enabled: false }]) {
      const classified = classifyField(
        evidence({
          ...inactive,
          identityAmbiguous: true,
          transaction: verified,
        }),
      );
      expect(classified.category).toBe("UNSUPPORTED_OR_SKIPPED");
      expect(classified.mandatory_uncertain).toBe(false);
    }
  });

  test("every collision member has a distinct report item while unique verified controls remain intact", async () => {
    const duplicate = evidence({
      identityAmbiguous: true,
      transaction: verified,
    });
    const unique = evidence({
      fieldId: "field_1123456789ABCDEFGHJKMNPQRS",
      fieldAddressDigest: DIGEST_B,
      transaction: verified,
    });
    const observations = [duplicate, { ...duplicate }, unique].sort(
      canonicalEvidenceOrder,
    );
    const occurrences = new Map<string, number>();
    const items = await Promise.all(
      observations.map(async (observation) => {
        const base = `${observation.fieldAddressDigest}\0${observation.fieldId}`;
        const occurrence = occurrences.get(base) ?? 0;
        occurrences.set(base, occurrence + 1);
        const classified = classifyField(observation);
        return {
          item_id: await stableSemanticId(
            "item",
            reconciliationItemIdentity(base, occurrence),
          ),
          field_id: observation.fieldId,
          field_address_digest: observation.fieldAddressDigest,
          required: observation.required,
          visible: observation.visible,
          enabled: observation.enabled,
          category: classified.category,
          document_state: classified.document_state,
          changed_value: classified.changed_value,
          confirmation_state: classified.confirmation_state,
          mandatory_uncertain: classified.mandatory_uncertain,
        };
      }),
    );
    expect(items).toHaveLength(3);
    expect(new Set(items.map((item) => item.item_id)).size).toBe(3);
    expect(
      items.filter((item) => item.field_id === duplicate.fieldId),
    ).toHaveLength(2);
    expect(
      items.filter((item) => item.category === "VERIFIED_FILLED"),
    ).toHaveLength(1);
    const counts = computeInventoryCounts(items);
    expect(counts.total).toBe(3);
    expect(counts.required_unresolved).toBe(2);
    expect(counts.mandatory_uncertain).toBe(2);
    expect(counts.verified_filled).toBe(1);
    const inventory = {
      inventory_id: await stableSemanticId("inv", "collision-regression"),
      session_id: await stableSemanticId("session", "collision-regression"),
      page_id: await stableSemanticId("page", "collision-regression"),
      document_id: await stableSemanticId("document", "collision-regression"),
      page_generation: 0,
      proof_generation: 0,
      items,
      counts,
      readiness: computeReadiness(counts, 0, 0),
      evidence_digest: DIGEST_A,
      correlation_id: await stableSemanticId("cor", "collision-regression"),
    };
    expect(inventory.readiness).toBe("NOT_READY");
    expect(isCanonicalReconciliationInventory(inventory)).toBe(true);
    expect(reconciliationItemIdentity("original-unique-item-seed", 0)).toBe(
      "original-unique-item-seed",
    );
    expect(duplicate.fieldId).toBe("field_0123456789ABCDEFGHJKMNPQRS");
  });
});
