import type {
  EvidenceArtifact,
  EvidenceCategory,
  ExpectedRequirement,
  GapClassification,
  SupportedClassification,
} from "./model.ts";

export interface SemanticEvidenceSelector {
  readonly id?: string;
  readonly category: EvidenceCategory;
  readonly fact_keys: readonly [string, ...string[]];
}

const ACTIVITY_CATEGORIES = new Set<EvidenceCategory>([
  "EMPLOYMENT_RECORD",
  "PROJECT_RECORD",
]);

const REVIEWED_RELATED_EXPERIENCE_KEYS: Readonly<
  Record<
    string,
    {
      readonly STRONG_RELATED?: readonly string[];
      readonly PARTIAL?: readonly string[];
    }
  >
> = {
  "skill:data-modeling": {
    PARTIAL: ["skill:api-design"],
  },
  "skill:experiment-design": {
    PARTIAL: ["skill:quality-reporting"],
  },
  "skill:financial-modeling": {
    PARTIAL: ["skill:forecasting"],
  },
  "skill:machine-learning": {
    PARTIAL: ["skill:python"],
  },
  "skill:process-mapping": {
    PARTIAL: ["skill:process-improvement"],
  },
  "skill:scheduling": {
    STRONG_RELATED: ["skill:task-tracking"],
    PARTIAL: ["skill:requirements-analysis"],
  },
  "skill:sql": {
    PARTIAL: ["skill:learning-analytics", "skill:statistical-analysis"],
  },
};

export function selectExactlyOneEvidence(
  artifacts: readonly EvidenceArtifact[],
  selector: SemanticEvidenceSelector,
  context: string,
): EvidenceArtifact {
  const matches = artifacts.filter(
    (artifact) =>
      (selector.id === undefined || artifact.id === selector.id) &&
      artifact.category === selector.category &&
      selector.fact_keys.every((key) => artifact.fact_keys.includes(key)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `${context}: semantic evidence selector ${selector.id ?? "*"}/${selector.category}/${selector.fact_keys.join("+")} matched ${String(matches.length)} artifacts`,
    );
  }
  const selected = matches[0];
  if (selected === undefined) {
    throw new Error(`${context}: semantic evidence selector result is missing`);
  }
  return selected;
}

export function reviewedExperienceRelation(
  requirement: ExpectedRequirement,
  artifact: EvidenceArtifact,
):
  | Extract<SupportedClassification, "DIRECT" | "STRONG_RELATED">
  | Extract<GapClassification, "PARTIAL">
  | undefined {
  if (
    requirement.requirement_kind !== "EXPERIENCE" ||
    !ACTIVITY_CATEGORIES.has(artifact.category)
  ) {
    return undefined;
  }
  if (artifact.fact_keys.includes(requirement.requirement_tag)) {
    return "DIRECT";
  }
  const reviewed =
    REVIEWED_RELATED_EXPERIENCE_KEYS[requirement.requirement_tag];
  if (
    reviewed?.STRONG_RELATED?.some((key) =>
      artifact.fact_keys.includes(key),
    ) === true
  ) {
    return "STRONG_RELATED";
  }
  if (
    reviewed?.PARTIAL?.some((key) => artifact.fact_keys.includes(key)) === true
  ) {
    return "PARTIAL";
  }
  return undefined;
}

export function reviewedRelatedFactKeys(
  requirement: ExpectedRequirement,
  artifacts: readonly EvidenceArtifact[],
): string[] {
  const reviewed =
    REVIEWED_RELATED_EXPERIENCE_KEYS[requirement.requirement_tag];
  const allowed = new Set([
    ...(reviewed?.STRONG_RELATED ?? []),
    ...(reviewed?.PARTIAL ?? []),
  ]);
  return [
    ...new Set(
      artifacts.flatMap((artifact) =>
        artifact.fact_keys.filter((key) => allowed.has(key)),
      ),
    ),
  ].sort();
}

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

export function experienceCoverageDays(
  artifacts: readonly EvidenceArtifact[],
  evaluationDate: string,
): number {
  const evaluation = dateValue(evaluationDate);
  const intervals = artifacts
    .flatMap((artifact) => {
      if (!ACTIVITY_CATEGORIES.has(artifact.category)) {
        return [];
      }
      const start = dateValue(artifact.effective_period.start);
      const declaredEnd = dateValue(
        artifact.effective_period.end ?? evaluationDate,
      );
      const end = Math.min(declaredEnd, evaluation);
      return start <= end ? [{ start, end }] : [];
    })
    .sort((left, right) => left.start - right.start);
  let coveredDays = 0;
  let cursorStart: number | undefined;
  let cursorEnd: number | undefined;
  for (const interval of intervals) {
    if (cursorStart === undefined || cursorEnd === undefined) {
      cursorStart = interval.start;
      cursorEnd = interval.end;
    } else if (interval.start <= cursorEnd) {
      cursorEnd = Math.max(cursorEnd, interval.end);
    } else {
      coveredDays += (cursorEnd - cursorStart) / 86_400_000 + 1;
      cursorStart = interval.start;
      cursorEnd = interval.end;
    }
  }
  if (cursorStart !== undefined && cursorEnd !== undefined) {
    coveredDays += (cursorEnd - cursorStart) / 86_400_000 + 1;
  }
  return coveredDays;
}

export function requiredExperienceDays(
  requirement: ExpectedRequirement,
): number | undefined {
  if (
    requirement.requirement_kind !== "EXPERIENCE" ||
    requirement.constraint.kind !== "MINIMUM_EXPERIENCE_YEARS"
  ) {
    return undefined;
  }
  const years = Number.parseInt(requirement.constraint.value, 10);
  return Number.isSafeInteger(years) && years > 0 ? years * 365 : undefined;
}
