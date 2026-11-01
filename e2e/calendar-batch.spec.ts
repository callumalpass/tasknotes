import { test, expect, type Page, type Locator } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "./obsidian";
import { rmSync } from "node:fs";
import { join } from "node:path";

// Discussion #2435: batch date picking and calendar task selection/group moves.
let obsidian: ObsidianApp;
let folder: string;
let basePath: string;
let vaultDirectory: string;
const createdFolders: string[] = [];
let days: string[];

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	vaultDirectory = await obsidian.page.evaluate(() => (window as any).app.vault.adapter.basePath);
	days = await obsidian.page.evaluate(() => Array.from({ length: 5 }, (_, i) => {
		const date = new Date(); date.setDate(date.getDate() + i);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	}));
});
test.afterAll(async () => {
	if (obsidian) await closeObsidian(obsidian);
	// Bases can finish a debounced config save after its view detaches. Keep
	// each fixture until our isolated process has stopped, then remove only it.
	for (const name of createdFolders) rmSync(join(vaultDirectory, name), { recursive: true, force: true });
});

test.beforeEach(async () => {
	folder = `E2E calendar batch ${Date.now()}-${createdFolders.length}`;
	basePath = `${folder}/Batch.base`;
	createdFolders.push(folder);
	await obsidian.page.evaluate(async ({ folder, basePath, days }) => {
		const app = (window as any).app;
		app.plugins.plugins.tasknotes.i18n.setLocale("en");
		if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
		for (const [name, scheduled, due, recurrence] of [
			["Alpha", `${days[0]}T09:00`, `${days[2]}T17:00`],
			["Bravo", `${days[1]}T11:30`, `${days[2]}T16:00`],
			["Charlie", days[0], days[2]],
			["DueOnly", "", days[1]],
			["Recurring", `${days[0]}T13:00`, "", "FREQ=DAILY"],
		]) {
			const path = `${folder}/${name}.md`;
			const text = `---\ntitle: ${name}\nstatus: open\npriority: normal\ntags: [task]\n${scheduled ? `scheduled: ${scheduled}\n` : ""}${due ? `due: ${due}\n` : ""}${recurrence ? `recurrence: ${recurrence}\n` : ""}---\n`;
			const file = app.vault.getAbstractFileByPath(path);
			if (file) await app.vault.modify(file, text); else await app.vault.create(path, text);
		}
		const text = `filters:\n  and:\n    - file.inFolder("${folder}")\n    - note.status == "open"\nviews:\n  - type: tasknotesCalendar\n    name: Calendar Batch\n    calendarView: timeGridCustom\n    customDayCount: 3\n    showScheduled: true\n    showDue: true\n    showRecurring: true\n    scrollTime: 08:00:00\n    snapDuration: 00:30:00\n  - type: tasknotesTaskList\n    name: List Batch\n    order: [note.status, note.scheduled, note.due]\n  - type: tasknotesKanban\n    name: Kanban Batch\n    groupBy:\n      property: note.status\n      direction: ASC\n`;
		const file = app.vault.getAbstractFileByPath(basePath);
		if (file) await app.vault.modify(file, text); else await app.vault.create(basePath, text);
		await app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath(basePath));
	}, { folder, basePath, days });
	await expect(event(obsidian.page, "Alpha")).toBeVisible();
});

test.afterEach(async () => {
	await obsidian.page.evaluate(async folder => {
		const app = (window as any).app;
		app.plugins.plugins.tasknotes.taskSelectionService.exitSelectionMode(true);
		for (const leaf of app.workspace.getLeavesOfType("bases")) {
			if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
		}
	}, folder);
});

function event(page: Page, name: string, type = "scheduled"): Locator {
	return page.locator(`.tnc:visible .tnc-item[data-task-path="${folder}/${name}.md"][data-event-type="${type}"]`).first();
}
async function taskDates(page: Page, name: string) {
	return page.evaluate(async path => {
		const task = await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path);
		return { scheduled: task?.scheduled, due: task?.due };
	}, `${folder}/${name}.md`);
}
async function selected(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.getSelectedPaths());
}
async function dragByColumn(page: Page, item: Locator): Promise<void> {
	const columns = page.locator(".tnc:visible .tnc-tg .tnc-col");
	const first = (await columns.nth(0).boundingBox())!;
	const second = (await columns.nth(1).boundingBox())!;
	const box = (await item.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 8);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + second.x - first.x, box.y + 8, { steps: 20 });
	await page.mouse.up();
}
async function picker(page: Page, card: Locator, role: string): Promise<Locator> {
	await card.click({ button: "right" });
	await page.getByText(role, { exact: true }).hover();
	await page.getByText("Pick date & time…", { exact: true }).click();
	const modal = page.locator(".date-time-picker-modal");
	await expect(modal).toBeVisible();
	return modal;
}

