import { rememberOptionMeaningSnapshot } from "./option-meaning.ts";
import {
  captureOpenTree,
  currentOpenTopology,
  topologyWorkMetrics,
  hasAmbiguousLocalReference,
  composedContains,
  composedParent,
  composedClosest,
  localIdReference,
  sameOpenRoots,
} from "./open-dom.ts";
import {
  SCANNER_WORK_KEYS,
  type ScannerWorkMetrics,
} from "./scanner-protocol.ts";
import type {
  FormFieldAddressV1,
  FormFieldDescriptorV1,
  FormFieldDescriptorV1ControlKind,
  FormFieldDescriptorV1OptionSemantic,
  FormFieldDescriptorV1UntrustedTextRepresentation,
} from "@japp/contracts/generated";

import {
  CONTENT_FRAME_SCAN_FOUND,
  FRAME_RERESOLUTION_RESULT_KIND,
  FRAME_SCAN_RESULT_KIND,
  type FieldResolution,
  type FrameContext,
  type FrameReresolutionResult,
  type FrameScanReport,
  isCanonicalInertString,
  MAX_DESCRIPTORS_PER_FRAME,
  MAX_OPTIONS_PER_FIELD,
  type ReresolveFrameRequest,
  SCANNER_PROTOCOL_VERSION,
  type ScanFrameRequest,
  type ScanScope,
} from "./scanner-protocol.ts";
import { semanticDigest, stableSemanticId } from "./semantic-identity.ts";

const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
  "select",
  "textarea",
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='checkbox']",
  "[role='radiogroup']",
].join(",");

const HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6,[role='heading']";
const NORMALIZED_TEXT_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9 .,:!?()'&+/@_-]{0,511}$/;
const BOUNDED_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+/-]{0,127}$/;

/**
 * M02-W11 page-generation registry. Every document starts at generation 0 —
 * byte-identical W07–W10 behavior — and only the W11 dynamic engine
 * advances it, exclusively on structural invalidation (SPA route change or
 * application-root replacement), never on ordinary mutations. Descriptors
 * and addresses built by any scan stamp the document's current generation,
 * so the accepted W10 kernel's existing `generation_matched` precondition
 * automatically refuses to let a pre-invalidation address authorize a
 * post-invalidation action.
 */
const observedDomGenerations = new WeakMap<Document, number>();

export function currentDomGeneration(document: Document): number {
  return observedDomGenerations.get(document) ?? 0;
}

export function advanceDomGeneration(document: Document): number {
  const next = currentDomGeneration(document) + 1;
  observedDomGenerations.set(document, next);
  return next;
}

export interface FieldCandidate {
  readonly anchor: HTMLElement;
  readonly members: HTMLElement[];
  readonly kind: FormFieldDescriptorV1ControlKind;
  readonly groupElement?: HTMLElement;
}

type MutableScannerWork = { -readonly [K in keyof ScannerWorkMetrics]: number };
const scannerWork = new WeakMap<Document, MutableScannerWork>();
const lastMeasuredGeneration = new WeakMap<Document, number>();

export function scannerWorkMetrics(document: Document) {
  let metrics = scannerWork.get(document);
  if (metrics === undefined) {
    metrics = Object.fromEntries(
      SCANNER_WORK_KEYS.map((key) => [key, 0]),
    ) as MutableScannerWork;
    scannerWork.set(document, metrics);
  }
  return {
    ...metrics,
    ...topologyWorkMetrics(document),
    total_duration_ms: Math.ceil(metrics.total_duration_us / 1000),
  };
}

function measuredUs(started: number): number {
  return Math.max(0, Math.ceil((performance.now() - started) * 1000));
}

export type ResolutionPurpose =
  "preflight" | "preaction" | "settle" | "reconcile" | "other";

function noteGeneration(document: Document): void {
  const generation = currentDomGeneration(document);
  if (lastMeasuredGeneration.get(document) !== generation) {
    lastMeasuredGeneration.set(document, generation);
    workCounters(document).generations_observed += 1;
  }
}

function workCounters(document: Document) {
  scannerWorkMetrics(document);
  const metrics = scannerWork.get(document);
  if (metrics === undefined)
    throw new Error("scanner instrumentation unavailable");
  return metrics;
}

type ApplicationRootResult =
  | { readonly status: "FOUND"; readonly root: HTMLElement }
  | { readonly status: "UNRESOLVED" }
  | { readonly status: "AMBIGUOUS"; readonly candidateCount: number };

interface ScanBoundaryResult {
  readonly status: "FOUND" | "UNRESOLVED" | "AMBIGUOUS";
  readonly applicationRoot?: HTMLElement;
  readonly scanBoundary?: HTMLElement;
  readonly candidateCount: number;
}

interface ScanIdentityContext {
  readonly frameContext: FrameContext;
  readonly routeSignature: string;
  readonly applicationRootFingerprint: string;
  readonly observedAt: string;
  readonly observedDomGeneration: number;
  readonly headingCandidates: readonly HTMLElement[];
}

function elementsWithin(root: Element, selector: string): HTMLElement[] {
  const capture = captureOpenTree(root);
  return capture.status === "COMPLETE"
    ? capture.elements.filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.matches(selector),
      )
    : [];
}

function hasSupportedControl(root: Element): boolean {
  return elementsWithin(root, CONTROL_SELECTOR).length > 0;
}

/** Conservative raw-control bound, including grouped controls. A refusal is
 * explicit; no truncated descriptor list may stand for complete coverage. */
export function scanCapacityExceeded(root: HTMLElement): boolean {
  const started = performance.now();
  const work = workCounters(root.ownerDocument);
  work.capacity_checks += 1;
  try {
    const capture = captureOpenTree(root);
    return (
      capture.status === "CAPACITY_EXCEEDED" ||
      capture.elements.filter((element) => element.matches(CONTROL_SELECTOR))
        .length > MAX_DESCRIPTORS_PER_FRAME
    );
  } finally {
    work.capacity_check_duration_us += measuredUs(started);
  }
}

function uniqueElements(elements: readonly HTMLElement[]): HTMLElement[] {
  return [...new Set(elements)];
}

function requiredValue<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("scanner invariant: expected one value");
  }
  return value;
}

/**
 * Resolve one deterministic application root without ATS-brand heuristics.
 * Explicit application/form regions win, followed by one form ownership
 * group, followed by one semantic main region. Ambiguity is returned rather
 * than collapsed to the first container.
 */
export function detectApplicationRoot(
  document: Document,
): ApplicationRootResult {
  const started = performance.now();
  const work = workCounters(document);
  work.root_detection_calls += 1;
  try {
    return detectRootEvidence(document);
  } finally {
    work.root_detection_duration_us += measuredUs(started);
  }
}

