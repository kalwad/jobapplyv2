import type { BrowserContext } from "@playwright/test";
import { EventEmitter } from "node:events";
import { existsSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  EXTENSION_DIST,
  INVALID_ACK_EXTENSION_DIST,
  test as fixtureTest,
} from "../../../../e2e/extension/support/extension-test.ts";

const launchBrowser = vi.hoisted(() => vi.fn());
vi.mock("@playwright/test", async () => ({
  chromium: { launchPersistentContext: launchBrowser },
  expect: (await import("vitest")).expect,
  test: { extend: (fixtures: Record<string, unknown>) => fixtures },
}));
// Both APIs exist during RED, so failures measure production behavior rather
// than a mock that only understands the proposed asynchronous implementation.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    rmSync: vi.fn(actual.rmSync),
  };
});
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rm: vi.fn(actual.rm) };
});
const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const actualAsyncFs =
  await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
type Kind = "extensionContext" | "invalidAckExtensionContext";
const fixtures = fixtureTest as unknown as Record<
  Kind,
  (
    dependencies: Record<string, never>,
    use: (context: BrowserContext) => Promise<void>,
  ) => Promise<void>
>;
const removalOptions = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 100,
};
let profile = "";
let neighbor = "";
let events: string[] = [];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
function prepare() {
  const emitter = new EventEmitter();
  let connected = true;
  const disconnect = () => {
    connected = false;
    events.push("disconnect");
    emitter.emit("disconnected");
  };
  const browser = {
    on: vi.fn((event: string, listener: () => void) => {
      emitter.on(event, listener);
      return browser;
    }),
    off: vi.fn((event: string, listener: () => void) => {
      emitter.off(event, listener);
      return browser;
    }),
    isConnected: vi.fn(() => connected),
    close: vi.fn(() => {
      events.push("browser.close");
      disconnect();
      return Promise.resolve();
    }),
  };
  const unownedBrowser = { close: vi.fn(() => Promise.resolve()) };
  const context = {
    browser: vi.fn(() => browser as typeof browser | null),
    on: vi.fn(),
    isClosed: vi.fn(() => false),
    close: vi.fn(() => {
      events.push("context.close/flush");
      return Promise.resolve();
    }),
  };
  launchBrowser.mockImplementation((owned: string) => {
    profile = owned;
    return Promise.resolve(context);
  });
  return { browser, context, disconnect, unownedBrowser };
}
async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("EXPECTED_FIXTURE_FAILURE");
}
function aggregate(error: unknown): AggregateError {
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error("EXPECTED_AGGREGATE");
  return error;
}
function expectOwnedRemoved() {
  expect(actualFs.existsSync(profile)).toBe(false);
  expect(actualFs.existsSync(neighbor)).toBe(true);
  expect(rm).toHaveBeenCalledExactlyOnceWith(profile, removalOptions);
  expect(rmSync).not.toHaveBeenCalled();
}
beforeEach(() => {
  profile = "";
  events = [];
  neighbor = actualFs.mkdtempSync(
    join(tmpdir(), "japp-owned-browser-unowned-neighbor-"),
  );
  vi.mocked(existsSync)
    .mockReset()
    .mockImplementation(
      (path) =>
        [EXTENSION_DIST, INVALID_ACK_EXTENSION_DIST].some(
          (dir) => path === join(dir, "manifest.json"),
        ) || actualFs.existsSync(path),
    );
  vi.mocked(rmSync)
    .mockReset()
    .mockImplementation((path, options) => {
      events.push("rmSync");
      actualFs.rmSync(path, options);
    });
  vi.mocked(rm)
    .mockReset()
    .mockImplementation(async (path, options) => {
      events.push("rm");
      await actualAsyncFs.rm(path, options);
    });
  launchBrowser.mockReset();
});
afterEach(() => {
  if (profile) actualFs.rmSync(profile, removalOptions);
  actualFs.rmSync(neighbor, removalOptions);
});

