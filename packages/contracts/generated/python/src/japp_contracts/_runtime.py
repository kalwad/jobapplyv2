"""GENERATED FILE - DO NOT EDIT BY HAND.

Shared runtime for the generated strict Pydantic v2 contract models.

Source of truth: packages/contracts/schemas/ (complete catalog)
Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

import datetime
from typing import cast

from pydantic import BaseModel, ConfigDict

type JsonValue = (
    bool | int | float | str | None | list[JsonValue] | dict[str, JsonValue]
)
"""One JSON value: opaque, untrusted data preserved exactly as parsed."""


class ContractModel(BaseModel):
    """Base for every generated contract model.

    Strict semantics mirror the canonical Ajv catalog: unknown members are
    rejected (extra="forbid"), no type coercion happens (strict=True), no
    defaults are injected into wire data, and validation never mutates or
    removes members.
    """

    model_config = ConfigDict(extra="forbid", strict=True)

    def wire_dict(self) -> dict[str, JsonValue]:
        """Canonical wire representation of this record.

        Members that were absent on input (never set) stay absent on
        output; explicitly provided members - including deliberate nulls on
        required nullable members - are preserved exactly.
        """
        return cast(
            "dict[str, JsonValue]",
            self.model_dump(mode="json", exclude_unset=True),
        )


def reject_explicit_null(data: object, fields: tuple[str, ...]) -> object:
    """Reject explicit nulls on optional non-nullable members.

    Missing and null are distinct: an optional non-nullable member is
    omitted when unknown, and null is a validation error (the known-none
    case exists only on required nullable members).
    """
    if isinstance(data, dict):
        for name in fields:
            if name in data and data[name] is None:
                msg = (
                    f"{name} is optional and non-nullable: omit the member "
                    "instead of sending null"
                )
                raise ValueError(msg)
    return data


def _validate_date_parts(value: str, year: int, month: int, day: int) -> None:
    # Year 0000 is valid in RFC 3339 (proleptic Gregorian) but below
    # datetime.MINYEAR; year 2000 shares its leap-year behavior (both are
    # divisible by 400), so it substitutes for calendar validation only.
    probe_year = 2000 if year == 0 else year
    try:
        datetime.date(probe_year, month, day)
    except ValueError as exc:
        msg = f"invalid calendar date: {value}"
        raise ValueError(msg) from exc


def validate_calendar_date(value: str) -> str:
    """Mirror the Ajv full-mode "date" assertion (calendar validity)."""
    _validate_date_parts(value, int(value[0:4]), int(value[5:7]), int(value[8:10]))
    return value


def validate_utc_timestamp(value: str) -> str:
    """Mirror the Ajv full-mode "date-time" assertion.

    The sibling pattern already fixed the rendering (uppercase T and Z,
    two-digit fields, optional 1-9 fractional digits); this validator adds
    calendar validity and the time ranges Ajv enforces: hour <= 23,
    minute <= 59, and second <= 59 except the 23:59:60 leap-second slot.
    """
    _validate_date_parts(value, int(value[0:4]), int(value[5:7]), int(value[8:10]))
    hour, minute, second = int(value[11:13]), int(value[14:16]), int(value[17:19])
    valid_time = (
        hour <= 23
        and minute <= 59
        and (second <= 59 or (second == 60 and hour == 23 and minute == 59))
    )
    if not valid_time:
        msg = f"invalid UTC time of day: {value}"
        raise ValueError(msg)
    return value
