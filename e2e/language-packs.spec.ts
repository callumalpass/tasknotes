import { test, expect } from "@playwright/test";
import { setupI18n } from "@lingui/core";
import { createServer, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	launchObsidian,
	closeObsidian,
	openTaskNotesSettings,
	closeObsidianSettings,
	type ObsidianApp,
} from "./obsidian";
import type { LanguagePackManifest } from "../src/i18n/languagePackTypes";

const baseUrl = process.env.TASKNOTES_LANGUAGE_PACK_BASE_URL;
const root = path.resolve(__dirname, "..");
const fixturePlugin = path.join(root, "tasknotes-e2e-vault/.obsidian/plugins/tasknotes");
const settingsPath = path.join(fixturePlugin, "data.json");
const generatedStatsBase = path.join(
	root,
	"tasknotes-e2e-vault/TaskNotes/Views/pomodoro-stats.base"
);
const hadStatsBase = fs.existsSync(generatedStatsBase);
let app: ObsidianApp | undefined;
let server: Server | undefined;
let savedSettings: Buffer | undefined;
let russianPack: LanguagePackManifest["packs"]["ru"];
let mode: "ok" | "offline" | "corrupt-de" | "slow-ru" = "ok";
const requests: string[] = [];
const keyMap = JSON.parse(fs.readFileSync(path.join(root, "scripts/plugin-key-map.json"), "utf8"));
const singletonContracts = JSON.parse(fs.readFileSync(path.join(root, "docs/development/i18n-singleton-contracts.json"), "utf8"));
const cores = new Map<string, ReturnType<typeof setupI18n>>();
const expectedText = (locale: string, concept: string, values?: Record<string, number | string>) => cores.get(locale)!._(keyMap[concept].id, values);
let frenchCreateTaskName: string;
let frenchRibbonNames: string[];
let releaseFrench: (() => void) | undefined;
let delayFrench = true;

test.describe.configure({ mode: "serial" });
test.skip(!baseUrl, "Requires an explicitly configured downloadable-language build");

test.beforeAll(async () => {
	const endpoint = new URL(baseUrl!);
	if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1") {
		throw new Error("Native language-pack tests require an isolated 127.0.0.1 HTTP fixture");
	}
	const { manifest, directory } = JSON.parse(
		execFileSync(process.execPath, ["scripts/export-language-packs.mjs", "--json"], {
			cwd: root,
			encoding: "utf8",
		})
	) as { manifest: LanguagePackManifest; directory: string };
	russianPack = manifest.packs.ru;
	const files = new Map(
		Object.values(manifest.packs).map(({ file }) => [
			file,
			fs.readFileSync(path.join(directory, file), "utf8"),
		])
	);
	for (const [file, text] of files) {
		const locale = file.slice(0, -5);
		cores.set(locale, setupI18n({ locale, messages: { [locale]: JSON.parse(text).messages } }));
	}
	frenchCreateTaskName = expectedText("fr", "commands.createNewTask");
	frenchRibbonNames = [
		"openCalendarView",
		"openAdvancedCalendarView",
		"openTasksView",
		"openAgendaView",
		"openKanbanView",
		"openPomodoroView",
		"openPomodoroStats",
		"createNewTask",
	].map((key) => expectedText("fr", `commands.${key}`));
	const prefix = `${endpoint.pathname.replace(/\/$/, "")}/${manifest.catalogueVersion}/`;
	server = createServer((request, response) => {
		const file = request.url?.startsWith(prefix) ? request.url.slice(prefix.length) : "";
		requests.push(file);
		const content = files.get(file);
		if (mode === "offline" || !content) {
			response.writeHead(503);
			response.end();
			return;
		}
		const respond = () => {
			response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
			response.end(
				mode === "corrupt-de" && file === "de.json"
					? content.replace("Speichern", "SpeicherX")
					: content
			);
		};
		if (delayFrench && file === "fr.json") {
			releaseFrench = respond;
			return;
		}
		if (mode === "slow-ru" && file === "ru.json") setTimeout(respond, 300);
		else respond();
	});
	await new Promise<void>((resolve, reject) => {
		server!.once("error", reject);
		server!.listen(Number(endpoint.port), "127.0.0.1", resolve);
	});
	savedSettings = fs.readFileSync(settingsPath);
	const settings = JSON.parse(savedSettings.toString());
	// Cold start with an uncached saved preference; hold the response until ribbons exist.
	settings.uiLanguage = "fr";
	settings.checkForUpdatesOnStartup = false;
	settings.showReleaseNotesOnUpdate = false;
	fs.writeFileSync(settingsPath, JSON.stringify(settings));
	// This is generated data in this worktree's isolated test vault only.
	fs.rmSync(path.join(fixturePlugin, "language-packs"), { recursive: true, force: true });
	app = await launchObsidian();
});

