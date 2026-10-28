"""Synthetic discovery counterexamples; no existing runtime or model is touched."""

from __future__ import annotations

# Literal independent wire limits and source identities are test oracles.
# ruff: noqa: PLR2004
import asyncio
import json
from collections.abc import Callable

import pytest

from orchestrator.generation.types import ErrorCode, GenerationFailure, Limits
from orchestrator.runtime import metadata
from orchestrator.runtime.metadata import ProbeLimits, Reason, RuntimeDiscovery, State
from orchestrator.runtime.transport import Operation, Target

GEMMA = "ded7a27350032202d9e9b2a6071e8aa89959ab156771b5228f30863c741c4970"
QWEN = "bdbd181c33f2ed1b31c972991882db3cf4d192569092138a7d29e973cd9debe8"
CHILD = "a" * 64


def _json(value: object) -> bytes:
    return json.dumps(value, separators=(",", ":")).encode()


def _responses(target: Target = Target.GEMMA12B) -> dict[Operation, bytes]:
    mlx = target is Target.GEMMA12B
    details = {
        "format": "safetensors" if mlx else "gguf",
        "runner": "mlx" if mlx else "ggml",
    }
    return {
        Operation.VERSION: _json({"version": "0.40.2"}),
        Operation.TAGS: _json(
            {
                "models": [
                    {
                        "name": target.value,
                        "digest": GEMMA if mlx else QWEN,
                        "size": 7714091504 if mlx else 9276198565,
                        "details": details,
                    }
                ]
            }
        ),
        Operation.SHOW: _json(
            {
                "details": details,
                "capabilities": ["completion", "thinking"],
                "thinking": {"values": [False, True], "default": True},
                "requires": "0.31.0",
            }
        ),
    }


class _Fake:
    def __init__(self, responses: dict[Operation, bytes] | None = None) -> None:
        self.responses = _responses() if responses is None else responses
        self.calls: list[Operation] = []
        self.before: Callable[[Operation], None] = lambda _operation: None

    async def request(
        self, operation: Operation, target: Target, limits: Limits
    ) -> bytes:
        assert isinstance(target, Target)
        assert limits.wire_bytes <= 262144
        self.calls.append(operation)
        self.before(operation)
        return self.responses[operation]


@pytest.mark.parametrize("operation", [Operation.TAGS, Operation.SHOW])
def test_pinned_gemma_empty_optional_descriptions_mean_unknown(
    operation: Operation,
) -> None:
    async def scenario() -> None:
        responses = _responses()
        payload = json.loads(responses[operation])
        row = payload["models"][0] if operation is Operation.TAGS else payload
        # Exact descriptive shape observed from the prescribed public candidate
        # on pinned Ollama 0.40.2; empty strings do not establish model facts.
        row["details"] = {
            "parent_model": "",
            "format": "safetensors",
            "family": "",
            "families": None,
            "parameter_size": "",
            "quantization_level": "",
            "runner": "mlx",
        }
        responses[operation] = _json(payload)
        result = await RuntimeDiscovery(_Fake(responses)).discover(
            Target.GEMMA12B, expected_digest=GEMMA
        )
        assert result.state is State.INSTALLED_UNQUALIFIED
        assert result.reason is Reason.EVALUATION_NOT_RUN
        assert result.requests_completed == 3
        assert result.model is not None
        assert result.model.reported_tag_digest == GEMMA
        assert result.model.tag_runner == "mlx"
        assert result.model.show_runner == "mlx"
        assert not result.qualified_full
        assert not result.runtime_digest_verified
        assert not result.release_permitted
        parsed = metadata._Details.model_validate(row["details"])
        assert parsed.family is None
        assert parsed.parameter_size is None
        assert parsed.quantization_level is None

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", [Operation.TAGS, Operation.SHOW])
@pytest.mark.parametrize("field", ["family", "parameter_size", "quantization_level"])
@pytest.mark.parametrize("value", ["\x00", "a" * 97, 4])
def test_unknown_description_normalization_preserves_malformed_refusal(
    operation: Operation, field: str, value: object
) -> None:
    async def scenario() -> None:
        responses = _responses()
        payload = json.loads(responses[operation])
        row = payload["models"][0] if operation is Operation.TAGS else payload
        row["details"][field] = value
        responses[operation] = _json(payload)
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.state is State.MALFORMED
        assert result.reason is Reason.INVALID_METADATA
        assert result.model is None

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", [Operation.TAGS, Operation.SHOW])
def test_empty_required_format_is_not_an_unknown_description(
    operation: Operation,
) -> None:
    async def scenario() -> None:
        responses = _responses()
        payload = json.loads(responses[operation])
        row = payload["models"][0] if operation is Operation.TAGS else payload
        row["details"]["format"] = ""
        responses[operation] = _json(payload)
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.state is State.MALFORMED
        assert result.reason is Reason.INVALID_METADATA

    asyncio.run(scenario())


