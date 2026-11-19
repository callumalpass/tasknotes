/**
 * Issue #2274: NLP set to Italian still parses like English.
 *
 * Switching the NLP language in settings must take effect without reloading
 * the plugin, in both the task creation modal and instant task conversion.
 */
import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
let original: { language: string; nlp: boolean };
const NOTE = "TN-2274 Italian NLP.md";
const editor = () => instance.page.locator(".modal .tn-task-modal__markdown-editor--nlp .cm-content");

test.beforeAll(async () => {
	instance = await launchObsidian();
	// Change the language the way the settings dropdown does: after the plugin has loaded.
	original = await instance.page.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const previous = {
			language: plugin.settings.nlpLanguage,
			nlp: plugin.settings.enableNaturalLanguageInput,
		};
		plugin.settings.nlpLanguage = "it";
		plugin.settings.enableNaturalLanguageInput = true;
		await plugin.saveSettings();
		return previous;
	});
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(
			async ({ original, note }) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins.tasknotes;
				plugin.settings.nlpLanguage = original.language;
				plugin.settings.enableNaturalLanguageInput = original.nlp;
				await plugin.saveSettings();
				for (const path of [note, ...((window as any).__tn2274Created ?? [])]) {
					const file = app.vault.getAbstractFileByPath(path);
					if (file) await app.vault.delete(file);
				}
			},
			{ original, note: NOTE }
		);
	} finally {
		await closeObsidian(instance);
	}
});

test("task creation modal parses Italian dates", async () => {
	await instance.page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
	await expect(editor()).toBeVisible();
	await editor().click();
	await instance.page.keyboard.insertText("Comprare latte oggi");

	await expect(editor().locator(".tn-nlp-highlight--scheduled")).toHaveText("oggi");
	await instance.page.keyboard.press("Escape");
});

test("instant convert parses Italian dates", async () => {
	const result = await instance.page.evaluate(async (note) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		const file = await app.vault.create(note, "- [ ] Comprare latte oggi\n");
		const leaf = app.workspace.getLeaf(true);
		await leaf.openFile(file);
		const editor = leaf.view.editor;
		editor.setCursor({ line: 0, ch: 0 });

		const before = new Set(app.vault.getMarkdownFiles().map((f: any) => f.path));
		await plugin.convertTaskToTaskNote(editor);
		const created = app.vault
			.getMarkdownFiles()
			.map((f: any) => f.path)
			.filter((path: string) => !before.has(path));
		(window as any).__tn2274Created = created;
		await new Promise((resolve) => setTimeout(resolve, 500));
		const task = created.length ? await plugin.cacheManager.getTaskInfo(created[0]) : null;
		leaf.detach();
		return { title: task?.title, scheduled: task?.scheduled };
	}, NOTE);

	const today = await instance.page.evaluate(() => (window as any).moment().format("YYYY-MM-DD"));
	expect(result).toEqual({ title: "Comprare latte", scheduled: today });
});
