export type DestinationId =
  | "home"
  | "jobs"
  | "tracker"
  | "documents"
  | "profile"
  | "settings"
  | "diagnostics";

export interface DesktopDestination {
  readonly id: DestinationId;
  readonly label: string;
  readonly href: `#${DestinationId}`;
  readonly available: boolean;
  readonly unavailableMessage: string | null;
}

const HOME: DesktopDestination = {
  id: "home",
  label: "Home",
  href: "#home",
  available: true,
  unavailableMessage: null,
};

export const DESTINATIONS: readonly DesktopDestination[] = [
  HOME,
  {
    id: "jobs",
    label: "Jobs",
    href: "#jobs",
    available: false,
    unavailableMessage: "Job discovery is not available in this build.",
  },
  {
    id: "tracker",
    label: "Tracker",
    href: "#tracker",
    available: false,
    unavailableMessage: "Application tracking is not available in this build.",
  },
  {
    id: "documents",
    label: "Documents / Resumes",
    href: "#documents",
    available: false,
    unavailableMessage:
      "Document and resume tools are not available in this build.",
  },
  {
    id: "profile",
    label: "Profile",
    href: "#profile",
    available: false,
    unavailableMessage: "Profile editing is not available in this build.",
  },
  {
    id: "settings",
    label: "Settings",
    href: "#settings",
    available: false,
    unavailableMessage: "App settings are not available in this build.",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    href: "#diagnostics",
    available: true,
    unavailableMessage: null,
  },
];

export function resolveDestination(hash: string): DestinationId {
  return DESTINATIONS.find(({ href }) => href === hash)?.id ?? "home";
}

export function getDestination(id: DestinationId): DesktopDestination {
  return DESTINATIONS.find((destination) => destination.id === id) ?? HOME;
}
