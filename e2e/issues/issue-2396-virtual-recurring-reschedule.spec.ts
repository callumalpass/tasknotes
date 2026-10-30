import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Confirmed against stock 4.14.0 on desk, 2026-10-23. A native move now
// retains its original recurrence date as identity, just like the control note.
// Exercise the actual completion notice/Undo as well as the calendar projection.
let instance: ObsidianApp;
const prefix = `Issue 2396 ${Date.now()}`;
const folder = `e2e-2396-${Date.now()}`;
const nativePath = `${folder}/${prefix} native.md`;
const controlPath = `${folder}/${prefix} control.md`;
const basePath = `${folder}/Calendar.base`;
const created = [nativePath, controlPath, basePath];

async function placements(path: string) {
  return instance.page.evaluate(({ path, basePath }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases')
      .find((leaf: any) => leaf.view.file?.path === basePath)?.view.controller.view;
    if (!view?.calendar) throw new Error('Reproduction calendar is not ready');
    return Array.from(view.calendar.store.all())
      .map((entry: any) => entry.item)
      .filter((item: any) => item.data?.taskInfo?.path === path)
      .map((item: any) => String(item.start)).sort() as string[];
  }, { path, basePath });
}

async function showWeek(date: string) {
  await instance.page.evaluate(({ date, basePath }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases')
      .find((leaf: any) => leaf.view.file?.path === basePath)?.view.controller.view;
    view.calendar.gotoDate(date);
  }, { date, basePath });
}

async function move(path: string) {
  await instance.page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    await plugin.taskService.updateProperty(task, 'scheduled', '2026-10-12');
  }, path);
  await expect.poll(() => placements(path)).toContain('2026-10-12');
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async folder => {
    await (window as any).app.vault.createFolder(folder);
  }, folder);
});
test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async paths => {
      const app = (window as any).app;
      for (const path of paths) {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) await app.vault.delete(file, true);
      }
    }, [...created, folder]);
  } finally { await closeObsidian(instance); }
});

test('a moved native annual occurrence should replace its rule placement, like a materialized note', async () => {
  const page = instance.page;
  await page.evaluate(async ({ folder, prefix, nativePath, controlPath, basePath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.enableGoogleCalendar = false;
    plugin.settings.googleCalendarExport.enabled = false;
    for (const [path, kind] of [[nativePath, 'native'], [controlPath, 'control']]) {
      await app.vault.create(path, `---
title: ${prefix} ${kind}
status: open
priority: normal
tags: [task]
scheduled: 2026-10-18
recurrence: DTSTART:20261018;FREQ=YEARLY
---
`);
    }
    const base = await app.vault.create(basePath, `filters:
  and:
    - file.ext == "md"
    - file.name.startsWith("${prefix}")
views:
  - type: tasknotesCalendar
    name: Reproduction
    calendarView: listWeek
    listDayCount: 7
    options:
      showScheduled: true
      showRecurring: true
      showDue: false
      showCompletedRecurringInstances: false
      showSkippedRecurringInstances: false
`);
    await app.workspace.getLeaf(false).openFile(base);
  }, { folder, prefix, nativePath, controlPath, basePath });
  await expect.poll(() => page.evaluate(({ basePath }) => {
    const app = (window as any).app;
    return Boolean(app.workspace.getLeavesOfType('bases')
      .find((leaf: any) => leaf.view.file?.path === basePath)?.view.controller.view?.calendar);
  }, { basePath })).toBe(true);
  await showWeek('2026-10-12');
  await expect.poll(() => placements(nativePath)).toEqual(['2026-10-18']);
  await expect.poll(() => placements(controlPath)).toEqual(['2026-10-18']);

  const occurrencePath = await page.evaluate(async controlPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const parent = await plugin.cacheManager.getTaskInfo(controlPath);
    return (await plugin.taskService.materializeOccurrence(parent, '2026-10-18')).path as string;
  }, controlPath);
  created.push(occurrencePath);
  await expect.poll(() => page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    return (await plugin.cacheManager.getTaskInfo(path))?.occurrence_date;
  }, occurrencePath)).toBe('2026-10-18');
  await move(occurrencePath);
  await expect.poll(() => placements(controlPath)).toEqual([]);
  await expect.poll(() => placements(occurrencePath)).toEqual(['2026-10-12']);

  await move(nativePath);
  const saved = await page.evaluate(nativePath => {
    const app = (window as any).app;
    return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(nativePath)).frontmatter;
  }, nativePath);
  expect(saved.scheduled).toBe('2026-10-12');
  expect(saved.recurrence).toBe('DTSTART:20261018;FREQ=YEARLY');
  expect(saved.due).toBeUndefined();
  expect(Object.keys(saved).filter(key => key.startsWith('googleCalendar'))).toEqual([]);

  await showWeek('2027-10-12');
  for (const path of [nativePath, controlPath]) {
    // Only compare placements in the requested year's range.
    await expect.poll(async () => (await placements(path)).filter(date => date.startsWith('2027-')))
      .toEqual(['2027-10-18']);
  }
  await showWeek('2026-10-12');
  await expect.poll(() => placements(nativePath)).toContain('2026-10-12');
  await expect.poll(() => placements(nativePath)).toEqual(['2026-10-12']);
  const nativeState = () => page.evaluate(async path => {
    const app = (window as any).app;
    return app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path);
  }, nativePath);
  expect((await nativeState()).recurrence_original_date).toBe('2026-10-18');
  const eventIdentity = await page.evaluate(({ nativePath, basePath }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases')
      .find((leaf: any) => leaf.view.file?.path === basePath).view.controller.view;
    return Array.from(view.calendar.store.all()).map((entry: any) => entry.item).find((item: any) =>
      item.data?.taskInfo?.path === nativePath).data.instanceDate;
  }, { nativePath, basePath });
  expect(eventIdentity).toBe('2026-10-18');

  // An explicit execution-date target must resolve to the original occurrence,
  // including the year/date displayed by #2412's interactive Undo notice.
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    await plugin.toggleRecurringTaskComplete(task, new Date('2026-10-12T00:00:00Z'));
  }, nativePath);
  await expect.poll(async () => (await nativeState()).complete_instances).toEqual(['2026-10-18']);
  expect((await nativeState()).scheduled).toBe('2027-10-18');
  expect((await nativeState()).recurrence_original_date).toBeUndefined();
  const notice = page.locator('.notice').filter({ hasText: `${prefix} native` });
  await expect(notice).toContainText('Completed occurrence: 18 Oct 2026');
  await expect(notice).toContainText('Next: 18 Oct 2027');
  await notice.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await nativeState()).scheduled).toBe('2026-10-12');
  expect((await nativeState()).complete_instances ?? []).toEqual([]);
  expect((await nativeState()).recurrence_original_date).toBe('2026-10-18');
  await expect.poll(() => placements(nativePath)).toEqual(['2026-10-12']);
});

