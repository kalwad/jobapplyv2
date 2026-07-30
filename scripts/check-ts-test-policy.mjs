#!/usr/bin/env node
/**
 * Fail-closed TypeScript test-policy scanner.
 *
 * This intentionally uses the workspace-pinned TypeScript parser instead of
 * text matching. It follows statically representable aliases and member/call
 * chains rooted at Vitest's test APIs, including decoded computed literals.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";
import console from "node:console";

import ts from "typescript";

const ROOT_NAMES = new Set(["test", "it", "describe", "suite", "bench"]);
const PARAMETERIZED_MEMBERS = new Set(["each", "for"]);
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

  const variableDeclarations = [];
  function collectDeclarations(node) {
    if (ts.isVariableDeclaration(node)) {
      variableDeclarations.push(node);
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

  const tableInitializers = new Map();
  for (const declaration of variableDeclarations) {
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.initializer !== undefined &&
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      tableInitializers.set(declaration.name.text, declaration.initializer);
    }
  }
  const mutatedTables = new Set();
  function collectMutations(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(unwrap(node.left))
    ) {
      mutatedTables.add(unwrap(node.left).text);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      ts.isIdentifier(unwrap(node.operand))
    ) {
      mutatedTables.add(unwrap(node.operand).text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(unwrap(node.expression)) &&
      ["push", "unshift", "splice"].includes(unwrap(node.expression).name.text)
    ) {
      const receiver = unwrap(unwrap(node.expression).expression);
      if (ts.isIdentifier(receiver)) {
        mutatedTables.add(receiver.text);
      }
    }
    ts.forEachChild(node, collectMutations);
  }
  collectMutations(source);

  function tableState(rawExpression, trail = new Set(), depth = 0) {
    if (depth > 16) {
      return "UNKNOWN";
    }
    const expression = unwrap(rawExpression);
    if (ts.isIdentifier(expression)) {
      if (trail.has(expression.text) || mutatedTables.has(expression.text)) {
        return "UNKNOWN";
      }
      const initializer = tableInitializers.get(expression.text);
      if (initializer === undefined) {
        return "UNKNOWN";
      }
      return tableState(
        initializer,
        new Set([...trail, expression.text]),
        depth + 1,
      );
    }
    if (ts.isArrayLiteralExpression(expression)) {
      if (expression.elements.length === 0) {
        return "EMPTY";
      }
      let allEmptySpreads = true;
      for (const element of expression.elements) {
        if (!ts.isSpreadElement(element)) {
          return "NON_EMPTY";
        }
        if (tableState(element.expression, trail, depth + 1) !== "EMPTY") {
          allEmptySpreads = false;
        }
      }
      return allEmptySpreads ? "EMPTY" : "UNKNOWN";
    }
    if (
      ts.isNoSubstitutionTemplateLiteral(expression) ||
      ts.isStringLiteralLike(expression)
    ) {
      return expression.text.trim() === "" ? "EMPTY" : "UNKNOWN";
    }
    if (ts.isCallExpression(expression)) {
      const target = unwrap(expression.expression);
      if (ts.isIdentifier(target) && target.text === "Array") {
        if (
          expression.arguments.length === 0 ||
          (expression.arguments.length === 1 &&
            ts.isNumericLiteral(unwrap(expression.arguments[0])) &&
            Number(unwrap(expression.arguments[0]).text) === 0)
        ) {
          return "EMPTY";
        }
      }
      if (
        ts.isPropertyAccessExpression(target) &&
        ts.isIdentifier(unwrap(target.expression)) &&
        unwrap(target.expression).text === "Array" &&
        target.name.text === "of" &&
        expression.arguments.length === 0
      ) {
        return "EMPTY";
      }
      if (
        ts.isPropertyAccessExpression(target) &&
        target.name.text === "concat"
      ) {
        const states = [
          tableState(target.expression, trail, depth + 1),
          ...expression.arguments.map((argument) =>
            tableState(argument, trail, depth + 1),
          ),
        ];
        return states.every((state) => state === "EMPTY")
          ? "EMPTY"
          : states.some((state) => state === "NON_EMPTY")
            ? "NON_EMPTY"
            : "UNKNOWN";
      }
    }
    if (ts.isNewExpression(expression)) {
      const target = unwrap(expression.expression);
      const args = expression.arguments ?? [];
      if (
        ts.isIdentifier(target) &&
        target.text === "Array" &&
        (args.length === 0 ||
          (args.length === 1 &&
            ts.isNumericLiteral(unwrap(args[0])) &&
            Number(unwrap(args[0]).text) === 0))
      ) {
        return "EMPTY";
      }
    }
    return "UNKNOWN";
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
      if (
        rooted !== undefined &&
        node.arguments[0] !== undefined &&
        tableState(node.arguments[0]) === "EMPTY"
      ) {
        report(
          node,
          `empty ${rooted.root}.${rooted.members.at(-1)} parameter table is forbidden`,
        );
      }
    }
    if (ts.isTaggedTemplateExpression(node)) {
      const rooted = parameterizedRoot(node.tag);
      if (
        rooted !== undefined &&
        templateTableState(node.template) === "EMPTY"
      ) {
        report(
          node,
          `empty ${rooted.root}.${rooted.members.at(-1)} template table is forbidden`,
        );
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
