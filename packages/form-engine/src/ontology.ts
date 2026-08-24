// M02-W09 feasibility field ontology (spec §5.11.4, §7.6; package row
// M02-W09).
//
// This is a CLOSED, VERSIONED feasibility concept catalog. Its concept set
// is derived from the frozen M02 synthetic corpus (@japp/test-fixtures
// profiles, field-value policies, question intents) and the mock ATS lab
// controls — it deliberately does not attempt production M18 ontology
// completeness (REQ-FORM-001 remains owned by M18-W01). Ontology identifies
// what a field MEANS; value sourcing is a separate decision and no rule in
// this catalog may supply or infer a value.
import type { CommonRedactionV1SensitivityClass } from "@japp/contracts/generated";
import type { FormFieldDescriptorV1ControlKind } from "@japp/contracts/generated";

export const FEASIBILITY_ONTOLOGY_VERSION = "1.0.0";

/**
 * Closed feasibility concept identifiers (canonical enum-token grammar).
 * `UNKNOWN` is the first-class abstention concept: it is the only concept a
 * decision may carry when deterministic classification abstains.
 */
export const FEASIBILITY_CONCEPTS = [
  "FIRST_NAME",
  "LAST_NAME",
  "FULL_NAME",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "ADDRESS_LINE_1",
  "ADDRESS_CITY",
  "ADDRESS_REGION",
  "ADDRESS_POSTAL_CODE",
  "ADDRESS_COUNTRY",
  "WEBSITE_URL",
  "PROFESSIONAL_SUMMARY",
  "EMPLOYMENT_TYPE",
  "WORK_MODE_PREFERENCE",
  "EARLIEST_START_DATE",
  "NOTICE_PERIOD",
  "YEARS_OF_EXPERIENCE",
  "WORK_AUTHORIZATION",
  "SPONSORSHIP_REQUIREMENT",
  "SALARY_EXPECTATION",
  "RELOCATION_PREFERENCE",
  "DEMOGRAPHIC_DISCLOSURE",
  "SECURITY_CLEARANCE",
  "LICENSE_VALIDITY",
] as const;

export type FeasibilityConcept = (typeof FEASIBILITY_CONCEPTS)[number];

/** Abstention concept token used when no concept can be claimed honestly. */
export const UNKNOWN_CONCEPT = "UNKNOWN";

/**
 * Per-concept value policy floor, using the specification §7.6 policy
 * vocabulary as preserved by the frozen field-value-policy fixtures. The
 * catalog value is a FLOOR: an approved record's policy may only strengthen
 * it (see `strictestPolicy`), never weaken it.
 */
export const FEASIBILITY_VALUE_POLICIES = [
  "FILL_FROM_EXPLICIT_RECORD",
  "CONFIRM_IF_RECORD_EXPIRED",
  "CONFIRM_ONCE_PER_JOB",
  "VOLUNTARY_PREFER_NOT_TO_ANSWER",
  "BLOCK_AND_EXPLAIN",
  "NEVER_AUTOFILL",
] as const;

export type FeasibilityValuePolicy =
  (typeof FEASIBILITY_VALUE_POLICIES)[number];

// Total strictness order (index = strictness). Combining policies always
// takes the maximum index, so uncertainty can never relax into FILL.
const POLICY_STRICTNESS: readonly FeasibilityValuePolicy[] =
  FEASIBILITY_VALUE_POLICIES;

export function strictestPolicy(
  left: FeasibilityValuePolicy,
  right: FeasibilityValuePolicy,
): FeasibilityValuePolicy {
  const winner =
    POLICY_STRICTNESS.indexOf(left) >= POLICY_STRICTNESS.indexOf(right)
      ? left
      : right;
  return winner;
}

/**
 * Deterministic option semantics: one canonical semantic value token and the
 * closed reviewed evidence that may select a rendered option for it. Labels
 * are compared after canonical normalization; tokens are compared exactly
 * against the descriptor's inert `stable_value_token`.
 */
