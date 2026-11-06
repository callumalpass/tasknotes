import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const evidence = process.env.TASKNOTES_R8_EVIDENCE ?? join(tmpdir(), 'tasknotes-round8');
const folder = `Round8-${Date.now()}`;
let instance: Awaited<ReturnType<typeof launchObsidian>>;
let page: Page;
let settings: any;
const observations: Record<string, unknown> = {};

test.use({ trace: 'on' });

function pointer(...actions: Array<[string, number, number?]>) {
  execFileSync('python3', ['-c', `
import ctypes, json, os, time
xlib = ctypes.CDLL('libX11.so.6'); xtest = ctypes.CDLL('libXtst.so.6')
xlib.XOpenDisplay.restype = ctypes.c_void_p
display = xlib.XOpenDisplay(os.environ['DISPLAY'].encode())
xlib.XFlush.argtypes = [ctypes.c_void_p]
xlib.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
xtest.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
for action in json.loads(${JSON.stringify(JSON.stringify(actions))}):
 if action[0] == 'move': xtest.XTestFakeMotionEvent(display, -1, int(action[1]), int(action[2]), 0)
 elif action[0] == 'button': xtest.XTestFakeButtonEvent(display, 1, int(action[1]), 0)
 elif action[0] == 'escape':
  key = xlib.XKeysymToKeycode(display, 0xff1b)
  xtest.XTestFakeKeyEvent(display, key, 1, 0); xtest.XTestFakeKeyEvent(display, key, 0, 0)
 xlib.XFlush(display); time.sleep(0.08)
`]);
}

async function moveNative(pointerX: number, pointerY: number) {
  await page.evaluate(({ pointerX, pointerY }) => {
    const state = window as any;
    state.r8DragPoint = null;
    state.r8DragArrivals = 0;
    state.r8DragObserver = (event: DragEvent) => {
      setTimeout(() => {
        state.r8DragPoint = { x: event.clientX, y: event.clientY, accepted: event.defaultPrevented, effect: event.dataTransfer?.dropEffect };
        if (event.defaultPrevented && Math.abs(event.clientX - pointerX) <= 10 && Math.abs(event.clientY - pointerY) <= 4) state.r8DragArrivals++;
      }, 0);
    };
    document.addEventListener('dragover', state.r8DragObserver, { capture: true });
  }, { pointerX, pointerY });
  try {
    await expect.poll(async () => {
      pointer(['move', pointerX - 8, pointerY - 4], ['move', pointerX + 8, pointerY - 2], ['move', pointerX, pointerY]);
      return page.evaluate(() => (window as any).r8DragArrivals);
    }).toBeGreaterThanOrEqual(2);
  } finally {
    await page.evaluate(() => document.removeEventListener('dragover', (window as any).r8DragObserver, true));
  }
}

