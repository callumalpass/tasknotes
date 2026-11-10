/**
 * Issue #2528: hour-long timeblocks in a week view lost their time range. The
 * calendar hid the time label on any timed item up to ~50px tall in a column
 * narrower than 240px; @tasknotes/calendar 0.1.11 keeps it on stacked items.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2528
 */
import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../obsidian';

const BASE = 'TaskNotes/Views/issue-2528.base';

test('hour-long timeblocks show their time range in week view', async () => {
	const app = await launchObsidian();
	const page = app.page;
	const note = await page.evaluate(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`;
	});
	const original = await page.evaluate(async (path) => {
		const w = window as any;
		const file = w.app.vault.getAbstractFileByPath(path);
		return {
			note: file ? await w.app.vault.read(file) : null,
			timeblocking: w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking,
		};
	}, note);
	try {
		await page.evaluate(async ({ note, base }) => {
			const w = window as any;
			w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking = true;
			const text = `---\ntimeblocks:\n  - id: tb-2528-gym\n    title: Gym Workout\n    startTime: "08:00"\n    endTime: "09:00"\n  - id: tb-2528-exercise\n    title: Exercise (Chest, Shoulders, and Triceps)\n    startTime: "17:00"\n    endTime: "18:00"\n---\n`;
			const existing = w.app.vault.getAbstractFileByPath(note);
			if (existing) await w.app.vault.modify(existing, text);
			else await w.app.vault.create(note, text);
			await w.app.vault.create(base, `filters:\n  and:\n    - file.path == "${note}"\nviews:\n  - type: tasknotesCalendar\n    name: Week\n    calendarView: timeGridWeek\n    showTimeblocks: true\n    scrollTime: 07:00:00\n`);
			await w.app.workspace.getLeaf('tab').openFile(w.app.vault.getAbstractFileByPath(base));
		}, { note, base: BASE });
		for (const [title, range] of [['Gym Workout', '08:00 – 09:00'], ['Exercise', '17:00 – 18:00']]) {
			const item = page.locator('.tnc:visible .tnc-item--timed[data-event-type="timeblock"]', { hasText: title }).first();
			const time = item.locator('.tnc-item-time');
			await expect(time).toBeVisible();
			await expect(time).toHaveText(range);
			const [timeBox, itemBox] = await Promise.all([time.boundingBox(), item.boundingBox()]);
			expect(itemBox!.width).toBeLessThan(240);
			expect(timeBox!.y + timeBox!.height).toBeLessThanOrEqual(itemBox!.y + itemBox!.height + 0.5);
		}
	} finally {
		try {
			await page.evaluate(async ({ note, base, original }) => {
				const w = window as any;
				w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking = original.timeblocking;
				const baseFile = w.app.vault.getAbstractFileByPath(base);
				if (baseFile) await w.app.vault.delete(baseFile);
				const file = w.app.vault.getAbstractFileByPath(note);
				if (original.note === null) { if (file) await w.app.vault.delete(file); }
				else await w.app.vault.modify(file, original.note);
			}, { note, base: BASE, original });
		} finally {
			await closeObsidian(app);
		}
	}
});
