// M02-W07 closed probe-protocol unit tests: every parser treats input as
// untrusted (spec §1.5) and must reject anything outside the exact closed
// member set. These are pure-helper tests; the real-browser proof lives in
// e2e/extension/ (jsdom-style evidence alone is insufficient, spec §5.11.7).
import { describe, expect, test } from "vitest";

import {
  BACKGROUND_GLOBAL_KEY,
  BACKGROUND_RUNTIME_MARKER,
  buildFeasibilityAck,
  buildFeasibilityProbe,
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
  FEASIBILITY_ACK_KIND,
  FEASIBILITY_CONTENT_MATCH,
  FEASIBILITY_PROBE_KIND,
  FEASIBILITY_PROTOCOL_VERSION,
  parseFeasibilityAck,
  parseFeasibilityProbe,
  PROBE_ATTEMPT_LIMIT,
  PROBE_RETRY_DELAY_MS,
} from "../../src/feasibility-protocol.ts";

describe("protocol constants", () => {
  test("the loopback content match is the exact deterministic mock ATS origin and nothing broader", () => {
    expect(FEASIBILITY_CONTENT_MATCH).toBe("http://127.0.0.1:4761/*");
  });

  test("marker names are namespaced to the package and work item", () => {
    expect(CONTENT_READY_ATTRIBUTE).toBe("data-japp-m02-w07-extension-ready");
    expect(CONTENT_READY_VALUE).toBe("true");
    expect(BACKGROUND_RUNTIME_MARKER).toBe(
      "japp-m02-w07-feasibility-background",
    );
    expect(BACKGROUND_GLOBAL_KEY).toBe("__JAPP_M02_W07_BACKGROUND__");
  });

  test("startup-race retry bounds are small fixed constants", () => {
    expect(PROBE_ATTEMPT_LIMIT).toBe(3);
    expect(PROBE_RETRY_DELAY_MS).toBe(200);
  });
});

describe("parseFeasibilityProbe", () => {
  test("accepts the canonical probe and returns a fresh canonical object", () => {
    const probe: unknown = {
      kind: FEASIBILITY_PROBE_KIND,
      protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
    };
    const parsed = parseFeasibilityProbe(probe);
    expect(parsed).toEqual(buildFeasibilityProbe());
    expect(parsed).not.toBe(probe);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 1],
    ["a string", FEASIBILITY_PROBE_KIND],
    ["a boolean", true],
    ["an empty array", []],
    [
      "an array wrapping a valid probe",
      [{ kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1 }],
    ],
    ["an empty object", {}],
    ["a probe missing protocolVersion", { kind: FEASIBILITY_PROBE_KIND }],
    [
      "a probe with an extra member (closed protocol)",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, extra: true },
    ],
    ["an unknown kind", { kind: "M02_W07_UNKNOWN", protocolVersion: 1 }],
    [
      "an ACK kind sent as a probe",
      { kind: FEASIBILITY_ACK_KIND, protocolVersion: 1 },
    ],
    [
      "a stringified protocol version",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: "1" },
    ],
    [
      "a wrong protocol version",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 2 },
    ],
    [
      "a null protocol version",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: null },
    ],
  ])("rejects %s", (_label, value: unknown) => {
    expect(parseFeasibilityProbe(value)).toBeNull();
  });
});

describe("parseFeasibilityAck", () => {
  test("accepts the canonical ACK and returns a fresh canonical object", () => {
    const ack: unknown = {
      kind: FEASIBILITY_ACK_KIND,
      protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
      runtimeMarker: BACKGROUND_RUNTIME_MARKER,
    };
    const parsed = parseFeasibilityAck(ack);
    expect(parsed).toEqual(buildFeasibilityAck());
    expect(parsed).not.toBe(ack);
  });

  test.each([
    ["null", null],
    ["undefined (no listener responded)", undefined],
    ["an empty object", {}],
    ["an array wrapping a valid ACK", [buildFeasibilityAck()]],
    [
      "an ACK missing the runtime marker",
      { kind: FEASIBILITY_ACK_KIND, protocolVersion: 1 },
    ],
    [
      "an ACK with a foreign runtime marker",
      {
        kind: FEASIBILITY_ACK_KIND,
        protocolVersion: 1,
        runtimeMarker: "some-other-extension",
      },
    ],
    [
      "an ACK with an extra member (closed protocol)",
      {
        kind: FEASIBILITY_ACK_KIND,
        protocolVersion: 1,
        runtimeMarker: BACKGROUND_RUNTIME_MARKER,
        capability: "fill",
      },
    ],
    [
      "a probe kind sent as an ACK",
      {
        kind: FEASIBILITY_PROBE_KIND,
        protocolVersion: 1,
        runtimeMarker: BACKGROUND_RUNTIME_MARKER,
      },
    ],
    [
      "a malformed protocol version",
      {
        kind: FEASIBILITY_ACK_KIND,
        protocolVersion: "1",
        runtimeMarker: BACKGROUND_RUNTIME_MARKER,
      },
    ],
    [
      "a future protocol version",
      {
        kind: FEASIBILITY_ACK_KIND,
        protocolVersion: 2,
        runtimeMarker: BACKGROUND_RUNTIME_MARKER,
      },
    ],
  ])("rejects %s", (_label, value: unknown) => {
    expect(parseFeasibilityAck(value)).toBeNull();
  });

  test("a probe is never a valid ACK and an ACK is never a valid probe", () => {
    expect(parseFeasibilityAck(buildFeasibilityProbe())).toBeNull();
    expect(parseFeasibilityProbe(buildFeasibilityAck())).toBeNull();
  });
});
