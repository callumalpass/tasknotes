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
  const storageWarning = instance.page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption because no secret store is available on this system.' });
  if (await storageWarning.isVisible()) {
    await storageWarning.getByText("Don't show again", { exact: true }).click();
  }
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
    expect(measurements.overflowing).toBe(false);
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
  await expect(async () => {
    await expect(source).toBeVisible();
    await source.scrollIntoViewIfNeeded();
  }).toPass({ timeout: 5000 });
  const bounds = await source.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 15, bounds!.y + 20, { steps: 5 });
  await expect(page.locator('.kanban-view__board')).toHaveClass(/kanban-view__board--task-dragging/);
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

test('diagonal native drops offer one Undo restoring both axes without replacing unrelated edits', async () => {
  const page = instance.page;
  const title = 'Review the release checklist and outstanding dependencies';
  const before = await readTask(title);
  await expectNativeDrop('low');
  await expect(page.locator('.tn-toast')).toHaveCount(1);
  await expect(page.locator('.tn-toast__message')).toHaveText('→ waiting · low · 1');
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => { frontmatter.integrationNote = 'keep this'; });
  }, `${folder}/${title}.md`);
  await page.locator('.tn-toast__action').click();
  await expect.poll(async () => {
    const task = await readTask(title);
    return [task.status, task.priority, task.integrationNote];
  }).toEqual([before.status, before.priority, 'keep this']);
});

test('batch drops aggregate Undo while stale axis receipts refuse to replace newer values', async () => {
  const page = instance.page;
  const titles = ['Review the release checklist and outstanding dependencies', 'Align the board metadata'];
  const before = await Promise.all(titles.map(readTask));
  await page.evaluate(paths => {
    const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
    selection.enterSelectionMode();
    for (const path of paths) selection.addToSelection(path);
  }, titles.map(title => `${folder}/${title}.md`));
  const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${titles[0]}.md"]`);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer: transfer });
  const target = cell('waiting', 'low');
  const bounds = (await target.boundingBox())!;
  const event = { dataTransfer: transfer, clientX: bounds.x + 10, clientY: bounds.y + 10 };
  await target.dispatchEvent('dragover', event);
  await target.dispatchEvent('drop', event);
  await source.dispatchEvent('dragend', { dataTransfer: transfer });
  await expect.poll(async () => (await Promise.all(titles.map(readTask))).map(task => [task.status, task.priority])).toEqual([['waiting', 'low'], ['waiting', 'low']]);
  await expect(page.locator('.tn-toast__message')).toHaveText('→ waiting · low · 2');
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.locator('.tn-toast__action').click();
  await expect.poll(async () => (await Promise.all(titles.map(readTask))).map(task => [task.status, task.priority])).toEqual(before.map(task => [task.status, task.priority]));
  await transfer.dispose();
  await expectNativeDrop('low');
  await page.evaluate(async path => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await plugin.updateTaskProperty(await plugin.cacheManager.getTaskInfo(path), 'priority', 'normal', { suppressNotice: true });
  }, `${folder}/${titles[0]}.md`);
  await page.locator('.tn-toast__action').click();
  await expect(page.locator('.tn-toast__message')).toHaveText('→ waiting · low · 1 · Cannot undo: the note has changed.');
  expect(await readTask(titles[0])).toMatchObject({ status: 'waiting', priority: 'normal' });
});

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
    expect(Math.abs(during.height - destination.height)).toBeLessThan(1);
    await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 24 });
    await target.hover({ position: { x: destination.width / 2, y: destination.height / 2 } });
    await page.mouse.move(destination.x + destination.width / 2 + 1, destination.y + destination.height / 2, { steps: 3 });
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
  await page.locator('.kanban-view__column[data-group="waiting"] .kanban-view__column-collapse-button').click();
  await page.locator('.kanban-view__column[data-group="waiting"] .kanban-view__column-header').hover();
  await page.locator('.kanban-view__column[data-group="waiting"] .kanban-view__column-header button[aria-label="Add task to waiting"]').click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.keyboard.press('Escape');
});

