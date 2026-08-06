// Local file-upload fixture (case MAL-UPL-001): accepted-type/size
// behavior, rejected type and empty selection, and deterministic display
// of filename, media type, and byte size. Nothing is uploaded anywhere and
// no document content is parsed (spec §8.2; M02-W03 boundary).
import { mountLabNotice } from "../lab/banner.ts";
import { el, mustGet, setText } from "../lab/dom.ts";

mountLabNotice();

const ACCEPTED_EXTENSIONS = [".pdf", ".txt"] as const;
const ACCEPTED_TYPES = ["application/pdf", "text/plain"] as const;
export const MAX_UPLOAD_BYTES = 512_000;

const app = mustGet("app");

const input = el("input", {
  attributes: {
    accept: ACCEPTED_EXTENSIONS.join(","),
    id: "up-file",
    type: "file",
  },
});
const status = el("output", {
  attributes: { class: "status", id: "up-status", role: "status" },
  text: "NO_FILE",
});
const nameOut = el("output", { attributes: { id: "up-name" } });
const typeOut = el("output", { attributes: { id: "up-type" } });
const sizeOut = el("output", { attributes: { id: "up-size" } });

function clearMetadata(): void {
  setText(nameOut, "");
  setText(typeOut, "");
  setText(sizeOut, "");
}

input.addEventListener("change", () => {
  status.removeAttribute("data-tone");
  const file = input.files?.[0];
  if (file === undefined) {
    clearMetadata();
    setText(status, "NO_FILE");
    return;
  }
  const lowerName = file.name.toLowerCase();
  const extensionOk = ACCEPTED_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );
  const typeOk =
    file.type === "" ||
    ACCEPTED_TYPES.some((accepted) => file.type === accepted);
  if (!extensionOk || !typeOk) {
    clearMetadata();
    status.setAttribute("data-tone", "error");
    setText(
      status,
      "REJECTED_TYPE: only .pdf and .txt synthetic documents are accepted.",
    );
    input.value = "";
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    clearMetadata();
    status.setAttribute("data-tone", "error");
    setText(
      status,
      `REJECTED_SIZE: files larger than ${String(MAX_UPLOAD_BYTES)} bytes are not accepted.`,
    );
    input.value = "";
    return;
  }
  setText(nameOut, file.name);
  setText(typeOut, file.type === "" ? "(no media type reported)" : file.type);
  setText(sizeOut, `${String(file.size)} bytes`);
  status.setAttribute("data-tone", "ok");
  setText(
    status,
    "ACCEPTED_LOCALLY: file metadata recorded; nothing was uploaded.",
  );
});

app.append(
  el("h1", { text: "Document upload — local fixture" }),
  el("p", {
    attributes: { class: "muted" },
    text:
      "Selected files never leave this page. The fixture records name, " +
      "media type, and size only; it does not read or parse content.",
  }),
  el("div", {
    attributes: { class: "field" },
    children: [
      el("label", {
        attributes: { for: "up-file" },
        text: "Synthetic resume document (.pdf or .txt, max 512,000 bytes)",
      }),
      input,
    ],
  }),
  el("table", {
    children: [
      el("tbody", {
        children: [
          el("tr", {
            children: [
              el("th", { text: "File name" }),
              el("td", { children: [nameOut] }),
            ],
          }),
          el("tr", {
            children: [
              el("th", { text: "Media type" }),
              el("td", { children: [typeOut] }),
            ],
          }),
          el("tr", {
            children: [
              el("th", { text: "Size" }),
              el("td", { children: [sizeOut] }),
            ],
          }),
        ],
      }),
    ],
  }),
  status,
);
