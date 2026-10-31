import { test, expect } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:4762/";
const labels = [
  "Home",
  "Jobs",
  "Tracker",
  "Documents / Resumes",
  "Profile",
  "Settings",
  "Diagnostics",
];

test("seven real destinations preserve current state, history and heading focus", async ({
  page,
}) => {
  await page.goto(ORIGIN);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveText(labels);
  await expect(page.getByRole("main")).toHaveCount(1);
  await nav.getByRole("link", { name: "Jobs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Jobs", exact: true }),
  ).toBeFocused();
  await expect(
    nav.getByRole("link", { name: "Jobs", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("Job discovery is not available in this build."),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Jobs", exact: true }),
  ).toBeFocused();
  for (const label of labels) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
  await expect(page.getByText("2.12.4", { exact: true })).toBeVisible();
});

test("keyboard skip link, reverse tab and visible focus work without a pointer", async ({
  page,
}) => {
  await page.goto(ORIGIN);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  const outline = await skip.evaluate((element) => ({
    style: getComputedStyle(element).outlineStyle,
    width: parseFloat(getComputedStyle(element).outlineWidth),
  }));
  expect(outline.style).toBe("solid");
  expect(outline.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Open Diagnostics" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Diagnostics", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Diagnostics", exact: true }),
  ).toBeFocused();
});

test("pending versions announce loading then show validated values", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=pending#diagnostics`);
  await expect(page.getByRole("status")).toHaveText(
    "Reading desktop version information…",
  );
  await page.evaluate(() => {
    const fixture = (
      window as typeof window & {
        __desktopFixture: {
          resolveRead(
            index: number,
            value: { appVersion: string; tauriVersion: string },
          ): void;
        };
      }
    ).__desktopFixture;
    fixture.resolveRead(0, { appVersion: "0.0.1", tauriVersion: "2.12.4" });
  });
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
});

test("safe error retry recovers and returns focus without displaying raw exceptions", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=retry#diagnostics`);
  await expect(page.getByRole("alert")).toContainText(
    "Version information is unavailable.",
  );
  await expect(page.locator("body")).not.toContainText(
    "fixture-private-secret",
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("0.0.1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Desktop versions" }),
  ).toBeFocused();
});

test("late route results cannot replace a fresh version read", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=pending#diagnostics`);
  await expect(page.getByRole("status")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Jobs", exact: true })
    .click();
  await page.evaluate(() => {
    (
      window as typeof window & {
        __desktopFixture: {
          resolveRead(
            index: number,
            value: { appVersion: string; tauriVersion: string },
          ): void;
        };
      }
    ).__desktopFixture.resolveRead(0, {
      appVersion: "9.9.9",
      tauriVersion: "9.9.9",
    });
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Diagnostics", exact: true })
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("9.9.9");
  await page.evaluate(() => {
    (
      window as typeof window & {
        __desktopFixture: {
          resolveRead(
            index: number,
            value: { appVersion: string; tauriVersion: string },
          ): void;
        };
      }
    ).__desktopFixture.resolveRead(1, {
      appVersion: "0.0.2",
      tauriVersion: "2.12.4",
    });
  });
  await expect(page.getByText("0.0.2", { exact: true })).toBeVisible();
});

test("invalid native versions and absent native IPC fail safely", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=malformed#diagnostics`);
  await expect(page.getByRole("alert")).toContainText("unexpected response");
  await expect(page.locator("img")).toHaveCount(0);
  await page.goto(`${ORIGIN}?scenario=native-unavailable#diagnostics`);
  await expect(page.getByRole("alert")).toContainText(
    "Open this view in the desktop app",
  );
  await expect(page.locator("body")).not.toContainText("__TAURI_INTERNALS__");
});

test("render boundary reset restores usable content and keyboard focus", async ({
  page,
}) => {
  await page.goto(`${ORIGIN}?scenario=render-error`);
  await expect(page.getByRole("alert")).toContainText(
    "This view could not be displayed.",
  );
  await expect(page.locator("body")).not.toContainText(
    "fixture-render-private-secret",
  );
  await page.evaluate(() => {
    (
      window as typeof window & { __desktopFixture: { stopThrowing(): void } }
    ).__desktopFixture.stopThrowing();
  });
  await page.getByRole("button", { name: "Reload view" }).click();
  await expect(
    page.getByRole("heading", { name: "Recovered view" }),
  ).toBeVisible();
  await expect(page.locator(".ui-boundary-content")).toBeFocused();
});
