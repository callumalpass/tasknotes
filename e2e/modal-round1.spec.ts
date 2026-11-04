import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
});

test.afterAll(async () => { if (instance) await closeObsidian(instance); });

test('modified Enter saves from a chip after Escape without leaking the composer', async () => {
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  const modal = page.locator('.modal.mod-tasknotes');
  await modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content').fill(`Modal shortcut regression ${Date.now()}`);
  const status = modal.locator('[data-type="status"]');
  await status.click();
  await expect(page.locator('.tn-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(status).toBeFocused();
  await page.keyboard.press('Control+Enter');
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.tn-popover')).toHaveCount(0);
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  await expect(modal).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-container')).toHaveCount(0);
});
