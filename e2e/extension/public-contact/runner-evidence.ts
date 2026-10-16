/** Pure lifecycle/evidence fences. All browser and filesystem effects are ports. */
export type RunnerEvidenceRow = Record<string, unknown>;
export type RunnerFailureStage =
  "LAUNCH" | "OBSERVATION" | "CLEANUP" | "ERROR_SNAPSHOT" | "ROW_JOURNAL";
export interface RunnerFailure {
  stage: RunnerFailureStage;
  code: "TIMEOUT" | "OPERATION_FAILED";
}
const failure = (stage: RunnerFailureStage, error: unknown): RunnerFailure => ({
  stage,
  code:
    error instanceof Error && error.name === "TimeoutError"
      ? "TIMEOUT"
      : "OPERATION_FAILED",
});

/** These are document-capture observations, never a complete composed-tree count. */
export function actionObservationSnapshot(
  events: Readonly<Record<string, number>>,
  baseline: Readonly<Record<string, number>> | null,
  actionPhaseStarted: boolean,
  navigations: number,
) {
  const known = actionPhaseStarted && baseline !== null;
  const deltas = Object.fromEntries(
    ["input", "change", "click", "submit"].map((kind) => {
      const current = events[kind];
      const before = baseline?.[kind];
      return [
        kind,
        known &&
        typeof current === "number" &&
        typeof before === "number" &&
        Number.isSafeInteger(current) &&
        Number.isSafeInteger(before) &&
        current >= before
          ? current - before
          : null,
      ];
    }),
  );
  return {
    action_phase_started: actionPhaseStarted,
    action_phase_events: known ? deltas : null,
    action_phase_navigations:
      known && Number.isSafeInteger(navigations) && navigations >= 0
        ? navigations
        : null,
    event_counter_scope: "DOCUMENT_CAPTURE_ONLY",
    composed_tree_event_coverage: "UNOBSERVED_NONCOMPOSED_OPEN_ROOT_EVENTS",
    safety_observation: "INCOMPLETE",
  } as const;
}

/**
 * A launch, observation, cleanup or row-journal failure becomes a durable-attempt
 * error row. The caller must stop new actions when can_continue is false.
 * Snapshot ports must contain only sanitized observations, not exception text.
 */
export async function captureRunnerPage<Session>(ports: {
  source: unknown;
  launch(): Promise<Session>;
  observe(session: Session): Promise<RunnerEvidenceRow>;
  snapshot(session: Session | undefined): RunnerEvidenceRow;
  cleanup(session: Session): Promise<void>;
  writeRow(row: RunnerEvidenceRow): void | Promise<void>;
}) {
  let session: Session | undefined;
  let row: RunnerEvidenceRow = { source: ports.source };
  const failures: RunnerFailure[] = [];
  const incomplete = () => {
    try {
      row = { ...row, ...ports.snapshot(session) };
    } catch (error) {
      failures.push(failure("ERROR_SNAPSHOT", error));
    }
    row = {
      ...row,
      source: ports.source,
      evaluation_state: "UNOBSERVED_ERROR",
      safety_observation: "INCOMPLETE",
      natural_site_acceptance: null,
      lifecycle_errors: [...failures],
    };
  };
  try {
    session = await ports.launch();
  } catch (error) {
    failures.push(failure("LAUNCH", error));
    incomplete();
  }
  if (session !== undefined) {
    try {
      row = await ports.observe(session);
    } catch (error) {
      failures.push(failure("OBSERVATION", error));
      incomplete();
    }
    try {
      await ports.cleanup(session);
    } catch (error) {
      failures.push(failure("CLEANUP", error));
      incomplete();
    }
  }
  try {
    await ports.writeRow(row);
  } catch (error) {
    failures.push(failure("ROW_JOURNAL", error));
    incomplete();
  }
  return { row, failures, can_continue: failures.length === 0 };
}

export interface RunnerFinalization<EndBinding> {
  end_binding: EndBinding | null;
  integrity_error:
    | "SOURCE_BUILD_OR_ORACLE_CHANGED"
    | "END_SOURCE_BUILD_OR_ORACLE_BINDING_UNAVAILABLE"
    | null;
  write_failures: { artifact: string; code: "EVIDENCE_WRITE_FAILED" }[];
}

/** Attempt every final artifact even when end binding or an earlier write fails. */
export async function finalizeRunnerEvidence<EndBinding>(ports: {
  readEndBinding(): EndBinding | Promise<EndBinding>;
  matchesStartBinding(value: EndBinding): boolean;
  writes: readonly {
    artifact: string;
    write(state: RunnerFinalization<EndBinding>): void | Promise<void>;
  }[];
}): Promise<RunnerFinalization<EndBinding>> {
  const state: RunnerFinalization<EndBinding> = {
    end_binding: null,
    integrity_error: null,
    write_failures: [],
  };
  try {
    state.end_binding = await ports.readEndBinding();
    if (!ports.matchesStartBinding(state.end_binding))
      state.integrity_error = "SOURCE_BUILD_OR_ORACLE_CHANGED";
  } catch {
    state.integrity_error = "END_SOURCE_BUILD_OR_ORACLE_BINDING_UNAVAILABLE";
  }
  for (const writer of ports.writes) {
    try {
      await writer.write({
        ...state,
        write_failures: [...state.write_failures],
      });
    } catch {
      state.write_failures.push({
        artifact: writer.artifact,
        code: "EVIDENCE_WRITE_FAILED",
      });
    }
  }
  return state;
}
