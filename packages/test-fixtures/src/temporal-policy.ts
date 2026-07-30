import type {
  EvidenceArtifact,
  ExpectedAction,
  ExplicitFieldRecord,
  FieldValuePolicy,
} from "./model.ts";

export type CredentialState =
  "CURRENT" | "EXPIRED" | "NOT_YET_VALID" | "REVOKED" | "UNKNOWN";

export interface PolicyDecision {
  readonly action: ExpectedAction;
  readonly releaseEligible: boolean;
}

export function credentialStateAt(
  artifact: EvidenceArtifact,
  evaluationDate: string,
): CredentialState | undefined {
  if (
    artifact.category !== "CREDENTIAL_RECORD" ||
    artifact.credential_validity_basis === undefined
  ) {
    return undefined;
  }
  if (
    artifact.revoked_on !== undefined &&
    artifact.revoked_on <= evaluationDate
  ) {
    return "REVOKED";
  }
  if (evaluationDate < artifact.effective_period.start) {
    return "NOT_YET_VALID";
  }
  if (artifact.credential_validity_basis === "UNKNOWN") {
    return "UNKNOWN";
  }
  if (
    artifact.credential_validity_basis === "BOUNDED" &&
    artifact.effective_period.end !== undefined &&
    evaluationDate > artifact.effective_period.end
  ) {
    return "EXPIRED";
  }
  return "CURRENT";
}

export function fieldRecordForPolicy(
  policy: FieldValuePolicy,
  source: EvidenceArtifact,
): ExplicitFieldRecord | undefined {
  return source.field_records.find(
    (record) => record.field_record_id === policy.source_field_record_id,
  );
}

export function fieldRecordIsCurrent(
  policy: FieldValuePolicy,
  source: EvidenceArtifact,
  evaluationDate: string,
): boolean {
  const record = fieldRecordForPolicy(policy, source);
  return (
    source.category === "USER_ASSERTION" &&
    source.assertion_approval === "USER_APPROVED" &&
    source.effective_period.start <= evaluationDate &&
    (source.effective_period.end === undefined ||
      source.effective_period.end >= evaluationDate) &&
    record !== undefined &&
    record.recorded_on <= evaluationDate &&
    record.valid_through !== undefined &&
    record.valid_through >= evaluationDate
  );
}

export function policyDecisionAt(
  policy: FieldValuePolicy,
  source: EvidenceArtifact,
  evaluationDate: string,
): PolicyDecision {
  let action: ExpectedAction;
  if (
    policy.policy === "BLOCK_AND_EXPLAIN" ||
    policy.policy === "NEVER_AUTOFILL"
  ) {
    action = "BLOCK_AND_EXPLAIN";
  } else if (policy.policy === "VOLUNTARY_PREFER_NOT_TO_ANSWER") {
    action = "ABSTAIN";
  } else if (policy.policy === "CONFIRM_ONCE_PER_JOB") {
    action = "REQUIRE_CONFIRMATION";
  } else if (policy.field_concept === "LICENSE_VALIDITY") {
    action =
      credentialStateAt(source, evaluationDate) === "CURRENT"
        ? "USE_SUPPORTED_EVIDENCE"
        : "REQUIRE_CONFIRMATION";
  } else {
    action = fieldRecordIsCurrent(policy, source, evaluationDate)
      ? "USE_SUPPORTED_EVIDENCE"
      : "REQUIRE_CONFIRMATION";
  }
  return {
    action,
    releaseEligible: action === "USE_SUPPORTED_EVIDENCE",
  };
}
