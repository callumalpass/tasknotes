import { expect, test, type Page } from "@playwright/test";
import {
	closeObsidian,
	closeObsidianSettings,
	launchObsidian,
	nativeSettingRow,
	revealTaskNotesSetting,
} from "../obsidian";

const date = "2026-11-24";
const layouts = [
	{ name: "Week", view: "timeGridWeek", column: ".tnc-tg-head .tnc-dh", sunday: "2026-11-22", monday: "2026-11-23" },
	{ name: "Month", view: "dayGridMonth", column: ".tnc-dg-day", sunday: "2026-11-01", monday: "2026-10-26" },
	{ name: "Agenda", view: "listWeek", column: ".tnc-strip-day", sunday: "2026-11-22", monday: "2026-11-23" },
];

async function setFirstDay(page: Page, value: string): Promise<void> {
	const settings = await revealTaskNotesSetting(page, "calendarViewSettings.firstDay");
	const dropdown = nativeSettingRow(settings, "First day of week").getByRole("combobox");
	await dropdown.selectOption(value);
	await closeObsidianSettings(page, settings);
}

test("open Bases calendars follow the global first day unless the view overrides it", async () => {
	const instance = await launchObsidian();
	const { page } = instance;
	const path = `Issue 2106 ${Date.now()}.base`;
	const originalFirstDay = await page.evaluate(() => {
		const app = (window as any).app;
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
		return app.plugins.plugins.tasknotes.settings.calendarViewSettings.firstDay;
	});
	const calendar = page.locator(".workspace-leaf.mod-active #bases-calendar");

	const openCalendar = async (view: string, firstDay?: string) => {
		const source = [
			"views:",
			"  - type: tasknotesCalendar",
			"    name: Week start",
			`    calendarView: ${view}`,
			`    initialDate: "${date}"`,
			...(firstDay === undefined ? [] : [`    firstDay: "${firstDay}"`]),
			"",
		].join("\n");
		await page.evaluate(async ({ path, source }) => {
			const { vault, workspace } = (window as any).app;
			const leaf = workspace.getLeaf(false);
			await leaf.setViewState({ type: "empty" });
			let file = vault.getFileByPath(path);
			if (file) await vault.modify(file, source);
			else file = await vault.create(path, source);
			await leaf.openFile(file);
		}, { path, source });
	};

	try {
		for (const { name, view, column, sunday, monday } of layouts) {
			await test.step(`${name} updates while open`, async () => {
				await setFirstDay(page, "0");
				await openCalendar(view);
				const firstColumn = calendar.locator(column).first();
				await expect(firstColumn).toHaveAttribute("data-date", sunday);
				await setFirstDay(page, "1");
				await expect.soft(firstColumn).toHaveAttribute("data-date", monday);
			});
		}

		await test.step("The agenda keeps its anchor date and an expanded date strip", async () => {
			const stripTitle = calendar.locator(".tnc-strip-title");
			await expect(stripTitle).toHaveAttribute("aria-expanded", "false");
			await expect(calendar.locator(".tnc-list-day").first()).toHaveAttribute("data-date", date);
			await stripTitle.click();
			await setFirstDay(page, "0");
			await expect(stripTitle).toHaveAttribute("aria-expanded", "true");
			await expect(calendar.locator(".tnc-strip-day").first()).toHaveAttribute("data-date", "2026-11-01");
			await setFirstDay(page, "1");
			await expect(stripTitle).toHaveAttribute("aria-expanded", "true");
			await expect.soft(calendar.locator(".tnc-strip-day").first()).toHaveAttribute("data-date", "2026-10-26");
		});

		await test.step("A saved Sunday overrides the Monday default", async () => {
			await openCalendar("timeGridWeek", "0");
			await expect(calendar.locator(".tnc-tg-head .tnc-dh").first())
				.toHaveAttribute("data-date", "2026-11-22");
		});
	} finally {
		try {
			await page.evaluate(async ({ path, originalFirstDay }) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins.tasknotes;
				plugin.settings.calendarViewSettings.firstDay = originalFirstDay;
				await plugin.saveSettings();
				const file = app.vault.getFileByPath(path);
				if (file) await app.vault.delete(file, true);
			}, { path, originalFirstDay });
		} finally {
			await closeObsidian(instance);
		}
	}
});
