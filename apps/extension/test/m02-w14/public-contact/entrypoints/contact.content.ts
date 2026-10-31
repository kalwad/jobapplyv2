/** W14 exact-URL top-frame, fixed synthetic ordinary-contact evaluation. */
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
import {
  DYNAMIC_FRAME_RECONCILE_RESULT_KIND,
  DYNAMIC_PROTOCOL_VERSION,
  parseDynamicReconcileFrameRequest,
} from "../../../../src/dynamic-protocol.ts";
import {
  permitsPublicDocumentUrl,
  PUBLIC_CONTENT_MATCHES,
} from "../../public-inspection/scope.ts";
import { ContactFrameExecutor } from "../executor.ts";
import { PREPARE, PREPARED, RESULT, parseContactRequest } from "../protocol.ts";

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
let executor: ContactFrameExecutor | null = null;

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
        executor = new ContactFrameExecutor(document, context, initialUrl);
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
  const contact = parseContactRequest(message);
  if (contact !== null && executor !== null) {
    const outcome =
      contact.kind === PREPARE
        ? await executor.prepare(contact.plan, contact.requestId)
        : await executor.execute(
            contact.plan_id,
            contact.field_id,
            contact.decision,
          );
    return {
      kind: contact.kind === PREPARE ? PREPARED : RESULT,
      version: 1,
      requestId: contact.requestId,
      ...outcome,
    };
  }
  const scan = parseScanFrameRequest(message);
  if (scan !== null) return scanFrameDocument(document, current, scan);
  const reconcile = parseDynamicReconcileFrameRequest(message);
  if (
    executor !== null &&
    reconcile !== null &&
    reconcile.expected_document_id === current.document_id
  )
    return {
      kind: DYNAMIC_FRAME_RECONCILE_RESULT_KIND,
      protocolVersion: DYNAMIC_PROTOCOL_VERSION,
      requestId: reconcile.requestId,
      frame_context: current,
      outcome: await executor.dynamic.reconcile(
        document,
        current,
        reconcile.correlation_id,
      ),
    };
  // No canonical direct execute, undo, upload, final-action or navigation dispatcher.
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