function detectRootEvidence(document: Document): ApplicationRootResult {
  const explicit = uniqueElements(
    elementsWithin(
      document.documentElement,
      "[data-japp-application-root],[role='application']",
    ).filter(hasSupportedControl),
  );
  if (explicit.length === 1) {
    return { status: "FOUND", root: requiredValue(explicit[0]) };
  }
  if (explicit.length > 1) {
    return { status: "AMBIGUOUS", candidateCount: explicit.length };
  }

  const forms = uniqueElements([
    ...[...elementsWithin(document.documentElement, "form")].filter(
      hasSupportedControl,
    ),
    ...elementsWithin(document.documentElement, "[role='form']").filter(
      hasSupportedControl,
    ),
  ]);
  if (forms.length > 1) {
    return { status: "AMBIGUOUS", candidateCount: forms.length };
  }
  if (forms.length === 1) {
    return { status: "FOUND", root: requiredValue(forms[0]) };
  }

  const mainRegions = uniqueElements(
    elementsWithin(document.documentElement, "main,[role='main']").filter(
      hasSupportedControl,
    ),
  );
  if (mainRegions.length === 1) {
    return { status: "FOUND", root: requiredValue(mainRegions[0]) };
  }
  return mainRegions.length > 1
    ? { status: "AMBIGUOUS", candidateCount: mainRegions.length }
    : { status: "UNRESOLVED" };
}

function resolveScanBoundary(
  document: Document,
  scope: ScanScope,
): ScanBoundaryResult {
  const root = detectApplicationRoot(document);
  if (root.status === "UNRESOLVED") {
    return { status: "UNRESOLVED", candidateCount: 0 };
  }
  if (root.status === "AMBIGUOUS") {
    return {
      status: "AMBIGUOUS",
      candidateCount: root.candidateCount,
    };
  }
  if (scope.kind === "APPLICATION_ROOT") {
    return {
      status: "FOUND",
      applicationRoot: root.root,
      scanBoundary: root.root,
      candidateCount: 1,
    };
  }
  const candidates = elementsWithin(root.root, "[data-japp-scan-scope]").filter(
    (element) =>
      element.getAttribute("data-japp-scan-scope") === scope.subtreeToken,
  );
  if (candidates.length === 0) {
    return { status: "UNRESOLVED", candidateCount: 0 };
  }
  if (candidates.length > 1) {
    return { status: "AMBIGUOUS", candidateCount: candidates.length };
  }
  return {
    status: "FOUND",
    applicationRoot: root.root,
    scanBoundary: requiredValue(candidates[0]),
    candidateCount: 1,
  };
}

export function normalizeScannerText(value: string | null | undefined): string {
  return normalizeText(value);
}

export function normalizeText(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized = value
    .normalize("NFKC")
    .replaceAll(/[ßẞ]/g, "ss")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/[^A-Za-z0-9 .,:!?()'&+/@_-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 512)
    .trim();
  return NORMALIZED_TEXT_PATTERN.test(normalized) ? normalized : "";
}

async function untrustedText(
  value: string | null | undefined,
): Promise<FormFieldDescriptorV1UntrustedTextRepresentation> {
  const normalized = normalizeText(value);
  const textDigest = await semanticDigest(`untrusted-text-v1\0${normalized}`);
  return normalized !== "" && isCanonicalInertString(normalized)
    ? { normalized_text: normalized, text_digest: textDigest, untrusted: true }
    : { text_digest: textDigest, untrusted: true };
}

function directLegend(element: HTMLElement): string {
  const legend = [...element.children].find(
    (child): child is HTMLLegendElement => child instanceof HTMLLegendElement,
  );
  return normalizeText(legend?.textContent);
}

function referencedText(element: Element, attribute: string): string {
  const ids = (element.getAttribute(attribute) ?? "")
    .split(/\s+/)
    .filter((value) => value !== "");
  return normalizeText(
    ids.map((id) => localIdReference(element, id)?.textContent ?? "").join(" "),
  );
}

function nativeLabels(element: HTMLElement): string[] {
  if (!(
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  )) {
    return [];
  }
  const labels = [...(element.labels ?? [])];
  workCounters(element.ownerDocument).label_elements_examined += labels.length;
  return labels
    .map((label) => normalizeText(label.textContent))
    .filter((value) => value !== "");
}

function firstNonempty(...values: readonly string[]): string {
  return values.find((value) => value !== "") ?? "";
}

function nativeLabelSnapshot(
  document: Document,
): ReadonlyMap<HTMLElement, readonly string[]> {
  const labels = new Map<HTMLElement, string[]>();
  for (const label of document.querySelectorAll<HTMLLabelElement>("label")) {
    workCounters(document).label_elements_examined += 1;
    const control = label.control;
    if (!(
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    ))
      continue;
    const text = normalizeText(label.textContent);
    if (text === "") continue;
    const current = labels.get(control) ?? [];
    current.push(text);
    labels.set(control, current);
  }
  return labels;
}

function accessibleLabel(
  candidate: FieldCandidate,
  labelSnapshot?: ReadonlyMap<HTMLElement, readonly string[]>,
): string {
  const anchor = candidate.groupElement ?? candidate.anchor;
  if (hasAmbiguousLocalReference(anchor, "aria-labelledby")) return "";
  const labelledBy = referencedText(anchor, "aria-labelledby");
  if (labelledBy !== "") {
    return labelledBy;
  }
  const ariaLabel = normalizeText(anchor.getAttribute("aria-label"));
  if (ariaLabel !== "") {
    return ariaLabel;
  }
  if (candidate.kind === "RADIO_GROUP") {
    const legend = directLegend(anchor);
    if (legend !== "") {
      return legend;
    }
  }
  const labels =
    labelSnapshot !== undefined &&
    candidate.anchor.getRootNode() === candidate.anchor.ownerDocument
      ? (labelSnapshot.get(candidate.anchor) ?? [])
      : nativeLabels(candidate.anchor);
  if (labels.length > 0) {
    return labels.join(" ");
  }
  const wrappingLabel = normalizeText(
    candidate.anchor.closest("label")?.textContent,
  );
  if (wrappingLabel !== "") {
    return wrappingLabel;
  }
  const placeholder = normalizeText(
    candidate.anchor.getAttribute("placeholder"),
  );
  if (placeholder !== "") {
    return placeholder;
  }
  const name = normalizeText(candidate.anchor.getAttribute("name"));
  if (name !== "") {
    return name;
  }
  return normalizeText(candidate.anchor.getAttribute("role"));
}

function descriptionText(candidate: FieldCandidate): string {
  const anchor = candidate.groupElement ?? candidate.anchor;
  const describedBy = referencedText(anchor, "aria-describedby");
  if (describedBy !== "") {
    return describedBy;
  }
  return normalizeText(anchor.getAttribute("title"));
}

function sectionToken(value: string): string | null {
  const token = normalizeText(value)
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 64)
    .replaceAll(/_+$/g, "");
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(token) ? token : null;
}

const MAX_OWNERSHIP_ANCESTORS = 256;

/** A form boundary does not erase the untrusted owner of its shadow host.
 * Capture composed context once, bounded independently of root depth, and
 * refuse positive authority when its ancestry or canonical path is incomplete. */
