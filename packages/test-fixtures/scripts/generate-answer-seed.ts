import { measureAnswerAgainstConstraint } from "../src/answer-metrics.ts";
import {
  FIXTURE_SCHEMA_VERSION,
  SCHEMA_REFS,
  type AnswerConstraint,
  type AnswerScenario,
  type EvidenceArtifact,
  type FieldValuePolicy,
  type FixtureMetadata,
  type QuestionCase,
  type QuestionIntent,
  type SensitiveConcept,
  type SyntheticJob,
  type SyntheticProfile,
} from "../src/model.ts";
import { policyDecisionAt } from "../src/temporal-policy.ts";

const ZERO_DIGEST = `sha256:${"0".repeat(64)}` as const;
export const W02_REVIEWED_AT = "2026-08-04T09:00:00Z";

function w02Metadata(): FixtureMetadata {
  return {
    author: "m02w02-lead-author",
    reviewer: "m02w02-fixture-reviewer",
    reviewed_at: W02_REVIEWED_AT,
    expected_result_provenance: "M02W02_SYNTHETIC_AUTHORING_REVIEW",
    synthetic_data: true,
    redaction_state: "SYNTHETIC_RESERVED",
    historical_content_hash: ZERO_DIGEST,
  };
}

function stableId(prefix: string, value: number): string {
  return `${prefix}_${value.toString().padStart(26, "0")}`;
}

interface ClusterSeed {
  readonly intent: QuestionIntent;
  readonly layer: "BASE" | "SENSITIVE_OVERLAY";
  readonly concept?: SensitiveConcept;
  readonly phrasings: readonly [string, string, string];
}

/**
 * Reviewed finite question matrix: two BASE clusters per v1.4 intent, then
 * eight sensitive-overlay clusters so every v1.4 sensitive concept has a
 * dedicated question. Each cluster is one canonical phrasing plus two
 * semantically equivalent, materially reworded paraphrases.
 */
