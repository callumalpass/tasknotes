import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

test.use({ trace: 'on' });
let instance: ObsidianApp;
let page: Page;
let sortField = 'sort_order';
const folder = `Undo-round2-${Date.now()}`;
const vault = resolve(process.env.TASKNOTES_E2E_VAULT_DIR ?? 'tasknotes-e2e-vault');

function disk(name: string) {
  if (!existsSync(resolve(vault, folder, `${name}.md`))) return { properties: {}, body: '' };
  const content = readFileSync(resolve(vault, folder, `${name}.md`), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content)!;
  if (!match) return { properties: {}, body: content };
  const properties = parse(match[1]);
  delete properties.dateModified;
  return { properties, body: match[2] };
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  sortField = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.fieldMapper.toUserField('sortOrder'));
  page.on('console', message => { if (message.type() === 'error') console.log(message.text()); });
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const dismiss = page.locator('.notice').getByText("Don't show again", { exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (let index = 0; index < 5; index++) await app.vault.create(`${folder}/Task ${index}.md`, `---\ntitle: Task ${index}\ntags: [task]\nstatus: open\npriority: normal\nscheduled: 2026-11-06\n---\nKeep this body.\n`);
  }, folder);
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      if ((window as any).undoTasksFolder !== undefined) app.plugins.plugins.tasknotes.settings.tasksFolder = (window as any).undoTasksFolder;
      if ((window as any).undoDailyFolder !== undefined) app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = (window as any).undoDailyFolder;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

async function openView(type: string, name: string, manual = false) {
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type, name, groupBy: { property: 'status', direction: 'ASC' }, order: ['status', 'priority', 'scheduled', 'file.tags'], sort: manual ? [{ column: sortField, direction: 'ASC' }] : [{ property: 'file.name', direction: 'ASC' }], calendarView: 'timeGridWeek', showTimeblocks: true }] });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path) ?? await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { path: `${folder}/${name}.base`, content });
  const root = page.locator(`.workspace-leaf.mod-active .${type === 'tasknotesCalendar' ? 'advanced-calendar-view' : `tn-${type}`}`);
  await expect(root).toBeVisible();
  if (type !== 'tasknotesCalendar') await expect(root.locator('.task-card').first()).toBeVisible();
  await root.focus();
  return root;
}

