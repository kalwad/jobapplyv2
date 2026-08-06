// Test-side expected-result catalog for the mock ATS lab (M02-W03).
//
// The app-side catalog (apps/mock-ats-lab/site/src/catalog/cases.ts)
// carries case identity only; the deterministic EXPECTED state
// transitions per case live here, on the test side, so no expected truth
// is served to the browser. catalog.spec.ts asserts 1:1 coverage between
// the two, and the behavior specs exercise every listed transition.
export const EXPECTED_TRANSITIONS_VERSION = "1.0.0";

/** Case ID → ordered deterministic expected state transitions. */
export const EXPECTED_TRANSITIONS: Readonly<Record<string, readonly string[]>> =
  {
    "MAL-CBX-001": [
      "CLOSED → FILTERED_OPEN (typing filters options)",
      "FILTERED_OPEN → COMMITTED (keyboard or click selection)",
      "FILTERED_OPEN → EMPTY_STATE (no match message, no options)",
      "UNCOMMITTED → REQUIRED_ERROR (check without selection)",
    ],
    "MAL-CBX-002": [
      "IDLE → ACTIVE_OPTION (arrow-key navigation)",
      "ACTIVE_OPTION → SELECTED (Enter/Space or click commits aria-selected)",
    ],
    "MAL-DTP-001": [
      "RAW_PARTS → NORMALIZED (single digits gain leading zeros on blur)",
      "NORMALIZED → COMMITTED_ISO (valid calendar day commits YYYY-MM-DD)",
      "RAW_PARTS → INVALID_DATE (impossible calendar day rejected)",
    ],
    "MAL-DTP-002": [
      "RAW_NUMBER → NORMALIZED (separators stripped on blur)",
      "NORMALIZED → COMMITTED_E164 (exact national length commits +CC…)",
      "RAW_NUMBER → INVALID_PHONE_LENGTH (wrong length rejected)",
    ],
    "MAL-DYN-001": [
      "ABSENT → REFERRAL_FIELD_INSERTED (checkbox inserts required field)",
      "REFERRAL_FIELD_INSERTED → REFERRAL_FIELD_REMOVED (uncheck removes it)",
      "REGION_OPTIONAL → REGION_NOW_REQUIRED (country drives required state)",
    ],
    "MAL-DYN-002": [
      "IDLE → ADDITIONAL_QUESTIONS_LOADING (load action)",
      "ADDITIONAL_QUESTIONS_LOADING → ADDITIONAL_QUESTIONS_LOADED (fixed 400 ms delay)",
    ],
    "MAL-DYN-003": [
      "GENERATION_1 → NODE_REPLACED_GENERATION_2 (new node, value not carried)",
      "STABLE_CONTROL_UNCHANGED (same node identity and value throughout)",
    ],
    "MAL-FLW-001": [
      "STEP_1 → STEP_2 → STEP_3 (valid Next transitions)",
      "STEP_N → STEP_N-1 (Back preserves edits)",
      "FIELDS_PERSISTED (values survive page navigation)",
    ],
    "MAL-FLW-002": [
      "STEP_1 → NAVIGATION_BLOCKED_BY_VALIDATION (empty required fields)",
      "ERRORS_VISIBLE → STEP_2 (corrected fields unblock Next)",
    ],
    "MAL-FLW-003": [
      "STEP_3_VALID → PAUSED_FOR_CAPTCHA (progression blocked with reason)",
      "PAUSED_FOR_CAPTCHA → REVIEW (test-only manual resolution action)",
    ],
    "MAL-FLW-004": [
      "REVIEW_RENDERS_ALL_PERSISTED_ANSWERS (read-only confirmation)",
    ],
    "MAL-FLW-005": [
      "REVIEW → PROCESSING_LOCAL_SUBMISSION (mock submit)",
      "PROCESSING_LOCAL_SUBMISSION → RCPT-MOCK-0001 (fixed 600 ms delay)",
    ],
    "MAL-FLW-006": [
      "SECOND_SUBMIT_SAME_KEY → DUPLICATE_APPLICATION warning (no new receipt)",
    ],
    "MAL-FLW-007": [
      "ANY_STATE → INITIAL (reset clears flow and receipts deterministically)",
    ],
    "MAL-FLW-008": [
      "INJECTION_TEXT_RENDERED_INERT (visible as text, no execution, no markup)",
    ],
    "MAL-FRM-001": [
      "FRAME_EMPTY_REQUIRED → FRAME_VALIDATION_FAILED (frame-local error)",
      "FRAME_FILLED → FRAME_SECTION_SAVED (frame-local acceptance)",
    ],
    "MAL-IDX-001": ["INDEX_LISTS_EVERY_CATALOG_CASE (one entry per case ID)"],
    "MAL-NAT-001": [
      "EMPTY_REQUIRED → VALIDATION_FAILED (native validity surfaced)",
      "COMPLETE_VALID → SAVED_LOCALLY (accepted by the fixture)",
    ],
    "MAL-NAT-002": [
      "TYPE_MISMATCH → FIELD_ERROR (native email/number semantics)",
      "CORRECTED → ERROR_CLEARED",
    ],
    "MAL-NAT-003": [
      "SENSITIVE_FIELDS_RENDERED_REALISTICALLY (no fixture metadata leaked)",
    ],
    "MAL-NAT-004": [
      "HONEYPOT_HIDDEN_AND_BLANK (ordinary completion leaves it empty)",
      "HONEYPOT_POPULATED → REJECTED_HONEYPOT (local submission rejected)",
    ],
    "MAL-NAT-005": [
      "INJECTION_HELP_TEXT_RENDERED_INERT (text only, sentinel untouched)",
    ],
    "MAL-REA-001": [
      "TYPED_VALUE → STATE_COMMITTED (React synthetic events)",
      "FORCE_RERENDER → VALUE_PERSISTS (state-driven DOM)",
    ],
    "MAL-REA-002": [
      "DIRECT_DOM_WRITE → STATE_UNCHANGED (mirror keeps committed value)",
      "RERENDER → STALE_WRITE_DISCARDED (DOM reverts to state)",
    ],
    "MAL-REA-003": [
      "BLUR → SITE_REWRITE_OBSERVED (email lowercased by the page)",
      "DELAYED_RERENDER → RERENDER_PENDING → IDLE (fixed 500 ms delay)",
    ],
    "MAL-SHD-001": [
      "SHADOW_EMPTY_REQUIRED → SHADOW_VALIDATION_FAILED",
      "SHADOW_FILLED → SHADOW_SAVED:<value> (open shadow root state)",
    ],
    "MAL-UPL-001": [
      "NO_FILE → ACCEPTED_LOCALLY (allowed type/size shows exact metadata)",
      "WRONG_TYPE → REJECTED_TYPE (selection cleared)",
      "CLEARED → NO_FILE (empty selection state)",
    ],
    "MAL-VAL-001": [
      "INVALID_FIELD → FIELD_ERROR → ERROR_CLEARED (custom rule)",
      "MISMATCHED_EMAILS → CROSS_FIELD_ERROR → CLEARED_ON_MATCH",
      "INVITE → CHECKING → INVITE_ACCEPTED|INVITE_REJECTED (fixed 500 ms delay)",
      "ANY_ERROR → CONTINUE_BLOCKED; ALL_VALID → CONTINUE_ALLOWED",
    ],
    "MAL-VIR-001": [
      "WINDOW_MOUNTED_SUBSET (mounted nodes ≪ total options)",
      "SCROLL → WINDOW_REWINDOWED (different subset mounted)",
      "OFFSCREEN_OPTION → SELECTED (ordinary scroll/keyboard interaction)",
      "RERENDER → SELECTION_PERSISTS",
    ],
    "MAL-VUE-001": [
      "TYPED_VALUE → STATE_COMMITTED (Vue reactivity)",
      "FORCE_RERENDER → VALUE_PERSISTS (state-driven patch)",
    ],
    "MAL-VUE-002": [
      "DIRECT_DOM_WRITE → STATE_UNCHANGED (mirror keeps committed value)",
      "RERENDER → STALE_WRITE_DISCARDED (patch restores state value)",
    ],
    "MAL-VUE-003": [
      "INPUT → SITE_REWRITE_OBSERVED (employee ID uppercased by the page)",
    ],
  };
