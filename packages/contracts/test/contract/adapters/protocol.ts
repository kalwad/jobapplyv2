/**
 * Versioned, bounded protocol shared by the three M01-W05 test adapters.
 *
 * The protocol deliberately carries every untrusted instance as base64 raw
 * bytes. That preserves malformed UTF-8, duplicate keys, and numeric wire
 * forms until each language's fail-closed raw boundary has examined them.
 */

export const ADAPTER_PROTOCOL_VERSION = "JAPP_CONTRACT_ADAPTER_V1";
export const MAX_ADAPTER_CASES = 256;
export const MAX_PROTOCOL_BYTES = 4 * 1024 * 1024;
export const MAX_RAW_INPUT_BYTES = 1024 * 1024;
export const MAX_JSON_DEPTH = 64;

export const ADAPTER_LANGUAGES = ["python", "rust", "typescript"] as const;
export type AdapterLanguage = (typeof ADAPTER_LANGUAGES)[number];

export const ADAPTER_OPERATIONS = [
  "AUTHORIZE",
  "ROUND_TRIP",
  "VALIDATE",
  "VERSION_CHECK",
] as const;
export type AdapterOperation = (typeof ADAPTER_OPERATIONS)[number];

export interface AdapterRequest {
  readonly case_id: string;
  readonly schema_ref: string;
  readonly operation: AdapterOperation;
  readonly input_bytes_base64: string;
  readonly trusted_context_bytes_base64?: string;
  readonly scenario?: string;
}

export interface AdapterBatchRequest {
  readonly protocol_version: typeof ADAPTER_PROTOCOL_VERSION;
  readonly requests: readonly AdapterRequest[];
}

export type ValidationVerdict = "VALID" | "INVALID";
export type AuthorizationOutcome = "ALLOW" | "DENY";

export interface AdapterResult {
  readonly case_id: string;
  readonly operation: AdapterOperation;
  readonly validation_verdict: ValidationVerdict;
  readonly canonical_json?: string;
  readonly error_category?: string;
  readonly version_outcome?: string;
  readonly authorization_outcome?: AuthorizationOutcome;
  readonly error_code?: string;
}

export interface AdapterBatchResponse {
  readonly protocol_version: typeof ADAPTER_PROTOCOL_VERSION;
  readonly language: AdapterLanguage;
  readonly results: readonly AdapterResult[];
}
