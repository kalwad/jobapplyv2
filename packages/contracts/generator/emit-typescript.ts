/**
 * TypeScript emitter for generated contracts (M01-W02).
 *
 * Emits one module per catalog document (mirroring the schema layout), a
 * typed validator module whose runtime truth is the strict M01-W01 Ajv
 * catalog, and a stable index. Output is deterministic: documents arrive in
 * sorted `$id` order, imports and exports are sorted explicitly, all text is
 * LF-terminated UTF-8, and nothing environment-specific is ever embedded.
 *
 * Untrusted text (titles/descriptions from schema documents) only ever
 * lands inside block comments and is sanitized so it cannot terminate the
 * comment or smuggle source code into the module scope.
 */

import type { IrCatalog, IrDocument, IrMetadata, IrType } from "./ir.ts";
import { schemaRef, typeName, typescriptModulePath } from "./naming.ts";

export interface GeneratedFile {
  /** POSIX path relative to the generated root. */
  readonly path: string;
  readonly content: string;
}

/** Sanitize untrusted schema text for safe embedding inside a comment. */
export function sanitizeCommentText(text: string): string {
  let withoutControl = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const isControl =
      (code < 0x20 && char !== "\n") ||
      (code >= 0x7f && code <= 0x9f) ||
      code === 0x2028 ||
      code === 0x2029;
    withoutControl += isControl ? "�" : char;
  }
  return withoutControl.replaceAll("*/", "*\\/");
}

function generatedHeader(source: string, id: string): string {
  return [
    "/**",
    " * GENERATED FILE — DO NOT EDIT BY HAND.",
    " *",
    ` * Source of truth: ${source}`,
    ` * Schema id: ${id}`,
    " *",
    " * Regenerate: pnpm generate:contracts",
    " * Verify:     pnpm generate:contracts --check",
    " * Manual edits are prohibited and fail the contract-gen drift suite.",
    " */",
  ].join("\n");
}

function docLines(metadata: IrMetadata, constraints: string[]): string[] {
  const lines: string[] = [];
  if (metadata.title !== null) {
    lines.push(sanitizeCommentText(metadata.title));
  }
  if (metadata.description !== null) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(...sanitizeCommentText(metadata.description).split("\n"));
  }
  if (constraints.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(...constraints.map(sanitizeCommentText));
  }
  if (metadata.sensitivity !== null) {
    lines.push(`Sensitivity (x-japp-sensitivity): ${metadata.sensitivity}`);
  }
  if (metadata.redaction !== null) {
    lines.push(`Redaction (x-japp-redaction): ${metadata.redaction}`);
  }
  if (metadata.deprecated) {
    lines.push(
      metadata.deprecatedSince === null
        ? "@deprecated"
        : `@deprecated since schema version ${sanitizeCommentText(metadata.deprecatedSince)}`,
    );
  }
  return lines;
}

function renderDoc(lines: string[], indent: string): string {
  if (lines.length === 0) {
    return "";
  }
  return [
    `${indent}/**`,
    ...lines.map((line) => `${indent} *${line === "" ? "" : ` ${line}`}`),
    `${indent} */`,
    "",
  ].join("\n");
}