test('five property changes survive toast replacement and undo in reverse order on disk', async ({}, testInfo) => {
  const before = Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`));
  const root = await openView('tasknotesTaskList', 'History');
  await page.keyboard.press('j');
  for (let index = 0; index < 5; index++) {
    await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', `${folder}/Task ${index}.md`);
    await expect(root).toBeFocused();
    const previousToast = await page.$('.tn-toast');
    await page.keyboard.press('p');
    const high = page.locator('.tn-picker__row[data-picker-id="high"]');
    await expect(high).toHaveAttribute('aria-selected', 'false');
    await high.click();
    await expect(page.locator('.tn-picker')).toBeHidden();
    await expect.poll(() => disk(`Task ${index}`).properties.priority).toBe('high');
    await expect(root.locator(`.task-card[data-task-path="${folder}/Task ${index}.md"]`)).toHaveAttribute('data-priority', 'high');
    if (previousToast) await expect.poll(() => previousToast.evaluate(element => element.isConnected)).toBe(false);
    await expect(page.locator('.tn-toast__action')).toBeVisible();
    await expect(root).toBeFocused();
    await testInfo.attach(`disk-after-change-${index}`, { body: JSON.stringify(Array.from({ length: 5 }, (_, taskIndex) => disk(`Task ${taskIndex}`))), contentType: 'application/json' });
    if (index < 4) await page.keyboard.press('j');
  }
  const changed = Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`));
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => {
      if (!document.body.classList.contains(`theme-${theme}`)) (window as any).app.commands.executeCommandById('theme:toggle-light-dark');
    }, theme);
    await expect(page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `test-results/undo-round2-${theme}.png`, animations: 'disabled' });
  }
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`))).toEqual([...changed.slice(0, 4), before[4]]);
  await expect(root).toBeFocused();
  for (let index = 3; index >= 0; index--) {
    await page.keyboard.press('Control+z');
    await expect.poll(() => Array.from({ length: 5 }, (_, taskIndex) => disk(`Task ${taskIndex}`))).toEqual(changed.map((task, taskIndex) => taskIndex >= index ? before[taskIndex] : task));
    await testInfo.attach(`disk-after-undo-${index}`, { body: JSON.stringify(Array.from({ length: 5 }, (_, taskIndex) => disk(`Task ${taskIndex}`))), contentType: 'application/json' });
  }
  await expect.poll(() => Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`))).toEqual(before);
  await testInfo.attach('disk-after-reverse-undo', { body: JSON.stringify(Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`))), contentType: 'application/json' });
});

test('tracking start and stop use one toast and guarded disk restoration', async () => {
  await openView('tasknotesTaskList', 'Tracking');
  const before = disk('Task 0');
  const track = async (operation: string) => page.evaluate(async ({ path, operation }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin[operation](await plugin.cacheManager.getTaskInfo(path));
  }, { path: `${folder}/Task 0.md`, operation });
  await track('startTimeTracking');
  await expect.poll(() => disk('Task 0').properties.timeEntries?.length).toBe(1);
  const started = disk('Task 0');
  await track('stopTimeTracking');
  await expect.poll(() => disk('Task 0').properties.timeEntries[0].endTime).toBeTruthy();
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('Task 0')).toEqual(started);
  await page.keyboard.press('Control+z');
  await expect.poll(() => disk('Task 0')).toEqual(before);
});

test('calendar single all-day conversion, timed move and resize restore disk files', async () => {
  await openView('tasknotesCalendar', 'Calendar');
  const before = disk('Task 0');
  for (const gesture of ['convert', 'move', 'resize']) {
    if (gesture !== 'convert') await page.evaluate(async path => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const task = await plugin.cacheManager.getTaskInfo(path);
      await plugin.taskService.updateTask(task, { scheduled: '2026-11-06T09:00', timeEstimate: 60 });
    }, `${folder}/Task 0.md`);
    const snapshot = disk('Task 0');
    await calendarGesture('Calendar', 'Task 0', gesture === 'resize' ? 'resize' : 'drop', '2026-11-06T13:00', '2026-11-06T15:00');
    await expect.poll(() => disk('Task 0')).not.toEqual(snapshot);
    await expect(page.locator('.tn-toast__action')).toHaveText('Undo');
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => disk('Task 0')).toEqual(snapshot);
  }
  await page.evaluate(async ({ path, scheduled }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.taskService.updateTask(await plugin.cacheManager.getTaskInfo(path), { scheduled, timeEstimate: undefined });
  }, { path: `${folder}/Task 0.md`, scheduled: before.properties.scheduled });
});

async function calendarGesture(viewName: string, name: string, kind: string, start: string, end: string, timeblock = false, copy = false, allDay = false) {
  await expect.poll(() => page.evaluate(async ({ viewName, path, timeblock }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases').find((leaf: any) => leaf.view.file?.basename === viewName).view.controller.view;
    await view.refetchEvents();
    return view.calendarItems.some((item: any) => timeblock ? item.data?.timeblock?.id === path : item.data?.taskInfo?.path === path);
  }, { viewName, path: timeblock ? name : `${folder}/${name}.md`, timeblock })).toBe(true);
  return page.evaluate(async ({ viewName, path, kind, start, end, timeblock, copy, allDay }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases').find((leaf: any) => leaf.view.file?.basename === viewName).view.controller.view;
    await view.refetchEvents();
    const item = view.calendarItems.find((item: any) => timeblock ? item.data?.timeblock?.id === path : item.data?.taskInfo?.path === path && item.data.modelEntry?.type === 'scheduled');
    if (!item) throw new Error(`Missing calendar item: ${path}; ${JSON.stringify(view.calendarItems.map((item: any) => ({ id: item.id, type: item.data?.modelEntry?.type, path: item.data?.taskInfo?.path })))}`);
    const parse = (value: string | null) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : null;
    const oldEvent = { id: item.id, title: item.title, start: parse(item.start), end: parse(item.end), allDay: item.allDay ?? item.start.length === 10, extendedProps: item.data };
    let reverted = false;
    await view[kind === 'resize' ? 'handleEventResize' : 'handleEventDrop']({ oldEvent, event: { ...oldEvent, start: new Date(start), end: new Date(end), allDay }, jsEvent: copy ? { ctrlKey: true } : null, isPointer: true, revert: () => { reverted = true; } });
    if (reverted && !copy) throw new Error(`Gesture reverted: ${path}`);
  }, { viewName, path: timeblock ? name : `${folder}/${name}.md`, kind, start, end, timeblock, copy, allDay });
}

test('tags produce one session toast with disk-safe Undo and keep unrelated body edits', async () => {
  const root = await openView('tasknotesTaskList', 'Tags');
  const before = disk('Task 0');
  await page.keyboard.press('j');
  await page.keyboard.press('t');
  for (const tag of ['alpha', 'beta']) {
    await page.locator('.tn-picker__input').fill(tag);
    await page.keyboard.press('Enter');
    await expect.poll(() => disk('Task 0').properties.tags).toContain(tag);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.tn-toast__message')).toContainText('Tags');
  await page.locator('.tn-toast__action').focus();
  await page.evaluate(async path => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);
    await app.vault.append(file, 'Outside edit.\n');
  }, `${folder}/Task 0.md`);
  await page.locator('.tn-toast__action').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => disk('Task 0')).toEqual({ ...before, body: `${before.body}Outside edit.\n` });
  await expect(root).toBeFocused();
});

test('timeblock creation, cross-day move and resize each restore daily notes on disk', async () => {
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
    (window as any).undoDailyFolder = daily.options.folder;
    daily.options.folder = folder;
    plugin.settings.calendarViewSettings.enableTimeblocking = true;
    for (const date of ['2026-11-06', '2026-11-07']) await app.vault.create(`${folder}/${date}.md`, `---\ntitle: Daily ${date}\n---\nDaily body.\n`);
  }, folder);
  await openView('tasknotesCalendar', 'Blocks');
  const before = disk('2026-11-06');
  await page.evaluate(() => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases').find((leaf: any) => leaf.view.file?.basename === 'Blocks').view.controller.view;
    view.handleDateSelect({ start: new Date('2026-11-06T10:00'), end: new Date('2026-11-06T11:00'), allDay: false, jsEvent: null });
  });
  await page.locator('.menu-item').filter({ hasText: 'Create timeblock' }).click();
  await page.locator('.timeblock-creation-modal textarea:not(.tn-modal__description)').first().fill('Undo focus block');
  await page.getByRole('button', { name: 'Create timeblock', exact: true }).click();
  await expect.poll(() => disk('2026-11-06').properties.timeblocks?.length).toBe(1);
  const created = disk('2026-11-06');
  const block = created.properties.timeblocks[0].id;
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('2026-11-06')).toEqual(before);
  await page.evaluate(async ({ path, blocks }) => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => { frontmatter.timeblocks = blocks; });
  }, { path: `${folder}/2026-11-06.md`, blocks: created.properties.timeblocks });
  for (const kind of ['copy', 'drop', 'resize']) {
    const snapshots = [disk('2026-11-06'), disk('2026-11-07')];
    await calendarGesture('Blocks', block, kind, kind !== 'resize' ? '2026-11-07T13:00' : '2026-11-06T10:00', kind !== 'resize' ? '2026-11-07T14:00' : '2026-11-06T12:00', true, kind === 'copy');
    await expect.poll(() => [disk('2026-11-06'), disk('2026-11-07')]).not.toEqual(snapshots);
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => [disk('2026-11-06'), disk('2026-11-07')]).toEqual(snapshots);
  }
});

test('calendar batch uses the same toast and restores both task notes', async () => {
  const root = await openView('tasknotesCalendar', 'Batch');
  const before = [disk('Task 0'), disk('Task 1')];
  await page.evaluate(folder => {
    const selection = (window as any).app.plugins.plugins.tasknotes.taskSelectionService;
    selection.selectAll([`${folder}/Task 0.md`, `${folder}/Task 1.md`]);
  }, folder);
  try {
    await calendarGesture('Batch', 'Task 0', 'drop', '2026-11-07T00:00', '2026-11-08T00:00', false, false, true);
    await expect.poll(() => [disk('Task 0'), disk('Task 1')]).not.toEqual(before);
    await expect(page.locator('.tn-toast__message')).toContainText('2 tasks updated');
    await page.locator('.tn-toast__action').click();
    await expect.poll(() => [disk('Task 0'), disk('Task 1')]).toEqual(before);
    await expect(root).toBeFocused();
  } finally { await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.taskSelectionService.clearSelection()); }
});

test('Archive gives a count-aware toast and restores the original task file', async () => {
  const root = await openView('tasknotesTaskList', 'Archive');
  const before = disk('Task 0');
  await root.locator(`[data-task-path="${folder}/Task 0.md"]`).first().click({ button: 'right' });
  await page.locator('.menu-item').filter({ hasText: /^Archive$/ }).click();
  await expect(page.locator('.tn-toast__message')).toHaveText('1 task archived');
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('Task 0')).toEqual(before);
});

test('a board without manual sorting never paints a reorder insertion marker', async () => {
  const root = await openView('tasknotesKanban', 'No manual');
  const source = root.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/Task 0.md"]`);
  const target = root.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/Task 2.md"]`);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer: transfer });
  await expect(root.locator('.kanban-view__board')).toHaveClass(/kanban-view__board--task-dragging/);
  try {
    const bounds = await target.boundingBox();
    await target.dispatchEvent('dragover', { dataTransfer: transfer, clientY: bounds!.y + 1 });
    await expect(root.locator('.kanban-view__card-wrapper--drop-marker, .kanban-view__cards--drop-marker-end')).toHaveCount(0);
  } finally { await source.dispatchEvent('dragend', { dataTransfer: transfer }); }
});

