import { test, expect } from "@playwright/test";
import { runLinguiReview } from "./helpers/lingui-review";
import { setupI18n } from "@lingui/core";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { launchObsidian, closeObsidian, openTaskNotesSettings, closeObsidianSettings, type ObsidianApp } from "./obsidian";

const root = path.resolve(__dirname, "..");
const settingsPath = path.join(root, "tasknotes-e2e-vault/.obsidian/plugins/tasknotes/data.json");
const statsPath = path.join(root, "tasknotes-e2e-vault/TaskNotes/Views/pomodoro-stats.base");
const hadStats = fs.existsSync(statsPath);
const keyMap = JSON.parse(fs.readFileSync(path.join(root, "scripts/plugin-key-map.json"), "utf8"));
let savedSettings: Buffer | undefined;
let app: ObsidianApp | undefined;
const cores = new Map<string, ReturnType<typeof setupI18n>>();
test.skip(Boolean(process.env.TASKNOTES_LANGUAGE_PACK_BASE_URL), "Requires the ordinary all-locale bundled build");

test.beforeAll(async () => {
	execFileSync(process.execPath, ["scripts/compile-lingui.mjs"], { cwd: root, stdio: "inherit" });
	for (const locale of ["en", "ja", "de", "ru"]) {
		const { messages } = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/locales", locale, "messages.json"), "utf8"));
		cores.set(locale, setupI18n({ locale, messages: { [locale]: messages } }));
	}
	savedSettings = fs.readFileSync(settingsPath);
	const settings = JSON.parse(savedSettings.toString());
	settings.uiLanguage = "ja";
	settings.checkForUpdatesOnStartup = false;
	settings.showReleaseNotesOnUpdate = false;
	fs.writeFileSync(settingsPath, JSON.stringify(settings));
	app = await launchObsidian();
});

test.afterAll(async () => {
	try { if (app) await closeObsidian(app); }
	finally {
		if (savedSettings) fs.writeFileSync(settingsPath, savedSettings);
		if (!hadStats) fs.rmSync(statsPath, { force: true });
	}
});

test("ordinary native build decodes all nine catalogues synchronously and renders en/ja/de/ru", async () => {
	const page = app!.page;
	const currentLocale = () => page.evaluate(() => (window as any).app?.plugins?.plugins?.tasknotes?.i18n?.getCurrentLocale());
	await expect.poll(currentLocale).toBe("ja");
	expect(await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getAvailableLocales().sort())).toEqual(["de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh"]);
	const report: Record<string, unknown> = {};
	for (const locale of ["en", "ja", "de", "ru"]) {
		const settingsPage = await openTaskNotesSettings(page);
		const picker = settingsPage.locator('select:has(option[value="system"]):has(option[value="fr"])');
		await picker.selectOption(locale);
		await expect.poll(currentLocale).toBe(locale);
		await expect(settingsPage.getByRole("button", { name: cores.get(locale)!._(keyMap["settings.features.uiLanguage.retryDownload"].id), exact: true })).toHaveCount(0);
		await settingsPage.screenshot({ path: `test-results/lingui-bundled/${locale}-settings.png`, fullPage: true });
		await closeObsidianSettings(page, settingsPage);
		const commandId = keyMap["commands.createNewTask"].id;
		const expectedName = cores.get(locale)!._(commandId);
		await expect.poll(() => page.evaluate(() => (window as any).app.commands.commands["tasknotes:create-new-task"]?.name)).toContain(expectedName);
		await page.keyboard.press("Control+p");
		await page.locator(".prompt-input").fill("TaskNotes");
		await expect(page.locator(".suggestion-title").filter({ hasText: expectedName }).first()).toBeVisible();
		await page.keyboard.press("Escape");
		const id = keyMap["settings.integrations.timeFormats.minutesAgo"].id;
		const counts = await page.evaluate(id => [0, 1, 2, 5, 21].map(count => (window as any).app.plugins.plugins.tasknotes.i18n.translate({ id }, { minutes: count })), id);
		expect(counts).toEqual([0, 1, 2, 5, 21].map(count => cores.get(locale)!._(id, { minutes: count })));
		for (const [index, count] of [0, 1, 2, 5, 21].entries()) expect(counts[index]).toContain(new Intl.NumberFormat(locale).format(count));
		report[locale] = { commandName: expectedName, counts };
	}
	fs.mkdirSync(path.join(root, "test-results/lingui-bundled"), { recursive: true });
	fs.writeFileSync(path.join(root, "test-results/lingui-bundled/report.json"), JSON.stringify({ synchronousColdLocale: "ja", availableLocales: 9, locales: report }, null, 2));
});


test("native en/de/ru group identities survive drag, creation and saved ordering", async () => {
	test.setTimeout(180000);
	await runLinguiReview(app!.page, "test-results/lingui-bundled/review");
});
