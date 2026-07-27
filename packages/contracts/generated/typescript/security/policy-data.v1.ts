/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Sources of truth:
 * - packages/contracts/catalog/capability-catalog.v1.json
 * - packages/contracts/catalog/command-catalog.v1.json
 * - packages/contracts/catalog/authorization-policy.v1.json
 *
 * Regenerate: pnpm generate:contracts
 * Verify:     pnpm generate:contracts --check
 */

import type { ErrorTaxonomyV1ErrorCode } from "../error/taxonomy.v1.ts";
import type {
  SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  SecurityCapabilityTaxonomyV1CapabilityEntry,
  SecurityCapabilityTaxonomyV1CapabilityId,
  SecurityCapabilityTaxonomyV1PrincipalEntry,
  SecurityCapabilityTaxonomyV1PrincipalId,
  SecurityCapabilityTaxonomyV1ProfileEntry,
} from "./capability-taxonomy.v1.ts";
import type {
  SecurityCommandTaxonomyV1CommandEntry,
  SecurityCommandTaxonomyV1CommandId,
} from "./command-taxonomy.v1.ts";
import type { SecurityAuthorizationPolicyV1AuthorizationAllowRow } from "./authorization-policy.v1.ts";
import type { SecurityAuthorizationRequestV1 } from "./authorization-request.v1.ts";
import { validateSecurityAuthorizationRequestV1 } from "../validators.ts";

export const PRINCIPAL_CATALOG_V1: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1PrincipalId,
    SecurityCapabilityTaxonomyV1PrincipalEntry
  >
> = Object.freeze({
  "DESKTOP_APP": Object.freeze({
    id: "DESKTOP_APP",
    description: "The local user-facing desktop client, which may request bounded orchestrator services through typed contracts.",
    non_goals: Object.freeze([
      "Does not read raw database or artifact files.",
      "Does not invoke secret-store, process, registration, or platform operations directly.",
    ] as const),
  }),
  "EXTENSION_CONTENT_SCRIPT": Object.freeze({
    id: "EXTENSION_CONTENT_SCRIPT",
    description: "The least-privileged page-world boundary that inspects and performs reviewed bounded browser operations.",
    non_goals: Object.freeze([
      "Does not request private data, model, artifact, platform, credential, or submission authority.",
      "Does not open native messaging or rewrite its originating identity.",
    ] as const),
  }),
  "EXTENSION_SERVICE_WORKER": Object.freeze({
    id: "EXTENSION_SERVICE_WORKER",
    description: "The extension control boundary that validates content-script messages and owns the extension side of native messaging.",
    non_goals: Object.freeze([
      "Does not convert a content-script origin into a service-worker origin.",
      "Does not gain product authority merely by forwarding.",
    ] as const),
  }),
  "MODEL_RUNTIME": Object.freeze({
    id: "MODEL_RUNTIME",
    description: "A bounded inference target whose outputs remain untrusted data requiring deterministic validation.",
    non_goals: Object.freeze([
      "Does not originate or authorize executable product commands.",
      "Does not receive browser, storage, platform, or submission authority.",
    ] as const),
  }),
  "NATIVE_HOST": Object.freeze({
    id: "NATIVE_HOST",
    description: "The bounded typed proxy between extension native messaging and the authenticated loopback orchestrator.",
    non_goals: Object.freeze([
      "Does not originate privileged product requests.",
      "Does not overwrite the preserved origin or act as a confused deputy.",
    ] as const),
  }),
  "ORCHESTRATOR": Object.freeze({
    id: "ORCHESTRATOR",
    description: "The local service boundary that owns private data access and AI orchestration through reviewed typed services.",
    non_goals: Object.freeze([
      "Does not directly manipulate browser pages.",
      "Does not perform or authorize final submission.",
    ] as const),
  }),
  "PLATFORM_ADAPTER": Object.freeze({
    id: "PLATFORM_ADAPTER",
    description: "A narrow target for reviewed typed operating-system and runtime integration operations.",
    non_goals: Object.freeze([
      "Does not accept arbitrary commands, paths, registry data, executable names, or shell strings.",
      "Does not originate product workflow commands.",
    ] as const),
  }),
  "PUBLIC_JOB_INDEX": Object.freeze({
    id: "PUBLIC_JOB_INDEX",
    description: "The public-data search boundary for permitted public job-index reads.",
    non_goals: Object.freeze([
      "Does not request, receive, infer, or expose private user data.",
      "Does not originate product workflow commands.",
    ] as const),
  }),
  "VERIFICATION_HARNESS": Object.freeze({
    id: "VERIFICATION_HARNESS",
    description: "The synthetic fixture, benchmark, and gate execution boundary.",
    non_goals: Object.freeze([
      "Does not acquire private production-data authority.",
      "Does not acquire final-submission authority.",
    ] as const),
  }),
});

export const AUTHORIZATION_PROFILE_CATALOG_V1: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    SecurityCapabilityTaxonomyV1ProfileEntry
  >
