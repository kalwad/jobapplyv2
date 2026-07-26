// Browser-toolchain infrastructure smoke test (M00-W03).
//
// This test proves exactly one thing: the pinned Playwright + Chromium
// toolchain can launch, render controlled inline content, and execute
// JavaScript on this machine. It makes NO claim about the desktop app,
// extension, mock ATS lab, or autofill — none of those exist yet, and
// their tests arrive with their owning milestones (spec §1.5: no fake
// integrations or mocked product behavior).
import { expect, test } from "@playwright/test";

test("pinned Chromium launches, renders controlled content, and executes JavaScript", async ({
  browser,
  page,
}) => {
  test.info().annotations.push({
    type: "chromium-version",
    description: browser.version(),
  });

  await page.setContent(
    "<!doctype html><html><head><title>browser infrastructure probe</title></head>" +
      '<body><h1 id="probe">toolchain smoke</h1></body></html>',
  );

  await expect(page).toHaveTitle("browser infrastructure probe");
  await expect(page.locator("#probe")).toHaveText("toolchain smoke");

  const arithmetic = await page.evaluate(() => 21 * 2);
  expect(arithmetic).toBe(42);

  expect(browser.version()).not.toHaveLength(0);
});
