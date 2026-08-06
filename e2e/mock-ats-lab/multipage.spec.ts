// MAL-FLW-001, MAL-FLW-002, MAL-FLW-004, MAL-FLW-005, MAL-FLW-006,
// MAL-FLW-007: the three-step flow — validation-gated Next, Back with
// persistence, review of persisted answers, fixed-delay local receipt,
// duplicate warning, and the deterministic reset path.
import { expect, test, type LabPage } from "./support/lab-test.ts";

async function completeStepOne(page: LabPage, email: string): Promise<void> {
  await page.goto("/apply/step-1/");
  await page.locator("#flow-full-name").fill("Avery Applicant");
  await page.locator("#flow-email").fill(email);
  await page.locator("#flow-phone").fill("555-0100");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
}

async function completeStepTwo(page: LabPage): Promise<void> {
  await page.locator("#flow-position").selectOption("fixture-engineer");
  await page.locator("#flow-years").fill("4");
  await page.locator("#flow-cover-note").fill("Synthetic cover note.");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-3/");
}

async function completeStepThreeThroughCaptcha(page: LabPage): Promise<void> {
  await page.locator("#flow-auth-yes").check();
  await page.locator("#flow-terms").check();
  await page.locator("#flow-next").click();
  await expect(page.locator("#flow-captcha")).toBeVisible();
  await page.locator("#flow-captcha-resolve").click();
  await page.waitForURL("**/apply/review/");
}

test("empty required fields block step-1 navigation until corrected", async ({
  page,
}) => {
  await page.goto("/apply/step-1/");
  await page.locator("#flow-next").click();
  await expect(page).toHaveURL(/\/apply\/step-1\/$/);
  await expect(page.locator("#flow-step1-status")).toHaveText(
    "NAVIGATION_BLOCKED_BY_VALIDATION",
  );
  await expect(page.locator("#flow-full-name-error")).toHaveText(
    "Full name is required.",
  );
  await expect(page.locator("#flow-email-error")).toHaveText(
    "Email address is required.",
  );
  await page.locator("#flow-full-name").fill("Avery Applicant");
  await page.locator("#flow-email").fill("avery.applicant@example.test");
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
});

test("Back preserves edits and forward navigation keeps every persisted value", async ({
  page,
}) => {
  await completeStepOne(page, "avery.applicant@example.test");
  await page.locator("#flow-position").selectOption("workflow-analyst");
  await page.locator("#flow-years").fill("7");
  await page.locator("#flow-back").click();
  await page.waitForURL("**/apply/step-1/");
  await expect(page.locator("#flow-full-name")).toHaveValue("Avery Applicant");
  await expect(page.locator("#flow-email")).toHaveValue(
    "avery.applicant@example.test",
  );
  await page.locator("#flow-next").click();
  await page.waitForURL("**/apply/step-2/");
  await expect(page.locator("#flow-position")).toHaveValue("workflow-analyst");
  await expect(page.locator("#flow-years")).toHaveValue("7");
});

test("review shows every persisted answer and the local receipt arrives after the fixed delay", async ({
  page,
}) => {
  await completeStepOne(page, "avery.applicant@example.test");
  await completeStepTwo(page);
  await completeStepThreeThroughCaptcha(page);
  const table = page.locator("#flow-review-table");
  await expect(table).toContainText("Avery Applicant");
  await expect(table).toContainText("avery.applicant@example.test");
  await expect(table).toContainText("555-0100");
  await expect(table).toContainText("fixture-engineer");
  await expect(table).toContainText("4");
  await expect(table).toContainText("Synthetic cover note.");
  await expect(table).toContainText("yes");
  await page.locator("#flow-submit").click();
  await expect(page.locator("#flow-review-status")).toHaveText(
    "PROCESSING_LOCAL_SUBMISSION",
  );
  await page.waitForURL("**/apply/receipt/");
  await expect(page.locator("#flow-receipt-id")).toHaveText("RCPT-MOCK-0001");
});

test("submitting the same synthetic application twice warns instead of issuing a second receipt", async ({
  page,
}) => {
  await completeStepOne(page, "avery.applicant@example.test");
  await completeStepTwo(page);
  await completeStepThreeThroughCaptcha(page);
  await page.locator("#flow-submit").click();
  await page.waitForURL("**/apply/receipt/");
  await page.goto("/apply/review/");
  await page.locator("#flow-submit").click();
  await expect(page.locator("#flow-duplicate-warning")).toBeVisible();
  await expect(page.locator("#flow-duplicate-warning")).toContainText(
    "DUPLICATE_APPLICATION",
  );
  await expect(page.locator("#flow-duplicate-warning")).toContainText(
    "RCPT-MOCK-0001",
  );
  await expect(page.locator("#flow-review-status")).toHaveText(
    "DUPLICATE_DETECTED",
  );
  await page.goto("/apply/receipt/");
  await expect(page.locator("#flow-receipt-id")).toHaveText("RCPT-MOCK-0001");
});

test("reset returns the flow and receipts to the exact initial state", async ({
  page,
}) => {
  await completeStepOne(page, "avery.applicant@example.test");
  await completeStepTwo(page);
  await completeStepThreeThroughCaptcha(page);
  await page.locator("#flow-submit").click();
  await page.waitForURL("**/apply/receipt/");
  await page.locator("#flow-reset").click();
  await page.waitForURL("**/apply/step-1/");
  await expect(page.locator("#flow-full-name")).toHaveValue("");
  await expect(page.locator("#flow-email")).toHaveValue("");
  const storage = await page.evaluate(() => ({
    flow: window.sessionStorage.getItem("japp-mock-ats-lab.flow.v1"),
    receipts: window.sessionStorage.getItem("japp-mock-ats-lab.receipts.v1"),
  }));
  expect(storage.flow).toBeNull();
  expect(storage.receipts).toBeNull();
  await page.goto("/apply/receipt/");
  await expect(page.locator("#flow-receipt-id")).toContainText("NO_RECEIPT");
});
