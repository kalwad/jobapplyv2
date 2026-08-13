// M02-W07 feasibility probe protocol (spec §5.4 trust boundaries, §5.11.7).
//
// This is a deliberately tiny, closed, single-purpose protocol: it exists
// only so the real built content script can prove one typed round-trip
// through the real Manifest V3 service worker. It is not a command bus and
// must not grow product operations; W08+ own scanning/filling surfaces and
// M17 owns the production message schemas (M01-W03/M01-W04 contracts).
//
// Every parser here treats its input as untrusted (spec §1.5): messages are
// validated against an exact closed member set, and anything else is
// rejected without a response.

export const FEASIBILITY_PROTOCOL_VERSION = 1;

export const FEASIBILITY_PROBE_KIND = "M02_W07_PROBE";
export const FEASIBILITY_ACK_KIND = "M02_W07_ACK";

// Fixed identity marker returned by the real W07 background service worker
// and exposed on its global scope so the Playwright harness can prove the
// observed worker is this runtime, not an unrelated service worker.
export const BACKGROUND_RUNTIME_MARKER = "japp-m02-w07-feasibility-background";
export const BACKGROUND_GLOBAL_KEY = "__JAPP_M02_W07_BACKGROUND__";

// The content script may execute only on the deterministic loopback mock
// ATS origin (M02-W03 lab); never a broad host pattern (REQ-FORM-011).
export const FEASIBILITY_CONTENT_MATCH = "http://127.0.0.1:4761/*";

// Namespaced test-observable marker set on the document root only after a
// valid ACK from the real service worker. It is the only page mutation the
// W07 product code makes. WXT 0.20.27's wrapper additionally dispatches one
// page-observable, non-sensitive lifecycle CustomEvent on `document`; its
// default postMessage is suppressed, and runtime plus shipped-byte proofs
// bound the reviewed framework artifact explicitly.
export const CONTENT_READY_ATTRIBUTE = "data-japp-m02-w07-extension-ready";
export const CONTENT_READY_VALUE = "true";

// Startup-race bounds: runtime.sendMessage can throw while the freshly
// installed worker is still starting, so the content script retries a fixed
// small number of times. A received-but-invalid ACK is a protocol violation
// and never retried.
export const PROBE_ATTEMPT_LIMIT = 3;
export const PROBE_RETRY_DELAY_MS = 200;

export interface FeasibilityProbe {
  readonly kind: typeof FEASIBILITY_PROBE_KIND;
  readonly protocolVersion: typeof FEASIBILITY_PROTOCOL_VERSION;
}

export interface FeasibilityAck {
  readonly kind: typeof FEASIBILITY_ACK_KIND;
  readonly protocolVersion: typeof FEASIBILITY_PROTOCOL_VERSION;
  readonly runtimeMarker: typeof BACKGROUND_RUNTIME_MARKER;
}

export function buildFeasibilityProbe(): FeasibilityProbe {
  return {
    kind: FEASIBILITY_PROBE_KIND,
    protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
  };
}

export function buildFeasibilityAck(): FeasibilityAck {
  return {
    kind: FEASIBILITY_ACK_KIND,
    protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
    runtimeMarker: BACKGROUND_RUNTIME_MARKER,
  };
}

function isClosedRecord(
  value: unknown,
  exactKeys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return (
    keys.length === exactKeys.length &&
    exactKeys.every((key) => keys.includes(key))
  );
}

// Strict finite validation of an untrusted probe message. Returns null for
// anything but the exact closed probe shape.
export function parseFeasibilityProbe(value: unknown): FeasibilityProbe | null {
  if (!isClosedRecord(value, ["kind", "protocolVersion"])) {
    return null;
  }
  if (
    value.kind !== FEASIBILITY_PROBE_KIND ||
    value.protocolVersion !== FEASIBILITY_PROTOCOL_VERSION
  ) {
    return null;
  }
  return buildFeasibilityProbe();
}

// Strict finite validation of an untrusted ACK response. Returns null for
// anything but the exact closed ACK shape with the fixed runtime marker.
export function parseFeasibilityAck(value: unknown): FeasibilityAck | null {
  if (!isClosedRecord(value, ["kind", "protocolVersion", "runtimeMarker"])) {
    return null;
  }
  if (
    value.kind !== FEASIBILITY_ACK_KIND ||
    value.protocolVersion !== FEASIBILITY_PROTOCOL_VERSION ||
    value.runtimeMarker !== BACKGROUND_RUNTIME_MARKER
  ) {
    return null;
  }
  return buildFeasibilityAck();
}
