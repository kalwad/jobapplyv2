// M02-W07 real-extension Playwright fixtures (REQ-FORM-020, spec §5.11.7).
//
// Every test gets a fresh persistent bundled-Chromium context with the real
// built @japp/extension side-loaded from apps/extension/dist/chrome-mv3, the
// actual Manifest V3 service worker resolved from that context, and an
// automatic network-isolation assertion: the extension context may touch
// only the loopback mock ATS origin and browser-internal schemes. Profiles
// live in fresh system temp directories and are removed with bounded
// Windows-safe retries (KI-0028 pattern).
import {
  type BrowserContext,
  chromium,
  expect,
  test as base,
  type Worker,
} from "@playwright/test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const LAB_ORIGIN = "http://127.0.0.1:4761";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
export const EXTENSION_DIST = join(
  REPO_ROOT,
  "apps",
  "extension",
  "dist",
  "chrome-mv3",
);

const SERVICE_WORKER_TIMEOUT_MS = 30_000;

// Protocols that never leave the machine; everything else must be the
// loopback lab origin or it is an isolation violation.
const LOCAL_PROTOCOLS = new Set([
  "about:",
  "blob:",
  "chrome:",
  "chrome-extension:",
  "data:",
]);

function isLocalRequest(url: string): boolean {
  if (url.startsWith(`${LAB_ORIGIN}/`) || url === LAB_ORIGIN) {
    return true;
  }
  try {
    return LOCAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export async function getExtensionServiceWorker(
  context: BrowserContext,
): Promise<Worker> {
  const isExtensionWorker = (worker: Worker): boolean =>
    worker.url().startsWith("chrome-extension://");
  const existing = context.serviceWorkers().find(isExtensionWorker);
  if (existing) {
    return existing;
  }
  return context.waitForEvent("serviceworker", {
    predicate: isExtensionWorker,
    timeout: SERVICE_WORKER_TIMEOUT_MS,
  });
}

interface ExtensionFixtures {
  extensionContext: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

export const test = base.extend<ExtensionFixtures>({
  // Playwright derives fixture dependencies from the destructuring
  // pattern; the persistent extension context intentionally depends on no
  // base fixture, so the pattern is deliberately empty.
  // eslint-disable-next-line no-empty-pattern
  extensionContext: async ({}, use) => {
    if (!existsSync(join(EXTENSION_DIST, "manifest.json"))) {
      throw new Error(
        `built extension missing at ${EXTENSION_DIST}; ` +
          "run 'pnpm --filter @japp/extension build' (the canonical " +
          "'playwright test' command does this through its global setup)",
      );
    }
    const userDataDir = mkdtempSync(join(tmpdir(), "japp-m02-w07-profile-"));
    const removeProfile = (): void => {
      // Bounded Windows-safe profile cleanup: Chromium child handles can
      // release asynchronously after close (KI-0028).
      rmSync(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    };
    let context: BrowserContext;
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        // The full bundled Chromium build (not the headless shell): the
        // pinned Playwright channel that supports side-loaded MV3
        // extensions in headless runs.
        channel: "chromium",
        args: [
          `--disable-extensions-except=${EXTENSION_DIST}`,
          `--load-extension=${EXTENSION_DIST}`,
        ],
      });
    } catch (error) {
      removeProfile();
      throw error;
    }
    // Best-effort runtime observation of the context's network traffic.
    // Requests issued inside the browser-launch window (before this
    // listener's subscription is active) and non-HTTP channels such as
    // WebSocket are not observable here; the deterministic guarantee that
    // no egress primitive exists at all is the static forbidden-token scan
    // over sources and shipped bytes in
    // apps/extension/test/m02-w07/built-manifest.test.ts.
    const offenders: string[] = [];
    context.on("request", (request) => {
      if (!isLocalRequest(request.url())) {
        offenders.push(`${request.method()} ${request.url()}`);
      }
    });
    try {
      await use(context);
      expect(
        offenders,
        "the W07 extension context must never issue an observed non-loopback request",
      ).toEqual([]);
    } finally {
      await context.close();
      removeProfile();
    }
  },
  serviceWorker: async ({ extensionContext }, use) => {
    await use(await getExtensionServiceWorker(extensionContext));
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).hostname);
  },
});

export { expect };
