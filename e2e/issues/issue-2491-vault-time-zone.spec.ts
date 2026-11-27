import { expect, test } from "@playwright/test";
import { closeObsidian, launchObsidian } from "../obsidian";

test("the collection clock changes TaskNotes overdue dates without rewriting the task", async () => {
	const obsidian = await launchObsidian();
	const { page } = obsidian;
	const taskPath = `Collection clock ${Date.now()}.md`;
	const setZone = (zone: string) => page.evaluate(async (newZone) => {
		const app = (window as any).app;
		const content = `spec_version: 0.3.0\nsettings:\n  timezone: ${newZone}\n`;
		const file = app.vault.getFileByPath("mdbase.yaml");
		if (file) await app.vault.modify(file, content);
		else await app.vault.create("mdbase.yaml", content);
	}, zone);
	let originalConfig: string | null | undefined;
	try {
		await page.clock.setFixedTime(new Date("2026-06-26T16:00:00Z"));
		originalConfig = await page.evaluate(async () => {
			const app = (window as any).app;
			const file = app.vault.getFileByPath("mdbase.yaml");
			return file ? app.vault.read(file) : null;
		});
		await setZone("Australia/Melbourne");
		const taskText = "---\ntags: [task]\nstatus: open\ndue: 2026-06-26\n---\n";
		await page.evaluate(({ path, content }) =>
			(window as any).app.vault.create(path, content), { path: taskPath, content: taskText }
		);
		const overdue = () => page.evaluate(async (path) => {
			const plugin = (window as any).app.plugins.getPlugin("tasknotes");
			const task = await plugin.cacheManager.getTaskInfo(path);
			return task ? plugin.taskStatsService.getStats([task]).overdue : null;
		}, taskPath);
		await expect.poll(overdue).toBe(1);

		await setZone("America/New_York");
		await expect.poll(overdue).toBe(0);
		const stored = await page.evaluate((path) => (window as any).app.vault.adapter.read(path), taskPath);
		expect(stored).toBe(taskText);
	} finally {
		try {
			await page.evaluate(async ({ taskPath, originalConfig }) => {
				const app = (window as any).app;
				const task = app.vault.getFileByPath(taskPath);
				if (task) await app.vault.delete(task);
				const config = app.vault.getFileByPath("mdbase.yaml");
				if (config && originalConfig === null) await app.vault.delete(config);
				else if (config && originalConfig !== undefined) await app.vault.modify(config, originalConfig);
			}, { taskPath, originalConfig });
		} finally {
			await closeObsidian(obsidian);
		}
	}
});
