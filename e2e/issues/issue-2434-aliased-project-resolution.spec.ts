import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let obsidian: ObsidianApp;

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	await obsidian.page.evaluate(async () => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		plugin.i18n.setLocale("en");
		plugin.settings.openTaskAfterCreation = "none";
		if (!app.vault.getAbstractFileByPath("Issue 2434 project.md")) {
			await app.vault.create(
				"Issue 2434 project.md",
				"---\ntitle: Project Alpha\n---\n# Heading\n"
			);
		}
	});
});

test.afterAll(async () => {
	if (obsidian) await closeObsidian(obsidian);
});

for (const reference of [
	"[[Issue 2434 project]]",
	"[[Issue 2434 project|Project Alpha]]",
	"[[Issue 2434 project#Heading|Project Alpha]]",
]) {
	test(`resolves and preserves ${reference} across modal save/reopen`, async () => {
		const page = obsidian.page;
		const taskPath = await page.evaluate(async (reference) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			const { taskInfo } = await plugin.taskService.createTask({
				title: `Issue 2434 ${reference}`,
				projects: [reference],
			});
			await plugin.openTaskEditModal(taskInfo);
			return taskInfo.path;
		}, reference);

		const modal = page.locator(".modal.mod-tasknotes");
		await expect(modal.locator(".task-project-item")).toHaveCount(1);
		await expect(modal.locator(".task-project-item--unresolved")).toHaveCount(0);
		// Force a real save rather than closing an unchanged form.
		await modal.locator(".cm-content").fill("Issue 2434 saved details");
		await modal.getByRole("button", { name: "Save", exact: true }).click();
		await expect(modal).toHaveCount(0);

		await expect
			.poll(() =>
				page.evaluate(async (taskPath) => {
					const app = (window as any).app;
					return app.vault.read(app.vault.getAbstractFileByPath(taskPath));
				}, taskPath)
			)
			.toContain("Issue 2434 saved details");
		const projects = await page.evaluate(async (taskPath) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			const task = await plugin.cacheManager.getTaskInfo(taskPath);
			await plugin.openTaskEditModal(task);
			return task.projects;
		}, taskPath);
		expect(projects).toEqual([reference]);
		await expect(modal.locator(".task-project-item")).toHaveCount(1);
		await expect(modal.locator(".task-project-item--unresolved")).toHaveCount(0);
		await modal.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(modal).toHaveCount(0);
	});
}
