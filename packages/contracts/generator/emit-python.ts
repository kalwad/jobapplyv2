/**
 * Python / Pydantic v2 emitter for generated contracts (M01-W02).
 *
 * Emits an importable `japp_contracts` package with strict Pydantic v2
 * models mirroring the canonical schema semantics exactly:
 *
 * - closed objects use extra="forbid"; strict mode disables coercion;
 * - no defaults are injected; missing and explicit null stay distinct
 *   (optional non-nullable members reject explicit null before validation);
 * - decimal amounts and date/date-time values keep their string wire form;
 * - date and date-time calendar/time-range validity mirrors the Ajv
 *   full-mode assertions (including the 23:59:60Z leap-second case);
 * - enums are closed Literal token sets; extension values stay opaque.
 *
 * All untrusted schema text is embedded exclusively through escaped string
 * literals (never raw interpolation), so descriptions cannot inject source.
 */

import type {
  IrCatalog,
  IrDocument,
  IrMetadata,
  IrProperty,
  IrType,
} from "./ir.ts";
import type { GeneratedFile } from "./emit-typescript.ts";
import { pythonModuleName, pythonModulePath, typeName } from "./naming.ts";

/** Render text as a safe, fully-escaped Python double-quoted literal. */
export function pythonStringLiteral(text: string): string {
  let out = '"';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\") {
      out += "\\\\";
    } else if (char === '"') {
      out += '\\"';
    } else if (char === "\n") {
      out += "\\n";
    } else if (
      code < 0x20 ||
      (code >= 0x7f && code <= 0xa0) ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      // Control characters and the invisible Unicode line/paragraph
      // separators are emitted as escapes so generated source stays
      // ordinary reviewable text even for adversarial inputs.
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else {
      out += char;
    }
  }
  return out + '"';
}

const PYTHON_KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);
const PYTHON_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertFieldName(document: IrDocument, name: string): void {
  if (
    !PYTHON_IDENTIFIER.test(name) ||
    PYTHON_KEYWORDS.has(name) ||
    name.startsWith("model_") ||
    name.startsWith("_")
  ) {
    throw new Error(
      `cannot generate a Pydantic field for property ` +
        `${JSON.stringify(name)} of ${document.id}: the name is not a safe ` +
        "Python field identifier (aliasing is not implemented; extend the " +
        "generator deliberately)",
    );
  }
}

function generatedHeaderDoc(source: string, id: string): string {
  return [
    '"""GENERATED FILE - DO NOT EDIT BY HAND.',
    "",
    `Source of truth: ${source}`,
    `Schema id: ${id}`,
    "",
    "Regenerate: pnpm generate:contracts",
    "Verify:     pnpm generate:contracts --check",
    "Manual edits are prohibited and fail the contract-gen drift suite.",
    '"""',
  ].join("\n");
}

/** Deterministic Python number literal from a JSON number. */
function pythonNumber(value: number): string {
  return String(value);
}

interface PythonImports {
  readonly typing: Set<string>;
  readonly annotatedTypes: Set<string>;
  readonly pydantic: Set<string>;
  readonly runtime: Set<string>;
  /** module name -> imported symbols */
  readonly crossModule: Map<string, Set<string>>;
}

function newImports(): PythonImports {
  return {
    typing: new Set(),
    annotatedTypes: new Set(),
    pydantic: new Set(),
    runtime: new Set(),
    crossModule: new Map(),
  };
}

interface PyEmission {
  readonly document: IrDocument;
  readonly documentsById: ReadonlyMap<string, IrDocument>;
  readonly imports: PythonImports;
}

function referenceExpr(emission: PyEmission, type: IrType): string {
  if (type.kind !== "ref") {
    throw new Error("referenceExpr requires a ref node");
  }
  const target = emission.documentsById.get(type.targetId);
  if (target === undefined) {
    throw new Error(`unresolved reference target ${type.targetId}`);
  }
  const name = typeName(target, type.targetDef);
  if (target.id !== emission.document.id) {
    const module = pythonModuleName(target);
    const names = emission.imports.crossModule.get(module) ?? new Set<string>();
    names.add(name);
    emission.imports.crossModule.set(module, names);
  }
  return name;
}

