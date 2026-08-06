// MAL-FLW-003: the CAPTCHA placeholder pauses progression with an explicit
// reason and unlocks only through the clearly labeled local test-only
// manual resolution action. It never represents real CAPTCHA integration.
import { expect, test } from "./support/lab-test.ts";

test("valid step 3 pauses on the CAPTCHA gate until the manual test-only action", async ({
  page,
}) => {
  await page.goto("/apply/step-1/");
  await page.locator("#flow-full-name").fill("Avery Applicant");
  await page.locator("#flow-email").fill("avery.applicant@example.test");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
  await page.locator("#flow-position").selectOption("quality-steward");
  await page.locator("#flow-years").fill("3");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-3/");
  await page.locator("#flow-auth-yes").check();
  await page.locator("#flow-terms").check();
  await page.locator("#flow-next").click();

  await expect(page).toHaveURL(/\/apply\/step-3\/$/);
  await expect(page.locator("#flow-captcha")).toBeVisible();
  await expect(page.locator("#flow-captcha-reason")).toContainText(
    "PAUSED_FOR_CAPTCHA",
  );
  await expect(page.locator("#flow-captcha-reason")).toContainText(
    "cannot and must not be solved automatically",
  );
  await expect(page.locator("#flow-step3-status")).toHaveText(
    "PAUSED_FOR_CAPTCHA",
  );
  await expect(page.locator("#flow-next")).toBeDisabled();

  const resolve = page.locator("#flow-captcha-resolve");
  await expect(resolve).toHaveText(
    "Resolve challenge (test-only manual action)",
  );
  await resolve.click();
  await page.waitForURL("**/apply/review/");
});

test("a reloaded paused step 3 stays paused until resolved", async ({
  page,
}) => {
  await page.goto("/apply/step-1/");
  await page.locator("#flow-full-name").fill("Avery Applicant");
  await page.locator("#flow-email").fill("avery.applicant@example.test");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
  await page.locator("#flow-position").selectOption("quality-steward");
  await page.locator("#flow-years").fill("3");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-3/");
  await page.locator("#flow-auth-yes").check();
  await page.locator("#flow-terms").check();
  await page.locator("#flow-next").click();
  await expect(page.locator("#flow-captcha")).toBeVisible();

  await page.reload();
  await expect(page.locator("#flow-captcha")).toBeVisible();
  await expect(page.locator("#flow-next")).toBeDisabled();
  await page.locator("#flow-captcha-resolve").click();
  await page.waitForURL("**/apply/review/");
});
