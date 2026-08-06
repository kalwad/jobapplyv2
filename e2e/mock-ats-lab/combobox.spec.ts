// MAL-CBX-001 and MAL-CBX-002: ARIA combobox with filtering, keyboard
// selection, exact option identity, empty/no-match state, and required
// commit validation; plus a keyboard-driven single-select ARIA listbox.
import { expect, test } from "./support/lab-test.ts";

test("the combobox filters, tracks the active option, and commits by keyboard", async ({
  page,
}) => {
  await page.goto("/combobox/");
  const input = page.locator("#cbx-input");
  await input.click();
  await input.pressSequentially("har");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const options = page.locator('#cbx-listbox [role="option"]');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveText("Harbor Point (synthetic)");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    "cbx-opt-harbor-point-synthetic",
  );
  await input.press("Enter");
  await expect(input).toHaveValue("Harbor Point (synthetic)");
  await expect(page.locator("#cbx-committed")).toHaveText(
    "Harbor Point (synthetic)",
  );
  await expect(input).toHaveAttribute("aria-expanded", "false");
});

test("arrow keys walk the filtered options with exact identity", async ({
  page,
}) => {
  await page.goto("/combobox/");
  const input = page.locator("#cbx-input");
  await input.click();
  await input.pressSequentially("a");
  const optionIds = await page
    .locator('#cbx-listbox [role="option"]')
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(optionIds.length).toBeGreaterThan(2);
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    optionIds[1] ?? "",
  );
  await input.press("ArrowUp");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    optionIds[0] ?? "",
  );
});

test("a query with no match shows the empty state and commits nothing", async ({
  page,
}) => {
  await page.goto("/combobox/");
  const input = page.locator("#cbx-input");
  await input.click();
  await input.pressSequentially("zzz-no-such-place");
  await expect(page.locator("#cbx-empty")).toBeVisible();
  await expect(page.locator('#cbx-listbox [role="option"]')).toHaveCount(0);
  await input.press("Enter");
  await expect(page.locator("#cbx-committed")).toHaveText("");
});

test("the required-selection check reports and clears deterministically", async ({
  page,
}) => {
  await page.goto("/combobox/");
  await page.locator("#cbx-check").click();
  await expect(page.locator("#cbx-error")).toHaveText(
    "Select an office location from the list.",
  );
  const input = page.locator("#cbx-input");
  await input.click();
  await input.pressSequentially("cedar");
  await input.press("Enter");
  await page.locator("#cbx-check").click();
  await expect(page.locator("#cbx-error")).toHaveText("");
});

test("the listbox selects by keyboard with aria-selected identity", async ({
  page,
}) => {
  await page.goto("/combobox/");
  const listbox = page.locator("#lbx-channel");
  await listbox.focus();
  await listbox.press("ArrowDown");
  await expect(listbox).toHaveAttribute(
    "aria-activedescendant",
    "lbx-opt-phone-call-synthetic",
  );
  await listbox.press("Enter");
  await expect(page.locator("#lbx-committed")).toHaveText(
    "Phone call (synthetic)",
  );
  await expect(page.locator("#lbx-opt-phone-call-synthetic")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#lbx-opt-email-synthetic")).toHaveAttribute(
    "aria-selected",
    "false",
  );
});
