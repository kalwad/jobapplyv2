import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  type Dirent,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { safeUntrustedDiagnosticPath } from "./diagnostics.ts";
import { parseStrictJson } from "./strict-json.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PLATFORM_SCHEMA_ROOT = fileURLToPath(
  new URL("../../contracts/schemas/platform/", import.meta.url),
);
const FIXTURE_MODEL_SOURCE = fileURLToPath(
  new URL("./model.ts", import.meta.url),
);
const FIXTURE_LOADER_SOURCE = fileURLToPath(
  new URL("./loader.ts", import.meta.url),
);
const DEPRECATED_V1_REFERENCE =
  /\burn:japp:schema:platform:[a-z][a-z0-9-]*:v1\b/giu;
const PLATFORM_SCHEMA_PREFIX = "urn:japp:schema:platform:";
const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const MAX_STATIC_STRING_LENGTH = 4096;
const MAX_STATIC_DEPTH = 16;
const MAX_STATIC_NODES = 256;

const EXPECTED_DEPRECATED_ROOTS = [
  "browser-record",
  "capability-report",
  "certification-input",
  "diagnostic-report",
  "evidence-record",
  "installer-state",
  "model-runtime-profile",
  "native-messaging-registration",
  "native-messaging-result",
  "path-resolution",
  "process-plan",
  "process-status",
  "runtime-capability",
  "secret-store-result",
  "update-state",
] as const;

const EXPECTED_FIXTURE_SCHEMA_REF_MEMBERS = new Set([
  "EVIDENCE_ARTIFACT",
  "EXPECTED_REQUIREMENT",
  "EXPECTED_SUPPORTED_CLAIM",
  "FIELD_VALUE_POLICY",
  "MANIFEST",
  "SCENARIO_BUNDLE",
  "SOURCE_RESUME",
  "SYNTHETIC_JOB",
  "SYNTHETIC_PROFILE",
  "UNSUPPORTED_GAP",
]);

export interface PlatformVersionIssue {
  readonly code: string;
  readonly file: string;
  readonly field: string;
  readonly detail: string;
}

export interface PlatformVersionReport {
  readonly valid: boolean;
  readonly deprecatedRoots: readonly string[];
  readonly filesScanned: number;
  readonly issues: readonly PlatformVersionIssue[];
}

export class PlatformVersionGuardError extends Error {
  public readonly issues: readonly PlatformVersionIssue[];

  public constructor(issues: readonly PlatformVersionIssue[]) {
    super(
      `platform version guard failed with ${String(issues.length)} issue(s): ${issues
        .slice(0, 8)
        .map((issue) => `${issue.code} ${issue.file}${issue.field}`)
        .join(", ")}`,
    );
    this.name = "PlatformVersionGuardError";
    this.issues = issues;
  }
}

function safePath(root: string, path: string): string {
  const value = relative(root, path).split(sep).join("/") || basename(path);
  return safeUntrustedDiagnosticPath(value) || ".";
}

function pointerAt(collection: string, index: number): string {
  return `${collection}/${String(index)}`;
}

function discoverDeprecatedRoots(): string[] {
  const rootStats = lstatSync(PLATFORM_SCHEMA_ROOT);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new PlatformVersionGuardError([
      {
        code: "PLATFORM_SCHEMA_ROOT",
        file: "packages/contracts/schemas/platform",
        field: "/",
        detail: "platform schema root is not a regular directory",
      },
    ]);
  }
  const roots: string[] = [];
  for (const entry of readdirSync(PLATFORM_SCHEMA_ROOT, {
    withFileTypes: true,
  })) {
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      !entry.name.endsWith(".v1.schema.json")
    ) {
      continue;
    }
    const path = join(PLATFORM_SCHEMA_ROOT, entry.name);
    const document = parseStrictJson(readFileSync(path, "utf8"));
    if (
      typeof document !== "object" ||
      document === null ||
      Array.isArray(document)
    ) {
      continue;
    }
    const object = document as Record<string, unknown>;
    if (object["x-japp-deprecated-since"] === undefined) {
      continue;
    }
    const root = entry.name.slice(0, -".v1.schema.json".length);
    const expectedId = `urn:japp:schema:platform:${root}:v1`;
    const v2Path = join(PLATFORM_SCHEMA_ROOT, `${root}.v2.schema.json`);
    const v2Stats = lstatSync(v2Path);
    if (
      object.$id !== expectedId ||
      v2Stats.isSymbolicLink() ||
      !v2Stats.isFile()
    ) {
      throw new PlatformVersionGuardError([
        {
          code: "PLATFORM_DEPRECATION_PAIR",
          file: `packages/contracts/schemas/platform/${entry.name}`,
          field: "/",
          detail: "deprecated v1 root lacks its exact corrected v2 sibling",
        },
      ]);
    }
    roots.push(expectedId);
  }
  roots.sort();
  const expected = EXPECTED_DEPRECATED_ROOTS.map(
    (root) => `urn:japp:schema:platform:${root}:v1`,
  ).sort();
  if (roots.join("\n") !== expected.join("\n")) {
    throw new PlatformVersionGuardError([
      {
        code: "PLATFORM_DEPRECATED_SET_DRIFT",
        file: "packages/contracts/schemas/platform",
        field: "/",
        detail:
          "deprecated v1/v2 sibling inventory differs from the reviewed set of fifteen",
      },
    ]);
  }
  return roots;
}

function walkFiles(
  root: string,
  current: string,
  issues: PlatformVersionIssue[],
  excludedTopLevel: ReadonlySet<string>,
): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    issues.push({
      code: "PLATFORM_SCAN_IO",
      file: safePath(root, current),
      field: "/",
      detail: "directory cannot be read",
    });
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (current === root && excludedTopLevel.has(entry.name)) {
      continue;
    }
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      issues.push({
        code: "PLATFORM_SCAN_SYMLINK",
        file: safePath(root, path),
        field: "/",
        detail: "symbolic links are forbidden",
      });
    } else if (entry.isDirectory()) {
      files.push(...walkFiles(root, path, issues, excludedTopLevel));
    } else if (entry.isFile()) {
      if ([".json", ".md", ".ts"].includes(extname(entry.name))) {
        files.push(path);
      } else {
        issues.push({
          code: "PLATFORM_SCAN_EXTENSION",
          file: safePath(root, path),
          field: "/",
          detail:
            "unrecognized regular files are forbidden on the scanned surface",
        });
      }
    }
  }
  return files;
}

function decodeBoundedRepresentation(value: string): string {
  if (value.length > MAX_STATIC_STRING_LENGTH) {
    return value;
  }
  let current = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.replace(
      /\\x([0-9a-f]{2})|\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|%([0-9a-f]{2})/giu,
      (
        match: string,
        hexByte: string | undefined,
        bracedCodePoint: string | undefined,
        fixedCodePoint: string | undefined,
        percentByte: string | undefined,
      ) => {
        const encoded =
          hexByte ?? bracedCodePoint ?? fixedCodePoint ?? percentByte;
        if (typeof encoded !== "string") {
          return match;
        }
        const codePoint = Number.parseInt(encoded, 16);
        return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      },
    );
    if (next === current || next.length > MAX_STATIC_STRING_LENGTH) {
      return current;
    }
    current = next;
  }
  return current;
}

function collapseQuotedConcatenations(value: string): string | undefined {
  if (value.length > MAX_STATIC_STRING_LENGTH) {
    return undefined;
  }
  let current = value;
  let changed = false;
  for (let pass = 0; pass < 32; pass += 1) {
    const next = current.replace(/(["'`])\s*\+\s*(["'`])/gu, "");
    if (next === current) {
      break;
    }
    changed = true;
    current = next;
  }
  return changed ? current : undefined;
}

function collapsePlatformLineBreaks(value: string): string | undefined {
  if (value.length > MAX_STATIC_STRING_LENGTH) {
    return undefined;
  }
  const collapsed = value.replace(
    /(urn:japp:schema:platform:[a-z][a-z0-9-]*:)[ \t\r]*\n[ \t]*(v[0-9]+)\b/giu,
    "$1$2",
  );
  return collapsed === value ? undefined : collapsed;
}

function boundedRepresentations(value: string): readonly string[] {
  const representations = new Set<string>([value]);
  if (value.length > MAX_STATIC_STRING_LENGTH) {
    return [...representations];
  }
  const decoded = decodeBoundedRepresentation(value);
  representations.add(decoded);
  for (const candidate of [...representations]) {
    const collapsed = collapseQuotedConcatenations(candidate);
    if (collapsed !== undefined) {
      representations.add(collapsed);
      representations.add(decodeBoundedRepresentation(collapsed));
    }
    const lineCollapsed = collapsePlatformLineBreaks(candidate);
    if (lineCollapsed !== undefined) {
      representations.add(lineCollapsed);
      representations.add(decodeBoundedRepresentation(lineCollapsed));
    }
  }
  return [...representations];
}

function boundedScalarCandidates(value: unknown): readonly (string | number)[] {
  if (typeof value === "string" || typeof value === "number") {
    return [value];
  }
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_STATIC_NODES ||
    !value.every(
      (item): item is string | number =>
        typeof item === "string" || typeof item === "number",
    )
  ) {
    return [];
  }
  const parts = value.map(String);
  if (
    parts.reduce((length, part) => length + part.length, 0) >
    MAX_STATIC_STRING_LENGTH
  ) {
    return [];
  }
  return [...new Set(["", ":", "-"].map((separator) => parts.join(separator)))];
}

function normalizedPlatformAliases(value: unknown): readonly string[] {
  const aliases = new Set<string>();
  for (const scalar of boundedScalarCandidates(value)) {
    if (typeof scalar !== "string") {
      continue;
    }
    for (const representation of boundedRepresentations(scalar)) {
      let candidate = representation.trim();
      if (candidate.startsWith(PLATFORM_SCHEMA_PREFIX)) {
        candidate = candidate.slice(PLATFORM_SCHEMA_PREFIX.length);
      } else if (candidate.startsWith("platform:")) {
        candidate = candidate.slice("platform:".length);
      }
      if (candidate.endsWith(":")) {
        candidate = candidate.slice(0, -1);
      }
      if (/^[a-z][a-z0-9-]*$/u.test(candidate)) {
        aliases.add(candidate);
      }
    }
  }
  return [...aliases];
}

function isV1Major(value: unknown): boolean {
  return boundedScalarCandidates(value).some((scalar) => {
    if (scalar === 1) {
      return true;
    }
    return (
      typeof scalar === "string" &&
      boundedRepresentations(scalar).some((representation) => {
        const normalized = representation.trim().toLowerCase();
        return normalized === "1" || normalized === "v1";
      })
    );
  });
}

function inspectAliasSelection(
  members: ReadonlyMap<string, unknown>,
  deprecated: ReadonlySet<string>,
  file: string,
  field: string,
  issues: PlatformVersionIssue[],
): void {
  const aliasValues = ["root", "alias", "schema_alias"].flatMap((key) =>
    members.has(key) ? [members.get(key)] : [],
  );
  const versionValues = ["version", "major"].flatMap((key) =>
    members.has(key) ? [members.get(key)] : [],
  );
  const selectsDeprecated = aliasValues.some((value) =>
    normalizedPlatformAliases(value).some((alias) =>
      versionValues.some(
        (version) =>
          isV1Major(version) &&
          deprecated.has(`${PLATFORM_SCHEMA_PREFIX}${alias}:v1`),
      ),
    ),
  );
  if (selectsDeprecated) {
    issues.push({
      code: "DEPRECATED_PLATFORM_V1_ALIAS",
      file,
      field,
      detail:
        "new M02 producer surface selects a deprecated platform alias/major pair",
    });
  }
}

function inspectJson(
  value: unknown,
  deprecated: ReadonlySet<string>,
  file: string,
  pointer: string,
  issues: PlatformVersionIssue[],
): void {
  if (typeof value === "string") {
    inspectStringRepresentation(value, deprecated, file, pointer, issues);
  } else if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      value.length <= MAX_STATIC_NODES &&
      value.every((item): item is string => typeof item === "string") &&
      value.reduce((length, item) => length + item.length, 0) <=
        MAX_STATIC_STRING_LENGTH
    ) {
      for (const representation of new Set(
        ["", ":", "-"].map((separator) => value.join(separator)),
      )) {
        inspectStringRepresentation(
          representation,
          deprecated,
          file,
          `${pointer}/@joined`,
          issues,
        );
      }
    }
    value.forEach((item, index) => {
      inspectJson(item, deprecated, file, pointerAt(pointer, index), issues);
    });
  } else if (typeof value === "object" && value !== null) {
    const object = value as Record<string, unknown>;
    inspectAliasSelection(
      new Map(Object.entries(object)),
      deprecated,
      file,
      pointer === "" ? "/" : pointer,
      issues,
    );
    for (const [index, [key, item]] of Object.entries(value).entries()) {
      const safeKey = `@member/${String(index)}`;
      inspectJson(key, deprecated, file, `${pointer}/${safeKey}/@key`, issues);
      inspectJson(item, deprecated, file, `${pointer}/${safeKey}`, issues);
    }
  }
}

