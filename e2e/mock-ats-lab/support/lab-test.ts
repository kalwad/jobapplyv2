// Shared Playwright test base for the mock ATS lab suites (M02-W03).
//
// Every spec imports { test, expect } from here. An automatic fixture
// records every request the page issues and fails the test if any request
// targets a non-loopback origin — the lab must never contact anything but
// 127.0.0.1:4761 (spec §8.2: no live-site traffic; M02-W03 Phase 5).
import { expect, test as base } from "@playwright/test";

export const LAB_ORIGIN = "http://127.0.0.1:4761";

/** Protocols that never leave the browser process. */
const LOCAL_PROTOCOLS = new Set(["about:", "blob:", "data:", "chrome:"]);

function isLoopbackLabUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (LOCAL_PROTOCOLS.has(parsed.protocol)) {
    return true;
  }
  return (
    parsed.protocol === "http:" &&
    parsed.hostname === "127.0.0.1" &&
    parsed.port === "4761"
  );
}

interface LabFixtures {
  nonLoopbackRequests: string[];
}

export const test = base.extend<LabFixtures>({
  nonLoopbackRequests: [
    async ({ page }, use) => {
      const offenders: string[] = [];
      page.on("request", (request) => {
        if (!isLoopbackLabUrl(request.url())) {
          offenders.push(request.url());
        }
      });
      await use(offenders);
      expect(
        offenders,
        "the mock ATS lab must never issue a non-loopback request",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page as LabPage } from "@playwright/test";
