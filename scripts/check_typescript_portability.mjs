#!/usr/bin/env node
// Syntax-aware PORT-SRC-008 helper. Python owns policy orchestration; this
// Node boundary uses the repository-pinned TypeScript compiler and never
// executes repository source.
//
// The policy has two deliberately separate layers:
// 1. A bounded evaluator resolves only an allowlisted primitive-constant AST
//    subset. Unsupported, mutable, cyclic, or over-budget expressions are
//    UNKNOWN.
// 2. Operational analysis consumes those facts. At the finite initializer,
//    property, array, return/yield/arrow, export, JSX, plain-assignment, and
//    call/new-argument roots below, a complete string is relevant only when it
//    begins with a banned absolute system path or exact shell-wrapper command.
//    Embedded fragments require proved ESM or bounded .cts CommonJS provenance
//    plus a closed Node module/operation/argument-position signature. Payload,
//    encoding, callback, and operations without signatures are not embedded
//    sinks. Composed descriptive values are evaluated as a whole; their
//    component literals are not separately read.
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const BANNED_PATH = /(?<![\w:/#.-])\/(tmp|bin|usr|etc|var)(?![\w.-])/;
const DIRECT_BANNED_PATH = /^\/(tmp|bin|usr|etc|var)(?:\/|$)/;
const DIRECT_WRAPPER_PATTERNS = [
  { pattern: /^bash[ \t]+-(lc|c)(?=$|[ \t])/, shell: "bash" },
  { pattern: /^sh[ \t]+-(c)(?=$|[ \t])/, shell: "sh" },
];
const EMBEDDED_WRAPPER_PATTERNS = [
  {
    pattern: /(?:^|[ \t\r\n;&|(])bash[ \t]+-(lc|c)(?=$|[ \t])/,
    shell: "bash",
  },
  {
    pattern: /(?:^|[ \t\r\n;&|(])sh[ \t]+-(c)(?=$|[ \t])/,
    shell: "sh",
  },
];
const UNKNOWN = Symbol("unknown");
const MAX_EVALUATION_DEPTH = 64;
const MAX_EVALUATION_STEPS = 512;
const MAX_CONSTANT_STRING_LENGTH = 16_384;
const MAX_STRUCTURAL_DEPTH = 64;

const OPERATIONAL_MODULES = new Map([
  ["child_process", "child-process"],
  ["node:child_process", "child-process"],
  ["fs", "filesystem"],
  ["fs/promises", "filesystem"],
  ["node:fs", "filesystem"],
  ["node:fs/promises", "filesystem"],
  ["path", "path"],
  ["node:path", "path"],
  ["process", "process"],
  ["node:process", "process"],
]);
const NAMESPACE_NAMED_IMPORTS = new Set(["posix", "promises", "win32"]);
const CHILD_PROCESS_ARGUMENTS = new Map([
  ["exec", { values: [0], arrays: [], options: [1] }],
  ["execSync", { values: [0], arrays: [], options: [1] }],
  ["execFile", { values: [0], arrays: [1], options: [1, 2] }],
  ["execFileSync", { values: [0], arrays: [1], options: [1, 2] }],
  ["spawn", { values: [0], arrays: [1], options: [1, 2] }],
  ["spawnSync", { values: [0], arrays: [1], options: [1, 2] }],
  ["fork", { values: [0], arrays: [1], options: [1, 2] }],
]);
const CHILD_PROCESS_OPTION_PROPERTIES = new Set([
  "argv0",
  "cwd",
  "execArgv",
  "execPath",
  "shell",
]);
const SHELL_ARGV_OPERATIONS = new Set([
  "execFile",
  "execFileSync",
  "spawn",
  "spawnSync",
]);
const FILESYSTEM_PATH_ARGUMENTS = new Map([
  ...[
    "access",
    "accessSync",
    "appendFile",
    "appendFileSync",
    "chmod",
    "chmodSync",
    "chown",
    "chownSync",
    "createReadStream",
    "createWriteStream",
    "exists",
    "existsSync",
    "glob",
    "globSync",
    "lchmod",
    "lchmodSync",
    "lchown",
    "lchownSync",
    "lstat",
    "lstatSync",
    "lutimes",
    "lutimesSync",
    "mkdir",
    "mkdirSync",
    "mkdtemp",
    "mkdtempSync",
    "open",
    "openAsBlob",
    "openSync",
    "opendir",
    "opendirSync",
    "readFile",
    "readFileSync",
    "readdir",
    "readdirSync",
    "readlink",
    "readlinkSync",
    "realpath",
    "realpathSync",
    "rm",
    "rmSync",
    "rmdir",
    "rmdirSync",
    "stat",
    "statSync",
    "statfs",
    "statfsSync",
    "truncate",
    "truncateSync",
    "unlink",
    "unlinkSync",
    "unwatchFile",
    "utimes",
    "utimesSync",
    "watch",
    "watchFile",
    "writeFile",
    "writeFileSync",
  ].map((operation) => [operation, [0]]),
  ...[
    "copyFile",
    "copyFileSync",
    "cp",
    "cpSync",
    "link",
    "linkSync",
    "rename",
    "renameSync",
    "symlink",
    "symlinkSync",
  ].map((operation) => [operation, [0, 1]]),
]);
const PATH_ALL_ARGUMENT_OPERATIONS = new Set(["join", "resolve"]);
const PATH_ARGUMENTS = new Map([
  ...[
    "basename",
    "dirname",
    "extname",
    "isAbsolute",
    "normalize",
    "parse",
    "toNamespacedPath",
  ].map((operation) => [operation, [0]]),
  ["matchesGlob", [0, 1]],
  ["relative", [0, 1]],
]);
const PATH_FORMAT_PROPERTIES = new Set(["base", "dir", "ext", "name", "root"]);
const PROCESS_PATH_ARGUMENTS = new Map([
  ["chdir", [0]],
  ["dlopen", [1]],
  ["loadEnvFile", [0]],
]);

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function constInitializerFromSymbol(symbol) {
  const declaration = symbol?.valueDeclaration;
  if (
    declaration === undefined ||
    !ts.isVariableDeclaration(declaration) ||
    !ts.isIdentifier(declaration.name) ||
    declaration.initializer === undefined ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    (declaration.parent.flags & ts.NodeFlags.Const) === 0
  ) {
    return null;
  }
  return { declaration, initializer: declaration.initializer };
}

function constInitializer(identifier, checker, symbolOverride) {
  return constInitializerFromSymbol(
    symbolOverride ?? checker.getSymbolAtLocation(identifier),
  );
}

function boundedString(value) {
  return value.length <= MAX_CONSTANT_STRING_LENGTH ? value : UNKNOWN;
}

function primitiveTruth(value) {
  if (value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length !== 0;
  return UNKNOWN;
}

function childState(state, declaration) {
  const seen = new Set(state.seen);
  if (declaration !== undefined) seen.add(declaration);
  return {
    budget: state.budget,
    depth: state.depth + 1,
    seen,
  };
}

function evaluateBinary(node, checker, state) {
  const left = evaluateConstant(node.left, checker, childState(state));
  if (left === UNKNOWN) return UNKNOWN;
  const operator = node.operatorToken.kind;

  if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
    const truth = primitiveTruth(left);
    return truth === UNKNOWN || truth
      ? truth === UNKNOWN
        ? UNKNOWN
        : evaluateConstant(node.right, checker, childState(state))
      : left;
  }
  if (operator === ts.SyntaxKind.BarBarToken) {
    const truth = primitiveTruth(left);
    return truth === UNKNOWN || !truth
      ? truth === UNKNOWN
        ? UNKNOWN
        : evaluateConstant(node.right, checker, childState(state))
      : left;
  }
  if (operator === ts.SyntaxKind.QuestionQuestionToken) {
    return left === null
      ? evaluateConstant(node.right, checker, childState(state))
      : left;
  }

  const right = evaluateConstant(node.right, checker, childState(state));
  if (right === UNKNOWN) return UNKNOWN;
  if (operator === ts.SyntaxKind.PlusToken) {
    if (typeof left === "string" || typeof right === "string") {
      return boundedString(String(left) + String(right));
    }
    if (typeof left === "number" && typeof right === "number") {
      const result = left + right;
      return Number.isFinite(result) ? result : UNKNOWN;
    }
    return UNKNOWN;
  }
  if (operator === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
  if (operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return left !== right;
  }
  if (
    (typeof left === "number" && typeof right === "number") ||
    (typeof left === "string" && typeof right === "string")
  ) {
    if (operator === ts.SyntaxKind.LessThanToken) return left < right;
    if (operator === ts.SyntaxKind.LessThanEqualsToken) return left <= right;
    if (operator === ts.SyntaxKind.GreaterThanToken) return left > right;
    if (operator === ts.SyntaxKind.GreaterThanEqualsToken) return left >= right;
  }
  if (typeof left !== "number" || typeof right !== "number") return UNKNOWN;

  let result;
  if (operator === ts.SyntaxKind.MinusToken) result = left - right;
  else if (operator === ts.SyntaxKind.AsteriskToken) result = left * right;
  else if (operator === ts.SyntaxKind.AsteriskAsteriskToken)
    result = left ** right;
  else if (operator === ts.SyntaxKind.SlashToken) result = left / right;
  else if (operator === ts.SyntaxKind.PercentToken) result = left % right;
  else return UNKNOWN;
  return Number.isFinite(result) ? result : UNKNOWN;
}

function evaluateConstant(
  node,
  checker,
  state = { budget: { steps: 0 }, depth: 0, seen: new Set() },
  symbolOverride,
) {
  if (
    state.depth > MAX_EVALUATION_DEPTH ||
    state.budget.steps >= MAX_EVALUATION_STEPS
  ) {
    return UNKNOWN;
  }
  state.budget.steps += 1;
  const current = unwrapExpression(node);

  if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (current.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return boundedString(current.text);
  }
  if (ts.isNumericLiteral(current)) {
    const value = Number(current.text.replaceAll("_", ""));
    return Number.isFinite(value) ? value : UNKNOWN;
  }
  if (ts.isTemplateExpression(current)) {
    let value = current.head.text;
    for (const span of current.templateSpans) {
      const expression = evaluateConstant(
        span.expression,
        checker,
        childState(state),
      );
      if (expression === UNKNOWN) return UNKNOWN;
      value += String(expression) + span.literal.text;
      if (value.length > MAX_CONSTANT_STRING_LENGTH) return UNKNOWN;
    }
    return value;
  }
  if (ts.isPrefixUnaryExpression(current)) {
    const operand = evaluateConstant(
      current.operand,
      checker,
      childState(state),
    );
    if (operand === UNKNOWN) return UNKNOWN;
    if (current.operator === ts.SyntaxKind.ExclamationToken) {
      const truth = primitiveTruth(operand);
      return truth === UNKNOWN ? UNKNOWN : !truth;
    }
    if (typeof operand !== "number") return UNKNOWN;
    if (current.operator === ts.SyntaxKind.PlusToken) return operand;
    if (current.operator === ts.SyntaxKind.MinusToken) return -operand;
    if (current.operator === ts.SyntaxKind.TildeToken) return ~operand;
    return UNKNOWN;
  }
  if (ts.isBinaryExpression(current)) {
    return evaluateBinary(current, checker, state);
  }
  if (ts.isConditionalExpression(current)) {
    const condition = evaluateConstant(
      current.condition,
      checker,
      childState(state),
    );
    if (condition === UNKNOWN) return UNKNOWN;
    const truth = primitiveTruth(condition);
    if (truth === UNKNOWN) return UNKNOWN;
    return evaluateConstant(
      truth ? current.whenTrue : current.whenFalse,
      checker,
      childState(state),
    );
  }
  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker, symbolOverride);
    if (resolved === null || state.seen.has(resolved.declaration)) {
      return UNKNOWN;
    }
    return evaluateConstant(
      resolved.initializer,
      checker,
      childState(state, resolved.declaration),
    );
  }
  return UNKNOWN;
}

function propertyNameValue(name, checker) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const value = evaluateConstant(name.expression, checker);
    return value === UNKNOWN ? UNKNOWN : String(value);
  }
  return UNKNOWN;
}

function isTypeOnly(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      ts.isTypeNode(current) ||
      ts.isInterfaceDeclaration(current) ||
      ts.isTypeAliasDeclaration(current)
    ) {
      return true;
    }
    if (ts.isStatement(current)) return false;
  }
  return false;
}

function isDocumentationExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent) ||
    ts.isTypeAssertionExpression(current.parent) ||
    ts.isNonNullExpression(current.parent)
  ) {
    current = current.parent;
  }
  return ts.isExpressionStatement(current.parent);
}

function isCompositionChild(node) {
  const parent = node.parent;
  if (
    (ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isTypeAssertionExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isPrefixUnaryExpression(parent)) &&
    parent.expression === node
  ) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(parent) && parent.operand === node)
    return true;
  if (
    ts.isBinaryExpression(parent) &&
    (parent.left === node || parent.right === node)
  ) {
    if (
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      parent.right === node
    ) {
      return false;
    }
    return true;
  }
  if (
    ts.isConditionalExpression(parent) &&
    (parent.condition === node ||
      parent.whenTrue === node ||
      parent.whenFalse === node)
  ) {
    return true;
  }
  if (ts.isTemplateSpan(parent) && parent.expression === node) return true;
  if (ts.isTaggedTemplateExpression(parent) && parent.template === node)
    return true;
  if (ts.isComputedPropertyName(parent) && parent.expression === node)
    return true;
  return false;
}

function isDirectOperationalValueRoot(node) {
  if (isCompositionChild(node)) return false;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node)
    return true;
  if (ts.isParameter(parent) && parent.initializer === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.initializer === node)
    return true;
  if (ts.isPropertyDeclaration(parent) && parent.initializer === node)
    return true;
  if (ts.isEnumMember(parent) && parent.initializer === node) return true;
  if (ts.isArrayLiteralExpression(parent)) return true;
  if (ts.isReturnStatement(parent) && parent.expression === node) return true;
  if (ts.isYieldExpression(parent) && parent.expression === node) return true;
  if (ts.isArrowFunction(parent) && parent.body === node) return true;
  if (ts.isExportAssignment(parent) && parent.expression === node) return true;
  if (ts.isJsxAttribute(parent) && parent.initializer === node) return true;
  if (ts.isJsxExpression(parent) && parent.expression === node) return true;
  if (
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    parent.arguments?.includes(node)
  ) {
    return true;
  }
  return (
    ts.isBinaryExpression(parent) &&
    parent.right === node &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function addStringFindings(
  findings,
  relativePath,
  source,
  node,
  value,
  embedded,
) {
  const pathMatch = embedded
    ? value.match(BANNED_PATH)
    : value.trimStart().match(DIRECT_BANNED_PATH);
  if (pathMatch) {
    findings.push({
      path: relativePath,
      line: lineOf(source, node),
      kind: "posix-path",
      detail: `/${pathMatch[1]}`,
    });
  }
  const wrapper = shellWrapperDetail(value, embedded);
  if (wrapper !== null) {
    findings.push({
      path: relativePath,
      line: lineOf(source, node),
      kind: "shell-wrapper",
      detail: wrapper,
    });
  }
}

function shellWrapperDetail(value, embedded) {
  const candidate = embedded ? value : value.trimStart();
  const patterns = embedded
    ? EMBEDDED_WRAPPER_PATTERNS
    : DIRECT_WRAPPER_PATTERNS;
  for (const { pattern, shell } of patterns) {
    const match = candidate.match(pattern);
    if (match !== null) return `${shell} -${match[1]}`;
  }
  return null;
}

function moduleKind(specifier) {
  return OPERATIONAL_MODULES.get(specifier);
}

function requireModuleKind(node, checker, allowCommonJs) {
  const current = unwrapExpression(node);
  if (
    !allowCommonJs ||
    !ts.isCallExpression(current) ||
    !ts.isIdentifier(current.expression) ||
    current.expression.text !== "require" ||
    current.arguments.length !== 1 ||
    !ts.isStringLiteral(current.arguments[0])
  ) {
    return undefined;
  }
  const symbol = checker.getSymbolAtLocation(current.expression);
  if (
    symbol?.declarations?.some(
      (declaration) => !declaration.getSourceFile().isDeclarationFile,
    )
  ) {
    return undefined;
  }
  return moduleKind(current.arguments[0].text);
}

function collectSinkBindings(source, checker) {
  const direct = new Map();
  const namespaces = new Map();
  const allowCommonJs = source.fileName.toLowerCase().endsWith(".cts");
  for (const statement of source.statements) {
    if (
      allowCommonJs &&
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression !== undefined &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      const kind = moduleKind(statement.moduleReference.expression.text);
      const symbol = checker.getSymbolAtLocation(statement.name);
      if (kind !== undefined && symbol !== undefined) {
        namespaces.set(symbol, kind);
      }
      continue;
    }
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const kind = moduleKind(statement.moduleSpecifier.text);
    const clause = statement.importClause;
    if (kind === undefined || clause === undefined || clause.isTypeOnly)
      continue;
    if (clause.name !== undefined) {
      const symbol = checker.getSymbolAtLocation(clause.name);
      if (symbol !== undefined) namespaces.set(symbol, kind);
    }
    const bindings = clause.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      const symbol = checker.getSymbolAtLocation(bindings.name);
      if (symbol !== undefined) namespaces.set(symbol, kind);
      continue;
    }
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (symbol === undefined) continue;
      const importedName = (element.propertyName ?? element.name).text;
      if (NAMESPACE_NAMED_IMPORTS.has(importedName)) {
        namespaces.set(symbol, kind);
      } else {
        direct.set(symbol, { kind, operation: importedName });
      }
    }
  }

  if (allowCommonJs) {
    function visitRequireBinding(node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const kind = requireModuleKind(node.initializer, checker, true);
        if (kind !== undefined && ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (
              element.dotDotDotToken !== undefined ||
              !ts.isIdentifier(element.name)
            ) {
              continue;
            }
            const symbol = checker.getSymbolAtLocation(element.name);
            if (symbol === undefined) continue;
            const importedName = ts.isIdentifier(element.propertyName)
              ? element.propertyName.text
              : element.name.text;
            if (NAMESPACE_NAMED_IMPORTS.has(importedName)) {
              namespaces.set(symbol, kind);
            } else {
              direct.set(symbol, { kind, operation: importedName });
            }
          }
        }
      }
      ts.forEachChild(node, visitRequireBinding);
    }
    visitRequireBinding(source);
  }
  return { allowCommonJs, direct, namespaces };
}