const CLUSTER_SEEDS: readonly ClusterSeed[] = [
  {
    intent: "MOTIVATION_COMPANY",
    layer: "BASE",
    phrasings: [
      "Why do you want to work at our company?",
      "What draws you to join this organization specifically?",
      "Explain the reasons this employer appeals to you.",
    ],
  },
  {
    intent: "MOTIVATION_COMPANY",
    layer: "BASE",
    phrasings: [
      "What excites you about our mission and products?",
      "Which parts of this company's work interest you most?",
      "Tell us what makes this team compelling for you.",
    ],
  },
  {
    intent: "MOTIVATION_ROLE",
    layer: "BASE",
    phrasings: [
      "Why are you interested in this role?",
      "What attracts you to this particular position?",
      "Describe why this job fits your interests.",
    ],
  },
  {
    intent: "MOTIVATION_ROLE",
    layer: "BASE",
    phrasings: [
      "How does this position match your professional focus?",
      "In what ways does this role align with your work?",
      "Explain the fit between you and this opening.",
    ],
  },
  {
    intent: "EXPERIENCE_EXAMPLE",
    layer: "BASE",
    phrasings: [
      "Describe a time you used your core technical skills on the job.",
      "Give an example of applying your main skills in real work.",
      "Share one occasion where your primary expertise drove a task.",
    ],
  },
  {
    intent: "EXPERIENCE_EXAMPLE",
    layer: "BASE",
    phrasings: [
      "Tell us about your hands-on experience with machine learning.",
      "What direct machine learning work have you performed?",
      "Summarize projects where you personally built machine learning systems.",
    ],
  },
  {
    intent: "PROJECT_EXAMPLE",
    layer: "BASE",
    phrasings: [
      "Describe a project you are proud of and your contribution.",
      "Walk us through one project where your part mattered.",
      "Present a favorite project and explain what you delivered.",
    ],
  },
  {
    intent: "PROJECT_EXAMPLE",
    layer: "BASE",
    phrasings: [
      "Share the measurable percentage improvement your best project produced.",
      "What exact percent gain did your strongest project achieve?",
      "Quantify the improvement rate delivered by your top project.",
    ],
  },
  {
    intent: "LEADERSHIP",
    layer: "BASE",
    phrasings: [
      "Describe a time you led a team through a challenge.",
      "Give an example of guiding colleagues past an obstacle.",
      "Tell us when you took charge of a difficult effort.",
    ],
  },
  {
    intent: "LEADERSHIP",
    layer: "BASE",
    phrasings: [
      "What formal people-management experience do you bring?",
      "Summarize your history of directly managing staff.",
      "How many years have you spent leading direct reports?",
    ],
  },
  {
    intent: "CONFLICT",
    layer: "BASE",
    phrasings: [
      "Describe a workplace disagreement and how you resolved it.",
      "Tell us about a conflict with a colleague and the outcome.",
      "Share an example of settling a professional dispute.",
    ],
  },
  {
    intent: "CONFLICT",
    layer: "BASE",
    phrasings: [
      "How do you handle disagreement about technical direction?",
      "What is your approach when teammates dispute a design?",
      "Explain your method for resolving engineering debates.",
    ],
  },
  {
    intent: "FAILURE_LEARNING",
    layer: "BASE",
    phrasings: [
      "Describe a professional failure and what it taught you.",
      "Tell us about a mistake at work and the lesson learned.",
      "Share a setback you experienced and how you grew from it.",
    ],
  },
  {
    intent: "FAILURE_LEARNING",
    layer: "BASE",
    phrasings: [
      "What is the hardest feedback you have received and your response?",
      "Recall difficult criticism you were given and how you reacted.",
      "Describe tough feedback that changed how you work.",
    ],
  },
  {
    intent: "STRENGTH",
    layer: "BASE",
    phrasings: [
      "What is your greatest professional strength?",
      "Which skill do you consider your strongest asset?",
      "Name the capability where you excel most.",
    ],
  },
  {
    intent: "STRENGTH",
    layer: "BASE",
    phrasings: [
      "Summarize your expertise in distributed systems and quantum computing.",
      "Describe your combined depth across distributed systems plus quantum computing.",
      "How strong are you in both distributed systems and quantum computing?",
    ],
  },
  {
    intent: "CAREER_GOAL",
    layer: "BASE",
    phrasings: [
      "Where do you want your career to go next?",
      "What is your professional goal for the coming years?",
      "Describe the direction you plan for your career.",
    ],
  },
  {
    intent: "CAREER_GOAL",
    layer: "BASE",
    phrasings: [
      "How would this role advance your longer-term plans?",
      "In what way does this position support your future ambitions?",
      "Connect this opening to the path you intend to follow.",
    ],
  },
  {
    intent: "AVAILABILITY",
    layer: "BASE",
    phrasings: [
      "What is your earliest possible start date?",
      "When would you be able to begin this position?",
      "How soon can you start if selected?",
    ],
  },
  {
    intent: "AVAILABILITY",
    layer: "BASE",
    phrasings: [
      "Can your reviewed employment history be verified with the listed employers? Answer Yes or No.",
      "Is each listed employment record open to verification? Reply Yes or No.",
      "Confirm with Yes or No whether we may verify your listed employment records.",
    ],
  },
  {
    intent: "SALARY",
    layer: "BASE",
    concept: "SALARY_EXPECTATION_UNITS",
    phrasings: [
      "What are your salary expectations for this role?",
      "What compensation range are you seeking here?",
      "Share the pay level you expect for this position.",
    ],
  },
  {
    intent: "SALARY",
    layer: "BASE",
    concept: "SALARY_EXPECTATION_UNITS",
    phrasings: [
      "State your expected hourly rate in local currency units.",
      "Provide the per-hour pay figure you require.",
      "What hourly wage amount are you requesting?",
    ],
  },
  {
    intent: "LOCATION_RELOCATION",
    layer: "BASE",
    concept: "RELOCATION_COMMITMENT",
    phrasings: [
      "What is your relocation preference for this role?",
      "Which relocation arrangement works for you?",
      "Describe your willingness to relocate for this position.",
    ],
  },
  {
    intent: "LOCATION_RELOCATION",
    layer: "BASE",
    concept: "RELOCATION_COMMITMENT",
    phrasings: [
      "Is your recorded relocation preference still current today?",
      "Does your earlier relocation answer remain accurate now?",
      "Confirm whether your stored relocation preference is up to date.",
    ],
  },
  {
    intent: "WORK_AUTHORIZATION",
    layer: "BASE",
    concept: "WORK_AUTHORIZATION_STATUS",
    phrasings: [
      "What is your work authorization status in the United States?",
      "Are you legally authorized to work in the United States?",
      "Describe your current United States employment eligibility.",
    ],
  },
  {
    intent: "WORK_AUTHORIZATION",
    layer: "BASE",
    concept: "WORK_AUTHORIZATION_STATUS",
    phrasings: [
      "Will your authorization status require review before an offer?",
      "Should we expect additional checks on your employment eligibility?",
      "Does confirming your work status need extra verification steps?",
    ],
  },
  {
    intent: "SPONSORSHIP",
    layer: "BASE",
    concept: "VISA_SPONSORSHIP",
    phrasings: [
      "Do you now or in the future require visa sponsorship?",
      "Will you need employer sponsorship for work eligibility?",
      "Is immigration sponsorship necessary for you to work here?",
    ],
  },
  {
    intent: "SPONSORSHIP",
    layer: "BASE",
    concept: "VISA_SPONSORSHIP",
    phrasings: [
      "This role cannot offer sponsorship; can you proceed without it?",
      "Given no sponsorship is available, are you still eligible?",
      "Without any employer sponsorship, may your application continue?",
    ],
  },
  {
    intent: "EXPORT_CONTROL",
    layer: "BASE",
    concept: "EXPORT_CONTROL_STATUS",
    phrasings: [
      "Provide your citizenship or residency for export-control screening.",
      "For export-control review, state your citizenship or residency status.",
      "What citizenship details apply to you under export-control rules?",
    ],
  },
  {
    intent: "EXPORT_CONTROL",
    layer: "BASE",
    concept: "EXPORT_CONTROL_STATUS",
    phrasings: [
      "Under this jurisdiction's export regime, what residency category applies to you?",
      "Which export-control residency classification covers you in this region?",
      "State the export-screening category that applies to your residency here.",
    ],
  },
  {
    intent: "LEGAL_COMPLIANCE",
    layer: "BASE",
    phrasings: [
      "Do the reviewed synthetic records include employment history? Answer Yes or No.",
      "Is employment history part of the reviewed synthetic records? Reply Yes or No.",
      "Answer Yes or No: does the reviewed record set contain employment history?",
    ],
  },
  {
    intent: "LEGAL_COMPLIANCE",
    layer: "BASE",
    phrasings: [
      "How do you keep your work compliant with reporting requirements?",
      "Describe your approach to meeting quality reporting obligations.",
      "Explain how you satisfy required reporting standards in your work.",
    ],
  },
  {
    intent: "OTHER_FACTUAL",
    layer: "BASE",
    phrasings: [
      "Can you commit to working on-site in Exampleville every day?",
      "Are you able to be physically present daily at the Exampleville site?",
      "Confirm your ability to attend the Exampleville office each workday.",
    ],
  },
  {
    intent: "OTHER_FACTUAL",
    layer: "BASE",
    phrasings: [
      "Do you currently hold an active healthcare operations license?",
      "Is your healthcare operations license valid right now?",
      "State whether your healthcare operations licensure is presently current.",
    ],
  },
  {
    intent: "OTHER_NARRATIVE",
    layer: "BASE",
    phrasings: [
      "Tell us more about your current operations process role.",
      "Describe the operations process work you are doing today.",
      "What does your present operations process position involve?",
    ],
  },
  {
    intent: "OTHER_NARRATIVE",
    layer: "BASE",
    phrasings: [
      "Walk us through one reviewed project from start to finish.",
      "Narrate a complete project journey you have delivered.",
      "Take us end to end through a project you completed.",
    ],
  },
  {
    intent: "PORTFOLIO_LINK",
    layer: "BASE",
    phrasings: [
      "Share a link to your professional portfolio or website.",
      "Provide the web address of your portfolio.",
      "Where can we view your professional site online?",
    ],
  },
  {
    intent: "PORTFOLIO_LINK",
    layer: "BASE",
    phrasings: [
      "Paste one URL that best represents your work.",
      "Give a single web link showcasing what you build.",
      "Which one online address should we open to see your work?",
    ],
  },
  {
    intent: "DEMOGRAPHIC_VOLUNTARY",
    layer: "BASE",
    concept: "RACE_ETHNICITY",
    phrasings: [
      "Voluntary survey: what is your race or ethnicity?",
      "If you choose to answer, which racial or ethnic group describes you?",
      "Optional demographic item: state your race or ethnicity.",
    ],
  },
  {
    intent: "DEMOGRAPHIC_VOLUNTARY",
    layer: "BASE",
    concept: "GENDER_IDENTITY",
    phrasings: [
      "Voluntary survey: what is your gender identity?",
      "If you wish to share, how do you describe your gender?",
      "Optional demographic item: state your gender identity.",
    ],
  },
  {
    intent: "LEGAL_COMPLIANCE",
    layer: "SENSITIVE_OVERLAY",
    concept: "CRIMINAL_LEGAL_DISCLOSURE",
    phrasings: [
      "Have you ever been convicted of a crime?",
      "Do you have any criminal convictions on record?",
      "Disclose whether a court has ever convicted you.",
    ],
  },
  {
    intent: "DEMOGRAPHIC_VOLUNTARY",
    layer: "SENSITIVE_OVERLAY",
    concept: "DISABILITY_STATUS",
    phrasings: [
      "Voluntary survey: do you identify as having a disability?",
      "If you choose to respond, do you consider yourself disabled?",
      "Optional item: state whether you live with a disability.",
    ],
  },
  {
    intent: "DEMOGRAPHIC_VOLUNTARY",
    layer: "SENSITIVE_OVERLAY",
    concept: "VETERAN_STATUS",
    phrasings: [
      "Voluntary survey: are you a protected veteran?",
      "If you wish to answer, do you hold veteran status?",
      "Optional item: indicate any protected veteran classification.",
    ],
  },
  {
    intent: "OTHER_FACTUAL",
    layer: "SENSITIVE_OVERLAY",
    concept: "AGE_DATE_OF_BIRTH",
    phrasings: [
      "What is your date of birth?",
      "Please provide your birth date.",
      "Enter the day, month, and year you were born.",
    ],
  },
  {
    intent: "LEGAL_COMPLIANCE",
    layer: "SENSITIVE_OVERLAY",
    concept: "CONFLICT_OF_INTEREST",
    phrasings: [
      "Do you have any conflicts of interest to disclose?",
      "Are there interests you hold that could conflict with this work?",
      "Declare any relationships that might create a conflict of interest.",
    ],
  },
  {
    intent: "LEGAL_COMPLIANCE",
    layer: "SENSITIVE_OVERLAY",
    concept: "NONCOMPETE_RESTRICTION",
    phrasings: [
      "Are you bound by a noncompete or restrictive covenant?",
      "Does any prior employment agreement restrict where you may work?",
      "Disclose whether a noncompete limits your next employer choice.",
    ],
  },
  {
    intent: "OTHER_FACTUAL",
    layer: "SENSITIVE_OVERLAY",
    concept: "SECURITY_CLEARANCE",
    phrasings: [
      "Do you hold an active security clearance?",
      "What government security clearance, if any, do you carry?",
      "State whether you currently possess a security clearance.",
    ],
  },
  {
    intent: "OTHER_FACTUAL",
    layer: "SENSITIVE_OVERLAY",
    concept: "EMPLOYEE_IDENTIFIER",
    phrasings: [
      "Enter your previous employee ID number.",
      "Provide the staff identifier from your last employer.",
      "What internal employee number were you assigned before?",
    ],
  },
];

