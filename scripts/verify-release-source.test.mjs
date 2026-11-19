import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { verifyReleaseSource } from "./verify-release-source.mjs";

function withCandidate(callback) {
	const root = mkdtempSync(join(tmpdir(), "tasknotes-release-source-"));
	const version = "5.0.0-beta.11";
	const writeJson = (path, value) => writeFileSync(join(root, path), JSON.stringify(value));
	try {
		writeJson("manifest.json", { version, minAppVersion: "1.13.1" });
		writeJson("package.json", { version });
		writeJson("package-lock.json", { version, packages: { "": { version } } });
		writeJson("versions.json", { [version]: "1.13.1" });
		mkdirSync(join(root, "docs/releases"), { recursive: true });
		writeFileSync(join(root, `docs/releases/${version}.md`), "# Release notes\n\n- Fixed a bug.\n");
		callback({ root, version, writeJson });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("accepts an exact prepared beta without changing source files", () => {
	withCandidate(({ root, version }) => {
		const before = readFileSync(join(root, "manifest.json"), "utf8");
		assert.deepEqual(verifyReleaseSource(version, root), { version, notesPath: `docs/releases/${version}.md` });
		assert.equal(readFileSync(join(root, "manifest.json"), "utf8"), before);
	});
});

for (const version of [undefined, "v5.0.0", "5.0", "5.0.0/../../main", "05.0.0", "5.0.0 beta", "5.0.0\n", "5.0.0-beta.01"]) {
	test(`rejects noncanonical tag ${JSON.stringify(version)}`, () => {
		assert.throws(() => verifyReleaseSource(version), /exact version/);
	});
}

for (const filename of ["manifest.json", "package.json", "package-lock.json"]) {
	test(`rejects a mismatched ${filename}`, () => {
		withCandidate(({ root, version, writeJson }) => {
			writeJson(filename, { version: "4.18.3" });
			assert.throws(() => verifyReleaseSource(version, root), /does not match/);
		});
	});
}

test("rejects mismatched lockfile root metadata, missing minimum versions and absent notes", () => {
	withCandidate(({ root, version, writeJson }) => {
		writeJson("package-lock.json", { version, packages: { "": { version: "4.18.3" } } });
		assert.throws(() => verifyReleaseSource(version, root), /root package/);
		writeJson("package-lock.json", { version, packages: { "": { version } } });
		writeJson("versions.json", { [version]: "1.12.7" });
		assert.throws(() => verifyReleaseSource(version, root), /minimum Obsidian/);
		writeJson("versions.json", { [version]: "1.13.1" });
		writeFileSync(join(root, `docs/releases/${version}.md`), " \n");
		assert.throws(() => verifyReleaseSource(version, root), /not be empty/);
		rmSync(join(root, `docs/releases/${version}.md`));
		assert.throws(() => verifyReleaseSource(version, root), /ENOENT/);
	});
});

test("rejects absent or malformed minimum versions even if versions.json agrees", () => {
	for (const minimum of [undefined, "", "v1.13.1", "1.13", "01.13.1"]) {
		withCandidate(({ root, version, writeJson }) => {
			writeJson("manifest.json", { version, minAppVersion: minimum });
			writeJson("versions.json", { [version]: minimum });
			assert.throws(() => verifyReleaseSource(version, root), /minimum Obsidian/);
		});
	}
});

test("the release workflow verifies identity before a locked install and keeps publication draft-only", () => {
	const workflow = parse(readFileSync(".github/workflows/release.yaml", "utf8"));
	const steps = workflow.jobs.build.steps;
	const validationIndex = steps.findIndex(step => step.run?.includes("verify-release-source.mjs"));
	const installIndex = steps.findIndex(step => step.run === "npm ci");
	assert.ok(validationIndex >= 0 && installIndex > validationIndex);
	assert.ok(!steps.some(step => /npm install|jq --arg version/.test(step.run ?? "")));
	const release = steps.find(step => step.uses?.startsWith("softprops/action-gh-release@"));
	assert.equal(release.with.draft, true);
});
