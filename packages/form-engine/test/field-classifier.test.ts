// M02-W09 deterministic classifier matrix (C1–C8) and calibration
// invariants: negative evidence never raises confidence, corroboration
// never lowers it, ties abstain, and identical input yields identical
// output.
import { describe, expect, it } from "vitest";

import {
  classifyField,
  DETERMINISTIC_ACCEPT_THRESHOLD,
  REVIEW_THRESHOLD,
} from "../src/field-classifier.ts";
import { buildDescriptor } from "./support/build-descriptor.ts";

describe("C1 exact ordinary concept", () => {
  it("classifies an exact contact label deterministically", async () => {
    const descriptor = await buildDescriptor({
      label: "Email address (required)",
      sectionContext: ["CANDIDATE_DETAILS"],
      required: true,
    });
    const result = classifyField(descriptor);
    expect(result.status).toBe("CLASSIFIED");
    if (result.status === "CLASSIFIED") {
      expect(result.concept).toBe("EMAIL_ADDRESS");
      expect(result.band).toBe("DETERMINISTIC");
      expect(result.confidence).toBeGreaterThanOrEqual(
        DETERMINISTIC_ACCEPT_THRESHOLD,
      );
    }
  });

  it("classifies the veteran-status disclosure as a demographic concept", async () => {
    const descriptor = await buildDescriptor({
      label: "Voluntary veteran status (optional)",
      controlKind: "SELECT",
      sectionContext: ["VOLUNTARY_AND_ELIGIBILITY_QUESTIONS"],
      options: [
        { label: "Prefer not to answer" },
        {
          label: "I am not a veteran (synthetic option)",
          token: "not-veteran",
        },
        {
          label: "I identify as a veteran (synthetic option)",
          token: "veteran",
        },
      ],
    });
    const result = classifyField(descriptor);
    expect(result.status).toBe("CLASSIFIED");
    if (result.status === "CLASSIFIED") {
      expect(result.concept).toBe("DEMOGRAPHIC_DISCLOSURE");
    }
  });
});

describe("C2 approved alias", () => {
  it("classifies the given-name alias as FIRST_NAME", async () => {
    const descriptor = await buildDescriptor({ label: "Given name" });
    const result = classifyField(descriptor);
    expect(result.status).toBe("CLASSIFIED");
    if (result.status === "CLASSIFIED") {
      expect(result.concept).toBe("FIRST_NAME");
      expect(result.band).toBe("DETERMINISTIC");
    }
  });

  it("classifies a legally-authorized phrase as WORK_AUTHORIZATION", async () => {
    const descriptor = await buildDescriptor({
      label:
        "Are you legally authorized to work in the country of this synthetic posting? (required)",
      controlKind: "RADIO_GROUP",
      sectionContext: ["VOLUNTARY_AND_ELIGIBILITY_QUESTIONS"],
      options: [
        { label: "Yes", token: "yes" },
        { label: "No", token: "no" },
      ],
      required: true,
    });
    const result = classifyField(descriptor);
    expect(result.status).toBe("CLASSIFIED");
    if (result.status === "CLASSIFIED") {
      expect(result.concept).toBe("WORK_AUTHORIZATION");
      expect(result.band).toBe("DETERMINISTIC");
    }
  });
});

describe("C3 negative-pattern false positives", () => {
  it("never maps a recruiter email to the applicant EMAIL_ADDRESS", async () => {
    const descriptor = await buildDescriptor({ label: "Recruiter email" });
    const result = classifyField(descriptor);
    expect(result.status).toBe("ABSTAINED");
    if (result.status === "ABSTAINED") {
      expect(result.reason).toBe("NEGATIVE_EVIDENCE_CONFLICT");
    }
  });

  it("never maps a company phone to the applicant PHONE_NUMBER", async () => {
    const descriptor = await buildDescriptor({ label: "Company phone" });
    const result = classifyField(descriptor);
    expect(result.status).toBe("ABSTAINED");
  });

  it("never lets a recruiter term in the description corroborate applicant email", async () => {
    const descriptor = await buildDescriptor({
      label: "Email address",
      description: "Enter your recruiter email address",
    });
    const result = classifyField(descriptor);
    expect(result.status).toBe("ABSTAINED");
    if (result.status === "ABSTAINED") {
      expect(result.reason).toBe("NEGATIVE_EVIDENCE_CONFLICT");
    }
  });

  it("never maps the company-website honeypot label to WEBSITE_URL", async () => {
    const descriptor = await buildDescriptor({ label: "Company website" });
    const result = classifyField(descriptor);
    expect(result.status).toBe("ABSTAINED");
  });
});

describe("C4 section corroboration", () => {
  it("adds bounded support without ever lowering confidence", async () => {
    const bare = classifyField(await buildDescriptor({ label: "Phone" }));
    const supported = classifyField(
      await buildDescriptor({
        label: "Phone",
        sectionContext: ["CONTACT_INFORMATION"],
      }),
    );
    expect(bare.status).toBe("CLASSIFIED");
    expect(supported.status).toBe("CLASSIFIED");
    if (bare.status === "CLASSIFIED" && supported.status === "CLASSIFIED") {
      expect(supported.concept).toBe("PHONE_NUMBER");
      expect(supported.confidence).toBeGreaterThan(bare.confidence);
    }
  });
});