export interface OptionValueRule {
  readonly valueToken: string;
  readonly acceptedLabels: readonly string[];
  readonly acceptedTokens: readonly string[];
}

export interface ConceptRule {
  readonly concept: FeasibilityConcept;
  /** Normalized positive alias phrases justified by the frozen M02 corpus. */
  readonly aliases: readonly string[];
  /**
   * Normalized words/phrases that DEFEAT this concept when present in the
   * field's own label or description (for example "recruiter email" must
   * never become the applicant EMAIL_ADDRESS). The historical property name
   * is retained for compatibility with the feasibility catalog.
   */
  readonly negativeLabelTerms: readonly string[];
  /** Control kinds this concept can honestly describe. */
  readonly compatibleControlKinds: readonly FormFieldDescriptorV1ControlKind[];
  /** Section-context phrases that corroborate the concept. */
  readonly supportingSections: readonly string[];
  /** Section-context phrases that contradict the concept. */
  readonly conflictingSections: readonly string[];
  readonly sensitivity: CommonRedactionV1SensitivityClass;
  readonly consequential: boolean;
  readonly minimumPolicy: FeasibilityValuePolicy;
  readonly optionValues: readonly OptionValueRule[];
}

// Shared negative vocabulary: applicant identity/contact concepts must never
// bind to fields describing some OTHER party's identity or contact data.
const OTHER_PARTY_TERMS = [
  "recruiter",
  "employer",
  "company",
  "manager",
  "supervisor",
  "reference",
  "references",
  "emergency",
] as const;

const CONTACT_SECTIONS = [
  "CANDIDATE DETAILS",
  "CANDIDATE PROFILE",
  "CONTACT",
  "CONTACT INFORMATION",
  "PERSONAL INFORMATION",
  "MY INFORMATION",
] as const;

const OTHER_PARTY_SECTIONS = [
  "RECRUITER",
  "EMPLOYER",
  "COMPANY",
  "REFERENCE",
  "REFERENCES",
  "EMERGENCY CONTACT",
  "HIRING TEAM",
] as const;

const ELIGIBILITY_SECTIONS = [
  "ELIGIBILITY",
  "ELIGIBILITY QUESTIONS",
  "VOLUNTARY AND ELIGIBILITY QUESTIONS",
  "WORK AUTHORIZATION",
  "APPLICATION QUESTIONS",
] as const;

const VOLUNTARY_SECTIONS = [
  "VOLUNTARY",
  "VOLUNTARY DISCLOSURES",
  "SELF IDENTIFICATION",
  "DEMOGRAPHICS",
] as const;

const TEXT_KINDS: readonly FormFieldDescriptorV1ControlKind[] = ["TEXT"];
const CHOICE_KINDS: readonly FormFieldDescriptorV1ControlKind[] = [
  "SELECT",
  "RADIO_GROUP",
  "COMBOBOX",
];
const YES_NO_OPTIONS = (
  yesToken: string,
  noToken: string,
): readonly OptionValueRule[] => [
  {
    valueToken: yesToken,
    acceptedLabels: ["yes"],
    acceptedTokens: ["yes", "true"],
  },
  {
    valueToken: noToken,
    acceptedLabels: ["no"],
    acceptedTokens: ["no", "false"],
  },
];

