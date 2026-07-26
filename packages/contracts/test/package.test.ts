import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index.js";

interface PackageManifest {
  name: string;
}

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("workspace wiring", () => {
  it("module name matches the package manifest", () => {
    expect(PACKAGE_NAME).toBe(manifest.name);
  });
});
