import { test, expect } from "@playwright/test";
import {
	launchObsidian,
	closeObsidian,
	openTaskNotesSettings,
	closeObsidianSettings,
	nativeSettingRow,
	type ObsidianApp,
} from "../obsidian";

test.describe("Issue #2731: Copy and reveal HTTP API authentication token", () => {
	let instance: ObsidianApp;
	let originalToken: string;

	test.beforeAll(async () => {
		instance = await launchObsidian();
		originalToken = await instance.page.evaluate(() => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			plugin.i18n.setLocale("en");
			return plugin.settings.apiAuthToken ?? "";
		});
	});

	test.afterAll(async () => {
		if (!instance) return;
		try {
			await instance.page.evaluate(async (token) => {
				const plugin = (window as any).app.plugins.plugins.tasknotes;
				if (plugin) {
					plugin.settings.apiAuthToken = token;
					await plugin.saveSettings();
				}
			}, originalToken);
		} finally {
			await closeObsidian(instance);
		}
	});

	test("copies token directly while masked, reveals for keyboard copy, and disables copy when empty", async () => {
		const testToken = "tasknotes-issue-2731-token";
		await instance.page.evaluate(async (token) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			plugin.settings.apiAuthToken = token;
			await plugin.saveSettings();
		}, testToken);

		const settingsPage = await openTaskNotesSettings(instance.page, "Advanced/HTTP API");
		try {
			const row = nativeSettingRow(settingsPage, "API authentication token");
			await expect(row).toBeVisible();

			const input = row.locator("input");
			const showButton = row.locator('.extra-setting-button[aria-label="Show token"]');
			const copyButton = row.locator('.extra-setting-button[aria-label="Copy token"]');

			await expect(input).toHaveAttribute("type", "password");
			await expect(input).toHaveValue(testToken);
			await expect(showButton).toBeVisible();
			await expect(showButton).toHaveAttribute("aria-pressed", "false");
			await expect(copyButton).toBeVisible();
			await expect(copyButton).not.toHaveClass(/is-disabled/);

			// Copy directly while input is masked.
			await settingsPage.evaluate(() => {
				const electron = (window as any).require?.("electron");
				electron?.clipboard?.writeText("");
			});
			await copyButton.click();
			await expect
				.poll(() =>
					settingsPage.evaluate(() => {
						const electron = (window as any).require?.("electron");
						return electron?.clipboard?.readText() ?? "";
					})
				)
				.toBe(testToken);

			// Reveal token so standard select + keyboard copy works too.
			await showButton.click();
			const hideButton = row.locator('.extra-setting-button[aria-label="Hide token"]');
			await expect(input).toHaveAttribute("type", "text");
			await expect(hideButton).toBeVisible();
			await expect(hideButton).toHaveAttribute("aria-pressed", "true");

			await settingsPage.evaluate(() => {
				const electron = (window as any).require?.("electron");
				electron?.clipboard?.writeText("");
			});
			await input.click();
			await settingsPage.keyboard.press("ControlOrMeta+a");
			await settingsPage.keyboard.press("ControlOrMeta+c");
			await expect
				.poll(() =>
					settingsPage.evaluate(() => {
						const electron = (window as any).require?.("electron");
						return electron?.clipboard?.readText() ?? "";
					})
				)
				.toBe(testToken);

			// Mask again.
			await hideButton.click();
			await expect(input).toHaveAttribute("type", "password");
			await expect(showButton).toHaveAttribute("aria-pressed", "false");

			// Empty token disables copy button; typing a new token re-enables it.
			await input.fill("");
			await expect(copyButton).toHaveClass(/is-disabled/);

			const updatedToken = "tasknotes-issue-2731-updated";
			await input.fill(updatedToken);
			await expect(copyButton).not.toHaveClass(/is-disabled/);

			await copyButton.click();
			await expect
				.poll(() =>
					settingsPage.evaluate(() => {
						const electron = (window as any).require?.("electron");
						return electron?.clipboard?.readText() ?? "";
					})
				)
				.toBe(updatedToken);
		} finally {
			await closeObsidianSettings(instance.page, settingsPage);
		}
	});
});
