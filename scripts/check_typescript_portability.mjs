#!/usr/bin/env node
// Syntax-aware PORT-SRC-008 helper. Python owns policy orchestration; this
// Node boundary uses the repository-pinned TypeScript compiler and never
// executes repository source.
//
// The policy has four deliberately separate semantic layers:
// 1. Primitive constants: a bounded evaluator implements an allowlisted
//    primitive-only subset of JavaScript coercion. Unsupported, mutable,
//    cyclic, or over-budget expressions are UNKNOWN.
// 2. Pure operational expressions: trusted node:path join/resolve calls over
//    known strings produce bounded abstract path facts without executing
//    repository code or calling host path functions.
// 3. Local property state: child-process option objects that originate in a
//    local object literal are tracked to the sink across ordered writes and a
//    small control-flow model. Unsupported aliasing/mutation invalidates facts.
// 4. Operational sinks: only reviewed Node API argument positions consume
//    path/wrapper/property facts. Arbitrary runtime data is not operational
//    merely because its text starts with a policy token.
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const BANNED_PATH = /(?<![\w:/#.-])\/(tmp|bin|usr|etc|var)(?![\w.-])/;
const WRAPPER_PATTERNS = [
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
const MAX_OBJECT_ANALYSIS_STEPS = 2_048;
const MAX_OBJECT_STATE_PATHS = 64;

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
const PURE_PATH_OPERATIONS = new Set(["join", "resolve"]);
const PROCESS_PATH_ARGUMENTS = new Map([
  ["chdir", [0]],
  ["dlopen", [1]],
  ["loadEnvFile", [0]],
]);

function unwrapExpression(node, state) {
  let current = node;
  let structuralDepth = 0;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    if (
      state === undefined
        ? structuralDepth >= MAX_STRUCTURAL_DEPTH
        : state.depth >= MAX_EVALUATION_DEPTH ||
          state.budget.steps >= MAX_EVALUATION_STEPS
    ) {
      return current;
    }
    if (state === undefined) {
      structuralDepth += 1;
    } else {
      state.depth += 1;
      state.budget.steps += 1;
    }
    current = current.expression;
  }
  return current;
}

function optionalChainReachability(node, checker) {
  let current = unwrapExpression(node);
  if ((current.flags & ts.NodeFlags.OptionalChain) === 0) return undefined;
  let sawOptionalLink = false;
  let reachability = true;
  for (let depth = 0; depth <= MAX_STRUCTURAL_DEPTH; depth += 1) {
    if (
      !ts.isCallExpression(current) &&
      !ts.isPropertyAccessExpression(current) &&
      !ts.isElementAccessExpression(current)
    ) {
      return sawOptionalLink ? reachability : undefined;
    }
    if (current.questionDotToken !== undefined) {
      sawOptionalLink = true;
      const base = evaluateConstant(current.expression, checker);
      // Every optional link is a separate reachability decision. A null base
      // at any link skips all later computed keys and call arguments; an
      // unknown intermediate property retains both reached and skipped paths
      // even when the leftmost root is a proved non-null primitive.
      if (base === null) return false;
      if (base === UNKNOWN) reachability = UNKNOWN;
    }
    current = unwrapExpression(current.expression);
  }
  return sawOptionalLink ? UNKNOWN : undefined;
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

function isPrimitiveConstant(value) {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}

// Bounded equivalents of the JavaScript primitive conversions used by the
// allowlisted evaluator. No object ToPrimitive hooks, Symbols, BigInts, or
// repository expressions are executed.
function primitiveToBoolean(value) {
  if (value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "string") return value.length !== 0;
  return UNKNOWN;
}

function primitiveToNumber(value) {
  if (value === null) return 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return UNKNOWN;
}

function primitiveToString(value) {
  if (!isPrimitiveConstant(value)) return UNKNOWN;
  return boundedString(String(value));
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
    const truth = primitiveToBoolean(left);
    return truth === UNKNOWN || truth
      ? truth === UNKNOWN
        ? UNKNOWN
        : evaluateConstant(node.right, checker, childState(state))
      : left;
  }
  if (operator === ts.SyntaxKind.BarBarToken) {
    const truth = primitiveToBoolean(left);
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
      const leftString = primitiveToString(left);
      const rightString = primitiveToString(right);
      return leftString === UNKNOWN || rightString === UNKNOWN
        ? UNKNOWN
        : boundedString(leftString + rightString);
    }
    const leftNumber = primitiveToNumber(left);
    const rightNumber = primitiveToNumber(right);
    return leftNumber === UNKNOWN || rightNumber === UNKNOWN
      ? UNKNOWN
      : leftNumber + rightNumber;
  }
  if (operator === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
  if (operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return left !== right;
  }
  if (typeof left === "string" && typeof right === "string") {
    if (operator === ts.SyntaxKind.LessThanToken) return left < right;
    if (operator === ts.SyntaxKind.LessThanEqualsToken) return left <= right;
    if (operator === ts.SyntaxKind.GreaterThanToken) return left > right;
    if (operator === ts.SyntaxKind.GreaterThanEqualsToken) return left >= right;
  }
  const leftNumber = primitiveToNumber(left);
  const rightNumber = primitiveToNumber(right);
  if (leftNumber === UNKNOWN || rightNumber === UNKNOWN) return UNKNOWN;

  if (operator === ts.SyntaxKind.LessThanToken) return leftNumber < rightNumber;
  if (operator === ts.SyntaxKind.LessThanEqualsToken)
    return leftNumber <= rightNumber;
  if (operator === ts.SyntaxKind.GreaterThanToken)
    return leftNumber > rightNumber;
  if (operator === ts.SyntaxKind.GreaterThanEqualsToken)
    return leftNumber >= rightNumber;

  let result;
  if (operator === ts.SyntaxKind.MinusToken) result = leftNumber - rightNumber;
  else if (operator === ts.SyntaxKind.AsteriskToken)
    result = leftNumber * rightNumber;
  else if (operator === ts.SyntaxKind.AsteriskAsteriskToken)
    result = leftNumber ** rightNumber;
  else if (operator === ts.SyntaxKind.SlashToken)
    result = leftNumber / rightNumber;
  else if (operator === ts.SyntaxKind.PercentToken)
    result = leftNumber % rightNumber;
  else return UNKNOWN;
  return result;
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
  const current = unwrapExpression(node, state);

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
    return value;
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
      const expressionString = primitiveToString(expression);
      if (expressionString === UNKNOWN) return UNKNOWN;
      value += expressionString + span.literal.text;
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
      const truth = primitiveToBoolean(operand);
      return truth === UNKNOWN ? UNKNOWN : !truth;
    }
    const numeric = primitiveToNumber(operand);
    if (numeric === UNKNOWN) return UNKNOWN;
    if (current.operator === ts.SyntaxKind.PlusToken) return numeric;
    if (current.operator === ts.SyntaxKind.MinusToken) return -numeric;
    if (current.operator === ts.SyntaxKind.TildeToken) return ~numeric;
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
    const truth = primitiveToBoolean(condition);
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

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function addOperationalPathFinding(
  findings,
  relativePath,
  source,
  node,
  value,
) {
  const pathMatch = value.match(BANNED_PATH);
  if (pathMatch) {
    findings.push({
      path: relativePath,
      line: lineOf(source, node),
      kind: "posix-path",
      detail: `/${pathMatch[1]}`,
    });
  }
}

function addOperationalWrapperFinding(
  findings,
  relativePath,
  source,
  node,
  value,
) {
  const wrapper = shellWrapperDetail(value);
  if (wrapper !== null) {
    findings.push({
      path: relativePath,
      line: lineOf(source, node),
      kind: "shell-wrapper",
      detail: wrapper,
    });
  }
}

function shellWrapperDetail(value) {
  for (const { pattern, shell } of WRAPPER_PATTERNS) {
    const match = value.match(pattern);
    if (match !== null) return `${shell} -${match[1]}`;
  }
  return null;
}

function moduleKind(specifier) {
  return OPERATIONAL_MODULES.get(specifier);
}

function namespaceBinding(kind, member) {
  if (kind !== "path") return { kind };
  return {
    kind,
    pathFlavor:
      member === "posix" ? "posix" : member === "win32" ? "win32" : "host",
  };
}

function directBinding(kind, operation) {
  return {
    kind,
    operation,
    ...(kind === "path" ? { pathFlavor: "host" } : {}),
  };
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
        namespaces.set(symbol, namespaceBinding(kind));
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
      if (symbol !== undefined) {
        namespaces.set(symbol, namespaceBinding(kind));
      }
    }
    const bindings = clause.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      const symbol = checker.getSymbolAtLocation(bindings.name);
      if (symbol !== undefined) {
        namespaces.set(symbol, namespaceBinding(kind));
      }
      continue;
    }
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (symbol === undefined) continue;
      const importedName = (element.propertyName ?? element.name).text;
      if (NAMESPACE_NAMED_IMPORTS.has(importedName)) {
        namespaces.set(symbol, namespaceBinding(kind, importedName));
      } else {
        direct.set(symbol, directBinding(kind, importedName));
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
            const importedName =
              element.propertyName === undefined
                ? element.name.text
                : propertyNameValue(element.propertyName, checker);
            if (importedName === UNKNOWN) continue;
            if (NAMESPACE_NAMED_IMPORTS.has(importedName)) {
              namespaces.set(symbol, namespaceBinding(kind, importedName));
            } else {
              direct.set(symbol, directBinding(kind, importedName));
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
  if (required !== undefined) return namespaceBinding(required);
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
    const namespace = namespaceKind(
      current.expression,
      checker,
      bindings,
      seen,
    );
    return namespace?.kind === "path" &&
      (current.name.text === "posix" || current.name.text === "win32")
      ? namespaceBinding("path", current.name.text)
      : namespace;
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression !== undefined
  ) {
    const namespace = namespaceKind(
      current.expression,
      checker,
      bindings,
      seen,
    );
    const member = evaluateConstant(current.argumentExpression, checker);
    return namespace?.kind === "path" &&
      (member === "posix" || member === "win32")
      ? namespaceBinding("path", member)
      : namespace;
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
    const namespace = namespaceKind(current.expression, checker, bindings);
    return namespace === undefined
      ? undefined
      : { ...namespace, operation: current.name.text };
  }
  if (ts.isElementAccessExpression(current) && current.argumentExpression) {
    const namespace = namespaceKind(current.expression, checker, bindings);
    const operation = evaluateConstant(current.argumentExpression, checker);
    return namespace === undefined || typeof operation !== "string"
      ? undefined
      : { ...namespace, operation };
  }
  return undefined;
}

function normalizeAbstractPath(parts, absolute) {
  const segments = [];
  for (const part of parts) {
    for (const segment of part.split("/")) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") {
        if (segments.length > 0 && segments.at(-1) !== "..") {
          segments.pop();
        } else if (!absolute) {
          segments.push(segment);
        }
        continue;
      }
      segments.push(segment);
    }
  }
  const joined = segments.join("/");
  return boundedString(absolute ? `/${joined}` : joined || ".");
}

