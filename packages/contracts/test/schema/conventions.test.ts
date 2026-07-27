import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  buildStrictAjv,
  checkSchemaCatalogDocuments,
  checkSchemaDocument,
  expectedIdForPath,
  JSON_SCHEMA_DIALECT,
  loadSchemaCatalog,
  parseSchemaId,
  parseSchemaVersion,
  SCHEMA_ID_PATTERN,
  SchemaCatalogError,
  type JsonObject,
  type SchemaDocumentInput,
} from "../../src/index.js";

const catalog = loadSchemaCatalog();

function sampleDocument(overrides: JsonObject = {}): SchemaDocumentInput {
  return {
    relativePath: "common/sample.v1.schema.json",
    document: {
      $schema: JSON_SCHEMA_DIALECT,
      $id: "urn:japp:schema:common:sample:v1",
      title: "Sample",
      description: "In-memory convention-check sample document.",
      "x-japp-schema-version": "1.0.0",
      $defs: {
        token: { type: "string", minLength: 1 },
      },
      ...overrides,
    },
  };
}

describe("committed schema source conventions", () => {
  it("loads the canonical catalog with every foundational definition", () => {
    const ids = catalog.entries.map((entry) => entry.id);
    expect(ids).toEqual([
      "urn:japp:schema:common:calendar-date:v1",
      "urn:japp:schema:common:confidence:v1",
      "urn:japp:schema:common:correlation:v1",
      "urn:japp:schema:common:enum-token:v1",
      "urn:japp:schema:common:envelope:v1",
      "urn:japp:schema:common:location:v1",
      "urn:japp:schema:common:money:v1",
      "urn:japp:schema:common:provenance:v1",
      "urn:japp:schema:common:redaction:v1",
      "urn:japp:schema:common:schema-version:v1",
      "urn:japp:schema:common:stable-id:v1",
      "urn:japp:schema:common:timestamp-utc:v1",
      "urn:japp:schema:fixture:test-record:v1",
    ]);
  });

  it("declares the Draft 2020-12 dialect on every committed schema", () => {
    for (const entry of catalog.entries) {
      expect(entry.document.$schema).toBe(JSON_SCHEMA_DIALECT);
    }
  });

  it("gives every committed schema a unique conventional $id that matches its path", () => {
    const seen = new Set<string>();
    for (const entry of catalog.entries) {
      expect(entry.id).toMatch(SCHEMA_ID_PATTERN);
      expect(seen.has(entry.id)).toBe(false);
      seen.add(entry.id);
      expect(entry.id).toBe(expectedIdForPath(entry.relativePath));
    }
  });

  it("declares a full version whose major matches the $id major", () => {
    for (const entry of catalog.entries) {
      const declared = entry.document["x-japp-schema-version"];
      expect(typeof declared).toBe("string");
      const parsedVersion = parseSchemaVersion(declared as string);
      const parsedId = parseSchemaId(entry.id);
      expect(parsedVersion).not.toBeNull();
      expect(parsedId).not.toBeNull();
      expect(parsedVersion?.major).toBe(parsedId?.major);
    }
  });

  it("loads deterministically: sorted paths and identical repeated results", () => {
    const again = loadSchemaCatalog();
    const paths = catalog.entries.map((entry) => entry.relativePath);
    expect(paths).toEqual([...paths].sort());
    expect(JSON.stringify(again.entries)).toBe(JSON.stringify(catalog.entries));
  });
});

