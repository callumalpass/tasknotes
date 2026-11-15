import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parse } from "yaml";
import { buildGeneratedPages } from "../docs-builder/src/generated-pages.js";

test("default Base references serialize formulas outside the Obsidian runtime", async () => {
	const manifest = JSON.parse(await fs.readFile(new URL("../manifest.json", import.meta.url), "utf8"));
	const pages = await buildGeneratedPages(manifest);
	const reference = pages.get("reference/default-base-templates.md");
	assert.ok(reference);
	const templates = [...reference.matchAll(/```yaml\n([\s\S]*?)```/g)];
	assert.ok(templates.length > 0);
	const bases = templates.map((match) => parse(match[1]));
	assert.ok(bases.some((base) => base.formulas && Object.keys(base.formulas).length > 0));
	assert.ok(bases.some((base) => base.views.some((view) => view.name === "Inbox")));
	assert.ok(pages.get("reference/compatibility.md").includes(manifest.version));
});
