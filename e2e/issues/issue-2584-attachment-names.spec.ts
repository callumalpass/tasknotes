/**
 * Discussion #2584: cards showed attachments only as a paperclip count. With the attachments
 * property shown on the card, each attachment appears as a link named by its file, and the count
 * goes away.
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/2584
 */
import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2584-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await page.evaluate(async ({ folder, date }) => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    await app.vault.createBinary(`${folder}/Quarterly report.pdf`, new ArrayBuffer(8));
    await app.vault.create(`${folder}/Meeting notes.md`, 'Notes');
    await app.vault.create(`${folder}/Agenda task.md`,
      `---\ntags: [task]\ntitle: Agenda task\ncontexts: [studio]\nstatus: open\nscheduled: ${date}\n` +
      `attachments: ["[[${folder}/Quarterly report.pdf]]", "[[${folder}/Meeting notes]]"]\n---\n`);
  }, { folder, date });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

async function openAgenda(name: string, order: string[]) {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`] },
    views: [{ type: 'tasknotesCalendar', name, calendarView: 'listWeek', order }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/${name}.base`, content });
  const card = page.locator('.workspace-leaf.mod-active .tn-calendar-list-card .task-card').first();
  await expect(card).toBeVisible();
  return card;
}

test('agenda cards name their attachments when the property is shown', async () => {
  const counted = await openAgenda('Count', ['status', 'contexts']);
  await expect(counted.locator('.task-card__attachment-indicator')).toBeVisible();
  await expect(counted.locator('.task-card__attachment-link')).toHaveCount(0);

  const named = await openAgenda('Names', ['status', 'contexts', 'attachments']);
  const links = named.locator('.task-card__metadata .task-card__attachment-link');
  await expect(links).toHaveText(['Quarterly report.pdf', 'Meeting notes']);
  await expect(links.first()).toHaveAttribute('data-href', `${folder}/Quarterly report.pdf`);
  await expect(named.locator('.task-card__attachment-indicator')).toBeHidden();

  await links.nth(1).click();
  await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path))
    .toBe(`${folder}/Meeting notes.md`);
});
