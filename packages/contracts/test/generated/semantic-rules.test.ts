import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";

import {
  SEMANTIC_RULES_V1,
  SEMANTIC_RULES_V2,
  validateSemanticContractV2,
} from "../../generated/typescript/index.ts";
import {
  DEFAULT_CATALOG_ROOT,
  loadErrorCatalog,
} from "../../generator/error-catalog.ts";
import {
  loadSemanticRules,
  SemanticRuleCatalogError,
} from "../../generator/semantic-rules-v2.ts";
import { createContractValidator, loadSchemaCatalog } from "../../src/index.ts";

const SEMANTIC_CATALOG = join(DEFAULT_CATALOG_ROOT, "semantic-rules.v2.json");
const CONTRACTS_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCHEMAS_ROOT = join(CONTRACTS_ROOT, "schemas");
const CORPUS_VALUES = join(
  CONTRACTS_ROOT,
  "test/contract/corpus/values.v1.json",
);
const temporaryRoots: string[] = [];

function dependencies(
  catalogRoot = DEFAULT_CATALOG_ROOT,
  schemasRoot?: string,
) {
  const catalog = loadSchemaCatalog(
    schemasRoot === undefined ? {} : { schemasRoot },
  );
  const validator = createContractValidator(catalog);
  const errorCatalog = loadErrorCatalog({
    catalogRoot,
    catalog,
    validator,
  });
  return { catalog, validator, errorCatalog };
}

function mutatedSchema(
  relativePath: string,
  mutate: (document: Record<string, unknown>) => void,
): string {
  const root = mkdtempSync(join(tmpdir(), "japp-semantic-schemas-"));
  temporaryRoots.push(root);
  cpSync(SCHEMAS_ROOT, root, { recursive: true });
  const path = join(root, ...relativePath.split("/"));
  const document = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  mutate(document);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  return root;
}

function mutatedCatalog(
  mutate: (document: Record<string, unknown>) => void,
): string {
  const root = mkdtempSync(join(tmpdir(), "japp-semantic-catalog-"));
  temporaryRoots.push(root);
  cpSync(DEFAULT_CATALOG_ROOT, root, { recursive: true });
  const path = join(root, "semantic-rules.v2.json");
  const document = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  mutate(document);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  return root;
}

