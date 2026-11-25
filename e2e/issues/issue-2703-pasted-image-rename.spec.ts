import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeObsidian, launchObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue 2703-${Date.now()}`;
const controlPath = `${folder}/Control.md`;
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XlK0AAAAASUVORK5CYII=';

let instance: ObsidianApp;
let page: Page;
let originalConfig: { attachmentFolderPath: string; newLinkFormat: string; useMarkdownLinks: boolean; tasksFolder: string };

const modal = () => page.locator('.modal.mod-tasknotes');
const details = () => modal().locator('.tn-task-modal__markdown-editor--details .cm-content');
const activeValue = () => page.evaluate(() => (window as any).app.workspace.activeEditor?.editor.getValue());

async function pasteImage(editor: Locator) {
  await editor.click();
  await editor.evaluate((element, data) => {
    const clipboardData = new DataTransfer();
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    clipboardData.items.add(new File([bytes], 'Pasted image.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, png);
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  originalConfig = await page.evaluate(async ({ folder, controlPath }) => {
    const app = (window as any).app;
    const settings = app.plugins.plugins.tasknotes.settings;
    const original = {
      attachmentFolderPath: app.vault.getConfig('attachmentFolderPath'),
      newLinkFormat: app.vault.getConfig('newLinkFormat'),
      useMarkdownLinks: app.vault.getConfig('useMarkdownLinks'),
      tasksFolder: settings.tasksFolder,
    };
    await app.vault.createFolder(folder);
    const note = await app.vault.create(controlPath, '# Image paste control');
    await app.workspace.getLeaf(false).openFile(note);
    app.vault.setConfig('attachmentFolderPath', './');
    return original;
  }, { folder, controlPath });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    if (originalConfig) await page.evaluate(async ({ folder, originalConfig }) => {
      const app = (window as any).app;
      const { tasksFolder, ...config } = originalConfig;
      app.plugins.plugins.tasknotes.settings.tasksFolder = tasksFolder;
      for (const [key, value] of Object.entries(config)) app.vault.setConfig(key, value);
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, originalConfig });
  } finally {
    await closeObsidian(instance);
  }
});

for (const useMarkdownLinks of [false, true]) {
  const format = useMarkdownLinks ? 'Markdown' : 'wiki';
  test(`updates a pasted ${format} image embed in the draft and saved task`, async () => {
    const title = `${format} image task`;
    const tasksFolder = `${folder}/${format} tasks`;
    const renamedPath = `${folder}/${format} screenshot (renamed).png`;
    const finalPath = `${folder}/${format} screenshot final.png`;
    await page.evaluate(({ title, tasksFolder, useMarkdownLinks }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      app.vault.setConfig('useMarkdownLinks', useMarkdownLinks);
      app.vault.setConfig('newLinkFormat', useMarkdownLinks ? 'absolute' : 'shortest');
      plugin.settings.tasksFolder = tasksFolder;
      plugin.openTaskCreationModal({ title });
    }, { title, tasksFolder, useMarkdownLinks });
    await pasteImage(details());
    await expect.poll(activeValue).toMatch(/^!.*Pasted(?:%20| )image/);
    const originalEmbed = await activeValue();
    const literal = `\n\nExample: \`${originalEmbed}\``;
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText(literal);
    await expect.poll(activeValue).toContain(literal.trim());
    const example = (await activeValue()).slice(originalEmbed.length);

    const rename = (from: string | undefined, to: string) => page.evaluate(async ({ folder, from, to }) => {
      const app = (window as any).app;
      const file = from
        ? app.vault.getFileByPath(from)
        : app.vault.getFiles().find(file => file.parent?.path === folder && /^Pasted image .*\.png$/.test(file.name));
      if (!file) throw new Error('Pasted attachment was not created');
      await app.fileManager.renameFile(file, to);
      return '!' + app.fileManager.generateMarkdownLink(file, '');
    }, { folder, from, to });

    const firstEmbed = await rename(undefined, renamedPath);
    await expect.poll(activeValue).toBe(firstEmbed + example);
    await modal().getByRole('button', { name: 'Create task', exact: true }).focus();
    const finalEmbed = await rename(renamedPath, finalPath);
    await details().click();
    await expect.poll(activeValue).toBe(finalEmbed + example);

    await modal().getByRole('button', { name: 'Create task', exact: true }).click();
    await expect(modal()).toHaveCount(0);
    await expect.poll(() => page.evaluate(async ({ finalEmbed, tasksFolder }) => {
      const app = (window as any).app;
      const task = app.vault.getMarkdownFiles().find(file => file.parent?.path === tasksFolder);
      const embed = task && app.metadataCache.getFileCache(task)?.embeds?.find(link => link.original === finalEmbed);
      return embed && app.metadataCache.getFirstLinkpathDest(embed.link, task.path)?.path;
    }, { finalEmbed, tasksFolder })).toBe(finalPath);
  });
}
