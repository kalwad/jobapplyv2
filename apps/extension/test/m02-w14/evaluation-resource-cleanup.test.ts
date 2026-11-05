import type { BrowserContext } from "@playwright/test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { launchContact } from "../../../../e2e/extension/public-contact/contact-harness.ts";
import { launchInspection } from "../../../../e2e/extension/public-research/inspection-harness.ts";
import { CONTACT_SCOPE } from "./public-contact/protocol.ts";
import { PUBLIC_CONTENT_MATCHES } from "./public-inspection/scope.ts";

const launchBrowser = vi.hoisted(() =>
  vi.fn<(profile: string) => Promise<BrowserContext>>(),
);

// Every browser operation below is a fake. No browser, site or socket is opened.
vi.mock("@playwright/test", () => ({
  chromium: { launchPersistentContext: launchBrowser },
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, rmSync: vi.fn(actual.rmSync) };
});
const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
type Kind = "contact" | "inspection";
type Stage = "launch" | "http" | "websocket" | "late";
const removalOptions = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 100,
};
let sandbox = "";
let profile = "";
let buildDirectory = "";

function page() {
  return {
    goto: vi.fn(() => Promise.resolve()),
    evaluate: vi.fn(() => Promise.resolve(true)),
    close: vi.fn(() => Promise.resolve()),
  };
}
function prepare(
  kind: Kind,
  stage?: Stage,
  error = new Error("synthetic setup failure"),
) {
  const probe = page();
  const controller = page();
  const worker = {
    url: () => "chrome-extension://owned-test-extension/worker.js",
    evaluate: vi.fn(() => Promise.resolve({ mode: CONTACT_SCOPE })),
  };
  const context = {
    on: vi.fn(),
    route: vi.fn(() => Promise.resolve()),
    routeWebSocket: vi.fn(() => Promise.resolve()),
    exposeBinding: vi.fn(() => Promise.resolve()),
    addInitScript: vi.fn(() => Promise.resolve()),
    pages: () => [],
    serviceWorkers: () => [worker],
    newPage: vi.fn(() => Promise.resolve(controller)),
    close: vi.fn(() => Promise.resolve()),
  };
  if (kind === "contact") context.newPage.mockResolvedValueOnce(probe);
  if (stage === "http") context.route.mockRejectedValue(error);
  if (stage === "websocket") context.routeWebSocket.mockRejectedValue(error);
  if (stage === "late") controller.goto.mockRejectedValue(error);
  launchBrowser.mockImplementation((owned) => {
    profile = owned;
    if (stage === "launch") return Promise.reject(error);
    return Promise.resolve(context as unknown as BrowserContext);
  });
  return { context, controller };
}
function launch(kind: Kind) {
  return kind === "contact"
    ? launchContact(buildDirectory)
    : launchInspection(buildDirectory);
}
function rejectRemoval(error: Error) {
  vi.mocked(rmSync).mockImplementation((path, options) => {
    if (path === profile) throw error;
    actualFs.rmSync(path, options);
  });
}
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("EXPECTED_RESOURCE_FAILURE");
}
function aggregate(error: unknown): AggregateError {
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError))
    throw new Error("EXPECTED_EXPLICIT_AGGREGATE_FAILURE");
  return error;
}
beforeEach(() => {
  sandbox = actualFs.mkdtempSync(join(tmpdir(), "japp-harness-cleanup-test-"));
  profile = "";
  buildDirectory = join(sandbox, "build");
  mkdirSync(buildDirectory);
  writeFileSync(
    join(buildDirectory, "manifest.json"),
    JSON.stringify({
      background: {},
      content_scripts: [{ matches: PUBLIC_CONTENT_MATCHES, all_frames: false }],
      description: "owned unit fixture",
      manifest_version: 3,
      name: "owned unit fixture",
      version: "0.0.0",
    }),
  );
  vi.mocked(rmSync).mockReset().mockImplementation(actualFs.rmSync);
  launchBrowser.mockReset();
  vi.stubEnv("JAPP_W14_PUBLIC_CONTACT_EVALUATION", "1");
  vi.stubEnv("JAPP_W14_PUBLIC_INSPECTION", "1");
});
afterEach(() => {
  // Test-owned final sweep also removes deliberately injected rm failures.
  if (profile !== "") actualFs.rmSync(profile, removalOptions);
  actualFs.rmSync(sandbox, removalOptions);
  vi.unstubAllEnvs();
});

