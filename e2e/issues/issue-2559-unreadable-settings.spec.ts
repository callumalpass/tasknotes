/**
 * Issue #2559 (follow-up): updating 4.13.8 -> 4.18.4 showed only Obsidian's
 * "Failed to load" toast. When data.json exists but cannot be read, TaskNotes
 * refuses to start so it cannot overwrite settings with defaults (#1591). The
 * reporter could not see why, reinstalled, and reinstalling deleted data.json.
 *
 * During a plugin update the outgoing version can still be writing data.json,
 * so TaskNotes now waits about two seconds for it, and otherwise says why it
 * did not start.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2559
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const dataPath = path.resolve(
	__dirname,
	"../../tasknotes-e2e-vault/.obsidian/plugins/tasknotes/data.json"
);
let instance: ObsidianApp;
let page: Page;
let saved: string;

async function restartPlugin(): Promise<void> {
	await page.evaluate(async () => {
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
		await (window as any).app.plugins.enablePlugin("tasknotes");
	});
}

async function notices(): Promise<string> {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll(".notice"))
			.map((notice) => notice.textContent ?? "")
			.join("\n")
	);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	await page.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.settings.taskPropertyName = "issue-2559";
		await plugin.saveSettings();
	});
	saved = fs.readFileSync(dataPath, "utf8");
});

test.beforeEach(async () => {
	await page.evaluate(async () => {
		await (window as any).app.plugins.disablePlugin("tasknotes");
	});
});

test.afterAll(async () => {
	try {
		if (saved) fs.writeFileSync(dataPath, saved);
		if (page && !page.isClosed()) {
			await page.evaluate(async () => {
				const app = (window as any).app;
				await app.plugins.disablePlugin("tasknotes");
				await app.plugins.enablePlugin("tasknotes");
				const plugin = app.plugins.plugins.tasknotes;
				plugin.settings.taskPropertyName = "";
				await plugin.saveSettings();
			});
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("loads settings that become readable while it waits", async () => {
	fs.writeFileSync(dataPath, "");
	const writing = new Promise<void>((resolve) =>
		setTimeout(() => {
			fs.writeFileSync(dataPath, saved);
			resolve();
		}, 800)
	);

	await restartPlugin();
	await writing;

	await expect
		.poll(() =>
			page.evaluate(
				() => (window as any).app.plugins.plugins.tasknotes?.settings?.taskPropertyName
			)
		)
		.toBe("issue-2559");
	expect(await notices()).not.toMatch(/Failed to load|could not be read/);
});

test("says why it did not start, and leaves the settings file alone", async () => {
	fs.writeFileSync(dataPath, "");

	await restartPlugin();

	await expect.poll(notices, { timeout: 10000 }).toContain(
		"TaskNotes did not start because its settings file could not be read"
	);
	expect(await notices()).toContain("Reinstalling TaskNotes deletes its settings");
	expect(fs.readFileSync(dataPath, "utf8")).toBe("");
	fs.writeFileSync(dataPath, saved);
});
