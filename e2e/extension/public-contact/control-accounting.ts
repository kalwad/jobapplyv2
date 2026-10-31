/** Pure accounting of both physical snapshots; these deltas do not prove cause. */
import { sha256Canonical } from "../../../packages/evaluation-runner/src/canonical.ts";
import type { LiteralMatch, PhysicalControl } from "./contact-harness.ts";

type TopologyReason =
  | "INITIAL_UNOBSERVED"
  | "FINAL_UNOBSERVED"
  | "AMBIGUOUS_INITIAL_IDENTITY"
  | "AMBIGUOUS_FINAL_IDENTITY";
interface ControlObservation {
  match: LiteralMatch;
  positive: boolean;
  before: PhysicalControl[];
  final: PhysicalControl[];
  state: "MATCHED_UNIQUE_LITERAL" | "UNMEASURABLE_TOPOLOGY";
  reasons: TopologyReason[];
  value_delta: "CHANGED" | "UNCHANGED" | "UNOBSERVED";
  extension_write_causality: "UNOBSERVED";
}
export interface ControlChange {
  before_indices: number[];
  final_indices: number[];
  state: "CHANGED" | "UNMEASURABLE_TOPOLOGY";
  reasons: TopologyReason[];
  positive: boolean;
  extension_write_causality: "UNOBSERVED";
}
export interface ControlAccounting {
  identity_scope: "UNIQUE_LITERAL_MATCH_SNAPSHOT_UNION";
  topology_state: "COMPLETE_UNIQUE_LITERAL_UNION" | "UNMEASURABLE_TOPOLOGY";
  precision_eligible: boolean;
  initial_controls: number;
  final_controls: number;
  matched_unique_controls: number;
  unmeasurable_topology_groups: number;
  unmeasurable_snapshot_control_observations: number;
  observations: ControlObservation[];
  changes: ControlChange[];
}

/** A final-only value has no observed initial value and is never called a write. */
export function accountControlUnion(
  before: readonly PhysicalControl[],
  final: readonly PhysicalControl[],
  positives: readonly LiteralMatch[],
): ControlAccounting {
  const groups = new Map<
    string,
    { match: LiteralMatch; before: PhysicalControl[]; final: PhysicalControl[] }
  >();
  for (const [side, controls] of [
    ["before", before],
    ["final", final],
  ] as const) {
    for (const control of controls) {
      const key = sha256Canonical(control.match);
      let group = groups.get(key);
      if (group === undefined) {
        group = { match: control.match, before: [], final: [] };
        groups.set(key, group);
      }
      group[side].push(control);
    }
  }
  const positiveKeys = new Set<string>(
    positives.map((match) => sha256Canonical(match)),
  );
  const observations: ControlObservation[] = [...groups].map(([key, group]) => {
    const reasons: TopologyReason[] = [];
    if (group.before.length === 0) reasons.push("INITIAL_UNOBSERVED");
    if (group.final.length === 0) reasons.push("FINAL_UNOBSERVED");
    if (group.before.length > 1) reasons.push("AMBIGUOUS_INITIAL_IDENTITY");
    if (group.final.length > 1) reasons.push("AMBIGUOUS_FINAL_IDENTITY");
    const initial = group.before[0];
    const settled = group.final[0];
    const matched =
      reasons.length === 0 && initial !== undefined && settled !== undefined;
    return {
      ...group,
      positive: positiveKeys.has(key),
      state: matched ? "MATCHED_UNIQUE_LITERAL" : "UNMEASURABLE_TOPOLOGY",
      reasons,
      value_delta: !matched
        ? "UNOBSERVED"
        : initial.value_digest !== settled.value_digest ||
            initial.checked !== settled.checked
          ? "CHANGED"
          : "UNCHANGED",
      extension_write_causality: "UNOBSERVED",
    };
  });
  const unknown = observations.filter(
    (item) => item.state === "UNMEASURABLE_TOPOLOGY",
  );
  return {
    identity_scope: "UNIQUE_LITERAL_MATCH_SNAPSHOT_UNION",
    topology_state:
      unknown.length === 0
        ? "COMPLETE_UNIQUE_LITERAL_UNION"
        : "UNMEASURABLE_TOPOLOGY",
    precision_eligible: unknown.length === 0,
    initial_controls: before.length,
    final_controls: final.length,
    matched_unique_controls: observations.length - unknown.length,
    unmeasurable_topology_groups: unknown.length,
    unmeasurable_snapshot_control_observations: unknown.reduce(
      (count, item) => count + item.before.length + item.final.length,
      0,
    ),
    observations,
    changes: observations.flatMap((item): ControlChange[] =>
      item.value_delta === "UNCHANGED"
        ? []
        : [
            {
              before_indices: item.before.map((control) => control.index),
              final_indices: item.final.map((control) => control.index),
              state:
                item.state === "UNMEASURABLE_TOPOLOGY"
                  ? "UNMEASURABLE_TOPOLOGY"
                  : "CHANGED",
              reasons: item.reasons,
              positive: item.positive,
              extension_write_causality: "UNOBSERVED",
            },
          ],
    ),
  };
}