> = Object.freeze({
  "FEASIBILITY": Object.freeze({
    id: "FEASIBILITY",
    description: "Synthetic/local feasibility operations limited to bounded inspection, filling, validation, reconciliation, workflow control, and evidence collection.",
    non_goals: Object.freeze([
      "Does not enable production private-data, model, platform, or final-submission authority.",
      "Does not enable safe-next or safe-back navigation.",
    ] as const),
  }),
  "GUIDED_PRE_SUBMIT": Object.freeze({
    id: "GUIDED_PRE_SUBMIT",
    description: "Reviewed guided operations that may reach a complete final-review state but stop before submission.",
    non_goals: Object.freeze([
      "Does not express passwords, account creation, email verification, MFA, CAPTCHA solving, unexpected legal consent, or unapproved consequential answers.",
      "Does not enable final submission or blind retry after uncertain navigation.",
    ] as const),
  }),
  "PRODUCTION_NO_SUBMIT": Object.freeze({
    id: "PRODUCTION_NO_SUBMIT",
    description: "Reviewed production operations and typed local services with final submission intentionally absent.",
    non_goals: Object.freeze([
      "Does not enable final submission.",
      "Does not turn bounded service authority into raw database, filesystem, registry, process, or shell access.",
    ] as const),
  }),
  "VERIFICATION": Object.freeze({
    id: "VERIFICATION",
    description: "Synthetic fixture, benchmark, and gate operations used to prove contract and policy behavior.",
    non_goals: Object.freeze([
      "Does not access private production data.",
      "Does not enable final submission.",
    ] as const),
  }),
});

export const CAPABILITY_CATALOG_V1: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1CapabilityId,
    SecurityCapabilityTaxonomyV1CapabilityEntry
  >
> = Object.freeze({
  "ARTIFACT_READ": Object.freeze({
    id: "ARTIFACT_READ",
    description: "Read a reviewed artifact through a bounded orchestrator-owned service.",
    non_goals: Object.freeze([
      "Does not grant arbitrary path or raw filesystem access.",
    ] as const),
  }),
  "ARTIFACT_WRITE": Object.freeze({
    id: "ARTIFACT_WRITE",
    description: "Write a reviewed artifact through a bounded orchestrator-owned service.",
    non_goals: Object.freeze([
      "Does not grant arbitrary path, overwrite, delete, or raw filesystem access.",
    ] as const),
  }),
  "MODEL_INFERENCE": Object.freeze({
    id: "MODEL_INFERENCE",
    description: "Request bounded model inference whose result remains untrusted data.",
    non_goals: Object.freeze([
      "Does not grant the model command authority or permit unvalidated output to execute.",
    ] as const),
  }),
  "PAGE_DOCUMENT_UPLOAD": Object.freeze({
    id: "PAGE_DOCUMENT_UPLOAD",
    description: "Attach one previously reviewed document through a bounded page control.",
    non_goals: Object.freeze([
      "Does not browse arbitrary paths or select an unreviewed document.",
    ] as const),
  }),
  "PAGE_INSPECT": Object.freeze({
    id: "PAGE_INSPECT",
    description: "Read bounded page state, descriptors, and visible control metadata.",
    non_goals: Object.freeze([
      "Does not capture raw page HTML, secrets, tokens, or unrestricted DOM data.",
    ] as const),
  }),
  "PAGE_MUTATE_BOUNDED": Object.freeze({
    id: "PAGE_MUTATE_BOUNDED",
    description: "Propose or apply reviewed field operations through bounded control drivers.",
    non_goals: Object.freeze([
      "Does not permit arbitrary selectors, JavaScript, credentials, legal consent, or consequential answers.",
    ] as const),
  }),
  "PAGE_NAVIGATE_BOUNDED": Object.freeze({
    id: "PAGE_NAVIGATE_BOUNDED",
    description: "Navigate only to a reviewed safe next or back step.",
    non_goals: Object.freeze([
      "Does not authorize uncertain navigation, final submission, or blind replay.",
    ] as const),
  }),
  "PAGE_VALIDATE_RECONCILE_REVIEW": Object.freeze({
    id: "PAGE_VALIDATE_RECONCILE_REVIEW",
    description: "Verify field values, reconcile page state, and report reviewed final state.",
    non_goals: Object.freeze([
      "Does not treat model text or untrusted page text as an authorization decision.",
    ] as const),
  }),
  "PLATFORM_BROWSER_RUNTIME_DISCOVERY": Object.freeze({
    id: "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
    description: "Query bounded browser/runtime availability through a reviewed platform adapter operation.",
    non_goals: Object.freeze([
      "Does not launch arbitrary executables or accept arbitrary paths.",
    ] as const),
  }),
  "PLATFORM_NATIVE_MESSAGING_REGISTRATION": Object.freeze({
    id: "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
    description: "Represent reviewed native-messaging registration as a known future bounded platform authority.",
    non_goals: Object.freeze([
      "Does not currently grant a registration operation or accept arbitrary registry data.",
    ] as const),
  }),
  "PLATFORM_PROCESS_SUPERVISION": Object.freeze({
    id: "PLATFORM_PROCESS_SUPERVISION",
    description: "Request one reviewed process-lifecycle operation through the platform adapter.",
    non_goals: Object.freeze([
      "Does not execute arbitrary programs, arguments, shell commands, or scripts.",
    ] as const),
  }),
  "PLATFORM_SECRET_STORE_ACCESS": Object.freeze({
    id: "PLATFORM_SECRET_STORE_ACCESS",
    description: "Request one reviewed secret-store operation through the platform adapter.",
    non_goals: Object.freeze([
      "Does not expose secret values to callers that lack the exact typed operation.",
    ] as const),
  }),
  "PRIVATE_DATA_READ": Object.freeze({
    id: "PRIVATE_DATA_READ",
    description: "Read private application data through a bounded orchestrator service.",
    non_goals: Object.freeze([
      "Does not grant raw database, SQL, file, or secret-store access.",
    ] as const),
  }),
  "PRIVATE_DATA_WRITE": Object.freeze({
    id: "PRIVATE_DATA_WRITE",
    description: "Write private application data through a bounded orchestrator service.",
    non_goals: Object.freeze([
      "Does not grant raw database, SQL, migration, deletion, or filesystem access.",
    ] as const),
  }),
  "PUBLIC_JOB_INDEX_READ": Object.freeze({
    id: "PUBLIC_JOB_INDEX_READ",
    description: "Query the permitted public job index without private-user context.",
    non_goals: Object.freeze([
      "Does not transmit or retrieve private user data.",
    ] as const),
  }),
  "SUBMISSION_FINAL": Object.freeze({
    id: "SUBMISSION_FINAL",
    description: "Represent the known consequential final-submit authority so current policy can prove it has zero grants.",
    non_goals: Object.freeze([
      "Does not grant final submission in any current profile.",
    ] as const),
  }),
  "VERIFICATION_EXECUTION": Object.freeze({
    id: "VERIFICATION_EXECUTION",
    description: "Run bounded synthetic fixtures, benchmarks, and verification gates.",
    non_goals: Object.freeze([
      "Does not run arbitrary code or access private production data.",
    ] as const),
  }),
  "WORKFLOW_CONTROL": Object.freeze({
    id: "WORKFLOW_CONTROL",
    description: "Pause or cancel a bounded workflow safely.",
    non_goals: Object.freeze([
      "Does not continue, submit, or repeat a consequential action.",
    ] as const),
  }),
});

