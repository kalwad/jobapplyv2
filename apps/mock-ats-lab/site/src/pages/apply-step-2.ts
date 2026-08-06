// Multipage flow, step 2 of 3 (case MAL-FLW-001): role details with
// validation-gated Next and a Back action that preserves edits.
import { mountLabNotice } from "../lab/banner.ts";
import { el, fieldRow, mustGet, setText } from "../lab/dom.ts";
import { applyBack, applyNext, type FieldError } from "../lab/flow-state.ts";
import { loadFlowState, saveFlowState } from "../lab/storage.ts";

mountLabNotice();

const app = mustGet("app");
const state = loadFlowState();

const position = el("select", {
  attributes: { id: "flow-position", required: "" },
  children: [
    el("option", { attributes: { value: "" }, text: "Select a position" }),
    el("option", {
      attributes: { value: "fixture-engineer" },
      text: "Fixture engineer (synthetic)",
    }),
    el("option", {
      attributes: { value: "workflow-analyst" },
      text: "Workflow analyst (synthetic)",
    }),
    el("option", {
      attributes: { value: "quality-steward" },
      text: "Quality steward (synthetic)",
    }),
  ],
});
position.value = state.fields.position;
const years = el("input", {
  attributes: {
    autocomplete: "off",
    id: "flow-years",
    inputmode: "numeric",
    required: "",
    type: "text",
  },
});
years.value = state.fields.yearsExperience;
const coverNote = el("textarea", {
  attributes: { id: "flow-cover-note", rows: "4" },
});
coverNote.value = state.fields.coverNote;

const ERROR_TARGETS: Readonly<Record<string, string>> = {
  position: "flow-position-error",
  yearsExperience: "flow-years-error",
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

function currentPatch(): {
  position: string;
  yearsExperience: string;
  coverNote: string;
} {
  return {
    position: position.value,
    yearsExperience: years.value,
    coverNote: coverNote.value,
  };
}

const status = el("output", {
  attributes: { class: "status", id: "flow-step2-status", role: "status" },
});
const backButton = el("button", {
  attributes: { class: "secondary", id: "flow-back", type: "button" },
  text: "Back",
});
backButton.addEventListener("click", () => {
  saveFlowState(applyBack(state, "step-2", currentPatch()));
  window.location.assign("/apply/step-1/");
});
const nextButton = el("button", {
  attributes: { id: "flow-next", type: "submit" },
  text: "Next",
});

const form = el("form", {
  attributes: { id: "flow-step2-form", novalidate: "" },
  children: [
    fieldRow({
      control: position,
      controlId: "flow-position",
      errorId: "flow-position-error",
      label: "Position (required)",
    }),
    fieldRow({
      control: years,
      controlId: "flow-years",
      errorId: "flow-years-error",
      help: "Whole number of years, 0–60.",
      label: "Years of relevant experience (required)",
    }),
    fieldRow({
      control: coverNote,
      controlId: "flow-cover-note",
      errorId: "flow-cover-note-error",
      help: "Optional synthetic note.",
      label: "Cover note (optional)",
    }),
    el("div", {
      attributes: { class: "nav-actions" },
      children: [backButton, nextButton],
    }),
    status,
  ],
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const outcome = applyNext(state, "step-2", currentPatch());
  saveFlowState(outcome.state);
  renderErrors(outcome.errors);
  if (outcome.errors.length > 0) {
    status.setAttribute("data-tone", "error");
    setText(status, "NAVIGATION_BLOCKED_BY_VALIDATION");
    return;
  }
  window.location.assign("/apply/step-3/");
});

app.append(el("h1", { text: "Apply — step 2 of 3" }), form);
