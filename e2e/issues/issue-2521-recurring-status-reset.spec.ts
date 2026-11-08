import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

// #2521: an existing setup whose Done status reopens at the default status
// ("Next status: inbox") had every recurring completion reset the series to
// inbox, from the Kanban status click and the context menu alike.

const root = `Issue 2521 ${Date.now()}`;
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
const inTwoDays = localDate(2);
const rule = `DTSTART:${today.replaceAll("-", "")};FREQ=DAILY;INTERVAL=2`;
const taskPath = (name: string) => `${folder}/${name}.md`;
const card = (name: string): Locator =>
	page.locator(`.workspace-leaf.mod-active [data-task-path="${taskPath(name)}"]`).first();

async function yaml(name: string): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath(name));
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

// The reporter's statuses: a custom workflow whose Done reopens at the default.
async function useReporterStatuses(resetRecurringStatus?: boolean): Promise<void> {
	await page.evaluate((resetRecurringStatus) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const statuses = [
			{ value: "inbox" },
			{ value: "do-next" },
			{ value: "calendar" },
			{ value: "waiting" },
			{ value: "done", isCompleted: true, nextStatus: "inbox" },
		];
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
		plugin.settings.defaultTaskStatus = "inbox";
		if (resetRecurringStatus === undefined) {
			delete plugin.settings.resetRecurringStatusAfterOccurrence;
		} else {
			plugin.settings.resetRecurringStatusAfterOccurrence = resetRecurringStatus;
		}
	}, resetRecurringStatus);
}

async function boardWithRecurringTask(name: string): Promise<void> {
	await page.evaluate(
		async ({ folder, path, name, today, rule }) => {
			const app = (window as any).app;
			await app.vault.create(
				path,
				`---\ntags: [task]\ntitle: ${name}\nstatus: calendar\npriority: normal\nscheduled: ${today}\nrecurrence: "${rule}"\nrecurrence_anchor: scheduled\n---\n`
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
	await expect(card(name).locator(".task-card__status-dot")).toBeVisible();
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

test("clicking a recurring Kanban card's status completes today and keeps the status", async () => {
	await useReporterStatuses(false);
	await boardWithRecurringTask("Exercise");

	await card("Exercise").locator(".task-card__status-dot").click();

	await expect.poll(async () => (await yaml("Exercise")).scheduled).toBe(inTwoDays);
	const finished = await yaml("Exercise");
	expect(finished.complete_instances).toEqual([today]);
	expect(finished.status).toBe("calendar");
});

test("Completed on schedule from the context menu keeps the status", async () => {
	await useReporterStatuses(false);
	await boardWithRecurringTask("Exercise");

	await card("Exercise").click({ button: "right" });
	await page.locator(".menu-item").filter({ hasText: "Mark complete or skip" }).hover();
	await page.locator(".menu-item").filter({ hasText: "Completed on schedule" }).click();

	await expect.poll(async () => (await yaml("Exercise")).scheduled).toBe(inTwoDays);
	const finished = await yaml("Exercise");
	expect(finished.complete_instances).toEqual([today]);
	expect(finished.status).toBe("calendar");
});

test("with the reset turned on, completing moves the series to Done's next status", async () => {
	await useReporterStatuses(true);
	await boardWithRecurringTask("Exercise");

	await card("Exercise").click({ button: "right" });
	await page.locator(".menu-item").filter({ hasText: "Mark complete or skip" }).hover();
	await page.locator(".menu-item").filter({ hasText: "Completed on schedule" }).click();

	await expect.poll(async () => (await yaml("Exercise")).scheduled).toBe(inTwoDays);
	expect((await yaml("Exercise")).status).toBe("inbox");
});