async function openPopulatedBoard(custom: boolean) {
  await instance.page.evaluate(async ({ folder, custom, content }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const statuses = custom
      ? Array.from({ length: 8 }, (_, index) => ({
        id: `workflow-${index}`, value: `workflow-${index}`,
        label: ['Awaiting initial design review and approval', 'Ready for detailed implementation planning',
          'Implementation in progress across teams', 'Blocked pending external dependencies',
          'Awaiting accessibility and quality review', 'Ready for stakeholder acceptance testing',
          'Approved for the next scheduled release', 'Delivered and awaiting retrospective'][index],
        color: ['var(--text-muted)', 'var(--color-blue)', 'var(--color-orange)', 'var(--color-red)',
          'var(--color-purple)', 'var(--color-cyan)', 'var(--color-green)', 'var(--text-muted)'][index],
        icon: index % 2 ? 'circle-dashed' : 'circle-dot', order: index, isCompleted: index === 7,
      }))
      : [
        { id: 'none', value: 'none', label: 'None', color: 'var(--text-faint)', order: 0 },
        { id: 'open', value: 'open', label: 'Open', color: 'var(--text-muted)', order: 1 },
        { id: 'in-progress', value: 'in-progress', label: 'In progress', color: 'var(--color-blue)', order: 2 },
        { id: 'done', value: 'done', label: 'Done', color: 'var(--color-green)', order: 3, isCompleted: true },
      ];
    plugin.settings.customStatuses = statuses;
    plugin.statusManager.updateStatuses(statuses);
    for (const file of [...app.vault.getAbstractFileByPath(folder).children]) {
      if (file.extension === 'md') await app.vault.delete(file);
    }
    const status = plugin.fieldMapper.toUserField('status');
    const titles = ['Review release dependencies and remaining accessibility issues',
      'Align navigation and keyboard interactions', 'Resolve the last integration review comments'];
    for (const [index, config] of statuses.entries()) {
      if (!custom && index === 0) continue;
      for (let taskIndex = 0; taskIndex < (custom ? 2 : 3); taskIndex++) {
        const title = titles[taskIndex];
        await app.vault.create(`${folder}/Design ${index}-${taskIndex}.md`,
          `---\ntitle: ${title}\ntags: [task, design-system, accessibility]\n${status}: ${config.value}\npriority: normal\ndue: 2026-11-10\nprojects: ["[[Quarterly planning and delivery]]"]\ncontexts: [office, review]\n---\n`);
      }
    }
    const path = `${folder}/${custom ? 'Custom' : 'Default'}.base`;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, {
    folder, custom,
    content: stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{ type: 'tasknotesKanban', name: 'Design delivery', groupBy: { property: 'status', direction: 'ASC' },
        order: ['file.name', 'priority', 'due', 'projects', 'contexts', 'file.tags'], columnWidth: 280 }],
    }),
  });
  await expect(instance.page.locator('.kanban-view__card-wrapper')).toHaveCount(custom ? 16 : 9);
}

test('default and eight long custom statuses stay composed in both themes at desktop and 400px', async () => {
  const page = instance.page;
  for (const custom of [false, true]) {
    await openPopulatedBoard(custom);
    for (const theme of ['theme-light', 'theme-dark']) {
      await page.evaluate(theme => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(theme);
        document.querySelectorAll('.notice-container').forEach(element => element.remove());
      }, theme);
      for (const width of [1180, 400]) {
        await setObsidianViewport(page, { width, height: 800 });
        await page.evaluate(width => {
          const app = (window as any).app;
          if (width === 400) app.workspace.leftSplit.collapse();
          else app.workspace.leftSplit.expand();
        }, width);
        const board = page.locator('.kanban-view__board');
        await board.evaluate(element => { element.scrollLeft = 0; });
        await expect.poll(() => board.evaluate(element => element.clientWidth)).toBeGreaterThan(250);
        const cards = await board.locator('.task-card').evaluateAll(elements => elements.map(element => ({
          width: element.clientWidth, overflow: element.scrollWidth > element.clientWidth,
          height: element.getBoundingClientRect().height,
          titleHeight: element.querySelector('.task-card__title-text')!.getBoundingClientRect().height,
          titleLineHeight: parseFloat(getComputedStyle(element.querySelector('.task-card__title-text')!).lineHeight),
          titleClamp: getComputedStyle(element.querySelector('.task-card__title-text')!).webkitLineClamp,
          metadataAligned: Array.from(element.querySelectorAll('.task-card__metadata > *')).filter(child => child.getBoundingClientRect().height).every(child => {
            const bounds = child.getBoundingClientRect();
            const row = element.querySelector('.task-card__metadata')!.getBoundingClientRect();
            return Math.abs((bounds.top + bounds.bottom) / 2 - (row.top + row.bottom) / 2) <= 1;
          }),
        })));
        expect(cards.every(card => !card.overflow && card.titleClamp === 'none' && card.metadataAligned)).toBe(true);
        if (!custom) await expect(page.locator('.kanban-view__column[data-group="none"]')).toHaveClass(/--collapsed/);
        if (custom) await expect(board).toHaveClass(/--overflow/);
        await page.mouse.move(width - 30, 760);
        await expect(async () => {
          const image = await page.screenshot({ clip: { x: 0, y: 0, width, height: 800 }, path: `test-results/kanban-round1/${custom ? 'custom-eight' : 'default'}-${theme}-${width}.png` });
          expect(image.readUInt32BE(16)).toBe(width);
          expect(image.readUInt32BE(20)).toBe(800);
        }).toPass({ timeout: 5000 });
      }
    }
  }
});

