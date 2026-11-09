import { test, expect, type Page } from '@playwright/test';
import { stringify, parse } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Issue #2484: collapsed Kanban columns expanded again after Obsidian reloaded.
let instance: ObsidianApp;
let page: Page;
const folder = `Collapse2484-${Date.now()}`;
const basePath = `${folder}/Board.base`;
const toggle = (key: string) =>
  page.locator(`.kanban-view__column[data-group="${key}"] .kanban-view__column-collapse-button`);

async function openBoard() {
  await page.waitForFunction(() => (window as any).app?.plugins?.plugins?.tasknotes?.statusManager);
  await page.evaluate(async path => {
    const app = (window as any).app;
    // Services can be ready before Obsidian has restored its workspace after reload.
    await new Promise<void>(resolve => app.workspace.onLayoutReady(resolve));
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, basePath);
  await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(2);
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesKanban', name: 'Board', groupBy: { property: 'status', direction: 'ASC' } }],
  });
  await page.evaluate(async ({ folder, basePath, content }) => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (const [name, status] of [['Alpha', 'open'], ['Beta', 'done']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\nstatus: ${status}\n---\n`);
    }
    await app.vault.create(basePath, content);
  }, { folder, basePath, content });
  await openBoard();
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

const readCollapsed = async () => {
  const yaml = await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, basePath);
  return JSON.parse(parse(yaml).views[0].collapsedColumns ?? '{}');
};

test('collapsed columns stay collapsed after the app reloads', async () => {
  test.setTimeout(120_000);
  await toggle('open').click();
  await expect(toggle('open')).toHaveAttribute('aria-expanded', 'false');
  // Bases writes view config to the .base file shortly after the change.
  await expect.poll(readCollapsed).toEqual({ 'note.status': ['open'] });

  await page.reload();
  await openBoard();
  await expect(toggle('open')).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle('done')).toHaveAttribute('aria-expanded', 'true');

  await toggle('open').click();
  await expect.poll(readCollapsed).toEqual({});
  await page.reload();
  await openBoard();
  await expect(toggle('open')).toHaveAttribute('aria-expanded', 'true');
});
