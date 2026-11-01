import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, ObsidianApp } from '../obsidian';

let app: ObsidianApp;

test.beforeAll(async () => { app = await launchObsidian(); });
test.afterAll(async () => { if (app) await closeObsidian(app); });

for (const width of [1400, 390]) {
  test(`repeat confirmation and editor cancellation at ${width}px`, async () => {
    const page = app.page;
    await setObsidianViewport(page, { width, height: 844 });
    const taskPath = await page.evaluate(async (width) => {
      const host = (window as any).app;
      const plugin = host.plugins.plugins.tasknotes;
      plugin.settings.resetCheckboxesOnRecurrence = true;
      const { file, taskInfo } = await plugin.taskService.createTask({
        title: `Repeat confirmation ${width}`,
        status: plugin.statusManager.getCompletedStatuses()[0],
        scheduled: '2026-01-01',
        due: '2026-01-02',
        details: '- [x] Checked item',
      });
      await plugin.cacheManager.waitForFreshTaskData(file);
      await plugin.taskService.toggleArchive(taskInfo);
      await host.workspace.getLeaf(false).openFile(file);
      return file.path;
    }, width);
    const read = () => page.evaluate(async (taskPath) => {
      const host = (window as any).app;
      return host.vault.read(host.vault.getAbstractFileByPath(taskPath));
    }, taskPath);
    const before = await read();
    const run = () => page.evaluate(() => {
      (window as any).app.commands.executeCommandById('tasknotes:repeat-current-task');
    });
    const confirmation = page.locator('.modal').filter({ hasText: 'Reopen this task, save its completion date' });

    await run();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.screenshot({ path: `/tmp/tasknotes-2188-logs/confirmation-${width}.png` });
    const fits = await confirmation.evaluate((modal) => {
      const rect = modal.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth && modal.scrollWidth <= modal.clientWidth;
    });
    expect(fits).toBe(true);
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    expect(await read()).toBe(before);

    await run();
    await expect(confirmation).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    expect(await read()).toBe(before);

    await run();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
    const editor = page.locator('.modal.mod-tasknotes');
    await expect(editor).toBeVisible();
    await page.screenshot({ path: `/tmp/tasknotes-2188-logs/editor-${width}.png` });
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(editor).toHaveCount(0);
    const repeated = await page.evaluate(async (taskPath) => {
      const host = (window as any).app;
      const plugin = host.plugins.plugins.tasknotes;
      const file = host.vault.getAbstractFileByPath(taskPath);
      await plugin.cacheManager.waitForFreshTaskData(file);
      const task = await plugin.cacheManager.getTaskInfo(taskPath);
      return {
        status: task.status,
        expectedStatus: plugin.settings.defaultTaskStatus,
        archived: task.archived,
        completedDate: task.completedDate,
        history: task.complete_instances,
        scheduled: task.scheduled,
        due: task.due,
        content: await host.vault.read(file),
      };
    }, taskPath);
    expect(repeated.status).toBe(repeated.expectedStatus);
    expect(repeated.archived).toBe(false);
    expect(repeated.completedDate).toBeUndefined();
    expect(repeated.history).toHaveLength(1);
    expect(repeated.scheduled).toBe('2026-01-01');
    expect(repeated.due).toBe('2026-01-02');
    expect(repeated.content).toContain('- [ ] Checked item');
  });
}
