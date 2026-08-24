// M02-W09 ontology catalog integrity: closed, versioned, reviewable rules.
import { describe, expect, it } from "vitest";

import { normalizeEvidence } from "../src/evidence-text.ts";
import {
  FEASIBILITY_CONCEPTS,
  FEASIBILITY_ONTOLOGY_VERSION,
  FEASIBILITY_VALUE_POLICIES,
  UNKNOWN_CONCEPT,
  conceptRule,
  feasibilityCatalog,
  isFeasibilityConcept,
  strictestPolicy,
} from "../src/ontology.ts";

const ENUM_TOKEN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

describe("feasibility ontology catalog", () => {
  it("is versioned with a strict semantic version", () => {
    expect(FEASIBILITY_ONTOLOGY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is a closed catalog: every concept appears exactly once", () => {
    const catalogConcepts = feasibilityCatalog().map((rule) => rule.concept);
    expect([...catalogConcepts].sort()).toEqual(
      [...FEASIBILITY_CONCEPTS].sort(),
    );
    expect(new Set(catalogConcepts).size).toBe(catalogConcepts.length);
  });

  it("uses canonical enum-token concept identifiers", () => {
    for (const concept of FEASIBILITY_CONCEPTS) {
      expect(concept).toMatch(ENUM_TOKEN);
      expect(concept.length).toBeLessThanOrEqual(64);
    }
    expect(UNKNOWN_CONCEPT).toMatch(ENUM_TOKEN);
    expect(isFeasibilityConcept(UNKNOWN_CONCEPT)).toBe(false);
  });

  it("keeps every alias and negative term in normalized form", () => {
    for (const rule of feasibilityCatalog()) {
      for (const alias of [...rule.aliases, ...rule.negativeLabelTerms]) {
        expect(alias).not.toBe("");
        expect(normalizeEvidence(alias)).toBe(alias);
      }
      expect(rule.aliases.length).toBeGreaterThan(0);
      expect(rule.compatibleControlKinds.length).toBeGreaterThan(0);
    }
  });

  it("keeps option semantics normalized and non-empty", () => {
    for (const rule of feasibilityCatalog()) {
      for (const option of rule.optionValues) {
        expect(option.valueToken).toMatch(ENUM_TOKEN);
        expect(
          option.acceptedLabels.length + option.acceptedTokens.length,
        ).toBeGreaterThan(0);
        for (const label of option.acceptedLabels) {
          expect(normalizeEvidence(label)).toBe(label);
        }
      }
    }
  });

  it("assigns spec §7.6 consequential/sensitive classes to the guarded concepts", () => {
    expect(conceptRule("WORK_AUTHORIZATION").consequential).toBe(true);
    expect(conceptRule("SPONSORSHIP_REQUIREMENT").consequential).toBe(true);
    expect(conceptRule("RELOCATION_PREFERENCE").consequential).toBe(true);
    expect(conceptRule("SALARY_EXPECTATION").sensitivity).toBe("SENSITIVE");
    expect(conceptRule("SALARY_EXPECTATION").minimumPolicy).toBe(
      "CONFIRM_ONCE_PER_JOB",
    );
    expect(conceptRule("DEMOGRAPHIC_DISCLOSURE").sensitivity).toBe("SENSITIVE");
    expect(conceptRule("DEMOGRAPHIC_DISCLOSURE").minimumPolicy).toBe(
      "NEVER_AUTOFILL",
    );
    expect(conceptRule("SECURITY_CLEARANCE").minimumPolicy).toBe(
      "NEVER_AUTOFILL",
    );
    expect(conceptRule("LICENSE_VALIDITY").minimumPolicy).toBe(
      "CONFIRM_IF_RECORD_EXPIRED",
    );
  });

  it("orders policies by strictness with a total, monotone combination", () => {
    for (const left of FEASIBILITY_VALUE_POLICIES) {
      for (const right of FEASIBILITY_VALUE_POLICIES) {
        const combined = strictestPolicy(left, right);
        expect([left, right]).toContain(combined);
        expect(strictestPolicy(right, left)).toBe(combined);
        expect(strictestPolicy(combined, left)).toBe(combined);
        expect(strictestPolicy(combined, right)).toBe(combined);
      }
    }
    expect(strictestPolicy("NEVER_AUTOFILL", "FILL_FROM_EXPLICIT_RECORD")).toBe(
      "NEVER_AUTOFILL",
    );
    expect(
      strictestPolicy("FILL_FROM_EXPLICIT_RECORD", "CONFIRM_ONCE_PER_JOB"),
    ).toBe("CONFIRM_ONCE_PER_JOB");
  });
});
