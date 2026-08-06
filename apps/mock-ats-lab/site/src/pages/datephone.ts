// Composite date and phone widgets (cases MAL-DTP-001 and MAL-DTP-002).
// Deterministic fixed-rule normalization and validation — no locale APIs,
// no Date parsing, no guessing. Accepted values are echoed as committed
// ISO / E.164-style strings.
import { mountLabNotice } from "../lab/banner.ts";
import { el, fieldRow, mustGet, setText } from "../lab/dom.ts";

mountLabNotice();

const app = mustGet("app");

// ------------------------------------------------------------------- date
const day = el("input", {
  attributes: {
    autocomplete: "off",
    id: "cd-day",
    inputmode: "numeric",
    maxlength: "2",
    type: "text",
  },
});
const month = el("input", {
  attributes: {
    autocomplete: "off",
    id: "cd-month",
    inputmode: "numeric",
    maxlength: "2",
    type: "text",
  },
});
const year = el("input", {
  attributes: {
    autocomplete: "off",
    id: "cd-year",
    inputmode: "numeric",
    maxlength: "4",
    type: "text",
  },
});
const dateError = el("p", {
  attributes: { class: "error", id: "cd-error", role: "status" },
});
const dateCommitted = el("output", { attributes: { id: "cd-committed" } });

const DAYS_IN_MONTH: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

function isLeapYear(value: number): boolean {
  return (value % 4 === 0 && value % 100 !== 0) || value % 400 === 0;
}

function normalizeTwoDigits(control: HTMLInputElement): void {
  const digits = control.value.trim();
  if (/^\d$/.test(digits)) {
    control.value = `0${digits}`;
  }
}

day.addEventListener("blur", () => {
  normalizeTwoDigits(day);
});
month.addEventListener("blur", () => {
  normalizeTwoDigits(month);
});

const dateCommit = el("button", {
  attributes: { id: "cd-commit", type: "button" },
  text: "Commit availability date",
});
dateCommit.addEventListener("click", () => {
  normalizeTwoDigits(day);
  normalizeTwoDigits(month);
  const dayText = day.value.trim();
  const monthText = month.value.trim();
  const yearText = year.value.trim();
  if (
    !/^\d{2}$/.test(dayText) ||
    !/^\d{2}$/.test(monthText) ||
    !/^\d{4}$/.test(yearText)
  ) {
    setText(dateError, "INVALID_DATE_FORMAT: use DD, MM, and YYYY digits.");
    setText(dateCommitted, "");
    return;
  }
  const dayNumber = Number(dayText);
  const monthNumber = Number(monthText);
  const yearNumber = Number(yearText);
  const monthLength =
    monthNumber >= 1 && monthNumber <= 12
      ? (DAYS_IN_MONTH[monthNumber - 1] ?? 0) +
        (monthNumber === 2 && isLeapYear(yearNumber) ? 1 : 0)
      : 0;
  if (
    monthLength === 0 ||
    dayNumber < 1 ||
    dayNumber > monthLength ||
    yearNumber < 2020 ||
    yearNumber > 2040
  ) {
    setText(
      dateError,
      "INVALID_DATE: that calendar day does not exist (or is outside 2020–2040).",
    );
    setText(dateCommitted, "");
    return;
  }
  setText(dateError, "");
  setText(dateCommitted, `${yearText}-${monthText}-${dayText}`);
});

// ------------------------------------------------------------------ phone
const COUNTRY_RULES: Readonly<
  Record<string, { label: string; nationalDigits: number }>
> = {
  "+1": { label: "+1 (synthetic North America)", nationalDigits: 10 },
  "+44": { label: "+44 (synthetic Britannia)", nationalDigits: 10 },
  "+61": { label: "+61 (synthetic Austral)", nationalDigits: 9 },
};

const countrySelect = el("select", {
  attributes: { id: "cp-country" },
  children: Object.entries(COUNTRY_RULES).map(([code, rule]) =>
    el("option", { attributes: { value: code }, text: rule.label }),
  ),
});
const national = el("input", {
  attributes: {
    autocomplete: "off",
    id: "cp-national",
    inputmode: "tel",
    type: "text",
  },
});
const phoneError = el("p", {
  attributes: { class: "error", id: "cp-error", role: "status" },
});
const phoneCommitted = el("output", { attributes: { id: "cp-committed" } });

national.addEventListener("blur", () => {
  // Site-side normalization: spaces, dashes, dots, and parentheses are
  // stripped deterministically on blur.
  national.value = national.value.replaceAll(/[\s\-.()]/g, "");
});

const phoneCommit = el("button", {
  attributes: { id: "cp-commit", type: "button" },
  text: "Commit phone number",
});
phoneCommit.addEventListener("click", () => {
  national.value = national.value.replaceAll(/[\s\-.()]/g, "");
  const code = countrySelect.value;
  const rule = COUNTRY_RULES[code];
  if (rule === undefined) {
    setText(phoneError, "INVALID_COUNTRY: select a synthetic country code.");
    setText(phoneCommitted, "");
    return;
  }
  if (!/^\d+$/.test(national.value)) {
    setText(
      phoneError,
      "INVALID_PHONE: national number must contain digits only.",
    );
    setText(phoneCommitted, "");
    return;
  }
  if (national.value.length !== rule.nationalDigits) {
    setText(
      phoneError,
      `INVALID_PHONE_LENGTH: ${code} requires exactly ${String(rule.nationalDigits)} national digits.`,
    );
    setText(phoneCommitted, "");
    return;
  }
  setText(phoneError, "");
  setText(phoneCommitted, `${code}${national.value}`);
});

app.append(
  el("h1", { text: "Date and phone widgets" }),
  el("h2", { text: "Availability date (composite DD / MM / YYYY)" }),
  el("fieldset", {
    children: [
      el("legend", { text: "Earliest availability (required)" }),
      fieldRow({
        control: day,
        controlId: "cd-day",
        errorId: "cd-day-error",
        label: "Day (DD)",
      }),
      fieldRow({
        control: month,
        controlId: "cd-month",
        errorId: "cd-month-error",
        label: "Month (MM)",
      }),
      fieldRow({
        control: year,
        controlId: "cd-year",
        errorId: "cd-year-error",
        label: "Year (YYYY)",
      }),
      el("div", {
        attributes: { class: "nav-actions" },
        children: [dateCommit],
      }),
      dateError,
      el("p", { children: ["Committed date: ", dateCommitted] }),
    ],
  }),
  el("h2", { text: "Contact phone (composite country + national number)" }),
  el("fieldset", {
    children: [
      el("legend", { text: "Phone number (required)" }),
      fieldRow({
        control: countrySelect,
        controlId: "cp-country",
        errorId: "cp-country-error",
        label: "Country code",
      }),
      fieldRow({
        control: national,
        controlId: "cp-national",
        errorId: "cp-national-error",
        help: "Digits only after normalization; use synthetic 555 01xx ranges.",
        label: "National number",
      }),
      el("div", {
        attributes: { class: "nav-actions" },
        children: [phoneCommit],
      }),
      phoneError,
      el("p", { children: ["Committed phone: ", phoneCommitted] }),
    ],
  }),
);
