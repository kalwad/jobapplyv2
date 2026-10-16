/** Fresh anonymous, inspect-only public browser. Never used by normal CI. */
import {
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_CONTENT_MATCHES,
  PUBLIC_SCOPE_VERSION,
  permitsPublicDocumentUrl,
} from "../../../apps/extension/test/m02-w14/public-inspection/scope.ts";
import {
  buildScanTabRequest,
  parseAggregatedScanResult,
} from "../../../apps/extension/src/scanner-protocol.ts";
import {
  buildDynamicReconcileTabRequest,
  parseDynamicReconcileTabResult,
} from "../../../apps/extension/src/dynamic-protocol.ts";
import { stableSemanticId } from "../../../apps/extension/src/semantic-identity.ts";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
export const PUBLIC_EXTENSION_DIST = join(
  repositoryRoot,
  "apps/extension/dist/w14-public-inspection/chrome-mv3",
);
export const DEFAULT_EXTENSION_DIST = join(
  repositoryRoot,
  "apps/extension/dist/chrome-mv3",
);
export interface InspectionSession {
  context: BrowserContext;
  worker: Worker;
  controller: Page;
  cleanup(): Promise<void>;
}

export async function runtimeMessage(
  controller: Page,
  message: unknown,
): Promise<unknown> {
  return controller.evaluate(async (wire) => {
    const host = globalThis as unknown as {
      chrome: { runtime: { sendMessage(value: unknown): Promise<unknown> } };
    };
    return host.chrome.runtime.sendMessage(wire);
  }, message);
}
export async function tabIdForPage(worker: Worker, page: Page) {
  await page.bringToFront();
  return worker.evaluate(async () => {
    const host = globalThis as unknown as {
      chrome: { tabs: { query(query: object): Promise<{ id?: number }[]> } };
    };
    const tabs = await host.chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tabs.length !== 1 || tabs[0]?.id === undefined)
      throw new Error("W14_NO_UNIQUE_ACTIVE_TAB");
    return tabs[0].id;
  });
}
export async function launchInspection(
  buildDirectory = PUBLIC_EXTENSION_DIST,
): Promise<InspectionSession> {
  if (process.env.JAPP_W14_PUBLIC_INSPECTION !== "1")
    throw new Error("W14_PUBLIC_INSPECTION_EXPLICIT_OPT_IN_REQUIRED");
  if (buildDirectory === PUBLIC_EXTENSION_DIST) {
    const manifest = JSON.parse(
      readFileSync(join(buildDirectory, "manifest.json"), "utf8"),
    ) as { content_scripts: { matches: string[]; all_frames?: boolean }[] };
    if (
      manifest.content_scripts.length !== 1 ||
      manifest.content_scripts[0]?.all_frames !== false ||
      JSON.stringify([...manifest.content_scripts[0].matches].sort()) !==
        JSON.stringify([...PUBLIC_CONTENT_MATCHES].sort())
    )
      throw new Error("W14_PUBLIC_BUILD_SCOPE_MISMATCH");
    const keys = Object.keys(manifest).sort().join();
    if (
      keys !==
      [
        "background",
        "content_scripts",
        "description",
        "manifest_version",
        "name",
        "version",
      ]
        .sort()
        .join()
    )
      throw new Error("W14_UNEXPECTED_MANIFEST_CAPABILITY");
  }
  const profile = mkdtempSync(join(tmpdir(), "japp-w14-public-inspection-"));
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${buildDirectory}`,
        `--load-extension=${buildDirectory}`,
      ],
    });
  } catch (error) {
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
    throw error;
  }
  try {
    const worker =
      context
        .serviceWorkers()
        .find((item) => item.url().startsWith("chrome-extension://")) ??
      (await context.waitForEvent("serviceworker", {
        predicate: (item) => item.url().startsWith("chrome-extension://"),
        timeout: 30_000,
      }));
    const controller = await context.newPage();
    await controller.goto(
      `chrome-extension://${new URL(worker.url()).hostname}/manifest.json`,
    );
    if (buildDirectory === PUBLIC_EXTENSION_DIST) {
      const mode = await worker.evaluate(
        () =>
          (globalThis as Record<string, unknown>)
            .__JAPP_W14_PUBLIC_INSPECTION__,
      );
      if (
        mode === null ||
        typeof mode !== "object" ||
        (mode as { mode?: unknown }).mode !== PUBLIC_SCOPE_VERSION
      )
        throw new Error("W14_PUBLIC_WORKER_MODE_MISMATCH");
    }
    return {
      context,
      worker,
      controller,
      async cleanup() {
        await context.close();
        rmSync(profile, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 100,
        });
      },
    };
  } catch (error) {
    await context.close();
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
    throw error;
  }
}
export async function scanPublicPage(
  session: InspectionSession,
  page: Page,
  requestId: string,
  waitForRegistration = true,
) {
  if (!permitsPublicDocumentUrl(page.url()))
    return {
      state: "UNAPPROVED_CURRENT_URL",
      scan: null,
      reconciliation: null,
    };
  const tabId = await tabIdForPage(session.worker, page);
  const deadline = performance.now() + (waitForRegistration ? 15_000 : 0);
  let scan = parseAggregatedScanResult(
    await runtimeMessage(
      session.controller,
      buildScanTabRequest(requestId, tabId, { kind: "APPLICATION_ROOT" }),
    ),
  );
  while (
    (scan === null || scan.frames.length === 0) &&
    performance.now() < deadline
  ) {
    await page.waitForTimeout(250);
    scan = parseAggregatedScanResult(
      await runtimeMessage(
        session.controller,
        buildScanTabRequest(requestId, tabId, { kind: "APPLICATION_ROOT" }),
      ),
    );
  }
  const frame = scan?.frames[0];
  if (frame === undefined)
    return { state: "NO_REGISTERED_TOP_FRAME", scan, reconciliation: null };
  const correlation = await stableSemanticId(
    "cor",
    `w14-public-inspection\0${requestId}`,
  );
  const reconciliation =
    frame.root_status === "FOUND"
      ? parseDynamicReconcileTabResult(
          await runtimeMessage(
            session.controller,
            buildDynamicReconcileTabRequest(
              `${requestId}-reconcile`,
              tabId,
              frame.frame_context.frame_id,
              correlation,
            ),
          ),
        )
      : null;
  return { state: frame.root_status, scan, reconciliation };
}
