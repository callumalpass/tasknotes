import { test, expect } from "@playwright/test";
import { runLinguiReview } from "./helpers/lingui-review";
import { runLinguiRereview } from "./helpers/lingui-rereview";
import { setupI18n } from "@lingui/core";
import { format } from "date-fns";
import { it as italianDateLocale, de as germanDateLocale } from "date-fns/locale";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { launchObsidian, closeObsidian, openTaskNotesSettings, closeObsidianSettings, type ObsidianApp } from "./obsidian";

test.use({ trace: "on" });
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
	// Strict ten-locale preparation plus a cold isolated Electron profile.
	test.setTimeout(180000);
	execFileSync(process.execPath, ["scripts/compile-lingui.mjs"], { cwd: root, stdio: "inherit" });
	for (const locale of ["en", "it", "ja", "de", "ru"]) {
		const { messages } = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/locales", locale, "messages.json"), "utf8"));
		cores.set(locale, setupI18n({ locale, messages: { [locale]: messages } }));
	}
	savedSettings = fs.readFileSync(settingsPath);
	const settings = JSON.parse(savedSettings.toString());
	settings.uiLanguage = "it";
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

test("ordinary native build decodes all ten catalogues synchronously and renders en/it/ja/de/ru", async () => {
	const page = app!.page;
	const currentLocale = () => page.evaluate(() => (window as any).app?.plugins?.plugins?.tasknotes?.i18n?.getCurrentLocale());
	await expect.poll(currentLocale).toBe("it");
	expect(await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getAvailableLocales().sort())).toEqual(["de", "en", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]);
	const report: Record<string, unknown> = {};
	for (const locale of ["en", "it", "ja", "de", "ru"]) {
		const settingsPage = await openTaskNotesSettings(page);
		const picker = settingsPage.locator('select:has(option[value="system"]):has(option[value="fr"])');
		await expect(picker.locator('option[value="it"]')).toHaveText("Italiano");
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
	fs.writeFileSync(path.join(root, "test-results/lingui-bundled/report.json"), JSON.stringify({ synchronousColdLocale: "it", availableLocales: 10, locales: report }, null, 2));
});


test("Italian and German native dates, persisted pickers and Italian NLP remain independent", async () => {
	test.setTimeout(120000);
	const page = app!.page;
	const original = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).app.plugins.plugins.tasknotes.settings)));
	const report: Record<string, unknown> = {};
	const dateFolder = `Italian-date-fixture-${Date.now()}`;
	await page.evaluate(async folder => { await (window as any).app.vault.createFolder(folder); }, dateFolder);
	try {
		for (const locale of ["it", "de"]) {
			const general = await page.evaluate(id => (window as any).app.plugins.plugins.tasknotes.i18n.translate({ id }), keyMap["settings.tabs.general"].id);
			const settings = await openTaskNotesSettings(page, general);
			await settings.locator('select:has(option[value="system"]):has(option[value="it"])').selectOption(locale);
			await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale())).toBe(locale);
			await settings.getByRole("tab", { name: cores.get(locale)!._(keyMap["settings.tabs.features"].id), exact: true }).click();
			const nlpName = cores.get(locale)!._(keyMap["settings.features.nlp.language.name"].id);
			const nlp = settings.getByText(nlpName, { exact: true })
				.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " setting-item ")][1]')
				.getByRole("combobox");
			await expect(nlp.locator('option[value="it"]')).toHaveText("Italiano");
			await nlp.selectOption("it");
			await settings.getByRole("tab", { name: cores.get(locale)!._(keyMap["settings.tabs.general"].id), exact: true }).click();
			await closeObsidianSettings(page, settings);
			await expect.poll(() => {
				try {
					// Obsidian may truncate data.json before completing its async save.
					const saved = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
					return { nlpLanguage: saved.nlpLanguage, uiLanguage: saved.uiLanguage };
				} catch { return null; }
			}).toEqual({ nlpLanguage: "it", uiLanguage: locale });
			const dates = ["2026-10-24T12:00:00", "2026-12-25T13:30:00"];
			await page.evaluate(async ({ folder, locale, dates }) => {
				const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
				const { file } = await plugin.icsNoteService.createNoteFromICS({
					id: `italian-date-${locale}`, subscriptionId: "isolated-date-fixture",
					title: `Date fixture ${locale}`, start: dates[0], end: dates[1], allDay: false,
				}, { folder, title: `Date fixture ${locale}` });
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(file);
				await leaf.setViewState({ type: "markdown", state: { file: file.path, mode: "preview" } });
			}, { folder: dateFolder, locale, dates });
			const formattedDates = dates.map(date => format(new Date(date), "PPPp", { locale: locale === "it" ? italianDateLocale : germanDateLocale }));
			for (const date of formattedDates) await expect(page.locator(".workspace-leaf.mod-active .markdown-preview-view")).toContainText(date);
			await page.screenshot({ path: `test-results/lingui-bundled/${locale}-dates.png` });
			await page.evaluate(() => (window as any).app.commands.executeCommandById("tasknotes:create-new-task"));
			const modal = page.locator(".modal").filter({ has: page.locator(".title-input, .title-input-detailed") }).last();
			await expect(modal).toBeVisible();
			const editor = modal.locator('.cm-content[contenteditable="true"]:visible').first();
			// ISO input keeps this language-selection regression independent of
			// the host's separate numeric date-order setting.
			await editor.click();
			await editor.press("ControlOrMeta+A");
			await editor.pressSequentially("Comprare latte entro 2026-12-25");
			const fill = cores.get(locale)!._(keyMap["modals.taskCreation.actions.fillFromNaturalLanguage"].id);
			await modal.getByLabel(fill, { exact: true }).click();
			await expect(modal.locator(".title-input-detailed")).toHaveValue("Comprare latte");
			const due = modal.locator('[data-type="due-date"]');
			await expect(due).toHaveClass(/has-value/);
			await expect(due).toHaveAttribute("aria-label", /2026-12-25/);
			await page.screenshot({ path: `test-results/lingui-bundled/${locale}-italian-nlp.png` });
			await modal.getByRole("button", { name: cores.get(locale)!._(keyMap["common.cancel"].id), exact: true }).click();
			await expect(modal).toHaveCount(0);
			report[locale] = { dates: formattedDates, nlpLanguage: "it", parsedTitle: "Comprare latte", due: "2026-12-25", pickersPersisted: true };
		}
		fs.writeFileSync(path.join(root, "test-results/lingui-bundled/italian-report.json"), JSON.stringify(report, null, 2));
	} finally {
		await page.keyboard.press("Escape").catch(() => {});
		await page.evaluate(async ({ original, folder }) => {
			const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
			Object.assign(plugin.settings, original);
			await plugin.setUILanguage(original.uiLanguage);
			await plugin.saveSettings();
			for (const leaf of app.workspace.getLeavesOfType("markdown")) if (leaf.view.file?.path.startsWith(folder + "/")) await leaf.setViewState({ type: "empty" });
			const fixture = app.vault.getAbstractFileByPath(folder);
			if (fixture) await app.vault.delete(fixture, true);
		}, { original, folder: dateFolder });
	}
});

test("native en/it/de/ru group identities survive drag, creation and saved ordering", async () => {
	test.setTimeout(180000);
	await runLinguiReview(app!.page, "test-results/lingui-bundled/review");
});

test("native en/it/de restores field labels, preserves completed-date sort and separates interactive validation from programmatic fallbacks", async () => {
	test.setTimeout(180000);
	await runLinguiRereview(app!.page, "test-results/lingui-bundled/rereview");
});
