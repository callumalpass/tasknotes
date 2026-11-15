import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

// After a Kanban drop, the cached task kept the view's Bases entry, so the next
// property picker change failed with "DataCloneError: ... could not be cloned".
const folder = `Kanban drop picker ${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let vaultPath: string;
let originalStatuses: unknown;
const errors: string[] = [];

const path = (name: string) => `${folder}/${name}.md`;
const card = (name: string) =>
	page.locator(`.kanban-view__card-wrapper:not(.kanban-view__touch-ghost)[data-task-path="${path(name)}"]`);

async function readYaml(name: string): Promise<Record<string, unknown>> {
	const text = await readFile(join(vaultPath, path(name)), "utf8");
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function drag(source: Locator, target: Locator) {
	await expect(source).toBeVisible();
	await expect(target).toBeVisible();
	const from = (await source.boundingBox())!;
	const to = (await target.boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + 20);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2 + 12, from.y + 20, { steps: 4 });
	await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 25 });
	await page.mouse.up();
	await expect(source).not.toHaveAttribute("aria-busy", "true");
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	vaultPath = await page.evaluate(() => (window as any).app.vault.adapter.getBasePath());
	originalStatuses = await page.evaluate(async (folder) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		const original = plugin.settings.customStatuses;
		plugin.settings.customStatuses = ["open", "waiting"].map((value, order) => ({
			id: value, value, label: value, color: "#808080", isCompleted: false, order,
		}));
		plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
		await app.vault.createFolder(folder);
		for (const [name, status] of [["Alpha", "open"], ["Gamma", "waiting"]]) {
			await app.vault.create(
				`${folder}/${name}.md`,
				`---\ntags: [task]\ntitle: ${name}\nstatus: ${status}\npriority: normal\n---\n`
			);
		}
		return original;
	}, folder);
	const content = stringify({
		filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
		views: [{ type: "tasknotesKanban", name: "Board", groupBy: { property: "status", direction: "ASC" } }],
	});
	await page.evaluate(async ({ path, content }) => {
		const app = (window as any).app;
		for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
		await app.workspace.getLeaf("tab").openFile(await app.vault.create(path, content));
	}, { path: `${folder}/Board.base`, content });
	await expect(page.locator(".kanban-view__card-wrapper")).toHaveCount(2);
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(async ({ folder, originalStatuses }) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins.tasknotes;
				plugin.settings.customStatuses = originalStatuses;
				plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
				for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			}, { folder, originalStatuses });
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("after a Kanban drop, the task reflects later edits and its pickers save", async () => {
	await drag(card("Alpha"), card("Gamma"));
	await expect.poll(async () => (await readYaml("Alpha")).status).toBe("waiting");

	// An edit made outside TaskNotes must replace the drop's cached snapshot.
	await page.evaluate(async (p) => {
		const app = (window as any).app;
		await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(p), (fm: any) => {
			fm.priority = "low";
		});
	}, path("Alpha"));
	await expect.poll(() => page.evaluate(async (p) =>
		(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(p))?.priority,
	path("Alpha"))).toBe("low");

	await card("Alpha").locator(".task-card__main-row").first().click({ button: "right" });
	await page.locator(".menu .menu-item").filter({ hasText: "Priority" }).first().click();
	await page.locator(".tn-picker, .suggestion-container, .menu").last()
		.getByText("High", { exact: true }).first().click();

	await expect.poll(async () => (await readYaml("Alpha")).priority).toBe("high");
	expect(errors.filter((text) => text.includes("Failed to change task property"))).toEqual([]);
});
