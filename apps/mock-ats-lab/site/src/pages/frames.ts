// Same-origin iframe host (case MAL-FRM-001). The embedded section is a
// separate document served from the same loopback origin with its own
// frame-local state, validation, and page identity.
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet } from "../lab/dom.ts";

mountLabNotice();

const app = mustGet("app");

app.append(
  el("h1", { text: "Embedded section host" }),
  el("p", {
    attributes: { class: "muted" },
    text:
      "The equal-opportunity questionnaire below is embedded from the same " +
      "loopback origin as a separate document with isolated state.",
  }),
  el("iframe", {
    attributes: {
      id: "frames-embed",
      src: "/frames/inner/",
      title: "Embedded synthetic questionnaire",
    },
  }),
);