function corpusValue(name: string): Record<string, unknown> {
  const document = JSON.parse(readFileSync(CORPUS_VALUES, "utf8")) as {
    readonly values: Readonly<Record<string, Record<string, unknown>>>;
  };
  const value = document.values[name];
  if (value === undefined) {
    throw new Error(`corpus value missing: ${name}`);
  }
  return structuredClone(value);
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("generated finite semantic rules", () => {
  test("generated immutable bindings exactly match validated canonical data", () => {
    const loaded = loadSemanticRules({
      catalogRoot: DEFAULT_CATALOG_ROOT,
      ...dependencies(),
    });
    const document = JSON.parse(readFileSync(SEMANTIC_CATALOG, "utf8")) as {
      catalog_version: string;
      entries: unknown[];
    };
    expect(loaded.version).toBe("1.2.0");
    expect(loaded.version).toBe(document.catalog_version);
    expect(loaded.entries).toEqual(document.entries);
    expect(SEMANTIC_RULES_V2).toEqual(document.entries);
    expect(SEMANTIC_RULES_V2).toHaveLength(114);
    expect(SEMANTIC_RULES_V2.map((entry) => entry.rule_id)).toEqual(
      [...SEMANTIC_RULES_V2.map((entry) => entry.rule_id)].sort(),
    );
    expect(Object.isFrozen(SEMANTIC_RULES_V2)).toBe(true);
    expect(SEMANTIC_RULES_V2.every((entry) => Object.isFrozen(entry))).toBe(
      true,
    );
  });

  test("returns the first canonical error and leaves unbound schemas unchanged", () => {
    const valid = {
      route_signature: `sha256:${"a".repeat(64)}`,
      application_root_fingerprint: `sha256:${"b".repeat(64)}`,
      section_path: [],
      repeater_path: [],
    };
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:form:field-address:v1",
        valid,
      ),
    ).toEqual({ valid: true, issues: [] });

    const invalid = validateSemanticContractV2(
      "urn:japp:schema:form:field-address:v1",
      {
        ...valid,
        application_root_fingerprint: undefined,
      },
    );
    expect(invalid.valid).toBe(false);
    if (!invalid.valid) {
      expect(invalid.issues[0]).toEqual({
        rule_id: "FIELD_ADDRESS_IDENTITY",
        rule_kind: "FIELD_ADDRESS_IDENTITY",
        error_code: "SITE_AMBIGUOUS_CONTROL",
      });
    }
    expect(
      validateSemanticContractV2("urn:japp:schema:fixture:test-record:v1", {}),
    ).toEqual({ valid: true, issues: [] });
  });

  test("loader rejects executable rule content and missing required bindings", () => {
    const expressionRoot = mutatedCatalog((document) => {
      const entries = document.entries as Record<string, unknown>[];
      const first = entries[0];
      if (first !== undefined) {
        first.expression = "value.ready === true";
      }
    });
    expect(() =>
      loadSemanticRules({
        catalogRoot: expressionRoot,
        ...dependencies(expressionRoot),
      }),
    ).toThrow(SemanticRuleCatalogError);
    expect(() =>
      loadSemanticRules({
        catalogRoot: expressionRoot,
        ...dependencies(expressionRoot),
      }),
    ).toThrow(/schema validation failed/);

    const missingRoot = mutatedCatalog((document) => {
      const entries = document.entries as Record<string, unknown>[];
      document.entries = entries.filter(
        (entry) => entry.rule_id !== "FIELD_ADDRESS_IDENTITY",
      );
    });
    expect(() =>
      loadSemanticRules({
        catalogRoot: missingRoot,
        ...dependencies(missingRoot),
      }),
    ).toThrow(/expected rule kinds FIELD_ADDRESS_IDENTITY, INERT_TEXT_SAFETY/);
  });

  test("loader rejects selector/script fields and consequential enum authority in bound schemas", () => {
    const selectorRoot = mutatedSchema(
      "form/field-address.v1.schema.json",
      (document) => {
        const properties = document.properties as Record<string, unknown>;
        properties.raw_selector = {
          type: "string",
          minLength: 1,
          maxLength: 128,
        };
      },
    );
    expect(() =>
      loadSemanticRules({
        catalogRoot: DEFAULT_CATALOG_ROOT,
        ...dependencies(DEFAULT_CATALOG_ROOT, selectorRoot),
      }),
    ).toThrow(/prohibited executable\/secret field raw_selector/);

    const submitRoot = mutatedSchema(
      "session/guided-run-mode.v1.schema.json",
      (document) => {
        const definitions = document.$defs as Record<string, unknown>;
        const runKind = definitions.runKind as Record<string, unknown>;
        const values = runKind.enum as unknown[];
        values.push("AUTO_SUBMIT");
      },
    );
    expect(() =>
      loadSemanticRules({
        catalogRoot: DEFAULT_CATALOG_ROOT,
        ...dependencies(DEFAULT_CATALOG_ROOT, submitRoot),
      }),
    ).toThrow(/prohibited consequential enum token AUTO_SUBMIT/);
  });

  test("enforces deterministic holdouts, grounded benchmark failures, and honest zero-page renderer failures", () => {
    const holdout = corpusValue("w06.holdout-manifest");
    holdout.schema_versions = [
      {
        schema_ref: "urn:japp:schema:benchmark:result:v1",
        schema_version: "1.0.0",
      },
      {
        schema_ref: "urn:japp:schema:benchmark:case:v1",
        schema_version: "1.0.0",
      },
    ];
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:benchmark:holdout-manifest:v1",
        holdout,
      ).valid,
    ).toBe(false);
    holdout.schema_versions = [...(holdout.schema_versions as unknown[])].sort(
      (left, right) =>
        String((left as Record<string, unknown>).schema_ref).localeCompare(
          String((right as Record<string, unknown>).schema_ref),
        ),
    );
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:benchmark:holdout-manifest:v1",
        holdout,
      ).valid,
    ).toBe(true);

    const unsupportedFail = corpusValue("w06.benchmark-result");
    unsupportedFail.overall_outcome = "FAIL";
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:benchmark:result:v1",
        unsupportedFail,
      ).valid,
    ).toBe(false);
    unsupportedFail.metric_results = [
      {
        measured_value: 0,
        metric_id: "VERDICT_AGREEMENT",
        passed: false,
        threshold_digest: `sha256:${"1".repeat(64)}`,
        unit: "RATIO",
      },
    ];
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:benchmark:result:v1",
        unsupportedFail,
      ).valid,
    ).toBe(true);

    const rendererFailure = corpusValue("w06.layout-measurement");
    rendererFailure.page_count = 0;
    rendererFailure.page_content_bounds = [];
    rendererFailure.renderer_succeeded = false;
    rendererFailure.layout_result = "RENDER_FAILED";
    rendererFailure.error_reason_codes = ["RENDERING_FAILURE"];
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:rendering:layout-measurement:v1",
        rendererFailure,
      ).valid,
    ).toBe(true);
    rendererFailure.renderer_succeeded = true;
    rendererFailure.layout_result = "ACCEPTED";
    rendererFailure.error_reason_codes = [];
    expect(
      validateSemanticContractV2(
        "urn:japp:schema:rendering:layout-measurement:v1",
        rendererFailure,
      ).valid,
    ).toBe(false);
  });
});

test("preserves exact frozen V1 emitter, catalog and runtime preimages while extending V2", () => {
  const retained = {
    "packages/contracts/generator/semantic-rules.ts":
      "d69b85650c220435e06a69186f099e89aa857834354394e47f86966fa821bc02",
    "packages/contracts/catalog/semantic-rules.v1.json":
      "31722639c611cc94bfd9cc31a6e631433c6b145d2b2d8c9d5446aac31d3db1c3",
    "packages/contracts/generated/typescript/semantic/rules.v1.ts":
      "449d3a34473791fc3b880fd76685f59e46fc7f2d8b75ed4572a4cee04b89848f",
    "packages/contracts/generated/python/src/japp_contracts/semantic/rules_v1.py":
      "832cf9bc405416a345f0fb62c7eff821bba4e041894a3d876ccf58d85883b549",
  } as const;
  for (const [path, expected] of Object.entries(retained)) {
    const bytes = readFileSync(join(CONTRACTS_ROOT, "../..", path));
    expect(createHash("sha256").update(bytes).digest("hex"), path).toBe(
      expected,
    );
  }
  const loaded = loadSemanticRules({
    catalogRoot: DEFAULT_CATALOG_ROOT,
    ...dependencies(),
  });
  expect(SEMANTIC_RULES_V1).toEqual(loaded.inheritedV1.entries);
  expect(SEMANTIC_RULES_V1).toHaveLength(110);
  expect(SEMANTIC_RULES_V2).toHaveLength(114);
});
