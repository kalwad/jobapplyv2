// M02-W07 feasibility content script, bounded to the loopback mock ATS
// origin only (never a broad host pattern; REQ-FORM-011).
//
// Its complete behavior: send one closed typed probe to the real service
// worker and, only after a strictly valid ACK, set one namespaced
// test-observable attribute on the document root. It never inspects inputs,
// labels, forms, buttons, required fields, job text, or ATS identity, never
// writes a form value, and never clicks anything — W08+ own every scanning
// and filling surface.
import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";

import {
  buildFeasibilityProbe,
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
  FEASIBILITY_CONTENT_MATCH,
  parseFeasibilityAck,
  PROBE_ATTEMPT_LIMIT,
  PROBE_RETRY_DELAY_MS,
} from "../src/feasibility-protocol.ts";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function establishFeasibilityProbe(): Promise<void> {
  for (let attempt = 1; attempt <= PROBE_ATTEMPT_LIMIT; attempt += 1) {
    let response: unknown;
    try {
      response = await browser.runtime.sendMessage(buildFeasibilityProbe());
    } catch {
      // sendMessage can reject while the freshly installed worker is still
      // starting; retry within the fixed bound, then stay silent (no
      // marker) so the browser proof fails loudly instead of lying.
      if (attempt < PROBE_ATTEMPT_LIMIT) {
        await delay(PROBE_RETRY_DELAY_MS);
      }
      continue;
    }
    // A received-but-invalid ACK is a protocol violation, not a startup
    // race: fail closed immediately without the readiness marker.
    if (parseFeasibilityAck(response) === null) {
      return;
    }
    document.documentElement.setAttribute(
      CONTENT_READY_ATTRIBUTE,
      CONTENT_READY_VALUE,
    );
    return;
  }
}

export default defineContentScript({
  matches: [FEASIBILITY_CONTENT_MATCH],
  // Suppress WXT's default page-world `window.postMessage` broadcast on
  // injection. WXT 0.20.27 unavoidably dispatches a document CustomEvent when
  // this content-script context is created; it carries only the fixed script
  // name and a random injection id. The real-browser proof observes its exact
  // shape, traces every extension-origin DOM dispatch during a bounded
  // pre-navigation-through-settle window, and requires the full message list
  // empty. Source/shipped-byte checks close the broader static surface.
  noScriptStartedPostMessage: true,
  main(): void {
    void establishFeasibilityProbe();
  },
});
