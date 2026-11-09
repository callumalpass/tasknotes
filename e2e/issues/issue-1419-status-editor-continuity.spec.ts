import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchObsidian, closeObsidian, openTaskNotesSettings, revealTaskNotesSetting, nativeSettingRow, closeObsidianSettings, type ObsidianApp } from '../obsidian';

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
  let page = await openTaskNotesSettings(workspace, 'Properties');
  await page.locator('.setting-item.mod-navigable').filter({ has: page.locator('.setting-item-name').getByText('Status', { exact: true }) }).click();
  await page.locator('[aria-label="Add status"]:visible').click();
  const id = await workspace.evaluate(() => (window as any).app.plugins.plugins.tasknotes.settings.customStatuses.at(-1).id);
  await closeObsidianSettings(workspace, page);
  page = await revealTaskNotesSetting(workspace, 'status.' + id + '.value');
  const value = 'status-continuity-' + Date.now();
  const label = 'Saved label ' + value;
  const valueInput = nativeSettingRow(page, 'Value:').locator('input');
  const labelInput = nativeSettingRow(page, 'Label:').locator('input');
  await valueInput.fill(value);
  await valueInput.press('Tab');
  await expect(nativeSettingRow(page, 'Label:')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(labelInput).toBeFocused();
  await labelInput.fill(label);
  await closeObsidianSettings(workspace, page);
  await expect.poll(() => JSON.parse(readFileSync(settingsPath, 'utf8')).customStatuses.find((status: any) => status.value === value)?.label).toBe(label);
  const reopened = await revealTaskNotesSetting(workspace, 'status.' + id + '.value');
  await expect(nativeSettingRow(reopened, 'Value:').locator('input')).toHaveValue(value);
  await expect(nativeSettingRow(reopened, 'Label:').locator('input')).toHaveValue(label);
  await testInfo.attach('persisted-status-fields', { body: await reopened.screenshot(), contentType: 'image/png' });
  await closeObsidianSettings(workspace, reopened);
});
