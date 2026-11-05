import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import ts from "typescript";
import {
  signatureForIrType,
  compareCompatibilitySignatures,
  type CompatibilitySignature,
} from "../contract/breaking/compatibility-signature.ts";
import { loadSchemaCatalog, createContractValidator } from "../../src/index.ts";
import {
  isJsonObject,
  type JsonObject,
  type JsonValue,
} from "../../src/json.ts";
import {
  buildIrCatalog,
  UnsupportedConstructError,
} from "../../generator/ir.ts";
import { generateContracts } from "../../generator/generate.ts";
import { installGeneratedTree } from "../../generator/fsops.ts";
import { runBoundedCliProcess } from "./support/bounded-cli.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const ID = "urn:japp:schema:desktop:service-diagnostics:v1";
const base = loadSchemaCatalog();
const roots: string[] = [];
const temporary = () => {
  const path = mkdtempSync(join(tmpdir(), "japp-union-"));
  roots.push(path);
  return path;
};
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
});
function object(value: JsonValue | undefined): JsonObject {
  if (!isJsonObject(value)) throw new Error("expected schema object");
  return value;
}
function members(node: JsonObject): JsonObject[] {
  if (!Array.isArray(node.oneOf)) throw new Error("expected oneOf");
  return node.oneOf.map(object);
}
function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error("missing fixture member");
  return value;
}
function member(node: JsonObject, index: number): JsonObject {
  return at(members(node), index);
}
function properties(node: JsonObject): JsonObject {
  return object(node.properties);
}
function modified(change: (node: JsonObject) => void) {
  const entries = base.entries.map((entry) => {
    if (entry.id !== ID) return entry;
    const document = structuredClone(entry.document);
    change(document);
    return { ...entry, document };
  });
  return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])) };
}
const request = "req_00000000000000000000000001";
const ready = {
  request_id: request,
  state: "READY",
  service_version: "0.0.1",
  api_version: "1.0.0",
};
const unavailable = { request_id: request, state: "UNAVAILABLE" };
const cases: {
  label: string;
  ref: string;
  valid: boolean;
  instance: unknown;
}[] = [
  { label: "ready", ref: ID, valid: true, instance: ready },
  ...[
    "UNAVAILABLE",
    "STARTING",
    "STOPPING",
    "STOPPED",
    "FAILED",
    "CLEANUP_FAILED",
    "CANCELLED",
  ].map((state) => ({
    label: state,
    ref: ID,
    valid: true,
    instance: { request_id: request, state },
  })),
  {
    label: "ready missing versions",
    ref: ID,
    valid: false,
    instance: { request_id: request, state: "READY" },
  },
  {
    label: "ready missing api",
    ref: ID,
    valid: false,
    instance: { request_id: request, state: "READY", service_version: "0.0.1" },
  },
  {
    label: "unavailable version leakage",
    ref: ID,
    valid: false,
    instance: { ...unavailable, service_version: "0.0.1" },
  },
  {
    label: "private token",
    ref: ID,
    valid: false,
    instance: { ...ready, token: "private" },
  },
  {
    label: "private url",
    ref: ID,
    valid: false,
    instance: { ...unavailable, url: "http://127.0.0.1:9" },
  },
  {
    label: "request format",
    ref: ID,
    valid: false,
    instance: { ...ready, request_id: "req_bad" },
  },
  {
    label: "null state",
    ref: ID,
    valid: false,
    instance: { ...ready, state: null },
  },
  {
    label: "unknown state",
    ref: ID,
    valid: false,
    instance: { ...ready, state: "UNKNOWN" },
  },
  {
    label: "version coercion",
    ref: ID,
    valid: false,
    instance: { ...ready, api_version: 1 },
  },
  {
    label: "version bounds",
    ref: ID,
    valid: false,
    instance: { ...ready, api_version: "1".repeat(33) },
  },
  {
    label: "version pattern",
    ref: ID,
    valid: false,
    instance: { ...ready, service_version: "not-a-version" },
  },
  {
    label: "request valid",
    ref: "urn:japp:schema:desktop:service-request:v1",
    valid: true,
    instance: { request_id: request },
  },
  {
    label: "request extra",
    ref: "urn:japp:schema:desktop:service-request:v1",
    valid: false,
    instance: { request_id: request, operation: "arbitrary" },
  },
  {
    label: "request null",
    ref: "urn:japp:schema:desktop:service-request:v1",
    valid: false,
    instance: { request_id: null },
  },
  {
    label: "cancel valid",
    ref: "urn:japp:schema:desktop:service-cancellation:v1",
    valid: true,
    instance: { request_id: request, outcome: "CANCELLATION_REQUESTED" },
  },
  {
    label: "cancel finished",
    ref: "urn:japp:schema:desktop:service-cancellation:v1",
    valid: true,
    instance: { request_id: request, outcome: "ALREADY_FINISHED" },
  },
  {
    label: "cancel unknown",
    ref: "urn:japp:schema:desktop:service-cancellation:v1",
    valid: false,
    instance: { request_id: request, outcome: "SUCCESS" },
  },
];

