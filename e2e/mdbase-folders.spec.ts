import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ObsidianApp } from "./obsidian";

let app: ObsidianApp | undefined;
let ownedRoot: string;
let obsidian: typeof import("./obsidian");

test.beforeAll(async () => {
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
	process.env.TASKNOTES_E2E_VAULT_DIR = vault;
	process.env.TASKNOTES_E2E_USER_DATA_DIR = path.join(ownedRoot, "profile");
	process.env.TASKNOTES_E2E_REUSE_OBSIDIAN = "0";
	obsidian = require("./obsidian");
	app = await obsidian.launchObsidian();
});

test.afterAll(async () => {
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
