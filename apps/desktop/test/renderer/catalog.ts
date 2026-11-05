// Test-only source catalog. This never declares business capability or approval.
import { DESTINATIONS } from "../../src/navigation.ts";

export const CATALOG_VERSION = "M03-W11-SHELL-CATALOG-V1";
export const TOKEN_VERSION = "M03-W01-initial";

export const SHELL_SURFACES = DESTINATIONS.map((destination) => ({
  fixtureId: `shell-${destination.id}`,
  destinationId: destination.id,
  label: destination.label,
  href: `./index.html?scenario=success${destination.href}`,
  capability: destination.available
    ? "Shell navigation and development information only"
    : "Business capability unavailable in this build",
  unavailableMessage: destination.unavailableMessage,
}));

export const SHARED_STATES = [
  {
    fixtureId: "shared-loading",
    label: "Loading",
    href: "./index.html?scenario=pending#diagnostics",
    component: "LoadingState through Diagnostics",
    behavior: "The synthetic metadata read stays pending for inspection.",
  },
  {
    fixtureId: "shared-error",
    label: "Error and retry",
    href: "./index.html?scenario=retry#diagnostics",
    component: "ErrorState through Diagnostics",
    behavior:
      "Try again performs a fresh synthetic metadata read and recovers.",
  },
  {
    fixtureId: "shared-unavailable",
    label: "Unavailable",
    href: "./index.html?scenario=success#jobs",
    component: "UnavailableState through DesktopShell",
    behavior:
      "Job discovery remains unavailable; no fake records are supplied.",
  },
  {
    fixtureId: "shared-render-boundary",
    label: "Render boundary and recovery",
    href: "./index.html?scenario=catalog-render-error",
    component: "RenderErrorBoundary and ErrorState",
    behavior:
      "Reload view releases the test fault and remounts healthy content.",
  },
] as const;

export const CAPTURE_VIEWPORTS = [
  { width: 1120, height: 760 },
  { width: 320, height: 760 },
] as const;

// Expected cases only. Artifact hashes and capture state are produced after actors.
export const SHELL_CAPTURE_CASES = SHELL_SURFACES.flatMap((surface) =>
  CAPTURE_VIEWPORTS.map((viewport) => ({ surface, viewport })),
);
