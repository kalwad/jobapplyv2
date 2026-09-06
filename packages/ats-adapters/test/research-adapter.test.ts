import { describe, expect, it } from "vitest";
import {
  createResearchAdapter,
  RESEARCH_FAMILIES,
  type ResearchEvidence,
} from "../src/research-adapter.ts";

const evidence = (): ResearchEvidence => ({
  familySignals: [
    { source: "ROUTE", family: "WORKDAY" },
    { source: "SHELL", family: "WORKDAY" },
  ],
  stepSignals: [
    { source: "HEADING", step: "MY_INFORMATION" },
    { source: "FIELD_CONCEPTS", step: "MY_INFORMATION" },
  ],
  sessionSignals: ["GUEST"],
});

describe("W12 bounded research adapter contract", () => {
  it("WD1 admits corroborated evidence only to the generic core", () => {
    expect(createResearchAdapter("WORKDAY").analyze(evidence())).toEqual({
      mode: "RESEARCH_ONLY",
      certification: "NOT_CERTIFIED",
      productionSupport: false,
      authority: "W08_W09_W10_W11_ONLY",
      posture: "ELIGIBLE_FOR_GENERIC_CORE",
      step: "MY_INFORMATION",
      reason: "CORROBORATED_RESEARCH_EVIDENCE",
    });
  });
  it.each(["ROUTE", "HEADING", "PROGRESS", "FIELD_CONCEPTS"] as const)(
    "WD2/M1 rejects one independent %s signal even repeated",
    (source) => {
      const input = evidence();
      input.stepSignals = [
        { source, step: "REVIEW" },
        { source, step: "REVIEW" },
      ];
      expect(createResearchAdapter("WORKDAY").analyze(input).posture).toBe(
        "PAUSE",
      );
    },
  );
  it("WD3 rejects contradictions regardless of majority", () => {
    const input = evidence();
    input.stepSignals.push({ source: "ROUTE", step: "REVIEW" });
    expect(createResearchAdapter("WORKDAY").analyze(input).reason).toBe(
      "STEP_UNCERTAIN",
    );
  });
  it.each([
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
  ] as const)("WD4–WD10/M2 session boundary %s", (session) => {
    const input = evidence();
    input.sessionSignals = [session];
    expect(createResearchAdapter("WORKDAY").analyze(input).posture).toBe(
      ["GUEST", "AUTHENTICATED", "RETURNING_CANDIDATE"].includes(session)
        ? "ELIGIBLE_FOR_GENERIC_CORE"
        : "PAUSE",
    );
  });
  it("boundary evidence dominates application fields and safe-session evidence", () => {
    const input = evidence();
    input.sessionSignals.push("CAPTCHA_OR_BOT_CHALLENGE");
    expect(createResearchAdapter("WORKDAY").analyze(input).reason).toBe(
      "SESSION_BOUNDARY",
    );
  });
  it.each([
    "START_APPLICATION",
    "MY_INFORMATION",
    "MY_EXPERIENCE",
    "EDUCATION",
    "WORK_EXPERIENCE",
    "SKILLS_OR_LANGUAGES",
    "APPLICATION_QUESTIONS",
    "VOLUNTARY_DISCLOSURES",
    "SELF_IDENTIFICATION",
    "DOCUMENTS",
    "REVIEW",
  ] as const)("WD11 classifies %s independently of sequence", (step) => {
    const input = evidence();
    input.stepSignals = [
      { source: "HEADING", step },
      { source: "PROGRESS", step },
    ];
    expect(createResearchAdapter("WORKDAY").analyze(input).step).toBe(step);
  });
  it.each(["WORKDAY", "GREENHOUSE", "LEVER", "ASHBY"] as const)(
    "MATRIX8/M6 isolates %s from every other family",
    (family) => {
      const input = evidence();
      input.familySignals = [
        { source: "ROUTE", family },
        { source: "SHELL", family },
      ];
      for (const adapterFamily of RESEARCH_FAMILIES) {
        expect(
          createResearchAdapter(adapterFamily).analyze(input).posture,
        ).toBe(
          adapterFamily === family ? "ELIGIBLE_FOR_GENERIC_CORE" : "PAUSE",
        );
      }
    },
  );
  it("MATRIX9 unknown/missing/mixed family evidence fails closed", () => {
    for (const familySignals of [
      [],
      [{ source: "SHELL", family: "WORKDAY" }],
      [
        { source: "ROUTE", family: "GREENHOUSE" },
        { source: "SHELL", family: "WORKDAY" },
      ],
    ]) {
      expect(
        createResearchAdapter("WORKDAY").analyze({
          ...evidence(),
          familySignals,
        }).posture,
      ).toBe("PAUSE");
    }
  });
  it("MATRIX10/M3 no adapter exposes execution, navigation, selector or production authority", () => {
    for (const family of RESEARCH_FAMILIES) {
      const adapter = createResearchAdapter(family);
      expect(Object.keys(adapter).sort()).toEqual([
        "analyze",
        "family",
        "mode",
      ]);
      expect(Object.isFrozen(adapter)).toBe(true);
      expect(adapter.analyze(evidence()).authority).toBe(
        "W08_W09_W10_W11_ONLY",
      );
      expect(adapter.analyze(evidence()).productionSupport).toBe(false);
    }
  });
  it.each([
    null,
    {},
    [],
    { ...evidence(), sessionSignals: [] },
    { ...evidence(), sessionSignals: ["UNKNOWN"] },
    { ...evidence(), rawSelector: "input" },
    { ...evidence(), stepSignals: [{ source: "arbitrary", step: "REVIEW" }] },
  ])("malformed and unsupported evidence pauses: %j", (input) => {
    expect(createResearchAdapter("WORKDAY").analyze(input).posture).toBe(
      "PAUSE",
    );
  });
});
