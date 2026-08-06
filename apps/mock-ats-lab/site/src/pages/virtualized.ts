// Genuine virtualized listbox (case MAL-VIR-001): 480 semantic options,
// but only the scrolled-into-view window (plus a fixed overscan) is ever
// mounted in the DOM. Scrolling re-windows the mounted subset, semantic
// option identity is stable (`vl-opt-<code>`), offscreen options are
// selectable through ordinary scrolling/keyboard interaction, and the
// committed selection survives an explicit rerender.
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet, setText } from "../lab/dom.ts";

mountLabNotice();

export const VIRTUAL_OPTION_COUNT = 480;
const ROW_HEIGHT = 32;
const OVERSCAN_ROWS = 4;

const cohortCode = (index: number): string =>
  `COHORT-${String(index + 1).padStart(4, "0")}`;

const app = mustGet("app");

let activeIndex = 0;
let selectedCode = "";
let renderPass = 1;

const viewport = el("div", {
  attributes: { class: "virtual-viewport", id: "vl-viewport" },
});
const spacerTop = el("div", { attributes: { id: "vl-spacer-top" } });
const window_ = el("div", {
  attributes: {
    "aria-label": "Assessment cohort",
    id: "vl-listbox",
    role: "listbox",
    tabindex: "0",
  },
});
const spacerBottom = el("div", { attributes: { id: "vl-spacer-bottom" } });
viewport.append(spacerTop, window_, spacerBottom);

const committed = el("output", { attributes: { id: "vl-committed" } });
const renderCount = el("output", {
  attributes: { id: "vl-render-count" },
  text: "1",
});
const mountedCount = el("output", { attributes: { id: "vl-mounted-count" } });

function windowBounds(): { start: number; end: number } {
  const first = Math.floor(viewport.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS;
  const visibleRows = Math.ceil(viewport.clientHeight / ROW_HEIGHT);
  const last = first + visibleRows + OVERSCAN_ROWS * 2;
  return {
    start: Math.max(0, first),
    end: Math.min(VIRTUAL_OPTION_COUNT, last + 1),
  };
}

let renderedStart = -1;
let renderedEnd = -1;

function renderWindow(force = true): void {
  const { start, end } = windowBounds();
  if (!force && start === renderedStart && end === renderedEnd) {
    return;
  }
  renderedStart = start;
  renderedEnd = end;
  spacerTop.style.height = `${String(start * ROW_HEIGHT)}px`;
  spacerBottom.style.height = `${String((VIRTUAL_OPTION_COUNT - end) * ROW_HEIGHT)}px`;
  const options: HTMLElement[] = [];
  for (let index = start; index < end; index += 1) {
    const code = cohortCode(index);
    const option = el("div", {
      attributes: {
        "aria-posinset": String(index + 1),
        "aria-selected": code === selectedCode ? "true" : "false",
        "aria-setsize": String(VIRTUAL_OPTION_COUNT),
        class: index === activeIndex ? "active" : "",
        "data-value": code,
        id: `vl-opt-${code}`,
        role: "option",
      },
      text: `Assessment cohort ${code}`,
    });
    option.style.height = `${String(ROW_HEIGHT)}px`;
    options.push(option);
  }
  window_.replaceChildren(...options);
  const active = cohortCode(activeIndex);
  window_.setAttribute("aria-activedescendant", `vl-opt-${active}`);
  setText(mountedCount, String(window_.childElementCount));
}

function scrollActiveIntoView(): void {
  const top = activeIndex * ROW_HEIGHT;
  const bottom = top + ROW_HEIGHT;
  if (top < viewport.scrollTop) {
    viewport.scrollTop = top;
  } else if (bottom > viewport.scrollTop + viewport.clientHeight) {
    viewport.scrollTop = bottom - viewport.clientHeight;
  }
}

function commitActive(): void {
  selectedCode = cohortCode(activeIndex);
  setText(committed, selectedCode);
  renderWindow();
}

viewport.addEventListener("scroll", () => {
  renderWindow(false);
});
window_.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex = Math.min(VIRTUAL_OPTION_COUNT - 1, activeIndex + 1);
    scrollActiveIntoView();
    renderWindow();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex = Math.max(0, activeIndex - 1);
    scrollActiveIntoView();
    renderWindow();
  } else if (event.key === "PageDown") {
    event.preventDefault();
    activeIndex = Math.min(VIRTUAL_OPTION_COUNT - 1, activeIndex + 7);
    scrollActiveIntoView();
    renderWindow();
  } else if (event.key === "PageUp") {
    event.preventDefault();
    activeIndex = Math.max(0, activeIndex - 7);
    scrollActiveIntoView();
    renderWindow();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    commitActive();
  }
});
window_.addEventListener("click", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.getAttribute("role") === "option"
  ) {
    const value = target.getAttribute("data-value") ?? "";
    activeIndex = Number(value.slice("COHORT-".length)) - 1;
    commitActive();
  }
});

const rerenderButton = el("button", {
  attributes: { id: "vl-rerender", type: "button" },
  text: "Rerender listbox",
});
rerenderButton.addEventListener("click", () => {
  renderPass += 1;
  setText(renderCount, String(renderPass));
  renderWindow();
});

app.append(
  el("h1", { text: "Virtualized cohort list" }),
  el("p", {
    attributes: { class: "muted" },
    text:
      `All ${String(VIRTUAL_OPTION_COUNT)} synthetic cohorts are selectable, ` +
      "but only the scrolled window is mounted in the DOM.",
  }),
  el("div", {
    attributes: { class: "field" },
    children: [
      el("label", {
        attributes: { for: "vl-listbox" },
        text: "Assessment cohort (required)",
      }),
      viewport,
      el("p", { children: ["Committed cohort: ", committed] }),
      el("p", { children: ["Mounted option nodes: ", mountedCount] }),
      el("p", { children: ["Render pass: ", renderCount] }),
      el("div", {
        attributes: { class: "nav-actions" },
        children: [rerenderButton],
      }),
    ],
  }),
);

renderWindow();
