import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";

import {
  evaluateVersionCompatibility,
  validateEnvelopedRecord,
} from "../../../src/index.ts";
import {
  CONTRACT_SCHEMA_REFS,
  authorizeCommandRequestV1,
  contractRuntime,
  requireErrorCatalogEntryV1,
  validateContractInstance,
  type GeneratedTypeByRef,
} from "../../../generated/typescript/index.ts";
import {
  BoundaryError,
  canonicalJson,
  snapshotPlainJson,
  type PlainJson,
} from "./normalization.ts";
import { parseRawJson } from "./raw-json.ts";
import {
  ADAPTER_OPERATIONS,
  ADAPTER_PROTOCOL_VERSION,
  MAX_ADAPTER_CASES,
  MAX_PROTOCOL_BYTES,
  type AdapterBatchRequest,
  type AdapterBatchResponse,
  type AdapterOperation,
  type AdapterRequest,
  type AdapterResult,
} from "./protocol.ts";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SCHEMA_REF_SET = new Set<string>(CONTRACT_SCHEMA_REFS);
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

class ProtocolError extends Error {
  constructor() {
    super("PROTOCOL_REJECTED");
    this.name = "ProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => key in value) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function decodeBase64(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !BASE64_PATTERN.test(value)
  ) {
    throw new ProtocolError();
  }
  return Buffer.from(value, "base64");
}

function parseBatch(path: string): AdapterBatchRequest {
  const bytes = readFileSync(path);
  if (bytes.byteLength > MAX_PROTOCOL_BYTES) {
    throw new ProtocolError();
  }
  const parsed = parseRawJson(bytes, MAX_PROTOCOL_BYTES);
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["protocol_version", "requests"]) ||
    parsed.protocol_version !== ADAPTER_PROTOCOL_VERSION ||
    !Array.isArray(parsed.requests) ||
    parsed.requests.length === 0 ||
    parsed.requests.length > MAX_ADAPTER_CASES
  ) {
    throw new ProtocolError();
  }
  const seen = new Set<string>();
  let previous = "";
  for (const rawRequest of parsed.requests) {
    if (
      !isRecord(rawRequest) ||
      !exactKeys(
        rawRequest,
        ["case_id", "schema_ref", "operation", "input_bytes_base64"],
        ["scenario", "trusted_context_bytes_base64"],
      ) ||
      typeof rawRequest.case_id !== "string" ||
      rawRequest.case_id.length === 0 ||
      seen.has(rawRequest.case_id) ||
      (previous !== "" && previous >= rawRequest.case_id) ||
      typeof rawRequest.schema_ref !== "string" ||
      !ADAPTER_OPERATIONS.includes(rawRequest.operation as AdapterOperation) ||
      typeof rawRequest.input_bytes_base64 !== "string" ||
      ("trusted_context_bytes_base64" in rawRequest &&
        typeof rawRequest.trusted_context_bytes_base64 !== "string") ||
      ("scenario" in rawRequest && typeof rawRequest.scenario !== "string")
    ) {
      throw new ProtocolError();
    }
    decodeBase64(rawRequest.input_bytes_base64);
    if (typeof rawRequest.trusted_context_bytes_base64 === "string") {
      decodeBase64(rawRequest.trusted_context_bytes_base64);
    }
    seen.add(rawRequest.case_id);
    previous = rawRequest.case_id;
  }
  return parsed as unknown as AdapterBatchRequest;
}

function invalidResult(
  request: AdapterRequest,
  errorCategory: string,
): AdapterResult {
  return {
    case_id: request.case_id,
    operation: request.operation,
    validation_verdict: "INVALID",
    error_category: errorCategory,
  };
}

function knownSchemaRef(ref: string): ref is keyof GeneratedTypeByRef {
  return SCHEMA_REF_SET.has(ref);
}

