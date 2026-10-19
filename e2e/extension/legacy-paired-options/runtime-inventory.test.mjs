/** Pure temporary source fixtures only; no browser/server/build or fill runs. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  captureRuntimeInventory,
  assertRuntimeInventory,
  CANDIDATE_RUNTIME_POLICY,
} from "./runtime-inventory.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "japp-paired-inventory-structural."));
  const write = (path, value = "STRUCTURAL_TEST_ONLY_SOURCE") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  for (const path of CANDIDATE_RUNTIME_POLICY.directories)
    mkdirSync(join(root, path), { recursive: true });
  for (const path of new Set([
    ...CANDIDATE_RUNTIME_POLICY.files,
    ...CANDIDATE_RUNTIME_POLICY.required_runtime_paths,
  ]))
    write(path);
  const baseline = captureRuntimeInventory(root);
  const binding = {
    candidate_runtime_inventory_policy: baseline.policy,
    candidate_runtime_inventory_digest: baseline.digest,
    candidate_runtime_sources: baseline.files,
  };
  return {
    root,
    write,
    baseline,
    binding,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("STRUCTURAL_TEST_ONLY inventory is deterministic and includes required current runtime and generated sources", () => {
  const f = fixture();
  try {
    assert.deepEqual(captureRuntimeInventory(f.root), f.baseline);
    assert.deepEqual(assertRuntimeInventory(f.root, f.binding), f.baseline);
    for (const path of [
      "apps/extension/src/open-dom.ts",
      "apps/extension/src/drivers/mutation-guard.ts",
      "apps/extension/src/option-meaning.ts",
      "packages/contracts/generated/typescript/index.ts",
    ])
      assert.ok(f.baseline.files.some((item) => item.path === path));
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY adding a runtime helper invalidates the old path inventory", () => {
  const f = fixture();
  try {
    f.write("apps/extension/src/future-option-helper.ts");
    assert.equal(
      captureRuntimeInventory(f.root).files.length,
      f.baseline.files.length + 1,
    );
    assert.throws(
      () => assertRuntimeInventory(f.root, f.binding),
      /CANDIDATE_RUNTIME_INVENTORY_DRIFT/,
    );
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY adding generated source invalidates the old path inventory", () => {
  const f = fixture();
  try {
    f.write("packages/contracts/generated/typescript/future.v1.ts");
    assert.throws(
      () => assertRuntimeInventory(f.root, f.binding),
      /CANDIDATE_RUNTIME_INVENTORY_DRIFT/,
    );
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY removing a required helper refuses incomplete runtime coverage", () => {
  const f = fixture();
  try {
    rmSync(join(f.root, "apps/extension/src/option-meaning.ts"));
    assert.throws(
      () => captureRuntimeInventory(f.root),
      /REQUIRED_RUNTIME_PATH_UNBOUND/,
    );
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY changing runtime bytes invalidates the source commitment", () => {
  const f = fixture();
  try {
    f.write("apps/extension/src/open-dom.ts", "STRUCTURAL_TEST_ONLY_CHANGED");
    assert.throws(
      () => assertRuntimeInventory(f.root, f.binding),
      /CANDIDATE_RUNTIME_INVENTORY_DRIFT/,
    );
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY declared Python and build dependency caches never enter the source inventory", () => {
  const f = fixture();
  try {
    for (const path of [
      "packages/contracts/generated/python/__pycache__/one.pyc",
      "packages/contracts/generated/python/loose.pyo",
      "apps/extension/src/node_modules/ignored.js",
      "apps/extension/src/dist/ignored.js",
      "apps/extension/src/ignored.tsbuildinfo",
    ])
      f.write(path);
    assert.deepEqual(assertRuntimeInventory(f.root, f.binding), f.baseline);
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY a source symlink is refused rather than followed", () => {
  const f = fixture();
  try {
    symlinkSync(
      join(f.root, "package.json"),
      join(f.root, "apps/extension/src/linked.ts"),
    );
    assert.throws(
      () => captureRuntimeInventory(f.root),
      /SOURCE_SYMLINK_REFUSED/,
    );
  } finally {
    f.close();
  }
});
test("STRUCTURAL_TEST_ONLY an old enumerated inventory without policy is explicitly refused", () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        assertRuntimeInventory(f.root, {
          candidate_runtime_sources: f.baseline.files,
        }),
      /INVENTORY_POLICY_MISSING_OR_DRIFTED/,
    );
  } finally {
    f.close();
  }
});

test("STRUCTURAL_TEST_ONLY ordinary files named like excluded directories remain bound source additions", () => {
  const f = fixture();
  try {
    f.write("packages/form-engine/src/dist");
    f.write("packages/contracts/src/__pycache__");
    const current = captureRuntimeInventory(f.root);
    assert.equal(current.files.length, f.baseline.files.length + 2);
    assert.ok(
      current.files.some(
        (entry) => entry.path === "packages/form-engine/src/dist",
      ),
    );
    assert.ok(
      current.files.some(
        (entry) => entry.path === "packages/contracts/src/__pycache__",
      ),
    );
    assert.throws(
      () => assertRuntimeInventory(f.root, f.binding),
      /CANDIDATE_RUNTIME_INVENTORY_DRIFT/,
    );
  } finally {
    f.close();
  }
});
