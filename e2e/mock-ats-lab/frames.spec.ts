// MAL-FRM-001: same-origin iframe with meaningful controls, frame-local
// validation, and clear frame-local page identity.
import { expect, test } from "./support/lab-test.ts";

test("the embedded frame carries its own identity and validation state", async ({
  page,
}) => {
  await page.goto("/frames/");
  const frame = page.frameLocator("#frames-embed");
  await expect(frame.locator("body")).toHaveAttribute(
    "data-frame-id",
    "inner-application-frame",
  );
  await frame.getByRole("button", { name: "Save section" }).click();
  await expect(frame.locator("#frame-reference-error")).toHaveText(
    "Reference number is required inside this frame.",
  );
  await expect(frame.locator("#frame-status")).toHaveText(
    "FRAME_VALIDATION_FAILED",
  );
  await frame.locator("#frame-reference").fill("SYN-REF-0042");
  await frame.locator("#frame-consent").check();
  await frame.getByRole("button", { name: "Save section" }).click();
  await expect(frame.locator("#frame-status")).toHaveText(
    "FRAME_SECTION_SAVED",
  );
  await expect(frame.locator("#frame-reference")).toHaveValue("SYN-REF-0042");
});

test("frame state stays isolated from the host document", async ({ page }) => {
  await page.goto("/frames/");
  const frame = page.frameLocator("#frames-embed");
  await frame.locator("#frame-reference").fill("SYN-REF-0042");
  const hostSeesControl = await page.evaluate(
    () => document.getElementById("frame-reference") !== null,
  );
  expect(hostSeesControl).toBe(false);
  const frameUrl = await page
    .locator("#frames-embed")
    .evaluate(
      (node) => (node as HTMLIFrameElement).contentWindow?.location.pathname,
    );
  expect(frameUrl).toBe("/frames/inner/");
});