function evaluateAbstractPathOperation(operation, values) {
  if (operation === "join") {
    if (values.length === 0) return ".";
    const firstNonEmpty = values.find((value) => value.length > 0);
    const absolute = firstNonEmpty?.startsWith("/") ?? false;
    return normalizeAbstractPath(values, absolute);
  }
  if (operation !== "resolve") return UNKNOWN;

  // resolve() is cwd-dependent until a known absolute operand is reached.
  // Work right-to-left exactly far enough to establish that root, then apply
  // lexical dot-segment normalization. This is an abstract portability fact,
  // not an emulation of the host's node:path implementation.
  let absoluteIndex = -1;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index].startsWith("/")) {
      absoluteIndex = index;
      break;
    }
  }
  return absoluteIndex < 0
    ? UNKNOWN
    : normalizeAbstractPath(values.slice(absoluteIndex), true);
}

function operationalChildState(state, declaration) {
  const seen = new Set(state.seen);
  if (declaration !== undefined) seen.add(declaration);
  return {
    budget: state.budget,
    depth: state.depth + 1,
    seen,
  };
}

function evaluateOperationalValue(
  node,
  checker,
  bindings,
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
  const current = unwrapExpression(node, state);
  const primitive = evaluateConstant(
    current,
    checker,
    childState(state),
    symbolOverride,
  );
  if (typeof primitive === "string") return primitive;

  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker, symbolOverride);
    if (resolved === null || state.seen.has(resolved.declaration)) {
      return UNKNOWN;
    }
    return evaluateOperationalValue(
      resolved.initializer,
      checker,
      bindings,
      operationalChildState(state, resolved.declaration),
    );
  }
  if (!ts.isCallExpression(current)) return UNKNOWN;
  const sink = resolveSink(current.expression, checker, bindings);
  if (
    sink?.kind !== "path" ||
    sink.pathFlavor === "win32" ||
    !PURE_PATH_OPERATIONS.has(sink.operation) ||
    current.arguments.some(ts.isSpreadElement)
  ) {
    return UNKNOWN;
  }
  const values = [];
  for (const argument of current.arguments) {
    const value = evaluateOperationalValue(
      argument,
      checker,
      bindings,
      operationalChildState(state),
    );
    if (typeof value !== "string") return UNKNOWN;
    values.push(value);
  }
  return evaluateAbstractPathOperation(sink.operation, values);
}

function inspectOperationalStructure(
  node,
  relativePath,
  source,
  checker,
  bindings,
  findings,
  classification = "path",
  seen = new Set(),
  depth = 0,
  symbolOverride,
) {
  if (depth > MAX_STRUCTURAL_DEPTH) return;
  const current = unwrapExpression(node);
  const value = evaluateOperationalValue(
    node,
    checker,
    bindings,
    undefined,
    symbolOverride,
  );
  if (typeof value === "string") {
    addOperationalPathFinding(findings, relativePath, source, node, value);
    if (classification === "command") {
      addOperationalWrapperFinding(findings, relativePath, source, node, value);
    }
    return;
  }
  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker, symbolOverride);
    if (resolved === null || seen.has(resolved.declaration)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(resolved.declaration);
    inspectOperationalStructure(
      resolved.initializer,
      relativePath,
      source,
      checker,
      bindings,
      findings,
      classification,
      nextSeen,
      depth + 1,
    );
    return;
  }
}

