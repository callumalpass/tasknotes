import { test, expect, type Page } from "@playwright/test";
import {
	launchObsidian,
	closeObsidian,
	openTaskNotesSettings,
	nativeSettingRow,
	type ObsidianApp,
} from "../obsidian";

/**
 * Sign in with Google must be on the Google Calendar settings page the first
 * time a person opens it. Obsidian stores a tab's definitions when the tab is
 * added, so the page is opened as a person would, without asking the tab to
 * rebuild them first.
 */

let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
});

test.afterAll(async () => {
	if (instance) await closeObsidian(instance);
});

test("the Google Calendar page offers Sign in with Google without a rebuild", async () => {
	const settings = await openTaskNotesSettings(page);
	const path = await page.evaluate(() => {
		const setting = (window as any).app.setting;
		const tab = setting.openTabById("tasknotes");
		const find = (items: any[], path: string[] = []): string[] | undefined => {
			for (const item of items) {
				if (item.type === "page" && item.name === "Google Calendar") return [...path, item.name];
				const match =
					item.items && find(item.items, item.type === "page" ? [...path, item.name] : path);
				if (match) return match;
			}
		};
		const path = find(tab.settingItems);
		if (!path) throw new Error("Missing Google Calendar settings page");
		setting.navigateToPage(tab, path);
		return path;
	});
	await expect(settings.locator(".setting-page-title:visible").last()).toHaveText(path.at(-1)!);
	await expect(nativeSettingRow(settings, "Connection status")).toBeVisible();
	await expect(nativeSettingRow(settings, "Sign in with Google")).toBeVisible();
});
