import { test, expect, type Locator, type Page } from '@playwright/test';
import { stringify, parse } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `Collapse2259-${Date.now()}`;
const basePath = `${folder}/Board.base`;
const column = (key: string) => page.locator(`.kanban-view__column[data-group="${key}"]`);
const toggle = (key: string) => column(key).locator('.kanban-view__column-collapse-button');
async function drag(source: Locator, target: Locator) {
  let from: Awaited<ReturnType<Locator['boundingBox']>>;
  let to: Awaited<ReturnType<Locator['boundingBox']>>;
  await expect(async () => {
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    from = await source.boundingBox();
    to = await target.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
  }).toPass({ timeout: 5000 });
  await page.mouse.move(from.x + from.width / 2, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 15, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 12, { steps: 25 });
  await page.mouse.up();
}
async function readYaml(path: string) {
  return parse(await page.evaluate(async path => {
    const app = (window as any).app;
    const text = await app.vault.read(app.vault.getAbstractFileByPath(path));
    return path.endsWith('.md') ? text.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1] : text;
  }, path));
}
test.beforeAll(async () => {
  test.setTimeout(120_000);
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.customStatuses = ['open', 'waiting'].map((value, order) => ({
      id: value, value, label: value, color: '#808080', isCompleted: false, order,
    }));
    plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
    await app.vault.createFolder(folder);
    for (const [name, status] of [['Alpha', 'open'], ['Beta', 'open'], ['Gamma', 'waiting']]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\nstatus: ${status}\npriority: normal\n---\n`);
    }
  }, folder);
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesKanban', name: 'Collapse', groupBy: { property: 'status', direction: 'ASC' },
      columnWidth: 280, hideEmptyColumns: true }],
  });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: basePath, content });
  await expect(page.locator('.kanban-view__card-wrapper')).toHaveCount(3);
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

test('keyboard/touch collapse, late restore, locale stability, drag/drop and restart lifetime', async () => {
  test.setTimeout(180_000);
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.toggle('is-mobile', theme === 'theme-dark');
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    await setObsidianViewport(page, { width: theme === 'theme-dark' ? 430 : 1400, height: 900 });
    await toggle('open').focus();
    await page.keyboard.press('Space');
    await expect(toggle('open')).toHaveAttribute('aria-expanded', 'false');
    await expect(column('open')).toHaveCSS('width', '48px');
    await expect(toggle('waiting')).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: `test-results/pr-2259-${theme}.png` });
    await page.keyboard.press('Enter');
    await expect(toggle('open')).toHaveAttribute('aria-expanded', 'true');
  }
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await setObsidianViewport(page, { width: 1400, height: 900 });
  const key = await column('waiting').getAttribute('data-collapse-key');
  await page.evaluate(key => {
    const view = (window as any).app.workspace.activeLeaf.view.controller.view;
    view.setEphemeralState({ collapsedColumns: [key] });
  }, key);
  await expect(toggle('waiting')).toHaveAttribute('aria-expanded', 'false');

  await expect(column('waiting')).toHaveCSS('width', '48px');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const box = (await toggle('waiting').boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 12, y: box.y + 12 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(toggle('waiting')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.kanban-view__touch-drag-source')).toHaveCount(0);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp.detach();

  await toggle('waiting').click();
  await page.evaluate(async () => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.i18n.setLocale('de');
    await (window as any).app.workspace.activeLeaf.view.controller.view.render();
  });
  await expect(toggle('waiting')).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle('waiting')).toHaveAttribute('aria-label', /Spalte/);

  const alpha = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/Alpha.md"]`);
  await drag(alpha, column('waiting').locator('.kanban-view__column-header'));
  await expect.poll(async () => (await readYaml(`${folder}/Alpha.md`)).status).toBe('waiting');
  await expect(toggle('waiting')).toHaveAttribute('aria-expanded', 'false');
  await drag(column('waiting').locator('[data-column-key]'), column('open').locator('[data-column-key]'));
  await expect.poll(async () => (await readYaml(basePath)).views[0].columnOrder).toContain('waiting');

  // Ephemeral state is intentionally not a saved .base option or workspace setting.
  await closeObsidian(instance);
  const port = process.env.TASKNOTES_E2E_REMOTE_DEBUGGING_PORT;
  process.env.TASKNOTES_E2E_REMOTE_DEBUGGING_PORT = String(Number(port ?? 9223) + 10);
  try { instance = await launchObsidian(); }
  finally {
    if (port === undefined) delete process.env.TASKNOTES_E2E_REMOTE_DEBUGGING_PORT;
    else process.env.TASKNOTES_E2E_REMOTE_DEBUGGING_PORT = port;
  }
  page = instance.page;
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, basePath);
  await expect(toggle('waiting')).toHaveAttribute('aria-expanded', 'true');
  expect((await readYaml(basePath)).views[0].collapsedColumns).toBeUndefined();
});
