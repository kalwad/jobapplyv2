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
const OBSERVED_DOM_GENERATION = 0;

interface FieldCandidate {
  readonly anchor: HTMLElement;
  readonly members: HTMLElement[];
  readonly kind: FormFieldDescriptorV1ControlKind;
  readonly groupElement?: HTMLElement;
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
}

function elementsWithin(root: Element, selector: string): HTMLElement[] {
  const elements: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(selector)) {
    elements.push(root);
  }
  elements.push(...root.querySelectorAll<HTMLElement>(selector));
  return elements;
}

function hasSupportedControl(root: Element): boolean {
  return elementsWithin(root, CONTROL_SELECTOR).length > 0;
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
    ...[...document.forms].filter(hasSupportedControl),
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

function normalizeText(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized = value
    .normalize("NFKC")
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

function referencedText(element: HTMLElement, attribute: string): string {
  const ids = (element.getAttribute(attribute) ?? "")
    .split(/\s+/)
    .filter((value) => value !== "");
  return normalizeText(
    ids
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" "),
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
  return [...(element.labels ?? [])]
    .map((label) => normalizeText(label.textContent))
    .filter((value) => value !== "");
}

function firstNonempty(...values: readonly string[]): string {
  return values.find((value) => value !== "") ?? "";
}

function accessibleLabel(candidate: FieldCandidate): string {
  const anchor = candidate.groupElement ?? candidate.anchor;
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
  const labels = nativeLabels(candidate.anchor);
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

function sectionContext(
  candidate: FieldCandidate,
  applicationRoot: HTMLElement,
): string[] {
  const context: string[] = [];
  const anchor = candidate.groupElement ?? candidate.anchor;
  const headings = elementsWithin(applicationRoot, HEADING_SELECTOR).filter(
    (heading) =>
      heading !== anchor &&
      (heading.compareDocumentPosition(anchor) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
  );
  const precedingHeading = headings.at(-1);
  if (precedingHeading !== undefined) {
    const token = sectionToken(precedingHeading.textContent);
    if (token !== null) {
      context.push(token);
    }
  }

  const ancestors: HTMLElement[] = [];
  let current = anchor.parentElement;
  while (current !== null && applicationRoot.contains(current)) {
    if (
      current.matches(
        "fieldset,section,[role='group'],[role='radiogroup'],[aria-labelledby]",
      )
    ) {
      ancestors.unshift(current);
    }
    if (current === applicationRoot) {
      break;
    }
    current = current.parentElement;
  }
  for (const ancestor of ancestors) {
    const text =
      referencedText(ancestor, "aria-labelledby") ||
      normalizeText(ancestor.getAttribute("aria-label")) ||
      directLegend(ancestor);
    const token = sectionToken(text);
    if (token !== null) {
      context.push(token);
    }
  }
  return [...new Set(context)].slice(0, 16);
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

function collectCandidates(boundary: HTMLElement): FieldCandidate[] {
  const elements = elementsWithin(boundary, CONTROL_SELECTOR).slice(
    0,
    MAX_DESCRIPTORS_PER_FRAME,
  );
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

  const containerIds = new WeakMap<Element, number>();
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
        boundary;
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
  return candidates;
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
function hasFixedAncestor(start: HTMLElement | null, view: Window): boolean {
  for (let current = start; current !== null; current = current.parentElement) {
    if (view.getComputedStyle(current).position === "fixed") {
      return true;
    }
  }
  return false;
}

export function isElementVisible(element: HTMLElement): boolean {
  if (
    element.hidden ||
    element.closest("[hidden],[aria-hidden='true'],[inert]") !== null
  ) {
    return false;
  }
  const view = element.ownerDocument.defaultView;
  if (view === null) {
    return false;
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
    style.position === "fixed" || hasFixedAncestor(element.parentElement, view);
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
    element.closest("[aria-disabled='true'],[inert]") === null
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
        const referenced = anchor.ownerDocument.getElementById(id);
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
  const labelText = accessibleLabel(candidate);
  const description = descriptionText(candidate);
  const sections = sectionContext(candidate, applicationRoot);
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
    observed_dom_generation: OBSERVED_DOM_GENERATION,
  };
  const identitySeed = JSON.stringify({
    session_id: address.session_id,
    frame_id: address.frame_id,
    route_signature: address.route_signature,
    application_root_fingerprint: address.application_root_fingerprint,
    section_path: address.section_path,
    accessible_name_fingerprint: address.accessible_name_fingerprint,
    attribute_fingerprint: address.attribute_fingerprint,
  });
  const label = await untrustedText(labelText);
  const descriptionEvidence =
    description === "" ? undefined : await untrustedText(description);
  return {
    field_id: await stableSemanticId("field", identitySeed),
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
    // M02-W09 owns sensitivity classification. W08 records no ontology claim.
    sensitive_candidate: false,
    label,
    ...(descriptionEvidence === undefined
      ? {}
      : { description: descriptionEvidence }),
    section_context: sections,
    options,
    validation_state: { state: "NOT_APPLICABLE", message_digests: [] },
    observed_at: context.observedAt,
    observed_dom_generation: OBSERVED_DOM_GENERATION,
  };
}

interface ScannedFieldPair {
  readonly candidate: FieldCandidate;
  readonly descriptor: FormFieldDescriptorV1;
}

async function scanCandidatePairs(
  document: Document,
  applicationRoot: HTMLElement,
  scanBoundary: HTMLElement,
  frameContext: FrameContext,
): Promise<ScannedFieldPair[]> {
  const context: ScanIdentityContext = {
    frameContext,
    routeSignature: await semanticDigest(
      `route-v1\0${document.location.origin}${document.location.pathname}`,
    ),
    applicationRootFingerprint: await semanticDigest(
      applicationRootEvidence(applicationRoot),
    ),
    observedAt: new Date().toISOString(),
  };
  const candidates = collectCandidates(scanBoundary);
  const pairs: ScannedFieldPair[] = [];
  for (const candidate of candidates) {
    pairs.push({
      candidate,
      descriptor: await buildDescriptor(candidate, applicationRoot, context),
    });
  }
  return pairs;
}

async function scanDescriptors(
  document: Document,
  applicationRoot: HTMLElement,
  scanBoundary: HTMLElement,
  frameContext: FrameContext,
): Promise<FormFieldDescriptorV1[]> {
  const pairs = await scanCandidatePairs(
    document,
    applicationRoot,
    scanBoundary,
    frameContext,
  );
  return pairs.map((pair) => pair.descriptor);
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
  return {
    kind: FRAME_SCAN_RESULT_KIND,
    protocolVersion: SCANNER_PROTOCOL_VERSION,
    requestId: request.requestId,
    frame_context: frameContext,
    root_status: CONTENT_FRAME_SCAN_FOUND,
    root_candidate_count: 1,
    scan_boundary: request.scope.kind,
    descriptors: await scanDescriptors(
      document,
      boundary.applicationRoot,
      boundary.scanBoundary,
      frameContext,
    ),
  };
}

function sameList(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addressMatches(
  observed: FormFieldAddressV1,
  current: FormFieldAddressV1,
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
): Promise<FieldTargetResolution> {
  if (
    address.session_id !== frameContext.session_id ||
    address.frame_id !== frameContext.frame_id ||
    address.document_id !== frameContext.document_id
  ) {
    return { status: "UNRESOLVED", reason: "STALE_DOCUMENT" };
  }
  const root = detectApplicationRoot(document);
  if (root.status !== "FOUND") {
    return { status: "UNRESOLVED", reason: "STALE_APPLICATION_ROOT" };
  }
  const pairs = await scanCandidatePairs(
    document,
    root.root,
    root.root,
    frameContext,
  );
  const matches = pairs.filter((pair) =>
    addressMatches(address, pair.descriptor.address),
  );
  if (matches.length === 0) {
    return { status: "UNRESOLVED", reason: "NO_MATCH" };
  }
  if (matches.length > 1) {
    return { status: "AMBIGUOUS", candidateCount: matches.length };
  }
  const match = requiredValue(matches[0]);
  return {
    status: "RESOLVED",
    target: {
      anchor: match.candidate.anchor,
      members: match.candidate.members,
      ...(match.candidate.groupElement === undefined
        ? {}
        : { groupElement: match.candidate.groupElement }),
      descriptor: match.descriptor,
      applicationRoot: root.root,
      allFieldIds: pairs.map((pair) => pair.descriptor.field_id),
    },
  };
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
