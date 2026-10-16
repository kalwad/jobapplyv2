/** Owns only this run's loopback server and bundled-browser child processes. */
import process from "node:process";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
} from "node:fs";
import { join, isAbsolute } from "node:path";
import { here, loadCampaign, sha } from "./campaign.mjs";
import {
  OWNED_BROWSER_DEADLINE_MS,
  OWNED_CHILD_STOP_DEADLINE_MS,
  observeOwnedChild,
  waitOwnedChild,
  stopOwnedChild,
  normalContextCloseEvidence,
} from "./owned-child-lifecycle.mjs";
if (process.env.JAPP_W14_PAIRED_OPTIONS_EVALUATION !== "1")
  throw new Error("PAIRED_OPTIONS_EXPLICIT_OPT_IN_REQUIRED");
const python = process.env.JAPP_W14_PAIRED_PYTHON;
const legacyRoot = process.env.JAPP_W14_PAIRED_LEGACY_ROOT;
const candidateRoot = process.env.JAPP_W14_PAIRED_CANDIDATE_ROOT;
const output = process.env.JAPP_W14_PAIRED_LEGACY_OUTPUT;
if (
  ![python, legacyRoot, candidateRoot, output].every(
    (value) => typeof value === "string" && isAbsolute(value),
  )
)
  throw new Error("PAIRED_OPTIONS_ABSOLUTE_PATHS_REQUIRED");
if (!existsSync(python) || existsSync(output))
  throw new Error("PAIRED_OPTIONS_RUNTIME_OR_FRESH_OUTPUT_REQUIRED");
const campaign = loadCampaign({ legacyRoot, candidateRoot });
// Reserve/check the fixed loopback address. Occupancy fails without connecting
// to or terminating the unknown service. A subsequent bind race also fails.
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen({ host: "127.0.0.1", port: 18886, exclusive: true }, () =>
    resolve(undefined),
  );
});
await new Promise((resolve, reject) =>
  probe.close((error) => (error ? reject(error) : resolve())),
);
const nonce = randomUUID();
const env = { ...process.env, JAPP_W14_PAIRED_RUNTIME_NONCE: nonce };
const record = {
  format_version: "W14_PAIRED_OPTIONS_OWNED_RUN_1",
  authority: "NONE",
  campaign_lock_digest: campaign.lock_digest,
  runtime_nonce: nonce,
  started_at: new Date().toISOString(),
  server_pid: null,
  server_ready: false,
  browser_pid: null,
  browser_deadline_ms: OWNED_BROWSER_DEADLINE_MS,
  child_stop_deadline_ms: OWNED_CHILD_STOP_DEADLINE_MS,
  browser_wait_state: "UNOBSERVED",
  browser_exit_code: null,
  browser_exit_signal: null,
  browser_process_errors: [],
  browser_context_cleanup: "UNOBSERVED",
  browser_descendant_processes: "UNOBSERVED",
  normal_browser_artifact_digest: null,
  server_cleanup: null,
  browser_cleanup: null,
  errors: [],
  cleanup: "UNOBSERVED",
  complete: false,
};
const controlPath = output + ".control.json";
if (existsSync(controlPath))
  throw new Error("PAIRED_OPTIONS_FRESH_CONTROL_OUTPUT_REQUIRED");
