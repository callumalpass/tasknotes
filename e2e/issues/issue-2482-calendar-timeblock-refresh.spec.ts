import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let app: ObsidianApp;
let notePath: string;
let originalNote: string | null = null;
const basePath = 'issue-2482-refresh.base';

function content(title: string): string {
  return `---\ntimeblocks:\n  - id: tb-refresh-test\n    title: ${title}\n    startTime: "09:00"\n    endTime: "10:00"\n---\nDaily body\n`;
}

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => {
  if (!app) return;
  try {
    await app.page.evaluate(async ({ notePath, originalNote, basePath }) => {
      const host = (window as any).app;
      host.workspace.getMostRecentLeaf()?.detach();
      const note = host.vault.getAbstractFileByPath(notePath);
      if (note && originalNote !== null) await host.vault.modify(note, originalNote);
      else if (note) await host.vault.delete(note);
      const base = host.vault.getAbstractFileByPath(basePath);
      if (base) await host.vault.delete(base);
    }, { notePath, originalNote, basePath });
  } finally {
    await closeObsidian(app);
  }
});

test('outside daily-note changes refresh an open calendar without reopening', async ({}, testInfo) => {
  const page = app.page;
  notePath = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.md`;
  });
  originalNote = await page.evaluate(async path => {
    const host = (window as any).app;
    const file = host.vault.getAbstractFileByPath(path);
    return file ? host.vault.read(file) : null;
  }, notePath);
  await page.evaluate(async ({ notePath, text, basePath }) => {
    const host = (window as any).app;
    const existing = host.vault.getAbstractFileByPath(notePath);
    if (existing) await host.vault.modify(existing, text);
    else await host.vault.create(notePath, text);
    await host.vault.create(basePath, `filters:\n  and:\n    - file.name == "no-matching-notes"\nviews:\n  - type: tasknotesCalendar\n    name: Refresh\n    calendarView: timeGridDay\n    showTimeblocks: true\n    scrollTime: 08:00:00\n`);
    await host.workspace.getLeaf(true).openFile(host.vault.getAbstractFileByPath(basePath));
  }, { notePath, text: content('Refresh original'), basePath });
  const item = (title: string) => page.locator('.tnc:visible .tnc-item').filter({ hasText: title });
  await expect(item('Refresh original')).toBeVisible({ timeout: 15000 });
  console.log(`${new Date().toISOString()} initial timeblock visible`);
  await page.screenshot({ path: testInfo.outputPath('before.png') });

  // A raw vault write bypasses TaskNotes' timeblock writers and refresh events.
  const write = (text: string) => page.evaluate(async ({ path, text }) => {
    await (window as any).app.vault.adapter.write(path, text);
  }, { path: notePath, text });
  await write(content('Refresh original') + '\nBody-only edit\n');
  await expect(item('Refresh original')).toBeVisible();
  await write(content('Refresh updated'));
  console.log(`${new Date().toISOString()} external timeblock edit written`);
  try {
    await expect(item('Refresh updated')).toBeVisible({ timeout: 10000 });
    await expect(item('Refresh original')).toHaveCount(0);
    await write('---\ntimeblocks: []\n---\nDaily body\n');
    await expect(item('Refresh updated')).toHaveCount(0, { timeout: 10000 });
    console.log(`${new Date().toISOString()} external edit and removal reflected without reopening`);
  } finally {
    await page.screenshot({ path: testInfo.outputPath('after.png') });
  }
});
