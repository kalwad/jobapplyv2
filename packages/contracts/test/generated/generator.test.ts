/**
 * M01-W02 generator tests: determinism, drift detection, and input safety.
 *
 * Engine-level cases exercise generateContracts/compareGeneratedTree with
 * temporary fixture trees; CLI-level cases spawn the real
 * scripts/generate-contracts.ts under the running Node so the exact command
 * the contract-gen suite executes is what gets proven. Nothing here touches
 * the repository's own schemas/ or generated/ trees destructively.
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, homedir, hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import ts from "typescript";

import { loadSchemaCatalog } from "../../src/index.ts";
import {
  buildIrCatalog,
  UnsupportedConstructError,
} from "../../generator/ir.ts";
import { emitPython } from "../../generator/emit-python.ts";
import { emitTypescript } from "../../generator/emit-typescript.ts";
import {
  assertSafeRelativePath,
  generateContracts,
} from "../../generator/generate.ts";
import {
  compareGeneratedTree,
  installGeneratedTree,
  listTreeFiles,
} from "../../generator/fsops.ts";
import {
  DEFAULT_GENERATED_ROOT,
  parseCliArguments,
} from "../../generator/cli.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const CLI_PATH = join(REPO_ROOT, "scripts", "generate-contracts.ts");
const SCHEMAS_ROOT = fileURLToPath(new URL("../../schemas", import.meta.url));

const temporaryRoots: string[] = [];

function makeTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "japp-gentest-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

interface CliResult {
  readonly status: number;
  readonly output: string;
}

function runCliProcess(...cliArguments: string[]): CliResult {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...cliArguments], {
      encoding: "utf8",
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as {
      status?: number | null;
      stdout?: string;
      stderr?: string;
    };
    return {
      status: failure.status ?? -1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

/** Copy the real schema catalog into a mutable temporary fixture. */
function copySchemas(): string {
  const root = join(makeTemporaryRoot(), "schemas");
  cpSync(SCHEMAS_ROOT, root, { recursive: true });
  return root;
}

function treeSnapshot(root: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const relative of listTreeFiles(root)) {
    snapshot.set(
      relative,
      readFileSync(join(root, ...relative.split("/")), "utf8"),
    );
  }
  return snapshot;
}

