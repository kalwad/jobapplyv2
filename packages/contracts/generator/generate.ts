/**
 * Contract-generation orchestrator (M01-W02).
 *
 * Pipeline: load the canonical schema catalog through the fail-closed
 * M01-W01 convention loader, compile it through the strict Ajv 2020
 * validator (the unweakened input gate), normalize to the supported IR,
 * emit the TypeScript and Python trees, and attach the deterministic
 * provenance manifest plus the generated README.
 *
 * The complete output exists only as an in-memory map of POSIX-relative
 * paths to LF-normalized UTF-8 content; writing and checking are separate
 * concerns (fsops.ts). Nothing here reads clocks, environment identity, or
 * absolute paths into the output.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_SCHEMAS_ROOT,
  loadSchemaCatalog,
  type SchemaCatalog,
} from "../src/catalog.ts";
import { createContractValidator } from "../src/validator.ts";
import { buildIrCatalog, type IrCatalog } from "./ir.ts";
import { emitPython } from "./emit-python.ts";
import { emitTypescript, type GeneratedFile } from "./emit-typescript.ts";
import {
  DEFAULT_CATALOG_ROOT,
  emitPythonCatalogData,
  emitTypescriptCatalogData,
  ERROR_CATALOG_SCHEMA_ID,
  loadErrorCatalog,
  PYTHON_CATALOG_DATA_EXPORTS,
  type LoadedErrorCatalog,
} from "./error-catalog.ts";
import {
  emitPythonSecurityPolicy,
  emitTypescriptSecurityPolicy,
  loadSecurityPolicy,
  PYTHON_SECURITY_POLICY_EXPORTS,
  type LoadedSecurityPolicy,
} from "./security-policy.ts";
import {
  emitPythonSemanticRules,
  emitTypescriptSemanticRules,
  loadSemanticRules,
  PYTHON_SEMANTIC_RULE_EXPORTS,
  SEMANTIC_RULE_CATALOG_SCHEMA_ID,
  type LoadedSemanticRules,
} from "./semantic-rules.ts";
import {
  pythonModuleName,
  schemaRef,
  typeName,
  typescriptModulePath,
} from "./naming.ts";

/**
 * Bump on any change to generated output shape or content rules.
 * 1.1.0 (M01-W03): array/boolean schema constructs, the canonical
 * error-catalog data input, generated catalog-data modules, and the
 * manifest dataInputs provenance section.
 * 1.2.0 (M01-W04): bounded safe-integer schemas plus canonical capability,
 * command, and authorization-policy data inputs and generated policy
 * lookup/authorization surfaces.
 * 1.3.0 (M01-W06): feasibility/benchmark roots plus the canonical finite
 * semantic-rule catalog and generated matching TypeScript/Python evaluators.
 * 1.4.0 (M01-W07): the built-in finite semantic-rule vocabulary grows by the
 * eighteen platform rule kinds, so the emitted TypeScript/Python evaluator
 * modules contain new generator-owned logic rather than only new data rows.
 * No IR construct, emitter shape, manifest field, or naming rule changed;
 * the bump exists so a consumer cannot mistake a 1.3.0 artifact for one that
 * can evaluate the platform contracts.
 * 1.5.0 (M01-W07 corrective): deprecated v1 platform evaluators preserve the
 * published accepted-set union while distinct v2 rule kinds carry the reviewed
 * strict semantics and the generator emits the corresponding v2 roots.
 */
export const GENERATOR_FORMAT_VERSION = "1.5.0";

/** Generator configuration embedded in the provenance manifest. */
export const GENERATOR_CONFIG = {
  pythonPackage: "japp_contracts",
  pythonRuntime: "pydantic-v2-strict",
  targets: ["python", "typescript"],
  typescriptRuntime: "canonical-ajv-catalog",
} as const;

const MANIFEST_PATH = "MANIFEST.json";
const README_PATH = "README.md";

export interface GeneratedTree {
  /** POSIX-relative path -> exact file content (LF, UTF-8). */
  readonly files: ReadonlyMap<string, string>;
}

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function assertSafeRelativePath(path: string): void {
  const segments = path.split("/");
  const valid =
    segments.length > 0 &&
    segments.every(
      (segment) =>
        /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(segment) &&
        !segment.includes("..") &&
        segment !== ".",
    );
  if (!valid || path.startsWith("/") || path.includes("\\")) {
    throw new Error(
      `generated output path ${JSON.stringify(path)} would escape the ` +
        "generated root; refusing to write it",
    );
  }
}

function assertLfUtf8(path: string, content: string): void {
  if (content.includes("\r")) {
    throw new Error(
      `generated output ${path} contains a carriage return; outputs are ` +
        "LF-only",
    );
  }
}

