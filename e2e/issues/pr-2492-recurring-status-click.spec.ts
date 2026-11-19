import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const root = `Recurring status click ${Date.now()}`;
let folder = root;
let instance: ObsidianApp;
let page: Page;
let original: Record<string, unknown>;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = localDate();
const nextWeek = localDate(7);
const rule = `DTSTART:${today.replaceAll("-", "")};FREQ=WEEKLY`;
const taskPath = (name: string) => `${folder}/${name}.md`;
const statusDot = (name: string): Locator =>
	page
		.locator(`.workspace-leaf.mod-active [data-task-path="${taskPath(name)}"] .task-card__status-dot`)
		.first();

// TaskNotes' built-in statuses, with or without Done moving on to Open.
const builtInStatuses = (doneNextStatus?: string) => [
	{ value: "none" },
	{ value: "open" },
	{ value: "in-progress" },
	{ value: "done", isCompleted: true, ...(doneNextStatus ? { nextStatus: doneNextStatus } : {}) },
];

async function yaml(name: string): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath(name));
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function setStatuses(statuses: Record<string, unknown>[]): Promise<void> {
	await page.evaluate((statuses) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.settings.customStatuses = statuses.map((status, order) => ({
			id: status.value,
			label: status.value,
			color: "#808080",
			isCompleted: false,
			autoArchive: false,
			autoArchiveDelay: 5,
			order,
			...status,
		}));
		plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
		plugin.settings.defaultTaskStatus = "open";
		plugin.settings.resetRecurringStatusAfterOccurrence = true;
	}, statuses);
}

async function boardWithRecurringTask(name: string): Promise<void> {
	await page.evaluate(
		async ({ folder, path, name, today, rule }) => {
			const app = (window as any).app;
			await app.vault.create(
				path,
				`---\ntags: [task]\ntitle: ${name}\nstatus: open\npriority: normal\nscheduled: ${today}\nrecurrence: "${rule}"\n---\n`
			);
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const board = await app.vault.create(
				`${folder}/Board.base`,
				`filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: status\n      direction: ASC\n    order:\n      - status\n      - scheduled\n`
			);
			await app.workspace.getLeaf("tab").openFile(board);
		},
		{ folder, path: taskPath(name), name, today, rule }
	);
	await expect(statusDot(name)).toBeVisible();
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	original = await page.evaluate(async (root) => {
		const app = (window as any).app;
		await app.vault.createFolder(root);
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
		const { customStatuses, defaultTaskStatus, resetRecurringStatusAfterOccurrence } =
			app.plugins.plugins.tasknotes.settings;
		return { customStatuses, defaultTaskStatus, resetRecurringStatusAfterOccurrence };
	}, root);
});

test.beforeEach(async () => {
	folder = `${root}/${Date.now()}`;
	await page.evaluate(async (folder) => {
		await (window as any).app.vault.createFolder(folder);
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
	}, folder);
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(
				async ({ root, original }) => {
					const app = (window as any).app;
					const plugin = app.plugins.plugins.tasknotes;
					Object.assign(plugin.settings, original);
					plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
					for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
					const fixture = app.vault.getAbstractFileByPath(root);
					if (fixture) await app.vault.delete(fixture, true);
				},
				{ root, original }
			);
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("a recurring card follows the status cycle, and Done completes its occurrence", async () => {
	await setStatuses(builtInStatuses("open"));
	await boardWithRecurringTask("Weekly review");

	await statusDot("Weekly review").click();
	await expect.poll(async () => (await yaml("Weekly review")).status).toBe("in-progress");
	expect((await yaml("Weekly review")).scheduled).toBe(today);
	expect((await yaml("Weekly review")).complete_instances ?? []).toEqual([]);

	await statusDot("Weekly review").click();
	await expect.poll(async () => (await yaml("Weekly review")).scheduled).toBe(nextWeek);
	const finished = await yaml("Weekly review");
	expect(finished.complete_instances).toEqual([today]);
	expect(finished.status).toBe("open");
});

test("without a status after Done, one click still completes the occurrence", async () => {
	await setStatuses(builtInStatuses());
	await boardWithRecurringTask("Daily habit");

	await statusDot("Daily habit").click();
	await expect.poll(async () => (await yaml("Daily habit")).scheduled).toBe(nextWeek);
	const finished = await yaml("Daily habit");
	expect(finished.complete_instances).toEqual([today]);
	expect(finished.status).toBe("open");
});
