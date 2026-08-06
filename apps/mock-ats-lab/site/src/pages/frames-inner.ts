// Frame-local questionnaire document (case MAL-FRM-001, inner frame).
// Owns its own controls, validation, and stable frame-local identity.
import { el, mustGet, setText } from "../lab/dom.ts";

const app = mustGet("app");
document.body.setAttribute("data-frame-id", "inner-application-frame");

const reference = el("input", {
  attributes: {
    autocomplete: "off",
    id: "frame-reference",
    required: "",
    type: "text",
  },
});
const consent = el("input", {
  attributes: { id: "frame-consent", type: "checkbox" },
});
const status = el("output", {
  attributes: { class: "status", id: "frame-status", role: "status" },
});
const error = el("p", {
  attributes: { class: "error", id: "frame-reference-error", role: "status" },
});

const save = el("button", {
  attributes: { type: "submit" },
  text: "Save section",
});

const form = el("form", {
  attributes: { id: "frame-form", novalidate: "" },
  children: [
    el("h1", { text: "Embedded questionnaire (frame-local)" }),
    el("div", {
      attributes: { class: "field" },
      children: [
        el("label", {
          attributes: { for: "frame-reference" },
          text: "Synthetic reference number (required)",
        }),
        reference,
        error,
      ],
    }),
    el("div", {
      attributes: { class: "field" },
      children: [
        consent,
        el("label", {
          attributes: { for: "frame-consent" },
          text: "I confirm this synthetic section (optional)",
        }),
      ],
    }),
    el("div", { attributes: { class: "nav-actions" }, children: [save] }),
    status,
  ],
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  status.removeAttribute("data-tone");
  if (reference.value.trim() === "") {
    setText(error, "Reference number is required inside this frame.");
    status.setAttribute("data-tone", "error");
    setText(status, "FRAME_VALIDATION_FAILED");
    return;
  }
  setText(error, "");
  status.setAttribute("data-tone", "ok");
  setText(status, "FRAME_SECTION_SAVED");
});

app.append(form);
