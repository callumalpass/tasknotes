/**
 * Issue #2604: in a narrow Pomodoro view the task title ran under the status and priority icons,
 * and the due-date icon sat on its own line, over the title. Older narrow-width rules turned the
 * card back into a flex layout. With "Show all properties on task cards" on, time estimate and
 * tracked time wrap below instead of collapsing into "+N".
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2604
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const folder = `Issue2604-${Date.now()}`;
const path = `${folder}/NUTR 251H - Catch up to Notes.md`;
let instance: ObsidianApp;
let page: Page;
let original: Record<string, unknown>;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1400, height: 900 });
  original = await page.evaluate(async ({ folder, path }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      defaultVisibleProperties: plugin.settings.defaultVisibleProperties,
      wrapTaskCardProperties: plugin.settings.wrapTaskCardProperties,
    };
    plugin.settings.defaultVisibleProperties = ['status', 'priority', 'due', 'contexts', 'timeEstimate', 'totalTrackedTime'];
    plugin.settings.wrapTaskCardProperties = false;
    await plugin.saveSettings();
    await app.vault.createFolder(folder);
    await app.vault.create(path,
      `---\ntags: [task]\ntitle: NUTR 251H - Catch up to Notes\nstatus: open\npriority: high\n` +
      `due: 2020-01-06\ncontexts: [251H]\ntimeEstimate: 90\ntimeEntries:\n` +
      `  - startTime: 2020-01-05T10:00:00Z\n    endTime: 2020-01-05T10:45:00Z\n---\n`);
    return original;
  }, { folder, path });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ folder, original }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, original);
      await plugin.saveSettings();
      await plugin.pomodoroService.saveLastSelectedTask(undefined);
      app.workspace.getLeavesOfType('tasknotes-pomodoro-view').forEach((leaf: any) => leaf.detach());
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, original });
  } finally {
    await closeObsidian(instance);
  }
});

async function showInSidebar(width: number, wrap: boolean) {
  await page.evaluate(async ({ path, width, wrap }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.wrapTaskCardProperties = wrap;
    app.workspace.rightSplit.expand();
    let leaf = app.workspace.getLeavesOfType('tasknotes-pomodoro-view')[0];
    if (!leaf) {
      leaf = app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: 'tasknotes-pomodoro-view', active: true });
    }
    app.workspace.revealLeaf(leaf);
    app.workspace.rightSplit.setSize(width);
    await new Promise(resolve => setTimeout(resolve, 300));
    await leaf.view.selectTask(await plugin.cacheManager.getTaskByPath(path));
  }, { path, width, wrap });
  return page.locator('.workspace-leaf-content[data-type="tasknotes-pomodoro-view"] .pomodoro-view__task-card-container .task-card');
}

test('narrow Pomodoro task card keeps the title clear of its icons', async () => {
  for (const width of [240, 280, 330, 380]) {
    const card = await showInSidebar(width, false);
    await expect(card.locator('.task-card__title-text')).toBeVisible();
    const layout = await card.evaluate(element => {
      const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
      const title = box('.task-card__title-text');
      const status = box('.task-card__status-dot');
      const priority = box('.task-card__priority-dot');
      const icon = box('.task-card__metadata-date .task-card__date-icon');
      // #2613: the icons centre on the title's first line, which wraps at these widths.
      const range = document.createRange();
      range.selectNodeContents(element.querySelector('.task-card__title-text')!);
      const line = range.getClientRects()[0];
      const centredOnLine = (selector: string) => {
        const glyph = element.querySelector(`${selector} svg`)!.getBoundingClientRect();
        return Math.abs((glyph.top + glyph.bottom) / 2 - (line.top + line.bottom) / 2) <= 1;
      };
      return {
        clearOfStatus: title.left >= status.right - 1,
        clearOfPriority: title.right <= priority.left + 1,
        dateBelowTitle: icon.top >= title.bottom - 1,
        statusOnFirstLine: centredOnLine('.task-card__status-dot'),
        priorityOnFirstLine: centredOnLine('.task-card__priority-dot'),
        iconBesideDate: icon.top < box('.task-card__metadata-date .task-card__date-value:not(.task-card__date-value--compact)').bottom &&
          icon.right <= box('.task-card__metadata-date .task-card__date-value:not(.task-card__date-value--compact)').left + 1,
      };
    });
    expect(layout, `sidebar width ${width}`).toEqual({ clearOfStatus: true, clearOfPriority: true, dateBelowTitle: true, statusOnFirstLine: true, priorityOnFirstLine: true, iconBesideDate: true });
  }
});

test('"Show all properties on task cards" wraps time properties on the Pomodoro card', async () => {
  const collapsed = await showInSidebar(280, false);
  await expect(collapsed.locator('.task-card__metadata-overflow')).toHaveText(/^\+\d+$/);

  const card = await showInSidebar(280, true);
  await expect(card.locator('.task-card__metadata-overflow')).toBeHidden();
  await expect(card.locator('.task-card__metadata')).toContainText('estimated');
  await expect(card.locator('.task-card__metadata')).toContainText('tracked');
});
