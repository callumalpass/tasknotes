import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../obsidian';

// #2328: completing a materialized occurrence of a recurring task scheduled with a time
// ("2026-06-01T09:00") left the parent's complete_instances unchanged. The model's progression
// rejected the minute-precision time while adding DTSTART; only a console warning was logged.

let obsidian: ObsidianApp;
const folder = `e2e-2328-${Date.now()}`;
const created: string[] = [];

test.beforeAll(async () => {
  obsidian = await launchObsidian();
  await obsidian.page.evaluate(async (path) => {
    await (window as any).app.vault.createFolder(path);
  }, folder);
});

test.afterAll(async () => {
  if (!obsidian) return;
  try {
    await obsidian.page.evaluate(async (paths) => {
      const app = (window as any).app;
      for (const path of paths) {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) await app.vault.delete(file, true);
      }
    }, [...created, folder]);
  } finally {
    await closeObsidian(obsidian);
  }
});

for (const { label, scheduled, next } of [
  { label: 'scheduled with a time', scheduled: '2026-06-01T09:00', next: '2026-06-02T09:00' },
  { label: 'date-only (control)', scheduled: '2026-06-01', next: '2026-06-02' },
]) {
  test(`direct status edit on an occurrence updates its parent: ${label}`, async () => {
    const page = obsidian.page;
    const parentPath = `${folder}/Standup ${label}.md`;
    created.push(parentPath);

    const occurrencePath = await page.evaluate(async ({ parentPath, scheduled }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      await app.vault.create(parentPath, `---
title: Standup
tags: [task]
status: open
priority: normal
scheduled: ${scheduled}
recurrence: FREQ=DAILY
---
`);
      let parent = null;
      for (let i = 0; i < 50 && !parent; i++) {
        await new Promise((r) => setTimeout(r, 100));
        parent = await plugin.cacheManager.getTaskInfo(parentPath);
      }
      if (!parent) throw new Error('parent task was not indexed');
      const occurrence = await plugin.taskService.materializeOccurrence(parent, '2026-06-01');
      return occurrence.path as string;
    }, { parentPath, scheduled });
    created.push(occurrencePath);

    // Edit the status the way Properties or another plugin would: straight in the frontmatter.
    await page.waitForFunction(async (path) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      return (await plugin.cacheManager.getTaskInfo(path))?.occurrence_date === '2026-06-01';
    }, occurrencePath);
    await page.evaluate(async (path) => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (fm: any) => {
        fm.status = 'done';
      });
    }, occurrencePath);

    const parentFrontmatter = () => page.evaluate((path) => {
      const app = (window as any).app;
      return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path))?.frontmatter ?? {};
    }, parentPath);
    await expect.poll(async () => (await parentFrontmatter()).complete_instances, { timeout: 10000 })
      .toEqual(['2026-06-01']);
    const parent = await parentFrontmatter();
    expect(parent.scheduled).toBe(next);
    expect(parent.recurrence).toMatch(/^DTSTART:20260601(T\d{6}Z?)?;FREQ=DAILY$/);
  });
}
