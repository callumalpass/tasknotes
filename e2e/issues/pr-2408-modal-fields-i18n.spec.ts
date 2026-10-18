import { test, expect, type Page } from "@playwright/test";
import {
	launchObsidian,
	closeObsidian,
	openTaskNotesSettings,
	type ObsidianApp,
} from "../obsidian";

let obsidian: ObsidianApp;
let settingsPage: Page;
let originalSettings: { locale: string; modalFieldsConfig: unknown; userFields: unknown };

const fixtureFields = ["core", "user", "dependency", "organization"].map((fieldType, order) => ({
	id: `locale-test-${fieldType}`,
	fieldType,
	group: "custom",
	displayName: `My ${fieldType} label`,
	visibleInCreation: true,
	visibleInEdit: true,
	order,
	enabled: true,
}));

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	originalSettings = await obsidian.page.evaluate((fields) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const original = JSON.parse(
			JSON.stringify({
				locale: plugin.i18n.getCurrentLocale(),
				modalFieldsConfig: plugin.settings.modalFieldsConfig,
				userFields: plugin.settings.userFields,
			})
		);
		plugin.settings.userFields = [
			{
				id: "locale-test-user",
				key: "my_property_key",
				displayName: "My user label",
				type: "text",
			},
		];
		plugin.settings.modalFieldsConfig = {
			version: 1,
			groups: [{ id: "custom", displayName: "My saved group", order: 0 }],
			fields,
		};
		plugin.i18n.setLocale("zh");
		return original;
	}, fixtureFields);
	settingsPage = await openTaskNotesSettings(obsidian.page);
	await settingsPage.locator("#tab-button-modal-fields").click();
});

test.afterAll(async () => {
	if (!obsidian) return;
	try {
		if (originalSettings) {
			await obsidian.page.evaluate(async ({ locale, ...settings }) => {
				const plugin = (window as any).app.plugins.plugins.tasknotes;
				Object.assign(plugin.settings, settings);
				plugin.i18n.setLocale(locale);
				await plugin.saveSettings();
			}, originalSettings);
		}
	} finally {
		await closeObsidian(obsidian);
	}
});

test("renders translated chrome while preserving saved labels, keys, and type identifiers", async () => {
	const panel = settingsPage.locator("#settings-tab-modal-fields");
	await expect(panel).toContainText("任务模态框的字段配置");
	await expect(panel).toContainText("已启用：");
	await expect(panel).toContainText("创建任务时显示：");
	await expect(panel).toContainText("编辑任务时显示：");
	await expect(panel.locator(".field-manager__tab")).toHaveText("My saved group");
	for (const [type, label] of Object.entries({
		core: "核心",
		user: "用户",
		dependency: "依赖",
		organization: "组织",
	})) {
		const card = panel.locator(`[data-card-id="locale-test-${type}"]`);
		await expect(card).toContainText(`My ${type} label`);
		await expect.soft(card.locator(`.field-card__type--${type}`)).toHaveText(label);
	}
	await expect(panel.locator('[data-card-id="locale-test-user"]')).toContainText(
		"键：my_property_key"
	);
	await expect(panel.locator('[data-card-id="locale-test-core"]')).toContainText(
		"ID：locale-test-core"
	);
});

test("localizes the reset confirmation and cancellation keeps the saved configuration", async () => {
	await settingsPage.getByRole("button", { name: "重置为默认值", exact: true }).click();
	// Confirmation modals can belong to the workspace or the native Settings window.
	let dialogPage: Page | undefined;
	await expect
		.poll(async () => {
			for (const candidate of obsidian.page.context().pages()) {
				if (
					await candidate.getByRole("button", { name: "取消", exact: true }).isVisible()
				) {
					dialogPage = candidate;
					return true;
				}
			}
			return false;
		})
		.toBe(true);
	const dialog = dialogPage!
		.locator(".modal:not(.mod-settings)")
		.filter({ hasText: "字段配置重置" });
	await expect(dialog).toContainText(
		"确定要将字段配置重置为默认值吗？这将移除所有自定义字段配置。"
	);
	await expect(dialog.getByRole("button", { name: "重置", exact: true })).toBeVisible();
	await dialog.getByRole("button", { name: "取消", exact: true }).click();
	await expect(settingsPage.locator(".field-manager__tab")).toHaveText("My saved group");
	const fields = await obsidian.page.evaluate(
		() => (window as any).app.plugins.plugins.tasknotes.settings.modalFieldsConfig.fields
	);
	expect(fields).toEqual(fixtureFields);
});