export const COMMAND_CATALOG_V1: Readonly<
  Record<
    SecurityCommandTaxonomyV1CommandId,
    SecurityCommandTaxonomyV1CommandEntry
  >
> = Object.freeze({
  "ARTIFACT_READ_REQUEST": Object.freeze({
    id: "ARTIFACT_READ_REQUEST",
    required_capability: "ARTIFACT_READ",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "PRODUCTION_NO_SUBMIT",
    ] as const),
    max_encoded_payload_size_bytes: 65536,
    consequence_class: "SENSITIVE_SERVICE",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request one reviewed artifact through the orchestrator artifact service.",
    non_goals: Object.freeze([
      "Does not carry or authorize an arbitrary filesystem path.",
      "Does not permit direct desktop or extension filesystem access.",
    ] as const),
  }),
  "ARTIFACT_WRITE_REQUEST": Object.freeze({
    id: "ARTIFACT_WRITE_REQUEST",
    required_capability: "ARTIFACT_WRITE",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "PRODUCTION_NO_SUBMIT",
    ] as const),
    max_encoded_payload_size_bytes: 1048576,
    consequence_class: "SENSITIVE_SERVICE",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request one reviewed artifact write through the orchestrator artifact service.",
    non_goals: Object.freeze([
      "Does not carry or authorize an arbitrary filesystem path.",
      "Does not authorize delete, recursive overwrite, or raw filesystem access.",
    ] as const),
  }),
  "MODEL_INFERENCE_REQUEST": Object.freeze({
    id: "MODEL_INFERENCE_REQUEST",
    required_capability: "MODEL_INFERENCE",
    intended_target: "MODEL_RUNTIME",
    supported_profiles: Object.freeze([
      "PRODUCTION_NO_SUBMIT",
    ] as const),
    max_encoded_payload_size_bytes: 262144,
    consequence_class: "SENSITIVE_SERVICE",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request bounded local model inference from the orchestrator.",
    non_goals: Object.freeze([
      "Does not grant command authority to model output.",
      "Does not permit direct extension, desktop, or native-host model access.",
    ] as const),
  }),
  "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS": Object.freeze({
    id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    required_capability: "PAGE_MUTATE_BOUNDED",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 262144,
    consequence_class: "REVERSIBLE_MUTATION",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Apply a reviewed bounded set of field operations through controlled page drivers.",
    non_goals: Object.freeze([
      "Does not authorize arbitrary selectors, scripts, passwords, legal consent, or final submission.",
      "Does not authorize blind replay after an uncertain result.",
    ] as const),
  }),
  "PAGE_NAVIGATE_BACK": Object.freeze({
    id: "PAGE_NAVIGATE_BACK",
    required_capability: "PAGE_NAVIGATE_BOUNDED",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 32768,
    consequence_class: "CONTROL_FLOW",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Navigate to one reviewed safe previous step.",
    non_goals: Object.freeze([
      "Does not authorize arbitrary URLs, selectors, scripts, or replay after uncertain navigation.",
    ] as const),
  }),
  "PAGE_NAVIGATE_NEXT": Object.freeze({
    id: "PAGE_NAVIGATE_NEXT",
    required_capability: "PAGE_NAVIGATE_BOUNDED",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 32768,
    consequence_class: "CONTROL_FLOW",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Navigate to one reviewed safe next step that is not a final-submit action.",
    non_goals: Object.freeze([
      "Does not authorize final submission, uncertain navigation, arbitrary selectors, or blind replay.",
    ] as const),
  }),
  "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS": Object.freeze({
    id: "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    required_capability: "PAGE_MUTATE_BOUNDED",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 262144,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Ask the orchestrator to propose bounded field operations from already reviewed data and page descriptors.",
    non_goals: Object.freeze([
      "Does not execute a proposal or accept capability claims from model output.",
      "Does not authorize credentials, account creation, MFA, CAPTCHA, legal consent, or consequential answers.",
    ] as const),
  }),
  "PAGE_RECONCILE_STATE": Object.freeze({
    id: "PAGE_RECONCILE_STATE",
    required_capability: "PAGE_VALIDATE_RECONCILE_REVIEW",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 131072,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Re-read bounded page state and reconcile it against the expected reviewed state.",
    non_goals: Object.freeze([
      "Does not silently mutate controls, navigate, or submit.",
    ] as const),
  }),
  "PAGE_REPORT_FINAL_REVIEW": Object.freeze({
    id: "PAGE_REPORT_FINAL_REVIEW",
    required_capability: "PAGE_VALIDATE_RECONCILE_REVIEW",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 262144,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Report bounded final-review descriptors to the orchestrator while stopping before submission.",
    non_goals: Object.freeze([
      "Does not authorize or imply final submission.",
      "Does not include raw page HTML, secrets, tokens, or caller-supplied decisions.",
    ] as const),
  }),
  "PAGE_REPORT_STATE": Object.freeze({
    id: "PAGE_REPORT_STATE",
    required_capability: "PAGE_INSPECT",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 262144,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Report bounded page state and descriptors through the service-worker and native-host route to the orchestrator.",
    non_goals: Object.freeze([
      "Does not include raw page HTML, secrets, tokens, or executable content.",
      "Does not change the preserved content-script origin while forwarding.",
    ] as const),
  }),
  "PAGE_SCAN_VISIBLE_CONTROLS": Object.freeze({
    id: "PAGE_SCAN_VISIBLE_CONTROLS",
    required_capability: "PAGE_INSPECT",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 32768,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Scan visible controls and bounded descriptors without mutation.",
    non_goals: Object.freeze([
      "Does not collect raw page HTML, secrets, hidden credentials, or arbitrary DOM data.",
    ] as const),
  }),
  "PAGE_UPLOAD_REVIEWED_DOCUMENT": Object.freeze({
    id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    required_capability: "PAGE_DOCUMENT_UPLOAD",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 65536,
    consequence_class: "REVERSIBLE_MUTATION",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Attach one previously reviewed document through a bounded file control.",
    non_goals: Object.freeze([
      "Does not carry an arbitrary path or permit browsing the filesystem.",
      "Does not upload an unreviewed document or submit the application.",
    ] as const),
  }),
  "PAGE_VERIFY_FIELD_VALUES": Object.freeze({
    id: "PAGE_VERIFY_FIELD_VALUES",
    required_capability: "PAGE_VALIDATE_RECONCILE_REVIEW",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 131072,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Verify bounded field values against the reviewed expected state.",
    non_goals: Object.freeze([
      "Does not repair mismatches silently, navigate, or submit.",
    ] as const),
  }),
  "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST": Object.freeze({
    id: "PLATFORM_BROWSER_RUNTIME_DISCOVERY_REQUEST",
    required_capability: "PLATFORM_BROWSER_RUNTIME_DISCOVERY",
    intended_target: "PLATFORM_ADAPTER",
    supported_profiles: Object.freeze([] as const),
    max_encoded_payload_size_bytes: 16384,
    consequence_class: "PLATFORM_SERVICE",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request bounded browser/runtime discovery from the platform adapter.",
    non_goals: Object.freeze([
      "Does not carry arbitrary paths, executable names, arguments, registry data, or shell text.",
    ] as const),
  }),
  "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST": Object.freeze({
    id: "PLATFORM_NATIVE_MESSAGING_REGISTRATION_REQUEST",
    required_capability: "PLATFORM_NATIVE_MESSAGING_REGISTRATION",
    intended_target: "PLATFORM_ADAPTER",
    supported_profiles: Object.freeze([] as const),
    max_encoded_payload_size_bytes: 16384,
    consequence_class: "PLATFORM_SERVICE",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Represent native-messaging registration as a known bounded future platform command with no current grant.",
    non_goals: Object.freeze([
      "Does not currently authorize registration.",
      "Does not carry arbitrary registry keys, manifest paths, executable paths, or shell commands.",
    ] as const),
  }),
  "PLATFORM_PROCESS_SUPERVISION_REQUEST": Object.freeze({
    id: "PLATFORM_PROCESS_SUPERVISION_REQUEST",
    required_capability: "PLATFORM_PROCESS_SUPERVISION",
    intended_target: "PLATFORM_ADAPTER",
    supported_profiles: Object.freeze([] as const),
    max_encoded_payload_size_bytes: 16384,
    consequence_class: "PLATFORM_SERVICE",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request one reviewed bounded lifecycle operation for a known application-owned process.",
    non_goals: Object.freeze([
      "Does not carry arbitrary executable names, paths, arguments, scripts, or shell commands.",
    ] as const),
  }),
  "PLATFORM_SECRET_STORE_REQUEST": Object.freeze({
    id: "PLATFORM_SECRET_STORE_REQUEST",
    required_capability: "PLATFORM_SECRET_STORE_ACCESS",
    intended_target: "PLATFORM_ADAPTER",
    supported_profiles: Object.freeze([] as const),
    max_encoded_payload_size_bytes: 16384,
    consequence_class: "PLATFORM_SERVICE",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request one reviewed typed secret-store operation from the platform adapter.",
    non_goals: Object.freeze([
      "Does not carry a caller-defined backend, command, path, registry key, or arbitrary secret identifier.",
    ] as const),
  }),
  "PRIVATE_DATA_READ_REQUEST": Object.freeze({
    id: "PRIVATE_DATA_READ_REQUEST",
    required_capability: "PRIVATE_DATA_READ",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "PRODUCTION_NO_SUBMIT",
    ] as const),
    max_encoded_payload_size_bytes: 65536,
    consequence_class: "SENSITIVE_SERVICE",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request bounded private application data through the orchestrator service.",
    non_goals: Object.freeze([
      "Does not carry SQL, a database path, a filesystem path, or a secret-store operation.",
      "Does not permit extension or native-host origin.",
    ] as const),
  }),
  "PRIVATE_DATA_WRITE_REQUEST": Object.freeze({
    id: "PRIVATE_DATA_WRITE_REQUEST",
    required_capability: "PRIVATE_DATA_WRITE",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "PRODUCTION_NO_SUBMIT",
    ] as const),
    max_encoded_payload_size_bytes: 262144,
    consequence_class: "SENSITIVE_SERVICE",
    idempotency_expectation: "IDEMPOTENCY_KEY_REQUIRED",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Request one bounded private-data write through the orchestrator service.",
    non_goals: Object.freeze([
      "Does not carry SQL, migration commands, raw database records, paths, or delete-all authority.",
      "Does not permit extension or native-host origin.",
    ] as const),
  }),
  "PUBLIC_JOB_INDEX_QUERY": Object.freeze({
    id: "PUBLIC_JOB_INDEX_QUERY",
    required_capability: "PUBLIC_JOB_INDEX_READ",
    intended_target: "PUBLIC_JOB_INDEX",
    supported_profiles: Object.freeze([
      "PRODUCTION_NO_SUBMIT",
    ] as const),
    max_encoded_payload_size_bytes: 65536,
    consequence_class: "READ_ONLY",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Query permitted public job-index data without private-user context.",
    non_goals: Object.freeze([
      "Does not transmit private user data or grant the public index product authority.",
    ] as const),
  }),
  "SUBMISSION_FINAL_SUBMIT": Object.freeze({
    id: "SUBMISSION_FINAL_SUBMIT",
    required_capability: "SUBMISSION_FINAL",
    intended_target: "EXTENSION_CONTENT_SCRIPT",
    supported_profiles: Object.freeze([] as const),
    max_encoded_payload_size_bytes: 4096,
    consequence_class: "CONSEQUENTIAL_FINAL_ACTION",
    idempotency_expectation: "NOT_REPEATABLE",
    denial_error_code: "SUBMISSION_PROHIBITED_FINAL_ACTION",
    description: "Name the consequential final-submit action so every current profile can prove it has zero authority.",
    non_goals: Object.freeze([
      "Does not authorize final submission in any current profile.",
      "Does not imply a future auto-submit profile or bypass later prerequisites.",
    ] as const),
  }),
  "VERIFICATION_RUN_SYNTHETIC_SUITE": Object.freeze({
    id: "VERIFICATION_RUN_SYNTHETIC_SUITE",
    required_capability: "VERIFICATION_EXECUTION",
    intended_target: "VERIFICATION_HARNESS",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 65536,
    consequence_class: "SYNTHETIC_VERIFICATION",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Run one declared synthetic fixture, benchmark, or verification-gate operation.",
    non_goals: Object.freeze([
      "Does not run arbitrary code, production data, OS commands, or final submission.",
    ] as const),
  }),
  "WORKFLOW_CANCEL": Object.freeze({
    id: "WORKFLOW_CANCEL",
    required_capability: "WORKFLOW_CONTROL",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 8192,
    consequence_class: "CONTROL_FLOW",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Cancel a bounded workflow and prevent further dispatch.",
    non_goals: Object.freeze([
      "Does not delete accepted results or trigger compensating product actions automatically.",
    ] as const),
  }),
  "WORKFLOW_PAUSE": Object.freeze({
    id: "WORKFLOW_PAUSE",
    required_capability: "WORKFLOW_CONTROL",
    intended_target: "ORCHESTRATOR",
    supported_profiles: Object.freeze([
      "FEASIBILITY",
      "GUIDED_PRE_SUBMIT",
      "PRODUCTION_NO_SUBMIT",
      "VERIFICATION",
    ] as const),
    max_encoded_payload_size_bytes: 8192,
    consequence_class: "CONTROL_FLOW",
    idempotency_expectation: "IDEMPOTENT",
    denial_error_code: "TRANSPORT_FORBIDDEN",
    description: "Pause a bounded workflow before another operation is dispatched.",
    non_goals: Object.freeze([
      "Does not resume, retry, navigate, or submit automatically.",
    ] as const),
  }),
});

