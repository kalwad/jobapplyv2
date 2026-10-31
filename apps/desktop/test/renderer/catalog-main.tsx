// Test-only discoverability, using the existing shared tokens and primitives.
import { createRoot } from "react-dom/client";
import { SkipLink } from "@japp/ui";
import "@japp/ui/tokens.css";
import "../../src/shell.css";
import { CATALOG_VERSION, SHARED_STATES, SHELL_SURFACES } from "./catalog.ts";

function StateCatalog() {
  return (
    <>
      <SkipLink targetId="catalog-main" />
      <main id="catalog-main" className="desktop-main" tabIndex={-1}>
        <header className="desktop-page-header">
          <h1>Desktop state catalog</h1>
        </header>
        <p>
          Test-only fixtures use shipping components and synthetic desktop
          versions. Business tools remain unavailable. No native service or
          platform certification is implied.
        </p>
        <div className="desktop-page-stack">
          <section className="desktop-panel" aria-labelledby="shell-stories">
            <div className="desktop-panel__heading">
              <h2 id="shell-stories">Shell surfaces</h2>
            </div>
            <ul className="ui-navigation__list">
              {SHELL_SURFACES.map((surface) => (
                <li key={surface.fixtureId}>
                  <a className="ui-navigation__link" href={surface.href}>
                    {surface.label}
                  </a>
                  <p className="desktop-detail">{surface.capability}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="desktop-panel" aria-labelledby="shared-stories">
            <div className="desktop-panel__heading">
              <h2 id="shared-stories">Shared states</h2>
            </div>
            <ul className="ui-navigation__list">
              {SHARED_STATES.map((state) => (
                <li key={state.fixtureId}>
                  <a className="ui-navigation__link" href={state.href}>
                    {state.label}
                  </a>
                  <p className="desktop-detail">{state.behavior}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <footer className="desktop-footer">{CATALOG_VERSION}</footer>
      </main>
    </>
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("State catalog mount is missing");
createRoot(root).render(<StateCatalog />);
