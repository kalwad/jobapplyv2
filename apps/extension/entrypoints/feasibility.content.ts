// M02-W08/W10 frame-local feasibility agent. Every permitted frame gets this
// same content script and accesses only its own `document`; it never reads
// parent, child, contentWindow, or contentDocument DOM. The W10 surface is a
// closed field transaction/undo protocol plus read-only navigation-candidate
// research; navigation execution is intentionally absent.
import { defineContentScript } from "wxt/utils/define-content-script";
import { browser, type Browser } from "wxt/browser";

import {
  buildFeasibilityProbe,
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
  FEASIBILITY_CONTENT_MATCHES,
  parseFeasibilityAck,
  PROBE_ATTEMPT_LIMIT,
  PROBE_RETRY_DELAY_MS,
} from "../src/feasibility-protocol.ts";
import {
  reresolveFrameAddress,
  scanFrameDocument,
} from "../src/field-scanner.ts";
import {
  DriverTransactionEngine,
  identifyNavigationCandidate,
} from "../src/driver-engine.ts";
import {
  DRIVER_PROTOCOL_VERSION,
  FRAME_EXECUTE_RESULT_KIND,
  FRAME_NAV_RESULT_KIND,
  FRAME_UNDO_RESULT_KIND,
  parseExecuteFrameRequest,
  parseIdentifyNavFrameRequest,
  parseUndoFrameRequest,
} from "../src/driver-protocol.ts";
import {
  buildFrameRegistration,
  type FrameContext,
  parseFrameRegistered,
  parseReresolveFrameRequest,
  parseScanFrameRequest,
} from "../src/scanner-protocol.ts";

type AsyncMessageListener = (
  message: unknown,
  sender: Browser.runtime.MessageSender,
) => Promise<unknown>;

interface AsyncMessageEvent {
  addListener(listener: AsyncMessageListener): void;
}

let frameContext: FrameContext | null = null;
const driverEngine = new DriverTransactionEngine();

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function establishFeasibilityAgent(): Promise<void> {
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
    const registration = parseFrameRegistered(
      await browser.runtime.sendMessage(buildFrameRegistration()),
    );
    if (registration === null) {
      return;
    }
    frameContext = registration.frame_context;
    document.documentElement.setAttribute(
      CONTENT_READY_ATTRIBUTE,
      CONTENT_READY_VALUE,
    );
    return;
  }
}

const onMessage = browser.runtime.onMessage as unknown as AsyncMessageEvent;
onMessage.addListener(async (message, sender) => {
  const currentContext = frameContext;
  const extensionOrigin = `chrome-extension://${browser.runtime.id}/`;
  if (
    currentContext === null ||
    sender.id !== browser.runtime.id ||
    sender.tab !== undefined ||
    sender.url?.startsWith(extensionOrigin) !== true
  ) {
    return undefined;
  }
  const scanRequest = parseScanFrameRequest(message);
  if (scanRequest !== null) {
    return scanFrameDocument(document, currentContext, scanRequest);
  }
  const reresolveRequest = parseReresolveFrameRequest(message);
  if (reresolveRequest !== null) {
    return reresolveFrameAddress(document, currentContext, reresolveRequest);
  }
  const executeRequest = parseExecuteFrameRequest(message);
  if (executeRequest !== null) {
    const execution = await driverEngine.execute(
      document,
      currentContext,
      executeRequest.transaction,
    );
    return {
      kind: FRAME_EXECUTE_RESULT_KIND,
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: executeRequest.requestId,
      frame_context: currentContext,
      result: execution.result,
      undo_available: execution.undoAvailable,
      diagnostics: execution.diagnostics,
    };
  }
  const undoRequest = parseUndoFrameRequest(message);
  if (undoRequest !== null) {
    const outcome = await driverEngine.undo(
      document,
      currentContext,
      undoRequest.undo,
    );
    return {
      kind: FRAME_UNDO_RESULT_KIND,
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: undoRequest.requestId,
      frame_context: currentContext,
      outcome,
    };
  }
  const navigationRequest = parseIdentifyNavFrameRequest(message);
  if (navigationRequest !== null) {
    return {
      kind: FRAME_NAV_RESULT_KIND,
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: navigationRequest.requestId,
      frame_context: currentContext,
      identification: await identifyNavigationCandidate(document),
    };
  }
  return undefined;
});

export default defineContentScript({
  matches: [...FEASIBILITY_CONTENT_MATCHES],
  allFrames: true,
  // Suppress WXT's default page-world `window.postMessage` broadcast on
  // injection. WXT 0.20.27 unavoidably dispatches a document CustomEvent when
  // this content-script context is created; it carries only the fixed script
  // name and a random injection id. The real-browser proof observes its exact
  // shape, traces every extension-origin DOM dispatch during a bounded
  // pre-navigation-through-settle window, and requires the full message list
  // empty. Source/shipped-byte checks close the broader static surface.
  noScriptStartedPostMessage: true,
  main(): void {
    void establishFeasibilityAgent();
  },
});
