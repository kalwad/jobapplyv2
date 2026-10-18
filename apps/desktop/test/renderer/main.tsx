// Test-only entry; the shipping Vite build has only apps/desktop/index.html.
import { createRoot } from "react-dom/client";
import { RenderErrorBoundary } from "@japp/ui";
import "@japp/ui/tokens.css";
import "../../src/shell.css";
import { DesktopShell } from "../../src/shell.tsx";
import type { ShellMetadata } from "../../src/native-metadata.ts";

interface PendingRead {
  resolve: (value: ShellMetadata) => void;
  reject: (reason: Error) => void;
}
const pending: PendingRead[] = [];
let reads = 0;
let throwing = true;
const versions: ShellMetadata = { appVersion: "0.0.1", tauriVersion: "2.12.4" };
const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? "success";
const controls = {
  readCount: () => reads,
  resolveRead(index: number, value: ShellMetadata) {
    pending[index]?.resolve(value);
  },
  stopThrowing() {
    throwing = false;
  },
};
declare global {
  interface Window {
    __desktopFixture: typeof controls;
  }
}
window.__desktopFixture = controls;
function loadMetadata(): Promise<ShellMetadata> {
  reads += 1;
  if (scenario === "pending")
    return new Promise((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  if (scenario === "retry" && reads === 1)
    return Promise.reject(new Error("fixture-private-secret"));
  if (scenario === "malformed")
    return Promise.resolve({
      appVersion: "<img src=x onerror=alert(1)>",
      tauriVersion: "2.12.4",
    });
  return Promise.resolve(versions);
}
function FragileView() {
  if (throwing) throw new Error("fixture-render-private-secret");
  return <h1>Recovered view</h1>;
}
const root = document.getElementById("root");
if (root === null) throw new Error("Renderer fixture mount is missing");
createRoot(root).render(
  scenario === "render-error" ? (
    <RenderErrorBoundary>
      <FragileView />
    </RenderErrorBoundary>
  ) : scenario === "native-unavailable" ? (
    <DesktopShell />
  ) : (
    <DesktopShell loadMetadata={loadMetadata} />
  ),
);
