import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { loadNycConfig } = require("@istanbuljs/load-nyc-config");

// The js-yaml override removes argparse 1 / sprintf-js from the coverage
// toolchain. Exercise its consumer rather than just checking a version string.
test("NYC YAML configuration retains arrays, booleans, scalar normalization and extends", async () => {
	const consumerRequire = createRequire(require.resolve("@istanbuljs/load-nyc-config"));
	assert.equal(consumerRequire("js-yaml/package.json").version, "4.3.2");
	const cwd = await mkdtemp(path.join(tmpdir(), "tasknotes-nyc-yaml-"));
	try {
		await writeFile(path.join(cwd, "package.json"), '{"name":"nyc-compat-fixture"}');
		await writeFile(path.join(cwd, "shared.yml"), "reporter: [text, lcov]\nall: true\n");
		await writeFile(path.join(cwd, ".nycrc.yml"), 'extends: ./shared.yml\ninclude: "src/**/*.ts"\nexclude: ["tests/**"]\ncheck-coverage: true\nlines: 80\n');
		const config = await loadNycConfig({ cwd });
		assert.deepEqual(config.include, ["src/**/*.ts"]);
		assert.deepEqual(config.exclude, ["tests/**"]);
		assert.deepEqual(config.reporter, ["text", "lcov"]);
		assert.equal(config.all, true);
		assert.equal(config.checkCoverage, true);
		assert.equal(config.lines, 80);
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
});

test("NYC rejects malformed YAML instead of accepting incomplete configuration", async () => {
	const cwd = await mkdtemp(path.join(tmpdir(), "tasknotes-nyc-yaml-"));
	try {
		await writeFile(path.join(cwd, "package.json"), '{"name":"nyc-compat-fixture"}');
		await writeFile(path.join(cwd, ".nycrc.yml"), "include: [unterminated\n");
		await assert.rejects(loadNycConfig({ cwd }), { name: "YAMLException" });
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
});
