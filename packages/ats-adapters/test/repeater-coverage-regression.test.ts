import { describe, expect, it } from "vitest";
import { fixtureHtml } from "../research/fixture-html.ts";
import { RESEARCH_MATRIX } from "../research/matrix.ts";

/** Internal-verifier P8 regression: declared research repeaters must include
 * an operable case for the accepted generic driver, not only inert rows.
 * Browser proof additionally exercises existing/new/reordered/parser items. */
describe("W12 required Workday repeater architecture coverage", () => {
  it("contains a Workday matrix repeater with stable item identity and the accepted W10 controller", () => {
    const actionable = RESEARCH_MATRIX.filter(
      (variant) =>
        variant.ats === "WORKDAY" && !variant.expected.sessionBoundary,
    )
      .map(fixtureHtml)
      .filter(
        (html) =>
          html.includes("data-japp-repeater-controller") &&
          html.includes("data-japp-item-label") &&
          html.includes('data-japp-repeater-action="ADD"'),
      );
    expect(actionable.length).toBeGreaterThan(0);
  });
});
