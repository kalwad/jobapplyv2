import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Browser, Page, TestInfo } from "@playwright/test";
import {
  CATALOG_VERSION,
  TOKEN_VERSION,
} from "../../../apps/desktop/test/renderer/catalog.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const MAX_SOURCE_BYTES = 131_072;
const MAX_CAPTURE_BYTES = 16_777_216;
const SOURCE_PATHS = [
  "apps/desktop/src/shell.tsx",
  "apps/desktop/src/navigation.ts",
  "apps/desktop/src/shell.css",
  "apps/desktop/src/diagnostics.tsx",
  "apps/desktop/src/native-metadata.ts",
  "apps/desktop/src/service-diagnostics.ts",
  "apps/desktop/src/service-diagnostics-panel.tsx",
  "packages/ui/src/index.ts",
  "packages/ui/src/navigation.tsx",
  "packages/ui/src/status.tsx",
  "packages/ui/src/error-boundary.tsx",
  "packages/ui/src/tokens.css",
  "apps/desktop/test/renderer/index.html",
  "apps/desktop/test/renderer/main.tsx",
  "apps/desktop/test/renderer/catalog.html",
  "apps/desktop/test/renderer/catalog-main.tsx",
  "apps/desktop/test/renderer/catalog.ts",
  "apps/desktop/vite.renderer.config.ts",
  "e2e/visual/desktop-catalog.spec.ts",
  "e2e/visual/support/desktop-capture.ts",
].toSorted();

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 3000,
    maxBuffer: 16_384,
  }).trim();
}

export function captureSource() {
  const files = SOURCE_PATHS.map((path) => {
    const bytes = readFileSync(new URL(`../../../${path}`, import.meta.url));
    if (bytes.byteLength > MAX_SOURCE_BYTES)
      throw new Error("Capture source exceeds its finite inventory limit");
    return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });
  const status = git([
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ...SOURCE_PATHS,
  ]);
  return {
    git_revision: git(["rev-parse", "HEAD"]),
    git_tree: git(["rev-parse", "HEAD^{tree}"]),
    selected_sources_match_revision: status.length === 0,
    selected_source_status: status,
    source_sha256: sha256(JSON.stringify(files)),
    files,
  };
}

export async function captureShellSurface({
  page,
  browser,
  testInfo,
  fixtureId,
  sourceBefore,
}: {
  readonly page: Page;
  readonly browser: Browser;
  readonly testInfo: TestInfo;
  readonly fixtureId: string;
  readonly sourceBefore: ReturnType<typeof captureSource>;
}): Promise<void> {
  const observed = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    device_scale_factor: devicePixelRatio,
    visual_scale: visualViewport?.scale ?? null,
    root_font_size: getComputedStyle(document.documentElement).fontSize,
    color_scheme: getComputedStyle(document.documentElement).colorScheme,
    prefers_light: matchMedia("(prefers-color-scheme: light)").matches,
    reduced_motion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    user_agent: navigator.userAgent,
  }));
  if (
    observed.device_scale_factor !== 1 ||
    observed.visual_scale !== 1 ||
    observed.root_font_size !== "16px" ||
    !observed.prefers_light
  ) {
    throw new Error(
      "Capture context does not match 100 percent light parameters",
    );
  }
  const basename = `${fixtureId}-${String(observed.viewport.width)}`;
  const path = testInfo.outputPath(`${basename}.png`);
  // No capture metadata or artifact hash is emitted before this actor completes.
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  const png = readFileSync(path);
  if (
    png.byteLength > MAX_CAPTURE_BYTES ||
    png.byteLength < 24 ||
    !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error("Actual capture is not a bounded PNG");
  }
  const sourceAfter = captureSource();
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter))
    throw new Error("Capture source/revision changed during the browser actor");
  const metadata = {
    schema: "DESKTOP_SHELL_CAPTURE_V1",
    state: "CAPTURED_NOT_REVIEWED",
    approval: "NOT_APPROVED",
    frozen_design_system: false,
    captured_at: new Date().toISOString(),
    catalog_version: CATALOG_VERSION,
    token_version: TOKEN_VERSION,
    fixture_id: fixtureId,
    fixture_url: page.url(),
    scope: "Shipping shell components with synthetic version loader",
    actual_native_ipc: false,
    native_service_proven: false,
    browser: { type: browser.browserType().name(), version: browser.version() },
    host: { platform: process.platform, architecture: process.arch },
    requested_zoom_percent: 100,
    requested_theme: "light",
    full_page: true,
    observed,
    source: sourceAfter,
    artifact: {
      filename: `${basename}.png`,
      bytes: png.byteLength,
      sha256: sha256(png),
      png_width: png.readUInt32BE(16),
      png_height: png.readUInt32BE(20),
    },
  };
  const metadataPath = testInfo.outputPath(`${basename}.json`);
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  await testInfo.attach(basename, { path, contentType: "image/png" });
  await testInfo.attach(`${basename}-metadata`, {
    path: metadataPath,
    contentType: "application/json",
  });
}