function ownershipContext(
  candidate: FieldCandidate,
  headingCandidates: readonly HTMLElement[],
): { readonly ambiguous: boolean; readonly sections: string[] } {
  const anchor = candidate.groupElement ?? candidate.anchor;
  let ambiguous =
    hasAmbiguousLocalReference(anchor, "aria-labelledby") ||
    hasAmbiguousLocalReference(anchor, "aria-describedby");
  const ancestors: Element[] = [];
  const visited = new Set<Element>([anchor]);
  let current = composedParent(anchor);
  while (current !== null && ancestors.length < MAX_OWNERSHIP_ANCESTORS) {
    if (visited.has(current)) {
      ambiguous = true;
      break;
    }
    visited.add(current);
    ancestors.push(current);
    if (
      hasAmbiguousLocalReference(current, "aria-labelledby") ||
      hasAmbiguousLocalReference(current, "aria-describedby")
    )
      ambiguous = true;
    current = composedParent(current);
  }
  if (current !== null) ambiguous = true;

  const context: string[] = [];
  const headings = headingCandidates.filter(
    (heading) =>
      heading !== anchor &&
      heading.getRootNode() === anchor.getRootNode() &&
      (heading.compareDocumentPosition(anchor) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
  );
  const precedingHeading = headings.at(-1);
  if (precedingHeading !== undefined) {
    const token = sectionToken(precedingHeading.textContent);
    if (token !== null) context.push(token);
  }
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (
      !ancestor?.matches(
        "fieldset,section,[role='group'],[role='radiogroup'],[aria-labelledby]",
      )
    )
      continue;
    const text =
      referencedText(ancestor, "aria-labelledby") ||
      normalizeText(ancestor.getAttribute("aria-label")) ||
      (ancestor instanceof HTMLElement ? directLegend(ancestor) : "");
    const token = sectionToken(text);
    if (token !== null) context.push(token);
  }
  const sections = [...new Set(context)];
  // Canonical section paths hold at most 16 tokens. A prefix cannot erase a
  // later Employer/Recruiter token while retaining applicant-fill authority.
  if (sections.length > 16) ambiguous = true;
  return { ambiguous, sections: sections.slice(0, 16) };
}

function controlKind(element: HTMLElement): FormFieldDescriptorV1ControlKind {
  if (element instanceof HTMLInputElement) {
    if (element.getAttribute("role") === "combobox") {
      return "COMBOBOX";
    }
    switch (element.type.toLowerCase()) {
      case "checkbox":
        return "CHECKBOX";
      case "date":
        return "DATE";
      case "file":
        return "FILE";
      case "radio":
        return "RADIO_GROUP";
      default:
        return "TEXT";
    }
  }
  if (element instanceof HTMLTextAreaElement) {
    return "TEXTAREA";
  }
  if (element instanceof HTMLSelectElement) {
    return element.multiple ? "MULTI_SELECT" : "SELECT";
  }
  switch (element.getAttribute("role")) {
    case "checkbox":
      return "CHECKBOX";
    case "combobox":
      return "COMBOBOX";
    case "listbox":
      return element.getAttribute("aria-multiselectable") === "true"
        ? "MULTI_SELECT"
        : "SELECT";
    case "radiogroup":
      return "RADIO_GROUP";
    case "textbox":
      return element.getAttribute("aria-multiline") === "true"
        ? "TEXTAREA"
        : "TEXT";
    default:
      return "UNKNOWN";
  }
}

type CapturedCandidates =
  | { readonly status: "COMPLETE"; readonly candidates: FieldCandidate[] }
  | { readonly status: "CAPACITY_EXCEEDED" };

function collectCandidates(boundary: HTMLElement): CapturedCandidates {
  const started = performance.now();
  const work = workCounters(boundary.ownerDocument);
  work.candidate_enumerations += 1;
  try {
    return captureCandidateEvidence(boundary);
  } finally {
    work.candidate_enumeration_duration_us += measuredUs(started);
  }
}

function captureCandidateEvidence(boundary: HTMLElement): CapturedCandidates {
  const elements = elementsWithin(boundary, CONTROL_SELECTOR);
  if (elements.length > MAX_DESCRIPTORS_PER_FRAME)
    return { status: "CAPACITY_EXCEEDED" };
  const candidates: FieldCandidate[] = [];
  const claimedRadioMembers = new Set<HTMLElement>();

  for (const group of elements.filter(
    (element) => element.getAttribute("role") === "radiogroup",
  )) {
    const members = elementsWithin(
      group,
      "input[type='radio'],[role='radio']",
    ).slice(0, MAX_OPTIONS_PER_FIELD);
    members.forEach((member) => claimedRadioMembers.add(member));
    candidates.push({
      anchor: members[0] ?? group,
      members,
      kind: "RADIO_GROUP",
      groupElement: group,
    });
  }

  const containerIds = new WeakMap<Node, number>();
  let nextContainerId = 1;
  const radioGroups = new Map<string, FieldCandidate>();
  for (const element of elements) {
    if (
      claimedRadioMembers.has(element) ||
      element.getAttribute("role") === "radiogroup"
    ) {
      continue;
    }
    if (element instanceof HTMLInputElement && element.type === "radio") {
      const container =
        element.closest<HTMLElement>("fieldset,[role='radiogroup']") ??
        element.form ??
        element.getRootNode();
      let containerId = containerIds.get(container);
      if (containerId === undefined) {
        containerId = nextContainerId;
        nextContainerId += 1;
        containerIds.set(container, containerId);
      }
      const key = `${String(containerId)}\0${element.name || element.id}`;
      const existing = radioGroups.get(key);
      if (existing === undefined) {
        const groupElement =
          container instanceof HTMLFieldSetElement ? container : undefined;
        const group: FieldCandidate = {
          anchor: element,
          members: [element],
          kind: "RADIO_GROUP",
          ...(groupElement === undefined ? {} : { groupElement }),
        };
        radioGroups.set(key, group);
        candidates.push(group);
      } else {
        existing.members.push(element);
      }
      continue;
    }
    candidates.push({
      anchor: element,
      members: [element],
      kind: controlKind(element),
    });
  }
  return { status: "COMPLETE", candidates };
}

/**
 * W08 visibility is a property of the document layout, not of the current
 * viewport: a control is visible when it has a rendered, non-concealed box
 * inside the user-reachable scrollable area of its own document. Window
 * scroll position therefore never changes the result: an ordinary control
 * below the initial fold is visible, and an ordinary control scrolled past
 * stays visible. Concealment (hidden/aria-hidden/inert ancestry, display
 * none, visibility hidden/collapse, opacity zero, a zero-sized box) and
 * deliberate displacement into negative or otherwise unreachable document
 * coordinates remain invisible. Boxes anchored to a fixed-position element
 * (the control itself or any ancestor) do not move with window scroll, so
 * their reachable area is the viewport itself. This is a bounded feasibility
 * definition, not a layout engine: clip paths, ancestor overflow clipping,
 * nested scroll containers, and ancestors that re-anchor fixed descendants
 * through transform, filter, or containment are not modelled.
 */
function hasFixedAncestor(start: Element | null, view: Window): boolean {
  for (
    let current: Element | null = start;
    current !== null;
    current = composedParent(current)
  ) {
    if (view.getComputedStyle(current).position === "fixed") {
      return true;
    }
  }
  return false;
}

