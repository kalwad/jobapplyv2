import {
  ADAPTER_LANGUAGES,
  ADAPTER_OPERATIONS,
  ADAPTER_PROTOCOL_VERSION,
  MAX_ADAPTER_CASES,
  MAX_PROTOCOL_BYTES,
  type AdapterBatchResponse,
  type AdapterLanguage,
  type AdapterOperation,
  type AdapterResult,
} from "../adapters/protocol.ts";
import { parseRawJson } from "../adapters/raw-json.ts";

export type ResponseFailureCode =
  | "ADAPTER_CASE_DUPLICATE"
  | "ADAPTER_CASE_MISSING"
  | "ADAPTER_CASE_UNEXPECTED"
  | "ADAPTER_LANGUAGE_MISMATCH"
  | "ADAPTER_MALFORMED_OUTPUT"
  | "AUTHORIZATION_CODE_DISAGREEMENT"
  | "NORMALIZED_OUTPUT_DISAGREEMENT"
  | "VERDICT_DISAGREEMENT";

export class ResponseFailure extends Error {
  readonly code: ResponseFailureCode;

  constructor(code: ResponseFailureCode) {
    super(code);
    this.name = "ResponseFailure";
    this.code = code;
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

export function validateAdapterResponse(
  output: string,
  language: AdapterLanguage,
  expectedCaseIds: readonly string[],
): AdapterBatchResponse {
  let parsed: unknown;
  try {
    parsed = parseRawJson(Buffer.from(output, "utf8"), MAX_PROTOCOL_BYTES);
  } catch {
    throw new ResponseFailure("ADAPTER_MALFORMED_OUTPUT");
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["protocol_version", "language", "results"]) ||
    parsed.protocol_version !== ADAPTER_PROTOCOL_VERSION ||
    parsed.language !== language ||
    !ADAPTER_LANGUAGES.includes(parsed.language as AdapterLanguage) ||
    !Array.isArray(parsed.results) ||
    parsed.results.length === 0 ||
    parsed.results.length > MAX_ADAPTER_CASES
  ) {
    throw new ResponseFailure(
      parsed !== null &&
        isRecord(parsed) &&
        typeof parsed.language === "string" &&
        parsed.language !== language
        ? "ADAPTER_LANGUAGE_MISMATCH"
        : "ADAPTER_MALFORMED_OUTPUT",
    );
  }
  const seen = new Set<string>();
  let previous = "";
  for (const candidate of parsed.results) {
    if (
      !isRecord(candidate) ||
      !exactKeys(
        candidate,
        ["case_id", "operation", "validation_verdict"],
        [
          "authorization_outcome",
          "canonical_json",
          "error_category",
          "error_code",
          "version_outcome",
        ],
      ) ||
      typeof candidate.case_id !== "string" ||
      candidate.case_id.length === 0 ||
      typeof candidate.operation !== "string" ||
      !ADAPTER_OPERATIONS.includes(candidate.operation as AdapterOperation) ||
      (candidate.validation_verdict !== "VALID" &&
        candidate.validation_verdict !== "INVALID") ||
      ("canonical_json" in candidate &&
        typeof candidate.canonical_json !== "string") ||
      ("error_category" in candidate &&
        typeof candidate.error_category !== "string") ||
      ("version_outcome" in candidate &&
        typeof candidate.version_outcome !== "string") ||
      ("authorization_outcome" in candidate &&
        candidate.authorization_outcome !== "ALLOW" &&
        candidate.authorization_outcome !== "DENY") ||
      ("error_code" in candidate && typeof candidate.error_code !== "string")
    ) {
      throw new ResponseFailure("ADAPTER_MALFORMED_OUTPUT");
    }
    if (seen.has(candidate.case_id)) {
      throw new ResponseFailure("ADAPTER_CASE_DUPLICATE");
    }
    if (previous !== "" && previous >= candidate.case_id) {
      throw new ResponseFailure("ADAPTER_MALFORMED_OUTPUT");
    }
    seen.add(candidate.case_id);
    previous = candidate.case_id;
  }
  const expected = new Set(expectedCaseIds);
  if ([...seen].some((caseId) => !expected.has(caseId))) {
    throw new ResponseFailure("ADAPTER_CASE_UNEXPECTED");
  }
  if ([...expected].some((caseId) => !seen.has(caseId))) {
    throw new ResponseFailure("ADAPTER_CASE_MISSING");
  }
  return parsed as unknown as AdapterBatchResponse;
}

export function resultMap(
  response: AdapterBatchResponse,
): ReadonlyMap<string, AdapterResult> {
  return new Map(response.results.map((result) => [result.case_id, result]));
}

/**
 * Compare only cross-language semantics, never library-specific diagnostics.
 */
export function assertLanguageAgreement(
  left: AdapterResult,
  right: AdapterResult,
): void {
  if (
    left.operation !== right.operation ||
    left.validation_verdict !== right.validation_verdict ||
    left.version_outcome !== right.version_outcome ||
    left.authorization_outcome !== right.authorization_outcome
  ) {
    throw new ResponseFailure("VERDICT_DISAGREEMENT");
  }
  if (left.canonical_json !== right.canonical_json) {
    throw new ResponseFailure("NORMALIZED_OUTPUT_DISAGREEMENT");
  }
  if (left.error_code !== right.error_code) {
    throw new ResponseFailure("AUTHORIZATION_CODE_DISAGREEMENT");
  }
  if (left.error_category !== right.error_category) {
    throw new ResponseFailure("VERDICT_DISAGREEMENT");
  }
}
