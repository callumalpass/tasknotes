/**
 * Issue #2413: reminders that came due while Obsidian was closed are shown on startup.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2413
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

const CURSOR_KEY = 'tasknotes-reminder-scan-cursor';
const FOLDER = 'TaskNotes/Tasks/issue-2413';

let app: ObsidianApp | undefined;
let originalNotificationType: string | undefined;

async function evalPlugin<T>(page: Page, fn: string): Promise<T> {
	return page.evaluate(`(async () => {
		const plugin = app.plugins.plugins.tasknotes;
		${fn}
	})()`) as Promise<T>;
}

/** Writes tasks whose reminders fell due while "closed", and backdates the last scan. */
async function prepareMissedReminders(page: Page, names: string[]): Promise<void> {
	await evalPlugin(page, `
		const pad = (n) => String(n).padStart(2, '0');
		const local = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
			+ 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
		const due = local(new Date(Date.now() + 50 * 60 * 1000));
		const existing = app.vault.getAbstractFileByPath('${FOLDER}');
		if (existing) await app.vault.delete(existing, true);
		await app.vault.createFolder('${FOLDER}');
		for (const name of ${JSON.stringify(names)}) {
			await app.vault.create('${FOLDER}/' + name + '.md', [
				'---',
				'title: ' + name,
				'status: open',
				'due: ' + due,
				'tags:',
				'  - task',
				'reminders:',
				'  - id: rem-' + name,
				'    type: relative',
				'    relatedTo: due',
				'    offset: -PT1H',
				'---',
				'',
			].join('\\n'));
		}
		app.saveLocalStorage('${CURSOR_KEY}', Date.now() - 20 * 60 * 1000);
	`);
}

async function restart(): Promise<Page> {
	if (app) await closeObsidian(app);
	app = await launchObsidian();
	return app.page;
}

test.describe('Issue #2413: missed reminders on startup', () => {
	test.afterAll(async () => {
		if (!app) return;
		await evalPlugin(app.page, `
			const folder = app.vault.getAbstractFileByPath('${FOLDER}');
			if (folder) await app.vault.delete(folder, true);
			${originalNotificationType ? `plugin.settings.notificationType = ${JSON.stringify(originalNotificationType)};` : ''}
			await plugin.saveSettings();
		`);
		await closeObsidian(app);
	});

	test('shows a missed reminder once after restart, and summarises many', async ({}, testInfo) => {
		test.setTimeout(240000);
		let page = await restart();
		await page.waitForFunction(() => (window as any).app?.plugins?.plugins?.tasknotes?.notificationService);
		originalNotificationType = await evalPlugin<string>(page, `
			const original = plugin.settings.notificationType;
			plugin.settings.notificationType = 'in-app';
			await plugin.saveSettings();
			const folder = app.vault.getAbstractFileByPath('${FOLDER}');
			if (folder) await app.vault.delete(folder, true);
			return original;
		`);

		await prepareMissedReminders(page, ['Missed standup']);
		page = await restart();
		await testInfo.attach('startup-reminder-state', {
			body: JSON.stringify(await evalPlugin(page, `
				const service = plugin.notificationService;
				const file = app.vault.getAbstractFileByPath('${FOLDER}/Missed standup.md');
				return {
					now: Date.now(), cursor: app.loadLocalStorage('${CURSOR_KEY}'),
					pending: [...service.unindexedAtStartup], boundary: service.startupCatchUpBoundary,
					queue: service.notificationQueue, processed: [...service.processedReminders],
					metadata: file && app.metadataCache.getFileCache(file),
					task: file && await plugin.cacheManager.getTaskInfo(file.path),
					notices: [...document.querySelectorAll('.notice')].map(el => el.textContent),
				};
			`), null, 2),
			contentType: 'application/json',
		});
		const notice = page.locator('.notice', { hasText: 'Missed reminder' });
		await expect(notice).toHaveCount(1, { timeout: 15000 });
		// The due time may cross midnight; require the actual anchor's day and time.
		const expectedDue = await evalPlugin<string>(page, `
			const file = app.vault.getAbstractFileByPath('${FOLDER}/Missed standup.md');
			const due = new Date(app.metadataCache.getFileCache(file).frontmatter.due);
			const day = due.toDateString() === new Date().toDateString()
				? '' : 'on ' + due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ';
			return 'Missed standup is due ' + day + 'at '
				+ due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		`);
		await expect(notice).toContainText(/Missed reminder \(.+\): /);
		await expect(notice).toContainText(expectedDue);

		// Control: a second restart does not replay it.
		page = await restart();
		await page.waitForTimeout(3000);
		await expect(page.locator('.notice', { hasText: 'Missed' })).toHaveCount(0);

		await prepareMissedReminders(page, ['Missed a', 'Missed b', 'Missed c', 'Missed d']);
		page = await restart();
		const summary = page.locator('.notice .tasknotes-missed-reminders');
		await expect(summary).toContainText('4 missed TaskNotes reminders', { timeout: 15000 });
		await expect(page.locator('.notice', { hasText: 'Missed reminder' })).toHaveCount(0);

		await summary.locator('.tasknotes-missed-reminders__task', { hasText: 'Missed c' }).click();
		await expect(page.locator('.workspace-leaf.mod-active .inline-title')).toHaveText('Missed c');
		await expect(summary).toHaveCount(0);
	});

	test('catches up tasks written while closed even with a large metadata indexing backlog', async () => {
		test.setTimeout(240000);
		const page = app?.page ?? await restart();
		originalNotificationType ??= await evalPlugin<string>(page, `return plugin.settings.notificationType;`);
		const vaultPath = await evalPlugin<string>(page, `
			const folder = app.vault.getAbstractFileByPath('${FOLDER}');
			if (folder) await app.vault.delete(folder, true);
			plugin.settings.notificationType = 'in-app';
			await plugin.saveSettings();
			app.saveLocalStorage('${CURSOR_KEY}', Date.now() - 20 * 60 * 1000);
			return app.vault.adapter.basePath;
		`);
		const expectedVault = path.resolve(process.env.TASKNOTES_E2E_VAULT_DIR
			?? path.join(__dirname, '../../tasknotes-e2e-vault'));
		expect(path.resolve(vaultPath)).toBe(expectedVault);
		await closeObsidian(app!);
		app = undefined;

		// Offline writes reproduce sync arriving before Obsidian has indexed the vault.
		const folder = path.join(vaultPath, FOLDER);
		fs.mkdirSync(folder, { recursive: true });
		for (let i = 0; i < 4000; i++) {
			fs.writeFileSync(path.join(folder, `index-backlog-${i}.md`), `Index backlog ${i}\n`);
		}
		const missedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		for (const name of ['Offline a', 'Offline b', 'Offline c', 'Offline d']) {
			fs.writeFileSync(path.join(folder, `${name}.md`), [
				'---', `title: ${name}`, 'status: open', 'tags: [task]', 'reminders:',
				`  - id: ${name}`, '    type: absolute', `    absoluteTime: ${missedAt}`,
				'---', '',
			].join('\n'));
		}
		const restartedPage = await restart();
		const summary = restartedPage.locator('.notice .tasknotes-missed-reminders');
		await expect(summary).toContainText('4 missed TaskNotes reminders', { timeout: 30000 });
		await expect(summary.locator('.tasknotes-missed-reminders__task')).toHaveCount(4);
	});
});