export function isElementVisible(element: HTMLElement): boolean {
  if (
    element.hidden ||
    composedClosest(element, "[hidden],[aria-hidden='true'],[inert]") !== null
  ) {
    return false;
  }
  const view = element.ownerDocument.defaultView;
  if (view === null) {
    return false;
  }
  // Chromium's native flat-tree check covers ancestor opacity/visibility
  // across slots/hosts without repeating getComputedStyle for every ancestor.
  // CSSOM View checkVisibility; geometry/reachable-area guards below remain.
  if (typeof element.checkVisibility === "function") {
    if (
      !element.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
      })
    )
      return false;
  } else {
    for (
      let ancestor = composedParent(element);
      ancestor !== null;
      ancestor = composedParent(ancestor)
    ) {
      const style = view.getComputedStyle(ancestor);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number(style.opacity) === 0
      )
        return false;
    }
  }
  const style = view.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    Number(style.opacity) === 0
  ) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  const fixed =
    style.position === "fixed" ||
    hasFixedAncestor(composedParent(element), view);
  const offsetX = fixed ? 0 : view.scrollX;
  const offsetY = fixed ? 0 : view.scrollY;
  const reachableWidth = fixed
    ? view.innerWidth
    : element.ownerDocument.documentElement.scrollWidth;
  const reachableHeight = fixed
    ? view.innerHeight
    : element.ownerDocument.documentElement.scrollHeight;
  return (
    rect.right + offsetX > 0 &&
    rect.bottom + offsetY > 0 &&
    rect.left + offsetX < reachableWidth &&
    rect.top + offsetY < reachableHeight
  );
}

function nativeDisabled(element: HTMLElement): boolean {
  return (
    (element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) &&
    element.matches(":disabled")
  );
}

export function isElementEnabled(element: HTMLElement): boolean {
  const readOnly =
    (element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement) &&
    element.readOnly;
  return (
    !nativeDisabled(element) &&
    !readOnly &&
    !(
      element.getRootNode() instanceof ShadowRoot &&
      composedClosest(element, "fieldset[disabled]") !== null
    ) &&
    composedClosest(element, "[aria-disabled='true'],[inert]") === null
  );
}

function isRequired(candidate: FieldCandidate): boolean {
  const anchor = candidate.groupElement ?? candidate.anchor;
  return (
    anchor.getAttribute("aria-required") === "true" ||
    candidate.members.some(
      (member) =>
        member.getAttribute("aria-required") === "true" ||
        ((member instanceof HTMLInputElement ||
          member instanceof HTMLSelectElement ||
          member instanceof HTMLTextAreaElement) &&
          member.required),
    )
  );
}

function optionElements(candidate: FieldCandidate): HTMLElement[] {
  const anchor = candidate.groupElement ?? candidate.anchor;
  const direct = elementsWithin(anchor, "[role='option']");
  const references = ["aria-controls", "aria-owns"].flatMap((attribute) =>
    (anchor.getAttribute(attribute) ?? "")
      .split(/\s+/)
      .filter((value) => value !== "")
      .flatMap((id) => {
        const referenced = localIdReference(anchor, id);
        return referenced === null
          ? []
          : elementsWithin(referenced, "[role='option']");
      }),
  );
  return uniqueElements([...direct, ...references]).slice(
    0,
    MAX_OPTIONS_PER_FIELD,
  );
}

async function optionEvidence(
  candidate: FieldCandidate,
): Promise<FormFieldDescriptorV1OptionSemantic[]> {
  const rawOptions: {
    value: string;
    label: string;
    disabled: boolean;
  }[] = [];
  if (candidate.anchor instanceof HTMLSelectElement) {
    for (const option of candidate.anchor.options) {
      if (rawOptions.length >= MAX_OPTIONS_PER_FIELD) {
        break;
      }
      rawOptions.push({
        value: option.value,
        label: normalizeText(option.textContent),
        disabled:
          option.disabled || option.closest("optgroup:disabled") !== null,
      });
    }
  } else if (candidate.kind === "RADIO_GROUP") {
    for (const member of candidate.members) {
      const value =
        member instanceof HTMLInputElement
          ? member.value
          : (member.getAttribute("data-value") ??
            member.getAttribute("aria-label") ??
            "");
      rawOptions.push({
        value,
        label: firstNonempty(
          nativeLabels(member)[0] ?? "",
          normalizeText(member.closest("label")?.textContent),
          normalizeText(member.getAttribute("aria-label")),
        ),
        disabled: !isElementEnabled(member),
      });
    }
  } else {
    for (const option of optionElements(candidate)) {
      rawOptions.push({
        value:
          option.getAttribute("data-value") ??
          option.getAttribute("value") ??
          normalizeText(option.textContent),
        label: firstNonempty(
          normalizeText(option.textContent),
          normalizeText(option.getAttribute("aria-label")),
        ),
        disabled:
          option.getAttribute("aria-disabled") === "true" ||
          option.hasAttribute("disabled"),
      });
    }
  }

  const options: FormFieldDescriptorV1OptionSemantic[] = [];
  const seenDigests = new Set<string>();
  for (const option of rawOptions) {
    const valueDigest = await semanticDigest(
      `option-value-v1\0${option.value}`,
    );
    if (seenDigests.has(valueDigest)) {
      continue;
    }
    seenDigests.add(valueDigest);
    const stableValueToken =
      BOUNDED_TOKEN_PATTERN.test(option.value) &&
      isCanonicalInertString(option.value)
        ? option.value
        : undefined;
    options.push({
      ...(stableValueToken === undefined
        ? {}
        : { stable_value_token: stableValueToken }),
      value_digest: valueDigest,
      label: await untrustedText(option.label),
      disabled: option.disabled,
    });
  }
  return options;
}

function applicationRootEvidence(root: HTMLElement): string {
  const heading = elementsWithin(root, HEADING_SELECTOR)[0];
  return [
    "application-root-v1",
    root.tagName.toLowerCase(),
    root.getAttribute("role") ?? "",
    normalizeText(root.getAttribute("aria-label")),
    normalizeText(heading?.textContent),
    String(elementsWithin(root, "form,[role='form']").length),
  ].join("\0");
}

function attributeEvidence(candidate: FieldCandidate): string {
  const anchor = candidate.anchor;
  const inputType =
    anchor instanceof HTMLInputElement ? anchor.type.toLowerCase() : "";
  return [
    "field-attributes-v1",
    candidate.kind,
    anchor.tagName.toLowerCase(),
    anchor.getAttribute("role") ?? "",
    inputType,
    anchor.getAttribute("name") ?? "",
    anchor.getAttribute("autocomplete") ?? "",
    anchor.getAttribute("placeholder") ?? "",
    anchor.getAttribute("aria-multiline") ?? "",
    anchor instanceof HTMLSelectElement && anchor.multiple ? "multiple" : "",
  ].join("\0");
}

async function buildDescriptor(
  candidate: FieldCandidate,
  applicationRoot: HTMLElement,
  context: ScanIdentityContext,
): Promise<FormFieldDescriptorV1> {
  const started = performance.now();
  workCounters(applicationRoot.ownerDocument).descriptor_builds_started += 1;
  try {
    return await buildDescriptorEvidence(candidate, context);
  } finally {
    workCounters(applicationRoot.ownerDocument).descriptor_duration_us +=
      measuredUs(started);
  }
}

