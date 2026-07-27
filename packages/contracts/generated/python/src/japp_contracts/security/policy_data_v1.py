"""GENERATED FILE - DO NOT EDIT BY HAND.

Canonical M01-W04 security data derived from capability-catalog.v1.json,
command-catalog.v1.json, and authorization-policy.v1.json.

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Final, Literal, Mapping, NamedTuple, cast

from pydantic import ValidationError

from japp_contracts.error.taxonomy_v1 import ErrorTaxonomyV1ErrorCode
from japp_contracts.security.authorization_request_v1 import (
    SecurityAuthorizationRequestV1,
)
from japp_contracts.security.capability_taxonomy_v1 import (
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    SecurityCapabilityTaxonomyV1CapabilityId,
    SecurityCapabilityTaxonomyV1PrincipalId,
)
from japp_contracts.security.command_taxonomy_v1 import (
    SecurityCommandTaxonomyV1CommandId,
    SecurityCommandTaxonomyV1ConsequenceClass,
    SecurityCommandTaxonomyV1IdempotencyExpectation,
)


@dataclass(frozen=True, slots=True)
class PrincipalCatalogEntryV1:
    id: SecurityCapabilityTaxonomyV1PrincipalId
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class AuthorizationProfileCatalogEntryV1:
    id: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CapabilityCatalogEntryV1:
    id: SecurityCapabilityTaxonomyV1CapabilityId
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CommandCatalogEntryV1:
    id: SecurityCommandTaxonomyV1CommandId
    required_capability: SecurityCapabilityTaxonomyV1CapabilityId
    intended_target: SecurityCapabilityTaxonomyV1PrincipalId
    supported_profiles: tuple[
        SecurityCapabilityTaxonomyV1AuthorizationProfileId, ...
    ]
    max_encoded_payload_size_bytes: int
    consequence_class: SecurityCommandTaxonomyV1ConsequenceClass
    idempotency_expectation: SecurityCommandTaxonomyV1IdempotencyExpectation
    denial_error_code: ErrorTaxonomyV1ErrorCode
    description: str
    non_goals: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class AuthorizationPolicyRowV1:
    authorization_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    command_id: SecurityCommandTaxonomyV1CommandId
    originating_principal: SecurityCapabilityTaxonomyV1PrincipalId
    immediate_sender: SecurityCapabilityTaxonomyV1PrincipalId
    receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId
    target_principal: SecurityCapabilityTaxonomyV1PrincipalId


PRINCIPAL_CATALOG_V1: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1PrincipalId,
        PrincipalCatalogEntryV1,
    ]
] = MappingProxyType({
    "DESKTOP_APP": PrincipalCatalogEntryV1(
        id="DESKTOP_APP",
        description="The local user-facing desktop client, which may request bounded orchestrator services through typed contracts.",
        non_goals=(
            "Does not read raw database or artifact files.",
            "Does not invoke secret-store, process, registration, or platform operations directly.",
        ),
    ),
    "EXTENSION_CONTENT_SCRIPT": PrincipalCatalogEntryV1(
        id="EXTENSION_CONTENT_SCRIPT",
        description="The least-privileged page-world boundary that inspects and performs reviewed bounded browser operations.",
        non_goals=(
            "Does not request private data, model, artifact, platform, credential, or submission authority.",
            "Does not open native messaging or rewrite its originating identity.",
        ),
    ),
    "EXTENSION_SERVICE_WORKER": PrincipalCatalogEntryV1(
        id="EXTENSION_SERVICE_WORKER",
        description="The extension control boundary that validates content-script messages and owns the extension side of native messaging.",
        non_goals=(
            "Does not convert a content-script origin into a service-worker origin.",
            "Does not gain product authority merely by forwarding.",
        ),
    ),
    "MODEL_RUNTIME": PrincipalCatalogEntryV1(
        id="MODEL_RUNTIME",
        description="A bounded inference target whose outputs remain untrusted data requiring deterministic validation.",
        non_goals=(
            "Does not originate or authorize executable product commands.",
            "Does not receive browser, storage, platform, or submission authority.",
        ),
    ),
    "NATIVE_HOST": PrincipalCatalogEntryV1(
        id="NATIVE_HOST",
        description="The bounded typed proxy between extension native messaging and the authenticated loopback orchestrator.",
        non_goals=(
            "Does not originate privileged product requests.",
            "Does not overwrite the preserved origin or act as a confused deputy.",
        ),
    ),
    "ORCHESTRATOR": PrincipalCatalogEntryV1(
        id="ORCHESTRATOR",
        description="The local service boundary that owns private data access and AI orchestration through reviewed typed services.",
        non_goals=(
            "Does not directly manipulate browser pages.",
            "Does not perform or authorize final submission.",
        ),
    ),
    "PLATFORM_ADAPTER": PrincipalCatalogEntryV1(
        id="PLATFORM_ADAPTER",
        description="A narrow target for reviewed typed operating-system and runtime integration operations.",
        non_goals=(
            "Does not accept arbitrary commands, paths, registry data, executable names, or shell strings.",
            "Does not originate product workflow commands.",
        ),
    ),
    "PUBLIC_JOB_INDEX": PrincipalCatalogEntryV1(
        id="PUBLIC_JOB_INDEX",
        description="The public-data search boundary for permitted public job-index reads.",
        non_goals=(
            "Does not request, receive, infer, or expose private user data.",
            "Does not originate product workflow commands.",
        ),
    ),
    "VERIFICATION_HARNESS": PrincipalCatalogEntryV1(
        id="VERIFICATION_HARNESS",
        description="The synthetic fixture, benchmark, and gate execution boundary.",
        non_goals=(
            "Does not acquire private production-data authority.",
            "Does not acquire final-submission authority.",
        ),
    ),
})

AUTHORIZATION_PROFILE_CATALOG_V1: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1AuthorizationProfileId,
        AuthorizationProfileCatalogEntryV1,
    ]
] = MappingProxyType({
    "FEASIBILITY": AuthorizationProfileCatalogEntryV1(
        id="FEASIBILITY",
        description="Synthetic/local feasibility operations limited to bounded inspection, filling, validation, reconciliation, workflow control, and evidence collection.",
        non_goals=(
            "Does not enable production private-data, model, platform, or final-submission authority.",
            "Does not enable safe-next or safe-back navigation.",
        ),
    ),
    "GUIDED_PRE_SUBMIT": AuthorizationProfileCatalogEntryV1(
        id="GUIDED_PRE_SUBMIT",
        description="Reviewed guided operations that may reach a complete final-review state but stop before submission.",
        non_goals=(
            "Does not express passwords, account creation, email verification, MFA, CAPTCHA solving, unexpected legal consent, or unapproved consequential answers.",
            "Does not enable final submission or blind retry after uncertain navigation.",
        ),
    ),
    "PRODUCTION_NO_SUBMIT": AuthorizationProfileCatalogEntryV1(
        id="PRODUCTION_NO_SUBMIT",
        description="Reviewed production operations and typed local services with final submission intentionally absent.",
        non_goals=(
            "Does not enable final submission.",
            "Does not turn bounded service authority into raw database, filesystem, registry, process, or shell access.",
        ),
    ),
    "VERIFICATION": AuthorizationProfileCatalogEntryV1(
        id="VERIFICATION",
        description="Synthetic fixture, benchmark, and gate operations used to prove contract and policy behavior.",
        non_goals=(
            "Does not access private production data.",
            "Does not enable final submission.",
        ),
    ),
})

CAPABILITY_CATALOG_V1: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1CapabilityId,
        CapabilityCatalogEntryV1,
    ]
] = MappingProxyType({
    "ARTIFACT_READ": CapabilityCatalogEntryV1(
        id="ARTIFACT_READ",
        description="Read a reviewed artifact through a bounded orchestrator-owned service.",
        non_goals=(
            "Does not grant arbitrary path or raw filesystem access.",
        ),
    ),
    "ARTIFACT_WRITE": CapabilityCatalogEntryV1(
        id="ARTIFACT_WRITE",
        description="Write a reviewed artifact through a bounded orchestrator-owned service.",
        non_goals=(
            "Does not grant arbitrary path, overwrite, delete, or raw filesystem access.",
        ),
    ),
    "MODEL_INFERENCE": CapabilityCatalogEntryV1(
        id="MODEL_INFERENCE",
        description="Request bounded model inference whose result remains untrusted data.",
        non_goals=(
            "Does not grant the model command authority or permit unvalidated output to execute.",
        ),
    ),
    "PAGE_DOCUMENT_UPLOAD": CapabilityCatalogEntryV1(
        id="PAGE_DOCUMENT_UPLOAD",
        description="Attach one previously reviewed document through a bounded page control.",
        non_goals=(
            "Does not browse arbitrary paths or select an unreviewed document.",
        ),
    ),
    "PAGE_INSPECT": CapabilityCatalogEntryV1(
        id="PAGE_INSPECT",
        description="Read bounded page state, descriptors, and visible control metadata.",
        non_goals=(
            "Does not capture raw page HTML, secrets, tokens, or unrestricted DOM data.",
        ),
    ),
    "PAGE_MUTATE_BOUNDED": CapabilityCatalogEntryV1(
        id="PAGE_MUTATE_BOUNDED",
        description="Propose or apply reviewed field operations through bounded control drivers.",
        non_goals=(
            "Does not permit arbitrary selectors, JavaScript, credentials, legal consent, or consequential answers.",
        ),
    ),
    "PAGE_NAVIGATE_BOUNDED": CapabilityCatalogEntryV1(
        id="PAGE_NAVIGATE_BOUNDED",
        description="Navigate only to a reviewed safe next or back step.",
        non_goals=(
            "Does not authorize uncertain navigation, final submission, or blind replay.",
        ),
    ),
    "PAGE_VALIDATE_RECONCILE_REVIEW": CapabilityCatalogEntryV1(
        id="PAGE_VALIDATE_RECONCILE_REVIEW",
        description="Verify field values, reconcile page state, and report reviewed final state.",
        non_goals=(
            "Does not treat model text or untrusted page text as an authorization decision.",
        ),
    ),
    "PLATFORM_BROWSER_RUNTIME_DISCOVERY": CapabilityCatalogEntryV1(
        id="PLATFORM_BROWSER_RUNTIME_DISCOVERY",
        description="Query bounded browser/runtime availability through a reviewed platform adapter operation.",
        non_goals=(
            "Does not launch arbitrary executables or accept arbitrary paths.",
        ),
    ),
    "PLATFORM_NATIVE_MESSAGING_REGISTRATION": CapabilityCatalogEntryV1(
        id="PLATFORM_NATIVE_MESSAGING_REGISTRATION",
        description="Represent reviewed native-messaging registration as a known future bounded platform authority.",
        non_goals=(
            "Does not currently grant a registration operation or accept arbitrary registry data.",
        ),
    ),
    "PLATFORM_PROCESS_SUPERVISION": CapabilityCatalogEntryV1(
        id="PLATFORM_PROCESS_SUPERVISION",
        description="Request one reviewed process-lifecycle operation through the platform adapter.",
        non_goals=(
            "Does not execute arbitrary programs, arguments, shell commands, or scripts.",
        ),
    ),
    "PLATFORM_SECRET_STORE_ACCESS": CapabilityCatalogEntryV1(
        id="PLATFORM_SECRET_STORE_ACCESS",
        description="Request one reviewed secret-store operation through the platform adapter.",
        non_goals=(
            "Does not expose secret values to callers that lack the exact typed operation.",
        ),
    ),
    "PRIVATE_DATA_READ": CapabilityCatalogEntryV1(
        id="PRIVATE_DATA_READ",
        description="Read private application data through a bounded orchestrator service.",
        non_goals=(
            "Does not grant raw database, SQL, file, or secret-store access.",
        ),
    ),
    "PRIVATE_DATA_WRITE": CapabilityCatalogEntryV1(
        id="PRIVATE_DATA_WRITE",
        description="Write private application data through a bounded orchestrator service.",
        non_goals=(
            "Does not grant raw database, SQL, migration, deletion, or filesystem access.",
        ),
    ),
    "PUBLIC_JOB_INDEX_READ": CapabilityCatalogEntryV1(
        id="PUBLIC_JOB_INDEX_READ",
        description="Query the permitted public job index without private-user context.",
        non_goals=(
            "Does not transmit or retrieve private user data.",
        ),
    ),
    "SUBMISSION_FINAL": CapabilityCatalogEntryV1(
        id="SUBMISSION_FINAL",
        description="Represent the known consequential final-submit authority so current policy can prove it has zero grants.",
        non_goals=(
            "Does not grant final submission in any current profile.",
        ),
    ),
    "VERIFICATION_EXECUTION": CapabilityCatalogEntryV1(
        id="VERIFICATION_EXECUTION",
        description="Run bounded synthetic fixtures, benchmarks, and verification gates.",
        non_goals=(
            "Does not run arbitrary code or access private production data.",
        ),
    ),
    "WORKFLOW_CONTROL": CapabilityCatalogEntryV1(
        id="WORKFLOW_CONTROL",
        description="Pause or cancel a bounded workflow safely.",
        non_goals=(
            "Does not continue, submit, or repeat a consequential action.",
        ),
    ),
})

COMMAND_CATALOG_V1: Final[
    Mapping[
        SecurityCommandTaxonomyV1CommandId,
        CommandCatalogEntryV1,
    ]
] = MappingProxyType({
    "ARTIFACT_READ_REQUEST": CommandCatalogEntryV1(
        id="ARTIFACT_READ_REQUEST",
        required_capability="ARTIFACT_READ",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "PRODUCTION_NO_SUBMIT",
        ),
        max_encoded_payload_size_bytes=65536,
        consequence_class="SENSITIVE_SERVICE",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request one reviewed artifact through the orchestrator artifact service.",
        non_goals=(
            "Does not carry or authorize an arbitrary filesystem path.",
            "Does not permit direct desktop or extension filesystem access.",
        ),
    ),
    "ARTIFACT_WRITE_REQUEST": CommandCatalogEntryV1(
        id="ARTIFACT_WRITE_REQUEST",
        required_capability="ARTIFACT_WRITE",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "PRODUCTION_NO_SUBMIT",
        ),
        max_encoded_payload_size_bytes=1048576,
        consequence_class="SENSITIVE_SERVICE",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request one reviewed artifact write through the orchestrator artifact service.",
        non_goals=(
            "Does not carry or authorize an arbitrary filesystem path.",
            "Does not authorize delete, recursive overwrite, or raw filesystem access.",
        ),
    ),
    "MODEL_INFERENCE_REQUEST": CommandCatalogEntryV1(
        id="MODEL_INFERENCE_REQUEST",
        required_capability="MODEL_INFERENCE",
        intended_target="MODEL_RUNTIME",
        supported_profiles=(
            "PRODUCTION_NO_SUBMIT",
        ),
        max_encoded_payload_size_bytes=262144,
        consequence_class="SENSITIVE_SERVICE",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request bounded local model inference from the orchestrator.",
        non_goals=(
            "Does not grant command authority to model output.",
            "Does not permit direct extension, desktop, or native-host model access.",
        ),
    ),
    "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS": CommandCatalogEntryV1(
        id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        required_capability="PAGE_MUTATE_BOUNDED",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=262144,
        consequence_class="REVERSIBLE_MUTATION",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Apply a reviewed bounded set of field operations through controlled page drivers.",
        non_goals=(
            "Does not authorize arbitrary selectors, scripts, passwords, legal consent, or final submission.",
            "Does not authorize blind replay after an uncertain result.",
        ),
    ),
    "PAGE_NAVIGATE_BACK": CommandCatalogEntryV1(
        id="PAGE_NAVIGATE_BACK",
        required_capability="PAGE_NAVIGATE_BOUNDED",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=32768,
        consequence_class="CONTROL_FLOW",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Navigate to one reviewed safe previous step.",
        non_goals=(
            "Does not authorize arbitrary URLs, selectors, scripts, or replay after uncertain navigation.",
        ),
    ),
    "PAGE_NAVIGATE_NEXT": CommandCatalogEntryV1(
        id="PAGE_NAVIGATE_NEXT",
        required_capability="PAGE_NAVIGATE_BOUNDED",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=32768,
        consequence_class="CONTROL_FLOW",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Navigate to one reviewed safe next step that is not a final-submit action.",
        non_goals=(
            "Does not authorize final submission, uncertain navigation, arbitrary selectors, or blind replay.",
        ),
    ),
    "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS": CommandCatalogEntryV1(
        id="PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        required_capability="PAGE_MUTATE_BOUNDED",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=262144,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Ask the orchestrator to propose bounded field operations from already reviewed data and page descriptors.",
        non_goals=(
            "Does not execute a proposal or accept capability claims from model output.",
            "Does not authorize credentials, account creation, MFA, CAPTCHA, legal consent, or consequential answers.",
        ),
    ),
    "PAGE_RECONCILE_STATE": CommandCatalogEntryV1(
        id="PAGE_RECONCILE_STATE",
        required_capability="PAGE_VALIDATE_RECONCILE_REVIEW",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=131072,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Re-read bounded page state and reconcile it against the expected reviewed state.",
        non_goals=(
            "Does not silently mutate controls, navigate, or submit.",
        ),
    ),
    "PAGE_REPORT_FINAL_REVIEW": CommandCatalogEntryV1(
        id="PAGE_REPORT_FINAL_REVIEW",
        required_capability="PAGE_VALIDATE_RECONCILE_REVIEW",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=262144,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Report bounded final-review descriptors to the orchestrator while stopping before submission.",
        non_goals=(
            "Does not authorize or imply final submission.",
            "Does not include raw page HTML, secrets, tokens, or caller-supplied decisions.",
        ),
    ),
    "PAGE_REPORT_STATE": CommandCatalogEntryV1(
        id="PAGE_REPORT_STATE",
        required_capability="PAGE_INSPECT",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=262144,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Report bounded page state and descriptors through the service-worker and native-host route to the orchestrator.",
        non_goals=(
            "Does not include raw page HTML, secrets, tokens, or executable content.",
            "Does not change the preserved content-script origin while forwarding.",
        ),
    ),
    "PAGE_SCAN_VISIBLE_CONTROLS": CommandCatalogEntryV1(
        id="PAGE_SCAN_VISIBLE_CONTROLS",
        required_capability="PAGE_INSPECT",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=32768,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Scan visible controls and bounded descriptors without mutation.",
        non_goals=(
            "Does not collect raw page HTML, secrets, hidden credentials, or arbitrary DOM data.",
        ),
    ),
    "PAGE_UPLOAD_REVIEWED_DOCUMENT": CommandCatalogEntryV1(
        id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        required_capability="PAGE_DOCUMENT_UPLOAD",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=65536,
        consequence_class="REVERSIBLE_MUTATION",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Attach one previously reviewed document through a bounded file control.",
        non_goals=(
            "Does not carry an arbitrary path or permit browsing the filesystem.",
            "Does not upload an unreviewed document or submit the application.",
        ),
    ),
    "PAGE_VERIFY_FIELD_VALUES": CommandCatalogEntryV1(
        id="PAGE_VERIFY_FIELD_VALUES",
        required_capability="PAGE_VALIDATE_RECONCILE_REVIEW",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=131072,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Verify bounded field values against the reviewed expected state.",
        non_goals=(
            "Does not repair mismatches silently, navigate, or submit.",
        ),
    ),
    "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST": CommandCatalogEntryV1(
        id="PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
        required_capability="PLATFORM_BROWSER_RUNTIME_DISCOVERY",
        intended_target="PLATFORM_ADAPTER",
        supported_profiles=(),
        max_encoded_payload_size_bytes=16384,
        consequence_class="PLATFORM_SERVICE",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request bounded browser/runtime discovery from the platform adapter.",
        non_goals=(
            "Does not carry arbitrary paths, executable names, arguments, registry data, or shell text.",
        ),
    ),
    "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST": CommandCatalogEntryV1(
        id="PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
        required_capability="PLATFORM_NATIVE_MESSAGING_REGISTRATION",
        intended_target="PLATFORM_ADAPTER",
        supported_profiles=(),
        max_encoded_payload_size_bytes=16384,
        consequence_class="PLATFORM_SERVICE",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Represent native-messaging registration as a known bounded future platform command with no current grant.",
        non_goals=(
            "Does not currently authorize registration.",
            "Does not carry arbitrary registry keys, manifest paths, executable paths, or shell commands.",
        ),
    ),
    "PLATFORM_PROCESS_SUPERVISION_REQUEST": CommandCatalogEntryV1(
        id="PLATFORM_PROCESS_SUPERVISION_REQUEST",
        required_capability="PLATFORM_PROCESS_SUPERVISION",
        intended_target="PLATFORM_ADAPTER",
        supported_profiles=(),
        max_encoded_payload_size_bytes=16384,
        consequence_class="PLATFORM_SERVICE",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request one reviewed bounded lifecycle operation for a known application-owned process.",
        non_goals=(
            "Does not carry arbitrary executable names, paths, arguments, scripts, or shell commands.",
        ),
    ),
    "PLATFORM_SECRET_STORE_REQUEST": CommandCatalogEntryV1(
        id="PLATFORM_SECRET_STORE_REQUEST",
        required_capability="PLATFORM_SECRET_STORE_ACCESS",
        intended_target="PLATFORM_ADAPTER",
        supported_profiles=(),
        max_encoded_payload_size_bytes=16384,
        consequence_class="PLATFORM_SERVICE",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request one reviewed typed secret-store operation from the platform adapter.",
        non_goals=(
            "Does not carry a caller-defined backend, command, path, registry key, or arbitrary secret identifier.",
        ),
    ),
    "PRIVATE_DATA_READ_REQUEST": CommandCatalogEntryV1(
        id="PRIVATE_DATA_READ_REQUEST",
        required_capability="PRIVATE_DATA_READ",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "PRODUCTION_NO_SUBMIT",
        ),
        max_encoded_payload_size_bytes=65536,
        consequence_class="SENSITIVE_SERVICE",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request bounded private application data through the orchestrator service.",
        non_goals=(
            "Does not carry SQL, a database path, a filesystem path, or a secret-store operation.",
            "Does not permit extension or native-host origin.",
        ),
    ),
    "PRIVATE_DATA_WRITE_REQUEST": CommandCatalogEntryV1(
        id="PRIVATE_DATA_WRITE_REQUEST",
        required_capability="PRIVATE_DATA_WRITE",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "PRODUCTION_NO_SUBMIT",
        ),
        max_encoded_payload_size_bytes=262144,
        consequence_class="SENSITIVE_SERVICE",
        idempotency_expectation="IDEMPOTENCY_KEY_REQUIRED",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Request one bounded private-data write through the orchestrator service.",
        non_goals=(
            "Does not carry SQL, migration commands, raw database records, paths, or delete-all authority.",
            "Does not permit extension or native-host origin.",
        ),
    ),
    "PUBLIC_JOB_INDEX_QUERY": CommandCatalogEntryV1(
        id="PUBLIC_JOB_INDEX_QUERY",
        required_capability="PUBLIC_JOB_INDEX_READ",
        intended_target="PUBLIC_JOB_INDEX",
        supported_profiles=(
            "PRODUCTION_NO_SUBMIT",
        ),
        max_encoded_payload_size_bytes=65536,
        consequence_class="READ_ONLY",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Query permitted public job-index data without private-user context.",
        non_goals=(
            "Does not transmit private user data or grant the public index product authority.",
        ),
    ),
    "SUBMISSION_FINAL_SUBMIT": CommandCatalogEntryV1(
        id="SUBMISSION_FINAL_SUBMIT",
        required_capability="SUBMISSION_FINAL",
        intended_target="EXTENSION_CONTENT_SCRIPT",
        supported_profiles=(),
        max_encoded_payload_size_bytes=4096,
        consequence_class="CONSEQUENTIAL_FINAL_ACTION",
        idempotency_expectation="NOT_REPEATABLE",
        denial_error_code="SUBMISSION_PROHIBITED_FINAL_ACTION",
        description="Name the consequential final-submit action so every current profile can prove it has zero authority.",
        non_goals=(
            "Does not authorize final submission in any current profile.",
            "Does not imply a future auto-submit profile or bypass later prerequisites.",
        ),
    ),
    "VERIFICATION_RUN_SYNTHETIC_SUITE": CommandCatalogEntryV1(
        id="VERIFICATION_RUN_SYNTHETIC_SUITE",
        required_capability="VERIFICATION_EXECUTION",
        intended_target="VERIFICATION_HARNESS",
        supported_profiles=(
            "FEASIBILITY",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=65536,
        consequence_class="SYNTHETIC_VERIFICATION",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Run one declared synthetic fixture, benchmark, or verification-gate operation.",
        non_goals=(
            "Does not run arbitrary code, production data, OS commands, or final submission.",
        ),
    ),
    "WORKFLOW_CANCEL": CommandCatalogEntryV1(
        id="WORKFLOW_CANCEL",
        required_capability="WORKFLOW_CONTROL",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=8192,
        consequence_class="CONTROL_FLOW",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Cancel a bounded workflow and prevent further dispatch.",
        non_goals=(
            "Does not delete accepted results or trigger compensating product actions automatically.",
        ),
    ),
    "WORKFLOW_PAUSE": CommandCatalogEntryV1(
        id="WORKFLOW_PAUSE",
        required_capability="WORKFLOW_CONTROL",
        intended_target="ORCHESTRATOR",
        supported_profiles=(
            "FEASIBILITY",
            "GUIDED_PRE_SUBMIT",
            "PRODUCTION_NO_SUBMIT",
            "VERIFICATION",
        ),
        max_encoded_payload_size_bytes=8192,
        consequence_class="CONTROL_FLOW",
        idempotency_expectation="IDEMPOTENT",
        denial_error_code="TRANSPORT_FORBIDDEN",
        description="Pause a bounded workflow before another operation is dispatched.",
        non_goals=(
            "Does not resume, retry, navigate, or submit automatically.",
        ),
    ),
})

AUTHORIZATION_POLICY_V1: Final[tuple[AuthorizationPolicyRowV1, ...]] = (
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="VERIFICATION_RUN_SYNTHETIC_SUITE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="VERIFICATION_HARNESS",
        target_principal="VERIFICATION_HARNESS",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="WORKFLOW_CANCEL",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="FEASIBILITY",
        command_id="WORKFLOW_PAUSE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="WORKFLOW_CANCEL",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="GUIDED_PRE_SUBMIT",
        command_id="WORKFLOW_PAUSE",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="ARTIFACT_READ_REQUEST",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="ARTIFACT_WRITE_REQUEST",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="MODEL_INFERENCE_REQUEST",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="MODEL_RUNTIME",
        target_principal="MODEL_RUNTIME",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="ORCHESTRATOR",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="ORCHESTRATOR",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PRIVATE_DATA_READ_REQUEST",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PRIVATE_DATA_WRITE_REQUEST",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="PUBLIC_JOB_INDEX_QUERY",
        originating_principal="ORCHESTRATOR",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="PUBLIC_JOB_INDEX",
        target_principal="PUBLIC_JOB_INDEX",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="WORKFLOW_CANCEL",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="PRODUCTION_NO_SUBMIT",
        command_id="WORKFLOW_PAUSE",
        originating_principal="DESKTOP_APP",
        immediate_sender="DESKTOP_APP",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_BACK",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_NAVIGATE_NEXT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_RECONCILE_STATE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_REPORT_FINAL_REVIEW",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_CONTENT_SCRIPT",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="NATIVE_HOST",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_REPORT_STATE",
        originating_principal="EXTENSION_CONTENT_SCRIPT",
        immediate_sender="NATIVE_HOST",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_SCAN_VISIBLE_CONTROLS",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_UPLOAD_REVIEWED_DOCUMENT",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="EXTENSION_SERVICE_WORKER",
        receiving_principal="EXTENSION_CONTENT_SCRIPT",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="NATIVE_HOST",
        receiving_principal="EXTENSION_SERVICE_WORKER",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="ORCHESTRATOR",
        receiving_principal="NATIVE_HOST",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="PAGE_VERIFY_FIELD_VALUES",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="EXTENSION_CONTENT_SCRIPT",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="VERIFICATION_RUN_SYNTHETIC_SUITE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="VERIFICATION_HARNESS",
        target_principal="VERIFICATION_HARNESS",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="WORKFLOW_CANCEL",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
    AuthorizationPolicyRowV1(
        authorization_profile="VERIFICATION",
        command_id="WORKFLOW_PAUSE",
        originating_principal="VERIFICATION_HARNESS",
        immediate_sender="VERIFICATION_HARNESS",
        receiving_principal="ORCHESTRATOR",
        target_principal="ORCHESTRATOR",
    ),
)

PRINCIPAL_IDS_V1: Final[
    tuple[SecurityCapabilityTaxonomyV1PrincipalId, ...]
] = (
    "DESKTOP_APP",
    "EXTENSION_CONTENT_SCRIPT",
    "EXTENSION_SERVICE_WORKER",
    "MODEL_RUNTIME",
    "NATIVE_HOST",
    "ORCHESTRATOR",
    "PLATFORM_ADAPTER",
    "PUBLIC_JOB_INDEX",
    "VERIFICATION_HARNESS",
)
AUTHORIZATION_PROFILES_V1: Final[
    tuple[SecurityCapabilityTaxonomyV1AuthorizationProfileId, ...]
] = (
    "FEASIBILITY",
    "GUIDED_PRE_SUBMIT",
    "PRODUCTION_NO_SUBMIT",
    "VERIFICATION",
)
CAPABILITY_IDS_V1: Final[
    tuple[SecurityCapabilityTaxonomyV1CapabilityId, ...]
] = (
    "ARTIFACT_READ",
    "ARTIFACT_WRITE",
    "MODEL_INFERENCE",
    "PAGE_DOCUMENT_UPLOAD",
    "PAGE_INSPECT",
    "PAGE_MUTATE_BOUNDED",
    "PAGE_NAVIGATE_BOUNDED",
    "PAGE_VALIDATE_RECONCILE_REVIEW",
    "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
    "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
    "PLATFORM_PROCESS_SUPERVISION",
    "PLATFORM_SECRET_STORE_ACCESS",
    "PRIVATE_DATA_READ",
    "PRIVATE_DATA_WRITE",
    "PUBLIC_JOB_INDEX_READ",
    "SUBMISSION_FINAL",
    "VERIFICATION_EXECUTION",
    "WORKFLOW_CONTROL",
)
COMMAND_IDS_V1: Final[tuple[SecurityCommandTaxonomyV1CommandId, ...]] = (
    "ARTIFACT_READ_REQUEST",
    "ARTIFACT_WRITE_REQUEST",
    "MODEL_INFERENCE_REQUEST",
    "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    "PAGE_NAVIGATE_BACK",
    "PAGE_NAVIGATE_NEXT",
    "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    "PAGE_RECONCILE_STATE",
    "PAGE_REPORT_FINAL_REVIEW",
    "PAGE_REPORT_STATE",
    "PAGE_SCAN_VISIBLE_CONTROLS",
    "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    "PAGE_VERIFY_FIELD_VALUES",
    "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
    "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
    "PLATFORM_PROCESS_SUPERVISION_REQUEST",
    "PLATFORM_SECRET_STORE_REQUEST",
    "PRIVATE_DATA_READ_REQUEST",
    "PRIVATE_DATA_WRITE_REQUEST",
    "PUBLIC_JOB_INDEX_QUERY",
    "SUBMISSION_FINAL_SUBMIT",
    "VERIFICATION_RUN_SYNTHETIC_SUITE",
    "WORKFLOW_CANCEL",
    "WORKFLOW_PAUSE",
)


def is_principal_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in PRINCIPAL_CATALOG_V1


def is_authorization_profile_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in AUTHORIZATION_PROFILE_CATALOG_V1


def is_capability_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in CAPABILITY_CATALOG_V1


def is_command_id_v1(value: object) -> bool:
    return isinstance(value, str) and value in COMMAND_CATALOG_V1


def require_capability_entry_v1(value: object) -> CapabilityCatalogEntryV1:
    if not is_capability_id_v1(value):
        msg = "unknown capability id: not a member of the v1 capability catalog"
        raise KeyError(msg)
    return CAPABILITY_CATALOG_V1[
        cast("SecurityCapabilityTaxonomyV1CapabilityId", value)
    ]


def require_command_entry_v1(value: object) -> CommandCatalogEntryV1:
    if not is_command_id_v1(value):
        msg = "unknown command id: not a member of the v1 command catalog"
        raise KeyError(msg)
    return COMMAND_CATALOG_V1[
        cast("SecurityCommandTaxonomyV1CommandId", value)
    ]


def _policy_key(
    profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    command: SecurityCommandTaxonomyV1CommandId,
    origin: SecurityCapabilityTaxonomyV1PrincipalId,
    sender: SecurityCapabilityTaxonomyV1PrincipalId,
    receiver: SecurityCapabilityTaxonomyV1PrincipalId,
    target: SecurityCapabilityTaxonomyV1PrincipalId,
) -> tuple[str, str, str, str, str, str]:
    return (profile, command, origin, sender, receiver, target)


_POLICY_KEYS: Final = frozenset(
    _policy_key(
        row.authorization_profile,
        row.command_id,
        row.originating_principal,
        row.immediate_sender,
        row.receiving_principal,
        row.target_principal,
    )
    for row in AUTHORIZATION_POLICY_V1
)


def allowed_commands_for_v1(
    profile: object,
    origin: object,
    sender: object,
    receiver: object,
    target: object,
) -> tuple[SecurityCommandTaxonomyV1CommandId, ...]:
    if not (
        is_authorization_profile_id_v1(profile)
        and is_principal_id_v1(origin)
        and is_principal_id_v1(sender)
        and is_principal_id_v1(receiver)
        and is_principal_id_v1(target)
    ):
        return ()
    typed_profile = cast("SecurityCapabilityTaxonomyV1AuthorizationProfileId", profile)
    typed_origin = cast("SecurityCapabilityTaxonomyV1PrincipalId", origin)
    typed_sender = cast("SecurityCapabilityTaxonomyV1PrincipalId", sender)
    typed_receiver = cast("SecurityCapabilityTaxonomyV1PrincipalId", receiver)
    typed_target = cast("SecurityCapabilityTaxonomyV1PrincipalId", target)
    return tuple(
        command
        for command in COMMAND_IDS_V1
        if _policy_key(
            typed_profile,
            command,
            typed_origin,
            typed_sender,
            typed_receiver,
            typed_target,
        )
        in _POLICY_KEYS
    )


@dataclass(frozen=True, slots=True)
class AuthorizationRuntimeContextV1:
    receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId
    authenticated_sender_principal: SecurityCapabilityTaxonomyV1PrincipalId
    authenticated_originating_principal: SecurityCapabilityTaxonomyV1PrincipalId
    active_profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId
    observed_payload_size_bytes: int


class AuthorizationAllowedV1(NamedTuple):
    authorized: Literal[True]
    command_id: SecurityCommandTaxonomyV1CommandId
    required_capability: SecurityCapabilityTaxonomyV1CapabilityId


class AuthorizationDeniedV1(NamedTuple):
    authorized: Literal[False]
    error_code: ErrorTaxonomyV1ErrorCode


AuthorizationOutcomeV1 = AuthorizationAllowedV1 | AuthorizationDeniedV1

_CONTENT_ORIGIN_COMMANDS: Final = frozenset(
    {"PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE"}
)
_DESKTOP_ORIGIN_COMMANDS: Final = frozenset(
    {
        "ARTIFACT_READ_REQUEST",
        "ARTIFACT_WRITE_REQUEST",
        "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
        "PRIVATE_DATA_READ_REQUEST",
        "PRIVATE_DATA_WRITE_REQUEST",
        "WORKFLOW_CANCEL",
        "WORKFLOW_PAUSE",
    }
)
_ORCHESTRATOR_ORIGIN_COMMANDS: Final = frozenset(
    {
        "MODEL_INFERENCE_REQUEST",
        "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        "PAGE_NAVIGATE_BACK",
        "PAGE_NAVIGATE_NEXT",
        "PAGE_RECONCILE_STATE",
        "PAGE_SCAN_VISIBLE_CONTROLS",
        "PAGE_UPLOAD_REVIEWED_DOCUMENT",
        "PAGE_VERIFY_FIELD_VALUES",
        "PUBLIC_JOB_INDEX_QUERY",
    }
)
_IDEMPOTENCY_KEY_REQUIRED_COMMANDS: Final = frozenset(
    {
        "ARTIFACT_WRITE_REQUEST",
        "MODEL_INFERENCE_REQUEST",
        "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
        "PAGE_NAVIGATE_BACK",
        "PAGE_NAVIGATE_NEXT",
        "PAGE_UPLOAD_REVIEWED_DOCUMENT",
        "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
        "PLATFORM_PROCESS_SUPERVISION_REQUEST",
        "PLATFORM_SECRET_STORE_REQUEST",
        "PRIVATE_DATA_WRITE_REQUEST",
    }
)
_VERIFICATION_CAPABILITIES: Final = frozenset(
    {
        "PAGE_DOCUMENT_UPLOAD",
        "PAGE_INSPECT",
        "PAGE_MUTATE_BOUNDED",
        "PAGE_NAVIGATE_BOUNDED",
        "PAGE_VALIDATE_RECONCILE_REVIEW",
        "VERIFICATION_EXECUTION",
        "WORKFLOW_CONTROL",
    }
)
_PROFILE_CAPABILITY_CEILINGS: Final[
    Mapping[
        SecurityCapabilityTaxonomyV1AuthorizationProfileId,
        frozenset[SecurityCapabilityTaxonomyV1CapabilityId],
    ]
] = MappingProxyType({
    "FEASIBILITY": frozenset({
        "PAGE_INSPECT",
        "PAGE_MUTATE_BOUNDED",
        "PAGE_VALIDATE_RECONCILE_REVIEW",
        "VERIFICATION_EXECUTION",
        "WORKFLOW_CONTROL",
    }),
    "GUIDED_PRE_SUBMIT": frozenset({
        "PAGE_DOCUMENT_UPLOAD",
        "PAGE_INSPECT",
        "PAGE_MUTATE_BOUNDED",
        "PAGE_NAVIGATE_BOUNDED",
        "PAGE_VALIDATE_RECONCILE_REVIEW",
        "WORKFLOW_CONTROL",
    }),
    "PRODUCTION_NO_SUBMIT": frozenset({
        "ARTIFACT_READ",
        "ARTIFACT_WRITE",
        "MODEL_INFERENCE",
        "PAGE_DOCUMENT_UPLOAD",
        "PAGE_INSPECT",
        "PAGE_MUTATE_BOUNDED",
        "PAGE_NAVIGATE_BOUNDED",
        "PAGE_VALIDATE_RECONCILE_REVIEW",
        "PRIVATE_DATA_READ",
        "PRIVATE_DATA_WRITE",
        "PUBLIC_JOB_INDEX_READ",
        "WORKFLOW_CONTROL",
    }),
    "VERIFICATION": frozenset({
        "PAGE_DOCUMENT_UPLOAD",
        "PAGE_INSPECT",
        "PAGE_MUTATE_BOUNDED",
        "PAGE_NAVIGATE_BOUNDED",
        "PAGE_VALIDATE_RECONCILE_REVIEW",
        "VERIFICATION_EXECUTION",
        "WORKFLOW_CONTROL",
    }),
})
_PRIVILEGED_CONTENT_CAPABILITIES: Final = frozenset(
    {
        "ARTIFACT_READ",
        "ARTIFACT_WRITE",
        "MODEL_INFERENCE",
        "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
        "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
        "PLATFORM_PROCESS_SUPERVISION",
        "PLATFORM_SECRET_STORE_ACCESS",
        "PRIVATE_DATA_READ",
        "PRIVATE_DATA_WRITE",
        "PUBLIC_JOB_INDEX_READ",
        "SUBMISSION_FINAL",
    }
)


def _architecturally_forbidden(
    request: SecurityAuthorizationRequestV1,
    command: CommandCatalogEntryV1,
) -> bool:
    origin = request.originating_principal
    if command.id == "SUBMISSION_FINAL_SUBMIT":
        return True
    if command.required_capability == "SUBMISSION_FINAL":
        return True
    if command.required_capability.startswith("PLATFORM_"):
        return True
    if (
        command.required_capability
        not in _PROFILE_CAPABILITY_CEILINGS[request.authorization_profile]
    ):
        return True
    if origin == "EXTENSION_CONTENT_SCRIPT" and (
        command.required_capability in _PRIVILEGED_CONTENT_CAPABILITIES
        or command.id not in _CONTENT_ORIGIN_COMMANDS
    ):
        return True
    if origin in {
        "EXTENSION_SERVICE_WORKER",
        "NATIVE_HOST",
        "MODEL_RUNTIME",
        "PLATFORM_ADAPTER",
        "PUBLIC_JOB_INDEX",
    }:
        return True
    if origin == "DESKTOP_APP" and (
        command.id not in _DESKTOP_ORIGIN_COMMANDS
        or request.target_principal == "PLATFORM_ADAPTER"
    ):
        return True
    if (
        origin == "ORCHESTRATOR"
        and command.id not in _ORCHESTRATOR_ORIGIN_COMMANDS
    ):
        return True
    return bool(
        origin == "VERIFICATION_HARNESS"
        and (
            request.authorization_profile not in {"FEASIBILITY", "VERIFICATION"}
            or command.required_capability not in _VERIFICATION_CAPABILITIES
        )
    )


def _deny(error_code: ErrorTaxonomyV1ErrorCode) -> AuthorizationDeniedV1:
    return AuthorizationDeniedV1(False, error_code)


def authorize_command_request_v1(
    value: object,
    context: object,
) -> AuthorizationOutcomeV1:
    if not isinstance(context, AuthorizationRuntimeContextV1):
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    if not (
        is_principal_id_v1(context.receiving_principal)
        and is_principal_id_v1(context.authenticated_sender_principal)
        and is_principal_id_v1(context.authenticated_originating_principal)
        and is_authorization_profile_id_v1(context.active_profile)
        and type(context.observed_payload_size_bytes) is int
        and 0 <= context.observed_payload_size_bytes <= 9_007_199_254_740_991
    ):
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    try:
        wire_value: object
        if isinstance(value, SecurityAuthorizationRequestV1):
            wire_value = SecurityAuthorizationRequestV1.model_dump(
                value,
                mode="python",
                exclude_unset=True,
                warnings="error",
            )
        else:
            wire_value = value
        request = SecurityAuthorizationRequestV1.model_validate(wire_value)
    except (ValidationError, TypeError, ValueError):
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    if (
        request.immediate_sender != context.authenticated_sender_principal
        or request.originating_principal
        != context.authenticated_originating_principal
        or request.authorization_profile != context.active_profile
    ):
        return _deny("TRANSPORT_FORBIDDEN")
    if request.payload_size_bytes != context.observed_payload_size_bytes:
        return _deny("TRANSPORT_MALFORMED_MESSAGE")
    command = COMMAND_CATALOG_V1[request.command_id]
    if command.id == "SUBMISSION_FINAL_SUBMIT":
        return _deny("SUBMISSION_PROHIBITED_FINAL_ACTION")
    if (
        request.target_principal != command.intended_target
        or _architecturally_forbidden(request, command)
    ):
        return _deny("TRANSPORT_FORBIDDEN")
    if request.authorization_profile not in command.supported_profiles:
        return _deny(command.denial_error_code)
    if (
        context.observed_payload_size_bytes
        > command.max_encoded_payload_size_bytes
    ):
        return _deny("TRANSPORT_PAYLOAD_TOO_LARGE")
    if (
        command.id in _IDEMPOTENCY_KEY_REQUIRED_COMMANDS
        and request.idempotency_key is None
    ):
        return _deny("VALIDATION_MISSING_REQUIRED_DATA")
    key = _policy_key(
        request.authorization_profile,
        request.command_id,
        request.originating_principal,
        request.immediate_sender,
        context.receiving_principal,
        request.target_principal,
    )
    if key not in _POLICY_KEYS:
        return _deny(command.denial_error_code)
    return AuthorizationAllowedV1(
        True,
        command.id,
        command.required_capability,
    )
