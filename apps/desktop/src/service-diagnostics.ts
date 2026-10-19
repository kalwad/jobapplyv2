import { invoke as nativeInvoke, isTauri } from "@tauri-apps/api/core";
import { ERROR_CATALOG_V1 } from "@japp/contracts/error-catalog";
import type { ErrorTaxonomyV1ErrorCode } from "@japp/contracts/generated";

export type ServiceState =
  | "UNAVAILABLE"
  | "STARTING"
  | "STOPPING"
  | "STOPPED"
  | "FAILED"
  | "CLEANUP_FAILED"
  | "CANCELLED";
export type ServiceDiagnostics =
  | {
      readonly state: "READY";
      readonly serviceVersion: string;
      readonly apiVersion: string;
      readonly checkedAt: string;
    }
  | { readonly state: ServiceState; readonly checkedAt: string };
export class ServiceDiagnosticsError extends Error {
  constructor(
    readonly code:
      "UNAVAILABLE" | "INVALID" | "CANCELLED" | "TIMEOUT" | "NATIVE",
    readonly nativeCode?: ErrorTaxonomyV1ErrorCode,
  ) {
    super(
      nativeCode === undefined
        ? "Local service diagnostics are unavailable."
        : ERROR_CATALOG_V1[nativeCode].default_message,
    );
    this.name = "ServiceDiagnosticsError";
  }
}
const STABLE = /^[a-z][a-z0-9]{0,15}_[0-9A-HJKMNP-TV-Z]{26}$/;
const REQUEST_ID = /^req_[0-9A-HJKMNP-TV-Z]{26}$/;
const VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const STATES: readonly string[] = [
  "UNAVAILABLE",
  "STARTING",
  "STOPPING",
  "STOPPED",
  "FAILED",
  "CLEANUP_FAILED",
  "CANCELLED",
];
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new ServiceDiagnosticsError("INVALID");
  return value as Record<string, unknown>;
}
function exact(
  value: Record<string, unknown>,
  fields: readonly string[],
): void {
  if (
    Object.keys(value).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(value, key))
  )
    throw new ServiceDiagnosticsError("INVALID");
}
function text(value: unknown, pattern: RegExp, limit = 96): value is string {
  return (
    typeof value === "string" && value.length <= limit && pattern.test(value)
  );
}
function timestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)
  )
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.valueOf()) &&
    date.toISOString().slice(0, 19) === value.slice(0, 19)
  );
}
export function validateDiagnosticsRecord(
  value: unknown,
  expectedRequest: string,
): ServiceDiagnostics {
  const record = object(value);
  exact(record, ["envelope", "payload"]);
  const meta = object(record.envelope);
  exact(meta, [
    "schema_id",
    "schema_version",
    "message_id",
    "created_at",
    "correlation_id",
  ]);
  if (
    !text(meta.schema_version, /^1\.0\.(?:0|[1-9]\d*)$/) ||
    !text(meta.message_id, STABLE) ||
    !text(meta.correlation_id, STABLE) ||
    !timestamp(meta.created_at)
  )
    throw new ServiceDiagnosticsError("INVALID");
  const payload = object(record.payload);
  if (meta.schema_id === "urn:japp:schema:error:record:v1") {
    exact(payload, [
      "error_id",
      "code",
      "occurred_at",
      "origin",
      "correlation_id",
    ]);
    if (
      !text(payload.error_id, STABLE) ||
      !timestamp(payload.occurred_at) ||
      payload.origin !== "DESKTOP_APP" ||
      payload.correlation_id !== meta.correlation_id ||
      typeof payload.code !== "string" ||
      !Object.hasOwn(ERROR_CATALOG_V1, payload.code)
    )
      throw new ServiceDiagnosticsError("INVALID");
    throw new ServiceDiagnosticsError(
      "NATIVE",
      payload.code as ErrorTaxonomyV1ErrorCode,
    );
  }
  if (
    meta.schema_id !== "urn:japp:schema:desktop:service-diagnostics:v1" ||
    payload.request_id !== expectedRequest ||
    !REQUEST_ID.test(expectedRequest)
  )
    throw new ServiceDiagnosticsError("INVALID");
  if (payload.state === "READY") {
    exact(payload, ["request_id", "state", "service_version", "api_version"]);
    if (
      !text(payload.service_version, VERSION) ||
      !text(payload.api_version, VERSION)
    )
      throw new ServiceDiagnosticsError("INVALID");
    return {
      state: "READY",
      serviceVersion: payload.service_version,
      apiVersion: payload.api_version,
      checkedAt: meta.created_at,
    };
  }
  exact(payload, ["request_id", "state"]);
  if (typeof payload.state !== "string" || !STATES.includes(payload.state))
    throw new ServiceDiagnosticsError("INVALID");
  return { state: payload.state as ServiceState, checkedAt: meta.created_at };
}
export interface DiagnosticsRequest {
  readonly id: string;
  read(): Promise<ServiceDiagnostics>;
  cancel(): Promise<void>;
}
export type DiagnosticsRequestFactory = () => DiagnosticsRequest;
type Invoke = (
  command: string,
  args: Record<string, unknown>,
) => Promise<unknown>;
interface RequestDependencies {
  readonly invoke: Invoke;
  readonly requestId: () => string;
}
export const serviceDiagnosticsAvailable = () => isTauri();
function requestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = "";
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  for (let i = 0; i < 26; i++) {
    encoded = alphabet.charAt(Number(value & 31n)) + encoded;
    value >>= 5n;
  }
  return `req_${encoded}`;
}
/** Finite IPC only: no transport address, token, process path or arbitrary operation. */
export function createDiagnosticsRequest(
  dependencies: RequestDependencies = { invoke: nativeInvoke, requestId },
): DiagnosticsRequest {
  const id = dependencies.requestId();
  if (!REQUEST_ID.test(id)) throw new ServiceDiagnosticsError("INVALID");
  let cancelled = false,
    started = false,
    finished = false,
    cancelSent = false;
  function cancellationRequested(): boolean {
    return cancelled;
  }
  let rejectLocal: ((reason: ServiceDiagnosticsError) => void) | undefined;
  async function sendCancellation(): Promise<void> {
    if (cancelSent) return;
    cancelSent = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(() =>
          dependencies.invoke("cancel_service_request", { request_id: id }),
        ),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1000);
        }),
      ]);
    } catch {
      /* IPC exceptions never become UI text. */
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return {
    id,
    async read() {
      if (cancelled) throw new ServiceDiagnosticsError("CANCELLED");
      if (started) throw new ServiceDiagnosticsError("INVALID");
      started = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const local = new Promise<never>((_, reject) => {
        rejectLocal = reject;
        timer = setTimeout(() => {
          cancelled = true;
          reject(new ServiceDiagnosticsError("TIMEOUT"));
          void sendCancellation();
        }, 6000);
      });
      try {
        const value = await Promise.race([
          Promise.resolve().then(() =>
            dependencies.invoke("read_service_diagnostics", { request_id: id }),
          ),
          local,
        ]);
        if (cancellationRequested())
          throw new ServiceDiagnosticsError("CANCELLED");
        return validateDiagnosticsRecord(value, id);
      } catch (error) {
        if (error instanceof ServiceDiagnosticsError) throw error;
        try {
          return validateDiagnosticsRecord(error, id);
        } catch (checked) {
          if (
            checked instanceof ServiceDiagnosticsError &&
            checked.code === "NATIVE"
          )
            throw checked;
        }
        throw new ServiceDiagnosticsError("UNAVAILABLE");
      } finally {
        finished = true;
        rejectLocal = undefined;
        if (timer !== undefined) clearTimeout(timer);
      }
    },
    async cancel() {
      if (finished) return;
      cancelled = true;
      rejectLocal?.(new ServiceDiagnosticsError("CANCELLED"));
      await sendCancellation();
    },
  };
}
