// MAL-IDX-001: the catalog index exposes every fixture case, and the
// test-side expected-transition catalog covers the app catalog 1:1.
import {
  FIXTURE_CASES,
  FIXTURE_ROUTES,
} from "../../apps/mock-ats-lab/site/src/catalog/cases.ts";
import { EXPECTED_TRANSITIONS } from "./support/expected-transitions.ts";
import { expect, test } from "./support/lab-test.ts";

test("index page lists every catalog case with its route", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-lab-notice]")).toContainText(
    "never contacts a live employer",
  );
  const items = page.locator("#case-list li");
  await expect(items).toHaveCount(FIXTURE_CASES.length);
  for (const fixtureCase of FIXTURE_CASES) {
    const item = page.locator(
      `#case-list li[data-case-id="${fixtureCase.id}"]`,
    );
    await expect(item).toHaveCount(1);
    await expect(item.locator("a")).toHaveAttribute("href", fixtureCase.route);
  }
});

test("expected-transition catalog covers the app catalog exactly", () => {
  const appIds = FIXTURE_CASES.map((fixtureCase) => fixtureCase.id).sort(
    (left, right) => (left < right ? -1 : 1),
  );
  const expectedIds = Object.keys(EXPECTED_TRANSITIONS).sort((left, right) =>
    left < right ? -1 : 1,
  );
  expect(expectedIds).toEqual(appIds);
  for (const transitions of Object.values(EXPECTED_TRANSITIONS)) {
    expect(transitions.length).toBeGreaterThan(0);
  }
});

test("every catalog route serves a lab page with the synthetic notice", async ({
  page,
}) => {
  for (const route of FIXTURE_ROUTES) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    if (route !== "/frames/inner/") {
      await expect(
        page.locator("[data-lab-notice]"),
        `missing lab notice on ${route}`,
      ).toBeVisible();
    }
  }
});