function constraintNotes(type: IrType): string[] {
  const notes: string[] = [];
  if (type.kind === "string") {
    if (type.format !== null) {
      notes.push(`Format: ${type.format} (calendar-valid, full assertion).`);
    }
    if (type.pattern !== null) {
      notes.push(`Pattern: ${type.pattern}`);
    }
    if (type.minLength !== null) {
      notes.push(`Minimum length: ${String(type.minLength)}.`);
    }
    if (type.maxLength !== null) {
      notes.push(`Maximum length: ${String(type.maxLength)}.`);
    }
  }
  if (type.kind === "number" || type.kind === "integer") {
    if (type.kind === "integer") {
      notes.push("Integer; runtime validation rejects fractions and coercion.");
    }
    if (type.minimum !== null) {
      notes.push(`Minimum: ${String(type.minimum)}.`);
    }
    if (type.maximum !== null) {
      notes.push(`Maximum: ${String(type.maximum)}.`);
    }
  }
  if (type.kind === "array") {
    if (type.minItems !== null) {
      notes.push(`Minimum items: ${String(type.minItems)}.`);
    }
    if (type.maxItems !== null) {
      notes.push(`Maximum items: ${String(type.maxItems)}.`);
    }
  }
  if (type.kind === "enum") {
    notes.push("Closed token set; undeclared tokens are rejected.");
  }
  if (type.kind === "object" && type.extensionPoint) {
    notes.push(
      "Explicit extension surface: keys are namespaced x-… tokens and " +
        "values are opaque untrusted data" +
        (type.maxProperties === null
          ? "."
          : ` (at most ${String(type.maxProperties)} members).`),
    );
  }
  if (type.kind === "any") {
    notes.push(
      "Deliberately opaque value; validated in a second phase by the " +
        "envelope acceptance policy.",
    );
  }
  return notes;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function propertyKey(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

interface ModuleEmission {
  /** Type names imported from sibling generated modules, by module path. */
  readonly imports: Map<string, Set<string>>;
  readonly document: IrDocument;
  readonly documentsById: ReadonlyMap<string, IrDocument>;
}

function referenceType(emission: ModuleEmission, type: IrType): string {
  if (type.kind !== "ref") {
    throw new Error("referenceType requires a ref node");
  }
  const target = emission.documentsById.get(type.targetId);
  if (target === undefined) {
    throw new Error(`unresolved reference target ${type.targetId}`);
  }
  const name = typeName(target, type.targetDef);
  if (target.id !== emission.document.id) {
    const fromPath = typescriptModulePath(emission.document);
    const toPath = typescriptModulePath(target);
    const fromDirectories = fromPath.split("/").slice(0, -1);
    const toSegments = toPath.split("/");
    const ups = fromDirectories.map(() => "..");
    const relative = [...(ups.length > 0 ? ups : ["."]), ...toSegments].join(
      "/",
    );
    const existing = emission.imports.get(relative) ?? new Set<string>();
    existing.add(name);
    emission.imports.set(relative, existing);
  }
  return name;
}

function renderType(
  emission: ModuleEmission,
  type: IrType,
  indent: string,
): string {
  switch (type.kind) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "enum":
      return type.tokens.map((token) => JSON.stringify(token)).join(" | ");
    case "any":
      return "unknown";
    case "ref":
      return referenceType(emission, type);
    case "array":
      return `readonly ${renderArrayItem(emission, type.items, indent)}[]`;
    case "nullable":
      return `${renderType(emission, type.inner, indent)} | null`;
    case "object":
      return renderObjectType(emission, type, indent);
  }
}

/** Array item expression, parenthesized when the item type is a union. */
function renderArrayItem(
  emission: ModuleEmission,
  item: IrType,
  indent: string,
): string {
  const rendered = renderType(emission, item, indent);
  return rendered.includes("|") ? `(${rendered})` : rendered;
}

function renderObjectType(
  emission: ModuleEmission,
  type: Extract<IrType, { kind: "object" }>,
  indent: string,
): string {
  const inner = `${indent}  `;
  if (type.extensionPoint) {
    // The propertyNames grammar (x- followed by kebab-case) is enforced at
    // runtime by the Ajv catalog; the template-literal key is the closest
    // honest static approximation. Values stay unknown, never any.
    return [
      "{",
      `${inner}readonly [key: \`x-\${string}\`]: unknown;`,
      `${indent}}`,
    ].join("\n");
  }
  const lines: string[] = ["{"];
  for (const property of type.properties) {
    const doc = renderDoc(
      docLines(property.type.metadata, constraintNotes(property.type)),
      inner,
    );
    if (doc !== "") {
      lines.push(doc.trimEnd());
    }
    const optionalMark = property.required ? "" : "?";
    lines.push(
      `${inner}readonly ${propertyKey(property.name)}${optionalMark}: ` +
        `${renderType(emission, property.type, inner)};`,
    );
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function emitDeclaration(
  emission: ModuleEmission,
  name: string,
  type: IrType,
): string {
  const doc = renderDoc(docLines(type.metadata, constraintNotes(type)), "");
  if (type.kind === "object") {
    const body = renderObjectType(emission, type, "");
    if (type.extensionPoint) {
      return `${doc}export type ${name} = ${body};\n`;
    }
    const bodyLines = body.split("\n");
    return `${doc}export interface ${name} ${bodyLines.join("\n")}\n`;
  }
  return `${doc}export type ${name} = ${renderType(emission, type, "")};\n`;
}

function emitDocumentModule(
  document: IrDocument,
  documentsById: ReadonlyMap<string, IrDocument>,
): GeneratedFile {
  const emission: ModuleEmission = {
    imports: new Map(),
    document,
    documentsById,
  };
  const declarations: string[] = [];
  for (const definition of document.definitions) {
    declarations.push(
      emitDeclaration(
        emission,
        typeName(document, definition.name),
        definition.type,
      ),
    );
  }
  if (document.root !== null) {
    declarations.push(
      emitDeclaration(emission, typeName(document, null), document.root),
    );
  }
  const importLines = [...emission.imports.keys()].sort().map((modulePath) => {
    const names = [...(emission.imports.get(modulePath) ?? [])].sort();
    return `import type { ${names.join(", ")} } from "${modulePath}";`;
  });
  const parts = [
    generatedHeader(
      `packages/contracts/schemas/${document.relativePath}`,
      document.id,
    ),
    ...(importLines.length > 0 ? [importLines.join("\n")] : []),
    ...declarations.map((declaration) => declaration.trimEnd()),
  ];
  return {
    path: `typescript/${typescriptModulePath(document)}`,
    content: parts.join("\n\n") + "\n",
  };
}

interface WrapperTarget {
  readonly document: IrDocument;
  readonly def: string | null;
}

function wrapperTargets(catalog: IrCatalog): WrapperTarget[] {
  const targets: WrapperTarget[] = [];
  for (const document of catalog.documents) {
    for (const definition of document.definitions) {
      targets.push({ document, def: definition.name });
    }
    if (document.root !== null) {
      targets.push({ document, def: null });
    }
  }
  return targets;
}

function emitValidatorsModule(catalog: IrCatalog): GeneratedFile {
  const targets = wrapperTargets(catalog);
  const importsByModule = new Map<string, Set<string>>();
  for (const target of targets) {
    const modulePath = `./${typescriptModulePath(target.document)}`;
    const names = importsByModule.get(modulePath) ?? new Set<string>();
    names.add(typeName(target.document, target.def));
    importsByModule.set(modulePath, names);
  }
  const importLines = [...importsByModule.keys()].sort().map((modulePath) => {
    const names = [...(importsByModule.get(modulePath) ?? [])].sort();
    return `import type {\n${names.map((name) => `  ${name},`).join("\n")}\n} from "${modulePath}";`;
  });

  const mapEntries = targets
    .map((target) => ({
      ref: schemaRef(target.document, target.def),
      type: typeName(target.document, target.def),
    }))
    .sort((left, right) => (left.ref < right.ref ? -1 : 1));

  const wrapperFunctions = mapEntries
    .map((entry) =>
      [
        "/**",
        ` * Validate unknown input against ${sanitizeCommentText(entry.ref)}`,
        " * through the strict canonical Ajv catalog, narrowing to the",
        ` * generated ${entry.type} type only after validation succeeds.`,
        " */",
        `export function validate${entry.type}(`,
        "  data: unknown,",
        `): ContractValidationOutcome<${entry.type}> {`,
        `  return validateContractInstance(${JSON.stringify(entry.ref)}, data);`,
        "}",
      ].join("\n"),
    )
    .join("\n\n");

  const content = `${generatedHeader(
    "packages/contracts/schemas/ (complete catalog)",
    "typed validation wrappers",
  )}

import {
  createContractValidator,
  loadSchemaCatalog,
  type ContractValidator,
  type SchemaCatalog,
} from "../../src/index.ts";
${importLines.join("\n")}

/**
 * Typed validation outcome. Failures preserve the structured error list
 * produced by the canonical validator (instance path plus message); nothing
 * is coerced, defaulted, or removed on either path.
 */
export type ContractValidationOutcome<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly errors: readonly string[] };

/**
 * Generated mapping from catalog schema reference to generated type
 * identity. Only meaningful references appear: every $defs entry plus the
 * root payload schema of documents that declare one. A definitions-only
 * document id is deliberately absent — its bare id compiles to an
 * unconstrained schema and validating against it would be meaningless.
 */
export interface GeneratedTypeByRef {
${mapEntries
  .map((entry) => `  readonly ${JSON.stringify(entry.ref)}: ${entry.type};`)
  .join("\n")}
}

/** Every generated catalog reference, sorted. */
export const CONTRACT_SCHEMA_REFS: readonly (keyof GeneratedTypeByRef)[] = [
${mapEntries.map((entry) => `  ${JSON.stringify(entry.ref)},`).join("\n")}
];

let runtimeSingleton: {
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
} | null = null;

/**
 * Lazily construct the canonical strict validator (M01-W01 catalog loader
 * plus Ajv 2020 in strict offline mode). The generated layer never
 * re-implements or weakens validation rules — runtime truth stays in the
 * hand-authored canonical layer.
 */
export function contractRuntime(): {
  readonly catalog: SchemaCatalog;
  readonly validator: ContractValidator;
} {
  if (runtimeSingleton === null) {
    const catalog = loadSchemaCatalog();
    runtimeSingleton = {
      catalog,
      validator: createContractValidator(catalog),
    };
  }
  return runtimeSingleton;
}

/**
 * Validate unknown input against a known catalog reference. Unknown
 * references are unrepresentable in the type system and throw at runtime
 * inside the canonical validator (fail closed, never guess).
 */
export function validateContractInstance<R extends keyof GeneratedTypeByRef>(
  ref: R,
  data: unknown,
): ContractValidationOutcome<GeneratedTypeByRef[R]> {
  const result = contractRuntime().validator.validateInstance(ref, data);
  if (result.valid) {
    return { valid: true, value: data as GeneratedTypeByRef[R] };
  }
  return { valid: false, errors: result.errors };
}

${wrapperFunctions}
`;
  return { path: "typescript/validators.ts", content };
}

/** Additional generated runtime modules re-exported from the index. */
export interface TypescriptEmitOptions {
  /** Paths relative to the typescript root, e.g. "error/catalog-data.v1.ts". */
  readonly dataModules?: readonly string[];
}

function emitIndexModule(
  catalog: IrCatalog,
  options: TypescriptEmitOptions,
): GeneratedFile {
  const exportLines = catalog.documents
    .map(
      (document) => `export type * from "./${typescriptModulePath(document)}";`,
    )
    .sort();
  const dataExportLines = [...(options.dataModules ?? [])]
    .sort()
    .map((modulePath) => `export * from "./${modulePath}";`);
  const content = `${generatedHeader(
    "packages/contracts/schemas/ (complete catalog)",
    "generated TypeScript export surface",
  )}

${exportLines.join("\n")}
export * from "./validators.ts";
${dataExportLines.join("\n")}${dataExportLines.length > 0 ? "\n" : ""}`;
  return { path: "typescript/index.ts", content };
}

/** Emit every TypeScript artifact for the catalog, sorted by path. */
export function emitTypescript(
  catalog: IrCatalog,
  options: TypescriptEmitOptions = {},
): GeneratedFile[] {
  const documentsById = new Map<string, IrDocument>(
    catalog.documents.map((document) => [document.id, document]),
  );
  const files = catalog.documents.map((document) =>
    emitDocumentModule(document, documentsById),
  );
  files.push(emitValidatorsModule(catalog));
  files.push(emitIndexModule(catalog, options));
  files.sort((left, right) => (left.path < right.path ? -1 : 1));
  return files;
}
