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
import { safeUntrustedDiagnosticPath } from "./diagnostics.ts";

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
const PHONE = /(?<![\p{L}\p{N}])\+?\d(?:[\s().-]*\d){9,14}(?![\p{L}\p{N}])/gu;
const SSN =
  /(?<![\p{L}\p{N}])(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\p{L}\p{N}])/gu;
const ADDRESS =
  /\b\d{1,6}[A-Z]?\s+[\p{L}\p{N} .'-]{1,80}\s(?:STREET|ST|ROAD|RD|AVENUE|AVE|BOULEVARD|BLVD|LANE|LN|DRIVE|DR|WAY|PARKWAY|PKWY|COURT|CT|PLACE|PL|TERRACE|TER|CIRCLE|CIR|HIGHWAY|HWY)\b/giu;
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
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/gu,
  /\bAIza[0-9A-Za-z_-]{30,}\b/gu,
  /\bBearer\s+[A-Za-z0-9+/_=-]{8,}\b/giu,
  /\bBasic\s+(?=[A-Za-z0-9+/=]{12,}\b)(?=[A-Za-z0-9+/=]*[0-9+/=])[A-Za-z0-9+/=]{12,}\b/gu,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu,
];

const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore\b.{0,40}\b(?:previous|prior|above|system|developer)\b.{0,20}\b(?:instruction|message|prompt)s?\b/giu,
  /\b(?:disregard|override|forget|bypass)\b.{0,50}\b(?:previous|prior|above|system|developer|instruction|message|prompt)s?\b/giu,
  /\b(?:follow|obey)\b.{0,30}\b(?:new|next|these)\b.{0,20}\binstructions?\b/giu,
  /<\|(?:im_start|im_end|system|assistant|developer)\|>/giu,
  /\[(?:\/)?INST\]/gu,
  /<!--[\s\S]*?-->|<script\b|<style\b|display\s*:\s*none/giu,
];

