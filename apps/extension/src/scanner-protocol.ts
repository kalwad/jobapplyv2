import type {
  FormFieldAddressV1,
  FormFieldDescriptorV1,
} from "@japp/contracts/generated";

export const SCANNER_PROTOCOL_VERSION = 1;
export const MAX_FRAME_AGENTS_PER_TAB = 64;
export const MAX_DESCRIPTORS_PER_FRAME = 512;
export const MAX_OPTIONS_PER_FIELD = 256;

export const FRAME_REGISTER_KIND = "M02_W08_REGISTER_FRAME";
export const FRAME_REGISTERED_KIND = "M02_W08_FRAME_REGISTERED";
export const SCAN_TAB_KIND = "M02_W08_SCAN_TAB";
export const SCAN_FRAME_KIND = "M02_W08_SCAN_FRAME";
export const FRAME_SCAN_RESULT_KIND = "M02_W08_FRAME_SCAN_RESULT";
export const AGGREGATED_SCAN_RESULT_KIND = "M02_W08_SCAN_RESULT";
export const RERESOLVE_TAB_KIND = "M02_W08_RERESOLVE_TAB";
export const RERESOLVE_FRAME_KIND = "M02_W08_RERESOLVE_FRAME";
export const FRAME_RERESOLUTION_RESULT_KIND =
  "M02_W08_FRAME_RERESOLUTION_RESULT";
export const RERESOLVE_TAB_RESULT_KIND = "M02_W08_RERESOLVE_RESULT";

export const CONTENT_FRAME_SCAN_FOUND = "FOUND";

export type ScanRootStatus =
  typeof CONTENT_FRAME_SCAN_FOUND | "UNRESOLVED" | "AMBIGUOUS" | "UNAVAILABLE";

export interface FrameContext {
  readonly session_id: string;
  readonly frame_id: string;
  readonly document_id: string;
  readonly document_url_digest: string;
  readonly is_top_frame: boolean;
}

export interface FrameRegistration {
  readonly kind: typeof FRAME_REGISTER_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
}

export interface FrameRegistered {
  readonly kind: typeof FRAME_REGISTERED_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly frame_context: FrameContext;
}

export type ScanScope =
  | { readonly kind: "APPLICATION_ROOT" }
  | { readonly kind: "SUBTREE"; readonly subtreeToken: string };

export interface ScanTabRequest {
  readonly kind: typeof SCAN_TAB_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly scope: ScanScope;
}

export interface ScanFrameRequest {
  readonly kind: typeof SCAN_FRAME_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly expected_document_id: string;
  readonly scope: ScanScope;
}

export interface FrameScanReport {
  readonly kind: typeof FRAME_SCAN_RESULT_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly root_status: ScanRootStatus;
  readonly root_candidate_count: number;
  readonly scan_boundary: "APPLICATION_ROOT" | "SUBTREE";
  readonly descriptors: readonly FormFieldDescriptorV1[];
}

export interface AggregatedScanResult {
  readonly kind: typeof AGGREGATED_SCAN_RESULT_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly frames: readonly FrameScanReport[];
}

export interface ReresolveTabRequest {
  readonly kind: typeof RERESOLVE_TAB_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tabId: number;
  readonly address: FormFieldAddressV1;
}

export interface ReresolveFrameRequest {
  readonly kind: typeof RERESOLVE_FRAME_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly address: FormFieldAddressV1;
}

export type FieldResolution =
  | {
      readonly status: "RESOLVED";
      readonly descriptor: FormFieldDescriptorV1;
    }
  | {
      readonly status: "UNRESOLVED";
      readonly reason:
        | "FRAME_UNAVAILABLE"
        | "STALE_DOCUMENT"
        | "STALE_APPLICATION_ROOT"
        | "NO_MATCH"
        | "INVALID_ADDRESS";
    }
  | { readonly status: "AMBIGUOUS"; readonly candidate_count: number };

export interface FrameReresolutionResult {
  readonly kind: typeof FRAME_RERESOLUTION_RESULT_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly frame_context: FrameContext;
  readonly resolution: FieldResolution;
}

export interface ReresolveTabResult {
  readonly kind: typeof RERESOLVE_TAB_RESULT_KIND;
  readonly protocolVersion: typeof SCANNER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly resolution: FieldResolution;
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const STABLE_ID_PATTERN = /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/;
const ENUM_TOKEN_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const BOUNDED_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+/-]{0,127}$/;
const NORMALIZED_TEXT_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9 .,:!?()'&+/@_-]{0,511}$/;
const UTC_TIMESTAMP_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$/;