interface ConstraintSeed {
  readonly description: string;
  readonly answerRequired: boolean;
  readonly linePolicy: AnswerConstraint["line_policy"];
  readonly maxWords?: number;
  readonly minWords?: number;
  readonly maxCharacters?: number;
  readonly minCharacters?: number;
  readonly exactFormat?: AnswerConstraint["exact_format"];
}

const CONSTRAINT_SEEDS: readonly ConstraintSeed[] = [
  {
    description:
      "Deterministic word-limit boundary control: at most twelve words on one line.",
    answerRequired: true,
    linePolicy: "SINGLE_LINE",
    maxWords: 12,
  },
  {
    description:
      "Deterministic character-limit boundary control: at most forty Unicode code points on one line.",
    answerRequired: true,
    linePolicy: "SINGLE_LINE",
    maxCharacters: 40,
  },
  {
    description:
      "Minimum-substance control: between five and sixty words, one line.",
    answerRequired: true,
    linePolicy: "SINGLE_LINE",
    minWords: 5,
    maxWords: 60,
  },
  {
    description: "Single-line HTTPS URL in the reserved synthetic domain.",
    answerRequired: true,
    linePolicy: "SINGLE_LINE",
    exactFormat: "HTTPS_URL",
  },
  {
    description: "Exact single-line Yes or No response.",
    answerRequired: true,
    linePolicy: "SINGLE_LINE",
    exactFormat: "YES_NO",
  },
  {
    description:
      "Short narrative: at most two hundred eighty code points, line breaks allowed.",
    answerRequired: true,
    linePolicy: "MULTILINE_ALLOWED",
    maxCharacters: 280,
  },
  {
    description:
      "Compact single-line answer of at most one hundred twenty code points.",
    answerRequired: true,
    linePolicy: "SINGLE_LINE",
    maxCharacters: 120,
  },
  {
    description:
      "Standard narrative answer of at most one hundred fifty words, line breaks allowed.",
    answerRequired: true,
    linePolicy: "MULTILINE_ALLOWED",
    maxWords: 150,
  },
  {
    description:
      "Required reflective answer of at least twenty code points, line breaks allowed.",
    answerRequired: true,
    linePolicy: "MULTILINE_ALLOWED",
    minCharacters: 20,
  },
  {
    description: "Optional narrative answer with line breaks allowed.",
    answerRequired: false,
    linePolicy: "MULTILINE_ALLOWED",
  },
];

