/**
 * Issue #2626: since 5.0 an empty Task List showed "No tasks match this view. Review its
 * filters." with Filters and New buttons in a tall block, which crowded notes with several
 * embedded views. When the vault has tasks, an empty view is now one compact line and the
 * toolbar keeps Filter and New.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2626
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2626-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1200, height: 900 });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    // A task in the vault, so the views below are empty because nothing matches, not because
    // there are no tasks at all.
    await app.vault.create(`${folder}/Done task.md`, '---\ntags: [task]\ntitle: Done task\nstatus: done\n---\n');
    const base = (type: string) => `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\n    - status != "done"\nviews:\n  - type: ${type}\n    name: Open\n${type === 'tasknotesKanban' ? '    groupBy:\n      property: status\n      direction: ASC\n' : ''}`;
    await app.vault.create(`${folder}/List.base`, base('tasknotesTaskList'));
    await app.vault.create(`${folder}/Board.base`, base('tasknotesKanban'));
    const note = await app.vault.create(`${folder}/Note.md`, `# Note\n\n![[${folder}/List.base]]\n\n![[${folder}/Board.base]]\n`);
    await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'preview' } });
  }, folder);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

test('embedded empty Task List and Kanban views show one compact line', async () => {
  const empties = page.locator('.workspace-leaf.mod-active .internal-embed.bases-embed .tn-empty');
  await expect(empties).toHaveCount(2, { timeout: 15000 });
  for (const empty of await empties.all()) {
    await expect(empty).toHaveText('No tasks match this view.');
    await expect(empty.locator('button')).toHaveCount(0);
    // One line of text plus 12px padding above and below (it was about 140px with the buttons).
    const height = await empty.evaluate(element => element.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(48);
  }
  await page.locator('.workspace-leaf.mod-active').screenshot({ path: 'test-results/issue-2626-compact-empty.png' });
});
