import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../obsidian';
import { parse } from 'yaml';

for (const attachment of ['[[Issue 2481 task]]', '[[Issue 2481 task.md]]']) {
	test(`saving a timeblock preserves ${attachment}`, async ({}, testInfo) => {
		const app = await launchObsidian();
		const page = app.page;
		const taskPath = 'Issue 2481 task.md';
		const basePath = 'TaskNotes/Views/issue-2481.base';
		const notePath = await page.evaluate(() => {
			const d = new Date();
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`;
		});
		const original = await page.evaluate(async (path) => {
			const w = window as any;
			const file = w.app.vault.getAbstractFileByPath(path);
			return {
				note: file ? await w.app.vault.read(file) : null,
				timeblocking:
					w.app.plugins.plugins.tasknotes.settings.calendarViewSettings
						.enableTimeblocking,
			};
		}, notePath);
		try {
			await page.evaluate(
				async ({ taskPath, basePath, notePath, attachment }) => {
					const w = window as any;
					w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking = true;
					await w.app.vault.create(taskPath, '# Issue 2481 task\n');
					const text = `---\ntimeblocks:\n  - id: tb-link-regression\n    title: Attachment regression\n    startTime: "09:00"\n    endTime: "10:00"\n    attachments:\n      - ${JSON.stringify(attachment)}\n---\nDaily body\n`;
					const existing = w.app.vault.getAbstractFileByPath(notePath);
					if (existing) await w.app.vault.modify(existing, text);
					else await w.app.vault.create(notePath, text);
					await w.app.vault.create(
						basePath,
						'views:\n  - type: tasknotesCalendar\n    name: Links\n    calendarView: timeGridDay\n    showTimeblocks: true\n    scrollTime: 08:00:00\n'
					);
					await w.app.workspace
						.getLeaf(true)
						.openFile(w.app.vault.getAbstractFileByPath(basePath));
				},
				{ taskPath, basePath, notePath, attachment }
			);
			await expect
				.poll(() =>
					page.evaluate(
						() =>
							(window as any).app.metadataCache.getFirstLinkpathDest(
								'Issue 2481 task',
								''
							)?.path
					)
				)
				.toBe(taskPath);
			await page
				.locator('.tnc:visible .tnc-item', { hasText: 'Attachment regression' })
				.first()
				.click();
			const modal = page.locator('.timeblock-info-modal');
			await expect(modal.locator('.timeblock-attachment-item')).toHaveCount(1);
			await page.screenshot({ path: testInfo.outputPath('attachment-before-save.png') });
			await modal.locator('.timeblock-save-button').click();
			await expect(modal).toBeHidden();
			const content = await page.evaluate(
				(path) => (window as any).app.vault.adapter.read(path),
				notePath
			);
			const frontmatter = parse(content.split('---')[1]);
			expect(frontmatter.timeblocks[0].attachments).toEqual([attachment]);
			expect(content).toContain('Daily body');
			await testInfo.attach('saved-daily-note', { body: content, contentType: 'text/plain' });
		} finally {
			try {
				await page.keyboard.press('Escape');
				await page.evaluate(
					async ({ taskPath, basePath, notePath, original }) => {
						const w = window as any;
						w.app.plugins.plugins.tasknotes.settings.calendarViewSettings.enableTimeblocking =
							original.timeblocking;
						w.app.workspace.getLeaf()?.detach();
						for (const path of [
							taskPath,
							basePath,
							...(original.note === null ? [notePath] : []),
						]) {
							const file = w.app.vault.getAbstractFileByPath(path);
							if (file) await w.app.vault.delete(file);
						}
						if (original.note !== null) {
							await w.app.vault.modify(
								w.app.vault.getAbstractFileByPath(notePath),
								original.note
							);
						}
					},
					{ taskPath, basePath, notePath, original }
				);
			} finally {
				await closeObsidian(app);
			}
		}
	});
}
