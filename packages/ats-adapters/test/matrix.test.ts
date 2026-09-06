import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureHtml } from "../research/fixture-html.ts";
import {
  ATS_FAMILIES,
  RESEARCH_LAYOUTS,
  RESEARCH_MATRIX,
  RESEARCH_STEPS,
} from "../research/matrix.ts";
import {
  canonicalResearchFile,
  assertSanitizedResearchHtml,
  canonicalResearchJson,
  computeResearchManifest,
  digestBytes,
  readResearchManifest,
  structuralSignature,
  validateResearchManifest,
  W06_PARENT,
} from "../research/manifest.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

describe("M02-W12 canonical synthetic research expansion", () => {
  it("MATRIX4 rejects PII, secret and executable fixture contamination", () => {
    for (const variant of RESEARCH_MATRIX)
      expect(() => {
        assertSanitizedResearchHtml(fixtureHtml(variant));
      }).not.toThrow();
    for (const contaminated of [
      '<input value="person@example.test">',
      "<p>session_token=synthetic-secret-probe</p>",
      "<p>-----BEGIN PRIVATE KEY-----</p>",
      "<script>localProbe()</script>",
      '<img src="https://example.test/capture">',
    ])
      expect(() => {
        assertSanitizedResearchHtml(contaminated);
      }).toThrow("W12_UNSANITIZED_RESEARCH_HTML");
  });
  it("contains 200 independent structures with Workday the largest slice", () => {
    expect(RESEARCH_MATRIX).toHaveLength(200);
    expect(
      ATS_FAMILIES.map(
        (family) =>
          RESEARCH_MATRIX.filter((variant) => variant.ats === family).length,
      ),
    ).toEqual([80, 40, 40, 40]);
    expect(new Set(RESEARCH_MATRIX.map((variant) => variant.id)).size).toBe(
      200,
    );
    expect(new Set(RESEARCH_MATRIX.map((variant) => variant.route)).size).toBe(
      200,
    );
    expect(new Set(RESEARCH_MATRIX.map(structuralSignature)).size).toBe(200);
  });

  it("cannot create another structural case by changing labels and metadata", () => {
    const original = RESEARCH_MATRIX[0];
    if (original === undefined) throw new Error("fixture missing");
    const cosmetic = {
      ...original,
      id: "COSMETIC-ONLY",
      tenant: "renamed",
      route: "/renamed",
      controls: original.controls.map((control) => ({
        ...control,
        label: `Reworded ${control.label}`,
      })),
    };
    expect(structuralSignature(cosmetic)).toBe(structuralSignature(original));
  });

  it("covers every research step, session boundary and material layout", () => {
    expect(new Set(RESEARCH_MATRIX.map((variant) => variant.step))).toEqual(
      new Set(RESEARCH_STEPS),
    );
    expect(new Set(RESEARCH_MATRIX.map((variant) => variant.layout))).toEqual(
      new Set(RESEARCH_LAYOUTS),
    );
    expect(new Set(RESEARCH_MATRIX.map((variant) => variant.session))).toEqual(
      new Set([
        "GUEST",
        "AUTHENTICATED",
        "RETURNING_CANDIDATE",
        "SIGN_IN",
        "CREATE_ACCOUNT",
        "EMAIL_VERIFICATION",
        "MFA",
        "CAPTCHA_OR_BOT_CHALLENGE",
        "SESSION_EXPIRED",
        "DUPLICATE_APPLICATION",
        "PRIVACY_OR_TERMS",
        "UNKNOWN",
      ]),
    );
    expect(
      new Set(
        RESEARCH_MATRIX.filter((variant) => variant.ats === "WORKDAY").map(
          (variant) => variant.locale,
        ),
      ),
    ).toEqual(new Set(["en-US", "en-GB", "de-DE", "fr-CA"]));
  });

  it("materializes distinct country/address semantics rather than translated labels", () => {
    const sample = (locale: string) =>
      RESEARCH_MATRIX.find(
        (variant) =>
          variant.ats === "WORKDAY" &&
          variant.layout === "GROUPED" &&
          variant.step === "MY_INFORMATION" &&
          variant.locale === locale,
      );
    expect(
      sample("en-US")?.controls.find((control) => control.id === "state")?.kind,
    ).toBe("select");
    expect(
      sample("en-GB")?.controls.find((control) => control.id === "building")
        ?.kind,
    ).toBe("text");
    expect(
      sample("de-DE")?.controls.find((control) => control.id === "house-number")
        ?.kind,
    ).toBe("text");
    expect(
      sample("fr-CA")?.controls.find(
        (control) => control.id === "preferred-language",
      )?.options,
    ).toEqual(["Français", "English"]);
  });

  it("commits exact canonical bytes and source provenance without claiming review", () => {
    const manifest = readResearchManifest();
    expect(manifest).toEqual(computeResearchManifest());
    expect(
      readFileSync(
        new URL("../research/expansion.manifest.v1.json", import.meta.url),
        "utf8",
      ),
    ).toBe(canonicalResearchFile(manifest));
    expect(manifest.sourceProvenance.reviewState).toBe("NOT_REVIEWED");
    expect(manifest.gateAuthority).toBe("NONE");
    expect(manifest.productionSupport).toBe(false);
    expect(manifest.parent).toEqual(W06_PARENT);
    expect(manifest.sourceProvenance.assets.map((asset) => asset.path)).toEqual(
      [
        "packages/ats-adapters/research/matrix.ts",
        "packages/ats-adapters/research/fixture-html.ts",
        "packages/ats-adapters/research/manifest.ts",
      ],
    );
  });

  it("counts materialized controls including physical radio choices and preserves unscored status", () => {
    const manifest = readResearchManifest();
    let controlCount = 0;
    for (const variant of RESEARCH_MATRIX) {
      const html = fixtureHtml(variant);
      const physical = [...html.matchAll(/<(?:input|textarea|select)\b/gu)]
        .length;
      const entry = manifest.variants.find((entry) => entry.id === variant.id);
      expect(entry?.preparedControls).toBe(physical);
      expect(entry?.fixtureDigest).toBe(digestBytes(html));
      expect(entry?.fixtureBytes).toBe(Buffer.byteLength(html));
      controlCount += physical;
    }
    expect(controlCount).toBe(4060);
    expect(manifest.coverage).toMatchObject({
      expansionVariants: 200,
      frozenParentVariants: 32,
      cumulativeDevelopmentVariants: 232,
      preparedControls: 4060,
      preparedSensitiveProhibitedControls: 720,
      preparedHoneypots: 200,
      scoredControls: 0,
      publicNoSubmitExecutions: 0,
      ownerHoldoutExecutions: 0,
      status: "PREPARED_INVENTORY_NOT_SCORED",
      scoringOwner: "M02-W13",
      executionOwner: "M02-W14",
    });
  });

  it("keeps control IDs unique, first-name labels explicit, and safety controls unreleased", () => {
    for (const variant of RESEARCH_MATRIX) {
      const html = fixtureHtml(variant);
      const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map(
        (match) => match[1],
      );
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of [
        "first-name",
        "last-name",
        "email",
        "phone",
        "optional-note",
        "sensitive-disclosure",
        "honeypot",
        "dynamic-slot",
        "parser-status",
      ])
        expect(ids).toContain(id);
      expect(html).toContain('<label for="first-name">First name</label>');
      expect(
        variant.controls.find(
          (control) => control.id === "sensitive-disclosure",
        )?.policy,
      ).toBe("SENSITIVE_ABSTAIN");
      expect(
        variant.controls.find((control) => control.id === "honeypot")?.policy,
      ).toBe("HONEYPOT_ABSTAIN");
      expect(html).toContain('hidden aria-hidden="true"');
      expect(variant.provenance.reviewState).toBe("NOT_REVIEWED");
    }
  });

  it("renders observable step/session/nav evidence without any action capability", () => {
    for (const variant of RESEARCH_MATRIX) {
      const html = fixtureHtml(variant);
      expect(html).toContain(`data-research-family="${variant.ats}"`);
      expect(html).toContain(`data-research-session="${variant.session}"`);
      expect(html).toContain(`<h1>${variant.step.replaceAll("_", " ")}</h1>`);
      expect(html).toContain(
        `aria-current="step">${variant.step.replaceAll("_", " ")}`,
      );
      expect(variant.route).toContain(
        `/research/${variant.ats.toLowerCase()}/${variant.step.toLowerCase()}/`,
      );
      expect(html).not.toMatch(
        /<script|\bon[a-z]+\s*=|\s(?:src|href|action)\s*=|<input[^>]+type="(?:submit|password)"/iu,
      );
      expect(
        [...html.matchAll(/<button\b[^>]*>/gu)].every((match) =>
          match[0].includes('type="button"'),
        ),
      ).toBe(true);
      if (variant.expected.sessionBoundary) {
        expect(html).toContain("data-session-boundary=");
        expect(html).not.toContain('id="next"');
        expect(
          [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/gu)].every(
            (match) => match[0].includes(" disabled"),
          ),
        ).toBe(true);
      }
      if (variant.expected.navigationState === "AMBIGUOUS")
        expect([...html.matchAll(/>Next<\/button>/gu)]).toHaveLength(2);
      if (variant.expected.navigationState === "UNSAFE")
        expect(html).toContain(
          'id="final-submit" type="button">Submit application',
        );
    }
  });

  it("exposes material parser/repeater/validation states and all dynamic scenarios", () => {
    expect(
      new Set(RESEARCH_MATRIX.map((variant) => variant.expected.parserOutcome)),
    ).toEqual(
      new Set([
        "NOT_APPLICABLE",
        "PARSER_ADDS_ROW",
        "PARSER_DUPLICATE_EXISTING_ROW",
        "UPLOAD_REJECTION",
      ]),
    );
    expect(
      new Set(
        RESEARCH_MATRIX.map((variant) => variant.expected.dynamicScenario),
      ),
    ).toEqual(
      new Set([
        "DELAYED_RERENDER",
        "CONDITIONAL_INSERTION",
        "PAGE_GENERATION_CHANGE",
        "LONG_SESSION_MUTATION_BURST",
      ]),
    );
    for (const variant of RESEARCH_MATRIX) {
      const html = fixtureHtml(variant);
      expect([...html.matchAll(/data-japp-repeater-item=/gu)]).toHaveLength(
        variant.expected.repeaterRows,
      );
      if (variant.expected.repeaterRows > 0)
        expect(html).toContain(
          `data-japp-repeater="${variant.expected.repeaterFamily}"`,
        );
      if (variant.expected.validation !== "CLEAR")
        expect(html).toContain('id="email-error" role="alert"');
    }
  });

  // Each complete 200-variant validation retains the normal per-test deadline.
  // Separate registrations avoid charging nine full validations to one deadline.
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8] as const)(
    "rejects rehashed count, parent, expected output, family and authority mutation %i",
    (caseIndex) => {
      const original = readResearchManifest();
      const mutations = [
        {
          ...original,
          coverage: { ...original.coverage, scoredControls: 4060 },
        },
        {
          ...original,
          coverage: { ...original.coverage, expansionVariants: 201 },
        },
        { ...original, parent: { ...original.parent, corpusVersion: "2.0.0" } },
        { ...original, variants: original.variants.slice(1) },
        {
          ...original,
          variants: original.variants.filter(
            (variant) => variant.family !== "WORKDAY",
          ),
        },
        {
          ...original,
          variants: original.variants.map((variant, index) =>
            index === 0
              ? { ...variant, expectedDigest: `sha256:${"0".repeat(64)}` }
              : variant,
          ),
        },
        { ...original, gateAuthority: "PASS" },
        { ...original, productionSupport: true },
        { ...original, additionalProperty: "NOT_IN_SCHEMA" },
      ];
      const mutation = mutations[caseIndex];
      if (mutation === undefined) throw new Error("missing corruption case");
      const payload = Object.fromEntries(
        Object.entries(mutation).filter(([key]) => key !== "digest"),
      );
      const rehashed = {
        ...payload,
        digest: digestBytes(canonicalResearchJson(payload)),
      };
      expect(() => validateResearchManifest(rehashed)).toThrow(
        "W12_EXPANSION_MANIFEST_DRIFT",
      );
    },
  );

  it("preserves the complete frozen W06 public source-byte inventory", () => {
    const path = resolve(REPOSITORY_ROOT, W06_PARENT.manifestPath);
    const bytes = readFileSync(path);
    expect(bytes.byteLength).toBe(80296);
    expect(digestBytes(bytes)).toBe(W06_PARENT.manifestFileDigest);
    const manifest = JSON.parse(bytes.toString("utf8")) as {
      artifacts: { path: string; byte_count: number; content_digest: string }[];
    };
    expect(manifest.artifacts).toHaveLength(103);
    expect(
      manifest.artifacts.reduce(
        (sum, artifact) => sum + artifact.byte_count,
        0,
      ),
    ).toBe(1530479);
    for (const artifact of manifest.artifacts) {
      expect(artifact.path).not.toMatch(/^(?:\/|\.\.)|(?:^|\/)\.\.(?:\/|$)/u);
      const sourceBytes = readFileSync(resolve(REPOSITORY_ROOT, artifact.path));
      expect(sourceBytes.byteLength).toBe(artifact.byte_count);
      expect(digestBytes(sourceBytes)).toBe(artifact.content_digest);
    }
    const frozenFiles = [
      [
        "packages/evaluation-corpus/artifacts/development/M02_AUTOFILL_DEVELOPMENT_V1/1.0.0/coverage-summary.json",
        "sha256:7096f3e9990c8df59d09a5126552791c281f2523ae8658c6695291311e0abc99",
      ],
      [
        "packages/evaluation-corpus/artifacts/development/corpus-versions.v1.json",
        "sha256:d5bc4d2d2bce5e5fbbe61b0db480cf6d5978a109799e14c76e9e7568321ec0f9",
      ],
      [
        "packages/evaluation-corpus/policies/change-policy.v1.json",
        "sha256:03bccb3f0fd1d329560bf0832cbef7737eb913cf6e9e21d265797a3efe2787ea",
      ],
    ] as const;
    for (const [relativePath, expectedDigest] of frozenFiles)
      expect(
        digestBytes(readFileSync(resolve(REPOSITORY_ROOT, relativePath))),
      ).toBe(expectedDigest);
  });
});