test("modifier selection, visible clear control, range and keyboard select-all", async () => {
	const page = obsidian.page;
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "Bravo").click({ modifiers: ["Control"] });
	expect(await selected(page)).toHaveLength(2);
	await expect(page.locator(".tn-selection-indicator:visible")).toBeVisible();
	await expect(event(page, "Alpha")).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("Control+a");
	const paths = await selected(page);
	expect(paths).toHaveLength(4);
	expect(paths).not.toContain(`${folder}/Recurring.md`);
	await page.locator(".tn-selection-indicator:visible").click();
	expect(await selected(page)).toEqual([]);
	await expect(page.getByRole("button", { name: "Select tasks", exact: true })).toHaveAttribute("aria-pressed", "false");
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "Charlie").click({ modifiers: ["Shift"] });
	expect(new Set(await selected(page))).toEqual(new Set([`${folder}/Alpha.md`, `${folder}/Charlie.md`]));
	await page.getByRole("button", { name: "Task options", exact: true }).click();
	await expect(page.getByText("2 tasks selected", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
});

test("calendar list mode keeps selection consistent and excludes recurrence previews", async () => {
	const page = obsidian.page;
	await page.getByRole("button", { name: "List view", exact: true }).click();
	// Wait for the existing debounced view preference save, not just the first
	// list paint: its config refresh can replace a card during a pointer click.
	await expect.poll(() => page.evaluate(async path => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, basePath)).toMatch(/calendarView:\s*listWeek/);
	await event(page, "Alpha").locator(".task-card").click({ modifiers: ["Control"] });
	await event(page, "Bravo").locator(".task-card").click({ modifiers: ["Control"] });
	await page.locator(`.tnc:visible .tnc-item[data-task-path="${folder}/Recurring.md"] .task-card`).first().click({ modifiers: ["Shift"] });
	expect(new Set(await selected(page))).toEqual(new Set([`${folder}/Alpha.md`, `${folder}/Bravo.md`]));
	await page.locator(".tnc-btn-selectedTasks:visible").click();
	await expect(page.getByText("2 tasks selected", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
});

test("select-all excludes tasks hidden by the all-day setting", async () => {
	const page = obsidian.page;
	await page.evaluate(async path => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		await app.vault.modify(file, (await app.vault.read(file)).replace("    scrollTime:", "    showAllDaySlot: false\n    scrollTime:"));
	}, basePath);
	await expect(page.locator(".tnc:visible .tnc-tg-allday")).toHaveCount(0);
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await page.keyboard.press("Control+a");
	expect(new Set(await selected(page))).toEqual(new Set([`${folder}/Alpha.md`, `${folder}/Bravo.md`]));
});

test("group dragging keeps relative days, local times and deadlines, and offers Undo", async () => {
	const page = obsidian.page;
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "Bravo").click({ modifiers: ["Control"] });
	await dragByColumn(page, event(page, "Alpha"));
	await expect.poll(() => taskDates(page, "Alpha")).toEqual({ scheduled: `${days[1]}T09:00`, due: `${days[2]}T17:00` });
	expect(await taskDates(page, "Bravo")).toEqual({ scheduled: `${days[2]}T11:30`, due: `${days[2]}T16:00` });
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect.poll(async () => (await taskDates(page, "Bravo")).scheduled).toBe(`${days[1]}T11:30`);
	expect((await taskDates(page, "Alpha")).scheduled).toBe(`${days[0]}T09:00`);
});

test("peer previews precede writes and Escape restores all placements", async () => {
	const page = obsidian.page;
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "Bravo").click({ modifiers: ["Control"] });
	const columns = page.locator(".tnc:visible .tnc-tg .tnc-col");
	const first = (await columns.nth(0).boundingBox())!, second = (await columns.nth(1).boundingBox())!;
	const box = (await event(page, "Alpha").boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 8);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + second.x - first.x, box.y + 8, { steps: 20 });
	await expect(page.locator(".tn-calendar-batch-preview")).toHaveCount(1);
	await expect(event(page, "Bravo")).toHaveAttribute("aria-hidden", "true");
	expect((await taskDates(page, "Alpha")).scheduled).toBe(`${days[0]}T09:00`);
	expect((await taskDates(page, "Bravo")).scheduled).toBe(`${days[1]}T11:30`);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(page.locator(".tn-calendar-batch-preview")).toHaveCount(0);
	await expect(event(page, "Bravo")).not.toHaveAttribute("aria-hidden", "true");
	expect((await taskDates(page, "Bravo")).scheduled).toBe(`${days[1]}T11:30`);
});

