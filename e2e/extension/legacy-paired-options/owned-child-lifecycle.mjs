/** Bounded lifecycle for direct child handles created by this launcher only. */
export const OWNED_BROWSER_DEADLINE_MS = 180_000;
export const OWNED_CHILD_STOP_DEADLINE_MS = 5_000;
const realClock = {
  setTimeout: (callback, milliseconds) =>
    globalThis.setTimeout(callback, milliseconds),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
};
const safeErrorName = (error) =>
  typeof error?.name === "string" &&
  /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
    ? error.name
    : "Error";
function finiteDeadline(milliseconds) {
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 1 ||
    milliseconds > OWNED_BROWSER_DEADLINE_MS
  )
    throw new Error("PAIRED_OPTIONS_FINITE_CHILD_DEADLINE_REQUIRED");
}

/** An error on a live handle does not prove process termination. */
export function observeOwnedChild(child) {
  let outcome;
  /** @type {(value: { kind: string, code: number | null, signal: string | null }) => void} */
  let finish = () => {
    throw new Error("PAIRED_OPTIONS_CHILD_OBSERVER_NOT_INITIALIZED");
  };
  const errors = [];
  const completion = new Promise((resolve) => {
    finish = (value) => {
      if (outcome !== undefined) return;
      outcome = value;
      resolve(value);
    };
  });
  child.once("exit", (code, signal) =>
    finish({ kind: "EXITED", code, signal }),
  );
  child.on("error", (error) => {
    if (errors.length < 8)
      errors.push({
        code: "OWNED_CHILD_PROCESS_ERROR",
        name: safeErrorName(error),
      });
    if (child.pid === undefined)
      finish({ kind: "NOT_STARTED", code: null, signal: null });
  });
  if (child.exitCode !== null || child.signalCode !== null)
    finish({ kind: "EXITED", code: child.exitCode, signal: child.signalCode });
  return {
    child,
    completion,
    errors,
    get outcome() {
      return outcome;
    },
  };
}

export async function waitOwnedChild(
  observed,
  milliseconds,
  clock = realClock,
) {
  finiteDeadline(milliseconds);
  if (observed.outcome !== undefined)
    return { state: "TERMINAL", outcome: observed.outcome };
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clock.clearTimeout(timer);
      resolve(result);
    };
    timer = clock.setTimeout(
      () => finish({ state: "DEADLINE_EXCEEDED", outcome: null }),
      milliseconds,
    );
    observed.completion.then((outcome) =>
      finish({ state: "TERMINAL", outcome }),
    );
  });
}

/** SIGTERM, bounded wait, SIGKILL, bounded wait; never signal a supplied PID. */
export async function stopOwnedChild(
  observed,
  {
    graceMs = OWNED_CHILD_STOP_DEADLINE_MS,
    killMs = OWNED_CHILD_STOP_DEADLINE_MS,
    clock = realClock,
  } = {},
) {
  finiteDeadline(graceMs);
  finiteDeadline(killMs);
  const result = {
    scope: "OWNED_DIRECT_CHILD_HANDLE_ONLY",
    pid: observed?.child.pid ?? null,
    state: "NOT_CREATED",
    verified: true,
    signals: [],
    errors: [],
    outcome: null,
    handle_unreferenced: false,
  };
  if (observed === undefined) return result;
  const terminal = () => {
    if (observed.outcome === undefined) return false;
    result.outcome = observed.outcome;
    return true;
  };
  if (terminal()) {
    result.state =
      observed.outcome.kind === "NOT_STARTED"
        ? "NOT_STARTED"
        : "ALREADY_EXITED";
    result.errors = [...observed.errors];
    return result;
  }
  if (!Number.isSafeInteger(observed.child.pid) || observed.child.pid < 1) {
    const waited = await waitOwnedChild(observed, graceMs, clock);
    if (waited.state === "TERMINAL") {
      terminal();
      result.state = "NOT_STARTED";
      result.errors = [...observed.errors];
      return result;
    }
    result.errors.push({ code: "OWNED_CHILD_PID_UNCONFIRMED" });
  } else {
    for (const [signal, budget] of [
      ["SIGTERM", graceMs],
      ["SIGKILL", killMs],
    ]) {
      let sent = false;
      try {
        sent = observed.child.kill(signal);
      } catch (error) {
        result.errors.push({
          code: "OWNED_CHILD_SIGNAL_FAILED",
          signal,
          name: safeErrorName(error),
        });
      }
      result.signals.push({ signal, sent });
      const waited = await waitOwnedChild(observed, budget, clock);
      if (waited.state === "TERMINAL") {
        terminal();
        result.state =
          signal === "SIGTERM"
            ? "STOPPED_AFTER_SIGTERM"
            : "STOPPED_AFTER_SIGKILL";
        result.errors.push(...observed.errors);
        return result;
      }
    }
  }
  result.state = "FAILED_TO_CONFIRM_EXIT";
  result.verified = false;
  result.errors.push(...observed.errors, {
    code: "OWNED_CHILD_EXIT_UNCONFIRMED",
  });
  // A failed cleanup must not turn a finite evidence launcher into an endless
  // wait. This releases only the owned handle; it does not claim termination.
  try {
    observed.child.unref();
    result.handle_unreferenced = true;
  } catch (error) {
    result.errors.push({
      code: "OWNED_CHILD_UNREF_FAILED",
      name: safeErrorName(error),
    });
  }
  return result;
}

/** Normal context closure is separate from direct-runner or OS process exit. */
export function normalContextCloseEvidence(artifact, lockDigest) {
  if (
    artifact?.format_version !== "W14_PAIRED_OPTIONS_LEGACY_OBSERVATION_1" ||
    artifact.campaign_lock_digest !== lockDigest ||
    artifact.complete !== true ||
    artifact.context_created !== true ||
    artifact.context_cleanup !== "VERIFIED_OWNED_CONTEXT_CLOSED" ||
    artifact.profile_cleanup !== "VERIFIED_OWNED_PROFILE_REMOVED" ||
    !Array.isArray(artifact.cleanup_errors) ||
    artifact.cleanup_errors.length !== 0
  )
    throw new Error("PAIRED_OPTIONS_NORMAL_CONTEXT_CLEANUP_UNCONFIRMED");
  return {
    context: "VERIFIED_OWNED_NORMAL_CONTEXT_CLOSE",
    os_browser_descendants: "UNOBSERVED",
  };
}