async function open(type = 'tasknotesTaskList', grouped = true, sorted = false) {
  await page.evaluate(async ({ folder, content, type, grouped, sorted }) => {
    const app = (window as any).app;
    const path = `${folder}/${type}-${grouped}-${sorted}.base`;
    const file = app.vault.getAbstractFileByPath(path) ?? await app.vault.create(path, content);
    await app.vault.modify(file, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, type, grouped, sorted, content: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type, name: 'Review', ...(grouped ? { groupBy: { property: 'status', direction: 'ASC' } } : {}), order: ['status', 'priority', 'scheduled', 'due', 'tags', 'contexts', 'projects'], sort: [{ property: sorted ? 'file.name' : 'tasknotes_manual_order', direction: 'ASC' }] }] }) });
  await expect(page.locator('.workspace-leaf.mod-active .task-card').first()).toBeVisible();
  await expect(page.locator(`.workspace-leaf.mod-active .tn-${type}`)).toBeVisible();
}

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  instance = await launchObsidian(); page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().setPosition(0, 0));
  settings = await page.evaluate(async folder => {
    const app = (window as any).app; const plugin = app.plugins.plugins.tasknotes;
    const original = JSON.parse(JSON.stringify(plugin.settings));
    plugin.settings.taskIdentificationMethod = 'tag'; plugin.settings.taskTag = 'task';
    plugin.settings.enableModalSplitLayout = false;
    app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (let index = 0; index < 60; index++) await app.vault.create(`${folder}/${String(index).padStart(2, '0')}.md`, `---\ntitle: Review task ${index}\nstatus: ${index < 45 ? 'open' : index < 58 ? 'in-progress' : 'done'}\npriority: high\ntags: [task, work]\ncontexts: [phone, studio]\nprojects: ['[[Project]]']\ndue: 2026-11-07\n---\nDetails\n`);
    return original;
  }, folder);
  await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/59.md`), folder)).toBe(true);
  await page.evaluate(() => document.querySelectorAll('.notice').forEach(element => element.remove()));
});

test.afterAll(async () => {
  writeFileSync(`${evidence}/observations.json`, JSON.stringify(observations, null, 2));
  try { if (page && !page.isClosed()) await page.evaluate(async ({ folder, settings }) => {
    const app = (window as any).app; const plugin = app.plugins.plugins.tasknotes; Object.assign(plugin.settings, settings);
    plugin.priorityManager.updatePriorities(settings.customPriorities);
    const fixture = app.vault.getAbstractFileByPath(folder); if (fixture) await app.vault.delete(fixture, true);
  }, { folder, settings }); } finally { if (instance) await closeObsidian(instance); }
});

test.afterEach(async ({}, info) => {
  if (page && !page.isClosed()) observations.nativeLastPoint = await page.evaluate(() => (window as any).r8DragPoint);
  if (page && !page.isClosed()) observations.boardEvents = await page.evaluate(() => (window as any).r8BoardEvents);
  writeFileSync(`${evidence}/${info.title.replace(/[^a-z0-9]+/gi, '-')}.json`, JSON.stringify(observations, null, 2));
  if (info.status !== info.expectedStatus && page && !page.isClosed()) await page.screenshot({ path: `${evidence}/failure-${info.testId.replace(/[^a-z0-9]+/gi, '-')}.png` });
  pointer(['escape', 0], ['button', 0]);
});

test('native XTest list edge scroll ends on Escape and loses its tooltip', async () => {
  test.setTimeout(120000);
  await open();
  await page.evaluate(folder => {
    const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
    selection.selectTask(`${folder}/00.md`);
    selection.addToSelection(`${folder}/01.md`);
  }, folder);
  const source = page.locator(`.task-card[data-task-path="${folder}/00.md"]`).first();
  await source.hover();
  const handle = source.locator('[data-tn-drag-handle]');
  const start = (await handle.boundingBox())!;
  const offset = await page.evaluate(() => ({ x: window.screenX, y: window.screenY + window.outerHeight - window.innerHeight }));
  await expect.poll(async () => (await page.locator('.workspace-leaf.mod-active .tn-bases-items-container').boundingBox())!.height).toBeGreaterThan(650);
  const bounds = (await page.locator('.workspace-leaf.mod-active .tn-bases-items-container').boundingBox())!;
  const scroll = () => page.locator('.workspace-leaf.mod-active .tn-bases-items-container').evaluate(element => {
    let scroller = element as HTMLElement; while (scroller.scrollHeight <= scroller.clientHeight && scroller.parentElement) scroller = scroller.parentElement; return scroller.scrollTop;
  });
  const original = await scroll();
  await source.evaluate(element => element.addEventListener('drag', () => element.setAttribute('data-native-drag', 'true'), { once: true }));
  pointer(['move', start.x + offset.x + start.width / 2, start.y + offset.y + start.height / 2]);
  await page.waitForTimeout(800);
  pointer(['button', 1], ['move', start.x + offset.x + 25, start.y + offset.y + 15], ['move', bounds.x + offset.x + bounds.width / 2, Math.min(795, bounds.y + bounds.height - 3) + offset.y]);
  await expect(page.locator('.task-list-view--moving')).toBeVisible();
  pointer(['move', 200 + offset.x, 300 + offset.y], ['move', 400 + offset.x, 500 + offset.y]);
  await expect(source).toHaveAttribute('data-native-drag', 'true');
  await expect(page.locator('.task-list-view__touch-ghost')).toHaveAttribute('data-drag-count', '2');
  observations.multiPreview = await page.locator('.task-list-view__touch-ghost').evaluate(element => ({ bounds: element.getBoundingClientRect().toJSON(), stack: getComputedStyle(element).boxShadow }));
  expect((observations.multiPreview as { stack: string }).stack).not.toBe('none');
  await page.screenshot({ path: `${evidence}/list-multi-preview.png` });
  await moveNative(bounds.x + bounds.width / 2, Math.min(780, bounds.y + bounds.height - 12));
  await expect.poll(scroll).toBeGreaterThan(original + 10);
  expect(await scroll()).toBeLessThan(1000);
  observations.heldTooltip = await page.locator('.tooltip').allTextContents();
  await page.screenshot({ path: `${evidence}/list-edge-held.png` });
  pointer(['escape', 0], ['button', 0], ['move', 600, 300]);
  await expect(page.locator('.task-list-view--moving')).toHaveCount(0);
  const before = await scroll(); await page.waitForTimeout(450); const after = await scroll();
  observations.edgeScrollAfterEscape = { before, after };
  await page.screenshot({ path: `${evidence}/list-edge-cancelled.png` });
  expect(after).toBe(before); await expect(page.locator('.tooltip')).toHaveCount(0); expect(observations.heldTooltip).toEqual([]);
  const cancellations = [];
  observations.cancellations = cancellations;
  for (const end of ['blur', 'touch-pointercancel', 'refresh', 'outside-drop', 'leaf-switch']) {
    observations.cancellationPhase = end;
    await source.scrollIntoViewIfNeeded();
    const restart = (await handle.boundingBox())!;
    await page.evaluate(() => {
      (window as any).r8NativeReady = false;
      (window as any).r8NativeEnded = false;
      document.addEventListener('drag', () => { (window as any).r8NativeReady = true; }, { once: true });
      document.addEventListener('dragend', () => { (window as any).r8NativeEnded = true; }, { once: true });
    });
    pointer(['move', restart.x + restart.width / 2, restart.y + restart.height / 2], ['button', 1], ['move', restart.x + 25, restart.y + 15]);
    await expect(page.locator('.task-list-view--moving')).toBeVisible();
    pointer(['move', 300, 300], ['move', 500, 500]);
    await page.waitForFunction(() => (window as any).r8NativeReady);
    await moveNative(bounds.x + bounds.width / 2, 775);
    await expect.poll(scroll).toBeGreaterThan(5);
    const scroller = await page.locator('.workspace-leaf.mod-active .tn-bases-items-container').elementHandle();
    if (end === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (end === 'touch-pointercancel') await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' })));
    if (end === 'refresh') {
      const dragged = await source.elementHandle();
      await page.evaluate(() => (window as any).app.workspace.trigger('css-change'));
      expect(await dragged!.evaluate(element => element.isConnected)).toBe(true);
      pointer(['escape', 0], ['button', 0]);
    }
    if (end === 'outside-drop') pointer(['move', 20, 150], ['move', 20, 170], ['button', 0]);
    if (end === 'leaf-switch') await page.evaluate(async () => { await (window as any).app.workspace.getLeaf('tab').setViewState({ type: 'empty', active: true }); });
    await expect(page.locator('.task-list-view--moving')).toHaveCount(0);
    const cancelled = await scroller!.evaluate(element => element.scrollTop);
    pointer(['move', bounds.x + bounds.width / 2 + 1, 775]);
    await page.waitForTimeout(450);
    const settled = await scroller!.evaluate(element => element.scrollTop);
    cancellations.push({ end, before: cancelled, after: settled });
    expect(settled).toBe(cancelled);
    pointer(['escape', 0], ['button', 0], ['move', 600, 300]);
    await page.waitForFunction(() => (window as any).r8NativeEnded);
  }
  await page.evaluate(async ({ folder, content }) => {
    const app = (window as any).app;
    app.plugins.plugins.tasknotes.taskSelectionService.clearSelection();
    const file = await app.vault.create(`${folder}/Last row.base`, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, content: stringify({ filters: { or: [`file.path == "${folder}/00.md"`, `file.path == "${folder}/01.md"`] }, views: [{ type: 'tasknotesTaskList', name: 'Last row', order: ['status', 'priority'], sort: [{ property: 'tasknotes_manual_order', direction: 'ASC' }] }] }) });
  const rows = page.locator('.workspace-leaf.mod-active .task-card');
  await expect(rows).toHaveCount(2);
  const appendSource = rows.first();
  const appendPath = await appendSource.getAttribute('data-task-path');
  const appendStart = (await appendSource.boundingBox())!;
  pointer(['move', appendStart.x + 80, appendStart.y + 15], ['button', 1], ['move', appendStart.x + 110, appendStart.y + 20]);
  await expect(page.locator('.task-list-view--moving')).toBeVisible();
  pointer(['move', 300, 300], ['move', 500, 500]);
  await moveNative(600, 700);
  await expect(page.locator('.task-list-view--invalid-drop')).toHaveCount(0);
  pointer(['button', 0], ['move', 600, 100]);
  const vaultPath = await page.evaluate(() => (window as any).app.vault.adapter.getBasePath());
  await expect.poll(() => readFileSync(join(vaultPath, appendPath!), 'utf8')).toContain('tasknotes_manual_order:');
  await expect(rows.last()).toHaveAttribute('data-task-path', appendPath!);
  observations.belowLastRowAppend = appendPath;
  await expect(page.locator('.tn-toast__message')).toHaveText('1 task updated');
  await page.locator('.tn-toast button').filter({ hasText: 'Undo' }).click();
  await expect(page.locator('.tn-toast__message')).toHaveText('Change undone.');
});

test('phone long press keeps actions open after lift', async () => {
  await page.evaluate(() => { document.body.classList.add('is-mobile'); });
  await open(); await setObsidianViewport(page, { width: 400, height: 800 });
  const source = page.locator('.workspace-leaf.mod-active .task-card__title-text').first();
  const bounds = (await source.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + 25, y: bounds.y + bounds.height / 2 }] });
  await expect(page.locator('.menu')).toBeVisible();
  await page.screenshot({ path: `${evidence}/phone-held.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  observations.phoneLift = { sheets: await page.locator('.menu').count(), modals: await page.locator('.modal.mod-tasknotes').count() };
  await page.screenshot({ path: `${evidence}/phone-lift.png` });
  await expect(page.locator('.menu')).toBeVisible(); await expect(page.locator('.modal.mod-tasknotes')).toHaveCount(0);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await cdp.detach();
  await page.evaluate(() => { document.body.classList.remove('is-mobile'); });
  await setObsidianViewport(page, { width: 1180, height: 800 });
});

