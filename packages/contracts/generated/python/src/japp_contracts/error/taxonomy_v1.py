"""GENERATED FILE - DO NOT EDIT BY HAND.

Source of truth: packages/contracts/schemas/error/taxonomy.v1.schema.json
Schema id: urn:japp:schema:error:taxonomy:v1

Regenerate: pnpm generate:contracts
Verify:     pnpm generate:contracts --check
Manual edits are prohibited and fail the contract-gen drift suite.
"""

from typing import Annotated, Literal

from pydantic import StringConstraints

ErrorTaxonomyV1ErrorCode = Literal["VALIDATION_MALFORMED_STRUCTURE", "VALIDATION_MISSING_REQUIRED_DATA", "VALIDATION_TYPE_MISMATCH", "VALIDATION_CONSTRAINT_VIOLATION", "VALIDATION_UNSUPPORTED_SCHEMA_VERSION", "VALIDATION_CATALOG_REFERENCE_FAILURE", "CONFLICT_STALE_VERSION", "CONFLICT_CONCURRENT_MODIFICATION", "CONFLICT_DUPLICATE_IDENTITY", "CONFLICT_INCOMPATIBLE_STATE", "CONFLICT_SUPERSEDED_RECORD", "UNSUPPORTED_PLATFORM", "UNSUPPORTED_CAPABILITY", "UNSUPPORTED_SCHEMA_CONSTRUCT", "UNSUPPORTED_SITE_PATTERN", "UNSUPPORTED_RUNTIME_PROFILE", "UNSUPPORTED_VERSION", "SENSITIVE_CONFIRMATION_REQUIRED", "SENSITIVE_CONFIRMATION_EXPIRED", "SENSITIVE_INFERENCE_PROHIBITED", "SENSITIVE_AUTHENTICATION_BOUNDARY", "SENSITIVE_LEGAL_CONSENT_BOUNDARY", "SENSITIVE_AUTOMATION_PROHIBITED", "MODEL_RUNTIME_UNAVAILABLE", "MODEL_TIMEOUT", "MODEL_MALFORMED_OUTPUT", "MODEL_VALIDATION_FAILED", "MODEL_PROFILE_INCOMPATIBLE", "MODEL_RESOURCE_EXHAUSTED", "STORAGE_UNAVAILABLE", "STORAGE_INTEGRITY_FAILURE", "STORAGE_MIGRATION_REQUIRED", "STORAGE_IO_FAILURE", "STORAGE_BACKUP_RESTORE_FAILURE", "STORAGE_SECURE_STORE_UNAVAILABLE", "TRANSPORT_UNAUTHENTICATED", "TRANSPORT_FORBIDDEN", "TRANSPORT_PROTOCOL_MISMATCH", "TRANSPORT_MALFORMED_MESSAGE", "TRANSPORT_PAYLOAD_TOO_LARGE", "TRANSPORT_TIMEOUT", "TRANSPORT_DISCONNECTED", "TRANSPORT_SERVICE_UNAVAILABLE", "RENDERING_RENDERER_UNAVAILABLE", "RENDERING_FAILURE", "RENDERING_CONTENT_CLIPPED", "RENDERING_EXTRACTION_ORDER_MISMATCH", "RENDERING_FONT_MISSING", "RENDERING_UNSUPPORTED_CONSTRUCT", "SITE_UNSUPPORTED_STRUCTURE", "SITE_STRUCTURE_CHANGED", "SITE_AMBIGUOUS_CONTROL", "SITE_VALIDATION_REJECTED", "SITE_STALE_PAGE_GENERATION", "SITE_SESSION_BOUNDARY", "SITE_CAPTCHA_BOUNDARY", "SITE_FINAL_REVIEW_BOUNDARY", "SITE_UNCERTAIN_TRANSITION", "BENCHMARK_INVALID_CORPUS", "BENCHMARK_HASH_MISMATCH", "BENCHMARK_INCOMPLETE_RUN", "BENCHMARK_INVALID_HOLDOUT_STATE", "BENCHMARK_THRESHOLD_FAILED", "BENCHMARK_ENVIRONMENT_MISMATCH", "BENCHMARK_INVALID_COMPARISON_EVIDENCE", "GATE_EVIDENCE_MISSING", "GATE_INVALID_CORPUS_OR_HOLDOUT", "GATE_INDEPENDENT_REVIEW_REQUIRED", "GATE_OWNER_DECISION_REQUIRED", "GATE_ENVIRONMENT_BLOCKED", "GATE_THRESHOLD_FAILED", "GATE_REDESIGN_REQUIRED", "SUBMISSION_NOT_APPROVED", "SUBMISSION_DUPLICATE", "SUBMISSION_PLAN_EXPIRED", "SUBMISSION_PROHIBITED_FINAL_ACTION", "SUBMISSION_OUTCOME_UNCERTAIN", "SUBMISSION_RECEIPT_MISSING", "SUBMISSION_REJECTED", "SUBMISSION_FAILED"]
"Closed set of stable UPPER_SNAKE_CASE error codes, visibly namespaced by family prefix. The canonical catalog instance defines exactly one metadata entry per code; the generator fails closed if this enum and the catalog ever disagree. Adding a code is a MINOR change; removal, renaming, or semantic reassignment is a MAJOR change."