interface ManifestInput {
  readonly id: string;
  readonly path: string;
  readonly schemaVersion: string;
  readonly sha256: string;
}

interface ManifestDataInput {
  readonly path: string;
  readonly sha256: string;
  readonly validatedAgainst: string;
  readonly version: string;
}

interface ManifestTypeEntry {
  readonly python: { readonly module: string; readonly symbol: string };
  readonly typescript: { readonly export: string; readonly module: string };
}

function buildManifest(
  catalog: SchemaCatalog,
  ir: IrCatalog,
  files: readonly GeneratedFile[],
  schemaBytes: ReadonlyMap<string, string>,
  errorCatalog: LoadedErrorCatalog,
  securityPolicy: LoadedSecurityPolicy,
  semanticRules: LoadedSemanticRules,
): string {
  const inputs: ManifestInput[] = [...catalog.entries]
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map((entry) => {
      const raw = schemaBytes.get(entry.relativePath);
      if (raw === undefined) {
        throw new Error(`missing raw bytes for ${entry.relativePath}`);
      }
      return {
        id: entry.id,
        path: `packages/contracts/schemas/${entry.relativePath}`,
        schemaVersion: `${String(entry.version.major)}.${String(entry.version.minor)}.${String(entry.version.patch)}`,
        sha256: sha256Hex(raw),
      };
    });

  const types: Record<string, ManifestTypeEntry> = {};
  for (const document of ir.documents) {
    const targets: (string | null)[] = document.definitions.map(
      (definition) => definition.name,
    );
    if (document.root !== null) {
      targets.push(null);
    }
    for (const def of targets) {
      types[schemaRef(document, def)] = {
        python: {
          module: pythonModuleName(document),
          symbol: typeName(document, def),
        },
        typescript: {
          export: typeName(document, def),
          module: `typescript/${typescriptModulePath(document)}`,
        },
      };
    }
  }

  const outputs = [...files]
    .sort((left, right) => (left.path < right.path ? -1 : 1))
    .map((file) => ({
      path: file.path,
      sha256: sha256Hex(file.content),
    }));

  const dataInputs: ManifestDataInput[] = [
    {
      path: errorCatalog.repositoryPath,
      sha256: sha256Hex(errorCatalog.rawText),
      validatedAgainst: ERROR_CATALOG_SCHEMA_ID,
      version: errorCatalog.version,
    },
    ...securityPolicy.dataInputs.map((input) => ({
      path: input.repositoryPath,
      sha256: sha256Hex(input.rawText),
      validatedAgainst: input.schemaId,
      version: input.version,
    })),
    {
      path: semanticRules.repositoryPath,
      sha256: sha256Hex(semanticRules.rawText),
      validatedAgainst: SEMANTIC_RULE_CATALOG_SCHEMA_ID,
      version: semanticRules.version,
    },
  ].sort((left, right) => (left.path < right.path ? -1 : 1));

  const manifest = {
    config: GENERATOR_CONFIG,
    dataInputs,
    formatVersion: GENERATOR_FORMAT_VERSION,
    generator: "scripts/generate-contracts.ts",
    inputs,
    outputs,
    types,
  };
  return `${JSON.stringify(sortJsonKeys(manifest), null, 2)}\n`;
}

/** Recursively sort object keys so manifest serialization is canonical. */
function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
    );
    return Object.fromEntries(
      entries.map(([key, entryValue]) => [key, sortJsonKeys(entryValue)]),
    );
  }
  return value;
}

const GENERATED_README = `# Generated contracts — DO NOT EDIT

Every file below this directory is produced by the deterministic contract
generator (M01-W02) from the canonical hand-authored JSON Schema source in
\`packages/contracts/schemas/\`. The schemas are the single source of truth;
these trees are derived artifacts.

- Regenerate: \`pnpm generate:contracts\`
- Verify (byte-exact drift check, read-only): \`pnpm generate:contracts --check\`

Manual edits are prohibited. The \`contract-gen\` verification suite
regenerates into a temporary directory and byte-compares the complete
committed inventory; any hand edit, missing file, stale file, or extra file
fails \`pnpm verify\`.

Layout:

- \`MANIFEST.json\` — provenance: generator format/config, every input
  schema id/version/SHA-256, every validated data input (the canonical
  error, capability, command, authorization-policy, and finite semantic-rule
  catalogs) with its SHA-256, every output path/SHA-256, and the
  schema-reference → generated-type identity map.
- \`typescript/\` — one module per schema document (mirroring the schema
  layout), \`validators.ts\` (typed wrappers whose runtime truth is the
  strict canonical Ajv catalog in \`packages/contracts/src/\`),
  \`error/catalog-data.v1.ts\` (canonical error-catalog metadata),
  \`security/policy-data.v1.ts\` (immutable authorization catalogs,
  lookups, and fail-closed authorization),
  \`semantic/rules.v1.ts\` (finite reviewed semantic-rule evaluators), and
  \`index.ts\`
  (the stable export surface re-exported by \`@japp/contracts/generated\`).
- \`python/src/japp_contracts/\` — the generated strict Pydantic v2 package
  (one module per schema document plus \`_runtime.py\` and
  \`error/catalog_data_v1.py\`, \`security/policy_data_v1.py\`, and
  \`semantic/rules_v1.py\`);
  importable as \`japp_contracts\` through
  the repository mypy/pytest path configuration.

Determinism contract: output depends only on the committed schema catalog,
the committed canonical data catalogs/policy/rules, and the generator version —
no timestamps, absolute paths, usernames, hostnames, random values, or
platform separators. Two generations of the same inputs are byte-identical
on every certified platform.
`;