async function buildDescriptorEvidence(
  candidate: FieldCandidate,
  context: ScanIdentityContext,
): Promise<FormFieldDescriptorV1> {
  const ownership = ownershipContext(candidate, context.headingCandidates);
  const labelText = ownership.ambiguous ? "" : accessibleLabel(candidate);
  const description = descriptionText(candidate);
  const sections = ownership.sections;
  const options = await optionEvidence(candidate);
  const accessibleNameFingerprint =
    labelText === ""
      ? undefined
      : await semanticDigest(`accessible-name-v1\0${labelText}`);
  const attributeFingerprint = await semanticDigest(
    attributeEvidence(candidate),
  );
  const optionFingerprint =
    options.length === 0
      ? undefined
      : await semanticDigest(
          `option-set-v1\0${options
            .map(
              (option) =>
                `${option.value_digest}\0${option.label.text_digest}\0${String(option.disabled)}`,
            )
            .join("\0")}`,
        );
  rememberOptionMeaningSnapshot(optionFingerprint, options);
  const resolutionHints: FormFieldAddressV1["resolution_hints"][number][] = [
    {
      kind: "CONTROL_KIND",
      value_fingerprint: await semanticDigest(
        `control-kind-v1\0${candidate.kind}`,
      ),
      stability_class: "PAGE_STABLE",
    },
    {
      kind: "ATTRIBUTE_DIGEST",
      value_fingerprint: attributeFingerprint,
      stability_class: "PAGE_STABLE",
    },
    {
      // Observation evidence bound into the W09 address digest, separately
      // checked by W10 before a new write. It is not durable target identity:
      // validation descriptions may legitimately clear after the action.
      kind: "ATTRIBUTE_DIGEST",
      value_fingerprint: await semanticDigest(
        `field-own-description-v1\0${description}`,
      ),
      stability_class: "OBSERVATION_ONLY",
    },
  ];
  if (accessibleNameFingerprint !== undefined) {
    resolutionHints.push({
      kind: "ACCESSIBLE_NAME_DIGEST",
      value_fingerprint: accessibleNameFingerprint,
      stability_class: "PAGE_STABLE",
    });
  }
  if (optionFingerprint !== undefined) {
    resolutionHints.push({
      kind: "OPTION_DIGEST",
      value_fingerprint: optionFingerprint,
      stability_class: "OBSERVATION_ONLY",
    });
  }

  const address: FormFieldAddressV1 = {
    address_schema_version: "FIELD_ADDRESS_V1",
    session_id: context.frameContext.session_id,
    frame_id: context.frameContext.frame_id,
    document_id: context.frameContext.document_id,
    ats_family: "UNKNOWN",
    route_signature: context.routeSignature,
    application_root_fingerprint: context.applicationRootFingerprint,
    section_path: sections,
    repeater_path: [],
    ...(accessibleNameFingerprint === undefined
      ? {}
      : { accessible_name_fingerprint: accessibleNameFingerprint }),
    attribute_fingerprint: attributeFingerprint,
    ...(optionFingerprint === undefined
      ? {}
      : { option_fingerprint: optionFingerprint }),
    resolution_hints: resolutionHints,
    observed_dom_generation: context.observedDomGeneration,
  };
  const fieldId = await fieldIdentityId(address);
  const label = await untrustedText(labelText);
  const descriptionEvidence =
    description === "" ? undefined : await untrustedText(description);
  return {
    field_id: fieldId,
    address,
    control_kind: candidate.kind,
    visible:
      candidate.kind === "RADIO_GROUP"
        ? candidate.members.some(isElementVisible)
        : isElementVisible(candidate.anchor),
    enabled:
      candidate.kind === "RADIO_GROUP"
        ? candidate.members.some(isElementEnabled)
        : isElementEnabled(candidate.anchor),
    required: isRequired(candidate),
    sensitive_candidate: false,
    label,
    ...(descriptionEvidence === undefined
      ? {}
      : { description: descriptionEvidence }),
    section_context: sections,
    options,
    validation_state: { state: "NOT_APPLICABLE", message_digests: [] },
    observed_at: context.observedAt,
    observed_dom_generation: context.observedDomGeneration,
  };
}

type MatchingAddress = Pick<
  FormFieldAddressV1,
  | "session_id"
  | "frame_id"
  | "ats_family"
  | "route_signature"
  | "application_root_fingerprint"
  | "section_path"
  | "repeater_path"
  | "accessible_name_fingerprint"
  | "attribute_fingerprint"
>;

async function fieldIdentityId(address: MatchingAddress): Promise<string> {
  const identitySeed = JSON.stringify({
    session_id: address.session_id,
    frame_id: address.frame_id,
    route_signature: address.route_signature,
    application_root_fingerprint: address.application_root_fingerprint,
    section_path: address.section_path,
    accessible_name_fingerprint: address.accessible_name_fingerprint,
    attribute_fingerprint: address.attribute_fingerprint,
  });
  return stableSemanticId("field", identitySeed);
}

async function matchingAddress(
  candidate: FieldCandidate,
  context: ScanIdentityContext,
  labelSnapshot: ReadonlyMap<HTMLElement, readonly string[]>,
): Promise<MatchingAddress> {
  const ownership = ownershipContext(candidate, context.headingCandidates);
  const label = ownership.ambiguous
    ? ""
    : accessibleLabel(candidate, labelSnapshot);
  return {
    session_id: context.frameContext.session_id,
    frame_id: context.frameContext.frame_id,
    ats_family: "UNKNOWN",
    route_signature: context.routeSignature,
    application_root_fingerprint: context.applicationRootFingerprint,
    section_path: ownership.sections,
    repeater_path: [],
    ...(label === ""
      ? {}
      : {
          accessible_name_fingerprint: await semanticDigest(
            `accessible-name-v1\0${label}`,
          ),
        }),
    attribute_fingerprint: await semanticDigest(attributeEvidence(candidate)),
  };
}

// This dependency set comes from collectCandidates, native .labels,
// referencedText, sectionContext, applicationRootEvidence and attributeEvidence.
// Topology/text changes anywhere can alter labels, headings or competing roots.
// State-only attributes are read in each fresh target descriptor/driver check.
const IDENTITY_ATTRIBUTES = new Set([
  "role",
  "type",
  "name",
  "id",
  "form",
  "for",
  "autocomplete",
  "placeholder",
  "aria-multiline",
  "multiple",
  "slot",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "title",
  "data-japp-application-root",
]);
interface CurrentIdentityEntry {
  readonly candidate: FieldCandidate;
  readonly identity: MatchingAddress;
  readonly fieldId: string;
}
interface CurrentSemanticIndex {
  readonly root: HTMLElement;
  readonly binding: string;
  readonly revision: number;
  readonly context: ScanIdentityContext;
  readonly entries: readonly CurrentIdentityEntry[];
  readonly exactEntries: ReadonlyMap<string, readonly CurrentIdentityEntry[]>;
  readonly allFieldIds: readonly string[];
}
interface SemanticIndexState {
  revision: number;
  evidenceRevision: number;
  index: CurrentSemanticIndex | null;
  observer: MutationObserver;
  shadowRoots: readonly ShadowRoot[];
  capacityExceeded: boolean;
  building: {
    binding: string;
    revision: number;
    promise: Promise<CurrentSemanticIndex | null>;
  } | null;
}
const semanticIndexStates = new WeakMap<Document, SemanticIndexState>();

