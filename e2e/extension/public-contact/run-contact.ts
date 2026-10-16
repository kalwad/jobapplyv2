/** Network-closed public DOM evaluation. Separate explicit activation required. */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { isAbsolute, join } from "node:path";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { cpus, platform, release } from "node:os";
import { PUBLIC_SOURCES } from "../../../apps/extension/test/m02-w14/public-inspection/scope.ts";
import {
  sha256Bytes,
  sha256Canonical,
} from "../../../packages/evaluation-runner/src/canonical.ts";
import { CONTACT_SCOPE } from "../../../apps/extension/test/m02-w14/public-contact/protocol.ts";
import {
  CONTACT_DIST,
  readOracle,
  launchContact,
  freezePlan,
  prepareContact,
  executeContact,
  reconcileContact,
  measureControls,
  sameLiteral,
  requireObserved,
  waitReadOnlyReady,
} from "./contact-harness.ts";
import {
  actionObservationSnapshot,
  captureRunnerPage,
  closeNetworkForObservation,
  finalizeRunnerEvidence,
  type RunnerFinalization,
} from "./runner-evidence.ts";
import {
  accountControlUnion,
  contactDomMetrics,
  hasCompleteControlCoverage,
  type ContactMeasuredRow,
} from "./control-accounting.ts";

if (process.env.JAPP_W14_PUBLIC_CONTACT_RUN !== "1")
  throw new Error("W14_PUBLIC_CONTACT_RUN_REQUIRES_SEPARATE_EXPLICIT_OPT_IN");
const output = process.env.JAPP_W14_PUBLIC_CONTACT_ARTIFACT_DIRECTORY;
if (output === undefined || !isAbsolute(output))
  throw new Error("W14_EXPLICIT_ABSOLUTE_OUTPUT_REQUIRED");
