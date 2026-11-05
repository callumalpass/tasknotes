import { test, expect, type Locator, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { mkdirSync, writeFileSync } from 'fs';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const evidence = `/tmp/tasknotes-r7/kanban/${process.env.TASKNOTES_R7_PHASE ?? 'after'}`;
const folder = `BoardStates-${Date.now()}`;

async function capture(page: Page, path: string) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const viewport = page.viewportSize()!;
  await page.screenshot({ path, clip: { x: 0, y: 0, ...viewport } });
}

async function waitForStableGeometry(locator: Locator) {
  await expect.poll(async () => {
    const handle = await locator.elementHandle();
    if (!handle) return false;
    try {
      const before = await handle.evaluate(element => element.getBoundingClientRect().toJSON());
      await locator.page().waitForTimeout(200);
      return await handle.evaluate((element, before) => element.isConnected &&
        JSON.stringify(element.getBoundingClientRect().toJSON()) === JSON.stringify(before), before);
    } finally {
      await handle.dispose();
    }
  }).toBe(true);
}

async function lift(page: Page, source: Locator, pressedPath?: string) {
  await source.scrollIntoViewIfNeeded();
  await waitForStableGeometry(source);
  const bounds = (await source.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 18);
  await page.mouse.down();
  if (pressedPath) await capture(page, pressedPath);
  await page.mouse.move(bounds.x + bounds.width / 2 + 18, bounds.y + 18, { steps: 6 });
  await expect(page.locator('.kanban-view__board')).toHaveClass(/--task-dragging/);
}

