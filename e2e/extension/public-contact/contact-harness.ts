/** Explicit public evaluation harness. No public writes occur on import. */
import {
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
  type Request,
} from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { FormFieldDescriptorV1 } from "../../../packages/contracts/generated/typescript/index.ts";
import { buildApprovedRecordSet } from "../../../packages/form-engine/src/approved-records.ts";
import { resolveFieldDecision } from "../../../packages/form-engine/src/decision-resolver.ts";
import {
  SYNTHETIC_FACTS,
  type ContactConcept,
} from "../../../apps/extension/test/m02-w14/public-contact/protocol.ts";
import {
  sha256Bytes,
  sha256Canonical,
} from "../../../packages/evaluation-runner/src/canonical.ts";
import {
  PUBLIC_CONTENT_MATCHES,
  permitsPublicDocumentUrl,
} from "../../../apps/extension/test/m02-w14/public-inspection/scope.ts";
import {
  CONTACT_SCOPE,
  PREPARE,
  EXECUTE,
  profileDigest,
  scanDigest,
  type ContactPlan,
} from "../../../apps/extension/test/m02-w14/public-contact/protocol.ts";
import {
  buildScanTabRequest,
  parseAggregatedScanResult,
} from "../../../apps/extension/src/scanner-protocol.ts";
import {
  buildDynamicReconcileTabRequest,
  parseDynamicReconcileTabResult,
} from "../../../apps/extension/src/dynamic-protocol.ts";
import { stableSemanticId } from "../../../apps/extension/src/semantic-identity.ts";
import {
  cleanupOwnedBrowser,
  runtimeMessage,
  tabIdForPage,
} from "../public-research/inspection-harness.ts";
export { runtimeMessage, tabIdForPage };

const root = fileURLToPath(new URL("../../..", import.meta.url));
export const CONTACT_DIST = join(
  root,
  "apps/extension/dist/w14-public-contact/chrome-mv3",
);
export const ORACLE_PATH = join(
  root,
  "apps/extension/test/m02-w14/public-contact/oracle-map.json",
);
export interface LiteralMatch {
  label: string;
  tag: string;
  type: string | null;
  role: string | null;
  visible: boolean;
  required: boolean;
  disabled: boolean;
  autocomplete: string | null;
}
export interface IndependentPageOracle {
  evidence_row_id: string;
  url: string;
  source: unknown;
  positive: {
    match: LiteralMatch;
    concept: string;
    value: string;
    source: unknown;
  }[];
  negative: { match: LiteralMatch; reason: string; source: unknown }[];
}
export interface PhysicalControl {
  index: number;
  match: LiteralMatch;
  label_observation?: {
    primary_source: string;
    native_labels: string[];
    aria_label: string | null;
    aria_labelledby: string;
    wrapping_label: string | null;
    placeholder: string | null;
  };
  value_digest: string;
  empty: boolean;
  readonly: boolean;
  aria_invalid: string | null;
  checked: boolean | null;
}
export interface NetworkObservation {
  kind: "HTTP_BLOCKED" | "WEBSOCKET_BLOCKED" | "NETWORK_CAPABILITY_BLOCKED";
  method: string;
  resource_type: string;
  origin: string;
  path_digest: string;
}
export interface NetworkClosure {
  state:
    | "OPEN"
    | "REFUSED_PENDING_HTTP"
    | "REFUSED_CAPABILITY_GUARD"
    | "FAILED_OFFLINE"
    | "CLOSED";
  pending_http_requests: number;
  worker_webtransport: "UNVERIFIED" | "UNAVAILABLE";
}
export const NETWORK_CONSTRUCTOR_NAMES = [
  "RTCPeerConnection",
  "webkitRTCPeerConnection",
  "WebTransport",
] as const;

