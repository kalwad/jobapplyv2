/** W14 exact-URL top-frame inspection. No field execution is exposed. */
import { defineContentScript } from "wxt/utils/define-content-script";
import { browser, type Browser } from "wxt/browser";
import {
  buildFeasibilityProbe,
  parseFeasibilityAck,
  PROBE_ATTEMPT_LIMIT,
  PROBE_RETRY_DELAY_MS,
} from "../../../../src/feasibility-protocol.ts";
import {
  buildFrameRegistration,
  parseFrameRegistered,
  parseScanFrameRequest,
  type FrameContext,
} from "../../../../src/scanner-protocol.ts";
import { scanFrameDocument } from "../../../../src/field-scanner.ts";
import { DriverTransactionEngine } from "../../../../src/driver-engine.ts";
import { DynamicFrameEngine } from "../../../../src/dynamic-engine.ts";
import {
  DYNAMIC_FRAME_RECONCILE_RESULT_KIND,
  DYNAMIC_PROTOCOL_VERSION,
  parseDynamicReconcileFrameRequest,
} from "../../../../src/dynamic-protocol.ts";
import { permitsPublicDocumentUrl, PUBLIC_CONTENT_MATCHES } from "../scope.ts";

interface AsyncMessageEvent {
  addListener(
    listener: (
      message: unknown,
      sender: Browser.runtime.MessageSender,
    ) => Promise<unknown>,
  ): void;
}
let context: FrameContext | null = null;
let registeredUrl: string | null = null;
const reconciliationEngine = new DynamicFrameEngine(
  new DriverTransactionEngine(),
);

async function establish() {
  for (let attempt = 0; attempt < PROBE_ATTEMPT_LIMIT; attempt++) {
    const initialUrl = document.location.href;
    if (!permitsPublicDocumentUrl(initialUrl)) return;
    try {
      const ack: unknown = await browser.runtime.sendMessage(
        buildFeasibilityProbe(),
      );
      if (parseFeasibilityAck(ack) === null) return;
      const registered = parseFrameRegistered(
        await browser.runtime.sendMessage(buildFrameRegistration()),
      );
      if (
        registered?.frame_context.is_top_frame === true &&
        document.location.href === initialUrl &&
        permitsPublicDocumentUrl(initialUrl)
      ) {
        context = registered.frame_context;
        registeredUrl = initialUrl;
      }
      return;
    } catch {
      if (attempt + 1 < PROBE_ATTEMPT_LIMIT)
        await new Promise((resolve) =>
          setTimeout(resolve, PROBE_RETRY_DELAY_MS),
        );
    }
  }
}
const onMessage = browser.runtime.onMessage as unknown as AsyncMessageEvent;
onMessage.addListener(async (message, sender) => {
  // Recheck the live URL on every request: an SPA can leave the approved job
  // without unloading this already injected content script.
  const current = context;
  if (
    current === null ||
    registeredUrl !== document.location.href ||
    !permitsPublicDocumentUrl(document.location.href) ||
    sender.id !== browser.runtime.id ||
    sender.tab !== undefined ||
    sender.url?.startsWith(`chrome-extension://${browser.runtime.id}/`) !== true
  )
    return undefined;
  const scan = parseScanFrameRequest(message);
  if (scan !== null) return scanFrameDocument(document, current, scan);
  const reconcile = parseDynamicReconcileFrameRequest(message);
  if (
    reconcile !== null &&
    reconcile.expected_document_id === current.document_id
  )
    return {
      kind: DYNAMIC_FRAME_RECONCILE_RESULT_KIND,
      protocolVersion: DYNAMIC_PROTOCOL_VERSION,
      requestId: reconcile.requestId,
      frame_context: current,
      outcome: await reconciliationEngine.reconcile(
        document,
        current,
        reconcile.correlation_id,
      ),
    };
  // No execute, undo, dynamic action, upload, or navigation dispatcher exists.
  return undefined;
});

export default defineContentScript({
  matches: [...PUBLIC_CONTENT_MATCHES],
  allFrames: false,
  noScriptStartedPostMessage: true,
  main() {
    void establish();
  },
});
