import { test, expect, type Page, type Locator } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `Keyboard-round2-${Date.now()}`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const dismiss = page.locator('.notice').getByText("Don't show again", { exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    (window as any).keyboardOriginalSettings = structuredClone(plugin.settings);
    plugin.settings.enableNaturalLanguageInput = false;
    plugin.settings.openTaskAfterCreation = 'none';
    await app.vault.createFolder(folder);
    for (let index = 0; index < 4; index++) {
      await app.vault.create(`${folder}/Task ${index}.md`,
        `---\ntags: [task, keyboard-round2]\ntitle: Keyboard task ${index}${index === 2 ? ' Zebrafocus' : ''}\nstatus: open\npriority: normal\ndue: 2026-11-13\nscheduled: 2026-11-13\n---\n`);
    }
  }, folder);
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings = (window as any).keyboardOriginalSettings;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { if (instance) await closeObsidian(instance); }
});

async function openView(type = 'tasknotesTaskList', group = 'status'): Promise<Locator> {
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("keyboard-round2")'] },
    views: [{ type, name: 'Keyboard', order: ['status', 'priority', 'due'],
      sort: [{ property: 'file.name', direction: 'ASC' }], enableSearch: true,
      initialDate: '2026-11-13', calendarView: 'timeGridWeek', dayMaxEvents: 8,
      groupBy: { property: group, direction: 'ASC' } }] });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/${type}-${Date.now()}.base`, content });
  const root = page.locator(`.workspace-leaf.mod-active ${type === 'tasknotesCalendar' ? '.advanced-calendar-view' : `.tn-${type}`}`);
  await expect(root).toBeVisible();
  await expect(root.locator('[data-task-path]').first()).toBeVisible();
  await root.focus();
  return root;
}

test('help dismissal and property picker cancellation return to a live view', async () => {
  const root = await openView();
  await page.keyboard.press('j');
  await page.keyboard.press('?');
  await expect(page.locator('.tn-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  for (const key of ['s', 'p', 'd', 'Shift+H', 't', 'Control+k']) {
    await page.keyboard.press(key);
    await expect(page.locator('.tn-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(root).toBeFocused();
    await page.keyboard.press('j');
    await expect(root.locator('.tn-task-focused')).toHaveCount(1);
  }
});

test('search returns to results or the previous row without dead keys', async () => {
  const root = await openView();
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  const previous = await root.locator('.tn-task-focused').getAttribute('data-task-path');
  await page.keyboard.press('/');
  const search = root.locator('.tn-search-box input');
  await expect(search).toBeFocused();
  await search.fill('zzzzunmatched');
  await expect(root.locator('.task-card')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', previous!);
  for (const key of ['ArrowDown', 'Enter']) {
    await page.keyboard.press('/');
    await search.fill('Zebrafocus');
    await expect(root.locator('.task-card')).toHaveCount(1);
    await page.keyboard.press(key);
    await expect(root).toBeFocused();
    await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', `${folder}/Task 2.md`);
    await page.keyboard.press('/');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
});

test('picker nesting, selection, date editing, help button and host commands keep focus live', async () => {
  const root = await openView();
  await page.keyboard.press('j');
  await page.keyboard.press('Control+k');
  const palette = page.locator('.task-action-palette-modal');
  await expect(palette.locator('[data-picker-id="open-task-file"] .tn-key')).toHaveText('↵');
  await expect(palette.locator('[data-picker-id="edit-task"] .tn-key')).toHaveText('E');
  await palette.locator('[data-picker-id="picker-status"]').click();
  await expect(page.locator('.tn-picker__input')).toHaveAttribute('placeholder', 'Status');
  await page.keyboard.press('Control+p');
  await expect(page.locator('.prompt')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.prompt')).toHaveCount(0);
  if (await page.locator('.tn-popover').count()) await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  await page.keyboard.press('d');
  await expect(page.locator('[data-picker-id="current"] .tn-picker__label')).not.toHaveText('2026-11-13');
  await page.locator('[data-picker-id="custom"]').click();
  await expect(page.locator('.date-time-picker-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  const help = page.locator('.workspace-leaf.mod-active .tn-shortcut-help');
  await help.click();
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  await page.keyboard.press('j');
  await expect(root.locator('.tn-task-focused')).toHaveCount(1);
  await page.keyboard.press('s');
  await root.click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.tn-popover')).toHaveCount(0);
  await expect(root).toBeFocused();
  await page.keyboard.press('p');
  await page.locator('[data-picker-id="high"]').click();
  await expect(root).toBeFocused();
});

test('grouped triage stays in the original queue after a property move', async () => {
  for (const [group, key, choice] of [['status', 's', 'done'], ['priority', 'p', 'high']]) {
    await page.evaluate(async ({ folder, group }) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      for (let index = 0; index < 4; index++) {
        await plugin.updateTaskProperty(await plugin.cacheManager.getTaskInfo(`${folder}/Task ${index}.md`), group, group === 'status' ? 'open' : 'normal');
      }
    }, { folder, group });
    const root = await openView('tasknotesTaskList', group);
    await page.keyboard.press('j');
    const moved = await root.locator('.tn-task-focused').getAttribute('data-task-path');
    const groupRows = root.locator('.tn-task-focused').locator('xpath=ancestor::*[contains(@class,"task-list-group")][1]').locator('.task-card');
    const remaining = (await groupRows.evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.taskPath!))).filter(path => path !== moved);
    expect(remaining.length).toBeGreaterThan(0);
    await page.keyboard.press(key);
    await page.locator(`[data-picker-id="${choice}"]`).click();
    await expect(root).toBeFocused();
    await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-task-path', remaining[0]);
    await page.keyboard.press(key);
    await expect(page.locator('.tn-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(root).toBeFocused();
    await page.evaluate(async ({ moved, group }) => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      await plugin.updateTaskProperty(await plugin.cacheManager.getTaskInfo(moved), group, group === 'status' ? 'open' : 'normal');
    }, { moved, group });
  }
});

test('help remains readable and restores live focus in light and dark themes', async () => {
  const root = await openView();
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    await page.keyboard.press('?');
    const overlay = page.locator('.tn-popover');
    await expect(overlay).toBeVisible();
    await overlay.evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
      document.querySelectorAll('.notice, .tn-toast').forEach(notice => notice.remove());
    });
    await page.screenshot({ path: `/tmp/tasknotes-keyboard-round2/help-${theme}.png` });
    await page.keyboard.press('Escape');
    await expect(root).toBeFocused();
    await page.keyboard.press('j');
    await expect(root.locator('.tn-task-focused')).toHaveCount(1);
  }
});

test('calendar navigation, event properties, help and create share the keyboard layer', async () => {
  const root = await openView('tasknotesCalendar');
  await page.keyboard.press('j');
  await expect(root.locator('.tn-task-focused')).toHaveCount(1);
  const first = await root.locator('.tn-task-focused').getAttribute('data-keyboard-id');
  await page.keyboard.press('l');
  await expect(root.locator('.tn-task-focused')).not.toHaveAttribute('data-keyboard-id', first!);
  await page.keyboard.press('h');
  await expect(root.locator('.tn-task-focused')).toHaveAttribute('data-keyboard-id', first!);
  await page.keyboard.press('s');
  await expect(page.locator('.tn-picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  for (const key of ['p', 'd', 'Shift+H', 't', 'Control+k']) {
    await page.keyboard.press(key);
    await expect(page.locator('.tn-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(root).toBeFocused();
  }
  await page.keyboard.press('?');
  await expect(page.locator('.tn-shortcut-row').filter({ hasText: 'Status' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  await page.keyboard.press('c');
  await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
  await expect(page.locator('[data-type="scheduled-date"]')).toContainText('Nov 13');
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
  await page.keyboard.press('Escape');
  for (const [key, view] of [['d', 'day'], ['w', 'week'], ['m', 'month']]) {
    await page.keyboard.press(key);
    await expect(root.locator(`.tnc--${view}`)).toBeVisible();
    await expect(root).toBeFocused();
  }
  const title = root.locator('.tnc-title');
  const initial = await title.textContent();
  await page.keyboard.press('n');
  await expect(title).not.toHaveText(initial!);
  await page.keyboard.press('p');
  await expect(title).toHaveText(initial!);
  await page.keyboard.press(']');
  await expect(title).not.toHaveText(initial!);
  await page.keyboard.press('[');
  await expect(title).toHaveText(initial!);
  await page.keyboard.press('t');
  await expect(root).toBeFocused();
  await page.keyboard.press('c');
  await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
  await expect(page.locator('[data-type="scheduled-date"]')).toContainText('Today');
  await page.keyboard.press('Escape');
  await expect(root).toBeFocused();
});

test('create inherits reliable folder and tag filters', async () => {
  const root = await openView();
  await page.keyboard.press('c');
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal).toBeVisible();
  const title = `Created keyboard ${Date.now()}`;
  await modal.locator('.title-input').fill(title);
  await page.keyboard.press('Control+Enter');
  await expect(modal).toHaveCount(0);
  await expect.poll(() => page.evaluate(async ({ folder, title }) => {
    const app = (window as any).app;
    const file = app.vault.getMarkdownFiles().find((file: any) => file.basename === title);
    if (!file) return null;
    const task = await app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(file.path);
    return { folder: file.parent.path, tag: task?.tags.includes('keyboard-round2') };
  }, { folder, title })).toEqual({ folder, tag: true });
  await expect(root).toBeFocused();
  await page.keyboard.press('j');
  await expect(root.locator('.tn-task-focused')).toHaveCount(1);
});

test('creation hidden by an unsupported filter offers an Open action', async () => {
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.name.contains("not-visible-keyword")'] },
    views: [{ type: 'tasknotesTaskList', name: 'Hidden creation' }] });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/Hidden.base`, content });
  const root = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');
  await expect(root).toBeVisible();
  await root.focus();
  await page.keyboard.press('c');
  const modal = page.locator('.modal.mod-tasknotes');
  await expect(modal).toBeVisible();
  await modal.locator('.title-input').fill(`Hidden keyboard ${Date.now()}`);
  await page.keyboard.press('Control+Enter');
  await expect(modal).toHaveCount(0);
  await expect(root).toBeFocused();
  await expect(page.locator('.tn-toast')).toContainText('Task created, but hidden by this view');
  await page.locator('.tn-toast__action').getByText('Open', { exact: true }).click();
  await expect(page.locator('.workspace-leaf.mod-active .markdown-source-view')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
});

test('calendar Enter opens the focused note and mini-calendar arrows retain grid focus', async () => {
  const root = await openView('tasknotesCalendar');
  await page.keyboard.press('j');
  const path = await root.locator('.tn-task-focused').getAttribute('data-task-path');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(path);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`] },
    views: [{ type: 'tasknotesMiniCalendar', name: 'Mini keys', dateProperty: 'note.scheduled', titleProperty: 'title' }] });
  await page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
  }, { path: `${folder}/Mini.base`, content });
  const mini = page.locator('.workspace-leaf.mod-active .mini-calendar-bases-view');
  await expect(mini).toBeVisible();
  const grid = mini.locator('.mini-calendar-view__grid');
  await grid.focus();
  await page.keyboard.press('t');
  await expect(grid).toBeFocused();
  const selected = mini.locator('.mini-calendar-view__day--selected');
  await expect(selected).toHaveCount(1);
  const first = await selected.getAttribute('aria-label');
  await page.keyboard.press('ArrowRight');
  await expect(selected).not.toHaveAttribute('aria-label', first!);
  await expect(grid).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(selected).toHaveAttribute('aria-label', first!);
  await expect(grid).toBeFocused();
});
