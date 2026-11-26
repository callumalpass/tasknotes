import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { launchObsidian, closeObsidian, openTaskNotesSettings, nativeSettingRow, type ObsidianApp } from './obsidian';

const vault = path.resolve(process.env.TASKNOTES_E2E_VAULT_DIR ?? 'tasknotes-e2e-vault');
const pending = '.tasknotes/migrations/mdbase-v0.2-pending.json';
const managed = ['mdbase.yaml', '_types', '_contracts', '_schemas', '_mdbase', '.tasknotes', '.obsidian/plugins/tasknotes/data.json'];

for (const choice of ['keep', 'restore', 'unsafe'] as const) {
  test(`blocked metadata migration: ${choice} recovery preserves the safety fence`, async ({}, info) => {
    const archive = info.outputPath('metadata-before');
    fs.mkdirSync(archive, { recursive: true });
    const existed = managed.filter(name => fs.existsSync(path.join(vault, name)));
    for (const name of existed) {
      fs.mkdirSync(path.dirname(path.join(archive, name)), { recursive: true });
      fs.cpSync(path.join(vault, name), path.join(archive, name), { recursive: true });
    }
    const write = (name: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(vault, name)), { recursive: true });
      fs.writeFileSync(path.join(vault, name), content);
    };
    const read = (name: string) => fs.readFileSync(path.join(vault, name), 'utf8');
    const backup = `.tasknotes/migrations/release-recovery-${choice}`;
    const config = 'spec_version: 0.2.1\nname: TaskNotes\nsettings:\n  types_folder: _types\n';
    const original = '---\nname: task\n---\n';
    const edited = original + '# Concurrent metadata edit\n';
    const snapshots = [{ path: 'mdbase.yaml', content: config }, { path: '_types/task.md', content: original }, { path: '_contracts/tasknotes.task.md', content: null }];
    const intendedWrites = [{ path: 'mdbase.yaml', content: config.replace('0.2.1', '0.3.0') }, { path: '_types/task.md', content: original + '# Migrated\n' }, { path: '_contracts/tasknotes.task.md', content: '# Migrated contract\n' }];
    const journal = JSON.stringify({ backupFolder: backup, snapshots, intendedWrites }, null, 2);
    let instance: ObsidianApp | undefined;
    try {
      const settings = JSON.parse(read('.obsidian/plugins/tasknotes/data.json'));
      write('.obsidian/plugins/tasknotes/data.json', JSON.stringify({ ...settings, enableMdbaseSpec: true, uiLanguage: 'en' }));
      write('mdbase.yaml', config);
      write('_types/task.md', edited);
      write('_contracts/tasknotes.task.md', '# Migrated contract\n');
      write(`${backup}/mdbase.yaml.bak`, config);
      write(`${backup}/task.md.bak`, choice === 'unsafe' ? 'Mismatched backup' : original);
      write(`${backup}/manifest.json`, journal);
      write(pending, journal);
      instance = await launchObsidian();
      const page = instance.page;
      await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.mdbaseSpecService.getPendingV02MigrationRecovery()?.canRestoreBackup)).toBe(choice !== 'unsafe');
      expect(read('_types/task.md')).toBe(edited);
      const panel = await openTaskNotesSettings(page, 'TaskNotes App');
      await expect(panel.getByText('Metadata updates are paused', { exact: true })).toBeVisible();
      const restore = nativeSettingRow(panel, 'Restore v0.2 backup');
      if (choice === 'unsafe') {
        await expect(restore).toHaveCount(0);
        expect(read(pending)).toBe(journal);
        expect(read('_types/task.md')).toBe(edited);
        return;
      }
      await panel.screenshot({ path: info.outputPath('recovery-panel.png') });
      await expect(restore).toBeVisible();
      const label = choice === 'restore' ? 'Restore v0.2 backup' : 'Keep current files and resume';
      const button = () => nativeSettingRow(panel, label);
      await button().click();
      await panel.locator('.modal').getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(read(pending)).toBe(journal);
      expect(read('_types/task.md')).toBe(edited);
      await button().click();
      await panel.locator('.modal').getByRole('button', { name: label, exact: true }).click();
      await expect.poll(() => fs.existsSync(path.join(vault, pending))).toBe(false);
      expect(read('_types/task.md')).toBe(choice === 'restore' ? original : edited);
      expect(read(`${backup}/task.md.bak`)).toBe(original);
      expect(read(`${backup}/mdbase.yaml.bak`)).toBe(config);
      expect(read(`${backup}/manifest.json`)).toBe(journal);
    } finally {
      if (instance) await closeObsidian(instance);
      for (const name of managed) fs.rmSync(path.join(vault, name), { recursive: true, force: true });
      for (const name of existed) fs.cpSync(path.join(archive, name), path.join(vault, name), { recursive: true });
    }
  });
}
