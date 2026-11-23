import { expect, test } from '@playwright/test';
import type TaskNotesPlugin from '../../src/main';
import {
  closeObsidian,
  closeObsidianSettings,
  launchObsidian,
  nativeSettingRow,
  openTaskNotesSettings,
  selectTaskNotesSettingsTab,
} from '../obsidian';

const cases = [
  { property: 'Status', action: 'Reorder statuses', key: 'customStatuses' },
  { property: 'Priority', action: 'Reorder priorities', key: 'customPriorities' },
] as const;

for (const { property, action, key } of cases) {
  test(`issue #2677: ${property.toLowerCase()} drag order is saved`, async () => {
    const obsidian = await launchObsidian();
    const original = await obsidian.page.evaluate(() => {
      const plugin: TaskNotesPlugin = (window as any).app.plugins.getPlugin('tasknotes');
      return {
        customStatuses: plugin.settings.customStatuses,
        customPriorities: plugin.settings.customPriorities,
      };
    });
    let settings;
    try {
      settings = await openTaskNotesSettings(obsidian.page, `Properties/${property}`);
      await nativeSettingRow(settings, action).click();
      await expect(settings.locator('.setting-page-title:visible').last()).toHaveText(action);

      const rows = settings.locator('.setting-group.mod-list:visible .setting-items > .setting-item');
      const values = rows.locator('.setting-item-description');
      const handle = rows.nth(1).getByLabel('Drag to rearrange');
      await expect(handle).toBeVisible();
      const before = await values.allTextContents();
      expect(before.length).toBeGreaterThanOrEqual(3);
      const expected = [before[0], before[2], before[1], ...before.slice(3)];

      const destination = await rows.nth(2).getByLabel('Drag to rearrange').boundingBox();
      expect(destination).not.toBeNull();
      await handle.hover();
      await settings.mouse.down();
      await settings.mouse.move(
        destination!.x + destination!.width / 2,
        destination!.y + destination!.height / 2 + 4,
        { steps: 12 },
      );
      await settings.mouse.up();

      await expect(values).toHaveText(expected);
      await expect.poll(() => obsidian.page.evaluate(async key => {
        const plugin: TaskNotesPlugin = (window as any).app.plugins.getPlugin('tasknotes');
        const saved = await plugin.loadData();
        return saved[key].map((item: { value: string }) => item.value);
      }, key)).toEqual(expected);

      await selectTaskNotesSettingsTab(settings, `Properties/${property}`);
      await expect(values).toHaveText(expected);
      await rows.nth(1).click();
      await expect(nativeSettingRow(settings, 'Value:').locator('input')).toHaveValue(expected[1]);
    } finally {
      try {
        if (settings) await closeObsidianSettings(obsidian.page, settings);
        await obsidian.page.evaluate(async original => {
          const plugin: TaskNotesPlugin = (window as any).app.plugins.getPlugin('tasknotes');
          Object.assign(plugin.settings, original);
          await plugin.saveSettings();
        }, original);
      } finally {
        await closeObsidian(obsidian);
      }
    }
  });
}