function constantArrayElements(
  node,
  checker,
  seen = new Set(),
  depth = 0,
  symbolOverride,
) {
  if (depth > MAX_STRUCTURAL_DEPTH) return null;
  const current = unwrapExpression(node);
  if (ts.isIdentifier(current)) {
    const resolved = constInitializer(current, checker, symbolOverride);
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
  bindings,
  findings,
  classification,
  symbolOverride,
) {
  const elements = constantArrayElements(
    node,
    checker,
    new Set(),
    0,
    symbolOverride,
  );
  if (elements === null) return;
  for (const element of elements) {
    inspectOperationalStructure(
      element,
      relativePath,
      source,
      checker,
      bindings,
      findings,
      classification,
    );
  }
}

function emptyTrackedObjectState(names) {
  return {
    escaped: false,
    identifiable: true,
    properties: new Map([...names].map((name) => [name, { kind: "absent" }])),
  };
}

function cloneTrackedObjectState(state) {
  return {
    escaped: state.escaped,
    identifiable: state.identifiable,
    properties: new Map(state.properties),
  };
}

function cloneTrackedObjectStates(states) {
  return states.map(cloneTrackedObjectState);
}

function setEveryPropertyUnknown(state) {
  for (const name of state.properties.keys()) {
    state.properties.set(name, { kind: "unknown" });
  }
}

function invalidateTrackedState(state, identityLost = false) {
  setEveryPropertyUnknown(state);
  state.escaped = true;
  if (identityLost) state.identifiable = false;
}

function propertyReferences(property) {
  if (property.kind === "known") return [property.reference];
  if (property.kind === "possible") return property.references;
  return [];
}

function mergeTrackedObjectStateGroup(states, names) {
  const merged = emptyTrackedObjectState(names);
  merged.escaped = states[0].escaped;
  merged.identifiable = states[0].identifiable;
  for (const name of names) {
    const properties = states.map((state) => state.properties.get(name));
    const references = new Map();
    let mayBeAbsent = false;
    let mayBeUnknown = false;
    for (const property of properties) {
      if (property.kind === "absent") mayBeAbsent = true;
      if (property.kind === "unknown") mayBeUnknown = true;
      if (property.kind === "possible") {
        mayBeAbsent ||= property.mayBeAbsent;
        mayBeUnknown ||= property.mayBeUnknown;
      }
      for (const reference of propertyReferences(property)) {
        const key = `${reference.node.pos}:${reference.node.end}`;
        references.set(key, reference);
      }
    }
    const candidates = [...references.values()];
    if (candidates.length === 0) {
      merged.properties.set(
        name,
        mayBeUnknown ? { kind: "unknown" } : { kind: "absent" },
      );
    } else if (candidates.length === 1 && !mayBeAbsent && !mayBeUnknown) {
      merged.properties.set(name, {
        kind: "known",
        reference: candidates[0],
      });
    } else {
      merged.properties.set(name, {
        kind: "possible",
        mayBeAbsent,
        mayBeUnknown,
        references: candidates,
      });
    }
  }
  return merged;
}

function boundedObjectStates(states, names) {
  if (states.length === 0) return [];
  const groups = new Map();
  for (const state of states) {
    const key = `${state.escaped}:${state.identifiable}`;
    const group = groups.get(key) ?? [];
    group.push(state);
    groups.set(key, group);
  }
  const merged = [...groups.values()].map((group) =>
    mergeTrackedObjectStateGroup(group, names),
  );
  if (merged.length <= MAX_OBJECT_STATE_PATHS) return merged;
  const unknown = emptyTrackedObjectState(names);
  invalidateTrackedState(unknown);
  return [unknown];
}

function valueReference(node, symbolOverride) {
  return { node, symbolOverride };
}

function applyKnownPropertyWrite(state, property, reference) {
  if (!state.identifiable || state.escaped) return;
  if (property === UNKNOWN) {
    setEveryPropertyUnknown(state);
  } else if (state.properties.has(property)) {
    state.properties.set(property, { kind: "known", reference });
  }
}

function stateFromObjectLiteral(literal, names, checker) {
  const state = emptyTrackedObjectState(names);
  for (const property of literal.properties) {
    if (ts.isSpreadAssignment(property)) {
      setEveryPropertyUnknown(state);
      continue;
    }
    const propertyName = propertyNameValue(property.name, checker);
    if (propertyName === UNKNOWN) {
      setEveryPropertyUnknown(state);
      continue;
    }
    if (!names.has(propertyName)) continue;
    if (ts.isPropertyAssignment(property)) {
      applyKnownPropertyWrite(
        state,
        propertyName,
        valueReference(property.initializer),
      );
    } else if (ts.isShorthandPropertyAssignment(property)) {
      applyKnownPropertyWrite(
        state,
        propertyName,
        valueReference(
          property.name,
          checker.getShorthandAssignmentValueSymbol(property),
        ),
      );
    } else {
      state.properties.set(propertyName, { kind: "unknown" });
    }
  }
  return state;
}

function variableInitializerFromSymbol(symbol) {
  const declaration = symbol?.valueDeclaration;
  if (
    declaration === undefined ||
    !ts.isVariableDeclaration(declaration) ||
    !ts.isIdentifier(declaration.name) ||
    declaration.initializer === undefined
  ) {
    return null;
  }
  return { declaration, initializer: declaration.initializer };
}

function statementChildOf(container, node) {
  let current = node;
  while (current !== undefined && current.parent !== container) {
    current = current.parent;
  }
  return current !== undefined && ts.isStatement(current) ? current : null;
}

function enclosingStatement(node) {
  let current = node;
  while (current !== undefined && !ts.isStatement(current)) {
    current = current.parent;
  }
  return current ?? null;
}

function nodeContains(container, node) {
  return container.pos <= node.pos && node.end <= container.end;
}

function crossesDeferredBoundary(node, container) {
  let current = node.parent;
  while (current !== undefined && current !== container) {
    if (
      ts.isFunctionLike(current) ||
      ts.isClassDeclaration(current) ||
      ts.isClassExpression(current)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function sameResolvedSymbol(identifier, symbol, checker) {
  return checker.getSymbolAtLocation(identifier) === symbol;
}

function objectAccessFromReference(identifier) {
  let current = identifier;
  while (
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  const parent = current.parent;
  if (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isElementAccessExpression(parent)) &&
    parent.expression === current
  ) {
    return parent;
  }
  return null;
}

function enclosingOperation(node) {
  let current = node;
  while (
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  return { current, parent: current.parent };
}

function accessPropertyName(access, checker) {
  if (ts.isPropertyAccessExpression(access)) return access.name.text;
  if (access.argumentExpression === undefined) return UNKNOWN;
  const value = evaluateConstant(access.argumentExpression, checker);
  return value === UNKNOWN ? UNKNOWN : String(value);
}

function containingAssignmentForAccess(access) {
  let current = access;
  while (current.parent !== undefined && !ts.isStatement(current.parent)) {
    const parent = current.parent;
    if (
      ts.isBinaryExpression(parent) &&
      isAssignmentOperator(parent.operatorToken.kind) &&
      nodeContains(parent.left, access)
    ) {
      return parent;
    }
    current = parent;
  }
  return null;
}

function isAssignmentOperator(kind) {
  return (
    kind >= ts.SyntaxKind.FirstAssignment &&
    kind <= ts.SyntaxKind.LastAssignment
  );
}

function isSafeChildProcessOptionsReference(identifier, checker, bindings) {
  let current = identifier;
  while (
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isNonNullExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent;
  }
  const call = current.parent;
  if (!ts.isCallExpression(call) && !ts.isNewExpression(call)) return false;
  const index = call.arguments?.indexOf(current) ?? -1;
  if (index < 0) return false;
  const sink = resolveSink(call.expression, checker, bindings);
  const signature =
    sink?.kind === "child-process"
      ? CHILD_PROCESS_ARGUMENTS.get(sink.operation)
      : undefined;
  return signature?.options.includes(index) ?? false;
}

function collectTrackedObjectEvents(
  node,
  symbol,
  declaration,
  checker,
  bindings,
  stopPosition = Number.POSITIVE_INFINITY,
  budget = { steps: 0 },
  startPosition = Number.NEGATIVE_INFINITY,
) {
  const events = new Map();
  function addEvent(event) {
    if (
      event.node.getStart() >= stopPosition ||
      event.node.end <= startPosition
    ) {
      return;
    }
    const propertyKey =
      "property" in event
        ? event.property === UNKNOWN
          ? "<unknown>"
          : event.property
        : "<none>";
    const key = `${event.kind}:${propertyKey}:${event.node.pos}:${event.node.end}`;
    events.set(key, event);
  }
  function visit(current, depth = 0, deferred = false) {
    if (current.getStart() >= stopPosition || current.end <= startPosition)
      return;
    if (
      depth > MAX_STRUCTURAL_DEPTH ||
      budget.steps >= MAX_OBJECT_ANALYSIS_STEPS
    ) {
      addEvent({ kind: "escape", node: current });
      return;
    }
    budget.steps += 1;
    const currentDeferred =
      deferred ||
      ts.isArrowFunction(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isClassDeclaration(current) ||
      ts.isClassExpression(current);
    if (
      ts.isIdentifier(current) &&
      current !== declaration.name &&
      sameResolvedSymbol(current, symbol, checker)
    ) {
      if (currentDeferred) {
        addEvent({ kind: "escape", node: current });
        return;
      }
      const access = objectAccessFromReference(current);
      if (access !== null) {
        const operation = enclosingOperation(access);
        const parent = operation.parent;
        const property = accessPropertyName(access, checker);
        if (
          ts.isBinaryExpression(parent) &&
          parent.left === operation.current &&
          isAssignmentOperator(parent.operatorToken.kind)
        ) {
          if (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            addEvent({
              kind: "write",
              node: parent,
              property,
              reference: valueReference(parent.right),
            });
          } else {
            addEvent({ kind: "unknown-write", node: parent, property });
          }
        } else if (
          ts.isDeleteExpression(parent) &&
          parent.expression === operation.current
        ) {
          addEvent({ kind: "delete", node: parent, property });
        } else if (
          ((ts.isPrefixUnaryExpression(parent) &&
            (parent.operator === ts.SyntaxKind.PlusPlusToken ||
              parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
            ts.isPostfixUnaryExpression(parent)) &&
          parent.operand === operation.current
        ) {
          addEvent({ kind: "unknown-write", node: parent, property });
        } else if (
          (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
          parent.expression === operation.current
        ) {
          addEvent({ kind: "escape", node: parent });
        } else {
          const assignment = containingAssignmentForAccess(access);
          if (assignment !== null) {
            addEvent({ kind: "unknown-write", node: assignment, property });
          }
        }
        return;
      }

      const operation = enclosingOperation(current);
      if (
        ts.isBinaryExpression(operation.parent) &&
        operation.parent.left === operation.current &&
        isAssignmentOperator(operation.parent.operatorToken.kind)
      ) {
        addEvent({ kind: "identity-loss", node: operation.parent });
      } else if (
        !isSafeChildProcessOptionsReference(current, checker, bindings)
      ) {
        addEvent({ kind: "escape", node: operation.current });
      }
      return;
    }
    ts.forEachChild(current, (child) =>
      visit(child, depth + 1, currentDeferred),
    );
  }
  visit(node);
  return [...events.values()].sort(
    (left, right) => left.node.getStart() - right.node.getStart(),
  );
}

function applyTrackedObjectEvents(states, events) {
  for (const event of events) {
    for (const state of states) {
      if (event.kind === "write") {
        applyKnownPropertyWrite(state, event.property, event.reference);
      } else if (event.kind === "delete") {
        if (!state.identifiable || state.escaped) continue;
        if (event.property === UNKNOWN) {
          setEveryPropertyUnknown(state);
        } else if (state.properties.has(event.property)) {
          state.properties.set(event.property, { kind: "absent" });
        }
      } else if (event.kind === "unknown-write") {
        if (!state.identifiable || state.escaped) continue;
        if (event.property === UNKNOWN) {
          setEveryPropertyUnknown(state);
        } else if (state.properties.has(event.property)) {
          state.properties.set(event.property, { kind: "unknown" });
        }
      } else {
        invalidateTrackedState(state, event.kind === "identity-loss");
      }
    }
  }
  return states;
}

function expressionTruth(node, checker) {
  const value = evaluateConstant(node, checker);
  return value === UNKNOWN ? UNKNOWN : primitiveToBoolean(value);
}

function mergeTrackedBranches(branches, names) {
  return boundedObjectStates(branches.flat(), names);
}

function invalidateForUnsupportedMutation(
  node,
  states,
  context,
  stopPosition = Number.POSITIVE_INFINITY,
) {
  const events = collectTrackedObjectEvents(
    node,
    context.symbol,
    context.declaration,
    context.checker,
    context.bindings,
    stopPosition,
    context.budget,
  );
  if (events.length > 0) {
    for (const state of states) invalidateTrackedState(state);
  }
  return states;
}

function directAssignmentEvent(target, assignment, context) {
  const current = unwrapExpression(target);
  if (
    ts.isIdentifier(current) &&
    sameResolvedSymbol(current, context.symbol, context.checker)
  ) {
    return { kind: "identity-loss", node: assignment };
  }
  if (
    !ts.isPropertyAccessExpression(current) &&
    !ts.isElementAccessExpression(current)
  ) {
    return null;
  }
  const object = unwrapExpression(current.expression);
  if (
    !ts.isIdentifier(object) ||
    !sameResolvedSymbol(object, context.symbol, context.checker)
  ) {
    return null;
  }
  const property = accessPropertyName(current, context.checker);
  return assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ? {
        kind: "write",
        node: assignment,
        property,
        reference: valueReference(assignment.right),
      }
    : { kind: "unknown-write", node: assignment, property };
}

function isDirectTrackedIdentifier(node, context) {
  const current = unwrapExpression(node);
  return (
    ts.isIdentifier(current) &&
    sameResolvedSymbol(current, context.symbol, context.checker)
  );
}

// Evaluate only the ordering/control-flow needed to place visible writes before
// a child-process sink. Constant branch conditions are honored. For an
// unresolved logical/conditional branch, both reachable states are retained
// and merged with a may-lattice; a possible proved violation therefore remains
// visible. Unsupported optional-chain mutation is invalidated to UNKNOWN.
function processTrackedExpression(
  node,
  states,
  context,
  stopPosition = Number.POSITIVE_INFINITY,
) {
  if (node === undefined || node.getStart() >= stopPosition) return states;
  const current = unwrapExpression(node);
  if (current.getStart() >= stopPosition) return states;

  if (
    (ts.isCallExpression(current) ||
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current)) &&
    current.questionDotToken !== undefined
  ) {
    const afterBase = processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
    const reachability =
      optionalChainReachability(current, context.checker) ?? UNKNOWN;
    if (reachability === false || ts.isPropertyAccessExpression(current)) {
      return afterBase;
    }
    let reached = cloneTrackedObjectStates(afterBase);
    if (
      ts.isElementAccessExpression(current) &&
      current.argumentExpression !== undefined
    ) {
      reached = processTrackedExpression(
        current.argumentExpression,
        reached,
        context,
        stopPosition,
      );
    } else if (ts.isCallExpression(current)) {
      for (const argument of current.arguments) {
        reached = processTrackedExpression(
          argument,
          reached,
          context,
          stopPosition,
        );
      }
    }
    return reachability === UNKNOWN
      ? mergeTrackedBranches([afterBase, reached], context.names)
      : reached;
  }

  const optionalReachability = optionalChainReachability(
    current,
    context.checker,
  );
  if (
    optionalReachability !== undefined &&
    current.questionDotToken === undefined &&
    (ts.isCallExpression(current) || ts.isElementAccessExpression(current))
  ) {
    const afterPrefix = processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
    if (optionalReachability === false) return afterPrefix;
    let reached = cloneTrackedObjectStates(afterPrefix);
    if (
      ts.isElementAccessExpression(current) &&
      current.argumentExpression !== undefined
    ) {
      reached = processTrackedExpression(
        current.argumentExpression,
        reached,
        context,
        stopPosition,
      );
    } else if (ts.isCallExpression(current)) {
      for (const argument of current.arguments) {
        reached = processTrackedExpression(
          argument,
          reached,
          context,
          stopPosition,
        );
      }
    }
    return optionalReachability === UNKNOWN
      ? mergeTrackedBranches([afterPrefix, reached], context.names)
      : reached;
  }

  if (ts.isPropertyAccessExpression(current)) {
    return processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
  }

  if (ts.isElementAccessExpression(current)) {
    const afterBase = processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
    return current.argumentExpression === undefined
      ? afterBase
      : processTrackedExpression(
          current.argumentExpression,
          afterBase,
          context,
          stopPosition,
        );
  }

  if (ts.isSpreadElement(current)) {
    return processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
  }

  if (ts.isConditionalExpression(current)) {
    const conditioned = processTrackedExpression(
      current.condition,
      states,
      context,
      stopPosition,
    );
    const truth = expressionTruth(current.condition, context.checker);
    if (truth === true) {
      return processTrackedExpression(
        current.whenTrue,
        conditioned,
        context,
        stopPosition,
      );
    }
    if (truth === false) {
      return processTrackedExpression(
        current.whenFalse,
        conditioned,
        context,
        stopPosition,
      );
    }
    return mergeTrackedBranches(
      [
        processTrackedExpression(
          current.whenTrue,
          cloneTrackedObjectStates(conditioned),
          context,
          stopPosition,
        ),
        processTrackedExpression(
          current.whenFalse,
          cloneTrackedObjectStates(conditioned),
          context,
          stopPosition,
        ),
      ],
      context.names,
    );
  }

  if (ts.isBinaryExpression(current)) {
    const operator = current.operatorToken.kind;
    if (operator === ts.SyntaxKind.CommaToken) {
      const afterLeft = processTrackedExpression(
        current.left,
        states,
        context,
        stopPosition,
      );
      return processTrackedExpression(
        current.right,
        afterLeft,
        context,
        stopPosition,
      );
    }
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const afterLeft = processTrackedExpression(
        current.left,
        states,
        context,
        stopPosition,
      );
      const left = evaluateConstant(current.left, context.checker);
      let takeRight = UNKNOWN;
      if (left !== UNKNOWN) {
        if (operator === ts.SyntaxKind.QuestionQuestionToken) {
          takeRight = left === null;
        } else {
          const truth = primitiveToBoolean(left);
          takeRight =
            operator === ts.SyntaxKind.AmpersandAmpersandToken ? truth : !truth;
        }
      }
      if (takeRight === true) {
        return processTrackedExpression(
          current.right,
          afterLeft,
          context,
          stopPosition,
        );
      }
      if (takeRight === false) return afterLeft;
      return mergeTrackedBranches(
        [
          cloneTrackedObjectStates(afterLeft),
          processTrackedExpression(
            current.right,
            cloneTrackedObjectStates(afterLeft),
            context,
            stopPosition,
          ),
        ],
        context.names,
      );
    }
    if (isAssignmentOperator(operator)) {
      if (operator !== ts.SyntaxKind.EqualsToken) {
        return invalidateForUnsupportedMutation(current, states, context);
      }
      let ordered = states;
      const left = unwrapExpression(current.left);
      if (
        (ts.isPropertyAccessExpression(left) ||
          ts.isElementAccessExpression(left)) &&
        !isDirectTrackedIdentifier(left.expression, context)
      ) {
        ordered = processTrackedExpression(
          left.expression,
          ordered,
          context,
          stopPosition,
        );
      }
      if (
        ts.isElementAccessExpression(left) &&
        left.argumentExpression !== undefined
      ) {
        ordered = processTrackedExpression(
          left.argumentExpression,
          ordered,
          context,
          stopPosition,
        );
      } else if (
        !ts.isPropertyAccessExpression(left) &&
        !ts.isIdentifier(left)
      ) {
        ordered = invalidateForUnsupportedMutation(
          current.left,
          ordered,
          context,
        );
      }
      ordered = processTrackedExpression(
        current.right,
        ordered,
        context,
        stopPosition,
      );
      const event = directAssignmentEvent(current.left, current, context);
      return event === null
        ? ordered
        : applyTrackedObjectEvents(ordered, [event]);
    }
  }

  if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
    let ordered = processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
    for (const argument of current.arguments ?? []) {
      ordered = processTrackedExpression(
        argument,
        ordered,
        context,
        stopPosition,
      );
    }
    return ordered;
  }

  if (ts.isCommaListExpression(current)) {
    let ordered = states;
    for (const element of current.elements) {
      ordered = processTrackedExpression(
        element,
        ordered,
        context,
        stopPosition,
      );
    }
    return ordered;
  }

  if (ts.isArrayLiteralExpression(current)) {
    let ordered = states;
    for (const element of current.elements) {
      if (ts.isOmittedExpression(element)) continue;
      ordered = processTrackedExpression(
        ts.isSpreadElement(element) ? element.expression : element,
        ordered,
        context,
        stopPosition,
      );
    }
    return ordered;
  }

  if (ts.isObjectLiteralExpression(current)) {
    let ordered = states;
    for (const property of current.properties) {
      if (
        property.name !== undefined &&
        ts.isComputedPropertyName(property.name)
      ) {
        ordered = processTrackedExpression(
          property.name.expression,
          ordered,
          context,
          stopPosition,
        );
      }
      if (ts.isSpreadAssignment(property)) {
        ordered = processTrackedExpression(
          property.expression,
          ordered,
          context,
          stopPosition,
        );
      } else if (ts.isPropertyAssignment(property)) {
        ordered = processTrackedExpression(
          property.initializer,
          ordered,
          context,
          stopPosition,
        );
      } else if (ts.isShorthandPropertyAssignment(property)) {
        ordered = processTrackedExpression(
          property.name,
          ordered,
          context,
          stopPosition,
        );
      } else if (
        ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        ordered = invalidateForUnsupportedMutation(property, ordered, context);
      }
    }
    return ordered;
  }

  if (ts.isTemplateExpression(current)) {
    let ordered = states;
    for (const span of current.templateSpans) {
      ordered = processTrackedExpression(
        span.expression,
        ordered,
        context,
        stopPosition,
      );
    }
    return ordered;
  }

  if (ts.isTaggedTemplateExpression(current)) {
    const afterTag = processTrackedExpression(
      current.tag,
      states,
      context,
      stopPosition,
    );
    return processTrackedExpression(
      current.template,
      afterTag,
      context,
      stopPosition,
    );
  }

  if (
    ts.isPrefixUnaryExpression(current) ||
    ts.isPostfixUnaryExpression(current) ||
    ts.isVoidExpression(current) ||
    ts.isTypeOfExpression(current) ||
    ts.isDeleteExpression(current) ||
    ts.isAwaitExpression(current) ||
    ts.isYieldExpression(current)
  ) {
    return current.expression === undefined && current.operand === undefined
      ? states
      : processTrackedExpression(
          current.expression ?? current.operand,
          states,
          context,
          stopPosition,
        );
  }

  // Unsupported expression containers are never flattened into source-order
  // writes: doing so would invent effects from unreachable nested branches.
  // If they reference the tracked object, invalidate to UNKNOWN instead.
  return invalidateForUnsupportedMutation(
    current,
    states,
    context,
    stopPosition,
  );
}

function processTrackedExpressionToSink(node, states, context, sinkCall) {
  const current = unwrapExpression(node);
  if (current === sinkCall) return states;
  if (!nodeContains(current, sinkCall)) return states;
  if (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    return [];
  }

  const optionalReachability = optionalChainReachability(
    current,
    context.checker,
  );
  if (
    optionalReachability !== undefined &&
    !nodeContains(current.expression, sinkCall) &&
    optionalReachability === false
  ) {
    return [];
  }

  if (ts.isConditionalExpression(current)) {
    if (nodeContains(current.condition, sinkCall)) {
      return processTrackedExpressionToSink(
        current.condition,
        states,
        context,
        sinkCall,
      );
    }
    const conditioned = processTrackedExpression(
      current.condition,
      states,
      context,
    );
    const truth = expressionTruth(current.condition, context.checker);
    if (nodeContains(current.whenTrue, sinkCall)) {
      return truth === false
        ? []
        : processTrackedExpressionToSink(
            current.whenTrue,
            conditioned,
            context,
            sinkCall,
          );
    }
    if (nodeContains(current.whenFalse, sinkCall)) {
      return truth === true
        ? []
        : processTrackedExpressionToSink(
            current.whenFalse,
            conditioned,
            context,
            sinkCall,
          );
    }
  }

  if (ts.isBinaryExpression(current)) {
    if (isAssignmentOperator(current.operatorToken.kind)) {
      const left = unwrapExpression(current.left);
      let ordered = states;
      if (
        (ts.isPropertyAccessExpression(left) ||
          ts.isElementAccessExpression(left)) &&
        !isDirectTrackedIdentifier(left.expression, context)
      ) {
        if (nodeContains(left.expression, sinkCall)) {
          return processTrackedExpressionToSink(
            left.expression,
            ordered,
            context,
            sinkCall,
          );
        }
        ordered = processTrackedExpression(left.expression, ordered, context);
      }
      if (
        ts.isElementAccessExpression(left) &&
        left.argumentExpression !== undefined
      ) {
        if (nodeContains(left.argumentExpression, sinkCall)) {
          return processTrackedExpressionToSink(
            left.argumentExpression,
            ordered,
            context,
            sinkCall,
          );
        }
        ordered = processTrackedExpression(
          left.argumentExpression,
          ordered,
          context,
        );
      }
      return nodeContains(current.right, sinkCall)
        ? processTrackedExpressionToSink(
            current.right,
            ordered,
            context,
            sinkCall,
          )
        : ordered;
    }
    if (nodeContains(current.left, sinkCall)) {
      return processTrackedExpressionToSink(
        current.left,
        states,
        context,
        sinkCall,
      );
    }
    const afterLeft = processTrackedExpression(current.left, states, context);
    if (!nodeContains(current.right, sinkCall)) return afterLeft;
    const operator = current.operatorToken.kind;
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const left = evaluateConstant(current.left, context.checker);
      let takeRight = UNKNOWN;
      if (left !== UNKNOWN) {
        if (operator === ts.SyntaxKind.QuestionQuestionToken) {
          takeRight = left === null;
        } else {
          const truth = primitiveToBoolean(left);
          takeRight =
            operator === ts.SyntaxKind.AmpersandAmpersandToken ? truth : !truth;
        }
      }
      if (takeRight === false) return [];
    }
    return processTrackedExpressionToSink(
      current.right,
      afterLeft,
      context,
      sinkCall,
    );
  }

  if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
    let ordered = states;
    if (nodeContains(current.expression, sinkCall)) {
      return processTrackedExpressionToSink(
        current.expression,
        ordered,
        context,
        sinkCall,
      );
    }
    ordered = processTrackedExpression(current.expression, ordered, context);
    for (const argument of current.arguments ?? []) {
      if (nodeContains(argument, sinkCall)) {
        return processTrackedExpressionToSink(
          argument,
          ordered,
          context,
          sinkCall,
        );
      }
      ordered = processTrackedExpression(argument, ordered, context);
    }
    return ordered;
  }

  if (ts.isCommaListExpression(current)) {
    let ordered = states;
    for (const element of current.elements) {
      if (nodeContains(element, sinkCall)) {
        return processTrackedExpressionToSink(
          element,
          ordered,
          context,
          sinkCall,
        );
      }
      ordered = processTrackedExpression(element, ordered, context);
    }
    return ordered;
  }

  if (ts.isPropertyAccessExpression(current)) {
    return nodeContains(current.expression, sinkCall)
      ? processTrackedExpressionToSink(
          current.expression,
          states,
          context,
          sinkCall,
        )
      : processTrackedExpression(current.expression, states, context);
  }

  if (ts.isElementAccessExpression(current)) {
    if (nodeContains(current.expression, sinkCall)) {
      return processTrackedExpressionToSink(
        current.expression,
        states,
        context,
        sinkCall,
      );
    }
    const afterBase = processTrackedExpression(
      current.expression,
      states,
      context,
    );
    if (
      current.argumentExpression !== undefined &&
      nodeContains(current.argumentExpression, sinkCall)
    ) {
      return processTrackedExpressionToSink(
        current.argumentExpression,
        afterBase,
        context,
        sinkCall,
      );
    }
    return current.argumentExpression === undefined
      ? afterBase
      : processTrackedExpression(
          current.argumentExpression,
          afterBase,
          context,
        );
  }

  if (ts.isSpreadElement(current)) {
    return nodeContains(current.expression, sinkCall)
      ? processTrackedExpressionToSink(
          current.expression,
          states,
          context,
          sinkCall,
        )
      : processTrackedExpression(current.expression, states, context);
  }

  if (ts.isArrayLiteralExpression(current)) {
    let ordered = states;
    for (const element of current.elements) {
      if (ts.isOmittedExpression(element)) continue;
      const expression = ts.isSpreadElement(element)
        ? element.expression
        : element;
      if (nodeContains(expression, sinkCall)) {
        return processTrackedExpressionToSink(
          expression,
          ordered,
          context,
          sinkCall,
        );
      }
      ordered = processTrackedExpression(expression, ordered, context);
    }
    return ordered;
  }

  if (ts.isObjectLiteralExpression(current)) {
    let ordered = states;
    for (const property of current.properties) {
      if (
        property.name !== undefined &&
        ts.isComputedPropertyName(property.name)
      ) {
        if (nodeContains(property.name.expression, sinkCall)) {
          return processTrackedExpressionToSink(
            property.name.expression,
            ordered,
            context,
            sinkCall,
          );
        }
        ordered = processTrackedExpression(
          property.name.expression,
          ordered,
          context,
        );
      }
      const expression = ts.isSpreadAssignment(property)
        ? property.expression
        : ts.isPropertyAssignment(property)
          ? property.initializer
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : undefined;
      if (expression === undefined) continue;
      if (nodeContains(expression, sinkCall)) {
        return processTrackedExpressionToSink(
          expression,
          ordered,
          context,
          sinkCall,
        );
      }
      ordered = processTrackedExpression(expression, ordered, context);
    }
    return ordered;
  }

  if (ts.isTemplateExpression(current)) {
    let ordered = states;
    for (const span of current.templateSpans) {
      if (nodeContains(span.expression, sinkCall)) {
        return processTrackedExpressionToSink(
          span.expression,
          ordered,
          context,
          sinkCall,
        );
      }
      ordered = processTrackedExpression(span.expression, ordered, context);
    }
    return ordered;
  }

  if (ts.isTaggedTemplateExpression(current)) {
    if (nodeContains(current.tag, sinkCall)) {
      return processTrackedExpressionToSink(
        current.tag,
        states,
        context,
        sinkCall,
      );
    }
    const afterTag = processTrackedExpression(current.tag, states, context);
    return nodeContains(current.template, sinkCall)
      ? processTrackedExpressionToSink(
          current.template,
          afterTag,
          context,
          sinkCall,
        )
      : processTrackedExpression(current.template, afterTag, context);
  }

  if (
    ts.isPrefixUnaryExpression(current) ||
    ts.isPostfixUnaryExpression(current) ||
    ts.isVoidExpression(current) ||
    ts.isTypeOfExpression(current) ||
    ts.isDeleteExpression(current) ||
    ts.isAwaitExpression(current) ||
    ts.isYieldExpression(current)
  ) {
    const expression = current.expression ?? current.operand;
    return expression === undefined || !nodeContains(expression, sinkCall)
      ? states
      : processTrackedExpressionToSink(expression, states, context, sinkCall);
  }

  return invalidateForUnsupportedMutation(
    current,
    states,
    context,
    sinkCall.getStart(),
  );
}

function processTrackedVariableDeclarationList(list, states, context) {
  let current = states;
  for (const declaration of list.declarations) {
    if (declaration === context.declaration) continue;
    if (declaration.initializer !== undefined) {
      current = processTrackedExpression(
        declaration.initializer,
        current,
        context,
      );
    }
    if (!ts.isIdentifier(declaration.name)) {
      current = invalidateForUnsupportedMutation(
        declaration.name,
        current,
        context,
      );
    }
  }
  return current;
}

function processTrackedVariableDeclarationListToSink(
  list,
  states,
  context,
  sinkCall,
) {
  let current = states;
  for (const declaration of list.declarations) {
    if (declaration === context.declaration) continue;
    if (declaration.initializer === undefined) continue;
    if (nodeContains(declaration.initializer, sinkCall)) {
      return processTrackedExpressionToSink(
        declaration.initializer,
        current,
        context,
        sinkCall,
      );
    }
    current = processTrackedExpression(
      declaration.initializer,
      current,
      context,
    );
    if (!ts.isIdentifier(declaration.name)) {
      if (nodeContains(declaration.name, sinkCall)) {
        return processTrackedExpressionToSink(
          declaration.name,
          current,
          context,
          sinkCall,
        );
      }
      current = invalidateForUnsupportedMutation(
        declaration.name,
        current,
        context,
      );
    }
  }
  return current;
}

function processTrackedForInitializer(initializer, states, context) {
  return ts.isVariableDeclarationList(initializer)
    ? processTrackedVariableDeclarationList(initializer, states, context)
    : processTrackedExpression(initializer, states, context);
}

function loopAbruptPolicy(statement) {
  if (ts.isBreakStatement(statement)) return "break";
  if (ts.isContinueStatement(statement)) return "continue";
  if (!ts.isBlock(statement)) return "none";
  for (const child of statement.statements) {
    if (ts.isBreakStatement(child)) return "break";
    if (ts.isContinueStatement(child)) return "continue";
  }
  let ambiguous = false;
  function visit(node) {
    if (ambiguous) return;
    if (
      node !== statement &&
      (ts.isFunctionLike(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isIterationStatement(node, false))
    ) {
      return;
    }
    if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
      ambiguous = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(statement);
  return ambiguous ? "ambiguous" : "none";
}

function unknownTrackedStates(states) {
  const unknown = cloneTrackedObjectStates(states);
  for (const state of unknown) invalidateTrackedState(state);
  return unknown;
}

function processTrackedStatement(statement, states, context) {
  if (ts.isBlock(statement)) {
    let current = states;
    for (const child of statement.statements) {
      if (ts.isBreakStatement(child) || ts.isContinueStatement(child)) {
        return current;
      }
      current = processTrackedStatement(child, current, context);
      if (current.length === 0) return current;
    }
    return current;
  }
  if (ts.isIfStatement(statement)) {
    const conditioned = processTrackedExpression(
      statement.expression,
      states,
      context,
    );
    const condition = evaluateConstant(statement.expression, context.checker);
    const truth =
      condition === UNKNOWN ? UNKNOWN : primitiveToBoolean(condition);
    if (truth === true) {
      return processTrackedStatement(
        statement.thenStatement,
        conditioned,
        context,
      );
    }
    if (truth === false) {
      return statement.elseStatement === undefined
        ? conditioned
        : processTrackedStatement(
            statement.elseStatement,
            conditioned,
            context,
          );
    }
    const whenTrue = processTrackedStatement(
      statement.thenStatement,
      cloneTrackedObjectStates(conditioned),
      context,
    );
    const whenFalse =
      statement.elseStatement === undefined
        ? cloneTrackedObjectStates(conditioned)
        : processTrackedStatement(
            statement.elseStatement,
            cloneTrackedObjectStates(conditioned),
            context,
          );
    return boundedObjectStates([...whenTrue, ...whenFalse], context.names);
  }
  if (
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement) ||
    ts.isForStatement(statement)
  ) {
    let entry = cloneTrackedObjectStates(states);
    if (ts.isForStatement(statement) && statement.initializer !== undefined) {
      entry = processTrackedForInitializer(
        statement.initializer,
        entry,
        context,
      );
    }
    const condition = ts.isForStatement(statement)
      ? statement.condition
      : statement.expression;
    let truth = true;
    if (!ts.isDoStatement(statement) && condition !== undefined) {
      entry = processTrackedExpression(condition, entry, context);
      truth = expressionTruth(condition, context.checker);
    }
    if (!ts.isDoStatement(statement) && truth === false) return entry;
    const abrupt = loopAbruptPolicy(statement.statement);
    if (abrupt === "ambiguous") {
      return boundedObjectStates(
        [...entry, ...unknownTrackedStates(entry)],
        context.names,
      );
    }
    let iterated = processTrackedStatement(
      statement.statement,
      cloneTrackedObjectStates(entry),
      context,
    );
    if (
      abrupt !== "break" &&
      ts.isForStatement(statement) &&
      statement.incrementor !== undefined
    ) {
      iterated = processTrackedExpression(
        statement.incrementor,
        iterated,
        context,
      );
    }
    if (ts.isDoStatement(statement)) {
      if (abrupt !== "break") {
        iterated = processTrackedExpression(
          statement.expression,
          iterated,
          context,
        );
      }
      return iterated;
    }
    return truth === true && abrupt === "break"
      ? iterated
      : boundedObjectStates([...entry, ...iterated], context.names);
  }
  if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
    const entry = processTrackedExpression(
      statement.expression,
      cloneTrackedObjectStates(states),
      context,
    );
    const iteratedEntry = invalidateForUnsupportedMutation(
      statement.initializer,
      cloneTrackedObjectStates(entry),
      context,
    );
    const iterated = processTrackedStatement(
      statement.statement,
      iteratedEntry,
      context,
    );
    return boundedObjectStates([...entry, ...iterated], context.names);
  }
  if (
    ts.isSwitchStatement(statement) ||
    ts.isTryStatement(statement) ||
    ts.isWithStatement(statement)
  ) {
    const events = collectTrackedObjectEvents(
      statement,
      context.symbol,
      context.declaration,
      context.checker,
      context.bindings,
      Number.POSITIVE_INFINITY,
      context.budget,
    );
    if (events.length > 0) {
      for (const state of states) invalidateTrackedState(state);
    }
    return states;
  }
  if (ts.isExpressionStatement(statement)) {
    return processTrackedExpression(statement.expression, states, context);
  }
  if (ts.isVariableStatement(statement)) {
    return processTrackedVariableDeclarationList(
      statement.declarationList,
      states,
      context,
    );
  }
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
    if (statement.expression !== undefined) {
      processTrackedExpression(statement.expression, states, context);
    }
    return [];
  }
  return invalidateForUnsupportedMutation(statement, states, context);
}

function processTrackedStatementToSink(statement, states, context, sinkCall) {
  if (ts.isBlock(statement)) {
    let current = states;
    for (const child of statement.statements) {
      if (nodeContains(child, sinkCall)) {
        return processTrackedStatementToSink(child, current, context, sinkCall);
      }
      if (
        ts.isBreakStatement(child) ||
        ts.isContinueStatement(child) ||
        ts.isReturnStatement(child) ||
        ts.isThrowStatement(child)
      ) {
        return [];
      }
      current = processTrackedStatement(child, current, context);
    }
    return current;
  }

  if (
    ts.isSwitchStatement(statement) ||
    ts.isTryStatement(statement) ||
    ts.isWithStatement(statement)
  ) {
    return [];
  }
  if (ts.isIfStatement(statement)) {
    if (nodeContains(statement.expression, sinkCall)) {
      return processTrackedExpressionToSink(
        statement.expression,
        states,
        context,
        sinkCall,
      );
    }
    const current = processTrackedExpression(
      statement.expression,
      states,
      context,
      sinkCall.getStart(),
    );
    const truth = expressionTruth(statement.expression, context.checker);
    if (nodeContains(statement.thenStatement, sinkCall)) {
      return truth === false
        ? []
        : processTrackedStatementToSink(
            statement.thenStatement,
            current,
            context,
            sinkCall,
          );
    }
    if (
      statement.elseStatement !== undefined &&
      nodeContains(statement.elseStatement, sinkCall)
    ) {
      return truth === true
        ? []
        : processTrackedStatementToSink(
            statement.elseStatement,
            current,
            context,
            sinkCall,
          );
    }
  }

  if (
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement) ||
    ts.isForStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement)
  ) {
    let entry = states;
    if (ts.isForStatement(statement) && statement.initializer !== undefined) {
      if (nodeContains(statement.initializer, sinkCall)) {
        return ts.isVariableDeclarationList(statement.initializer)
          ? processTrackedVariableDeclarationListToSink(
              statement.initializer,
              entry,
              context,
              sinkCall,
            )
          : processTrackedExpressionToSink(
              statement.initializer,
              entry,
              context,
              sinkCall,
            );
      }
      entry = processTrackedForInitializer(
        statement.initializer,
        entry,
        context,
      );
    }

    const condition = ts.isForStatement(statement)
      ? statement.condition
      : ts.isForInStatement(statement) || ts.isForOfStatement(statement)
        ? undefined
        : statement.expression;
    if (
      condition !== undefined &&
      !ts.isDoStatement(statement) &&
      nodeContains(condition, sinkCall)
    ) {
      return processTrackedExpressionToSink(
        condition,
        entry,
        context,
        sinkCall,
      );
    }
    if (condition !== undefined && !ts.isDoStatement(statement)) {
      entry = processTrackedExpression(condition, entry, context);
      if (expressionTruth(condition, context.checker) === false) return [];
    }
    if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
      entry = invalidateForUnsupportedMutation(
        statement.initializer,
        entry,
        context,
      );
    }
    if (nodeContains(statement.statement, sinkCall)) {
      return processTrackedStatementToSink(
        statement.statement,
        entry,
        context,
        sinkCall,
      );
    }
    let afterBody = processTrackedStatement(
      statement.statement,
      entry,
      context,
    );
    if (ts.isDoStatement(statement)) {
      if (nodeContains(statement.expression, sinkCall)) {
        return processTrackedExpressionToSink(
          statement.expression,
          afterBody,
          context,
          sinkCall,
        );
      }
      afterBody = processTrackedExpression(
        statement.expression,
        afterBody,
        context,
      );
    }
    if (
      ts.isForStatement(statement) &&
      statement.incrementor !== undefined &&
      nodeContains(statement.incrementor, sinkCall)
    ) {
      return processTrackedExpressionToSink(
        statement.incrementor,
        afterBody,
        context,
        sinkCall,
      );
    }
    return afterBody;
  }

  if (ts.isVariableStatement(statement)) {
    return processTrackedVariableDeclarationListToSink(
      statement.declarationList,
      states,
      context,
      sinkCall,
    );
  }
  if (ts.isExpressionStatement(statement)) {
    return processTrackedExpressionToSink(
      statement.expression,
      states,
      context,
      sinkCall,
    );
  }
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
    return statement.expression === undefined
      ? states
      : processTrackedExpressionToSink(
          statement.expression,
          states,
          context,
          sinkCall,
        );
  }
  return invalidateForUnsupportedMutation(
    statement,
    states,
    context,
    sinkCall.getStart(),
  );
}