const ADDRESS_REQUIRED_KEYS = [
  "address_schema_version",
  "session_id",
  "frame_id",
  "document_id",
  "ats_family",
  "section_path",
  "repeater_path",
  "resolution_hints",
  "observed_dom_generation",
] as const;
const ADDRESS_OPTIONAL_KEYS = [
  "tenant_pattern_id",
  "route_signature",
  "application_root_fingerprint",
  "accessible_name_fingerprint",
  "attribute_fingerprint",
  "option_fingerprint",
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasClosedKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isStableId(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID_PATTERN.test(value);
}

function isEnumToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    ENUM_TOKEN_PATTERN.test(value)
  );
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/** Relevant canonical inert-text rules after the closed wire grammars pass. */
export function isCanonicalInertString(value: string): boolean {
  const lower = value.toLowerCase();
  return !(
    value.startsWith("/") ||
    /^[A-Za-z]:\//.test(value) ||
    lower.includes("javascript:") ||
    lower.includes("xpath:") ||
    lower.includes("document.") ||
    lower.includes("window.") ||
    lower.includes("begin private key") ||
    value.includes("../")
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function daysInMonth(year: number, month: number): number {
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  if (month !== 2) {
    return month >= 1 && month <= 12 ? 31 : 0;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

function isUtcTimestamp(value: string): boolean {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  return (
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    ((second >= 0 && second <= 59) ||
      (second === 60 && hour === 23 && minute === 59))
  );
}

function isFrameContext(value: unknown): value is FrameContext {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "session_id",
      "frame_id",
      "document_id",
      "document_url_digest",
      "is_top_frame",
    ]) &&
    isStableId(candidate.session_id) &&
    isStableId(candidate.frame_id) &&
    isStableId(candidate.document_id) &&
    isDigest(candidate.document_url_digest) &&
    typeof candidate.is_top_frame === "boolean"
  );
}

function isScanScope(value: unknown): value is ScanScope {
  const candidate = record(value);
  if (candidate === null || typeof candidate.kind !== "string") {
    return false;
  }
  if (candidate.kind === "APPLICATION_ROOT") {
    return hasClosedKeys(candidate, ["kind"]);
  }
  return (
    candidate.kind === "SUBTREE" &&
    hasClosedKeys(candidate, ["kind", "subtreeToken"]) &&
    isEnumToken(candidate.subtreeToken)
  );
}

function isResolutionHint(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "value_fingerprint",
      "stability_class",
    ]) &&
    [
      "ACCESSIBLE_NAME_DIGEST",
      "ATTRIBUTE_DIGEST",
      "CONTROL_KIND",
      "OPTION_DIGEST",
      "ROLE_TOKEN",
      "SECTION_TOKEN",
    ].includes(String(candidate.kind)) &&
    isDigest(candidate.value_fingerprint) &&
    ["SESSION_STABLE", "PAGE_STABLE", "OBSERVATION_ONLY"].includes(
      String(candidate.stability_class),
    )
  );
}

function isRepeaterEntry(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["semantic_concept", "stable_item_key"]) &&
    isEnumToken(candidate.semantic_concept) &&
    isStableId(candidate.stable_item_key)
  );
}

