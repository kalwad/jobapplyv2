// Fixture catalog index (case MAL-IDX-001). Renders case identity only:
// no expected result, sensitivity decision, or scanner ground truth is
// exposed here or anywhere else in the served DOM.
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet } from "../lab/dom.ts";
import {
  CATALOG_VERSION,
  FIXTURE_CASES,
  FIXTURE_ROUTES,
} from "../catalog/cases.ts";

mountLabNotice();

const app = mustGet("app");

const rows = FIXTURE_CASES.map((entry) =>
  el("li", {
    attributes: { "data-case-id": entry.id },
    children: [
      el("code", { text: entry.id }),
      " — ",
      el("a", { attributes: { href: entry.route }, text: entry.title }),
    ],
  }),
);

app.append(
  el("h1", { text: "Mock ATS lab — fixture catalog" }),
  el("p", {
    attributes: { class: "muted" },
    text:
      `Catalog version ${CATALOG_VERSION}: ${String(FIXTURE_CASES.length)} ` +
      `deterministic cases across ${String(FIXTURE_ROUTES.length)} routes, ` +
      "served only on 127.0.0.1. Synthetic reserved data throughout.",
  }),
  el("ul", {
    attributes: { class: "case-list", id: "case-list" },
    children: rows,
  }),
);
