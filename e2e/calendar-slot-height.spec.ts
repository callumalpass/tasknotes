import { test, expect, type CDPSession } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

// Real touch input against the isolated desktop host; this is not physical-mobile testing.
let app: ObsidianApp;
let cdp: CDPSession;
let savedHeights: unknown;
let viewport: { width: number; height: number };
let sidebars: { left: boolean; right: boolean };
const BASE = 'TaskNotes/Views/e2e-calendar-slot-height.base';
const KEY = 'tasknotes-calendar-pinched-slot-heights';
const TASKS = [0, 1, 2].map((n) => `TaskNotes/Tasks/e2e-calendar-slot-height-${n}.md`);

async function openCalendar(settings: Record<string, string | number | boolean> = {}): Promise<void> {
	await app.page.evaluate(async ({ path, settings }) => {
		const host = (window as any).app;
		for (const leaf of host.workspace.getLeavesOfType('bases')) {
			if (leaf.view.file?.path === path) leaf.detach();
		}
		const options = { calendarView: 'timeGridDay', slotHeight: 24, scrollTime: '08:00:00', ...settings };
		const lines = Object.entries(options).map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`).join('\n');
		const text = `filters:\n  and:\n    - file.name.startsWith("e2e-calendar-slot-height-")\nviews:\n  - type: tasknotesCalendar\n    name: Slot height\n${lines}\n`;
		let file = host.vault.getAbstractFileByPath(path);
		if (file) await host.vault.modify(file, text);
		else file = await host.vault.create(path, text);
		await host.workspace.getLeaf(true).openFile(file);
	}, { path: BASE, settings });
	await expect(app.page.locator('.tnc:visible .tnc-tg-body')).toBeVisible({ timeout: 15000 });
	await expect.poll(() => app.page.locator('.tnc:visible .tnc-tg').evaluate(element =>
		element.getAnimations().some(animation => animation.playState === 'running'))).toBe(false);
}

async function slotPixels(): Promise<number> {
	return app.page.locator('.tnc:visible .tnc-tg').evaluate((el) =>
		parseFloat(getComputedStyle(el).getPropertyValue('--tnc-slot-px')));
}

async function pinch(refresh = false): Promise<{ before: number; after: number }> {
	// An auto-sized grid can extend beyond the window: inject inside its visible intersection.
	const { x, y } = await app.page.locator('.tnc:visible .tnc-tg-body').evaluate((el) => {
		const body = el.getBoundingClientRect();
		const scroller = el.closest('.tnc-tg-scroll')!;
		const scroll = scroller.getBoundingClientRect();
		const header = scroller.querySelector('.tnc-tg-top')!.getBoundingClientRect();
		return {
			x: (Math.max(body.left, scroll.left) + Math.min(body.right, scroll.right, innerWidth)) / 2,
			y: (Math.max(body.top, header.bottom, 0) + Math.min(body.bottom, scroll.bottom, innerHeight - 10)) / 2,
		};
	});
	const anchor = () => app.page.locator('.tnc:visible .tnc-tg-body').evaluate((el, y) => {
		const box = el.getBoundingClientRect();
		return (y - box.top) / box.height * 1440;
	}, y);
	const before = await anchor();
	const points = (distance: number) => [
		{ x, y: y - distance / 2, id: 1 },
		{ x, y: y + distance / 2, id: 2 },
	];
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(80) });
	try {
		for (const distance of [96, 112, 128, 144, 160]) {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
			if (refresh && distance === 112) {
				await app.page.evaluate(() => (window as any).app.workspace.getMostRecentLeaf().view.controller.view.renderPreservingEphemeralState());
				await expect.poll(() => app.page.evaluate(() =>
					(window as any).app.workspace.getMostRecentLeaf().view.controller.view._isRendering)).toBe(false);
			}
		}
	} finally {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	}
	return { before, after: await anchor() };
}

test.beforeAll(async () => {
	app = await launchObsidian();
	viewport = await app.page.evaluate(() => {
		const [width, height] = (window as any).require('electron').remote.getCurrentWindow().getContentSize();
		return { width, height };
	});
	sidebars = await app.page.evaluate(() => {
		const workspace = (window as any).app.workspace;
		return { left: workspace.leftSplit.collapsed, right: workspace.rightSplit.collapsed };
	});
	savedHeights = await app.page.evaluate((key) => (window as any).app.loadLocalStorage(key), KEY);
	cdp = await app.page.context().newCDPSession(app.page);
	await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
});

test.beforeEach(async () => {
	await app.page.evaluate((key) => (window as any).app.saveLocalStorage(key, {}), KEY);
});

test.afterEach(async () => {
	await app.page.evaluate(async ({ path, tasks, key, saved }) => {
		const host = (window as any).app;
		for (const leaf of host.workspace.getLeavesOfType('bases')) {
			if (leaf.view.file?.path === path) leaf.detach();
		}
		for (const p of [path, ...tasks]) {
			const file = host.vault.getAbstractFileByPath(p);
			if (file) await host.vault.delete(file);
		}
		host.saveLocalStorage(key, saved ?? null);
	}, { path: BASE, tasks: TASKS, key: KEY, saved: savedHeights });
	await app.page.evaluate(({ left, right }) => {
		const workspace = (window as any).app.workspace;
		workspace.leftSplit[left ? 'collapse' : 'expand']();
		workspace.rightSplit[right ? 'collapse' : 'expand']();
	}, sidebars);
	await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
	await setObsidianViewport(app.page, viewport);
});

test.afterAll(async () => {
	try {
		if (cdp) {
			await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
			await cdp.detach();
		}
	} finally {
		if (app) await closeObsidian(app);
	}
});

test('per-view height compacts fifteen-minute slots', async () => {
	await openCalendar({ slotDuration: '00:15:00', slotHeight: 10 });
	expect(await slotPixels()).toBe(10);
	await expect(app.page.locator('.tnc:visible .tnc-tg-body')).toHaveCSS('height', '960px');
});

test('pinching anchors the time and saves the height across reopening', async ({}, info) => {
	await openCalendar();
	expect(await slotPixels()).toBe(24);
	await app.page.screenshot({ path: info.outputPath('before-pinch.png') });
	const anchor = await pinch();
	await expect.poll(slotPixels).toBe(48);
	expect(Math.abs(anchor.after - anchor.before)).toBeLessThan(2);
	await expect.poll(() => app.page.evaluate((key) => (window as any).app.loadLocalStorage(key)?.['24'], KEY)).toBe(48);
	await app.page.screenshot({ path: info.outputPath('after-pinch.png') });
	await openCalendar();
	expect(await slotPixels()).toBe(48);
	await openCalendar({ slotHeight: 30 });
	expect(await slotPixels()).toBe(30);
});

test('an incremental Bases refresh does not interrupt an active pinch', async () => {
	await openCalendar();
	const anchor = await pinch(true);
	await expect.poll(slotPixels).toBe(48);
	expect(Math.abs(anchor.after - anchor.before)).toBeLessThan(2);
	await expect.poll(() => app.page.evaluate((key) => (window as any).app.loadLocalStorage(key)?.['24'], KEY)).toBe(48);
});

test('disabling pinch leaves the configured grid height unchanged', async () => {
	await openCalendar({ pinchZoom: false });
	await pinch();
	expect(await slotPixels()).toBe(24);
	expect(await app.page.evaluate((key) => (window as any).app.loadLocalStorage(key), KEY)).toEqual({});
});

test('narrow weeks keep day navigation and collision stacks usable', async ({}, info) => {
	await setObsidianViewport(app.page, { width: 430, height: 900 });
	await app.page.evaluate(() => {
		const workspace = (window as any).app.workspace;
		workspace.leftSplit.collapse();
		workspace.rightSplit.collapse();
	});
	await app.page.evaluate(async (paths) => {
		const host = (window as any).app;
		const d = new Date();
		const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		for (const [i, path] of paths.entries()) {
			await host.vault.create(path, `---\ntitle: Slot overlap ${i}\nstatus: open\nscheduled: ${day}T10:00\ntimeEstimate: 60\ntags: [task]\n---\n`);
		}
	}, TASKS);
	await openCalendar({ calendarView: 'timeGridWeek', scrollTime: '09:00:00' });
	const calendar = app.page.locator('.tnc:visible');
	// Test a phone-width calendar, not an 80px sliver beside the file explorer.
	await expect.poll(async () => (await calendar.boundingBox())!.width).toBeGreaterThan(330);
	await expect.poll(async () => (await calendar.boundingBox())!.width).toBeLessThanOrEqual(430);
	const days = calendar.locator('.tnc-tg-head .tnc-dh');
	await expect(days).toHaveCount(3);
	const displayedDates = () => days.evaluateAll(elements => elements.map(element => element.getAttribute('data-date')));
	const initialDates = await displayedDates();
	const nextDates = initialDates.map(date => {
		const next = new Date(`${date}T12:00:00Z`);
		next.setUTCDate(next.getUTCDate() + 3);
		return next.toISOString().slice(0, 10);
	});
	const navigation = calendar.locator('.tnc-toolbar-nav');
	await expect(navigation).toBeVisible();
	await expect(navigation.locator('.tnc-btn-prev')).toBeVisible();
	await expect(navigation.locator('.tnc-btn-next')).toBeVisible();
	await setObsidianViewport(app.page, { width: 360, height: 900 });
	await expect.poll(async () => (await calendar.boundingBox())!.width).toBeGreaterThan(260);
	await expect(days).toHaveCount(3);
	await expect.poll(displayedDates).toEqual(initialDates);
	const stack = calendar.locator('.tnc-more--collision');
	await expect(stack).toHaveCount(1, { timeout: 10000 });
	await expect(stack.locator('.tnc-collision-count')).toHaveText('3');
	await stack.click();
	const popover = calendar.locator('.tnc-popover');
	await expect(popover.locator('.tnc-item')).toHaveCount(3);
	const box = (await popover.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(361);
	await app.page.screenshot({ path: info.outputPath('narrow-overlap.png') });
	await popover.locator('.tnc-popover-close').click();
	await navigation.locator('.tnc-btn-next').click();
	await expect.poll(displayedDates).toEqual(nextDates);
	await expect(stack).toHaveCount(0);
	const lastDay = await days.last().boundingBox();
	const scrollBox = (await calendar.locator('.tnc-tg-scroll').boundingBox())!;
	expect(lastDay!.x + lastDay!.width).toBeLessThanOrEqual(scrollBox.x + scrollBox.width + 1);
	await app.page.screenshot({ path: info.outputPath('narrow-navigation.png') });
	await navigation.locator('.tnc-btn-prev').click();
	await expect.poll(displayedDates).toEqual(initialDates);
	await expect(stack).toHaveCount(1);
	await expect(stack.locator('.tnc-collision-count')).toHaveText('3');
});
