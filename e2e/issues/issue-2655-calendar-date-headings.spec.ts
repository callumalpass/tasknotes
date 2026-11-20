import { expect, test, type Locator } from '@playwright/test';
import { closeObsidian, launchObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `DateHeadings-${Date.now()}`;
const date = '2026-11-10';
const otherDate = '2026-11-11';
let instance: ObsidianApp;
let dailyNotesWasEnabled: boolean;

async function setDailyNotes(enabled: boolean): Promise<void> {
	await instance.page.evaluate(async enabled => {
		const dailyNotes = (window as any).app.internalPlugins.getPluginById('daily-notes');
		if (enabled) await dailyNotes.enable();
		else await dailyNotes.disable();
	}, enabled);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	dailyNotesWasEnabled = await instance.page.evaluate(async ({ folder, date, otherDate }) => {
		const app = (window as any).app;
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
		await app.vault.createFolder(folder);
		await app.vault.createFolder(`${folder}/Tasks`);
		await app.vault.create(`${date}.md`, 'Daily note for the date-heading test');
		for (let index = 0; index < 6; index++) {
			await app.vault.create(`${folder}/Tasks/Task ${index}.md`, `---\ntags: [task]\nstatus: open\nscheduled: ${date}\n---\n`);
		}
		await app.vault.create(`${folder}/Tasks/Next day.md`, `---\ntags: [task]\nstatus: open\nscheduled: ${otherDate}\n---\n`);
		for (const name of ['List', 'Agenda', 'Panel']) {
			const view = {
				type: 'tasknotesCalendar', name, initialDate: date,
				calendarView: name === 'Panel' ? 'dayGridMonth' : 'listWeek',
				showAgendaStrip: name === 'Agenda', showMonthDayPanel: name === 'Panel',
				showScheduled: true, showDue: false, showOverdueOnToday: false, dayMaxEvents: 1,
			};
			await app.vault.create(`${folder}/${name}.base`, JSON.stringify({
				filters: { and: [`file.inFolder("${folder}/Tasks")`] }, views: [view],
			}));
		}
		return app.internalPlugins.getPluginById('daily-notes').enabled;
	}, { folder, date, otherDate });
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await setDailyNotes(dailyNotesWasEnabled);
		await instance.page.evaluate(async ({ folder, date }) => {
			const app = (window as any).app;
			await app.internalPlugins.saveConfig();
			const leaf = (window as any).dateHeadingsLeaf;
			leaf?.detach();
			await app.vault.delete(app.vault.getAbstractFileByPath(`${date}.md`), true);
			await app.vault.delete(app.vault.getAbstractFileByPath(folder), true);
		}, { folder, date });
	} finally {
		await closeObsidian(instance);
	}
});

async function openCalendar(name: string): Promise<Locator> {
	await instance.page.evaluate(async path => {
		const app = (window as any).app;
		const leaf = (window as any).dateHeadingsLeaf ??= app.workspace.getLeaf(true);
		await leaf.openFile(app.vault.getAbstractFileByPath(path));
		app.workspace.setActiveLeaf(leaf, { focus: true });
	}, `${folder}/${name}.base`);
	const calendar = instance.page.locator('.workspace-leaf.mod-active #bases-calendar');
	await expect(calendar.locator(':scope > .tnc')).toBeVisible();
	return calendar;
}

async function changeView(view: string): Promise<void> {
	await instance.page.evaluate(({ view, date }) => {
		(window as any).dateHeadingsLeaf.view.controller.view.calendar.changeView(view, date);
	}, { view, date });
}

