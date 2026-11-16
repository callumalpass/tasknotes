/**
 * Issue #2559: completing a recurring task from a Bases task list showed
 * "Failed to execute 'structuredClone' on 'Window'" and the completion failed.
 *
 * Bases attaches its entry to TaskInfo as `basesData`; that entry holds the
 * Obsidian app (functions, DOM), which structuredClone cannot copy. The
 * recurring completion Undo receipt cloned the whole TaskInfo.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2559
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue 2559 ${Date.now()}`;
const taskPath = `${folder}/Daily standup.md`;
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

const statusDot = (): Locator =>
	page
		.locator(`.workspace-leaf.mod-active [data-task-path="${taskPath}"] .task-card__status-dot`)
		.first();

async function frontmatter(): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath);
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function noticeTexts(): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll(".notice")).map((n) => n.textContent ?? "")
	);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	original = await page.evaluate(
		async ({ folder, taskPath, today, statuses }) => {
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
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const base = await app.vault.create(
				`${folder}/Tasks.base`,
				`filters:\n  and:\n    - file.inFolder("${folder}")\n    - list(note[\"type\"]).contains(\"task\")\nviews:\n  - type: tasknotesTaskList\n    name: Incomplete Tasks\n    order:\n      - status\n      - priority\n      - due\n      - scheduled\n      - recurrence\n      - complete_instances\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
			document.querySelectorAll(".notice").forEach((notice) => notice.remove());
			return { customStatuses, defaultTaskStatus };
		},
		{ folder, taskPath, today, statuses: reporterStatuses }
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
	await expect.poll(async () => (await noticeTexts()).join("\n")).toContain("Completed occurrence");
	expect((await noticeTexts()).join("\n")).not.toMatch(/structuredClone|Failed to update/);
});