export const AUTHORIZATION_POLICY_V1:
  readonly SecurityAuthorizationPolicyV1AuthorizationAllowRow[] =
    Object.freeze([
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "VERIFICATION_RUN_SYNTHETIC_SUITE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "VERIFICATION_HARNESS",
    target_principal: "VERIFICATION_HARNESS",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "WORKFLOW_CANCEL",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "FEASIBILITY",
    command_id: "WORKFLOW_PAUSE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "WORKFLOW_CANCEL",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "GUIDED_PRE_SUBMIT",
    command_id: "WORKFLOW_PAUSE",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "ARTIFACT_READ_REQUEST",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "ARTIFACT_WRITE_REQUEST",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "MODEL_INFERENCE_REQUEST",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "MODEL_RUNTIME",
    target_principal: "MODEL_RUNTIME",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PRIVATE_DATA_READ_REQUEST",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PRIVATE_DATA_WRITE_REQUEST",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "PUBLIC_JOB_INDEX_QUERY",
    originating_principal: "ORCHESTRATOR",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "PUBLIC_JOB_INDEX",
    target_principal: "PUBLIC_JOB_INDEX",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "WORKFLOW_CANCEL",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "PRODUCTION_NO_SUBMIT",
    command_id: "WORKFLOW_PAUSE",
    originating_principal: "DESKTOP_APP",
    immediate_sender: "DESKTOP_APP",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_BACK",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_NAVIGATE_NEXT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_RECONCILE_STATE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_REPORT_FINAL_REVIEW",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_CONTENT_SCRIPT",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "NATIVE_HOST",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_REPORT_STATE",
    originating_principal: "EXTENSION_CONTENT_SCRIPT",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_SCAN_VISIBLE_CONTROLS",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_UPLOAD_REVIEWED_DOCUMENT",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "EXTENSION_SERVICE_WORKER",
    receiving_principal: "EXTENSION_CONTENT_SCRIPT",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "NATIVE_HOST",
    receiving_principal: "EXTENSION_SERVICE_WORKER",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "ORCHESTRATOR",
    receiving_principal: "NATIVE_HOST",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "PAGE_VERIFY_FIELD_VALUES",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "EXTENSION_CONTENT_SCRIPT",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "VERIFICATION_RUN_SYNTHETIC_SUITE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "VERIFICATION_HARNESS",
    target_principal: "VERIFICATION_HARNESS",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "WORKFLOW_CANCEL",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
  Object.freeze({
    authorization_profile: "VERIFICATION",
    command_id: "WORKFLOW_PAUSE",
    originating_principal: "VERIFICATION_HARNESS",
    immediate_sender: "VERIFICATION_HARNESS",
    receiving_principal: "ORCHESTRATOR",
    target_principal: "ORCHESTRATOR",
  }),
    ]);