test('board state sheet uses native held-pointer drags in both themes and widths', async () => {
  test.setTimeout(180000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  let settings: any;
  const states: any[] = [];
  try {
    settings = await page.evaluate(async ({ folder, content }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      const original = {
        customStatuses: plugin.settings.customStatuses,
        customPriorities: plugin.settings.customPriorities,
        taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
        taskTag: plugin.settings.taskTag,
      };
      plugin.settings.customStatuses = [
        ['open', 'Planned', 'var(--text-muted)'],
        ['doing', 'In progress', 'var(--color-blue)'],
        ['review', 'In review', 'var(--color-orange)'],
        ['done', 'Complete', 'var(--color-green)'],
      ].map(([value, label, color], order) => ({ id: value, value, label, color, order, isCompleted: value === 'done' }));
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      plugin.settings.customPriorities = ['high', 'normal', 'low'].map((value, index) => ({ id: value, value, label: value, color: 'var(--text-muted)', weight: 3 - index }));
      plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      await app.vault.createFolder(folder);
      const status = plugin.fieldMapper.toUserField('status');
      const order = plugin.fieldMapper.toUserField('sortOrder');
      for (const [index, title, state, metadata] of [
        [0, 'Refine the board interaction states', 'open', 'priority: high\ndue: 2026-10-28\ncontexts: [studio]\nprojects: ["[[TaskNotes redesign]]"]'],
        [1, 'Review hover and drag with the team', 'open', 'priority: normal'],
        [2, 'A quiet card without extra metadata', 'open', ''],
        [3, 'Make space for a long title that stays readable while the board is moving', 'doing', 'priority: low\ncontexts: [studio, focus]'],
        [4, 'Ship the finished interaction', 'done', 'priority: normal'],
      ]) {
        await app.vault.create(`${folder}/${index}.md`, `---\ntitle: ${title}\ntags: [task]\n${status}: ${state}\n${order}: tn${String(index).repeat(10)}\n${metadata}\n---\n`);
      }
      await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Board.base`, content.replace('__MANUAL_ORDER__', order)));
      return original;
    }, { folder, content: stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{ type: 'tasknotesKanban', name: 'Design delivery', groupBy: { property: 'status', direction: 'ASC' },
        columnWidth: 270, hideEmptyColumns: false,
        order: ['status', 'priority', 'due', 'projects', 'contexts', 'file.tags'],
        sort: [{ column: '__MANUAL_ORDER__', direction: 'ASC' }] }],
    }) });
    await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(5);
    const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
    if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
    const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/0.md"]`);
    const targetCard = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/3.md"]`);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {
        document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
        document.body.classList.add(`theme-${theme}`);
      }, theme);
      for (const width of [1180, 400]) {
        await setObsidianViewport(page, { width, height: 800 });
        await page.locator('.kanban-view__board').evaluate(board => { board.scrollLeft = 0; });
        await page.keyboard.press('Escape');
        await page.mouse.move(5, 5);
        await capture(page, `${evidence}/${theme}-${width}-rest.png`);
        await source.hover();
        const before = await source.boundingBox();
        await capture(page, `${evidence}/${theme}-${width}-hover.png`);
        expect(await source.boundingBox()).toEqual(before);
        await source.locator('.task-card__status-dot').focus();
        await page.keyboard.press('Tab');
        await capture(page, `${evidence}/${theme}-${width}-focus.png`);
        const header = page.locator('.kanban-view__column-header').first();
        await header.hover();
        await capture(page, `${evidence}/${theme}-${width}-header-hover.png`);
        if (width === 400) {
          await page.evaluate(() => document.body.classList.add('is-mobile'));
          await capture(page, `${evidence}/${theme}-${width}-touch.png`);
          await page.evaluate(() => document.body.classList.remove('is-mobile'));
          continue;
        }
        await lift(page, source, `${evidence}/${theme}-${width}-pressed.png`);
        expect(await source.locator(':scope > .task-card').evaluate(card => getComputedStyle(card).outlineStyle)).toBe('none');
        const destination = (await targetCard.boundingBox())!;
        await page.mouse.move(destination.x + 60, destination.y + 8, { steps: 22 });
        await expect(page.locator('.kanban-view__floating-drag-preview')).toBeVisible();
        await expect(page.locator('.kanban-view__card-wrapper--drop-marker')).toHaveCount(1);
        states.push(await page.evaluate(({ theme, width }) => {
          const preview = document.querySelector<HTMLElement>('.kanban-view__floating-drag-preview')!;
          const source = document.querySelector<HTMLElement>('.kanban-view__card--dragging')!;
          return { theme, width, source: getComputedStyle(source.querySelector('.task-card')!).opacity,
            preview: preview.getBoundingClientRect().toJSON(),
            markers: document.querySelectorAll('.kanban-view__card-wrapper--drop-marker, .kanban-view__cards--drop-marker-end').length,
            target: document.querySelector('.kanban-view__column--dragover')?.getAttribute('data-group'),
            pointerTarget: document.elementFromPoint(450, 180)?.className };
        }, { theme, width }));
        await capture(page, `${evidence}/${theme}-${width}-drag.png`);
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(page.locator('.kanban-view__floating-drag-preview')).toHaveCount(0);
        await expect(source).not.toHaveClass(/--dragging/);
        await capture(page, `${evidence}/${theme}-${width}-cancelled.png`);
        const persisted = await page.evaluate(async path => {
          const app = (window as any).app;
          return app.vault.read(app.vault.getAbstractFileByPath(path));
        }, `${folder}/0.md`);
        expect(persisted).toContain('status: open');
        await page.evaluate(paths => {
          const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
          selection.clearSelection();
          for (const path of paths) selection.toggleSelection(path);
        }, [`${folder}/0.md`, `${folder}/1.md`]);
        await source.hover();
        await capture(page, `${evidence}/${theme}-${width}-selected-hover.png`);
        await lift(page, source);
        await page.mouse.move(destination.x + 60, destination.y + 8, { steps: 22 });
        await expect(page.locator('.kanban-view__floating-drag-preview')).toHaveAttribute('data-drag-count', '2');
        await capture(page, `${evidence}/${theme}-${width}-multi-drag.png`);
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.clearSelection());
      }
    }
    writeFileSync(`${evidence}/states.json`, JSON.stringify(states, null, 2));
  } finally {
    await page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      if (settings) {
        Object.assign(plugin.settings, settings);
        plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
        plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      }
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, settings });
    await closeObsidian(instance);
  }
});