export interface AnswerSeedInput {
  readonly profiles: readonly SyntheticProfile[];
  readonly evidence: readonly EvidenceArtifact[];
  readonly jobs: readonly SyntheticJob[];
  readonly policies: readonly FieldValuePolicy[];
}

export interface AnswerSeedOutput {
  readonly questionCases: QuestionCase[];
  readonly answerConstraints: AnswerConstraint[];
  readonly answerScenarios: AnswerScenario[];
}

interface ScenarioSpec {
  readonly cluster: number;
  readonly member?: number;
  readonly profile: number;
  readonly job: number;
  readonly date?: string;
  readonly outcome: AnswerScenario["expected_outcome"];
  readonly constraint?: number;
  readonly boundary?: "AT_LIMIT" | "ONE_ABOVE_LIMIT" | "ONE_BELOW_LIMIT";
  readonly policyConcept?: FieldValuePolicy["field_concept"];
  readonly defaultPolicy?: AnswerScenario["default_policy"];
  readonly answerText?: string;
  readonly answerEvidence?: readonly number[];
  readonly explicitSource?: "FIELD_RECORD" | "PROFILE_CONTACT_WEBSITE";
  readonly fieldConcept?: FieldValuePolicy["field_concept"];
  readonly staleReason?: AnswerScenario["stale_reason"];
  readonly reusedScenario?: number;
  readonly insufficiencyReason?: AnswerScenario["insufficiency_reason"];
  readonly contextEvidence?: readonly number[];
  readonly jurisdiction?: "NON_US_FIXTURE" | "US_FIXTURE";
  readonly rationale: string;
}

const DEFAULT_EVALUATION_DATE = "2026-07-29";

/**
 * Reviewed finite scenario matrix. Cluster numbers are 1-based positions in
 * CLUSTER_SEEDS; profile/job/evidence numbers are the 1-based W01 stable-ID
 * numbers; constraint numbers are 1-based positions in CONSTRAINT_SEEDS;
 * reusedScenario numbers are 1-based positions in this same list.
 */
