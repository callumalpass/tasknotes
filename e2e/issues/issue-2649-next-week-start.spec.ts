import { test, expect, type Page } from "@playwright/test";
import { parse } from "yaml";
import {
	closeObsidian,
	closeObsidianSettings,
	launchObsidian,
	nativeSettingRow,
	revealTaskNotesSetting,
	runCommand,
} from "../obsidian";

const verifyDate = expect.configure({ soft: true });

async function readDate(page: Page, path: string, property: "due" | "scheduled") {
	const contents = await page.evaluate(
		(path) => (window as any).app.vault.adapter.read(path) as Promise<string>,
		path
	);
	return parse(contents.split("---")[1])[property];
}

for (const { name, firstDay, expected } of [
	{ name: "Monday", firstDay: "1", expected: "2027-01-04" },
	{ name: "Sunday", firstDay: "0", expected: "2027-01-03" },
]) {
	test(`Next week starts on ${name} in the date menu, action palette and picker`, async () => {
		const instance = await launchObsidian();
		const { page } = instance;
		const folder = `Issue 2649 ${Date.now()}`;
		const cardPath = `${folder}/Due chip.md`;
		const notePath = `${folder}/Quick dates.md`;
		const originalFirstDay = await page.evaluate(
			() => (window as any).app.plugins.plugins.tasknotes.settings.calendarViewSettings.firstDay
		);

		try {
			await test.step(`Set the first day of the week to ${name}`, async () => {
				const settings = await revealTaskNotesSetting(page, "calendarViewSettings.firstDay");
				const dropdown = nativeSettingRow(settings, "First day of week").getByRole("combobox");
				await dropdown.selectOption(firstDay);
				await closeObsidianSettings(page, settings);
			});

			// Wednesday in local time, with the next week crossing into a new year.
			await page.clock.setFixedTime(new Date(2026, 11, 30, 12));
			await page.evaluate(async ({ folder, cardPath, notePath }) => {
				const { vault, workspace } = (window as any).app;
				await vault.createFolder(folder);
				await vault.create(cardPath, "---\ntitle: Due chip\ntags: [task]\ndue: 2026-12-31\n---\n");
				await vault.create(notePath, "---\ntitle: Quick dates\ntags: [task]\n---\n");
				const base = await vault.create(`${folder}/Tasks.base`, [
					"filters:",
					`  and: ['file.path == "${cardPath}"']`,
					"views:",
					"  - type: tasknotesTaskList",
					"    name: Tasks",
					"    order: [due]",
					"",
				].join("\n"));
				await workspace.getLeaf(false).openFile(base);
			}, { folder, cardPath, notePath });

			await test.step("Right-click the due date and choose Next week", async () => {
				const card = page.locator(`.task-card[data-task-path="${cardPath}"]`);
				await card.locator('[data-tn-date-type="due"]').click({ button: "right" });
				await page.locator(".menu-item-title").getByText("Due date", { exact: true }).click();
				await page.locator(".tn-picker").getByText("Next week", { exact: true }).click();
				await verifyDate.poll(() => readDate(page, cardPath, "due")).toBe(expected);
			});

			await page.evaluate(async (path) => {
				const { vault, workspace } = (window as any).app;
				await workspace.getLeaf(false).openFile(vault.getFileByPath(path));
			}, notePath);

			const palette = page.locator(".task-action-palette-modal");
			await test.step("Choose Schedule for next week in Quick Actions", async () => {
				await runCommand(page, "Quick actions for current task");
				await palette.locator('[data-picker-id="set-scheduled-next-week"]').click();
				await verifyDate.poll(() => readDate(page, notePath, "scheduled")).toBe(expected);
			});
			await test.step("Choose Next week in the due date and time picker", async () => {
				await runCommand(page, "Quick actions for current task");
				await palette.locator('[data-picker-id="set-due-date"]').click();
				await page.locator(".date-time-picker-modal").getByRole("button", { name: "Next week", exact: true }).click();
				await verifyDate.poll(() => readDate(page, notePath, "due")).toBe(expected);
			});
		} finally {
			try {
				await page.evaluate(async ({ folder, originalFirstDay }) => {
					const app = (window as any).app;
					const plugin = app.plugins.plugins.tasknotes;
					plugin.settings.calendarViewSettings.firstDay = originalFirstDay;
					await plugin.saveSettings();
					const fixture = app.vault.getAbstractFileByPath(folder);
					if (fixture) await app.vault.delete(fixture, true);
				}, { folder, originalFirstDay });
			} finally {
				await closeObsidian(instance);
			}
		}
	});
}
