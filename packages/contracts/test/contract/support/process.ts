import { spawnSync } from "node:child_process";

export type ProcessFailureCode =
  | "ADAPTER_EXIT_NONZERO"
  | "ADAPTER_MISSING"
  | "ADAPTER_OUTPUT_TOO_LARGE"
  | "ADAPTER_STDERR_NONEMPTY"
  | "ADAPTER_TIMEOUT"
  | "ADAPTER_UTF8_INVALID";

export class ProcessFailure extends Error {
  readonly code: ProcessFailureCode;

  constructor(code: ProcessFailureCode) {
    super(code);
    this.name = "ProcessFailure";
    this.code = code;
  }
}

export interface ChildSpec {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

/**
 * Run one bounded child with explicit argv and no shell.
 *
 * Stderr, OS errors, exit numbers, signals, executable paths, and hostile
 * values are intentionally not copied into the stable failure surface.
 */
export function runChild(spec: ChildSpec): string {
  const result = spawnSync(spec.executable, spec.args, {
    cwd: spec.cwd,
    shell: false,
    windowsHide: true,
    encoding: "buffer",
    timeout: spec.timeoutMs,
    maxBuffer: spec.maxOutputBytes,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error !== undefined) {
    const code =
      "code" in result.error && typeof result.error.code === "string"
        ? result.error.code
        : "";
    if (code === "ENOENT") {
      throw new ProcessFailure("ADAPTER_MISSING");
    }
    if (code === "ETIMEDOUT") {
      throw new ProcessFailure("ADAPTER_TIMEOUT");
    }
    if (code === "ENOBUFS") {
      throw new ProcessFailure("ADAPTER_OUTPUT_TOO_LARGE");
    }
    throw new ProcessFailure("ADAPTER_EXIT_NONZERO");
  }
  if (result.status !== 0) {
    throw new ProcessFailure("ADAPTER_EXIT_NONZERO");
  }
  if (result.stderr.byteLength !== 0) {
    throw new ProcessFailure("ADAPTER_STDERR_NONEMPTY");
  }
  const stdout = result.stdout;
  if (stdout.byteLength > spec.maxOutputBytes) {
    throw new ProcessFailure("ADAPTER_OUTPUT_TOO_LARGE");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(stdout);
  } catch {
    throw new ProcessFailure("ADAPTER_UTF8_INVALID");
  }
}
