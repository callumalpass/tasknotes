import { test, expect } from "@playwright/test";
import { stringify } from "yaml";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue1894-${Date.now()}`;
let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;

test.beforeAll(async () => {
	instance = await launchObsidian();
	originalSettings = await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		const original = {
			taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
			taskTag: plugin.settings.taskTag,
		};
		plugin.settings.taskIdentificationMethod = "tag";
		plugin.settings.taskTag = "task";
		await app.vault.createFolder(folder);
		return original;
	}, folder);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(
			async ({ folder, originalSettings }) => {
				const app = (window as any).app;
				Object.assign(app.plugins.plugins.tasknotes.settings, originalSettings);
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			},
			{ folder, originalSettings }
		);
	} finally {
		await closeObsidian(instance);
	}
});

for (const type of ["tasknotesTaskList", "tasknotesKanban"]) {
	for (const field of ["scheduled", "due"]) {
		for (const time of ["", "T21:37"]) {
			test(`${type} ${field} +1 day preserves ${time || "date-only"}`, async () => {
				const page = instance.page;
				const name = `${type}-${field}-${time ? "timed" : "date"}`;
				const path = `${folder}/${name}.md`;
				const content = stringify({
					filters: { and: [`file.path == "${path}"`] },
					views: [
						{
							type,
							name,
							order: ["file.name", field],
							...(type === "tasknotesKanban"
								? {
										groupBy: { property: "status", direction: "ASC" },
										hideEmptyColumns: true,
									}
								: {}),
						},
					],
				});
				await page.evaluate(
					async ({ folder, path, name, field, time, content }) => {
						const app = (window as any).app;
						const plugin = app.plugins.plugins.tasknotes;
						const status = plugin.fieldMapper.toUserField("status");
						const dateField = plugin.fieldMapper.toUserField(field);
						await app.vault.create(
							path,
							`---\ntags: [task]\n${status}: open\n${dateField}: 2026-05-16${time}\n---\n`
						);
						const base = await app.vault.create(`${folder}/${name}.base`, content);
						await app.workspace.getLeaf(false).openFile(base);
					},
					{ folder, path, name, field, time, content }
				);
				const active = page.locator(".workspace-leaf.mod-active");
				const dateControl = active.locator(
					`[data-tn-action="edit-date"][data-tn-date-type="${field}"]`
				);
				await expect(dateControl).toBeVisible();
				await dateControl.click();
				await page
					.locator(".menu-item")
					.filter({ hasText: /^\+1 day$/ })
					.click();
				// Read raw YAML: metadata parsing must not hide loss of the time suffix.
				await expect
					.poll(() =>
						page.evaluate(
							async ({ path, field }) => {
								const app = (window as any).app;
								const key =
									app.plugins.plugins.tasknotes.fieldMapper.toUserField(field);
								const text = await app.vault.read(
									app.vault.getAbstractFileByPath(path)
								);
								return text
									.split("\n")
									.find((line: string) => line.startsWith(`${key}:`))
									?.slice(key.length + 2);
							},
							{ path, field }
						)
					)
					.toBe(`2026-05-17${time}`);
			});
		}
	}
}
