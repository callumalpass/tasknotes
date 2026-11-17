/**
 * Issue #2574: the stable task ID property can be remapped like other fields.
 *
 * Remaps `id` to `tasknote_id`, then checks the settings page, a newly
 * created task and ID lookup. (The e2e vault has no mdbase collection; the
 * generated task type is covered by unit tests.) The mapping is restored and
 * the created task deleted afterwards.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2574
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, openTaskNotesSettings } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #2574: remappable task ID', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await app.page.evaluate(async () => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        if (plugin.settings.fieldMapping.id !== 'id') {
          plugin.settings.fieldMapping.id = 'id';
          await plugin.saveSettings();
        }
      });
      await closeObsidian(app);
    }
  });

  test('writes and reads the ID under the mapped property', async () => {
    const page = app.page;

    expect(
      await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.settings.fieldMapping.id)
    ).toBe('id');

    await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      plugin.settings.fieldMapping.id = 'tasknote_id';
      await plugin.saveSettings();
    });

    const result = await page.evaluate(async () => {
      const obsidian = (window as any).app;
      const plugin = obsidian.plugins.plugins.tasknotes;
      const { file, taskInfo } = await plugin.taskService.createTask(
        { title: 'Issue 2574 remapped id' },
        { applyDefaults: false }
      );
      const content: string = await obsidian.vault.read(file);
      let byId: string[] = [];
      for (let attempt = 0; attempt < 20 && byId.length === 0; attempt++) {
        byId = (await plugin.cacheManager.getTasksById(taskInfo.id)).map((task: any) => task.path);
        if (byId.length === 0) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await obsidian.vault.delete(file);
      return { id: taskInfo.id as string, path: file.path as string, content, byId };
    });

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.content).toContain(`tasknote_id: ${result.id}`);
    expect(result.content).not.toMatch(/^id:/m);
    expect(result.byId).toEqual([result.path]);

    const settings = await openTaskNotesSettings(page, 'Properties/Metadata & integration properties');
    await expect(
      settings.locator('.vertical-tab-content:visible').getByText('Task ID', { exact: true })
    ).toBeVisible();
  });
});