function inspectStringRepresentation(
  value: string,
  deprecated: ReadonlySet<string>,
  file: string,
  pointer: string,
  issues: PlatformVersionIssue[],
): void {
  const field = pointer === "" ? "/" : pointer;
  const reported = new Set<string>();
  for (const representation of boundedRepresentations(value)) {
    DEPRECATED_V1_REFERENCE.lastIndex = 0;
    for (const match of representation.matchAll(DEPRECATED_V1_REFERENCE)) {
      const root = match[0].toLowerCase();
      if (deprecated.has(root) && !reported.has(`root:${root}`)) {
        reported.add(`root:${root}`);
        issues.push({
          code: "DEPRECATED_PLATFORM_V1_WRITE",
          file,
          field,
          detail:
            "new M02 producer surface references a deprecated platform v1 root",
        });
      }
    }
    for (const root of deprecated) {
      const alias = root.slice(PLATFORM_SCHEMA_PREFIX.length, -":v1".length);
      if (
        (representation.includes(`${alias}.v1.schema.json`) ||
          representation.includes(`${alias}.v1.schema`)) &&
        !reported.has(`filename:${alias}`)
      ) {
        reported.add(`filename:${alias}`);
        issues.push({
          code: "DEPRECATED_PLATFORM_V1_FILENAME",
          file,
          field,
          detail:
            "new M02 producer surface references a deprecated platform v1 schema filename",
        });
      }
    }
  }
}

interface StaticStringValue {
  readonly kind: "string";
  readonly value: string;
}

interface StaticNumberValue {
  readonly kind: "number";
  readonly value: number;
}

interface StaticBooleanValue {
  readonly kind: "boolean";
  readonly value: boolean;
}

interface StaticNullValue {
  readonly kind: "null";
}

interface StaticUndefinedValue {
  readonly kind: "undefined";
}

interface StaticHoleValue {
  readonly kind: "hole";
}

interface StaticArrayValue {
  readonly kind: "array";
  readonly elements: readonly (StaticValue | StaticHoleValue)[];
}

type StaticValue =
  | StaticStringValue
  | StaticNumberValue
  | StaticBooleanValue
  | StaticNullValue
  | StaticUndefinedValue
  | StaticArrayValue;

interface ConstantEvaluationContext {
  readonly constants: ReadonlyMap<string, ts.Expression | null>;
  readonly arrayJoinIntrinsicOverrideOffset?: number | undefined;
  nodes: number;
}

function joinStaticArray(
  value: StaticArrayValue,
  separator: string,
): string | undefined {
  const parts: string[] = [];
  for (const element of value.elements) {
    if (
      element.kind === "hole" ||
      element.kind === "null" ||
      element.kind === "undefined"
    ) {
      parts.push("");
    } else {
      const part = staticValueToString(element);
      if (part === undefined) {
        return undefined;
      }
      parts.push(part);
    }
  }
  const joined = parts.join(separator);
  return joined.length <= MAX_STATIC_STRING_LENGTH ? joined : undefined;
}

function staticValueToString(value: StaticValue): string | undefined {
  switch (value.kind) {
    case "string":
      return value.value;
    case "number":
    case "boolean":
      return String(value.value);
    case "null":
      return "null";
    case "undefined":
      return "undefined";
    case "array":
      return joinStaticArray(value, ",");
  }
}

function staticTruthiness(value: StaticValue): boolean {
  switch (value.kind) {
    case "string":
      return value.value.length > 0;
    case "number":
      return value.value !== 0 && !Number.isNaN(value.value);
    case "boolean":
      return value.value;
    case "null":
    case "undefined":
      return false;
    case "array":
      return true;
  }
}

function joinMember(
  expression: ts.LeftHandSideExpression,
): ts.Expression | undefined {
  if (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "join"
  ) {
    return expression.expression;
  }
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteralLike(expression.argumentExpression) &&
    expression.argumentExpression.text === "join"
  ) {
    return expression.expression;
  }
  return undefined;
}

function evaluateConstantValue(
  expression: ts.Expression,
  context: ConstantEvaluationContext,
  depth = 0,
): StaticValue | undefined {
  context.nodes += 1;
  if (depth > MAX_STATIC_DEPTH || context.nodes > MAX_STATIC_NODES) {
    return undefined;
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text.length <= MAX_STATIC_STRING_LENGTH
      ? { kind: "string", value: expression.text }
      : undefined;
  }
  if (ts.isNumericLiteral(expression)) {
    const value = Number(expression.text);
    return Number.isFinite(value) ? { kind: "number", value } : undefined;
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "boolean", value: true };
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "boolean", value: false };
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "null" };
  }
  if (ts.isParenthesizedExpression(expression)) {
    return evaluateConstantValue(expression.expression, context, depth + 1);
  }
  if (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return evaluateConstantValue(expression.expression, context, depth + 1);
  }
  if (ts.isPrefixUnaryExpression(expression)) {
    const operand = evaluateConstantValue(
      expression.operand,
      context,
      depth + 1,
    );
    if (operand?.kind !== "number") {
      return undefined;
    }
    if (expression.operator === ts.SyntaxKind.PlusToken) {
      return operand;
    }
    if (expression.operator === ts.SyntaxKind.MinusToken) {
      return { kind: "number", value: -operand.value };
    }
    return undefined;
  }
  if (ts.isBinaryExpression(expression)) {
    const left = evaluateConstantValue(expression.left, context, depth + 1);
    const right = evaluateConstantValue(expression.right, context, depth + 1);
    if (left === undefined || right === undefined) {
      return undefined;
    }
    if (expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      if (left.kind === "number" && right.kind === "number") {
        return { kind: "number", value: left.value + right.value };
      }
      if (
        left.kind !== "string" &&
        right.kind !== "string" &&
        left.kind !== "array" &&
        right.kind !== "array"
      ) {
        return undefined;
      }
      const leftText = staticValueToString(left);
      const rightText = staticValueToString(right);
      if (leftText === undefined || rightText === undefined) {
        return undefined;
      }
      const combined = leftText + rightText;
      return combined.length <= MAX_STATIC_STRING_LENGTH
        ? { kind: "string", value: combined }
        : undefined;
    }
    if (left.kind !== "number" || right.kind !== "number") {
      return undefined;
    }
    switch (expression.operatorToken.kind) {
      case ts.SyntaxKind.MinusToken:
        return { kind: "number", value: left.value - right.value };
      case ts.SyntaxKind.AsteriskToken:
        return { kind: "number", value: left.value * right.value };
      case ts.SyntaxKind.SlashToken:
        return right.value === 0
          ? undefined
          : { kind: "number", value: left.value / right.value };
      case ts.SyntaxKind.PercentToken:
        return right.value === 0
          ? undefined
          : { kind: "number", value: left.value % right.value };
      default:
        return undefined;
    }
  }
  if (ts.isIdentifier(expression)) {
    const initializer = context.constants.get(expression.text);
    return initializer === undefined || initializer === null
      ? undefined
      : evaluateConstantValue(initializer, context, depth + 1);
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      const evaluated = evaluateConstantValue(
        span.expression,
        context,
        depth + 1,
      );
      if (evaluated === undefined) {
        return undefined;
      }
      const part = staticValueToString(evaluated);
      if (part === undefined) {
        return undefined;
      }
      value += part + span.literal.text;
      if (value.length > MAX_STATIC_STRING_LENGTH) {
        return undefined;
      }
    }
    return { kind: "string", value };
  }
  if (ts.isArrayLiteralExpression(expression)) {
    const elements: (StaticValue | StaticHoleValue)[] = [];
    for (const element of expression.elements) {
      if (ts.isOmittedExpression(element)) {
        elements.push({ kind: "hole" });
      } else if (ts.isSpreadElement(element)) {
        return undefined;
      } else {
        const evaluated = evaluateConstantValue(element, context, depth + 1);
        if (evaluated === undefined) {
          return undefined;
        }
        elements.push(evaluated);
      }
    }
    return { kind: "array", elements };
  }
  if (ts.isCallExpression(expression) && expression.arguments.length <= 1) {
    const receiver = joinMember(expression.expression);
    if (receiver !== undefined) {
      if (
        context.arrayJoinIntrinsicOverrideOffset !== undefined &&
        context.arrayJoinIntrinsicOverrideOffset < expression.getStart()
      ) {
        return undefined;
      }
      const evaluated = evaluateConstantValue(receiver, context, depth + 1);
      if (evaluated?.kind !== "array") {
        return undefined;
      }
      let separator = ",";
      const separatorExpression = expression.arguments[0];
      if (separatorExpression !== undefined) {
        const separatorValue = evaluateConstantValue(
          separatorExpression,
          context,
          depth + 1,
        );
        if (separatorValue === undefined) {
          return undefined;
        }
        const converted = staticValueToString(separatorValue);
        if (converted === undefined) {
          return undefined;
        }
        separator = converted;
      }
      const joined = joinStaticArray(evaluated, separator);
      return joined === undefined
        ? undefined
        : { kind: "string", value: joined };
    }
  }
  if (ts.isConditionalExpression(expression)) {
    const condition = evaluateConstantValue(
      expression.condition,
      context,
      depth + 1,
    );
    if (condition === undefined) {
      return undefined;
    }
    return evaluateConstantValue(
      staticTruthiness(condition) ? expression.whenTrue : expression.whenFalse,
      context,
      depth + 1,
    );
  }
  return undefined;
}

