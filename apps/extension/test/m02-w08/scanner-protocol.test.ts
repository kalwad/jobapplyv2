import {
  validateFormFieldAddressV1,
  validateFormFieldDescriptorV1,
  validateSemanticContractV1,
} from "@japp/contracts/generated";
import { describe, expect, test } from "vitest";

import {
  buildFrameRegistration,
  buildScanTabRequest,
  FRAME_SCAN_RESULT_KIND,
  isCanonicalFieldAddress,
  isCanonicalFieldDescriptor,
  parseFrameRegistration,
  parseFrameScanReport,
  parseReresolveTabRequest,
  parseScanTabRequest,
  SCANNER_PROTOCOL_VERSION,
} from "../../src/scanner-protocol.ts";
import {
  semanticDigest,
  stableSemanticId,
} from "../../src/semantic-identity.ts";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const DIGEST_C = `sha256:${"c".repeat(64)}`;

const canonicalAddress = {
  address_schema_version: "FIELD_ADDRESS_V1" as const,
  session_id: "session_0123456789ABCDEFGHJKMNPQRS",
  frame_id: "frame_0123456789ABCDEFGHJKMNPQRS",
  document_id: "document_0123456789ABCDEFGHJKMNPQRS",
  ats_family: "UNKNOWN" as const,
  route_signature: DIGEST_A,
  application_root_fingerprint: DIGEST_B,
  section_path: [],
  repeater_path: [],
  accessible_name_fingerprint: DIGEST_C,
  resolution_hints: [
    {
      kind: "ACCESSIBLE_NAME_DIGEST" as const,
      value_fingerprint: DIGEST_C,
      stability_class: "PAGE_STABLE" as const,
    },
  ],
  observed_dom_generation: 0,
};

const canonicalDescriptor = {
  field_id: "field_0123456789ABCDEFGHJKMNPQRS",
  address: canonicalAddress,
  control_kind: "TEXT" as const,
  visible: true,
  enabled: true,
  required: true,
  sensitive_candidate: false,
  label: {
    normalized_text: "Synthetic name",
    text_digest: DIGEST_C,
    untrusted: true,
  },
  section_context: [],
  options: [],
  validation_state: { state: "NOT_APPLICABLE" as const, message_digests: [] },
  observed_at: "2026-08-22T00:00:00Z",
  observed_dom_generation: 0,
};