writeFileSync(controlPath, JSON.stringify(record, null, 2) + "\n", {
  flag: "wx",
});
let log;
let server;
let serverObserved;
let browserObserved;
try {
  log = openSync(output + ".server.log", "wx");
  server = spawn(python, [join(here, "legacy-server.py")], {
    cwd: legacyRoot,
    env,
    stdio: ["ignore", log, log],
  });
  record.server_pid = server.pid ?? null;
  serverObserved = observeOwnedChild(server);
  const deadline = globalThis.performance.now() + 15_000;
  while (globalThis.performance.now() < deadline) {
    if (serverObserved.outcome !== undefined)
      throw new Error("PAIRED_OPTIONS_OWNED_SERVER_EXITED");
    try {
      const response = await globalThis.fetch(
        "http://127.0.0.1:18886/evaluation/binding",
        { signal: globalThis.AbortSignal.timeout(500) },
      );
      if (response.ok) {
        const binding = await response.json();
        if (
          binding.runtime_nonce !== nonce ||
          binding.campaign_lock_digest !== campaign.lock_digest
        )
          throw new Error("PAIRED_OPTIONS_OWNED_SERVER_BINDING_MISMATCH");
        record.server_ready = true;
        break;
      }
    } catch (error) {
      if (error.message === "PAIRED_OPTIONS_OWNED_SERVER_BINDING_MISMATCH")
        throw error;
    }
    await delay(100);
  }
  if (!record.server_ready)
    throw new Error("PAIRED_OPTIONS_OWNED_SERVER_STARTUP_TIMEOUT");
  const browser = spawn(process.execPath, [join(here, "legacy-browser.mjs")], {
    cwd: here,
    env,
    stdio: "inherit",
  });
  record.browser_pid = browser.pid ?? null;
  browserObserved = observeOwnedChild(browser);
  const browserWait = await waitOwnedChild(
    browserObserved,
    OWNED_BROWSER_DEADLINE_MS,
  );
  record.browser_wait_state = browserWait.state;
  record.browser_process_errors = [...browserObserved.errors];
  if (browserWait.state === "DEADLINE_EXCEEDED")
    throw new Error("PAIRED_OPTIONS_BROWSER_RUN_TIMEOUT");
  const browserOutcome = browserWait.outcome;
  record.browser_exit_code = browserOutcome.code ?? null;
  record.browser_exit_signal = browserOutcome.signal ?? null;
  if (
    browserOutcome.kind !== "EXITED" ||
    browserOutcome.code !== 0 ||
    browserOutcome.signal ||
    browserObserved.errors.length > 0
  )
    throw new Error("PAIRED_OPTIONS_BROWSER_RUN_FAILED");
  const raw = readFileSync(join(output, "paired-options-legacy.json"));
  const evidence = normalContextCloseEvidence(
    JSON.parse(raw.toString("utf8")),
    campaign.lock_digest,
  );
  record.normal_browser_artifact_digest = sha(raw);
  record.browser_context_cleanup = evidence.context;
  record.browser_descendant_processes = evidence.os_browser_descendants;
} catch (error) {
  record.errors.push({
    name: typeof error?.name === "string" ? error.name : "Error",
    code:
      typeof error?.message === "string" &&
      error.message.startsWith("PAIRED_OPTIONS_")
        ? error.message.slice(0, 256)
        : "OWNED_RUN_ERROR",
  });
} finally {
  record.browser_cleanup = await stopOwnedChild(browserObserved);
  record.server_cleanup = await stopOwnedChild(serverObserved);
  for (const [role, cleanup] of [
    ["browser", record.browser_cleanup],
    ["server", record.server_cleanup],
  ]) {
    if (!cleanup.verified || cleanup.errors.length > 0)
      record.errors.push({
        name: "CleanupError",
        code: "PAIRED_OPTIONS_OWNED_CHILD_CLEANUP_FAILED",
        role,
      });
  }
  try {
    if (log !== undefined) closeSync(log);
  } catch {
    record.errors.push({
      name: "CleanupError",
      code: "PAIRED_OPTIONS_SERVER_LOG_CLOSE_FAILED",
    });
  }
  record.cleanup =
    record.browser_cleanup.verified && record.server_cleanup.verified
      ? "OWNED_DIRECT_CHILD_EXIT_VERIFIED"
      : "OWNED_CHILD_EXIT_UNCONFIRMED";
  record.ended_at = new Date().toISOString();
  record.complete =
    record.server_ready &&
    record.browser_exit_code === 0 &&
    record.errors.length === 0;
  writeFileSync(controlPath, JSON.stringify(record, null, 2) + "\n");
}
globalThis.console.log(
  JSON.stringify({ control: controlPath, complete: record.complete }),
);
if (!record.complete) process.exitCode = 1;