/** Main-world init enforcement, installed before site scripts in every new frame. */
export function installNetworkCapabilityGuard(args: {
  bindingName: string;
  guardName: string;
}) {
  const global = globalThis as unknown as Record<string, unknown>;
  // Capture the original metadata channel before site code can replace globals.
  const report = global[args.bindingName] as
    ((name: string) => Promise<void>) | undefined;
  const define = Object.defineProperty;
  const freeze = Object.freeze;
  let installed = typeof report === "function";
  for (const name of [
    "RTCPeerConnection",
    "webkitRTCPeerConnection",
    "WebTransport",
  ]) {
    // A fresh stub retains no native constructor or native prototype escape.
    const DeniedNetworkCapability = function () {
      try {
        void report?.(name).catch(() => undefined);
      } catch {
        /* Denial remains synchronous. */
      }
      throw new TypeError("W14_NETWORK_CAPABILITY_BLOCKED");
    };
    freeze(DeniedNetworkCapability.prototype as object);
    freeze(DeniedNetworkCapability);
    try {
      define(globalThis, name, {
        value: DeniedNetworkCapability,
        writable: false,
        configurable: false,
      });
    } catch {
      installed = false;
    }
  }
  define(globalThis, args.guardName, {
    value: freeze({ installed }),
    writable: false,
    configurable: false,
  });
}

/** Controlled about:blank worker probe; never runs on a public page. */
export async function assertWorkerTransportUnavailable(
  page: Page,
): Promise<void> {
  const unavailable = await page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const url = URL.createObjectURL(
          new Blob(
            ["postMessage(typeof globalThis.WebTransport === 'undefined');"],
            { type: "text/javascript" },
          ),
        );
        const worker = new globalThis.Worker(url);
        const finish = (value: boolean) => {
          clearTimeout(timer);
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve(value);
        };
        const timer = setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(url);
          reject(new Error("W14_WORKER_TRANSPORT_PROBE_TIMEOUT"));
        }, 3000);
        worker.onmessage = (event: MessageEvent<unknown>) => {
          finish(event.data === true);
        };
        worker.onerror = () => {
          finish(false);
        };
      }),
  );
  if (!unavailable) throw new Error("W14_WORKER_WEBTRANSPORT_STILL_AVAILABLE");
}

export interface ContactSession {
  context: BrowserContext;
  worker: Worker;
  controller: Page;
  network: NetworkObservation[];
  closed: boolean;
  readonly closure: NetworkClosure;
  readonly pendingHttpRequests: number;
  closeNetwork(): Promise<void>;
  cleanup(): Promise<void>;
}
/** Read-only startup settling; this observation never grants action authority.
 * At most100 waits of at most50ms are requested. The strict closeNetwork fence
 * is still required afterwards and can refuse a newly started request. */
