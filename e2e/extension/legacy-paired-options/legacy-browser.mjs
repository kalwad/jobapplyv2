/* global chrome, window */
import process from "node:process";
/** Fresh bundled-Chromium legacy component run, only after explicit approval. */
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, isAbsolute, relative } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tmpdir } from "node:os";
import {
  loadCampaign,
  canonicalSha,
  canonical,
  sha,
  here,
  requireNativeAudit,
} from "./campaign.mjs";
if (process.env.JAPP_W14_PAIRED_OPTIONS_EVALUATION !== "1")
  throw new Error("PAIRED_OPTIONS_EXPLICIT_OPT_IN_REQUIRED");
const legacyRoot = process.env.JAPP_W14_PAIRED_LEGACY_ROOT;
const output = process.env.JAPP_W14_PAIRED_LEGACY_OUTPUT;
const candidateRoot = process.env.JAPP_W14_PAIRED_CANDIDATE_ROOT;
const playwrightModule = process.env.JAPP_W14_PAIRED_PLAYWRIGHT_MODULE;
if (
  ![legacyRoot, candidateRoot, output, playwrightModule].every(
    (value) => typeof value === "string" && isAbsolute(value),
  )
)
  throw new Error("PAIRED_OPTIONS_ABSOLUTE_RUNTIME_PATHS_REQUIRED");
const inside = relative(here, output);
if (
  inside === "" ||
  (!inside.startsWith("..") && !isAbsolute(inside)) ||
  existsSync(output)
)
  throw new Error("PAIRED_OPTIONS_FRESH_OUTSIDE_OUTPUT_REQUIRED");
const runtimeNonce = process.env.JAPP_W14_PAIRED_RUNTIME_NONCE;
if (runtimeNonce === undefined || !/^[0-9a-f-]{36}$/.test(runtimeNonce))
  throw new Error("PAIRED_OPTIONS_OWNED_SERVER_NONCE_REQUIRED");
const campaign = loadCampaign({ legacyRoot, candidateRoot });
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const { installW14NativeWitness, nativeMutationWitnesses } = await import(
  pathToFileURL(
    join(candidateRoot, campaign.bindings.native_observer.helper_path),
  ).href
);
const base = "http://127.0.0.1:18886";
// A wrong/stale server is rejected before launching the browser.
const bindingResponse = await globalThis.fetch(base + "/evaluation/binding", {
  signal: globalThis.AbortSignal.timeout(5000),
});
if (!bindingResponse.ok)
  throw new Error("PAIRED_OPTIONS_SERVER_BINDING_UNAVAILABLE");
const serverBinding = await bindingResponse.json();
if (
  serverBinding.runtime_nonce !== runtimeNonce ||
  serverBinding.campaign_lock_digest !== campaign.lock_digest ||
  canonical(serverBinding.input_digests) !==
    canonical(campaign.bindings.cases.map((row) => row.input_digest)) ||
  canonical(serverBinding.legacy_projections) !==
    canonical(campaign.projections)
)
  throw new Error("PAIRED_OPTIONS_SERVER_BINDING_MISMATCH");
