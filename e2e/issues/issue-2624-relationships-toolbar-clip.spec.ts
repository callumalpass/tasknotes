/**
 * Issue #2624: the Relationships widget toolbar clipped the tops of its labels
 * (Sort, Group, Filter, Properties, Search).
 *
 * TaskNotes lets the Bases toolbar wrap, but Obsidian keeps `.bases-header` at a
 * fixed `--bases-header-height`. At widths where the toolbar wrapped to two
 * rows, it overflowed the header upwards and the embed's `overflow: hidden`
 * cut off the first row. The header now grows with the toolbar.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2624
 */
import { test, expect, type Page } from "@playwright/test";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
});

test.afterAll(async () => {
	if (instance) await closeObsidian(instance);
});

test("relationships toolbar stays inside the Bases header at every width", async () => {
	await page.evaluate(async () => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath("TaskNotes/Code review PR 123.md");
		const leaf = app.workspace.getLeaf("tab");
		await leaf.openFile(file, { state: { mode: "preview" } });
		app.workspace.setActiveLeaf(leaf, { focus: true });
	});
	const widget = page.locator(".workspace-leaf.mod-active .tasknotes-relationships-widget");
	await expect(widget.locator(".bases-toolbar .bases-toolbar-sort-menu")).toBeVisible();

	// Sweep widths so the toolbar passes through its one-row, wrapped and narrow
	// layouts whatever the fonts are; the toolbar must never overflow the header.
	const overflows = await widget.evaluate(async (el: HTMLElement) => {
		const found: string[] = [];
		for (let width = 440; width <= 900; width += 10) {
			el.style.maxWidth = `${width}px`;
			await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
			const header = el.querySelector(".bases-header")!.getBoundingClientRect();
			const toolbar = el.querySelector(".bases-toolbar")!.getBoundingClientRect();
			if (toolbar.top < header.top - 0.5 || toolbar.bottom > header.bottom + 0.5) {
				found.push(`${width}px: toolbar ${toolbar.height}px in header ${header.height}px`);
			}
		}
		el.style.maxWidth = "";
		return found;
	});
	expect(overflows).toEqual([]);
});
