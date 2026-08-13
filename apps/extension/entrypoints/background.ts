// M02-W07 background service worker: the minimal real MV3 runtime.
//
// It does exactly two things — publish a fixed identity marker on the
// worker global scope (so the Playwright harness can prove the observed
// service worker is this runtime) and answer the closed feasibility probe.
// Content-script messages are untrusted and validated strictly (spec §5.4:
// the service worker validates content-script messages); anything but the
// exact probe receives no response.
import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

import {
  BACKGROUND_GLOBAL_KEY,
  BACKGROUND_RUNTIME_MARKER,
  buildFeasibilityAck,
  FEASIBILITY_PROTOCOL_VERSION,
  parseFeasibilityProbe,
} from "../src/feasibility-protocol.ts";

export default defineBackground(() => {
  (globalThis as Record<string, unknown>)[BACKGROUND_GLOBAL_KEY] = {
    protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
    runtimeMarker: BACKGROUND_RUNTIME_MARKER,
  };

  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender,
      sendResponse: (response?: unknown) => void,
    ): undefined => {
      if (parseFeasibilityProbe(message) !== null) {
        // The ACK is synchronous and carries only fixed non-sensitive
        // feasibility metadata; there is no private state to expose.
        sendResponse(buildFeasibilityAck());
      }
      return undefined;
    },
  );
});
