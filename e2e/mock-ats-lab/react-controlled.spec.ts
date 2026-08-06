// MAL-REA-001, MAL-REA-002, MAL-REA-003: real React-controlled inputs —
// values commit through synthetic events and persist across forced and
// delayed rerenders, direct stale DOM writes are never accepted state,
// and the page's own email rewrite is observable.
import { expect, test } from "./support/lab-test.ts";

test("typed values commit to React state and survive a forced rerender", async ({
  page,
}) => {
  await page.goto("/react/");
  await page.locator("#react-full-name").fill("Avery Applicant");
  await page.locator("#react-team").selectOption("research");
  await page.locator("#react-subscribed").check();
  await page.locator("#react-summary").fill("Synthetic summary.");
  await expect(page.locator("#react-state-full-name")).toHaveText(
    "Avery Applicant",
  );
  await page.locator("#react-rerender").click();
  await expect(page.locator("#react-render-count")).toHaveText("2");
  await expect(page.locator("#react-full-name")).toHaveValue("Avery Applicant");
  await expect(page.locator("#react-team")).toHaveValue("research");
  await expect(page.locator("#react-subscribed")).toBeChecked();
  await expect(page.locator("#react-summary")).toHaveValue(
    "Synthetic summary.",
  );
});

test("a direct stale DOM write never becomes accepted React state", async ({
  page,
}) => {
  await page.goto("/react/");
  await page.locator("#react-full-name").fill("Committed Name");
  await page.locator("#react-full-name").evaluate((node) => {
    (node as HTMLInputElement).value = "hijacked-by-direct-write";
  });
  await expect(page.locator("#react-full-name")).toHaveValue(
    "hijacked-by-direct-write",
  );
  await expect(page.locator("#react-state-full-name")).toHaveText(
    "Committed Name",
  );
  await page.locator("#react-rerender").click();
  await expect(page.locator("#react-full-name")).toHaveValue("Committed Name");
  await expect(page.locator("#react-state-full-name")).toHaveText(
    "Committed Name",
  );
});

test("the page's own blur rewrite is observable and the delayed rerender keeps state", async ({
  page,
}) => {
  await page.goto("/react/");
  await page.locator("#react-email").fill("AVERY.APPLICANT@Example.TEST");
  await page.locator("#react-email").blur();
  await expect(page.locator("#react-email")).toHaveValue(
    "avery.applicant@example.test",
  );
  await expect(page.locator("#react-state-email")).toHaveText(
    "avery.applicant@example.test",
  );
  await page.locator("#react-delayed-rerender").click();
  await expect(page.locator("#react-rerender-status")).toHaveText(
    "RERENDER_PENDING",
  );
  await expect(page.locator("#react-rerender-status")).toHaveText("IDLE");
  await expect(page.locator("#react-render-count")).toHaveText("2");
  await expect(page.locator("#react-email")).toHaveValue(
    "avery.applicant@example.test",
  );
});
