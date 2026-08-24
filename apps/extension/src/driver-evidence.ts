// M02-W10 driver evidence and outcome synthesis (spec §5.11.6).
//
// Pure, DOM-free helpers: canonical JSON (byte-agreement with
// packages/form-engine/src/semantic-digest.ts is pinned by a unit test),
// the decision↔address binding digest, redacted semantic value evidence
// (digest + presence, never a raw value), and the closed deterministic
// mapping from a transaction assessment onto the canonical
// FormDriverResultV1 outcome / reason-code / persistence / safe-retry
// vocabulary. No branch converts uncertainty into VERIFIED, and every
// emitted posture keeps safe_retry_allowed false: W10 has no retry path,
// and duplicate-action prevention across rescans belongs to M02-W11.
import type {
  CommonProvenanceV1ContentDigest,
  FormDriverResultV1DriverOutcome,
  FormDriverResultV1ReasonCode,
  FormFieldAddressV1,
} from "@japp/contracts/generated";

import { semanticDigest } from "./semantic-identity.ts";

/**
 * Canonical deterministic JSON: keys sorted at every depth, arrays in
 * order, undefined members dropped, no whitespace. Mirror of
 * packages/form-engine/src/semantic-digest.ts `canonicalJson`; the W09
 * decision's `field_address_digest` is computed over this serialization.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${members.join(",")}}`;
  }
  if (value === undefined) {
    return "null";
  }
  return JSON.stringify(value);
}

/**
 * The exact address-digest seed the W09 decision resolver binds decisions
 * with (packages/form-engine/src/decision-resolver.ts). A decision whose
 * `field_address_digest` does not equal this digest of the transaction's
 * address authorizes nothing for that address.
 */
export async function fieldAddressDigest(
  address: FormFieldAddressV1,
): Promise<CommonProvenanceV1ContentDigest> {
  return semanticDigest(`field-address-v1\0${canonicalJson(address)}`);
}

export type ValuePresence = "ABSENT" | "EMPTY" | "PRESENT_REDACTED";

export interface SemanticValueEvidence {
  readonly semantic_digest: CommonProvenanceV1ContentDigest;
  readonly presence: ValuePresence;
}

/**
 * One redacted semantic observation before digesting: a versioned family
 * plus the bounded semantic parts that define value equality for that
 * control family. Raw applicant values never leave this module — only the
 * digest and a presence class are representable downstream.
 */
export interface SemanticObservation {
  readonly family: "TEXT" | "OPTION" | "CHECKED" | "DATE" | "FILE" | "REPEATER";
  readonly parts: readonly string[];
  readonly presence: ValuePresence;
}

/** Sentinel observation when no value could be observed at all. */
export const UNOBSERVED: SemanticObservation = {
  family: "TEXT",
  parts: ["\0UNOBSERVED\0"],
  presence: "ABSENT",
};

export async function evidenceFromObservation(
  observation: SemanticObservation,
): Promise<SemanticValueEvidence> {
  const seed = [
    "driver-value-v1",
    observation.family,
    ...observation.parts,
  ].join("\0");
  return {
    semantic_digest: await semanticDigest(seed),
    presence: observation.presence,
  };
}

export function observationsEquivalent(
  left: SemanticObservation,
  right: SemanticObservation,
): boolean {
  return (
    left.family === right.family &&
    left.presence === right.presence &&
    left.parts.length === right.parts.length &&
    left.parts.every((part, index) => part === right.parts[index])
  );
}

export function textObservation(value: string): SemanticObservation {
  return {
    family: "TEXT",
    parts: [value],
    presence: value === "" ? "EMPTY" : "PRESENT_REDACTED",
  };
}

export function optionObservation(
  valueDigest: string | null,
): SemanticObservation {
  return valueDigest === null
    ? { family: "OPTION", parts: ["\0NONE\0"], presence: "EMPTY" }
    : { family: "OPTION", parts: [valueDigest], presence: "PRESENT_REDACTED" };
}

