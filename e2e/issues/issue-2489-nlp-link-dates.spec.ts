import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

/**
 * Issue #2489: converting `- [ ] review [[2026-11-03 Meeting with Jane]]` took
 * the date from inside the wikilink. Text inside links and inline code is part
 * of the markup and must not become a date, tag, context or status, while a
 * trigger before a link (`+[[project]]`) still applies.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2489
 */

let app: ObsidianApp;
const NOTE_PATH = 'e2e-issue-2489-inline.md';
const LINK = '[[2026-11-03 Meeting with Jane]]';
let originalDefaultScheduled: string | undefined;

test.beforeAll(async () => {
	app = await launchObsidian();
	await expect
		.poll(
			() =>
				app.page.evaluate(
					() => !!(window as any).app.plugins.plugins.tasknotes?.instantTaskConvertService
				),
			{ timeout: 15000 }
		)
		.toBe(true);
	// No default scheduled date, so any scheduled date comes from the text.
	originalDefaultScheduled = await app.page.evaluate(() => {
		const defaults = (window as any).app.plugins.plugins.tasknotes.settings.taskCreationDefaults;
		const original = defaults.defaultScheduledDate;
		defaults.defaultScheduledDate = 'none';
		return original;
	});
});

test.afterAll(async () => {
	if (app) {
		await app.page
			.evaluate(async ({ notePath, original }) => {
				const w = window as any;
				w.app.plugins.plugins.tasknotes.settings.taskCreationDefaults.defaultScheduledDate = original;
				const file = w.app.vault.getAbstractFileByPath(notePath);
				if (file) await w.app.vault.delete(file);
			}, { notePath: NOTE_PATH, original: originalDefaultScheduled })
			.catch(() => undefined);
		await closeObsidian(app);
	}
});

async function convertInline(line: string): Promise<{ frontmatter: Record<string, unknown>; basename: string }> {
	return app.page.evaluate(async ({ notePath, line }) => {
		const w = window as any;
		const plugin = w.app.plugins.plugins.tasknotes;
		const existing = w.app.vault.getAbstractFileByPath(notePath);
		if (existing) await w.app.vault.delete(existing);
		const file = await w.app.vault.create(notePath, `${line}\n`);
		const leaf = w.app.workspace.getLeaf(false);
		await leaf.openFile(file, { state: { mode: 'source' } });
		w.app.workspace.setActiveLeaf(leaf, { focus: true });
		const before = new Set(w.app.vault.getMarkdownFiles().map((f: any) => f.path));
		await plugin.instantTaskConvertService.instantConvertTask(w.app.workspace.activeEditor.editor, 0);
		const deadline = Date.now() + 5000;
		let created: any;
		while (!created && Date.now() < deadline) {
			await new Promise((r) => setTimeout(r, 100));
			created = w.app.vault.getMarkdownFiles().find((f: any) => !before.has(f.path));
		}
		if (!created) throw new Error(`No task was created for ${line}`);
		let frontmatter: Record<string, unknown> = {};
		await w.app.fileManager.processFrontMatter(created, (fm: Record<string, unknown>) => {
			frontmatter = { ...fm };
		});
		const basename = created.basename;
		await w.app.vault.delete(created);
		return { frontmatter, basename };
	}, { notePath: NOTE_PATH, line });
}

test('inline convert keeps dates, tags and statuses inside links as text', async () => {
	const reported = await convertInline(`- [ ] review ${LINK}`);
	expect(reported.frontmatter.scheduled).toBeUndefined();
	expect(reported.frontmatter.due).toBeUndefined();
	expect(reported.basename).toContain('2026-11-03 Meeting with Jane');

	const markup = await convertInline(
		'- [ ] check [[Project#Next steps *done]] and [notes 2026-11-03](<2026-11-03 notes.md>) `@ctx`'
	);
	expect(markup.frontmatter.scheduled).toBeUndefined();
	expect(markup.frontmatter.status).toBe('open');
	expect(markup.frontmatter.contexts).toBeUndefined();
	expect(markup.frontmatter.tags).toEqual(['task']);
});

test('inline convert still reads a project link and a date outside it', async () => {
	const { frontmatter } = await convertInline(`- [ ] review +${LINK} tomorrow`);
	expect(frontmatter.projects).toEqual([LINK]);
	expect(frontmatter.scheduled).toEqual(expect.any(String));
	expect(frontmatter.scheduled).not.toBe('2026-11-03');
});

test('the JS API and the create modal leave link dates alone', async () => {
	const { page } = app;
	const parsed = await page.evaluate(
		(input) => (window as any).app.plugins.plugins.tasknotes.api.parseNaturalLanguage(input),
		`review ${LINK}`
	);
	expect(parsed.title).toBe(`review ${LINK}`);
	expect(parsed.scheduledDate).toBeUndefined();

	await runCommand(page, 'TaskNotes: Create new task');
	const modal = page.locator('.modal-container .modal').last();
	const nlpInput = modal.locator('.cm-editor .cm-content').first();
	await expect(nlpInput).toBeVisible({ timeout: 5000 });
	await nlpInput.click();
	await page.keyboard.insertText(`review ${LINK} tomorrow`);
	// Only "tomorrow" is highlighted as a recognised value.
	await expect(modal.locator('.cm-content .tn-nlp-highlight')).toHaveText(['tomorrow'], { timeout: 5000 });
	await page.keyboard.press('Escape');
});
