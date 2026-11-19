import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';
import { closeObsidian, launchObsidian, type ObsidianApp } from '../obsidian';

// #2540: exercise the bundled context-menu export and the real vault feed writer.
const folder = `ICS2540-${Date.now()}`;
const base = `${folder}/Tasks.base`;
const feed = `${folder}/export.ics`;
const tasks = [
	{ title: 'ICS2540 all-day', due: '2026-11-20', start: '2026-11-20', end: '2026-11-21', dateOnly: true },
	{ title: 'ICS2540 timed', due: '2026-11-20T14:30:00Z', start: '2026-11-20T14:30:00Z', end: '2026-11-20T15:30:00Z', dateOnly: false },
	{ title: 'ICS2540 scheduled', due: '2026-11-20T15:30:00Z', scheduled: '2026-11-20T12:30:00Z', start: '2026-11-20T12:30:00Z', end: '2026-11-20T15:30:00Z', dateOnly: false },
];
let instance: ObsidianApp;

function assertEvent(content: string, task: typeof tasks[number]) {
	const calendar = new ICAL.Component(ICAL.parse(content));
	const event = calendar.getAllSubcomponents('vevent').find(event => event.getFirstPropertyValue('summary') === task.title);
	expect(event).toBeTruthy();
	const start = event!.getFirstPropertyValue('dtstart') as ICAL.Time;
	const end = event!.getFirstPropertyValue('dtend') as ICAL.Time;
	expect(start.toString()).toBe(task.start);
	expect(end.toString()).toBe(task.end);
	expect(start.isDate).toBe(task.dateOnly);
	expect(end.isDate).toBe(task.dateOnly);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async ({ folder, base, tasks }) => {
		const w = window as any;
		const app = w.app;
		const plugin = app.plugins.plugins.tasknotes;
		w.__ics2540 = {
			settings: structuredClone(plugin.settings.icsIntegration),
			locale: plugin.i18n.getCurrentLocale(),
			createURL: URL.createObjectURL,
			click: HTMLAnchorElement.prototype.click,
			contents: [],
		};
		plugin.autoExportService.stop();
		plugin.i18n.setLocale('en');
		await app.vault.createFolder(folder);
		for (const task of tasks) {
			const values: Record<string, unknown> = {
				title: task.title, status: 'open', tags: ['task'], due: task.due,
				dateCreated: '2026-11-02T10:15:00-05:00',
				...(task.scheduled ? { scheduled: task.scheduled } : {}),
			};
			const yaml = Object.entries(values).map(([key, value]) =>
				`${key === 'tags' ? 'tags' : plugin.fieldMapper.toUserField(key)}: ${JSON.stringify(value)}`).join('\n');
			await app.vault.create(`${folder}/${task.title}.md`, `---\n${yaml}\n---\n`);
		}
		const text = `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: ICS 2540\n`;
		await app.workspace.getLeaf('tab').openFile(await app.vault.create(base, text));
		// Capture the actual generated Blob, suppressing only the browser's file
		// transfer so this test cannot open a native Save dialog or write Downloads.
		URL.createObjectURL = function(blob: Blob) {
			if (blob.type === 'text/calendar') w.__ics2540.contents.push(blob.text());
			return w.__ics2540.createURL.call(URL, blob);
		};
		HTMLAnchorElement.prototype.click = function() {
			if (this.download.endsWith('.ics') && this.href.startsWith('blob:')) return;
			return w.__ics2540.click.call(this);
		};
	}, { folder, base, tasks });
	await expect(instance.page.locator(`.task-card[data-task-path="${folder}/${tasks[0].title}.md"]`).first()).toBeVisible({ timeout: 15000 });
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async ({ folder, base }) => {
			const w = window as any;
			const app = w.app;
			const plugin = app.plugins.plugins.tasknotes;
			const saved = w.__ics2540;
			if (saved) {
				URL.createObjectURL = saved.createURL;
				HTMLAnchorElement.prototype.click = saved.click;
				plugin.settings.icsIntegration = saved.settings;
				plugin.i18n.setLocale(saved.locale);
				if (saved.settings.enableAutoExport) plugin.autoExportService.start();
				delete w.__ics2540;
			}
			for (const leaf of app.workspace.getLeavesOfType('bases')) {
				if (leaf.view.file?.path === base) leaf.detach();
			}
			const fixture = app.vault.getAbstractFileByPath(folder);
			if (fixture) await app.vault.delete(fixture, true);
		}, { folder, base });
	} finally {
		await closeObsidian(instance);
	}
});

test('single-task download contains the deadline event and preserves scheduled ranges', async () => {
	const page = instance.page;
	for (const task of tasks) {
		await page.evaluate(() => { (window as any).__ics2540.contents = []; });
		await page.locator(`.task-card[data-task-path="${folder}/${task.title}.md"]`).first().click({ button: 'right' });
		await page.getByText('Add to calendar', { exact: true }).hover();
		await page.getByText('Download .ics file', { exact: true }).click();
		await expect.poll(() => page.evaluate(() => (window as any).__ics2540.contents.length)).toBe(1);
		const [content] = await page.evaluate(() => Promise.all((window as any).__ics2540.contents));
		assertEvent(content, task);
	}
});

test('vault feed export uses the due date instead of the creation date', async () => {
	const content = await instance.page.evaluate(async (feed) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		Object.assign(plugin.settings.icsIntegration, {
			enableAutoExport: false, autoExportPath: feed, useDurationForExport: false,
			excludeArchivedFromExport: false, excludeCompletedFromExport: false,
			requireDueDateForExport: false, requireScheduledDateForExport: false,
		});
		await plugin.autoExportService.exportNow();
		return app.vault.adapter.read(feed);
	}, feed);
	for (const task of tasks) assertEvent(content, task);
});
