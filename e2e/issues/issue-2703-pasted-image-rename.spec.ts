import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeObsidian, launchObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue 2703-${Date.now()}`;
const controlPath = `${folder}/Control.md`;
const png = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGP8nyLOQApgIkn1qIZRDUNKAwC34AGa7SUoWwAAAABJRU5ErkJggg==';
const unrelatedPng = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGPkitNgIAUwkaR6VMOohiGlAQDr4QCwEX98YwAAAABJRU5ErkJggg==';

let instance: ObsidianApp;
let page: Page;
let originalConfig: { attachmentFolderPath: string; newLinkFormat: string; useMarkdownLinks: boolean; alwaysUpdateLinks: boolean; tasksFolder: string };

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
      alwaysUpdateLinks: app.vault.getConfig('alwaysUpdateLinks'),
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

test('applies automatic screenshot naming when saving the draft', async () => {
  const renamerId = 'obsidian-paste-image-rename';
  const tasksFolder = `${folder}/Automatic naming tasks`;
  const unrelatedName = 'Pasted image 20000101000000.png';
  const originalRenamerSettings = await page.evaluate(renamerId => {
    const app = (window as any).app;
    const renamer = app.plugins.getPlugin(renamerId);
    const imageNamePattern = '{{DATE:YYYYMMDD-HHmmssSSS}}';
    if (renamer) {
      const original = { ...renamer.settings };
      Object.assign(renamer.settings, { autoRename: true, imageNamePattern });
      return original;
    }

    // Use the actual plugin when installed in the E2E vault. This stand-in keeps
    // the saved-note contract test runnable in the default vault, without a download.
    app.plugins.plugins[renamerId] = {
      settings: { autoRename: true, imageNamePattern },
      isExcluded: () => false,
      testExcludeExtension: () => false,
      sourceProtectionReason: (source) => app.metadataCache.getFileCache(source) ? undefined : 'Source is not indexed',
      generateNewName: (file, _source, date) => ({
        isMeaningful: true,
        newName: date.format('YYYYMMDD-HHmmssSSS') + '.' + file.extension,
      }),
      renameFile: (file, name) => app.fileManager.renameFile(file, file.parent.path + '/' + name),
    };
    return null;
  }, renamerId);

  try {
    await page.evaluate(tasksFolder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      app.vault.setConfig('alwaysUpdateLinks', true);
      app.vault.setConfig('useMarkdownLinks', false);
      app.vault.setConfig('newLinkFormat', 'shortest');
      plugin.settings.tasksFolder = tasksFolder;
      plugin.openTaskCreationModal({ title: 'Automatic image name' });
    }, tasksFolder);
    await pasteImage(details());
    await expect.poll(activeValue).toMatch(/^!\[\[Pasted image \d+\.png\]\]$/);
    const draftEmbed = await activeValue();

    // This other vault image arrived during the modal session and has the same
    // size and default-looking name, but its bytes did not come from this paste.
    await page.evaluate(async ({ folder, name, png }) => {
      const app = (window as any).app;
      const bytes = Uint8Array.from(atob(png), char => char.charCodeAt(0));
      await app.vault.createBinary(`${folder}/${name}`, bytes.buffer);
    }, { folder, name: unrelatedName, png: unrelatedPng });
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText(`\n\n![[${unrelatedName}]]`);
    await expect.poll(activeValue).toContain(unrelatedName);

    await modal().getByRole('button', { name: 'Create task', exact: true }).click();
    await expect(modal()).toHaveCount(0);

    await expect.poll(() => page.evaluate(({ tasksFolder, folder }) => {
      const app = (window as any).app;
      const task = app.vault.getMarkdownFiles().find(file => file.parent?.path === tasksFolder);
      const embeds = task && app.metadataCache.getFileCache(task)?.embeds;
      return embeds?.map(embed => {
        const file = app.metadataCache.getFirstLinkpathDest(embed.link, task.path);
        return file?.parent?.path === folder ? file.name : null;
      });
    }, { tasksFolder, folder })).toEqual([
      expect.stringMatching(/^\d{8}-\d{9}\.png$/),
      unrelatedName,
    ]);
    const saved = await page.evaluate(async tasksFolder => {
      const app = (window as any).app;
      const task = app.vault.getMarkdownFiles().find(file => file.parent?.path === tasksFolder);
      return app.vault.read(task);
    }, tasksFolder);
    expect(saved).not.toContain(draftEmbed);
  } finally {
    await page.evaluate(({ renamerId, originalRenamerSettings }) => {
      const app = (window as any).app;
      if (originalRenamerSettings) {
        app.plugins.getPlugin(renamerId).settings = originalRenamerSettings;
      } else {
        delete app.plugins.plugins[renamerId];
      }
    }, { renamerId, originalRenamerSettings });
  }
});