test.each([
  { kind: "contact", stage: "launch" },
  { kind: "contact", stage: "http" },
  { kind: "contact", stage: "websocket" },
  { kind: "contact", stage: "late" },
  { kind: "inspection", stage: "launch" },
  { kind: "inspection", stage: "late" },
] as const)(
  "$kind acquisition rejects at $stage and releases only its owned resources",
  async ({ kind, stage }) => {
    const original = new Error("synthetic acquisition failure");
    const fake = prepare(kind, stage, original);
    await expect(launch(kind)).rejects.toBe(original);
    expect(profile).not.toBe("");
    expect(existsSync(profile)).toBe(false);
    expect(existsSync(buildDirectory)).toBe(true);
    expect(fake.context.close).toHaveBeenCalledTimes(
      stage === "launch" ? 0 : 1,
    );
    expect(rmSync).toHaveBeenCalledWith(profile, removalOptions);
  },
);

describe.each(["contact", "inspection"] as const)(
  "%s owned cleanup",
  (kind) => {
    test("successful acquisition retains its profile until explicit cleanup", async () => {
      const fake = prepare(kind);
      const session = await launch(kind);
      expect(existsSync(profile)).toBe(true);
      expect(fake.context.close).not.toHaveBeenCalled();
      expect(rmSync).not.toHaveBeenCalled();
      await session.cleanup();
      expect(fake.context.close).toHaveBeenCalledTimes(1);
      expect(existsSync(profile)).toBe(false);
      expect(existsSync(buildDirectory)).toBe(true);
      expect(rmSync).toHaveBeenCalledWith(profile, removalOptions);
    });
    test("close rejection is explicit and still removes the owned profile", async () => {
      const fake = prepare(kind);
      const session = await launch(kind);
      const closeError = new Error("synthetic close failure");
      fake.context.close.mockRejectedValue(closeError);
      const rejected = await rejection(session.cleanup());
      expect(existsSync(profile)).toBe(false);
      expect(rmSync).toHaveBeenCalledWith(profile, removalOptions);
      expect(aggregate(rejected).errors).toEqual([closeError]);
    });
    test("profile removal rejection remains an explicit cleanup failure", async () => {
      const fake = prepare(kind);
      const session = await launch(kind);
      const removeError = new Error("synthetic removal failure");
      rejectRemoval(removeError);
      const error = aggregate(await rejection(session.cleanup()));
      expect(error.errors).toEqual([removeError]);
      expect(fake.context.close).toHaveBeenCalledTimes(1);
      expect(existsSync(profile)).toBe(true);
    });
    test("both close and removal failures remain observable in order", async () => {
      const fake = prepare(kind);
      const session = await launch(kind);
      const closeError = new Error("synthetic close failure");
      const removeError = new Error("synthetic removal failure");
      fake.context.close.mockRejectedValue(closeError);
      rejectRemoval(removeError);
      const rejected = await rejection(session.cleanup());
      expect(fake.context.close).toHaveBeenCalledTimes(1);
      expect(rmSync).toHaveBeenCalledWith(profile, removalOptions);
      expect(existsSync(profile)).toBe(true);
      expect(aggregate(rejected).errors).toEqual([closeError, removeError]);
    });
    test("failed setup keeps original cause and both secondary cleanup failures", async () => {
      const original = new Error("synthetic late setup failure");
      const fake = prepare(kind, "late", original);
      const closeError = new Error("synthetic close failure");
      const removeError = new Error("synthetic removal failure");
      fake.context.close.mockRejectedValue(closeError);
      rejectRemoval(removeError);
      const rejected = await rejection(launch(kind));
      expect(rmSync).toHaveBeenCalledWith(profile, removalOptions);
      const error = aggregate(rejected);
      expect(error.cause).toBe(original);
      expect(error.errors[0]).toBe(original);
      expect(error.errors).toHaveLength(2);
      expect(aggregate(error.errors[1]).errors).toEqual([
        closeError,
        removeError,
      ]);
    });
    test("failed launch preserves its cause if profile removal also fails", async () => {
      const original = new Error("synthetic launch failure");
      const fake = prepare(kind, "launch", original);
      const removeError = new Error("synthetic removal failure");
      rejectRemoval(removeError);
      const error = aggregate(await rejection(launch(kind)));
      expect(error.cause).toBe(original);
      expect(error.errors[0]).toBe(original);
      expect(aggregate(error.errors[1]).errors).toEqual([removeError]);
      expect(fake.context.close).not.toHaveBeenCalled();
      expect(existsSync(profile)).toBe(true);
    });
  },
);