export function checkedObservation(checked: boolean): SemanticObservation {
  return {
    family: "CHECKED",
    parts: [checked ? "true" : "false"],
    presence: "PRESENT_REDACTED",
  };
}

export function dateObservation(isoDate: string): SemanticObservation {
  return {
    family: "DATE",
    parts: [isoDate],
    presence: isoDate === "" ? "EMPTY" : "PRESENT_REDACTED",
  };
}

export function fileObservation(
  file: {
    readonly name: string;
    readonly mediaType: string;
    readonly sizeBytes: number;
    readonly artifactDigest: string;
  } | null,
): SemanticObservation {
  return file === null
    ? { family: "FILE", parts: ["\0NONE\0"], presence: "EMPTY" }
    : {
        family: "FILE",
        parts: [
          file.name,
          file.mediaType,
          String(file.sizeBytes),
          file.artifactDigest,
        ],
        presence: "PRESENT_REDACTED",
      };
}

export function repeaterObservation(
  operation: "ADD" | "EDIT" | "REMOVE",
  itemLabel: string,
  state: string,
): SemanticObservation {
  return {
    family: "REPEATER",
    parts: [operation, itemLabel, state],
    presence: state === "\0ABSENT\0" ? "EMPTY" : "PRESENT_REDACTED",
  };
}

/** Closed set of transaction phases the kernel can end in. */
export type TransactionPhase =
  | { readonly phase: "DECISION_REFUSED"; readonly sensitive: boolean }
  | {
      readonly phase: "RESOLUTION_FAILED";
      readonly resolution: "AMBIGUOUS" | "MISSING" | "STALE";
      readonly documentChanged: boolean;
    }
  | { readonly phase: "DRIVER_UNSUPPORTED" }
  | { readonly phase: "DRIVER_AMBIGUOUS" }
  | { readonly phase: "PRECONDITIONS_FAILED" }
  | { readonly phase: "ACTION_FAILED" }
  | { readonly phase: "SETTLE_TIMEOUT" }
  | {
      readonly phase: "SETTLED_TARGET_LOST";
      readonly resolution: "AMBIGUOUS" | "MISSING" | "STALE";
    }
  | {
      readonly phase: "COMPLETE";
      readonly immediateMatches: boolean;
      readonly settledMatches: boolean;
      readonly siteAcceptance: "ACCEPTED" | "REJECTED" | "UNKNOWN";
      readonly validationMessageCount: number;
      readonly conditionalFieldsDiscovered: boolean;
    };

export interface OutcomeSynthesis {
  readonly outcome: FormDriverResultV1DriverOutcome;
  readonly reason_codes: readonly FormDriverResultV1ReasonCode[];
  readonly persistence_verified: boolean;
  readonly safe_retry_allowed: false;
}

function reasons(
  ...codes: readonly (FormDriverResultV1ReasonCode | undefined)[]
): readonly FormDriverResultV1ReasonCode[] {
  const unique: FormDriverResultV1ReasonCode[] = [];
  for (const code of codes) {
    if (code !== undefined && !unique.includes(code)) {
      unique.push(code);
    }
  }
  return unique.slice(0, 8);
}

/**
 * Deterministic closed mapping from a transaction phase onto the canonical
 * outcome vocabulary. VERIFIED exists on exactly one path: a completed
 * action whose immediate AND settled semantic observations equal the
 * intended value, with site acceptance ACCEPTED and zero validation
 * messages. UNKNOWN acceptance is never converted into VERIFIED.
 */
