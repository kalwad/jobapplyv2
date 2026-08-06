// Multipage flow receipt (case MAL-FLW-007 plus the MAL-FLW-005 landing):
// stable synthetic receipt identity and the deterministic reset path.
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet } from "../lab/dom.ts";
import { loadReceiptState, resetLabSession } from "../lab/storage.ts";

mountLabNotice();

const app = mustGet("app");
const receipts = loadReceiptState();
const latest = receipts.issued.at(-1);

const resetButton = el("button", {
  attributes: { class: "secondary", id: "flow-reset", type: "button" },
  text: "Reset lab state",
});
resetButton.addEventListener("click", () => {
  resetLabSession();
  window.location.assign("/apply/step-1/");
});

app.append(
  el("h1", { text: "Apply — synthetic receipt" }),
  latest === undefined
    ? el("p", {
        attributes: {
          class: "status",
          "data-tone": "error",
          id: "flow-receipt-id",
        },
        text: "NO_RECEIPT: no synthetic submission exists in this session.",
      })
    : el("p", {
        children: [
          "Your synthetic application was recorded locally. Receipt: ",
          el("strong", {
            attributes: { id: "flow-receipt-id" },
            text: latest.id,
          }),
        ],
      }),
  el("p", {
    attributes: { class: "muted" },
    text:
      "This receipt exists only inside the mock ATS lab. No employer was " +
      "contacted and nothing left 127.0.0.1.",
  }),
  el("div", {
    attributes: { class: "review-actions" },
    children: [resetButton],
  }),
);
