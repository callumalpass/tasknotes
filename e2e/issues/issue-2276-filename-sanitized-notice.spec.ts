import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

// Issue #2276: titles with characters that filenames cannot contain kept the
// full title property, but the file Obsidian shows was renamed silently.
let obsidian: ObsidianApp;

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	await obsidian.page.evaluate(() => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		(window as any).__issue2276Settings = {
			enableNaturalLanguageInput: plugin.settings.enableNaturalLanguageInput,
			openTaskAfterCreation: plugin.settings.openTaskAfterCreation,
			storeTitleInFilename: plugin.settings.storeTitleInFilename,
		};
		plugin.settings.enableNaturalLanguageInput = false;
		plugin.settings.openTaskAfterCreation = "none";
		plugin.settings.storeTitleInFilename = true;
		plugin.i18n.setLocale("en");
	});
});

test.afterAll(async () => {
	if (!obsidian) return;
	await obsidian.page.evaluate(() => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		Object.assign(plugin.settings, (window as any).__issue2276Settings);
	});
	await closeObsidian(obsidian);
});

test("creating a task with / in its title names the sanitized file", async () => {
	const page = obsidian.page;
	const title = `Review https://tasknotes.dev/obsidian/ ${Date.now()}`;
	await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
	const modal = page.locator(".modal.mod-tasknotes");
	await modal.locator("textarea.title-input, textarea.title-input-detailed").fill(title);
	await modal.getByRole("button", { name: "Save", exact: true }).click();

	const filename = title.replace(/[:/]/g, "");
	await expect(
		page.locator(".notice").filter({ hasText: `created as file "${filename}"` })
	).toBeVisible();

	const saved = await page.evaluate((filename) => {
		const app = (window as any).app;
		const file = app.vault.getMarkdownFiles().find((f: any) => f.basename === filename);
		return file ? app.metadataCache.getFileCache(file)?.frontmatter?.title : null;
	}, filename);
	expect(saved).toBe(title);
});
