import { Buffer } from "node:buffer";

import { MAX_JSON_DEPTH } from "./protocol.ts";

export type PlainJson =
  null | boolean | number | string | PlainJson[] | PlainJsonObject;

export interface PlainJsonObject {
  // Recursive JSON objects cannot use Record here without collapsing to any.
  [key: string]: PlainJson;
}

const FORBIDDEN_PROPERTY_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export class BoundaryError extends Error {
  readonly category: string;

  constructor(category: string) {
    super(category);
    this.name = "BoundaryError";
    this.category = category;
  }
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const following = value.charCodeAt(index + 1);
      if (!(following >= 0xdc00 && following <= 0xdfff)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function snapshotPrimitive(value: unknown): PlainJson {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    if (typeof value === "string" && hasLoneSurrogate(value)) {
      throw new BoundaryError("INVALID_UNICODE");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BoundaryError("NUMBER_OUT_OF_RANGE");
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new BoundaryError("NUMBER_OUT_OF_RANGE");
    }
    return value;
  }
  throw new BoundaryError("MALFORMED_OBJECT");
}

/**
 * Snapshot unknown JavaScript data through property descriptors.
 *
 * No getters execute, proxy/reflection failures become a stable boundary
 * rejection, symbols and non-enumerable extras are rejected, and the result
 * is detached from later source mutation before validation.
 */
export function snapshotPlainJson(value: unknown, depth = 0): PlainJson {
  if (depth > MAX_JSON_DEPTH) {
    throw new BoundaryError("MAX_DEPTH_EXCEEDED");
  }
  if (typeof value !== "object" || value === null) {
    return snapshotPrimitive(value);
  }
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new BoundaryError("MALFORMED_OBJECT");
      }
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const expected = new Set([
        "length",
        ...Array.from({ length: value.length }, (_, index) => String(index)),
      ]);
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== "string" || !expected.has(key)) {
          throw new BoundaryError("MALFORMED_OBJECT");
        }
      }
      const result: PlainJson[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value")
        ) {
          throw new BoundaryError("MALFORMED_OBJECT");
        }
        result.push(snapshotPlainJson(descriptor.value, depth + 1));
      }
      return result;
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new BoundaryError("MALFORMED_OBJECT");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: Record<string, PlainJson> = Object.create(null) as Record<
      string,
      PlainJson
    >;
    for (const key of Reflect.ownKeys(descriptors).sort((left, right) =>
      typeof left === "string" && typeof right === "string"
        ? compareUtf8(left, right)
        : 0,
    )) {
      if (typeof key !== "string") {
        throw new BoundaryError("MALFORMED_OBJECT");
      }
      if (FORBIDDEN_PROPERTY_NAMES.has(key)) {
        throw new BoundaryError("FORBIDDEN_PROPERTY_NAME");
      }
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        throw new BoundaryError("MALFORMED_OBJECT");
      }
      result[key] = snapshotPlainJson(descriptor.value, depth + 1);
    }
    return result;
  } catch (error) {
    if (error instanceof BoundaryError) {
      throw error;
    }
    throw new BoundaryError("MALFORMED_OBJECT");
  }
}

function sortedJson(value: PlainJson): PlainJson {
  if (Array.isArray(value)) {
    return value.map((item) => sortedJson(item));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, PlainJson> = Object.create(null) as Record<
      string,
      PlainJson
    >;
    for (const key of Object.keys(value).sort(compareUtf8)) {
      result[key] = sortedJson(value[key] as PlainJson);
    }
    return result;
  }
  return value;
}

/** Compact UTF-8 JSON with recursively UTF-8-sorted keys and stable arrays. */
export function canonicalJson(value: unknown): string {
  const snapshot = snapshotPlainJson(value);
  return JSON.stringify(sortedJson(snapshot));
}

export function isForbiddenPropertyName(value: string): boolean {
  return FORBIDDEN_PROPERTY_NAMES.has(value);
}

export function containsLoneSurrogate(value: string): boolean {
  return hasLoneSurrogate(value);
}
