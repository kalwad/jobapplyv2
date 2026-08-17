#!/usr/bin/env node
// Syntax-aware PORT-SRC-008 helper. Python owns policy orchestration; this
// Node boundary uses the repository-pinned TypeScript compiler and never
// executes repository source.
//
// The policy has five deliberately separate semantic layers:
// 1. Primitive constants: a bounded evaluator implements an allowlisted
//    primitive-only subset of JavaScript coercion. Unsupported, mutable,
//    cyclic, or over-budget expressions are UNKNOWN.
// 2. Pure operational expressions: trusted node:path join/resolve calls over
//    known strings produce bounded abstract path facts without executing
//    repository code or calling host path functions.
// 3. Local property state: child-process option objects that originate in a
//    local object literal are tracked to the sink across ordered writes and a
//    small control-flow model. Unsupported aliasing/mutation invalidates facts.
// 4. Exact provenance and invocation roles: a version-locked closed Node API
//    graph distinguishes executables, argv data, shell commands, options, and
//    path sinks. Arbitrary members/data terminate trusted provenance.
// 5. Catalog completeness: a pinned declaration oracle forces every reviewed
//    callable surface to remain operational or explicitly non-operational.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import ts from "typescript";

const BANNED_PATH = /(?<![\w:/#.-])\/(tmp|bin|usr|etc|var)(?![\w.-])/;
const WRAPPER_PATTERNS = [
  {
    pattern: /(?:^|[ \t\r\n;&|(])bash[ \t]+-(lc|c)(?=$|[ \t])/,
    shell: "bash",
  },
  {
    pattern: /(?:^|[ \t\r\n;&|(])sh[ \t]+-(lc|c)(?=$|[ \t])/,
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
const MAX_LOOP_FIXED_POINT_STEPS = 128;
const MAX_KNOWN_LOOP_ITERATIONS = 128;
const MAX_TOTAL_EXACT_LOOP_REPLAYS = 1_024;
const CATALOG_URL = new URL(
  "./typescript-portability-node24-catalog.v1.json",
  import.meta.url,
);
const require = createRequire(import.meta.url);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactPackageVersion(packageName) {
  const path = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(manifest) || typeof manifest.version !== "string") {
    throw new Error(`malformed ${packageName} package metadata`);
  }
  return manifest.version;
}

function validateIndexArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.some(
      (index, position) =>
        !Number.isInteger(index) ||
        index < 0 ||
        (position > 0 && value[position - 1] >= index),
    )
  ) {
    throw new Error(`malformed Node portability catalog ${label}`);
  }
}

function loadNodeCatalog() {
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(CATALOG_URL, "utf8"));
  } catch (error) {
    throw new Error(
      `unable to load Node portability catalog: ${error.message}`,
      {
        cause: error,
      },
    );
  }
  if (
    !isRecord(catalog) ||
    catalog.schema_version !== 1 ||
    !isRecord(catalog.metadata) ||
    !isRecord(catalog.modules)
  ) {
    throw new Error("malformed Node portability catalog root");
  }
  const expected = {
    node_runtime: process.versions.node,
    node_policy: process.versions.node.split(".").slice(0, 2).join("."),
    typescript: ts.version,
    types_node: exactPackageVersion("@types/node"),
  };
  for (const [name, actual] of Object.entries(expected)) {
    if (catalog.metadata[name] !== actual) {
      throw new Error(
        `Node portability catalog ${name} mismatch: expected ${actual}, got ${String(catalog.metadata[name])}`,
      );
    }
  }
  const allowedCallableKinds = new Set([
    "child-process",
    "filesystem-path",
    "non-operational",
    "path-compose",
    "process-execve",
    "process-path",
  ]);
  const specifiers = new Set();
  for (const [moduleId, module] of Object.entries(catalog.modules)) {
    if (
      !isRecord(module) ||
      !Array.isArray(module.specifiers) ||
      !module.specifiers.every((value) => typeof value === "string") ||
      typeof module.root !== "string" ||
      !isRecord(module.nodes) ||
      !isRecord(module.nodes[module.root])
    ) {
      throw new Error(`malformed Node portability catalog module ${moduleId}`);
    }
    for (const specifier of module.specifiers) {
      if (specifiers.has(specifier)) {
        throw new Error(`duplicate Node portability specifier ${specifier}`);
      }
      specifiers.add(specifier);
    }
    for (const [nodeId, node] of Object.entries(module.nodes)) {
      if (!isRecord(node) || !isRecord(node.members)) {
        throw new Error(
          `malformed Node portability catalog node ${moduleId}.${nodeId}`,
        );
      }
      for (const [memberName, member] of Object.entries(node.members)) {
        const label = `${moduleId}.${nodeId}.${memberName}`;
        if (!isRecord(member)) {
          throw new Error(`malformed Node portability catalog member ${label}`);
        }
        if (
          member.callable !== undefined &&
          !allowedCallableKinds.has(member.callable)
        ) {
          throw new Error(`unknown callable classification at ${label}`);
        }
        if (
          member.callable === "non-operational" &&
          typeof member.rationale !== "string"
        ) {
          throw new Error(`missing non-operational rationale at ${label}`);
        }
        if (member.path_indices !== undefined) {
          validateIndexArray(member.path_indices, `${label}.path_indices`);
        }
        if (member.roles !== undefined && !isRecord(member.roles)) {
          throw new Error(`malformed invocation roles at ${label}`);
        }
        if (
          (member.callable === "filesystem-path" ||
            member.callable === "process-path") &&
          member.path_indices === undefined
        ) {
          throw new Error(`missing path indices at ${label}`);
        }
        if (
          member.callable === "path-compose" &&
          member.operation !== "join" &&
          member.operation !== "resolve"
        ) {
          throw new Error(`unknown path operation at ${label}`);
        }
        if (member.callable === "child-process") {
          if (
            !["exec-default", "truthy-selector", "forced-disabled"].includes(
              member.shell_mode,
            ) ||
            !Array.isArray(member.option_paths) ||
            member.option_paths.length === 0 ||
            !member.option_paths.every((value) => typeof value === "string") ||
            new Set(member.option_paths).size !== member.option_paths.length ||
            !isRecord(member.roles)
          ) {
            throw new Error(`malformed child-process semantics at ${label}`);
          }
          for (const [role, value] of Object.entries(member.roles)) {
            if (role === "options") {
              validateIndexArray(value, `${label}.roles.options`);
            } else if (
              ["argv", "executable", "module_path", "shell_command"].includes(
                role,
              )
            ) {
              if (!Number.isInteger(value) || value < 0) {
                throw new Error(`malformed role index at ${label}.${role}`);
              }
            } else {
              throw new Error(`unknown invocation role ${role} at ${label}`);
            }
          }
          const primaryRoles = [
            "shell_command",
            "executable",
            "module_path",
          ].filter((role) => member.roles[role] !== undefined);
          if (primaryRoles.length !== 1) {
            throw new Error(`ambiguous primary invocation role at ${label}`);
          }
        }
        if (
          member.callable === "process-execve" &&
          (!isRecord(member.roles) ||
            !Number.isInteger(member.roles.executable) ||
            member.roles.executable < 0 ||
            !Number.isInteger(member.roles.argv) ||
            member.roles.argv < 0)
        ) {
          throw new Error(`malformed execve semantics at ${label}`);
        }
        if (member.node !== undefined) {
          const targetModule = member.module ?? moduleId;
          if (
            typeof member.node !== "string" ||
            typeof targetModule !== "string" ||
            !isRecord(catalog.modules[targetModule]) ||
            !isRecord(catalog.modules[targetModule].nodes[member.node])
          ) {
            throw new Error(`unresolved catalog node reference at ${label}`);
          }
        }
        if (member.module !== undefined && member.node === undefined) {
          throw new Error(`catalog module reference lacks node at ${label}`);
        }
      }
    }
  }
  return catalog;
}

const NODE_CATALOG = loadNodeCatalog();
const MODULE_BY_SPECIFIER = new Map(
  Object.entries(NODE_CATALOG.modules).flatMap(([moduleId, module]) =>
    module.specifiers.map((specifier) => [specifier, moduleId]),
  ),
);

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
  return MODULE_BY_SPECIFIER.get(specifier);
}

