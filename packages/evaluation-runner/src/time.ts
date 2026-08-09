import { validateCommonTimestampUtcV1UtcTimestamp } from "@japp/contracts/generated";

import { runnerFail } from "./errors.ts";

/**
 * Shared W05 UTC-instant authority. The canonical common timestamp contract
 * (`urn:japp:schema:common:timestamp-utc:v1`) owns whether text is a real
 * calendar-valid UTC instant, including month lengths, leap years, and the
 * 23:59:60Z leap-second control accepted by the contract corpus. Execution
 * and report replay must both pass through this module; neither may fall
 * back to a weaker regex-plus-`Date.parse` calendar interpretation.
 */

const UTC_INSTANT_FIELDS =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?Z$/u;

export function validateUtcInstantText(
  value: unknown,
  pointer: string,
): string {
  if (typeof value !== "string") {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "expected canonical UTC timestamp text",
    );
  }
  const validation = validateCommonTimestampUtcV1UtcTimestamp(value);
  if (!validation.valid) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "text is not a calendar-valid canonical UTC instant under the common timestamp contract",
    );
  }
  return validation.value;
}

/**
 * Deterministic epoch-millisecond projection of a contract-valid instant.
 * Calendar validity is already contract-owned, so this is pure Gregorian
 * arithmetic: the contract's leap-second form (second 60 at 23:59Z) maps to
 * the first millisecond of the next UTC minute, and fractional seconds
 * beyond millisecond resolution truncate deterministically.
 */
export function utcInstantEpochMilliseconds(
  value: unknown,
  pointer: string,
): number {
  const text = validateUtcInstantText(value, pointer);
  const match = UTC_INSTANT_FIELDS.exec(text);
  const year = match?.[1];
  const month = match?.[2];
  const day = match?.[3];
  const hour = match?.[4];
  const minute = match?.[5];
  const second = match?.[6];
  if (
    match === null ||
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "contract-valid instant did not decompose into canonical UTC fields",
    );
  }
  const fraction = match[7] ?? "";
  const milliseconds = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const fractionMilliseconds =
    fraction === "" ? 0 : Number(fraction.padEnd(3, "0").slice(0, 3));
  return milliseconds + fractionMilliseconds;
}

/** Bounded non-negative duration between two contract-valid UTC instants. */
export function deriveDurationMilliseconds(
  startedAt: unknown,
  endedAt: unknown,
  pointer: string,
): number {
  const started = utcInstantEpochMilliseconds(
    startedAt,
    `${pointer}/started_at`,
  );
  const ended = utcInstantEpochMilliseconds(endedAt, `${pointer}/ended_at`);
  const duration = ended - started;
  if (
    !Number.isSafeInteger(duration) ||
    duration < 0 ||
    duration > 86_400_000
  ) {
    return runnerFail(
      "RUNNER_CLOCK_DURATION",
      pointer,
      "duration must be an integer from 0 through 86400000 milliseconds",
    );
  }
  return duration;
}
