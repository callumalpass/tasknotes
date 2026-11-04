import { test, expect, type Locator, type CDPSession } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

const folder = `KanbanRedesign-${Date.now()}`;
const boardPath = `${folder}/Board.base`;
let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;
let inputSession: CDPSession;

test.use({ trace: 'on' });

async function readTask(name: string) {
  return instance.page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, `${folder}/${name}.md`).then(content => parse(content.match(/^---\n([\s\S]*?)\n---/)![1]));
}

function cell(column: string, lane: string): Locator {
  return instance.page.locator(`.kanban-view__swimlane-column[data-column="${column}"][data-swimlane="${lane}"]`);
}

test.beforeEach(async () => {
  instance = await launchObsidian();
  inputSession = await instance.page.context().newCDPSession(instance.page);
  await setObsidianViewport(instance.page, { width: 1180, height: 800 });
  originalSettings = await instance.page.evaluate(async ({ folder, boardPath, content }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      customStatuses: plugin.settings.customStatuses,
      customPriorities: plugin.settings.customPriorities,
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
    };
    plugin.settings.customStatuses = ['open', 'waiting', 'review', 'done', 'parked'].map((value, order) => ({
      id: value, value, label: value, color: 'var(--color-blue)', order,
      isCompleted: value === 'done',
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    plugin.settings.customPriorities = ['high', 'normal', 'low'].map((value, index) => ({
      id: value, value, label: value, color: 'var(--text-muted)', weight: 3 - index,
    }));
    plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    const status = plugin.fieldMapper.toUserField('status');
    const priority = plugin.fieldMapper.toUserField('priority');
    const sort = plugin.fieldMapper.toUserField('sortOrder');
    const due = plugin.fieldMapper.toUserField('due');
    for (const [name, rank, order] of [
      ['Review the release checklist and outstanding dependencies', 'high', 'tnaaaaaaaaaa'],
      ['Align the board metadata', 'normal', 'tnmmmmmmmmmm'],
      ['A control task with a longer project and context', 'normal', 'tnzzzzzzzzzz'],
    ]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name}\ntags: [task, design-review]\n${status}: open\n${priority}: ${rank}\n${sort}: ${order}\n${due}: 2026-11-10\nprojects: ["[[Quarterly planning and delivery]]"]\ncontexts: [office, review]\n---\n`);
    }
    await app.workspace.getLeaf(false).openFile(await app.vault.create(boardPath, content));
    return original;
  }, {
    folder, boardPath,
    content: stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{
        type: 'tasknotesKanban', name: 'Board', groupBy: { property: 'status', direction: 'ASC' },
        swimLane: 'note.priority', hideEmptySwimLanes: false, columnWidth: 260,
        order: ['file.name', 'priority', 'due', 'projects', 'contexts', 'file.tags'],
        sort: [{ column: 'sort_order', direction: 'ASC' }],
      }],
    }),
  });
  await expect(instance.page.locator('.kanban-view__card-wrapper')).toHaveCount(3);
});

test.afterEach(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, settings);
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, settings: originalSettings });
  } finally {
    await closeObsidian(instance);
  }
});

test('neutral board surfaces, stacked metadata, compact empty lanes and pane overflow', async () => {
  const page = instance.page;
  const emptyRow = cell('open', 'low').locator('..');
  await expect(emptyRow).toHaveClass(/kanban-view__swimlane-row--empty/);
  await expect(cell('waiting', 'normal').locator('.kanban-view__empty-cell')).toBeHidden();
  await expect(page.locator('.kanban-view__column-header-cell .tn-glyph')).toHaveCount(5);

  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    await expect(page.locator('.kanban-view__column-header-cell').first()).toHaveCSS(
      'background-color', await cell('open', 'high').evaluate(lane => getComputedStyle(lane).backgroundColor)
    );
    await expect.poll(() => page.locator('.kanban-view__board').evaluate(board =>
      getComputedStyle(board.querySelector('.task-card')!).backgroundColor !==
      getComputedStyle(board.querySelector('.kanban-view__swimlane-column')!).backgroundColor
    )).toBe(true);
    const measurements = await page.locator('.kanban-view__board').evaluate(board => {
      const card = board.querySelector<HTMLElement>('.task-card')!;
      const header = board.querySelector<HTMLElement>('.kanban-view__column-header-cell')!;
      const lane = board.querySelector<HTMLElement>('.kanban-view__swimlane-column')!;
      const metadata = card.querySelector<HTMLElement>('.task-card__metadata')!;
      const title = card.querySelector<HTMLElement>('.task-card__title')!;
      const empty = board.querySelector<HTMLElement>('.kanban-view__swimlane-row--empty')!;
      return {
        card: getComputedStyle(card).backgroundColor,
        lane: getComputedStyle(lane).backgroundColor,
        header: getComputedStyle(header).backgroundColor,
        border: getComputedStyle(card).borderTopWidth,
        stacked: metadata.getBoundingClientRect().top >= title.getBoundingClientRect().bottom,
        emptyHeight: empty.getBoundingClientRect().height,
        overflowing: board.scrollWidth > board.clientWidth,
        cardOverflow: card.scrollWidth > card.clientWidth,
      };
    });
    expect(measurements.card).not.toBe(measurements.lane);
    expect(measurements.header).toBe(measurements.lane);
    expect(measurements.border).toBe('1px');
    expect(measurements.stacked).toBe(true);
    expect(measurements.cardOverflow).toBe(false);
    expect(measurements.emptyHeight).toBeLessThanOrEqual(52);
    expect(measurements.overflowing).toBe(true);
    await page.screenshot({ path: `test-results/kanban-redesign/${theme}.png` });
  }

  await setObsidianViewport(page, { width: 800, height: 800 });
  expect(await page.locator('.kanban-view__board').evaluate(board => board.clientWidth)).toBeLessThan(480);
  await page.screenshot({ path: 'test-results/kanban-redesign/narrow-pane.png' });
  await expect.poll(() => page.locator('.kanban-view__board').evaluate(board => board.scrollWidth > board.clientWidth)).toBe(true);
  await page.locator('.kanban-view__board').evaluate(board => { board.scrollLeft = board.scrollWidth; });
  await expect.poll(() => page.locator('.kanban-view__board').evaluate(board => board.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/kanban-redesign/narrow-overflow.png' });
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.locator('.kanban-view__board').evaluate(board => { board.scrollLeft = 0; });
});

async function expectNativeDrop(lane: string) {
  const page = instance.page;
  await inputSession.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 10 });
  const title = 'Review the release checklist and outstanding dependencies';
  const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${title}.md"]`);
  const target = cell('waiting', lane);
  await page.evaluate(() => {
    (window as any).kanbanDrops = [];
    document.addEventListener('drop', event => {
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-column]');
      (window as any).kanbanDrops.push({ column: cell?.dataset.column, lane: cell?.dataset.swimlane });
    }, true);
  });
  await source.scrollIntoViewIfNeeded();
  const bounds = await source.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 15, bounds!.y + 20, { steps: 5 });
  await expect(page.locator('.kanban-view__board')).toHaveClass(/kanban-view__board--task-dragging/);
  await expect(target.locator('.kanban-view__empty-cell')).toBeVisible();
  const destination = await target.boundingBox();
  expect(destination).not.toBeNull();
  await page.mouse.move(destination!.x + destination!.width / 2, destination!.y + 18, { steps: 25 });
  await target.hover({ position: { x: destination!.width / 2, y: 18 } });
  const finalBounds = await target.boundingBox();
  await page.mouse.move(finalBounds!.x + finalBounds!.width / 2, finalBounds!.y + finalBounds!.height / 2, { steps: 8 });
  await expect(target).toHaveClass(/kanban-view__swimlane-column--dragover/);
  await page.mouse.up();
  console.info('Native drop evidence', JSON.stringify({ destination, events: await page.evaluate(() => (window as any).kanbanDrops), task: await readTask(title) }));
  await expect.poll(async () => {
    const task = await readTask(title);
    return { status: task.status, priority: task.priority };
  }).toEqual({ status: 'waiting', priority: lane });
  await expect(target.locator('.kanban-view__card-wrapper')).toHaveCount(1);
  await expect(cell('open', 'high').locator('..')).toHaveClass(/kanban-view__swimlane-row--empty/);
  await expect(page.locator('.kanban-view__board')).not.toHaveClass(/kanban-view__board--task-dragging/);

  await inputSession.send('Emulation.setTouchEmulationEnabled', { enabled: false });
}

test('native mouse drag persists a drop into an empty lane', () => expectNativeDrop('low'));
test('native mouse drag persists a drop into an empty cell', () => expectNativeDrop('normal'));

test('repeated real drags below an empty swimlane keep every destination stable', async () => {
  const page = instance.page;
  const title = 'Review the release checklist and outstanding dependencies';
  for (const [column, lane] of [['waiting', 'low'], ['open', 'normal'], ['waiting', 'low'], ['open', 'high']]) {
    const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${title}.md"]`);
    await expect(async () => {
      await source.scrollIntoViewIfNeeded();
    }).toPass({ timeout: 5000 });
    const target = cell(column, lane);
    const destination = (await target.boundingBox())!;
    const bounds = (await source.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 18);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 16, bounds.y + 18, { steps: 8 });
    await expect(page.locator('.kanban-view__board')).toHaveClass(/kanban-view__board--task-dragging/);
    const during = (await target.boundingBox())!;
    expect(Math.abs(during.y - destination.y)).toBeLessThan(1);
    console.info('Drag destination', column, lane, destination, during);
    await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 24 });
    await target.hover({ position: { x: destination.width / 2, y: destination.height / 2 } });
    await page.mouse.move(destination.x + destination.width / 2 + 1, destination.y + destination.height / 2, { steps: 3 });
    await expect(target).toHaveClass(/kanban-view__swimlane-column--dragover/);
    await page.mouse.up();
    await expect.poll(async () => {
      const task = await readTask(title);
      return { status: task.status, priority: task.priority };
    }).toEqual({ status: column, priority: lane });
    await expect(page.locator('.kanban-view__board')).not.toHaveClass(/kanban-view__board--task-dragging/);
    await expect(target.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${title}.md"]`)).toBeVisible();
  }
});