const SCENARIO_SPECS: readonly ScenarioSpec[] = [
  {
    cluster: 1,
    profile: 1,
    job: 1,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 8,
    answerText:
      "Synthetic Employer 01-J's platform focus matches my reviewed employment work applying TypeScript and Node.js, so I can contribute to API design from day one.",
    answerEvidence: [1],
    rationale:
      "Company motivation grounded in reviewed employment evidence for this exact employer context.",
  },
  {
    cluster: 2,
    profile: 2,
    job: 3,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 6,
    answerText:
      "The distributed systems mission here builds directly on my reviewed platform work with Node.js.",
    answerEvidence: [7],
    rationale:
      "Second company-motivation cluster exercised with a compliant short narrative.",
  },
  {
    cluster: 3,
    profile: 2,
    job: 3,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 8,
    answerText:
      "This senior platform role matches my reviewed employment record applying Distributed Systems and Node.js, and I want to keep deepening that cloud architecture work.",
    answerEvidence: [7],
    rationale:
      "Role motivation grounded in the reviewed senior platform employment evidence.",
  },
  {
    cluster: 4,
    profile: 6,
    job: 11,
    outcome: "UNSUPPORTED_OR_CONTRADICTED",
    insufficiencyReason: "PRESUPPOSED_EXPERIENCE_ABSENT",
    rationale:
      "The prompt presupposes doctoral research the synthetic profile does not hold, so no answer may be authored.",
  },
  {
    cluster: 5,
    profile: 1,
    job: 1,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 8,
    answerText:
      "In reviewed employment record 1 at Synthetic Employer 01-A I applied TypeScript and Node.js to deliver supported API design work.",
    answerEvidence: [1],
    rationale:
      "Core experience example reproduced from reviewed employment evidence.",
  },
  {
    cluster: 6,
    profile: 3,
    job: 8,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "WEAK_RELATED_EVIDENCE_ONLY",
    contextEvidence: [16],
    rationale:
      "Only weakly related Python education evidence exists for hands-on machine learning, so the request cannot be answered.",
  },
  {
    cluster: 7,
    profile: 5,
    job: 9,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 8,
    answerText:
      "In reviewed project 1 I demonstrated Requirements Analysis end to end, owning the reviewed synthetic delivery for Synthetic Project 05-A.",
    answerEvidence: [26],
    rationale: "Project example grounded in reviewed project evidence.",
  },
  {
    cluster: 8,
    profile: 5,
    job: 9,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "METRIC_NEVER_RECORDED",
    rationale:
      "No reviewed record captures a percentage improvement, so no figure may be invented.",
  },
  {
    cluster: 9,
    profile: 2,
    job: 4,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 6,
    answerText:
      "While delivering reviewed platform work I coordinated the team through a difficult migration to completion.",
    answerEvidence: [8],
    rationale:
      "Leadership example bounded to reviewed employment evidence without invented scope.",
  },
  {
    cluster: 10,
    profile: 11,
    job: 21,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "NO_RELEVANT_EVIDENCE",
    rationale:
      "The entry-level synthetic profile has no reviewed people-management evidence, so the question must be abstained.",
  },
  {
    cluster: 11,
    profile: 4,
    job: 7,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 3,
    answerText: "We aligned quickly.",
    answerEvidence: [19],
    rationale:
      "Deliberate minimum-words violation: a three-word answer under the five-word floor stays unreleasable.",
  },
  {
    cluster: 12,
    profile: 4,
    job: 7,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 6,
    answerText:
      "When designs are disputed I return to the reviewed evidence, compare options openly, and commit to the outcome.",
    answerEvidence: [19],
    rationale:
      "Compliant conflict-approach narrative grounded in reviewed employment evidence.",
  },
  {
    cluster: 13,
    profile: 3,
    job: 5,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 9,
    answerText:
      "Early in my reviewed transition into data work I underestimated modeling scope; I now size Data Modeling tasks against reviewed evidence first.",
    answerEvidence: [13],
    rationale:
      "Failure-learning narrative grounded in the reviewed career-transition employment record.",
  },
  {
    cluster: 14,
    profile: 9,
    job: 17,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 7,
    answerText:
      "Hard feedback on forecasting accuracy pushed me\nto rebuild my reviewed pipeline analysis habits.",
    answerEvidence: [49],
    rationale:
      "Deliberate single-line violation: the answer contains a line break and stays unreleasable.",
  },
  {
    cluster: 15,
    profile: 1,
    job: 1,
    date: "2026-07-01",
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 1,
    boundary: "ONE_BELOW_LIMIT",
    answerText:
      "My strength is applying TypeScript and Node.js in supported delivery work.",
    answerEvidence: [1],
    rationale: "Word-limit boundary control one word under the limit.",
  },
  {
    cluster: 15,
    profile: 1,
    job: 2,
    date: "2026-07-01",
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 1,
    boundary: "AT_LIMIT",
    answerText:
      "My reviewed strength is applying TypeScript and Node.js in supported delivery work.",
    answerEvidence: [1],
    rationale: "Word-limit boundary control exactly at the limit.",
  },
  {
    cluster: 15,
    profile: 1,
    job: 1,
    date: "2026-07-02",
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 1,
    boundary: "ONE_ABOVE_LIMIT",
    answerText:
      "My clearly reviewed strength is applying TypeScript and Node.js in supported delivery work.",
    answerEvidence: [1],
    rationale:
      "Word-limit boundary control one word over the limit; not releasable.",
  },
  {
    cluster: 16,
    profile: 2,
    job: 4,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "EVIDENCE_SUPPORTS_NARROWER_ANSWER",
    contextEvidence: [7],
    rationale:
      "Reviewed evidence supports distributed systems only; the quantum-computing half of the request has no support.",
  },
  {
    cluster: 17,
    profile: 2,
    job: 3,
    date: "2026-07-01",
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 2,
    boundary: "ONE_BELOW_LIMIT",
    answerText: "Grow as a distributed systems engineer.",
    answerEvidence: [7],
    rationale: "Character-limit boundary control one code point under.",
  },
  {
    cluster: 17,
    profile: 2,
    job: 4,
    date: "2026-07-01",
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 2,
    boundary: "AT_LIMIT",
    answerText: "Advance as a distributed systems leader.",
    answerEvidence: [7],
    rationale: "Character-limit boundary control exactly at the limit.",
  },
  {
    cluster: 17,
    profile: 2,
    job: 3,
    date: "2026-07-02",
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 2,
    boundary: "ONE_ABOVE_LIMIT",
    answerText: "Advance as a distributed systems leaders.",
    answerEvidence: [7],
    rationale:
      "Character-limit boundary control one code point over; not releasable.",
  },
  {
    cluster: 18,
    profile: 5,
    job: 10,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 10,
    answerText:
      "This analytics role extends my reviewed project record toward the experiment-driven work I plan to keep building.",
    answerEvidence: [26],
    rationale:
      "Optional-constraint narrative connecting reviewed project evidence to the stated goal.",
  },
  {
    cluster: 19,
    profile: 6,
    job: 11,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "NO_RELEVANT_EVIDENCE",
    rationale:
      "No reviewed record captures an availability date, so a start date cannot be asserted.",
  },
  {
    cluster: 20,
    profile: 1,
    job: 2,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 5,
    answerText: "Yes",
    answerEvidence: [1],
    rationale:
      "Exact-format control: the reviewed employment record supports a verifiable Yes.",
  },
  {
    cluster: 21,
    profile: 1,
    job: 1,
    outcome: "CONFIRMATION_REQUIRED",
    policyConcept: "SALARY_EXPECTATION",
    rationale:
      "Salary expectation is confirm-once-per-job for this profile, so the recorded band releases only after confirmation.",
  },
  {
    cluster: 21,
    profile: 3,
    job: 5,
    outcome: "BLOCKED_BY_POLICY",
    policyConcept: "SALARY_EXPECTATION",
    rationale:
      "Salary expectation is never-autofill for this profile, so the question is blocked with an explanation.",
  },
  {
    cluster: 22,
    profile: 1,
    job: 2,
    outcome: "STALE_CONTEXT",
    staleReason: "COMPENSATION_CONTEXT_CHANGED",
    contextEvidence: [6],
    rationale:
      "The recorded synthetic compensation band does not answer an hourly-rate context, so the stored answer is stale for this ask.",
  },
  {
    cluster: 23,
    profile: 6,
    job: 11,
    outcome: "CONFIRMATION_REQUIRED",
    policyConcept: "RELOCATION_PREFERENCE",
    rationale:
      "The approved relocation record expired before the evaluation date, so the fill policy degrades to explicit confirmation.",
  },
  {
    cluster: 23,
    profile: 2,
    job: 3,
    outcome: "EXPLICIT_RECORD_ANSWER",
    policyConcept: "RELOCATION_PREFERENCE",
    explicitSource: "FIELD_RECORD",
    fieldConcept: "RELOCATION_PREFERENCE",
    rationale:
      "Confirm-if-expired relocation policy releases because the approved record has not expired at the evaluation date.",
  },
  {
    cluster: 23,
    member: 2,
    profile: 2,
    job: 1,
    outcome: "STALE_CONTEXT",
    staleReason: "WRONG_LOCATION",
    reusedScenario: 29,
    rationale:
      "The released relocation answer was authored for a place-based Exampleville job and may not be reused verbatim for a remote-location context.",
  },
  {
    cluster: 24,
    profile: 6,
    job: 11,
    outcome: "STALE_CONTEXT",
    staleReason: "EXPIRED_SOURCE_RECORD",
    contextEvidence: [36],
    rationale:
      "The approved relocation record expired before this evaluation date, so the stored answer requires re-confirmation.",
  },
  {
    cluster: 25,
    profile: 1,
    job: 1,
    outcome: "EXPLICIT_RECORD_ANSWER",
    policyConcept: "WORK_AUTHORIZATION",
    explicitSource: "FIELD_RECORD",
    fieldConcept: "WORK_AUTHORIZATION",
    rationale:
      "Fill-from-explicit-record work authorization released from the approved current field record.",
  },
  {
    cluster: 26,
    profile: 2,
    job: 3,
    outcome: "CONFIRMATION_REQUIRED",
    policyConcept: "WORK_AUTHORIZATION",
    rationale:
      "Work authorization is confirm-once-per-job for this profile, so the approved value releases only after confirmation.",
  },
  {
    cluster: 27,
    profile: 3,
    job: 6,
    outcome: "EXPLICIT_RECORD_ANSWER",
    policyConcept: "SPONSORSHIP_REQUIREMENT",
    explicitSource: "FIELD_RECORD",
    fieldConcept: "SPONSORSHIP_REQUIREMENT",
    rationale:
      "Fill-from-explicit-record sponsorship answer released from the approved current field record.",
  },
  {
    cluster: 27,
    profile: 2,
    job: 4,
    outcome: "BLOCKED_BY_POLICY",
    policyConcept: "SPONSORSHIP_REQUIREMENT",
    rationale:
      "Sponsorship is block-and-explain for this profile, so no value is auto-answered.",
  },
  {
    cluster: 28,
    profile: 8,
    job: 17,
    outcome: "STALE_CONTEXT",
    staleReason: "AUTHORIZATION_CONTEXT_CHANGED",
    contextEvidence: [48],
    rationale:
      "The approved record requires sponsorship while this job forbids it; any earlier sponsorship answer is incompatible here and must be blocked.",
  },
  {
    cluster: 29,
    profile: 5,
    job: 9,
    outcome: "BLOCKED_BY_POLICY",
    defaultPolicy: "BLOCK_AND_EXPLAIN",
    rationale:
      "Export-control status has no approved explicit record, so the reviewed default blocks any inferred answer.",
  },
  {
    cluster: 30,
    profile: 1,
    job: 2,
    outcome: "STALE_CONTEXT",
    staleReason: "WRONG_JURISDICTION",
    jurisdiction: "NON_US_FIXTURE",
    rationale:
      "United States records cannot answer a non-US export-control jurisdiction; paraphrase similarity never overrides jurisdiction.",
  },
  {
    cluster: 31,
    profile: 1,
    job: 1,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 5,
    answerText: "Yes.",
    answerEvidence: [1],
    rationale:
      "Deliberate exact-format violation: the trailing period breaks the strict Yes or No format, so the answer stays unreleasable.",
  },
  {
    cluster: 32,
    profile: 7,
    job: 13,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 6,
    answerText:
      "I keep quality reporting compliant by following the reviewed clinical operations practices from my employment record.",
    answerEvidence: [37],
    rationale:
      "Compliance-approach narrative grounded in reviewed healthcare employment evidence.",
  },
  {
    cluster: 33,
    profile: 10,
    job: 20,
    outcome: "UNSUPPORTED_OR_CONTRADICTED",
    insufficiencyReason: "EVIDENCE_CONTRADICTS_REQUEST",
    contextEvidence: [60],
    rationale:
      "The approved remote-only relocation record contradicts a daily on-site commitment, so the request is blocked.",
  },
  {
    cluster: 34,
    profile: 7,
    job: 13,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "EVIDENCE_STALE_AT_EVALUATION",
    contextEvidence: [41],
    rationale:
      "The cited healthcare operations license is expired at the evaluation date, so current licensure cannot be asserted without confirmation.",
  },
  {
    cluster: 35,
    profile: 3,
    job: 5,
    outcome: "STALE_CONTEXT",
    staleReason: "SUPERSEDED_PROFILE_FACT",
    contextEvidence: [13],
    rationale:
      "The reviewed transition record supersedes the prior operations role, so a current-operations narrative would be stale.",
  },
  {
    cluster: 36,
    profile: 5,
    job: 10,
    outcome: "SUPPORTED_NARRATIVE_ANSWER",
    constraint: 8,
    answerText:
      "Reviewed project 2 ran from scoping through delivery: I framed the Requirements Analysis approach, executed it, and closed out the reviewed synthetic engagement.",
    answerEvidence: [27],
    rationale:
      "End-to-end project narrative grounded in the reviewed project record.",
  },
  {
    cluster: 37,
    profile: 1,
    job: 1,
    outcome: "EXPLICIT_RECORD_ANSWER",
    constraint: 4,
    explicitSource: "PROFILE_CONTACT_WEBSITE",
    rationale:
      "Portfolio link released directly from the reviewed synthetic profile website value.",
  },
  {
    cluster: 38,
    profile: 4,
    job: 7,
    outcome: "EXPLICIT_RECORD_ANSWER",
    constraint: 4,
    explicitSource: "PROFILE_CONTACT_WEBSITE",
    rationale:
      "Second portfolio cluster released from the bound profile website value.",
  },
  {
    cluster: 39,
    profile: 2,
    job: 3,
    outcome: "VOLUNTARY_DECLINE",
    policyConcept: "DEMOGRAPHIC_DISCLOSURE",
    rationale:
      "The voluntary demographic policy for this profile prefers not to answer, so the survey is declined.",
  },
  {
    cluster: 40,
    profile: 4,
    job: 8,
    outcome: "VOLUNTARY_DECLINE",
    policyConcept: "DEMOGRAPHIC_DISCLOSURE",
    rationale:
      "The voluntary demographic policy for this profile prefers not to answer the gender item.",
  },
  {
    cluster: 41,
    profile: 4,
    job: 7,
    outcome: "BLOCKED_BY_POLICY",
    defaultPolicy: "BLOCK_AND_EXPLAIN",
    rationale:
      "Criminal-history disclosure is blocked by the reviewed default; no auto-answer exists.",
  },
  {
    cluster: 42,
    profile: 5,
    job: 10,
    outcome: "BLOCKED_BY_POLICY",
    policyConcept: "DEMOGRAPHIC_DISCLOSURE",
    rationale:
      "This profile's demographic policy is never-autofill, so the voluntary disability item is blocked rather than auto-answered.",
  },
  {
    cluster: 43,
    profile: 6,
    job: 12,
    outcome: "VOLUNTARY_DECLINE",
    policyConcept: "DEMOGRAPHIC_DISCLOSURE",
    rationale:
      "The voluntary demographic policy prefers not to answer the veteran item.",
  },
  {
    cluster: 44,
    profile: 9,
    job: 18,
    outcome: "BLOCKED_BY_POLICY",
    defaultPolicy: "NEVER_AUTOFILL",
    rationale:
      "Date of birth is never auto-answered under the reviewed default policy.",
  },
  {
    cluster: 45,
    profile: 10,
    job: 19,
    outcome: "CONFIRMATION_REQUIRED",
    defaultPolicy: "CONFIRM_ONCE_PER_JOB",
    rationale:
      "Conflict-of-interest disclosure requires explicit per-job confirmation under the reviewed default.",
  },
  {
    cluster: 46,
    profile: 11,
    job: 21,
    outcome: "CONFIRMATION_REQUIRED",
    defaultPolicy: "CONFIRM_ONCE_PER_JOB",
    rationale:
      "Noncompete disclosure requires explicit per-job confirmation under the reviewed default.",
  },
  {
    cluster: 47,
    profile: 9,
    job: 17,
    outcome: "INSUFFICIENT_EVIDENCE",
    insufficiencyReason: "SENSITIVE_RECORD_MISSING",
    rationale:
      "No approved explicit record covers security clearance, so the sensitive question has no releasable answer.",
  },
  {
    cluster: 48,
    profile: 12,
    job: 23,
    outcome: "BLOCKED_BY_POLICY",
    defaultPolicy: "NEVER_AUTOFILL",
    rationale:
      "Internal employee identifiers are never auto-answered under the reviewed default.",
  },
  {
    cluster: 1,
    member: 2,
    profile: 1,
    job: 3,
    outcome: "STALE_CONTEXT",
    staleReason: "WRONG_COMPANY",
    reusedScenario: 1,
    rationale:
      "A company-specific motivation answer may not be reused verbatim for a different employer; paraphrase similarity never overrides company context.",
  },
  {
    cluster: 3,
    member: 3,
    profile: 2,
    job: 4,
    outcome: "STALE_CONTEXT",
    staleReason: "WRONG_ROLE",
    reusedScenario: 3,
    rationale:
      "A role-specific motivation answer may not be reused verbatim for a different title in the same company family.",
  },
];

