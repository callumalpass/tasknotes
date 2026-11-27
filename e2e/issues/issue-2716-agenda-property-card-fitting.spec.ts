/**
 * Issue #2716: an Agenda froze Obsidian for 12-16 s on every redraw when it showed
 * property-based event cards (notes placed by `startDateProperty`, not tasks).
 *
 * Each card fitted its properties behind a "+N" count by hiding one property at a time and
 * measuring after each change, and it did this even when "Show all properties on task cards"
 * was on. Every measurement made the browser lay the whole list out again, because the list's
 * scroller took its size from its content. The fit then ran a second time when its own changes
 * resized the card.
 *
 * Now property cards follow "Show all properties", a fit measures a fixed few times, a fit does
 * not run again for the sizes it left, and the fill-mode scroller has size containment.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2716
 */

import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, ObsidianApp } from "../obsidian";

const FOLDER = "Issue 2716 notes";
const BASE = "Issue 2716 agenda.base";
const NOTES = Array.from({ length: 24 }, (_, i) => `${FOLDER}/Meeting ${i}.md`);
const BASE_SOURCE = `filters:
  and:
    - file.inFolder("${FOLDER}")
views:
  - type: tasknotesCalendar
    name: Agenda
    order:
      - status
      - priority
      - date_due
      - projects
      - contexts
      - file.tags
      - file.name
    calendarView: listWeek
    startDateProperty: file.ctime
    listDayCount: 7
    titleProperty: file.basename
`;

let app: ObsidianApp;

test.beforeAll(async () => {
	app = await launchObsidian();
});

test.afterAll(async () => {
	if (app) await closeObsidian(app);
});

async function openAgenda(wrap: boolean) {
	await app.page.evaluate(
		async ({ base, wrap }) => {
			const w = window as any;
			const plugin = w.app.plugins.plugins.tasknotes;
			plugin.settings.wrapTaskCardProperties = wrap;
			await plugin.saveSettings();
			for (const leaf of w.app.workspace.getLeavesOfType("bases")) {
				if (leaf.view?.file?.path === base) leaf.detach();
			}
			w.app.workspace.rightSplit.expand();
			if (w.app.workspace.rightSplit.setSize) w.app.workspace.rightSplit.setSize(250);
			const leaf = w.app.workspace.getRightLeaf(true);
			// Count the fitting's reads of each card's metadata line and its values lane.
			const proto = Element.prototype as any;
			w.__issue2716Original ??= proto.getBoundingClientRect;
			w.__issue2716Reads = new Map();
			proto.getBoundingClientRect = function () {
				if (this.classList?.contains("task-card__metadata") || this.classList?.contains("task-card__metadata-values")) {
					const line = this.closest(".task-card__metadata");
					w.__issue2716Reads.set(line, (w.__issue2716Reads.get(line) ?? 0) + 1);
				}
				return w.__issue2716Original.call(this);
			};
			await leaf.openFile(w.app.vault.getAbstractFileByPath(base));
			await w.app.workspace.revealLeaf(leaf);
		},
		{ base: BASE, wrap }
	);
	const agenda = app.page.locator(".mod-right-split .advanced-calendar-view");
	await expect(agenda.locator(".task-card--property-event")).toHaveCount(NOTES.length, { timeout: 20_000 });
	// Let the resize observers deliver.
	await app.page.waitForTimeout(1500);
	return agenda;
}

async function readsPerCard(): Promise<number[]> {
	return app.page.evaluate(() => {
		const w = window as any;
		Element.prototype.getBoundingClientRect = w.__issue2716Original;
		return Array.from(w.__issue2716Reads.values() as Iterable<number>);
	});
}

test("Agenda property cards fit their properties without re-laying out the list for each one (#2716)", async () => {
	const page = app.page;
	await page.evaluate(
		async ({ folder, notes, base, source }) => {
			const vault = (window as any).app.vault;
			for (const p of [...notes, base]) {
				const existing = vault.getAbstractFileByPath(p);
				if (existing) await vault.delete(existing);
			}
			if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
			const today = (window as any).moment().format("YYYY-MM-DD");
			for (const [i, note] of notes.entries()) {
				await vault.create(
					note,
					`---\nstatus: open\npriority: normal\ndate_due: ${today}\nprojects:\n  - "[[Alpha ${i}]]"\n  - "[[Beta ${i}]]"\ncontexts:\n  - "@office"\n  - "@calls"\ntags:\n  - meeting\n  - followup\n  - review${i}\n---\n`
				);
			}
			await vault.create(base, source);
		},
		{ folder: FOLDER, notes: NOTES, base: BASE, source: BASE_SOURCE }
	);

	try {
		// Fitting behind +N.
		let agenda = await openAgenda(false);
		const scroller = agenda.locator(".tnc--height-fill > .tnc-view > .tnc-list > .tnc-list-scroll");
		expect(await scroller.evaluate((el) => getComputedStyle(el).contain)).toBe("size");
		expect(await scroller.evaluate((el) => el.clientHeight)).toBeGreaterThan(100);
		const overflow = agenda.locator(".task-card--property-event .task-card__metadata-overflow:not([hidden])");
		await expect(overflow.first()).toHaveText(/^\+\d+$/);
		const card = agenda.locator(".task-card--property-event").first();
		const hidden = await card.locator(".task-card__metadata-values [hidden]:not(.task-card__metadata-chips)").count();
		const shownCount = Number((await card.locator(".task-card__metadata-overflow").textContent())?.slice(1));
		expect(shownCount).toBeGreaterThan(0);
		expect(hidden).toBeGreaterThanOrEqual(shownCount);
		// Before the fix a card read its lane once per property checked, for every property it
		// tried, and did it all again when its own changes resized it: over 80 reads here. A fit
		// now takes about 7, and a real resize of the pane while the view opens adds another fit.
		const reads = await readsPerCard();
		expect(reads.length).toBeGreaterThan(0);
		expect(Math.max(...reads)).toBeLessThanOrEqual(30);

		// "Show all properties on task cards": nothing is hidden behind +N.
		agenda = await openAgenda(true);
		await expect(agenda.locator(".task-card--property-event .task-card__metadata--wrap")).toHaveCount(NOTES.length);
		await expect(agenda.locator(".task-card--property-event .task-card__metadata-overflow:not([hidden])")).toHaveCount(0);
		expect(await readsPerCard()).toEqual([]);
	} finally {
		await page.evaluate(
			async ({ folder, notes, base }) => {
				const w = window as any;
				if (w.__issue2716Original) Element.prototype.getBoundingClientRect = w.__issue2716Original;
				const plugin = w.app.plugins.plugins.tasknotes;
				plugin.settings.wrapTaskCardProperties = true;
				await plugin.saveSettings();
				for (const leaf of w.app.workspace.getLeavesOfType("bases")) {
					if (leaf.view?.file?.path === base) leaf.detach();
				}
				for (const p of [...notes, base, folder]) {
					const file = w.app.vault.getAbstractFileByPath(p);
					if (file) await w.app.vault.delete(file, true);
				}
			},
			{ folder: FOLDER, notes: NOTES, base: BASE }
		);
	}
});
