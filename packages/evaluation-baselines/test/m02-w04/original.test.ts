// ORIGINAL_UNTAILORED baseline: exact passthrough with proven input
// non-mutation and metadata kept beside — never inside — the artifact.
import { describe, expect, test } from "vitest";

import {
  canonicalJson,
  originalUntailoredStructured,
  originalUntailoredText,
  sha256Bytes,
  sha256Canonical,
} from "../../src/index.ts";
import {
  corpus,
  devCase,
  loadOracle,
  resolveTextInput,
} from "./support/inputs.ts";

const oracle = loadOracle();

function resumeOne() {
  const record = corpus().sourceResumes.find(
    (candidate) => candidate.id === oracle.fixture_bindings.resume_1_id,
  );
  if (record === undefined) {
    throw new Error("resume fixture missing");
  }
  return record;
}

describe("original untailored passthrough", () => {
  test("text passthrough is byte-identical to the input projection", () => {
    const caseRecord = devCase("ORIGINAL_UNTAILORED", "TEXT_IDENTITY");
    if (caseRecord.candidate === undefined) {
      throw new Error("text case is missing its input");
    }
    const text = resolveTextInput(caseRecord.candidate);
    const result = originalUntailoredText(text, "RESUME_TEXT");
    expect(result.candidate_text).toBe(text);
    expect(result.byte_identical_to_input).toBe(true);
    expect(sha256Bytes(result.candidate_text)).toBe(
      oracle.fixture_bindings.resume_1_projection_sha256,
    );
    expect([...result.classification]).toEqual([
      "EVALUATION_ONLY",
      "NON_PRODUCTION",
    ]);
  });

  test("structured passthrough preserves the exact canonical content and ordering", () => {
    const input = resumeOne();
    const result = originalUntailoredStructured(input);
    expect(result.input_content_digest).toBe(
      oracle.fixture_bindings.resume_1_record_digest,
    );
    expect(result.output_content_digest).toBe(result.input_content_digest);
    expect(JSON.stringify(result.candidate_record)).toBe(JSON.stringify(input));
    expect(Object.keys(result.candidate_record)).toEqual(Object.keys(input));
  });

  test("the output is a distinct object and the input is not mutated", () => {
    const input = resumeOne();
    const before = canonicalJson(input);
    const beforeDigest = sha256Canonical(input);
    const result = originalUntailoredStructured(input);
    expect(result.candidate_record).not.toBe(input);
    expect(result.candidate_record.facts).not.toBe(input.facts);
    expect(canonicalJson(input)).toBe(before);
    expect(sha256Canonical(input)).toBe(beforeDigest);
  });

  test("evaluation metadata stays beside the artifact, never inside it", () => {
    const input = resumeOne();
    const result = originalUntailoredStructured(input);
    const artifactKeys = Object.keys(result.candidate_record);
    expect(artifactKeys).not.toContain("baseline_id");
    expect(artifactKeys).not.toContain("classification");
    expect(result.baseline_id).toBe("baseline_original_untailored_v1");
    const textResult = originalUntailoredText("exact text", "ANSWER_TEXT");
    expect(textResult.candidate_text).toBe("exact text");
  });
});
