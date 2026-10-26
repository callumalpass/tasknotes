import { test, expect, type CDPSession, type Locator, type Page } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue2414-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let inputSession: CDPSession;
let originalSettings: any;
let sortField: string;

async function readYaml(path: string) {
  const text = await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, path);
  return parse(path.endsWith('.md') ? text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1] : text);
}

async function drag(source: Locator, target: Locator, below = false) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + 20);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + 20, { steps: 4 });
  await page.mouse.move(to!.x + to!.width / 2, to!.y + (below ? to!.height - 4 : 4), { steps: 25 });
  await page.mouse.up();
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  // Keep the session attached: Chromium clears emulation when it detaches.
  inputSession = await page.context().newCDPSession(page);
  await inputSession.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 10 });
  sortField = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      customStatuses: plugin.settings.customStatuses,
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
    };
    (window as any).issue2414OriginalSettings = original;
    plugin.settings.customStatuses = ['open', 'waiting'].map((value, order) => ({
      id: value, value, label: value, color: '#808080', isCompleted: false, order,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    const status = plugin.fieldMapper.toUserField('status');
    const sort = plugin.fieldMapper.toUserField('sortOrder');
    for (const [name, value, order] of [['Alpha', 'open', 'tnaaaaaaaaaa'], ['Beta', 'open', 'tnmmmmmmmmmm'], ['Gamma', 'waiting', 'tnzzzzzzzzzz']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\n${status}: ${value}\n${sort}: ${order}\npriority: normal\n---\n`);
    }
    return sort;
  }, folder);
  originalSettings = await page.evaluate(() => (window as any).issue2414OriginalSettings);
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{
      type: 'tasknotesKanban', name: 'Issue 2414',
      groupBy: { property: 'status', direction: 'ASC' },
      sort: [{ column: sortField, direction: 'ASC' }],
      columnWidth: 280, hideEmptyColumns: true,
    }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/Board.base`, content });
  await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(3);
});

test.afterAll(async () => {
  try {
    if (originalSettings && page && !page.isClosed()) {
      await page.evaluate(async ({ originalSettings, folder }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins.tasknotes;
        Object.assign(plugin.settings, originalSettings);
        plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
        const fixture = app.vault.getAbstractFileByPath(folder);
        if (fixture) await app.vault.delete(fixture, true);
      }, { originalSettings, folder });
      await inputSession.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await inputSession.detach();
    }
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

test('coarse-pointer mouse moves, card ordering, column ordering and touch all persist', async () => {
  test.setTimeout(90_000);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  const card = (name: string) => page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${name}.md"]`);
  const column = (key: string) => page.locator(`.kanban-view__column[data-group="${key}"]`);
  const path = (name: string) => `${folder}/${name}.md`;
  await page.evaluate(() => {
    (window as any).issue2414Drags = [];
    document.addEventListener('dragstart', event => {
      const source = (event.target as HTMLElement).closest('.kanban-view__card-wrapper, [data-column-key]');
      if (source) queueMicrotask(() => (window as any).issue2414Drags.push({
        pointerEvents: getComputedStyle(source).pointerEvents,
        touchMarker: source.classList.contains('kanban-view__touch-drag-source'),
      }));
    }, true);
  });

  await test.step('mouse cross-column move writes status YAML', async () => {
    await drag(card('Alpha'), card('Gamma'));
    await expect.poll(async () => (await readYaml(path('Alpha'))).status).toBe('waiting');
    await expect(column('waiting').locator('.kanban-view__card-wrapper')).toHaveCount(2);
  });

  await test.step('mouse within-column reorder writes manual-order YAML', async () => {
    const before = (await readYaml(path('Alpha')))[sortField];
    await drag(card('Alpha'), card('Gamma'), true);
    await expect.poll(async () => (await readYaml(path('Alpha')))[sortField]).not.toBe(before);
    await expect.poll(() => column('waiting').locator('.kanban-view__card-wrapper')
      .evaluateAll(els => els.map(el => (el as HTMLElement).dataset.taskPath)))
      .toEqual([path('Gamma'), path('Alpha')]);
  });

  await test.step('mouse column-header reorder writes base YAML', async () => {
    await drag(column('open').locator('[data-column-key]'), column('waiting').locator('[data-column-key]'));
    await expect.poll(async () => (await readYaml(`${folder}/Board.base`)).views[0].columnOrder)
      .toContain('waiting');
    const order = (await readYaml(`${folder}/Board.base`)).views[0].columnOrder;
    expect(Object.values(JSON.parse(order))).toEqual([['waiting', 'open']]);
  });

  const nativeDrags = await page.evaluate(() => (window as any).issue2414Drags);
  expect(nativeDrags).toHaveLength(3);
  expect(nativeDrags.every((drag: any) => drag.pointerEvents !== 'none' && !drag.touchMarker)).toBe(true);

  await test.step('350ms touch long-press writes status YAML and restores hit-testing', async () => {
    const cdp = inputSession;
    const from = (await card('Beta').boundingBox())!;
    const to = (await card('Gamma').boundingBox())!;
    const x = from.x + from.width / 2, y = from.y + 20;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await expect(card('Beta')).toHaveClass(/kanban-view__touch-drag-source/);
    expect(await card('Beta').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
    for (let i = 1; i <= 15; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: x + (to.x + to.width / 2 - x) * i / 15,
        y: y + (to.y + 10 - y) * i / 15,
      }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await readYaml(path('Beta'))).status).toBe('waiting');
    await expect(page.locator('.kanban-view__touch-drag-source')).toHaveCount(0);
    await expect(page.locator('.kanban-view__touch-ghost')).toHaveCount(0);
  });
  console.info('Issue 2414 persisted YAML', JSON.stringify({
    time: new Date().toISOString(),
    alpha: await readYaml(path('Alpha')),
    beta: await readYaml(path('Beta')),
    gamma: await readYaml(path('Gamma')),
    board: await readYaml(`${folder}/Board.base`),
    nativeDrags,
  }));
});