@pytest.mark.parametrize("target", [Target.GEMMA12B, Target.QWEN14B])
@pytest.mark.parametrize("prefixed", [False, True])
def test_actual_full_digest_shapes_stay_installed_but_unqualified(
    target: Target, prefixed: bool
) -> None:
    async def scenario() -> None:
        responses = _responses(target)
        tags = json.loads(responses[Operation.TAGS])
        digest = GEMMA if target is Target.GEMMA12B else QWEN
        tags["models"][0]["digest"] = "sha256:" + digest if prefixed else digest
        responses[Operation.TAGS] = _json(tags)
        if target is Target.QWEN14B:
            show = json.loads(responses[Operation.SHOW])
            show["details"].pop("runner")
            responses[Operation.SHOW] = _json(show)
        result = await RuntimeDiscovery(_Fake(responses)).discover(
            target, expected_digest=digest
        )
        assert result.state is State.INSTALLED_UNQUALIFIED
        assert result.reason is Reason.EVALUATION_NOT_RUN
        assert result.requests_completed == 3
        assert result.model is not None
        assert result.model.reported_tag_digest == digest
        assert result.model.selected_manifest is None
        assert result.model.tag_runner == (
            "mlx" if target is Target.GEMMA12B else "ggml"
        )
        assert result.model.show_runner == (
            "mlx" if target is Target.GEMMA12B else None
        )
        assert not result.runtime_digest_verified
        assert not result.model.runtime_digest_verified
        assert not result.qualified_full
        assert not result.release_permitted
        assert result.deterministic_core == "PRESERVED"

    asyncio.run(scenario())


def test_selected_child_receipt_never_replaces_parent_digest_or_qualification() -> None:
    async def scenario() -> None:
        responses = _responses()
        show = json.loads(responses[Operation.SHOW])
        show["manifests"] = [
            {
                "digest": "sha256:" + CHILD,
                "runner": "mlx",
                "format": "safetensors",
                "selected": True,
            }
        ]
        responses[Operation.SHOW] = _json(show)
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.model is not None
        assert result.model.reported_tag_digest == GEMMA
        assert result.model.selected_manifest is not None
        assert result.model.selected_manifest.digest == CHILD
        assert result.model.selected_manifest.runner == "mlx"
        assert not result.runtime_digest_verified

    asyncio.run(scenario())


def test_absent_model_does_not_show_download_or_fall_back() -> None:
    async def scenario() -> None:
        responses = _responses()
        responses[Operation.TAGS] = _json({"models": []})
        fake = _Fake(responses)
        result = await RuntimeDiscovery(fake).discover(Target.GEMMA12B)
        assert result.state is State.NO_MODEL
        assert result.reason is Reason.MODEL_NOT_INSTALLED
        assert result.model is None
        assert fake.calls == [Operation.VERSION, Operation.TAGS]

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "payload",
    [
        b"",
        b"[]",
        b'{"version":true}',
        b'{"version":"0.40.2","version":"0.40.2"}',
        b'{"version":NaN}',
        b"\xff",
        _json({"version": "0.40.2", "other": [[[[[[[[[[[[[[[[[[0]]]]]]]]]]]]]]]]]]}),
    ],
)
def test_malformed_version_metadata_fails_closed_before_model_requests(
    payload: bytes,
) -> None:
    async def scenario() -> None:
        fake = _Fake({Operation.VERSION: payload})
        result = await RuntimeDiscovery(fake).discover(Target.GEMMA12B)
        assert result.state is State.MALFORMED
        assert result.model is None
        assert fake.calls == [Operation.VERSION]

    asyncio.run(scenario())


