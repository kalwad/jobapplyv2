import { isElementEnabled, isElementVisible } from "../field-scanner.ts";
import type { ResolvedFieldTarget } from "../field-scanner.ts";
import type { DriverContext } from "./driver-contract.ts";

/** Every driver interaction is fenced at its final synchronous boundary.
 * The engine owns approval/current-target checks; the driver additionally
 * verifies its exact local action element survived any preceding await. */
export function mutateCurrent(
  context: DriverContext,
  element: HTMLElement,
  mutation: (current: ResolvedFieldTarget) => void,
): Promise<void> {
  return context.mutate((current) => {
    if (
      element.ownerDocument !== context.document ||
      !element.isConnected ||
      ((element !== current.anchor ||
        current.descriptor.control_kind === "RADIO_GROUP") &&
        (!isElementVisible(element) || !isElementEnabled(element)))
    ) {
      throw new Error(
        "driver invariant: mutation target is no longer actionable",
      );
    }
    mutation(current);
  });
}
