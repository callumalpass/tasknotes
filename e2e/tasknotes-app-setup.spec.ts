import { test, expect } from "@playwright/test";
import {
	launchObsidian,
	closeObsidian,
	openTaskNotesSettings,
	closeObsidianSettings,
	nativeSettingRow,
	setObsidianViewport,
	type ObsidianApp,
} from "./obsidian";

let instance: ObsidianApp;
let originalMobile: boolean;

test.beforeAll(async () => {
	instance = await launchObsidian();
	originalMobile = await instance.page.evaluate(() => document.body.classList.contains("is-mobile"));
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(() => {
			window.open = (window as any).__tasknotesSetupOpen;
			delete (window as any).__tasknotesSetupOpen;
			delete (window as any).__tasknotesSetupUrls;
		});
		const mobile = await instance.page.evaluate(() => document.body.classList.contains("is-mobile"));
		if (mobile !== originalMobile) {
			await Promise.all([
				instance.page.waitForEvent("framenavigated"),
				instance.page.evaluate((originalMobile) => (window as any).app.emulateMobile(originalMobile), originalMobile),
			]);
			await instance.page.waitForFunction(() =>
				(window as any).app?.plugins?.plugins?.tasknotes?.initializationComplete === true
			);
		}
	} finally {
		await closeObsidian(instance);
	}
});

for (const width of [1180, 430]) {
	for (const theme of ["light", "dark"]) {
		test(`setup offers either sync option at ${width}px in ${theme} mode`, async ({}, testInfo) => {
			await setObsidianViewport(instance.page, { width, height: 900 });
			const mobile = width === 430;
			const isMobile = await instance.page.evaluate(() => document.body.classList.contains("is-mobile"));
			if (isMobile !== mobile) {
				await Promise.all([
					instance.page.waitForEvent("framenavigated"),
					instance.page.evaluate((mobile) => (window as any).app.emulateMobile(mobile), mobile),
				]);
				await instance.page.waitForFunction(() =>
					(window as any).app?.plugins?.plugins?.tasknotes?.initializationComplete === true
				);
			}
			if (mobile) await expect(instance.page.locator("body")).toHaveClass(/is-phone/);
			await instance.page.evaluate(() => {
				(window as any).app.plugins.plugins.tasknotes.i18n.setLocale("en");
				(window as any).__tasknotesSetupOpen ??= window.open;
				(window as any).__tasknotesSetupUrls = [];
				window.open = (url) => {
					(window as any).__tasknotesSetupUrls.push(String(url));
					return null;
				};
			});
			const settingsPage = mobile ? instance.page : await openTaskNotesSettings(instance.page, "TaskNotes App");
			if (mobile) {
				expect(await settingsPage.evaluate(() =>
					(window as any).app.commands.executeCommandById("tasknotes:set-up-tasknotes-app")
				)).toBe(true);
				await expect(settingsPage.locator(".modal.mod-settings")).toBeVisible();
			}
			try {
				await setObsidianViewport(settingsPage, { width, height: 900 });
				await settingsPage.evaluate((theme) => {
					document.body.classList.toggle("theme-light", theme === "light");
					document.body.classList.toggle("theme-dark", theme === "dark");
				}, theme);
				const option = nativeSettingRow(settingsPage, "2. Choose a sync option");
				await option.scrollIntoViewIfNeeded();
				await expect(option).toContainText("you only need one of them");
				const desktop = option.getByRole("button", { name: "Desktop app", exact: true });
				const plugin = option.getByRole("button", { name: "Obsidian plugin", exact: true });
				const rowBounds = await option.boundingBox();
				expect(rowBounds).not.toBeNull();
				for (const button of [desktop, plugin]) {
					await expect(button).toBeVisible();
					const bounds = await button.boundingBox();
					expect(bounds).not.toBeNull();
					expect(bounds!.x).toBeGreaterThanOrEqual(0);
					expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
					expect(bounds!.x).toBeGreaterThanOrEqual(rowBounds!.x);
					expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(rowBounds!.x + rowBounds!.width);
					expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
				}
				await instance.page.evaluate(() => { (window as any).__tasknotesSetupUrls = []; });
				await desktop.click();
				await plugin.click();
				expect(await instance.page.evaluate(() => (window as any).__tasknotesSetupUrls)).toEqual([
					"https://mdbase.dev/downloads/",
					"obsidian://show-plugin?id=mdbase-sync",
				]);
				await expect(settingsPage.getByText("Not added to mdbase Connect yet.", { exact: true })).toHaveCount(0);
				await settingsPage.screenshot({ path: testInfo.outputPath(`${width}-${theme}.png`) });
				const addVault = nativeSettingRow(settingsPage, "3. Add this vault");
				await addVault.scrollIntoViewIfNeeded();
				await expect(addVault.locator(".setting-item-description")).toBeVisible();
				await expect(addVault.locator(".setting-item-description")).toContainText(
					"Desktop app: add this vault’s folder and turn on sync. Obsidian plugin: follow the setup steps in the plugin to sync this vault."
				);
			} finally {
				await closeObsidianSettings(instance.page, settingsPage);
			}
		});
	}
}