function scenarioValue(
  scenario: string | undefined,
  parsed: PlainJson,
): unknown {
  if (scenario === undefined) {
    return parsed;
  }
  if (!isRecord(parsed)) {
    throw new BoundaryError("MALFORMED_OBJECT");
  }
  if (scenario === "ACCESSOR") {
    const value = { ...parsed };
    Object.defineProperty(value, "note", {
      enumerable: true,
      get(): never {
        throw new Error("must not execute");
      },
    });
    return value;
  }
  if (scenario === "PROXY") {
    return new Proxy(parsed, {
      ownKeys(): never {
        throw new Error("must not execute");
      },
    });
  }
  if (scenario === "SYMBOL") {
    const value: Record<PropertyKey, unknown> = { ...parsed };
    value[Symbol("not-json")] = "not-json";
    return value;
  }
  if (scenario === "UNUSUAL_PROTOTYPE") {
    const value = { ...parsed };
    Object.setPrototypeOf(value, { synthetic: true });
    return value;
  }
  if (scenario === "LIVE_MUTATION") {
    const source = { ...parsed };
    const detached = snapshotPlainJson(source);
    source.status = "MUTATED_AFTER_SNAPSHOT";
    return detached;
  }
  throw new ProtocolError();
}

function validateOrRoundTrip(
  request: AdapterRequest,
  value: PlainJson,
): AdapterResult {
  if (
    request.schema_ref.startsWith("http:") ||
    request.schema_ref.startsWith("https:")
  ) {
    return invalidResult(request, "REMOTE_SCHEMA_REFERENCE");
  }
  if (!knownSchemaRef(request.schema_ref)) {
    return invalidResult(request, "UNKNOWN_SCHEMA_REFERENCE");
  }
  const result = validateContractInstance(request.schema_ref, value);
  if (!result.valid) {
    return invalidResult(request, "SCHEMA_INVALID");
  }
  return {
    case_id: request.case_id,
    operation: request.operation,
    validation_verdict: "VALID",
    ...(request.operation === "ROUND_TRIP"
      ? { canonical_json: canonicalJson(result.value) }
      : {}),
  };
}

function versionResult(
  request: AdapterRequest,
  value: PlainJson,
): AdapterResult {
  if (!isRecord(value) || !isRecord(value.envelope)) {
    return {
      ...invalidResult(request, "SCHEMA_INVALID"),
      version_outcome: "MALFORMED_VERSION",
    };
  }
  const schemaId = value.envelope.schema_id;
  const declared = value.envelope.schema_version;
  if (typeof declared !== "string" || !SEMVER_PATTERN.test(declared)) {
    return {
      ...invalidResult(request, "SCHEMA_INVALID"),
      version_outcome: "MALFORMED_VERSION",
    };
  }
  if (typeof schemaId !== "string") {
    return {
      ...invalidResult(request, "SCHEMA_INVALID"),
      version_outcome: "UNKNOWN_SCHEMA_ID",
    };
  }
  const runtime = contractRuntime();
  const entry = runtime.catalog.byId.get(schemaId);
  if (entry === undefined) {
    return {
      ...invalidResult(request, "UNKNOWN_SCHEMA_REFERENCE"),
      version_outcome: "UNKNOWN_SCHEMA_ID",
    };
  }
  const version = evaluateVersionCompatibility(declared, entry.version);
  if (version.outcome === "REJECTED_MALFORMED") {
    return {
      ...invalidResult(request, "SCHEMA_INVALID"),
      version_outcome: "MALFORMED_VERSION",
    };
  }
  if (version.outcome === "REJECTED_UNKNOWN_MAJOR") {
    return {
      ...invalidResult(request, "VERSION_REJECTED"),
      version_outcome: "UNKNOWN_MAJOR_VERSION",
    };
  }
  if (version.outcome === "UPGRADE_REQUIRED_NEWER_MINOR") {
    return {
      ...invalidResult(request, "VERSION_REJECTED"),
      version_outcome: "UPGRADE_REQUIRED_NEWER_MINOR",
    };
  }
  const result = validateEnvelopedRecord(value, runtime);
  if (!result.valid) {
    return {
      ...invalidResult(request, "SCHEMA_INVALID"),
      version_outcome:
        result.reason === "PAYLOAD_INVALID"
          ? "PAYLOAD_INVALID"
          : "MALFORMED_VERSION",
    };
  }
  return {
    case_id: request.case_id,
    operation: request.operation,
    validation_verdict: "VALID",
    version_outcome: "COMPATIBLE",
    canonical_json: canonicalJson(value),
  };
}

