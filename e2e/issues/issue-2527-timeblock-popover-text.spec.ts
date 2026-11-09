/**
 * Issue #2527: a timeblock's text was invisible in light mode where the calendar
 * draws it without its colour fill: the "+N more" popover for overlapping events
 * and month-view dots. Timeblocks set `textColor` to `--text-on-accent` (white),
 * which only reads on the filled time-grid block.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2527
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const TASKS = ['Issue 2527 task A.md', 'Issue 2527 task B.md'];
const BASE = 'TaskNotes/Views/issue-2527.base';
const TIMEBLOCK = 'Issue 2527 Gym';

let app: ObsidianApp;
let page: Page;
let notePath: string;
let original: { note: string | null; timeblocking: boolean; theme: string };

/** WCAG contrast of an element's text against the first opaque background behind it. */
function titleContrast(page: Page, selector: string) {
	return page.evaluate((selector) => {
		const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		const rgba = (css: string) => {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = '#000';
			ctx.fillStyle = css;
			ctx.fillRect(0, 0, 1, 1);
			return [...ctx.getImageData(0, 0, 1, 1).data];
		};
		const title = document.querySelector<HTMLElement>(selector);
		if (!title) return null;
		let bgEl: HTMLElement | null = title;
		let bg = [0, 0, 0, 0];
		while (bgEl) {
			bg = rgba(getComputedStyle(bgEl).backgroundColor);
			if (bg[3] === 255) break;
			bgEl = bgEl.parentElement;
		}
		const fg = rgba(getComputedStyle(title).color);
		const opacity = (() => {
			let o = 1;
			for (let el: HTMLElement | null = title; el; el = el.parentElement)
				o *= Number(getComputedStyle(el).opacity);
			return o;
		})();
		const a = (fg[3] / 255) * opacity;
		const text = fg.slice(0, 3).map((c, i) => c * a + bg[i] * (1 - a));
		const lum = (c: number[]) =>
			c
				.map((v) => v / 255)
				.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
				.reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
		const [hi, lo] = [lum(text), lum(bg.slice(0, 3))].sort((x, y) => y - x);
		return (hi + 0.05) / (lo + 0.05);
	}, selector);
}

async function openBase(view: string, extra = '') {
	await page.evaluate(
		async ({ path, view, extra }) => {
			const w = window as any;
			const text = `views:\n  - type: tasknotesCalendar\n    name: Issue 2527\n    calendarView: ${view}\n    showTimeblocks: true\n    scrollTime: 08:00:00\n${extra}`;
			const existing = w.app.vault.getAbstractFileByPath(path);
			if (existing) await w.app.vault.modify(existing, text);
			else await w.app.vault.create(path, text);
			const stale: any[] = [];
			w.app.workspace.iterateAllLeaves((leaf: any) => {
				if (leaf.view?.file?.path === path) stale.push(leaf);
			});
			await w.app.workspace.getLeaf('tab').openFile(w.app.vault.getAbstractFileByPath(path));
			for (const leaf of stale) leaf.detach();
		},
		{ path: BASE, view, extra }
	);
	await expect(page.locator('.tnc:visible')).toBeVisible();
}

