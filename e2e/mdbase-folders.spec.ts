import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import type { ObsidianApp } from "./obsidian";

let app: ObsidianApp | undefined;
let ownedRoot: string;
let obsidian: typeof import("./obsidian");

test.beforeEach(async ({}, testInfo) => {
	ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tasknotes-mdbase-folders-"));
	const vault = path.join(ownedRoot, "vault");
	const config = path.join(vault, ".obsidian");
	const plugin = path.join(config, "plugins/tasknotes");
	fs.mkdirSync(plugin, { recursive: true });
	for (const file of ["main.js", "manifest.json", "styles.css"]) {
		fs.copyFileSync(path.resolve(__dirname, "..", file), path.join(plugin, file));
	}
	fs.writeFileSync(path.join(config, "community-plugins.json"), JSON.stringify(["tasknotes"]));
	fs.writeFileSync(
		path.join(config, "core-plugins.json"),
		JSON.stringify(["file-explorer", "switcher", "global-search", "command-palette", "bases"])
	);
	fs.writeFileSync(
		path.join(plugin, "data.json"),
		JSON.stringify({
			enableMdbaseSpec: true,
			uiLanguage: "en",
			checkForUpdatesOnStartup: false,
			showReleaseNotesOnUpdate: false,
		})
	);
	fs.writeFileSync(path.join(vault, "My note.md"), "# My note\n");
	if (testInfo.title.startsWith("old-layout")) {
		const resources = buildTaskNotesMdbaseResources({ typesFolder: "_types", contractsFolder: "_contracts" });
		for (const [file, content] of [
			["mdbase.yaml", resources.configDocument],
			[resources.paths.type, resources.typeDocument],
			[resources.paths.contract, resources.contractDocument],
		] as const) {
			fs.mkdirSync(path.dirname(path.join(vault, file)), { recursive: true });
			fs.writeFileSync(path.join(vault, file), content);
		}
		// Reader's reserved folder must be hidden even without a TaskNotes record.
		fs.mkdirSync(path.join(vault, "_settings"), { recursive: true });
		fs.writeFileSync(path.join(vault, "_settings/dev.mdbase.reader.md"), "---\napp: dev.mdbase.reader\n---\n");
		if (testInfo.title.includes("legacy record")) {
			fs.writeFileSync(path.join(vault, "_settings/dev.tasknotes.md"), "---\nmdbase_type: tasknotes-settings\napp: dev.tasknotes\nscope: collection\nsettings_version: 1\narchive_folder: Legacy/Archive\n---\nKeep this body.\n");
		}
	}
	process.env.TASKNOTES_E2E_VAULT_DIR = vault;
	process.env.TASKNOTES_E2E_USER_DATA_DIR = path.join(ownedRoot, "profile");
	process.env.TASKNOTES_E2E_REUSE_OBSIDIAN = "0";
	// The harness captures its vault at module load; each test owns a fresh one.
	delete require.cache[require.resolve("./obsidian")];
	obsidian = require("./obsidian");
	app = await obsidian.launchObsidian();
});

test.afterEach(async () => {
	try {
		if (app) await obsidian.closeObsidian(app);
	} finally {
		if (ownedRoot) fs.rmSync(ownedRoot, { recursive: true, force: true });
	}
});

test("new vault metadata is hidden by default and the settings toggle reveals it", async () => {
	const page = app!.page;
	const explorer = page.locator('.workspace-leaf-content[data-type="file-explorer"]');
	await expect(explorer).toBeVisible();
	const metadata = explorer.locator('.nav-folder-title[data-path="_mdbase"]');
	await expect(metadata).toHaveCount(1);
	await expect(metadata).toBeHidden();
	await expect(
		explorer
			.locator(".nav-folder:visible > .nav-folder-title")
			.filter({ hasText: /^(_mdbase|_types|_contracts|_settings|_schemas|schemas)$/ })
	).toHaveCount(0);
	await expect(explorer.locator('.nav-file-title[data-path="My note.md"]')).toBeVisible();
	const vault = process.env.TASKNOTES_E2E_VAULT_DIR!;
	expect(fs.readFileSync(path.join(vault, "mdbase.yaml"), "utf8")).toContain(
		"types_folder: _mdbase/types"
	);
	expect(fs.existsSync(path.join(vault, "_mdbase/README.md"))).toBe(true);

	const settingsPage = await obsidian.revealTaskNotesSetting(page, "hideMdbaseFolders");
	const toggle = obsidian
		.nativeSettingRow(settingsPage, "Hide mdbase folders in the file explorer")
		.locator(".checkbox-container");
	await expect(toggle).toHaveClass(/is-enabled/);
	await toggle.click();
	await expect(toggle).not.toHaveClass(/is-enabled/);
	// Wait for the asynchronous save and its visible effect before closing the popout.
	await expect(metadata).toBeVisible();
	await obsidian.closeObsidianSettings(page, settingsPage);
	await expect(metadata).toBeVisible();
	await page.screenshot({ path: "test-results/mdbase-folders-visible.png" });

	// The persisted toggle must survive a native plugin reload, and unloading removes the CSS.
	const sheetsBeforeUnload = await page.evaluate(() => document.adoptedStyleSheets.length);
	await page.evaluate(async () => {
		const plugins = (window as any).app.plugins;
		await plugins.disablePlugin("tasknotes");
	});
	expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(sheetsBeforeUnload - 1);
	await page.evaluate(async () => {
		await (window as any).app.plugins.enablePlugin("tasknotes");
	});
	await expect(metadata).toBeVisible();
});

for (const legacy of [true, false]) {
	test(`old-layout vault ${legacy ? "with legacy record keeps its location" : "without a record creates settings in _mdbase"}`, async () => {
		const page = app!.page;
		const vault = process.env.TASKNOTES_E2E_VAULT_DIR!;
		const current = "_mdbase/settings/dev.tasknotes.md";
		const old = "_settings/dev.tasknotes.md";
		const selected = legacy ? old : current;
		const explorer = page.locator('.workspace-leaf-content[data-type="file-explorer"]');
		const settingsFolder = explorer.locator('.nav-folder-title[data-path="_settings"]');
		await expect(settingsFolder).toHaveCount(1);
		await expect(settingsFolder).toBeHidden();
		expect(await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.settings.archiveFolder)).toBe(legacy ? "Legacy/Archive" : "TaskNotes/Archive");
		expect(fs.existsSync(path.join(vault, current))).toBe(false);
		const configBefore = fs.readFileSync(path.join(vault, "mdbase.yaml"), "utf8");
		await page.evaluate(async () => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			plugin.settings.archiveFolder = "Saved/Archive";
			await plugin.saveSettings();
		});
		await expect.poll(() => fs.existsSync(path.join(vault, selected)) && fs.readFileSync(path.join(vault, selected), "utf8")).toContain("archive_folder: Saved/Archive");
		expect(fs.existsSync(path.join(vault, legacy ? current : old))).toBe(false);
		if (legacy) expect(fs.readFileSync(path.join(vault, old), "utf8")).toContain("Keep this body.");
		expect(fs.readFileSync(path.join(vault, "mdbase.yaml"), "utf8")).toBe(configBefore);
		if (!legacy) {
			const metadata = explorer.locator('.nav-folder-title[data-path="_mdbase"]');
			await expect(metadata).toHaveCount(1);
			await expect(metadata).toBeHidden();
		}
		await page.evaluate(async () => {
			const plugins = (window as any).app.plugins;
			await plugins.disablePlugin("tasknotes");
			await plugins.enablePlugin("tasknotes");
		});
		expect(await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.settings.archiveFolder)).toBe("Saved/Archive");
	});
}
