import { test } from "node:test";
import process from "node:process";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as path from "node:path";
import * as url from "node:url";

const actor = process.env.R10_ACTOR_SOURCE;
if (!actor) throw new Error("R10_ACTOR_SOURCE_REQUIRED");
const source = readFileSync(actor, "utf8");
const sha = (value) => "sha256:" + String(value);
async function exercise({
  rejectWrites = [],
  rejectLaunch = false,
  rejectRoute = false,
  rejectClose = false,
  rejectRemove = false,
} = {}) {
  const calls = [];
  const writes = [];
  const logs = [];
  const processStub = {
    env: {
      JAPP_W14_PAIRED_OPTIONS_EVALUATION: "1",
      JAPP_W14_PAIRED_LEGACY_ROOT: "/legacy",
      JAPP_W14_PAIRED_CANDIDATE_ROOT: "/candidate",
      JAPP_W14_PAIRED_LEGACY_OUTPUT: "/outside/evidence",
      JAPP_W14_PAIRED_PLAYWRIGHT_MODULE: "/playwright/index.mjs",
      JAPP_W14_PAIRED_RUNTIME_NONCE: "12345678-1234-1234-1234-123456789abc",
    },
    version: "v24.18.0",
    platform: "darwin",
    arch: "arm64",
  };
  const campaign = {
    lock_digest: "sha256:lock",
    inputs: [],
    projections: [],
    bindings: {
      cases: [],
      current_origin: "http://127.0.0.1:4761",
      native_observer: {
        helper_path: "e2e/extension/support/autofill-w14-native-witness.ts",
        helper_sha256: "sha256:helper",
      },
      limitations: [],
      legacy_source_identity: {},
      meter_function_sha256: "sha256:meter",
    },
  };
  const contextStub = {
    browser: () => ({ version: () => "FAKE_NO_BROWSER_CREATED" }),
    route: async () => {
      calls.push("route");
      if (rejectRoute) throw new Error("INJECTED_ROUTE_REJECT");
    },
    close: async () => {
      calls.push("context.close");
      if (rejectClose) throw new Error("INJECTED_CLOSE_REJECT");
    },
  };
  const fsStub = {
    readFileSync: () => Buffer.from("{}"),
    writeFileSync: (name, body) => {
      calls.push("write:" + name);
      writes.push({ name, body });
      if (rejectWrites.includes(writes.length))
        throw new Error("INJECTED_WRITE_REJECT_" + writes.length);
    },
    mkdtempSync: () => {
      calls.push("profile.create");
      return "/tmp/owned-profile";
    },
    mkdirSync: () => {
      calls.push("output.mkdir");
    },
    rmSync: (name, options) => {
      calls.push("profile.remove");
      assert.equal(name, "/tmp/owned-profile");
      assert.deepEqual(
        { ...options },
        { recursive: true, force: true, maxRetries: 10, retryDelay: 100 },
      );
      if (rejectRemove) throw new Error("INJECTED_REMOVE_REJECT");
    },
    existsSync: () => false,
  };
  const sandbox = createContext({
    Buffer,
    URL,
    performance,
    console: { log: (value) => logs.push(value) },
    AbortSignal: globalThis.AbortSignal,
    fetch: async () => {
      calls.push("binding.fetch.stub");
      return {
        ok: true,
        json: async () => ({
          runtime_nonce: processStub.env.JAPP_W14_PAIRED_RUNTIME_NONCE,
          campaign_lock_digest: campaign.lock_digest,
          input_digests: [],
          legacy_projections: [],
        }),
      };
    },
  });
  function synthetic(values, identifier) {
    const module = new SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values))
          this.setExport(key, value);
      },
      { context: sandbox, identifier },
    );
    return module;
  }
  const registry = {
    "node:process": { default: processStub },
    "node:fs": fsStub,
    "node:path": {
      join: path.join,
      isAbsolute: path.isAbsolute,
      relative: path.relative,
    },
    "node:url": { pathToFileURL: url.pathToFileURL, URL },
    "node:os": { tmpdir: () => "/tmp" },
    "./campaign.mjs": {
      loadCampaign: () => {
        calls.push("loadCampaign");
        return campaign;
      },
      canonicalSha: sha,
      canonical: JSON.stringify,
      sha,
      here: "/campaign/",
      requireNativeAudit: () => {},
    },
  };
  async function loadDynamic(specifier) {
    let values;
    if (specifier === "file:///playwright/index.mjs")
      values = {
        chromium: {
          launchPersistentContext: async () => {
            calls.push("context.launch.fake");
            if (rejectLaunch) throw new Error("INJECTED_LAUNCH_REJECT");
            return contextStub;
          },
        },
      };
    else if (
      specifier ===
      "file:///candidate/e2e/extension/support/autofill-w14-native-witness.ts"
    )
      values = {
        installW14NativeWitness: () => {
          throw new Error("UNEXPECTED_NATIVE_ACTOR");
        },
        nativeMutationWitnesses: () => {
          throw new Error("UNEXPECTED_NATIVE_ACTOR");
        },
      };
    else throw new Error("UNEXPECTED_DYNAMIC_IMPORT:" + specifier);
    const module = synthetic(values, specifier);
    await module.link(() => {
      throw new Error("UNEXPECTED_SYNTHETIC_DEPENDENCY");
    });
    await module.evaluate();
    return module;
  }
  const module = new SourceTextModule(source, {
    context: sandbox,
    identifier: "file:///campaign/legacy-browser.mjs",
    importModuleDynamically: loadDynamic,
  });
  await module.link((specifier) => {
    if (!(specifier in registry))
      throw new Error("UNEXPECTED_IMPORT:" + specifier);
    return synthetic(registry[specifier], specifier);
  });
  let evaluationError;
  try {
    await module.evaluate();
  } catch (error) {
    evaluationError = error;
  }
  const artifacts = writes
    .filter((row) => row.name.endsWith(".json"))
    .map((row) => JSON.parse(row.body));
  return {
    calls,
    writes,
    artifacts,
    logs,
    evaluationError,
    exitCode: processStub.exitCode,
  };
}
for (const rejected of [1, 2]) {
  test(
    "initial evidence write " +
      rejected +
      " rejection removes owned profile and never launches",
    async () => {
      const result = await exercise({ rejectWrites: [rejected] });
      assert.equal(
        result.calls.filter((call) => call === "profile.create").length,
        1,
      );
      assert.equal(
        result.calls.filter((call) => call === "profile.remove").length,
        1,
      );
      assert.equal(result.calls.includes("context.launch.fake"), false);
      assert.equal(result.calls.includes("context.close"), false);
      assert.equal(result.evaluationError, undefined);
      assert.equal(result.exitCode, 1);
      const final = result.artifacts.at(-1);
      assert.equal(final.complete, false);
      assert.equal(final.context_cleanup, "NOT_CREATED");
      assert.equal(final.profile_cleanup, "VERIFIED_OWNED_PROFILE_REMOVED");
      assert.deepEqual(
        Array.from(final.errors, (row) => row.stage),
        ["INITIAL_EVIDENCE_WRITE"],
      );
      assert.ok(final.ended_at);
    },
  );
}
test("initial writer plus profile removal rejection records both and remains incomplete", async () => {
  const result = await exercise({ rejectWrites: [1], rejectRemove: true });
  assert.equal(
    result.calls.filter((call) => call === "profile.remove").length,
    1,
  );
  assert.equal(result.evaluationError, undefined);
  const final = result.artifacts.at(-1);
  assert.deepEqual(
    Array.from(final.errors, (row) => row.stage),
    ["INITIAL_EVIDENCE_WRITE"],
  );
  assert.deepEqual(
    Array.from(final.cleanup_errors, (row) => row.stage),
    ["PROFILE_REMOVE"],
  );
  assert.equal(final.profile_cleanup, "FAILED");
  assert.equal(final.complete, false);
});
test("persistent evidence write rejection still attempts removal before final rejection", async () => {
  const result = await exercise({ rejectWrites: [1, 2] });
  assert.equal(
    result.calls.filter((call) => call === "profile.remove").length,
    1,
  );
  assert.ok(result.evaluationError);
  assert.ok(
    result.calls.indexOf("profile.remove") <
      result.calls.lastIndexOf(
        "write:/outside/evidence/paired-options-legacy.json",
      ),
  );
});
test("launch rejection keeps existing no-context cleanup behavior", async () => {
  const result = await exercise({ rejectLaunch: true });
  assert.equal(
    result.calls.filter((call) => call === "context.launch.fake").length,
    1,
  );
  assert.equal(
    result.calls.filter((call) => call === "profile.remove").length,
    1,
  );
  const final = result.artifacts.at(-1);
  assert.deepEqual(
    Array.from(final.errors, (row) => row.stage),
    ["LAUNCH"],
  );
  assert.equal(final.context_cleanup, "NOT_CREATED");
  assert.equal(final.complete, false);
});
test("context-close rejection cannot skip profile removal; errors preserve both failures", async () => {
  const result = await exercise({
    rejectRoute: true,
    rejectClose: true,
    rejectRemove: true,
  });
  assert.equal(
    result.calls.filter((call) => call === "context.close").length,
    1,
  );
  assert.equal(
    result.calls.filter((call) => call === "profile.remove").length,
    1,
  );
  assert.ok(
    result.calls.indexOf("context.close") <
      result.calls.indexOf("profile.remove"),
  );
  const final = result.artifacts.at(-1);
  assert.deepEqual(
    Array.from(final.errors, (row) => row.stage),
    ["CAMPAIGN"],
  );
  assert.deepEqual(
    Array.from(final.cleanup_errors, (row) => row.stage),
    ["CONTEXT_CLOSE", "PROFILE_REMOVE"],
  );
  assert.equal(final.context_cleanup, "FAILED");
  assert.equal(final.profile_cleanup, "FAILED");
  assert.equal(final.complete, false);
});
test("final evidence rejection occurs after both owned cleanup attempts", async () => {
  const result = await exercise({ rejectRoute: true, rejectWrites: [3] });
  assert.ok(result.evaluationError);
  assert.equal(
    result.calls.filter((call) => call === "context.close").length,
    1,
  );
  assert.equal(
    result.calls.filter((call) => call === "profile.remove").length,
    1,
  );
  assert.ok(
    result.calls.indexOf("profile.remove") <
      result.calls.lastIndexOf(
        "write:/outside/evidence/paired-options-legacy.json",
      ),
  );
});
