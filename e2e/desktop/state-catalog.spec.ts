import { test, expect } from "@playwright/test";
import {
  SHARED_STATES,
  SHELL_SURFACES,
} from "../../apps/desktop/test/renderer/catalog.ts";

const CATALOG = "http://127.0.0.1:4762/catalog.html";

test("catalog discovers the real shell and shared states without unavailable actions", async ({
  page,
}) => {
  await page.goto(CATALOG);
  const shell = page.getByRole("region", { name: "Shell surfaces" });
  const states = page.getByRole("region", { name: "Shared states" });
  await expect(shell.getByRole("link")).toHaveText(
    SHELL_SURFACES.map(({ label }) => label),
  );
  await expect(states.getByRole("link")).toHaveText(
    SHARED_STATES.map(({ label }) => label),
  );
  for (const fixture of [...SHELL_SURFACES, ...SHARED_STATES]) {
    await expect(
      page.getByRole("link", { name: fixture.label, exact: true }),
    ).toHaveAttribute("href", fixture.href);
  }
  await expect(page.getByRole("button")).toHaveCount(0);
  for (const width of [1120, 320]) {
    await page.setViewportSize({ width, height: 760 });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
  await shell.getByRole("link", { name: "Jobs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Jobs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Job discovery is not available in this build."),
  ).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("catalog render-boundary fixture recovers through its real keyboard retry", async ({
  page,
}) => {
  await page.goto(CATALOG);
  await page
    .getByRole("link", { name: "Render boundary and recovery", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "This view could not be displayed.",
  );
  await expect(page.locator("body")).not.toContainText(
    "fixture-render-private-secret",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Reload view" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Recovered view", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".ui-boundary-content")).toBeFocused();
});