function constCalleeInitializer(identifier, checker, seen) {
  const resolved = constInitializer(identifier, checker);
  if (resolved === null || seen.has(resolved.declaration)) return null;
  seen.add(resolved.declaration);
  return resolved.initializer;
}

function namespaceKind(node, checker, bindings, seen = new Set()) {
  const current = unwrapExpression(node);
  const required = requireModuleKind(current, checker, bindings.allowCommonJs);
  if (required !== undefined) return required;
  if (ts.isIdentifier(current)) {
    const symbol = checker.getSymbolAtLocation(current);
    const direct =
      symbol === undefined ? undefined : bindings.namespaces.get(symbol);
    if (direct !== undefined) return direct;
    const initializer = constCalleeInitializer(current, checker, seen);
    return initializer === null
      ? undefined
      : namespaceKind(initializer, checker, bindings, seen);
  }
  if (ts.isPropertyAccessExpression(current)) {
    return namespaceKind(current.expression, checker, bindings, seen);
  }
  return undefined;
}

function resolveSink(node, checker, bindings, seen = new Set()) {
  const current = unwrapExpression(node);
  if (ts.isIdentifier(current)) {
    const symbol = checker.getSymbolAtLocation(current);
    const direct =
      symbol === undefined ? undefined : bindings.direct.get(symbol);
    if (direct !== undefined) return direct;
    const initializer = constCalleeInitializer(current, checker, seen);
    return initializer === null
      ? undefined
      : resolveSink(initializer, checker, bindings, seen);
  }
  if (ts.isPropertyAccessExpression(current)) {
    const kind = namespaceKind(current.expression, checker, bindings);
    return kind === undefined
      ? undefined
      : { kind, operation: current.name.text };
  }
  if (ts.isElementAccessExpression(current) && current.argumentExpression) {
    const kind = namespaceKind(current.expression, checker, bindings);
    const operation = evaluateConstant(current.argumentExpression, checker);
    return kind === undefined || typeof operation !== "string"
      ? undefined
      : { kind, operation };
  }
  return undefined;
}