test.beforeAll(async () => {
	app = await launchObsidian();
	page = app.page;
	notePath = await page.evaluate(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`;
	});
	original = await page.evaluate(async (path) => {
		const w = window as any;
		const file = w.app.vault.getAbstractFileByPath(path);
		return {
			note: file ? await w.app.vault.read(file) : null,
			timeblocking: w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking,
			theme: w.app.vault.getConfig('theme') ?? 'moonstone',
		};
	}, notePath);
	await page.evaluate(
		async ({ notePath, tasks, timeblock }) => {
			const w = window as any;
			w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking = true;
			const day = notePath.replace(/\.md$/, '');
			const note = `---\ntimeblocks:\n  - id: tb-2527\n    title: ${timeblock}\n    startTime: "09:00"\n    endTime: "10:30"\n---\n`;
			const existing = w.app.vault.getAbstractFileByPath(notePath);
			if (existing) await w.app.vault.modify(existing, note);
			else await w.app.vault.create(notePath, note);
			for (const [i, path] of tasks.entries()) {
				await w.app.vault.create(
					path,
					`---\ntitle: ${path.replace(/\.md$/, '')}\nstatus: open\npriority: normal\nscheduled: ${day}T09:${i ? '30' : '00'}\ntimeEstimate: 60\ntags:\n  - task\n---\n`
				);
			}
		},
		{ notePath, tasks: TASKS, timeblock: TIMEBLOCK }
	);
});

test.afterAll(async () => {
	if (!app) return;
	try {
		await page.evaluate(
			async ({ notePath, paths, original }) => {
				const w = window as any;
				w.app.changeTheme(original.theme);
				w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking =
					original.timeblocking;
				w.app.workspace.getLeaf()?.detach();
				for (const path of [...paths, ...(original.note === null ? [notePath] : [])]) {
					const file = w.app.vault.getAbstractFileByPath(path);
					if (file) await w.app.vault.delete(file);
				}
				if (original.note !== null)
					await w.app.vault.modify(w.app.vault.getAbstractFileByPath(notePath), original.note);
			},
			{ notePath, paths: [...TASKS, BASE], original }
		);
	} finally {
		await closeObsidian(app);
	}
});

for (const theme of ['moonstone', 'obsidian'] as const) {
	const mode = theme === 'moonstone' ? 'light' : 'dark';

	test(`timeblock text is readable in the overlap popover (${mode})`, async ({}, testInfo) => {
		await page.evaluate((theme) => (window as any).app.changeTheme(theme), theme);
		await openBase('timeGridDay', '    eventMaxStack: 1\n');
		const stack = page.locator('.tnc:visible .tnc-more--stack').first();
		await expect(stack).toBeVisible();
		await stack.click();
		const item = page.locator('.tnc-popover .tnc-item', { hasText: TIMEBLOCK });
		await expect(item).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath(`popover-${mode}.png`) });
		const contrast = await titleContrast(
			page,
			'.tnc-popover .tnc-item[data-event-type="timeblock"] .tnc-item-title'
		);
		expect(contrast).toBeGreaterThanOrEqual(3);
		await page.keyboard.press('Escape');
	});

	test(`timeblock text is readable as a month-view dot (${mode})`, async ({}, testInfo) => {
		await page.evaluate((theme) => (window as any).app.changeTheme(theme), theme);
		await openBase('dayGridMonth');
		const item = page.locator('.tnc:visible .tnc-item--dot[data-event-type="timeblock"]').first();
		await expect(item).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath(`month-${mode}.png`) });
		const contrast = await titleContrast(
			page,
			'.tnc:not([hidden]) .tnc-item--dot[data-event-type="timeblock"] .tnc-item-title'
		);
		expect(contrast).toBeGreaterThanOrEqual(3);
	});

	test(`timeblock text is readable in the list view (${mode})`, async () => {
		await page.evaluate((theme) => (window as any).app.changeTheme(theme), theme);
		await openBase('listWeek');
		const item = page.locator('.tnc:visible .tnc-item--list[data-event-type="timeblock"]').first();
		await expect(item).toContainText(TIMEBLOCK);
		const contrast = await titleContrast(
			page,
			'.tnc-item--list[data-event-type="timeblock"] .tnc-item-main'
		);
		expect(contrast).toBeGreaterThanOrEqual(3);
	});

	test(`filled time-grid timeblocks keep on-accent text (${mode})`, async () => {
		await page.evaluate((theme) => (window as any).app.changeTheme(theme), theme);
		await openBase('timeGridDay');
		const title = page.locator('.tnc:visible .tnc-item--timed[data-event-type="timeblock"] .tnc-item-title');
		await expect(title).toBeVisible();
		const [color, onAccent] = await title.evaluate((el) => {
			const probe = document.body.createDiv();
			probe.style.color = 'var(--text-on-accent)';
			const expected = getComputedStyle(probe).color;
			probe.remove();
			return [getComputedStyle(el).color, expected];
		});
		expect(color).toBe(onAccent);
	});
}
