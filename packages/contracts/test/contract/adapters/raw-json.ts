import {
  BoundaryError,
  containsLoneSurrogate,
  isForbiddenPropertyName,
  type PlainJson,
} from "./normalization.ts";
import { MAX_JSON_DEPTH, MAX_RAW_INPUT_BYTES } from "./protocol.ts";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const NUMBER_PREFIX = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/;

class RawParser {
  readonly source: string;
  private index = 0;

  constructor(source: string) {
    this.source = source;
  }

  parse(): PlainJson {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.source.length) {
      throw new BoundaryError("MALFORMED_JSON");
    }
    return value;
  }

  private parseValue(depth: number): PlainJson {
    if (depth > MAX_JSON_DEPTH) {
      throw new BoundaryError("MAX_DEPTH_EXCEEDED");
    }
    const token = this.source[this.index];
    if (token === "{") {
      return this.parseObject(depth);
    }
    if (token === "[") {
      return this.parseArray(depth);
    }
    if (token === '"') {
      return this.parseString();
    }
    if (token === "t" && this.consumeLiteral("true")) {
      return true;
    }
    if (token === "f" && this.consumeLiteral("false")) {
      return false;
    }
    if (token === "n" && this.consumeLiteral("null")) {
      return null;
    }
    if (token === "-" || (token !== undefined && /[0-9]/.test(token))) {
      return this.parseNumber();
    }
    throw new BoundaryError("MALFORMED_JSON");
  }

  private parseObject(depth: number): PlainJson {
    this.index += 1;
    this.skipWhitespace();
    const result: Record<string, PlainJson> = Object.create(null) as Record<
      string,
      PlainJson
    >;
    const seen = new Set<string>();
    if (this.source[this.index] === "}") {
      this.index += 1;
      return result;
    }
    for (;;) {
      if (this.source[this.index] !== '"') {
        throw new BoundaryError("MALFORMED_JSON");
      }
      const key = this.parseString();
      if (seen.has(key)) {
        throw new BoundaryError("DUPLICATE_KEY");
      }
      if (isForbiddenPropertyName(key)) {
        throw new BoundaryError("FORBIDDEN_PROPERTY_NAME");
      }
      seen.add(key);
      this.skipWhitespace();
      if (this.source[this.index] !== ":") {
        throw new BoundaryError("MALFORMED_JSON");
      }
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue(depth + 1);
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === "}") {
        this.index += 1;
        return result;
      }
      if (separator !== ",") {
        throw new BoundaryError("MALFORMED_JSON");
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): PlainJson {
    this.index += 1;
    this.skipWhitespace();
    const result: PlainJson[] = [];
    if (this.source[this.index] === "]") {
      this.index += 1;
      return result;
    }
    for (;;) {
      result.push(this.parseValue(depth + 1));
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === "]") {
        this.index += 1;
        return result;
      }
      if (separator !== ",") {
        throw new BoundaryError("MALFORMED_JSON");
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (!escaped && code === 0x22) {
        this.index += 1;
        const token = this.source.slice(start, this.index);
        let parsed: unknown;
        try {
          parsed = JSON.parse(token);
        } catch {
          throw new BoundaryError("MALFORMED_JSON");
        }
        if (typeof parsed !== "string") {
          throw new BoundaryError("MALFORMED_JSON");
        }
        if (containsLoneSurrogate(parsed)) {
          throw new BoundaryError("INVALID_UNICODE");
        }
        return parsed;
      }
      if (!escaped && code < 0x20) {
        throw new BoundaryError("MALFORMED_JSON");
      }
      if (!escaped && code === 0x5c) {
        escaped = true;
      } else {
        escaped = false;
      }
      this.index += 1;
    }
    throw new BoundaryError("MALFORMED_JSON");
  }

  private parseNumber(): number {
    const remaining = this.source.slice(this.index);
    const match = NUMBER_PREFIX.exec(remaining);
    const token = match?.[0];
    if (token === undefined) {
      throw new BoundaryError("MALFORMED_JSON");
    }
    this.index += token.length;
    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new BoundaryError("NUMBER_OUT_OF_RANGE");
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new BoundaryError("NUMBER_OUT_OF_RANGE");
    }
    return value;
  }

  private consumeLiteral(literal: string): boolean {
    if (
      this.source.slice(this.index, this.index + literal.length) !== literal
    ) {
      return false;
    }
    this.index += literal.length;
    return true;
  }

  private skipWhitespace(): void {
    while (
      this.source[this.index] === " " ||
      this.source[this.index] === "\n" ||
      this.source[this.index] === "\r" ||
      this.source[this.index] === "\t"
    ) {
      this.index += 1;
    }
  }
}

/** Strict raw-wire policy shared conceptually by all language adapters. */
export function parseRawJson(
  bytes: Uint8Array,
  maxBytes = MAX_RAW_INPUT_BYTES,
): PlainJson {
  if (bytes.byteLength > maxBytes) {
    throw new BoundaryError("INPUT_TOO_LARGE");
  }
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    throw new BoundaryError("INVALID_UTF8");
  }
  return new RawParser(text).parse();
}
