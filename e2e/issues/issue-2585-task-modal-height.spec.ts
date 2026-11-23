/**
 * Discussion #2585: the 5.0 edit modal was a fixed 540px tall, so fields and details needed
 * scrolling even in a tall window. The two-pane modal now uses the window's available height
 * (up to 900px), and still keeps one height when More fields opens.
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/2585
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const run = `Issue2585-${Date.now()}`;
const taskPath = `${run}/Tall.md`;
let instance: ObsidianApp;
let page: Page;
let originalSplit: unknown;
const modal = () => page.locator('.tasknotes-plugin.minimalist-task-modal > .modal');

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  originalSplit = await page.evaluate(async ({ run, taskPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = plugin.settings.enableModalSplitLayout;
    plugin.settings.enableModalSplitLayout = true;
    await app.vault.createFolder(run);
    await app.vault.create(taskPath, `---\ntags: [task]\ntitle: Tall\nstatus: ${plugin.settings.defaultTaskStatus}\n---\n\nDetails\n`);
    return original;
  }, { run, taskPath });
  await expect.poll(() => page.evaluate(async taskPath => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)), taskPath)).toBe(true);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ run, originalSplit }) => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings.enableModalSplitLayout = originalSplit ?? true;
      const folder = app.vault.getAbstractFileByPath(run);
      if (folder) await app.vault.delete(folder, true);
    }, { run, originalSplit });
  } finally {
    await closeObsidian(instance);
  }
});

async function editModalHeight(windowHeight: number): Promise<{ modal: number; window: number }> {
  await setObsidianViewport(page, { width: 1180, height: windowHeight });
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  await expect(modal()).toBeVisible();
  const sizes = await modal().evaluate(element => ({
    modal: element.getBoundingClientRect().height,
    window: element.parentElement!.getBoundingClientRect().height,
  }));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click({ timeout: 1000 }).catch(() => {});
  await expect(modal()).toHaveCount(0);
  return sizes;
}

test('the edit modal uses the available window height', async () => {
  const tall = await editModalHeight(1000);
  expect(tall.modal).toBeGreaterThan(700);
  expect(tall.modal).toBeLessThanOrEqual(tall.window * 0.8 + 1);

  const short = await editModalHeight(640);
  expect(short.modal).toBeLessThanOrEqual(short.window * 0.8 + 1);
  expect(short.modal).toBeGreaterThan(short.window * 0.7);
});
