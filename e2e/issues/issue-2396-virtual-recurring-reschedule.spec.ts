import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Confirmed live against stock 4.14.0 on desk, 2026-10-23.
// No production fix: see issue-analysis/issue-2396.md for the identity decision.
// Only the final native-placement assertion is an expected failure. Setup,
// unchanged cadence, and the materialized-note control must all succeed first.
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
    return view.calendar.getEvents()
      .filter((event: any) => event.extendedProps.taskInfo?.path === path)
      .map((event: any) => event.startStr).sort() as string[];
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

test.beforeAll(async () => { instance = await launchObsidian(); });
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
    await app.vault.createFolder(folder);
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
    // getEvents() can include the next-scheduled event outside the visible week.
    await expect.poll(async () => (await placements(path)).filter(date => date.startsWith('2027-')))
      .toEqual(['2027-10-18']);
  }
  await showWeek('2026-10-12');
  await expect.poll(() => placements(nativePath)).toContain('2026-10-12');
  test.fail(true, '#2396: native moves do not retain the original occurrence identity');
  await expect.poll(() => placements(nativePath), { timeout: 3000 }).toEqual(['2026-10-12']);
});
