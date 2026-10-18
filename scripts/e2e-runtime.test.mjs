import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { compareVersions, findLatestAppImage, installAppPackage, readAsarVersion } from "./e2e-runtime.mjs";

const asar = createRequire(import.meta.url)("@electron/asar");

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "tasknotes-runtime-test-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	return root;
}

async function archive(root, target, version) {
	const source = fs.mkdtempSync(path.join(root, "source-"));
	fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ version }));
	fs.mkdirSync(path.dirname(target), { recursive: true });
	await asar.createPackage(source, target);
}

test("versions compare numerically, rejecting malformed values", () => {
	assert.ok(compareVersions("1.12.2", "1.8.10") > 0);
	assert.equal(compareVersions("1.12.2", "1.12.2"), 0);
	assert.throws(() => compareVersions("invalid", "1.12.2"));
});

test("discovers the newest AppImage across Applications and Downloads", (t) => {
	const root = fixture(t);
	for (const [directory, version] of [["Applications", "1.8.10"], ["Downloads", "1.12.7"]]) {
		fs.mkdirSync(path.join(root, directory));
		fs.writeFileSync(path.join(root, directory, `Obsidian-${version}.AppImage`), "");
	}
	assert.equal(findLatestAppImage(root), path.join(root, "Downloads", "Obsidian-1.12.7.AppImage"));
});

test("installs the newest actual ASAR version at the loader's archive path", async (t) => {
	const root = fixture(t);
	const resources = path.join(root, "resources");
	const data = path.join(root, "data");
	await archive(root, path.join(resources, "obsidian.asar"), "1.8.10");
	await archive(root, path.join(data, "obsidian-1.14.2.asar"), "1.14.2");
	await archive(root, path.join(data, "obsidian-1.9.0.asar"), "1.9.0");
	// Modification time must not trump semantic version order.
	fs.utimesSync(path.join(data, "obsidian-1.14.2.asar"), 1, 1);
	assert.equal(installAppPackage(resources, data, "1.12.2").version, "1.14.2");
	assert.equal(readAsarVersion(path.join(resources, "obsidian.asar")), "1.14.2");
	assert.equal(readAsarVersion(path.join(data, "obsidian-1.9.0.asar")), "1.9.0");
});

test("works with a compatible bundled package and no personal profile", async (t) => {
	const root = fixture(t);
	const resources = path.join(root, "resources");
	await archive(root, path.join(resources, "obsidian.asar"), "1.12.7");
	assert.equal(installAppPackage(resources, path.join(root, "missing"), "1.12.2").version, "1.12.7");
});

test("honors an explicit ASAR and rejects old packages without replacing the runtime", async (t) => {
	const root = fixture(t);
	const resources = path.join(root, "resources");
	const explicit = path.join(root, "explicit.asar");
	await archive(root, path.join(resources, "obsidian.asar"), "1.14.2");
	await archive(root, explicit, "1.8.10");
	assert.throws(() => installAppPackage(resources, root, "1.12.2", explicit), /too old/);
	assert.equal(readAsarVersion(path.join(resources, "obsidian.asar")), "1.14.2");
	await archive(root, explicit, "1.12.7");
	assert.equal(installAppPackage(resources, root, "1.12.2", explicit).version, "1.12.7");
	assert.equal(readAsarVersion(path.join(resources, "obsidian.asar")), "1.12.7");
});
