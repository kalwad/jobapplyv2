// MAL-VIR-001: genuine virtualization — the mounted option subset is far
// smaller than the option set, scrolling re-windows the subset, an
// offscreen option is selectable through ordinary interaction, semantic
// identity is stable, and the selection survives a rerender.
import { expect, test } from "./support/lab-test.ts";

test("only a bounded window of the 480 options is mounted", async ({
  page,
}) => {
  await page.goto("/virtualized/");
  const mounted = await page.locator('#vl-listbox [role="option"]').count();
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(30);
  await expect(page.locator("#vl-opt-COHORT-0001")).toBeVisible();
  await expect(page.locator("#vl-opt-COHORT-0400")).toHaveCount(0);
});

test("scrolling re-windows the mounted subset with stable option identity", async ({
  page,
}) => {
  await page.goto("/virtualized/");
  await page.locator("#vl-viewport").evaluate((node) => {
    node.scrollTop = 320 * 32;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator("#vl-opt-COHORT-0321")).toBeVisible();
  await expect(page.locator("#vl-opt-COHORT-0001")).toHaveCount(0);
  const mounted = await page.locator('#vl-listbox [role="option"]').count();
  expect(mounted).toBeLessThan(30);
});

test("an offscreen option is selectable by scrolling and clicking", async ({
  page,
}) => {
  await page.goto("/virtualized/");
  await page.locator("#vl-viewport").evaluate((node) => {
    node.scrollTop = 240 * 32;
    node.dispatchEvent(new Event("scroll"));
  });
  await page.locator("#vl-opt-COHORT-0245").click();
  await expect(page.locator("#vl-committed")).toHaveText("COHORT-0245");
  await expect(page.locator("#vl-opt-COHORT-0245")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("keyboard navigation reaches far options and commits with Enter", async ({
  page,
}) => {
  await page.goto("/virtualized/");
  const listbox = page.locator("#vl-listbox");
  await listbox.focus();
  for (let press = 0; press < 12; press += 1) {
    await listbox.press("PageDown");
  }
  await listbox.press("Enter");
  await expect(page.locator("#vl-committed")).toHaveText("COHORT-0085");
  await expect(page.locator("#vl-opt-COHORT-0085")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("the committed selection survives a rerender of the listbox", async ({
  page,
}) => {
  await page.goto("/virtualized/");
  await page.locator("#vl-opt-COHORT-0003").click();
  await expect(page.locator("#vl-committed")).toHaveText("COHORT-0003");
  await page.locator("#vl-rerender").click();
  await expect(page.locator("#vl-render-count")).toHaveText("2");
  await expect(page.locator("#vl-committed")).toHaveText("COHORT-0003");
  await expect(page.locator("#vl-opt-COHORT-0003")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