function catalogRootBinding(moduleId) {
  const module = NODE_CATALOG.modules[moduleId];
  return {
    moduleId,
    nodeId: module.root,
    entry: undefined,
    operationPath: [],
  };
}

function catalogMemberBinding(binding, memberName) {
  if (binding.nodeId === undefined) return undefined;
  // The ESM namespace object exposes the module itself as `default`; only
  // module roots have that property, never individual members.
  if (memberName === "default" && binding.entry === undefined) return binding;
  const node = NODE_CATALOG.modules[binding.moduleId]?.nodes[binding.nodeId];
  const member = node?.members?.[memberName];
  if (member === undefined) return undefined;
  const moduleId = member.module ?? binding.moduleId;
  return {
    moduleId,
    nodeId: member.node,
    parentNodeId: binding.nodeId,
    entry: member,
    operationPath: [...binding.operationPath, memberName],
  };
}

function sinkFromBinding(binding) {
  const entry = binding?.entry;
  if (entry === undefined || entry.callable === undefined) return undefined;
  const operation = binding.operationPath.at(-1);
  if (entry.callable === "child-process") {
    return { kind: "child-process", operation, entry };
  }
  if (entry.callable === "filesystem-path") {
    return { kind: "filesystem", operation, entry };
  }
  if (entry.callable === "path-compose") {
    const node =
      NODE_CATALOG.modules[binding.moduleId].nodes[
        binding.nodeId ?? NODE_CATALOG.modules[binding.moduleId].root
      ];
    // Callable path members do not themselves point at a node. Their flavor is
    // inherited from the namespace node on which the exact member was found.
    const parentNodeId = binding.parentNodeId;
    const parent = NODE_CATALOG.modules[binding.moduleId].nodes[parentNodeId];
    return {
      kind: "path",
      operation: entry.operation ?? operation,
      pathFlavor: parent?.path_flavor ?? node?.path_flavor ?? "host",
      entry,
    };
  }
  if (entry.callable === "process-path") {
    return { kind: "process", operation, entry };
  }
  if (entry.callable === "process-execve") {
    return { kind: "process-execve", operation, entry };
  }
  return undefined;
}

function dynamicImportModuleKind(node) {
  let current = unwrapExpression(node);
  if (!ts.isAwaitExpression(current)) return undefined;
  current = unwrapExpression(current.expression);
  if (
    !ts.isCallExpression(current) ||
    current.expression.kind !== ts.SyntaxKind.ImportKeyword ||
    current.arguments.length !== 1 ||
    !ts.isStringLiteral(current.arguments[0])
  ) {
    return undefined;
  }
  return moduleKind(current.arguments[0].text);
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
  const provenance = new Map();
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
      const moduleId = moduleKind(statement.moduleReference.expression.text);
      const symbol = checker.getSymbolAtLocation(statement.name);
      if (moduleId !== undefined && symbol !== undefined) {
        provenance.set(symbol, catalogRootBinding(moduleId));
      }
      continue;
    }
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const moduleId = moduleKind(statement.moduleSpecifier.text);
    const clause = statement.importClause;
    if (moduleId === undefined || clause === undefined || clause.isTypeOnly)
      continue;
    if (clause.name !== undefined) {
      const symbol = checker.getSymbolAtLocation(clause.name);
      if (symbol !== undefined) {
        provenance.set(symbol, catalogRootBinding(moduleId));
      }
    }
    const bindings = clause.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      const symbol = checker.getSymbolAtLocation(bindings.name);
      if (symbol !== undefined) {
        provenance.set(symbol, catalogRootBinding(moduleId));
      }
      continue;
    }
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (symbol === undefined) continue;
      const importedName = (element.propertyName ?? element.name).text;
      // `default as` resolves through the same catalog rule that models the
      // ESM namespace `default` member: the module root itself.
      const binding = catalogMemberBinding(
        catalogRootBinding(moduleId),
        importedName,
      );
      if (binding !== undefined) {
        provenance.set(symbol, binding);
      }
    }
  }

  {
    function visitModuleBinding(node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const moduleId =
          requireModuleKind(node.initializer, checker, allowCommonJs) ??
          dynamicImportModuleKind(node.initializer);
        if (moduleId !== undefined && ts.isObjectBindingPattern(node.name)) {
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
            const binding = catalogMemberBinding(
              catalogRootBinding(moduleId),
              importedName,
            );
            if (binding !== undefined) {
              provenance.set(symbol, binding);
            }
          }
        }
      }
      ts.forEachChild(node, visitModuleBinding);
    }
    visitModuleBinding(source);
  }
  return { allowCommonJs, provenance };
}

function constCalleeInitializer(identifier, checker, seen) {
  const resolved = constInitializer(identifier, checker);
  if (resolved === null || seen.has(resolved.declaration)) return null;
  seen.add(resolved.declaration);
  return resolved.initializer;
}

function resolveProvenance(node, checker, bindings, seen = new Set()) {
  const current = unwrapExpression(node);
  const required = requireModuleKind(current, checker, bindings.allowCommonJs);
  if (required !== undefined) return catalogRootBinding(required);
  const dynamicKind = dynamicImportModuleKind(current);
  if (dynamicKind !== undefined) return catalogRootBinding(dynamicKind);
  if (
    ts.isCallExpression(current) &&
    current.arguments.length === 1 &&
    ts.isStringLiteral(current.arguments[0])
  ) {
    // process.getBuiltinModule("specifier") mints the reviewed module itself.
    const callee = resolveProvenance(
      current.expression,
      checker,
      bindings,
      seen,
    );
    if (
      callee?.moduleId === "process" &&
      callee.operationPath.at(-1) === "getBuiltinModule"
    ) {
      const target = moduleKind(current.arguments[0].text);
      if (target !== undefined) return catalogRootBinding(target);
    }
  }
  if (ts.isIdentifier(current)) {
    const symbol = checker.getSymbolAtLocation(current);
    const direct =
      symbol === undefined ? undefined : bindings.provenance.get(symbol);
    if (direct !== undefined) return direct;
    if (
      current.text === "process" &&
      (symbol?.declarations === undefined ||
        symbol.declarations.every(
          (declaration) => declaration.getSourceFile().isDeclarationFile,
        ))
    ) {
      // The ambient Node global `process` is the process module itself; a
      // local declaration shadows it and terminates this provenance.
      return catalogRootBinding(moduleKind("node:process"));
    }
    const initializer = constCalleeInitializer(current, checker, seen);
    // A plain const alias preserves exact provenance. Type assertions and
    // transformed/augmented views intentionally terminate module identity.
    if (
      initializer === null ||
      ts.isAsExpression(initializer) ||
      ts.isTypeAssertionExpression(initializer) ||
      ts.isSatisfiesExpression(initializer)
    ) {
      return undefined;
    }
    return resolveProvenance(initializer, checker, bindings, seen);
  }
  if (ts.isPropertyAccessExpression(current)) {
    const base = resolveProvenance(current.expression, checker, bindings, seen);
    return base === undefined
      ? undefined
      : catalogMemberBinding(base, current.name.text);
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression !== undefined
  ) {
    const base = resolveProvenance(current.expression, checker, bindings, seen);
    const member = evaluateConstant(current.argumentExpression, checker);
    return base === undefined || typeof member !== "string"
      ? undefined
      : catalogMemberBinding(base, member);
  }
  return undefined;
}

function resolveSink(node, checker, bindings, seen = new Set()) {
  return sinkFromBinding(resolveProvenance(node, checker, bindings, seen));
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

// Longest constant leading run of an array expression. Elements after the
// first unresolvable spread or elision keep no reliable index, so they are
// dropped and the prefix is marked incomplete; the known prefix indices stay
// exact.
function constantArrayPrefix(
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
    return constantArrayPrefix(
      resolved.initializer,
      checker,
      nextSeen,
      depth + 1,
    );
  }
  if (!ts.isArrayLiteralExpression(current)) return null;
  const elements = [];
  for (const element of current.elements) {
    if (ts.isOmittedExpression(element)) return { elements, complete: false };
    if (ts.isSpreadElement(element)) {
      const spread = constantArrayPrefix(
        element.expression,
        checker,
        seen,
        depth + 1,
      );
      if (spread === null) return { elements, complete: false };
      elements.push(...spread.elements);
      if (!spread.complete) return { elements, complete: false };
    } else {
      elements.push(element);
    }
  }
  return { elements, complete: true };
}

