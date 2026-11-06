import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = join(tmpdir(), 'tasknotes-r7', 'board', '653f67e0', phase);
const folder = `BoardOP1-${Date.now()}`;
let instance: Awaited<ReturnType<typeof launchObsidian>>;
let page: Page;
let settings: any;

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian();
  page = instance.page;
  settings = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = { taskIdentificationMethod: plugin.settings.taskIdentificationMethod, taskTag: plugin.settings.taskTag };
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (let index = 0; index < 50; index++) {
      await app.vault.create(`${folder}/Task ${String(index).padStart(2, '0')}.md`,
        `---\ntitle: ${index === 0 ? 'A long title for a narrow pane with all metadata visible' : `Task ${String(index).padStart(2, '0')}`}\nstatus: ${index < 39 ? 'open' : index < 46 ? 'in-progress' : 'done'}\ntags: [task]\npriority: high\nscheduled: 2025-12-30T09:00\ndue: 2025-12-31T15:30\ncontexts: [studio, focus]\nprojects: ['[[Project]]']\n---\n`);
    }
    return original;
  }, folder);
  const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
  if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, settings);
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, settings });
  } finally { if (instance) await closeObsidian(instance); }
});

async function openView(type: 'tasknotesTaskList' | 'tasknotesKanban', name: string, direction = 'DESC') {
  await page.evaluate(async ({ folder, name, content }) => {
    const app = (window as any).app;
    const filepath = `${folder}/${name}.base`;
    const file = app.vault.getAbstractFileByPath(filepath) ?? await app.vault.create(filepath, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, name, content: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type, name,
    groupBy: { property: 'status', direction: 'ASC' }, order: ['status', 'priority', 'scheduled', 'due', 'contexts', 'projects'],
    sort: [{ property: 'tasknotes_manual_order', direction }], enableSearch: true }] }) });
  const root = page.locator(`.workspace-leaf.mod-active .tn-${type}`);
  await expect(root.locator('.task-card').first()).toBeVisible();
  return root;
}

async function paths(root: Locator, group = 'open') {
  return root.locator(`.kanban-view__column[data-group="${group}"] .task-card, .task-list-view__group[data-group-key="${group}"] .task-card`).evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.taskPath!));
}

async function drag(source: Locator, target: Locator, above: boolean) {
  await source.scrollIntoViewIfNeeded();
  await source.hover();
  let previousBounds = '';
  await expect.poll(async () => {
    const current = JSON.stringify(await source.boundingBox());
    const stable = previousBounds === current;
    previousBounds = current;
    return stable;
  }).toBe(true);
  const start = (await source.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + 18);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 18, start.y + 18, { steps: 6 });
  await expect(page.locator('.kanban-view__board--task-dragging')).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const end = (await target.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, above ? end.y + 4 : end.y + end.height - 4, { steps: 12 });
  await page.mouse.up();
}