test.afterAll(async () => {
	releaseFrench?.();
	try {
		if (app) await closeObsidian(app);
	} finally {
		try {
			if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
		} finally {
			if (savedSettings) fs.writeFileSync(settingsPath, savedSettings);
			if (!hadStatsBase) fs.rmSync(generatedStatsBase, { force: true });
		}
	}
});

test("downloads through the native picker, survives an offline reload, and retries corrupt data", async () => {
	const page = app!.page;
	const currentLocale = () =>
		page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale());
	expect(await currentLocale()).toBe("en");
	await expect.poll(() => requests.filter((file) => file === "fr.json").length).toBe(1);
	const ribbonLabels = () =>
		page
			.locator(".workspace-ribbon .side-dock-ribbon-action[aria-label]")
			.evaluateAll((elements) =>
				elements.map((element) => element.getAttribute("aria-label"))
			);
	await expect.poll(ribbonLabels).toContain("Create new task");
	delayFrench = false;
	releaseFrench!();
	releaseFrench = undefined;
	await expect.poll(currentLocale).toBe("fr");
	await expect.poll(ribbonLabels).toEqual(expect.arrayContaining(frenchRibbonNames));
	await expect
		.poll(() =>
			page.evaluate(() => {
				const application = (window as any).app;
				return application.commands.commands["tasknotes:create-new-task"]?.name;
			})
		)
		.toContain(frenchCreateTaskName);
	// Labels update in place: no duplicate ribbons on activation or later switches.
	const ribbonCount = (await ribbonLabels()).length;
	await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.setUILanguage("en"));
	expect((await ribbonLabels()).length).toBe(ribbonCount);

	let settingsPage = await openTaskNotesSettings(page);
	const languagePicker = () =>
		settingsPage.locator('select:has(option[value="system"]):has(option[value="fr"])');
	await languagePicker().selectOption("fr");
	await expect.poll(currentLocale).toBe("fr");
	await expect(languagePicker().locator('option[value="system"]')).toHaveText(
		"Langue du système"
	);
	expect(requests.filter((file) => file === "fr.json")).toHaveLength(1);
	await closeObsidianSettings(page, settingsPage);
	await page.evaluate(async () => {
		const application = (window as any).app;
		await application.plugins.plugins.tasknotes.saveSettings();
		await application.plugins.disablePlugin("tasknotes");
	});
	mode = "offline";
	await page.evaluate(async () => {
		await (window as any).app.plugins.enablePlugin("tasknotes");
	});
	await expect.poll(currentLocale).toBe("fr");
	expect(requests.filter((file) => file === "fr.json")).toHaveLength(1);

	// Cached translations must reach commands as well as the settings picker.
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as any).app.plugins.plugins.tasknotes.initializationComplete
			)
		)
		.toBe(true);
	await page.keyboard.press("Control+p");
	await page.locator(".prompt-input").fill("TaskNotes");
	await expect(
		page.locator(".suggestion-title").filter({ hasText: frenchCreateTaskName })
	).toBeVisible();
	await page.keyboard.press("Escape");

	mode = "corrupt-de";
	settingsPage = await openTaskNotesSettings(page);
	await languagePicker().selectOption("de");
	await expect.poll(() => requests.filter((file) => file === "de.json").length).toBe(1);
	await expect(
		settingsPage.getByRole("button", {
			name: "Réessayer le téléchargement de la langue",
			exact: true,
		})
	).toBeVisible();
	await expect
		.poll(async () => {
			const workspaceNotices = await page
				.locator(".notice")
				.filter({ hasText: "Impossible de charger" })
				.count();
			const settingsNotices =
				settingsPage === page
					? 0
					: await settingsPage
							.locator(".notice")
							.filter({ hasText: "Impossible de charger" })
							.count();
			return workspaceNotices + settingsNotices;
		})
		.toBeGreaterThan(0);
	await expect.poll(currentLocale).toBe("fr");
	mode = "ok";
	await settingsPage
		.getByRole("button", { name: "Réessayer le téléchargement de la langue", exact: true })
		.click();
	await expect.poll(currentLocale).toBe("de");
	expect(requests.filter((file) => file === "de.json")).toHaveLength(2);
	await closeObsidianSettings(page, settingsPage);

	mode = "slow-ru";
	const superseded = await page.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const first = plugin.setUILanguage("ru");
		await plugin.setUILanguage("en");
		return first;
	});
	expect(superseded).toBe(false);
	expect(await currentLocale()).toBe("en");
});