test("actual canonical generation accepts the frozen disjoint Diagnostics schema", () => {
  const result = generateContracts();
  const root = result.ir.documents.find((document) => document.id === ID)?.root;
  expect(root?.kind).toBe("discriminatedUnion");
  if (root?.kind !== "discriminatedUnion")
    throw new Error("disjoint union missing");
  expect(root.discriminator).toBe("state");
  expect(root.branches).toHaveLength(2);
  expect(
    root.branches.map((branch) =>
      branch.properties
        .filter((property) => property.required)
        .map((property) => property.name),
    ),
  ).toEqual([
    ["request_id", "state", "service_version", "api_version"],
    ["request_id", "state"],
  ]);
});

const invalid: readonly [string, (node: JsonObject) => void][] = [
  [
    "overlapping tags",
    (node) => {
      properties(member(node, 1)).state = {
        type: "string",
        enum: ["READY", "UNAVAILABLE"],
      };
    },
  ],
  [
    "optional discriminator",
    (node) => {
      member(node, 1).required = ["request_id"];
    },
  ],
  [
    "open branch",
    (node) => {
      member(node, 0).additionalProperties = true;
    },
  ],
  [
    "non-object branch",
    (node) => {
      node.oneOf = [{ type: "string", enum: ["READY"] }, member(node, 1)];
    },
  ],
  [
    "unbounded discriminator",
    (node) => {
      properties(member(node, 1)).state = { type: "string" };
    },
  ],
  [
    "numeric const",
    (node) => {
      properties(member(node, 0)).state = { const: 1 };
    },
  ],
  [
    "boolean const",
    (node) => {
      properties(member(node, 0)).state = { const: true };
    },
  ],
  [
    "unsafe constant text",
    (node) => {
      properties(member(node, 0)).state = { const: 'READY"; arbitrary()' };
    },
  ],
  [
    "const sibling constraint",
    (node) => {
      properties(member(node, 0)).state = { const: "READY", minLength: 1 };
    },
  ],
  [
    "oneOf sibling constraint",
    (node) => {
      node.minProperties = 1;
    },
  ],
  [
    "single branch",
    (node) => {
      node.oneOf = [member(node, 0)];
    },
  ],
  [
    "empty branches",
    (node) => {
      node.oneOf = [];
    },
  ],
  [
    "unresolved branch reference",
    (node) => {
      properties(member(node, 0)).api_version = {
        $ref: "urn:japp:schema:missing:version:v1",
      };
    },
  ],
  [
    "branch ignored constraint",
    (node) => {
      member(node, 0).minProperties = 1;
    },
  ],
  [
    "generic anyOf remains unsupported",
    (node) => {
      node.anyOf = members(node);
      delete node.oneOf;
    },
  ],
  [
    "anonymous nested object union",
    (node) => {
      properties(member(node, 0)).detail = {
        oneOf: structuredClone(members(node)),
      };
    },
  ],
];
for (const [label, mutate] of invalid) {
  test(`IR fails closed for ${label}`, () => {
    expect(() => buildIrCatalog(modified(mutate))).toThrow(
      UnsupportedConstructError,
    );
  });
}

