#!/usr/bin/env node
/**
 * Fail-closed TypeScript test-policy scanner.
 *
 * This intentionally uses the workspace-pinned TypeScript parser instead of
 * text matching. It follows statically representable aliases and member/call
 * chains rooted at Vitest's test APIs, including decoded computed literals.
 */

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import process from "node:process";
import console from "node:console";

import ts from "typescript";

const ROOT_NAMES = new Set(["test", "it", "describe", "suite", "bench"]);
const PARAMETERIZED_MEMBERS = new Set(["each", "for"]);
const NONEMPTY_GUARD_EXPORT = "assertNonEmptyParameterTable";
const NONEMPTY_GUARD_SUFFIX =
  "packages/contracts/test/support/parameter-table.ts";
const NONEMPTY_GUARD_SHA256 =
  "036b7311772a07013dfa2824ca776046970e58a842f28c79b4f1a94597a09bcb";
const FORBIDDEN_MEMBERS = new Set([
  "fails",
  "only",
  "skip",
  "fixme",
  "todo",
  "skipIf",
  "runIf",
]);
const IMPORT_CLOSURE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];
const IMPORT_CLOSURE_EXTENSION_REWRITES = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx", ".ts"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);
const MAX_IMPORT_CLOSURE_FILES = 2048;
const MAX_IMPORT_CLOSURE_DEPTH = 32;
const MAX_IMPORT_CLOSURE_BYTES = 32 * 1024 * 1024;

function hasImportedPolicySurface(sourceText) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    sourceText,
  );
  let previous = ts.SyntaxKind.Unknown;
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      (token === ts.SyntaxKind.StringLiteral ||
        token === ts.SyntaxKind.NoSubstitutionTemplateLiteral) &&
      scanner.getTokenValue() === "vitest"
    ) {
      return true;
    }
    if (token === ts.SyntaxKind.Identifier) {
      const value = scanner.getTokenValue();
      if (FORBIDDEN_MEMBERS.has(value)) {
        return true;
      }
      if (
        ROOT_NAMES.has(value) &&
        previous !== ts.SyntaxKind.DotToken &&
        previous !== ts.SyntaxKind.QuestionDotToken
      ) {
        return true;
      }
    }
    previous = token;
  }
  return false;
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function literalMember(expression) {
  const value = unwrap(expression);
  if (
    ts.isStringLiteralLike(value) ||
    ts.isNoSubstitutionTemplateLiteral(value)
  ) {
    return value.text;
  }
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = literalMember(value.left);
    const right = literalMember(value.right);
    return left === undefined || right === undefined
      ? undefined
      : `${left}${right}`;
  }
  return undefined;
}

