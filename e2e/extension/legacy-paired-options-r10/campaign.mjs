/** Read-only frozen campaign loader. No browser or server is started here. */
import process from "node:process";
import { assertR10Bound } from "./r10-readiness.mjs";
import { assertRuntimeInventory } from "./runtime-inventory.ts";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
import { isAbsolute, join } from "node:path";
export const here = fileURLToPath(new URL(".", import.meta.url));
export const sha = (bytes) =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");
export const canonical = (value) => {
  if (value === null || ["string", "boolean"].includes(typeof value))
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
        .join(",") +
      "}"
    );
  throw new Error("PAIRED_OPTIONS_NONCANONICAL_VALUE");
};
export const canonicalSha = (value) => sha(canonical(value));
/** @param {{ legacyRoot?: string, candidateRoot?: string }} [options] */
export function loadCampaign({ legacyRoot, candidateRoot } = {}) {
  assertR10Bound();
  const bytes = readFileSync(join(here, "campaign.lock.json"));
  const expected = process.env.JAPP_W14_PAIRED_EXPECTED_LOCK;
  if (expected === undefined || expected !== sha(bytes))
    throw new Error("PAIRED_OPTIONS_LOCK_COMMITMENT_REQUIRED_OR_DRIFTED");
  const lock = JSON.parse(bytes.toString("utf8"));
  if (lock.format_version !== "W14_PAIRED_OPTIONS_CAMPAIGN_LOCK_1")
    throw new Error("PAIRED_OPTIONS_LOCK_FORMAT_REFUSED");
  for (const file of lock.files) {
    if (file.path.startsWith("/") || file.path.split("/").includes(".."))
      throw new Error("PAIRED_OPTIONS_PATH_REFUSED");
    if (sha(readFileSync(join(here, file.path))) !== file.sha256)
      throw new Error("PAIRED_OPTIONS_FROZEN_FILE_DRIFT:" + file.path);
  }
  const read = (path) => JSON.parse(readFileSync(join(here, path), "utf8"));
  const bindings = read("source-bindings.json");
  const inputs = read("paired-inputs.json");
  const original = read("preimages/evaluation-inputs.json");
  const oracles = read("paired-oracles.json");
  const projections = read("legacy-projections.json");
  if (
    bindings.format_version !== "W14_PAIRED_OPTIONS_SOURCE_BINDING_1" ||
    inputs.length !== 4 ||
    oracles.length !== 4 ||
    bindings.cases.length !== 4 ||
    projections.length !== 4
  )
    throw new Error("PAIRED_OPTIONS_INVENTORY_REFUSED");
  const originalProfile = read("preimages/evaluation-profile.json");
  for (const [index, entry] of inputs.entries()) {
    const prior = original[index];
    const bound = bindings.cases[index];
    if (
      entry.case_id !== bound.case_id ||
      entry.case_id === prior.case_id ||
      entry.fixture_id !== prior.fixture_id ||
      entry.input.html !== prior.input.html ||
      canonicalSha(entry.input) !== bound.input_digest ||
      canonicalSha(oracles[index]) !== bound.oracle_digest ||
      Object.keys(entry.input).sort().join() !== "html,profile" ||
      entry.input.profile.length !== prior.input.profile.length
    )
      throw new Error("PAIRED_OPTIONS_INPUT_OR_ORACLE_DRIFT");
    for (const [factIndex, fact] of entry.input.profile.entries()) {
      const old = prior.input.profile[factIndex];
      const token =
        fact.concept === "ADDRESS_COUNTRY"
          ? "United States"
          : fact.concept === "ADDRESS_REGION"
            ? "Michigan"
            : undefined;
      if (
        old.concept !== fact.concept ||
        old.value !== fact.value ||
        fact.valueToken !== token ||
        Object.keys(fact).sort().join() !==
          (token === undefined ? "concept,value" : "concept,value,valueToken")
      )
        throw new Error("PAIRED_OPTIONS_NONDECLARED_FACT_DELTA");
    }
    const projected = projectLegacyFacts(entry);
    if (
      canonical(projected) !== canonical(projections[index]) ||
      canonical(projected.profile) !== canonical(originalProfile)
    )
      throw new Error("PAIRED_OPTIONS_LEGACY_PROJECTION_DRIFT");
  }
  if (legacyRoot !== undefined) {
    if (!isAbsolute(legacyRoot))
      throw new Error("PAIRED_OPTIONS_ABSOLUTE_LEGACY_ROOT_REQUIRED");
    for (const source of bindings.legacy_sources)
      if (sha(readFileSync(join(legacyRoot, source.path))) !== source.sha256)
        throw new Error(
          "PAIRED_OPTIONS_LEGACY_RUNTIME_SOURCE_DRIFT:" + source.path,
        );
  }
  if (candidateRoot !== undefined) {
    if (!isAbsolute(candidateRoot))
      throw new Error("PAIRED_OPTIONS_ABSOLUTE_CANDIDATE_ROOT_REQUIRED");
    assertRuntimeInventory(candidateRoot, bindings);
  }
  return { lock_digest: sha(bytes), bindings, inputs, oracles, projections };
}
export function projectLegacyFacts(entry) {
  const facts = new Map(
    entry.input.profile.map((fact) => [fact.concept, fact]),
  );
  if (facts.size !== 10 || entry.input.profile.length !== 10)
    throw new Error("PAIRED_OPTIONS_FACT_SET_REFUSED");
  const required = (concept) => {
    const fact = facts.get(concept);
    if (fact === undefined || typeof fact.value !== "string")
      throw new Error("PAIRED_OPTIONS_FACT_MISSING:" + concept);
    return fact.value;
  };
  const profile = {
    full_name: required("FIRST_NAME") + " " + required("LAST_NAME"),
    email: required("EMAIL_ADDRESS"),
    phone: required("PHONE_NUMBER"),
    website_url: required("WEBSITE_URL"),
    address_street1: required("ADDRESS_LINE_1"),
    address_city: required("ADDRESS_CITY"),
    address_state: required("ADDRESS_REGION"),
    address_zip: required("ADDRESS_POSTAL_CODE"),
    address_country_name: required("ADDRESS_COUNTRY"),
  };
  return {
    case_id: entry.case_id,
    input_digest: canonicalSha(entry.input),
    profile,
    unsupported_metadata: entry.input.profile
      .filter((fact) => fact.valueToken !== undefined)
      .map((fact) => ({
        concept: fact.concept,
        valueToken: fact.valueToken,
        handling: "OMITTED_BY_LEGACY_PROFILE_ADAPTER_UNSUPPORTED_METADATA",
      })),
    added_default_facts: [],
  };
}

export function requireNativeAudit(audit, campaign) {
  const expected = campaign.bindings.native_observer;
  if (
    audit?.coverage !== "COMPLETE_INSTALLED_NATIVE_SURFACES" ||
    audit.source !== expected.source ||
    audit.realm !== expected.realm ||
    canonical([...audit.surfaces].sort()) !==
      canonical([...expected.surfaces].sort()) ||
    canonicalSha(audit.witnesses) !== audit.witnesses_digest
  )
    throw new Error("PAIRED_OPTIONS_NATIVE_SCOPE_OR_INTEGRITY_REFUSED");
}
