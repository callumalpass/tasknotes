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
	if (await modal().locator('.tn-task-modal__details-toggle').getAttribute('aria-expanded') === 'true') {
		await modal().locator('.tn-task-modal__details-toggle').click();
	}
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
	await expect(modal().locator(".title-input")).toHaveText(title);
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
		await modal().getByRole('button', { name: 'More fields', exact: true }).click();
		await expect(modal().locator(".title-input-detailed")).toHaveValue("Alpha");
		const tomorrowChips = modal().locator(".action-icon__label").filter({ hasText: "Tomorrow" });
		await expect(tomorrowChips).toHaveCount(1);

		await modal().locator('.tn-task-modal__details-toggle').click();
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
		await modal().getByRole('button', { name: 'More fields', exact: true }).click();
		await modal().locator(".title-input-detailed").fill(title);
		await modal().locator('.tn-task-modal__details-toggle').click();
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
		await modal().locator(".title-input").fill(title);
		await modal().locator('.tn-task-modal__details-toggle').click();
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
		await expect(modal().locator(".title-input")).toBeFocused();
		await expect(modal().locator("details.metadata-container")).not.toHaveAttribute("open");

		await expect(modal().getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
		await modal().locator(".tn-task-modal__overflow-button").click();
		await expect(page.locator(".menu-item").filter({ hasText: "Delete" })).toBeVisible();
		await page.keyboard.press("Escape");
		await modal().getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(modal()).toHaveCount(0);
	});
});

test.describe("linked items", () => {
	test.beforeEach(() => setNaturalLanguage(false));

	async function expand(): Promise<void> {
		const toggle = modal().locator(".tn-task-modal__details-toggle");
		if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
	}

	test("projects sit in the property row and scroll beneath it", async () => {
		await openEdit(`Project home ${Date.now()}`, { projects: ["[[Welcome]]"] });
		await expect(chip("projects")).toContainText("Welcome");
		await expand();
		const projects = modal().locator(".details-container .tn-task-modal__project-list .task-project-item");
		await expect(projects).toHaveCount(1);

		const covered = await page.evaluate(() => {
			const root = document.querySelector(".modal.mod-tasknotes")!;
			const pane = root.querySelector<HTMLElement>(".modal-split-left")!;
			const bar = root.querySelector<HTMLElement>(".tn-task-modal__action-bar")!;
			const link = root.querySelector<HTMLElement>(".tn-task-modal__project-list .internal-link")!;
			// A short pane forces scrolling; park the link halfway under the sticky row.
			pane.style.height = "160px";
			pane.scrollTop += link.getBoundingClientRect().top - bar.getBoundingClientRect().bottom + 4;
			const rect = link.getBoundingClientRect();
			const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 1);
			return rect.top < bar.getBoundingClientRect().bottom && bar.contains(hit);
		});
		expect(covered).toBe(true);
		await page.keyboard.press("Escape");
		await expect(modal()).toHaveCount(0);
	});

	test("dependency rows keep the title and short dates on one line", async () => {
		const blocker = await page.evaluate(async () => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			const { taskInfo } = await plugin.taskService.createTask({
				title: `A blocker with a long title that has to truncate before its dates ${Date.now()}`,
				due: "2025-12-31T17:00",
				scheduled: "2025-12-30T09:00",
			});
			return taskInfo.path.replace(/\.md$/, "");
		});
		await openEdit(`Blocked ${Date.now()}`, {
			blockedBy: [{ uid: `[[${blocker}]]`, reltype: "FINISHTOSTART" }],
		});
		await expand();
		const row = modal().locator(".tn-task-modal__task-row").first();
		await expect(row).toBeVisible();
		const due = row.locator(".task-card__date-slot--due .task-card__date-value--compact");
		await expect(due).toHaveText("Dec 31 17:00");

		const layout = await row.evaluate((card) => {
			const title = card.querySelector(".task-card__title-text")!.getBoundingClientRect();
			const date = card.querySelector(".task-card__date-slot--due")!.getBoundingClientRect();
			const remove = card.closest(".task-project-item")!.querySelector(".task-project-remove")!.getBoundingClientRect();
			return { height: card.getBoundingClientRect().height, dateHeight: date.height, titleEnd: title.right, dateStart: date.left, dateEnd: date.right, removeStart: remove.left };
		});
		expect(layout.height).toBeLessThanOrEqual(32);
		expect(layout.dateHeight).toBeLessThan(24);
		expect(layout.titleEnd).toBeLessThanOrEqual(layout.dateStart);
		expect(layout.dateEnd).toBeLessThanOrEqual(layout.removeStart);
		await page.keyboard.press("Escape");
		await expect(modal()).toHaveCount(0);
	});

	test("the disclosed title shows every wrapped line", async () => {
		await setNaturalLanguage(true);
		await openCreate({ title: "A title long enough to wrap onto a second line in the disclosed field row" });
		await expand();
		await modal().evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
		const title = modal().locator(".title-input-detailed");
		const fits = await title.evaluate((input) => input.scrollHeight <= input.clientHeight + 1);
		expect(fits).toBe(true);
		await modal().getByRole("button", { name: "Cancel", exact: true }).click();
		const discard = prompt().getByRole("button", { name: "Discard changes" });
		if (await discard.count()) await discard.click();
		await expect(modal()).toHaveCount(0);
	});
});