@pytest.mark.parametrize("version", ["0.30.0", "0.40.3", "9.0.0"])
def test_unreviewed_runtime_versions_are_explicitly_unsupported(version: str) -> None:
    async def scenario() -> None:
        fake = _Fake({Operation.VERSION: _json({"version": version})})
        result = await RuntimeDiscovery(fake).discover(Target.GEMMA12B)
        assert result.state is State.UNSUPPORTED
        assert result.reason is Reason.INCOMPATIBLE_VERSION
        assert fake.calls == [Operation.VERSION]

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "patch",
    [
        {"remote_host": "https://example.invalid"},
        {"remote_model": "cloud-model"},
        {"details": {"format": "gguf", "runner": "ggml"}},
        {"capabilities": ["thinking"]},
        {"thinking": None},
        {"thinking": {"values": [True], "default": True}},
        {"thinking": {"values": [False], "default": True}},
        {"requires": "0.41.0"},
        {
            "manifests": [
                {"digest": CHILD, "runner": "ggml", "format": "gguf", "selected": True}
            ]
        },
    ],
)
def test_advertised_incompatible_capability_never_qualifies(
    patch: dict[str, object],
) -> None:
    async def scenario() -> None:
        responses = _responses()
        show = json.loads(responses[Operation.SHOW])
        show.update(patch)
        responses[Operation.SHOW] = _json(show)
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.state is State.UNSUPPORTED
        assert result.reason is Reason.UNSUPPORTED_CAPABILITY
        assert not result.qualified_full

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "bad_digest",
    ["ded7a2735003", "sha256:ded7a2735003", "A" * 64, "g" * 64, "file:///private"],
)
def test_short_or_invalid_reported_digests_are_malformed(bad_digest: str) -> None:
    async def scenario() -> None:
        responses = _responses()
        tags = json.loads(responses[Operation.TAGS])
        tags["models"][0]["digest"] = bad_digest
        responses[Operation.TAGS] = _json(tags)
        fake = _Fake(responses)
        result = await RuntimeDiscovery(fake).discover(Target.GEMMA12B)
        assert result.state is State.MALFORMED
        assert Operation.SHOW not in fake.calls

    asyncio.run(scenario())


def test_expected_digest_mismatch_retains_exact_untrusted_receipt() -> None:
    async def scenario() -> None:
        result = await RuntimeDiscovery(_Fake()).discover(
            Target.GEMMA12B, expected_digest=CHILD
        )
        assert result.state is State.UNSUPPORTED
        assert result.reason is Reason.ARTIFACT_DIGEST_MISMATCH
        assert result.model is not None
        assert result.model.reported_tag_digest == GEMMA

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "change",
    [
        "duplicate_target",
        "boolean_size",
        "too_many_models",
        "too_many_capabilities",
        "thinking_integer",
        "ambiguous_manifest",
        "body_limit",
    ],
)
def test_bounded_metadata_structure_and_exact_primitive_types(change: str) -> None:
    async def scenario() -> None:
        responses = _responses()
        tags = json.loads(responses[Operation.TAGS])
        show = json.loads(responses[Operation.SHOW])
        if change == "duplicate_target":
            tags["models"] *= 2
        elif change == "boolean_size":
            tags["models"][0]["size"] = True
        elif change == "too_many_models":
            tags["models"] *= 257
        elif change == "too_many_capabilities":
            show["capabilities"] = ["completion"] * 33
        elif change == "thinking_integer":
            show["thinking"]["values"] = [0, True]
        elif change == "ambiguous_manifest":
            show["manifests"] = [
                {
                    "digest": CHILD,
                    "runner": "mlx",
                    "format": "safetensors",
                    "selected": False,
                }
            ]
        responses[Operation.TAGS] = _json(tags)
        responses[Operation.SHOW] = _json(show)
        limits = ProbeLimits(body_bytes=8) if change == "body_limit" else None
        result = await RuntimeDiscovery(_Fake(responses)).discover(
            Target.GEMMA12B, limits=limits
        )
        assert result.state is State.MALFORMED
        assert not result.runtime_digest_verified

    asyncio.run(scenario())