test("native en/ja/de/ru labels, plurals and existing Bases files survive locale switches", async () => {
	const page = app!.page;
	mode = "ok";
	const basesBefore = await page.evaluate(async () => {
		const vault = (window as any).app.vault;
		return Object.fromEntries(await Promise.all(vault.getFiles().filter((file: any) => file.extension === "base").map(async (file: any) => [file.path, await vault.read(file)])));
	});
	expect(Object.keys(basesBefore).length).toBeGreaterThan(0);
	const report: Record<string, unknown> = {};
	for (const locale of ["en", "ja", "de", "ru"]) {
		const preferencePage = await openTaskNotesSettings(page);
		await preferencePage.locator('select:has(option[value="system"]):has(option[value="fr"])').selectOption(locale);
		await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale())).toBe(locale);
		await closeObsidianSettings(page, preferencePage);
		const commandName = expectedText(locale, "commands.createNewTask");
		await expect.poll(() => page.evaluate(() => (window as any).app.commands.commands["tasknotes:create-new-task"]?.name)).toContain(commandName);
		await page.keyboard.press("Control+p");
		await page.locator(".prompt-input").fill("TaskNotes");
		await expect(page.locator(".suggestion-title").filter({ hasText: commandName }).first()).toBeVisible();
		await page.keyboard.press("Escape");
		const checks = [
			{ id: keyMap["settings.integrations.timeFormats.minutesAgo"].id, argument: "minutes" },
			...singletonContracts.replacements.filter((entry: any) => entry.context === "generated Bases contexts count" || entry.context === "recurrence daily interval").map((entry: any) => ({ id: entry.id, argument: entry.context.startsWith("recurrence") ? "interval" : "count" })),
		];
		const rendered = await page.evaluate(({ checks }) => {
			const service = (window as any).app.plugins.plugins.tasknotes.i18n;
			return checks.map(({ id, argument }: any) => ({ id, argument, values: [0, 1, 2, 5, 21].map(count => service.translate({ id }, { [argument]: count })) }));
		}, { checks });
		for (const row of rendered) {
			for (const [index, count] of [0, 1, 2, 5, 21].entries()) {
				expect(row.values[index]).toBe(cores.get(locale)!._(row.id, { [row.argument]: count }));
				if (row.argument === "minutes") expect(row.values[index]).toContain(new Intl.NumberFormat(locale).format(count));
			}
			if (row.argument === "count" && row.id !== checks[0].id) {
				expect(row.values[1]).not.toBe(row.values[2]);
				expect(row.values[4]).toBe(row.values[2]);
			}
		}
		const settingsPage = await openTaskNotesSettings(page);
		await expect(settingsPage.locator('select:has(option[value="system"]):has(option[value="fr"])')).toHaveValue(locale);
		await settingsPage.screenshot({ path: `test-results/lingui-native/${locale}-settings.png`, fullPage: true });
		await closeObsidianSettings(page, settingsPage);
		report[locale] = { commandName, rendered };
	}
	await expect.poll(() => JSON.parse(fs.readFileSync(settingsPath, "utf8")).uiLanguage).toBe("ru");
	// A valid Russian cache boots offline; corrupt content cannot activate,
	// and an explicit retry repairs the same content-addressed cache.
	mode = "offline";
	const beforeOffline = requests.length;
	await page.reload();
	const currentLocale = () => page.evaluate(() => (window as any).app?.plugins?.plugins?.tasknotes?.i18n?.getCurrentLocale());
	await expect.poll(currentLocale).toBe("ru");
	expect(requests.length).toBe(beforeOffline);
	const cache = path.join(fixturePlugin, "language-packs", russianPack.sha256, russianPack.file);
	const validCache = fs.readFileSync(cache);
	const corruptCache = Buffer.from(validCache);
	corruptCache[corruptCache.length - 1] ^= 1;
	fs.writeFileSync(cache, corruptCache);
	await page.reload();
	await expect.poll(() => requests.length).toBeGreaterThan(beforeOffline);
	await expect.poll(currentLocale).toBe("en");
	mode = "ok";
	const retryPage = await openTaskNotesSettings(page);
	await retryPage.getByRole("button", { name: expectedText("en", "settings.features.uiLanguage.retryDownload"), exact: true }).click();
	await expect.poll(currentLocale).toBe("ru");
	await closeObsidianSettings(page, retryPage);
	expect(fs.readFileSync(cache)).toEqual(validCache);
	report.cache = { offlineRussian: true, corruptFallbackEnglish: true, explicitRetryRepairs: true };
	const basesAfter = await page.evaluate(async paths => {
		const vault = (window as any).app.vault;
		return Object.fromEntries(await Promise.all(paths.map(async path => [path, await vault.read(vault.getAbstractFileByPath(path))])));
	}, Object.keys(basesBefore));
	expect(basesAfter).toEqual(basesBefore);
	fs.mkdirSync(path.join(root, "test-results/lingui-native"), { recursive: true });
	fs.writeFileSync(path.join(root, "test-results/lingui-native/report.json"), JSON.stringify({ locales: report, unchangedBases: Object.keys(basesBefore), requests }, null, 2));
});