function splitSequenceResult(node) {
  const prefixes = [];
  let current = unwrapExpression(node);
  let depth = 0;
  while (depth < MAX_STRUCTURAL_DEPTH) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      return null;
    }
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      prefixes.push(current.left);
      current = unwrapExpression(current.right);
      depth += 1;
      continue;
    }
    if (ts.isCommaListExpression(current) && current.elements.length > 0) {
      prefixes.push(...current.elements.slice(0, -1));
      current = unwrapExpression(current.elements.at(-1));
      depth += 1;
      continue;
    }
    return { prefixes, result: current };
  }
  return null;
}

function processSinkArgumentEffects(
  call,
  optionNode,
  prefixes,
  states,
  context,
) {
  let current = states;
  for (const argument of call.arguments ?? []) {
    if (argument === optionNode) {
      for (const prefix of prefixes) {
        current = processTrackedExpression(prefix, current, context);
      }
      continue;
    }
    current = processTrackedExpression(argument, current, context);
  }
  return current;
}

function trackedObjectStatesAtSink(node, names, sinkCall, checker, bindings) {
  const sequence = splitSequenceResult(node);
  if (sequence === null) return [];
  const current = sequence.result;
  if (ts.isObjectLiteralExpression(current)) {
    return [stateFromObjectLiteral(current, names, checker)];
  }
  if (!ts.isIdentifier(current)) return [];
  const symbol = checker.getSymbolAtLocation(current);
  const resolved = variableInitializerFromSymbol(symbol);
  if (symbol === undefined || resolved === null) return [];
  const initializer = unwrapExpression(resolved.initializer);
  if (!ts.isObjectLiteralExpression(initializer)) return [];

  const declarationStatement = enclosingStatement(resolved.declaration);
  const container = declarationStatement?.parent;
  if (
    declarationStatement === null ||
    container === undefined ||
    (!ts.isBlock(container) && !ts.isSourceFile(container))
  ) {
    return [];
  }
  const sinkStatement = statementChildOf(container, sinkCall);
  if (sinkStatement === null || crossesDeferredBoundary(sinkCall, container)) {
    // A nested function/method/class captures the object and runs later. This
    // bounded analysis does not infer invocation-time heap state, so the
    // captured object's reviewed properties are UNKNOWN at that nested sink.
    return [];
  }
  const declarationIndex = container.statements.indexOf(declarationStatement);
  const sinkIndex = container.statements.indexOf(sinkStatement);
  if (
    declarationIndex < 0 ||
    sinkIndex < declarationIndex ||
    resolved.initializer.end > sinkCall.getStart()
  ) {
    return [];
  }

  const context = {
    bindings,
    budget: { steps: 0 },
    checker,
    declaration: resolved.declaration,
    names,
    symbol,
  };
  let states = [stateFromObjectLiteral(initializer, names, checker)];
  if (sinkIndex === declarationIndex) {
    states = processTrackedStatementToSink(
      declarationStatement,
      states,
      context,
      sinkCall,
    );
  } else {
    states = processTrackedStatement(declarationStatement, states, context);
    for (let index = declarationIndex + 1; index < sinkIndex; index += 1) {
      states = processTrackedStatement(
        container.statements[index],
        states,
        context,
      );
    }
    states = processTrackedStatementToSink(
      sinkStatement,
      states,
      context,
      sinkCall,
    );
  }
  return processSinkArgumentEffects(
    sinkCall,
    node,
    sequence.prefixes,
    states,
    context,
  );
}