test('selection, keyboard focus and two-line overflow stay distinct across themes and widths', async () => {
  const page = instance.page;
  await openPopulatedBoard(true);
  const root = page.locator('.tn-tasknotesKanban');
  await root.focus();
  await page.keyboard.press('j');
  const selectedPath = await root.locator('.tn-task-focused').getAttribute('data-task-path');
  await page.keyboard.press('x');
  await page.keyboard.press('j');
  await expect(root.locator('.task-card--selected')).toHaveCount(1);
  await expect(root.locator('.task-card--selected')).toHaveAttribute('data-task-path', selectedPath!);
  await expect(root.locator('.tn-task-focused')).not.toHaveAttribute('data-task-path', selectedPath!);
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    for (const width of [1180, 400]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(() => (window as any).app.workspace.leftSplit.collapse());
      const selected = root.locator('.task-card--selected');
      const focused = root.locator('.tn-task-focused');
      await expect(selected).toBeInViewport();
      await expect(focused).toBeInViewport();
      await expect(selected.locator('.task-card__metadata-overflow')).toBeVisible();
      await expect(selected.locator('.task-card__metadata-overflow')).toHaveAttribute('aria-label', /accessibility/);
      await expect(selected).not.toHaveCSS('background-color', await focused.evaluate(element => getComputedStyle(element).backgroundColor));
      const image = await page.screenshot({ clip: { x: 0, y: 0, width, height: 800 }, path: `test-results/kanban-round1/selection-focus-${theme}-${width}.png` });
      expect(image.readUInt32BE(16)).toBe(width);
      expect(image.readUInt32BE(20)).toBe(800);
    }
  }
});

test('horizontal keyboard navigation, help and real auto-scroll drops preserve task identity', async () => {
  const page = instance.page;
  await openPopulatedBoard(true);
  const root = page.locator('.tn-tasknotesKanban');
  await root.focus();
  await page.keyboard.press('j');
  const first = root.locator('.tn-task-focused');
  const firstPath = await first.getAttribute('data-task-path');
  await page.keyboard.press('l');
  await expect(root.locator('.tn-task-focused')).not.toHaveAttribute('data-task-path', firstPath!);
  await page.keyboard.press('h');
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', firstPath!);
  await page.keyboard.press('ArrowRight');
  await expect(root.locator('.tn-task-focused')).not.toHaveAttribute('data-task-path', firstPath!);
  await page.keyboard.press('ArrowLeft');
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', firstPath!);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toContainText('Move between columns');
  await page.keyboard.press('Escape');
  const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${firstPath}"]`);
  await source.scrollIntoViewIfNeeded();
  const bounds = (await source.boundingBox())!;
  const board = page.locator('.kanban-view__board');
  const boardBounds = (await board.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 18);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 16, bounds.y + 18, { steps: 6 });
  await expect(board).toHaveClass(/--task-dragging/);
  await page.mouse.move(boardBounds.x + boardBounds.width - 12, bounds.y + 20, { steps: 30 });
  await expect.poll(() => board.evaluate(element => element.scrollWidth - element.clientWidth - element.scrollLeft), { timeout: 10000 }).toBeLessThan(2);
  const target = page.locator('.kanban-view__column[data-group="workflow-7"]');
  await target.hover({ position: { x: 80, y: 55 } });
  await page.mouse.move((await target.boundingBox())!.x + 82, bounds.y + 20, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => {
    return page.evaluate(async path => {
      const app = (window as any).app;
      return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path))?.frontmatter.status;
    }, firstPath);
  }).toBe('workflow-7');
  await expect(board).not.toHaveClass(/--task-dragging/);
});

