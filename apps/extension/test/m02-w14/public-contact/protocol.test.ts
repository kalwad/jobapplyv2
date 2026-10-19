import { describe, it, expect } from "vitest";
import { buildDescriptor } from "../../../../../packages/form-engine/test/support/build-descriptor.ts";
import { semanticDigest } from "../../../src/semantic-identity.ts";
import { PUBLIC_SOURCES } from "../public-inspection/scope.ts";
import {
  CONTACT_SCOPE,
  PREPARE,
  parsePlan,
  parseContactRequest,
  profileDigest,
  type ContactPlan,
} from "./protocol.ts";
async function plan(): Promise<ContactPlan> {
  const descriptor = await buildDescriptor({ label: "First name" });
  const source = PUBLIC_SOURCES[0];
  return {
    scope: CONTACT_SCOPE,
    source_url: source.url,
    frame_context: {
      session_id: descriptor.address.session_id,
      frame_id: descriptor.address.frame_id,
      document_id: descriptor.address.document_id,
      document_url_digest: await semanticDigest(source.url),
      is_top_frame: true,
    },
    before_scan_digest: await semanticDigest("before"),
    independent_oracle_digest: await semanticDigest("independent"),
    profile_digest: await profileDigest(),
    fields: [{ field_id: descriptor.field_id, address: descriptor.address }],
  };
}
describe("closed public contact plan", () => {
  it("accepts canonical bound inventory and rejects extra authority/value commands", async () => {
    const value = await plan();
    expect(parsePlan(value)).toEqual(value);
    const wire = {
      kind: PREPARE,
      version: 1,
      requestId: "prepare",
      tabId: 1,
      plan: value,
    };
    expect(parseContactRequest(wire)).not.toBeNull();
    for (const key of ["intended", "selector", "allowSubmit", "credentials"])
      expect(parseContactRequest({ ...wire, [key]: "forged" })).toBeNull();
  });
  it("refuses route/query/credential/origin expansion and mismatched frame addresses", async () => {
    const value = await plan();
    for (const url of [
      `${value.source_url}?preview=1`,
      `${value.source_url}#form`,
      value.source_url.replace("https://", "http://"),
      value.source_url.replace("https://", "https://user:pass@"),
      "https://example.invalid/job",
    ])
      expect(parsePlan({ ...value, source_url: url })).toBeNull();
    expect(
      parsePlan({
        ...value,
        frame_context: { ...value.frame_context, is_top_frame: false },
      }),
    ).toBeNull();
    expect(
      parsePlan({ ...value, fields: [...value.fields, ...value.fields] }),
    ).toBeNull();
    expect(
      parsePlan({
        ...value,
        fields: value.fields.map((field) => ({
          ...field,
          address: { ...field.address, document_id: field.address.frame_id },
        })),
      }),
    ).toBeNull();
  });
});
