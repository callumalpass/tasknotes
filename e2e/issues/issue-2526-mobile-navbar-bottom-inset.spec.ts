/**
 * Issue #2526: on a phone, the last Agenda rows sit behind Obsidian's floating
 * navbar. Related: #2263 (last task hidden by the desktop status bar), #2252
 * (top spacing) and #2261 (no extra bottom space in embedded Agendas).
 *
 * Desktop Obsidian cannot run the phone app. `app.emulateMobile(true)` applies the
 * phone body classes (is-phone, is-floating-nav), the fixed floating navbar and
 * Obsidian's own phone spacing variables, and we set a non-zero
 * --safe-area-inset-bottom to stand in for a device inset. It does not reproduce
 * native WebView env() values, real device sizes or touch scrolling.
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

let app: ObsidianApp;
const folder = `Issue2526-${Date.now()}`;
const VIEWS = {
	agenda: '  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n    listDayCount: 7\n',
	month: '  - type: tasknotesCalendar\n    name: Month\n    calendarView: dayGridMonth\n',
	list: '  - type: tasknotesTaskList\n    name: List\n',
	kanban: '  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: priority\n      direction: ASC\n',
};
type ViewName = keyof typeof VIEWS;

test.setTimeout(180000);

test.beforeAll(async () => {
	app = await launchObsidian();
	await app.page.waitForFunction(() => (window as any).app.plugins.plugins.tasknotes?.initializationComplete === true);
	await app.page.evaluate(async ({ folder, VIEWS }) => {
		const host = (window as any).app;
		await host.vault.createFolder(folder);
		const today = new Date();
		for (let i = 0; i < 30; i++) {
			const day = new Date(today.getTime() + (i % 6) * 86400000).toISOString().slice(0, 10);
			await host.vault.create(`${folder}/Task ${String(i).padStart(2, '0')}.md`,
				`---\ntitle: Task ${i}\nstatus: open\npriority: ${['low', 'normal', 'high'][i % 3]}\nscheduled: ${day}\ntags: [task]\n---\n`);
		}
		for (const [name, view] of Object.entries(VIEWS)) {
			await host.vault.create(`${folder}/${name}.base`,
				`filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.ext == "md"\nviews:\n${view}`);
		}
		await host.vault.create(`${folder}/Embed.md`, `# Embed\n\n![[${folder}/agenda.base]]\n\n![[${folder}/list.base]]\n`);
	}, { folder, VIEWS });
});

test.afterAll(async () => {
	if (!app) return;
	try {
		await setMobile(app.page, false);
		await app.page.evaluate(async (folder) => {
			const host = (window as any).app;
			const dir = host.vault.getAbstractFileByPath(folder);
			if (dir) await host.vault.delete(dir, true);
		}, folder);
	} finally {
		await closeObsidian(app);
	}
});

/** emulateMobile() persists the mode and reloads the window; wait for TaskNotes again. */
async function setMobile(page: Page, on: boolean): Promise<void> {
	const isOn = () => page.evaluate(() => document.body.classList.contains('emulate-mobile')).catch(() => null);
	if (await isOn() !== on) {
		await page.evaluate((on) => (window as any).app.emulateMobile(on), on).catch(() => undefined);
	}
	await expect.poll(() => page.evaluate(() => [
		document.body.classList.contains('emulate-mobile'),
		(window as any).app?.plugins?.plugins?.tasknotes?.initializationComplete === true,
	]).catch(() => null), { timeout: 60000 }).toEqual([on, true]);
}

async function openFile(page: Page, path: string): Promise<void> {
	await page.evaluate(async (path) => {
		const host = (window as any).app;
		await host.workspace.getLeaf(false).openFile(host.vault.getAbstractFileByPath(path));
	}, path);
}

