export class CorpusJsonError extends Error {
  public readonly code: "JSON_DUPLICATE_KEY" | "JSON_INVALID";

  public constructor(code: "JSON_DUPLICATE_KEY" | "JSON_INVALID") {
    super(code);
    this.name = "CorpusJsonError";
    this.code = code;
  }
}

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

class JsonPreflight {
  private index = 0;
  private readonly text: string;

  public constructor(text: string) {
    this.text = text;
  }

  public inspect(): void {
    this.skip();
    this.value();
    this.skip();
    if (this.index !== this.text.length) this.invalid();
  }

  private invalid(): never {
    throw new CorpusJsonError("JSON_INVALID");
  }

  private skip(): void {
    while (" \t\n\r".includes(this.text[this.index] ?? "\0")) this.index++;
  }

  private value(): void {
    this.skip();
    const token = this.text[this.index];
    if (token === "{") this.object();
    else if (token === "[") this.array();
    else if (token === '"') void this.string();
    else if (this.text.startsWith("true", this.index)) this.index += 4;
    else if (this.text.startsWith("false", this.index)) this.index += 5;
    else if (this.text.startsWith("null", this.index)) this.index += 4;
    else {
      JSON_NUMBER.lastIndex = this.index;
      if (JSON_NUMBER.exec(this.text) === null) this.invalid();
      this.index = JSON_NUMBER.lastIndex;
    }
  }

  private string(): string {
    const start = this.index++;
    while (this.index < this.text.length) {
      const token = this.text[this.index];
      if (token === '"') {
        this.index++;
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          return this.invalid();
        }
      }
      if (token === "\\") {
        this.index++;
        if (this.text[this.index] === "u") {
          if (
            !/^[0-9a-fA-F]{4}$/u.test(
              this.text.slice(this.index + 1, this.index + 5),
            )
          )
            this.invalid();
          this.index += 5;
        } else if ('"\\/bfnrt'.includes(this.text[this.index] ?? ""))
          this.index++;
        else this.invalid();
      } else {
        if ((token?.codePointAt(0) ?? 0) < 0x20) this.invalid();
        this.index++;
      }
    }
    return this.invalid();
  }

  private object(): void {
    this.index++;
    this.skip();
    if (this.text[this.index] === "}") {
      this.index++;
      return;
    }
    const keys = new Set<string>();
    while (this.index < this.text.length) {
      if (this.text[this.index] !== '"') this.invalid();
      const key = this.string();
      if (keys.has(key)) throw new CorpusJsonError("JSON_DUPLICATE_KEY");
      keys.add(key);
      this.skip();
      if (this.text[this.index++] !== ":") this.invalid();
      this.value();
      this.skip();
      const token = this.text[this.index++];
      if (token === "}") return;
      if (token !== ",") this.invalid();
      this.skip();
    }
    this.invalid();
  }

  private array(): void {
    this.index++;
    this.skip();
    if (this.text[this.index] === "]") {
      this.index++;
      return;
    }
    while (this.index < this.text.length) {
      this.value();
      this.skip();
      const token = this.text[this.index++];
      if (token === "]") return;
      if (token !== ",") this.invalid();
      this.skip();
    }
    this.invalid();
  }
}

export function parseStrictJson(text: string): unknown {
  new JsonPreflight(text).inspect();
  return JSON.parse(text) as unknown;
}

export function decodeStrictUtf8(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) throw new Error();
    return text;
  } catch {
    throw new CorpusJsonError("JSON_INVALID");
  }
}