const CATALOG: readonly ConceptRule[] = [
  {
    concept: "FIRST_NAME",
    aliases: ["first name", "given name", "forename"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "LAST_NAME",
    aliases: ["last name", "family name", "surname"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "FULL_NAME",
    aliases: ["full name", "legal name", "your name"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "EMAIL_ADDRESS",
    aliases: ["email", "email address", "contact email", "e mail"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "PHONE_NUMBER",
    aliases: [
      "phone",
      "phone number",
      "telephone",
      "mobile",
      "mobile number",
      "cell phone",
    ],
    negativeLabelTerms: [...OTHER_PARTY_TERMS, "office"],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "ADDRESS_LINE_1",
    aliases: ["address line 1", "street address", "address line"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "ADDRESS_CITY",
    aliases: ["city", "town"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: [...TEXT_KINDS, "SELECT", "COMBOBOX"],
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "ADDRESS_REGION",
    aliases: ["state", "region", "province", "county"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: [...TEXT_KINDS, "SELECT", "COMBOBOX"],
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "ADDRESS_POSTAL_CODE",
    aliases: ["postal code", "zip", "zip code", "postcode"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "ADDRESS_COUNTRY",
    aliases: ["country", "country of residence"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: [...TEXT_KINDS, "SELECT", "COMBOBOX"],
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "WEBSITE_URL",
    aliases: [
      "website",
      "personal website",
      "portfolio",
      "portfolio reference",
      "portfolio url",
      "profile url",
      "linkedin",
    ],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "PROFESSIONAL_SUMMARY",
    aliases: ["summary", "short summary", "professional summary", "about you"],
    negativeLabelTerms: [...OTHER_PARTY_TERMS],
    compatibleControlKinds: ["TEXTAREA", "TEXT"],
    supportingSections: [...CONTACT_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "EMPLOYMENT_TYPE",
    aliases: ["employment type", "job type", "position type"],
    negativeLabelTerms: [],
    compatibleControlKinds: CHOICE_KINDS,
    supportingSections: [...CONTACT_SECTIONS, ...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [
      {
        valueToken: "FULL_TIME",
        acceptedLabels: ["full time"],
        acceptedTokens: ["full-time", "fulltime"],
      },
      {
        valueToken: "PART_TIME",
        acceptedLabels: ["part time"],
        acceptedTokens: ["part-time", "parttime"],
      },
      {
        valueToken: "CONTRACT",
        acceptedLabels: ["contract"],
        acceptedTokens: ["contract"],
      },
    ],
  },
  {
    concept: "WORK_MODE_PREFERENCE",
    aliases: [
      "work mode",
      "preferred work mode",
      "work location preference",
      "remote or onsite",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: CHOICE_KINDS,
    supportingSections: [...CONTACT_SECTIONS, ...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [
      {
        valueToken: "ONSITE",
        acceptedLabels: ["on site", "onsite"],
        acceptedTokens: ["onsite", "on-site"],
      },
      {
        valueToken: "HYBRID",
        acceptedLabels: ["hybrid"],
        acceptedTokens: ["hybrid"],
      },
      {
        valueToken: "REMOTE",
        acceptedLabels: ["remote"],
        acceptedTokens: ["remote"],
      },
    ],
  },
  {
    concept: "EARLIEST_START_DATE",
    aliases: [
      "start date",
      "earliest start date",
      "available start date",
      "earliest availability",
      "availability date",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: ["DATE", "TEXT"],
    supportingSections: [...CONTACT_SECTIONS, ...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "NOTICE_PERIOD",
    aliases: ["notice period", "notice period in weeks"],
    negativeLabelTerms: [],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS, ...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "YEARS_OF_EXPERIENCE",
    aliases: ["years of experience", "years of relevant experience"],
    negativeLabelTerms: [],
    compatibleControlKinds: TEXT_KINDS,
    supportingSections: [...CONTACT_SECTIONS, ...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: false,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: [],
  },
  {
    concept: "WORK_AUTHORIZATION",
    aliases: [
      "work authorization",
      "authorized to work",
      "legally authorized to work",
      "right to work",
      "work permit",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: [...CHOICE_KINDS, "CHECKBOX"],
    supportingSections: [...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: true,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: YES_NO_OPTIONS("AUTHORIZED", "NOT_AUTHORIZED"),
  },
  {
    concept: "SPONSORSHIP_REQUIREMENT",
    aliases: [
      "sponsorship",
      "visa sponsorship",
      "require sponsorship",
      "need sponsorship",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: [...CHOICE_KINDS, "CHECKBOX"],
    supportingSections: [...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: true,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: YES_NO_OPTIONS("REQUIRED", "NOT_REQUIRED"),
  },
  {
    concept: "SALARY_EXPECTATION",
    aliases: [
      "salary",
      "salary expectation",
      "expected salary",
      "desired salary",
      "compensation",
      "pay expectation",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: [...TEXT_KINDS, "SELECT", "COMBOBOX"],
    supportingSections: [...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "SENSITIVE",
    consequential: true,
    minimumPolicy: "CONFIRM_ONCE_PER_JOB",
    optionValues: [],
  },
  {
    concept: "RELOCATION_PREFERENCE",
    aliases: ["relocation", "willing to relocate", "open to relocation"],
    negativeLabelTerms: [],
    compatibleControlKinds: [...CHOICE_KINDS, "CHECKBOX"],
    supportingSections: [...ELIGIBILITY_SECTIONS],
    conflictingSections: [...OTHER_PARTY_SECTIONS],
    sensitivity: "PERSONAL",
    consequential: true,
    minimumPolicy: "FILL_FROM_EXPLICIT_RECORD",
    optionValues: YES_NO_OPTIONS("OPEN", "DECLINED"),
  },
  {
    concept: "DEMOGRAPHIC_DISCLOSURE",
    aliases: [
      "veteran status",
      "voluntary veteran status",
      "race",
      "ethnicity",
      "gender",
      "disability",
      "disability status",
      "voluntary self identification",
      "demographic",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: [...CHOICE_KINDS, "CHECKBOX", "MULTI_SELECT"],
    supportingSections: [...VOLUNTARY_SECTIONS, ...ELIGIBILITY_SECTIONS],
    conflictingSections: [],
    sensitivity: "SENSITIVE",
    consequential: false,
    minimumPolicy: "NEVER_AUTOFILL",
    optionValues: [],
  },
  {
    concept: "SECURITY_CLEARANCE",
    aliases: ["security clearance", "clearance", "clearance reference"],
    negativeLabelTerms: [],
    compatibleControlKinds: [
      ...TEXT_KINDS,
      "SELECT",
      "COMBOBOX",
      "RADIO_GROUP",
    ],
    supportingSections: [...ELIGIBILITY_SECTIONS],
    conflictingSections: [],
    sensitivity: "SENSITIVE",
    consequential: true,
    minimumPolicy: "NEVER_AUTOFILL",
    optionValues: [],
  },
  {
    concept: "LICENSE_VALIDITY",
    aliases: [
      "license",
      "license number",
      "license validity",
      "professional license",
      "certification validity",
    ],
    negativeLabelTerms: [],
    compatibleControlKinds: [...TEXT_KINDS, "SELECT", "COMBOBOX"],
    supportingSections: [...ELIGIBILITY_SECTIONS],
    conflictingSections: [],
    sensitivity: "PERSONAL",
    consequential: true,
    minimumPolicy: "CONFIRM_IF_RECORD_EXPIRED",
    optionValues: [],
  },
];

const CATALOG_BY_CONCEPT: ReadonlyMap<FeasibilityConcept, ConceptRule> =
  new Map(CATALOG.map((rule) => [rule.concept, rule]));

/** The complete closed catalog in canonical rule order. */
export function feasibilityCatalog(): readonly ConceptRule[] {
  return CATALOG;
}

export function conceptRule(concept: FeasibilityConcept): ConceptRule {
  const rule = CATALOG_BY_CONCEPT.get(concept);
  if (rule === undefined) {
    throw new Error(`unknown feasibility concept: ${concept}`);
  }
  return rule;
}

export function isFeasibilityConcept(
  value: string,
): value is FeasibilityConcept {
  return CATALOG_BY_CONCEPT.has(value as FeasibilityConcept);
}

export function isFeasibilityValuePolicy(
  value: string,
): value is FeasibilityValuePolicy {
  return (FEASIBILITY_VALUE_POLICIES as readonly string[]).includes(value);
}
