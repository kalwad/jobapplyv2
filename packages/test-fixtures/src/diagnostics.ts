import { createHash } from "node:crypto";
import { extname } from "node:path";

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const SENSITIVE_SHAPE =
  /(?:AKIA|ASIA)[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|xox[baprs]-|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./u;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

export function safeDiagnosticSegment(value: string): string {
  if (
    SAFE_SEGMENT.test(value) &&
    !SENSITIVE_SHAPE.test(value) &&
    value !== "." &&
    value !== ".."
  ) {
    return value;
  }
  const extension = extname(value);
  const safeExtension = /^\.[A-Za-z0-9]{1,10}$/u.test(extension)
    ? extension.toLowerCase()
    : "";
  return `@segment-${digest(value)}${safeExtension}`;
}

export function safeDiagnosticPath(value: string): string {
  if (value === "." || value === "") {
    return ".";
  }
  const normalized = value.replaceAll("\\", "/");
  return normalized
    .split("/")
    .filter((segment) => segment !== "")
    .map(safeDiagnosticSegment)
    .join("/");
}

export function safeDiagnosticPointer(pointer: string): string {
  if (pointer === "" || pointer === "/") {
    return "/";
  }
  return `/${pointer
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) =>
      /^(?:[0-9]+|@(?:key|member)|items|files|metadata)$/u.test(segment)
        ? segment
        : safeDiagnosticSegment(segment),
    )
    .join("/")}`;
}

export function safeDiagnosticToken(value: string): string {
  return safeDiagnosticSegment(value);
}
