import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// #2632: on a recurring task, Status sets the series' own status (#2440), but the
// menu, picker and notice said only "Status". They now say "Series status";
// an occurrence note keeps "Status".
let instance: ObsidianApp;
const stamp = Date.now();
const prefix = `Issue 2632 ${stamp}`;
const folder = `e2e-2632-${stamp}`;
const parentPath = `${folder}/${prefix} series.md`;
const basePath = `${folder}/Tasks.base`;
const created = [parentPath, basePath];

async function openStatusPicker(page: Page, card: ReturnType<Page['locator']>, label: string) {
  await card.click({ button: 'right' });
  const item = page.locator('.menu .menu-item').filter({
    has: page.locator('.menu-item-title', { hasText: new RegExp(`^${label}$`) }),
  });
  await expect(item).toBeVisible();
  await item.click();
  const input = page.locator('.tn-picker__input');
  await expect(input).toHaveAttribute('placeholder', label);
  return input;
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async ({ folder, prefix, parentPath, basePath }) => {
    const app = (window as any).app;
    app.plugins.plugins.tasknotes.settings.googleCalendarExport.enabled = false;
    await app.vault.createFolder(folder);
    await app.vault.create(parentPath, `---
title: ${prefix} series
status: open
priority: normal
tags: [task]
scheduled: 2027-01-10
recurrence: DTSTART:20270103;FREQ=WEEKLY;BYDAY=SU
---
`);
    await app.vault.create(basePath, `filters:
  and:
    - file.name.startsWith("${prefix}")
views:
  - type: tasknotesTaskList
    name: Tasks
`);
  }, { folder, prefix, parentPath, basePath });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async paths => {
      const app = (window as any).app;
      for (const path of paths) {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) await app.vault.delete(file, true);
      }
    }, [...created, folder]);
  } finally { await closeObsidian(instance); }
});

test('a recurring task labels its status control "Series status"; an occurrence note keeps "Status"', async () => {
  const page = instance.page;
  await expect.poll(() => page.evaluate(async path =>
    Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path)), parentPath)).toBe(true);
  await page.evaluate(async basePath => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(basePath));
  }, basePath);

  const card = (path: string) => page.locator(`.task-card[data-task-path="${path}"]`).first();
  const series = card(parentPath);
  await expect(series).toBeVisible();
  const input = await openStatusPicker(page, series, 'Series status');
  await input.fill('Done');
  await input.press('Enter');
  await expect(page.locator('.tn-toast').filter({ hasText: 'Series status → Done' })).toBeVisible();
  // Behaviour is unchanged: the series' own status, with no occurrence recorded.
  await expect.poll(() => page.evaluate(path => {
    const app = (window as any).app;
    return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path))?.frontmatter?.status;
  }, parentPath)).toBe('done');
  await page.keyboard.press('Escape');

  const occurrencePath = await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const parent = await plugin.cacheManager.getTaskInfo(path);
    return (await plugin.taskService.materializeOccurrence(parent, '2027-01-17')).path as string;
  }, parentPath);
  created.push(occurrencePath);
  // Its filename starts with the parent's title, so the view's filter includes it.
  const occurrence = card(occurrencePath);
  await expect(occurrence).toBeVisible();
  await openStatusPicker(page, occurrence, 'Status');
  await page.keyboard.press('Escape');
});
