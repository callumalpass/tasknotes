import { test, expect } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Visible child tags must not be restored as though they were hidden identifiers.
const folder = `Issue2140-${Date.now()}`;
let instance: ObsidianApp;
let originalSettings: Record<string, unknown>;

test.beforeAll(async () => {
  instance = await launchObsidian();
  originalSettings = await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskTag: plugin.settings.taskTag,
      hideIdentifyingTagsInCards: plugin.settings.hideIdentifyingTagsInCards,
      hideIdentifyingTagsMode: plugin.settings.hideIdentifyingTagsMode,
    };
    Object.assign(plugin.settings, {
      taskIdentificationMethod: 'tag', taskTag: 'task',
      hideIdentifyingTagsInCards: false, hideIdentifyingTagsMode: 'all',
    });
    await app.vault.createFolder(folder);
    return original;
  }, folder);
});

test.afterAll(async () => {
  try {
    if (instance && !instance.page.isClosed()) {
      await instance.page.evaluate(async ({ folder, originalSettings }) => {
        const app = (window as any).app;
        if (originalSettings) Object.assign(app.plugins.plugins.tasknotes.settings, originalSettings);
        const fixture = app.vault.getAbstractFileByPath(folder);
        if (fixture) await app.vault.delete(fixture, true);
      }, { folder, originalSettings });
    }
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

for (const scalar of [false, true]) {
  for (const prefixed of [false, true]) {
    test(`visible nested tag removal persists: scalar=${scalar}, prefixed=${prefixed}`, async () => {
      const page = instance.page;
      const path = `${folder}/${scalar}-${prefixed}.md`;
      const tag = (value: string) => prefixed ? `#${value}` : value;
      const content = `---\n${stringify({
        tags: scalar ? tag('task/context/onscreen') : ['task', 'task/context/onscreen', 'health'].map(tag),
        status: 'open', priority: 'normal',
      })}---\n`;
      await page.evaluate(async ({ path, content }) => {
        await (window as any).app.vault.create(path, content);
      }, { path, content });
      await expect.poll(() => page.evaluate(async path => {
        return !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path);
      }, path)).toBe(true);
      await page.evaluate(async path => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
      }, path);
      const input = page.locator('.modal input[placeholder="tag1, tag2"]');
      await expect(input).toHaveValue(/task\/context\/onscreen/);
      await input.fill(scalar ? 'task' : 'task, health');
      await page.locator('.modal').getByRole('button', { name: 'Save', exact: true }).click();
      const expected = scalar ? ['task'] : ['health', 'task'];
      await expect.poll(() => page.evaluate(path => {
        const app = (window as any).app;
        const tags = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path))?.frontmatter?.tags;
        return Array.isArray(tags) ? [...tags].sort() : tags;
      }, path)).toEqual(expected);
      // Reopen through fresh cache data: not just an optimistic modal update.
      await page.evaluate(async path => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
      }, path);
      await expect(input).toHaveValue(expected.join(', '));
      await page.locator('.modal').getByRole('button', { name: 'Cancel', exact: true }).click();
    });
  }
}
