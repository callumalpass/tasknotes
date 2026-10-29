import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
let original: any;
const prefix = `Issue2436-${Date.now()}`;

test.beforeAll(async () => {
	instance = await launchObsidian();
	original = await instance.page.evaluate(async (prefix) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		const original = JSON.parse(JSON.stringify(plugin.settings));
		await app.vault.create(`${prefix}-Homework.md`, "# Homework");
		await app.vault.create(`${prefix}-Personal.md`, "# Personal");
		plugin.settings.enableNaturalLanguageInput = true;
		plugin.settings.nlpEnterToSubmit = false;
		plugin.settings.openTaskAfterCreation = "none";
		plugin.settings.taskCreationDefaults.defaultProjects = `[[${prefix}-Homework]]`;
		return original;
	}, prefix);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async ({ original, prefix }) => {
			const app = (window as any).app;
			app.plugins.plugins.tasknotes.settings = original;
			for (const file of app.vault.getMarkdownFiles()) {
				if (file.basename.startsWith(prefix)) await app.vault.delete(file);
			}
		}, { original, prefix });
	} finally {
		await closeObsidian(instance);
	}
});

for (const [name, enabled, explicit] of [
	["legacy additive", false, true],
	["fallback override", true, true],
	["fallback without explicit project", true, false],
] as const) {
	test(name, async () => {
		const title = `${prefix}-${name}`;
		await instance.page.evaluate((enabled) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			plugin.settings.taskCreationDefaults.defaultProjectsOnlyWhenEmpty = enabled;
			plugin.openTaskCreationModal();
		}, enabled);
		const editor = instance.page.locator(".modal .tn-task-modal__markdown-editor--nlp .cm-content");
		await expect(editor).toBeVisible();
		await editor.click();
		await instance.page.keyboard.insertText(title + (explicit ? ` +[[${prefix}-Personal]]` : ""));
		await instance.page.locator(".modal").getByRole("button", { name: "Save", exact: true }).click();
		await expect(editor).toHaveCount(0);
		const expected = explicit
			? enabled ? [`[[${prefix}-Personal]]`] : [`[[${prefix}-Homework]]`, `[[${prefix}-Personal]]`]
			: [`[[${prefix}-Homework]]`];
		await expect.poll(() => instance.page.evaluate((title) => {
			const app = (window as any).app;
			const file = app.vault.getMarkdownFiles().find((file: any) => file.basename === title);
			return file ? app.metadataCache.getFileCache(file)?.frontmatter?.projects : null;
		}, title)).toEqual(expected);
	});
}
