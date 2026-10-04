import { test, expect } from "@playwright/test";
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
let mode: "ok" | "offline" | "corrupt-de" | "slow-ru" = "ok";
const requests: string[] = [];
let frenchCreateTaskName: string;

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
	const files = new Map(
		Object.values(manifest.packs).map(({ file }) => [
			file,
			fs.readFileSync(path.join(directory, file), "utf8"),
		])
	);
	frenchCreateTaskName = JSON.parse(files.get("fr.json")!).messages["commands.createNewTask"];
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
		if (mode === "slow-ru" && file === "ru.json") setTimeout(respond, 300);
		else respond();
	});
	await new Promise<void>((resolve, reject) => {
		server!.once("error", reject);
		server!.listen(Number(endpoint.port), "127.0.0.1", resolve);
	});
	savedSettings = fs.readFileSync(settingsPath);
	const settings = JSON.parse(savedSettings.toString());
	settings.uiLanguage = "en";
	settings.checkForUpdatesOnStartup = false;
	settings.showReleaseNotesOnUpdate = false;
	fs.writeFileSync(settingsPath, JSON.stringify(settings));
	// This is generated data in this worktree's isolated test vault only.
	fs.rmSync(path.join(fixturePlugin, "language-packs"), { recursive: true, force: true });
	app = await launchObsidian();
});

test.afterAll(async () => {
	if (app) await closeObsidian(app);
	if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
	if (savedSettings) fs.writeFileSync(settingsPath, savedSettings);
	if (!hadStatsBase) fs.rmSync(generatedStatsBase, { force: true });
});

test("downloads through the native picker, survives an offline reload, and retries corrupt data", async () => {
	const page = app!.page;
	const currentLocale = () =>
		page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale());
	expect(await currentLocale()).toBe("en");
	expect(requests).toEqual([]);

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
