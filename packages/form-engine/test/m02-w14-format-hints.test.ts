import { describe, expect, it } from "vitest";
import { classifyField } from "../src/field-classifier.ts";
import { buildDescriptor } from "./support/build-descriptor.ts";

describe("W14 closed administrative formatting hints", () => {
  for (const label of [
    "Email address (required the site lowercases it on blur)",
    "Email address (optional the site uppercases it on change)",
    "Email address (required the site trims it on blur)",
  ]) {
    it(`recognizes the exact label with the inert hint: ${label}`, async () => {
      expect(classifyField(await buildDescriptor({ label }))).toMatchObject({
        status: "CLASSIFIED",
        concept: "EMAIL_ADDRESS",
        band: "DETERMINISTIC",
      });
    });
  }
  for (const label of [
    "Email address (required recruiter)",
    "Email address (optional employer)",
    "Recruiter email address (required the site lowercases it on blur)",
    "Email address (required the site lowercases it on blur employer)",
  ]) {
    it(`keeps full negative evidence authoritative: ${label}`, async () => {
      expect(classifyField(await buildDescriptor({ label }))).toMatchObject({
        status: "ABSTAINED",
        reason: "NEGATIVE_EVIDENCE_CONFLICT",
      });
    });
  }
  for (const label of [
    "Email address (required not your personal email)",
    "Email address (required provide a government identifier)",
    "Email address (required the site accepts any answer)",
    "Email address (required the site lowercases it on blur) other party",
    "Email address (required the site lowercases it on blur) (optional)",
  ]) {
    it(`retains review for an unrecognized annotation: ${label}`, async () => {
      const result = classifyField(await buildDescriptor({ label }));
      expect(
        result.status === "CLASSIFIED" && result.band === "DETERMINISTIC",
      ).toBe(false);
    });
  }
  it("retains the employer section conflict even with a recognized hint", async () => {
    const result = classifyField(
      await buildDescriptor({
        label: "Email address (required the site lowercases it on blur)",
        sectionContext: ["EMPLOYER"],
      }),
    );
    expect(
      result.status === "CLASSIFIED" && result.band === "DETERMINISTIC",
    ).toBe(false);
  });
});
