import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchObsidian, closeObsidian, openTaskNotesSettings, closeObsidianSettings, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;
const settingsPath = resolve(process.env.TASKNOTES_E2E_VAULT_DIR ?? 'tasknotes-e2e-vault', '.obsidian/plugins/tasknotes/data.json');

test.beforeAll(async () => {
  instance = await launchObsidian();
  originalSettings = await instance.page.evaluate(() => JSON.parse(JSON.stringify((window as any).app.plugins.plugins.tasknotes.settings)));
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async settings => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      plugin.settings = settings;
      await plugin.saveSettings();
    }, originalSettings);
  } finally {
    await closeObsidian(instance);
  }
});

test('renaming a status keeps its label editable and saves both fields on close', async ({}, testInfo) => {
  const workspace = instance.page;
  const page = await openTaskNotesSettings(workspace, 'Task properties');
  const property = page.locator('[data-card-id="property-status"]');
  await property.locator(':scope > .tasknotes-settings__card-header').click();
  await property.getByRole('button', { name: 'Add status', exact: true }).click();
  const card = property.locator('.tasknotes-statuses-container > .tasknotes-settings__card').last();
  await card.locator(':scope > .tasknotes-settings__card-header').click();
  const value = `status-continuity-${Date.now()}`;
  const label = `Saved label ${value}`;
  const valueInput = card.locator('input[type="text"]').first();
  const labelInput = card.locator('input[type="text"]').nth(1);
  await valueInput.fill(value);
  await valueInput.press('Tab');
  await expect.poll(() => JSON.parse(readFileSync(settingsPath, 'utf8')).customStatuses.find((status: any) => status.value === value)?.value).toBe(value);
  await testInfo.attach('after-identifier-blur', {
    body: JSON.stringify({
      disk: JSON.parse(readFileSync(settingsPath, 'utf8')).customStatuses.find((status: any) => status.value === value),
      memory: await workspace.evaluate(value => (window as any).app.plugins.plugins.tasknotes.settings.customStatuses.find((status: any) => status.value === value), value),
    }, null, 2),
    contentType: 'application/json',
  });
  await expect(labelInput).toBeFocused();
  await labelInput.fill(label);
  await closeObsidianSettings(workspace, page);
  await expect.poll(() => JSON.parse(readFileSync(settingsPath, 'utf8')).customStatuses.find((status: any) => status.value === value)?.label).toBe(label);
  const reopened = await openTaskNotesSettings(workspace, 'Task properties');
  const reopenedProperty = reopened.locator('[data-card-id="property-status"]');
  if (await reopenedProperty.locator(':scope > .tasknotes-settings__card-header button').getAttribute('aria-expanded') === 'false') {
    await reopenedProperty.locator(':scope > .tasknotes-settings__card-header').click();
  }
  const saved = reopenedProperty.locator('.tasknotes-statuses-container > .tasknotes-settings__card').filter({ has: reopened.locator('.tasknotes-settings__card-primary-text').getByText(value, { exact: true }) });
  if (await saved.locator(':scope > .tasknotes-settings__card-header button.tasknotes-settings__card-disclosure').getAttribute('aria-expanded') === 'false') {
    await saved.locator(':scope > .tasknotes-settings__card-header').click();
  }
  await expect(saved.locator('input[type="text"]').first()).toBeVisible();
  await expect(saved.locator('input[type="text"]').nth(1)).toBeVisible();
  await expect(saved.locator('input[type="text"]').first()).toHaveValue(value);
  await expect(saved.locator('input[type="text"]').nth(1)).toHaveValue(label);
  await saved.locator('input[type="text"]').nth(1).scrollIntoViewIfNeeded();
  await expect(saved.locator('input[type="text"]').nth(1)).toBeInViewport();
  await testInfo.attach('persisted-status-fields', { body: await reopened.screenshot(), contentType: 'image/png' });
  await closeObsidianSettings(workspace, reopened);
});