describe("single-document convention checks (negative)", () => {
  it("rejects a non-2020-12 dialect", () => {
    const violations = checkSchemaDocument(
      sampleDocument({ $schema: "http://json-schema.org/draft-07/schema#" }),
    );
    expect(violations.join("\n")).toContain("$schema must be");
  });

  it("rejects a missing or malformed $id", () => {
    expect(
      checkSchemaDocument(
        sampleDocument({ $id: "https://example.com/x" }),
      ).join("\n"),
    ).toContain("$id must match");
    expect(
      checkSchemaDocument(
        sampleDocument({ $id: "urn:japp:schema:common:Sample:v1" }),
      ).join("\n"),
    ).toContain("$id must match");
  });

  it("rejects an $id that does not match the path-derived identifier", () => {
    const violations = checkSchemaDocument(
      sampleDocument({ $id: "urn:japp:schema:common:other:v1" }),
    );
    expect(violations.join("\n")).toContain("path-derived identifier");
  });

  it("rejects a version whose major disagrees with the $id", () => {
    const violations = checkSchemaDocument(
      sampleDocument({ "x-japp-schema-version": "2.0.0" }),
    );
    expect(violations.join("\n")).toContain("disagrees with the $id major");
  });

  it("rejects remote, relative, and file references", () => {
    for (const ref of [
      "https://example.com/schema.json",
      "http://json-schema.org/draft-07/schema#",
      "./other.v1.schema.json",
      "other.v1.schema.json#/$defs/x",
      "file:///etc/passwd",
    ]) {
      const violations = checkSchemaDocument(
        sampleDocument({ $defs: { bad: { $ref: ref } } }),
      );
      expect(violations.join("\n")).toContain(
        "remote, relative, and file references are prohibited",
      );
    }
  });

  it("rejects prohibited structural keywords including default", () => {
    for (const [keyword, value] of [
      ["$anchor", "anchor"],
      ["$dynamicAnchor", "meta"],
      ["$dynamicRef", "#meta"],
      ["definitions", {}],
      ["default", "value"],
    ] as const) {
      const violations = checkSchemaDocument(
        sampleDocument({
          $defs: { bad: { type: "string", [keyword]: value } },
        }),
      );
      expect(violations.join("\n")).toContain(`prohibited keyword ${keyword}`);
    }
  });

  it("requires object schemas to be closed unless explicitly marked as extension points", () => {
    const open = checkSchemaDocument(
      sampleDocument({
        $defs: {
          bad: { type: "object", properties: { a: { type: "string" } } },
        },
      }),
    );
    expect(open.join("\n")).toContain("closed by default");

    const contradictory = checkSchemaDocument(
      sampleDocument({
        $defs: {
          bad: {
            type: "object",
            additionalProperties: false,
            "x-japp-extension-point": true,
          },
        },
      }),
    );
    expect(contradictory.join("\n")).toContain("contradicts");
  });

  it("enforces the enum token conventions", () => {
    const lowercase = checkSchemaDocument(
      sampleDocument({
        $defs: { bad: { type: "string", enum: ["ACTIVE", "archived"] } },
      }),
    );
    expect(lowercase.join("\n")).toContain("UPPER_SNAKE_CASE token grammar");

    const duplicate = checkSchemaDocument(
      sampleDocument({
        $defs: { bad: { type: "string", enum: ["ACTIVE", "ACTIVE"] } },
      }),
    );
    expect(duplicate.join("\n")).toContain("duplicate enum value");

    const untyped = checkSchemaDocument(
      sampleDocument({ $defs: { bad: { enum: ["ACTIVE"] } } }),
    );
    expect(untyped.join("\n")).toContain('"type": "string"');

    const nonString = checkSchemaDocument(
      sampleDocument({ $defs: { bad: { type: "string", enum: [1] } } }),
    );
    expect(nonString.join("\n")).toContain("token grammar");
  });

  it("rejects unsupported custom annotations and bad vocabulary values", () => {
    const unknown = checkSchemaDocument(
      sampleDocument({
        $defs: { bad: { type: "string", "x-japp-custom": 1 } },
      }),
    );
    expect(unknown.join("\n")).toContain(
      "unsupported custom annotation keyword",
    );

    const badSensitivity = checkSchemaDocument(
      sampleDocument({
        $defs: { bad: { type: "string", "x-japp-sensitivity": "TOP_SECRET" } },
      }),
    );
    expect(badSensitivity.join("\n")).toContain(
      "x-japp-sensitivity must be one of",
    );

    const badPolicy = checkSchemaDocument(
      sampleDocument({
        $defs: { bad: { type: "string", "x-japp-redaction": "SHRED" } },
      }),
    );
    expect(badPolicy.join("\n")).toContain("x-japp-redaction must be one of");

    const orphanDeprecated = checkSchemaDocument(
      sampleDocument({
        $defs: { bad: { type: "string", "x-japp-deprecated-since": "1.0.0" } },
      }),
    );
    expect(orphanDeprecated.join("\n")).toContain(
      'requires a sibling "deprecated": true',
    );
  });
});