function semanticRecords(
  state: SemanticIndexState,
  document: Document,
  records: readonly MutationRecord[],
): void {
  if (records.length > 0) state.evidenceRevision += 1;
  if (
    !records.some(
      (record) =>
        record.type !== "attributes" ||
        record.attributeName === null ||
        IDENTITY_ATTRIBUTES.has(record.attributeName),
    )
  )
    return;
  state.revision += 1;
  state.index = null;
  workCounters(document).index_invalidations += 1;
}

function semanticState(document: Document): SemanticIndexState {
  const current = semanticIndexStates.get(document);
  if (current !== undefined) return current;
  const observer = new MutationObserver((records) => {
    semanticRecords(state, document, records);
  });
  const state: SemanticIndexState = {
    revision: 0,
    evidenceRevision: 0,
    index: null,
    observer,
    shadowRoots: [],
    capacityExceeded: false,
    building: null,
  };
  // Install before the first authoritative capture, independent of W11's queue.
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  semanticIndexStates.set(document, state);
  drainSemanticRecords(state, document);
  return state;
}

function drainSemanticRecords(
  state: SemanticIndexState,
  document: Document,
): void {
  semanticRecords(state, document, state.observer.takeRecords());
  // attachShadow on an existing host has no light-DOM mutation. Fresh bounded
  // discovery is therefore mandatory even when the index otherwise hits.
  const capture = currentOpenTopology(document);
  const exceeded = capture.status === "CAPACITY_EXCEEDED";
  const roots = capture.status === "COMPLETE" ? capture.shadowRoots : [];
  if (
    state.capacityExceeded !== exceeded ||
    !sameOpenRoots(state.shadowRoots, roots)
  ) {
    state.revision += 1;
    state.evidenceRevision += 1;
    state.index = null;
    workCounters(document).index_invalidations += 1;
    state.observer.disconnect();
    state.observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    for (const root of roots)
      state.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    state.shadowRoots = roots;
    state.capacityExceeded = exceeded;
  }
}

/** Read-only proof witness: every observed mutation, including state-only
 * attributes, advances this revision without rebuilding the identity index. */
export function currentDomEvidenceRevision(document: Document): number {
  const state = semanticState(document);
  drainSemanticRecords(state, document);
  return state.evidenceRevision;
}

/** Conservative non-draining witness captured immediately after a resolved
 * target has drained current evidence. Pending records may only make a later
 * same-revision publication fence refuse; this value grants no authority. */
export function recordedDomEvidenceRevision(document: Document): number {
  return semanticState(document).evidenceRevision;
}

function semanticBinding(
  document: Document,
  frameContext: Pick<FrameContext, "session_id" | "frame_id" | "document_id">,
): string {
  return JSON.stringify([
    frameContext.session_id,
    frameContext.frame_id,
    frameContext.document_id,
    document.location.origin,
    document.location.pathname,
    currentDomGeneration(document),
  ]);
}

function currentIndexBinding(
  index: CurrentSemanticIndex,
  state: SemanticIndexState,
  document: Document,
  frameContext: Pick<FrameContext, "session_id" | "frame_id" | "document_id">,
): boolean {
  drainSemanticRecords(state, document);
  return (
    !state.capacityExceeded &&
    index.revision === state.revision &&
    index.binding === semanticBinding(document, frameContext) &&
    index.root.isConnected &&
    index.root.ownerDocument === document &&
    composedContains(document.documentElement, index.root)
  );
}

async function buildCurrentIndex(
  document: Document,
  frameContext: FrameContext,
  state: SemanticIndexState,
  binding: string,
  revision: number,
): Promise<CurrentSemanticIndex | null> {
  const started = performance.now();
  const work = workCounters(document);
  work.index_rebuilds += 1;
  try {
    const detected = detectApplicationRoot(document);
    if (detected.status !== "FOUND" || scanCapacityExceeded(detected.root))
      return null;
    const root = detected.root;
    const context: ScanIdentityContext = {
      frameContext,
      routeSignature: await semanticDigest(
        `route-v1\0${document.location.origin}${document.location.pathname}`,
      ),
      applicationRootFingerprint: await semanticDigest(
        applicationRootEvidence(root),
      ),
      observedAt: new Date().toISOString(),
      observedDomGeneration: currentDomGeneration(document),
      headingCandidates: elementsWithin(root, HEADING_SELECTOR),
    };
    const captured = collectCandidates(root);
    if (captured.status === "CAPACITY_EXCEEDED" || scanCapacityExceeded(root))
      return null;
    const labels = nativeLabelSnapshot(document);
    work.nodes_examined += 1 + root.querySelectorAll("*").length;
    work.candidates_examined += captured.candidates.length;
    work.identity_pairs_examined += captured.candidates.length;
    const matchingStarted = performance.now();
    const entries: CurrentIdentityEntry[] = [];
    for (const candidate of captured.candidates) {
      const identity = await matchingAddress(candidate, context, labels);
      entries.push({
        candidate,
        identity,
        fieldId: await fieldIdentityId(identity),
      });
    }
    work.identity_matching_duration_us += measuredUs(matchingStarted);
    const exactEntries = new Map<string, CurrentIdentityEntry[]>();
    for (const entry of entries) {
      const key = exactIdentityKey(entry.identity);
      if (key === null) continue;
      const group = exactEntries.get(key) ?? [];
      group.push(entry);
      exactEntries.set(key, group);
    }
    const index: CurrentSemanticIndex = {
      root,
      binding,
      revision,
      context,
      entries,
      exactEntries,
      allFieldIds: entries.map((entry) => entry.fieldId),
    };
    if (!currentIndexBinding(index, state, document, frameContext)) return null;
    return index;
  } finally {
    work.index_rebuild_duration_us += measuredUs(started);
  }
}

async function currentSemanticIndex(
  document: Document,
  frameContext: FrameContext,
  state: SemanticIndexState,
): Promise<CurrentSemanticIndex | null> {
  const current = state.index;
  // A cache hit performs the fresh drain inside currentIndexBinding. There
  // is no await between reading this hint and that check, so draining twice
  // would only repeat the same host checks in one synchronous boundary.
  if (current === null) drainSemanticRecords(state, document);
  if (
    current !== null &&
    currentIndexBinding(current, state, document, frameContext)
  ) {
    workCounters(document).index_hits += 1;
    return current;
  }
  state.index = null;
  const binding = semanticBinding(document, frameContext);
  const revision = state.revision;
  const pending = state.building;
  if (
    pending !== null &&
    pending.binding === binding &&
    pending.revision === revision
  )
    return pending.promise;
  const building = {
    binding,
    revision,
    promise: buildCurrentIndex(
      document,
      frameContext,
      state,
      binding,
      revision,
    ),
  };
  state.building = building;
  try {
    const index = await building.promise;
    // A superseded concurrent builder may never overwrite newer evidence.
    if (
      state.building !== building ||
      index === null ||
      !currentIndexBinding(index, state, document, frameContext)
    )
      return null;
    state.index = index;
    return index;
  } finally {
    if (state.building === building) state.building = null;
  }
}

