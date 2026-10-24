import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from './obsidian';

// Saved Bases calendar settings keep applying, and drag/resize write back to
// the task, now that the view renders with @tasknotes/calendar.

let app: ObsidianApp;
test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

const BASE_PATH = 'TaskNotes/Views/e2e-calendar-engine.base';
const TASK_PATH = 'TaskNotes/E2E calendar engine task.md';

function baseFile(view: string): string {
	return `filters:
  and:
    - note.status && note.status != ""
views:
  - type: tasknotesCalendar
    name: Engine
${view}`;
}

async function openBase(page: Page, content: string): Promise<void> {
	await page.evaluate(async ([path, text]) => {
		const w = window as any;
		const existing = w.app.vault.getAbstractFileByPath(path);
		if (existing) await w.app.vault.modify(existing, text);
		else await w.app.vault.create(path, text);
		await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(path));
	}, [BASE_PATH, content]);
	await expect(page.locator('.tnc:visible').first()).toBeVisible({ timeout: 15000 });
}

async function removeFile(page: Page, path: string): Promise<void> {
	await page.evaluate(async (p) => {
		const w = window as any;
		const f = w.app.vault.getAbstractFileByPath(p);
		if (f) await w.app.vault.delete(f);
	}, path);
}

async function frontmatter(page: Page): Promise<Record<string, unknown>> {
	return page.evaluate((p) => {
		const w = window as any;
		return w.app.metadataCache.getFileCache(w.app.vault.getAbstractFileByPath(p))?.frontmatter ?? {};
	}, TASK_PATH);
}

test.afterEach(async () => {
	await app.page.evaluate(() => (window as any).app.workspace.getLeaf()?.detach());
	await removeFile(app.page, BASE_PATH);
	await removeFile(app.page, TASK_PATH);
});

test('time grid settings from the .base file apply', async () => {
	const page = app.page;
	await openBase(page, baseFile(`    calendarView: timeGridCustom
    customDayCount: 5
    timeFormat: "12"
    weekNumbers: true
    slotMinTime: 07:00:00
    slotMaxTime: 19:00:00
    showAllDaySlot: false
    todayColumnWidthMultiplier: 2
`));
	const cal = page.locator('.tnc:visible').first();
	const heads = cal.locator('.tnc-tg-head .tnc-dh');
	await expect(heads).toHaveCount(5);
	await expect(cal.locator('.tnc-tg-allday')).toHaveCount(0);
	await expect(cal.locator('.tnc-tg')).toContainText(/\d(am|pm)/);
	await expect(cal.locator('.tnc-tg-head .tnc-gutter-head')).toHaveText(/W\d+/);
	const widths = await heads.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
	expect(widths[0]).toBeGreaterThan(widths[1] * 1.5);
});

test('month settings from the .base file apply', async () => {
	const page = app.page;
	await openBase(page, baseFile(`    calendarView: dayGridMonth
    firstDay: 3
    showWeekends: false
    weekNumbers: true
`));
	const cal = page.locator('.tnc:visible').first();
	const days = await cal.locator('.tnc-dg-dow').allTextContents();
	expect(days.map((d) => d.trim().slice(0, 3).toUpperCase())).toEqual(['WED', 'THU', 'FRI', 'MON', 'TUE']);
	await expect(cal.locator('.tnc-weeknum').first()).toBeVisible();
});

test('dragging and resizing a task writes back to its frontmatter', async () => {
	const page = app.page;
	const today = await page.evaluate(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});
	const tomorrow = await page.evaluate(() => {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});
	await page.evaluate(async ([path, day]) => {
		await (window as any).app.vault.create(
			path,
			`---\ntitle: E2E calendar engine task\nstatus: open\npriority: normal\nscheduled: ${day}T10:00\ntimeEstimate: 60\ntags:\n  - task\n---\n`
		);
	}, [TASK_PATH, today]);
	// Custom days start today, so the next column is always tomorrow.
	await openBase(page, baseFile(`    calendarView: timeGridCustom
    customDayCount: 3
    slotDuration: 00:30:00
    scrollTime: 09:00:00
`));
	const cal = page.locator('.tnc:visible').first();
	const item = cal.locator('.tnc-item', { hasText: 'E2E calendar engine task' }).first();
	await expect(item).toBeVisible({ timeout: 10000 });
	const cols = cal.locator('.tnc-tg .tnc-col');
	const [c0, c1] = [(await cols.nth(0).boundingBox())!, (await cols.nth(1).boundingBox())!];

	let box = (await item.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 10);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + (c1.x - c0.x) / 2, box.y + 10 + box.height / 2, { steps: 5 });
	await page.mouse.move(box.x + box.width / 2 + (c1.x - c0.x), box.y + 10 + box.height, { steps: 5 });
	await page.mouse.up();
	await expect.poll(async () => (await frontmatter(page)).scheduled).toBe(`${tomorrow}T11:00`);

	box = (await item.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height * 2 - 3, { steps: 8 });
	await page.mouse.up();
	await expect.poll(async () => (await frontmatter(page)).timeEstimate).toBe(120);
});