async function boardScenario(options: { formula?: boolean; swimlanes?: boolean; many?: boolean; touch?: boolean }, run: (page: Page, fixture: string) => Promise<void>) {
  const instance = await launchObsidian();
  const page = instance.page;
  const fixture = `${folder}-${options.formula ? 'formula' : options.swimlanes ? 'lanes' : 'scroll'}`;
  let original: any;
  try {
    await setObsidianViewport(page, { width: 1180, height: 800 });
    if (options.touch) {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    }
    original = await page.evaluate(async ({ fixture, options }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      const saved = { customStatuses: plugin.settings.customStatuses, customPriorities: plugin.settings.customPriorities, taskIdentificationMethod: plugin.settings.taskIdentificationMethod, taskTag: plugin.settings.taskTag };
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      const statuses = ['open', 'doing', 'review', 'done', ...(options.many ? ['later', 'blocked', 'waiting', 'parked'] : [])];
      plugin.settings.customStatuses = statuses
        .map((value, order) => ({ id: value, value, label: value, color: 'var(--text-muted)', order, isCompleted: value === 'done' }));
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      plugin.settings.customPriorities = ['high', 'normal', 'low'].map((value, index) => ({ id: value, value, label: value, color: 'var(--text-muted)', weight: 3 - index }));
      plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      await app.vault.createFolder(fixture);
      for (let index = 0; index < (options.many ? 40 : 4); index++) {
        const status = options.many && index > 0 && index < statuses.length ? statuses[index] : index === 1 ? 'doing' : 'open';
        await app.vault.create(`${fixture}/${index}.md`, `---\ntitle: ${index === 0 ? 'Drag this task across the board' : `Review item ${index}`}\ntags: [task]\n${plugin.fieldMapper.toUserField('status')}: ${status}\n${plugin.fieldMapper.toUserField('priority')}: ${index % 2 ? 'normal' : 'high'}\n${plugin.fieldMapper.toUserField('sortOrder')}: tn${String(index).padStart(10, '0')}\n---\n`);
      }
      return { ...saved, sortField: plugin.fieldMapper.toUserField('sortOrder') };
    }, { fixture, options });
    await page.evaluate(async ({ fixture, content }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(await app.vault.create(`${fixture}/Board.base`, content));
    }, { fixture, content: stringify({
      filters: { and: [`file.inFolder("${fixture}")`, 'file.hasTag("task")'] },
      ...(options.formula ? { formulas: { boardStatus: 'status' } } : {}),
      views: [{ type: 'tasknotesKanban', name: 'Interaction evidence',
        groupBy: { property: options.formula ? 'formula.boardStatus' : 'status', direction: 'ASC' },
        ...(options.swimlanes ? { swimLane: 'note.priority', hideEmptySwimLanes: false } : {}),
        order: ['status', 'priority'], sort: [{ column: original.sortField, direction: 'ASC' }],
        columnWidth: 270, hideEmptyColumns: false }],
    }) });
    if (options.many) {
      await expect(page.locator('.kanban-view__cards--virtual')).toBeVisible();
      await expect(page.locator('.kanban-view__column[data-group="open"] .kanban-view__column-count')).toContainText('33');
    } else {
      await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(4);
    }
    await run(page, fixture);
  } finally {
    await page.evaluate(async ({ fixture, original }) => {
      const app = (window as any).app;
      if ((window as any).r7OriginalWrite) app.fileManager.processFrontMatter = (window as any).r7OriginalWrite;
      const plugin = app.plugins.plugins.tasknotes;
      if (original) {
        const { sortField, ...settings } = original;
        Object.assign(plugin.settings, settings);
        plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
        plugin.priorityManager.updatePriorities(plugin.settings.customPriorities);
      }
      const folder = app.vault.getAbstractFileByPath(fixture);
      if (folder) await app.vault.delete(folder, true);
    }, { fixture, original });
    await closeObsidian(instance);
  }
}

test('formula targets explain their restriction while the mouse is still held', async () => {
  await boardScenario({ formula: true }, async (page, fixture) => {
    const source = page.locator(`[data-task-path="${fixture}/0.md"].kanban-view__card-wrapper`);
    const target = page.locator('.kanban-view__column[data-group="doing"]');
    await lift(page, source);
    const bounds = (await target.boundingBox())!;
    await page.mouse.move(bounds.x + 80, bounds.y + 65, { steps: 20 });
    await expect(page.locator('.kanban-view__drag-feedback')).toContainText('Formula values are computed');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
      await capture(page, `${evidence}/${theme}-1180-invalid.png`);
    }
    await page.mouse.up();
    await expect(page.locator('.kanban-view__floating-drag-preview')).toHaveCount(0);
    const content = await page.evaluate(async path => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(path));
    }, `${fixture}/0.md`);
    expect(content).toContain('status: open');
    await expect(page.locator('.kanban-view__column--dragover, .kanban-view__card-wrapper--drop-marker')).toHaveCount(0);
  });
});

