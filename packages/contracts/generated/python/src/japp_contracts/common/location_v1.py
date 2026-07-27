"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/location.v1.schema.json
Schema id: urn:japp:schema:common:location:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, reject_explicit_null

CommonLocationV1CountryCode = Annotated[str, StringConstraints(pattern="^[A-Z]{2}$")]

class CommonLocationV1StructuredLocation(ContractModel):
    "Structured civil location. Minimum content policy: the country is required; region (state/province), locality (city/town), and postal code are optional and, when present, must be non-empty and bounded. Country codes are SYNTACTICALLY checked (two uppercase ASCII letters, the ISO 3166-1 alpha-2 shape) but are NOT validated against the ISO 3166 catalog; postal codes are checked for shape only, never against per-country postal registries. Free-text single-line addresses are not part of this definition."

    country: CommonLocationV1CountryCode
    region: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=100)], Field(description="State, province, or first-level administrative division name.")] | None = None
    locality: Annotated[Annotated[str, StringConstraints(min_length=1, max_length=100)], Field(description="City, town, or equivalent locality name.")] | None = None
    postal_code: Annotated[Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9 -]{0,15}$")], Field(description="Postal or ZIP code; shape-checked only.")] | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("region", "locality", "postal_code",),
        )
