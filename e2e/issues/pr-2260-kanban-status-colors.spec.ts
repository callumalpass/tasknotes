import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `Colors2260-${Date.now()}`;
const colors: Record<string, string> = {
  open: '#7c3aed', themed: 'blue', missing: '', unresolved: 'var(--tn-missing-colour)',
  length: 'var(--tn-test-length)', invalid: 'rgb(',
};
async function openBoard(name: string, swimlane = false, status = true) {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesKanban', name, groupBy: { property: status ? 'state' : 'priority', direction: 'ASC' },
      ...(swimlane ? { swimLane: 'note.priority', hideEmptySwimLanes: true } : {}), columnWidth: 220, hideEmptyColumns: true }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    let file = app.vault.getAbstractFileByPath(path);
    if (file) await app.vault.modify(file, content);
    else file = await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { path: `${folder}/${name}.base`, content });
  await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(6);
}
test.beforeAll(async () => {
  test.setTimeout(120_000);
  instance = await launchObsidian();
  page = instance.page;
  page.on('pageerror', error => console.error('Obsidian page error:', error));
  await page.evaluate(async ({ folder, colors }) => {
    const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
    document.body.style.setProperty('--tn-test-length', '12px');
    plugin.settings.fieldMapping.status = 'state';
    plugin.fieldMapper.updateMapping(plugin.settings.fieldMapping);
    plugin.settings.customStatuses = Object.entries(colors).map(([value, color], order) => ({
      id: value, value, label: value, color, isCompleted: false, order,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    await app.vault.createFolder(folder);
    for (const status of Object.keys(colors)) {
      await app.vault.create(`${folder}/${status}.md`, `---\ntags: [task]\nstate: ${status}\npriority: normal\n---\n`);
    }
  }, { folder, colors });
});
test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

test('flat/swimlane tints, unresolved-variable fallback, mobile, live settings and popout', async () => {
  test.setTimeout(120_000);
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
      document.body.classList.toggle('is-mobile', theme === 'theme-dark');
    }, theme);
    await setObsidianViewport(page, { width: theme === 'theme-dark' ? 430 : 1400, height: 900 });
    for (const swimlane of [false, true]) {
      await openBoard(`${theme}-${swimlane}`, swimlane);
      const target = (key: string) => page.locator(swimlane
        ? `.kanban-view__swimlane-column[data-column="${key}"]`
        : `.kanban-view__column[data-group="${key}"]`);
      for (const key of ['open', 'themed']) {
        await expect(target(key)).toHaveClass(/--status-colored/);
        expect(await target(key).evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      }
      if (swimlane) await expect(page.locator('.kanban-view__column-header-cell--status-colored')).toHaveCount(2);
      for (const key of ['missing', 'unresolved', 'length', 'invalid']) {
        await expect(target(key)).not.toHaveClass(/--status-colored/);
        expect(await target(key).evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      }
      await page.bringToFront();
      await page.waitForTimeout(250); // Allow the native compositor to paint the new view.
      await page.screenshot({ path: `test-results/pr-2260-${theme}-${swimlane}.png` });
    }
  }
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await setObsidianViewport(page, { width: 1400, height: 900 });
  await openBoard('Live');
  const open = page.locator('.kanban-view__column[data-group="open"]');
  const before = await open.evaluate(el => getComputedStyle(el).backgroundColor);
  await page.evaluate(async () => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.customStatuses.find((status: any) => status.value === 'open').color = '#e03131';
    await plugin.saveSettings();
  });
  await expect.poll(() => open.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  const themed = page.locator('.kanban-view__column[data-group="themed"]');
  const oldThemeColour = await themed.evaluate(el => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => {
    document.body.style.setProperty('--color-blue', '#00cc00');
    (window as any).app.workspace.trigger('css-change');
  });
  await expect.poll(() => themed.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(oldThemeColour);
  await page.evaluate(() => document.body.style.removeProperty('--color-blue'));
  await openBoard('Nonstatus', true, false);
  await expect(page.locator('[class*="--status-colored"]')).toHaveCount(0);

  await openBoard('Popout');
  const newPage = page.context().waitForEvent('page');
  await page.evaluate(() => { const app = (window as any).app; app.workspace.moveLeafToPopout(app.workspace.activeLeaf); });
  page = await newPage;
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.kanban-view__column--status-colored')).toHaveCount(2);
  await expect(page.locator('.kanban-view__column[data-group="unresolved"]')).not.toHaveClass(/--status-colored/);
  expect(await page.locator('.kanban-view__column[data-group="open"]').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});
