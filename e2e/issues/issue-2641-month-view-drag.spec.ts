/**
 * Issue #2641: in the calendar's Month view, dragging a task started a date
 * selection (and opened the create menu) instead of moving the task. At
 * calendar widths up to 850px Month draws tasks as compact chips, which ignored
 * the pointer, so the press reached the day cell underneath.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2641
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport } from '../obsidian';

const BASE = 'TaskNotes/Views/issue-2641.base';
const TASKS = [
	{ path: 'TaskNotes/Issue 2641 all day.md', title: 'Issue 2641 all day', time: '' },
	{ path: 'TaskNotes/Issue 2641 timed.md', title: 'Issue 2641 timed', time: 'T09:00' },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function readScheduled(page: Page, path: string): Promise<string | undefined> {
	return page.evaluate(async (p) => {
		const w = window as any;
		const text: string = await w.app.vault.read(w.app.vault.getAbstractFileByPath(p));
		return text.match(/^scheduled:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
	}, path);
}

test('month view drags move tasks instead of selecting days', async ({}, testInfo) => {
	const app = await launchObsidian();
	const page = app.page;
	await setObsidianViewport(page, { width: 1150, height: 900 });
	const now = new Date();
	const from = new Date(now.getFullYear(), now.getMonth(), 15);
	const to = new Date(now.getFullYear(), now.getMonth(), 16);
	try {
		await page.evaluate(async ({ tasks, base, day }) => {
			const w = window as any;
			for (const task of tasks) {
				const text = `---\ntitle: ${task.title}\nstatus: open\nscheduled: ${day}${task.time}\ntags:\n  - task\n---\n`;
				const existing = w.app.vault.getAbstractFileByPath(task.path);
				if (existing) await w.app.vault.modify(existing, text);
				else await w.app.vault.create(task.path, text);
			}
			// The reporter's view: a stale `calendarView` inside `options` and the real one at the top level.
			const baseText = [
				'filters:',
				'  and:',
				'    - file.name.startsWith("Issue 2641")',
				'views:',
				'  - type: tasknotesCalendar',
				'    name: Calendar',
				'    options:',
				'      showScheduled: true',
				'      showDue: true',
				'      calendarView: timeGridWeek',
				'    calendarView: dayGridMonth',
				'',
			].join('\n');
			const existing = w.app.vault.getAbstractFileByPath(base);
			if (existing) await w.app.vault.modify(existing, baseText);
			else await w.app.vault.create(base, baseText);
			await w.app.workspace.getLeaf('tab').openFile(w.app.vault.getAbstractFileByPath(base));
		}, { tasks: TASKS, base: BASE, day: ymd(from) });

		const root = page.locator('.tnc:visible').first();
		// Narrow enough for the compact chip layout the reporter saw.
		await expect(root.locator('.tnc-dg.tnc-dg--chips')).toBeVisible();

		for (const task of TASKS) {
			const item = root.locator('.tnc-item', { hasText: task.title }).first();
			await expect(item).toBeVisible();
			const box = (await item.boundingBox())!;
			const target = (await root.locator(`.tnc-dg-day[data-date="${ymd(to)}"]`).boundingBox())!;
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.down();
			await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
			await page.screenshot({ path: testInfo.outputPath(`${task.time ? 'timed' : 'allday'}-dragging.png`) });
			expect(await root.evaluate(el => el.classList.contains('tnc-dragging-select') || !!el.querySelector('.tnc-sel'))).toBe(false);
			await page.mouse.up();
			await expect(page.locator('.menu')).toHaveCount(0);
			await expect.poll(() => readScheduled(page, task.path)).toBe(`${ymd(to)}${task.time}`);
		}
	} finally {
		try {
			await page.keyboard.press('Escape');
			await page.evaluate(async ({ tasks, base }) => {
				const w = window as any;
				for (const p of [base, ...tasks.map((t: { path: string }) => t.path)]) {
					const f = w.app.vault.getAbstractFileByPath(p);
					if (f) await w.app.vault.delete(f);
				}
			}, { tasks: TASKS, base: BASE });
		} finally {
			await closeObsidian(app);
		}
	}
});
