// W14 supported open-shadow boundary. These helpers discover current DOM
// evidence; no node handle, root order or selector becomes durable identity.
// Closed roots and custom shadow widgets have no support claim.
export const MAX_OPEN_TREE_ELEMENTS = 16_384;
export const MAX_OPEN_SHADOW_ROOTS = 64;
export const MAX_OPEN_SHADOW_DEPTH = 8;

export type OpenTreeCapture =
  | {
      readonly status: "COMPLETE";
      readonly elements: readonly Element[];
      readonly shadowRoots: readonly ShadowRoot[];
    }
  | { readonly status: "CAPACITY_EXCEEDED" };

/** Physical DOM traversal, including each reachable open root exactly once.
 * Element/root/depth limits refuse the whole capture; never return a prefix. */
function captureOpenTreeEvidence(
  root: Element | Document | ShadowRoot,
): OpenTreeCapture {
  const started = performance.now();
  const document = root instanceof Document ? root : root.ownerDocument;
  const metrics = work(document);
  try {
    const elements: Element[] = [];
    const shadowRoots: ShadowRoot[] = [];
    const stack: { element: Element; depth: number }[] = [];
    function pushChildren(
      parent: Element | Document | ShadowRoot,
      depth: number,
    ): boolean {
      // Push in reverse physical order without allocating an unbounded child array.
      for (
        let element = parent.lastElementChild;
        element !== null;
        element = element.previousElementSibling
      ) {
        if (stack.length + elements.length >= MAX_OPEN_TREE_ELEMENTS)
          return false;
        stack.push({ element, depth });
      }
      return true;
    }
    if (root instanceof Element) stack.push({ element: root, depth: 0 });
    else if (!pushChildren(root, 0)) return { status: "CAPACITY_EXCEEDED" };
    while (stack.length > 0) {
      const item = stack.pop();
      if (item === undefined) break;
      elements.push(item.element);
      metrics.topology_nodes_visited += 1;
      if (elements.length > MAX_OPEN_TREE_ELEMENTS)
        return { status: "CAPACITY_EXCEEDED" };
      if (!pushChildren(item.element, item.depth))
        return { status: "CAPACITY_EXCEEDED" };
      const shadow = item.element.shadowRoot;
      if (shadow !== null) {
        shadowRoots.push(shadow);
        if (
          shadowRoots.length > MAX_OPEN_SHADOW_ROOTS ||
          item.depth >= MAX_OPEN_SHADOW_DEPTH
        )
          return { status: "CAPACITY_EXCEEDED" };
        if (!pushChildren(shadow, item.depth + 1))
          return { status: "CAPACITY_EXCEEDED" };
      }
      if (stack.length + elements.length > MAX_OPEN_TREE_ELEMENTS)
        return { status: "CAPACITY_EXCEEDED" };
    }
    return { status: "COMPLETE", elements, shadowRoots };
  } finally {
    metrics.topology_duration_us += Math.max(
      0,
      Math.ceil((performance.now() - started) * 1000),
    );
  }
}

export function captureOpenTree(
  root: Element | Document | ShadowRoot,
): OpenTreeCapture {
  const document = root instanceof Document ? root : root.ownerDocument;
  const metrics = work(document);
  metrics[
    root instanceof Document || root === document.documentElement
      ? "topology_full_captures"
      : "topology_subtree_captures"
  ] += 1;
  // Count every visited prefix node even when a bound refuses the result.
  const result = captureOpenTreeEvidence(root);
  if (result.status === "CAPACITY_EXCEEDED")
    metrics.topology_capacity_refusals += 1;
  return result;
}

export function composedParent(element: Element): Element | null {
  if (element.assignedSlot !== null) return element.assignedSlot;
  if (element.parentElement !== null) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.mode === "open" ? root.host : null;
}

export function composedContains(parent: Element, child: Element): boolean {
  for (
    let current: Element | null = child;
    current !== null;
    current = composedParent(current)
  )
    if (current === parent) return true;
  return false;
}

export function composedClosest(
  element: Element,
  selector: string,
): Element | null {
  for (
    let current: Element | null = element;
    current !== null;
    current = composedParent(current)
  )
    if (current.matches(selector)) return current;
  return null;
}

/** IDREFs are local to the control's tree. Shadow IDs must never resolve
 * to unrelated document IDs or another root; duplicate local IDs abstain. */
export function localIdReference(element: Element, id: string): Element | null {
  const root = element.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot)) return null;
  const matches = registry(element.ownerDocument).matches(root, id);
  return matches?.length === 1 ? (matches[0] ?? null) : null;
}
export function hasAmbiguousLocalReference(
  element: Element,
  attribute: string,
): boolean {
  const raw = element.getAttribute(attribute) ?? "";
  if (raw === "") return false;
  if (raw.length > 4096) return true;
  const ids = raw.split(/\s+/).filter(Boolean);
  if (ids.length > 32) return true;
  const root = element.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot)) return true;
  return ids.some((id) => {
    const matches = registry(element.ownerDocument).matches(root, id);
    return matches === null || matches.length > 1;
  });
}

