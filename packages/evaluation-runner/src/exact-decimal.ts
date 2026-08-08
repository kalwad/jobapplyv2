import { runnerFail } from "./errors.ts";

export interface ExactDecimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

function normalize(coefficient: bigint, scale: number): ExactDecimal {
  let normalizedCoefficient = coefficient;
  let normalizedScale = scale;
  while (
    normalizedScale > 0 &&
    normalizedCoefficient !== 0n &&
    normalizedCoefficient % 10n === 0n
  ) {
    normalizedCoefficient /= 10n;
    normalizedScale -= 1;
  }
  return {
    coefficient: normalizedCoefficient === 0n ? 0n : normalizedCoefficient,
    scale: normalizedCoefficient === 0n ? 0 : normalizedScale,
  };
}

/** Parse a finite JavaScript number through its canonical shortest decimal. */
export function exactDecimalFromNumber(value: number): ExactDecimal {
  if (!Number.isFinite(value)) {
    return runnerFail(
      "RUNNER_NONFINITE_METRIC",
      "/value",
      "metric values must be finite",
    );
  }
  return exactDecimalFromCanonicalText(String(value), true);
}

/**
 * Parse canonical signed decimal text. Exponent form is accepted only for the
 * JavaScript-number conversion path; serialized caller text must be plain and
 * canonical, so `01`, `1.0`, `+1`, `1e0`, and `-0` reject.
 */
export function exactDecimalFromCanonicalText(
  text: string,
  allowExponent = false,
): ExactDecimal {
  const pattern = allowExponent
    ? /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:e([+-]?[0-9]+))?$/u
    : /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]*[1-9]))?$/u;
  const match = pattern.exec(text);
  if (match === null || (!allowExponent && text === "-0")) {
    return runnerFail(
      "RUNNER_NONCANONICAL_DECIMAL",
      "/value",
      "expected canonical plain decimal text",
    );
  }
  const negative = match[1] === "-";
  const integer = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const exponentText = match[4] ?? "0";
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) {
    return runnerFail(
      "RUNNER_DECIMAL_EXPONENT",
      "/value",
      "decimal exponent is outside the bounded parser range",
    );
  }
  const digits = `${integer}${fraction}`;
  let coefficient = BigInt(digits);
  if (negative) {
    coefficient = -coefficient;
  }
  const scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    return normalize(coefficient, 0);
  }
  return normalize(coefficient, scale);
}

function alignedCoefficients(
  left: ExactDecimal,
  right: ExactDecimal,
): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * 10n ** BigInt(scale - left.scale),
    right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  ];
}

export function compareExactDecimals(
  left: ExactDecimal,
  right: ExactDecimal,
): -1 | 0 | 1 {
  const [leftCoefficient, rightCoefficient] = alignedCoefficients(left, right);
  if (leftCoefficient < rightCoefficient) {
    return -1;
  }
  if (leftCoefficient > rightCoefficient) {
    return 1;
  }
  return 0;
}

export function subtractExactDecimals(
  left: ExactDecimal,
  right: ExactDecimal,
): ExactDecimal {
  const [leftCoefficient, rightCoefficient, scale] = alignedCoefficients(
    left,
    right,
  );
  return normalize(leftCoefficient - rightCoefficient, scale);
}

export function absoluteExactDecimal(value: ExactDecimal): ExactDecimal {
  return {
    coefficient:
      value.coefficient < 0n ? -value.coefficient : value.coefficient,
    scale: value.scale,
  };
}

export function exactDecimalToText(value: ExactDecimal): string {
  const normalized = normalize(value.coefficient, value.scale);
  const negative = normalized.coefficient < 0n;
  const digits = (
    negative ? -normalized.coefficient : normalized.coefficient
  ).toString();
  if (normalized.scale === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }
  const padded = digits.padStart(normalized.scale + 1, "0");
  const split = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, split)}.${padded.slice(split)}`;
}

export function exactDecimalIsZero(value: ExactDecimal): boolean {
  return value.coefficient === 0n;
}

export function exactRatioPresentation(
  numerator: ExactDecimal,
  denominator: ExactDecimal,
  digits = 12,
): string | null {
  if (denominator.coefficient === 0n) {
    return null;
  }
  const scale = Math.max(numerator.scale, denominator.scale);
  const scaledNumerator =
    numerator.coefficient * 10n ** BigInt(scale - numerator.scale);
  const scaledDenominator =
    denominator.coefficient * 10n ** BigInt(scale - denominator.scale);
  const negative =
    (scaledNumerator < 0n && scaledDenominator > 0n) ||
    (scaledNumerator > 0n && scaledDenominator < 0n);
  const absoluteNumerator =
    scaledNumerator < 0n ? -scaledNumerator : scaledNumerator;
  const absoluteDenominator =
    scaledDenominator < 0n ? -scaledDenominator : scaledDenominator;
  const integer = absoluteNumerator / absoluteDenominator;
  let remainder = absoluteNumerator % absoluteDenominator;
  let fraction = "";
  for (let index = 0; index < digits && remainder !== 0n; index += 1) {
    remainder *= 10n;
    fraction += (remainder / absoluteDenominator).toString();
    remainder %= absoluteDenominator;
  }
  return `${negative ? "-" : ""}${integer.toString()}${fraction === "" ? "" : `.${fraction}`}`;
}
