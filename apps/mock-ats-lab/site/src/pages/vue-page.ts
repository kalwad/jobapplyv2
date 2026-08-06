// Real Vue-controlled form (cases MAL-VUE-001 … MAL-VUE-003).
//
// Uses the actual Vue reactivity system and vdom via render functions:
// committed values live in reactive state, inputs are value+input
// controlled, a rerender patches the DOM from state (discarding stale
// direct DOM writes), and the employee-ID field demonstrates an observable
// site-side rewrite (uppercasing on change).
import { createApp, h, reactive, type VNode } from "vue";

import { mountLabNotice } from "../lab/banner.ts";
import { mustGet } from "../lab/dom.ts";

mountLabNotice();

interface VueFormState {
  fullName: string;
  employeeId: string;
  office: string;
  agreed: boolean;
  renderCount: number;
}

const state = reactive<VueFormState>({
  fullName: "",
  employeeId: "",
  office: "",
  agreed: false,
  renderCount: 1,
});

function field(id: string, label: string, control: VNode): VNode {
  return h("div", { class: "field" }, [
    h("label", { for: id }, label),
    control,
  ]);
}

function readInputValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement
    ? target.value
    : "";
}

const VueFixtureForm = {
  render(): VNode {
    return h(
      "form",
      {
        id: "vue-form",
        novalidate: true,
        onSubmit: (event: Event) => {
          event.preventDefault();
        },
      },
      [
        field(
          "vue-full-name",
          "Full name (required)",
          h("input", {
            id: "vue-full-name",
            name: "fullName",
            onInput: (event: Event) => {
              state.fullName = readInputValue(event);
            },
            required: true,
            type: "text",
            value: state.fullName,
          }),
        ),
        field(
          "vue-employee-id",
          "Referral employee ID (the site uppercases it as you type)",
          h("input", {
            id: "vue-employee-id",
            name: "employeeId",
            onInput: (event: Event) => {
              state.employeeId = readInputValue(event).toUpperCase();
            },
            type: "text",
            value: state.employeeId,
          }),
        ),
        field(
          "vue-office",
          "Preferred office (required)",
          h(
            "select",
            {
              id: "vue-office",
              name: "office",
              onChange: (event: Event) => {
                state.office = readInputValue(event);
              },
              required: true,
              value: state.office,
            },
            [
              h("option", { value: "" }, "Select an office"),
              h("option", { value: "harbor" }, "Harbor Point (synthetic)"),
              h("option", { value: "summit" }, "Summit Row (synthetic)"),
              h("option", { value: "prairie" }, "Prairie Gate (synthetic)"),
            ],
          ),
        ),
        h("div", { class: "field" }, [
          h("input", {
            checked: state.agreed,
            id: "vue-agreed",
            name: "agreed",
            onChange: (event: Event) => {
              const target = event.target;
              state.agreed =
                target instanceof HTMLInputElement ? target.checked : false;
            },
            type: "checkbox",
          }),
          h(
            "label",
            { for: "vue-agreed" },
            "Accept synthetic terms (optional)",
          ),
        ]),
        h("div", { class: "nav-actions" }, [
          h(
            "button",
            {
              id: "vue-rerender",
              onClick: () => {
                state.renderCount += 1;
              },
              type: "button",
            },
            "Force rerender",
          ),
        ]),
        h("div", { class: "panel" }, [
          h("h2", null, "Framework state (rendered from Vue state)"),
          h("p", null, [
            "Render pass: ",
            h("output", { id: "vue-render-count" }, String(state.renderCount)),
          ]),
          h("p", null, [
            "Committed full name: ",
            h("output", { id: "vue-state-full-name" }, state.fullName),
          ]),
          h("p", null, [
            "Committed employee ID: ",
            h("output", { id: "vue-state-employee-id" }, state.employeeId),
          ]),
        ]),
      ],
    );
  },
};

const app = mustGet("app");
const heading = document.createElement("h1");
heading.append(document.createTextNode("Framework form — real Vue runtime"));
const mount = document.createElement("div");
mount.id = "vue-root";
app.append(heading, mount);

createApp(VueFixtureForm).mount(mount);
