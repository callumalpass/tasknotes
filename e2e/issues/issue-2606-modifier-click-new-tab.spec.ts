/**
 * Issue #2606: Ctrl/Cmd+click on a task card no longer opened the task note in
 * a new tab, and the task menu's only top-level open action reused the
 * current tab.
 *
 * Bases views read Ctrl/Cmd+click as "toggle selection" before the card's own
 * click handler ran, so the Obsidian-standard modifier never reached
 * navigation. Ctrl/Cmd+click and middle-click now open the note in a new tab on
 * every task surface; Shift+click (or Select tasks) starts a selection, and
 * while one is active Ctrl/Cmd+click keeps toggling cards.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2606
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue 2606 ${Date.now()}`;
const taskPath = `${folder}/Water the plants.md`;
const otherPath = `${folder}/Call the bank.md`;
const notePath = `${folder}/Daily log.md`;
let instance: ObsidianApp;
let page: Page;

function localDate(): string {
	const date = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = localDate();

const views: Record<string, string> = {
	list: "  - type: tasknotesTaskList\n    name: List\n",
	kanban: "  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: status\n      direction: ASC\n",
	calendar:
		"  - type: tasknotesCalendar\n    name: Week\n    calendarView: timeGridWeek\n    showScheduled: true\n    showDue: false\n    showRecurring: false\n    showTimeEntries: false\n    showTimeblocks: false\n    showPropertyBasedEvents: false\n    scrollTime: 09:00:00\n",
	agenda:
		"  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n    showScheduled: true\n    showDue: false\n    showRecurring: false\n    showTimeEntries: false\n    showTimeblocks: false\n    showPropertyBasedEvents: false\n",
};

/** Opens a surface alone in the main area and returns the task's card. */
async function openSurface(surface: string): Promise<Locator> {
	await page.evaluate(
		async ({ folder, surface, view, notePath }) => {
			const app = (window as any).app;
			app.plugins.plugins.tasknotes.taskSelectionService?.clearSelection();
			app.plugins.plugins.tasknotes.taskSelectionService?.exitSelectionMode();
			const stale = [
				...app.workspace.getLeavesOfType("markdown"),
				...app.workspace.getLeavesOfType("bases"),
			];
			let file;
			if (surface === "inline") {
				file = app.vault.getAbstractFileByPath(notePath);
			} else {
				const basePath = `${folder}/${surface}.base`;
				file =
					app.vault.getAbstractFileByPath(basePath) ??
					(await app.vault.create(
						basePath,
						`filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n${view}`
					));
			}
			const leaf = app.workspace.getLeaf("tab");
			await leaf.openFile(file, surface === "inline" ? { state: { mode: "source", source: false } } : {});
			for (const old of stale) if (old !== leaf) old.detach();
			app.workspace.setActiveLeaf(leaf, { focus: true });
		},
		{ folder, surface, view: views[surface] ?? "", notePath }
	);
	const scope =
		surface === "inline"
			? ".workspace-leaf.mod-active .tasknotes-inline-widget"
			: ".workspace-leaf.mod-active";
	const card =
		surface === "calendar"
			? page.locator(`${scope} .tnc-item[data-task-path="${taskPath}"]`).first()
			: page.locator(`${scope} .task-card[data-task-path="${taskPath}"]`).first();
	await expect(card).toBeVisible();
	// Let deferred view refreshes settle so a click does not land on a card being replaced.
	await page.waitForTimeout(500);
	return card;
}

/** Where to click: the title on cards, the event body in the time grid. */
function clickTarget(card: Locator, surface: string): Locator {
	return surface === "calendar" ? card : card.locator(".task-card__title").first();
}

async function workspaceState() {
	return page.evaluate((taskPath) => {
		const app = (window as any).app;
		return {
			taskTabs: app.workspace
				.getLeavesOfType("markdown")
				.filter((leaf: any) => leaf.view.file?.path === taskPath).length,
			activePath: app.workspace.getActiveFile()?.path ?? null,
			surfaceLeaves:
				app.workspace.getLeavesOfType("bases").length +
				app.workspace
					.getLeavesOfType("markdown")
					.filter((leaf: any) => leaf.view.file?.path?.endsWith("Daily log.md")).length,
			selected: app.plugins.plugins.tasknotes.taskSelectionService?.getSelectedPaths() ?? [],
			modal: !!document.querySelector(".modal-container"),
		};
	}, taskPath);
}