test('repeated DOM drag lifecycles persist swimlane moves and clear board state', async () => {
  const page = instance.page;
  const title = 'Review the release checklist and outstanding dependencies';
  for (const [column, lane] of [['waiting', 'low'], ['open', 'high'], ['review', 'normal'], ['waiting', 'low']]) {
    const source = await page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${title}.md"]`).elementHandle();
    expect(source).not.toBeNull();
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await source!.dispatchEvent('dragstart', { dataTransfer: transfer });
    await expect(page.locator('.kanban-view__board')).toHaveClass(/kanban-view__board--task-dragging/);
    const target = cell(column, lane);
    await expect(target.locator('.kanban-view__empty-cell')).toBeVisible();
    const bounds = (await target.boundingBox())!;
    const event = { dataTransfer: transfer, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + 18 };
    await target.dispatchEvent('dragover', event);
    await target.dispatchEvent('drop', event);
    await source!.dispatchEvent('dragend', { dataTransfer: transfer });
    await expect.poll(async () => {
      const task = await readTask(title);
      return { status: task.status, priority: task.priority };
    }).toEqual({ status: column, priority: lane });
    await expect(target.locator('.kanban-view__card-wrapper')).toHaveCount(1);
    await expect(page.locator('.kanban-view__board')).not.toHaveClass(/kanban-view__board--task-dragging/);
    await expect(page.locator('body')).not.toHaveClass(/tn-drag-active/);
    await expect(page.locator('.kanban-view__floating-drag-preview')).toHaveCount(0);
    await expect(target.locator('.kanban-view__card-wrapper')).toBeVisible();
    await transfer.dispose();
    await source!.dispose();
  }
});

