import { expect, test } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { compileRecordSchema } from "../../src/services/mdbase/contractValidation";
import { requireFrontmatter } from "../../src/services/mdbase/frontmatter";
import type { ObsidianApp } from "../obsidian";

test("TaskNotes-written local times validate against its generated task type", async () => {
	const root = mkdtempSync(join(tmpdir(), "tasknotes-2706-"));
	const vault = join(root, "vault");
	const config = join(vault, ".obsidian");
	const plugin = join(config, "plugins/tasknotes");
	const environment = {
		TASKNOTES_E2E_VAULT_DIR: vault,
		TASKNOTES_E2E_USER_DATA_DIR: join(root, "profile"),
		TASKNOTES_E2E_REUSE_OBSIDIAN: "0",
	};
	const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
	let app: ObsidianApp | undefined;
	let obsidian: typeof import("../obsidian") | undefined;
	try {
		mkdirSync(plugin, { recursive: true });
		for (const file of ["main.js", "manifest.json", "styles.css"]) {
			copyFileSync(resolve(__dirname, "../..", file), join(plugin, file));
		}
		writeFileSync(join(config, "community-plugins.json"), JSON.stringify(["tasknotes"]));
		writeFileSync(join(plugin, "data.json"), JSON.stringify({
			enableMdbaseSpec: true,
			uiLanguage: "en",
			checkForUpdatesOnStartup: false,
			showReleaseNotesOnUpdate: false,
		}));

		Object.assign(process.env, environment);
		delete require.cache[require.resolve("../obsidian")];
		obsidian = require("../obsidian");
		app = await obsidian!.launchObsidian();

		const scheduled = "2026-11-30T16:00";
		const due = "2026-11-30T17:30";
		const content = await app.page.evaluate(async ({ scheduled, due }) => {
			const { vault, plugins } = (window as any).app;
			const { file } = await plugins.plugins.tasknotes.taskService.createTask({
				title: "Timed task", scheduled, due,
			});
			return await vault.read(file) as string;
		}, { scheduled, due });
		const record = YAML.parse(requireFrontmatter(content).frontmatter);
		expect(record).toMatchObject({ scheduled, due });

		const typePath = join(vault, "_mdbase/types/task.md");
		await expect.poll(() => existsSync(typePath)).toBe(true);
		const type = YAML.parse(requireFrontmatter(readFileSync(typePath, "utf8")).frontmatter);
		const validate = compileRecordSchema(type.schema.value);
		expect(validate(record) ? [] : validate.errors).toEqual([]);
	} finally {
		try {
			if (app && obsidian) await obsidian.closeObsidian(app);
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
			delete require.cache[require.resolve("../obsidian")];
			rmSync(root, { recursive: true, force: true });
		}
	}
});