test("crowded month cells do not fold peer previews into the more menu", async () => {
	const page = obsidian.page;
	await page.evaluate(async folder => {
		const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
		for (const [name, value] of [["Alpha", "2031-05-05T09:00"], ["Bravo", "2031-05-06T11:30"]]) {
			await plugin.taskService.updateProperty(await plugin.cacheManager.getTaskInfo(`${folder}/${name}.md`), "scheduled", value);
		}
		await app.vault.create(`${folder}/Busy.md`, "---\ntitle: Busy\nstatus: open\npriority: normal\ntags: [task]\nscheduled: 2031-05-07T07:00\n---\n");
	}, folder);
	await page.getByRole("button", { name: "Month view", exact: true }).click();
	await expect.poll(() => page.evaluate(async path => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, basePath)).toContain("calendarView: dayGridMonth");
	await page.evaluate(() => (window as any).app.workspace.getMostRecentLeaf().view.controller.view.calendar.gotoDate("2031-05-05"));
	await expect(event(page, "Busy")).toBeVisible();
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "Bravo").click({ modifiers: ["Control"] });
	await page.evaluate(() => {
		const calendar = (window as any).app.workspace.getMostRecentLeaf().view.controller.view.calendar;
		calendar.setOptions({ dayMaxEvents: 1 }); calendar.flush();
	});
	expect(await selected(page)).toHaveLength(2);
	const box = (await event(page, "Alpha").boundingBox())!;
	const target = (await page.locator('.tnc-dg-day[data-date="2031-05-06"]').boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + 8); await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + 55, { steps: 20 });
	await expect(event(page, "Bravo")).toHaveClass(/tn-calendar-batch-preview/);
	await expect(event(page, "Bravo")).toBeVisible();
	await expect(event(page, "Bravo")).toHaveClass(/is-mirror/);
	expect((await taskDates(page, "Bravo")).scheduled).toBe("2031-05-06T11:30");
	await page.keyboard.press("Escape"); await page.mouse.up();
	await expect(page.locator(".tn-calendar-batch-preview")).toHaveCount(0);
});

for (const view of ["List", "Kanban"]) {
	test(`${view} Ctrl/Cmd clicks toggle card selection without navigation`, async () => {
		const page = obsidian.page;
		await page.locator(".bases-toolbar-views-menu:visible").click();
		await page.getByText(`${view} Batch`, { exact: true }).last().click();
		const content = (name: string) => page.locator(`.task-card[data-task-path="${folder}/${name}.md"]:visible`).first().locator(".task-card__content");
		await content("Alpha").click({ modifiers: ["Control"] });
		await content("Bravo").click({ modifiers: ["Meta"] });
		expect(new Set(await selected(page))).toEqual(new Set([`${folder}/Alpha.md`, `${folder}/Bravo.md`]));
		await content("Alpha").click({ modifiers: ["Control"] });
		expect(await selected(page)).toEqual([`${folder}/Bravo.md`]);
		await expect(page.locator(".modal-container")).toHaveCount(0);
		expect(await page.evaluate(() => (window as any).app.workspace.getMostRecentLeaf().view.file?.path)).toBe(basePath);
	});
}

test("keyboard moves shift selected tasks by the same half-hour", async () => {
	const page = obsidian.page;
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "Bravo").click({ modifiers: ["Control"] });
	await event(page, "Alpha").focus();
	await page.keyboard.press("Alt+ArrowDown");
	await expect.poll(async () => (await taskDates(page, "Bravo")).scheduled).toBe(`${days[1]}T12:00`);
	expect((await taskDates(page, "Alpha")).scheduled).toBe(`${days[0]}T09:30`);
});

test("incompatible markers are rejected without partially moving the selection", async () => {
	const page = obsidian.page;
	await event(page, "Alpha").click({ modifiers: ["Control"] });
	await event(page, "DueOnly", "due").click({ modifiers: ["Control"] });
	await dragByColumn(page, event(page, "Alpha"));
	await expect(page.locator(".notice").filter({ hasText: "Group moves require" })).toBeVisible();
	expect((await taskDates(page, "Alpha")).scheduled).toBe(`${days[0]}T09:00`);
	expect((await taskDates(page, "DueOnly")).due).toBe(days[1]);
});

for (const view of ["Calendar", "List", "Kanban"]) {
	test(`${view} batch picker accepts arbitrary dates and times; cancellation does not write`, async () => {
		const page = obsidian.page;
		if (view !== "Calendar") {
			await page.locator(".bases-toolbar-views-menu:visible").click();
			await page.getByText(`${view} Batch`, { exact: true }).last().click();
		}
		const card = (name: string) => view === "Calendar" ? event(page, name) :
			page.locator(`.task-card[data-task-path="${folder}/${name}.md"]:visible`).first();
		const modifier = "Control";
		await card("Alpha").click({ modifiers: [modifier] });
		await card("Bravo").click({ modifiers: [modifier] });
		await picker(page, card("Alpha"), "Scheduled date");
		await page.keyboard.press("Escape");
		expect((await taskDates(page, "Alpha")).scheduled).toBe(`${days[0]}T09:00`);
		expect(await selected(page)).toHaveLength(2);
		const modal = await picker(page, card("Alpha"), "Due date");
		await modal.locator(".date-time-picker-modal__date-input").fill("2031-09-23");
		await modal.locator(".date-time-picker-modal__time-input").fill("15:45");
		await modal.getByRole("button", { name: "Select", exact: true }).click();
		await expect.poll(async () => (await taskDates(page, "Bravo")).due).toBe("2031-09-23T15:45");
		expect((await taskDates(page, "Alpha")).due).toBe("2031-09-23T15:45");
		expect((await taskDates(page, "Charlie")).due).toBe(days[2]);
	});
}
