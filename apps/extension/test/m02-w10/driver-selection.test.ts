import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";
import { describe, expect, test } from "vitest";

import { matchingControlDrivers } from "../../src/driver-engine.ts";
import type { ControlDriver } from "../../src/drivers/driver-contract.ts";

function syntheticDriver(driverKey: string, claims: boolean): ControlDriver {
  return {
    driverKey,
    detect: () => claims,
    checkPreconditions: () =>
      Promise.resolve({ ok: true, alreadySatisfied: false }),
    captureUndo: () =>
      Promise.resolve({
        restorable: false,
        priorObservation: {
          family: "TEXT",
          parts: [""],
          presence: "EMPTY",
        },
        payload: null,
      }),
    execute: () => Promise.resolve(),
    observe: () =>
      Promise.resolve({ family: "TEXT", parts: [""], presence: "EMPTY" }),
    applyUndo: () => Promise.resolve(),
  };
}

const descriptor = {} as unknown as FormFieldDescriptorV1;
const anchor = {} as unknown as HTMLElement;
const intended = { kind: "TEXT" as const, text: "Synthetic" };

describe("explicit control-driver selection", () => {
  test("zero claims stays unsupported", () => {
    expect(
      matchingControlDrivers(
        [syntheticDriver("A", false), syntheticDriver("B", false)],
        descriptor,
        anchor,
        intended,
      ),
    ).toEqual([]);
  });

  test("one claim produces exactly that driver", () => {
    expect(
      matchingControlDrivers(
        [syntheticDriver("A", false), syntheticDriver("B", true)],
        descriptor,
        anchor,
        intended,
      ).map((driver) => driver.driverKey),
    ).toEqual(["B"]);
  });

  test("multiple claims remain explicit ambiguity and are never collapsed by order", () => {
    const drivers = [syntheticDriver("A", true), syntheticDriver("B", true)];
    expect(
      matchingControlDrivers(drivers, descriptor, anchor, intended),
    ).toHaveLength(2);
    expect(
      matchingControlDrivers(
        [...drivers].reverse(),
        descriptor,
        anchor,
        intended,
      ),
    ).toHaveLength(2);
  });
});
