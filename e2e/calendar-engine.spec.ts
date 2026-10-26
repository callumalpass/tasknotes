import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from './obsidian';

// Saved Bases calendar settings keep applying, and drag/resize write back to
// the task, now that the view renders with @tasknotes/calendar.

let app: ObsidianApp;
test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

const BASE_PATH = 'TaskNotes/Views/e2e-calendar-engine.base';
const TASK_PATH = 'TaskNotes/E2E calendar engine task.md';
const CHILD_PATH = 'TaskNotes/E2E calendar engine child.md';

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
	await removeFile(app.page, CHILD_PATH);
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

async function recurrenceDates(page: Page): Promise<string[]> {
	return page.evaluate(() => Array.from({ length: 3 }, (_, offset) => {
		const date = new Date();
		date.setDate(date.getDate() + offset);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}));
}

test('pattern gestures preserve multiline rules and the independently scheduled next occurrence', async () => {
	const page = app.page;
	const [today, tomorrow, third] = await recurrenceDates(page);
	const rule = `DTSTART:${today.replace(/-/g, '')}T090000Z\nRRULE:FREQ=DAILY;COUNT=5\nEXDATE:${third.replace(/-/g, '')}T090000Z`;
	await page.evaluate(async ({ path, scheduled, recurrence }) => {
		await (window as any).app.vault.create(path,
			`---\ntitle: E2E calendar engine task\nstatus: open\npriority: normal\ntags: [task]\nscheduled: ${scheduled}\nrecurrence: ${JSON.stringify(recurrence)}\n---\n`);
	}, { path: TASK_PATH, scheduled: `${tomorrow}T11:00`, recurrence: rule });
	await openBase(page, baseFile(`    calendarView: timeGridCustom
    customDayCount: 3
    snapDuration: 00:30:00
    scrollTime: 08:00:00
`));
	const pattern = page.locator('.tnc:visible .fc-pattern-instance-event', { hasText: 'E2E calendar engine task' }).first();
	await expect(pattern).toBeVisible();
	await pattern.focus();
	await page.keyboard.press('Alt+ArrowDown');
	await expect.poll(async () => (await frontmatter(page)).recurrence)
		.toBe(rule.replace('T090000Z\nRRULE', 'T093000Z\nRRULE'));
	expect((await frontmatter(page)).scheduled).toBe(`${tomorrow}T11:00`);
});

test('filtered materialized children suppress virtual parent occurrences', async () => {
	const page = app.page;
	const [today] = await recurrenceDates(page);
	await page.evaluate(async ({ parent, child, day }) => {
		const vault = (window as any).app.vault;
		await vault.create(parent,
			`---\ntitle: E2E calendar engine task\nstatus: open\npriority: normal\ntags: [task]\nscheduled: ${day}T09:00\nrecurrence: FREQ=DAILY\n---\n`);
		await vault.create(child,
			`---\ntitle: E2E excluded child\nstatus: open\npriority: normal\ntags: [task]\nscheduled: ${day}T11:00\nrecurrence_parent: "[[${parent.replace(/\.md$/, '')}]]"\noccurrence_date: ${day}\n---\n`);
	}, { parent: TASK_PATH, child: CHILD_PATH, day: today });
	await openBase(page, baseFile(`    calendarView: timeGridCustom
    customDayCount: 3
    scrollTime: 08:00:00
`).replace('- note.status && note.status != ""', `- file.path == "${TASK_PATH}"`));
	const cal = page.locator('.tnc:visible').first();
	await expect(cal.locator('.fc-pattern-instance-event', { hasText: 'E2E calendar engine task' }).first()).toBeVisible();
	await expect(cal.locator('.fc-next-scheduled-event', { hasText: 'E2E calendar engine task' })).toHaveCount(0);
	await expect(cal.getByText('E2E excluded child')).toHaveCount(0);
	// Deletion outside the Bases query must release the parent's virtual date.
	await removeFile(page, CHILD_PATH);
	await expect(cal.locator('.fc-next-scheduled-event', { hasText: 'E2E calendar engine task' })).toHaveCount(1);
});
