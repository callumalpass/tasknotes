import { test, expect, type Locator, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
let page: Page;
let folder: string;
let originalSettings: any;

async function openBase(name: string) {
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, `${folder}/${name}.base`);
}

async function readTasks() {
  return page.evaluate(async folder => {
    const app = (window as any).app;
    return Object.fromEntries(await Promise.all(app.vault.getMarkdownFiles()
      .filter((file: any) => file.parent.path === folder)
      .map(async (file: any) => [file.path, await app.vault.read(file)])));
  }, folder);
}

async function dragBefore(source: Locator, target: Locator) {
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await source.scrollIntoViewIfNeeded();
  await source.hover();
  let previousBounds = '';
  await expect.poll(async () => {
    const current = JSON.stringify(await source.boundingBox());
    const stable = previousBounds === current;
    previousBounds = current;
    return stable;
  }).toBe(true);
  const from = (await source.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 20, { steps: 4 });
  await expect(source).toHaveClass(/kanban-view__card--dragging/);
  await target.scrollIntoViewIfNeeded();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 25 });
  await page.mouse.up();
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  originalSettings = await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const original = {
      customStatuses: plugin.settings.customStatuses,
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
    };
    plugin.settings.customStatuses = ['open', 'waiting'].map((value, order) => ({
      id: value, value, label: value, color: '#808080', isCompleted: false, order,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    return original;
  });
});

test.afterEach(async ({}, testInfo) => {
  if (!page || page.isClosed()) return;
  await page.screenshot({ path: testInfo.outputPath('board.png') });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).setViewState({ type: 'empty' });
    const fixture = app.vault.getAbstractFileByPath(folder);
    if (fixture) await app.vault.delete(fixture, true);
  }, folder);
});

test.afterAll(async () => {
  try {
    if (originalSettings && page && !page.isClosed()) {
      await page.evaluate(original => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        Object.assign(plugin.settings, original);
        plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      }, originalSettings);
    }
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

for (const direction of ['ASC', 'DESC'] as const) {
  test(`${direction}: same-column and cross-column moves preserve other cards and agree with List`, async () => {
    test.setTimeout(90_000);
    folder = `KanbanManualOrder-${direction}-${Date.now()}`;
    const sortField = await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      await app.vault.createFolder(folder);
      const statusField = plugin.fieldMapper.toUserField('status');
      for (const name of ['Alpha', 'Beta', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']) {
        const status = ['Foxtrot', 'Golf', 'Hotel'].includes(name) ? 'waiting' : 'open';
        await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\n${statusField}: ${status}\npriority: normal\n---\n`);
      }
      return plugin.fieldMapper.toUserField('sortOrder');
    }, folder);
    for (const [name, type] of [['Board', 'tasknotesKanban'], ['List', 'tasknotesTaskList']]) {
      const content = stringify({
        filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
        views: [{
          type, name,
          groupBy: { property: 'status', direction: 'ASC' },
          sort: [{ column: sortField, direction }, { column: 'file.name', direction: 'ASC' }],
          columnWidth: 280, hideEmptyColumns: true,
        }],
      });
      await page.evaluate(async ({ path, content }) => {
        await (window as any).app.vault.create(path, content);
      }, { path: `${folder}/${name}.base`, content });
    }
    const path = (name: string) => `${folder}/${name}.md`;
    const card = (name: string) => page.locator(`.kanban-view__card-wrapper[data-task-path="${path(name)}"]`);
    const columnOrder = (status: string) => page.locator(`.kanban-view__column[data-group="${status}"] .kanban-view__card-wrapper`)
      .evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.taskPath));
    const expectBoard = async (open: string[], waiting: string[]) => {
      await expect.poll(() => columnOrder('open')).toEqual(open.map(path));
      await expect.poll(() => columnOrder('waiting')).toEqual(waiting.map(path));
    };
    const expectListAndReopen = async (open: string[], waiting: string[]) => {
      const persisted = await readTasks();
      await openBase('List');
      await expect(page.locator('.task-list-view__movement-root .task-card')).toHaveCount(8);
      const listOrder = await page.locator('.task-list-view__movement-root .task-card').evaluateAll(elements =>
        elements.map(element => (element as HTMLElement).dataset.taskPath));
      for (const names of [open, waiting]) {
        const paths = names.map(path);
        expect(listOrder.filter(taskPath => paths.includes(taskPath!))).toEqual(paths);
      }
      await openBase('Board');
      await expectBoard(open, waiting);
      expect(await readTasks()).toEqual(persisted);
    };

    await test.step('opening an unranked board does not write ranks', async () => {
      const initial = await readTasks();
      await openBase('Board');
      await expectBoard(['Alpha', 'Beta', 'Charlie', 'Delta', 'Echo'], ['Foxtrot', 'Golf', 'Hotel']);
      expect(await readTasks()).toEqual(initial);
    });
    await test.step('move Alpha before Charlie without flipping the remaining column', async () => {
      await dragBefore(card('Alpha'), card('Charlie'));
      await expect.poll(async () => (await readTasks())[path('Alpha')]).toContain(sortField);
      const actual = await columnOrder('open');
      console.info(JSON.stringify({ time: new Date().toISOString(), direction, move: 'same-column', actual, files: await readTasks() }));
      await expectBoard(['Beta', 'Alpha', 'Charlie', 'Delta', 'Echo'], ['Foxtrot', 'Golf', 'Hotel']);
      await expectListAndReopen(['Beta', 'Alpha', 'Charlie', 'Delta', 'Echo'], ['Foxtrot', 'Golf', 'Hotel']);
    });
    await test.step('move Delta before Golf in another column', async () => {
      await dragBefore(card('Delta'), card('Golf'));
      await expectBoard(['Beta', 'Alpha', 'Charlie', 'Echo'], ['Foxtrot', 'Delta', 'Golf', 'Hotel']);
      await expect.poll(async () => (await readTasks())[path('Delta')]).toContain('status: waiting');
      await expectListAndReopen(['Beta', 'Alpha', 'Charlie', 'Echo'], ['Foxtrot', 'Delta', 'Golf', 'Hotel']);
    });
  });
}
