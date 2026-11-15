import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `IntegrationRedesign-${Date.now()}`;
const path = `${folder}/Integration task.md`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async ({ folder, path }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).integrationSettings = structuredClone(plugin.settings);
    plugin.settings.userFields = [
      { id: 'snoozed', key: 'snoozed', displayName: 'Snoozed', type: 'date' },
      { id: 'reviewAt', key: 'reviewAt', displayName: 'Review at', type: 'date' },
    ];
    plugin.fieldMapper.updateUserFields(plugin.settings.userFields);
    plugin.settings.projectAutosuggest = {};
    plugin.settings.tasksFolder = folder;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    await app.vault.create(path, '---\ntags: [task]\ntitle: Integration task\nstatus: open\nsnoozed: 2027-04-12T10:30\n---\nKeep this body\n');
    await app.vault.create(`${folder}/Integration blocker.md`, '---\ntags: [task]\ntitle: Integration blocker\nstatus: open\n---\n');
    await app.vault.create(`${folder}/Integration project.md`, '---\ntags: [project]\n---\n');
    await app.vault.create(`${folder}/Recurring feedback.md`, '---\ntags: [task]\ntitle: Recurring feedback\nstatus: open\nrecurrence: FREQ=DAILY\nscheduled: 2027-04-12\n---\n');
    const base = await app.vault.create(`${folder}/List.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Integration\n    order: [file.name, status, snoozed]\n`);
    await app.workspace.getLeaf(false).openFile(base);
    document.querySelectorAll('.notice').forEach(element => element.remove());
  }, { folder, path });
  await expect(page.locator(`.task-card[data-task-path="${path}"]`)).toBeVisible();
});

test.afterAll(async () => {
  try {
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings = (window as any).integrationSettings;
      plugin.fieldMapper.updateUserFields(plugin.settings.userFields ?? []);
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

const task = () => page.locator(`.task-card[data-task-path="${path}"]`);
const read = (property: string) => page.evaluate(async ({ path, property }) => {
  const plugin = (window as any).app.plugins.plugins.tasknotes;
  return (await plugin.cacheManager.getTaskInfo(path))?.[property];
}, { path, property });

async function menuPath(labels: string[]) {
  await task().click({ button: 'right' });
  for (const label of labels) {
    const entry = page.locator('.menu:visible').last().getByText(label, { exact: true });
    await expect(entry).toBeVisible();
    await entry.hover();
  }
}

async function undo() {
  await expect(page.locator('.tn-toast')).toHaveCount(1);
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await page.locator('.tn-toast__action').click();
}

async function focusTask(targetPath: string) {
  const root = page.locator('.tn-tasknotesTaskList');
  await root.focus();
  await page.keyboard.press('Escape');
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('j');
    if (await root.locator('.tn-task-focused').getAttribute('data-task-path') === targetPath) break;
  }
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', targetPath);
}

test('custom-date and dependency receipts preserve unrelated edits and restore only their owned fields', async () => {
  await expect.poll(() => read('snoozed')).toBe('2027-04-12T10:30');
  await menuPath(['Custom dates', 'Snoozed']);
  await page.locator('.menu:visible').last().getByText('Clear date', { exact: true }).click();
  await expect.poll(() => read('snoozed')).toBeUndefined();
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (fm: any) => {
      fm.integrationNote = 'preserve';
      fm.reviewAt = '2027-05-01';
    });
  }, path);
  await undo();
  await expect.poll(() => read('snoozed')).toBe('2027-04-12T10:30');
  await expect.poll(() => read('customProperties')).toEqual(expect.objectContaining({ snoozed: '2027-04-12T10:30', reviewAt: '2027-05-01' }));
  await menuPath(['Organization', 'Dependencies']);
  await page.locator('.menu:visible').last().getByText('Add “blocked by”…', { exact: true }).click();
  const selector = page.locator('.prompt.tn-modal');
  await selector.locator('input').fill('Integration blocker');
  await selector.locator('.suggestion-item').filter({ hasText: 'Integration blocker' }).click();
  await expect.poll(() => read('blockedBy')).toEqual([expect.objectContaining({ uid: expect.stringContaining('Integration blocker') })]);
  await undo();
  await expect.poll(async () => (await read('blockedBy')) ?? []).toEqual([]);
  expect(await page.evaluate(async path => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(path));
  }, path)).toContain('integrationNote: preserve');
});

test('palette project and occurrence actions each emit one toast with guarded Undo', async () => {
  await focusTask(path);
  await page.keyboard.press('Control+k');
  await page.locator('.tn-picker__input').fill('Add project');
  await page.locator('[data-picker-id="add-project"]').click();
  const selector = page.locator('.prompt.tn-modal');
  await selector.locator('input').fill('Integration project');
  await selector.locator('.suggestion-item').filter({ hasText: 'Integration project' }).click();
  await expect.poll(() => read('projects')).toEqual([expect.stringContaining('Integration project')]);
  await undo();
  await expect.poll(async () => (await read('projects')) ?? []).toEqual([]);
  await focusTask(`${folder}/Recurring feedback.md`);
  await page.keyboard.press('Control+k');
  await page.locator('.tn-picker__input').fill('Complete this occurrence');
  await page.locator('[data-picker-id="complete-recurring-instance"]').click();
  await expect(page.locator('.tn-toast')).toHaveCount(1);
  await expect(page.locator('.tn-toast')).toContainText('Completed occurrence');
  await undo();
  await expect(page.locator('.tn-toast')).toContainText('Recurring task change undone.');
});

test('occurrence-note creation stays available in the unified palette with one plain toast', async () => {
  await focusTask(`${folder}/Recurring feedback.md`);
  await page.keyboard.press('Control+k');
  await page.locator('.tn-picker__input').fill('Open or create occurrence note');
  await page.locator('[data-picker-id="open-or-create-occurrence-note"]').click();
  await expect(page.locator('.tn-toast')).toHaveCount(1);
  await expect(page.locator('.tn-toast')).toContainText('Created occurrence note');
  await expect(page.locator('.tn-toast__action')).toHaveCount(0);
  await expect(page.locator('.notice:visible')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const active = app.workspace.getActiveFile();
    const occurrence = active && await plugin.cacheManager.getTaskInfo(active.path);
    return !!occurrence?.recurrence_parent && active.path.startsWith(`${folder}/`);
  }, folder)).toBe(true);
});
