// M02-W09 option-semantics matrix O1–O7 (REQ-FORM-023 feasibility portion):
// options resolve only through reviewed semantic evidence, and the number
// of rendered options is never selection evidence.
import { describe, expect, it } from "vitest";

import { resolveIntendedOption } from "../src/option-resolver.ts";
import { conceptRule } from "../src/ontology.ts";
import {
  buildDescriptor,
  type DescriptorOptionSpec,
} from "./support/build-descriptor.ts";

const WORK_MODE = conceptRule("WORK_MODE_PREFERENCE");
const AUTHORIZATION = conceptRule("WORK_AUTHORIZATION");

async function workModeDescriptor(options: readonly DescriptorOptionSpec[]) {
  return buildDescriptor({
    label: "Preferred work mode (required)",
    controlKind: "SELECT",
    options,
    required: true,
  });
}

describe("O1 exact semantic option match", () => {
  it("resolves the intended option by exact normalized label", async () => {
    const descriptor = await workModeDescriptor([
      { label: "Select a work mode" },
      { label: "On-site", token: "onsite" },
      { label: "Hybrid", token: "hybrid" },
      { label: "Remote", token: "remote" },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution.status).toBe("RESOLVED");
    if (resolution.status === "RESOLVED") {
      expect(resolution.valueDigest).toBe(descriptor.options[3]?.value_digest);
    }
  });
});

describe("O2 reviewed alias match", () => {
  it("resolves through a catalog-approved alias label", async () => {
    const descriptor = await workModeDescriptor([
      { label: "On-site", token: "onsite" },
      { label: "Hybrid", token: "hybrid" },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "ONSITE");
    expect(resolution.status).toBe("RESOLVED");
    if (resolution.status === "RESOLVED") {
      expect(resolution.valueDigest).toBe(descriptor.options[0]?.value_digest);
      expect(resolution.matchedBy).toBe("APPROVED_ALIAS_LABEL");
    }
  });

  it("resolves through the inert stable value token when the label is digest-only", async () => {
    const descriptor = await workModeDescriptor([
      { label: "", token: "remote" },
      { label: "", token: "onsite" },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution.status).toBe("RESOLVED");
    if (resolution.status === "RESOLVED") {
      expect(resolution.matchedBy).toBe("STABLE_TOKEN");
    }
  });
});

describe("O3 single unrelated option", () => {
  it("abstains instead of selecting the only rendered option", async () => {
    const descriptor = await workModeDescriptor([{ label: "Gold tier" }]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "NO_SEMANTIC_MATCH",
    });
  });

  it("abstains for a yes/no concept with one unrelated rendered option", async () => {
    const descriptor = await buildDescriptor({
      label: "Work authorization",
      controlKind: "SELECT",
      options: [{ label: "Acknowledged" }],
    });
    const resolution = resolveIntendedOption(
      descriptor,
      AUTHORIZATION,
      "AUTHORIZED",
    );
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "NO_SEMANTIC_MATCH",
    });
  });
});

describe("O4 many unrelated options", () => {
  it("abstains identically regardless of option count", async () => {
    const descriptor = await workModeDescriptor([
      { label: "Gold tier" },
      { label: "Silver tier" },
      { label: "Bronze tier" },
      { label: "Platinum tier" },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "NO_SEMANTIC_MATCH",
    });
  });
});

describe("O5 ambiguous semantic matches", () => {
  it("abstains when two rendered options both match the intended value", async () => {
    const descriptor = await workModeDescriptor([
      { label: "Remote" },
      { label: "remote" },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "AMBIGUOUS_OPTION_MATCHES",
    });
  });
});

describe("O6 disabled matching option", () => {
  it("never returns a disabled option as an executable decision", async () => {
    const descriptor = await workModeDescriptor([
      { label: "On-site", token: "onsite" },
      { label: "Remote", token: "remote", disabled: true },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "MATCHED_OPTION_DISABLED",
    });
  });
});

describe("O7 placeholders and unmapped values", () => {
  it("never chooses a placeholder merely because it is available", async () => {
    const descriptor = await workModeDescriptor([
      { label: "Select a work mode" },
    ]);
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "NO_SEMANTIC_MATCH",
    });
  });

  it("abstains when the catalog has no option semantics for the approved value", async () => {
    const descriptor = await workModeDescriptor([
      { label: "On-site", token: "onsite" },
    ]);
    const resolution = resolveIntendedOption(
      descriptor,
      WORK_MODE,
      "TELECOMMUTE",
    );
    expect(resolution).toEqual({
      status: "ABSTAINED",
      reason: "NO_OPTION_SEMANTICS_FOR_VALUE",
    });
  });

  it("abstains on an option-free descriptor", async () => {
    const descriptor = await buildDescriptor({
      label: "Preferred work mode",
      controlKind: "SELECT",
    });
    const resolution = resolveIntendedOption(descriptor, WORK_MODE, "REMOTE");
    expect(resolution).toEqual({ status: "ABSTAINED", reason: "NO_OPTIONS" });
  });
});
