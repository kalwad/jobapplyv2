import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FEASIBILITY_CONTENT_MATCHES } from "../../../src/feasibility-protocol.ts";
import {
  PUBLIC_CONTENT_MATCHES,
  PUBLIC_SOURCES,
  permitsPublicDocumentUrl,
  SOURCE_INVENTORY_DIGEST,
} from "./scope.ts";

describe("W14 public inspection scope", () => {
  it("contains exactly the dated 10/8/8/4 source inventory", () => {
    const matrixBytes = readFileSync(
      new URL(
        "../../../../../docs/evidence/m02-w14-external/public-current-matrix.json",
        import.meta.url,
      ),
    );
    expect(
      `sha256:${createHash("sha256").update(matrixBytes).digest("hex")}`,
    ).toBe(SOURCE_INVENTORY_DIGEST);
    const matrix = JSON.parse(matrixBytes.toString("utf8")) as {
      rows: { evidence_row_id: string; ats: string; url: string }[];
    };
    expect(
      matrix.rows.map(({ evidence_row_id, ats, url }) => ({
        evidence_row_id,
        ats,
        url,
      })),
    ).toEqual(PUBLIC_SOURCES);
    expect(PUBLIC_SOURCES).toHaveLength(30);
    expect(new Set(PUBLIC_CONTENT_MATCHES).size).toBe(30);
    expect(
      Object.fromEntries(
        ["WORKDAY", "GREENHOUSE", "LEVER", "ASHBY"].map((family) => [
          family,
          PUBLIC_SOURCES.filter((row) => row.ats === family).length,
        ]),
      ),
    ).toEqual({ WORKDAY: 10, GREENHOUSE: 8, LEVER: 8, ASHBY: 4 });
    for (const url of PUBLIC_CONTENT_MATCHES)
      expect(permitsPublicDocumentUrl(url)).toBe(true);
  });
  it("rejects sibling jobs, redirects, extra components and lookalike origins", () => {
    const url = PUBLIC_CONTENT_MATCHES[0];
    if (url === undefined) throw new Error("scope empty");
    const parsed = new URL(url);
    for (const wrong of [
      `${url}/`,
      `${url}?other=1`,
      `${url}#other`,
      `${url}-other`,
      url.replace("https:", "http:"),
      url.replace(parsed.hostname, `${parsed.hostname}.example.invalid`),
      url.replace("https://", "https://user@"),
      url.replace(parsed.hostname, `${parsed.hostname}:444`),
      `${parsed.origin}/another-job/apply`,
      "http://127.0.0.1:4761/native/",
      "about:blank",
      "not a URL",
    ])
      expect(permitsPublicDocumentUrl(wrong), wrong).toBe(false);
  });
  it("leaves the default feasibility patterns and build independent", () => {
    expect([...FEASIBILITY_CONTENT_MATCHES]).toEqual([
      "http://127.0.0.1:4761/*",
      "http://127.0.0.1:4762/*",
    ]);
    const config = readFileSync(
      new URL("../../../wxt.config.ts", import.meta.url),
      "utf8",
    );
    expect(config).not.toContain("public-inspection");
    const content = readFileSync(
      new URL("../../../entrypoints/feasibility.content.ts", import.meta.url),
      "utf8",
    );
    expect(content).toContain("matches: [...FEASIBILITY_CONTENT_MATCHES]");
    expect(content).toContain("allFrames: true");
  });
  it("has no public action dispatcher or DOM marker mutation", () => {
    const worker = readFileSync(
      new URL("./entrypoints/background.ts", import.meta.url),
      "utf8",
    );
    const content = readFileSync(
      new URL("./entrypoints/inspection.content.ts", import.meta.url),
      "utf8",
    );
    for (const source of [worker, content]) {
      for (const forbidden of [
        "parseExecute",
        "parseUndo",
        "parseDynamicExecute",
        "executeDecisions(",
        ".execute(",
        ".click(",
        ".submit(",
        "requestSubmit",
        "setAttribute(",
        "innerHTML",
        "fetch(",
        "XMLHttpRequest",
      ])
        expect(source).not.toContain(forbidden);
    }
    expect(content).toContain(
      "!permitsPublicDocumentUrl(document.location.href)",
    );
    expect(content).toContain("allFrames: false");
  });
});
