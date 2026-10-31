import { describe, expect, it, vi } from "vitest";
import {
  createDiagnosticsRequest,
  validateDiagnosticsRecord,
  ServiceDiagnosticsError,
} from "../src/service-diagnostics.ts";
const id = "req_00000000000000000000000001";
const envelope = {
  schema_id: "urn:japp:schema:desktop:service-diagnostics:v1",
  schema_version: "1.0.0",
  message_id: "msg_00000000000000000000000002",
  created_at: "2026-10-18T12:00:00Z",
  correlation_id: "corr_00000000000000000000000003",
};
const ready = {
  envelope,
  payload: {
    request_id: id,
    state: "READY",
    service_version: "0.0.1",
    api_version: "1.0.0",
  },
};
describe("finite native service diagnostics", () => {
  it("validates a closed point-in-time ready record without transport details", () => {
    expect(validateDiagnosticsRecord(ready, id)).toEqual({
      state: "READY",
      serviceVersion: "0.0.1",
      apiVersion: "1.0.0",
      checkedAt: envelope.created_at,
    });
  });
  it.each([
    null,
    {},
    { ...ready, payload: { ...ready.payload, token: "private" } },
    { ...ready, payload: { ...ready.payload, bind_port: 9999 } },
    {
      ...ready,
      payload: {
        ...ready.payload,
        request_id: "req_00000000000000000000000009",
      },
    },
    { ...ready, envelope: { ...envelope, schema_version: "2.0.0" } },
    {
      ...ready,
      payload: { ...ready.payload, service_version: "private/path" },
    },
    { ...ready, envelope: { ...envelope, created_at: "2026-02-30T12:00:00Z" } },
  ])(
    "rejects malformed, mismatched and private diagnostic values %j",
    (value) => {
      expect(() => validateDiagnosticsRecord(value, id)).toThrow(
        ServiceDiagnosticsError,
      );
    },
  );
  it("invokes only the finite command with an opaque identifier", async () => {
    const invoke = vi.fn().mockResolvedValue(ready);
    const request = createDiagnosticsRequest({ invoke, requestId: () => id });
    await expect(request.read()).resolves.toMatchObject({ state: "READY" });
    expect(invoke).toHaveBeenCalledWith("read_service_diagnostics", {
      request_id: id,
    });
  });
  it("cancels before response and discards a later completion", async () => {
    let finish: (value: unknown) => void = () => {
      /* Assigned when the synthetic read starts. */
    };
    const invoke = vi.fn((command: string) =>
      command === "read_service_diagnostics"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({}),
    );
    const request = createDiagnosticsRequest({ invoke, requestId: () => id });
    const result = request.read();
    await request.cancel();
    finish(ready);
    await expect(result).rejects.toMatchObject({ code: "CANCELLED" });
    expect(invoke).toHaveBeenCalledWith("cancel_service_request", {
      request_id: id,
    });
  });
  it("never displays an unknown native rejection or exception", async () => {
    const request = createDiagnosticsRequest({
      invoke: vi
        .fn()
        .mockRejectedValue(new Error("private token /Users/private")),
      requestId: () => id,
    });
    await expect(request.read()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
  it("cancel is idempotent and cannot repeat IPC or restart a completed request", async () => {
    const invoke = vi.fn().mockResolvedValue(ready);
    const request = createDiagnosticsRequest({ invoke, requestId: () => id });
    await request.cancel();
    await request.cancel();
    await expect(request.read()).rejects.toMatchObject({ code: "CANCELLED" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it("bounds the renderer wait and sends actual cancellation once", async () => {
    vi.useFakeTimers();
    try {
      const invoke = vi.fn((command: string) =>
        command === "read_service_diagnostics"
          ? new Promise(() => {
              /* Intentionally pending until the bounded renderer wait expires. */
            })
          : Promise.resolve({}),
      );
      const request = createDiagnosticsRequest({ invoke, requestId: () => id });
      const result = request.read();
      const expectation = expect(result).rejects.toMatchObject({
        code: "TIMEOUT",
      });
      await vi.advanceTimersByTimeAsync(6000);
      await expectation;
      expect(invoke).toHaveBeenCalledWith("cancel_service_request", {
        request_id: id,
      });
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