function inspectOperationalStructure(
  node,
  relativePath,
  source,
  checker,
  findings,
  seen = new Set(),
  depth = 0,
) {
  if (depth > MAX_STRUCTURAL_DEPTH) return;
  const current = unwrapExpression(node);
  const value = evaluateConstant(current, checker);
  if (typeof value === "string") {
    addStringFindings(findings, relativePath, source, node, value, true);
    return;
  }
  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker);
    if (resolved === null || seen.has(resolved.declaration)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(resolved.declaration);
    inspectOperationalStructure(
      resolved.initializer,
      relativePath,
      source,
      checker,
      findings,
      nextSeen,
      depth + 1,
    );
    return;
  }
  if (ts.isArrayLiteralExpression(current)) {
    for (const element of current.elements) {
      if (ts.isSpreadElement(element)) {
        inspectOperationalStructure(
          element.expression,
          relativePath,
          source,
          checker,
          findings,
          seen,
          depth + 1,
        );
      } else if (!ts.isOmittedExpression(element)) {
        inspectOperationalStructure(
          element,
          relativePath,
          source,
          checker,
          findings,
          seen,
          depth + 1,
        );
      }
    }
    return;
  }
  if (!ts.isObjectLiteralExpression(current)) return;
  for (const property of current.properties) {
    if (ts.isPropertyAssignment(property)) {
      inspectOperationalStructure(
        property.initializer,
        relativePath,
        source,
        checker,
        findings,
        seen,
        depth + 1,
      );
    } else if (ts.isShorthandPropertyAssignment(property)) {
      const symbol = checker.getShorthandAssignmentValueSymbol(property);
      const shorthandValue = evaluateConstant(
        property.name,
        checker,
        undefined,
        symbol,
      );
      if (typeof shorthandValue === "string") {
        addStringFindings(
          findings,
          relativePath,
          source,
          property.name,
          shorthandValue,
          true,
        );
      }
    } else if (ts.isSpreadAssignment(property)) {
      inspectOperationalStructure(
        property.expression,
        relativePath,
        source,
        checker,
        findings,
        seen,
        depth + 1,
      );
    }
  }
}

