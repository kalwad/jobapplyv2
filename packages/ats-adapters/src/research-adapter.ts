/**
 * M02-W12 internal research hints. No browser or action capability crosses
 * this pure boundary. Eligibility is evidence for the W08→W11 generic core,
 * never permission to fill, navigate, authenticate, consent, or submit.
 * Every input token is untrusted; unsupported/contradictory evidence pauses.
 */
export const RESEARCH_FAMILIES = [
  "WORKDAY",
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
] as const;
export type ResearchFamily = (typeof RESEARCH_FAMILIES)[number];
export const RESEARCH_STEPS = [
  "START_APPLICATION",
  "MY_INFORMATION",
  "MY_EXPERIENCE",
  "EDUCATION",
  "WORK_EXPERIENCE",
  "SKILLS_OR_LANGUAGES",
  "APPLICATION_QUESTIONS",
  "VOLUNTARY_DISCLOSURES",
  "SELF_IDENTIFICATION",
  "DOCUMENTS",
  "REVIEW",
] as const;
export type ResearchStep = (typeof RESEARCH_STEPS)[number];
export const SESSION_MODES = [
  "GUEST",
  "AUTHENTICATED",
  "RETURNING_CANDIDATE",
  "SIGN_IN",
  "CREATE_ACCOUNT",
  "EMAIL_VERIFICATION",
  "MFA",
  "CAPTCHA_OR_BOT_CHALLENGE",
  "SESSION_EXPIRED",
  "DUPLICATE_APPLICATION",
  "PRIVACY_OR_TERMS",
  "UNKNOWN",
] as const;
export type ResearchSession = (typeof SESSION_MODES)[number];
const FAMILY_SOURCES = ["ROUTE", "SHELL", "STRUCTURE"] as const;
const STEP_SOURCES = [
  "ROUTE",
  "HEADING",
  "PROGRESS",
  "FIELD_CONCEPTS",
] as const;
export interface ResearchEvidence {
  familySignals: {
    source: (typeof FAMILY_SOURCES)[number];
    family: ResearchFamily;
  }[];
  stepSignals: { source: (typeof STEP_SOURCES)[number]; step: ResearchStep }[];
  sessionSignals: ResearchSession[];
}
export interface ResearchAssessment {
  readonly mode: "RESEARCH_ONLY";
  readonly certification: "NOT_CERTIFIED";
  readonly productionSupport: false;
  readonly authority: "W08_W09_W10_W11_ONLY";
  readonly posture: "ELIGIBLE_FOR_GENERIC_CORE" | "PAUSE";
  readonly step: ResearchStep | "UNKNOWN";
  readonly reason:
    | "MALFORMED_EVIDENCE"
    | "FAMILY_UNCERTAIN"
    | "SESSION_BOUNDARY"
    | "STEP_UNCERTAIN"
    | "CORROBORATED_RESEARCH_EVIDENCE";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
function validEvidence(value: unknown): value is ResearchEvidence {
  if (
    !record(value) ||
    !keys(value, ["familySignals", "stepSignals", "sessionSignals"])
  )
    return false;
  if (
    !Array.isArray(value.familySignals) ||
    value.familySignals.length > 8 ||
    !Array.isArray(value.stepSignals) ||
    value.stepSignals.length > 16 ||
    !Array.isArray(value.sessionSignals) ||
    value.sessionSignals.length > 12
  )
    return false;
  return (
    value.familySignals.every(
      (signal: unknown) =>
        record(signal) &&
        keys(signal, ["source", "family"]) &&
        member(FAMILY_SOURCES, signal.source) &&
        member(RESEARCH_FAMILIES, signal.family),
    ) &&
    value.stepSignals.every(
      (signal: unknown) =>
        record(signal) &&
        keys(signal, ["source", "step"]) &&
        member(STEP_SOURCES, signal.source) &&
        member(RESEARCH_STEPS, signal.step),
    ) &&
    value.sessionSignals.every((session: unknown) =>
      member(SESSION_MODES, session),
    )
  );
}

function assess(family: ResearchFamily, input: unknown): ResearchAssessment {
  const result = (
    reason: ResearchAssessment["reason"],
    step: ResearchAssessment["step"] = "UNKNOWN",
  ): ResearchAssessment =>
    Object.freeze({
      mode: "RESEARCH_ONLY",
      certification: "NOT_CERTIFIED",
      productionSupport: false,
      authority: "W08_W09_W10_W11_ONLY",
      posture:
        reason === "CORROBORATED_RESEARCH_EVIDENCE"
          ? "ELIGIBLE_FOR_GENERIC_CORE"
          : "PAUSE",
      step,
      reason,
    });
  if (!validEvidence(input)) return result("MALFORMED_EVIDENCE");
  if (
    input.familySignals.some((signal) => signal.family !== family) ||
    new Set(input.familySignals.map((signal) => signal.source)).size < 2
  )
    return result("FAMILY_UNCERTAIN");
  if (
    input.sessionSignals.length === 0 ||
    input.sessionSignals.some(
      (session) =>
        !["GUEST", "AUTHENTICATED", "RETURNING_CANDIDATE"].includes(session),
    )
  )
    return result("SESSION_BOUNDARY");
  const steps = new Set(input.stepSignals.map((signal) => signal.step));
  const sources = new Set(input.stepSignals.map((signal) => signal.source));
  if (steps.size !== 1 || sources.size < 2) return result("STEP_UNCERTAIN");
  const step = input.stepSignals[0]?.step;
  return step === undefined
    ? result("STEP_UNCERTAIN")
    : result("CORROBORATED_RESEARCH_EVIDENCE", step);
}

export function createResearchAdapter(family: ResearchFamily) {
  return Object.freeze({
    family,
    mode: "RESEARCH_ONLY" as const,
    analyze: (input: unknown): ResearchAssessment => assess(family, input),
  });
}
