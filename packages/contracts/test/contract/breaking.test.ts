import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { canonicalJson } from "./adapters/normalization.ts";
import {
  BASELINE_PATH,
  BaselineError,
  buildBaseline,
  CURRENT_BASELINE_FORMAT_VERSION,
  loadBaseline,
  serializeBaseline,
  updateBaseline,
} from "./breaking/baseline.ts";
import {
  buildCompatibilitySignature,
  compareCompatibilitySignatures,
  currentCanonicalInputHashes,
  REPOSITORY_ROOT,
  type CompatibilitySignature,
  type DocumentSignature,
  type NodeSignature,
  type PropertySignature,
  type SemanticRuleSignature,
  type SemanticWitnessSignature,
  type SupportedCaseSignature,
} from "./breaking/compatibility-signature.ts";
import {
  HISTORICAL_WITNESS_REPOSITORY_PATH,
  loadHistoricalWitnessInventory,
} from "./semantic-witnesses/historical-witness-loader.ts";

const W06_OBJECTIVE_ROOTS = [
  "urn:japp:schema:ats:variant-identity:v1",
  "urn:japp:schema:benchmark:case:v1",
  "urn:japp:schema:benchmark:holdout-manifest:v1",
  "urn:japp:schema:benchmark:result:v1",
  "urn:japp:schema:form:driver-result:v1",
  "urn:japp:schema:form:field-address:v1",
  "urn:japp:schema:form:field-decision:v1",
  "urn:japp:schema:form:field-descriptor:v1",
  "urn:japp:schema:form:reconciliation-inventory:v1",
  "urn:japp:schema:gate:decision:v1",
  "urn:japp:schema:gate:evidence-bundle:v1",
  "urn:japp:schema:rendering:layout-measurement:v1",
  "urn:japp:schema:resume:atomic-claim:v1",
  "urn:japp:schema:resume:plan:v1",
  "urn:japp:schema:session:application-session:v1",
  "urn:japp:schema:session:guided-run-mode:v1",
  "urn:japp:schema:session:navigation-record:v1",
  "urn:japp:schema:session:page-readiness-proof:v1",
  "urn:japp:schema:workday:certification-record:v1",
  "urn:japp:schema:workday:step-identity:v1",
  "urn:japp:schema:workday:tenant-fingerprint:v1",
] as const;

let cachedCurrentSignature: CompatibilitySignature | undefined;

function cloneSignature(): CompatibilitySignature {
  return structuredClone(loadBaseline().signature);
}

function currentSignature(): CompatibilitySignature {
  cachedCurrentSignature ??= buildCompatibilitySignature();
  return cachedCurrentSignature;
}

function cloneCurrentSignature(): CompatibilitySignature {
  return structuredClone(currentSignature());
}

function firstSemanticRule(
  signature: CompatibilitySignature,
): SemanticRuleSignature {
  const rule = signature.semantic_rules[0];
  if (rule === undefined) {
    throw new Error("semantic-rule signature missing");
  }
  return rule;
}

function semanticWitness(
  signature: CompatibilitySignature,
  id: string,
): SemanticWitnessSignature {
  const witness = signature.semantic_witnesses.find(
    (candidate) => candidate.id === id,
  );
  if (witness === undefined) {
    throw new Error(`semantic witness missing: ${id}`);
  }
  return witness;
}

function requiredSemanticWitness(
  signature: CompatibilitySignature,
  index: number,
): SemanticWitnessSignature {
  const witness = signature.semantic_witnesses[index];
  if (witness === undefined) {
    throw new Error(`semantic witness missing at index ${String(index)}`);
  }
  return witness;
}

function firstRuleOutcome(witness: SemanticWitnessSignature) {
  const outcome = witness.rule_outcomes[0];
  if (outcome === undefined) {
    throw new Error(`semantic witness has no rule outcome: ${witness.id}`);
  }
  return outcome;
}

function expectCurrentBreaking(
  mutate: (signature: CompatibilitySignature) => void,
  expectedCode: string,
): void {
  const signature = cloneCurrentSignature();
  mutate(signature);
  const report = compareCompatibilitySignatures(currentSignature(), signature);
  expect(report.compatible).toBe(false);
  expect(report.findings.map((finding) => finding.code)).toContain(
    expectedCode,
  );
}

function fixture(signature: CompatibilitySignature): DocumentSignature {
  const result = signature.documents.find(
    (document) => document.id === "urn:japp:schema:fixture:test-record:v1",
  );
  if (result?.root == null) {
    throw new Error("fixture signature missing");
  }
  return result;
}

function fixtureRoot(signature: CompatibilitySignature): NodeSignature {
  const root = fixture(signature).root;
  if (root === null) {
    throw new Error("fixture root missing");
  }
  return root;
}

function requiredProperty(
  root: NodeSignature,
  name: string,
): PropertySignature {
  const property = root.properties[name];
  if (property === undefined) {
    throw new Error(`fixture property missing: ${name}`);
  }
  return property;
}

function firstSupportedCase(
  signature: CompatibilitySignature,
): SupportedCaseSignature {
  const corpusCase = signature.supported_valid_cases[0];
  if (corpusCase === undefined) {
    throw new Error("supported case signature missing");
  }
  return corpusCase;
}

function stableId(signature: CompatibilitySignature): NodeSignature {
  const document = signature.documents.find(
    (candidate) => candidate.id === "urn:japp:schema:common:stable-id:v1",
  );
  const result = document?.definitions.stableId;
  if (result === undefined) {
    throw new Error("stable ID signature missing");
  }
  return result;
}

function codes(signature: CompatibilitySignature): string[] {
  return compareCompatibilitySignatures(
    loadBaseline().signature,
    signature,
  ).findings.map((finding) => finding.code);
}

function expectBreaking(
  mutate: (signature: CompatibilitySignature) => void,
  expectedCode: string,
): void {
  const signature = cloneSignature();
  mutate(signature);
  const report = compareCompatibilitySignatures(
    loadBaseline().signature,
    signature,
  );
  expect(report.compatible).toBe(false);
  expect(report.findings.map((finding) => finding.code)).toContain(
    expectedCode,
  );
}

function copyCompatibilityInputs(root: string): void {
  for (const relative of [
    "packages/contracts/schemas",
    "packages/contracts/catalog",
    "packages/contracts/test/contract/corpus",
    "packages/contracts/test/contract/semantic-witnesses",
  ]) {
    const source = join(REPOSITORY_ROOT, relative);
    const target = join(root, relative);
    cpSync(source, target, { recursive: true });
  }
}

function contractDocument(
  signature: CompatibilitySignature,
  schemaId: string,
): DocumentSignature {
  const document = signature.documents.find(
    (candidate) => candidate.id === schemaId,
  );
  if (document === undefined) {
    throw new Error(`contract document missing: ${schemaId}`);
  }
  return document;
}

function contractRoot(
  signature: CompatibilitySignature,
  schemaId: string,
): NodeSignature {
  const root = contractDocument(signature, schemaId).root;
  if (root === null) {
    throw new Error(`contract root missing: ${schemaId}`);
  }
  return root;
}

function contractDefinition(
  signature: CompatibilitySignature,
  schemaId: string,
  definitionName: string,
): NodeSignature {
  const definition = contractDocument(signature, schemaId).definitions[
    definitionName
  ];
  if (definition === undefined) {
    throw new Error(
      `contract definition missing: ${schemaId}#/$defs/${definitionName}`,
    );
  }
  return definition;
}

function contractProperty(
  node: NodeSignature,
  name: string,
): PropertySignature {
  const property = node.properties[name];
  if (property === undefined) {
    throw new Error(`contract property missing: ${name}`);
  }
  return property;
}

function semanticRule(
  signature: CompatibilitySignature,
  ruleId: string,
): SemanticRuleSignature {
  const rule = signature.semantic_rules.find(
    (candidate) => candidate.rule_id === ruleId,
  );
  if (rule === undefined) {
    throw new Error(`semantic rule missing: ${ruleId}`);
  }
  return rule;
}

function expectCurrentFinding(
  mutate: (signature: CompatibilitySignature) => void,
  expectedCode: string,
  expectedSubject: string,
): void {
  const signature = cloneCurrentSignature();
  mutate(signature);
  const report = compareCompatibilitySignatures(currentSignature(), signature);
  expect(report.compatible).toBe(false);
  expect(report.findings).toContainEqual({
    code: expectedCode,
    subject: expectedSubject,
  });
}

