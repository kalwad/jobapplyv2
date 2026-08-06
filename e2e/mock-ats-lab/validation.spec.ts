// MAL-VAL-001: custom field validation, cross-field agreement, delayed
// simulated server-like validation with a fixed local delay, errors that
// clear when corrected, and a continue action blocked while invalid.
import { expect, test } from "./support/lab-test.ts";

test("the custom username rule reports while typing and clears when fixed", async ({
  page,
}) => {
  await page.goto("/validation/");
  await page.locator("#val-username").fill("Bad Name!");
  await expect(page.locator("#val-username-error")).toContainText(
    "lowercase letters/digits",
  );
  await page.locator("#val-username").fill("avery42");
  await expect(page.locator("#val-username-error")).toHaveText("");
});

test("cross-field email confirmation must match exactly and clears on match", async ({
  page,
}) => {
  await page.goto("/validation/");
  await page.locator("#val-email").fill("avery.applicant@example.test");
  await page.locator("#val-email-confirm").fill("other@example.test");
  await expect(page.locator("#val-email-confirm-error")).toHaveText(
    "Both email fields must match exactly.",
  );
  await page.locator("#val-email-confirm").fill("avery.applicant@example.test");
  await expect(page.locator("#val-email-confirm-error")).toHaveText("");
});

test("the delayed local check accepts the exact synthetic code shape", async ({
  page,
}) => {
  await page.goto("/validation/");
  await page.locator("#val-invite").fill("MOCK-INVITE-0042");
  await page.locator("#val-invite-check").click();
  await expect(page.locator("#val-invite-status")).toHaveText("CHECKING");
  await expect(page.locator("#val-invite-status")).toHaveText(
    "INVITE_ACCEPTED",
  );
  await expect(page.locator("#val-invite-error")).toHaveText("");
});

test("the delayed local check rejects a wrong code and editing resets it", async ({
  page,
}) => {
  await page.goto("/validation/");
  await page.locator("#val-invite").fill("WRONG-CODE");
  await page.locator("#val-invite-check").click();
  await expect(page.locator("#val-invite-status")).toHaveText(
    "INVITE_REJECTED",
  );
  await expect(page.locator("#val-invite-error")).toContainText(
    "MOCK-INVITE-0000",
  );
  await page.locator("#val-invite").fill("MOCK-INVITE-0001");
  await expect(page.locator("#val-invite-status")).toHaveText("NOT_CHECKED");
  await expect(page.locator("#val-invite-error")).toHaveText("");
});

test("continue stays blocked until every validation problem is resolved", async ({
  page,
}) => {
  await page.goto("/validation/");
  await page.locator("#val-continue").click();
  await expect(page.locator("#val-continue-status")).toContainText(
    "CONTINUE_BLOCKED",
  );
  await page.locator("#val-username").fill("avery42");
  await page.locator("#val-email").fill("avery.applicant@example.test");
  await page.locator("#val-email-confirm").fill("avery.applicant@example.test");
  await page.locator("#val-invite").fill("MOCK-INVITE-0042");
  await page.locator("#val-invite-check").click();
  await expect(page.locator("#val-invite-status")).toHaveText(
    "INVITE_ACCEPTED",
  );
  await page.locator("#val-continue").click();
  await expect(page.locator("#val-continue-status")).toContainText(
    "CONTINUE_ALLOWED",
  );
});
