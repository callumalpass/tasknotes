import { expect, test } from "@playwright/test";
import {
	closeObsidian,
	dismissObsidianModals,
	launchObsidian,
	type ObsidianApp,
} from "../obsidian";

let instance: ObsidianApp;
const folder = `e2e-issue-2537-${Date.now()}`;
const modal = () =>
	instance.page.locator(".modal").filter({ has: instance.page.locator(".nlp-editor") });
const editor = () => modal().locator(".nlp-editor .cm-content");
const titleField = () => modal().locator("textarea.title-input-detailed");

async function compose(text: string) {
	await instance.page.evaluate(() =>
		(window as any).app.plugins.plugins.tasknotes.openTaskCreationModal()
	);
	await expect(editor()).toBeVisible();
	await editor().click();
	await instance.page.keyboard.insertText(text);
}

async function moveBeforeSuffix(suffix: string) {
	await instance.page.keyboard.press("End");
	for (const _character of suffix) await instance.page.keyboard.press("ArrowLeft");
}

async function expectSaved(title: string) {
	await expect(modal()).toHaveCount(0);
	await expect
		.poll(() =>
			instance.page.evaluate(
				({ title, folder }) => {
					const { vault, metadataCache } = (window as any).app;
					for (const file of vault.getMarkdownFiles()) {
						if (file.parent?.path !== folder) continue;
						const properties = metadataCache.getFileCache(file)?.frontmatter;
						if (properties?.title === title) {
							return {
								scheduled: properties.scheduled ?? null,
								tags: properties.tags,
							};
						}
					}
					return null;
				},
				{ title, folder }
			)
		)
		.toEqual({ scheduled: null, tags: ["task"] });
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate((folder) => {
		const { settings } = (window as any).app.plugins.plugins.tasknotes;
		settings.enableNaturalLanguageInput = true;
		settings.nlpDefaultToScheduled = true;
		settings.taskCreationDefaults.defaultScheduledDate = "none";
		settings.storeTitleInFilename = false;
		settings.tasksFolder = folder;
	}, folder);
});

test.afterEach(async () => {
	if (instance) await dismissObsidianModals(instance.page);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const { vault } = (window as any).app;
			const created = vault.getAbstractFileByPath(folder);
			if (created) await vault.delete(created, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

test("releasing May 1 clears the scheduled preview and keeps the date in the form and saved title", async () => {
	const text = "Plan the May 1 launch";
	const highlight = editor().locator(".tn-nlp-highlight--scheduled");
	const scheduled = modal().locator('[data-type="scheduled-date"]');
	await compose(text);
	await expect(highlight).toHaveText("May 1");
	await expect(scheduled).toHaveClass(/has-value/);

	await moveBeforeSuffix(" launch");
	await instance.page.keyboard.press("Backspace");
	await expect(editor()).toHaveText(text);
	await expect(highlight).toHaveCount(0);
	await expect(scheduled).not.toHaveClass(/has-value/);

	await instance.page.keyboard.press("End");
	await instance.page.keyboard.insertText(" checklist");
	await expect(highlight).toHaveCount(0);
	await modal().getByRole("button", { name: "More fields" }).click();
	await expect(titleField()).toHaveValue(`${text} checklist`);
	await modal().getByRole("button", { name: "Create task", exact: true }).click();
	await expectSaved(`${text} checklist`);

	await compose(text);
	await expect(highlight).toHaveText("May 1");
});

test("releasing #2 keeps it in the title and Backspace then deletes normally", async () => {
	const text = "Review #2 draft";
	const highlight = editor().locator(".tn-nlp-highlight--tag");
	await compose(text);
	await expect(highlight).toHaveText("#2");

	await moveBeforeSuffix(" draft");
	await instance.page.keyboard.press("Backspace");
	await expect(editor()).toHaveText(text);
	await expect(highlight).toHaveCount(0);
	await instance.page.keyboard.press("Backspace");
	await expect(editor()).toHaveText("Review # draft");

	await instance.page.keyboard.insertText("2");
	await expect(highlight).toHaveText("#2");
	await instance.page.keyboard.press("Backspace");
	await expect(editor()).toHaveText(text);
	await expect(highlight).toHaveCount(0);
	await modal().getByRole("button", { name: "Create task", exact: true }).click();
	await expectSaved(text);
});