test('flat columns retain virtualization, collapse and header creation', async () => {
  const page = instance.page;
  await page.evaluate(async ({ folder, content }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const virtualFolder = `${folder}/Virtual`;
    await app.vault.createFolder(virtualFolder);
    for (let index = 0; index < 35; index++) {
      const title = `Virtual task ${String(index).padStart(2, '0')}`;
      await app.vault.create(`${virtualFolder}/${title}.md`, `---\ntitle: ${title}\ntags: [task]\n${plugin.fieldMapper.toUserField('status')}: open\npriority: normal\n---\n`);
    }
    await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Virtual.base`, content));
  }, {
    folder,
    content: stringify({
      filters: { and: [`file.inFolder("${folder}/Virtual")`, 'file.hasTag("task")'] },
      views: [{ type: 'tasknotesKanban', name: 'Virtual', groupBy: { property: 'status', direction: 'ASC' },
        order: ['file.name', 'priority'], sort: [{ column: 'file.name', direction: 'ASC' }], columnWidth: 260 }],
    }),
  });
  const column = page.locator('.kanban-view__column[data-group="open"]');
  const virtual = column.locator('.kanban-view__cards--virtual');
  await expect(virtual).toBeVisible();
  await expect(column.locator('.kanban-view__column-count')).toContainText('35');
  expect(await column.locator('.kanban-view__card-wrapper').count()).toBeLessThan(35);
  await virtual.evaluate(container => { container.scrollTop = container.scrollHeight; });
  await expect(column.locator('.kanban-view__card-wrapper[data-task-path$="Virtual task 34.md"]')).toBeVisible();
  const collapse = column.locator('.kanban-view__column-collapse-button');
  await collapse.focus();
  await page.keyboard.press('Enter');
  await expect(column).toHaveClass(/kanban-view__column--collapsed/);
  await collapse.focus();
  await page.keyboard.press('Enter');
  await expect(column).not.toHaveClass(/kanban-view__column--collapsed/);
  await page.locator('.kanban-view__column[data-group="waiting"] .kanban-view__column-header').hover();
  await page.locator('.kanban-view__column[data-group="waiting"] .kanban-view__column-header button[aria-label="Add task to waiting"]').click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.keyboard.press('Escape');
});
