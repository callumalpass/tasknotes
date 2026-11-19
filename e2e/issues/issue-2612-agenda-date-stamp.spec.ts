/**
 * Issue #2612: Agenda cards leave out the scheduled or due date their row stands for, since the
 * row already sits under that day. That also removed the one-click way to change the date. The
 * row's stamp (calendar or flag icon, plus the time for timed rows) now opens that date's picker.
 * A timed task with no other card properties also lost its time stamp, because the metadata line
 * stayed hidden.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2612
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2612-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let today: string;
let tomorrow: string;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1300, height: 900 });
  ({ today, tomorrow } = await page.evaluate(() => {
    const moment = (window as any).moment;
    return { today: moment().format('YYYY-MM-DD'), tomorrow: moment().add(1, 'day').format('YYYY-MM-DD') };
  }));
  await page.evaluate(async ({ folder, today }) => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const task = (name: string, fields: string) =>
      app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\ntitle: ${name}\nstatus: open\n${fields}---\n`);
    await task('Plan the week', `scheduled: ${today}\ncontexts: [desk]\n`);
    await task('Call the dentist', `scheduled: ${today}T14:30\n`);
    await task('Send the invoice', `due: ${today}\n`);
    await task('Water the plants', `scheduled: ${today}\nrecurrence: "FREQ=DAILY"\n`);
    const base = await app.vault.create(`${folder}/Agenda.base`,
      `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n` +
      `  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n    order:\n      - status\n      - priority\n      - scheduled\n      - due\n      - contexts\n` +
      `    showScheduled: true\n    showDue: true\n    showRecurring: true\n    showTimeEntries: false\n    showTimeblocks: false\n    showPropertyBasedEvents: false\n`);
    await app.workspace.getLeaf(false).openFile(base);
  }, { folder, today });
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

const row = (title: string, day = today): Locator =>
  page.locator(`.workspace-leaf.mod-active .tnc-list-section[data-date="${day}"] .tnc-item--list`).filter({ hasText: title }).first();

const frontmatter = (name: string, key: string) =>
  page.evaluate(async ({ path, key }) => {
    const app = (window as any).app;
    const text: string = await app.vault.read(app.vault.getAbstractFileByPath(path));
    return text.split('\n').find(line => line.startsWith(`${key}:`))?.slice(key.length + 2);
  }, { path: `${folder}/${name}.md`, key });

test('agenda row stamp edits the date the card leaves out', async () => {
  // The row's own date stays off the card; the stamp stands in for it.
  const planned = row('Plan the week');
  await expect(planned).toBeVisible({ timeout: 15000 });
  await expect(planned.locator('.task-card__metadata-date--scheduled')).toHaveCount(0);
  const stamp = planned.locator('.tn-calendar-list-stamp[role="button"]');
  await expect(stamp.locator('.tn-calendar-list-scheduled')).toBeVisible();
  await stamp.click();
  await page.getByRole('option', { name: '+1 day', exact: true }).click();
  await expect.poll(() => frontmatter('Plan the week', 'scheduled')).toBe(tomorrow);
  await expect(row('Plan the week', tomorrow)).toBeVisible();

  // Due rows: the flag stamp opens the due date.
  const invoice = row('Send the invoice');
  await expect(invoice.locator('.task-card__metadata-date--due')).toHaveCount(0);
  await invoice.locator('.tn-calendar-list-stamp[role="button"]').click();
  await page.getByRole('option', { name: '+1 day', exact: true }).click();
  await expect.poll(() => frontmatter('Send the invoice', 'due')).toBe(tomorrow);
});

test('timed task with no other properties shows its time', async () => {
  const stamp = row('Call the dentist').locator('.tn-calendar-list-stamp');
  await expect(stamp).toBeVisible();
  await expect(stamp).toContainText('14:30');
  await expect(stamp).toHaveAttribute('role', 'button');
});

test('recurring rows keep the occurrence date on the card', async () => {
  const plants = row('Water the plants');
  await expect(plants.locator('.task-card__metadata-date--scheduled')).toBeVisible();
  await expect(plants.locator('.tn-calendar-list-stamp[role="button"]')).toHaveCount(0);
});
