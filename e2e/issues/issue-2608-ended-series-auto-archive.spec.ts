import { test, expect, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

// #2608: completing the last occurrence of a COUNT series completes the task,
// so an auto-archive status applies to it; reopening that occurrence reopens it.

const folder = `Issue 2608 archive ${Date.now()}`;
const taskPath = `${folder}/Bounded series.md`;
let instance: ObsidianApp;
let page: Page;
let original: Record<string, unknown>;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Five daily occurrences ending today; the first four are completed.
const occurrences = [-4, -3, -2, -1, 0].map(localDate);
const rule = `DTSTART:${occurrences[0].replaceAll("-", "")};FREQ=DAILY;COUNT=5`;

async function state(): Promise<{ status: string; queued: boolean }> {
	return page
		.evaluate(async (path) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins.tasknotes;
			const text = await app.vault.read(app.vault.getAbstractFileByPath(path));
			const queue = await plugin.autoArchiveService.getQueue();
			return {
				text,
				queued: queue.some((item: { taskPath: string }) => item.taskPath === path),
			};
		}, taskPath)
		.then(({ text, queued }) => ({
			status: parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]).status,
			queued,
		}));
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	original = await page.evaluate(
		async ({ folder, taskPath, rule, occurrences }) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins.tasknotes;
			const { customStatuses, resetRecurringStatusAfterOccurrence } = plugin.settings;
			plugin.settings.customStatuses = customStatuses.map((status: any) =>
				status.value === "done"
					? { ...status, autoArchive: true, autoArchiveDelay: 60 }
					: status
			);
			plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
			plugin.settings.resetRecurringStatusAfterOccurrence = false;

			await app.vault.createFolder(folder);
			await app.vault.create(
				taskPath,
				`---\ntags: [task]\ntitle: Bounded series\nstatus: open\npriority: normal\nscheduled: ${occurrences[4]}\nrecurrence: "${rule}"\ncomplete_instances: [${occurrences.slice(0, 4).join(", ")}]\n---\n`
			);
			const file = app.vault.getAbstractFileByPath(taskPath);
			for (let i = 0; i < 50 && !app.metadataCache.getFileCache(file)?.frontmatter; i++) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			const base = await app.vault.create(
				`${folder}/List.base`,
				`filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: List\n    order:\n      - status\n      - scheduled\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
			return { customStatuses, resetRecurringStatusAfterOccurrence };
		},
		{ folder, taskPath, rule, occurrences }
	);
});

test.afterAll(async () => {
	try {
		await page?.evaluate(
			async ({ folder, taskPath, original }) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins.tasknotes;
				await plugin.autoArchiveService.cancelAutoArchive(taskPath);
				Object.assign(plugin.settings, original);
				plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
				for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			},
			{ folder, taskPath, original }
		);
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("completing the last occurrence completes and queues the task; reopening it reverts both", async () => {
	const statusDot = page
		.locator(`.workspace-leaf [data-task-path="${taskPath}"] .task-card__status-dot`)
		.first();
	await expect(statusDot).toBeVisible({ timeout: 15000 });

	await statusDot.click();
	await expect.poll(state).toEqual({ status: "done", queued: true });

	await statusDot.click();
	await expect.poll(state).toEqual({ status: "open", queued: false });
});