test('one card drop preserves every other rank and list agrees after refresh', async () => {
  test.setTimeout(120000);
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const root = await openView('tasknotesKanban', 'Ranks');
  const column = root.locator('.kanban-view__column[data-group="in-progress"]');
  const before = await paths(root, 'in-progress');
  expect(before).toHaveLength(7);
  await page.screenshot({ path: `${evidence}/rank-before.png` });
  await drag(column.locator('.task-card').nth(3), column.locator('.task-card').nth(1), true);
  await expect(root.locator('[aria-busy="true"]')).toHaveCount(0);
  const intended = [...before];
  intended.splice(1, 0, intended.splice(3, 1)[0]);
  writeFileSync(`${evidence}/drop-result.json`, JSON.stringify({ before, intended, after: await paths(root, 'in-progress'), toast: await page.locator('.tn-toast').textContent() }, null, 2));
  await page.screenshot({ path: `${evidence}/rank-drop.png` });
  await expect(page.locator('.tn-toast')).toContainText('Moved 1 task');
  await expect.poll(() => paths(root, 'in-progress')).toEqual(intended);
  await page.screenshot({ path: `${evidence}/rank-after.png` });
  const stored = await page.evaluate(async folder => {
    const app = (window as any).app;
    return Promise.all(app.vault.getMarkdownFiles().filter((file: any) => file.path.startsWith(folder)).map(async (file: any) => ({ path: file.path, text: await app.vault.read(file) })));
  }, folder);
  writeFileSync(`${evidence}/rank-writes.json`, JSON.stringify(stored, null, 2));
  await openView('tasknotesTaskList', 'Rank list');
  const listPaths = await page.locator('.workspace-leaf.mod-active .task-card').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.taskPath!).filter(path => /Task (39|4[0-5])\.md$/.test(path)));
  expect(listPaths).toEqual(intended);
  const refreshed = await openView('tasknotesKanban', 'Ranks');
  await expect.poll(() => paths(refreshed, 'in-progress')).toEqual(intended);
  const destinationBefore = await paths(refreshed, 'done');
  const moved = intended[2];
  await drag(refreshed.locator(`.task-card[data-task-path="${moved}"]`), refreshed.locator('.kanban-view__column[data-group="done"] .task-card').nth(1), true);
  const destinationAfter = [...destinationBefore];
  destinationAfter.splice(1, 0, moved);
  await expect.poll(() => paths(refreshed, 'in-progress')).toEqual(intended.filter(path => path !== moved));
  await expect.poll(() => paths(refreshed, 'done')).toEqual(destinationAfter);
  await expect(page.locator('.tn-toast')).toContainText('Moved 1 task to Done');
  const crossList = await openView('tasknotesTaskList', 'Cross list');
  const listOrder = () => crossList.locator('.task-card').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.taskPath!));
  expect((await listOrder()).filter(path => destinationAfter.includes(path))).toEqual(destinationAfter);
  expect((await listOrder()).filter(path => intended.includes(path) && path !== moved)).toEqual(intended.filter(path => path !== moved));
  writeFileSync(`${evidence}/cross-drop-result.json`, JSON.stringify({ destinationBefore, destinationAfter, sourceAfter: await paths(await openView('tasknotesKanban', 'Ranks'), 'in-progress') }, null, 2));
});

test('sparse initial reorder limits note writes and subsequent moves write only the moved note', async () => {
  test.setTimeout(120000);
  if (phase === 'before') {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/Task 20.md`), (frontmatter: any) => { frontmatter.tasknotes_manual_order = 'tnmmmmmmmmmm'; });
    }, folder);
    const list = await openView('tasknotesTaskList', 'Null order');
    await expect.poll(() => list.locator('.task-card').count()).toBeGreaterThan(0);
    writeFileSync(`${evidence}/native-null-order.json`, JSON.stringify(await list.locator('.task-card').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.taskPath)), null, 2));
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/Task 20.md`), (frontmatter: any) => { delete frontmatter.tasknotes_manual_order; });
    }, folder);
  }
  const root = await openView('tasknotesKanban', 'Sparse');
  const column = root.locator('.kanban-view__column[data-group="open"]');
  const original = await paths(root);
  const source = column.locator('.task-card').nth(0);
  const sourcePath = await source.getAttribute('data-task-path');
  await drag(source, column.locator('.task-card').nth(2), true);
  if (phase === 'before') {
    await expect(page.locator('.modal')).toBeVisible();
    await page.screenshot({ path: `${evidence}/large-reorder.png` });
    await page.keyboard.press('Escape');
    return;
  }
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.tn-toast')).toContainText('Moved 1 task');
  await page.locator('.tn-toast button').filter({ hasText: 'Undo' }).focus();
  const readWrites = () => page.evaluate(async folder => {
    const app = (window as any).app;
    const files = app.vault.getMarkdownFiles().filter((file: any) => file.path.startsWith(folder));
    const texts = await Promise.all(files.map(async (file: any) => ({ path: file.path, text: await app.vault.read(file) })));
    return texts.filter((file: any) => /status: open/.test(file.text) && /tasknotes_manual_order:/.test(file.text)).map((file: any) => file.path);
  }, folder);
  await expect.poll(readWrites).toContain(sourcePath);
  const writes = await readWrites();
  writeFileSync(`${evidence}/sparse-writes.json`, JSON.stringify(writes, null, 2));
  expect(writes.sort()).toEqual([`${folder}/Task 00.md`, `${folder}/Task 01.md`]);
  const firstOrder = await paths(root);
  const readRankedNotes = () => page.evaluate(async folder => {
    const app = (window as any).app;
    return Object.fromEntries(await Promise.all(['00', '01'].map(async number => {
      const path = `${folder}/Task ${number}.md`;
      return [path, await app.vault.read(app.vault.getAbstractFileByPath(path))];
    })));
  }, folder);
  const beforeNext = await readRankedNotes();
  await drag(column.locator(`.task-card[data-task-path="${folder}/Task 00.md"]`), column.locator(`.task-card[data-task-path="${folder}/Task 01.md"]`), true);
  await expect(root.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.locator('.tn-toast button').filter({ hasText: 'Undo' }).focus();
  await expect.poll(async () => {
    const notes = await readRankedNotes();
    return Object.keys(beforeNext).filter(path => beforeNext[path] !== notes[path]);
  }).toEqual([sourcePath]);
  await page.locator('.tn-toast button').filter({ hasText: 'Undo' }).click();
  await expect.poll(() => paths(root)).toEqual(firstOrder);
  await root.locator('.task-card').first().focus();
  await page.keyboard.press('Control+z');
  await expect.poll(() => paths(root)).toEqual(original);
});

