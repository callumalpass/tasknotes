/**
 * Discussion #2583: in narrow agenda columns, 5.0 hides the properties that do not fit on one line
 * behind a "+N" count. "Show all properties on task cards" wraps them onto extra lines instead.
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/2583
 */
import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2583-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let originalWrap: unknown;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  originalWrap = await page.evaluate(async ({ folder, date }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = plugin.settings.wrapTaskCardProperties;
    plugin.settings.wrapTaskCardProperties = false;
    await plugin.saveSettings();
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Agenda task.md`,
      `---\ntags: [task, design, accessibility]\ncontexts: [studio, phone]\nprojects: ["[[${folder}/Website redesign]]"]\n` +
      `title: Agenda task\nstatus: open\nscheduled: ${date}\nclient: Northwind Traders\nestimate_note: Needs a second review\n---\n`);
    return original;
  }, { folder, date });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ folder, originalWrap }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings.wrapTaskCardProperties = originalWrap ?? false;
      await plugin.saveSettings();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, originalWrap });
  } finally {
    await closeObsidian(instance);
  }
});

test('narrow agenda cards show every property when the setting is on', async () => {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`] },
    views: [{
      type: 'tasknotesCalendar', name: 'Agenda', calendarView: 'listWeek', listDayCount: 7,
      order: ['status', 'scheduled', 'projects', 'contexts', 'tags', 'note.client', 'note.estimate_note'],
    }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
  }, { path: `${folder}/Agenda.base`, content });

  const leaf = page.locator('.workspace-leaf.mod-active');
  const card = leaf.locator('.tn-calendar-list-card .task-card').first();
  await expect(card).toBeVisible();
  // A narrow pane, like an agenda in a side column.
  await leaf.evaluate(element => { (element as HTMLElement).style.maxWidth = '320px'; });

  const overflow = card.locator('.task-card__metadata-overflow');
  await expect(overflow).toBeVisible();
  await expect(overflow).toHaveText(/^\+\d+$/);
  const collapsedHeight = (await card.boundingBox())!.height;

  await page.evaluate(async () => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.wrapTaskCardProperties = true;
    await plugin.saveSettings();
  });

  const wrapped = leaf.locator('.tn-calendar-list-card .task-card').first();
  await expect(wrapped.locator('.task-card__metadata--wrap')).toHaveCount(1);
  await expect(wrapped.locator('.task-card__metadata-overflow')).toBeHidden();
  for (const text of ['Northwind Traders', 'Needs a second review', 'studio', 'phone', 'accessibility']) {
    await expect(wrapped.locator('.task-card__metadata').getByText(text)).toBeVisible();
  }
  // Every value stays inside the card, and the card grows to fit them.
  expect(await wrapped.evaluate(card => {
    const bounds = card.getBoundingClientRect();
    return Array.from(card.querySelectorAll<HTMLElement>('.task-card__metadata-values > *, .task-card__metadata-chips > *'))
      .filter(element => element.offsetParent)
      .every(element => element.getBoundingClientRect().right <= bounds.right + 1);
  })).toBe(true);
  expect((await wrapped.boundingBox())!.height).toBeGreaterThan(collapsedHeight);
});
