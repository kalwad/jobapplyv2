import type { BrowserContext } from "@playwright/test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  EXTENSION_DIST,
  INVALID_ACK_EXTENSION_DIST,
  test as fixtureTest,
} from "../../../../e2e/extension/support/extension-test.ts";

const launchBrowser = vi.hoisted(() =>
  vi.fn<(profile: string, options: unknown) => Promise<BrowserContext>>(),
);

// Exercise the real fixture callbacks, with the entire Playwright module fake.
// No Playwright test runtime, browser, page, request, or socket is opened.
vi.mock("@playwright/test", async () => {
  const { expect: assertion } = await import("vitest");
  return {
    chromium: { launchPersistentContext: launchBrowser },
    expect: assertion,
    test: { extend: (fixtures: Record<string, unknown>) => fixtures },
  };
});
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    rmSync: vi.fn(actual.rmSync),
  };
});
const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
type Kind = "extensionContext" | "invalidAckExtensionContext";
type Use = (context: BrowserContext) => Promise<void>;
const fixtures = fixtureTest as unknown as Record<
  Kind,
  (dependencies: Record<string, never>, use: Use) => Promise<void>
>;
const removalOptions = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 100,
};
let profile = "";
let unowned = "";

function prepare(
  stage?: "launch" | "listener",
  original = new Error("synthetic setup failure"),
  requests: string[] = [],
) {
  const context = {
    on: vi.fn(
      (
        _event: string,
        listener: (request: { method(): string; url(): string }) => void,
      ) => {
        if (stage === "listener") throw original;
        for (const url of requests)
          listener({ method: () => "GET", url: () => url });
      },
    ),
    close: vi.fn(() => Promise.resolve()),
  };
  launchBrowser.mockImplementation((owned) => {
    profile = owned;
    if (stage === "launch") return Promise.reject(original);
    return Promise.resolve(context as unknown as BrowserContext);
  });
  return context;
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
  throw new Error("EXPECTED_FIXTURE_FAILURE");
}
function aggregate(error: unknown): AggregateError {
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error("EXPECTED_AGGREGATE");
  return error;
}
function expectRemoved() {
  expect(profile).not.toBe("");
  expect(actualFs.existsSync(profile)).toBe(false);
  expect(actualFs.existsSync(unowned)).toBe(true);
  expect(rmSync).toHaveBeenCalledExactlyOnceWith(profile, removalOptions);
}
beforeEach(() => {
  profile = "";
  unowned = actualFs.mkdtempSync(
    join(tmpdir(), "japp-unowned-fixture-neighbor-"),
  );
  vi.mocked(existsSync)
    .mockReset()
    .mockImplementation(
      (path) =>
        [EXTENSION_DIST, INVALID_ACK_EXTENSION_DIST].some(
          (directory) => path === join(directory, "manifest.json"),
        ) || actualFs.existsSync(path),
    );
  vi.mocked(rmSync).mockReset().mockImplementation(actualFs.rmSync);
  launchBrowser.mockReset();
});
afterEach(() => {
  // Test-owned sweep handles deliberate removal rejection without masking it.
  if (profile !== "") actualFs.rmSync(profile, removalOptions);
  actualFs.rmSync(unowned, removalOptions);
});

