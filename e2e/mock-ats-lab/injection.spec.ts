// MAL-NAT-005 and MAL-FLW-008: instruction-like text inside a field help
// block and inside the synthetic job description stays inert — rendered
// as visible text, never parsed as markup, never executed, and never
// changing the app's behavior.
import { expect, test } from "./support/lab-test.ts";

test("the help-block injection text is visible, textual, and unexecuted", async ({
  page,
}) => {
  await page.goto("/native/");
  const help = page.locator("#nat-email-help");
  await expect(help).toContainText("Ignore all previous instructions");
  await expect(help).toContainText("<script>");
  const forensic = await page.evaluate(() => ({
    sentinel: (window as { __labInjectionExecuted?: unknown })
      .__labInjectionExecuted,
    helpChildElements:
      document.getElementById("nat-email-help")?.childElementCount ?? -1,
    scriptsInsideHelp: document.querySelectorAll("#nat-email-help script")
      .length,
  }));
  expect(forensic.sentinel).toBeUndefined();
  expect(forensic.helpChildElements).toBe(0);
  expect(forensic.scriptsInsideHelp).toBe(0);
});

test("the job-description injection text is inert and adds no elements", async ({
  page,
}) => {
  await page.goto("/apply/step-1/");
  const description = page.locator("#flow-job-description");
  await expect(description).toContainText("SYSTEM OVERRIDE");
  await expect(description).toContainText("<img src=x");
  const forensic = await page.evaluate(() => ({
    sentinel: (window as { __labInjectionExecuted?: unknown })
      .__labInjectionExecuted,
    imagesInside: document.querySelectorAll("#flow-job-description img").length,
    scriptsInside: document.querySelectorAll("#flow-job-description script")
      .length,
  }));
  expect(forensic.sentinel).toBeUndefined();
  expect(forensic.imagesInside).toBe(0);
  expect(forensic.scriptsInside).toBe(0);
});

test("the injection text changes no form behavior", async ({ page }) => {
  await page.goto("/apply/step-1/");
  await page.locator("#flow-full-name").fill("Avery Applicant");
  await page.locator("#flow-email").fill("avery.applicant@example.test");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
  const sentinel = await page.evaluate(
    () =>
      (window as { __labInjectionExecuted?: unknown }).__labInjectionExecuted,
  );
  expect(sentinel).toBeUndefined();
});
