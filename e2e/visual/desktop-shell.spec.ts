import { test, expect } from "@playwright/test";

for (const size of [
  { width: 1120, height: 760 },
  { width: 320, height: 800 },
]) {
  test(`desktop shell layout and actual capture at ${String(size.width)}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await page.goto("http://127.0.0.1:4762/");
    await expect(
      page.getByRole("heading", { name: "Home", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(7);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      headingSize: parseFloat(
        getComputedStyle(document.querySelector("h1") ?? document.body)
          .fontSize,
      ),
      background: getComputedStyle(document.body).backgroundImage,
      animations: document.getAnimations().length,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.width);
    expect(layout.headingSize).toBeLessThanOrEqual(28);
    expect(layout.background).toBe("none");
    expect(layout.animations).toBe(0);
    const homeCapture = testInfo.outputPath("desktop-home.png");
    await page.screenshot({ path: homeCapture, fullPage: true });
    await testInfo.attach(`desktop-home-${String(size.width)}`, {
      path: homeCapture,
      contentType: "image/png",
    });
    await page.getByRole("link", { name: "Open Diagnostics" }).click();
    await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
    const diagnosticsCapture = testInfo.outputPath("desktop-diagnostics.png");
    await page.screenshot({ path: diagnosticsCapture, fullPage: true });
    await testInfo.attach(`desktop-diagnostics-${String(size.width)}`, {
      path: diagnosticsCapture,
      contentType: "image/png",
    });
  });
}

test("shell reflows under 200 percent text resize and reduced motion", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:4762/#diagnostics");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    animations: document.getAnimations().length,
    reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.width);
  expect(layout.reduce).toBe(true);
  expect(layout.animations).toBe(0);
  const resizeCapture = testInfo.outputPath("desktop-text-resize-200.png");
  await page.screenshot({ path: resizeCapture, fullPage: true });
  await testInfo.attach("desktop-text-resize-200", {
    path: resizeCapture,
    contentType: "image/png",
  });
});
