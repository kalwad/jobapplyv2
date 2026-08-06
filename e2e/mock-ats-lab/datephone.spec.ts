// MAL-DTP-001 and MAL-DTP-002: composite date and phone widgets —
// deterministic normalization, invalid-input rejection, and accepted
// committed state, with no locale guessing.
import { expect, test } from "./support/lab-test.ts";

test("the date widget normalizes single digits and commits a valid ISO date", async ({
  page,
}) => {
  await page.goto("/datephone/");
  await page.locator("#cd-day").fill("7");
  await page.locator("#cd-day").blur();
  await expect(page.locator("#cd-day")).toHaveValue("07");
  await page.locator("#cd-month").fill("9");
  await page.locator("#cd-month").blur();
  await expect(page.locator("#cd-month")).toHaveValue("09");
  await page.locator("#cd-year").fill("2026");
  await page.locator("#cd-commit").click();
  await expect(page.locator("#cd-error")).toHaveText("");
  await expect(page.locator("#cd-committed")).toHaveText("2026-09-07");
});

test("an impossible calendar day is rejected and clears the committed value", async ({
  page,
}) => {
  await page.goto("/datephone/");
  await page.locator("#cd-day").fill("30");
  await page.locator("#cd-month").fill("02");
  await page.locator("#cd-year").fill("2026");
  await page.locator("#cd-commit").click();
  await expect(page.locator("#cd-error")).toContainText("INVALID_DATE");
  await expect(page.locator("#cd-committed")).toHaveText("");
});

test("leap-day February 29 is accepted only in a leap year", async ({
  page,
}) => {
  await page.goto("/datephone/");
  await page.locator("#cd-day").fill("29");
  await page.locator("#cd-month").fill("02");
  await page.locator("#cd-year").fill("2028");
  await page.locator("#cd-commit").click();
  await expect(page.locator("#cd-committed")).toHaveText("2028-02-29");
  await page.locator("#cd-year").fill("2026");
  await page.locator("#cd-commit").click();
  await expect(page.locator("#cd-error")).toContainText("INVALID_DATE");
  await expect(page.locator("#cd-committed")).toHaveText("");
});

test("the phone widget strips separators on blur and commits the exact E.164 form", async ({
  page,
}) => {
  await page.goto("/datephone/");
  await page.locator("#cp-country").selectOption("+1");
  await page.locator("#cp-national").fill("(555) 010-0123");
  await page.locator("#cp-national").blur();
  await expect(page.locator("#cp-national")).toHaveValue("5550100123");
  await page.locator("#cp-commit").click();
  await expect(page.locator("#cp-error")).toHaveText("");
  await expect(page.locator("#cp-committed")).toHaveText("+15550100123");
});

test("wrong national length and non-digit input are rejected deterministically", async ({
  page,
}) => {
  await page.goto("/datephone/");
  await page.locator("#cp-country").selectOption("+61");
  await page.locator("#cp-national").fill("5550100123");
  await page.locator("#cp-commit").click();
  await expect(page.locator("#cp-error")).toContainText("INVALID_PHONE_LENGTH");
  await expect(page.locator("#cp-committed")).toHaveText("");
  await page.locator("#cp-national").fill("55501x0123");
  await page.locator("#cp-commit").click();
  await expect(page.locator("#cp-error")).toContainText("INVALID_PHONE");
});
