// M02-W03 Phase 5: the lab performs no non-loopback network activity. The
// shared auto-fixture already fails ANY spec on a non-loopback request;
// this spec additionally inventories the requests of a full page visit and
// proves every one of them targets 127.0.0.1:4761.
import { expect, test } from "./support/lab-test.ts";

test("a full index visit issues loopback requests only", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
  });
  await page.goto("/");
  await page.waitForLoadState("load");
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(url.startsWith("http://127.0.0.1:4761/")).toBe(true);
  }
});

test("the multipage flow and iframe stay loopback-only end to end", async ({
  page,
}) => {
  const offSiteRequests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4761/")) {
      offSiteRequests.push(request.url());
    }
  });
  await page.goto("/frames/");
  await page
    .frameLocator("#frames-embed")
    .locator("#frame-reference")
    .fill("SYN-REF-0001");
  await page.goto("/apply/step-1/");
  await page.locator("#flow-full-name").fill("Avery Applicant");
  await page.locator("#flow-email").fill("avery.applicant@example.test");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
  expect(offSiteRequests).toEqual([]);
});