test('first Kanban reorder and cross-column position restore every rewritten note', async () => {
  const root = await openView('tasknotesKanban', 'Board', true);
  const snapshots = Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`));
  const drop = async (group: string, target: string) => page.evaluate(async ({ folder, group, target }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases').find((leaf: any) => leaf.view.file?.basename === 'Board').view.controller.view;
    await view.handleTaskDrop(`${folder}/Task 4.md`, group, null, { taskPath: `${folder}/${target}.md`, above: true });
  }, { folder, group, target });
  await drop('open', 'Task 0');
  await expect.poll(() => Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`).properties[sortField]).filter(Boolean).length).toBe(1);
  expect(Array.from({ length: 4 }, (_, index) => disk(`Task ${index}`))).toEqual(snapshots.slice(0, 4));
  await expect(page.locator('.tn-toast__message')).toHaveText('Moved 1 task to Open');
  const rank = disk('Task 4').properties[sortField];
  await page.evaluate(async ({ path, sortField, rank }) => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => { frontmatter[sortField] = rank; });
  }, { path: `${folder}/Task 4.md`, sortField, rank: 'outside-rank' });
  const concurrent = Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`));
  await page.locator('.tn-toast__action').click();
  await expect(page.locator('.tn-toast__message')).toContainText('Cannot undo');
  expect(Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`))).toEqual(concurrent);
  await page.evaluate(async ({ path, sortField, rank }) => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (frontmatter: any) => { frontmatter[sortField] = rank; });
  }, { path: `${folder}/Task 4.md`, sortField, rank });
  await root.focus();
  await page.keyboard.press('Control+z');
  await expect.poll(() => Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`))).toEqual(snapshots);
  await page.evaluate(async folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(`${folder}/Task 1.md`);
    await plugin.taskService.updateProperty(task, 'status', 'in-progress');
  }, folder);
  await expect(page.locator(`[data-group="in-progress"] [data-task-path="${folder}/Task 1.md"]`).first()).toBeVisible();
  const crossSnapshots = Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`));
  await drop('in-progress', 'Task 1');
  await expect.poll(() => disk('Task 4').properties.status).toBe('in-progress');
  await expect.poll(() => disk('Task 4').properties[sortField]).toBeTruthy();
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => Array.from({ length: 5 }, (_, index) => disk(`Task ${index}`))).toEqual(crossSnapshots);
});

