#!/usr/bin/env node
/**
 * Fail-closed TypeScript test-policy scanner.
 *
 * This intentionally uses the workspace-pinned TypeScript parser instead of
 * text matching. It follows statically representable aliases and member/call
 * chains rooted at Vitest's test APIs, including decoded computed literals.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
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
  "only",
  "skip",
  "fixme",
  "todo",
  "skipIf",
  "runIf",
]);

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

  for (const statement of source.statements) {
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

  function executionContainer(node) {
    let current = node.parent;
    while (current !== undefined && !functionLike(current)) {
      current = current.parent;
    }
    return current ?? source;
  }

  function containerChain(node) {
    const containers = new Set([source]);
    let current = node.parent;
    while (current !== undefined) {
      if (functionLike(current)) {
        containers.add(current);
      }
      current = current.parent;
    }
    return containers;
  }

  function bindingScope(declaration) {
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
        return current;
      }
      if (!blockScoped && (functionLike(current) || ts.isSourceFile(current))) {
        return current;
      }
      current = current.parent;
    }
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

  function bindingIsConst(declaration) {
    return (
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    );
  }

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
    if (expressionContainsName(argument, names)) {
      return true;
    }
    const callback = unwrap(argument);
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
        const initializer = unwrap(declaration.initializer);
        if (!ts.isIdentifier(initializer)) {
          continue;
        }
        if (names.has(initializer.text) && !names.has(declaration.name.text)) {
          names.add(declaration.name.text);
          changed = true;
        } else if (
          names.has(declaration.name.text) &&
          !names.has(initializer.text)
        ) {
          names.add(initializer.text);
          changed = true;
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
        const shape = exactShape(access.receiver, useNode, trail, depth + 1);
        if (!shapeIsBounded(shape)) {
          return shape;
        }
        for (const argument of expression.arguments) {
          const addition = exactShape(argument, useNode, trail, depth + 1);
          if (!shapeIsBounded(addition) || !appendShape(shape, addition)) {
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
        node.getStart(source) < usePosition
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
          expressionContainsName(initializer, names) &&
          !isDirectAlias(initializer, names) &&
          !isSafeIdentityCopy(initializer, names)
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
          isDirectAlias(access.receiver, names)
        ) {
          if (access.member === undefined) {
            add(node, "UNSTABLE");
          } else if (MUTATING_ARRAY_METHODS.has(access.member)) {
            add(node, access.member.toUpperCase(), {
              args: [...node.arguments],
            });
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
          const target = unwrap(node.expression);
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
        (node.arguments ?? []).some(
          (argument) =>
            expressionContainsName(argument, names) ||
            (localCallableReference(argument, node) &&
              callbackCapturesName(argument, names, node)),
        )
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

  function synchronousSuiteCallback(container) {
    if (!ts.isArrowFunction(container) && !ts.isFunctionExpression(container)) {
      return false;
    }
    const call = container.parent;
    if (!ts.isCallExpression(call) || !call.arguments.includes(container)) {
      return false;
    }
    const rooted = resolveExpression(call.expression);
    return rooted !== undefined && ["describe", "suite"].includes(rooted.root);
  }

  function parameterizedRoot(rawExpression) {
    const rooted = resolveExpression(rawExpression);
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
      const rooted = resolveExpression(node);
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
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
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
  const findings = inputPaths.flatMap(scanFile).map((finding) => ({
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
