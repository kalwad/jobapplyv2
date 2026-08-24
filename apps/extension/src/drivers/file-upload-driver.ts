// M02-W10 synthetic file-input feasibility driver. The typed request carries
// one bounded in-memory artifact, never a path. The driver independently
// verifies bytes, metadata, the current input accept policy, and the page's
// local acceptance surface before a result can become VERIFIED.
import type { FormFieldDescriptorV1 } from "@japp/contracts/generated";

import {
  fileObservation,
  type SemanticObservation,
} from "../driver-evidence.ts";
import type { DriverIntendedValue } from "../driver-protocol.ts";
import { dispatchChange } from "./driver-dom.ts";
import type {
  CapturedUndo,
  ControlDriver,
  DriverContext,
  PreconditionOutcome,
} from "./driver-contract.ts";

function fileHost(anchor: HTMLElement): HTMLInputElement | null {
  return anchor instanceof HTMLInputElement &&
    anchor.type.toLowerCase() === "file" &&
    !anchor.multiple
    ? anchor
    : null;
}

function requireFileHost(context: DriverContext): HTMLInputElement {
  const host = fileHost(context.target.anchor);
  if (host === null) {
    throw new Error("file driver invariant: anchor is not a single file input");
  }
  return host;
}

function intendedFile(
  context: DriverContext,
): Extract<DriverIntendedValue, { readonly kind: "FILE" }> {
  if (context.intended.kind !== "FILE") {
    throw new Error("file driver invariant: intended value is not FILE");
  }
  return context.intended;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function byteDigest(
  bytes: ArrayBuffer | Uint8Array<ArrayBuffer>,
): Promise<string> {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", source));
  return `sha256:${[...digest]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function acceptAllows(
  host: HTMLInputElement,
  fileName: string,
  mediaType: string,
): boolean {
  const tokens = host.accept
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== "");
  if (tokens.length === 0) {
    return true;
  }
  const name = fileName.toLowerCase();
  const type = mediaType.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return name.endsWith(token);
    }
    if (token.endsWith("/*")) {
      return type.startsWith(token.slice(0, -1));
    }
    return token === type;
  });
}

async function intendedBytes(
  context: DriverContext,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const intended = intendedFile(context);
  const bytes = decodeBase64(intended.content_base64);
  if (
    bytes?.byteLength !== intended.size_bytes ||
    (await byteDigest(bytes)) !== intended.artifact_digest
  ) {
    return null;
  }
  return bytes;
}

async function observeFile(
  host: HTMLInputElement,
): Promise<SemanticObservation> {
  const files = host.files;
  if (files?.length !== 1) {
    return fileObservation(null);
  }
  const file = files.item(0);
  if (file === null) {
    return fileObservation(null);
  }
  return fileObservation({
    name: file.name,
    mediaType: file.type,
    sizeBytes: file.size,
    artifactDigest: await byteDigest(await file.arrayBuffer()),
  });
}

function setFiles(host: HTMLInputElement, files: FileList): void {
  // The native accessor is deliberately rebound to the concrete input.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "files",
  )?.set;
  if (setter === undefined) {
    throw new Error("file driver invariant: native files setter unavailable");
  }
  Reflect.apply(setter, host, [files]);
  dispatchChange(host);
}

export const fileUploadDriver: ControlDriver = {
  driverKey: "SYNTHETIC_FILE_UPLOAD_V1",
  detect(
    descriptor: FormFieldDescriptorV1,
    anchor: HTMLElement,
    intended: DriverIntendedValue,
  ): boolean {
    return (
      intended.kind === "FILE" &&
      descriptor.control_kind === "FILE" &&
      fileHost(anchor) !== null
    );
  },
  async checkPreconditions(
    context: DriverContext,
  ): Promise<PreconditionOutcome> {
    const host = requireFileHost(context);
    const intended = intendedFile(context);
    if (
      !acceptAllows(host, intended.file_name, intended.media_type) ||
      (await intendedBytes(context)) === null
    ) {
      return { ok: false };
    }
    const observed = await observeFile(host);
    const expected = fileObservation({
      name: intended.file_name,
      mediaType: intended.media_type,
      sizeBytes: intended.size_bytes,
      artifactDigest: intended.artifact_digest,
    });
    return {
      ok: true,
      alreadySatisfied:
        observed.presence === expected.presence &&
        observed.parts.every((part, index) => part === expected.parts[index]),
    };
  },
  async captureUndo(context: DriverContext): Promise<CapturedUndo> {
    const host = requireFileHost(context);
    const prior = await observeFile(host);
    return {
      restorable: host.files?.length === 0,
      priorObservation: prior,
      payload: null,
    };
  },
  async execute(context: DriverContext): Promise<void> {
    const intended = intendedFile(context);
    const bytes = await intendedBytes(context);
    if (bytes === null) {
      throw new Error("file driver invariant: artifact verification changed");
    }
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], intended.file_name, { type: intended.media_type }),
    );
    setFiles(requireFileHost(context), transfer.files);
  },
  observe(context: DriverContext): Promise<SemanticObservation> {
    return observeFile(requireFileHost(context));
  },
  applyUndo(context: DriverContext, payload: unknown): Promise<void> {
    if (payload !== null) {
      throw new Error("file driver invariant: undo payload malformed");
    }
    const transfer = new DataTransfer();
    setFiles(requireFileHost(context), transfer.files);
    return Promise.resolve();
  },
  acceptanceElements(context: DriverContext): readonly HTMLElement[] {
    const statuses = [
      ...context.target.applicationRoot.querySelectorAll<HTMLElement>(
        "[role='status'][data-tone]",
      ),
    ];
    return [requireFileHost(context), ...statuses];
  },
};
