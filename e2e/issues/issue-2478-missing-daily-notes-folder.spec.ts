import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A Daily Notes "New file location" that does not exist in the vault must not
 * stop TaskNotes' lazy service initialization. Startup timeblock sync listed
 * daily notes with getAllDailyNotes(), which throws when the folder is missing,
 * and the throw skipped every later service, including Instant Task Convert:
 * no convert button, and the command said the service was unavailable.
 */

let app: ObsidianApp;
const VAULT_DIR = path.resolve(
	process.env.TASKNOTES_E2E_VAULT_DIR ?? path.join(__dirname, '..', '..', 'tasknotes-e2e-vault')
);
const DAILY_NOTES_CONFIG = path.join(VAULT_DIR, '.obsidian', 'daily-notes.json');
const MISSING_FOLDER = 'e2e-missing-daily-notes-2478';
const NOTE_PATH = 'e2e-issue-2478-checkbox.md';

let originalConfig: string | null = null;

test.beforeAll(async () => {
	originalConfig = fs.existsSync(DAILY_NOTES_CONFIG)
		? fs.readFileSync(DAILY_NOTES_CONFIG, 'utf8')
		: null;
	fs.rmSync(path.join(VAULT_DIR, MISSING_FOLDER), { recursive: true, force: true });
	fs.writeFileSync(DAILY_NOTES_CONFIG, JSON.stringify({ folder: MISSING_FOLDER }));
	app = await launchObsidian();
});

test.afterAll(async () => {
	if (app) {
		await app.page
			.evaluate(async (notePath) => {
				const w = window as any;
				const file = w.app.vault.getAbstractFileByPath(notePath);
				if (file) await w.app.vault.delete(file);
			}, NOTE_PATH)
			.catch(() => undefined);
		await closeObsidian(app);
	}
	if (originalConfig === null) fs.rmSync(DAILY_NOTES_CONFIG, { force: true });
	else fs.writeFileSync(DAILY_NOTES_CONFIG, originalConfig);
});

test('instant convert loads when the Daily Notes folder is missing', async () => {
	const { page } = app;

	await expect
		.poll(
			() =>
				page.evaluate(() => {
					const w = window as any;
					return w.app.internalPlugins.getPluginById('daily-notes')?.instance?.options?.folder;
				}),
			{ timeout: 10000 }
		)
		.toBe(MISSING_FOLDER);

	await expect
		.poll(
			() =>
				page.evaluate(
					() => !!(window as any).app.plugins.plugins.tasknotes?.instantTaskConvertService
				),
			{ timeout: 15000 }
		)
		.toBe(true);

	await page.evaluate(async (notePath) => {
		const w = window as any;
		const existing = w.app.vault.getAbstractFileByPath(notePath);
		const file = existing ?? (await w.app.vault.create(notePath, '- [ ] Buy milk\n'));
		const leaf = w.app.workspace.getLeaf(false);
		await leaf.openFile(file, { state: { mode: 'source' } });
		w.app.workspace.setActiveLeaf(leaf, { focus: true });
	}, NOTE_PATH);

	const editor = page.locator('.workspace-leaf.mod-active .markdown-source-view');
	await expect(editor).toContainText('Buy milk', { timeout: 10000 });
	await expect(editor.locator('.instant-convert-button')).toBeVisible({ timeout: 10000 });
});
