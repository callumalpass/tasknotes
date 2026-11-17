/**
 * Issue #2559: in a Bases task list filtered on `type: task`, notes that
 * TaskNotes' own task identification does not match could not be completed.
 * Recurring tasks showed "Failed to execute 'structuredClone' on 'Window'";
 * non-recurring tasks showed "Task not found".
 *
 * Bases attaches its entry to TaskInfo as `basesData`; that entry holds the
 * Obsidian app (functions, DOM), which structuredClone cannot copy. The
 * recurring completion Undo receipt cloned the whole TaskInfo. The status
 * click on a non-recurring card required a cached task, which such notes lack.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2559
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue 2559 ${Date.now()}`;
const taskPath = `${folder}/Daily standup.md`;
const oneOffPath = `${folder}/Send report.md`;
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

// The reporter's status workflow: open → in-progress → resolved → done.
const reporterStatuses = [
	{ value: "open", nextStatus: "in-progress" },
	{ value: "in-progress", nextStatus: "resolved" },
	{ value: "resolved", nextStatus: "done" },
	{ value: "done", isCompleted: true },
	{ value: "blocked", nextStatus: "in-progress" },
];

const statusDot = (path = taskPath): Locator =>
	page
		.locator(`.workspace-leaf.mod-active [data-task-path="${path}"] .task-card__status-dot`)
		.first();

async function frontmatter(path = taskPath): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, path);
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function noticeTexts(): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll(".notice, .tn-toast")).map((n) => n.textContent ?? "")
	);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	original = await page.evaluate(
		async ({ folder, taskPath, oneOffPath, today, statuses }) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins.tasknotes;
			const { customStatuses, defaultTaskStatus } = plugin.settings;
			plugin.settings.customStatuses = statuses.map((status: any, order: number) => ({
				id: status.value,
				label: status.value,
				color: "#808080",
				isCompleted: false,
				excludeFromCycle: false,
				autoArchive: false,
				autoArchiveDelay: 5,
				order,
				...status,
			}));
			plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
			plugin.settings.defaultTaskStatus = "open";
			app.workspace.leftSplit.collapse();
			app.workspace.rightSplit.collapse();
			await app.vault.createFolder(folder);
			// The reporter's frontmatter, with the schedule moved to today.
			await app.vault.create(
				taskPath,
				[
					"---",
					"status: open",
					"priority: normal",
					`scheduled: ${today}T08:30`,
					"dateCreated: 2026-10-05T08:10:37.821-04:00",
					"dateModified: 2026-11-11T14:38:43.585-05:00",
					"type: task",
					"recurrence: DTSTART:20261005;FREQ=DAILY",
					"due: 2026-10-20T09:00",
					"complete_instances:",
					"  - 2026-11-09",
					"  - 2026-11-11",
					"skipped_instances: []",
					"timeEstimate: 30",
					"---",
					"",
				].join("\n")
			);
			await app.vault.create(
				oneOffPath,
				"---\nstatus: open\npriority: normal\ntype: task\ndue: 2026-10-20T09:00\n---\n"
			);
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const base = await app.vault.create(
				`${folder}/Tasks.base`,
				`filters:\n  and:\n    - file.inFolder("${folder}")\n    - list(note[\"type\"]).contains(\"task\")\nviews:\n  - type: tasknotesTaskList\n    name: Incomplete Tasks\n    order:\n      - status\n      - priority\n      - due\n      - scheduled\n      - recurrence\n      - complete_instances\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
			document.querySelectorAll(".notice, .tn-toast").forEach((notice) => notice.remove());
			return { customStatuses, defaultTaskStatus };
		},
		{ folder, taskPath, oneOffPath, today, statuses: reporterStatuses }
	);
	await expect(statusDot()).toBeVisible();
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(
				async ({ folder, original }) => {
					const app = (window as any).app;
					const plugin = app.plugins.plugins.tasknotes;
					Object.assign(plugin.settings, original);
					plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
					for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
					const fixture = app.vault.getAbstractFileByPath(folder);
					if (fixture) await app.vault.delete(fixture, true);
				},
				{ folder, original }
			);
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("clicking a recurring Bases task's status completes today's occurrence", async () => {
	// The reporter's note is a task only by `type: task`, so the completion
	// works from the card's TaskInfo, which carries the Bases entry.
	await statusDot().dispatchEvent("click");
	await expect
		.poll(async () => (await frontmatter()).complete_instances, { timeout: 5000 })
		.toContain(today);
	// v5 confirms a status-dot completion with an Undo toast.
	await expect.poll(async () => (await noticeTexts()).join("\n")).toContain("1 task updated");
	expect((await noticeTexts()).join("\n")).not.toMatch(/structuredClone|Failed to update/);
	// The Undo receipt was built without copying the Bases entry, so Undo works.
	await page.locator(".tn-toast").getByRole("button", { name: "Undo", exact: true }).click();
	await expect
		.poll(async () => (await frontmatter()).complete_instances, { timeout: 5000 })
		.not.toContain(today);
});

test("clicking a non-recurring Bases task's status moves it to the next status", async () => {
	// Reported in the same issue: "Task not found" for the same kind of note.
	await page.evaluate(() => document.querySelectorAll(".notice, .tn-toast").forEach((n) => n.remove()));
	await statusDot(oneOffPath).dispatchEvent("click");
	await expect
		.poll(async () => (await frontmatter(oneOffPath)).status, { timeout: 5000 })
		.toBe("in-progress");

	// The next click reads the task TaskNotes cached from that update.
	await statusDot(oneOffPath).dispatchEvent("click");
	await expect
		.poll(async () => (await frontmatter(oneOffPath)).status, { timeout: 5000 })
		.toBe("resolved");
	expect((await noticeTexts()).join("\n")).not.toMatch(/Task not found|Failed to update/);
});