def test_projection_never_contains_private_upstream_fields() -> None:
    async def scenario() -> None:
        responses = _responses()
        show = json.loads(responses[Operation.SHOW])
        show.update(
            dict.fromkeys(
                ["system", "template", "messages", "modelfile", "license", "arbitrary"],
                "synthetic-private-not-for-retention",
            )
        )
        responses[Operation.SHOW] = _json(show)
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.state is State.INSTALLED_UNQUALIFIED
        assert "synthetic-private" not in result.model_dump_json()
        assert "template" not in result.model_dump_json()

    asyncio.run(scenario())


def test_transport_refusal_is_safe_and_does_not_choose_an_alternative() -> None:
    class Refused(_Fake):
        async def request(
            self, operation: Operation, target: Target, limits: Limits
        ) -> bytes:
            del operation, target, limits
            raise GenerationFailure(ErrorCode.TRANSPORT)

    async def scenario() -> None:
        result = await RuntimeDiscovery(Refused()).discover(Target.GEMMA12B)
        assert result.state is State.UNAVAILABLE
        assert result.reason is Reason.RUNTIME_UNAVAILABLE
        assert result.model is None

    asyncio.run(scenario())


def test_caller_cancellation_and_busy_state_preserve_single_owned_operation() -> None:
    async def scenario() -> None:
        entered = asyncio.Event()
        blocked = asyncio.Event()

        class Blocked(_Fake):
            async def request(
                self, operation: Operation, target: Target, limits: Limits
            ) -> bytes:
                entered.set()
                await blocked.wait()
                return await super().request(operation, target, limits)

        fake = Blocked()
        client = RuntimeDiscovery(fake)
        owner = asyncio.create_task(client.discover(Target.GEMMA12B))
        await entered.wait()
        result = await client.discover(Target.QWEN14B)
        assert result.state is State.BUSY
        owner.cancel("caller-owned")
        with pytest.raises(asyncio.CancelledError) as error:
            await owner
        assert error.value.args == ("caller-owned",)
        blocked.set()
        assert (
            await client.discover(Target.GEMMA12B)
        ).state is State.INSTALLED_UNQUALIFIED

    asyncio.run(scenario())


