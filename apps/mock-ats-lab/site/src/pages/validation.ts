// Validation behaviors (case MAL-VAL-001): custom single-field rules,
// cross-field agreement, and a fixed-delay simulated "server-side" check
// that runs entirely locally. Errors clear deterministically when the
// input is corrected, and a continue action stays blocked while any
// validation problem remains.
import { mountLabNotice } from "../lab/banner.ts";
import { DELAYED_VALIDATION_MS } from "../lab/constants.ts";
import { el, fieldRow, mustGet, setText } from "../lab/dom.ts";

mountLabNotice();

const app = mustGet("app");

const username = el("input", {
  attributes: { autocomplete: "off", id: "val-username", type: "text" },
});
const email = el("input", {
  attributes: { autocomplete: "off", id: "val-email", type: "text" },
});
const emailConfirm = el("input", {
  attributes: { autocomplete: "off", id: "val-email-confirm", type: "text" },
});
const inviteCode = el("input", {
  attributes: { autocomplete: "off", id: "val-invite", type: "text" },
});
const inviteStatus = el("output", {
  attributes: { id: "val-invite-status", role: "status" },
  text: "NOT_CHECKED",
});
const continueStatus = el("output", {
  attributes: { class: "status", id: "val-continue-status", role: "status" },
});

const errorFor = (id: string): HTMLElement => mustGet(id);

function validateUsername(): boolean {
  const value = username.value.trim();
  const valid = /^[a-z][a-z0-9]{2,15}$/.test(value);
  setText(
    errorFor("val-username-error"),
    value === ""
      ? "Username is required."
      : valid
        ? ""
        : "Use 3–16 lowercase letters/digits, starting with a letter.",
  );
  return valid;
}

function validateEmails(): boolean {
  const shape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const first = email.value.trim();
  const second = emailConfirm.value.trim();
  const firstOk = shape.test(first);
  setText(
    errorFor("val-email-error"),
    first === ""
      ? "Email address is required."
      : firstOk
        ? ""
        : "Enter an address such as avery.applicant@example.test.",
  );
  const matches = firstOk && second === first;
  setText(
    errorFor("val-email-confirm-error"),
    second === ""
      ? "Confirm the email address."
      : matches
        ? ""
        : "Both email fields must match exactly.",
  );
  return firstOk && matches;
}

username.addEventListener("input", () => {
  validateUsername();
});
email.addEventListener("input", () => {
  validateEmails();
});
emailConfirm.addEventListener("input", () => {
  validateEmails();
});

// Simulated server-side check: fixed local delay, exact synthetic rule.
let inviteAccepted = false;
let inviteCheckToken = 0;
const inviteCheck = el("button", {
  attributes: { id: "val-invite-check", type: "button" },
  text: "Check invitation code",
});
inviteCheck.addEventListener("click", () => {
  inviteCheckToken += 1;
  const token = inviteCheckToken;
  inviteAccepted = false;
  setText(inviteStatus, "CHECKING");
  const value = inviteCode.value.trim();
  window.setTimeout(() => {
    if (token !== inviteCheckToken) {
      return;
    }
    if (/^MOCK-INVITE-\d{4}$/.test(value)) {
      inviteAccepted = true;
      setText(inviteStatus, "INVITE_ACCEPTED");
      setText(errorFor("val-invite-error"), "");
    } else {
      setText(inviteStatus, "INVITE_REJECTED");
      setText(
        errorFor("val-invite-error"),
        "Invitation code must look like MOCK-INVITE-0000.",
      );
    }
  }, DELAYED_VALIDATION_MS);
});
inviteCode.addEventListener("input", () => {
  inviteAccepted = false;
  setText(inviteStatus, "NOT_CHECKED");
  setText(errorFor("val-invite-error"), "");
});

const continueButton = el("button", {
  attributes: { id: "val-continue", type: "button" },
  text: "Continue (blocked while invalid)",
});
continueButton.addEventListener("click", () => {
  const usernameOk = validateUsername();
  const emailsOk = validateEmails();
  continueStatus.removeAttribute("data-tone");
  if (!usernameOk || !emailsOk || !inviteAccepted) {
    continueStatus.setAttribute("data-tone", "error");
    setText(
      continueStatus,
      "CONTINUE_BLOCKED: resolve every validation problem (including the invitation check) first.",
    );
    return;
  }
  continueStatus.setAttribute("data-tone", "ok");
  setText(continueStatus, "CONTINUE_ALLOWED: all validation checks passed.");
});

app.append(
  el("h1", { text: "Validation behaviors" }),
  el("form", {
    attributes: { id: "val-form", novalidate: "" },
    children: [
      fieldRow({
        control: username,
        controlId: "val-username",
        errorId: "val-username-error",
        help: "Custom rule validated as you type.",
        label: "Username (required)",
      }),
      fieldRow({
        control: email,
        controlId: "val-email",
        errorId: "val-email-error",
        label: "Email address (required)",
      }),
      fieldRow({
        control: emailConfirm,
        controlId: "val-email-confirm",
        errorId: "val-email-confirm-error",
        help: "Cross-field rule: must match the email address exactly.",
        label: "Confirm email address (required)",
      }),
      fieldRow({
        control: inviteCode,
        controlId: "val-invite",
        errorId: "val-invite-error",
        help: "Checked by a simulated local reviewer after a fixed delay.",
        label: "Invitation code (required)",
      }),
      el("div", {
        attributes: { class: "nav-actions" },
        children: [inviteCheck, continueButton],
      }),
      el("p", { children: ["Invitation check: ", inviteStatus] }),
      continueStatus,
    ],
  }),
);
