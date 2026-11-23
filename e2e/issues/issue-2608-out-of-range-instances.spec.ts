import { test, expect, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

// #2608: after a COUNT series has ended, "Completed today" recorded today's
// date in complete_instances even though the rule has no occurrence on it.

const folder = `Issue 2608 ${Date.now()}`;
const taskPath = `${folder}/Bounded series.md`;
let instance: ObsidianApp;
let page: Page;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Five daily occurrences that ended two days ago, all completed.
const occurrences = [-6, -5, -4, -3, -2].map(localDate);
const rule = `DTSTART:${occurrences[0].replaceAll("-", "")};FREQ=DAILY;COUNT=5`;

async function completeInstances(): Promise<string[]> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath);
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]).complete_instances ?? [];
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	await page.evaluate(
		async ({ folder, taskPath, rule, occurrences }) => {
			const app = (window as any).app;
			await app.vault.createFolder(folder);
			await app.vault.create(
				taskPath,
				`---\ntags: [task]\ntitle: Bounded series\nstatus: open\npriority: normal\nscheduled: ${occurrences[4]}\nrecurrence: "${rule}"\ncomplete_instances: [${occurrences.join(", ")}]\n---\n`
			);
			const file = app.vault.getAbstractFileByPath(taskPath);
			for (let i = 0; i < 50 && !app.metadataCache.getFileCache(file)?.frontmatter; i++) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			const base = await app.vault.create(
				`${folder}/List.base`,
				`filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: List\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
		},
		{ folder, taskPath, rule, occurrences }
	);
});

test.afterAll(async () => {
	try {
		await page?.evaluate(async (folder) => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const fixture = app.vault.getAbstractFileByPath(folder);
			if (fixture) await app.vault.delete(fixture, true);
		}, folder);
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("Completed today does not record a date after the series has ended", async () => {
	const card = page.locator(`.workspace-leaf [data-task-path="${taskPath}"]`).first();
	await expect(card).toBeVisible({ timeout: 15000 });
	await card.click({ button: "right" });

	await page.locator(".menu-item", { hasText: "Mark complete or skip" }).hover();
	const completedToday = page.locator(".menu-item", { hasText: "Completed today" });
	await expect(completedToday).toBeVisible();
	await expect(completedToday).toHaveClass(/is-disabled/);
	await completedToday.click({ force: true });
	await page.keyboard.press("Escape");

	await page.waitForTimeout(500);
	expect(await completeInstances()).toEqual(occurrences);
});