function constantArrayElements(node, checker, seen = new Set(), depth = 0) {
  if (depth > MAX_STRUCTURAL_DEPTH) return null;
  const current = unwrapExpression(node);
  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker);
    if (resolved === null || seen.has(resolved.declaration)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(resolved.declaration);
    return constantArrayElements(
      resolved.initializer,
      checker,
      nextSeen,
      depth + 1,
    );
  }
  if (!ts.isArrayLiteralExpression(current)) return null;
  const elements = [];
  for (const element of current.elements) {
    if (ts.isOmittedExpression(element)) return null;
    if (ts.isSpreadElement(element)) {
      const spread = constantArrayElements(
        element.expression,
        checker,
        seen,
        depth + 1,
      );
      if (spread === null) return null;
      elements.push(...spread);
    } else {
      elements.push(element);
    }
  }
  return elements;
}

function inspectOperationalArray(
  node,
  relativePath,
  source,
  checker,
  findings,
) {
  const elements = constantArrayElements(node, checker);
  if (elements === null) return;
  for (const element of elements) {
    inspectOperationalStructure(
      element,
      relativePath,
      source,
      checker,
      findings,
    );
  }
}

function inspectObjectPropertyValues(
  node,
  names,
  relativePath,
  source,
  checker,
  findings,
  seen = new Set(),
  depth = 0,
) {
  if (depth > MAX_STRUCTURAL_DEPTH) return;
  const current = unwrapExpression(node);
  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker);
    if (resolved === null || seen.has(resolved.declaration)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(resolved.declaration);
    inspectObjectPropertyValues(
      resolved.initializer,
      names,
      relativePath,
      source,
      checker,
      findings,
      nextSeen,
      depth + 1,
    );
    return;
  }
  if (!ts.isObjectLiteralExpression(current)) return;
  for (const property of current.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      names.has(propertyNameValue(property.name, checker))
    ) {
      inspectOperationalStructure(
        property.initializer,
        relativePath,
        source,
        checker,
        findings,
      );
    } else if (
      ts.isShorthandPropertyAssignment(property) &&
      names.has(property.name.text)
    ) {
      const symbol = checker.getShorthandAssignmentValueSymbol(property);
      const value = evaluateConstant(property.name, checker, undefined, symbol);
      if (typeof value === "string") {
        addStringFindings(
          findings,
          relativePath,
          source,
          property.name,
          value,
          true,
        );
      } else {
        const resolved = constInitializer(property.name, checker, symbol);
        if (resolved !== null) {
          inspectOperationalStructure(
            resolved.initializer,
            relativePath,
            source,
            checker,
            findings,
            new Set([resolved.declaration]),
          );
        }
      }
    } else if (ts.isSpreadAssignment(property)) {
      inspectObjectPropertyValues(
        property.expression,
        names,
        relativePath,
        source,
        checker,
        findings,
        seen,
        depth + 1,
      );
    }
  }
}