export const PRINCIPAL_IDS_V1:
  readonly SecurityCapabilityTaxonomyV1PrincipalId[] = Object.freeze([
  "DESKTOP_APP",
  "EXTENSION_CONTENT_SCRIPT",
  "EXTENSION_SERVICE_WORKER",
  "MODEL_RUNTIME",
  "NATIVE_HOST",
  "ORCHESTRATOR",
  "PLATFORM_ADAPTER",
  "PUBLIC_JOB_INDEX",
  "VERIFICATION_HARNESS",
]);

export const AUTHORIZATION_PROFILES_V1:
  readonly SecurityCapabilityTaxonomyV1AuthorizationProfileId[] =
    Object.freeze([
  "FEASIBILITY",
  "GUIDED_PRE_SUBMIT",
  "PRODUCTION_NO_SUBMIT",
  "VERIFICATION",
    ]);

export const CAPABILITY_IDS_V1:
  readonly SecurityCapabilityTaxonomyV1CapabilityId[] = Object.freeze([
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
]);

export const COMMAND_IDS_V1:
  readonly SecurityCommandTaxonomyV1CommandId[] = Object.freeze([
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
]);

export function isPrincipalIdV1(
  value: unknown,
): value is SecurityCapabilityTaxonomyV1PrincipalId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PRINCIPAL_CATALOG_V1, value)
  );
}