test('edit modal save restores changed fields and title-driven rename on disk', async () => {
  const root = await openView('tasknotesTaskList', 'Editing');
  const before = disk('Task 0');
  await page.keyboard.press('j');
  await page.keyboard.press('e');
  const modal = page.locator('.minimalist-task-modal');
  await expect(modal).toBeVisible();
  await modal.locator('.title-input').fill('Task 0 renamed');
  await modal.locator('.details-editor .cm-content').fill('Edited details for guarded Undo.');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect.poll(() => existsSync(resolve(vault, folder, 'Task 0 renamed.md'))).toBe(true);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('Task 0')).toEqual(before);
  await expect(root).toBeFocused();
});

test('task creation offers Open without a delete-as-Undo action', async () => {
  await openView('tasknotesTaskList', 'Creation');
  await page.evaluate(folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    (window as any).undoTasksFolder = plugin.settings.tasksFolder;
    plugin.settings.tasksFolder = folder;
  }, folder);
  await page.keyboard.press('c');
  const modal = page.locator('.minimalist-task-modal');
  await modal.locator('.cm-content').first().fill('Created for Undo proof');
  await modal.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.locator('.tn-toast__action')).toHaveText('Open');
  const created = disk('Created for Undo proof');
  await expect.poll(() => existsSync(resolve(vault, folder, 'Created for Undo proof.md'))).toBe(true);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.basename)).toBe('Created for Undo proof');
  expect(disk('Created for Undo proof')).toEqual(created);
});