test('a cancelled real drag restores its source and leaves task properties unchanged', async () => {
  const page = instance.page;
  const title = 'Review the release checklist and outstanding dependencies';
  const original = await readTask(title);
  const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/${title}.md"]`);
  const bounds = (await source.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 18);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 16, bounds.y + 18, { steps: 8 });
  await expect(page.locator('.kanban-view__board')).toHaveClass(/--task-dragging/);
  const preview = page.locator('.kanban-view__floating-drag-preview');
  await expect(preview.locator('.task-card')).toBeVisible();
  expect((await preview.boundingBox())!.height).toBeLessThan(100);
  await page.screenshot({ path: 'test-results/kanban-round1/drag-ghost.png' });
  await page.mouse.move(100, 60, { steps: 20 });
  await page.mouse.up();
  await expect(source.locator('.task-card')).toBeVisible();
  await expect(page.locator('.kanban-view__board')).not.toHaveClass(/--task-dragging/);
  await expect(preview).toHaveCount(0);
  expect(await readTask(title)).toEqual(original);
});

test('horizontal keyboard navigation reaches adjacent columns across empty swimlane cells', async () => {
  const page = instance.page;
  const targetPath = `${folder}/A control task with a longer project and context.md`;
  await page.evaluate(async path => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: Record<string, unknown>) => {
      frontmatter[plugin.fieldMapper.toUserField('status')] = 'waiting';
      frontmatter[plugin.fieldMapper.toUserField('priority')] = 'low';
    });
  }, targetPath);
  await expect(cell('waiting', 'low').locator('.kanban-view__card-wrapper')).toHaveCount(1);
  const root = page.locator('.tn-tasknotesKanban');
  await root.focus();
  await page.keyboard.press('j');
  await page.keyboard.press('ArrowRight');
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', targetPath);
  await page.keyboard.press('h');
  await expect(root.locator('.tn-task-focused')).not.toHaveAttribute('data-task-path', targetPath);
});

test('keyboard creation outside a board filter offers Open without modifying the filter', async () => {
  const page = instance.page;
  const content = await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, boardPath);
  const config = parse(content);
  config.filters.and.push('file.name.contains("release checklist")');
  const filteredContent = stringify(config);
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.vault.modify(app.vault.getAbstractFileByPath(path), content);
  }, { path: boardPath, content: filteredContent });
  await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(1);
  const title = `Outside board filter ${Date.now()}`;
  await page.evaluate(() => {
    const messages: string[] = [];
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLElement && node.matches('.tn-toast')) messages.push(node.textContent ?? '');
      }
    });
    observer.observe(document.body, { childList: true });
    (window as any).creationFeedback = { messages, observer };
  });
  await page.locator('.tn-tasknotesKanban').focus();
  await page.keyboard.press('c');
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal).toBeVisible();
  await modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content').fill(title);
  await modal.locator('button.mod-cta').click();
  await expect(modal).toHaveCount(0);
  const toast = page.locator('.tn-toast');
  await expect(toast).toContainText('Task created, but hidden by this view');
  expect(await page.evaluate(() => {
    const feedback = (window as any).creationFeedback;
    feedback.observer.disconnect();
    return feedback.messages.filter((message: string) => message.includes('Task created, but hidden'));
  })).toHaveLength(1);
  const path = await page.evaluate(async title => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    return (await plugin.cacheManager.getAllTasks()).find((task: any) => task.title === title)?.path;
  }, title);
  expect(path).toBeTruthy();
  expect(path).toMatch(new RegExp(`^${folder}/`));
  expect(await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, boardPath)).toBe(filteredContent);
  try {
    await toast.getByRole('button', { name: 'Open', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(path);
  } finally {
    await page.evaluate(async path => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) await app.vault.delete(file);
    }, path);
  }
});
