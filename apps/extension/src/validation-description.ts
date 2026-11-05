// A bounded, engine-private observation of local description components.
// It may prove that known rejected error text cleared; it never grants a new
// write or changes durable field identity. Weak roots do not retain old pages.
import { localIdReference } from "./open-dom.ts";
import { normalizeScannerText } from "./field-scanner.ts";

interface DescriptionComponent {
  readonly id: string;
  readonly text: string;
  readonly error: boolean;
  readonly role: string | null;
  readonly classes: string;
}

export interface ValidationDescriptionSnapshot {
  readonly root: WeakRef<Document | ShadowRoot>;
  readonly references: string;
  readonly components: readonly DescriptionComponent[];
  readonly normalizedText: string;
}

function normalizeMessage(value: string): string {
  return value.normalize("NFKC").replaceAll(/\s+/g, " ").trim();
}

export function captureValidationDescription(
  anchor: HTMLElement,
): ValidationDescriptionSnapshot | null {
  const root = anchor.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot)) return null;
  if (root instanceof ShadowRoot && root.mode !== "open") return null;
  const references = anchor.getAttribute("aria-describedby") ?? "";
  if (references.length === 0 || references.length > 4096) return null;
  const ids = references.split(/\s+/).filter(Boolean);
  if (ids.length === 0 || ids.length > 32 || new Set(ids).size !== ids.length)
    return null;
  const components: DescriptionComponent[] = [];
  for (const id of ids) {
    const node = localIdReference(anchor, id);
    if (node?.getRootNode() !== root) return null;
    const text = normalizeMessage(node.textContent);
    const role = node.getAttribute("role");
    const classes = node.getAttribute("class") ?? "";
    // Do not prove changes from a truncated description or retain unbounded
    // page text. The scanner's public normalized description is at most 512.
    if (text.length > 512 || (role?.length ?? 0) > 512 || classes.length > 512)
      return null;
    components.push({
      id,
      text,
      error: node.classList.contains("error"),
      role,
      classes,
    });
  }
  const combined = components.map((component) => component.text).join(" ");
  if (combined.length > 512) return null;
  return {
    root: new WeakRef(root),
    references,
    components,
    normalizedText: normalizeScannerText(combined),
  };
}

function sameComponentBinding(
  before: DescriptionComponent,
  after: DescriptionComponent,
): boolean {
  return (
    before.id === after.id &&
    before.error === after.error &&
    before.role === after.role &&
    before.classes === after.classes
  );
}

function sameReferences(
  before: ValidationDescriptionSnapshot,
  after: ValidationDescriptionSnapshot,
): boolean {
  const root = before.root.deref();
  return (
    root !== undefined &&
    root === after.root.deref() &&
    before.references === after.references &&
    before.components.length === after.components.length
  );
}

/** Exact current component binding, also checked on W11 and undo paths. */
export function validationDescriptionMatches(
  approved: ValidationDescriptionSnapshot,
  anchor: HTMLElement,
): boolean {
  const current = captureValidationDescription(anchor);
  return (
    current !== null &&
    sameReferences(approved, current) &&
    approved.components.every((component, index) => {
      const next = current.components[index];
      return (
        next !== undefined &&
        sameComponentBinding(component, next) &&
        component.text === next.text
      );
    })
  );
}

/** All changed components must be exactly observed rejected error messages
 * becoming empty. Stable help, ownership, references, roles and classes stay
 * identical; substring/shrink heuristics cannot manufacture this proof. */
export function validationDescriptionCleared(
  before: ValidationDescriptionSnapshot,
  after: ValidationDescriptionSnapshot,
  rejectedMessages: ReadonlySet<string>,
): boolean {
  if (!sameReferences(before, after)) return false;
  let cleared = false;
  return (
    before.components.every((component, index) => {
      const next = after.components[index];
      if (next === undefined || !sameComponentBinding(component, next))
        return false;
      if (component.text === next.text) return true;
      if (
        !component.error ||
        component.text === "" ||
        next.text !== "" ||
        !rejectedMessages.has(component.text)
      )
        return false;
      cleared = true;
      return true;
    }) && cleared
  );
}