type MutableJsonObject = Record<string, unknown>;

function mutableJson(path: string): MutableJsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as MutableJsonObject;
}

function mutableObject(
  parent: MutableJsonObject,
  name: string,
): MutableJsonObject {
  const value = parent[name];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`JSON object missing: ${name}`);
  }
  return value as MutableJsonObject;
}

function mutableArray(parent: MutableJsonObject, name: string): unknown[] {
  const value = parent[name];
  if (!Array.isArray(value)) {
    throw new Error(`JSON array missing: ${name}`);
  }
  return value;
}

function mutateCopiedJson(
  root: string,
  relativePath: string,
  mutate: (document: MutableJsonObject) => void,
): void {
  const path = join(root, relativePath);
  const document = mutableJson(path);
  mutate(document);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

describe("M01-W05 compatibility baseline", () => {
  test("matches canonical truth deterministically and check mode is read-only", () => {
    const before = readFileSync(BASELINE_PATH);
    const beforeMtime = statSync(BASELINE_PATH).mtimeMs;
    const first = buildCompatibilitySignature();
    const second = buildCompatibilitySignature();
    expect(first).toEqual(loadBaseline().signature);
    expect(second).toEqual(first);
    expect(
      compareCompatibilitySignatures(loadBaseline().signature, first),
    ).toEqual({ compatible: true, findings: [], additive_changes: [] });
    expect(readFileSync(BASELINE_PATH)).toEqual(before);
    expect(statSync(BASELINE_PATH).mtimeMs).toBe(beforeMtime);
  }, 30_000);

  test("rejects a drifted baseline digest", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-baseline-"));
    try {
      const path = join(root, "baseline.json");
      const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<
        string,
        unknown
      >;
      parsed.baseline_id = "tampered";
      writeFileSync(path, `${JSON.stringify(parsed)}\n`, "utf8");
      expect(() => loadBaseline(path)).toThrow(BaselineError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    [
      "schema removal",
      (signature: CompatibilitySignature) => {
        signature.documents.shift();
      },
      "SCHEMA_REMOVED",
    ],
    [
      "schema ID and major replacement",
      (signature: CompatibilitySignature) => {
        const document = fixture(signature);
        document.id = "urn:japp:schema:fixture:test-record:v2";
        document.major = 2;
      },
      "SCHEMA_ID_CHANGED",
    ],
    [
      "definition removal",
      (signature: CompatibilitySignature) => {
        const document = signature.documents.find((candidate) =>
          candidate.id.includes("stable-id"),
        );
        if (document !== undefined) {
          delete document.definitions.stableId;
        }
      },
      "DEFINITION_REMOVED",
    ],
    [
      "property removal",
      (signature: CompatibilitySignature) => {
        delete fixture(signature).root?.properties.note;
      },
      "PROPERTY_REMOVED",
    ],
    [
      "optional property becoming required",
      (signature: CompatibilitySignature) => {
        const property = fixture(signature).root?.properties.note;
        if (property !== undefined) {
          property.required = true;
        }
      },
      "PROPERTY_BECAME_REQUIRED",
    ],
    [
      "type change",
      (signature: CompatibilitySignature) => {
        const property = fixture(signature).root?.properties.note;
        if (property !== undefined) {
          property.node.kind = "boolean";
        }
      },
      "TYPE_CHANGED",
    ],
    [
      "nullability change",
      (signature: CompatibilitySignature) => {
        const property = fixture(signature).root?.properties.superseded_by;
        if (property !== undefined && property.node.inner !== null) {
          property.node = property.node.inner;
        }
      },
      "NULLABILITY_CHANGED",
    ],
    [
      "reference target change",
      (signature: CompatibilitySignature) => {
        const property = fixture(signature).root?.properties.budget;
        if (property !== undefined) {
          property.node.ref_definition = "structuredLocation";
        }
      },
      "REFERENCE_TARGET_CHANGED",
    ],
    [
      "enum token removal",
      (signature: CompatibilitySignature) => {
        const property = fixture(signature).root?.properties.status;
        if (property !== undefined) {
          property.node.tokens.pop();
        }
      },
      "ENUM_TOKEN_REMOVED",
    ],
    [
      "enum semantic reassignment",
      (signature: CompatibilitySignature) => {
        const entry = signature.error_bindings[0];
        if (entry !== undefined) {
          entry.severity = entry.severity === "ERROR" ? "WARNING" : "ERROR";
        }
      },
      "ENUM_SEMANTIC_REASSIGNED",
    ],
    [
      "pattern tightening",
      (signature: CompatibilitySignature) => {
        stableId(signature).pattern = "^never-compatible$";
      },
      "PATTERN_TIGHTENED",
    ],
    [
      "bound tightening",
      (signature: CompatibilitySignature) => {
        stableId(signature).max_length = 8;
      },
      "CONSTRAINT_TIGHTENED",
    ],
    [
      "object openness change",
      (signature: CompatibilitySignature) => {
        const root = fixture(signature).root;
        if (root !== null) {
          root.extension_point = true;
        }
      },
      "OBJECT_OPENNESS_CHANGED",
    ],
    [
      "required capability change",
      (signature: CompatibilitySignature) => {
        const command = signature.commands[0];
        if (command !== undefined) {
          command.required_capability = "CAP_PLATFORM_RUNTIME_DISCOVERY";
        }
      },
      "COMMAND_CAPABILITY_CHANGED",
    ],
    [
      "intended target change",
      (signature: CompatibilitySignature) => {
        const command = signature.commands[0];
        if (command !== undefined) {
          command.intended_target = "MODEL_RUNTIME";
        }
      },
      "COMMAND_TARGET_CHANGED",
    ],
    [
      "denial code change",
      (signature: CompatibilitySignature) => {
        const command = signature.commands[0];
        if (command !== undefined) {
          command.denial_error_code = "E_AUTH_CAPABILITY_DENIED";
        }
      },
      "COMMAND_DENIAL_CODE_CHANGED",
    ],
    [
      "payload limit reduction",
      (signature: CompatibilitySignature) => {
        const command = signature.commands[0];
        if (command !== undefined) {
          command.max_encoded_payload_size_bytes -= 1;
        }
      },
      "PAYLOAD_LIMIT_REDUCED",
    ],
    [
      "profile authority broadening",
      (signature: CompatibilitySignature) => {
        const row = structuredClone(signature.allow_rows[0]);
        if (row !== undefined) {
          row.authorization_profile = "FEASIBILITY";
          row.command_id = "PRIVATE_DATA_WRITE_REQUEST";
          signature.allow_rows.push(row);
        }
      },
      "PROFILE_AUTHORITY_BROADENED",
    ],
    [
      "final-submit authority addition",
      (signature: CompatibilitySignature) => {
        const row = structuredClone(signature.allow_rows[0]);
        if (row !== undefined) {
          row.command_id = "SUBMISSION_FINAL_SUBMIT";
          signature.allow_rows.push(row);
        }
      },
      "FINAL_SUBMIT_AUTHORITY_ADDED",
    ],
    [
      "platform authority addition",
      (signature: CompatibilitySignature) => {
        const row = structuredClone(signature.allow_rows[0]);
        if (row !== undefined) {
          row.command_id = "PLATFORM_SECRET_STORE_REQUEST";
          signature.allow_rows.push(row);
        }
      },
      "PLATFORM_AUTHORITY_ADDED",
    ],
    [
      "supported valid wire case removal",
      (signature: CompatibilitySignature) => {
        signature.supported_valid_cases.pop();
      },
      "SUPPORTED_WIRE_CASE_REMOVED",
    ],
  ] as const)("%s is detected", (_label, mutate, expectedCode) => {
    expectBreaking(mutate, expectedCode);
  });

  test("property rename is distinguished from a plain removal", () => {
    const signature = cloneSignature();
    const root = fixtureRoot(signature);
    const note = root.properties.note;
    if (note === undefined) {
      throw new Error("fixture note missing");
    }
    delete root.properties.note;
    root.properties.notes = note;
    expect(codes(signature)).toEqual(
      expect.arrayContaining(["PROPERTY_REMOVED", "POSSIBLE_PROPERTY_RENAME"]),
    );
  });

  test("schema ID and unretained major replacement emit both findings", () => {
    const signature = cloneSignature();
    const document = fixture(signature);
    document.id = "urn:japp:schema:fixture:test-record:v2";
    document.major = 2;
    expect(codes(signature)).toEqual(
      expect.arrayContaining([
        "MAJOR_REPLACEMENT_WITHOUT_MIGRATION",
        "SCHEMA_ID_CHANGED",
      ]),
    );
  });

  test("adding a root to a definitions-only stable ID is breaking", () => {
    const signature = cloneSignature();
    const document = signature.documents.find(
      (candidate) => candidate.id === "urn:japp:schema:common:stable-id:v1",
    );
    if (document === undefined) {
      throw new Error("stable ID document missing");
    }
    document.root = structuredClone(document.definitions.stableId ?? null);
    expect(codes(signature)).toContain("ROOT_SCHEMA_ADDED");
  });

  test("source schema mutations flow through loader, IR, and checker", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-breaking-source-"));
    try {
      copyCompatibilityInputs(root);
      const schemaPath = join(
        root,
        "packages/contracts/schemas/fixture/test-record.v1.schema.json",
      );
      const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<
        string,
        unknown
      >;
      const properties = schema.properties as Record<string, unknown>;
      Reflect.deleteProperty(properties, "note");
      writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
      const report = compareCompatibilitySignatures(
        loadBaseline().signature,
        buildCompatibilitySignature(root),
      );
      expect(report.compatible).toBe(false);
      expect(report.findings.map((finding) => finding.code)).toContain(
        "PROPERTY_REMOVED",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    // Full compatibility-signature rebuild over the M01-W07 catalog; the
    // 5s default is insufficient on slower Windows hosted runners.
  }, 30_000);

  test("a source optional property with a minor bump is compatible", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-additive-source-"));
    try {
      copyCompatibilityInputs(root);
      const schemaPath = join(
        root,
        "packages/contracts/schemas/fixture/test-record.v1.schema.json",
      );
      const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<
        string,
        unknown
      >;
      schema["x-japp-schema-version"] = "1.2.0";
      const properties = schema.properties as Record<string, unknown>;
      properties.future_note = {
        type: "string",
        maxLength: 64,
        description: "Synthetic compatible optional test field.",
      };
      writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
      const report = compareCompatibilitySignatures(
        loadBaseline().signature,
        buildCompatibilitySignature(root),
      );
      expect(report.compatible).toBe(true);
      expect(report.findings).toEqual([]);
      expect(report.additive_changes.map((finding) => finding.code)).toContain(
        "OPTIONAL_PROPERTY_ADDED",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("compatible additions remain compatible when version rules require them", () => {
    const signature = cloneSignature();
    const document = fixture(signature);
    const root = fixtureRoot(signature);
    document.version = "1.2.0";
    root.properties.future_note = {
      required: false,
      node: structuredClone(requiredProperty(root, "note").node),
    };
    const status = root.properties.status;
    if (status !== undefined) {
      status.node.tokens.push("FUTURE");
    }
    const deprecation = root.properties.note;
    if (deprecation !== undefined) {
      deprecation.node.deprecated = true;
      deprecation.node.deprecated_since = "1.2.0";
    }
    signature.documents.push({
      ...structuredClone(document),
      path: "fixture/additive.v1.schema.json",
      id: "urn:japp:schema:fixture:additive:v1",
    });
    signature.supported_valid_cases.push({
      ...structuredClone(firstSupportedCase(signature)),
      id: "round-trip.additive.synthetic",
    });
    const report = compareCompatibilitySignatures(
      loadBaseline().signature,
      signature,
    );
    expect(report.compatible).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.additive_changes.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "DEPRECATION_ADDED",
        "ENUM_TOKEN_ADDED",
        "OPTIONAL_PROPERTY_ADDED",
        "SCHEMA_ADDED",
        "SUPPORTED_WIRE_CASE_ADDED",
      ]),
    );
  });

  test("an additive structural change without a compatible minor bump fails", () => {
    const signature = cloneSignature();
    const root = fixtureRoot(signature);
    root.properties.future_note = {
      required: false,
      node: structuredClone(requiredProperty(root, "note").node),
    };
    expect(codes(signature)).toContain("MINOR_BUMP_REQUIRED");
  });
});

describe("M01-W06 semantic compatibility signature", () => {
  test("captures every canonical semantic binding and its canonical catalog hash", () => {
    const signature = currentSignature();
    const catalog = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          "packages/contracts/catalog/semantic-rules.v1.json",
        ),
        "utf8",
      ),
    ) as {
      readonly catalog_version: string;
      readonly entries: readonly SemanticRuleSignature[];
    };
    expect(signature.semantic_rule_catalog).toEqual({
      repository_path: "packages/contracts/catalog/semantic-rules.v1.json",
      catalog_version: catalog.catalog_version,
      canonical_sha256: currentCanonicalInputHashes().semantic_rule_catalog,
    });
    expect(signature.semantic_rules).toEqual(catalog.entries);
    expect(signature.semantic_rules.map((rule) => rule.rule_id)).toEqual(
      [...signature.semantic_rules].map((rule) => rule.rule_id).sort(),
    );
  });

  test("models the reviewed M01-W05 to M01-W06 extension as additive", () => {
    const legacy = cloneCurrentSignature();
    Reflect.deleteProperty(legacy, "semantic_rule_catalog");
    Reflect.deleteProperty(legacy, "semantic_rules");
    const w06SchemaIds = new Set<string>([
      ...W06_OBJECTIVE_ROOTS,
      "urn:japp:schema:common:contract-text:v1",
      "urn:japp:schema:semantic:rule-catalog:v1",
    ]);
    legacy.documents = legacy.documents.filter(
      (document) => !w06SchemaIds.has(document.id),
    );
    legacy.supported_valid_cases = legacy.supported_valid_cases.filter(
      (corpusCase) => !corpusCase.id.startsWith("x-w06."),
    );
    const report = compareCompatibilitySignatures(legacy, currentSignature());
    expect(report.compatible).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.additive_changes).toEqual(
      expect.arrayContaining([
        {
          code: "SEMANTIC_RULE_CATALOG_ADDED",
          subject: "packages/contracts/catalog/semantic-rules.v1.json",
        },
      ]),
    );
    for (const schemaId of W06_OBJECTIVE_ROOTS) {
      expect(report.additive_changes).toContainEqual({
        code: "SCHEMA_ADDED",
        subject: schemaId,
      });
    }
  });

  test("builds and parses the current baseline format without touching the committed baseline", () => {
    const before = readFileSync(BASELINE_PATH);
    const root = mkdtempSync(join(tmpdir(), "japp-current-baseline-"));
    try {
      const built = buildBaseline();
      expect(built.baseline_format_version).toBe(
        CURRENT_BASELINE_FORMAT_VERSION,
      );
      expect(built.source_scope.catalogs).toContain(
        "packages/contracts/catalog/semantic-rules.v1.json",
      );
      const path = join(root, "baseline.json");
      const serialized = serializeBaseline(built);
      writeFileSync(path, serialized, "utf8");
      expect(loadBaseline(path)).toEqual(built);
      expect(readFileSync(BASELINE_PATH, "utf8")).toBe(serialized);
      expect(readFileSync(BASELINE_PATH)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    // Same generous allowance as the sibling deterministic-truth test above:
    // both build the complete compatibility signature over the whole catalog,
    // which M01-W07 grew from 43 to 63 documents and this corrective migration
    // extends to 78. The assertions are unchanged; only the wall-clock budget
    // matches the work on slower hosted runners.
  }, 30_000);

  test.each([
    [
      "rule removal",
      (signature: CompatibilitySignature) => {
        signature.semantic_rules.shift();
      },
      "SEMANTIC_RULE_REMOVED",
    ],
    [
      "schema rebinding",
      (signature: CompatibilitySignature) => {
        firstSemanticRule(signature).schema_ref =
          "urn:japp:schema:form:field-address:v1";
      },
      "SEMANTIC_RULE_SCHEMA_REBOUND",
    ],
    [
      "failure-code reassignment",
      (signature: CompatibilitySignature) => {
        firstSemanticRule(signature).failure_error_code =
          "VALIDATION_MISSING_REQUIRED_DATA";
      },
      "SEMANTIC_RULE_ERROR_CODE_CHANGED",
    ],
    [
      "rule-kind reassignment",
      (signature: CompatibilitySignature) => {
        firstSemanticRule(signature).rule_kind = "FIELD_ADDRESS_IDENTITY";
      },
      "SEMANTIC_RULE_KIND_CHANGED",
    ],
    [
      "rule-version reassignment",
      (signature: CompatibilitySignature) => {
        firstSemanticRule(signature).rule_version = "2.0.0";
      },
      "SEMANTIC_RULE_VERSION_CHANGED",
    ],
  ] as const)("%s is breaking", (_label, mutate, expectedCode) => {
    expectCurrentBreaking(mutate, expectedCode);
  });

  test("catalog hash drift with unchanged bindings is breaking", () => {
    expectCurrentBreaking((signature) => {
      signature.semantic_rule_catalog.canonical_sha256 = "0".repeat(64);
    }, "SEMANTIC_RULE_CATALOG_HASH_CHANGED");
  });

  test("removing any W06 objective root from an accepted signature is caught", () => {
    const accepted = currentSignature();
    const acceptedIds = new Set(
      accepted.documents.map((document) => document.id),
    );
    expect([...W06_OBJECTIVE_ROOTS].every((id) => acceptedIds.has(id))).toBe(
      true,
    );
    for (const schemaId of W06_OBJECTIVE_ROOTS) {
      const mutated = structuredClone(accepted);
      mutated.documents = mutated.documents.filter(
        (document) => document.id !== schemaId,
      );
      const report = compareCompatibilitySignatures(accepted, mutated);
      expect(report.compatible, schemaId).toBe(false);
      expect(report.findings, schemaId).toContainEqual({
        code: "SCHEMA_REMOVED",
        subject: schemaId,
      });
    }
  });
});

describe("M01-W07 executable semantic compatibility witnesses", () => {
  const macosCudaV1 = "x-w07.model-runtime-profile-macos-cuda";
  const macosCudaV2 = `${macosCudaV1}.v2`;
  const recoveredRollbackV1 =
    "x-w07.historical-positive.6656bb50346f784768db42c2";

  test("locks the complete canonical historical inventory and signature scope", () => {
    const inventory = loadHistoricalWitnessInventory();
    const signature = currentSignature();
    expect(inventory.witness_count).toBe(229);
    expect(inventory.raw_reference_count).toBe(556);
    expect(inventory.insertion_order_sensitive_unique_count).toBe(231);
    expect(inventory.recursive_key_sort_collapse_count).toBe(2);
    expect(inventory.inventory_sha256).toBe(
      "6ce50f164c3b58a1062f43bcca7164cd5a4fcee0d93a6f1525a3c54379688fbc",
    );
    expect(
      inventory.witnesses.filter(
        (witness) =>
          witness.schema_ref === "urn:japp:schema:platform:installer-state:v1",
      ),
    ).toHaveLength(26);
    expect(
      inventory.witnesses.filter(
        (witness) =>
          witness.schema_ref === "urn:japp:schema:platform:update-state:v1",
      ),
    ).toHaveLength(23);
    expect(
      inventory.witnesses
        .map((witness) => witness.schema_ref)
        .filter(
          (schemaRef, index, values) => values.indexOf(schemaRef) === index,
        ),
    ).toHaveLength(19);
    expect(inventory.witnesses.map((witness) => witness.id)).toEqual(
      expect.arrayContaining([
        recoveredRollbackV1,
        "x-w07.historical-positive.12940c26b0564f602e366f8d",
        "x-w07.historical-positive.a9122c6aa5a4dfde7bd17f77",
      ]),
    );
    expect(signature.historical_witness_inventory).toEqual({
      repository_path: HISTORICAL_WITNESS_REPOSITORY_PATH,
      format_version: "1.0.0",
      witness_count: 229,
      raw_reference_count: 556,
      canonical_sha256:
        "6ce50f164c3b58a1062f43bcca7164cd5a4fcee0d93a6f1525a3c54379688fbc",
    });
    expect(
      signature.semantic_witnesses.filter((witness) =>
        witness.id.startsWith("x-w07.historical-positive."),
      ),
    ).toHaveLength(229);
    expect(signature.semantic_witnesses).toHaveLength(572);
  });

  test("locks the last-published recovered-rollback v1 canary", () => {
    const inventory = loadHistoricalWitnessInventory();
    const source = inventory.witnesses.find(
      (witness) => witness.id === recoveredRollbackV1,
    );
    expect(source?.historical_acceptance).toEqual({
      "6708f1a": false,
      "12e4062": false,
      "44827ae": false,
      "860b6e1": true,
    });
    const witness = semanticWitness(currentSignature(), recoveredRollbackV1);
    expect(witness.schema_ref).toBe("urn:japp:schema:platform:update-state:v1");
    expect(witness.expected_valid).toBe(true);
    expect(witness.structural_valid).toBe(true);
    expect(witness.semantic_valid).toBe(true);
  });

  test("locks the exact historical v1 acceptance and corrected v2 rejection", () => {
    const signature = currentSignature();
    const legacy = semanticWitness(signature, macosCudaV1);
    const corrected = semanticWitness(signature, macosCudaV2);
    expect(legacy.schema_ref).toBe(
      "urn:japp:schema:platform:model-runtime-profile:v1",
    );
    expect(legacy.schema_major).toBe(1);
    expect(legacy.structural_valid).toBe(true);
    expect(legacy.semantic_valid).toBe(true);
    expect(legacy.expected_valid).toBe(true);
    expect(corrected.schema_ref).toBe(
      "urn:japp:schema:platform:model-runtime-profile:v2",
    );
    expect(corrected.schema_major).toBe(2);
    expect(corrected.input_sha256).toBe(legacy.input_sha256);
    expect(corrected.structural_valid).toBe(true);
    expect(corrected.semantic_valid).toBe(false);
    expect(corrected.expected_valid).toBe(false);
    expect(corrected.expected_error_code).toBe("UNSUPPORTED_RUNTIME_PROFILE");
  });

  test("locks all 39 migrated historical pairs and all 15 v2 representatives", () => {
    const signature = currentSignature();
    const byId = new Map(
      signature.semantic_witnesses.map((witness) => [witness.id, witness]),
    );
    const migratedPairs = signature.semantic_witnesses.filter((legacy) => {
      const corrected = byId.get(`${legacy.id}.v2`);
      return (
        legacy.schema_ref.endsWith(":v1") &&
        legacy.expected_valid &&
        legacy.semantic_valid &&
        corrected !== undefined &&
        corrected.schema_ref.endsWith(":v2") &&
        !corrected.expected_valid &&
        !corrected.semantic_valid
      );
    });
    expect(migratedPairs).toHaveLength(39);
    const inputAdjustedPairs = migratedPairs.filter(
      (legacy) =>
        byId.get(`${legacy.id}.v2`)?.input_sha256 !== legacy.input_sha256,
    );
    expect(inputAdjustedPairs.map((witness) => witness.schema_ref)).toEqual([
      "urn:japp:schema:platform:certification-input:v1",
    ]);

    const representativeRoots = new Set(
      signature.semantic_witnesses
        .filter(
          (witness) =>
            witness.id.startsWith("x-w07.round-trip-") &&
            witness.id.endsWith(".v2") &&
            witness.expected_valid &&
            witness.semantic_valid,
        )
        .map((witness) => witness.schema_ref),
    );
    expect(representativeRoots.size).toBe(15);
  });

  test("reports acceptance removal and rejection removal in both directions", () => {
    const narrowed = cloneCurrentSignature();
    const legacy = semanticWitness(narrowed, macosCudaV1);
    legacy.semantic_valid = false;
    firstRuleOutcome(legacy).passed = false;
    expect(
      compareCompatibilitySignatures(currentSignature(), narrowed).findings,
    ).toContainEqual({
      code: "SEMANTIC_ACCEPTANCE_REMOVED",
      subject: macosCudaV1,
    });

    const broadened = cloneCurrentSignature();
    const corrected = semanticWitness(broadened, macosCudaV2);
    corrected.semantic_valid = true;
    for (const outcome of corrected.rule_outcomes) {
      outcome.passed = true;
    }
    expect(
      compareCompatibilitySignatures(currentSignature(), broadened).findings,
    ).toContainEqual({
      code: "SEMANTIC_REJECTION_REMOVED",
      subject: macosCudaV2,
    });
  });

  test("reports removal of a historical accepted-set canary", () => {
    const narrowed = cloneCurrentSignature();
    const witness = semanticWitness(narrowed, recoveredRollbackV1);
    witness.semantic_valid = false;
    firstRuleOutcome(witness).passed = false;
    expect(
      compareCompatibilitySignatures(currentSignature(), narrowed).findings,
    ).toContainEqual({
      code: "SEMANTIC_ACCEPTANCE_REMOVED",
      subject: recoveredRollbackV1,
    });
  });

  test("historical inventory removal and metadata drift are breaking", () => {
    const removed = cloneCurrentSignature();
    Reflect.deleteProperty(removed, "historical_witness_inventory");
    expect(
      compareCompatibilitySignatures(currentSignature(), removed).findings,
    ).toContainEqual({
      code: "HISTORICAL_WITNESS_INVENTORY_REMOVED",
      subject: HISTORICAL_WITNESS_REPOSITORY_PATH,
    });

    const changed = cloneCurrentSignature();
    changed.historical_witness_inventory.canonical_sha256 = "0".repeat(64);
    expect(
      compareCompatibilitySignatures(currentSignature(), changed).findings,
    ).toContainEqual({
      code: "HISTORICAL_WITNESS_INVENTORY_HASH_CHANGED",
      subject: HISTORICAL_WITNESS_REPOSITORY_PATH,
    });
  });

  test.each(["metadata hash", "witness input hash"] as const)(
    "format 2.1 loader rejects a self-consistently forged %s",
    (mutation) => {
      const root = mkdtempSync(join(tmpdir(), "japp-baseline-forgery-"));
      try {
        const baseline = buildBaseline();
        if (mutation === "metadata hash") {
          baseline.signature.historical_witness_inventory.canonical_sha256 =
            "0".repeat(64);
        } else {
          semanticWitness(
            baseline.signature,
            recoveredRollbackV1,
          ).input_sha256 = "0".repeat(64);
        }
        const payload = {
          baseline_format_version: baseline.baseline_format_version,
          baseline_id: baseline.baseline_id,
          source_scope: baseline.source_scope,
          signature: baseline.signature,
        };
        baseline.integrity_sha256 = createHash("sha256")
          .update(canonicalJson(payload))
          .digest("hex");
        const path = join(root, "compatibility-signature.v2.json");
        writeFileSync(path, serializeBaseline(baseline), "utf8");
        expect(() => loadBaseline(path)).toThrow(
          expect.objectContaining({ code: "BASELINE_INVALID" }),
        );
      } finally {
        rmSync(root, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 100,
        });
      }
    },
    30_000,
  );

  test.each([
    [
      "removal",
      (signature: CompatibilitySignature) => {
        signature.semantic_witnesses = signature.semantic_witnesses.filter(
          (witness) => witness.id !== macosCudaV1,
        );
      },
      "SEMANTIC_WITNESS_REMOVED",
    ],
    [
      "input mutation",
      (signature: CompatibilitySignature) => {
        semanticWitness(signature, macosCudaV1).input_sha256 = "0".repeat(64);
      },
      "SEMANTIC_WITNESS_CHANGED",
    ],
    [
      "failure reassignment",
      (signature: CompatibilitySignature) => {
        const failed = semanticWitness(
          signature,
          macosCudaV2,
        ).rule_outcomes.find((outcome) => !outcome.passed);
        if (failed === undefined) {
          throw new Error("corrected failure outcome missing");
        }
        failed.error_code = "VALIDATION_CONSTRAINT_VIOLATION";
      },
      "SEMANTIC_FAILURE_BINDING_CHANGED",
    ],
  ] as const)("%s is breaking", (_label, mutate, expectedCode) => {
    expectCurrentBreaking(mutate, expectedCode);
  });

  test("new-major witnesses and a monotonic catalog minor are additive", () => {
    const candidate = cloneCurrentSignature();
    const future = structuredClone(semanticWitness(candidate, macosCudaV2));
    future.id = `${macosCudaV2}.future`;
    candidate.semantic_witnesses.push(future);
    candidate.semantic_witnesses.sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    candidate.semantic_rule_catalog.catalog_version = "1.2.0";
    candidate.semantic_rule_catalog.canonical_sha256 = "f".repeat(64);
    const report = compareCompatibilitySignatures(
      currentSignature(),
      candidate,
    );
    expect(report.compatible).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.additive_changes).toEqual(
      expect.arrayContaining([
        {
          code: "SEMANTIC_WITNESS_ADDED",
          subject: future.id,
        },
        {
          code: "SEMANTIC_RULE_CATALOG_VERSION_ADVANCED",
          subject: "packages/contracts/catalog/semantic-rules.v1.json",
        },
      ]),
    );
  });

  test("new semantic bindings require a catalog minor advance", () => {
    const candidate = cloneCurrentSignature();
    const sourceDocument = candidate.documents.find((document) =>
      document.id.endsWith(":browser-record:v2"),
    );
    const sourceRule = candidate.semantic_rules.find(
      (rule) => rule.rule_id === "PLATFORM_BROWSER_RECORD_SCOPE_V2",
    );
    if (sourceDocument === undefined || sourceRule === undefined) {
      throw new Error("v2 browser compatibility source missing");
    }
    candidate.documents.push({
      ...structuredClone(sourceDocument),
      id: "urn:japp:schema:platform:browser-record:v3",
      path: "platform/browser-record.v3.schema.json",
      major: 3,
      version: "3.0.0",
    });
    candidate.semantic_rules.push({
      ...structuredClone(sourceRule),
      rule_id: "PLATFORM_BROWSER_RECORD_SCOPE_V3",
      rule_version: "3.0.0",
      schema_ref: "urn:japp:schema:platform:browser-record:v3",
      rule_kind: "PLATFORM_BROWSER_RECORD_SCOPE_V3",
    });
    candidate.semantic_rules.sort((left, right) =>
      left.rule_id.localeCompare(right.rule_id),
    );
    expect(
      compareCompatibilitySignatures(currentSignature(), candidate).findings,
    ).toContainEqual({
      code: "SEMANTIC_RULE_CATALOG_MINOR_BUMP_REQUIRED",
      subject: "packages/contracts/catalog/semantic-rules.v1.json",
    });
  });

  test("expectation mismatch fails even when the prior baseline has no witness section", () => {
    const legacy = cloneCurrentSignature();
    Reflect.deleteProperty(legacy, "semantic_witnesses");
    const inconsistent = cloneCurrentSignature();
    const witness = semanticWitness(inconsistent, macosCudaV1);
    witness.semantic_valid = false;
    firstRuleOutcome(witness).passed = false;
    expect(
      compareCompatibilitySignatures(legacy, inconsistent).findings,
    ).toContainEqual({
      code: "SEMANTIC_WITNESS_EXPECTATION_MISMATCH",
      subject: macosCudaV1,
    });
  });

  test("baseline update refuses incompatible executable behavior without changing bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-baseline-refusal-"));
    try {
      const path = join(root, "compatibility-signature.v2.json");
      cpSync(BASELINE_PATH, path);
      const before = readFileSync(path);
      const narrowed = cloneCurrentSignature();
      const witness = semanticWitness(narrowed, macosCudaV1);
      witness.semantic_valid = false;
      firstRuleOutcome(witness).passed = false;
      let failure: unknown;
      try {
        updateBaseline(narrowed, path);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(BaselineError);
      expect((failure as BaselineError).code).toBe("BASELINE_UPDATE_REFUSED");
      expect(readFileSync(path)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("baseline update refuses a missing v2 baseline instead of falling back", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-baseline-missing-"));
    try {
      const path = join(root, "compatibility-signature.v2.json");
      expect(() => {
        updateBaseline(cloneCurrentSignature(), path);
      }).toThrow(expect.objectContaining({ code: "BASELINE_INVALID" }));
      expect(existsSync(path)).toBe(false);
      expect(existsSync(`${path}.tmp`)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("candidate validation rejects malformed rows before replacing a baseline", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-baseline-candidate-"));
    try {
      const path = join(root, "compatibility-signature.v2.json");
      cpSync(BASELINE_PATH, path);
      const before = readFileSync(path);
      const malformed = cloneCurrentSignature();
      malformed.semantic_witnesses.push(
        structuredClone(requiredSemanticWitness(malformed, 0)),
      );
      expect(() => {
        updateBaseline(malformed, path);
      }).toThrow(expect.objectContaining({ code: "BASELINE_INVALID" }));
      expect(readFileSync(path)).toEqual(before);
      expect(existsSync(`${path}.tmp`)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each(["duplicate", "unsorted"] as const)(
    "rejects %s executable witness rows in the 2.0 baseline",
    (mutation) => {
      const root = mkdtempSync(join(tmpdir(), "japp-baseline-witness-"));
      try {
        const path = join(root, "baseline.json");
        const signature = cloneCurrentSignature();
        if (mutation === "duplicate") {
          signature.semantic_witnesses.push(
            structuredClone(requiredSemanticWitness(signature, 0)),
          );
        } else {
          const first = requiredSemanticWitness(signature, 0);
          const second = requiredSemanticWitness(signature, 1);
          signature.semantic_witnesses[0] = second;
          signature.semantic_witnesses[1] = first;
        }
        writeFileSync(
          path,
          serializeBaseline(buildBaseline(signature)),
          "utf8",
        );
        expect(() => loadBaseline(path)).toThrow(BaselineError);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test.each(["language", "schema major", "rule major"] as const)(
    "rejects a witness with a fabricated %s",
    (mutation) => {
      const root = mkdtempSync(join(tmpdir(), "japp-baseline-cross-field-"));
      try {
        const path = join(root, "baseline.json");
        const signature = cloneCurrentSignature();
        const witness = requiredSemanticWitness(signature, 0);
        if (mutation === "language") {
          witness.languages = ["brainfuck"];
        } else if (mutation === "schema major") {
          witness.schema_major = 999;
        } else {
          firstRuleOutcome(witness).rule_major = 999;
        }
        writeFileSync(
          path,
          serializeBaseline(buildBaseline(signature)),
          "utf8",
        );
        expect(() => loadBaseline(path)).toThrow(
          expect.objectContaining({ code: "BASELINE_INVALID" }),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});

describe("M01-W06 objective mutation coverage", () => {
  const fieldAddressId = "urn:japp:schema:form:field-address:v1";
  const fieldDecisionId = "urn:japp:schema:form:field-decision:v1";
  const navigationRecordId = "urn:japp:schema:session:navigation-record:v1";
  const pageReadinessId = "urn:japp:schema:session:page-readiness-proof:v1";
  const benchmarkResultId = "urn:japp:schema:benchmark:result:v1";
  const holdoutManifestId = "urn:japp:schema:benchmark:holdout-manifest:v1";
  const gateDecisionId = "urn:japp:schema:gate:decision:v1";
  const layoutMeasurementId = "urn:japp:schema:rendering:layout-measurement:v1";

  test.each([
    [
      "removing required FieldAddress frame identity",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, fieldAddressId).properties,
          "frame_id",
        );
      },
      "PROPERTY_REMOVED",
      `${fieldAddressId}/frame_id`,
    ],
    [
      "removing required FieldAddress document identity",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, fieldAddressId).properties,
          "document_id",
        );
      },
      "PROPERTY_REMOVED",
      `${fieldAddressId}/document_id`,
    ],
    [
      "removing required FieldAddress DOM generation",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, fieldAddressId).properties,
          "observed_dom_generation",
        );
      },
      "PROPERTY_REMOVED",
      `${fieldAddressId}/observed_dom_generation`,
    ],
    [
      "removing a FieldAddress semantic identity signal",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, fieldAddressId).properties,
          "route_signature",
        );
      },
      "PROPERTY_REMOVED",
      `${fieldAddressId}/route_signature`,
    ],
    [
      "removing the navigation readiness-proof digest",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, navigationRecordId).properties,
          "readiness_proof_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${navigationRecordId}/readiness_proof_digest`,
    ],
    [
      "removing navigation idempotency",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, navigationRecordId).properties,
          "idempotency_key",
        );
      },
      "PROPERTY_REMOVED",
      `${navigationRecordId}/idempotency_key`,
    ],
    [
      "changing a field-decision enum token",
      (signature: CompatibilitySignature) => {
        const tokens = contractDefinition(
          signature,
          fieldDecisionId,
          "finalDecision",
        ).tokens;
        const index = tokens.indexOf("FILL");
        if (index < 0) {
          throw new Error("finalDecision/FILL token missing");
        }
        tokens[index] = "APPLY";
      },
      "ENUM_TOKEN_REMOVED",
      `${fieldDecisionId}#/$defs/finalDecision/FILL`,
    ],
    [
      "changing a gate-decision enum token",
      (signature: CompatibilitySignature) => {
        const tokens = contractDefinition(
          signature,
          gateDecisionId,
          "gateDecision",
        ).tokens;
        const index = tokens.indexOf("PASS");
        if (index < 0) {
          throw new Error("gateDecision/PASS token missing");
        }
        tokens[index] = "APPROVED";
      },
      "ENUM_TOKEN_REMOVED",
      `${gateDecisionId}#/$defs/gateDecision/PASS`,
    ],
    [
      "removing benchmark repository revision",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, benchmarkResultId).properties,
          "repository_commit",
        );
      },
      "PROPERTY_REMOVED",
      `${benchmarkResultId}/repository_commit`,
    ],
    [
      "removing benchmark repository tree",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, benchmarkResultId).properties,
          "repository_tree",
        );
      },
      "PROPERTY_REMOVED",
      `${benchmarkResultId}/repository_tree`,
    ],
    [
      "removing benchmark generator revision metadata",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, benchmarkResultId).properties,
          "generator_format_version",
        );
      },
      "PROPERTY_REMOVED",
      `${benchmarkResultId}/generator_format_version`,
    ],
    [
      "removing benchmark corpus identity",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, benchmarkResultId).properties,
          "corpus_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${benchmarkResultId}/corpus_digest`,
    ],
    [
      "removing benchmark runtime metadata",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, benchmarkResultId).properties,
          "runtime_metadata",
        );
      },
      "PROPERTY_REMOVED",
      `${benchmarkResultId}/runtime_metadata`,
    ],
    [
      "removing the holdout manifest hash",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, holdoutManifestId).properties,
          "manifest_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${holdoutManifestId}/manifest_digest`,
    ],
    [
      "removing a holdout file hash",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractDefinition(signature, holdoutManifestId, "fileCommitment")
            .properties,
          "content_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${holdoutManifestId}#/$defs/fileCommitment/content_digest`,
    ],
    [
      "removing an encrypted holdout bundle hash",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractDefinition(
            signature,
            holdoutManifestId,
            "encryptedBundleMetadata",
          ).properties,
          "bundle_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${holdoutManifestId}#/$defs/encryptedBundleMetadata/bundle_digest`,
    ],
    [
      "removing the required renderer version",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, layoutMeasurementId).properties,
          "renderer_version",
        );
      },
      "PROPERTY_REMOVED",
      `${layoutMeasurementId}/renderer_version`,
    ],
    [
      "removing the required browser version",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, layoutMeasurementId).properties,
          "browser_version",
        );
      },
      "PROPERTY_REMOVED",
      `${layoutMeasurementId}/browser_version`,
    ],
    [
      "removing the controlled-font inventory",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, layoutMeasurementId).properties,
          "controlled_fonts",
        );
      },
      "PROPERTY_REMOVED",
      `${layoutMeasurementId}/controlled_fonts`,
    ],
    [
      "removing controlled-font digest evidence",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractDefinition(signature, layoutMeasurementId, "fontCommitment")
            .properties,
          "font_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${layoutMeasurementId}#/$defs/fontCommitment/font_digest`,
    ],
    [
      "removing layout evidence digest",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, layoutMeasurementId).properties,
          "evidence_report_digest",
        );
      },
      "PROPERTY_REMOVED",
      `${layoutMeasurementId}/evidence_report_digest`,
    ],
    [
      "narrowing the FieldAddress resolution-hint bound",
      (signature: CompatibilitySignature) => {
        contractProperty(
          contractRoot(signature, fieldAddressId),
          "resolution_hints",
        ).node.max_items = 11;
      },
      "CONSTRAINT_TIGHTENED",
      `${fieldAddressId}/resolution_hints`,
    ],
    [
      "retyping navigation retry evidence",
      (signature: CompatibilitySignature) => {
        contractProperty(
          contractRoot(signature, navigationRecordId),
          "safe_retry_allowed",
        ).node.kind = "string";
      },
      "TYPE_CHANGED",
      `${navigationRecordId}/safe_retry_allowed`,
    ],
  ] as const)("%s is breaking", (_label, mutate, code, subject) => {
    expectCurrentFinding(mutate, code, subject);
  });

  test.each([
    [
      "FieldAddress multiple-signal identity",
      "FIELD_ADDRESS_IDENTITY",
      fieldAddressId,
    ],
    [
      "READY reconciliation/readiness integrity",
      "PAGE_READINESS_INTEGRITY",
      pageReadinessId,
    ],
    [
      "PASS threshold/evidence integrity",
      "GATE_DECISION_INTEGRITY",
      gateDecisionId,
    ],
  ] as const)(
    "cannot weaken %s by removing its canonical semantic rule",
    (_label, ruleId, schemaId) => {
      expectCurrentFinding(
        (signature) => {
          const rule = semanticRule(signature, ruleId);
          signature.semantic_rules = signature.semantic_rules.filter(
            (candidate) => candidate !== rule,
          );
        },
        "SEMANTIC_RULE_REMOVED",
        ruleId,
      );

      const root = mkdtempSync(join(tmpdir(), "japp-semantic-removal-"));
      try {
        copyCompatibilityInputs(root);
        mutateCopiedJson(
          root,
          "packages/contracts/catalog/semantic-rules.v1.json",
          (catalog) => {
            catalog.entries = mutableArray(catalog, "entries").filter(
              (entry) =>
                typeof entry !== "object" ||
                entry === null ||
                Array.isArray(entry) ||
                (entry as MutableJsonObject).rule_id !== ruleId,
            );
          },
        );
        expect(() => buildCompatibilitySignature(root)).toThrow(
          new RegExp(`${schemaId}: expected rule kinds`),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test("rejects AUTO_SUBMIT even as a versioned enum addition", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-auto-submit-"));
    try {
      copyCompatibilityInputs(root);
      mutateCopiedJson(
        root,
        "packages/contracts/schemas/session/guided-run-mode.v1.schema.json",
        (schema) => {
          schema["x-japp-schema-version"] = "1.1.0";
          const definitions = mutableObject(schema, "$defs");
          const runKind = mutableObject(definitions, "runKind");
          mutableArray(runKind, "enum").push("AUTO_SUBMIT");
          mutableArray(runKind, "enum").sort();
        },
      );
      expect(() => buildCompatibilitySignature(root)).toThrow(
        /prohibited consequential enum token AUTO_SUBMIT/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each(["raw_selector", "script"] as const)(
    "rejects the additive executable field %s",
    (fieldName) => {
      const root = mkdtempSync(join(tmpdir(), "japp-executable-field-"));
      try {
        copyCompatibilityInputs(root);
        mutateCopiedJson(
          root,
          "packages/contracts/schemas/form/field-address.v1.schema.json",
          (schema) => {
            schema["x-japp-schema-version"] = "1.1.0";
            mutableObject(schema, "properties")[fieldName] = {
              title: "Prohibited executable field",
              type: "string",
              maxLength: 512,
            };
          },
        );
        expect(() => buildCompatibilitySignature(root)).toThrow(
          new RegExp(`prohibited executable/secret field ${fieldName}`),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test("accepts bounded W06 additions with a minor version bump", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-w06-additive-"));
    try {
      copyCompatibilityInputs(root);
      mutateCopiedJson(
        root,
        "packages/contracts/schemas/form/field-address.v1.schema.json",
        (schema) => {
          schema["x-japp-schema-version"] = "1.1.0";
          mutableObject(schema, "properties").future_identity_note = {
            title: "Bounded future identity note",
            description:
              "Synthetic optional field used only by compatibility tests.",
            type: "string",
            maxLength: 64,
          };
          const definitions = mutableObject(schema, "$defs");
          const hintKind = mutableObject(definitions, "resolutionHintKind");
          const tokens = mutableArray(hintKind, "enum");
          tokens.push("FUTURE_HINT");
          tokens.sort();
        },
      );
      const report = compareCompatibilitySignatures(
        currentSignature(),
        buildCompatibilitySignature(root),
      );
      expect(report.compatible).toBe(true);
      expect(report.findings).toEqual([]);
      expect(report.additive_changes).toEqual(
        expect.arrayContaining([
          {
            code: "OPTIONAL_PROPERTY_ADDED",
            subject: `${fieldAddressId}/future_identity_note`,
          },
          {
            code: "ENUM_TOKEN_ADDED",
            subject: `${fieldAddressId}#/$defs/resolutionHintKind/FUTURE_HINT`,
          },
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("M01-W07 platform mutation coverage", () => {
  const vocabularyId = "urn:japp:schema:platform:vocabulary:v1";
  const targetIdentityId = "urn:japp:schema:platform:target-identity:v1";
  const capabilityReportId = "urn:japp:schema:platform:capability-report:v1";
  const pathRequestId = "urn:japp:schema:platform:path-request:v1";
  const pathResolutionId = "urn:japp:schema:platform:path-resolution:v1";
  const secretRequestId = "urn:japp:schema:platform:secret-store-request:v1";
  const secretResultId = "urn:japp:schema:platform:secret-store-result:v1";
  const processPlanId = "urn:japp:schema:platform:process-plan:v1";
  const processStatusId = "urn:japp:schema:platform:process-status:v1";
  const registrationId =
    "urn:japp:schema:platform:native-messaging-registration:v1";
  const browserRecordId = "urn:japp:schema:platform:browser-record:v1";
  const modelProfileId = "urn:japp:schema:platform:model-runtime-profile:v1";
  const installerStateId = "urn:japp:schema:platform:installer-state:v1";
  const updateStateId = "urn:japp:schema:platform:update-state:v1";
  const diagnosticReportId = "urn:japp:schema:platform:diagnostic-report:v1";
  const evidenceRecordId = "urn:japp:schema:platform:evidence-record:v1";
  const certificationInputId =
    "urn:japp:schema:platform:certification-input:v1";

  function removeVocabularyToken(
    signature: CompatibilitySignature,
    definition: string,
    token: string,
  ): void {
    const tokens = contractDefinition(
      signature,
      vocabularyId,
      definition,
    ).tokens;
    const index = tokens.indexOf(token);
    if (index < 0) {
      throw new Error(`${definition}/${token} token missing`);
    }
    tokens.splice(index, 1);
  }

  test.each([
    [
      "dropping a certified platform identifier",
      (signature: CompatibilitySignature) => {
        removeVocabularyToken(signature, "certifiedPlatformId", "WINDOWS_X64");
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/certifiedPlatformId/WINDOWS_X64`,
    ],
    [
      "dropping a support tier",
      (signature: CompatibilitySignature) => {
        removeVocabularyToken(signature, "supportTier", "CERTIFIED_CORE");
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/supportTier/CERTIFIED_CORE`,
    ],
    [
      "dropping the unevaluated capability state",
      (signature: CompatibilitySignature) => {
        removeVocabularyToken(
          signature,
          "capabilityAvailability",
          "NOT_EVALUATED",
        );
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/capabilityAvailability/NOT_EVALUATED`,
    ],
    [
      "dropping the native-host registration path role",
      (signature: CompatibilitySignature) => {
        removeVocabularyToken(
          signature,
          "pathRole",
          "NATIVE_HOST_REGISTRATION",
        );
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/pathRole/NATIVE_HOST_REGISTRATION`,
    ],
    [
      "dropping the Windows-safe binary stdio mode",
      (signature: CompatibilitySignature) => {
        removeVocabularyToken(signature, "stdioMode", "BINARY_LENGTH_PREFIXED");
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/stdioMode/BINARY_LENGTH_PREFIXED`,
    ],
    [
      "dropping the orphaned process state",
      (signature: CompatibilitySignature) => {
        removeVocabularyToken(signature, "processState", "ORPHANED");
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/processState/ORPHANED`,
    ],
    [
      "renaming a reviewed secret key role",
      (signature: CompatibilitySignature) => {
        const tokens = contractDefinition(
          signature,
          vocabularyId,
          "secretKeyRole",
        ).tokens;
        const index = tokens.indexOf("DATABASE_ENCRYPTION_KEY");
        if (index < 0) {
          throw new Error("secretKeyRole/DATABASE_ENCRYPTION_KEY missing");
        }
        tokens[index] = "DB_KEY";
      },
      "ENUM_TOKEN_REMOVED",
      `${vocabularyId}#/$defs/secretKeyRole/DATABASE_ENCRYPTION_KEY`,
    ],
    [
      "removing the reviewed support claim from platform identity",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, targetIdentityId).properties,
          "support_claim",
        );
      },
      "PROPERTY_REMOVED",
      `${targetIdentityId}/support_claim`,
    ],
    [
      "removing capability reporting from the platform capability report",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, capabilityReportId).properties,
          "capabilities",
        );
      },
      "PROPERTY_REMOVED",
      `${capabilityReportId}/capabilities`,
    ],
    [
      "removing the typed path role from a path request",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, pathRequestId).properties,
          "role",
        );
      },
      "PROPERTY_REMOVED",
      `${pathRequestId}/role`,
    ],
    [
      "retyping the sanitized resolved location",
      (signature: CompatibilitySignature) => {
        contractProperty(
          contractRoot(signature, pathResolutionId),
          "sanitized_path",
        ).node.kind = "any";
      },
      "TYPE_CHANGED",
      `${pathResolutionId}/sanitized_path`,
    ],
    [
      "removing the secret-store operation vocabulary",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, secretRequestId).properties,
          "operation",
        );
      },
      "PROPERTY_REMOVED",
      `${secretRequestId}/operation`,
    ],
    [
      "removing explicit secret-store availability",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, secretResultId).properties,
          "store_availability",
        );
      },
      "PROPERTY_REMOVED",
      `${secretResultId}/store_availability`,
    ],
    [
      "removing the spawn-plan environment allowlist",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, processPlanId).properties,
          "environment_allowlist",
        );
      },
      "PROPERTY_REMOVED",
      `${processPlanId}/environment_allowlist`,
    ],
    [
      "retyping the spawn-plan argument array",
      (signature: CompatibilitySignature) => {
        contractProperty(
          contractRoot(signature, processPlanId),
          "arguments",
        ).node.kind = "string";
      },
      "TYPE_CHANGED",
      `${processPlanId}/arguments`,
    ],
    [
      "removing the orphan indicator from process status",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, processStatusId).properties,
          "orphan_detected",
        );
      },
      "PROPERTY_REMOVED",
      `${processStatusId}/orphan_detected`,
    ],
    [
      "removing the registration extension allowlist",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, registrationId).properties,
          "allowed_extension_ids",
        );
      },
      "PROPERTY_REMOVED",
      `${registrationId}/allowed_extension_ids`,
    ],
    [
      "widening the registration extension allowlist bound",
      (signature: CompatibilitySignature) => {
        contractProperty(
          contractRoot(signature, registrationId),
          "allowed_extension_ids",
        ).node.max_items = 2;
      },
      "CONSTRAINT_TIGHTENED",
      `${registrationId}/allowed_extension_ids`,
    ],
    [
      "removing the browser certification indicator",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, browserRecordId).properties,
          "certified_for_platform",
        );
      },
      "PROPERTY_REMOVED",
      `${browserRecordId}/certified_for_platform`,
    ],
    [
      "removing the model-profile artifact identity",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, modelProfileId).properties,
          "artifact",
        );
      },
      "PROPERTY_REMOVED",
      `${modelProfileId}/artifact`,
    ],
    [
      "removing the model-profile core fallback behavior",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, modelProfileId).properties,
          "core_capability_behavior",
        );
      },
      "PROPERTY_REMOVED",
      `${modelProfileId}/core_capability_behavior`,
    ],
    [
      "removing the installer signature state",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, installerStateId).properties,
          "signature_state",
        );
      },
      "PROPERTY_REMOVED",
      `${installerStateId}/signature_state`,
    ],
    [
      "removing the updater user-data preservation indicator",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, updateStateId).properties,
          "user_data_preservation",
        );
      },
      "PROPERTY_REMOVED",
      `${updateStateId}/user_data_preservation`,
    ],
    [
      "removing diagnostic redaction metadata",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, diagnosticReportId).properties,
          "redaction",
        );
      },
      "PROPERTY_REMOVED",
      `${diagnosticReportId}/redaction`,
    ],
    [
      "retyping the diagnostic blocking indicator",
      (signature: CompatibilitySignature) => {
        contractProperty(
          contractRoot(signature, diagnosticReportId),
          "blocking",
        ).node.kind = "string";
      },
      "TYPE_CHANGED",
      `${diagnosticReportId}/blocking`,
    ],
    [
      "removing the synthetic-only platform evidence guarantee",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, evidenceRecordId).properties,
          "synthetic_only",
        );
      },
      "PROPERTY_REMOVED",
      `${evidenceRecordId}/synthetic_only`,
    ],
    [
      "removing the certification evidence inventory",
      (signature: CompatibilitySignature) => {
        Reflect.deleteProperty(
          contractRoot(signature, certificationInputId).properties,
          "required_evidence_kinds",
        );
      },
      "PROPERTY_REMOVED",
      `${certificationInputId}/required_evidence_kinds`,
    ],
  ] as const)("%s is breaking", (_label, mutate, code, subject) => {
    expectCurrentFinding(mutate, code, subject);
  });

  test.each([
    [
      "reviewed support claims",
      "PLATFORM_TARGET_SUPPORT_CLAIM",
      targetIdentityId,
    ],
    [
      "capability and tier consistency",
      "PLATFORM_CAPABILITY_REPORT_INTEGRITY",
      capabilityReportId,
    ],
    ["spawn-plan safety", "PLATFORM_PROCESS_PLAN_SAFETY", processPlanId],
    [
      "secret-store request authority",
      "PLATFORM_SECRET_REQUEST_AUTHORITY",
      secretRequestId,
    ],
    [
      "model-profile acceptance evidence",
      "PLATFORM_MODEL_PROFILE_EVIDENCE",
      modelProfileId,
    ],
  ] as const)(
    "cannot weaken %s by removing its canonical semantic rule",
    (_label, ruleId, schemaId) => {
      expectCurrentFinding(
        (signature) => {
          const rule = semanticRule(signature, ruleId);
          signature.semantic_rules = signature.semantic_rules.filter(
            (candidate) => candidate !== rule,
          );
        },
        "SEMANTIC_RULE_REMOVED",
        ruleId,
      );

      const root = mkdtempSync(join(tmpdir(), "japp-w07-rule-removal-"));
      try {
        copyCompatibilityInputs(root);
        mutateCopiedJson(
          root,
          "packages/contracts/catalog/semantic-rules.v1.json",
          (catalog) => {
            catalog.entries = mutableArray(catalog, "entries").filter(
              (entry) =>
                typeof entry !== "object" ||
                entry === null ||
                Array.isArray(entry) ||
                (entry as MutableJsonObject).rule_id !== ruleId,
            );
          },
        );
        expect(() => buildCompatibilitySignature(root)).toThrow(
          new RegExp(`${schemaId}: expected rule kinds`),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test.each(["executable", "raw_selector", "password", "private_key"] as const)(
    "rejects the additive executable or secret platform field %s",
    (fieldName) => {
      const root = mkdtempSync(join(tmpdir(), "japp-w07-field-"));
      try {
        copyCompatibilityInputs(root);
        mutateCopiedJson(
          root,
          "packages/contracts/schemas/platform/process-plan.v1.schema.json",
          (schema) => {
            schema["x-japp-schema-version"] = "1.1.0";
            mutableObject(schema, "properties")[fieldName] = {
              title: "Prohibited executable or secret field",
              type: "string",
              maxLength: 512,
            };
          },
        );
        expect(() => buildCompatibilitySignature(root)).toThrow(
          new RegExp(`prohibited executable/secret field ${fieldName}`),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test("accepts a bounded platform addition with a minor version bump", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-w07-additive-"));
    try {
      copyCompatibilityInputs(root);
      mutateCopiedJson(
        root,
        "packages/contracts/schemas/platform/target-identity.v1.schema.json",
        (schema) => {
          schema["x-japp-schema-version"] = "1.1.0";
          mutableObject(schema, "properties").future_platform_note = {
            title: "Bounded future platform note",
            description:
              "Synthetic optional field used only by compatibility tests.",
            type: "string",
            maxLength: 64,
          };
        },
      );
      const report = compareCompatibilitySignatures(
        currentSignature(),
        buildCompatibilitySignature(root),
      );
      expect(report.compatible).toBe(true);
      expect(report.findings).toEqual([]);
      expect(report.additive_changes).toEqual([
        {
          code: "OPTIONAL_PROPERTY_ADDED",
          subject: `${targetIdentityId}/future_platform_note`,
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a platform addition without a minor bump is rejected", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-w07-no-bump-"));
    try {
      copyCompatibilityInputs(root);
      mutateCopiedJson(
        root,
        "packages/contracts/schemas/platform/target-identity.v1.schema.json",
        (schema) => {
          mutableObject(schema, "properties").future_platform_note = {
            title: "Bounded future platform note",
            description:
              "Synthetic optional field used only by compatibility tests.",
            type: "string",
            maxLength: 64,
          };
        },
      );
      const report = compareCompatibilitySignatures(
        currentSignature(),
        buildCompatibilitySignature(root),
      );
      expect(report.compatible).toBe(false);
      expect(report.findings).toContainEqual({
        code: "MINOR_BUMP_REQUIRED",
        subject: targetIdentityId,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