describe("canonical M01 field contracts at the W08 wire boundary", () => {
  test("accepts a canonical multi-signal FieldAddress and FieldDescriptor", () => {
    expect(validateFormFieldAddressV1(canonicalAddress).valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:form:field-address:v1",
        canonicalAddress,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(validateFormFieldDescriptorV1(canonicalDescriptor).valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:form:field-descriptor:v1",
        canonicalDescriptor,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(isCanonicalFieldAddress(canonicalAddress)).toBe(true);
  });

  test("M1: raw-selector-only identity is rejected, including stale-selector bait", () => {
    const selectorOnly = {
      address_schema_version: "FIELD_ADDRESS_V1",
      session_id: canonicalAddress.session_id,
      frame_id: canonicalAddress.frame_id,
      document_id: canonicalAddress.document_id,
      ats_family: "UNKNOWN",
      section_path: [],
      repeater_path: [],
      resolution_hints: [],
      observed_dom_generation: 0,
      raw_selector: "input:nth-of-type(1)",
    };
    expect(validateFormFieldAddressV1(selectorOnly).valid).toBe(false);
    expect(isCanonicalFieldAddress(selectorOnly)).toBe(false);
    expect(
      parseReresolveTabRequest({
        kind: "M02_W08_RERESOLVE_TAB",
        protocolVersion: SCANNER_PROTOCOL_VERSION,
        requestId: "selector-only",
        tabId: 9,
        address: selectorOnly,
      }),
    ).toBeNull();
  });

  test("a frame report rejects descriptors from another typed frame or an unresolved root", () => {
    const frameContext = {
      session_id: canonicalAddress.session_id,
      frame_id: canonicalAddress.frame_id,
      document_id: canonicalAddress.document_id,
      document_url_digest: DIGEST_A,
      is_top_frame: true,
    };
    const report = {
      kind: FRAME_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: "frame-report",
      frame_context: frameContext,
      root_status: "FOUND",
      root_candidate_count: 1,
      scan_boundary: "APPLICATION_ROOT",
      descriptors: [canonicalDescriptor],
    };
    expect(parseFrameScanReport(report)).not.toBeNull();
    expect(
      parseFrameScanReport({
        ...report,
        descriptors: [
          {
            ...canonicalDescriptor,
            address: {
              ...canonicalAddress,
              frame_id: "frame_1123456789ABCDEFGHJKMNPQRS",
            },
          },
        ],
      }),
    ).toBeNull();
    expect(
      parseFrameScanReport({
        ...report,
        root_status: "UNRESOLVED",
        root_candidate_count: 0,
      }),
    ).toBeNull();
  });

  test("canonical wire validation rejects a structurally valid executable-looking option token", () => {
    const hostileDescriptor = {
      ...canonicalDescriptor,
      control_kind: "SELECT" as const,
      options: [
        {
          stable_value_token: "javascript:evil",
          value_digest: DIGEST_B,
          label: {
            normalized_text: "Hostile option",
            text_digest: DIGEST_A,
            untrusted: true,
          },
          disabled: false,
        },
      ],
    };
    expect(validateFormFieldDescriptorV1(hostileDescriptor).valid).toBe(true);
    expect(
      validateSemanticContractV1(
        "urn:japp:schema:form:field-descriptor:v1",
        hostileDescriptor,
      ).valid,
    ).toBe(false);
    expect(isCanonicalFieldDescriptor(hostileDescriptor)).toBe(false);
  });

  test("canonical wire validation rejects an impossible UTC calendar timestamp", () => {
    const impossibleTimestamp = {
      ...canonicalDescriptor,
      observed_at: "2026-99-99T99:99:99Z",
    };
    expect(validateFormFieldDescriptorV1(impossibleTimestamp).valid).toBe(
      false,
    );
    expect(isCanonicalFieldDescriptor(impossibleTimestamp)).toBe(false);
    const leapSecond = {
      ...canonicalDescriptor,
      observed_at: "2026-06-30T23:59:60Z",
    };
    expect(validateFormFieldDescriptorV1(leapSecond).valid).toBe(true);
    expect(isCanonicalFieldDescriptor(leapSecond)).toBe(true);
  });
});

describe("closed scanner protocol", () => {
  test("accepts only the two bounded scan scopes", () => {
    expect(
      parseScanTabRequest(
        buildScanTabRequest("root-scan", 17, { kind: "APPLICATION_ROOT" }),
      ),
    ).toEqual(
      buildScanTabRequest("root-scan", 17, { kind: "APPLICATION_ROOT" }),
    );
    expect(
      parseScanTabRequest(
        buildScanTabRequest("subtree-scan", 17, {
          kind: "SUBTREE",
          subtreeToken: "CONTACT_SECTION",
        }),
      ),
    ).toEqual(
      buildScanTabRequest("subtree-scan", 17, {
        kind: "SUBTREE",
        subtreeToken: "CONTACT_SECTION",
      }),
    );
  });

  test.each([
    ["null", null],
    ["an untyped scan command", { command: "scan" }],
    ["a fill command", { command: "fill" }],
    ["an unknown operation", { operation: "scan" }],
    [
      "an extra command member",
      {
        ...buildScanTabRequest("extra-command", 17, {
          kind: "APPLICATION_ROOT",
        }),
        command: "fill",
      },
    ],
    [
      "a selector subtree",
      {
        kind: "M02_W08_SCAN_TAB",
        protocolVersion: SCANNER_PROTOCOL_VERSION,
        requestId: "selector-scope",
        tabId: 17,
        scope: { kind: "SUBTREE", selector: "#application" },
      },
    ],
    [
      "an unbounded token",
      buildScanTabRequest("bad-token", 17, {
        kind: "SUBTREE",
        subtreeToken: "* > input",
      }),
    ],
  ])("rejects %s", (_label, value: unknown) => {
    expect(parseScanTabRequest(value)).toBeNull();
  });

  test("frame registration has one exact closed shape", () => {
    const registration = buildFrameRegistration();
    expect(parseFrameRegistration(registration)).toEqual(registration);
    expect(
      parseFrameRegistration({ ...registration, parentFrame: 0 }),
    ).toBeNull();
  });
});

describe("semantic identity primitives", () => {
  test("produce deterministic canonical SHA-256 digests", async () => {
    const first = await semanticDigest("Synthetic accessible name");
    const second = await semanticDigest("Synthetic accessible name");
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("produce deterministic canonical stable IDs without embedding the seed", async () => {
    const first = await stableSemanticId("field", "synthetic-seed");
    const second = await stableSemanticId("field", "synthetic-seed");
    expect(first).toBe(second);
    expect(first).toMatch(/^field_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(first).not.toContain("synthetic-seed");
  });
});
