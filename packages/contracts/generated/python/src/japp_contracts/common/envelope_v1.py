"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/common/envelope.v1.schema.json
Schema id: urn:japp:schema:common:envelope:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated

from annotated_types import MaxLen
from pydantic import Field, StringConstraints, model_validator

from japp_contracts._runtime import ContractModel, JsonValue, reject_explicit_null
from japp_contracts.common.correlation_v1 import CommonCorrelationV1CausationId, CommonCorrelationV1CorrelationId
from japp_contracts.common.schema_version_v1 import CommonSchemaVersionV1SchemaId, CommonSchemaVersionV1SchemaVersion
from japp_contracts.common.stable_id_v1 import CommonStableIdV1StableId
from japp_contracts.common.timestamp_utc_v1 import CommonTimestampUtcV1UtcTimestamp

CommonEnvelopeV1ExtensionKey = Annotated[str, StringConstraints(pattern="^x-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", max_length=64)]
"Namespaced extension property name: x- followed by lowercase kebab-case."

CommonEnvelopeV1Extensions = Annotated[dict[CommonEnvelopeV1ExtensionKey, JsonValue], MaxLen(32)]
"Deliberately open object for forward-compatible unknown data. Values are opaque and untrusted."

class CommonEnvelopeV1EnvelopeMetadata(ContractModel):
    "Envelope metadata shared by every versioned message and record: payload schema identity (schema_id), declared payload schema version (schema_version), a stable message-or-record identity (message_id), the creation instant (created_at), and optional correlation/causation trace identifiers. The envelope object itself is closed; the ONLY forward-compatibility surface is the explicit extensions object, whose keys must be namespaced x-… tokens and whose values are opaque untrusted data — extension data is preserved but must never drive behavior without its own reviewed schema. Payload validation is a second phase: the enveloped-record shape deliberately leaves payload unconstrained here, and the contracts validator resolves schema_id/schema_version against the catalog before validating the payload (unknown majors are rejected; newer minors are rejected with an upgrade-required signal; see packages/contracts/README.md)."

    schema_id: Annotated[CommonSchemaVersionV1SchemaId, Field(description="Catalog identifier of the payload schema.")]
    schema_version: Annotated[CommonSchemaVersionV1SchemaVersion, Field(description="Exact payload schema version the producer wrote against.")]
    message_id: Annotated[CommonStableIdV1StableId, Field(description="Stable identity of this message or record.")]
    created_at: Annotated[CommonTimestampUtcV1UtcTimestamp, Field(description="Creation instant, always UTC.")]
    correlation_id: CommonCorrelationV1CorrelationId | None = None
    causation_id: CommonCorrelationV1CausationId | None = None
    extensions: CommonEnvelopeV1Extensions | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_explicit_null_for_absent_optionals(
        cls, data: object
    ) -> object:
        return reject_explicit_null(
            data,
            ("correlation_id", "causation_id", "extensions",),
        )

class CommonEnvelopeV1EnvelopedRecord(ContractModel):
    "Two-part shape: envelope metadata plus a payload validated in a second phase against the schema named by envelope.schema_id."

    envelope: CommonEnvelopeV1EnvelopeMetadata
    payload: JsonValue
