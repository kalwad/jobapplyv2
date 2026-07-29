export class StrictJsonError extends Error {
  public readonly code: string;
  public readonly pointer: string;

  public constructor(code: string, pointer: string) {
    super(`${code} ${pointer}`);
    this.name = "StrictJsonError";
    this.code = code;
    this.pointer = pointer;
  }
}

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

class JsonPreflight {
  private index = 0;
  private readonly text: string;

  public constructor(text: string) {
    this.text = text;
  }

  public inspect(): void {
    this.skipWhitespace();
    this.value("");
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      this.invalid("");
    }
  }

  private invalid(pointer: string): never {
    throw new StrictJsonError(
      "FIXTURE_JSON_INVALID",
      pointer === "" ? "/" : pointer,
    );
  }

  private skipWhitespace(): void {
    while (" \t\n\r".includes(this.text[this.index] ?? "\0")) {
      this.index += 1;
    }
  }

  private value(pointer: string): void {
    this.skipWhitespace();
    const token = this.text[this.index];
    if (token === "{") {
      this.object(pointer);
    } else if (token === "[") {
      this.array(pointer);
    } else if (token === '"') {
      this.string(pointer);
    } else if (
      this.text.startsWith("true", this.index) ||
      this.text.startsWith("false", this.index) ||
      this.text.startsWith("null", this.index)
    ) {
      this.index += this.text.startsWith("false", this.index) ? 5 : 4;
    } else {
      JSON_NUMBER.lastIndex = this.index;
      const match = JSON_NUMBER.exec(this.text);
      if (match === null) {
        this.invalid(pointer);
      }
      this.index = JSON_NUMBER.lastIndex;
    }
  }

  private string(pointer: string): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const token = this.text[this.index];
      if (token === '"') {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          return this.invalid(pointer);
        }
      }
      if (token === "\\") {
        this.index += 1;
        if (this.text[this.index] === "u") {
          const digits = this.text.slice(this.index + 1, this.index + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(digits)) {
            this.invalid(pointer);
          }
          this.index += 5;
        } else if ('"\\/bfnrt'.includes(this.text[this.index] ?? "")) {
          this.index += 1;
        } else {
          this.invalid(pointer);
        }
      } else {
        if ((token?.codePointAt(0) ?? 0) < 0x20) {
          this.invalid(pointer);
        }
        this.index += 1;
      }
    }
    return this.invalid(pointer);
  }

  private object(pointer: string): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return;
    }
    const keys = new Set<string>();
    while (this.index < this.text.length) {
      if (this.text[this.index] !== '"') {
        this.invalid(pointer);
      }
      const key = this.string(pointer);
      const child = `${pointer}/${escapePointer(key)}`;
      if (keys.has(key)) {
        throw new StrictJsonError("FIXTURE_JSON_DUPLICATE_KEY", child);
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        this.invalid(child);
      }
      this.index += 1;
      this.value(child);
      this.skipWhitespace();
      const token = this.text[this.index];
      this.index += 1;
      if (token === "}") {
        return;
      }
      if (token !== ",") {
        this.invalid(pointer);
      }
      this.skipWhitespace();
    }
    this.invalid(pointer);
  }

  private array(pointer: string): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return;
    }
    let item = 0;
    while (this.index < this.text.length) {
      this.value(`${pointer}/${String(item)}`);
      item += 1;
      this.skipWhitespace();
      const token = this.text[this.index];
      this.index += 1;
      if (token === "]") {
        return;
      }
      if (token !== ",") {
        this.invalid(pointer);
      }
      this.skipWhitespace();
    }
    this.invalid(pointer);
  }
}

export function parseStrictJson(text: string): unknown {
  new JsonPreflight(text).inspect();
  return JSON.parse(text) as unknown;
}