mkdirSync(output);
const profile = mkdtempSync(join(tmpdir(), "japp-paired-legacy-browser."));
const artifactPath = join(output, "paired-options-legacy.json");
const artifact = {
  format_version: "W14_PAIRED_OPTIONS_LEGACY_OBSERVATION_1",
  authority: "NONE",
  gate_pass: false,
  mode: "UNMODIFIED_SHARED_LEGACY_COMPONENT_DETERMINISTIC_NO_AI",
  campaign_lock_digest: campaign.lock_digest,
  source_bindings_digest: sha(readFileSync(join(here, "source-bindings.json"))),
  legacy_identity: campaign.bindings.legacy_source_identity,
  input_digests: campaign.bindings.cases.map((row) => row.input_digest),
  legacy_projections: campaign.projections,
  browser_version: "UNOBSERVED",
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  started_at: new Date().toISOString(),
  ended_at: null,
  controlled_rerender_delay_ms: 20,
  meter_function_digest: campaign.bindings.meter_function_sha256,
  document_wrapper:
    "<!doctype html><html><head><meta charset=utf-8></head><body>HTML</body></html>",
  origins: {
    legacy: base,
    candidate: campaign.bindings.current_origin,
    equal: false,
  },
  server_binding: serverBinding,
  results: [],
  observed_requests: [],
  refused_requests: [],
  errors: [],
  cleanup_errors: [],
  context_created: false,
  context_cleanup: "UNOBSERVED",
  profile_cleanup: "UNOBSERVED",
  source_stability: "UNOBSERVED",
  complete: false,
  acceptance: null,
  native_observer_actor: "UNMODIFIED_LEGACY_MV3",
  native_observer_helper_digest:
    campaign.bindings.native_observer.helper_sha256,
  observation_scope: {
    input_change: "EVENT_WITNESSES_ONLY",
    final_native: "OBSERVED_PER_COMPLETED_ROW",
    transient_eventless_writes:
      "INSTALLED_ACTUAL_EXTENSION_REALM_NATIVE_SURFACES_ONLY",
    site_acceptance:
      "UNOBSERVED_LEGACY_INTERFACE_NO_INDEPENDENT_ACCEPTANCE_OBSERVER",
  },
  limitations: campaign.bindings.limitations,
};
const finalize = () => {
  const bytes = JSON.stringify(artifact, null, 2) + "\n";
  writeFileSync(artifactPath, bytes);
  writeFileSync(
    join(output, "paired-options-legacy.digest.txt"),
    sha(bytes) + "\n",
  );
};
let context;
finalize();
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    args: [
      "--disable-extensions-except=" + join(legacyRoot, "extension"),
      "--load-extension=" + join(legacyRoot, "extension"),
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
    ],
  });
  artifact.context_created = true;
  artifact.browser_version = context.browser()?.version() ?? "UNOBSERVED";
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const allowed =
      ["about:", "chrome:", "chrome-extension:", "blob:", "data:"].includes(
        url.protocol,
      ) ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname) &&
        url.port === "18886");
    if (!allowed) {
      artifact.refused_requests.push({
        method: request.method(),
        origin: url.origin,
        path_digest: sha(url.pathname + url.search),
      });
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  context.on("request", (request) => {
    const url = new URL(request.url());
    artifact.observed_requests.push({
      method: request.method(),
      origin: url.origin,
      path_digest: sha(url.pathname + url.search),
    });
  });
  const meter = readFileSync(
    join(here, "preimages/legacy-meter-function.txt"),
    "utf8",
  );
  await context.addInitScript({ content: `(${meter})(20);` });
  const worker =
    context
      .serviceWorkers()
      .find((item) => item.url().startsWith("chrome-extension://")) ??
    (await context.waitForEvent("serviceworker", {
      predicate: (item) => item.url().startsWith("chrome-extension://"),
      timeout: 30_000,
    }));
  artifact.worker = {
    url: worker.url(),
    extension_id: new URL(worker.url()).hostname,
  };
  await worker.evaluate(async () => {
    await chrome.storage.local.set({ serverUrl: "http://localhost:18886" });
  });
  for (const [index, entry] of campaign.inputs.entries()) {
    const row = {
      case_id: entry.case_id,
      fixture_id: entry.fixture_id,
      input_digest: canonicalSha(entry.input),
      html_digest: sha(entry.input.html),
      profile_digest: canonicalSha(entry.input.profile),
      profile_input: entry.input.profile,
      legacy_projection: campaign.projections[index],
      status: "INCOMPLETE",
      initial: "UNOBSERVED",
      fields: "UNOBSERVED",
      physical: "UNOBSERVED",
      response: "UNOBSERVED",
      action_observation: "NOT_STARTED",
      native_before: "UNOBSERVED",
      native_witness: "UNOBSERVED",
      unexpected_native_mutations: "UNOBSERVED",
      errors: [],
    };
    artifact.results.push(row);
    finalize();
    let page;
    let nativeHandle;
    try {
      page = await context.newPage();
      await page.goto(base + "/fixture/" + String(index));
      await page.waitForTimeout(750);
      const fields = () =>
        page
          .locator(
            "[data-japp-application-root] input,[data-japp-application-root] select,[data-japp-application-root] textarea",
          )
          .evaluateAll((nodes) =>
            nodes.map((node) => ({
              key: node.id,
              value: node.value,
              checked: node.checked ?? null,
              valid: node.validity.valid,
              aria_invalid: node.getAttribute("aria-invalid"),
            })),
          );
      row.initial = await fields();
      await page.bringToFront();
      nativeHandle = await installW14NativeWitness(
        context,
        page,
        artifact.worker.extension_id,
      );
      row.native_before = await nativeHandle.snapshot();
      requireNativeAudit(row.native_before, campaign);
      row.action_observation = "INTENT_RECORDED_RESULT_UNOBSERVED";
      finalize();
      const start = globalThis.performance.now();
      row.response = await worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        const tab = tabs.length === 1 ? tabs[0] : null;
        if (!tab?.id)
          throw new Error("PAIRED_OPTIONS_LEGACY_FIXTURE_TAB_MISSING");
        return chrome.tabs.sendMessage(tab.id, { type: "startFill" });
      });
      row.action_observation = "RESULT_RECEIVED";
      finalize();
      row.elapsed_ms_descriptive_only = globalThis.performance.now() - start;
      await page.waitForTimeout(150);
      row.fields = await fields();
      row.physical = await page.evaluate(() => window.legacyPhysicalMeter);
      row.native_witness = await nativeHandle.snapshot();
      requireNativeAudit(row.native_witness, campaign);
      const ordinary = new Set(
        campaign.bindings.cases[index].ordinary_expectations.map(
          (item) => item.key,
        ),
      );
      row.unexpected_native_mutations = nativeMutationWitnesses(
        row.native_witness,
      ).filter((item) => !ordinary.has(item.key));
      row.native_observer_actor = "UNMODIFIED_LEGACY_MV3";
      row.native_observer_helper_digest =
        campaign.bindings.native_observer.helper_sha256;
      row.status = "OBSERVED";
      row.measurement_limits = {
        site_acceptance: "UNOBSERVED",
        eventless_transient_writes:
          "INSTALLED_ACTUAL_EXTENSION_REALM_NATIVE_SURFACES_ONLY",
        post_rerender:
          "FINAL_NATIVE_SNAPSHOT_WITH_LITERAL_20MS_REPLACEMENT_AND_150MS_SETTLE",
      };
    } catch (error) {
      row.errors.push({
        stage: "ROW_MEASUREMENT",
        name: error.name ?? "Error",
        code: /^(W14_NATIVE_|PAIRED_OPTIONS_)/.test(error.message ?? "")
          ? error.message
          : "ROW_ERROR",
      });
      if (page !== undefined) {
        try {
          row.physical = await page.evaluate(() => window.legacyPhysicalMeter);
        } catch {
          /* Remains explicit UNOBSERVED. */
        }
      }
    } finally {
      if (nativeHandle !== undefined) {
        try {
          await nativeHandle.dispose();
        } catch (error) {
          row.errors.push({
            stage: "NATIVE_OBSERVER_DISPOSE",
            name: error.name ?? "Error",
          });
        }
      }
      if (page !== undefined) {
        try {
          await page.close();
        } catch (error) {
          row.errors.push({
            stage: "PAGE_CLEANUP",
            name: error.name ?? "Error",
          });
        }
      }
      finalize();
    }
  }
} catch (error) {
  artifact.errors.push({
    stage: context === undefined ? "LAUNCH" : "CAMPAIGN",
    name: error.name ?? "Error",
  });
} finally {
  if (context !== undefined) {
    try {
      await context.close();
      artifact.context_cleanup = "VERIFIED_OWNED_CONTEXT_CLOSED";
    } catch (error) {
      artifact.context_cleanup = "FAILED";
      artifact.cleanup_errors.push({
        stage: "CONTEXT_CLOSE",
        name: error.name ?? "Error",
      });
    }
  } else {
    artifact.context_cleanup = "NOT_CREATED";
  }
  try {
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
    artifact.profile_cleanup = "VERIFIED_OWNED_PROFILE_REMOVED";
  } catch (error) {
    artifact.profile_cleanup = "FAILED";
    artifact.cleanup_errors.push({
      stage: "PROFILE_REMOVE",
      name: error.name ?? "Error",
    });
  }
  try {
    loadCampaign({ legacyRoot, candidateRoot });
    artifact.source_stability = true;
  } catch {
    artifact.source_stability = false;
    artifact.errors.push({ stage: "END_SOURCE_BINDING", name: "SOURCE_DRIFT" });
  }
  artifact.ended_at = new Date().toISOString();
  artifact.complete =
    artifact.results.length === 4 &&
    artifact.results.every(
      (row) => row.status === "OBSERVED" && row.errors.length === 0,
    ) &&
    artifact.errors.length === 0 &&
    artifact.cleanup_errors.length === 0 &&
    artifact.context_created &&
    artifact.context_cleanup === "VERIFIED_OWNED_CONTEXT_CLOSED" &&
    artifact.profile_cleanup === "VERIFIED_OWNED_PROFILE_REMOVED" &&
    artifact.source_stability === true;
  finalize();
}
globalThis.console.log(
  JSON.stringify({
    artifact: artifactPath,
    complete: artifact.complete,
    rows: artifact.results.length,
    campaign_lock_digest: artifact.campaign_lock_digest,
  }),
);
if (!artifact.complete) process.exitCode = 1;
