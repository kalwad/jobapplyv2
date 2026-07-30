import type {
  EvidenceArtifact,
  ExpectedRequirement,
  SupportClassification,
  UnsupportedGap,
} from "./model.ts";
import {
  experienceCoverageDays,
  requiredExperienceDays,
  reviewedRelatedFactKeys,
} from "./semantic-evidence.ts";
import { credentialStateAt } from "./temporal-policy.ts";

export const TWO_PAGE_RESUME_RATIONALE =
  "Page one contains the reviewed employment record and earliest completed education record; page two contains two later completed education records and the reviewed team-communication project.";

interface ReviewRationaleInput {
  readonly classification: SupportClassification;
  readonly requirement: ExpectedRequirement;
  readonly evidence: readonly EvidenceArtifact[];
  readonly evaluationDate: string;
  readonly reasonCode?: UnsupportedGap["reason_code"];
}

function citedKeys(artifacts: readonly EvidenceArtifact[]): string[] {
  return [
    ...new Set(artifacts.flatMap((artifact) => artifact.fact_keys)),
  ].sort();
}

function keyList(keys: readonly string[]): string {
  return keys.length === 0 ? "none" : keys.join(", ");
}

export function expectedReviewRationale({
  classification,
  requirement,
  evidence,
  evaluationDate,
  reasonCode,
}: ReviewRationaleInput): string {
  if (classification === "USER_ASSERTED") {
    const concept = requirement.requirement_tag
      .slice("field:".length)
      .toUpperCase();
    const record = evidence
      .flatMap((artifact) => artifact.field_records)
      .find((candidate) => candidate.field_concept === concept);
    return `The cited approved atomic field record carries ${requirement.requirement_tag}, was recorded on ${record?.recorded_on ?? "an unknown date"}, and is evaluated under its explicit field policy on ${evaluationDate}.`;
  }

  if (classification === "CONTRADICTED") {
    return `The cited approved record for ${requirement.requirement_tag} conflicts with the anchored ${requirement.constraint.kind}=${requirement.constraint.value} constraint, so release is prohibited.`;
  }

  if (
    reasonCode === "CREDENTIAL_EXPIRED" ||
    reasonCode === "CREDENTIAL_NOT_CURRENT"
  ) {
    const credential = evidence[0];
    const state =
      credential === undefined
        ? "UNKNOWN"
        : credentialStateAt(credential, evaluationDate);
    return `The cited credential carrying ${requirement.requirement_tag} is ${state ?? "UNKNOWN"} at the ${evaluationDate} evaluation date, so it cannot release as current evidence.`;
  }

  if (requirement.requirement_kind === "EXPERIENCE") {
    const coveredDays = experienceCoverageDays(evidence, evaluationDate);
    const thresholdDays = requiredExperienceDays(requirement) ?? 0;
    const exact = evidence.some((artifact) =>
      artifact.fact_keys.includes(requirement.requirement_tag),
    );
    const related = reviewedRelatedFactKeys(requirement, evidence);
    if (classification === "DIRECT") {
      return `The cited reviewed activity evidence carries exact fact key ${requirement.requirement_tag} and covers ${String(coveredDays)} non-overlapping days against the ${String(thresholdDays)}-day threshold.`;
    }
    if (classification === "STRONG_RELATED") {
      return `The cited reviewed activity evidence carries ${keyList(related)}, is strongly related to ${requirement.requirement_tag}, and covers ${String(coveredDays)} non-overlapping days against the ${String(thresholdDays)}-day threshold without claiming exact-tag support.`;
    }
    if (classification === "PARTIAL") {
      const basis = exact
        ? `exact fact key ${requirement.requirement_tag}`
        : `reviewed related fact key(s) ${keyList(related)}`;
      return `The cited reviewed activity evidence carries ${basis} and covers ${String(coveredDays)} non-overlapping days, which is partial support for the ${String(thresholdDays)}-day ${requirement.requirement_tag} experience requirement and is not release eligible.`;
    }
    return `No reviewed employment or project evidence carries ${requirement.requirement_tag} or a reviewed related activity key, so the experience requirement remains unsupported.`;
  }

  if (classification === "DIRECT") {
    return `The cited reviewed evidence carries exact fact key ${requirement.requirement_tag} and directly supports the anchored ${requirement.requirement_kind.toLowerCase()} requirement at the ${evaluationDate} evaluation date.`;
  }
  if (classification === "PARTIAL") {
    return `The cited reviewed evidence carries ${keyList(citedKeys(evidence))}, which is incomplete support for ${requirement.requirement_tag} at the ${evaluationDate} evaluation date and is not release eligible.`;
  }
  return `No reviewed evidence supports ${requirement.requirement_tag} for the anchored ${requirement.requirement_kind.toLowerCase()} requirement at the ${evaluationDate} evaluation date.`;
}
