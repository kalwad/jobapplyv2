import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return (
    (channels[0] ?? 0) * 0.2126 +
    (channels[1] ?? 0) * 0.7152 +
    (channels[2] ?? 0) * 0.0722
  );
}
function contrast(left: string, right: string): number {
  const values = [luminance(left), luminance(right)].sort((a, b) => a - b);
  return ((values[1] ?? 0) + 0.05) / ((values[0] ?? 0) + 0.05);
}
function token(name: string): string {
  const css = readFileSync(
    new URL("../src/tokens.css", import.meta.url),
    "utf8",
  );
  const match = new RegExp(`--ui-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!match?.[1])
    throw new Error(`Missing six-digit semantic color token: ${name}`);
  return match[1];
}

describe("initial shared color foundation", () => {
  it.each([
    ["text", "surface"],
    ["text", "canvas"],
    ["muted", "surface"],
    ["muted", "canvas"],
    ["accent", "accent-soft"],
    ["on-accent", "accent"],
    ["danger", "danger-soft"],
  ])("keeps normal %s text readable on %s", (foreground, background) => {
    expect(
      contrast(token(foreground), token(background)),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["surface", "canvas", "accent-soft"])(
    "keeps the focus ring visible on %s",
    (background) => {
      expect(
        contrast(token("focus"), token(background)),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