function stringExpr(
  emission: PyEmission,
  type: Extract<IrType, { kind: "string" }>,
): string {
  const constraints: string[] = [];
  if (type.pattern !== null) {
    constraints.push(`pattern=${pythonStringLiteral(type.pattern)}`);
  }
  if (type.minLength !== null) {
    constraints.push(`min_length=${String(type.minLength)}`);
  }
  if (type.maxLength !== null) {
    constraints.push(`max_length=${String(type.maxLength)}`);
  }
  const metadata: string[] = [];
  if (constraints.length > 0) {
    emission.imports.pydantic.add("StringConstraints");
    metadata.push(`StringConstraints(${constraints.join(", ")})`);
  }
  if (type.format === "date") {
    emission.imports.pydantic.add("AfterValidator");
    emission.imports.runtime.add("validate_calendar_date");
    metadata.push("AfterValidator(validate_calendar_date)");
  }
  if (type.format === "date-time") {
    emission.imports.pydantic.add("AfterValidator");
    emission.imports.runtime.add("validate_utc_timestamp");
    metadata.push("AfterValidator(validate_utc_timestamp)");
  }
  if (metadata.length === 0) {
    return "str";
  }
  emission.imports.typing.add("Annotated");
  return `Annotated[str, ${metadata.join(", ")}]`;
}

function numberExpr(
  emission: PyEmission,
  type: Extract<IrType, { kind: "number" }>,
): string {
  const constraints: string[] = [];
  if (type.minimum !== null) {
    emission.imports.annotatedTypes.add("Ge");
    constraints.push(`Ge(${pythonNumber(type.minimum)})`);
  }
  if (type.maximum !== null) {
    emission.imports.annotatedTypes.add("Le");
    constraints.push(`Le(${pythonNumber(type.maximum)})`);
  }
  // JSON has one number type; Python JSON parsing yields int for whole
  // numbers and float otherwise, so both are accepted and preserved
  // exactly (strict mode still rejects bool, str, and everything else).
  // Constraints are distributed over both members explicitly.
  if (constraints.length === 0) {
    return "int | float";
  }
  emission.imports.typing.add("Annotated");
  const suffix = `, ${constraints.join(", ")}]`;
  return `Annotated[int${suffix} | Annotated[float${suffix}`;
}

function integerExpr(
  emission: PyEmission,
  type: Extract<IrType, { kind: "integer" }>,
): string {
  emission.imports.typing.add("Annotated");
  emission.imports.annotatedTypes.add("Ge");
  emission.imports.annotatedTypes.add("Le");
  return (
    `Annotated[int, Ge(${pythonNumber(type.minimum)}), ` +
    `Le(${pythonNumber(type.maximum)})]`
  );
}

function arrayExpr(
  emission: PyEmission,
  type: Extract<IrType, { kind: "array" }>,
): string {
  const itemExpr = typeExpr(emission, type.items);
  const listExpr = `list[${itemExpr}]`;
  const constraints: string[] = [];
  if (type.minItems !== null) {
    emission.imports.annotatedTypes.add("MinLen");
    constraints.push(`MinLen(${String(type.minItems)})`);
  }
  if (type.maxItems !== null) {
    emission.imports.annotatedTypes.add("MaxLen");
    constraints.push(`MaxLen(${String(type.maxItems)})`);
  }
  if (constraints.length === 0) {
    return listExpr;
  }
  emission.imports.typing.add("Annotated");
  return `Annotated[${listExpr}, ${constraints.join(", ")}]`;
}

function typeExpr(emission: PyEmission, type: IrType): string {
  switch (type.kind) {
    case "string":
      return stringExpr(emission, type);
    case "number":
      return numberExpr(emission, type);
    case "integer":
      return integerExpr(emission, type);
    case "boolean":
      return "bool";
    case "array":
      return arrayExpr(emission, type);
    case "enum": {
      emission.imports.typing.add("Literal");
      const tokens = type.tokens
        .map((token) => pythonStringLiteral(token))
        .join(", ");
      return `Literal[${tokens}]`;
    }
    case "any":
      emission.imports.runtime.add("JsonValue");
      return "JsonValue";
    case "ref":
      return referenceExpr(emission, type);
    case "nullable":
      return `${typeExpr(emission, type.inner)} | None`;
    case "object":
      if (type.extensionPoint) {
        return extensionExpr(emission, type);
      }
      throw new Error(
        "anonymous inline object schemas are not supported by the Python " +
          "emitter; declare the object as a named $defs entry",
      );
  }
}