test('daily-note-only headings are plain text with no provider', async () => {
	await setDailyNotes(false);
	for (const name of ['List', 'Agenda']) {
		const calendar = await openCalendar(name);
		const heading = calendar.locator('.tnc-list-day').first();
		const label = heading.locator('.tn-calendar-day-heading');
		await expect(label).toBeVisible();
		if (name === 'List') {
			await label.click();
			await expect.soft(instance.page.locator('.notice').filter({ hasText: 'Daily notes core plugin is not enabled' })).toHaveCount(0, { timeout: 1_000 });
			await expect(instance.page.locator('.menu-item-title:visible').filter({ hasText: /^Create task$/ })).toHaveCount(0);
		}
		await expect.soft(heading.locator('button, [tabindex]'), `${name} day heading`).toHaveCount(0, { timeout: 1_000 });
	}
	const calendar = await openCalendar('List');
	for (const view of ['week', 'day']) {
		await changeView(view);
		await expect(calendar.locator('.tnc-dh-label').first()).toBeVisible();
		await expect.soft(calendar.locator('.tnc-dh-link'), `${view} column headings`).toHaveCount(0, { timeout: 1_000 });
	}
	await changeView('year');
	await calendar.locator('button.tnc-ym-title[data-month="2026-11"]').press('Enter');
	const number = calendar.locator(`.tnc-dg-day[data-date="${date}"] .tnc-dg-num`);
	await expect(number).toBeVisible();
	await expect.soft(number).toHaveJSProperty('tagName', 'SPAN', { timeout: 1_000 });
	await calendar.locator('.tnc-more').first().click();
	const title = calendar.locator('.tnc-popover-title');
	await expect(title).toBeVisible();
	await expect.soft(title).toHaveJSProperty('tagName', 'DIV', { timeout: 1_000 });
	await instance.page.keyboard.press('Escape');

	await setObsidianViewport(instance.page, { width: 780, height: 900 });
	await expect(calendar.locator('.tnc-dg--chips')).toBeVisible();
	await expect.soft(number).toHaveJSProperty('tagName', 'SPAN', { timeout: 1_000 });
	await setObsidianViewport(instance.page, { width: 1400, height: 900 });
});

test('year and month navigation remain keyboard-operable without daily notes', async () => {
	await setDailyNotes(false);
	const calendar = await openCalendar('Panel');
	await changeView('year');
	await calendar.locator('button.tnc-ym-title[data-month="2026-11"]').press('Enter');
	await expect(calendar.locator('.tnc-dg-day').first()).toBeVisible();
	const day = calendar.locator(`.tnc-dg-day[data-date="${otherDate}"]`);
	await day.locator('button.tnc-dg-num').press('Enter');
	await expect(day).toHaveAttribute('aria-selected', 'true');
	const panelHeading = calendar.locator('.tn-calendar-day-panel .tnc-list-day');
	await expect(panelHeading.locator('.tn-calendar-day-heading')).toBeVisible();
	await expect(panelHeading.getByRole('button')).toHaveCount(0);
	await setDailyNotes(true);
	await expect(panelHeading.locator('button.tnc-list-day-link')).toBeVisible();
	await expect(day).toHaveAttribute('aria-selected', 'true');
});

test('an open calendar responds to Daily notes being enabled and disabled', async () => {
	await setDailyNotes(false);
	const calendar = await openCalendar('Agenda');
	const heading = calendar.locator('.tnc-list-day').first();
	await expect(heading.locator('.tn-calendar-day-heading')).toBeVisible();
	const link = heading.locator('button.tnc-list-day-link');
	await expect(link).toHaveCount(0);
	await setDailyNotes(true);
	await expect(link).toBeVisible();
	await link.press('Enter');
	await expect.poll(() => instance.page.evaluate(() => (window as any).app.workspace.getActiveFile()?.basename)).toBe(date);

	await openCalendar('Agenda');
	await expect(link).toBeVisible();
	await setDailyNotes(false);
	await expect(link).toHaveCount(0);
	await expect(heading.locator('.tn-calendar-day-heading')).toBeVisible();
});

test('Periodic Notes daily support keeps date headings actionable with core Daily notes off', async () => {
	await setDailyNotes(false);
	const calendar = await openCalendar('Agenda');
	const link = calendar.locator('button.tnc-list-day-link').first();
	await expect(link).toHaveCount(0);
	await instance.page.evaluate(({ folder, date }) => {
		const app = (window as any).app;
		app.plugins.plugins['periodic-notes'] = { settings: { daily: { enabled: true, folder } } };
		app.plugins.trigger('changed');
		return app.vault.create(`${folder}/${date}.md`, 'Periodic Notes daily note');
	}, { folder, date });
	try {
		await expect(link).toBeVisible();
		await link.press('Enter');
		await expect.poll(() => instance.page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(`${folder}/${date}.md`);
	} finally {
		await instance.page.evaluate(() => {
			const plugins = (window as any).app.plugins;
			delete plugins.plugins['periodic-notes'];
			plugins.trigger('changed');
		});
	}
});