export interface ScannedFieldPair {
  readonly candidate: FieldCandidate;
  readonly descriptor: FormFieldDescriptorV1;
}

export async function scanCandidatePairs(
  document: Document,
  applicationRoot: HTMLElement,
  scanBoundary: HTMLElement,
  frameContext: FrameContext,
): Promise<
  | { readonly status: "COMPLETE"; readonly pairs: ScannedFieldPair[] }
  | { readonly status: "CAPACITY_EXCEEDED" }
> {
  if (scanCapacityExceeded(applicationRoot))
    return { status: "CAPACITY_EXCEEDED" };
  const started = performance.now();
  const work = workCounters(document);
  noteGeneration(document);
  const scanPurpose = scanBoundary === applicationRoot ? "root" : "subtree";
  work[scanPurpose === "root" ? "root_scan_calls" : "subtree_scan_calls"] += 1;
  work.scan_calls += 1;
  work.nodes_examined += 1 + scanBoundary.querySelectorAll("*").length;
  const context: ScanIdentityContext = {
    frameContext,
    routeSignature: await semanticDigest(
      `route-v1\0${document.location.origin}${document.location.pathname}`,
    ),
    applicationRootFingerprint: await semanticDigest(
      applicationRootEvidence(applicationRoot),
    ),
    observedAt: new Date().toISOString(),
    observedDomGeneration: currentDomGeneration(document),
    headingCandidates: elementsWithin(applicationRoot, HEADING_SELECTOR),
  };
  // Preserve refusal from the actual synchronous candidate capture even if
  // a transient oversized root shrinks during later asynchronous hashing.
  const captured = collectCandidates(scanBoundary);
  if (
    captured.status === "CAPACITY_EXCEEDED" ||
    scanCapacityExceeded(applicationRoot)
  ) {
    work.total_duration_us += measuredUs(started);
    return { status: "CAPACITY_EXCEEDED" };
  }
  const candidates = captured.candidates;
  work.candidates_examined += candidates.length;
  const pairs: ScannedFieldPair[] = [];
  for (const candidate of candidates) {
    pairs.push({
      candidate,
      descriptor: await buildDescriptor(candidate, applicationRoot, context),
    });
    work.descriptors_built += 1;
  }
  work.total_duration_us += measuredUs(started);
  work[
    scanPurpose === "root"
      ? "root_scan_duration_us"
      : "subtree_scan_duration_us"
  ] += measuredUs(started);
  return { status: "COMPLETE", pairs };
}

async function scanDescriptors(
  document: Document,
  applicationRoot: HTMLElement,
  scanBoundary: HTMLElement,
  frameContext: FrameContext,
): Promise<
  | {
      readonly status: "COMPLETE";
      readonly descriptors: FormFieldDescriptorV1[];
    }
  | { readonly status: "CAPACITY_EXCEEDED" }
> {
  const result = await scanCandidatePairs(
    document,
    applicationRoot,
    scanBoundary,
    frameContext,
  );
  return result.status === "CAPACITY_EXCEEDED"
    ? result
    : {
        status: "COMPLETE",
        descriptors: result.pairs.map((pair) => pair.descriptor),
      };
}

export async function scanFrameDocument(
  document: Document,
  frameContext: FrameContext,
  request: ScanFrameRequest,
): Promise<FrameScanReport> {
  if (request.expected_document_id !== frameContext.document_id) {
    return {
      kind: FRAME_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: request.requestId,
      frame_context: frameContext,
      root_status: "UNAVAILABLE",
      root_candidate_count: 0,
      scan_boundary: request.scope.kind,
      descriptors: [],
    };
  }
  // The existing closed capacity-refusal wire shape requires count 1; this
  // marker does not assert that an overflowing document has one actual root.
  if (currentOpenTopology(document).status === "CAPACITY_EXCEEDED")
    return {
      kind: FRAME_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: request.requestId,
      frame_context: frameContext,
      root_status: "CAPACITY_EXCEEDED",
      root_candidate_count: 1,
      scan_boundary: request.scope.kind,
      descriptors: [],
    };
  const boundary = resolveScanBoundary(document, request.scope);
  if (
    boundary.status !== "FOUND" ||
    boundary.applicationRoot === undefined ||
    boundary.scanBoundary === undefined
  ) {
    return {
      kind: FRAME_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: request.requestId,
      frame_context: frameContext,
      root_status: boundary.status,
      root_candidate_count: boundary.candidateCount,
      scan_boundary: request.scope.kind,
      descriptors: [],
    };
  }
  if (scanCapacityExceeded(boundary.applicationRoot)) {
    return {
      kind: FRAME_SCAN_RESULT_KIND,
      protocolVersion: SCANNER_PROTOCOL_VERSION,
      requestId: request.requestId,
      frame_context: frameContext,
      root_status: "CAPACITY_EXCEEDED",
      root_candidate_count: 1,
      scan_boundary: request.scope.kind,
      descriptors: [],
    };
  }
  const scan = await scanDescriptors(
    document,
    boundary.applicationRoot,
    boundary.scanBoundary,
    frameContext,
  );
  const exceeded =
    scan.status === "CAPACITY_EXCEEDED" ||
    scanCapacityExceeded(boundary.applicationRoot);
  return {
    kind: FRAME_SCAN_RESULT_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
    requestId: request.requestId,
    frame_context: frameContext,
    root_status: exceeded ? "CAPACITY_EXCEEDED" : CONTENT_FRAME_SCAN_FOUND,
    root_candidate_count: 1,
    scan_boundary: request.scope.kind,
    descriptors: exceeded ? [] : scan.descriptors,
  };
}

