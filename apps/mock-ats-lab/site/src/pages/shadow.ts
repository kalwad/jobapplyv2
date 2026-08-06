// Open shadow-root form section (case MAL-SHD-001): a custom element with
// an OPEN shadow root containing an accessible labeled control with
// deterministic value and validation behavior. Closed shadow roots are
// deliberately out of scope and not claimed.
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet } from "../lab/dom.ts";

mountLabNotice();

class LabShadowContact extends HTMLElement {
  connectedCallback(): void {
    if (this.shadowRoot !== null) {
      return;
    }
    const root = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.append(
      document.createTextNode(
        ".field{margin:0.6rem 0}label{display:block;font-weight:600;margin-bottom:0.2rem}" +
          "input{font:inherit;padding:0.4rem 0.5rem;border:1px solid #c9cfd8;border-radius:4px;width:100%;max-width:26rem}" +
          ".error{color:#a4262c;font-size:0.9rem;min-height:1.1em}" +
          ".status{font-weight:600}",
      ),
    );

    const input = document.createElement("input");
    input.id = "shadow-contact-name";
    input.type = "text";
    input.required = true;
    input.autocomplete = "off";
    input.setAttribute("aria-describedby", "shadow-contact-error");

    const label = document.createElement("label");
    label.htmlFor = "shadow-contact-name";
    label.append(document.createTextNode("Emergency contact name (required)"));

    const error = document.createElement("p");
    error.className = "error";
    error.id = "shadow-contact-error";
    error.setAttribute("role", "status");

    const status = document.createElement("output");
    status.className = "status";
    status.id = "shadow-contact-status";
    status.setAttribute("role", "status");

    const button = document.createElement("button");
    button.id = "shadow-contact-save";
    button.type = "button";
    button.append(document.createTextNode("Save emergency contact"));
    button.addEventListener("click", () => {
      const value = input.value.trim();
      if (value === "") {
        error.replaceChildren(
          document.createTextNode("Emergency contact name is required."),
        );
        status.replaceChildren(
          document.createTextNode("SHADOW_VALIDATION_FAILED"),
        );
        return;
      }
      error.replaceChildren();
      status.replaceChildren(document.createTextNode(`SHADOW_SAVED:${value}`));
    });
    input.addEventListener("input", () => {
      error.replaceChildren();
      status.replaceChildren();
    });

    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.append(label, input, error);
    root.append(style, wrap, button, status);
  }
}

customElements.define("lab-shadow-contact", LabShadowContact);

const app = mustGet("app");
const host = document.createElement("lab-shadow-contact");
host.id = "shadow-host";

app.append(
  el("h1", { text: "Shadow DOM section" }),
  el("p", {
    attributes: { class: "muted" },
    text:
      "The emergency-contact control lives inside an OPEN shadow root on a " +
      "stable custom-element host.",
  }),
  host,
);
