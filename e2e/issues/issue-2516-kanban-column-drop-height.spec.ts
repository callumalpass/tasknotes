import { test, expect, type Locator, type Page } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const folder = `KanbanDropHeight-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let originalSettings: any;
const column = (status: string) => page.locator(`.kanban-view__column[data-group="${status}"]`);
const card = (name: string) => page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${name}.md"]`);

async function status(name: string): Promise<string> {
  const text = await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, `${folder}/${name}.md`);
  return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]).status;
}

async function dragToColumn(name: string, targetStatus: string, belowCards = true) {
  let from: Awaited<ReturnType<Locator['boundingBox']>> = null;
  let header: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect(async () => {
    await expect(card(name)).toBeVisible();
    await card(name).scrollIntoViewIfNeeded();
    from = await card(name).boundingBox();
    header = await column(targetStatus).locator('.kanban-view__column-header').boundingBox();
    expect(from).not.toBeNull();
    expect(header).not.toBeNull();
  }).toPass({ timeout: 5000 });
  // Aim at the column's lower body, not its header, add button or existing card.
  // Before the fix this point belongs to the board rather than the short column.
  const x = header!.x + header!.width / 2;
  const y = belowCards ? header!.y + header!.height + 250 : header!.y + header!.height / 2;
  await page.mouse.move(from!.x + from!.width / 2, from!.y + 15);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + 15, { steps: 4 });
  await page.mouse.move(x, y, { steps: 25 });
  await page.mouse.up();
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  originalSettings = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      customStatuses: plugin.settings.customStatuses,
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
    };
    plugin.settings.customStatuses = ['open', 'short', 'empty'].map((value, order) => ({
      id: value, value, label: value, color: '#808080', isCompleted: false, order,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    const tasks = [['Alpha', 'open'], ['Beta', 'short'],
      ...Array.from({ length: 25 }, (_, index) => [`Filler ${index + 1}`, 'open'])];
    for (const [name, value] of tasks) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name}\nstatus: ${value}\ntags: [task]\n---\n`);
    }
    return original;
  }, folder);
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, {
    path: `${folder}/Board.base`,
    content: stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{
        type: 'tasknotesKanban', name: 'Drop targets',
        groupBy: { property: 'status', direction: 'ASC' },
        sort: [{ property: 'file.name', direction: 'ASC' }],
        columnWidth: 280, hideEmptyColumns: false,
      }],
    }),
  });
  await expect(card('Alpha')).toBeVisible();
  await expect(card('Beta')).toBeVisible();
  await expect(column('empty')).toBeVisible();
});

test.afterAll(async () => {
  try {
    if (originalSettings && page && !page.isClosed()) {
      await page.evaluate(async ({ folder, originalSettings }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins.tasknotes;
        Object.assign(plugin.settings, originalSettings);
        plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
        const fixture = app.vault.getAbstractFileByPath(folder);
        if (fixture) await app.vault.delete(fixture, true);
      }, { folder, originalSettings });
    }
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

test('lower column bodies accept drops while collapse and independent scrolling still work', async ({}, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('columns-before-drag.png') });

  await test.step('control: drops on column headers persist status', async () => {
    await dragToColumn('Beta', 'empty', false);
    await expect.poll(() => status('Beta')).toBe('empty');
    await expect(column('empty').locator(card('Beta'))).toBeVisible();
    await dragToColumn('Beta', 'short', false);
    await expect.poll(() => status('Beta')).toBe('short');
    await expect(column('short').locator(card('Beta'))).toBeVisible();
  });

  await test.step('drop below the empty-state hint persists status', async () => {
    await dragToColumn('Alpha', 'empty');
    await expect.poll(() => status('Alpha')).toBe('empty');
    await expect(column('empty').locator(card('Alpha'))).toBeVisible();
  });

  await test.step('drop below the last card in a short column persists status', async () => {
    await dragToColumn('Alpha', 'short');
    await expect.poll(() => status('Alpha')).toBe('short');
    await expect(column('short').locator(card('Alpha'))).toBeVisible();
  });

  await test.step('collapsed columns keep their compact layout', async () => {
    const toggle = column('empty').locator('.kanban-view__column-collapse-button');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(column('empty')).toHaveCSS('width', '48px');
    await expect(column('empty').locator('.kanban-view__cards')).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  await test.step('a long column scrolls without moving adjacent columns', async () => {
    const cards = column('open').locator('.kanban-view__cards');
    await expect.poll(() => cards.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
    await cards.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => cards.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await column('short').locator('.kanban-view__cards').evaluate(el => el.scrollTop)).toBe(0);
  });

  await page.screenshot({ path: testInfo.outputPath('columns-after-drag.png') });
});
