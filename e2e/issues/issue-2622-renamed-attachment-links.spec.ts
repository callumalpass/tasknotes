/**
 * Discussion #2622: TaskNotes stores attachment links by full vault path. When the folder holding
 * an attachment is renamed, Obsidian rewrites the link in its own link format (by default the
 * shortest path, `[[Quarterly report.pdf]]`). Task cards still found the file, but the task modal
 * read the short link from the vault root and listed the attachment as "File not found", with no
 * way to open it.
 *
 * @see https://github.com/callumalpass/tasknotes/discussions/2622
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue2622-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      app.workspace.getLeavesOfType('pdf').forEach((leaf: any) => leaf.detach());
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

test('the task modal finds an attachment after Obsidian rewrites its link on a folder rename', async () => {
  const stored = await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.createFolder(`${folder}/files`);
    await app.vault.createBinary(`${folder}/files/Quarterly report.pdf`, new ArrayBuffer(8));
    const task = await app.vault.create(`${folder}/Report task.md`,
      `---\ntags: [task]\ntitle: Report task\nstatus: open\nattachments: ["[[${folder}/files/Quarterly report.pdf]]"]\n---\n`);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.fileManager.renameFile(app.vault.getAbstractFileByPath(`${folder}/files`), `${folder}/papers`);
    const plugin = app.plugins.plugins.tasknotes;
    for (let i = 0; i < 40; i++) {
      const info = await plugin.cacheManager.getTaskInfo(task.path);
      if (info?.attachments?.[0] !== `[[${folder}/files/Quarterly report.pdf]]`) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const info = await plugin.cacheManager.getTaskInfo(task.path);
    await plugin.openTaskEditModal(info);
    return info.attachments;
  }, folder);
  // Obsidian's default "New link format" is the shortest path.
  expect(stored).toEqual(['[[Quarterly report.pdf]]']);

  const item = page.locator('.modal .task-attachment-item');
  await expect(item).toHaveCount(1);
  await expect(item).not.toHaveClass(/task-attachment-item--unresolved/);
  await expect(item.locator('.task-attachment-path')).toHaveText(`${folder}/papers/Quarterly report.pdf`);
  await item.locator('.task-attachment-open').click();
  // Open puts the attachment in a new tab.
  await expect.poll(() => page.evaluate(() => {
    const paths: string[] = [];
    (window as any).app.workspace.iterateAllLeaves((leaf: any) => { if (leaf.view?.file) paths.push(leaf.view.file.path); });
    return paths;
  })).toContain(`${folder}/papers/Quarterly report.pdf`);
  await page.evaluate(() => {
    const app = (window as any).app;
    app.workspace.getLeavesOfType('pdf').forEach((leaf: any) => leaf.detach());
    document.querySelectorAll('.modal-container').forEach(container => container.remove());
  });
});

// Discussion #2640: the same after renaming the file itself, then moving and renaming it again.
test('the task modal follows an attachment through renames and a move', async () => {
  const stored = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await app.vault.createFolder(`${folder}/inbox`);
    await app.vault.createFolder(`${folder}/archive`);
    await app.vault.createBinary(`${folder}/inbox/scan.png`, new ArrayBuffer(8));
    const task = await app.vault.create(`${folder}/Scan task.md`,
      `---\ntags: [task]\ntitle: Scan task\nstatus: open\nattachments: ["[[${folder}/inbox/scan.png]]"]\n---\n`);
    await new Promise(resolve => setTimeout(resolve, 500));
    const history: string[] = [];
    const settle = async (previous: string | undefined) => {
      for (let i = 0; i < 40; i++) {
        const value = (await plugin.cacheManager.getTaskInfo(task.path))?.attachments?.[0];
        if (value !== previous) return value;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return previous;
    };
    let current = (await plugin.cacheManager.getTaskInfo(task.path)).attachments[0];
    for (const target of [`${folder}/inbox/receipt.png`, `${folder}/archive/summary.png`]) {
      await app.fileManager.renameFile(app.vault.getAbstractFileByPath(app.metadataCache.getFirstLinkpathDest(current.slice(2, -2), task.path).path), target);
      current = await settle(current);
      history.push(current);
    }
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(task.path));
    return history;
  }, folder);
  expect(stored).toEqual(['[[receipt.png]]', '[[summary.png]]']);

  const item = page.locator('.modal .task-attachment-item');
  await expect(item).toHaveCount(1);
  await expect(item).not.toHaveClass(/task-attachment-item--unresolved/);
  await expect(item.locator('.task-attachment-path')).toHaveText(`${folder}/archive/summary.png`);
  await page.keyboard.press('Escape');
});
