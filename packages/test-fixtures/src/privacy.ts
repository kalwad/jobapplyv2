import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  type Dirent,
} from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { homedir, hostname } from "node:os";
import { fileURLToPath } from "node:url";

import { parseStrictJson } from "./strict-json.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MAX_SCAN_FILE_BYTES = 2 * 1024 * 1024;
const SCANNED_EXTENSIONS = new Set([".json", ".md", ".ts"]);

export interface PrivacyIssue {
  readonly code: string;
  readonly file: string;
  readonly field: string;
  readonly detail: string;
}

export interface PrivacyReport {
  readonly valid: boolean;
  readonly filesScanned: number;
  readonly fieldsScanned: number;
  readonly issues: readonly PrivacyIssue[];
}

export class FixturePrivacyError extends Error {
  public readonly issues: readonly PrivacyIssue[];

  public constructor(issues: readonly PrivacyIssue[]) {
    super(
      `fixture privacy scan failed with ${String(issues.length)} issue(s): ${issues
        .slice(0, 8)
        .map((issue) => `${issue.code} ${issue.file}${issue.field}`)
        .join(", ")}`,
    );
    this.name = "FixturePrivacyError";
    this.issues = issues;
  }
}

const EMAIL =
  /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}.-]+\.[\p{L}]{2,63}(?![\p{L}\p{N}.-])/giu;
const PHONE =
  /(?<!\d)(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?!\d)/gu;
const ADDRESS =
  /\b\d{1,6}\s+[\p{L}\p{N} .'-]{2,80}\s(?:STREET|ST|ROAD|RD|AVENUE|AVE|BOULEVARD|BLVD|LANE|LN|DRIVE|DR|WAY)\b/giu;
const RESERVED_EMAIL = /^candidate(0[1-9]|1[0-2])@example\.test$/u;
const RESERVED_PHONE = /^\+1-202-555-01(?:0[1-9]|1[0-2])$/u;
const RESERVED_ADDRESS = /^(?:10[1-9]|11[0-2]) Fixture Way$/u;
const RESERVED_NAME = /^Synthetic Candidate (0[1-9]|1[0-2])$/u;

const SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/gu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/gu,
  /\bAIza[0-9A-Za-z_-]{30,}\b/gu,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{8,}\b/giu,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu,
];

const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore\b.{0,40}\b(?:previous|prior|above|system|developer)\b.{0,20}\b(?:instruction|message|prompt)s?\b/giu,
  /<\|(?:im_start|im_end|system|assistant|developer)\|>/giu,
  /\[(?:\/)?INST\]/gu,
  /<!--[\s\S]*?-->|<script\b|<style\b|display\s*:\s*none/giu,
];