function conceptPolicy(
  policies: readonly FieldValuePolicy[],
  profileRef: string,
  concept: FieldValuePolicy["field_concept"],
): FieldValuePolicy {
  const found = policies.find(
    (policy) =>
      policy.profile_ref === profileRef && policy.field_concept === concept,
  );
  if (found === undefined) {
    throw new Error("answer seed requires an existing W01 field policy");
  }
  return found;
}

export function makeAnswerFixtures(input: AnswerSeedInput): AnswerSeedOutput {
  const questionCases: QuestionCase[] = [];
  CLUSTER_SEEDS.forEach((cluster, clusterIndex) => {
    cluster.phrasings.forEach((phrasing, phraseIndex) => {
      const question: QuestionCase = {
        id: stableId("question", clusterIndex * 3 + phraseIndex + 1),
        entity_type: "QUESTION_CASE",
        schema_ref: SCHEMA_REFS.QUESTION_CASE,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: w02Metadata(),
        cluster_ref: stableId("qcluster", clusterIndex + 1),
        intent: cluster.intent,
        case_role: phraseIndex === 0 ? "CANONICAL" : "PARAPHRASE",
        layer: cluster.layer,
        prompt_text: phrasing,
      };
      if (cluster.concept !== undefined) {
        question.sensitive_concept = cluster.concept;
      }
      questionCases.push(question);
    });
  });
  const answerConstraints: AnswerConstraint[] = CONSTRAINT_SEEDS.map(
    (seed, index) => {
      const constraint: AnswerConstraint = {
        id: stableId("ansconstraint", index + 1),
        entity_type: "ANSWER_CONSTRAINT",
        schema_ref: SCHEMA_REFS.ANSWER_CONSTRAINT,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: w02Metadata(),
        description: seed.description,
        answer_required: seed.answerRequired,
        line_policy: seed.linePolicy,
      };
      if (seed.maxWords !== undefined) {
        constraint.max_words = seed.maxWords;
      }
      if (seed.minWords !== undefined) {
        constraint.min_words = seed.minWords;
      }
      if (seed.maxCharacters !== undefined) {
        constraint.max_characters = seed.maxCharacters;
      }
      if (seed.minCharacters !== undefined) {
        constraint.min_characters = seed.minCharacters;
      }
      if (seed.exactFormat !== undefined) {
        constraint.exact_format = seed.exactFormat;
      }
      return constraint;
    },
  );
  const answerScenarios: AnswerScenario[] = SCENARIO_SPECS.map(
    (spec, index) => {
      const profile = input.profiles[spec.profile - 1];
      const job = input.jobs[spec.job - 1];
      if (profile === undefined || job === undefined) {
        throw new Error("answer seed profile or job binding is missing");
      }
      const questionNumber = (spec.cluster - 1) * 3 + (spec.member ?? 1);
      const evaluationDate = spec.date ?? DEFAULT_EVALUATION_DATE;
      const constraint =
        spec.constraint === undefined
          ? undefined
          : answerConstraints[spec.constraint - 1];
      const policy =
        spec.policyConcept === undefined
          ? undefined
          : conceptPolicy(input.policies, profile.id, spec.policyConcept);
      const policySource =
        policy === undefined
          ? undefined
          : input.evidence.find(
              (artifact) => artifact.id === policy.source_evidence_ref,
            );
      const decision =
        policy === undefined || policySource === undefined
          ? undefined
          : policyDecisionAt(policy, policySource, evaluationDate);
      let answer: AnswerScenario["answer"];
      if (spec.explicitSource === "PROFILE_CONTACT_WEBSITE") {
        answer = {
          text: profile.contact.website,
          evidence_refs: [],
          explicit_source: "PROFILE_CONTACT_WEBSITE",
        };
      } else if (spec.explicitSource === "FIELD_RECORD") {
        if (
          policy === undefined ||
          policySource === undefined ||
          spec.fieldConcept === undefined
        ) {
          throw new Error("field-record answers require a bound policy source");
        }
        const record = policySource.field_records.find(
          (candidate) => candidate.field_concept === spec.fieldConcept,
        );
        if (record === undefined) {
          throw new Error("field-record answer source record is missing");
        }
        answer = {
          text: record.disclosure_text,
          evidence_refs: [policySource.id],
          explicit_source: "FIELD_RECORD",
          source_field_record_id: record.field_record_id,
        };
      } else if (spec.answerText !== undefined) {
        answer = {
          text: spec.answerText,
          evidence_refs: (spec.answerEvidence ?? []).map((number) =>
            stableId("evidence", number),
          ),
        };
      }
      let constraintEvaluation:
        AnswerScenario["constraint_evaluation"] | undefined;
      if (constraint !== undefined && answer !== undefined) {
        constraintEvaluation = measureAnswerAgainstConstraint(
          constraint,
          answer.text,
        );
        if (spec.boundary !== undefined) {
          constraintEvaluation.boundary = spec.boundary;
        }
      }
      const releasable =
        (spec.outcome === "SUPPORTED_NARRATIVE_ANSWER" ||
          spec.outcome === "EXPLICIT_RECORD_ANSWER") &&
        (constraintEvaluation === undefined || constraintEvaluation.compliant);
      const expectedAction: AnswerScenario["expected_action"] =
        spec.outcome === "SUPPORTED_NARRATIVE_ANSWER" ||
        spec.outcome === "EXPLICIT_RECORD_ANSWER"
          ? "USE_SUPPORTED_EVIDENCE"
          : spec.outcome === "CONFIRMATION_REQUIRED"
            ? "REQUIRE_CONFIRMATION"
            : spec.outcome === "VOLUNTARY_DECLINE"
              ? "ABSTAIN"
              : spec.outcome === "BLOCKED_BY_POLICY"
                ? "BLOCK_AND_EXPLAIN"
                : spec.outcome === "STALE_CONTEXT"
                  ? spec.staleReason === "AUTHORIZATION_CONTEXT_CHANGED"
                    ? "BLOCK_AND_EXPLAIN"
                    : spec.staleReason === "EXPIRED_SOURCE_RECORD"
                      ? "REQUIRE_CONFIRMATION"
                      : "ABSTAIN"
                  : spec.insufficiencyReason === "EVIDENCE_CONTRADICTS_REQUEST"
                    ? "BLOCK_AND_EXPLAIN"
                    : spec.insufficiencyReason ===
                        "EVIDENCE_STALE_AT_EVALUATION"
                      ? "REQUIRE_CONFIRMATION"
                      : "ABSTAIN";
      if (
        decision !== undefined &&
        (spec.outcome === "EXPLICIT_RECORD_ANSWER" ||
          spec.outcome === "CONFIRMATION_REQUIRED" ||
          spec.outcome === "VOLUNTARY_DECLINE" ||
          spec.outcome === "BLOCKED_BY_POLICY") &&
        decision.action !== expectedAction
      ) {
        throw new Error(
          `answer seed policy decision drifted from its reviewed design at scenario ${String(index + 1)}`,
        );
      }
      const scenario: AnswerScenario = {
        id: stableId("ansscenario", index + 1),
        entity_type: "ANSWER_SCENARIO",
        schema_ref: SCHEMA_REFS.ANSWER_SCENARIO,
        schema_version: FIXTURE_SCHEMA_VERSION,
        metadata: w02Metadata(),
        question_ref: stableId("question", questionNumber),
        profile_ref: profile.id,
        job_ref: job.id,
        evaluation_date: evaluationDate,
        context: {
          company: job.employer,
          role: job.title,
          location: job.location,
          jurisdiction: spec.jurisdiction ?? "US_FIXTURE",
        },
        expected_outcome: spec.outcome,
        expected_action: expectedAction,
        release_eligible: releasable,
        rationale: spec.rationale,
      };
      if (constraint !== undefined) {
        scenario.constraint_ref = constraint.id;
      }
      if (constraintEvaluation !== undefined) {
        scenario.constraint_evaluation = constraintEvaluation;
      }
      if (policy !== undefined) {
        scenario.field_policy_ref = policy.id;
        scenario.policy_basis = "FIELD_VALUE_POLICY";
      } else if (spec.defaultPolicy !== undefined) {
        scenario.policy_basis = "CONCEPT_DEFAULT";
        scenario.default_policy = spec.defaultPolicy;
      }
      if (answer !== undefined) {
        scenario.answer = answer;
      }
      if (spec.reusedScenario !== undefined) {
        scenario.reused_answer_scenario_ref = stableId(
          "ansscenario",
          spec.reusedScenario,
        );
      }
      if (spec.staleReason !== undefined) {
        scenario.stale_reason = spec.staleReason;
      }
      if (spec.insufficiencyReason !== undefined) {
        scenario.insufficiency_reason = spec.insufficiencyReason;
      }
      if (spec.contextEvidence !== undefined) {
        scenario.context_refs = spec.contextEvidence.map((number) =>
          stableId("evidence", number),
        );
      }
      return scenario;
    },
  );
  return { questionCases, answerConstraints, answerScenarios };
}
