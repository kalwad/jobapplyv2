import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { CORPUS_ROOT, loadCorpus } from "./adapters/corpus-loader.ts";
import {
  ADAPTER_PROTOCOL_VERSION,
  type AdapterBatchResponse,
  type AdapterResult,
} from "./adapters/protocol.ts";
import {
  buildCompatibilitySignature,
  compareCompatibilitySignatures,
} from "./breaking/compatibility-signature.ts";
import { loadBaseline } from "./breaking/baseline.ts";
import { ProcessFailure, runChild } from "./support/process.ts";
import {
  assertLanguageAgreement,
  validateAdapterResponse,
} from "./support/response.ts";

const CONTRACT_ROOT = fileURLToPath(new URL(".", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const FAKE_ADAPTER = join(CONTRACT_ROOT, "fixtures", "fake-adapter.ts");

function processCode(mode: string): string {
  try {
    runChild({
      executable: process.execPath,
      args: [FAKE_ADAPTER, mode],
      cwd: REPOSITORY_ROOT,
      timeoutMs: mode === "timeout" ? 50 : 5_000,
      maxOutputBytes: 8_192,
    });
    return "NO_FAILURE";
  } catch (error) {
    return error instanceof ProcessFailure ? error.code : "WRONG_FAILURE";
  }
}

function result(overrides: Partial<AdapterResult> = {}): AdapterResult {
  return {
    case_id: "case.a",
    operation: "VALIDATE",
    validation_verdict: "VALID",
    canonical_json: '{"a":1}',
    ...overrides,
  };
}

function response(results: readonly AdapterResult[]): string {
  const value: AdapterBatchResponse = {
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    language: "typescript",
    results,
  };
  return `${JSON.stringify(value)}\n`;
}

describe("contract compatibility infrastructure fails closed", () => {
  test("missing, nonzero, timed-out, and malformed adapters are rejected", () => {
    expect(processCode("nonzero")).toBe("ADAPTER_EXIT_NONZERO");
    expect(processCode("timeout")).toBe("ADAPTER_TIMEOUT");
    expect(processCode("stderr")).toBe("ADAPTER_STDERR_NONEMPTY");
    expect(() =>
      validateAdapterResponse(
        runChild({
          executable: process.execPath,
          args: [FAKE_ADAPTER, "malformed"],
          cwd: REPOSITORY_ROOT,
          timeoutMs: 5_000,
          maxOutputBytes: 8_192,
        }),
        "typescript",
        ["case.a"],
      ),
    ).toThrow(expect.objectContaining({ code: "ADAPTER_MALFORMED_OUTPUT" }));
  });

  test("successful build-tool stderr requires an explicit opt-in", () => {
    expect(
      runChild({
        executable: process.execPath,
        args: [FAKE_ADAPTER, "stderr"],
        cwd: REPOSITORY_ROOT,
        timeoutMs: 5_000,
        maxOutputBytes: 8_192,
        allowStderr: true,
      }),
    ).toBe("{}\n");
  });

  test("a missing executable has a stable missing-adapter code", () => {
    expect(() =>
      runChild({
        executable: join(CONTRACT_ROOT, "definitely-missing-adapter"),
        args: [],
        cwd: CONTRACT_ROOT,
        timeoutMs: 1_000,
        maxOutputBytes: 8_192,
      }),
    ).toThrow(expect.objectContaining({ code: "ADAPTER_MISSING" }));
  });

  test("a Rust adapter that does not compile fails the subprocess boundary", () => {
    const root = mkdtempSync(join(tmpdir(), "japp-rust-negative-"));
    try {
      const source = join(root, "main.rs");
      writeFileSync(source, "not rust source\n");
      // This assertion is about the bounded child-process mapping for a
      // noncompiling Rust source. Invoking rustc directly preserves that
      // boundary without adding Cargo's coordinator/descendant lifetime,
      // which can outlive a timed-out spawnSync call on Windows.
      expect(() =>
        runChild({
          executable: "rustc",
          args: [
            "--crate-name",
            "compile_negative",
            "--edition=2024",
            "--emit=metadata",
            source,
          ],
          cwd: root,
          timeoutMs: 30_000,
          maxOutputBytes: 128 * 1024,
        }),
      ).toThrow(expect.objectContaining({ code: "ADAPTER_EXIT_NONZERO" }));
    } finally {
      // Windows may release a just-exited compiler's handles asynchronously.
      // The documented bounded retries preserve mandatory cleanup without
      // weakening its failure behavior.
      rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    }
  }, 45_000);

  test("omitted, duplicate, and wrong case IDs fail inventory validation", () => {
    expect(() =>
      validateAdapterResponse(response([result()]), "typescript", [
        "case.a",
        "case.b",
      ]),
    ).toThrow(expect.objectContaining({ code: "ADAPTER_CASE_MISSING" }));
    expect(() =>
      validateAdapterResponse(response([result(), result()]), "typescript", [
        "case.a",
      ]),
    ).toThrow(expect.objectContaining({ code: "ADAPTER_CASE_DUPLICATE" }));
    expect(() =>
      validateAdapterResponse(
        response([result({ case_id: "case.wrong" })]),
        "typescript",
        ["case.a"],
      ),
    ).toThrow(expect.objectContaining({ code: "ADAPTER_CASE_UNEXPECTED" }));
  });

  test("verdict, normalization, and authorization-code disagreement fail", () => {
    expect(() => {
      assertLanguageAgreement(
        result(),
        result({ validation_verdict: "INVALID" }),
      );
    }).toThrow(expect.objectContaining({ code: "VERDICT_DISAGREEMENT" }));
    expect(() => {
      assertLanguageAgreement(result(), result({ canonical_json: '{"a":2}' }));
    }).toThrow(
      expect.objectContaining({ code: "NORMALIZED_OUTPUT_DISAGREEMENT" }),
    );
    expect(() => {
      assertLanguageAgreement(
        result({
          operation: "AUTHORIZE",
          authorization_outcome: "DENY",
          error_code: "E_AUTH_CAPABILITY_DENIED",
        }),
        result({
          operation: "AUTHORIZE",
          authorization_outcome: "DENY",
          error_code: "E_AUTH_TARGET_MISMATCH",
        }),
      );
    }).toThrow(
      expect.objectContaining({
        code: "AUTHORIZATION_CODE_DISAGREEMENT",
      }),
    );
  });

  test("wrong corpus hash and unmanifested corpus files fail loading", () => {
    for (const mutation of ["hash", "extra"] as const) {
      const root = mkdtempSync(join(tmpdir(), "japp-corpus-negative-"));
      try {
        cpSync(CORPUS_ROOT, root, { recursive: true });
        if (mutation === "hash") {
          const path = join(root, "manifest.v1.json");
          const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<
            string,
            unknown
          >;
          manifest.manifest_sha256 = "0".repeat(64);
          writeFileSync(path, `${JSON.stringify(manifest)}\n`, "utf8");
        } else {
          writeFileSync(join(root, "unmanifested.json"), "{}\n", "utf8");
        }
        expect(() => loadCorpus(root)).toThrow();
      } finally {
        // Windows releases the file handles a just-exited child held
        // asynchronously, so an immediate recursive remove can still hit EPERM
        // or EBUSY on a directory an external toolchain wrote. maxRetries is
        // Node's documented mechanism for exactly that; the removal must still
        // succeed, so nothing here is weakened.
        rmSync(root, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 100,
        });
      }
    }
  });

  test("a representative breaking mutation fails compatibility", () => {
    const current = buildCompatibilitySignature();
    const command = current.commands[0];
    if (command === undefined) {
      throw new Error("command signature missing");
    }
    command.max_encoded_payload_size_bytes -= 1;
    const report = compareCompatibilitySignatures(
      loadBaseline().signature,
      current,
    );
    expect(report.compatible).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain(
      "PAYLOAD_LIMIT_REDUCED",
    );
  });
});
