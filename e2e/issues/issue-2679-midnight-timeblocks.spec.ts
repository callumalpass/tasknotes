import { expect, test } from '@playwright/test';
import { closeObsidian, launchObsidian } from '../obsidian';

test('Alt-drag timeblocks ending at midnight stay on the selected day', async () => {
	const app = await launchObsidian();
	const { page } = app;
	const folder = `issue-2679-${Date.now()}`;
	const basePath = `${folder}/Calendar.base`;
	const cases = [
		{ day: '2026-11-24', minutes: 60, startTime: '23:00' },
		{ day: '2026-11-25', minutes: 30, startTime: '23:30' },
		{ day: '2026-11-26', minutes: 15, startTime: '23:45' },
	];
	const original = await page.evaluate(() => {
		const app = (window as any).app;
		const { options } = app.internalPlugins.getEnabledPluginById('daily-notes');
		return { folder: options.folder, format: options.format };
	});
	try {
		await page.evaluate(async ({ folder, basePath, days }) => {
			const app = (window as any).app;
			app.workspace.leftSplit.collapse();
			app.workspace.rightSplit.collapse();
			const { options } = app.internalPlugins.getEnabledPluginById('daily-notes');
			Object.assign(options, { folder, format: 'YYYY-MM-DD' });
			await app.vault.createFolder(folder);
			for (const day of days) await app.vault.create(`${folder}/${day}.md`, '');
			const base = await app.vault.create(basePath, `filters:
  and:
    - file.inFolder("${folder}")
views:
  - type: tasknotesCalendar
    name: Midnight timeblocks
    calendarView: timeGridWeek
    initialDate: '${days[0]}'
    showTimeblocks: true
    slotMinTime: '00:00:00'
    slotMaxTime: '24:00:00'
    slotDuration: '00:15:00'
    slotHeight: 20
`);
			await app.workspace.getLeaf('tab').openFile(base);
		}, { folder, basePath, days: cases.map(({ day }) => day) });

		const calendar = page.locator('.workspace-leaf.mod-active .tnc');
		await calendar.locator('.tnc-tg').evaluate(async grid => {
			await Promise.all(grid.getAnimations()
				.filter(animation => animation instanceof CSSAnimation && animation.animationName === 'tn-calendar-view-enter')
				.map(animation => animation.finished.catch(() => {})));
		});
		const modal = page.locator('.timeblock-creation-modal');
		for (const { day, minutes, startTime } of cases) {
			await test.step(`${minutes}-minute timeblock ending at midnight`, async () => {
				const title = `Midnight ${minutes} minutes`;
				const column = calendar.locator(`.tnc-col[data-date="${day}"]`);
				const { x, startY, endY } = await column.evaluate((element, minutes) => {
					const scroller = element.closest('.tnc-tg-scroll')!;
					scroller.scrollTop = scroller.scrollHeight;
					const box = element.getBoundingClientRect();
					return {
						x: box.x + box.width / 2,
						startY: box.bottom - (box.height * minutes) / (24 * 60) + 2,
						endY: box.bottom - 2,
					};
				}, minutes);
				await page.mouse.move(x, startY);
				await page.keyboard.down('Alt');
				await page.mouse.down();
				await page.mouse.move(x, endY, { steps: 5 });
				await page.mouse.up();
				await page.keyboard.up('Alt');
				await page.getByText('Create timeblock', { exact: true }).click({ timeout: 5000 });
				await modal.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
				await modal.locator('.timeblock-create-button').click();
				await expect(modal).toBeHidden();

				const notePath = `${folder}/${day}.md`;
				await expect.poll(() => page.evaluate(path => {
					const app = (window as any).app;
					return app.metadataCache.getCache(path)?.frontmatter?.timeblocks;
				}, notePath)).toEqual([expect.objectContaining({ title, startTime, endTime: '00:00' })]);
				const segments = calendar.locator('.tnc-item[data-event-type="timeblock"]', { hasText: title });
				await expect(column.locator('.tnc-item[data-event-type="timeblock"]', { hasText: title })).toBeVisible();
				const renderedDays = await segments.evaluateAll(elements =>
					elements.map(element => element.closest('.tnc-col')?.getAttribute('data-date'))
				);
				expect.soft(renderedDays).toEqual([day]);
			});
		}
	} finally {
		try {
			await page.evaluate(async ({ original, folder, basePath }) => {
				const app = (window as any).app;
				const { options } = app.internalPlugins.getEnabledPluginById('daily-notes');
				Object.assign(options, original);
				for (const leaf of app.workspace.getLeavesOfType('bases')) {
					if (leaf.view.file?.path === basePath) leaf.detach();
				}
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			}, { original, folder, basePath });
		} finally {
			await closeObsidian(app);
		}
	}
});
