import type { ResearchControl, ResearchVariant } from "./matrix.ts";

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function controlHtml(
  control: ResearchControl,
  variant: ResearchVariant,
): string {
  const id = escape(control.id);
  const required = control.required ? " required" : "";
  const disabled = variant.expected.sessionBoundary ? " disabled" : "";
  const invalid =
    variant.expected.validation !== "CLEAR" && control.id === "email";
  const repeaterAttributes =
    control.id === "research-repeater-controller"
      ? ` data-japp-repeater-controller="${variant.expected.repeaterFamily}"`
      : /^(?:employer|institution|language)-[12]$/u.test(control.id)
        ? ' data-japp-repeater-value value="Synthetic existing record"'
        : "";
  const attributes = `id="${id}" name="${id}"${repeaterAttributes}${required}${disabled}${invalid ? ' aria-invalid="true" aria-describedby="email-error"' : ' aria-invalid="false"'}${control.pattern === undefined ? "" : ` pattern="${escape(control.pattern)}"`}`;
  let input: string;
  if (control.kind === "select")
    input = `<select ${attributes}><option value="">Choose an option</option>${(control.options ?? []).map((option) => `<option value="${escape(option)}">${escape(option)}</option>`).join("")}</select>`;
  else if (control.kind === "textarea")
    input = `<textarea ${attributes} maxlength="500"></textarea>`;
  else if (control.kind === "combobox")
    input = `<input type="text" ${attributes} role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="${id}-options"><ul id="${id}-options" role="listbox" hidden>${(control.options ?? []).map((option, index) => `<li id="${id}-option-${String(index + 1)}" role="option" aria-selected="false">${escape(option)}</li>`).join("")}</ul>`;
  else if (control.kind === "radio")
    input = `<fieldset id="${id}"><legend>${escape(control.label)}</legend>${(control.options ?? []).map((option, index) => `<label><input id="${id}-${String(index + 1)}" type="radio" name="${id}" value="${escape(option)}"${required}${disabled}>${escape(option)}</label>`).join("")}</fieldset>`;
  else
    input = `<input type="${control.kind}" ${attributes}${control.kind === "file" ? ' accept=".pdf,.docx"' : ""}>`;
  const label =
    control.kind === "radio"
      ? ""
      : `<label for="${id}">${escape(control.label)}</label>`;
  const error = invalid
    ? `<p id="email-error" role="alert">${variant.expected.validation === "SERVER_REJECTED" ? "The server rejected this email address." : "Email address is required."}</p>`
    : "";
  return `<div class="research-field"${control.policy === "HONEYPOT_ABSTAIN" ? ' hidden aria-hidden="true"' : ""}>${label}${input}${error}</div>`;
}
function sectionHtml(
  name: string,
  controls: readonly ResearchControl[],
  variant: ResearchVariant,
): string {
  const fields = controls
    .map((control) => controlHtml(control, variant))
    .join("\n");
  if (name === "STEP" && variant.expected.repeaterRows > 0) {
    const family = variant.expected.repeaterFamily;
    const outsideRows = controls
      .filter(
        (control) =>
          !/-[12]$/u.test(control.id) &&
          control.id !== "research-repeater-controller",
      )
      .map((control) => controlHtml(control, variant))
      .join("\n");
    const controller = controls
      .filter((control) => control.id === "research-repeater-controller")
      .map((control) => controlHtml(control, variant))
      .join("");
    const rows = Array.from(
      { length: variant.expected.repeaterRows },
      (_, index) => {
        const ordinal = String(index + 1);
        const itemLabel = `${family.replaceAll("_", " ")} Synthetic ${ordinal}`;
        const rowControls = controls.filter((control) =>
          control.id.endsWith(`-${ordinal}`),
        );
        return `<fieldset data-japp-repeater-item="${ordinal}" data-japp-item-label="${itemLabel}" aria-label="${itemLabel}"><legend>${itemLabel}</legend>${rowControls.map((control) => controlHtml(control, variant)).join("\n")}</fieldset>`;
      },
    ).join("\n");
    return `<section aria-label="${family}">${outsideRows}<div data-japp-repeater="${family}" data-japp-repeater-valid="true" id="experience-repeater">${controller}<div data-japp-repeater-items>${rows}</div><button type="button" id="add-experience" data-japp-repeater-action="ADD"${variant.expected.sessionBoundary ? " disabled" : ""}>Add research item</button></div></section>`;
  }

  if (variant.layout === "NESTED")
    return `<section aria-label="${name}"><fieldset><legend>${name}</legend><div class="nested-grid"><div>${fields}</div></div></fieldset></section>`;
  if (variant.layout === "SEPARATED")
    return `<section aria-label="${name}"><h2>${name}</h2><div role="group" aria-label="${name} controls">${fields}</div></section><hr>`;
  return `<fieldset><legend>${name}</legend>${fields}</fieldset>`;
}
function familyShell(content: string, variant: ResearchVariant): string {
  switch (variant.ats) {
    case "WORKDAY":
      return `<div class="tenant-shell"><aside aria-label="Application summary"><p>Synthetic tenant application</p></aside><article><div role="group" aria-label="Application stage">${content}</div></article></div>`;
    case "GREENHOUSE":
      return `<section class="job-board"><header><h2>Apply for this synthetic position</h2></header><div class="application-columns"><article>${content}</article></div></section>`;
    case "LEVER":
      return `<article class="posting-application"><div class="application-content"><section aria-label="Candidate application">${content}</section></div><footer>Local synthetic position</footer></article>`;
    case "ASHBY":
      return `<div class="job-application"><section role="region" aria-label="Candidate details"><div class="form-panels"><div>${content}</div></div></section></div>`;
  }
}
function sessionHtml(variant: ResearchVariant): string {
  if (!variant.expected.sessionBoundary)
    return `<p role="status">Session mode: ${variant.session.replaceAll("_", " ")}</p>`;
  const markers: Record<string, string> = {
    SIGN_IN: "Sign in required",
    CREATE_ACCOUNT: "Create account required",
    EMAIL_VERIFICATION: "Verify your email address",
    MFA: "Multi-factor authentication required",
    CAPTCHA_OR_BOT_CHALLENGE: "CAPTCHA verification required",
    SESSION_EXPIRED: "Your session has expired",
    DUPLICATE_APPLICATION: "An application already exists",
    PRIVACY_OR_TERMS: "Privacy notice and terms require your review",
    UNKNOWN: "Session state unavailable",
  };
  const marker = markers[variant.session];
  if (marker === undefined) throw new Error("W12_SESSION_MARKER");
  return `<section data-session-boundary="${variant.session}" role="alert"><h2>${marker}</h2><p>Pause for the user. This research fixture performs no account or challenge action.</p></section>`;
}
function navigationHtml(variant: ResearchVariant): string {
  if (variant.expected.sessionBoundary)
    return '<nav aria-label="Application navigation"><p>Navigation unavailable at this boundary.</p></nav>';
  if (variant.expected.navigationState === "UNSAFE")
    return '<nav aria-label="Application navigation"><button id="final-submit" type="button">Submit application</button></nav>';
  const name =
    variant.expected.navigation === "SAVE_AND_CONTINUE"
      ? "Save and continue"
      : variant.expected.navigation === "REVIEW"
        ? "Review application"
        : "Next";
  return `<nav aria-label="Application navigation"><button id="next" type="button">${name}</button>${variant.expected.navigationState === "AMBIGUOUS" ? '<button id="next-duplicate" type="button">Next</button>' : ""}</nav>`;
}
/** Deterministic body fragment; it contains no executable scripts or external resources.
 * Behavior scripts belong to the local browser harness and are independently observed.
 */
export function fixtureHtml(variant: ResearchVariant): string {
  let sections: readonly ResearchControl["section"][] = [
    "CONTACT",
    "ADDRESS",
    "STEP",
    "SAFETY",
  ];
  if (variant.layout === "REORDERED")
    sections = ["STEP", "SAFETY", "ADDRESS", "CONTACT"];
  const content = sections
    .map((section) =>
      sectionHtml(
        section,
        variant.controls.filter((control) => control.section === section),
        variant,
      ),
    )
    .join("\n");
  const stepLabel = variant.step.replaceAll("_", " ");
  return `<main lang="${variant.locale}" data-japp-application-root data-research-family="${variant.ats}" data-research-session="${variant.session}" data-research-layout="${variant.layout}" data-research-step="${variant.step}">
<header><p>PUBLIC SYNTHETIC · RESEARCH ONLY · NOT CERTIFIED</p><h1>${stepLabel}</h1><ol aria-label="Application progress"><li aria-current="step">${stepLabel}</li></ol></header>
${sessionHtml(variant)}
<form novalidate aria-label="Synthetic application">${familyShell(content, variant)}<div id="dynamic-slot"></div><div id="parser-status" role="status"></div>${navigationHtml(variant)}</form>
</main>\n`;
}
