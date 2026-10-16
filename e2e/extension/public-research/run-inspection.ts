/** One bounded, explicit public inspection pass. No writes or automated clicks. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import {
  sha256Bytes,
  sha256Canonical,
} from "../../../packages/evaluation-runner/src/canonical.ts";
import {
  PUBLIC_SCOPE_VERSION,
  PUBLIC_SOURCES,
  SOURCE_INVENTORY_DIGEST,
} from "../../../apps/extension/test/m02-w14/public-inspection/scope.ts";
import {
  launchInspection,
  scanPublicPage,
  PUBLIC_EXTENSION_DIST,
} from "./inspection-harness.ts";

const output = process.env.JAPP_W14_PUBLIC_ARTIFACT_DIRECTORY;
if (output === undefined || !isAbsolute(output))
  throw new Error("W14_EXPLICIT_ABSOLUTE_OUTPUT_REQUIRED");
function inventory(
  root: string,
  prefix = "",
): { path: string; digest: string }[] {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error("W14_BUILD_SYMLINK_REFUSED");
      return entry.isDirectory()
        ? inventory(root, path)
        : [{ path, digest: sha256Bytes(readFileSync(join(root, path))) }];
    });
}
const buildInventory = inventory(PUBLIC_EXTENSION_DIST);
function sourceFacts() {
  const sourceInventory = [
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
  return {
    inventory: sourceInventory,
    digest: sha256Canonical(sourceInventory),
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
const startSource = sourceFacts();
const sourceMatrixBytes = readFileSync(
  "docs/evidence/m02-w14-external/public-current-matrix.json",
);
if (sha256Bytes(sourceMatrixBytes) !== SOURCE_INVENTORY_DIGEST)
  throw new Error("W14_PUBLIC_SOURCE_MATRIX_DIGEST");
const sourceMatrix = JSON.parse(sourceMatrixBytes.toString("utf8")) as {
  rows: { evidence_row_id: string; ats: string; url: string }[];
};
if (
  sha256Canonical(
    sourceMatrix.rows.map(({ evidence_row_id, ats, url }) => ({
      evidence_row_id,
      ats,
      url,
    })),
  ) !== sha256Canonical(PUBLIC_SOURCES)
)
  throw new Error("W14_PUBLIC_SOURCE_MATRIX_INVENTORY");
const manifestDigest = sha256Bytes(
  readFileSync(resolve(PUBLIC_EXTENSION_DIST, "manifest.json")),
);
const session = await launchInspection();
const rows: unknown[] = [];
const counts: Record<string, number> = {};
try {
  for (const source of PUBLIC_SOURCES) {
    const page = await session.context.newPage();
    const events: Record<string, number> = {
      input: 0,
      change: 0,
      click: 0,
      submit: 0,
    };
    await page.exposeBinding(
      "__jappW14InspectionEvent",
      (_origin, type: unknown) => {
        if (typeof type === "string" && Object.hasOwn(events, type))
          events[type] = (events[type] ?? 0) + 1;
      },
    );
    await page.addInitScript(() => {
      const host = globalThis as unknown as {
        __jappW14InspectionEvent(type: string): Promise<void>;
      };
      for (const kind of ["input", "change", "click", "submit"])
        document.addEventListener(
          kind,
          (event) => {
            void host.__jappW14InspectionEvent(event.type);
          },
          true,
        );
    });
    try {
      const response = await page.goto(source.url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(1000);
      const beforeEvents = { ...events };
      const started = performance.now();
      const observation = await scanPublicPage(
        session,
        page,
        source.evidence_row_id,
      );
      const duration = performance.now() - started;
      counts[observation.state] = (counts[observation.state] ?? 0) + 1;
      rows.push({
        source,
        observed_at: new Date().toISOString(),
        http_status: response?.status() ?? null,
        actual_url_digest: sha256Canonical(page.url()),
        observation,
        scan_and_reconcile_ms: duration,
        page_events_before_inspection: beforeEvents,
        page_events_after_inspection: { ...events },
        input_entered_by_harness: false,
        action_request_sent: false,
        submission_activated_by_harness: false,
      });
    } catch (error) {
      counts.INSPECTION_FAILED = (counts.INSPECTION_FAILED ?? 0) + 1;
      rows.push({
        source,
        state: "INSPECTION_FAILED",
        error_type:
          error instanceof Error && error.name === "TimeoutError"
            ? "TimeoutError"
            : "UNOBSERVED_ERROR",
        input_entered_by_harness: false,
      });
    } finally {
      await page.close();
    }
  }
  const endSource = sourceFacts();
  const endBuildDigest = sha256Canonical(inventory(PUBLIC_EXTENSION_DIST));
  const immutable =
    startSource.digest === endSource.digest &&
    startSource.commit === endSource.commit &&
    startSource.tree === endSource.tree &&
    sha256Canonical(buildInventory) === endBuildDigest;
  const summary = {
    format_version: "W14_PUBLIC_INSPECTION_ASSESSMENT_1",
    authority: "NONE",
    mode: PUBLIC_SCOPE_VERSION,
    public_source_inventory_digest: SOURCE_INVENTORY_DIGEST,
    candidate_source_inventory_digest: startSource.digest,
    attribution_state: immutable
      ? "IMMUTABLE_CANDIDATE"
      : "REFUSED_CHANGED_CANDIDATE",
    immutability: {
      source_unchanged: startSource.digest === endSource.digest,
      git_unchanged:
        startSource.commit === endSource.commit &&
        startSource.tree === endSource.tree,
      build_unchanged: sha256Canonical(buildInventory) === endBuildDigest,
      end_source_digest: endSource.digest,
      end_build_digest: endBuildDigest,
    },
    expected_sources: PUBLIC_SOURCES.length,
    recorded_sources: rows.length,
    states: counts,
    browser_version: session.context.browser()?.version() ?? "UNKNOWN",
    public_extension_fill_evaluations: 0,
    public_scored_controls: 0,
    limitations: [
      "Scanner/reconciliation inspection only; no field value, widget, application-method, session, consent, challenge or submission action was sent.",
      "Workday method-choice boundaries can have no application root; such outcomes remain observed boundaries, not successful fills.",
      "The page-event counters include events generated by the public website; they are observational and do not infer agent action authority.",
      "No full document, cookies, network bodies, private account session or existing browser profile is retained.",
    ],
  };
  const bundle = {
    ...summary,
    repository: {
      commit: startSource.commit,
      tree: startSource.tree,
      dirty: startSource.dirty,
    },
    manifest_digest: manifestDigest,
    build_inventory: buildInventory,
    build_inventory_digest: sha256Canonical(buildInventory),
    source_inventory: startSource.inventory,
    rows,
  };
  const compressed = gzipSync(JSON.stringify(bundle), { level: 9 });
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "public-inspection.json.gz"), compressed);
  writeFileSync(
    resolve(output, "assessment.json"),
    JSON.stringify(
      {
        ...summary,
        bundle_digest: sha256Bytes(compressed),
        bundle_bytes: compressed.byteLength,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      recorded_sources: rows.length,
      states: counts,
      field_writes: 0,
      scored_controls: 0,
    }),
  );
  if (!immutable)
    throw new Error("W14_PUBLIC_CANDIDATE_CHANGED_DURING_INSPECTION");
} finally {
  await session.cleanup();
}
