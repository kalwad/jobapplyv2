import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { canonicalJson } from "./adapters/normalization.ts";
import {
  HISTORICAL_WITNESS_PATH,
  loadHistoricalWitnessInventory,
} from "./semantic-witnesses/historical-witness-loader.ts";

interface MutableInventory {
  inventory_sha256: string;
  witnesses: {
    provenance: unknown[];
  }[];
  [key: string]: unknown;
}

function recomputeDigest(inventory: MutableInventory): void {
  const payload = structuredClone(inventory);
  Reflect.deleteProperty(payload, "inventory_sha256");
  inventory.inventory_sha256 = createHash("sha256")
    .update(canonicalJson(payload))
    .digest("hex");
}

test("historical witness provenance cannot be truncated under a recomputed digest", () => {
  const root = mkdtempSync(join(tmpdir(), "japp-historical-witness-"));
  try {
    const inventory = JSON.parse(
      readFileSync(HISTORICAL_WITNESS_PATH, "utf8"),
    ) as MutableInventory;
    const row = inventory.witnesses.find(
      (candidate) => candidate.provenance.length > 1,
    );
    if (row === undefined) {
      throw new Error("multi-source historical witness missing");
    }
    row.provenance.pop();
    recomputeDigest(inventory);
    const path = join(root, "historical-platform-v1.json");
    writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
    expect(() => loadHistoricalWitnessInventory(path)).toThrow(
      expect.objectContaining({
        code: "HISTORICAL_WITNESS_INVENTORY_INVALID",
      }),
    );
  } finally {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
});
