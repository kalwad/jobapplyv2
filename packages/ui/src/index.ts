/** Repository-owned UI foundations, introduced in M03-W01. */
export const PACKAGE_NAME = "@japp/ui";

export { PrimaryNavigation, SkipLink } from "./navigation.tsx";
export type {
  NavigationItem,
  PrimaryNavigationProps,
  SkipLinkProps,
} from "./navigation.tsx";
export { ErrorState, LoadingState, UnavailableState } from "./status.tsx";
export type {
  ErrorStateProps,
  LoadingStateProps,
  UnavailableStateProps,
} from "./status.tsx";
export { RenderErrorBoundary } from "./error-boundary.tsx";
