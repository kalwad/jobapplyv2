/** Test-local public evaluation capability. No selector/value commands. */
import type { FormFieldAddressV1 } from "@japp/contracts/generated";
import {
  FRAME_REGISTERED_KIND,
  SCANNER_PROTOCOL_VERSION,
  parseFrameRegistered,
  isCanonicalFieldAddress,
  type FrameContext,
  type FrameScanReport,
} from "../../../src/scanner-protocol.ts";
import { canonicalJson } from "../../../src/driver-evidence.ts";
import { semanticDigest } from "../../../src/semantic-identity.ts";
import { isCanonicalFieldDecision } from "../../../src/driver-protocol.ts";
import { permitsPublicDocumentUrl } from "../public-inspection/scope.ts";

export const CONTACT_SCOPE = "W14_PUBLIC_CONTACT_NETWORK_CLOSED_1";
export const SYNTHETIC_FACTS = {
  FIRST_NAME: "Synthetic",
  LAST_NAME: "Applicant",
  FULL_NAME: "Synthetic Applicant",
  EMAIL_ADDRESS: "synthetic@example.invalid",
  PHONE_NUMBER: "2025550100",
  WEBSITE_URL: "https://example.invalid/profile",
} as const;
export type ContactConcept = keyof typeof SYNTHETIC_FACTS;
export interface ContactPlan {
  scope: typeof CONTACT_SCOPE;
  source_url: string;
  frame_context: FrameContext;
  before_scan_digest: string;
  independent_oracle_digest: string;
  profile_digest: string;
  fields: { field_id: string; address: FormFieldAddressV1 }[];
}
export const PREPARE = "M02_W14_PUBLIC_CONTACT_PREPARE";
export const EXECUTE = "M02_W14_PUBLIC_CONTACT_EXECUTE";
export const PREPARED = "M02_W14_PUBLIC_CONTACT_PREPARED";
export const RESULT = "M02_W14_PUBLIC_CONTACT_RESULT";
export function closed(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join() === [...keys].sort().join()
  );
}
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
const stableId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-z][a-z0-9]{1,23}_[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
export function parsePlan(value: unknown): ContactPlan | null {
  if (
    !closed(value, [
      "scope",
      "source_url",
      "frame_context",
      "before_scan_digest",
      "independent_oracle_digest",
      "profile_digest",
      "fields",
    ]) ||
    value.scope !== CONTACT_SCOPE ||
    typeof value.source_url !== "string" ||
    !permitsPublicDocumentUrl(value.source_url) ||
    !digest(value.before_scan_digest) ||
    !digest(value.independent_oracle_digest) ||
    !digest(value.profile_digest) ||
    !Array.isArray(value.fields) ||
    value.fields.length > 512
  )
    return null;
  const frame = parseFrameRegistered({
    kind: FRAME_REGISTERED_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
    frame_context: value.frame_context,
  });
  if (frame?.frame_context.is_top_frame !== true) return null;
  const fields: ContactPlan["fields"] = [];
  for (const raw of value.fields as unknown[]) {
    if (!closed(raw, ["field_id", "address"]) || !stableId(raw.field_id))
      return null;
    const address = raw.address;
    if (
      !isCanonicalFieldAddress(address) ||
      address.session_id !== frame.frame_context.session_id ||
      address.frame_id !== frame.frame_context.frame_id ||
      address.document_id !== frame.frame_context.document_id ||
      fields.some((field) => field.field_id === raw.field_id)
    )
      return null;
    fields.push({ field_id: raw.field_id, address });
  }
  return {
    scope: CONTACT_SCOPE,
    source_url: value.source_url,
    frame_context: frame.frame_context,
    before_scan_digest: value.before_scan_digest,
    independent_oracle_digest: value.independent_oracle_digest,
    profile_digest: value.profile_digest,
    fields,
  };
}
export function parseContactRequest(value: unknown) {
  if (
    closed(value, ["kind", "version", "requestId", "tabId", "plan"]) &&
    value.kind === PREPARE &&
    value.version === 1 &&
    typeof value.requestId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value.requestId) &&
    typeof value.tabId === "number" &&
    Number.isSafeInteger(value.tabId) &&
    value.tabId >= 0
  ) {
    const plan = parsePlan(value.plan);
    return plan === null
      ? null
      : ({
          kind: PREPARE,
          version: 1,
          requestId: value.requestId,
          tabId: value.tabId,
          plan,
        } as const);
  }
  if (
    closed(value, [
      "kind",
      "version",
      "requestId",
      "tabId",
      "plan_id",
      "field_id",
      "decision",
    ]) &&
    value.kind === EXECUTE &&
    value.version === 1 &&
    typeof value.requestId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value.requestId) &&
    typeof value.tabId === "number" &&
    Number.isSafeInteger(value.tabId) &&
    value.tabId >= 0 &&
    digest(value.plan_id) &&
    stableId(value.field_id) &&
    isCanonicalFieldDecision(value.decision)
  )
    return {
      kind: EXECUTE,
      version: 1,
      requestId: value.requestId,
      tabId: value.tabId,
      plan_id: value.plan_id,
      field_id: value.field_id,
      decision: value.decision,
    } as const;
  return null;
}
export function profileDigest() {
  return semanticDigest(canonicalJson(SYNTHETIC_FACTS));
}
export function planDigest(plan: ContactPlan) {
  return semanticDigest(canonicalJson(plan));
}
/** Timestamps do not bind identity. Actual evidence/generations do. */
export function scanDigest(report: FrameScanReport) {
  return semanticDigest(
    canonicalJson({
      frame_context: report.frame_context,
      root_status: report.root_status,
      descriptors: report.descriptors.map((field) => {
        const { observed_at, ...descriptor } = field;
        void observed_at;
        return descriptor;
      }),
    }),
  );
}
