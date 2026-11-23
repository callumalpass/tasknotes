/**
 * Issue #2581: a task with no priority property was shown as "Normal".
 *
 * Bases views build a card's TaskInfo from the cache when TaskNotes identifies
 * the note as a task, and otherwise from the Bases row with a hard-coded
 * `priority || "normal"` fallback. A note that matches the view's filters but
 * not the task tag therefore showed the Normal label and colour. Bases sorting
 * and the generated priority formulas read the real (missing) property and rank
 * it below every configured priority, so the card must show no priority. A
 * tagged task without priority and a task with an explicit priority are controls.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2581
 */
import { test, expect, type Page } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue2581-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await page.evaluate(async (folder) => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const dir = app.vault.getAbstractFileByPath(folder);
			if (dir) await app.vault.delete(dir, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

test("a task without a priority property shows no priority on its card", async () => {
	await page.evaluate(async (folder) => {
		const app = (window as any).app;
		await app.vault.createFolder(folder);
		await app.vault.create(
			`${folder}/No priority.md`,
			"---\ntitle: No priority\nstatus: open\n---\n"
		);
		await app.vault.create(
			`${folder}/Tagged no priority.md`,
			"---\ntags: [task]\ntitle: Tagged no priority\nstatus: open\n---\n"
		);
		await app.vault.create(
			`${folder}/High priority.md`,
			"---\ntags: [task]\ntitle: High priority\nstatus: open\npriority: high\n---\n"
		);
		for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
		const board = await app.vault.create(
			`${folder}/Board.base`,
			`filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.ext == "md"\nviews:\n  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: status\n      direction: ASC\n    order:\n      - status\n      - priority\n`
		);
		await app.workspace.getLeaf("tab").openFile(board);
	}, folder);

	const card = (title: string) =>
		page
			.locator(".kanban-view__board .task-card")
			.filter({ has: page.getByText(title, { exact: true }) });
	const dot = (title: string) => card(title).locator(".task-card__priority-dot");

	await expect(dot("High priority")).toHaveAttribute("aria-label", "Priority: High");
	await expect(dot("Tagged no priority")).toHaveAttribute("aria-label", "Priority: None");
	await expect(dot("No priority")).toHaveAttribute("aria-label", "Priority: None");
	await expect(card("No priority")).not.toHaveClass(/task-card--priority-normal/);
});
