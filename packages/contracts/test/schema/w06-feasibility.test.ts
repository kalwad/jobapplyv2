import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { createContractValidator, loadSchemaCatalog } from "../../src/index.ts";

const validator = createContractValidator(loadSchemaCatalog());
const valuesDocument = JSON.parse(
  readFileSync(
    new URL("../contract/corpus/values.v1.json", import.meta.url),
    "utf8",
  ),
) as {
  readonly values: Readonly<Record<string, unknown>>;
};

function fixture(name: string): Record<string, unknown> {
  const value = valuesDocument.values[name];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`missing object fixture ${name}`);
  }
  return structuredClone(value) as Record<string, unknown>;
}

describe("M01-W06 reviewed reason-code vocabularies", () => {
  test.each([
    [
      "urn:japp:schema:form:driver-result:v1",
      "w06.driver-result",
      ["VERIFIED_PERSISTENCE", "AMBIGUOUS_RESOLUTION"],
    ],
    [
      "urn:japp:schema:session:navigation-record:v1",
      "w06.navigation-record",
      ["POSTCONDITIONS_VERIFIED"],
    ],
    [
      "urn:japp:schema:gate:decision:v1",
      "w06.gate-decision",
      ["REVIEWED_PASS", "MISSING_EVIDENCE"],
    ],
  ] as const)(
    "%s preserves its reviewed corpus tokens and rejects a fabricated token",
    (schemaRef, fixtureName, reviewedReasons) => {
      const accepted = fixture(fixtureName);
      expect(accepted.reason_codes).toEqual([reviewedReasons[0]]);
      expect(validator.validateInstance(schemaRef, accepted)).toEqual({
        valid: true,
      });
      for (const reason of reviewedReasons) {
        expect(
          validator.validateInstance(schemaRef, {
            ...accepted,
            reason_codes: [reason],
          }),
          reason,
        ).toEqual({ valid: true });
      }

      const fabricated = {
        ...accepted,
        reason_codes: ["MADE_UP_REASON"],
      };
      const result = validator.validateInstance(schemaRef, fabricated);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.join("\n")).toContain(
          "must be equal to one of the allowed values",
        );
      }
    },
  );
});

describe("M01-W06 render-failure structural evidence", () => {
  const schemaRef = "urn:japp:schema:rendering:layout-measurement:v1";

  test("represents a failed render with zero pages and no page bounds", () => {
    const renderFailed = {
      ...fixture("w06.layout-measurement"),
      layout_result: "RENDER_FAILED",
      renderer_succeeded: false,
      extraction_order_result: "UNKNOWN",
      page_count: 0,
      page_content_bounds: [],
    };

    expect(validator.validateInstance(schemaRef, renderFailed)).toEqual({
      valid: true,
    });
  });

  test("retains finite page-count bounds and the ordinary rendered shape", () => {
    const accepted = fixture("w06.layout-measurement");
    expect(validator.validateInstance(schemaRef, accepted)).toEqual({
      valid: true,
    });

    for (const pageCount of [-1, 1001]) {
      expect(
        validator.validateInstance(schemaRef, {
          ...accepted,
          page_count: pageCount,
        }).valid,
        `page_count ${String(pageCount)}`,
      ).toBe(false);
    }
  });
});
