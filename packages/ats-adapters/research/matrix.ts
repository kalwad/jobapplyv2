/** M02-W12 public synthetic development recipes. No production adapter claim. */
export const ATS_FAMILIES = [
  "WORKDAY",
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
] as const;
export type ResearchAts = (typeof ATS_FAMILIES)[number];
export const RESEARCH_LAYOUTS = [
  "GROUPED",
  "REORDERED",
  "NESTED",
  "SEPARATED",
] as const;
export type ResearchLayout = (typeof RESEARCH_LAYOUTS)[number];
export const RESEARCH_STEPS = [
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
] as const;
const RECIPE_MODES = [
  "CONTACT",
  "EXPERIENCE",
  "QUESTIONNAIRE",
  "DISCLOSURES",
  "REVIEW",
] as const;
type RecipeMode = (typeof RECIPE_MODES)[number];
export type ResearchStep = (typeof RESEARCH_STEPS)[number];
export type ResearchLocale = "en-US" | "en-GB" | "de-DE" | "fr-CA";
export type ResearchSession =
  | "GUEST"
  | "AUTHENTICATED"
  | "RETURNING_CANDIDATE"
  | "SIGN_IN"
  | "CREATE_ACCOUNT"
  | "EMAIL_VERIFICATION"
  | "MFA"
  | "CAPTCHA_OR_BOT_CHALLENGE"
  | "SESSION_EXPIRED"
  | "DUPLICATE_APPLICATION"
  | "PRIVACY_OR_TERMS"
  | "UNKNOWN";
export type ResearchNavigation =
  | "NEXT"
  | "SAVE_AND_CONTINUE"
  | "REVIEW"
  | "FINAL_SUBMIT_IDENTIFICATION_ONLY"
  | "PAUSE";
export type ResearchControlKind =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "date"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "file"
  | "combobox";
