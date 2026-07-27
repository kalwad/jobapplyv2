import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  BASELINE_PATH,
  BaselineError,
  loadBaseline,
} from "./breaking/baseline.ts";
import {
  buildCompatibilitySignature,
  compareCompatibilitySignatures,
  REPOSITORY_ROOT,
  type CompatibilitySignature,
  type DocumentSignature,
  type NodeSignature,
  type PropertySignature,
  type SupportedCaseSignature,
} from "./breaking/compatibility-signature.ts";

function cloneSignature(): CompatibilitySignature {
  return structuredClone(loadBaseline().signature);
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
  ]) {
    const source = join(REPOSITORY_ROOT, relative);
    const target = join(root, relative);
    cpSync(source, target, { recursive: true });
  }
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
  });

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
  });

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
