import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Issue #2486: a collapsed Kanban column should still show its icon and title.
let instance: ObsidianApp;
let page: Page;
const folder = `CollapsedLabel2486-${Date.now()}`;
const basePath = `${folder}/Board.base`;
const longLabel = 'Waiting for a reply from the external review team';
const column = (key: string) => page.locator(`.kanban-view__column[data-group="${key}"]`);
const toggle = (key: string) => column(key).locator('.kanban-view__column-collapse-button');

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, longLabel }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.customStatuses = [
      { value: 'open', label: 'Open', icon: 'circle', color: '#2563eb' },
      { value: 'waiting', label: longLabel, icon: 'hourglass', color: '#d97706' },
    ].map((status, order) => ({ ...status, id: status.value, isCompleted: false, order }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    await app.vault.createFolder(folder);
    for (const [name, status] of [['Alpha', 'open'], ['Beta', 'waiting']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\nstatus: ${status}\n---\n`);
    }
  }, { folder, longLabel });
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesKanban', name: 'Board', groupBy: { property: 'status', direction: 'ASC' },
      consolidateStatusIcon: true }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: basePath, content });
  await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(2);
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
      document.body.dir = '';
      document.body.classList.remove('mod-rtl');
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

test('collapsed columns keep their icon and a vertical, truncated title', async () => {
  for (const key of ['open', 'waiting']) {
    if (await toggle(key).getAttribute('aria-expanded') === 'true') await toggle(key).click();
    await expect(toggle(key)).toHaveAttribute('aria-expanded', 'false');
  }
  for (const rtl of [false, true]) {
    await page.evaluate(rtl => {
      document.body.dir = rtl ? 'rtl' : '';
      document.body.classList.toggle('mod-rtl', rtl);
    }, rtl);
    for (const key of ['open', 'waiting']) {
      const col = column(key);
      const icon = col.locator('.kanban-view__column-icon');
      const title = col.locator('.kanban-view__column-title');
      await expect(icon).toBeVisible();
      await expect(title).toBeVisible();
      await expect(title).toHaveCSS('writing-mode', 'vertical-rl');
      const [colBox, iconBox, titleBox] = await Promise.all(
        [col, icon, title].map(locator => locator.boundingBox())
      );
      // Icon above the title, and both inside the narrow strip.
      expect(iconBox!.y + iconBox!.height).toBeLessThanOrEqual(titleBox!.y + 1);
      for (const box of [iconBox!, titleBox!]) {
        expect(box.x).toBeGreaterThanOrEqual(colBox!.x);
        expect(box.x + box.width).toBeLessThanOrEqual(colBox!.x + colBox!.width + 0.5);
      }
      expect(titleBox!.height).toBeGreaterThan(20);
      // Reads top to bottom: the first letter sits at the top of the title box.
      const firstLetterTop = await title.evaluate(el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const node = walker.nextNode()!;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, 1);
        return range.getBoundingClientRect().top - el.getBoundingClientRect().top;
      });
      expect(firstLetterTop).toBeLessThan(12);
    }
    // Long titles are cut off with an ellipsis instead of stretching the board.
    const long = column('waiting').locator('.kanban-view__column-title');
    expect(await long.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect(long).toHaveCSS('text-overflow', 'ellipsis');
    await page.screenshot({ path: `test-results/issue-2486-${rtl ? 'rtl' : 'ltr'}.png` });
  }
});