// Node dispatches the (command, args-or-options, ...) overloads on
// Array.isArray, so a syntactic array literal (through const aliases) proves
// the argv role even when its element values stay UNKNOWN.
function isArgvArrayExpression(node, checker, seen = new Set(), depth = 0) {
  if (depth > MAX_STRUCTURAL_DEPTH) return false;
  const current = unwrapExpression(node);
  if (ts.isArrayLiteralExpression(current)) return true;
  if (!ts.isIdentifier(current)) return false;
  const resolved = constInitializer(current, checker);
  if (resolved === null || seen.has(resolved.declaration)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(resolved.declaration);
  return isArgvArrayExpression(
    resolved.initializer,
    checker,
    nextSeen,
    depth + 1,
  );
}

function provablyUndefinedValue(node, checker) {
  const current = unwrapExpression(node);
  if (!ts.isIdentifier(current) || current.text !== "undefined") return false;
  const declarations = checker.getSymbolAtLocation(current)?.declarations;
  return (
    declarations === undefined ||
    declarations.every(
      (declaration) => declaration.getSourceFile().isDeclarationFile,
    )
  );
}

function provablyNullishValue(node, checker) {
  return (
    evaluateConstant(node, checker) === null ||
    provablyUndefinedValue(node, checker)
  );
}

function childProcessInvocation(call, sink, checker) {
  const args = call.arguments ?? [];
  const roles = sink.entry.roles;
  const invocation = {
    argvIndex: undefined,
    commandIndex: roles.shell_command,
    executableIndex: roles.executable,
    modulePathIndex: roles.module_path,
    optionsIndex: undefined,
  };
  if (roles.argv === undefined) {
    const candidate = roles.options?.[0];
    const argument = candidate === undefined ? undefined : args[candidate];
    invocation.optionsIndex =
      argument === undefined ||
      argumentIsFunction(argument, checker) ||
      provablyNullishValue(argument, checker)
        ? undefined
        : candidate;
    return invocation;
  }
  const argvSlot = args[roles.argv];
  if (
    argvSlot !== undefined &&
    !isArgvArrayExpression(argvSlot, checker) &&
    (resolveOptionTargets(argvSlot, checker).length > 0 ||
      provablyNullishValue(argvSlot, checker))
  ) {
    // The documented (file, options[, callback]) overloads place a provable
    // non-array options bag in the argv slot; Node dispatches on
    // Array.isArray.
    invocation.optionsIndex = roles.argv;
    return invocation;
  }
  if (args.length >= 3) {
    invocation.argvIndex = roles.argv;
    invocation.optionsIndex = roles.options?.find(
      (index) => index > roles.argv,
    );
    return invocation;
  }
  if (argvSlot !== undefined && isArgvArrayExpression(argvSlot, checker)) {
    invocation.argvIndex = roles.argv;
  } else {
    invocation.optionsIndex = roles.options?.[0];
  }
  return invocation;
}

function provablyFunctionType(type) {
  if (type.isUnion()) return type.types.every(provablyFunctionType);
  return type.getCallSignatures().length > 0;
}

function argumentIsFunction(node, checker) {
  const current = unwrapExpression(node);
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    return true;
  }
  if (!ts.isIdentifier(current)) return false;
  const symbol = checker.getSymbolAtLocation(current);
  const declaration = symbol?.valueDeclaration;
  if (
    declaration !== undefined &&
    (ts.isFunctionDeclaration(declaration) ||
      (ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        (ts.isArrowFunction(unwrapExpression(declaration.initializer)) ||
          ts.isFunctionExpression(unwrapExpression(declaration.initializer)))))
  ) {
    return true;
  }
  // A declared function type (for example a typed callback parameter) proves
  // the callback overload even without a syntactic function initializer.
  return provablyFunctionType(checker.getTypeAtLocation(current));
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
  const prefix = constantArrayPrefix(
    node,
    checker,
    new Set(),
    0,
    symbolOverride,
  );
  if (prefix === null) return;
  for (const element of prefix.elements) {
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

function sameResolvedSymbol(identifier, symbol, checker, aliases = new Set()) {
  const resolved = checker.getSymbolAtLocation(identifier);
  return resolved === symbol || aliases.has(resolved);
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
  if (sink?.kind !== "child-process") return false;
  return childProcessInvocation(call, sink, checker).optionsIndex === index;
}

function collectTrackedObjectEvents(
  node,
  symbol,
  aliases,
  declaration,
  checker,
  bindings,
  stopPosition = Number.POSITIVE_INFINITY,
  budget = { steps: 0 },
  startPosition = Number.NEGATIVE_INFINITY,
) {
  const events = new Map();
  function isSupportedOptionAliasRead(identifier) {
    let current = identifier.parent;
    while (current !== undefined && !ts.isStatement(current)) {
      if (
        ts.isVariableDeclaration(current) &&
        current.initializer !== undefined &&
        nodeContains(current.initializer, identifier) &&
        ts.isVariableDeclarationList(current.parent) &&
        (current.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        return resolveOptionTargets(current.initializer, checker).some(
          (target) =>
            ts.isIdentifier(target) &&
            checker.getSymbolAtLocation(target) === symbol,
        );
      }
      current = current.parent;
    }
    return false;
  }
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
      sameResolvedSymbol(current, symbol, checker, aliases)
    ) {
      const currentSymbol = checker.getSymbolAtLocation(current);
      if (
        ts.isVariableDeclaration(current.parent) &&
        current.parent.name === current &&
        aliases.has(currentSymbol)
      ) {
        return;
      }
      if (isSupportedOptionAliasRead(current)) return;
      if (
        ts.isVariableDeclaration(current.parent) &&
        current.parent.initializer === current &&
        ts.isIdentifier(current.parent.name) &&
        aliases.has(checker.getSymbolAtLocation(current.parent.name))
      ) {
        return;
      }
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
    context.aliases,
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
    sameResolvedSymbol(
      current,
      context.symbol,
      context.checker,
      context.aliases,
    )
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
    !sameResolvedSymbol(
      object,
      context.symbol,
      context.checker,
      context.aliases,
    )
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
    sameResolvedSymbol(
      current,
      context.symbol,
      context.checker,
      context.aliases,
    )
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

  if (ts.isDeleteExpression(current)) {
    const target = unwrapExpression(current.expression);
    if (
      (ts.isPropertyAccessExpression(target) ||
        ts.isElementAccessExpression(target)) &&
      isDirectTrackedIdentifier(target.expression, context)
    ) {
      // delete of a reviewed property is a modeled transition to absent.
      const property = accessPropertyName(target, context.checker);
      return applyTrackedObjectEvents(states, [
        { kind: "delete", node: current, property },
      ]);
    }
    return processTrackedExpression(
      current.expression,
      states,
      context,
      stopPosition,
    );
  }

  if (
    ts.isPrefixUnaryExpression(current) ||
    ts.isPostfixUnaryExpression(current) ||
    ts.isVoidExpression(current) ||
    ts.isTypeOfExpression(current) ||
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

function unknownTrackedStates(states) {
  const unknown = cloneTrackedObjectStates(states);
  for (const state of unknown) invalidateTrackedState(state);
  return unknown;
}

function mergeStateSets(groups, context) {
  return boundedObjectStates(groups.flat(), context.names);
}

function referenceStateKey(reference) {
  const declaration = reference.symbolOverride?.valueDeclaration;
  return `${reference.node.pos}:${reference.node.end}:${declaration?.pos ?? ""}`;
}

function trackedStateSetKey(states, names) {
  const canonical = boundedObjectStates(states, names);
  return canonical
    .map((state) => {
      const properties = [...names].sort().map((name) => {
        const property = state.properties.get(name);
        if (property.kind === "possible") {
          return `${name}:possible:${property.mayBeAbsent}:${property.mayBeUnknown}:${property.references.map(referenceStateKey).sort().join(",")}`;
        }
        if (property.kind === "known") {
          return `${name}:known:${referenceStateKey(property.reference)}`;
        }
        return `${name}:${property.kind}`;
      });
      return `${state.escaped}:${state.identifiable}:${properties.join("|")}`;
    })
    .sort()
    .join("\n");
}

function emptyFlow(states = []) {
  return { normal: states, continues: [], breaks: [] };
}

function mergeFlows(flows, context) {
  return {
    normal: mergeStateSets(
      flows.map((flow) => flow.normal),
      context,
    ),
    continues: mergeStateSets(
      flows.map((flow) => flow.continues),
      context,
    ),
    breaks: mergeStateSets(
      flows.map((flow) => flow.breaks),
      context,
    ),
  };
}

function trackedLoopVariable(statement, checker) {
  if (
    !ts.isForStatement(statement) ||
    statement.initializer === undefined ||
    !ts.isVariableDeclarationList(statement.initializer) ||
    statement.initializer.declarations.length !== 1
  ) {
    return null;
  }
  const declaration = statement.initializer.declarations[0];
  if (
    !ts.isIdentifier(declaration.name) ||
    declaration.initializer === undefined
  ) {
    return null;
  }
  const initial = evaluateConstant(declaration.initializer, checker);
  const symbol = checker.getSymbolAtLocation(declaration.name);
  return typeof initial === "number" && symbol !== undefined
    ? { initial, symbol }
    : null;
}

function loopVariableOperand(node, symbol, checker) {
  const current = unwrapExpression(node);
  return (
    ts.isIdentifier(current) && checker.getSymbolAtLocation(current) === symbol
  );
}

// The exact-iteration model is only sound while the header owns every write
// to the loop variable. Any body write (direct, compound, ++/--, destructured,
// or deferred through a nested function) makes the count unknowable here.
function loopVariableMutatedInBody(body, symbol, checker) {
  let mutated = false;
  function visit(node) {
    if (mutated) return;
    if (ts.isIdentifier(node) && checker.getSymbolAtLocation(node) === symbol) {
      if (crossesDeferredBoundary(node, body)) {
        mutated = true;
        return;
      }
      let cursor = node;
      while (cursor.parent !== undefined && !ts.isStatement(cursor.parent)) {
        const parent = cursor.parent;
        if (
          ts.isBinaryExpression(parent) &&
          isAssignmentOperator(parent.operatorToken.kind) &&
          nodeContains(parent.left, node)
        ) {
          mutated = true;
          return;
        }
        if (
          ((ts.isPrefixUnaryExpression(parent) &&
            (parent.operator === ts.SyntaxKind.PlusPlusToken ||
              parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
            ts.isPostfixUnaryExpression(parent)) &&
          nodeContains(parent.operand, node)
        ) {
          mutated = true;
          return;
        }
        cursor = parent;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(body);
  return mutated;
}

function knownForIterationCount(statement, checker) {
  const variable = trackedLoopVariable(statement, checker);
  if (
    variable === null ||
    statement.condition === undefined ||
    statement.incrementor === undefined
  ) {
    return UNKNOWN;
  }
  if (
    loopVariableMutatedInBody(statement.statement, variable.symbol, checker)
  ) {
    return UNKNOWN;
  }
  const condition = unwrapExpression(statement.condition);
  if (!ts.isBinaryExpression(condition)) return UNKNOWN;
  let bound;
  let test;
  if (loopVariableOperand(condition.left, variable.symbol, checker)) {
    bound = evaluateConstant(condition.right, checker);
    test = (value) => {
      if (condition.operatorToken.kind === ts.SyntaxKind.LessThanToken)
        return value < bound;
      if (condition.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken)
        return value <= bound;
      if (condition.operatorToken.kind === ts.SyntaxKind.GreaterThanToken)
        return value > bound;
      if (condition.operatorToken.kind === ts.SyntaxKind.GreaterThanEqualsToken)
        return value >= bound;
      return UNKNOWN;
    };
  } else if (loopVariableOperand(condition.right, variable.symbol, checker)) {
    bound = evaluateConstant(condition.left, checker);
    test = (value) => {
      if (condition.operatorToken.kind === ts.SyntaxKind.LessThanToken)
        return bound < value;
      if (condition.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken)
        return bound <= value;
      if (condition.operatorToken.kind === ts.SyntaxKind.GreaterThanToken)
        return bound > value;
      if (condition.operatorToken.kind === ts.SyntaxKind.GreaterThanEqualsToken)
        return bound >= value;
      return UNKNOWN;
    };
  } else {
    return UNKNOWN;
  }
  if (typeof bound !== "number" || !Number.isFinite(bound)) return UNKNOWN;

  const incrementor = unwrapExpression(statement.incrementor);
  let step;
  if (
    (ts.isPostfixUnaryExpression(incrementor) ||
      ts.isPrefixUnaryExpression(incrementor)) &&
    loopVariableOperand(incrementor.operand, variable.symbol, checker)
  ) {
    if (incrementor.operator === ts.SyntaxKind.PlusPlusToken) step = 1;
    if (incrementor.operator === ts.SyntaxKind.MinusMinusToken) step = -1;
  } else if (
    ts.isBinaryExpression(incrementor) &&
    loopVariableOperand(incrementor.left, variable.symbol, checker) &&
    (incrementor.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken ||
      incrementor.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken)
  ) {
    const amount = evaluateConstant(incrementor.right, checker);
    if (typeof amount === "number" && Number.isFinite(amount)) {
      step =
        incrementor.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
          ? amount
          : -amount;
    }
  }
  if (step === undefined || step === 0) return UNKNOWN;
  let value = variable.initial;
  for (let count = 0; count <= MAX_KNOWN_LOOP_ITERATIONS; count += 1) {
    const reached = test(value);
    if (reached === UNKNOWN) return UNKNOWN;
    if (!reached) return count;
    value += step;
    if (!Number.isFinite(value)) return UNKNOWN;
  }
  return UNKNOWN;
}

function processTrackedFlow(statement, states, context) {
  if (states.length === 0) return emptyFlow();
  if (ts.isBlock(statement)) {
    let normal = states;
    const continues = [];
    const breaks = [];
    for (const child of statement.statements) {
      if (normal.length === 0) break;
      const flow = processTrackedFlow(child, normal, context);
      continues.push(...flow.continues);
      breaks.push(...flow.breaks);
      normal = flow.normal;
    }
    return {
      normal,
      continues: boundedObjectStates(continues, context.names),
      breaks: boundedObjectStates(breaks, context.names),
    };
  }
  if (ts.isContinueStatement(statement)) {
    return statement.label === undefined
      ? { normal: [], continues: states, breaks: [] }
      : emptyFlow(unknownTrackedStates(states));
  }
  if (ts.isBreakStatement(statement)) {
    return statement.label === undefined
      ? { normal: [], continues: [], breaks: states }
      : emptyFlow(unknownTrackedStates(states));
  }
  if (ts.isIfStatement(statement)) {
    const conditioned = processTrackedExpression(
      statement.expression,
      states,
      context,
    );
    const truth = expressionTruth(statement.expression, context.checker);
    if (truth === true) {
      return processTrackedFlow(statement.thenStatement, conditioned, context);
    }
    if (truth === false) {
      return statement.elseStatement === undefined
        ? emptyFlow(conditioned)
        : processTrackedFlow(statement.elseStatement, conditioned, context);
    }
    return mergeFlows(
      [
        processTrackedFlow(
          statement.thenStatement,
          cloneTrackedObjectStates(conditioned),
          context,
        ),
        statement.elseStatement === undefined
          ? emptyFlow(cloneTrackedObjectStates(conditioned))
          : processTrackedFlow(
              statement.elseStatement,
              cloneTrackedObjectStates(conditioned),
              context,
            ),
      ],
      context,
    );
  }
  if (
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement) ||
    ts.isForStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement)
  ) {
    return emptyFlow(processTrackedLoop(statement, states, context).exits);
  }
  if (ts.isExpressionStatement(statement)) {
    return emptyFlow(
      processTrackedExpression(statement.expression, states, context),
    );
  }
  if (ts.isVariableStatement(statement)) {
    return emptyFlow(
      processTrackedVariableDeclarationList(
        statement.declarationList,
        states,
        context,
      ),
    );
  }
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
    if (statement.expression !== undefined) {
      processTrackedExpression(statement.expression, states, context);
    }
    return emptyFlow();
  }
  if (ts.isEmptyStatement(statement) || ts.isDebuggerStatement(statement)) {
    return emptyFlow(states);
  }
  return emptyFlow(
    invalidateForUnsupportedMutation(statement, states, context),
  );
}

function observeTrackedStatement(statement, states, context, sinkCall) {
  if (states.length === 0) return [];
  if (ts.isBlock(statement)) {
    let normal = states;
    for (const child of statement.statements) {
      if (normal.length === 0) return [];
      if (nodeContains(child, sinkCall)) {
        return observeTrackedStatement(child, normal, context, sinkCall);
      }
      normal = processTrackedFlow(child, normal, context).normal;
    }
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
    const conditioned = processTrackedExpression(
      statement.expression,
      states,
      context,
    );
    const truth = expressionTruth(statement.expression, context.checker);
    if (nodeContains(statement.thenStatement, sinkCall)) {
      return truth === false
        ? []
        : observeTrackedStatement(
            statement.thenStatement,
            conditioned,
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
        : observeTrackedStatement(
            statement.elseStatement,
            conditioned,
            context,
            sinkCall,
          );
    }
    return [];
  }
  if (
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement) ||
    ts.isForStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement)
  ) {
    return processTrackedLoop(statement, states, context, sinkCall)
      .observations;
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
      ? []
      : processTrackedExpressionToSink(
          statement.expression,
          states,
          context,
          sinkCall,
        );
  }
  return [];
}

function referencesTrackedSymbol(node, context, depth = 0) {
  if (depth > MAX_STRUCTURAL_DEPTH) return true;
  if (
    ts.isIdentifier(node) &&
    sameResolvedSymbol(node, context.symbol, context.checker, context.aliases)
  ) {
    return true;
  }
  return (
    ts.forEachChild(node, (child) =>
      referencesTrackedSymbol(child, context, depth + 1) ? true : undefined,
    ) === true
  );
}

function iterationBindingStates(initializer, states, context) {
  if (ts.isVariableDeclarationList(initializer)) {
    return invalidateForUnsupportedMutation(initializer, states, context);
  }
  // An expression binding assigns each iterated value through an arbitrary
  // target on every pass; tracked-object involvement is beyond this bounded
  // model, so any reference invalidates to UNKNOWN.
  return referencesTrackedSymbol(initializer, context)
    ? unknownTrackedStates(states)
    : states;
}

function processTrackedLoop(statement, states, context, sinkCall) {
  const iterates =
    ts.isForInStatement(statement) || ts.isForOfStatement(statement);
  let head = cloneTrackedObjectStates(states);
  const exits = [];
  const observations = [];
  if (ts.isForStatement(statement) && statement.initializer !== undefined) {
    if (sinkCall && nodeContains(statement.initializer, sinkCall)) {
      observations.push(
        ...cloneTrackedObjectStates(
          ts.isVariableDeclarationList(statement.initializer)
            ? processTrackedVariableDeclarationListToSink(
                statement.initializer,
                head,
                context,
                sinkCall,
              )
            : processTrackedExpressionToSink(
                statement.initializer,
                head,
                context,
                sinkCall,
              ),
        ),
      );
    }
    head = processTrackedForInitializer(statement.initializer, head, context);
  }
  if (iterates) {
    // The iterated expression evaluates exactly once at loop entry.
    if (sinkCall && nodeContains(statement.expression, sinkCall)) {
      observations.push(
        ...cloneTrackedObjectStates(
          processTrackedExpressionToSink(
            statement.expression,
            head,
            context,
            sinkCall,
          ),
        ),
      );
    }
    head = processTrackedExpression(statement.expression, head, context);
    const iterable = unwrapExpression(statement.expression);
    const constantIterable = evaluateConstant(
      statement.expression,
      context.checker,
    );
    if (
      (ts.isArrayLiteralExpression(iterable) &&
        iterable.elements.length === 0) ||
      (typeof constantIterable === "string" && constantIterable.length === 0)
    ) {
      // A provably empty iterable never runs the binding or the body.
      return {
        exits: boundedObjectStates(head, context.names),
        observations: boundedObjectStates(observations, context.names),
      };
    }
  }
  const knownIterations = ts.isForStatement(statement)
    ? knownForIterationCount(statement, context.checker)
    : UNKNOWN;
  let exact = knownIterations !== UNKNOWN;
  if (exact) {
    // Nested exact loops replay multiplicatively; once the shared budget is
    // spent, fall back to the bounded fixed point instead of stalling the
    // gate on legal code.
    context.budget.exactLoopReplays =
      (context.budget.exactLoopReplays ?? 0) + knownIterations;
    if (context.budget.exactLoopReplays > MAX_TOTAL_EXACT_LOOP_REPLAYS) {
      exact = false;
    }
  }
  let previousKey = "";
  const limit = exact ? knownIterations : MAX_LOOP_FIXED_POINT_STEPS;
  for (let iteration = 0; iteration < limit; iteration += 1) {
    let bodyEntry = cloneTrackedObjectStates(head);
    const condition = ts.isForStatement(statement)
      ? statement.condition
      : iterates
        ? undefined
        : statement.expression;
    if (iterates) {
      // The iterator can stop before any binding, so every pre-binding state
      // is a possible loop exit, including the zero-iteration entry state.
      exits.push(...cloneTrackedObjectStates(bodyEntry));
      if (
        sinkCall &&
        statement.initializer !== undefined &&
        nodeContains(statement.initializer, sinkCall)
      ) {
        observations.push(
          ...cloneTrackedObjectStates(
            ts.isVariableDeclarationList(statement.initializer)
              ? processTrackedVariableDeclarationListToSink(
                  statement.initializer,
                  bodyEntry,
                  context,
                  sinkCall,
                )
              : processTrackedExpressionToSink(
                  statement.initializer,
                  bodyEntry,
                  context,
                  sinkCall,
                ),
          ),
        );
      }
      bodyEntry = iterationBindingStates(
        statement.initializer,
        bodyEntry,
        context,
      );
    }
    if (!ts.isDoStatement(statement) && condition !== undefined) {
      if (sinkCall && nodeContains(condition, sinkCall)) {
        observations.push(
          ...cloneTrackedObjectStates(
            processTrackedExpressionToSink(
              condition,
              bodyEntry,
              context,
              sinkCall,
            ),
          ),
        );
      }
      bodyEntry = processTrackedExpression(condition, bodyEntry, context);
      const truth = exact ? true : expressionTruth(condition, context.checker);
      if (truth === false) {
        exits.push(...bodyEntry);
        head = [];
        break;
      }
      if (truth === UNKNOWN) exits.push(...cloneTrackedObjectStates(bodyEntry));
    }
    if (sinkCall && nodeContains(statement.statement, sinkCall)) {
      observations.push(
        ...cloneTrackedObjectStates(
          observeTrackedStatement(
            statement.statement,
            bodyEntry,
            context,
            sinkCall,
          ),
        ),
      );
    }
    const body = processTrackedFlow(statement.statement, bodyEntry, context);
    exits.push(...body.breaks);
    let back = mergeStateSets([body.normal, body.continues], context);
    if (
      ts.isForStatement(statement) &&
      statement.incrementor !== undefined &&
      back.length > 0
    ) {
      if (sinkCall && nodeContains(statement.incrementor, sinkCall)) {
        observations.push(
          ...cloneTrackedObjectStates(
            processTrackedExpressionToSink(
              statement.incrementor,
              back,
              context,
              sinkCall,
            ),
          ),
        );
      }
      back = processTrackedExpression(statement.incrementor, back, context);
    }
    if (ts.isDoStatement(statement) && back.length > 0) {
      if (sinkCall && nodeContains(statement.expression, sinkCall)) {
        observations.push(
          ...cloneTrackedObjectStates(
            processTrackedExpressionToSink(
              statement.expression,
              back,
              context,
              sinkCall,
            ),
          ),
        );
      }
      back = processTrackedExpression(statement.expression, back, context);
      const doTruth = expressionTruth(statement.expression, context.checker);
      if (doTruth !== true) exits.push(...cloneTrackedObjectStates(back));
      if (doTruth === false) back = [];
    }
    if (exact) {
      head = back;
      if (head.length === 0) break;
      continue;
    }
    const nextHead = mergeStateSets([head, back], context);
    const nextKey = trackedStateSetKey(nextHead, context.names);
    if (
      nextKey === previousKey ||
      nextKey === trackedStateSetKey(head, context.names)
    ) {
      head = nextHead;
      break;
    }
    previousKey = trackedStateSetKey(head, context.names);
    head = nextHead;
  }
  if (exact && head.length > 0) {
    const condition = statement.condition;
    let afterCondition = head;
    if (condition !== undefined) {
      afterCondition = processTrackedExpression(condition, head, context);
    }
    exits.push(...afterCondition);
  } else if (!exact && head.length > 0) {
    const condition = ts.isForStatement(statement)
      ? statement.condition
      : iterates
        ? undefined
        : statement.expression;
    const truth = iterates
      ? UNKNOWN
      : ts.isDoStatement(statement) || condition === undefined
        ? true
        : expressionTruth(condition, context.checker);
    if (truth !== true) exits.push(...head);
  }
  return {
    exits: boundedObjectStates(exits, context.names),
    observations: boundedObjectStates(observations, context.names),
  };
}

function processTrackedStatement(statement, states, context) {
  return processTrackedFlow(statement, states, context).normal;
}

function processTrackedStatementToSink(statement, states, context, sinkCall) {
  return observeTrackedStatement(statement, states, context, sinkCall);
}

function optionTargetKey(target, checker) {
  if (ts.isObjectLiteralExpression(target))
    return `literal:${target.pos}:${target.end}`;
  const symbol = checker.getSymbolAtLocation(target);
  if (symbol === undefined) return `identifier:${target.pos}:${target.end}`;
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (declaration === undefined)
    return `identifier:${target.pos}:${target.end}`;
  return `symbol:${declaration.getSourceFile().fileName}:${declaration.pos}:${declaration.end}`;
}

function resolveOptionTargets(node, checker, seen = new Set(), depth = 0) {
  if (depth > MAX_STRUCTURAL_DEPTH) return [];
  const current = unwrapExpression(node);
  if (ts.isObjectLiteralExpression(current)) return [current];
  if (ts.isIdentifier(current)) {
    const symbol = checker.getSymbolAtLocation(current);
    if (symbol === undefined || seen.has(symbol)) return [];
    const resolved = variableInitializerFromSymbol(symbol);
    if (resolved === null) return [];
    const initializer = unwrapExpression(resolved.initializer);
    if (ts.isObjectLiteralExpression(initializer)) return [current];
    if (
      !ts.isVariableDeclarationList(resolved.declaration.parent) ||
      (resolved.declaration.parent.flags & ts.NodeFlags.Const) === 0
    ) {
      return [];
    }
    const nextSeen = new Set(seen);
    nextSeen.add(symbol);
    return resolveOptionTargets(
      resolved.initializer,
      checker,
      nextSeen,
      depth + 1,
    );
  }
  if (ts.isConditionalExpression(current)) {
    const truth = expressionTruth(current.condition, checker);
    if (truth === true) {
      return resolveOptionTargets(current.whenTrue, checker, seen, depth + 1);
    }
    if (truth === false) {
      return resolveOptionTargets(current.whenFalse, checker, seen, depth + 1);
    }
    return [
      ...resolveOptionTargets(current.whenTrue, checker, seen, depth + 1),
      ...resolveOptionTargets(current.whenFalse, checker, seen, depth + 1),
    ];
  }
  if (ts.isCommaListExpression(current) && current.elements.length > 0) {
    return resolveOptionTargets(
      current.elements.at(-1),
      checker,
      seen,
      depth + 1,
    );
  }
  if (ts.isBinaryExpression(current)) {
    const operator = current.operatorToken.kind;
    if (operator === ts.SyntaxKind.CommaToken) {
      return resolveOptionTargets(current.right, checker, seen, depth + 1);
    }
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const leftConstant = evaluateConstant(current.left, checker);
      const leftTargets = resolveOptionTargets(
        current.left,
        checker,
        seen,
        depth + 1,
      );
      let takeRight = UNKNOWN;
      if (leftConstant !== UNKNOWN) {
        takeRight =
          operator === ts.SyntaxKind.QuestionQuestionToken
            ? leftConstant === null
            : operator === ts.SyntaxKind.AmpersandAmpersandToken
              ? primitiveToBoolean(leftConstant)
              : !primitiveToBoolean(leftConstant);
      } else if (leftTargets.length > 0) {
        // Every supported option object is truthy and non-nullish.
        takeRight = operator === ts.SyntaxKind.AmpersandAmpersandToken;
      }
      if (takeRight === true) {
        return resolveOptionTargets(current.right, checker, seen, depth + 1);
      }
      if (takeRight === false) return leftTargets;
      return [
        ...leftTargets,
        ...resolveOptionTargets(current.right, checker, seen, depth + 1),
      ];
    }
  }
  return [];
}

function uniqueOptionTargets(node, checker) {
  const unique = new Map();
  for (const target of resolveOptionTargets(node, checker)) {
    unique.set(optionTargetKey(target, checker), target);
  }
  return [...unique.values()];
}

function optionBranchContainsTarget(node, target, checker) {
  const key = optionTargetKey(target, checker);
  return uniqueOptionTargets(node, checker).some(
    (candidate) => optionTargetKey(candidate, checker) === key,
  );
}

function processOptionExpressionToTarget(
  node,
  target,
  states,
  context,
  depth = 0,
) {
  if (depth > MAX_STRUCTURAL_DEPTH) return unknownTrackedStates(states);
  const current = unwrapExpression(node);
  if (
    current === target ||
    (ts.isIdentifier(current) &&
      optionBranchContainsTarget(current, target, context.checker))
  ) {
    return states;
  }
  if (ts.isCommaListExpression(current) && current.elements.length > 0) {
    let ordered = states;
    for (const prefix of current.elements.slice(0, -1)) {
      ordered = processTrackedExpression(prefix, ordered, context);
    }
    return processOptionExpressionToTarget(
      current.elements.at(-1),
      target,
      ordered,
      context,
      depth + 1,
    );
  }
  if (ts.isConditionalExpression(current)) {
    const conditioned = processTrackedExpression(
      current.condition,
      states,
      context,
    );
    const truth = expressionTruth(current.condition, context.checker);
    const branches = [];
    if (
      truth !== false &&
      optionBranchContainsTarget(current.whenTrue, target, context.checker)
    ) {
      branches.push(
        processOptionExpressionToTarget(
          current.whenTrue,
          target,
          cloneTrackedObjectStates(conditioned),
          context,
          depth + 1,
        ),
      );
    }
    if (
      truth !== true &&
      optionBranchContainsTarget(current.whenFalse, target, context.checker)
    ) {
      branches.push(
        processOptionExpressionToTarget(
          current.whenFalse,
          target,
          cloneTrackedObjectStates(conditioned),
          context,
          depth + 1,
        ),
      );
    }
    return mergeTrackedBranches(branches, context.names);
  }
  if (ts.isBinaryExpression(current)) {
    const operator = current.operatorToken.kind;
    if (operator === ts.SyntaxKind.CommaToken) {
      const afterLeft = processTrackedExpression(current.left, states, context);
      return processOptionExpressionToTarget(
        current.right,
        target,
        afterLeft,
        context,
        depth + 1,
      );
    }
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const afterLeft = processTrackedExpression(current.left, states, context);
      const onLeft = optionBranchContainsTarget(
        current.left,
        target,
        context.checker,
      );
      const onRight = optionBranchContainsTarget(
        current.right,
        target,
        context.checker,
      );
      const branches = [];
      if (onLeft) branches.push(cloneTrackedObjectStates(afterLeft));
      if (onRight) {
        branches.push(
          processOptionExpressionToTarget(
            current.right,
            target,
            cloneTrackedObjectStates(afterLeft),
            context,
            depth + 1,
          ),
        );
      }
      return mergeTrackedBranches(branches, context.names);
    }
  }
  return states;
}

function processSinkArgumentEffects(call, optionNode, target, states, context) {
  let current = states;
  for (const argument of call.arguments ?? []) {
    if (argument === optionNode) {
      current = processOptionExpressionToTarget(
        argument,
        target,
        current,
        context,
      );
      continue;
    }
    current = processTrackedExpression(argument, current, context);
  }
  return current;
}

function plainAliasIdentifier(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current : undefined;
}

function collectTrackedAliases(container, symbol, checker) {
  const aliases = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    function visit(node) {
      if (
        node !== container &&
        (ts.isFunctionLike(node) ||
          ts.isClassDeclaration(node) ||
          ts.isClassExpression(node))
      ) {
        return;
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const initializer = plainAliasIdentifier(node.initializer);
        const sourceSymbol =
          initializer === undefined
            ? undefined
            : checker.getSymbolAtLocation(initializer);
        if (sourceSymbol === symbol || aliases.has(sourceSymbol)) {
          const alias = checker.getSymbolAtLocation(node.name);
          if (alias !== undefined && !aliases.has(alias)) {
            aliases.add(alias);
            changed = true;
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(container);
  }
  return aliases;
}

function trackedIdentifierStatesAtSink(
  node,
  optionNode,
  names,
  sinkCall,
  checker,
  bindings,
) {
  const symbol = checker.getSymbolAtLocation(node);
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
    aliases: collectTrackedAliases(container, symbol, checker),
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
    optionNode,
    node,
    states,
    context,
  );
}

function trackedObjectStatesAtSink(node, names, sinkCall, checker, bindings) {
  const states = [];
  for (const target of uniqueOptionTargets(node, checker)) {
    if (ts.isObjectLiteralExpression(target)) {
      states.push(stateFromObjectLiteral(target, names, checker));
    } else {
      states.push(
        ...trackedIdentifierStatesAtSink(
          target,
          node,
          names,
          sinkCall,
          checker,
          bindings,
        ),
      );
    }
  }
  return boundedObjectStates(states, names);
}

function inspectChildProcessOptions(
  node,
  call,
  sink,
  relativePath,
  source,
  checker,
  bindings,
  findings,
) {
  const names = new Set(sink.entry.option_paths);
  const states = trackedObjectStatesAtSink(
    node,
    names,
    call,
    checker,
    bindings,
  );
  const addShellFinding = (valueNode, detail) => {
    findings.push({
      path: relativePath,
      line: lineOf(source, valueNode),
      kind: "shell-true",
      detail,
    });
  };
  const shellState = (valueNode, symbolOverride) => {
    const value = evaluateConstant(
      valueNode,
      checker,
      undefined,
      symbolOverride,
    );
    if (value === UNKNOWN) return "unknown";
    if (sink.entry.shell_mode === "exec-default") {
      return typeof value === "string" && value.length === 0
        ? "disabled"
        : "enabled";
    }
    if (sink.entry.shell_mode === "forced-disabled") return "disabled";
    if (value === true || (typeof value === "string" && value.length > 0)) {
      return "enabled";
    }
    if (value === false || value === null || value === "") return "disabled";
    return "unknown";
  };
  for (const state of states) {
    for (const [name, property] of state.properties) {
      if (
        name === "shell" &&
        sink.entry.shell_mode === "exec-default" &&
        (property.kind === "absent" ||
          (property.kind === "possible" && property.mayBeAbsent))
      ) {
        addShellFinding(node, `${sink.operation} default shell`);
      }
      for (const { node: valueNode, symbolOverride } of propertyReferences(
        property,
      )) {
        if (name === "shell") {
          if (
            sink.entry.shell_mode === "exec-default" &&
            provablyUndefinedValue(valueNode, checker)
          ) {
            // shell: undefined leaves the exec-family default shell active.
            addShellFinding(valueNode, `${sink.operation} default shell`);
          } else if (shellState(valueNode, symbolOverride) === "enabled") {
            const value = evaluateConstant(
              valueNode,
              checker,
              undefined,
              symbolOverride,
            );
            addShellFinding(
              valueNode,
              typeof value === "string"
                ? `shell=${JSON.stringify(value)}`
                : `shell=${String(value)}`,
            );
          }
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
    const invocation = childProcessInvocation(call, sink, checker);
    if (invocation.commandIndex !== undefined) {
      inspectIndices([invocation.commandIndex], "command");
    }
    if (invocation.executableIndex !== undefined) {
      inspectIndices([invocation.executableIndex], "path");
    }
    if (invocation.modulePathIndex !== undefined) {
      inspectIndices([invocation.modulePathIndex], "path");
    }
    if (invocation.argvIndex !== undefined && args[invocation.argvIndex]) {
      inspectOperationalArray(
        args[invocation.argvIndex],
        relativePath,
        source,
        checker,
        bindings,
        findings,
        "path",
      );
    }
    if (
      sink.entry.shell_mode === "exec-default" &&
      invocation.optionsIndex === undefined
    ) {
      findings.push({
        path: relativePath,
        line: lineOf(source, call),
        kind: "shell-true",
        detail: `${sink.operation} default shell`,
      });
    }
    if (
      invocation.optionsIndex !== undefined &&
      args[invocation.optionsIndex]
    ) {
      inspectChildProcessOptions(
        args[invocation.optionsIndex],
        call,
        sink,
        relativePath,
        source,
        checker,
        bindings,
        findings,
      );
    }
    return;
  }
  if (sink.kind === "filesystem") {
    inspectIndices(sink.entry.path_indices);
    return;
  }
  // node:path calls are pure fact producers, not sinks. Their abstract result
  // is inspected only if it later reaches one of the reviewed positions above
  // or a process path position below.
  if (sink.kind === "path") return;
  if (sink.kind === "process") {
    inspectIndices(sink.entry.path_indices);
    return;
  }
  if (sink.kind === "process-execve") {
    inspectIndices([sink.entry.roles.executable], "path");
    const argv = args[sink.entry.roles.argv];
    if (argv !== undefined) {
      inspectOperationalArray(
        argv,
        relativePath,
        source,
        checker,
        bindings,
        findings,
        "path",
      );
    }
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
  let executableIndex;
  let argvIndex;
  let flagIndex;
  if (
    sink.kind === "child-process" &&
    sink.entry.roles.executable !== undefined
  ) {
    const invocation = childProcessInvocation(call, sink, checker);
    if (invocation.argvIndex === undefined) return;
    executableIndex = invocation.executableIndex;
    argvIndex = invocation.argvIndex;
    flagIndex = 0;
  } else if (sink.kind === "process-execve") {
    executableIndex = sink.entry.roles.executable;
    argvIndex = sink.entry.roles.argv;
    // POSIX execve argv carries the program name in slot 0; the executed
    // shell parses its options starting at slot 1.
    flagIndex = 1;
  } else {
    return;
  }
  const executableNode = call.arguments[executableIndex];
  const argvNode = call.arguments[argvIndex];
  if (executableNode === undefined || argvNode === undefined) return;
  const command = evaluateConstant(executableNode, checker);
  const argv = constantArrayPrefix(argvNode, checker)?.elements ?? null;
  const basename =
    typeof command === "string"
      ? command
          .split(/[\\/]/)
          .at(-1)
          ?.toLowerCase()
          .replace(/\.exe$/, "")
      : undefined;
  if (
    (basename !== "bash" && basename !== "sh") ||
    argv === null ||
    argv.length <= flagIndex
  ) {
    return;
  }
  const flag = evaluateConstant(argv[flagIndex], checker);
  if (flag !== "-c" && flag !== "-lc") return;
  findings.push({
    path: relativePath,
    line: lineOf(source, executableNode),
    kind: "shell-wrapper",
    detail: `${basename} ${flag}`,
  });
}

function diagnosticText(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}

function callableType(type) {
  if (type.getCallSignatures().length > 0) return true;
  return type.isUnion() && type.types.some(callableType);
}

function constructibleType(type) {
  if (type.getConstructSignatures().length > 0) return true;
  return type.isUnion() && type.types.some(constructibleType);
}

function checkedSymbolType(checker, symbol, label) {
  const resolved =
    (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  const location = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (location === undefined) {
    throw new Error(`declaration oracle cannot locate ${label}`);
  }
  return checker.getTypeOfSymbolAtLocation(resolved, location);
}

function typeSurface(checker, type, label) {
  const surface = new Map();
  for (const symbol of type.getProperties()) {
    if (surface.has(symbol.name)) {
      throw new Error(`duplicate declaration member ${label}.${symbol.name}`);
    }
    surface.set(symbol.name, {
      symbol,
      type: checkedSymbolType(checker, symbol, `${label}.${symbol.name}`),
    });
  }
  return surface;
}

function moduleSurface(checker, ambient, specifier, exportEquals) {
  const moduleSymbol = ambient.find(
    (candidate) => candidate.name === JSON.stringify(specifier),
  );
  if (moduleSymbol === undefined) {
    throw new Error(`declaration oracle cannot resolve module ${specifier}`);
  }
  if (exportEquals) {
    const exported = moduleSymbol.exports?.get("export=");
    if (exported === undefined) {
      throw new Error(
        `declaration oracle cannot resolve export= for ${specifier}`,
      );
    }
    return typeSurface(
      checker,
      checkedSymbolType(checker, exported, `${specifier}.export=`),
      specifier,
    );
  }
  const surface = new Map();
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    surface.set(symbol.name, {
      symbol,
      type: checkedSymbolType(checker, symbol, `${specifier}.${symbol.name}`),
    });
  }
  return surface;
}

function setDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function assertSameSet(actual, expected, label) {
  const missing = setDifference(expected, actual);
  const unexpected = setDifference(actual, expected);
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Node portability catalog completeness mismatch at ${label}; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`,
    );
  }
}

// Any callable or constructible member of a reviewed callable surface must be
// represented by an explicit catalog node; otherwise a pin bump could expose
// a new nested operation (a future `.native`-style member) without failing
// review.
function assertNoUnreviewedNestedSurface(
  surface,
  label,
  excludedPrefixes,
  isLibraryMember,
) {
  for (const [name, member] of surface) {
    if (excludedPrefixes.some((prefix) => name.startsWith(prefix))) continue;
    // Members inherited from the TypeScript default library (Function
    // prototype members on interface-typed functions) are not Node surface.
    if (isLibraryMember(member.symbol)) continue;
    if (callableType(member.type) || constructibleType(member.type)) {
      throw new Error(
        `Node portability catalog nested surface unreviewed at ${label}.${name}; add an explicit catalog node`,
      );
    }
  }
}

function verifyCatalogCompletenessGuard() {
  let rejectedKnownMismatch = false;
  try {
    assertSameSet(
      new Set(["unexpected-member"]),
      new Set(),
      "completeness guard self-test",
    );
  } catch {
    rejectedKnownMismatch = true;
  }
  if (!rejectedKnownMismatch) {
    throw new Error(
      "Node portability catalog completeness guard accepted a known mismatch",
    );
  }
  let rejectedNestedSurface = false;
  try {
    assertNoUnreviewedNestedSurface(
      new Map([
        [
          "native",
          {
            type: {
              getCallSignatures: () => [{}],
              getConstructSignatures: () => [],
              isUnion: () => false,
            },
          },
        ],
      ]),
      "completeness guard nested self-test",
      [],
      () => false,
    );
  } catch {
    rejectedNestedSurface = true;
  }
  if (!rejectedNestedSurface) {
    throw new Error(
      "Node portability catalog completeness guard accepted an unreviewed nested surface",
    );
  }
}

function validateCatalogNodeAgainstSurface(
  checker,
  moduleId,
  nodeId,
  surface,
  label,
  seen,
  isLibraryMember,
) {
  const key = `${moduleId}:${nodeId}`;
  if (seen.has(key)) return;
  seen.add(key);
  const module = NODE_CATALOG.modules[moduleId];
  const node = module.nodes[nodeId];
  if (node === undefined) {
    throw new Error(`declaration oracle missing catalog node ${key}`);
  }
  const excludedPrefixes = Object.keys(
    module.oracle_symbol_exclusion_prefixes ?? {},
  );
  const observedCallable = new Set();
  const observedConstructible = new Set();
  for (const [name, member] of surface) {
    if (excludedPrefixes.some((prefix) => name.startsWith(prefix))) continue;
    if (callableType(member.type)) observedCallable.add(name);
    if (constructibleType(member.type)) observedConstructible.add(name);
  }
  const expectedCallable = new Set(
    Object.entries(node.members)
      .filter(([, member]) => member.callable !== undefined)
      .map(([name]) => name),
  );
  const expectedConstructible = new Set(
    Object.entries(node.members)
      .filter(([, member]) => member.constructible !== undefined)
      .map(([name]) => name),
  );
  assertSameSet(observedCallable, expectedCallable, `${label} callables`);
  assertSameSet(
    observedConstructible,
    expectedConstructible,
    `${label} constructibles`,
  );
  for (const [memberName, catalogMember] of Object.entries(node.members)) {
    if (catalogMember.node === undefined) continue;
    const declared = surface.get(memberName);
    if (declared === undefined) {
      throw new Error(
        `declaration oracle cannot resolve ${label}.${memberName}`,
      );
    }
    const targetModule = catalogMember.module ?? moduleId;
    validateCatalogNodeAgainstSurface(
      checker,
      targetModule,
      catalogMember.node,
      typeSurface(checker, declared.type, `${label}.${memberName}`),
      `${label}.${memberName}`,
      seen,
      isLibraryMember,
    );
  }
  for (const [memberName, declared] of surface) {
    if (excludedPrefixes.some((prefix) => memberName.startsWith(prefix))) {
      continue;
    }
    const catalogMember = node.members[memberName];
    if (catalogMember === undefined || catalogMember.node !== undefined) {
      continue;
    }
    if (catalogMember.callable === undefined) continue;
    assertNoUnreviewedNestedSurface(
      typeSurface(checker, declared.type, `${label}.${memberName}`),
      `${label}.${memberName}`,
      excludedPrefixes,
      isLibraryMember,
    );
  }
}

function verifyDefaultAsImports(options) {
  const probePath = resolve(
    process.cwd(),
    "scripts/.node-catalog-default-probe.ts",
  );
  const probe = [
    'import { default as childProcess } from "node:child_process";',
    'import { default as fs } from "node:fs";',
    'import { default as fsp } from "node:fs/promises";',
    'import { default as path } from "node:path";',
    'import { default as process } from "node:process";',
    "void [childProcess, fs, fsp, path, process];",
  ].join("\n");
  const host = ts.createCompilerHost(options);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) =>
    resolve(fileName) === probePath || originalFileExists(fileName);
  host.readFile = (fileName) =>
    resolve(fileName) === probePath ? probe : originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    resolve(fileName) === probePath
      ? ts.createSourceFile(fileName, probe, languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  const program = ts.createProgram({
    rootNames: [probePath],
    options,
    host,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      `default-as declaration probe failed: ${diagnostics.map(diagnosticText).join("; ")}`,
    );
  }
}

function verifyNodeCatalogCompleteness() {
  verifyCatalogCompletenessGuard();
  const declarationRoot = require.resolve("@types/node/index.d.ts");
  const options = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2024,
    types: ["node"],
  };
  const program = ts.createProgram({ rootNames: [declarationRoot], options });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      `pinned Node declaration oracle failed: ${diagnostics.map(diagnosticText).join("; ")}`,
    );
  }
  const checker = program.getTypeChecker();
  const ambient = checker.getAmbientModules();
  const isLibraryMember = (symbol) =>
    symbol?.declarations !== undefined &&
    symbol.declarations.length > 0 &&
    symbol.declarations.every((declaration) =>
      program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
    );
  const exportEqualsModules = new Set([
    "path",
    "path-posix",
    "path-win32",
    "process",
  ]);
  for (const [moduleId, module] of Object.entries(NODE_CATALOG.modules)) {
    const surfaces = module.specifiers.map((specifier) =>
      moduleSurface(
        checker,
        ambient,
        specifier,
        exportEqualsModules.has(moduleId),
      ),
    );
    const callableSets = surfaces.map(
      (surface) =>
        new Set(
          [...surface]
            .filter(([, member]) => callableType(member.type))
            .map(([name]) => name),
        ),
    );
    for (let index = 1; index < callableSets.length; index += 1) {
      assertSameSet(
        callableSets[index],
        callableSets[0],
        `${module.specifiers[0]} alias ${module.specifiers[index]}`,
      );
    }
    validateCatalogNodeAgainstSurface(
      checker,
      moduleId,
      module.root,
      surfaces[0],
      module.specifiers[0],
      new Set(),
      isLibraryMember,
    );
  }
  verifyDefaultAsImports(options);
  return {
    node: NODE_CATALOG.metadata.node_runtime,
    types_node: NODE_CATALOG.metadata.types_node,
    typescript: NODE_CATALOG.metadata.typescript,
    modules: Object.keys(NODE_CATALOG.modules).sort(),
  };
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

if (process.argv.slice(2).includes("--verify-node-catalog")) {
  process.stdout.write(JSON.stringify(verifyNodeCatalogCompleteness()));
  process.exit(0);
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