function inspectChildProcessOptions(
  node,
  call,
  relativePath,
  source,
  checker,
  bindings,
  findings,
) {
  const states = trackedObjectStatesAtSink(
    node,
    CHILD_PROCESS_OPTION_PROPERTIES,
    call,
    checker,
    bindings,
  );
  for (const state of states) {
    for (const [name, property] of state.properties) {
      for (const { node: valueNode, symbolOverride } of propertyReferences(
        property,
      )) {
        if (name === "shell") {
          if (
            evaluateConstant(valueNode, checker, undefined, symbolOverride) ===
            true
          ) {
            findings.push({
              path: relativePath,
              line: lineOf(source, valueNode),
              kind: "shell-true",
              detail: "shell=true",
            });
          }
          inspectOperationalStructure(
            valueNode,
            relativePath,
            source,
            checker,
            bindings,
            findings,
            "command",
            new Set(),
            0,
            symbolOverride,
          );
        } else if (name === "execArgv") {
          inspectOperationalArray(
            valueNode,
            relativePath,
            source,
            checker,
            bindings,
            findings,
            "path",
            symbolOverride,
          );
        } else {
          inspectOperationalStructure(
            valueNode,
            relativePath,
            source,
            checker,
            bindings,
            findings,
            "path",
            new Set(),
            0,
            symbolOverride,
          );
        }
      }
    }
  }
}

