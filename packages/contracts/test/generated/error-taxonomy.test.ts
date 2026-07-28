/**
 * M01-W03 error-taxonomy tests: catalog integrity, family invariants,
 * user-safe message policy, generated TypeScript lookup surfaces, and
 * fail-closed generator behavior for tampered catalogs and the new
 * array/boolean constructs.
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

import { loadSchemaCatalog, createContractValidator } from "../../src/index.ts";
import {
  deriveMessageKey,
  lintUserSafeMessage,
  loadErrorCatalog,
  ErrorCatalogError,
} from "../../generator/error-catalog.ts";
import { generateContracts } from "../../generator/generate.ts";
import {
  ERROR_CATALOG_V1,
  ERROR_CODES_V1,
  errorDefaultMessageV1,
  isErrorCodeV1,
  requireErrorCatalogEntryV1,
  validateErrorRecordV1,
  type ErrorTaxonomyV1ErrorCode,
  type ErrorTaxonomyV1ErrorFamily,
} from "../../generated/typescript/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const CLI_PATH = join(REPO_ROOT, "scripts", "generate-contracts.ts");
const SCHEMAS_ROOT = fileURLToPath(new URL("../../schemas", import.meta.url));
const CATALOG_ROOT = fileURLToPath(new URL("../../catalog", import.meta.url));
const CATALOG_FILE = "error-catalog.v1.json";
const MODEL_RESULT_PRESERVATION =
  "All accepted deterministic results remain usable and unchanged.";

const REQUIRED_FAMILIES: readonly ErrorTaxonomyV1ErrorFamily[] = [
  "VALIDATION",
  "CONFLICT",
  "UNSUPPORTED",
  "SENSITIVE",
  "MODEL",
  "STORAGE",
  "TRANSPORT",
  "RENDERING",
  "SITE",
  "BENCHMARK",
  "GATE",
  "SUBMISSION",
];

const temporaryRoots: string[] = [];

function makeTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "japp-errtest-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      // Windows releases the file handles a just-exited child held
      // asynchronously, so an immediate recursive remove can still hit EPERM
      // or EBUSY on a directory an external toolchain wrote. maxRetries is
      // Node's documented mechanism for exactly that; the removal must still
      // succeed, so nothing here is weakened.
      rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
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

interface CatalogEntryJson {
  code: string;
  family: string;
  message_key: string;
  default_message: string;
  remediation?: string;
  severity: string;
  retry_disposition: string;
  user_action_required: boolean;
  transient: boolean;
  diagnostic_policy: string;
  owning_boundary?: string;
  added_in: string;
  deprecated_since?: string;
}

interface CatalogJson {
  catalog_version: string;
  entries: CatalogEntryJson[];
}

function readCommittedCatalog(): CatalogJson {
  return JSON.parse(
    readFileSync(join(CATALOG_ROOT, CATALOG_FILE), "utf8"),
  ) as CatalogJson;
}

/** Copy the committed catalog into a mutable temp dir and mutate it. */
function tamperedCatalogRoot(mutate: (catalog: CatalogJson) => void): string {
  const root = join(makeTemporaryRoot(), "catalog");
  cpSync(CATALOG_ROOT, root, { recursive: true });
  const catalog = readCommittedCatalog();
  mutate(catalog);
  writeFileSync(
    join(root, CATALOG_FILE),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  return root;
}

function loadTampered(mutate: (catalog: CatalogJson) => void): () => void {
  const catalogRoot = tamperedCatalogRoot(mutate);
  const catalog = loadSchemaCatalog();
  const validator = createContractValidator(catalog);
  return () => {
    loadErrorCatalog({ catalogRoot, catalog, validator });
  };
}

describe("catalog integrity (committed data)", () => {
  const catalog = readCommittedCatalog();

  test("generated TypeScript catalog values exactly match canonical data", () => {
    expect(Object.values(ERROR_CATALOG_V1)).toEqual(catalog.entries);
  });

  test("all twelve required families exist and no other family appears", () => {
    const present = new Set(catalog.entries.map((entry) => entry.family));
    expect([...present].sort()).toEqual([...REQUIRED_FAMILIES].sort());
    const fromGenerated = new Set(
      Object.values(ERROR_CATALOG_V1).map((entry) => entry.family),
    );
    expect(fromGenerated.size).toBe(12);
  });

  test("every code is unique, family-prefixed, and completely described", () => {
    const seen = new Set<string>();
    for (const entry of catalog.entries) {
      expect(seen.has(entry.code), entry.code).toBe(false);
      seen.add(entry.code);
      expect(entry.code.startsWith(`${entry.family}_`), entry.code).toBe(true);
      expect(entry.code).toMatch(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/);
      expect(entry.message_key).toBe(deriveMessageKey(entry.code));
      expect(entry.default_message.length).toBeGreaterThan(0);
      expect(entry.default_message.length).toBeLessThanOrEqual(200);
      expect(entry.severity.length).toBeGreaterThan(0);
      expect(entry.retry_disposition.length).toBeGreaterThan(0);
      expect(typeof entry.user_action_required).toBe("boolean");
      expect(typeof entry.transient).toBe("boolean");
      expect(entry.diagnostic_policy.length).toBeGreaterThan(0);
      expect(entry.added_in).toBe("1.0.0");
    }
  });

  test("message keys are unique and messages are user-safe", () => {
    const keys = catalog.entries.map((entry) => entry.message_key);
    expect(new Set(keys).size).toBe(keys.length);
    const forbidden = [/[{}<>%$\\`]/, /:\/\//, /Traceback/i, /https?/i];
    for (const entry of catalog.entries) {
      const texts = [entry.default_message, entry.remediation].filter(
        (text): text is string => text !== undefined,
      );
      for (const text of texts) {
        expect(lintUserSafeMessage(text), `${entry.code}: ${text}`).toEqual([]);
        for (const pattern of forbidden) {
          expect(pattern.test(text), `${entry.code}: ${String(pattern)}`).toBe(
            false,
          );
        }
        for (const char of text) {
          const code = char.codePointAt(0) ?? 0;
          expect(code >= 0x20 && code < 0x7f, `${entry.code}: control`).toBe(
            true,
          );
        }
      }
    }
  });

  test("catalog codes and the schema code enum agree exactly", () => {
    const schemaCatalog = loadSchemaCatalog();
    const taxonomy = schemaCatalog.byId.get(
      "urn:japp:schema:error:taxonomy:v1",
    );
    expect(taxonomy).toBeDefined();
    const defs = taxonomy?.document.$defs as Record<
      string,
      { enum?: string[] }
    >;
    const declared = [...(defs.errorCode?.enum ?? [])].sort();
    expect(catalog.entries.map((entry) => entry.code)).toEqual(declared);
    expect([...ERROR_CODES_V1]).toEqual(declared);
  });
});

describe("family invariants", () => {
  const byFamily = new Map<string, CatalogEntryJson[]>();
  for (const entry of readCommittedCatalog().entries) {
    const list = byFamily.get(entry.family) ?? [];
    list.push(entry);
    byFamily.set(entry.family, list);
  }

  test("sensitive errors require user action and never fall back", () => {
    for (const entry of byFamily.get("SENSITIVE") ?? []) {
      expect(entry.user_action_required, entry.code).toBe(true);
      expect(
        ["PAUSE_FOR_USER", "NO_RETRY_PROHIBITED"].includes(
          entry.retry_disposition,
        ),
        entry.code,
      ).toBe(true);
    }
  });

  test("site ambiguity and uncertainty pause rather than blind-retry", () => {
    for (const entry of byFamily.get("SITE") ?? []) {
      expect(entry.retry_disposition, entry.code).toBe("PAUSE_FOR_USER");
      expect(entry.user_action_required, entry.code).toBe(true);
    }
  });

  test("model failures preserve accepted deterministic results", () => {
    for (const entry of byFamily.get("MODEL") ?? []) {
      const text = `${entry.default_message} ${entry.remediation ?? ""}`;
      expect(/discard|erase|reset your|deleted your/i.test(text)).toBe(false);
      expect(entry.default_message, entry.code).toContain(
        MODEL_RESULT_PRESERVATION,
      );
    }
  });

  test("reviewed model retry semantics distinguish retry from remediation", () => {
    const malformed = ERROR_CATALOG_V1.MODEL_MALFORMED_OUTPUT;
    expect(malformed.retry_disposition).toBe("SAFE_RETRY");
    expect(malformed.transient).toBe(true);
    expect(malformed.user_action_required).toBe(false);

    const validation = ERROR_CATALOG_V1.MODEL_VALIDATION_FAILED;
    expect(validation.retry_disposition).toBe("RETRY_AFTER_REMEDIATION");
    expect(validation.transient).toBe(false);
    expect(validation.user_action_required).toBe(false);
    expect(validation.remediation).toBe(
      "Correct the source evidence or generation request before trying again.",
    );
  });

  /** Remove honestly-negated phrases, leaving any positive claim behind. */
  function stripNegations(text: string): string {
    return text
      .replace(
        /\b(?:did not|not|never|is not|was not)\s+(?:pass(?:ed)?|submitted|marked as submitted|succeed(?:ed)?)\b/gi,
        "",
      )
      .replace(/\bnot passed\b/gi, "");
  }

  test("gate errors never read as PASS and cannot be retried blindly", () => {
    for (const entry of byFamily.get("GATE") ?? []) {
      expect(entry.retry_disposition, entry.code).not.toBe("SAFE_RETRY");
      expect(entry.transient, entry.code).toBe(false);
      const text = stripNegations(
        `${entry.default_message} ${entry.remediation ?? ""}`,
      );
      expect(/\bpass(?:ed)?\b/i.test(text), `${entry.code}: ${text}`).toBe(
        false,
      );
      expect(/\bsucceed|successful/i.test(text), entry.code).toBe(false);
    }
  });

  test("submission errors never claim success without receipt evidence", () => {
    for (const entry of byFamily.get("SUBMISSION") ?? []) {
      const text = stripNegations(
        `${entry.default_message} ${entry.remediation ?? ""}`,
      );
      expect(
        /\bsubmitted successfully\b|\bsubmission succeeded\b|\bmarked as submitted\b|\bsuccessful/i.test(
          text,
        ),
        `${entry.code}: ${text}`,
      ).toBe(false);
      expect(entry.retry_disposition, entry.code).not.toBe("SAFE_RETRY");
    }
  });

  test("unsupported and benchmark conditions never silently downgrade", () => {
    for (const family of ["UNSUPPORTED", "BENCHMARK"]) {
      for (const entry of byFamily.get(family) ?? []) {
        expect(entry.retry_disposition, entry.code).not.toBe("SAFE_RETRY");
      }
    }
    const threshold = ERROR_CATALOG_V1.BENCHMARK_THRESHOLD_FAILED;
    expect(threshold.retry_disposition).toBe("NO_RETRY_TERMINAL");
    expect(threshold.default_message).toContain("never lowered");
  });

  test("transient conditions are exactly the safe-retry conditions", () => {
    for (const entry of readCommittedCatalog().entries) {
      expect(entry.transient, entry.code).toBe(
        entry.retry_disposition === "SAFE_RETRY",
      );
    }
  });
});

describe("generated TypeScript surfaces", () => {
  test("lookups are deterministic and complete", () => {
    expect(ERROR_CODES_V1.length).toBe(80);
    expect([...ERROR_CODES_V1]).toEqual([...ERROR_CODES_V1].sort());
    for (const code of ERROR_CODES_V1) {
      const entry = requireErrorCatalogEntryV1(code);
      expect(entry.code).toBe(code);
      expect(errorDefaultMessageV1(code)).toBe(entry.default_message);
      expect(requireErrorCatalogEntryV1(code)).toBe(entry);
    }
  });

  test("unknown lookups fail closed without echoing input", () => {
    const hostile = "SITE_<script>alert(1)</script>";
    expect(isErrorCodeV1(hostile)).toBe(false);
    expect(isErrorCodeV1(42)).toBe(false);
    expect(isErrorCodeV1("toString")).toBe(false);
    expect(isErrorCodeV1("__proto__")).toBe(false);
    let message = "";
    try {
      requireErrorCatalogEntryV1(hostile);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("unknown error code");
    expect(message.includes("script")).toBe(false);
  });

  test("catalog metadata is frozen against mutation", () => {
    const entry = requireErrorCatalogEntryV1("MODEL_TIMEOUT");
    expect(Object.isFrozen(ERROR_CATALOG_V1)).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => {
      (entry as { severity: string }).severity = "WARNING";
    }).toThrow(TypeError);
  });

  test("record wrapper narrows and derives metadata from the code only", () => {
    const outcome = validateErrorRecordV1({
      error_id: "err_0123456789ABCDEFGHJKMNPQRS",
      code: "SENSITIVE_AUTHENTICATION_BOUNDARY",
      occurred_at: "2026-07-27T06:00:00Z",
      origin: "EXTENSION_CONTENT_SCRIPT",
      correlation_id: "wf_0123456789ABCDEFGHJKMNPQRS",
    });
    expect(outcome.valid).toBe(true);
    if (outcome.valid) {
      const code: ErrorTaxonomyV1ErrorCode = outcome.value.code;
      const metadata = requireErrorCatalogEntryV1(code);
      expect(metadata.retry_disposition).toBe("PAUSE_FOR_USER");
      expect(metadata.user_action_required).toBe(true);
      expect(metadata.diagnostic_policy).toBe("FORBID_CAPTURE");
    }
  });
});

describe("fail-closed generator behavior", () => {
  test("generation rejects transient=true with a non-safe-retry disposition", () => {
    const catalogRoot = tamperedCatalogRoot((catalog) => {
      const entry = catalog.entries.find(
        (candidate) => candidate.code === "MODEL_RUNTIME_UNAVAILABLE",
      );
      if (entry !== undefined) {
        entry.transient = true;
      }
    });
    expect(() => generateContracts({ catalogRoot })).toThrow(
      /MODEL_RUNTIME_UNAVAILABLE: transient=true requires retry_disposition=SAFE_RETRY \(found RETRY_AFTER_REMEDIATION\)/,
    );
  });

  test("generation rejects safe-retry with transient=false", () => {
    const catalogRoot = tamperedCatalogRoot((catalog) => {
      const entry = catalog.entries.find(
        (candidate) => candidate.code === "MODEL_TIMEOUT",
      );
      if (entry !== undefined) {
        entry.transient = false;
      }
    });
    expect(() => generateContracts({ catalogRoot })).toThrow(
      /MODEL_TIMEOUT: retry_disposition=SAFE_RETRY requires transient=true/,
    );
  });

  test("a catalog entry removed without regeneration fails the catalog gate", () => {
    const attempt = loadTampered((catalog) => {
      catalog.entries = catalog.entries.filter(
        (entry) => entry.code !== "MODEL_TIMEOUT",
      );
    });
    expect(attempt).toThrow(ErrorCatalogError);
    expect(attempt).toThrow(
      /missing entries for declared codes: MODEL_TIMEOUT/,
    );
  });

  test("an undeclared catalog code fails the gate in both directions", () => {
    // Direction 2 (undeclared entry) is stopped by the taxonomy enum at
    // strict schema validation, before the integrity comparison even runs;
    // direction 1 (declared-but-missing) is the previous test.
    const attempt = loadTampered((catalog) => {
      const clone = structuredClone(catalog.entries[0]);
      if (clone === undefined) {
        throw new Error("committed catalog is empty");
      }
      clone.code = "BENCHMARK_ZZ_UNDECLARED";
      clone.family = "BENCHMARK";
      clone.message_key = "error.benchmark.zz_undeclared";
      catalog.entries.push(clone);
    });
    expect(attempt).toThrow(ErrorCatalogError);
    expect(attempt).toThrow(/schema validation failed/);
  });

  test("a family/prefix mismatch fails the gate", () => {
    const attempt = loadTampered((catalog) => {
      const entry = catalog.entries.find(
        (candidate) => candidate.code === "MODEL_TIMEOUT",
      );
      if (entry !== undefined) {
        entry.family = "TRANSPORT";
      }
    });
    expect(attempt).toThrow(/disagrees with the code prefix/);
  });

  test("a non-derived message key fails the gate", () => {
    const attempt = loadTampered((catalog) => {
      const entry = catalog.entries.find(
        (candidate) => candidate.code === "MODEL_TIMEOUT",
      );
      if (entry !== undefined) {
        entry.message_key = "error.model.slow";
      }
    });
    expect(attempt).toThrow(/message_key must be the derived key/);
  });

  test("unsorted entries fail the gate", () => {
    const attempt = loadTampered((catalog) => {
      catalog.entries.reverse();
    });
    expect(attempt).toThrow(/sorted by code/);
  });

  test("a sensitive code allowing silent fallback fails the gate", () => {
    const attempt = loadTampered((catalog) => {
      const entry = catalog.entries.find(
        (candidate) => candidate.code === "SENSITIVE_INFERENCE_PROHIBITED",
      );
      if (entry !== undefined) {
        entry.retry_disposition = "SAFE_RETRY";
        entry.transient = true;
        entry.user_action_required = false;
      }
    });
    expect(attempt).toThrow(/SENSITIVE errors must require user action/);
  });

  test("a URL smuggled into a message fails the lint gate", () => {
    const attempt = loadTampered((catalog) => {
      const entry = catalog.entries.find(
        (candidate) => candidate.code === "TRANSPORT_TIMEOUT",
      );
      if (entry !== undefined) {
        entry.default_message = "Visit help.example.com/support for details.";
      }
    });
    expect(attempt).toThrow(/must not contain URLs/);
  });

  test("the real CLI fails closed on a tampered catalog root", () => {
    const catalogRoot = tamperedCatalogRoot((catalog) => {
      catalog.entries = catalog.entries.slice(0, 5);
    });
    const result = runCliProcess("--check", "--catalog-root", catalogRoot);
    expect(result.status).toBe(2);
    expect(result.output).toContain("error catalog violates its contract");
  });

  test("a missing catalog file fails generation before any write", () => {
    const emptyRoot = join(makeTemporaryRoot(), "catalog");
    mkdirSync(emptyRoot, { recursive: true });
    const result = runCliProcess("--check", "--catalog-root", emptyRoot);
    expect(result.status).toBe(2);
    expect(result.output).toContain("cannot read the canonical error catalog");
  });
});

describe("array and boolean construct support", () => {
  function schemasWith(defs: Record<string, unknown>): string {
    const root = join(makeTemporaryRoot(), "schemas");
    cpSync(SCHEMAS_ROOT, root, { recursive: true });
    const documentPath = join(
      root,
      "fixture",
      "construct-probe.v1.schema.json",
    );
    const document = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:japp:schema:fixture:construct-probe:v1",
      title: "Construct probe (test-only)",
      description:
        "Test-only fixture document probing generator construct support.",
      "x-japp-schema-version": "1.0.0",
      $defs: defs,
    };
    writeFileSync(documentPath, `${JSON.stringify(document, null, 2)}\n`);
    return root;
  }

  test("uniform arrays and booleans generate in both languages", () => {
    const schemas = schemasWith({
      flags: {
        title: "Flag list",
        type: "array",
        items: { type: "boolean" },
        minItems: 1,
        maxItems: 8,
      },
    });
    const generation = generateContracts({ schemasRoot: schemas });
    const ts = generation.tree.files.get(
      "typescript/fixture/construct-probe.v1.ts",
    );
    expect(ts).toContain("readonly boolean[]");
    const py = generation.tree.files.get(
      "python/src/japp_contracts/fixture/construct_probe_v1.py",
    );
    expect(py).toContain("Annotated[list[bool], MinLen(1), MaxLen(8)]");
  });

  test("tuple arrays fail closed with path and pointer", () => {
    const schemas = schemasWith({
      pair: {
        title: "Tuple probe",
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        items: { type: "string" },
      },
    });
    expect(() => generateContracts({ schemasRoot: schemas })).toThrow(
      /construct-probe\.v1\.schema\.json.*#\/\$defs\/pair.*prefixItems/s,
    );
  });

  test("uniqueItems stays unsupported and fails closed", () => {
    const schemas = schemasWith({
      tags: {
        title: "Unique probe",
        type: "array",
        items: { type: "string" },
        uniqueItems: true,
      },
    });
    expect(() => generateContracts({ schemasRoot: schemas })).toThrow(
      /uniqueItems/,
    );
  });

  test("boolean nodes reject stray constraint keywords", () => {
    const schemas = schemasWith({
      flag: {
        title: "Boolean probe",
        type: "boolean",
        minLength: 1,
      },
    });
    expect(() => generateContracts({ schemasRoot: schemas })).toThrow(
      /minLength/,
    );
  });
});