/** Strict runtime validation of the existing generated M01 FieldAddress. */
export function isCanonicalFieldAddress(
  value: unknown,
): value is FormFieldAddressV1 {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, ADDRESS_REQUIRED_KEYS, ADDRESS_OPTIONAL_KEYS) ||
    candidate.address_schema_version !== "FIELD_ADDRESS_V1" ||
    !isStableId(candidate.session_id) ||
    !isStableId(candidate.frame_id) ||
    !isStableId(candidate.document_id) ||
    ![
      "ASHBY",
      "GREENHOUSE",
      "ICIMS",
      "LEVER",
      "OTHER_REVIEWED",
      "SMARTRECRUITERS",
      "SUCCESSFACTORS",
      "TALEO",
      "UNKNOWN",
      "WORKDAY",
    ].includes(String(candidate.ats_family)) ||
    !Array.isArray(candidate.section_path) ||
    candidate.section_path.length > 16 ||
    !candidate.section_path.every(isEnumToken) ||
    !Array.isArray(candidate.repeater_path) ||
    candidate.repeater_path.length > 16 ||
    !candidate.repeater_path.every(isRepeaterEntry) ||
    !Array.isArray(candidate.resolution_hints) ||
    candidate.resolution_hints.length > 12 ||
    !candidate.resolution_hints.every(isResolutionHint) ||
    !isSafeNonNegativeInteger(candidate.observed_dom_generation)
  ) {
    return false;
  }
  if (
    (candidate.tenant_pattern_id !== undefined &&
      !isStableId(candidate.tenant_pattern_id)) ||
    (candidate.route_signature !== undefined &&
      !isDigest(candidate.route_signature)) ||
    (candidate.application_root_fingerprint !== undefined &&
      !isDigest(candidate.application_root_fingerprint)) ||
    (candidate.accessible_name_fingerprint !== undefined &&
      !isDigest(candidate.accessible_name_fingerprint)) ||
    (candidate.attribute_fingerprint !== undefined &&
      !isDigest(candidate.attribute_fingerprint)) ||
    (candidate.option_fingerprint !== undefined &&
      !isDigest(candidate.option_fingerprint))
  ) {
    return false;
  }
  const authoritySignals = [
    candidate.route_signature,
    candidate.application_root_fingerprint,
    candidate.accessible_name_fingerprint,
    candidate.attribute_fingerprint,
    candidate.option_fingerprint,
    candidate.section_path.length > 0 ? "SECTION_PATH" : undefined,
    candidate.repeater_path.length > 0 ? "REPEATER_PATH" : undefined,
  ].filter((item) => item !== undefined).length;
  const repeaterKeys = candidate.repeater_path.map((entry) => {
    const item = record(entry);
    return item?.stable_item_key;
  });
  return (
    authoritySignals >= 2 && new Set(repeaterKeys).size === repeaterKeys.length
  );
}

function isUntrustedText(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(
      candidate,
      ["text_digest", "untrusted"],
      ["normalized_text"],
    ) &&
    isDigest(candidate.text_digest) &&
    candidate.untrusted === true &&
    (candidate.normalized_text === undefined ||
      (typeof candidate.normalized_text === "string" &&
        NORMALIZED_TEXT_PATTERN.test(candidate.normalized_text) &&
        isCanonicalInertString(candidate.normalized_text)))
  );
}

function isOption(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(
      candidate,
      ["value_digest", "label", "disabled"],
      ["stable_value_token"],
    ) &&
    isDigest(candidate.value_digest) &&
    isUntrustedText(candidate.label) &&
    typeof candidate.disabled === "boolean" &&
    (candidate.stable_value_token === undefined ||
      (typeof candidate.stable_value_token === "string" &&
        BOUNDED_TOKEN_PATTERN.test(candidate.stable_value_token) &&
        isCanonicalInertString(candidate.stable_value_token)))
  );
}

function isValidationState(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(candidate, ["state", "message_digests"]) &&
    ["ACCEPTED", "REJECTED", "UNKNOWN", "NOT_APPLICABLE"].includes(
      String(candidate.state),
    ) &&
    Array.isArray(candidate.message_digests) &&
    candidate.message_digests.length <= 8 &&
    candidate.message_digests.every(isDigest)
  );
}

function isObservedValue(value: unknown): boolean {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasClosedKeys(
      candidate,
      ["value_digest", "presence"],
      ["semantic_token"],
    ) &&
    isDigest(candidate.value_digest) &&
    ["ABSENT", "EMPTY", "PRESENT_REDACTED"].includes(
      String(candidate.presence),
    ) &&
    (candidate.semantic_token === undefined ||
      (typeof candidate.semantic_token === "string" &&
        BOUNDED_TOKEN_PATTERN.test(candidate.semantic_token) &&
        isCanonicalInertString(candidate.semantic_token)))
  );
}

