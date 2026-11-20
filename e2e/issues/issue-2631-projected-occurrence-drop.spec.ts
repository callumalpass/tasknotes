import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// #2631: dragging a projected (dashed) occurrence of a recurring task to another
// day showed "<title> · <new day>" but left it on its original day, and could
// rewrite the series' DTSTART. A cross-day drop now creates that occurrence's
// note at the drop position; a same-day time change still edits the series.
let instance: ObsidianApp;
const stamp = Date.now();
const prefix = `Issue 2631 ${stamp}`;
const folder = `e2e-2631-${stamp}`;
const basePath = `${folder}/Week.base`;
const created: string[] = [basePath];
// Next occurrence Sunday 10 Jan 2027; the dragged projection is Sunday 17 Jan.
const SUNDAY = '2027-01-17';
const MONDAY = '2027-01-18';

const taskPath = (name: string) => `${folder}/${prefix} ${name}.md`;

async function createTask(page: Page, name: string, hour: string) {
  const path = taskPath(name);
  created.push(path);
  await page.evaluate(async ({ path, title, hour }) => {
    await (window as any).app.vault.create(path, `---
title: ${title}
status: open
priority: normal
tags: [task]
scheduled: 2027-01-10T${hour}:00
recurrence: DTSTART:20270103T${hour}0000Z;FREQ=WEEKLY;BYDAY=SU
---
`);
  }, { path, title: `${prefix} ${name}`, hour });
  await expect.poll(() => page.evaluate(async path =>
    Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)), path)).toBe(true);
  return path;
}

/** Calendar items for a task path: [start, recurringKind]. */
async function items(page: Page, path: string): Promise<string[]> {
  return page.evaluate(({ path, basePath }) => {
    const app = (window as any).app;
    const view = app.workspace.getLeavesOfType('bases')
      .find((leaf: any) => leaf.view.file?.path === basePath)?.view.controller.view;
    if (!view?.calendar) return [];
    return Array.from(view.calendar.store.all())
      .map((entry: any) => entry.item)
      .filter((item: any) => item.data?.taskInfo?.path === path ||
        String(item.data?.taskInfo?.recurrence_parent ?? '').includes(path.replace(/\.md$/, '')))
      .map((item: any) => `${String(item.start).slice(0, 16)} ${item.data?.modelEntry?.recurringKind ?? 'note'}`)
      .sort();
  }, { path, basePath });
}

async function frontmatter(page: Page, path: string) {
  return page.evaluate(path => {
    const app = (window as any).app;
    return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path))?.frontmatter;
  }, path);
}

/** Occurrence notes of a parent; they live in the tasks folder, not next to it. */
async function occurrenceNotes(page: Page, parentPath: string) {
  const notes = await page.evaluate(async parent => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    return (await plugin.cacheManager.getAllTasks())
      .filter((task: any) => task.occurrence_date && String(task.recurrence_parent ?? '').includes(parent))
      .map((task: any) => ({ path: task.path, scheduled: task.scheduled, occurrence_date: task.occurrence_date }));
  }, parentPath.replace(/\.md$/, ''));
  for (const note of notes) if (!created.includes(note.path)) created.push(note.path);
  return notes;
}