describe.each(["extensionContext", "invalidAckExtensionContext"] as const)(
  "%s owned Browser retirement",
  (kind) => {
    test("context_instrumentation_then_owned_browser_then_async_profile_order", async () => {
      const { browser, context } = prepare();
      await fixtures[kind]({}, () => {
        expect(context.browser).toHaveBeenCalledTimes(1);
        return Promise.resolve();
      });
      expect(events).toEqual([
        "context.close/flush",
        "browser.close",
        "disconnect",
        "rm",
      ]);
      expect(browser.close).toHaveBeenCalledTimes(1);
      expect(browser.off).toHaveBeenCalledExactlyOnceWith(
        "disconnected",
        expect.any(Function),
      );
      expectOwnedRemoved();
    });
    test("known_target_closed_stays_failure_but_owned_retirement_and_removal_finish", async () => {
      const { browser, context } = prepare();
      const original = new Error(
        "browserContext.close: Target page, context or browser has been closed",
      );
      context.close.mockRejectedValue(original);
      const failure = aggregate(
        await rejected(fixtures[kind]({}, () => Promise.resolve())),
      );
      expect(failure.errors).toEqual([original]);
      expect(browser.close).toHaveBeenCalledTimes(1);
      expect(events).toEqual(["browser.close", "disconnect", "rm"]);
      expectOwnedRemoved();
    });
    test("generic_context_browser_and_removal_errors_keep_primary_and_order", async () => {
      const { browser, context } = prepare();
      const primary = new Error("body error");
      const closeError = new Error("context flush error");
      const browserError = new Error("browser close error");
      const rmError = new Error("profile error");
      context.close.mockRejectedValue(closeError);
      browser.close.mockRejectedValue(browserError);
      vi.mocked(rm).mockRejectedValue(rmError);
      const failure = aggregate(
        await rejected(fixtures[kind]({}, () => Promise.reject(primary))),
      );
      expect(failure.cause).toBe(primary);
      expect(failure.errors[0]).toBe(primary);
      expect(aggregate(failure.errors[1]).errors).toEqual([
        closeError,
        browserError,
        rmError,
      ]);
      expect(browser.close).toHaveBeenCalledTimes(1);
      expect(actualFs.existsSync(neighbor)).toBe(true);
    });
    test("precleanup_disconnected_browser_is_explicit_failure", async () => {
      const { browser, disconnect } = prepare();
      const failure = aggregate(
        await rejected(
          fixtures[kind]({}, () => {
            disconnect();
            return Promise.resolve();
          }),
        ),
      );
      expect(failure.errors).toHaveLength(1);
      expect(String(failure.errors[0])).toContain(
        "EXTENSION_BROWSER_DISCONNECTED_BEFORE_CLEANUP",
      );
      expect(browser.close).toHaveBeenCalledTimes(1);
      expectOwnedRemoved();
    });
    test("closing_context_is_not_terminal_and_owned_disconnect_is_awaited", async () => {
      const { browser, context, disconnect } = prepare();
      const closeRequested = deferred();
      context.isClosed.mockReturnValue(true);
      browser.close.mockImplementation(() => {
        closeRequested.resolve();
        return Promise.resolve();
      });
      let settled = false;
      const outcome = fixtures[kind]({}, () => Promise.resolve()).finally(
        () => {
          settled = true;
        },
      );
      // A microtask turn also lets the old implementation complete its sync rm.
      await Promise.race([closeRequested.promise, outcome]);
      try {
        expect(settled).toBe(false);
        expect(rm).not.toHaveBeenCalled();
        expect(rmSync).not.toHaveBeenCalled();
        expect(actualFs.existsSync(profile)).toBe(true);
      } finally {
        disconnect();
        await outcome;
      }
      expect(context.isClosed).not.toHaveBeenCalled();
      expectOwnedRemoved();
    });
    test("missing_owned_browser_fails_without_closing_an_unowned_browser", async () => {
      const { context, unownedBrowser } = prepare();
      context.browser.mockReturnValue(null);
      const failure = aggregate(
        await rejected(fixtures[kind]({}, () => Promise.resolve())),
      );
      expect(String(failure.errors[0])).toContain(
        "EXTENSION_OWNED_BROWSER_MISSING",
      );
      expect(context.close).toHaveBeenCalledTimes(1);
      expect(unownedBrowser.close).not.toHaveBeenCalled();
      expectOwnedRemoved();
    });
    test("async_removal_is_awaited_yields_and_keeps_original_retry_options", async () => {
      prepare();
      const started = deferred();
      const release = deferred();
      vi.mocked(rm).mockImplementation(async (path, options) => {
        started.resolve();
        await release.promise;
        await actualAsyncFs.rm(path, options);
      });
      let settled = false;
      const outcome = fixtures[kind]({}, () => Promise.resolve()).finally(
        () => {
          settled = true;
        },
      );
      await Promise.race([started.promise, outcome]);
      try {
        expect(rm).toHaveBeenCalledExactlyOnceWith(profile, removalOptions);
        expect(settled).toBe(false);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(settled).toBe(false);
        expect(actualFs.existsSync(profile)).toBe(true);
      } finally {
        release.resolve();
        await outcome;
      }
      expectOwnedRemoved();
    });
    test("generic_browser_close_error_after_disconnect_is_not_swallowed", async () => {
      const { browser, disconnect } = prepare();
      const original = new Error("generic browser error");
      browser.close.mockImplementation(() => {
        disconnect();
        return Promise.reject(original);
      });
      const failure = aggregate(
        await rejected(fixtures[kind]({}, () => Promise.resolve())),
      );
      expect(failure.errors).toEqual([original]);
      expectOwnedRemoved();
    });
  },
);
