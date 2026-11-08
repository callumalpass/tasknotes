import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
test.beforeAll(async () => { instance = await launchObsidian(); });
test.afterAll(async () => { if (instance) await closeObsidian(instance); });

test('typing comma-separated tags preserves the separator in the create modal', async () => {
  const page = instance.page;
  await page.evaluate(async () => {
    const app = (window as any).app;
    await new Promise<void>(resolve => app.workspace.onLayoutReady(resolve));
    const plugin = app.plugins.plugins.tasknotes;
    plugin.i18n.setLocale('en');
    plugin.settings.enableNaturalLanguageInput = false;
    plugin.openTaskCreationModal();
  });
  const tags = page.locator('.modal.mod-tasknotes input[placeholder="tag1, tag2"]');
  await expect(tags).toBeVisible();

  // Control: a single input event supplies an already-complete list.
  await tags.fill('work, home');
  await expect(tags).toHaveValue('work, home');
  await tags.fill('');

  // Real typing must retain the comma before the second tag is entered.
  await tags.pressSequentially('work, home', { delay: 50 });
  await expect(tags).toHaveValue('work, home');

  // Sanitising still applies once the field is left.
  await tags.pressSequentially(', ', { delay: 50 });
  await expect(tags).toHaveValue('work, home, ');
  const contexts = page.locator('.modal.mod-tasknotes input[placeholder="context1, context2"]');
  await contexts.click();
  await expect(tags).toHaveValue('work, home');

  await contexts.pressSequentially('office, phone', { delay: 50 });
  await expect(contexts).toHaveValue('office, phone');
});