function sameList(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Full semantic signals permit an exact indexed lookup. Addresses omitting
 * optional evidence keep the original wildcard matching path. The map retains
 * every duplicate; it never chooses a node or substitutes DOM position. */
function exactIdentityKey(address: MatchingAddress): string | null {
  if (
    address.route_signature === undefined ||
    address.application_root_fingerprint === undefined ||
    address.accessible_name_fingerprint === undefined ||
    address.attribute_fingerprint === undefined
  )
    return null;
  return JSON.stringify([
    address.ats_family,
    address.route_signature,
    address.application_root_fingerprint,
    address.accessible_name_fingerprint,
    address.attribute_fingerprint,
    address.section_path,
    address.repeater_path,
  ]);
}

function addressMatches(
  observed: FormFieldAddressV1,
  current: MatchingAddress,
): boolean {
  // OPTION_DIGEST is explicitly OBSERVATION_ONLY. A windowed listbox changes
  // its mounted option inventory during ordinary scrolling, so that evidence
  // cannot be durable resolution authority. The control-specific W10 driver
  // still requires the exact current intended option immediately before its
  // action. Page-stable address signals remain mandatory here.
  return (
    observed.ats_family === current.ats_family &&
    (observed.route_signature === undefined ||
      observed.route_signature === current.route_signature) &&
    (observed.application_root_fingerprint === undefined ||
      observed.application_root_fingerprint ===
        current.application_root_fingerprint) &&
    (observed.accessible_name_fingerprint === undefined ||
      observed.accessible_name_fingerprint ===
        current.accessible_name_fingerprint) &&
    (observed.attribute_fingerprint === undefined ||
      observed.attribute_fingerprint === current.attribute_fingerprint) &&
    sameList(observed.section_path, current.section_path) &&
    sameList(observed.repeater_path, current.repeater_path)
  );
}

/**
 * A live driver target: the W08-matched candidate's real elements plus its
 * freshly built canonical descriptor. Element references NEVER cross the
 * extension protocol; this type exists only inside the frame agent so
 * M02-W10 drivers can act on the exact control the accepted W08 semantics
 * re-resolved immediately before the action.
 */
export interface ResolvedFieldTarget {
  readonly anchor: HTMLElement;
  readonly members: readonly HTMLElement[];
  readonly groupElement?: HTMLElement;
  readonly descriptor: FormFieldDescriptorV1;
  readonly applicationRoot: HTMLElement;
  /** field_id of every control in the current scan, for conditional diffs. */
  readonly allFieldIds: readonly string[];
}

// Each target is a fresh W08 unique match bound to one immutable index.
// This weak binding grants no authority after any observed identity/topology
// invalidation and avoids re-comparing the entire address list synchronously.
const resolvedTargetIndexes = new WeakMap<
  ResolvedFieldTarget,
  CurrentSemanticIndex
>();

export type FieldTargetResolution =
  | { readonly status: "RESOLVED"; readonly target: ResolvedFieldTarget }
  | {
      readonly status: "UNRESOLVED";
      readonly reason: "STALE_DOCUMENT" | "STALE_APPLICATION_ROOT" | "NO_MATCH";
    }
  | { readonly status: "AMBIGUOUS"; readonly candidateCount: number };

/**
 * The single W08 current-document re-resolution: identical matching
 * semantics for the wire re-resolution and for every W10 driver action.
 * Zero, multiple, or stale matches never yield a target.
 */
export async function resolveFieldTarget(
  document: Document,
  frameContext: FrameContext,
  address: FormFieldAddressV1,
  purpose: ResolutionPurpose = "other",
): Promise<FieldTargetResolution> {
  noteGeneration(document);
  const purposeWork = workCounters(document);
  purposeWork.reresolution_calls += 1;
  purposeWork[`${purpose}_reresolutions`] += 1;
  if (
    address.session_id !== frameContext.session_id ||
    address.frame_id !== frameContext.frame_id ||
    address.document_id !== frameContext.document_id
  ) {
    return { status: "UNRESOLVED", reason: "STALE_DOCUMENT" };
  }
  const started = performance.now();
  const work = workCounters(document);
  work.scan_calls += 1;
  try {
    const state = semanticState(document);
    const index = await currentSemanticIndex(document, frameContext, state);
    if (
      index === null ||
      !currentIndexBinding(index, state, document, frameContext)
    ) {
      return { status: "UNRESOLVED", reason: "STALE_APPLICATION_ROOT" };
    }
    const exactKey = exactIdentityKey(address);
    const candidates =
      exactKey === null
        ? index.entries
        : (index.exactEntries.get(exactKey) ?? []);
    const matches = candidates.filter((entry) => {
      work.semantic_match_checks += 1;
      return addressMatches(address, entry.identity);
    });
    if (matches.length === 0)
      return { status: "UNRESOLVED", reason: "NO_MATCH" };
    if (matches.length > 1)
      return { status: "AMBIGUOUS", candidateCount: matches.length };
    const match = requiredValue(matches[0]);
    // Cached nodes are candidate hints only. Fresh current semantic/state
    // evidence and observer coverage are mandatory on EVERY resolution.
    const descriptor = await buildDescriptor(match.candidate, index.root, {
      ...index.context,
      observedAt: new Date().toISOString(),
      observedDomGeneration: currentDomGeneration(document),
      headingCandidates: index.context.headingCandidates,
    });
    work.descriptors_built += 1;
    if (
      !currentIndexBinding(index, state, document, frameContext) ||
      !match.candidate.anchor.isConnected ||
      !composedContains(index.root, match.candidate.anchor) ||
      !addressMatches(address, descriptor.address)
    ) {
      return { status: "UNRESOLVED", reason: "NO_MATCH" };
    }
    const target: ResolvedFieldTarget = {
      anchor: match.candidate.anchor,
      members: match.candidate.members,
      ...(match.candidate.groupElement === undefined
        ? {}
        : { groupElement: match.candidate.groupElement }),
      descriptor,
      applicationRoot: index.root,
      allFieldIds: [...index.allFieldIds],
    };
    resolvedTargetIndexes.set(target, index);
    return { status: "RESOLVED", target };
  } finally {
    work.total_duration_us += measuredUs(started);
    work[`${purpose}_reresolution_duration_us`] += measuredUs(started);
  }
}

/** W09 approves the observed own-description, not a future ownership change.
 * This reserved observation-only attribute hint preserves canonical grammar
 * while ordinary semantic target re-resolution ignores transient messages. */
export function ownDescriptionObservation(
  address: FormFieldAddressV1,
): string | null {
  const hints = address.resolution_hints.filter(
    (hint) =>
      hint.kind === "ATTRIBUTE_DIGEST" &&
      hint.stability_class === "OBSERVATION_ONLY",
  );
  return hints.length === 1 ? (hints[0]?.value_fingerprint ?? null) : null;
}
export function descriptionApprovalMatches(
  approved: FormFieldAddressV1,
  current: FormFieldAddressV1,
): boolean {
  const before = ownDescriptionObservation(approved);
  return before !== null && before === ownDescriptionObservation(current);
}

/** Last synchronous guard after an awaited driver precondition. Cached node
 * references are never action authority: drain every observed tree and
 * rediscover roots before the native text action can execute. */
export function targetIsCurrent(
  document: Document,
  target: ResolvedFieldTarget,
  expectedEvidenceRevision?: number,
): boolean {
  const frameContext = target.descriptor.address;
  const state = semanticState(document);
  const index = state.index;
  if (
    index === null ||
    !currentIndexBinding(index, state, document, frameContext)
  )
    return false;
  return (
    resolvedTargetIndexes.get(target) === index &&
    (expectedEvidenceRevision === undefined ||
      state.evidenceRevision === expectedEvidenceRevision) &&
    target.anchor.isConnected &&
    composedContains(index.root, target.anchor)
  );
}

export async function reresolveFrameAddress(
  document: Document,
  frameContext: FrameContext,
  request: ReresolveFrameRequest,
): Promise<FrameReresolutionResult> {
  const resolved = await resolveFieldTarget(
    document,
    frameContext,
    request.address,
  );
  const resolution: FieldResolution =
    resolved.status === "RESOLVED"
      ? { status: "RESOLVED", descriptor: resolved.target.descriptor }
      : resolved.status === "AMBIGUOUS"
        ? { status: "AMBIGUOUS", candidate_count: resolved.candidateCount }
        : { status: "UNRESOLVED", reason: resolved.reason };
  return {
    kind: FRAME_RERESOLUTION_RESULT_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
    requestId: request.requestId,
    frame_context: frameContext,
    resolution,
  };
}
