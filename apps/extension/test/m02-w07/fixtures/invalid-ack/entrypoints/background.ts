// Test-isolated transport boundary: prove the actual production content script
// receives an invalid ACK and stays fail-closed. Nothing here is included in
// the canonical extension build.
import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

import { parseFeasibilityProbe } from "../../../../../src/feasibility-protocol.ts";

const PROBE_COUNT_KEY = "__JAPP_M02_W07_INVALID_ACK_PROBE_COUNT__";

export default defineBackground(() => {
  const host = globalThis as Record<string, unknown>;
  host[PROBE_COUNT_KEY] = 0;
  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender,
      sendResponse: (response?: unknown) => void,
    ): undefined => {
      if (parseFeasibilityProbe(message) !== null) {
        host[PROBE_COUNT_KEY] = Number(host[PROBE_COUNT_KEY]) + 1;
        sendResponse({
          kind: "M02_W07_INVALID_ACK",
          protocolVersion: 1,
          runtimeMarker: "invalid-test-only-runtime",
        });
      }
      return undefined;
    },
  );
});