function inspectSinkArguments(
  call,
  sink,
  relativePath,
  source,
  checker,
  findings,
) {
  const args = call.arguments ?? [];
  const inspectIndices = (indices) => {
    for (const index of indices) {
      const argument = args[index];
      if (argument === undefined) continue;
      inspectOperationalStructure(
        argument,
        relativePath,
        source,
        checker,
        findings,
      );
    }
  };

  if (sink.kind === "child-process") {
    const signature = CHILD_PROCESS_ARGUMENTS.get(sink.operation);
    if (signature === undefined) return;
    inspectIndices(signature.values);
    for (const index of signature.arrays) {
      const argument = args[index];
      if (argument !== undefined) {
        inspectOperationalArray(
          argument,
          relativePath,
          source,
          checker,
          findings,
        );
      }
    }
    for (const index of signature.options) {
      const argument = args[index];
      if (argument !== undefined) {
        inspectObjectPropertyValues(
          argument,
          CHILD_PROCESS_OPTION_PROPERTIES,
          relativePath,
          source,
          checker,
          findings,
        );
      }
    }
    return;
  }
  if (sink.kind === "filesystem") {
    const indices = FILESYSTEM_PATH_ARGUMENTS.get(sink.operation);
    if (indices !== undefined) inspectIndices(indices);
    return;
  }
  if (sink.kind === "path") {
    if (PATH_ALL_ARGUMENT_OPERATIONS.has(sink.operation)) {
      inspectIndices(args.map((_argument, index) => index));
      return;
    }
    const indices = PATH_ARGUMENTS.get(sink.operation);
    if (indices !== undefined) {
      inspectIndices(indices);
    } else if (sink.operation === "format" && args[0] !== undefined) {
      inspectObjectPropertyValues(
        args[0],
        PATH_FORMAT_PROPERTIES,
        relativePath,
        source,
        checker,
        findings,
      );
    }
    return;
  }
  if (sink.kind === "process") {
    const indices = PROCESS_PATH_ARGUMENTS.get(sink.operation);
    if (indices !== undefined) inspectIndices(indices);
  }
}

