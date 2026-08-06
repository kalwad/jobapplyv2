// MAL-NAT-001, MAL-NAT-002, MAL-NAT-003, MAL-NAT-004: native controls,
// required/optional and native validation semantics, realistic sensitive
// fields, and the hidden honeypot that rejects a populated submission.
import { expect, test } from "./support/lab-test.ts";

test("empty required native fields block the local save with errors", async ({
  page,
}) => {
  await page.goto("/native/");
  await page.getByRole("button", { name: "Save candidate details" }).click();
  await expect(page.locator("#nat-status")).toHaveText(
    "VALIDATION_FAILED: resolve the highlighted fields.",
  );
  await expect(page.locator("#nat-first-name-error")).not.toHaveText("");
  await expect(page.locator("#nat-email-error")).not.toHaveText("");
  const firstNameInvalid = await page
    .locator("#nat-first-name")
    .evaluate((node) => !(node as HTMLInputElement).validity.valid);
  expect(firstNameInvalid).toBe(true);
});

test("native email type mismatch is reported and clears when corrected", async ({
  page,
}) => {
  await page.goto("/native/");
  await page.locator("#nat-email").fill("not-an-email");
  await page.getByRole("button", { name: "Save candidate details" }).click();
  await expect(page.locator("#nat-email-error")).not.toHaveText("");
  await page.locator("#nat-email").fill("avery.applicant@example.test");
  await page.getByRole("button", { name: "Save candidate details" }).click();
  await expect(page.locator("#nat-email-error")).toHaveText("");
});

test("a complete valid native form is accepted with persisted values", async ({
  page,
}) => {
  await page.goto("/native/");
  await page.locator("#nat-first-name").fill("Avery");
  await page.locator("#nat-last-name").fill("Applicant");
  await page.locator("#nat-email").fill("avery.applicant@example.test");
  await page.locator("#nat-phone").fill("555-0100");
  await page.locator("#nat-notice-years").fill("2");
  await page.locator("#nat-summary").fill("Synthetic summary only.");
  await page.locator("#nat-work-mode").selectOption("hybrid");
  await page.locator("#nat-start-date").fill("2026-09-01");
  await page.locator("#nat-type-full").check();
  await page.locator("#nat-updates").check();
  await page.locator("#nat-auth-yes").check();
  await page.locator("#nat-disclosure").selectOption("not-veteran");
  await page.getByRole("button", { name: "Save candidate details" }).click();
  await expect(page.locator("#nat-status")).toHaveText(
    "SAVED_LOCALLY: candidate details accepted by the fixture.",
  );
  await expect(page.locator("#nat-work-mode")).toHaveValue("hybrid");
  await expect(page.locator("#nat-start-date")).toHaveValue("2026-09-01");
  await expect(page.locator("#nat-type-full")).toBeChecked();
});

test("sensitive fixtures render realistically without fixture metadata", async ({
  page,
}) => {
  await page.goto("/native/");
  await expect(
    page.getByRole("group", {
      name: /legally authorized to work/,
    }),
  ).toBeVisible();
  await expect(page.locator("#nat-disclosure")).toBeVisible();
  const leakedAttributes = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("*"));
    return nodes.flatMap((node) =>
      node
        .getAttributeNames()
        .filter(
          (name) =>
            name.startsWith("data-sensitive") ||
            name.startsWith("data-expected") ||
            name.startsWith("data-honeypot"),
        ),
    );
  });
  expect(leakedAttributes).toEqual([]);
});

test("the honeypot is present, hidden, blank, and rejects when populated", async ({
  page,
}) => {
  await page.goto("/native/");
  const honeypot = page.locator("#nat-company-site");
  await expect(honeypot).toHaveCount(1);
  const concealment = await honeypot.evaluate((node) => {
    const wrapper = node.parentElement;
    const wrapperStyle =
      wrapper === null ? null : window.getComputedStyle(wrapper);
    const box = node.getBoundingClientRect();
    return {
      ariaHidden: wrapper?.getAttribute("aria-hidden") ?? null,
      position: wrapperStyle?.position ?? null,
      overflow: wrapperStyle?.overflow ?? null,
      wrapperWidth: wrapper?.getBoundingClientRect().width ?? -1,
      offViewportLeft: box.right < 0,
    };
  });
  expect(concealment.ariaHidden).toBe("true");
  expect(concealment.position).toBe("absolute");
  expect(concealment.overflow).toBe("hidden");
  expect(concealment.wrapperWidth).toBeLessThanOrEqual(1);
  expect(concealment.offViewportLeft).toBe(true);
  await expect(honeypot).toHaveValue("");
  const required = await honeypot.evaluate((node) =>
    (node as HTMLInputElement).hasAttribute("required"),
  );
  expect(required).toBe(false);

  await page.locator("#nat-first-name").fill("Avery");
  await page.locator("#nat-last-name").fill("Applicant");
  await page.locator("#nat-email").fill("avery.applicant@example.test");
  await page.locator("#nat-work-mode").selectOption("remote");
  await page.locator("#nat-start-date").fill("2026-09-01");
  await page.locator("#nat-type-contract").check();
  await page.locator("#nat-auth-yes").check();
  await honeypot.evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "https-like bot content";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Save candidate details" }).click();
  await expect(page.locator("#nat-status")).toHaveText(
    "REJECTED_HONEYPOT: automated form tampering detected (fixture rejection).",
  );
});
