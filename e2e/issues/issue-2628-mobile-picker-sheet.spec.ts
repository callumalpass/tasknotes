/**
 * Issue #2628: on iPhone, the due/scheduled/priority pickers opened as a popover
 * anchored to the task, focused their search field (raising the keyboard) and could
 * extend behind the keyboard, leaving the lower options unreachable.
 *
 * Desktop Obsidian cannot run the phone app or show a soft keyboard.
 * `app.emulateMobile(true)` applies the phone layout; Obsidian reports the keyboard
 * as --keyboard-height on iOS, so the test sets that variable to stand in for it.
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let app: ObsidianApp;
const folder = `Issue2628-${Date.now()}`;
const KEYBOARD = 300;

test.setTimeout(180000);

test.beforeAll(async () => {
	app = await launchObsidian();
	await app.page.waitForFunction(() => (window as any).app.plugins.plugins.tasknotes?.initializationComplete === true);
	await app.page.evaluate(async (folder) => {
		const host = (window as any).app;
		await host.vault.createFolder(folder);
		for (let i = 0; i < 12; i++) {
			await host.vault.create(`${folder}/Task ${String(i).padStart(2, '0')}.md`,
				`---\ntitle: Task ${i}\nstatus: open\npriority: normal\ndue: 2027-03-0${(i % 9) + 1}\ntags: [task]\n---\n`);
		}
		await host.vault.create(`${folder}/list.base`,
			`filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesTaskList\n    name: List\n    order: [due]\n    sort:\n      - property: file.name\n        direction: ASC\n`);
	}, folder);
});

test.afterAll(async () => {
	if (!app) return;
	try {
		await setMobile(app.page, false);
		await app.page.evaluate(async (folder) => {
			document.body.style.removeProperty('--keyboard-height');
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

async function openDuePickerOnLastVisibleCard(page: Page): Promise<void> {
	await page.evaluate(async (path) => {
		const host = (window as any).app;
		await host.workspace.getLeaf(false).openFile(host.vault.getAbstractFileByPath(path));
	}, `${folder}/list.base`);
	const dates = page.locator('.workspace-leaf.mod-active .task-card__metadata-date--due');
	await expect(dates.first()).toBeVisible();
	const viewportHeight = await page.evaluate(() => innerHeight);
	const count = await dates.count();
	for (let index = count - 1; index >= 0; index--) {
		const box = await dates.nth(index).boundingBox();
		if (box && box.y + box.height < viewportHeight - 80) {
			await dates.nth(index).click();
			break;
		}
	}
	await expect(page.locator('.tn-picker')).toBeVisible();
}

test('mobile pickers open as a sheet without focusing search, and stay above the keyboard', async () => {
	const { page } = app;
	await setMobile(page, true);
	await openDuePickerOnLastVisibleCard(page);

	const picker = page.locator('.tn-picker');
	await expect(picker).toHaveClass(/tn-popover--sheet/);
	expect(await page.evaluate(() => document.activeElement?.classList.contains('tn-picker__input'))).toBe(false);

	await page.evaluate((height) => document.body.style.setProperty('--keyboard-height', `${height}px`), KEYBOARD);
	await page.locator('.tn-picker__input').click();
	const reach = await page.evaluate(async (keyboard) => {
		const sheet = document.querySelector<HTMLElement>('.tn-picker')!;
		const list = sheet.querySelector<HTMLElement>('.tn-picker__list')!;
		list.scrollTop = list.scrollHeight;
		await new Promise((resolve) => setTimeout(resolve, 100));
		const rows = Array.from(list.querySelectorAll<HTMLElement>('.tn-picker__row'));
		return {
			keyboardTop: innerHeight - keyboard,
			sheetBottom: sheet.getBoundingClientRect().bottom,
			lastRow: rows[rows.length - 1].textContent,
			lastRowBottom: rows[rows.length - 1].getBoundingClientRect().bottom,
		};
	}, KEYBOARD);
	expect(reach.lastRow).toBe('Clear');
	expect(reach.sheetBottom).toBeLessThanOrEqual(reach.keyboardTop + 1);
	expect(reach.lastRowBottom).toBeLessThanOrEqual(reach.keyboardTop);
	await page.keyboard.press('Escape');
	await page.evaluate(() => document.body.style.removeProperty('--keyboard-height'));
});

test('desktop pickers stay anchored and keep keyboard focus in search', async () => {
	const { page } = app;
	await setMobile(page, false);
	await openDuePickerOnLastVisibleCard(page);
	await expect(page.locator('.tn-picker')).not.toHaveClass(/tn-popover--sheet/);
	await expect(page.locator('.tn-picker__input')).toBeFocused();
	await page.keyboard.press('Escape');
});