test('draft Escape keeps editing and priority shortcuts consume the trigger', async () => {
  const existingPaths = await page.evaluate(() => (window as any).app.vault.getMarkdownFiles().map((file: any) => file.path));
  await page.evaluate(() => (window as any).app.commands.executeCommandById('tasknotes:create-new-task'));
  const input = page.locator('.modal.mod-tasknotes .tn-task-modal__markdown-editor--nlp .cm-content').first();
  await expect(input).toBeVisible(); await input.fill('Call Sam tomorrow at 3pm #work @phone !high 30m');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  observations.draftAfterEscape = { modals: await page.locator('.modal.mod-tasknotes').count(), text: await input.textContent({ timeout: 500 }).catch(() => null) };
  await expect(input).toBeVisible(); await expect(input).toContainText('Call Sam');
  const composerTop = (await page.locator('.modal.mod-tasknotes').boundingBox())!.y;
  await page.locator('.tn-task-modal__details-toggle').click();
  await expect(input).toBeVisible(); await expect(input).toContainText('!high');
  expect((await page.locator('.modal.mod-tasknotes').boundingBox())!.y).toBe(composerTop);
  if (await input.isVisible()) {
    await page.getByRole('button', { name: 'Create task', exact: true }).click();
    await expect(page.locator('.modal.mod-tasknotes')).toHaveCount(0);
    const created = await page.evaluate(async existingPaths => { const app = (window as any).app; const file = app.vault.getMarkdownFiles().find((file: any) => !existingPaths.includes(file.path) && file.basename.startsWith('Call Sam')); if (!file) return null; return { path: file.path, content: await app.vault.read(file) }; }, existingPaths);
    observations.created = created;
    expect(created).not.toBeNull(); expect(created?.path).not.toContain('!');
    expect(created?.content).toContain('priority: high');
    if (created) await page.evaluate(async path => { const app = (window as any).app; await app.vault.delete(app.vault.getAbstractFileByPath(path)); }, created.path);
  }
});

