import { test, expect, type Page } from "@playwright/test";
import { stringify } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "./obsidian";

const folder = `Occurrence search ${Date.now()}`;
const parentTitle = `Weekly review ${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

async function createTask(name: string, fields: Record<string, unknown>): Promise<void> {
	await page.evaluate(
		async ({ path, body }) => {
			await (window as any).app.vault.create(path, body);
		},
		{
			path: `${folder}/${name}.md`,
			body: `---\n${stringify({ tags: ["task"], status: "open", priority: "normal", ...fields })}---\n`,
		}
	);
}

const modal = () => page.locator(".task-selector-with-create-modal");
const input = () => modal().locator(".prompt-input");
const rows = () => modal().locator(".suggestion-item");
const parentRow = () => rows().filter({ hasText: parentTitle });

async function openSelector(): Promise<void> {
	await page.evaluate(() => {
		void (window as any).app.plugins.plugins.tasknotes.openTaskSelectorWithCreate();
	});
	await expect(modal()).toBeVisible();
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	await page.evaluate(async (folder) => {
		await (window as any).app.vault.createFolder(folder);
	}, folder);

	await createTask(parentTitle, {
		title: parentTitle,
		recurrence: "DTSTART:20260504;FREQ=WEEKLY",
	});
	for (const date of ["2026-05-25", "2026-06-01", "2026-06-08"]) {
		await createTask(`${parentTitle} ${date}`, {
			title: parentTitle,
			recurrence_parent: `[[${folder}/${parentTitle}]]`,
			occurrence_date: date,
		});
	}
	await expect
		.poll(() =>
			page.evaluate(async (title) => {
				const tasks = await (
					window as any
				).app.plugins.plugins.tasknotes.cacheManager.getAllTasks();
				return tasks.filter((task: any) => task.title === title).length;
			}, parentTitle)
		)
		.toBe(4);
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(async (folder) => {
				const app = (window as any).app;
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			}, folder);
		}
	} finally {
		await closeObsidian(instance);
	}
});

test("task selector lists a recurring task once and drills into its occurrence notes", async () => {
	await openSelector();
	await input().fill(parentTitle);
	await expect(rows()).toHaveCount(1);
	await expect(parentRow().locator(".task-selector-modal__occurrence-count")).toHaveText(
		"3 occurrence notes"
	);

	await input().press("Tab");
	await expect(input()).toHaveAttribute(
		"placeholder",
		new RegExp(`Occurrence notes of ${parentTitle}`)
	);
	await expect(rows()).toHaveCount(4);
	await expect(rows().nth(1)).toContainText("Jun 8");
	await expect(rows().nth(3)).toContainText("May 25");

	await input().fill("2026-06");
	await expect(rows()).toHaveCount(2);

	await input().fill("");
	await input().press("Backspace");
	await expect(input()).not.toHaveAttribute("placeholder", /Occurrence notes of/);

	await input().fill(`${parentTitle} 2026-06-01`);
	await expect(rows()).toHaveCount(1);
	await expect(rows().first()).toContainText("Jun 1");

	await input().fill(parentTitle);
	await parentRow().locator(".task-selector-modal__occurrence-count").click();
	await expect(modal()).toBeVisible();
	await expect(rows()).toHaveCount(4);

	await input().press("Escape");
	await expect(modal()).toBeHidden();
});
