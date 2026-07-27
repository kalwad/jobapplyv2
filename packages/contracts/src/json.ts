/**
 * Minimal JSON value model used by the schema-convention layer (M01-W01).
 *
 * Schema documents are parsed JSON; the convention checks walk them as plain
 * data. Keeping this local avoids depending on Ajv's wider schema types for
 * the deterministic repository checks.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
