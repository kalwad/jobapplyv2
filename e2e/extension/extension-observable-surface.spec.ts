// M02-W07 proof D1 — Chrome tracing provides a real wildcard over DOM event
// dispatches originating in the extension world during this bounded runtime
// observation. It begins before navigation and ends after readiness plus the
// fixed settle window; the reviewed WXT lifecycle event is the sole dispatch
// recorded in that interval.
import type { CDPSession } from "@playwright/test";
import { Buffer } from "node:buffer";

import {
  CONTENT_READY_ATTRIBUTE,
  CONTENT_READY_VALUE,
} from "../../apps/extension/src/feasibility-protocol.ts";
import { expect, LAB_ORIGIN, test } from "./support/extension-test.ts";

const MARKER_TIMEOUT_MS = 15_000;
const SETTLE_MS = 1_000;
const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.stack",
].join(",");

interface TraceFrame {
  url?: unknown;
}

interface TraceEvent {
  name?: unknown;
  args?: {
    data?: {
      type?: unknown;
      stackTrace?: unknown;
    };
  };
}

async function stopAndReadTrace(cdp: CDPSession): Promise<TraceEvent[]> {
  const completed = new Promise<Record<string, unknown>>((resolve) => {
    cdp.once("Tracing.tracingComplete", resolve);
  });
  await cdp.send("Tracing.end");
  const result = await completed;
  if (typeof result.stream !== "string") {
    throw new Error("Chromium tracing did not return a stream handle");
  }
  const handle = result.stream;
  let traceJson = "";
  try {
    for (;;) {
      const chunk = (await cdp.send("IO.read", { handle })) as {
        data?: unknown;
        base64Encoded?: unknown;
        eof?: unknown;
      };
      if (typeof chunk.data !== "string") {
        throw new Error("Chromium trace stream returned a malformed chunk");
      }
      traceJson +=
        chunk.base64Encoded === true
          ? Buffer.from(chunk.data, "base64").toString("utf8")
          : chunk.data;
      if (chunk.eof === true) {
        break;
      }
    }
  } finally {
    await cdp.send("IO.close", { handle });
  }
  const parsed = JSON.parse(traceJson) as { traceEvents?: unknown };
  if (!Array.isArray(parsed.traceEvents)) {
    throw new Error("Chromium trace is missing traceEvents");
  }
  return parsed.traceEvents as TraceEvent[];
}

function extensionEventTypes(
  events: TraceEvent[],
  extensionOrigin: string,
): string[] {
  return events.flatMap((event) => {
    const data = event.args?.data;
    if (
      event.name !== "EventDispatch" ||
      typeof data?.type !== "string" ||
      !Array.isArray(data.stackTrace)
    ) {
      return [];
    }
    const originatedInExtension = (data.stackTrace as TraceFrame[]).some(
      (frame) =>
        typeof frame.url === "string" &&
        frame.url.startsWith(`${extensionOrigin}/`),
    );
    return originatedInExtension ? [data.type] : [];
  });
}

test("the real extension dispatches only the reviewed WXT lifecycle event", async ({
  extensionContext,
  extensionId,
}) => {
  const page = await extensionContext.newPage();
  const cdp = await extensionContext.newCDPSession(page);
  await cdp.send("Tracing.start", {
    categories: TRACE_CATEGORIES,
    transferMode: "ReturnAsStream",
  });

  let events: TraceEvent[];
  try {
    await page.goto(`${LAB_ORIGIN}/native/`);
    await expect(page.locator("html")).toHaveAttribute(
      CONTENT_READY_ATTRIBUTE,
      CONTENT_READY_VALUE,
      { timeout: MARKER_TIMEOUT_MS },
    );
    await page.waitForTimeout(SETTLE_MS);
  } finally {
    // Always terminate and drain the global browser trace before another test
    // starts, including when navigation/readiness itself fails.
    events = await stopAndReadTrace(cdp);
  }

  expect(
    extensionEventTypes(events, `chrome-extension://${extensionId}`),
  ).toEqual([`${extensionId}:feasibility:wxt:content-script-started`]);
});
