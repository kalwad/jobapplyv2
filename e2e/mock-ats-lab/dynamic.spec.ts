// MAL-DYN-001, MAL-DYN-002, MAL-DYN-003: conditional insertion/removal
// with dependent required state, fixed-delay deterministic insertion, and
// node replacement beside a stable control.
import { expect, test } from "./support/lab-test.ts";

test("checking the referral toggle inserts a required field and unchecking removes it", async ({
  page,
}) => {
  await page.goto("/dynamic/");
  await expect(page.locator("#dyn-referral-code")).toHaveCount(0);
  await page.locator("#dyn-referral-toggle").check();
  await expect(page.locator("#dynamic-status")).toHaveText(
    "REFERRAL_FIELD_INSERTED",
  );
  const inserted = page.locator("#dyn-referral-code");
  await expect(inserted).toBeVisible();
  const required = await inserted.evaluate((node) =>
    (node as HTMLInputElement).hasAttribute("required"),
  );
  expect(required).toBe(true);
  await page.locator("#dyn-referral-toggle").uncheck();
  await expect(page.locator("#dynamic-status")).toHaveText(
    "REFERRAL_FIELD_REMOVED",
  );
  await expect(page.locator("#dyn-referral-code")).toHaveCount(0);
});

test("the country choice drives the region field's required state", async ({
  page,
}) => {
  await page.goto("/dynamic/");
  const region = page.locator("#dyn-region");
  const initiallyRequired = await region.evaluate((node) =>
    (node as HTMLInputElement).hasAttribute("required"),
  );
  expect(initiallyRequired).toBe(false);
  await page.locator("#dyn-country").selectOption("examplia");
  await expect(page.locator("#dynamic-status")).toHaveText(
    "REGION_NOW_REQUIRED",
  );
  const nowRequired = await region.evaluate((node) =>
    (node as HTMLInputElement).hasAttribute("required"),
  );
  expect(nowRequired).toBe(true);
  await page.locator("#dyn-country").selectOption("testland");
  await expect(page.locator("#dynamic-status")).toHaveText(
    "REGION_NOW_OPTIONAL",
  );
});

test("additional questions mount after the fixed deterministic delay", async ({
  page,
}) => {
  await page.goto("/dynamic/");
  await expect(page.locator("#dyn-clearance")).toHaveCount(0);
  await page.locator("#dyn-load-questions").click();
  await expect(page.locator("#dynamic-status")).toHaveText(
    "ADDITIONAL_QUESTIONS_LOADING",
  );
  await expect(page.locator("#dynamic-status")).toHaveText(
    "ADDITIONAL_QUESTIONS_LOADED",
  );
  await expect(page.locator("#dyn-clearance")).toBeVisible();
  await expect(page.locator("#dyn-portfolio")).toBeVisible();
  await expect(page.locator("#dyn-load-questions")).toBeDisabled();
});

test("replacement creates a new node while the stable control keeps identity and value", async ({
  page,
}) => {
  await page.goto("/dynamic/");
  await page.locator("#dyn-stable").fill("stable-value");
  await page.locator("#dyn-replaceable").fill("first-generation-value");
  const markers = await page.evaluate(() => {
    const stable = document.getElementById("dyn-stable") as HTMLInputElement;
    const replaceable = document.getElementById(
      "dyn-replaceable",
    ) as HTMLInputElement;
    stable.dataset.identityMarker = "stable-marker";
    replaceable.dataset.identityMarker = "replaceable-marker";
    return {
      generation: replaceable.getAttribute("data-node-generation"),
    };
  });
  expect(markers.generation).toBe("1");
  await page.locator("#dyn-replace-node").click();
  await expect(page.locator("#dynamic-status")).toHaveText(
    "NODE_REPLACED_GENERATION_2",
  );
  const after = await page.evaluate(() => {
    const stable = document.getElementById("dyn-stable") as HTMLInputElement;
    const replaceable = document.getElementById(
      "dyn-replaceable",
    ) as HTMLInputElement;
    return {
      stableMarker: stable.dataset.identityMarker ?? null,
      stableValue: stable.value,
      replaceableMarker: replaceable.dataset.identityMarker ?? null,
      replaceableValue: replaceable.value,
      generation: replaceable.getAttribute("data-node-generation"),
    };
  });
  expect(after.stableMarker).toBe("stable-marker");
  expect(after.stableValue).toBe("stable-value");
  expect(after.replaceableMarker).toBeNull();
  expect(after.replaceableValue).toBe("");
  expect(after.generation).toBe("2");
});
