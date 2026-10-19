/** Read-only protected-boundary observations. Never act on these elements. */
import {
  captureOpenTree,
  localIdReference,
  hasAmbiguousLocalReference,
} from "../../../src/open-dom.ts";
import { isElementVisible } from "../../../src/field-scanner.ts";
export function visible(element: Element): boolean {
  return element instanceof HTMLElement && isElementVisible(element);
}
/** Autocomplete is a case-insensitive token list, independent of labels. */
export function protectedAutocomplete(element: Element): string | null {
  const tokens = (element.getAttribute("autocomplete") ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.includes("one-time-code")) return "VISIBLE_ONE_TIME_CODE_BOUNDARY";
  if (tokens.includes("current-password") || tokens.includes("new-password"))
    return "VISIBLE_CREDENTIAL_AUTOCOMPLETE_BOUNDARY";
  if (tokens.includes("username") || tokens.includes("webauthn"))
    return "VISIBLE_LOGIN_CREDENTIAL_BOUNDARY";
  return null;
}
interface FocusFence {
  documentMarkup: string;
  shadows: readonly { root: ShadowRoot; markup: string }[];
}
const MAX_FOCUS_MARKUP_CHARACTERS = 1_000_000;
/** Transient frame-local evidence. No HTML is emitted or persisted. */
export function captureFocusFence(document: Document): FocusFence | null {
  const capture = captureOpenTree(document);
  if (capture.status !== "COMPLETE") return null;
  const documentMarkup = document.documentElement.outerHTML;
  let characters = documentMarkup.length;
  if (characters > MAX_FOCUS_MARKUP_CHARACTERS) return null;
  const shadows: { root: ShadowRoot; markup: string }[] = [];
  for (const root of capture.shadowRoots) {
    const markup = root.innerHTML;
    characters += markup.length;
    if (characters > MAX_FOCUS_MARKUP_CHARACTERS) return null;
    shadows.push({ root, markup });
  }
  return { documentMarkup, shadows };
}
export function focusFenceMatches(
  document: Document,
  prior: FocusFence,
): boolean {
  const current = captureFocusFence(document);
  return (
    current !== null &&
    current.documentMarkup === prior.documentMarkup &&
    current.shadows.length === prior.shadows.length &&
    current.shadows.every(
      (entry, index) =>
        entry.root === prior.shadows[index]?.root &&
        entry.markup === prior.shadows[index].markup,
    )
  );
}

export function protectedBoundary(document: Document): string | null {
  const capture = captureOpenTree(document);
  if (capture.status !== "COMPLETE")
    return "PROTECTED_BOUNDARY_CAPACITY_EXCEEDED";
  const all = (selector: string) =>
    capture.elements.filter((element) => element.matches(selector));
  if ([...all('input[type="password"]')].some(visible))
    return "VISIBLE_PASSWORD_BOUNDARY";
  for (const element of all("input,textarea")) {
    const autocompleteBoundary = protectedAutocomplete(element);
    if (visible(element) && autocompleteBoundary !== null)
      return autocompleteBoundary;
  }
  for (const element of all("input,textarea")) {
    if (hasAmbiguousLocalReference(element, "aria-labelledby"))
      return "PROTECTED_BOUNDARY_REFERENCE_AMBIGUOUS";
    const referenced = (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .map((id) => localIdReference(element, id)?.textContent ?? "")
      .join(" ");
    const labels =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
        ? [...(element.labels ?? [])]
            .map((label) => label.textContent)
            .join(" ")
        : "";
    if (
      visible(element) &&
      /captcha|verification code|security code|one.time.code|verification token/i.test(
        `${element.id} ${element.getAttribute("name") ?? ""} ${element.getAttribute("aria-label") ?? ""} ${referenced} ${labels}`,
      )
    )
      return "VISIBLE_CHALLENGE_INPUT";
  }
  for (const frame of all("iframe")) {
    if (!visible(frame)) continue;
    const text = `${frame.getAttribute("title") ?? ""} ${frame.getAttribute("src") ?? ""}`;
    // A visible challenge surface is conservatively refused, including
    // compact checkbox frames. Its cross-origin document is never read.
    if (/captcha|challenge|turnstile|\/bframe/i.test(text))
      return "VISIBLE_CHALLENGE_SURFACE";
  }
  for (const dialog of all(
    '[role="dialog"],[role="alertdialog"],[aria-modal="true"],dialog[open]',
  )) {
    // Visible dialog semantics are sufficient: text inside open roots,
    // assigned slots, icons or a generic Continue button cannot bypass it.
    if (visible(dialog)) return "PROTECTED_DIALOG_BOUNDARY";
  }
  for (const heading of all("h1,h2")) {
    if (
      visible(heading) &&
      /checking your browser|verify (that )?you are human|verify your (email|identity)|sign in|log in|create (an? )?account|access denied|too many requests|session (has )?expired/i.test(
        heading.textContent,
      )
    )
      return "ACCESS_OR_SESSION_BOUNDARY";
  }
  return null;
}
