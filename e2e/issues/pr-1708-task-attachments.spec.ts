import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let obsidian: ObsidianApp;
const SCAN_NAME = "pr1708-scan.png";

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	await obsidian.page.evaluate(() => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.settings.openTaskAfterCreation = "none";
		plugin.i18n.setLocale("en");
	});
});

test.afterAll(async () => {
	if (!obsidian) return;
	await obsidian.page.evaluate(async (name) => {
		const app = (window as any).app;
		for (const file of app.vault.getFiles()) {
			if (file.name.startsWith(name.replace(".png", "")) || file.basename.startsWith("PR 1708")) {
				await app.vault.delete(file);
			}
		}
	}, SCAN_NAME);
	await closeObsidian(obsidian);
});

async function openEditModalForNewTask(title: string): Promise<string> {
	return obsidian.page.evaluate(async (title) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const result = await plugin.taskService.createTask({ title });
		await plugin.openTaskEditModal(result.taskInfo);
		return result.taskInfo.path as string;
	}, title);
}

function vaultFilesNamed(prefix: string): Promise<string[]> {
	return obsidian.page.evaluate(
		(prefix) =>
			(window as any).app.vault
				.getFiles()
				.filter((file: any) => file.name.startsWith(prefix))
				.map((file: any) => file.path),
		prefix
	);
}

function attachmentsOf(path: string): Promise<unknown> {
	return obsidian.page.evaluate(async (path) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const content: string = await app.vault.read(file);
		const match = content.match(/attachments:\n((?:\s+- .*\n)+)/);
		return match ? match[1].trim().split("\n").map((line) => line.replace(/^\s*- /, "")) : null;
	}, path);
}

const scanFile = {
	name: SCAN_NAME,
	mimeType: "image/png",
	buffer: Buffer.from("not really a png"),
};

test("discarding the edit modal does not write an imported file", async () => {
	const page = obsidian.page;
	await openEditModalForNewTask("PR 1708 discard");
	const modal = page.locator(".modal.mod-tasknotes");
	await modal.locator(".task-attachments-file-input").setInputFiles(scanFile);
	await expect(modal.locator(".task-attachment-item--pending")).toContainText(SCAN_NAME);

	await modal.getByRole("button", { name: "Cancel", exact: true }).click();
	await page.getByRole("button", { name: "Discard changes", exact: true }).click();
	await expect(modal).toHaveCount(0);

	expect(await vaultFilesNamed("pr1708-scan")).toEqual([]);
});

test("saving imports the file, writes a canonical link, and unlinking keeps the file", async () => {
	const page = obsidian.page;
	const taskPath = await openEditModalForNewTask("PR 1708 save");
	let modal = page.locator(".modal.mod-tasknotes");
	await modal.locator(".task-attachments-file-input").setInputFiles(scanFile);
	await modal.getByRole("button", { name: "Save", exact: true }).click();
	await expect(modal).toHaveCount(0);

	const imported = await vaultFilesNamed("pr1708-scan");
	expect(imported).toHaveLength(1);
	await expect.poll(() => attachmentsOf(taskPath)).toEqual([`"[[${imported[0]}]]"`]);

	await page.evaluate(async (path) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const task = await plugin.cacheManager.getTaskInfo(path);
		await plugin.openTaskEditModal(task);
	}, taskPath);
	modal = page.locator(".modal.mod-tasknotes");
	const remove = modal.getByRole("button", { name: `Remove ${SCAN_NAME} from this task` });
	await remove.click();
	await expect(modal.locator(".task-attachment-item")).toHaveCount(0);
	await modal.getByRole("button", { name: "Save", exact: true }).click();
	await expect(modal).toHaveCount(0);

	await expect.poll(() => attachmentsOf(taskPath)).toBeNull();
	expect(await vaultFilesNamed("pr1708-scan")).toEqual(imported);
});
