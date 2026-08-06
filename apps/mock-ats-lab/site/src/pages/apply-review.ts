// Multipage flow review (cases MAL-FLW-004, MAL-FLW-005, MAL-FLW-006):
// read-only confirmation of every persisted answer, a local-only mock
// submission with a fixed-delay receipt, and a duplicate warning when the
// same synthetic application is submitted twice.
import { mountLabNotice } from "../lab/banner.ts";
import { RECEIPT_DELAY_MS } from "../lab/constants.ts";
import { el, mustGet, setText } from "../lab/dom.ts";
import { validateStage, type FlowStage } from "../lab/flow-state.ts";
import { applicationKeyFor, recordSubmission } from "../lab/receipts.ts";
import {
  loadFlowState,
  loadReceiptState,
  resetLabSession,
  saveFlowState,
  saveReceiptState,
} from "../lab/storage.ts";

mountLabNotice();

const app = mustGet("app");
const state = loadFlowState();

const REVIEW_ROWS: readonly { label: string; value: string }[] = [
  { label: "Full name", value: state.fields.fullName },
  { label: "Email address", value: state.fields.email },
  { label: "Phone", value: state.fields.phone },
  { label: "Position", value: state.fields.position },
  { label: "Years of experience", value: state.fields.yearsExperience },
  { label: "Cover note", value: state.fields.coverNote },
  { label: "Work authorization", value: state.fields.workAuthorization },
  { label: "Relocation", value: state.fields.relocation },
  {
    label: "Synthetic terms accepted",
    value: state.fields.termsAccepted ? "yes" : "no",
  },
];

const incompleteStages = (["step-1", "step-2", "step-3"] as const).filter(
  (stage: FlowStage) => validateStage(stage, state.fields).length > 0,
);

const status = el("output", {
  attributes: { class: "status", id: "flow-review-status", role: "status" },
});
const duplicateWarning = el("div", {
  attributes: {
    class: "captcha-box",
    hidden: "",
    id: "flow-duplicate-warning",
    role: "alert",
  },
});

const submitButton = el("button", {
  attributes: { id: "flow-submit", type: "button" },
  text: "Submit application (mock — stays local)",
});
const backButton = el("button", {
  attributes: { class: "secondary", id: "flow-back", type: "button" },
  text: "Back to step 3",
});
const resetButton = el("button", {
  attributes: { class: "secondary", id: "flow-reset", type: "button" },
  text: "Reset lab state",
});

backButton.addEventListener("click", () => {
  saveFlowState({ ...state, stage: "step-3" });
  window.location.assign("/apply/step-3/");
});
resetButton.addEventListener("click", () => {
  resetLabSession();
  window.location.assign("/apply/step-1/");
});

submitButton.addEventListener("click", () => {
  if (incompleteStages.length > 0) {
    status.setAttribute("data-tone", "error");
    setText(status, "FLOW_INCOMPLETE: finish every step before submitting.");
    return;
  }
  submitButton.setAttribute("disabled", "");
  status.setAttribute("data-tone", "warn");
  setText(status, "PROCESSING_LOCAL_SUBMISSION");
  window.setTimeout(() => {
    const receipts = loadReceiptState();
    const outcome = recordSubmission(receipts, applicationKeyFor(state.fields));
    if (outcome.kind === "DUPLICATE") {
      duplicateWarning.removeAttribute("hidden");
      duplicateWarning.replaceChildren(
        document.createTextNode(
          "DUPLICATE_APPLICATION: this synthetic application was already " +
            `submitted in this session as receipt ${outcome.receipt.id}. ` +
            "No second receipt was issued.",
        ),
      );
      status.setAttribute("data-tone", "warn");
      setText(status, "DUPLICATE_DETECTED");
      submitButton.removeAttribute("disabled");
      return;
    }
    saveReceiptState(outcome.state);
    saveFlowState({ ...state, stage: "receipt" });
    window.location.assign("/apply/receipt/");
  }, RECEIPT_DELAY_MS);
});

app.append(
  el("h1", { text: "Apply — review your synthetic application" }),
  el("p", {
    attributes: { class: "muted" },
    text:
      "Nothing on this page submits anywhere real. The mock submission " +
      "stays inside this loopback fixture.",
  }),
  el("table", {
    attributes: { id: "flow-review-table" },
    children: [
      el("tbody", {
        children: REVIEW_ROWS.map((row) =>
          el("tr", {
            children: [
              el("th", { text: row.label }),
              el("td", { text: row.value }),
            ],
          }),
        ),
      }),
    ],
  }),
  el("div", {
    attributes: { class: "review-actions" },
    children: [backButton, submitButton, resetButton],
  }),
  duplicateWarning,
  status,
);

if (incompleteStages.length > 0) {
  status.setAttribute("data-tone", "error");
  setText(status, "FLOW_INCOMPLETE: finish every step before submitting.");
}
