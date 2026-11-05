/** The exact-key optimization preserves canonical optional-evidence matching. */
import { test, expect } from "./support/extension-test.ts";
import {
  openHarness,
  setFixture,
  scanFrames,
  foundTopFrame,
  descriptorByLabel,
  runtimeMessage,
  nextId,
} from "./support/research-harness.ts";
import {
  buildReresolveTabRequest,
  parseReresolveTabResult,
} from "../../apps/extension/src/scanner-protocol.ts";

test("W14 semantic lookup: complete identity stays unique while omitted optional name preserves global ambiguity", async ({
  extensionContext,
  extensionId,
  serviceWorker,
}) => {
  const harness = await openHarness(
    extensionContext,
    extensionId,
    serviceWorker,
    "/native/",
  );
  try {
    await setFixture(
      harness,
      '<form data-japp-application-root="true"><label for="first">First name</label><input id="first" name="contact"><label for="last">Last name</label><input id="last" name="contact"></form>',
    );
    const field = descriptorByLabel(
      foundTopFrame(await scanFrames(harness)).descriptors,
      "First name",
    );
    const exact = parseReresolveTabResult(
      await runtimeMessage(
        harness.controller,
        buildReresolveTabRequest(
          nextId("lookup-exact"),
          harness.tabId,
          field.address,
        ),
      ),
    );
    expect(exact?.resolution.status).toBe("RESOLVED");
    const partial = { ...field.address };
    delete partial.accessible_name_fingerprint;
    const broad = parseReresolveTabResult(
      await runtimeMessage(
        harness.controller,
        buildReresolveTabRequest(
          nextId("lookup-partial"),
          harness.tabId,
          partial,
        ),
      ),
    );
    expect(broad?.resolution).toEqual({
      status: "AMBIGUOUS",
      candidate_count: 2,
    });
    expect(
      await harness.page
        .locator("input")
        .evaluateAll((inputs) =>
          inputs.map((input) => (input as HTMLInputElement).value),
        ),
    ).toEqual(["", ""]);
  } finally {
    await harness.page.close();
    await harness.controller.close();
  }
});