/** Drags the projected Sunday item of `name` with a real pointer. */
async function drag(page: Page, name: string, target: { day: string; hour?: number; allDay?: boolean }) {
  const title = `${prefix} ${name}`;
  const event = page.locator('.tnc-item').filter({ hasText: title })
    .and(page.locator(`[data-id^="recurring-"][data-id$="-${SUNDAY}"]`));
  // The calendar re-renders after each edit, so take the item's box once it settles.
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect.poll(async () => {
    box = await event.boundingBox({ timeout: 1000 }).catch(() => null);
    return Boolean(box);
  }).toBe(true);
  if (!box) throw new Error(`No projected item for ${title}`);
  const geometry = await page.evaluate(({ from, to }) => {
    const column = (date: string) => Array.from(document.querySelectorAll(`.tnc-tg-cols [data-date="${date}"]`))
      .map(el => el.getBoundingClientRect()).find(rect => rect.height > 100);
    const fromCol = column(from)!;
    const toCol = column(to)!;
    // The all-day row is one layer across the week; the column picks the day.
    const allDay = document.querySelector('.tnc-tg-allday .tnc-allday-layer')!.getBoundingClientRect();
    return { fromX: fromCol.x, toX: toCol.x, hour: fromCol.height / 24, top: fromCol.y, allDay };
  }, { from: SUNDAY, to: target.day });
  const startX = box.x + box.width / 2;
  const startY = box.y + 6;
  const endX = startX + (geometry.toX - geometry.fromX);
  const endY = target.allDay
    ? geometry.allDay.y + geometry.allDay.height / 2
    : target.hour === undefined ? startY : startY + (target.hour - Number(name === 'filter' ? 11 : 9)) * geometry.hour;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 4, startY + 4, { steps: 3 });
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.mouse.up();
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  const page = instance.page;
  await page.evaluate(async ({ folder, prefix, basePath }) => {
    const app = (window as any).app;
    app.plugins.plugins.tasknotes.settings.googleCalendarExport.enabled = false;
    await app.vault.createFolder(folder);
    await app.vault.create(basePath, `filters:
  and:
    - file.name.startsWith("${prefix}")
views:
  - type: tasknotesCalendar
    name: Week
    calendarView: timeGridWeek
    firstDay: 0
    showScheduled: true
    showDue: true
    showRecurring: true
    showTimeEntries: false
    showTimeblocks: false
    showPropertyBasedEvents: false
`);
  }, { folder, prefix, basePath });
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

test('dropping a projected occurrence on another day moves only that occurrence', async () => {
  const page = instance.page;
  const water = await createTask(page, 'water', '09');
  const filter = await createTask(page, 'filter', '11');
  const post = await createTask(page, 'post', '09');
  await page.evaluate(async basePath => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(basePath));
  }, basePath);
  await expect.poll(() => page.evaluate(basePath => Boolean((window as any).app.workspace.getLeavesOfType('bases')
    .find((leaf: any) => leaf.view.file?.path === basePath)?.view.controller.view?.calendar), basePath)).toBe(true);
  await page.evaluate(({ basePath, day }) => (window as any).app.workspace.getLeavesOfType('bases')
    .find((leaf: any) => leaf.view.file?.path === basePath).view.controller.view.calendar.gotoDate(day),
  { basePath, day: SUNDAY });
  await expect.poll(() => items(page, water)).toEqual([`${SUNDAY}T09:00 pattern`]);

  // Another day, same time: an occurrence note on Monday; the rule is untouched.
  await drag(page, 'water', { day: MONDAY });
  await expect.poll(() => occurrenceNotes(page, water)).toEqual([
    expect.objectContaining({ occurrence_date: SUNDAY, scheduled: `${MONDAY}T09:00` }),
  ]);
  expect((await frontmatter(page, water)).recurrence).toBe('DTSTART:20270103T090000Z;FREQ=WEEKLY;BYDAY=SU');
  await expect.poll(() => items(page, water)).toEqual([`${MONDAY}T09:00 note`]);
  const moved = page.locator('.tn-toast').filter({ hasText: `${prefix} water` });
  await expect(moved).toContainText('occurrence to');
  await expect(moved).toContainText('Other occurrences are unchanged.');
  // Undo removes the occurrence note, so the projection is back on Sunday.
  await moved.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => occurrenceNotes(page, water)).toEqual([]);
  await expect.poll(() => items(page, water)).toEqual([`${SUNDAY}T09:00 pattern`]);

  // Same day, another time: the series' time changes, and the notice says so.
  await drag(page, 'filter', { day: SUNDAY, hour: 14 });
  await expect.poll(async () => (await frontmatter(page, filter)).recurrence)
    .toBe('DTSTART:20270103T140000Z;FREQ=WEEKLY;BYDAY=SU');
  expect((await frontmatter(page, filter)).scheduled).toBe('2027-01-10T11:00');
  expect(await occurrenceNotes(page, filter)).toEqual([]);
  await expect(page.locator('.tn-toast').filter({ hasText: `${prefix} filter` }))
    .toContainText('Series time changed to 14:00');

  // Another day's all-day row: a date-only occurrence note; the rule keeps its time.
  await drag(page, 'post', { day: MONDAY, allDay: true });
  await expect.poll(() => occurrenceNotes(page, post)).toEqual([
    expect.objectContaining({ occurrence_date: SUNDAY, scheduled: MONDAY }),
  ]);
  expect((await frontmatter(page, post)).recurrence).toBe('DTSTART:20270103T090000Z;FREQ=WEEKLY;BYDAY=SU');
});