export function isCanonicalFieldDescriptor(
  value: unknown,
): value is FormFieldDescriptorV1 {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(
      candidate,
      [
        "field_id",
        "address",
        "control_kind",
        "visible",
        "enabled",
        "required",
        "sensitive_candidate",
        "label",
        "section_context",
        "options",
        "validation_state",
        "observed_at",
        "observed_dom_generation",
      ],
      ["description", "current_value"],
    ) ||
    !isStableId(candidate.field_id) ||
    !isCanonicalFieldAddress(candidate.address) ||
    ![
      "CHECKBOX",
      "COMBOBOX",
      "DATE",
      "FILE",
      "MULTI_SELECT",
      "RADIO_GROUP",
      "SELECT",
      "TEXT",
      "TEXTAREA",
      "UNKNOWN",
    ].includes(String(candidate.control_kind)) ||
    typeof candidate.visible !== "boolean" ||
    typeof candidate.enabled !== "boolean" ||
    typeof candidate.required !== "boolean" ||
    typeof candidate.sensitive_candidate !== "boolean" ||
    !isUntrustedText(candidate.label) ||
    (candidate.description !== undefined &&
      !isUntrustedText(candidate.description)) ||
    !Array.isArray(candidate.section_context) ||
    candidate.section_context.length > 16 ||
    !candidate.section_context.every(isEnumToken) ||
    !Array.isArray(candidate.options) ||
    candidate.options.length > MAX_OPTIONS_PER_FIELD ||
    !candidate.options.every(isOption) ||
    (candidate.current_value !== undefined &&
      !isObservedValue(candidate.current_value)) ||
    !isValidationState(candidate.validation_state) ||
    typeof candidate.observed_at !== "string" ||
    !isUtcTimestamp(candidate.observed_at) ||
    !isSafeNonNegativeInteger(candidate.observed_dom_generation)
  ) {
    return false;
  }
  const address = candidate.address;
  const optionDigests = candidate.options.map((option) => {
    const item = record(option);
    return item?.value_digest;
  });
  return (
    candidate.observed_dom_generation === address.observed_dom_generation &&
    new Set(optionDigests).size === optionDigests.length
  );
}

function descriptorBelongsToFrame(
  value: unknown,
  frameContext: unknown,
): value is FormFieldDescriptorV1 {
  if (!isCanonicalFieldDescriptor(value) || !isFrameContext(frameContext)) {
    return false;
  }
  return (
    value.address.session_id === frameContext.session_id &&
    value.address.frame_id === frameContext.frame_id &&
    value.address.document_id === frameContext.document_id
  );
}

export function buildFrameRegistration(): FrameRegistration {
  return {
    kind: FRAME_REGISTER_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
  };
}

export function parseFrameRegistration(
  value: unknown,
): FrameRegistration | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, ["kind", "protocolVersion"]) &&
    candidate.kind === FRAME_REGISTER_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION
    ? buildFrameRegistration()
    : null;
}

export function parseFrameRegistered(value: unknown): FrameRegistered | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, ["kind", "protocolVersion", "frame_context"]) &&
    candidate.kind === FRAME_REGISTERED_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION &&
    isFrameContext(candidate.frame_context)
    ? (candidate as unknown as FrameRegistered)
    : null;
}

export function buildScanTabRequest(
  requestId: string,
  tabId: number,
  scope: ScanScope,
): ScanTabRequest {
  return {
    kind: SCAN_TAB_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
    requestId,
    tabId,
    scope,
  };
}

export function parseScanTabRequest(value: unknown): ScanTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "scope",
    ]) &&
    candidate.kind === SCAN_TAB_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isSafeNonNegativeInteger(candidate.tabId) &&
    isScanScope(candidate.scope)
    ? (candidate as unknown as ScanTabRequest)
    : null;
}

export function parseScanFrameRequest(value: unknown): ScanFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "expected_document_id",
      "scope",
    ]) &&
    candidate.kind === SCAN_FRAME_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isStableId(candidate.expected_document_id) &&
    isScanScope(candidate.scope)
    ? (candidate as unknown as ScanFrameRequest)
    : null;
}

export function parseFrameScanReport(value: unknown): FrameScanReport | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "root_status",
      "root_candidate_count",
      "scan_boundary",
      "descriptors",
    ]) ||
    candidate.kind !== FRAME_SCAN_RESULT_KIND ||
    candidate.protocolVersion !== SCANNER_PROTOCOL_VERSION ||
    !isRequestId(candidate.requestId) ||
    !isFrameContext(candidate.frame_context) ||
    !["FOUND", "UNRESOLVED", "AMBIGUOUS", "UNAVAILABLE"].includes(
      String(candidate.root_status),
    ) ||
    !isSafeNonNegativeInteger(candidate.root_candidate_count) ||
    !["APPLICATION_ROOT", "SUBTREE"].includes(
      String(candidate.scan_boundary),
    ) ||
    !Array.isArray(candidate.descriptors) ||
    candidate.descriptors.length > MAX_DESCRIPTORS_PER_FRAME ||
    !candidate.descriptors.every((descriptor) =>
      descriptorBelongsToFrame(descriptor, candidate.frame_context),
    )
  ) {
    return null;
  }
  const rootStatus = candidate.root_status;
  const count = candidate.root_candidate_count;
  const coherent =
    (rootStatus === "FOUND" && count === 1) ||
    (candidate.descriptors.length === 0 &&
      ((rootStatus === "UNRESOLVED" && count === 0) ||
        (rootStatus === "AMBIGUOUS" && count > 1) ||
        (rootStatus === "UNAVAILABLE" && count === 0)));
  return coherent ? (candidate as unknown as FrameScanReport) : null;
}

