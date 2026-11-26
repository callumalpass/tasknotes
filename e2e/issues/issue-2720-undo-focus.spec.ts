import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closeObsidian, launchObsidian } from '../obsidian';

test.use({ trace: 'on' });

test('TaskNotes undo follows focus across Bases views and the undo toast', async () => {
  const instance = await launchObsidian();
  const { page } = instance;
  const folder = `Issue 2720 ${Date.now()}`;
  const taskPath = `${folder}/Undo focus task.md`;
  const taskOnDisk = () => readFileSync(resolve(process.env.TASKNOTES_E2E_VAULT_DIR ?? 'tasknotes-e2e-vault', taskPath), 'utf8');

  try {
    await page.evaluate(async ({ folder, taskPath }) => {
      const app = (window as any).app;
      await app.vault.createFolder(folder);
      await app.vault.create(taskPath, '---\ntags: [task]\nstatus: open\npriority: normal\n---\n');
      const taskBase = await app.vault.create(`${folder}/Tasks.base`, `filters:
  and:
    - 'file.inFolder("${folder}")'
    - 'file.hasTag("task")'
views:
  - type: tasknotesTaskList
    name: Tasks
  - type: table
    name: Table
`);
      const calendarBase = await app.vault.create(`${folder}/Calendar.base`, 'views:\n  - type: tasknotesCalendar\n    name: Calendar\n');
      await app.workspace.getLeaf(false).openFile(taskBase);
      await app.workspace.getLeaf('split').openFile(calendarBase);
    }, { folder, taskPath });

    const taskView = page.locator('.tn-tasknotesTaskList').filter({ has: page.locator(`[data-task-path="${taskPath}"]`) });
    const calendar = page.locator('.advanced-calendar-view');
    const undo = page.locator('.tn-toast').getByRole('button', { name: 'Undo', exact: true });
    await expect(taskView.locator(`.task-card[data-task-path="${taskPath}"]`)).toBeVisible();

    const changePriority = async () => {
      await taskView.click({ position: { x: 4, y: 4 } });
      await taskView.focus();
      await page.keyboard.press('j');
      await expect(taskView.locator('.tn-task-focused')).toHaveAttribute('data-task-path', taskPath);
      await page.keyboard.press('p');
      const high = page.locator('.tn-picker__row[data-picker-id="high"]');
      await expect(high).toBeVisible();
      await high.click();
      await expect.poll(taskOnDisk).toContain('priority: high');
      await expect(undo).toBeVisible();
    };

    await changePriority();

    // Open a native Bases table in the other pane and check what a non-input view handler receives.
    const otherView = page.locator('.workspace-leaf-content[data-type="bases"]').filter({ has: calendar });
    await otherView.evaluate(async (el, folder) => {
      const app = (window as any).app;
      const leaf = app.workspace.getLeavesOfType('bases').find((candidate: any) => candidate.view.containerEl === el);
      const base = await app.vault.create(`${folder}/Other.base`, 'views:\n  - type: table\n    name: Other\n');
      await leaf.openFile(base);
      app.workspace.setActiveLeaf(leaf, { focus: true });
    }, folder);
    const table = page.locator('.workspace-leaf.mod-active .bases-table');
    await expect(table).toBeVisible();

    const control = page.getByRole('button', { name: 'Other view undo' });
    await table.evaluate(el => {
      const button = document.createElement('button');
      button.textContent = 'Other view undo';
      button.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          button.dataset.received = event.defaultPrevented ? 'cancelled' : 'untouched';
        }
      });
      el.prepend(button);
    });
    await control.focus();
    await expect(control).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect(control).toHaveAttribute('data-received', 'untouched', { timeout: 2000 });
    expect(taskOnDisk()).toContain('priority: high');

    // Focus on document.body while the non-TaskNotes leaf is active must also leave Ctrl+Z untouched.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      (window as any).__tn2720BodyUndo = 'none';
      const onKeydown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          (window as any).__tn2720BodyUndo = event.defaultPrevented ? 'cancelled' : 'untouched';
        }
      };
      (window as any).__tn2720BodyListener = onKeydown;
      document.body.addEventListener('keydown', onKeydown);
    });
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.evaluate(() => (window as any).__tn2720BodyUndo)).toBe('untouched');
    await page.evaluate(() => {
      document.body.removeEventListener('keydown', (window as any).__tn2720BodyListener);
    });
    expect(taskOnDisk()).toContain('priority: high');

    // TaskNotes history stays available from the toast while the other pane is active.
    await undo.focus();
    await page.keyboard.press('Meta+z');
    await expect.poll(taskOnDisk).toContain('priority: normal');

    // TaskNotes undo still works when a TaskNotes Calendar view is active (focused directly or via body).
    await changePriority();
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const leaf = app.workspace.getLeavesOfType('bases').find((candidate: any) => candidate.view.file?.path === `${folder}/Other.base`);
      await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
      app.workspace.setActiveLeaf(leaf, { focus: true });
    }, folder);
    await expect(calendar).toBeVisible();
    await calendar.focus();
    await page.keyboard.press('Control+z');
    await expect.poll(taskOnDisk).toContain('priority: normal');

    // And when focus falls back to document.body while the Calendar leaf is active (e.g. after a drag).
    await changePriority();
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const leaf = app.workspace.getLeavesOfType('bases').find((candidate: any) => candidate.view.file?.path === `${folder}/Calendar.base`);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      (document.activeElement as HTMLElement | null)?.blur?.();
    }, folder);
    await page.keyboard.press('Control+z');
    await expect.poll(taskOnDisk).toContain('priority: normal');
  } finally {
    try {
      await page.evaluate(async folder => {
        const app = (window as any).app;
        for (const leaf of app.workspace.getLeavesOfType('bases')) {
          if (leaf.view.file?.path.startsWith(`${folder}/`)) leaf.detach();
        }
        const fixture = app.vault.getAbstractFileByPath(folder);
        if (fixture) await app.vault.delete(fixture, true);
      }, folder);
    } finally {
      await closeObsidian(instance);
    }
  }
});