function authorizationResult(
  request: AdapterRequest,
  value: PlainJson,
): AdapterResult {
  let context: PlainJson;
  try {
    if (request.trusted_context_bytes_base64 === undefined) {
      throw new BoundaryError("MALFORMED_JSON");
    }
    context = parseRawJson(decodeBase64(request.trusted_context_bytes_base64));
  } catch (error) {
    if (!(error instanceof BoundaryError)) {
      throw error;
    }
    requireErrorCatalogEntryV1("TRANSPORT_MALFORMED_MESSAGE");
    return {
      case_id: request.case_id,
      operation: request.operation,
      validation_verdict: "INVALID",
      authorization_outcome: "DENY",
      error_category: "AUTHORIZATION_DENIED",
      error_code: "TRANSPORT_MALFORMED_MESSAGE",
    };
  }
  const schemaValidation = knownSchemaRef(request.schema_ref)
    ? validateContractInstance(request.schema_ref, value)
    : null;
  const normalized =
    schemaValidation?.valid === true
      ? canonicalJson(schemaValidation.value)
      : undefined;
  const outcome = authorizeCommandRequestV1(value, context);
  if (!outcome.authorized) {
    // Exercise the generated M01-W03 lookup and prove every denial remains a
    // canonical code without returning its message or hostile input.
    requireErrorCatalogEntryV1(outcome.error_code);
    return {
      case_id: request.case_id,
      operation: request.operation,
      validation_verdict:
        schemaValidation?.valid === true ? "VALID" : "INVALID",
      authorization_outcome: "DENY",
      error_category: "AUTHORIZATION_DENIED",
      error_code: outcome.error_code,
      ...(normalized === undefined ? {} : { canonical_json: normalized }),
    };
  }
  return {
    case_id: request.case_id,
    operation: request.operation,
    validation_verdict: "VALID",
    authorization_outcome: "ALLOW",
    ...(normalized === undefined ? {} : { canonical_json: normalized }),
  };
}

function processRequest(request: AdapterRequest): AdapterResult {
  let parsed: PlainJson;
  try {
    parsed = parseRawJson(decodeBase64(request.input_bytes_base64));
    parsed = snapshotPlainJson(scenarioValue(request.scenario, parsed));
  } catch (error) {
    if (error instanceof BoundaryError) {
      if (request.operation === "AUTHORIZE") {
        requireErrorCatalogEntryV1("TRANSPORT_MALFORMED_MESSAGE");
        return {
          ...invalidResult(request, error.category),
          authorization_outcome: "DENY",
          error_code: "TRANSPORT_MALFORMED_MESSAGE",
        };
      }
      return invalidResult(request, error.category);
    }
    throw error;
  }
  if (request.operation === "AUTHORIZE") {
    return authorizationResult(request, parsed);
  }
  if (request.operation === "VERSION_CHECK") {
    return versionResult(request, parsed);
  }
  return validateOrRoundTrip(request, parsed);
}

function requestPath(): string {
  if (
    process.argv.length !== 4 ||
    process.argv[2] !== "--request" ||
    process.argv[3] === undefined
  ) {
    throw new ProtocolError();
  }
  return process.argv[3];
}

function main(): void {
  const batch = parseBatch(requestPath());
  const response: AdapterBatchResponse = {
    protocol_version: ADAPTER_PROTOCOL_VERSION,
    language: "typescript",
    results: batch.requests.map((request) => processRequest(request)),
  };
  const output = canonicalJson(response);
  if (Buffer.byteLength(output, "utf8") > MAX_PROTOCOL_BYTES) {
    throw new ProtocolError();
  }
  process.stdout.write(`${output}\n`);
}

try {
  main();
} catch {
  process.exitCode = 2;
}