async function expectOpenedInNewTab(): Promise<void> {
	await expect.poll(async () => (await workspaceState()).taskTabs, { timeout: 5000 }).toBe(1);
	// Past the single/double-click window, so a second handler would have opened another tab.
	await page.waitForTimeout(400);
	const state = await workspaceState();
	expect(state.taskTabs).toBe(1);
	// The view or note that held the card is still open in its own tab.
	expect(state.surfaceLeaves).toBe(1);
	expect(state.selected).toEqual([]);
	expect(state.modal).toBe(false);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	await page.evaluate(
		async ({ folder, taskPath, otherPath, notePath, today }) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins.tasknotes;
			plugin.settings.singleClickAction = "edit";
			plugin.settings.doubleClickAction = "openNote";
			app.workspace.leftSplit.collapse();
			app.workspace.rightSplit.collapse();
			await app.vault.createFolder(folder);
			await app.vault.create(
				taskPath,
				`---\ntitle: Water the plants\nstatus: open\npriority: normal\nscheduled: ${today}T10:00\ntags:\n  - task\n---\n`
			);
			await app.vault.create(
				otherPath,
				`---\ntitle: Call the bank\nstatus: open\npriority: normal\nscheduled: ${today}T13:00\ntags:\n  - task\n---\n`
			);
			await app.vault.create(notePath, `Today: [[Water the plants]]\n`);
		},
		{ folder, taskPath, otherPath, notePath, today }
	);
	await expect
		.poll(() =>
			page.evaluate(
				async (path) => !!(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)),
				taskPath
			)
		)
		.toBe(true);
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(async (folder) => {
				const app = (window as any).app;
				for (const leaf of [
					...app.workspace.getLeavesOfType("markdown"),
					...app.workspace.getLeavesOfType("bases"),
				])
					leaf.detach();
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			}, folder);
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

for (const surface of ["list", "kanban", "calendar", "agenda", "inline"]) {
	test(`${surface}: Ctrl/Cmd+click opens the task note in a new tab`, async () => {
		const card = await openSurface(surface);
		await clickTarget(card, surface).click({ modifiers: ["ControlOrMeta"], force: true });
		await expectOpenedInNewTab();
	});

	test(`${surface}: middle-click opens the task note in a new tab`, async () => {
		const card = await openSurface(surface);
		await clickTarget(card, surface).click({ button: "middle", force: true });
		await expectOpenedInNewTab();
	});

	test(`${surface}: the task menu offers Open note in new tab`, async () => {
		const card = await openSurface(surface);
		await clickTarget(card, surface).click({ button: "right", force: true });
		await page.locator(".menu .menu-item", { hasText: /^Open note in new tab$/ }).click({ timeout: 5000 });
		await expectOpenedInNewTab();
	});
}

test("a plain click still follows the single-click setting", async () => {
	const card = await openSurface("list");
	await clickTarget(card, "list").click({ force: true });
	await expect(page.locator(".modal-container")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.locator(".modal-container")).toHaveCount(0);
	expect((await workspaceState()).taskTabs).toBe(0);
});

test("Shift+click starts a selection and Ctrl/Cmd+click then toggles cards", async () => {
	const card = await openSurface("list");
	const other = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${otherPath}"]`).first();
	await clickTarget(card, "list").click({ modifiers: ["Shift"], force: true });
	await clickTarget(other, "list").click({ modifiers: ["ControlOrMeta"], force: true });
	expect(new Set((await workspaceState()).selected)).toEqual(new Set([taskPath, otherPath]));
	await clickTarget(other, "list").click({ modifiers: ["ControlOrMeta"], force: true });
	expect((await workspaceState()).selected).toEqual([taskPath]);
	expect((await workspaceState()).taskTabs).toBe(0);
});