test('recurring feedback names the stored occurrence, not the current UTC day', async () => {
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.create(`${folder}/Recurring.md`, `---\ntitle: Recurring\ntags: [task]\nstatus: open\npriority: normal\nscheduled: 2026-11-06\nrecurrence: DTSTART:20261106;FREQ=DAILY\n---\nRecurring body.\n`);
  }, folder);
  await openView('tasknotesTaskList', 'Recurrence');
  await expect(page.locator(`[data-task-path="${folder}/Recurring.md"]`).first()).toBeVisible();
  const before = disk('Recurring');
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.toggleRecurringTaskComplete(await plugin.cacheManager.getTaskInfo(path), new Date('2026-11-04T19:00:00.000Z'));
  }, `${folder}/Recurring.md`);
  await expect.poll(() => disk('Recurring').properties.complete_instances).toContain('2026-11-06');
  await expect(page.locator('.tn-toast__message')).toContainText('Completed occurrence: 6 Nov 2026');
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('Recurring')).toEqual(before);
});

test('postponing overdue tasks restores both note files through the shared Undo', async () => {
  await openView('tasknotesTaskList', 'Postpone');
  await page.evaluate(async folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    for (const index of [0, 1]) {
      const task = await plugin.cacheManager.getTaskInfo(`${folder}/Task ${index}.md`);
      await plugin.taskService.updateProperty(task, 'scheduled', '2020-01-02');
    }
  }, folder);
  await expect.poll(() => disk('Task 1').properties.scheduled).toBe('2020-01-02');
  const before = [disk('Task 0'), disk('Task 1')];
  await page.evaluate(async folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const original = plugin.cacheManager.getAllTasks;
    const tasks = await Promise.all([0, 1].map(index => plugin.cacheManager.getTaskInfo(`${folder}/Task ${index}.md`)));
    plugin.cacheManager.getAllTasks = async () => tasks;
    (window as any).undoPostpone = plugin.rolloverOverdueScheduledTasks().finally(() => { plugin.cacheManager.getAllTasks = original; });
  }, folder);
  await page.locator('.modal').getByRole('button', { name: 'Postpone', exact: true }).click();
  await page.evaluate(() => (window as any).undoPostpone);
  await expect.poll(() => disk('Task 0').properties.scheduled).not.toBe('2020-01-02');
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => [disk('Task 0'), disk('Task 1')]).toEqual(before);
});

