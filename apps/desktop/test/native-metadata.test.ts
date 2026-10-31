import { describe, expect, it, vi } from "vitest";
import {
  NativeMetadataError,
  readShellMetadata,
  validateShellMetadata,
} from "../src/native-metadata.ts";

describe("native shell metadata", () => {
  it("reads both real metadata operations and returns validated display values", async () => {
    const getVersion = vi.fn().mockResolvedValue("0.0.1");
    const getTauriVersion = vi.fn().mockResolvedValue("2.12.4");
    await expect(
      readShellMetadata({ getVersion, getTauriVersion }),
    ).resolves.toEqual({ appVersion: "0.0.1", tauriVersion: "2.12.4" });
    expect(getVersion).toHaveBeenCalledTimes(1);
    expect(getTauriVersion).toHaveBeenCalledTimes(1);
  });

  it("accepts bounded release and prerelease versions without altering their content", () => {
    expect(
      validateShellMetadata({
        appVersion: "1.2.3-beta.1+build.2",
        tauriVersion: "2.12.4",
      }),
    ).toEqual({ appVersion: "1.2.3-beta.1+build.2", tauriVersion: "2.12.4" });
  });

  it.each([
    null,
    undefined,
    [],
    {},
    { appVersion: "1.2.3" },
    { appVersion: 123, tauriVersion: "2.0.0" },
    { appVersion: "<script>secret</script>", tauriVersion: "2.0.0" },
    { appVersion: "1.2.3\nprivate-path", tauriVersion: "2.0.0" },
    { appVersion: "1.2.3", tauriVersion: "x".repeat(200) },
  ])("rejects invalid or unbounded display metadata %j", (value) => {
    expect(() => validateShellMetadata(value)).toThrow(NativeMetadataError);
    try {
      validateShellMetadata(value);
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_NATIVE_METADATA",
        message: "Desktop version information was not valid.",
      });
    }
  });

  it("does not expose an IPC exception or partial metadata as a successful result", async () => {
    const nativeSecret = "private user path and token";
    await expect(
      readShellMetadata({
        getVersion: () => Promise.reject(new Error(nativeSecret)),
        getTauriVersion: () => Promise.resolve("2.12.4"),
      }),
    ).rejects.toMatchObject({
      code: "NATIVE_METADATA_UNAVAILABLE",
      message: "Desktop version information is unavailable.",
    });
    try {
      await readShellMetadata({
        getVersion: () => Promise.resolve("0.0.1"),
        getTauriVersion: () => Promise.reject(new Error(nativeSecret)),
      });
    } catch (error) {
      expect(String(error)).not.toContain(nativeSecret);
    }
  });

  it("preserves validation failures as safe validation failures", async () => {
    await expect(
      readShellMetadata({
        getVersion: () => Promise.resolve("invalid"),
        getTauriVersion: () => Promise.resolve("2.12.4"),
      }),
    ).rejects.toMatchObject({ code: "INVALID_NATIVE_METADATA" });
  });
});
