// M02-W07 proof A/B — the BUILT extension loads and the observed service
// worker is the real W07 MV3 background runtime (REQ-FORM-020, spec
// §5.11.7). The extension is side-loaded from apps/extension/dist/chrome-mv3
// into a fresh persistent bundled-Chromium context; nothing here is
// simulated with page JavaScript.
import {
  BACKGROUND_GLOBAL_KEY,
  BACKGROUND_RUNTIME_MARKER,
  FEASIBILITY_CONTENT_MATCHES,
  FEASIBILITY_PROTOCOL_VERSION,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { expect, test } from "./support/extension-test.ts";

test("the persistent bundled Chromium context exposes a real chrome-extension service worker for the built extension", ({
  serviceWorker,
  extensionId,
}) => {
  // Chrome extension IDs are 32 characters from the a-p alphabet; the
  // worker URL proves the browser actually side-loaded our built bytes and
  // started their MV3 background service worker.
  expect(serviceWorker.url()).toBe(
    `chrome-extension://${extensionId}/background.js`,
  );
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test("the observed service worker is the W07 background runtime, not an unrelated worker", async ({
  serviceWorker,
}) => {
  // The background entrypoint publishes a fixed identity object on its
  // worker global scope at startup; reading it through the real worker
  // handle proves execution of our code inside the actual service worker.
  const identity = await serviceWorker.evaluate(
    (key) => (globalThis as unknown as Record<string, unknown>)[key],
    BACKGROUND_GLOBAL_KEY,
  );
  expect(identity).toEqual({
    protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
    runtimeMarker: BACKGROUND_RUNTIME_MARKER,
  });
});

test("the manifest inside the running browser is genuine MV3 with the reviewed minimal boundary", async ({
  serviceWorker,
}) => {
  const manifest = await serviceWorker.evaluate(() => {
    const runtimeHost = globalThis as unknown as {
      chrome: { runtime: { getManifest(): Record<string, unknown> } };
    };
    return runtimeHost.chrome.runtime.getManifest();
  });
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe("M02-W11 dynamic reconciliation (test-only)");
  expect(manifest.background).toEqual({ service_worker: "background.js" });
  expect(manifest.content_scripts).toEqual([
    {
      matches: [...FEASIBILITY_CONTENT_MATCHES],
      all_frames: true,
      js: ["content-scripts/feasibility.js"],
    },
  ]);
  // No privileged capability, UI surface, or broad host access exists in
  // the running browser's view of the extension either.
  for (const forbidden of [
    "permissions",
    "host_permissions",
    "optional_permissions",
    "action",
    "options_ui",
    "options_page",
    "side_panel",
    "devtools_page",
    "externally_connectable",
    "web_accessible_resources",
  ]) {
    expect(
      manifest,
      `manifest must not declare ${forbidden}`,
    ).not.toHaveProperty(forbidden);
  }
});
