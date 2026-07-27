import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import { canonicalJson, type PlainJson } from "./adapters/normalization.ts";
import {
  ADAPTER_PROTOCOL_VERSION,
  type AdapterBatchRequest,
  type AdapterBatchResponse,
  type AdapterRequest,
} from "./adapters/protocol.ts";
import { runChild } from "./support/process.ts";
import { resultMap, validateAdapterResponse } from "./support/response.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const TYPESCRIPT_ADAPTER = fileURLToPath(
  new URL("./adapters/typescript-adapter.ts", import.meta.url),
);
const FIELD_ADDRESS_REF = "urn:japp:schema:form:field-address:v1";
const ENVELOPED_RECORD_REF =
  "urn:japp:schema:common:envelope:v1#/$defs/envelopedRecord";
const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const temporaryRoots: string[] = [];

function fieldAddress(): Record<string, PlainJson> {
  return {
    address_schema_version: "FIELD_ADDRESS_V1",
    session_id: "ses_0123456789ABCDEFGHJKMNPQRS",
    frame_id: "frm_0123456789ABCDEFGHJKMNPQRS",
    document_id: "doc_0123456789ABCDEFGHJKMNPQRS",
    ats_family: "WORKDAY",
    route_signature: DIGEST_A,
    application_root_fingerprint: DIGEST_B,
    section_path: [],
    repeater_path: [],
    resolution_hints: [],
    observed_dom_generation: 1,
  };
}

function encoded(value: PlainJson): string {
  return Buffer.from(canonicalJson(value), "utf8").toString("base64");
}

function request(
  caseId: string,
  schemaRef: string,
  operation: AdapterRequest["operation"],
  value: PlainJson,
): AdapterRequest {
  return {
    case_id: caseId,
    schema_ref: schemaRef,
    operation,
    input_bytes_base64: encoded(value),
  };
}

function runTypeScript(
  requests: readonly AdapterRequest[],
): AdapterBatchResponse {
  const root = mkdtempSync(join(tmpdir(), "japp-semantic-ts-"));
  temporaryRoots.push(root);
  const path = join(root, "request.json");
  const batch: AdapterBatchRequest = {
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    requests,
  };
  writeFileSync(path, `${canonicalJson(batch)}\n`);
  const output = runChild({
    executable: process.execPath,
    args: [TYPESCRIPT_ADAPTER, "--request", path],
    cwd: REPOSITORY_ROOT,
    timeoutMs: 30_000,
    maxOutputBytes: 1024 * 1024,
  });
  return validateAdapterResponse(
    output,
    "typescript",
    requests.map((item) => item.case_id),
  );
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("TypeScript adapter semantic validation", () => {
  test("runs structural validation before finite semantic rules for all bounded operations", () => {
    const valid = fieldAddress();
    const structuralInvalid = {
      ...fieldAddress(),
      observed_dom_generation: -1,
    };
    const semanticInvalid = { ...fieldAddress() };
    Reflect.deleteProperty(semanticInvalid, "application_root_fingerprint");
    const semanticEnvelope: PlainJson = {
      envelope: {
        schema_id: FIELD_ADDRESS_REF,
        schema_version: "1.0.0",
        message_id: "msg_0123456789ABCDEFGHJKMNPQRS",
        created_at: "2026-07-27T12:00:00Z",
      },
      payload: semanticInvalid,
    };
    const response = runTypeScript([
      request(
        "semantic.round-trip-valid",
        FIELD_ADDRESS_REF,
        "ROUND_TRIP",
        valid,
      ),
      request(
        "semantic.structural-invalid",
        FIELD_ADDRESS_REF,
        "VALIDATE",
        structuralInvalid,
      ),
      request(
        "semantic.validate-invalid",
        FIELD_ADDRESS_REF,
        "VALIDATE",
        semanticInvalid,
      ),
      request(
        "semantic.version-invalid",
        ENVELOPED_RECORD_REF,
        "VERSION_CHECK",
        semanticEnvelope,
      ),
    ]);
    const results = resultMap(response);

    expect(results.get("semantic.round-trip-valid")).toEqual({
      case_id: "semantic.round-trip-valid",
      operation: "ROUND_TRIP",
      validation_verdict: "VALID",
      canonical_json: canonicalJson(valid),
    });
    expect(results.get("semantic.structural-invalid")).toEqual({
      case_id: "semantic.structural-invalid",
      operation: "VALIDATE",
      validation_verdict: "INVALID",
      error_category: "SCHEMA_INVALID",
    });
    expect(results.get("semantic.validate-invalid")).toEqual({
      case_id: "semantic.validate-invalid",
      operation: "VALIDATE",
      validation_verdict: "INVALID",
      error_category: "SEMANTIC_INVALID",
      error_code: "SITE_AMBIGUOUS_CONTROL",
    });
    expect(results.get("semantic.version-invalid")).toEqual({
      case_id: "semantic.version-invalid",
      operation: "VERSION_CHECK",
      validation_verdict: "INVALID",
      error_category: "SEMANTIC_INVALID",
      error_code: "SITE_AMBIGUOUS_CONTROL",
      version_outcome: "PAYLOAD_INVALID",
    });
  });
});