export function isAuthorizationProfileIdV1(
  value: unknown,
): value is SecurityCapabilityTaxonomyV1AuthorizationProfileId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(AUTHORIZATION_PROFILE_CATALOG_V1, value)
  );
}

export function isCapabilityIdV1(
  value: unknown,
): value is SecurityCapabilityTaxonomyV1CapabilityId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CAPABILITY_CATALOG_V1, value)
  );
}

export function isCommandIdV1(
  value: unknown,
): value is SecurityCommandTaxonomyV1CommandId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(COMMAND_CATALOG_V1, value)
  );
}

export function requireCapabilityEntryV1(
  value: unknown,
): SecurityCapabilityTaxonomyV1CapabilityEntry {
  if (!isCapabilityIdV1(value)) {
    throw new Error(
      "unknown capability id: not a member of the v1 capability catalog",
    );
  }
  return CAPABILITY_CATALOG_V1[value];
}

export function requireCommandEntryV1(
  value: unknown,
): SecurityCommandTaxonomyV1CommandEntry {
  if (!isCommandIdV1(value)) {
    throw new Error(
      "unknown command id: not a member of the v1 command catalog",
    );
  }
  return COMMAND_CATALOG_V1[value];
}

function policyKey(
  profile: SecurityCapabilityTaxonomyV1AuthorizationProfileId,
  command: SecurityCommandTaxonomyV1CommandId,
  origin: SecurityCapabilityTaxonomyV1PrincipalId,
  sender: SecurityCapabilityTaxonomyV1PrincipalId,
  receiver: SecurityCapabilityTaxonomyV1PrincipalId,
  target: SecurityCapabilityTaxonomyV1PrincipalId,
): string {
  return JSON.stringify([profile, command, origin, sender, receiver, target]);
}

