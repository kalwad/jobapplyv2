/** W14 inspect-only transport over the actual W08/W11 wire contracts. */
import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";
import {
  BACKGROUND_GLOBAL_KEY,
  BACKGROUND_RUNTIME_MARKER,
  FEASIBILITY_PROTOCOL_VERSION,
  buildFeasibilityAck,
  parseFeasibilityProbe,
} from "../../../../src/feasibility-protocol.ts";
import {
  AGGREGATED_SCAN_RESULT_KIND,
  FRAME_REGISTERED_KIND,
  SCAN_FRAME_KIND,
  SCANNER_PROTOCOL_VERSION,
  parseFrameRegistration,
  parseFrameScanReport,
  parseScanTabRequest,
  type FrameContext,
  type ScanScope,
} from "../../../../src/scanner-protocol.ts";
import {
  DYNAMIC_PROTOCOL_VERSION,
  DYNAMIC_RECONCILE_FRAME_KIND,
  DYNAMIC_RECONCILE_TAB_RESULT_KIND,
  parseDynamicReconcileTabRequest,
  parseDynamicFrameReconcileResult,
} from "../../../../src/dynamic-protocol.ts";
import {
  semanticDigest,
  stableSemanticId,
} from "../../../../src/semantic-identity.ts";
import {
  permitsPublicDocumentUrl,
  PUBLIC_SCOPE_VERSION,
  SOURCE_INVENTORY_DIGEST,
} from "../scope.ts";

interface MessageEvent {
  addListener(
    listener: (
      message: unknown,
      sender: Browser.runtime.MessageSender,
      sendResponse: (value?: unknown) => void,
    ) => boolean | undefined,
  ): void;
}
function sameContext(left: FrameContext, right: FrameContext) {
  return (
    left.session_id === right.session_id &&
    left.frame_id === right.frame_id &&
    left.document_id === right.document_id &&
    left.document_url_digest === right.document_url_digest &&
    left.is_top_frame === right.is_top_frame
  );
}

export default defineBackground(() => {
  const epoch = crypto.randomUUID();
  const frames = new Map<number, FrameContext>();
  (globalThis as Record<string, unknown>)[BACKGROUND_GLOBAL_KEY] = {
    protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
    runtimeMarker: BACKGROUND_RUNTIME_MARKER,
  };
  (globalThis as Record<string, unknown>).__JAPP_W14_PUBLIC_INSPECTION__ = {
    mode: PUBLIC_SCOPE_VERSION,
    source_inventory_digest: SOURCE_INVENTORY_DIGEST,
    field_write_authority: false,
    top_frame_only: true,
  };
  async function register(sender: Browser.runtime.MessageSender) {
    const tabId = sender.tab?.id;
    if (
      tabId === undefined ||
      sender.frameId !== 0 ||
      sender.id !== browser.runtime.id ||
      sender.url === undefined ||
      !permitsPublicDocumentUrl(sender.url)
    )
      return undefined;
    const sessionId = await stableSemanticId(
      "session",
      `${epoch}\0${String(tabId)}`,
    );
    const context: FrameContext = {
      session_id: sessionId,
      frame_id: await stableSemanticId("frame", `${sessionId}\0top`),
      document_id: await stableSemanticId(
        "document",
        `${sessionId}\0${sender.documentId ?? sender.url}`,
      ),
      document_url_digest: await semanticDigest(
        `frame-document-url-v1\0${sender.url}`,
      ),
      is_top_frame: true,
    };
    frames.set(tabId, context);
    return {
      kind: FRAME_REGISTERED_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      frame_context: context,
    };
  }
  async function scan(tabId: number, requestId: string, scope: ScanScope) {
    const context = frames.get(tabId);
    let report: ReturnType<typeof parseFrameScanReport> = null;
    if (context !== undefined) {
      try {
        const value: unknown = await browser.tabs.sendMessage(
          tabId,
          {
            kind: SCAN_FRAME_KIND,
            protocolVersion: SCANNER_PROTOCOL_VERSION,
            requestId,
            expected_document_id: context.document_id,
            scope,
          },
          { frameId: 0 },
        );
        const parsed = parseFrameScanReport(value);
        if (
          parsed !== null &&
          parsed.requestId === requestId &&
          sameContext(context, parsed.frame_context)
        )
          report = parsed;
      } catch {
        /* Missing, changed or rejected documents stay unobserved. */
      }
    }
    return {
      kind: AGGREGATED_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId,
      tabId,
      frames: report === null ? [] : [report],
    };
  }
  async function reconcile(
    tabId: number,
    frameId: string,
    requestId: string,
    correlationId: string,
  ) {
    const context = frames.get(tabId);
    if (context?.frame_id === frameId) {
      try {
        const value: unknown = await browser.tabs.sendMessage(
          tabId,
          {
            kind: DYNAMIC_RECONCILE_FRAME_KIND,
            protocolVersion: DYNAMIC_PROTOCOL_VERSION,
            requestId,
            expected_document_id: context.document_id,
            correlation_id: correlationId,
          },
          { frameId: 0 },
        );
        const parsed = parseDynamicFrameReconcileResult(value);
        if (
          parsed !== null &&
          parsed.requestId === requestId &&
          sameContext(context, parsed.frame_context)
        )
          return {
            kind: DYNAMIC_RECONCILE_TAB_RESULT_KIND,
            protocolVersion: DYNAMIC_PROTOCOL_VERSION,
            requestId,
            outcome: parsed.outcome,
          };
      } catch {
        /* No alternate frame or URL is selected. */
      }
    }
    return {
      kind: DYNAMIC_RECONCILE_TAB_RESULT_KIND,
      protocolVersion: DYNAMIC_PROTOCOL_VERSION,
      requestId,
      outcome: { status: "FRAME_UNAVAILABLE" },
    };
  }
  function respond(
    work: Promise<unknown>,
    sendResponse: (value?: unknown) => void,
  ) {
    void work.then(sendResponse, () => {
      sendResponse(undefined);
    });
  }
  const onMessage = browser.runtime.onMessage as unknown as MessageEvent;
  onMessage.addListener((message, sender, sendResponse) => {
    const publicFrame =
      sender.id === browser.runtime.id &&
      sender.frameId === 0 &&
      sender.url !== undefined &&
      permitsPublicDocumentUrl(sender.url);
    if (publicFrame && parseFeasibilityProbe(message) !== null) {
      sendResponse(buildFeasibilityAck());
      return undefined;
    }
    if (publicFrame && parseFrameRegistration(message) !== null) {
      respond(register(sender), sendResponse);
      return true;
    }
    const trustedController =
      sender.id === browser.runtime.id &&
      sender.url === `chrome-extension://${browser.runtime.id}/manifest.json`;
    if (!trustedController) return undefined;
    const scanRequest = parseScanTabRequest(message);
    if (scanRequest !== null) {
      respond(
        scan(scanRequest.tabId, scanRequest.requestId, scanRequest.scope),
        sendResponse,
      );
      return true;
    }
    const reconciliation = parseDynamicReconcileTabRequest(message);
    if (reconciliation !== null) {
      respond(
        reconcile(
          reconciliation.tabId,
          reconciliation.frame_id,
          reconciliation.requestId,
          reconciliation.correlation_id,
        ),
        sendResponse,
      );
      return true;
    }
    // Closed inspect-only dispatch: all other messages receive no response.
    return undefined;
  });
});