export interface ContactMeasuredRow {
  source?: { ats: string };
  evaluation_state?: string;
  positive_scores?: { state: string; required: boolean }[];
  changes?: ControlChange[];
  control_accounting?: ControlAccounting;
  before_measurements?: unknown[];
  final_measurements?: unknown[];
  action_phase_events?: {
    click?: number | null;
    submit?: number | null;
  } | null;
  action_phase_navigations?: number | null;
  safety_observation?: string;
}

export function hasCompleteControlCoverage(row: ContactMeasuredRow): boolean {
  return (
    row.before_measurements !== undefined &&
    row.final_measurements !== undefined &&
    row.control_accounting?.topology_state ===
      "COMPLETE_UNIQUE_LITERAL_UNION" &&
    row.control_accounting.precision_eligible &&
    row.control_accounting.initial_controls ===
      row.before_measurements.length &&
    row.control_accounting.final_controls === row.final_measurements.length
  );
}

/** Full-row metrics stay unknown if any physical identity is unmeasurable. */
export function contactDomMetrics(items: readonly ContactMeasuredRow[]) {
  const scores = items.flatMap((row) => row.positive_scores ?? []);
  const changes = items.flatMap((row) => row.changes ?? []);
  const complete =
    items.length > 0 &&
    items.every(hasCompleteControlCoverage) &&
    items.every((row) => row.positive_scores !== undefined);
  const correct = scores.filter(
    (score) => score.state === "INTENDED_RETAINED",
  ).length;
  const required = scores.filter(
    (score) =>
      score.required &&
      ["INTENDED_RETAINED", "MISSING_OR_WRONG"].includes(score.state),
  );
  const requiredCorrect = required.filter(
    (score) => score.state === "INTENDED_RETAINED",
  ).length;
  const changed = changes.filter((change) => change.state === "CHANGED").length;
  const unexpected = changes.filter(
    (change) => change.state === "CHANGED" && !change.positive,
  ).length;
  return {
    source_pages: items.length,
    complete_topology_rows: items.filter(hasCompleteControlCoverage).length,
    incomplete_topology_rows: items.filter(
      (row) => !hasCompleteControlCoverage(row),
    ).length,
    dom_value_precision_eligibility:
      items.length === 0
        ? "UNOBSERVED_NO_ROWS"
        : complete
          ? "ELIGIBLE_COMPLETE_LITERAL_TOPOLOGY"
          : "INELIGIBLE_INCOMPLETE_TOPOLOGY_OR_SCORES",
    expected_positive_controls: scores.length,
    initially_empty_required_controls: required.length,
    intended_contact_values_retained: correct,
    required_values_retained: requiredCorrect,
    known_matched_physical_changes: changed,
    observed_physical_changes: complete ? changed : null,
    dom_value_known_matched_subset_precision:
      changed === 0 ? null : correct / changed,
    dom_value_precision: !complete || changed === 0 ? null : correct / changed,
    dom_value_required_recall:
      !complete ||
      scores.some(
        (score) => score.required && score.state === "UNMEASURABLE_IDENTITY",
      ) ||
      required.length === 0
        ? null
        : requiredCorrect / required.length,
    dom_value_known_matched_subset_required_recall:
      required.length === 0 ? null : requiredCorrect / required.length,
    unmeasurable_topology_groups: items.reduce(
      (count, row) =>
        count + (row.control_accounting?.unmeasurable_topology_groups ?? 0),
      0,
    ),
    unmeasurable_snapshot_control_observations: items.reduce(
      (count, row) =>
        count +
        (row.control_accounting?.unmeasurable_snapshot_control_observations ??
          0),
      0,
    ),
    unknown_topology_rows: items.filter(
      (row) => row.control_accounting === undefined,
    ).length,
    known_unexpected_nonpositive_changes: unexpected,
    unexpected_nonpositive_changes: complete ? unexpected : null,
    prefilled_preserved: scores.filter(
      (score) => score.state === "PREFILLED_PRESERVED",
    ).length,
    prefilled_changed: scores.filter(
      (score) => score.state === "PREFILLED_CHANGED",
    ).length,
  };
}