export function synthesizeOutcome(phase: TransactionPhase): OutcomeSynthesis {
  switch (phase.phase) {
    case "DECISION_REFUSED":
      return {
        outcome: phase.sensitive ? "BLOCKED_SENSITIVE" : "NEEDS_REVIEW",
        reason_codes: reasons(
          phase.sensitive ? "SENSITIVE_ACTION_BLOCKED" : undefined,
          "PRECONDITIONS_FAILED",
        ),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "RESOLUTION_FAILED":
      return {
        outcome: "NEEDS_REVIEW",
        reason_codes: reasons(
          phase.resolution === "AMBIGUOUS"
            ? "AMBIGUOUS_RESOLUTION"
            : phase.resolution === "MISSING"
              ? "RESOLUTION_MISSING"
              : "RESOLUTION_STALE",
          phase.documentChanged ? "PAGE_GENERATION_CHANGED" : undefined,
        ),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "DRIVER_UNSUPPORTED":
      return {
        outcome: "UNSUPPORTED",
        reason_codes: reasons("UNSUPPORTED_CONTROL"),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "DRIVER_AMBIGUOUS":
      // More than one authoritative driver claims the control: fail closed
      // for review rather than picking one.
      return {
        outcome: "NEEDS_REVIEW",
        reason_codes: reasons("UNSUPPORTED_CONTROL", "PRECONDITIONS_FAILED"),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "PRECONDITIONS_FAILED":
      return {
        outcome: "NEEDS_REVIEW",
        reason_codes: reasons("PRECONDITIONS_FAILED"),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "ACTION_FAILED":
      return {
        outcome: "FAILED",
        reason_codes: reasons("ACTION_FAILED"),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "SETTLE_TIMEOUT":
      // The declared settle window never completed: the settled observation
      // is not proof of persistence, whatever it currently reads.
      return {
        outcome: "NEEDS_REVIEW",
        reason_codes: reasons("PERSISTENCE_NOT_VERIFIED"),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "SETTLED_TARGET_LOST":
      return {
        outcome: "NEEDS_REVIEW",
        reason_codes: reasons(
          "PERSISTENCE_NOT_VERIFIED",
          phase.resolution === "AMBIGUOUS"
            ? "AMBIGUOUS_RESOLUTION"
            : phase.resolution === "MISSING"
              ? "RESOLUTION_MISSING"
              : "RESOLUTION_STALE",
        ),
        persistence_verified: false,
        safe_retry_allowed: false,
      };
    case "COMPLETE": {
      const conditional = phase.conditionalFieldsDiscovered
        ? ("CONDITIONAL_FIELDS_DISCOVERED" as const)
        : undefined;
      if (!phase.immediateMatches) {
        return {
          outcome: "FAILED",
          reason_codes: reasons("ACTION_FAILED", "VALUE_MISMATCH", conditional),
          persistence_verified: false,
          safe_retry_allowed: false,
        };
      }
      if (!phase.settledMatches) {
        // Immediate success that the page or framework rolled back during
        // the settle window is a FAILED fill, never a VERIFIED one.
        return {
          outcome: "FAILED",
          reason_codes: reasons(
            "VALUE_MISMATCH",
            "PERSISTENCE_NOT_VERIFIED",
            conditional,
          ),
          persistence_verified: false,
          safe_retry_allowed: false,
        };
      }
      if (phase.siteAcceptance === "REJECTED") {
        return {
          outcome: "NEEDS_REVIEW",
          reason_codes: reasons("SITE_REJECTED", conditional),
          persistence_verified: true,
          safe_retry_allowed: false,
        };
      }
      if (
        phase.siteAcceptance === "UNKNOWN" ||
        phase.validationMessageCount > 0
      ) {
        return {
          outcome: "NEEDS_REVIEW",
          reason_codes: reasons(
            phase.siteAcceptance === "UNKNOWN"
              ? "SITE_ACCEPTANCE_UNKNOWN"
              : "SITE_REJECTED",
            conditional,
          ),
          persistence_verified: true,
          safe_retry_allowed: false,
        };
      }
      return {
        outcome: "VERIFIED",
        reason_codes: reasons("VERIFIED_PERSISTENCE", conditional),
        persistence_verified: true,
        safe_retry_allowed: false,
      };
    }
  }
}
