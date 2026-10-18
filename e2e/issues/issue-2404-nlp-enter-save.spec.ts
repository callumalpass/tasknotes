import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
let original: { enableNaturalLanguageInput: boolean; nlpEnterToSubmit: boolean };
const prefix = `Release NLP ${Date.now()}`;
const editor = () => instance.page.locator(".modal .tn-task-modal__markdown-editor--nlp .cm-content");

async function open(enabled: boolean): Promise<void> {
	await instance.page.evaluate((enabled) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.settings.enableNaturalLanguageInput = true;
		plugin.settings.nlpEnterToSubmit = enabled;
		plugin.openTaskCreationModal();
	}, enabled);
	await expect(editor()).toBeVisible();
	await editor().click();
}

async function saved(title: string): Promise<boolean> {
	return instance.page.evaluate((title) => {
		const app = (window as any).app;
		return app.vault.getMarkdownFiles().some((file: any) =>
			file.basename === title && app.metadataCache.getFileCache(file)?.frontmatter?.tags?.includes("task")
		);
	}, title);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	instance.page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
	original = await instance.page.evaluate(() => {
		const s = (window as any).app.plugins.plugins.tasknotes.settings;
		return { enableNaturalLanguageInput: s.enableNaturalLanguageInput, nlpEnterToSubmit: s.nlpEnterToSubmit };
	});
});

test.afterEach(async () => {
	await instance.page.keyboard.press("Escape");
	const close = instance.page.locator(".modal-close-button").last();
	if (await close.isVisible()) await close.click();
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async ({ original, prefix }) => {
			const app = (window as any).app;
			Object.assign(app.plugins.plugins.tasknotes.settings, original);
			for (const file of app.vault.getMarkdownFiles()) {
				const title = file.basename;
				if (typeof title === "string" && title.startsWith(prefix)) await app.vault.delete(file);
			}
		}, { original, prefix });
	} finally {
		await closeObsidian(instance);
	}
});

test("Enter inserts a newline when the setting is off", async () => {
	const title = `${prefix} default`;
	await open(false);
	await instance.page.keyboard.insertText(title);
	await instance.page.keyboard.press("Enter");
	await expect(editor()).toBeVisible();
	await expect(editor().locator(".cm-line")).toHaveCount(2);
	expect(await saved(title)).toBe(false);
});

test("Enter saves when enabled", async () => {
	const title = `${prefix} enabled`;
	await open(true);
	await instance.page.keyboard.insertText(title);
	await instance.page.keyboard.press("Enter");
	await expect(editor()).toHaveCount(0);
	await expect.poll(() => saved(title)).toBe(true);
});

test("Shift+Enter remains a newline and Ctrl+Enter still saves", async () => {
	const title = `${prefix} modified`;
	await open(true);
	await instance.page.keyboard.insertText(title);
	await instance.page.keyboard.press("Shift+Enter");
	await expect(editor().locator(".cm-line")).toHaveCount(2);
	await instance.page.keyboard.press("Control+Enter");
	await expect(editor()).toHaveCount(0);
	await expect.poll(() => saved(title)).toBe(true);
});

test("Enter selects visible autocomplete rather than saving", async () => {
	await open(true);
	await instance.page.keyboard.insertText(`${prefix} completion `);
	await instance.page.keyboard.type("*op", { delay: 50 });
	await expect(editor()).toContainText("*op*");
	await expect(instance.page.locator(".cm-tooltip-autocomplete")).toBeVisible();
	await instance.page.keyboard.press("Enter");
	await expect(editor()).toBeVisible();
	await expect(instance.page.locator(".cm-tooltip-autocomplete")).toHaveCount(0);
	await expect(editor()).toContainText("*open");
	await expect(editor()).not.toContainText("*open*");
});
