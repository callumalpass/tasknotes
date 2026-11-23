import { expect, test } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue 2651 ${Date.now()}`;
const previousDay = "2026-11-19";
const reopenedDay = "2026-11-20";
const recurrence = "DTSTART:20261119;FREQ=DAILY";
const completed = /recurring-calendar__day--completed/;
const skipped = /recurring-calendar__day--skipped/;
let instance: ObsidianApp;

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.clock.setFixedTime(new Date(2026, 10, 20, 12));
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		app.plugins.plugins.tasknotes.settings.maintainDueDateOffsetInRecurring = true;
		await app.vault.createFolder(folder);
	}, folder);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const vault = (window as any).app.vault;
			const fixture = vault.getAbstractFileByPath(folder);
			if (fixture) await vault.delete(fixture, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

async function openCompletions(path: string) {
	const page = instance.page;
	await expect.poll(() => page.evaluate(async (path) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		return Boolean(await plugin.cacheManager.getTaskInfo(path));
	}, path)).toBe(true);
	await page.evaluate(async (path) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
	}, path);
	const modal = page.locator(".modal.mod-tasknotes");
	await modal.getByText("Completions", { exact: true }).click();
	return modal;
}

for (const scenario of [
	{
		name: "unskip the only skipped occurrence",
		initialCompleted: [previousDay],
		initialSkipped: [reopenedDay],
		expectedCompleted: [previousDay],
		expectedSkipped: [],
		menuAction: "Unskip instance",
	},
	{
		name: "click a skipped day through complete and back to open",
		initialCompleted: [previousDay],
		initialSkipped: [reopenedDay],
		expectedCompleted: [previousDay],
		expectedSkipped: [],
	},
	{
		name: "uncomplete the only completed occurrence",
		initialCompleted: [reopenedDay],
		initialSkipped: [previousDay],
		expectedCompleted: [],
		expectedSkipped: [previousDay],
		menuAction: "Mark incomplete for this date",
	},
	{
		name: "unskip while preserving another skipped occurrence",
		initialCompleted: [],
		initialSkipped: [previousDay, reopenedDay],
		expectedCompleted: [],
		expectedSkipped: [previousDay],
		menuAction: "Unskip instance",
	},
	{
		name: "click a skipped day to mark it complete",
		initialCompleted: [previousDay],
		initialSkipped: [reopenedDay],
		expectedCompleted: [previousDay, reopenedDay],
		expectedSkipped: [],
	},
]) {
	test(scenario.name, async () => {
		const page = instance.page;
		const path = `${folder}/${scenario.name}.md`;
		const staysComplete = scenario.expectedCompleted.includes(reopenedDay);
		const expectedScheduled = staysComplete ? "2026-11-21" : reopenedDay;
		const expectedDue = staysComplete ? "2026-11-22" : "2026-11-21";
		const content = `---
tags: [task]
status: open
priority: normal
scheduled: 2026-11-21
due: 2026-11-22
recurrence: ${recurrence}
recurrence_anchor: scheduled
complete_instances: ${JSON.stringify(scenario.initialCompleted)}
skipped_instances: ${JSON.stringify(scenario.initialSkipped)}
---
`;
		await page.evaluate(async ({ path, content }) => {
			await (window as any).app.vault.create(path, content);
		}, { path, content });

		const modal = await openCompletions(path);
		const day = modal.locator(`[data-occurrence-date="${reopenedDay}"]`);
		await expect(day).toHaveClass(scenario.initialCompleted.includes(reopenedDay) ? completed : skipped);
		if (scenario.menuAction) {
			await day.click({ button: "right" });
			await page.locator(".menu-item-title").getByText(scenario.menuAction, { exact: true }).click();
		} else {
			await day.click();
			await expect(day).toHaveClass(completed);
			if (!staysComplete) await day.click();
		}
		await expect(day).not.toHaveClass(skipped);
		if (staysComplete) await expect(day).toHaveClass(completed);
		else await expect(day).not.toHaveClass(completed);
		await modal.getByRole("button", { name: "Save", exact: true }).click();
		await expect(modal).toBeHidden();

		const saved = await page.evaluate(async (path) => {
			const vault = (window as any).app.vault;
			return vault.read(vault.getAbstractFileByPath(path)) as Promise<string>;
		}, path);
		const frontmatter = parse(saved.split("---")[1]);
		expect.soft(frontmatter).toMatchObject({
			scheduled: expectedScheduled,
			due: expectedDue,
			recurrence,
			recurrence_anchor: "scheduled",
			complete_instances: scenario.expectedCompleted,
			skipped_instances: scenario.expectedSkipped,
		});
		expect.soft(frontmatter).not.toHaveProperty("recurrence_original_date");

		await expect.poll(() => page.evaluate((path) => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(path);
			return app.metadataCache.getFileCache(file)?.frontmatter?.dateModified;
		}, path)).toBe(frontmatter.dateModified);
		await openCompletions(path);
		await expect.soft(day).not.toHaveClass(skipped);
		if (staysComplete) await expect.soft(day).toHaveClass(completed);
		else await expect.soft(day).not.toHaveClass(completed);
		await modal.getByRole("button", { name: "Cancel", exact: true }).click();
	});
}
