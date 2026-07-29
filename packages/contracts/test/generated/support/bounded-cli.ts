import { spawnSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export interface CliResult {
  readonly status: number;
  readonly output: string;
}

export class CliProcessFailure extends Error {
  readonly code:
    "CLI_TIMEOUT" | "CLI_OUTPUT_TOO_LARGE" | "CLI_EXECUTION_FAILED";

  constructor(code: CliProcessFailure["code"]) {
    super(code);
    this.name = "CliProcessFailure";
    this.code = code;
  }
}

interface CliOptions {
  readonly timeoutMs?: number;
}

/**
 * Execute one test-only CLI with an explicit child deadline and output bound.
 *
 * Expected nonzero exits are returned to the caller. Infrastructure failures,
 * timeouts, signals, and output overflow throw stable fail-closed errors.
 */
export function runBoundedCliProcess(
  executable: string,
  args: readonly string[],
  cwd: string,
  options: CliOptions = {},
): CliResult {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > DEFAULT_TIMEOUT_MS
  ) {
    throw new CliProcessFailure("CLI_EXECUTION_FAILED");
  }

  const result = spawnSync(executable, [...args], {
    cwd,
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error !== undefined) {
    const code =
      "code" in result.error && typeof result.error.code === "string"
        ? result.error.code
        : "";
    if (code === "ETIMEDOUT") {
      throw new CliProcessFailure("CLI_TIMEOUT");
    }
    if (code === "ENOBUFS") {
      throw new CliProcessFailure("CLI_OUTPUT_TOO_LARGE");
    }
    throw new CliProcessFailure("CLI_EXECUTION_FAILED");
  }
  if (result.status === null) {
    throw new CliProcessFailure("CLI_EXECUTION_FAILED");
  }

  const output =
    result.status === 0 ? result.stdout : `${result.stdout}${result.stderr}`;
  if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) {
    throw new CliProcessFailure("CLI_OUTPUT_TOO_LARGE");
  }
  return { status: result.status, output };
}
