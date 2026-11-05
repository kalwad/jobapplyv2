import { test, expect } from "@playwright/test";
import { SHELL_CAPTURE_CASES } from "../../apps/desktop/test/renderer/catalog.ts";
import {
  captureShellSurface,
  captureSource,
} from "./support/desktop-capture.ts";

test.use({
  deviceScaleFactor: 1,
  colorScheme: "light",
  contextOptions: { reducedMotion: "reduce" },
});

for (const { surface, viewport } of SHELL_CAPTURE_CASES) {
  test(`catalog capture ${surface.fixtureId} ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
    browser,
  }, testInfo) => {
    const sourceBefore = captureSource();
    await page.setViewportSize(viewport);
    await page.goto(
      new URL(surface.href, "http://127.0.0.1:4762/catalog.html").href,
    );
    await expect(
      page.getByRole("heading", { name: surface.label, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link"),
    ).toHaveCount(7);
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
        name: surface.label,
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    if (surface.unavailableMessage !== null)
      await expect(page.getByText(surface.unavailableMessage)).toBeVisible();
    if (surface.destinationId === "diagnostics") {
      await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Local service diagnostics are unavailable."),
      ).toBeVisible();
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      background: getComputedStyle(document.body).backgroundImage,
      animations: document.getAnimations().length,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.width);
    expect(layout.background).toBe("none");
    expect(layout.animations).toBe(0);
    await expect(page.locator("body")).toContainText(
      "No application submission is available in this build.",
    );
    await captureShellSurface({
      page,
      browser,
      testInfo,
      fixtureId: surface.fixtureId,
      sourceBefore,
    });
  });
}
