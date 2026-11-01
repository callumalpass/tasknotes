import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';
import { calendarTimeSlots } from '../calendar-helpers';
import { parse } from 'yaml';
import * as fs from 'fs';

/**
 * Daily note timeblock create, edit and delete keep the daily note's frontmatter
 * when a frontmatter value contains "---". The writers used to find the closing
 * fence with indexOf("---", 3), which matched inside the value and cut the
 * frontmatter short. Create then rewrote the note with the description dropped
 * and the old frontmatter tail spilled into the body; edit and delete failed
 * with "No timeblocks found in daily note" and left the modal open.
 */

let app: ObsidianApp;
const BASE_PATH = 'TaskNotes/Views/e2e-frontmatter-fence.base';
const DESCRIPTION = 'Part A --- Part B';
const BODY = 'Daily body stays here.';

let notePath = '';

function noteContent(): string {
	return [
		'---',
		`description: "${DESCRIPTION}"`,
		'timeblocks:',
		'  - id: tb-fence-existing',
		'    title: Fence existing',
		'    startTime: "09:00"',
		'    endTime: "10:00"',
		'---',
		'',
		BODY,
		'',
	].join('\n');
}

/** The note's frontmatter, read with a line-based fence like Obsidian's, plus whether the body survived. */
async function readNote(page: Page): Promise<{ description: unknown; titles: string[]; body: boolean }> {
	const content = await page.evaluate((path) => (window as any).app.vault.adapter.read(path), notePath);
	const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(content);
	const fm = match ? parse(match[1]) ?? {} : {};
	return {
		description: fm.description,
		titles: (fm.timeblocks ?? []).map((tb: { title: string }) => tb.title),
		body: content.slice(match?.[0].length ?? 0).trim() === BODY,
	};
}

async function openDayCalendar(page: Page): Promise<void> {
	await page.evaluate(async (path) => {
		const w = window as any;
		const text = `filters:
  and:
    - note.status && note.status != ""
views:
  - type: tasknotesCalendar
    name: Fence
    calendarView: timeGridDay
    showTimeblocks: true
    scrollTime: 08:00:00
`;
		const existing = w.app.vault.getAbstractFileByPath(path);
		if (existing) await w.app.vault.modify(existing, text);
		else await w.app.vault.create(path, text);
		await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(path));
	}, BASE_PATH);
	await expect(page.locator('.tnc:visible').first()).toBeVisible({ timeout: 15000 });
}

const timeblockItem = (page: Page, title: string) =>
	page.locator('.tnc:visible .tnc-item', { hasText: title }).first();

test.beforeAll(async () => {
	app = await launchObsidian();
	notePath = await app.page.evaluate(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`;
	});
});

test.beforeEach(async () => {
	await app.page.evaluate(async ([path, text]) => {
		const w = window as any;
		const existing = w.app.vault.getAbstractFileByPath(path);
		if (existing) await w.app.vault.modify(existing, text);
		else await w.app.vault.create(path, text);
	}, [notePath, noteContent()]);
	await openDayCalendar(app.page);
	await expect(timeblockItem(app.page, 'Fence existing')).toBeVisible({ timeout: 10000 });
});

test.afterEach(async ({}, testInfo) => {
	await app.page.screenshot({ path: testInfo.outputPath('final.png') });
	const note = await app.page.evaluate((path) => (window as any).app.vault.adapter.read(path), notePath);
	fs.writeFileSync(testInfo.outputPath('daily-note.md'), note);
	await app.page.keyboard.press('Escape');
	await app.page.evaluate(() => (window as any).app.workspace.getLeaf()?.detach());
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
		}, [BASE_PATH, notePath]);
	} finally {
		await closeObsidian(app);
	}
});

test('creating a timeblock keeps a frontmatter value containing ---', async () => {
	const page = app.page;
	const slots = calendarTimeSlots(page);
	const perHour = (await slots.count()) / 24;
	const from = (await slots.nth(13 * perHour).boundingBox())!;
	const to = (await slots.nth(14 * perHour - 1).boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
	await page.mouse.up();

	await page.locator('.menu-item', { hasText: 'Create timeblock' }).click();
	const modal = page.locator('.modal', { has: page.locator('.timeblock-create-button') });
	await modal.locator('input[type="text"]').first().fill('Fence created');
	await modal.locator('.timeblock-create-button').click();
	await expect(modal).toBeHidden();

	await expect.poll(() => readNote(page)).toEqual({
		description: DESCRIPTION,
		titles: ['Fence existing', 'Fence created'],
		body: true,
	});
});

test('editing a timeblock keeps a frontmatter value containing ---', async () => {
	const page = app.page;
	await timeblockItem(page, 'Fence existing').click();
	const modal = page.locator('.timeblock-info-modal');
	await modal.locator('input[type="text"]').first().fill('Fence edited');
	await modal.locator('.timeblock-save-button').click();
	await expect(modal).toBeHidden();

	await expect.poll(() => readNote(page)).toEqual({
		description: DESCRIPTION,
		titles: ['Fence edited'],
		body: true,
	});
});

test('deleting a timeblock keeps a frontmatter value containing ---', async () => {
	const page = app.page;
	await timeblockItem(page, 'Fence existing').click();
	await page.locator('.timeblock-info-modal .timeblock-delete-button').click();
	await page.locator('.modal-button-container button.mod-warning', { hasText: 'Delete' }).click();
	await expect(page.locator('.timeblock-info-modal')).toBeHidden();

	await expect.poll(() => readNote(page)).toEqual({
		description: DESCRIPTION,
		titles: [],
		body: true,
	});
});
