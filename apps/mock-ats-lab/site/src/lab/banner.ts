// Mandatory synthetic-lab notice (M02-W03, spec §8.2: no live submission).
import { LAB_NOTICE } from "./constants.ts";
import { el } from "./dom.ts";

/** Prepend the prominent test-lab notice to the page body. */
export function mountLabNotice(): void {
  const banner = el("aside", {
    attributes: {
      class: "lab-notice",
      "data-lab-notice": "synthetic-fixture",
      role: "note",
    },
    text: LAB_NOTICE,
  });
  document.body.prepend(banner);
}