describe("C5 section contradiction", () => {
  it("weakens a generic label inside an unrelated party section", async () => {
    const contradicted = classifyField(
      await buildDescriptor({
        label: "Phone",
        sectionContext: ["EMERGENCY_CONTACT"],
      }),
    );
    const bare = classifyField(await buildDescriptor({ label: "Phone" }));
    expect(bare.status).toBe("CLASSIFIED");
    expect(contradicted.status).toBe("CLASSIFIED");
    if (bare.status === "CLASSIFIED" && contradicted.status === "CLASSIFIED") {
      expect(contradicted.confidence).toBeLessThan(bare.confidence);
      // Section context alone weakens; it does not flip the field to a
      // different concept.
      expect(contradicted.concept).toBe("PHONE_NUMBER");
      expect(contradicted.band).toBe("REVIEW");
    }
  });

  it("recognizes a numbered singular reference section as other-party context", async () => {
    const result = classifyField(
      await buildDescriptor({
        label: "Email",
        sectionContext: ["REFERENCE_1"],
      }),
    );
    expect(result.status).toBe("CLASSIFIED");
    if (result.status === "CLASSIFIED") {
      expect(result.concept).toBe("EMAIL_ADDRESS");
      expect(result.band).toBe("REVIEW");
      expect(result.confidence).toBeLessThan(DETERMINISTIC_ACCEPT_THRESHOLD);
    }
  });
});

describe("C6 competing concepts", () => {
  it("abstains on a tied candidate pair instead of picking the first", async () => {
    const result = classifyField(
      await buildDescriptor({ label: "Phone or email" }),
    );
    expect(result.status).toBe("ABSTAINED");
    if (result.status === "ABSTAINED") {
      expect(["TIED_CANDIDATES", "AMBIGUOUS_CANDIDATES"]).toContain(
        result.reason,
      );
    }
  });
});

describe("C7 low evidence", () => {
  it("abstains when no concept matches", async () => {
    const result = classifyField(
      await buildDescriptor({ label: "Favorite synthetic mascot" }),
    );
    expect(result.status).toBe("ABSTAINED");
    if (result.status === "ABSTAINED") {
      expect(result.reason).toBe("NO_MATCHING_CONCEPT");
      expect(result.topConfidence).toBeLessThan(REVIEW_THRESHOLD);
    }
  });

  it("abstains when the descriptor exposes no label or description text", async () => {
    const result = classifyField(await buildDescriptor({ label: "" }));
    expect(result.status).toBe("ABSTAINED");
    if (result.status === "ABSTAINED") {
      expect(result.reason).toBe("NO_LABEL_EVIDENCE");
    }
  });
});

describe("C8 unsupported control families", () => {
  it("abstains on FILE and UNKNOWN control kinds", async () => {
    const file = classifyField(
      await buildDescriptor({ label: "Resume upload", controlKind: "FILE" }),
    );
    const unknown = classifyField(
      await buildDescriptor({ label: "Email address", controlKind: "UNKNOWN" }),
    );
    for (const result of [file, unknown]) {
      expect(result.status).toBe("ABSTAINED");
      if (result.status === "ABSTAINED") {
        expect(result.reason).toBe("UNSUPPORTED_CONTROL_KIND");
      }
    }
  });

  it("defeats a concept whose control kind cannot express it", async () => {
    const result = classifyField(
      await buildDescriptor({
        label: "Email me synthetic status updates (optional)",
        controlKind: "CHECKBOX",
      }),
    );
    expect(result.status).toBe("ABSTAINED");
    if (result.status === "ABSTAINED") {
      const emailCandidate = result.candidates.find(
        (candidate) => candidate.concept === "EMAIL_ADDRESS",
      );
      expect(emailCandidate?.defeated).toBe(true);
      expect(
        emailCandidate?.evidence.some(
          (entry) => entry.code === "CONTROL_KIND_INCOMPATIBLE",
        ),
      ).toBe(true);
    }
  });
});

describe("calibration invariants", () => {
  it("never lets contradictory evidence increase confidence", async () => {
    const base = classifyField(
      await buildDescriptor({ label: "Email address" }),
    );
    const contradicted = classifyField(
      await buildDescriptor({
        label: "Email address",
        sectionContext: ["REFERENCES"],
      }),
    );
    expect(base.status).toBe("CLASSIFIED");
    expect(contradicted.status).toBe("CLASSIFIED");
    if (base.status === "CLASSIFIED" && contradicted.status === "CLASSIFIED") {
      expect(contradicted.confidence).toBeLessThan(base.confidence);
    }
  });

  it("is deterministic for identical descriptors", async () => {
    const descriptor = await buildDescriptor({
      label: "Preferred work mode (required)",
      controlKind: "SELECT",
      sectionContext: ["CANDIDATE_DETAILS"],
      options: [
        { label: "Select a work mode" },
        { label: "On-site", token: "onsite" },
        { label: "Hybrid", token: "hybrid" },
        { label: "Remote", token: "remote" },
      ],
      required: true,
    });
    const first = classifyField(descriptor);
    const second = classifyField(descriptor);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.status).toBe("CLASSIFIED");
    if (first.status === "CLASSIFIED") {
      expect(first.concept).toBe("WORK_MODE_PREFERENCE");
    }
  });
});
