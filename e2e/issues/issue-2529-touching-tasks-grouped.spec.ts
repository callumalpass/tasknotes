/**
 * Issue #2529: back-to-back tasks (11:00–11:30, 11:30–12:00) were laid out as
 * overlapping when a 30-minute block drew shorter than the minimum event height,
 * so narrow columns grouped them. @tasknotes/calendar 0.1.11 keeps touching
 * items in one column.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2529
 */
import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../obsidian';

const TASKS = ['Issue 2529 A.md', 'Issue 2529 B.md'];
const BASE = 'TaskNotes/Views/issue-2529.base';

test('touching tasks stay full width at a compact slot height', async () => {
	const app = await launchObsidian();
	const page = app.page;
	try {
		await page.evaluate(async ({ tasks, base }) => {
			const w = window as any;
			const d = new Date();
			const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			for (const [i, path] of tasks.entries()) {
				await w.app.vault.create(path, `---\ntitle: ${path.replace(/\.md$/, '')}\nstatus: open\npriority: normal\nscheduled: ${day}T${i ? '11:30' : '11:00'}\ntimeEstimate: 30\ntags:\n  - task\n---\n`);
			}
			// 8px per 30-minute slot draws a 30-minute task shorter than the 15px minimum height.
			await w.app.vault.create(base, 'filters:\n  and:\n    - file.name.startsWith("Issue 2529 ")\nviews:\n  - type: tasknotesCalendar\n    name: Day\n    calendarView: timeGridDay\n    slotDuration: "00:30:00"\n    slotHeight: 8\n    scrollTime: 10:00:00\n    showTimeblocks: false\n');
			await w.app.workspace.getLeaf('tab').openFile(w.app.vault.getAbstractFileByPath(base));
		}, { tasks: TASKS, base: BASE });
		const boxes = [];
		for (const title of ['Issue 2529 A', 'Issue 2529 B']) {
			const item = page.locator('.tnc:visible .tnc-item--timed', { hasText: title }).first();
			await expect(item).toBeVisible();
			boxes.push((await item.boundingBox())!);
		}
		await expect(page.locator('.tnc:visible .tnc-more--stack')).toHaveCount(0);
		expect(boxes[1].x).toBeCloseTo(boxes[0].x, 0);
		expect(boxes[1].width).toBeCloseTo(boxes[0].width, 0);
		expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height - 0.5);
	} finally {
		try {
			await page.evaluate(async (paths) => {
				const v = (window as any).app.vault;
				for (const path of paths) {
					const file = v.getAbstractFileByPath(path);
					if (file) await v.delete(file);
				}
			}, [...TASKS, BASE]);
		} finally {
			await closeObsidian(app);
		}
	}
});