test('narrow dates, hover refresh, keyboard overlays and touch menus retain their contracts', async () => {
  test.setTimeout(180000);
  for (const type of ['tasknotesTaskList', 'tasknotesKanban'] as const) {
    const root = await openView(type, `States-${type}`);
    for (const width of [1180, 700, 430, 400]) for (const theme of ['light', 'dark']) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(theme => {
        document.body.classList.remove('is-mobile');
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
      }, theme);
      const card = root.locator('.task-card').first();
      await card.scrollIntoViewIfNeeded();
      await card.locator('.task-card__title-text').hover();
      if (type === 'tasknotesTaskList') {
        const dates = card.locator('.task-card__date-slot:not([hidden]) .task-card__date-value:visible');
        const geometry = await dates.evaluateAll(labels => labels.map(label => ({ height: label.getBoundingClientRect().height, width: label.getBoundingClientRect().width, scrollWidth: label.scrollWidth, whiteSpace: getComputedStyle(label).whiteSpace })));
        expect(geometry.every(label => label.height < 25)).toBe(true);
        if (width <= 700) expect(geometry.every(label => label.whiteSpace === 'nowrap')).toBe(true);
        if (width >= 430) expect(geometry).toHaveLength(2);
      } else {
        expect(await card.evaluate(card => getComputedStyle(card).backgroundColor)).toBe(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--background-primary').trim()).then(value => page.evaluate(value => {
          const probe = document.createElement('span'); probe.style.backgroundColor = value; document.body.appendChild(probe); const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color;
        }, value)));
      }
      await page.screenshot({ path: `${evidence}/${type}-${width}-${theme}-hover.png` });
    }
    await setObsidianViewport(page, { width: 1180, height: 800 });
    const card = root.locator('.task-card').first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('.task-card__title-text').hover();
    if (type === 'tasknotesTaskList') {
      const opacity = await card.locator('.task-card__drag-handle').evaluate(handle => getComputedStyle(handle).opacity);
      await page.evaluate(() => (window as any).app.workspace.trigger('css-change'));
      await expect(card.locator('.task-card__drag-handle')).toHaveCSS('opacity', opacity);
    }
    await root.focus();
    await page.keyboard.press('j');
    await page.keyboard.press('s');
    const statusBounds = await page.locator('.tn-popover').boundingBox();
    await page.keyboard.press('Escape');
    await page.keyboard.press('p');
    const priorityBounds = await page.locator('.tn-popover').boundingBox();
    expect(Math.abs(statusBounds!.x - priorityBounds!.x)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await card.locator('.task-card__title-text').hover();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.tn-picker')).toBeVisible();
    await expect(page.locator('.hover-popover')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await root.focus();
    await page.keyboard.press('/');
    const search = root.locator('.tn-search-box input');
    await search.fill('Task');
    await search.press('Escape');
    await expect(search).toHaveValue('');
    await search.press('Escape');
    await expect(root.locator('.tn-search-box')).toHaveCount(0);
    await page.evaluate(() => (window as any).app.workspace.trigger('css-change'));
    await expect(root.locator('.tn-search-box')).toHaveCount(0);
  }
  await setObsidianViewport(page, { width: 400, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  const list = await openView('tasknotesTaskList', 'Touch');
  const card = list.locator('.task-card').first();
  await card.scrollIntoViewIfNeeded();
  const bounds = (await card.locator('.task-card__title-text').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + 12, y: bounds.y + 8 }] });
  await expect(page.locator('.menu')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.tooltip')).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/list-400-touch-menu.png` });
  await page.keyboard.press('Escape');
  await cdp.detach();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      document.body.classList.toggle('theme-light', theme === 'light');
      document.body.classList.toggle('theme-dark', theme === 'dark');
    }, theme);
    const board = await openView('tasknotesKanban', `Phone-${theme}`);
    await expect(board.locator('.kanban-view__column-nav select')).toBeVisible();
    await page.screenshot({ path: `${evidence}/board-400-${theme}-mobile.png` });
  }
});