describe.each(["extensionContext", "invalidAckExtensionContext"] as const)(
  "%s inherited owned fixture cleanup",
  (kind) => {
    test("successful use keeps the exact fresh profile until cleanup", async () => {
      const context = prepare();
      const extensionDist =
        kind === "extensionContext"
          ? EXTENSION_DIST
          : INVALID_ACK_EXTENSION_DIST;
      const prefix =
        kind === "extensionContext"
          ? "japp-m02-w07-profile-"
          : "japp-m02-w07-invalid-ack-profile-";
      await fixtures[kind]({}, () => {
        expect(actualFs.existsSync(profile)).toBe(true);
        expect(profile).toContain(prefix);
        expect(context.close).not.toHaveBeenCalled();
        expect(rmSync).not.toHaveBeenCalled();
        return Promise.resolve();
      });
      expect(launchBrowser).toHaveBeenCalledExactlyOnceWith(profile, {
        channel: "chromium",
        args: [
          `--disable-extensions-except=${extensionDist}`,
          `--load-extension=${extensionDist}`,
        ],
      });
      expect(context.on).toHaveBeenCalledExactlyOnceWith(
        "request",
        expect.any(Function),
      );
      expect(context.close).toHaveBeenCalledTimes(1);
      expectRemoved();
    });
    test("missing build refuses acquisition before any owned profile", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await expect(fixtures[kind]({}, () => Promise.resolve())).rejects.toThrow(
        "built extension missing",
      );
      expect(launchBrowser).not.toHaveBeenCalled();
      expect(rmSync).not.toHaveBeenCalled();
      expect(profile).toBe("");
      expect(actualFs.existsSync(unowned)).toBe(true);
    });
    test.each(["launch", "listener", "use"] as const)(
      "%s rejection preserves its primary cause and releases only owned resources",
      async (stage) => {
        const original = new Error("synthetic primary failure");
        const context = prepare(stage === "use" ? undefined : stage, original);
        const use = vi.fn(() =>
          stage === "use" ? Promise.reject(original) : Promise.resolve(),
        );
        await expect(fixtures[kind]({}, use)).rejects.toBe(original);
        expect(context.close).toHaveBeenCalledTimes(stage === "launch" ? 0 : 1);
        expect(use).toHaveBeenCalledTimes(stage === "use" ? 1 : 0);
        expectRemoved();
      },
    );
    test("the original permitted origins and internal protocols still pass", async () => {
      prepare(undefined, undefined, [
        "http://127.0.0.1:4761/a",
        "http://127.0.0.1:4762/b",
        "about:blank",
        "blob:owned",
        "chrome://settings",
        "chrome-extension://owned/worker",
        "data:text/plain,owned",
      ]);
      await fixtures[kind]({}, () => Promise.resolve());
      expectRemoved();
    });
    test("the original network isolation assertion fails and still cleans up", async () => {
      prepare(undefined, undefined, ["https://external.invalid/request"]);
      await expect(fixtures[kind]({}, () => Promise.resolve())).rejects.toThrow(
        "the extension context must never issue an observed non-loopback request",
      );
      expectRemoved();
    });
    test.each(["close", "removal", "both"] as const)(
      "%s cleanup failure remains explicit after both cleanup attempts",
      async (stage) => {
        const context = prepare();
        const closeError = new Error("synthetic close failure");
        const removeError = new Error("synthetic removal failure");
        if (stage !== "removal") context.close.mockRejectedValue(closeError);
        if (stage !== "close") rejectRemoval(removeError);
        const error = aggregate(
          await rejection(fixtures[kind]({}, () => Promise.resolve())),
        );
        expect(error.errors).toEqual(
          stage === "close"
            ? [closeError]
            : stage === "removal"
              ? [removeError]
              : [closeError, removeError],
        );
        expect(context.close).toHaveBeenCalledTimes(1);
        expect(rmSync).toHaveBeenCalledExactlyOnceWith(profile, removalOptions);
        expect(actualFs.existsSync(profile)).toBe(stage !== "close");
        expect(actualFs.existsSync(unowned)).toBe(true);
      },
    );
    test.each(["launch", "listener", "use"] as const)(
      "%s primary failure retains secondary cleanup errors without masking",
      async (stage) => {
        const original = new Error("synthetic primary failure");
        const context = prepare(stage === "use" ? undefined : stage, original);
        const closeError = new Error("synthetic close failure");
        const removeError = new Error("synthetic removal failure");
        context.close.mockRejectedValue(closeError);
        rejectRemoval(removeError);
        const error = aggregate(
          await rejection(
            fixtures[kind]({}, () =>
              stage === "use" ? Promise.reject(original) : Promise.resolve(),
            ),
          ),
        );
        expect(error.cause).toBe(original);
        expect(error.errors[0]).toBe(original);
        expect(error.errors).toHaveLength(2);
        expect(aggregate(error.errors[1]).errors).toEqual(
          stage === "launch" ? [removeError] : [closeError, removeError],
        );
        expect(context.close).toHaveBeenCalledTimes(stage === "launch" ? 0 : 1);
        expect(rmSync).toHaveBeenCalledExactlyOnceWith(profile, removalOptions);
        expect(actualFs.existsSync(unowned)).toBe(true);
      },
    );
    test("isolation failure remains primary when close and removal also reject", async () => {
      const context = prepare(undefined, undefined, [
        "https://external.invalid/request",
      ]);
      const closeError = new Error("synthetic close failure");
      const removeError = new Error("synthetic removal failure");
      context.close.mockRejectedValue(closeError);
      rejectRemoval(removeError);
      const error = aggregate(
        await rejection(fixtures[kind]({}, () => Promise.resolve())),
      );
      expect(error.cause).toBe(error.errors[0]);
      expect(error.errors[0]).toBeInstanceOf(Error);
      expect(String(error.errors[0])).toContain(
        "the extension context must never issue an observed non-loopback request",
      );
      expect(aggregate(error.errors[1]).errors).toEqual([
        closeError,
        removeError,
      ]);
      expect(rmSync).toHaveBeenCalledExactlyOnceWith(profile, removalOptions);
      expect(actualFs.existsSync(unowned)).toBe(true);
    });
  },
);
