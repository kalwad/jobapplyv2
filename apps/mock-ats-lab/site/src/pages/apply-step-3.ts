// Multipage flow, step 3 of 3 (cases MAL-FLW-001 and MAL-FLW-003):
// consequential authorization answer, synthetic terms, and the CAPTCHA
// placeholder pause. The pause cannot be solved automatically: progression
// stays blocked until the clearly labeled test-only manual action runs.
import { mountLabNotice } from "../lab/banner.ts";
import { el, fieldRow, mustGet, setText } from "../lab/dom.ts";
import {
  applyBack,
  applyNext,
  resolveCaptcha,
  type FieldError,
  type FlowState,
} from "../lab/flow-state.ts";
import { loadFlowState, saveFlowState } from "../lab/storage.ts";

mountLabNotice();

const app = mustGet("app");
let state: FlowState = loadFlowState();

const authYes = el("input", {
  attributes: {
    id: "flow-auth-yes",
    name: "flowWorkAuthorization",
    type: "radio",
    value: "yes",
  },
});
const authNo = el("input", {
  attributes: {
    id: "flow-auth-no",
    name: "flowWorkAuthorization",
    type: "radio",
    value: "no",
  },
});
if (state.fields.workAuthorization === "yes") {
  authYes.setAttribute("checked", "");
}
if (state.fields.workAuthorization === "no") {
  authNo.setAttribute("checked", "");
}
const relocation = el("select", {
  attributes: { id: "flow-relocation" },
  children: [
    el("option", { attributes: { value: "" }, text: "Prefer not to answer" }),
    el("option", {
      attributes: { value: "yes" },
      text: "Yes, synthetic relocation works",
    }),
    el("option", {
      attributes: { value: "no" },
      text: "No synthetic relocation",
    }),
  ],
});
relocation.value = state.fields.relocation;
const terms = el("input", {
  attributes: { id: "flow-terms", type: "checkbox" },
});
terms.checked = state.fields.termsAccepted;

const authError = el("p", {
  attributes: { class: "error", id: "flow-auth-error", role: "status" },
});
const termsError = el("p", {
  attributes: { class: "error", id: "flow-terms-error", role: "status" },
});
const status = el("output", {
  attributes: { class: "status", id: "flow-step3-status", role: "status" },
});

const captchaResolve = el("button", {
  attributes: { id: "flow-captcha-resolve", type: "button" },
  text: "Resolve challenge (test-only manual action)",
});
const captchaBox = el("div", {
  attributes: { class: "captcha-box", hidden: "", id: "flow-captcha" },
  children: [
    el("h2", { text: "Verification required" }),
    el("p", {
      attributes: { id: "flow-captcha-reason" },
      text:
        "PAUSED_FOR_CAPTCHA: this synthetic checkpoint stands in for a real " +
        "CAPTCHA. It cannot and must not be solved automatically; a person " +
        "must resolve it before the review page unlocks.",
    }),
    captchaResolve,
  ],
});

function currentPatch(): {
  workAuthorization: string;
  relocation: string;
  termsAccepted: boolean;
} {
  return {
    workAuthorization: authYes.checked ? "yes" : authNo.checked ? "no" : "",
    relocation: relocation.value,
    termsAccepted: terms.checked,
  };
}

function renderErrors(errors: readonly FieldError[]): void {
  setText(authError, "");
  setText(termsError, "");
  for (const problem of errors) {
    if (problem.field === "workAuthorization") {
      setText(authError, problem.message);
    }
    if (problem.field === "termsAccepted") {
      setText(termsError, problem.message);
    }
  }
}

const backButton = el("button", {
  attributes: { class: "secondary", id: "flow-back", type: "button" },
  text: "Back",
});
backButton.addEventListener("click", () => {
  saveFlowState(applyBack(state, "step-3", currentPatch()));
  window.location.assign("/apply/step-2/");
});
const nextButton = el("button", {
  attributes: { id: "flow-next", type: "submit" },
  text: "Next",
});

function showCaptchaPause(): void {
  captchaBox.removeAttribute("hidden");
  nextButton.setAttribute("disabled", "");
  status.setAttribute("data-tone", "warn");
  setText(status, "PAUSED_FOR_CAPTCHA");
}

const form = el("form", {
  attributes: { id: "flow-step3-form", novalidate: "" },
  children: [
    el("fieldset", {
      children: [
        el("legend", {
          text: "Are you authorized to work for this synthetic posting? (required)",
        }),
        el("div", {
          children: [
            authYes,
            el("label", { attributes: { for: "flow-auth-yes" }, text: "Yes" }),
          ],
        }),
        el("div", {
          children: [
            authNo,
            el("label", { attributes: { for: "flow-auth-no" }, text: "No" }),
          ],
        }),
        authError,
      ],
    }),
    fieldRow({
      control: relocation,
      controlId: "flow-relocation",
      errorId: "flow-relocation-error",
      help: "Voluntary synthetic question; answering is optional.",
      label: "Open to synthetic relocation? (optional)",
    }),
    el("div", {
      attributes: { class: "field" },
      children: [
        terms,
        el("label", {
          attributes: { for: "flow-terms" },
          text: "I accept the synthetic fixture terms (required)",
        }),
        termsError,
      ],
    }),
    el("div", {
      attributes: { class: "nav-actions" },
      children: [backButton, nextButton],
    }),
    captchaBox,
    status,
  ],
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const outcome = applyNext(state, "step-3", currentPatch());
  state = outcome.state;
  saveFlowState(state);
  renderErrors(outcome.errors);
  if (outcome.errors.length > 0) {
    status.setAttribute("data-tone", "error");
    setText(status, "NAVIGATION_BLOCKED_BY_VALIDATION");
    return;
  }
  if (state.stage === "captcha") {
    showCaptchaPause();
    return;
  }
  window.location.assign("/apply/review/");
});

captchaResolve.addEventListener("click", () => {
  state = resolveCaptcha(state);
  saveFlowState(state);
  window.location.assign("/apply/review/");
});

app.append(el("h1", { text: "Apply — step 3 of 3" }), form);

if (state.stage === "captcha") {
  showCaptchaPause();
}
