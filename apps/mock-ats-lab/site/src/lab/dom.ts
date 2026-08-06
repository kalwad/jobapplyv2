// Text-only DOM construction helpers for the mock ATS lab (M02-W03).
//
// The lab never assigns HTML-string sinks and never evaluates dynamic
// code; every untrusted-looking fixture string is rendered as a Text
// node. The unit suite statically scans the source tree for the
// forbidden sinks; keeping all element construction here makes that
// policy easy to hold.

export interface ElementSpec {
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly (Node | string)[];
  readonly text?: string;
}

/** Create an element; strings in `children` become Text nodes. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  spec: ElementSpec = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (spec.attributes) {
    for (const [name, value] of Object.entries(spec.attributes)) {
      node.setAttribute(name, value);
    }
  }
  if (spec.text !== undefined) {
    node.append(document.createTextNode(spec.text));
  }
  if (spec.children) {
    for (const child of spec.children) {
      node.append(
        typeof child === "string" ? document.createTextNode(child) : child,
      );
    }
  }
  return node;
}

/** Replace an element's content with a single Text node. */
export function setText(node: HTMLElement, text: string): void {
  node.replaceChildren(document.createTextNode(text));
}

/** Required element lookup that fails loudly in a broken fixture. */
export function mustGet(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) {
    throw new Error(`mock ATS lab fixture is missing element #${id}`);
  }
  return node;
}

/** Labeled field row: label, control, optional help text, error region. */
export function fieldRow(options: {
  readonly control: HTMLElement;
  readonly controlId: string;
  readonly errorId: string;
  readonly help?: string;
  readonly label: string;
}): HTMLDivElement {
  const help =
    options.help === undefined
      ? []
      : [
          el("p", {
            attributes: { class: "help", id: `${options.controlId}-help` },
            text: options.help,
          }),
        ];
  const describedBy = [
    ...(options.help === undefined ? [] : [`${options.controlId}-help`]),
    options.errorId,
  ].join(" ");
  options.control.setAttribute("aria-describedby", describedBy);
  return el("div", {
    attributes: { class: "field" },
    children: [
      el("label", {
        attributes: { for: options.controlId },
        text: options.label,
      }),
      options.control,
      ...help,
      el("p", {
        attributes: {
          class: "error",
          id: options.errorId,
          role: "status",
        },
      }),
    ],
  });
}