const ABSOLUTE_LOCAL_PATH_PATTERNS: readonly RegExp[] = [
  /(?<![\p{L}\p{N}/#.])\/(?!\/)(?:[\p{L}\p{N}._~+-]+(?: [\p{L}\p{N}._~+-]+)*\/)+[\p{L}\p{N}._~+-]+(?: [\p{L}\p{N}._~+-]+)*/giu,
  /(?:^|[=\s"'(:])\/(?!\/)[\p{L}\p{N}._~+-]+(?=$|[\s"'),;])/giu,
  /(?<![\p{L}\p{N}:/#.])\/\/(?!\/)(?:[\p{L}\p{N}._~+-]+\/)+[\p{L}\p{N}._~+-]+/giu,
  /(?<![\p{L}\p{N}])[A-Za-z]:[\\/][^\r\n"'()]+/gu,
  /(?<![\\\p{L}\p{N}])\\{1,2}[A-Za-z0-9_~-][^\\\r\n"'()]*\\(?:[^\\\r\n"'()]+\\)*[^\\\r\n"'()]+/gu,
  /(?<![\p{L}\p{N}])~[\\/][^\r\n"'()]+/gu,
  /\bfile:(?:\/\/\/?|[\\/])[^\r\n"'()]+/giu,
];

const COMMON_MACHINE_NAMES = new Set([
  "admin",
  "localhost",
  "root",
  "runner",
  "ubuntu",
  "windows",
]);
const LOCAL_IDENTITY_TOKENS = [basename(homedir()), hostname()]
  .map((candidate) => candidate.toLocaleLowerCase("en-US"))
  .filter(
    (candidate) =>
      candidate.length >= 5 && !COMMON_MACHINE_NAMES.has(candidate),
  );

function addIssue(
  issues: PrivacyIssue[],
  code: string,
  file: string,
  field: string,
  detail: string,
): void {
  issues.push({ code, file, field, detail });
}

function pointerAt(collection: string, index: number): string {
  return `${collection}/${String(index)}`;
}

function containsHiddenText(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      (codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a) ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      (codePoint >= 0x200b && codePoint <= 0x200f) ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      codePoint === 0x2060 ||
      (codePoint >= 0x2066 && codePoint <= 0x2069) ||
      codePoint === 0xfeff
    ) {
      return true;
    }
  }
  return false;
}

function displayPath(root: string, file: string): string {
  const rel = relative(root, file);
  return rel === "" ? basename(file) : rel.split(sep).join("/");
}

function resetAndTest(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function inspectText(
  rawValue: string,
  file: string,
  field: string,
  issues: PrivacyIssue[],
  semanticField?: string,
): void {
  const value = rawValue.normalize("NFKC");
  if (containsHiddenText(value)) {
    addIssue(
      issues,
      "PRIVACY_HIDDEN_TEXT",
      file,
      field,
      "hidden or control text is forbidden",
    );
  }
  if (
    ABSOLUTE_LOCAL_PATH_PATTERNS.some((pattern) => resetAndTest(pattern, value))
  ) {
    addIssue(
      issues,
      "PRIVACY_LOCAL_PATH",
      file,
      field,
      "absolute user or machine path detected",
    );
  }
  const normalizedValue = value.toLocaleLowerCase("en-US");
  if (
    LOCAL_IDENTITY_TOKENS.some((candidate) =>
      normalizedValue
        .split(/[^\p{L}\p{N}_.-]+/u)
        .some((token) => token === candidate),
    )
  ) {
    addIssue(
      issues,
      "PRIVACY_LOCAL_IDENTITY",
      file,
      field,
      "local user or host identifier detected",
    );
  }
  for (const pattern of SECRET_PATTERNS) {
    if (resetAndTest(pattern, value)) {
      addIssue(
        issues,
        "PRIVACY_SECRET",
        file,
        field,
        "secret or credential pattern detected",
      );
    }
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (resetAndTest(pattern, value)) {
      addIssue(
        issues,
        "PRIVACY_PROMPT_INJECTION",
        file,
        field,
        "hidden instruction pattern detected",
      );
    }
  }
  EMAIL.lastIndex = 0;
  for (const match of value.matchAll(EMAIL)) {
    if (!RESERVED_EMAIL.test(match[0].toLocaleLowerCase("en-US"))) {
      addIssue(
        issues,
        "PRIVACY_EMAIL_DOMAIN",
        file,
        field,
        "nonreserved email address detected",
      );
    }
  }
  PHONE.lastIndex = 0;
  for (const match of value.matchAll(PHONE)) {
    if (!RESERVED_PHONE.test(match[0])) {
      addIssue(
        issues,
        "PRIVACY_PHONE",
        file,
        field,
        "nonreserved phone number detected",
      );
    }
  }
  ADDRESS.lastIndex = 0;
  for (const match of value.matchAll(ADDRESS)) {
    if (!RESERVED_ADDRESS.test(match[0])) {
      addIssue(
        issues,
        "PRIVACY_ADDRESS",
        file,
        field,
        "nonreserved street address detected",
      );
    }
  }
  const lastField = semanticField ?? field.split("/").at(-1);
  if (lastField === "full_name" && !RESERVED_NAME.test(value)) {
    addIssue(
      issues,
      "PRIVACY_NAME",
      file,
      field,
      "candidate name is not an explicit synthetic reserved value",
    );
  }
  if (lastField === "email" && !RESERVED_EMAIL.test(value)) {
    addIssue(
      issues,
      "PRIVACY_EMAIL_DOMAIN",
      file,
      field,
      "email field is not an explicit synthetic reserved value",
    );
  }
  if (lastField === "phone" && !RESERVED_PHONE.test(value)) {
    addIssue(
      issues,
      "PRIVACY_PHONE",
      file,
      field,
      "phone field is not an explicit synthetic reserved value",
    );
  }
  if (lastField === "line1" && !RESERVED_ADDRESS.test(value)) {
    addIssue(
      issues,
      "PRIVACY_ADDRESS",
      file,
      field,
      "address field is not an explicit synthetic reserved value",
    );
  }
}

function inspectValue(
  value: unknown,
  file: string,
  pointer: string,
  issues: PrivacyIssue[],
  counters: { fields: number },
  semanticField?: string,
): void {
  if (typeof value === "string") {
    counters.fields += 1;
    inspectText(
      value,
      file,
      pointer === "" ? "/" : pointer,
      issues,
      semanticField,
    );
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      inspectValue(
        item,
        file,
        pointerAt(pointer, index),
        issues,
        counters,
        semanticField,
      );
    });
  } else if (typeof value === "object" && value !== null) {
    for (const [index, [key, item]] of Object.entries(value).entries()) {
      const safeKey = `@member/${String(index)}`;
      counters.fields += 1;
      inspectText(key, file, `${pointer}/${safeKey}/@key`, issues);
      inspectValue(item, file, `${pointer}/${safeKey}`, issues, counters, key);
    }
  }
}

function walk(
  root: string,
  current: string,
  issues: PrivacyIssue[],
  excludedTopLevel: ReadonlySet<string>,
): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    addIssue(
      issues,
      "PRIVACY_SCAN_IO",
      displayPath(root, current),
      "/",
      "directory cannot be read",
    );
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
      addIssue(
        issues,
        "PRIVACY_SCAN_SYMLINK",
        displayPath(root, path),
        "/",
        "symbolic links are forbidden",
      );
    } else if (entry.isDirectory()) {
      files.push(...walk(root, path, issues, excludedTopLevel));
    } else if (entry.isFile()) {
      if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
        files.push(path);
      } else {
        addIssue(
          issues,
          "PRIVACY_SCAN_EXTENSION",
          displayPath(root, path),
          "/",
          "unrecognized regular files are forbidden on the scanned surface",
        );
      }
    }
  }
  return files;
}

function scanPrivacyTreeInternal(
  root: string,
  excludedTopLevel: ReadonlySet<string>,
): PrivacyReport {
  const issues: PrivacyIssue[] = [];
  let stats;
  try {
    stats = lstatSync(root);
  } catch {
    addIssue(issues, "PRIVACY_SCAN_IO", ".", "/", "scan root is missing");
    return { valid: false, filesScanned: 0, fieldsScanned: 0, issues };
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    addIssue(
      issues,
      "PRIVACY_SCAN_ROOT",
      ".",
      "/",
      "scan root must be a regular directory",
    );
    return { valid: false, filesScanned: 0, fieldsScanned: 0, issues };
  }
  const rootReal = realpathSync(root);
  const files = walk(rootReal, rootReal, issues, excludedTopLevel);
  const counters = { fields: 0 };
  let scanned = 0;
  for (const filePath of files) {
    const file = displayPath(rootReal, filePath);
    const fileStats = lstatSync(filePath);
    if (fileStats.size > MAX_SCAN_FILE_BYTES) {
      addIssue(
        issues,
        "PRIVACY_SCAN_SIZE",
        file,
        "/",
        "file exceeds the scanner ceiling",
      );
      continue;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        readFileSync(filePath),
      );
    } catch {
      addIssue(
        issues,
        "PRIVACY_SCAN_ENCODING",
        file,
        "/",
        "file is not strict UTF-8",
      );
      continue;
    }
    scanned += 1;
    if (extname(filePath) === ".json") {
      try {
        inspectValue(parseStrictJson(text), file, "", issues, counters);
      } catch {
        addIssue(
          issues,
          "PRIVACY_SCAN_JSON",
          file,
          "/",
          "JSON is not strict or contains duplicate keys",
        );
      }
    } else {
      text.split("\n").forEach((line, index) => {
        counters.fields += 1;
        inspectText(line, file, pointerAt("/line", index + 1), issues);
      });
    }
  }
  return {
    valid: issues.length === 0,
    filesScanned: scanned,
    fieldsScanned: counters.fields,
    issues,
  };
}

export function scanPrivacyTree(root: string): PrivacyReport {
  return scanPrivacyTreeInternal(root, new Set());
}

export function scanCommittedFixturePrivacy(): PrivacyReport {
  return scanPrivacyTreeInternal(
    PACKAGE_ROOT,
    new Set([".turbo", "node_modules", "src", "test"]),
  );
}

export function assertCommittedFixturePrivacy(): PrivacyReport {
  const report = scanCommittedFixturePrivacy();
  if (!report.valid) {
    throw new FixturePrivacyError(report.issues);
  }
  return report;
}
