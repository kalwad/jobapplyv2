// M02-W07 proof E preserved under W08 — malformed arbitrary command-shaped
// messages remain silent. Canonical W08 scan/re-resolution authority is
// exercised separately through scanner-protocol builders and E2E tests.
import { expect, test } from "./support/extension-test.ts";

const HOSTILE_MESSAGES: readonly unknown[] = [
  { command: "fill" },
  { command: "scan" },
  { command: "delete" },
  { operation: "scan" },
  { kind: "COMMAND", command: "fill" },
  { kind: "COMMAND", command: "inspect" },
  { kind: "M02_W07_PROBE", protocolVersion: 1, command: "fill" },
  { kind: "M02_W07_PROBE", protocolVersion: 1, command: "scan" },
  { kind: "M02_W07_PROBE", protocolVersion: 1, payload: {} },
  { kind: "M02_W07_PROBE", protocolVersion: 1, data: [] },
  { request: { command: "fill" } },
  { kind: "M02_W07_PROBE", protocolVersion: 1, operation: "scan" },
  { kind: "M02_W07_PROBE", protocolVersion: 1, action: "inspect" },
  { kind: "M02_W07_PROBE", protocolVersion: 1, request: {} },
];

test("the real worker preserves the probe and rejects arbitrary command-shaped messages", async ({
  extensionContext,
  extensionId,
}) => {
  // The generated manifest is already an extension-origin resource, so this
  // gains the ordinary runtime API without adding a page, permission, or
  // production testing hook.
  const runtimePage = await extensionContext.newPage();
  await runtimePage.goto(`chrome-extension://${extensionId}/manifest.json`);

  const result = await runtimePage.evaluate(async (hostileMessages) => {
    const chromeRuntime = (
      globalThis as typeof globalThis & {
        chrome: {
          runtime: { sendMessage(message: unknown): Promise<unknown> };
        };
      }
    ).chrome.runtime;
    const canonicalAck = await chromeRuntime.sendMessage({
      kind: "M02_W07_PROBE",
      protocolVersion: 1,
    });
    const hostileResponses: unknown[] = [];
    for (const message of hostileMessages) {
      hostileResponses.push(await chromeRuntime.sendMessage(message));
    }
    return { canonicalAck, hostileResponses };
  }, HOSTILE_MESSAGES);

  expect(result.canonicalAck).toEqual({
    kind: "M02_W07_ACK",
    protocolVersion: 1,
    runtimeMarker: "japp-m02-w07-feasibility-background",
  });
  expect(result.hostileResponses).toEqual(
    HOSTILE_MESSAGES.map(() => undefined),
  );
});