const POLICY_KEYS = new Set(
  AUTHORIZATION_POLICY_V1.map((row) =>
    policyKey(
      row.authorization_profile,
      row.command_id,
      row.originating_principal,
      row.immediate_sender,
      row.receiving_principal,
      row.target_principal,
    ),
  ),
);

export function allowedCommandsForV1(
  profile: unknown,
  origin: unknown,
  sender: unknown,
  receiver: unknown,
  target: unknown,
): readonly SecurityCommandTaxonomyV1CommandId[] {
  if (
    !isAuthorizationProfileIdV1(profile) ||
    !isPrincipalIdV1(origin) ||
    !isPrincipalIdV1(sender) ||
    !isPrincipalIdV1(receiver) ||
    !isPrincipalIdV1(target)
  ) {
    return Object.freeze([]);
  }
  return Object.freeze(
    COMMAND_IDS_V1.filter((command) =>
      POLICY_KEYS.has(
        policyKey(profile, command, origin, sender, receiver, target),
      ),
    ),
  );
}

export interface AuthorizationRuntimeContextV1 {
  readonly receiving_principal: SecurityCapabilityTaxonomyV1PrincipalId;
  readonly authenticated_sender_principal:
    SecurityCapabilityTaxonomyV1PrincipalId;
  readonly authenticated_originating_principal:
    SecurityCapabilityTaxonomyV1PrincipalId;
  readonly active_profile:
    SecurityCapabilityTaxonomyV1AuthorizationProfileId;
  readonly observed_payload_size_bytes: number;
}

export interface AuthorizationAllowedV1 {
  readonly authorized: true;
  readonly command_id: SecurityCommandTaxonomyV1CommandId;
  readonly required_capability: SecurityCapabilityTaxonomyV1CapabilityId;
}

export interface AuthorizationDeniedV1 {
  readonly authorized: false;
  readonly error_code: ErrorTaxonomyV1ErrorCode;
}

export type AuthorizationOutcomeV1 =
  | AuthorizationAllowedV1
  | AuthorizationDeniedV1;