test("union branch references participate in named-definition cycle rejection", () => {
  expect(() =>
    buildIrCatalog(
      modified((node) => {
        const branch = (target: string) => {
          const union = { oneOf: structuredClone(members(node)) };
          for (const member of union.oneOf)
            properties(member).link = { $ref: `#/$defs/${target}` };
          return union;
        };
        node.$defs = { first: branch("second"), second: branch("first") };
      }),
    ),
  ).toThrow(/dependency cycle/);
});

test("canonical Ajv exactly retains all branch required, extra-field and version constraints", () => {
  const validator = createContractValidator(base);
  for (const entry of cases) {
    const before = JSON.stringify(entry.instance);
    expect(
      validator.validateInstance(entry.ref, entry.instance).valid,
      entry.label,
    ).toBe(entry.valid);
    expect(JSON.stringify(entry.instance)).toBe(before);
  }
});

test("generated strict Pydantic discriminated models match all canonical cases", () => {
  const root = temporary();
  const generated = join(root, "generated");
  installGeneratedTree(generateContracts().tree, generated);
  const input = join(root, "cases.json");
  writeFileSync(input, JSON.stringify(cases));
  const python = join(
    ROOT,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const probe = fileURLToPath(
    new URL("./support/discriminated_union_probe.py", import.meta.url),
  );
  const outcome = runBoundedCliProcess(python, [probe, generated, input], ROOT);
  expect(outcome.status, outcome.output).toBe(0);
  expect(JSON.parse(outcome.output)).toEqual({
    cases: 25,
    matched: 25,
    pydantic_version: "2.12.5",
    coercion_or_extra_fields: false,
  });
});

test("generated TypeScript union narrows by state and rejects invalid branch shapes", () => {
  const result = generateContracts();
  const root = temporary();
  for (const [path, content] of result.tree.files) {
    if (
      !path.startsWith("typescript/") ||
      path.endsWith("validators.ts") ||
      path.endsWith("index.ts")
    )
      continue;
    const destination = join(root, path);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, content);
  }
  const fixture = join(root, "typing.ts");
  writeFileSync(
    fixture,
    `import type { DesktopServiceDiagnosticsV1 } from "./typescript/desktop/service-diagnostics.v1.ts";\nconst ready: DesktopServiceDiagnosticsV1 = {request_id:"${request}",state:"READY",service_version:"0.0.1",api_version:"1.0.0"};\nconst unavailable: DesktopServiceDiagnosticsV1 = {request_id:"${request}",state:"UNAVAILABLE"};\nfunction version(value: DesktopServiceDiagnosticsV1): string { return value.state === "READY" ? value.api_version : value.state; }\nversion(ready); version(unavailable);\n// @ts-expect-error READY requires both version fields\nconst missing: DesktopServiceDiagnosticsV1 = {request_id:"${request}",state:"READY"};\n// @ts-expect-error other states forbid version fields on closed object literals\nconst extra: DesktopServiceDiagnosticsV1 = {request_id:"${request}",state:"STOPPED",api_version:"1.0.0"};\n// @ts-expect-error discriminator is a closed finite string set\nconst unknown: DesktopServiceDiagnosticsV1 = {request_id:"${request}",state:"UNKNOWN"};\n`,
  );
  const program = ts.createProgram([fixture], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowImportingTsExtensions: true,
    types: [],
    skipLibCheck: true,
  });
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
  ).toEqual([]);
});

test("all inherited generated model and runtime bytes stay exact", () => {
  const generation = generateContracts();
  const inherited = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../fixtures/pre-union-model-digests.v1.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as { files: Record<string, string> };
  expect(Object.keys(inherited.files)).toHaveLength(194);
  for (const [path, digest] of Object.entries(inherited.files)) {
    const content = generation.tree.files.get(path);
    expect(content, path).toBeDefined();
    expect(
      createHash("sha256")
        .update(content ?? "")
        .digest("hex"),
      path,
    ).toBe(digest);
  }
});

test("recursive union root reference is rejected before Python emission", () => {
  expect(() =>
    buildIrCatalog(
      modified((node) => {
        properties(member(node, 0)).child = { $ref: ID };
      }),
    ),
  ).toThrow(/dependency cycle/);
});

