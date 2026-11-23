import { expect, test } from "@playwright/test";
import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { requireFrontmatter } from "../../src/services/mdbase/frontmatter";
import type { ObsidianApp } from "../obsidian";

for (const [label, existing] of [["new", false], ["existing", true]] as const) {
	test(`${label} vault has unrestricted project and occurrence template links`, async () => {
		const root = mkdtempSync(join(tmpdir(), "tasknotes-2665-"));
		const vault = join(root, "vault");
		const config = join(vault, ".obsidian");
		const plugin = join(config, "plugins/tasknotes");
		const previousEnvironment = {
			TASKNOTES_E2E_VAULT_DIR: process.env.TASKNOTES_E2E_VAULT_DIR,
			TASKNOTES_E2E_USER_DATA_DIR: process.env.TASKNOTES_E2E_USER_DATA_DIR,
			TASKNOTES_E2E_REUSE_OBSIDIAN: process.env.TASKNOTES_E2E_REUSE_OBSIDIAN,
		};
		let app: ObsidianApp | undefined;
		let obsidian: typeof import("../obsidian") | undefined;
		const typePath = join(vault, "_mdbase/types/task.md");
		const taskPath = join(vault, "Task.md");
		const projectField = existing ? "related_projects" : "projects";
		const templateField = existing ? "template_note" : "occurrence_template";
		const task = `---\ntags: [task]\n${projectField}: ["[[Project]]"]\n${templateField}: "[[Template]]"\n---\nTask body\n`;

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
			if (existing) {
				const resources = buildTaskNotesMdbaseResources({
					modelConfig: { fieldMapping: { projects: projectField, occurrenceTemplate: templateField } },
				});
				const definition = YAML.parseDocument(requireFrontmatter(resources.typeDocument).frontmatter);
				for (const field of [`${projectField}[]`, templateField]) {
					definition.setIn(["collection", "links", field, "target_type"], "any");
				}
				definition.setIn(["collection", "links", "custom", "target_type"], "any");
				definition.setIn(["collection", "links", "assignees[]", "target_type"], "person");
				mkdirSync(join(vault, "_mdbase/types"), { recursive: true });
				writeFileSync(join(vault, "mdbase.yaml"), resources.configDocument);
				writeFileSync(typePath, `---\n${definition.toString()}---\nCustom type body\n`);
				writeFileSync(taskPath, task);
			}
			process.env.TASKNOTES_E2E_VAULT_DIR = vault;
			process.env.TASKNOTES_E2E_USER_DATA_DIR = join(root, "profile");
			process.env.TASKNOTES_E2E_REUSE_OBSIDIAN = "0";
			delete require.cache[require.resolve("../obsidian")];
			obsidian = require("../obsidian");
			app = await obsidian!.launchObsidian();

			await expect.poll(() => {
				const markdown = readFileSync(typePath, "utf8");
				const { collection: { links }, version } = YAML.parse(requireFrontmatter(markdown).frontmatter);
				return {
					projects: links[`${projectField}[]`],
					occurrenceTemplate: links[templateField],
					recurrenceParent: links.recurrence_parent,
					dependency: links["blockedBy[].uid"],
					custom: links.custom,
					assignees: links["assignees[]"],
					version,
				};
			}).toEqual({
				projects: { validate_exists: false },
				occurrenceTemplate: { validate_exists: false },
				recurrenceParent: { target_type: "task", validate_exists: false },
				dependency: { target_type: "task", validate_exists: false },
				custom: existing ? { target_type: "any" } : undefined,
				assignees: existing ? { target_type: "person", validate_exists: false } : { validate_exists: false },
				version: 5,
			});
			if (existing) {
				expect(readFileSync(taskPath, "utf8")).toBe(task);
				expect(requireFrontmatter(readFileSync(typePath, "utf8")).body).toBe("Custom type body\n");
			}
		} finally {
			try {
				if (app && obsidian) await obsidian.closeObsidian(app);
			} finally {
				for (const [key, value] of Object.entries(previousEnvironment)) {
					if (value === undefined) delete process.env[key];
					else process.env[key] = value;
				}
				delete require.cache[require.resolve("../obsidian")];
				rmSync(root, { recursive: true, force: true });
			}
		}
	});
}
