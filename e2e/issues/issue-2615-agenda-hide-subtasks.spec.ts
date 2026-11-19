/**
 * Issue #2615: the Calendar view's agenda (list) layout had no "Hide top-level subtasks"
 * option, so a subtask scheduled on the same day as its parent showed twice: under the
 * expanded parent and as its own row. The option now hides a subtask's row on days its
 * parent has a row, and keeps it on days the parent isn't listed.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2615
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2615-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let today: string;
let tomorrow: string;

const baseText = (hide: boolean) =>
  `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n` +
  `  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n` +
  `    showScheduled: true\n    showDue: false\n    showRecurring: false\n    showTimeEntries: false\n    showTimeblocks: false\n    showPropertyBasedEvents: false\n` +
  `    hideTopLevelSubtasks: ${hide}\n`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1300, height: 900 });
  ({ today, tomorrow } = await page.evaluate(() => {
    const moment = (window as any).moment;
    return { today: moment().format('YYYY-MM-DD'), tomorrow: moment().add(1, 'day').format('YYYY-MM-DD') };
  }));
  await page.evaluate(async ({ folder, today, tomorrow, base }) => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const task = (name: string, fields: string) =>
      app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\ntitle: ${name}\nstatus: open\n${fields}---\n`);
    await task('Write the report', `scheduled: ${today}\n`);
    await task('Outline the report', `scheduled: ${today}\nprojects: ["[[Write the report]]"]\n`);
    await task('Proofread the report', `scheduled: ${tomorrow}\nprojects: ["[[Write the report]]"]\n`);
    const file = await app.vault.create(`${folder}/Agenda.base`, base);
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, today, tomorrow, base: baseText(false) });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      app.workspace.getLeavesOfType('bases').forEach((leaf: any) => leaf.detach());
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

const rows = (title: string, day: string): Locator =>
  page.locator(`.workspace-leaf.mod-active .tnc-list-section[data-date="${day}"] .tnc-item--list`).filter({ hasText: title });

test('agenda hides a subtask row on days its parent is listed', async () => {
  // Off (default): the subtask has its own row next to the parent.
  await expect(rows('Write the report', today)).toHaveCount(1, { timeout: 15000 });
  await expect(rows('Outline the report', today)).toHaveCount(1);

  await page.evaluate(async ({ path, base }) => {
    const app = (window as any).app;
    await app.vault.modify(app.vault.getAbstractFileByPath(path), base);
  }, { path: `${folder}/Agenda.base`, base: baseText(true) });

  // On: the same-day subtask row goes; the parent stays.
  await expect(rows('Outline the report', today)).toHaveCount(0, { timeout: 15000 });
  await expect(rows('Write the report', today)).toHaveCount(1);
  // The parent isn't listed tomorrow, so that subtask keeps its row.
  await expect(rows('Proofread the report', tomorrow)).toHaveCount(1);

  // The hidden subtask is still reachable under its expanded parent.
  const parent = rows('Write the report', today);
  // The chevron only shows on hover, so click it directly.
  await parent.locator('.task-card__chevron').first().dispatchEvent('click');
  await expect(parent.locator('.task-card__subtasks')).toContainText('Outline the report');
  await page.screenshot({ path: test.info().outputPath('agenda-hidden-subtask.png') });
});
