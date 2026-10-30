import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { adaptPinnedSpecBuild, adaptPinnedSpecRuntime } from "./conformance-adapter-compat.mjs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

test("pinned adapter compatibility leaves fixture expectations unchanged and fails on drift", () => {
  const root = mkdtempSync(resolve(tmpdir(), "tasknotes-adapter-test-"));
  const source = resolve("docs/spec");
  try {
    cpSync(resolve(source, "conformance"), resolve(root, "conformance"), { recursive: true });
    cpSync(resolve(source, "package.json"), resolve(root, "package.json"));
    adaptPinnedSpecBuild(root, resolve("."));
    const script = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).scripts["conformance:build:tasknotes-bridge"];
    assert.equal(script.split("conformance-esbuild.mjs").length - 1, 4);
    assert.doesNotMatch(script, /npm --prefix/);
    assert.throws(() => adaptPinnedSpecBuild(root, resolve(".")), /build changed/);
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

test("conformance builds transform real Lingui descriptors from a different working directory", () => {
  const root = mkdtempSync(resolve(tmpdir(), "tasknotes-lingui-bridge-test-"));
  const output = resolve(root, "descriptors.cjs");
  try {
    execFileSync(process.execPath, [resolve("scripts/conformance-esbuild.mjs"),
      resolve("src/i18n/errorMessages.ts"), "--bundle", "--platform=node", "--format=cjs", `--outfile=${output}`,
    ], { cwd: root, stdio: "pipe" });
    const bundle = readFileSync(output, "utf8");
    assert.doesNotMatch(bundle, /@lingui\/core\/macro/);
    const require = createRequire(import.meta.url);
    assert.ok(Object.keys(require(output).errorMessages).length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
