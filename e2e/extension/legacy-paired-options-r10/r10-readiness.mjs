/** Read-only R10 fence. Source preparation never supplies an execution release. */
import process from "node:process";
import { readFileSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { fileURLToPath, URL } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
export function assertR10Bound() {
  const readiness = JSON.parse(
    readFileSync(here + "r10-readiness.json", "utf8"),
  );
  const bindings = JSON.parse(
    readFileSync(here + "source-bindings.json", "utf8"),
  );
  if (
    readiness.state !== "SOURCE_BOUND_REVIEWED" ||
    !/^sha256:[0-9a-f]{64}$/.test(
      readiness.candidate_runtime_inventory_digest ?? "",
    ) ||
    readiness.candidate_runtime_inventory_digest !==
      bindings.candidate_runtime_inventory_digest ||
    !Array.isArray(bindings.candidate_runtime_sources) ||
    bindings.candidate_runtime_sources.length !==
      readiness.candidate_runtime_inventory_count
  )
    throw new Error("R10_SOURCE_ONLY_FUTURE_CANDIDATE_UNBOUND");
  const path = process.env.JAPP_R10_RELEASE_DESCRIPTOR;
  const commitment = process.env.JAPP_R10_RELEASE_DESCRIPTOR_SHA256;
  if (
    typeof path !== "string" ||
    !isAbsolute(path) ||
    !/^sha256:[0-9a-f]{64}$/.test(commitment ?? "")
  )
    throw new Error("R10_EXACT_OUT_OF_BAND_FULL_PASS_RELEASE_REQUIRED");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("R10_REGULAR_RELEASE_DESCRIPTOR_REQUIRED");
  const bytes = readFileSync(path);
  if (
    "sha256:" + createHash("sha256").update(bytes).digest("hex") !==
    commitment
  )
    throw new Error("R10_RELEASE_DESCRIPTOR_COMMITMENT_DRIFT");
  const release = JSON.parse(bytes.toString("utf8"));
  if (
    release.state !== "FROZEN_REVIEWED_AFTER_EXACT_FULL_PASS" ||
    release.runtime_inventory_digest !==
      bindings.candidate_runtime_inventory_digest ||
    !/^[0-9a-f]{40}$/.test(release.candidate_commit ?? "") ||
    !/^[0-9a-f]{40}$/.test(release.candidate_tree ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(release.full_completion_sha256 ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(
      release.full_independent_verdict_sha256 ?? "",
    ) ||
    !/^sha256:[0-9a-f]{64}$/.test(release.node_binary_sha256 ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(release.pnpm_binary_sha256 ?? "") ||
    !/^sha256:[0-9a-f]{64}$/.test(release.legacy_python_binary_sha256 ?? "") ||
    release.root_source_review_release === null ||
    release.root_source_review_release === undefined
  )
    throw new Error("R10_FUTURE_FULL_PASS_RELEASE_PINS_INCOMPLETE");
  return readiness;
}
