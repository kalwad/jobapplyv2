// Synthetic finite IPC actors are confined to this test-only bundle.
import { createRoot } from "react-dom/client";
import "@japp/ui/tokens.css";
import "../../src/shell.css";
import { DesktopShell } from "../../src/shell.tsx";
import { createDiagnosticsRequest } from "../../src/service-diagnostics.ts";
const scenario =
  new URLSearchParams(location.search).get("scenario") ?? "pending";
let reads = 0,
  cancels = 0;
const pending: { id: string; resolve: (value: unknown) => void }[] = [];
const metadata = () =>
  Promise.resolve({ appVersion: "0.0.1", tauriVersion: "2.12.4" });
const meta = (schema: string) => ({
  schema_id: schema,
  schema_version: "1.0.0",
  message_id: "msg_00000000000000000000000002",
  created_at: "2026-10-18T12:00:00Z",
  correlation_id: "corr_00000000000000000000000003",
});
const ready = (id: string) => ({
  envelope: meta("urn:japp:schema:desktop:service-diagnostics:v1"),
  payload: {
    request_id: id,
    state: "READY",
    service_version: "0.0.2",
    api_version: "1.0.0",
  },
});
const controls = {
  reads: () => reads,
  cancels: () => cancels,
  resolve(index: number) {
    const read = pending[index];
    if (read) read.resolve(ready(read.id));
  },
};
window.__serviceFixture = controls;
function createRequest() {
  let id = "";
  return createDiagnosticsRequest({
    requestId: () => {
      id = `req_${String(reads + 1).padStart(26, "0")}`;
      return id;
    },
    invoke: async (command, args) => {
      if (command === "cancel_service_request") {
        cancels++;
        return {};
      }
      if (
        command !== "read_service_diagnostics" ||
        Object.keys(args).join() !== "request_id"
      )
        throw new Error("invalid synthetic command");
      reads++;
      if (scenario === "retry" && reads === 1) {
        const record = {
          envelope: meta("urn:japp:schema:error:record:v1"),
          payload: {
            error_id: "err_00000000000000000000000004",
            occurred_at: "2026-10-18T12:00:00Z",
            origin: "DESKTOP_APP",
            correlation_id: "corr_00000000000000000000000003",
            code: "TRANSPORT_TIMEOUT",
          },
        };
        // Preserve the exact serialized native rejection shape while using
        // an Error for typed throwing; Error's message/stack are nonenumerable.
        const rejection = Object.assign(
          new Error("Synthetic native IPC rejection"),
          record,
        );
        if (JSON.stringify(rejection) !== JSON.stringify(record))
          throw new Error("Synthetic rejection shape changed");
        throw rejection;
      }
      if (scenario === "malformed")
        return {
          ...ready(id),
          payload: {
            ...ready(id).payload,
            token: "fixture-private-service-secret",
          },
        };
      if (scenario === "ready" || scenario === "retry") return ready(id);
      return new Promise((resolve) => pending.push({ id, resolve }));
    },
  });
}
const element = document.getElementById("root");
if (element === null) throw new Error("Missing fixture mount");
createRoot(element).render(
  scenario === "browser" ? (
    <DesktopShell loadMetadata={metadata} />
  ) : (
    <DesktopShell
      loadMetadata={metadata}
      createServiceRequest={createRequest}
    />
  ),
);