export function sameOpenRoots(
  left: readonly ShadowRoot[],
  right: readonly ShadowRoot[],
): boolean {
  return (
    left.length === right.length && left.every((root, i) => root === right[i])
  );
}

export const TOPOLOGY_WORK_KEYS = [
  "topology_full_captures",
  "topology_subtree_captures",
  "topology_nodes_visited",
  "topology_host_checks",
  "topology_roots_discovered",
  "topology_capacity_refusals",
  "topology_duration_us",
] as const;
type TopologyWork = Record<(typeof TOPOLOGY_WORK_KEYS)[number], number>;
const topologyWork = new WeakMap<Document, TopologyWork>();
function work(document: Document): TopologyWork {
  let value = topologyWork.get(document);
  if (value === undefined) {
    value = Object.fromEntries(
      TOPOLOGY_WORK_KEYS.map((key) => [key, 0]),
    ) as TopologyWork;
    topologyWork.set(document, value);
  }
  return value;
}
export function topologyWorkMetrics(
  document: Document,
): Readonly<TopologyWork> {
  return { ...work(document) };
}

const SHADOW_HOST_TAGS = new Set([
  "article",
  "aside",
  "blockquote",
  "body",
  "div",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "main",
  "nav",
  "p",
  "section",
  "span",
]);
function absoluteShadowDepth(root: ShadowRoot): number {
  let depth = 1;
  for (
    let parent = root.host.getRootNode();
    parent instanceof ShadowRoot;
    parent = parent.host.getRootNode()
  ) {
    depth += 1;
    if (depth > MAX_OPEN_SHADOW_DEPTH) break;
  }
  return depth;
}
function possibleHost(element: Element): boolean {
  return (
    element instanceof HTMLElement &&
    (SHADOW_HOST_TAGS.has(element.localName) || element.localName.includes("-"))
  );
}
export type OpenTopologySnapshot =
  | {
      readonly status: "COMPLETE";
      readonly shadowRoots: readonly ShadowRoot[];
      readonly elementCount: number;
    }
  | { readonly status: "CAPACITY_EXCEEDED" };

/** One bounded physical-topology registry per document. Full discovery runs
 * initially or for explicit overflow recovery. Child-list records update only
 * their affected added/removed subtrees; current host hints discover otherwise
 * silent attachShadow calls without enumerating the full DOM again. */
