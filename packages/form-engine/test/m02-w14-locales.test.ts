import { describe, expect, it } from "vitest";
import { classifyField } from "../src/field-classifier.ts";
import { normalizeEvidence } from "../src/evidence-text.ts";
import { buildApprovedRecordSet } from "../src/approved-records.ts";
import { resolveFieldDecision } from "../src/decision-resolver.ts";
import { buildDescriptor } from "./support/build-descriptor.ts";

const addressLabels = [
  ["Street", "ADDRESS_LINE_1"],
  ["Strasse", "ADDRESS_LINE_1"],
  ["Adresse", "ADDRESS_LINE_1"],
  ["Postleitzahl", "ADDRESS_POSTAL_CODE"],
  ["Code postal", "ADDRESS_POSTAL_CODE"],
] as const;

describe("W14 independently authored W12 address labels", () => {
  for (const [label, concept] of addressLabels) {
    it(`recognizes ${label} without deriving a value`, async () => {
      const descriptor = await buildDescriptor({
        label,
        sectionContext: ["ADDRESS"],
      });
      expect(classifyField(descriptor)).toMatchObject({
        status: "CLASSIFIED",
        concept,
        band: "DETERMINISTIC",
      });
    });
  }
  for (const label of [
    "Employer Strasse",
    "Arbeitgeber Strasse",
    "Adresse employeur",
    "Recruiter Code postal",
  ]) {
    it(`abstains from other-party contact evidence: ${label}`, async () => {
      expect(
        classifyField(
          await buildDescriptor({ label, sectionContext: ["ADDRESS"] }),
        ),
      ).toMatchObject({
        status: "ABSTAINED",
        reason: "NEGATIVE_EVIDENCE_CONFLICT",
      });
    });
  }
  it("transliterates sharp S without collapsing other distinct spellings", () => {
    expect(normalizeEvidence("Straße")).toBe("strasse");
    expect(normalizeEvidence("Stråße")).not.toBe(normalizeEvidence("Straße"));
  });
  for (const label of ["Adresse électronique", "Adresse IP", "Street number"]) {
    it(`does not infer a street address for subtype ${label}`, async () => {
      expect(
        classifyField(
          await buildDescriptor({
            label: normalizeEvidence(label),
            sectionContext: ["ADDRESS"],
          }),
        ),
      ).toMatchObject({ status: "ABSTAINED" });
    });
  }
  for (const [label, section] of [
    ["Adresse", "EMPLOYEUR"],
    ["Strasse", "ARBEITGEBER"],
  ] as const) {
    it(`does not fill the applicant address in other-party section ${section}`, async () => {
      const outcome = await resolveFieldDecision({
        descriptor: await buildDescriptor({
          label,
          sectionContext: [section],
        }),
        records: buildApprovedRecordSet([
          {
            recordId: "record_00000000000000000000000001",
            concept: "ADDRESS_LINE_1",
            policy: "FILL_FROM_EXPLICIT_RECORD",
            confirmation: { state: "MISSING" },
            valueConfidence: 1,
          },
        ]),
        correlationId: "cor_00000000000000000000000001",
      });
      expect(outcome.status).toBe("RESOLVED");
      if (outcome.status === "RESOLVED")
        expect(outcome.resolution.decision.final_decision).not.toBe("FILL");
    });
  }
  it("does not promote a longer unrelated word through substring matching", async () => {
    expect(
      classifyField(await buildDescriptor({ label: "Streetwear preference" })),
    ).toMatchObject({ status: "ABSTAINED" });
  });
});