test('a timed moved occurrence materializes under its original identity and completes with reversible parent progression', async () => {
  const page = instance.page;
  const path = `${folder}/${prefix} timed.md`;
  created.push(path);
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.vault.create(path, `---
title: ${path.split('/').pop()?.replace(/\.md$/, '')}
status: open
priority: normal
tags: [task]
scheduled: 2026-10-18T09:00
due: 2026-10-20T10:00
recurrence: DTSTART:20261018T090000Z;FREQ=YEARLY
---
`);
  }, path);
  const state = (taskPath: string) => page.evaluate(async taskPath =>
    (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath), taskPath);
  await expect.poll(async () => (await state(path))?.scheduled).toBe('2026-10-18T09:00');
  const childPath = await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    const moved = await plugin.taskService.updateTask(task, {
      scheduled: '2026-10-12T09:00', due: '2026-10-14T10:00',
    });
    return (await plugin.taskService.materializeOccurrence(moved, '2026-10-12')).path as string;
  }, path);
  created.push(childPath);
  await expect.poll(async () => (await state(childPath))?.occurrence_date).toBe('2026-10-18');
  expect((await state(childPath)).scheduled).toBe('2026-10-12T09:00');
  expect((await state(childPath)).due).toBe('2026-10-14T10:00');
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.toggleRecurringTaskComplete(await plugin.cacheManager.getTaskInfo(path),
      new Date('2026-10-12T00:00:00Z'));
  }, path);
  await expect.poll(async () => (await state(path)).complete_instances).toEqual(['2026-10-18']);
  expect((await state(path)).scheduled).toBe('2027-10-18T09:00');
  expect((await state(path)).recurrence_original_date).toBeUndefined();
  const persisted = await page.evaluate(path => {
    const app = (window as any).app;
    return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path)).frontmatter;
  }, path);
  expect(persisted.recurrence_original_date).toBeUndefined();
  const notice = page.locator('.notice').filter({ hasText: `${prefix} timed` });
  await expect(notice).toContainText('Completed occurrence: 18 Oct 2026');
  await notice.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).scheduled).toBe('2026-10-12T09:00');
  expect((await state(path)).recurrence_original_date).toBe('2026-10-18');
  expect((await state(path)).complete_instances ?? []).toEqual([]);
  expect((await state(childPath)).status).toBe('open');
});

test('the ordinary list checkbox completes the pending move before its shared landing-date occurrence', async () => {
  const page = instance.page;
  const path = `${folder}/${prefix} weekly.md`;
  const listPath = `${folder}/Identity.base`;
  created.push(path, listPath);
  await page.evaluate(async ({ path, listPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await app.vault.create(path, `---
title: Weekly identity
status: open
priority: normal
tags: [task]
scheduled: 2027-10-11
recurrence: DTSTART:20271011;FREQ=WEEKLY;BYDAY=MO
---
`);
    await plugin.cacheManager.waitForFreshTaskData(app.vault.getAbstractFileByPath(path));
    const task = await plugin.cacheManager.getTaskInfo(path);
    await plugin.taskService.updateProperty(task, 'scheduled', '2027-10-18');
    const base = await app.vault.create(listPath, `filters:
  and:
    - file.path == "${path}"
views:
  - type: tasknotesTaskList
    name: Identity
    order:
      - note.status
      - note.scheduled
      - file.name
`);
    await app.workspace.getLeaf(false).openFile(base);
  }, { path, listPath });
  const state = () => page.evaluate(async path =>
    (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path), path);
  const card = page.locator(`.task-card[data-task-path="${path}"]`);
  await expect(card).toBeVisible();
  expect((await state()).recurrence_original_date).toBe('2027-10-11');
  // Activate the real accessible control with Enter: the existing reorder
  // handle overlaps its pointer hit area in this test vault's narrow list.
  await card.locator('.task-card__status-dot').press('Enter');
  await expect.poll(async () => (await state()).complete_instances).toEqual(['2027-10-11']);
  expect((await state()).scheduled).toBe('2027-10-18');
  expect((await state()).recurrence_original_date).toBeUndefined();
  await card.locator('.task-card__status-dot').press('Enter');
  await expect.poll(async () => (await state()).complete_instances).toEqual(['2027-10-11', '2027-10-18']);
  expect((await state()).scheduled).toBe('2027-10-25');
});