const ABSOLUTE_LOCAL_PATH_PATTERNS: readonly RegExp[] = [
  /(?:^|[=\s"'(:])\/(?:Applications|Library|Users|Volumes|Windows|etc|home|opt|private|root|srv|tmp|usr|var|workspace)(?:[/\s"'(),;]|$)/giu,
  /(?<![\p{L}\p{N}:/#.])\/\/(?!\/)(?:[\p{L}\p{N}._~+-]+\/)+[\p{L}\p{N}._~+-]+/giu,
  /(?<![\p{L}\p{N}])[A-Za-z]:[\\/][^\r\n"'()]+/gu,
  /(?<![\\\p{L}\p{N}])\\{1,2}[A-Za-z0-9_~-][^\\\r\n"'()]*\\(?:[^\\\r\n"'()]+\\)*[^\\\r\n"'()]+/gu,
  /(?<![\p{L}\p{N}])~[\\/][^\r\n"'()]+/gu,
  /\bfile:(?:\/\/\/?|[\\/])[^\r\n"'()]+/giu,
];
const TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/gu;
const DANGEROUS_KEYS = new Set([
  "__definegetter__",
  "__definesetter__",
  "__lookupgetter__",
  "__lookupsetter__",
  "__proto__",
  "constructor",
  "prototype",
]);
const MAX_NORMALIZED_TEXT = 128 * 1024;

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
  const display = rel === "" ? basename(file) : rel.split(sep).join("/");
  return safeUntrustedDiagnosticPath(display) || ".";
}

function normalizedSemanticField(value: string): string {
  return value
    .normalize("NFKC")
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .toLocaleLowerCase("en-US")
    .replaceAll(/[^a-z0-9]+/gu, "");
}

function isSecretSemanticField(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return new Set([
    "apikey",
    "apisecret",
    "authorization",
    "authtoken",
    "clientsecret",
    "cookie",
    "password",
    "passphrase",
    "privatekey",
    "refreshtoken",
    "secret",
    "session",
    "sessiontoken",
    "signingkey",
    "token",
    "accesstoken",
  ]).has(normalizedSemanticField(value));
}

function isSensitiveIdentifierField(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return new Set([
    "accountnumber",
    "bankaccount",
    "cardnumber",
    "driverslicense",
    "nationalid",
    "passportnumber",
    "paymentcard",
    "routingnumber",
    "socialsecurity",
    "socialsecuritynumber",
    "ssn",
    "taxid",
  ]).has(normalizedSemanticField(value));
}

function resetAndTest(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function decodeEscapes(value: string): string {
  return value
    .replaceAll(/\\x([0-9a-fA-F]{2})/gu, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    )
    .replaceAll(/\\u\{([0-9a-fA-F]{1,6})\}/gu, (_match, digits: string) => {
      const codePoint = Number.parseInt(digits, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "\uFFFD";
    })
    .replaceAll(/\\u([0-9a-fA-F]{4})/gu, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    );
}

function normalizedVariants(rawValue: string): string[] {
  const variants = new Set<string>();
  let value = rawValue.slice(0, MAX_NORMALIZED_TEXT).normalize("NFKC");
  variants.add(value);
  for (let pass = 0; pass < 2; pass += 1) {
    const escaped = decodeEscapes(value).normalize("NFKC");
    variants.add(escaped);
    value = escaped;
    if (/%[0-9a-fA-F]{2}/u.test(value)) {
      try {
        const decoded = decodeURIComponent(value).normalize("NFKC");
        variants.add(decoded);
        value = decoded;
      } catch {
        break;
      }
    }
  }
  for (const candidate of [...variants]) {
    let folded = candidate;
    for (let pass = 0; pass < 4; pass += 1) {
      const next = folded
        .replaceAll(/"([^"\\]{0,1024})"\s*\+\s*"([^"\\]{0,1024})"/gu, "$1$2")
        .replaceAll(/'([^'\\]{0,1024})'\s*\+\s*'([^'\\]{0,1024})'/gu, "$1$2");
      if (next === folded) {
        break;
      }
      folded = next;
    }
    variants.add(folded);
  }
  return [...variants].slice(0, 12);
}

function inspectText(
  rawValue: string,
  file: string,
  field: string,
  issues: PrivacyIssue[],
  semanticField?: string,
  keyOnly = false,
  localIdentityTokens: readonly string[] = LOCAL_IDENTITY_TOKENS,
): void {
  const variants = normalizedVariants(rawValue);
  const value = variants.at(-1) ?? "";
  if (rawValue.length > MAX_NORMALIZED_TEXT) {
    addIssue(
      issues,
      "PRIVACY_SCAN_SIZE",
      file,
      field,
      "individual text value exceeds the normalization ceiling",
    );
  }
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
    variants.some((candidate) =>
      ABSOLUTE_LOCAL_PATH_PATTERNS.some((pattern) =>
        resetAndTest(pattern, candidate),
      ),
    )
  ) {
    addIssue(
      issues,
      "PRIVACY_LOCAL_PATH",
      file,
      field,
      "absolute user or machine path detected",
    );
  }
  const reviewedConfigTraversal =
    semanticField === "extends" && value === "../../tsconfig.base.json";
  if (
    !reviewedConfigTraversal &&
    variants.some((candidate) => resetAndTest(TRAVERSAL, candidate))
  ) {
    addIssue(
      issues,
      "PRIVACY_PATH_TRAVERSAL",
      file,
      field,
      "normalized traversal segment detected",
    );
  }
  const normalizedValue = value.toLocaleLowerCase("en-US");
  if (
    localIdentityTokens.some((candidate) =>
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
    if (variants.some((candidate) => resetAndTest(pattern, candidate))) {
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
    if (variants.some((candidate) => resetAndTest(pattern, candidate))) {
      addIssue(
        issues,
        "PRIVACY_PROMPT_INJECTION",
        file,
        field,
        "hidden instruction pattern detected",
      );
    }
  }
  for (const candidate of variants) {
    EMAIL.lastIndex = 0;
    for (const match of candidate.matchAll(EMAIL)) {
      if (RESERVED_EMAIL.test(match[0].toLocaleLowerCase("en-US"))) {
        continue;
      }
      addIssue(
        issues,
        "PRIVACY_EMAIL_DOMAIN",
        file,
        field,
        "nonreserved email address detected",
      );
    }
  }
  for (const candidate of variants) {
    PHONE.lastIndex = 0;
    for (const match of candidate.matchAll(PHONE)) {
      if (RESERVED_PHONE.test(match[0])) {
        continue;
      }
      addIssue(
        issues,
        "PRIVACY_PHONE",
        file,
        field,
        "nonreserved phone number detected",
      );
    }
  }
  if (variants.some((candidate) => resetAndTest(SSN, candidate))) {
    addIssue(
      issues,
      "PRIVACY_SENSITIVE_IDENTIFIER",
      file,
      field,
      "high-confidence sensitive identifier shape detected",
    );
  }
  for (const candidate of variants) {
    ADDRESS.lastIndex = 0;
    for (const match of candidate.matchAll(ADDRESS)) {
      if (RESERVED_ADDRESS.test(match[0])) {
        continue;
      }
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
  const normalizedField = lastField
    ?.normalize("NFKC")
    .toLocaleLowerCase("en-US");
  if (
    keyOnly &&
    normalizedField !== undefined &&
    DANGEROUS_KEYS.has(normalizedField)
  ) {
    addIssue(
      issues,
      "PRIVACY_DANGEROUS_KEY",
      file,
      field,
      "prototype-pollution or dangerous object key detected",
    );
  }
  if (
    !keyOnly &&
    isSecretSemanticField(normalizedField) &&
    value.trim() !== ""
  ) {
    addIssue(
      issues,
      "PRIVACY_SEMANTIC_CREDENTIAL",
      file,
      field,
      "credential-bearing semantic field is forbidden",
    );
  }
  if (
    !keyOnly &&
    isSensitiveIdentifierField(normalizedField) &&
    /^\d{8,}$/u.test(value.trim())
  ) {
    addIssue(
      issues,
      "PRIVACY_SENSITIVE_IDENTIFIER",
      file,
      field,
      "long numeric value under a sensitive identifier field is forbidden",
    );
  }
  if (!keyOnly && lastField === "full_name" && !RESERVED_NAME.test(value)) {
    addIssue(
      issues,
      "PRIVACY_NAME",
      file,
      field,
      "candidate name is not an explicit synthetic reserved value",
    );
  }
  if (!keyOnly && lastField === "email" && !RESERVED_EMAIL.test(value)) {
    addIssue(
      issues,
      "PRIVACY_EMAIL_DOMAIN",
      file,
      field,
      "email field is not an explicit synthetic reserved value",
    );
  }
  if (!keyOnly && lastField === "phone" && !RESERVED_PHONE.test(value)) {
    addIssue(
      issues,
      "PRIVACY_PHONE",
      file,
      field,
      "phone field is not an explicit synthetic reserved value",
    );
  }
  if (!keyOnly && lastField === "line1" && !RESERVED_ADDRESS.test(value)) {
    addIssue(
      issues,
      "PRIVACY_ADDRESS",
      file,
      field,
      "address field is not an explicit synthetic reserved value",
    );
  }
}

/** Test-only deterministic seam for local-identity and scalar scanner cases. */
export function inspectPrivacyTextForTest(
  value: string,
  semanticField: string | undefined,
  localIdentityTokens: readonly string[],
): readonly PrivacyIssue[] {
  const issues: PrivacyIssue[] = [];
  inspectText(
    value,
    "@test",
    "/value",
    issues,
    semanticField,
    false,
    localIdentityTokens,
  );
  return issues;
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
  } else if (typeof value === "number" || typeof value === "boolean") {
    counters.fields += 1;
    const field = pointer === "" ? "/" : pointer;
    if (isSecretSemanticField(semanticField)) {
      addIssue(
        issues,
        "PRIVACY_SEMANTIC_CREDENTIAL",
        file,
        field,
        "credential-bearing semantic field is forbidden",
      );
    } else if (
      typeof value === "number" &&
      isSensitiveIdentifierField(semanticField) &&
      Number.isFinite(value) &&
      /^\d{8,}$/u.test(String(Math.abs(Math.trunc(value))))
    ) {
      addIssue(
        issues,
        "PRIVACY_SENSITIVE_IDENTIFIER",
        file,
        field,
        "long numeric value under a sensitive identifier field is forbidden",
      );
    } else if (
      typeof value === "number" &&
      normalizedSemanticField(semanticField ?? "") === "phone"
    ) {
      inspectText(String(value), file, field, issues, semanticField);
    }
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
      inspectText(key, file, `${pointer}/${safeKey}/@key`, issues, key, true);
      const inheritedSensitive =
        isSecretSemanticField(semanticField) ||
        isSensitiveIdentifierField(semanticField);
      const childSemantic =
        isSecretSemanticField(key) ||
        isSensitiveIdentifierField(key) ||
        !inheritedSensitive
          ? key
          : semanticField;
      inspectValue(
        item,
        file,
        `${pointer}/${safeKey}`,
        issues,
        counters,
        childSemantic,
      );
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
    inspectText(
      entry.name,
      displayPath(root, path),
      "/@path-segment",
      issues,
      "@filename",
    );
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
  let rootReal: string;
  try {
    rootReal = realpathSync(root);
  } catch {
    addIssue(
      issues,
      "PRIVACY_SCAN_IO",
      ".",
      "/",
      "scan root identity cannot be resolved",
    );
    return { valid: false, filesScanned: 0, fieldsScanned: 0, issues };
  }
  const files = walk(rootReal, rootReal, issues, excludedTopLevel);
  const counters = { fields: 0 };
  let scanned = 0;
  for (const filePath of files) {
    const file = displayPath(rootReal, filePath);
    let fileStats;
    try {
      fileStats = lstatSync(filePath);
    } catch {
      addIssue(
        issues,
        "PRIVACY_SCAN_IO",
        file,
        "/",
        "file identity cannot be sampled",
      );
      continue;
    }
    if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
      addIssue(
        issues,
        "PRIVACY_SCAN_SYMLINK",
        file,
        "/",
        "scanned entry is no longer a regular nonsymlink file",
      );
      continue;
    }
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
    let bytes: Buffer;
    try {
      bytes = readFileSync(filePath);
    } catch {
      addIssue(issues, "PRIVACY_SCAN_IO", file, "/", "file cannot be read");
      continue;
    }
    let afterStats;
    try {
      afterStats = lstatSync(filePath);
    } catch {
      addIssue(
        issues,
        "PRIVACY_SCAN_IO",
        file,
        "/",
        "file identity cannot be resampled",
      );
      continue;
    }
    if (
      afterStats.isSymbolicLink() ||
      !afterStats.isFile() ||
      afterStats.dev !== fileStats.dev ||
      afterStats.ino !== fileStats.ino ||
      afterStats.size !== fileStats.size ||
      afterStats.mtimeMs !== fileStats.mtimeMs
    ) {
      addIssue(
        issues,
        "PRIVACY_SCAN_IO",
        file,
        "/",
        "file identity changed during the bounded read",
      );
      continue;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
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
