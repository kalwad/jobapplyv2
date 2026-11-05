import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { loadSchemaCatalog } from "../../src/index.ts";
import {
  isJsonObject,
  type JsonObject,
  type JsonValue,
} from "../../src/json.ts";
import { buildIrCatalog } from "../../generator/ir.ts";
import { emitPython } from "../../generator/emit-python.ts";
import { generateContracts } from "../../generator/generate.ts";
import { installGeneratedTree } from "../../generator/fsops.ts";
import { runBoundedCliProcess } from "./support/bounded-cli.ts";

const ID = "urn:japp:schema:desktop:service-diagnostics:v1";
const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const base = loadSchemaCatalog();
const roots: string[] = [];
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
  if (!isJsonObject(value)) throw new Error("expected fixture object");
  return value;
}
function catalog(mode: "direct" | "transitive" | "safe") {
  const entries = base.entries.map((entry) => {
    if (entry.id !== ID) return entry;
    const document = structuredClone(entry.document);
    if (!Array.isArray(document.oneOf))
      throw new Error("missing fixture union");
    const branches = document.oneOf.map(object);
    for (const branch of branches) {
      object(branch.properties).link = {
        $ref: mode === "direct" ? ID : "#/$defs/bridge",
      };
    }
    delete document.oneOf;
    document.type = "object";
    document.additionalProperties = false;
    document.required = ["marker"];
    document.properties = { marker: { type: "string", enum: ["ROOT"] } };
    document.$defs = {
      choice: { oneOf: branches },
      ...(mode === "direct"
        ? {}
        : {
            bridge: {
              type: "object",
              additionalProperties: false,
              required: ["child"],
              properties: {
                child:
                  mode === "safe"
                    ? { type: "string", enum: ["LEAF"] }
                    : { $ref: ID },
              },
            },
          }),
    };
    return { ...entry, document };
  });
  return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])) };
}

for (const mode of ["direct", "transitive"] as const) {
  test(`named union rejects ${mode} acyclic own-root forward dependency before emission`, () => {
    expect(() => buildIrCatalog(catalog(mode))).toThrow(
      /union definition dependency on its document root/,
    );
  });
}

test("acyclic named union definition refs remain accepted and Python imports", () => {
  const ir = buildIrCatalog(catalog("safe"));
  const root = mkdtempSync(join(tmpdir(), "japp-union-def-"));
  roots.push(root);
  const files = new Map(generateContracts().tree.files);
  for (const file of emitPython(ir)) files.set(file.path, file.content);
  installGeneratedTree({ files }, root);
  const python = join(
    ROOT,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const outcome = runBoundedCliProcess(
    python,
    [
      "-c",
      "import sys; sys.path.insert(0, sys.argv[1]); import japp_contracts.desktop.service_diagnostics_v1; print('IMPORTED')",
      join(root, "python/src"),
    ],
    ROOT,
  );
  expect(outcome.status, outcome.output).toBe(0);
  expect(outcome.output.trim()).toBe("IMPORTED");
});
