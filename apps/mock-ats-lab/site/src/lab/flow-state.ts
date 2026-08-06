// Pure deterministic state machine for the multipage application flow
// (M02-W03, spec §8.2: multipage navigation, validation, CAPTCHA pause,
// confirmation, receipt, duplicate warning). No DOM, no time, no
// randomness: pages own rendering and persistence, this module owns truth.

export type FlowStage =
  "step-1" | "step-2" | "step-3" | "captcha" | "review" | "receipt";

export interface FlowFields {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly position: string;
  readonly yearsExperience: string;
  readonly coverNote: string;
  readonly workAuthorization: string;
  readonly relocation: string;
  readonly termsAccepted: boolean;
}

export interface FlowState {
  readonly version: 1;
  readonly stage: FlowStage;
  readonly fields: FlowFields;
  readonly captchaResolved: boolean;
}

export interface FieldError {
  readonly field: keyof FlowFields;
  readonly message: string;
}

export interface TransitionResult {
  readonly state: FlowState;
  readonly errors: readonly FieldError[];
}

export const INITIAL_FLOW_FIELDS: FlowFields = {
  fullName: "",
  email: "",
  phone: "",
  position: "",
  yearsExperience: "",
  coverNote: "",
  workAuthorization: "",
  relocation: "",
  termsAccepted: false,
};

export function initialFlowState(): FlowState {
  return {
    version: 1,
    stage: "step-1",
    fields: INITIAL_FLOW_FIELDS,
    captchaResolved: false,
  };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPTIONAL_PHONE_SHAPE = /^[0-9+\-() ]{7,20}$/;

/** Deterministic per-step validation used before any forward navigation. */
export function validateStage(
  stage: FlowStage,
  fields: FlowFields,
): readonly FieldError[] {
  const errors: FieldError[] = [];
  if (stage === "step-1") {
    if (fields.fullName.trim() === "") {
      errors.push({ field: "fullName", message: "Full name is required." });
    }
    if (fields.email.trim() === "") {
      errors.push({ field: "email", message: "Email address is required." });
    } else if (!EMAIL_SHAPE.test(fields.email.trim())) {
      errors.push({
        field: "email",
        message: "Enter an email address such as name@example.test.",
      });
    }
    if (
      fields.phone.trim() !== "" &&
      !OPTIONAL_PHONE_SHAPE.test(fields.phone.trim())
    ) {
      errors.push({
        field: "phone",
        message: "Phone may use digits, spaces, parentheses, + and - only.",
      });
    }
  }
  if (stage === "step-2") {
    if (fields.position === "") {
      errors.push({ field: "position", message: "Select a position." });
    }
    const years = fields.yearsExperience.trim();
    if (years === "") {
      errors.push({
        field: "yearsExperience",
        message: "Years of experience is required.",
      });
    } else if (!/^\d{1,2}$/.test(years) || Number(years) > 60) {
      errors.push({
        field: "yearsExperience",
        message: "Enter a whole number of years between 0 and 60.",
      });
    }
  }
  if (stage === "step-3") {
    if (fields.workAuthorization === "") {
      errors.push({
        field: "workAuthorization",
        message: "Select one authorization answer.",
      });
    }
    if (!fields.termsAccepted) {
      errors.push({
        field: "termsAccepted",
        message: "You must accept the synthetic terms to continue.",
      });
    }
  }
  return errors;
}

function forwardStage(state: FlowState): FlowStage {
  switch (state.stage) {
    case "step-1":
      return "step-2";
    case "step-2":
      return "step-3";
    case "step-3":
      return state.captchaResolved ? "review" : "captcha";
    case "captcha":
      return "review";
    case "review":
      return "receipt";
    case "receipt":
      return "receipt";
  }
}

/** Merge field edits, validate, and advance one stage on success. */
export function applyNext(
  state: FlowState,
  stage: FlowStage,
  patch: Partial<FlowFields>,
): TransitionResult {
  const fields: FlowFields = { ...state.fields, ...patch };
  const errors = validateStage(stage, fields);
  if (errors.length > 0) {
    return { state: { ...state, fields, stage }, errors };
  }
  return {
    state: { ...state, fields, stage: forwardStage({ ...state, stage }) },
    errors: [],
  };
}

/** Persist field edits and move one stage backwards (never validates). */
export function applyBack(
  state: FlowState,
  stage: FlowStage,
  patch: Partial<FlowFields>,
): FlowState {
  const fields: FlowFields = { ...state.fields, ...patch };
  const previous: FlowStage =
    stage === "step-3" ? "step-2" : stage === "step-2" ? "step-1" : "step-1";
  return { ...state, fields, stage: previous };
}

/** Explicit local test-only CAPTCHA resolution (spec §8.2 pause fixture). */
export function resolveCaptcha(state: FlowState): FlowState {
  if (state.stage !== "captcha") {
    return state;
  }
  return { ...state, captchaResolved: true, stage: "review" };
}

/** Deterministic reset used by the lab's reset action and by tests. */
export function resetFlow(): FlowState {
  return initialFlowState();
}