export interface ResearchControl {
  readonly id: string;
  readonly label: string;
  readonly kind: ResearchControlKind;
  readonly section: "CONTACT" | "ADDRESS" | "STEP" | "SAFETY";
  readonly required: boolean;
  readonly policy:
    "REVIEWED_RECORD" | "OPTIONAL" | "SENSITIVE_ABSTAIN" | "HONEYPOT_ABSTAIN";
  readonly options?: readonly string[];
  readonly initialValue?: string;
  readonly pattern?: string;
}
export interface ResearchVariant {
  readonly id: string;
  readonly schemaVersion: "1.0.0";
  readonly ats: ResearchAts;
  readonly tenant: string;
  readonly layout: ResearchLayout;
  readonly locale: ResearchLocale;
  readonly session: ResearchSession;
  readonly step: ResearchStep;
  readonly route: string;
  readonly fixtureRef: {
    readonly path: "packages/ats-adapters/research/fixture-html.ts";
    readonly fragment: string;
    readonly version: "1.0.0";
  };
  readonly progression: {
    readonly composition: "COMBINED" | "REORDERED" | "NESTED" | "SEPARATE";
    readonly steps: readonly ResearchStep[];
    readonly routeSequence: readonly string[];
  };
  readonly controls: readonly ResearchControl[];
  readonly expected: {
    readonly step: ResearchStep;
    readonly sessionBoundary: boolean;
    readonly navigation: ResearchNavigation;
    readonly navigationAction: "IDENTIFY_ONLY";
    readonly navigationState: "UNIQUE" | "AMBIGUOUS" | "UNSAFE" | "MISSING";
    readonly parserOutcome:
      | "NOT_APPLICABLE"
      | "PARSER_ADDS_ROW"
      | "PARSER_DUPLICATE_EXISTING_ROW"
      | "UPLOAD_REJECTION";
    readonly validation: "CLEAR" | "REQUIRED_MISSING" | "SERVER_REJECTED";
    readonly dynamicScenario:
      | "DELAYED_RERENDER"
      | "CONDITIONAL_INSERTION"
      | "PAGE_GENERATION_CHANGE"
      | "LONG_SESSION_MUTATION_BURST";
    readonly repeaterRows: number;
    readonly repeaterFamily:
      "NONE" | "WORK_EXPERIENCE" | "EDUCATION" | "SKILLS_OR_LANGUAGES";
    readonly prohibitedActions: readonly [
      "FINAL_SUBMISSION",
      "CREDENTIAL_AUTOMATION",
      "MFA_AUTOMATION",
      "CAPTCHA_AUTOMATION",
    ];
  };
  readonly tags: readonly string[];
  readonly provenance: {
    readonly classification: "PUBLIC_SYNTHETIC";
    readonly authorRole: "M02_W12_IMPLEMENTATION";
    readonly reviewerRole: "M02_W12_INTERNAL_VERIFIER_PENDING";
    readonly reviewState: "NOT_REVIEWED";
    readonly source: "SPECIFICATION_DERIVED_SYNTHETIC";
  };
}
const control = (
  id: string,
  label: string,
  kind: ResearchControlKind = "text",
  section: ResearchControl["section"] = "CONTACT",
  required = true,
): ResearchControl => ({
  id,
  label,
  kind,
  section,
  required,
  policy: "REVIEWED_RECORD",
});
function optionControl(
  id: string,
  label: string,
  options: readonly string[],
  section: ResearchControl["section"] = "STEP",
): ResearchControl {
  return { ...control(id, label, "select", section), options };
}
function baseControls(): ResearchControl[] {
  return [
    control("first-name", "First name"),
    control("last-name", "Last name"),
    control("email", "Email address", "email"),
    control("phone", "Phone number", "tel"),
    {
      ...control("website", "Personal website", "url", "CONTACT", false),
      policy: "OPTIONAL",
    },
    {
      ...control(
        "optional-note",
        "Additional information",
        "textarea",
        "CONTACT",
        false,
      ),
      policy: "OPTIONAL",
    },
    {
      ...optionControl(
        "sensitive-disclosure",
        "Disability status",
        ["Prefer not to answer", "Yes", "No"],
        "SAFETY",
      ),
      policy: "SENSITIVE_ABSTAIN",
      required: false,
    },
    {
      ...control("honeypot", "Leave this field empty", "text", "SAFETY", false),
      policy: "HONEYPOT_ABSTAIN",
    },
    {
      ...control(
        "privacy-consent",
        "Privacy notice acknowledgment",
        "checkbox",
        "SAFETY",
        false,
      ),
      policy: "SENSITIVE_ABSTAIN",
    },
  ];
}
function addressControls(locale: ResearchLocale): ResearchControl[] {
  const country = {
    "en-US": "United States",
    "en-GB": "United Kingdom",
    "de-DE": "Germany",
    "fr-CA": "Canada",
  }[locale];
  const common = [
    optionControl("country", "Country", [country, "Other country"], "ADDRESS"),
    control("city", "City", "text", "ADDRESS"),
  ];
  if (locale === "en-US")
    return [
      ...common,
      control("street-address", "Street address", "text", "ADDRESS"),
      optionControl(
        "state",
        "State",
        ["Michigan", "California", "New York"],
        "ADDRESS",
      ),
      {
        ...control("postal-code", "ZIP code", "text", "ADDRESS"),
        pattern: "[0-9]{5}",
      },
    ];
  if (locale === "en-GB")
    return [
      ...common,
      control("building", "Building name or number", "text", "ADDRESS"),
      control("street-address", "Street", "text", "ADDRESS"),
      control("county", "County", "text", "ADDRESS", false),
      {
        ...control("postal-code", "Postcode", "text", "ADDRESS"),
        pattern: "[A-Za-z0-9 ]{5,8}",
      },
    ];
  if (locale === "de-DE")
    return [
      ...common,
      control("street-address", "Straße", "text", "ADDRESS"),
      control("house-number", "Hausnummer", "text", "ADDRESS"),
      {
        ...control("postal-code", "Postleitzahl", "text", "ADDRESS"),
        pattern: "[0-9]{5}",
      },
      control("address-supplement", "Adresszusatz", "text", "ADDRESS", false),
    ];
  return [
    ...common,
    control("street-address", "Adresse", "text", "ADDRESS"),
    optionControl(
      "province",
      "Province",
      ["Québec", "Ontario", "British Columbia"],
      "ADDRESS",
    ),
    {
      ...control("postal-code", "Code postal", "text", "ADDRESS"),
      pattern: "[A-Za-z][0-9][A-Za-z] [0-9][A-Za-z][0-9]",
    },
    optionControl(
      "preferred-language",
      "Preferred language",
      ["Français", "English"],
      "ADDRESS",
    ),
  ];
}
function stepControls(
  step: RecipeMode,
  layout: ResearchLayout,
): ResearchControl[] {
  if (step === "CONTACT")
    return [
      control("resume", "Upload résumé", "file", "STEP"),
      {
        ...control("country-code", "Phone country code", "combobox", "STEP"),
        options: ["+1", "+44", "+49"],
      },
      optionControl("contact-method", "Preferred contact method", [
        "Email",
        "Phone",
      ]),
      control("availability-date", "Available start date", "date", "STEP"),
    ];
  if (step === "EXPERIENCE") {
    const rows = layout === "NESTED" || layout === "SEPARATED" ? 2 : 1;
    return [
      control("resume", "Upload résumé", "file", "STEP"),
      ...Array.from({ length: rows }, (_, index) => [
        control(`employer-${String(index + 1)}`, "Employer", "text", "STEP"),
        control(`job-title-${String(index + 1)}`, "Job title", "text", "STEP"),
        control(
          `start-date-${String(index + 1)}`,
          "Employment start date",
          "date",
          "STEP",
        ),
        control(
          `current-job-${String(index + 1)}`,
          "I currently work here",
          "checkbox",
          "STEP",
          false,
        ),
      ]).flat(),
    ];
  }
  if (step === "QUESTIONNAIRE")
    return [
      {
        ...control(
          "work-authorization",
          "Legally authorized to work",
          "radio",
          "STEP",
        ),
        options: ["Yes", "No"],
        policy: "SENSITIVE_ABSTAIN",
      },
      {
        ...optionControl("sponsorship", "Require visa sponsorship", [
          "Yes",
          "No",
        ]),
        policy: "SENSITIVE_ABSTAIN",
      },
      control("qualification", "Relevant qualification", "textarea", "STEP"),
      {
        ...control("skills", "Skills", "combobox", "STEP"),
        options: ["TypeScript", "Python", "Project coordination"],
      },
      control("referral", "Employee referral", "text", "STEP", false),
    ];
  if (step === "DISCLOSURES")
    return [
      {
        ...optionControl("veteran-status", "Veteran status", [
          "Prefer not to answer",
          "Protected veteran",
          "Not a protected veteran",
        ]),
        policy: "SENSITIVE_ABSTAIN",
      },
      {
        ...optionControl("gender", "Gender identity", [
          "Prefer not to answer",
          "Woman",
          "Man",
          "Nonbinary",
        ]),
        policy: "SENSITIVE_ABSTAIN",
      },
      {
        ...control("terms", "I accept application terms", "checkbox", "STEP"),
        policy: "SENSITIVE_ABSTAIN",
      },
      {
        ...control("signature", "Electronic signature", "text", "STEP"),
        policy: "SENSITIVE_ABSTAIN",
      },
    ];
  return [
    control("review-note", "Review correction note", "textarea", "STEP", false),
    optionControl("review-section", "Section to review", [
      "Contact information",
      "Work experience",
      "Application questions",
    ]),
    {
      ...control(
        "accuracy-attestation",
        "I certify this information is accurate",
        "checkbox",
        "STEP",
      ),
      policy: "SENSITIVE_ABSTAIN",
    },
    control("review-date", "Review date", "date", "STEP"),
  ];
}
function sessionFor(
  mode: RecipeMode,
  layout: ResearchLayout,
  locale: ResearchLocale,
): ResearchSession {
  if (layout === "SEPARATED") {
    const boundaries = [
      "SIGN_IN",
      "CREATE_ACCOUNT",
      "EMAIL_VERIFICATION",
      "MFA",
      "CAPTCHA_OR_BOT_CHALLENGE",
      "SESSION_EXPIRED",
      "DUPLICATE_APPLICATION",
      "PRIVACY_OR_TERMS",
      "UNKNOWN",
    ] as const;
    const locales = ["en-US", "en-GB", "de-DE", "fr-CA"] as const;
    const boundary =
      boundaries[
        (locales.indexOf(locale) * 5 + RECIPE_MODES.indexOf(mode)) %
          boundaries.length
      ];
    if (boundary === undefined) throw new Error("W12_SESSION_RECIPE");
    return boundary;
  }
  if (layout === "NESTED") return "RETURNING_CANDIDATE";
  return layout === "REORDERED" ? "AUTHENTICATED" : "GUEST";
}
function stepFor(mode: RecipeMode, layout: ResearchLayout): ResearchStep {
  if (mode === "CONTACT")
    return {
      GROUPED: "MY_INFORMATION",
      REORDERED: "DOCUMENTS",
      NESTED: "EDUCATION",
      SEPARATED: "START_APPLICATION",
    }[layout] as ResearchStep;
  if (mode === "EXPERIENCE")
    return layout === "REORDERED" ? "WORK_EXPERIENCE" : "MY_EXPERIENCE";
  if (mode === "QUESTIONNAIRE")
    return layout === "REORDERED"
      ? "SKILLS_OR_LANGUAGES"
      : "APPLICATION_QUESTIONS";
  if (mode === "DISCLOSURES")
    return layout === "REORDERED" || layout === "SEPARATED"
      ? "SELF_IDENTIFICATION"
      : "VOLUNTARY_DISCLOSURES";
  return "REVIEW";
}
function variant(
  ats: ResearchAts,
  layout: ResearchLayout,
  locale: ResearchLocale,
  mode: RecipeMode,
): ResearchVariant {
  const step = stepFor(mode, layout);
  const id = `W12-${ats}-${layout}-${locale}-${step}`;
  const session = sessionFor(mode, layout, locale);
  const sessionBoundary = ![
    "GUEST",
    "AUTHENTICATED",
    "RETURNING_CANDIDATE",
  ].includes(session);
  const navigation: ResearchNavigation = sessionBoundary
    ? "PAUSE"
    : step === "REVIEW"
      ? "FINAL_SUBMIT_IDENTIFICATION_ONLY"
      : mode === "DISCLOSURES"
        ? "REVIEW"
        : layout === "REORDERED"
          ? "SAVE_AND_CONTINUE"
          : "NEXT";
  const parserOutcome: ResearchVariant["expected"]["parserOutcome"] =
    mode !== "EXPERIENCE" && mode !== "CONTACT"
      ? "NOT_APPLICABLE"
      : layout === "NESTED"
        ? "PARSER_DUPLICATE_EXISTING_ROW"
        : layout === "SEPARATED"
          ? "UPLOAD_REJECTION"
          : "PARSER_ADDS_ROW";
  const dynamicScenario = {
    GROUPED: "DELAYED_RERENDER",
    REORDERED: "CONDITIONAL_INSERTION",
    NESTED: "PAGE_GENERATION_CHANGE",
    SEPARATED: "LONG_SESSION_MUTATION_BURST",
  } as const;
  const navigationState = sessionBoundary
    ? ("MISSING" as const)
    : step === "REVIEW"
      ? ("UNSAFE" as const)
      : navigation === "SAVE_AND_CONTINUE" || navigation === "REVIEW"
        ? ("MISSING" as const)
        : layout === "NESTED" && mode === "QUESTIONNAIRE"
          ? ("AMBIGUOUS" as const)
          : ("UNIQUE" as const);
  const steps: readonly ResearchStep[] =
    layout === "REORDERED"
      ? [
          "START_APPLICATION",
          "DOCUMENTS",
          "WORK_EXPERIENCE",
          "MY_INFORMATION",
          "EDUCATION",
          "SKILLS_OR_LANGUAGES",
          "SELF_IDENTIFICATION",
          "REVIEW",
        ]
      : layout === "NESTED"
        ? [
            "START_APPLICATION",
            "EDUCATION",
            "MY_INFORMATION",
            "MY_EXPERIENCE",
            "APPLICATION_QUESTIONS",
            "VOLUNTARY_DISCLOSURES",
            "REVIEW",
          ]
        : [
            "START_APPLICATION",
            "MY_INFORMATION",
            "MY_EXPERIENCE",
            "APPLICATION_QUESTIONS",
            "VOLUNTARY_DISCLOSURES",
            "SELF_IDENTIFICATION",
            "REVIEW",
          ];
  const progression = {
    composition: {
      GROUPED: "COMBINED",
      REORDERED: "REORDERED",
      NESTED: "NESTED",
      SEPARATED: "SEPARATE",
    }[layout] as ResearchVariant["progression"]["composition"],
    steps,
    routeSequence: steps.map(
      (nextStep) =>
        `/research/${ats.toLowerCase()}/${nextStep.toLowerCase()}/${layout.toLowerCase()}/${locale}`,
    ),
  };
  const expected: ResearchVariant["expected"] = {
    step,
    sessionBoundary,
    navigation,
    navigationState,
    navigationAction: "IDENTIFY_ONLY" as const,
    parserOutcome,
    validation:
      layout === "SEPARATED"
        ? ("SERVER_REJECTED" as const)
        : layout === "REORDERED"
          ? ("REQUIRED_MISSING" as const)
          : ("CLEAR" as const),
    dynamicScenario: dynamicScenario[layout],
    repeaterRows:
      mode === "EXPERIENCE"
        ? layout === "NESTED" || layout === "SEPARATED"
          ? 2
          : 1
        : step === "EDUCATION"
          ? 2
          : step === "SKILLS_OR_LANGUAGES"
            ? 1
            : 0,
    repeaterFamily:
      mode === "EXPERIENCE"
        ? "WORK_EXPERIENCE"
        : step === "EDUCATION"
          ? "EDUCATION"
          : step === "SKILLS_OR_LANGUAGES"
            ? "SKILLS_OR_LANGUAGES"
            : "NONE",
    prohibitedActions: [
      "FINAL_SUBMISSION",
      "CREDENTIAL_AUTOMATION",
      "MFA_AUTOMATION",
      "CAPTCHA_AUTOMATION",
    ] as const,
  };
  return {
    id,
    schemaVersion: "1.0.0",
    ats,
    tenant: `synthetic-${ats.toLowerCase()}-${layout.toLowerCase()}`,
    layout,
    locale,
    session,
    step,
    route: `/research/${ats.toLowerCase()}/${step.toLowerCase()}/${layout.toLowerCase()}/${locale}`,
    fixtureRef: {
      path: "packages/ats-adapters/research/fixture-html.ts",
      fragment: id,
      version: "1.0.0",
    },
    progression,
    controls: [
      ...baseControls(),
      ...addressControls(locale),
      ...stepControls(mode, layout),
      ...(step === "EDUCATION"
        ? [1, 2].flatMap((row) => [
            control(
              `institution-${String(row)}`,
              "School or university",
              "text",
              "STEP",
            ),
            control(`degree-${String(row)}`, "Degree", "text", "STEP"),
            control(
              `graduation-date-${String(row)}`,
              "Graduation date",
              "date",
              "STEP",
            ),
          ])
        : []),
      ...(step === "SKILLS_OR_LANGUAGES"
        ? [
            control("language-1", "Language", "text", "STEP"),
            control("proficiency-1", "Language proficiency", "text", "STEP"),
          ]
        : []),
      ...(expected.repeaterRows > 0
        ? [
            {
              ...control(
                "research-repeater-controller",
                "Research repeater",
                "text",
                "STEP",
                false,
              ),
              policy: "OPTIONAL" as const,
            },
          ]
        : []),
    ],
    expected,
    tags: [
      ats,
      layout,
      locale,
      session,
      step,
      parserOutcome,
      expected.validation,
      expected.dynamicScenario,
      "SENSITIVE_ABSTENTION",
      "HONEYPOT_ABSTENTION",
      "NAVIGATION_IDENTIFICATION_ONLY",
    ],
    provenance: {
      classification: "PUBLIC_SYNTHETIC",
      authorRole: "M02_W12_IMPLEMENTATION",
      reviewerRole: "M02_W12_INTERNAL_VERIFIER_PENDING",
      reviewState: "NOT_REVIEWED",
      source: "SPECIFICATION_DERIVED_SYNTHETIC",
    },
  };
}
export const RESEARCH_MATRIX: readonly ResearchVariant[] = ATS_FAMILIES.flatMap(
  (ats) =>
    RESEARCH_LAYOUTS.flatMap((layout) =>
      (ats === "WORKDAY"
        ? (["en-US", "en-GB", "de-DE", "fr-CA"] as const)
        : (["en-US", "en-GB"] as const)
      ).flatMap((locale) =>
        RECIPE_MODES.map((mode) => variant(ats, layout, locale, mode)),
      ),
    ),
);
