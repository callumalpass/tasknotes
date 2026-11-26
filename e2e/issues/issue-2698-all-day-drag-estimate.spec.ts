import { expect, test } from '@playwright/test';
import { closeObsidian, launchObsidian, setObsidianViewport } from '../obsidian';

for (const [title, estimate, end] of [['Estimated task', 30, '10:30'], ['Unestimated task', undefined, '11:00']] as const) {
	test(`all-day drag preview for ${title.toLowerCase()} matches the timed task after drop`, async ({}, testInfo) => {
		const { page, ...instance } = await launchObsidian();
		const folder = `Issue2698-${Date.now()}`;
		try {
			await setObsidianViewport(page, { width: 1200, height: 850 });
			const day = await page.evaluate(async ({ folder, title, estimate }) => {
				const app = (window as any).app;
				const date = (window as any).moment().format('YYYY-MM-DD');
				app.workspace.leftSplit.collapse();
				app.workspace.rightSplit.collapse();
				await app.vault.createFolder(folder);
				const estimateField = estimate === undefined ? '' : `timeEstimate: ${estimate}\n`;
				await app.vault.create(`${folder}/${title}.md`, `---\ntags: [task]\nstatus: open\nscheduled: ${date}\n${estimateField}---\n`);
				const base = await app.vault.create(`${folder}/Calendar.base`, JSON.stringify({
					filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
					views: [{
						type: 'tasknotesCalendar', name: 'Calendar', calendarView: 'timeGridWeek', initialDate: date,
						showScheduled: true, showDue: false, showTimeblocks: false, showAllDaySlot: true,
						slotMinTime: '08:00:00', slotMaxTime: '16:00:00', scrollTime: '08:00:00', timeFormat: '24',
					}],
				}));
				await app.workspace.getLeaf(true).openFile(base);
				return date;
			}, { folder, title, estimate });

			const calendar = page.locator('.workspace-leaf.mod-active .tnc');
			const column = calendar.locator(`.tnc-col[data-date="${day}"]`);
			await expect(column).toBeVisible();
			const source = calendar.locator(`.tnc-allday-layer .tnc-item[data-task-path="${folder}/${title}.md"]`);
			await expect(source).toBeVisible();
			const origin = (await source.boundingBox())!;
			const target = (await column.boundingBox())!;
			const start = '10:00';
			const minutesFromStart = 2 * 60 + 6;
			await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2);
			await page.mouse.down();
			await page.mouse.move(target.x + target.width / 2, target.y + target.height * minutesFromStart / (8 * 60), { steps: 12 });
			const timed = column.locator(`.tnc-item--timed[data-task-path="${folder}/${title}.md"]`);
			const preview = timed.locator('.tnc-item-time');
			await expect(preview).toContainText(start);
			await page.screenshot({ path: testInfo.outputPath(`${title}-preview.png`) });
			await expect.soft(preview).toHaveText(`${start} – ${end}`, { timeout: 1500 });
			await page.mouse.up();
			await expect.poll(() => page.evaluate(async ({ folder, title }) => {
				const vault = (window as any).app.vault;
				return vault.read(vault.getAbstractFileByPath(`${folder}/${title}.md`));
			}, { folder, title })).toContain(`${day}T${start}`);
			await expect(timed.locator('.tnc-item-time')).toHaveText(`${start} – ${end}`);
		} finally {
			try {
				await page.keyboard.press('Escape');
				await page.mouse.up();
				await page.evaluate(async folder => {
					const vault = (window as any).app.vault;
					const fixture = vault.getAbstractFileByPath(folder);
					if (fixture) await vault.delete(fixture, true);
				}, folder);
			} finally {
				await closeObsidian({ page, ...instance });
			}
		}
	});
}