for (const theme of ['light', 'dark']) {
  for (const selector of ['.kanban-view__column-header-cell', '.kanban-view__swimlane-label[data-swimlane-key]']) {
    test(`${theme} ${selector} preview survives refresh and cancels without stale targets`, async () => {
      await boardScenario({ swimlanes: true }, async page => {
      await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
        const source = page.locator(selector).first();
        const target = page.locator(selector).nth(1);
        const sourceHandle = await source.elementHandle();
        const bounds = (await source.boundingBox())!;
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 + 15, bounds.y + bounds.height / 2, { steps: 6 });
        await expect(page.locator('.kanban-view__floating-drag-preview')).toBeVisible();
        await page.evaluate(() => (window as any).app.workspace.trigger('css-change'));
        await page.waitForTimeout(300);
        expect(await sourceHandle!.evaluate(element => element.isConnected), `${theme} ${selector} source during refresh`).toBe(true);
        const destination = (await target.boundingBox())!;
        await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 20 });
        await expect(target).toHaveClass(/--dragover/);
        await expect(page.locator('.kanban-view__floating-drag-preview')).toBeVisible();
        const previewState = await page.locator('.kanban-view__floating-drag-preview').evaluate(element => ({ text: element.textContent, bounds: element.getBoundingClientRect().toJSON(), style: getComputedStyle(element).transform }));
        writeFileSync(`${evidence}/${theme}-${selector.includes('swimlane') ? 'row' : 'column'}-drag.json`, JSON.stringify(previewState, null, 2));
        await capture(page, `${evidence}/${theme}-1180-${selector.includes('swimlane') ? 'row' : 'column'}-drag.png`);
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(page.locator('.kanban-view__floating-drag-preview')).toHaveCount(0);
        await expect(page.locator('[class*="--dragover"], [class*="--dragging"]')).toHaveCount(0);
        await sourceHandle!.dispose();
      });
    });
  }
}

test('fast hover sweeps survive refresh and flat column headers persist their move', async () => {
  await boardScenario({}, async (page, fixture) => {
    const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${fixture}/0.md"]`);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
      await waitForStableGeometry(source);
      const geometry = await source.boundingBox();
      for (let pass = 0; pass < 3; pass++) {
        for (const card of await page.locator('.kanban-view__card-wrapper').all()) {
          const bounds = (await card.boundingBox())!;
          await page.mouse.move(bounds.x + 100, bounds.y + 15);
        }
      }
      await source.hover();
      expect(await source.boundingBox()).toEqual(geometry);
      const old = await source.elementHandle();
      await page.evaluate(() => (window as any).app.workspace.trigger('css-change'));
      await expect.poll(() => old!.evaluate(element => element.isConnected)).toBe(false);
      await expect.poll(() => source.evaluate(element => element.matches(':hover'))).toBe(true);
      expect(await source.boundingBox()).toEqual(geometry);
      await capture(page, `${evidence}/${theme}-1180-hover-refreshed.png`);
      await old!.dispose();
    }
    await page.evaluate(() => {
      (window as any).r7HeaderEvents = [];
      for (const kind of ['dragstart', 'drop', 'dragend']) document.addEventListener(kind, event => {
        const target = event.target as HTMLElement;
        (window as any).r7HeaderEvents.push({ kind, target: target.className, types: [...((event as DragEvent).dataTransfer?.types ?? [])] });
      }, true);
    });
    const header = page.locator('.kanban-view__column[data-group="open"] .kanban-view__column-header');
    const target = page.locator('.kanban-view__column[data-group="doing"] .kanban-view__column-header');
    const bounds = (await header.boundingBox())!;
    const destination = (await target.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 15, bounds.y + 20, { steps: 6 });
    await expect(page.locator('.kanban-view__floating-drag-preview')).toBeVisible();
    await page.mouse.move(destination.x + destination.width / 2, destination.y + 4, { steps: 25 });
    await capture(page, `${evidence}/dark-1180-flat-column-drag.png`);
    await page.mouse.up();
    const events = await page.evaluate(() => (window as any).r7HeaderEvents);
    writeFileSync(`${evidence}/flat-header-events.json`, JSON.stringify(events, null, 2));
    await expect.poll(async () => page.evaluate(async path => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(path));
    }, `${fixture}/Board.base`)).toContain('columnOrder');
  });
});

