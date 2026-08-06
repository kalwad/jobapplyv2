// Static source policy for the mock ATS lab (M02-W03): no external URLs
// or live form actions, no HTML-injection sinks, no nondeterminism
// sources, no network APIs in page code, and no expected-result leakage
// into the served DOM.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const siteRoot = join(packageRoot, "site");

function walk(root: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "dist") {
        continue;
      }
      found.push(...walk(path));
    } else {
      found.push(path);
    }
  }
  return found.sort((left, right) => (left < right ? -1 : 1));
}

const sourceFiles = walk(join(siteRoot, "src")).filter((path) =>
  path.endsWith(".ts"),
);
const htmlFiles = walk(siteRoot).filter((path) => path.endsWith(".html"));

const read = (path: string): string => readFileSync(path, "utf8");

describe("no external network surface", () => {
  it("keeps every TypeScript page free of absolute external URLs", () => {
    for (const path of sourceFiles) {
      const text = read(path);
      expect(text, path).not.toMatch(/https?:\/\//);
      expect(text, path).not.toMatch(/wss?:\/\//);
    }
  });

  it("keeps HTML entries relative with no external references", () => {
    for (const path of htmlFiles) {
      const text = read(path);
      expect(text, path).not.toMatch(/https?:\/\//);
      expect(text, path).not.toMatch(/<form[^>]*action=/);
      expect(text, path).not.toMatch(/integrity=|crossorigin=/);
    }
  });

  it("uses no browser network APIs in page code", () => {
    for (const path of sourceFiles) {
      const text = read(path);
      expect(text, path).not.toMatch(/\bfetch\s*\(/);
      expect(text, path).not.toMatch(/XMLHttpRequest/);
      expect(text, path).not.toMatch(/WebSocket/);
      expect(text, path).not.toMatch(/sendBeacon/);
      expect(text, path).not.toMatch(/EventSource/);
      expect(text, path).not.toMatch(/navigator\.serviceWorker/);
    }
  });
});

describe("no HTML-injection sinks", () => {
  it("renders untrusted-looking strings through text nodes only", () => {
    for (const path of sourceFiles) {
      const text = read(path);
      expect(text, path).not.toMatch(/innerHTML|outerHTML/);
      expect(text, path).not.toMatch(/insertAdjacentHTML/);
      expect(text, path).not.toMatch(/dangerouslySetInnerHTML/);
      expect(text, path).not.toMatch(/document\.write/);
      expect(text, path).not.toMatch(/\beval\s*\(/);
      expect(text, path).not.toMatch(/new\s+Function\s*\(/);
      expect(text, path).not.toMatch(/createContextualFragment/);
    }
  });
});

describe("determinism sources", () => {
  it("never uses randomness or wall-clock identity in page code", () => {
    for (const path of sourceFiles) {
      const text = read(path);
      expect(text, path).not.toMatch(/Math\.random/);
      expect(text, path).not.toMatch(/Date\.now/);
      expect(text, path).not.toMatch(/new Date\(/);
      expect(text, path).not.toMatch(/crypto\.getRandomValues/);
      expect(text, path).not.toMatch(/performance\.now/);
    }
  });
});

describe("no expected-result leakage", () => {
  it("keeps expected test truth out of served markup and page code", () => {
    for (const path of [...sourceFiles, ...htmlFiles]) {
      const text = read(path);
      expect(text, path).not.toMatch(/data-expected/i);
      expect(text, path).not.toMatch(/expectedValue|expectedResult/);
      expect(text, path).not.toMatch(/data-sensitive|data-honeypot/i);
      expect(text, path).not.toMatch(/groundTruth|ground-truth/i);
    }
  });
});
