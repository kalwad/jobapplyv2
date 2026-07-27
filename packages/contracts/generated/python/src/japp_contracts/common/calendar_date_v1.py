"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/calendar-date.v1.schema.json
Schema id: urn:japp:schema:common:calendar-date:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import AfterValidator, StringConstraints

from japp_contracts._runtime import validate_calendar_date

CommonCalendarDateV1CalendarDate = Annotated[str, StringConstraints(pattern="^[0-9]{4}-[0-9]{2}-[0-9]{2}$"), AfterValidator(validate_calendar_date)]
