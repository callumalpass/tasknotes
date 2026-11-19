import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "./obsidian";

let instance: ObsidianApp;
let original: boolean;
const editor = () => instance.page.locator(".modal .tn-task-modal__markdown-editor--nlp .cm-content");

test.beforeAll(async () => {
	instance = await launchObsidian();
	original = await instance.page.evaluate(() => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const value = plugin.settings.enableNaturalLanguageInput;
		plugin.settings.enableNaturalLanguageInput = true;
		return value;
	});
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate((original) => {
			(window as any).app.plugins.plugins.tasknotes.settings.enableNaturalLanguageInput = original;
		}, original);
	} finally {
		await closeObsidian(instance);
	}
});

test("highlights the parts of the input the parser recognised", async () => {
	await instance.page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
	await expect(editor()).toBeVisible();
	await editor().click();
	await instance.page.keyboard.insertText("Weekly review tomorrow at 3pm @office 30m");

	const highlights = editor().locator(".tn-nlp-highlight");
	await expect
		.poll(async () =>
			highlights.evaluateAll((elements) =>
				elements.map((element) => [
					[...element.classList].find((name) => name.startsWith("tn-nlp-highlight--")),
					element.textContent,
				])
			)
		)
		.toEqual([
			["tn-nlp-highlight--recurrence", "Weekly"],
			["tn-nlp-highlight--scheduled", "tomorrow at 3pm"],
			["tn-nlp-highlight--context", "@office"],
			["tn-nlp-highlight--estimate", "30m"],
		]);

	await instance.page.keyboard.press("Escape");
});