export interface GenerationResult {
  readonly tree: GeneratedTree;
  readonly catalog: SchemaCatalog;
  readonly ir: IrCatalog;
}

/**
 * Produce the complete generated tree for the catalog at `schemasRoot`
 * (default: the canonical packages/contracts/schemas). Throws on any
 * catalog-convention violation, strict-compilation failure, or unsupported
 * construct — nothing is emitted from an invalid input state.
 */
export function generateContracts(
  options: {
    readonly schemasRoot?: string;
    readonly catalogRoot?: string;
  } = {},
): GenerationResult {
  const schemasRoot = options.schemasRoot ?? DEFAULT_SCHEMAS_ROOT;
  const catalog = loadSchemaCatalog({ schemasRoot });
  // Input gate: the strict Ajv validator compiles every document eagerly;
  // meta-schema, keyword, format, and reference failures abort generation.
  const validator = createContractValidator(catalog);
  const ir = buildIrCatalog(catalog);

  // Second validated input: the canonical error catalog (fail-closed
  // schema validation plus integrity/invariant checks).
  const errorCatalog = loadErrorCatalog({
    ...(options.catalogRoot === undefined
      ? {}
      : { catalogRoot: options.catalogRoot }),
    catalog,
    validator,
  });
  const securityPolicy = loadSecurityPolicy({
    ...(options.catalogRoot === undefined
      ? {}
      : { catalogRoot: options.catalogRoot }),
    catalog,
    validator,
    errorCatalog,
  });
  const semanticRules = loadSemanticRules({
    catalogRoot: options.catalogRoot ?? DEFAULT_CATALOG_ROOT,
    catalog,
    validator,
    errorCatalog,
  });

  // Input provenance hashes cover the exact committed schema bytes
  // (LF-enforced by .gitattributes), not a reserialization.
  const schemaBytes = new Map<string, string>();
  for (const entry of catalog.entries) {
    schemaBytes.set(
      entry.relativePath,
      readFileSync(join(schemasRoot, ...entry.relativePath.split("/")), "utf8"),
    );
  }

  const files: GeneratedFile[] = [
    ...emitTypescript(ir, {
      dataModules: [
        "error/catalog-data.v1.ts",
        "security/policy-data.v1.ts",
        "semantic/rules.v1.ts",
      ],
    }),
    ...emitPython(ir, {
      dataModules: [
        {
          module: "japp_contracts.error.catalog_data_v1",
          exports: PYTHON_CATALOG_DATA_EXPORTS,
        },
        {
          module: "japp_contracts.security.policy_data_v1",
          exports: PYTHON_SECURITY_POLICY_EXPORTS,
        },
        {
          module: "japp_contracts.semantic.rules_v1",
          exports: PYTHON_SEMANTIC_RULE_EXPORTS,
        },
      ],
    }),
    emitTypescriptCatalogData(errorCatalog),
    emitPythonCatalogData(errorCatalog),
    emitTypescriptSecurityPolicy(securityPolicy),
    emitPythonSecurityPolicy(securityPolicy),
    emitTypescriptSemanticRules(semanticRules),
    emitPythonSemanticRules(semanticRules),
    { path: README_PATH, content: GENERATED_README },
  ];
  files.push({
    path: MANIFEST_PATH,
    content: buildManifest(
      catalog,
      ir,
      files,
      schemaBytes,
      errorCatalog,
      securityPolicy,
      semanticRules,
    ),
  });

  const map = new Map<string, string>();
  for (const file of [...files].sort((left, right) =>
    left.path < right.path ? -1 : 1,
  )) {
    assertSafeRelativePath(file.path);
    assertLfUtf8(file.path, file.content);
    if (map.has(file.path)) {
      throw new Error(`duplicate generated output path ${file.path}`);
    }
    map.set(file.path, file.content);
  }
  return { tree: { files: map }, catalog, ir };
}