function inspectShellArgvTuple(
  call,
  sink,
  relativePath,
  source,
  checker,
  findings,
) {
  if (
    sink.kind !== "child-process" ||
    !SHELL_ARGV_OPERATIONS.has(sink.operation) ||
    call.arguments.length < 2
  ) {
    return;
  }
  const command = evaluateConstant(call.arguments[0], checker);
  const argv = constantArrayElements(call.arguments[1], checker);
  if (
    (command !== "bash" && command !== "sh") ||
    argv === null ||
    argv.length === 0
  ) {
    return;
  }
  const flag = evaluateConstant(argv[0], checker);
  if (flag !== "-c" && !(command === "bash" && flag === "-lc")) return;
  findings.push({
    path: relativePath,
    line: lineOf(source, call.arguments[0]),
    kind: "shell-wrapper",
    detail: `${command} ${flag}`,
  });
}

function diagnosticText(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}

function inspect(relativePath, source, program) {
  const diagnostics = program.getSyntacticDiagnostics(source);
  if (diagnostics.length > 0) {
    const rendered = diagnostics.map(diagnosticText).join("; ");
    throw new Error(`${relativePath} is not parseable TypeScript: ${rendered}`);
  }

  const checker = program.getTypeChecker();
  const bindings = collectSinkBindings(source, checker);
  const findings = [];
  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      !isTypeOnly(node) &&
      propertyNameValue(node.name, checker) === "shell" &&
      evaluateConstant(node.initializer, checker) === true
    ) {
      findings.push({
        path: relativePath,
        line: lineOf(source, node.name),
        kind: "shell-true",
        detail: "shell=true",
      });
    }
    if (
      ts.isShorthandPropertyAssignment(node) &&
      !isTypeOnly(node) &&
      node.name.text === "shell"
    ) {
      const symbol = checker.getShorthandAssignmentValueSymbol(node);
      if (evaluateConstant(node.name, checker, undefined, symbol) === true) {
        findings.push({
          path: relativePath,
          line: lineOf(source, node.name),
          kind: "shell-true",
          detail: "shell=true",
        });
      }
    }
    if (
      ts.isExpression(node) &&
      isDirectOperationalValueRoot(node) &&
      !isTypeOnly(node) &&
      !isDocumentationExpression(node)
    ) {
      const value = evaluateConstant(node, checker);
      if (typeof value === "string") {
        addStringFindings(findings, relativePath, source, node, value, false);
      }
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const sink = resolveSink(node.expression, checker, bindings);
      if (sink !== undefined) {
        inspectSinkArguments(
          node,
          sink,
          relativePath,
          source,
          checker,
          findings,
        );
        if (ts.isCallExpression(node)) {
          inspectShellArgvTuple(
            node,
            sink,
            relativePath,
            source,
            checker,
            findings,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const unique = new Map();
  for (const finding of findings) {
    const key = `${finding.path}\0${finding.line}\0${finding.kind}\0${finding.detail}`;
    unique.set(key, finding);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.line - right.line ||
      left.kind.localeCompare(right.kind) ||
      left.detail.localeCompare(right.detail),
  );
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
const paths = JSON.parse(input);
if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
  throw new Error("expected a JSON array of repository-relative paths");
}
const absolutePaths = paths.map((path) => resolve(process.cwd(), path));
const program = ts.createProgram({
  rootNames: absolutePaths,
  options: {
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    noEmit: true,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  },
});
const findings = [];
for (const [index, relativePath] of paths.entries()) {
  const absolutePath = absolutePaths[index];
  const source = program.getSourceFile(absolutePath);
  if (source === undefined) {
    throw new Error(`${relativePath} was not loaded by the TypeScript parser`);
  }
  findings.push(...inspect(relativePath, source, program));
}
process.stdout.write(JSON.stringify(findings));
