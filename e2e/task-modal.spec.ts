import { test, expect, type Page } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "./obsidian";

let obsidian: ObsidianApp;
let page: Page;

const modal = () => page.locator(".modal.mod-tasknotes").last();
const nlEditor = () => modal().locator(".nlp-editor .cm-content, .tn-task-modal__markdown-editor--nlp .cm-content").first();
const chip = (type: string) => modal().locator(`[data-type="${type}"]`);
const prompt = () => page.locator(".modal").filter({ hasText: "Unsaved changes" });

async function setNaturalLanguage(enabled: boolean): Promise<void> {
	await page.evaluate((enabled) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.settings.enableNaturalLanguageInput = enabled;
		plugin.settings.openTaskAfterCreation = "none";
		plugin.i18n.setLocale("en");
	}, enabled);
}

async function openCreate(prePopulated?: Record<string, unknown>): Promise<void> {
	await page.evaluate((values) => {
		(window as any).app.plugins.plugins.tasknotes.openTaskCreationModal(values);
	}, prePopulated);
	await expect(modal()).toBeVisible();
}

async function openEdit(title: string, fields: Record<string, unknown> = {}): Promise<void> {
	await page.evaluate(
		async ({ title, fields }) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			const { taskInfo } = await plugin.taskService.createTask({ title, ...fields });
			await plugin.openTaskEditModal(taskInfo);
		},
		{ title, fields }
	);
	await expect(modal().locator("textarea.title-input")).toHaveValue(title);
}

async function tasksTitled(title: string): Promise<number> {
	return page.evaluate(async (title) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const tasks = await plugin.cacheManager.getAllTasks();
		return tasks.filter((task: { title: string }) => task.title === title).length;
	}, title);
}

async function taskField(title: string, field: string): Promise<unknown> {
	return page.evaluate(
		async ({ title, field }) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			const tasks = await plugin.cacheManager.getAllTasks();
			return tasks.find((task: { title: string }) => task.title === title)?.[field];
		},
		{ title, field }
	);
}

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	page = obsidian.page;
});

test.afterAll(async () => {
	if (obsidian) await closeObsidian(obsidian);
});

test.describe("saving", () => {
	test("repeated shortcuts create one task", async () => {
		await setNaturalLanguage(true);
		const title = `Double submit ${Date.now()}`;
		await openCreate();
		await nlEditor().click();
		await page.keyboard.type(title);
		await page.keyboard.press("Control+Enter");
		await page.keyboard.press("Control+Enter");
		await expect(modal()).toHaveCount(0);
		await expect.poll(() => tasksTitled(title)).toBe(1);
		await page.waitForTimeout(300);
		expect(await tasksTitled(title)).toBe(1);
	});
});

test.describe("natural language", () => {
	test.beforeEach(() => setNaturalLanguage(true));

	test("the form follows the text, and removing text restores the field", async () => {
		await openCreate();
		await nlEditor().click();
		await page.keyboard.type("Alpha tomorrow");
		await modal().locator('[aria-label="Show detailed options"]').click();
		await expect(modal().locator(".title-input-detailed")).toHaveValue("Alpha");
		const tomorrowChips = modal().locator(".action-icon__label").filter({ hasText: "Tomorrow" });
		await expect(tomorrowChips).toHaveCount(1);

		await nlEditor().click();
		await page.keyboard.press("Control+A");
		await page.keyboard.type("Beta");
		await expect(modal().locator(".title-input-detailed")).toHaveValue("Beta");
		await expect(tomorrowChips).toHaveCount(0);

		await modal().getByRole("button", { name: "Cancel", exact: true }).click();
		await prompt().getByRole("button", { name: "Discard changes" }).click();
		await expect(modal()).toHaveCount(0);
	});

	test("manual edits win over later text", async () => {
		const title = `Manual title ${Date.now()}`;
		await openCreate();
		await nlEditor().click();
		await page.keyboard.type("Typed");
		await modal().locator('[aria-label="Show detailed options"]').click();
		await modal().locator(".title-input-detailed").fill(title);
		await nlEditor().click();
		await page.keyboard.type(" more");
		await expect(modal().locator(".title-input-detailed")).toHaveValue(title);
		await modal().locator(".mod-cta").click();
		await expect.poll(() => tasksTitled(title)).toBe(1);
	});

	test("text typed next to a prefilled title is kept", async () => {
		const title = `Typed over prefill ${Date.now()}`;
		await openCreate({ title: "Prefilled" });
		await expect(modal().locator(".title-input-detailed")).toHaveValue("Prefilled");
		await nlEditor().click();
		await page.keyboard.type(title);
		await expect(modal().locator(".title-input-detailed")).toHaveValue(title);
		await modal().locator(".mod-cta").click();
		await expect.poll(() => tasksTitled(title)).toBe(1);
	});
});

test.describe("leaving the form", () => {
	test("Escape asks before dropping a draft", async () => {
		await setNaturalLanguage(true);
		await openCreate();
		await nlEditor().click();
		await page.keyboard.type("Draft worth keeping");
		await page.keyboard.press("Escape");
		await expect(prompt()).toBeVisible();
		await prompt().getByRole("button", { name: "Keep editing" }).click();
		await expect(nlEditor()).toContainText("Draft worth keeping");

		await page.keyboard.press("Escape");
		await prompt().getByRole("button", { name: "Discard changes" }).click();
		await expect(modal()).toHaveCount(0);
	});

	test("Escape still closes after focus leaves a markdown editor", async () => {
		await setNaturalLanguage(true);
		await openCreate();
		await nlEditor().click();
		await chip("status").focus();
		await page.keyboard.press("Escape");
		await expect(modal()).toHaveCount(0);
	});
});

test.describe("fields", () => {
	test.beforeEach(() => setNaturalLanguage(false));

	test("time estimates accept durations and reject anything else inline", async () => {
		const title = `Estimate ${Date.now()}`;
		await openCreate();
		await modal().locator("textarea.title-input").fill(title);
		const estimate = modal().locator(".setting-item").filter({ hasText: "Time estimate" }).locator("input");
		await expect(estimate).toHaveValue("");

		await estimate.fill("soon");
		await modal().locator(".mod-cta").click();
		await expect(modal().locator(".tn-task-modal__field-error")).toBeVisible();
		await expect.poll(() => tasksTitled(title)).toBe(0);

		await estimate.fill("1h");
		await expect(modal().locator(".tn-task-modal__field-error")).toHaveCount(0);
		await modal().locator(".mod-cta").click();
		await expect(modal()).toHaveCount(0);
		await expect.poll(() => taskField(title, "timeEstimate")).toBe(60);
	});

	test("chips show current values and the edit form leads with the title", async () => {
		await openEdit(`Chips ${Date.now()}`, { due: "2030-06-26T14:30" });

		await expect(chip("due-date")).toContainText("Jun 26, 2030");
		await expect(chip("due-date")).toHaveAttribute("aria-label", /Due: Jun 26, 2030/);
		await expect(modal().locator("textarea.title-input")).toBeFocused();
		await expect(modal().locator("details.metadata-container")).not.toHaveAttribute("open");

		await expect(modal().getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
		await modal().locator(".tn-task-modal__overflow-button").click();
		await expect(page.locator(".menu-item").filter({ hasText: "Delete" })).toBeVisible();
		await page.keyboard.press("Escape");
		await modal().getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(modal()).toHaveCount(0);
	});
});
