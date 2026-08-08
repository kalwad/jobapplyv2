import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  type Stats,
} from "node:fs";
import { isAbsolute, join, relative, sep, win32 } from "node:path";

import { runnerFail } from "./errors.ts";
import type { ExecutionRequestV1 } from "./model.ts";
import { parseCanonicalExecutionRequestJson } from "./validate.ts";

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

export function validateLocalArtifactReference(reference: string): string {
  if (
    reference.length < 1 ||
    reference.length > 240 ||
    isAbsolute(reference) ||
    win32.isAbsolute(reference) ||
    reference.includes("\\") ||
    reference.includes(":") ||
    reference.includes("%") ||
    reference.includes("~") ||
    reference.startsWith("//") ||
    reference !== reference.normalize("NFC")
  ) {
    return runnerFail(
      "RUNNER_LOCAL_REFERENCE",
      "/path",
      "local artifact reference cannot be absolute, remote, drive-qualified, or backslash-delimited",
    );
  }
  const parts = reference.split("/");
  if (
    parts.some(
      (part) =>
        part === "" ||
        part === "." ||
        part === ".." ||
        /[ .]$/u.test(part) ||
        /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(part) ||
        containsControlOrHidden(part),
    )
  ) {
    return runnerFail(
      "RUNNER_LOCAL_REFERENCE",
      "/path",
      "local artifact reference contains traversal or an unsafe segment",
    );
  }
  return parts.join("/");
}

function containsControlOrHidden(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint <= 0x1f ||
      codePoint === 0x7f ||
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

function checkedMetadata(
  path: string,
  pointer: string,
  kind: "directory" | "file",
): Stats {
  let metadata: Stats;
  try {
    metadata = lstatSync(path);
  } catch {
    return runnerFail(
      "RUNNER_INPUT_MISSING",
      pointer,
      `${kind} does not exist`,
    );
  }
  if (metadata.isSymbolicLink()) {
    return runnerFail(
      "RUNNER_INPUT_SYMLINK",
      pointer,
      "symbolic links are forbidden at the request-file boundary",
    );
  }
  if (
    (kind === "directory" && !metadata.isDirectory()) ||
    (kind === "file" && !metadata.isFile())
  ) {
    return runnerFail(
      "RUNNER_INPUT_FILE_TYPE",
      pointer,
      `expected a regular ${kind}`,
    );
  }
  return metadata;
}

function sameIdentity(left: Stats, right: Stats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size
  );
}

export function loadCanonicalExecutionRequestFile(
  root: string,
  localReference: string,
): ExecutionRequestV1 {
  const reference = validateLocalArtifactReference(localReference);
  const rootIdentity = checkedMetadata(root, "/root", "directory");
  const canonicalRoot = realpathSync(root);
  let cursor = canonicalRoot;
  const parts = reference.split("/");
  for (const [index, part] of parts.entries()) {
    cursor = join(cursor, part);
    checkedMetadata(
      cursor,
      `/path/${parts.slice(0, index + 1).join("/")}`,
      index === parts.length - 1 ? "file" : "directory",
    );
  }
  const canonicalFile = realpathSync(cursor);
  const relativePath = relative(canonicalRoot, canonicalFile);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return runnerFail(
      "RUNNER_INPUT_ESCAPE",
      "/path",
      "request file resolves outside its declared local root",
    );
  }
  const metadata = checkedMetadata(canonicalFile, "/path", "file");
  if (metadata.size > MAX_REQUEST_BYTES) {
    return runnerFail(
      "RUNNER_INPUT_TOO_LARGE",
      "/path",
      "request file exceeds the 8 MiB boundary",
    );
  }
  let descriptor: number;
  try {
    descriptor = openSync(canonicalFile, "r");
  } catch {
    return runnerFail(
      "RUNNER_INPUT_READ",
      "/path",
      "request file could not be opened",
    );
  }
  let bytes: Buffer;
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || !sameIdentity(metadata, opened)) {
      return runnerFail(
        "RUNNER_INPUT_CHANGED",
        "/path",
        "opened request differs from the validated regular-file identity",
      );
    }
    bytes = Buffer.alloc(metadata.size);
    let offset = 0;
    try {
      while (offset < bytes.length) {
        const count = readSync(
          descriptor,
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (count === 0) {
          break;
        }
        offset += count;
      }
    } catch {
      return runnerFail(
        "RUNNER_INPUT_READ",
        "/path",
        "request file could not be read",
      );
    }
    const after = fstatSync(descriptor);
    if (offset !== bytes.length || !sameIdentity(opened, after)) {
      return runnerFail(
        "RUNNER_INPUT_CHANGED",
        "/path",
        "request file identity or size changed during the bounded read",
      );
    }
  } finally {
    closeSync(descriptor);
  }
  const rootAfter = checkedMetadata(root, "/root", "directory");
  if (!sameIdentity(rootIdentity, rootAfter)) {
    return runnerFail(
      "RUNNER_INPUT_CHANGED",
      "/root",
      "request root identity changed during the bounded read",
    );
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return runnerFail(
      "RUNNER_INPUT_ENCODING",
      "/path",
      "request file is not strict UTF-8 text",
    );
  }
  return parseCanonicalExecutionRequestJson(source);
}