export function parseAggregatedScanResult(
  value: unknown,
): AggregatedScanResult | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "frames",
    ]) ||
    candidate.kind !== AGGREGATED_SCAN_RESULT_KIND ||
    candidate.protocolVersion !== SCANNER_PROTOCOL_VERSION ||
    !isRequestId(candidate.requestId) ||
    !isSafeNonNegativeInteger(candidate.tabId) ||
    !Array.isArray(candidate.frames) ||
    candidate.frames.length > MAX_FRAME_AGENTS_PER_TAB
  ) {
    return null;
  }
  const frames = candidate.frames.map(parseFrameScanReport);
  if (frames.some((frame) => frame === null)) {
    return null;
  }
  const identities = frames.map((frame) => frame?.frame_context.frame_id);
  return new Set(identities).size === identities.length
    ? (candidate as unknown as AggregatedScanResult)
    : null;
}

export function buildReresolveTabRequest(
  requestId: string,
  tabId: number,
  address: FormFieldAddressV1,
): ReresolveTabRequest {
  return {
    kind: RERESOLVE_TAB_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
    requestId,
    tabId,
    address,
  };
}

export function parseReresolveTabRequest(
  value: unknown,
): ReresolveTabRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "tabId",
      "address",
    ]) &&
    candidate.kind === RERESOLVE_TAB_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isSafeNonNegativeInteger(candidate.tabId) &&
    isCanonicalFieldAddress(candidate.address)
    ? (candidate as unknown as ReresolveTabRequest)
    : null;
}

export function parseReresolveFrameRequest(
  value: unknown,
): ReresolveFrameRequest | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "address",
    ]) &&
    candidate.kind === RERESOLVE_FRAME_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    isCanonicalFieldAddress(candidate.address)
    ? (candidate as unknown as ReresolveFrameRequest)
    : null;
}

function parseFieldResolution(value: unknown): FieldResolution | null {
  const candidate = record(value);
  if (candidate === null || typeof candidate.status !== "string") {
    return null;
  }
  if (
    candidate.status === "RESOLVED" &&
    hasClosedKeys(candidate, ["status", "descriptor"]) &&
    isCanonicalFieldDescriptor(candidate.descriptor)
  ) {
    return candidate as unknown as FieldResolution;
  }
  if (
    candidate.status === "UNRESOLVED" &&
    hasClosedKeys(candidate, ["status", "reason"]) &&
    [
      "FRAME_UNAVAILABLE",
      "STALE_DOCUMENT",
      "STALE_APPLICATION_ROOT",
      "NO_MATCH",
      "INVALID_ADDRESS",
    ].includes(String(candidate.reason))
  ) {
    return candidate as unknown as FieldResolution;
  }
  if (
    candidate.status === "AMBIGUOUS" &&
    hasClosedKeys(candidate, ["status", "candidate_count"]) &&
    isSafePositiveInteger(candidate.candidate_count) &&
    candidate.candidate_count > 1
  ) {
    return candidate as unknown as FieldResolution;
  }
  return null;
}

export function parseFrameReresolutionResult(
  value: unknown,
): FrameReresolutionResult | null {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "frame_context",
      "resolution",
    ]) ||
    candidate.kind !== FRAME_RERESOLUTION_RESULT_KIND ||
    candidate.protocolVersion !== SCANNER_PROTOCOL_VERSION ||
    !isRequestId(candidate.requestId) ||
    !isFrameContext(candidate.frame_context)
  ) {
    return null;
  }
  const resolution = parseFieldResolution(candidate.resolution);
  if (
    resolution === null ||
    (resolution.status === "RESOLVED" &&
      !descriptorBelongsToFrame(resolution.descriptor, candidate.frame_context))
  ) {
    return null;
  }
  return candidate as unknown as FrameReresolutionResult;
}

export function parseReresolveTabResult(
  value: unknown,
): ReresolveTabResult | null {
  const candidate = record(value);
  return candidate !== null &&
    hasClosedKeys(candidate, [
      "kind",
      "protocolVersion",
      "requestId",
      "resolution",
    ]) &&
    candidate.kind === RERESOLVE_TAB_RESULT_KIND &&
    candidate.protocolVersion === SCANNER_PROTOCOL_VERSION &&
    isRequestId(candidate.requestId) &&
    parseFieldResolution(candidate.resolution) !== null
    ? (candidate as unknown as ReresolveTabResult)
    : null;
}