function extensionExpr(
  emission: PyEmission,
  type: Extract<IrType, { kind: "object" }>,
): string {
  emission.imports.runtime.add("JsonValue");
  const keyExpr =
    type.propertyNames === null
      ? "str"
      : typeExpr(emission, type.propertyNames);
  const dictExpr = `dict[${keyExpr}, JsonValue]`;
  if (type.maxProperties === null) {
    return dictExpr;
  }
  emission.imports.typing.add("Annotated");
  emission.imports.annotatedTypes.add("MaxLen");
  return `Annotated[${dictExpr}, MaxLen(${String(type.maxProperties)})]`;
}

function fieldDescription(metadata: IrMetadata): string | null {
  const parts: string[] = [];
  if (metadata.deprecated) {
    parts.push(
      metadata.deprecatedSince === null
        ? "[deprecated]"
        : `[deprecated since schema version ${metadata.deprecatedSince}]`,
    );
  }
  if (metadata.description !== null) {
    parts.push(metadata.description);
  }
  if (metadata.sensitivity !== null) {
    parts.push(`Sensitivity (x-japp-sensitivity): ${metadata.sensitivity}.`);
  }
  if (metadata.redaction !== null) {
    parts.push(`Redaction (x-japp-redaction): ${metadata.redaction}.`);
  }
  return parts.length === 0 ? null : parts.join(" ");
}

interface RenderedField {
  readonly line: string;
  readonly optionalNonNullable: boolean;
}

function renderField(
  emission: PyEmission,
  property: IrProperty,
): RenderedField {
  assertFieldName(emission.document, property.name);
  const nullable = property.type.kind === "nullable";
  let expr = typeExpr(emission, property.type);
  const description = fieldDescription(property.type.metadata);
  if (description !== null) {
    emission.imports.typing.add("Annotated");
    emission.imports.pydantic.add("Field");
    const fieldMeta = `Field(description=${pythonStringLiteral(description)})`;
    expr = `Annotated[${expr}, ${fieldMeta}]`;
  }
  if (property.required) {
    return {
      line: `    ${property.name}: ${expr}`,
      optionalNonNullable: false,
    };
  }
  // Optional members default to None as the internal "absent" marker.
  // Non-nullable optionals additionally reject an EXPLICIT null before
  // validation, so missing and null remain distinct on the wire;
  // wire_dict() excludes unset members on the way out.
  return {
    line: `    ${property.name}: ${expr} | None = None`,
    optionalNonNullable: !nullable,
  };
}

function renderModel(
  emission: PyEmission,
  name: string,
  type: Extract<IrType, { kind: "object" }>,
  docText: string,
): string {
  emission.imports.runtime.add("ContractModel");
  const lines: string[] = [
    `class ${name}(ContractModel):`,
    `    ${pythonStringLiteral(docText)}`,
    "",
  ];
  const rejectNames: string[] = [];
  const fieldLines: string[] = [];
  for (const property of type.properties) {
    const rendered = renderField(emission, property);
    fieldLines.push(rendered.line);
    if (rendered.optionalNonNullable) {
      rejectNames.push(property.name);
    }
  }
  lines.push(...fieldLines);
  if (rejectNames.length > 0) {
    emission.imports.pydantic.add("model_validator");
    emission.imports.runtime.add("reject_explicit_null");
    lines.push(
      "",
      '    @model_validator(mode="before")',
      "    @classmethod",
      "    def _reject_explicit_null_for_absent_optionals(",
      "        cls, data: object",
      "    ) -> object:",
      "        return reject_explicit_null(",
      "            data,",
      `            (${rejectNames
        .map((fieldName) => pythonStringLiteral(fieldName))
        .join(", ")},),`,
      "        )",
    );
  }
  return lines.join("\n");
}

function documentDocText(document: IrDocument, metadata: IrMetadata): string {
  const description = metadata.description ?? document.description;
  return description;
}

