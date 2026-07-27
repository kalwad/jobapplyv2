"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/contract-text.v1.schema.json
Schema id: urn:japp:schema:common:contract-text:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import Ge, Le
from pydantic import StringConstraints

CommonContractTextV1BoundedToken = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9._:@+/-]{0,127}$", min_length=1, max_length=128)]
"Compact inert token. It cannot carry whitespace, markup, scripts, selectors, or shell syntax."

CommonContractTextV1GitObjectId = Annotated[str, StringConstraints(pattern="^[0-9a-f]{40}$", min_length=40, max_length=40)]

CommonContractTextV1Locale = Annotated[str, StringConstraints(pattern="^[a-z]{2}(?:-[A-Z]{2})?$", min_length=2, max_length=5)]

CommonContractTextV1MetricValue = Annotated[int, Ge(0), Le(1000000000000)] | Annotated[float, Ge(0), Le(1000000000000)]

CommonContractTextV1NonNegativeSafeInteger = Annotated[int, Ge(0), Le(9007199254740991)]

CommonContractTextV1NormalizedText = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9 .,:!?()'&+/@_-]{0,511}$", min_length=1, max_length=512)]
"Normalized page or document text retained only as bounded untrusted data. Markup delimiters, backslashes, braces, dollar signs, and executable punctuation are excluded. Sensitivity (x-japp-sensitivity): INTERNAL. Redaction (x-japp-redaction): HASH_ONLY."

CommonContractTextV1PositiveSafeInteger = Annotated[int, Ge(1), Le(9007199254740991)]

CommonContractTextV1SchemaReference = Annotated[str, StringConstraints(pattern="^urn:japp:schema:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*:v(0|[1-9][0-9]*)(?:#\\/\\$defs\\/[A-Za-z][A-Za-z0-9]*)?$", min_length=24, max_length=256)]

CommonContractTextV1VersionText = Annotated[str, StringConstraints(pattern="^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$", min_length=5, max_length=32)]