function scanFile(path) {
  let sourceText;
  try {
    sourceText = readFileSync(path, "utf8");
  } catch {
    return [
      {
        file: path,
        line: 1,
        column: 1,
        reason: "test source could not be read",
      },
    ];
  }

  const source = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    /\.(?:c|m)?tsx$/u.test(path)
      ? ts.ScriptKind.TSX
      : /\.(?:c|m)?jsx$/u.test(path)
        ? ts.ScriptKind.JSX
        : /\.(?:c|m)?js$/u.test(path)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS,
  );
  const findings = [];
  const parseDiagnostics = source.parseDiagnostics;
  for (const diagnostic of parseDiagnostics) {
    const position = source.getLineAndCharacterOfPosition(
      diagnostic.start ?? 0,
    );
    findings.push({
      file: path,
      line: position.line + 1,
      column: position.character + 1,
      reason: `TypeScript parse error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    });
  }
  if (parseDiagnostics.length > 0) {
    return findings;
  }

  const nonemptyGuardAliases = new Set();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith(".")
    ) {
      continue;
    }
    const guardPath = resolve(dirname(path), statement.moduleSpecifier.text);
    if (!guardPath.replaceAll("\\", "/").endsWith(NONEMPTY_GUARD_SUFFIX)) {
      continue;
    }
    let digest;
    try {
      digest = createHash("sha256")
        .update(readFileSync(guardPath))
        .digest("hex");
    } catch {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (digest === NONEMPTY_GUARD_SHA256 && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (
          (element.propertyName ?? element.name).text === NONEMPTY_GUARD_EXPORT
        ) {
          nonemptyGuardAliases.add(element.name.text);
        }
      }
    }
  }

  const variableDeclarations = [];
  const declaredValueNames = new Set();
  function addBindingNames(name) {
    if (ts.isIdentifier(name)) {
      nonemptyGuardAliases.delete(name.text);
      declaredValueNames.add(name.text);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        addBindingNames(element.name);
      }
    }
  }
  function collectDeclarations(node) {
    if (ts.isVariableDeclaration(node)) {
      variableDeclarations.push(node);
      addBindingNames(node.name);
    } else if (ts.isParameter(node)) {
      addBindingNames(node.name);
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isModuleDeclaration(node) ||
        ts.isImportEqualsDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name)
    ) {
      nonemptyGuardAliases.delete(node.name.text);
      declaredValueNames.add(node.name.text);
    } else if (
      (ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node)) &&
      node.name !== undefined
    ) {
      declaredValueNames.add(node.name.text);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(source);
  const constantStrings = new Map();
  for (let pass = 0; pass <= variableDeclarations.length; pass += 1) {
    let changed = false;
    for (const declaration of variableDeclarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer !== undefined &&
        !constantStrings.has(declaration.name.text)
      ) {
        const initializer = unwrap(declaration.initializer);
        const direct = literalMember(initializer);
        const alias =
          ts.isIdentifier(initializer) && constantStrings.has(initializer.text)
            ? constantStrings.get(initializer.text)
            : undefined;
        const value = direct ?? alias;
        if (value !== undefined) {
          constantStrings.set(declaration.name.text, value);
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  function resolvedLiteralMember(expression) {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) {
      return constantStrings.get(value.text);
    }
    if (
      ts.isBinaryExpression(value) &&
      value.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = resolvedLiteralMember(value.left);
      const right = resolvedLiteralMember(value.right);
      return left === undefined || right === undefined
        ? undefined
        : `${left}${right}`;
    }
    return literalMember(value);
  }

  const aliases = new Map();
  const namespaceAliases = new Set();
  const provablyNonVitestImports = new Set();

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text !== "vitest" &&
      !statement.moduleSpecifier.text.startsWith(".")
    ) {
      const clause = statement.importClause;
      if (clause?.name !== undefined) {
        provablyNonVitestImports.add(clause.name.text);
      }
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        provablyNonVitestImports.add(bindings.name.text);
      } else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          provablyNonVitestImports.add(element.name.text);
        }
      }
    }
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "vitest"
    ) {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        namespaceAliases.add(bindings.name.text);
      } else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text;
          if (ROOT_NAMES.has(imported)) {
            aliases.set(element.name.text, {
              root: imported,
              members: [],
              dynamic: false,
            });
          }
        }
      }
    }
  }

  function resolveExpression(rawExpression) {
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      const alias = aliases.get(expression.text);
      if (alias) {
        return alias;
      }
      if (ROOT_NAMES.has(expression.text)) {
        return { root: expression.text, members: [], dynamic: false };
      }
      return undefined;
    }
    if (ts.isPropertyAccessExpression(expression)) {
      const namespaceBase = unwrap(expression.expression);
      if (
        ts.isIdentifier(namespaceBase) &&
        namespaceAliases.has(namespaceBase.text) &&
        ROOT_NAMES.has(expression.name.text)
      ) {
        return {
          root: expression.name.text,
          members: [],
          dynamic: false,
        };
      }
      const base = resolveExpression(expression.expression);
      return base
        ? {
            ...base,
            members: [...base.members, expression.name.text],
          }
        : undefined;
    }
    if (ts.isElementAccessExpression(expression)) {
      const namespaceBase = unwrap(expression.expression);
      const member =
        expression.argumentExpression === undefined
          ? undefined
          : resolvedLiteralMember(expression.argumentExpression);
      if (
        ts.isIdentifier(namespaceBase) &&
        namespaceAliases.has(namespaceBase.text) &&
        member !== undefined &&
        ROOT_NAMES.has(member)
      ) {
        return { root: member, members: [], dynamic: false };
      }
      const base = resolveExpression(expression.expression);
      if (!base) {
        return undefined;
      }
      return member === undefined
        ? { ...base, dynamic: true }
        : { ...base, members: [...base.members, member] };
    }
    if (ts.isCallExpression(expression)) {
      return resolveExpression(expression.expression);
    }
    if (ts.isTaggedTemplateExpression(expression)) {
      return resolveExpression(expression.tag);
    }
    return undefined;
  }

  // Resolve const aliases to a fixed point so chains such as
  // `const a = test; const b = a.each; b.skipIf(...)` remain visible.
  for (let pass = 0; pass <= variableDeclarations.length; pass += 1) {
    let changed = false;
    for (const declaration of variableDeclarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer !== undefined &&
        !aliases.has(declaration.name.text)
      ) {
        const resolved = resolveExpression(declaration.initializer);
        if (resolved) {
          aliases.set(declaration.name.text, resolved);
          changed = true;
        }
      } else if (
        ts.isObjectBindingPattern(declaration.name) &&
        declaration.initializer !== undefined
      ) {
        const namespaceInitializer = unwrap(declaration.initializer);
        if (
          ts.isIdentifier(namespaceInitializer) &&
          namespaceAliases.has(namespaceInitializer.text)
        ) {
          for (const element of declaration.name.elements) {
            if (!ts.isIdentifier(element.name)) {
              continue;
            }
            const property =
              element.propertyName === undefined
                ? element.name.text
                : ts.isIdentifier(element.propertyName) ||
                    ts.isStringLiteralLike(element.propertyName)
                  ? element.propertyName.text
                  : undefined;
            if (property !== undefined && ROOT_NAMES.has(property)) {
              aliases.set(element.name.text, {
                root: property,
                members: [],
                dynamic: false,
              });
              changed = true;
            }
          }
          continue;
        }
        const base = resolveExpression(declaration.initializer);
        if (!base) {
          continue;
        }
        for (const element of declaration.name.elements) {
          if (!ts.isIdentifier(element.name)) {
            continue;
          }
          const property =
            element.propertyName === undefined
              ? element.name.text
              : ts.isIdentifier(element.propertyName) ||
                  ts.isStringLiteralLike(element.propertyName)
                ? element.propertyName.text
                : undefined;
          if (property !== undefined && !aliases.has(element.name.text)) {
            aliases.set(element.name.text, {
              ...base,
              members: [...base.members, property],
            });
            changed = true;
          }
        }
      }
    }
    if (!changed) {
      break;
    }
  }

  const MAX_STATIC_TABLE_LENGTH = 10_000;
  const MUTATING_ARRAY_METHODS = new Set([
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
  const READ_ONLY_ARRAY_METHODS = new Set([
    "at",
    "concat",
    "entries",
    "every",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "flat",
    "flatMap",
    "forEach",
    "includes",
    "indexOf",
    "join",
    "keys",
    "lastIndexOf",
    "map",
    "reduce",
    "reduceRight",
    "slice",
    "some",
    "toReversed",
    "toSorted",
    "toSpliced",
    "values",
    "with",
  ]);
  const declarationsByName = new Map();
  const functionsByName = new Map();
  const classesByName = new Map();
  let sourceHasAccessorDeclarations = false;
  let sourceHasProtocolMemberDeclarations = false;
  for (const declaration of variableDeclarations) {
    if (ts.isIdentifier(declaration.name)) {
      const declarations = declarationsByName.get(declaration.name.text) ?? [];
      declarations.push(declaration);
      declarationsByName.set(declaration.name.text, declarations);
    }
  }
  function collectNamedContainers(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name !== undefined &&
      node.body !== undefined
    ) {
      const declarations = functionsByName.get(node.name.text) ?? [];
      declarations.push(node);
      functionsByName.set(node.name.text, declarations);
    }
    if (ts.isClassDeclaration(node) && node.name !== undefined) {
      const declarations = classesByName.get(node.name.text) ?? [];
      declarations.push(node);
      classesByName.set(node.name.text, declarations);
    }
    if (
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      sourceHasAccessorDeclarations = true;
    }
    if (
      (ts.isMethodDeclaration(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      (ts.isComputedPropertyName(node.name) ||
        (ts.isIdentifier(node.name) &&
          ["toString", "valueOf"].includes(node.name.text)) ||
        (ts.isStringLiteralLike(node.name) &&
          ["toString", "valueOf"].includes(node.name.text)))
    ) {
      sourceHasProtocolMemberDeclarations = true;
    }
    ts.forEachChild(node, collectNamedContainers);
  }
  collectNamedContainers(source);

  function functionLike(node) {
    return (
      ts.isArrowFunction(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isConstructorDeclaration(node)
    );
  }

  function generatorFunctionLike(node) {
    return (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isMethodDeclaration(node)) &&
      node.asteriskToken !== undefined
    );
  }

  const executionContainerCache = new WeakMap();
  function executionContainer(node) {
    const cached = executionContainerCache.get(node);
    if (cached !== undefined) {
      return cached;
    }
    let current = node.parent;
    while (current !== undefined && !functionLike(current)) {
      current = current.parent;
    }
    const container = current ?? source;
    executionContainerCache.set(node, container);
    return container;
  }

  const containerChainCache = new WeakMap();
  function containerChain(node) {
    const cached = containerChainCache.get(node);
    if (cached !== undefined) {
      return cached;
    }
    const containers = new Set([source]);
    let current = node.parent;
    while (current !== undefined) {
      if (functionLike(current)) {
        containers.add(current);
      }
      current = current.parent;
    }
    containerChainCache.set(node, containers);
    return containers;
  }

  const bindingScopeCache = new WeakMap();
  function bindingScope(declaration) {
    const cached = bindingScopeCache.get(declaration);
    if (cached !== undefined) {
      return cached;
    }
    const list = declaration.parent;
    const blockScoped =
      ts.isVariableDeclarationList(list) &&
      (list.flags & ts.NodeFlags.BlockScoped) !== 0;
    let current = declaration.parent;
    while (current.parent !== undefined) {
      if (
        blockScoped &&
        (ts.isBlock(current) ||
          ts.isSourceFile(current) ||
          ts.isCaseBlock(current) ||
          ts.isForStatement(current) ||
          ts.isForInStatement(current) ||
          ts.isForOfStatement(current))
      ) {
        bindingScopeCache.set(declaration, current);
        return current;
      }
      if (!blockScoped && (functionLike(current) || ts.isSourceFile(current))) {
        bindingScopeCache.set(declaration, current);
        return current;
      }
      current = current.parent;
    }
    bindingScopeCache.set(declaration, source);
    return source;
  }

  function bindingVisibleAt(declaration, position, useNode) {
    const scope = bindingScope(declaration);
    const usePosition = useNode.getStart(source);
    return (
      declaration.getStart(source) < position &&
      scope.getStart(source) <= usePosition &&
      usePosition < scope.end &&
      containerChain(useNode).has(executionContainer(declaration))
    );
  }

  function bindingAt(name, position, useNode) {
    const declarations = (declarationsByName.get(name) ?? []).filter(
      (declaration) => bindingVisibleAt(declaration, position, useNode),
    );
    return declarations.sort(
      (left, right) => right.getStart(source) - left.getStart(source),
    )[0];
  }

  function unshadowedGlobalIdentifier(name, useNode) {
    return (
      bindingAt(name, useNode.getStart(source), useNode) === undefined &&
      !enclosingParameterOrCatchShadowsName(name, useNode)
    );
  }

  function bindingIsConst(declaration) {
    return (
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    );
  }

  // Flow queries are made many times while following Vitest and table aliases.
  // Index the only syntax forms that can change a binding once per source file
  // instead of recursively walking the entire AST for every query.
  const assignmentExpressions = [];
  const bindingUpdateExpressions = [];
  function collectFlowEventCandidates(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      assignmentExpressions.push(node);
    } else if (
      ts.isPrefixUnaryExpression(node) ||
      ts.isPostfixUnaryExpression(node)
    ) {
      bindingUpdateExpressions.push(node);
    }
    ts.forEachChild(node, collectFlowEventCandidates);
  }
  collectFlowEventCandidates(source);

  function memberAccess(rawExpression) {
    const expression = unwrap(rawExpression);
    if (ts.isPropertyAccessExpression(expression)) {
      return {
        receiver: unwrap(expression.expression),
        member: expression.name.text,
      };
    }
    if (ts.isElementAccessExpression(expression)) {
      const argument =
        expression.argumentExpression === undefined
          ? undefined
          : unwrap(expression.argumentExpression);
      return {
        receiver: unwrap(expression.expression),
        member:
          argument === undefined
            ? undefined
            : ts.isNumericLiteral(argument)
              ? argument.text
              : resolvedLiteralMember(argument),
      };
    }
    return undefined;
  }

  function bindingNameContains(rawName, name) {
    if (ts.isIdentifier(rawName)) {
      return rawName.text === name;
    }
    return rawName.elements.some(
      (element) =>
        ts.isBindingElement(element) && bindingNameContains(element.name, name),
    );
  }

  function nameIsLexicallyShadowed(name, useNode, declaration) {
    let current = useNode.parent;
    const declarationContainer = executionContainer(declaration);
    while (current !== undefined && current !== declarationContainer) {
      if (
        functionLike(current) &&
        current.parameters.some((parameter) =>
          bindingNameContains(parameter.name, name),
        )
      ) {
        return true;
      }
      if (
        ts.isCatchClause(current) &&
        current.variableDeclaration !== undefined &&
        bindingNameContains(current.variableDeclaration.name, name)
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  function enclosingParameterOrCatchShadowsName(name, useNode) {
    let current = useNode.parent;
    while (current !== undefined && current !== source) {
      if (
        functionLike(current) &&
        current.parameters.some((parameter) =>
          bindingNameContains(parameter.name, name),
        )
      ) {
        return true;
      }
      if (
        ts.isCatchClause(current) &&
        current.variableDeclaration !== undefined &&
        bindingNameContains(current.variableDeclaration.name, name)
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  function identifierReferencesBinding(identifier, declaration, useNode) {
    return (
      !nameIsLexicallyShadowed(identifier.text, useNode, declaration) &&
      bindingAt(identifier.text, useNode.getStart(source), useNode) ===
        declaration
    );
  }

  function assignmentValuesForBindingTarget(
    rawTarget,
    rawValue,
    name,
    declaration,
    useNode,
    depth = 0,
  ) {
    if (depth > 8) {
      return { matched: true, values: [], unknown: true };
    }
    const target = unwrap(rawTarget);
    if (ts.isIdentifier(target)) {
      return target.text === name &&
        identifierReferencesBinding(target, declaration, useNode)
        ? {
            matched: true,
            values: [{ expression: rawValue, context: useNode }],
            unknown: false,
          }
        : { matched: false, values: [], unknown: false };
    }
    if (ts.isArrayLiteralExpression(target)) {
      for (let index = 0; index < target.elements.length; index += 1) {
        const element = target.elements[index];
        if (ts.isOmittedExpression(element)) {
          continue;
        }
        if (ts.isSpreadElement(element)) {
          if (expressionContainsName(element.expression, new Set([name]))) {
            return { matched: true, values: [], unknown: true };
          }
          continue;
        }
        const sources = staticObjectMemberCandidates(
          rawValue,
          String(index),
          useNode,
        );
        const nested = assignmentValuesForBindingTarget(
          element,
          sources[0] ?? rawValue,
          name,
          declaration,
          useNode,
          depth + 1,
        );
        if (nested.matched) {
          return sources.length === 0
            ? { ...nested, values: [], unknown: true }
            : {
                ...nested,
                values: sources.map((expression) => ({
                  expression,
                  context: useNode,
                })),
              };
        }
      }
      return { matched: false, values: [], unknown: false };
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (ts.isSpreadAssignment(property)) {
          if (expressionContainsName(property.expression, new Set([name]))) {
            return { matched: true, values: [], unknown: true };
          }
          continue;
        }
        const nestedTarget = ts.isPropertyAssignment(property)
          ? property.initializer
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : undefined;
        if (nestedTarget === undefined) {
          continue;
        }
        const propertyName = staticPropertyName(property.name);
        const sources =
          propertyName === undefined
            ? []
            : staticObjectMemberCandidates(rawValue, propertyName, useNode);
        const nested = assignmentValuesForBindingTarget(
          nestedTarget,
          sources[0] ?? rawValue,
          name,
          declaration,
          useNode,
          depth + 1,
        );
        if (nested.matched) {
          return sources.length === 0
            ? { ...nested, values: [], unknown: true }
            : {
                ...nested,
                values: sources.map((expression) => ({
                  expression,
                  context: useNode,
                })),
              };
        }
      }
    }
    return { matched: false, values: [], unknown: false };
  }

  function bindingAssignmentEvents(name, declaration, useNode) {
    const usePosition = useNode.getStart(source);
    const useContainer = executionContainer(useNode);
    const useContainers = containerChain(useNode);
    const events = [];

    function add(node, values, unknown) {
      if (definitelyUnreachable(node)) {
        return;
      }
      const sameContainer = executionContainer(node) === useContainer;
      if (
        sameContainer &&
        (node.getStart(source) <= declaration.getStart(source) ||
          node.getStart(source) >= usePosition)
      ) {
        return;
      }
      events.push({
        position: node.getStart(source),
        values,
        unknown,
        external: !sameContainer,
        uncertain: !sameContainer || uncertainControlFlow(node, useContainers),
      });
    }

    for (const node of assignmentExpressions) {
      const assignment = assignmentValuesForBindingTarget(
        node.left,
        node.right,
        name,
        declaration,
        node,
      );
      if (assignment.matched) {
        add(
          node,
          assignment.values,
          assignment.unknown ||
            node.operatorToken.kind !== ts.SyntaxKind.EqualsToken,
        );
      }
    }
    for (const node of bindingUpdateExpressions) {
      if (
        ts.isIdentifier(unwrap(node.operand)) &&
        unwrap(node.operand).text === name &&
        identifierReferencesBinding(unwrap(node.operand), declaration, node)
      ) {
        add(node, [], true);
      }
    }
    return events.sort((left, right) => left.position - right.position);
  }

  function bindingCurrentValueFlow(name, declaration, useNode) {
    let values =
      declaration.initializer === undefined
        ? []
        : [{ expression: declaration.initializer, context: declaration }];
    let unknown = false;
    const external = [];
    for (const event of bindingAssignmentEvents(name, declaration, useNode)) {
      if (event.external) {
        external.push(event);
      } else if (event.uncertain) {
        values.push(...event.values);
        unknown ||= event.unknown;
      } else {
        values = [...event.values];
        unknown = event.unknown;
      }
    }
    for (const event of external) {
      values.push(...event.values);
      unknown ||= event.unknown;
    }
    return { values, unknown };
  }

  function bindingReferenceStillCurrent(name, referenceNode, useNode) {
    const declaration = bindingAt(
      name,
      referenceNode.getStart(source),
      referenceNode,
    );
    if (
      declaration === undefined ||
      bindingAt(name, useNode.getStart(source), useNode) !== declaration
    ) {
      return false;
    }
    return !bindingAssignmentEvents(name, declaration, useNode).some(
      (event) =>
        event.position > referenceNode.getStart(source) &&
        !event.external &&
        !event.uncertain,
    );
  }

  function mutableAliasValueIsBounded(
    rawExpression,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 12) {
      return false;
    }
    const expression = unwrap(rawExpression);
    if (
      functionLike(expression) ||
      ts.isArrayLiteralExpression(expression) ||
      ts.isObjectLiteralExpression(expression) ||
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression) ||
      ts.isNumericLiteral(expression) ||
      ts.isBigIntLiteral(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword
    ) {
      return true;
    }
    if (ts.isIdentifier(expression)) {
      if (
        [
          "Array",
          "Object",
          "Reflect",
          "Symbol",
          "globalThis",
          "undefined",
        ].includes(expression.text) &&
        bindingAt(expression.text, useNode.getStart(source), useNode) ===
          undefined &&
        !enclosingParameterOrCatchShadowsName(expression.text, useNode)
      ) {
        return true;
      }
      if ((functionsByName.get(expression.text) ?? []).length > 0) {
        return true;
      }
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration === undefined || trail.has(declaration)) {
        return false;
      }
      const flow = bindingCurrentValueFlow(
        expression.text,
        declaration,
        useNode,
      );
      return (
        !flow.unknown &&
        flow.values.every(({ expression: value, context }) =>
          mutableAliasValueIsBounded(
            value,
            context,
            new Set([...trail, declaration]),
            depth + 1,
          ),
        )
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        mutableAliasValueIsBounded(
          expression.whenTrue,
          useNode,
          trail,
          depth + 1,
        ) &&
        mutableAliasValueIsBounded(
          expression.whenFalse,
          useNode,
          trail,
          depth + 1,
        )
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return mutableAliasValueIsBounded(
          expression.right,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          mutableAliasValueIsBounded(
            expression.left,
            useNode,
            trail,
            depth + 1,
          ) &&
          mutableAliasValueIsBounded(
            expression.right,
            useNode,
            trail,
            depth + 1,
          )
        );
      }
    }
    if (memberAccess(expression) !== undefined) {
      return (
        intrinsicPrototypeName(expression, useNode) !== undefined ||
        staticObjectMemberCandidates(
          memberAccess(expression).receiver,
          memberAccess(expression).member,
          useNode,
          trail,
          depth + 1,
        ).length > 0
      );
    }
    return false;
  }

  function staticObjectMemberCandidates(
    rawExpression,
    member,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 12) {
      return [];
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration?.initializer === undefined || trail.has(declaration)) {
        return [];
      }
      return staticObjectMemberCandidates(
        declaration.initializer,
        member,
        declaration,
        new Set([...trail, declaration]),
        depth + 1,
      );
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = staticBoolean(expression.condition);
      if (condition !== undefined) {
        return staticObjectMemberCandidates(
          condition ? expression.whenTrue : expression.whenFalse,
          member,
          useNode,
          trail,
          depth + 1,
        );
      }
      return [
        ...staticObjectMemberCandidates(
          expression.whenTrue,
          member,
          useNode,
          trail,
          depth + 1,
        ),
        ...staticObjectMemberCandidates(
          expression.whenFalse,
          member,
          useNode,
          trail,
          depth + 1,
        ),
      ];
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return staticObjectMemberCandidates(
          expression.right,
          member,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return [
          ...staticObjectMemberCandidates(
            expression.left,
            member,
            useNode,
            trail,
            depth + 1,
          ),
          ...staticObjectMemberCandidates(
            expression.right,
            member,
            useNode,
            trail,
            depth + 1,
          ),
        ];
      }
    }
    if (ts.isArrayLiteralExpression(expression)) {
      if (member === undefined || !/^(?:0|[1-9]\d*)$/u.test(member)) {
        return [];
      }
      const element = expression.elements[Number(member)];
      return element === undefined ||
        ts.isOmittedExpression(element) ||
        ts.isSpreadElement(element)
        ? []
        : [element];
    }
    if (!ts.isObjectLiteralExpression(expression)) {
      return [];
    }
    const candidates = [];
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        candidates.push(
          ...staticObjectMemberCandidates(
            property.expression,
            member,
            useNode,
            trail,
            depth + 1,
          ),
        );
        continue;
      }
      const propertyName = staticPropertyName(property.name);
      if (member !== undefined && propertyName !== member) {
        continue;
      }
      if (ts.isPropertyAssignment(property)) {
        candidates.push(property.initializer);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        candidates.push(property.name);
      } else if (
        ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        candidates.push(property);
      }
    }
    return candidates;
  }

  function assignmentValuesForMemberTarget(
    rawTarget,
    rawValue,
    receiverName,
    receiverDeclaration,
    member,
    useNode,
    depth = 0,
  ) {
    if (depth > 8) {
      return { matched: true, values: [], unknown: true };
    }
    const target = unwrap(rawTarget);
    const access = memberAccess(target);
    if (
      access !== undefined &&
      access.member === member &&
      ts.isIdentifier(access.receiver) &&
      access.receiver.text === receiverName &&
      identifierReferencesBinding(access.receiver, receiverDeclaration, useNode)
    ) {
      return {
        matched: true,
        values: [{ expression: rawValue, context: useNode }],
        unknown: false,
      };
    }
    if (ts.isArrayLiteralExpression(target)) {
      for (let index = 0; index < target.elements.length; index += 1) {
        const element = target.elements[index];
        if (ts.isOmittedExpression(element)) {
          continue;
        }
        if (ts.isSpreadElement(element)) {
          if (
            expressionContainsName(element.expression, new Set([receiverName]))
          ) {
            return { matched: true, values: [], unknown: true };
          }
          continue;
        }
        const sources = staticObjectMemberCandidates(
          rawValue,
          String(index),
          useNode,
        );
        const nested = assignmentValuesForMemberTarget(
          element,
          sources[0] ?? rawValue,
          receiverName,
          receiverDeclaration,
          member,
          useNode,
          depth + 1,
        );
        if (nested.matched) {
          return sources.length === 0
            ? { ...nested, values: [], unknown: true }
            : {
                ...nested,
                values: sources.map((expression) => ({
                  expression,
                  context: useNode,
                })),
              };
        }
      }
      return { matched: false, values: [], unknown: false };
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (ts.isSpreadAssignment(property)) {
          if (
            expressionContainsName(property.expression, new Set([receiverName]))
          ) {
            return { matched: true, values: [], unknown: true };
          }
          continue;
        }
        const nestedTarget = ts.isPropertyAssignment(property)
          ? property.initializer
          : ts.isShorthandPropertyAssignment(property)
            ? property.name
            : undefined;
        if (nestedTarget === undefined) {
          continue;
        }
        const propertyName = staticPropertyName(property.name);
        const sources =
          propertyName === undefined
            ? []
            : staticObjectMemberCandidates(rawValue, propertyName, useNode);
        const nested = assignmentValuesForMemberTarget(
          nestedTarget,
          sources[0] ?? rawValue,
          receiverName,
          receiverDeclaration,
          member,
          useNode,
          depth + 1,
        );
        if (nested.matched) {
          return sources.length === 0
            ? { ...nested, values: [], unknown: true }
            : {
                ...nested,
                values: sources.map((expression) => ({
                  expression,
                  context: useNode,
                })),
              };
        }
      }
    }
    return { matched: false, values: [], unknown: false };
  }

  function memberAssignmentEvents(
    receiverName,
    receiverDeclaration,
    member,
    useNode,
  ) {
    const usePosition = useNode.getStart(source);
    const useContainer = executionContainer(useNode);
    const useContainers = containerChain(useNode);
    const events = [];

    function add(node, values, unknown) {
      if (definitelyUnreachable(node)) {
        return;
      }
      const sameContainer = executionContainer(node) === useContainer;
      if (
        sameContainer &&
        (node.getStart(source) <= receiverDeclaration.getStart(source) ||
          node.getStart(source) >= usePosition)
      ) {
        return;
      }
      events.push({
        position: node.getStart(source),
        values,
        unknown,
        external: !sameContainer,
        uncertain: !sameContainer || uncertainControlFlow(node, useContainers),
      });
    }

    for (const node of assignmentExpressions) {
      const assignment = assignmentValuesForMemberTarget(
        node.left,
        node.right,
        receiverName,
        receiverDeclaration,
        member,
        node,
      );
      if (assignment.matched) {
        add(
          node,
          assignment.values,
          assignment.unknown ||
            node.operatorToken.kind !== ts.SyntaxKind.EqualsToken,
        );
      }
    }
    return events.sort((left, right) => left.position - right.position);
  }

  function memberCurrentValueFlow(rawReceiver, member, useNode) {
    const receiver = unwrap(rawReceiver);
    if (!ts.isIdentifier(receiver) || member === undefined) {
      return undefined;
    }
    const declaration = bindingAt(
      receiver.text,
      useNode.getStart(source),
      useNode,
    );
    if (declaration === undefined) {
      return undefined;
    }
    const receiverFlow = bindingCurrentValueFlow(
      receiver.text,
      declaration,
      useNode,
    );
    let values = [];
    let unknown = receiverFlow.unknown;
    for (const { expression, context } of receiverFlow.values) {
      const candidates = staticObjectMemberCandidates(
        expression,
        member,
        context,
        new Set([declaration]),
      );
      values.push(
        ...candidates.map((candidate) => ({
          expression: candidate,
          context,
        })),
      );
      unknown ||= candidates.length === 0;
    }
    const events = memberAssignmentEvents(
      receiver.text,
      declaration,
      member,
      useNode,
    );
    if (values.length === 0 && events.length === 0 && !receiverFlow.unknown) {
      return undefined;
    }
    const external = [];
    for (const event of events) {
      if (event.external) {
        external.push(event);
      } else if (event.uncertain) {
        values.push(...event.values);
        unknown ||= event.unknown;
      } else {
        values = [...event.values];
        unknown = event.unknown;
      }
    }
    for (const event of external) {
      values.push(...event.values);
      unknown ||= event.unknown;
    }
    return { values, unknown };
  }

  function destructuredBindingCandidates(name, useNode) {
    const matches = [];
    const position = useNode.getStart(source);
    for (const declaration of variableDeclarations) {
      if (
        declaration.initializer === undefined ||
        ts.isIdentifier(declaration.name) ||
        !bindingVisibleAt(declaration, position, useNode)
      ) {
        continue;
      }
      if (ts.isArrayBindingPattern(declaration.name)) {
        for (
          let index = 0;
          index < declaration.name.elements.length;
          index += 1
        ) {
          const element = declaration.name.elements[index];
          if (
            ts.isBindingElement(element) &&
            ts.isIdentifier(element.name) &&
            element.name.text === name
          ) {
            matches.push({
              declaration,
              property: String(index),
              values: [
                ...staticObjectMemberCandidates(
                  declaration.initializer,
                  String(index),
                  declaration,
                ),
                ...(element.initializer === undefined
                  ? []
                  : [element.initializer]),
              ],
            });
          }
        }
      } else if (ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if (!ts.isIdentifier(element.name) || element.name.text !== name) {
            continue;
          }
          const property =
            element.propertyName === undefined
              ? element.name.text
              : ts.isIdentifier(element.propertyName) ||
                  ts.isStringLiteralLike(element.propertyName) ||
                  ts.isNumericLiteral(element.propertyName)
                ? element.propertyName.text
                : undefined;
          matches.push({
            declaration,
            property,
            values: [
              ...(property === undefined
                ? []
                : staticObjectMemberCandidates(
                    declaration.initializer,
                    property,
                    declaration,
                  )),
              ...(element.initializer === undefined
                ? []
                : [element.initializer]),
            ],
          });
        }
      }
    }
    return matches.sort(
      (left, right) =>
        right.declaration.getStart(source) - left.declaration.getStart(source),
    )[0];
  }

  function unshadowedEvalTarget(rawExpression) {
    if (declaredValueNames.has("eval")) {
      return false;
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      return expression.text === "eval";
    }
    return (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.CommaToken &&
      unshadowedEvalTarget(expression.right)
    );
  }

  function constructedClassName(rawExpression, useNode) {
    const expression = unwrap(rawExpression);
    if (ts.isNewExpression(expression)) {
      const target = unwrap(expression.expression);
      return ts.isIdentifier(target) ? target.text : undefined;
    }
    if (ts.isIdentifier(expression)) {
      if (classesByName.has(expression.text)) {
        return expression.text;
      }
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      const initializer =
        declaration?.initializer === undefined
          ? undefined
          : unwrap(declaration.initializer);
      if (initializer !== undefined && ts.isNewExpression(initializer)) {
        const target = unwrap(initializer.expression);
        return ts.isIdentifier(target) ? target.text : undefined;
      }
    }
    return undefined;
  }

  function emptyShape() {
    return { length: 0, occupied: new Set() };
  }

  function fullShape(length) {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_STATIC_TABLE_LENGTH
    ) {
      return "UNSTABLE";
    }
    return {
      length,
      occupied: new Set(Array.from({ length }, (_, index) => index)),
    };
  }

  function sparseShape(length) {
    return !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_STATIC_TABLE_LENGTH
      ? "UNSTABLE"
      : { length, occupied: new Set() };
  }

  function shapeIsBounded(shape) {
    return (
      typeof shape === "object" &&
      Number.isSafeInteger(shape.length) &&
      shape.length >= 0 &&
      shape.length <= MAX_STATIC_TABLE_LENGTH &&
      [...shape.occupied].every(
        (index) =>
          Number.isSafeInteger(index) && index >= 0 && index < shape.length,
      )
    );
  }

  function numericLiteral(rawExpression) {
    const expression = unwrap(rawExpression);
    if (ts.isNumericLiteral(expression)) {
      return Number(expression.text);
    }
    if (
      ts.isPrefixUnaryExpression(expression) &&
      (expression.operator === ts.SyntaxKind.PlusToken ||
        expression.operator === ts.SyntaxKind.MinusToken) &&
      ts.isNumericLiteral(unwrap(expression.operand))
    ) {
      const value = Number(unwrap(expression.operand).text);
      return expression.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
    return undefined;
  }

  function objectLength(rawExpression) {
    const expression = unwrap(rawExpression);
    if (
      !ts.isObjectLiteralExpression(expression) ||
      expression.properties.length !== 1
    ) {
      return undefined;
    }
    const [property] = expression.properties;
    if (
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === "length") ||
        (ts.isStringLiteralLike(property.name) &&
          property.name.text === "length"))
    ) {
      return numericLiteral(property.initializer);
    }
    return undefined;
  }

  function intrinsicConcatSpreadableProperty(name) {
    if (!ts.isComputedPropertyName(name)) {
      return false;
    }
    const access = memberAccess(name.expression);
    return (
      access !== undefined &&
      intrinsicGlobalName(access.receiver, name) === "Symbol" &&
      access.member === "isConcatSpreadable"
    );
  }

  function staticPropertyName(name) {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteralLike(name) ||
      ts.isNumericLiteral(name)
    ) {
      return name.text;
    }
    if (ts.isComputedPropertyName(name)) {
      const literal = resolvedLiteralMember(name.expression);
      if (literal !== undefined) {
        return literal;
      }
      const access = memberAccess(name.expression);
      if (
        access !== undefined &&
        intrinsicGlobalName(access.receiver, name) === "Symbol" &&
        ["asyncIterator", "iterator", "toPrimitive"].includes(access.member)
      ) {
        return `Symbol.${access.member}`;
      }
    }
    return undefined;
  }

  function staticObjectConcatShape(expression, useNode) {
    let spreadable;
    let sawSpreadable = false;
    let length = 0;
    let sawLength = false;
    const occupied = new Set();
    for (const property of expression.properties) {
      if (
        ts.isSpreadAssignment(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        return "UNSTABLE";
      }
      if (intrinsicConcatSpreadableProperty(property.name)) {
        if (
          sawSpreadable ||
          !ts.isPropertyAssignment(property) ||
          staticBoolean(property.initializer) === undefined
        ) {
          return "UNSTABLE";
        }
        sawSpreadable = true;
        spreadable = staticBoolean(property.initializer);
        continue;
      }
      const name = staticPropertyName(property.name);
      if (
        name === undefined ||
        name === "__proto__" ||
        (ts.isComputedPropertyName(property.name) &&
          resolvedLiteralMember(property.name.expression) === undefined)
      ) {
        return "UNSTABLE";
      }
      if (name === "length") {
        if (
          sawLength ||
          !ts.isPropertyAssignment(property) ||
          numericLiteral(property.initializer) === undefined
        ) {
          return "UNSTABLE";
        }
        sawLength = true;
        length = numericLiteral(property.initializer);
      } else if (/^(?:0|[1-9]\d*)$/u.test(name)) {
        occupied.add(Number(name));
      }
    }
    if (!sawSpreadable && !concatIntrinsicsTrusted(useNode)) {
      return "UNSTABLE";
    }
    if (!sawSpreadable || spreadable === false) {
      return fullShape(1);
    }
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_STATIC_TABLE_LENGTH
    ) {
      return "UNSTABLE";
    }
    return {
      length,
      occupied: new Set(
        [...occupied].filter(
          (index) =>
            Number.isSafeInteger(index) && index >= 0 && index < length,
        ),
      ),
    };
  }

  function definitelyArrayExpression(
    rawExpression,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 16) {
      return false;
    }
    const expression = unwrap(rawExpression);
    if (ts.isArrayLiteralExpression(expression)) {
      return true;
    }
    if (ts.isIdentifier(expression)) {
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (
        declaration?.initializer === undefined ||
        !bindingIsConst(declaration) ||
        trail.has(declaration)
      ) {
        return false;
      }
      return definitelyArrayExpression(
        declaration.initializer,
        declaration,
        new Set([...trail, declaration]),
        depth + 1,
      );
    }
    if (ts.isNewExpression(expression)) {
      return intrinsicGlobalName(expression.expression, useNode) === "Array";
    }
    if (!ts.isCallExpression(expression)) {
      return false;
    }
    const target = unwrap(expression.expression);
    if (intrinsicGlobalName(target, useNode) === "Array") {
      return true;
    }
    const access = memberAccess(target);
    if (
      access !== undefined &&
      intrinsicGlobalName(access.receiver, useNode) === "Array" &&
      ["from", "of"].includes(access.member)
    ) {
      return true;
    }
    return (
      access?.member === "concat" &&
      definitelyArrayExpression(access.receiver, useNode, trail, depth + 1)
    );
  }

  function primitiveConcatArgumentShape(rawExpression) {
    const expression = unwrap(rawExpression);
    if (
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression) ||
      ts.isNumericLiteral(expression) ||
      ts.isBigIntLiteral(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(expression) &&
        expression.text === "undefined" &&
        !declaredValueNames.has("undefined")) ||
      (ts.isPrefixUnaryExpression(expression) &&
        [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(
          expression.operator,
        ) &&
        (ts.isNumericLiteral(unwrap(expression.operand)) ||
          ts.isBigIntLiteral(unwrap(expression.operand))))
    ) {
      return fullShape(1);
    }
    return undefined;
  }

  function exactConcatArgumentShape(expression, useNode, trail, depth) {
    if (depth > 16) {
      return "UNSTABLE";
    }
    const value = unwrap(expression);
    const primitive = primitiveConcatArgumentShape(value);
    if (primitive !== undefined) {
      return primitive;
    }
    if (ts.isIdentifier(value)) {
      if (definitelyArrayExpression(value, useNode, new Set(), depth + 1)) {
        return exactShape(value, useNode, trail, depth + 1);
      }
      const declaration = bindingAt(
        value.text,
        useNode.getStart(source),
        useNode,
      );
      if (
        declaration?.initializer === undefined ||
        !bindingIsConst(declaration) ||
        trail.has(declaration)
      ) {
        return "UNSTABLE";
      }
      const initializer = unwrap(declaration.initializer);
      if (
        primitiveConcatArgumentShape(initializer) === undefined &&
        !ts.isIdentifier(initializer)
      ) {
        return "UNSTABLE";
      }
      return exactConcatArgumentShape(
        initializer,
        useNode,
        new Set([...trail, declaration]),
        depth + 1,
      );
    }
    if (definitelyArrayExpression(value, useNode, new Set(), depth + 1)) {
      return exactShape(value, useNode, trail, depth + 1);
    }
    return ts.isObjectLiteralExpression(value)
      ? staticObjectConcatShape(value, useNode)
      : "UNSTABLE";
  }

  function staticConcatSpreadElements(rawExpression, useNode, trail, depth) {
    if (depth > 16) {
      return undefined;
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (
        declaration?.initializer === undefined ||
        !bindingIsConst(declaration) ||
        trail.has(declaration)
      ) {
        return undefined;
      }
      if (mutationEvents(expression.text, declaration, useNode).length > 0) {
        return undefined;
      }
      return staticConcatSpreadElements(
        declaration.initializer,
        useNode,
        new Set([...trail, declaration]),
        depth + 1,
      );
    }
    return ts.isArrayLiteralExpression(expression)
      ? [...expression.elements]
      : undefined;
  }

  function appendConcatArgument(shape, argument, useNode, trail, depth) {
    if (!ts.isSpreadElement(argument)) {
      const addition = exactConcatArgumentShape(
        argument,
        useNode,
        trail,
        depth + 1,
      );
      return shapeIsBounded(addition) && appendShape(shape, addition);
    }
    const elements = staticConcatSpreadElements(
      argument.expression,
      useNode,
      trail,
      depth + 1,
    );
    if (elements === undefined) {
      return false;
    }
    for (const element of elements) {
      if (ts.isOmittedExpression(element)) {
        if (!appendShape(shape, fullShape(1))) {
          return false;
        }
      } else if (
        !appendConcatArgument(shape, element, useNode, trail, depth + 1)
      ) {
        return false;
      }
    }
    return true;
  }

  function expressionContainsName(node, names) {
    let found = false;
    function inspect(current) {
      if (found) {
        return;
      }
      if (ts.isIdentifier(current) && names.has(current.text)) {
        found = true;
        return;
      }
      ts.forEachChild(current, inspect);
    }
    inspect(node);
    return found;
  }

  function expressionContainsNameOutsideDeferredBodies(node, names) {
    let found = false;
    function inspect(current) {
      if (found || functionLike(current)) {
        return;
      }
      if (ts.isIdentifier(current) && names.has(current.text)) {
        found = true;
        return;
      }
      ts.forEachChild(current, inspect);
    }
    inspect(node);
    return found;
  }

  function callableReturnExpressions(
    rawTarget,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return [];
    }
    const target = unwrap(rawTarget);
    if (functionLike(target)) {
      if (generatorFunctionLike(target)) {
        return [];
      }
      if (ts.isArrowFunction(target) && !ts.isBlock(target.body)) {
        return [target.body];
      }
      const body = target.body;
      if (body === undefined) {
        return [];
      }
      const returns = [];
      function inspect(current) {
        if (current !== body && functionLike(current)) {
          return;
        }
        if (ts.isReturnStatement(current) && current.expression !== undefined) {
          returns.push(current.expression);
          return;
        }
        ts.forEachChild(current, inspect);
      }
      inspect(body);
      return returns;
    }
    if (ts.isIdentifier(target)) {
      const returns = [];
      for (const declaration of functionsByName.get(target.text) ?? []) {
        returns.push(
          ...callableReturnExpressions(declaration, useNode, trail, depth + 1),
        );
      }
      const declaration = bindingAt(
        target.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(target.text, declaration, useNode);
        for (const { expression, context } of flow.values) {
          returns.push(
            ...callableReturnExpressions(
              expression,
              context,
              new Set([...trail, declaration]),
              depth + 1,
            ),
          );
        }
      }
      return returns;
    }
    const access = memberAccess(target);
    if (access !== undefined && ["call", "apply"].includes(access.member)) {
      return callableReturnExpressions(
        access.receiver,
        useNode,
        trail,
        depth + 1,
      );
    }
    if (ts.isConditionalExpression(target)) {
      const condition = staticBoolean(target.condition);
      return condition === undefined
        ? [
            ...callableReturnExpressions(
              target.whenTrue,
              useNode,
              trail,
              depth + 1,
            ),
            ...callableReturnExpressions(
              target.whenFalse,
              useNode,
              trail,
              depth + 1,
            ),
          ]
        : callableReturnExpressions(
            condition ? target.whenTrue : target.whenFalse,
            useNode,
            trail,
            depth + 1,
          );
    }
    if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return callableReturnExpressions(target.right, useNode, trail, depth + 1);
    }
    return [];
  }

  function localClassNodes(rawTarget, useNode, trail = new Set(), depth = 0) {
    if (depth > 8) {
      return [];
    }
    const target = unwrap(rawTarget);
    if (ts.isClassExpression(target) || ts.isClassDeclaration(target)) {
      return [target];
    }
    if (ts.isIdentifier(target)) {
      const classes = [...(classesByName.get(target.text) ?? [])];
      const declaration = bindingAt(
        target.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(target.text, declaration, useNode);
        for (const { expression, context } of flow.values) {
          classes.push(
            ...localClassNodes(
              expression,
              context,
              new Set([...trail, declaration]),
              depth + 1,
            ),
          );
        }
      }
      return classes;
    }
    if (ts.isConditionalExpression(target)) {
      const condition = staticBoolean(target.condition);
      return condition === undefined
        ? [
            ...localClassNodes(target.whenTrue, useNode, trail, depth + 1),
            ...localClassNodes(target.whenFalse, useNode, trail, depth + 1),
          ]
        : localClassNodes(
            condition ? target.whenTrue : target.whenFalse,
            useNode,
            trail,
            depth + 1,
          );
    }
    if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return localClassNodes(target.right, useNode, trail, depth + 1);
    }
    return [];
  }

  function classMemberCandidates(rawReceiver, member, useNode) {
    const receiver = unwrap(rawReceiver);
    const classNodes = [];
    if (ts.isNewExpression(receiver)) {
      classNodes.push(...localClassNodes(receiver.expression, useNode));
    } else if (ts.isIdentifier(receiver)) {
      classNodes.push(...localClassNodes(receiver, useNode));
      const declaration = bindingAt(
        receiver.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined) {
        const flow = bindingCurrentValueFlow(
          receiver.text,
          declaration,
          useNode,
        );
        for (const { expression } of flow.values) {
          const value = unwrap(expression);
          if (ts.isNewExpression(value)) {
            classNodes.push(...localClassNodes(value.expression, declaration));
          }
        }
      }
    }
    return classNodes.flatMap((classNode) =>
      classNode.members.filter(
        (candidate) =>
          candidate.name !== undefined &&
          staticPropertyName(candidate.name) === member,
      ),
    );
  }

  function localCallableNodes(
    rawTarget,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return [];
    }
    const target = unwrap(rawTarget);
    if (functionLike(target)) {
      return [target];
    }
    if (ts.isIdentifier(target)) {
      const callables = [...(functionsByName.get(target.text) ?? [])];
      const declaration = bindingAt(
        target.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(target.text, declaration, useNode);
        for (const { expression, context } of flow.values) {
          callables.push(
            ...localCallableNodes(
              expression,
              context,
              new Set([...trail, declaration]),
              depth + 1,
            ),
          );
        }
      }
      return callables;
    }
    const access = memberAccess(target);
    if (access !== undefined) {
      if (["bind", "call", "apply"].includes(access.member)) {
        return localCallableNodes(access.receiver, useNode, trail, depth + 1);
      }
      const candidates = [
        ...(memberCurrentValueFlow(
          access.receiver,
          access.member,
          useNode,
        )?.values.map(({ expression }) => expression) ?? []),
        ...(memberCurrentValueFlow(access.receiver, access.member, useNode) ===
        undefined
          ? staticObjectMemberCandidates(
              access.receiver,
              access.member,
              useNode,
            )
          : []),
        ...classMemberCandidates(access.receiver, access.member, useNode),
      ];
      return candidates.flatMap((candidate) =>
        localCallableNodes(candidate, useNode, trail, depth + 1),
      );
    }
    if (ts.isConditionalExpression(target)) {
      const condition = staticBoolean(target.condition);
      return condition === undefined
        ? [
            ...localCallableNodes(target.whenTrue, useNode, trail, depth + 1),
            ...localCallableNodes(target.whenFalse, useNode, trail, depth + 1),
          ]
        : localCallableNodes(
            condition ? target.whenTrue : target.whenFalse,
            useNode,
            trail,
            depth + 1,
          );
    }
    if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return localCallableNodes(target.right, useNode, trail, depth + 1);
    }
    return [];
  }

  function parameterDefaultExpressions(parameter) {
    const defaults = [];
    function inspectBinding(name) {
      if (ts.isIdentifier(name)) {
        return;
      }
      for (const element of name.elements) {
        if (!ts.isBindingElement(element)) {
          continue;
        }
        if (element.initializer !== undefined) {
          defaults.push(element.initializer);
        }
        inspectBinding(element.name);
      }
    }
    if (parameter.initializer !== undefined) {
      defaults.push(parameter.initializer);
    }
    inspectBinding(parameter.name);
    return defaults;
  }

  function callUsesCapturedDefault(rawCall, names, useNode) {
    const call = unwrap(rawCall);
    if (!ts.isCallExpression(call)) {
      return false;
    }
    return localCallableNodes(call.expression, useNode).some((callable) =>
      callable.parameters.some(
        (parameter, index) =>
          call.arguments[index] === undefined &&
          parameterDefaultExpressions(parameter).some((expression) =>
            expressionContainsName(expression, names),
          ),
      ),
    );
  }

  function callableParameterUsesFails(callable, parameter) {
    if (!ts.isIdentifier(parameter.name) || callable.body === undefined) {
      return false;
    }
    const parameterName = parameter.name.text;
    let found = false;
    function inspect(node) {
      if (found || (node !== callable.body && functionLike(node))) {
        return;
      }
      const access = memberAccess(node);
      if (
        access?.member === "fails" &&
        ts.isIdentifier(access.receiver) &&
        access.receiver.text === parameterName
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, inspect);
    }
    inspect(callable.body);
    return found;
  }

  function callInvokesDefaultVitestFails(rawCall, useNode) {
    const call = unwrap(rawCall);
    if (!ts.isCallExpression(call)) {
      return false;
    }
    return localCallableNodes(call.expression, useNode).some((callable) =>
      callable.parameters.some(
        (parameter, index) =>
          call.arguments[index] === undefined &&
          callableParameterUsesFails(callable, parameter) &&
          parameterDefaultExpressions(parameter).some(
            (expression) =>
              resolveCurrentVitestExpression(expression, parameter) !==
              undefined,
          ),
      ),
    );
  }

  function expressionResolvesConnectedAlias(
    rawExpression,
    names,
    useNode,
    trail = new Set(),
    depth = 0,
    currentUseNode = useNode,
  ) {
    if (depth > 8) {
      return true;
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      if (names.has(expression.text)) {
        return bindingReferenceStillCurrent(
          expression.text,
          useNode,
          currentUseNode,
        );
      }
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration === undefined || trail.has(declaration)) {
        return false;
      }
      const flow = bindingCurrentValueFlow(
        expression.text,
        declaration,
        useNode,
      );
      return (
        flow.unknown ||
        flow.values.some(({ expression: value, context }) =>
          expressionResolvesConnectedAlias(
            value,
            names,
            context,
            new Set([...trail, declaration]),
            depth + 1,
            currentUseNode,
          ),
        )
      );
    }
    const access = memberAccess(expression);
    if (access !== undefined) {
      const candidates = [
        ...(memberCurrentValueFlow(
          access.receiver,
          access.member,
          useNode,
        )?.values.map(({ expression: value }) => value) ?? []),
        ...(memberCurrentValueFlow(access.receiver, access.member, useNode) ===
        undefined
          ? staticObjectMemberCandidates(
              access.receiver,
              access.member,
              useNode,
            )
          : []),
        ...classMemberCandidates(access.receiver, access.member, useNode),
      ];
      return candidates.some((candidate) => {
        const value = unwrap(candidate);
        if (
          ts.isPropertyDeclaration(value) &&
          value.initializer !== undefined
        ) {
          return expressionResolvesConnectedAlias(
            value.initializer,
            names,
            useNode,
            trail,
            depth + 1,
            currentUseNode,
          );
        }
        if (ts.isGetAccessorDeclaration(value)) {
          return callableReturnExpressions(value, useNode).some((returned) =>
            expressionResolvesConnectedAlias(
              returned,
              names,
              useNode,
              trail,
              depth + 1,
              currentUseNode,
            ),
          );
        }
        return expressionResolvesConnectedAlias(
          value,
          names,
          useNode,
          trail,
          depth + 1,
          currentUseNode,
        );
      });
    }
    if (ts.isCallExpression(expression)) {
      return callableReturnExpressions(expression.expression, useNode).some(
        (returned) =>
          expressionResolvesConnectedAlias(
            returned,
            names,
            useNode,
            trail,
            depth + 1,
            currentUseNode,
          ),
      );
    }
    if (ts.isConditionalExpression(expression)) {
      return (
        expressionResolvesConnectedAlias(
          expression.whenTrue,
          names,
          useNode,
          trail,
          depth + 1,
          currentUseNode,
        ) ||
        expressionResolvesConnectedAlias(
          expression.whenFalse,
          names,
          useNode,
          trail,
          depth + 1,
          currentUseNode,
        )
      );
    }
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return expressionResolvesConnectedAlias(
        expression.right,
        names,
        useNode,
        trail,
        depth + 1,
        currentUseNode,
      );
    }
    return false;
  }

  function callOnlyReturnsDirectAlias(rawCall, names, useNode) {
    const call = unwrap(rawCall);
    if (!ts.isCallExpression(call) || call.arguments.length !== 0) {
      return false;
    }
    const returns = callableReturnExpressions(call.expression, useNode);
    return (
      returns.length > 0 &&
      returns.every((expression) => isDirectAlias(expression, names))
    );
  }

  function callableBodyCapturesName(node, names, useNode, trail, depth) {
    if (depth > 8) {
      return true;
    }
    if (expressionContainsName(node, names)) {
      return true;
    }
    let found = false;
    function inspect(current) {
      if (found) {
        return;
      }
      if (ts.isCallExpression(current)) {
        if (
          callbackCapturesName(
            current.expression,
            names,
            useNode,
            trail,
            depth + 1,
          )
        ) {
          found = true;
          return;
        }
      }
      ts.forEachChild(current, inspect);
    }
    inspect(node);
    return found;
  }

  function callbackCapturesName(
    argument,
    names,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return true;
    }
    const callback = unwrap(argument);
    if (functionLike(callback) && generatorFunctionLike(callback)) {
      return false;
    }
    if (expressionContainsName(argument, names)) {
      return true;
    }
    if (functionLike(callback)) {
      return callableBodyCapturesName(
        callback,
        names,
        useNode,
        trail,
        depth + 1,
      );
    }
    const callbackAccess = memberAccess(callback);
    const callbackClass =
      callbackAccess === undefined
        ? undefined
        : constructedClassName(callbackAccess.receiver, useNode);
    if (
      callbackClass !== undefined &&
      (classesByName.get(callbackClass) ?? []).some((declaration) => {
        const key = `class:${callbackClass}`;
        return (
          trail.has(key) ||
          callableBodyCapturesName(
            declaration,
            names,
            useNode,
            new Set([...trail, key]),
            depth + 1,
          )
        );
      })
    ) {
      return true;
    }
    const localCallables = !functionLike(callback)
      ? localCallableNodes(callback, useNode, trail, depth + 1)
      : [];
    if (
      localCallables.some(
        (callable) =>
          !generatorFunctionLike(callable) &&
          callableBodyCapturesName(
            callable.body ?? callable,
            names,
            useNode,
            trail,
            depth + 1,
          ),
      )
    ) {
      return true;
    }
    if (localCallables.length > 0) {
      return false;
    }
    if (!ts.isIdentifier(callback)) {
      return false;
    }
    if (trail.has(callback.text)) {
      return true;
    }
    const nextTrail = new Set(trail);
    nextTrail.add(callback.text);
    if (
      (functionsByName.get(callback.text) ?? []).some(
        (declaration) =>
          !generatorFunctionLike(declaration) &&
          declaration.body !== undefined &&
          callableBodyCapturesName(
            declaration.body,
            names,
            useNode,
            nextTrail,
            depth + 1,
          ),
      )
    ) {
      return true;
    }
    const declaration = bindingAt(
      callback.text,
      useNode.getStart(source),
      useNode,
    );
    if (declaration === undefined) {
      return false;
    }
    if (declaration.initializer === undefined) {
      return true;
    }
    const initializer = unwrap(declaration.initializer);
    return ts.isIdentifier(initializer) || functionLike(initializer)
      ? callbackCapturesName(
          initializer,
          names,
          declaration,
          nextTrail,
          depth + 1,
        )
      : !(
          ts.isNumericLiteral(initializer) ||
          ts.isStringLiteralLike(initializer) ||
          initializer.kind === ts.SyntaxKind.TrueKeyword ||
          initializer.kind === ts.SyntaxKind.FalseKeyword ||
          initializer.kind === ts.SyntaxKind.NullKeyword ||
          ts.isObjectLiteralExpression(initializer) ||
          ts.isArrayLiteralExpression(initializer)
        );
  }

  function localMemberCallableCapturesName(
    rawReceiver,
    member,
    names,
    useNode,
    candidateFilter = () => true,
  ) {
    const candidates = [
      ...staticObjectMemberCandidates(rawReceiver, member, useNode),
      ...classMemberCandidates(rawReceiver, member, useNode),
    ];
    return candidates.some((candidate) => {
      if (!candidateFilter(candidate)) {
        return false;
      }
      if (functionLike(candidate)) {
        return callableBodyCapturesName(
          candidate.body ?? candidate,
          names,
          useNode,
          new Set(),
          0,
        );
      }
      if (
        ts.isPropertyDeclaration(candidate) &&
        candidate.initializer !== undefined
      ) {
        return callbackCapturesName(candidate.initializer, names, useNode);
      }
      return callbackCapturesName(candidate, names, useNode);
    });
  }

  function localAccessorCapturesName(rawAccess, names, useNode, accessorKind) {
    if (!sourceHasAccessorDeclarations) {
      return false;
    }
    const access = memberAccess(rawAccess);
    if (access?.member === undefined) {
      return false;
    }
    return localNamedAccessorCapturesName(
      access.receiver,
      access.member,
      names,
      useNode,
      accessorKind,
    );
  }

  function localNamedAccessorCapturesName(
    rawReceiver,
    member,
    names,
    useNode,
    accessorKind,
  ) {
    if (!sourceHasAccessorDeclarations) {
      return false;
    }
    return localMemberCallableCapturesName(
      rawReceiver,
      member,
      names,
      useNode,
      (candidate) =>
        accessorKind === "get"
          ? ts.isGetAccessorDeclaration(candidate)
          : ts.isSetAccessorDeclaration(candidate),
    );
  }

  function localAnyAccessorCapturesName(
    rawReceiver,
    names,
    useNode,
    accessorKind,
  ) {
    if (!sourceHasAccessorDeclarations) {
      return false;
    }
    return staticObjectMemberCandidates(rawReceiver, undefined, useNode).some(
      (candidate) =>
        (accessorKind === "get"
          ? ts.isGetAccessorDeclaration(candidate)
          : ts.isSetAccessorDeclaration(candidate)) &&
        callableBodyCapturesName(
          candidate.body ?? candidate,
          names,
          useNode,
          new Set(),
          0,
        ),
    );
  }

  function objectPatternGetterCapturesName(
    rawPattern,
    rawReceiver,
    names,
    useNode,
  ) {
    const pattern = unwrap(rawPattern);
    const members = [];
    let readsRest = false;
    if (ts.isObjectBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        if (element.dotDotDotToken !== undefined) {
          readsRest = true;
          continue;
        }
        const property = element.propertyName ?? element.name;
        const member = ts.isIdentifier(property)
          ? property.text
          : staticPropertyName(property);
        if (member === undefined) {
          readsRest = true;
          continue;
        }
        members.push(member);
      }
    } else if (ts.isObjectLiteralExpression(pattern)) {
      for (const property of pattern.properties) {
        if (ts.isSpreadAssignment(property)) {
          readsRest = true;
          continue;
        }
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isShorthandPropertyAssignment(property)
        ) {
          return true;
        }
        const member = staticPropertyName(property.name);
        if (member === undefined) {
          readsRest = true;
          continue;
        }
        members.push(member);
      }
    } else {
      return false;
    }
    return (
      members.some((member) =>
        localMemberCallableCapturesName(
          rawReceiver,
          member,
          names,
          useNode,
          ts.isGetAccessorDeclaration,
        ),
      ) ||
      (readsRest &&
        localAnyAccessorCapturesName(rawReceiver, names, useNode, "get"))
    );
  }

  function localProtocolCapturesName(rawExpression, members, names, useNode) {
    if (!sourceHasProtocolMemberDeclarations) {
      return false;
    }
    return members.some((member) =>
      localMemberCallableCapturesName(rawExpression, member, names, useNode),
    );
  }

  function descriptorAccessorCallDetails(rawExpression, useNode) {
    const descriptorCall = unwrap(rawExpression);
    if (!ts.isCallExpression(descriptorCall)) {
      return undefined;
    }
    const descriptorTarget = memberAccess(descriptorCall.expression);
    if (
      descriptorTarget?.member !== "getOwnPropertyDescriptor" ||
      intrinsicGlobalName(descriptorTarget.receiver, useNode) !== "Object" ||
      descriptorCall.arguments.length < 2 ||
      ts.isSpreadElement(descriptorCall.arguments[0]) ||
      ts.isSpreadElement(descriptorCall.arguments[1])
    ) {
      return undefined;
    }
    return {
      receiver: descriptorCall.arguments[0],
      member: resolvedLiteralMember(descriptorCall.arguments[1]),
    };
  }

  function descriptorAccessorCapturesName(
    details,
    accessorKind,
    names,
    useNode,
  ) {
    return details.member === undefined
      ? localAnyAccessorCapturesName(
          details.receiver,
          names,
          useNode,
          accessorKind,
        )
      : localNamedAccessorCapturesName(
          details.receiver,
          details.member,
          names,
          useNode,
          accessorKind,
        );
  }

  function descriptorAccessorInvocationCapturesName(
    rawTarget,
    names,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return true;
    }
    let target = unwrap(rawTarget);
    let access = memberAccess(target);
    if (access !== undefined && ["apply", "call"].includes(access.member)) {
      target = unwrap(access.receiver);
      access = memberAccess(target);
    }
    if (access !== undefined && ["get", "set"].includes(access.member)) {
      const details = descriptorAccessorCallDetails(access.receiver, useNode);
      return (
        details !== undefined &&
        descriptorAccessorCapturesName(details, access.member, names, useNode)
      );
    }
    if (!ts.isIdentifier(target)) {
      return false;
    }
    const declaration = bindingAt(
      target.text,
      useNode.getStart(source),
      useNode,
    );
    if (declaration !== undefined && !trail.has(declaration)) {
      const flow = bindingCurrentValueFlow(target.text, declaration, useNode);
      if (
        flow.unknown ||
        flow.values.some(({ expression, context }) =>
          descriptorAccessorInvocationCapturesName(
            expression,
            names,
            context,
            new Set([...trail, declaration]),
            depth + 1,
          ),
        )
      ) {
        return true;
      }
    }
    for (const binding of variableDeclarations) {
      if (
        !ts.isObjectBindingPattern(binding.name) ||
        binding.initializer === undefined ||
        !bindingVisibleAt(binding, useNode.getStart(source), useNode) ||
        trail.has(binding)
      ) {
        continue;
      }
      const details = descriptorAccessorCallDetails(
        binding.initializer,
        binding,
      );
      if (details === undefined) {
        continue;
      }
      for (const element of binding.name.elements) {
        if (
          !ts.isIdentifier(element.name) ||
          element.name.text !== target.text
        ) {
          continue;
        }
        const member =
          element.propertyName === undefined
            ? element.name.text
            : ts.isIdentifier(element.propertyName) ||
                ts.isStringLiteralLike(element.propertyName)
              ? element.propertyName.text
              : undefined;
        if (
          ["get", "set"].includes(member) &&
          descriptorAccessorCapturesName(details, member, names, useNode)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function intrinsicStaticCallOwner(rawTarget, useNode) {
    const access = memberAccess(rawTarget);
    return access === undefined
      ? undefined
      : intrinsicGlobalName(access.receiver, useNode);
  }

  function intrinsicCallDoesNotInvokeProtocols(rawTarget, useNode) {
    const access = memberAccess(rawTarget);
    const owner = intrinsicStaticCallOwner(rawTarget, useNode);
    return (
      (owner === "Object" &&
        [
          "entries",
          "getOwnPropertyDescriptors",
          "getOwnPropertyNames",
          "getOwnPropertySymbols",
          "keys",
          "values",
        ].includes(access?.member)) ||
      (owner === "JSON" && access?.member === "stringify")
    );
  }

  function intrinsicCallInvokesLocalMember(rawCall, names, useNode) {
    const call = unwrap(rawCall);
    if (!ts.isCallExpression(call) || call.arguments.length === 0) {
      return false;
    }
    const access = memberAccess(call.expression);
    const owner = intrinsicStaticCallOwner(call.expression, useNode);
    const argument = call.arguments[0];
    if (ts.isSpreadElement(argument)) {
      return true;
    }
    if (owner === "Object" && ["entries", "values"].includes(access?.member)) {
      return localAnyAccessorCapturesName(argument, names, useNode, "get");
    }
    if (owner === "JSON" && access?.member === "stringify") {
      return (
        localAnyAccessorCapturesName(argument, names, useNode, "get") ||
        localMemberCallableCapturesName(argument, "toJSON", names, useNode)
      );
    }
    return false;
  }

  function parameterReferenceIsNonInvoking(reference, useNode) {
    const parent = reference.parent;
    if (
      (ts.isVoidExpression(parent) || ts.isTypeOfExpression(parent)) &&
      unwrap(parent.expression) === reference
    ) {
      return true;
    }
    if (
      ts.isPrefixUnaryExpression(parent) &&
      parent.operator === ts.SyntaxKind.ExclamationToken &&
      unwrap(parent.operand) === reference
    ) {
      return true;
    }
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(parent.operatorToken.kind)
    ) {
      return true;
    }
    if (
      ts.isCallExpression(parent) &&
      parent.arguments.some((argument) => unwrap(argument) === reference) &&
      intrinsicGlobalName(parent.expression, useNode) === "Boolean"
    ) {
      return true;
    }
    return false;
  }

  function callMayInvokeProtocolOnArgument(rawTarget, index, useNode) {
    if (intrinsicCallDoesNotInvokeProtocols(rawTarget, useNode)) {
      return false;
    }
    const intrinsic = intrinsicGlobalName(rawTarget, useNode);
    if (["Array", "Boolean", "Object"].includes(intrinsic)) {
      return false;
    }
    const callables = localCallableNodes(rawTarget, useNode);
    if (callables.length === 0) {
      return true;
    }
    return callables.some((callable) => {
      if (generatorFunctionLike(callable) || callable.body === undefined) {
        return true;
      }
      const lastParameter = callable.parameters.at(-1);
      const parameter =
        callable.parameters[index] ??
        (lastParameter?.dotDotDotToken === undefined
          ? undefined
          : lastParameter);
      if (
        parameter === undefined ||
        (!ts.isIdentifier(parameter.name) &&
          parameter.dotDotDotToken === undefined)
      ) {
        let referencesArguments = false;
        function inspectArguments(current) {
          if (
            referencesArguments ||
            (current !== callable && functionLike(current))
          ) {
            return;
          }
          if (ts.isIdentifier(current) && current.text === "arguments") {
            referencesArguments = true;
            return;
          }
          ts.forEachChild(current, inspectArguments);
        }
        inspectArguments(callable.body);
        return referencesArguments;
      }
      if (!ts.isIdentifier(parameter.name)) {
        return true;
      }
      let unsafe = false;
      function inspect(current) {
        if (unsafe || (current !== callable.body && functionLike(current))) {
          return;
        }
        if (
          ts.isIdentifier(current) &&
          current.text === parameter.name.text &&
          current !== parameter.name &&
          !parameterReferenceIsNonInvoking(current, useNode)
        ) {
          unsafe = true;
          return;
        }
        ts.forEachChild(current, inspect);
      }
      inspect(callable.body);
      return unsafe;
    });
  }

  function localCallableReference(argument, useNode, trail = new Set()) {
    const callback = unwrap(argument);
    if (functionLike(callback)) {
      return true;
    }
    const access = memberAccess(callback);
    if (
      access !== undefined &&
      constructedClassName(access.receiver, useNode) !== undefined
    ) {
      return true;
    }
    if (
      access !== undefined &&
      localCallableNodes(callback, useNode, trail).length > 0
    ) {
      return true;
    }
    if (!ts.isIdentifier(callback) || trail.has(callback.text)) {
      return false;
    }
    if ((functionsByName.get(callback.text) ?? []).length > 0) {
      return true;
    }
    const declaration = bindingAt(
      callback.text,
      useNode.getStart(source),
      useNode,
    );
    if (declaration?.initializer === undefined) {
      return false;
    }
    const initializer = unwrap(declaration.initializer);
    const boundTarget =
      ts.isCallExpression(initializer) &&
      memberAccess(initializer.expression)?.member === "bind"
        ? memberAccess(initializer.expression).receiver
        : undefined;
    return (
      functionLike(initializer) ||
      (boundTarget !== undefined &&
        localCallableReference(
          boundTarget,
          declaration,
          new Set([...trail, callback.text]),
        )) ||
      (ts.isIdentifier(initializer) &&
        localCallableReference(
          initializer,
          declaration,
          new Set([...trail, callback.text]),
        ))
    );
  }

  function classConstructionCapturesName(
    rawTarget,
    names,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return true;
    }
    const target = unwrap(rawTarget);
    if (ts.isClassExpression(target) || ts.isClassDeclaration(target)) {
      return target.members.some(
        (member) =>
          ts.isConstructorDeclaration(member) &&
          callableBodyCapturesName(member, names, useNode, trail, depth + 1),
      );
    }
    if (ts.isIdentifier(target)) {
      const declaration = bindingAt(
        target.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(target.text, declaration, useNode);
        if (
          flow.unknown ||
          flow.values.some(({ expression, context }) =>
            classConstructionCapturesName(
              expression,
              names,
              context,
              new Set([...trail, declaration]),
              depth + 1,
            ),
          )
        ) {
          return true;
        }
      }
      return (classesByName.get(target.text) ?? []).some((classDeclaration) =>
        classConstructionCapturesName(
          classDeclaration,
          names,
          useNode,
          trail,
          depth + 1,
        ),
      );
    }
    if (ts.isConditionalExpression(target)) {
      const condition = staticBoolean(target.condition);
      return condition === undefined
        ? classConstructionCapturesName(
            target.whenTrue,
            names,
            useNode,
            trail,
            depth + 1,
          ) ||
            classConstructionCapturesName(
              target.whenFalse,
              names,
              useNode,
              trail,
              depth + 1,
            )
        : classConstructionCapturesName(
            condition ? target.whenTrue : target.whenFalse,
            names,
            useNode,
            trail,
            depth + 1,
          );
    }
    if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return classConstructionCapturesName(
        target.right,
        names,
        useNode,
        trail,
        depth + 1,
      );
    }
    return false;
  }

  function callTargetCapturesName(
    rawTarget,
    names,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return true;
    }
    const target = unwrap(rawTarget);
    if (ts.isCallExpression(target)) {
      const bound = memberAccess(target.expression);
      if (bound?.member === "bind") {
        return callTargetCapturesName(
          bound.receiver,
          names,
          useNode,
          trail,
          depth + 1,
        );
      }
    }
    if (
      localCallableNodes(target, useNode, trail, depth + 1).some(
        (callable) =>
          !generatorFunctionLike(callable) &&
          callableBodyCapturesName(
            callable.body ?? callable,
            names,
            useNode,
            trail,
            depth + 1,
          ),
      )
    ) {
      return true;
    }
    const targetDeclaration = ts.isIdentifier(target)
      ? bindingAt(target.text, useNode.getStart(source), useNode)
      : undefined;
    if (
      targetDeclaration === undefined &&
      localCallableReference(target, useNode, trail) &&
      callbackCapturesName(target, names, useNode, trail, depth + 1)
    ) {
      return true;
    }
    if (ts.isIdentifier(target)) {
      const declaration = targetDeclaration;
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(target.text, declaration, useNode);
        if (
          flow.unknown ||
          flow.values.some(
            ({ expression, context }) =>
              ts.isCallExpression(unwrap(expression)) ||
              ts.isNewExpression(unwrap(expression)) ||
              ts.isAwaitExpression(unwrap(expression)) ||
              callTargetCapturesName(
                expression,
                names,
                context,
                new Set([...trail, declaration]),
                depth + 1,
              ),
          )
        ) {
          return true;
        }
      }
      const destructured = destructuredBindingCandidates(target.text, useNode);
      if (
        destructured !== undefined &&
        !trail.has(destructured.declaration) &&
        destructured.values.some((value) =>
          callTargetCapturesName(
            value,
            names,
            destructured.declaration,
            new Set([...trail, destructured.declaration]),
            depth + 1,
          ),
        )
      ) {
        return true;
      }
    }
    const access = memberAccess(target);
    if (
      access?.member === "next" &&
      ts.isCallExpression(unwrap(access.receiver)) &&
      localCallableNodes(
        unwrap(access.receiver).expression,
        useNode,
        trail,
        depth + 1,
      ).some(
        (callable) =>
          generatorFunctionLike(callable) &&
          callableBodyCapturesName(
            callable.body ?? callable,
            names,
            useNode,
            trail,
            depth + 1,
          ),
      )
    ) {
      return true;
    }
    if (access !== undefined && ["call", "apply"].includes(access.member)) {
      return callTargetCapturesName(
        access.receiver,
        names,
        useNode,
        trail,
        depth + 1,
      );
    }
    const memberFlow =
      access === undefined
        ? undefined
        : memberCurrentValueFlow(access.receiver, access.member, useNode);
    if (memberFlow !== undefined) {
      return (
        memberFlow.unknown ||
        memberFlow.values.some(
          ({ expression, context }) =>
            ts.isCallExpression(unwrap(expression)) ||
            ts.isNewExpression(unwrap(expression)) ||
            ts.isAwaitExpression(unwrap(expression)) ||
            callTargetCapturesName(
              expression,
              names,
              context,
              trail,
              depth + 1,
            ),
        )
      );
    }
    if (
      access !== undefined &&
      staticObjectMemberCandidates(
        access.receiver,
        access.member,
        useNode,
        trail,
        depth + 1,
      ).some((value) =>
        callTargetCapturesName(value, names, useNode, trail, depth + 1),
      )
    ) {
      return true;
    }
    if (ts.isConditionalExpression(target)) {
      const condition = staticBoolean(target.condition);
      if (condition !== undefined) {
        return callTargetCapturesName(
          condition ? target.whenTrue : target.whenFalse,
          names,
          useNode,
          trail,
          depth + 1,
        );
      }
      return (
        callTargetCapturesName(
          target.whenTrue,
          names,
          useNode,
          trail,
          depth + 1,
        ) ||
        callTargetCapturesName(
          target.whenFalse,
          names,
          useNode,
          trail,
          depth + 1,
        )
      );
    }
    if (ts.isBinaryExpression(target)) {
      if (target.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return callTargetCapturesName(
          target.right,
          names,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        target.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        target.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        return target.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ? callTargetCapturesName(
              target.right,
              names,
              useNode,
              trail,
              depth + 1,
            )
          : true;
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(target.operatorToken.kind)
      ) {
        const left = staticBoolean(target.left);
        if (left !== undefined) {
          const selectsRight =
            (target.operatorToken.kind ===
              ts.SyntaxKind.AmpersandAmpersandToken &&
              left) ||
            (target.operatorToken.kind === ts.SyntaxKind.BarBarToken && !left);
          return selectsRight
            ? callTargetCapturesName(
                target.right,
                names,
                useNode,
                trail,
                depth + 1,
              )
            : callTargetCapturesName(
                target.left,
                names,
                useNode,
                trail,
                depth + 1,
              );
        }
        return (
          callTargetCapturesName(
            target.left,
            names,
            useNode,
            trail,
            depth + 1,
          ) ||
          callTargetCapturesName(target.right, names, useNode, trail, depth + 1)
        );
      }
    }
    return false;
  }

  function connectedAliases(name, position, useNode) {
    const names = new Set([name]);
    for (let pass = 0; pass <= variableDeclarations.length; pass += 1) {
      let changed = false;
      for (const declaration of variableDeclarations) {
        if (
          !ts.isIdentifier(declaration.name) ||
          declaration.initializer === undefined ||
          !bindingVisibleAt(declaration, position, useNode)
        ) {
          continue;
        }
        const flow = bindingCurrentValueFlow(
          declaration.name.text,
          declaration,
          useNode,
        );
        const connectedNames = new Set();
        for (const { expression: value, context } of flow.values) {
          const current = unwrap(value);
          if (
            ts.isIdentifier(current) &&
            bindingReferenceStillCurrent(current.text, context, useNode)
          ) {
            connectedNames.add(current.text);
          } else if (
            ts.isCallExpression(current) &&
            current.arguments.length === 0
          ) {
            for (const returned of callableReturnExpressions(
              current.expression,
              declaration,
            )) {
              const returnedValue = unwrap(returned);
              if (ts.isIdentifier(returnedValue)) {
                connectedNames.add(returnedValue.text);
              }
            }
          }
        }
        if (
          [...connectedNames].some((connected) => names.has(connected)) &&
          !names.has(declaration.name.text)
        ) {
          names.add(declaration.name.text);
          changed = true;
        }
        if (
          names.has(declaration.name.text) &&
          [...connectedNames].some((connected) => !names.has(connected))
        ) {
          for (const connected of connectedNames) {
            if (!names.has(connected)) {
              names.add(connected);
              changed = true;
            }
          }
        }
      }
      if (!changed) {
        break;
      }
    }
    return names;
  }

  function isDirectAlias(rawExpression, names) {
    const expression = unwrap(rawExpression);
    return ts.isIdentifier(expression) && names.has(expression.text);
  }

  function isSafeIdentityCopy(rawExpression, names) {
    const expression = unwrap(rawExpression);
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.every(
        (element) =>
          !expressionContainsName(element, names) ||
          (ts.isSpreadElement(element) &&
            (isDirectAlias(element.expression, names) ||
              isSafeIdentityCopy(element.expression, names))),
      );
    }
    if (ts.isNewExpression(expression)) {
      const target = unwrap(expression.expression);
      const args = expression.arguments ?? [];
      return (
        ts.isIdentifier(target) &&
        ["Map", "Set"].includes(target.text) &&
        !declaredValueNames.has(target.text) &&
        args.length === 1 &&
        !ts.isSpreadElement(args[0]) &&
        (isDirectAlias(args[0], names) || isSafeIdentityCopy(args[0], names))
      );
    }
    if (!ts.isCallExpression(expression)) {
      return false;
    }
    const access = memberAccess(expression.expression);
    if (access === undefined) {
      return false;
    }
    const argsDoNotCapture = expression.arguments.every(
      (argument) => !expressionContainsName(argument, names),
    );
    if (
      isDirectAlias(access.receiver, names) &&
      [
        "concat",
        "filter",
        "flat",
        "flatMap",
        "map",
        "slice",
        "toReversed",
        "toSorted",
        "toSpliced",
        "with",
      ].includes(access.member)
    ) {
      return argsDoNotCapture;
    }
    return (
      ts.isIdentifier(access.receiver) &&
      access.receiver.text === "Array" &&
      access.member === "from" &&
      !declaredValueNames.has("Array") &&
      expression.arguments[0] !== undefined &&
      isDirectAlias(expression.arguments[0], names) &&
      expression.arguments
        .slice(1)
        .every((argument) => !expressionContainsName(argument, names))
    );
  }

  function uncertainControlFlow(node, useContainers) {
    let current = node.parent;
    while (current !== undefined && current !== source) {
      if (functionLike(current)) {
        return !useContainers.has(current);
      }
      if (
        ts.isIfStatement(current) ||
        ts.isConditionalExpression(current) ||
        ts.isSwitchStatement(current) ||
        ts.isForStatement(current) ||
        ts.isForInStatement(current) ||
        ts.isForOfStatement(current) ||
        ts.isWhileStatement(current) ||
        ts.isDoStatement(current) ||
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

  function staticBoolean(rawExpression) {
    const expression = unwrap(rawExpression);
    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }
    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }
    return undefined;
  }

  function definitelyUnreachable(node) {
    let child = node;
    let current = node.parent;
    while (current !== undefined && current !== source) {
      if (ts.isIfStatement(current)) {
        const condition = staticBoolean(current.expression);
        if (
          (child === current.thenStatement && condition === false) ||
          (child === current.elseStatement && condition === true)
        ) {
          return true;
        }
      } else if (ts.isConditionalExpression(current)) {
        const condition = staticBoolean(current.condition);
        if (
          (child === current.whenTrue && condition === false) ||
          (child === current.whenFalse && condition === true)
        ) {
          return true;
        }
      } else if (ts.isBinaryExpression(current) && child === current.right) {
        const left = staticBoolean(current.left);
        if (
          (current.operatorToken.kind ===
            ts.SyntaxKind.AmpersandAmpersandToken &&
            left === false) ||
          (current.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
            left === true)
        ) {
          return true;
        }
      }
      child = current;
      current = current.parent;
    }
    return false;
  }

  const UNKNOWN_INTRINSIC_REFERENCE = "__unknown_intrinsic__";

  function resolvedCallReturnCandidates(rawCall, useNode) {
    const call = unwrap(rawCall);
    if (!ts.isCallExpression(call)) {
      return [];
    }
    const candidates = [];
    for (const callable of localCallableNodes(call.expression, useNode)) {
      for (const returned of callableReturnExpressions(callable, useNode)) {
        const value = unwrap(returned);
        const parameterIndex = ts.isIdentifier(value)
          ? callable.parameters.findIndex(
              (parameter) =>
                ts.isIdentifier(parameter.name) &&
                parameter.name.text === value.text,
            )
          : -1;
        if (parameterIndex < 0) {
          candidates.push({ expression: returned, context: callable });
          continue;
        }
        const argument = call.arguments[parameterIndex];
        if (argument !== undefined && !ts.isSpreadElement(argument)) {
          candidates.push({ expression: argument, context: call });
          continue;
        }
        const parameter = callable.parameters[parameterIndex];
        if (argument === undefined && parameter.initializer !== undefined) {
          candidates.push({
            expression: parameter.initializer,
            context: parameter,
          });
        }
      }
    }
    return candidates;
  }

  function staticMapLookup(rawCall) {
    const call = unwrap(rawCall);
    if (!ts.isCallExpression(call) || call.arguments.length !== 1) {
      return undefined;
    }
    const access = memberAccess(call.expression);
    const receiver = access === undefined ? undefined : unwrap(access.receiver);
    if (
      access?.member !== "get" ||
      receiver === undefined ||
      !ts.isNewExpression(receiver) ||
      !ts.isIdentifier(unwrap(receiver.expression)) ||
      unwrap(receiver.expression).text !== "Map" ||
      !unshadowedGlobalIdentifier("Map", receiver) ||
      (receiver.arguments ?? []).length !== 1 ||
      ts.isSpreadElement(call.arguments[0]) ||
      ts.isSpreadElement(receiver.arguments[0])
    ) {
      return undefined;
    }
    const lookupKey = resolvedLiteralMember(call.arguments[0]);
    const entries = unwrap(receiver.arguments[0]);
    if (!ts.isArrayLiteralExpression(entries)) {
      return { value: undefined, unknown: true };
    }
    let matched;
    let unknown = lookupKey === undefined;
    for (const rawEntry of entries.elements) {
      if (ts.isOmittedExpression(rawEntry) || ts.isSpreadElement(rawEntry)) {
        unknown = true;
        continue;
      }
      const entry = unwrap(rawEntry);
      if (
        !ts.isArrayLiteralExpression(entry) ||
        entry.elements.length < 2 ||
        ts.isOmittedExpression(entry.elements[0]) ||
        ts.isSpreadElement(entry.elements[0]) ||
        ts.isOmittedExpression(entry.elements[1]) ||
        ts.isSpreadElement(entry.elements[1])
      ) {
        unknown = true;
        continue;
      }
      const entryKey = resolvedLiteralMember(entry.elements[0]);
      if (entryKey === undefined) {
        unknown = true;
      } else if (lookupKey !== undefined && entryKey === lookupKey) {
        matched = entry.elements[1];
      }
    }
    return { value: matched, unknown };
  }

  function globalDescriptorProperty(rawExpression, useNode) {
    const access = memberAccess(rawExpression);
    const call = access === undefined ? undefined : unwrap(access.receiver);
    if (
      access?.member !== "value" ||
      call === undefined ||
      !ts.isCallExpression(call)
    ) {
      return undefined;
    }
    const target = memberAccess(call.expression);
    if (
      target?.member !== "getOwnPropertyDescriptor" ||
      intrinsicGlobalName(target.receiver, useNode) !== "Object" ||
      call.arguments.length < 2 ||
      ts.isSpreadElement(call.arguments[0]) ||
      ts.isSpreadElement(call.arguments[1]) ||
      intrinsicGlobalName(call.arguments[0], useNode) !== "globalThis"
    ) {
      return undefined;
    }
    const member = resolvedLiteralMember(call.arguments[1]);
    return {
      member,
      unknown: member === undefined,
    };
  }

  function intrinsicGlobalName(
    rawExpression,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 12) {
      return undefined;
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      if (
        [
          "Array",
          "Boolean",
          "Object",
          "Reflect",
          "Symbol",
          "JSON",
          "global",
          "globalThis",
        ].includes(expression.text) &&
        bindingAt(expression.text, useNode.getStart(source), useNode) ===
          undefined &&
        !enclosingParameterOrCatchShadowsName(expression.text, useNode)
      ) {
        return expression.text === "global" ? "globalThis" : expression.text;
      }
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(
          expression.text,
          declaration,
          useNode,
        );
        for (const { expression: value, context } of flow.values) {
          const name = intrinsicGlobalName(
            value,
            context,
            new Set([...trail, declaration]),
            depth + 1,
          );
          if (name !== undefined) {
            return name;
          }
        }
        if (
          !bindingIsConst(declaration) &&
          (flow.unknown ||
            flow.values.some(
              ({ expression: value, context }) =>
                !mutableAliasValueIsBounded(
                  value,
                  context,
                  new Set([...trail, declaration]),
                  depth + 1,
                ),
            ))
        ) {
          return UNKNOWN_INTRINSIC_REFERENCE;
        }
        return undefined;
      }
      const destructured = destructuredBindingCandidates(
        expression.text,
        useNode,
      );
      if (destructured === undefined || trail.has(destructured.declaration)) {
        return undefined;
      }
      for (const candidate of destructured.values) {
        const name = intrinsicGlobalName(
          candidate,
          destructured.declaration,
          new Set([...trail, destructured.declaration]),
          depth + 1,
        );
        if (name !== undefined) {
          return name;
        }
      }
      for (const binding of variableDeclarations) {
        if (
          !ts.isObjectBindingPattern(binding.name) ||
          binding.initializer === undefined ||
          !bindingVisibleAt(binding, useNode.getStart(source), useNode) ||
          trail.has(binding) ||
          intrinsicGlobalName(
            binding.initializer,
            binding,
            new Set([...trail, binding]),
            depth + 1,
          ) !== "globalThis"
        ) {
          continue;
        }
        for (const element of binding.name.elements) {
          if (
            !ts.isIdentifier(element.name) ||
            element.name.text !== expression.text
          ) {
            continue;
          }
          const property =
            element.propertyName === undefined
              ? element.name.text
              : ts.isIdentifier(element.propertyName) ||
                  ts.isStringLiteralLike(element.propertyName)
                ? element.propertyName.text
                : undefined;
          if (
            property !== undefined &&
            [
              "Array",
              "Boolean",
              "JSON",
              "Object",
              "Reflect",
              "Symbol",
            ].includes(property)
          ) {
            return property;
          }
        }
      }
      return undefined;
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = staticBoolean(expression.condition);
      const candidates =
        condition === undefined
          ? [expression.whenTrue, expression.whenFalse]
          : [condition ? expression.whenTrue : expression.whenFalse];
      for (const candidate of candidates) {
        const name = intrinsicGlobalName(candidate, useNode, trail, depth + 1);
        if (name !== undefined) {
          return name;
        }
      }
      return undefined;
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return intrinsicGlobalName(expression.right, useNode, trail, depth + 1);
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          intrinsicGlobalName(expression.left, useNode, trail, depth + 1) ??
          intrinsicGlobalName(expression.right, useNode, trail, depth + 1)
        );
      }
    }
    if (ts.isCallExpression(expression)) {
      const callAccess = memberAccess(expression.expression);
      if (
        callAccess?.member === "get" &&
        intrinsicGlobalName(callAccess.receiver, useNode, trail, depth + 1) ===
          "Reflect" &&
        expression.arguments.length >= 2 &&
        !ts.isSpreadElement(expression.arguments[0]) &&
        !ts.isSpreadElement(expression.arguments[1]) &&
        intrinsicGlobalName(
          expression.arguments[0],
          useNode,
          trail,
          depth + 1,
        ) === "globalThis"
      ) {
        const member = resolvedLiteralMember(expression.arguments[1]);
        if (
          ["Array", "Boolean", "JSON", "Object", "Reflect", "Symbol"].includes(
            member,
          )
        ) {
          return member;
        }
        if (member === undefined) {
          return UNKNOWN_INTRINSIC_REFERENCE;
        }
      }
      const mapLookup = staticMapLookup(expression);
      if (mapLookup?.value !== undefined) {
        const name = intrinsicGlobalName(
          mapLookup.value,
          useNode,
          trail,
          depth + 1,
        );
        if (name !== undefined) {
          return name;
        }
      } else if (mapLookup?.unknown) {
        return UNKNOWN_INTRINSIC_REFERENCE;
      }
      const returnCandidates = resolvedCallReturnCandidates(
        expression,
        useNode,
      );
      for (const { expression: returned, context } of returnCandidates) {
        const name = intrinsicGlobalName(returned, context, trail, depth + 1);
        if (name !== undefined) {
          return name;
        }
      }
      if (
        returnCandidates.some(
          ({ expression: returned, context }) =>
            !mutableAliasValueIsBounded(returned, context, trail, depth + 1),
        )
      ) {
        return UNKNOWN_INTRINSIC_REFERENCE;
      }
      for (const returned of callableReturnExpressions(
        expression.expression,
        useNode,
      )) {
        const name = intrinsicGlobalName(returned, useNode, trail, depth + 1);
        if (name !== undefined) {
          return name;
        }
      }
    }
    const access = memberAccess(expression);
    const descriptor = globalDescriptorProperty(expression, useNode);
    if (descriptor !== undefined) {
      if (
        ["Array", "Boolean", "JSON", "Object", "Reflect", "Symbol"].includes(
          descriptor.member,
        )
      ) {
        return descriptor.member;
      }
      if (descriptor.unknown) {
        return UNKNOWN_INTRINSIC_REFERENCE;
      }
    }
    if (
      access !== undefined &&
      intrinsicGlobalName(access.receiver, useNode, trail, depth + 1) ===
        "globalThis" &&
      ["Array", "Boolean", "JSON", "Object", "Reflect", "Symbol"].includes(
        access.member,
      )
    ) {
      return access.member;
    }
    if (
      access?.member === "constructor" &&
      definitelyArrayExpression(access.receiver, useNode, trail, depth + 1)
    ) {
      return "Array";
    }
    return undefined;
  }

  function intrinsicPrototypeName(
    rawExpression,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 12) {
      return undefined;
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined && !trail.has(declaration)) {
        const flow = bindingCurrentValueFlow(
          expression.text,
          declaration,
          useNode,
        );
        for (const { expression: value, context } of flow.values) {
          const prototype = intrinsicPrototypeName(
            value,
            context,
            new Set([...trail, declaration]),
            depth + 1,
          );
          if (prototype !== undefined) {
            return prototype;
          }
        }
        if (
          !bindingIsConst(declaration) &&
          (flow.unknown ||
            flow.values.some(
              ({ expression: value, context }) =>
                !mutableAliasValueIsBounded(
                  value,
                  context,
                  new Set([...trail, declaration]),
                  depth + 1,
                ),
            ))
        ) {
          return UNKNOWN_INTRINSIC_REFERENCE;
        }
        return undefined;
      }
      const destructured = destructuredBindingCandidates(
        expression.text,
        useNode,
      );
      if (destructured === undefined || trail.has(destructured.declaration)) {
        return undefined;
      }
      if (
        destructured.property === "prototype" &&
        intrinsicGlobalName(
          destructured.declaration.initializer,
          destructured.declaration,
          new Set([...trail, destructured.declaration]),
          depth + 1,
        ) === "Array"
      ) {
        return "Array";
      }
      for (const candidate of destructured.values) {
        const prototype = intrinsicPrototypeName(
          candidate,
          destructured.declaration,
          new Set([...trail, destructured.declaration]),
          depth + 1,
        );
        if (prototype !== undefined) {
          return prototype;
        }
      }
      return undefined;
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = staticBoolean(expression.condition);
      const candidates =
        condition === undefined
          ? [expression.whenTrue, expression.whenFalse]
          : [condition ? expression.whenTrue : expression.whenFalse];
      for (const candidate of candidates) {
        const prototype = intrinsicPrototypeName(
          candidate,
          useNode,
          trail,
          depth + 1,
        );
        if (prototype !== undefined) {
          return prototype;
        }
      }
      return undefined;
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return intrinsicPrototypeName(
          expression.right,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          intrinsicPrototypeName(expression.left, useNode, trail, depth + 1) ??
          intrinsicPrototypeName(expression.right, useNode, trail, depth + 1)
        );
      }
    }
    if (ts.isCallExpression(expression)) {
      const callAccess = memberAccess(expression.expression);
      const owner =
        callAccess === undefined
          ? undefined
          : intrinsicGlobalName(callAccess.receiver, useNode, trail, depth + 1);
      if (
        ["Object", "Reflect"].includes(owner) &&
        callAccess?.member === "getPrototypeOf" &&
        expression.arguments.length >= 1 &&
        !ts.isSpreadElement(expression.arguments[0]) &&
        definitelyArrayExpression(
          expression.arguments[0],
          useNode,
          trail,
          depth + 1,
        )
      ) {
        return "Array";
      }
      if (
        owner === "Reflect" &&
        callAccess?.member === "get" &&
        expression.arguments.length >= 2 &&
        !ts.isSpreadElement(expression.arguments[0]) &&
        !ts.isSpreadElement(expression.arguments[1]) &&
        intrinsicGlobalName(
          expression.arguments[0],
          useNode,
          trail,
          depth + 1,
        ) === "Array" &&
        resolvedLiteralMember(expression.arguments[1]) === "prototype"
      ) {
        return "Array";
      }
      const mapLookup = staticMapLookup(expression);
      if (mapLookup?.value !== undefined) {
        const prototype = intrinsicPrototypeName(
          mapLookup.value,
          useNode,
          trail,
          depth + 1,
        );
        if (prototype !== undefined) {
          return prototype;
        }
      } else if (
        mapLookup?.unknown &&
        expressionContainsIntrinsicPrototype(
          unwrap(memberAccess(expression.expression).receiver),
          useNode,
          trail,
          depth + 1,
        )
      ) {
        return UNKNOWN_INTRINSIC_REFERENCE;
      }
      for (const returned of callableReturnExpressions(
        expression.expression,
        useNode,
      )) {
        const prototype = intrinsicPrototypeName(
          returned,
          useNode,
          trail,
          depth + 1,
        );
        if (prototype !== undefined) {
          return prototype;
        }
      }
    }
    const access = memberAccess(expression);
    if (access === undefined) {
      return undefined;
    }
    if (
      access.member === "__proto__" &&
      definitelyArrayExpression(access.receiver, useNode, trail, depth + 1)
    ) {
      return "Array";
    }
    if (access.member !== "prototype") {
      for (const candidate of staticObjectMemberCandidates(
        access.receiver,
        access.member,
        useNode,
        trail,
        depth + 1,
      )) {
        const prototype = intrinsicPrototypeName(
          candidate,
          useNode,
          trail,
          depth + 1,
        );
        if (prototype !== undefined) {
          return prototype;
        }
      }
      return undefined;
    }
    const constructor = intrinsicGlobalName(
      access.receiver,
      useNode,
      trail,
      depth + 1,
    );
    return ["Array", "Object", UNKNOWN_INTRINSIC_REFERENCE].includes(
      constructor,
    )
      ? constructor
      : undefined;
  }

  function expressionContainsIntrinsicPrototype(
    rawExpression,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 16) {
      return true;
    }
    const expression = unwrap(rawExpression);
    if (
      intrinsicPrototypeName(expression, useNode, trail, depth + 1) ||
      intrinsicGlobalName(expression, useNode, trail, depth + 1) === "Array"
    ) {
      return true;
    }
    if (ts.isIdentifier(expression)) {
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (
        declaration?.initializer !== undefined &&
        bindingIsConst(declaration) &&
        !trail.has(declaration)
      ) {
        return expressionContainsIntrinsicPrototype(
          declaration.initializer,
          declaration,
          new Set([...trail, declaration]),
          depth + 1,
        );
      }
      const destructured = destructuredBindingCandidates(
        expression.text,
        useNode,
      );
      return (
        destructured !== undefined &&
        !trail.has(destructured.declaration) &&
        destructured.values.some((candidate) =>
          expressionContainsIntrinsicPrototype(
            candidate,
            destructured.declaration,
            new Set([...trail, destructured.declaration]),
            depth + 1,
          ),
        )
      );
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = staticBoolean(expression.condition);
      return condition === undefined
        ? expressionContainsIntrinsicPrototype(
            expression.whenTrue,
            useNode,
            trail,
            depth + 1,
          ) ||
            expressionContainsIntrinsicPrototype(
              expression.whenFalse,
              useNode,
              trail,
              depth + 1,
            )
        : expressionContainsIntrinsicPrototype(
            condition ? expression.whenTrue : expression.whenFalse,
            useNode,
            trail,
            depth + 1,
          );
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return expressionContainsIntrinsicPrototype(
          expression.right,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          expressionContainsIntrinsicPrototype(
            expression.left,
            useNode,
            trail,
            depth + 1,
          ) ||
          expressionContainsIntrinsicPrototype(
            expression.right,
            useNode,
            trail,
            depth + 1,
          )
        );
      }
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.some(
        (element) =>
          !ts.isOmittedExpression(element) &&
          expressionContainsIntrinsicPrototype(
            ts.isSpreadElement(element) ? element.expression : element,
            useNode,
            trail,
            depth + 1,
          ),
      );
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return expression.properties.some((property) => {
        if (ts.isSpreadAssignment(property)) {
          return expressionContainsIntrinsicPrototype(
            property.expression,
            useNode,
            trail,
            depth + 1,
          );
        }
        if (ts.isPropertyAssignment(property)) {
          return expressionContainsIntrinsicPrototype(
            property.initializer,
            useNode,
            trail,
            depth + 1,
          );
        }
        return (
          ts.isShorthandPropertyAssignment(property) &&
          expressionContainsIntrinsicPrototype(
            property.name,
            useNode,
            trail,
            depth + 1,
          )
        );
      });
    }
    const access = memberAccess(expression);
    return (
      access !== undefined &&
      staticObjectMemberCandidates(
        access.receiver,
        access.member,
        useNode,
        trail,
        depth + 1,
      ).some((candidate) =>
        expressionContainsIntrinsicPrototype(
          candidate,
          useNode,
          trail,
          depth + 1,
        ),
      )
    );
  }

  function isIntrinsicConcatSpreadableSymbol(expression, useNode) {
    const access = memberAccess(expression);
    return (
      access?.member === "isConcatSpreadable" &&
      intrinsicGlobalName(access.receiver, useNode) === "Symbol"
    );
  }

  function relevantPrototypeMutationTarget(expression, useNode) {
    const target = unwrap(expression);
    if (ts.isIdentifier(target)) {
      return intrinsicGlobalName(target, useNode) === "Array";
    }
    const directPrototype = intrinsicPrototypeName(target, useNode);
    if (directPrototype !== undefined) {
      return true;
    }
    if (
      !ts.isPropertyAccessExpression(target) &&
      !ts.isElementAccessExpression(target)
    ) {
      return false;
    }
    if (intrinsicGlobalName(target.expression, useNode) === "Array") {
      return true;
    }
    const prototype = intrinsicPrototypeName(target.expression, useNode);
    if (prototype === undefined) {
      return false;
    }
    let property;
    if (ts.isPropertyAccessExpression(target)) {
      property = target.name.text;
    } else if (
      isIntrinsicConcatSpreadableSymbol(target.argumentExpression, useNode)
    ) {
      property = "Symbol.isConcatSpreadable";
    } else {
      property = resolvedLiteralMember(target.argumentExpression);
    }
    return (
      property === undefined ||
      property === "Symbol.isConcatSpreadable" ||
      prototype === "Array" ||
      prototype === UNKNOWN_INTRINSIC_REFERENCE
    );
  }

  function callableMutatesArrayIntrinsic(
    rawTarget,
    useNode,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 8) {
      return true;
    }
    for (const callable of localCallableNodes(
      rawTarget,
      useNode,
      trail,
      depth + 1,
    )) {
      if (generatorFunctionLike(callable) || trail.has(callable)) {
        continue;
      }
      const body = callable.body ?? callable;
      const nextTrail = new Set([...trail, callable]);
      let mutates = false;
      function inspect(current) {
        if (mutates || definitelyUnreachable(current)) {
          return;
        }
        if (current !== body && functionLike(current)) {
          return;
        }
        if (
          ts.isBinaryExpression(current) &&
          current.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          current.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
          relevantPrototypeMutationTarget(current.left, current)
        ) {
          mutates = true;
          return;
        }
        if (
          (ts.isDeleteExpression(current) &&
            relevantPrototypeMutationTarget(current.expression, current)) ||
          ((ts.isPrefixUnaryExpression(current) ||
            ts.isPostfixUnaryExpression(current)) &&
            relevantPrototypeMutationTarget(current.operand, current))
        ) {
          mutates = true;
          return;
        }
        if (ts.isCallExpression(current)) {
          if (
            current.arguments.some((argument) =>
              expressionContainsIntrinsicPrototype(
                ts.isSpreadElement(argument) ? argument.expression : argument,
                current,
              ),
            ) ||
            callableMutatesArrayIntrinsic(
              current.expression,
              current,
              nextTrail,
              depth + 1,
            )
          ) {
            mutates = true;
            return;
          }
        }
        ts.forEachChild(current, inspect);
      }
      inspect(body);
      if (mutates) {
        return true;
      }
    }
    return false;
  }

  const concatIntrinsicTrust = new Map();
  function concatIntrinsicsTrusted(useNode) {
    const usePosition = useNode.getStart(source);
    const cached = concatIntrinsicTrust.get(usePosition);
    if (cached !== undefined) {
      return cached;
    }
    let trusted = true;
    function inspect(node) {
      if (!trusted || node.getStart(source) >= usePosition) {
        return;
      }
      if (definitelyUnreachable(node)) {
        return;
      }
      if (functionLike(node)) {
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        relevantPrototypeMutationTarget(node.left, node)
      ) {
        trusted = false;
        return;
      }
      if (
        (ts.isDeleteExpression(node) &&
          relevantPrototypeMutationTarget(node.expression, node)) ||
        ((ts.isPrefixUnaryExpression(node) ||
          ts.isPostfixUnaryExpression(node)) &&
          relevantPrototypeMutationTarget(node.operand, node))
      ) {
        trusted = false;
        return;
      }
      if (
        ts.isCallExpression(node) &&
        (node.arguments.some((argument) =>
          expressionContainsIntrinsicPrototype(
            ts.isSpreadElement(argument) ? argument.expression : argument,
            node,
          ),
        ) ||
          callableMutatesArrayIntrinsic(node.expression, node))
      ) {
        trusted = false;
        return;
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    concatIntrinsicTrust.set(usePosition, trusted);
    return trusted;
  }

  function staticIndex(rawExpression, names, shape) {
    const direct = numericLiteral(rawExpression);
    if (direct !== undefined) {
      return direct;
    }
    const access = memberAccess(rawExpression);
    return access !== undefined &&
      access.member === "length" &&
      isDirectAlias(access.receiver, names)
      ? shape.length
      : undefined;
  }

  function appendShape(target, addition, fillHoles = false) {
    const nextLength = target.length + addition.length;
    if (nextLength > MAX_STATIC_TABLE_LENGTH) {
      return false;
    }
    if (fillHoles) {
      for (let index = 0; index < addition.length; index += 1) {
        target.occupied.add(target.length + index);
      }
    } else {
      for (const index of addition.occupied) {
        target.occupied.add(target.length + index);
      }
    }
    target.length = nextLength;
    return true;
  }

  function intrinsicCollectionShape(expression, useNode, trail, kind) {
    if (
      !ts.isNewExpression(expression) ||
      !ts.isIdentifier(unwrap(expression.expression)) ||
      unwrap(expression.expression).text !== kind ||
      declaredValueNames.has(kind)
    ) {
      return "UNSTABLE";
    }
    const args = expression.arguments ?? [];
    if (args.length === 0) {
      return emptyShape();
    }
    if (args.length !== 1 || ts.isSpreadElement(args[0])) {
      return "UNSTABLE";
    }
    if (kind === "Map") {
      const entries = unwrap(args[0]);
      if (!ts.isArrayLiteralExpression(entries)) {
        return "UNSTABLE";
      }
      if (entries.elements.length === 0) {
        return emptyShape();
      }
      for (const element of entries.elements) {
        if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) {
          return "UNSTABLE";
        }
        const entry = unwrap(element);
        if (
          !ts.isArrayLiteralExpression(entry) ||
          entry.elements.length < 2 ||
          entry.elements
            .slice(0, 2)
            .some(
              (item) =>
                ts.isOmittedExpression(item) || ts.isSpreadElement(item),
            )
        ) {
          return "UNSTABLE";
        }
      }
      return fullShape(1);
    }
    const input = exactShape(args[0], useNode, trail);
    if (!shapeIsBounded(input)) {
      return input;
    }
    if (input.length === 0) {
      return emptyShape();
    }
    return fullShape(1);
  }

  function exactArrayFrom(expression, useNode, trail) {
    if (expression.arguments.length === 0) {
      return "UNSTABLE";
    }
    const input = expression.arguments[0];
    if (ts.isSpreadElement(input)) {
      return "UNSTABLE";
    }
    const value = unwrap(input);
    const length = objectLength(value);
    if (length !== undefined) {
      return fullShape(length);
    }
    if (ts.isNewExpression(value)) {
      const target = unwrap(value.expression);
      if (ts.isIdentifier(target) && ["Set", "Map"].includes(target.text)) {
        return intrinsicCollectionShape(value, useNode, trail, target.text);
      }
    }
    const inputShape = exactShape(value, useNode, trail);
    return shapeIsBounded(inputShape)
      ? fullShape(inputShape.length)
      : inputShape;
  }

  function exactShape(rawExpression, useNode, trail = new Set(), depth = 0) {
    if (depth > 16) {
      return "UNSTABLE";
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      return snapshotForIdentifier(expression, useNode, trail, depth + 1);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      const shape = emptyShape();
      for (const element of expression.elements) {
        if (ts.isOmittedExpression(element)) {
          shape.length += 1;
        } else if (ts.isSpreadElement(element)) {
          const spread = exactShape(
            element.expression,
            useNode,
            trail,
            depth + 1,
          );
          if (!shapeIsBounded(spread) || !appendShape(shape, spread, true)) {
            return "UNSTABLE";
          }
        } else {
          shape.occupied.add(shape.length);
          shape.length += 1;
        }
        if (!shapeIsBounded(shape)) {
          return "UNSTABLE";
        }
      }
      return shape;
    }
    if (
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return fullShape([...expression.text].length);
    }
    if (ts.isCallExpression(expression)) {
      const target = unwrap(expression.expression);
      if (
        ts.isIdentifier(target) &&
        target.text === "Array" &&
        !declaredValueNames.has("Array")
      ) {
        if (expression.arguments.length === 0) {
          return emptyShape();
        }
        if (expression.arguments.length === 1) {
          const length = numericLiteral(expression.arguments[0]);
          return length === undefined ? "UNSTABLE" : sparseShape(length);
        }
        return fullShape(expression.arguments.length);
      }
      const access = memberAccess(target);
      if (
        access !== undefined &&
        ts.isIdentifier(access.receiver) &&
        access.receiver.text === "Array"
      ) {
        if (declaredValueNames.has("Array")) {
          return "UNSTABLE";
        }
        if (access.member === "from") {
          return exactArrayFrom(expression, useNode, trail);
        }
        if (access.member === "of") {
          const shape = emptyShape();
          for (const argument of expression.arguments) {
            if (ts.isSpreadElement(argument)) {
              const spread = exactShape(
                argument.expression,
                useNode,
                trail,
                depth + 1,
              );
              if (
                !shapeIsBounded(spread) ||
                !appendShape(shape, spread, true)
              ) {
                return "UNSTABLE";
              }
            } else {
              shape.occupied.add(shape.length);
              shape.length += 1;
            }
            if (!shapeIsBounded(shape)) {
              return "UNSTABLE";
            }
          }
          return shape;
        }
      }
      if (access?.member === "concat") {
        if (!concatIntrinsicsTrusted(useNode)) {
          return "UNSTABLE";
        }
        if (
          !definitelyArrayExpression(
            access.receiver,
            useNode,
            new Set(),
            depth + 1,
          )
        ) {
          return "UNSTABLE";
        }
        const shape = exactShape(access.receiver, useNode, trail, depth + 1);
        if (!shapeIsBounded(shape)) {
          return shape;
        }
        for (const argument of expression.arguments) {
          if (
            !appendConcatArgument(shape, argument, useNode, trail, depth + 1)
          ) {
            return "UNSTABLE";
          }
        }
        return shape;
      }
      return "UNSTABLE";
    }
    if (ts.isNewExpression(expression)) {
      const target = unwrap(expression.expression);
      if (
        ts.isIdentifier(target) &&
        target.text === "Array" &&
        !declaredValueNames.has("Array")
      ) {
        const args = expression.arguments ?? [];
        if (args.length === 0) {
          return emptyShape();
        }
        if (args.length === 1) {
          const length = numericLiteral(args[0]);
          return length === undefined ? "UNSTABLE" : sparseShape(length);
        }
        return fullShape(args.length);
      }
    }
    return "UNSTABLE";
  }

  function mutationEvents(name, declaration, useNode) {
    const usePosition = useNode.getStart(source);
    const names = connectedAliases(name, usePosition, useNode);
    const useContainers = containerChain(useNode);
    const events = [];
    const directMutationStart = declaration.getStart(source);
    function add(node, kind, data = {}) {
      if (
        node.getStart(source) > directMutationStart &&
        node.getStart(source) < usePosition &&
        !definitelyUnreachable(node)
      ) {
        events.push({
          position: node.getStart(source),
          kind,
          uncertain: uncertainControlFlow(node, useContainers),
          ...data,
        });
      }
    }

    function inspect(node) {
      const position = node.getStart(source);
      if (position >= usePosition) {
        return;
      }
      if (functionLike(node) && !useContainers.has(node)) {
        return;
      }
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        const initializer = unwrap(node.initializer);
        if (
          !functionLike(initializer) &&
          !ts.isClassExpression(initializer) &&
          expressionContainsNameOutsideDeferredBodies(initializer, names) &&
          !isDirectAlias(initializer, names) &&
          !isSafeIdentityCopy(initializer, names)
        ) {
          add(node, "UNSTABLE");
        }
        if (
          ts.isArrayBindingPattern(node.name) &&
          localProtocolCapturesName(
            initializer,
            ["Symbol.iterator"],
            names,
            node,
          )
        ) {
          add(node, "UNSTABLE");
        }
        if (
          ts.isObjectBindingPattern(node.name) &&
          objectPatternGetterCapturesName(node.name, initializer, names, node)
        ) {
          add(node, "UNSTABLE");
        }
      }
      if (
        ((ts.isForOfStatement(node) || ts.isForInStatement(node)) &&
          expressionContainsName(node.expression, names)) ||
        (ts.isReturnStatement(node) &&
          node.expression !== undefined &&
          expressionContainsName(node.expression, names)) ||
        (ts.isYieldExpression(node) &&
          node.expression !== undefined &&
          expressionContainsName(node.expression, names))
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isThrowStatement(node) &&
        expressionContainsName(node.expression, names)
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        const left = unwrap(node.left);
        let writesRoot = false;
        if (isDirectAlias(left, names)) {
          writesRoot = true;
          add(node, "UNSTABLE");
        } else {
          const access = memberAccess(left);
          if (access !== undefined && isDirectAlias(access.receiver, names)) {
            writesRoot = true;
            if (
              access.member === "length" &&
              node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            ) {
              add(node, "LENGTH", { value: node.right });
            } else if (
              access.member !== undefined &&
              /^\d+$/u.test(access.member) &&
              node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            ) {
              add(node, "INDEX", {
                index: Number(access.member),
              });
            } else {
              add(node, "UNSTABLE");
            }
          }
        }
        if (!writesRoot && expressionContainsName(node.right, names)) {
          add(node, "UNSTABLE");
        }
        if (
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isArrayLiteralExpression(unwrap(node.left)) &&
          localProtocolCapturesName(
            node.right,
            ["Symbol.iterator"],
            names,
            node,
          )
        ) {
          add(node, "UNSTABLE");
        }
        if (
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isObjectLiteralExpression(unwrap(node.left)) &&
          objectPatternGetterCapturesName(node.left, node.right, names, node)
        ) {
          add(node, "UNSTABLE");
        }
      }
      if (
        ts.isTaggedTemplateExpression(node) &&
        callTargetCapturesName(node.tag, names, node)
      ) {
        add(node, "UNSTABLE");
      }
      if (
        (ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)) &&
        memberAccess(node)?.member !== undefined
      ) {
        const parent = node.parent;
        const assignment =
          ts.isBinaryExpression(parent) && unwrap(parent.left) === node
            ? parent.operatorToken.kind
            : undefined;
        const deletes =
          ts.isDeleteExpression(parent) && unwrap(parent.expression) === node;
        const reads =
          !deletes &&
          (assignment === undefined ||
            assignment !== ts.SyntaxKind.EqualsToken);
        const writes =
          assignment !== undefined &&
          assignment >= ts.SyntaxKind.FirstAssignment &&
          assignment <= ts.SyntaxKind.LastAssignment;
        if (
          (reads && localAccessorCapturesName(node, names, node, "get")) ||
          (writes && localAccessorCapturesName(node, names, node, "set"))
        ) {
          add(node, "UNSTABLE");
        }
      }
      if (
        ts.isSpreadElement(node) &&
        localProtocolCapturesName(
          node.expression,
          ["Symbol.iterator"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isSpreadAssignment(node) &&
        localAnyAccessorCapturesName(node.expression, names, node, "get")
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isForOfStatement(node) &&
        localProtocolCapturesName(
          node.expression,
          ["Symbol.asyncIterator", "Symbol.iterator"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isYieldExpression(node) &&
        node.asteriskToken !== undefined &&
        node.expression !== undefined &&
        localProtocolCapturesName(
          node.expression,
          ["Symbol.iterator"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isPrefixUnaryExpression(node) &&
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.MinusToken,
          ts.SyntaxKind.TildeToken,
          ts.SyntaxKind.PlusPlusToken,
          ts.SyntaxKind.MinusMinusToken,
        ].includes(node.operator) &&
        localProtocolCapturesName(
          node.operand,
          ["Symbol.toPrimitive", "valueOf", "toString"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isPostfixUnaryExpression(node) &&
        localProtocolCapturesName(
          node.operand,
          ["Symbol.toPrimitive", "valueOf", "toString"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (ts.isBinaryExpression(node)) {
        const nonCoercingOperators = new Set([
          ts.SyntaxKind.EqualsToken,
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.CommaToken,
        ]);
        if (
          !nonCoercingOperators.has(node.operatorToken.kind) &&
          [node.left, node.right].some((operand) =>
            localProtocolCapturesName(
              operand,
              ["Symbol.toPrimitive", "valueOf", "toString"],
              names,
              node,
            ),
          )
        ) {
          add(node, "UNSTABLE");
        }
      }
      if (
        ts.isTemplateSpan(node) &&
        localProtocolCapturesName(
          node.expression,
          ["Symbol.toPrimitive", "valueOf", "toString"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isElementAccessExpression(node) &&
        node.argumentExpression !== undefined &&
        localProtocolCapturesName(
          node.argumentExpression,
          ["Symbol.toPrimitive", "valueOf", "toString"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        ts.isComputedPropertyName(node) &&
        localProtocolCapturesName(
          node.expression,
          ["Symbol.toPrimitive", "valueOf", "toString"],
          names,
          node,
        )
      ) {
        add(node, "UNSTABLE");
      }
      if (
        (ts.isPrefixUnaryExpression(node) ||
          ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(
          node.operator,
        )
      ) {
        const access = memberAccess(node.operand);
        if (access !== undefined && isDirectAlias(access.receiver, names)) {
          add(node, access.member === "length" ? "LENGTH_UPDATE" : "UNSTABLE", {
            delta: node.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1,
          });
        }
      }
      if (
        ts.isDeleteExpression(node) &&
        memberAccess(node.expression) !== undefined
      ) {
        const access = memberAccess(node.expression);
        if (isDirectAlias(access.receiver, names)) {
          add(
            node,
            access.member !== undefined && /^\d+$/u.test(access.member)
              ? "DELETE"
              : "UNSTABLE",
            { index: Number(access.member) },
          );
        }
      }
      if (ts.isCallExpression(node)) {
        const access = memberAccess(node.expression);
        const target = unwrap(node.expression);
        if (
          (callTargetCapturesName(target, names, node) ||
            callUsesCapturedDefault(node, names, node)) &&
          !callOnlyReturnsDirectAlias(node, names, node)
        ) {
          add(node, "UNSTABLE");
        }
        if (intrinsicCallInvokesLocalMember(node, names, node)) {
          add(node, "UNSTABLE");
        }
        if (descriptorAccessorInvocationCapturesName(target, names, node)) {
          add(node, "UNSTABLE");
        }
        if (
          node.arguments.some(
            (argument, index) =>
              !ts.isSpreadElement(argument) &&
              localProtocolCapturesName(
                argument,
                [
                  "Symbol.asyncIterator",
                  "Symbol.iterator",
                  "Symbol.toPrimitive",
                  "valueOf",
                  "toString",
                ],
                names,
                node,
              ) &&
              callMayInvokeProtocolOnArgument(target, index, node),
          )
        ) {
          add(node, "UNSTABLE");
        }
        const intrinsicOwner =
          access === undefined
            ? undefined
            : intrinsicGlobalName(access.receiver, node);
        if (
          intrinsicOwner === "Reflect" &&
          ["get", "set"].includes(access.member) &&
          node.arguments.length >= 2 &&
          !ts.isSpreadElement(node.arguments[0]) &&
          !ts.isSpreadElement(node.arguments[1])
        ) {
          const member = resolvedLiteralMember(node.arguments[1]);
          const accessorKind = access.member;
          if (
            (member === undefined &&
              localAnyAccessorCapturesName(
                node.arguments[0],
                names,
                node,
                accessorKind,
              )) ||
            (member !== undefined &&
              localNamedAccessorCapturesName(
                node.arguments[0],
                member,
                names,
                node,
                accessorKind,
              ))
          ) {
            add(node, "UNSTABLE");
          }
        }
        if (
          intrinsicOwner === "Object" &&
          access.member === "assign" &&
          node.arguments.length > 1 &&
          !ts.isSpreadElement(node.arguments[0])
        ) {
          const members = new Set();
          let unknownMembers = false;
          for (const sourceArgument of node.arguments.slice(1)) {
            if (ts.isSpreadElement(sourceArgument)) {
              unknownMembers = true;
              continue;
            }
            if (
              localAnyAccessorCapturesName(sourceArgument, names, node, "get")
            ) {
              add(node, "UNSTABLE");
            }
            const object = unwrap(sourceArgument);
            if (!ts.isObjectLiteralExpression(object)) {
              unknownMembers = true;
              continue;
            }
            for (const property of object.properties) {
              if (ts.isSpreadAssignment(property)) {
                unknownMembers = true;
                continue;
              }
              const member = staticPropertyName(property.name);
              if (member === undefined) {
                unknownMembers = true;
              } else {
                members.add(member);
              }
            }
          }
          if (
            (unknownMembers &&
              localAnyAccessorCapturesName(
                node.arguments[0],
                names,
                node,
                "set",
              )) ||
            [...members].some((member) =>
              localNamedAccessorCapturesName(
                node.arguments[0],
                member,
                names,
                node,
                "set",
              ),
            )
          ) {
            add(node, "UNSTABLE");
          }
        }
        const className =
          access === undefined
            ? undefined
            : constructedClassName(access.receiver, node);
        if (
          className !== undefined &&
          (classesByName.get(className) ?? []).some((classDeclaration) =>
            expressionContainsName(classDeclaration, names),
          )
        ) {
          add(node, "UNSTABLE");
        }
        if (
          access !== undefined &&
          ts.isIdentifier(access.receiver) &&
          access.receiver.text === "Object" &&
          access.member === "assign" &&
          !declaredValueNames.has("Object") &&
          node.arguments[0] !== undefined &&
          isDirectAlias(node.arguments[0], names)
        ) {
          add(node, "OBJECT_ASSIGN", {
            sources: node.arguments.slice(1),
          });
        } else if (
          access !== undefined &&
          (isDirectAlias(access.receiver, names) ||
            expressionResolvesConnectedAlias(access.receiver, names, node))
        ) {
          if (!isDirectAlias(access.receiver, names)) {
            add(node, "UNSTABLE");
          } else if (access.member === undefined) {
            add(node, "UNSTABLE");
          } else if (MUTATING_ARRAY_METHODS.has(access.member)) {
            if (!concatIntrinsicsTrusted(node)) {
              add(node, "UNSTABLE");
            } else {
              add(node, access.member.toUpperCase(), {
                args: [...node.arguments],
              });
            }
          } else if (!READ_ONLY_ARRAY_METHODS.has(access.member)) {
            add(node, "UNSTABLE");
          } else if (
            node.arguments.some((argument) =>
              callbackCapturesName(argument, names, node),
            )
          ) {
            add(node, "UNSTABLE");
          }
        } else if (
          access !== undefined &&
          expressionContainsName(access.receiver, names) &&
          (access.member === undefined ||
            MUTATING_ARRAY_METHODS.has(access.member))
        ) {
          add(node, "UNSTABLE");
        } else {
          const isSafeArrayFrom =
            access !== undefined &&
            ts.isIdentifier(access.receiver) &&
            access.receiver.text === "Array" &&
            access.member === "from" &&
            !declaredValueNames.has("Array") &&
            node.arguments[0] !== undefined &&
            isDirectAlias(node.arguments[0], names) &&
            node.arguments
              .slice(1)
              .every(
                (argument) => !callbackCapturesName(argument, names, node),
              );
          const isParameterizedRegistration =
            parameterizedRoot(node.expression) !== undefined;
          const isVitestRegistration =
            resolveExpression(node.expression) !== undefined;
          if (
            !isSafeArrayFrom &&
            !isParameterizedRegistration &&
            node.arguments.some(
              (argument) =>
                (expressionContainsName(argument, names) ||
                  (localCallableReference(argument, node) &&
                    callbackCapturesName(argument, names, node))) &&
                !(isVitestRegistration && functionLike(unwrap(argument))),
            )
          ) {
            add(node, "UNSTABLE");
          }
          if (unshadowedEvalTarget(target)) {
            add(node, "UNSTABLE");
          }
          if (ts.isIdentifier(target)) {
            for (const functionDeclaration of functionsByName.get(
              target.text,
            ) ?? []) {
              if (
                !generatorFunctionLike(functionDeclaration) &&
                functionDeclaration.body !== undefined &&
                expressionContainsName(functionDeclaration.body, names)
              ) {
                add(node, "UNSTABLE");
              }
            }
          }
        }
      }
      if (
        ts.isNewExpression(node) &&
        (classConstructionCapturesName(node.expression, names, node) ||
          (node.arguments ?? []).some(
            (argument) =>
              expressionContainsName(argument, names) ||
              (localCallableReference(argument, node) &&
                callbackCapturesName(argument, names, node)),
          ))
      ) {
        add(node, "UNSTABLE");
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    return events.sort((left, right) => left.position - right.position);
  }

  function applyMutation(shape, event, names) {
    if (event.uncertain || event.kind === "UNSTABLE") {
      return false;
    }
    if (event.kind === "LENGTH") {
      const length = staticIndex(event.value, names, shape);
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > MAX_STATIC_TABLE_LENGTH
      ) {
        return false;
      }
      shape.length = length;
      for (const index of [...shape.occupied]) {
        if (index >= length) {
          shape.occupied.delete(index);
        }
      }
    } else if (event.kind === "LENGTH_UPDATE") {
      const length = shape.length + event.delta;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > MAX_STATIC_TABLE_LENGTH
      ) {
        return false;
      }
      shape.length = length;
      for (const index of [...shape.occupied]) {
        if (index >= length) {
          shape.occupied.delete(index);
        }
      }
    } else if (event.kind === "INDEX") {
      if (
        !Number.isSafeInteger(event.index) ||
        event.index < 0 ||
        event.index >= MAX_STATIC_TABLE_LENGTH
      ) {
        return false;
      }
      shape.length = Math.max(shape.length, event.index + 1);
      shape.occupied.add(event.index);
    } else if (event.kind === "DELETE") {
      shape.occupied.delete(event.index);
    } else if (event.kind === "POP") {
      if (shape.length > 0) {
        shape.length -= 1;
        shape.occupied.delete(shape.length);
      }
    } else if (event.kind === "SHIFT") {
      if (shape.length > 0) {
        shape.length -= 1;
        shape.occupied = new Set(
          [...shape.occupied]
            .filter((index) => index > 0)
            .map((index) => index - 1),
        );
      }
    } else if (event.kind === "PUSH" || event.kind === "UNSHIFT") {
      const additions = [];
      for (const argument of event.args) {
        if (ts.isSpreadElement(argument)) {
          return false;
        }
        additions.push(argument);
      }
      if (shape.length + additions.length > MAX_STATIC_TABLE_LENGTH) {
        return false;
      }
      if (event.kind === "UNSHIFT") {
        shape.occupied = new Set(
          [...shape.occupied].map((index) => index + additions.length),
        );
        for (let index = 0; index < additions.length; index += 1) {
          shape.occupied.add(index);
        }
      } else {
        for (let index = 0; index < additions.length; index += 1) {
          shape.occupied.add(shape.length + index);
        }
      }
      shape.length += additions.length;
    } else if (event.kind === "SPLICE") {
      if (event.args.length === 0 || ts.isSpreadElement(event.args[0])) {
        return false;
      }
      const rawStart = staticIndex(event.args[0], names, shape);
      if (!Number.isSafeInteger(rawStart)) {
        return false;
      }
      const start =
        rawStart < 0
          ? Math.max(shape.length + rawStart, 0)
          : Math.min(rawStart, shape.length);
      let deleteCount = shape.length - start;
      if (event.args[1] !== undefined) {
        if (ts.isSpreadElement(event.args[1])) {
          return false;
        }
        const rawDelete = staticIndex(event.args[1], names, shape);
        if (!Number.isSafeInteger(rawDelete)) {
          return false;
        }
        deleteCount = Math.min(Math.max(rawDelete, 0), shape.length - start);
      }
      const insertCount = Math.max(event.args.length - 2, 0);
      if (
        event.args.slice(2).some(ts.isSpreadElement) ||
        shape.length - deleteCount + insertCount > MAX_STATIC_TABLE_LENGTH
      ) {
        return false;
      }
      const occupied = new Set();
      for (const index of shape.occupied) {
        if (index < start) {
          occupied.add(index);
        } else if (index >= start + deleteCount) {
          occupied.add(index - deleteCount + insertCount);
        }
      }
      for (let index = 0; index < insertCount; index += 1) {
        occupied.add(start + index);
      }
      shape.length = shape.length - deleteCount + insertCount;
      shape.occupied = occupied;
    } else if (event.kind === "OBJECT_ASSIGN") {
      for (const sourceExpression of event.sources) {
        const length = objectLength(sourceExpression);
        if (length === undefined) {
          return false;
        }
        if (
          !Number.isSafeInteger(length) ||
          length < 0 ||
          length > MAX_STATIC_TABLE_LENGTH
        ) {
          return false;
        }
        shape.length = length;
        for (const index of [...shape.occupied]) {
          if (index >= length) {
            shape.occupied.delete(index);
          }
        }
      }
    } else {
      return false;
    }
    return shapeIsBounded(shape);
  }

  function snapshotForIdentifier(identifier, useNode, trail, depth) {
    const declaration = bindingAt(
      identifier.text,
      useNode.getStart(source),
      useNode,
    );
    if (
      declaration === undefined ||
      declaration.initializer === undefined ||
      trail.has(declaration)
    ) {
      return "UNSTABLE";
    }
    const useContainer = executionContainer(useNode);
    if (
      executionContainer(declaration) !== useContainer &&
      useContainer !== source &&
      !synchronousSuiteCallback(useContainer)
    ) {
      return "UNSTABLE";
    }
    const nextTrail = new Set(trail);
    nextTrail.add(declaration);
    const shape = exactShape(
      declaration.initializer,
      declaration,
      nextTrail,
      depth + 1,
    );
    if (!shapeIsBounded(shape)) {
      return shape;
    }
    const names = connectedAliases(
      identifier.text,
      useNode.getStart(source),
      useNode,
    );
    const events = mutationEvents(identifier.text, declaration, useNode);
    if (!bindingIsConst(declaration) && events.length > 0) {
      return "UNSTABLE";
    }
    for (const event of events) {
      if (!applyMutation(shape, event, names)) {
        return "UNSTABLE";
      }
    }
    return shape;
  }

  function pointInTimeTableState(expression, useNode) {
    const guarded = unwrap(expression);
    if (
      ts.isCallExpression(guarded) &&
      ts.isIdentifier(unwrap(guarded.expression)) &&
      nonemptyGuardAliases.has(unwrap(guarded.expression).text) &&
      guarded.arguments.length === 1 &&
      !ts.isSpreadElement(guarded.arguments[0])
    ) {
      return "NON_EMPTY";
    }
    const shape = exactShape(expression, useNode);
    if (!shapeIsBounded(shape)) {
      return "UNSTABLE";
    }
    return shape.occupied.size === 0 ? "EMPTY" : "NON_EMPTY";
  }

  function enclosingParameterBinding(name, useNode) {
    let current = useNode.parent;
    while (current !== undefined && current !== source) {
      if (functionLike(current)) {
        for (const parameter of current.parameters) {
          if (ts.isIdentifier(parameter.name) && parameter.name.text === name) {
            return parameter;
          }
        }
      }
      current = current.parent;
    }
    return undefined;
  }

  function resolveCurrentVitestExpression(
    rawExpression,
    useNode = rawExpression,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 12) {
      return undefined;
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      const parameter = enclosingParameterBinding(expression.text, useNode);
      if (parameter !== undefined) {
        return parameter.initializer === undefined
          ? undefined
          : resolveCurrentVitestExpression(
              parameter.initializer,
              parameter,
              new Set([...trail, parameter]),
              depth + 1,
            );
      }
      if (enclosingParameterOrCatchShadowsName(expression.text, useNode)) {
        return undefined;
      }
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined) {
        if (trail.has(declaration)) {
          return undefined;
        }
        const flow = bindingCurrentValueFlow(
          expression.text,
          declaration,
          useNode,
        );
        for (const { expression: value, context } of flow.values) {
          const rooted = resolveCurrentVitestExpression(
            value,
            context,
            new Set([...trail, declaration]),
            depth + 1,
          );
          if (rooted !== undefined) {
            return rooted;
          }
        }
        return undefined;
      }
      const destructured = destructuredBindingCandidates(
        expression.text,
        useNode,
      );
      if (destructured !== undefined && !trail.has(destructured.declaration)) {
        for (const value of destructured.values) {
          const rooted = resolveCurrentVitestExpression(
            value,
            destructured.declaration,
            new Set([...trail, destructured.declaration]),
            depth + 1,
          );
          if (rooted !== undefined) {
            return rooted;
          }
        }
        if (destructured.values.length > 0) {
          return undefined;
        }
      }
      if (
        ROOT_NAMES.has(expression.text) &&
        declaredValueNames.has(expression.text) &&
        !aliases.has(expression.text)
      ) {
        return undefined;
      }
      return resolveExpression(expression);
    }
    if (ts.isPropertyAccessExpression(expression)) {
      const namespaceBase = unwrap(expression.expression);
      if (
        ts.isIdentifier(namespaceBase) &&
        namespaceAliases.has(namespaceBase.text) &&
        ROOT_NAMES.has(expression.name.text)
      ) {
        return {
          root: expression.name.text,
          members: [],
          dynamic: false,
        };
      }
      const base = resolveCurrentVitestExpression(
        expression.expression,
        useNode,
        trail,
        depth + 1,
      );
      if (base !== undefined) {
        return {
          ...base,
          members: [...base.members, expression.name.text],
        };
      }
      const flow = memberCurrentValueFlow(
        expression.expression,
        expression.name.text,
        useNode,
      );
      for (const { expression: value, context } of flow?.values ?? []) {
        const rooted = resolveCurrentVitestExpression(
          value,
          context,
          trail,
          depth + 1,
        );
        if (rooted !== undefined) {
          return rooted;
        }
      }
      if (flow === undefined) {
        for (const value of staticObjectMemberCandidates(
          expression.expression,
          expression.name.text,
          useNode,
        )) {
          const rooted = resolveCurrentVitestExpression(
            value,
            useNode,
            trail,
            depth + 1,
          );
          if (rooted !== undefined) {
            return rooted;
          }
        }
      }
      return undefined;
    }
    if (ts.isElementAccessExpression(expression)) {
      const argument =
        expression.argumentExpression === undefined
          ? undefined
          : unwrap(expression.argumentExpression);
      const member =
        argument === undefined
          ? undefined
          : ts.isNumericLiteral(argument)
            ? argument.text
            : resolvedLiteralMember(argument);
      const namespaceBase = unwrap(expression.expression);
      if (
        ts.isIdentifier(namespaceBase) &&
        namespaceAliases.has(namespaceBase.text) &&
        member !== undefined &&
        ROOT_NAMES.has(member)
      ) {
        return { root: member, members: [], dynamic: false };
      }
      const base = resolveCurrentVitestExpression(
        expression.expression,
        useNode,
        trail,
        depth + 1,
      );
      if (base !== undefined) {
        return member === undefined
          ? { ...base, dynamic: true }
          : { ...base, members: [...base.members, member] };
      }
      if (member !== undefined) {
        const flow = memberCurrentValueFlow(
          expression.expression,
          member,
          useNode,
        );
        for (const { expression: value, context } of flow?.values ?? []) {
          const rooted = resolveCurrentVitestExpression(
            value,
            context,
            trail,
            depth + 1,
          );
          if (rooted !== undefined) {
            return rooted;
          }
        }
        if (flow === undefined) {
          for (const value of staticObjectMemberCandidates(
            expression.expression,
            member,
            useNode,
          )) {
            const rooted = resolveCurrentVitestExpression(
              value,
              useNode,
              trail,
              depth + 1,
            );
            if (rooted !== undefined) {
              return rooted;
            }
          }
        }
      }
      return undefined;
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = staticBoolean(expression.condition);
      const branches =
        condition === undefined
          ? [expression.whenTrue, expression.whenFalse]
          : [condition ? expression.whenTrue : expression.whenFalse];
      for (const branch of branches) {
        const rooted = resolveCurrentVitestExpression(
          branch,
          useNode,
          trail,
          depth + 1,
        );
        if (rooted !== undefined) {
          return rooted;
        }
      }
      return undefined;
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return resolveCurrentVitestExpression(
          expression.right,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        for (const candidate of [expression.left, expression.right]) {
          const rooted = resolveCurrentVitestExpression(
            candidate,
            useNode,
            trail,
            depth + 1,
          );
          if (rooted !== undefined) {
            return rooted;
          }
        }
      }
      return undefined;
    }
    if (ts.isCallExpression(expression)) {
      const access = memberAccess(expression.expression);
      if (
        access?.member === "get" &&
        ts.isIdentifier(access.receiver) &&
        access.receiver.text === "Reflect" &&
        unshadowedGlobalIdentifier("Reflect", expression) &&
        expression.arguments.length >= 2 &&
        expression.arguments.length <= 3
      ) {
        const base = resolveCurrentVitestExpression(
          expression.arguments[0],
          useNode,
          trail,
          depth + 1,
        );
        if (base !== undefined) {
          const member = resolvedLiteralMember(expression.arguments[1]);
          return member === undefined
            ? { ...base, dynamic: true }
            : { ...base, members: [...base.members, member] };
        }
      }
      for (const returned of callableReturnExpressions(
        expression.expression,
        useNode,
      )) {
        const rooted = resolveCurrentVitestExpression(
          returned,
          useNode,
          trail,
          depth + 1,
        );
        if (rooted !== undefined) {
          return rooted;
        }
      }
      return resolveCurrentVitestExpression(
        expression.expression,
        useNode,
        trail,
        depth + 1,
      );
    }
    if (ts.isTaggedTemplateExpression(expression)) {
      return resolveCurrentVitestExpression(
        expression.tag,
        useNode,
        trail,
        depth + 1,
      );
    }
    return resolveExpression(expression);
  }

  function provablyOrdinaryNonVitest(
    rawExpression,
    useNode = rawExpression,
    trail = new Set(),
    depth = 0,
  ) {
    if (depth > 12) {
      return false;
    }
    const expression = unwrap(rawExpression);
    if (
      functionLike(expression) ||
      ts.isClassExpression(expression) ||
      ts.isObjectLiteralExpression(expression) ||
      ts.isArrayLiteralExpression(expression) ||
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression) ||
      ts.isNumericLiteral(expression) ||
      ts.isBigIntLiteral(expression) ||
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      expression.kind === ts.SyntaxKind.NullKeyword
    ) {
      return true;
    }
    if (ts.isAwaitExpression(expression)) {
      return provablyOrdinaryNonVitest(
        expression.expression,
        useNode,
        trail,
        depth + 1,
      );
    }
    if (ts.isIdentifier(expression)) {
      if (enclosingParameterBinding(expression.text, useNode) !== undefined) {
        return true;
      }
      const declaration = bindingAt(
        expression.text,
        useNode.getStart(source),
        useNode,
      );
      if (declaration !== undefined) {
        if (trail.has(declaration)) {
          return false;
        }
        const flow = bindingCurrentValueFlow(
          expression.text,
          declaration,
          useNode,
        );
        return (
          !flow.unknown &&
          flow.values.length > 0 &&
          flow.values.every(({ expression: value, context }) =>
            provablyOrdinaryNonVitest(
              value,
              context,
              new Set([...trail, declaration]),
              depth + 1,
            ),
          )
        );
      }
      const destructured = destructuredBindingCandidates(
        expression.text,
        useNode,
      );
      if (destructured !== undefined && destructured.values.length > 0) {
        return destructured.values.every((value) =>
          provablyOrdinaryNonVitest(
            value,
            destructured.declaration,
            new Set([...trail, destructured.declaration]),
            depth + 1,
          ),
        );
      }
      return provablyNonVitestImports.has(expression.text);
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const access = memberAccess(expression);
      if (access?.member === undefined) {
        return false;
      }
      const flow = memberCurrentValueFlow(
        access.receiver,
        access.member,
        useNode,
      );
      const candidates =
        flow === undefined
          ? [
              ...staticObjectMemberCandidates(
                access.receiver,
                access.member,
                useNode,
              ),
              ...classMemberCandidates(access.receiver, access.member, useNode),
            ]
          : flow.values.map(({ expression: value }) => value);
      return (
        !flow?.unknown &&
        candidates.length > 0 &&
        candidates.every((candidate) => {
          if (
            ts.isGetAccessorDeclaration(candidate) ||
            ts.isMethodDeclaration(candidate)
          ) {
            const returned = callableReturnExpressions(candidate, useNode);
            return (
              returned.length === 0 ||
              returned.every((value) =>
                provablyOrdinaryNonVitest(value, useNode, trail, depth + 1),
              )
            );
          }
          if (
            ts.isPropertyDeclaration(candidate) &&
            candidate.initializer !== undefined
          ) {
            return provablyOrdinaryNonVitest(
              candidate.initializer,
              useNode,
              trail,
              depth + 1,
            );
          }
          return provablyOrdinaryNonVitest(
            candidate,
            useNode,
            trail,
            depth + 1,
          );
        })
      );
    }
    if (ts.isCallExpression(expression)) {
      const returned = callableReturnExpressions(
        expression.expression,
        useNode,
      );
      return (
        returned.length > 0 &&
        returned.every((value) =>
          provablyOrdinaryNonVitest(value, useNode, trail, depth + 1),
        )
      );
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = staticBoolean(expression.condition);
      const candidates =
        condition === undefined
          ? [expression.whenTrue, expression.whenFalse]
          : [condition ? expression.whenTrue : expression.whenFalse];
      return candidates.every((candidate) =>
        provablyOrdinaryNonVitest(candidate, useNode, trail, depth + 1),
      );
    }
    if (ts.isBinaryExpression(expression)) {
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return provablyOrdinaryNonVitest(
          expression.right,
          useNode,
          trail,
          depth + 1,
        );
      }
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expression.operatorToken.kind)
      ) {
        return (
          provablyOrdinaryNonVitest(
            expression.left,
            useNode,
            trail,
            depth + 1,
          ) &&
          provablyOrdinaryNonVitest(expression.right, useNode, trail, depth + 1)
        );
      }
    }
    return false;
  }

  function synchronousSuiteCallback(container) {
    if (!ts.isArrowFunction(container) && !ts.isFunctionExpression(container)) {
      return false;
    }
    const call = container.parent;
    if (!ts.isCallExpression(call) || !call.arguments.includes(container)) {
      return false;
    }
    const rooted = resolveCurrentVitestExpression(call.expression, call);
    return rooted !== undefined && ["describe", "suite"].includes(rooted.root);
  }

  function parameterizedRoot(rawExpression) {
    const rooted = resolveCurrentVitestExpression(rawExpression, rawExpression);
    const member = rooted?.members.at(-1);
    return rooted !== undefined &&
      member !== undefined &&
      PARAMETERIZED_MEMBERS.has(member)
      ? rooted
      : undefined;
  }

  function templateTableState(template) {
    if (ts.isNoSubstitutionTemplateLiteral(template)) {
      const rows = template.text
        .split(/\r?\n/u)
        .map((row) => row.trim())
        .filter((row) => row !== "");
      return rows.length <= 1 ? "EMPTY" : "NON_EMPTY";
    }
    if (ts.isTemplateExpression(template)) {
      const text = [
        template.head.text,
        ...template.templateSpans.map((span) => span.literal.text),
      ].join("");
      const rows = text
        .split(/\r?\n/u)
        .map((row) => row.trim())
        .filter((row) => row !== "");
      return rows.length <= 1 && template.templateSpans.length === 0
        ? "EMPTY"
        : "UNKNOWN";
    }
    return "UNKNOWN";
  }

  const seen = new Set();
  function report(node, reason) {
    const position = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    const key = `${position.line}:${position.character}:${reason}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    findings.push({
      file: path,
      line: position.line + 1,
      column: position.character + 1,
      reason,
    });
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (callInvokesDefaultVitestFails(node, node)) {
        report(node, "forbidden test.fails test modifier");
      }
      const rooted = parameterizedRoot(node.expression);
      if (rooted !== undefined && node.arguments[0] === undefined) {
        report(
          node,
          `${rooted.root}.${rooted.members.at(-1)} parameter table cannot be proven safe`,
        );
      } else if (rooted !== undefined) {
        const state = pointInTimeTableState(node.arguments[0], node);
        if (state === "EMPTY") {
          report(
            node,
            `empty ${rooted.root}.${rooted.members.at(-1)} parameter table is forbidden`,
          );
        } else if (state === "UNSTABLE" || state === "UNKNOWN") {
          report(
            node,
            `${rooted.root}.${rooted.members.at(-1)} parameter table cannot be proven safe`,
          );
        }
      }
    }
    if (ts.isTaggedTemplateExpression(node)) {
      const rooted = parameterizedRoot(node.tag);
      if (rooted !== undefined) {
        const state = templateTableState(node.template);
        if (state === "EMPTY") {
          report(
            node,
            `empty ${rooted.root}.${rooted.members.at(-1)} template table is forbidden`,
          );
        } else if (state !== "NON_EMPTY") {
          report(
            node,
            `${rooted.root}.${rooted.members.at(-1)} template table cannot be proven safe`,
          );
        }
      }
    }
    if (ts.isExpression(node)) {
      const rooted = resolveCurrentVitestExpression(node, node);
      if (rooted?.dynamic) {
        report(
          node,
          `dynamic member on ${rooted.root} test API cannot be proven safe`,
        );
      }
      const forbidden = rooted?.members.find((member) =>
        FORBIDDEN_MEMBERS.has(member),
      );
      if (rooted && forbidden !== undefined) {
        report(node, `forbidden ${rooted.root}.${forbidden} test modifier`);
      }
      const unresolvedAccess = memberAccess(node);
      if (
        rooted === undefined &&
        unresolvedAccess?.member === "fails" &&
        !provablyOrdinaryNonVitest(unresolvedAccess.receiver, node)
      ) {
        report(
          node,
          "test.fails receiver cannot be proven ordinary/non-Vitest",
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function pathIsInside(root, path) {
  const rel = relative(root, path);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}

function sourceFileForImport(importer, specifier, root) {
  const base = resolve(dirname(importer), specifier);
  const suffix = extname(base).toLowerCase();
  const candidates = [];
  if (IMPORT_CLOSURE_EXTENSIONS.includes(suffix)) {
    candidates.push(base);
    for (const replacement of IMPORT_CLOSURE_EXTENSION_REWRITES.get(suffix) ??
      []) {
      candidates.push(`${base.slice(0, -suffix.length)}${replacement}`);
    }
  } else if (suffix === "") {
    candidates.push(
      ...IMPORT_CLOSURE_EXTENSIONS.map((extension) => `${base}${extension}`),
      ...IMPORT_CLOSURE_EXTENSIONS.map((extension) =>
        resolve(base, `index${extension}`),
      ),
    );
  } else {
    return undefined;
  }
  for (const candidate of candidates) {
    try {
      const real = realpathSync(candidate);
      if (statSync(real).isFile() && pathIsInside(root, real)) {
        return real;
      }
    } catch {
      // The next bounded candidate may be the TypeScript-resolved source.
    }
  }
  return undefined;
}

function staticSpecifierText(rawExpression, constants, depth = 0) {
  if (depth > MAX_IMPORT_CLOSURE_DEPTH) {
    return undefined;
  }
  const expression = unwrap(rawExpression);
  if (
    ts.isStringLiteralLike(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text;
  }
  if (ts.isIdentifier(expression)) {
    return constants.get(expression.text);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticSpecifierText(expression.left, constants, depth + 1);
    const right = staticSpecifierText(expression.right, constants, depth + 1);
    return left === undefined || right === undefined
      ? undefined
      : `${left}${right}`;
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      const part = staticSpecifierText(span.expression, constants, depth + 1);
      if (part === undefined) {
        return undefined;
      }
      value += part + span.literal.text;
    }
    return value;
  }
  return undefined;
}

// A name resolves for import-specifier purposes only when the whole file
// contains exactly one value binder for it, that binder is a `const`
// variable, and its initializer is a statically known string. Every other
// spelling (let/var, reassignment targets, duplicate or shadowing binders,
// parameters, catch clauses, imports, destructuring) stays unresolved and
// therefore fails closed at the dynamic-import site.
function uniqueConstStringBindings(source) {
  const declarations = new Map();
  function entryFor(name) {
    const existing = declarations.get(name) ?? {
      binders: 0,
      initializer: undefined,
      isConst: false,
    };
    declarations.set(name, existing);
    return existing;
  }
  function markAmbiguous(name) {
    const entry = entryFor(name);
    entry.binders += 2;
  }
  function markAmbiguousBindingName(name) {
    if (ts.isIdentifier(name)) {
      markAmbiguous(name.text);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        markAmbiguousBindingName(element.name);
      }
    }
  }
  function collect(node) {
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        const entry = entryFor(node.name.text);
        entry.binders += 1;
        entry.initializer = node.initializer;
        entry.isConst =
          ts.isVariableDeclarationList(node.parent) &&
          (node.parent.flags & ts.NodeFlags.Const) !== 0;
      } else {
        markAmbiguousBindingName(node.name);
      }
    } else if (ts.isParameter(node)) {
      markAmbiguousBindingName(node.name);
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isModuleDeclaration(node) ||
        ts.isImportEqualsDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name)
    ) {
      markAmbiguous(node.name.text);
    } else if (
      (ts.isImportClause(node) ||
        ts.isImportSpecifier(node) ||
        ts.isNamespaceImport(node)) &&
      node.name !== undefined
    ) {
      markAmbiguous(node.name.text);
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const target = unwrap(node.left);
      if (ts.isIdentifier(target)) {
        markAmbiguous(target.text);
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(source);
  const constants = new Map();
  for (let pass = 0; pass <= declarations.size; pass += 1) {
    let changed = false;
    for (const [name, entry] of declarations) {
      if (
        entry.binders === 1 &&
        entry.isConst &&
        entry.initializer !== undefined &&
        !constants.has(name)
      ) {
        const value = staticSpecifierText(entry.initializer, constants);
        if (value !== undefined) {
          constants.set(name, value);
          changed = true;
        }
      }
    }
    if (!changed) {
      break;
    }
  }
  return constants;
}

function moduleSpecifierScan(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { specifiers: [], findings: [] };
  }
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    /\.(?:c|m)?tsx$/u.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const constants = uniqueConstStringBindings(source);
  const specifiers = [];
  const findings = [];
  function addResolved(specifierText) {
    if (!specifierText.startsWith("./") && !specifierText.startsWith("../")) {
      return;
    }
    const suffix = extname(specifierText).toLowerCase();
    if (suffix !== "" && !IMPORT_CLOSURE_EXTENSIONS.includes(suffix)) {
      return;
    }
    specifiers.push(specifierText);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      if (ts.isStringLiteralLike(node.moduleSpecifier)) {
        addResolved(node.moduleSpecifier.text);
      }
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      if (
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        addResolved(node.moduleSpecifier.text);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      const specifierText =
        argument === undefined || ts.isSpreadElement(argument)
          ? undefined
          : staticSpecifierText(argument, constants);
      if (specifierText === undefined) {
        const position = source.getLineAndCharacterOfPosition(
          node.getStart(source),
        );
        findings.push({
          file: path,
          line: position.line + 1,
          column: position.character + 1,
          reason: "dynamic import specifier cannot be statically resolved",
        });
      } else {
        addResolved(specifierText);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { specifiers, findings };
}

function scanImportClosure(inputPaths, cwd) {
  let root;
  try {
    root = realpathSync(cwd);
  } catch {
    return [
      {
        file: cwd,
        line: 1,
        column: 1,
        reason: "scanner repository root could not be resolved",
      },
    ];
  }
  const queue = inputPaths.map((path) => ({
    path,
    depth: 0,
    isEntry: true,
  }));
  const seen = new Set();
  const findings = [];
  let totalBytes = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    let real;
    try {
      real = realpathSync(current.path);
    } catch {
      findings.push(...scanFile(current.path));
      continue;
    }
    if (seen.has(real)) {
      continue;
    }
    if (!pathIsInside(root, real)) {
      findings.push({
        file: current.path,
        line: 1,
        column: 1,
        reason: "relative test helper resolves outside the repository",
      });
      continue;
    }
    seen.add(real);
    if (seen.size > MAX_IMPORT_CLOSURE_FILES) {
      findings.push({
        file: real,
        line: 1,
        column: 1,
        reason: "relative test-helper import closure exceeds file bound",
      });
      break;
    }
    let sourceText;
    try {
      const bytes = readFileSync(real);
      totalBytes += bytes.byteLength;
      sourceText = bytes.toString("utf8");
    } catch {
      // scanFile emits the stable read failure below.
    }
    if (totalBytes > MAX_IMPORT_CLOSURE_BYTES) {
      findings.push({
        file: real,
        line: 1,
        column: 1,
        reason: "relative test-helper import closure exceeds byte bound",
      });
      break;
    }
    if (
      current.isEntry ||
      sourceText === undefined ||
      hasImportedPolicySurface(sourceText)
    ) {
      findings.push(...scanFile(real));
    }
    const moduleScan = moduleSpecifierScan(real);
    findings.push(...moduleScan.findings);
    const specifiers = moduleScan.specifiers;
    if (current.depth >= MAX_IMPORT_CLOSURE_DEPTH && specifiers.length > 0) {
      findings.push({
        file: real,
        line: 1,
        column: 1,
        reason: "relative test-helper import closure exceeds depth bound",
      });
      continue;
    }
    for (const specifier of specifiers) {
      const imported = sourceFileForImport(real, specifier, root);
      if (imported === undefined) {
        findings.push({
          file: real,
          line: 1,
          column: 1,
          reason: `relative test helper could not be resolved: ${specifier}`,
        });
      } else {
        queue.push({
          path: imported,
          depth: current.depth + 1,
          isEntry: false,
        });
      }
    }
  }
  return findings;
}

const inputPaths = process.argv.slice(2).map((path) => resolve(path));
if (inputPaths.length === 0) {
  console.error(
    "usage: node scripts/check-ts-test-policy.mjs <test-file> [...]",
  );
  process.exitCode = 2;
} else {
  const cwd = process.cwd();
  const findings = scanImportClosure(inputPaths, cwd).map((finding) => ({
    ...finding,
    file: relative(cwd, finding.file).replaceAll("\\", "/"),
  }));
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `${finding.file}:${finding.line}:${finding.column}: ${finding.reason}`,
      );
    }
    process.exitCode = 1;
  }
}