test('Escape restores list and board scroll positions after edge scrolling', async () => {
  test.setTimeout(120000);
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await setObsidianViewport(page, { width: 1180, height: 800 });
  for (const type of ['tasknotesKanban', 'tasknotesTaskList'] as const) {
    await setObsidianViewport(page, { width: type === 'tasknotesKanban' ? 700 : 1180, height: 800 });
    const root = await openView(type, `Cancel-${type}`);
    if (type === 'tasknotesTaskList') await expect(root.locator('.task-card')).toHaveCount(50);
    const card = root.locator('.task-card').first();
    await card.scrollIntoViewIfNeeded();
    const scroll = type === 'tasknotesKanban' ? root.locator('.kanban-view__column[data-group="open"] .kanban-view__cards') : root.locator('.tn-bases-items-container');
    const containers = root.locator(type === 'tasknotesKanban' ? '.kanban-view__board, .kanban-view__column[data-group="open"] .kanban-view__cards' : '.tn-bases-items-container');
    const readPositions = () => containers.evaluateAll(elements => elements.map(element => ({ left: element.scrollLeft, top: element.scrollTop })));
    const positions = await readPositions();
    await root.evaluate(root => {
      const events: unknown[] = [];
      (window as any).boardDragEvents = events;
      for (const type of ['dragstart', 'dragend', 'dragenter', 'dragleave']) {
        root.addEventListener(type, event => {
          const drag = event as DragEvent;
          const target = event.target as HTMLElement;
          events.push({ type, x: drag.clientX, y: drag.clientY, target: target.className, related: (drag.relatedTarget as HTMLElement)?.className });
          if (events.length > 80) events.shift();
        }, { capture: true });
      }
    });
    await card.hover();
    await expect.poll(async () => card.evaluate(async element => {
      const before = element.getBoundingClientRect().toJSON();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return JSON.stringify(before) === JSON.stringify(element.getBoundingClientRect().toJSON());
    })).toBe(true);
    const start = (await (type === 'tasknotesTaskList' ? card.locator('[data-tn-drag-handle]') : card).boundingBox())!;
    const startY = type === 'tasknotesTaskList' ? start.y + start.height / 2 : start.y + 18;
    await page.mouse.move(start.x + start.width / 2, startY);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 18, startY, { steps: 6 });
    await expect(page.locator(type === 'tasknotesKanban' ? '.kanban-view__floating-drag-preview' : '.task-list-view__touch-ghost')).toBeVisible();
    const viewport = (await scroll.boundingBox())!;
    await page.mouse.move(viewport.x + viewport.width / 2, Math.min(viewport.y + viewport.height - 8, 780), { steps: 12 });
    const initialTop = positions[positions.length - 1].top;
    try {
      await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(initialTop + 30);
    } catch (error) {
      writeFileSync(`${evidence}/${type}-scroll-failure.json`, JSON.stringify(await root.evaluate(root => ({
        events: (window as any).boardDragEvents,
        source: root.querySelector('.task-list-view__drag-source')?.getBoundingClientRect().toJSON(),
        scrolling: [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].filter(element => element.scrollHeight > element.clientHeight && getComputedStyle(element).overflowY !== 'visible').map(element => ({ className: element.className, height: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop, overflow: getComputedStyle(element).overflowY, rect: element.getBoundingClientRect().toJSON() })),
      })), null, 2));
      throw error;
    }
    if (type === 'tasknotesKanban') {
      const bounds = (await root.locator('.kanban-view__board').boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + 80, { steps: 12 });
      await expect.poll(() => root.locator('.kanban-view__board').evaluate(element => element.scrollLeft)).toBeGreaterThan(20);
    }
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect.poll(readPositions).toEqual(positions);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await readPositions()).toEqual(positions);
    await expect(page.locator('.tn-drag-active')).toHaveCount(0);
    await page.screenshot({ path: `${evidence}/${type}-cancelled.png` });
  }
});

