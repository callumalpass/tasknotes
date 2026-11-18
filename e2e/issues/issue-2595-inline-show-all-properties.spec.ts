/**
 * Discussions #2595 and #2597: task links in notes collapse properties that do not fit into a "+N" count.
 * "Show all properties on inline task cards" lists them all under the title instead, including
 * custom fields and attachments. The default stays one line (#2579), and links inside a sentence
 * still show only the title.
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/2595
 * @see https://github.com/callumalpass/tasknotes/discussions/2597
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2595-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let original: Record<string, unknown>;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1100, height: 800 });
  original = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      inlineVisibleProperties: plugin.settings.inlineVisibleProperties,
      userFields: plugin.settings.userFields,
      wrapInlineTaskProperties: plugin.settings.wrapInlineTaskProperties,
    };
    plugin.settings.userFields = [...(plugin.settings.userFields ?? []), { id: 'client2595', displayName: 'Client', key: 'client2595', type: 'text' }];
    plugin.settings.inlineVisibleProperties = ['status', 'priority', 'due', 'scheduled', 'contexts', 'tags', 'attachments', 'user:client2595'];
    plugin.settings.wrapInlineTaskProperties = false;
    await plugin.saveSettings();
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Quarterly report.pdf`, '');
    await app.vault.create(`${folder}/Prepare the workshop.md`,
      `---\ntags: [task, design, accessibility]\ntitle: Prepare the workshop\nstatus: open\npriority: high\n` +
      `due: 2026-11-25\nscheduled: 2026-11-20\ncontexts: [studio, phone]\n` +
      `attachments: ["[[${folder}/Quarterly report.pdf]]"]\nclient2595: Northwind Traders\n---\n`);
    const note = await app.vault.create(`${folder}/Notes.md`,
      `Agenda.\n\n[[${folder}/Prepare the workshop]]\n\nWe need to [[${folder}/Prepare the workshop]] first.\n`);
    await app.workspace.getLeaf(false).setViewState({ type: 'markdown', state: { file: note.path, mode: 'source', source: false } });
    return original;
  }, folder);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ folder, original }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, original);
      await plugin.saveSettings();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, original });
  } finally {
    await closeObsidian(instance);
  }
});

const ownLine = () => page.locator('.workspace-leaf.mod-active .tasknotes-inline-widget:not(.tasknotes-inline-widget--sentence) .task-card--layout-inline').first();
const inSentence = () => page.locator('.workspace-leaf.mod-active .tasknotes-inline-widget--sentence .task-card--layout-inline').first();

test('inline task cards list every property under the title when the setting is on', async () => {
  // Default: one line, with the rest behind +N.
  await expect(ownLine().locator('.task-card__metadata-overflow')).toHaveText(/^\+\d+$/);
  const oneLine = (await ownLine().boundingBox())!.height;
  expect(oneLine).toBeLessThan(40);

  await page.evaluate(async () => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.wrapInlineTaskProperties = true;
    await plugin.saveSettings();
  });

  const card = ownLine();
  await expect(card).toHaveClass(/task-card--metadata-wrap/);
  await expect(card.locator('.task-card__metadata-overflow')).toBeHidden();
  for (const text of ['@studio', '@phone', '#accessibility', 'Quarterly report.pdf', 'Northwind Traders']) {
    await expect(card.locator('.task-card__metadata').getByText(text, { exact: true })).toBeVisible();
  }
  const layout = await card.evaluate(element => {
    const title = element.querySelector('.task-card__title')!.getBoundingClientRect();
    const metadata = element.querySelector('.task-card__metadata')!.getBoundingClientRect();
    const tags = Array.from(element.querySelectorAll('.task-card__metadata-property--tags .tag')).map(tag => tag.getBoundingClientRect().top);
    return { below: metadata.top >= title.bottom - 2, indented: metadata.left >= title.left - 1, tagsOnOneRow: Math.max(...tags) - Math.min(...tags) < 4 };
  });
  expect(layout).toEqual({ below: true, indented: true, tagsOnOneRow: true });
  expect((await card.boundingBox())!.height).toBeGreaterThan(oneLine);

  // A link inside a sentence still shows only its title.
  await expect(inSentence().locator('.task-card__metadata')).toBeHidden();
  expect((await inSentence().boundingBox())!.height).toBeLessThan(30);
});
