import { test, expect } from "@playwright/test";
const ORIGIN =
  process.env.JAPP_DESKTOP_E2E_ORIGIN ?? "http://127.0.0.1:4762/service.html";
test("actual browser preview remains unavailable and preserves desktop version reads", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=browser#diagnostics`);
  await expect(
    page.getByText("Local service diagnostics are unavailable."),
  ).toBeVisible();
  await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
  await expect(page.getByText("2.12.4", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel check" })).toHaveCount(
    0,
  );
});
test("synthetic ready record shows only finite safe service versions and timestamp", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=ready#diagnostics`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("0.0.2", { exact: true })).toBeVisible();
  await expect(page.getByText("1.0.0", { exact: true })).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute(
    "datetime",
    "2026-10-18T12:00:00Z",
  );
  await expect(page.locator("body")).not.toContainText("127.0.0.1");
  await expect(page.locator("body")).not.toContainText("svc_");
});
test("keyboard cancellation sends a synthetic finite command and keeps heading focus", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}#diagnostics`);
  const cancel = page.getByRole("button", { name: "Cancel check" });
  await expect(cancel).toBeVisible();
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Service check cancelled.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Local service", exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.__serviceFixture.cancels()))
    .toBe(1);
});
test("route departure sends synthetic cancellation and discards an old result", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}#diagnostics`);
  await expect(page.getByText("Checking the local service…")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Jobs", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__serviceFixture.cancels()))
    .toBe(1);
  await page.evaluate(() => {
    window.__serviceFixture.resolve(0);
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Diagnostics", exact: true })
    .click();
  await expect(page.getByText("Checking the local service…")).toBeVisible();
  await expect(page.getByText("0.0.2", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    window.__serviceFixture.resolve(1);
  });
  await expect(page.getByText("0.0.2", { exact: true })).toBeVisible();
});
test("canonical safe error retry recovers without replacing native metadata or focus", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=retry#diagnostics`);
  await expect(page.getByRole("alert")).toContainText(
    "A component did not respond in time.",
  );
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Local service", exact: true }),
  ).toBeFocused();
  await expect(page.getByText("2.12.4", { exact: true })).toBeVisible();
});
test("synthetic malformed private data never becomes renderer content", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=malformed#diagnostics`);
  await expect(page.getByRole("alert")).toContainText("could not be checked");
  await expect(page.locator("body")).not.toContainText(
    "fixture-private-service-secret",
  );
  await expect(page.getByText("Ready", { exact: true })).toHaveCount(0);
});