ErrorTaxonomyV1ErrorFamily = Literal["VALIDATION", "CONFLICT", "UNSUPPORTED", "SENSITIVE", "MODEL", "STORAGE", "TRANSPORT", "RENDERING", "SITE", "BENCHMARK", "GATE", "SUBMISSION"]
"The twelve required error families. Every error code belongs to exactly one family and is prefixed by it."

ErrorTaxonomyV1ErrorOrigin = Literal["DESKTOP_APP", "EXTENSION_CONTENT_SCRIPT", "EXTENSION_SERVICE_WORKER", "NATIVE_HOST", "ORCHESTRATOR", "MODEL_RUNTIME", "PLATFORM_ADAPTER", "PUBLIC_JOB_INDEX", "VERIFICATION_HARNESS"]
"Reporting component or trust boundary (spec §5.4/§5.5): the desktop app, extension content script, extension service worker, native messaging host, local orchestrator, model runtime, platform adapter, public job-index service, or the verification harness that executes benchmark and gate runs."

ErrorTaxonomyV1ErrorSeverity = Literal["WARNING", "ERROR", "CRITICAL"]
"Impact class of the condition. WARNING: degraded but safely continuing. ERROR: the operation failed or must pause. CRITICAL: integrity, safety, or governance is at risk and the workflow must stop."

ErrorTaxonomyV1MessageKey = Annotated[str, StringConstraints(pattern="^error\\.[a-z]+\\.[a-z0-9]+(?:_[a-z0-9]+)*$", max_length=96)]
"Deterministic key derived from the error code: the literal prefix error., the lowercase family, a dot, and the lowercase family-stripped code remainder (underscores preserved). Example: VALIDATION_TYPE_MISMATCH has key error.validation.type_mismatch. Keys are stable for the lifetime of their code."

ErrorTaxonomyV1RetryDisposition = Literal["SAFE_RETRY", "RETRY_AFTER_REMEDIATION", "PAUSE_FOR_USER", "NO_RETRY_PROHIBITED", "NO_RETRY_TERMINAL"]
"Safe recovery classification. SAFE_RETRY: transient; the same operation may be retried without user involvement. RETRY_AFTER_REMEDIATION: retry only after the named condition is fixed. PAUSE_FOR_USER: automation must pause and hand control to the user; no automatic retry. NO_RETRY_PROHIBITED: the action is prohibited and must never be retried by automation. NO_RETRY_TERMINAL: this attempt or decision is final; recovery requires a new, separately reviewed action."

ErrorTaxonomyV1UserSafeMessage = Annotated[str, StringConstraints(pattern="^[A-Za-z0-9][A-Za-z0-9 ,;:.'()/-]*$", min_length=1, max_length=200)]
"Bounded, plain, non-interpolated English text safe to show a user: no placeholder syntax, no HTML, no URLs, no filesystem paths, no stack traces, no secrets, and no raw untrusted content. The generator additionally lints every catalog message against these rules and fails closed on violations; this schema enforces bounds and the character shape."