test('board lane gaps, metadata and no-priority configuration', async () => {
  await open('tasknotesKanban');
  await page.evaluate(() => {
    (window as any).r8BoardEvents = [];
    for (const name of ['dragstart', 'dragover', 'drop', 'dragend']) document.addEventListener(name, event => {
      const drag = event as DragEvent;
      const events = (window as any).r8BoardEvents;
      events.push({ name, x: drag.clientX, y: drag.clientY, target: (drag.target as HTMLElement).className, types: Array.from(drag.dataTransfer?.types ?? []) });
      if (events.length > 25) events.shift();
    }, { capture: true });
  });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
    await page.screenshot({ path: `${evidence}/board-${theme}.png` });
  }
  observations.laneGaps = await page.locator('.kanban-view__column').evaluateAll(columns => columns.map(column => { const cards = Array.from(column.querySelectorAll('.task-card')).slice(0, 2).map(card => card.getBoundingClientRect()); return { group: (column as HTMLElement).dataset.group, gap: cards.length === 2 ? cards[1].top - cards[0].bottom : null }; }));
  for (const lane of observations.laneGaps as Array<{ gap: number | null }>) if (lane.gap !== null) expect(lane.gap).toBe(8);
  const bottomGap = await page.locator('.kanban-view__board').evaluate(board => {
    const bottom = board.getBoundingClientRect().top + board.clientHeight - parseFloat(getComputedStyle(board).paddingBottom);
    return Math.max(...Array.from(board.querySelectorAll('.kanban-view__column')).map(column => bottom - column.getBoundingClientRect().bottom));
  });
  expect(bottomGap).toBeLessThanOrEqual(1);
  const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/00.md"]`);
  const start = (await source.locator('.task-card__title-text').boundingBox())!;
  await source.evaluate(element => element.addEventListener('drag', () => element.setAttribute('data-native-drag', 'true'), { once: true }));
  pointer(['move', start.x + 30, start.y + 10], ['button', 1], ['move', start.x + 60, start.y + 15]);
  await expect(page.locator('.kanban-view__floating-drag-preview')).toBeVisible();
  pointer(['move', start.x + 90, start.y + 30]);
  await expect(source).toHaveAttribute('data-native-drag', 'true');
  const destination = (await page.locator('.kanban-view__column[data-group="done"]').boundingBox())!;
  await moveNative(destination.x + destination.width / 2, destination.y + destination.height - 20);
  await expect(page.locator('.kanban-view__column[data-group="done"]')).toHaveClass(/kanban-view__column--dragover/);
  pointer(['button', 0], ['move', 600, 100]);
  observations.boardEvents = await page.evaluate(() => (window as any).r8BoardEvents);
  await page.waitForFunction(path => {
    const card = document.querySelector(`.kanban-view__column[data-group="done"] .task-card[data-task-path="${path}"]`);
    return card && !card.closest('[aria-busy="true"]');
  }, `${folder}/00.md`);
  const vaultPath = await page.evaluate(() => (window as any).app.vault.adapter.getBasePath());
  await expect.poll(() => readFileSync(join(vaultPath, folder, '00.md'), 'utf8')).toContain('status: done');
  await expect(page.locator('.kanban-view__column[data-group="done"] .task-card').last()).toHaveAttribute('data-task-path', `${folder}/00.md`);
  await page.evaluate(() => { const plugin = (window as any).app.plugins.plugins.tasknotes; plugin.settings.customPriorities = []; plugin.priorityManager.updatePriorities([]); });
  await open();
  observations.noPriorities = await page.locator('.workspace-leaf.mod-active .task-card__priority-dot').count();
  await page.screenshot({ path: `${evidence}/no-priorities.png` });
  await expect(page.locator('.workspace-leaf.mod-active .task-card__priority-dot')).toHaveCount(0);
  await page.evaluate(() => (window as any).app.commands.executeCommandById('tasknotes:create-new-task'));
  await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
  await expect(page.locator('.modal.mod-tasknotes [data-type="priority"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('sorted list explains its restriction once beside the real pointer', async () => {
  await page.evaluate(() => { const plugin = (window as any).app.plugins.plugins.tasknotes; plugin.settings.customPriorities = []; plugin.priorityManager.updatePriorities([]); });
  await open('tasknotesTaskList', false, true);
  const source = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/01.md"]`);
  await source.scrollIntoViewIfNeeded();
  await expect(source).toBeVisible();
  const start = (await source.boundingBox())!;
  await source.evaluate(element => element.addEventListener('drag', () => element.setAttribute('data-native-drag', 'true'), { once: true }));
  pointer(['move', start.x + 80, start.y + 14], ['button', 1], ['move', start.x + 110, start.y + 20]);
  await expect(page.locator('.task-list-view--moving')).toBeVisible();
  pointer(['move', start.x + 130, start.y + 28]);
  await expect(source).toHaveAttribute('data-native-drag', 'true');
  const target = (await page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/03.md"]`).boundingBox())!;
  await moveNative(target.x + 120, target.y + 8);
  const reason = page.locator('.task-list-view__movement-feedback');
  await expect(reason).toHaveCount(1); await expect(reason).toContainText('sort this view');
  await expect(page.locator('.kanban-view__drag-feedback')).toHaveCount(0);
  expect(Math.abs((await reason.boundingBox())!.x - (target.x + 121))).toBeLessThan(60);
  await page.screenshot({ path: `${evidence}/sorted-list-held.png` });
  pointer(['escape', 0], ['button', 0], ['move', 600, 300]);
  await expect(reason).toHaveCount(0);
});
