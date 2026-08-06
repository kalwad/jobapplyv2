// Accessible custom selection controls (cases MAL-CBX-001 and MAL-CBX-002):
// an editable filtering ARIA combobox with an empty/no-match state and
// required-commit validation, and a standalone single-select ARIA listbox.
// Full keyboard interaction; exact option identity via stable option IDs.
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet, setText } from "../lab/dom.ts";

mountLabNotice();

const app = mustGet("app");

const LOCATIONS: readonly string[] = [
  "Aurora Yard (synthetic)",
  "Basalt Court (synthetic)",
  "Cedar Landing (synthetic)",
  "Dune Terrace (synthetic)",
  "Ember Quay (synthetic)",
  "Fable Crossing (synthetic)",
  "Granite Walk (synthetic)",
  "Harbor Point (synthetic)",
  "Iris Hollow (synthetic)",
  "Juniper Gate (synthetic)",
  "Kestrel Row (synthetic)",
  "Larkspur Plaza (synthetic)",
];

const locationSlug = (location: string): string =>
  location
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

// ---------------------------------------------------------------- combobox
let committedLocation = "";
let activeIndex = -1;
let visible: readonly string[] = LOCATIONS;

const comboInput = el("input", {
  attributes: {
    "aria-autocomplete": "list",
    "aria-controls": "cbx-listbox",
    "aria-expanded": "false",
    autocomplete: "off",
    id: "cbx-input",
    role: "combobox",
    type: "text",
  },
});
const comboList = el("div", {
  attributes: {
    class: "listbox",
    hidden: "",
    id: "cbx-listbox",
    role: "listbox",
    "aria-label": "Matching office locations",
  },
});
const comboEmpty = el("p", {
  attributes: { class: "help", hidden: "", id: "cbx-empty", role: "status" },
  text: "No matching locations.",
});
const comboCommitted = el("output", { attributes: { id: "cbx-committed" } });
const comboError = el("p", {
  attributes: { class: "error", id: "cbx-error", role: "status" },
});

function renderComboOptions(): void {
  comboList.replaceChildren(
    ...visible.map((location, index) =>
      el("div", {
        attributes: {
          "aria-selected": location === committedLocation ? "true" : "false",
          class: index === activeIndex ? "active" : "",
          "data-value": location,
          id: `cbx-opt-${locationSlug(location)}`,
          role: "option",
        },
        text: location,
      }),
    ),
  );
  const active = visible[activeIndex];
  if (active === undefined) {
    comboInput.removeAttribute("aria-activedescendant");
  } else {
    comboInput.setAttribute(
      "aria-activedescendant",
      `cbx-opt-${locationSlug(active)}`,
    );
  }
}

function openCombo(): void {
  comboList.removeAttribute("hidden");
  comboInput.setAttribute("aria-expanded", "true");
  if (visible.length === 0) {
    comboEmpty.removeAttribute("hidden");
  } else {
    comboEmpty.setAttribute("hidden", "");
  }
}

function closeCombo(): void {
  comboList.setAttribute("hidden", "");
  comboEmpty.setAttribute("hidden", "");
  comboInput.setAttribute("aria-expanded", "false");
  activeIndex = -1;
  renderComboOptions();
}

function filterCombo(): void {
  const query = comboInput.value.trim().toLowerCase();
  visible = LOCATIONS.filter((location) =>
    location.toLowerCase().includes(query),
  );
  activeIndex = visible.length > 0 ? 0 : -1;
  renderComboOptions();
  openCombo();
}

function commitLocation(location: string): void {
  committedLocation = location;
  comboInput.value = location;
  setText(comboCommitted, location);
  setText(comboError, "");
  closeCombo();
}

comboInput.addEventListener("input", filterCombo);
comboInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (comboList.hasAttribute("hidden")) {
      filterCombo();
      return;
    }
    activeIndex =
      visible.length === 0 ? -1 : (activeIndex + 1) % visible.length;
    renderComboOptions();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex =
      visible.length === 0
        ? -1
        : (activeIndex - 1 + visible.length) % visible.length;
    renderComboOptions();
  } else if (event.key === "Enter") {
    event.preventDefault();
    const active = visible[activeIndex];
    if (active !== undefined) {
      commitLocation(active);
    }
  } else if (event.key === "Escape") {
    closeCombo();
  }
});
comboList.addEventListener("click", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.getAttribute("role") === "option"
  ) {
    commitLocation(target.getAttribute("data-value") ?? "");
  }
});

const comboCheck = el("button", {
  attributes: { id: "cbx-check", type: "button" },
  text: "Check location selection",
});
comboCheck.addEventListener("click", () => {
  if (committedLocation === "") {
    setText(comboError, "Select an office location from the list.");
  } else {
    setText(comboError, "");
  }
});

// ---------------------------------------------------------------- listbox
const CHANNELS: readonly string[] = [
  "Email (synthetic)",
  "Phone call (synthetic)",
  "Text message (synthetic)",
  "Postal mail (synthetic)",
];
let channelActive = 0;
let channelSelected = "";

const channelList = el("div", {
  attributes: {
    "aria-label": "Preferred contact channel",
    class: "listbox",
    id: "lbx-channel",
    role: "listbox",
    tabindex: "0",
  },
});
const channelCommitted = el("output", { attributes: { id: "lbx-committed" } });

function channelSlug(channel: string): string {
  return locationSlug(channel);
}

function renderChannels(): void {
  channelList.replaceChildren(
    ...CHANNELS.map((channel, index) =>
      el("div", {
        attributes: {
          "aria-selected": channel === channelSelected ? "true" : "false",
          class: index === channelActive ? "active" : "",
          "data-value": channel,
          id: `lbx-opt-${channelSlug(channel)}`,
          role: "option",
        },
        text: channel,
      }),
    ),
  );
  const active = CHANNELS[channelActive];
  if (active !== undefined) {
    channelList.setAttribute(
      "aria-activedescendant",
      `lbx-opt-${channelSlug(active)}`,
    );
  }
}

channelList.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    channelActive = (channelActive + 1) % CHANNELS.length;
    renderChannels();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    channelActive = (channelActive - 1 + CHANNELS.length) % CHANNELS.length;
    renderChannels();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const active = CHANNELS[channelActive];
    if (active !== undefined) {
      channelSelected = active;
      setText(channelCommitted, active);
      renderChannels();
    }
  }
});
channelList.addEventListener("click", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.getAttribute("role") === "option"
  ) {
    const value = target.getAttribute("data-value") ?? "";
    channelSelected = value;
    channelActive = CHANNELS.indexOf(value);
    setText(channelCommitted, value);
    renderChannels();
  }
});

renderComboOptions();
renderChannels();

app.append(
  el("h1", { text: "Custom selection controls" }),
  el("h2", { text: "Office location (ARIA combobox, required)" }),
  el("div", {
    attributes: { class: "field" },
    children: [
      el("label", {
        attributes: { for: "cbx-input" },
        text: "Office location",
      }),
      el("div", {
        attributes: { class: "combobox-popup" },
        children: [comboInput, comboList],
      }),
      comboEmpty,
      comboError,
      el("p", { children: ["Committed location: ", comboCommitted] }),
      el("div", {
        attributes: { class: "nav-actions" },
        children: [comboCheck],
      }),
    ],
  }),
  el("h2", { text: "Preferred contact channel (ARIA listbox)" }),
  el("div", {
    attributes: { class: "field" },
    children: [
      channelList,
      el("p", { children: ["Committed channel: ", channelCommitted] }),
    ],
  }),
);