function inspectSinkArguments(
  call,
  sink,
  relativePath,
  source,
  checker,
  bindings,
  findings,
) {
  const args = call.arguments ?? [];
  const inspectIndices = (indices, classification = "path") => {
    for (const index of indices) {
      const argument = args[index];
      if (argument === undefined) continue;
      inspectOperationalStructure(
        argument,
        relativePath,
        source,
        checker,
        bindings,
        findings,
        classification,
      );
    }
  };

  if (sink.kind === "child-process") {
    const signature = CHILD_PROCESS_ARGUMENTS.get(sink.operation);
    if (signature === undefined) return;
    inspectIndices(signature.values, "command");
    for (const index of signature.arrays) {
      const argument = args[index];
      if (argument !== undefined) {
        inspectOperationalArray(
          argument,
          relativePath,
          source,
          checker,
          bindings,
          findings,
          "command",
        );
      }
    }
    for (const index of signature.options) {
      const argument = args[index];
      if (argument !== undefined) {
        inspectChildProcessOptions(
          argument,
          call,
          relativePath,
          source,
          checker,
          bindings,
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
  // node:path calls are pure fact producers, not sinks. Their abstract result
  // is inspected only if it later reaches one of the reviewed positions above
  // or a process path position below.
  if (sink.kind === "path") return;
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
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const sink = resolveSink(node.expression, checker, bindings);
      if (sink !== undefined) {
        inspectSinkArguments(
          node,
          sink,
          relativePath,
          source,
          checker,
          bindings,
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
