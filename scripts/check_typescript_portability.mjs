#!/usr/bin/env node
// Syntax-aware PORT-SRC-008 helper. Python owns policy orchestration; this
// tiny Node boundary uses the repository-pinned TypeScript compiler so the
// rule sees executable syntax instead of comments or formatting variants.
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const BANNED_PATH = /(?<![\w:/#.-])\/(tmp|bin|usr|etc|var)(?![\w.-])/;
const BANNED_WRAPPERS = ["bash -lc", "bash -c", "sh -c"];

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

function constInitializer(identifier, checker, shorthand = false) {
  const symbol = shorthand
    ? checker.getShorthandAssignmentValueSymbol(identifier.parent)
    : checker.getSymbolAtLocation(identifier);
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
  return declaration.initializer;
}

function isStaticallyTrue(node, checker, seen = new Set(), shorthand = false) {
  const current = unwrapExpression(node);
  if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (!ts.isIdentifier(current)) return false;

  const initializer = constInitializer(current, checker, shorthand);
  if (initializer !== null && !seen.has(initializer)) {
    seen.add(initializer);
    if (isStaticallyTrue(initializer, checker, seen)) return true;
  }

  const type = checker.getTypeAtLocation(current);
  if (
    (type.flags & ts.TypeFlags.BooleanLiteral) !== 0 &&
    type.intrinsicName === "true"
  ) {
    return true;
  }
  return false;
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression))
  ) {
    return name.expression.text;
  }
  return null;
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

function stringValue(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return node.text;
  }
  return null;
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function diagnosticText(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}

function inspect(relativePath, source, checker) {
  if (source.parseDiagnostics.length > 0) {
    const rendered = source.parseDiagnostics.map(diagnosticText).join("; ");
    throw new Error(`${relativePath} is not parseable TypeScript: ${rendered}`);
  }

  const findings = [];
  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      propertyNameText(node.name) === "shell" &&
      isStaticallyTrue(node.initializer, checker)
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
      node.name.text === "shell" &&
      isStaticallyTrue(node.name, checker, new Set(), true)
    ) {
      findings.push({
        path: relativePath,
        line: lineOf(source, node.name),
        kind: "shell-true",
        detail: "shell=true",
      });
    }

    const value = stringValue(node);
    if (
      value !== null &&
      !isTypeOnly(node) &&
      !isDocumentationExpression(node)
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
      const wrapper = BANNED_WRAPPERS.find((candidate) =>
        value.includes(candidate),
      );
      if (wrapper !== undefined) {
        findings.push({
          path: relativePath,
          line: lineOf(source, node),
          kind: "shell-wrapper",
          detail: wrapper,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
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
const checker = program.getTypeChecker();
const findings = [];
for (const [index, relativePath] of paths.entries()) {
  const absolutePath = absolutePaths[index];
  const source = program.getSourceFile(absolutePath);
  if (source === undefined) {
    throw new Error(`${relativePath} was not loaded by the TypeScript parser`);
  }
  findings.push(...inspect(relativePath, source, checker));
}
process.stdout.write(JSON.stringify(findings));
