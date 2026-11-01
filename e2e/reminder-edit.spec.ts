import { test, expect } from '@playwright/test';
import {
  launchObsidian,
  closeObsidian,
  closeObsidianSettings,
  openTaskNotesSettings,
  ObsidianApp,
} from './obsidian';

let app: ObsidianApp;

test.describe('Reminder editing and settings card headers', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) await closeObsidian(app);
  });

  test('edits a reminder in place and keeps its id', async () => {
    const page = app.page;
    const taskPath = await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const { taskInfo } = await plugin.taskService.createTask({
        title: `Reminder edit e2e ${Date.now()}`,
        due: '2030-06-26',
        reminders: [
          { id: 'rem_e2e_edit', type: 'absolute', absoluteTime: '2030-06-26T09:00:00', description: 'Call' },
        ],
      });
      return taskInfo.path as string;
    });

    await page.evaluate(async (path) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const task = await plugin.cacheManager.getTaskInfo(path);
      await plugin.openTaskEditModal(task);
    }, taskPath);

    const taskModal = page.locator('.modal').filter({ has: page.locator('[data-type="reminders"]') });
    await taskModal.locator('[data-type="reminders"]').click();
    await page.locator('.menu-item').filter({ hasText: 'Manage all reminders' }).click();

    const reminderModal = page.locator('.tasknotes-reminder-modal');
    await expect(reminderModal.locator('.reminder-modal__reminder-card')).toHaveCount(1);
    await reminderModal.locator('.reminder-modal__edit-btn').click();

    const timeInput = reminderModal.locator('.absolute-fields input[type="time"]');
    await expect(timeInput).toHaveValue('09:00');
    await expect(reminderModal.locator('input.reminder-modal__description-input')).toHaveValue('Call');
    await timeInput.fill('14:30');
    await reminderModal.locator('.reminder-add-btn').click();
    await expect(reminderModal.locator('.reminder-modal__reminder-card')).toHaveCount(1);
    await reminderModal.locator('.reminder-modal__save-btn').click();
    await expect(reminderModal).toBeHidden();

    await taskModal.locator('button.mod-cta').filter({ hasText: /^Save/ }).click();
    await expect(taskModal).toBeHidden();

    await expect.poll(async () => page.evaluate(async (path) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      const task = await plugin.cacheManager.getTaskInfo(path);
      return task?.reminders;
    }, taskPath)).toEqual([
      { id: 'rem_e2e_edit', type: 'absolute', absoluteTime: '2030-06-26T14:30:00', description: 'Call' },
    ]);

    await page.evaluate(async (path) => {
      const obsidian = (window as any).app;
      const file = obsidian.vault.getAbstractFileByPath(path);
      if (file) await obsidian.vault.delete(file);
    }, taskPath);
  });

  test('custom field card header follows edits', async () => {
    const page = app.page;
    const fieldId = `field_e2e_header_${Date.now()}`;
    await page.evaluate(async (id) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      plugin.settings.userFields = [
        ...(plugin.settings.userFields ?? []),
        { id, displayName: 'Header before', key: 'header_before', type: 'text' },
      ];
      await plugin.saveSettings();
    }, fieldId);

    const settingsPage = await openTaskNotesSettings(page, 'Task properties');
    try {
      const card = settingsPage.locator(`[data-card-id="${fieldId}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator('.tasknotes-settings__card-header').click();
      await card.locator('input[placeholder="property-name"]').fill('header_after');
      await expect(card.locator('.tasknotes-settings__card-secondary-text')).toHaveText('header_after');
    } finally {
      await closeObsidianSettings(page, settingsPage);
      await page.evaluate(async (id) => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        plugin.settings.userFields = plugin.settings.userFields.filter((f: any) => f.id !== id);
        await plugin.saveSettings();
      }, fieldId);
    }
  });
});
