import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { ESLint } from "eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

const require = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const eslint = new ESLint();

test("the installed Obsidian guideline checker matches its exact dependency pin", () => {
	assert.equal(
		packageJson.devDependencies["eslint-plugin-obsidianmd"],
		require("eslint-plugin-obsidianmd/package.json").version
	);
});

test("all recommended Obsidian rules remain enabled for plugin source", async () => {
	const recommendedRules = {
		...obsidianmd.ruleConfigs.recommended,
		...obsidianmd.ruleConfigs.recommendedTypeChecked,
	};
	for (const filePath of [
		"src/main.ts",
		"src/editor/InstantConvertButtons.ts",
		"src/bases/KanbanView.ts",
	]) {
		const config = await eslint.calculateConfigForFile(filePath);
		assert.ok(config, `${filePath} must not be ignored`);
		for (const ruleName of Object.keys(recommendedRules)) {
			assert.ok(config.rules[ruleName]?.[0] > 0, `${filePath}: ${ruleName} must be enabled`);
		}
	}
});

test("metadata files are linted without JavaScript-only rules", async () => {
	for (const filePath of ["package.json", "manifest.json", "LICENSE"]) {
		assert.ok(packageJson.scripts["lint:ts"].split(" ").includes(filePath));
		assert.ok(packageJson.scripts["lint:ts:fix"].split(" ").includes(filePath));
		const [result] = await eslint.lintText(readFileSync(filePath, "utf8"), { filePath });
		assert.deepEqual(result.messages, []);
	}
});

test("invalid manifests and unedited sample licenses are rejected", async () => {
	const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
	const [manifestResult] = await eslint.lintText(
		JSON.stringify({ ...manifest, name: "Obsidian Sample Plugin" }),
		{ filePath: "manifest.json" }
	);
	assert.ok(
		manifestResult.messages.some((message) => message.ruleId === "obsidianmd/validate-manifest")
	);
	const [licenseResult] = await eslint.lintText("Copyright (c) 2020 Dynalist Inc.\n", {
		filePath: "LICENSE",
	});
	assert.ok(
		licenseResult.messages.some((message) => message.ruleId === "obsidianmd/validate-license")
	);
});