@pytest.mark.parametrize("phase", [Operation.VERSION, Operation.TAGS, Operation.SHOW])
def test_one_original_deadline_fences_already_ready_metadata(
    phase: Operation, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = [asyncio.get_running_loop().time()]
        monkeypatch.setattr(metadata, "_monotonic", lambda: clock[0])
        fake = _Fake()

        def advance(operation: Operation) -> None:
            if operation is phase:
                clock[0] += 2

        fake.before = advance
        result = await RuntimeDiscovery(fake).discover(
            Target.GEMMA12B, limits=ProbeLimits(total_seconds=1.0)
        )
        assert result.state is State.UNAVAILABLE
        assert result.reason is Reason.TIMEOUT
        assert not result.qualified_full

    asyncio.run(scenario())


@pytest.mark.parametrize(
    ("phase", "completed"), [(Operation.TAGS, 2), (Operation.SHOW, 3)]
)
def test_failure_receipt_preserves_actual_completed_metadata_request_count(
    phase: Operation, completed: int
) -> None:
    async def scenario() -> None:
        responses = _responses()
        responses[phase] = b"{}"
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.state is State.MALFORMED
        assert result.requests_completed == completed

    asyncio.run(scenario())


def test_contradictory_tag_runner_is_not_hidden_by_a_compatible_show() -> None:
    async def scenario() -> None:
        responses = _responses()
        tags = json.loads(responses[Operation.TAGS])
        tags["models"][0]["details"]["runner"] = "ggml"
        responses[Operation.TAGS] = _json(tags)
        result = await RuntimeDiscovery(_Fake(responses)).discover(Target.GEMMA12B)
        assert result.state is State.UNSUPPORTED
        assert result.model is not None
        assert result.model.tag_runner == "ggml"
        assert result.model.show_runner == "mlx"

    asyncio.run(scenario())


@pytest.mark.parametrize("phase", list(Operation))
def test_synchronous_projection_cannot_publish_after_original_deadline(
    phase: Operation, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def scenario() -> None:
        clock = [asyncio.get_running_loop().time()]
        monkeypatch.setattr(metadata, "_monotonic", lambda: clock[0])
        responses = _responses()
        decode = metadata._decode

        def delayed_decode(payload: bytes, limit: int) -> object:
            result = decode(payload, limit)
            if payload == responses[phase]:
                clock[0] += 2
            return result

        monkeypatch.setattr(metadata, "_decode", delayed_decode)
        result = await RuntimeDiscovery(_Fake(responses)).discover(
            Target.GEMMA12B, limits=ProbeLimits(total_seconds=1.0)
        )
        assert result.state is State.UNAVAILABLE
        assert result.reason is Reason.TIMEOUT

    asyncio.run(scenario())


def test_three_requests_consume_one_original_total_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def scenario() -> None:
        clock = [asyncio.get_running_loop().time()]
        monkeypatch.setattr(metadata, "_monotonic", lambda: clock[0])
        fake = _Fake()

        def advance(operation: Operation) -> None:
            del operation
            clock[0] += 0.4

        fake.before = advance
        result = await RuntimeDiscovery(fake).discover(
            Target.GEMMA12B, limits=ProbeLimits(total_seconds=1.0)
        )
        assert fake.calls == list(Operation)
        assert result.state is State.UNAVAILABLE
        assert result.reason is Reason.TIMEOUT

    asyncio.run(scenario())


@pytest.mark.parametrize("phase", list(Operation))
@pytest.mark.parametrize("outcome", ["ready", "protocol"])
def test_adapter_suppressed_caller_cancellation_never_publishes_metadata_or_error(
    phase: Operation, outcome: str
) -> None:
    async def scenario() -> None:
        entered = asyncio.Event()

        class Swallow(_Fake):
            async def request(
                self, operation: Operation, target: Target, limits: Limits
            ) -> bytes:
                if operation is phase:
                    entered.set()
                    try:
                        await asyncio.Event().wait()
                    except asyncio.CancelledError:
                        if outcome == "protocol":
                            raise GenerationFailure(ErrorCode.PROTOCOL) from None
                return await super().request(operation, target, limits)

        published = []

        async def operation() -> None:
            published.append(
                await RuntimeDiscovery(Swallow()).discover(Target.GEMMA12B)
            )

        owner = asyncio.create_task(operation())
        await entered.wait()
        owner.cancel("caller-owned")
        with pytest.raises(asyncio.CancelledError):
            await owner
        assert owner.cancelling() == 1
        assert published == []

    asyncio.run(scenario())


def test_already_queued_caller_cancellation_denies_entry_before_any_request() -> None:
    async def scenario() -> None:
        fake = _Fake()
        published = []

        async def operation() -> None:
            task = asyncio.current_task()
            assert task is not None
            task.cancel("queued-caller")
            published.append(await RuntimeDiscovery(fake).discover(Target.GEMMA12B))

        owner = asyncio.create_task(operation())
        with pytest.raises(asyncio.CancelledError):
            await owner
        assert owner.cancelling() == 1
        assert published == []
        assert fake.calls == []

    asyncio.run(scenario())


@pytest.mark.parametrize("outcome", ["protocol", "timeout", "malformed"])
def test_pending_caller_cancellation_dominates_every_error_mapping(
    outcome: str,
) -> None:
    async def scenario() -> None:
        class Pending(_Fake):
            async def request(
                self, operation: Operation, target: Target, limits: Limits
            ) -> bytes:
                del operation, target, limits
                task = asyncio.current_task()
                assert task is not None
                task.cancel("pending-caller")
                if outcome == "protocol":
                    raise GenerationFailure(ErrorCode.PROTOCOL)
                if outcome == "timeout":
                    raise TimeoutError
                raise ValueError("synthetic-private")

        published = []

        async def operation() -> None:
            published.append(
                await RuntimeDiscovery(Pending()).discover(Target.GEMMA12B)
            )

        owner = asyncio.create_task(operation())
        with pytest.raises(asyncio.CancelledError):
            await owner
        assert owner.cancelling() == 1
        assert published == []

    asyncio.run(scenario())