describe("determinism", () => {
  test("two independent generations are byte-identical", () => {
    const first = generateContracts();
    const second = generateContracts();
    expect([...first.tree.files.keys()]).toEqual([...second.tree.files.keys()]);
    for (const [path, content] of first.tree.files) {
      expect(second.tree.files.get(path)).toBe(content);
    }
  });

  test("reversed catalog enumeration order produces identical emission", () => {
    const catalog = loadSchemaCatalog();
    const reversed = {
      entries: [...catalog.entries].reverse(),
      byId: catalog.byId,
    };
    const sortedIr = buildIrCatalog(catalog);
    const reversedIr = buildIrCatalog(reversed);
    const render = (files: readonly { path: string; content: string }[]) =>
      files.map((file) => `${file.path}\n${file.content}`).join("\u0000");
    expect(render(emitTypescript(reversedIr))).toBe(
      render(emitTypescript(sortedIr)),
    );
    expect(render(emitPython(reversedIr))).toBe(render(emitPython(sortedIr)));
  });

  test("committed generated tree equals regeneration exactly", () => {
    const { tree } = generateContracts();
    expect(compareGeneratedTree(tree, DEFAULT_GENERATED_ROOT)).toEqual([]);
  });

  test("outputs embed no environment identity or platform separators", () => {
    const { tree } = generateContracts();
    const today = new Date().toISOString().slice(0, 10);
    const machineHostname = hostname();
    for (const [path, content] of tree.files) {
      expect(path.includes("\\")).toBe(false);
      expect(content.includes(REPO_ROOT.replace(/[/\\]$/, ""))).toBe(false);
      expect(content.includes(homedir())).toBe(false);
      expect(content.includes(tmpdir())).toBe(false);
      expect(content.includes(today)).toBe(false);
      if (machineHostname.length >= 6) {
        expect(content.includes(machineHostname)).toBe(false);
      }
    }
    const manifest = tree.files.get("MANIFEST.json");
    expect(manifest).toBeDefined();
    const parsed = JSON.parse(manifest ?? "{}") as {
      inputs: { path: string; sha256: string }[];
      outputs: { path: string; sha256: string }[];
    };
    expect(parsed.inputs.length).toBe(43);
    expect(parsed.outputs.length).toBe(tree.files.size - 1);
    for (const entry of [...parsed.inputs, ...parsed.outputs]) {
      expect(entry.path.includes("\\")).toBe(false);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("check mode (real CLI)", () => {
  test("passes on the committed tree without modifying it", () => {
    const before = treeSnapshot(DEFAULT_GENERATED_ROOT);
    const result = runCliProcess("--check");
    expect(result.output).toContain("byte-identical");
    expect(result.status).toBe(0);
    expect(treeSnapshot(DEFAULT_GENERATED_ROOT)).toEqual(before);
  });

  test("a hand edit to one generated file fails with MODIFIED", () => {
    const generatedCopy = join(makeTemporaryRoot(), "generated");
    cpSync(DEFAULT_GENERATED_ROOT, generatedCopy, { recursive: true });
    const victim = join(generatedCopy, "typescript", "index.ts");
    writeFileSync(victim, readFileSync(victim, "utf8") + "// hand edit\n");
    const result = runCliProcess("--check", "--generated-root", generatedCopy);
    expect(result.status).toBe(1);
    expect(result.output).toContain("MODIFIED");
    expect(result.output).toContain("typescript/index.ts");
  });

  test("a missing generated file fails with MISSING", () => {
    const generatedCopy = join(makeTemporaryRoot(), "generated");
    cpSync(DEFAULT_GENERATED_ROOT, generatedCopy, { recursive: true });
    rmSync(join(generatedCopy, "typescript", "common", "money.v1.ts"));
    const result = runCliProcess("--check", "--generated-root", generatedCopy);
    expect(result.status).toBe(1);
    expect(result.output).toContain("MISSING");
    expect(result.output).toContain("typescript/common/money.v1.ts");
  });

  test("an unexpected extra generated file fails with EXTRA", () => {
    const generatedCopy = join(makeTemporaryRoot(), "generated");
    cpSync(DEFAULT_GENERATED_ROOT, generatedCopy, { recursive: true });
    writeFileSync(
      join(generatedCopy, "typescript", "stowaway.ts"),
      "export const stowaway = true;\n",
    );
    const result = runCliProcess("--check", "--generated-root", generatedCopy);
    expect(result.status).toBe(1);
    expect(result.output).toContain("EXTRA");
    expect(result.output).toContain("typescript/stowaway.ts");
  });

  test("a schema change without regeneration fails the check", () => {
    const schemas = copySchemas();
    const moneyPath = join(schemas, "common", "money.v1.schema.json");
    const money = JSON.parse(readFileSync(moneyPath, "utf8")) as {
      description: string;
    };
    money.description = `${money.description} Edited without regeneration.`;
    writeFileSync(moneyPath, `${JSON.stringify(money, null, 2)}\n`);
    const result = runCliProcess("--check", "--schemas-root", schemas);
    expect(result.status).toBe(1);
    expect(result.output).toContain("MODIFIED");
    expect(result.output).toContain("MANIFEST.json");
  });

  test("an empty generated root reports the complete missing inventory", () => {
    const emptyRoot = join(makeTemporaryRoot(), "generated");
    const result = runCliProcess("--check", "--generated-root", emptyRoot);
    expect(result.status).toBe(1);
    const missingCount = (result.output.match(/MISSING/g) ?? []).length;
    expect(missingCount).toBe(generateContracts().tree.files.size);
  });

  test("unknown CLI arguments are a usage error", () => {
    const result = runCliProcess("--frobnicate");
    expect(result.status).toBe(2);
    expect(result.output).toContain("unknown argument");
    expect(() => parseCliArguments(["--schemas-root"])).toThrow(
      /requires a directory/,
    );
  });
});

describe("write mode", () => {
  test("deleting a schema leaves no stale generated output", () => {
    const schemas = copySchemas();
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    const firstRun = runCliProcess(
      "--schemas-root",
      schemas,
      "--generated-root",
      generatedRoot,
    );
    expect(firstRun.status).toBe(0);
    const withFixture = listTreeFiles(generatedRoot);
    expect(withFixture).toContain("typescript/fixture/test-record.v1.ts");
    expect(withFixture).toContain(
      "python/src/japp_contracts/fixture/test_record_v1.py",
    );

    rmSync(join(schemas, "fixture"), { recursive: true });
    const secondRun = runCliProcess(
      "--schemas-root",
      schemas,
      "--generated-root",
      generatedRoot,
    );
    expect(secondRun.status).toBe(0);
    const withoutFixture = listTreeFiles(generatedRoot);
    expect(withoutFixture.filter((path) => path.includes("fixture"))).toEqual(
      [],
    );
    const followUpCheck = runCliProcess(
      "--check",
      "--schemas-root",
      schemas,
      "--generated-root",
      generatedRoot,
    );
    expect(followUpCheck.status).toBe(0);
  });

  test("write mode replaces stray pre-existing content wholesale", () => {
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    mkdirSync(join(generatedRoot, "stale-dir"), { recursive: true });
    writeFileSync(join(generatedRoot, "stale-dir", "old.txt"), "stale\n");
    const result = runCliProcess("--generated-root", generatedRoot);
    expect(result.status).toBe(0);
    expect(
      listTreeFiles(generatedRoot).filter((path) => path.includes("stale")),
    ).toEqual([]);
  });

  test("write mode removes a symlink at the target instead of writing through it", () => {
    const base = makeTemporaryRoot();
    const victimDirectory = join(base, "victim");
    mkdirSync(victimDirectory, { recursive: true });
    const sentinel = join(victimDirectory, "sentinel.txt");
    writeFileSync(sentinel, "untouched\n");
    const generatedRoot = join(base, "generated");
    let symlinkSupported = true;
    try {
      symlinkSync(victimDirectory, generatedRoot, "dir");
    } catch {
      // Windows without developer mode cannot create symlinks; the
      // wholesale-replacement guarantee is still proven by the stray-content
      // case above, so this case only strengthens platforms that can link.
      symlinkSupported = false;
    }
    if (symlinkSupported) {
      const result = runCliProcess("--generated-root", generatedRoot);
      expect(result.status).toBe(0);
      expect(readFileSync(sentinel, "utf8")).toBe("untouched\n");
      expect(
        listTreeFiles(generatedRoot).filter((path) =>
          path.includes("sentinel"),
        ),
      ).toEqual([]);
    }
    expect(readFileSync(sentinel, "utf8")).toBe("untouched\n");
  });
});

describe("input safety", () => {
  test("a convention violation fails closed before any write", () => {
    const schemas = copySchemas();
    const notePath = join(schemas, "common", "calendar-date.v1.schema.json");
    const document = JSON.parse(readFileSync(notePath, "utf8")) as {
      $defs: { calendarDate: Record<string, unknown> };
    };
    document.$defs.calendarDate.default = "2026-01-01";
    writeFileSync(notePath, `${JSON.stringify(document, null, 2)}\n`);
    const generatedRoot = join(makeTemporaryRoot(), "generated");
    const result = runCliProcess(
      "--schemas-root",
      schemas,
      "--generated-root",
      generatedRoot,
    );
    expect(result.status).toBe(2);
    expect(result.output).toContain("prohibited keyword default");
    expect(listTreeFiles(generatedRoot)).toEqual([]);
  });

  test("duplicate $id documents fail the catalog gate", () => {
    const schemas = copySchemas();
    const original = readFileSync(
      join(schemas, "common", "money.v1.schema.json"),
      "utf8",
    );
    // Same $id at a second path: both the path<->id rule and the duplicate
    // rule reject it, and every violation is reported.
    writeFileSync(
      join(schemas, "common", "money-copy.v1.schema.json"),
      original,
    );
    const result = runCliProcess("--check", "--schemas-root", schemas);
    expect(result.status).toBe(2);
    expect(result.output).toContain("does not match the path-derived");
    expect(result.output).toContain("duplicate $id");
  });

  test("an unresolved catalog reference fails the gate", () => {
    const schemas = copySchemas();
    const correlation = join(schemas, "common", "correlation.v1.schema.json");
    const document = JSON.parse(readFileSync(correlation, "utf8")) as {
      $defs: { correlationId: { $ref: string } };
    };
    document.$defs.correlationId.$ref =
      "urn:japp:schema:common:missing-target:v1#/$defs/nothing";
    writeFileSync(correlation, `${JSON.stringify(document, null, 2)}\n`);
    const result = runCliProcess("--check", "--schemas-root", schemas);
    expect(result.status).toBe(2);
    expect(result.output).toContain("not a committed catalog schema");
  });

  test("a remote reference fails the gate", () => {
    const schemas = copySchemas();
    const correlation = join(schemas, "common", "correlation.v1.schema.json");
    const document = JSON.parse(readFileSync(correlation, "utf8")) as {
      $defs: { correlationId: { $ref: string } };
    };
    document.$defs.correlationId.$ref =
      "https://example.invalid/schemas/stable-id.json";
    writeFileSync(correlation, `${JSON.stringify(document, null, 2)}\n`);
    const result = runCliProcess("--check", "--schemas-root", schemas);
    expect(result.status).toBe(2);
    expect(result.output).toContain("remote, relative, and file references");
  });

  test("an unsupported construct fails with document path and pointer", () => {
    const schemas = copySchemas();
    const location = join(schemas, "common", "location.v1.schema.json");
    const document = JSON.parse(readFileSync(location, "utf8")) as {
      $defs: {
        structuredLocation: {
          properties: Record<string, unknown>;
          required: string[];
        };
      };
    };
    // M01-W04 adds only bounded safe integers; an unbounded integer fails
    // closed rather than silently weakening exact byte-count semantics.
    document.$defs.structuredLocation.properties.former_names = {
      type: "integer",
    };
    writeFileSync(location, `${JSON.stringify(document, null, 2)}\n`);
    const result = runCliProcess("--check", "--schemas-root", schemas);
    expect(result.status).toBe(2);
    expect(result.output).toContain("common/location.v1.schema.json");
    expect(result.output).toContain(
      "#/$defs/structuredLocation/properties/former_names",
    );
    expect(result.output).toContain(
      "integer schemas require inclusive minimum and maximum",
    );
  });

  test("bounded safe integers emit strict TypeScript and Python semantics", () => {
    const schemas = copySchemas();
    const location = join(schemas, "common", "location.v1.schema.json");
    const document = JSON.parse(readFileSync(location, "utf8")) as {
      $defs: {
        structuredLocation: {
          properties: Record<string, unknown>;
        };
      };
    };
    document.$defs.structuredLocation.properties.priority = {
      type: "integer",
      minimum: 0,
      maximum: 10,
    };
    writeFileSync(location, `${JSON.stringify(document, null, 2)}\n`);
    const generation = generateContracts({ schemasRoot: schemas });
    const typescript = generation.tree.files.get(
      "typescript/common/location.v1.ts",
    );
    const python = generation.tree.files.get(
      "python/src/japp_contracts/common/location_v1.py",
    );
    expect(typescript).toContain("readonly priority?: number;");
    expect(typescript).toContain(
      "Integer; runtime validation rejects fractions and coercion.",
    );
    expect(python).toContain("Annotated[int, Ge(0), Le(10)]");
  });

  test("every reviewed generated model member collision fails closed", () => {
    // Exact public `dir(BaseModel)` snapshot for the repository-pinned
    // Pydantic 2.12.5, plus ContractModel.wire_dict. Keeping the expectation
    // independent from the emitter makes dropping any reviewed collision a
    // visible mutation failure.
    const collisions = [
      "construct",
      "copy",
      "dict",
      "from_orm",
      "json",
      "model_computed_fields",
      "model_config",
      "model_construct",
      "model_copy",
      "model_dump",
      "model_dump_json",
      "model_extra",
      "model_fields",
      "model_fields_set",
      "model_json_schema",
      "model_parametrized_name",
      "model_post_init",
      "model_rebuild",
      "model_validate",
      "model_validate_json",
      "model_validate_strings",
      "parse_file",
      "parse_obj",
      "parse_raw",
      "schema",
      "schema_json",
      "update_forward_refs",
      "validate",
      "wire_dict",
    ] as const;
    const catalog = loadSchemaCatalog();
    const fixtureEntry = catalog.entries.find((entry) =>
      entry.id.includes("test-record"),
    );
    expect(fixtureEntry).toBeDefined();
    if (fixtureEntry === undefined) {
      return;
    }

    for (const collision of collisions) {
      const mutated = structuredClone(fixtureEntry.document);
      const properties = mutated.properties as Record<string, unknown>;
      properties[collision] = {
        type: "string",
        minLength: 1,
        maxLength: 16,
      };
      const mutatedEntry = { ...fixtureEntry, document: mutated };
      const entries = catalog.entries.map((entry) =>
        entry.id === fixtureEntry.id ? mutatedEntry : entry,
      );
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      expect(
        () => emitPython(buildIrCatalog({ entries, byId })),
        collision,
      ).toThrow(/not a safe Python\/Pydantic field identifier/);
    }
  });

  test("Pydantic protected prefixes fail while safe model fields emit", () => {
    const catalog = loadSchemaCatalog();
    const fixtureEntry = catalog.entries.find((entry) =>
      entry.id.includes("test-record"),
    );
    expect(fixtureEntry).toBeDefined();
    if (fixtureEntry === undefined) {
      return;
    }

    for (const collision of ["model_validate_custom", "model_dump_custom"]) {
      const mutated = structuredClone(fixtureEntry.document);
      const properties = mutated.properties as Record<string, unknown>;
      properties[collision] = {
        type: "string",
        minLength: 1,
        maxLength: 16,
      };
      const mutatedEntry = { ...fixtureEntry, document: mutated };
      const entries = catalog.entries.map((entry) =>
        entry.id === fixtureEntry.id ? mutatedEntry : entry,
      );
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      expect(
        () => emitPython(buildIrCatalog({ entries, byId })),
        collision,
      ).toThrow(/not a safe Python\/Pydantic field identifier/);
    }

    const generated = generateContracts().tree.files.get(
      "python/src/japp_contracts/resume/atomic_claim_v1.py",
    );
    expect(generated).toContain("    model_digest:");
    expect(generated).toContain("    model_profile_ref:");
  });

  test("unsupported or unsafe integer variants fail closed", () => {
    const variants: readonly [
      label: string,
      schema: Record<string, unknown>,
      expected: RegExp,
    ][] = [
      [
        "missing bound",
        { type: "integer", minimum: 0 },
        /require inclusive minimum and maximum/,
      ],
      [
        "fractional bound",
        { type: "integer", minimum: 0.5, maximum: 10 },
        /minimum must be a safe integer/,
      ],
      [
        "unsafe bound",
        { type: "integer", minimum: 0, maximum: 9_007_199_254_740_992 },
        /maximum must be a safe integer/,
      ],
      [
        "reversed bounds",
        { type: "integer", minimum: 10, maximum: 0 },
        /minimum must be less than or equal to maximum/,
      ],
      [
        "exclusive bound",
        {
          type: "integer",
          minimum: 0,
          maximum: 10,
          exclusiveMinimum: 0,
        },
        /keyword "exclusiveMinimum" is not supported/,
      ],
      [
        "multiple",
        { type: "integer", minimum: 0, maximum: 10, multipleOf: 2 },
        /keyword "multipleOf" is not supported/,
      ],
    ];
    for (const [label, integerSchema, expected] of variants) {
      const schemas = copySchemas();
      const location = join(schemas, "common", "location.v1.schema.json");
      const document = JSON.parse(readFileSync(location, "utf8")) as {
        $defs: {
          structuredLocation: {
            properties: Record<string, unknown>;
          };
        };
      };
      document.$defs.structuredLocation.properties.priority = integerSchema;
      writeFileSync(location, `${JSON.stringify(document, null, 2)}\n`);
      expect(() => generateContracts({ schemasRoot: schemas }), label).toThrow(
        expected,
      );
    }
  });

  test("general anyOf beyond the nullability form fails closed", () => {
    const catalog = loadSchemaCatalog();
    const fixtureEntry = catalog.entries.find((entry) =>
      entry.id.includes("test-record"),
    );
    expect(fixtureEntry).toBeDefined();
    if (fixtureEntry === undefined) {
      return;
    }
    const mutated = structuredClone(fixtureEntry.document);
    (mutated.properties as Record<string, unknown>).superseded_by = {
      anyOf: [{ type: "string" }, { type: "number" }],
    };
    const syntheticCatalog = {
      entries: [{ ...fixtureEntry, document: mutated }],
      byId: new Map([
        [fixtureEntry.id, { ...fixtureEntry, document: mutated }],
      ]),
    };
    expect(() => buildIrCatalog(syntheticCatalog)).toThrow(
      UnsupportedConstructError,
    );
    expect(() => buildIrCatalog(syntheticCatalog)).toThrow(
      /anyOf.*nullability/,
    );
  });

  test("untrusted descriptions cannot inject TypeScript or Python source", () => {
    const schemas = copySchemas();
    const money = join(schemas, "common", "money.v1.schema.json");
    const document = JSON.parse(readFileSync(money, "utf8")) as {
      $defs: { money: { description?: string } };
    };
    const evil =
      '*/ throw new Error("pwned"); /* """\nimport os  # pwned\n\u2028\u0007';
    document.$defs.money.description = evil;
    writeFileSync(money, `${JSON.stringify(document, null, 2)}\n`);

    const generation = generateContracts({ schemasRoot: schemas });
    const moneyTs = generation.tree.files.get("typescript/common/money.v1.ts");
    expect(moneyTs).toBeDefined();
    const transpiled = ts.transpileModule(moneyTs ?? "", {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    });
    expect(transpiled.diagnostics ?? []).toEqual([]);
    expect(moneyTs).not.toContain('*/ throw new Error("pwned")');
    expect(moneyTs).toContain("*\\/ throw new Error");

    const moneyPy = generation.tree.files.get(
      "python/src/japp_contracts/common/money_v1.py",
    );
    expect(moneyPy).toBeDefined();
    expect(moneyPy).not.toContain("\nimport os");
    expect(moneyPy).toContain("\\nimport os");
    // The adversarial BEL and U+2028 characters survive as escapes/
    // replacements, never as raw control characters in emitted source.
    expect(moneyTs).toContain("�");
    expect(moneyPy).toContain("\\u0007");
    expect(moneyPy).toContain("\\u2028");
    const hasRawControl = (text: string): boolean => {
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
          return true;
        }
      }
      return false;
    };
    for (const [path, content] of generation.tree.files) {
      expect(hasRawControl(content), path).toBe(false);
    }
  });

  test("generated output paths cannot escape the generated root", () => {
    expect(() => {
      assertSafeRelativePath("../escape.ts");
    }).toThrow(/escape/);
    expect(() => {
      assertSafeRelativePath("typescript/../../escape.ts");
    }).toThrow(/escape/);
    expect(() => {
      assertSafeRelativePath("/absolute.ts");
    }).toThrow(/escape/);
    expect(() => {
      assertSafeRelativePath("typescript\\windows.ts");
    }).toThrow(/escape/);
    expect(() => {
      assertSafeRelativePath("typescript/common/money.v1.ts");
    }).not.toThrow();
  });

  test("only *.schema.json files are accepted under the schemas root", () => {
    const schemas = copySchemas();
    writeFileSync(join(schemas, "common", "notes.txt"), "stray\n");
    const result = runCliProcess("--check", "--schemas-root", schemas);
    expect(result.status).toBe(2);
    expect(result.output).toContain("only *.schema.json documents");
  });
});

describe("engine invariants", () => {
  test("installGeneratedTree writes exactly the in-memory tree", () => {
    const { tree } = generateContracts();
    const root = join(makeTemporaryRoot(), "generated");
    installGeneratedTree(tree, root);
    const written = treeSnapshot(root);
    expect([...written.keys()]).toEqual([...tree.files.keys()]);
    for (const [path, content] of tree.files) {
      expect(written.get(path)).toBe(content);
    }
  });

  test("compareGeneratedTree classifies every drift kind", () => {
    const { tree } = generateContracts();
    const root = join(makeTemporaryRoot(), "generated");
    installGeneratedTree(tree, root);
    rmSync(join(root, "README.md"));
    writeFileSync(join(root, "EXTRA.txt"), "extra\n");
    const manifestPath = join(root, "MANIFEST.json");
    writeFileSync(manifestPath, readFileSync(manifestPath, "utf8") + "\n");
    const findings = compareGeneratedTree(tree, root);
    const kinds = findings.map((finding) => `${finding.kind}:${finding.path}`);
    expect(kinds).toContain("MISSING:README.md");
    expect(kinds).toContain("EXTRA:EXTRA.txt");
    expect(kinds).toContain("MODIFIED:MANIFEST.json");
  });
});
