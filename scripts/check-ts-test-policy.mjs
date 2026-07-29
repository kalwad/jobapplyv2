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

const ROOT_NAMES = new Set(["test", "it", "describe", "bench"]);
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
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
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
          : literalMember(expression.argumentExpression);
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
  const variableDeclarations = [];
  function collectDeclarations(node) {
    if (ts.isVariableDeclaration(node)) {
      variableDeclarations.push(node);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(source);
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