class OpenTopologyRegistry {
  readonly #document: Document;
  readonly #elements = new Set<Element>();
  readonly #hosts = new Set<Element>();
  readonly #roots = new Set<ShadowRoot>();
  readonly #ids = new Map<Document | ShadowRoot, Map<string, Set<Element>>>();
  readonly #observer: MutationObserver;
  #memberships = new WeakMap<
    Element,
    { root: Document | ShadowRoot; id: string }
  >();
  #exceeded = false;
  constructor(document: Document) {
    this.#document = document;
    this.#observer = new MutationObserver((records) => {
      this.#records(records);
    });
    this.#observe(document);
    this.#rebuild();
  }
  #observe(root: Document | ShadowRoot): void {
    this.#observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["id"],
      attributeOldValue: true,
    });
  }
  #id(element: Element, remove = false): void {
    const previous = this.#memberships.get(element);
    if (previous !== undefined) {
      const ids = this.#ids.get(previous.root);
      const matches = ids?.get(previous.id);
      matches?.delete(element);
      if (matches?.size === 0) ids?.delete(previous.id);
      this.#memberships.delete(element);
    }
    if (
      remove ||
      element.id === "" ||
      !element.isConnected ||
      !this.#elements.has(element)
    )
      return;
    const root = element.getRootNode();
    if (!(root instanceof Document || root instanceof ShadowRoot)) return;
    let ids = this.#ids.get(root);
    if (ids === undefined) {
      ids = new Map();
      this.#ids.set(root, ids);
    }
    const matches = ids.get(element.id) ?? new Set<Element>();
    matches.add(element);
    ids.set(element.id, matches);
    this.#memberships.set(element, { root, id: element.id });
  }

  #add(capture: OpenTreeCapture): void {
    if (capture.status !== "COMPLETE") {
      this.#exceeded = true;
      return;
    }
    for (const element of capture.elements) {
      if (this.#elements.has(element)) continue;
      if (this.#elements.size >= MAX_OPEN_TREE_ELEMENTS) {
        this.#exceeded = true;
        return;
      }
      this.#elements.add(element);
      if (possibleHost(element)) this.#hosts.add(element);
      this.#id(element);
    }
    for (const root of capture.shadowRoots) {
      if (
        absoluteShadowDepth(root) > MAX_OPEN_SHADOW_DEPTH ||
        (!this.#roots.has(root) && this.#roots.size >= MAX_OPEN_SHADOW_ROOTS)
      ) {
        this.#exceeded = true;
        return;
      }
      if (!this.#roots.has(root))
        work(this.#document).topology_roots_discovered += 1;
      this.#roots.add(root);
      this.#observe(root);
    }
    if (this.#roots.size > MAX_OPEN_SHADOW_ROOTS) this.#exceeded = true;
  }
  #rebuild(): void {
    this.#elements.clear();
    this.#hosts.clear();
    this.#roots.clear();
    this.#ids.clear();
    this.#memberships = new WeakMap();
    this.#exceeded = false;
    this.#observer.disconnect();
    this.#observe(this.#document);
    this.#add(captureOpenTree(this.#document));
  }
  #records(records: readonly MutationRecord[]): void {
    let rootsRemoved = false;
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof Element) {
        this.#id(record.target);
        continue;
      }
      for (const node of record.removedNodes) {
        if (!(node instanceof Element)) continue;
        const capture = captureOpenTree(node);
        if (capture.status !== "COMPLETE") {
          this.#exceeded = true;
          continue;
        }
        for (const element of capture.elements) {
          this.#elements.delete(element);
          if (element instanceof HTMLElement) this.#hosts.delete(element);
          this.#id(element, true);
        }
        for (const root of capture.shadowRoots) {
          rootsRemoved = this.#roots.delete(root) || rootsRemoved;
          this.#ids.delete(root);
        }
      }
      for (const node of record.addedNodes)
        if (node instanceof Element && node.isConnected)
          this.#add(captureOpenTree(node));
    }
    if (rootsRemoved) {
      // Disconnect retired roots as well as deleting their maps. A shared
      // observer otherwise strongly retains every historical root forever.
      this.#observer.disconnect();
      this.#observe(this.#document);
      for (const root of this.#roots)
        if (root.host.isConnected) this.#observe(root);
    }
  }
  #flush(): void {
    this.#records(this.#observer.takeRecords());
  }
  current(): OpenTopologySnapshot {
    const started = performance.now();
    const before = work(this.#document).topology_duration_us;
    this.#flush();
    if (this.#exceeded) this.#rebuild();
    for (const host of this.#hosts) {
      work(this.#document).topology_host_checks += 1;
      if (!host.isConnected) continue;
      const root = host.shadowRoot;
      if (root !== null && !this.#roots.has(root)) {
        // Observe before capturing; descendants/ID updates across later
        // awaits cannot fall into an unobserved-root window.
        if (this.#roots.size >= MAX_OPEN_SHADOW_ROOTS) {
          this.#exceeded = true;
          break;
        }
        this.#observe(root);
        let depth = 1;
        for (
          let current = host.getRootNode();
          current instanceof ShadowRoot;
          current = current.host.getRootNode()
        )
          depth += 1;
        if (depth > MAX_OPEN_SHADOW_DEPTH) {
          this.#exceeded = true;
          break;
        }
        this.#roots.add(root);
        work(this.#document).topology_roots_discovered += 1;
        this.#add(captureOpenTree(root));
        if (this.#roots.size > MAX_OPEN_SHADOW_ROOTS || this.#exceeded) {
          this.#exceeded = true;
          break;
        }
      }
    }
    const metrics = work(this.#document);
    metrics.topology_duration_us += Math.max(
      0,
      Math.ceil((performance.now() - started) * 1000) -
        (metrics.topology_duration_us - before),
    );
    if (this.#exceeded) metrics.topology_capacity_refusals += 1;
    return this.#exceeded
      ? { status: "CAPACITY_EXCEEDED" }
      : {
          status: "COMPLETE",
          shadowRoots: [...this.#roots],
          elementCount: this.#elements.size,
        };
  }
  matches(root: Document | ShadowRoot, id: string): readonly Element[] | null {
    this.#flush();
    if (
      this.#exceeded ||
      (root instanceof ShadowRoot && !this.#roots.has(root))
    )
      return null;
    return [...(this.#ids.get(root)?.get(id) ?? [])].filter(
      (node) => node.isConnected && node.getRootNode() === root,
    );
  }
}
const topologyRegistries = new WeakMap<Document, OpenTopologyRegistry>();
function registry(document: Document): OpenTopologyRegistry {
  let value = topologyRegistries.get(document);
  if (value === undefined) {
    value = new OpenTopologyRegistry(document);
    topologyRegistries.set(document, value);
  }
  return value;
}
export function currentOpenTopology(document: Document): OpenTopologySnapshot {
  return registry(document).current();
}
export function openRootsWithin(root: HTMLElement): OpenTopologySnapshot {
  const current = currentOpenTopology(root.ownerDocument);
  return current.status === "COMPLETE"
    ? {
        ...current,
        shadowRoots: current.shadowRoots.filter((shadow) =>
          composedContains(root, shadow.host),
        ),
      }
    : current;
}