test('time entry editor save and command archive each restore disk contents', async () => {
  await openView('tasknotesTaskList', 'Entry editor');
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    await plugin.taskService.updateTask(task, { timeEntries: [{ startTime: '2026-11-01T01:00:00.000Z', endTime: '2026-11-01T02:00:00.000Z' }] });
    plugin.openTimeEntryEditor(await plugin.cacheManager.getTaskInfo(path));
  }, `${folder}/Task 0.md`);
  const before = disk('Task 0');
  const modal = page.locator('.time-entry-editor-modal');
  await modal.locator('input[type="datetime-local"]').last().fill('2026-11-01T15:00');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.tn-toast__message')).toContainText('Time entries saved');
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('Task 0')).toEqual(before);
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.toggleTaskArchive(await plugin.cacheManager.getTaskInfo(path));
  }, `${folder}/Task 0.md`);
  await expect(page.locator('.tn-toast__message')).toContainText('Task archived');
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => disk('Task 0')).toEqual(before);
});

test('modal relationship save restores every affected note on disk', async () => {
  await openView('tasknotesTaskList', 'Relationships');
  const before = [disk('Task 0'), disk('Task 1'), disk('Task 2')];
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
  }, `${folder}/Task 0.md`);
  const modal = page.locator('.minimalist-task-modal');
  await modal.getByText('More fields', { exact: true }).click();
  await modal.getByRole('button', { name: 'Select tasks to make them subtasks of this task', exact: true }).click();
  await page.locator('.prompt-input').fill('Task 1');
  await page.locator('.suggestion-item').filter({ hasText: 'Task 1' }).first().click();
  const blocking = modal.locator('.setting-item').filter({ has: page.locator('.setting-item-name').getByText('Blocking', { exact: true }) });
  await blocking.getByRole('button', { name: 'Select a task note using fuzzy search', exact: true }).click();
  await page.locator('.prompt-input').fill('Task 2');
  await page.locator('.suggestion-item').filter({ hasText: 'Task 2' }).first().click();
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect.poll(() => disk('Task 1').properties.projects?.length).toBe(1);
  await expect.poll(() => disk('Task 2').properties.blockedBy?.length).toBe(1);
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.locator('.tn-toast__action').click();
  await expect.poll(() => [disk('Task 0'), disk('Task 1'), disk('Task 2')]).toEqual(before);
});

test('list group movement restores the note through shared keyboard Undo', async () => {
  const root = await openView('tasknotesTaskList', 'Group movement');
  const before = disk('Task 0');
  await page.evaluate(async path => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases').find((leaf: any) => leaf.view.file?.basename === 'Group movement').view.controller.view;
    await view.performTaskMovement(path, { groupKey: 'open' }, { groupKey: 'in-progress' }, true, null);
  }, `${folder}/Task 0.md`);
  await expect.poll(() => disk('Task 0').properties.status).toBe('in-progress');
  await root.focus();
  await page.keyboard.press('Control+z');
  await expect.poll(() => disk('Task 0')).toEqual(before);
});
