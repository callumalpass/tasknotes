import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Native UI acceptance with in-memory provider methods. No account, credentials,
// provider HTTP requests or real calendar deletions are used by this fixture.
let instance: ObsidianApp;
const base = 'TaskNotes/Views/e2e-2542.base';
const item = (title: string) => instance.page.locator('.tnc:visible .tnc-item', { hasText: title }).first();
const calls = () => instance.page.evaluate(() => (window as any).__delete2542.calls);

async function openDelete(title: string) {
	await item(title).click({ button: 'right' });
	await instance.page.getByText('Delete event', { exact: true }).click();
	const modal = instance.page.locator('.modal').filter({ hasText: 'Delete event' });
	await expect(modal).toBeVisible();
	await expect(modal.getByRole('button', { name: 'Delete', exact: true })).toHaveClass(/mod-warning/);
	await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
	return modal;
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async (base) => {
		const w = window as any;
		const plugin = w.app.plugins.plugins.tasknotes;
		const state = w.__delete2542 = { restore: [] as Array<() => void>, calls: [] as unknown[], locale: plugin.i18n.getCurrentLocale() };
		plugin.i18n.setLocale('en');
		const d = new Date();
		const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		const today = day(d);
		d.setDate(d.getDate() + 1);
		const tomorrow = day(d);
		const override = (object: any, name: string, value: unknown) => {
			const descriptor = Object.getOwnPropertyDescriptor(object, name);
			state.restore.push(() => {
				if (descriptor) Object.defineProperty(object, name, descriptor);
				else delete object[name];
			});
			object[name] = value;
		};
		for (const id of ['google', 'microsoft']) {
			const provider = plugin.calendarProviderRegistry.getProvider(id);
			if (!provider) throw new Error(`Missing ${id} provider`);
			let events = [
				{ id: `${id}-fixture-first`, subscriptionId: `${id}-fixture`, title: `${id} fixture first`, start: today, end: tomorrow, allDay: true,
					...(id === 'google' ? { recurringEventId: `${id}-fixture-series` } : {}) },
				{ id: `${id}-fixture-sibling`, subscriptionId: `${id}-fixture`, title: `${id} fixture sibling`, start: tomorrow, allDay: true,
					...(id === 'google' ? { recurringEventId: `${id}-fixture-series` } : {}) },
				{ id: `${id}-readonly-event`, subscriptionId: `${id}-readonly`, title: `${id} fixture read-only`, start: today, end: tomorrow, allDay: true },
				...(id === 'google' ? [{ id: 'google-fixture-failure', subscriptionId: 'google-fixture', title: 'google fixture failure', start: today, end: tomorrow, allDay: true }] : []),
			];
			override(provider, 'getAllEvents', () => events);
			override(provider, 'getAvailableCalendars', () => [
				{ id: 'fixture', summary: `${id} fixture`, canEdit: true },
				{ id: 'readonly', summary: `${id} read-only`, canEdit: false },
			]);
			override(provider, 'refresh', async () => undefined);
			override(provider, 'deleteEvent', async (calendarId: string, eventId: string) => {
				state.calls.push({ provider: id, calendarId, eventId });
				if (eventId === 'failure') throw new Error('Fixture permission denied');
				events = events.filter(event => event.id !== `${id}-${calendarId}-${eventId}`);
				// Real provider deletion refreshes its cache and emits this signal.
				provider.emit('data-changed');
			});
		}
		override(plugin.icsSubscriptionService, 'getAllEvents', () => [
			{ id: 'fixture-ics-event', subscriptionId: 'fixture-ics', title: 'ICS fixture read-only', start: today, end: tomorrow, allDay: true },
		]);
		override(plugin.icsSubscriptionService, 'getSubscriptions', () => [
			{ id: 'fixture-ics', name: 'Fixture ICS', enabled: true, color: '#3788d8' },
		]);
		const text = 'filters:\n  and:\n    - file.name == "no-tasks-in-2542-fixture"\nviews:\n  - type: tasknotesCalendar\n    name: Provider deletion\n    calendarView: listWeek\n    showTimeblocks: false\n';
		await w.app.workspace.getLeaf('tab').openFile(await w.app.vault.create(base, text));
	}, base);
	await expect(item('google fixture first')).toBeVisible({ timeout: 15000 });
	await expect(item('microsoft fixture first')).toBeVisible();
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (base) => {
			const w = window as any;
			for (const leaf of w.app.workspace.getLeavesOfType('bases')) {
				if (leaf.view.file?.path === base) leaf.detach();
			}
			const state = w.__delete2542;
			if (state) {
				for (const restore of state.restore.reverse()) restore();
				w.app.plugins.plugins.tasknotes.i18n.setLocale(state.locale);
				delete w.__delete2542;
			}
			const file = w.app.vault.getAbstractFileByPath(base);
			if (file) await w.app.vault.delete(file);
		}, base);
	} finally { await closeObsidian(instance); }
});

test('Google occurrence requires confirmation, cancels safely, and leaves its sibling', async ({}, info) => {
	let modal = await openDelete('google fixture first');
	await expect(modal).toContainText('Other occurrences are kept.');
	await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
	expect(await calls()).toEqual([]);
	await expect(item('google fixture first')).toBeVisible();
	modal = await openDelete('google fixture first');
	await instance.page.screenshot({ path: info.outputPath('confirmation.png') });
	await modal.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect.poll(calls).toEqual([{ provider: 'google', calendarId: 'fixture', eventId: 'first' }]);
	await expect(item('google fixture first')).toHaveCount(0);
	await expect(item('google fixture sibling')).toBeVisible();
});

test('Microsoft standalone event uses its provider and refreshes the view', async () => {
	const modal = await openDelete('microsoft fixture first');
	await expect(modal).toContainText('Microsoft Calendar');
	await expect(modal).not.toContainText('Other occurrences are kept.');
	await modal.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect.poll(calls).toContainEqual({ provider: 'microsoft', calendarId: 'fixture', eventId: 'first' });
	await expect(item('microsoft fixture first')).toHaveCount(0);
	await expect(item('microsoft fixture sibling')).toBeVisible();
});

test('known read-only provider calendars and ICS subscriptions have no delete action', async () => {
	for (const title of ['google fixture read-only', 'microsoft fixture read-only', 'ICS fixture read-only']) {
		await item(title).click({ button: 'right' });
		await expect(instance.page.getByText('Show details', { exact: true })).toBeVisible();
		await expect(instance.page.getByText('Delete event', { exact: true })).toHaveCount(0);
		await instance.page.keyboard.press('Escape');
	}
});

test('provider rejection shows a failure notice and keeps the event', async () => {
	const modal = await openDelete('google fixture failure');
	await modal.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(instance.page.locator('.notice').filter({ hasText: 'Fixture permission denied' })).toBeVisible();
	await expect(item('google fixture failure')).toBeVisible();
	expect(await calls()).toContainEqual({ provider: 'google', calendarId: 'fixture', eventId: 'failure' });
});