function soleReturnExpression(body: ts.Block): ts.Expression | undefined {
  const [statement] = body.statements;
  return body.statements.length === 1 &&
    statement !== undefined &&
    ts.isReturnStatement(statement)
    ? statement.expression
    : undefined;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  if (
    ts.isComputedPropertyName(name) &&
    ts.isStringLiteralLike(name.expression)
  ) {
    return name.expression.text;
  }
  return undefined;
}

function evaluatedPropertyName(
  name: ts.PropertyName,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
): string | undefined {
  const direct = propertyNameText(name);
  if (direct !== undefined) {
    return direct;
  }
  if (!ts.isComputedPropertyName(name)) {
    return undefined;
  }
  const evaluated = evaluateConstantValue(name.expression, {
    constants,
    arrayJoinIntrinsicOverrideOffset,
    nodes: 0,
  });
  return evaluated?.kind === "string" || evaluated?.kind === "number"
    ? String(evaluated.value)
    : undefined;
}

function evaluatedMemberName(
  expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  const argument = expression.argumentExpression;
  const evaluated = evaluateConstantValue(argument, {
    constants,
    arrayJoinIntrinsicOverrideOffset,
    nodes: 0,
  });
  return evaluated?.kind === "string" || evaluated?.kind === "number"
    ? String(evaluated.value)
    : undefined;
}

function aliasScalar(value: StaticValue | undefined): unknown {
  if (value?.kind === "string" || value?.kind === "number") {
    return value.value;
  }
  if (
    value?.kind === "array" &&
    value.elements.every(
      (element): element is StaticStringValue | StaticNumberValue =>
        element.kind === "string" || element.kind === "number",
    )
  ) {
    return value.elements.map((element) => element.value);
  }
  return undefined;
}

function inspectTypeScriptAliasObject(
  expression: ts.ObjectLiteralExpression,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
  deprecated: ReadonlySet<string>,
  file: string,
  field: string,
  issues: PlatformVersionIssue[],
): void {
  const members = new Map<string, unknown>();
  const state = {
    hasAliasMember: false,
    hasVersionMember: false,
    unresolvedMember: false,
  };
  const seenSpreads = new Set<string>();
  const addMember = (name: string, initializer: ts.Expression): void => {
    const isAliasMember = ["root", "alias", "schema_alias"].includes(name);
    const isVersionMember = ["version", "major"].includes(name);
    if (!isAliasMember && !isVersionMember) {
      return;
    }
    state.hasAliasMember ||= isAliasMember;
    state.hasVersionMember ||= isVersionMember;
    const evaluated = evaluateConstantValue(initializer, {
      constants,
      arrayJoinIntrinsicOverrideOffset,
      nodes: 0,
    });
    if (evaluated === undefined) {
      state.unresolvedMember = true;
    }
    members.set(name, aliasScalar(evaluated));
  };
  const collect = (object: ts.ObjectLiteralExpression, depth: number): void => {
    if (depth > MAX_STATIC_DEPTH) {
      state.unresolvedMember = true;
      return;
    }
    for (const property of object.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = evaluatedPropertyName(
          property.name,
          constants,
          arrayJoinIntrinsicOverrideOffset,
        );
        if (name !== undefined) {
          addMember(name, property.initializer);
        }
        continue;
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        addMember(property.name.text, property.name);
        continue;
      }
      if (ts.isGetAccessorDeclaration(property)) {
        const name = evaluatedPropertyName(
          property.name,
          constants,
          arrayJoinIntrinsicOverrideOffset,
        );
        if (
          name === undefined ||
          (!["root", "alias", "schema_alias"].includes(name) &&
            !["version", "major"].includes(name))
        ) {
          continue;
        }
        const returned =
          property.body === undefined
            ? undefined
            : soleReturnExpression(property.body);
        if (returned === undefined) {
          state.hasAliasMember ||= ["root", "alias", "schema_alias"].includes(
            name,
          );
          state.hasVersionMember ||= ["version", "major"].includes(name);
          state.unresolvedMember = true;
        } else {
          addMember(name, returned);
        }
        continue;
      }
      if (ts.isSpreadAssignment(property)) {
        const spread = unwrapStaticExpression(property.expression);
        let spreadObject: ts.ObjectLiteralExpression | undefined;
        if (ts.isObjectLiteralExpression(spread)) {
          spreadObject = spread;
        } else if (ts.isIdentifier(spread) && !seenSpreads.has(spread.text)) {
          const initializer = constants.get(spread.text);
          const candidate =
            initializer === null || initializer === undefined
              ? undefined
              : unwrapStaticExpression(initializer);
          if (
            candidate !== undefined &&
            ts.isObjectLiteralExpression(candidate)
          ) {
            seenSpreads.add(spread.text);
            spreadObject = candidate;
          }
        }
        if (spreadObject !== undefined) {
          collect(spreadObject, depth + 1);
        }
      }
    }
  };
  collect(expression, 0);
  const before = issues.length;
  inspectAliasSelection(members, deprecated, file, field, issues);
  if (
    issues.length === before &&
    state.hasAliasMember &&
    state.hasVersionMember &&
    state.unresolvedMember
  ) {
    issues.push({
      code: "PLATFORM_SCHEMA_EXPRESSION_UNRESOLVED",
      file,
      field,
      detail:
        "schema-looking TypeScript producer expression cannot be resolved to a reviewed constant",
    });
  }
}

function hasSchemaMarker(value: string): boolean {
  return boundedRepresentations(value).some(
    (representation) =>
      /urn:japp:schema:platform:/iu.test(representation) ||
      /[a-z][a-z0-9-]*\.v1\.schema(?:\.json)?/iu.test(representation),
  );
}

function expressionLooksSchemaLike(
  expression: ts.Expression,
  source: ts.SourceFile,
  constantCandidates: ReadonlyMap<string, readonly ts.Expression[]>,
): boolean {
  const fragments: string[] = [];
  const seenAliases = new Set<string>();
  const collect = (node: ts.Node, depth: number): void => {
    if (depth > MAX_STATIC_DEPTH || fragments.length > MAX_STATIC_NODES) {
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      fragments.push(node.text);
    } else if (ts.isNumericLiteral(node)) {
      fragments.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      fragments.push(node.head.text);
      for (const span of node.templateSpans) {
        fragments.push(span.literal.text);
      }
    } else if (ts.isIdentifier(node) && !seenAliases.has(node.text)) {
      const initializers = constantCandidates.get(node.text) ?? [];
      if (initializers.length > 0) {
        seenAliases.add(node.text);
        for (const initializer of initializers) {
          collect(initializer, depth + 1);
        }
      }
    }
    ts.forEachChild(node, (child) => {
      collect(child, depth + 1);
    });
  };
  collect(expression, 0);
  const candidates = [
    expression.getText(source),
    fragments.join(""),
    fragments.join(":"),
    fragments.join("-"),
  ];
  return candidates.some(hasSchemaMarker);
}

function isUnresolvedExpressionBoundary(expression: ts.Expression): boolean {
  return (
    ts.isBinaryExpression(expression) ||
    ts.isCallExpression(expression) ||
    ts.isConditionalExpression(expression) ||
    ts.isTaggedTemplateExpression(expression) ||
    ts.isTemplateExpression(expression)
  );
}

const ARRAY_MUTATING_METHODS = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

function referencedIdentifier(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return referencedIdentifier(expression.expression);
  }
  return undefined;
}

function mutationRootIdentifier(expression: ts.Expression): string | undefined {
  const direct = referencedIdentifier(expression);
  if (direct !== undefined) {
    return direct;
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return mutationRootIdentifier(expression.expression);
  }
  return undefined;
}

function staticMemberName(
  expression: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return ts.isStringLiteralLike(expression.argumentExpression)
    ? expression.argumentExpression.text
    : undefined;
}

function unwrapStaticExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

interface LexicalValueBinding {
  readonly declaration: ts.Node;
  readonly declarationStart: number;
  readonly initializer?: ts.Expression | undefined;
  readonly projection: readonly string[];
  readonly scope: ts.Node;
}

type LexicalValueBindings = ReadonlyMap<string, readonly LexicalValueBinding[]>;

