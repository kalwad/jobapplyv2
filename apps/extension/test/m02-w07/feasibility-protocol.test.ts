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
  FEASIBILITY_CONTENT_MATCHES,
  FEASIBILITY_CROSS_ORIGIN_MATCH,
  FEASIBILITY_PROBE_KIND,
  FEASIBILITY_PROTOCOL_VERSION,
  parseFeasibilityAck,
  parseFeasibilityProbe,
  PROBE_ATTEMPT_LIMIT,
  PROBE_RETRY_DELAY_MS,
} from "../../src/feasibility-protocol.ts";

describe("protocol constants", () => {
  test("the content matches are exactly the two deterministic loopback frame origins", () => {
    expect(FEASIBILITY_CONTENT_MATCH).toBe("http://127.0.0.1:4761/*");
    expect(FEASIBILITY_CROSS_ORIGIN_MATCH).toBe("http://127.0.0.1:4762/*");
    expect(FEASIBILITY_CONTENT_MATCHES).toEqual([
      FEASIBILITY_CONTENT_MATCH,
      FEASIBILITY_CROSS_ORIGIN_MATCH,
    ]);
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
    ["a standalone product command", { command: "fill" }],
    ["an alternate product command", { command: "scan" }],
    ["another unrelated product command", { command: "delete" }],
    ["an alternate operation", { operation: "scan" }],
    ["a distinct command-shaped kind", { kind: "COMMAND", command: "fill" }],
    [
      "an alternate command-shaped kind",
      { kind: "COMMAND", command: "inspect" },
    ],
    [
      "a command added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, command: "fill" },
    ],
    [
      "an alternate command added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, command: "scan" },
    ],
    [
      "a payload added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, payload: {} },
    ],
    [
      "data added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, data: [] },
    ],
    ["a nested command object", { request: { command: "fill" } }],
    [
      "an operation member added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, operation: "scan" },
    ],
    [
      "an action member added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, action: "inspect" },
    ],
    [
      "a request member added to the canonical probe",
      { kind: FEASIBILITY_PROBE_KIND, protocolVersion: 1, request: {} },
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
    ["a standalone product response", { command: "fill" }],
    ["an alternate product response", { command: "scan" }],
    ["another unrelated product response", { command: "delete" }],
    [
      "a command member added to the canonical ACK",
      {
        kind: FEASIBILITY_ACK_KIND,
        protocolVersion: 1,
        runtimeMarker: BACKGROUND_RUNTIME_MARKER,
        command: "fill",
      },
    ],
    [
      "a payload member added to the canonical ACK",
      {
        kind: FEASIBILITY_ACK_KIND,
        protocolVersion: 1,
        runtimeMarker: BACKGROUND_RUNTIME_MARKER,
        payload: {},
      },
    ],
    ["a nested operation response", { data: { operation: "scan" } }],
  ])("rejects %s", (_label, value: unknown) => {
    expect(parseFeasibilityAck(value)).toBeNull();
  });

  test("a probe is never a valid ACK and an ACK is never a valid probe", () => {
    expect(parseFeasibilityAck(buildFeasibilityProbe())).toBeNull();
    expect(parseFeasibilityProbe(buildFeasibilityAck())).toBeNull();
  });

  test("builders expose only the finite reviewed wire members", () => {
    expect(Object.keys(buildFeasibilityProbe()).sort()).toEqual([
      "kind",
      "protocolVersion",
    ]);
    expect(buildFeasibilityProbe()).toEqual({
      kind: "M02_W07_PROBE",
      protocolVersion: 1,
    });
    expect(Object.keys(buildFeasibilityAck()).sort()).toEqual([
      "kind",
      "protocolVersion",
      "runtimeMarker",
    ]);
    expect(buildFeasibilityAck()).toEqual({
      kind: "M02_W07_ACK",
      protocolVersion: 1,
      runtimeMarker: "japp-m02-w07-feasibility-background",
    });
  });
});
