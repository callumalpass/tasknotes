import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let obsidian: ObsidianApp;
let fixtureRoot: string;
let originalSettings: { excludedFolders: string; projectAutosuggest: unknown };

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	fixtureRoot = `Issue2390-${Date.now()}`;
	originalSettings = await obsidian.page.evaluate(async (root) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		const settings = JSON.parse(
			JSON.stringify({
				excludedFolders: plugin.settings.excludedFolders,
				projectAutosuggest: plugin.settings.projectAutosuggest,
			})
		);
		for (const folder of ["", "/Inbox", "/Inbox/Nested", "/InboxOther", "/Projects"]) {
			await app.vault.createFolder(root + folder);
		}
		const content = "---\ntype: project\ntags: [project]\n---\n";
		await app.vault.create(`${root}/Inbox/issue2390-excluded.md`, content);
		await app.vault.create(`${root}/Inbox/Nested/issue2390-nested.md`, content);
		await app.vault.create(`${root}/InboxOther/issue2390-sibling.md`, content);
		await app.vault.create(`${root}/Projects/issue2390-allowed.md`, content);
		const task = await app.vault.create(
			`${root}/Current.md`,
			"---\ntags: [task]\nstatus: open\n---\n"
		);
		await app.workspace.getLeaf(false).openFile(task);
		plugin.settings.excludedFolders = ` ${root}/Inbox/ `;
		plugin.settings.projectAutosuggest = {
			...plugin.settings.projectAutosuggest,
			requiredTags: [],
			includeFolders: [],
			propertyKey: "",
			propertyValue: "",
		};
		return settings;
	}, fixtureRoot);
	await expect
		.poll(() =>
			obsidian.page.evaluate(async () => {
				const app = (window as any).app;
				return Boolean(
					await app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(
						app.workspace.getActiveFile().path
					)
				);
			})
		)
		.toBe(true);
});

test.afterAll(async () => {
	if (!obsidian) return;
	try {
		if (originalSettings) {
			await obsidian.page.evaluate(
				async ({ settings, root }) => {
					const app = (window as any).app;
					Object.assign(app.plugins.plugins.tasknotes.settings, settings);
					const folder = app.vault.getAbstractFileByPath(root);
					if (folder) await app.vault.delete(folder, true);
				},
				{ settings: originalSettings, root: fixtureRoot }
			);
		}
	} finally {
		await closeObsidian(obsidian);
	}
});

for (const filter of ["none", "folders", "tags-and-property"]) {
	test(`excludes folders in Add to Project with ${filter} filters`, async () => {
		const page = obsidian.page;
		await page.evaluate(
			async ({ root, filter }) => {
				const plugin = (window as any).app.plugins.plugins.tasknotes;
				Object.assign(plugin.settings.projectAutosuggest, {
					includeFolders: filter === "folders" ? [root] : [],
					requiredTags: filter === "tags-and-property" ? ["project"] : [],
					propertyKey: filter === "tags-and-property" ? "type" : "",
					propertyValue: filter === "tags-and-property" ? "project" : "",
				});
				await plugin.addProjectToCurrentTask();
			},
			{ root: fixtureRoot, filter }
		);
		const prompt = page.locator(".prompt");
		await expect(prompt).toBeVisible();
		await prompt.locator(".prompt-input").fill("issue2390");
		await expect(
			prompt.locator(".suggestion-item").filter({ hasText: "issue2390-allowed" })
		).toBeVisible();
		await expect(
			prompt.locator(".suggestion-item").filter({ hasText: "issue2390-sibling" })
		).toBeVisible();
		await expect(
			prompt.locator(".suggestion-item").filter({ hasText: "issue2390-excluded" })
		).toHaveCount(0);
		await expect(
			prompt.locator(".suggestion-item").filter({ hasText: "issue2390-nested" })
		).toHaveCount(0);
		await page.keyboard.press("Escape");
	});
}
