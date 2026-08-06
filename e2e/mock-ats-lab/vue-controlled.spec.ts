// MAL-VUE-001, MAL-VUE-002, MAL-VUE-003: real Vue-controlled inputs —
// reactivity commits values, a forced rerender patches from state (stale
// direct DOM writes are discarded), and the employee-ID uppercase rewrite
// is observable.
import { expect, test } from "./support/lab-test.ts";

test("typed values commit to Vue state and survive a forced rerender", async ({
  page,
}) => {
  await page.goto("/vue/");
  await page.locator("#vue-full-name").fill("Avery Applicant");
  await page.locator("#vue-office").selectOption("summit");
  await page.locator("#vue-agreed").check();
  await expect(page.locator("#vue-state-full-name")).toHaveText(
    "Avery Applicant",
  );
  await page.locator("#vue-rerender").click();
  await expect(page.locator("#vue-render-count")).toHaveText("2");
  await expect(page.locator("#vue-full-name")).toHaveValue("Avery Applicant");
  await expect(page.locator("#vue-office")).toHaveValue("summit");
  await expect(page.locator("#vue-agreed")).toBeChecked();
});

test("a direct stale DOM write never becomes accepted Vue state", async ({
  page,
}) => {
  await page.goto("/vue/");
  await page.locator("#vue-full-name").fill("Committed Name");
  await page.locator("#vue-full-name").evaluate((node) => {
    (node as HTMLInputElement).value = "hijacked-by-direct-write";
  });
  await expect(page.locator("#vue-full-name")).toHaveValue(
    "hijacked-by-direct-write",
  );
  await expect(page.locator("#vue-state-full-name")).toHaveText(
    "Committed Name",
  );
  await page.locator("#vue-rerender").click();
  await expect(page.locator("#vue-full-name")).toHaveValue("Committed Name");
  await expect(page.locator("#vue-state-full-name")).toHaveText(
    "Committed Name",
  );
});

test("the page's own uppercase rewrite is observable as you type", async ({
  page,
}) => {
  await page.goto("/vue/");
  await page.locator("#vue-employee-id").pressSequentially("ref-0042");
  await expect(page.locator("#vue-employee-id")).toHaveValue("REF-0042");
  await expect(page.locator("#vue-state-employee-id")).toHaveText("REF-0042");
});
