import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { closeObsidian, closeObsidianSettings, launchObsidian, nativeSettingRow, revealTaskNotesSetting } from '../obsidian';

const vault = resolve(process.env.TASKNOTES_E2E_VAULT_DIR ?? 'tasknotes-e2e-vault');
const settingsPath = resolve(vault, '.obsidian/plugins/tasknotes/data.json');
const typePath = resolve(vault, '_mdbase/types/task.md');
const migrationsPath = resolve(vault, '.tasknotes/migrations');

function migrationBackups() {
  return existsSync(migrationsPath)
    ? readdirSync(migrationsPath).filter(name => name.startsWith('mdbase-v0.3-')).sort()
    : [];
}

test('status and priority editors keep saving after the canonical type is written', async () => {
  const instance = await launchObsidian();
  const workspace = instance.page;
  const original = JSON.parse(readFileSync(settingsPath, 'utf8'));
  try {
    await workspace.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      plugin.settings.enableMdbaseSpec = true;
      await plugin.saveSettings();
    });
    await expect.poll(() => existsSync(typePath)).toBe(true);
    const originalBackups = migrationBackups();

    for (const [kind, list, id] of [
      ['status', 'customStatuses', 'open'],
      ['priority', 'customPriorities', 'normal'],
    ]) {
      const savedEntry = () => JSON.parse(readFileSync(settingsPath, 'utf8'))[list].find((entry: { id: string }) => entry.id === id);
      const panel = await revealTaskNotesSetting(workspace, `${kind}.${id}.icon`);
      const icon = nativeSettingRow(panel, 'Icon:').locator('input');
      const value = `issue-2671-${kind}`;
      const label = `Issue 2671 ${kind}`;

      await icon.fill('circle-');
      await expect.poll(() => savedEntry().icon).toBe('circle-');
      await icon.pressSequentially('help');
      await panel.keyboard.press('Tab');
      await expect.poll(() => savedEntry().icon).toBe('circle-help');

      await nativeSettingRow(panel, 'Value:').locator('input').fill(value);
      await nativeSettingRow(panel, 'Label:').locator('input').fill(label);
      await closeObsidianSettings(workspace, panel);
      await expect.poll(savedEntry).toMatchObject({ value, label, icon: 'circle-help' });

      const frontmatter = parse(readFileSync(typePath, 'utf8').split('---')[1]);
      const binding = frontmatter.implements.find((implementation: { contract: string }) => implementation.contract === 'tasknotes.task')?.binding;
      expect(binding[kind].definitions).toEqual(expect.arrayContaining([
        expect.objectContaining({ value, label, icon: 'circle-help' }),
      ]));
      const reopened = await revealTaskNotesSetting(workspace, `${kind}.${id}.icon`);
      await expect(nativeSettingRow(reopened, 'Icon:').locator('input')).toHaveValue('circle-help');
      await closeObsidianSettings(workspace, reopened);
    }

    expect(migrationBackups()).toEqual(originalBackups);
  } finally {
    try {
      await workspace.evaluate(async settings => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        plugin.settings = settings;
        await plugin.saveSettings();
      }, original);
    } finally {
      await closeObsidian(instance);
    }
  }
});
