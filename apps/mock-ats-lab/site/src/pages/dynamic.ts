// Dynamic insertion/removal fixtures (cases MAL-DYN-001 … MAL-DYN-003):
// conditional fields with dependent required state, a fixed-delay
// deterministic insertion, and a node-replacement control beside a stable
// one. A visible status output narrates every deterministic transition.
import { mountLabNotice } from "../lab/banner.ts";
import { DELAYED_INSERTION_MS } from "../lab/constants.ts";
import { el, fieldRow, mustGet, setText } from "../lab/dom.ts";

mountLabNotice();

const app = mustGet("app");
const status = el("output", {
  attributes: { class: "status", id: "dynamic-status", role: "status" },
  text: "READY",
});

// --- MAL-DYN-001: conditional insertion/removal + dependent required -----
const referralToggle = el("input", {
  attributes: { id: "dyn-referral-toggle", type: "checkbox" },
});
const referralSlot = el("div", { attributes: { id: "dyn-referral-slot" } });

referralToggle.addEventListener("change", () => {
  if (referralToggle.checked) {
    const control = el("input", {
      attributes: {
        autocomplete: "off",
        id: "dyn-referral-code",
        name: "referralCode",
        required: "",
        type: "text",
      },
    });
    referralSlot.append(
      fieldRow({
        control,
        controlId: "dyn-referral-code",
        errorId: "dyn-referral-code-error",
        help: "Required while the referral checkbox is checked.",
        label: "Referral code (required)",
      }),
    );
    setText(status, "REFERRAL_FIELD_INSERTED");
  } else {
    referralSlot.replaceChildren();
    setText(status, "REFERRAL_FIELD_REMOVED");
  }
});

const country = el("select", {
  attributes: { id: "dyn-country", name: "country" },
  children: [
    el("option", { attributes: { value: "" }, text: "Select a country" }),
    el("option", {
      attributes: { value: "examplia" },
      text: "Examplia (synthetic)",
    }),
    el("option", {
      attributes: { value: "testland" },
      text: "Testland (synthetic)",
    }),
  ],
});
const region = el("input", {
  attributes: {
    autocomplete: "off",
    id: "dyn-region",
    name: "region",
    type: "text",
  },
});
country.addEventListener("change", () => {
  if (country.value === "examplia") {
    region.setAttribute("required", "");
    setText(status, "REGION_NOW_REQUIRED");
  } else {
    region.removeAttribute("required");
    setText(status, "REGION_NOW_OPTIONAL");
  }
});

// --- MAL-DYN-002: fixed-delay deterministic insertion --------------------
const loadButton = el("button", {
  attributes: { id: "dyn-load-questions", type: "button" },
  text: "Load additional questions",
});
const delayedSlot = el("div", { attributes: { id: "dyn-delayed-slot" } });
loadButton.addEventListener("click", () => {
  loadButton.setAttribute("disabled", "");
  setText(status, "ADDITIONAL_QUESTIONS_LOADING");
  window.setTimeout(() => {
    delayedSlot.append(
      fieldRow({
        control: el("input", {
          attributes: {
            autocomplete: "off",
            id: "dyn-clearance",
            name: "clearance",
            type: "text",
          },
        }),
        controlId: "dyn-clearance",
        errorId: "dyn-clearance-error",
        label: "Synthetic clearance reference (optional)",
      }),
      fieldRow({
        control: el("input", {
          attributes: {
            autocomplete: "off",
            id: "dyn-portfolio",
            name: "portfolio",
            type: "text",
          },
        }),
        controlId: "dyn-portfolio",
        errorId: "dyn-portfolio-error",
        label: "Portfolio reference (optional)",
      }),
    );
    setText(status, "ADDITIONAL_QUESTIONS_LOADED");
  }, DELAYED_INSERTION_MS);
});

// --- MAL-DYN-003: node replacement beside a stable control ---------------
const stableInput = el("input", {
  attributes: {
    autocomplete: "off",
    id: "dyn-stable",
    name: "stableField",
    type: "text",
  },
});
const replaceableSlot = el("div", { attributes: { id: "dyn-replace-slot" } });
let replaceGeneration = 1;

function mountReplaceable(): void {
  const control = el("input", {
    attributes: {
      autocomplete: "off",
      "data-node-generation": String(replaceGeneration),
      id: "dyn-replaceable",
      name: "replaceableField",
      type: "text",
    },
  });
  replaceableSlot.replaceChildren(
    fieldRow({
      control,
      controlId: "dyn-replaceable",
      errorId: "dyn-replaceable-error",
      help: "The site replaces this control's DOM node on demand; its value does not carry over.",
      label: "Replaceable contact alias",
    }),
  );
}
mountReplaceable();

const replaceButton = el("button", {
  attributes: { class: "secondary", id: "dyn-replace-node", type: "button" },
  text: "Replace the contact alias control",
});
replaceButton.addEventListener("click", () => {
  replaceGeneration += 1;
  mountReplaceable();
  setText(status, `NODE_REPLACED_GENERATION_${String(replaceGeneration)}`);
});

app.append(
  el("h1", { text: "Dynamic questions — deterministic fixture" }),
  el("form", {
    attributes: { id: "dyn-form", novalidate: "" },
    children: [
      el("h2", { text: "Conditional questions" }),
      el("div", {
        attributes: { class: "field" },
        children: [
          referralToggle,
          el("label", {
            attributes: { for: "dyn-referral-toggle" },
            text: "I was referred by a current employee",
          }),
        ],
      }),
      referralSlot,
      fieldRow({
        control: country,
        controlId: "dyn-country",
        errorId: "dyn-country-error",
        label: "Country (drives dependent required state)",
      }),
      fieldRow({
        control: region,
        controlId: "dyn-region",
        errorId: "dyn-region-error",
        help: "Required only when the country is Examplia.",
        label: "Region",
      }),
      el("h2", { text: "Delayed questions" }),
      el("div", {
        attributes: { class: "nav-actions" },
        children: [loadButton],
      }),
      delayedSlot,
      el("h2", { text: "Node identity" }),
      fieldRow({
        control: stableInput,
        controlId: "dyn-stable",
        errorId: "dyn-stable-error",
        help: "This control keeps one DOM node for the lifetime of the page.",
        label: "Stable contact alias",
      }),
      replaceableSlot,
      el("div", {
        attributes: { class: "nav-actions" },
        children: [replaceButton],
      }),
    ],
  }),
  status,
);
