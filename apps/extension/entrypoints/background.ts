// M02-W08/W10 background service worker. It preserves the verified W07 probe,
// routes canonical scans/re-resolution, and adds only typed field transaction,
// undo, and read-only navigation-identification messages to the exact
// registered frame. It exposes no arbitrary page command or navigation action.
import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";

import {
  BACKGROUND_GLOBAL_KEY,
  BACKGROUND_RUNTIME_MARKER,
  buildFeasibilityAck,
  FEASIBILITY_CONTENT_MATCHES,
  FEASIBILITY_PROTOCOL_VERSION,
  parseFeasibilityProbe,
} from "../src/feasibility-protocol.ts";
import {
  AGGREGATED_SCAN_RESULT_KIND,
  FRAME_REGISTERED_KIND,
  FRAME_SCAN_RESULT_KIND,
  MAX_FRAME_AGENTS_PER_TAB,
  parseFrameRegistration,
  parseFrameReresolutionResult,
  parseFrameScanReport,
  parseReresolveTabRequest,
  parseScanTabRequest,
  RERESOLVE_FRAME_KIND,
  RERESOLVE_TAB_RESULT_KIND,
  SCANNER_PROTOCOL_VERSION,
  SCAN_FRAME_KIND,
  type FrameContext,
  type FrameReresolutionResult,
  type FrameScanReport,
  type ReresolveTabRequest,
  type ReresolveTabResult,
  type ScanTabRequest,
} from "../src/scanner-protocol.ts";
import {
  DRIVER_PROTOCOL_VERSION,
  EXECUTE_FRAME_KIND,
  EXECUTE_TAB_RESULT_KIND,
  IDENTIFY_NAV_FRAME_KIND,
  IDENTIFY_NAV_TAB_RESULT_KIND,
  parseExecuteTabRequest,
  parseFrameExecuteResult,
  parseFrameNavResult,
  parseFrameUndoResult,
  parseIdentifyNavTabRequest,
  parseUndoTabRequest,
  type ExecuteTabRequest,
  type ExecuteTabResult,
  type IdentifyNavTabRequest,
  type IdentifyNavTabResult,
  UNDO_FRAME_KIND,
  UNDO_TAB_RESULT_KIND,
  type UndoTabRequest,
  type UndoTabResult,
} from "../src/driver-protocol.ts";
import { semanticDigest, stableSemanticId } from "../src/semantic-identity.ts";

interface RegisteredFrame {
  readonly chromeFrameId: number;
  readonly frameContext: FrameContext;
}

