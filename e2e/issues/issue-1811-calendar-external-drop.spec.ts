import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';
import { calendarTimeSlots } from '../calendar-helpers';

// #1811: inline task widgets can be dragged onto a Calendar view to schedule the task.
let app: ObsidianApp;
const TASK = 'TaskNotes/Tasks/E2E 1811 drag me.md';
const NOTE = 'E2E 1811 drag source.md';
const BASE = 'TaskNotes/Views/e2e-1811-calendar.base';

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

test('dropping an inline task widget on a time slot schedules the task', async () => {
  const page = app.page;
  const day = await page.evaluate(async ({ task, note, base }) => {
    const w = window as any;
    const day = w.moment().format('YYYY-MM-DD');
    await w.app.vault.create(task, '---\ntitle: E2E 1811 drag me\nstatus: open\npriority: normal\ntags: [task]\n---\n');
    await w.app.vault.create(note, 'Drag: [[E2E 1811 drag me]]\n');
    await w.app.vault.create(base, `filters:\n  and:\n    - file.inFolder("TaskNotes/Tasks")\nviews:\n  - type: tasknotesCalendar\n    name: Drop target\n    calendarView: timeGridDay\n    initialDate: ${day}\n    slotMinTime: 00:00:00\n    slotMaxTime: "24:00:00"\n    slotDuration: "01:00:00"\n    heightMode: fill\n`);
    const calendarLeaf = w.app.workspace.getLeaf(true);
    await calendarLeaf.openFile(w.app.vault.getAbstractFileByPath(base));
    const noteLeaf = w.app.workspace.createLeafBySplit(calendarLeaf, 'vertical', true);
    await noteLeaf.openFile(w.app.vault.getAbstractFileByPath(note));
    await noteLeaf.setViewState({ type: 'markdown', state: { file: note, mode: 'source', source: false } });
    noteLeaf.view.editor.setCursor({ line: 1, ch: 0 });
    return day;
  }, { task: TASK, note: NOTE, base: BASE });

  try {
    const widget = page.locator('.tasknotes-inline-widget', { hasText: 'E2E 1811 drag me' });
    await expect(widget).toBeVisible();
    await expect(page.locator('.tnc-tg')).toBeVisible();

    // Drop in the middle of the 10:00 slot.
    const column = page.locator('.tnc-tg .tnc-col').first();
    const columnBox = await column.boundingBox();
    const slot = await calendarTimeSlots(page).nth(10).boundingBox();
    expect(columnBox && slot).toBeTruthy();
    await widget.locator('.task-card__title-text').dragTo(column, {
      targetPosition: { x: columnBox!.width / 2, y: slot!.y - columnBox!.y + slot!.height / 2 },
    });

    await expect.poll(() => page.evaluate(p => {
      const w = window as any;
      return w.app.metadataCache.getFileCache(w.app.vault.getAbstractFileByPath(p))?.frontmatter?.scheduled;
    }, TASK)).toBe(`${day}T10:00`);
    await expect(page.locator('.tnc-item', { hasText: 'E2E 1811 drag me' })).toBeVisible();
  } finally {
    await page.evaluate(async paths => {
      const w = window as any;
      w.app.workspace.iterateRootLeaves((leaf: any) => leaf.detach());
      for (const p of paths) {
        const file = w.app.vault.getAbstractFileByPath(p);
        if (file) await w.app.vault.delete(file);
      }
    }, [TASK, NOTE, BASE]);
  }
});
