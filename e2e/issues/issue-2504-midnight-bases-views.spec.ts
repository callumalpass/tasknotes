import { test, expect, type Page } from "@playwright/test";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Midnight ${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = localDate();
const tomorrow = localDate(1);

const leafByName = (name: string) =>
	page.locator(".workspace-leaf").filter({
		has: page.locator(`.view-header-title:text-is("${name}")`),
	});
const dueLabel = (name: string) =>
	leafByName(name)
		.locator('[data-task-path$="Tomorrow.md"] .task-card__metadata-property--due')
		.first();
const listDays = (name: string) =>
	leafByName(name)
		.locator(".tnc-list-day")
		.evaluateAll((days) => days.map((day) => (day as HTMLElement).dataset.date));
const miniToday = (name: string) =>
	leafByName(name)
		.locator(".mini-calendar-view__day--today")
		.evaluate((day) => (day as HTMLElement).dataset.date ?? day.getAttribute("aria-label"));
const dateChangedListeners = () =>
	page.evaluate(
		() => (window as any).app.plugins.plugins.tasknotes.emitter._["date-changed"]?.length ?? 0
	);

/** Shifts the renderer's clock a day ahead and waits for the plugin's own detector to notice. */
async function crossMidnight(): Promise<void> {
	await page.evaluate(() => {
		const win = window as any;
		const Real = Date;
		class Shifted extends Real {
			constructor(...args: unknown[]) {
				if (args.length) super(...(args as []));
				else super(Real.now() + 86400000);
			}
			static now(): number {
				return Real.now() + 86400000;
			}
		}
		win.RealDate = Real;
		win.Date = Shifted;
		const emitter = win.app.plugins.plugins.tasknotes.emitter;
		const ref = emitter.on("date-changed", () => {
			win.dateChangedSeen = true;
			emitter.offref(ref);
		});
	});
	await page.waitForFunction(() => (window as any).dateChangedSeen === true, undefined, {
		timeout: 70000,
	});
}

test.afterAll(async () => {
	if (page && !page.isClosed()) {
		await page
			.evaluate(async (folder) => {
				const win = window as any;
				if (win.RealDate) win.Date = win.RealDate;
				for (const leaf of win.app.workspace.getLeavesOfType("bases")) leaf.detach();
				const fixture = win.app.vault.getAbstractFileByPath(folder);
				if (fixture) await win.app.vault.delete(fixture, true);
			}, folder)
			.catch(() => undefined);
	}
	if (instance) await closeObsidian(instance);
});

test("open Bases views follow the date across midnight without redrawing while hidden", async () => {
	test.setTimeout(180000);
	instance = await launchObsidian();
	page = instance.page;

	const listenersBefore = await dateChangedListeners();
	await page.evaluate(
		async ({ folder, today, tomorrow, nextWeekPlus }) => {
			const app = (window as any).app;
			await app.vault.createFolder(folder);
			app.workspace.leftSplit.collapse();
			app.workspace.rightSplit.collapse();
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const task = (name: string, due: string) =>
				app.vault.create(
					`${folder}/${name}.md`,
					`---\ntags: [task]\ntitle: ${name}\nstatus: open\npriority: normal\ndue: ${due}\n---\n`
				);
			await task("Tomorrow", `${tomorrow}T17:25`);
			await task("Today", today);
			await task("Later", nextWeekPlus);
			const filters = `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\n`;
			const list = `views:\n  - type: tasknotesTaskList\n    name: List\n    order: [note.status, note.due]\n`;
			const calendar = `views:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: listWeek\n    listDayCount: 7\n    showDue: true\n    showOverdueOnToday: true\n`;
			await app.vault.create(`${folder}/Hidden.base`, filters + list);
			await app.vault.create(`${folder}/List.base`, filters + list);
			await app.vault.create(
				`${folder}/Board.base`,
				`${filters}views:\n  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: note.status\n      direction: ASC\n    order: [note.status, note.due]\n`
			);
			await app.vault.create(`${folder}/Calendar.base`, filters + calendar);
			await app.vault.create(
				`${folder}/Mini.base`,
				`${filters}views:\n  - type: tasknotesMiniCalendar\n    name: Mini\n`
			);
			await app.vault.create(`${folder}/Paged.base`, filters + calendar);
			const open = (name: string, leaf: unknown) =>
				(leaf as any).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
			await open("Hidden", app.workspace.getLeaf("tab"));
		},
		{ folder, today, tomorrow, nextWeekPlus: localDate(8) }
	);
	// Obsidian defers a tab it never showed, so Hidden has to draw before it is covered.
	await expect(dueLabel("Hidden")).toHaveText(/Nov|Dec|Jan|\d/);
	await page.evaluate(async (folder) => {
		const app = (window as any).app;
		const open = (name: string, leaf: unknown) =>
			(leaf as any).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
		await open("List", app.workspace.getLeaf("tab"));
		await open("Board", app.workspace.getLeaf("split", "vertical"));
		await open("Calendar", app.workspace.getLeaf("split", "vertical"));
		await open("Mini", app.workspace.getLeaf("split", "vertical"));
		await open("Paged", app.workspace.getLeaf("split", "vertical"));
	}, folder);

	await expect(dueLabel("List")).toBeVisible();
	await expect(dueLabel("Board")).toBeVisible();
	await expect.poll(() => listDays("Calendar")).toContain(today);
	expect((await listDays("Calendar"))[0]).toBe(today);

	await leafByName("Paged").locator(".tnc-btn-next").click();
	await expect.poll(() => listDays("Paged")).toEqual([localDate(8)]);

	const miniBefore = await miniToday("Mini");

	const hiddenLabel = await dueLabel("Hidden").elementHandle();
	await expect(dueLabel("Hidden")).toBeHidden();
	const hiddenText = await hiddenLabel!.textContent();

	await crossMidnight();

	// List and Kanban relabel their cards.
	await expect(dueLabel("List")).toHaveText(/Today at/);
	await expect(dueLabel("List")).toHaveClass(/task-card__metadata-date--today/);
	await expect(dueLabel("List")).not.toHaveClass(/--future/);
	await expect(dueLabel("Board")).toHaveText(/Today at/);
	await expect(dueLabel("Board")).toHaveClass(/task-card__metadata-date--today/);

	// A calendar on the old day moves, carrying yesterday's now-overdue task to the new day.
	await expect.poll(() => listDays("Calendar")).toEqual([tomorrow]);
	await expect(leafByName("Calendar").locator(".tnc-list-day.is-today")).toHaveCount(1);
	await expect(
		leafByName("Calendar").locator('[data-task-path$="Today.md"]').first()
	).toBeVisible();

	// The mini calendar marks the new day.
	await expect.poll(() => miniToday("Mini")).not.toBe(miniBefore);

	// A calendar paged elsewhere stays where it is.
	expect(await listDays("Paged")).toEqual([localDate(8)]);

	// The covered tab stays put until it is shown, then catches up.
	expect(await hiddenLabel!.evaluate((el) => el.isConnected)).toBe(true);
	expect(await hiddenLabel!.textContent()).toBe(hiddenText);
	await page.evaluate(() => {
		const app = (window as any).app;
		const leaf = app.workspace
			.getLeavesOfType("bases")
			.find((candidate: any) => candidate.view.file?.basename === "Hidden");
		app.workspace.setActiveLeaf(leaf, { focus: true });
	});
	await expect(dueLabel("Hidden")).toHaveText(/Today at/);

	// Closing the views removes their listeners.
	await page.evaluate(() => {
		for (const leaf of (window as any).app.workspace.getLeavesOfType("bases")) leaf.detach();
	});
	await expect.poll(dateChangedListeners).toBe(listenersBefore);
});
