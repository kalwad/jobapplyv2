import { describe, expect, it } from "vitest";
import {
  createContractValidator,
  loadSchemaCatalog,
  validateEnvelopedRecord,
} from "../../../packages/contracts/src/index.ts";
import { validateDiagnosticsRecord } from "../src/service-diagnostics.ts";
const catalog = loadSchemaCatalog();
const validator = createContractValidator(catalog);
const request_id = "req_00000000000000000000000001";
const envelope = {
  schema_id: "urn:japp:schema:desktop:service-diagnostics:v1",
  schema_version: "1.0.0",
  message_id: "msg_00000000000000000000000002",
  created_at: "2026-10-18T12:00:00Z",
  correlation_id: "corr_00000000000000000000000003",
};
describe("canonical diagnostics IPC schemas", () => {
  it("validates the canonical closed ready and actual lifecycle payloads", () => {
    for (const payload of [
      {
        request_id,
        state: "READY",
        service_version: "0.0.1",
        api_version: "1.0.0",
      },
      { request_id, state: "STARTING" },
      { request_id, state: "CANCELLED" },
    ]) {
      const record = { envelope, payload };
      expect(
        validateEnvelopedRecord(record, { catalog, validator }).valid,
      ).toBe(true);
      expect(() => validateDiagnosticsRecord(record, request_id)).not.toThrow();
    }
  });
  it("rejects transport parameters, unknown states and false partial success", () => {
    for (const payload of [
      { request_id, state: "READY" },
      {
        request_id,
        state: "READY",
        service_version: "0.0.1",
        api_version: "1.0.0",
        token: "secret",
      },
      { request_id, state: "ONLINE" },
      { request_id, state: "STARTING", bind_port: 80 },
    ]) {
      const record = { envelope, payload };
      expect(
        validateEnvelopedRecord(record, { catalog, validator }).valid,
      ).toBe(false);
      expect(() => validateDiagnosticsRecord(record, request_id)).toThrow();
    }
  });
  it("keeps request and cancellation schemas closed", () => {
    const request = "urn:japp:schema:desktop:service-request:v1";
    expect(validator.validateInstance(request, { request_id }).valid).toBe(
      true,
    );
    expect(
      validator.validateInstance(request, { request_id, url: "private" }).valid,
    ).toBe(false);
    const cancel = "urn:japp:schema:desktop:service-cancellation:v1";
    expect(
      validator.validateInstance(cancel, {
        request_id,
        outcome: "CANCELLATION_REQUESTED",
      }).valid,
    ).toBe(true);
    expect(
      validator.validateInstance(cancel, { request_id, outcome: "CANCELLED" })
        .valid,
    ).toBe(false);
  });
});
