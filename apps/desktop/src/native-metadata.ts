export interface ShellMetadata {
  readonly appVersion: string;
  readonly tauriVersion: string;
}

export type MetadataLoader = () => Promise<ShellMetadata>;

export interface NativeMetadataApi {
  readonly getVersion: () => Promise<unknown>;
  readonly getTauriVersion: () => Promise<unknown>;
}

export class NativeMetadataError extends Error {
  readonly code: "NATIVE_METADATA_UNAVAILABLE" | "INVALID_NATIVE_METADATA";

  constructor(code: NativeMetadataError["code"]) {
    super(
      code === "INVALID_NATIVE_METADATA"
        ? "Desktop version information was not valid."
        : "Desktop version information is unavailable.",
    );
    this.name = "NativeMetadataError";
    this.code = code;
  }
}

const VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

function isDisplayVersion(value: unknown): value is string {
  return typeof value === "string" && value.length <= 96 && VERSION.test(value);
}

export function validateShellMetadata(value: unknown): ShellMetadata {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NativeMetadataError("INVALID_NATIVE_METADATA");
  }
  const record = value as Record<string, unknown>;
  if (
    !isDisplayVersion(record.appVersion) ||
    !isDisplayVersion(record.tauriVersion)
  ) {
    throw new NativeMetadataError("INVALID_NATIVE_METADATA");
  }
  return {
    appVersion: record.appVersion,
    tauriVersion: record.tauriVersion,
  };
}

/** Only version-read IPC is used. Exceptions never become diagnostic display text. */
export async function readShellMetadata(
  api?: NativeMetadataApi,
): Promise<ShellMetadata> {
  try {
    const nativeApi = api ?? (await import("@tauri-apps/api/app"));
    const [appVersion, tauriVersion] = await Promise.all([
      nativeApi.getVersion(),
      nativeApi.getTauriVersion(),
    ]);
    return validateShellMetadata({ appVersion, tauriVersion });
  } catch (error) {
    if (error instanceof NativeMetadataError) throw error;
    throw new NativeMetadataError("NATIVE_METADATA_UNAVAILABLE");
  }
}
