import { expect, it } from "vitest";
import { normalizeScannerText } from "../../src/field-scanner.ts";

it("keeps reviewed sharp-S street labels inside the canonical inert ASCII wire grammar", () => {
  expect(normalizeScannerText("Straße")).toBe("Strasse");
  expect(normalizeScannerText("STRAẞE")).toBe("STRAssE");
  expect(normalizeScannerText("Stråße")).not.toBe(
    normalizeScannerText("Straße"),
  );
  expect(normalizeScannerText("<script>alert(1)</script>")).not.toContain("<");
});
