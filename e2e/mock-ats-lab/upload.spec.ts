// MAL-UPL-001: local file selection with accepted-type/size behavior,
// rejection of wrong types, deterministic metadata display, and no upload
// anywhere. Files are synthetic in-memory buffers only.
import { expect, test } from "./support/lab-test.ts";

const SYNTHETIC_PDF = Buffer.from(
  "%PDF-1.4\n% synthetic mock ATS lab fixture bytes\n".repeat(8),
  "utf8",
);

test("an accepted synthetic file shows exact deterministic metadata", async ({
  page,
}) => {
  await page.goto("/upload/");
  await page.locator("#up-file").setInputFiles({
    name: "synthetic-resume.pdf",
    mimeType: "application/pdf",
    buffer: SYNTHETIC_PDF,
  });
  await expect(page.locator("#up-status")).toContainText("ACCEPTED_LOCALLY");
  await expect(page.locator("#up-name")).toHaveText("synthetic-resume.pdf");
  await expect(page.locator("#up-type")).toHaveText("application/pdf");
  await expect(page.locator("#up-size")).toHaveText(
    `${String(SYNTHETIC_PDF.byteLength)} bytes`,
  );
});

test("a rejected type clears the selection with an explicit reason", async ({
  page,
}) => {
  await page.goto("/upload/");
  await page.locator("#up-file").setInputFiles({
    name: "synthetic-image.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-really-a-png", "utf8"),
  });
  await expect(page.locator("#up-status")).toContainText("REJECTED_TYPE");
  await expect(page.locator("#up-name")).toHaveText("");
  const value = await page
    .locator("#up-file")
    .evaluate((node) => (node as HTMLInputElement).value);
  expect(value).toBe("");
});

test("an oversize file is rejected by the deterministic size rule", async ({
  page,
}) => {
  await page.goto("/upload/");
  await page.locator("#up-file").setInputFiles({
    name: "oversize.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(512_001, 0x61),
  });
  await expect(page.locator("#up-status")).toContainText("REJECTED_SIZE");
  await expect(page.locator("#up-name")).toHaveText("");
});

test("clearing the selection returns to the NO_FILE state", async ({
  page,
}) => {
  await page.goto("/upload/");
  await page.locator("#up-file").setInputFiles({
    name: "synthetic-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("synthetic note", "utf8"),
  });
  await expect(page.locator("#up-status")).toContainText("ACCEPTED_LOCALLY");
  await page.locator("#up-file").setInputFiles([]);
  await expect(page.locator("#up-status")).toHaveText("NO_FILE");
  await expect(page.locator("#up-name")).toHaveText("");
});