test("recursive union definition is rejected before Python emission", () => {
  expect(() =>
    buildIrCatalog(
      modified((node) => {
        const branches = structuredClone(members(node));
        properties(at(branches, 0)).child = { $ref: "#/$defs/recursive" };
        node.$defs = { recursive: { oneOf: branches } };
      }),
    ),
  ).toThrow(/dependency cycle/);
});

test("union dependency traversal rejects an indirect root-object cycle", () => {
  expect(() =>
    buildIrCatalog(
      modified((node) => {
        properties(member(node, 0)).child = { $ref: "#/$defs/link" };
        node.$defs = {
          link: {
            type: "object",
            additionalProperties: false,
            required: ["child"],
            properties: { child: { $ref: ID } },
          },
        };
      }),
    ),
  ).toThrow(/dependency cycle/);
});

test("overlarge otherwise-disjoint unions fail closed", () => {
  expect(() =>
    buildIrCatalog(
      modified((node) => {
        const branch = member(node, 0);
        node.oneOf = Array.from({ length: 33 }, (_, index) => {
          const copy = structuredClone(branch);
          properties(copy).state = { const: `STATE_${String(index)}` };
          return copy;
        });
      }),
    ),
  ).toThrow(UnsupportedConstructError);
});

test("string-typed const retains the exact one-token accepted set", () => {
  const ir = buildIrCatalog(
    modified((node) => {
      properties(member(node, 0)).state = { type: "string", const: "READY" };
    }),
  );
  const root = ir.documents.find((entry) => entry.id === ID)?.root;
  if (root?.kind !== "discriminatedUnion")
    throw new Error("disjoint union missing");
  expect(
    root.branches[0]?.properties.find((entry) => entry.name === "state")?.type,
  ).toMatchObject({ kind: "enum", tokens: ["READY"] });
});

function unionSignature() {
  const root = buildIrCatalog(base).documents.find(
    (entry) => entry.id === ID,
  )?.root;
  if (root?.kind !== "discriminatedUnion") throw new Error("missing union");
  return signatureForIrType(root);
}
function signatureWithUnion(): CompatibilitySignature {
  const baseline = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          "../contract/baseline/compatibility-signature.v2.json",
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as { signature: CompatibilitySignature };
  const value = structuredClone(baseline.signature);
  value.documents.push({
    id: ID,
    path: "desktop/service-diagnostics.v1.schema.json",
    major: 1,
    version: "1.0.0",
    definitions: {},
    root: unionSignature(),
  });
  return value;
}

test("new union document remains a nonbreaking additive compatibility surface", () => {
  const inherited = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          "../contract/baseline/compatibility-signature.v2.json",
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as { signature: CompatibilitySignature };
  const result = compareCompatibilitySignatures(
    inherited.signature,
    signatureWithUnion(),
  );
  expect(result.compatible).toBe(true);
  expect(
    result.additive_changes.some((finding) => finding.subject === ID),
  ).toBe(true);
});

for (const change of [
  "discriminator",
  "required",
  "extra-fields",
  "tag",
  "reference",
]) {
  test(`published union compatibility fails closed for changed ${change}`, () => {
    const before = signatureWithUnion();
    const after = structuredClone(before);
    const node = after.documents.at(-1)?.root;
    const branch = node?.union_branches?.[0];
    const api = branch?.properties.api_version;
    const state = branch?.properties.state;
    if (!node || !branch || !api || !state)
      throw new Error("missing union signature");
    if (change === "discriminator") node.union_discriminator = "request_id";
    else if (change === "required") api.required = false;
    else if (change === "extra-fields") branch.extension_point = true;
    else if (change === "tag") state.node.tokens = ["OTHER"];
    else api.node.ref_id = "urn:japp:schema:other:version:v1";
    const result = compareCompatibilitySignatures(before, after);
    expect(result.compatible).toBe(false);
    expect(
      result.findings.some((finding) => finding.code === "CONSTRAINT_CHANGED"),
    ).toBe(true);
  });
}
