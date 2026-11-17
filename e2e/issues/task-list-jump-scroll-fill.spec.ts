import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// A large jump in a Task List's own scroll must fill the viewport without another scroll.
// Rows are shorter than the initial estimate, so before the fix the bottom stayed blank.
const folder = `TaskListJump-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, base }) => {
    const app = (window as any).app;
    await app.vault.createFolder(folder);
    for (let i = 0; i < 150; i++) {
      const n = String(i).padStart(3, '0');
      await app.vault.create(`${folder}/Row ${n}.md`, `---\ntitle: Row ${n}\nstatus: open\ntags: [task]\n---\n`);
    }
    const file = await app.vault.create(`${folder}/Rows.base`, base);
    await app.workspace.getLeaf(false).openFile(file);
  }, {
    folder,
    base: stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{ type: 'tasknotesTaskList', name: 'Rows', sort: [{ property: 'file.name', direction: 'ASC' }] }],
    }),
  });
  await expect(page.locator('.tn-tasknotesTaskList [data-virtual-index]').first()).toBeVisible({ timeout: 15000 });
});

test.afterAll(async () => {
  try {
    await page?.evaluate(async (folder) => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

test('rows fill the list after a large jump in its own scroll', async () => {
  const blankBelowRows = () => page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('.tn-tasknotesTaskList .tn-bases-items-container')!;
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-virtual-index]'));
    const box = list.getBoundingClientRect();
    const lastBottom = Math.max(...rows.map((row) => row.getBoundingClientRect().bottom));
    return Math.max(0, Math.round(box.bottom - lastBottom));
  });

  await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('.tn-tasknotesTaskList .tn-bases-items-container')!;
    list.scrollTop = 2000;
  });
  await page.waitForTimeout(1500);
  expect(await blankBelowRows()).toBe(0);
});
