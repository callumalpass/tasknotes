import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { adaptPinnedSpecRuntime } from "./conformance-adapter-compat.mjs";

test("pinned adapter compatibility leaves fixture expectations unchanged and fails on drift", () => {
  const root = mkdtempSync(resolve(tmpdir(), "tasknotes-adapter-test-"));
  const source = resolve("docs/spec");
  try {
    cpSync(resolve(source, "conformance"), resolve(root, "conformance"), { recursive: true });
    const read = (base, file) => readFileSync(resolve(base, "conformance", file), "utf8");
    adaptPinnedSpecRuntime(root);
    for (const file of ["fixtures/migrations.json", "fixtures/operations.json", "tests/runner.test.mjs"]) {
      assert.equal(read(root, file), read(source, file));
    }
    const runtime = read(root, "adapters/tasknotes-runtime-bridge.ts");
    assert.match(runtime, /expandedProjectsService: \{ renamePath:/);
    assert.match(runtime, /projectSubtasksService: \{ invalidateIndex:/);
    assert.match(read(root, "adapters/tasknotes-core/conformance.ts"), /parseDateToUTC\(iso\)/);
    assert.throws(() => adaptPinnedSpecRuntime(root), /adapter changed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