test('large unranked moves ask once before writing and undo all changed notes', async () => {
  test.setTimeout(120000);
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const root = await openView('tasknotesKanban', 'Large');
  const readNotes = () => page.evaluate(async folder => {
    const app = (window as any).app;
    const files = app.vault.getMarkdownFiles().filter((file: any) => file.path.startsWith(folder) && /Task (0\d|[12]\d|3[0-8])\.md$/.test(file.path));
    return Object.fromEntries(await Promise.all(files.map(async (file: any) => [file.path, await app.vault.read(file)])));
  }, folder);
  const before = await readNotes();
  const column = root.locator('.kanban-view__column[data-group="open"]');
  const source = column.locator(`.task-card[data-task-path="${folder}/Task 00.md"]`);
  const start = (await source.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + 18);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 18, start.y + 18, { steps: 6 });
  const columnBounds = (await column.boundingBox())!;
  await page.mouse.move(columnBounds.x + columnBounds.width / 2, columnBounds.y + columnBounds.height / 2, { steps: 6 });
  await column.locator('.kanban-view__cards').evaluate(element => { element.scrollTop = element.scrollHeight; });
  const target = column.locator(`.task-card[data-task-path="${folder}/Task 38.md"]`);
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const end = (await target.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + 4, { steps: 12 });
  await page.mouse.up();
  const modal = page.locator('.modal');
  await expect(modal).toContainText('Save this order?');
  await expect(modal).toContainText('38 notes');
  await expect(modal).not.toContainText('tasknotes_manual_order');
  await expect(modal.getByRole('button', { name: 'Reorder notes' })).toBeFocused();
  expect(await readNotes()).toEqual(before);
  await page.screenshot({ path: `${evidence}/large-write-confirmation.png` });
  await page.keyboard.press('Enter');
  await expect(modal).toHaveCount(0);
  await expect(root.locator('[aria-busy="true"]')).toHaveCount(0);
  const undo = page.locator('.tn-toast button').filter({ hasText: 'Undo' });
  await expect(undo).toBeVisible();
  await undo.focus();
  const after = await readNotes();
  const changed = Object.keys(before).filter(path => before[path] !== after[path]);
  expect(changed).toHaveLength(38);
  writeFileSync(`${evidence}/large-writes.json`, JSON.stringify(changed, null, 2));
  await undo.click();
  const noteState = (notes: Record<string, string>) => Object.fromEntries(Object.entries(notes).map(([path, text]) => {
    const [, frontmatter, ...body] = text.split('---');
    const properties = parse(frontmatter);
    delete properties.dateModified;
    return [path, { properties, body: body.join('---') }];
  }));
  await expect.poll(async () => noteState(await readNotes()), { timeout: 60000 }).toEqual(noteState(before));
});

test('sentence controls stay within their own line and configured priority labels remain visible', async () => {
  test.setTimeout(90000);
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const file = await app.vault.create(`${folder}/Sentence.md`, `Text above the task reference.\n\nDiscuss [[${folder}/Task 39|Task 39]] with the team.\n`);
    await app.workspace.getLeaf(false).openFile(file);
    await app.workspace.activeLeaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
  }, folder);
  const widget = page.locator('.workspace-leaf.mod-active .task-inline-preview--reading-mode.tasknotes-inline-widget--sentence');
  await expect(widget).toBeVisible();
  for (const width of [1180, 400]) for (const theme of ['light', 'dark']) {
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(theme => {
      document.body.classList.toggle('theme-light', theme === 'light');
      document.body.classList.toggle('theme-dark', theme === 'dark');
    }, theme);
    await widget.hover();
    const geometry = await widget.evaluate(widget => ({ line: widget.closest('p')!.getBoundingClientRect().toJSON(), control: widget.querySelector('.task-card__context-menu')!.getBoundingClientRect().toJSON() }));
    expect(geometry.control.top).toBeGreaterThanOrEqual(geometry.line.top - 1);
    expect(geometry.control.bottom).toBeLessThanOrEqual(geometry.line.bottom + 1);
    await page.screenshot({ path: `${evidence}/sentence-${width}-${theme}.png` });
  }
  await page.evaluate(() => {
    const manager = (window as any).app.plugins.plugins.tasknotes.priorityManager;
    manager.updatePriorities(manager.getAllPriorities().map((config: any) => config.value === 'high' ? { ...config, label: 'Critical business impact' } : config));
  });
  const root = await openView('tasknotesTaskList', 'Priority label');
  await expect(root.locator('.task-card__priority-dot').first()).toHaveAttribute('aria-label', 'Priority: Critical business impact');
  await expect(root.locator('.task-card__priority-dot').first()).toHaveAttribute('title', /Critical business impact/);
});