function snapshotPlainDataRecordV1(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") {
        return null;
      }
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isRuntimeContextV1(
  value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, unknown>> &
  AuthorizationRuntimeContextV1 {
  const keys = Object.keys(value).sort();
  return (
    JSON.stringify(keys) ===
      JSON.stringify([
        "active_profile",
        "authenticated_originating_principal",
        "authenticated_sender_principal",
        "observed_payload_size_bytes",
        "receiving_principal",
      ]) &&
    isPrincipalIdV1(value.receiving_principal) &&
    isPrincipalIdV1(value.authenticated_sender_principal) &&
    isPrincipalIdV1(value.authenticated_originating_principal) &&
    isAuthorizationProfileIdV1(value.active_profile) &&
    typeof value.observed_payload_size_bytes === "number" &&
    Number.isSafeInteger(value.observed_payload_size_bytes) &&
    value.observed_payload_size_bytes >= 0
  );
}

const CONTENT_ORIGIN_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>(["PAGE_REPORT_FINAL_REVIEW", "PAGE_REPORT_STATE"]);

const DESKTOP_ORIGIN_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>([
  "ARTIFACT_READ_REQUEST",
  "ARTIFACT_WRITE_REQUEST",
  "PAGE_PROPOSE_BOUNDED_FIELD_OPERATIONS",
  "PRIVATE_DATA_READ_REQUEST",
  "PRIVATE_DATA_WRITE_REQUEST",
  "WORKFLOW_CANCEL",
  "WORKFLOW_PAUSE",
]);

const ORCHESTRATOR_ORIGIN_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>([
  "MODEL_INFERENCE_REQUEST",
  "PAGE_APPLY_BOUNDED_FIELD_OPERATIONS",
  "PAGE_NAVIGATE_BACK",
  "PAGE_NAVIGATE_NEXT",
  "PAGE_RECONCILE_STATE",
  "PAGE_SCAN_VISIBLE_CONTROLS",
  "PAGE_UPLOAD_REVIEWED_DOCUMENT",
  "PAGE_VERIFY_FIELD_VALUES",
  "PUBLIC_JOB_INDEX_QUERY",
]);

const IDEMPOTENCY_KEY_REQUIRED_COMMANDS = new Set<
  SecurityCommandTaxonomyV1CommandId
>([
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
]);

const VERIFICATION_CAPABILITIES = new Set<
  SecurityCapabilityTaxonomyV1CapabilityId
>([
  "PAGE_DOCUMENT_UPLOAD",
  "PAGE_INSPECT",
  "PAGE_MUTATE_BOUNDED",
  "PAGE_NAVIGATE_BOUNDED",
  "PAGE_VALIDATE_RECONCILE_REVIEW",
  "VERIFICATION_EXECUTION",
  "WORKFLOW_CONTROL",
]);

const PROFILE_CAPABILITY_CEILINGS: Readonly<
  Record<
    SecurityCapabilityTaxonomyV1AuthorizationProfileId,
    readonly SecurityCapabilityTaxonomyV1CapabilityId[]
  >
> = Object.freeze({
  "FEASIBILITY": Object.freeze([
    "PAGE_INSPECT",
    "PAGE_MUTATE_BOUNDED",
    "PAGE_VALIDATE_RECONCILE_REVIEW",
    "VERIFICATION_EXECUTION",
    "WORKFLOW_CONTROL",
  ] as const),
  "GUIDED_PRE_SUBMIT": Object.freeze([
    "PAGE_DOCUMENT_UPLOAD",
    "PAGE_INSPECT",
    "PAGE_MUTATE_BOUNDED",
    "PAGE_NAVIGATE_BOUNDED",
    "PAGE_VALIDATE_RECONCILE_REVIEW",
    "WORKFLOW_CONTROL",
  ] as const),
  "PRODUCTION_NO_SUBMIT": Object.freeze([
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
  ] as const),
  "VERIFICATION": Object.freeze([
    "PAGE_DOCUMENT_UPLOAD",
    "PAGE_INSPECT",
    "PAGE_MUTATE_BOUNDED",
    "PAGE_NAVIGATE_BOUNDED",
    "PAGE_VALIDATE_RECONCILE_REVIEW",
    "VERIFICATION_EXECUTION",
    "WORKFLOW_CONTROL",
  ] as const),
});

const PRIVILEGED_CONTENT_CAPABILITIES = new Set<
  SecurityCapabilityTaxonomyV1CapabilityId
>([
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
]);

function isArchitecturallyForbidden(
  request: SecurityAuthorizationRequestV1,
  command: SecurityCommandTaxonomyV1CommandEntry,
): boolean {
  const origin = request.originating_principal;
  if (command.id === "SUBMISSION_FINAL_SUBMIT") {
    return true;
  }
  if (command.required_capability === "SUBMISSION_FINAL") {
    return true;
  }
  if (command.required_capability.startsWith("PLATFORM_")) {
    return true;
  }
  if (
    !PROFILE_CAPABILITY_CEILINGS[
      request.authorization_profile
    ].includes(command.required_capability)
  ) {
    return true;
  }
  if (
    origin === "EXTENSION_CONTENT_SCRIPT" &&
    (PRIVILEGED_CONTENT_CAPABILITIES.has(command.required_capability) ||
      !CONTENT_ORIGIN_COMMANDS.has(command.id))
  ) {
    return true;
  }
  if (
    origin === "EXTENSION_SERVICE_WORKER" ||
    origin === "NATIVE_HOST" ||
    origin === "MODEL_RUNTIME" ||
    origin === "PLATFORM_ADAPTER" ||
    origin === "PUBLIC_JOB_INDEX"
  ) {
    return true;
  }
  if (
    origin === "DESKTOP_APP" &&
    (!DESKTOP_ORIGIN_COMMANDS.has(command.id) ||
      request.target_principal === "PLATFORM_ADAPTER")
  ) {
    return true;
  }
  if (
    origin === "ORCHESTRATOR" &&
    !ORCHESTRATOR_ORIGIN_COMMANDS.has(command.id)
  ) {
    return true;
  }
  if (
    origin === "VERIFICATION_HARNESS" &&
    ((request.authorization_profile !== "FEASIBILITY" &&
      request.authorization_profile !== "VERIFICATION") ||
      !VERIFICATION_CAPABILITIES.has(command.required_capability))
  ) {
    return true;
  }
  return false;
}

function deny(error_code: ErrorTaxonomyV1ErrorCode): AuthorizationDeniedV1 {
  return Object.freeze({ authorized: false, error_code });
}

export function authorizeCommandRequestV1(
  value: unknown,
  contextValue: unknown,
): AuthorizationOutcomeV1 {
  const context = snapshotPlainDataRecordV1(contextValue);
  if (context === null || !isRuntimeContextV1(context)) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const requestSnapshot = snapshotPlainDataRecordV1(value);
  if (requestSnapshot === null) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const validation = validateSecurityAuthorizationRequestV1(requestSnapshot);
  if (!validation.valid) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const request = validation.value;
  if (
    request.immediate_sender !==
      context.authenticated_sender_principal ||
    request.originating_principal !==
      context.authenticated_originating_principal ||
    request.authorization_profile !== context.active_profile
  ) {
    return deny("TRANSPORT_FORBIDDEN");
  }
  if (request.payload_size_bytes !== context.observed_payload_size_bytes) {
    return deny("TRANSPORT_MALFORMED_MESSAGE");
  }
  const command = COMMAND_CATALOG_V1[request.command_id];
  if (command.id === "SUBMISSION_FINAL_SUBMIT") {
    return deny("SUBMISSION_PROHIBITED_FINAL_ACTION");
  }
  if (
    request.target_principal !== command.intended_target ||
    isArchitecturallyForbidden(request, command)
  ) {
    return deny("TRANSPORT_FORBIDDEN");
  }
  if (!command.supported_profiles.includes(request.authorization_profile)) {
    return deny(command.denial_error_code);
  }
  if (
    context.observed_payload_size_bytes > command.max_encoded_payload_size_bytes
  ) {
    return deny("TRANSPORT_PAYLOAD_TOO_LARGE");
  }
  if (
    IDEMPOTENCY_KEY_REQUIRED_COMMANDS.has(command.id) &&
    request.idempotency_key === undefined
  ) {
    return deny("VALIDATION_MISSING_REQUIRED_DATA");
  }
  const key = policyKey(
    request.authorization_profile,
    request.command_id,
    request.originating_principal,
    request.immediate_sender,
    context.receiving_principal,
    request.target_principal,
  );
  if (!POLICY_KEYS.has(key)) {
    return deny(command.denial_error_code);
  }
  return Object.freeze({
    authorized: true,
    command_id: command.id,
    required_capability: command.required_capability,
  });
}
