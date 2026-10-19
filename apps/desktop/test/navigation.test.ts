import { describe, expect, it } from "vitest";
import { DESTINATIONS, resolveDestination } from "../src/navigation.ts";

describe("desktop destination contract", () => {
  it("offers every required destination once in a stable keyboard order", () => {
    expect(DESTINATIONS.map(({ label }) => label)).toEqual([
      "Home",
      "Jobs",
      "Tracker",
      "Documents / Resumes",
      "Profile",
      "Settings",
      "Diagnostics",
    ]);
    expect(new Set(DESTINATIONS.map(({ id }) => id)).size).toBe(7);
    for (const destination of DESTINATIONS) {
      expect(resolveDestination(destination.href)).toBe(destination.id);
    }
  });

  it.each([
    "",
    "#",
    "#unknown",
    "#Diagnostics",
    "#jobs?token=secret",
    "#%64iagnostics",
    "https://elsewhere.test/#jobs",
  ])("returns to Home for an unrecognized hash %j", (hash) => {
    expect(resolveDestination(hash)).toBe("home");
  });

  it("does not suggest the unfinished tools are connected", () => {
    expect(
      DESTINATIONS.filter(({ available }) => available).map(({ id }) => id),
    ).toEqual(["home", "diagnostics"]);
    expect(
      DESTINATIONS.filter(({ available }) => !available).every(
        ({ unavailableMessage }) =>
          typeof unavailableMessage === "string" &&
          unavailableMessage.length > 0,
      ),
    ).toBe(true);
  });
});