function isFunctionScope(node: ts.Node): boolean {
  return (
    ts.isArrowFunction(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function lexicalBindingScope(node: ts.Node): ts.Node {
  const functionScopedVariable =
    ts.isVariableDeclaration(node) &&
    (node.parent.flags & ts.NodeFlags.BlockScoped) === 0;
  let current = node.parent;
  while (!ts.isSourceFile(current)) {
    if (
      ts.isModuleBlock(current) ||
      isFunctionScope(current) ||
      (!functionScopedVariable &&
        (ts.isBlock(current) ||
          ts.isCaseBlock(current) ||
          ts.isCatchClause(current) ||
          ts.isForInStatement(current) ||
          ts.isForOfStatement(current) ||
          ts.isForStatement(current)))
    ) {
      return current;
    }
    current = current.parent;
  }
  return current;
}

function collectLexicalBindingNames(
  name: ts.BindingName,
  add: (identifier: ts.Identifier) => void,
): void {
  if (ts.isIdentifier(name)) {
    add(name);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) {
      collectLexicalBindingNames(element.name, add);
    }
  }
}

function collectLexicalValueBindings(
  source: ts.SourceFile,
): LexicalValueBindings {
  const bindings = new Map<string, LexicalValueBinding[]>();
  const add = (
    identifier: ts.Identifier,
    declaration: ts.Node,
    initializer?: ts.Expression,
    projection: readonly string[] = [],
  ): void => {
    const values = bindings.get(identifier.text) ?? [];
    values.push({
      declaration,
      declarationStart: declaration.getStart(source),
      initializer,
      projection,
      scope: lexicalBindingScope(declaration),
    });
    bindings.set(identifier.text, values);
  };
  const addVariableBinding = (
    name: ts.BindingName,
    declaration: ts.VariableDeclaration,
    initializer: ts.Expression | undefined,
    projection: readonly string[] = [],
  ): void => {
    if (ts.isIdentifier(name)) {
      add(name, declaration, initializer, projection);
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (ts.isOmittedExpression(element)) {
        continue;
      }
      const objectMember =
        element.propertyName ??
        (ts.isIdentifier(element.name) ? element.name : undefined);
      const member = ts.isObjectBindingPattern(name)
        ? objectMember === undefined
          ? undefined
          : propertyNameText(objectMember)
        : String(index);
      addVariableBinding(
        element.name,
        declaration,
        initializer,
        member === undefined ? projection : [...projection, member],
      );
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      addVariableBinding(node.name, node, node.initializer);
    } else if (ts.isParameter(node)) {
      collectLexicalBindingNames(node.name, (identifier) => {
        add(identifier, node);
      });
    } else if (
      (ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isFunctionDeclaration(node)) &&
      node.name !== undefined
    ) {
      add(node.name, node);
    } else if (ts.isImportClause(node) && node.name !== undefined) {
      add(node.name, node);
    } else if (
      ts.isImportSpecifier(node) ||
      ts.isNamespaceImport(node) ||
      ts.isImportEqualsDeclaration(node)
    ) {
      add(node.name, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return bindings;
}

function visibleLexicalValueBinding(
  name: string,
  usePosition: number,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
): LexicalValueBinding | undefined {
  return (bindings.get(name) ?? [])
    .filter(
      (binding) =>
        binding.scope.getStart(source) <= usePosition &&
        usePosition < binding.scope.getEnd(),
    )
    .sort(
      (left, right) =>
        left.scope.getWidth(source) - right.scope.getWidth(source),
    )[0];
}

interface BindingValueCandidate {
  readonly expression: ts.Expression;
  readonly projection: readonly string[];
}

function executionContainer(node: ts.Node): ts.Node {
  let current = node;
  while (!ts.isSourceFile(current) && !isFunctionScope(current)) {
    current = current.parent;
  }
  return current;
}

function assignmentHasUncertainControl(
  node: ts.Node,
  container: ts.Node,
): boolean {
  let current = node.parent;
  while (current !== container && !ts.isSourceFile(current)) {
    if (
      ts.isIfStatement(current) ||
      ts.isConditionalExpression(current) ||
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current) ||
      ts.isSwitchStatement(current) ||
      ts.isTryStatement(current) ||
      ts.isCatchClause(current) ||
      (ts.isBinaryExpression(current) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(current.operatorToken.kind))
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function bindingValueCandidatesAt(
  name: string,
  binding: LexicalValueBinding,
  useNode: ts.Node,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
): readonly BindingValueCandidate[] {
  let candidates: BindingValueCandidate[] =
    binding.initializer === undefined
      ? []
      : [{ expression: binding.initializer, projection: binding.projection }];
  const container = executionContainer(useNode);
  const assignments: ts.BinaryExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const target = unwrapStaticExpression(node.left);
      if (
        ts.isIdentifier(target) &&
        target.text === name &&
        node.getStart(source) > binding.declarationStart &&
        node.getStart(source) < useNode.getStart(source) &&
        executionContainer(node) === container &&
        visibleLexicalValueBinding(
          name,
          node.getStart(source),
          source,
          bindings,
        ) === binding
      ) {
        assignments.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(container);
  assignments.sort(
    (left, right) => left.getStart(source) - right.getStart(source),
  );
  for (const assignment of assignments) {
    if (
      assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      assignmentHasUncertainControl(assignment, container)
    ) {
      candidates.push({ expression: assignment.right, projection: [] });
    } else {
      candidates = [{ expression: assignment.right, projection: [] }];
    }
  }
  return candidates;
}

function pointInTimeStaticStrings(
  rawExpression: ts.Expression,
  useNode: ts.Node,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
): ReadonlySet<string> {
  const expression = unwrapStaticExpression(rawExpression);
  const direct = evaluateConstantValue(expression, {
    constants,
    arrayJoinIntrinsicOverrideOffset,
    nodes: 0,
  });
  if (direct?.kind === "string" || direct?.kind === "number") {
    return new Set([String(direct.value)]);
  }
  if (!ts.isIdentifier(expression)) {
    return new Set();
  }
  const binding = visibleLexicalValueBinding(
    expression.text,
    useNode.getStart(source),
    source,
    bindings,
  );
  if (binding === undefined) {
    return new Set();
  }
  const values = new Set<string>();
  for (const candidate of bindingValueCandidatesAt(
    expression.text,
    binding,
    useNode,
    source,
    bindings,
  )) {
    if (candidate.projection.length !== 0) {
      continue;
    }
    const evaluated = evaluateConstantValue(candidate.expression, {
      constants,
      arrayJoinIntrinsicOverrideOffset,
      nodes: 0,
    });
    if (evaluated?.kind === "string" || evaluated?.kind === "number") {
      values.add(String(evaluated.value));
    }
  }
  return values;
}

const SCHEMA_DESTINATION_NAMES = new Set([
  "schema",
  "schemaref",
  "platformschema",
]);

function isSchemaDestinationName(name: string): boolean {
  return SCHEMA_DESTINATION_NAMES.has(
    name.replaceAll("_", "").replaceAll("-", "").toLowerCase(),
  );
}

function bindingNameHasSchemaDestination(name: ts.BindingName): boolean {
  if (ts.isIdentifier(name)) {
    return isSchemaDestinationName(name.text);
  }
  return name.elements.some(
    (element) =>
      !ts.isOmittedExpression(element) &&
      ((element.propertyName !== undefined &&
        propertyNameText(element.propertyName) !== undefined &&
        isSchemaDestinationName(
          propertyNameText(element.propertyName) ?? "",
        )) ||
        bindingNameHasSchemaDestination(element.name)),
  );
}

function schemaDestinationTarget(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
): boolean {
  const target = unwrapStaticExpression(expression);
  if (ts.isIdentifier(target)) {
    return isSchemaDestinationName(target.text);
  }
  if (ts.isPropertyAccessExpression(target)) {
    return isSchemaDestinationName(target.name.text);
  }
  if (ts.isElementAccessExpression(target)) {
    return [
      ...pointInTimeStaticStrings(
        target.argumentExpression,
        target,
        source,
        bindings,
        constants,
        arrayJoinIntrinsicOverrideOffset,
      ),
    ].some(isSchemaDestinationName);
  }
  return false;
}

function expressionIsSchemaDestinationName(
  expression: ts.Expression,
  useNode: ts.Node,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
): boolean {
  return [
    ...pointInTimeStaticStrings(
      expression,
      useNode,
      source,
      bindings,
      constants,
      arrayJoinIntrinsicOverrideOffset,
    ),
  ].some(isSchemaDestinationName);
}

function schemaParameterIndexes(
  rawCallee: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  usePosition: number,
  seen = new Set<string>(),
): ReadonlySet<number> {
  const callee = unwrapStaticExpression(rawCallee);
  let parameters: readonly ts.ParameterDeclaration[] | undefined;
  if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
    parameters = callee.parameters;
  } else if (ts.isIdentifier(callee)) {
    if (seen.has(callee.text)) {
      return new Set();
    }
    const binding = visibleLexicalValueBinding(
      callee.text,
      usePosition,
      source,
      bindings,
    );
    if (binding === undefined) {
      return new Set();
    }
    if (ts.isFunctionDeclaration(binding.declaration)) {
      parameters = binding.declaration.parameters;
    } else if (
      ts.isVariableDeclaration(binding.declaration) &&
      binding.initializer !== undefined &&
      binding.declarationStart < usePosition
    ) {
      const nextSeen = new Set(seen);
      nextSeen.add(callee.text);
      return schemaParameterIndexes(
        binding.initializer,
        source,
        bindings,
        binding.initializer.getStart(source),
        nextSeen,
      );
    }
  }
  if (parameters === undefined) {
    return new Set();
  }
  return new Set(
    parameters
      .map((parameter, index) =>
        bindingNameHasSchemaDestination(parameter.name) ? index : undefined,
      )
      .filter((index): index is number => index !== undefined),
  );
}

function invocationSchemaParameterIndexes(
  call: ts.CallExpression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
): ReadonlySet<number> {
  const callee = unwrapStaticExpression(call.expression);
  if (
    (ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)) &&
    staticMemberName(callee) === "call"
  ) {
    return new Set(
      [
        ...schemaParameterIndexes(
          callee.expression,
          source,
          bindings,
          call.getStart(source),
        ),
      ].map((index) => index + 1),
    );
  }
  return schemaParameterIndexes(
    call.expression,
    source,
    bindings,
    call.getStart(source),
  );
}

function isSchemaWriterMethodCall(call: ts.CallExpression): boolean {
  const callee = unwrapStaticExpression(call.expression);
  if (
    !(
      ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)
    ) ||
    staticMemberName(callee) !== "write"
  ) {
    return false;
  }
  const receiver = unwrapStaticExpression(callee.expression);
  return (
    ts.isIdentifier(receiver) &&
    /(?:^|_)(?:evidence_?)?writer$/iu.test(receiver.text)
  );
}

function isDynamicSchemaValue(rawExpression: ts.Expression): boolean {
  const expression = unwrapStaticExpression(rawExpression);
  return (
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression) ||
    ts.isCallExpression(expression) ||
    ts.isNewExpression(expression) ||
    ts.isBinaryExpression(expression) ||
    ts.isConditionalExpression(expression) ||
    ts.isTemplateExpression(expression) ||
    ts.isTaggedTemplateExpression(expression) ||
    ts.isAwaitExpression(expression) ||
    ts.isYieldExpression(expression)
  );
}

function parseCanonicalSource(path: string): ts.SourceFile | undefined {
  try {
    const stats = lstatSync(path);
    if (
      stats.isSymbolicLink() ||
      !stats.isFile() ||
      stats.size > MAX_SCAN_BYTES
    ) {
      return undefined;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      readFileSync(path),
    );
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const diagnostics = (
      source as ts.SourceFile & {
        readonly parseDiagnostics: readonly ts.Diagnostic[];
      }
    ).parseDiagnostics;
    return diagnostics.length === 0 ? source : undefined;
  } catch {
    return undefined;
  }
}

function topLevelConstantDeclaration(
  source: ts.SourceFile,
  name: string,
): ts.VariableDeclaration | undefined {
  const matches: ts.VariableDeclaration[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      (statement.declarationList.flags & ts.NodeFlags.Const) === 0
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push(declaration);
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function expressionEscapesIdentifier(node: ts.Node, name: string): boolean {
  let escapes = false;
  const visit = (current: ts.Node): void => {
    if (escapes) {
      return;
    }
    if (ts.isIdentifier(current) && current.text === name) {
      const parent = current.parent;
      if (
        (ts.isPropertyAccessExpression(parent) ||
          ts.isElementAccessExpression(parent)) &&
        parent.expression === current
      ) {
        return;
      }
      escapes = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return escapes;
}

function identifierMayBeMutated(
  source: ts.SourceFile,
  name: string,
  afterPosition: number,
  beforePosition: number,
): boolean {
  let mutated = false;
  const visit = (node: ts.Node): void => {
    if (mutated || node.end <= afterPosition || node.pos >= beforePosition) {
      return;
    }
    const position = node.getStart(source);
    if (position >= afterPosition && position < beforePosition) {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        mutationRootIdentifier(node.left) === name
      ) {
        mutated = true;
        return;
      }
      if (
        (ts.isPrefixUnaryExpression(node) ||
          ts.isPostfixUnaryExpression(node)) &&
        mutationRootIdentifier(node.operand) === name
      ) {
        mutated = true;
        return;
      }
      if (
        ts.isDeleteExpression(node) &&
        mutationRootIdentifier(node.expression) === name
      ) {
        mutated = true;
        return;
      }
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        expressionEscapesIdentifier(node.initializer, name)
      ) {
        mutated = true;
        return;
      }
      if (
        ts.isPropertyDeclaration(node) &&
        node.initializer !== undefined &&
        expressionEscapesIdentifier(node.initializer, name)
      ) {
        mutated = true;
        return;
      }
      if (
        ts.isReturnStatement(node) &&
        node.expression !== undefined &&
        expressionEscapesIdentifier(node.expression, name)
      ) {
        mutated = true;
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        expressionEscapesIdentifier(node.right, name)
      ) {
        mutated = true;
        return;
      }
      if (ts.isCallExpression(node)) {
        if (
          node.arguments.some((argument) =>
            expressionEscapesIdentifier(argument, name),
          )
        ) {
          mutated = true;
          return;
        }
        if (
          (ts.isPropertyAccessExpression(node.expression) ||
            ts.isElementAccessExpression(node.expression)) &&
          mutationRootIdentifier(node.expression.expression) === name &&
          ARRAY_MUTATING_METHODS.has(staticMemberName(node.expression) ?? "")
        ) {
          mutated = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return mutated;
}

function importDeclarationForBinding(
  binding: LexicalValueBinding,
): ts.ImportDeclaration | undefined {
  let node = binding.declaration;
  while (!ts.isSourceFile(node)) {
    if (ts.isImportDeclaration(node)) {
      return node;
    }
    node = node.parent;
  }
  return undefined;
}

function isCanonicalNamedImport(
  binding: LexicalValueBinding,
  importedName: string,
  sourcePath: string,
  canonicalPath: string,
): boolean {
  if (!ts.isImportSpecifier(binding.declaration)) {
    return false;
  }
  const declaredImportName =
    binding.declaration.propertyName?.text ?? binding.declaration.name.text;
  const importDeclaration = importDeclarationForBinding(binding);
  if (
    declaredImportName !== importedName ||
    importDeclaration === undefined ||
    !ts.isStringLiteral(importDeclaration.moduleSpecifier)
  ) {
    return false;
  }
  try {
    return (
      realpathSync(
        resolve(dirname(sourcePath), importDeclaration.moduleSpecifier.text),
      ) === realpathSync(canonicalPath)
    );
  } catch {
    return false;
  }
}

function reviewedFixtureSchemaRefs(): ReadonlyMap<string, string> | undefined {
  const source = parseCanonicalSource(FIXTURE_MODEL_SOURCE);
  const declaration =
    source === undefined
      ? undefined
      : topLevelConstantDeclaration(source, "SCHEMA_REFS");
  if (
    source === undefined ||
    declaration?.initializer === undefined ||
    identifierMayBeMutated(source, "SCHEMA_REFS", declaration.end, source.end)
  ) {
    return undefined;
  }
  const initializer = unwrapStaticExpression(declaration.initializer);
  if (!ts.isObjectLiteralExpression(initializer)) {
    return undefined;
  }
  const values = new Map<string, string>();
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      return undefined;
    }
    const name = propertyNameText(property.name);
    const value = unwrapStaticExpression(property.initializer);
    if (
      name === undefined ||
      values.has(name) ||
      !ts.isStringLiteralLike(value)
    ) {
      return undefined;
    }
    values.set(name, value.text);
  }
  if (
    values.size !== EXPECTED_FIXTURE_SCHEMA_REF_MEMBERS.size ||
    [...EXPECTED_FIXTURE_SCHEMA_REF_MEMBERS].some((name) => !values.has(name))
  ) {
    return undefined;
  }
  return values;
}

function isReviewedV2SchemaReference(
  value: string,
  deprecated: ReadonlySet<string>,
): boolean {
  return (
    /^urn:japp:schema:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+:v2$/u.test(value) &&
    !deprecated.has(value.toLowerCase())
  );
}

function canonicalCollectionSpecsAreReviewed(
  deprecated: ReadonlySet<string>,
): boolean {
  const modelRefs = reviewedFixtureSchemaRefs();
  const source = parseCanonicalSource(FIXTURE_LOADER_SOURCE);
  const declaration =
    source === undefined
      ? undefined
      : topLevelConstantDeclaration(source, "COLLECTION_SPECS");
  if (
    modelRefs === undefined ||
    source === undefined ||
    declaration?.initializer === undefined ||
    identifierMayBeMutated(
      source,
      "COLLECTION_SPECS",
      declaration.end,
      source.end,
    )
  ) {
    return false;
  }
  const bindings = collectLexicalValueBindings(source);
  const initializer = unwrapStaticExpression(declaration.initializer);
  if (!ts.isArrayLiteralExpression(initializer)) {
    return false;
  }
  const schemaReferences: string[] = [];
  for (const element of initializer.elements) {
    const spec = unwrapStaticExpression(element);
    if (!ts.isObjectLiteralExpression(spec)) {
      return false;
    }
    const schemaRefProperty = spec.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        propertyNameText(property.name) === "schemaRef",
    );
    if (
      schemaRefProperty === undefined ||
      !ts.isPropertyAssignment(schemaRefProperty)
    ) {
      return false;
    }
    const selector = unwrapStaticExpression(schemaRefProperty.initializer);
    if (
      !(
        ts.isPropertyAccessExpression(selector) ||
        ts.isElementAccessExpression(selector)
      ) ||
      !ts.isIdentifier(selector.expression)
    ) {
      return false;
    }
    const binding = visibleLexicalValueBinding(
      selector.expression.text,
      selector.getStart(source),
      source,
      bindings,
    );
    const member = staticMemberName(selector);
    const value = member === undefined ? undefined : modelRefs.get(member);
    if (
      binding === undefined ||
      !isCanonicalNamedImport(
        binding,
        "SCHEMA_REFS",
        FIXTURE_LOADER_SOURCE,
        FIXTURE_MODEL_SOURCE,
      ) ||
      identifierMayBeMutated(
        source,
        selector.expression.text,
        0,
        selector.getStart(source),
      ) ||
      value === undefined ||
      !isReviewedV2SchemaReference(value, deprecated)
    ) {
      return false;
    }
    schemaReferences.push(value);
  }
  return schemaReferences.length === 9;
}

function isCanonicalSchemaRefSelector(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  sourcePath: string,
  deprecated: ReadonlySet<string>,
): boolean {
  const selector = unwrapStaticExpression(expression);
  if (
    !(
      ts.isPropertyAccessExpression(selector) ||
      ts.isElementAccessExpression(selector)
    ) ||
    !ts.isIdentifier(selector.expression)
  ) {
    return false;
  }
  const binding = visibleLexicalValueBinding(
    selector.expression.text,
    selector.getStart(source),
    source,
    bindings,
  );
  const member = staticMemberName(selector);
  const modelRefs = reviewedFixtureSchemaRefs();
  const value =
    member === undefined || modelRefs === undefined
      ? undefined
      : modelRefs.get(member);
  return (
    binding !== undefined &&
    isCanonicalNamedImport(
      binding,
      "SCHEMA_REFS",
      sourcePath,
      FIXTURE_MODEL_SOURCE,
    ) &&
    !identifierMayBeMutated(
      source,
      selector.expression.text,
      0,
      selector.getStart(source),
    ) &&
    value !== undefined &&
    isReviewedV2SchemaReference(value, deprecated)
  );
}

function isCanonicalCollectionSpecSelector(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  sourcePath: string,
  deprecated: ReadonlySet<string>,
): boolean {
  const selector = unwrapStaticExpression(expression);
  if (
    !(
      ts.isPropertyAccessExpression(selector) ||
      ts.isElementAccessExpression(selector)
    ) ||
    staticMemberName(selector) !== "schemaRef" ||
    !ts.isIdentifier(selector.expression)
  ) {
    return false;
  }
  const specBinding = visibleLexicalValueBinding(
    selector.expression.text,
    selector.getStart(source),
    source,
    bindings,
  );
  if (
    specBinding === undefined ||
    !ts.isVariableDeclaration(specBinding.declaration) ||
    identifierMayBeMutated(
      source,
      selector.expression.text,
      specBinding.declaration.end,
      selector.getStart(source),
    )
  ) {
    return false;
  }
  const declarationList = specBinding.declaration.parent;
  const forOf = declarationList.parent;
  if (
    !ts.isVariableDeclarationList(declarationList) ||
    !ts.isForOfStatement(forOf)
  ) {
    return false;
  }
  const collection = unwrapStaticExpression(forOf.expression);
  if (!ts.isIdentifier(collection)) {
    return false;
  }
  const collectionBinding = visibleLexicalValueBinding(
    collection.text,
    collection.getStart(source),
    source,
    bindings,
  );
  return (
    collectionBinding !== undefined &&
    isCanonicalNamedImport(
      collectionBinding,
      "COLLECTION_SPECS",
      sourcePath,
      FIXTURE_LOADER_SOURCE,
    ) &&
    !identifierMayBeMutated(
      source,
      collection.text,
      0,
      selector.getStart(source),
    ) &&
    canonicalCollectionSpecsAreReviewed(deprecated)
  );
}

function isLocalStaticSchemaSelector(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
  deprecated: ReadonlySet<string>,
): boolean {
  const selector = unwrapStaticExpression(expression);
  if (
    !(
      ts.isPropertyAccessExpression(selector) ||
      ts.isElementAccessExpression(selector)
    ) ||
    !ts.isIdentifier(selector.expression)
  ) {
    return false;
  }
  const binding = visibleLexicalValueBinding(
    selector.expression.text,
    selector.getStart(source),
    source,
    bindings,
  );
  if (
    binding === undefined ||
    !ts.isVariableDeclaration(binding.declaration) ||
    (binding.declaration.parent.flags & ts.NodeFlags.Const) === 0 ||
    binding.initializer === undefined ||
    binding.declarationStart >= selector.getStart(source) ||
    identifierMayBeMutated(
      source,
      selector.expression.text,
      binding.declaration.end,
      selector.getStart(source),
    )
  ) {
    return false;
  }
  const object = unwrapStaticExpression(binding.initializer);
  const member = evaluatedMemberName(
    selector,
    constants,
    arrayJoinIntrinsicOverrideOffset,
  );
  if (!ts.isObjectLiteralExpression(object) || member === undefined) {
    return false;
  }
  const properties = object.properties.filter(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyNameText(property.name) === member,
  );
  const property = properties[0];
  if (
    properties.length !== 1 ||
    property === undefined ||
    !ts.isPropertyAssignment(property)
  ) {
    return false;
  }
  const evaluated = evaluateConstantValue(property.initializer, {
    constants,
    arrayJoinIntrinsicOverrideOffset,
    nodes: 0,
  });
  return (
    evaluated?.kind === "string" &&
    isReviewedV2SchemaReference(evaluated.value, deprecated)
  );
}

function isProvenReviewedSchemaSelector(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  sourcePath: string,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
  deprecated: ReadonlySet<string>,
): boolean {
  return (
    isCanonicalSchemaRefSelector(
      expression,
      source,
      bindings,
      sourcePath,
      deprecated,
    ) ||
    isCanonicalCollectionSpecSelector(
      expression,
      source,
      bindings,
      sourcePath,
      deprecated,
    ) ||
    isLocalStaticSchemaSelector(
      expression,
      source,
      bindings,
      constants,
      arrayJoinIntrinsicOverrideOffset,
      deprecated,
    )
  );
}

function isSchemaParameterCall(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
): boolean {
  const call = unwrapStaticExpression(expression);
  return (
    ts.isCallExpression(call) &&
    invocationSchemaParameterIndexes(call, source, bindings).size > 0
  );
}

function hasSchemaDestinationContext(
  expression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  sourcePath: string,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
  deprecated: ReadonlySet<string>,
): boolean {
  if (
    isProvenReviewedSchemaSelector(
      expression,
      source,
      bindings,
      sourcePath,
      constants,
      arrayJoinIntrinsicOverrideOffset,
      deprecated,
    )
  ) {
    return false;
  }
  const parent = expression.parent;
  if (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === expression &&
    bindingNameHasSchemaDestination(parent.name) &&
    isDynamicSchemaValue(expression)
  ) {
    return true;
  }
  if (
    ts.isPropertyAssignment(parent) &&
    parent.initializer === expression &&
    (isSchemaDestinationName(propertyNameText(parent.name) ?? "") ||
      (ts.isComputedPropertyName(parent.name) &&
        [
          ...pointInTimeStaticStrings(
            parent.name.expression,
            parent,
            source,
            bindings,
            constants,
            arrayJoinIntrinsicOverrideOffset,
          ),
        ].some(isSchemaDestinationName))) &&
    isDynamicSchemaValue(expression)
  ) {
    return true;
  }
  if (
    ts.isPropertyAssignment(parent) &&
    parent.initializer === expression &&
    propertyNameText(parent.name) === "value" &&
    ts.isObjectLiteralExpression(parent.parent) &&
    ts.isCallExpression(parent.parent.parent)
  ) {
    const descriptor = parent.parent;
    const call = descriptor.parent as ts.CallExpression;
    const destination = call.arguments[1];
    if (
      call.arguments[2] === descriptor &&
      destination !== undefined &&
      isIntrinsicMemberCall(
        call.expression,
        "Object",
        "defineProperty",
        source,
        bindings,
        call.getStart(source),
        constants,
        arrayJoinIntrinsicOverrideOffset,
      ) &&
      expressionIsSchemaDestinationName(
        destination,
        call,
        source,
        bindings,
        constants,
        arrayJoinIntrinsicOverrideOffset,
      ) &&
      isDynamicSchemaValue(expression)
    ) {
      return true;
    }
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.right === expression &&
    parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
    schemaDestinationTarget(
      parent.left,
      source,
      bindings,
      constants,
      arrayJoinIntrinsicOverrideOffset,
    ) &&
    isDynamicSchemaValue(expression)
  ) {
    return true;
  }
  if (ts.isCallExpression(parent)) {
    const argumentIndex = parent.arguments.indexOf(expression);
    const destination = parent.arguments[1];
    if (
      argumentIndex === 2 &&
      destination !== undefined &&
      isIntrinsicMemberCall(
        parent.expression,
        "Reflect",
        "set",
        source,
        bindings,
        parent.getStart(source),
        constants,
        arrayJoinIntrinsicOverrideOffset,
      ) &&
      expressionIsSchemaDestinationName(
        destination,
        parent,
        source,
        bindings,
        constants,
        arrayJoinIntrinsicOverrideOffset,
      ) &&
      isDynamicSchemaValue(expression)
    ) {
      return true;
    }
    return (
      argumentIndex >= 0 &&
      isDynamicSchemaValue(expression) &&
      (invocationSchemaParameterIndexes(parent, source, bindings).has(
        argumentIndex,
      ) ||
        (argumentIndex === 0 && isSchemaWriterMethodCall(parent)))
    );
  }
  return false;
}

function intrinsicGlobalName(
  rawExpression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  usePosition: number,
  seen = new Set<string>(),
): string | undefined {
  const expression = unwrapStaticExpression(rawExpression);
  if (ts.isCallExpression(expression)) {
    const callee = unwrapStaticExpression(expression.expression);
    const reflectTarget = expression.arguments[0];
    const reflectKey = expression.arguments[1];
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticMemberName(callee) === "get" &&
      intrinsicGlobalName(
        callee.expression,
        source,
        bindings,
        expression.getStart(source),
        seen,
      ) === "Reflect" &&
      reflectTarget !== undefined &&
      reflectKey !== undefined &&
      intrinsicGlobalName(
        reflectTarget,
        source,
        bindings,
        expression.getStart(source),
        seen,
      ) === "globalThis"
    ) {
      const key = unwrapStaticExpression(reflectKey);
      if (ts.isStringLiteralLike(key)) {
        return ["Array", "Object", "Reflect"].includes(key.text)
          ? key.text
          : undefined;
      }
      // A runtime key on the global object may select Array. Treat that
      // bounded unresolved producer expression as unsafe rather than trusting
      // Array.prototype.join.
      return "Array";
    }

    let callable:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.ArrowFunction
      | undefined;
    if (ts.isFunctionExpression(callee) || ts.isArrowFunction(callee)) {
      callable = callee;
    } else if (ts.isIdentifier(callee) && !seen.has(callee.text)) {
      const binding = visibleLexicalValueBinding(
        callee.text,
        expression.getStart(source),
        source,
        bindings,
      );
      if (
        binding !== undefined &&
        binding.declarationStart < expression.getStart(source)
      ) {
        if (ts.isFunctionDeclaration(binding.declaration)) {
          callable = binding.declaration;
        } else if (
          binding.initializer !== undefined &&
          (ts.isFunctionExpression(
            unwrapStaticExpression(binding.initializer),
          ) ||
            ts.isArrowFunction(unwrapStaticExpression(binding.initializer)))
        ) {
          callable = unwrapStaticExpression(binding.initializer) as
            ts.FunctionExpression | ts.ArrowFunction;
        }
      }
    }
    if (callable?.body !== undefined) {
      const returned = ts.isBlock(callable.body)
        ? soleReturnExpression(callable.body)
        : callable.body;
      if (returned !== undefined) {
        const unwrappedReturn = unwrapStaticExpression(returned);
        if (ts.isIdentifier(unwrappedReturn)) {
          const parameterIndex = callable.parameters.findIndex(
            (parameter) =>
              ts.isIdentifier(parameter.name) &&
              parameter.name.text === unwrappedReturn.text,
          );
          if (parameterIndex >= 0) {
            const argument = expression.arguments[parameterIndex];
            const selected =
              argument !== undefined && !ts.isSpreadElement(argument)
                ? argument
                : callable.parameters[parameterIndex]?.initializer;
            if (selected !== undefined) {
              const nextSeen = new Set(seen);
              if (ts.isIdentifier(callee)) {
                nextSeen.add(callee.text);
              }
              return intrinsicGlobalName(
                selected,
                source,
                bindings,
                selected.getStart(source),
                nextSeen,
              );
            }
          }
        }
        return intrinsicGlobalName(
          returned,
          source,
          bindings,
          returned.getStart(source),
          seen,
        );
      }
    }
  }
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) {
      return undefined;
    }
    const binding = visibleLexicalValueBinding(
      expression.text,
      usePosition,
      source,
      bindings,
    );
    if (binding !== undefined) {
      if (binding.declarationStart >= usePosition) {
        return undefined;
      }
      const nextSeen = new Set(seen);
      nextSeen.add(expression.text);
      for (const candidate of bindingValueCandidatesAt(
        expression.text,
        binding,
        expression,
        source,
        bindings,
      )) {
        let resolved = intrinsicGlobalName(
          candidate.expression,
          source,
          bindings,
          candidate.expression.getStart(source),
          nextSeen,
        );
        for (const member of candidate.projection) {
          resolved =
            resolved === "globalThis" &&
            ["Array", "Object", "Reflect"].includes(member)
              ? member
              : undefined;
        }
        if (resolved !== undefined) {
          return resolved;
        }
      }
      return undefined;
    }
    if (expression.text === "global") {
      return "globalThis";
    }
    return ["Array", "Object", "Reflect", "globalThis"].includes(
      expression.text,
    )
      ? expression.text
      : undefined;
  }
  if (
    (ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
    staticMemberName(expression) === "value"
  ) {
    const receiver = unwrapStaticExpression(expression.expression);
    if (ts.isCallExpression(receiver) && receiver.arguments.length >= 2) {
      const descriptorCallee = unwrapStaticExpression(receiver.expression);
      const target = receiver.arguments[0];
      const keyArgument = receiver.arguments[1];
      const key =
        keyArgument === undefined
          ? undefined
          : unwrapStaticExpression(keyArgument);
      if (
        target !== undefined &&
        key !== undefined &&
        (ts.isPropertyAccessExpression(descriptorCallee) ||
          ts.isElementAccessExpression(descriptorCallee)) &&
        staticMemberName(descriptorCallee) === "getOwnPropertyDescriptor" &&
        intrinsicGlobalName(
          descriptorCallee.expression,
          source,
          bindings,
          receiver.getStart(source),
          seen,
        ) === "Object" &&
        intrinsicGlobalName(
          target,
          source,
          bindings,
          receiver.getStart(source),
          seen,
        ) === "globalThis" &&
        ts.isStringLiteralLike(key) &&
        ["Array", "Object", "Reflect"].includes(key.text)
      ) {
        return key.text;
      }
    }
  }
  if (
    (ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
    intrinsicGlobalName(
      expression.expression,
      source,
      bindings,
      usePosition,
      seen,
    ) === "globalThis"
  ) {
    const member = staticMemberName(expression);
    return ["Array", "Object", "Reflect"].includes(member ?? "")
      ? member
      : undefined;
  }
  return undefined;
}

function isIntrinsicMemberCall(
  rawCallee: ts.Expression,
  globalName: string,
  memberName: string,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  usePosition: number,
  constants: ReadonlyMap<string, ts.Expression | null>,
  arrayJoinIntrinsicOverrideOffset: number | undefined,
): boolean {
  const callee = unwrapStaticExpression(rawCallee);
  return (
    (ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)) &&
    evaluatedMemberName(callee, constants, arrayJoinIntrinsicOverrideOffset) ===
      memberName &&
    intrinsicGlobalName(callee.expression, source, bindings, usePosition) ===
      globalName
  );
}

function isArrayPrototypeReference(
  rawExpression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  usePosition: number,
  seen = new Set<string>(),
): boolean {
  const expression = unwrapStaticExpression(rawExpression);
  if (ts.isCallExpression(expression)) {
    if (
      intrinsicGlobalName(expression, source, bindings, usePosition, seen) ===
      "Array"
    ) {
      return false;
    }
    const callee = unwrapStaticExpression(expression.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticMemberName(callee) === "get" &&
      ts.isIdentifier(unwrapStaticExpression(callee.expression)) &&
      expression.arguments.length === 1
    ) {
      const receiver = unwrapStaticExpression(callee.expression);
      const lookupArgument = expression.arguments[0];
      const lookup =
        lookupArgument === undefined
          ? undefined
          : unwrapStaticExpression(lookupArgument);
      if (
        ts.isIdentifier(receiver) &&
        lookup !== undefined &&
        ts.isStringLiteralLike(lookup)
      ) {
        const binding = visibleLexicalValueBinding(
          receiver.text,
          usePosition,
          source,
          bindings,
        );
        if (
          binding !== undefined &&
          binding.declarationStart < usePosition &&
          !seen.has(receiver.text)
        ) {
          const nextSeen = new Set(seen);
          nextSeen.add(receiver.text);
          for (const candidate of bindingValueCandidatesAt(
            receiver.text,
            binding,
            expression,
            source,
            bindings,
          )) {
            if (candidate.projection.length !== 0) {
              continue;
            }
            const initializer = unwrapStaticExpression(candidate.expression);
            if (!ts.isNewExpression(initializer)) {
              continue;
            }
            const constructorName = unwrapStaticExpression(
              initializer.expression,
            );
            if (
              !ts.isIdentifier(constructorName) ||
              constructorName.text !== "Map" ||
              visibleLexicalValueBinding(
                "Map",
                initializer.getStart(source),
                source,
                bindings,
              ) !== undefined
            ) {
              continue;
            }
            const entries = initializer.arguments?.[0];
            const entryArray =
              entries === undefined
                ? undefined
                : unwrapStaticExpression(entries);
            if (
              entryArray === undefined ||
              !ts.isArrayLiteralExpression(entryArray)
            ) {
              continue;
            }
            for (const entry of entryArray.elements) {
              if (ts.isSpreadElement(entry)) {
                continue;
              }
              const pair = unwrapStaticExpression(entry);
              if (
                !ts.isArrayLiteralExpression(pair) ||
                pair.elements.length < 2
              ) {
                continue;
              }
              const key = pair.elements[0];
              const value = pair.elements[1];
              if (
                key === undefined ||
                value === undefined ||
                ts.isOmittedExpression(key) ||
                ts.isOmittedExpression(value) ||
                ts.isSpreadElement(key) ||
                ts.isSpreadElement(value)
              ) {
                continue;
              }
              const keyLiteral = unwrapStaticExpression(key);
              if (
                ts.isStringLiteralLike(keyLiteral) &&
                keyLiteral.text === lookup.text &&
                isArrayPrototypeReference(
                  value,
                  source,
                  bindings,
                  value.getStart(source),
                  nextSeen,
                )
              ) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  if (ts.isIdentifier(expression)) {
    const binding = visibleLexicalValueBinding(
      expression.text,
      usePosition,
      source,
      bindings,
    );
    if (binding === undefined) {
      return false;
    }
    if (seen.has(expression.text)) {
      return false;
    }
    if (binding.declarationStart >= usePosition) {
      return false;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(expression.text);
    return bindingValueCandidatesAt(
      expression.text,
      binding,
      expression,
      source,
      bindings,
    ).some((candidate) => {
      if (
        candidate.projection.length === 1 &&
        candidate.projection[0] === "prototype"
      ) {
        return (
          intrinsicGlobalName(
            candidate.expression,
            source,
            bindings,
            candidate.expression.getStart(source),
          ) === "Array"
        );
      }
      return (
        candidate.projection.length === 0 &&
        isArrayPrototypeReference(
          candidate.expression,
          source,
          bindings,
          candidate.expression.getStart(source),
          nextSeen,
        )
      );
    });
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    const receiver = unwrapStaticExpression(expression.expression);
    if (ts.isIdentifier(receiver)) {
      const binding = visibleLexicalValueBinding(
        receiver.text,
        usePosition,
        source,
        bindings,
      );
      const member = staticMemberName(expression);
      if (
        binding !== undefined &&
        binding.declarationStart < usePosition &&
        member !== undefined &&
        !seen.has(receiver.text)
      ) {
        const nextSeen = new Set(seen);
        nextSeen.add(receiver.text);
        for (const candidate of bindingValueCandidatesAt(
          receiver.text,
          binding,
          receiver,
          source,
          bindings,
        )) {
          const object = unwrapStaticExpression(candidate.expression);
          if (
            candidate.projection.length !== 0 ||
            !ts.isObjectLiteralExpression(object)
          ) {
            continue;
          }
          const properties = object.properties.filter(
            (property) =>
              ts.isPropertyAssignment(property) &&
              propertyNameText(property.name) === member,
          );
          const property = properties[0];
          if (
            properties.length === 1 &&
            property !== undefined &&
            ts.isPropertyAssignment(property) &&
            isArrayPrototypeReference(
              property.initializer,
              source,
              bindings,
              property.initializer.getStart(source),
              nextSeen,
            )
          ) {
            return true;
          }
        }
      }
    }
  }
  return (
    (ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
    staticMemberName(expression) === "prototype" &&
    intrinsicGlobalName(
      expression.expression,
      source,
      bindings,
      usePosition,
    ) === "Array"
  );
}

function isPotentialArrayPrototypeJoinMutation(
  rawExpression: ts.Expression,
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
  usePosition: number,
): boolean {
  const expression = unwrapStaticExpression(rawExpression);
  if (isArrayPrototypeReference(expression, source, bindings, usePosition)) {
    return true;
  }
  return (
    (ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
    (staticMemberName(expression) === undefined ||
      staticMemberName(expression) === "join") &&
    isArrayPrototypeReference(
      expression.expression,
      source,
      bindings,
      usePosition,
    )
  );
}

function hasArrayPrototypeJoinOverride(
  source: ts.SourceFile,
  bindings: LexicalValueBindings,
): number | undefined {
  let earliest: number | undefined;
  const namedFunctionMutations = new Map<ts.FunctionDeclaration, ts.Node[]>();
  const mark = (node: ts.Node): void => {
    const position = node.getStart(source);
    earliest = earliest === undefined ? position : Math.min(earliest, position);
  };
  const enclosingNamedFunction = (
    node: ts.Node,
  ): ts.FunctionDeclaration | undefined => {
    let current = node.parent;
    while (!ts.isSourceFile(current)) {
      if (ts.isFunctionDeclaration(current)) {
        return current;
      }
      if (isFunctionScope(current)) {
        return undefined;
      }
      current = current.parent;
    }
    return undefined;
  };
  const recordMutation = (node: ts.Node): void => {
    const container = enclosingNamedFunction(node);
    if (container === undefined) {
      mark(node);
      return;
    }
    const mutations = namedFunctionMutations.get(container) ?? [];
    mutations.push(node);
    namedFunctionMutations.set(container, mutations);
  };
  const visit = (node: ts.Node): void => {
    const position = node.getStart(source);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      isPotentialArrayPrototypeJoinMutation(
        node.left,
        source,
        bindings,
        position,
      )
    ) {
      recordMutation(node);
    }
    if (
      ts.isDeleteExpression(node) &&
      isPotentialArrayPrototypeJoinMutation(
        node.expression,
        source,
        bindings,
        position,
      )
    ) {
      recordMutation(node);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        isArrayPrototypeReference(callee.expression, source, bindings, position)
      ) {
        recordMutation(node);
      }
      if (
        node.arguments.some(
          (argument) =>
            !ts.isSpreadElement(argument) &&
            isArrayPrototypeReference(argument, source, bindings, position),
        )
      ) {
        recordMutation(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  for (const [container, mutations] of namedFunctionMutations) {
    const firstMutation = Math.min(
      ...mutations.map((mutation) => mutation.getStart(source)),
    );
    const laterLocalJoins: ts.CallExpression[] = [];
    const findLaterJoin = (node: ts.Node): void => {
      if (laterLocalJoins.length > 0) {
        return;
      }
      if (node !== container && isFunctionScope(node)) {
        return;
      }
      if (
        ts.isCallExpression(node) &&
        node.getStart(source) > firstMutation &&
        joinMember(node.expression) !== undefined
      ) {
        laterLocalJoins.push(node);
        return;
      }
      ts.forEachChild(node, findLaterJoin);
    };
    findLaterJoin(container);
    if (laterLocalJoins.length > 0) {
      mark(mutations[0] ?? container);
    }
  }

  const visitCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = unwrapStaticExpression(node.expression);
      if (ts.isIdentifier(callee)) {
        const binding = visibleLexicalValueBinding(
          callee.text,
          node.getStart(source),
          source,
          bindings,
        );
        if (
          binding !== undefined &&
          ts.isFunctionDeclaration(binding.declaration) &&
          namedFunctionMutations.has(binding.declaration)
        ) {
          mark(node);
        }
      }
    }
    ts.forEachChild(node, visitCalls);
  };
  visitCalls(source);
  return earliest;
}

function invalidateMutableArrayConstants(
  source: ts.SourceFile,
  constants: Map<string, ts.Expression | null>,
): void {
  const arrays = new Set<string>();
  for (const [name, initializer] of constants) {
    if (
      initializer !== null &&
      evaluateConstantValue(initializer, { constants, nodes: 0 })?.kind ===
        "array"
    ) {
      arrays.add(name);
    }
  }
  const aliases = new Map<string, Set<string>>();
  for (const name of arrays) {
    aliases.set(name, new Set());
  }
  for (const [name, initializer] of constants) {
    if (initializer === null || !arrays.has(name)) {
      continue;
    }
    const target = referencedIdentifier(initializer);
    if (target !== undefined && arrays.has(target)) {
      aliases.get(name)?.add(target);
      aliases.get(target)?.add(name);
    }
  }
  const unsafe = new Set<string>();
  const mark = (name: string | undefined): void => {
    if (name !== undefined && arrays.has(name)) {
      unsafe.add(name);
    }
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      mark(mutationRootIdentifier(node.left));
    } else if (
      ts.isPrefixUnaryExpression(node) ||
      ts.isPostfixUnaryExpression(node)
    ) {
      mark(mutationRootIdentifier(node.operand));
    } else if (ts.isDeleteExpression(node)) {
      mark(mutationRootIdentifier(node.expression));
    }
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression)) {
        if (ARRAY_MUTATING_METHODS.has(node.expression.name.text)) {
          mark(mutationRootIdentifier(node.expression.expression));
        }
      } else if (
        ts.isElementAccessExpression(node.expression) &&
        ts.isStringLiteralLike(node.expression.argumentExpression) &&
        ARRAY_MUTATING_METHODS.has(node.expression.argumentExpression.text)
      ) {
        mark(mutationRootIdentifier(node.expression.expression));
      }
      for (const argument of node.arguments) {
        if (!ts.isSpreadElement(argument)) {
          mark(referencedIdentifier(argument));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const queue = [...unsafe];
  while (queue.length > 0) {
    const name = queue.shift();
    if (name === undefined) {
      continue;
    }
    for (const alias of aliases.get(name) ?? []) {
      if (!unsafe.has(alias)) {
        unsafe.add(alias);
        queue.push(alias);
      }
    }
  }
  for (const name of unsafe) {
    constants.set(name, null);
  }
}

function inspectTypeScript(
  text: string,
  deprecated: ReadonlySet<string>,
  file: string,
  sourcePath: string,
  issues: PlatformVersionIssue[],
): void {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const parseDiagnostics = (
    source as ts.SourceFile & {
      readonly parseDiagnostics: readonly ts.Diagnostic[];
    }
  ).parseDiagnostics;
  if (parseDiagnostics.length > 0) {
    issues.push({
      code: "PLATFORM_TYPESCRIPT_PARSE",
      file,
      field: "/",
      detail: "TypeScript producer source does not parse",
    });
    return;
  }
  const constants = new Map<string, ts.Expression | null>();
  const constantCandidates = new Map<string, ts.Expression[]>();
  const collectConstants = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      node.parent.flags & ts.NodeFlags.Const
    ) {
      const candidates = constantCandidates.get(node.name.text) ?? [];
      candidates.push(node.initializer);
      constantCandidates.set(node.name.text, candidates);
      constants.set(
        node.name.text,
        constants.has(node.name.text) ? null : node.initializer,
      );
    }
    ts.forEachChild(node, collectConstants);
  };
  collectConstants(source);
  invalidateMutableArrayConstants(source, constants);
  const lexicalBindings = collectLexicalValueBindings(source);
  const arrayJoinIntrinsicOverrideOffset = hasArrayPrototypeJoinOverride(
    source,
    lexicalBindings,
  );
  const assignedSelections = new Map<
    string,
    {
      readonly members: Map<string, unknown>;
      hasAliasMember: boolean;
      hasVersionMember: boolean;
      unresolvedMember: boolean;
      readonly field: string;
    }
  >();
  const collectAssignedSelections = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const target = unwrapStaticExpression(node.left);
      if (
        (ts.isPropertyAccessExpression(target) ||
          ts.isElementAccessExpression(target)) &&
        ts.isIdentifier(unwrapStaticExpression(target.expression))
      ) {
        const receiver = unwrapStaticExpression(target.expression);
        const name = evaluatedMemberName(
          target,
          constants,
          arrayJoinIntrinsicOverrideOffset,
        );
        const isAliasMember =
          name !== undefined &&
          ["root", "alias", "schema_alias"].includes(name);
        const isVersionMember =
          name !== undefined && ["version", "major"].includes(name);
        if (
          ts.isIdentifier(receiver) &&
          (isAliasMember || isVersionMember) &&
          executionContainer(node) === source
        ) {
          const binding = visibleLexicalValueBinding(
            receiver.text,
            node.getStart(source),
            source,
            lexicalBindings,
          );
          const key = `${receiver.text}:${String(
            binding?.declarationStart ?? -1,
          )}`;
          const selection = assignedSelections.get(key) ?? {
            members: new Map<string, unknown>(),
            hasAliasMember: false,
            hasVersionMember: false,
            unresolvedMember: false,
            field: `/offset/${String(node.getStart(source))}`,
          };
          const evaluated = evaluateConstantValue(node.right, {
            constants,
            arrayJoinIntrinsicOverrideOffset,
            nodes: 0,
          });
          selection.hasAliasMember ||= isAliasMember;
          selection.hasVersionMember ||= isVersionMember;
          selection.unresolvedMember ||= evaluated === undefined;
          selection.members.set(name, aliasScalar(evaluated));
          assignedSelections.set(key, selection);
        }
      }
    }
    ts.forEachChild(node, collectAssignedSelections);
  };
  collectAssignedSelections(source);
  for (const selection of assignedSelections.values()) {
    const before = issues.length;
    inspectAliasSelection(
      selection.members,
      deprecated,
      file,
      selection.field,
      issues,
    );
    if (
      issues.length === before &&
      selection.hasAliasMember &&
      selection.hasVersionMember &&
      selection.unresolvedMember
    ) {
      issues.push({
        code: "PLATFORM_SCHEMA_EXPRESSION_UNRESOLVED",
        file,
        field: selection.field,
        detail:
          "schema-looking TypeScript producer expression cannot be resolved to a reviewed constant",
      });
    }
  }
  const reportedEvaluations = new Set<string>();
  const reportedUnresolved = new Set<number>();
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      inspectTypeScriptAliasObject(
        node,
        constants,
        arrayJoinIntrinsicOverrideOffset,
        deprecated,
        file,
        `/offset/${String(node.getStart(source))}`,
        issues,
      );
    }
    if (ts.isExpression(node)) {
      const evaluated = evaluateConstantValue(node, {
        constants,
        arrayJoinIntrinsicOverrideOffset,
        nodes: 0,
      });
      if (evaluated?.kind === "string") {
        const key = `${String(node.getStart(source))}:${evaluated.value}`;
        if (!reportedEvaluations.has(key)) {
          reportedEvaluations.add(key);
          inspectStringRepresentation(
            evaluated.value,
            deprecated,
            file,
            `/offset/${String(node.getStart(source))}`,
            issues,
          );
        }
      } else if (
        evaluated === undefined &&
        ((isUnresolvedExpressionBoundary(node) &&
          expressionLooksSchemaLike(node, source, constantCandidates) &&
          !isSchemaParameterCall(node, source, lexicalBindings)) ||
          hasSchemaDestinationContext(
            node,
            source,
            lexicalBindings,
            sourcePath,
            constants,
            arrayJoinIntrinsicOverrideOffset,
            deprecated,
          ))
      ) {
        const offset = node.getStart(source);
        if (!reportedUnresolved.has(offset)) {
          reportedUnresolved.add(offset);
          issues.push({
            code: "PLATFORM_SCHEMA_EXPRESSION_UNRESOLVED",
            file,
            field: `/offset/${String(offset)}`,
            detail:
              "schema-looking TypeScript producer expression cannot be resolved to a reviewed constant",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

export function scanForDeprecatedPlatformV1(
  root: string,
): PlatformVersionReport {
  return scanForDeprecatedPlatformV1Internal(root, new Set());
}

function scanForDeprecatedPlatformV1Internal(
  root: string,
  excludedTopLevel: ReadonlySet<string>,
): PlatformVersionReport {
  const issues: PlatformVersionIssue[] = [];
  let deprecatedRoots: string[];
  try {
    deprecatedRoots = discoverDeprecatedRoots();
  } catch {
    issues.push({
      code: "PLATFORM_SCHEMA_IO",
      file: ".",
      field: "/",
      detail: "reviewed platform schema pairs cannot be inspected",
    });
    return { valid: false, deprecatedRoots: [], filesScanned: 0, issues };
  }
  const deprecated = new Set(deprecatedRoots);
  let rootReal: string;
  try {
    const stats = lstatSync(root);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error("invalid root");
    }
    rootReal = realpathSync(root);
  } catch {
    issues.push({
      code: "PLATFORM_SCAN_ROOT",
      file: ".",
      field: "/",
      detail: "scan root must be a regular directory",
    });
    return { valid: false, deprecatedRoots, filesScanned: 0, issues };
  }
  const files = walkFiles(rootReal, rootReal, issues, excludedTopLevel);
  let scanned = 0;
  for (const path of files) {
    const file = safePath(rootReal, path);
    inspectStringRepresentation(
      relative(rootReal, path).split(sep).join("/"),
      deprecated,
      file,
      "/@path",
      issues,
    );
    let stats;
    try {
      stats = lstatSync(path);
    } catch {
      issues.push({
        code: "PLATFORM_SCAN_IO",
        file,
        field: "/",
        detail: "file identity cannot be sampled",
      });
      continue;
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      issues.push({
        code: "PLATFORM_SCAN_SYMLINK",
        file,
        field: "/",
        detail: "scanned entry is no longer a regular nonsymlink file",
      });
      continue;
    }
    if (stats.size > MAX_SCAN_BYTES) {
      issues.push({
        code: "PLATFORM_SCAN_SIZE",
        file,
        field: "/",
        detail: "file exceeds the scan ceiling",
      });
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch {
      issues.push({
        code: "PLATFORM_SCAN_IO",
        file,
        field: "/",
        detail: "file cannot be read",
      });
      continue;
    }
    let afterStats;
    try {
      afterStats = lstatSync(path);
    } catch {
      issues.push({
        code: "PLATFORM_SCAN_IO",
        file,
        field: "/",
        detail: "file identity cannot be resampled",
      });
      continue;
    }
    if (
      afterStats.isSymbolicLink() ||
      !afterStats.isFile() ||
      afterStats.dev !== stats.dev ||
      afterStats.ino !== stats.ino ||
      afterStats.size !== stats.size ||
      afterStats.mtimeMs !== stats.mtimeMs
    ) {
      issues.push({
        code: "PLATFORM_SCAN_IO",
        file,
        field: "/",
        detail: "file identity changed during the bounded read",
      });
      continue;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      issues.push({
        code: "PLATFORM_SCAN_ENCODING",
        file,
        field: "/",
        detail: "file is not strict UTF-8",
      });
      continue;
    }
    scanned += 1;
    if (extname(path) === ".json") {
      try {
        inspectJson(parseStrictJson(text), deprecated, file, "", issues);
      } catch {
        issues.push({
          code: "PLATFORM_SCAN_JSON",
          file,
          field: "/",
          detail: "JSON is not strict or contains duplicate keys",
        });
      }
    } else if (extname(path) === ".ts") {
      inspectTypeScript(text, deprecated, file, path, issues);
    } else {
      const lines = text.split(/\r?\n/u);
      lines.forEach((line, index) => {
        inspectStringRepresentation(
          line,
          deprecated,
          file,
          pointerAt("/line", index + 1),
          issues,
        );
      });
      for (let index = 0; index + 1 < lines.length; index += 1) {
        const first = lines[index];
        const second = lines[index + 1];
        if (first === undefined || second === undefined) {
          continue;
        }
        const adjacent = `${first}\n${second}`;
        if (collapsePlatformLineBreaks(adjacent) === undefined) {
          continue;
        }
        inspectStringRepresentation(
          adjacent,
          deprecated,
          file,
          `${pointerAt("/line", index + 1)}/@continuation`,
          issues,
        );
      }
    }
  }
  return {
    valid: issues.length === 0,
    deprecatedRoots,
    filesScanned: scanned,
    issues,
  };
}

export function scanCommittedPlatformVersions(): PlatformVersionReport {
  return scanForDeprecatedPlatformV1Internal(
    PACKAGE_ROOT,
    new Set([".turbo", "node_modules", "src", "test"]),
  );
}

export function assertCommittedPlatformVersions(): PlatformVersionReport {
  const report = scanCommittedPlatformVersions();
  if (!report.valid) {
    throw new PlatformVersionGuardError(report.issues);
  }
  return report;
}
