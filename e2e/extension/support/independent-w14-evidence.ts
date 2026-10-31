/** Shared helpers for the independent W14 regression drafts. */
import { writeFileSync } from "node:fs";
import type { TestInfo } from "@playwright/test";
import type { FormFieldDescriptorV1 } from "../../../packages/contracts/generated/typescript/index.ts";
import {
  buildApprovedRecordSet,
  resolveFieldDecision,
  stableSemanticId,
} from "../../../packages/form-engine/src/index.ts";
import type { Harness, dynExecute } from "./research-harness.ts";

export interface IndependentEventMeter {
  input: number;
  change: number;
}

export async function countryPolicy(
  descriptor: FormFieldDescriptorV1,
  seed: string,
  valueToken = "US",
) {
  return resolveFieldDecision({
    descriptor,
    records: buildApprovedRecordSet([
      {
        recordId: await stableSemanticId("record", "independent-country"),
        concept: "ADDRESS_COUNTRY",
        valueToken,
        policy: "FILL_FROM_EXPLICIT_RECORD",
        confirmation: { state: "MISSING" },
        valueConfidence: 1,
      },
    ]),
    correlationId: await stableSemanticId("cor", seed),
  });
}

export function nativeSelectPhysical(harness: Harness) {
  return harness.page.evaluate(() => {
    const select = document.querySelector("select");
    if (select === null) throw new Error("native select missing");
    return {
      value: select.value,
      label: select.selectedOptions[0]?.textContent,
      options: [...select.options].map((option) => ({
        value: option.value,
        label: option.textContent,
        selected: option.selected,
      })),
      meter: (window as unknown as { independentMeter: IndependentEventMeter })
        .independentMeter,
    };
  });
}

export async function recordIndependentEvidence(
  info: TestInfo,
  name: string,
  value: Readonly<Record<string, unknown>>,
): Promise<void> {
  const body = JSON.stringify(value, null, 2);
  // Preserve the raw JSON plus its attachment using Playwright's portable
  // per-test output directory rather than the original probe's /tmp path.
  writeFileSync(info.outputPath(`native-${name}.json`), body);
  await info.attach(name, { body, contentType: "application/json" });
}

/** Preserve the probes' result expectation without treating suppression as success. */
export function firstDriverOutcome(
  execution: Awaited<ReturnType<typeof dynExecute>>,
) {
  const item = execution.items[0];
  if (item === undefined) return undefined;
  if (!("result" in item)) throw new Error("driver result missing");
  return item.result.outcome;
}
