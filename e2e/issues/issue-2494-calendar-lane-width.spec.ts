import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

/**
 * Time entries sit in a narrow strip on the right of a time-grid column only
 * where they overlap a planned item. Since 4.15, one time entry on a day used to
 * squeeze every item that day into lanes, even when nothing overlapped.
 */

let app: ObsidianApp;
const BASE_PATH = 'TaskNotes/Views/e2e-issue-2494.base';
const TASK_PATHS = ['TaskNotes/Tasks/e2e-2494-planned.md', 'TaskNotes/Tasks/e2e-2494-alone.md'];

async function createTasks(page: Page): Promise<void> {
	await page.evaluate(async (paths) => {
		const w = window as any;
		const d = new Date();
		const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const at = (h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
		const notes = [
			// A planned hour with tracked time overlapping it, then tracked time on its own.
			`---\ntitle: Planned 2494\nstatus: open\nscheduled: ${day}T09:00\ntimeEstimate: 60\ntags:\n  - task\ntimeEntries:\n  - startTime: ${at(9, 30)}\n    endTime: ${at(10, 0)}\n  - startTime: ${at(14, 0)}\n    endTime: ${at(14, 30)}\n---\n`,
			`---\ntitle: Alone 2494\nstatus: open\nscheduled: ${day}T16:00\ntimeEstimate: 60\ntags:\n  - task\n---\n`,
		];
		for (const [i, path] of paths.entries()) {
			const existing = w.app.vault.getAbstractFileByPath(path);
			if (existing) await w.app.vault.modify(existing, notes[i]);
			else await w.app.vault.create(path, notes[i]);
		}
	}, TASK_PATHS);
}

async function openDayCalendar(page: Page): Promise<void> {
	await page.evaluate(async (path) => {
		const w = window as any;
		const text = `filters:
  and:
    - file.name.startsWith("e2e-2494")
views:
  - type: tasknotesCalendar
    name: Lanes
    calendarView: timeGridDay
    showScheduled: true
    showTimeEntries: true
    scrollTime: 08:00:00
`;
		const existing = w.app.vault.getAbstractFileByPath(path);
		if (existing) await w.app.vault.modify(existing, text);
		else await w.app.vault.create(path, text);
		await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(path));
	}, BASE_PATH);
	await expect(page.locator('.tnc:visible').first()).toBeVisible({ timeout: 15000 });
}

/** Item widths as a share of the day column, keyed by start time label. */
async function widths(page: Page): Promise<{ plan: number[]; actual: number[] }> {
	return page.evaluate(() => {
		const col = document.querySelector<HTMLElement>('.tnc:not([hidden]) .tnc-col')!;
		const colWidth = col.getBoundingClientRect().width;
		const share = (sel: string) =>
			[...col.querySelectorAll<HTMLElement>(sel)]
				.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
				.map((el) => Math.round((el.getBoundingClientRect().width / colWidth) * 100) / 100);
		return { plan: share('.tnc-col-plan > .tnc-item'), actual: share('.tnc-col-actual > .tnc-item') };
	});
}

test.beforeAll(async () => {
	app = await launchObsidian();
	await createTasks(app.page);
});

test.afterAll(async () => {
	if (!app) return;
	try {
		await app.page.evaluate(async (paths) => {
			const w = window as any;
			for (const p of paths) {
				const f = w.app.vault.getAbstractFileByPath(p);
				if (f) await w.app.vault.delete(f);
			}
		}, [BASE_PATH, ...TASK_PATHS]);
	} finally {
		await closeObsidian(app);
	}
});

test('time entries narrow only the items they overlap', async ({}, testInfo) => {
	const page = app.page;
	await openDayCalendar(page);
	await expect(page.locator('.tnc:visible .tnc-col-actual > .tnc-item')).toHaveCount(2, { timeout: 10000 });
	await expect(page.locator('.tnc:visible .tnc-col-plan > .tnc-item')).toHaveCount(2);
	await page.screenshot({ path: testInfo.outputPath('day.png') });

	const { plan, actual } = await widths(page);
	// 09:00 planned hour overlaps the 09:30 entry; the 16:00 task overlaps nothing.
	expect(plan[0]).toBeLessThan(0.85);
	expect(plan[1]).toBeGreaterThan(0.9);
	// 09:30 entry sits in the strip; the 14:00 entry has the column to itself.
	expect(actual[0]).toBeLessThan(0.3);
	expect(actual[1]).toBeGreaterThan(0.9);

	// The actual layer spans the column above the plan layer; it must not take the plan item's clicks.
	const hit = await page.evaluate(() => {
		const items = [...document.querySelectorAll<HTMLElement>('.tnc:not([hidden]) .tnc-col-plan > .tnc-item')];
		const el = items.find((i) => i.textContent?.includes('Alone 2494'))!;
		const r = el.getBoundingClientRect();
		return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
	});
	expect(hit).toBe(true);
});
