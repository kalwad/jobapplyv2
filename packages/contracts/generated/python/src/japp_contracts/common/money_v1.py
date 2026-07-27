"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/money.v1.schema.json
Schema id: urn:japp:schema:common:money:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import StringConstraints

from japp_contracts._runtime import ContractModel

CommonMoneyV1CurrencyCode = Annotated[str, StringConstraints(pattern="^[A-Z]{3}$")]

CommonMoneyV1DecimalAmount = Annotated[str, StringConstraints(pattern="^-?(0|[1-9][0-9]*)(\\.[0-9]{1,6})?$")]
"Optional leading minus, integer part without leading zeros, optional fraction of 1-6 digits. No exponent, no plus sign, no grouping."

class CommonMoneyV1Money(ContractModel):
    "Monetary amount with currency. Amounts are decimal strings, never binary floating-point JSON numbers, so no precision is lost in transit or storage. The grammar forbids exponents, signs other than a single leading minus, leading zeros, trailing decimal points, and grouping separators; at most six fractional digits are allowed. Currency codes are SYNTACTICALLY checked (three uppercase ASCII letters, the ISO 4217 alphabetic shape) but are NOT validated against the ISO 4217 catalog — this repository does not maintain that catalog, so 'XXX'-style codes pass syntax. Any future exact-catalog validation must add the catalog and its maintenance policy explicitly."

    amount: CommonMoneyV1DecimalAmount
    currency: CommonMoneyV1CurrencyCode