function emitDocumentModule(
  document: IrDocument,
  documentsById: ReadonlyMap<string, IrDocument>,
): GeneratedFile {
  const emission: PyEmission = {
    document,
    documentsById,
    imports: newImports(),
  };
  const declarations: string[] = [];
  const targets: { name: string; type: IrType }[] = [];
  for (const definition of document.definitions) {
    targets.push({
      name: typeName(document, definition.name),
      type: definition.type,
    });
  }
  if (document.root !== null) {
    targets.push({ name: typeName(document, null), type: document.root });
  }
  for (const target of targets) {
    if (target.type.kind === "object" && !target.type.extensionPoint) {
      declarations.push(
        renderModel(
          emission,
          target.name,
          target.type,
          documentDocText(document, target.type.metadata),
        ),
      );
    } else {
      const expr = typeExpr(emission, target.type);
      const doc = fieldDescription(target.type.metadata);
      // A string literal directly after the assignment is the attribute
      // docstring convention; the escaped literal keeps untrusted text
      // inert.
      declarations.push(
        [
          `${target.name} = ${expr}`,
          ...(doc === null ? [] : [pythonStringLiteral(doc)]),
        ].join("\n"),
      );
    }
  }

  const importLines: string[] = [];
  if (emission.imports.typing.size > 0) {
    importLines.push(
      `from typing import ${[...emission.imports.typing].sort().join(", ")}`,
    );
  }
  const thirdParty: string[] = [];
  if (emission.imports.annotatedTypes.size > 0) {
    thirdParty.push(
      `from annotated_types import ${[...emission.imports.annotatedTypes]
        .sort()
        .join(", ")}`,
    );
  }
  if (emission.imports.pydantic.size > 0) {
    thirdParty.push(
      `from pydantic import ${[...emission.imports.pydantic].sort().join(", ")}`,
    );
  }
  const firstParty: string[] = [];
  if (emission.imports.runtime.size > 0) {
    firstParty.push(
      `from japp_contracts._runtime import ${[...emission.imports.runtime]
        .sort()
        .join(", ")}`,
    );
  }
  for (const module of [...emission.imports.crossModule.keys()].sort()) {
    const names = [...(emission.imports.crossModule.get(module) ?? [])].sort();
    firstParty.push(`from ${module} import ${names.join(", ")}`);
  }
  const importBlocks = [importLines, thirdParty, firstParty]
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"));

  const content =
    [
      generatedHeaderDoc(
        `packages/contracts/schemas/${document.relativePath}`,
        document.id,
      ),
      ...importBlocks,
      ...declarations,
    ].join("\n\n") + "\n";
  return { path: `python/src/${pythonModulePath(document)}`, content };
}

const RUNTIME_MODULE = `"""GENERATED FILE - DO NOT EDIT BY HAND.

Shared runtime for the generated strict Pydantic v2 contract models.

Source of truth: packages/contracts/schemas/ (complete catalog)
Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

import datetime
from typing import cast

from pydantic import BaseModel, ConfigDict

type JsonValue = (
    bool | int | float | str | None | list[JsonValue] | dict[str, JsonValue]
)
"""One JSON value: opaque, untrusted data preserved exactly as parsed."""


class ContractModel(BaseModel):
    """Base for every generated contract model.

    Strict semantics mirror the canonical Ajv catalog: unknown members are
    rejected (extra="forbid"), no type coercion happens (strict=True), no
    defaults are injected into wire data, and validation never mutates or
    removes members.
    """

    model_config = ConfigDict(extra="forbid", strict=True)

    def wire_dict(self) -> dict[str, JsonValue]:
        """Canonical wire representation of this record.

        Members that were absent on input (never set) stay absent on
        output; explicitly provided members - including deliberate nulls on
        required nullable members - are preserved exactly.
        """
        return cast(
            "dict[str, JsonValue]",
            self.model_dump(mode="json", exclude_unset=True, warnings="error"),
        )


def reject_explicit_null(data: object, fields: tuple[str, ...]) -> object:
    """Reject explicit nulls on optional non-nullable members.

    Missing and null are distinct: an optional non-nullable member is
    omitted when unknown, and null is a validation error (the known-none
    case exists only on required nullable members).
    """
    if isinstance(data, dict):
        for name in fields:
            if name in data and data[name] is None:
                msg = (
                    f"{name} is optional and non-nullable: omit the member "
                    "instead of sending null"
                )
                raise ValueError(msg)
    return data


def _validate_date_parts(value: str, year: int, month: int, day: int) -> None:
    # Year 0000 is valid in RFC 3339 (proleptic Gregorian) but below
    # datetime.MINYEAR; year 2000 shares its leap-year behavior (both are
    # divisible by 400), so it substitutes for calendar validation only.
    probe_year = 2000 if year == 0 else year
    try:
        datetime.date(probe_year, month, day)
    except ValueError as exc:
        msg = f"invalid calendar date: {value}"
        raise ValueError(msg) from exc


def validate_calendar_date(value: str) -> str:
    """Mirror the Ajv full-mode "date" assertion (calendar validity)."""
    _validate_date_parts(value, int(value[0:4]), int(value[5:7]), int(value[8:10]))
    return value


def validate_utc_timestamp(value: str) -> str:
    """Mirror the Ajv full-mode "date-time" assertion.

    The sibling pattern already fixed the rendering (uppercase T and Z,
    two-digit fields, optional 1-9 fractional digits); this validator adds
    calendar validity and the time ranges Ajv enforces: hour <= 23,
    minute <= 59, and second <= 59 except the 23:59:60 leap-second slot.
    """
    _validate_date_parts(value, int(value[0:4]), int(value[5:7]), int(value[8:10]))
    hour, minute, second = int(value[11:13]), int(value[14:16]), int(value[17:19])
    valid_time = (
        hour <= 23
        and minute <= 59
        and (second <= 59 or (second == 60 and hour == 23 and minute == 59))
    )
    if not valid_time:
        msg = f"invalid UTC time of day: {value}"
        raise ValueError(msg)
    return value
`;

