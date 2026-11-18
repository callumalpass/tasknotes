/**
 * Issue #2587 (regression of #765): a TaskNotes Base embedded in a note in the
 * right sidebar kept the note's side margins, so task cards lost about 60px of
 * width. 4.8.0 reclaimed those margins in both side panes; a 5.0 CSS cleanup
 * dropped the right-pane selector. Live Preview embeds now get the same space.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2587
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const stamp = Date.now();
const basePath = `Issue2587-${stamp}.base`;
const notePath = `Issue2587-${stamp}.md`;
const base = 'filters:\n  and:\n    - note.status && note.status != ""\nviews:\n  - type: tasknotesTaskList\n    name: Tasks\n    order:\n      - status\n      - due\n';

let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ basePath, notePath, base }) => {
    const app = (window as any).app;
    await app.vault.create(basePath, base);
    await app.vault.create(notePath, `![[${basePath}]]\n`);
  }, { basePath, notePath, base });
});

test.afterAll(async () => {
  if (!instance) return;
  await page.evaluate(async paths => {
    const app = (window as any).app;
    (window as any).__issue2587Leaf?.detach();
    for (const path of paths) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file) await app.vault.delete(file);
    }
  }, [notePath, basePath]);
  await closeObsidian(instance);
});

for (const mode of ['preview', 'source'] as const) {
  test(`embedded task list spans the right sidebar (${mode})`, async () => {
    await page.evaluate(async ({ notePath, mode }) => {
      const app = (window as any).app;
      const leaf = (window as any).__issue2587Leaf ?? app.workspace.getRightLeaf(false);
      (window as any).__issue2587Leaf = leaf;
      app.workspace.rightSplit.expand();
      await leaf.openFile(app.vault.getAbstractFileByPath(notePath), { state: { mode, source: false } });
      app.workspace.revealLeaf(leaf);
    }, { notePath, mode });

    const viewSelector = mode === 'preview' ? '.markdown-preview-view' : '.markdown-source-view.is-live-preview';
    const embed = page.locator(`.mod-right-split ${viewSelector} .internal-embed.bases-embed.tasknotes-view-active`);
    await expect(embed.locator('.task-card').first()).toBeVisible();

    const gutters = await page.evaluate(selector => {
      const leaf = (window as any).__issue2587Leaf;
      const content = (leaf.view.contentEl as HTMLElement).getBoundingClientRect();
      const embedEl = leaf.view.contentEl.querySelector(selector) as HTMLElement;
      const box = embedEl.getBoundingClientRect();
      return { left: box.left - content.left, right: content.right - box.right };
    }, `${viewSelector} .internal-embed.bases-embed.tasknotes-view-active`);

    // Only the note's own scrollbar may remain on the right.
    expect(gutters.left).toBeLessThanOrEqual(2);
    expect(gutters.right).toBeGreaterThanOrEqual(-1);
    expect(gutters.right).toBeLessThanOrEqual(16);
  });
}
