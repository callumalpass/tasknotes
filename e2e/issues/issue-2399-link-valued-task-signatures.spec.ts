import { test, expect } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue2399-${Date.now()}`;
let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;

async function openBase(name: string, formula: string, type = 'tasknotesTaskList') {
  await instance.page.evaluate(async ({ folder, name, content }) => {
    const app = (window as any).app;
    const file = await app.vault.create(`${folder}/${name}.base`, content);
    const leaf = app.workspace.getLeaf('tab');
    await leaf.openFile(file);
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }, {
    folder, name,
    content: stringify({
      filters: { and: [`file.path == "${folder}/Task.md"`] },
      formulas: { backlinks: formula },
      views: [{ type, name, order: ['file.name', 'formula.backlinks'] }],
    }),
  });
}

async function refreshTaskRow(expectedSource: string | null) {
  await expect.poll(() => instance.page.evaluate(folder => {
    const links = (window as any).app.metadataCache.resolvedLinks;
    return ['Source', 'Other'].filter(name => links[`${folder}/${name}.md`]?.[`${folder}/Task.md`]);
  }, folder)).toEqual(expectedSource ? [expectedSource] : []);
  // Native Bases also caches backlinks after edits to other notes. Update the
  // row after link resolution so this checks signatures, not that invalidation.
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(`${folder}/Task.md`);
    await app.vault.modify(file, `${await app.vault.read(file)}\n`);
  }, folder);
}

const activeView = () => instance.page.locator('.workspace-leaf.mod-active');
const backlink = (name: string) => activeView().locator(`.internal-link[data-href="${folder}/${name}.md"]`);

test.beforeAll(async () => {
  instance = await launchObsidian();
  originalSettings = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
      singleClickAction: plugin.settings.singleClickAction,
      doubleClickAction: plugin.settings.doubleClickAction,
    };
    // Exercise native link navigation independently of the card's click action.
    plugin.settings.singleClickAction = 'none';
    plugin.settings.doubleClickAction = 'none';
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    await app.vault.create(`${folder}/Task.md`, '---\ntags: [task]\nstatus: open\n---\n');
    await app.vault.create(`${folder}/Source.md`, `[[${folder}/Task]]\n`);
    await app.vault.create(`${folder}/Other.md`, '# Other\n');
    return original;
  }, folder);
  await expect.poll(() => instance.page.evaluate(folder => {
    return (window as any).app.metadataCache.resolvedLinks[`${folder}/Source.md`]?.[`${folder}/Task.md`];
  }, folder)).toBe(1);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async ({ folder, originalSettings }) => {
      const app = (window as any).app;
      Object.assign(app.plugins.plugins.tasknotes.settings, originalSettings);
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, originalSettings });
  } finally {
    await closeObsidian(instance);
  }
});

for (const [name, formula] of [
  ['list', 'file.backlinks'],
  ['single', 'if(file.backlinks.length > 0, file.backlinks[0], "")'],
]) {
  test(`${name} backlinks remain clickable after row updates replace or clear them`, async () => {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/Source.md`), `[[${folder}/Task]]\n`);
      await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/Other.md`), '# Other\n');
    }, folder);
    await refreshTaskRow('Source');
    await openBase(name, formula);
    await expect(activeView().locator('.task-card')).toHaveCount(1);
    await expect(backlink('Source')).toBeVisible();
    await expect(activeView()).not.toContainText('Error loading tasks');

    // Same-length replacement must invalidate the card, not just list additions.
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/Source.md`), '# Source\n');
      await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/Other.md`), `[[${folder}/Task]]\n`);
    }, folder);
    await refreshTaskRow('Other');
    await expect(backlink('Source')).toHaveCount(0);
    await expect(backlink('Other')).toBeVisible();

    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/Other.md`), '# Other\n');
    }, folder);
    await refreshTaskRow(null);
    await expect(backlink('Other')).toHaveCount(0);
    await expect(activeView().locator('.task-card')).toHaveCount(1);
    await expect(activeView()).not.toContainText('Error loading tasks');

    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      await app.vault.modify(app.vault.getAbstractFileByPath(`${folder}/Source.md`), `[[${folder}/Task]]\n`);
    }, folder);
    await refreshTaskRow('Source');
    await expect(backlink('Source')).toBeVisible();
    await backlink('Source').click();
    await expect.poll(() => instance.page.evaluate(() => {
      return (window as any).app.workspace.getMostRecentLeaf()?.view.file?.path;
    })).toBe(`${folder}/Source.md`);
    await instance.page.keyboard.press('Escape');
    await expect(instance.page.locator('.modal-container')).toHaveCount(0);
  });
}

test('native Bases table renders the original backlink formula (control)', async () => {
  await openBase('native', 'file.backlinks', 'table');
  await expect(activeView()).toContainText('Source');
  await expect(activeView()).not.toContainText('Error loading tasks');
});
