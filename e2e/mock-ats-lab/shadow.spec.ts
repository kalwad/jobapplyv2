// MAL-SHD-001: an OPEN shadow root with a labeled control, deterministic
// value and validation behavior, and a stable host identity.
import { expect, test } from "./support/lab-test.ts";

test("the open shadow control validates and accepts values on a stable host", async ({
  page,
}) => {
  await page.goto("/shadow/");
  const host = page.locator("#shadow-host");
  await expect(host).toHaveCount(1);
  const shadowMode = await host.evaluate((node) =>
    node.shadowRoot === null ? "closed-or-none" : "open",
  );
  expect(shadowMode).toBe("open");

  const input = page.locator("#shadow-host #shadow-contact-name");
  const save = page.locator("#shadow-host #shadow-contact-save");
  await save.click();
  await expect(page.locator("#shadow-host #shadow-contact-error")).toHaveText(
    "Emergency contact name is required.",
  );
  await expect(page.locator("#shadow-host #shadow-contact-status")).toHaveText(
    "SHADOW_VALIDATION_FAILED",
  );

  await input.fill("Rowan Example");
  await save.click();
  await expect(page.locator("#shadow-host #shadow-contact-status")).toHaveText(
    "SHADOW_SAVED:Rowan Example",
  );
  await expect(input).toHaveValue("Rowan Example");
});

test("the shadow control is labeled accessibly inside the shadow root", async ({
  page,
}) => {
  await page.goto("/shadow/");
  const labelText = await page
    .locator("#shadow-host")
    .evaluate(
      (node) =>
        node.shadowRoot?.querySelector('label[for="shadow-contact-name"]')
          ?.textContent ?? "",
    );
  expect(labelText).toBe("Emergency contact name (required)");
});