test('held drags scroll both board axes and Escape stops scrolling', async () => {
  await boardScenario({ many: true }, async (page, fixture) => {
    const source = page.locator(`[data-task-path="${fixture}/0.md"].kanban-view__card-wrapper`);
    const cards = page.locator('.kanban-view__column[data-group="open"] .kanban-view__cards');
    const originalSource = await source.elementHandle();
    await lift(page, source);
    const column = (await cards.boundingBox())!;
    await page.mouse.move(column.x + 80, column.y + column.height - 5, { steps: 20 });
    await expect.poll(() => cards.evaluate(element => element.scrollTop)).toBeGreaterThan(800);
    expect(await originalSource!.evaluate(element => element.isConnected)).toBe(true);
    await originalSource!.dispose();
    await expect(page.locator('.kanban-view__floating-drag-preview')).toBeVisible();
    await capture(page, `${evidence}/light-1180-vertical-scroll.png`);
    const board = page.locator('.kanban-view__board');
    const bounds = (await board.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + 80, { steps: 20 });
    await expect.poll(() => board.evaluate(element => element.scrollLeft)).toBeGreaterThan(25);
    await capture(page, `${evidence}/light-1180-horizontal-scroll.png`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.kanban-view__floating-drag-preview')).toHaveCount(0);
    const scroll = await board.evaluate(element => element.scrollLeft);
    await page.waitForTimeout(150);
    expect(await board.evaluate(element => element.scrollLeft)).toBe(scroll);
  });
});

test('swimlane pending and failed writes keep the task identity and expose recovery feedback', async () => {
  await boardScenario({ swimlanes: true }, async (page, fixture) => {
    await page.evaluate(path => {
      const app = (window as any).app;
      const original = app.fileManager.processFrontMatter;
      (window as any).r7OriginalWrite = original;
      app.fileManager.processFrontMatter = async function(file: any, callback: any) {
        if (file.path === path) await new Promise((resolve, reject) => { (window as any).r7FailWrite = () => reject(new Error('Isolated R7 write-failure fixture')); });
        return original.call(this, file, callback);
      };
    }, `${fixture}/0.md`);
    const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${fixture}/0.md"]`);
    const target = page.locator('.kanban-view__swimlane-column[data-column="doing"][data-swimlane="normal"]');
    await lift(page, source);
    const bounds = (await target.boundingBox())!;
    await page.mouse.move(bounds.x + 80, bounds.y + 20, { steps: 20 });
    await expect(target).toHaveClass(/--dragover/);
    await capture(page, `${evidence}/light-1180-swimlane-drag.png`);
    await page.mouse.up();
    await expect(source).toHaveAttribute('aria-busy', 'true');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
      await capture(page, `${evidence}/${theme}-1180-pending.png`);
    }
    await page.evaluate(() => (window as any).r7FailWrite());
    await expect(source).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.tn-toast, .notice').filter({ hasText: /fail|unable|could not|couldn't/i }).first()).toBeVisible();
    await expect(page.locator(`.kanban-view__swimlane-column[data-column="open"][data-swimlane="high"] .kanban-view__card-wrapper[data-task-path="${fixture}/0.md"]`)).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
      await capture(page, `${evidence}/${theme}-1180-failed.png`);
    }
    const content = await page.evaluate(async path => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(path));
    }, `${fixture}/0.md`);
    expect(content).toContain('status: open');
    expect(content).toContain('priority: high');
  });
});

test('touch long-press preview cancels cleanly and does not leave sticky hover', async () => {
  await boardScenario({ touch: true }, async (page, fixture) => {
    await page.evaluate(() => document.body.classList.add('is-mobile'));
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const source = page.locator(`[data-task-path="${fixture}/0.md"].kanban-view__card-wrapper`);
    const bounds = (await source.boundingBox())!;
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + 20 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect(page.locator('.kanban-view__touch-ghost')).toBeVisible();
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 30, y: point.y + 25 }] });
    await capture(page, `${evidence}/light-1180-touch-drag.png`);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(page.locator('.kanban-view__touch-ghost, .kanban-view__touch-drag-source')).toHaveCount(0);
    await expect(source).not.toHaveClass(/--dragging/);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });
});