mkdirSync(output, { recursive: true });
const oracle = readOracle();
function fileInventory(
  directory: string,
  prefix = "",
): { path: string; digest: string }[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error("W14_BUILD_SYMLINK_REFUSED");
      return entry.isDirectory()
        ? fileInventory(directory, path)
        : [{ path, digest: sha256Bytes(readFileSync(join(directory, path))) }];
    });
}
function sourceInventory() {
  return [
    ...new Set(
      execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
        encoding: "utf8",
      })
        .split("\0")
        .filter((path) => path !== "" && !path.startsWith("docs/evidence/")),
    ),
  ]
    .sort()
    .map((path) => ({ path, digest: sha256Bytes(readFileSync(path)) }));
}
function gitState() {
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
      encoding: "utf8",
    }).trim(),
    dirty:
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim() !== "",
  };
}
const build = fileInventory(CONTACT_DIST);
const sources = sourceInventory();
const binding = {
  mode: CONTACT_SCOPE,
  git: gitState(),
  oracle_map_digest: oracle.bytes_digest,
  independent_source_sha256: oracle.map.independent_source_sha256,
  source_inventory_digest: sha256Canonical(sources),
  build_inventory_digest: sha256Canonical(build),
  manifest_digest: sha256Bytes(
    readFileSync(join(CONTACT_DIST, "manifest.json")),
  ),
};
writeFileSync(
  join(output, "campaign-binding.json"),
  JSON.stringify(binding, null, 2) + "\n",
  { flag: "wx" },
);
const rows: Record<string, unknown>[] = [];
let campaignError: string | null = null;
writeFileSync(join(output, "action-results.jsonl"), "", { flag: "wx" });
writeFileSync(join(output, "page-results.jsonl"), "", { flag: "wx" });
for (const source of PUBLIC_SOURCES) {
  const expected = oracle.map.pages.find(
    (page) =>
      page.evidence_row_id === source.evidence_row_id &&
      page.url === source.url,
  );
  const events: Record<string, number> = {
    input: 0,
    change: 0,
    click: 0,
    submit: 0,
  };
  const requestsFailed: {
    method: string;
    resource_type: string;
    origin: string;
    path_digest: string;
  }[] = [];
  let actionPhase = false;
  let actualNavigation = 0;
  let beforeEvents: Record<string, number> | null = null;
  const partial: Record<string, unknown> = { source };
  const pageLifecycle = await captureRunnerPage({
    source,
    launch: async () => {
      if (expected === undefined)
        throw new Error("W14_SOURCE_HAS_NO_INDEPENDENT_ORACLE");
      return launchContact();
    },
    observe: async (session) => {
      if (expected === undefined)
        throw new Error("W14_SOURCE_HAS_NO_INDEPENDENT_ORACLE");
      const page = await session.context.newPage();
      page.on("framenavigated", (frame) => {
        if (actionPhase && frame === page.mainFrame()) actualNavigation++;
      });
      page.on("requestfailed", (request) => {
        if (actionPhase) {
          const url = new URL(request.url());
          requestsFailed.push({
            method: request.method(),
            resource_type: request.resourceType(),
            origin: url.origin,
            path_digest: sha256Canonical(`${url.pathname}${url.search}`),
          });
        }
      });
      await page.exposeBinding(
        "__jappW14ContactEvent",
        (_origin, type: unknown) => {
          if (typeof type === "string" && Object.hasOwn(events, type))
            events[type] = (events[type] ?? 0) + 1;
        },
      );
      await page.addInitScript(() => {
        const host = globalThis as unknown as {
          __jappW14ContactEvent(type: string): Promise<void>;
        };
        for (const type of ["input", "change", "click", "submit"])
          document.addEventListener(
            type,
            (event) => {
              void host.__jappW14ContactEvent(event.type);
            },
            true,
          );
      });
      const devtools = await session.context.newCDPSession(page);
      let browserMetadata: unknown;
      try {
        browserMetadata = await devtools.send("Browser.getVersion");
        partial.browser_metadata = browserMetadata;
      } finally {
        await devtools.detach();
      }
      const response = await page.goto(source.url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      const readiness = await waitReadOnlyReady(
        session,
        page,
        expected,
        source.evidence_row_id,
      );
      partial.readonly_readiness = readiness;
      partial.http_status = response?.status() ?? null;
      // Await the harness HTTP/WebSocket closure before freezing. This is not
      // evidence that every pre-existing transport or remote validator is closed.
      const closure = await closeNetworkForObservation({
        close: () => session.closeNetwork(),
        snapshot: () => ({ closed: session.closed, closure: session.closure }),
      });
      if (closure.state === "REFUSED_PENDING_HTTP")
        return {
          source,
          ...partial,
          prepared: null,
          executions: [],
          reconciliation: null,
          ...actionObservationSnapshot(events, null, false, actualNavigation),
          network_observations: session.network,
          failed_request_metadata: requestsFailed,
          network_closed: session.closed,
          network_closure: session.closure,
          natural_site_acceptance: null,
          site_acceptance_measurement: "UNMEASURED_NETWORK_CLOSED",
          evaluation_state: "REFUSED_NETWORK_CLOSURE",
        };
      actionPhase = true;
      beforeEvents = { ...events };
      const frozen = await freezePlan(
        session,
        page,
        expected,
        source.evidence_row_id,
        join(output, `${source.evidence_row_id}-before.json`),
      );
      const executions: unknown[] = [];
      partial.executions = executions;
      partial.before_measurements = frozen.measured;
      partial.before_artifact =
        frozen.state === "FROZEN"
          ? `${source.evidence_row_id}-before.json`
          : null;
      let prepared: unknown = null;
      let reconciliation: unknown = null;
      const started = performance.now();
      if (frozen.state === "FROZEN") {
        prepared = await prepareContact(
          session,
          frozen.observation.tabId,
          frozen.plan,
          source.evidence_row_id,
        );
        partial.prepared = prepared;
        const grant = prepared as { state?: unknown; plan_id?: unknown } | null;
        if (grant?.state === "PREPARED" && typeof grant.plan_id === "string") {
          const frame = requireObserved(frozen.observation.scan?.frames[0]);
          for (const field of frame.descriptors.filter((item) =>
            frozen.plan.fields.some(
              (candidate) => candidate.field_id === item.field_id,
            ),
          )) {
            if (
              actualNavigation > 0 ||
              session.network.length > 0 ||
              requestsFailed.length > 0
            )
              break;
            // Record intent before issuing a request that may write. A missing
            // RESULT is explicitly an unknown outcome, never a safe no-op.
            const actionId = `${source.evidence_row_id}-${String(executions.length)}`;
            appendFileSync(
              join(output, "action-results.jsonl"),
              JSON.stringify({
                kind: "INTENT",
                source,
                field_id: field.field_id,
                plan_id: grant.plan_id,
                request_id: actionId,
              }) + "\n",
            );
            const observedAction: {
              field_id: string;
              result: unknown;
              observation_state: string;
            } = {
              field_id: field.field_id,
              result: null,
              observation_state: "RESULT_UNOBSERVED",
            };
            executions.push(observedAction);
            const result = await executeContact(
              session,
              frozen.observation.tabId,
              grant.plan_id,
              field,
              actionId,
            );
            observedAction.result = result ?? null;
            observedAction.observation_state =
              result === undefined || result === null
                ? "RESULT_UNOBSERVED"
                : "RESULT_RECEIVED";
            appendFileSync(
              join(output, "action-results.jsonl"),
              JSON.stringify({ kind: "RESULT", source, ...observedAction }) +
                "\n",
            );
            if (
              result === undefined ||
              result === null ||
              (result as { state?: unknown }).state === "BLOCKED"
            )
              break;
          }
          reconciliation = await reconcileContact(
            session,
            frozen.observation.tabId,
            frame.frame_context.frame_id,
            source.evidence_row_id,
          );
        }
      }
      partial.reconciliation = reconciliation;
      // Observation after real page-owned blur/input handlers and reconciliation;
      // no rerender, validation clearing or form repair is injected.
      await page.waitForTimeout(250);
      const final = await measureControls(page);
      partial.final_measurements = final;
      const before = frozen.measured;
      const positiveScores = expected.positive.map((item) => {
        const initial = before.filter((control) =>
          sameLiteral(control.match, item.match),
        );
        const settled = final.filter((control) =>
          sameLiteral(control.match, item.match),
        );
        return {
          source: item.source,
          concept: item.concept,
          required: item.match.required,
          state:
            initial.length !== 1 || settled.length !== 1
              ? "UNMEASURABLE_IDENTITY"
              : requireObserved(initial[0]).empty
                ? requireObserved(settled[0]).value_digest ===
                  sha256Canonical(item.value)
                  ? "INTENDED_RETAINED"
                  : "MISSING_OR_WRONG"
                : requireObserved(settled[0]).value_digest ===
                    requireObserved(initial[0]).value_digest
                  ? "PREFILLED_PRESERVED"
                  : "PREFILLED_CHANGED",
        };
      });
      const controlAccounting = accountControlUnion(
        before,
        final,
        expected.positive.map((item) => item.match),
      );
      partial.control_accounting = controlAccounting;
      partial.changes = controlAccounting.changes;
      partial.positive_scores = positiveScores;
      const interference =
        actualNavigation > 0 ||
        session.network.length > 0 ||
        requestsFailed.length > 0;
      return {
        source,
        browser_metadata: browserMetadata,
        readonly_readiness: readiness,
        http_status: response?.status() ?? null,
        freeze_state: frozen.state,
        prepared,
        executions,
        reconciliation,
        before_artifact:
          frozen.state === "FROZEN"
            ? `${source.evidence_row_id}-before.json`
            : null,
        before_measurements: before,
        final_measurements: final,
        positive_scores: positiveScores,
        changes: controlAccounting.changes,
        control_accounting: controlAccounting,
        network_observations: session.network,
        failed_request_metadata: requestsFailed,
        ...actionObservationSnapshot(
          events,
          beforeEvents,
          actionPhase,
          actualNavigation,
        ),
        network_closed: session.closed,
        network_closure: session.closure,
        natural_site_acceptance: null,
        site_acceptance_measurement: "UNMEASURED_NETWORK_CLOSED",
        evaluation_state: interference
          ? "NETWORK_OR_NAVIGATION_INTERFERENCE"
          : frozen.state === "FROZEN" &&
              (prepared as { state?: unknown } | null)?.state === "PREPARED"
            ? controlAccounting.precision_eligible
              ? "OBSERVED_NETWORK_CLOSED_DOM_SUBSET"
              : "UNMEASURABLE_TOPOLOGY"
            : "REFUSED",
        action_and_reconciliation_ms: performance.now() - started,
      };
    },
    snapshot: (session) => ({
      ...partial,
      ...actionObservationSnapshot(
        events,
        beforeEvents,
        actionPhase,
        actualNavigation,
      ),
      network_observations: session?.network ?? null,
      failed_request_metadata: requestsFailed,
      network_closed: session?.closed ?? null,
      network_closure: session?.closure ?? null,
      natural_site_acceptance: null,
      site_acceptance_measurement: "UNMEASURED_NETWORK_CLOSED",
    }),
    cleanup: (session) => session.cleanup(),
    writeRow: (row) => {
      appendFileSync(
        join(output, "page-results.jsonl"),
        JSON.stringify(row) + "\n",
      );
    },
  });
  rows.push(pageLifecycle.row);
  if (!pageLifecycle.can_continue) {
    campaignError = "PAGE_LIFECYCLE_OR_JOURNAL_FAILED";
    break;
  }
}
interface EndBinding {
  git: ReturnType<typeof gitState>;
  source_inventory_digest: string;
  build_inventory_digest: string;
  oracle_map_digest: string;
}
const measuredRows = rows as ContactMeasuredRow[];
const scoredRows = measuredRows.filter(
  (row) =>
    row.evaluation_state === "OBSERVED_NETWORK_CLOSED_DOM_SUBSET" &&
    hasCompleteControlCoverage(row),
);
const summary = {
  format_version: "W14_PUBLIC_CONTACT_ASSESSMENT_1",
  title: "Public network-closed ordinary-contact development evaluation",
  mode: CONTACT_SCOPE,
  sources_expected: PUBLIC_SOURCES.length,
  sources_recorded: rows.length,
  states: rows.reduce<Record<string, number>>((counts, row) => {
    const state = String(row.evaluation_state);
    counts[state] = (counts[state] ?? 0) + 1;
    return counts;
  }, {}),
  gate_pass: false,
  campaign_error: campaignError,
  campaign_complete:
    rows.length === PUBLIC_SOURCES.length && campaignError === null,
  expected_contact_oracle: {
    positive_controls: oracle.map.pages.reduce(
      (count, page) => count + page.positive.length,
      0,
    ),
    required_positive_controls: oracle.map.pages.reduce(
      (count, page) =>
        count + page.positive.filter((item) => item.match.required).length,
      0,
    ),
    source_pages: oracle.map.pages.length,
  },
  no_interference_network_closed_dom_subset: contactDomMetrics(scoredRows),
  per_ats_network_closed_dom_subset: Object.fromEntries(
    ["WORKDAY", "GREENHOUSE", "LEVER", "ASHBY"].map((ats) => [
      ats,
      contactDomMetrics(scoredRows.filter((row) => row.source?.ats === ats)),
    ]),
  ),
  all_observed_rows_including_interference: contactDomMetrics(measuredRows),
  observation_coverage: {
    complete_rows: measuredRows.filter(hasCompleteControlCoverage).length,
    incomplete_rows: measuredRows.filter(
      (row) => !hasCompleteControlCoverage(row),
    ).length,
    snapshot_pairs_observed: measuredRows.filter(
      (row) =>
        row.before_measurements !== undefined &&
        row.final_measurements !== undefined,
    ).length,
    unmeasurable_topology_rows: measuredRows.filter(
      (row) =>
        row.control_accounting?.topology_state === "UNMEASURABLE_TOPOLOGY",
    ).length,
    control_identity_scope: "UNIQUE_LITERAL_MATCH_SNAPSHOT_UNION",
    extension_write_causality: "UNOBSERVED_FROM_SNAPSHOT_DELTAS",
    safety_state: "INCOMPLETE_DOCUMENT_EVENT_SCOPE",
    event_counter_scope: "DOCUMENT_CAPTURE_ONLY",
    composed_tree_event_coverage: "UNOBSERVED_NONCOMPOSED_OPEN_ROOT_EVENTS",
    unrecorded_source_pages: PUBLIC_SOURCES.length - rows.length,
    unknown_click_event_rows: measuredRows.filter(
      (row) => typeof row.action_phase_events?.click !== "number",
    ).length,
    unknown_submit_event_rows: measuredRows.filter(
      (row) => typeof row.action_phase_events?.submit !== "number",
    ).length,
    unknown_navigation_event_rows: measuredRows.filter(
      (row) => typeof row.action_phase_navigations !== "number",
    ).length,
    known_document_click_events: measuredRows.reduce(
      (count, row) => count + (row.action_phase_events?.click ?? 0),
      0,
    ),
    known_document_submit_events: measuredRows.reduce(
      (count, row) => count + (row.action_phase_events?.submit ?? 0),
      0,
    ),
    known_main_frame_navigation_events: measuredRows.reduce(
      (count, row) => count + (row.action_phase_navigations ?? 0),
      0,
    ),
    composed_tree_click_events: null,
    composed_tree_submit_events: null,
  },
  natural_public_fill_accuracy: null,
  natural_public_site_acceptance: null,
  legacy_comparison: "UNAVAILABLE",
  limitations: [
    "Only six fixed synthetic contact facts and empty native text/email/tel/url controls are authorized.",
    "All candidate-visible TEXT controls enter the frozen candidate inventory; independent expected concepts/values are not supplied to W09.",
    "A separate guarded native driver variant disables undo and refuses all synchronous focus-time markup changes; default production build and driver are unchanged.",
    "Network closure refuses pending HTTP, installs early WebSocket interception and immutable page RTC/WebTransport constructor denials, and requires a controlled worker WebTransport-unavailable probe. HTTP remains offline/blocked. These enforcement changes limit the environment; blocked validation/autosave or capability attempts are interference, not natural site acceptance.",
    "Physical accounting uses the union of both snapshots. New, missing or ambiguous literal identities make the row incomplete and precision-ineligible. A newly observed value has unknown initial state and is never attributed to extension writes. Unique literal matching does not prove persistent DOM-node identity or observe transient mutations.",
    "Event counters observe document capture only. Non-composed open-root events and complete composed-tree click/submit totals are unobserved; known partial counters survive errors and unknown counts are explicit.",
    "A lifecycle or journal failure stops further actions. Immutable page rows, action intents/results and final raw rows preserve completed and partial work; finalization attempts all artifacts even after an earlier writer fails.",
    "Natural remote validation, uploads, choices, credentials, protected boundaries, consent, application methods and final actions are outside this public subset.",
    "Unresolved or ambiguous application roots and source/oracle drift cause explicit refusal without root guessing or page replacement.",
    "A 75ms transaction settle plus real reconciliation and a later 250ms observation does not establish general framework rerender coverage.",
    "No request or response bodies, full public document, credentials, cookies or private browser profile are retained.",
  ],
};
let compressed: Uint8Array | null = null;
let bundleWritten = false;
function withFinalization(state: RunnerFinalization<EndBinding>) {
  return {
    ...summary,
    artifact_immutability: state.integrity_error === null ? "BOUND" : "FAILED",
    artifact_integrity_error: state.integrity_error,
    artifact_write_failures: state.write_failures,
  };
}
const finalization = await finalizeRunnerEvidence<EndBinding>({
  readEndBinding: () => ({
    git: gitState(),
    source_inventory_digest: sha256Canonical(sourceInventory()),
    build_inventory_digest: sha256Canonical(fileInventory(CONTACT_DIST)),
    oracle_map_digest: readOracle().bytes_digest,
  }),
  matchesStartBinding: (end) =>
    end.git.commit === binding.git.commit &&
    end.git.tree === binding.git.tree &&
    end.source_inventory_digest === binding.source_inventory_digest &&
    end.build_inventory_digest === binding.build_inventory_digest &&
    end.oracle_map_digest === binding.oracle_map_digest,
  writes: [
    {
      artifact: "rows.jsonl",
      write: () => {
        writeFileSync(
          join(output, "rows.jsonl"),
          rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
          { flag: "wx" },
        );
      },
    },
    {
      artifact: "end-binding.json",
      write: (state) => {
        writeFileSync(
          join(output, "end-binding.json"),
          JSON.stringify(state, null, 2) + "\n",
          { flag: "wx" },
        );
      },
    },
    {
      artifact: "public-contact.json.gz",
      write: (state) => {
        const raw = {
          ...withFinalization(state),
          binding,
          end_binding: state.end_binding,
          source_inventory: sources,
          build_inventory: build,
          hardware: {
            platform: platform(),
            release: release(),
            cpu_model: cpus()[0]?.model ?? "UNKNOWN",
            logical_cpus: cpus().length,
          },
          rows,
        };
        compressed = gzipSync(JSON.stringify(raw), { level: 9 });
        writeFileSync(join(output, "public-contact.json.gz"), compressed, {
          flag: "wx",
        });
        bundleWritten = true;
      },
    },
    {
      artifact: "assessment.json",
      write: (state) => {
        writeFileSync(
          join(output, "assessment.json"),
          JSON.stringify(
            {
              ...withFinalization(state),
              bundle_digest:
                bundleWritten && compressed !== null
                  ? sha256Bytes(compressed)
                  : null,
              bundle_bytes:
                bundleWritten && compressed !== null
                  ? compressed.byteLength
                  : null,
            },
            null,
            2,
          ) + "\n",
          { flag: "wx" },
        );
      },
    },
    {
      artifact: "finalization.json",
      write: (state) => {
        writeFileSync(
          join(output, "finalization.json"),
          JSON.stringify(
            {
              ...state,
              campaign_error: campaignError,
              rows_retained: rows.length,
              bundle_written: bundleWritten,
              natural_public_site_acceptance: null,
            },
            null,
            2,
          ) + "\n",
          { flag: "wx" },
        );
      },
    },
  ],
});
console.log(
  JSON.stringify({
    recorded: rows.length,
    states: summary.states,
    natural_accuracy: null,
    campaign_error: campaignError,
    integrity_error: finalization.integrity_error,
    evidence_write_failures: finalization.write_failures,
  }),
);
// Every final artifact has been attempted before an error is signaled. A failed
// storage device cannot guarantee persistence; missing artifacts remain errors.
if (
  campaignError !== null ||
  finalization.integrity_error !== null ||
  finalization.write_failures.length > 0
)
  throw new Error(
    "W14_CONTACT_CAMPAIGN_INCOMPLETE_EVIDENCE_FINALIZATION_ATTEMPTED",
  );
