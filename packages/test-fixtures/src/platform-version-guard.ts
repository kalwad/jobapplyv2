import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  type Dirent,
} from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { safeDiagnosticPath } from "./diagnostics.ts";
import { parseStrictJson } from "./strict-json.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PLATFORM_SCHEMA_ROOT = fileURLToPath(
  new URL("../../contracts/schemas/platform/", import.meta.url),
);
const DEPRECATED_V1_REFERENCE =
  /\burn:japp:schema:platform:[a-z][a-z0-9-]*:v1\b/gu;
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

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
  return safeDiagnosticPath(value) || ".";
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
    value.forEach((item, index) => {
      inspectJson(item, deprecated, file, pointerAt(pointer, index), issues);
    });
  } else if (typeof value === "object" && value !== null) {
    const object = value as Record<string, unknown>;
    const alias = object.schema_alias;
    const major = object.major;
    if (
      typeof alias === "string" &&
      major === "v1" &&
      [...deprecated].some(
        (root) => root === `urn:japp:schema:platform:${alias}:v1`,
      )
    ) {
      issues.push({
        code: "DEPRECATED_PLATFORM_V1_ALIAS",
        file,
        field: pointer === "" ? "/" : pointer,
        detail:
          "new M02 producer surface selects a deprecated platform alias/major pair",
      });
    }
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
  DEPRECATED_V1_REFERENCE.lastIndex = 0;
  for (const match of value.matchAll(DEPRECATED_V1_REFERENCE)) {
    if (deprecated.has(match[0])) {
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
    const alias = root.slice("urn:japp:schema:platform:".length, -":v1".length);
    if (
      value.includes(`${alias}.v1.schema.json`) ||
      value.includes(`${alias}.v1.schema`)
    ) {
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

interface ConstantEvaluationContext {
  readonly constants: ReadonlyMap<string, ts.Expression>;
  nodes: number;
}

function evaluateConstantString(
  expression: ts.Expression,
  context: ConstantEvaluationContext,
  depth = 0,
): string | undefined {
  context.nodes += 1;
  if (depth > 16 || context.nodes > 256) {
    return undefined;
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text.length <= 4096 ? expression.text : undefined;
  }
  if (ts.isParenthesizedExpression(expression)) {
    return evaluateConstantString(expression.expression, context, depth + 1);
  }
  if (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return evaluateConstantString(expression.expression, context, depth + 1);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = evaluateConstantString(expression.left, context, depth + 1);
    const right = evaluateConstantString(expression.right, context, depth + 1);
    if (left === undefined || right === undefined) {
      return undefined;
    }
    const combined = left + right;
    return combined.length <= 4096 ? combined : undefined;
  }
  if (ts.isIdentifier(expression)) {
    const initializer = context.constants.get(expression.text);
    return initializer === undefined
      ? undefined
      : evaluateConstantString(initializer, context, depth + 1);
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      const part = evaluateConstantString(span.expression, context, depth + 1);
      if (part === undefined) {
        return undefined;
      }
      value += part + span.literal.text;
      if (value.length > 4096) {
        return undefined;
      }
    }
    return value;
  }
  return undefined;
}

function inspectTypeScript(
  text: string,
  deprecated: ReadonlySet<string>,
  file: string,
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
  const constants = new Map<string, ts.Expression>();
  const resolution = { complete: false };
  const collect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      node.parent.flags & ts.NodeFlags.Const
    ) {
      constants.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  const reported = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isExpression(node)) {
      const evaluated = evaluateConstantString(node, {
        constants,
        nodes: 0,
      });
      if (evaluated !== undefined) {
        if (
          /\burn:japp:schema:platform:[a-z][a-z0-9-]*:v[0-9]+\b|[a-z][a-z0-9-]*\.v[0-9]+\.schema(?:\.json)?\b/u.test(
            evaluated,
          )
        ) {
          resolution.complete = true;
        }
        const before = issues.length;
        inspectStringRepresentation(
          evaluated,
          deprecated,
          file,
          `/offset/${String(node.getStart(source))}`,
          issues,
        );
        if (issues.length > before) {
          const key = `${String(node.getStart(source))}:${evaluated}`;
          if (reported.has(key)) {
            issues.splice(before);
          } else {
            reported.add(key);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (
    /urn:japp:schema:platform:|\.v1\.schema/u.test(text) &&
    !resolution.complete &&
    !issues.some((issue) => issue.file === file)
  ) {
    issues.push({
      code: "PLATFORM_SCHEMA_EXPRESSION_UNRESOLVED",
      file,
      field: "/",
      detail:
        "schema-looking TypeScript producer expression cannot be resolved to a reviewed constant",
    });
  }
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
  const deprecatedRoots = discoverDeprecatedRoots();
  const deprecated = new Set(deprecatedRoots);
  const issues: PlatformVersionIssue[] = [];
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
    const stats = lstatSync(path);
    if (stats.size > MAX_SCAN_BYTES) {
      issues.push({
        code: "PLATFORM_SCAN_SIZE",
        file,
        field: "/",
        detail: "file exceeds the scan ceiling",
      });
      continue;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        readFileSync(path),
      );
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
      inspectTypeScript(text, deprecated, file, issues);
    } else {
      text.split("\n").forEach((line, index) => {
        inspectStringRepresentation(
          line,
          deprecated,
          file,
          pointerAt("/line", index + 1),
          issues,
        );
      });
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