/** Additional generated runtime modules exported from the package root. */
export interface PythonEmitOptions {
  readonly dataModules?: readonly {
    /** Dotted module name, e.g. "japp_contracts.error.catalog_data_v1". */
    readonly module: string;
    readonly exports: readonly string[];
  }[];
}

function emitInitModules(
  catalog: IrCatalog,
  options: PythonEmitOptions,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const exportsByModule = new Map<string, string[]>();
  const packages = new Set<string>();
  for (const document of catalog.documents) {
    const module = pythonModuleName(document);
    const names: string[] = document.definitions.map((definition) =>
      typeName(document, definition.name),
    );
    if (document.root !== null) {
      names.push(typeName(document, null));
    }
    exportsByModule.set(module, names.sort());
    const parts = pythonModulePath(document).split("/");
    for (let index = 1; index < parts.length - 1; index += 1) {
      packages.add(parts.slice(0, index + 1).join("/"));
    }
  }
  for (const dataModule of options.dataModules ?? []) {
    exportsByModule.set(dataModule.module, [...dataModule.exports].sort());
  }

  const importLines: string[] = [];
  const allNames: string[] = [];
  importLines.push(
    "from japp_contracts._runtime import (",
    "    ContractModel,",
    "    JsonValue,",
    "    reject_explicit_null,",
    "    validate_calendar_date,",
    "    validate_utc_timestamp,",
    ")",
  );
  allNames.push(
    "ContractModel",
    "JsonValue",
    "reject_explicit_null",
    "validate_calendar_date",
    "validate_utc_timestamp",
  );
  for (const module of [...exportsByModule.keys()].sort()) {
    const names = exportsByModule.get(module) ?? [];
    if (names.length === 0) {
      continue;
    }
    importLines.push(
      `from ${module} import (`,
      ...names.map((name) => `    ${name},`),
      ")",
    );
    allNames.push(...names);
  }
  const all = [...allNames].sort();
  const topInit =
    [
      generatedHeaderDoc(
        "packages/contracts/schemas/ (complete catalog)",
        "generated Python export surface",
      ),
      importLines.join("\n"),
      `__all__ = [\n${all
        .map((name) => `    ${pythonStringLiteral(name)},`)
        .join("\n")}\n]`,
    ].join("\n\n") + "\n";
  files.push({
    path: "python/src/japp_contracts/__init__.py",
    content: topInit,
  });

  for (const packagePath of [...packages].sort()) {
    files.push({
      path: `python/src/${packagePath}/__init__.py`,
      content:
        generatedHeaderDoc(
          "packages/contracts/schemas/ (complete catalog)",
          `generated Python subpackage ${packagePath.split("/").slice(1).join(".")}`,
        ) + "\n",
    });
  }
  files.push({
    path: "python/src/japp_contracts/py.typed",
    content: "",
  });
  return files;
}

/** Emit every Python artifact for the catalog, sorted by path. */
export function emitPython(
  catalog: IrCatalog,
  options: PythonEmitOptions = {},
): GeneratedFile[] {
  const documentsById = new Map<string, IrDocument>(
    catalog.documents.map((document) => [document.id, document]),
  );
  const files: GeneratedFile[] = catalog.documents.map((document) =>
    emitDocumentModule(document, documentsById),
  );
  files.push({
    path: "python/src/japp_contracts/_runtime.py",
    content: RUNTIME_MODULE,
  });
  files.push(...emitInitModules(catalog, options));
  files.sort((left, right) => (left.path < right.path ? -1 : 1));
  return files;
}
