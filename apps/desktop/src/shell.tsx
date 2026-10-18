import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  PrimaryNavigation,
  RenderErrorBoundary,
  SkipLink,
  UnavailableState,
} from "@japp/ui";
import { Diagnostics } from "./diagnostics.tsx";
import {
  DESTINATIONS,
  getDestination,
  resolveDestination,
} from "./navigation.ts";
import type { DestinationId } from "./navigation.ts";
import type { MetadataLoader } from "./native-metadata.ts";

const MAIN_ID = "desktop-main";

/** Original simple geometry; no external icon or brand assets. */
function DestinationIcon({ id }: { readonly id: DestinationId }) {
  const shapes: Record<DestinationId, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h5v-7h4v7h5V9" />
      </>
    ),
    jobs: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3" />
      </>
    ),
    tracker: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 10h18M9 10v11M15 10v11" />
      </>
    ),
    documents: (
      <>
        <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <path d="M8 3v6M16 9v6M10 15v6" />
      </>
    ),
    diagnostics: (
      <>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {shapes[id]}
    </svg>
  );
}

const NAVIGATION_ITEMS = DESTINATIONS.map(({ id, label, href }) => ({
  id,
  label,
  href,
  icon: <DestinationIcon id={id} />,
}));

function subscribeToDestination(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function readDestination(): DestinationId {
  return resolveDestination(window.location.hash);
}

function Home() {
  return (
    <section className="desktop-panel" aria-labelledby="workspace-heading">
      <div className="desktop-panel__heading">
        <h2 id="workspace-heading">Your workspace</h2>
      </div>
      <div className="desktop-introduction">
        <p>Check your desktop app in Diagnostics.</p>
        <p>
          Profile, documents, and application tools are not available in this
          build.
        </p>
      </div>
      <dl className="desktop-details">
        <div>
          <dt>Navigation</dt>
          <dd>Available</dd>
        </div>
        <div>
          <dt>Local service</dt>
          <dd>Unavailable in this build</dd>
        </div>
        <div>
          <dt>AI provider</dt>
          <dd>Unavailable in this build</dd>
        </div>
      </dl>
    </section>
  );
}

export interface DesktopShellProps {
  readonly loadMetadata?: MetadataLoader;
}

export function DesktopShell({ loadMetadata }: DesktopShellProps) {
  const destinationId = useSyncExternalStore(
    subscribeToDestination,
    readDestination,
    () => "home" as const,
  );
  const destination = getDestination(destinationId);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousDestination = useRef(destinationId);

  useEffect(() => {
    if (previousDestination.current !== destinationId) {
      heading.current?.focus();
      previousDestination.current = destinationId;
    }
    document.title = `${destination.label} · Desktop app`;
  }, [destinationId, destination.label]);

  return (
    <div className="desktop-shell">
      <SkipLink targetId={MAIN_ID} />
      <aside className="desktop-sidebar">
        <div className="desktop-workspace">
          <span className="desktop-workspace__mark" aria-hidden="true">
            <DestinationIcon id="jobs" />
          </span>
          <div>
            <span className="desktop-workspace__title">Workspace</span>
            <span className="desktop-workspace__detail">Desktop app</span>
          </div>
        </div>
        <PrimaryNavigation items={NAVIGATION_ITEMS} currentId={destinationId} />
        <p className="desktop-sidebar__footnote">Development build</p>
      </aside>
      <main id={MAIN_ID} className="desktop-main" tabIndex={-1}>
        <header className="desktop-page-header">
          <h1 ref={heading} tabIndex={-1}>
            {destination.label}
          </h1>
          {destinationId === "diagnostics" ? null : (
            <a className="ui-button" href="#diagnostics">
              Open Diagnostics
            </a>
          )}
        </header>
        <RenderErrorBoundary key={destinationId}>
          {destinationId === "home" ? (
            <Home />
          ) : destinationId === "diagnostics" ? (
            <Diagnostics
              {...(loadMetadata === undefined ? {} : { loadMetadata })}
            />
          ) : (
            <section
              className="desktop-panel"
              aria-label={`${destination.label} availability`}
            >
              <UnavailableState
                title={
                  destination.unavailableMessage ??
                  "This tool is not available in this build."
                }
              >
                Check Diagnostics for the capabilities available in this desktop
                app.
              </UnavailableState>
            </section>
          )}
        </RenderErrorBoundary>
        <footer className="desktop-footer">
          Local workspace · No application submission is available in this
          build.
        </footer>
      </main>
    </div>
  );
}
