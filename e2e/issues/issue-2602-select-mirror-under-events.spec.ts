/**
 * Issue #2602: drag-selecting a time range over an existing timeblock drew the
 * selection (and its "07:15 – 08:45" label) underneath the timeblock, so the
 * label could not be read. The selection must paint above timed items, and an
 * event being dragged over another must stay on top too.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2602
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport } from '../obsidian';

const BASE = 'TaskNotes/Views/issue-2602.base';

// Selections and drag mirrors ignore pointer events, which elementFromPoint honours; let the
// probe hit them for one call so it reports paint order.
const topmostMatches = (page: Page, x: number, y: number, selector: string) =>
	page.evaluate(({ x, y, selector }) => {
		const style = document.head.appendChild(document.createElement('style'));
		style.textContent = '.tnc .tnc-sel-layer, .tnc .tnc-sel, .tnc .tnc-item { pointer-events: auto !important; }';
		try {
			return !!document.elementFromPoint(x, y)?.closest(selector);
		} finally {
			style.remove();
		}
	}, { x, y, selector });

test('drag selection and dragged events paint above existing timed items', async ({}, testInfo) => {
	const app = await launchObsidian();
	const page = app.page;
	await setObsidianViewport(page, { width: 1400, height: 900 });
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
			const text = `---\ntimeblocks:\n  - id: tb-2602-a\n    title: Deep work\n    startTime: "08:00"\n    endTime: "09:00"\n  - id: tb-2602-b\n    title: Review\n    startTime: "10:00"\n    endTime: "11:00"\n---\n`;
			const existing = w.app.vault.getAbstractFileByPath(note);
			if (existing) await w.app.vault.modify(existing, text);
			else await w.app.vault.create(note, text);
			await w.app.vault.create(base, `filters:\n  and:\n    - file.path == "${note}"\nviews:\n  - type: tasknotesCalendar\n    name: Day\n    calendarView: timeGridDay\n    showTimeblocks: true\n    scrollTime: 07:00:00\n`);
			await w.app.workspace.getLeaf('tab').openFile(w.app.vault.getAbstractFileByPath(base));
		}, { note, base: BASE });
		const first = page.locator('.tnc:visible .tnc-item--timed[data-event-type="timeblock"]', { hasText: 'Deep work' });
		const second = page.locator('.tnc:visible .tnc-item--timed[data-event-type="timeblock"]', { hasText: 'Review' });
		await expect(first).toBeVisible();
		await expect(second).toBeVisible();
		await page.locator('.tnc:visible .tnc-tg').evaluate(async (grid) => {
			await Promise.all(grid.getAnimations()
				.filter((animation) => animation instanceof CSSAnimation && animation.animationName === 'tn-calendar-view-enter')
				.map((animation) => animation.finished.catch(() => {})));
		});

		// Select upwards from the empty slot below the 08:00–09:00 timeblock into it, so the
		// selection's time label lies over the timeblock.
		const block = (await first.boundingBox())!;
		const hour = block.height;
		const x = block.x + block.width / 2;
		const start = block.y + hour * 1.6;
		await page.mouse.move(x, start);
		await page.mouse.down();
		await page.mouse.move(x, block.y + hour * 0.3, { steps: 12 });
		const mirror = page.locator('.tnc:visible .tnc-sel--mirror');
		await expect(mirror).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath('select-over-timeblock.png') });
		const label = (await mirror.boundingBox())!;
		expect(label.y).toBeGreaterThanOrEqual(block.y - 1);
		expect(label.y).toBeLessThan(block.y + block.height);
		expect(await topmostMatches(page, label.x + 10, label.y + 8, '.tnc-sel--mirror')).toBe(true);
		// Opaque, so the timeblock's own text does not show through the label.
		expect(await mirror.evaluate((el) => {
			const probe = document.createElement('canvas').getContext('2d')!;
			probe.fillStyle = getComputedStyle(el).backgroundColor;
			probe.fillRect(0, 0, 1, 1);
			return probe.getImageData(0, 0, 1, 1).data[3];
		})).toBe(255);
		await page.mouse.move(x, start, { steps: 12 });
		await page.mouse.up();
		await page.keyboard.press('Escape');
		await expect(mirror).toHaveCount(0);

		// Drag the 08:00 timeblock over the 10:00 one, then back before release.
		const target = (await second.boundingBox())!;
		const grab = { x, y: block.y + hour / 2 };
		await page.mouse.move(grab.x, grab.y);
		await page.mouse.down();
		await page.mouse.move(grab.x, target.y + target.height / 2, { steps: 15 });
		const dragged = page.locator('.tnc:visible .tnc-item--timed:is(.is-dragging, .is-mirror)').first();
		await expect(dragged).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath('drag-over-timeblock.png') });
		const dragBox = (await dragged.boundingBox())!;
		expect(await topmostMatches(page, dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2,
			'.tnc-item:is(.is-dragging, .is-mirror)')).toBe(true);
		await page.mouse.move(grab.x, grab.y, { steps: 15 });
		await page.mouse.up();
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
