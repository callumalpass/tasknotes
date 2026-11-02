/**
 * Issue #2475: tasks whose dateCreated uses a space ("2025-06-01 10:00:00") were missing
 * from the 4.15 calendar, because the projection rejected the whole task for that one date.
 */
import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let app: ObsidianApp;
const BASE = 'TaskNotes/Views/e2e-issue-2475.base';
const NOTES = ['E2E 2475 space', 'E2E 2475 iso'];

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

test('tasks with a space-separated created date appear in the calendar', async () => {
  const page = app.page;
  await page.evaluate(async ({ base, notes }) => {
    const w = window as any;
    const day = w.moment().format('YYYY-MM-DD');
    const created = ['2025-06-01 10:00:00', '2025-06-01T10:00:00'];
    for (const [i, name] of notes.entries()) {
      await w.app.vault.create(`${name}.md`, `---\ntitle: ${name}\nstatus: open\npriority: normal\nscheduled: ${day}\ndateCreated: ${created[i]}\ntags: [task]\n---\n`);
    }
    await w.app.vault.create(base, `filters:\n  and:\n    - file.name.startsWith("E2E 2475")\nviews:\n  - type: tasknotesCalendar\n    name: Issue 2475\n    calendarView: timeGridDay\n    initialDate: ${day}\n`);
    await w.app.workspace.getLeaf(true).openFile(w.app.vault.getAbstractFileByPath(base));
  }, { base: BASE, notes: NOTES });

  try {
    const cal = page.locator('.tnc:visible').first();
    for (const name of NOTES) await expect(cal.locator('.tnc-item', { hasText: name })).toHaveCount(1);
  } finally {
    await page.evaluate(async ({ base, notes }) => {
      const w = window as any;
      await w.app.workspace.getLeaf()?.detach();
      for (const path of [base, ...notes.map(name => `${name}.md`)]) {
        const file = w.app.vault.getAbstractFileByPath(path);
        if (file) await w.app.vault.delete(file);
      }
    }, { base: BASE, notes: NOTES });
  }
});
