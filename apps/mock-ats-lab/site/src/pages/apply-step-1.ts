// Multipage flow, step 1 of 3 (cases MAL-FLW-001, MAL-FLW-002,
// MAL-FLW-008): applicant identity with validation-gated Next and the
// inert instruction-like synthetic job description.
import { mountLabNotice } from "../lab/banner.ts";
import {
  INJECTION_JOB_DESCRIPTION_TEXT,
  SYNTHETIC_EMPLOYER,
} from "../lab/constants.ts";
import { el, fieldRow, mustGet, setText } from "../lab/dom.ts";
import { applyNext, type FieldError } from "../lab/flow-state.ts";
import { loadFlowState, saveFlowState } from "../lab/storage.ts";

mountLabNotice();

const app = mustGet("app");
const state = loadFlowState();

const fullName = el("input", {
  attributes: {
    autocomplete: "off",
    id: "flow-full-name",
    required: "",
    type: "text",
  },
});
fullName.value = state.fields.fullName;
const email = el("input", {
  attributes: {
    autocomplete: "off",
    id: "flow-email",
    required: "",
    type: "text",
  },
});
email.value = state.fields.email;
const phone = el("input", {
  attributes: { autocomplete: "off", id: "flow-phone", type: "text" },
});
phone.value = state.fields.phone;

const ERROR_TARGETS: Readonly<Record<string, string>> = {
  fullName: "flow-full-name-error",
  email: "flow-email-error",
  phone: "flow-phone-error",
};

function renderErrors(errors: readonly FieldError[]): void {
  for (const id of Object.values(ERROR_TARGETS)) {
    setText(mustGet(id), "");
  }
  for (const problem of errors) {
    const target = ERROR_TARGETS[problem.field];
    if (target !== undefined) {
      setText(mustGet(target), problem.message);
    }
  }
}

const status = el("output", {
  attributes: { class: "status", id: "flow-step1-status", role: "status" },
});

const nextButton = el("button", {
  attributes: { id: "flow-next", type: "submit" },
  text: "Next",
});

const form = el("form", {
  attributes: { id: "flow-step1-form", novalidate: "" },
  children: [
    fieldRow({
      control: fullName,
      controlId: "flow-full-name",
      errorId: "flow-full-name-error",
      label: "Full name (required)",
    }),
    fieldRow({
      control: email,
      controlId: "flow-email",
      errorId: "flow-email-error",
      help: "Use a reserved synthetic address such as avery.applicant@example.test.",
      label: "Email address (required)",
    }),
    fieldRow({
      control: phone,
      controlId: "flow-phone",
      errorId: "flow-phone-error",
      help: "Optional synthetic 555-01xx number.",
      label: "Phone (optional)",
    }),
    el("div", { attributes: { class: "nav-actions" }, children: [nextButton] }),
    status,
  ],
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const outcome = applyNext(state, "step-1", {
    fullName: fullName.value,
    email: email.value,
    phone: phone.value,
  });
  saveFlowState(outcome.state);
  renderErrors(outcome.errors);
  if (outcome.errors.length > 0) {
    status.setAttribute("data-tone", "error");
    setText(status, "NAVIGATION_BLOCKED_BY_VALIDATION");
    return;
  }
  window.location.assign("/apply/step-2/");
});

app.append(
  el("h1", { text: `Apply — step 1 of 3 (${SYNTHETIC_EMPLOYER})` }),
  el("section", {
    attributes: { id: "flow-job-description" },
    children: [
      el("h2", { text: "Synthetic job description" }),
      el("p", { text: INJECTION_JOB_DESCRIPTION_TEXT }),
    ],
  }),
  el("h2", { text: "Applicant details" }),
  form,
);
