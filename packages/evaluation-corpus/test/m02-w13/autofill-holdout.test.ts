import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  executeAuthorizedHoldout,
  type AuthorizedHoldoutInput,
} from "../../src/autofill-holdout.ts";
import { verifyOwnerHoldout } from "../../src/owner-holdout.ts";
import {
  createOwnerRoot,
  hiddenCase,
  FILE_ID_1,
  ARTIFACT_REF_1,
} from "../m02-w06/support.ts";
import {
  required,
  makeRequest,
  trustedContext,
  FixedClock,
  adapterReturning,
  makeObservation,
} from "../../../evaluation-runner/test/m02-w05/support/fixtures.ts";
function fixture() {
  const standIn = createOwnerRoot();
  const snapshot = verifyOwnerHoldout(standIn.root);
  const request = makeRequest([hiddenCase()]);
  const boundRequest = {
    ...request,
    holdout: {
      policy: "CALLER_SUPPLIED_MANIFEST_V1" as const,
      state: "VALID" as const,
      manifest_id: snapshot.manifest.manifest_id,
      manifest_digest: snapshot.manifest.manifest_digest as `sha256:${string}`,
    },
  };
  const input: AuthorizedHoldoutInput = {
    authorized_root: standIn.root,
    manifest: snapshot.manifest,
    case_files: [{ file_id: FILE_ID_1, bytes: readFileSync(standIn.bodyPath) }],
    artifacts: [
      {
        artifact_ref: ARTIFACT_REF_1,
        bytes: readFileSync(standIn.artifactPath),
      },
    ],
    request: boundRequest,
    trusted_context: trustedContext(boundRequest),
  };
  return { input, standIn };
}
const factory = () => adapterReturning((c) => makeObservation(c));
describe("W13 explicit-input holdout interface (temporary synthetic stand-ins only)", () => {
  it("executes accepted runner and returns only redacted aggregates", async () => {
    const f = fixture();
    try {
      const result = await executeAuthorizedHoldout(
        f.input,
        factory,
        new FixedClock(),
      );
      expect(result.counts.total_cases).toBe(1);
      const text = JSON.stringify(result);
      expect(text).not.toContain(f.standIn.root);
      expect(text).not.toContain("synthetic artifact preimage");
      expect(text).not.toContain("fields");
      expect(text).not.toContain('"cases":');
    } finally {
      f.standIn.cleanup();
    }
  });
  it.each([
    "absent_root",
    "manifest",
    "case_preimage",
    "artifact_preimage",
    "missing_case",
    "missing_artifact",
    "candidate_sha",
    "request_manifest",
  ])("refuses %s without a result", async (mutation) => {
    const f = fixture();
    try {
      let input = f.input;
      switch (mutation) {
        case "absent_root":
          input = { ...input, authorized_root: "" };
          break;
        case "manifest":
          input = { ...input, manifest: {} };
          break;
        case "case_preimage":
          input = {
            ...input,
            case_files: [
              {
                ...required(input.case_files[0], "case file"),
                bytes: new Uint8Array([1]),
              },
            ],
          };
          break;
        case "artifact_preimage":
          input = {
            ...input,
            artifacts: [
              {
                ...required(input.artifacts[0], "artifact"),
                bytes: new Uint8Array([1]),
              },
            ],
          };
          break;
        case "missing_case":
          input = { ...input, case_files: [] };
          break;
        case "missing_artifact":
          input = { ...input, artifacts: [] };
          break;
        case "candidate_sha":
          input = {
            ...input,
            request: {
              ...input.request,
              repository: {
                ...input.request.repository,
                commit: "f".repeat(40),
              },
            },
          };
          break;
        case "request_manifest":
          input = {
            ...input,
            request: {
              ...input.request,
              holdout: {
                policy: "DEVELOPMENT_NOT_APPLICABLE_V1",
                state: "NOT_APPLICABLE",
                development_commitment_digest:
                  input.request.runtime_commitment_digest,
              },
            },
          };
          break;
      }
      await expect(
        executeAuthorizedHoldout(input, factory, new FixedClock()),
      ).rejects.toThrow("W13_HOLDOUT_REFUSED");
    } finally {
      f.standIn.cleanup();
    }
  });
  it("rejects missing explicit root before trusting an ambient env value", async () => {
    const previous = process.env.JAPP_HOLDOUT_V1_ROOT;
    process.env.JAPP_HOLDOUT_V1_ROOT = "not-an-input-and-must-not-be-read";
    try {
      await expect(
        executeAuthorizedHoldout(
          {} as AuthorizedHoldoutInput,
          factory,
          new FixedClock(),
        ),
      ).rejects.toThrow("W13_HOLDOUT_REFUSED");
    } finally {
      if (previous === undefined) delete process.env.JAPP_HOLDOUT_V1_ROOT;
      else process.env.JAPP_HOLDOUT_V1_ROOT = previous;
    }
  });
});

it("private adapter errors are redacted and storage drift refuses publication", async () => {
  const f = fixture();
  try {
    let message = "";
    try {
      await executeAuthorizedHoldout(
        f.input,
        () => {
          throw new Error(`synthetic hidden answer at ${f.standIn.root}`);
        },
        new FixedClock(),
      );
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toBe("W13_HOLDOUT_REFUSED");
    const drift = () =>
      adapterReturning((c) => {
        const observation = makeObservation(c);
        writeFileSync(f.standIn.artifactPath, "synthetic changed preimage");
        return observation;
      });
    await expect(
      executeAuthorizedHoldout(f.input, drift, new FixedClock()),
    ).rejects.toThrow("W13_HOLDOUT_REFUSED");
  } finally {
    f.standIn.cleanup();
  }
});