describe("cross-document convention checks (negative)", () => {
  it("rejects duplicate $id values", () => {
    const first = sampleDocument();
    const second: SchemaDocumentInput = {
      relativePath: "common/sample-copy.v1.schema.json",
      document: { ...structuredClone(first.document) },
    };
    const violations = checkSchemaCatalogDocuments([first, second]);
    expect(violations.join("\n")).toContain("duplicate $id");
  });

  it("rejects catalog references to schemas that are not committed", () => {
    const referencing = sampleDocument({
      $defs: {
        bad: { $ref: "urn:japp:schema:common:missing:v1#/$defs/x" },
      },
    });
    const violations = checkSchemaCatalogDocuments([referencing]);
    expect(violations.join("\n")).toContain(
      "is not a committed catalog schema",
    );
  });
});

describe("strict validator compile-time behavior", () => {
  it("rejects unsupported custom annotations at compile time", () => {
    const ajv = buildStrictAjv();
    expect(() =>
      ajv.compile({ type: "string", "x-japp-custom": true }),
    ).toThrow(/strict mode: unknown keyword/);
  });

  it("rejects annotation values outside the defined vocabulary at compile time", () => {
    const ajv = buildStrictAjv();
    expect(() =>
      ajv.compile({ type: "string", "x-japp-redaction": "SHRED" }),
    ).toThrow(/x-japp-redaction/);
    expect(() =>
      ajv.compile({ type: "string", "x-japp-sensitivity": "TOP_SECRET" }),
    ).toThrow(/x-japp-sensitivity/);
  });

  it("fails to resolve remote references instead of fetching them", () => {
    const ajv = buildStrictAjv();
    expect(() =>
      ajv.compile({
        type: "object",
        additionalProperties: false,
        properties: {
          value: { $ref: "https://example.com/remote.schema.json" },
        },
      }),
    ).toThrow(/can't resolve reference/);
  });

  it("rejects duplicate schema registration", () => {
    const ajv = buildStrictAjv();
    const document = { type: "string" };
    ajv.addSchema(document, "urn:japp:schema:common:sample:v1");
    expect(() =>
      ajv.addSchema({ type: "number" }, "urn:japp:schema:common:sample:v1"),
    ).toThrow(/already exists/);
  });

  it("validates every committed schema against the 2020-12 meta-schema", () => {
    const ajv = buildStrictAjv();
    for (const entry of catalog.entries) {
      expect(ajv.validateSchema(entry.document)).toBe(true);
    }
  });
});

describe("catalog loading failures", () => {
  const roots: string[] = [];
  afterAll(() => {
    for (const root of roots) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function temporaryRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "japp-schema-catalog-"));
    roots.push(root);
    return root;
  }

  it("fails closed on unparseable schema files", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "common"), { recursive: true });
    writeFileSync(
      join(root, "common", "broken.v1.schema.json"),
      "{not json",
      "utf8",
    );
    expect(() => loadSchemaCatalog({ schemasRoot: root })).toThrow(
      SchemaCatalogError,
    );
    expect(() => loadSchemaCatalog({ schemasRoot: root })).toThrow(
      /invalid JSON/,
    );
  });

  it("fails closed on stray non-schema files under the schemas root", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "common"), { recursive: true });
    writeFileSync(join(root, "common", "notes.txt"), "stray", "utf8");
    expect(() => loadSchemaCatalog({ schemasRoot: root })).toThrow(
      /only \*\.schema\.json documents/,
    );
  });

  it("fails closed on an empty canonical source", () => {
    const root = temporaryRoot();
    expect(() => loadSchemaCatalog({ schemasRoot: root })).toThrow(
      /must not be empty/,
    );
  });
});
