import { test, expect } from '@playwright/test';
import {
  launchObsidian,
  closeObsidian,
  openTaskNotesSettings,
  selectTaskNotesSettingsTab,
  closeObsidianSettings,
} from './obsidian';

test('custom properties expose a usable delete action', async () => {
  const obsidian = await launchObsidian();
  let settingsPage;
  let createdFieldId: string | undefined;
  let originalProjects: string | undefined;
  try {
    settingsPage = await openTaskNotesSettings(obsidian.page);
    await selectTaskNotesSettingsTab(settingsPage, 'Properties');
    const add = settingsPage.getByLabel('Add user field');
    await add.click();
    createdFieldId = await obsidian.page.evaluate(
      () => (window as any).app.plugins.plugins.tasknotes.settings.userFields.at(-1).id
    );
    const row = settingsPage.locator('.setting-item').filter({
      has: settingsPage.getByText('New property', { exact: true }),
    });
    await expect(row).toBeVisible();
    await row.click();
    const deleteAction = settingsPage.getByText('Delete New property?', { exact: true });
    await expect(deleteAction).toBeVisible();
    await deleteAction.click();
    const confirmation = settingsPage.locator('.modal').filter({
      hasText: 'This removes the property from TaskNotes forms, not from existing notes.',
    });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    expect(await obsidian.page.evaluate(
      id => (window as any).app.plugins.plugins.tasknotes.settings.userFields.some((field: any) => field.id === id),
      createdFieldId
    )).toBe(true);
    await deleteAction.click();
    await confirmation.getByRole('button', { name: 'Delete property' }).click();
    await expect.poll(() => obsidian.page.evaluate(
      id => (window as any).app.plugins.plugins.tasknotes.settings.userFields.some((field: any) => field.id === id),
      createdFieldId
    )).toBe(false);
    expect(await obsidian.page.evaluate(async id => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const saved = await plugin.loadData();
      return !saved.userFields.some((field: any) => field.id === id)
        && !plugin.settings.modalFieldsConfig.fields.some((field: any) => field.id === id);
    }, createdFieldId)).toBe(true);

    originalProjects = await obsidian.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const original = plugin.settings.taskCreationDefaults.defaultProjects;
      plugin.settings.taskCreationDefaults.defaultProjects = '[[tasknotes-removal-test-project]]';
      (window as any).app.setting.pluginTabs.find((tab: any) => tab.id === 'tasknotes').update();
      return original;
    });
    await selectTaskNotesSettingsTab(settingsPage, 'Task creation/Default projects');
    const projectRow = settingsPage.locator('.setting-item').filter({
      has: settingsPage.getByText('[[tasknotes-removal-test-project]]', { exact: true }),
    });
    await expect(projectRow).toBeVisible();
    await projectRow.getByLabel('Delete', { exact: true }).click();
    await expect(projectRow).toHaveCount(0);
    expect(await obsidian.page.evaluate(async () =>
      (await (window as any).app.plugins.plugins.tasknotes.loadData()).taskCreationDefaults.defaultProjects
    )).toBe('');
  } finally {
    await obsidian.page.evaluate(async ({ id, projects }) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      let changed = false;
      if (id && plugin.settings.userFields.some((field: any) => field.id === id)) {
        plugin.settings.userFields = plugin.settings.userFields.filter((field: any) => field.id !== id);
        plugin.settings.modalFieldsConfig.fields = plugin.settings.modalFieldsConfig.fields.filter((field: any) => field.id !== id);
        changed = true;
      }
      if (projects !== undefined && plugin.settings.taskCreationDefaults.defaultProjects !== projects) {
        plugin.settings.taskCreationDefaults.defaultProjects = projects;
        changed = true;
      }
      if (changed) await plugin.saveSettings();
    }, { id: createdFieldId, projects: originalProjects });
    if (settingsPage) await closeObsidianSettings(obsidian.page, settingsPage);
    await closeObsidian(obsidian);
  }
});
