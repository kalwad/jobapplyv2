// Real React-controlled form (cases MAL-REA-001 … MAL-REA-003).
//
// State changes flow only through React's synthetic events; the committed
// value lives in component state. A forced or delayed rerender re-renders
// the whole subtree from state, so direct stale DOM-property writes never
// become accepted state, and the email field demonstrates an observable
// site-side rewrite (lowercasing on blur).
import {
  createElement as h,
  useCallback,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { createRoot } from "react-dom/client";

import { mountLabNotice } from "../lab/banner.ts";
import { DELAYED_RERENDER_MS } from "../lab/constants.ts";
import { mustGet } from "../lab/dom.ts";

mountLabNotice();

interface ReactFormState {
  readonly fullName: string;
  readonly email: string;
  readonly team: string;
  readonly subscribed: boolean;
  readonly summary: string;
}

const INITIAL_STATE: ReactFormState = {
  fullName: "",
  email: "",
  team: "",
  subscribed: false,
  summary: "",
};

function labeled(
  id: string,
  label: string,
  control: ReactElement,
): ReactElement {
  return h(
    "div",
    { className: "field", key: id },
    h("label", { htmlFor: id }, label),
    control,
  );
}

function ReactFixtureForm(): ReactElement {
  const [form, setForm] = useState<ReactFormState>(INITIAL_STATE);
  const [renderCount, setRenderCount] = useState(1);
  const [pendingRerender, setPendingRerender] = useState(false);

  const patch = useCallback((partial: Partial<ReactFormState>) => {
    setForm((previous) => ({ ...previous, ...partial }));
  }, []);

  const forceRerender = useCallback(() => {
    setRenderCount((previous) => previous + 1);
  }, []);

  const delayedRerender = useCallback(() => {
    setPendingRerender(true);
    window.setTimeout(() => {
      setPendingRerender(false);
      setRenderCount((previous) => previous + 1);
    }, DELAYED_RERENDER_MS);
  }, []);

  return h(
    "form",
    {
      id: "react-form",
      noValidate: true,
      onSubmit: (event) => {
        event.preventDefault();
      },
    },
    labeled(
      "react-full-name",
      "Full name (required)",
      h("input", {
        id: "react-full-name",
        name: "fullName",
        onChange: (event) => {
          patch({ fullName: event.currentTarget.value });
        },
        required: true,
        type: "text",
        value: form.fullName,
      }),
    ),
    labeled(
      "react-email",
      "Email address (required; the site lowercases it on blur)",
      h("input", {
        id: "react-email",
        name: "email",
        onBlur: (event) => {
          patch({ email: event.currentTarget.value.toLowerCase() });
        },
        onChange: (event) => {
          patch({ email: event.currentTarget.value });
        },
        required: true,
        type: "email",
        value: form.email,
      }),
    ),
    labeled(
      "react-team",
      "Team (required)",
      h(
        "select",
        {
          id: "react-team",
          name: "team",
          onChange: (event: ChangeEvent<HTMLSelectElement>) => {
            patch({ team: event.currentTarget.value });
          },
          required: true,
          value: form.team,
        },
        h("option", { value: "" }, "Select a team"),
        h("option", { value: "platform" }, "Platform tools"),
        h("option", { value: "research" }, "Applied research"),
        h("option", { value: "operations" }, "Operations"),
      ),
    ),
    h(
      "div",
      { className: "field" },
      h("input", {
        checked: form.subscribed,
        id: "react-subscribed",
        name: "subscribed",
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          patch({ subscribed: event.currentTarget.checked });
        },
        type: "checkbox",
      }),
      h(
        "label",
        { htmlFor: "react-subscribed" },
        "Send synthetic updates (optional)",
      ),
    ),
    labeled(
      "react-summary",
      "Summary (optional)",
      h("textarea", {
        id: "react-summary",
        name: "summary",
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
          patch({ summary: event.currentTarget.value });
        },
        rows: 3,
        value: form.summary,
      }),
    ),
    h(
      "div",
      { className: "nav-actions" },
      h(
        "button",
        { id: "react-rerender", onClick: forceRerender, type: "button" },
        "Force rerender",
      ),
      h(
        "button",
        {
          className: "secondary",
          disabled: pendingRerender,
          id: "react-delayed-rerender",
          onClick: delayedRerender,
          type: "button",
        },
        pendingRerender ? "Rerender scheduled…" : "Delayed rerender",
      ),
    ),
    h(
      "div",
      { className: "panel" },
      h("h2", null, "Framework state (rendered from React state)"),
      h(
        "p",
        null,
        "Render pass: ",
        h("output", { id: "react-render-count" }, String(renderCount)),
      ),
      h(
        "p",
        null,
        "Committed email: ",
        h("output", { id: "react-state-email" }, form.email),
      ),
      h(
        "p",
        null,
        "Committed full name: ",
        h("output", { id: "react-state-full-name" }, form.fullName),
      ),
      h(
        "p",
        null,
        "Rerender status: ",
        h(
          "output",
          { id: "react-rerender-status" },
          pendingRerender ? "RERENDER_PENDING" : "IDLE",
        ),
      ),
    ),
  );
}

const app = mustGet("app");
const heading = document.createElement("h1");
heading.append(document.createTextNode("Framework form — real React runtime"));
const mount = document.createElement("div");
mount.id = "react-root";
app.append(heading, mount);

createRoot(mount).render(h(ReactFixtureForm));
