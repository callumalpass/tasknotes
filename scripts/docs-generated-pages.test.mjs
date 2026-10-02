import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { buildGeneratedPages } from "../docs-builder/src/generated-pages.js";

test("standalone documentation generates valid Base templates without the Obsidian host", async () => {
	const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
	const pages = await buildGeneratedPages(manifest);
	assert.equal(pages.size, 5);
	const bases = pages.get("reference/default-base-templates.md");
	const templates = [...bases.matchAll(/```yaml\n([\s\S]*?)\n```/g)];
	assert.ok(templates.length > 0);
	let formulaCount = 0;
	for (const [, template] of templates) {
		const data = parse(template);
		assert.ok(Array.isArray(data.views) && data.views.length > 0);
		for (const formula of Object.values(data.formulas || {})) {
			assert.equal(typeof formula, "string");
			formulaCount += 1;
		}
	}
	assert.ok(formulaCount > 0, "generated templates must retain their formula expressions");
});