/** Scroll the open view to its end and return the bottom of its last visible row. */
async function lastRowBottom(page: Page, name: ViewName): Promise<number> {
	await openFile(page, `${folder}/${name}.base`);
	const rowSelector = name === 'month' ? '.tnc-dg-week' : name === 'agenda' ? '.tnc-list-section' : '.task-card';
	const root = page.locator('.workspace-leaf.mod-active .workspace-leaf-content[data-type="bases"] .tn-bases-integration');
	await expect(root.locator(rowSelector).first()).toBeVisible();
	return root.evaluate(async (root, rowSelector) => {
		const scrollers = [...root.querySelectorAll<HTMLElement>('*')]
			.filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight);
		for (let pass = 0; pass < 3; pass++) {
			for (const el of scrollers) el.scrollTop = el.scrollHeight;
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
		// Rows a scroller has clipped are not "visible"; the last visible row is the
		// lowest row that still lies inside its scroller once scrolled to the end.
		const bottoms = [...root.querySelectorAll<HTMLElement>(rowSelector)].map((row) => {
			const scroller = scrollers.find((el) => el.contains(row));
			const bottom = row.getBoundingClientRect().bottom;
			return scroller && bottom > scroller.getBoundingClientRect().bottom + 1 ? -Infinity : bottom;
		});
		return Math.max(...bottoms);
	}, rowSelector);
}

test('phone: every TaskNotes view ends above the floating navbar and below the header', async () => {
	const page = app.page;
	await setObsidianViewport(page, { width: 390, height: 844 });
	await setMobile(page, true);
	await page.evaluate(() => document.body.style.setProperty('--safe-area-inset-bottom', '48px'));
	await expect(page.locator('body')).toHaveClass(/is-phone/);
	const navbar = page.locator('.mobile-navbar');
	await expect(navbar).toBeVisible();

	for (const name of Object.keys(VIEWS) as ViewName[]) {
		const bottom = await lastRowBottom(page, name);
		const navbarTop = (await navbar.boundingBox())!.y;
		expect.soft(bottom, `${name}: last row bottom vs navbar top ${navbarTop}`).toBeLessThanOrEqual(navbarTop);
	}

	// #2252: Obsidian already offsets Bases tabs below the status bar and view header.
	const headerBottom = await page.locator('.workspace-leaf.mod-active .view-header').evaluate((el) => el.getBoundingClientRect().bottom);
	const toolbarTop = await page.locator('.workspace-leaf.mod-active .bases-header').evaluate((el) => el.getBoundingClientRect().top);
	expect(toolbarTop).toBeGreaterThanOrEqual(headerBottom);

	// #2261 / #2239: Agenda and Task List embeds in a note get no extra bottom space.
	await openFile(page, `${folder}/Embed.md`);
	const embeds = page.locator('.workspace-leaf.mod-active .internal-embed .tn-bases-integration');
	await expect(embeds.locator('.tnc-list-scroll')).toBeVisible();
	await expect(embeds.locator('.tn-bases-items-container')).toBeAttached();
	const paddings = await embeds.evaluateAll((roots) => roots.flatMap((root) =>
		[root, ...root.querySelectorAll('.tnc-list-scroll, .tn-bases-items-container')].map((el) => getComputedStyle(el).paddingBottom)));
	expect(paddings).toEqual(['0px', '0px', '0px', '0px']);
});

test('desktop: the last Task List and Agenda rows scroll clear of the status bar', async () => {
	const page = app.page;
	await setMobile(page, false);
	await setObsidianViewport(page, { width: 900, height: 700 });
	const statusBar = page.locator('.status-bar');
	await expect(statusBar).toBeVisible();

	for (const name of ['list', 'agenda'] as ViewName[]) {
		const bottom = await lastRowBottom(page, name);
		const statusBarTop = (await statusBar.boundingBox())!.y;
		expect.soft(bottom, `${name}: last row bottom vs status bar top ${statusBarTop}`).toBeLessThanOrEqual(statusBarTop);
	}
});
