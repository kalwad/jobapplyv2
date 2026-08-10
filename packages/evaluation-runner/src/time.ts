import { validateCommonTimestampUtcV1UtcTimestamp } from "@japp/contracts/generated";

import { runnerFail } from "./errors.ts";

/**
 * Shared W05 UTC-instant authority. The canonical common timestamp contract
 * (`urn:japp:schema:common:timestamp-utc:v1`) owns whether text is a real
 * calendar-valid UTC instant, including month lengths, leap years, and the
 * 23:59:60Z leap-second control accepted by the contract corpus. Execution
 * and report replay must both pass through this module; neither may fall
 * back to a weaker regex-plus-JavaScript-Date calendar interpretation, and
 * no JavaScript Date API may own numeric projection semantics here.
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
 * Proleptic-Gregorian calendar arithmetic over the contract's whole
 * four-digit year domain (0000–9999). No JavaScript Date API may own any
 * timestamp semantics here: the built-in numeric date constructor remaps
 * years 0–99 onto 1900–1999, which silently corrupts contract-valid
 * low-year instants. The leap rule matches the canonical validator:
 * divisible by 4, except divisible by 100, unless divisible by 400 (0000
 * and 0400 leap; 0100 and 1900 common; 2000 leap).
 */
function isProlepticGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Days from January 1 to the start of each month in a common year. */
const COMMON_YEAR_MONTH_START_DAYS = [
  0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
] as const;

/**
 * Complete days in years [0, year). Every operand is a non-negative
 * integer, so this never relies on JavaScript's truncating division of
 * negative values; signed epoch days come only from subtracting the fixed
 * 1970 ordinal afterwards. Year 0000 itself is a leap year and counts as a
 * multiple of 4, 100, and 400.
 */
function daysInYearsBeforeYear(year: number): number {
  if (year === 0) {
    return 0;
  }
  const lastPriorYear = year - 1;
  const leapDays =
    Math.floor(lastPriorYear / 4) -
    Math.floor(lastPriorYear / 100) +
    Math.floor(lastPriorYear / 400) +
    1;
  return year * 365 + leapDays;
}

/** Day ordinal of a proleptic-Gregorian calendar date from 0000-01-01. */
function dayOrdinalFromYearZero(
  year: number,
  month: number,
  day: number,
): number {
  const monthStart = COMMON_YEAR_MONTH_START_DAYS[month - 1];
  if (monthStart === undefined) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      "/time",
      "contract-valid instant carried an out-of-range month",
    );
  }
  const leapDay = month > 2 && isProlepticGregorianLeapYear(year) ? 1 : 0;
  return daysInYearsBeforeYear(year) + monthStart + leapDay + (day - 1);
}

const EPOCH_DAY_ORDINAL = dayOrdinalFromYearZero(1970, 1, 1);
const SAFE_INTEGER_MILLISECONDS = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Deterministic epoch-millisecond projection of a contract-valid instant.
 * Calendar validity is already contract-owned, so this is pure proleptic
 * Gregorian integer arithmetic relative to 1970-01-01T00:00:00Z: the
 * contract's leap-second form (second 60 at 23:59Z) projects naturally to
 * the first millisecond of the next UTC minute under this leap-table-free
 * Unix-style mapping, and fractional seconds beyond millisecond resolution
 * truncate deterministically. BigInt carries the combination and the value
 * converts to Number only after a proven safe-integer bound.
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
  const yearValue = Number(year);
  const monthValue = Number(month);
  const dayValue = Number(day);
  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = Number(second);
  // Fail-closed guard on the arithmetic's own input domain. The canonical
  // contract owns full calendar validity; this only refuses to compute if a
  // decomposed field could break the integer calendar arithmetic itself.
  if (
    !Number.isSafeInteger(yearValue) ||
    yearValue < 0 ||
    yearValue > 9999 ||
    monthValue < 1 ||
    monthValue > 12 ||
    dayValue < 1 ||
    dayValue > 31 ||
    hourValue > 23 ||
    minuteValue > 59 ||
    secondValue > 60
  ) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "contract-valid instant decomposed outside the canonical UTC field domain",
    );
  }
  const fraction = match[7] ?? "";
  const fractionMilliseconds =
    fraction === "" ? 0 : Number(fraction.padEnd(3, "0").slice(0, 3));
  const epochDays = BigInt(
    dayOrdinalFromYearZero(yearValue, monthValue, dayValue) - EPOCH_DAY_ORDINAL,
  );
  const totalMilliseconds =
    epochDays * 86_400_000n +
    BigInt(hourValue) * 3_600_000n +
    BigInt(minuteValue) * 60_000n +
    BigInt(secondValue) * 1_000n +
    BigInt(fractionMilliseconds);
  if (
    totalMilliseconds > SAFE_INTEGER_MILLISECONDS ||
    totalMilliseconds < -SAFE_INTEGER_MILLISECONDS
  ) {
    return runnerFail(
      "RUNNER_CLOCK_TIMESTAMP",
      pointer,
      "instant projection left the safe-integer millisecond range",
    );
  }
  return Number(totalMilliseconds);
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