export const READONLY_HTTP_DRAIN = Object.freeze({
  budget_ms: 5000,
  poll_ms: 50,
  max_polls: 100,
  scope: "READ_ONLY_BEFORE_STRICT_NETWORK_CLOSURE",
} as const);
export async function waitReadOnlyNetworkDrain(
  session: Pick<ContactSession, "pendingHttpRequests">,
  page: Pick<Page, "waitForTimeout">,
) {
  const started = performance.now();
  const initial = session.pendingHttpRequests;
  let polls = 0;
  while (
    session.pendingHttpRequests > 0 &&
    polls < READONLY_HTTP_DRAIN.max_polls
  ) {
    const remaining =
      READONLY_HTTP_DRAIN.budget_ms - (performance.now() - started);
    if (remaining <= 0) break;
    await page.waitForTimeout(Math.min(READONLY_HTTP_DRAIN.poll_ms, remaining));
    polls++;
  }
  const pending = session.pendingHttpRequests;
  return {
    state:
      pending === 0 ? ("QUIESCENT" as const) : ("PENDING_AT_BUDGET" as const),
    ...READONLY_HTTP_DRAIN,
    initial_pending_http_requests: initial,
    final_pending_http_requests: pending,
    polls,
    observed_wait_ms: performance.now() - started,
  };
}
export function readOracle() {
  const bytes = readFileSync(ORACLE_PATH);
  const map = JSON.parse(bytes.toString("utf8")) as {
    format_version: string;
    independent_source_sha256: string;
    pages: IndependentPageOracle[];
  };
  if (
    sha256Bytes(bytes) !==
      "sha256:2ba290bf505b8dc009ed2cb7e5d1724f33745ab374b10fe27d3c03a3d68ee91d" ||
    map.format_version !== "W14_PUBLIC_CONTACT_LITERAL_ORACLE_MAP_1" ||
    map.independent_source_sha256 !==
      "e2383c2aa795f2f876063dc7c7b72d7fd2ea969004db05deca6ba08a86b8ce82"
  )
    throw new Error("W14_INDEPENDENT_ORACLE_SOURCE_MISMATCH");
  const original = gunzipSync(
    readFileSync(
      join(
        root,
        "docs/evidence/m02-w14-public-contact-oracle/independent-oracle.json.gz",
      ),
    ),
  );
  if (sha256Bytes(original) !== `sha256:${map.independent_source_sha256}`)
    throw new Error("W14_INDEPENDENT_ORACLE_PREIMAGE_MISMATCH");
  return {
    map,
    bytes_digest: sha256Bytes(bytes),
    original_digest: sha256Bytes(original),
  };
}
export async function launchContact(
  buildDirectory = CONTACT_DIST,
): Promise<ContactSession> {
  if (process.env.JAPP_W14_PUBLIC_CONTACT_EVALUATION !== "1")
    throw new Error("W14_PUBLIC_CONTACT_EXPLICIT_OPT_IN_REQUIRED");
  const manifest = JSON.parse(
    readFileSync(join(buildDirectory, "manifest.json"), "utf8"),
  ) as { content_scripts: { matches: string[]; all_frames?: boolean }[] };
  if (
    manifest.content_scripts.length !== 1 ||
    manifest.content_scripts[0]?.all_frames !== false ||
    JSON.stringify([...manifest.content_scripts[0].matches].sort()) !==
      JSON.stringify([...PUBLIC_CONTENT_MATCHES].sort()) ||
    Object.keys(manifest).sort().join() !==
      [
        "background",
        "content_scripts",
        "description",
        "manifest_version",
        "name",
        "version",
      ]
        .sort()
        .join()
  )
    throw new Error("W14_PUBLIC_CONTACT_MANIFEST_SCOPE_MISMATCH");
  const profile = mkdtempSync(join(tmpdir(), "japp-w14-public-contact-"));
  let ownedContext: BrowserContext | undefined;
  try {
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      serviceWorkers: "block",
      args: [
        `--disable-extensions-except=${buildDirectory}`,
        `--load-extension=${buildDirectory}`,
        "--disable-quic",
        "--disable-blink-features=WebTransport",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    });
    ownedContext = context;
    const network: NetworkObservation[] = [];
    let closed = false;
    let httpGateClosed = false;
    let closure: NetworkClosure = {
      state: "OPEN",
      pending_http_requests: 0,
      worker_webtransport: "UNVERIFIED",
    };
    const pending = new Set<Request>();
    context.on("request", (request) => {
      if (/^https?:/.test(request.url())) pending.add(request);
    });
    const finished = (request: Request) => {
      pending.delete(request);
    };
    context.on("requestfinished", finished);
    context.on("requestfailed", finished);
    const bindingName = `__jappW14Network_${randomUUID().replaceAll("-", "")}`;
    const guardName = `__jappW14Guard_${randomUUID().replaceAll("-", "")}`;
    const observe = (
      kind: NetworkObservation["kind"],
      url: string,
      method: string,
      resource: string,
    ) => {
      const parsed = new URL(url);
      network.push({
        kind,
        method,
        resource_type: resource,
        origin: parsed.origin,
        path_digest: sha256Canonical(`${parsed.pathname}${parsed.search}`),
      });
    };
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (httpGateClosed && /^https?:/.test(request.url())) {
        observe(
          "HTTP_BLOCKED",
          request.url(),
          request.method(),
          request.resourceType(),
        );
        await route.abort("blockedbyclient");
      } else await route.continue();
    });
    // No site WebSocket is connected, even during initial inspection. Public
    // effects from one input handler cannot escape through an existing socket.
    await context.routeWebSocket(/.*/, (socket) => {
      observe("WEBSOCKET_BLOCKED", socket.url(), "WEBSOCKET", "websocket");
      void socket.close();
    });
    await context.exposeBinding(bindingName, ({ frame }, name: unknown) => {
      if (
        typeof name === "string" &&
        NETWORK_CONSTRUCTOR_NAMES.some((candidate) => candidate === name)
      )
        observe(
          "NETWORK_CAPABILITY_BLOCKED",
          frame.url() || "about:blank",
          name,
          "network-constructor",
        );
    });
    await context.addInitScript(installNetworkCapabilityGuard, {
      bindingName,
      guardName,
    });
    const initialPages = context.pages();
    const probe = await context.newPage();
    // Do not leave a startup about:blank realm that predates the init fence.
    for (const initial of initialPages) {
      if (initial.url() !== "about:blank")
        throw new Error("W14_UNEXPECTED_INITIAL_DOCUMENT");
      await initial.close();
    }
    await assertWorkerTransportUnavailable(probe);
    closure = { ...closure, worker_webtransport: "UNAVAILABLE" };
    const worker =
      context
        .serviceWorkers()
        .find((item) => item.url().startsWith("chrome-extension://")) ??
      (await context.waitForEvent("serviceworker", {
        predicate: (item) => item.url().startsWith("chrome-extension://"),
        timeout: 30_000,
      }));
    const controller = await context.newPage();
    await controller.goto(
      `chrome-extension://${new URL(worker.url()).hostname}/manifest.json`,
    );
    await probe.close();
    const mode = await worker.evaluate(
      () => (globalThis as Record<string, unknown>).__JAPP_W14_PUBLIC_CONTACT__,
    );
    if (
      mode === null ||
      typeof mode !== "object" ||
      (mode as { mode?: unknown }).mode !== CONTACT_SCOPE
    )
      throw new Error("W14_PUBLIC_CONTACT_WORKER_MODE_MISMATCH");
    return {
      context,
      worker,
      controller,
      network,
      get closed() {
        return closed;
      },
      get closure() {
        // Preserve the transition/refusal count after cleanup drains requests.
        return { ...closure };
      },
      get pendingHttpRequests() {
        return pending.size;
      },
      async closeNetwork() {
        if (closed) return;
        if (pending.size > 0) {
          closure = {
            ...closure,
            state: "REFUSED_PENDING_HTTP",
            pending_http_requests: pending.size,
          };
          throw new Error("W14_PENDING_HTTP_REFUSES_NETWORK_CLOSURE");
        }
        for (const page of context.pages()) {
          if (page.url().startsWith("chrome-extension://")) continue;
          for (const frame of page.frames()) {
            const guarded = await frame
              .evaluate((name) => {
                const value = (
                  globalThis as unknown as Record<string, unknown>
                )[name] as { installed?: unknown } | undefined;
                return value?.installed === true;
              }, guardName)
              .catch(() => false);
            if (!guarded) {
              closure = { ...closure, state: "REFUSED_CAPABILITY_GUARD" };
              throw new Error("W14_NETWORK_CAPABILITY_GUARD_UNAVAILABLE");
            }
          }
        }
        // Recheck after the async guard inspection; no in-flight upload may be
        // grandfathered across the first synthetic write.
        if (pending.size > 0) {
          closure = {
            ...closure,
            state: "REFUSED_PENDING_HTTP",
            pending_http_requests: pending.size,
          };
          throw new Error("W14_PENDING_HTTP_REFUSES_NETWORK_CLOSURE");
        }
        httpGateClosed = true;
        try {
          await context.setOffline(true);
        } catch {
          closure = { ...closure, state: "FAILED_OFFLINE" };
          throw new Error("W14_OFFLINE_ENFORCEMENT_FAILED");
        }
        if (pending.size > 0) {
          closure = {
            ...closure,
            state: "REFUSED_PENDING_HTTP",
            pending_http_requests: pending.size,
          };
          throw new Error("W14_PENDING_HTTP_REFUSES_NETWORK_CLOSURE");
        }
        closed = true;
        closure = { ...closure, state: "CLOSED", pending_http_requests: 0 };
      },
      async cleanup() {
        await cleanupOwnedBrowser(context, profile);
      },
    };
  } catch (error) {
    let cleanupFailure: { error: unknown } | undefined;
    try {
      await cleanupOwnedBrowser(ownedContext, profile);
    } catch (cleanupError) {
      cleanupFailure = { error: cleanupError };
    }
    if (cleanupFailure !== undefined)
      throw new AggregateError(
        [error, cleanupFailure.error],
        "W14_BROWSER_ACQUISITION_AND_CLEANUP_FAILED",
        { cause: error },
      );
    throw error;
  }
}
export async function measureControls(page: Page): Promise<PhysicalControl[]> {
  return page.evaluate(async () => {
    const digest = async (value: string) =>
      `sha256:${[...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    // Read-only bounded physical inventory includes every reachable open
    // root. Closed roots are unsupported; no prefix is scored on capacity.
    const elements: Element[] = [];
    const stack: { node: Element; depth: number }[] = [];
    let roots = 0;
    const push = (parent: Element | Document | ShadowRoot, depth: number) => {
      for (
        let node = parent.lastElementChild;
        node !== null;
        node = node.previousElementSibling
      ) {
        if (stack.length + elements.length >= 16_384)
          throw new Error("W14_MEASUREMENT_OPEN_TREE_CAPACITY");
        stack.push({ node, depth });
      }
    };
    push(document, 0);
    while (stack.length > 0) {
      const item = stack.pop();
      if (item === undefined) break;
      elements.push(item.node);
      push(item.node, item.depth);
      const shadow = item.node.shadowRoot;
      if (shadow !== null) {
        roots++;
        if (roots > 64 || item.depth >= 8)
          throw new Error("W14_MEASUREMENT_OPEN_TREE_CAPACITY");
        push(shadow, item.depth + 1);
      }
    }
    const controls = elements.filter((element) =>
      element.matches(
        'input,select,textarea,[role="combobox"],[role="listbox"],[role="checkbox"],[role="radio"]',
      ),
    );
    return Promise.all(
      controls.map(async (element, index) => {
        const native =
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
            ? element
            : null;
        const labelled = (element.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) =>
            (() => {
              const root = element.getRootNode();
              return root instanceof Document || root instanceof ShadowRoot
                ? (root.getElementById(id)?.textContent.trim() ?? "")
                : "";
            })(),
          )
          .join(" ");
        const nativeLabels =
          native === null
            ? []
            : [...(native.labels ?? [])].map((node) => node.textContent.trim());
        const ariaLabel = element.getAttribute("aria-label");
        const wrappingLabel =
          element.closest("label")?.textContent.trim() ?? null;
        const placeholder = element.getAttribute("placeholder");
        // The independent saved-snapshot oracle captures associated label text,
        // including required markers. Keep its literal channel; accessible
        // alternatives remain separate observations, never rewritten truth.
        const primary = [
          { source: "NATIVE_LABEL", text: nativeLabels.join(" ") },
          { source: "ARIA_LABEL", text: ariaLabel },
          { source: "ARIA_LABELLEDBY", text: labelled },
          { source: "WRAPPING_LABEL", text: wrappingLabel },
          { source: "PLACEHOLDER", text: placeholder },
        ].find((item) => item.text !== null && item.text !== "");
        const label = primary?.text ?? "";
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const visible =
          element instanceof HTMLElement &&
          !element.hidden &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0;
        const value = native?.value ?? "";
        return {
          index,
          label_observation: {
            primary_source: primary?.source ?? "NONE",
            native_labels: nativeLabels,
            aria_label: ariaLabel,
            aria_labelledby: labelled,
            wrapping_label: wrappingLabel,
            placeholder,
          },
          match: {
            label,
            tag: element.tagName,
            type:
              element.getAttribute("type") ??
              (element instanceof HTMLInputElement ? element.type : null),
            role: element.getAttribute("role"),
            visible,
            required:
              native?.required === true ||
              element.getAttribute("aria-required") === "true",
            disabled:
              native?.disabled === true ||
              element.getAttribute("aria-disabled") === "true",
            autocomplete: element.getAttribute("autocomplete"),
          },
          value_digest: await digest(value),
          empty: value === "",
          readonly:
            (element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement) &&
            element.readOnly,
          aria_invalid: element.getAttribute("aria-invalid"),
          checked:
            element instanceof HTMLInputElement &&
            ["checkbox", "radio"].includes(element.type)
              ? element.checked
              : null,
        };
      }),
    );
  });
}
export const sameLiteral = (left: LiteralMatch, right: LiteralMatch) =>
  sha256Canonical(left) === sha256Canonical(right);
export async function scanContact(
  session: ContactSession,
  page: Page,
  id: string,
) {
  if (!permitsPublicDocumentUrl(page.url())) return { tabId: null, scan: null };
  const tabId = await tabIdForPage(session.worker, page);
  const until = performance.now() + 15_000;
  let scan;
  do {
    scan = parseAggregatedScanResult(
      await runtimeMessage(
        session.controller,
        buildScanTabRequest(id, tabId, { kind: "APPLICATION_ROOT" }),
      ),
    );
    if ((scan?.frames.length ?? 0) > 0) break;
    await page.waitForTimeout(100);
  } while (performance.now() < until);
  return { tabId, scan };
}
export async function freezePlan(
  session: ContactSession,
  page: Page,
  oracle: IndependentPageOracle,
  id: string,
  absoluteArtifactPath: string,
) {
  if (!session.closed) throw new Error("W14_NETWORK_CLOSURE_NOT_CONFIRMED");
  if (!isAbsolute(absoluteArtifactPath))
    throw new Error("W14_EXPLICIT_ABSOLUTE_FREEZE_PATH_REQUIRED");
  const measured = await measureControls(page);
  const observation = await scanContact(session, page, `${id}-scan`);
  const frame = observation.scan?.frames[0];
  if (
    page.url() !== oracle.url ||
    frame?.root_status !== "FOUND" ||
    observation.tabId === null
  )
    return {
      state: "REFUSED_APPLICATION_OR_SOURCE",
      measured,
      observation,
      plan: null,
      frozen: null,
    } as const;
  for (const expectation of oracle.positive) {
    if (
      measured.filter((control) =>
        sameLiteral(control.match, expectation.match),
      ).length !== 1
    )
      return {
        state: "REFUSED_INDEPENDENT_ORACLE_DRIFT",
        measured,
        observation,
        plan: null,
        frozen: null,
      } as const;
  }
  const independent = {
    format_version: "W14_PUBLIC_CONTACT_BEFORE_FILL_1",
    source: oracle,
    actual_url: page.url(),
    measured,
    observation,
    created_at: new Date().toISOString(),
    candidate_w09_executed: false,
    network_closed: session.closed,
  };
  const independentDigest = sha256Canonical(independent);
  const plan: ContactPlan = {
    scope: CONTACT_SCOPE,
    source_url: page.url(),
    frame_context: frame.frame_context,
    before_scan_digest: await scanDigest(frame),
    independent_oracle_digest: independentDigest,
    profile_digest: await profileDigest(),
    fields: frame.descriptors
      .filter(
        (field) =>
          field.control_kind === "TEXT" && field.visible && field.enabled,
      )
      .map((field) => ({ field_id: field.field_id, address: field.address })),
  };
  const frozen = {
    ...independent,
    independent_digest: independentDigest,
    plan,
    plan_digest: sha256Canonical(plan),
  };
  // wx refuses accidental replacement: oracle/evidence is frozen on disk
  // before any W09 policy or W10 action request is issued.
  writeFileSync(absoluteArtifactPath, JSON.stringify(frozen, null, 2) + "\n", {
    flag: "wx",
  });
  return { state: "FROZEN", measured, observation, plan, frozen } as const;
}
export async function prepareContact(
  session: ContactSession,
  tabId: number,
  plan: ContactPlan,
  id: string,
) {
  if (!session.closed) throw new Error("W14_NETWORK_CLOSURE_NOT_CONFIRMED");
  return runtimeMessage(session.controller, {
    kind: PREPARE,
    version: 1,
    requestId: `${id}-prepare`,
    tabId,
    plan,
  });
}
export async function executeContact(
  session: ContactSession,
  tabId: number,
  planId: string,
  field: FormFieldDescriptorV1,
  id: string,
) {
  if (!session.closed) throw new Error("W14_NETWORK_CLOSURE_NOT_CONFIRMED");
  const records = buildApprovedRecordSet(
    await Promise.all(
      (Object.entries(SYNTHETIC_FACTS) as [ContactConcept, string][]).map(
        async ([concept, value]) => ({
          recordId: await stableSemanticId(
            "record",
            `w14-public-contact\0${concept}\0${value}`,
          ),
          concept,
          policy: "FILL_FROM_EXPLICIT_RECORD" as const,
          confirmation: { state: "MISSING" as const },
          valueConfidence: 1,
        }),
      ),
    ),
  );
  const resolution = await resolveFieldDecision({
    descriptor: field,
    records,
    correlationId: await stableSemanticId(
      "cor",
      `${planId}\0${field.field_id}`,
    ),
  });
  if (resolution.status !== "RESOLVED")
    return {
      state: "ABSTAINED",
      reason: "POLICY_DESCRIPTOR_REFUSED",
      decision: null,
      result: null,
    };
  return runtimeMessage(session.controller, {
    kind: EXECUTE,
    version: 1,
    requestId: `${id}-execute`,
    tabId,
    plan_id: planId,
    field_id: field.field_id,
    decision: resolution.resolution.decision,
  });
}
export async function reconcileContact(
  session: ContactSession,
  tabId: number,
  frameId: string,
  id: string,
) {
  return parseDynamicReconcileTabResult(
    await runtimeMessage(
      session.controller,
      buildDynamicReconcileTabRequest(
        `${id}-reconcile`,
        tabId,
        frameId,
        await stableSemanticId("cor", `${id}\0reconcile`),
      ),
    ),
  );
}

export function requireObserved<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("W14_REQUIRED_OBSERVATION_MISSING");
  return value;
}

/** Bounded read-only hydration wait. It does not select/repair a root. */
export async function waitReadOnlyReady(
  session: ContactSession,
  page: Page,
  oracle: IndependentPageOracle,
  id: string,
) {
  const deadline = performance.now() + 8_000;
  let attempts = 0;
  let state: string;
  do {
    if (page.url() !== oracle.url)
      return { state: "CURRENT_URL_CHANGED", attempts };
    const measured = await measureControls(page);
    const observed = await scanContact(
      session,
      page,
      `${id}-ready-${String(attempts)}`,
    );
    attempts++;
    state = observed.scan?.frames[0]?.root_status ?? "NO_REGISTERED_FRAME";
    if (oracle.positive.length === 0)
      return {
        state: "EXPECTED_NONCONTACT_BOUNDARY",
        attempts,
        root_state: state,
      };
    if (
      state === "FOUND" &&
      oracle.positive.every(
        (item) =>
          measured.filter((control) => sameLiteral(control.match, item.match))
            .length === 1,
      )
    )
      return {
        state: "LITERAL_CONTACTS_AND_ROOT_OBSERVED",
        attempts,
        root_state: state,
      };
    if (["AMBIGUOUS", "CAPACITY_EXCEEDED"].includes(state)) break;
    await page.waitForTimeout(250);
  } while (performance.now() < deadline);
  return { state: "BOUNDED_READINESS_UNRESOLVED", attempts, root_state: state };
}
