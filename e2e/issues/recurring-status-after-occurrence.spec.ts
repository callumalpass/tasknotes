import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const root = `Recurring next status ${Date.now()}`;
let folder = root;
let instance: ObsidianApp;
let page: Page;
let original: { customStatuses: unknown; defaultTaskStatus: string };

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
const notice = (name: string): Locator => page.locator(".notice").filter({ hasText: name });

async function yaml(name: string): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath(name));
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function setStatuses(statuses: Record<string, unknown>[], defaultTaskStatus: string) {
	await page.evaluate(
		({ statuses, defaultTaskStatus }) => {
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
			plugin.settings.defaultTaskStatus = defaultTaskStatus;
		},
		{ statuses, defaultTaskStatus }
	);
}

async function completeOccurrence(name: string, status: string): Promise<void> {
	await page.evaluate(
		async ({ path, name, status, today, rule }) => {
			const app = (window as any).app;
			await app.vault.create(
				path,
				`---\ntags: [task]\ntitle: ${name}\nstatus: ${status}\npriority: normal\nscheduled: ${today}\nrecurrence: "${rule}"\n---\n`
			);
			const plugin = app.plugins.plugins.tasknotes;
			let task = null;
			for (let attempt = 0; attempt < 50 && !task?.recurrence; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				task = await plugin.cacheManager.getTaskInfo(path);
			}
			await plugin.toggleRecurringTaskComplete(task);
		},
		{ path: taskPath(name), name, status, today, rule }
	);
	await expect.poll(async () => (await yaml(name)).scheduled).toBe(nextWeek);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	original = await page.evaluate(async (root) => {
		const app = (window as any).app;
		await app.vault.createFolder(root);
		const { customStatuses, defaultTaskStatus } = app.plugins.plugins.tasknotes.settings;
		return { customStatuses, defaultTaskStatus };
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

test("a series keeps its status when no next status is set on Done", async () => {
	await setStatuses(
		[{ value: "open" }, { value: "doing" }, { value: "done", isCompleted: true }],
		"open"
	);

	await completeOccurrence("Weekly", "doing");

	expect((await yaml("Weekly")).status).toBe("doing");
});

test("a series moves to Done's next status, and Undo restores the status it had", async () => {
	await setStatuses(
		[
			{ value: "open" },
			{ value: "doing" },
			{ value: "done", isCompleted: true, nextStatus: "open" },
		],
		"open"
	);

	await completeOccurrence("Weekly", "doing");

	expect((await yaml("Weekly")).status).toBe("open");
	await notice("Weekly").getByRole("button", { name: "Undo", exact: true }).click();
	await expect.poll(async () => (await yaml("Weekly")).status).toBe("doing");
	expect((await yaml("Weekly")).scheduled).toBe(today);
});

test("a default status outside the workflow does not capture the series", async () => {
	await setStatuses(
		[
			{ value: "inbox" },
			{ value: "todo" },
			{ value: "doing" },
			{ value: "done", isCompleted: true, nextStatus: "todo" },
		],
		"inbox"
	);

	await completeOccurrence("Weekly", "doing");

	expect((await yaml("Weekly")).status).toBe("todo");
});

test("a series already at the next status is left as it is", async () => {
	await setStatuses(
		[{ value: "todo" }, { value: "done", isCompleted: true, nextStatus: "todo" }],
		"todo"
	);

	await completeOccurrence("Weekly", "todo");

	expect((await yaml("Weekly")).status).toBe("todo");
});
