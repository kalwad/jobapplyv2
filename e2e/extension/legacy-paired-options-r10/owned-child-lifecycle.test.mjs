/** Pure lifecycle tests only: no OS child, browser, server or actual evaluation. */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  OWNED_BROWSER_DEADLINE_MS,
  observeOwnedChild,
  waitOwnedChild,
  stopOwnedChild,
  normalContextCloseEvidence,
} from "./owned-child-lifecycle.mjs";
class FakeOwnedChild extends EventEmitter {
  pid = 4242;
  exitCode = null;
  signalCode = null;
  signals = [];
  unreferenced = false;
  action = () => false;
  kill(signal) {
    this.signals.push(signal);
    return this.action(signal);
  }
  unref() {
    this.unreferenced = true;
  }
  exit(code, signal = null) {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
}
const immediateClock = {
  setTimeout(callback) {
    void Promise.resolve().then(callback);
    return 1;
  },
  clearTimeout() {
    return undefined;
  },
};
test("STRUCTURAL_TEST_ONLY browser deadline is finite and remains a timeout", async () => {
  const child = new FakeOwnedChild();
  const observed = observeOwnedChild(child);
  const outcome = await waitOwnedChild(
    observed,
    OWNED_BROWSER_DEADLINE_MS,
    immediateClock,
  );
  assert.equal(OWNED_BROWSER_DEADLINE_MS, 180_000);
  assert.deepEqual(outcome, { state: "DEADLINE_EXCEEDED", outcome: null });
  assert.equal(observed.outcome, undefined);
});
test("STRUCTURAL_TEST_ONLY nonfinite or overflow deadlines refuse", async () => {
  const observed = observeOwnedChild(new FakeOwnedChild());
  for (const value of [0, -1, Infinity, NaN, 180_001])
    await assert.rejects(
      waitOwnedChild(observed, value, immediateClock),
      /FINITE_CHILD_DEADLINE_REQUIRED/,
    );
});
test("STRUCTURAL_TEST_ONLY already exited child needs no signal", async () => {
  const child = new FakeOwnedChild();
  child.exitCode = 0;
  const stopped = await stopOwnedChild(observeOwnedChild(child));
  assert.equal(stopped.state, "ALREADY_EXITED");
  assert.equal(stopped.verified, true);
  assert.deepEqual(child.signals, []);
});
test("STRUCTURAL_TEST_ONLY SIGTERM success requires an actual exit event", async () => {
  const child = new FakeOwnedChild();
  child.action = (signal) => {
    child.exit(null, signal);
    return true;
  };
  const stopped = await stopOwnedChild(observeOwnedChild(child), {
    clock: immediateClock,
  });
  assert.equal(stopped.state, "STOPPED_AFTER_SIGTERM");
  assert.equal(stopped.outcome.signal, "SIGTERM");
  assert.deepEqual(child.signals, ["SIGTERM"]);
  assert.equal(stopped.verified, true);
});
test("STRUCTURAL_TEST_ONLY ignored SIGTERM escalates only owned handle to SIGKILL and waits", async () => {
  const child = new FakeOwnedChild();
  const unrelated = new FakeOwnedChild();
  child.action = (signal) => {
    if (signal === "SIGKILL") child.exit(null, signal);
    return true;
  };
  const stopped = await stopOwnedChild(observeOwnedChild(child), {
    clock: immediateClock,
  });
  assert.equal(stopped.state, "STOPPED_AFTER_SIGKILL");
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
  assert.deepEqual(unrelated.signals, []);
  assert.equal(stopped.verified, true);
});
test("STRUCTURAL_TEST_ONLY unconfirmed SIGKILL is explicit cleanup failure, not success", async () => {
  const child = new FakeOwnedChild();
  const stopped = await stopOwnedChild(observeOwnedChild(child), {
    clock: immediateClock,
  });
  assert.equal(stopped.state, "FAILED_TO_CONFIRM_EXIT");
  assert.equal(stopped.verified, false);
  assert.equal(stopped.handle_unreferenced, true);
  assert.equal(child.unreferenced, true);
  assert.equal(stopped.errors.at(-1).code, "OWNED_CHILD_EXIT_UNCONFIRMED");
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
});
test("STRUCTURAL_TEST_ONLY live process error never falsely proves termination", async () => {
  const child = new FakeOwnedChild();
  const observed = observeOwnedChild(child);
  child.emit("error", new Error("must never persist this exception body"));
  assert.equal(observed.outcome, undefined);
  const stopped = await stopOwnedChild(observed, { clock: immediateClock });
  assert.equal(stopped.verified, false);
  assert.equal(JSON.stringify(stopped).includes("exception body"), false);
});
test("STRUCTURAL_TEST_ONLY spawn failure without PID is recorded without signaling", async () => {
  const child = new FakeOwnedChild();
  child.pid = undefined;
  const observed = observeOwnedChild(child);
  child.emit("error", new Error("private source path"));
  const stopped = await stopOwnedChild(observed);
  assert.equal(stopped.state, "NOT_STARTED");
  assert.equal(stopped.verified, true);
  assert.deepEqual(child.signals, []);
  assert.equal(stopped.errors[0].code, "OWNED_CHILD_PROCESS_ERROR");
});
test("STRUCTURAL_TEST_ONLY successful wait clears deadline timer", async () => {
  const child = new FakeOwnedChild();
  const observed = observeOwnedChild(child);
  let cleared = false;
  const waiting = waitOwnedChild(observed, 1000, {
    setTimeout() {
      return 9;
    },
    clearTimeout(timer) {
      assert.equal(timer, 9);
      cleared = true;
    },
  });
  child.exit(0);
  const result = await waiting;
  assert.equal(result.state, "TERMINAL");
  assert.equal(cleared, true);
});

test("STRUCTURAL_TEST_ONLY runner exit alone never proves browser context cleanup", () => {
  assert.throws(
    () => normalContextCloseEvidence({ complete: true }, "LOCK"),
    /NORMAL_CONTEXT_CLEANUP_UNCONFIRMED/,
  );
});
test("STRUCTURAL_TEST_ONLY normal close evidence keeps OS descendant scope unobserved", () => {
  const artifact = {
    format_version: "W14_PAIRED_OPTIONS_LEGACY_OBSERVATION_1",
    campaign_lock_digest: "LOCK",
    complete: true,
    context_created: true,
    context_cleanup: "VERIFIED_OWNED_CONTEXT_CLOSED",
    profile_cleanup: "VERIFIED_OWNED_PROFILE_REMOVED",
    cleanup_errors: [],
  };
  assert.deepEqual(normalContextCloseEvidence(artifact, "LOCK"), {
    context: "VERIFIED_OWNED_NORMAL_CONTEXT_CLOSE",
    os_browser_descendants: "UNOBSERVED",
  });
  artifact.cleanup_errors.push({ stage: "CONTEXT_CLOSE", name: "Error" });
  assert.throws(
    () => normalContextCloseEvidence(artifact, "LOCK"),
    /NORMAL_CONTEXT_CLEANUP_UNCONFIRMED/,
  );
});
