import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

// Issue #2471: after an in-app update, an open Bases calendar tab kept the old
// version's view instance, which then rendered with the new stylesheet (4.14's
// FullCalendar view without FullCalendar's CSS drew the time labels mid-grid).
// Obsidian updates a plugin by disabling and re-enabling it, so a reload must
// rebuild open TaskNotes Bases views with the newly loaded plugin.

let app: ObsidianApp;
test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

const BASE_PATH = 'TaskNotes/Views/e2e-issue-2471.base';

async function openWeekBase(page: Page): Promise<void> {
	await page.evaluate(async (path) => {
		const w = window as any;
		const text = `filters:
  and:
    - note.status && note.status != ""
views:
  - type: tasknotesCalendar
    name: Week
    calendarView: timeGridWeek
`;
		const existing = w.app.vault.getAbstractFileByPath(path);
		if (existing) await w.app.vault.modify(existing, text);
		else await w.app.vault.create(path, text);
		await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(path));
	}, BASE_PATH);
	await expect(page.locator('.tnc-gutter:visible').first()).toBeVisible({ timeout: 15000 });
}

function calendarViewIsFromLoadedPlugin(page: Page): Promise<boolean> {
	return page.evaluate((path) => {
		const w = window as any;
		const leaf = w.app.workspace.getLeavesOfType('bases').find((l: any) => l.view?.file?.path === path);
		const view = leaf?.view?.controller?.view;
		return view?.type === 'tasknotesCalendar' && view.plugin === w.app.plugins.plugins.tasknotes;
	}, BASE_PATH);
}

test.afterEach(async () => {
	await app.page.evaluate(async (path) => {
		const w = window as any;
		for (const leaf of w.app.workspace.getLeavesOfType('bases')) {
			if (leaf.view?.file?.path === path) leaf.detach();
		}
		const f = w.app.vault.getAbstractFileByPath(path);
		if (f) await w.app.vault.delete(f);
	}, BASE_PATH);
});

test('reloading the plugin rebuilds an open calendar with the new version', async () => {
	const page = app.page;
	await openWeekBase(page);
	expect(await calendarViewIsFromLoadedPlugin(page)).toBe(true);

	await page.evaluate(async () => {
		const plugins = (window as any).app.plugins;
		await plugins.disablePlugin('tasknotes');
		await plugins.enablePlugin('tasknotes');
	});

	await expect.poll(() => calendarViewIsFromLoadedPlugin(page), { timeout: 15000 }).toBe(true);
	// The time labels sit in the gutter, left of the first day column.
	const label = page.locator('.tnc-gutter:visible .tnc-slot-label').first();
	await expect(label).toBeVisible();
	const labelRight = await label.evaluate((el) => el.getBoundingClientRect().right);
	const dayLeft = await page
		.locator('.tnc-tg-body .tnc-col:visible')
		.first()
		.evaluate((el) => el.getBoundingClientRect().left);
	expect(labelRight).toBeLessThanOrEqual(dayLeft);
});