type MessageListener = (
  message: unknown,
  sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

interface MessageEvent {
  addListener(listener: MessageListener): void;
}

function matchesPermittedFrameUrl(url: string): boolean {
  return FEASIBILITY_CONTENT_MATCHES.some((match) =>
    url.startsWith(match.slice(0, -1)),
  );
}

function sameFrameContext(left: FrameContext, right: FrameContext): boolean {
  return (
    left.session_id === right.session_id &&
    left.frame_id === right.frame_id &&
    left.document_id === right.document_id &&
    left.document_url_digest === right.document_url_digest &&
    left.is_top_frame === right.is_top_frame
  );
}

function respondAsync(
  response: Promise<unknown>,
  sendResponse: (value?: unknown) => void,
): void {
  void response.then(sendResponse, () => {
    sendResponse(undefined);
  });
}

export default defineBackground(() => {
  const backgroundEpoch = crypto.randomUUID();
  const framesByTab = new Map<number, Map<number, RegisteredFrame>>();

  (globalThis as Record<string, unknown>)[BACKGROUND_GLOBAL_KEY] = {
    protocolVersion: FEASIBILITY_PROTOCOL_VERSION,
    runtimeMarker: BACKGROUND_RUNTIME_MARKER,
  };

  async function registerFrame(
    sender: Browser.runtime.MessageSender,
  ): Promise<unknown> {
    const tabId = sender.tab?.id;
    const chromeFrameId = sender.frameId;
    const documentUrl = sender.url;
    if (
      tabId === undefined ||
      chromeFrameId === undefined ||
      documentUrl === undefined ||
      !matchesPermittedFrameUrl(documentUrl) ||
      sender.id !== browser.runtime.id
    ) {
      return undefined;
    }
    const sessionId = await stableSemanticId(
      "session",
      `${backgroundEpoch}\0${String(tabId)}`,
    );
    const frameId = await stableSemanticId(
      "frame",
      `${sessionId}\0${String(chromeFrameId)}`,
    );
    const documentId = await stableSemanticId(
      "document",
      `${sessionId}\0${String(chromeFrameId)}\0${sender.documentId ?? documentUrl}`,
    );
    const frameContext: FrameContext = {
      session_id: sessionId,
      frame_id: frameId,
      document_id: documentId,
      document_url_digest: await semanticDigest(
        `frame-document-url-v1\0${documentUrl}`,
      ),
      is_top_frame: chromeFrameId === 0,
    };
    const tabFrames =
      framesByTab.get(tabId) ?? new Map<number, RegisteredFrame>();
    if (
      !tabFrames.has(chromeFrameId) &&
      tabFrames.size >= MAX_FRAME_AGENTS_PER_TAB
    ) {
      return undefined;
    }
    tabFrames.set(chromeFrameId, { chromeFrameId, frameContext });
    framesByTab.set(tabId, tabFrames);
    return {
      kind: FRAME_REGISTERED_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      frame_context: frameContext,
    };
  }

  async function scanTab(request: ScanTabRequest): Promise<unknown> {
    const registrations = [
      ...(framesByTab.get(request.tabId)?.values() ?? []),
    ].sort((left, right) => left.chromeFrameId - right.chromeFrameId);
    const reports: FrameScanReport[] = [];
    for (const registration of registrations) {
      let report: FrameScanReport | null = null;
      try {
        const response: unknown = await browser.tabs.sendMessage(
          request.tabId,
          {
            kind: SCAN_FRAME_KIND,
            protocolVersion: SCANNER_PROTOCOL_VERSION,
            requestId: request.requestId,
            expected_document_id: registration.frameContext.document_id,
            scope: request.scope,
          },
          { frameId: registration.chromeFrameId },
        );
        const parsed = parseFrameScanReport(response);
        if (
          parsed !== null &&
          parsed.requestId === request.requestId &&
          sameFrameContext(parsed.frame_context, registration.frameContext)
        ) {
          report = parsed;
        }
      } catch {
        // The frame disappeared or its document changed between registration
        // and this bounded request. Preserve its identity as unavailable.
      }
      reports.push(
        report ?? {
          kind: FRAME_SCAN_RESULT_KIND,
          protocolVersion: SCANNER_PROTOCOL_VERSION,
          requestId: request.requestId,
          frame_context: registration.frameContext,
          root_status: "UNAVAILABLE",
          root_candidate_count: 0,
          scan_boundary: request.scope.kind,
          descriptors: [],
        },
      );
    }
    return {
      kind: AGGREGATED_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: request.requestId,
      tabId: request.tabId,
      frames: reports,
    };
  }

  async function reresolveTab(
    request: ReresolveTabRequest,
  ): Promise<ReresolveTabResult> {
    const registration = [
      ...(framesByTab.get(request.tabId)?.values() ?? []),
    ].find(
      (candidate) =>
        candidate.frameContext.frame_id === request.address.frame_id,
    );
    if (registration === undefined) {
      return {
        kind: RERESOLVE_TAB_RESULT_KIND,
        protocolVersion: SCANNER_PROTOCOL_VERSION,
        requestId: request.requestId,
        resolution: { status: "UNRESOLVED", reason: "FRAME_UNAVAILABLE" },
      };
    }
    let frameResult: FrameReresolutionResult | null = null;
    try {
      const response: unknown = await browser.tabs.sendMessage(
        request.tabId,
        {
          kind: RERESOLVE_FRAME_KIND,
          protocolVersion: SCANNER_PROTOCOL_VERSION,
          requestId: request.requestId,
          address: request.address,
        },
        { frameId: registration.chromeFrameId },
      );
      const parsed = parseFrameReresolutionResult(response);
      if (
        parsed !== null &&
        parsed.requestId === request.requestId &&
        sameFrameContext(parsed.frame_context, registration.frameContext)
      ) {
        frameResult = parsed;
      }
    } catch {
      // A disappeared frame is a typed unresolved result, never a fallback.
    }
    return {
      kind: RERESOLVE_TAB_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: request.requestId,
      resolution: frameResult?.resolution ?? {
        status: "UNRESOLVED",
        reason: "FRAME_UNAVAILABLE",
      },
    };
  }

  function registrationForFrame(
    tabId: number,
    frameId: string,
  ): RegisteredFrame | undefined {
    return [...(framesByTab.get(tabId)?.values() ?? [])].find(
      (candidate) => candidate.frameContext.frame_id === frameId,
    );
  }

  async function executeTab(
    request: ExecuteTabRequest,
  ): Promise<ExecuteTabResult> {
    const registration = registrationForFrame(
      request.tabId,
      request.transaction.address.frame_id,
    );
    if (registration === undefined) {
      return {
        kind: EXECUTE_TAB_RESULT_KIND,
        protocolVersion: DRIVER_PROTOCOL_VERSION,
        requestId: request.requestId,
        outcome: { status: "FRAME_UNAVAILABLE" },
      };
    }
    try {
      const response: unknown = await browser.tabs.sendMessage(
        request.tabId,
        {
          kind: EXECUTE_FRAME_KIND,
          protocolVersion: DRIVER_PROTOCOL_VERSION,
          requestId: request.requestId,
          transaction: request.transaction,
        },
        { frameId: registration.chromeFrameId },
      );
      const parsed = parseFrameExecuteResult(response);
      if (
        parsed !== null &&
        parsed.requestId === request.requestId &&
        sameFrameContext(parsed.frame_context, registration.frameContext)
      ) {
        return {
          kind: EXECUTE_TAB_RESULT_KIND,
          protocolVersion: DRIVER_PROTOCOL_VERSION,
          requestId: request.requestId,
          outcome: {
            status: "COMPLETED",
            result: parsed.result,
            undo_available: parsed.undo_available,
            diagnostics: parsed.diagnostics,
          },
        };
      }
    } catch {
      // A replaced or disappeared frame is unavailable; no alternate frame
      // or target is selected.
    }
    return {
      kind: EXECUTE_TAB_RESULT_KIND,
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: request.requestId,
      outcome: { status: "FRAME_UNAVAILABLE" },
    };
  }

  async function undoTab(request: UndoTabRequest): Promise<UndoTabResult> {
    const registration = registrationForFrame(
      request.tabId,
      request.undo.address.frame_id,
    );
    if (registration === undefined) {
      return {
        kind: UNDO_TAB_RESULT_KIND,
        protocolVersion: DRIVER_PROTOCOL_VERSION,
        requestId: request.requestId,
        outcome: { status: "FRAME_UNAVAILABLE" },
      };
    }
    try {
      const response: unknown = await browser.tabs.sendMessage(
        request.tabId,
        {
          kind: UNDO_FRAME_KIND,
          protocolVersion: DRIVER_PROTOCOL_VERSION,
          requestId: request.requestId,
          undo: request.undo,
        },
        { frameId: registration.chromeFrameId },
      );
      const parsed = parseFrameUndoResult(response);
      if (
        parsed !== null &&
        parsed.requestId === request.requestId &&
        sameFrameContext(parsed.frame_context, registration.frameContext)
      ) {
        return {
          kind: UNDO_TAB_RESULT_KIND,
          protocolVersion: DRIVER_PROTOCOL_VERSION,
          requestId: request.requestId,
          outcome: parsed.outcome,
        };
      }
    } catch {
      // No fallback target is permitted for restoration.
    }
    return {
      kind: UNDO_TAB_RESULT_KIND,
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: request.requestId,
      outcome: { status: "FRAME_UNAVAILABLE" },
    };
  }

  async function identifyNavigation(
    request: IdentifyNavTabRequest,
  ): Promise<IdentifyNavTabResult> {
    const registration = [
      ...(framesByTab.get(request.tabId)?.values() ?? []),
    ].find((candidate) => candidate.frameContext.is_top_frame);
    if (registration === undefined) {
      return {
        kind: IDENTIFY_NAV_TAB_RESULT_KIND,
        protocolVersion: DRIVER_PROTOCOL_VERSION,
        requestId: request.requestId,
        outcome: { status: "FRAME_UNAVAILABLE" },
      };
    }
    try {
      const response: unknown = await browser.tabs.sendMessage(
        request.tabId,
        {
          kind: IDENTIFY_NAV_FRAME_KIND,
          protocolVersion: DRIVER_PROTOCOL_VERSION,
          requestId: request.requestId,
        },
        { frameId: registration.chromeFrameId },
      );
      const parsed = parseFrameNavResult(response);
      if (
        parsed !== null &&
        parsed.requestId === request.requestId &&
        sameFrameContext(parsed.frame_context, registration.frameContext)
      ) {
        return {
          kind: IDENTIFY_NAV_TAB_RESULT_KIND,
          protocolVersion: DRIVER_PROTOCOL_VERSION,
          requestId: request.requestId,
          outcome: {
            status: "COMPLETED",
            identification: parsed.identification,
          },
        };
      }
    } catch {
      // Identification is scoped to the registered top frame only.
    }
    return {
      kind: IDENTIFY_NAV_TAB_RESULT_KIND,
      protocolVersion: DRIVER_PROTOCOL_VERSION,
      requestId: request.requestId,
      outcome: { status: "FRAME_UNAVAILABLE" },
    };
  }

  const onMessage = browser.runtime.onMessage as unknown as MessageEvent;
  onMessage.addListener((message, sender, sendResponse) => {
    if (parseFeasibilityProbe(message) !== null) {
      sendResponse(buildFeasibilityAck());
      return undefined;
    }
    if (parseFrameRegistration(message) !== null) {
      respondAsync(registerFrame(sender), sendResponse);
      return true;
    }
    const extensionOrigin = `chrome-extension://${browser.runtime.id}/`;
    const controllerSender =
      sender.id === browser.runtime.id &&
      sender.url?.startsWith(extensionOrigin) === true;
    if (!controllerSender) {
      return undefined;
    }
    const scanRequest = parseScanTabRequest(message);
    if (scanRequest !== null) {
      respondAsync(scanTab(scanRequest), sendResponse);
      return true;
    }
    const reresolveRequest = parseReresolveTabRequest(message);
    if (reresolveRequest !== null) {
      respondAsync(reresolveTab(reresolveRequest), sendResponse);
      return true;
    }
    const executeRequest = parseExecuteTabRequest(message);
    if (executeRequest !== null) {
      respondAsync(executeTab(executeRequest), sendResponse);
      return true;
    }
    const undoRequest = parseUndoTabRequest(message);
    if (undoRequest !== null) {
      respondAsync(undoTab(undoRequest), sendResponse);
      return true;
    }
    const navigationRequest = parseIdentifyNavTabRequest(message);
    if (navigationRequest !== null) {
      respondAsync(identifyNavigation(navigationRequest), sendResponse);
      return true;
    }
    return undefined;
  });
});
